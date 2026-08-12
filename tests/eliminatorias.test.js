const assert = require('assert');
const { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints } = require('../js/eliminatorias.js');

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

// ---- Tests de computeReachedPhases ----
function test_reachedPhases_eliminados_y_vivos() {
  const matches = [
    partido(1, '16', 100, 200), partido(2, '16', 200, 100),
    partido(3, '16', 300, 400), partido(4, '16', 400, 300),
    partido(5, '8', 100, 500), partido(6, '8', 500, 100),
    partido(7, '8', 600, 700), partido(8, '8', 700, 600),
    partido(9, '4', 100, 600), partido(10, '4', 600, 100),
    partido(11, 'semis', 100, 800), partido(12, 'semis', 800, 100),
    partido(13, 'final', 100, 900),
  ];
  const matchStats = [
    // 16avos: eliminan 200 y 400 (100 y 300 avanzan → octavos)
    ms(1, { 100: 2, 200: 0 }), ms(2, { 200: 1, 100: 2 }),
    ms(3, { 300: 2, 400: 1 }), ms(4, { 400: 0, 300: 1 }),
    // 8avos: eliminan 500 y 700 (100 y 600 avanzan → cuartos)
    ms(5, { 100: 1, 500: 1 }), ms(6, { 500: 1, 100: 2 }),
    ms(7, { 600: 2, 700: 1 }), ms(8, { 700: 1, 600: 2 }),
    // Cuartos: elimina 600 (100 avanza → semis)
    ms(9, { 100: 2, 600: 1 }), ms(10, { 600: 1, 100: 1 }),
    // Semis: elimina 800 (100 avanza → final)
    ms(11, { 100: 2, 800: 1 }), ms(12, { 800: 1, 100: 1 }),
    // Final: 100 gana → campeón
    ms(13, { 100: 2, 900: 1 }),
  ];
  const r = computeReachedPhases(matches, matchStats);
  assert.strictEqual(r[100], 6);   // campeón
  assert.strictEqual(r[900], 5);   // subcampeón
  assert.strictEqual(r[800], 4);   // eliminado en semis
  assert.strictEqual(r[600], 3);   // eliminado en cuartos
  assert.strictEqual(r[500], 2);   // eliminado en octavos
  assert.strictEqual(r[700], 2);   // eliminado en octavos
  assert.strictEqual(r[200], 1);   // eliminado en dieciseisavos
  assert.strictEqual(r[400], 1);   // eliminado en dieciseisavos
  assert.strictEqual(r[300], 2);   // avanzó de 16avos y su cruce de octavos no tiene matchStats → provisional octavos
}

function test_reachedPhases_sin_resultados_rango_0() {
  const matches = [partido(1, '16', 100, 200), partido(2, '16', 200, 100)];
  const r = computeReachedPhases(matches, []);
  assert.strictEqual(r[100], 1);   // vive en dieciseisavos (provisional fase mínima)
  assert.strictEqual(r[200], 1);
  assert.strictEqual(r[999], undefined); // equipo ajeno no aparece
}

function test_reachedPhases_final_pendiente_ambos_5() {
  const matches = [partido(1, 'final', 100, 200)];
  const r = computeReachedPhases(matches, []); // sin resultado
  assert.strictEqual(r[100], 5);
  assert.strictEqual(r[200], 5);
}

// ---- Tests de calculateEliminatoriasPoints ----
function test_points_acierto_exacto_por_ronda() {
  const reachedPhases = {
    1: 6, 2: 5, 3: 4, 4: 4, 5: 3, 6: 3, 7: 3, 8: 3,
    9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2,
    17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1
  };
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4], quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24]
  };
  const { totalPoints } = calculateEliminatoriasPoints(fp, reachedPhases);
  assert.strictEqual(totalPoints, 575); // máximo
}

function test_points_regla_del_minimo() {
  const reachedPhases = { 1: 6, 2: 1, 3: 4 };
  // 1: pronosticado octavos (2), alcanza campeón (6) → min(2,6)=2 → 15
  // 2: pronosticado semis (4), alcanza play-off (1) → min(4,1)=1 → 10
  // 3: pronosticado cuartos (3), alcanza semis (4) → min(3,4)=3 → 25
  const fp = {
    champion: null, runnerUp: null,
    semiFinalists: [2], quarterFinalists: [3], roundOf16: [1], roundOf32: []
  };
  const { totalPoints, teamDetails } = calculateEliminatoriasPoints(fp, reachedPhases);
  assert.strictEqual(totalPoints, 50);
  const t1 = teamDetails.find(t => t.teamId === 1);
  assert.deepStrictEqual({ predictedRank: t1.predictedRank, reachedRank: t1.reachedRank, points: t1.points }, { predictedRank: 2, reachedRank: 6, points: 15 });
  const t2 = teamDetails.find(t => t.teamId === 2);
  assert.deepStrictEqual({ predictedRank: t2.predictedRank, reachedRank: t2.reachedRank, points: t2.points }, { predictedRank: 4, reachedRank: 1, points: 10 });
  const t3 = teamDetails.find(t => t.teamId === 3);
  assert.deepStrictEqual({ predictedRank: t3.predictedRank, reachedRank: t3.reachedRank, points: t3.points }, { predictedRank: 3, reachedRank: 4, points: 25 });
}

function test_points_sin_prediccion_y_sin_datos() {
  assert.deepStrictEqual(calculateEliminatoriasPoints(null, {}), { totalPoints: 0, teamDetails: [] });
  const fp = { champion: 1, runnerUp: 2, semiFinalists: [3], quarterFinalists: [], roundOf16: [], roundOf32: [] };
  const { totalPoints, teamDetails } = calculateEliminatoriasPoints(fp, {}); // sin reachedPhases → rango 0
  assert.strictEqual(totalPoints, 0);
  assert.strictEqual(teamDetails.length, 3);
  assert.strictEqual(teamDetails.every(t => t.points === 0), true);
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
  test_reachedPhases_eliminados_y_vivos,
  test_reachedPhases_sin_resultados_rango_0,
  test_reachedPhases_final_pendiente_ambos_5,
  test_points_acierto_exacto_por_ronda,
  test_points_regla_del_minimo,
  test_points_sin_prediccion_y_sin_datos,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
