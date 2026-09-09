# Indicador de tendencia en Clasificación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en `tab-clasificacion` un indicador por usuario (▲/▼/＝ apilado direccional, verde/rojo/azul) con los puestos ganados/perdidos entre los dos últimos días con partidos.

**Architecture:** Nuevo módulo IIFE `js/trend.js` (patrón `js/hoyPartidos.js:1-225`) con puras testeables en node (días, filtrado, trend-map, celda HTML). En `js/main.js` solo añadidos aditivos: `computeRankingForStats` (reutiliza `computeUserRealPoints` con swap temporal de `matchStats` + cachés en `try/finally`, sin modificar ninguna función existente) y hook fail-safe en `renderClasificacionTab`. CSS con grid condicional `.with-trend`.

**Tech Stack:** HTML5, CSS3 Vanilla (variables `:root` en `css/styles.css`), JavaScript ES6+ Vanilla IIFE. Tests en Node con `assert` (`node tests/*.test.js`, patrón `tests/hoyPartidos.test.js`).

## Global Constraints

- Cache-busting (AGENTS.md): al tocar `css/styles.css`, `js/main.js` o añadir JS, incrementar `?v=` en `index.html`. Versiones actuales: `css/styles.css?v=89`, `js/main.js?v=127` → nuevas: `css/styles.css?v=90`, `js/main.js?v=128`, `js/trend.js?v=1`.
- No modificar el comportamiento de funciones existentes: solo parámetros opcionales nuevos con defaults que preservan la salida actual.
- `js/trend.js` no accede a `AppState`/`document` en tiempo de carga (debe ser `require`-able en node).
- Soporte móvil 480px sin scroll horizontal; spans no interactivos (sin requisito táctil 44px).
- Todo cómputo histórico envuelto en `try/catch` (fail-safe: tabla sin indicadores, nunca rota).
- Spec: `docs/superpowers/specs/2026-09-09-clasificacion-trend-design.md`.

---

## File Structure

- **Create `js/trend.js`**: IIFE `trendApi` con `getMatchDayKey`, `getLastTwoMatchDays`, `filterMatchStatsUpTo`, `countUserPredictionsInSubset`, `computeTrendMap`, `buildTrendCellHtml`. Responsabilidad: lógica pura del indicador. No toca `AppState` ni DOM.
- **Create `tests/trend.test.js`**: tests node de las 6 funciones (patrón `tests/hoyPartidos.test.js:1-7` con `require('../js/trend.js')`).
- **Modify `js/main.js`**: (a) `buildClasificacionHeader(showTrendCol = false)` y `buildClasificacionRow(p, rank, isMe, trendCellHtml = null)` — params opcionales; (b) `computeRankingForStats` + `getClasificacionTrendMap` tras `getUserTotalRealPoints` (`js/main.js:3533`); (c) hook en `renderClasificacionTab` (`js/main.js:1195-1204`).
- **Modify `tests/clasificacionTable.test.js`**: actualizar las copias de `buildClasificacionHeader`/`buildClasificacionRow` a las nuevas signaturas + tests de la columna trend.
- **Modify `css/styles.css`**: tras el bloque `.rank-n` (`css/styles.css:5129`), grid `.with-trend` + `.trend*` + `.clasificacion-legend`.
- **Modify `index.html`**: línea 19 (`v=89`→`v=90`), insertar `<script src="js/trend.js?v=1"></script>` antes de `<script src="js/main.js...>` (línea 328) y `main.js?v=127`→`v=128`.

---

### Task 1: Módulo `js/trend.js` — puras + tests

**Files:**
- Create: `js/trend.js`
- Create: `tests/trend.test.js`
- Test: `tests/trend.test.js`

