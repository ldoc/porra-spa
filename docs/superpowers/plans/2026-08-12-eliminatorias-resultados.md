# Tab "Eliminatorias" en Resultados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una sub-tab "Eliminatorias" a la pantalla de Resultados que muestre los equipos eliminados en cada ronda (dieciseisavos → campeón) calculada por agregado de goles de ida y vuelta.

**Architecture:** Cálculo 100% en la SPA (`porra-spa`) a partir de `AppState.matches` (calendar.json) y `AppState.matchStats` (resultados reales). Sin cambios en api-porra (la tanda de penaltis queda fuera de alcance). Se reutiliza el layout visual del menú de predicciones de eliminatorias (`.drop-zone`, `.drop-slot`) en modo read-only, en orden cronológico.

**Tech Stack:** Vanilla JS (ES6+), HTML5, CSS3 con variables. Tests: Node.js plano (`assert` + runner manual), patrón existente en `tests/`.

## Global Constraints

- Código JS en **Vanilla ES6+**, sin frameworks (AGENTS.md). Nombres de funciones/variables en español.
- Orientación **móvil vertical** (máx ~480px), sin scroll horizontal. Reutilizar variables CSS de `:root` antes que valores estáticos.
- **Cache-busting obligatorio**: al tocar `css/styles.css` o `js/main.js`, incrementar la versión `?v=` en `index.html` (AGENTS.md). En `main`: `css/styles.css?v=41` → `?v=42` y `js/main.js?v=57` → `?v=58`.
- **Tanda de penaltis fuera de alcance**: si el agregado de un cruce es empate, el cruce queda sin resolver (nunca se decide por penaltis).
- **Solo rondas completas**: la zona de una ronda se muestra únicamente cuando todos sus cruces están resueltos por agregado.
- Tests: ficheros `.test.js` en `tests/` ejecutados con `node tests/<fichero>.test.js` (sin package.json; runner manual con `process.exit`). Los tests de la lógica pura hacen `require('../js/eliminatorias.js')` (código real, no copia).
- No añadir comentarios innecesarios al código.

---

### Task 1: Lógica pura de eliminatorias (`js/eliminatorias.js` + tests)

**Files:**
- Create: `js/eliminatorias.js`
- Modify: `index.html` (añadir `<script src="js/eliminatorias.js?v=1">` antes de `main.js`)
- Create: `tests/eliminatorias.test.js`

**Interfaces:**
- Consumes: `AppState.matches` (formato de `buildMatchFromCalendar`: `{ id, fase, homeTeamId, awayTeamId, ... }`), `AppState.matchStats` (array de `{ eventId, stats: { [teamId]: { goles } } }`).
- Produces: `js/eliminatorias.js` expone tres funciones puras:
  - `groupTies(matches) => [{ teamA, teamB, matches }]`
  - `resolveTie(tie, matchStatsById) => { resuelto: boolean, eliminado: number|null }`
  - `computeEliminatorias(matches, matchStats) => { zonas, final, rondasResueltas }`
  - En el navegador se exponen como globales (`window.groupTies`, `window.resolveTie`, `window.computeEliminatorias`); en Node se exportan vía `module.exports` (guard UMD-lite). `main.js` las consume como globales.

- [ ] **Step 1: Crear `js/eliminatorias.js`**

Contenido completo del fichero:

