# Live v2 — notas, puestos, diferencial de puntos y popup por partido

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ocultar las notas del ticker, mostrar movimiento de puestos y diferencial de puntos por refresco, colorear filas y chips, añadir el desglose en cabecera y un popup por partido con el pronóstico y la plantilla del usuario.

**Architecture:** Todo el trabajo vive en el front (vanilla JS + CSS). `js/live-v2-ui.js` gana helpers puros para calcular movimiento de puestos, diferencial de puntos, desglose de cabecera, datos del popup y estado de pulso de chips. `js/main.js` solo conecta el binding de chips al render del tab Live. La API, Mongo y el scoring no cambian.

**Tech Stack:** JavaScript vanilla, Node `node:test`, CSS existente en `css/styles.css`, HTML estático en `index.html`.

## Global Constraints

- No tocar `api-porra`, `liveevents`, el scoring ni la API.
- Mantener el estilo del proyecto: IIFE, funciones `function`, sin frameworks ni dependencias nuevas.
- Todo el texto visible va en español.
- Los tests se ejecutan con `node --test tests/`.
- Respetar `prefers-reduced-motion` en las animaciones nuevas.
- Mantener los cache-busters de `index.html` actualizados al final.
- No añadir comentarios nuevos al código salvo que sean imprescindibles para una regla no obvia.

---

### Task 1: Ocultar los eventos de nota del ticker

**Files:**
- Modify: `js/live-v2-ui.js:840-858`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2FeedItems()` existente y `liveV2Api.feedLabel`.
- Produces: `liveV2FeedItems()` sigue devolviendo `[{ key, icon, text }]`, pero sin eventos `rating`.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `tests/liveV2Ui.test.js`:

```js
test('liveV2FeedItems omite los eventos de nota', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const t = '2026-09-16T20:30:00.000Z';
  const base = { eventId: 1, ts: t, ingestedAt: t, minute: 30, sourceId: 'x' };
  ui.init({
    AppState: {
      liveV2: {
        events: [
          { ...base, type: 'goal', payload: { scorerId: 13 } },
          { ...base, type: 'rating', playerId: 13, payload: { rating: 7.5 } },
        ],
      },
      allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    },
    liveV2Api: liveV2,
  });
  const items = ui.liveV2FeedItems();
  assert.equal(items.length, 1);
  assert.match(items[0].text, /Gol/);
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque `items.length` es 2 (incluye la nota).

- [ ] **Step 3: Implementar el filtro mínimo**

En `js/live-v2-ui.js`, dentro de `liveV2FeedItems()`:

```js
  const events = (st.events || [])
    .filter(e => isFinite(new Date(e.ts).getTime()))
    .filter(e => !['lineup', 'status', 'rating'].includes(e.type))
    .sort((a, b) => new Date(a.ts) - new Date(b.ts) || ((a.seq || 0) - (b.seq || 0)))
    .slice(-4)
    .reverse();
```

- [ ] **Step 4: Ejecutar el test y verlo pasar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live-v2): oculta las notas del ticker"
```

---

### Task 2: Helpers de movimiento de puestos y nueva fila

**Files:**
- Modify: `js/live-v2-ui.js:750-830` (zona de chips y filas)
- Modify: `css/styles.css:6725-6775`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Produces:
  - `liveV2DetectRankMoves(rows, prevByName, prevMoves, now) -> { [name]: { delta:number, at:number } }`
  - `liveV2RankMoveView(name, moves, now) -> { text:string, cls:'up'|'down'|'eq', label:string }`
  - `liveV2RowHtml(row)` pinta `livev2-rank-group`, `livev2-rank-move` y ya no pinta `livev2-arrow`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/liveV2Ui.test.js`:

```js
test('liveV2DetectRankMoves guarda subidas y bajadas', () => {
  const ui = freshUi();
  const rows = [
    { name: 'A', rank: 1 },
    { name: 'B', rank: 3 },
  ];
  const prev = {
    A: { rank: 3 },
    B: { rank: 2 },
  };
  const moves = ui.liveV2DetectRankMoves(rows, prev, {}, 1000);
  assert.deepEqual(moves, {
    A: { delta: 2, at: 1000 },
    B: { delta: -1, at: 1000 },
  });
});

test('liveV2RankMoveView pinta el cambio y caduca a los 30 s', () => {
  const ui = freshUi();
  assert.deepEqual(ui.liveV2RankMoveView('A', { A: { delta: 2, at: 1000 } }, 1000), {
    text: '▲2', cls: 'up', label: 'Sube 2 puestos',
  });
  assert.deepEqual(ui.liveV2RankMoveView('A', { A: { delta: -1, at: 1000 } }, 1000), {
    text: '▼1', cls: 'down', label: 'Baja 1 puesto',
  });
  assert.deepEqual(ui.liveV2RankMoveView('A', { A: { delta: 2, at: 1000 } }, 31000), {
    text: '=', cls: 'eq', label: 'Sin cambios',
  });
  assert.deepEqual(ui.liveV2RankMoveView('B', {}, 1000), {
    text: '=', cls: 'eq', label: 'Sin cambios',
  });
});

test('liveV2RowHtml pinta puesto, movimiento y diferencial sin flecha', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: null }, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2RowHtml({
    name: 'Yo', avatar: '⚽', rank: 3, livePoints: 42, pointsDiff: 5, isMe: true,
    rankMove: { text: '▲2', cls: 'up', label: 'Sube 2 puestos' },
  });
  assert.match(html, /livev2-rank-group/);
  assert.match(html, /livev2-rank-move up/);
  assert.match(html, /▲2/);
  assert.match(html, /livev2-pts-diff up/);
  assert.match(html, /\+5pts/);
  assert.match(html, /points-up/);
  assert.doesNotMatch(html, /livev2-arrow/);
});
```

- [ ] **Step 2: Ejecutar los tests y verlos fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque las funciones no existen y la fila aún pinta `livev2-arrow`.

- [ ] **Step 3: Implementar los helpers**

En `js/live-v2-ui.js`, antes de `liveV2RowHtml`, añadir:

```js
const LIVEV2_RANK_MOVE_MS = 30000;

function liveV2DetectRankMoves(rows, prevByName, prevMoves, now) {
  const next = { ...(prevMoves || {}) };
  for (const r of rows) {
    const p = prevByName && prevByName[r.name];
    if (p && p.rank !== r.rank) next[r.name] = { delta: p.rank - r.rank, at: now };
  }
  return next;
}

function liveV2RankMoveView(name, moves, now) {
  const m = moves && moves[name];
  if (!m || now - m.at >= LIVEV2_RANK_MOVE_MS) {
    return { text: '=', cls: 'eq', label: 'Sin cambios' };
  }
  if (m.delta > 0) {
    return {
      text: `▲${m.delta}`,
      cls: 'up',
      label: `Sube ${m.delta} ${m.delta === 1 ? 'puesto' : 'puestos'}`,
    };
  }
  if (m.delta < 0) {
    const n = Math.abs(m.delta);
    return {
      text: `▼${n}`,
      cls: 'down',
      label: `Baja ${n} ${n === 1 ? 'puesto' : 'puestos'}`,
    };
  }
  return { text: '=', cls: 'eq', label: 'Sin cambios' };
}
```

