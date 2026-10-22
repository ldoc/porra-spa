const assert = require('assert');
const { sortClasificacionJugadores } = require('../js/clasificacion.js');

function row(name, o) {
  return Object.assign({
    name,
    predictionPoints: 0, squadPoints: 0, classificationPoints: 0,
    eliminatoriasPoints: 0, realPoints: 0
  }, o);
}

const base = [
  row('a', { predictionPoints: 15, squadPoints: 10, realPoints: 25 }),
  row('b', { predictionPoints: 15, squadPoints: 40, realPoints: 55 }),
  row('c', { predictionPoints: 0,  squadPoints: 60, realPoints: 60 })
];

function names(rows) { return rows.map(r => r.name); }

function test_total_default_igual_actual() {
  assert.deepStrictEqual(names(sortClasificacionJugadores(base)), ['c', 'b', 'a'], 'por realPoints desc');
  assert.deepStrictEqual(names(sortClasificacionJugadores(base, 'total')), ['c', 'b', 'a'], 'sortBy total explicito');
  assert.deepStrictEqual(names(sortClasificacionJugadores(base, 'desconocido')), ['c', 'b', 'a'], 'sortBy desconocido -> total');
}

function test_pronosticos_desc_con_desempate_normas() {
  const sorted = sortClasificacionJugadores(base, 'pronosticos');
  assert.deepStrictEqual(names(sorted), ['b', 'a', 'c'], 'empate 15 -> normas (total 55 antes que 25), c sin pron va ultima');
}

function test_plantilla_desc() {
  assert.deepStrictEqual(names(sortClasificacionJugadores(base, 'plantilla')), ['c', 'b', 'a'], '60/40/10');
}

function test_clasificacion_y_eliminatorias() {
  const rows = [
    row('x', { classificationPoints: 0, eliminatoriasPoints: 30, realPoints: 30 }),
    row('y', { classificationPoints: 60, eliminatoriasPoints: 0, realPoints: 60 })
  ];
  assert.deepStrictEqual(names(sortClasificacionJugadores(rows, 'clasificacion')), ['y', 'x'], '60 antes que 0');
  assert.deepStrictEqual(names(sortClasificacionJugadores(rows, 'eliminatorias')), ['x', 'y'], '30 antes que 0');
  assert.deepStrictEqual(names(sortClasificacionJugadores(rows, 'total')), ['y', 'x'], 'total: 60 antes que 30');
}

function test_mutacion_de_entrada() {
  const copia = base.map(r => ({ ...r }));
  sortClasificacionJugadores(copia, 'plantilla');
  assert.deepStrictEqual(names(sortClasificacionJugadores(base)), ['c', 'b', 'a'], 'el array base no se muta');
}

const tests = [
  test_total_default_igual_actual,
  test_pronosticos_desc_con_desempate_normas,
  test_plantilla_desc,
  test_clasificacion_y_eliminatorias,
  test_mutacion_de_entrada
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
