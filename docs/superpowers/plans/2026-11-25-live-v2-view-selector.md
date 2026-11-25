# Selector de vistas del Live v2 (Total / Jornada / En juego) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al tab Live v2 un selector de tres vistas (🏆 Total, 📅 Jornada, ⚡ En juego) con re-ordenación de la clasificación y desglose propio por vista.

**Architecture:** Todo en cliente, en `js/live-v2-ui.js` (IIFE con deps inyectadas vía `liveV2Ui.init`). Se extiende `liveV2Rows()` para calcular tres métricas por fila, se añade detección pura de la ronda en curso (`liveV2CurrentRoundKey`), una caché de puntos consolidados por ronda (`liveV2JornadaOfficial`, patrón de `liveOfficialRows`) y un segmented control dentro de la barra de desglose. Sin cambios de backend.

**Tech Stack:** Vanilla ES6+, CSS vanilla con variables de `:root`, tests `node --test` (Node ≥ 20).

**Spec:** `docs/superpowers/specs/2026-11-25-live-v2-view-selector-design.md` (leerlo antes de empezar).

## Global Constraints

- Cache-busting obligatorio (AGENTS.md): al terminar, `index.html` debe subir `js/live-v2-ui.js?v=33`, `css/styles.css?v=141`, `js/main.js?v=185`.
- Zona táctil: botones con `min-height:44px` (AGENTS.md §2). Los pills del seg usan `min-height:44px` + anchura ~36px en strip continua (segmented control estándar; garantiza que quepan en 390px sin wrap).
- Reutilizar variables CSS de `:root` (`--ucl-surface`, `--accent-primary`, `--border-color`, `--text-muted`); sin frameworks.
- No lanzar excepciones en consola; `overflow-x: hidden` respetado (el seg no debe provocar scroll horizontal en 390px).
- Tests: `node --test tests/*.test.js` debe pasar completo al final.
- Convención del módulo: funciones nuevas se añaden a la IIFE de `js/live-v2-ui.js` y se exportan en el objeto `api` final (línea ~2419). No se usa `export`/import; `module.exports` global al final del IIFE.
- Comentarios solo en español y solo donde el código existente los usa (docstrings de una línea); el resto sin comentarios.

## Contexto esencial (leer antes de cada task)

`js/live-v2-ui.js` (2508 líneas). Puntos de anclaje actuales:

| Qué | Dónde |
|---|---|
| `init(deps)` (deps inyectadas: `AppState`, `visiblePlayers`, `getUserTotalRealPoints`, `calculateMatchPoints`, `calculatePlayerMatchPoints`, ...) | líneas 10-35 |
| `liveState()` (caché en `AppState.live`, usa `liveOfficialRows`) | línea 286 |
| `liveUserMatchPoints(username, lm, meta)` → `{ matchPts, breakdown, squadPts, squadDetail, total }` | línea 305 |
| `liveOfficialRows()` (caché con `officialStatsRef` / `officialPredTime`) | línea 373 |
| `liveV2State()` (init del singleton `AppState.liveV2`) | línea 550 |
| `liveV2FinalizedIds()` (Set de eventIds con matchStats) | línea 875 |
| `liveV2Rows(folded)` → filas + `rankRows` | líneas 882-905 |
| `liveV2HeaderBreakdown(folded)` → `{ total, predictionPts, squadPts }` | líneas 1724-1742 |
| `renderLiveV2Html(rows, folded)` | líneas 1751-1777 |
| `updateLiveV2Dom(rows, folded)` (poll incremental; breakdown en línea ~2193) | líneas 2100-2219 |
| `pollLiveV2()` (alimenta `st.prevRanks` desde `st._lastRows`) | líneas 2361-2390 |
| `renderLiveV2Tab()` (resetea `st.prevRanks = null` al entrar) | líneas 2393-2417 |
| objeto `api` (exportaciones) | líneas 2419-2504 |

`js/main.js`: binding del tab en líneas 2096-2099 (`liveV2Ui.bindLiveV2Chips(container); liveV2Ui.bindLiveV2Rows(container);`). `css/styles.css`: estilos `livev2*` en líneas 7282-7937.

Patrón de tests: `tests/liveV2Ui.test.js` — `freshUi()` (reset de `require.cache`), `ui.init({ AppState: {...}, liveV2Api: require('../js/liveV2.js'), calculateMatchPoints: mock, calculatePlayerMatchPoints: mock, ... })`, aserciones sobre funciones puras/HTML.

---

### Task 1: Detección de la ronda en curso (`liveV2CurrentRoundKey`)

**Files:**
- Modify: `js/live-v2-ui.js` (nueva función cerca de `liveV2FinalizedIds`, línea ~875; export en `api`)
- Test: `tests/liveV2Views.test.js` (crear)

**Interfaces:**
- Consumes: nada nuevo (solo `AppState.matches`, `AppState.matchStats`, `folded.states` pasados como args → función pura).
- Produces: `liveV2CurrentRoundKey(matches, matchStats, foldedStates)` → `{ fase: string, ronda: number|string } | null`. La consumen Tasks 2, 3, 4, 5.

