const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveLiveRefreshSecs, diffLiveMatches, computeLiveGaps, ringOffset, liveGoalsOf, buildLiveTabsHtml, buildRingHtml, buildZoneHtml } = require('../js/live.js');

test('liveGoalsOf extrae goles de stats Sofascore', () => {
  assert.deepEqual(liveGoalsOf({ 17: { goles: 2 }, 42: { goles: 1 }, jugadores: [] }), { 17: 2, 42: 1 });
  assert.deepEqual(liveGoalsOf(null), {});
});

test('diffLiveMatches detecta gol y cambio de estado', () => {
  const prev = [{ eventId: 1, status: 'LIVE', stats: { 17: { goles: 1 }, 42: { goles: 0 } } }];
  const next = [{ eventId: 1, status: 'LIVE', stats: { 17: { goles: 2 }, 42: { goles: 0 } } }, { eventId: 2, status: 'LIVE', stats: { 9: { goles: 0 }, 10: { goles: 0 } } }];
  const evs = diffLiveMatches(prev, next);
  assert.ok(evs.some(e => e.type === 'goal' && e.eventId === 1 && e.teamId === '17'));
  assert.ok(evs.some(e => e.type === 'start' && e.eventId === 2));
});

test('computeLiveGaps devuelve anterior, yo y siguiente', () => {
  const rows = [
    { name: 'maria', livePoints: 136 },
    { name: 'luisete', livePoints: 132 },
    { name: 'pedro', livePoints: 126 }
  ];
  const g = computeLiveGaps(rows, 'luisete');
  assert.equal(g.above.name, 'maria');
  assert.equal(g.me.name, 'luisete');
  assert.equal(g.below.name, 'pedro');
  assert.equal(g.pointsToAbove, 4);
  assert.equal(g.pointsOverBelow, 6);
});

test('computeLiveGaps en bordes (lider y colista)', () => {
  const rows = [{ name: 'a', livePoints: 10 }, { name: 'b', livePoints: 5 }];
  assert.equal(computeLiveGaps(rows, 'a').above, null);
  assert.equal(computeLiveGaps(rows, 'b').below, null);
});

test('ringOffset 42 de 60', () => {
  const C = 2 * Math.PI * 26;
  assert.ok(Math.abs(ringOffset(42, 60) - C * (1 - 42 / 60)) < 0.001);
  assert.equal(ringOffset(0, 60), C);
});

test('el servidor manda, fichero de respaldo, default 60', () => {
  assert.equal(resolveLiveRefreshSecs(45, 30), 30);
  assert.equal(resolveLiveRefreshSecs(45, null), 45);
  assert.equal(resolveLiveRefreshSecs(null, null), 60);
  assert.equal(resolveLiveRefreshSecs(-3, 0), 60);
});

test('tabs con Live activa', () => {
  const html = buildLiveTabsHtml('live');
  assert.ok(html.includes('data-tab="live"'));
  assert.ok(html.includes('🔴 Live'));
  assert.ok(html.includes('resultados-tab active'));
});

test('anillo con segundos dentro', () => {
  const html = buildRingHtml(42, 60);
  assert.ok(html.includes('>42<'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('stroke-dashoffset'));
});

test('zona con anterior/tu/siguiente y avatares', () => {
  const html = buildZoneHtml({
    above: { name: 'maria', avatar: '🏆', livePoints: 136 },
    me: { name: 'luisete', avatar: '⚽', livePoints: 132 },
    below: { name: 'pedro', avatar: '🦁', livePoints: 126 },
    pointsToAbove: 4, pointsOverBelow: 6
  });
  assert.ok(html.includes('maria') && html.includes('🏆'));
  assert.ok(html.includes('TÚ') && html.includes('a 4 pts'));
  assert.ok(html.includes('+6'));
});