**Interfaces:**
- Consumes: nada (puro; `matches[].fechaTs` en segundos Unix, `matchStats[].eventId`).
- Produces: `trendApi = { getMatchDayKey, getLastTwoMatchDays, filterMatchStatsUpTo, countUserPredictionsInSubset, computeTrendMap, buildTrendCellHtml }` como `window.trendApi` y `module.exports`. Tipos: `getMatchDayKey(fechaTs: number) => 'YYYY-MM-DD' | null`; `getLastTwoMatchDays(matches, matchStats) => { prev: string, last: string } | null`; `filterMatchStatsUpTo(dayKey, matches, matchStats) => matchStats[]`; `countUserPredictionsInSubset(userPreds: object, subsetIds: Set) => number`; `computeTrendMap(prevRows: [{name, realPoints, predictedCount}], currRows) => { [name]: { dir: 'up'|'down'|'same', n: number } | null }`; `buildTrendCellHtml(trend | null) => string`.

- [ ] **Step 1: Write the failing test**

Crear `tests/trend.test.js`:

```javascript
const assert = require('assert');
const {
  getMatchDayKey, getLastTwoMatchDays, filterMatchStatsUpTo,
  countUserPredictionsInSubset, computeTrendMap, buildTrendCellHtml
} = require('../js/trend.js');

function ts(y, mo, d, h) {
  return Math.floor(new Date(y, mo, d, h, 0, 0).getTime() / 1000);
}

function test_getMatchDayKey_formato_y_nulos() {
  assert.strictEqual(getMatchDayKey(ts(2026, 8, 8, 21)), '2026-09-08');
  assert.strictEqual(getMatchDayKey(null), null);
  assert.strictEqual(getMatchDayKey(undefined), null);
  assert.strictEqual(getMatchDayKey('x'), null);
}

function test_getLastTwoMatchDays_ultimos_con_partidos() {
  const matches = [
    { id: 1, fechaTs: ts(2026, 8, 8, 21) },
    { id: 2, fechaTs: ts(2026, 8, 9, 21) },
    { id: 3, fechaTs: ts(2026, 8, 10, 21) }
  ];
  const stats = [{ eventId: 1 }, { eventId: 2 }, { eventId: 3 }];
  assert.deepStrictEqual(getLastTwoMatchDays(matches, stats), { prev: '2026-09-09', last: '2026-09-10' });
}

function test_getLastTwoMatchDays_salta_dias_sin_resultado_e_ignora_desconocidos() {
  const matches = [
    { id: 1, fechaTs: ts(2026, 8, 8, 21) },
    { id: 3, fechaTs: ts(2026, 8, 10, 21) }
  ];
  const stats = [{ eventId: 1 }, { eventId: 3 }, { eventId: 999 }];
  assert.deepStrictEqual(getLastTwoMatchDays(matches, stats), { prev: '2026-09-08', last: '2026-09-10' });
}

function test_getLastTwoMatchDays_menos_de_dos_dias_null() {
  const matches = [{ id: 1, fechaTs: ts(2026, 8, 8, 21) }];
  assert.strictEqual(getLastTwoMatchDays(matches, [{ eventId: 1 }]), null);
  assert.strictEqual(getLastTwoMatchDays([], []), null);
}

function test_filterMatchStatsUpTo_corte_inclusivo() {
  const matches = [
    { id: 1, fechaTs: ts(2026, 8, 8, 21) },
    { id: 2, fechaTs: ts(2026, 8, 9, 21) },
    { id: 3, fechaTs: ts(2026, 8, 10, 21) }
  ];
  const stats = [{ eventId: 1 }, { eventId: 2 }, { eventId: 3 }, { eventId: 999 }];
  assert.deepStrictEqual(
    filterMatchStatsUpTo('2026-09-09', matches, stats).map(s => s.eventId),
    [1, 2]
  );
}

function test_countUserPredictionsInSubset_solo_completos() {
  const preds = {
    1: { home: 2, away: 1 },
    2: { home: null, away: 1 },
    3: { home: 0, away: 0 }
  };
  assert.strictEqual(countUserPredictionsInSubset(preds, new Set([1, 2, 3, 4])), 2);
  assert.strictEqual(countUserPredictionsInSubset(undefined, new Set([1])), 0);
}

function test_computeTrendMap_sube_baja_igual_nuevo_ausente() {
  const prev = [
    { name: 'juan', realPoints: 300, predictedCount: 5 },
    { name: 'maria', realPoints: 200, predictedCount: 5 },
    { name: 'luis', realPoints: 100, predictedCount: 5 },
    { name: 'nuevo', realPoints: 0, predictedCount: 0 }
  ];
  const curr = [
    { name: 'maria', realPoints: 400, predictedCount: 9 },
    { name: 'juan', realPoints: 350, predictedCount: 9 },
    { name: 'luis', realPoints: 150, predictedCount: 9 },
    { name: 'nuevo', realPoints: 120, predictedCount: 4 },
    { name: 'extra', realPoints: 10, predictedCount: 1 }
  ];
  const map = computeTrendMap(prev, curr);
  assert.deepStrictEqual(map.maria, { dir: 'up', n: 1 });
  assert.deepStrictEqual(map.juan, { dir: 'down', n: 1 });
  assert.deepStrictEqual(map.luis, { dir: 'same', n: 0 });
  assert.strictEqual(map.nuevo, null);
  assert.strictEqual(map.extra, null);
}

function test_buildTrendCellHtml_apilado_direccional() {
  const up = buildTrendCellHtml({ dir: 'up', n: 2 });
  assert.ok(up.includes('trend-up'), 'clase up');
  assert.ok(up.indexOf('▲') < up.indexOf('>2<'), 'flecha arriba, numero debajo');
  assert.ok(up.includes('Sube 2 puestos'), 'title/aria');
  const down = buildTrendCellHtml({ dir: 'down', n: 1 });
  assert.ok(down.includes('trend-down'), 'clase down');
  assert.ok(down.indexOf('>1<') < down.indexOf('▼'), 'numero arriba, flecha debajo');
  assert.ok(down.includes('Baja 1 puesto"'), 'singular sin s');
  const same = buildTrendCellHtml({ dir: 'same', n: 0 });
  assert.ok(same.includes('trend-same') && same.includes('＝'), 'igual solo');
  assert.ok(!same.includes('<span>0</span>'), 'igual sin numero');
  assert.strictEqual(buildTrendCellHtml(null), '<span class="trend"></span>');
}

const tests = [
  test_getMatchDayKey_formato_y_nulos,
  test_getLastTwoMatchDays_ultimos_con_partidos,
  test_getLastTwoMatchDays_salta_dias_sin_resultado_e_ignora_desconocidos,
  test_getLastTwoMatchDays_menos_de_dos_dias_null,
  test_filterMatchStatsUpTo_corte_inclusivo,
  test_countUserPredictionsInSubset_solo_completos,
  test_computeTrendMap_sube_baja_igual_nuevo_ausente,
  test_buildTrendCellHtml_apilado_direccional
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

Run: `node tests/trend.test.js`
Expected: FAIL with "Cannot find module '../js/trend.js'"

- [ ] **Step 3: Write minimal implementation**

Crear `js/trend.js` (patrón exacto de `js/hoyPartidos.js:1` y `:215-225`):

```javascript
(function (global) {
  function getMatchDayKey(fechaTs) {
    if (typeof fechaTs !== 'number' || !isFinite(fechaTs)) return null;
    const d = new Date(fechaTs * 1000);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function dayKeyOfMatch(match) {
    return match ? getMatchDayKey(match.fechaTs) : null;
  }

  function getLastTwoMatchDays(matches, matchStats) {
    const byId = new Map((matches || []).map(m => [m.id, m]));
    const days = new Set();
    for (const ms of matchStats || []) {
      const key = dayKeyOfMatch(byId.get(ms ? ms.eventId : undefined));
      if (key) days.add(key);
    }
    const sorted = Array.from(days).sort();
    if (sorted.length < 2) return null;
    return { prev: sorted[sorted.length - 2], last: sorted[sorted.length - 1] };
  }

  function filterMatchStatsUpTo(dayKey, matches, matchStats) {
    const byId = new Map((matches || []).map(m => [m.id, m]));
    return (matchStats || []).filter(ms => {
      const key = dayKeyOfMatch(byId.get(ms ? ms.eventId : undefined));
      return key !== null && key <= dayKey;
    });
  }

  function countUserPredictionsInSubset(userPredictions, subsetIds) {
    if (!userPredictions || !subsetIds) return 0;
    let n = 0;
    for (const id of subsetIds) {
      const p = userPredictions[id];
      if (p && typeof p.home === 'number' && typeof p.away === 'number') n++;
    }
    return n;
  }

  function computeTrendMap(prevRows, currRows) {
    const prevByName = new Map((prevRows || []).map((r, i) => [r.name, { rank: i + 1, row: r }]));
    const map = {};
    (currRows || []).forEach((r, i) => {
      const currRank = i + 1;
      const prev = prevByName.get(r.name);
      if (!prev || !(prev.row.predictedCount > 0)) { map[r.name] = null; return; }
      const diff = prev.rank - currRank;
      if (diff === 0) map[r.name] = { dir: 'same', n: 0 };
      else map[r.name] = { dir: diff > 0 ? 'up' : 'down', n: Math.abs(diff) };
    });
    return map;
  }

  function buildTrendCellHtml(trend) {
    if (!trend) return '<span class="trend"></span>';
    if (trend.dir === 'same') {
      return '<span class="trend trend-same" title="Igual que el día anterior con partidos" aria-label="Igual que el día anterior con partidos"><span>＝</span></span>';
    }
    const isUp = trend.dir === 'up';
    const arrow = isUp ? '▲' : '▼';
    const verb = isUp ? 'Sube' : 'Baja';
    const plural = trend.n === 1 ? '' : 's';
    const label = `${verb} ${trend.n} puesto${plural} respecto al día anterior con partidos`;
    const inner = isUp
      ? `<span>${arrow}</span><span>${trend.n}</span>`
      : `<span>${trend.n}</span><span>${arrow}</span>`;
    return `<span class="trend trend-${trend.dir}" title="${label}" aria-label="${label}">${inner}</span>`;
  }

  const trendApi = {
    getMatchDayKey, getLastTwoMatchDays, filterMatchStatsUpTo,
    countUserPredictionsInSubset, computeTrendMap, buildTrendCellHtml
  };
  global.trendApi = trendApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = trendApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

Nota: el `title`/`aria-label` solo interpolan `trend.n` (número) y literales — `p.name` nunca entra en este builder (sigue interpolado en crudo por `buildClasificacionRow` como hoy, sin cambios).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/trend.test.js`
Expected: PASS (`8 passing, 0 failing`)

- [ ] **Step 5: Commit**

```bash
git add js/trend.js tests/trend.test.js
git commit -m "feat(trend): modulo puro de tendencia en clasificacion con tests"
```

---

### Task 2: Builders de fila/cabecera con columna opcional + tests

**Files:**
- Modify: `js/main.js:1109-1132` (`buildClasificacionHeader`, `buildClasificacionRow`)
- Modify: `tests/clasificacionTable.test.js` (actualizar copias + nuevos tests)
- Test: `tests/clasificacionTable.test.js`

**Interfaces:**
- Consumes: `trendApi.buildTrendCellHtml` no se usa aquí (la celda llega pre-construida como string); solo HTML.
- Produces: `buildClasificacionHeader(showTrendCol = false) => string`; `buildClasificacionRow(p, rank, isMe, trendCellHtml = null) => string`. Con `trendCellHtml === null` la salida es byte-idéntica a la actual (grid 6 columnas); con string se añade 2ª celda + clase `with-trend` en header y fila.

- [ ] **Step 1: Write the failing test**

Añadir a `tests/clasificacionTable.test.js` (manteniendo las copias existentes, actualizadas a las nuevas signaturas):

```javascript
function test_cabecera_con_trend_lleva_celda_vacia_y_clase() {
  const html = buildClasificacionHeader(true);
  assert.ok(html.includes('clasificacion-header with-trend'), 'clase with-trend');
  assert.ok(html.includes('<span></span>'), 'celda vacia sin titulo');
}

function test_cabecera_sin_trend_igual_que_antes() {
  const html = buildClasificacionHeader();
  assert.ok(!html.includes('with-trend'), 'sin clase');
  assert.ok(!html.includes('<span></span>'), 'sin celda vacia');
}

function test_fila_con_trend_inserta_segunda_celda_y_clase() {
  const cell = '<span class="trend trend-up"><span>▲</span><span>2</span></span>';
  const html = buildClasificacionRow(user(), 1, false, cell);
  assert.ok(html.includes('clasificacion-row with-trend'), 'clase with-trend');
  const idClose = html.indexOf('</div>', html.indexOf('clasificacion-id'));
  assert.ok(html.indexOf(cell) > idClose, 'celda tras la identidad');
  assert.ok(html.indexOf(cell) < html.indexOf('>145</span>'), 'celda antes de Pron');
}

function test_fila_sin_trend_byte_identica() {
  const html = buildClasificacionRow(user(), 1, false);
  assert.ok(!html.includes('with-trend'), 'sin clase');
  assert.ok(!html.includes('class="trend'), 'sin celda trend');
}
```

Y añadir los 4 nombres al array `tests` existente. Primero actualizar en el fichero de test las copias de `buildClasificacionHeader`/`buildClasificacionRow` a las nuevas signaturas (ver Step 3) — sin ese cambio los tests nuevos fallan.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/clasificacionTable.test.js`
Expected: FAIL (las funciones copiadas aún no aceptan los nuevos parámetros; `with-trend` ausente)

- [ ] **Step 3: Write minimal implementation**

En `js/main.js`, reemplazar `buildClasificacionHeader` (`js/main.js:1110-1115`):

```javascript
/** Cabecera de la tabla de clasificación (6 columnas, 7 con tendencia) */
function buildClasificacionHeader(showTrendCol = false) {
  return `
    <div class="clasificacion-header${showTrendCol ? ' with-trend' : ''}">
      <span>Jugador</span>${showTrendCol ? '<span></span>' : ''}<span>Pron</span><span>Plant</span><span>Clas</span><span>Elim</span><span>Total</span>
    </div>`;
}
```

Y `buildClasificacionRow` (`js/main.js:1118-1132`):

```javascript
/** Fila de usuario con desglose: identidad + 5 valores alineados (+ celda de tendencia opcional) */
function buildClasificacionRow(p, rank, isMe, trendCellHtml = null) {
  const withTrend = trendCellHtml !== null;
  return `
    <div class="clasificacion-row${isMe ? ' current-user' : ''}${withTrend ? ' with-trend' : ''}" onclick="showUserProfileModal('${p.name}')">
      <div class="clasificacion-id">
        <div class="rank-pill ${getRankBadgeClass(rank)}">${rank}</div>
        <span class="player-avatar">${p.avatar}</span>
        <span class="clasificacion-name">${p.name}${isMe ? ' <span class="clasificacion-you">(Tu)</span>' : ''}</span>
      </div>
      ${withTrend ? trendCellHtml : ''}
      <span class="clasificacion-val">${p.predictionPoints}</span>
      <span class="clasificacion-val">${p.squadPoints}</span>
      <span class="clasificacion-val">${p.classificationPoints}</span>
      <span class="clasificacion-val">${p.eliminatoriasPoints}</span>
      <span class="clasificacion-val clasificacion-total">${p.realPoints}</span>
    </div>`;
}
```

Replicar exactamente estos dos bloques en las copias de `tests/clasificacionTable.test.js` (ese fichero duplica la implementación en lugar de importarla; mantener las copias sincronizadas es obligatorio).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/clasificacionTable.test.js`
Expected: PASS (10 passing: 6 existentes + 4 nuevos, 0 failing)

- [ ] **Step 5: Commit**

```bash
git add js/main.js tests/clasificacionTable.test.js
git commit -m "feat(trend): columna opcional de tendencia en cabecera y filas"
```

---

### Task 3: Ranking histórico + hook en `renderClasificacionTab`

**Files:**
- Modify: `js/main.js` (insertar tras `getUserTotalRealPoints`, `js/main.js:3533-3535`; modificar bloque `js/main.js:1195-1204`)
- Test: suite existente + verificación manual en navegador (ver Step 4)

**Interfaces:**
- Consumes: `trendApi.{ getLastTwoMatchDays, filterMatchStatsUpTo, countUserPredictionsInSubset, computeTrendMap, buildTrendCellHtml }`; `computeUserRealPoints(username)` (existente, sin cambios); `AppState.{ matches, matchStats, players, allPredictions, realStandings, classificationPoints, currentUser }`.
- Produces: `computeRankingForStats(matchStatsSubset) => [{ name, realPoints, predictedCount }]` (ordenado por `realPoints` desc, sort estable, mismo comparador que el render); `getClasificacionTrendMap(currentRows) => trendMap | null`.

- [ ] **Step 1: Insertar `computeRankingForStats` + `getClasificacionTrendMap`**

Insertar tras `getUserTotalRealPoints` (`js/main.js:3533-3535`):

```javascript
/**
 * Ranking con un subconjunto de matchStats (corte por día).
 * Reutiliza computeUserRealPoints con swap temporal de AppState.matchStats
 * y de las cachés que dependen de él; restaura todo en finally.
 * No modifica ninguna función existente. Síncrono: sin riesgo de reentrada.
 */
function computeRankingForStats(matchStatsSubset) {
  const savedMatchStats = AppState.matchStats;
  const savedStandings = AppState.realStandings;
  const savedClassPoints = AppState.classificationPoints;
  AppState.matchStats = matchStatsSubset;
  AppState.realStandings = [];
  AppState.classificationPoints = {};
  try {
    const subsetIds = new Set(matchStatsSubset.map(ms => ms.eventId));
    const rows = (AppState.players || []).map(p => {
      const parts = computeUserRealPoints(p.name);
      return {
        name: p.name,
        realPoints: parts.realPoints,
        predictedCount: trendApi.countUserPredictionsInSubset(
          AppState.allPredictions ? AppState.allPredictions[p.name] : undefined,
          subsetIds
        )
      };
    });
    rows.sort((a, b) => b.realPoints - a.realPoints);
    return rows;
  } finally {
    AppState.matchStats = savedMatchStats;
    AppState.realStandings = savedStandings;
    AppState.classificationPoints = savedClassPoints;
  }
}

/** Mapa de tendencias vs penúltimo día con partidos, o null si no procede. Fail-safe. */
function getClasificacionTrendMap(currentRows) {
  try {
    const days = trendApi.getLastTwoMatchDays(AppState.matches, AppState.matchStats);
    if (!days) return null;
    const prevSubset = trendApi.filterMatchStatsUpTo(days.prev, AppState.matches, AppState.matchStats);
    const prevRows = computeRankingForStats(prevSubset);
    return trendApi.computeTrendMap(prevRows, currentRows);
  } catch (e) {
    console.error('Error calculando tendencia:', e);
    return null;
  }
}
```

- [ ] **Step 2: Hook en `renderClasificacionTab`**

Reemplazar el bloque de ordenado/render (`js/main.js:1195-1204`):

```javascript
  // Ordenar por puntos descendente
  playersWithPoints.sort((a, b) => b.realPoints - a.realPoints);

  const allIds = new Set(AppState.matchStats.map(ms => ms.eventId));
  const currentRows = playersWithPoints.map(p => ({
    name: p.name,
    realPoints: p.realPoints,
    predictedCount: trendApi.countUserPredictionsInSubset(
      AppState.allPredictions ? AppState.allPredictions[p.name] : undefined,
      allIds
    )
  }));
  const trendMap = getClasificacionTrendMap(currentRows);
  const withTrend = trendMap !== null;

  container.innerHTML =
    buildClasificacionHeader(withTrend) +
    playersWithPoints.map((p, i) => {
      const rank = i + 1;
      const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
      return buildClasificacionRow(p, rank, isMe, withTrend ? trendApi.buildTrendCellHtml(trendMap[p.name]) : null);
    }).join('') +
    (withTrend ? '<div class="clasificacion-legend"><span class="trend-up">▲</span> sube · <span class="trend-down">▼</span> baja · <span class="trend-same">＝</span> igual vs día anterior con partidos</div>' : '');
```

Nota: `trendMap[p.name]` es `undefined` solo si el usuario no está en `currentRows` (imposible: se construye de la misma lista); `buildTrendCellHtml(undefined)` devuelve celda vacía, fail-safe adicional.

- [ ] **Step 3: Verificar que no se rompe nada existente**

Run: `for f in tests/*.test.js; do node "$f" || exit 1; done`
Expected: todos los ficheros `N passing, 0 failing` (los cambios de `main.js` son aditivos; `trendApi` solo se toca en tiempo de render en navegador, no en tests).

- [ ] **Step 4: Verificación manual en navegador**

Abrir la app (p. ej. `node server.mjs` y pestaña Clasificación): con ≥2 días con resultados debe verse la columna trend + leyenda; con 1 solo día, tabla idéntica a la actual; consola sin excepciones. (`main.js` corre en navegador y no es `require`-able en node por su código top-level de DOM, igual que antes de este cambio; por eso esta task se verifica en navegador.)

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat(trend): ranking historico y hook en clasificacion"
```

---

### Task 4: CSS + `index.html` + verificación final

**Files:**
- Modify: `css/styles.css` (tras `.rank-n`, `css/styles.css:5129`)
- Modify: `index.html` (línea 19; líneas 327-328)
- Test: suite completa + `git status`

**Interfaces:**
- Consumes: clases `with-trend` emitidas por Task 2.
- Produces: estilos aplicados; `js/trend.js?v=1` cargado antes de `js/main.js`.

- [ ] **Step 1: Añadir estilos**

En `css/styles.css`, inmediatamente después del bloque `.rank-n` (línea 5129):

```css
.clasificacion-header.with-trend, .clasificacion-row.with-trend {
  grid-template-columns: 1fr minmax(18px,24px) repeat(5, minmax(22px,32px));
}
.trend { display: flex; flex-direction: column; align-items: center; line-height: 1.15; font-size: 9px; font-weight: 800; font-variant-numeric: tabular-nums; }
.trend-up { color: #10B981; }
.trend-down { color: #EF4444; }
.trend-same { color: #38BDF8; }
.clasificacion-legend {
  padding: 8px 12px;
  font-size: 10.5px;
  text-align: center;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
}
```

Reutiliza variables existentes (`--text-muted`, `--border-color`); colores de flechas literales según spec validado en maqueta.

- [ ] **Step 2: Cache-busting y script tag en `index.html`**

Línea 19: `<link rel="stylesheet" href="css/styles.css?v=89">` → `css/styles.css?v=90`.
Antes de la línea 328 (`<script src="js/main.js?v=127"></script>`) insertar:
`  <script src="js/trend.js?v=1"></script>`
y cambiar `js/main.js?v=127` → `js/main.js?v=128`. No tocar otras versiones.

- [ ] **Step 3: Verificación final**

Run: `for f in tests/*.test.js; do node "$f" || exit 1; done`
Expected: todo en verde.
Manual: recargar con caché limpia, comprobar columna trend, leyenda, fila de usuario nuevo sin indicador, y que con 1 solo día con resultados la tabla es idéntica a la anterior. Consola sin errores; viewport 460px sin scroll horizontal.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css index.html
git commit -m "feat(trend): estilos, script tag y cache-busting"
```

---

## Self-Review

**1. Spec coverage:** días locales + salto de vacíos → Task 1 (`getLastTwoMatchDays`, `filterMatchStatsUpTo`); penúltimo vs último + `predictedCount`/usuario nuevo → Tasks 1+3; funciones nuevas sin tocar existentes → Task 3 (swap con `finally`); apilado direccional + colores + `title`/`aria` → Tasks 1+2; columna sin título entre Jugador y Pron + grid `1fr minmax(18px,24px) repeat(5, ...)` + clase condicional + oculta con <2 días → Tasks 2+4; leyenda → Task 3; tests (agrupar/corte/trend/empates pendientes — empates: sort estable con mismo comparador, cubierto por diseño + test `same`) → Tasks 1+2; cache-busting → Task 4. Sin gaps.

**2. Placeholder scan:** sin TBD/TODO/"similar a"/manejos genéricos; cada step trae código literal, comandos `node` exactos y mensajes de commit exactos.

**3. Type consistency:** `trendApi` expone las 6 funciones usadas en Task 3 con las mismas signaturas de Task 1; `trendMap[name]` es `{dir, n} | null | undefined` y `buildTrendCellHtml` acepta los tres casos; `buildClasificacionRow(..., null)` = salida clásica; `showTrendCol`/`withTrend` booleanos en ambos builders; `predictedCount` numérico en ambos rankings.
