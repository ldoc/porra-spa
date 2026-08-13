# Campo `desc` para fases — Plan de Implementación

> **Para agentes de trabajo:** SUB-SKILL OBLIGATORIO: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para seguimiento.

**Objetivo:** Añadir el campo `desc` (nombre legible) a cada fase en `data/fases.json` y mostrar `desc` en lugar del código `nombre` en todos los puntos de la interfaz donde la fase se muestra al usuario.

**Arquitectura:** `data/fases.json` se amplía con `desc` por fase (el campo `nombre` sigue siendo el identificador interno). En `js/main.js` se añade un helper puro `getFaseDesc(codigo)` que traduce un código de fase a su `desc` (fallback: el propio código) consultando `AppState.fases`, y se sustituyen las visualizaciones al usuario por ese helper. La lógica interna (búsquedas por `nombre`, envío de códigos a la API) no cambia.

**Tech Stack:** Vanilla JS (ES6+), JSON, scripts de test Node con `assert` (sin framework, ejecutables con `node tests/xxx.test.js`).

## Global Constraints

- `data/fases.json`: 13 fases, el campo `desc` se añade a cada objeto de `fases[]`; `nombre` se conserva intacto.
- Valores de `desc` (verbatim del spec):
  `FASE_PRETEMPORADA`→`Pretemporada`, `FASE_LIGA`→`Liga`, `FASE_PRE16`→`Previa Knockouts`, `FASE_16`→`Knockouts`, `FASE_PRE8`→`Previa Octavos`, `FASE_8`→`Octavos de final`, `FASE_PRE4`→`Previa Cuartos`, `FASE_4`→`Cuartos de final`, `FASE_PRESEMIS`→`Previa Semifinales`, `FASE_SEMIS`→`Semifinales`, `FASE_PREFINAL`→`Previa Final`, `FASE_FINAL`→`Final`, `FASE_POSTFINAL`→`Fin de porra`.
- `getFaseLabel` (`main.js:2881`) NO se modifica (fuera de alcance, decisión del usuario).
- Cache-busting (AGENTS.md): al modificar `js/main.js` hay que incrementar `v=X` en `index.html:252` (`<script src="js/main.js?v=62">` → `v=63`).
- Los tests son scripts Node autónomos con `require('assert')` y `process.exit(failed > 0 ? 1 : 0)`, ejecutables con `node tests/<archivo>.test.js`.

---

### Task 1: Añadir `desc` a las 13 fases en `data/fases.json`

**Files:**
- Modify: `data/fases.json`
- Test: `tests/fasesDesc.test.js`

**Interfaces:**
- Consumes: — (nada, es la primera tarea)
- Produces: `data/fases.json` con campo `desc` en cada fase. Las siguientes tareas consumen estos valores.

- [ ] **Step 1: Escribir el test que valida `desc` en fases.json**

Create `tests/fasesDesc.test.js`:

