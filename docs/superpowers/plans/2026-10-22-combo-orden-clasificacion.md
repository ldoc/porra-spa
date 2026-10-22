# Combo de Orden por Fuente en Clasificación — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `<select>` en la fila de controles de la tab Clasificación para ordenar la tabla por Total (default) / Pronosticos / Plantilla / Clasificacion / Eliminatorias, con trend ▲▼ solo cuando el orden es Total.

**Architecture:** Extensión del sort puro `sortClasificacionJugadores(rows, sortBy)` en `js/clasificacion.js` (columna elegida desc + desempate por normas), estado de pantalla `AppState.clasifSortBy` con reset al salir, fila de controles generalizada (checkbox solo en FASE_LIGA + combo siempre que haya tabla con puntos), y gate del trend en `renderClasificacionTab`.

**Tech Stack:** Vanilla ES6+, CSS3, tests node puros (`assert`), tests espejo de fuente para `main.js`.

**Spec:** `docs/superpowers/specs/2026-10-22-combo-orden-clasificacion-design.md`

## Global Constraints

- Repo `porra-spa/`, commits directos en `main`.
- NO comentarios nuevos salvo los transcritos por el plan.
- Zona táctil mínima 44x44px conservada en la fila de controles.
- Variables de `:root` (sin colores estáticos nuevos).
- Orden `total` = idéntico al comportamiento actual (incluido trend por Total).
- Antes de la primera fase con tabla con puntos (`FASE_PRETEMPORADA`) la fila no se inyecta.
- Cache-busting: `index.html` — línea 19 `styles.css?v=130→131`, línea 326 `clasificacion.js?v=2→3`, línea 333 `main.js?v=178→179`.
- Alcance estricto: sin cambios en modales de perfil, "Tus puntos", Estadísticas, hoy/live.

---

### Task 1: Sort por fuente en `js/clasificacion.js`

**Files:**
- Modify: `porra-spa/js/clasificacion.js` (tras `sortClasificacionJugadores` actual, antes de `shouldCountClassification`)
- Create: `porra-spa/tests/clasifSortFuente.test.js`

**Interfaces:**
- Consumes: `compareClasificacionJugadores` y `num` existentes en el mismo fichero.
- Produces: `sortClasificacionJugadores(rows, sortBy = 'total')` exportada en `api`/`module.exports`. Mapa de columnas: `pronosticos→predictionPoints`, `plantilla→squadPoints`, `clasificacion→classificationPoints`, `eliminatorias→eliminatoriasPoints`. Cualquier otro `sortBy` (incluido `'total'` y undefined) comporta como total. La Task 2 la consumirá vía `clasificacionApi.sortClasificacionJugadores`.

- [ ] **Step 1: Write the failing test**

Crear `porra-spa/tests/clasifSortFuente.test.js`:

```js
const assert = require('assert');
const { sortClasificacionJugadores } = require('../js/clasificacion.js');

function row(name, o) {
  return Object.assign({
    name,
    predictionPoints: 0, squadPoints: 0, classificationPoints: 0,
    eliminatoriasPoints: 0, realPoints: 0
  }, o);
}

const base = [
  row('a', { predictionPoints: 15, squadPoints: 10, realPoints: 25 }),
  row('b', { predictionPoints: 15, squadPoints: 40, realPoints: 55 }),
  row('c', { predictionPoints: 0,  squadPoints: 60, realPoints: 60 })
];

function names(rows) { return rows.map(r => r.name); }

function test_total_default_igual_actual() {
  assert.deepStrictEqual(names(sortClasificacionJugadores(base)), ['c', 'b', 'a'], 'por realPoints desc');
  assert.deepStrictEqual(names(sortClasificacionJugadores(base, 'total')), ['c', 'b', 'a'], 'sortBy total explicito');
  assert.deepStrictEqual(names(sortClasificacionJugadores(base, 'desconocido')), ['c', 'b', 'a'], 'sortBy desconocido -> total');
}

function test_pronosticos_desc_con_desempate_normas() {
  const sorted = sortClasificacionJugadores(base, 'pronosticos');
  assert.deepStrictEqual(names(sorted), ['b', 'a', 'c'], 'empate 15 -> normas (total 55 antes que 25), c sin pron va ultima');
}

function test_plantilla_desc() {
  assert.deepStrictEqual(names(sortClasificacionJugadores(base, 'plantilla')), ['c', 'b', 'a'], '60/40/10');
}

function test_clasificacion_y_eliminatorias() {
  const rows = [
    row('x', { classificationPoints: 0, eliminatoriasPoints: 30, realPoints: 30 }),
    row('y', { classificationPoints: 60, eliminatoriasPoints: 0, realPoints: 60 })
  ];
  assert.deepStrictEqual(names(sortClasificacionJugadores(rows, 'clasificacion')), ['y', 'x'], '60 antes que 0');
  assert.deepStrictEqual(names(sortClasificacionJugadores(rows, 'eliminatorias')), ['x', 'y'], '30 antes que 0');
  assert.deepStrictEqual(names(sortClasificacionJugadores(rows, 'total')), ['y', 'x'], 'total: 60 antes que 30');
}

function test_mutacion_de_entrada() {
  const copia = base.map(r => ({ ...r }));
  sortClasificacionJugadores(copia, 'plantilla');
  assert.deepStrictEqual(names(sortClasificacionJugadores(base)), ['c', 'b', 'a'], 'el array base no se muta');
}

const tests = [
  test_total_default_igual_actual,
  test_pronosticos_desc_con_desempate_normas,
  test_plantilla_desc,
  test_clasificacion_y_eliminatorias,
  test_mutacion_de_entrada
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

Run (desde `porra-spa`): `node tests/clasifSortFuente.test.js`
Expected: FAIL ("sortClasificacionJugadores is not a function" en destructuring).

- [ ] **Step 3: Implementación minimalista**

En `porra-spa/js/clasificacion.js`, justo después de la función `sortClasificacionJugadores` existente (línea ~28) y antes de la JSDoc de `shouldCountClassification`, añadir:

```js
  /**
   * Orden por fuente elegida en la tabla de Clasificacion:
   * columna desc y, en empate, desempate de normas (total > elim > plantilla > clasif > pron).
   */
  function sortClasificacionJugadoresPorFuente(rows, sortBy) {
    const keys = {
      pronosticos: 'predictionPoints',
      plantilla: 'squadPoints',
      clasificacion: 'classificationPoints',
      eliminatorias: 'eliminatoriasPoints'
    };
    const key = keys[sortBy];
    if (!key) return [...(rows || [])].sort(compareClasificacionJugadores);
    return [...(rows || [])].sort((a, b) => num(b[key]) - num(a[key]) || compareClasificacionJugadores(a, b));
  }
```

Y en la línea `const api = { ... }` añadir la exportación:

```js
  const api = { compareClasificacionJugadores, sortClasificacionJugadores, sortClasificacionJugadoresPorFuente, shouldCountClassification };
```

- [ ] **Step 4: Run test to verify it passes**

Run (desde `porra-spa`): `node tests/clasifSortFuente.test.js && node tests/clasificacionDesempate.test.js`
Expected: ambas PASS.

- [ ] **Step 5: Commit**

```bash
git add js/clasificacion.js tests/clasifSortFuente.test.js
git commit -m "feat: sort de clasificacion por fuente elegida"
```

> Nota: el nombre público es `sortClasificacionJugadoresPorFuente` (el `sortClasificacionJugadores` existente no cambia su firma/uso — otros tests lo usan como está).

---

### Task 2: Estado + fila con combo + wiring en `js/main.js`

**Files:**
- Modify: `porra-spa/js/main.js:65` (AppState), `:3412-3415` (reset), `:1226-1231` (sort), `:1233` (trendOk), `:1256-1280` (fila de controles + handler nuevo)
- Modify: `porra-spa/tests/clasifClasToggle.test.js` (checks de fuente)

**Interfaces:**
- Consumes: `clasificacionApi.sortClasificacionJugadoresPorFuente(rows, sortBy)` (Task 1), `isFasePretemporada()`, `getFaseJuego()`, `AppState.clasificacionClasOn` existentes.
- Produces: `AppState.clasifSortBy` (string `'total'|'pronosticos'|'plantilla'|'clasificacion'|'eliminatorias'`, default `'total'`, reset al salir); `setClasifSortBy(value)` global; fila `#clasif-clas-header-toggle` con `<select id="clasif-sort-select" class="clasif-clas-sort">` visible en toda fase con tabla con puntos; trend solo con `'total'`.

- [ ] **Step 1: Estado en AppState**

En `porra-spa/js/main.js:65`, después de la línea:

```js
  clasificacionClasOn: false, // toggle pantalla Clasificacion: incluir puntos por clasificacion (solo FASE_LIGA, reset al salir)
```

añadir:

```js
  clasifSortBy: 'total', // combo orden Clasificacion: total|pronosticos|plantilla|clasificacion|eliminatorias (reset al salir)
```

