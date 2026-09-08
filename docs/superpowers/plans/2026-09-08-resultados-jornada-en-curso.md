# Resultados: jornada en curso por defecto + scroll al último resultado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la pestaña Resultados → Jornadas muestre por defecto la jornada en curso y haga auto-scroll al último partido disputado con resultado.

**Architecture:** Nuevo módulo IIFE `js/resultadosRound.js` (patrón de `js/hoyPartidos.js`) con dos funciones puras exportables (`getCurrentRoundKey`, `sortRoundMatches`). `renderResultadosTab()` de `js/main.js` las consume para elegir la jornada por defecto, ordenar los partidos y hacer scroll. El estado `resultadosRoundKey` se declara en `AppState` y se resetea al salir de la pestaña para que cada visita vuelva a la jornada en curso.

**Tech Stack:** JavaScript vanilla (ES6+), HTML/CSS vanilla. Tests: scripts Node independientes en `tests/` que importan el módulo con `require('../js/resultadosRound.js')`.

## Global Constraints

- **Cache-busting (AGENTS.md)**: al modificar `js/main.js` o añadir un JS nuevo hay que incrementar la versión `?v=X` en `index.html`. Si se toca `css/styles.css` también.
- **No frameworks**: solo JS/CSS vanilla. Sin librerías nuevas.
- **Móvil vertical primero**: no romper el diseño portrait mobile-first (`.resultados-scroll` es `flex:1; overflow-y:auto`).
- **Patrón de módulo**: IIFE que expone `xxxApi` en `window`/`global` y `module.exports` para tests (ver `js/hoyPartidos.js:215-225`).
- **Tests**: ficheros `tests/*.test.js` independientes, se ejecutan con `node tests/<fichero>.test.js`. Estilo: `assert` de Node + runner inline con `process.exit(failed > 0 ? 1 : 0)`.
- **Sin comentarios en código** salvo los estrictamente necesarios (norma de estilo del proyecto).

---

### Task 1: Módulo `js/resultadosRound.js` con `sortRoundMatches`

**Files:**
- Create: `js/resultadosRound.js`
- Test: `tests/resultadosRound.test.js`

**Interfaces:**
- Consumes: nada (archivos nuevos).
- Produces:
  - `sortRoundMatches(allRoundMatches)` → `array`. Copia ordenada de `[{ match, hasResult }]`: disputados primero por `fechaTs` ascendente, luego pendientes por `fechaTs` ascendente. No muta el array original.

- [ ] **Step 1: Write the failing test**

Crear `tests/resultadosRound.test.js`:

```js
const assert = require('assert');
const { sortRoundMatches } = require('../js/resultadosRound.js');

function test_sort_disputados_antiguo_a_reciente_luego_pendientes() {
  const items = [
    { match: { id: 1, fechaTs: 100 }, hasResult: true },
    { match: { id: 2, fechaTs: 300 }, hasResult: true },
    { match: { id: 3, fechaTs: 200 }, hasResult: true },
    { match: { id: 4, fechaTs: 50 }, hasResult: false },
    { match: { id: 5, fechaTs: 400 }, hasResult: false },
  ];
  const sorted = sortRoundMatches(items);
  assert.deepStrictEqual(sorted.map(m => m.match.id), [1, 3, 2, 4, 5]);
}

function test_sort_no_muta_el_array_original() {
  const items = [
    { match: { id: 1, fechaTs: 100 }, hasResult: true },
    { match: { id: 2, fechaTs: 50 }, hasResult: false },
  ];
  sortRoundMatches(items);
  assert.strictEqual(items[0].match.id, 1);
}

const tests = [test_sort_disputados_antiguo_a_reciente_luego_pendientes, test_sort_no_muta_el_array_original];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/resultadosRound.test.js`
Expected: FAIL con `Cannot find module '../js/resultadosRound.js'`.

- [ ] **Step 3: Write minimal implementation**

Crear `js/resultadosRound.js`:

```js
(function (global) {
  function sortRoundMatches(allRoundMatches) {
    return [...allRoundMatches].sort((a, b) => {
      const aPlayed = !!a.hasResult;
      const bPlayed = !!b.hasResult;
      if (aPlayed && bPlayed) return a.match.fechaTs - b.match.fechaTs;
      if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;
      return a.match.fechaTs - b.match.fechaTs;
    });
  }

  const resultadosRoundApi = { sortRoundMatches };
  global.resultadosRoundApi = resultadosRoundApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = resultadosRoundApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/resultadosRound.test.js`
