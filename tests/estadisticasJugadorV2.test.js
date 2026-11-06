const assert = require('assert');
const { calcExactStats, calcSourceRanks, calcMatchExtremes, calcDataCoverage } = require('../js/stats.js');

const leagueMatches = [
  { id: 1, fase: 'liga', ronda: 1, fechaTs: 100, homeTeamId: 10, awayTeamId: 20 },
  { id: 2, fase: 'liga', ronda: 1, fechaTs: 200, homeTeamId: 30, awayTeamId: 40 },
  { id: 3, fase: 'liga', ronda: 2, fechaTs: 300, homeTeamId: 10, awayTeamId: 30 },
  { id: 4, fase: 'liga', ronda: 2, fechaTs: 400, homeTeamId: 20, awayTeamId: 40 },
  { id: 5, fase: '16', ronda: 3, fechaTs: 500, homeTeamId: 10, awayTeamId: 40 },
];

const matchStatsById = {
  1: { stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
  2: { stats: { 30: { goles: 0 }, 40: { goles: 0 } } },
  3: { stats: { 10: { goles: 1 }, 30: { goles: 1 } } },
};

function test_calcExactStats_por_jornada_y_totales() {
  const allPredictions = {
    ana: {
      1: { home: 2, away: 1 },
      2: { home: 0, away: 0 },
      3: { home: 2, away: 0 },
      4: { home: 1, away: 0 },
      5: { home: 1, away: 0 },
    },
  };
  const r = calcExactStats('ana', leagueMatches, matchStatsById, allPredictions);
  assert.deepStrictEqual(r.totals, { played: 3, exact: 2, outcomeHits: 2, exactPct: 67 });
  assert.deepStrictEqual(r.byJornada, [
    { ronda: 1, played: 2, exact: 2, outcomeHits: 2, complete: true },
    { ronda: 2, played: 1, exact: 0, outcomeHits: 0, complete: false },
  ]);
  assert.deepStrictEqual(r.streaks, { currentExact: 0, bestExact: 2 });
}

function test_calcExactStats_racha_actual_y_no_pronosticados() {
  const allPredictions = {
    bob: {
      1: { home: 2, away: 1 },
      2: { home: 1, away: 0 },
      3: { home: 1, away: 1 },
    },
  };
  const r = calcExactStats('bob', leagueMatches, matchStatsById, allPredictions);
  assert.strictEqual(r.totals.played, 3);
  assert.strictEqual(r.totals.exact, 2);
  assert.deepStrictEqual(r.streaks, { currentExact: 1, bestExact: 1 });
}

test_calcExactStats_por_jornada_y_totales();
test_calcExactStats_racha_actual_y_no_pronosticados();
console.log('OK estadisticasJugadorV2 T1');

function test_calcSourceRanks_empates_y_top_pct() {
  const splitByUser = {
    ana: { prediction: 10, squad: 5, classification: 0, eliminatorias: 0 },
    bob: { prediction: 10, squad: 7, classification: 0, eliminatorias: 0 },
    carol: { prediction: 3, squad: 7, classification: 0, eliminatorias: 0 },
  };
  const r = calcSourceRanks(splitByUser, ['ana', 'bob', 'carol']);
  assert.strictEqual(r.ana.prediction.rank, 1);
  assert.strictEqual(r.bob.prediction.rank, 1);
  assert.strictEqual(r.carol.prediction.rank, 3);
  assert.strictEqual(r.carol.prediction.topPct, 100);
  assert.strictEqual(r.bob.squad.rank, 1);
  assert.strictEqual(r.carol.squad.rank, 1);
  assert.strictEqual(r.ana.squad.rank, 3);
  assert.strictEqual(r.bob.total.rank, 1);
  assert.strictEqual(r.ana.total.rank, 2);
  assert.strictEqual(r.carol.total.rank, 3);
  assert.strictEqual(r.ana.classification.hasData, false);
  assert.strictEqual(r.ana.classification.rank, null);
}

function test_calcSourceRanks_total_desempate_oficial() {
  const splitByUser = {
    ana: { prediction: 10, squad: 0, classification: 0, eliminatorias: 0 },
    bob: { prediction: 8, squad: 0, classification: 0, eliminatorias: 2 },
  };
  const r = calcSourceRanks(splitByUser, ['ana', 'bob']);
  assert.strictEqual(r.bob.total.rank, 1);
  assert.strictEqual(r.ana.total.rank, 2);
}

test_calcSourceRanks_empates_y_top_pct();
test_calcSourceRanks_total_desempate_oficial();
console.log('OK estadisticasJugadorV2 T2');

function test_calcMatchExtremes_media_y_empate_antiguo() {
  const playedMatches = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 1, result: 'D' },
  ];
  const allPredictions = {
    ana: { 1: { home: 2, away: 1 }, 2: { home: 0, away: 0 }, 3: { home: 2, away: 0 } },
    bob: { 1: { home: 1, away: 0 }, 2: { home: 1, away: 1 }, 3: { home: 2, away: 0 } },
  };
  const userPoints = {
    ana: { matchDetails: [
      { match: { id: 1 }, points: 8 },
      { match: { id: 2 }, points: 8 },
      { match: { id: 3 }, points: 0 },
    ] },
    bob: { matchDetails: [
      { match: { id: 1 }, points: 8 },
      { match: { id: 2 }, points: 0 },
      { match: { id: 3 }, points: 8 },
    ] },
  };
  const matchesById = {
    1: { id: 1, fechaTs: 100, homeTeam: 'A', awayTeam: 'B' },
    2: { id: 2, fechaTs: 200, homeTeam: 'C', awayTeam: 'D' },
    3: { id: 3, fechaTs: 300, homeTeam: 'E', awayTeam: 'F' },
  };
  const r = calcMatchExtremes('ana', playedMatches, allPredictions, userPoints, matchesById);
  assert.strictEqual(r.best.matchId, 1);
  assert.strictEqual(r.best.points, 8);
  assert.strictEqual(r.best.avg, 8);
  assert.strictEqual(r.best.delta, 0);
  assert.strictEqual(r.best.sample, 2);
  assert.strictEqual(r.worst.matchId, 3);
  assert.strictEqual(r.worst.points, 0);
  assert.strictEqual(r.worst.avg, 4);
  assert.strictEqual(r.worst.delta, -4);
  assert.strictEqual(r.worst.sample, 2);
}

