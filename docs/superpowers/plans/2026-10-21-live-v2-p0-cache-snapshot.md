# Live v2 P0 (caché y huecos de snapshot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el P0 abierto de Live v2: caché versionada por source/fase con limpieza y límite, y relleno de partidos que solo existen en `livematches`.

**Architecture:** La caché de `js/live-v2-ui.js` pasa a una clave `v2` que incluye día, usuario, `real|sim` y fase. Se purgan claves antiguas, se limita el payload y se reintenta una vez sin cuota. El plegado de `js/liveV2.js` se amplía con una función pura que añade snapshots frescos solo cuando el partido no tiene eventos.

**Tech Stack:** JavaScript vanilla (IIFE), `node:test`, `localStorage`, API de Mongo existente.

## Global Constraints

- **No commitear sin petición explícita del usuario.** Los checkpoints de este plan solo ejecutan tests.
- Node 26 (`node --test`).
- No añadir dependencias.
- No cambiar la autoridad del snapshot para partidos que ya tienen eventos.
- Mantener el full al entrar si el último full tiene más de 60 s.
- Tests de `porra-spa`: `node --test tests/*.test.js`.
- Tests de `api-porra`: `node --test tests/*.test.js`.
- Cache-busters de `index.html`: subir `liveV2.js` y `live-v2-ui.js` al terminar.

---

### Task 1: Clave de caché v2 con source y fase

**Files:**
- Modify: `js/live-v2-ui.js:347-434`
- Test: `tests/liveV2Ui.test.js:807-870`

**Interfaces:**
- Produces: `liveV2CacheKey(username, now, { source, phase }) -> string|null`
- Produces: `liveV2CacheIsFresh(cached, { source, phase }) -> boolean`
- Produces: `purgeLiveV2CacheKeys(storage, keepKey) -> number`
- Produces: `liveV2CacheSource() -> 'real'|'sim'`
- Produces: `liveV2CachePhase() -> string`

- [ ] **Step 1: Write the failing tests**

Sustituye los tests actuales de clave/frescura/purga en `tests/liveV2Ui.test.js` por estos:

```js
test('liveV2CacheKey incluye source y fase', () => {
  const now = new Date(2026, 9, 19, 12, 0, 0).getTime();
  assert.equal(
    liveV2CacheKey('juan', now, { source: 'real', phase: 'FASE_LIGA' }),
    'porra_live_events_v2:2026-10-19:juan:real:FASE_LIGA'
  );
  assert.equal(
    liveV2CacheKey('juan', now, { source: 'sim', phase: 'FASE_8' }),
    'porra_live_events_v2:2026-10-19:juan:sim:FASE_8'
  );
  assert.equal(liveV2CacheKey(null, now, { source: 'real', phase: 'FASE_LIGA' }), null);
});

test('liveV2CacheIsFresh exige versión, source, fase, eventos, cursor y fullAt', () => {
  const opts = { source: 'real', phase: 'FASE_LIGA' };
  const ok = { version: 2, source: 'real', phase: 'FASE_LIGA', events: [], serverTime: 'T', fullAt: 1 };
  assert.equal(liveV2CacheIsFresh(ok, opts), true);
  assert.equal(liveV2CacheIsFresh({ ...ok, version: 1 }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, source: 'sim' }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, phase: 'FASE_8' }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, events: null }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, serverTime: null }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, fullAt: null }, opts), false);
  assert.equal(liveV2CacheIsFresh(null, opts), false);
});

test('restoreLiveV2Cache ignora una caché de otro source', () => {
  const ui = freshUi();
  const day = ui.liveV2CacheDay();
  const saved = JSON.stringify({
    version: 2, source: 'sim', phase: 'FASE_LIGA',
    events: [{ eventId: 1, sourceId: 'a' }], serverTime: '2026-10-21T10:00:00Z', fullAt: 1,
  });
  const store = { [`porra_live_events_v2:${day}:juan:sim:FASE_LIGA`]: saved };
  const prev = global.localStorage;
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  try {
    const AppState = {
      currentUser: { name: 'juan' },
      appConfig: { faseJuego: 'FASE_LIGA' },
      liveV2: null,
    };
    ui.init({ AppState, liveV2Api: {} });
    const st = ui.liveV2State();
    assert.equal(st.serverTime, null, 'la caché sim no se restaura en real');
    assert.deepEqual(st.events, []);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});

test('purgeLiveV2Caches elimina todas las versiones del live', () => {
  const store = {
    a: 'x',
    'porra_live_events_v1:2026-10-19:juan': '{}',
    'porra_live_events_v2:2026-10-19:juan:real:FASE_LIGA': '{}',
    'porra_live_events_v2:2026-10-18:ana:sim:FASE_8': '{}',
    other: 'y',
  };
  const storage = {
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
    removeItem: k => { delete store[k]; },
  };
  assert.equal(purgeLiveV2Caches(storage), 3);
  assert.deepEqual(Object.keys(store), ['a', 'other']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque la clave sigue siendo `porra_live_events_v1` y `liveV2CacheIsFresh` no acepta opciones.

- [ ] **Step 3: Implement the cache key and restore logic**

En `js/live-v2-ui.js`, sustituye las declaraciones y funciones de caché por:

```js
const LIVEV2_CACHE_PREFIX = 'porra_live_events_';
const LIVEV2_CACHE_KEY = `${LIVEV2_CACHE_PREFIX}v2`;
const LIVEV2_CACHE_VERSION = 2;
const LIVEV2_FULL_ON_ENTRY_MS = 60 * 1000;
let _liveV2CacheRestored = false;

