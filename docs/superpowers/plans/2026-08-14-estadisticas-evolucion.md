# Pestaña Estadísticas — Evolución de puntos por jornada: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una pestaña "Estadísticas" (6º item de la barra inferior) con un gráfico SVG de líneas que muestra la evolución de puntos acumulados por jornada de cada jugador, con selector de jugadores (chips con scroll) y conmutador de tipo de puntos (Total, Pronósticos, Plantilla, Clasificación, Eliminatorias).

**Architecture:** Nuevo módulo `js/stats.js` (IIFE, patrón espejo de `js/eliminatorias.js`) con funciones puras de cálculo (testables con node) y funciones de render del DOM. `js/main.js` solo añade el despacho `renderEstadisticasTab()` en la navegación; los datos ya están en `AppState` (userPoints, squadsCache, finalPredictionsCache, matches, matchStats, players). `index.html` añade el item de navegación, la sección de tab y el `<script>`.

**Tech Stack:** HTML5, CSS3 vanilla (variables `:root`), JavaScript ES6+ vanilla, SVG inline. Sin librerías.

## Global Constraints

- Respetar el estilo mobile vertical: ancho máx `460px`, áreas seguras, táctil ≥44px, sin scroll horizontal involuntario.
- Reutilizar variables CSS de `:root`: `--ucl-card`, `--border-color`, `--accent-primary`, `--accent-purple`, `--accent-gold`, `--accent-cyan`, `--text-muted`, `--text-secondary`, `--font-size-*`, `--radius-*`.
- No usar frameworks CSS ni librerías JS.
- Cache-busting (norma AGENTS.md): incrementar versiones en `index.html` — `css/styles.css?v=55` → `?v=56`, `js/main.js?v=77` → `?v=78`, añadir `js/stats.js?v=1`.
- Funciones puras separadas del DOM y testables con `node tests/estadisticas.test.js`.
- El eje X (línea temporal) es fijo: posiciones 0–7 = jornadas de liga `J1`–`J8` (`match.ronda`, `fase==='liga'`); 8–12 = fases `16, 8, 4, Semis, Final`.
- Guard de fase simple: `isFasePretemporada()` → mensaje "Disponible al inicio de la competición"; sin `matchStats` → "No hay resultados disponibles aún".
- Clasificación: salto único `0→total` en la posición J8 (índice 7) solo si `isLeagueComplete()`.
- Eliminatorias: puntos por equipo en la posición de `reachedRank` (1→8, 2→9, 3→10, 4→11, 5/6→12).
- Total = suma de las 4 fuentes posición a posición.
- No cambiar los cálculos de puntos existentes de `main.js`.

---

### Task 1: Esqueleto `js/stats.js` + `buildTimeline()`

**Files:**
- Create: `js/stats.js`
- Test: `tests/estadisticas.test.js`

**Interfaces:**
- Produces: módulo IIFE con patrón de `eliminatorias.js` (globals + `module.exports` guard); función `buildTimeline() → [{ point: 0..12, label, kind }]`; helpers internos `emptySeries()` y `toCumulative(acc)` (aún sin exportar).

- [ ] **Step 1: Write the failing test**

```js
const assert = require('assert');
const { buildTimeline } = require('../js/stats.js');

function test_buildTimeline_13_posiciones_ordenadas() {
  const tl = buildTimeline();
  assert.strictEqual(tl.length, 13);
  assert.deepStrictEqual(tl.map(t => t.point), [0,1,2,3,4,5,6,7,8,9,10,11,12]);
  // Jornadas de liga
  assert.strictEqual(tl[0].label, 'J1');
  assert.strictEqual(tl[7].label, 'J8');
  assert.strictEqual(tl[0].kind, 'liga');
  // Fases de eliminatorias
  assert.deepStrictEqual(tl.slice(8).map(t => t.kind), ['fase','fase','fase','fase','fase']);
  assert.deepStrictEqual(tl.slice(8).map(t => t.label), ['16','8','4','Semis','Final']);
}

test_buildTimeline_13_posiciones_ordenadas();
console.log('OK buildTimeline');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas.test.js`
Expected: FAIL con `Cannot find module '../js/stats.js'`

- [ ] **Step 3: Write minimal implementation**

Crear `js/stats.js` con el esqueleto del módulo y `buildTimeline`:

