(function (global) {
  const LIVE_DEFAULT_SECS = 60;

  function validSecs(v) {
    return Number.isInteger(v) && v > 0 ? v : null;
  }

  function resolveLiveRefreshSecs(fileSecs, serverSecs) {
    return validSecs(serverSecs) ?? validSecs(fileSecs) ?? LIVE_DEFAULT_SECS;
  }

  function goalsOf(m) {
    return liveGoalsOf(m.stats);
  }

  function liveGoalsOf(stats) {
    const out = {};
    for (const [k, v] of Object.entries(stats || {})) {
      if (k === 'jugadores') continue;
      if (v && typeof v.goles === 'number') out[k] = v.goles;
    }
    return out;
  }

  function diffLiveMatches(prev, next) {
    const events = [];
    const prevById = new Map((prev || []).map(m => [m.eventId, m]));
    for (const m of (next || [])) {
      const p = prevById.get(m.eventId);
      if (!p) {
        events.push({ type: 'start', eventId: m.eventId });
        continue;
      }
      const pg = goalsOf(p), ng = goalsOf(m);
      for (const teamId of Object.keys(ng)) {
        if ((ng[teamId] || 0) > (pg[teamId] || 0)) {
          events.push({ type: 'goal', eventId: m.eventId, teamId });
        }
      }
      if (p.status !== m.status) {
        events.push({ type: 'status', eventId: m.eventId, from: p.status, to: m.status });
        if (m.status === 'FT') events.push({ type: 'end', eventId: m.eventId });
      }
    }
    return events;
  }

  function computeLiveGaps(sortedDesc, username) {
    const i = sortedDesc.findIndex(r => r.name === username);
    if (i < 0) return { above: null, me: null, below: null };
    const me = sortedDesc[i];
    const above = i > 0 ? sortedDesc[i - 1] : null;
    const below = i < sortedDesc.length - 1 ? sortedDesc[i + 1] : null;
    return {
      above, me, below,
      pointsToAbove: above ? above.livePoints - me.livePoints : 0,
      pointsOverBelow: below ? me.livePoints - below.livePoints : 0
    };
  }

  function ringOffset(secsLeft, total) {
    const C = 2 * Math.PI * 26;
    return C * (1 - Math.max(0, Math.min(1, secsLeft / total)));
  }

  const liveApi = { resolveLiveRefreshSecs, LIVE_DEFAULT_SECS, liveGoalsOf, diffLiveMatches, computeLiveGaps, ringOffset };
  global.liveApi = liveApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = liveApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
