# Ajustes Fila de Controles Clasificación — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label del checkbox con `text-align: left` y texto "Ordenar por:" junto al combo en la fila de controles de la tab Clasificación.

**Architecture:** Cambio único y acoplado: 1 línea CSS (`text-align`), 1 span nuevo en el HTML de `syncClasifClasHeaderToggle`, 1 regla CSS nueva con variables existentes, asserts de fuente y cache-busting. Todo en un task porque un reviewer aprueba o rechaza el conjunto visual de una vez.

**Tech Stack:** Vanilla ES6+, CSS3, tests node puros (`assert`).

**Spec:** `docs/superpowers/specs/2026-10-22-fila-controles-clasif-ajustes-design.md`

## Global Constraints

- NO comentarios nuevos.
- Sin valores estáticos nuevos en CSS: solo variables de `:root` existentes.
- Fila centrada sin cambios de layout (`justify-content: center`, flex, gap actuales intactos).
- Cache-busting: `index.html` línea 19 `styles.css?v=132→133`, línea 333 `main.js?v=180→181`. `clasificacion.js?v=3` intacta.

---

### Task 1: Label izquierda + "Ordenar por:"

**Files:**
- Modify: `porra-spa/css/styles.css:7276` (línea `text-align: right` del `.clasif-clas-toggle label`) y tras `.clasif-clas-sort` (nueva regla)
- Modify: `porra-spa/js/main.js:1275-1280` (const `html` de `syncClasifClasHeaderToggle`)
- Modify: `porra-spa/tests/clasifClasToggle.test.js` (`test_toggle_en_header_no_en_tabla`, `test_css_compacto`, `test_cache_busting`)
- Modify: `porra-spa/index.html:19,333`

**Interfaces:**
- Consumes: nada nuevo (clases y función ya existentes).
- Produces: span `clasif-clas-sort-label` con copy "Ordenar por:"; CSS `.clasif-clas-toggle label { text-align: left; }`.

- [ ] **Step 1: Failing tests**

En `tests/clasifClasToggle.test.js`:

a) Dentro de `test_toggle_en_header_no_en_tabla`, añadir al final (antes de la llave de cierre):

```js
  assert.ok(mainSrc.includes('clasif-clas-sort-label'), 'span Ordenar por');
  assert.ok(mainSrc.includes('<span class="clasif-clas-sort-label">Ordenar por:</span>'), 'copy literal del label');
```

b) Dentro de `test_css_compacto`, añadir:

```js
  assert.ok(cssSrc.includes('.clasif-clas-sort-label'), 'css del label ordenar por');
  assert.ok(cssSrc.includes('text-align: left'), 'label checkbox alineado izquierda');
```

c) Sustituir `test_cache_busting` por:

```js
function test_cache_busting() {
  assert.ok(indexSrc.includes('styles.css?v=133'), 'css v133');
  assert.ok(indexSrc.includes('clasificacion.js?v=3'), 'clasificacion v3');
  assert.ok(indexSrc.includes('main.js?v=181'), 'main v181');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js`
Expected: FAIL en "span Ordenar por" (y fallos de versión hasta el Step 5).

- [ ] **Step 3: Implementación**

a) `css/styles.css` — en `.clasif-clas-toggle label`:

```css
  text-align: right;
```

→

```css
  text-align: left;
```

b) `css/styles.css` — después del bloque `.clasif-clas-sort { ... }` añadir:

```css
.clasif-clas-sort-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}
```

c) `js/main.js` — en `syncClasifClasHeaderToggle`, sustituir:

```js
  const html = `${checkboxHtml}
      <select id="clasif-sort-select" class="clasif-clas-sort" onchange="setClasifSortBy(this.value)">
        ${sortOptions}
      </select>`;
```

por:

```js
  const html = `${checkboxHtml}
      <span class="clasif-clas-sort-label">Ordenar por:</span>
      <select id="clasif-sort-select" class="clasif-clas-sort" onchange="setClasifSortBy(this.value)">
        ${sortOptions}
      </select>`;
```

- [ ] **Step 4: Run test**

Run (desde `porra-spa`): `node tests/clasifClasToggle.test.js`
Expected: PASS en los 2 asserts nuevos de fuente/CSS; FAIL SOLO en las 2 aserciones de versión (v133/v181 aún no aplicadas). Si tras el Step 3 algún otro test falla, corregir antes de avanzar.

- [ ] **Step 5: Cache-busting y verificación completa**

a) `index.html` línea 19: `css/styles.css?v=132` → `css/styles.css?v=133`; línea 333: `js/main.js?v=180` → `js/main.js?v=181`. NO tocar `js/clasificacion.js?v=3`.

b) Run (desde `porra-spa`):

```bash
node tests/clasifClasToggle.test.js && node tests/clasifSortFuente.test.js && node tests/clasificacionTable.test.js && node tests/clasificacionDesempate.test.js && node tests/trend.test.js && node --check js/main.js
```

Expected: todas PASS (38 tests + sintaxis).

- [ ] **Step 6: Commit**

```bash
git add css/styles.css js/main.js tests/clasifClasToggle.test.js index.html
git commit -m "feat: label izquierdo y texto ordenar por en fila de controles"
```

- [ ] **Step 7: Smoke manual (controller)**

En `http://localhost:8080` (recarga con cache vacío o Ctrl+F5): FASE_LIGA → fila bajo el título con checkbox (texto de 2 líneas alineado a la izquierda), "Ordenar por:" y combo; en FASE_PRE16+ solo "Ordenar por:" + combo (sin checkbox); consola sin errores.
