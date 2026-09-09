(function (global) {
  const API_BASE_FALLBACK = 'https://api-porra.vercel.app';
  function apiBase() {
    try {
      if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return 'http://localhost:3000';
    } catch (e) {}
    return API_BASE_FALLBACK;
  }
  const ACTIVE = ['FASE_LIGA', 'FASE_16', 'FASE_8', 'FASE_4', 'FASE_SEMIS', 'FASE_FINAL'];
  function isLiveAllowed(fase) { return ACTIVE.includes(fase); }

  function stalenessLabel(scrapedAt, nowMs) {
    const mins = Math.max(0, Math.round(((nowMs || Date.now()) - new Date(scrapedAt).getTime()) / 60000));
    return mins <= 0 ? 'ahora mismo' : `hace ${mins} min`;
  }

  function resultOf(h, a) { return h > a ? 'H' : h < a ? 'A' : 'D'; }
  function livePointsForUser(live, pred) {
    if (!live || !pred || typeof pred.home !== 'number' || typeof pred.away !== 'number') return 0;
    let p = 0;
    if (resultOf(pred.home, pred.away) === resultOf(live.homeGoles, live.awayGoles)) p += 8;
    if (pred.home === live.homeGoles) p += 3;
    if (pred.away === live.awayGoles) p += 3;
    if (pred.home === live.homeGoles && pred.away === live.awayGoles) p += 1;
    return p;
  }

  function squadPlayersInLive(live, squad) {
    const ids = new Set((squad || []).map(s => String(s.id)));
    const teams = new Set([String(live?.homeTeamId), String(live?.awayTeamId)]);
    return ((live?.stats?.jugadores) || []).filter(j => ids.has(String(j.id)) && teams.has(String(j.equipo)));
  }

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function buildLiveCardHtml({ live, myPred, livePoints, teamNames }) {
    const badge = live.estado === 'live' ? (live.minuto ? `🔴 LIVE ${live.minuto}’` : '🔴 LIVE') : live.estado === 'descanso' ? '⏸ Descanso' : '🏁 Final';
    return `<div class="live-card" data-event="${live.eventId}">`
      + `<div class="live-head"><span class="live-badge">${badge}</span><span class="live-stale">${esc(stalenessLabel(live.scrapedAt, Date.now()))}</span></div>`
      + `<div class="live-score">${esc(teamNames?.[live.homeTeamId] || live.homeTeamId)} ${live.homeGoles} - ${live.awayGoles} ${esc(teamNames?.[live.awayTeamId] || live.awayTeamId)}</div>`
      + `<div class="live-mine">Tu pronóstico: ${myPred ? `${myPred.home}-${myPred.away} · +${livePoints} pts live` : '—'}</div>`
      + `</div>`;
  }

  async function fetchLiveUpdated(deps) {
    const { fetchFn, cache } = deps;
    const res = await fetchFn(`${apiBase()}/api/live-matches/updated`);
    if (res.status === 304) return { notModified: true };
    const data = await res.json().catch(() => null);
    return data;
  }

  async function fetchLiveMatches(deps) {
    const { fetchFn, cache, etag } = deps;
    // 1) SWR: si hay caché, el llamante ya pintó; aquí solo revalidamos con ETag
    const res = await fetchFn(`${apiBase()}/api/live-matches`, etag ? { headers: { 'If-None-Match': etag } } : {});
    if (res.status === 304) return { notModified: true };
    const data = await res.json().catch(() => null);
    if (data?.ok && Array.isArray(data.liveMatches)) {
      const merged = cache.mergeLiveMatches(cache.cached || [], data.liveMatches);
      const newEtag = res.headers?.get ? res.headers.get('ETag') : null;
      return { liveMatches: merged, serverTime: data.serverTime, etag: newEtag };
    }
    return null;
  }

  const api = { isLiveAllowed, stalenessLabel, livePointsForUser, squadPlayersInLive, esc, buildLiveCardHtml, fetchLiveUpdated, fetchLiveMatches };
  global.liveTab = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