```javascript
(function (global) {
  /** Agrupa los partidos de una fase en cruces por par desordenado de equipos */
  function groupTies(matches) {
    const byPair = new Map();
    for (const m of matches || []) {
      const tA = Math.min(m.homeTeamId, m.awayTeamId);
      const tB = Math.max(m.homeTeamId, m.awayTeamId);
      const key = `${tA}:${tB}`;
      if (!byPair.has(key)) byPair.set(key, { teamA: tA, teamB: tB, matches: [] });
      byPair.get(key).matches.push(m);
    }
    return [...byPair.values()];
  }

  /**
   * Resuelve un cruce a doble partido por agregado.
   * Devuelve { resuelto, eliminado }. resuelto=false si falta algún resultado
   * o si el agregado queda empatado (tanda de penaltis no implementada).
   */
  function resolveTie(tie, matchStatsById) {
    if (!tie.matches || tie.matches.length < 2) return { resuelto: false, eliminado: null };
    let totA = 0;
    let totB = 0;
    for (const m of tie.matches) {
      const ms = matchStatsById.get(m.id);
      if (!ms) return { resuelto: false, eliminado: null };
      const gA = ms.stats?.[m.homeTeamId]?.goles;
      const gB = ms.stats?.[m.awayTeamId]?.goles;
      if (gA === undefined || gB === undefined) return { resuelto: false, eliminado: null };
      if (m.homeTeamId === tie.teamA) { totA += gA; totB += gB; }
      else { totA += gB; totB += gA; }
    }
    if (totA === totB) return { resuelto: false, eliminado: null };
    return { resuelto: true, eliminado: totA > totB ? tie.teamB : tie.teamA };
  }

  /**
   * Calcula los equipos eliminados en cada ronda de eliminatorias.
   * Devuelve { zonas, final, rondasResueltas }:
   *  - zonas: { '16': [teamId,...], '8': [...], '4': [...], 'semis': [...] } (solo rondas completas)
   *  - final: { campeon: teamId|null, subcampeon: teamId|null }
   *  - rondasResueltas: fases dobles completas + 'final' si la final tiene resultado
   */
  function computeEliminatorias(matches, matchStats) {
    const matchStatsById = new Map((matchStats || []).map(ms => [ms.eventId, ms]));
    const zonas = {};
    const rondasResueltas = [];
    const fasesDobles = ['16', '8', '4', 'semis'];

    for (const fase of fasesDobles) {
      const ties = groupTies((matches || []).filter(m => m.fase === fase));
      if (ties.length === 0) continue; // fase sin cruces aún (no está en el calendario) → no resuelta
      const eliminados = [];
      let completa = true;
      for (const tie of ties) {
        const { resuelto, eliminado } = resolveTie(tie, matchStatsById);
        if (!resuelto) { completa = false; break; }
        eliminados.push(eliminado);
      }
      if (completa) { zonas[fase] = eliminados; rondasResueltas.push(fase); }
    }

    const final = { campeon: null, subcampeon: null };
    const finalMatches = (matches || []).filter(m => m.fase === 'final');
    if (finalMatches.length === 1) {
      const f = finalMatches[0];
      const ms = matchStatsById.get(f.id);
      const gA = ms?.stats?.[f.homeTeamId]?.goles;
      const gB = ms?.stats?.[f.awayTeamId]?.goles;
      if (gA !== undefined && gB !== undefined && gA !== gB) {
        final.campeon = gA > gB ? f.homeTeamId : f.awayTeamId;
        final.subcampeon = gA > gB ? f.awayTeamId : f.homeTeamId;
        rondasResueltas.push('final');
      }
    }

    return { zonas, final, rondasResueltas };
  }

  global.groupTies = groupTies;
  global.resolveTie = resolveTie;
  global.computeEliminatorias = computeEliminatorias;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias };
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: Añadir la etiqueta script en `index.html`**

Insertar la línea antes de `<script src="js/main.js?v=57">`:

```html
<script src="js/eliminatorias.js?v=1"></script>
```

- [ ] **Step 3: Escribir el test**

Crear `tests/eliminatorias.test.js`. Hace `require('../js/eliminatorias.js')` (prueba el código real, no una copia):

```javascript
const assert = require('assert');
const { groupTies, resolveTie, computeEliminatorias } = require('../js/eliminatorias.js');

// ---- Helpers de test ----
function partido(id, fase, home, away) {
  return { id, fase, homeTeamId: home, awayTeamId: away };
}

function ms(eventId, goles) {
  const stats = {};
  for (const [teamId, g] of Object.entries(goles)) stats[teamId] = { goles: g };
  return { eventId, stats };
}

