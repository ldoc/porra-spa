# Estadísticas: Sub-tabs (Fiabilidad, Rachas, Consenso, Plantillas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir 4 vistas estadísticas nuevas a la pestaña Estadísticas mediante sub-tabs internos (Evolución | Fiabilidad | Rachas | Consenso | Plantillas), calculadas en cliente para 15–30 usuarios.

**Architecture:** `js/stats.js` gana funciones puras exportables (agregaciones sobre `allPredictions`, `matchStats`, `squadsCache`, `finalPredictionsCache`) y un dispatcher de sub-tabs dentro de `renderStatsContent()`. La vista Evolución actual se extrae intacta a `renderEvolucionBody()`. Cada tarea añade una función pura testable y/o su renderer.

**Tech Stack:** Vanilla ES6 (IIFE + `module.exports`), CSS3 con variables `:root`, tests node con `assert` (patrón `tests/estadisticas.test.js`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-25-estadisticas-subtabs-design.md`.
- Sin cambios de backend, endpoints ni esquema MongoDB. Sin librerías externas.
- Solo variables/tokens de `css/styles.css` `:root`; nada de colores hex sueltos nuevos (salvo los ya usados en stats.js: `#334155`, `#1E293B`, `#64748B` del SVG).
- Todo texto dinámico escapado con `esc()` (ya existe en stats.js).
- Código sin comentarios (norma AGENTS.md); estilo espejo de `js/stats.js` actual.
- Targets táctiles mínimos 44px o `min-height: 32px` como el CSS stats existente.
- Al tocar `js/main.js` o `css/styles.css` o `js/stats.js`: bump de `?v=` en `index.html` (Tarea 11 lo centraliza; las tareas intermedias NO tocan index.html).
- Verificación de pruebas: `node tests/estadisticas-subtabs.test.js` (y al final, todas las suites de `tests/*.test.js` que se ejecuten con node).

---

### Task 1: Funciones puras de fiabilidad

**Files:**
- Modify: `js/stats.js` (añadir funciones + exports, antes de la línea `global.renderEstadisticasTab = ...`)
- Test: `tests/estadisticas-subtabs.test.js` (nuevo)

**Interfaces:**
- Consumes: nada nuevo (datos planos por parámetro).
- Produces:
  - `matchResultOf(homeGoals, awayGoals)` → `'H'|'A'|'D'`
  - `extractPlayedMatches(matches, matchStatsById)` → `[{ matchId, home, away, result }]`
  - `calcReliabilityRow(username, playedMatches, allPredictions, userPoints)` → `{ username, played, hits, pctResult, ptsPerMatch, exactScores, perfect15 }`
  - `calcReliabilityRows(players, playedMatches, allPredictions, userPoints)` → array ordenado por `pctResult` desc, desempate `ptsPerMatch` desc, luego nombre

- [ ] **Step 1: Write the failing test**

Crear `tests/estadisticas-subtabs.test.js`:

```js
const assert = require('assert');
const { matchResultOf, extractPlayedMatches, calcReliabilityRow, calcReliabilityRows } = require('../js/stats.js');

function test_matchResultOf() {
  assert.strictEqual(matchResultOf(2, 1), 'H');
  assert.strictEqual(matchResultOf(0, 3), 'A');
  assert.strictEqual(matchResultOf(1, 1), 'D');
}

function test_extractPlayedMatches_solo_con_goles_finitos() {
  const matches = [
    { id: 1, homeTeamId: 10, awayTeamId: 20 },
    { id: 2, homeTeamId: 30, awayTeamId: 40 },
    { id: 3, homeTeamId: 50, awayTeamId: 60 },
  ];
  const msById = {
    1: { eventId: 1, stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
    2: { eventId: 2, stats: { 30: { goles: 0 }, 40: { goles: 0 } } },
    3: { eventId: 3, stats: {} },
  };
  const played = extractPlayedMatches(matches, msById);
  assert.strictEqual(played.length, 2);
  assert.deepStrictEqual(played[0], { matchId: 1, home: 2, away: 1, result: 'H' });
  assert.deepStrictEqual(played[1], { matchId: 2, home: 0, away: 0, result: 'D' });
}

function test_calcReliabilityRow_metricas() {
  const playedMatches = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 3, result: 'A' },
    { matchId: 4, home: 2, away: 2, result: 'D' },
  ];
  const allPredictions = {
    ana: {
      1: { home: 2, away: 1 },
      2: { home: 1, away: 1 },
      3: { home: 2, away: 0 },
    },
  };
  const userPoints = { ana: { matchDetails: [
    { match: { id: 1 }, points: 15 },
    { match: { id: 2 }, points: 4 },
    { match: { id: 3 }, points: 11 },
    { match: { id: 99 }, points: 8 },
  ] } };
  const r = calcReliabilityRow('ana', playedMatches, allPredictions, userPoints);
  assert.strictEqual(r.played, 3);
  assert.strictEqual(r.hits, 2);
  assert.strictEqual(r.pctResult, 67);
  assert.strictEqual(r.ptsPerMatch, 10);
  assert.strictEqual(r.exactScores, 2);
  assert.strictEqual(r.perfect15, 1);
}

function test_calcReliabilityRow_sin_pronosticos() {
  const r = calcReliabilityRow('bob', [], {}, {});
  assert.strictEqual(r.played, 0);
  assert.strictEqual(r.pctResult, 0);
  assert.strictEqual(r.ptsPerMatch, 0);
}

function test_calcReliabilityRows_orden_desc_y_desempate() {
  const players = [{ name: 'ana' }, { name: 'bea' }, { name: 'cal' }];
  const playedMatches = [
    { matchId: 1, home: 1, away: 0, result: 'H' },
    { matchId: 2, home: 1, away: 0, result: 'H' },
  ];
  const allPredictions = {
    ana: { 1: { home: 1, away: 0 }, 2: { home: 0, away: 0 } },
    bea: { 1: { home: 1, away: 0 }, 2: { home: 1, away: 0 } },
    cal: { 1: { home: 0, away: 1 }, 2: { home: 0, away: 2 } },
  };
  const userPoints = {
    ana: { matchDetails: [{ match: { id: 1 }, points: 15 }, { match: { id: 2 }, points: 3 }] },
    bea: { matchDetails: [{ match: { id: 1 }, points: 15 }, { match: { id: 2 }, points: 15 }] },
    cal: { matchDetails: [{ match: { id: 1 }, points: 12 }, { match: { id: 2 }, points: 8 }] },
  };
  const rows = calcReliabilityRows(players, playedMatches, allPredictions, userPoints);
  assert.deepStrictEqual(rows.map(r => r.username), ['bea', 'ana', 'cal']);
  assert.strictEqual(rows[0].pctResult, 100);
  assert.strictEqual(rows[1].pctResult, 50);
  assert.strictEqual(rows[2].hits, 0);
}

test_matchResultOf();
test_extractPlayedMatches_solo_con_goles_finitos();
test_calcReliabilityRow_metricas();
test_calcReliabilityRow_sin_pronosticos();
test_calcReliabilityRows_orden_desc_y_desempate();
console.log('OK estadisticas-subtabs T1');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL con `TypeError: matchResultOf is not a function` (o similar al destructurar undefined).

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, dentro de la IIFE (después de `isLeagueComplete`), añadir:

```js
  function matchResultOf(homeGoals, awayGoals) {
    if (homeGoals > awayGoals) return 'H';
    if (homeGoals < awayGoals) return 'A';
    return 'D';
  }

  function extractPlayedMatches(matches, matchStatsById) {
    const played = [];
    for (const m of matches || []) {
      const ms = matchStatsById?.[m.id];
      const home = ms?.stats?.[m.homeTeamId]?.goles;
      const away = ms?.stats?.[m.awayTeamId]?.goles;
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      played.push({ matchId: m.id, home, away, result: matchResultOf(home, away) });
    }
    return played;
  }

  function calcReliabilityRow(username, playedMatches, allPredictions, userPoints) {
    const preds = allPredictions?.[username] || {};
    const pointsByMatch = new Map();
    for (const d of userPoints?.[username]?.matchDetails || []) {
      if (d.match) pointsByMatch.set(d.match.id, d.points || 0);
    }
    let played = 0, hits = 0, pointsSum = 0, exact = 0, perfect = 0;
    for (const pm of playedMatches || []) {
      const pr = preds[pm.matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;
      played++;
      if (matchResultOf(pr.home, pr.away) === pm.result) hits++;
      const pts = pointsByMatch.get(pm.matchId) || 0;
      pointsSum += pts;
      if (pts >= 15) perfect++;
      if (pr.home === pm.home && pr.away === pm.away) exact++;
    }
    return {
      username,
      played,
      hits,
      pctResult: played ? Math.round((hits / played) * 100) : 0,
      ptsPerMatch: played ? Math.round((pointsSum / played) * 10) / 10 : 0,
      exactScores: exact,
      perfect15: perfect,
    };
  }

  function calcReliabilityRows(players, playedMatches, allPredictions, userPoints) {
    const rows = [];
    for (const p of players || []) {
      rows.push(calcReliabilityRow(p.name, playedMatches, allPredictions, userPoints));
    }
    rows.sort((a, b) =>
      b.pctResult - a.pctResult ||
      b.ptsPerMatch - a.ptsPerMatch ||
      String(a.username).localeCompare(String(b.username))
    );
    return rows;
  }
```

Y ampliar los dos bloques de export al final de la IIFE:

```js
  global.matchResultOf = matchResultOf;
  global.extractPlayedMatches = extractPlayedMatches;
  global.calcReliabilityRow = calcReliabilityRow;
  global.calcReliabilityRows = calcReliabilityRows;
```

y en `module.exports`: `, matchResultOf, extractPlayedMatches, calcReliabilityRow, calcReliabilityRows`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: PASS con `OK estadisticas-subtabs T1`.

Run también la suite existente: `node tests/estadisticas.test.js`
Expected: sigue PASS sin regresiones.

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): funciones puras de fiabilidad de pronostico"
```

---

### Task 2: Funciones puras de rachas y mejores jornadas

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas-subtabs.test.js` (añadir al final, antes del `console.log`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `buildCompletedLeagueData(leagueMatches, matchStatsById, matchDetailsByUser)` → `{ completedRondas: number[], pointsByUserByJornada: { [username]: number[] } }` donde `pointsByUserByJornada[u][i]` son los puntos del usuario en la i-ésima jornada completada (orden ascendente de ronda).
  - `calcStreaks(pointsByUserByJornada)` → `{ [username]: { dir: 'up'|'down', len: number, lastPts: number } | null }`
  - `calcBestJornadas(pointsByUserByJornada, topN)` → `[{ username, jornadaIdx, pts }]` ordenado por `pts` desc, cortado a `topN`.

- [ ] **Step 1: Write the failing test**

Añadir a `tests/estadisticas-subtabs.test.js` (requiere las nuevas importaciones en la línea 2):

```js
const { buildCompletedLeagueData, calcStreaks, calcBestJornadas } = require('../js/stats.js');

function test_buildCompletedLeagueData_solo_jornadas_completas() {
  const leagueMatches = [
    { id: 1, ronda: 1, homeTeamId: 10, awayTeamId: 20, fase: 'liga' },
    { id: 2, ronda: 1, homeTeamId: 30, awayTeamId: 40, fase: 'liga' },
    { id: 3, ronda: 2, homeTeamId: 10, awayTeamId: 30, fase: 'liga' },
    { id: 4, ronda: 3, homeTeamId: 20, awayTeamId: 40, fase: 'liga' },
  ];
  const msById = {
    1: { eventId: 1, stats: { 10: { goles: 1 }, 20: { goles: 0 } } },
    2: { eventId: 2, stats: { 30: { goles: 2 }, 40: { goles: 2 } } },
    3: { eventId: 3, stats: { 10: { goles: 3 }, 30: { goles: 1 } } },
  };
  const detailsByUser = {
    ana: [
      { match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 },
      { match: { id: 2, ronda: 1, fase: 'liga' }, points: 7 },
      { match: { id: 3, ronda: 2, fase: 'liga' }, points: 15 },
      { match: { id: 4, ronda: 3, fase: 'liga' }, points: 5 },
      { match: { id: 999, ronda: 4, fase: '16' }, points: 9 },
    ],
  };
  const r = buildCompletedLeagueData(leagueMatches, msById, detailsByUser);
  assert.deepStrictEqual(r.completedRondas, [1, 2]);
  assert.deepStrictEqual(r.pointsByUserByJornada.ana, [15, 15]);
}

function test_calcStreaks_up_down_y_empate() {
  const st = calcStreaks({
    a: [10, 20, 30],
    b: [30, 25, 10],
    c: [10, 10, 20],
    d: [5],
    e: [],
  });
  assert.deepStrictEqual(st.a, { dir: 'up', len: 2, lastPts: 30 });
  assert.deepStrictEqual(st.b, { dir: 'down', len: 2, lastPts: 10 });
  assert.deepStrictEqual(st.c, { dir: 'up', len: 1, lastPts: 20 });
  assert.strictEqual(st.d, null);
  assert.strictEqual(st.e, null);
}

function test_calcStreaks_corte_al_cambiar_direccion() {
  const st = calcStreaks({ x: [10, 30, 20, 25] });
  assert.deepStrictEqual(st.x, { dir: 'up', len: 1, lastPts: 25 });
}

function test_calcBestJornadas_top_n() {
  const best = calcBestJornadas({
    ana: [15, 30],
    bea: [40],
  }, 2);
  assert.deepStrictEqual(best, [
    { username: 'bea', jornadaIdx: 0, pts: 40 },
    { username: 'ana', jornadaIdx: 1, pts: 30 },
  ]);
}

test_buildCompletedLeagueData_solo_jornadas_completas();
test_calcStreaks_up_down_y_empate();
test_calcStreaks_corte_al_cambiar_direccion();
test_calcBestJornadas_top_n();
console.log('OK estadisticas-subtabs T2');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL (`buildCompletedLeagueData is not a function`).

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js` (tras las funciones de Task 1):

```js
  function buildCompletedLeagueData(leagueMatches, matchStatsById, matchDetailsByUser) {
    const totalByRonda = new Map();
    const doneByRonda = new Map();
    for (const m of leagueMatches || []) {
      const r = Number(m.ronda);
      if (!(r >= 1 && r <= 8)) continue;
      totalByRonda.set(r, (totalByRonda.get(r) || 0) + 1);
      const home = matchStatsById?.[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById?.[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away)) {
        doneByRonda.set(r, (doneByRonda.get(r) || 0) + 1);
      }
    }
    const completedRondas = [...totalByRonda.keys()]
      .filter(r => doneByRonda.get(r) === totalByRonda.get(r))
      .sort((a, b) => a - b);
    const idxByRonda = new Map(completedRondas.map((r, i) => [r, i]));

    const pointsByUserByJornada = {};
    for (const [username, details] of Object.entries(matchDetailsByUser || {})) {
      const arr = completedRondas.map(() => 0);
      for (const d of details || []) {
        const m = d.match;
        if (!m || m.fase !== 'liga') continue;
        const idx = idxByRonda.get(Number(m.ronda));
        if (idx === undefined) continue;
        arr[idx] += d.points || 0;
      }
      pointsByUserByJornada[username] = arr;
    }
    return { completedRondas, pointsByUserByJornada };
  }

  function calcStreaks(pointsByUserByJornada) {
    const out = {};
    for (const [username, arr] of Object.entries(pointsByUserByJornada || {})) {
      let dir = null, len = 0;
      for (let i = arr.length - 1; i >= 1; i--) {
        if (arr[i] === arr[i - 1]) break;
        const curDir = arr[i] > arr[i - 1] ? 'up' : 'down';
        if (dir === null) { dir = curDir; len = 1; }
        else if (curDir === dir) len++;
        else break;
      }
      out[username] = dir ? { dir, len, lastPts: arr[arr.length - 1] || 0 } : null;
    }
    return out;
  }

  function calcBestJornadas(pointsByUserByJornada, topN = 5) {
    const items = [];
    for (const [username, arr] of Object.entries(pointsByUserByJornada || {})) {
      arr.forEach((pts, jornadaIdx) => items.push({ username, jornadaIdx, pts }));
    }
    items.sort((a, b) => b.pts - a.pts);
    return items.slice(0, topN);
  }
```

Exports: `global.buildCompletedLeagueData`, `global.calcStreaks`, `global.calcBestJornadas` + `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS ambas (`OK estadisticas-subtabs T2` incluido).

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): rachas de jornada y mejores jornadas historicas"
```

---

### Task 3: Funciones puras de consenso (partidos, campeón, cuadro)

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas-subtabs.test.js`

**Interfaces:**
- Consumes: `matchResultOf` (Task 1).
- Produces:
  - `computeMatchConsensus(matchId, allPredictions)` → `{ counts: {H,D,A}, pct: {H,D,A}, total, topScores: [{score:'2-1', votes, pct}], majorityResult: 'H'|'A'|'D'|null }` (topScores máx 6; empate de votos ordena por score asc; mayoría: primer máximo en orden H,D,A).
  - `tallyChampions(finalPredictionsCache)` → `{ total, teams: [{teamId, votes}] }` ordenado por votos desc, luego teamId asc.
  - `finalPredictionTeamIds(fp)` → array de teamIds de los 24 slots (sin duplicados garantizado por quien lo consume vía Set).
  - `compareQuadroWithCommunity(myUsername, finalPredictionsCache)` → `{ users, avgCommon, avgPct, veryDiffCount }` (avgCommon 1 decimal; veryDiff = usuarios cuyo cuadro difiere en ≥12 equipos, diferencia = unión − intersección).

- [ ] **Step 1: Write the failing test**

```js
const { computeMatchConsensus, tallyChampions, finalPredictionTeamIds, compareQuadroWithCommunity } = require('../js/stats.js');

function test_computeMatchConsensus_barras_y_marcadores() {
  const allPredictions = {
    ana: { 7: { home: 2, away: 1 } },
    bea: { 7: { home: 2, away: 1 } },
    cal: { 7: { home: 1, away: 1 } },
    dan: { 7: { home: 0, away: 1 } },
    eve: { 7: { home: 2, away: 1 } },
    fin: { 8: { home: 1, away: 0 } },
    gil: {},
  };
  const c = computeMatchConsensus(7, allPredictions);
  assert.strictEqual(c.total, 5);
  assert.deepStrictEqual(c.counts, { H: 4, D: 1, A: 0 });
  assert.strictEqual(c.majorityResult, 'H');
  assert.strictEqual(c.topScores[0].score, '2-1');
  assert.strictEqual(c.topScores[0].votes, 3);
  assert.strictEqual(c.topScores[0].pct, 60);
  assert.strictEqual(c.topScores.length, 3);
}

function test_computeMatchConsensus_vacio() {
  const c = computeMatchConsensus(99, {});
  assert.strictEqual(c.total, 0);
  assert.strictEqual(c.majorityResult, null);
  assert.deepStrictEqual(c.topScores, []);
}

function test_tallyChampions() {
  const t = tallyChampions({
    ana: { champion: 100 },
    bea: { champion: 100 },
    cal: { champion: 200 },
    dan: { champion: null },
    eve: null,
  });
  assert.strictEqual(t.total, 3);
  assert.deepStrictEqual(t.teams, [{ teamId: 100, votes: 2 }, { teamId: 200, votes: 1 }]);
}

function test_finalPredictionTeamIds_24_slots() {
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4],
    quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24],
  };
  assert.strictEqual(finalPredictionTeamIds(fp).length, 24);
  assert.strictEqual(finalPredictionTeamIds(null).length, 0);
}

function test_compareQuadroWithCommunity() {
  const mk = (base) => ({ champion: base, runnerUp: base + 1,
    semiFinalists: [base + 2, base + 3],
    quarterFinalists: [base + 4, base + 5, base + 6, base + 7],
    roundOf16: Array.from({ length: 8 }, (_, i) => base + 8 + i),
    roundOf32: Array.from({ length: 8 }, (_, i) => base + 16 + i) });
  const cache = { yo: mk(100), igual: mk(100), medio: mk(112), muydistinto: mk(124) };
  const r = compareQuadroWithCommunity('yo', cache);
  assert.strictEqual(r.users, 3);
  assert.strictEqual(r.avgCommon, 12);
  assert.strictEqual(r.avgPct, 50);
  assert.strictEqual(r.veryDiffCount, 2);
}

test_computeMatchConsensus_barras_y_marcadores();
test_computeMatchConsensus_vacio();
test_tallyChampions();
test_finalPredictionTeamIds_24_slots();
test_compareQuadroWithCommunity();
console.log('OK estadisticas-subtabs T3');
```

Nota de verificación del caso: `mk(100)` cubre los ids {100..123}, `mk(112)` cubre {112..135} (12 comunes con el mío), `mk(124)` cubre {124..147} (0 comunes). avgCommon = (24+12+0)/3 = 12; avgPct = round(12/24×100) = 50; muy distinto (≥12 de diferencia: unión − intersección) → `medio` (36−12=24) y `muydistinto` (48−0=48).

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL (`computeMatchConsensus is not a function`).

- [ ] **Step 3: Write minimal implementation**

```js
  function computeMatchConsensus(matchId, allPredictions) {
    const counts = { H: 0, D: 0, A: 0 };
    const scoreVotes = new Map();
    let total = 0;
    for (const preds of Object.values(allPredictions || {})) {
      const pr = preds?.[matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;
      total++;
      counts[matchResultOf(pr.home, pr.away)]++;
      const key = `${pr.home}-${pr.away}`;
      scoreVotes.set(key, (scoreVotes.get(key) || 0) + 1);
    }
    const topScores = [...scoreVotes.entries()]
      .map(([score, votes]) => ({ score, votes, pct: Math.round((votes / total) * 100) }))
      .sort((a, b) => b.votes - a.votes || a.score.localeCompare(b.score))
      .slice(0, 6);
    let majorityResult = null;
    if (total) {
      majorityResult = 'H';
      for (const k of ['D', 'A']) {
        if (counts[k] > counts[majorityResult]) majorityResult = k;
      }
    }
    const pct = {};
    for (const k of ['H', 'D', 'A']) pct[k] = total ? Math.round((counts[k] / total) * 100) : 0;
    return { counts, pct, total, topScores, majorityResult };
  }

  function tallyChampions(finalPredictionsCache) {
    const votes = new Map();
    let total = 0;
    for (const fp of Object.values(finalPredictionsCache || {})) {
      const c = fp?.champion;
      if (!Number.isFinite(c)) continue;
      total++;
      votes.set(c, (votes.get(c) || 0) + 1);
    }
    const teams = [...votes.entries()]
      .map(([teamId, n]) => ({ teamId, votes: n }))
      .sort((a, b) => b.votes - a.votes || a.teamId - b.teamId);
    return { total, teams };
  }

  function finalPredictionTeamIds(fp) {
    if (!fp) return [];
    const ids = [
      Number.isFinite(fp.champion) ? fp.champion : null,
      Number.isFinite(fp.runnerUp) ? fp.runnerUp : null,
      ...(Array.isArray(fp.semiFinalists) ? fp.semiFinalists : []),
      ...(Array.isArray(fp.quarterFinalists) ? fp.quarterFinalists : []),
      ...(Array.isArray(fp.roundOf16) ? fp.roundOf16 : []),
      ...(Array.isArray(fp.roundOf32) ? fp.roundOf32 : []),
    ];
    return ids.filter(v => Number.isFinite(v));
  }

  function compareQuadroWithCommunity(myUsername, finalPredictionsCache) {
    const mine = new Set(finalPredictionTeamIds(finalPredictionsCache?.[myUsername]));
    let users = 0, commonSum = 0, veryDiffCount = 0;
    for (const [username, fp] of Object.entries(finalPredictionsCache || {})) {
      if (!fp || username === myUsername) continue;
      const theirs = new Set(finalPredictionTeamIds(fp));
      let common = 0;
      for (const id of theirs) if (mine.has(id)) common++;
      const union = new Set([...mine, ...theirs]);
      users++;
      commonSum += common;
      if (union.size - common >= 12) veryDiffCount++;
    }
    const avgCommon = users ? Math.round((commonSum / users) * 10) / 10 : 0;
    const avgPct = users ? Math.round((commonSum / users / 24) * 100) : 0;
    return { users, avgCommon, avgPct, veryDiffCount };
  }
```

Exports globales + module.exports correspondientes.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS (`OK estadisticas-subtabs T3`).

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): consenso 1X2, marcadores votados, campeon y rareza de cuadro"
```

---

### Task 4: Agregación de plantillas

**Files:**
- Modify: `js/stats.js`
- Test: `tests/estadisticas-subtabs.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `aggregateSquads(squadPointsByUser, squadsCache)` → `{ usersWithSquad, uniquePlayers, rows: [{ player, pts, ownerCount, possessionPct }] }` ordenado por `pts` desc, desempate `possessionPct` desc. Claves de jugador normalizadas con `String(sp.id)` (los IDs llegan como number en squads y string en matchstats).

