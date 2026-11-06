# Evolución por jornada: posición y puntos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en la subtab Evolución la posición por defecto y permitir ver puntos acumulados o por jornada, recortando el eje a las etapas con resultados.

**Architecture:** Se extiende el pipeline de series existente en `js/stats.js`. Funciones puras convierten series acumuladas en deltas y calculan rankings por etapa; el render reutiliza el SVG actual con eje normal o invertido según la métrica. La API no cambia.

**Tech Stack:** JavaScript vanilla ES6+, SVG, CSS vanilla, tests node con `assert`.

## Global Constraints

- Sin cambios en `api-porra`; todo se calcula en `porra-spa`.
- Mantener el enfoque móvil vertical y reutilizar variables CSS de `:root`.
- No añadir librerías ni frameworks.
- Cache-busting obligatorio en `index.html` al tocar `js/stats.js` y `css/styles.css` (regla de `AGENTS.md`).
- No añadir comentarios al código salvo que sean imprescindibles.
- La vista Posición usa siempre el total de todas las fuentes y oculta fuente/modo.
- La vista Puntos mantiene el selector de fuente y añade Modo Acumulado/Por jornada.
- Eje X: J1-J8 + fases eliminatorias, recortado hasta la última etapa con resultados.
- Tests: cada archivo de `tests/` se ejecuta con `node tests/<archivo>.js`.
- Commits frecuentes por tarea.

---

### Task 1: Helpers puros de evolución

**Files:**
- Modify: `js/stats.js` (junto a `positionForMatch`, y exports del final)
- Test: `tests/estadisticasEvolucion.test.js` (crear)

**Interfaces:**
- Consumes: `buildTimeline()`, `positionForMatch(match)`.
- Produces:
  - `toStagePoints(series: number[]) -> number[]` (13 posiciones, deltas por etapa).
  - `calcEvolutionPositions(totalSeriesMap: Map<string, { series: number[], hasData: boolean }>) -> Map<string, { series: number[], hasData: boolean }>`.
  - `lastTimelinePoint(matches: object[], matchStatsById: object) -> number`.
  - `trimTimeline(timeline: object[], lastPoint: number) -> object[]`.
  - `buildEvolutionSeriesMap(metric: string, mode: string, sourceSeriesMap: Map|null, totalSeriesMap: Map|null) -> Map`.

- [ ] **Step 1: Write the failing test**

Create `tests/estadisticasEvolucion.test.js`:

```js
const assert = require('assert');
const {
  buildTimeline,
  toStagePoints,
  calcEvolutionPositions,
  lastTimelinePoint,
  trimTimeline,
  buildEvolutionSeriesMap,
} = require('../js/stats.js');

function series13(values) {
  const out = Array(13).fill(0);
  for (let i = 0; i < values.length && i < 13; i++) out[i] = values[i];
  return out;
}

function test_toStagePoints_acumulado_a_etapa() {
  const delta = toStagePoints(series13([8, 10, 10, 14]));
  assert.deepStrictEqual(delta.slice(0, 5), [8, 2, 0, 4, 0]);
  assert.deepStrictEqual(delta.slice(5), Array(8).fill(0));
}

function test_calcEvolutionPositions_empates_y_varias_etapas() {
  const map = new Map([
    ['a', { series: series13([10, 20]), hasData: true }],
    ['b', { series: series13([15, 15]), hasData: true }],
    ['c', { series: series13([15, 0]), hasData: false }],
  ]);
  const pos = calcEvolutionPositions(map);
  assert.deepStrictEqual(pos.get('a').series.slice(0, 2), [3, 1]);
  assert.deepStrictEqual(pos.get('b').series.slice(0, 2), [1, 1]);
  assert.deepStrictEqual(pos.get('c').series.slice(0, 2), [1, 3]);
  assert.strictEqual(pos.get('c').hasData, false);
}

function test_lastTimelinePoint_y_trim() {
  const matches = [
    { id: 1, fase: 'liga', ronda: 1, homeTeamId: 10, awayTeamId: 20 },
    { id: 2, fase: 'liga', ronda: 3, homeTeamId: 10, awayTeamId: 20 },
    { id: 3, fase: '16', homeTeamId: 10, awayTeamId: 20 },
    { id: 4, fase: '16', homeTeamId: 10, awayTeamId: 20 },
  ];
  const stats = {
    1: { stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
    2: { stats: { 10: { goles: 0 }, 20: { goles: 0 } } },
    3: { stats: { 10: { goles: 1 }, 20: { goles: 0 } } },
  };
  assert.strictEqual(lastTimelinePoint(matches, stats), 8);
  assert.strictEqual(lastTimelinePoint([], {}), 0);
  const tl = buildTimeline();
  assert.strictEqual(trimTimeline(tl, 2).length, 3);
  assert.strictEqual(trimTimeline(tl, 2)[2].label, 'J3');
  assert.strictEqual(trimTimeline(tl, 0).length, 1);
}

function test_buildEvolutionSeriesMap_puntos_y_posicion() {
  const source = new Map([
    ['a', { series: series13([8, 10, 10]), hasData: true }],
  ]);
  const total = new Map([
    ['a', { series: series13([8, 10, 10]), hasData: true }],
    ['b', { series: series13([5, 12, 12]), hasData: true }],
  ]);
  assert.deepStrictEqual(
    buildEvolutionSeriesMap('puntos', 'acumulado', source, null).get('a').series.slice(0, 3),
    [8, 10, 10]
  );
  assert.deepStrictEqual(
    buildEvolutionSeriesMap('puntos', 'jornada', source, null).get('a').series.slice(0, 3),
    [8, 2, 0]
  );
  const pos = buildEvolutionSeriesMap('posicion', 'acumulado', null, total);
  assert.deepStrictEqual(pos.get('a').series.slice(0, 2), [1, 2]);
  assert.deepStrictEqual(pos.get('b').series.slice(0, 2), [2, 1]);
}

test_toStagePoints_acumulado_a_etapa();
test_calcEvolutionPositions_empates_y_varias_etapas();
test_lastTimelinePoint_y_trim();
test_buildEvolutionSeriesMap_puntos_y_posicion();
console.log('OK estadisticasEvolucion');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticasEvolucion.test.js`
Expected: FAIL with `TypeError: toStagePoints is not a function` (o similar).

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, justo después de `positionForMatch` (sobre la línea 34), añadir:

```js
  function toStagePoints(series) {
    const src = series || [];
    const out = Array(13).fill(0);
    let prev = 0;
    for (let p = 0; p < 13; p++) {
      const cur = p < src.length ? (src[p] || 0) : prev;
      out[p] = cur - prev;
      prev = cur;
    }
    return out;
  }

  function calcEvolutionPositions(totalSeriesMap) {
    const map = totalSeriesMap || new Map();
    const names = [...map.keys()];
    const out = new Map();
    for (const name of names) {
      out.set(name, { series: Array(13).fill(1), hasData: !!map.get(name)?.hasData });
    }
    for (let p = 0; p < 13; p++) {
      const totals = names.map(name => ({ name, total: map.get(name)?.series?.[p] || 0 }));
      for (const item of totals) {
        let rank = 1;
        for (const other of totals) if (other.total > item.total) rank++;
        out.get(item.name).series[p] = rank;
      }
    }
    return out;
  }

  function lastTimelinePoint(matches, matchStatsById) {
    let last = 0;
    for (const m of matches || []) {
      const ms = matchStatsById?.[m.id];
      const home = ms?.stats?.[m.homeTeamId]?.goles;
      const away = ms?.stats?.[m.awayTeamId]?.goles;
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      const pos = positionForMatch(m);
      if (pos !== null && pos > last) last = pos;
    }
    return last;
  }

  function trimTimeline(timeline, lastPoint) {
    const tl = timeline || [];
    const limit = Number.isInteger(lastPoint) ? lastPoint : tl.length - 1;
    return tl.filter(t => t.point <= limit);
  }

  function buildEvolutionSeriesMap(metric, mode, sourceSeriesMap, totalSeriesMap) {
    if (metric === 'posicion') return calcEvolutionPositions(totalSeriesMap);
    const out = new Map();
    for (const [name, result] of sourceSeriesMap || []) {
      const series = mode === 'jornada' ? toStagePoints(result.series) : (result.series || []).slice();
      out.set(name, { series, hasData: !!result.hasData });
    }
    return out;
  }
```

