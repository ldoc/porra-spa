const assert = require('assert');
const { compareClasificacionJugadores, sortClasificacionJugadores } = require('../js/clasificacion.js');

function row(overrides = {}) {
  return Object.assign({
    name: 'x',
    realPoints: 100,
    eliminatoriasPoints: 0, squadPoints: 0,
    classificationPoints: 0, predictionPoints: 0
  }, overrides);
}

function test_total_manda() {
  const a = row({ name: 'a', realPoints: 200 });
  const b = row({ name: 'b', realPoints: 100 });
  assert.ok(compareClasificacionJugadores(a, b) < 0, 'mayor total va antes');
  assert.ok(compareClasificacionJugadores(b, a) > 0, 'menor total va despues');
}

function test_desempate_eliminatorias() {
  const a = row({ name: 'a', realPoints: 100, eliminatoriasPoints: 50, squadPoints: 50 });
  const b = row({ name: 'b', realPoints: 100, eliminatoriasPoints: 10, squadPoints: 90 });
  assert.ok(compareClasificacionJugadores(a, b) < 0, 'gana mayor eliminatorias aunque tenga menos plantilla');
}

function test_desempate_plantilla() {
  const a = row({ name: 'a', eliminatoriasPoints: 10, squadPoints: 60, classificationPoints: 0 });
  const b = row({ name: 'b', eliminatoriasPoints: 10, squadPoints: 20, classificationPoints: 40 });
  assert.ok(compareClasificacionJugadores(a, b) < 0, 'gana mayor plantilla');
}

function test_desempate_clasificacion() {
  const a = row({ name: 'a', squadPoints: 20, classificationPoints: 30, predictionPoints: 0 });
  const b = row({ name: 'b', squadPoints: 20, classificationPoints: 10, predictionPoints: 50 });
  assert.ok(compareClasificacionJugadores(a, b) < 0, 'gana mayor clasificacion');
}

function test_desempate_pronosticos() {
  const a = row({ name: 'a', predictionPoints: 70 });
  const b = row({ name: 'b', predictionPoints: 20 });
  assert.ok(compareClasificacionJugadores(a, b) < 0, 'gana mayor pronosticos');
}

function test_empate_total_comparte_puesto() {
  const a = row({ name: 'a' });
  const b = row({ name: 'b' });
  assert.strictEqual(compareClasificacionJugadores(a, b), 0, 'todo igual -> 0');
}

function test_sort_ordena_segun_normas() {
  const rows = [
    row({ name: 'c', realPoints: 100, eliminatoriasPoints: 0, squadPoints: 100 }),
    row({ name: 'a', realPoints: 200 }),
    row({ name: 'b', realPoints: 100, eliminatoriasPoints: 50, squadPoints: 50 })
  ];
  const sorted = sortClasificacionJugadores(rows);
  assert.deepStrictEqual(sorted.map(r => r.name), ['a', 'b', 'c']);
  assert.deepStrictEqual(rows.map(r => r.name), ['c', 'a', 'b'], 'no muta el array original');
}

const tests = [
  test_total_manda,
  test_desempate_eliminatorias,
  test_desempate_plantilla,
  test_desempate_clasificacion,
  test_desempate_pronosticos,
  test_empate_total_comparte_puesto,
  test_sort_ordena_segun_normas
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