- [ ] **Step 1: Write the failing test**

```js
const { aggregateSquads } = require('../js/stats.js');

function test_aggregateSquads_pts_posesion() {
  const squadsCache = {
    ana: [{ id: 1, nombre: 'Mbappé', posicion: 'F' }, { id: 2, nombre: 'Courtois', posicion: 'G' }],
    bea: [{ id: 1, nombre: 'Mbappé', posicion: 'F' }],
  };
  const squadPointsByUser = {
    ana: { playerDetails: [
      { jugador: { id: 1 }, puntosTotal: 50 },
      { jugador: { id: 2 }, puntosTotal: 20 },
    ] },
    bea: { playerDetails: [{ jugador: { id: 1 }, puntosTotal: 36 }] },
    cal: null,
  };
  const r = aggregateSquads(squadPointsByUser, squadsCache);
  assert.strictEqual(r.usersWithSquad, 2);
  assert.strictEqual(r.uniquePlayers, 2);
  assert.strictEqual(r.rows[0].player.nombre, 'Mbappé');
  assert.strictEqual(r.rows[0].pts, 86);
  assert.strictEqual(r.rows[0].ownerCount, 2);
  assert.strictEqual(r.rows[0].possessionPct, 100);
  assert.strictEqual(r.rows[1].player.nombre, 'Courtois');
  assert.strictEqual(r.rows[1].possessionPct, 50);
}

function test_aggregateSquads_vacio() {
  const r = aggregateSquads({}, {});
  assert.strictEqual(r.usersWithSquad, 0);
  assert.deepStrictEqual(r.rows, []);
}

test_aggregateSquads_pts_posesion();
test_aggregateSquads_vacio();
console.log('OK estadisticas-subtabs T4');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticas-subtabs.test.js`
Expected: FAIL (`aggregateSquads is not a function`).

