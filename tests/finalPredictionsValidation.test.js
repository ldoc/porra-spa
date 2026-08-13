const assert = require('assert');
const { getFinalPredictionsViolations } = require('../js/eliminatorias.js');

// teamId == posición para simplificar los tests (mapa 1..24)
function posMap() {
  const map = new Map();
  for (let i = 1; i <= 24; i++) map.set(i, i);
  return map;
}

const fp = (over) => Object.assign(
  { champion: null, runnerUp: null, semiFinalists: [], quarterFinalists: [], roundOf16: [], roundOf32: [] },
  over
);

function test_valido_grupo_a_repartido_2_y_2() {
  // 9, 23 en dieciseisavos; 10 (campeón) y 24 (subcampeón) fuera → grupo A = 2/2
  assert.deepStrictEqual(
    getFinalPredictionsViolations(fp({ champion: 10, runnerUp: 24, roundOf32: [9, 23] }), posMap()),
    []
  );
}

function test_invalido_ejemplo_reportado_3_del_grupo_a_fuera() {
  // 23 en cuartos, 24 en semis, 10 en octavos → 3 del grupo A fuera de dieciseisavos
  const v = getFinalPredictionsViolations(
    fp({ semiFinalists: [24], quarterFinalists: [23], roundOf16: [10], roundOf32: [9] }),
    posMap()
  );
  assert.strictEqual(v.length, 1);
  assert.ok(v[0].includes('fuera de dieciseisavos'));
}

function test_invalido_3_del_mismo_grupo_en_dieciseisavos() {
  const v = getFinalPredictionsViolations(fp({ roundOf32: [9, 10, 23] }), posMap());
  assert.strictEqual(v.length, 1);
  assert.ok(v[0].includes('dieciseisavos'));
}

function test_valido_parcial_2_fuera_y_1_sin_colocar() {
  assert.deepStrictEqual(
    getFinalPredictionsViolations(fp({ quarterFinalists: [23], roundOf16: [10], roundOf32: [9] }), posMap()),
    []
  );
}

function test_limite_2_en_resto_ok_y_3_error() {
  const ok = fp({ quarterFinalists: [], roundOf16: [10, 23], roundOf32: [9, 24] });
  assert.deepStrictEqual(getFinalPredictionsViolations(ok, posMap()), []);

  const bad = fp({ quarterFinalists: [23], roundOf16: [10, 24], roundOf32: [9] });
  assert.strictEqual(getFinalPredictionsViolations(bad, posMap()).length, 1);
}

function test_grupos_b_c_d_respetan_sus_limites() {
  // Todos los grupos al límite 2/2: 2 en dieciseisavos + 2 fuera; top-8 (1-8) en octavos
  const ok = fp({
    champion: 23, runnerUp: 24,
    semiFinalists: [21, 22], quarterFinalists: [19, 20],
    roundOf16: [17, 18, 1, 2, 3, 4, 5, 6],
    roundOf32: [9, 10, 11, 12, 13, 14, 15, 16]
  });
  assert.deepStrictEqual(getFinalPredictionsViolations(ok, posMap()), []);
}

function test_arrays_con_placeholders_falsy_no_cuentan() {
  // nulls en arrays no cuentan como equipos colocados
  const v = getFinalPredictionsViolations(
    fp({ roundOf16: [null, 10], roundOf32: [9, null, 23] }),
    posMap()
  );
  assert.deepStrictEqual(v, []);
}

const tests = [
  test_valido_grupo_a_repartido_2_y_2,
  test_invalido_ejemplo_reportado_3_del_grupo_a_fuera,
  test_invalido_3_del_mismo_grupo_en_dieciseisavos,
  test_valido_parcial_2_fuera_y_1_sin_colocar,
  test_limite_2_en_resto_ok_y_3_error,
  test_grupos_b_c_d_respetan_sus_limites,
  test_arrays_con_placeholders_falsy_no_cuentan
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
