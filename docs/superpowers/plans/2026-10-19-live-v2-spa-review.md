# Live v2 SPA (porra-spa) — Corrección, UI y rendimiento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los puntos live (NS, rojas, VAR, orden, reloj), cerrar la XSS del avatar, mejorar la UI/usabilidad y reducir el coste del poll.

**Architecture:** La lógica pura sigue en `js/liveV2.js` (event-sourcing). La UI del Live se extrae de `main.js` a `js/live-v2-ui.js`. El orden de plegado pasa a `(ts, ingestedAt, seq, sourceId)` y el reloj usa `serverTime`. La fase 2 pule chips, cabecera, motivo, feed y accesibilidad; la fase 3 hace render incremental y poll adaptativo.

**Tech Stack:** Vanilla JS (IIFE + `window`/`globalThis` + `module.exports`), CSS3, `node:test`.

## Global Constraints

- Sin frameworks ni dependencias nuevas.
- Cache-busting: subir `?v=` en `index.html` al tocar `js/*` o `css/styles.css`.
- Tests: `node --test tests/*.test.js` (no `node --test tests/`).
- Rama: `feature/live-v2`.
- Mantener el layout móvil vertical y los objetivos táctiles ≥44 px.
- Fase de liga únicamente: sin prórroga ni tanda.
- Todo dato remoto que se interpole en `innerHTML` debe pasar por `liveV2Esc`.

---

## Fase 1 — Corrección + seguridad

### Task 1: Orden de plegado determinista

**Files:**
- Modify: `js/liveV2.js:105-124`
- Test: `tests/liveV2.test.js`

**Interfaces:**
- Produces: `foldMatch(events, ctx)` ordena por `(ts, ingestedAt, seq, typeRank, sourceId)`; `score`/`match_final` se aplican después de goles y anulaciones.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2.test.js`
Expected: FAIL (el `score` se pliega antes del gol → 2-0; la anulación se pierde).

- [ ] **Step 3: Implement**

Sustituir `byTs` en `js/liveV2.js` por:

```js
function typeRank(t) {
  if (t === 'goal') return 1;
  if (t === 'goal_cancelled') return 2;
  if (t === 'score') return 3;
  if (t === 'match_final') return 4;
  return 1;
}