- [ ] **Step 3: Write minimal implementation**

```js
  function aggregateSquads(squadPointsByUser, squadsCache) {
    const agg = new Map();
    let usersWithSquad = 0;
    for (const [username, squad] of Object.entries(squadsCache || {})) {
      if (!Array.isArray(squad) || !squad.length) continue;
      usersWithSquad++;
      for (const sp of squad) {
        const id = String(sp?.id);
        if (!id || id === 'undefined') continue;
        if (!agg.has(id)) agg.set(id, { player: sp, owners: new Set(), pts: 0 });
        agg.get(id).owners.add(username);
      }
    }
    for (const sq of Object.values(squadPointsByUser || {})) {
      for (const pd of sq?.playerDetails || []) {
        const entry = agg.get(String(pd.jugador?.id));
        if (entry) entry.pts += pd.puntosTotal || 0;
      }
    }
    const rows = [...agg.values()].map(e => ({
      player: e.player,
      pts: e.pts,
      ownerCount: e.owners.size,
      possessionPct: usersWithSquad ? Math.round((e.owners.size / usersWithSquad) * 100) : 0,
    })).sort((a, b) => b.pts - a.pts || b.possessionPct - a.possessionPct);
    return { usersWithSquad, uniquePlayers: rows.length, rows };
  }
```

