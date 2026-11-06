const assert = require('assert');
const { buildMatchConsensus, expectedPointsForPrediction, calcStyleStats } = require('../js/stats.js');

function test_expectedPointsForPrediction_desglose_completo() {
  const consensus = {
    total: 5,
    counts: { H: 3, D: 1, A: 1 },
    pct: { H: 60, D: 20, A: 20 },
    scoreCounts: new Map([['2-1', 2], ['1-0', 1], ['0-0', 1], ['1-2', 1]]),
    homeGoalCounts: new Map([[2, 3], [1, 1], [0, 1]]),
    awayGoalCounts: new Map([[1, 2], [0, 2], [2, 1]]),
    plurality: 'H',
  };
  assert.strictEqual(expectedPointsForPrediction({ home: 2, away: 1 }, consensus), 8.2);
  assert.strictEqual(expectedPointsForPrediction(null, consensus), 0);
  assert.strictEqual(expectedPointsForPrediction({ home: 2, away: 1 }, { total: 0 }), 0);
}

function test_buildMatchConsensus_excluye_usuario_y_desempata() {
  const allPredictions = {
    ana: { 1: { home: 5, away: 5 }, 2: { home: 5, away: 5 } },
    bob: { 1: { home: 1, away: 0 }, 2: { home: 1, away: 0 } },
    carol: { 1: { home: 2, away: 1 }, 2: { home: 2, away: 1 } },
    dave: { 1: { home: 0, away: 0 }, 2: { home: 0, away: 0 } },
    erin: { 1: { home: 0, away: 2 }, 2: { home: 0, away: 0 } },
    frank: { 1: { home: 1, away: 0 }, 2: { home: 0, away: 2 } },
  };
  const map = buildMatchConsensus(allPredictions, ['ana', 'bob', 'carol', 'dave', 'erin', 'frank'], 'ana');
  const m1 = map.get('1');
  assert.strictEqual(m1.total, 5);
  assert.deepStrictEqual(m1.counts, { H: 3, D: 1, A: 1 });
  assert.strictEqual(m1.plurality, 'H');
  assert.strictEqual(m1.scoreCounts.get('1-0'), 2);
  assert.strictEqual(m1.homeGoalCounts.get(0), 2);
  assert.strictEqual(m1.awayGoalCounts.get(0), 3);

  // H=2, D=2, A=1 → empate H/D resuelto por orden H > D.
  const m2 = map.get('2');
  assert.deepStrictEqual(m2.counts, { H: 2, D: 2, A: 1 });
  assert.strictEqual(m2.plurality, 'H');
}

