# Toggle Clasificación en Fila del Título — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el switch "Incluir puntos por clasificación" de la tab Clasificación al `.section-header` (a la derecha del título "🏆 Clasificación General") y eliminar el hint visible.

**Architecture:** Nueva función `syncClasifClasHeaderToggle()` en `js/main.js` que inyecta/actualiza/elimina el nodo del toggle en el header de la tab (idempotente en re-renders); `renderClasificacionTab` la invoca al principio y deja de concatenar `toggleHtml`. CSS del bloque compactado. Handler, estado y cálculo: sin cambios.

**Tech Stack:** Vanilla JS + CSS3 + tests node (patrón espejo/`fs`).

**Spec:** `docs/superpowers/specs/2026-10-22-toggle-fila-titulo-design.md`

## Global Constraints

- Repo `porra-spa/`, trabajo y commits directos en `main`.
- NO comentarios nuevos salvo los transcritos.
- Zona táctil mínima 44x44px (el wrapper del toggle en el header da la altura).
- Estado/handler/flag/reset: SIN cambios (`AppState.clasificacionClasOn`, `toggleClasificacionClas`, `syncClasifClasHeaderToggle` solo gestiona el DOM).
- Cache-busting: `main.js?v=174→175` (línea 333), `styles.css?v=126→127` (línea 19) en `index.html`.

---

### Task 1: Toggle en el header (JS + CSS + test + cache-busting)

**Files:**
- Modify: `porra-spa/js/main.js:1165-1262` (`renderClasificacionTab` + helper nuevo)
- Modify: `porra-spa/css/styles.css:7263-7296` (bloque `.clasif-clas-toggle`)
- Modify: `porra-spa/tests/clasifClasToggle.test.js`
- Modify: `porra-spa/index.html:19,333`

**Interfaces:**
- Consumes: `getFaseJuego()`, `AppState.clasificacionClasOn`, `toggleClasificacionClas()` (todo existente).
- Produces: `syncClasifClasHeaderToggle()` (global, function declaration), inyecta en `#tab-clasificacion .section-header` un `div.clasif-clas-toggle#clasif-clas-header-toggle` con `label[title]` + `input#clasif-clas-check` + `span` "Clasif.". Lo elimina fuera de `FASE_LIGA`.

- [ ] **Step 1: Añadir tests de fuente (DEBEN fallar)**

En `porra-spa/tests/clasifClasToggle.test.js`, antes del bloque `const tests = [...]`, añadir (tras `require('fs')` al inicio del fichero):

```js
const fs = require('fs');
const path = require('path');
const mainSrc = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
const indexSrc = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function test_toggle_en_header_no_en_tabla() {
  assert.ok(mainSrc.includes('function syncClasifClasHeaderToggle()'), 'helper sync existe');
  assert.ok(mainSrc.includes('clasif-clas-header-toggle'), 'id del nodo header');
  assert.ok(!mainSrc.includes('toggleHtml'), 'toggle ya no se concatena en la tabla');
  assert.ok(!mainSrc.includes('<small>Los puntos por clasificación varían'), 'hint visible eliminado');
  assert.ok(mainSrc.includes('<span>Clasif.</span>'), 'etiqueta corta');
  assert.ok(mainSrc.includes("querySelector('#tab-clasificacion .section-header')"), 'inyección en section-header');
}

function test_css_compacto() {
  assert.ok(cssSrc.includes('.clasif-clas-toggle'), 'clase existe');
  assert.ok(!cssSrc.includes('flex-wrap: wrap;\n  gap: 2px 10px;'), 'sin layout multi-fila previo');
  assert.ok(!cssSrc.includes('.clasif-clas-toggle small'), 'hint css eliminado');
}

function test_cache_busting() {
  assert.ok(indexSrc.includes('styles.css?v=127'), 'css v127');
  assert.ok(indexSrc.includes('main.js?v=175'), 'main v175');
}
```

> Nota: el bloque final de `test_toggle_en_header_no_en_tabla` debe contener exactamente estos 6 asserts (sin líneas duplicadas):
> 1. `function syncClasifClasHeaderToggle()` existe
> 2. `clasif-clas-header-toggle` en main.js
> 3. `toggleHtml` ya no aparece en main.js
> 4. `<small>Los puntos por clasificación varían` eliminado
> 5. `<span>Clasif.</span>` presente
> 6. `querySelector('#tab-clasificacion .section-header')` presente

