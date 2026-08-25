const assert = require('assert');
const { matchResultOf, extractPlayedMatches, calcReliabilityRow, calcReliabilityRows } = require('../js/stats.js');
const { buildCompletedLeagueData, calcStreaks, calcBestJornadas } = require('../js/stats.js');
const { computeMatchConsensus, tallyChampions, finalPredictionTeamIds, compareQuadroWithCommunity } = require('../js/stats.js');

function test_matchResultOf() {
  assert.strictEqual(matchResultOf(2, 1), 'H');
  assert.strictEqual(matchResultOf(0, 3), 'A');
  assert.strictEqual(matchResultOf(1, 1), 'D');
}

function test_extractPlayedMatches_solo_con_goles_finitos() {
  const matches = [
    { id: 1, homeTeamId: 10, awayTeamId: 20 },
    { id: 2, homeTeamId: 30, awayTeamId: 40 },
    { id: 3, homeTeamId: 50, awayTeamId: 60 },
  ];
  const msById = {
    1: { eventId: 1, stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
    2: { eventId: 2, stats: { 30: { goles: 0 }, 40: { goles: 0 } } },
    3: { eventId: 3, stats: {} },
  };
  const played = extractPlayedMatches(matches, msById);
  assert.strictEqual(played.length, 2);
  assert.deepStrictEqual(played[0], { matchId: 1, home: 2, away: 1, result: 'H' });
  assert.deepStrictEqual(played[1], { matchId: 2, home: 0, away: 0, result: 'D' });
}

function test_calcReliabilityRow_metricas() {
  const playedMatches = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 3, result: 'A' },
    { matchId: 4, home: 2, away: 2, result: 'D' },
  ];
  const allPredictions = {
    ana: {
      1: { home: 2, away: 1 },
      2: { home: 0, away: 0 },
      3: { home: 2, away: 0 },
    },
  };
  const userPoints = { ana: { matchDetails: [
    { match: { id: 1 }, points: 15 },
    { match: { id: 2 }, points: 4 },
    { match: { id: 3 }, points: 11 },
    { match: { id: 99 }, points: 8 },
  ] } };
  const r = calcReliabilityRow('ana', playedMatches, allPredictions, userPoints);
  assert.strictEqual(r.played, 3);
  assert.strictEqual(r.hits, 2);
  assert.strictEqual(r.pctResult, 67);
  assert.strictEqual(r.ptsPerMatch, 10);
  assert.strictEqual(r.exactScores, 2);
  assert.strictEqual(r.perfect15, 1);
}

function test_calcReliabilityRow_sin_pronosticos() {
  const r = calcReliabilityRow('bob', [], {}, {});
  assert.strictEqual(r.played, 0);
  assert.strictEqual(r.pctResult, 0);
  assert.strictEqual(r.ptsPerMatch, 0);
}

function test_calcReliabilityRows_orden_desc_y_desempate() {
  const players = [{ name: 'ana' }, { name: 'bea' }, { name: 'cal' }];
  const playedMatches = [
    { matchId: 1, home: 1, away: 0, result: 'H' },
    { matchId: 2, home: 1, away: 0, result: 'H' },
  ];
  const allPredictions = {
    ana: { 1: { home: 1, away: 0 }, 2: { home: 0, away: 0 } },
    bea: { 1: { home: 1, away: 0 }, 2: { home: 1, away: 0 } },
    cal: { 1: { home: 0, away: 1 }, 2: { home: 0, away: 2 } },
  };
  const userPoints = {
    ana: { matchDetails: [{ match: { id: 1 }, points: 15 }, { match: { id: 2 }, points: 3 }] },
    bea: { matchDetails: [{ match: { id: 1 }, points: 15 }, { match: { id: 2 }, points: 15 }] },
    cal: { matchDetails: [{ match: { id: 1 }, points: 12 }, { match: { id: 2 }, points: 8 }] },
  };
  const rows = calcReliabilityRows(players, playedMatches, allPredictions, userPoints);
  assert.deepStrictEqual(rows.map(r => r.username), ['bea', 'ana', 'cal']);
  assert.strictEqual(rows[0].pctResult, 100);
  assert.strictEqual(rows[1].pctResult, 50);
  assert.strictEqual(rows[2].hits, 0);
}

test_matchResultOf();
test_extractPlayedMatches_solo_con_goles_finitos();
test_calcReliabilityRow_metricas();
test_calcReliabilityRow_sin_pronosticos();
test_calcReliabilityRows_orden_desc_y_desempate();
console.log('OK estadisticas-subtabs T1');