/** Al entrar en Live: full si falta, está pendiente o el último full tiene más de 60 s. */
function liveV2ShouldFullOnEntry(st, now) {
  const at = now == null ? Date.now() : now;
  if (!st || !st.serverTime || !Array.isArray(st.events) || !st.events.length || st._needFull) return true;
  const fullAt = Number(st._fullAt);
  return !Number.isFinite(fullAt) || at - fullAt > LIVEV2_FULL_ON_ENTRY_MS;
}

function liveV2CacheStorage() {
  try {
    const storage = global.localStorage;
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
      ? storage : null;
  } catch (e) { return null; }
}

function liveV2CacheDay(now) {
  const d = now == null ? new Date() : new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `real` salvo que estemos en local con `?liveSim=1`. */
function liveV2CacheSource() {
  try {
    if (typeof window !== 'undefined' && window.location && liveV2Api
      && typeof liveV2Api.wantSimSource === 'function'
      && liveV2Api.wantSimSource(window.location.search, window.location.hostname)) return 'sim';
  } catch (e) { /* sin window */ }
  return 'real';
}

function liveV2CachePhase() {
  try {
    return (AppState && AppState.appConfig && AppState.appConfig.faseJuego) || 'unknown';
  } catch (e) { return 'unknown'; }
}

function liveV2CacheKey(username, now, opts) {
  if (!username) return null;
  const o = opts || {};
  const source = o.source || liveV2CacheSource();
  const phase = o.phase || liveV2CachePhase();
  return `${LIVEV2_CACHE_KEY}:${liveV2CacheDay(now)}:${username}:${source}:${phase}`;
}

function liveV2CacheIsFresh(cached, opts) {
  const o = opts || {};
  const source = o.source || liveV2CacheSource();
  const phase = o.phase || liveV2CachePhase();
  return !!cached
    && cached.version === LIVEV2_CACHE_VERSION
    && cached.source === source
    && cached.phase === phase
    && Array.isArray(cached.events)
    && typeof cached.serverTime === 'string' && !!cached.serverTime
    && Number.isFinite(cached.fullAt);
}

function purgeLiveV2CacheKeys(storage, keepKey) {
  const s = storage || liveV2CacheStorage();
  if (!s) return 0;
  let removed = 0;
  try {
    const keys = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.indexOf(LIVEV2_CACHE_PREFIX) === 0 && k !== keepKey) keys.push(k);
    }
    for (const k of keys) { s.removeItem(k); removed++; }
  } catch (e) { /* storage no disponible */ }
  return removed;
}

function purgeLiveV2Caches(storage) {
  return purgeLiveV2CacheKeys(storage, null);
}

