# Tab de Clasificación del perfil — orden por pronosticada + alineación móvil: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reordenar la tabla de la pestaña "Clasificación" del perfil de usuario por posición pronosticada (tabla única de 36 equipos con 4 columnas `Pron | Equipo | Real | Pts`) y corregir la desalineación móvil de los nombres largos de equipo (2 líneas con corte).

**Architecture:** Se extraen dos funciones puras (`sortTeamsByPredicted`, `buildClassificationRowHtml`) testables con el patrón espejo de `tests/`, se reescribe `renderClassificationTab` para usarlas (tabla única de 36 equipos ordenada por `predictedPos`), y se ajusta el grid CSS de la tabla. Los puntos NO cambian (`calculateClassificationPoints` se mantiene intacto).

**Tech Stack:** Vanilla JS ES6+, HTML5, CSS3 (variables `:root`), tests node nativos (`node tests/*.test.js`).

## Global Constraints

- Orientación vertical (portrait) mobile-first; no romper la UX en smartphones.
- Reutilizar variables CSS de `:root` (`--text-muted`, `--accent-primary`, `--border-color`, `--font-size-sm`); no añadir colores literales nuevos.
- Sin frameworks JS ni CSS externos.
- Cache-busting obligatorio (AGENTS.md): al tocar `css/styles.css` o `js/main.js`, incrementar su versión en `index.html`. Ahora: CSS `?v=54` → `?v=55`; JS `?v=75` → `?v=76`.
- Tests: cada fichero `tests/*.test.js` es autónomo (patrón espejo: copia la función pura y la aserta) y se ejecuta con `node tests/<fichero>.test.js`.
- No cambiar el cálculo de puntos (`calculateClassificationPoints`, `calculateRealStandings`, `calculateUserPredictedStandings`).
- No cambiar `showUserProfileModal`, otras pestañas del modal, `renderClasificacionTab` ni `showPredictedStandings`.

---

### Task 1: Helpers puros + tests (patrón espejo)

**Files:**
- Create: `tests/classificationProfileTable.test.js`
- Modify: `js/main.js` (añadir `sortTeamsByPredicted` y `buildClassificationRowHtml` justo antes de `renderClassificationTab`, que empieza en `js/main.js:1319`)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `sortTeamsByPredicted(teamDetails: Array<{predictedPos:number}>) → Array` — copia ordenada por `predictedPos` ascendente (1→36).
  - `buildClassificationRowHtml(team: {teamId:number, name:string, badgeExt:string, predictedPos:number, realPos:number, points:number}) → String` — fila HTML de 4 columnas.

- [ ] **Step 1: Escribir el test espejo**

Crear `tests/classificationProfileTable.test.js` con las funciones espejo y sus aserciones:

