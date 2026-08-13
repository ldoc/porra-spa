# Validación de grupos de posiciones en Eliminatorias — Implementación (porra-spa)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la validación de equipos en las cajas de Eliminatorias para que el límite de 2 equipos por grupo de posiciones (A-D) se aplique al conjunto de cajas fuera de dieciseisavos, no por caja individual.

**Architecture:** Se extrae un validador puro y testeable `getFinalPredictionsViolations` en `js/eliminatorias.js` (patrón IIFE + `module.exports` ya usado por los tests del repo). `addTeamToZone` (en `js/main.js`) lo usa validando una copia provisional de `finalPredictions` con el equipo candidato ya colocado. Se actualiza AGENTS.md para aclarar la regla.

**Tech Stack:** JavaScript ES6+ vanilla (SPA sin build). Tests con `node` + `assert` + mini-runner (patrón `tests/eliminatorias.test.js`).

## Global Constraints

- TDD en cada tarea: test que falla → implementación mínima → test que pasa → commit.
- Cache-busting (norma AGENTS.md): al modificar `js/main.js` o `js/eliminatorias.js` hay que incrementar su `v=X` en `index.html`.
- Los tests se ejecutan desde la raíz del repo: `node tests/<archivo>.test.js`.
- Respetar el estilo del módulo: IIFE `(function (global) {...})(typeof window !== 'undefined' ? window : globalThis)`, export por `global` y `module.exports`, JSDoc en español en cada función.
- No introducir librerías ni frameworks.

---
### Task 1: Validador puro `getFinalPredictionsViolations` en `js/eliminatorias.js`

**Files:**
- Create: `tests/finalPredictionsValidation.test.js`
- Modify: `js/eliminatorias.js` (añadir función antes de los exports, líneas 213-221)

**Interfaces:**
- Produces: `getFinalPredictionsViolations(finalPredictions, teamPositionMap) → Array<string>`. `finalPredictions` es `{ champion, runnerUp, semiFinalists, quarterFinalists, roundOf16, roundOf32 }` (los single pueden ser `null`; los arrays pueden tener placeholders falsy). `teamPositionMap` es `Map<teamId, posicion>` con posiciones 1-24. Devuelve `[]` si es válido, o los mensajes de las violaciones.

- [ ] **Step 1: Write the failing test**

Create `tests/finalPredictionsValidation.test.js`:

```js
const assert = require('assert');
const { getFinalPredictionsViolations } = require('../js/eliminatorias.js');

// teamId == posición para simplificar los tests (mapa 1..24)
function posMap() {
  const map = new Map();
  for (let i = 1; i <= 24; i++) map.set(i, i);
  return map;
}

const fp = (over) => Object.assign(
  { champion: null, runnerUp: null, semiFinalists: [], quarterFinalists: [], roundOf16: [], roundOf32: [] },
  over
);

function test_valido_grupo_a_repartido_2_y_2() {
  // 9, 23 en dieciseisavos; 10 (campeón) y 24 (subcampeón) fuera → grupo A = 2/2
  assert.deepStrictEqual(
    getFinalPredictionsViolations(fp({ champion: 10, runnerUp: 24, roundOf32: [9, 23] }), posMap()),
    []
  );
}

function test_invalido_ejemplo_reportado_3_del_grupo_a_fuera() {
  // 23 en cuartos, 24 en semis, 10 en octavos → 3 del grupo A fuera de dieciseisavos
  const v = getFinalPredictionsViolations(
    fp({ semiFinalists: [24], quarterFinalists: [23], roundOf16: [10], roundOf32: [9] }),
    posMap()
  );
  assert.strictEqual(v.length, 1);
  assert.ok(v[0].includes('fuera de dieciseisavos'));
}

function test_invalido_3_del_mismo_grupo_en_dieciseisavos() {
  const v = getFinalPredictionsViolations(fp({ roundOf32: [9, 10, 23] }), posMap());
  assert.strictEqual(v.length, 1);
  assert.ok(v[0].includes('dieciseisavos'));
}

function test_valido_parcial_2_fuera_y_1_sin_colocar() {
  assert.deepStrictEqual(
    getFinalPredictionsViolations(fp({ quarterFinalists: [23], roundOf16: [10], roundOf32: [9] }), posMap()),
    []
  );
}

function test_limite_2_en_resto_ok_y_3_error() {
  const ok = fp({ quarterFinalists: [], roundOf16: [10, 23], roundOf32: [9, 24] });
  assert.deepStrictEqual(getFinalPredictionsViolations(ok, posMap()), []);

  const bad = fp({ quarterFinalists: [23], roundOf16: [10, 24], roundOf32: [9] });
  assert.strictEqual(getFinalPredictionsViolations(bad, posMap()).length, 1);
}

function test_grupos_b_c_d_respetan_sus_limites() {
  // Todos los grupos al límite 2/2: 2 en dieciseisavos + 2 fuera; top-8 (1-8) en octavos
  const ok = fp({
    champion: 23, runnerUp: 24,
    semiFinalists: [21, 22], quarterFinalists: [19, 20],
    roundOf16: [17, 18, 1, 2, 3, 4, 5, 6],
    roundOf32: [9, 10, 11, 12, 13, 14, 15, 16]
  });
  assert.deepStrictEqual(getFinalPredictionsViolations(ok, posMap()), []);
}

function test_arrays_con_placeholders_falsy_no_cuentan() {
  // nulls en arrays no cuentan como equipos colocados
  const v = getFinalPredictionsViolations(
    fp({ roundOf16: [null, 10], roundOf32: [9, null, 23] }),
    posMap()
  );
  assert.deepStrictEqual(v, []);
}

const tests = [
  test_valido_grupo_a_repartido_2_y_2,
  test_invalido_ejemplo_reportado_3_del_grupo_a_fuera,
  test_invalido_3_del_mismo_grupo_en_dieciseisavos,
  test_valido_parcial_2_fuera_y_1_sin_colocar,
  test_limite_2_en_resto_ok_y_3_error,
  test_grupos_b_c_d_respetan_sus_limites,
  test_arrays_con_placeholders_falsy_no_cuentan
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/finalPredictionsValidation.test.js`
Expected: FAIL con `TypeError: getFinalPredictionsViolations is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `js/eliminatorias.js`, insertar antes de los exports (línea 213):

```js
  const POSITION_GROUPS = {
    A: [9, 10, 23, 24],
    B: [11, 12, 21, 22],
    C: [13, 14, 19, 20],
    D: [15, 16, 17, 18]
  };
  const MAX_TEAMS_PER_GROUP = 2;

  /**
   * Devuelve las violaciones de colocación en el cuadro de eliminatorias.
   * Grupos de posiciones A-D: máximo 2 por grupo en dieciseisavos y máximo 2
   * por grupo en el CONJUNTO de cajas fuera de dieciseisavos (campeón,
   * subcampeón, semifinalistas, cuartos y octavos combinadas).
   * @param {Object} finalPredictions - { champion, runnerUp, semiFinalists, quarterFinalists, roundOf16, roundOf32 }
   * @param {Map<number,number>} teamPositionMap - teamId -> posición pronosticada (1-24)
   * @returns {Array<string>} Mensajes de violación (vacío = válido)
   */
  function getFinalPredictionsViolations(finalPredictions, teamPositionMap) {
    const fp = finalPredictions || {};
    const violations = [];

    const countGroupIn = (teamIds, positions) => (teamIds || [])
      .filter(id => {
        const pos = teamPositionMap.get(id);
        return pos && positions.includes(pos);
      })
      .length;

    const restTeams = [
      ...(fp.champion ? [fp.champion] : []),
      ...(fp.runnerUp ? [fp.runnerUp] : []),
      ...(fp.semiFinalists || []),
      ...(fp.quarterFinalists || []),
      ...(fp.roundOf16 || [])
    ];

    for (const positions of Object.values(POSITION_GROUPS)) {
      if (countGroupIn(fp.roundOf32, positions) > MAX_TEAMS_PER_GROUP) {
        violations.push(`Máximo ${MAX_TEAMS_PER_GROUP} equipos de posiciones ${positions.join(',')} en dieciseisavos.`);
      }
      if (countGroupIn(restTeams, positions) > MAX_TEAMS_PER_GROUP) {
        violations.push(`Máximo ${MAX_TEAMS_PER_GROUP} equipos de posiciones ${positions.join(',')} en el conjunto de cajas fuera de dieciseisavos.`);
      }
    }

    return violations;
  }