- [ ] **Step 2: Reset en navigateToTab**

Sustituir (líneas ~3412-3415):

```js
  if (tabName !== 'clasificacion') {
    AppState.clasificacionClasOn = false;
  }
```

por:

```js
  if (tabName !== 'clasificacion') {
    AppState.clasificacionClasOn = false;
    AppState.clasifSortBy = 'total';
  }
```

- [ ] **Step 3: Sort por fuente y gate del trend en renderClasificacionTab**

Sustituir el bloque (líneas ~1226-1233):

```js
  // Ordenar por puntos descendente + desempate de normas (reglas/UCL.html #clasificacion-final):
  // eliminatorias > plantilla > clasificación > pronósticos
  const cmpJugadores = (typeof clasificacionApi !== 'undefined')
    ? clasificacionApi.compareClasificacionJugadores
    : ((a, b) => b.realPoints - a.realPoints);
  playersWithPoints.sort(cmpJugadores);

  const trendOk = typeof trendApi !== 'undefined';
```

por:

```js
  const sortBy = AppState.clasifSortBy || 'total';
  if (typeof clasificacionApi !== 'undefined' && clasificacionApi.sortClasificacionJugadoresPorFuente) {
    clasificacionApi.sortClasificacionJugadoresPorFuente(playersWithPoints, sortBy);
  } else {
    playersWithPoints.sort((a, b) => b.realPoints - a.realPoints);
  }

  const trendOk = typeof trendApi !== 'undefined' && sortBy === 'total';
```

- [ ] **Step 4: Fila generalizada (checkbox solo FASE_LIGA + combo) y handler**

Sustituir la función `syncClasifClasHeaderToggle` completa (líneas ~1256-1280) por:

```js
/** Fila de controles de Clasificacion (toggle clasif temporal + combo de orden); idempotente en re-renders */
function syncClasifClasHeaderToggle() {
  const header = document.querySelector('#tab-clasificacion .section-header');
  if (!header) return;
  const existing = document.getElementById('clasif-clas-header-toggle');
  if (isFasePretemporada()) {
    if (existing) existing.remove();
    return;
  }
  const checkboxHtml = getFaseJuego() === 'FASE_LIGA'
    ? `<label title="Los puntos por clasificación varían según la clasificación real después de cada partido">
        <input type="checkbox" id="clasif-clas-check" ${AppState.clasificacionClasOn ? 'checked' : ''} onchange="toggleClasificacionClas()">
        <span>Mostrar ptos clasificación temporal</span>
      </label>`
    : '';
  const sortOptions = [
    ['total', 'Total'],
    ['pronosticos', 'Pronosticos'],
    ['plantilla', 'Plantilla'],
    ['clasificacion', 'Clasificacion'],
    ['eliminatorias', 'Eliminatorias']
  ].map(([value, label]) => `<option value="${value}"${(AppState.clasifSortBy || 'total') === value ? ' selected' : ''}>${label}</option>`).join('');
  const html = `${checkboxHtml}
      <select id="clasif-sort-select" class="clasif-clas-sort" onchange="setClasifSortBy(this.value)">
        ${sortOptions}
      </select>`;
  if (existing) {
    existing.innerHTML = html;
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'clasif-clas-toggle';
  wrap.id = 'clasif-clas-header-toggle';
  wrap.innerHTML = html;
  header.after(wrap);
}

function setClasifSortBy(value) {
  AppState.clasifSortBy = ['total', 'pronosticos', 'plantilla', 'clasificacion', 'eliminatorias'].includes(value) ? value : 'total';
  renderClasificacionTab();
}
```

> Colada literal del brief para el JSDoc: el comentario `/** Fila de controles ... */` va tal cual, sin añadir otros.

- [ ] **Step 5: Actualizar checks de fuente en `tests/clasifClasToggle.test.js`**

5a. En `test_toggle_en_header_no_en_tabla`: la aserción de `header.after(wrap)` queda igual, y añadir dentro de la misma función, después de ella:

```js
  assert.ok(mainSrc.includes('clasif-sort-select'), 'select de orden');
  assert.ok(mainSrc.includes('function setClasifSortBy'), 'handler del combo');
  assert.ok(mainSrc.includes("class=\"clasif-clas-sort\""), 'clase del select');
  assert.ok(mainSrc.includes("sortClasificacionJugadoresPorFuente(playersWithPoints, sortBy)"), 'sort por fuente en render');
  assert.ok(mainSrc.includes("sortBy === 'total'"), 'trend solo con total');
  assert.ok(mainSrc.includes('clasifSortBy = \'total\';'), 'reset del combo al salir');
```