function byTs(a, b) {
  const d = parseTs(a.ts) - parseTs(b.ts);
  if (d !== 0) return d;
  const ing = parseTs(a.ingestedAt) - parseTs(b.ingestedAt);
  if (ing !== 0) return ing;
  const seq = (a.seq || 0) - (b.seq || 0);
  if (seq !== 0) return seq;
  const tr = typeRank(a.type) - typeRank(b.type);
  if (tr !== 0) return tr;
  return String(a.sourceId || '').localeCompare(String(b.sourceId || ''));
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveV2.js tests/liveV2.test.js
git commit -m "fix(live): orden determinista de plegado por ts, seq y tipo"
```

---

### Task 2: `NS`, rojas y reloj con hora del servidor

**Files:**
- Modify: `js/liveV2.js:25-103`
- Test: `tests/liveV2.test.js`

**Interfaces:**
- Produces: `applyEvent` acepta `payload.kickoffTs`; una roja/segunda amarilla fija `onPitch=false`; `matchClockAt(state, playheadTs)` se congela en `FT`.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/liveV2.test.js`
Expected: FAIL (el reloj da 10/120; la roja sigue en el campo).

- [ ] **Step 3: Implement**

En `createMatchState`, añadir `lastMinute: null`.

En `applyEvent`:

```js
case 'status':
  state.status = p.status || state.status;
  state.period = p.period || state.period;
  if (p.kickoffTs) state.kickoffTs = p.kickoffTs;
  else if (p.status === 'LIVE' && !state.kickoffTs) state.kickoffTs = ev.ts || null;
  if (p.status === 'HT') state.htTs = ev.ts || null;
  if (p.status === 'FT') state.ftTs = ev.ts || null;
  if (ev.minute != null) state.lastMinute = ev.minute;
  break;
case 'card': {
  const c = ensure(state, ev.playerId);
  if (c) {
    const type = p.cardType || 'yellow';
    c.cards.push(type);
    if (type === 'red' || type === 'yellowRed' || type === 'secondYellow') {
      c.onPitch = false;
      c.exitMinute = ev.minute ?? null;
    }
  }
  break;
}
```

En `matchClockAt`:

```js
function matchClockAt(state, playheadTs) {
  if (!state.kickoffTs || state.status === 'NS') return null;
  if (state.status === 'FT' || state.ftTs) return state.lastMinute != null ? state.lastMinute : 90;
  const start = new Date(state.kickoffTs).getTime();
  const end = playheadTs != null ? playheadTs : Date.now();
  let mins = Math.floor((end - start) / 60000);
  if (state.period && state.period !== 'period1' && state.period !== 'halftime') {
    mins -= 15;
  } else if (state.htTs && new Date(state.htTs).getTime() <= end) {
    mins = Math.min(mins, 45);
  }
  return Math.max(0, mins);
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveV2.js tests/liveV2.test.js
git commit -m "fix(live): NS, expulsion y reloj con kickoffTs y congelado en FT"
```

---

### Task 3: `main.js` usa estado real, hora del servidor y resync

**Files:**
- Modify: `js/main.js:2060-2120`, `2649-2705`
- Test: `tests/liveV2.test.js` (lógica pura) + verificación manual

**Interfaces:**
- Consumes: `foldMatch`/`matchStateToStats` de Tasks 1-2.
- Produces: `liveV2Rows` no puntúa `NS`; el fold usa `st.serverTime`; full cada 10 min y al volver a visible.

- [ ] **Step 1: Write the failing test**

```js
test('matchStateToStats de un partido NS no genera puntos', () => {
  const st = liveV2Api.createMatchState();
  const stats = liveV2Api.matchStateToStats(st, { homeTeamId: 1, awayTeamId: 2, playersById: {} }, null);
  assert.deepEqual(stats[1], { goles: 0 });
  assert.equal(st.status, 'NS');
});
```

(El filtro `NS` vive en `liveV2Rows`; el test puro asegura que el estado no se fuerza a `LIVE`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2.test.js`
Expected: PASS si `createMatchState` nace en `NS`; sirve de regresión.

- [ ] **Step 3: Implement**

En `liveV2Folded`:

```js
const playhead = st.serverTime ? new Date(st.serverTime).getTime() : null;
statsById[id] = liveV2Api.matchStateToStats(s, ctx, playhead);
```

En `liveV2Rows`, sustituir el bucle por:

```js
for (const id of Object.keys(folded.statsById || {})) {
  if (finalized.has(String(id))) continue;
  const match = (AppState.matches || []).find(m => String(m.id) === String(id));
  if (!match) continue;
  const state = folded.states[id];
  const status = state?.status || 'NS';
  if (status === 'NS') continue;
  const lm = { eventId: match.id, stats: folded.statsById[id], status };
  delta += liveUserMatchPoints(pl.name, lm, liveMatchMeta(lm)).total;
}
```

En `renderLiveV2Tab`, antes de `liveV2Rows`:

```js
st.prevRanks = null;
```

Tras un `fetchLiveEvents(true)` (full), `st._fullAt = Date.now()`.

En `pollLiveV2`:

```js
let forceFull = !st.serverTime || (Date.now() - (st._fullAt || 0) > 10 * 60 * 1000);
await fetchLiveEvents(forceFull);
if (forceFull) st._fullAt = Date.now();
st.lastFetchAt = Date.now();
st.error = null;
```

y en el `catch`: `st.error = true;`. En `finally`: `st.polling = false`.

En `fetchLiveEvents`:

```js
if (!res.ok) throw new Error('HTTP ' + res.status);
...
st.lastFetchAt = Date.now();
if (payload.resync) st._fullAt = 0;
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2.test.js tests/live.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "fix(live): estado real por partido, hora del servidor y resync periodico"
```

---

### Task 4: Escapar el avatar (XSS)

**Files:**
- Modify: `js/liveV2.js` (nuevo `escapeHtml` exportado)
- Modify: `js/main.js:2122-2124,2241-2252`
- Test: `tests/liveV2.test.js`

**Interfaces:**
- Produces: `liveV2Api.escapeHtml(s)`; `liveV2Esc` delega en él; `liveV2RowHtml` escapa `avatar`.

- [ ] **Step 1: Write the failing test**

```js
test('escapeHtml neutraliza HTML', () => {
  assert.equal(liveV2Api.escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2.test.js`
Expected: FAIL (`escapeHtml` no existe).

- [ ] **Step 3: Implement**

En `js/liveV2.js`:

```js
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

Añadirlo a `liveV2Api`.

En `js/main.js`:

```js
function liveV2Esc(s) { return liveV2Api.escapeHtml(s); }
```

Y en `liveV2RowHtml`:

```js
+ `<span class="livev2-avatar">${liveV2Esc(r.avatar) || '⚽'}</span>`
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveV2.js js/main.js tests/liveV2.test.js
git commit -m "fix(live): escapa el avatar en las filas (XSS almacenado)"
```

---

### Task 5: Extraer la UI del Live a `js/live-v2-ui.js`

**Files:**
- Create: `js/live-v2-ui.js`
- Modify: `js/main.js` (delegación), `index.html` (script + `?v=`)
- Test: `tests/liveV2.test.js` (no romper) + smoke manual

**Interfaces:**
- Produces: `window.liveV2Ui` con `renderLiveV2Html`, `updateLiveV2Dom`, `pollLiveV2`, `renderLiveV2Tab`, `bindLiveV2SoundToggle`, `bindLiveV2Fullscreen`, `startLiveV2Polling`, `stopLiveV2Polling`.

- [ ] **Step 1: Baseline**

Run: `node --test tests/*.test.js`
Expected: PASS (guarda el número de tests).

- [ ] **Step 2: Move**

Mueve a `js/live-v2-ui.js` el bloque Live v2 de `main.js` (aprox. 1800-2913): estado `liveV2State`, helpers de chips/feed/rows, animaciones, audio, fullscreen y poll. Envuelve en IIFE:

```js
(function (global) {
  'use strict';
  // ... funciones movidas ...
  global.liveV2Ui = { renderLiveV2Html, updateLiveV2Dom, renderLiveV2Tab, pollLiveV2,
    startLiveV2Polling, stopLiveV2Polling, bindLiveV2SoundToggle, bindLiveV2Fullscreen };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.liveV2Ui;
})(typeof window !== 'undefined' ? window : globalThis);
```

En `main.js`, sustituye las llamadas por `liveV2Ui.*` y elimina las definiciones movidas. Mantén en `main.js` solo el punto de entrada (`renderResultadosTab`).

- [ ] **Step 3: Cache-busting**

En `index.html`, añade `js/live-v2-ui.js?v=1` antes de `js/main.js` y sube la versión de `main.js`.

- [ ] **Step 4: Verify**

Run: `node --check js/live-v2-ui.js && node --check js/main.js && node --test tests/*.test.js`
Expected: sin errores; mismos tests verdes.
Smoke: abrir Resultados → Live y comprobar chips, filas, audio, fullscreen.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js js/main.js index.html
git commit -m "refactor(live): extrae la UI del live a js/live-v2-ui.js"
```

---

## Fase 2 — UI / usabilidad

### Task 6: Chips con estado y minuto

**Files:**
- Modify: `js/live-v2-ui.js` (`liveV2ChipHtml`, `liveV2ChipIsRecentChange`)
- Modify: `css/styles.css`
- Test: `tests/liveV2.test.js` (helper puro si se extrae)

**Interfaces:**
- Produces: cada chip muestra `NS`, `LIVE 63'`, `HT` o `FT`; `title`/`aria-label` con el nombre completo.

- [ ] **Step 1: Implement**

```js
function liveV2ChipLabel(state) {
  if (!state) return 'NS';
  if (state.status === 'NS') return 'NS';
  if (state.status === 'HT') return 'HT';
  if (state.status === 'FT') return 'FT';
  const m = state.lastMinute != null ? state.lastMinute : '·';
  return `LIVE ${m}'`;
}
```

Añadir al chip: `const chipCls = (state?.status || 'NS').toLowerCase();` y `<span class="livev2-chip-state ${chipCls}">${liveV2ChipLabel(state)}</span>` con `aria-label="${home} ${score} ${away} · ${label}"`.

- [ ] **Step 2: CSS**

```css
.livev2-chip-state { font-size: 9px; font-weight: 700; letter-spacing: .02em; opacity: .8; }
.livev2-chip-state.live { color: var(--accent-green); }
.livev2-chip-state.ht { color: var(--accent-gold); }
.livev2-chip-state.ft { color: var(--text-muted); }
```

- [ ] **Step 3: Verify + commit**

Run: `node --test tests/*.test.js`; subir `?v=`; comprobar con el simulador.
```bash
git add js/main.js css/styles.css index.html
git commit -m "feat(live): estado y minuto por partido en los chips"
```

---

### Task 7: Abreviaturas únicas

**Files:**
- Modify: `js/live-v2-ui.js` (`liveV2Abbr`)
- Test: `tests/liveV2Abbr.test.js`

**Interfaces:**
- Produces: `liveV2Abbr('Manchester City') === 'MCI'`, `'Manchester United' === 'MUN'`, `'Real Madrid' === 'RMA'`, `'Real Betis' === 'BET'`.

- [ ] **Step 1: Write the failing test**

```js
test('abreviaturas ambiguas se desambiguan', () => {
  assert.equal(liveV2Abbr('Manchester City'), 'MCI');
  assert.equal(liveV2Abbr('Manchester United'), 'MUN');
  assert.equal(liveV2Abbr('Real Madrid'), 'RMA');
  assert.equal(liveV2Abbr('Real Betis'), 'BET');
});
```

- [ ] **Step 2: Implement**

```js
const LIVEV2_ABBR_OVERRIDES = {
  'Manchester City': 'MCI', 'Manchester United': 'MUN',
  'Real Madrid': 'RMA', 'Real Betis': 'BET'
};
function liveV2Abbr(name) {
  const key = String(name == null ? '' : name).trim();
  if (LIVEV2_ABBR_OVERRIDES[key]) return LIVEV2_ABBR_OVERRIDES[key];
  // ... algoritmo actual ...
}
```

- [ ] **Step 3: Verify + commit**

Run: `node --test tests/liveV2Abbr.test.js`; subir `?v=`.
```bash
git add js/main.js tests/liveV2Abbr.test.js index.html
git commit -m "fix(live): abreviaturas unicas para equipos ambiguos"
```

---

### Task 8: Última actualización, error y reintento

**Files:**
- Modify: `js/live-v2-ui.js`, `css/styles.css`
- Test: verificación manual

**Interfaces:**
- Consumes: `st.lastFetchAt`, `st.error` de Task 3.
- Produces: badge con "Actualizado hace Xs", banner de error con `Reintentar`.

- [ ] **Step 1: Implement**

```js
function liveV2StatusBadge(st) {
  if (st.error) return { text: '⚠️ Sin conexión', cls: 'error' };
  const age = st.lastFetchAt ? Math.floor((Date.now() - st.lastFetchAt) / 1000) : null;
  if (age != null && age > 90) return { text: `⏸ Datos de hace ${age}s`, cls: 'stale' };
  return { text: '● EN DIRECTO', cls: 'live' };
}
```

Añadir `title="Actualizado hace Xs"` y un botón `#livev2-retry` que llame a `pollLiveV2()`/`fetchLiveEvents(true)`.

- [ ] **Step 2: CSS + verify + commit**

Estilos `.livev2-badge.error`/`.stale`; subir `?v=`; probar desconectando la red.
```bash
git add js/live-v2-ui.js css/styles.css index.html
git commit -m "feat(live): indicador de actualizacion, error y reintento"
```

---

### Task 9: Motivo y feed fiables

**Files:**
- Modify: `js/live-v2-ui.js` (`liveV2MoverReason`, `liveV2FeedHtml`)
- Test: `tests/liveV2.test.js`

**Interfaces:**
- Produces: el feed filtra antes de recortar; el motivo usa el delta atribuible al evento, no el total del poll.

- [ ] **Step 1: Implement**

```js
function liveV2FeedHtml() {
  const st = liveV2State();
  const playersById = liveV2PlayersById();
  const events = (st.events || [])
    .filter(e => isFinite(new Date(e.ts).getTime()))
    .filter(e => !['lineup', 'status'].includes(e.type))
    .sort((a, b) => new Date(a.ts) - new Date(b.ts) || ((a.seq || 0) - (b.seq || 0)))
    .slice(-4)
    .reverse();
  // ... resto igual ...
}
```

En `liveV2MoverReason`, no asignar `pick.pointsDelta` al evento si hubo varios eventos; usar `delta: 0` salvo que el evento sea el único del poll.

- [ ] **Step 2: Verify + commit**

Run: `node --test tests/liveV2.test.js`; smoke con el simulador.
```bash
git add js/live-v2-ui.js tests/liveV2.test.js
git commit -m "fix(live): feed filtra antes de recortar y motivo atribuible"
```

---

### Task 10: Accesibilidad y salida de pantalla completa

**Files:**
- Modify: `js/live.js` (`buildLiveTabsHtml`), `js/live-v2-ui.js` (fullscreen), `css/styles.css`, `index.html`
- Test: `tests/live.test.js`

**Interfaces:**
- Produces: tabs con `role="tablist"`/`aria-selected`; fullscreen con salida visible y `Escape`/`popstate`.

- [ ] **Step 1: Implement**

- Tabs: `role="tablist"`, cada botón `role="tab"`, `aria-selected`, `min-height:44px`.
- `aria-live="polite"` en `.livev2-rows`, `.livev2-feed` y `.livev2-reason`.
- Quitar `user-scalable=no` de `index.html`.
- Fullscreen: en `enterLiveV2Fullscreen`, añadir `history.pushState({ liveFs: true }, '')`; en `popstate`/`Escape`, salir. Mantener el botón `⤡` visible en skeleton/error.

- [ ] **Step 2: Verify + commit**

Run: `node --test tests/*.test.js`; probar zoom, teclado y fullscreen.
```bash
git add js/live.js js/live-v2-ui.js css/styles.css index.html
git commit -m "feat(live): accesibilidad de tabs y salida segura de pantalla completa"
```

---

## Fase 3 — Rendimiento

### Task 11: Poll adaptativo y render incremental

**Files:**
- Modify: `js/live-v2-ui.js`, `css/styles.css`
- Test: verificación manual + `tests/liveV2.test.js`

**Interfaces:**
- Produces: el poll se detiene si no hay partidos `LIVE`/`HT`; chips/feed se parchean por clave en lugar de reconstruir `innerHTML`.

- [ ] **Step 1: Implement**

```js
function liveV2HasInPlay(folded) {
  return Object.values(folded.states || {}).some(s => s.status === 'LIVE' || s.status === 'HT');
}
// en el timer:
if (!liveV2HasInPlay(liveV2Folded())) return; // sin partidos en juego, no poll
```

Para el render: guardar `data-livev2-key` y actualizar `textContent`/`className` de los nodos existentes; solo crear/eliminar cuando cambie el conjunto.

- [ ] **Step 2: Verify + commit**

Run: `node --test tests/*.test.js`; medir peticiones en DevTools.
```bash
git add js/live-v2-ui.js css/styles.css
git commit -m "perf(live): poll adaptativo y render incremental"
```

---

### Task 12: Cachear el full y usar `since`

**Files:**
- Modify: `js/live-v2-ui.js` (`fetchLiveEvents`)
- Test: verificación manual

**Interfaces:**
- Produces: al abrir Live se reutiliza el último full en memoria y se pide `?since`; full solo en resync.

- [ ] **Step 1: Implement**

```js
if (!forceFull && st.events.length && !st._fullAt) {
  // primera entrada con eventos en memoria: usar delta
  forceFull = false;
}
```

Guardar `st._fullPayload` en `sessionStorage` (opcional) y restaurar al cargar.

- [ ] **Step 2: Verify + commit**

Run: `node --test tests/*.test.js`; comprobar en DevTools que la primera carga tras navegar usa `?since`.
```bash
git add js/live-v2-ui.js
git commit -m "perf(live): reutiliza el ultimo full y pide deltas"
```

---

## Verificación final

- [ ] `node --test tests/*.test.js` → todo verde.
- [ ] `node --check js/liveV2.js js/live-v2-ui.js js/main.js js/live.js` → sin errores.
- [ ] Simulador + Live: NS no puntúa, roja, VAR, orden, reloj, chips, motivo, audio y fullscreen.
- [ ] Subir `?v=` de `styles.css` y de todos los `js/*` tocados en `index.html`.