```js
(function (global) {
  function buildTimeline() {
    const items = [];
    for (let r = 1; r <= 8; r++) {
      items.push({ point: r - 1, label: `J${r}`, kind: 'liga', ronda: r });
    }
    const fases = [['16', '16'], ['8', '8'], ['4', '4'], ['semis', 'Semis'], ['final', 'Final']];
    fases.forEach(([fase, label], i) => items.push({ point: 8 + i, label, kind: 'fase', fase }));
    return items;
  }

  function emptySeries() {
    return { series: Array(13).fill(0), hasData: false };
  }

  function toCumulative(acc) {
    let running = 0;
    const out = Array(13).fill(0);
    for (let p = 0; p < 13; p++) {
      running += acc[p] || 0;
      out[p] = running;
    }
    return out;
  }

  global.buildTimeline = buildTimeline;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildTimeline };
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas.test.js`
Expected: PASS, imprime `OK buildTimeline`

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas.test.js
git commit -m "feat: esqueleto stats.js y buildTimeline con tests"
```

---

### Task 2: Series de Pronósticos y Plantilla

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas.test.js`

**Interfaces:**
- Consumes: `emptySeries()`, `toCumulative(acc)` (Task 1).
- Produces: `calcPredictionSeries(matchDetails) → { series: number[13], hasData: boolean }`; `calcSquadSeries(squadPoints, matchesById) → { series: number[13], hasData: boolean }`; helper interno `positionForMatch(match) → number|null`.

- [ ] **Step 1: Write the failing test**

Añadir al final de `tests/estadisticas.test.js` (antes de `console.log`):

```js
function test_calcPredictionSeries_acumulado_solo_liga() {
  const matchDetails = [
    { match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 },
    { match: { id: 2, ronda: 1, fase: 'liga' }, points: 3 },
    { match: { id: 3, ronda: 2, fase: 'liga' }, points: 15 },
    { match: { id: 4, ronda: 3, fase: '16' }, points: 5 }, // fuera de liga → ignorado
  ];
  const r = calcPredictionSeries(matchDetails);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 11);
  assert.strictEqual(r.series[1], 26);
  assert.strictEqual(r.series[2], 26); // el partido de fase '16' no cuenta
  assert.strictEqual(r.series[12], 26);
}

function test_calcPredictionSeries_sin_datos() {
  const r = calcPredictionSeries([]);
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));
}

function test_calcSquadSeries_por_jornada_y_fase() {
  const squadPoints = { playerDetails: [{ jugador: {}, puntosTotal: 15, partidos: [
    { eventId: 1, puntos: 5 },
    { eventId: 2, puntos: 4 },
    { eventId: 11, puntos: 6 },
  ] }] };
  const matchesById = {
    1: { id: 1, fase: 'liga', ronda: 1 },
    2: { id: 2, fase: 'liga', ronda: 1 },
    11: { id: 11, fase: '16' },
  };
  const r = calcSquadSeries(squadPoints, matchesById);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 9);      // J1: 5+4
  assert.strictEqual(r.series[1], 9);      // J2 sin datos → se mantiene
  assert.strictEqual(r.series[7], 9);
  assert.strictEqual(r.series[8], 15);     // fase 16: +6
  assert.strictEqual(r.series[12], 15);
}

function test_calcSquadSeries_evento_sin_match_ignorado() {
  const squadPoints = { playerDetails: [{ jugador: {}, puntosTotal: 3, partidos: [
    { eventId: 999, puntos: 3 },
  ] }] };
  const r = calcSquadSeries(squadPoints, {});
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));
}
```

Actualizar la primera línea del fichero para importar las nuevas funciones:

```js
const { buildTimeline, calcPredictionSeries, calcSquadSeries } = require('../js/stats.js');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas.test.js`
Expected: FAIL con `calcPredictionSeries is not defined`

- [ ] **Step 3: Write minimal implementation**

Añadir en `js/stats.js` (dentro del IIFE, después de `toCumulative`):

