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