// ---- Tests de groupTies ----
function test_groupTies_agrupa_ida_vuelta() {
  const cruces = groupTies([
    partido(1, '16', 100, 200),
    partido(2, '16', 200, 100),
    partido(3, '16', 300, 400),
    partido(4, '16', 400, 300),
  ]);
  assert.strictEqual(cruces.length, 2);
  assert.deepStrictEqual(cruces.map(c => [c.teamA, c.teamB, c.matches.length]), [[100, 200, 2], [300, 400, 2]]);
}

// ---- Tests de resolveTie ----
function test_resolveTie_agregado_decide_eliminado() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 2, 200: 1 })],   // ida: 100 gana 2-1
    [2, ms(2, { 200: 1, 100: 1 })]    // vuelta: empate 1-1
  ]);
  // Agregado: 100 → 3, 200 → 2
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, true);
  assert.strictEqual(r.eliminado, 200);
}

function test_resolveTie_agregado_empate_pendiente() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 1, 200: 0 })],
    [2, ms(2, { 200: 1, 100: 0 })]
  ]);
  // Agregado: 1-1 → pendiente (penaltis no implementados)
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, false);
  assert.strictEqual(r.eliminado, null);
}

function test_resolveTie_sin_resultado_no_resuelto() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([[1, ms(1, { 100: 1, 200: 0 })]]); // falta la vuelta
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, false);
}

// ---- Tests de computeEliminatorias ----
// Nota: mini-cuadro ilustrativo. La función procesa cada fase de forma
// independiente; no valida coherencia entre rondas.
function test_computeEliminatorias_rondas_completas_y_parciales() {
  const matches = [
    // Dieciseisavos completos (2 cruces resueltos → 2 eliminados)
    partido(1, '16', 100, 200), partido(2, '16', 200, 100),
    partido(3, '16', 300, 400), partido(4, '16', 400, 300),
    // Octavos: un cruce resuelto y otro sin resultado (partido 8 pendiente)
    partido(5, '8', 500, 600), partido(6, '8', 600, 500),
    partido(7, '8', 700, 800), partido(8, '8', 800, 700),
  ];
  const matchStats = [
    ms(1, { 100: 2, 200: 0 }), ms(2, { 200: 1, 100: 2 }),   // 200 eliminado
    ms(3, { 300: 1, 400: 1 }), ms(4, { 400: 0, 300: 2 }),   // 400 eliminado
    ms(5, { 500: 2, 600: 1 }), ms(6, { 600: 1, 500: 2 }),   // 600 eliminado
    ms(7, { 700: 1, 800: 0 }), // falta ms(8) → octavos incompletos
  ];
  const r = computeEliminatorias(matches, matchStats);
  assert.deepStrictEqual(r.rondasResueltas, ['16']);
  assert.deepStrictEqual(r.zonas['16'].sort((a, b) => a - b), [200, 400]);
  assert.strictEqual(r.zonas['8'], undefined);
  assert.deepStrictEqual(r.final, { campeon: null, subcampeon: null });
}

