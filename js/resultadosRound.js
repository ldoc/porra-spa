(function (global) {
  function sortRoundMatches(allRoundMatches) {
    return [...allRoundMatches].sort((a, b) => {
      const aPlayed = !!a.hasResult;
      const bPlayed = !!b.hasResult;
      if (aPlayed && bPlayed) return a.match.fechaTs - b.match.fechaTs;
      if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;
      return a.match.fechaTs - b.match.fechaTs;
    });
  }

  function getCurrentRoundKey(roundList, matches, matchStats, nowMs) {
    if (!roundList || roundList.length === 0) return null;
    const matchesList = matches || [];
    const msList = matchStats || [];
    const windowByKey = new Map();
    for (const entry of roundList) {
      const roundMatches = matchesList.filter(m => m.fase === entry.fase && m.ronda === entry.ronda);
      if (roundMatches.length === 0) continue;
      const minTs = Math.min(...roundMatches.map(m => m.fechaTs));
      const maxTs = Math.max(...roundMatches.map(m => m.fechaTs));
      windowByKey.set(entry.key, { minTs, maxTs });
    }
    for (const entry of roundList) {
      const w = windowByKey.get(entry.key);
      if (w && nowMs >= w.minTs * 1000 && nowMs <= w.maxTs * 1000) return entry.key;
    }
    const msEventIds = new Set(msList.filter(s => s && s.stats).map(s => s.eventId));
    for (let i = roundList.length - 1; i >= 0; i--) {
      const entry = roundList[i];
      const hasResult = matchesList.some(m =>
        m.fase === entry.fase && m.ronda === entry.ronda && msEventIds.has(m.id)
      );
      if (hasResult) return entry.key;
    }
    return roundList[roundList.length - 1].key;
  }

  const resultadosRoundApi = { sortRoundMatches, getCurrentRoundKey };
  global.resultadosRoundApi = resultadosRoundApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = resultadosRoundApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
