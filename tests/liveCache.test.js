// /home/ldoc/Proyectos/porra-spa/tests/liveCache.test.js
const assert = require('assert');

// Shim localStorage en Node (mismo patrón que tests/cacheStore.test.js;
// el brief omite este setup pero Node no trae localStorage y el roundtrip
// no puede pasar sin él).
class MemoryStorage {
  constructor() { this._map = new Map(); }
  getItem(k) { return this._map.has(k) ? this._map.get(k) : null; }
  setItem(k, v) { this._map.set(k, String(v)); }
  removeItem(k) { this._map.delete(k); }
  key(i) { return Array.from(this._map.keys())[i] ?? null; }
  get length() { return this._map.size; }
}
globalThis.localStorage = new MemoryStorage();

const { KEYS, mergeLiveMatches, cacheSet, cacheGet } = require('../js/cacheStore.js');

function test_live_keys_existen() {
  assert.strictEqual(KEYS.live, 'porra_cache_live_v1');
  assert.strictEqual(KEYS.liveEtag, 'porra_cache_live_etag_v1');
}
function test_merge_upsert_por_eventId() {
  const cur = [{ eventId: 1, homeGoles: 0 }];
  const out = mergeLiveMatches(cur, [{ eventId: 1, homeGoles: 2 }, { eventId: 2, homeGoles: 1 }]);
  assert.deepStrictEqual(out.map(m => m.eventId).sort(), [1, 2]);
  assert.strictEqual(out.find(m => m.eventId === 1).homeGoles, 2);
}
function test_merge_idempotente() {
  const cur = [{ eventId: 1 }];
  assert.deepStrictEqual(mergeLiveMatches(cur, [{ eventId: 1 }]), [{ eventId: 1 }]);
}
function test_cache_roundtrip_live() {
  assert.strictEqual(cacheSet(KEYS.live, { liveMatches: [{ eventId: 9 }] }, '2026-09-09T20:00:00Z'), true);
  const got = cacheGet(KEYS.live);
  assert.deepStrictEqual(got.payload.liveMatches, [{ eventId: 9 }]);
}
test_live_keys_existen();
test_merge_upsert_por_eventId();
test_merge_idempotente();
test_cache_roundtrip_live();
console.log('liveCache OK');
