const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveLiveRefreshSecs, diffLiveMatches, computeLiveGaps, ringOffset, liveGoalsOf, buildLiveTabsHtml, buildRingHtml, buildZoneHtml, buildLiveSquadPlayersHtml, liveStatusStyle, buildLivePredictionPill, buildLiveTeamCell, describeLiveEvent, liveDayKey, pruneLiveEvents, appendLiveEvent, buildLiveEventsFeed } = require('../js/live.js');

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
  const gaps = {
    above: { name: 'maria', avatar: '🏆', livePoints: 136 },
    me: { name: 'luisete', avatar: '⚽', livePoints: 132 },
    below: { name: 'pedro', avatar: '🦁', livePoints: 126 },
    pointsToAbove: 4, pointsOverBelow: 6
  };
  const html = buildZoneHtml(gaps);
  assert.ok(html.includes('maria') && html.includes('🏆'));
  assert.ok(html.includes('TÚ') && html.includes('a 4 pts'));
  assert.ok(html.includes('+6'));
  assert.ok(html.includes('display:none'));
  const htmlOpen = buildZoneHtml(gaps, {}, true);
  assert.ok(htmlOpen.includes('display:block'));
  assert.ok(htmlOpen.includes('>▾<'));
});

test('buildLiveSquadPlayersHtml pinta nombre, demarcación, minutos y puntos', () => {
  const html = buildLiveSquadPlayersHtml(16938768, [
    { id: 70988, nombre: 'Thibaut Courtois', posicion: 'G', extension: 'webp', minutos: 90, goles: 0, asistencias: 0, puntos: -1, desglose: [{ concepto: 'Rating Sofascore (5.4)', puntos: -1 }] }
  ], 'FT');
  assert.ok(html.includes('Thibaut Courtois'));
  assert.ok(html.includes('Portero'));
  assert.ok(html.includes('90\''));
  assert.ok(html.includes('data-live-player="70988"'));
  assert.ok(html.includes('data-live-event="16938768"'));
  assert.ok(html.includes('-1'));
});

test('buildLiveSquadPlayersHtml marca portería a cero provisional si no es FT', () => {
  const html = buildLiveSquadPlayersHtml(1, [
    { id: 2, nombre: 'Portero X', posicion: 'G', minutos: 80, goles: 0, asistencias: 0, puntos: 5, desglose: [{ concepto: 'Portería a cero', puntos: 5 }] }
  ], 'LIVE');
  assert.ok(html.includes('Portería a cero (provisional)'));
});

test('buildLiveSquadPlayersHtml muestra goles y asistencias', () => {
  const html = buildLiveSquadPlayersHtml(1, [
    { id: 3, nombre: 'Delantero Y', posicion: 'F', minutos: 60, goles: 2, asistencias: 1, puntos: 4, desglose: [] }
  ], 'HT');
  assert.ok(html.includes('⚽ 2'));
  assert.ok(html.includes('🅰️ 1'));
});

test('buildLiveSquadPlayersHtml con lista vacía muestra mensaje', () => {
  const html = buildLiveSquadPlayersHtml(1, [], 'LIVE');
  assert.ok(html.toLowerCase().includes('ningún jugador'));
});

test('liveStatusStyle por estado y minuto', () => {
  assert.equal(liveStatusStyle('LIVE', 67).label, "● 67' EN JUEGO");
  assert.equal(liveStatusStyle('LIVE', 67).color, '#EF4444');
  assert.equal(liveStatusStyle('LIVE', null).label, '● EN JUEGO');
  assert.equal(liveStatusStyle('HT', null).label, '⏸ DESCANSO');
  assert.equal(liveStatusStyle('HT', null).color, '#F59E0B');
  assert.equal(liveStatusStyle('FT', null).label, 'FINAL');
});

test('buildLivePredictionPill muestra pronóstico y puntos', () => {
  const live = buildLivePredictionPill({ home: 2, away: 1 }, 3, 'LIVE');
  assert.ok(live.includes('Tu 2-1'));
  assert.ok(live.includes('+3'));
  assert.ok(live.includes('de momento'));
  const fin = buildLivePredictionPill({ home: 2, away: 1 }, 15, 'FT');
  assert.ok(!fin.includes('de momento'));
  const none = buildLivePredictionPill(null, 0, 'LIVE');
  assert.ok(none.toLowerCase().includes('sin pronóstico'));
});

