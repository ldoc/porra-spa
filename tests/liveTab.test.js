// /home/ldoc/Proyectos/porra-spa/tests/liveTab.test.js
const assert = require('assert');
const { isLiveAllowed, stalenessLabel, livePointsForUser, squadPlayersInLive, buildLiveCardHtml } = require('../js/liveTab.js');

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
function test_badge_live_sin_minuto() {
  const base = { eventId: 1, estado: 'live', minuto: 0, homeGoles: 0, awayGoles: 0, homeTeamId: 42, awayTeamId: 7, scrapedAt: new Date().toISOString() };
  const sinMinuto = buildLiveCardHtml({ live: base, myPred: null, livePoints: 0, teamNames: {} });
  assert.match(sinMinuto, /live-dot/);
  assert.match(sinMinuto, /LIVE<\/span>/);
  assert.doesNotMatch(sinMinuto, /LIVE \d/);
  assert.match(buildLiveCardHtml({ live: { ...base, minuto: 23 }, myPred: null, livePoints: 0, teamNames: {} }), /LIVE 23/);
}
test_allowed_solo_fases_activas();
test_staleness();
test_puntos_live_15();
test_plantilla_implicada();
test_badge_live_sin_minuto();
console.log('liveTab OK');