Export global + module.exports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS (`OK estadisticas-subtabs T4`).

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/estadisticas-subtabs.test.js
git commit -m "feat(stats): agregacion de plantillas de la comunidad"
```

---

### Task 5: CSS de las vistas nuevas

**Files:**
- Modify: `css/styles.css` (añadir bloque al final, tras la sección «PESTAÑA DE ESTADÍSTICAS» actual)

**Interfaces:**
- Consumes: variables `:root` existentes (`--ucl-card`, `--ucl-surface`, `--accent-primary`, `--accent-cyan`, `--accent-gold`, `--accent-purple`, `--text-secondary`, `--text-muted`, `--border-color`, `--radius-md`).
- Produces (las usan Tasks 7–10):
  - `.stats-subtabs` + `.stats-subtab` (+`.active`): barra segmentada 5 columnas (misma anatomía que `.stats-source-seg` pero activo verde).
  - `.stats-rank-row` (+`.me`) con `.stats-rank-pos`, `.stats-rank-name`, `.stats-rank-main`, `.stats-rank-sub`: filas escalables.
  - `.stats-kpi-grid`, `.stats-kpi`, `.stats-kv`, `.stats-kl`.
  - `.stats-badge-up`, `.stats-badge-dn`, `.stats-pill` (+`.gold`, `.cyan`).
  - `.stats-consbar` (+`.lbl`, `.track`, `.fill`).
  - `.stats-cons-card` (+`.open`), `.stats-cons-head`, `.stats-cons-body`, `.stats-cons-extra` (colapsado por defecto).
  - `.stats-scoregrid`, `.stats-scorecell` (+`.mine`), `.stats-sv`, `.stats-sp`.
  - `.stats-squad-row` con `.stats-sq-img`, `.stats-sq-info`, `.stats-sq-name`, `.stats-sq-pos`, `.stats-sq-pts`.

- [ ] **Step 1: Añadir el bloque CSS**

Al final de `css/styles.css`:

```css
/* ============================================================
   ESTADÍSTICAS — SUB-TABS Y VISTAS AGREGADAS
   ============================================================ */
.stats-subtabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  background: var(--ucl-surface);
  padding: 4px;
  border-radius: 12px;
}

.stats-subtab {
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

.stats-subtab.active {
  background: var(--accent-primary);
  color: #fff;
}

.stats-rank-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  font-size: var(--font-size-xs);
  min-height: 36px;
}

.stats-rank-row.me {
  box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.45);
}