- [ ] **Step 1: Write the failing test** — crear `tests/liveV2Views.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

function freshUi() {
  const file = require.resolve('../js/live-v2-ui.js');
  delete require.cache[file];
  return require('../js/live-v2-ui.js');
}

test('liveV2CurrentRoundKey: gana la ronda con mas partidos en juego', () => {
  const ui = freshUi();
  const matches = [
    { id: 101, fase: 'liga', ronda: 3, fechaTs: 100 },
    { id: 102, fase: 'liga', ronda: 3, fechaTs: 100 },
    { id: 103, fase: 'liga', ronda: 2, fechaTs: 50 },
  ];
  const states = {
    101: { status: 'LIVE' }, 102: { status: 'HT' }, 103: { status: 'LIVE' },
  };
  assert.deepEqual(ui.liveV2CurrentRoundKey(matches, [], states), { fase: 'liga', ronda: 3 });
});

test('liveV2CurrentRoundKey: sin estados cae al ultimo matchStats por fecha', () => {
  const ui = freshUi();
  const matches = [
    { id: 101, fase: 'liga', ronda: 2, fechaTs: 100 },
    { id: 102, fase: 'liga', ronda: 3, fechaTs: 200 },
  ];
  const matchStats = [{ eventId: 101 }, { eventId: 102 }];
  assert.deepEqual(ui.liveV2CurrentRoundKey(matches, matchStats, {}), { fase: 'liga', ronda: 3 });
});

test('liveV2CurrentRoundKey: sin estados ni matchStats cae a partidos de hoy', () => {
  const ui = freshUi();
  const hoy = Math.floor(Date.now() / 1000);
  const ayer = hoy - 86400;
  const matches = [
    { id: 101, fase: 'liga', ronda: 1, fechaTs: ayer },
    { id: 102, fase: 'liga', ronda: 4, fechaTs: hoy },
  ];
  assert.deepEqual(ui.liveV2CurrentRoundKey(matches, [], {}), { fase: 'liga', ronda: 4 });
});

test('liveV2CurrentRoundKey: sin nada devuelve null', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2CurrentRoundKey([], [], {}), null);
  assert.equal(ui.liveV2CurrentRoundKey([], [], null), null);
  assert.equal(ui.liveV2CurrentRoundKey(null, null, null), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Views.test.js`
Expected: FAIL — `ui.liveV2CurrentRoundKey is not a function` (o `TypeError` similar).

- [ ] **Step 3: Write minimal implementation** — en `js/live-v2-ui.js`, después de `liveV2FinalizedIds()` (~línea 879):

