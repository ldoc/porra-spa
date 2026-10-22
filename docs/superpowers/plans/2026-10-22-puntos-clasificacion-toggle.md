# Toggle Puntos por Clasificación en Clasificación — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un switch en la pestaña Clasificación (visible solo en `FASE_LIGA`) que activa/desactiva la inclusión de los puntos por clasificación en la columna "Clas", el Total y el reordenamiento; por defecto `false` cada vez que se entra a la pantalla, y desaparece cuando termina la fase de liga (desde `FASE_PRE16`, comportamiento actual de `isClassificationCounting()`).

**Architecture:** Helper puro `shouldCountClassification` en `js/clasificacion.js` (módulo con `module.exports`, patrón existente) + parámetro opcional `includeClassification` en `computeUserRealPoints` / `computeRankingForStats` / `getClasificacionTrendMap` (`js/main.js`) + estado de pantalla `AppState.clasificacionClasOn` (reseteado en `navigateToTab`) + toggle UI en `renderClasificacionTab` reutilizando el patrón checkbox inline del admin (`js/main.js:2838`). Los tests son ficheros node autónomos que espejan funciones o importan `js/clasificacion.js` (no importan `main.js`).

**Tech Stack:** Vanilla ES6+ navegadores, CSS3 vanilla, tests con `node` puro (`assert`).

**Spec:** `docs/superpowers/specs/2026-10-22-puntos-clasificacion-toggle-design.md`

## Global Constraints

- Todo el trabajo se ejecuta en `porra-spa/` (el repo git está en esa carpeta).
- Mobile vertical first: área táctil mínima 44x44px para el toggle.
- Reutilizar variables CSS de `:root` (no colores estáticos nuevos).
- NO añadir comentarios nuevos al código (convención del proyecto).
- Cache-busting OBLIGATORIO (AGENTS.md): al tocar `css/styles.css` o `js/main.js` o `js/clasificacion.js`, incrementar `?v=` en `index.html`. Valores actuales: `css/styles.css?v=125` (línea 19), `js/clasificacion.js?v=1` (línea 326), `js/main.js?v=173` (línea 333).
- NO añadir cache-busters `?t=Date.now()` a endpoints de API.
- No tocar `getUserTotalRealPoints`, `updatePointsNumber`, modales de perfil, Estadísticas ni Inicio (el toggle afecta SOLO a la pantalla Clasificación).
- Los perfiles invitados no cambian: el toggle es de la tabla, no de cálculo por usuario privilegiado.

---

### Task 1: Helper puro `shouldCountClassification` en `js/clasificacion.js`

**Files:**
- Modify: `porra-spa/js/clasificacion.js`
- Test: `porra-spa/tests/clasifClasToggle.test.js`

**Interfaces:**
- Consumes: nada (función pura).
- Produces: `shouldCountClassification(countsNow: boolean, includeClassification: boolean|undefined) => boolean`. Regla: si `countsNow` es `true` devuelve `true`; si es `false`, devuelve `true` solo si `includeClassification === true`. Exportada en `clasificacionApi` y `module.exports`. La usarán las Tasks 2 y 4.

- [ ] **Step 1: Write the failing test**

Crear `porra-spa/tests/clasifClasToggle.test.js`:

```js
const assert = require('assert');
const { shouldCountClassification } = require('../js/clasificacion.js');

function test_countsnow_true_gana() {
  assert.strictEqual(shouldCountClassification(true, undefined), true, 'fase conteo -> true sin flag');
  assert.strictEqual(shouldCountClassification(true, false), true, 'fase conteo -> true aunque flag false');
  assert.strictEqual(shouldCountClassification(true, true), true, 'fase conteo -> true con flag true');
}

function test_countsnow_false_default_false() {
  assert.strictEqual(shouldCountClassification(false, undefined), false, 'sin flag -> no cuenta');
}

function test_countsnow_false_flag_true() {
  assert.strictEqual(shouldCountClassification(false, true), true, 'flag on -> cuenta');
}

function test_countsnow_false_flag_false() {
  assert.strictEqual(shouldCountClassification(false, false), false, 'flag off -> no cuenta');
}

const tests = [
  test_countsnow_true_gana,
  test_countsnow_false_default_false,
  test_countsnow_false_flag_true,
  test_countsnow_false_flag_false
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

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js`
Expected: FAIL con "shouldCountClassification is not a function" (destructuring falla).

