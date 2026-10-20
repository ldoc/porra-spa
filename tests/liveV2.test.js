const test = require('node:test');
const assert = require('node:assert/strict');
const liveV2 = require('../js/liveV2.js');
const { createMatchState, applyEvent, matchClockAt, minutesOf } = liveV2;
const CTX = { homeTeamId: 1, awayTeamId: 2 };

test('el módulo expone liveV2Api en globalThis', () => {
  assert.equal(typeof globalThis.liveV2Api, 'object');
  assert.equal(globalThis.liveV2Api.createMatchState, createMatchState);
  assert.equal(globalThis.liveV2Api.applyEvent, applyEvent);
});

test('createMatchState arranca en NS y 0-0', () => {
  const s = createMatchState();
  assert.equal(s.status, 'NS');
  assert.deepEqual(s.score, { home: 0, away: 0 });
  assert.deepEqual(s.goals, []);
});

test('lineup marca titulares en el campo', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'lineup', sourceId: 'lineup|1', payload: { starters: [11, 12, 21] } }, CTX);
  assert.equal(s.players[11].onPitch, true);
  assert.equal(s.players[21].onPitch, true);
  assert.equal(s.players[11].entryMinute, 0);
});

test('goal suma al marcador y al goleador; own goal invierte el lado', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'goal', sourceId: 'goal|a', playerId: 11, payload: { scorerId: 11, isHome: true, isOwnGoal: false } }, CTX);
  assert.deepEqual(s.score, { home: 1, away: 0 });
  assert.equal(s.players[11].goals, 1);
  applyEvent(s, { type: 'goal', sourceId: 'goal|b', playerId: 22, payload: { scorerId: 22, isHome: false, isOwnGoal: true } }, CTX);
  assert.deepEqual(s.score, { home: 2, away: 0 });
  assert.equal(s.players[22].goals, 0);
});

test('goal_cancelled revierte el marcador', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'goal', sourceId: 'goal|a', playerId: 11, payload: { scorerId: 11, isHome: true } }, CTX);
  applyEvent(s, { type: 'goal_cancelled', sourceId: 'cancel|v', payload: { ofSourceId: 'goal|a' } }, CTX);
  assert.deepEqual(s.score, { home: 0, away: 0 });
  assert.equal(s.players[11].goals, 0);
});

test('rating actualiza la nota', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'rating', playerId: 11, payload: { rating: 7.4 } }, CTX);
  assert.equal(s.players[11].rating, 7.4);
});

test('assist fija las asistencias del jugador', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'assist', playerId: 12, payload: { asistencias: 1 } }, CTX);
  assert.equal(s.players[12].assists, 1);
});

test('status y score autoritativo', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'status', ts: '2026-09-16T20:00:00Z', payload: { status: 'LIVE', period: 'period1' } }, CTX);
  assert.equal(s.status, 'LIVE');
  assert.equal(s.kickoffTs, '2026-09-16T20:00:00Z');
  applyEvent(s, { type: 'score', payload: { scoreHome: 3, scoreAway: 2 } }, CTX);
  assert.deepEqual(s.score, { home: 3, away: 2 });
});

test('matchClockAt cuenta minutos desde kickoff', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'status', ts: '2026-09-16T20:00:00Z', payload: { status: 'LIVE', period: 'period1' } }, CTX);
  assert.equal(matchClockAt(s, Date.parse('2026-09-16T20:23:00Z')), 23);
});

test('matchClockAt topa a 45 en el descanso y resta 15 en la 2ª parte', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'status', ts: '2026-09-16T20:00:00Z', payload: { status: 'LIVE', period: 'period1' } }, CTX);
  applyEvent(s, { type: 'status', ts: '2026-09-16T20:45:00Z', payload: { status: 'HT', period: 'halftime' } }, CTX);
  assert.equal(matchClockAt(s, Date.parse('2026-09-16T20:50:00Z')), 45);
  applyEvent(s, { type: 'status', ts: '2026-09-16T21:00:00Z', payload: { status: 'LIVE', period: 'period2' } }, CTX);
  assert.equal(matchClockAt(s, Date.parse('2026-09-16T21:10:00Z')), 55);
});