function test_computeEliminatorias_final_resuelta() {
  const matches = [
    partido(1, '16', 100, 200), partido(2, '16', 200, 100),
    partido(3, '16', 300, 400), partido(4, '16', 400, 300),
    partido(5, '8', 100, 300), partido(6, '8', 300, 100),
    partido(7, '8', 500, 600), partido(8, '8', 600, 500),
    partido(9, '4', 100, 500), partido(10, '4', 500, 100),
    partido(11, 'semis', 100, 200), partido(12, 'semis', 200, 100),
    partido(13, 'final', 100, 200),
  ];
  const matchStats = [
    // 16avos: eliminan 200 y 400
    ms(1, { 100: 2, 200: 0 }), ms(2, { 200: 1, 100: 2 }),
    ms(3, { 300: 2, 400: 1 }), ms(4, { 400: 0, 300: 1 }),
    // 8avos: eliminan 300 y 600
    ms(5, { 100: 1, 300: 1 }), ms(6, { 300: 1, 100: 2 }),
    ms(7, { 500: 2, 600: 1 }), ms(8, { 600: 1, 500: 2 }),
    // Cuartos: elimina 500
    ms(9, { 100: 2, 500: 1 }), ms(10, { 500: 1, 100: 1 }),
    // Semis: elimina 200
    ms(11, { 100: 2, 200: 1 }), ms(12, { 200: 1, 100: 1 }),
    // Final: 100 gana → campeón 100, subcampeón 200
    ms(13, { 100: 2, 200: 1 }),
  ];
  const r = computeEliminatorias(matches, matchStats);
  assert.deepStrictEqual(r.rondasResueltas, ['16', '8', '4', 'semis', 'final']);
  assert.strictEqual(r.final.campeon, 100);
  assert.strictEqual(r.final.subcampeon, 200);
  assert.deepStrictEqual(r.zonas['16'].sort((a, b) => a - b), [200, 400]);
  assert.deepStrictEqual(r.zonas['8'].sort((a, b) => a - b), [300, 600]);
  assert.deepStrictEqual(r.zonas['4'], [500]);
  assert.deepStrictEqual(r.zonas['semis'], [200]);
}

