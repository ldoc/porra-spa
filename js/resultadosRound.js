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

  const resultadosRoundApi = { sortRoundMatches };
  global.resultadosRoundApi = resultadosRoundApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = resultadosRoundApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