test('minutesOf titulares acumula y se congela al salir', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'status', ts: '2026-09-16T20:00:00Z', payload: { status: 'LIVE' } }, CTX);
  applyEvent(s, { type: 'lineup', payload: { starters: [11, 30] } }, CTX);
  applyEvent(s, { type: 'substitution', minute: 60, payload: { inId: 30, outId: 11 } }, CTX);
  assert.equal(minutesOf(s, 11, Date.parse('2026-09-16T21:20:00Z')), 60);
  assert.equal(minutesOf(s, 30, Date.parse('2026-09-16T21:20:00Z')), 20);
});

test('penalti parado suma al portero', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'penalty_saved', payload: { keeperId: 1, takerId: 9 } }, CTX);
  assert.equal(s.players[1].penaltySaved, 1);
});

const { foldMatch, foldAll, stateAt } = liveV2;

test('foldMatch ordena por ts antes de plegar', () => {
  const events = [
    { eventId: 100, ts: '2026-09-16T20:05:00Z', type: 'goal', sourceId: 'g2', payload: { scorerId: 12, isHome: false } },
    { eventId: 100, ts: '2026-09-16T20:01:00Z', type: 'goal', sourceId: 'g1', payload: { scorerId: 11, isHome: true } }
  ];
  const s = foldMatch(events, CTX);
  assert.deepEqual(s.score, { home: 1, away: 1 });
});

test('stateAt solo pliega eventos hasta T', () => {
  const events = [
    { eventId: 100, ts: '2026-09-16T20:01:00Z', type: 'goal', sourceId: 'g1', payload: { scorerId: 11, isHome: true } },
    { eventId: 100, ts: '2026-09-16T20:30:00Z', type: 'goal', sourceId: 'g2', payload: { scorerId: 12, isHome: false } }
  ];
  const at = stateAt(events, Date.parse('2026-09-16T20:10:00Z'), { 100: CTX });
  assert.deepEqual(at[100].score, { home: 1, away: 0 });
});

test('foldAll agrupa por eventId', () => {
  const events = [
    { eventId: 1, ts: '2026-09-16T20:01:00Z', type: 'goal', sourceId: 'a', payload: { isHome: true } },
    { eventId: 2, ts: '2026-09-16T20:01:00Z', type: 'goal', sourceId: 'b', payload: { isHome: false } }
  ];
  const all = foldAll(events, { 1: { homeTeamId: 1, awayTeamId: 2 }, 2: { homeTeamId: 3, awayTeamId: 4 } });
  assert.deepEqual(all[1].score, { home: 1, away: 0 });
  assert.deepEqual(all[2].score, { home: 0, away: 1 });
});

test('score del mismo ts se aplica despues de los goles (no suma doble)', () => {
  const t = '2026-09-16T20:30:00.000Z';
  const events = [
    { eventId: 1, type: 'score', ts: t, ingestedAt: t, sourceId: 'score|1-0', payload: { scoreHome: 1, scoreAway: 0 } },
    { eventId: 1, type: 'goal', ts: t, ingestedAt: t, sourceId: 'goal|g', payload: { isHome: true, scorerId: 11 } }
  ];
  const state = liveV2Api.foldMatch(events, {});
  assert.deepEqual(state.score, { home: 1, away: 0 });
});

test('goal_cancelled del mismo ts se aplica despues del gol', () => {
  const t = '2026-09-16T20:30:00.000Z';
  const events = [
    { eventId: 1, type: 'goal_cancelled', ts: t, ingestedAt: t, sourceId: 'cancel|v', payload: { ofSourceId: 'goal|g' } },
    { eventId: 1, type: 'goal', ts: t, ingestedAt: t, sourceId: 'goal|g', payload: { isHome: true, scorerId: 11 } }
  ];
  const state = liveV2Api.foldMatch(events, {});
  assert.deepEqual(state.score, { home: 0, away: 0 });
});

