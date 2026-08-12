# Tab Eliminatorias en modal de perfil + puntos en el ranking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un tab "Eliminatorias" al modal de perfil (Clasificación) que muestra las predicciones de fase final del usuario con los puntos obtenidos, y sumar esos puntos al total real de cada usuario en la clasificación general.

**Architecture:** Funciones puras nuevas (`computeReachedPhases`, `calculateEliminatoriasPoints`) en `js/eliminatorias.js` exportadas y unit-testeadas. En `js/main.js` se añade el tab al modal de perfil (patrón de `renderSquadTab`/`renderClassificationTab`) y se integra el nuevo componente de puntos en `renderClasificacionTab`. Estilos reutilizando `.drop-zone`/`.drop-slot` existentes.

**Tech Stack:** JavaScript vanilla (ES6+), HTML5, CSS3, tests con Node `assert` (mismo patrón que `tests/eliminatorias.test.js`).

## Global Constraints

- NO usar frameworks JS/CSS externos.
- Reutilizar variables CSS de `:root` (p.ej. `--accent-primary`, `--text-muted`).
- Cuando se toquen `css/styles.css` o `js/main.js`, incrementar cache-busting en `index.html`:
  - CSS: `css/styles.css?v=46`
  - JS: `js/main.js?v=61`
  - `js/eliminatorias.js` no tiene cache-busting en `index.html` (cargado por main), no tocar.
- Funciones puras nuevas deben exportarse en el bloque final de `js/eliminatorias.js` (IIFE + `module.exports`).
- Runner de tests: `node tests/<archivo>.test.js` (salida `N passing, M failing`).

---

### Task 1: Funciones puras de puntos de eliminatorias en `js/eliminatorias.js`

**Files:**
- Modify: `js/eliminatorias.js` (añadir 2 funciones + exportarlas)
- Test: `tests/eliminatorias.test.js` (añadir imports y tests)

**Interfaces:**
- Consumes: `groupTies`, `resolveTie` ya existentes en `js/eliminatorias.js`.
- Produces:
  - `computeReachedPhases(matches, matchStats)` → `{ teamId: rango }` (0-6)
  - `calculateEliminatoriasPoints(finalPredictions, reachedPhases)` → `{ totalPoints, teamDetails }`
  - `teamDetails[i]` = `{ teamId, predictedRank, reachedRank, points }`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `tests/eliminatorias.test.js` (antes del runner) las funciones de test y registrarlas en el array `tests`. Actualizar el import de línea 2:

```js
const { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints } = require('../js/eliminatorias.js');
```

Tests nuevos:

```js
// ---- Tests de computeReachedPhases ----
function test_reachedPhases_eliminados_y_vivos() {
  const matches = [
    partido(1, '16', 100, 200), partido(2, '16', 200, 100),
    partido(3, '16', 300, 400), partido(4, '16', 400, 300),
    partido(5, '8', 100, 500), partido(6, '8', 500, 100),
    partido(7, '8', 600, 700), partido(8, '8', 700, 600),
    partido(9, '4', 100, 600), partido(10, '4', 600, 100),
    partido(11, 'semis', 100, 800), partido(12, 'semis', 800, 100),
    partido(13, 'final', 100, 900),
  ];
  const matchStats = [
    // 16avos: eliminan 200 y 400 (100 y 300 avanzan → octavos)
    ms(1, { 100: 2, 200: 0 }), ms(2, { 200: 1, 100: 2 }),
    ms(3, { 300: 2, 400: 1 }), ms(4, { 400: 0, 300: 1 }),
    // 8avos: eliminan 500 y 700 (100 y 600 avanzan → cuartos)
    ms(5, { 100: 1, 500: 1 }), ms(6, { 500: 1, 100: 2 }),
    ms(7, { 600: 2, 700: 1 }), ms(8, { 700: 1, 600: 2 }),
    // Cuartos: elimina 600 (100 avanza → semis)
    ms(9, { 100: 2, 600: 1 }), ms(10, { 600: 1, 100: 1 }),
    // Semis: elimina 800 (100 avanza → final)
    ms(11, { 100: 2, 800: 1 }), ms(12, { 800: 1, 100: 1 }),
    // Final: 100 gana → campeón
    ms(13, { 100: 2, 900: 1 }),
  ];
  const r = computeReachedPhases(matches, matchStats);
  assert.strictEqual(r[100], 6);   // campeón
  assert.strictEqual(r[900], 5);   // subcampeón
  assert.strictEqual(r[800], 4);   // eliminado en semis
  assert.strictEqual(r[600], 3);   // eliminado en cuartos
  assert.strictEqual(r[500], 2);   // eliminado en octavos
  assert.strictEqual(r[700], 2);   // eliminado en octavos
  assert.strictEqual(r[200], 1);   // eliminado en dieciseisavos
  assert.strictEqual(r[400], 1);   // eliminado en dieciseisavos
  assert.strictEqual(r[300], 2);   // avanzó de 16avos y su cruce de octavos no tiene matchStats → provisional octavos
}

function test_reachedPhases_sin_resultados_rango_0() {
  const matches = [partido(1, '16', 100, 200), partido(2, '16', 200, 100)];
  const r = computeReachedPhases(matches, []);
  assert.strictEqual(r[100], 1);   // vive en dieciseisavos (provisional fase mínima)
  assert.strictEqual(r[200], 1);
  assert.strictEqual(r[999], undefined); // equipo ajeno no aparece
}

function test_reachedPhases_final_pendiente_ambos_5() {
  const matches = [partido(1, 'final', 100, 200)];
  const r = computeReachedPhases(matches, []); // sin resultado
  assert.strictEqual(r[100], 5);
  assert.strictEqual(r[200], 5);
}

// ---- Tests de calculateEliminatoriasPoints ----
function test_points_acierto_exacto_por_ronda() {
  const reachedPhases = {
    1: 6, 2: 5, 3: 4, 4: 4, 5: 3, 6: 3, 7: 3, 8: 3,
    9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2,
    17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1
  };
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4], quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24]
  };
  const { totalPoints } = calculateEliminatoriasPoints(fp, reachedPhases);
  assert.strictEqual(totalPoints, 575); // máximo
}

function test_points_regla_del_minimo() {
  const reachedPhases = { 1: 6, 2: 1, 3: 4 };
  // 1: pronosticado octavos (2), alcanza campeón (6) → min(2,6)=2 → 15
  // 2: pronosticado semis (4), alcanza play-off (1) → min(4,1)=1 → 10
  // 3: pronosticado cuartos (3), alcanza semis (4) → min(3,4)=3 → 25
  const fp = {
    champion: null, runnerUp: null,
    semiFinalists: [2], quarterFinalists: [3], roundOf16: [1], roundOf32: []
  };
  const { totalPoints, teamDetails } = calculateEliminatoriasPoints(fp, reachedPhases);
  assert.strictEqual(totalPoints, 50);
  const t1 = teamDetails.find(t => t.teamId === 1);
  assert.deepStrictEqual({ predictedRank: t1.predictedRank, reachedRank: t1.reachedRank, points: t1.points }, { predictedRank: 2, reachedRank: 6, points: 15 });
  const t2 = teamDetails.find(t => t.teamId === 2);
  assert.deepStrictEqual({ predictedRank: t2.predictedRank, reachedRank: t2.reachedRank, points: t2.points }, { predictedRank: 4, reachedRank: 1, points: 10 });
  const t3 = teamDetails.find(t => t.teamId === 3);
  assert.deepStrictEqual({ predictedRank: t3.predictedRank, reachedRank: t3.reachedRank, points: t3.points }, { predictedRank: 3, reachedRank: 4, points: 25 });
}

function test_points_sin_prediccion_y_sin_datos() {
  assert.deepStrictEqual(calculateEliminatoriasPoints(null, {}), { totalPoints: 0, teamDetails: [] });
  const fp = { champion: 1, runnerUp: 2, semiFinalists: [3], quarterFinalists: [], roundOf16: [], roundOf32: [] };
  const { totalPoints, teamDetails } = calculateEliminatoriasPoints(fp, {}); // sin reachedPhases → rango 0
  assert.strictEqual(totalPoints, 0);
  assert.strictEqual(teamDetails.length, 3);
  assert.strictEqual(teamDetails.every(t => t.points === 0), true);
}
```

Registrar en el array `tests`:

```js
const tests = [
  test_groupTies_agrupa_ida_vuelta,
  test_resolveTie_agregado_decide_eliminado,
  test_resolveTie_agregado_empate_pendiente,
  test_resolveTie_sin_resultado_no_resuelto,
  test_resolveTie_cruce_con_menos_de_dos_partidos_no_resuelto,
  test_computeEliminatorias_rondas_completas_y_parciales,
  test_computeEliminatorias_final_resuelta,
  test_computeEliminatorias_final_empatada_no_resuelta,
  test_reachedPhases_eliminados_y_vivos,
  test_reachedPhases_sin_resultados_rango_0,
  test_reachedPhases_final_pendiente_ambos_5,
  test_points_acierto_exacto_por_ronda,
  test_points_regla_del_minimo,
  test_points_sin_prediccion_y_sin_datos,
];
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

Run: `node tests/eliminatorias.test.js`
Expected: FAIL con `TypeError: computeReachedPhases is not a function` (o similar) y las funciones nuevas no encontradas.

- [ ] **Step 3: Implementar las funciones en `js/eliminatorias.js`**

Añadir justo antes del bloque de export (línea ~80), después de `computeEliminatorias`:

```js
/**
 * Calcula el rango de fase final alcanzado por cada equipo del cuadro real.
 * Rangos: 0=no llega, 1=dieciseisavos, 2=octavos, 3=cuartos, 4=semis,
 * 5=final(subcampeón), 6=campeón.
 * Provisional con fase mínima: un equipo que avanza de ronda o cuyo cruce
 * está pendiente se queda en el rango de la fase en la que está.
 */
function computeReachedPhases(matches, matchStats) {
  const matchStatsById = new Map((matchStats || []).map(ms => [ms.eventId, ms]));
  const reached = {};
  const fasesDobles = ['16', '8', '4', 'semis'];
  const rankByFase = { '16': 1, '8': 2, '4': 3, 'semis': 4 };

  for (const fase of fasesDobles) {
    const ties = groupTies((matches || []).filter(m => m.fase === fase));
    for (const tie of ties) {
      const { resuelto, eliminado } = resolveTie(tie, matchStatsById);
      if (resuelto) {
        // Eliminado en esta ronda → rango definitivo de esta fase
        reached[eliminado] = rankByFase[fase];
        // El ganador avanza a la siguiente fase (rango +1) de forma provisional
        const ganador = eliminado === tie.teamA ? tie.teamB : tie.teamA;
        if (!reached[ganador] || reached[ganador] <= rankByFase[fase]) {
          reached[ganador] = rankByFase[fase] + 1;
        }
      } else {
        // Cruce pendiente: ambos siguen vivos en esta fase (fase mínima)
        if (!reached[tie.teamA]) reached[tie.teamA] = rankByFase[fase];
        if (!reached[tie.teamB]) reached[tie.teamB] = rankByFase[fase];
      }
    }
  }

  const finalMatches = (matches || []).filter(m => m.fase === 'final');
  for (const f of finalMatches) {
    const ms = matchStatsById.get(f.id);
    const gA = ms?.stats?.[f.homeTeamId]?.goles;
    const gB = ms?.stats?.[f.awayTeamId]?.goles;
    if (gA !== undefined && gB !== undefined && gA !== gB) {
      reached[gA > gB ? f.homeTeamId : f.awayTeamId] = 6;
      reached[gA > gB ? f.awayTeamId : f.homeTeamId] = 5;
    } else {
      // Final pendiente o empatada: ambos alcanzaron la final (provisional)
      reached[f.homeTeamId] = 5;
      reached[f.awayTeamId] = 5;
    }
  }

  return reached;
}

const PUNTOS_ELIMINATORIAS = [0, 10, 15, 25, 50, 75, 100]; // index = rango

/**
 * Calcula los puntos de eliminatorias de un usuario.
 * Regla: puntos = PUNTOS[min(rangoPronosticado, rangoAlcanzado)].
 * max = 100+75+2*50+4*25+8*15+8*10 = 575.
 */