function restoreLiveV2Cache(st) {
  if (_liveV2CacheRestored) return;
  const username = AppState && AppState.currentUser && AppState.currentUser.name;
  const opts = { source: liveV2CacheSource(), phase: liveV2CachePhase() };
  const key = liveV2CacheKey(username, null, opts);
  if (!key) return;
  _liveV2CacheRestored = true;
  const storage = liveV2CacheStorage();
  if (!storage) return;
  try {
    purgeLiveV2CacheKeys(storage, key);
    const cached = JSON.parse(storage.getItem(key) || 'null');
    if (!liveV2CacheIsFresh(cached, opts)) return;
    st.events = cached.events;
    st.serverTime = cached.serverTime;
    st.serverNow = cached.serverTime;
    st._fullAt = cached.fullAt;
    st._needFull = !!cached.truncated;
  } catch (e) { /* caché ausente, corrupta o sin storage */ }
}
```

Añade `purgeLiveV2CacheKeys` al objeto de exports:

```js
    purgeLiveV2Caches,
    purgeLiveV2CacheKeys,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `node --check js/live-v2-ui.js`
Expected: sin salida. No commit.

---

### Task 2: Límite de eventos, `truncated` y reintento por cuota

**Files:**
- Modify: `js/live-v2-ui.js` (`saveLiveV2Cache` y exports)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `purgeLiveV2CacheKeys`, `liveV2CacheKey`, `liveV2CacheSource`, `liveV2CachePhase` de Task 1.
- Produces: `liveV2TrimCacheEvents(events, max = 6000) -> { events, truncated }`
- Produces: `saveLiveV2Cache(st) -> void`
- Produces: `LIVEV2_CACHE_MAX_EVENTS = 6000`

- [ ] **Step 1: Write the failing tests**

Añade al final de `tests/liveV2Ui.test.js`:

```js
test('liveV2TrimCacheEvents limita y marca truncated', () => {
  const events = Array.from({ length: 5 }, (_, i) => ({
    eventId: i,
    ingestedAt: new Date(1000 + i).toISOString(),
    ts: new Date(1000 + i).toISOString(),
  }));
  const out = liveV2TrimCacheEvents(events, 3);
  assert.equal(out.truncated, true);
  assert.deepEqual(out.events.map(e => e.eventId), [4, 3, 2]);
  assert.equal(liveV2TrimCacheEvents(events, 5).truncated, false);
});

test('saveLiveV2Cache purga claves viejas y reintenta si falla la cuota', () => {
  const ui = freshUi();
  const day = ui.liveV2CacheDay();
  const staleKey = `porra_live_events_v2:${day}:ana:real:FASE_LIGA`;
  const store = { [staleKey]: '{}' };
  let writes = 0;
  const storage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      writes++;
      if (writes === 1) throw new Error('QuotaExceededError');
      store[k] = String(v);
    },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  const prev = global.localStorage;
  global.localStorage = storage;
  try {
    const AppState = {
      currentUser: { name: 'juan' },
      appConfig: { faseJuego: 'FASE_LIGA' },
      liveV2: {
        events: [{ eventId: 1, sourceId: 'a', ingestedAt: '2026-10-21T10:00:00Z', ts: '2026-10-21T10:00:00Z' }],
        serverTime: '2026-10-21T10:00:00Z',
        _fullAt: 1,
      },
    };
    ui.init({ AppState, liveV2Api: {} });
    ui.saveLiveV2Cache(AppState.liveV2);
    const key = ui.liveV2CacheKey('juan', null, { source: 'real', phase: 'FASE_LIGA' });
    assert.equal(writes, 2, 'reintenta una vez');
    assert.equal(staleKey in store, false, 'purga claves antiguas');
    const saved = JSON.parse(store[key]);
    assert.equal(saved.version, 2);
    assert.equal(saved.source, 'real');
    assert.equal(saved.phase, 'FASE_LIGA');
    assert.equal(saved.events.length, 1);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque `liveV2TrimCacheEvents` y `saveLiveV2Cache` no existen en el módulo exportado.

- [ ] **Step 3: Implement trimming and quota retry**

En `js/live-v2-ui.js`, añade la constante junto a las demás:

```js
const LIVEV2_CACHE_MAX_EVENTS = 6000;
```

Sustituye `saveLiveV2Cache` por:

```js
function liveV2TrimCacheEvents(events, max = LIVEV2_CACHE_MAX_EVENTS) {
  const list = Array.isArray(events) ? events : [];
  const cap = Number.isInteger(max) && max > 0 ? max : LIVEV2_CACHE_MAX_EVENTS;
  if (list.length <= cap) return { events: list, truncated: false };
  const sorted = [...list].sort((a, b) => {
    const byIngested = new Date(b && b.ingestedAt || 0).getTime() - new Date(a && a.ingestedAt || 0).getTime();
    if (byIngested) return byIngested;
    return new Date(b && b.ts || 0).getTime() - new Date(a && a.ts || 0).getTime();
  });
  return { events: sorted.slice(0, cap), truncated: true };
}