test('foldMatch desempata por ingestedAt cuando el ts coincide', () => {
  // Mismo minuto: el orden debe seguir ingestedAt (gol antes que su anulación),
  // independientemente del orden del array entre lotes de delta.
  const events = [
    { eventId: 100, ts: '2026-09-16T20:05:00Z', ingestedAt: '2026-09-16T20:06:00Z', type: 'goal_cancelled', sourceId: 'c1', payload: { ofSourceId: 'g1' } },
    { eventId: 100, ts: '2026-09-16T20:05:00Z', ingestedAt: '2026-09-16T20:05:30Z', type: 'goal', sourceId: 'g1', payload: { scorerId: 11, isHome: true } }
  ];
  const s = foldMatch(events, CTX);
  assert.deepEqual(s.score, { home: 0, away: 0 });
});

const { matchStateToStats } = liveV2;

test('matchStateToStats produce stats con marcador y jugadores', () => {
  const s = createMatchState();
  const ctx = { homeTeamId: 1, awayTeamId: 2, playersById: {
    11: { nombre: 'A', posicion: 'F', equipo: 1 }, 12: { nombre: 'B', posicion: 'G', equipo: 2 }
  } };
  applyEvent(s, { type: 'status', ts: '2026-09-16T20:00:00Z', payload: { status: 'LIVE' } }, ctx);
  applyEvent(s, { type: 'lineup', payload: { starters: [11, 12] } }, ctx);
  applyEvent(s, { type: 'goal', playerId: 11, payload: { scorerId: 11, isHome: true } }, ctx);
  applyEvent(s, { type: 'rating', playerId: 11, payload: { rating: 7.5 } }, ctx);
  const stats = matchStateToStats(s, ctx);
  assert.equal(stats[1].goles, 1);
  assert.equal(stats[2].goles, 0);
  const p11 = stats.jugadores.find(j => String(j.id) === '11');
  assert.equal(p11.goles, 1);
  assert.equal(p11.puntos, 7.5);
  assert.equal(p11.posicion, 'F');
});

test('matchStateToStats atribuye goles recibidos al portero', () => {
  const s = createMatchState();
  const ctx = { homeTeamId: 1, awayTeamId: 2, playersById: {
    11: { nombre: 'A', posicion: 'F', equipo: 1 }, 12: { nombre: 'B', posicion: 'G', equipo: 2 }
  } };
  applyEvent(s, { type: 'lineup', payload: { starters: [11, 12] } }, ctx);
  applyEvent(s, { type: 'goal', playerId: 11, payload: { scorerId: 11, isHome: true, isOwnGoal: false } }, ctx);
  const stats = matchStateToStats(s, ctx);
  const gk = stats.jugadores.find(j => String(j.id) === '12');
  assert.equal(gk.golesRecibidos, 1);
});

test('matchStateToStats solo carga los goles recibidos al portero en el campo', () => {
  const s = createMatchState();
  const ctx = { homeTeamId: 1, awayTeamId: 2, playersById: {
    1: { nombre: 'GK1', posicion: 'G', equipo: 1 },
    2: { nombre: 'GK2', posicion: 'G', equipo: 1 },
    11: { nombre: 'A', posicion: 'F', equipo: 2 }
  } };
  applyEvent(s, { type: 'lineup', payload: { starters: [1, 11] } }, ctx);
  applyEvent(s, { type: 'goal', playerId: 11, payload: { scorerId: 11, isHome: false } }, ctx); // 0-1
  applyEvent(s, { type: 'substitution', minute: 60, payload: { inId: 2, outId: 1 } }, ctx);
  const stats = matchStateToStats(s, ctx, Date.parse('2026-09-16T21:10:00Z'));
  const gk1 = stats.jugadores.find(j => String(j.id) === '1');
  const gk2 = stats.jugadores.find(j => String(j.id) === '2');
  assert.equal(gk2.golesRecibidos, 1);
  assert.equal(gk1.golesRecibidos, 0);
});