.stats-rank-pos {
  width: 22px;
  height: 18px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.stats-rank-name {
  flex: 1;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-rank-main {
  font-weight: 800;
  color: var(--accent-cyan);
}

.stats-rank-sub {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}

.stats-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.stats-kpi {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 10px 6px;
  text-align: center;
}

.stats-kv {
  font-size: 16px;
  font-weight: 800;
  color: var(--accent-cyan);
}

.stats-kl {
  font-size: 9px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.stats-badge-up,
.stats-badge-dn {
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.stats-badge-up {
  color: var(--accent-primary);
  background: rgba(16, 185, 129, 0.15);
}

.stats-badge-dn {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.12);
}

.stats-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: rgba(139, 92, 246, 0.18);
  color: var(--accent-purple);
  white-space: nowrap;
}

.stats-pill.gold {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-gold);
}

.stats-pill.cyan {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
}

.stats-consbar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.stats-consbar .lbl {
  width: 14px;
  font-weight: 800;
  color: var(--text-primary);
}

.stats-consbar .track {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.stats-consbar .fill {
  height: 100%;
  border-radius: var(--radius-full);
}

.stats-cons-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}

.stats-cons-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.stats-cons-extra {
  display: none;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
}

.stats-cons-card.open .stats-cons-extra {
  display: flex;
}

.stats-scoregrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.stats-scorecell {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 7px 4px;
  text-align: center;
}

.stats-scorecell.mine {
  box-shadow: inset 0 0 0 1.5px var(--accent-cyan);
}

.stats-sv {
  font-size: 13px;
  font-weight: 800;
}

.stats-sp {
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 1px;
}

.stats-squad-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  min-height: 44px;
}

.stats-sq-img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  object-fit: cover;
  background: var(--ucl-surface);
  flex-shrink: 0;
}

.stats-sq-info {
  flex: 1;
  min-width: 0;
}

.stats-sq-name {
  font-size: var(--font-size-xs);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-sq-pos {
  font-size: 10px;
  color: var(--text-muted);
}

.stats-sq-pts {
  font-weight: 800;
  font-size: var(--font-size-xs);
  color: var(--accent-primary);
  white-space: nowrap;
}
```

- [ ] **Step 2: Verificación sintáctica y manual rápida**

Run: `npx css-validator css/styles.css 2>/dev/null || true` — si no hay herramienta instalada, verificación manual:
Abrir cualquier página que cargue styles.css y comprobar en DevTools que `.stats-subtab.active` aplica `background: #10B981` (la clase aún no se usa; basta inspeccionar la regla en Styles panel).

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat(stats): estilos para sub-tabs y vistas agregadas"
```

---

### Task 6: Sub-tabs + dispatcher + aggregates + caché de datos de usuario

**Files:**
- Modify: `js/main.js:55` (declaración AppState: añadir 2 campos junto a los otros `estadisticas*`/estado de tabs)
- Modify: `js/stats.js` (SUBTABS, dispatcher, extracción de `renderEvolucionBody`, caché `_userDataCache`, `buildStatsAggregates`, eventos)

**Interfaces:**
- Consumes: funciones puras de Tasks 1–4; `buildUserData`, `computeReachedPhases`, `buildMatchesById` existentes.
- Produces (lo usan Tasks 7–10):
  - `AppState.estadisticasSubTab` (string, default `'evolucion'`) y `AppState.estadisticasConsensoRonda` (number|null) declarados en main.js.
  - `getCachedUserData(username)` → mismo objeto que `buildUserData`, memoizado por render.
  - `buildStatsAggregates()` → `{ playedMatches, reliabilityRows, streaks, bestJornadas, completedRondas, championsTally, quadro, squadOwnership }`.
  - `renderStatsContent()` devuelve barra sub-tabs + cuerpo según `AppState.estadisticasSubTab`; ramas `fiabilidad|rachas|consenso|plantillas` muestran `.stats-empty` hasta sus tareas.
  - `bindStatsEvents()` gestiona clicks de `.stats-subtab`.

- [ ] **Step 1: Declarar estado en main.js**

En `js/main.js`, dentro del objeto `AppState` (junto a `resultadosTab: 'jornadas',`, línea ~48) añadir:

```js
  estadisticasSubTab: 'evolucion', // Sub-tab activa en estadísticas
  estadisticasConsensoRonda: null, // Ronda seleccionada en sub-tab Consenso (1-8)
```

- [ ] **Step 2: Extraer Evolución y crear dispatcher en stats.js**

En `js/stats.js`:

a) Añadir constante tras `SOURCES`:

```js
  const SUBTABS = [
    { key: 'evolucion', label: 'Evolución' },
    { key: 'fiabilidad', label: 'Fiabilid.' },
    { key: 'rachas', label: 'Rachas' },
    { key: 'consenso', label: 'Consenso' },
    { key: 'plantillas', label: 'Plantillas' },
  ];
```

b) Caché de datos de usuario (evita recalcular `calculateSquadPoints` dos veces por render):

```js
  let _userDataCache = null;

  function getCachedUserData(username) {
    if (!_userDataCache) _userDataCache = new Map();
    if (!_userDataCache.has(username)) {
      _userDataCache.set(username, buildUserData(
        username,
        computeReachedPhases(AppState.matches, AppState.matchStats),
        buildMatchesById()
      ));
    }
    return _userDataCache.get(username);
  }
```

Cambiar `buildSeriesMap` para usar `getCachedUserData(p.name)` en lugar de `buildUserData(...)`.

c) Sustituir `renderStatsContent()` actual por:

```js
  function renderStatsContent() {
    _userDataCache = null;
    const sub = AppState.estadisticasSubTab || 'evolucion';
    const aggregates = buildStatsAggregates();

    const subBar = SUBTABS.map(s =>
      `<button class="stats-subtab ${s.key === sub ? 'active' : ''}" data-subtab="${s.key}">${s.label}</button>`
    ).join('');

    let body = '';
    if (sub === 'evolucion') body = renderEvolucionBody(aggregates);
    else if (sub === 'fiabilidad') body = statsEmpty('Fiabilidad disponible en breve');
    else if (sub === 'rachas') body = statsEmpty('Rachas disponibles en breve');
    else if (sub === 'consenso') body = statsEmpty('Consenso disponible en breve');
    else body = statsEmpty('Plantillas disponibles en breve');

    return `
      <div class="stats-card">
        <div class="stats-subtabs">${subBar}</div>
      </div>
      ${body}`;
  }

  function renderEvolucionBody(aggregates) {
    const source = AppState.estadisticasPointType || 'total';
    const seriesMap = buildSeriesMap(source, aggregates.reachedPhases, aggregates.matchesById);
    currentSeriesMap = seriesMap;
    initStatsState(seriesMap);
    const visibleSet = AppState.estadisticasVisibleUsers;
    const players = orderPlayers(seriesMap);

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
        ${buildLineChart(players, visibleSet, seriesMap)}
        ${buildLegend(players, visibleSet, seriesMap)}
      </div>`;
  }
```

d) `buildStatsAggregates()`:

```js
  function buildStatsAggregates() {
    const matchesById = buildMatchesById();
    const matchStatsById = {};
    for (const ms of AppState.matchStats || []) matchStatsById[ms.eventId] = ms;
    const playedMatches = extractPlayedMatches(AppState.matches, matchStatsById);
    const detailsByUser = {};
    for (const p of AppState.players || []) {
      detailsByUser[p.name] = AppState.userPoints[p.name]?.matchDetails || [];
    }
    const league = buildCompletedLeagueData(AppState.leagueMatches, matchStatsById, detailsByUser);
    const squadPointsByUser = {};
    for (const p of AppState.players || []) {
      const ud = getCachedUserData(p.name);
      squadPointsByUser[p.name] = ud.squadPoints?.playerDetails?.length ? ud.squadPoints : null;
    }
    return {
      reachedPhases: computeReachedPhases(AppState.matches, AppState.matchStats),
      matchesById,
      matchStatsById,
      playedMatches,
      reliabilityRows: calcReliabilityRows(AppState.players, playedMatches, AppState.allPredictions, AppState.userPoints),
      completedRondas: league.completedRondas,
      streaks: calcStreaks(league.pointsByUserByJornada),
      bestJornadas: calcBestJornadas(league.pointsByUserByJornada, 5),
      championsTally: tallyChampions(AppState.finalPredictionsCache),
      quadro: compareQuadroWithCommunity(AppState.currentUser?.name, AppState.finalPredictionsCache),
      squadOwnership: aggregateSquads(squadPointsByUser, AppState.squadsCache),
    };
  }
```

e) En `bindStatsEvents()` añadir:

