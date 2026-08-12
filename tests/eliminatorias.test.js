const assert = require('assert');
const { groupTies, resolveTie, computeEliminatorias } = require('../js/eliminatorias.js');

// ---- Helpers de test ----
function partido(id, fase, home, away) {
  return { id, fase, homeTeamId: home, awayTeamId: away };
}

function ms(eventId, goles) {
  const stats = {};
  for (const [teamId, g] of Object.entries(goles)) stats[teamId] = { goles: g };
  return { eventId, stats };
}

// ---- Tests de groupTies ----
function test_groupTies_agrupa_ida_vuelta() {
  const cruces = groupTies([
    partido(1, '16', 100, 200),
    partido(2, '16', 200, 100),
    partido(3, '16', 300, 400),
    partido(4, '16', 400, 300),
  ]);
  assert.strictEqual(cruces.length, 2);
  assert.deepStrictEqual(cruces.map(c => [c.teamA, c.teamB, c.matches.length]), [[100, 200, 2], [300, 400, 2]]);
}

// ---- Tests de resolveTie ----
function test_resolveTie_agregado_decide_eliminado() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 2, 200: 1 })],   // ida: 100 gana 2-1
    [2, ms(2, { 200: 1, 100: 1 })]    // vuelta: empate 1-1
  ]);
  // Agregado: 100 → 3, 200 → 2
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, true);
  assert.strictEqual(r.eliminado, 200);
}

function test_resolveTie_agregado_empate_pendiente() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 1, 200: 0 })],
    [2, ms(2, { 200: 1, 100: 0 })]
  ]);
  // Agregado: 1-1 → pendiente (penaltis no implementados)
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, false);
  assert.strictEqual(r.eliminado, null);
}

function test_resolveTie_sin_resultado_no_resuelto() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([[1, ms(1, { 100: 1, 200: 0 })]]); // falta la vuelta
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, false);
}

function test_resolveTie_cruce_con_menos_de_dos_partidos_no_resuelto() {
  const tie = { teamA: 100, teamB: 200, matches: [partido(1, '16', 100, 200)] };
  const r = resolveTie(tie, new Map([[1, ms(1, { 100: 1, 200: 0 })]]));
  assert.strictEqual(r.resuelto, false);
  assert.strictEqual(r.eliminado, null);
}

// ---- Tests de computeEliminatorias ----
// Nota: mini-cuadro ilustrativo. La función procesa cada fase de forma
// independiente; no valida coherencia entre rondas.
function test_computeEliminatorias_rondas_completas_y_parciales() {
  const matches = [
    // Dieciseisavos completos (2 cruces resueltos → 2 eliminados)
    partido(1, '16', 100, 200), partido(2, '16', 200, 100),
    partido(3, '16', 300, 400), partido(4, '16', 400, 300),
    // Octavos: un cruce resuelto y otro sin resultado (partido 8 pendiente)
    partido(5, '8', 500, 600), partido(6, '8', 600, 500),
    partido(7, '8', 700, 800), partido(8, '8', 800, 700),
  ];
  const matchStats = [
    ms(1, { 100: 2, 200: 0 }), ms(2, { 200: 1, 100: 2 }),   // 200 eliminado
    ms(3, { 300: 1, 400: 1 }), ms(4, { 400: 0, 300: 2 }),   // 400 eliminado
    ms(5, { 500: 2, 600: 1 }), ms(6, { 600: 1, 500: 2 }),   // 600 eliminado
    ms(7, { 700: 1, 800: 0 }), // falta ms(8) → octavos incompletos
  ];
  const r = computeEliminatorias(matches, matchStats);
  assert.deepStrictEqual(r.rondasResueltas, ['16']);
  assert.deepStrictEqual(r.zonas['16'].sort((a, b) => a - b), [200, 400]);
  assert.strictEqual(r.zonas['8'], undefined);
  assert.deepStrictEqual(r.final, { campeon: null, subcampeon: null });
}

function test_computeEliminatorias_final_resuelta() {
  const matches = [
    partido(1, '16', 100, 200), partido(2, '16', 200, 100),
    partido(3, '16', 300, 400), partido(4, '16', 400, 300),
    partido(5, '8', 100, 300), partido(6, '8', 300, 100),
    partido(7, '8', 500, 600), partido(8, '8', 600, 500),
    partido(9, '4', 100, 500), partido(10, '4', 500, 100),
    partido(11, 'semis', 100, 200), partido(12, 'semis', 200, 100),
    partido(13, 'final', 100, 200),
  ];
  const matchStats = [
    // 16avos: eliminan 200 y 400
    ms(1, { 100: 2, 200: 0 }), ms(2, { 200: 1, 100: 2 }),
    ms(3, { 300: 2, 400: 1 }), ms(4, { 400: 0, 300: 1 }),
    // 8avos: eliminan 300 y 600
    ms(5, { 100: 1, 300: 1 }), ms(6, { 300: 1, 100: 2 }),
    ms(7, { 500: 2, 600: 1 }), ms(8, { 600: 1, 500: 2 }),
    // Cuartos: elimina 500
    ms(9, { 100: 2, 500: 1 }), ms(10, { 500: 1, 100: 1 }),
    // Semis: elimina 200
    ms(11, { 100: 2, 200: 1 }), ms(12, { 200: 1, 100: 1 }),
    // Final: 100 gana → campeón 100, subcampeón 200
    ms(13, { 100: 2, 200: 1 }),
  ];
  const r = computeEliminatorias(matches, matchStats);
  assert.deepStrictEqual(r.rondasResueltas, ['16', '8', '4', 'semis', 'final']);
  assert.strictEqual(r.final.campeon, 100);
  assert.strictEqual(r.final.subcampeon, 200);
  assert.deepStrictEqual(r.zonas['16'].sort((a, b) => a - b), [200, 400]);
  assert.deepStrictEqual(r.zonas['8'].sort((a, b) => a - b), [300, 600]);
  assert.deepStrictEqual(r.zonas['4'], [500]);
  assert.deepStrictEqual(r.zonas['semis'], [200]);
}

function test_computeEliminatorias_final_empatada_no_resuelta() {
  const matches = [partido(1, 'final', 100, 200)];
  const matchStats = [ms(1, { 100: 2, 200: 2 })]; // gA === gB
  const r = computeEliminatorias(matches, matchStats);
  assert.deepStrictEqual(r.final, { campeon: null, subcampeon: null });
  assert.strictEqual(r.rondasResueltas.includes('final'), false);
}

// ---- Runner (mismo patrón que el resto de tests) ----
const tests = [
  test_groupTies_agrupa_ida_vuelta,
  test_resolveTie_agregado_decide_eliminado,
  test_resolveTie_agregado_empate_pendiente,
  test_resolveTie_sin_resultado_no_resuelto,
  test_resolveTie_cruce_con_menos_de_dos_partidos_no_resuelto,
  test_computeEliminatorias_rondas_completas_y_parciales,
  test_computeEliminatorias_final_resuelta,
  test_computeEliminatorias_final_empatada_no_resuelta,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