function test_buildCompletedLeagueData_solo_jornadas_completas() {
  const leagueMatches = [
    { id: 1, ronda: 1, homeTeamId: 10, awayTeamId: 20, fase: 'liga' },
    { id: 2, ronda: 1, homeTeamId: 30, awayTeamId: 40, fase: 'liga' },
    { id: 3, ronda: 2, homeTeamId: 10, awayTeamId: 30, fase: 'liga' },
    { id: 4, ronda: 3, homeTeamId: 20, awayTeamId: 40, fase: 'liga' },
  ];
  const msById = {
    1: { eventId: 1, stats: { 10: { goles: 1 }, 20: { goles: 0 } } },
    2: { eventId: 2, stats: { 30: { goles: 2 }, 40: { goles: 2 } } },
    3: { eventId: 3, stats: { 10: { goles: 3 }, 30: { goles: 1 } } },
  };
  const detailsByUser = {
    ana: [
      { match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 },
      { match: { id: 2, ronda: 1, fase: 'liga' }, points: 7 },
      { match: { id: 3, ronda: 2, fase: 'liga' }, points: 15 },
      { match: { id: 4, ronda: 3, fase: 'liga' }, points: 5 },
      { match: { id: 999, ronda: 4, fase: '16' }, points: 9 },
    ],
  };
  const r = buildCompletedLeagueData(leagueMatches, msById, detailsByUser);
  assert.deepStrictEqual(r.completedRondas, [1, 2]);
  assert.deepStrictEqual(r.pointsByUserByJornada.ana, [15, 15]);
}

function test_calcStreaks_up_down_y_empate() {
  const st = calcStreaks({
    a: [10, 20, 30],
    b: [30, 25, 10],
    c: [10, 10, 20],
    d: [5],
    e: [],
  });
  assert.deepStrictEqual(st.a, { dir: 'up', len: 2, lastPts: 30 });
  assert.deepStrictEqual(st.b, { dir: 'down', len: 2, lastPts: 10 });
  assert.deepStrictEqual(st.c, { dir: 'up', len: 1, lastPts: 20 });
  assert.strictEqual(st.d, null);
  assert.strictEqual(st.e, null);
}

function test_calcStreaks_corte_al_cambiar_direccion() {
  const st = calcStreaks({ x: [10, 30, 20, 25] });
  assert.deepStrictEqual(st.x, { dir: 'up', len: 1, lastPts: 25 });
}

function test_calcBestJornadas_top_n() {
  const best = calcBestJornadas({
    ana: [15, 30],
    bea: [40],
  }, 2);
  assert.deepStrictEqual(best, [
    { username: 'bea', jornadaIdx: 0, pts: 40 },
    { username: 'ana', jornadaIdx: 1, pts: 30 },
  ]);
}

test_buildCompletedLeagueData_solo_jornadas_completas();
test_calcStreaks_up_down_y_empate();
test_calcStreaks_corte_al_cambiar_direccion();
test_calcBestJornadas_top_n();
console.log('OK estadisticas-subtabs T2');

function test_computeMatchConsensus_barras_y_marcadores() {
  const allPredictions = {
    ana: { 7: { home: 2, away: 1 } },
    bea: { 7: { home: 2, away: 1 } },
    cal: { 7: { home: 1, away: 1 } },
    dan: { 7: { home: 1, away: 0 } },
    eve: { 7: { home: 2, away: 1 } },
    fin: { 8: { home: 1, away: 0 } },
    gil: {},
  };
  const c = computeMatchConsensus(7, allPredictions);
  assert.strictEqual(c.total, 5);
  assert.deepStrictEqual(c.counts, { H: 4, D: 1, A: 0 });
  assert.strictEqual(c.majorityResult, 'H');
  assert.strictEqual(c.topScores[0].score, '2-1');
  assert.strictEqual(c.topScores[0].votes, 3);
  assert.strictEqual(c.topScores[0].pct, 60);
  assert.strictEqual(c.topScores.length, 3);
}

function test_computeMatchConsensus_vacio() {
  const c = computeMatchConsensus(99, {});
  assert.strictEqual(c.total, 0);
  assert.strictEqual(c.majorityResult, null);
  assert.deepStrictEqual(c.topScores, []);
}

function test_tallyChampions() {
  const t = tallyChampions({
    ana: { champion: 100 },
    bea: { champion: 100 },
    cal: { champion: 200 },
    dan: { champion: null },
    eve: null,
  });
  assert.strictEqual(t.total, 3);
  assert.deepStrictEqual(t.teams, [{ teamId: 100, votes: 2 }, { teamId: 200, votes: 1 }]);
}

function test_finalPredictionTeamIds_24_slots() {
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4],
    quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24],
  };
  assert.strictEqual(finalPredictionTeamIds(fp).length, 24);
  assert.strictEqual(finalPredictionTeamIds(null).length, 0);
}

function test_compareQuadroWithCommunity() {
  const mk = (base) => ({ champion: base, runnerUp: base + 1,
    semiFinalists: [base + 2, base + 3],
    quarterFinalists: [base + 4, base + 5, base + 6, base + 7],
    roundOf16: Array.from({ length: 8 }, (_, i) => base + 8 + i),
    roundOf32: Array.from({ length: 8 }, (_, i) => base + 16 + i) });
  const cache = { yo: mk(100), igual: mk(100), medio: mk(112), muydistinto: mk(124) };
  const r = compareQuadroWithCommunity('yo', cache);
  assert.strictEqual(r.users, 3);
  assert.strictEqual(r.avgCommon, 12);
  assert.strictEqual(r.avgPct, 50);
  assert.strictEqual(r.veryDiffCount, 2);
}

test_computeMatchConsensus_barras_y_marcadores();
test_computeMatchConsensus_vacio();
test_tallyChampions();
test_finalPredictionTeamIds_24_slots();
test_compareQuadroWithCommunity();
console.log('OK estadisticas-subtabs T3');
