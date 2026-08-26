# Estadísticas › Individual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la sub-tab Fiabilidad de Estadísticas por **Individual**: ficha por usuario (desplegable, por defecto el logado) con donut de puntos por fuente, aciertos de pronóstico, métricas de jornadas, sesgo 1/X/2 y mejores jugadores de su plantilla.

**Architecture:** Todo cliente, patrón existente de la pestaña: funciones puras exportadas (`global.*` + `module.exports`) + renderer + dispatcher sobre `AppState.estadisticasSubTab` + agregados compartidos en `buildStatsAggregates()` + cachés por render (`_userDataCache`, `_porraAvgBySource`). Sin cambios de backend.

**Tech Stack:** Vanilla ES6, CSS3 con tokens `:root`, tests Node puros con `assert` (`tests/estadisticas-subtabs.test.js`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-26-estadisticas-individual-design.md` (fuente de verdad).
- Sin comentarios nuevos en código JS/CSS.
- CSS: solo variables `:root` existentes más los literales ya permitidos (`#EF4444` vía `var(--accent-danger, #EF4444)`). Excepción aprobada en spec: paleta del donut en JS `#8B5CF6`, `#10B981`, `#22D3EE`, `#F59E0B`.
- Todo texto dinámico con `esc()`.
- Mobile vertical first; reutilizar clases existentes (`.stats-card`, `.stats-card-title`, `.stats-kpi-grid`, `.stats-kpi`, `.stats-kv`, `.stats-kl`, `.stats-empty`, `.stats-pill`, `.stats-squad-row`, `.stats-sq-*`, `.stats-rank-sub`) antes de crear nuevas.
- Suite de referencia: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`. Sweep completo: `for f in tests/*.test.js; do node "$f" >/dev/null || exit 1; done`.
- Commits pequeños por tarea, mensajes en español estilo `feat(stats): …`.
- NO tocar ficheros sin seguimiento ajenos (`data/img/flyer-porra-champions.png`, PDFs en `reglas/`).

---

### Task 1: Funciones puras de jornadas y forma

**Files:**
- Modify: `js/stats.js` (añadir tras `calcBestJornadas`, ~línea 222)
- Test: `tests/estadisticas-subtabs.test.js`

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces: `calcUserBestJornada(ptsArr)` → `{idx, pts}|null`; `calcPositionHistory(pointsByUserByJornada)` → `{username:number[]}`; `calcTimesTopJornada(pointsByUserByJornada)` → `{username:number}`; `calcMomentum(ptsArr)` → `{recent,avg,delta}|null`; `calcConsistency(ptsArr)` → `number|null`; constante interna `STATS_CONSISTENCY_SIGMA = 8`.

- [ ] **Step 1: Write the failing test**

En `tests/estadisticas-subtabs.test.js`, añadir al import de la línea 3:

```javascript
const { buildCompletedLeagueData, calcStreaks, calcBestJornadas, calcUserBestJornada, calcPositionHistory, calcTimesTopJornada, calcMomentum, calcConsistency } = require('../js/stats.js');
```

(reemplazar la línea 3 entera por esa). Añadir las funciones de test y registrarlas en el runner del final siguiendo el patrón existente:

```javascript
function test_calcUserBestJornada_maximo_y_vacio() {
  assert.deepStrictEqual(calcUserBestJornada([30, 55, 40]), { idx: 1, pts: 55 });
  assert.strictEqual(calcUserBestJornada([]), null);
  assert.strictEqual(calcUserBestJornada(undefined), null);
}

function test_calcPositionHistory_empates_comparten_puesto() {
  const hist = calcPositionHistory({
    a: [10, 20],
    b: [15, 15],
    c: [15, 0],
  });
  assert.deepStrictEqual(hist.a, [3, 1]);
  assert.deepStrictEqual(hist.b, [1, 1]);
  assert.deepStrictEqual(hist.c, [1, 3]);
}

function test_calcTimesTopJornada_empate_cuenta_para_ambos() {
  const tops = calcTimesTopJornada({
    a: [10, 20],
    b: [15, 15],
    c: [15, 0],
  });
  assert.deepStrictEqual(tops, { a: 1, b: 2, c: 1 });
}

function test_calcMomentum_ultimas_3_vs_media() {
  const m = calcMomentum([10, 10, 10, 25, 25, 35]);
  assert.strictEqual(m.recent, 85);
  assert.strictEqual(m.avg, 19.2);
  assert.strictEqual(m.delta, 9.2);
  assert.strictEqual(calcMomentum([10, 10]), null);
}

function test_calcConsistency_desviacion_tipica() {
  assert.strictEqual(calcConsistency([10, 10, 10, 10]), 0);
  assert.strictEqual(calcConsistency([0, 10]), 5);
  assert.strictEqual(calcConsistency([10]), null);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL (`calcUserBestJornada is not a function`)

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, junto a las constantes de `SUBTABS` (~línea 369) añadir `const STATS_CONSISTENCY_SIGMA = 8;`. Tras `calcBestJornadas` (~línea 222) añadir:

```javascript
  function calcUserBestJornada(ptsArr) {
    const arr = ptsArr || [];
    if (!arr.length) return null;
    let best = { idx: 0, pts: arr[0] };
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > best.pts) best = { idx: i, pts: arr[i] };
    }
    return best;
  }

  function calcPositionHistory(pointsByUserByJornada) {
    const users = Object.keys(pointsByUserByJornada || {});
    let totalRondas = 0;
    for (const u of users) totalRondas = Math.max(totalRondas, (pointsByUserByJornada[u] || []).length);
    const out = {};
    const cum = {};
    for (const u of users) { out[u] = []; cum[u] = 0; }
    for (let j = 0; j < totalRondas; j++) {
      for (const u of users) cum[u] += ((pointsByUserByJornada[u] || [])[j] || 0);
      for (const u of users) {
        let rank = 1;
        for (const v of users) if (cum[v] > cum[u]) rank++;
        out[u].push(rank);
      }
    }
    return out;
  }

  function calcTimesTopJornada(pointsByUserByJornada) {
    const entries = Object.entries(pointsByUserByJornada || {});
    const out = {};
    for (const [u] of entries) out[u] = 0;
    if (!entries.length) return out;
    let len = 0;
    for (const [, arr] of entries) len = Math.max(len, arr.length);
    for (let j = 0; j < len; j++) {
      let max = null;
      for (const [, arr] of entries) {
        const v = arr[j] || 0;
        if (max === null || v > max) max = v;
      }
      for (const [u, arr] of entries) {
        if (max !== null && (arr[j] || 0) === max) out[u]++;
      }
    }
    return out;
  }

  function calcMomentum(ptsArr) {
    const arr = ptsArr || [];
    if (arr.length < 3) return null;
    const recent = arr.slice(-3).reduce((a, b) => a + b, 0);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const delta = Math.round((recent / 3 - avg) * 10) / 10;
    return { recent, avg: Math.round(avg * 10) / 10, delta };
  }

  function calcConsistency(ptsArr) {
    const arr = ptsArr || [];
    if (arr.length < 2) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }
```

En los dos bloques de exportación (finales del fichero) añadir `calcUserBestJornada, calcPositionHistory, calcTimesTopJornada, calcMomentum, calcConsistency` (en `global.*` una línea por función igual que las existentes; dentro del objeto de `module.exports`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS ambas

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): funciones puras de jornadas, posicion y forma"
```

---

### Task 2: Funciones puras de donut, sesgo y mejor partido

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas-subtabs.test.js`

**Interfaces:**
- Consumes: `matchResultOf` (existe, stats.js:107).
- Produces: constante `DONUT_RADIUS = 42`; `buildDonutSegments(parts)` → `[{key,label,color,value,pct,dasharray,dashoffset}]|[]`; `calcPredictionBias(userPredictions, playedMatches)` → `{H:{pred,hits},D:{…},A:{…}}`; `calcBestMatch(matchDetails)` → `{points,matchId}|null`.

- [ ] **Step 1: Write the failing test**

Import (añadir línea nueva tras las existentes):

```javascript
const { buildDonutSegments, calcPredictionBias, calcBestMatch } = require('../js/stats.js');
```

Tests:

```javascript
function test_buildDonutSegments_geometria_y_filtrado() {
  const segs = buildDonutSegments([
    { key: 'p', label: 'Pronósticos', color: '#8B5CF6', value: 75 },
    { key: 's', label: 'Plantilla', color: '#10B981', value: 25 },
    { key: 'z', label: 'Cero', color: '#000000', value: 0 },
  ]);
  assert.strictEqual(segs.length, 2);
  assert.strictEqual(segs[0].pct, 75);
  assert.ok(Math.abs(parseFloat(segs[0].dasharray) - (2 * Math.PI * 42 * 0.75)) < 0.01);
  assert.ok(Math.abs(parseFloat(segs[1].dashoffset) + (2 * Math.PI * 42 * 0.75)) < 0.01);
  assert.strictEqual(buildDonutSegments([{ key: 'a', value: 0 }]).length, 0);
  assert.strictEqual(buildDonutSegments([]).length, 0);
}

function test_calcPredictionBias_por_resultado_pronosticado() {
  const preds = {
    1: { home: 2, away: 1 },
    2: { home: 0, away: 0 },
    3: { home: 1, away: 3 },
    4: { home: 0, away: 0 },
  };
  const played = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 3, result: 'A' },
    { matchId: 4, home: 3, away: 1, result: 'H' },
    { matchId: 5, home: 1, away: 0, result: 'H' },
  ];
  const bias = calcPredictionBias(preds, played);
  assert.deepStrictEqual(bias.H, { pred: 1, hits: 1 });
  assert.deepStrictEqual(bias.D, { pred: 2, hits: 1 });
  assert.deepStrictEqual(bias.A, { pred: 1, hits: 1 });
}

function test_calcBestMatch_maximo_y_vacio() {
  assert.deepStrictEqual(
    calcBestMatch([{ match: { id: 7 }, points: 3 }, { match: { id: 9 }, points: 12 }]),
    { points: 12, matchId: 9 }
  );
  assert.strictEqual(calcBestMatch([]), null);
  assert.strictEqual(calcBestMatch(undefined), null);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL (`buildDonutSegments is not a function`)

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, junto a `STATS_CONSISTENCY_SIGMA` añadir `const DONUT_RADIUS = 42;`. Tras las funciones de la Task 1 añadir:

```javascript
  function buildDonutSegments(parts) {
    const C = 2 * Math.PI * DONUT_RADIUS;
    const valid = (parts || []).filter(p => Number(p.value) > 0);
    const total = valid.reduce((a, p) => a + Number(p.value), 0);
    if (!valid.length || total <= 0) return [];
    let acc = 0;
    return valid.map(p => {
      const len = (Number(p.value) / total) * C;
      const seg = {
        key: p.key,
        label: p.label,
        color: p.color,
        value: Number(p.value),
        pct: Math.round((Number(p.value) / total) * 100),
        dasharray: `${len.toFixed(2)} ${(C - len).toFixed(2)}`,
        dashoffset: (-acc).toFixed(2),
      };
      acc += len;
      return seg;
    });
  }

  function calcPredictionBias(userPredictions, playedMatches) {
    const out = { H: { pred: 0, hits: 0 }, D: { pred: 0, hits: 0 }, A: { pred: 0, hits: 0 } };
    for (const pm of playedMatches || []) {
      const pr = userPredictions?.[pm.matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;
      const r = matchResultOf(pr.home, pr.away);
      out[r].pred++;
      if (r === pm.result) out[r].hits++;
    }
    return out;
  }

  function calcBestMatch(matchDetails) {
    let best = null;
    for (const d of matchDetails || []) {
      if (!d.match) continue;
      if (!best || (d.points || 0) > best.points) best = { points: d.points || 0, matchId: d.match.id };
    }
    return best;
  }
```

Exportarlas en ambos bloques como en la Task 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS ambas

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): geometria de donut, sesgo 1X2 y mejor partido"
```

---

### Task 3: Funciones puras de plantilla individual y reparto de fuentes

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas-subtabs.test.js`

**Interfaces:**
- Consumes: nada (puras). `sourceSplitFromUserData` se consume en Tasks 5–6 con `getCachedUserData()` (forma: `{ squadPoints:{totalPoints}|{playerDetails:[]}, classificationTotal:number, eliminatoriasTeamDetails:[{points}] }` — ver `buildUserData` stats.js:383).
- Produces: `calcBestPlayersByPosition(playerDetails)` → `{G,D,M,F,top}`, cada uno `null|{jugador,puntosTotal}`; `calcMostProfitablePlayer(playerDetails)` → `null|{jugador,ptsPorPartido,partidos}`; `sourceSplitFromUserData(userTotalPoints, userData)` → `{prediction,squad,classification,eliminatorias}`.

- [ ] **Step 1: Write the failing test**

Import:

```javascript
const { calcBestPlayersByPosition, calcMostProfitablePlayer, sourceSplitFromUserData } = require('../js/stats.js');
```

Tests:

```javascript
function test_calcBestPlayersByPosition_top_por_demarcacion() {
  const details = [
    { jugador: { nombre: 'Courtois', posicion: 'G' }, puntosTotal: 38, partidos: [{}, {}] },
    { jugador: { nombre: 'Ederson', posicion: 'G' }, puntosTotal: 14, partidos: [{}] },
    { jugador: { nombre: 'Hakimi', posicion: 'D' }, puntosTotal: 41, partidos: [{}] },
    { jugador: { nombre: 'Mbappé', posicion: 'F' }, puntosTotal: 61, partidos: [{}] },
  ];
  const best = calcBestPlayersByPosition(details);
  assert.strictEqual(best.G.jugador.nombre, 'Courtois');
  assert.strictEqual(best.D.jugador.nombre, 'Hakimi');
  assert.strictEqual(best.M, null);
  assert.strictEqual(best.F.jugador.nombre, 'Mbappé');
  assert.strictEqual(best.top.jugador.nombre, 'Mbappé');
  assert.strictEqual(calcBestPlayersByPosition([]).top, null);
}

function test_calcMostProfitablePlayer_exige_partidos() {
  const details = [
    { jugador: { nombre: 'A' }, puntosTotal: 20, partidos: [{}, {}] },
    { jugador: { nombre: 'B' }, puntosTotal: 9, partidos: [{}] },
    { jugador: { nombre: 'C' }, puntosTotal: 50, partidos: [] },
  ];
  const best = calcMostProfitablePlayer(details);
  assert.strictEqual(best.jugador.nombre, 'A');
  assert.strictEqual(best.ptsPorPartido, 10);
  assert.strictEqual(best.partidos, 2);
  assert.strictEqual(calcMostProfitablePlayer([]), null);
  assert.strictEqual(calcMostProfitablePlayer([{ jugador: { nombre: 'D' }, puntosTotal: 99, partidos: [] }]), null);
}

function test_sourceSplitFromUserData_reparte_cuatro_fuentes() {
  const split = sourceSplitFromUserData(120, {
    squadPoints: { totalPoints: 60 },
    classificationTotal: 30,
    eliminatoriasTeamDetails: [{ points: 10 }, { points: 5 }, { points: 0 }],
  });
  assert.deepStrictEqual(split, { prediction: 120, squad: 60, classification: 30, eliminatorias: 15 });
  const vacio = sourceSplitFromUserData(undefined, {});
  assert.deepStrictEqual(vacio, { prediction: 0, squad: 0, classification: 0, eliminatorias: 0 });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL (`calcBestPlayersByPosition is not a function`)

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, tras las funciones de la Task 2:

```javascript
  function calcBestPlayersByPosition(playerDetails) {
    const best = { G: null, D: null, M: null, F: null, top: null };
    for (const pd of playerDetails || []) {
      const pos = pd.jugador?.posicion;
      const cur = pos && Object.prototype.hasOwnProperty.call(best, pos) ? best[pos] : undefined;
      if (pos && cur !== undefined && (!cur || pd.puntosTotal > cur.puntosTotal)) {
        best[pos] = { jugador: pd.jugador, puntosTotal: pd.puntosTotal };
      }
      if (!best.top || pd.puntosTotal > best.top.puntosTotal) {
        best.top = { jugador: pd.jugador, puntosTotal: pd.puntosTotal };
      }
    }
    return best;
  }

  function calcMostProfitablePlayer(playerDetails) {
    let best = null;
    for (const pd of playerDetails || []) {
      const partidos = (pd.partidos || []).length;
      if (partidos < 1) continue;
      const per = Math.round((pd.puntosTotal / partidos) * 10) / 10;
      if (!best || per > best.ptsPorPartido) {
        best = { jugador: pd.jugador, ptsPorPartido: per, partidos };
      }
    }
    return best;
  }

  function sourceSplitFromUserData(userTotalPoints, userData) {
    return {
      prediction: userTotalPoints || 0,
      squad: userData?.squadPoints?.totalPoints || 0,
      classification: userData?.classificationTotal || 0,
      eliminatorias: (userData?.eliminatoriasTeamDetails || []).reduce((a, t) => a + (t.points || 0), 0),
    };
  }
```

Exportarlas en ambos bloques.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS ambas

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): mejores por demarcacion, rentable y reparto de fuentes"
```

---

### Task 4: CSS de la sub-tab Individual

**Files:**
- Modify: `css/styles.css` (añadir al FINAL del fichero, tras el bloque de Consenso/Plantillas que acaba en `.stats-sq-pts`)

**Interfaces:**
- Consumes: tokens existentes `--text-primary`, `--text-secondary`, `--accent-primary`, `--accent-green`, `--accent-danger`, `--radius-full`.
- Produces: `.stats-ind-select`, `.stats-donut`, `.stats-donut-total`, `.stats-donut-sub`, `.stats-donut-legend`, `.stats-donut-chip`, `.stats-cmp-row`, `.stats-cmp-chip(.up/.dn)`. La card de plantilla reutiliza `.stats-squad-row`/`.stats-sq-*` (ya existen).

- [ ] **Step 1: Append the CSS block**

Añadir al final de `css/styles.css`:

```css
.stats-ind-select {
  width: 100%;
  padding: 10px 36px 10px 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--accent-primary);
  border-radius: 12px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238B5CF6' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.stats-ind-select:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.35);
}

.stats-ind-select option {
  background: #1E293B;
  color: var(--text-primary);
}

.stats-donut {
  display: block;
  width: 150px;
  margin: 0 auto;
}

.stats-donut-total {
  font-size: 21px;
  font-weight: 800;
  fill: var(--text-primary);
}

.stats-donut-sub {
  font-size: 9px;
  fill: var(--text-secondary);
}

.stats-donut-legend,
.stats-cmp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 10px;
}

.stats-donut-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-full);
}

.stats-donut-chip i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.stats-cmp-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  white-space: nowrap;
}

.stats-cmp-chip.up {
  color: var(--accent-green);
}

.stats-cmp-chip.dn {
  color: var(--accent-danger, #EF4444);
}
```

- [ ] **Step 2: Validate CSS syntax**

Run: `npx css-validator css/styles.css 2>/dev/null || node -e "console.log('sin validador disponible: verificación manual')"`
Expected: sin errores nuevos (los avisos preexistentes de rgba/data-uri son aceptables).

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat(stats): estilos para la sub-tab individual"
```

---

### Task 5: Cableado — estado, sub-tab, agregados y caché de medias

**Files:**
- Modify: `js/main.js` (bloque `AppState`, ~líneas 49-51)
- Modify: `js/stats.js` (SUBTABS ~365, dispatcher ~499-511, `renderEstadisticasTab`, `buildStatsAggregates` ~467-495, eliminar `renderFiabilidadBody` 520-549 y `calcReliabilityRows` 153-164 y sus exports)
- Test: `tests/estadisticas-subtabs.test.js` (ajustar imports/tests de `calcReliabilityRows`)

**Interfaces:**
- Consumes: funciones puras de Tasks 1–3; `getCachedUserData` (stats.js:400).
- Produces: `AppState.estadisticasIndividualUser` (null por defecto); `SUBTABS` con entrada `{key:'individual', label:'Individual'}`; dispatcher con rama provisional `body = statsEmpty('Ficha individual: próximamente')`; `buildStatsAggregates()` devuelve además `positionHistory`, `timesTopJornada`, `realPointsByUser` (`{username:number}` = suma de las 4 fuentes) y YA NO devuelve `reliabilityRows`; módulo `getPorraAvgBySource()` → `{prediction,squad,classification,eliminatorias}` medias redondeadas a 1 decimal; `_porraAvgBySource` se resetea junto a `_userDataCache` en `renderStatsContent()`.

- [ ] **Step 1: Añadir el campo de estado**

En `js/main.js`, bloque `AppState` (junto a `estadisticasConsensoRonda`):

```javascript
  estadisticasIndividualUser: null, // usuario mostrado en sub-tab Individual (null -> currentUser)
```

- [ ] **Step 2: Ajustar tests existentes (rojo esperado después del Step 3)**

En `tests/estadisticas-subtabs.test.js`:
- Línea 2: quitar `calcReliabilityRows` del destructuring → queda `const { matchResultOf, extractPlayedMatches, calcReliabilityRow } = require('../js/stats.js');`
- Eliminar la función `test_calcReliabilityRows_orden_desc_y_desempate` completa y su entrada en el runner del final.

- [ ] **Step 3: Cambios en js/stats.js**

1. `SUBTABS`: sustituir `{ key: 'fiabilidad', label: 'Fiabilid.' },` por `{ key: 'individual', label: 'Individual' },`.
2. Dispatcher `renderStatsContent()`: sustituir `else if (sub === 'fiabilidad') body = renderFiabilidadBody(aggregates);` por `else if (sub === 'individual') body = statsEmpty('Ficha individual: próximamente');` (rama provisional que la Task 6 reemplaza). En la primera línea del cuerpo añadir el reset de la media: dejar

```javascript
  function renderStatsContent() {
    _userDataCache = null;
    _porraAvgBySource = null;
```

3. Eliminar la función `calcReliabilityRows` completa (stats.js:153-164) y su export en ambos bloques (`global.calcReliabilityRows = …` y del objeto `module.exports`).
4. Eliminar la función `renderFiabilidadBody` completa (stats.js:520-549).
5. En `buildStatsAggregates()`:
   - Quitar la clave `reliabilityRows: …` del objeto retornado.
   - Tras el bucle de `squadPointsByUser` añadir el cálculo de puntos reales por usuario y añadir las tres claves nuevas al retorno:

```javascript
    const realPointsByUser = {};
    for (const p of AppState.players || []) {
      const s = sourceSplitFromUserData(AppState.userPoints[p.name]?.totalPoints, getCachedUserData(p.name));
      realPointsByUser[p.name] = s.prediction + s.squad + s.classification + s.eliminatorias;
    }
```

   Retorno ampliado (fragmento):

```javascript
      streaks: calcStreaks(league.pointsByUserByJornada),
      positionHistory: calcPositionHistory(league.pointsByUserByJornada),
      timesTopJornada: calcTimesTopJornada(league.pointsByUserByJornada),
      realPointsByUser,
```

6. Declarar el caché de medias y su accessor junto a `_userDataCache` (~stats.js:398):

```javascript
  let _porraAvgBySource = null;

  function getPorraAvgBySource() {
    if (_porraAvgBySource) return _porraAvgBySource;
    const keys = ['prediction', 'squad', 'classification', 'eliminatorias'];
    const totals = { prediction: 0, squad: 0, classification: 0, eliminatorias: 0 };
    const list = AppState.players || [];
    for (const p of list) {
      const s = sourceSplitFromUserData(AppState.userPoints[p.name]?.totalPoints, getCachedUserData(p.name));
      for (const k of keys) totals[k] += s[k] || 0;
    }
    const n = list.length || 1;
    _porraAvgBySource = {
      prediction: Math.round((totals.prediction / n) * 10) / 10,
      squad: Math.round((totals.squad / n) * 10) / 10,
      classification: Math.round((totals.classification / n) * 10) / 10,
      eliminatorias: Math.round((totals.eliminatorias / n) * 10) / 10,
    };
    return _porraAvgBySource;
  }
```

- [ ] **Step 4: Run tests**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS ambas (la app sigue funcionando; la sub-tab muestra el placeholder)

- [ ] **Step 5: Verificación sintáctica del bundle**

Run: `node -e "require('./js/stats.js'); require('./js/cacheStore.js'); console.log('OK')"` y abrir manualmente NO necesario.
Expected: `OK` sin excepciones.

- [ ] **Step 6: Commit**

```bash
git add js/main.js js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): cableado de la sub-tab individual y agregados globales"
```

---

### Task 6: Renderer `renderIndividualBody` y binding del desplegable

**Files:**
- Modify: `js/stats.js` (sustituir la rama provisional; añadir funciones de render antes de `bindStatsEvents`)
- Modify: `js/stats.js` `bindStatsEvents()` (~línea 838)

**Interfaces:**
- Consumes: todo lo anterior (`aggregates.positionHistory/timesTopJornada/realPointsByUser/completedRondas/playMatches/matchesById`, `getPorraAvgBySource`, `sourceSplitFromUserData` + `getCachedUserData`, `buildDonutSegments`, `calcReliabilityRow`, `calcPredictionBias`, `calcBestMatch`, `calcUserBestJornada`, `calcMomentum`, `calcConsistency`, `calcBestPlayersByPosition`, `calcMostProfitablePlayer`, `getPlayerMeta`, `squadPosEmoji`, `esc`, `statsEmpty`, `DONUT_RADIUS` implícito).
- Produces: `renderIndividualBody(aggregates)` conectada al dispatcher; listener `change` en `.stats-ind-select` dentro de `bindStatsEvents()`.

- [ ] **Step 1: Implementar el renderer**

Añadir estas funciones justo antes de `bindStatsEvents()`. Primero el helper de puntos por jornada (deriva el array por jornadas completadas del usuario seleccionado, misma semántica que `buildCompletedLeagueData`):

```javascript
  function jornadaPtsDeUsuario(aggregates, username) {
    const rondas = aggregates.completedRondas || [];
    const details = AppState.userPoints[username]?.matchDetails || [];
    return rondas.map(r => (details || [])
      .filter(d => d.match && d.match.fase === 'liga' && Number(d.match.ronda) === Number(r))
      .reduce((a, d) => a + (d.points || 0), 0));
  }
```

Después las funciones de render:

```javascript
  function resolveIndividualUsername(players) {
    const list = players || [];
    const wanted = AppState.estadisticasIndividualUser || AppState.currentUser?.name;
    if (list.some(p => p.name === wanted)) return wanted;
    const me = AppState.currentUser?.name;
    if (list.some(p => p.name === me)) return me;
    return list[0]?.name || null;
  }

  function individualOverallRank(realPointsByUser, username) {
    const mine = realPointsByUser?.[username] || 0;
    let rank = 1;
    for (const u of Object.keys(realPointsByUser || {})) {
      if ((realPointsByUser[u] || 0) > mine) rank++;
    }
    return rank;
  }

  function donutChartHtml(split) {
    const defs = [
      { key: 'prediction', label: 'Pronósticos', color: '#8B5CF6' },
      { key: 'squad', label: 'Plantilla', color: '#10B981' },
      { key: 'classification', label: 'Clasificación', color: '#22D3EE' },
      { key: 'eliminatorias', label: 'Eliminatorias', color: '#F59E0B' },
    ];
    const parts = defs.map(d => ({ ...d, value: split[d.key] || 0 }));
    const segs = buildDonutSegments(parts);
    if (!segs.length) return statsEmpty('Sin puntos todavía');
    const total = parts.reduce((a, p) => a + p.value, 0);
    const circles = segs.map(s =>
      `<circle cx="60" cy="60" r="${DONUT_RADIUS}" fill="none" stroke="${s.color}" stroke-width="18" stroke-dasharray="${s.dasharray}" stroke-dashoffset="${s.dashoffset}" transform="rotate(-90 60 60)"/>`
    ).join('');
    const legend = segs.map(s =>
      `<span class="stats-donut-chip" style="background:${s.color}22;color:${s.color}"><i style="background:${s.color}"></i>${esc(s.label)} ${s.value} · ${s.pct}%</span>`
    ).join('');
    return `
      <svg class="stats-donut" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${DONUT_RADIUS}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18"/>
        ${circles}
        <text x="60" y="57" text-anchor="middle" class="stats-donut-total">${total}</text>
        <text x="60" y="72" text-anchor="middle" class="stats-donut-sub">puntos totales</text>
      </svg>
      <div class="stats-donut-legend">${legend}</div>`;
  }

  function comparativaHtml(split) {
    const avg = getPorraAvgBySource();
    const defs = [
      ['prediction', 'Pronóst.'],
      ['squad', 'Plantilla'],
      ['classification', 'Clasif.'],
      ['eliminatorias', 'Elims.'],
    ];
    return `<div class="stats-cmp-row">vs media de la porra: ` + defs.map(([k, lbl]) => {
      const delta = Math.round(((split[k] || 0) - (avg[k] || 0)) * 10) / 10;
      const cls = delta > 0 ? 'up' : delta < 0 ? 'dn' : '';
      const sign = delta > 0 ? '+' : '';
      return `<span class="stats-cmp-chip ${cls}">${lbl} ${sign}${delta}</span>`;
    }).join('') + '</div>';
  }

  function momentumKpiHtml(m) {
    if (!m) return '<div class="stats-kpi"><div class="stats-kv">—</div><div class="stats-kl">momentum</div></div>';
    if (m.delta >= 2) return `<div class="stats-kpi"><div class="stats-kv">▲ ${m.delta}</div><div class="stats-kl">en forma</div></div>`;
    if (m.delta <= -2) return `<div class="stats-kpi"><div class="stats-kv">▼ ${m.delta}</div><div class="stats-kl">bajón</div></div>`;
    return '<div class="stats-kpi"><div class="stats-kv">→</div><div class="stats-kl">estable</div></div>';
  }

  function consistencyKpiHtml(sigma) {
    if (sigma === null) return '<div class="stats-kpi"><div class="stats-kv">—</div><div class="stats-kl">consistencia</div></div>';
    const lbl = sigma <= STATS_CONSISTENCY_SIGMA ? 'regular' : 'montaña rusa';
    return `<div class="stats-kpi"><div class="stats-kv">${sigma}</div><div class="stats-kl">${lbl}</div></div>`;
  }

  function renderIndividualBody(aggregates) {
    const players = AppState.players || [];
    const username = resolveIndividualUsername(players);
    if (!username) return statsEmpty('Sin usuarios disponibles');
    const me = AppState.currentUser?.name;

    const options = players.map(p =>
      `<option value="${esc(p.name)}" ${p.name === username ? 'selected' : ''}>${esc(p.avatar || '⚽')} ${esc(p.name)}</option>`
    ).join('');

    const rank = individualOverallRank(aggregates.realPointsByUser, username);

    const split = sourceSplitFromUserData(AppState.userPoints[username]?.totalPoints, getCachedUserData(username));

    const row = calcReliabilityRow(username, aggregates.playedMatches, AppState.allPredictions, AppState.userPoints);
    const fallidos = row.played - row.hits;
    const conversion = row.hits ? Math.round((row.exactScores / row.hits) * 100) : null;
    const bestMatch = calcBestMatch(AppState.userPoints[username]?.matchDetails);
    let bestMatchLbl = '—';
    if (bestMatch) {
      const m = aggregates.matchesById?.[bestMatch.matchId];
      bestMatchLbl = `${bestMatch.points} pts${m ? ` (${esc(m.homeTeam || '')} – ${esc(m.awayTeam || '')})` : ''}`;
    }
    const pronosticosCard = `
      <div class="stats-card">
        <div class="stats-card-title">⚽ Pronósticos (${row.played} partidos jugados)</div>
        ${row.played ? `
        <div class="stats-kpi-grid">
          <div class="stats-kpi"><div class="stats-kv">${row.hits}</div><div class="stats-kl">1X2 ✔</div></div>
          <div class="stats-kpi"><div class="stats-kv">${row.exactScores}</div><div class="stats-kl">exactos</div></div>
          <div class="stats-kpi"><div class="stats-kv">${fallidos}</div><div class="stats-kl">fallidos</div></div>
        </div>
        <div class="stats-rank-sub">% conversión de exactos: ${conversion === null ? '—' : conversion + '%'} · Mejor partido: ${bestMatchLbl}</div>` : statsEmpty('Sin partidos pronosticados con resultado')}
      </div>`;

    const rondas = aggregates.completedRondas || [];
    const hist = aggregates.positionHistory?.[username] || [];
    const tops = aggregates.timesTopJornada?.[username] || 0;
    const userJornadaPts = jornadaPtsDeUsuario(aggregates, username);
    const bestJ = calcUserBestJornada(userJornadaPts);
    const mediaJ = rondas.length ? Math.round(((split.prediction || 0) / rondas.length) * 10) / 10 : null;
    const jornadasInner = rondas.length ? `
      <div class="stats-kpi-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="stats-kpi"><div class="stats-kv">${bestJ ? `J${rondas[bestJ.idx] ?? bestJ.idx + 1} · ${bestJ.pts}` : '—'}</div><div class="stats-kl">mejor jornada</div></div>
        <div class="stats-kpi"><div class="stats-kv">${mediaJ ?? '—'}</div><div class="stats-kl">media/jornada</div></div>
        <div class="stats-kpi"><div class="stats-kv">${tops}</div><div class="stats-kl">veces mejor</div></div>
        <div class="stats-kpi"><div class="stats-kv">${hist.length ? `${Math.min(...hist)}º / ${Math.max(...hist)}º` : '—'}</div><div class="stats-kl">mejor/peor puesto</div></div>
      </div>
      <div class="stats-kpi-grid" style="margin-top:6px">
        ${momentumKpiHtml(calcMomentum(userJornadaPts))}
        ${consistencyKpiHtml(calcConsistency(userJornadaPts))}
        <div class="stats-kpi"><div class="stats-kv">${rondas.length}</div><div class="stats-kl">jornadas completas</div></div>
      </div>` : statsEmpty('Aún no hay jornadas completadas');
    const jornadasCard = `
      <div class="stats-card">
        <div class="stats-card-title">📅 Jornadas</div>
        ${jornadasInner}
      </div>`;

    const bias = calcPredictionBias(AppState.allPredictions?.[username], aggregates.playedMatches);
    const biasDefs = [['1', 'H'], ['X', 'D'], ['2', 'A']];
    const biasRows = biasDefs.map(([lbl, k]) => {
      const pct = bias[k].pred ? Math.round((bias[k].hits / bias[k].pred) * 100) : null;
      return `<div class="stats-consbar"><span class="lbl">${lbl}</span><div class="track"><div class="fill" style="width:${bias[k].pred ? pct : 0}%;background:var(--accent-primary)"></div></div><b style="color:var(--text-primary)">${bias[k].pred ? `${bias[k].hits}/${bias[k].pred} · ${pct}%` : '—'}</b></div>`;
    }).join('');
    const sesgoCard = `
      <div class="stats-card">
        <div class="stats-card-title">🎯 Sesgo 1/X/2 (pronosticado y acierto)</div>
        ${row.played ? biasRows : statsEmpty('Sin partidos pronosticados con resultado')}
      </div>`;

    const ud = getCachedUserData(username);
    const playerDetails = ud.squadPoints?.playerDetails || [];
    let plantillaCard;
    if (!playerDetails.length) {
      plantillaCard = `
      <div class="stats-card">
        <div class="stats-card-title">👥 Plantilla ideal</div>
        ${statsEmpty('Sin plantilla guardada')}
      </div>`;
    } else {
      const best = calcBestPlayersByPosition(playerDetails);
      const rentable = calcMostProfitablePlayer(playerDetails);
      const posRow = (posKey, lbl) => {
        const b = best[posKey];
        if (!b) return '';
        const ext = b.jugador.extension || 'webp';
        const img = `<img class="stats-sq-img" src="data/imgJugadores/${b.jugador.id}.${ext}" alt="" loading="lazy"
          onerror="this.outerHTML='<span class=&quot;stats-sq-img&quot; style=&quot;display:flex;align-items:center;justify-content:center&quot;>${squadPosEmoji(posKey)}</span>'">`;
        return `
        <div class="stats-squad-row">
          ${img}
          <div class="stats-sq-info">
            <div class="stats-sq-name">${esc(b.jugador.nombre || '')}</div>
            <div class="stats-sq-pos">Mejor ${esc(lbl)}</div>
          </div>
          <span class="stats-sq-pts">${b.puntosTotal} pts</span>
        </div>`;
      };
      const topRow = best.top ? `
        <div class="stats-squad-row" style="outline:1px solid var(--accent-gold)">
          <span class="stats-sq-img" style="display:flex;align-items:center;justify-content:center">⭐</span>
          <div class="stats-sq-info">
            <div class="stats-sq-name">${esc(best.top.jugador.nombre || '')}</div>
            <div class="stats-sq-pos">Mejor jugador</div>
          </div>
          <span class="stats-sq-pts">${best.top.puntosTotal} pts</span>
        </div>` : '';
      const rentableRow = rentable ? `
        <div class="stats-squad-row">
          <span class="stats-sq-img" style="display:flex;align-items:center;justify-content:center">💎</span>
          <div class="stats-sq-info">
            <div class="stats-sq-name">${esc(rentable.jugador.nombre || '')}</div>
            <div class="stats-sq-pos">Más rentable · ${rentable.partidos} partido${rentable.partidos === 1 ? '' : 's'}</div>
          </div>
          <span class="stats-sq-pts">${rentable.ptsPorPartido} pts/part</span>
        </div>` : '';
      plantillaCard = `
      <div class="stats-card">
        <div class="stats-card-title">👥 Plantilla ideal — mejores por demarcación</div>
        ${posRow('G', 'POR')}${posRow('D', 'DEF')}${posRow('M', 'MED')}${posRow('F', 'DEL')}
        ${topRow}
        ${rentableRow}
      </div>`;
    }

    return `
      <div class="stats-card">
        <div style="display:flex;align-items:center;gap:10px">
          <select id="stats-ind-select" class="stats-ind-select" aria-label="Seleccionar usuario">${options}</select>
          <span class="stats-rank-main">#${rank}</span>
        </div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">🥧 Desglose de puntos</div>
        ${donutChartHtml(split)}
        ${comparativaHtml(split)}
      </div>
      ${pronosticosCard}
      ${jornadasCard}
      ${sesgoCard}
      ${plantillaCard}`;
  }
```

- [ ] **Step 2: Conectar el dispatcher**

En `renderStatsContent()` sustituir la rama provisional de la Task 5:

```javascript
    else if (sub === 'individual') body = renderIndividualBody(aggregates);
```

- [ ] **Step 3: Binding del desplegable**

En `bindStatsEvents()`, junto a los demás listeners:

```javascript
    container.querySelectorAll('.stats-ind-select').forEach(sel => {
      sel.addEventListener('change', () => {
        AppState.estadisticasIndividualUser = sel.value;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });
```

- [ ] **Step 4: Run tests**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS ambas

- [ ] **Step 5: Verificación sintáctica**

Run: `node -e "require('./js/stats.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add js/stats.js
git commit -m "feat(stats): vista individual con donut, kpis, sesgo y plantilla"
```

Checklist visual manual (para el usuario, tras Task 7):
- Alternar a Individual: aparece el desplegable con tu usuario y `#puesto`.
- Cambiar de usuario: todas las cards se actualizan; volver a entrar mantiene la selección.
- Sin resultados aún: Pronósticos/Sesgo muestran estado vacío; donut con lo disponible.
- Usuario sin plantilla: card Plantilla vacía.
- Comparativa: chips ▲ verde / ▼ rojo según media.

---

### Task 7: Cache-busting, AGENTS.md y validación completa

**Files:**
- Modify: `index.html` (líneas 19, 322, 325)
- Modify: `AGENTS.md` (bullet `tab-estadisticas`, línea ~451)

**Interfaces:**
- Consumes: nada.
- Produces: versiones actualizadas para despliegue.

- [ ] **Step 1: Bump de versiones**

En `index.html`:
- Línea 19: `css/styles.css?v=78` → `css/styles.css?v=79`
- Línea 322: `js/stats.js?v=2` → `js/stats.js?v=3`
- Línea 325: `js/main.js?v=114` → `js/main.js?v=115`
No tocar otras versiones (`eliminatorias.js?v=6`, `cacheStore.js?v=1`, `apiData.js?v=1`, `fasesFechas.js?v=2`, `hoyPartidos.js?v=1`).

- [ ] **Step 2: Actualizar AGENTS.md**

Reemplazar el bullet `tab-estadisticas` (línea ~451) por:

```markdown
- `tab-estadisticas`: Sub-tabs internas: **Evolución** (gráfico acumulado por jornada, selector de fuente Total/Pronóst./Plantilla/Clasif./Eliminat., chips de jugadores), **Individual** (ficha por usuario seleccionable en desplegable, por defecto el logado: donut de puntos por fuente con comparativa ▲▼ vs media, aciertos 1X2/exactos/fallidos con % conversión y mejor partido, mejor jornada/media/veces mejor/mejor-peor puesto/momentum/consistencia, sesgo 1-X-2 y mejores jugadores de su plantilla con más rentable), **Rachas** (rachas ↑↓ entre jornadas completas de liga y top 5 mejores jornadas históricas), **Consenso** (% 1X2 y marcadores más votados por partido con navegación ◀▶ de jornadas, campeón más votado y rareza de tu cuadro de eliminatorias), **Plantillas** (jugadores reales más rentables entre todas las plantillas, con % posesión e insignias imprescindible/diferencial). Implementado en `js/stats.js` (funciones puras exportadas + render). Guard de fase simple: solo `FASE_PRETEMPORADA` oculta la sección. Estado: `AppState.estadisticasSubTab`, `AppState.estadisticasConsensoRonda`, `AppState.estadisticasIndividualUser`.
```

- [ ] **Step 3: Suite completa**

Run: `for f in tests/*.test.js; do echo "== $f"; node "$f" || exit 1; done`
Expected: todos PASS

- [ ] **Step 4: Commit**

```bash
git add index.html AGENTS.md
git commit -m "chore: bump cache-busting y documenta sub-tab individual"
```