function calculateEliminatoriasPoints(finalPredictions, reachedPhases) {
  if (!finalPredictions) return { totalPoints: 0, teamDetails: [] };
  const reached = reachedPhases || {};
  const teamDetails = [];
  let totalPoints = 0;

  const zones = [
    { key: 'champion', rank: 6 },
    { key: 'runnerUp', rank: 5 },
    { key: 'semiFinalists', rank: 4 },
    { key: 'quarterFinalists', rank: 3 },
    { key: 'roundOf16', rank: 2 },
    { key: 'roundOf32', rank: 1 },
  ];

  for (const zone of zones) {
    const ids = Array.isArray(finalPredictions[zone.key])
      ? finalPredictions[zone.key]
      : [finalPredictions[zone.key]];
    for (const teamId of ids) {
      if (!teamId) continue;
      const reachedRank = reached[teamId] || 0;
      const rank = Math.min(zone.rank, reachedRank);
      const points = PUNTOS_ELIMINATORIAS[rank] || 0;
      totalPoints += points;
      teamDetails.push({ teamId, predictedRank: zone.rank, reachedRank, points });
    }
  }

  return { totalPoints, teamDetails };
}
```

Actualizar el bloque de export (final del archivo):

```js
  global.groupTies = groupTies;
  global.resolveTie = resolveTie;
  global.computeEliminatorias = computeEliminatorias;
  global.computeReachedPhases = computeReachedPhases;
  global.calculateEliminatoriasPoints = calculateEliminatoriasPoints;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints };
  }
```

- [ ] **Step 4: Ejecutar tests para verificar que pasan**

Run: `node tests/eliminatorias.test.js`
Expected: todos los tests en verde (14 passing, 0 failing).

- [ ] **Step 5: Commit**

```bash
git add js/eliminatorias.js tests/eliminatorias.test.js
git commit -m "feat: computeReachedPhases y calculateEliminatoriasPoints (puntos fase final)"
```

---

### Task 2: Tab Eliminatorias en el modal de perfil

**Files:**
- Modify: `js/main.js` (AppState, `showUserProfileModal`, nueva función `renderEliminatoriasTab`)
- Modify: `index.html` (cache-busting `main.js?v=61`)

**Interfaces:**
- Consumes: `computeReachedPhases`, `calculateEliminatoriasPoints` (Task 1), `fetchWithPhase`, `AppState.teamsMap`, `teamName(teamId)`, `AppState.matchStats`, `AppState.matches`, `API_BASE`.
- Produces: `fetchFinalPredictionsForUser(username)` → `finalPredictions|null` (con caché), `renderEliminatoriasTab(container, username)`.

- [ ] **Step 1: Añadir estado para caché en AppState**

En `js/main.js`, tras la línea 46 (`selectedFinalTeam`), añadir:

```js
  finalPredictionsCache: {}, // { username: finalPredictions|null } - caché para tab Eliminatorias
```

- [ ] **Step 2: Añadir la función `fetchFinalPredictionsForUser`**

Añadir tras `fetchFinalPredictionsFromBackend()` (final del archivo):

```js
/**
 * Obtiene las finalPredictions de un usuario concreto con caché (30s).
 * Devuelve null si el usuario no tiene predicciones o hay error.
 */