function buildStyleFixture() {
  const playerNames = ['ana', 'bob', 'carol', 'dave', 'erin', 'frank'];
  const matchesById = {
    10: { id: 10, fase: 'liga', ronda: 1, homeTeam: 'A', awayTeam: 'B' },
    11: { id: 11, fase: 'liga', ronda: 2, homeTeam: 'C', awayTeam: 'D' },
    12: { id: 12, fase: 'liga', ronda: 3, homeTeam: 'E', awayTeam: 'F' },
    14: { id: 14, fase: 'liga', ronda: 4, homeTeam: 'G', awayTeam: 'H' },
    15: { id: 15, fase: '16', ronda: 5, homeTeam: 'I', awayTeam: 'J' },
  };
  const playedMatches = [
    { matchId: 10, home: 0, away: 1, result: 'A' },
    { matchId: 11, home: 1, away: 1, result: 'D' },
    { matchId: 12, home: 2, away: 0, result: 'H' },
    { matchId: 14, home: 1, away: 0, result: 'H' },
    { matchId: 15, home: 1, away: 0, result: 'H' },
  ];
  const allPredictions = {
    ana: { 10: { home: 0, away: 1 }, 11: { home: 2, away: 1 }, 12: { home: 2, away: 0 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    bob: { 10: { home: 1, away: 0 }, 11: { home: 1, away: 0 }, 12: { home: 1, away: 0 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    carol: { 10: { home: 1, away: 0 }, 11: { home: 2, away: 1 }, 12: { home: 2, away: 1 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    dave: { 10: { home: 0, away: 0 }, 11: { home: 1, away: 1 }, 12: { home: 0, away: 0 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    erin: { 10: { home: 1, away: 0 }, 11: { home: 0, away: 0 }, 12: { home: 1, away: 1 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    frank: { 10: { home: 1, away: 0 }, 11: { home: 0, away: 2 }, 12: { home: 2, away: 0 }, 15: { home: 1, away: 0 } },
  };
  const points = {
    ana: { 10: 15, 11: 3, 12: 15 },
    bob: { 10: 0, 11: 3, 12: 3, 14: 8 },
    carol: { 10: 0, 11: 3, 12: 0, 14: 8 },
    dave: { 10: 3, 11: 15, 12: 8, 14: 8 },
    erin: { 10: 0, 11: 8, 12: 0, 14: 8 },
    frank: { 10: 0, 11: 0, 12: 15 },
  };
  const userPoints = {};
  for (const [name, map] of Object.entries(points)) {
    userPoints[name] = {
      totalPoints: Object.values(map).reduce((a, b) => a + b, 0),
      matchDetails: Object.entries(map).map(([id, pts]) => ({ match: matchesById[id], points: pts, breakdown: [] })),
    };
  }
  return { playerNames, matchesById, playedMatches, allPredictions, userPoints };
}

function test_calcStyleStats_suerte_robos_faroles_y_confianza() {
  const f = buildStyleFixture();
  const r = calcStyleStats('ana', f.playedMatches, f.allPredictions, f.userPoints, f.matchesById, f.playerNames);
  assert.strictEqual(r.analyzedMatches, 3);
  assert.strictEqual(r.excludedLowSample, 1);
  assert.strictEqual(r.actualPoints, 33);
  assert.strictEqual(r.expectedPoints, 13.8);
  assert.strictEqual(r.luckDelta, 19.2);
  assert.strictEqual(r.luckPerMatch, 6.4);
  assert.strictEqual(r.luckLabel, 'afortunado');
  assert.strictEqual(r.robos.count, 1);
  assert.strictEqual(r.robos.items[0].matchId, 10);
  assert.strictEqual(r.robos.items[0].supportPct, 0);
  assert.strictEqual(r.faroles.count, 1);
  assert.strictEqual(r.faroles.items[0].matchId, 11);
  assert.strictEqual(r.faroles.items[0].supportPct, 40);
  assert.deepStrictEqual(r.confidence.majority, { matches: 1, hits: 1, hitPct: 100, exacts: 1, exactPct: 100 });
  assert.deepStrictEqual(r.confidence.tight, { matches: 1, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 });
  assert.deepStrictEqual(r.confidence.minority, { matches: 1, hits: 1, hitPct: 100, exacts: 1, exactPct: 100 });
}

function test_calcStyleStats_sin_partidos_analizables() {
  const r = calcStyleStats('ana', [], {}, {}, {}, ['ana']);
  assert.strictEqual(r.analyzedMatches, 0);
  assert.strictEqual(r.excludedLowSample, 0);
  assert.strictEqual(r.luckLabel, null);
  assert.strictEqual(r.luckPerMatch, null);
  assert.strictEqual(r.robos.count, 0);
  assert.strictEqual(r.faroles.count, 0);
  assert.deepStrictEqual(r.confidence.majority, { matches: 0, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 });
}

test_expectedPointsForPrediction_desglose_completo();
test_buildMatchConsensus_excluye_usuario_y_desempata();
console.log('OK estadisticasEstilo T1');
test_calcStyleStats_suerte_robos_faroles_y_confianza();
test_calcStyleStats_sin_partidos_analizables();
console.log('OK estadisticasEstilo T2');