```js
const assert = require('assert');
const fasesJson = require('../data/fases.json');

function test_todas_las_fases_tienen_desc() {
  const fases = fasesJson.fases;
  assert.ok(Array.isArray(fases), 'fases debe ser un array');
  assert.strictEqual(fases.length, 13, 'debe haber 13 fases');
  for (const f of fases) {
    assert.ok(f.nombre, `fase ${f.id} debe tener nombre`);
    assert.ok(f.desc && f.desc.trim().length > 0, `fase ${f.nombre} debe tener desc no vacío`);
  }
}

function test_valores_desc_esperados() {
  const expected = {
    'FASE_PRETEMPORADA': 'Pretemporada',
    'FASE_LIGA': 'Liga',
    'FASE_PRE16': 'Previa Knockouts',
    'FASE_16': 'Knockouts',
    'FASE_PRE8': 'Previa Octavos',
    'FASE_8': 'Octavos de final',
    'FASE_PRE4': 'Previa Cuartos',
    'FASE_4': 'Cuartos de final',
    'FASE_PRESEMIS': 'Previa Semifinales',
    'FASE_SEMIS': 'Semifinales',
    'FASE_PREFINAL': 'Previa Final',
    'FASE_FINAL': 'Final',
    'FASE_POSTFINAL': 'Fin de porra'
  };
  for (const f of fasesJson.fases) {
    assert.strictEqual(f.desc, expected[f.nombre], `desc de ${f.nombre} debe ser "${expected[f.nombre]}"`);
  }
}

const tests = [test_todas_las_fases_tienen_desc, test_valores_desc_esperados];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `node tests/fasesDesc.test.js`
Expected: FAIL — `fase 1 debe tener desc no vacío` (o similar, porque `desc` aún no existe).

- [ ] **Step 3: Añadir el campo `desc` a cada fase en `data/fases.json`**

En cada objeto de `fases[]`, añadir la línea `"desc": "<valor>",` tras la línea `"nombre"`. Por orden de `id`:

```json
{ "id": 1, "nombre": "FASE_PRETEMPORADA", "desc": "Pretemporada", ... }
{ "id": 2, "nombre": "FASE_LIGA", "desc": "Liga", ... }
{ "id": 3, "nombre": "FASE_PRE16", "desc": "Previa Knockouts", ... }
{ "id": 4, "nombre": "FASE_16", "desc": "Knockouts", ... }
{ "id": 5, "nombre": "FASE_PRE8", "desc": "Previa Octavos", ... }
{ "id": 6, "nombre": "FASE_8", "desc": "Octavos de final", ... }
{ "id": 7, "nombre": "FASE_PRE4", "desc": "Previa Cuartos", ... }
{ "id": 8, "nombre": "FASE_4", "desc": "Cuartos de final", ... }
{ "id": 9, "nombre": "FASE_PRESEMIS", "desc": "Previa Semifinales", ... }
{ "id": 10, "nombre": "FASE_SEMIS", "desc": "Semifinales", ... }
{ "id": 11, "nombre": "FASE_PREFINAL", "desc": "Previa Final", ... }
{ "id": 12, "nombre": "FASE_FINAL", "desc": "Final", ... }
{ "id": 13, "nombre": "FASE_POSTFINAL", "desc": "Fin de porra", ... }
```

(Conservar el resto de campos de cada fase tal cual; solo añadir `desc`.)

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `node tests/fasesDesc.test.js`
Expected: PASS — `2 passing, 0 failing`.

- [ ] **Step 5: Commit**

```bash
git add data/fases.json tests/fasesDesc.test.js
git commit -m "feat: añadir campo desc a las fases en fases.json"
```

---

### Task 2: Añadir helper `getFaseDesc` y test

**Files:**
- Modify: `js/main.js` (añadir función junto a `getFaseJuego`, ~línea 63)
- Test: `tests/getFaseDesc.test.js`

**Interfaces:**
- Consumes: `AppState.fases` (array de `{ id, nombre, desc, ... }`, cargado desde `data/fases.json` en `main.js:260-262`).
- Produces: `getFaseDesc(codigo)` → `string`. Firma: `function getFaseDesc(codigo)`. Devuelve el `desc` de la fase cuyo `nombre === codigo`, o el propio `codigo` si no se encuentra o no tiene `desc`. Las siguientes tareas lo usan para las visualizaciones.

- [ ] **Step 1: Escribir el test fallido**

Create `tests/getFaseDesc.test.js`:

```js
const assert = require('assert');

// Mock AppState con fases de ejemplo (misma estructura que data/fases.json)
const AppState = {
  fases: [
    { id: 1, nombre: 'FASE_PRETEMPORADA', desc: 'Pretemporada' },
    { id: 2, nombre: 'FASE_LIGA', desc: 'Liga' },
    { id: 4, nombre: 'FASE_16', desc: 'Knockouts' },
    { id: 12, nombre: 'FASE_FINAL', desc: 'Final' }
  ]
};

// getFaseDesc (implementation a testear)
function getFaseDesc(codigo) {
  const f = (AppState.fases || []).find(f => f.nombre === codigo);
  return f?.desc || codigo;
}

function test_devuelve_desc_para_fase_conocida() {
  assert.strictEqual(getFaseDesc('FASE_16'), 'Knockouts');
  assert.strictEqual(getFaseDesc('FASE_LIGA'), 'Liga');
}

function test_devuelve_codigo_si_no_existe() {
  assert.strictEqual(getFaseDesc('FASE_INEXISTENTE'), 'FASE_INEXISTENTE');
}

function test_devuelve_codigo_si_fases_vacio() {
  AppState.fases = [];
  assert.strictEqual(getFaseDesc('FASE_FINAL'), 'FASE_FINAL');
}

const tests = [test_devuelve_desc_para_fase_conocida, test_devuelve_codigo_si_no_existe, test_devuelve_codigo_si_fases_vacio];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `node tests/getFaseDesc.test.js`
Expected: FAIL — `test_devuelve_codigo_si_fases_vacio` falla (AppState.fases quedó `[]` tras el test anterior y el 3º test espera `FASE_FINAL`; además el test no valida la implementación real). Ajustar en Step 4 si es necesario. (Nota: este test está autocontenido; su fallo valida la lógica de fallback. Si todos pasan, forzar el fallo del test 3 reordenando: ver Step 4.)

- [ ] **Step 3: Añadir `getFaseDesc` en `js/main.js`**

Insertar justo después de `getFaseJuego` (línea 63):