```js
    container.querySelectorAll('.stats-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasSubTab = btn.dataset.subtab;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });
```

f) `initStatsState()` ya inicializa `estadisticasPointType`; añadir primera línea `if (!AppState.estadisticasSubTab) AppState.estadisticasSubTab = 'evolucion';`.

- [ ] **Step 3: Verificar**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js`
Expected: PASS (sin cambios funcionales en tests).

Manual: servir con `python3 -m http.server 8000`, login, ir a Estadísticas:
- Barra con 5 sub-tabs visible; «Evolución» activa en verde.
- El gráfico/chips/fuente funcionan igual que antes.
- Cambiar a «Rachas» muestra mensaje provisional; volver a «Evolución» mantiene fuente y chips seleccionados.
- Sin errores en consola.

- [ ] **Step 4: Commit**

```bash
git add js/main.js js/stats.js
git commit -m "feat(stats): sub-tabs internos y agregados compartidos"
```

---

### Task 7: Vista Fiabilidad

**Files:**
- Modify: `js/stats.js` (`renderFiabilidadBody` + rama del dispatcher + helper `getPlayerMeta`)

**Interfaces:**
- Consumes: `aggregates.reliabilityRows` (Task 1 vía Task 6), clases CSS Task 5, pills `.rank-1|.rank-2|.rank-3|.rank-n` globales.
- Produces: rama `sub === 'fiabilidad'` del dispatcher llama a `renderFiabilidadBody(aggregates)`.

- [ ] **Step 1: Implementar**

Helper (cerca de `esc`):

```js
  function getPlayerMeta(name) {
    return (AppState.players || []).find(p => p.name === name) || {};
  }
```

Renderer:

```js
  function renderFiabilidadBody(aggregates) {
    const me = AppState.currentUser?.name;
    const rows = aggregates.reliabilityRows || [];
    if (!rows.length || !rows.some(r => r.played > 0)) {
      return statsEmpty('Sin partidos con resultado suficientes');
    }
    const rankHtml = rows.map((r, i) => `
      <div class="stats-rank-row ${r.username === me ? 'me' : ''}">
        <span class="stats-rank-pos ${i < 3 ? `rank-${i + 1}` : 'rank-n'}">${i + 1}</span>
        <span class="stats-rank-name">${esc(getPlayerMeta(r.username).avatar || '⚽')} ${esc(r.username)}</span>
        <span class="stats-rank-main">${r.played ? `${r.pctResult}%` : '—'}</span>
        <span class="stats-rank-sub">${r.ptsPerMatch} pts/part</span>
      </div>`).join('');
    const my = rows.find(r => r.username === me);
    const kpis = my ? `
      <div class="stats-kpi-grid">
        <div class="stats-kpi"><div class="stats-kv">${my.ptsPerMatch}</div><div class="stats-kl">pts medios/partido</div></div>
        <div class="stats-kpi"><div class="stats-kv">${my.exactScores}</div><div class="stats-kl">marcadores exactos</div></div>
        <div class="stats-kpi"><div class="stats-kv">${my.perfect15}</div><div class="stats-kl">partidos de 15</div></div>
      </div>` : '';
    return `
      <div class="stats-card">
        <div class="stats-card-title">🎯 Ranking de fiabilidad (% resultado · pts/partido)</div>
        ${rankHtml}
      </div>
      <div class="stats-card">
        <div class="stats-card-title">Tu detalle</div>
        ${kpis || statsEmpty('Sin pronósticos tuyos con resultado')}
      </div>`;
  }
```

Dispatcher: sustituir la rama provisional por `else if (sub === 'fiabilidad') body = renderFiabilidadBody(aggregates);`

- [ ] **Step 2: Verificar**

Run: `node tests/estadisticas-subtabs.test.js && node tests/estadisticas.test.js` → PASS.

Manual (http.server): Estadísticas → Fiabilidad:
- Ranking completo con todos los usuarios (scroll), tu fila resaltada, medallas top-3 doradas.
- Con pocos matchstats los usuarios sin pronóstico aparecen con «—» al final.
- Tu detalle muestra 3 KPIs coherentes con tus puntos reales.

- [ ] **Step 3: Commit**

```bash
git add js/stats.js
git commit -m "feat(stats): vista de fiabilidad de pronostico"
```

---

### Task 8: Vista Rachas

**Files:**
- Modify: `js/stats.js` (`renderRachasBody` + rama dispatcher)

**Interfaces:**
- Consumes: `aggregates.streaks`, `aggregates.bestJornadas`, `aggregates.completedRondas` (Tasks 2 y 6); badges Task 5.
- Produces: rama `sub === 'rachas'`.

- [ ] **Step 1: Implementar**

```js
  function renderRachasBody(aggregates) {
    const streakEntries = Object.entries(aggregates.streaks || {})
      .filter(([, s]) => s)
      .sort((a, b) => b[1].len - a[1].len || b[1].lastPts - a[1].lastPts);
    const me = AppState.currentUser?.name;
    const streakHtml = streakEntries.length ? streakEntries.map(([u, s]) => `
      <div class="stats-rank-row ${u === me ? 'me' : ''}">
        <span class="stats-rank-pos rank-n">${getPlayerMeta(u).avatar || '⚽'}</span>
        <span class="stats-rank-name">${esc(u)}</span>
        ${s.dir === 'up'
          ? `<span class="stats-badge-up">▲ ${s.len} mejorando</span>`
          : `<span class="stats-badge-dn">▼ ${s.len} empeorando</span>`}
      </div>`).join('') : '';

    const medals = ['🥇', '🥈', '🥉'];
    const bestHtml = (aggregates.bestJornadas || []).length ? aggregates.bestJornadas.map((b, i) => {
      const ronda = aggregates.completedRondas?.[b.jornadaIdx];
      const pos = i < 3 ? medals[i] : `<span class="stats-rank-pos rank-n">${i + 1}</span>`;
      return `
      <div class="stats-rank-row ${b.username === me ? 'me' : ''}">
        ${pos}
        <span class="stats-rank-name">${esc(getPlayerMeta(b.username).avatar || '⚽')} ${esc(b.username)} · J${ronda ?? b.jornadaIdx + 1}</span>
        <span class="stats-rank-main">+${b.pts} pts</span>
      </div>`;
    }).join('') : '';

    return `
      <div class="stats-card">
        <div class="stats-card-title">🔥 Rachas de jornada</div>
        ${streakHtml || statsEmpty('Aún no hay jornadas completadas')}
      </div>
      <div class="stats-card">
        <div class="stats-card-title">📈 Mejores jornadas históricas</div>
        ${bestHtml || statsEmpty('Aún no hay jornadas completadas')}
      </div>`;
  }
```

Dispatcher: `else if (sub === 'rachas') body = renderRachasBody(aggregates);`

- [ ] **Step 2: Verificar**

Run tests → PASS.

Manual: Estadísticas → Rachas:
- Usuarios ordenados por racha más larga; badges verde ▲ / rojo ▼ correctos comparando jornadas consecutivas reales.
- Top 5 de mejores jornadas con medallas y etiqueta de jornada correcta (usa `completedRondas`, no el índice).

- [ ] **Step 3: Commit**

```bash
git add js/stats.js
git commit -m "feat(stats): vista de rachas y mejores jornadas"
```

---

### Task 9: Vista Consenso (rondas ◀▶, partido colapsable, campeón, cuadro)

**Files:**
- Modify: `js/stats.js` (`renderConsensoBody`, helpers `getDefaultConsensoRonda`/`normalizeConsensoRonda`, bindings)

**Interfaces:**
- Consumes: `computeMatchConsensus`, `tallyChampions`, `compareQuadroWithCommunity`, `finalPredictionTeamIds` (Task 3); `aggregates.matchStatsById` (Task 6); navegación visual reutiliza clases `.resultados-round-nav`, `.resultados-round-btn`, `.resultados-round-label` existentes.
- Produces: rama `sub === 'consenso'`; mutación de `AppState.estadisticasConsensoRonda`; tarjetas `.stats-cons-card` con toggle `.open` gestionado en `bindStatsEvents`.

- [ ] **Step 1: Implementar helpers de ronda**

```js
  function getDefaultConsensoRonda() {
    const matchStatsById = aggregatesCurrent?.matchStatsById || {};
    let best = 0;
    for (const m of AppState.leagueMatches || []) {
      const home = matchStatsById[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away) && Number(m.ronda) > best) {
        best = Number(m.ronda);
      }
    }
    return best || 1;
  }

  function normalizeConsensoRonda(aggregates) {
    let r = Number(AppState.estadisticasConsensoRonda);
    if (!(r >= 1 && r <= 8)) r = getDefaultConsensoRonda();
    AppState.estadisticasConsensoRonda = r;
    return r;
  }