Sustituir `liveV2RowHtml` por:

```js
function liveV2RowHtml(r) {
  const move = r.rankMove || { text: '=', cls: 'eq', label: 'Sin cambios' };
  const diff = r.pointsDiff || 0;
  return `<div class="livev2-row${r.isMe ? ' me' : ''}${liveV2RowPointsClass(diff)}" data-livev2-row="${liveV2Esc(r.name)}">`
    + `<div class="livev2-inner">`
    + `<span class="livev2-rank-group">`
    + `<span class="livev2-rank">${r.rank}</span>`
    + `<span class="livev2-rank-move ${move.cls}" aria-label="${liveV2Esc(move.label)}">${liveV2Esc(move.text)}</span>`
    + `</span>`
    + `<span class="livev2-avatar">${liveV2Esc(r.avatar) || '⚽'}</span>`
    + `<span class="livev2-name">${liveV2Esc(r.name)}</span>`
    + `<span class="livev2-pts">${r.livePoints}</span>`
    + `<span class="livev2-pts-diff ${liveV2PointsDiffClass(diff)}" aria-label="${liveV2Esc(liveV2PointsDiffLabel(diff))}">${liveV2PointsDiffText(diff)}</span>`
    + `</div></div>`;
}
```

`liveV2RowPointsClass`, `liveV2PointsDiffClass`, `liveV2PointsDiffText` y `liveV2PointsDiffLabel` se definen aquí por primera vez; la Task 3 los prueba y los integra en el DOM. Añadir sus versiones antes de `liveV2RowHtml`:

```js
function liveV2PointsDiffClass(d) {
  return d > 0 ? 'up' : d < 0 ? 'down' : 'eq';
}

function liveV2RowPointsClass(d) {
  return d > 0 ? ' points-up' : d < 0 ? ' points-down' : '';
}

function liveV2PointsDiffText(d) {
  return d > 0 ? `+${d}pts` : d < 0 ? `${d}pts` : '0pts';
}

function liveV2PointsDiffLabel(d) {
  if (d > 0) return `Suma ${d} puntos en este refresco`;
  if (d < 0) return `Resta ${Math.abs(d)} puntos en este refresco`;
  return 'Sin cambios de puntos';
}
```

Exportar en el objeto `api`:

```js
    liveV2DetectRankMoves,
    liveV2RankMoveView,
    liveV2RowHtml,
    liveV2PointsDiffClass,
    liveV2PointsDiffText,
    liveV2PointsDiffLabel,
```

- [ ] **Step 4: Ejecutar los tests y verlos pasar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Añadir el CSS del badge de puesto**

En `css/styles.css`, junto a `.livev2-rank`:

```css
.livev2-rank-group {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.livev2-rank-move {
  width: 24px;
  text-align: left;
  font-size: 9px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.livev2-rank-move.up { color: var(--accent-primary); }
.livev2-rank-move.down { color: #F87171; }
.livev2-rank-move.eq { color: var(--text-muted); }
```

- [ ] **Step 6: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live-v2): muestra movimiento de puestos junto al rank"
```

---

### Task 3: Diferencial de puntos, colores de fila y actualización incremental

**Files:**
- Modify: `js/live-v2-ui.js:1285-1415` (`updateLiveV2Dom`) y `stopLiveV2Polling`
- Modify: `css/styles.css:6700-6795`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2DetectRankMoves`, `liveV2RankMoveView`, `liveV2RowPointsClass`, `liveV2PointsDiffText/Class/Label`.
- Produces:
  - `liveV2ApplyPointsClass(el, diff)` aplica `points-up`/`points-down` y reinicia la animación.
  - `liveV2ScheduleRankMoveExpiry()` actualiza los badges a `=` a los 30 s.
  - `updateLiveV2Dom` rellena `row.pointsDiff` y `row.rankMove`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/liveV2Ui.test.js`:

```js
test('liveV2ApplyPointsClass alterna las clases de color', () => {
  const ui = freshUi();
  const classes = new Set();
  const el = {
    classList: {
      contains: c => classes.has(c),
      add: c => classes.add(c),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
    },
  };
  ui.liveV2ApplyPointsClass(el, 5);
  assert.ok(classes.has('points-up'));
  ui.liveV2ApplyPointsClass(el, -2);
  assert.ok(classes.has('points-down'));
  assert.ok(!classes.has('points-up'));
  ui.liveV2ApplyPointsClass(el, 0);
  assert.equal(classes.size, 0);
});

test('liveV2PointsDiffText, clase y etiqueta', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2PointsDiffText(5), '+5pts');
  assert.equal(ui.liveV2PointsDiffText(-2), '-2pts');
  assert.equal(ui.liveV2PointsDiffText(0), '0pts');
  assert.equal(ui.liveV2PointsDiffClass(5), 'up');
  assert.equal(ui.liveV2PointsDiffClass(-2), 'down');
  assert.equal(ui.liveV2PointsDiffClass(0), 'eq');
  assert.equal(ui.liveV2PointsDiffLabel(5), 'Suma 5 puntos en este refresco');
  assert.equal(ui.liveV2PointsDiffLabel(-2), 'Resta 2 puntos en este refresco');
  assert.equal(ui.liveV2PointsDiffLabel(0), 'Sin cambios de puntos');
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque `liveV2ApplyPointsClass` aún no está exportada. Los tests de texto/clase sí pasan desde la Task 2.

- [ ] **Step 3: Integrar en `updateLiveV2Dom`**

Al principio de `updateLiveV2Dom`, después de construir `prevByName`, añadir:

```js
  const now = Date.now();
  st._rankMoves = liveV2DetectRankMoves(rows, prevByName, st._rankMoves, now);
  for (const r of rows) {
    const prev = prevByName[r.name];
    r.pointsDiff = prev ? r.livePoints - prev.livePoints : 0;
    r.rankMove = liveV2RankMoveView(r.name, st._rankMoves, now);
  }
```

En el bloque que actualiza una fila existente, sustituir la actualización de `.livev2-arrow` por:

```js
      const moveEl = el.querySelector('.livev2-rank-move');
      if (moveEl) {
        moveEl.textContent = r.rankMove.text;
        moveEl.className = `livev2-rank-move ${r.rankMove.cls}`;
        moveEl.setAttribute('aria-label', r.rankMove.label);
      }
      const diffEl = el.querySelector('.livev2-pts-diff');
      if (diffEl) {
        diffEl.textContent = liveV2PointsDiffText(r.pointsDiff);
        diffEl.className = `livev2-pts-diff ${liveV2PointsDiffClass(r.pointsDiff)}`;
        diffEl.setAttribute('aria-label', liveV2PointsDiffLabel(r.pointsDiff));
      }
      liveV2ApplyPointsClass(el, r.pointsDiff);
```