// ---- Runner (mismo patrón que el resto de tests) ----
const tests = [
  test_groupTies_agrupa_ida_vuelta,
  test_resolveTie_agregado_decide_eliminado,
  test_resolveTie_agregado_empate_pendiente,
  test_resolveTie_sin_resultado_no_resuelto,
  test_computeEliminatorias_rondas_completas_y_parciales,
  test_computeEliminatorias_final_resuelta,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

Run: `node tests/eliminatorias.test.js`
Expected: 6 ✓, `6 passing, 0 failing`, exit code 0.

- [ ] **Step 5: Verificar sintaxis de los ficheros JS tocados**

Run: `node --check js/eliminatorias.js && node --check js/main.js`
Expected: sin salida (éxito).

- [ ] **Step 6: Commit**

```bash
git add js/eliminatorias.js index.html tests/eliminatorias.test.js
git commit -m "feat: lógica de equipos eliminados por ronda en eliminatorias"
```

---

### Task 2: Integrar la sub-tab "Eliminatorias" en `renderResultadosTab`

**Files:**
- Modify: `js/main.js:1459-1613` (bloque de `renderResultadosTab`)

**Interfaces:**
- Consumes: `computeEliminatorias()` (global, Task 1), `AppState.resultadosTab`, `AppState.matches`, `AppState.matchStats`, `AppState.teamsMap`, `teamName()`, `renderElimZona()`.
- Produces: `renderEliminatoriasView()` (función global, devuelve string HTML) y `renderElimZona(title, emoji, zoneId, teamIds, max)` (global). Usadas por el branch `'eliminatorias'` de `renderResultadosTab`.

- [ ] **Step 1: Añadir el botón de la sub-tab**

En `js/main.js`, dentro de `renderResultadosTab`, sustituir el bloque `headerHtml` (líneas 1459-1464) por una versión con el tercer botón:

```javascript
  let headerHtml = `
    <div class="resultados-tabs">
      <button class="resultados-tab ${currentTab === 'jornadas' ? 'active' : ''}" data-tab="jornadas">Jornadas</button>
      <button class="resultados-tab ${currentTab === 'clasificacion' ? 'active' : ''}" data-tab="clasificacion">Clasificación Real</button>
      <button class="resultados-tab ${currentTab === 'eliminatorias' ? 'active' : ''}" data-tab="eliminatorias">Eliminatorias</button>
    </div>
  `;
```

- [ ] **Step 2: Añadir el branch para la vista de eliminatorias**

Sustituir el inicio del `if/else` de renderizado (línea 1467):

```javascript
  if (currentTab === 'clasificacion') {
    // Mostrar clasificación real
    scrollHtml = renderRealStandingsTable();
  } else if (currentTab === 'eliminatorias') {
    // Mostrar equipos eliminados por ronda
    scrollHtml = renderEliminatoriasView();
  } else {
```

- [ ] **Step 3: Añadir `renderEliminatoriasView()` y `renderElimZona()`**

Insertar en `js/main.js` justo después de `renderResultadosTab` (tras la línea 1613, antes de `renderRealStandingsTable`):

```javascript
/** Renderiza la vista de eliminatorias resueltas (read-only) */
function renderEliminatoriasView() {
  const result = computeEliminatorias(AppState.matches, AppState.matchStats);
  const totalFases = 5;
  const resueltas = result.rondasResueltas.length;

  if (resueltas === 0) {
    return `
      <div style="padding: 24px; text-align: center; color: var(--text-muted);">
        Aún no hay eliminatorias resueltas.
      </div>
    `;
  }

  const zonaConfig = [
    { fase: '16', title: 'Eliminados en dieciseisavos', emoji: '📋', zoneId: 'roundOf32', max: 8 },
    { fase: '8', title: 'Eliminados en octavos', emoji: '⚡', zoneId: 'roundOf16', max: 8 },
    { fase: '4', title: 'Eliminados en cuartos', emoji: '🏅', zoneId: 'quarterFinalists', max: 4 },
    { fase: 'semis', title: 'Eliminados en semifinales', emoji: '⚔️', zoneId: 'semiFinalists', max: 2 },
  ];

  let html = `
    <div class="eliminatorias-progress">
      <span class="eliminatorias-progress-text">Eliminatorias resueltas: <strong>${resueltas}/${totalFases}</strong></span>
      <div class="eliminatorias-progress-bar">
        <div class="eliminatorias-progress-fill" style="width: ${(resueltas / totalFases) * 100}%"></div>
      </div>
    </div>
    <div class="eliminatorias-view">
  `;

  for (const cfg of zonaConfig) {
    if (!result.rondasResueltas.includes(cfg.fase)) continue;
    html += renderElimZona(cfg.title, cfg.emoji, cfg.zoneId, result.zonas[cfg.fase] || [], cfg.max);
  }

  if (result.rondasResueltas.includes('final')) {
    html += renderElimZona('Subcampeón', '🥈', 'runnerUp', result.final.subcampeon ? [result.final.subcampeon] : [], 1);
    html += renderElimZona('Campeón', '🏆', 'champion', result.final.campeon ? [result.final.campeon] : [], 1);
  }

  html += '</div>';
  return html;
}

/** Renderiza una zona con los equipos eliminados (read-only) */
function renderElimZona(title, emoji, zoneId, teamIds, max) {
  const slots = [];
  for (let i = 0; i < max; i++) {
    const teamId = teamIds[i];
    if (teamId) {
      const ext = AppState.teamsMap[teamId]?.ext || 'png';
      slots.push(`
        <div class="drop-slot filled">
          <img class="drop-slot-img" src="data/imgEquipos/${teamId}.${ext}" alt="${teamName(teamId)}" onerror="this.src='data/imgEquipos/default.png'">
          <span class="drop-slot-name">${teamName(teamId)}</span>
        </div>
      `);
    }
  }
  return `
    <div class="drop-zone" data-zone="${zoneId}">
      <div class="drop-zone-header">
        <span class="drop-zone-title"><span class="round-emoji">${emoji}</span>${title}</span>
        <span class="drop-zone-count complete">${teamIds.length}/${max}</span>
      </div>
      <div class="drop-zone-slots">${slots.join('')}</div>
    </div>
  `;
}
```

- [ ] **Step 4: Comprobar que no hay errores de sintaxis y que el evento de tabs sigue funcionando**

Run: `node --check js/main.js`
Expected: sin salida (éxito).

El listener de tabs existente (`container.querySelectorAll('.resultados-tab')`, líneas 1606-1612) ya maneja `data-tab="eliminatorias"` de forma genérica (`AppState.resultadosTab = btn.dataset.tab; renderResultadosTab();`), por lo que no requiere cambios.

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: sub-tab Eliminatorias en pantalla de Resultados"
```

---

### Task 3: Estilos CSS para la vista de eliminatorias (read-only)

**Files:**
- Modify: `css/styles.css` (añadir bloque al final del fichero)

**Interfaces:**
- Consumes: clases existentes `.drop-zone`, `.drop-zone-header`, `.drop-zone-title`, `.round-emoji`, `.drop-zone-count`, `.drop-slot`, `.drop-slot-img`, `.drop-slot-name`, `.drop-zone-slots` (ya definidas en `styles.css`). Variables de `:root` (`--accent-primary`, `--accent-purple`, `--accent-gold`, `--ucl-surface`, `--radius-full`, `--text-muted`, `--text-secondary`, `--border-color`). La pista de la barra de progreso usa `--ucl-surface`, igual que `.wizard-progress-bar` y `.standings-progress-bar` (el patrón del repo; `--bg-input` no está definido).
- Produces: clases `.eliminatorias-progress`, `.eliminatorias-progress-text`, `.eliminatorias-progress-bar`, `.eliminatorias-progress-fill`, `.eliminatorias-view`, y colores de borde para `[data-zone="champion"]` y `[data-zone="runnerUp"]`.

- [ ] **Step 1: Añadir los estilos al final de `css/styles.css`**

```css
/* --- Tab Eliminatorias en Resultados (read-only) --- */
.eliminatorias-progress {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eliminatorias-progress-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.eliminatorias-progress-text strong {
  color: var(--accent-primary);
}

.eliminatorias-progress-bar {
  height: 6px;
  background: var(--ucl-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.eliminatorias-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-purple));
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.eliminatorias-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.eliminatorias-view .drop-slot.filled {
  cursor: default;
}

.eliminatorias-view .drop-slot.filled:active {
  transform: none;
}

.drop-zone[data-zone="champion"] {
  border-left-color: var(--accent-gold);
}

.drop-zone[data-zone="runnerUp"] {
  border-left-color: #CBD5E1;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "style: estilos de la vista Eliminatorias en Resultados"
```

---

### Task 4: Cache-busting y verificación manual

**Files:**
- Modify: `index.html` (versiones `?v=`)

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Subir versiones en `index.html`**

`css/styles.css?v=41` → `css/styles.css?v=42`
`js/main.js?v=57` → `js/main.js?v=58`

- [ ] **Step 2: Verificación manual de la UI**

Levantar el frontend y, desde la consola del navegador (DevTools), inyectar datos de ejemplo para pintar la vista sin depender del backend real:

```javascript
// Solo para verificación local (F12 → Console, tras cargar la app con sesión activa)
AppState.resultadosTab = 'eliminatorias';
// Ejemplo: dieciseisavos con 2 cruces resueltos y octavos con 1 cruce resuelto (incompleto)
AppState.matchStats = [
  { eventId: 1, stats: { 42: { goles: 2 }, 2825: { goles: 0 } } },
  { eventId: 2, stats: { 2825: { goles: 1 }, 42: { goles: 2 } } },
  { eventId: 3, stats: { 1653: { goles: 1 }, 1644: { goles: 1 } } },
  { eventId: 4, stats: { 1644: { goles: 0 }, 1653: { goles: 2 } } },
  { eventId: 9, stats: { 42: { goles: 1 }, 1653: { goles: 1 } } },
  { eventId: 10, stats: { 1653: { goles: 2 }, 42: { goles: 0 } } },
  { eventId: 11, stats: { 3006: { goles: 1 }, 2829: { goles: 0 } } }
];
renderResultadosTab();
```

Expected:
- El selector muestra 3 botones y "Eliminatorias" activo.
- Cabecera "Eliminatorias resueltas: 1/5" con barra de progreso.
- Solo aparece la zona "Eliminados en dieciseisavos" con 2 equipos (2825 y 1644) — octavos no se muestra porque el cruce 11/12 está sin resolver (falta el partido 12).
- Sin errores en consola.

Comprobar también con `AppState.resultadosTab = 'jornadas'` y `'clasificacion'` que las otras dos sub-tabs siguen funcionando.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting para vista Eliminatorias en Resultados"
```

---

### Task 5: Documentar la pantalla en `pantallas-usuarios-fases.md`

**Files:**
- Modify: `pantallas-usuarios-fases.md` (sección 4 Resultados)

**Interfaces:**
- Consumes: la nueva sub-tab implementada.

- [ ] **Step 1: Añadir la sub-tab al índice y a la sección de Resultados**

En el índice de la sección 4, añadir `- 4.3 Subtab: Eliminatorias`.

Al final de la sección 4 (tras la sub-tab Clasificación real), añadir un bloque descriptivo:

```markdown
### 4.3 Subtab: Eliminatorias

Muestra los equipos eliminados en cada ronda de la fase final (a partir de dieciseisavos), calculado por agregado de goles de ida y vuelta.

| Fase | Acceso |
|---|---|
| FASE_PRETEMPORADA | 🔒 No disponible (mensaje genérico de "resultados no disponibles") |
| FASE_LIGA | ✅ Visible si hay rondas resueltas (o mensaje "Aún no hay eliminatorias resueltas") |
| FASE_PRE16 en adelante | ✅ Visible según rondas resueltas |

**Comportamiento:**
- Zonas en orden cronológico: Eliminados en dieciseisavos (8), octavos (8), cuartos (4), semifinales (2), Subcampeón (1), Campeón (1).
- Solo se muestran zonas de rondas completamente resueltas (todos sus cruces con resultado y agregado no empatado).
- Si un cruce empata a agregado, queda pendiente (tanda de penaltis no implementada).
- Cabecera con progreso "Eliminatorias resueltas: X/5".
- Read-only: no permite edición.
```

- [ ] **Step 2: Commit**

```bash
git add pantallas-usuarios-fases.md
git commit -m "docs: subtab Eliminatorias en pantalla de Resultados"
```

---

## Self-Review

**Spec coverage:**
- ✅ Sub-tab "Eliminatorias" en resultados (Task 2).
- ✅ Equipos eliminados por ronda calculados por agregado ida+vuelta (Task 1).
- ✅ Empate a agregado → pendiente (sin penaltis) (Task 1, `resolveTie`).
- ✅ Solo rondas completas visibles (Task 1 `computeEliminatorias`, Task 2 `renderEliminatoriasView`).
- ✅ Layout orden cronológico dieciseisavos → campeón, reutilizando clases del menú (Task 2 + Task 3).
- ✅ Progreso "Eliminatorias resueltas: X/5" (Task 2 + Task 3).
- ✅ Sin cambios en api-porra (fuera de alcance los penaltis) — sin tareas en api-porra.
- ✅ Cache-busting (Task 4).
- ✅ Tests de la lógica pura (Task 1).

**Placeholder scan:** Sin TBD/TODO; todos los pasos incluyen el código completo.

**Verificación cruzada:** La lógica de la Task 1 se ejecutó contra los datos de los tests del plan antes de publicarlo. Se detectó y corrigió un caso límite: una fase **sin cruces** en el calendario (aún no definida) no debe considerarse completa — corregido con `if (ties.length === 0) continue;`. Las expectativas de agregados de los tests fueron recalculadas y verificadas (`ALL OK`).

**Type consistency:** `computeEliminatorias`, `groupTies`, `resolveTie` devuelven los tipos documentados en Task 1 y se consumen igual en Task 2. `renderElimZona(title, emoji, zoneId, teamIds, max)` se define y usa con los mismos parámetros. `AppState.resultadosTab` se reutiliza con el valor `'eliminatorias'` tanto en el render (Task 2 Step 1-2) como en el listener existente (sin cambios).