```

`getDefaultConsensoRonda` necesita los matchStatsById; para evitar acoplamiento global, cambiar firma a `getDefaultConsensoRonda(matchStatsById)` y pasar `aggregates.matchStatsById` desde `normalizeConsensoRonda(aggregates)`:

```js
  function getDefaultConsensoRonda(matchStatsById) {
    let best = 0;
    for (const m of AppState.leagueMatches || []) {
      const home = matchStatsById?.[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById?.[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away) && Number(m.ronda) > best) {
        best = Number(m.ronda);
      }
    }
    return best || 1;
  }

  function normalizeConsensoRonda(aggregates) {
    let r = Number(AppState.estadisticasConsensoRonda);
    if (!(r >= 1 && r <= 8)) r = getDefaultConsensoRonda(aggregates.matchStatsById);
    AppState.estadisticasConsensoRonda = r;
    return r;
  }
```

- [ ] **Step 2: Implementar renderConsensoBody**

```js
  function consensoBars(cons) {
    const defs = [['1', 'H', 'var(--accent-primary)'], ['X', 'D', 'var(--accent-gold)'], ['2', 'A', 'var(--accent-purple)']];
    return defs.map(([lbl, k, color]) => `
      <div class="stats-consbar">
        <span class="lbl">${lbl}</span>
        <div class="track"><div class="fill" style="width:${cons.pct[k]}%;background:${color}"></div></div>
        <b style="color:var(--text-primary)">${cons.pct[k]}%</b>
      </div>`).join('');
  }

  function consensoScoreGrid(cons, myPr) {
    const cells = cons.topScores.map(t => ({
      score: t.score, label: `${t.votes} voto${t.votes === 1 ? '' : 's'} · ${t.pct}%`,
      mine: !!myPr && t.score === `${myPr.home}-${myPr.away}`,
    }));
    if (myPr && Number.isFinite(myPr.home) && Number.isFinite(myPr.away)) {
      const myKey = `${myPr.home}-${myPr.away}`;
      if (!cells.some(c => c.mine)) cells.push({ score: myKey, label: 'tu marcador', mine: true });
    }
    if (!cells.length) return statsEmpty('Aún no hay pronósticos en este partido');
    return `<div class="stats-scoregrid">${cells.map(c => `
      <div class="stats-scorecell ${c.mine ? 'mine' : ''}">
        <div class="stats-sv">${esc(c.score)}</div>
        <div class="stats-sp">${esc(c.label)}</div>
      </div>`).join('')}</div>`;
  }

  function renderConsensoBody(aggregates) {
    const ronda = normalizeConsensoRonda(aggregates);
    const me = AppState.currentUser?.name;
    const matches = (AppState.leagueMatches || [])
      .filter(m => Number(m.ronda) === ronda)
      .sort((a, b) => (a.fechaTs || 0) - (b.fechaTs || 0));

    const cardsHtml = matches.map(m => {
      const cons = computeMatchConsensus(m.id, AppState.allPredictions);
      const myPr = AppState.allPredictions?.[me]?.[m.id];
      let pill = '';
      if (cons.majorityResult && myPr && Number.isFinite(myPr.home) && Number.isFinite(myPr.away)) {
        pill = matchResultOf(myPr.home, myPr.away) === cons.majorityResult
          ? '<span class="stats-pill cyan">con la mayoría</span>'
          : '<span class="stats-pill">⚖️ contra corriente</span>';
      }
      const ms = aggregates.matchStatsById?.[m.id];
      const rh = ms?.stats?.[m.homeTeamId]?.goles;
      const ra = ms?.stats?.[m.awayTeamId]?.goles;
      let realInfo = '';
      if (Number.isFinite(rh) && Number.isFinite(ra)) {
        const acertaron = cons.counts[matchResultOf(rh, ra)];
        realInfo = `<span class="stats-rank-sub">Real ${rh}-${ra} · ${acertaron}/${cons.total} acertaron</span>`;
      }
      const homeName = AppState.teamsMap?.[m.homeTeamId]?.name || m.homeTeam || '';
      const awayName = AppState.teamsMap?.[m.awayTeamId]?.name || m.awayTeam || '';
      return `
      <div class="stats-cons-card" data-match="${m.id}">
        <div class="stats-cons-head">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(homeName)} – ${esc(awayName)}</span>
          ${pill}${realInfo}
        </div>
        ${consensoBars(cons)}
        <div class="stats-cons-extra">
          <div class="stats-card-title">Marcadores más votados</div>
          ${consensoScoreGrid(cons, myPr)}
        </div>
      </div>`;
    }).join('');

    const champ = aggregates.championsTally || { total: 0, teams: [] };
    const champHtml = champ.teams.length ? `
      <div class="stats-card">
        <div class="stats-card-title">👑 Campeón más votado (${champ.total} votos)</div>
        ${champ.teams.map(t => `
          <div class="stats-rank-row">
            <img class="stats-sq-img" src="data/imgEquipos/${t.teamId}.${AppState.teamsMap?.[t.teamId]?.ext || 'webp'}" alt="" onerror="this.style.visibility='hidden'">
            <span class="stats-rank-name">${esc(AppState.teamsMap?.[t.teamId]?.name || t.teamId)}</span>
            <span class="stats-rank-main">${t.votes}/${champ.total}</span>
          </div>`).join('')}
      </div>` : '';

    const q = aggregates.quadro || {};
    const quadroHtml = q.users ? `
      <div class="stats-card">
        <div class="stats-card-title">🧩 Tu cuadro vs la porra</div>
        <div class="stats-kpi-grid">
          <div class="stats-kpi"><div class="stats-kv">${q.avgPct}%</div><div class="stats-kl">coincidencia media</div></div>
          <div class="stats-kpi"><div class="stats-kv">${q.avgCommon}/24</div><div class="stats-kl">equipos en común</div></div>
          <div class="stats-kpi"><div class="stats-kv">${q.veryDiffCount}</div><div class="stats-kl">cuadros muy distintos (&ge;12)</div></div>
        </div>
      </div>` : '';

    return `
      <div class="stats-card">
        <div class="resultados-round-nav">
          <button class="resultados-round-btn" id="btn-stats-cons-prev" ${ronda <= 1 ? 'disabled' : ''}>◀</button>
          <span class="resultados-round-label">Jornada ${ronda}</span>
          <button class="resultados-round-btn" id="btn-stats-cons-next" ${ronda >= 8 ? 'disabled' : ''}>▶</button>
        </div>
        ${cardsHtml || statsEmpty('No hay partidos en esta jornada')}
      </div>
      ${champHtml}
      ${quadroHtml}`;
  }
```

Dispatcher: rama consenso → `renderConsensoBody(aggregates)`.

- [ ] **Step 3: Bindings**

En `bindStatsEvents()` añadir:

```js
    container.querySelectorAll('.stats-cons-card').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('open'));
    });

    const prevBtn = container.querySelector('#btn-stats-cons-prev');
    const nextBtn = container.querySelector('#btn-stats-cons-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      AppState.estadisticasConsensoRonda = Math.max(1, (AppState.estadisticasConsensoRonda || 1) - 1);
      container.innerHTML = renderStatsContent();
      bindStatsEvents();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      AppState.estadisticasConsensoRonda = Math.min(8, (AppState.estadisticasConsensoRonda || 1) + 1);
      container.innerHTML = renderStatsContent();
      bindStatsEvents();
    });
