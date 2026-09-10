const assert = require('assert');
const { detectLiveEvents, buildEventToastHtml } = require('../js/liveTab.js');

const PREV = [{ eventId: 1, estado: 'live', minuto: 60, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 2, awayGoles: 1, incidents: [], stats: { jugadores: [{ id: '9', goles: 1, penaltiMarcado: 0, penaltiParado: 0 }] } }];
const NEXT = [{ eventId: 1, estado: 'live', minuto: 67, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1, incidents: [], stats: { jugadores: [{ id: '9', nombre: 'Kane', goles: 2, penaltiMarcado: 0, penaltiParado: 0 }] } }];

function test_detecta_gol_con_goleador() {
  const evs = detectLiveEvents(PREV, NEXT);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].tipo, 'gol');
  assert.equal(evs[0].playerName, 'Kane');
}
test_detecta_gol_con_goleador();

function test_sin_previo_no_hay_eventos() {
  assert.deepEqual(detectLiveEvents([], NEXT), []);
}
test_sin_previo_no_hay_eventos();

function test_toast_muestra_impacto() {
  const html = buildEventToastHtml({ tipo: 'gol', eventId: 1, playerName: 'Kane', teamName: 'Stuttgart', minuto: 67, homeGoles: 3, awayGoles: 1, homeShort: 'STU', awayShort: 'VIK' }, { myPtsBefore: 3, myPtsAfter: 8, tempBefore: 40, tempAfter: 45, isMine: true });
  assert.match(html, /\+3 → <strong>\+8<\/strong>/);
  assert.match(html, /es tuyo/);
}
test_toast_muestra_impacto();

// --- fix wave findings 1, 3, 6, 7a, 7b ---

function test_cambio_no_se_pinta_como_tarjeta() {
  const base = { eventId: 1, estado: 'live', minuto: 60, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, incidents: [], stats: { jugadores: [] } };
  const inc = { key: 'sub-70-9', tipo: 'sub', minuto: 70, teamId: 1, playerId: 9, playerName: 'Entra', playerOut: 'Sale' };
  const evs = detectLiveEvents([base], [{ ...base, minuto: 71, incidents: [inc] }]);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].tipo, 'cambio');
  assert.equal(evs[0].playerName, 'Entra');
  const html = buildEventToastHtml(evs[0], {});
  assert.match(html, /entra Entra/);
  assert.match(html, /sale Sale/);
  assert.doesNotMatch(html, /Amarilla|Roja/);
}
test_cambio_no_se_pinta_como_tarjeta();

function test_tarjeta_respeta_color_y_defecto_amarilla() {
  const base = { eventId: 1, estado: 'live', minuto: 60, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, incidents: [], stats: { jugadores: [] } };
  const roja = { key: 'card-80-6-red', tipo: 'card', minuto: 80, teamId: 2, playerId: 6, playerName: 'Duro', color: 'roja' };
  const evs = detectLiveEvents([base], [{ ...base, minuto: 81, incidents: [roja] }]);
  assert.equal(evs[0].tipo, 'tarjeta');
  assert.match(buildEventToastHtml(evs[0], {}), /Roja/);
  const sinColor = { key: 'card-30-5-yellow', tipo: 'card', minuto: 30, teamId: 1, playerId: 5, playerName: 'Leve' };
  const evs2 = detectLiveEvents([base], [{ ...base, minuto: 31, incidents: [sinColor] }]);
  assert.match(buildEventToastHtml(evs2[0], {}), /Amarilla/);
}
test_tarjeta_respeta_color_y_defecto_amarilla();

function test_penalti_marcado_y_paradon() {
  const mk = (g, pm, ps) => ({ eventId: 1, estado: 'live', minuto: 60, homeTeamId: 2677, awayTeamId: 1164, homeGoles: g, awayGoles: 0, incidents: [], stats: { jugadores: [{ id: '9', nombre: 'Kane', equipo: 2677, goles: g, penaltiMarcado: pm, penaltiParado: ps }] } });
  const pen = detectLiveEvents([mk(0, 0, 0)], [mk(1, 1, 0)]);
  assert.equal(pen.length, 1);
  assert.equal(pen[0].tipo, 'penalti');
  assert.equal(pen[0].playerName, 'Kane');
  const prevK = { eventId: 2, estado: 'live', minuto: 60, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, incidents: [], stats: { jugadores: [{ id: '1', nombre: 'Portero', equipo: 1, goles: 0, penaltiMarcado: 0, penaltiParado: 0 }] } };
  const nextK = { ...prevK, minuto: 61, stats: { jugadores: [{ id: '1', nombre: 'Portero', equipo: 1, goles: 0, penaltiMarcado: 0, penaltiParado: 1 }] } };
  const par = detectLiveEvents([prevK], [nextK]);
  assert.equal(par.length, 1);
  assert.equal(par[0].tipo, 'paradon');
}
test_penalti_marcado_y_paradon();

function test_transiciones_descanso_reanudacion_final() {
  const mk = (estado, minuto) => ({ eventId: 1, estado, minuto, homeTeamId: 1, awayTeamId: 2, homeGoles: 1, awayGoles: 0, incidents: [], stats: { jugadores: [] } });
  assert.equal(detectLiveEvents([mk('live', 44)], [mk('descanso', 45)])[0].tipo, 'descanso');
  assert.equal(detectLiveEvents([mk('descanso', 45)], [mk('live', 46)])[0].tipo, 'reanudacion');
  assert.equal(detectLiveEvents([mk('live', 89)], [mk('finalizado', 90)])[0].tipo, 'final');
  assert.equal(detectLiveEvents([mk('descanso', 45)], [mk('finalizado', 90)])[0].tipo, 'final');
}
test_transiciones_descanso_reanudacion_final();

function test_gol_sin_goleador_atribuido_toast_generico() {
  const j = [{ id: '9', nombre: 'Kane', equipo: 2677, goles: 1, penaltiMarcado: 0, penaltiParado: 0 }];
  const prev = [{ eventId: 1, estado: 'live', minuto: 60, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 0, awayGoles: 0, incidents: [], stats: { jugadores: j } }];
  const next = [{ eventId: 1, estado: 'live', minuto: 61, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 1, awayGoles: 0, incidents: [], stats: { jugadores: j } }];
  const evs = detectLiveEvents(prev, next);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].tipo, 'gol');
  assert.equal(evs[0].playerName, null);
  const html = buildEventToastHtml(evs[0], { teamNames: { 2677: 'VfB Stuttgart', 1164: 'Viking FK' } });
  assert.match(html, /Gol/);
  assert.doesNotMatch(html, /\(\)/);
}
test_gol_sin_goleador_atribuido_toast_generico();

function test_toast_gol_resuelve_equipo_desde_teamNames() {
  const html = buildEventToastHtml({ tipo: 'gol', eventId: 1, playerName: 'Kane', teamId: 2677, minuto: 67, homeGoles: 1, awayGoles: 0, homeTeamId: 2677, awayTeamId: 1164 }, { teamNames: { 2677: 'VfB Stuttgart', 1164: 'Viking FK' } });
  assert.match(html, /Stuttgart/);
  assert.doesNotMatch(html, /\(\)/);
}
test_toast_gol_resuelve_equipo_desde_teamNames();

function test_tipo_desconocido_toast_neutro() {
  const html = buildEventToastHtml({ tipo: 'raro', eventId: 1, minuto: 10 }, {});
  assert.match(html, /toast/);
  assert.doesNotMatch(html, /Amarilla|Roja/);
}
test_tipo_desconocido_toast_neutro();