test('matchStateToStats cae al portero con más minutos si ninguno está en el campo', () => {
  const s = createMatchState();
  s.players[1] = { ...liveV2.newPlayer(1), onPitch: false, entryMinute: 0, exitMinute: 30 };
  s.players[2] = { ...liveV2.newPlayer(2), onPitch: false, entryMinute: 0, exitMinute: 70 };
  applyEvent(s, { type: 'goal', playerId: 11, payload: { scorerId: 11, isHome: false } }, { homeTeamId: 1, awayTeamId: 2 });
  const ctx = { homeTeamId: 1, awayTeamId: 2, playersById: {
    1: { nombre: 'GK1', posicion: 'G', equipo: 1 },
    2: { nombre: 'GK2', posicion: 'G', equipo: 1 }
  } };
  const stats = matchStateToStats(s, ctx, Date.parse('2026-09-16T21:10:00Z'));
  const gk1 = stats.jugadores.find(j => String(j.id) === '1');
  const gk2 = stats.jugadores.find(j => String(j.id) === '2');
  assert.equal(gk2.golesRecibidos, 1);
  assert.equal(gk1.golesRecibidos, 0);
});

test('goal_cancelled revierte el penalti marcado del goleador', () => {
  const s = createMatchState();
  applyEvent(s, { type: 'goal', sourceId: 'g|pen', playerId: 11, payload: { scorerId: 11, isHome: true, isPenalty: true } }, CTX);
  assert.equal(s.players[11].penaltyScored, 1);
  applyEvent(s, { type: 'goal_cancelled', payload: { ofSourceId: 'g|pen' } }, CTX);
  assert.equal(s.players[11].penaltyScored, 0);
  assert.equal(s.players[11].goals, 0);
});

const { rankRows, reasonLabel, flipDelta } = liveV2;

test('rankRows ordena por puntos y calcula delta de puesto', () => {
  const rows = [{ name: 'ana', livePoints: 10 }, { name: 'luis', livePoints: 20 }];
  const ranked = rankRows(rows, { ana: 1, luis: 2 });
  assert.deepEqual(ranked.map(r => r.name), ['luis', 'ana']);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].delta, 1);
  assert.equal(ranked[1].delta, -1);
});

test('reasonLabel para gol y anulado', () => {
  assert.deepEqual(reasonLabel({ type: 'goal', payload: { isHome: true }, playerName: 'Mbappé', minute: 67 },
    { delta: 5 }), { icon: '⚽', text: "67' Gol de Mbappé", delta: 5 });
  assert.equal(reasonLabel({ type: 'goal_cancelled', payload: {}, minute: 67 }, { delta: -5 }).icon, '↩️');
});

test('flipDelta calcula desplazamientos', () => {
  const first = { a: { top: 10 }, b: { top: 30 } };
  const last = { a: { top: 30 }, b: { top: 10 } };
  assert.deepEqual(flipDelta(first, last), { a: -20, b: 20 });
});

const { liveV2ReasonForEvent, feedLabel } = liveV2;