- [ ] **Step 4: Export the new functions**

En el bloque de exports globales (zona de `global.matchResultOf`), añadir:

```js
  global.toStagePoints = toStagePoints;
  global.calcEvolutionPositions = calcEvolutionPositions;
  global.lastTimelinePoint = lastTimelinePoint;
  global.trimTimeline = trimTimeline;
  global.buildEvolutionSeriesMap = buildEvolutionSeriesMap;
  global.positionForMatch = positionForMatch;
```

En `module.exports` del final, añadir dentro del objeto:

```js
    toStagePoints, calcEvolutionPositions, lastTimelinePoint, trimTimeline, buildEvolutionSeriesMap, positionForMatch,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node tests/estadisticasEvolucion.test.js`
Expected: `OK estadisticasEvolucion`

Run: `node tests/estadisticas.test.js && node tests/estadisticas-subtabs.test.js`
Expected: ambos terminan sin error.

- [ ] **Step 6: Commit**

```bash
git add js/stats.js tests/estadisticasEvolucion.test.js
git commit -m "feat(stats): helpers de evolucion por etapa y posicion"
```

---

### Task 2: Controles y render de la nueva Evolución

**Files:**
- Modify: `js/stats.js` (constantes, estado, `renderEvolucionBody`, `buildLineChart`, `buildLegend`, `orderPlayers`, `initStatsState`, `bindStatsEvents`, exports)
- Modify: `css/styles.css` (junto a `.stats-source-seg`)
- Modify: `index.html` (versiones de `stats.js` y `styles.css`)
- Test: `tests/estadisticasEvolucion.test.js`

**Interfaces:**
- Consumes: `toStagePoints`, `calcEvolutionPositions`, `lastTimelinePoint`, `trimTimeline`, `buildEvolutionSeriesMap` (Task 1).
- Produces:
  - `EVO_METRIC_DEFAULT = 'posicion'`.
  - `EVO_MODE_DEFAULT = 'acumulado'`.
  - `AppState.estadisticasEvoMetric` / `AppState.estadisticasEvoMode`.
  - Controles `.stats-evo-metric` (`data-metric`) y `.stats-evo-mode` (`data-mode`).

- [ ] **Step 1: Write the failing test**

Añadir al inicio de `tests/estadisticasEvolucion.test.js`, en el `require`:

```js
  EVO_METRIC_DEFAULT,
  EVO_MODE_DEFAULT,
```

Y antes de las llamadas finales, añadir:

```js
function test_defaults_evolucion() {
  assert.strictEqual(EVO_METRIC_DEFAULT, 'posicion');
  assert.strictEqual(EVO_MODE_DEFAULT, 'acumulado');
}
```

Añadir la llamada junto a las demás:

```js
test_defaults_evolucion();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticasEvolucion.test.js`
Expected: FAIL porque `EVO_METRIC_DEFAULT` no está exportado.

- [ ] **Step 3: Add constants and state defaults**

En `js/stats.js`, después de `const SUBTABS = [...]` (sobre la línea 922), añadir:

```js
  const EVO_METRIC_DEFAULT = 'posicion';
  const EVO_MODE_DEFAULT = 'acumulado';
```

Junto a `let currentSeriesMap = null;` (línea 926), añadir:

```js
  let currentEvolutionTimeline = null;
```

Reemplazar `initStatsState` por:

```js
  function initStatsState(seriesMap, opts) {
    if (!AppState.estadisticasSubTab) AppState.estadisticasSubTab = 'pronosticos';
    if (!AppState.estadisticasPointType) AppState.estadisticasPointType = 'total';
    if (!AppState.estadisticasEvoMetric) AppState.estadisticasEvoMetric = EVO_METRIC_DEFAULT;
    if (!AppState.estadisticasEvoMode) AppState.estadisticasEvoMode = EVO_MODE_DEFAULT;
    if (!AppState.estadisticasVisibleUsers) {
      const me = AppState.currentUser?.name;
      const top = orderPlayers(seriesMap, opts).slice(0, 3).map(p => p.name);
      AppState.estadisticasVisibleUsers = new Set([me, ...top].filter(Boolean));
    }
  }
```

Reemplazar `orderPlayers` por:

```js
  function orderPlayers(seriesMap, opts) {
    const options = opts || {};
    const metric = options.metric || EVO_METRIC_DEFAULT;
    const lastIdx = Number.isInteger(options.lastIdx) ? options.lastIdx : 12;
    const players = [...statsPlayers()];
    const me = AppState.currentUser?.name;
    players.sort((a, b) => {
      if (a.name === me) return -1;
      if (b.name === me) return 1;
      const av = seriesMap.get(a.name)?.series[lastIdx] || 0;
      const bv = seriesMap.get(b.name)?.series[lastIdx] || 0;
      return metric === 'posicion' ? av - bv : bv - av;
    });
    return players;
  }
```

- [ ] **Step 4: Replace `renderEvolucionBody`**

Sustituir la función completa por:

```js
  function renderEvolucionBody(aggregates) {
    const metric = AppState.estadisticasEvoMetric || EVO_METRIC_DEFAULT;
    const mode = AppState.estadisticasEvoMode || EVO_MODE_DEFAULT;
    const source = AppState.estadisticasPointType || 'total';
    const timeline = trimTimeline(buildTimeline(), lastTimelinePoint(AppState.matches, aggregates.matchStatsById));
    const lastIdx = Math.max(0, timeline.length - 1);
    const sourceSeriesMap = metric === 'puntos'
      ? buildSeriesMap(source, aggregates.reachedPhases, aggregates.matchesById)
      : null;
    const totalSeriesMap = metric === 'posicion'
      ? buildSeriesMap('total', aggregates.reachedPhases, aggregates.matchesById)
      : null;
    const seriesMap = buildEvolutionSeriesMap(metric, mode, sourceSeriesMap, totalSeriesMap);
    currentSeriesMap = seriesMap;
    currentEvolutionTimeline = timeline;
    initStatsState(seriesMap, { metric, lastIdx });
    if (statsHideGuests() && AppState.estadisticasVisibleUsers) {
      const allowed = new Set(statsPlayers().map(p => p.name));
      for (const n of [...AppState.estadisticasVisibleUsers]) {
        if (!allowed.has(n)) AppState.estadisticasVisibleUsers.delete(n);
      }
    }
    const visibleSet = AppState.estadisticasVisibleUsers;
    const players = orderPlayers(seriesMap, { metric, lastIdx });
    const me = AppState.currentUser?.name;
    const search = (AppState.estadisticasEvoSearch || '').toLowerCase();

    const segButtons = SOURCES.map(s =>
      `<button class="stats-source ${s.key === source ? 'active' : ''}" data-source="${s.key}">${s.label}</button>`
    ).join('');
    const metricButtons = [['posicion', 'Posición'], ['puntos', 'Puntos']].map(([key, label]) =>
      `<button class="stats-source stats-evo-metric ${key === metric ? 'active' : ''}" data-metric="${key}">${label}</button>`
    ).join('');
    const modeButtons = [['acumulado', 'Acumulado'], ['jornada', 'Por jornada']].map(([key, label]) =>
      `<button class="stats-source stats-evo-mode ${key === mode ? 'active' : ''}" data-mode="${key}">${label}</button>`
    ).join('');
    const title = metric === 'posicion'
      ? 'Evolución de posición por jornada'
      : (mode === 'jornada' ? 'Puntos por jornada' : 'Evolución de puntos por jornada');
    const extraControls = metric === 'puntos'
      ? `<div class="stats-source-seg stats-evo-source-seg">${segButtons}</div>
         <div class="stats-source-seg stats-evo-mode-seg">${modeButtons}</div>`
      : '<div class="stats-evo-note">Ranking general · todas las fuentes</div>';

    const filtered = search ? players.filter(p => p.name.toLowerCase().includes(search) || (p.avatar||'').includes(search)) : players;
    const chips = filtered.map(p => {
      const on = visibleSet.has(p.name);
      const isMe = p.name === me;
      return `<button class="stats-chip ${on ? 'active' : 'off'} ${isMe ? 'me' : ''}" data-user="${esc(p.name)}" aria-pressed="${on ? 'true' : 'false'}" title="${esc(p.name)}">${esc(p.avatar || '⚽')} ${esc(p.name)}${porraGuest.guestBadgeHtml(p.isGuest)}${isMe ? ' · tú' : ''}</button>`;
    }).join('');
    const hasNoMatch = search && !filtered.length;

    return `
      <div class="stats-card">
        <div class="stats-source-seg stats-evo-metric-seg">${metricButtons}</div>
        ${extraControls}
      </div>
      <div class="stats-card">
        <div class="stats-chips-header">
          <span class="stats-chips-counter">Jugadores: ${visibleSet.size} visibles de ${players.length}</span>
          <button class="stats-chips-action" data-action="todos">Todos</button>
          <button class="stats-chips-action" data-action="nadie">Nadie</button>
        </div>
        <div class="stats-card-title">${title}</div>
        <div class="stats-evo-search-wrap">
          <span class="stats-evo-search-icon">🔍</span>
          <input id="stats-evo-search" class="stats-evo-search" type="search" placeholder="Buscar jugador…" value="${esc(AppState.estadisticasEvoSearch || '')}" aria-label="Buscar jugador" autocomplete="off" spellcheck="false">
          ${search ? '<button class="stats-evo-clear" data-action="clear-search" aria-label="Limpiar búsqueda">×</button>' : ''}
        </div>
        <div class="stats-chips-row">${hasNoMatch ? '<span class="stats-empty" style="padding:8px 0">Sin coincidencias</span>' : chips}</div>
        ${buildLineChart(players, visibleSet, seriesMap, { metric, timeline })}
        ${buildLegend(players, visibleSet, seriesMap, { metric, timeline, pointsMap: totalSeriesMap })}
      </div>`;
  }
```

- [ ] **Step 5: Replace chart and legend rendering**

Sustituir `buildLineChart` por:

```js
  function buildLineChart(players, visibleSet, seriesMap, opts) {
    const options = opts || {};
    const metric = options.metric || 'puntos';
    const timeline = options.timeline || buildTimeline();
    const visible = playersWithData(players, visibleSet, seriesMap);
    if (!visible.length) return statsEmpty('Añade jugadores para ver el gráfico');

    const W = 340, H = 184, PAD = 28;
    const lastPoint = Math.max(0, timeline.length - 1);
    const x = (p) => PAD + (p / Math.max(1, lastPoint)) * (W - PAD * 2);
    let maxVal = metric === 'posicion' ? 1 : 10;
    for (const p of visible) {
      const series = seriesMap.get(p.name).series;
      for (let i = 0; i <= lastPoint; i++) maxVal = Math.max(maxVal, series[i] || 0);
    }
    const y = metric === 'posicion'
      ? (v) => PAD + ((v - 1) / Math.max(1, maxVal - 1)) * (H - PAD * 2)
      : (v) => H - PAD - (v / maxVal) * (H - PAD * 2);

    const polylines = visible.map((p, i) => {
      const color = LINE_COLORS[i % LINE_COLORS.length];
      const series = seriesMap.get(p.name).series;
      const pts = timeline.map((t, pi) => `${x(pi).toFixed(1)},${y(series[pi] || 0).toFixed(1)}`).join(' ');
      const last = lastPoint;
      const lx = x(last), ly = y(series[last] || 0);
      const isMe = p.name === AppState.currentUser?.name;
      return `
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${isMe ? 3.2 : 2.2}" stroke-linecap="round" stroke-linejoin="round" opacity="${isMe ? 1 : 0.92}"/>
        <circle cx="${lx}" cy="${ly}" r="${isMe ? 5 : 4}" fill="${color}" stroke="#0F172A" stroke-width="1.5" class="stats-lastpoint" data-user="${esc(p.name)}"/>
        <circle cx="${lx}" cy="${ly}" r="12" fill="transparent" class="stats-lastpoint" data-user="${esc(p.name)}"/>`;
    }).join('');

    const strongIdx = metric === 'posicion' ? 2 : 0;
    const grid = [0, 0.5, 1].map(f => {
      const value = metric === 'posicion' ? 1 + (maxVal - 1) * f : maxVal * f;
      return y(value);
    });
    const gridLines = grid.map((gy, gi) =>
      `<line x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}" stroke="${gi === strongIdx ? '#334155' : '#1E293B'}" stroke-width="1"/>`
    ).join('');

    const labels = timeline.map((t, i) =>
      `<text x="${x(i)}" y="${H - 6}" font-size="7.5" fill="#64748B" text-anchor="middle">${t.label}</text>`
    ).join('');

    return `
      <svg class="stats-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${gridLines}
        ${polylines}
        ${labels}
      </svg>`;
  }
```

Sustituir `buildLegend` por:

```js
  function buildLegend(players, visibleSet, seriesMap, opts) {
    const options = opts || {};
    const metric = options.metric || 'puntos';
    const timeline = options.timeline || buildTimeline();
    const lastIdx = Math.max(0, timeline.length - 1);
    const pointsMap = options.pointsMap || null;
    const visible = playersWithData(players, visibleSet, seriesMap);
    if (!visible.length) return `<div class="stats-legend">${statsEmpty('Añade jugadores para ver la leyenda')}</div>`;
    const sorted = [...visible].sort((a, b) => {
      const av = seriesMap.get(a.name).series[lastIdx] || 0;
      const bv = seriesMap.get(b.name).series[lastIdx] || 0;
      return metric === 'posicion' ? av - bv : bv - av;
    });
    const items = sorted.map(p => {
      const idx = visible.indexOf(p);
      const color = LINE_COLORS[idx % LINE_COLORS.length];
      const r = seriesMap.get(p.name);
      const value = r.series[lastIdx] || 0;
      const rank = sorted.indexOf(p) + 1;
      const detail = metric === 'posicion'
        ? `#${value} · ${pointsMap?.get(p.name)?.series?.[lastIdx] || 0} pts`
        : `${value} pts · #${rank}`;
      return `<button class="stats-legend-item" data-user="${esc(p.name)}" style="--legend-color:${color}" title="Ocultar/mostrar ${esc(p.name)}"><i style="background:${color}"></i>${esc(p.avatar||'⚽')} ${esc(p.name)}${porraGuest.guestBadgeHtml(p.isGuest)} · ${detail}</button>`;
    }).join('');
    return `<div class="stats-legend">${items}</div>`;
  }
```

- [ ] **Step 6: Wire the controls and toast in `bindStatsEvents`**

Cambiar el selector de fuente para no capturar los botones nuevos:

```js
    container.querySelectorAll('.stats-source[data-source]').forEach(btn => {
```

Añadir justo después del bloque anterior:

```js
    container.querySelectorAll('.stats-evo-metric').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasEvoMetric = btn.dataset.metric;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-evo-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasEvoMode = btn.dataset.mode;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });
```

Reemplazar el listener de `.stats-lastpoint` por:

```js
    container.querySelectorAll('.stats-lastpoint').forEach(circle => {
      circle.addEventListener('click', () => {
        const user = circle.dataset.user;
        const r = currentSeriesMap?.get(user) || emptySeries();
        const tl = currentEvolutionTimeline || buildTimeline();
        const lastIdx = Math.max(0, tl.length - 1);
        const value = r.series[lastIdx] || 0;
        const label = tl[lastIdx]?.label || '';
        const metric = AppState.estadisticasEvoMetric || EVO_METRIC_DEFAULT;
        showToast(metric === 'posicion'
          ? `${esc(user)} · #${value} en ${label}`
          : `${esc(user)} · ${value} pts en ${label}`);
      });
    });
```

- [ ] **Step 7: Export the new constants**

Añadir junto a los exports globales:

```js
  global.EVO_METRIC_DEFAULT = EVO_METRIC_DEFAULT;
  global.EVO_MODE_DEFAULT = EVO_MODE_DEFAULT;
```

Y en `module.exports`:

```js
    EVO_METRIC_DEFAULT, EVO_MODE_DEFAULT,
```

- [ ] **Step 8: Add styles**

En `css/styles.css`, después de `.stats-source.active` (sobre la línea 5439), añadir:

```css
.stats-evo-metric-seg {
  grid-template-columns: repeat(2, 1fr);
  margin-bottom: 6px;
}

.stats-evo-source-seg {
  grid-template-columns: repeat(5, 1fr);
}

.stats-evo-mode-seg {
  grid-template-columns: repeat(2, 1fr);
  margin-top: 6px;
}

.stats-evo-note {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}
```

- [ ] **Step 9: Bump cache-busting versions**

En `index.html`:
- `<link rel="stylesheet" href="css/styles.css?v=133">` → `v=134`.
- `<script src="js/stats.js?v=17"></script>` → `v=18`.

- [ ] **Step 10: Run tests to verify they pass**

Run: `node tests/estadisticasEvolucion.test.js`
Expected: `OK estadisticasEvolucion`

Run: `node tests/estadisticas.test.js && node tests/estadisticas-subtabs.test.js && node tests/estadisticasPronosticos.test.js`
Expected: sin errores.

- [ ] **Step 11: Commit**

```bash
git add js/stats.js tests/estadisticasEvolucion.test.js css/styles.css index.html
git commit -m "feat(stats): selector posicion/puntos y modo acumulado/jornada en evolucion"
```

---

### Task 3: Regresión y verificación manual

**Files:**
- Verify: `js/stats.js`, `css/styles.css`, `index.html`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
cd /home/ldoc/Proyectos/porra-spa
for f in tests/*.test.js; do node "$f" || exit 1; done
```

Expected: todos los archivos terminan sin error (última línea de cada uno con `OK ...`).

- [ ] **Step 2: Start the local server**

Run: `node server.mjs`
Expected: `Servidor local en http://localhost:8080`

- [ ] **Step 3: Manual checklist**

Con la app abierta en un viewport móvil vertical:

1. Estadísticas → Evolución: abre en **Posición**; el eje X llega hasta la última etapa con resultados; no hay scroll horizontal.
2. La nota `Ranking general · todas las fuentes` aparece y no se ven los selectores de fuente/modo.
3. Cambiar a **Puntos** → aparecen fuente y modo **Acumulado**; el total final coincide con la clasificación.
4. Cambiar a **Por jornada**: se ven picos aislados; la suma de deltas coincide con el acumulado.
5. Cambiar entre fuentes (`Total/Pronóst./Plantilla/Clasif./Eliminat.`): cada una responde.
6. Posición con empates: varios jugadores comparten puesto; el usuario logado va primero en chips y resaltado.
7. Buscar jugador, `Todos`/`Nadie`, ocultar/mostrar desde leyenda y toast del último punto funcionan.
8. Invitados: mismo comportamiento que antes (visibles solo si corresponde).
9. Consola del navegador sin excepciones.

- [ ] **Step 4: Commit only if manual verification produced fixes**

Si la verificación manual requiere ajustes, repetir el ciclo de la tarea afectada y commitear los cambios con un mensaje descriptivo. Si no hay cambios, no crear commit vacío.