```js
  function positionForMatch(match) {
    if (match.fase === 'liga') {
      const ronda = Number(match.ronda);
      if (ronda >= 1 && ronda <= 8) return ronda - 1;
      return null;
    }
    const faseMap = { '16': 8, '8': 9, '4': 10, 'semis': 11, 'final': 12 };
    return faseMap[match.fase] ?? null;
  }

  function calcPredictionSeries(matchDetails) {
    const acc = Array(13).fill(0);
    let hasData = false;
    for (const d of matchDetails || []) {
      const m = d.match;
      if (!m || m.fase !== 'liga') continue;
      const ronda = Number(m.ronda);
      if (ronda < 1 || ronda > 8) continue;
      acc[ronda - 1] += d.points || 0;
      hasData = true;
    }
    if (!hasData) return emptySeries();
    return { series: toCumulative(acc), hasData: true };
  }

  function calcSquadSeries(squadPoints, matchesById) {
    const acc = Array(13).fill(0);
    let hasData = false;
    for (const pd of squadPoints?.playerDetails || []) {
      for (const partido of pd.partidos || []) {
        const match = matchesById?.[partido.eventId];
        if (!match) continue;
        const pos = positionForMatch(match);
        if (pos === null) continue;
        acc[pos] += partido.puntos || 0;
        hasData = true;
      }
    }
    if (!hasData) return emptySeries();
    return { series: toCumulative(acc), hasData: true };
  }
```

Actualizar los exports:

```js
  global.buildTimeline = buildTimeline;
  global.calcPredictionSeries = calcPredictionSeries;
  global.calcSquadSeries = calcSquadSeries;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildTimeline, calcPredictionSeries, calcSquadSeries };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas.test.js`
Expected: PASS con `OK buildTimeline` y los tests de las nuevas series

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas.test.js
git commit -m "feat: series acumuladas de pronósticos y plantilla con tests"
```

---

### Task 3: Series de Clasificación, Eliminatorias, Total y orquestador

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas.test.js`

**Interfaces:**
- Consumes: `emptySeries()`, `toCumulative()`, `calcPredictionSeries()`, `calcSquadSeries()` (Tasks 1-2).
- Produces: `calcClassificationSeries(total, leagueComplete) → { series, hasData }`; `calcEliminatoriasSeries(teamDetails) → { series, hasData }`; `sumSeries(results) → { series, hasData }`; `isLeagueComplete(matches, matchStats) → boolean`; `getSeriesBySource(source, userData) → { series, hasData }` donde `userData = { matchDetails, squadPoints, classificationTotal, leagueComplete, eliminatoriasTeamDetails, matchesById }`.

- [ ] **Step 1: Write the failing test**

Añadir al final de `tests/estadisticas.test.js`:

```js
function test_calcClassificationSeries_salto_en_J8_solo_liga_completa() {
  const r = calcClassificationSeries(100, true);
  assert.strictEqual(r.hasData, true);
  assert.deepStrictEqual(r.series.slice(0, 7), Array(7).fill(0));
  assert.strictEqual(r.series[7], 100);
  assert.strictEqual(r.series[12], 100);
}

function test_calcClassificationSeries_liga_incompleta_sin_datos() {
  const r = calcClassificationSeries(100, false);
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));
}

function test_calcEliminatoriasSeries_saltos_por_fase_alcanzada() {
  const teamDetails = [
    { teamId: 1, reachedRank: 1, points: 10 },
    { teamId: 2, reachedRank: 4, points: 50 },
    { teamId: 3, reachedRank: 6, points: 100 },
    { teamId: 4, reachedRank: 5, points: 75 },
  ];
  const r = calcEliminatoriasSeries(teamDetails);
  assert.strictEqual(r.hasData, true);
  // pos 8 (16): 10 ; pos 11 (Semis): 10+50=60 ; pos 12 (Final): 60+100+75=235
  assert.strictEqual(r.series[7], 0);
  assert.strictEqual(r.series[8], 10);
  assert.strictEqual(r.series[11], 60);
  assert.strictEqual(r.series[12], 235);
}

function test_sumSeries_suma_posicion_a_posicion() {
  const a = { series: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], hasData: true };
  const b = { series: [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], hasData: true };
  const r = sumSeries([a, b]);
  assert.strictEqual(r.series[0], 1);
  assert.strictEqual(r.series[2], 2);
  assert.strictEqual(r.hasData, true);
}

function test_sumSeries_sin_datos() {
  const r = sumSeries([emptySeries(), emptySeries()]);
  assert.strictEqual(r.hasData, false);
}

function test_isLeagueComplete() {
  const matches = [{ id: 1, fase: 'liga' }, { id: 2, fase: 'liga' }, { id: 3, fase: '16' }];
  assert.strictEqual(isLeagueComplete(matches, [{ eventId: 1 }, { eventId: 2 }]), true);
  assert.strictEqual(isLeagueComplete(matches, [{ eventId: 1 }]), false);
  assert.strictEqual(isLeagueComplete(matches, []), false);
  assert.strictEqual(isLeagueComplete([], []), false);
}

function test_getSeriesBySource_total_suma_todas() {
  const userData = {
    matchDetails: [{ match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 }],
    squadPoints: { playerDetails: [{ jugador: {}, puntosTotal: 4, partidos: [{ eventId: 1, puntos: 4 }] }] },
    classificationTotal: 100,
    leagueComplete: true,
    eliminatoriasTeamDetails: [{ teamId: 1, reachedRank: 6, points: 100 }],
    matchesById: { 1: { id: 1, fase: 'liga', ronda: 1 } },
  };
  const r = getSeriesBySource('total', userData);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 12);      // 8 + 4
  assert.strictEqual(r.series[7], 112);     // +100 clasificación
  assert.strictEqual(r.series[12], 212);    // +100 eliminatorias
}

function test_getSeriesBySource_pronosticos_elige_serie_correcta() {
  const userData = {
    matchDetails: [{ match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 }],
    squadPoints: { playerDetails: [] },
    classificationTotal: 0,
    leagueComplete: false,
    eliminatoriasTeamDetails: [],
    matchesById: {},
  };
  const r = getSeriesBySource('pronosticos', userData);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 8);
  assert.strictEqual(r.series[12], 8);
}
```