test('buildLiveTeamCell pinta escudo con fallback', () => {
  const html = buildLiveTeamCell(42, undefined, 'Arsenal', 38);
  assert.ok(html.includes('data/imgEquipos/42.webp'));
  assert.ok(html.includes('width:38px'));
  assert.ok(html.includes('Arsenal'));
  assert.ok(html.includes('default.webp'));
});

test('describeLiveEvent genera el texto del aviso del directo', () => {
  assert.equal(describeLiveEvent({ type: 'goal' }, { scorer: 'Haaland', minute: 67 }), "⚽ ¡GOL! Haaland (67')");
  assert.equal(describeLiveEvent({ type: 'goal' }, {}), '⚽ ¡GOL!');
  assert.equal(describeLiveEvent({ type: 'rankUp' }, { rank: 3 }), '▲ Subes al 3º');
  assert.equal(describeLiveEvent({ type: 'rankDown' }, { rank: 5 }), '▼ Bajas al 5º');
  assert.equal(describeLiveEvent({ type: 'status', to: 'HT' }), '⏸ DESCANSO');
  assert.equal(describeLiveEvent({ type: 'status', to: 'FT' }), '🏁 FINAL');
  assert.equal(describeLiveEvent({ type: 'start' }), '🟢 ¡Empieza el partido!');
});

test('liveDayKey usa fecha local YYYY-MM-DD', () => {
  const t = new Date(2026, 8, 17, 15, 30).getTime();
  assert.equal(liveDayKey(t), '2026-09-17');
});

test('pruneLiveEvents invalida al cambiar de día y recorta', () => {
  const day = liveDayKey(Date.now());
  const store = { day, updatedAt: 1, events: [{ id: 1 }, { id: 2 }, { id: 3 }], baseline: { a: 1 } };
  const p = pruneLiveEvents(store, Date.now(), 2);
  assert.deepEqual(p.events.map(e => e.id), [2, 3]);
  assert.equal(p.baseline.a, 1);
  const other = pruneLiveEvents({ day: '2000-01-01', events: [{ id: 9 }], baseline: { x: 1 } }, Date.now(), 50);
  assert.deepEqual(other.events, []);
  assert.equal(other.baseline, null);
  assert.equal(other.day, day);
});

test('appendLiveEvent recorta al máximo', () => {
  let evs = [];
  for (let i = 0; i < 5; i++) evs = appendLiveEvent(evs, { id: i }, 3);
  assert.deepEqual(evs.map(e => e.id), [2, 3, 4]);
});

test('buildLiveEventsFeed vacío/punteado y reglas de despliegue', () => {
  const empty = buildLiveEventsFeed([], false);
  assert.ok(empty.includes('ÚLTIMA HORA'));
  assert.ok(empty.includes('display:none'));
  assert.ok(empty.toLowerCase().includes('aún no hay eventos'));
  const open = buildLiveEventsFeed([{ id: '1', text: '⚽ ¡GOL! X', ts: Date.now(), mine: false }], true);
  assert.ok(open.includes('display:block'));
  assert.ok(open.includes('¡GOL! X'));
});

test('buildLiveEventsFeed marca tu jugador en C1c', () => {
  const html = buildLiveEventsFeed([{ id: '1', text: '⚽ ¡GOL! Mbappé', ts: Date.now(), mine: true }], true);
  assert.ok(html.includes('#0E3B2E'));
  assert.ok(html.includes('rgba(16,185,129,0.55)'));
  assert.ok(html.includes('4px'));
});

test('describeLiveEvent añade equipo y partido desde el contexto', () => {
  assert.equal(describeLiveEvent({ type: 'goal' }, { scorer: 'Mbappé', minute: 23, team: 'R. Madrid' }), "⚽ ¡GOL! Mbappé (23') · R. Madrid");
  assert.equal(describeLiveEvent({ type: 'status', to: 'HT' }, { match: 'R. Madrid - Inter' }), '⏸ DESCANSO · R. Madrid - Inter');
  assert.equal(describeLiveEvent({ type: 'start' }, { match: 'A - B' }), '🟢 ¡Empieza el partido · A - B');
});
