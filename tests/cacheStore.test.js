const { test } = require('node:test');
const assert = require('node:assert/strict');

class MemoryStorage {
  constructor() { this._map = new Map(); }
  getItem(k) { return this._map.has(k) ? this._map.get(k) : null; }
  setItem(k, v) { this._map.set(k, String(v)); }
  removeItem(k) { this._map.delete(k); }
  key(i) { return Array.from(this._map.keys())[i] ?? null; }
  get length() { return this._map.size; }
}
globalThis.localStorage = new MemoryStorage();

const { KEYS, predKey, messagesKey, cacheGet, cacheSet, cacheRemove, clearPorraCaches, mergeMatchStats } = require('../js/cacheStore.js');

test('predKey versiona por usuario', () => {
  assert.equal(predKey('ana'), 'porra_cache_predall_v1_ana');
});

test('messagesKey versiona por usuario', () => {
  assert.equal(messagesKey('ana'), 'porra_cache_messages_v1_ana');
});

test('cacheSet/cacheGet roundtrip con serverTime', () => {
  assert.equal(cacheSet(KEYS.matchstats, { matchStats: [{ eventId: 9 }] }, '2026-08-25T00:00:00Z'), true);
  const got = cacheGet(KEYS.matchstats);
  assert.equal(got.serverTime, '2026-08-25T00:00:00Z');
  assert.deepEqual(got.payload.matchStats, [{ eventId: 9 }]);
});

test('cacheGet devuelve null con datos corruptos', () => {
  localStorage.setItem(predKey('pepe'), '{corrupto');
  assert.equal(cacheGet(predKey('pepe')), null);
});

test('cacheGet devuelve null si no existe la clave', () => {
  assert.equal(cacheGet(predKey('nadie')), null);
});

test('cacheRemove elimina la clave', () => {
  cacheSet(KEYS.matchstats, {}, null);
  cacheRemove(KEYS.matchstats);
  assert.equal(cacheGet(KEYS.matchstats), null);
});

test('cacheSet rechaza payloads mayores de 2MB', () => {
  const grande = { blob: 'x'.repeat(3 * 1024 * 1024) };
  assert.equal(cacheSet(predKey('gordo'), grande, null), false);
});

test('clearPorraCaches borra solo las claves propias', () => {
  cacheSet(KEYS.matchstats, {}, null);
  cacheSet(predKey('ana'), {}, null);
  localStorage.setItem('session_token', 't');
  localStorage.setItem('porra_ucl_user', '{}');
  clearPorraCaches();
  assert.equal(cacheGet(KEYS.matchstats), null);
  assert.equal(cacheGet(predKey('ana')), null);
  assert.equal(localStorage.getItem('session_token'), 't');
  assert.equal(localStorage.getItem('porra_ucl_user'), '{}');
});

test('clearPorraCaches borra también las claves de mensajes', () => {
  cacheSet(messagesKey('luis'), [{ id: '1' }], null);
  localStorage.setItem('session_token', 't');
  clearPorraCaches();
  assert.equal(cacheGet(messagesKey('luis')), null);
  assert.equal(localStorage.getItem('session_token'), 't');
});

test('mergeMatchStats añade partidos nuevos al final', () => {
  const merged = mergeMatchStats([{ eventId: 1, stats: {} }], [{ eventId: 2, stats: {} }]);
  assert.deepEqual(merged.map(m => m.eventId), [1, 2]);
});

test('mergeMatchStats sobreescribe por eventId manteniendo posicion', () => {
  const merged = mergeMatchStats(
    [{ eventId: 1, stats: { goles: 0 } }, { eventId: 2, stats: {} }],
    [{ eventId: 1, stats: { goles: 3 } }]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].stats.goles, 3);
  assert.equal(merged[1].eventId, 2);
});

test('mergeMatchStats es idempotente con delta completo', () => {
  const completo = [{ eventId: 1, stats: { goles: 1 } }, { eventId: 2, stats: { goles: 2 } }];
  const una = mergeMatchStats([], completo);
  const dos = mergeMatchStats(una, completo);
  assert.deepEqual(dos, una);
});

test('mergeMatchStats tolera current/delta ausentes', () => {
  assert.deepEqual(mergeMatchStats(null, []), []);
  assert.deepEqual(mergeMatchStats([], undefined), []);
});
