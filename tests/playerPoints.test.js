const assert = require('assert');
const { ratingToPoints } = require('../js/playerPoints.js');

function test_rating_cero_o_sin_puntos() {
  assert.strictEqual(ratingToPoints(0), 0);
  assert.strictEqual(ratingToPoints(null), 0);
  assert.strictEqual(ratingToPoints(undefined), 0);
}

function test_rating_base_sin_puntos() {
  assert.strictEqual(ratingToPoints(6), 0, '6.0 son 0 puntos');
}

function test_rating_positivo_multiplos_exactos() {
  // Regresión: estas divisiones daban 1 punto de menos por coma flotante
  assert.strictEqual(ratingToPoints(6.3), 1);
  assert.strictEqual(ratingToPoints(6.6), 2);
  assert.strictEqual(ratingToPoints(6.9), 3);
  assert.strictEqual(ratingToPoints(8.1), 7);
  assert.strictEqual(ratingToPoints(8.7), 9);
}

function test_rating_positivo_trunca_decimales() {
  assert.strictEqual(ratingToPoints(6.4), 1, '6.4 = 1 tramo completo');
  assert.strictEqual(ratingToPoints(6.5), 1);
  assert.strictEqual(ratingToPoints(6.8), 2);
  assert.strictEqual(ratingToPoints(7.0), 3);
}

function test_rating_positivo_tope_13() {
  assert.strictEqual(ratingToPoints(10), 13);
  assert.strictEqual(ratingToPoints(9.9), 13);
}

function test_rating_negativo_hasta_5_7() {
  assert.strictEqual(ratingToPoints(5.7), -1);
  assert.strictEqual(ratingToPoints(5.8), -1);
  assert.strictEqual(ratingToPoints(5.6), -1);
}

function test_rating_negativo_multiplos_exactos() {
  assert.strictEqual(ratingToPoints(5.4), -2);
  assert.strictEqual(ratingToPoints(5.1), -3, '5.1 = -1 - 2 tramos, no -4');
  assert.strictEqual(ratingToPoints(4.8), -4);
}

function test_rating_negativo_tope_13() {
  assert.strictEqual(ratingToPoints(1.8), -13);
  assert.strictEqual(ratingToPoints(1.0), -13);
}

const tests = [
  test_rating_cero_o_sin_puntos,
  test_rating_base_sin_puntos,
  test_rating_positivo_multiplos_exactos,
  test_rating_positivo_trunca_decimales,
  test_rating_positivo_tope_13,
  test_rating_negativo_hasta_5_7,
  test_rating_negativo_multiplos_exactos,
  test_rating_negativo_tope_13
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