Actualizar la primera línea:

```js
const { buildTimeline, calcPredictionSeries, calcSquadSeries, calcClassificationSeries, calcEliminatoriasSeries, sumSeries, isLeagueComplete, getSeriesBySource } = require('../js/stats.js');
```

Nota: los tests usan `emptySeries()` aunque no se exporta → importarla también en la línea del require (se exportará en el Step 3) o sustituir por `sumSeries([], [])`... **La exportaremos**: añadir `emptySeries` a `module.exports` en el Step 3 para que el test la use.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas.test.js`
Expected: FAIL con `calcClassificationSeries is not defined` (y/o `emptySeries`)

- [ ] **Step 3: Write minimal implementation**

Añadir en `js/stats.js` (dentro del IIFE):

```js
  function calcClassificationSeries(total, leagueComplete) {
    if (!leagueComplete || !total) return emptySeries();
    const series = Array(13).fill(0);
    for (let p = 7; p < 13; p++) series[p] = total;
    return { series, hasData: true };
  }

  function calcEliminatoriasSeries(teamDetails) {
    const acc = Array(13).fill(0);
    const rankPos = { 1: 8, 2: 9, 3: 10, 4: 11, 5: 12, 6: 12 };
    let hasData = false;
    for (const td of teamDetails || []) {
      const pos = rankPos[td.reachedRank];
      if (pos === undefined) continue;
      acc[pos] += td.points || 0;
      hasData = true;
    }
    if (!hasData) return emptySeries();
    return { series: toCumulative(acc), hasData: true };
  }

  function sumSeries(results) {
    const out = Array(13).fill(0);
    let hasData = false;
    for (const r of results || []) {
      if (!r) continue;
      hasData = hasData || r.hasData;
      for (let p = 0; p < 13; p++) out[p] += r.series[p] || 0;
    }
    return { series: out, hasData };
  }

  function isLeagueComplete(matches, matchStats) {
    const league = (matches || []).filter(m => m.fase === 'liga');
    if (!league.length) return false;
    const ids = new Set((matchStats || []).map(ms => ms.eventId));
    return league.every(m => ids.has(m.id));
  }

  function getSeriesBySource(source, userData) {
    switch (source) {
      case 'pronosticos':
        return calcPredictionSeries(userData?.matchDetails);
      case 'plantilla':
        return calcSquadSeries(userData?.squadPoints, userData?.matchesById);
      case 'clasificacion':
        return calcClassificationSeries(userData?.classificationTotal, userData?.leagueComplete);
      case 'eliminatorias':
        return calcEliminatoriasSeries(userData?.eliminatoriasTeamDetails);
      case 'total':
        return sumSeries([
          calcPredictionSeries(userData?.matchDetails),
          calcSquadSeries(userData?.squadPoints, userData?.matchesById),
          calcClassificationSeries(userData?.classificationTotal, userData?.leagueComplete),
          calcEliminatoriasSeries(userData?.eliminatoriasTeamDetails),
        ]);
      default:
        return emptySeries();
    }
  }