Al final de `updateLiveV2Dom`, antes de `st._lastRows = ...`, añadir:

```js
  liveV2ScheduleRankMoveExpiry();
```

- [ ] **Step 4: Implementar los helpers de DOM y el temporizador**

Antes de `updateLiveV2Dom`, añadir:

```js
function liveV2ApplyPointsClass(el, diff) {
  if (!el || !el.classList) return;
  const next = diff > 0 ? 'points-up' : diff < 0 ? 'points-down' : null;
  const had = el.classList.contains('points-up') || el.classList.contains('points-down');
  if (had) el.classList.remove('points-up', 'points-down');
  if (!next) return;
  if (had && el.offsetWidth != null) void el.offsetWidth;
  el.classList.add(next);
}



let _liveV2RankMoveTimer = null;

function liveV2ScheduleRankMoveExpiry() {
  if (_liveV2RankMoveTimer) {
    clearTimeout(_liveV2RankMoveTimer);
    _liveV2RankMoveTimer = null;
  }
  const st = liveV2State();
  const now = Date.now();
  let soonest = Infinity;
  for (const move of Object.values(st._rankMoves || {})) {
    const remaining = (move.at + LIVEV2_RANK_MOVE_MS) - now;
    if (remaining <= 0) continue;
    if (remaining < soonest) soonest = remaining;
  }
  if (!Number.isFinite(soonest)) return;
  _liveV2RankMoveTimer = setTimeout(() => {
    _liveV2RankMoveTimer = null;
    const t = Date.now();
    const moves = st._rankMoves || {};
    for (const name of Object.keys(moves)) {
      if (t - moves[name].at >= LIVEV2_RANK_MOVE_MS) delete moves[name];
    }
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-livev2-row]').forEach(el => {
      const name = el.getAttribute('data-livev2-row');
      const view = liveV2RankMoveView(name, moves, t);
      const moveEl = el.querySelector('.livev2-rank-move');
      if (!moveEl) return;
      moveEl.textContent = view.text;
      moveEl.className = `livev2-rank-move ${view.cls}`;
      moveEl.setAttribute('aria-label', view.label);
    });
    liveV2ScheduleRankMoveExpiry();
  }, soonest + 20);
}
```

En el objeto `api`, añadir:

```js
    liveV2ApplyPointsClass,
```

En `liveV2State()`, añadir al objeto inicial:

```js
      _rankMoves: {},
```

En `stopLiveV2Polling()`, añadir:

```js
  if (_liveV2RankMoveTimer) { clearTimeout(_liveV2RankMoveTimer); _liveV2RankMoveTimer = null; }
```

- [ ] **Step 5: Añadir el CSS de la columna y el color de fila**

En `css/styles.css`:

```css
.livev2-pts-diff {
  width: 48px;
  flex-shrink: 0;
  text-align: right;
  font-size: var(--font-size-xs);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.livev2-pts-diff.up { color: var(--accent-primary); }
.livev2-pts-diff.down { color: #F87171; }
.livev2-pts-diff.eq { color: var(--text-muted); }

.livev2-row.points-up > .livev2-inner {
  border-color: rgba(16, 185, 129, 0.65);
  background: rgba(16, 185, 129, 0.12);
  animation: livev2-row-points-up 0.8s ease-out;
}

.livev2-row.points-down > .livev2-inner {
  border-color: rgba(248, 113, 113, 0.65);
  background: rgba(248, 113, 113, 0.12);
  animation: livev2-row-points-down 0.8s ease-out;
}

@keyframes livev2-row-points-up {
  0% { background: rgba(16, 185, 129, 0.35); box-shadow: 0 0 18px rgba(16, 185, 129, 0.35); }
  100% { background: rgba(16, 185, 129, 0.12); box-shadow: none; }
}

@keyframes livev2-row-points-down {
  0% { background: rgba(248, 113, 113, 0.35); box-shadow: 0 0 18px rgba(248, 113, 113, 0.35); }
  100% { background: rgba(248, 113, 113, 0.12); box-shadow: none; }
}

@media (prefers-reduced-motion: reduce) {
  .livev2-row.points-up > .livev2-inner,
  .livev2-row.points-down > .livev2-inner {
    animation: none;
  }
}
```

Asegurar que estos selectores van después de `.livev2-row.me > .livev2-inner` para que el color de puntos gane al borde de "me".

- [ ] **Step 6: Ejecutar los tests y comprobar sintaxis**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

Run: `node --check js/live-v2-ui.js`
Expected: sin salida.

- [ ] **Step 7: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live-v2): diferencial de puntos y color de fila por refresco"
```

---

### Task 4: Desglose de puntos en la cabecera

**Files:**
- Modify: `js/live-v2-ui.js:987-1020` (`renderLiveV2Html`), `1285-1415` (`updateLiveV2Dom`)
- Modify: `css/styles.css:6574-6600`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveUserMatchPoints`, `liveV2FinalizedIds`, `liveMatchMeta`.
- Produces:
  - `liveV2HeaderBreakdown(folded) -> { total:number, predictionPts:number, squadPts:number }`
  - `liveV2HeaderBreakdownHtml(data) -> string`
  - `renderLiveV2Html` incluye `id="livev2-breakdown"`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/liveV2Ui.test.js`:

```js
test('liveV2HeaderBreakdown separa pronostico y plantilla y excluye oficiales', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: null,
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B' }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }] },
    matchStats: [],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: ['8 por acertar resultado'] }),
    calculatePlayerMatchPoints: () => ({ total: 3, desglose: [{ concepto: 'Gol marcado', puntos: 3 }] }),
  });
  const folded = {
    states: { 1: { status: 'LIVE' } },
    statsById: { 1: { 1: { goles: 1 }, 2: { goles: 0 }, jugadores: [{ id: '13', nombre: 'F', posicion: 'F', equipo: 1, puntos: 7, goles: 1, minutos: 60 }] } },
  };
  assert.deepEqual(ui.liveV2HeaderBreakdown(folded), { total: 11, predictionPts: 8, squadPts: 3 });

  AppState.matchStats = [{ eventId: 1 }];
  assert.deepEqual(ui.liveV2HeaderBreakdown(folded), { total: 0, predictionPts: 0, squadPts: 0 });
});

test('liveV2HeaderBreakdownHtml pinta total, pronostico y plantilla', () => {
  const ui = freshUi();
  const html = ui.liveV2HeaderBreakdownHtml({ total: 11, predictionPts: 8, squadPts: 3 });
  assert.match(html, /⚡ <b>11<\/b>/);
  assert.match(html, /Pron\. <b>8<\/b>/);
  assert.match(html, /Plantilla <b>3<\/b>/);
});