async function fetchFinalPredictionsForUser(username) {
  if (AppState.finalPredictionsCache &&
      Object.prototype.hasOwnProperty.call(AppState.finalPredictionsCache, username) &&
      AppState._finalPredictionsCacheTime &&
      Date.now() - AppState._finalPredictionsCacheTime[username] < CACHE_TTL) {
    return AppState.finalPredictionsCache[username];
  }

  try {
    const res = await fetchWithPhase(`${API_BASE}/api/final-predictions?username=${encodeURIComponent(username)}`, { headers: authHeaders() });
    const data = await res.json();
    const fp = (data.ok && data.finalPredictions) ? data.finalPredictions : null;
    if (!AppState.finalPredictionsCache) AppState.finalPredictionsCache = {};
    if (!AppState._finalPredictionsCacheTime) AppState._finalPredictionsCacheTime = {};
    AppState.finalPredictionsCache[username] = fp;
    AppState._finalPredictionsCacheTime[username] = Date.now();
    return fp;
  } catch (e) {
    return null;
  }
}
```

- [ ] **Step 3: Añadir la función `renderEliminatoriasTab`**

Añadir tras `renderClassificationTab` (después de la línea 1369):

```js
/** Renderiza el tab Eliminatorias del modal de perfil (predicciones + puntos) */
async function renderEliminatoriasTab(container, username) {
  container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando eliminatorias...</div>';

  const fp = await fetchFinalPredictionsForUser(username);
  if (!fp) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay predicciones de eliminatorias.</div>';
    return;
  }

  const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);
  const { totalPoints, teamDetails } = calculateEliminatoriasPoints(fp, reachedPhases);
  const pointsByTeam = {};
  for (const d of teamDetails) pointsByTeam[d.teamId] = d.points;

  const zonaConfig = [
    { key: 'roundOf32', title: 'Dieciseisavos', emoji: '📋', max: 8 },
    { key: 'roundOf16', title: 'Octavos', emoji: '⚡', max: 8 },
    { key: 'quarterFinalists', title: 'Cuartos', emoji: '🏅', max: 4 },
    { key: 'semiFinalists', title: 'Semifinales', emoji: '⚔️', max: 2 },
  ];

  const renderZone = (cfg) => {
    const raw = fp[cfg.key];
    const ids = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    const slots = [];
    for (let i = 0; i < cfg.max; i++) {
      const teamId = ids[i];
      if (!teamId) {
        slots.push('<div class="drop-slot"></div>');
        continue;
      }
      const ext = AppState.teamsMap[teamId]?.ext || 'png';
      const pts = pointsByTeam[teamId] || 0;
      slots.push(`
        <div class="drop-slot filled">
          <img class="drop-slot-img" src="data/imgEquipos/${teamId}.${ext}" alt="${teamName(teamId)}" onerror="this.onerror=null;this.src='data/imgEquipos/default.png'">
          <span class="drop-slot-name">${teamName(teamId)}</span>
          <span class="drop-slot-points ${pts > 0 ? 'earned' : ''}">${pts > 0 ? '🎯 ' + pts + ' pts' : '—'}</span>
        </div>
      `);
    }
    return `
      <div class="drop-zone" data-zone="${cfg.key}">
        <div class="drop-zone-header">
          <span class="drop-zone-title"><span class="round-emoji">${cfg.emoji}</span>${cfg.title}</span>
          <span class="drop-zone-count ${ids.length === cfg.max ? 'complete' : ''}">${ids.length}/${cfg.max}</span>
        </div>
        <div class="drop-zone-slots">${slots.join('')}</div>
      </div>
    `;
  };

  let html = `
    <div class="eliminatorias-tab-total">
      Puntos totales eliminatorias: <strong>${totalPoints}</strong>
    </div>
    <div class="eliminatorias-view">
  `;
  for (const cfg of zonaConfig) html += renderZone(cfg);
  html += '<div class="eliminatorias-final-row">';
  html += renderZone({ key: 'runnerUp', title: 'Subcampeón', emoji: '🥈', max: 1 });
  html += renderZone({ key: 'champion', title: 'Campeón', emoji: '🏆', max: 1 });
  html += '</div>';
  html += '</div>';
  container.innerHTML = html;
}
```

Nota: `renderZone` para `runnerUp`/`champion` usa `Array.isArray(raw) ? raw : [raw]` — así `fp.runnerUp = 5` → `[5]` y `fp.runnerUp = null` → `[null]`. El `.filter(Boolean)` descarta los `null`/`undefined`.

- [ ] **Step 4: Añadir el tab al modal de perfil**

En `showUserProfileModal` (líneas 988-992), añadir el botón del tab después de "Clasificación":

```js
      <div class="profile-tabs">
        <button class="profile-tab active" data-tab="predictions">Pronósticos</button>
        <button class="profile-tab" data-tab="squad">Plantilla</button>
        <button class="profile-tab" data-tab="classification">Clasificación</button>
        <button class="profile-tab" data-tab="eliminatorias">Eliminatorias</button>
      </div>
```

En `activateTab` (líneas 1028-1033), añadir la rama:

```js
  function activateTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    if (tabName === 'predictions') renderPredictionsTab(tabContent, userData, username);
    else if (tabName === 'squad') renderSquadTab(tabContent, username);
    else if (tabName === 'classification') renderClassificationTab(tabContent, username);
    else if (tabName === 'eliminatorias') renderEliminatoriasTab(tabContent, username);
  }
```

- [ ] **Step 5: Incrementar cache-busting en `index.html`**

Cambiar línea 252:
```html
  <script src="js/main.js?v=61"></script>