function test_calcMatchExtremes_sin_partidos() {
  assert.deepStrictEqual(calcMatchExtremes('ana', [], {}, {}, {}), { best: null, worst: null });
}

function test_calcDataCoverage_parcial() {
  const matchStats = [
    { eventId: 1, stats: matchStatsById[1].stats },
    { eventId: 2, stats: matchStatsById[2].stats },
    { eventId: 3, stats: matchStatsById[3].stats },
  ];
  const allPredictions = {
    ana: {
      1: { home: 2, away: 1 },
      2: { home: 0, away: 0 },
      3: { home: 1, away: 1 },
      4: { home: 1, away: 0 },
    },
  };
  const r = calcDataCoverage(leagueMatches, matchStats, allPredictions, 'ana');
  assert.deepStrictEqual(r, {
    totalLeague: 4,
    playedLeague: 3,
    completedJornadas: 1,
    totalJornadas: 2,
    userPredictedPlayed: 3,
    partial: true,
  });
}

function test_calcDataCoverage_completa() {
  const matchStats = [
    { eventId: 1, stats: matchStatsById[1].stats },
    { eventId: 2, stats: matchStatsById[2].stats },
    { eventId: 3, stats: matchStatsById[3].stats },
    { eventId: 4, stats: { 20: { goles: 1 }, 40: { goles: 0 } } },
  ];
  const allPredictions = {
    ana: {
      1: { home: 2, away: 1 },
      2: { home: 0, away: 0 },
      3: { home: 1, away: 1 },
      4: { home: 1, away: 0 },
    },
  };
  const r = calcDataCoverage(leagueMatches, matchStats, allPredictions, 'ana');
  assert.strictEqual(r.playedLeague, 4);
  assert.strictEqual(r.completedJornadas, 2);
  assert.strictEqual(r.userPredictedPlayed, 4);
  assert.strictEqual(r.partial, false);
}

test_calcMatchExtremes_media_y_empate_antiguo();
test_calcMatchExtremes_sin_partidos();
test_calcDataCoverage_parcial();
test_calcDataCoverage_completa();
console.log('OK estadisticasJugadorV2 T3');