Añadir `test_toggle_en_header_no_en_tabla`, `test_css_compacto` y `test_cache_busting` al array `tests` (solo los tres nombres, sin repetir).

- [ ] **Step 2: Run test to verify it fails**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js`
Expected: FAIL (3 failing: helper no existe, toggleHtml aún presente, versiones 126/174).

- [ ] **Step 3: Implementación en `js/main.js`**

3a. En `renderClasificacionTab`, tras el guard del container (línea ~1166):

```js
  const container = document.getElementById('clasificacion-container');
  if (!container) return;
```

añadir la llamada:

```js
  syncClasifClasHeaderToggle();
```

3b. Reemplazar el bloque completo (líneas ~1245-1256):

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

por:

```js
  container.innerHTML =
    buildClasificacionHeader() +
```

3c. Antes de `function toggleClasificacionClas()` (línea ~1265), añadir:

```js
/** Toggle de clasificacion en el header de la tab (solo FASE_LIGA); idempotente en re-renders */
function syncClasifClasHeaderToggle() {
  const header = document.querySelector('#tab-clasificacion .section-header');
  if (!header) return;
  const existing = document.getElementById('clasif-clas-header-toggle');
  if (getFaseJuego() !== 'FASE_LIGA') {
    if (existing) existing.remove();
    return;
  }
  const html = `<label title="Los puntos por clasificación varían según la clasificación real después de cada partido">
      <input type="checkbox" id="clasif-clas-check" ${AppState.clasificacionClasOn ? 'checked' : ''} onchange="toggleClasificacionClas()">
      <span>Clasif.</span>
    </label>`;
  if (existing) {
    existing.innerHTML = html;
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'clasif-clas-toggle';
  wrap.id = 'clasif-clas-header-toggle';
  wrap.innerHTML = html;
  header.appendChild(wrap);
}
```

> La colocación es tras `<h2>` por `appendChild` (el `<h2>` es el único hijo actual del `.section-header`); el flex `justify-content: space-between` lo empuja a la derecha.

- [ ] **Step 4: Ejecutar la parte de tests de JS y sintaxis (aún fallan versión/cache-busting)**

Run (desde `porra-spa`): `node --check js/main.js && node tests/clasifClasToggle.test.js`
Expected: los 3 tests viejos de helpers y `test_toggle_en_header_no_en_tabla` PASS; `test_css_compacto` y `test_cache_busting` FAIL aún.

- [ ] **Step 5: Sustituir el CSS**

Reemplazar el bloque completo (líneas 7263-7296):

```css
/* Toggle puntos por clasificación (tab Clasificación, solo FASE_LIGA) */
.clasif-clas-toggle { ... }
.clasif-clas-toggle small { ... }
.clasif-clas-toggle label { ... }
.clasif-clas-toggle input[type="checkbox"] { ... }
```

por:

```css

/* Toggle puntos por clasificación (header de la tab Clasificación, solo FASE_LIGA) */
.clasif-clas-toggle {
  min-height: 44px;
  display: flex;
  align-items: center;
}
.clasif-clas-toggle label {
  display: flex;
  align-items: center;
  gap: 6px;
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

(Es decir: se eliminan `justify-content/flex-wrap/gap de multi-fila`, `padding`, `background`, `border-bottom` y la regla `.clasif-clas-toggle small`; el wrapper aporta la zona táctil de 44px de alto.)

- [ ] **Step 6: Run all tests — verde**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js && node tests/clasificacionTable.test.js && node tests/trend.test.js && node --check js/main.js`
Expected: todas PASS.

- [ ] **Step 7: Cache-busting en `index.html`**

- Línea 19: `css/styles.css?v=126` → `css/styles.css?v=127`
- Línea 333: `js/main.js?v=174` → `js/main.js?v=175`

- [ ] **Step 8: Verificación final**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js && grep -n "styles.css?v=\|main.js?v=" index.html | head -4`
Expected: suite completa PASS; `v=127` y `v=175` presentes.

- [ ] **Step 9: Commit**

```bash
git add js/main.js css/styles.css tests/clasifClasToggle.test.js
git commit -m "feat: toggle de clasificacion en la fila del titulo"
git add index.html
git commit -m "chore: cache-busting v127 css / v175 main"
```