```

- [ ] **Step 6: Verificación con tests existentes**

Run: `for f in tests/*.test.js; do node "$f" || exit 1; done`
Expected: todas las suites en verde (incluye los 14 de eliminatorias).

- [ ] **Step 7: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: tab Eliminatorias en modal de perfil (predicciones + puntos fase final)"
```

---

### Task 3: Integración de puntos de eliminatorias en la clasificación general

**Files:**
- Modify: `js/main.js` (`renderClasificacionTab`)
- Test: `tests/eliminatorias.test.js` (re-ejecutar, sin cambios)

**Interfaces:**
- Consumes: `fetchFinalPredictionsForUser`, `computeReachedPhases`, `calculateEliminatoriasPoints` (Tasks 1-2).
- Produces: campo `eliminatoriasPoints` en cada fila de `playersWithPoints`, sumado a `realPoints`.

- [ ] **Step 1: Añadir fetch de finalPredictions en `renderClasificacionTab`**

En `js/main.js`, dentro de `renderClasificacionTab`, en el bloque post-freeze (después del fetch de squads, antes del bucle `players.map`, alrededor de la línea 904), añadir:

```js
  // Precargar finalPredictions de todos los usuarios (con caché) para puntos de eliminatorias
  const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);
  await Promise.all(players.map(p => fetchFinalPredictionsForUser(p.name)));
```

- [ ] **Step 2: Sumar eliminatoriasPoints al total**

En el bucle `players.map` (líneas 905-931), tras calcular `classificationPts`, añadir:

```js
    // Puntos por predicciones de eliminatorias (fase final)
    let eliminatoriasPoints = 0;
    const userFp = AppState.finalPredictionsCache[p.name];
    if (userFp) {
      eliminatoriasPoints = calculateEliminatoriasPoints(userFp, reachedPhases).totalPoints;
    }
```

Y en el return, añadir `eliminatoriasPoints` y sumarlo a `realPoints`:

```js
    return {
      ...p,
      predictionPoints: userData.totalPoints,
      squadPoints,
      classificationPoints: classificationPts,
      eliminatoriasPoints,
      realPoints: userData.totalPoints + squadPoints + classificationPts + eliminatoriasPoints
    };
```

- [ ] **Step 3: Añadir al breakdown de cada fila**

En el bloque de render (líneas 936-955), tras la línea de `classificationPoints`, añadir:

```js
    if (p.eliminatoriasPoints) breakdownParts.push(`${p.eliminatoriasPoints} eliminatorias`);
```

- [ ] **Step 4: Incrementar cache-busting en `index.html`**

La línea 252 ya está en `main.js?v=61` desde Task 2; si Task 2 no se ejecutó antes, aplicarla aquí. Verificar que quedó en `v=61`.

- [ ] **Step 5: Verificación con tests existentes**

Run: `for f in tests/*.test.js; do node "$f" || exit 1; done`
Expected: todas las suites en verde.

- [ ] **Step 6: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: sumar puntos de eliminatorias a la clasificación general"
```

---

### Task 4: Estilos CSS del tab Eliminatorias

**Files:**
- Modify: `css/styles.css` (añadir estilos al final)
- Modify: `index.html` (cache-busting `styles.css?v=46`)
- Test: visual (los tests existentes no cubren CSS)

**Interfaces:**
- Consumes: clases ya existentes `.drop-zone`, `.drop-slot`, `.eliminatorias-view`, `.eliminatorias-final-row`.
- Produces: clases `.eliminatorias-tab-total`, `.drop-slot-points`, `.drop-slot-points.earned`.

- [ ] **Step 1: Añadir estilos al final de `css/styles.css`**

```css
/* --- Tab Eliminatorias en modal de perfil (predicciones + puntos) --- */
.eliminatorias-tab-total {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.eliminatorias-tab-total strong {
  color: var(--accent-primary);
  font-weight: 800;
}

.eliminatorias-view .drop-slot-points {
  font-size: 9px;
  font-weight: 700;
  margin-top: 2px;
  color: var(--text-muted);
  white-space: nowrap;
}

.eliminatorias-view .drop-slot-points.earned {
  color: var(--accent-primary);
}
```

- [ ] **Step 2: Incrementar cache-busting en `index.html`**

Cambiar línea 19:
```html
  <link rel="stylesheet" href="css/styles.css?v=46">
```

- [ ] **Step 3: Verificación de tests**

Run: `for f in tests/*.test.js; do node "$f" || exit 1; done`
Expected: todas las suites en verde (los cambios son solo CSS).

- [ ] **Step 4: Commit**

```bash
git add css/styles.css index.html
git commit -m "style: estilos del tab Eliminatorias en modal de perfil (puntos)"
```
