# Preservar scroll en Eliminatorias al colocar equipos — Implementación (porra-spa)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar que al colocar (o quitar) un equipo en la pantalla de Eliminatorias el scroll salte arriba y luego baje; la pantalla debe quedarse exactamente donde estaba.

**Architecture:** La causa raíz está en `renderFinalPredictionsTab()` (`js/main.js:5249`): cada colocación re-renderiza todo el contenedor con `container.innerHTML = ...` (resetea todo el scroll a 0) y la restauración actual es incompleta y animada: no guarda el scroll del pool `#teams-pool-scroll` y, al restaurar `.final-predictions-scroll` en `requestAnimationFrame`, el `scroll-behavior: smooth` de CSS (styles.css:3582 y 3634) anima de 0 a la posición (efecto "sube y baja"). Se extraen dos helpers testeables en `js/eliminatorias.js` (`saveFinalScrollPositions` / `restoreFinalScrollPositions`) y se usan en `main.js` restaurando de forma **síncrona** y con `scroll-behavior` forzado a `auto` durante la asignación.

**Tech Stack:** JavaScript ES6+ vanilla (SPA sin build). Tests con `node` + `assert` + mini-runner (patrón `tests/eliminatorias.test.js`).

## Global Constraints

- TDD en cada tarea: test que falla → implementación mínima → test que pasa → commit.
- Cache-busting (norma AGENTS.md): al modificar `js/main.js` o `js/eliminatorias.js` hay que incrementar su `v=X` en `index.html`.
- Los tests se ejecutan desde la raíz del repo: `node tests/<archivo>.test.js`.
- Respetar el estilo del módulo `js/eliminatorias.js`: IIFE `(function (global) {...})(typeof window !== 'undefined' ? window : globalThis)`, export por `global` y `module.exports`, JSDoc en español en cada función.
- No introducir librerías ni frameworks (no jsdom; los helpers aceptan un `doc` inyectable para testear con mocks).

---

### Task 1: Helpers de scroll `saveFinalScrollPositions` / `restoreFinalScrollPositions` en `js/eliminatorias.js`

**Files:**
- Create: `tests/finalScroll.test.js`
- Modify: `js/eliminatorias.js` (añadir constantes y funciones antes de los exports, junto al bloque de `global.*` de la línea 261)
- Modify: `index.html` (cache-busting `js/eliminatorias.js?v=3` → `js/eliminatorias.js?v=4`)

**Interfaces:**
- Produces:
  - `saveFinalScrollPositions(doc?) → Object<string,number>`: devuelve `{ selector: scrollTop }` solo para los contenedores presentes. `doc` opcional (inyectable en tests; default `document`).
  - `restoreFinalScrollPositions(positions, doc?) → void`: restaura `scrollTop` de cada selector, forzando `style.scrollBehavior = 'auto'` durante la asignación y restaurando el valor previo después.
  - Ambas disponibles como funciones globales (usadas desde `main.js`) y exportadas por `module.exports` (usadas por los tests).

- [ ] **Step 1: Write the failing test**

Create `tests/finalScroll.test.js`:

```js
const assert = require('assert');
const { saveFinalScrollPositions, restoreFinalScrollPositions } = require('../js/eliminatorias.js');

const SELECTORS = ['.final-predictions-fixed', '.final-predictions-scroll', '#teams-pool-scroll'];

function makeEl() {
  const el = { style: { scrollBehavior: '' }, behaviorDuringSet: null };
  Object.defineProperty(el, 'scrollTop', {
    get() { return this._scrollTop || 0; },
    set(v) {
      this._scrollTop = v;
      this.behaviorDuringSet = this.style.scrollBehavior;
    }
  });
  return el;
}

function mockDoc() {
  const els = {};
  for (const sel of SELECTORS) els[sel] = makeEl();
  return { els, querySelector(sel) { return els[sel] || null; } };
}

function test_save_guarda_el_scroll_de_los_tres_contenedores() {
  const doc = mockDoc();
  doc.els['.final-predictions-scroll'].scrollTop = 320;
  doc.els['#teams-pool-scroll'].scrollTop = 180;
  assert.deepStrictEqual(saveFinalScrollPositions(doc), {
    '.final-predictions-fixed': 0,
    '.final-predictions-scroll': 320,
    '#teams-pool-scroll': 180
  });
}

function test_restore_fija_scrolltop_sin_animacion_smooth() {
  const doc = mockDoc();
  const positions = { '.final-predictions-scroll': 320, '#teams-pool-scroll': 180 };
  restoreFinalScrollPositions(positions, doc);
  assert.strictEqual(doc.els['.final-predictions-scroll'].scrollTop, 320);
  assert.strictEqual(doc.els['#teams-pool-scroll'].scrollTop, 180);
  assert.strictEqual(doc.els['.final-predictions-scroll'].behaviorDuringSet, 'auto');
  assert.strictEqual(doc.els['.final-predictions-scroll'].style.scrollBehavior, '');
}

function test_restore_ignora_contenedores_ausentes() {
  const doc = mockDoc();
  doc.querySelector = (sel) => (sel === '.final-predictions-scroll' ? doc.els['.final-predictions-scroll'] : null);
  restoreFinalScrollPositions({ '.final-predictions-scroll': 320, '#teams-pool-scroll': 180 }, doc);
  assert.strictEqual(doc.els['.final-predictions-scroll'].scrollTop, 320);
  assert.strictEqual(doc.els['#teams-pool-scroll'].scrollTop, 0);
}

function test_restore_ignora_posiciones_vacias() {
  const doc = mockDoc();
  restoreFinalScrollPositions({}, doc);
  for (const sel of SELECTORS) assert.strictEqual(doc.els[sel].scrollTop, 0);
}

const tests = [
  test_save_guarda_el_scroll_de_los_tres_contenedores,
  test_restore_fija_scrolltop_sin_animacion_smooth,
  test_restore_ignora_contenedores_ausentes,
  test_restore_ignora_posiciones_vacias
];
for (const t of tests) { t(); console.log('✓', t.name); }
console.log('OK', tests.length, 'tests');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/finalScroll.test.js`
Expected: FAIL with `TypeError: saveFinalScrollPositions is not a function` (todavía no existe).

- [ ] **Step 3: Write minimal implementation**

Add to `js/eliminatorias.js`, just before the `global.*` exports block (line 261):

```js
  /** Selectores de los contenedores con scroll de la pestaña de fase final */
  const FINAL_SCROLL_SELECTORS = ['.final-predictions-fixed', '.final-predictions-scroll', '#teams-pool-scroll'];

  /**
   * Guarda el scrollTop de los contenedores con scroll de la pestaña de fase final.
   * Devuelve { selector: scrollTop } solo para los contenedores presentes en el DOM.
   * @param {Document} [doc] - Documento inyectable para tests (default: document).
   */
  function saveFinalScrollPositions(doc) {
    const d = doc || globalThis.document;
    const positions = {};
    for (const sel of FINAL_SCROLL_SELECTORS) {
      const el = d.querySelector(sel);
      if (el) positions[sel] = el.scrollTop;
    }
    return positions;
  }

  /**
   * Restaura el scrollTop guardado en los contenedores con scroll de la pestaña
   * de fase final. Anula temporalmente el `scroll-behavior: smooth` (inline) para
   * que la restauración sea instantánea y no se perciba el salto "sube y baja".
   * @param {Object<string,number>} positions - Mapa selector -> scrollTop (de saveFinalScrollPositions).
   * @param {Document} [doc] - Documento inyectable para tests (default: document).
   */
  function restoreFinalScrollPositions(positions, doc) {
    const d = doc || globalThis.document;
    for (const sel of Object.keys(positions || {})) {
      const el = d.querySelector(sel);
      if (!el) continue;
      const prevBehavior = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = positions[sel];
      el.style.scrollBehavior = prevBehavior;
    }
  }
```

And update the exports (lines 261-270) to add both functions:

```js
  global.groupTies = groupTies;
  global.resolveTie = resolveTie;
  global.computeEliminatorias = computeEliminatorias;
  global.computeReachedPhases = computeReachedPhases;
  global.calculateEliminatoriasPoints = calculateEliminatoriasPoints;
  global.getShootoutWinner = getShootoutWinner;
  global.getFinalPredictionsViolations = getFinalPredictionsViolations;
  global.saveFinalScrollPositions = saveFinalScrollPositions;
  global.restoreFinalScrollPositions = restoreFinalScrollPositions;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner, getFinalPredictionsViolations, saveFinalScrollPositions, restoreFinalScrollPositions };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/finalScroll.test.js`
Expected: PASS (4 tests, `OK 4 tests`).

- [ ] **Step 5: Run existing tests to confirm no regressions**

