const assert = require('assert');
const { buildMatchConsensus, expectedPointsForPrediction } = require('../js/stats.js');

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

test_expectedPointsForPrediction_desglose_completo();
test_buildMatchConsensus_excluye_usuario_y_desempata();
console.log('OK estadisticasEstilo T1');
