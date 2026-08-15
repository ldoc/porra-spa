(function (global) {
  const ACTIVE_PHASES = ['FASE_LIGA', 'FASE_16', 'FASE_8', 'FASE_4', 'FASE_SEMIS', 'FASE_FINAL'];

  function isHoyPartidosAllowed(fase) {
    return ACTIVE_PHASES.includes(fase);
  }

  function getMatchResult(home, away) {
    if (home > away) return 'H';
    if (home < away) return 'A';
    return 'D';
  }

  function getTodayMatches(matches, nowMs, calendarFase) {
    const now = new Date(nowMs);
    return (matches || []).filter(m => {
      const d = new Date(m.fechaTs * 1000);
      return m.fase === calendarFase &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    });
  }

  function computeResultCounts(matchId, allPredictions) {
    const counts = { H: 0, D: 0, A: 0 };
    let total = 0;
    for (const username of Object.keys(allPredictions || {})) {
      const p = allPredictions[username]?.[matchId];
      if (!p || typeof p.home !== 'number' || typeof p.away !== 'number') continue;
      counts[getMatchResult(p.home, p.away)]++;
      total++;
    }
    const pct = { H: 0, D: 0, A: 0 };
    if (total > 0) {
      pct.H = counts.H / total;
      pct.D = counts.D / total;
      pct.A = counts.A / total;
    }
    return { counts, total, pct };
  }

  function computeBestResult(counts, myResult) {
    if (!counts || counts.total === 0) return null;
    if (myResult !== 'H' && myResult !== 'D' && myResult !== 'A') return null;
    let best = null;
    for (const r of ['H', 'D', 'A']) {
      const advantage = r === myResult ? 8 * (1 - counts.pct[r]) : -8 * counts.pct[r];
      if (!best || advantage > best.advantage) best = { result: r, advantage };
    }
    return best;
  }

  function getRealResult(match, matchStats) {
    const ms = (matchStats || []).find(s => s.eventId === match.id);
    if (!ms || !ms.stats) return null;
    const home = ms.stats[match.homeTeamId]?.goles;
    const away = ms.stats[match.awayTeamId]?.goles;
    if (home === undefined || away === undefined) return null;
    return { home, away };
  }

  function calcMatchPoints(myPrediction, realHome, realAway) {
    if (!myPrediction || typeof myPrediction.home !== 'number' || typeof myPrediction.away !== 'number') return 0;
    if (realHome === undefined || realAway === undefined) return 0;
    let points = 0;
    if (getMatchResult(myPrediction.home, myPrediction.away) === getMatchResult(realHome, realAway)) points += 8;
    if (myPrediction.home === realHome) points += 3;
    if (myPrediction.away === realAway) points += 3;
    if (myPrediction.home === realHome && myPrediction.away === realAway) points += 1;
    return points;
  }

  function formatMatchTime(fechaTs) {
    const d = new Date(fechaTs * 1000);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} · ${hora}:${min}`;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const hoyPartidosApi = {
    isHoyPartidosAllowed, getMatchResult, getTodayMatches,
    computeResultCounts, computeBestResult, getRealResult,
    calcMatchPoints, formatMatchTime, esc
  };
  global.hoyPartidosApi = hoyPartidosApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = hoyPartidosApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