test('liveV2ReasonForEvent resuelve el nombre del protagonista desde playersById', () => {
  const players = { 7: { nombre: 'Mbappé' } };
  assert.deepEqual(
    liveV2ReasonForEvent({ type: 'goal', playerId: 7, payload: { scorerId: 7 }, minute: 67 }, players, 5),
    { icon: '⚽', text: "67' Gol de Mbappé", delta: 5 });
  // goal sin scorerId usa playerId; goal sin jugador conocido cae a 'un jugador'
  assert.equal(liveV2ReasonForEvent({ type: 'goal', playerId: 7, payload: {}, minute: 12 }, players, 1).text, "12' Gol de Mbappé");
  assert.equal(liveV2ReasonForEvent({ type: 'goal', payload: {}, minute: 12 }, players, 1).text, "12' Gol de un jugador");
  // assist/penalty_saved resuelven sin romper
  assert.equal(liveV2ReasonForEvent({ type: 'assist', playerId: 7, payload: {} }, players, 1).icon, '🅰️');
  assert.equal(liveV2ReasonForEvent({ type: 'penalty_saved', payload: { keeperId: 7 }, minute: 12 }, players, 3).icon, '🧤');
});

test('feedLabel resuelve el nombre del goleador y cubre tipos del feed', () => {
  const players = { 7: { nombre: 'Mbappé' } };
  assert.deepEqual(feedLabel({ type: 'goal', playerId: 7, payload: { scorerId: 7 }, minute: 67 }, players),
    { icon: '⚽', text: "67' Gol de Mbappé" });
  assert.equal(feedLabel({ type: 'card', playerId: 7, payload: { cardType: 'yellow' }, minute: 20 }, players).text, "20' Amarilla · Mbappé");
  assert.equal(feedLabel({ type: 'goal_cancelled', payload: {}, minute: 30 }, players).icon, '↩️');
  assert.equal(feedLabel({ type: 'lineup', payload: {} }, players), null);
});