test('render Live v2 incluye la cabecera de desglose', () => {
  const ui = freshUi();
  ui.init({
    AppState: { liveV2: null, matches: [], allPlayers: [], squadsCache: {}, currentUser: null },
    liveV2Api: { escapeHtml: s => String(s) },
  });
  const html = ui.renderLiveV2Html([], { states: {}, statsById: {} });
  assert.match(html, /id="livev2-breakdown"/);
});
```

- [ ] **Step 2: Ejecutar los tests y verlos fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque los helpers y el bloque no existen.

- [ ] **Step 3: Implementar los helpers**

Antes de `renderLiveV2Html`, añadir:

```js
function liveV2HeaderBreakdown(folded) {
  const out = { total: 0, predictionPts: 0, squadPts: 0 };
  const me = AppState.currentUser && AppState.currentUser.name;
  if (!me) return out;
  const finalized = liveV2FinalizedIds();
  for (const [id, state] of Object.entries((folded && folded.states) || {})) {
    if (finalized.has(String(id))) continue;
    const status = (state && state.status) || 'NS';
    if (status === 'NS') continue;
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

function liveV2HeaderBreakdownHtml(b) {
  return `<span class="livev2-breakdown-total">⚡ <b>${b.total}</b></span>`
    + `<span class="livev2-breakdown-item pred">🎯 Pron. <b>${b.predictionPts}</b></span>`
    + `<span class="livev2-breakdown-item squad">👥 Plantilla <b>${b.squadPts}</b></span>`;
}
```

Exportar en `api`:

```js
    liveV2HeaderBreakdown,
    liveV2HeaderBreakdownHtml,
```

- [ ] **Step 4: Integrar en el render**

En `renderLiveV2Html`, calcular:

```js
  const breakdown = liveV2HeaderBreakdown(folded);
```

Añadir la fila dentro de `.livev2-fixed`, justo después de `</div>` de `.livev2-status`:

```js
    + `<div class="livev2-breakdown" id="livev2-breakdown">${liveV2HeaderBreakdownHtml(breakdown)}</div>`
```

Quitar del bloque `.livev2-status-right` el `<span class="livev2-points-inline" ...>` completo.

- [ ] **Step 5: Integrar en `updateLiveV2Dom`**

Sustituir el bloque que actualiza `#livev2-points-inline` por:

```js
  const breakdownEl = root.querySelector('#livev2-breakdown');
  if (breakdownEl) breakdownEl.innerHTML = liveV2HeaderBreakdownHtml(liveV2HeaderBreakdown(folded));
```

- [ ] **Step 6: Añadir el CSS**

En `css/styles.css`, sustituir la zona de `.livev2-points-inline` por:

```css
.livev2-breakdown {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.livev2-breakdown-total b {
  color: var(--text-primary);
  font-weight: 900;
  font-size: var(--font-size-sm);
}

.livev2-breakdown-item b {
  color: var(--text-primary);
  font-weight: 800;
}

.livev2-breakdown-item.pred b { color: var(--accent-gold); }
.livev2-breakdown-item.squad b { color: var(--accent-primary); }
```

- [ ] **Step 7: Ejecutar tests y sintaxis**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

Run: `node --check js/live-v2-ui.js`
Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live-v2): desglose de pronostico y plantilla en cabecera"
```

---

### Task 5: Datos y HTML del popup por partido

**Files:**
- Modify: `js/live-v2-ui.js` (antes de `liveV2ChipData`)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Produces:
  - `liveV2MatchBreakdown(eventId, state) -> { eventId, meta, status, label, score, loggedIn, prediction, predictionPts, predictionBreakdown, squadPts, squadDetail, total }`
  - `liveV2MatchModalHtml(data) -> string`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/liveV2Ui.test.js`:

```js
function liveMatchFixture() {
  return {
    currentUser: { name: 'me' },
    liveV2: null,
    matches: [{
      id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B',
      homeBadgeExt: 'webp', awayBadgeExt: 'webp',
    }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }] },
    matchStats: [],
  };
}

test('liveV2MatchBreakdown devuelve pronostico y plantilla', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = liveMatchFixture();
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: ['8 por acertar resultado'] }),
    calculatePlayerMatchPoints: () => ({ total: 3, desglose: [{ concepto: 'Gol marcado', puntos: 3 }] }),
  });
  const state = {
    status: 'LIVE', score: { home: 1, away: 0 }, players: {}, goals: [],
    kickoffTs: '2026-09-16T20:00:00Z', lastMinute: 60,
  };
  const d = ui.liveV2MatchBreakdown(1, state);
  assert.equal(d.prediction.home, 1);
  assert.equal(d.prediction.away, 0);
  assert.equal(d.predictionPts, 8);
  assert.equal(d.squadPts, 3);
  assert.equal(d.total, 11);
  assert.equal(d.status, 'LIVE');
});

test('liveV2MatchBreakdown en NS no da puntos pero conserva el pronostico', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = liveMatchFixture();
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 3, desglose: [] }),
  });
  const d = ui.liveV2MatchBreakdown(1, { status: 'NS', score: { home: 0, away: 0 }, players: {} });
  assert.equal(d.prediction.home, 1);
  assert.equal(d.predictionPts, 0);
  assert.equal(d.squadPts, 0);
  assert.equal(d.total, 0);
  assert.equal(d.label, 'NS');
});

test('liveV2MatchModalHtml pinta pronostico, plantilla, total y aviso NS', () => {
  const ui = freshUi();
  ui.init({ AppState: {}, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2MatchModalHtml({
    meta: { homeTeam: 'A', awayTeam: 'B', homeTeamId: 1, awayTeamId: 2, homeBadgeExt: 'webp', awayBadgeExt: 'webp' },
    status: 'NS',
    label: 'NS',
    score: { home: 0, away: 0 },
    loggedIn: true,
    prediction: { home: 1, away: 0 },
    predictionPts: 0,
    predictionBreakdown: [],
    squadPts: 0,
    squadDetail: [],
    total: 0,
  });
  assert.match(html, /Tú 1-0/);
  assert.match(html, /Pronóstico/);
  assert.match(html, /Plantilla/);
  assert.match(html, /El partido aún no ha empezado/);
});
```

- [ ] **Step 2: Ejecutar los tests y verlos fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque las funciones no existen.

- [ ] **Step 3: Implementar `liveV2MatchBreakdown`**

Antes de `liveV2ChipData`, añadir:

```js
function liveV2MatchBreakdown(eventId, state) {
  const me = AppState.currentUser && AppState.currentUser.name;
  const match = (AppState.matches || []).find(m => String(m.id) === String(eventId));
  const id = match ? match.id : eventId;
  const meta = liveMatchMeta({ eventId: id });
  const status = (state && state.status) || 'NS';
  let stats = null;
  if (status !== 'NS' && state && typeof liveV2Api !== 'undefined' && liveV2Api.matchStateToStats) {
    const ctx = { ...(liveV2CtxById()[id] || {}), playersById: liveV2PlayersById() };
    stats = liveV2Api.matchStateToStats(state, ctx, liveV2PlayheadMs(liveV2State()));
  }
  const lm = { eventId: id, stats, status };
  const r = liveUserMatchPoints(me, lm, meta);
  const preds = me ? ((AppState.allPredictions || {})[me] || {}) : {};
  const pred = preds[id] != null ? preds[id] : preds[String(id)];
  const hasPred = pred && pred.home != null && pred.away != null;
  return {
    eventId: id,
    meta,
    status,
    label: liveV2ChipLabel(state),
    score: state && state.score ? { ...state.score } : null,
    loggedIn: !!me,
    prediction: hasPred ? { home: pred.home, away: pred.away } : null,
    predictionPts: r.matchPts,
    predictionBreakdown: r.breakdown || [],
    squadPts: r.squadPts,
    squadDetail: r.squadDetail || [],
    total: r.total,
  };
}
```

- [ ] **Step 4: Implementar `liveV2MatchModalHtml`**

Añadir justo después:

```js
function liveV2MatchModalHtml(d) {
  const score = d.score ? `${d.score.home}-${d.score.away}` : '–';
  const homeBadge = liveV2BadgeSrc(d.meta.homeTeamId, d.meta.homeBadgeExt);
  const awayBadge = liveV2BadgeSrc(d.meta.awayTeamId, d.meta.awayBadgeExt);
  const badge = (src, cls) => src
    ? `<img class="livev2-modal-badge ${cls}" src="${liveV2Esc(src)}" alt="" loading="lazy">`
    : '';
  const predScore = d.prediction
    ? `<div class="livev2-modal-pred-score">Tú ${d.prediction.home}-${d.prediction.away}</div>`
    : `<div class="livev2-modal-empty">Sin pronóstico</div>`;
  const predPts = d.prediction
    ? `<div class="livev2-modal-subtotal">${d.predictionPts > 0 ? '+' : ''}${d.predictionPts} pts</div>`
    : '';
  const predBreakdown = d.predictionBreakdown.length
    ? `<ul class="livev2-modal-list">${d.predictionBreakdown.map(x => `<li>${liveV2Esc(x)}</li>`).join('')}</ul>`
    : '';
  const squad = d.squadDetail.length
    ? `<div class="livev2-modal-squad">${d.squadDetail.map(p => `
        <div class="livev2-modal-player">
          <span class="livev2-modal-player-name">${liveV2Esc(p.nombre)}</span>
          <b class="${p.puntos >= 0 ? 'positive' : 'negative'}">${p.puntos > 0 ? '+' : ''}${p.puntos} pts</b>
          <small>${p.desglose.map(x => liveV2Esc(x.concepto)).join(' · ')}</small>
        </div>`).join('')}</div>`
    : `<div class="livev2-modal-empty">Ningún jugador de tu plantilla en este partido</div>`;
  const note = d.status === 'NS'
    ? `<div class="livev2-modal-note">El partido aún no ha empezado</div>`
    : '';
  const loggedOut = `<div class="livev2-modal-note">Inicia sesión para ver tu desglose</div>`;
  const body = d.loggedIn
    ? `<div class="livev2-modal-section"><h4>🎯 Pronóstico</h4>${predScore}${predPts}${predBreakdown}</div>`
      + `<div class="livev2-modal-section"><h4>👥 Plantilla</h4>${squad}</div>`
      + `<div class="livev2-modal-total">Total: <b>${d.total > 0 ? '+' : ''}${d.total} pts</b></div>`
    : loggedOut;
  return `<div class="breakdown-modal livev2-match-modal" role="dialog" aria-modal="true" aria-labelledby="livev2-match-modal-title">`
    + `<div class="breakdown-modal-header">`
    + `<h3 class="breakdown-modal-title" id="livev2-match-modal-title">${liveV2Esc(d.meta.homeTeam)} - ${liveV2Esc(d.meta.awayTeam)}</h3>`
    + `<button class="breakdown-modal-close" data-livev2-modal-close="1" aria-label="Cerrar">✕</button>`
    + `</div>`
    + `<div class="breakdown-modal-content livev2-match-content">`
    + `<div class="livev2-modal-score">${badge(homeBadge, 'home')}<b>${score}</b>`
    + `<span class="livev2-modal-state">${liveV2Esc(d.label)}</span>${badge(awayBadge, 'away')}</div>`
    + note
    + body
    + `<div class="livev2-modal-total">Total: <b>${d.total > 0 ? '+' : ''}${d.total} pts</b></div>`
    + `</div>`
    + `</div>`;
}
```

Exportar en `api`:

```js
    liveV2MatchBreakdown,
    liveV2MatchModalHtml,
```

- [ ] **Step 5: Ejecutar los tests y verlos pasar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live-v2): datos y html del desglose por partido"
```

---

### Task 6: Abrir el popup desde los chips

**Files:**
- Modify: `js/live-v2-ui.js` (chips, polling y API)
- Modify: `js/main.js:2001-2045`
- Modify: `css/styles.css` (modal)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Produces:
  - `liveV2ChipEventId(target) -> string|null`
  - `bindLiveV2Chips(root) -> void`
  - `openLiveV2MatchModal(eventId)`, `closeLiveV2MatchModal()`, `refreshLiveV2MatchModal()`
  - `stopLiveV2Polling()` cierra el popup.
- Consumes: `liveV2MatchBreakdown`, `liveV2MatchModalHtml`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/liveV2Ui.test.js`:

