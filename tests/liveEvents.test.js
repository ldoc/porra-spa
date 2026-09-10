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