```

Y añadir a los exports (líneas 213-221):

```js
  global.getFinalPredictionsViolations = getFinalPredictionsViolations;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner, getFinalPredictionsViolations };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/finalPredictionsValidation.test.js`
Expected: `7 passing, 0 failing`.

- [ ] **Step 5: Run existing suite (no regresiones en eliminatorias.js)**

Run: `node tests/eliminatorias.test.js`
Expected: `19 passing, 0 failing`.

- [ ] **Step 6: Commit**

```bash
git add js/eliminatorias.js tests/finalPredictionsValidation.test.js
git commit -m "feat: validador de grupos de posiciones en eliminatorias (2 por grupo en el conjunto fuera de dieciseisavos)"
```

---
### Task 2: Usar el validador en `addTeamToZone` y cache-busting

**Files:**
- Modify: `js/main.js:5514-5571` (bloque de validación de grupos en `addTeamToZone`)
- Modify: `index.html:251-253` (bump de versiones)
- Test: `tests/eliminatorias.test.js` (regresión) y `tests/finalPredictionsValidation.test.js` (sin cambios)

**Interfaces:**
- Consumes: `getFinalPredictionsViolations(finalPredictions, teamPositionMap)` de `js/eliminatorias.js` (global, disponible porque se carga antes de `main.js`).
- Produces: `addTeamToZone` refactorizado y helper nuevo `cloneFinalPredictions(fp)`.

- [ ] **Step 1: Reemplazar el bloque de validación de grupos en `addTeamToZone`**

En `js/main.js`, dentro de `addTeamToZone` (función en las líneas 5504-5594), reemplazar el bloque desde `// Validación: restricciones por grupos de posiciones` (línea 5514) hasta el cierre del `if (standings && standings.length >= 24) { ... }` (línea 5571) por:

```js
  // Validación: restricciones por grupos de posiciones (validador puro, copia provisional)
  const standings = calculatePredictedStandings();
  if (standings && standings.length >= 24) {
    const teamPositionMap = new Map();
    standings.forEach(team => {
      teamPositionMap.set(team.teamId, team.position);
    });

    const trial = cloneFinalPredictions(fp);
    if (zoneId === 'champion') {
      trial.champion = teamId;
    } else if (zoneId === 'runnerUp') {
      trial.runnerUp = teamId;
    } else {
      const arr = trial[zoneId];
      if (Array.isArray(arr)) {
        if (index < arr.length) {
          arr[index] = teamId;
        } else {
          arr.push(teamId);
        }
      }
    }

    const violations = getFinalPredictionsViolations(trial, teamPositionMap);
    if (violations.length > 0) {
      showToast(violations[0]);
      return;
    }
  }
```

El check Top-8 de la línea 5509 (`if (zoneId === 'roundOf32' && isTop8Predicted(teamId))`) y la lógica de aplicar el cambio (líneas 5573-5594) se mantienen intactos.

- [ ] **Step 2: Añadir el helper `cloneFinalPredictions`**

Justo antes de `addTeamToZone` (línea 5504), añadir:

```js
/** Copia profunda (1 nivel) de finalPredictions para validar sin mutar el estado */
function cloneFinalPredictions(fp) {
  return {
    champion: fp.champion,
    runnerUp: fp.runnerUp,
    semiFinalists: [...(fp.semiFinalists || [])],
    quarterFinalists: [...(fp.quarterFinalists || [])],
    roundOf16: [...(fp.roundOf16 || [])],
    roundOf32: [...(fp.roundOf32 || [])]
  };
}
```