```js
test('liveV2ChipEventId resuelve el chip desde el target', () => {
  const ui = freshUi();
  const chip = { getAttribute: k => (k === 'data-livev2-chip' ? '1' : null) };
  const target = { closest: sel => (sel === '[data-livev2-chip]' ? chip : null) };
  assert.equal(ui.liveV2ChipEventId(target), '1');
  assert.equal(ui.liveV2ChipEventId({ closest: () => null }), null);
  assert.equal(ui.liveV2ChipEventId(null), null);
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque `liveV2ChipEventId` no existe.

- [ ] **Step 3: Implementar el binding y el modal**

Añadir antes de `liveV2ChipHtml`:

```js
function liveV2ChipEventId(target) {
  const chip = target && typeof target.closest === 'function'
    ? target.closest('[data-livev2-chip]') : null;
  return chip ? chip.getAttribute('data-livev2-chip') : null;
}

function bindLiveV2Chips(root) {
  const host = (root || document).querySelector('#livev2-chips-host');
  if (!host || host.dataset.bound === '1') return;
  host.dataset.bound = '1';
  const openFromEvent = (e) => {
    const id = liveV2ChipEventId(e.target);
    if (id == null) return;
    e.preventDefault();
    openLiveV2MatchModal(id);
  };
  host.addEventListener('click', openFromEvent);
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    openFromEvent(e);
  });
}
```

Añadir cerca de `liveV2State`:

```js
function closeLiveV2MatchModal() {
  const st = liveV2State();
  const overlay = typeof document !== 'undefined' ? document.getElementById('livev2-match-modal-overlay') : null;
  if (overlay) overlay.remove();
  if (st._modalKeyHandler && typeof document !== 'undefined') {
    document.removeEventListener('keydown', st._modalKeyHandler);
  }
  st._modalKeyHandler = null;
  if (typeof document !== 'undefined' && document.body) {
    document.body.style.overflow = st._modalPrevOverflow || '';
  }
  st._modalPrevOverflow = null;
  st._openMatchModal = null;
  const focus = st._modalReturnFocus;
  st._modalReturnFocus = null;
  if (focus && focus.focus) {
    try { focus.focus(); } catch (e) { /* sin foco */ }
  }
}