```

Actualizar los exports:

```js
  global.emptySeries = emptySeries;
  global.buildTimeline = buildTimeline;
  global.calcPredictionSeries = calcPredictionSeries;
  global.calcSquadSeries = calcSquadSeries;
  global.calcClassificationSeries = calcClassificationSeries;
  global.calcEliminatoriasSeries = calcEliminatoriasSeries;
  global.sumSeries = sumSeries;
  global.isLeagueComplete = isLeagueComplete;
  global.getSeriesBySource = getSeriesBySource;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { emptySeries, buildTimeline, calcPredictionSeries, calcSquadSeries, calcClassificationSeries, calcEliminatoriasSeries, sumSeries, isLeagueComplete, getSeriesBySource };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas.test.js`
Expected: PASS, todos los tests

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas.test.js
git commit -m "feat: series de clasificación, eliminatorias y total con orquestador"
```

---

### Task 4: Render — pestaña, chips, gráfico y wiring (index.html + main.js)

**Files:**
- Modify: `js/stats.js`
- Modify: `js/main.js` (despacho en `navigateToTab` y `forceNavigateToTab`)
- Modify: `index.html` (item nav, tab, script, cache-busting)

**Interfaces:**
- Consumes: funciones puras de Tasks 1-3 y helpers globales de `main.js`/`eliminatorias.js`: `AppState`, `isFasePretemporada()`, `skeletonRows(n)`, `fetchPlayers()`, `fetchMatchStats()`, `fetchAllPredictions()`, `calculateUserTotalPoints(u)`, `calculateSquadPoints(squad, matchStats)`, `calculateClassificationPoints(u)`, `computeReachedPhases(matches, matchStats)`, `calculateEliminatoriasPoints(fp, reachedPhases)`, `showToast(msg)`, `esc(s)`.
- Produces: `renderEstadisticasTab()` (global, despachado desde la navegación).

- [ ] **Step 1: Añadir la sección y el item de navegación en `index.html`**

1. Tras el bloque del nav item de Plantilla (línea ~211-217), añadir el 6º item:

```html
      <a href="#" class="nav-item" data-tab="estadisticas">
        <svg viewBox="0 0 24 24">
          <path d="M3 13h4v8H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
        </svg>
        <span>Estadísticas</span>
      </a>
```

2. Tras `</section>` de `tab-plantilla` (línea ~175), añadir la sección:

```html
      <!-- Tab: Estadísticas -->
      <section id="tab-estadisticas" class="tab-page">
        <div class="section-header">
          <h2 class="section-title">📊 Estadísticas</h2>
        </div>
        <div id="estadisticas-container"></div>
      </section>
```

3. Scripts: añadir antes de `main.js`:

```html
  <script src="js/stats.js?v=1"></script>
```

4. Cache-busting: `css/styles.css?v=55` → `?v=56`; `js/main.js?v=77` → `?v=78`.

- [ ] **Step 2: Despachar `renderEstadisticasTab()` en `main.js`**

En `navigateToTab` (tras la línea `if (tabName === 'plantilla') renderPlantillaTab();`, línea ~2640) añadir:

```js
  if (tabName === 'estadisticas') renderEstadisticasTab();
```

En `forceNavigateToTab` (tras la línea `if (tabName === 'plantilla') renderPlantillaTab();`, línea ~2865) añadir:

```js
  if (tabName === 'estadisticas') renderEstadisticasTab();
```

- [ ] **Step 3: Implementar `renderEstadisticasTab()` y los datos por usuario en `js/stats.js`**

Añadir dentro del IIFE (tras las funciones puras). Incluye la paleta y los estados:

```js
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const SOURCES = [
    { key: 'total', label: 'Total' },
    { key: 'pronosticos', label: 'Pronóst.' },
    { key: 'plantilla', label: 'Plantilla' },
    { key: 'clasificacion', label: 'Clasif.' },
    { key: 'eliminatorias', label: 'Eliminat.' },
  ];
  const LINE_COLORS = ['var(--accent-primary)', 'var(--accent-purple)', 'var(--accent-gold)', 'var(--accent-cyan)', '#EC4899', '#F97316', '#22C55E', '#3B82F6'];

  function statsEmpty(message) {
    return `<div class="stats-empty">${esc(message)}</div>`;
  }

  function buildMatchesById() {
    const map = {};
    for (const m of AppState.matches || []) map[m.id] = m;
    return map;
  }

  function buildUserData(username) {
    const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);
    const squad = AppState.squadsCache?.[username];
    const squadPoints = (squad && squad.length) ? calculateSquadPoints(squad, AppState.matchStats) : { playerDetails: [] };
    const fp = AppState.finalPredictionsCache?.[username];
    const elim = fp ? calculateEliminatoriasPoints(fp, reachedPhases) : { teamDetails: [] };
    return {
      matchDetails: AppState.userPoints[username]?.matchDetails || [],
      squadPoints,
      classificationTotal: calculateClassificationPoints(username).totalPoints,
      leagueComplete: isLeagueComplete(AppState.matches, AppState.matchStats),
      eliminatoriasTeamDetails: elim.teamDetails,
      matchesById: buildMatchesById(),
    };
  }

  function renderEstadisticasTab() {
    const container = document.getElementById('estadisticas-container');
    if (!container) return;

    if (isFasePretemporada()) {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Disponible al inicio de la competición</div>';
      return;
    }

    container.innerHTML = skeletonRows(4);
    Promise.all([fetchPlayers(), fetchMatchStats(), fetchAllPredictions()]).then(() => {
      if (!AppState.matchStats.length) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No hay resultados disponibles aún</div>';
        return;
      }
      for (const p of AppState.players || []) {
        AppState.userPoints[p.name] = calculateUserTotalPoints(p.name);
      }
      container.innerHTML = renderStatsContent();
      bindStatsEvents();
    });
  }
```

- [ ] **Step 4: Implementar `renderStatsContent()`, chips, gráfico y leyenda**

```js
  function statsSourceLabel(key) {
    return (SOURCES.find(s => s.key === key) || SOURCES[0]).label;
  }

  function userSourceTotal(username, source) {
    const r = getSeriesBySource(source, buildUserData(username));
    return r.series[12] || 0;
  }

  function orderPlayers(source) {
    const players = [...(AppState.players || [])];
    const me = AppState.currentUser?.name;
    players.sort((a, b) => {
      if (a.name === me) return -1;
      if (b.name === me) return 1;
      return userSourceTotal(b.name, source) - userSourceTotal(a.name, source);
    });
    return players;
  }

  function initStatsState(source) {
    if (!AppState.estadisticasPointType) AppState.estadisticasPointType = 'total';
    if (!AppState.estadisticasVisibleUsers) {
      const me = AppState.currentUser?.name;
      const top = orderPlayers('total').slice(0, 3).map(p => p.name);
      AppState.estadisticasVisibleUsers = new Set([me, ...top].filter(Boolean));
    }
  }

  function renderStatsContent() {
    const source = AppState.estadisticasPointType || 'total';
    initStatsState(source);
    const visibleSet = AppState.estadisticasVisibleUsers;
    const players = orderPlayers(source);

    const segButtons = SOURCES.map(s =>
      `<button class="stats-source ${s.key === source ? 'active' : ''}" data-source="${s.key}">${s.label}</button>`
    ).join('');

    const chips = players.map(p => {
      const on = visibleSet.has(p.name);
      return `<button class="stats-chip ${on ? 'active' : 'off'}" data-user="${esc(p.name)}">${esc(p.avatar || '⚽')} ${esc(p.name)}</button>`;
    }).join('');

    return `
      <div class="stats-card">
        <div class="stats-source-seg">${segButtons}</div>
      </div>
      <div class="stats-card">
        <div class="stats-chips-header">
          <span class="stats-chips-counter">Jugadores: ${visibleSet.size} visibles de ${players.length}</span>
          <button class="stats-chips-action" data-action="todos">Todos</button>
          <button class="stats-chips-action" data-action="nadie">Nadie</button>
        </div>
        <div class="stats-card-title">Evolución de puntos por jornada</div>
        <div class="stats-chips-row">${chips}</div>
        ${buildLineChart(players, visibleSet, source)}
        ${buildLegend(players, visibleSet, source)}
      </div>`;
  }

  function buildLineChart(players, visibleSet, source) {
    const visible = players.filter(p => visibleSet.has(p.name));
    const seriesByUser = {};
    let maxVal = 10;
    for (const p of visible) {
      const r = getSeriesBySource(source, buildUserData(p.name));
      if (!r.hasData) continue;
      seriesByUser[p.name] = r.series;
      maxVal = Math.max(maxVal, ...r.series);
    }
    const names = Object.keys(seriesByUser);
    if (!names.length) return statsEmpty('Añade jugadores para ver el gráfico');

    const W = 320, H = 170, PAD = 26;
    const x = (p) => PAD + (p / 12) * (W - PAD * 2);
    const y = (v) => H - PAD - (v / maxVal) * (H - PAD * 2);

    const polylines = names.map((name, i) => {
      const color = LINE_COLORS[i % LINE_COLORS.length];
      const pts = seriesByUser[name].map((v, p) => `${x(p).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      const last = seriesByUser[name].length - 1;
      const lx = x(last), ly = y(seriesByUser[name][last]);
      return `
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${lx}" cy="${ly}" r="4" fill="${color}" stroke="#0F172A" stroke-width="1.5" class="stats-lastpoint" data-user="${esc(name)}"/>`;
    }).join('');

    const grid = [0, 0.5, 1].map(f => y(maxVal * f));
    const gridLines = grid.map((gy, gi) =>
      `<line x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}" stroke="${gi === 0 ? '#334155' : '#1E293B'}" stroke-width="1"/>`
    ).join('');

    const labels = buildTimeline().map(t =>
      `<text x="${x(t.point)}" y="${H - 6}" font-size="7.5" fill="#64748B" text-anchor="middle">${t.label}</text>`
    ).join('');

    return `
      <svg class="stats-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${gridLines}
        ${polylines}
        ${labels}
      </svg>`;
  }

  function buildLegend(players, visibleSet, source) {
    const visible = players.filter(p => visibleSet.has(p.name));
    const items = visible.map((p, i) => {
      const r = getSeriesBySource(source, buildUserData(p.name));
      return `<span><i style="background:${LINE_COLORS[i % LINE_COLORS.length]}"></i>${esc(p.name)} · ${r.series[12] || 0}</span>`;
    }).join('');
    return `<div class="stats-legend">${items || statsEmpty('Añade jugadores para ver la leyenda')}</div>`;
  }