5b. `test_cache_busting` NO se toca en este task (sigue verificando `v=130`/`v=178`, que siguen en `index.html` hasta el Task 3; ahí se reescribe con las versiones finales).

> Nota: `js/clasificacion.js?v=3` tampoco se toca aquí (se hace en Task 3).

- [ ] **Step 6: Verificar**

Run (desde `porra-spa`): `node --check js/main.js && node tests/clasifClasToggle.test.js; node tests/clasifSortFuente.test.js`
Expected: sintaxis OK; todos los tests de `clasifClasToggle` PASS (incluido cache-busting, aún con v130/v178) y `clasifSortFuente` PASS.

- [ ] **Step 7: Commit**

```bash
git add js/main.js tests/clasifClasToggle.test.js
git commit -m "feat: combo de orden por fuente en clasificacion"
```

---

### Task 3: CSS del combo, cache-busting final y verificación

**Files:**
- Modify: `porra-spa/css/styles.css:7263+` (bloque fila de controles)
- Modify: `porra-spa/tests/clasifClasToggle.test.js` (test_cache_busting final)
- Modify: `porra-spa/index.html:19,326,333`

**Interfaces:**
- Consumes: clases del HTML de Task 2 (`.clasif-clas-toggle`, `.clasif-clas-sort`, `#clasif-sort-select`).
- Produces: todo el CSS final para la fila; versiones finales `styles.css?v=131`, `clasificacion.js?v=3`, `main.js?v=179`.

- [ ] **Step 1: CSS del select (append/modificación en el bloque existente)**

En el bloque del toggle al final de `css/styles.css` (comentario actual «Toggle puntos por clasificación (fila propia bajo el título de Clasificación, solo FASE_LIGA)»), renombrar el comentario a:

```css
/* Fila de controles de Clasificación (toggle clasif temporal + combo de orden) */
```

añadir `gap: 10px;` a `.clasif-clas-toggle`, y después de la regla `.clasif-clas-toggle input[type="checkbox"] { ... }` añadir:

```css
.clasif-clas-sort {
  min-height: 40px;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--ucl-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
}
```

> `--ucl-surface`, `--border-color`, `--radius-md` y `--text-primary` ya existen en `:root` (verificables con grep). La fila tiene `min-height: 44px` y `display:flex`, por lo que el área táctil se mantiene.

- [ ] **Step 2: test_cache_busting final**

En `tests/clasifClasToggle.test.js`, reescribir `test_cache_busting` así (y borrar el placeholder del Step 5b de Task 2 si se dejó):

```js
function test_cache_busting() {
  assert.ok(indexSrc.includes('styles.css?v=131'), 'css v131');
  assert.ok(indexSrc.includes('clasificacion.js?v=3'), 'clasificacion v3');
  assert.ok(indexSrc.includes('main.js?v=179'), 'main v179');
}
```

Y añadir dentro de `test_css_compacto`:

```js
  assert.ok(cssSrc.includes('.clasif-clas-sort'), 'css del select');
```

- [ ] **Step 3: Cache-busting en index.html**

- Línea 19: `css/styles.css?v=130` → `css/styles.css?v=131`
- Línea 326: `js/clasificacion.js?v=2` → `js/clasificacion.js?v=3`
- Línea 333: `js/main.js?v=178` → `js/main.js?v=179`

- [ ] **Step 4: Suite completa**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js && node tests/clasifSortFuente.test.js && node tests/clasificacionTable.test.js && node tests/clasificacionDesempate.test.js && node tests/trend.test.js && node --check js/main.js && node --check js/clasificacion.js`
Expected: todas PASS.

- [ ] **Step 5: Prueba manual en navegador (pendiente de controller)**

1. Servidor ya en marcha: `http://localhost:8080`, tab Clasificación con `faseJuego = FASE_LIGA` (backend): fila con checkbox + combo centrados.
2. Cambiar combo a Pronosticos/Plantilla/Clasificacion/Eliminatorias: la tabla reordena; las flechas ▲▼ desaparecen (y la leyenda bajo la tabla); al volver a Total reaparecen.
3. Cambiar a otra tab y volver: combo en Total y checkbox apagado.
4. En PRETEMPORADA: sin fila; desde FASE_PRE16: fila con solo el combo (sin checkbox).
5. Consola sin excepciones.

- [ ] **Step 6: Commit**

```bash
git add css/styles.css tests/clasifClasToggle.test.js index.html
git commit -m "chore: css del combo y cache-busting v131/v3/v179"
```
