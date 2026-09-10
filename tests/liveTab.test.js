// /home/ldoc/Proyectos/porra-spa/tests/liveTab.test.js
const assert = require('assert');
const { isLiveAllowed, stalenessLabel, livePointsForUser, squadPlayersInLive, ownersOfPlayer, playerImgUrl } = require('../js/liveTab.js');

function test_allowed_solo_fases_activas() {
  assert.strictEqual(isLiveAllowed('FASE_LIGA'), true);
  assert.strictEqual(isLiveAllowed('FASE_PRETEMPORADA'), false);
  assert.strictEqual(isLiveAllowed('FASE_POSTFINAL'), false);
}
function test_staleness() {
  const now = new Date('2026-09-09T20:04:00Z').getTime();
  assert.match(stalenessLabel('2026-09-09T20:02:00Z', now), /hace 2 min/);
}
function test_puntos_live_15() {
  const live = { homeGoles: 2, awayGoles: 1 };
  assert.strictEqual(livePointsForUser(live, { home: 2, away: 1 }), 15);
  assert.strictEqual(livePointsForUser(live, { home: 0, away: 0 }), 0);
}
function test_plantilla_implicada() {
  const live = { homeTeamId: 42, awayTeamId: 7, stats: { jugadores: [{ id: '1', equipo: 42 }, { id: '2', equipo: 99 }] } };
  const squad = [{ id: 1 }, { id: 2 }];
  assert.deepStrictEqual(squadPlayersInLive(live, squad).map(p => p.id), ['1']);
}
function test_owners_mapea_plantillas() {
  const squads = { ana: [{ id: 1 }], pepe: [{ id: 2 }, { id: 1 }] };
  assert.deepStrictEqual(ownersOfPlayer('1', squads), ['ana', 'pepe']);
  assert.deepStrictEqual(ownersOfPlayer('9', squads), []);
}
function test_playerImgUrl_defecto_webp() {
  assert.strictEqual(playerImgUrl('9', {}), 'data/imgJugadores/9.webp');
  assert.strictEqual(playerImgUrl('9', { 9: 'png' }), 'data/imgJugadores/9.png');
}
test_allowed_solo_fases_activas();
test_staleness();
test_puntos_live_15();
test_plantilla_implicada();
test_owners_mapea_plantillas();
test_playerImgUrl_defecto_webp();
console.log('liveTab OK');
const { buildLiveStripHtml } = require('../js/liveTab.js');
function test_strip_tres_por_fila_puntos_junto_minuto() {
  const lives = [
    { eventId: 1, estado: 'live', minuto: 67, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1 },
    { eventId: 2, estado: 'finalizado', minuto: 90, homeTeamId: 1, awayTeamId: 2, homeGoles: 1, awayGoles: 1 }
  ];
  const names = { 2677: 'VfB Stuttgart', 1164: 'Viking FK', 1: 'Betis', 2: 'Celta' };
  const html = buildLiveStripHtml(lives, { 1: { home: 3, away: 1 }, 2: { home: 0, away: 0 } }, names);
  assert.match(html, /VFB/);
  assert.match(html, /67'/);
  assert.match(html, /\+15/);
  assert.match(html, /Fin/);
}
test_strip_tres_por_fila_puntos_junto_minuto();