Run: `for f in tests/*.test.js; do node "$f" >/dev/null 2>&1 && echo "PASS $f" || { echo "FAIL $f"; node "$f"; }; done`
Expected: todos los tests PASS (incluye `tests/eliminatorias.test.js` y `tests/finalPredictionsValidation.test.js`, que usan el módulo modificado).

- [ ] **Step 6: Cache-busting y commit**

In `index.html`, update line 251:
```html
<script src="js/eliminatorias.js?v=4"></script>
```

```bash
git add js/eliminatorias.js tests/finalScroll.test.js index.html
git commit -m "feat: helpers para preservar scroll en fase final (save/restore instantáneo)"
```

---

### Task 2: Usar los helpers en `renderFinalPredictionsTab` (`js/main.js`)

**Files:**
- Modify: `js/main.js:5317-5318` y `js/main.js:5402-5407`
- Modify: `index.html` (cache-busting `js/main.js?v=74` → `js/main.js?v=75`)

**Interfaces:**
- Consumes: `saveFinalScrollPositions()`, `restoreFinalScrollPositions(positions)` (funciones globales de `js/eliminatorias.js`, Task 1).

- [ ] **Step 1: Write the failing test (verificación manual del flujo UI)**

El comportamiento de scroll es UI y no es testeable con el harness actual (sin jsdom). En su lugar, describir el flujo de verificación manual que debe cumplirse tras Task 2:

1. Abrir la pestaña **Eliminatorias**.
2. Hacer scroll hacia abajo en el pool de equipos (`#teams-pool-scroll`) hasta un equipo situado al final de la lista.
3. Hacer scroll en la columna derecha (`.final-predictions-scroll`) hasta **Octavos** o **Dieciseisavos**.
4. Tocar el equipo del paso 2 y luego una casilla vacía.
5. **Comportamiento esperado**: la pantalla NO salta arriba ni se anima; tanto el pool como la columna derecha permanecen exactamente en la misma posición. Repetir con un ✕ de quitar equipo y con la casilla de Campeón/Subcampeón.

- [ ] **Step 2: Run manual test to verify it fails (antes de la implementación)**

Realizar el flujo anterior sobre el código actual: se observa el salto a arriba del pool y el animado "sube y baja" en la columna derecha. Esto confirma la reproducción.

- [ ] **Step 3: Write minimal implementation**

Replace lines 5317-5318 in `js/main.js`:

```js
  const savedScrollLeft = document.querySelector('.final-predictions-fixed')?.scrollTop || 0;
  const savedScrollRight = document.querySelector('.final-predictions-scroll')?.scrollTop || 0;
```

with:

```js
  const savedScrollPositions = saveFinalScrollPositions();
```

Replace the restore block (lines 5402-5407):

```js
  requestAnimationFrame(() => {
    const left = document.querySelector('.final-predictions-fixed');
    const right = document.querySelector('.final-predictions-scroll');
    if (left) left.scrollTop = savedScrollLeft;
    if (right) right.scrollTop = savedScrollRight;
  });
```

with a synchronous restore right after `container.innerHTML`:

```js
  restoreFinalScrollPositions(savedScrollPositions);
```

> Nota: la restauración es síncrona (no en `requestAnimationFrame`) para que el navegador no pinte el estado en `scrollTop = 0` antes de restaurar, y `restoreFinalScrollPositions` fuerza `scroll-behavior: auto` durante la asignación para anular el `smooth` del CSS. El bloque de `if (!frozen) { setupFinalPredictionsTapToPlace(); ... }` queda intacto.

- [ ] **Step 4: Run manual test to verify it passes**

Repetir el flujo del Step 1. Esperado: al colocar y quitar equipos, el pool y la columna derecha se quedan exactamente donde estaban, sin salto arriba ni animación.

- [ ] **Step 5: Run existing tests to confirm no regressions**

Run: `for f in tests/*.test.js; do node "$f" >/dev/null 2>&1 && echo "PASS $f" || { echo "FAIL $f"; node "$f"; }; done`
Expected: todos los tests PASS. Además comprobar en consola del navegador que no hay excepciones al colocar/quitar equipos.

- [ ] **Step 6: Cache-busting y commit**

In `index.html`, update line 253:
```html
<script src="js/main.js?v=75"></script>
```

```bash
git add js/main.js index.html
git commit -m "fix: preservar scroll de pool y cajas en Eliminatorias al colocar/quitar equipos"
```
