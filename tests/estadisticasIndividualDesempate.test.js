const assert = require('assert');

global.clasificacionApi = require('../js/clasificacion.js');
const stats = require('../js/stats.js');
const { orderIndividualPlayers, individualOverallRank } = stats;

function players() {
  return [
    { name: 'c', avatar: '🦁' },
    { name: 'a', avatar: '⚽' },
    { name: 'b', avatar: '🏆' },
  ];
}

// splits con claves de stats.js: prediction/squad/classification/eliminatorias
function splits() {
  return {
    a: { prediction: 100, squad: 50, classification: 20, eliminatorias: 30 }, // total 200
    b: { prediction: 40, squad: 50, classification: 20, eliminatorias: 90 },  // total 200, gana por eliminatorias
    c: { prediction: 50, squad: 50, classification: 20, eliminatorias: 0 },   // total 120
  };
}

function test_expone_helpers() {
  assert.strictEqual(typeof orderIndividualPlayers, 'function', 'falta orderIndividualPlayers');
  assert.strictEqual(typeof individualOverallRank, 'function', 'falta individualOverallRank');
}

function test_selector_ordena_por_clasificacion_con_desempate() {
  const sorted = orderIndividualPlayers(players(), splits());
  assert.deepStrictEqual(sorted.map(p => p.name), ['b', 'a', 'c']);
}

function test_selector_no_muta() {
  const list = players();
  orderIndividualPlayers(list, splits());
  assert.deepStrictEqual(list.map(p => p.name), ['c', 'a', 'b']);
}

function test_puesto_rompe_empate_con_splits() {
  const totals = { a: 200, b: 200, c: 120 };
  assert.strictEqual(individualOverallRank(totals, 'b', splits()), 1, 'b gana por eliminatorias');
  assert.strictEqual(individualOverallRank(totals, 'a', splits()), 2, 'a segundo');
  assert.strictEqual(individualOverallRank(totals, 'c', splits()), 3, 'c tercero');
}

function test_puesto_sin_splits_mantiene_ranking_compartido() {
  const totals = { a: 200, b: 200, c: 120 };
  assert.strictEqual(individualOverallRank(totals, 'a'), 1, 'legado: empate comparte puesto');
  assert.strictEqual(individualOverallRank(totals, 'b'), 1, 'legado: empate comparte puesto');
  assert.strictEqual(individualOverallRank(totals, 'c'), 3, 'legado: tercero');
}

const tests = [
  test_expone_helpers,
  test_selector_ordena_por_clasificacion_con_desempate,
  test_selector_no_muta,
  test_puesto_rompe_empate_con_splits,
  test_puesto_sin_splits_mantiene_ranking_compartido
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