function refreshLiveV2MatchModal() {
  const st = liveV2State();
  if (st._openMatchModal == null) return;
  if (typeof document === 'undefined') return;
  const host = document.getElementById('livev2-match-modal');
  if (!host) return;
  const folded = liveV2Folded();
  const state = folded.states[String(st._openMatchModal)];
  if (!state) { closeLiveV2MatchModal(); return; }
  host.innerHTML = liveV2MatchModalHtml(liveV2MatchBreakdown(st._openMatchModal, state));
}

function openLiveV2MatchModal(eventId) {
  if (typeof document === 'undefined') return;
  closeLiveV2MatchModal();
  const st = liveV2State();
  st._openMatchModal = String(eventId);
  st._modalReturnFocus = document.activeElement || null;
  st._modalPrevOverflow = document.body.style.overflow || '';
  const overlay = document.createElement('div');
  overlay.className = 'breakdown-modal-overlay livev2-match-overlay';
  overlay.id = 'livev2-match-modal-overlay';
  overlay.innerHTML = `<div id="livev2-match-modal"></div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const onKey = (e) => { if (e.key === 'Escape') closeLiveV2MatchModal(); };
  st._modalKeyHandler = onKey;
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLiveV2MatchModal();
    else if (e.target.closest && e.target.closest('[data-livev2-modal-close]')) closeLiveV2MatchModal();
  });
  refreshLiveV2MatchModal();
}
```

En `liveV2State()`, añadir al objeto inicial:

```js
      _openMatchModal: null, _modalReturnFocus: null, _modalPrevOverflow: null, _modalKeyHandler: null,
```

En `stopLiveV2Polling()`, añadir:

```js
  closeLiveV2MatchModal();
```

Al final de `updateLiveV2Dom`, añadir:

```js
  refreshLiveV2MatchModal();
```

En `liveV2ChipHtml`, cambiar la apertura del div del chip por:

```js
  return `<div class="${d.cls}" data-livev2-chip="${liveV2Esc(eventId)}" role="button" tabindex="0" title="${liveV2Esc(d.fullTitle)}" aria-label="${liveV2Esc(d.fullTitle)}">`
```

Exportar en `api`:

```js
    liveV2ChipEventId,
    bindLiveV2Chips,
    openLiveV2MatchModal,
    closeLiveV2MatchModal,
    refreshLiveV2MatchModal,
```

- [ ] **Step 4: Conectar en `main.js`**

En `renderResultadosTab`, junto a:

```js
  if (isLiveTab) liveV2Ui.bindLiveV2SoundToggle(container);
  if (isLiveTab) liveV2Ui.bindLiveV2Fullscreen(container);
```

añadir:

```js
  if (isLiveTab) liveV2Ui.bindLiveV2Chips(container);
```

En `retryLiveV2` (dentro de `js/live-v2-ui.js`), después de `bindLiveV2Fullscreen(target)`, añadir:

```js
    bindLiveV2Chips(target);
```

No hace falta un cierre extra en `main.js`: `stopLiveV2Polling()` se ejecuta al entrar o salir del tab Live y ya cierra el popup.

- [ ] **Step 5: Añadir CSS del modal**

En `css/styles.css`, al final de la zona de modales o junto a `.livev2`:

```css
.livev2-match-overlay { z-index: 1200; }

.livev2-match-modal { max-height: 82vh; }
.livev2-match-content { padding: 0; }

.livev2-modal-score {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px 4px;
  font-size: 1.2rem;
  font-weight: 900;
}

.livev2-modal-badge { width: 22px; height: 22px; object-fit: contain; }
.livev2-modal-state { font-size: var(--font-size-xs); color: var(--text-secondary); }

.livev2-modal-section {
  padding: 10px 16px;
  border-top: 1px solid var(--border-color);
}

.livev2-modal-section h4 {
  margin: 0 0 6px;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

.livev2-modal-pred-score { font-size: 1.1rem; font-weight: 900; }
.livev2-modal-subtotal { color: var(--accent-gold); font-weight: 800; margin-top: 2px; }

.livev2-modal-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.livev2-modal-squad { display: flex; flex-direction: column; gap: 8px; }

.livev2-modal-player {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  align-items: baseline;
}

.livev2-modal-player small {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-size: 10px;
}

.livev2-modal-empty, .livev2-modal-note {
  padding: 8px 16px;
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.livev2-modal-total {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  text-align: right;
  font-weight: 800;
}

.livev2-modal-total b { color: var(--accent-gold); font-size: 1.1rem; }
```

- [ ] **Step 6: Ejecutar test y sintaxis**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

Run: `node --check js/live-v2-ui.js && node --check js/main.js`
Expected: sin salida.

- [ ] **Step 7: Commit**

```bash
git add js/live-v2-ui.js js/main.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live-v2): popup de desglose al pulsar un partido"
```

---

### Task 7: Pronóstico propio en el chip

**Files:**
- Modify: `js/live-v2-ui.js:620-690` (`liveV2ChipData`, `liveV2ChipHtml`, `patchLiveV2Chip`)
- Modify: `css/styles.css:6650-6700`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `AppState.currentUser`, `AppState.allPredictions`.
- Produces:
  - `liveV2ChipData()` incluye `predictionText` y `chipMetaText`.
  - El chip pinta `.livev2-chip-meta`, `.livev2-chip-state` y `.livev2-cell-pred`.
  - `patchLiveV2Chip` actualiza ambos textos.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/liveV2Ui.test.js`:

```js
test('el chip muestra el pronostico propio', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: null,
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B', homeBadgeExt: 'webp', awayBadgeExt: 'webp' }],
      allPlayers: [],
      allPredictions: { me: { 1: { home: 2, away: 1 } } },
      squadsCache: {},
      matchStats: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: () => 'A',
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = ui.renderLiveV2Html([], { states: { 1: { status: 'LIVE', lastMinute: 63, score: { home: 1, away: 0 } } }, statsById: {} });
  assert.match(html, /livev2-cell-pred/);
  assert.match(html, /Tú 2-1/);
});

test('el chip muestra S/P sin pronostico', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: null,
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B', homeBadgeExt: 'webp', awayBadgeExt: 'webp' }],
      allPlayers: [],
      allPredictions: { me: {} },
      squadsCache: {},
      matchStats: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: () => 'A',
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = ui.renderLiveV2Html([], { states: { 1: { status: 'NS', score: { home: 0, away: 0 } } }, statsById: {} });
  assert.match(html, /S\/P/);
});
```

- [ ] **Step 2: Ejecutar los tests y verlos fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque el chip no pinta el pronóstico.

- [ ] **Step 3: Implementar en `liveV2ChipData`**

Dentro de `liveV2ChipData`, después de `const meta = ...`, añadir:

```js
  const me = AppState.currentUser && AppState.currentUser.name;
  const preds = me ? ((AppState.allPredictions || {})[me] || {}) : {};
  const matchId = match ? match.id : eventId;
  const pred = preds[matchId] != null ? preds[matchId] : preds[String(matchId)];
  const hasPred = pred && pred.home != null && pred.away != null;
  const predictionText = hasPred ? `Tú ${pred.home}-${pred.away}` : 'S/P';