```

- [ ] **Step 5: Implementar `bindStatsEvents()` (selector, chips, Todos/Nadie, punto final)**

```js
  function bindStatsEvents() {
    const container = document.getElementById('estadisticas-container');
    if (!container) return;

    container.querySelectorAll('.stats-source').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasPointType = btn.dataset.source;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = btn.dataset.user;
        const set = AppState.estadisticasVisibleUsers;
        if (set.has(user)) set.delete(user); else set.add(user);
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-chips-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const set = AppState.estadisticasVisibleUsers;
        if (btn.dataset.action === 'todos') {
          (AppState.players || []).forEach(p => set.add(p.name));
        } else {
          set.clear();
        }
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-lastpoint').forEach(circle => {
      circle.addEventListener('click', () => {
        const user = circle.dataset.user;
        const source = AppState.estadisticasPointType || 'total';
        const r = getSeriesBySource(source, buildUserData(user));
        const tl = buildTimeline();
        const lastIdx = 12;
        showToast(`${esc(user)} · ${r.series[lastIdx]} pts (${tl[lastIdx].label})`);
      });
    });
  }
```

- [ ] **Step 6: Comprobar en consola que no hay errores y validar manualmente el flujo básico**

Run: `python3 -m http.server 8000` en `/home/ldoc/Proyectos/porra-spa` y abrir `http://localhost:8000` en vista móvil vertical.

Validar:
- La barra inferior muestra 6 items con etiquetas completas; al pulsar "Estadísticas" se abre la pestaña.
- Con `matchStats` vacíos aparece "No hay resultados disponibles aún".
- En FASE_PRETEMPORADA aparece "Disponible al inicio de la competición".

- [ ] **Step 7: Commit**

```bash
git add index.html js/main.js js/stats.js
git commit -m "feat: pestaña de estadísticas con render y wiring de navegación"
```

---

### Task 5: CSS — selector segmentado, chips, gráfico y leyenda

**Files:**
- Modify: `css/styles.css` (añadir al final del fichero)

**Interfaces:**
- Consumes: clases generadas en Task 4: `.stats-card`, `.stats-source-seg`, `.stats-source`, `.stats-chip`, `.stats-chips-header`, `.stats-chips-counter`, `.stats-chips-action`, `.stats-card-title`, `.stats-chips-row`, `.stats-line-chart`, `.stats-legend`, `.stats-empty`.

- [ ] **Step 1: Añadir los estilos**

Añadir al final de `css/styles.css`:

