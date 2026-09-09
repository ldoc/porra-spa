(function (global) {
  function getMatchDayKey(fechaTs) {
    if (typeof fechaTs !== 'number' || !isFinite(fechaTs)) return null;
    const d = new Date(fechaTs * 1000);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function dayKeyOfMatch(match) {
    return match ? getMatchDayKey(match.fechaTs) : null;
  }

  function getLastTwoMatchDays(matches, matchStats) {
    const byId = new Map((matches || []).map(m => [m.id, m]));
    const days = new Set();
    for (const ms of matchStats || []) {
      const key = dayKeyOfMatch(byId.get(ms ? ms.eventId : undefined));
      if (key) days.add(key);
    }
    const sorted = Array.from(days).sort();
    if (sorted.length < 2) return null;
    return { prev: sorted[sorted.length - 2], last: sorted[sorted.length - 1] };
  }

  function filterMatchStatsUpTo(dayKey, matches, matchStats) {
    const byId = new Map((matches || []).map(m => [m.id, m]));
    return (matchStats || []).filter(ms => {
      const key = dayKeyOfMatch(byId.get(ms ? ms.eventId : undefined));
      return key !== null && key <= dayKey;
    });
  }

  function countUserPredictionsInSubset(userPredictions, subsetIds) {
    if (!userPredictions || !subsetIds) return 0;
    let n = 0;
    for (const id of subsetIds) {
      const p = userPredictions[id];
      if (p && typeof p.home === 'number' && typeof p.away === 'number') n++;
    }
    return n;
  }

  function computeTrendMap(prevRows, currRows) {
    const prevByName = new Map((prevRows || []).map((r, i) => [r.name, { rank: i + 1, row: r }]));
    const map = {};
    (currRows || []).forEach((r, i) => {
      const currRank = i + 1;
      const prev = prevByName.get(r.name);
      if (!prev || !(prev.row.predictedCount > 0)) { map[r.name] = null; return; }
      const diff = prev.rank - currRank;
      if (diff === 0) map[r.name] = { dir: 'same', n: 0 };
      else map[r.name] = { dir: diff > 0 ? 'up' : 'down', n: Math.abs(diff) };
    });
    return map;
  }

  function buildTrendCellHtml(trend) {
    if (!trend) return '<span class="trend"></span>';
    if (trend.dir === 'same') {
      return '<span class="trend trend-same" title="Igual que el día anterior con partidos" aria-label="Igual que el día anterior con partidos"><span>＝</span></span>';
    }
    const isUp = trend.dir === 'up';
    const arrow = isUp ? '▲' : '▼';
    const verb = isUp ? 'Sube' : 'Baja';
    const plural = trend.n === 1 ? '' : 's';
    const label = `${verb} ${trend.n} puesto${plural} respecto al día anterior con partidos`;
    const inner = isUp
      ? `<span>${arrow}</span><span>${trend.n}</span>`
      : `<span>${trend.n}</span><span>${arrow}</span>`;
    return `<span class="trend trend-${trend.dir}" title="${label}" aria-label="${label}">${inner}</span>`;
  }

  const trendApi = {
    getMatchDayKey, getLastTwoMatchDays, filterMatchStatsUpTo,
    countUserPredictionsInSubset, computeTrendMap, buildTrendCellHtml
  };
  global.trendApi = trendApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = trendApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
