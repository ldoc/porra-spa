const assert = require('assert');
const { sortRoundMatches, getCurrentRoundKey } = require('../js/resultadosRound.js');

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

const roundList = [
  { key: 'liga:1', fase: 'liga', ronda: 1 },
  { key: 'liga:2', fase: 'liga', ronda: 2 },
  { key: 'liga:3', fase: 'liga', ronda: 3 },
];
const matches = [
  { id: 1, fase: 'liga', ronda: 1, fechaTs: Math.floor(new Date(2026, 8, 8).getTime() / 1000) },
  { id: 2, fase: 'liga', ronda: 1, fechaTs: Math.floor(new Date(2026, 8, 10).getTime() / 1000) },
  { id: 3, fase: 'liga', ronda: 2, fechaTs: Math.floor(new Date(2026, 9, 13).getTime() / 1000) },
  { id: 4, fase: 'liga', ronda: 3, fechaTs: Math.floor(new Date(2026, 9, 20).getTime() / 1000) },
];

function test_jornada_en_curso_por_fecha() {
  const now = new Date(2026, 8, 9, 12, 0, 0).getTime();
  assert.strictEqual(getCurrentRoundKey(roundList, matches, [], now), 'liga:1');
}

function test_fallback_ultima_con_resultados() {
  const now = new Date(2026, 8, 15, 12, 0, 0).getTime();
  const matchStats = [
    { eventId: 1, stats: { 1: { goles: 1 }, 2: { goles: 0 } } },
    { eventId: 3, stats: { 1: { goles: 2 }, 2: { goles: 2 } } },
  ];
  assert.strictEqual(getCurrentRoundKey(roundList, matches, matchStats, now), 'liga:2');
}

function test_fallback_ultima_disponible() {
  const now = new Date(2026, 8, 15, 12, 0, 0).getTime();
  assert.strictEqual(getCurrentRoundKey(roundList, matches, [], now), 'liga:3');
}

function test_roundList_vacio_null() {
  assert.strictEqual(getCurrentRoundKey([], matches, [], Date.now()), null);
}

const tests = [
  test_sort_disputados_antiguo_a_reciente_luego_pendientes,
  test_sort_no_muta_el_array_original,
  test_jornada_en_curso_por_fecha,
  test_fallback_ultima_con_resultados,
  test_fallback_ultima_disponible,
  test_roundList_vacio_null,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