```

Añadir al objeto devuelto:

```js
    predictionText,
    chipMetaText: `${liveV2ChipLabel(state)} · ${predictionText}`,
```

- [ ] **Step 4: Implementar en `liveV2ChipHtml`**

Sustituir el bloque:

```js
    + `<span class="livev2-chip-state ${liveV2Esc(d.chipCls)}">${liveV2Esc(d.label)}</span>`
```

por:

```js
    + `<span class="livev2-chip-meta">`
    + `<span class="livev2-chip-state ${liveV2Esc(d.chipCls)}">${liveV2Esc(d.label)}</span>`
    + `<span class="livev2-cell-pred">${liveV2Esc(d.predictionText)}</span>`
    + `</span>`
```

Y añadir ` · ${d.predictionText}` a `fullTitle` en `liveV2ChipData`.

- [ ] **Step 5: Implementar en `patchLiveV2Chip`**

Sustituir la actualización de `.livev2-chip-state` por:

```js
  const stateEl = el.querySelector('.livev2-chip-state');
  if (stateEl) {
    const cls = `livev2-chip-state ${d.chipCls}`;
    if (stateEl.className !== cls) stateEl.className = cls;
    if (stateEl.textContent !== d.label) stateEl.textContent = d.label;
  }
  const predEl = el.querySelector('.livev2-cell-pred');
  if (predEl && predEl.textContent !== d.predictionText) predEl.textContent = d.predictionText;
```

- [ ] **Step 6: Ajustar el CSS**

En `css/styles.css`, sustituir la regla `.livev2-chip-state` actual por:

```css
.livev2-chip-meta {
  order: 99;
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}

.livev2-chip-state {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .02em;
  opacity: .8;
}

.livev2-cell-pred {
  font-size: 9px;
  font-weight: 800;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 7: Ejecutar tests y sintaxis**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

Run: `node --check js/live-v2-ui.js`
Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live-v2): muestra el pronostico propio en cada chip"
```

---

### Task 8: Pulso semántico de los chips al cambiar el marcador

**Files:**
- Modify: `js/live-v2-ui.js:756-830` (`liveV2DetectChipChanges`, chips) y `liveV2State`
- Modify: `css/styles.css:6608-6650`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Produces:
  - `liveV2ChipPulseState(delta) -> 'fav'|'hurt'|'neutral'`
  - `liveV2DetectChipChanges(folded)` mantiene `_chipPulse[eventId] = { state, delta, at }` y retira el pulso si no hay cambio de marcador.
  - El chip aplica `score-fav`, `score-hurt` o `score-neutral` y parpadea hasta el siguiente poll.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/liveV2Ui.test.js`:

```js
test('liveV2ChipPulseState clasifica el delta', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2ChipPulseState(5), 'fav');
  assert.equal(ui.liveV2ChipPulseState(-2), 'hurt');
  assert.equal(ui.liveV2ChipPulseState(0), 'neutral');
});

test('liveV2DetectChipChanges calcula el pulso y lo retira sin cambio', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: {
      _chipScores: { 1: '0-0' },
      _chipUserPoints: { 1: 0 },
      _chipPulse: {},
      _chipChanged: {},
    },
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [] },
    matchStats: [],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 5, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const folded = {
    states: { 1: { status: 'LIVE', score: { home: 1, away: 0 }, players: {} } },
    statsById: { 1: { 1: { goles: 1 }, 2: { goles: 0 }, jugadores: [] } },
  };
  ui.liveV2DetectChipChanges(folded);
  assert.equal(AppState.liveV2._chipPulse['1'].state, 'fav');

  ui.liveV2DetectChipChanges(folded);
  assert.equal(AppState.liveV2._chipPulse['1'], undefined);
});

test('el chip aplica la clase de pulso', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: { _chipPulse: { 1: { state: 'hurt', delta: -2, at: Date.now() } } },
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B', homeBadgeExt: 'webp', awayBadgeExt: 'webp' }],
      allPlayers: [],
      allPredictions: { me: {} },
      squadsCache: {},
      matchStats: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: () => 'A',
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = ui.renderLiveV2Html([], { states: { 1: { status: 'LIVE', lastMinute: 20, score: { home: 1, away: 0 } } }, statsById: {} });
  assert.match(html, /score-hurt/);
});
```

- [ ] **Step 2: Ejecutar los tests y verlos fallar**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL porque `liveV2ChipPulseState` no existe y no se aplica la clase.

- [ ] **Step 3: Implementar `liveV2ChipPulseState` y la detección**

Añadir antes de `liveV2DetectChipChanges`:

```js
function liveV2ChipPulseState(delta) {
  if (delta > 0) return 'fav';
  if (delta < 0) return 'hurt';
  return 'neutral';
}
```

Sustituir `liveV2DetectChipChanges` por:

```js
function liveV2DetectChipChanges(folded) {
  const st = liveV2State();
  const now = Date.now();
  const me = AppState.currentUser && AppState.currentUser.name;
  const prevPoints = st._chipUserPoints || {};
  const nextPoints = {};
  for (const [id, s] of Object.entries((folded && folded.states) || {})) {
    const key = String(id);
    const cur = s && s.score ? `${s.score.home}-${s.score.away}` : null;
    const prev = st._chipScores[key];
    const match = (AppState.matches || []).find(m => String(m.id) === key);
    let total = 0;
    if (me && match) {
      const lm = { eventId: match.id, stats: (folded.statsById || {})[id], status: (s && s.status) || 'NS' };
      total = liveUserMatchPoints(me, lm, liveMatchMeta(lm)).total;
    }
    nextPoints[key] = total;
    if (prev != null && cur != null && prev !== cur) {
      st._chipChanged[key] = now;
      const before = prevPoints[key];
      const delta = before != null ? total - before : 0;
      st._chipPulse[key] = { state: liveV2ChipPulseState(delta), delta, at: now };
    } else {
      delete st._chipPulse[key];
    }
    st._chipScores[key] = cur;
  }
  st._chipUserPoints = nextPoints;
}
```

En `liveV2State()`, añadir al objeto inicial:

```js
      _chipUserPoints: {}, _chipPulse: {},
```

Añadir junto a los `if` existentes de `liveV2State()`:

```js
  if (!AppState.liveV2._chipPulse) AppState.liveV2._chipPulse = {};
  if (!AppState.liveV2._chipUserPoints) AppState.liveV2._chipUserPoints = {};
  if (!AppState.liveV2._rankMoves) AppState.liveV2._rankMoves = {};
```