```

- [ ] **Step 4: Verificar**

Run tests → PASS.

Manual:
- ◀▶ navegan jornadas 1–8 con límites deshabilitados; al reentrar recuerda la ronda.
- Tarjeta colapsada: barras 1/X/2 visibles; tap expande marcadores; mi marcador con borde cyan (añadido al final si no está en top 6).
- Pill «con la mayoría»/«⚖️ contra corriente» correcta frente a las barras.
- Partido con resultado: «Real X-Y · N/M acertaron».
- Campeón: escudos cargan (fallback oculto si falta imagen); sin finalPredictions la sección no aparece.
- Cuadro: KPIs coherentes con mis eliminatorias guardadas.

- [ ] **Step 5: Commit**

```bash
git add js/stats.js
git commit -m "feat(stats): vista de consenso con rondas, marcadores votados, campeon y cuadro"
```

---

### Task 10: Vista Plantillas

**Files:**
- Modify: `js/stats.js` (`renderPlantillasBody` + rama dispatcher)

**Interfaces:**
- Consumes: `aggregates.squadOwnership` `{ usersWithSquad, uniquePlayers, rows }` (Tasks 4 y 6).
- Produces: rama `sub === 'plantillas'`.

- [ ] **Step 1: Implementar**

```js
  function squadPosLabel(pos) {
    return { G: 'Portero', D: 'Defensa', M: 'Centrocampista', F: 'Delantero' }[pos] || pos || '';
  }

  function squadPosEmoji(pos) {
    return { G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[pos] || '⚽';
  }

  function renderPlantillasBody(aggregates) {
    const agg = aggregates.squadOwnership || { rows: [] };
    if (!agg.rows.length) return statsEmpty('Aún no hay plantillas guardadas');
    const top = agg.rows.slice(0, 25);
    const rowsHtml = top.map(r => {
      const badge = r.possessionPct >= 70
        ? '<span class="stats-pill gold">⭐ 70%+</span>'
        : r.possessionPct <= 30
          ? '<span class="stats-pill cyan">🎯 dif.</span>'
          : '';
      const ext = r.player.extension || 'webp';
      const img = `<img class="stats-sq-img" src="data/imgJugadores/${r.player.id}.${ext}" alt="" loading="lazy"
        onerror="this.outerHTML='<span class=&quot;stats-sq-img&quot; style=&quot;display:flex;align-items:center;justify-content:center&quot;>${squadPosEmoji(r.player.posicion)}</span>'">`;
      return `
      <div class="stats-squad-row">
        ${img}
        <div class="stats-sq-info">
          <div class="stats-sq-name">${esc(r.player.nombre || '')}</div>
          <div class="stats-sq-pos">${esc(squadPosLabel(r.player.posicion))} · ${r.ownerCount}/${agg.usersWithSquad} lo tienen</div>
        </div>
        ${badge}
        <span class="stats-sq-pts">${r.pts} pts</span>
      </div>`;
    }).join('');
    return `
      <div class="stats-card">
        <div class="stats-card-title">⭐ Jugadores estrella de las plantillas</div>
        ${rowsHtml}
        <div class="stats-rank-sub">Top 25 de ${agg.uniquePlayers} jugadores únicos · posesión sobre ${agg.usersWithSquad} usuarios con plantilla</div>
      </div>`;
  }
```

Dispatcher: rama final `else body = renderPlantillasBody(aggregates);` (ya no queda rama provisional).

- [ ] **Step 2: Verificar**

Run tests → PASS.

Manual:
- Lista top 25 ordenada por pts generados; foto carga o cae a emoji por posición.
- Badges: ⭐ si ≥70% de usuarios lo tienen, 🎯 si ≤30%, sin badge en medio.
- Nota inferior con conteo de jugadores únicos y usuarios con plantilla.

- [ ] **Step 3: Commit**

```bash
git add js/stats.js
git commit -m "feat(stats): vista de plantillas agregadas de la comunidad"
```

---

### Task 11: Cache-busting, documentación y validación final

**Files:**
- Modify: `index.html` (líneas ~19 y ~322: bump de `styles.css?v=77→78`, `stats.js?v=1→2`; buscar `main.js?v=` y bump +1 porque cambió en Task 6)
- Modify: `AGENTS.md` (sección Navegación de la Aplicación, bullet de `tab-estadisticas`)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: entrega final verificada.

- [ ] **Step 1: Bump de versiones en index.html**

```html
<link rel="stylesheet" href="css/styles.css?v=78">
<script src="js/main.js?v=<actual+1>"></script>
<script src="js/stats.js?v=2"></script>
```

(Leer el valor actual de `main.js?v=` en index.html y sumarle 1.)

- [ ] **Step 2: Actualizar AGENTS.md**

En el bullet de `tab-estadisticas` (sección «Navegación de la Aplicación») ampliar descripción:

```markdown
- **tab-estadisticas**: Sub-tabs internas: **Evolución** (gráfico acumulado por jornada, selector de fuente Total/Pronóst./Plantilla/Clasif./Eliminat., chips de jugadores), **Fiabilidad** (ranking % resultado 1X2 y pts/partido + KPIs propios), **Rachas** (rachas ↑↓ entre jornadas completas de liga y top 5 mejores jornadas históricas), **Consenso** (% 1X2 y marcadores más votados por partido con navegación ◀▶ de jornadas, campeón más votado y rareza de tu cuadro de eliminatorias), **Plantillas** (jugadores reales más rentables entre todas las plantillas, con % posesión e insignias imprescindible/diferencial). Implementado en `js/stats.js` (funciones puras exportadas + render). Guard de fase simple: solo `FASE_PRETEMPORADA` oculta la sección. Estado: `AppState.estadisticasSubTab`, `AppState.estadisticasConsensoRonda`.
```

- [ ] **Step 3: Suite completa**

Run: `for f in tests/*.test.js; do echo "== $f"; node "$f" || exit 1; done`
Expected: todas las suites PASS.

- [ ] **Step 4: Validación manual integral**

Servir (`python3 -m http.server 8000`) y recargar con cache vaciado (hard reload):

1. Estadísticas abre en Evolución; alternar las 5 sub-tabs y volver: fuente y chips persisten.
2. Con 15–30 usuarios registrados: Fiabilidad y Rachas listan a todos sin lag ni scroll interno.
3. Consenso: navegar jornadas, expandir partidos, verificar pill propia y marcador propio resaltado; campeón y cuadro coherentes con tus eliminatorias.
4. Plantillas: top 25 con fotos/badges correctos.
5. Pretemporada (`faseJuego=FASE_PRETEMPORADA`): mensaje «Disponible al inicio de la competición» en toda la pestaña.
6. Consola sin errores; scroll vertical fluido; sin overflow horizontal.

- [ ] **Step 5: Commit final**

```bash
git add index.html AGENTS.md
git commit -m "chore: bump cache-busting y documenta sub-tabs de estadisticas"
```

---

## Self-review realizado

- Cobertura del spec: sub-tabs (T6), fiabilidad (T1+T7), rachas/récords (T2+T8), consenso partídos+campeón+cuadro (T3+T9), plantillas (T4+T10), escalado 15–30 (filas repetibles, cap 25 plantillas, agregación única por render con caché `_userDataCache`), estados vacíos (en cada renderer), cache-busting y AGENTS.md (T11).
- Sin placeholders: todos los pasos contienen código final.
- Tipos coherentes: nombres de campos de aggregates usados en T7–T10 coinciden con los producidos en T6; firmas de funciones puras coinciden entre tests (T1–T4) e implementación.