```css
/* ============================================================
   PESTAÑA DE ESTADÍSTICAS
   ============================================================ */
.stats-card {
  background: var(--ucl-card);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stats-card-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-primary);
}

.stats-source-seg {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  background: var(--ucl-surface);
  padding: 4px;
  border-radius: 12px;
}

.stats-source {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  padding: 8px 0;
  border-radius: 9px;
  cursor: pointer;
  min-height: 32px;
}

.stats-source.active {
  background: var(--accent-purple);
  color: #fff;
}

.stats-chips-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.stats-chips-counter {
  flex: 1;
}

.stats-chips-action {
  background: none;
  border: none;
  color: var(--accent-purple);
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  padding: 6px 4px;
  min-height: 32px;
}

.stats-chips-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 2px 8px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.stats-chips-row::-webkit-scrollbar {
  display: none;
}

.stats-chip {
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  background: var(--ucl-surface);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 6px 10px;
  border-radius: var(--radius-full);
  cursor: pointer;
  min-height: 32px;
}

.stats-chip.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.stats-chip.off {
  opacity: 0.45;
}

.stats-line-chart {
  width: 100%;
  height: auto;
}

.stats-legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 10px;
  color: var(--text-secondary);
}

.stats-legend i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}

.stats-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stats-empty {
  padding: 20px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.stats-lastpoint {
  cursor: pointer;
}
```

- [ ] **Step 2: Validar visualmente en móvil vertical**

Run: recargar `http://localhost:8000` (forzar cache: los versionados `?v=` cambian). Verificar:
- Selector segmentado de 5 opciones centrado y legible.
- Chips en una sola fila con scroll horizontal; contador y Todos/Nadie alineados.
- Gráfico SVG fluido sin scroll horizontal involuntario.
- Leyenda con color + nombre + valor final.
- Punto final de cada línea visible y con cursor pointer.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: estilos de la pestaña de estadísticas"
```

---

### Task 6: Documentación en AGENTS.md y validación final

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Documentar la pestaña en `AGENTS.md`**

En la sección de pestañas (listado de `tab-*`), añadir:

```markdown
- `tab-estadisticas`: Gráfico de evolución de puntos acumulados por jornada y jugador, con selector de jugadores (chips con scroll) y conmutador de tipo de puntos (Total, Pronósticos, Plantilla, Clasificación, Eliminatorias). Implementado en `js/stats.js` (cálculos puros + render). Guard de fase simple: solo `FASE_PRETEMPORADA` oculta la sección.
```

- [ ] **Step 2: Validación manual completa**

Con datos de prueba en `matchStats` (subir al menos un partido con resultado):
1. Gráfico muestra la evolución acumulada de los jugadores visibles por defecto (actual + top 3).
2. Cambiar de tipo de puntos actualiza el gráfico manteniendo jugadores visibles.
3. Chips: tocar añade/quita; contador y Todos/Nadie funcionan.
4. Tocar el punto final de una línea muestra el toast con el valor exacto.
5. Sin errores en consola; scroll fluido; estilos consistentes (modo oscuro).
6. Verificar cache-busting: `index.html` apunta a `styles.css?v=56`, `main.js?v=78`, `stats.js?v=1`.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: documentar pestaña de estadísticas en AGENTS.md"
```

---

## Self-Review

**Cobertura del spec:**
- 6º item barra inferior con etiqueta completa → Task 4.
- Gráfico SVG de líneas sin librerías → Task 4 (`buildLineChart`).
- Selector 5 tipos de puntos segmentado → Task 4 (`SOURCES`, `.stats-source-seg`).
- Chips con scroll + contador + Todos/Nadie → Task 4 + CSS Task 5.
- Toast al tocar punto final → Task 4 (`bindStatsEvents`).
- Guard de fase simple (pretemporada) → Task 4 (`isFasePretemporada`).
- Clasificación salta en J8 solo si liga completa → Task 3 (`calcClassificationSeries`, `isLeagueComplete`).
- Eliminatorias por fase alcanzada → Task 3 (`calcEliminatoriasSeries`).
- Total = suma de las 4 → Task 3 (`sumSeries`, `getSeriesBySource`).
- Orden de chips: actual primero, resto por puntos de la fuente → Task 4 (`orderPlayers`).
- Default visible: actual + top 3 → Task 4 (`initStatsState`).
- Tests de funciones puras → Tasks 1-3.
- Cache-busting → Task 4.
- AGENTS.md → Task 6.

**Placeholders:** Ninguno; todos los pasos de código incluyen implementación completa.

**Consistencia de tipos:** `{ series: number[13], hasData: boolean }` consistente en Tasks 1-3; `getSeriesBySource(source, userData)` firma idéntica en Task 3 y usos de Task 4. Nombres `estadisticasPointType` / `estadisticasVisibleUsers` usados de forma idéntica en Task 4.
