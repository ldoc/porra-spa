const assert = require('assert');
const { sortRoundMatches } = require('../js/resultadosRound.js');

function test_sort_disputados_antiguo_a_reciente_luego_pendientes() {
  const items = [
    { match: { id: 1, fechaTs: 100 }, hasResult: true },
    { match: { id: 2, fechaTs: 300 }, hasResult: true },
    { match: { id: 3, fechaTs: 200 }, hasResult: true },
    { match: { id: 4, fechaTs: 50 }, hasResult: false },
    { match: { id: 5, fechaTs: 400 }, hasResult: false },
  ];
  const sorted = sortRoundMatches(items);
  assert.deepStrictEqual(sorted.map(m => m.match.id), [1, 3, 2, 4, 5]);
}

function test_sort_no_muta_el_array_original() {
  const items = [
    { match: { id: 1, fechaTs: 100 }, hasResult: true },
    { match: { id: 2, fechaTs: 50 }, hasResult: false },
  ];
  sortRoundMatches(items);
  assert.strictEqual(items[0].match.id, 1);
}

const tests = [test_sort_disputados_antiguo_a_reciente_luego_pendientes, test_sort_no_muta_el_array_original];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);