Expected: 2 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add js/resultadosRound.js tests/resultadosRound.test.js
git commit -m "feat(resultados): sort de partidos por jornada (disputados cronologicos, luego pendientes)"
```

---

### Task 2: `getCurrentRoundKey` en el módulo + tests

**Files:**
- Modify: `js/resultadosRound.js`
- Modify: `tests/resultadosRound.test.js`

**Interfaces:**
- Consumes: nada (trabaja sobre el mismo módulo de Task 1).
- Produces:
  - `getCurrentRoundKey(roundList, matches, matchStats, nowMs)` → `string|null`
    - `roundList`: `[{ key, fase, ronda, label }]` ordenado (el `availableRoundList` de `renderResultadosTab`).
    - `matches`: array con `{ id, fase, ronda, fechaTs }`.
    - `matchStats`: array con `{ eventId, stats }` (resultado disponible solo si `stats` es truthy).
    - Lógica: (1) clave de la primera ronda cuya ventana `[minFechaTs, maxFechaTs]` (segundos) contiene `nowMs` (ms); (2) si ninguna, clave de la última ronda de la lista con ≥1 partido con `stats` en `matchStats`; (3) si ninguna, clave de la última ronda de la lista; `roundList` vacío → `null`.

- [ ] **Step 1: Add the failing tests**

Sustituir `tests/resultadosRound.test.js` por la versión completa (sort + current round):

```js
const assert = require('assert');
const { sortRoundMatches, getCurrentRoundKey } = require('../js/resultadosRound.js');

function test_sort_disputados_antiguo_a_reciente_luego_pendientes() {
  const items = [
    { match: { id: 1, fechaTs: 100 }, hasResult: true },
    { match: { id: 2, fechaTs: 300 }, hasResult: true },
    { match: { id: 3, fechaTs: 200 }, hasResult: true },
    { match: { id: 4, fechaTs: 50 }, hasResult: false },
    { match: { id: 5, fechaTs: 400 }, hasResult: false },
  ];
  const sorted = sortRoundMatches(items);
  assert.deepStrictEqual(sorted.map(m => m.match.id), [1, 3, 2, 4, 5]);
}

function test_sort_no_muta_el_array_original() {
  const items = [
    { match: { id: 1, fechaTs: 100 }, hasResult: true },
    { match: { id: 2, fechaTs: 50 }, hasResult: false },
  ];
  sortRoundMatches(items);
  assert.strictEqual(items[0].match.id, 1);
}

const roundList = [
  { key: 'liga:1', fase: 'liga', ronda: 1 },
  { key: 'liga:2', fase: 'liga', ronda: 2 },
  { key: 'liga:3', fase: 'liga', ronda: 3 },
];
const matches = [
  { id: 1, fase: 'liga', ronda: 1, fechaTs: Math.floor(new Date(2026, 8, 8).getTime() / 1000) },
  { id: 2, fase: 'liga', ronda: 1, fechaTs: Math.floor(new Date(2026, 8, 10).getTime() / 1000) },
  { id: 3, fase: 'liga', ronda: 2, fechaTs: Math.floor(new Date(2026, 9, 13).getTime() / 1000) },
  { id: 4, fase: 'liga', ronda: 3, fechaTs: Math.floor(new Date(2026, 9, 20).getTime() / 1000) },
];

function test_jornada_en_curso_por_fecha() {
  const now = new Date(2026, 8, 9, 12, 0, 0).getTime();
  assert.strictEqual(getCurrentRoundKey(roundList, matches, [], now), 'liga:1');
}

function test_fallback_ultima_con_resultados() {
  const now = new Date(2026, 8, 15, 12, 0, 0).getTime();
  const matchStats = [
    { eventId: 1, stats: { 1: { goles: 1 }, 2: { goles: 0 } } },
    { eventId: 3, stats: { 1: { goles: 2 }, 2: { goles: 2 } } },
  ];
  assert.strictEqual(getCurrentRoundKey(roundList, matches, matchStats, now), 'liga:2');
}