function saveLiveV2Cache(st) {
  const username = AppState && AppState.currentUser && AppState.currentUser.name;
  const opts = { source: liveV2CacheSource(), phase: liveV2CachePhase() };
  const key = liveV2CacheKey(username, null, opts);
  if (!key) return;
  const storage = liveV2CacheStorage();
  if (!storage) return;
  const { events, truncated } = liveV2TrimCacheEvents(st.events);
  const payload = {
    version: LIVEV2_CACHE_VERSION,
    source: opts.source,
    phase: opts.phase,
    events,
    serverTime: st.serverTime || null,
    fullAt: st._fullAt || Date.now(),
    truncated,
  };
  const write = () => storage.setItem(key, JSON.stringify(payload));
  try {
    write();
  } catch (e) {
    purgeLiveV2CacheKeys(storage, null);
    try {
      write();
    } catch (e2) {
      try { storage.removeItem(key); } catch (e3) { /* sin storage */ }
    }
  }
}
```

Añade los exports:

```js
    liveV2TrimCacheEvents,
    saveLiveV2Cache,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `node --check js/live-v2-ui.js`
Expected: sin salida. No commit.

---

### Task 3: Función pura `fillSnapshotGaps`

**Files:**
- Modify: `js/liveV2.js` (antes de `const liveV2Api = {...}`)
- Test: `tests/liveV2.test.js`

**Interfaces:**
- Consumes: `createMatchState()` de `js/liveV2.js`.
- Produces: `fillSnapshotGaps(folded, snapshots, ctxById, now, staleMs = 180000) -> { states, statsById }`

- [ ] **Step 1: Write the failing tests**

Añade al final de `tests/liveV2.test.js`:

```js
const { fillSnapshotGaps } = liveV2;

test('fillSnapshotGaps añade un partido fresco que solo está en livematches', () => {
  const now = 1_000_000;
  const stats = { 10: { goles: 2 }, 20: { goles: 1 }, jugadores: [{ id: 7 }] };
  const folded = {
    states: { 1: { status: 'LIVE', score: { home: 1, away: 0 } } },
    statsById: { 1: { 10: { goles: 1 }, 20: { goles: 0 } } },
  };
  const snapshots = {
    2: { eventId: 2, status: 'LIVE', minute: 33, lastUpdated: new Date(now - 1000).toISOString(), stats },
  };
  const out = fillSnapshotGaps(folded, snapshots, { 2: { homeTeamId: 10, awayTeamId: 20 } }, now);
  assert.deepEqual(out.states[1], folded.states[1], 'no pisa el partido con eventos');
  assert.equal(out.states[2].status, 'LIVE');
  assert.deepEqual(out.states[2].score, { home: 2, away: 1 });
  assert.equal(out.states[2].lastMinute, 33);
  assert.equal(out.statsById[2], stats);
});

test('fillSnapshotGaps ignora snapshots viejos o sin stats', () => {
  const now = 1_000_000;
  const fresh = { eventId: 2, status: 'LIVE', lastUpdated: new Date(now - 1000).toISOString(), stats: { 10: { goles: 1 }, 20: { goles: 0 } } };
  const old = { ...fresh, lastUpdated: new Date(now - 181000).toISOString() };
  const noStats = { ...fresh, stats: null };
  const out = fillSnapshotGaps({ states: {}, statsById: {} }, { 2: old, 3: noStats }, {}, now);
  assert.deepEqual(out.states, {});
  assert.deepEqual(out.statsById, {});
});

test('fillSnapshotGaps usa las claves de stats si falta contexto', () => {
  const now = 1_000_000;
  const stats = { 10: { goles: 0 }, 20: { goles: 3 }, jugadores: [] };
  const out = fillSnapshotGaps({ states: {}, statsById: {} }, {
    2: { eventId: 2, status: 'FT', minute: 90, lastUpdated: new Date(now).toISOString(), stats },
  }, {}, now);
  assert.deepEqual(out.states[2].score, { home: 0, away: 3 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/liveV2.test.js`
Expected: FAIL con `fillSnapshotGaps is not a function`.

- [ ] **Step 3: Implement the pure function**