- [ ] **Step 3: Cache-busting en `index.html`**

En `index.html` (líneas 251-253):
- `<script src="js/eliminatorias.js?v=2"></script>` → `v=3`
- `<script src="js/main.js?v=72"></script>` → `v=73`

- [ ] **Step 4: Ejecutar tests (regresión)**

Run: `node tests/finalPredictionsValidation.test.js && node tests/eliminatorias.test.js`
Expected: ambos sin fallos.

- [ ] **Step 5: Verificación manual (navegador)**

En el navegador, pestaña Pronósticos → Eliminatorias, con los 144 pronósticos confirmados:
1. Colocar el 10 en octavos, el 23 en cuartos y el 24 en semifinales (del grupo A) → el tercero debe bloquearse con tostada "Máximo 2 equipos de posiciones 9,10,23,24 en el conjunto de cajas fuera de dieciseisavos."
2. Colocar 3 equipos del mismo grupo en dieciseisavos → bloqueo con tostada de dieciseisavos.
3. Guardar → el backend acepta un cuadro válido (ver Task 2 de api-porra).

- [ ] **Step 6: Commit**

```bash
git add js/main.js index.html
git commit -m "fix: usar validador de grupos en addTeamToZone (conjunto de cajas fuera de dieciseisavos)"
```

---
### Task 3: Aclarar la regla en AGENTS.md

**Files:**
- Modify: `AGENTS.md:1053-1074`

- [ ] **Step 1: Reescribir la restricción 7**

Reemplazar la sección `7. **Restricciones por grupos de posiciones**` (líneas 1053-1074) por:

```markdown
7. **Restricciones por grupos de posiciones**: Para limitar la concentración de equipos de ciertos rangos en una misma ronda, se aplican los siguientes límites máximos (2 equipos por grupo):

   **En la caja de DIECISEISAVOS (roundOf32):**
   - Máximo 2 equipos de los que acabaron en posiciones 9, 10, 23 y 24
   - Máximo 2 equipos de los que acabaron en posiciones 11, 12, 21 y 22
   - Máximo 2 equipos de los que acabaron en posiciones 13, 14, 19 y 20
   - Máximo 2 equipos de los que acabaron en posiciones 15, 16, 17 y 18

   **En el conjunto de las cajas fuera de dieciseisavos (campeón, subcampeón, semifinalistas, cuartos y octavos combinadas):**
   - Máximo 2 equipos de los que acabaron en posiciones 9, 10, 23 y 24
   - Máximo 2 equipos de los que acabaron en posiciones 11, 12, 21 y 22
   - Máximo 2 equipos de los que acabaron en posiciones 13, 14, 19 y 20
   - Máximo 2 equipos de los que acabaron en posiciones 15, 16, 17 y 18

   > El límite de las cajas fuera de dieciseisavos se aplica al CONJUNTO de todas ellas (no por caja individual). Ejemplo: con los equipos de posiciones 9, 10, 23 y 24, no se puede poner el 23 en cuartos, el 24 en semifinales y el 10 en octavos; 2 de ellos deben ir obligatoriamente a dieciseisavos.

   **Grupos de restricción:**
   | Grupo | Posiciones |
   |-------|------------|
   | A | 9, 10, 23, 24 |
   | B | 11, 12, 21, 22 |
   | C | 13, 14, 19, 20 |
   | D | 15, 16, 17, 18 |
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: aclarar regla de grupos en eliminatorias (2 por grupo en el conjunto fuera de dieciseisavos)"
```

---
## Criterios de aceptación

- `node tests/finalPredictionsValidation.test.js` → `7 passing, 0 failing`.
- `node tests/eliminatorias.test.js` → `19 passing, 0 failing`.
- El ejemplo reportado (23 en cuartos, 24 en semis, 10 en octavos) se bloquea en el tap y el backend lo rechaza.
- `index.html` apunta a `eliminatorias.js?v=3` y `main.js?v=73`.
