(function (global) {
  const FASE_LABELS = { liga: 'Liguilla', '16': '16avos', '8': 'Octavos', '4': 'Cuartos', semis: 'Semifinales', final: 'Final' };

  function countPredictedMatches(matches, predictions) {
    let done = 0;
    for (const m of matches || []) {
      const p = predictions && predictions[m.id];
      if (p && typeof p.home === 'number' && typeof p.away === 'number') done++;
    }
    return done;
  }

  function computeFinalSlotsFilled(fp) {
    if (!fp) return 0;
    const slots = [
      fp.champion != null ? 1 : 0,
      fp.runnerUp != null ? 1 : 0,
      (fp.semiFinalists || []).filter(Boolean).length,
      (fp.quarterFinalists || []).filter(Boolean).length,
      (fp.roundOf16 || []).filter(Boolean).length,
      (fp.roundOf32 || []).filter(Boolean).length
    ];
    return slots.reduce((a, b) => a + b, 0);
  }

  function computeProgressForUser(user, matchesByFase) {
    const byFase = {};
    for (const [fase, matches] of Object.entries(matchesByFase || {})) {
      byFase[fase] = {
        done: countPredictedMatches(matches, user.predictions),
        total: (matches || []).length
      };
    }
    return {
      username: user.username,
      avatar: user.avatar || '👤',
      isAdmin: user.isAdmin === true,
      predictionsConfirmed: user.predictionsConfirmed === true,
      byFase,
      finalFilled: computeFinalSlotsFilled(user.finalPredictions),
      finalTotal: 24,
      finalLocked: user.predictionsConfirmed !== true,
      squadCount: typeof user.squadCount === 'number' ? user.squadCount : (Array.isArray(user.squad) ? user.squad.length : 0),
      squadTotal: 25
    };
  }

  function computeSummaries(progressList) {
    const total = progressList.length;
    const ligaComplete = progressList.filter(p => {
      const liga = p.byFase && p.byFase.liga;
      return liga && liga.total > 0 && liga.done === liga.total;
    }).length;
    const confirmed = progressList.filter(p => p.predictionsConfirmed).length;
    const squadComplete = progressList.filter(p => p.squadCount === p.squadTotal).length;
    const finalComplete = progressList.filter(p => !p.finalLocked && p.finalFilled === p.finalTotal).length;
    return { total, ligaComplete, confirmed, squadComplete, finalComplete };
  }

  function sortUsers(progressList, sortKey) {
    const arr = [...progressList];
    const byName = (a, b) => String(a.username).localeCompare(String(b.username));
    if (sortKey === 'name') return arr.sort(byName);
    if (sortKey === 'confirmed') return arr.sort((a, b) => (Number(b.predictionsConfirmed) - Number(a.predictionsConfirmed)) || byName(a, b));
    const ligaDone = p => (p.byFase && p.byFase.liga) ? p.byFase.liga.done : 0;
    return arr.sort((a, b) => (ligaDone(a) - ligaDone(b)) || byName(a, b));
  }

  global.FASE_LABELS = FASE_LABELS;
  global.countPredictedMatches = countPredictedMatches;
  global.computeFinalSlotsFilled = computeFinalSlotsFilled;
  global.computeProgressForUser = computeProgressForUser;
  global.computeSummaries = computeSummaries;
  global.sortUsers = sortUsers;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FASE_LABELS, countPredictedMatches, computeFinalSlotsFilled, computeProgressForUser, computeSummaries, sortUsers };
  }
})(typeof window !== 'undefined' ? window : globalThis);