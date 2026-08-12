const assert = require('assert');

function getRelevantJourney(matchesByJourney, hasResult) {
  const journeys = Object.keys(matchesByJourney);
  if (journeys.length === 0) return null;
  for (let i = journeys.length - 1; i >= 0; i--) {
    if (matchesByJourney[journeys[i]].some(m => hasResult(m.match))) {
      return journeys[i];
    }
  }
  return journeys[journeys.length - 1];
}

function test_ultima_jornada_con_resultados() {
  const mbj = {
    'Jornada 1': [{ match: { id: 1, journey: 'Jornada 1' } }],
    'Jornada 2': [{ match: { id: 2, journey: 'Jornada 2' } }],
    'Jornada 3': [{ match: { id: 3, journey: 'Jornada 3' } }],
  };
  const hasResult = (m) => m.id === 2 || m.id === 3;
  assert.strictEqual(getRelevantJourney(mbj, hasResult), 'Jornada 3');
}

function test_ninguna_con_resultados_ultima_presente() {
  const mbj = {
    'Jornada 1': [{ match: { id: 1, journey: 'Jornada 1' } }],
    'Jornada 2': [{ match: { id: 2, journey: 'Jornada 2' } }],
  };
  const hasResult = () => false;
  assert.strictEqual(getRelevantJourney(mbj, hasResult), 'Jornada 2');
}

function test_sin_jornadas_null() {
  assert.strictEqual(getRelevantJourney({}, () => true), null);
}

const tests = [test_ultima_jornada_con_resultados, test_ninguna_con_resultados_ultima_presente, test_sin_jornadas_null];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
