(function (global) {
  function unwrapAllPredictions(data) {
    const allPredictions = {};
    const finalPredictionsCache = {};
    const squadsCache = {};
    const entries = (data && data.predictions) ? Object.entries(data.predictions) : [];
    for (const [username, userData] of entries) {
      allPredictions[username] = userData.predictions || {};
      finalPredictionsCache[username] = userData.finalPredictions || null;
      if (Array.isArray(userData.squad) && userData.squad.length > 0) {
        squadsCache[username] = userData.squad;
      }
    }
    return { allPredictions, finalPredictionsCache, squadsCache };
  }

  global.unwrapAllPredictions = unwrapAllPredictions;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { unwrapAllPredictions };
  }
})(typeof window !== 'undefined' ? window : globalThis);