- [ ] **Step 4: Aplicar la clase en `liveV2ChipData`**

Dentro de `liveV2ChipData`, antes del `return`, añadir:

```js
  const pulse = liveV2State()._chipPulse && liveV2State()._chipPulse[String(eventId)];
  const pulseCls = pulse ? ` score-${pulse.state}` : '';
  const pulseTitle = pulse
    ? pulse.state === 'fav' ? ' · marcador cambiado, sumas puntos'
      : pulse.state === 'hurt' ? ' · marcador cambiado, restas puntos'
      : ' · marcador cambiado, sin efecto en tus puntos'
    : '';
```

En `fullTitle`, añadir `${pulseTitle}` al final:

```js
    fullTitle: `${meta.homeTeam} ${state && state.score ? `${state.score.home}-${state.score.away}` : '–'} ${meta.awayTeam} · ${liveV2ChipLabel(state)} · ${predictionText}${pulseTitle}`,
```

En `cls`, sustituir la parte de `changed` por:

```js
    cls: `livev2-cell${state && (state.status === 'LIVE' || state.status === 'HT') ? ' live' : ''}`
      + `${state && state.status === 'FT' ? ' ft' : ''}`
      + pulseCls,
```

- [ ] **Step 5: Ajustar `liveV2ScheduleChipGlowTimers`**

Sustituir su contenido por:

```js
function liveV2ScheduleChipGlowTimers(root) {
  const st = liveV2State();
  const now = Date.now();
  const interval = (AppState.liveRefreshSecs || 30) * 1000;
  (root || document).querySelectorAll('.livev2-cell.score-fav, .livev2-cell.score-hurt, .livev2-cell.score-neutral').forEach(chip => {
    const id = chip.getAttribute('data-livev2-chip');
    const pulse = id != null && st._chipPulse ? st._chipPulse[id] : null;
    if (!pulse) return;
    const remaining = interval - (now - pulse.at);
    if (remaining <= 0) {
      chip.classList.remove('score-fav', 'score-hurt', 'score-neutral');
      return;
    }
    setTimeout(() => {
      const cur = st._chipPulse && st._chipPulse[id];
      if (cur && cur.at === pulse.at) chip.classList.remove('score-fav', 'score-hurt', 'score-neutral');
    }, remaining);
  });
}
```

Exportar en `api`:

```js
    liveV2ChipPulseState,
    liveV2DetectChipChanges,
```

- [ ] **Step 6: Añadir el CSS de parpadeo**

En `css/styles.css`, sustituir la zona `.livev2-cell.changed` y su `@keyframes` por:

```css
.livev2-cell.score-fav {
  border-color: rgba(16, 185, 129, 0.9);
  animation: livev2-chip-blink-fav 1s ease-in-out infinite alternate;
}

.livev2-cell.score-hurt {
  border-color: rgba(248, 113, 113, 0.9);
  animation: livev2-chip-blink-hurt 1s ease-in-out infinite alternate;
}

.livev2-cell.score-neutral {
  border-color: rgba(59, 130, 246, 0.9);
  animation: livev2-chip-blink-neutral 1s ease-in-out infinite alternate;
}

@keyframes livev2-chip-blink-fav {
  from { background-color: rgba(16, 185, 129, 0.08); box-shadow: 0 0 0 rgba(16, 185, 129, 0); }
  to { background-color: rgba(16, 185, 129, 0.38); box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); }
}

@keyframes livev2-chip-blink-hurt {
  from { background-color: rgba(248, 113, 113, 0.08); box-shadow: 0 0 0 rgba(248, 113, 113, 0); }
  to { background-color: rgba(248, 113, 113, 0.38); box-shadow: 0 0 12px rgba(248, 113, 113, 0.6); }
}

@keyframes livev2-chip-blink-neutral {
  from { background-color: rgba(59, 130, 246, 0.08); box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
  to { background-color: rgba(59, 130, 246, 0.38); box-shadow: 0 0 12px rgba(59, 130, 246, 0.6); }
}

@media (prefers-reduced-motion: reduce) {
  .livev2-cell.score-fav,
  .livev2-cell.score-hurt,
  .livev2-cell.score-neutral {
    animation: none;
  }
}
```

- [ ] **Step 7: Ejecutar tests y sintaxis**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

Run: `node --check js/live-v2-ui.js`
Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live-v2): pulso verde, rojo o azul en chips al cambiar el marcador"
```

---

### Task 9: Cache-busters y verificación final

**Files:**
- Modify: `index.html:19`, `index.html:332`, `index.html:333`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: HTML que carga las versiones nuevas de CSS y JS.

- [ ] **Step 1: Subir cache-busters**

En `index.html`:

```html
  <link rel="stylesheet" href="css/styles.css?v=117">
```

```html
  <script src="js/live-v2-ui.js?v=18"></script>
```

```html
  <script src="js/main.js?v=169"></script>
```

- [ ] **Step 2: Ejecutar toda la suite**

Run: `node --test tests/`
Expected: todos los tests PASS.

- [ ] **Step 3: Comprobar sintaxis**

Run: `node --check js/live-v2-ui.js && node --check js/main.js`
Expected: sin salida.

- [ ] **Step 4: Comprobación manual en local**

Arrancar el servidor local y abrir el Live en `http://localhost:8080`:

```bash
node server.mjs
```

Verificar:

- El ticker no muestra líneas de nota.
- Junto al puesto aparece `▲N`, `▼N` o `=`.
- La columna `+5pts`/`-2pts`/`0pts` cambia en cada refresco.
- La fila se tiñe de verde o rojo con animación solo cuando cambian los puntos.
- La cabecera muestra `⚡ total · 🎯 Pron. · 👥 Plantilla`.
- El chip muestra `Tú X-Y` o `S/P`.
- Al cambiar el marcador, el chip parpadea verde/rojo/azul hasta el siguiente poll.
- Al pulsar un chip se abre el popup con pronóstico y plantilla; NS también abre.
- El popup se cierra con ✕, backdrop y Escape.
- Con movimiento reducido, los colores se aplican sin parpadeo.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "chore(live-v2): sube cache-busters tras el rediseño"
```

---

## Self-Review

- **Cobertura del spec:**
  - Ticker sin notas → Task 1.
  - Movimiento de puestos 30 s → Task 2 y Task 3.
  - Diferencial de puntos + colores de fila → Task 3.
  - Cabecera → Task 4.
  - Popup → Task 5 y Task 6.
  - Pronóstico en chip → Task 7.
  - Pulso de chips → Task 8.
  - Cache-busters y verificación → Task 9.
- **Placeholders:** no hay TBD/TODO; cada paso incluye código o comando concreto.
- **Consistencia de tipos:** `liveV2DetectRankMoves`, `liveV2RankMoveView`, `liveV2PointsDiffText/Class/Label`, `liveV2HeaderBreakdown`, `liveV2MatchBreakdown`, `liveV2ChipPulseState` se usan con las mismas firmas en todas las tasks.
