# Estado de equipos en Eliminatorias del perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el tab "Eliminatorias" del modal de perfil un punto de color en cada ficha de equipo indicando su estado real (verde=en juego, rojo=eliminado, gris=no clasificado), con leyenda.

**Architecture:** Se añade una función pura `getTeamEliminatoriasStatus` en `js/eliminatorias.js` (ya exportada y testeada). `renderEliminatoriasTab` en `js/main.js` calcula el estado real con `computeEliminatorias` + `calculateRealStandings` y pinta la leyenda y los puntos. CSS en `css/styles.css` respetando los tokens existentes.

**Tech Stack:** Vanilla JS (ES modules/IIFE), CSS, tests Node.js con `assert`.

## Global Constraints

- Proyecto: porra-spa (`/home/ldoc/Proyectos/porra-spa`).
- Naming en español para funciones y variables.
- Tests: ficheros Node.js con `assert` y runner propio al final del fichero; se ejecutan con `node tests/<fichero>.test.js`.
- Los cambios en `index.html` llevan cache-busting (`?v=N`) para `css/styles.css` y `js/main.js`.
- No añadir comentarios salvo los docblocks que ya existen en el estilo del proyecto.
- Respetar el diseño existente: usar clases reales (`.drop-slot`, `.eliminatorias-view`) y tokens CSS (`--ucl-card`, `--accent-primary`, `--text-muted`, `--radius-*`).

---

### Task 1: Función pura `getTeamEliminatoriasStatus`

**Files:**
- Modify: `js/eliminatorias.js` (añadir función tras `calculateEliminatoriasPoints`, ~línea 200)
- Test: `tests/eliminatorias.test.js`

**Interfaces:**
- Consumes: `computeEliminatorias` devuelve `{ zonas, final, rondasResueltas }`; `calculateRealStandings` devuelve `[{ teamId, position, ... }]`.
- Produces: `getTeamEliminatoriasStatus(teamId, elimResult, realStandings)` → `'vivo' | 'eliminado' | 'noClasificado'`. Exportada en el IIFE (`global`) y en `module.exports`.

- [ ] **Step 1: Añadir tests de `getTeamEliminatoriasStatus`**

En `tests/eliminatorias.test.js`: actualizar el require para incluir `getTeamEliminatoriasStatus`, añadir las funciones de test y registrarlas en el array `tests`.

```js
const { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner, getFinalPredictionsViolations, getTeamEliminatoriasStatus } = require('../js/eliminatorias.js');

function test_status_vivo_sin_eliminacion_y_top24() {
  const elim = { zonas: {}, final: { campeon: null, subcampeon: null } };
  const standings = [{ teamId: 42, position: 5 }];
  assert.strictEqual(getTeamEliminatoriasStatus(42, elim, standings), 'vivo');
}

function test_status_eliminado_en_zona() {
  const elim = { zonas: { '16': [42], '8': [] }, final: { campeon: null, subcampeon: null } };
  assert.strictEqual(getTeamEliminatoriasStatus(42, elim, []), 'eliminado');
}

function test_status_eliminado_en_semis() {
  const elim = { zonas: { '16': [], '8': [], '4': [], 'semis': [17] }, final: { campeon: null, subcampeon: null } };
  assert.strictEqual(getTeamEliminatoriasStatus(17, elim, []), 'eliminado');
}

function test_status_eliminado_subcampeon() {
  const elim = { zonas: {}, final: { campeon: 2829, subcampeon: 42 } };
  assert.strictEqual(getTeamEliminatoriasStatus(42, elim, []), 'eliminado');
  assert.strictEqual(getTeamEliminatoriasStatus(2829, elim, []), 'vivo');
}

function test_status_no_clasificado_posicion_25() {
  const elim = { zonas: {}, final: { campeon: null, subcampeon: null } };
  const standings = [{ teamId: 3006, position: 25 }];
  assert.strictEqual(getTeamEliminatoriasStatus(3006, elim, standings), 'noClasificado');
}

function test_status_vivo_sin_datos() {
  assert.strictEqual(getTeamEliminatoriasStatus(42, null, []), 'vivo');
}
```

Añadir los nombres al array `tests`:

```js
  test_status_vivo_sin_eliminacion_y_top24,
  test_status_eliminado_en_zona,
  test_status_eliminado_en_semis,
  test_status_eliminado_subcampeon,
  test_status_no_clasificado_posicion_25,
  test_status_vivo_sin_datos,
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `node tests/eliminatorias.test.js`
Expected: FAIL con "getTeamEliminatoriasStatus is not a function".

- [ ] **Step 3: Implementar `getTeamEliminatoriasStatus`**

En `js/eliminatorias.js`, tras `calculateEliminatoriasPoints`:

```js
  const FASES_ELIMINATORIAS = ['16', '8', '4', 'semis'];

  /**
   * Devuelve el estado real de un equipo en las eliminatorias:
   * 'vivo' (sigue en juego), 'eliminado' (cayó en una eliminatoria) o
   * 'noClasificado' (acabó fuera del top 24 real).
   * @param {number} teamId - ID del equipo
   * @param {Object} elimResult - Salida de computeEliminatorias ({ zonas, final })
   * @param {Array<{teamId:number, position:number}>} realStandings - Clasificación real
   * @returns {'vivo'|'eliminado'|'noClasificado'}
   */
  function getTeamEliminatoriasStatus(teamId, elimResult, realStandings) {
    if (elimResult) {
      for (const fase of FASES_ELIMINATORIAS) {
        if ((elimResult.zonas?.[fase] || []).includes(teamId)) return 'eliminado';
      }
      if (elimResult.final?.subcampeon === teamId) return 'eliminado';
    }
    const entry = (realStandings || []).find(t => t.teamId === teamId);
    if (entry && entry.position > 24) return 'noClasificado';
    return 'vivo';
  }
```

Registrar la exportación en el IIFE y en `module.exports`:

```js
  global.getTeamEliminatoriasStatus = getTeamEliminatoriasStatus;
```

```js
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner, getFinalPredictionsViolations, getTeamEliminatoriasStatus, saveFinalScrollPositions, restoreFinalScrollPositions };
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `node tests/eliminatorias.test.js`
Expected: todos los tests PASS, incluyendo los 6 nuevos.

- [ ] **Step 5: Commit**

```bash
git add js/eliminatorias.js tests/eliminatorias.test.js
git commit -m "feat: getTeamEliminatoriasStatus para estado vivo/eliminado/no clasificado"
```

---

### Task 2: CSS de la bola de estado y la leyenda

**Files:**
- Modify: `css/styles.css` (añadir tras el bloque `.eliminatorias-tab-total strong`, ~línea 4629)
- Modify: `index.html` (subir `?v` de `css/styles.css`)

**Interfaces:**
- Produces: clases `.elim-status-dot` (con variantes `.vivo`, `.eliminado`, `.noClasificado`), `.elim-status-legend`, `.legend-item`. Consumidas por Task 3.

- [ ] **Step 1: Añadir estilos**

En `css/styles.css`, tras la regla `.eliminatorias-tab-total strong`:

```css
/* --- Estado de equipos en eliminatorias (perfil) --- */
.elim-status-legend {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  background: var(--ucl-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  margin-bottom: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.elim-status-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--ucl-card);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
}

.elim-status-dot.vivo { background: var(--accent-primary); }
.elim-status-dot.eliminado { background: #ef4444; }
.elim-status-dot.noClasificado { background: var(--text-muted); }

.elim-status-legend .elim-status-dot {
  position: static;
  border-color: transparent;
  box-shadow: none;
}
```

- [ ] **Step 2: Cache-busting de styles.css**

En `index.html`, subir la versión: `<link rel="stylesheet" href="css/styles.css?v=57">` → `v=58`.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css index.html
git commit -m "style: bola de estado y leyenda en eliminatorias del perfil"
```

---

### Task 3: Render de la leyenda y los puntos en `renderEliminatoriasTab`

**Files:**
- Modify: `js/main.js` (función `renderEliminatoriasTab`, líneas 1388-1453)
- Modify: `index.html` (subir `?v` de `js/main.js`)

**Interfaces:**
- Consumes: `getTeamEliminatoriasStatus` (Task 1), `computeEliminatorias`, `calculateRealStandings`, `fetchMatchStats`, clases CSS (Task 2).
- Produces: HTML del tab con leyenda `.elim-status-legend` y punto `.elim-status-dot.{estado}` por ficha llena.

- [ ] **Step 1: Asegurar datos y calcular estados**

En `renderEliminatoriasTab`, justo tras obtener `fp` (línea 1391) y antes de `const reachedPhases = ...` (línea 1397):

```js
  if (!AppState.matchStats.length) await fetchMatchStats();

  const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);
  const elimResult = computeEliminatorias(AppState.matches, AppState.matchStats);
  const realStandings = calculateRealStandings();
