# Selección de todas las fases en panel admin — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dropdown "Cambiar a:" del panel de administración ofrezca las 13 fases disponibles, ordenadas de más antigua a más nueva, con la fase actual preseleccionada.

**Architecture:** En `showAdminModal` (js/main.js) se elimina el cálculo de fases adyacentes y se genera el HTML de opciones a partir de todas las fases de `AppState.fases` (ya ordenadas por `id` en `data/fases.json`). La generación de opciones se extrae a un helper puro `buildPhaseOptionsHtml` para poder testearlo sin DOM.

**Tech Stack:** JavaScript Vanilla (ES6+), tests Node standalone con `assert`.

## Global Constraints

- `value` de cada `<option>` sigue siendo el código interno (`f.nombre`); la etiqueta visible es `desc` con fallback a `nombre`.
- La fase actual lleva `selected` en el dropdown.
- El recuadro "Fase actual: `getFaseDesc(fase)`" se mantiene.
- El guard existente `if (targetPhase === currentPhase) { showToast('Ya estás en esta fase'); return; }` se mantiene.
- El botón "Cambiar Fase" queda siempre habilitado (se elimina el `disabled` condicional).
- No se modifica `getFaseLabel`, `getFaseDesc`, la lógica de confirmación (`showPhaseConfirmModal`) ni el envío de códigos a la API.
- Cache-busting (AGENTS.md): al modificar `js/main.js` hay que subir `v=X` en `index.html:252` (`js/main.js?v=63` → `v=64`).
- Tests: scripts Node standalone con `require('assert')`, runner `node tests/<archivo>.test.js` que sale `process.exit(failed > 0 ? 1 : 0)`. No usar frameworks.

---

### Task 1: Helper `buildPhaseOptionsHtml` + uso en `showAdminModal`

**Files:**
- Modify: `js/main.js` (insertar helper tras `getFaseDesc`, ~línea 68; usar en `showAdminModal` líneas 2282-2295)
- Modify: `index.html:252` (cache-busting `v=63` → `v=64`)
- Test: `tests/buildPhaseOptionsHtml.test.js` (nuevo)

**Interfaces:**
- Consumes: `AppState.fases` (array con `{ id, nombre, desc, ... }`), `getFaseJuego()`, `getFaseDesc(codigo)` (ya existen).
- Produces: `buildPhaseOptionsHtml(fases, faseActual)` → string de `<option>` HTML.
  - `fases`: array de fases en orden (id ascendente).
  - `faseActual`: string con el código interno (`f.nombre`) de la fase actual.
  - Devuelve un `<option value="{nombre}">"{desc || nombre}"</option>` por fase; la fase cuyo `nombre === faseActual` lleva `selected`.

- [ ] **Step 1: Write the failing test**

Crear `tests/buildPhaseOptionsHtml.test.js`:

```js
const assert = require('assert');

function buildPhaseOptionsHtml(fases, faseActual) {
  return (fases || [])
    .map(f => `<option value="${f.nombre}"${f.nombre === faseActual ? ' selected' : ''}>${f.desc || f.nombre}</option>`)
    .join('');
}

const FASE = { id: 1, nombre: 'FASE_PRETEMPORADA', desc: 'Pretemporada' };
const LIGA = { id: 2, nombre: 'FASE_LIGA', desc: 'Liga' };

const tests = [
  {
    name: 'genera una opcion por fase en el orden dado',
    fn: () => {
      const html = buildPhaseOptionsHtml([FASE, LIGA], 'FASE_LIGA');
      assert.strictEqual(html, '<option value="FASE_PRETEMPORADA">Pretemporada</option>' +
        '<option value="FASE_LIGA" selected>Liga</option>');
    }
  },
  {
    name: 'marca selected solo en la fase actual',
    fn: () => {
      const html = buildPhaseOptionsHtml([FASE, LIGA], 'FASE_PRETEMPORADA');
      assert.ok(html.includes('value="FASE_PRETEMPORADA" selected'));
      assert.ok(!html.includes('value="FASE_LIGA" selected'));
    }
  },
  {
    name: 'usa nombre como fallback cuando no hay desc',
    fn: () => {
      const sinDesc = { id: 3, nombre: 'FASE_X' };
      const html = buildPhaseOptionsHtml([sinDesc], 'FASE_X');
      assert.strictEqual(html, '<option value="FASE_X" selected>FASE_X</option>');
    }
  },
  {
    name: 'devuelve string vacio con fases vacio o ausente',
    fn: () => {
      assert.strictEqual(buildPhaseOptionsHtml([], 'FASE_X'), '');
      assert.strictEqual(buildPhaseOptionsHtml(undefined, 'FASE_X'), '');
    }
  }
];

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`PASS ${t.name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${t.name}: ${e.message}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails (referencia a función ausente en main.js)**

Run: `node tests/buildPhaseOptionsHtml.test.js`
Expected: PASS (el test copia la función, por lo que pasa en solitario; la referencia en main.js aún no existe). Confirmar que aún no existe en `js/main.js`:
`grep -n "buildPhaseOptionsHtml" js/main.js` → sin resultados.

- [ ] **Step 3: Añadir el helper a `js/main.js`**

Insertar tras `getFaseDesc` (después de la línea 68):

```js
function buildPhaseOptionsHtml(fases, faseActual) {
  return (fases || [])
    .map(f => `<option value="${f.nombre}"${f.nombre === faseActual ? ' selected' : ''}>${f.desc || f.nombre}</option>`)
    .join('');
}
```

- [ ] **Step 4: Usar el helper en `showAdminModal`**

Reemplazar las líneas 2282-2295 (bloque de `currentFase`/`adjacentFases` y `optionsHtml`):

```js
  // Generar opciones del dropdown con todas las fases, ordenadas de más antigua a más nueva
  const optionsHtml = buildPhaseOptionsHtml(fases, fase);
```

(Quitar `const currentFase = ...`, el bloque `adjacentFases`, y la lógica ternaria del `optionsHtml`.)

- [ ] **Step 5: Quitar el `disabled` condicional del botón**

En la línea ~2319, cambiar:

```html
      <button id="btn-admin-change-phase" class="btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; margin-top: 16px; width: 100%;" ${adjacentFases.length === 0 ? 'disabled' : ''}>
```

por (sin la interpolación `${adjacentFases...}`):

```html
      <button id="btn-admin-change-phase" class="btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; margin-top: 16px; width: 100%;">
```

- [ ] **Step 6: Cache-busting**

En `index.html:252`, cambiar `<script src="js/main.js?v=63"></script>` por `<script src="js/main.js?v=64"></script>`.

- [ ] **Step 7: Verificar sintaxis y tests**

Run: `node --check js/main.js`
Expected: sin errores (sin salida).

Run: `node tests/buildPhaseOptionsHtml.test.js`
Expected: 4 PASS.

Run: `node tests/fasesDesc.test.js && node tests/getFaseDesc.test.js`
Expected: PASS (regresión).

- [ ] **Step 8: Commit**

```bash
git add js/main.js index.html tests/buildPhaseOptionsHtml.test.js
git commit -m "feat: seleccionar todas las fases en panel admin"
```

---

## Self-Review

**1. Cobertura del spec:**
- Todas las fases en el dropdown → Task 1 Step 4 ✅
- Ordenadas de más antigua a más nueva (orden de `AppState.fases` = `id` ascendente) → Task 1 Step 4 ✅
- Fase actual preseleccionada → Task 1 Step 4 (`selected`) ✅
- Quitar `disabled` → Task 1 Step 5 ✅
- Mantener recuadro "Fase actual" → sin cambios, se conserva ✅
- Mantener guard `targetPhase === currentPhase` → sin cambios, se conserva ✅
- Cache-busting v=63 → v=64 → Task 1 Step 6 ✅
- No tocar `getFaseLabel`, confirmación ni envío a API → no hay tareas que los modifiquen ✅

**2. Placeholder scan:** no hay TBD/TODO; cada paso incluye el código exacto.

**3. Consistencia de tipos:** `buildPhaseOptionsHtml(fases, faseActual)` con `fases` array y `faseActual` string (`f.nombre`) en helper, test y uso; coherente.