```javascript
/** Clave de ronda de un partido del calendario (liga o eliminatorias). */
function liveV2MatchRoundKey(match) {
  if (!match) return null;
  return { fase: match.fase || 'liga', ronda: match.ronda != null ? match.ronda : 0 };
}

function liveV2SameRoundKey(a, b) {
  return !!a && !!b && String(a.fase) === String(b.fase) && String(a.ronda) === String(b.ronda);
}

/** Ronda en curso: mayoria de partidos no-NS; fallback ultimo matchStats; fallback hoy. */
function liveV2CurrentRoundKey(matches, matchStats, foldedStates) {
  const ms = Array.isArray(matches) ? matches : [];
  const byId = new Map(ms.map(m => [String(m.id), m]));
  const counts = new Map();
  for (const [id, state] of Object.entries(foldedStates || {})) {
    if (!state || state.status === 'NS') continue;
    const m = byId.get(String(id));
    if (!m) continue;
    const key = `${m.fase || 'liga'}|${m.ronda}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (counts.size) {
    let best = null, bestN = -1;
    for (const [key, n] of counts) { if (n > bestN) { bestN = n; best = key; } }
    const [fase, ronda] = best.split('|');
    return { fase, ronda: ronda === 'null' ? 0 : (Number.isFinite(Number(ronda)) ? Number(ronda) : ronda) };
  }
  const stats = Array.isArray(matchStats) ? matchStats : [];
  let last = null, lastTs = -Infinity;
  for (const s of stats) {
    const m = byId.get(String(s.eventId));
    if (!m || !isFinite(m.fechaTs)) continue;
    if (m.fechaTs > lastTs) { lastTs = m.fechaTs; last = m; }
  }
  if (last) return liveV2MatchRoundKey(last);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = dayStart.getTime() + 86400000;
  for (const m of ms) {
    if (!isFinite(m.fechaTs)) continue;
    const at = m.fechaTs * 1000;
    if (at >= dayStart.getTime() && at < dayEnd) return liveV2MatchRoundKey(m);
  }
  return null;
}
```

Y añadir al objeto `api` (línea ~2419): `liveV2CurrentRoundKey,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Views.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Views.test.js
git commit -m "feat(live): detecta la ronda en curso para la vista Jornada"
```

---

### Task 2: Puntos consolidados de la ronda con caché (`liveV2JornadaOfficial`)

**Files:**
- Modify: `js/live-v2-ui.js` (nueva función tras `liveV2CurrentRoundKey`; export en `api`)
- Test: `tests/liveV2Views.test.js` (añadir tests al final)

**Interfaces:**
- Consumes: `liveV2CurrentRoundKey` (Task 1), `liveUserMatchPoints`, `liveState()`.
- Produces: `liveV2JornadaOfficial(roundKey, users)` → `{ [name]: { pred: number, squad: number, total: number } }`. Caché en `AppState.live` (`liveState()`) invalidada por (roundKey, `AppState.matchStats` ref, `AppState._allPredictionsTime`, `AppState.squadsCache` ref). La consumen Tasks 3 y 4.

- [ ] **Step 1: Write the failing test** — añadir a `tests/liveV2Views.test.js`:

```javascript
function jornadaFixture() {
  const ui = freshUi();
  const AppState = {
    currentUser: { name: 'me' },
    live: {},
    liveV2: null,
    matches: [
      { id: 101, fase: 'liga', ronda: 3, fechaTs: 100, homeTeamId: 1, awayTeamId: 2 },
      { id: 104, fase: 'liga', ronda: 2, fechaTs: 50, homeTeamId: 7, awayTeamId: 8 },
    ],
    matchStats: [
      { eventId: 101, stats: { 1: { goles: 2 }, 2: { goles: 0 } } },
      { eventId: 104, stats: { 7: { goles: 1 }, 8: { goles: 1 } } },
    ],
    allPredictions: {
      me: { 101: { home: 2, away: 0 }, 104: { home: 1, away: 1 } },
      ana: { 101: { home: 1, away: 1 } },
    },
    squadsCache: {},
    _allPredictionsTime: 1,
  };
  ui.init({
    AppState,
    liveV2Api: { escapeHtml: s => String(s) },
    calculateMatchPoints: (pred) => ({ points: pred && pred.home != null ? pred.home * 2 : 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  return { ui, AppState };
}

test('liveV2JornadaOfficial solo suma matchStats de la ronda pedida', () => {
  const { ui } = jornadaFixture();
  const round = { fase: 'liga', ronda: 3 };
  const out = ui.liveV2JornadaOfficial(round, ['me', 'ana']);
  // me: 101 (ronda 3) pred.home=2 -> mock 4 puntos; 104 (ronda 2) NO cuenta
  assert.deepEqual(out.me, { pred: 4, squad: 0, total: 4 });
  assert.deepEqual(out.ana, { pred: 2, squad: 0, total: 2 });
});

test('liveV2JornadaOfficial con roundKey null devuelve ceros', () => {
  const { ui } = jornadaFixture();
  assert.deepEqual(ui.liveV2JornadaOfficial(null, ['me']).me, { pred: 0, squad: 0, total: 0 });
});

test('liveV2JornadaOfficial cachea y se invalida al cambiar matchStats', () => {
  const { ui, AppState } = jornadaFixture();
  const round = { fase: 'liga', ronda: 3 };
  const first = ui.liveV2JornadaOfficial(round, ['me']);
  const second = ui.liveV2JornadaOfficial(round, ['me']);
  assert.equal(first, second, 'misma referencia mientras no cambien los datos');
  AppState.matchStats = [{ eventId: 101, stats: { 1: { goles: 1 }, 2: { goles: 0 } } }];
  const third = ui.liveV2JornadaOfficial(round, ['me']);
  assert.notEqual(first, third, 'se recalcula al cambiar la ref de matchStats');
  assert.equal(third.me.total, 4, 'pred.home sigue siendo 2 -> 4 puntos');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Views.test.js`
Expected: FAIL en los 3 tests nuevos (`ui.liveV2JornadaOfficial is not a function`).

- [ ] **Step 3: Write minimal implementation** — en `js/live-v2-ui.js`, tras `liveV2CurrentRoundKey`:

```javascript
/** Puntos consolidados (pron. + plantilla) de una ronda, por usuario, con cache. */
function liveV2JornadaOfficial(roundKey, users) {
  const ls = liveState();
  const key = roundKey ? `${roundKey.fase}|${roundKey.ronda}` : null;
  const canCache = key != null && Array.isArray(AppState.matchStats)
    && AppState._allPredictionsTime != null;
  if (canCache && ls.jornadaRows && ls.jornadaRoundKey === key
    && ls.jornadaStatsRef === AppState.matchStats
    && ls.jornadaPredTime === AppState._allPredictionsTime
    && ls.jornadaSquadsRef === AppState.squadsCache) return ls.jornadaRows;
  const out = {};
  if (canCache) {
    const roundMatchIds = new Set(
      (AppState.matches || [])
        .filter(m => liveV2SameRoundKey(liveV2MatchRoundKey(m), roundKey))
        .map(m => String(m.id))
    );
    const subset = (AppState.matchStats || [])
      .filter(ms => roundMatchIds.has(String(ms.eventId)));
    for (const name of users) {
      let pred = 0, squad = 0;
      for (const ms of subset) {
        const lm = { eventId: ms.eventId, stats: ms.stats, status: 'FT' };
        const r = liveUserMatchPoints(name, lm, liveMatchMeta(lm));
        pred += r.matchPts;
        squad += r.squadPts;
      }
      out[name] = { pred, squad, total: pred + squad };
    }
  } else {
    for (const name of users) out[name] = { pred: 0, squad: 0, total: 0 };
  }
  ls.jornadaRows = out;
  ls.jornadaRoundKey = key;
  ls.jornadaStatsRef = AppState.matchStats;
  ls.jornadaPredTime = AppState._allPredictionsTime;
  ls.jornadaSquadsRef = AppState.squadsCache;
  return out;
}
```

Export en `api`: `liveV2JornadaOfficial,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Views.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Views.test.js
git commit -m "feat(live): puntos consolidados por ronda con cache (vista Jornada)"
```

---

### Task 3: Métricas por vista en `liveV2Rows`

**Files:**
- Modify: `js/live-v2-ui.js`: `liveV2State()` (añadir `viewMode: 'total'`, línea ~553), nueva `liveV2ViewMode()`, reescritura de `liveV2Rows()` (líneas 882-905), export en `api`.
- Modify: `js/main.js:54` — ampliar comentario del campo `liveV2` con `viewMode`.
- Test: `tests/liveV2Views.test.js` (añadir)

**Interfaces:**
- Consumes: Task 1 (`liveV2CurrentRoundKey`) y Task 2 (`liveV2JornadaOfficial`).
- Produces:
  - `liveV2ViewMode()` → `'total' | 'jornada' | 'enjuego'` (lectura sin crear estado).
  - `liveV2Rows(folded)` → filas con `{ name, avatar, isMe, officialPoints, delta, deltaInPlay, deltaRonda, jornadaOfficial, livePoints, rank, delta }`, donde `livePoints` es la métrica de la vista activa y el orden (`rankRows`) sigue esa métrica.

- [ ] **Step 1: Write the failing test** — añadir a `tests/liveV2Views.test.js`:

```javascript
function viewsFixture() {
  const ui = freshUi();
  const AppState = {
    currentUser: { name: 'me' },
    live: {},
    liveV2: null,
    matches: [
      { id: 101, fase: 'liga', ronda: 3, fechaTs: 100, homeTeamId: 1, awayTeamId: 2 },
      { id: 102, fase: 'liga', ronda: 3, fechaTs: 100, homeTeamId: 3, awayTeamId: 4 },
      { id: 103, fase: 'liga', ronda: 3, fechaTs: 200, homeTeamId: 5, awayTeamId: 6 },
      { id: 104, fase: 'liga', ronda: 2, fechaTs: 50, homeTeamId: 7, awayTeamId: 8 },
    ],
    // 101 consolidado (ronda 3); 104 consolidado (ronda 2) -> cuenta en total, NO en jornada
    matchStats: [
      { eventId: 101, stats: { 1: { goles: 2 }, 2: { goles: 0 } } },
      { eventId: 104, stats: { 7: { goles: 1 }, 8: { goles: 1 } } },
    ],
    allPredictions: {
      me: { 101: { home: 2, away: 0 }, 102: { home: 0, away: 0 }, 103: { home: 1, away: 0 }, 104: { home: 1, away: 1 } },
      ana: { 101: { home: 1, away: 1 }, 102: { home: 0, away: 0 }, 103: { home: 0, away: 0 }, 104: { home: 0, away: 0 } },
    },
    squadsCache: {},
    _allPredictionsTime: 1,
  };
  ui.init({
    AppState,
    liveV2Api: require('../js/liveV2.js'),
    visiblePlayers: () => [
      { name: 'me', avatar: '😎' },
      { name: 'ana', avatar: '🦊' },
    ],
    getUserTotalRealPoints: (name) => (name === 'me' ? 100 : 50),
    calculateMatchPoints: (pred) => ({ points: pred && pred.home != null ? pred.home * 2 : 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  AppState.liveV2 = ui.liveV2State(); // estado real: los tests mutan viewMode sobre él
  // Estados live: 102 FT sin consolidar (ronda 3) y 103 LIVE (ronda 3)
  const folded = {
    states: {
      102: { status: 'FT', score: { home: 0, away: 0 } },
      103: { status: 'LIVE', score: { home: 1, away: 0 } },
    },
    statsById: {
      102: { 3: { goles: 0 }, 4: { goles: 0 } },
      103: { 5: { goles: 1 }, 6: { goles: 0 } },
    },
  };
  return { ui, AppState, folded };
}

test('liveV2ViewMode devuelve total por defecto y valida el valor', () => {
  const { ui, AppState } = viewsFixture();
  assert.equal(ui.liveV2ViewMode(), 'total');
  AppState.liveV2.viewMode = 'jornada';
  assert.equal(ui.liveV2ViewMode(), 'jornada');
  AppState.liveV2.viewMode = 'bogus';
  assert.equal(ui.liveV2ViewMode(), 'total');
});

test('liveV2Rows vista total: consolidados + delta (comportamiento actual)', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'total';
  const rows = ui.liveV2Rows(folded);
  const me = rows.find(r => r.name === 'me');
  // oficial 100 + delta (102: pred.home 0 -> 0; 103: pred.home 1 -> 2) = 102
  assert.equal(me.livePoints, 102);
  assert.equal(me.officialPoints, 100);
  assert.equal(me.delta, 2);
  assert.equal(rows[0].name, 'me');
});

test('liveV2Rows vista jornada: consolidados de la ronda + delta de la ronda', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'jornada';
  const rows = ui.liveV2Rows(folded);
  const me = rows.find(r => r.name === 'me');
  // jornadaOfficial: 101 (ronda 3) pred.home 2 -> 4; 104 (ronda 2) excluido
  // deltaRonda: 102 (FT sin consolidar, ronda 3) 0 + 103 (LIVE, ronda 3) 2
  assert.equal(me.jornadaOfficial, 4);
  assert.equal(me.deltaRonda, 2);
  assert.equal(me.livePoints, 6);
  const ana = rows.find(r => r.name === 'ana');
  // ana: 101 pred.home 1 -> 2; 102 0; 103 0 => jornada 2
  assert.equal(ana.livePoints, 2);
  assert.equal(rows[0].name, 'me');
});

test('liveV2Rows vista enjuego: solo partidos LIVE/HT', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'enjuego';
  const rows = ui.liveV2Rows(folded);
  const me = rows.find(r => r.name === 'me');
  // solo 103 (LIVE): 2 puntos; 102 es FT sin consolidar y NO cuenta
  assert.equal(me.livePoints, 2);
  assert.equal(me.deltaInPlay, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Views.test.js`
Expected: FAIL en los 3 tests nuevos (viewMode undefined, `livePoints` sin split).

- [ ] **Step 3: Write minimal implementation**

3a. `liveV2State()` (línea ~553) — añadir `viewMode: 'total',` al objeto literal (primera línea de propiedades).

3b. Nueva función junto a `liveV2JornadaOfficial`:

```javascript
const LIVEV2_VIEWS = ['total', 'jornada', 'enjuego'];

function liveV2ViewMode() {
  const v = AppState.liveV2 && AppState.liveV2.viewMode;
  return LIVEV2_VIEWS.indexOf(v) >= 0 ? v : 'total';
}
```

3c. Sustituir `liveV2Rows(folded)` (líneas 882-905) por:

```javascript
/** Filas con metrica de la vista activa: total / jornada / en juego. */
function liveV2Rows(folded) {
  const st = liveV2State();
  const view = liveV2ViewMode();
  const official = liveOfficialRows();
  const officialByName = {};
  for (const r of official) officialByName[r.name] = r.officialPoints;
  const finalized = liveV2FinalizedIds();
  const players = visiblePlayers();
  const me = AppState.currentUser && AppState.currentUser.name;
  const roundKey = view === 'jornada'
    ? liveV2CurrentRoundKey(AppState.matches, AppState.matchStats, (folded && folded.states) || {})
    : null;
  const jornada = view === 'jornada'
    ? liveV2JornadaOfficial(roundKey, players.map(p => p.name))
    : null;
  const rows = players.map(pl => {
    let delta = 0, deltaInPlay = 0, deltaRonda = 0;
    for (const id of Object.keys(folded.statsById || {})) {
      if (finalized.has(String(id))) continue; // ya cuenta en los puntos oficiales
      const match = (AppState.matches || []).find(m => String(m.id) === String(id));
      const state = folded.states[id];
      const status = state?.status || 'NS';
      if (status === 'NS') continue;
      const lm = { eventId: match ? match.id : id, stats: folded.statsById[id], status };
      const r = liveUserMatchPoints(pl.name, lm, liveMatchMeta(lm));
      delta += r.total;
      if (status === 'LIVE' || status === 'HT') deltaInPlay += r.total;
      if (roundKey && match && liveV2SameRoundKey(liveV2MatchRoundKey(match), roundKey)) deltaRonda += r.total;
    }
    const officialPoints = officialByName[pl.name] || 0;
    const jo = (jornada && jornada[pl.name]) || { total: 0 };
    const row = {
      name: pl.name, avatar: pl.avatar, isMe: pl.name === me,
      officialPoints, delta, deltaInPlay, deltaRonda,
      jornadaOfficial: jo.total,
    };
    row.livePoints = view === 'total' ? officialPoints + delta
      : view === 'jornada' ? jo.total + deltaRonda
      : deltaInPlay;
    return row;
  });
  return liveV2Api.rankRows(rows, st.prevRanks);
}
```

Nota: la última línea (`rankRows(rows, st.prevRanks)`) es idéntica a la actual; `pollLiveV2` sigue alimentando `st.prevRanks` desde `st._lastRows` (vista activa), y el cambio de vista resetea el baseline (Task 6).

3d. Export en `api`: `liveV2ViewMode,`.

3e. `js/main.js:54` — actualizar el comentario del campo:

```javascript
  liveV2: null, // estado del tab Live v2 (event-sourcing): { events, serverTime, prevRanks, polling, _lastRows, viewMode }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Views.test.js && node --test tests/liveV2Ui.test.js`
Expected: PASS (10 nuevos + suite existente sin regresiones; los tests actuales de `liveV2Rows`/`renderLiveV2Html` siguen en verde porque la vista por defecto es `total`).

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js js/main.js tests/liveV2Views.test.js
git commit -m "feat(live): metrica por vista (total/jornada/en juego) en liveV2Rows"
```

---

### Task 4: Desglose de cabecera por vista (`liveV2HeaderBreakdown`)

**Files:**
- Modify: `js/live-v2-ui.js`: `liveV2HeaderBreakdown(folded)` → `liveV2HeaderBreakdown(folded, view)` (líneas 1724-1742)
- Test: `tests/liveV2Views.test.js` (añadir)

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: `liveV2HeaderBreakdown(folded, view)` → `{ total, predictionPts, squadPts }` de **mi usuario** en la vista indicada (por defecto la activa). Callers actuales (`renderLiveV2Html`, `updateLiveV2Dom`) no cambian: sin segundo arg usan la vista activa.

- [ ] **Step 1: Write the failing test** — añadir a `tests/liveV2Views.test.js`:

```javascript
test('liveV2HeaderBreakdown por vista: total, jornada y en juego', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'total';
  // total (default): delta de partidos no consolidados (102 FT + 103 LIVE)
  const bt = ui.liveV2HeaderBreakdown(folded);
  assert.deepEqual(bt, { total: 2, predictionPts: 2, squadPts: 0 });

  // jornada: consolidados de la ronda 3 (101 -> 4) + delta de la ronda (102 + 103)
  const bj = ui.liveV2HeaderBreakdown(folded, 'jornada');
  assert.deepEqual(bj, { total: 6, predictionPts: 6, squadPts: 0 });

  // en juego: solo 103 (LIVE); 102 es FT sin consolidar y queda fuera
  const be = ui.liveV2HeaderBreakdown(folded, 'enjuego');
  assert.deepEqual(be, { total: 2, predictionPts: 2, squadPts: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Views.test.js`
Expected: FAIL — `liveV2HeaderBreakdown` devuelve `{ total: 2, ... }` también para 'jornada' (no distingue vistas).

- [ ] **Step 3: Write minimal implementation** — sustituir la función (líneas 1724-1742) por:

```javascript
/** Desglose de MIS puntos en la vista activa (o la indicada). */
function liveV2HeaderBreakdown(folded, view) {
  const out = { total: 0, predictionPts: 0, squadPts: 0 };
  const me = AppState.currentUser && AppState.currentUser.name;
  if (!me) return out;
  const v = view || (AppState.liveV2 ? liveV2ViewMode() : 'total');
  const finalized = liveV2FinalizedIds();
  if (v === 'jornada') {
    const roundKey = liveV2CurrentRoundKey(AppState.matches, AppState.matchStats, (folded && folded.states) || {});
    const jo = liveV2JornadaOfficial(roundKey, [me])[me] || { pred: 0, squad: 0 };
    out.predictionPts += jo.pred;
    out.squadPts += jo.squad;
    for (const [id, state] of Object.entries((folded && folded.states) || {})) {
      if (finalized.has(String(id))) continue;
      const status = (state && state.status) || 'NS';
      if (status === 'NS') continue;
      const match = (AppState.matches || []).find(m => String(m.id) === String(id));
      if (!match || !liveV2SameRoundKey(liveV2MatchRoundKey(match), roundKey)) continue;
      const lm = { eventId: match.id, stats: (folded.statsById || {})[id], status };
      const r = liveUserMatchPoints(me, lm, liveMatchMeta(lm));
      out.predictionPts += r.matchPts;
      out.squadPts += r.squadPts;
    }
    out.total = out.predictionPts + out.squadPts;
    return out;
  }
  for (const [id, state] of Object.entries((folded && folded.states) || {})) {
    if (finalized.has(String(id))) continue;
    const status = (state && state.status) || 'NS';
    if (status === 'NS') continue;
    if (v === 'enjuego' && status !== 'LIVE' && status !== 'HT') continue;
    const match = (AppState.matches || []).find(m => String(m.id) === String(id));
    if (!match) continue;
    const lm = { eventId: match.id, stats: (folded.statsById || {})[id], status };
    const r = liveUserMatchPoints(me, lm, liveMatchMeta(lm));
    out.predictionPts += r.matchPts;
    out.squadPts += r.squadPts;
    out.total += r.total;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Views.test.js && node --test tests/liveV2Ui.test.js`
Expected: PASS (los tests existentes de `liveV2HeaderBreakdown` con `AppState.liveV2` ausente caen a `'total'` — mismo comportamiento que hoy).

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Views.test.js
git commit -m "feat(live): desglose de cabecera por vista del selector"
```

---

### Task 5: Render del selector (HTML + CSS) y título de sección

**Files:**
- Modify: `js/live-v2-ui.js`: nuevas `liveV2SectionTitle()`, `liveV2ViewSegHtml(folded)`; `renderLiveV2Html` (líneas 1751-1777) — seg dentro de `#livev2-breakdown`, título con id; export en `api`.
- Modify: `css/styles.css` (añadir bloque tras los estilos `livev2` ~línea 7937)
- Test: `tests/liveV2Views.test.js` (añadir)

**Interfaces:**
- Consumes: Tasks 1-4 (`liveV2ViewMode`, `liveV2CurrentRoundKey`, `liveV2HasInPlay` ya existente).
- Produces:
  - `liveV2SectionTitle(view)` → `'Clasificación en vivo' | 'Jornada en vivo' | 'Partidos en vivo'` (sin segundo arg usa la vista activa).
  - `liveV2ViewSegHtml(folded)` → HTML del segmented control con `data-livev2-view` en cada botón, clase `on` en la activa y `disabled` según §3.5 del spec.
  - `renderLiveV2Html(rows, folded)` — misma firma; el DOM gana `#livev2-section-title` y `.livev2-viewseg` dentro de `#livev2-breakdown`.
  - Task 6 consume: `[data-livev2-view]`, `#livev2-section-title`, `updateLiveV2ViewChrome(root, folded)`.

- [ ] **Step 1: Write the failing test** — añadir a `tests/liveV2Views.test.js`:

```javascript
test('liveV2SectionTitle mapea cada vista', () => {
  const { ui, AppState } = viewsFixture();
  assert.equal(ui.liveV2SectionTitle('total'), 'Clasificación en vivo');
  assert.equal(ui.liveV2SectionTitle('jornada'), 'Jornada en vivo');
  assert.equal(ui.liveV2SectionTitle('enjuego'), 'Partidos en vivo');
  assert.equal(ui.liveV2SectionTitle(), 'Clasificación en vivo');
  AppState.liveV2.viewMode = 'jornada';
  assert.equal(ui.liveV2SectionTitle(), 'Jornada en vivo');
});

test('liveV2ViewSegHtml marca la vista activa y deshabilita segun datos', () => {
  const { ui, AppState, folded } = viewsFixture();
  // hay un partido LIVE y hay matchStats -> nada deshabilitado
  let html = ui.liveV2ViewSegHtml(folded);
  assert.match(html, /data-livev2-view="total"/);
  assert.match(html, /data-livev2-view="jornada"/);
  assert.match(html, /data-livev2-view="enjuego"/);
  assert.match(html, /class="livev2-viewseg-btn on"/);
  assert.doesNotMatch(html, /disabled/);

  // sin eventos ni partidos en juego: 'enjuego' deshabilitado
  AppState.liveV2.events = [];
  html = ui.liveV2ViewSegHtml({ states: {}, statsById: {} });
  assert.match(html, /data-livev2-view="enjuego"[^>]*disabled/);

  // sin ronda determinable: 'jornada' deshabilitado
  AppState.matches = [];
  AppState.matchStats = [];
  html = ui.liveV2ViewSegHtml({ states: {}, statsById: {} });
  assert.match(html, /data-livev2-view="jornada"[^>]*disabled/);
});

test('renderLiveV2Html incluye seg dentro del breakdown y titulo por vista', () => {
  const { ui, AppState, folded } = viewsFixture();
  const rows = ui.liveV2Rows(folded);
  AppState.liveV2.viewMode = 'total';
  let html = ui.renderLiveV2Html(rows, folded);
  assert.match(html, /<div class="livev2-breakdown" id="livev2-breakdown">/);
  assert.match(html, /livev2-viewseg/);
  assert.match(html, /id="livev2-section-title">Clasificación en vivo</);

  AppState.liveV2.viewMode = 'jornada';
  rows.splice(0, rows.length, ...ui.liveV2Rows(folded));
  html = ui.renderLiveV2Html(rows, folded);
  assert.match(html, /id="livev2-section-title">Jornada en vivo</);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Views.test.js`
Expected: FAIL — `liveV2SectionTitle`/`liveV2ViewSegHtml` no existen; `renderLiveV2Html` sin seg ni id de título.

- [ ] **Step 3: Write minimal implementation**

3a. En `js/live-v2-ui.js`, junto a `liveV2HeaderBreakdownHtml` (línea ~1748) añadir:

```javascript
const LIVEV2_VIEW_DEFS = [
  { key: 'total', icon: '🏆', title: 'Clasificación total', section: 'Clasificación en vivo' },
  { key: 'jornada', icon: '📅', title: 'Solo puntos de la jornada', section: 'Jornada en vivo' },
  { key: 'enjuego', icon: '⚡', title: 'Solo partidos en juego', section: 'Partidos en vivo' },
];

function liveV2SectionTitle(view) {
  const v = view || (AppState.liveV2 ? liveV2ViewMode() : 'total');
  const def = LIVEV2_VIEW_DEFS.find(d => d.key === v);
  return def ? def.section : 'Clasificación en vivo';
}

function liveV2ViewSegHtml(folded) {
  const view = liveV2ViewMode();
  const st = AppState.liveV2 || {};
  const hasEvents = (st.events || []).length > 0;
  const inPlay = liveV2HasInPlay(folded);
  const hasRound = !!liveV2CurrentRoundKey(AppState.matches, AppState.matchStats, (folded && folded.states) || {});
  const btn = (def, disabled) =>
    `<button type="button" class="livev2-viewseg-btn${def.key === view ? ' on' : ''}" data-livev2-view="${def.key}"`
    + ` title="${def.title}" aria-label="${def.title}"${disabled ? ' disabled' : ''}>${def.icon}</button>`;
  return `<div class="livev2-viewseg" role="tablist" aria-label="Vista de la clasificación">`
    + btn(LIVEV2_VIEW_DEFS[0], false)
    + btn(LIVEV2_VIEW_DEFS[1], !hasRound)
    + btn(LIVEV2_VIEW_DEFS[2], !hasEvents && !inPlay)
    + `</div>`;
}
```

3b. `renderLiveV2Html` (líneas 1751-1777): cambiar la línea del breakdown y la del título de sección:

```javascript
    + `<div class="livev2-breakdown" id="livev2-breakdown">${liveV2HeaderBreakdownHtml(breakdown)}${liveV2ViewSegHtml(folded)}</div>`
```
y
```javascript
    + `<div class="livev2-section-title" id="livev2-section-title">${liveV2Esc(liveV2SectionTitle())}</div>`
```

(el resto de la función queda igual).

3c. Export en `api`: `liveV2SectionTitle, liveV2ViewSegHtml,`.

3d. `css/styles.css` — añadir tras el último bloque `livev2` (~línea 7937, antes del bloque `.clasif-clas-toggle`):

```css
/* Selector de vistas del Live v2 (Total / Jornada / En juego) */
.livev2-viewseg {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--ucl-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 2px;
}

.livev2-viewseg-btn {
  min-width: 34px;
  min-height: 44px;
  padding: 0 7px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.05rem;
  line-height: 1;
  border-radius: var(--radius-full);
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s, background 0.2s, color 0.2s;
}

.livev2-viewseg-btn:active { transform: scale(0.92); }

.livev2-viewseg-btn.on {
  background: linear-gradient(135deg, var(--accent-primary), #059669);
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);
}

.livev2-viewseg-btn:disabled { opacity: 0.35; cursor: default; }

.livev2-viewseg-btn:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .livev2-viewseg-btn:active { transform: none; }
}
```

Nota de layout: `.livev2-breakdown` ya tiene `flex-wrap: wrap`; con `min-width:34px` los tres pills (~118px) + los tres items de texto (~225px) + gaps caben en 390px sin wrap. La altura 44px (norma táctil) hace la barra algo más alta que hoy: aceptado en el diseño.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Views.test.js && node --test tests/liveV2Ui.test.js`
Expected: PASS (incluye los tests existentes de `renderLiveV2Html`: solo añaden nodos, no rompen selectores previos).

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Views.test.js
git commit -m "feat(live): render del selector de vistas y titulo dinamico"
```

---

### Task 6: Interacción (cambio de vista) e integración en el ciclo render/poll

**Files:**
- Modify: `js/live-v2-ui.js`: nuevas `liveV2SetView(view, folded)`, `bindLiveV2Views(root)`, `updateLiveV2ViewChrome(root, folded)`; parches en `updateLiveV2Dom` (línea ~2193) y `renderLiveV2Tab` (línea ~2406); export en `api`.
- Modify: `js/main.js:~2098` — añadir `liveV2Ui.bindLiveV2Views(container);` junto a `bindLiveV2Rows`.
- Test: `tests/liveV2Views.test.js` (añadir)

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces:
  - `liveV2SetView(view, folded)` — cambia `st.viewMode`, recalcula filas (baseline reseteado: `pointsDiff=0`, flechas desde `st._rankMoves`), repinta `#livev2-rows` + título + seg + desglose. Sin fetch.
  - `bindLiveV2Views(root)` — listener delegado sobre `.livev2-viewseg` (patrón `bindLiveV2Chips`, guard `dataset.bound`).
  - `updateLiveV2ViewChrome(root, folded)` — parchea clase `on`/`disabled` de los pills y el texto del título; lo llaman `updateLiveV2Dom` y `liveV2SetView`.

- [ ] **Step 1: Write the failing test** — añadir a `tests/liveV2Views.test.js`:

```javascript
test('liveV2SetView cambia la vista y recalcula filas sin fetch', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2._lastRows = [];
  ui.liveV2SetView('jornada', folded);
  assert.equal(AppState.liveV2.viewMode, 'jornada');
  const snap = AppState.liveV2._lastRows;
  assert.ok(Array.isArray(snap) && snap.length === 2);
  const me = snap.find(r => r.name === 'me');
  assert.equal(me.livePoints, 6, 'metrica jornada del task 3');
  assert.equal(me.rank, 1);
  // baseline reseteado: sin DOM, liveV2SetView solo actualiza estado
  ui.liveV2SetView('enjuego', folded);
  assert.equal(AppState.liveV2.viewMode, 'enjuego');
  const me2 = AppState.liveV2._lastRows.find(r => r.name === 'me');
  assert.equal(me2.livePoints, 2);
});

test('liveV2SetView ignora vistas invalidas y no hace nada si es la activa', () => {
  const { ui, AppState, folded } = viewsFixture();
  ui.liveV2SetView('bogus', folded);
  assert.equal(AppState.liveV2.viewMode, 'total');
  const before = AppState.liveV2._lastRows;
  ui.liveV2SetView('total', folded);
  assert.equal(AppState.liveV2.viewMode, 'total');
  assert.equal(AppState.liveV2._lastRows, before, 'misma vista: no recalcula');
});

test('updateLiveV2ViewSeg chrome: el seg y el titulo siguen a la vista activa', () => {
  const { ui, AppState, folded } = viewsFixture();
  // smoke string: el seg html refleja la vista activa tras cambiarla
  AppState.liveV2.viewMode = 'jornada';
  const html = ui.liveV2ViewSegHtml(folded);
  assert.match(html, /data-livev2-view="jornada"[^>]*class="livev2-viewseg-btn on"|class="livev2-viewseg-btn on"[^>]*data-livev2-view="jornada"/);
});
```

Ojo: el orden de atributos en `liveV2ViewSegHtml` es `class` antes de `data-livev2-view`; el test anterior usa un regex alternativo para no depender de detalles — si falla por orden de atributos, ajustar el regex al HTML real, no el HTML al test.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Views.test.js`
Expected: FAIL — `ui.liveV2SetView is not a function`.

- [ ] **Step 3: Write minimal implementation**

3a. En `js/live-v2-ui.js`, tras `liveV2ViewSegHtml`:

```javascript
/** Parchea seg (on/disabled) y titulo de seccion tras un poll o cambio de vista. */
function updateLiveV2ViewChrome(root, folded) {
  const view = liveV2ViewMode();
  const titleEl = root.querySelector('#livev2-section-title');
  if (titleEl) titleEl.textContent = liveV2SectionTitle(view);
  const hasEvents = (liveV2State().events || []).length > 0;
  const inPlay = liveV2HasInPlay(folded);
  const hasRound = !!liveV2CurrentRoundKey(AppState.matches, AppState.matchStats, (folded && folded.states) || {});
  root.querySelectorAll('[data-livev2-view]').forEach(btn => {
    const v = btn.getAttribute('data-livev2-view');
    btn.classList.toggle('on', v === view);
    if (v === 'jornada') btn.disabled = !hasRound;
    if (v === 'enjuego') btn.disabled = !hasEvents && !inPlay;
  });
}

/** Cambia de vista: recalcula filas con el ultimo folded, sin fetch. */
function liveV2SetView(view, folded) {
  if (LIVEV2_VIEWS.indexOf(view) < 0) return;
  const st = liveV2State();
  if (st.viewMode === view) return;
  st.viewMode = view;
  st.prevRanks = null; // baseline neutro: primera comparacion util llega con el proximo poll
  const snap = folded || liveV2Folded();
  const rows = liveV2Rows(snap);
  const now = Date.now();
  for (const r of rows) {
    r.pointsDiff = 0;
    r.rankMove = liveV2RankMoveView(r.name, st._rankMoves, now);
  }
  st._lastRows = liveV2Snapshot(rows);
  if (typeof document === 'undefined') return;
  const root = document.querySelector('.resultados-scroll .livev2') || document.querySelector('.livev2');
  if (!root) return;
  const container = document.getElementById('livev2-rows');
  if (container) container.innerHTML = rows.map(liveV2RowHtml).join('');
  const breakdownEl = root.querySelector('#livev2-breakdown');
  if (breakdownEl) breakdownEl.innerHTML = liveV2HeaderBreakdownHtml(liveV2HeaderBreakdown(snap, view));
  updateLiveV2ViewChrome(root, snap);
}

function bindLiveV2Views(root) {
  const scope = root || document;
  const seg = scope.querySelector('.livev2-viewseg');
  if (!seg || seg.dataset.bound === '1') return;
  seg.dataset.bound = '1';
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('[data-livev2-view]') : null;
    if (!btn || btn.disabled) return;
    liveV2SetView(btn.getAttribute('data-livev2-view'));
  });
}
```

3b. `updateLiveV2Dom` — tras la línea del breakdown (~2193) añadir:

```javascript
  updateLiveV2ViewChrome(root, folded);
```

3c. `renderLiveV2Tab` (línea ~2406): tras `st.prevRanks = null;` el flujo existente ya construye filas de la vista activa; no requiere cambios. Verificar (sin código) que `st.viewMode` persiste entre entradas al tab por diseño (solo `AppState.liveV2 = null` del logout lo resetea).

3d. Export en `api`: `liveV2SetView, bindLiveV2Views, updateLiveV2ViewChrome,`.

3e. `js/main.js` (~línea 2098, junto a `liveV2Ui.bindLiveV2Rows(container);`): añadir

```javascript
  if (isLiveTab) liveV2Ui.bindLiveV2Views(container);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Views.test.js && node --test tests/liveV2Ui.test.js && node --test tests/live.test.js`
Expected: PASS (13 tests nuevos + suites vecinas sin regresiones).

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js js/main.js tests/liveV2Views.test.js
git commit -m "feat(live): cambio de vista en caliente (bind + poll + titulo)"
```

---

### Task 7: Cache-busting, verificación completa y ajuste de spec

**Files:**
- Modify: `index.html` (versiones), `docs/superpowers/specs/2026-11-25-live-v2-view-selector-design.md` (si hay desviaciones menores documentadas durante la implementación)

**Interfaces:**
- Consumes: Tasks 1-6 completos.
- Produces: versión desplegable con cache-busting correcto.

- [ ] **Step 1: Bump de versiones en `index.html`** (regla de AGENTS.md — obligatorio al tocar JS/CSS):

- `js/live-v2-ui.js?v=32` → `js/live-v2-ui.js?v=33`
- `js/main.js?v=184` → `js/main.js?v=185`
- `css/styles.css?v=140` → `css/styles.css?v=141`

- [ ] **Step 2: Run full test suite**

Run: `node --test tests/*.test.js`
Expected: PASS completo, sin skips inesperados.

- [ ] **Step 3: Smoke manual en dev**

Run: `node server.mjs` (o el comando habitual de dev) y en el navegador:
1. Entrar en Resultados → Live. Comprobar: pills 🏆/📅/⚡ en la barra ⚡, título "CLASIFICACIÓN EN VIVO", sin scroll horizontal a 390px.
2. Cambiar a 📅 y ⚡: la tabla se re-ordena, el título cambia ("JORNADA EN VIVO"/"PARTIDOS EN VIVO"), el desglose ⚡ cambia, no hay fetch adicional (network quieta), no hay saltos ▲▼ falsos.
3. Con `?liveSim=1` en localhost: los polls animan (FLIP + motivo) en las tres vistas.
4. Sin partidos en juego: ⚡ deshabilitada; con liga en curso y matchStats: 📅 muestra lo de la última ronda.
5. Console limpia de errores.

- [ ] **Step 4: Documentar desviaciones en el spec (si las hubo)** — p. ej. el regex del test de Task 6 si se ajustó. Si no hay desviaciones, dejar el spec tal cual.

- [ ] **Step 5: Commit final**

```bash
git add index.html docs/superpowers/specs/2026-11-25-live-v2-view-selector-design.md
git commit -m "chore(live): cache-busting v33/v185/v141 del selector de vistas"
```

---

## Notas de revisión (para quien ejecuta)

- `liveV2Rows` se llama en cada poll; el coste nuevo es solo el bucle de desglose por estados (ya existía) + `liveV2CurrentRoundKey` (O(matches+matchStats), trivial) + `liveV2JornadaOfficial` cacheado en `AppState.live`.
- No tocar `js/liveV2.js` (fold/rankRows) ni el backend.
- Los tests usan `freshUi()` para resetear el singleton del módulo entre casos; no compartir `AppState` entre tests.
- Si un test existente de `liveV2Ui.test.js` depende del orden interno de `renderLiveV2Html` (p. ej. regex de `<div class="livev2-section-title">`), ajustar ese regex al nuevo HTML con id — cambio mecánico, no de comportamiento.