```

Mover/reemplazar la línea existente `const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);` por el bloque anterior (que ya la incluye).

- [ ] **Step 2: Añadir la leyenda al HTML**

En el template de `html` inicial (líneas 1440-1445), insertar la leyenda entre `eliminatorias-tab-total` y `eliminatorias-view`:

```js
  let html = `
    <div class="eliminatorias-tab-total">
      Puntos totales eliminatorias: <strong>${totalPoints}</strong>
    </div>
    <div class="elim-status-legend">
      <span class="legend-item"><span class="elim-status-dot vivo"></span> En juego</span>
      <span class="legend-item"><span class="elim-status-dot eliminado"></span> Eliminado</span>
      <span class="legend-item"><span class="elim-status-dot noClasificado"></span> No clasificado</span>
    </div>
    <div class="eliminatorias-view">
  `;
```

- [ ] **Step 3: Añadir el punto a cada ficha llena**

En el `renderZone` local, dentro del `slots.push` de la ficha llena (líneas 1421-1427), calcular el estado y añadir el span. Reemplazar el bloque:

```js
      const ext = AppState.teamsMap[teamId]?.ext || 'png';
      const pts = pointsByTeam[teamId] || 0;
      const status = getTeamEliminatoriasStatus(teamId, elimResult, realStandings);
      slots.push(`
        <div class="drop-slot filled">
          <span class="elim-status-dot ${status}"></span>
          <img class="drop-slot-img" src="data/imgEquipos/${teamId}.${ext}" alt="${teamName(teamId)}" onerror="this.onerror=null;this.src='data/imgEquipos/default.png'">
          <span class="drop-slot-name">${teamName(teamId)}</span>
          <span class="drop-slot-points ${pts > 0 ? 'earned' : ''}">${pts > 0 ? '🎯 ' + pts + ' pts' : '—'}</span>
        </div>
      `);
```

- [ ] **Step 4: Cache-busting de main.js**

En `index.html`, subir la versión: `<script src="js/main.js?v=78"></script>` → `v=79`.

- [ ] **Step 5: Ejecutar la suite de tests**

Run: `node tests/eliminatorias.test.js && node tests/clasificacionTable.test.js && node tests/classificationProfileTable.test.js && node tests/finalPredictionsValidation.test.js`
Expected: todos PASS.

- [ ] **Step 6: Verificación visual manual**

Abrir la app, entrar en Clasificación → pulsar un usuario → tab Eliminatorias. Comprobar:
- Leyenda visible con los tres colores.
- Cada ficha de equipo tiene un punto en la esquina superior derecha.
- Los estados se corresponden con la realidad (en pretemporada o sin eliminatorias resueltas, todo verde).

- [ ] **Step 7: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: bola de estado y leyenda en el tab Eliminatorias del perfil"
```

---

## Self-Review

**Spec coverage:**
- Función pura de estado → Task 1.
- Leyenda + puntos en `renderEliminatoriasTab` → Task 3 (Steps 2-3).
- Asegurar `fetchMatchStats` y cálculo de `elimResult`/`realStandings` → Task 3 Step 1.
- CSS con tokens existentes → Task 2.
- Tests → Task 1 Steps 1-4.
- Fuera de alcance (Resultados→Eliminatorias, editor): no se tocan.

**Placeholder scan:** Ningún TBD/TODO; todos los pasos con código concreto.

**Type consistency:** `getTeamEliminatoriasStatus(teamId, elimResult, realStandings)` con firma idéntica en Task 1 y Task 3; clases CSS `.elim-status-dot.vivo|eliminado|noClasificado` y `.legend-item` coherentes entre Task 2 y Task 3.