```js
const assert = require('assert');

function sortTeamsByPredicted(teamDetails) {
  return [...teamDetails].sort((a, b) => a.predictedPos - b.predictedPos);
}

function buildClassificationRowHtml(team) {
  const muted = team.realPos > 24 ? ' muted' : '';
  const ptsClass = team.points > 0 ? ' positive' : '';
  return `
    <div class="classification-row${muted}">
      <span class="col-pos">${team.predictedPos}</span>
      <span class="col-team">
        <img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="classification-badge" alt="${team.name}" loading="lazy" onerror="this.style.display='none'">
        <span class="col-team-name">${team.name}</span>
      </span>
      <span class="col-real">${team.realPos}</span>
      <span class="col-pts${ptsClass}">${team.points}</span>
    </div>
  `;
}

function team(overrides = {}) {
  return Object.assign({
    teamId: 2817, name: 'FC Barcelona', badgeExt: 'png',
    predictedPos: 2, realPos: 1, points: 51
  }, overrides);
}

function test_sort_por_predicted_ascendente() {
  const result = sortTeamsByPredicted([
    team({ predictedPos: 20, name: 'B' }),
    team({ predictedPos: 3, name: 'A' }),
    team({ predictedPos: 36, name: 'Sin pronóstico' }),
    team({ predictedPos: 9, name: 'C' })
  ]);
  assert.deepStrictEqual(result.map(t => t.name), ['A', 'C', 'B', 'Sin pronóstico'], 'orden por predictedPos');
  assert.deepStrictEqual(result.map(t => t.predictedPos), [3, 9, 20, 36], 'posiciones');
}

function test_fila_incluye_cuatro_columnas() {
  const html = buildClassificationRowHtml(team());
  assert.ok(html.includes('classification-row'), 'clase fila');
  assert.ok(html.includes('col-team-name'), 'clase nombre');
  assert.ok(html.includes('FC Barcelona'), 'nombre');
  assert.ok(html.includes('>2</span>'), 'primera columna = predictedPos');
  assert.ok(html.includes('>1</span>'), 'columna Real = realPos');
  assert.ok(html.includes('>51</span>'), 'columna Pts');
  assert.ok(html.includes('col-pts positive'), 'puntos positivos resaltados');
  assert.ok(!html.includes(' muted'), 'sin muted si realPos <= 24');
  assert.ok(html.includes('classification-badge'), 'escudo');
}

function test_fila_muted_cuando_no_puntua() {
  const html = buildClassificationRowHtml(team({ realPos: 30, points: 0 }));
  assert.ok(html.includes('classification-row muted'), 'clase muted');
  assert.ok(html.includes('>0</span>'), '0 puntos');
  assert.ok(!html.includes('col-pts positive'), 'sin resaltado si 0 puntos');
}

const tests = [
  test_sort_por_predicted_ascendente,
  test_fila_incluye_cuatro_columnas,
  test_fila_muted_cuando_no_puntua
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test para verificar que pasa (espejo)**

Run: `node tests/classificationProfileTable.test.js`
Expected: `3 passing, 0 failing`.

- [ ] **Step 3: Añadir las funciones idénticas a `js/main.js`**

Insertar justo antes de la línea `function renderClassificationTab(container, username) {` (js/main.js:1319):

```js
/**
 * Ordena los equipos por posición pronosticada ascendente (1→36).
 * Los equipos sin pronóstico (predictedPos = 36) quedan al final.
 */
function sortTeamsByPredicted(teamDetails) {
  return [...teamDetails].sort((a, b) => a.predictedPos - b.predictedPos);
}

/**
 * Construye el HTML de una fila de la tabla de clasificación del perfil.
 * @param {Object} team - { teamId, name, badgeExt, predictedPos, realPos, points }
 * @returns {string} Fila de 4 columnas: Pron | Equipo | Real | Pts
 */
function buildClassificationRowHtml(team) {
  const muted = team.realPos > 24 ? ' muted' : '';
  const ptsClass = team.points > 0 ? ' positive' : '';
  return `
    <div class="classification-row${muted}">
      <span class="col-pos">${team.predictedPos}</span>
      <span class="col-team">
        <img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="classification-badge" alt="${team.name}" loading="lazy" onerror="this.style.display='none'">
        <span class="col-team-name">${team.name}</span>
      </span>
      <span class="col-real">${team.realPos}</span>
      <span class="col-pts${ptsClass}">${team.points}</span>
    </div>
  `;
}
```

Nota: deben ser idénticas a las del fichero de test (patrón espejo).

- [ ] **Step 4: Verificar sintaxis y tests**

Run: `node --check js/main.js && node tests/classificationProfileTable.test.js`
Expected: sin errores de sintaxis; `3 passing, 0 failing`.

- [ ] **Step 5: Commit**

```bash
git add tests/classificationProfileTable.test.js js/main.js
git commit -m "feat: helpers puros para tabla de clasificacion del perfil (orden pronosticada) con tests"
```

---

### Task 2: Reescribir `renderClassificationTab` a tabla única ordenada por pronosticada

**Files:**
- Modify: `js/main.js:1319-1415` (cuerpo de `renderClassificationTab`)

**Interfaces:**
- Consumes: `sortTeamsByPredicted`, `buildClassificationRowHtml` (Task 1); `calculateClassificationPoints` (existente, no tocar).
- Produces: pestaña "Clasificación" del perfil con tabla única de 36 equipos.

- [ ] **Step 1: Sustituir el cuerpo de la función**

Reemplazar TODO el cuerpo de `renderClassificationTab` (desde la línea que empieza `// Verificar si hay clasificación real disponible` hasta la línea `container.innerHTML = html;` justo antes del cierre) por:

```js
  // Verificar si hay clasificación real disponible
  if (!AppState.matchStats.length) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">La clasificación real estará disponible cuando se disputen partidos.</div>';
    return;
  }

  // Calcular puntos de clasificación del usuario
  const classData = calculateClassificationPoints(username);

  if (!classData.teamDetails.length) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay datos de clasificación disponibles.</div>';
    return;
  }

  // Tabla única de los 36 equipos ordenada por posición pronosticada
  const sortedTeams = sortTeamsByPredicted(classData.teamDetails);

  const html = `
    <div class="profile-total-points">Puntos totales clasificación: <strong>${classData.totalPoints}</strong></div>
    <div class="classification-legend" style="padding: 8px 16px; font-size: 11px; color: var(--text-muted); text-align: center;">
      Solo puntúan equipos en posición 1-24 | Mínimo entre posición pronosticada y real
    </div>
    <div class="classification-section">
      <div class="classification-table">
        <div class="classification-header">
          <span class="col-pos">Pron</span>
          <span class="col-team">Equipo</span>
          <span class="col-real">Real</span>
          <span class="col-pts">Pts</span>
        </div>
        ${sortedTeams.map(buildClassificationRowHtml).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
```

Eliminar las variables `scoringTeams`, `nonScoringTeams`, `predDisplay`, las dos secciones y los dos bucles `for...of` antiguos.

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check js/main.js`
Expected: sin errores.

- [ ] **Step 3: Ejecutar tests afectados**

Run: `node tests/classificationProfileTable.test.js && node tests/clasificacionTable.test.js`
Expected: ambos con `N passing, 0 failing`.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: tabla de clasificacion del perfil unica ordenada por pronosticada (Pron | Equipo | Real | Pts)"
```

---

### Task 3: CSS — grid de 4 columnas y wrap del nombre a 2 líneas

**Files:**
- Modify: `css/styles.css:3474-3528` (bloques `.classification-header`, `.classification-row`, `.classification-row .col-*`)

**Interfaces:**
- Consumes: las clases `col-pos`, `col-team`, `col-team-name`, `col-real`, `col-pts` emitidas en Task 2.
- Produces: tabla de 4 columnas alineadas y nombres de equipo en 2 líneas con corte.

- [ ] **Step 1: Reducir el grid a 4 columnas**

En `.classification-header` (línea 3476) y `.classification-row` (línea 3493), cambiar:
`grid-template-columns: 32px 1fr 50px 50px 50px;`
por:
`grid-template-columns: 32px 1fr 50px 50px;`

- [ ] **Step 2: Limpiar selector de columnas numéricas**

En `css/styles.css:3524-3528`, el selector es:
```css
.classification-row .col-pred,
.classification-row .col-real,
.classification-row .col-pts {
  text-align: center;
}
```
Sustituirlo por:
```css
.classification-row .col-real,
.classification-row .col-pts {
  text-align: center;
}
```

- [ ] **Step 3: `min-width: 0` en `.col-team` + clase del nombre**

En `.classification-row .col-team` (css/styles.css:3516-3522) añadir `min-width: 0;` y, justo después del bloque, añadir:

```css
.classification-row .col-team-name {
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.15;
}
```

- [ ] **Step 4: Centrar celdas numéricas de la cabecera**

Tras el bloque `.classification-header .col-team { text-align: left; }` (css/styles.css:3487-3489), añadir:

```css
.classification-header .col-pos,
.classification-header .col-real,
.classification-header .col-pts {
  text-align: center;
}
```

- [ ] **Step 5: Commit**

```bash
git add css/styles.css
git commit -m "style: grid de 4 columnas y nombre de equipo en 2 lineas en tabla de clasificacion del perfil"
```

---

### Task 4: Cache-busting en `index.html`

**Files:**
- Modify: `index.html:19` y `index.html:253`

**Interfaces:**
- Consumes: nada.
- Produces: los navegadores descargan los ficheros CSS/JS actualizados.

- [ ] **Step 1: Incrementar versiones**

- Línea 19: `<link rel="stylesheet" href="css/styles.css?v=54">` → `css/styles.css?v=55`.
- Línea 253: `<script src="js/main.js?v=75"></script>` → `js/main.js?v=76`.

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting styles.css v=55 y main.js v=76"
```

---

### Task 5: Verificación completa

**Files:**
- Ninguno (solo ejecución).

**Interfaces:**
- Consumes: todos los cambios de Tasks 1-4.

- [ ] **Step 1: Ejecutar todos los tests del proyecto**

Run: `for f in tests/*.test.js; do echo "== $f"; node "$f" || exit 1; done`
Expected: todos los ficheros con `N passing, 0 failing`.

- [ ] **Step 2: Sintaxis de main.js**

Run: `node --check js/main.js`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (navegador)**

Abrir `index.html` con vista móvil vertical (o `python3 -m http.server 8000`):
1. Clasificación → pinchar un usuario → pestaña **Clasificación**.
2. Tabla única de 36 equipos ordenada por **Pron** ascendente; columna `Real` junto a ella; sin columna duplicada.
3. Equipos con real 25-36 atenuados (opacidad) en su posición pronosticada.
4. Nombres largos (p.ej. "Royale Union Saint-Gilloise") en 2 líneas y cortados con `…` sin desalinear las columnas.
5. Cabecera y filas alineadas (celdas numéricas centradas).
6. Puntos positivos en verde; total y leyenda intactos.

- [ ] **Step 4: Commit final si quedara algún cambio suelto**

```bash
git status
```

Solo commitear si hay cambios pendientes no commiteados (debe estar limpio tras los pasos anteriores).

---

## Self-Review (rellenado por el autor del plan)

- **Cobertura del spec:** Orden por pronosticada → Task 2 (sort + primera columna `Pron`). Eliminar columna duplicada y secciones → Task 2. Tabla única de 36 → Task 2. Muted para real 25-36 → Task 1/2 (`muted` en `buildClassificationRowHtml`). Wrap 2 líneas + corte → Task 3 (`.col-team-name`). Cache-busting → Task 4. Tests → Task 1. Leyenda y total intactos → Task 2. Todo cubierto.
- **Placeholders:** ninguno; todos los pasos llevan código concreto.
- **Consistencia de tipos:** `sortTeamsByPredicted(teamDetails)` y `buildClassificationRowHtml(team)` definidas en Task 1 con los mismos nombres/firma usados en Task 2. Los campos de `team` (`teamId`, `name`, `badgeExt`, `predictedPos`, `realPos`, `points`) coinciden con los que emite `calculateClassificationPoints`. Clases CSS (`col-pos`, `col-team`, `col-team-name`, `col-real`, `col-pts`) coherentes entre Tasks 1-3.
