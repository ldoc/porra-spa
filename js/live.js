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

  function buildLiveTabsHtml(currentTab) {
    const tabs = [['jornadas', 'Jornadas'], ['live', '🔴 Live'], ['clasificacion', 'Clasif.'], ['eliminatorias', 'Elim.']];
    return '<div class="resultados-tabs">' + tabs.map(([key, label]) =>
      `<button class="resultados-tab ${currentTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`
    ).join('') + '</div>';
  }

  function buildRingHtml(secsLeft, total) {
    const C = 2 * Math.PI * 26;
    const off = ringOffset(secsLeft, total).toFixed(1);
    return `<div style="text-align:center"><div style="position:relative;width:64px;height:64px;margin-left:auto">`
      + `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="6"/>`
      + `<circle cx="32" cy="32" r="26" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}" transform="rotate(-90 32 32)"/></svg>`
      + `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:18px;font-weight:900;color:#F8FAFC;line-height:1">${secsLeft}</div><div style="font-size:8px;color:#94A3B8;font-weight:700">SEG</div></div>`
      + `</div></div>`;
  }

  function zoneRow(rank, avatar, name, sub, right, highlight) {
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;${highlight ? 'background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4)' : ''}">`
      + `<div style="font-size:11px;color:#94A3B8;font-weight:800;width:16px">${rank}</div>`
      + `<div style="width:30px;height:30px;border-radius:50%;background:#1B2B54;display:flex;align-items:center;justify-content:center;font-size:16px">${avatar}</div>`
      + `<div style="flex:1"><div style="font-size:12px;font-weight:700">${name}</div><div style="font-size:10px;color:#64748B">${sub}</div></div>`
      + `<div style="font-size:10px;font-weight:800">${right}</div></div>`;
  }

  function buildZoneHtml(gaps, ranks) {
    const r = ranks || {};
    const rows = [];
    rows.push(gaps.above
      ? zoneRow(r.above || '', gaps.above.avatar, gaps.above.name, `${gaps.above.livePoints} pts`, `a ${gaps.pointsToAbove} pts ▲`, false)
      : `<div style="padding:8px;font-size:11px;color:#64748B">Lideras el live 🏆</div>`);
    rows.push(zoneRow(r.me || '', gaps.me.avatar, `${gaps.me.name} <span>TÚ</span>`, `${gaps.me.livePoints} pts`, `${gaps.me.livePoints}`, true));
    rows.push(gaps.below
      ? zoneRow(r.below || '', gaps.below.avatar, gaps.below.name, `${gaps.below.livePoints} pts`, `+${gaps.pointsOverBelow} ▼`, false)
      : `<div style="padding:8px;font-size:11px;color:#64748B">Sin perseguidor</div>`);
    return `<div style="margin-top:10px;background:rgba(0,0,0,0.28);border-radius:10px;overflow:hidden">`
      + `<div class="live-zone-toggle" style="display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:44px">`
      + `<div style="font-size:11px;color:#F8FAFC;font-weight:800;flex:1">🏆 TU ZONA EN DIRECTO</div>`
      + `<div class="live-zone-chev" style="font-size:14px;color:#94A3B8">▸</div></div>`
      + `<div class="live-zone-body" style="padding:0 6px 6px;display:none">${rows.join('')}</div></div>`;
  }

  const liveApi = { resolveLiveRefreshSecs, LIVE_DEFAULT_SECS, liveGoalsOf, diffLiveMatches, computeLiveGaps, ringOffset, buildLiveTabsHtml, buildRingHtml, buildZoneHtml };
  global.liveApi = liveApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = liveApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