function test_fallback_ultima_disponible() {
  const now = new Date(2026, 8, 15, 12, 0, 0).getTime();
  assert.strictEqual(getCurrentRoundKey(roundList, matches, [], now), 'liga:3');
}

function test_roundList_vacio_null() {
  assert.strictEqual(getCurrentRoundKey([], matches, [], Date.now()), null);
}

const tests = [
  test_sort_disputados_antiguo_a_reciente_luego_pendientes,
  test_sort_no_muta_el_array_original,
  test_jornada_en_curso_por_fecha,
  test_fallback_ultima_con_resultados,
  test_fallback_ultima_disponible,
  test_roundList_vacio_null,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/resultadosRound.test.js`
Expected: FAIL — `getCurrentRoundKey` is not a function (las 4 pruebas de current round).

- [ ] **Step 3: Add `getCurrentRoundKey` to `js/resultadosRound.js`**

Sustituir el contenido del fichero por:

```js
(function (global) {
  function sortRoundMatches(allRoundMatches) {
    return [...allRoundMatches].sort((a, b) => {
      const aPlayed = !!a.hasResult;
      const bPlayed = !!b.hasResult;
      if (aPlayed && bPlayed) return a.match.fechaTs - b.match.fechaTs;
      if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;
      return a.match.fechaTs - b.match.fechaTs;
    });
  }

  function getCurrentRoundKey(roundList, matches, matchStats, nowMs) {
    if (!roundList || roundList.length === 0) return null;
    const matchesList = matches || [];
    const msList = matchStats || [];
    const windowByKey = new Map();
    for (const entry of roundList) {
      const roundMatches = matchesList.filter(m => m.fase === entry.fase && m.ronda === entry.ronda);
      if (roundMatches.length === 0) continue;
      const minTs = Math.min(...roundMatches.map(m => m.fechaTs));
      const maxTs = Math.max(...roundMatches.map(m => m.fechaTs));
      windowByKey.set(entry.key, { minTs, maxTs });
    }
    for (const entry of roundList) {
      const w = windowByKey.get(entry.key);
      if (w && nowMs >= w.minTs * 1000 && nowMs <= w.maxTs * 1000) return entry.key;
    }
    const msEventIds = new Set(msList.filter(s => s && s.stats).map(s => s.eventId));
    for (let i = roundList.length - 1; i >= 0; i--) {
      const entry = roundList[i];
      const hasResult = matchesList.some(m =>
        m.fase === entry.fase && m.ronda === entry.ronda && msEventIds.has(m.id)
      );
      if (hasResult) return entry.key;
    }
    return roundList[roundList.length - 1].key;
  }

  const resultadosRoundApi = { sortRoundMatches, getCurrentRoundKey };
  global.resultadosRoundApi = resultadosRoundApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = resultadosRoundApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/resultadosRound.test.js`
Expected: 6 passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add js/resultadosRound.js tests/resultadosRound.test.js
git commit -m "feat(resultados): getCurrentRoundKey - jornada en curso por fecha con fallbacks"
```

---

### Task 3: Integración en `renderResultadosTab`, AppState y `index.html`

**Files:**
- Modify: `js/main.js` — AppState (~línea 38), `renderResultadosTab()` (líneas 1818-1821, 1826, 1838-1843, tras 1887), `navigateToTab()` (líneas 3165-3168)
- Modify: `index.html` — script tag de `js/resultadosRound.js` + bump `js/main.js?v=126` → `v=127`

**Interfaces:**
- Consumes:
  - `resultadosRoundApi.getCurrentRoundKey(roundList, matches, matchStats, nowMs)` → `string|null` (Task 2)
  - `resultadosRoundApi.sortRoundMatches(allRoundMatches)` → `array` (Task 1)
- Produces: comportamiento esperado de la pestaña Resultados → Jornadas.

- [ ] **Step 1: Declarar `resultadosRoundKey` en AppState**

En `js/main.js`, tras la línea 38 (`resultadosRound: null, // Ronda seleccionada en pestaña resultados`), añadir:

```js
  resultadosRoundKey: null, // Clave 'fase:ronda' seleccionada en pestaña resultados
```

- [ ] **Step 2: Cambiar el default de jornada en `renderResultadosTab`**

En `js/main.js`, declarar la flag de auto-scroll al inicio de `renderResultadosTab()`. Inmediatamente después de la línea `const container = document.getElementById('resultados-container');` (línea 1742) añadir:

```js
  let shouldAutoScroll = false;
```

Sustituir el bloque actual (líneas 1818-1821):

```js
    // Determinar ronda por defecto
    const currentKey = AppState.resultadosRoundKey || availableRoundList[availableRoundList.length - 1].key;
    const currentEntry = availableRoundList.find(r => r.key === currentKey) || availableRoundList[availableRoundList.length - 1];
    AppState.resultadosRoundKey = currentEntry.key;
```

por:

```js
    // Determinar ronda por defecto: jornada en curso por fecha o última con resultados
    shouldAutoScroll = !AppState.resultadosRoundKey;
    const defaultKey = resultadosRoundApi.getCurrentRoundKey(availableRoundList, AppState.matches, AppState.matchStats, Date.now()) || availableRoundList[availableRoundList.length - 1].key;
    const currentKey = AppState.resultadosRoundKey || defaultKey;
    const currentEntry = availableRoundList.find(r => r.key === currentKey) || availableRoundList[availableRoundList.length - 1];
    AppState.resultadosRoundKey = currentEntry.key;
```

- [ ] **Step 3: Usar `sortRoundMatches`**

En `js/main.js`:

1. Cambiar `const allRoundMatches = [];` (línea 1826) por `let allRoundMatches = [];`.
2. Sustituir el bloque de sort (líneas 1838-1843):

```js
    // Ordenar: disputados primero (más reciente), luego sin disputar (por fecha)
    allRoundMatches.sort((a, b) => {
      if (a.hasResult && !b.hasResult) return -1;
      if (!a.hasResult && b.hasResult) return 1;
      return b.match.fechaTs - a.match.fechaTs;
    });
```

por:

```js
    // Ordenar: disputados de más antiguo a más reciente, luego pendientes por fecha
    allRoundMatches = resultadosRoundApi.sortRoundMatches(allRoundMatches);
```

- [ ] **Step 4: Auto-scroll al último partido disputado**

Tras la asignación de `container.innerHTML` (líneas 1884-1887, justo después del cierre `  `;` de la línea 1887) añadir:

```js

  // Auto-scroll al último partido disputado cuando la jornada se auto-seleccionó
  if (shouldAutoScroll) {
    const scrollEl = container.querySelector('.resultados-scroll');
    const playedMatches = [...container.querySelectorAll('.resultados-match:not(.no-result)')];
    const lastPlayed = playedMatches[playedMatches.length - 1];
    if (scrollEl && lastPlayed) {
      const sRect = scrollEl.getBoundingClientRect();
      const lRect = lastPlayed.getBoundingClientRect();
      scrollEl.scrollTop += (lRect.top - sRect.top) - (sRect.height / 2) + (lRect.height / 2);
    }
  }
```

- [ ] **Step 5: Resetear `resultadosRoundKey` al salir de la pestaña**

En `navigateToTab()` (bloque de líneas 3165-3168):

```js
  // Resetear ronda de resultados al salir de la pestaña
  if (tabName !== 'resultados') {
    AppState.resultadosRound = null;
  }
```

por:

```js
  // Resetear ronda de resultados al salir de la pestaña
  if (tabName !== 'resultados') {
    AppState.resultadosRound = null;
    AppState.resultadosRoundKey = null;
  }
```

- [ ] **Step 6: Añadir script y cache-busting en `index.html`**

En `index.html`, añadir justo antes de la línea `<script src="js/main.js?v=126"></script>` (línea 327):

```html
  <script src="js/resultadosRound.js?v=1"></script>
```

Y cambiar `js/main.js?v=126` → `js/main.js?v=127`.

- [ ] **Step 7: Verificar**

Run:
```bash
node --check js/main.js
node --check js/resultadosRound.js
node tests/resultadosRound.test.js
```
Expected: `node --check` sin salida de error, y 6 passing, 0 failing.

Verificación manual sugerida (opcional): `node server.mjs` y abrir Resultados → Jornadas; debe aparecer la Jornada 1 (en curso, 8-10 Sep 2026) con auto-scroll al último partido con resultado.

- [ ] **Step 8: Commit**

```bash
git add js/main.js index.html
git commit -m "feat(resultados): jornada en curso por defecto + auto-scroll al ultimo resultado"
```