En `js/liveV2.js`, antes de `const liveV2Api = {...}`, añade:

```js
  const SNAPSHOT_STALE_MS = 3 * 60 * 1000;
  const SNAPSHOT_STATUSES = new Set(['NS', 'LIVE', 'HT', 'FT']);

  function snapshotSideIds(snap, ctx) {
    const home = ctx && ctx.homeTeamId != null ? String(ctx.homeTeamId) : null;
    const away = ctx && ctx.awayTeamId != null ? String(ctx.awayTeamId) : null;
    if (home != null && away != null) return { homeId: home, awayId: away };
    const ids = Object.keys(snap.stats || {}).filter(k => k !== 'jugadores');
    return { homeId: ids[0] == null ? null : ids[0], awayId: ids[1] == null ? null : ids[1] };
  }

  function snapshotGoals(stats, teamId) {
    const n = Number(stats && stats[teamId] && stats[teamId].goles);
    return Number.isFinite(n) ? n : 0;
  }

  function snapshotGapState(snap, ctx) {
    if (!snap || !snap.stats || typeof snap.stats !== 'object') return null;
    if (!SNAPSHOT_STATUSES.has(snap.status)) return null;
    const { homeId, awayId } = snapshotSideIds(snap, ctx);
    if (homeId == null || awayId == null) return null;
    const state = createMatchState();
    state.status = snap.status;
    state.score = { home: snapshotGoals(snap.stats, homeId), away: snapshotGoals(snap.stats, awayId) };
    const minute = Number(snap.minute);
    state.lastMinute = Number.isFinite(minute) ? minute : null;
    return state;
  }

  /**
   * Añade snapshots frescos solo para partidos sin eventos. No modifica los
   * estados existentes: `livematches` nunca pisa un partido que ya tiene log.
   */
  function fillSnapshotGaps(folded, snapshots, ctxById, now, staleMs) {
    const base = folded || { states: {}, statsById: {} };
    const out = {
      states: { ...(base.states || {}) },
      statsById: { ...(base.statsById || {}) },
    };
    const at = now == null ? Date.now() : now;
    const maxAge = staleMs == null ? SNAPSHOT_STALE_MS : staleMs;
    for (const [id, snap] of Object.entries(snapshots || {})) {
      if (out.states[id]) continue;
      if (!snap || !snap.stats) continue;
      const updated = new Date(snap.lastUpdated || 0).getTime();
      if (!Number.isFinite(updated) || at - updated > maxAge) continue;
      const state = snapshotGapState(snap, (ctxById || {})[id]);
      if (!state) continue;
      out.states[id] = state;
      out.statsById[id] = snap.stats;
    }
    return out;
  }
```

Añade `fillSnapshotGaps` al objeto `liveV2Api`:

```js
  const liveV2Api = { createMatchState, applyEvent, escapeHtml, newPlayer, matchClockAt, minutesOf, sortEvents, foldMatch, foldAll, stateAt, eventKey, wantSimSource, matchStateToStats, fillSnapshotGaps, rankRows, reasonLabel, liveV2ReasonForEvent, feedLabel, flipDelta, FEED_TYPES, formatMinute, feedEventView, feedEvents, feedEventsForMatch };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/liveV2.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `node --check js/liveV2.js`
Expected: sin salida. No commit.

---

### Task 4: Integrar los huecos en el Live y el modal

**Files:**
- Modify: `js/live-v2-ui.js:664-677` (`liveV2Folded`)
- Modify: `js/live-v2-ui.js:749-785` (`liveV2MatchBreakdown`)
- Modify: `js/live-v2-ui.js` exports
- Modify: `index.html` (cache-busters)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `fillSnapshotGaps` de Task 3.
- Produces: `liveV2Folded()` exportado para tests.

- [ ] **Step 1: Write the failing test**

Añade a `tests/liveV2Ui.test.js`:

```js
test('liveV2Folded rellena un partido que solo está en livematches', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const now = Date.now();
  const stats = { 10: { goles: 2 }, 20: { goles: 1 }, jugadores: [] };
  const AppState = {
    currentUser: { name: 'me' },
    appConfig: { faseJuego: 'FASE_LIGA' },
    liveV2: {
      events: [],
      _liveSnapshots: {
        2: { eventId: 2, status: 'LIVE', minute: 33, lastUpdated: new Date(now).toISOString(), stats },
      },
    },
    matches: [{ id: 2, homeTeamId: 10, awayTeamId: 20 }],
    allPlayers: [],
  };
  ui.init({ AppState, liveV2Api: liveV2 });
  const folded = ui.liveV2Folded();
  assert.equal(folded.states[2].status, 'LIVE');
  assert.deepEqual(folded.states[2].score, { home: 2, away: 1 });
  assert.equal(folded.statsById[2], stats);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL con `ui.liveV2Folded is not a function`.

- [ ] **Step 3: Apply gaps in `liveV2Folded`**

Sustituye el retorno de `liveV2Folded` por:

```js
function liveV2Folded() {
  if (typeof liveV2Api === 'undefined') return { states: {}, statsById: {} };
  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const states = liveV2Api.foldAll(st.events, ctxById);
  const statsById = {};
  const playhead = liveV2PlayheadMs(st);
  for (const [id, s] of Object.entries(states)) {
    const ctx = { ...(ctxById[id] || {}), playersById };
    statsById[id] = liveV2Api.matchStateToStats(s, ctx, playhead);
  }
  const folded = { states, statsById };
  return typeof liveV2Api.fillSnapshotGaps === 'function'
    ? liveV2Api.fillSnapshotGaps(folded, st._liveSnapshots || {}, ctxById, Date.now())
    : folded;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Use `statsById` in the match modal**

Sustituye el inicio de `liveV2MatchBreakdown` por:

```js
function liveV2MatchBreakdown(eventId, state) {
  const me = AppState.currentUser && AppState.currentUser.name;
  const match = (AppState.matches || []).find(m => String(m.id) === String(eventId));
  const id = match ? match.id : eventId;
  const meta = liveMatchMeta({ eventId: id });
  const status = (state && state.status) || 'NS';
  const folded = liveV2Folded();
  let stats = (folded.statsById && folded.statsById[id]) || null;
  if (!stats && status !== 'NS' && state && typeof liveV2Api !== 'undefined' && liveV2Api.matchStateToStats) {
    const ctx = { ...(liveV2CtxById()[id] || {}), playersById: liveV2PlayersById() };
    stats = liveV2Api.matchStateToStats(state, ctx, liveV2PlayheadMs(liveV2State()));
  }
  const lm = { eventId: id, stats, status };
```

Y cambia la llamada del feed para reutilizar `folded`:

```js
  const events = (typeof liveV2Api !== 'undefined' && liveV2Api.feedEventsForMatch)
    ? liveV2Api.feedEventsForMatch(
        liveV2State().events || [], id,
        liveV2FeedCtxById(folded),
        liveV2PlayersById(), { includeSeed: true })
    : [];
```

- [ ] **Step 6: Export `liveV2Folded` and bump cache-busters**

Añade al objeto de exports:

```js
    liveV2Folded,
```

En `index.html`, sube las versiones:

```html
  <script src="js/liveV2.js?v=14"></script>
  <script src="js/live-v2-ui.js?v=28"></script>
```

- [ ] **Step 7: Run the Live tests**

Run: `node --test tests/liveV2.test.js tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 8: Checkpoint**

Run: `node --check js/liveV2.js js/live-v2-ui.js`
Expected: sin salida. No commit.

---

### Task 5: Verificación completa de ambos repos

**Files:**
- No code changes.

- [ ] **Step 1: Run all `porra-spa` tests**

Run: `node --test tests/*.test.js`
Expected: todos PASS, 0 fail.

- [ ] **Step 2: Run all `api-porra` tests**

Run (workdir `api-porra`): `node --test tests/*.test.js`
Expected: todos PASS, 0 fail, incluidos los tests de `findGoalToCancel` y gol en propia.

- [ ] **Step 3: Syntax check**

Run: `node --check js/liveV2.js js/live-v2-ui.js` en `porra-spa`.
Expected: sin salida.

- [ ] **Step 4: Manual smoke test (local)**

Run: `node server.mjs` en `porra-spa` y abrir `http://localhost:3000` con `?liveSim=1`.
Expected: Live muestra partidos simulados; al recargar no reaparecen claves `porra_live_events_v1*` ni de otros días/source/fase en `localStorage`.

- [ ] **Step 5: Checkpoint final**

Run: `git status --short`
Expected: solo cambios intencionados (`js/liveV2.js`, `js/live-v2-ui.js`, `index.html`, tests, docs). No commit sin petición.