test('una roja saca al jugador del campo', () => {
  const st = liveV2Api.createMatchState();
  liveV2Api.applyEvent(st, { type: 'lineup', minute: 0, payload: { starters: [11] } });
  liveV2Api.applyEvent(st, { type: 'status', minute: 0, ts: '2026-09-16T20:00:00Z',
    payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00Z' } });
  liveV2Api.applyEvent(st, { type: 'card', minute: 20, playerId: 11, payload: { cardType: 'red' } });
  assert.equal(liveV2Api.minutesOf(st, 11, Date.parse('2026-09-16T21:00:00Z')), 20);
});

test('el reloj no depende del primer estado observado (kickoffTs explicito)', () => {
  const st = liveV2Api.createMatchState();
  liveV2Api.applyEvent(st, { type: 'status', minute: 45, ts: '2026-09-16T21:00:00Z',
    payload: { status: 'LIVE', period: 'period2', kickoffTs: '2026-09-16T20:00:00Z' } });
  assert.equal(liveV2Api.matchClockAt(st, Date.parse('2026-09-16T21:10:00Z')), 55);
});

test('el reloj se congela en FT', () => {
  const st = liveV2Api.createMatchState();
  liveV2Api.applyEvent(st, { type: 'status', minute: 90, ts: '2026-09-16T21:45:00Z',
    payload: { status: 'FT', period: null, kickoffTs: '2026-09-16T20:00:00Z' } });
  assert.equal(liveV2Api.matchClockAt(st, Date.parse('2026-09-16T23:00:00Z')), 90);
});

test('matchStateToStats de un partido NS no genera puntos', () => {
  const st = liveV2Api.createMatchState();
  const stats = liveV2Api.matchStateToStats(st, { homeTeamId: 1, awayTeamId: 2, playersById: {} }, null);
  assert.deepEqual(stats[1], { goles: 0 });
  assert.equal(st.status, 'NS');
});

test('escapeHtml neutraliza HTML', () => {
  assert.equal(liveV2Api.escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
});

test('eventKey deduplica por eventId|sourceId sin depender de _id', () => {
  assert.equal(liveV2Api.eventKey({ eventId: 100, sourceId: 'goal|1' }), '100|goal|1');
  assert.equal(
    liveV2Api.eventKey({ eventId: 100, sourceId: 'goal|1', _id: 'a' }),
    liveV2Api.eventKey({ eventId: 100, sourceId: 'goal|1', _id: 'b' })
  );
  assert.notEqual(
    liveV2Api.eventKey({ eventId: 100, sourceId: 'goal|1' }),
    liveV2Api.eventKey({ eventId: 100, sourceId: 'goal|2' })
  );
});

// ── Feed y motivo (Task 9) ──────────────────────────────────────────

const liveV2Ui = require('../js/live-v2-ui.js');
const uiState = { allPlayers: [], liveV2: null };
liveV2Ui.init({ AppState: uiState, liveV2Api: liveV2 });

test('feed filtra lineup/status antes de recortar y ordena por (ts, seq)', () => {
  uiState.liveV2 = { events: [
    { type: 'goal', ts: '2026-09-16T20:01:00Z', seq: 1, minute: 1, payload: {} },
    { type: 'goal', ts: '2026-09-16T20:02:00Z', seq: 1, minute: 2, payload: {} },
    { type: 'status', ts: '2026-09-16T20:02:30Z', seq: 1, payload: { status: 'LIVE' } },
    { type: 'goal', ts: '2026-09-16T20:03:00Z', seq: 1, minute: 4, payload: {} },
    { type: 'lineup', ts: '2026-09-16T20:03:30Z', seq: 1, payload: {} },
    { type: 'goal', ts: '2026-09-16T20:03:00Z', seq: 2, minute: 3, payload: {} },
    { type: 'goal', ts: '2026-09-16T20:04:00Z', seq: 1, minute: 5, payload: {} },
  ] };
  const html = liveV2Ui.liveV2FeedHtml();
  assert.equal((html.match(/livev2-ticker-item/g) || []).length, 4);
  assert.equal((html.match(/data-livev2-key=/g) || []).length, 4, 'items keyed para parchear sin recrear');
  const pos = [5, 3, 4, 2].map(m => html.indexOf(`${m}&#39; Gol`));
  assert.ok(pos.every(p => p >= 0), 'muestra los cuatro goles útiles');
  assert.deepEqual(pos.slice().sort((a, b) => a - b), pos, 'más reciente primero');
});

test('feed descarta eventos con ts inválido', () => {
  uiState.liveV2 = { events: [
    { type: 'goal', ts: 'no-es-fecha', seq: 1, minute: 9, payload: {} },
    { type: 'goal', ts: '2026-09-16T20:01:00Z', seq: 1, minute: 1, payload: {} },
  ] };
  const html = liveV2Ui.liveV2FeedHtml();
  assert.equal((html.match(/livev2-ticker-item/g) || []).length, 1);
  assert.ok(html.includes("1&#39; Gol"));
});

test('motivo atribuye el delta del poll cuando hay un único evento relevante', () => {
  uiState.allPlayers = [{ id: 7, nombre: 'Mbappé' }];
  uiState.squadsCache = { ana: [{ id: 7 }] };
  const rows = [
    { name: 'ana', rank: 1, livePoints: 15, isMe: false },
    { name: 'beto', rank: 2, livePoints: 10, isMe: false },
  ];
  const prev = { ana: { rank: 2, livePoints: 10 }, beto: { rank: 1, livePoints: 10 } };
  const mover = liveV2Ui.liveV2MoverReason(rows, prev, [
    { type: 'goal', ts: '2026-09-16T20:10:00Z', playerId: 7, payload: { scorerId: 7 }, minute: 67 },
  ]);
  assert.equal(mover.name, 'ana');
  assert.equal(mover.lines[0].delta, 5);
  assert.equal(mover.total, 5);
  assert.equal(mover.pointsDelta, 5);
});

test('motivo no atribuye el delta si el poll trae goal + match_final', () => {
  uiState.allPlayers = [{ id: 7, nombre: 'Mbappé' }];
  uiState.squadsCache = { ana: [{ id: 7 }] };
  const rows = [
    { name: 'ana', rank: 1, livePoints: 15, isMe: false },
    { name: 'beto', rank: 2, livePoints: 10, isMe: false },
  ];
  const prev = { ana: { rank: 2, livePoints: 10 }, beto: { rank: 1, livePoints: 10 } };
  const mover = liveV2Ui.liveV2MoverReason(rows, prev, [
    { type: 'goal', ts: '2026-09-16T20:10:00Z', seq: 1, playerId: 7, payload: { scorerId: 7 }, minute: 67 },
    { type: 'match_final', ts: '2026-09-16T21:50:00Z', seq: 2, payload: {} },
  ]);
  assert.equal(mover.name, 'ana');
  assert.match(mover.lines[0].text, /Gol de Mbappé/);
  assert.equal(mover.lines[0].delta, 0);
  assert.equal(mover.pointsDelta, 0);
});

test('motivo con varios eventos no inventa atribución (delta 0)', () => {
  uiState.allPlayers = [{ id: 7, nombre: 'Mbappé' }, { id: 8, nombre: 'Vini Jr.' }];
  uiState.squadsCache = { ana: [{ id: 7 }, { id: 8 }] };
  const rows = [
    { name: 'ana', rank: 1, livePoints: 15, isMe: false },
    { name: 'beto', rank: 2, livePoints: 10, isMe: false },
  ];
  const prev = { ana: { rank: 2, livePoints: 10 }, beto: { rank: 1, livePoints: 10 } };
  const mover = liveV2Ui.liveV2MoverReason(rows, prev, [
    { type: 'goal', ts: '2026-09-16T20:10:00Z', seq: 1, playerId: 7, payload: { scorerId: 7 }, minute: 67 },
    { type: 'assist', ts: '2026-09-16T20:11:00Z', seq: 2, playerId: 8, payload: {} },
  ]);
  assert.equal(mover.name, 'ana');
  assert.equal(mover.lines[0].delta, 0);
  assert.equal(mover.pointsDelta, 0);
  assert.match(mover.lines[0].text, /Asistencia|Gol/);
});

// ── Revisión final (reloj servidor, resync, expulsados, motivos) ──────

const playerPoints = require('../js/playerPoints.js');

test('reasonLabel cubre score, match_final y substitution', () => {
  assert.deepEqual(reasonLabel({ type: 'score', minute: 45, payload: {} }, { delta: 0 }),
    { icon: '🔧', text: "45' Corrección de marcador", delta: 0 });
  assert.deepEqual(reasonLabel({ type: 'match_final', minute: 90, payload: {} }, { delta: 0 }),
    { icon: '🏁', text: "90' Final del partido", delta: 0 });
  assert.deepEqual(reasonLabel({ type: 'substitution', minute: 60, payload: {} }, { delta: 0 }),
    { icon: '🔁', text: "60' Cambio", delta: 0 });
});

test('reasonLabel cubre tarjeta', () => {
  const label = liveV2.reasonLabel({ type: 'card', minute: 80, payload: { cardType: 'red' } }, { delta: -2 });
  assert.ok(label);
  assert.equal(label.delta, -2);
});

test('match_final fija lastMinute y ftTs si faltan', () => {
  const st = createMatchState();
  applyEvent(st, {
    type: 'status', ts: '2026-09-16T20:00:00Z',
    payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00Z' }
  }, CTX);
  applyEvent(st, {
    type: 'match_final', ts: '2026-09-16T21:50:00Z', minute: 90,
    payload: { scoreHome: 1, scoreAway: 0 }
  }, CTX);
  assert.equal(st.status, 'FT');
  assert.equal(st.lastMinute, 90);
  assert.equal(st.ftTs, '2026-09-16T21:50:00Z');
  assert.equal(matchClockAt(st, Date.parse('2026-09-16T23:00:00Z')), 90);
});

test('un expulsado a los 80 cobra la portería a cero si jugó >70 min', () => {
  const st = createMatchState();
  const ctx = {
    homeTeamId: 1, awayTeamId: 2,
    playersById: { 11: { nombre: 'Def', posicion: 'D', equipo: 1 } }
  };
  applyEvent(st, {
    type: 'status', minute: 0, ts: '2026-09-16T20:00:00Z',
    payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00Z' }
  }, ctx);
  applyEvent(st, { type: 'lineup', payload: { starters: [11] } }, ctx);
  applyEvent(st, { type: 'card', minute: 80, playerId: 11, payload: { cardType: 'red' } }, ctx);
  const stats = matchStateToStats(st, ctx, Date.parse('2026-09-16T21:20:00Z'));
  const p = stats.jugadores.find(j => String(j.id) === '11');
  assert.equal(p.expulsado, true);
  assert.equal(p.minutos, 80);
  // 0-0 y >70 min: +2 aunque esté expulsado (la regla solo mira minutos y goles).
  assert.equal(playerPoints.cleanSheetBonus(p.posicion, p.minutos, 0), 2);
  assert.equal(playerPoints.cleanSheetBonus('G', 71, 0), 5);
  assert.equal(playerPoints.cleanSheetBonus('D', 70, 0), 0);
});

test('goles encajados se reparten entre porteros según el minuto del gol', () => {
  const st = createMatchState();
  const ctx = { homeTeamId: 1, awayTeamId: 2, playersById: {
    10: { nombre: 'GK1', posicion: 'G', equipo: 1 },
    15: { nombre: 'GK2', posicion: 'G', equipo: 1 },
    20: { nombre: 'GK A', posicion: 'G', equipo: 2 },
    23: { nombre: 'F A', posicion: 'F', equipo: 2 }
  } };
  applyEvent(st, { type: 'status', minute: 0, ts: '2026-09-16T20:00:00Z',
    payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00Z' } }, ctx);
  applyEvent(st, { type: 'lineup', minute: 0, payload: { starters: [10, 20, 23] } }, ctx);
  applyEvent(st, { type: 'goal', minute: 20, ts: '2026-09-16T20:20:00Z',
    payload: { isHome: false, scorerId: 23 } }, ctx);
  applyEvent(st, { type: 'substitution', minute: 60, ts: '2026-09-16T21:00:00Z',
    payload: { inId: 15, outId: 10 } }, ctx);
  applyEvent(st, { type: 'goal', minute: 70, ts: '2026-09-16T21:10:00Z',
    payload: { isHome: false, scorerId: 23 } }, ctx);
  const stats = matchStateToStats(st, ctx, Date.parse('2026-09-16T21:45:00Z'));
  const gk1 = stats.jugadores.find(j => String(j.id) === '10');
  const gk2 = stats.jugadores.find(j => String(j.id) === '15');
  assert.equal(gk1.golesRecibidos, 1);
  assert.equal(gk2.golesRecibidos, 1);
});

test('foldMatch ordena sourceId por code unit (Z antes que a)', () => {
  const t = '2026-09-16T20:30:00.000Z';
  const events = [
    { eventId: 1, type: 'score', ts: t, ingestedAt: t, seq: 0, sourceId: 'a', payload: { scoreHome: 1, scoreAway: 0 } },
    { eventId: 1, type: 'score', ts: t, ingestedAt: t, seq: 0, sourceId: 'Z', payload: { scoreHome: 2, scoreAway: 0 } },
  ];
  const s = foldMatch(events, CTX);
  assert.deepEqual(s.score, { home: 1, away: 0 });
});

test('wantSimSource solo en localhost/127.0.0.1 con liveSim=1', () => {
  assert.equal(liveV2.wantSimSource('?liveSim=1', 'localhost'), true);
  assert.equal(liveV2.wantSimSource('?liveSim=1', '127.0.0.1'), true);
  assert.equal(liveV2.wantSimSource('?liveSim=1', 'porra-spa.vercel.app'), false);
  assert.equal(liveV2.wantSimSource('', 'localhost'), false);
  assert.equal(liveV2.wantSimSource('?liveSim=0', 'localhost'), false);
});