- [ ] **Step 3: Write minimal implementation**

En `porra-spa/js/clasificacion.js`, tras `sortClasificacionJugadores` (línea 28) y antes de la línea `const api = {...}` (línea 30), añadir:

```js
  /**
   * Decide si los puntos por clasificación entran en el total:
   * en fases donde ya cuentan manda el comportamiento por fase;
   * fuera de ellas, solo si la pantalla lo pide explícitamente (toggle).
   */
  function shouldCountClassification(countsNow, includeClassification) {
    return countsNow ? true : includeClassification === true;
  }
```

Y cambiar la línea 30 de:

```js
  const api = { compareClasificacionJugadores, sortClasificacionJugadores };
```

a:

```js
  const api = { compareClasificacionJugadores, sortClasificacionJugadores, shouldCountClassification };
```

- [ ] **Step 4: Run test to verify it passes**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js && node tests/clasificacionDesempate.test.js`
Expected: ambos PASS (todas las suites que importan clasificacion.js quedan intactas).

- [ ] **Step 5: Commit**

```bash
git add js/clasificacion.js tests/clasifClasToggle.test.js
git commit -m "feat: helper shouldCountClassification para toggle de clasificacion"
```

---

### Task 2: Parámetro `includeClassification` en el cálculo de puntos (`js/main.js`)

**Files:**
- Modify: `porra-spa/js/main.js:3701-3730` (`computeUserRealPoints`), `3742-3776` (`computeRankingForStats`), `3779-3790` (`getClasificacionTrendMap`)

**Interfaces:**
- Consumes: `clasificacionApi.shouldCountClassification(countsNow, includeClassification)` (Task 1), `isClassificationCounting()` existente.
- Produces: `computeUserRealPoints(username, includeClassification?)` y `computeRankingForStats(matchStatsSubset, includeClassification?)`, `getClasificacionTrendMap(currentRows, includeClassification?)`. Sin el flag (o con `false` derivado del default), comportamiento idéntico al actual. Todas las llamadas existentes sin segundo argumento siguen funcionando.

- [ ] **Step 1: Modificar `computeUserRealPoints`**

En `porra-spa/js/main.js:3701`, cambiar la firma y el bloque de clasificación. Reemplazar ambas:

```js
function computeUserRealPoints(username) {
```

por:

```js
function computeUserRealPoints(username, includeClassification) {
```

y el bloque:

```js
  let classificationPoints = 0;
  if (AppState.matchStats.length > 0 && isClassificationCounting()) {
    classificationPoints = calculateClassificationPoints(username).totalPoints;
  }
```

por:

```js
  let classificationPoints = 0;
  const countsNow = isClassificationCounting();
  const countClas = (typeof clasificacionApi !== 'undefined' && clasificacionApi.shouldCountClassification)
    ? clasificacionApi.shouldCountClassification(countsNow, includeClassification)
    : (countsNow ? true : includeClassification === true);
  if (AppState.matchStats.length > 0 && countClas) {
    classificationPoints = calculateClassificationPoints(username).totalPoints;
  }
```

- [ ] **Step 2: Modificar `computeRankingForStats` y `getClasificacionTrendMap`**

En `porra-spa/js/main.js:3742`, cambiar:

```js
function computeRankingForStats(matchStatsSubset) {
```

por:

```js
function computeRankingForStats(matchStatsSubset, includeClassification) {
```

y dentro del `try`, la línea:

```js
      const parts = computeUserRealPoints(p.name);
```

por:

```js
      const parts = computeUserRealPoints(p.name, includeClassification);
```

En `porra-spa/js/main.js:3779`, cambiar:

```js
function getClasificacionTrendMap(currentRows) {
```

por:

```js
function getClasificacionTrendMap(currentRows, includeClassification) {
```

y la línea:

```js
    const prevRows = computeRankingForStats(prevSubset);
```

por:

```js
    const prevRows = computeRankingForStats(prevSubset, includeClassification);
```

- [ ] **Step 3: Verificar sintaxis y regresión**

Run (desde `porra-spa`): `node --check js/main.js && node tests/clasificacionTable.test.js && node tests/estadisticasIndividualDesempate.test.js`
Expected: sin errores de sintaxis; suites existentes PASS (no ejecutan `main.js`, verifican solo sus espejos).

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: param includeClassification en computeUserRealPoints y ranking trend"
```

---

### Task 3: Estado de pantalla `AppState.clasificacionClasOn` + reset al salir

**Files:**
- Modify: `porra-spa/js/main.js:62-65` (declaración en `AppState`), `3374-3383` (`navigateToTab`)

**Interfaces:**
- Consumes: nada.
- Produces: `AppState.clasificacionClasOn` (boolean, default `false`). Reset automático a `false` cuando `navigateToTab` navega a cualquier tab distinta de `'clasificacion'`. Lo consumirá la Task 4.

- [ ] **Step 1: Declarar el campo en AppState**

En `porra-spa/js/main.js`, dentro del objeto `AppState`, después de la línea:

```js
  openProfileJourney: null, // string: jornada desplegada en el modal de perfil (tab Pronósticos)
```

añadir:

```js
  clasificacionClasOn: false, // toggle pantalla Clasificacion: incluir puntos por clasificacion (solo FASE_LIGA, reset al salir)
```

- [ ] **Step 2: Reset en navigateToTab**

En `porra-spa/js/main.js:3374-3383`, después del bloque:

```js
  if (tabName !== 'resultados') {
    if (typeof document !== 'undefined') liveV2Ui.exitLiveV2Fullscreen();
    AppState.resultadosRound = null;
    AppState.resultadosRoundKey = null;
    liveV2Ui.stopLiveV2Polling();
  }
```

añadir:

```js
  if (tabName !== 'clasificacion') {
    AppState.clasificacionClasOn = false;
  }
```

- [ ] **Step 3: Verificar sintaxis**

Run (desde `porra-spa`): `node --check js/main.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: estado clasificacionClasOn con reset al salir de la pantalla"
```

---

### Task 4: Toggle UI en `renderClasificacionTab` + handler

**Files:**
- Modify: `porra-spa/js/main.js:1163-1252` (`renderClasificacionTab`); añadir handler `toggleClasificacionClas` justo después de la misma función (antes de `showUserProfileModal`, ~línea 1253)

**Interfaces:**
- Consumes: `computeUserRealPoints(name, includeClassification)` (Task 2), `getClasificacionTrendMap(rows, includeClassification)` (Task 2), `AppState.clasificacionClasOn` (Task 3).
- Produces: función global `toggleClasificacionClas()` (invocable desde `onchange` inline) y HTML del toggle con `id="clasif-clas-check"` cuya clase `.clasif-clas-toggle` la estiliza la Task 5.

- [ ] **Step 1: Insertar el toggle y pasar el flag**

En `renderClasificacionTab`, localizar el bloque de mapeo de puntos (~línea 1211):

```js
  const playersWithPoints = players.map(p => {
    const parts = computeUserRealPoints(p.name);
```

reemplazar por:

```js
  const playersWithPoints = players.map(p => {
    const parts = computeUserRealPoints(p.name, AppState.clasificacionClasOn);
```

después, localizar la llamada al trend (~línea 1241):

```js
  const trendMap = trendOk ? getClasificacionTrendMap(currentRows) : null;
```

reemplazar por:

```js
  const trendMap = trendOk ? getClasificacionTrendMap(currentRows, AppState.clasificacionClasOn) : null;
```

- [ ] **Step 2: Renderizar el toggle encima de la tabla**

En el `container.innerHTML` final (~línea 1244), reemplazar:

```js
  container.innerHTML =
    buildClasificacionHeader() +
```

por:

```js
  const toggleHtml = getFaseJuego() === 'FASE_LIGA'
    ? `<div class="clasif-clas-toggle">
        <label>
          <input type="checkbox" id="clasif-clas-check" ${AppState.clasificacionClasOn ? 'checked' : ''} onchange="toggleClasificacionClas()">
          <span>Incluir puntos por clasificación</span>
        </label>
        <small>Los puntos por clasificación varían según la clasificación real después de cada partido</small>
      </div>`
    : '';
  container.innerHTML =
    toggleHtml +
    buildClasificacionHeader() +
```

> Nota: en `FASE_PRETEMPORADA` y desde `FASE_PRE16` el toggle no se renderiza (rama `: ''`); el default de `AppState.clasificacionClasOn` es `false` y en esas fases el cálculo no lo consulta.

- [ ] **Step 3: Añadir el handler global**

Inmediatamente después del cierre de `renderClasificacionTab` (tras la línea 1252 `}`), añadir:

```js
function toggleClasificacionClas() {
  AppState.clasificacionClasOn = !AppState.clasificacionClasOn;
  renderClasificacionTab();
}
```

- [ ] **Step 4: Verificar sintaxis y tests de tabla**

Run (desde `porra-spa`): `node --check js/main.js && node tests/clasificacionTable.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: toggle de puntos por clasificacion en tab Clasificacion"
```

---

### Task 5: Estilos del toggle en `css/styles.css`

**Files:**
- Modify: `porra-spa/css/styles.css` (bloque nuevo al final tras `.clasificacion-legend`, líneas 5388-5394)

**Interfaces:**
- Consumes: clases del HTML de la Task 4 (`.clasif-clas-toggle`, `input[type="checkbox"]`).
- Produces: nada llamado por JS.

- [ ] **Step 1: Añadir el bloque de estilos**

Append al final de `porra-spa/css/styles.css`:

```css

/* Toggle puntos por clasificación (tab Clasificación, solo FASE_LIGA) */
.clasif-clas-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px 10px;
  padding: 8px 12px;
  background: var(--ucl-card);
  border-bottom: 1px solid var(--border-color);
}
.clasif-clas-toggle small {
  width: 100%;
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
}
.clasif-clas-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
}
.clasif-clas-toggle input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: var(--accent-primary);
  cursor: pointer;
  flex: none;
}
```

> `--ucl-card`, `--border-color`, `--text-primary` y `--accent-primary` ya existen en `:root` (`css/styles.css:14` y usados en `.clasificacion-header`).

- [ ] **Step 2: Verificar que el CSS contiene el bloque**

Run (desde `porra-spa`): `node -e "const c=require('fs').readFileSync('css/styles.css','utf8'); const req=['.clasif-clas-toggle','accent-color']; for(const r of req){ if(!c.includes(r)) throw new Error('falta '+r);} console.log('CSS OK');"`
Expected: `CSS OK`.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: estilos del toggle de puntos por clasificacion"
```

---

### Task 6: Cache-busting en `index.html` + verificación final

**Files:**
- Modify: `porra-spa/index.html:19,326,333`

- [ ] **Step 1: Subir versiones tocadas**

- Línea 19: `<link rel="stylesheet" href="css/styles.css?v=125">` → `css/styles.css?v=126`
- Línea 326: `<script src="js/clasificacion.js?v=1"></script>` → `js/clasificacion.js?v=2`
- Línea 333: `<script src="js/main.js?v=173"></script>` → `js/main.js?v=174`

- [ ] **Step 2: Verificar**

Run (desde `porra-spa`): `grep -n "styles.css?v=\|clasificacion.js?v=\|main.js?v=" index.html`
Expected: `v=126`, `clasificacion.js?v=2`, `main.js?v=174`.

- [ ] **Step 3: Suite completa de tests de clasificación/trend**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js && node tests/clasificacionTable.test.js && node tests/clasificacionDesempate.test.js && node tests/estadisticasIndividualDesempate.test.js && node tests/classificationProfileTable.test.js && node tests/trend.test.js && node --check js/main.js && node --check js/clasificacion.js`
Expected: todas PASS, sin errores de sintaxis.

- [ ] **Step 4: Prueba manual en navegador (fase simulada)**

1. Arrancar: `node server.mjs` (desde `porra-spa`), abrir `http://localhost:8080` (o el puerto que imprima).
2. Con el backend configurando `faseJuego = 'FASE_LIGA'` (admin): en Clasificación debe verse el switch "Incluir puntos por clasificación" desmarcado; activarlo → columna Clas > 0 (si hay matchstats), Total recalcado y tabla reordenada.
3. Cambiar a otra tab y volver: switch desmarcado de nuevo.
4. Recargar la página en otra tab (p. ej. Inicio): el estado empieza en `false` al entrar a Clasificación.
5. "Tus puntos" del header y modales de perfil SIN cambios al togglear.
6. Consola sin excepciones.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting v126 css / v2 clasificacion / v174 main"
```