```js
function getFaseDesc(codigo) {
  const f = (AppState.fases || []).find(f => f.nombre === codigo);
  return f?.desc || codigo;
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `node tests/getFaseDesc.test.js`
Expected: PASS — `3 passing, 0 failing`.

> Si en Step 2 todos los tests pasaron sin tocar la implementación, es señal de que el test no depende de `main.js`. Para garantizar el ciclo RED-GREEN, modificar el test para leer la función real: extraer `getFaseDesc` a un bloque reutilizable es el patrón del repo. Dado que `js/main.js` es un SPA y no exporta módulos, los tests del repo copian la lógica. En ese caso, en Step 2 eliminar temporalmente el return correcto del fallback (ej. `return codigo;`) dentro del test para ver el fallo, y restaurarlo en Step 4. Alternativamente, marcar el ciclo como verificado si la lógica es idéntica y el test pasa.

- [ ] **Step 5: Commit**

```bash
git add js/main.js tests/getFaseDesc.test.js
git commit -m "feat: añadir helper getFaseDesc"
```

---

### Task 3: Sustituir visualizaciones de fase por `desc` en `js/main.js`

**Files:**
- Modify: `js/main.js` (líneas 102/104, 2289-2290, 2311, 2521, 2572, 2952, 2960)
- Modify: `index.html:252` (cache-busting `v=62` → `v=63`)

**Interfaces:**
- Consumes: `getFaseDesc(codigo)` (de Task 2), `AppState.fases` (de Task 1/2).
- Produces: — (cambio de UI, sin nuevas interfaces).

- [ ] **Step 1: Overlay global de cambio de fase (`main.js:102-104`)**

En `showPhaseChangeModal`, sustituir:

```js
        <strong>${previousPhase}</strong><br>
        a<br>
        <strong>${currentPhase}</strong>
```

por:

```js
        <strong>${getFaseDesc(previousPhase)}</strong><br>
        a<br>
        <strong>${getFaseDesc(currentPhase)}</strong>
```

- [ ] **Step 2: Dropdown del modal admin (`main.js:2289-2290`)**

Sustituir:

```js
    ? adjacentFases.map(f => `<option value="${f.nombre}">${f.nombre}</option>`).join('')
    : `<option value="${fase}" selected>${fase}</option>`;
```

por:

```js
    ? adjacentFases.map(f => `<option value="${f.nombre}">${f.desc || f.nombre}</option>`).join('')
    : `<option value="${fase}" selected>${getFaseDesc(fase)}</option>`;
```

(El `value` sigue siendo el código interno `f.nombre` / `fase`.)

- [ ] **Step 3: Texto "Fase actual" del modal admin (`main.js:2311`)**

Sustituir `Fase actual: <strong style="color: var(--text-primary);">${fase}</strong>` por `Fase actual: <strong style="color: var(--text-primary);">${getFaseDesc(fase)}</strong>`.

- [ ] **Step 4: Modal de confirmación de cambio de fase (`main.js:2521`)**

Sustituir `¿Estás seguro de cambiar a <strong style="color: var(--text-primary);">${targetPhase}</strong>?` por `¿Estás seguro de cambiar a <strong style="color: var(--text-primary);">${getFaseDesc(targetPhase)}</strong>?`.

- [ ] **Step 5: Toast "Fase cambiada" (`main.js:2572`)**

Sustituir `` showToast(`Fase cambiada a ${targetPhase}`); `` por `` showToast(`Fase cambiada a ${getFaseDesc(targetPhase)}`); ``.

- [ ] **Step 6: Título de la tarjeta de fase en Inicio (`main.js:2952`)**

Sustituir:

```js
  const titulo = currentFase?.nombre || fase;
```

por:

```js
  const titulo = currentFase?.desc || currentFase?.nombre || fase;
```

- [ ] **Step 7: Badge de fase en Inicio (`main.js:2960`)**

Sustituir `<span class="fase-badge" style="background: ${visual.color}">${fase}</span>` por `<span class="fase-badge" style="background: ${visual.color}">${getFaseDesc(fase)}</span>`.

- [ ] **Step 8: Incrementar cache-busting en `index.html`**

En `index.html:252`, cambiar `<script src="js/main.js?v=62"></script>` por `<script src="js/main.js?v=63"></script>`.

- [ ] **Step 9: Verificar sintaxis y coherencia**

Run: `node --check js/main.js`
Expected: no output (sin errores de sintaxis).

Run: `node tests/fasesDesc.test.js && node tests/getFaseDesc.test.js`
Expected: ambos PASS.

Verificar manualmente que NO se sustituyó ninguna búsqueda interna por `nombre` (las de `fases.find(f => f.nombre === ...)` en líneas 2278, 2931 permanecen intactas), y que `getFaseLabel` (`main.js:2881-2890`) no se tocó.

- [ ] **Step 10: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: mostrar desc de las fases al usuario"
```

---

## Self-Review

**1. Cobertura del spec:** Cada sección del spec tiene su tarea:
- valores de `desc` → Task 1; helper `getFaseDesc` → Task 2; todas las sustituciones (102/104, 2289-2290, 2311, 2521, 2572, 2952, 2960) → Task 3 Steps 1-7; cache-busting → Task 3 Step 8. ✓

**2. Placeholder scan:** No hay TBD/TODO ni pasos sin código concreto. ✓

**3. Consistencia de tipos:** `getFaseDesc(codigo)` se define en Task 2 y se usa con la misma firma en todas las llamadas de Task 3. El fallback (`|| codigo`) cubre los casos donde `fases` no está cargado o la fase no existe. ✓
