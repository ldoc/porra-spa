const assert = require('assert');
const { unwrapAllPredictions } = require('../js/apiData.js');

function test_unwrap_completo() {
  const data = {
    predictions: {
      juan: {
        predictions: { '1': { home: 2, away: 1 } },
        finalPredictions: { champion: 42 },
        squad: [{ id: 1, nombre: 'A' }]
      },
      maria: {
        predictions: { '2': { home: 0, away: 0 } },
        finalPredictions: null,
        squad: null
      },
      pedro: {
        predictions: {},
        finalPredictions: null,
        squad: [{ id: 2, nombre: 'B' }]
      }
    }
  };
  const r = unwrapAllPredictions(data);
  assert.deepStrictEqual(r.allPredictions, {
    juan: { '1': { home: 2, away: 1 } },
    maria: { '2': { home: 0, away: 0 } },
    pedro: {}
  });
  assert.deepStrictEqual(r.finalPredictionsCache, {
    juan: { champion: 42 },
    maria: null,
    pedro: null
  });
  assert.deepStrictEqual(r.squadsCache, {
    juan: [{ id: 1, nombre: 'A' }],
    pedro: [{ id: 2, nombre: 'B' }]
  });
}

function test_unwrap_vacio() {
  const r = unwrapAllPredictions({ predictions: {} });
  assert.deepStrictEqual(r, { allPredictions: {}, finalPredictionsCache: {}, squadsCache: {} });
}

function test_unwrap_sin_data() {
  assert.deepStrictEqual(unwrapAllPredictions(undefined), { allPredictions: {}, finalPredictionsCache: {}, squadsCache: {} });
}

const tests = [test_unwrap_completo, test_unwrap_vacio, test_unwrap_sin_data];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
