# Unificar predicciones + finalPredictions + plantillas en `predictions/all` — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las N llamadas `GET /api/final-predictions?username=xxx` y la llamada `GET /api/squad/all` del frontend, convirtiendo `GET /api/predictions/all` en la única fuente de predicciones + finalPredictions + plantillas de todos los usuarios.

**Architecture:** El backend añade `squad` a la respuesta de `GET /api/predictions/all` (que ya incluye `finalPredictions`) y amplía el criterio de inclusión. El frontend extrae el unwrap a una función pura `unwrapAllPredictions(data)` que puebla las 3 cachés (`allPredictions`, `finalPredictionsCache`, `squadsCache`) desde una única respuesta, y se eliminan los bloques de fetch redundantes en `renderClasificacionTab` y `renderResultadosTab`. Los fallbacks individuales se conservan por seguridad.

**Tech Stack:** Node.js (backend `api-porra`, `http` nativo + Mongoose), JS Vanilla ES6 (frontend `porra-spa`), tests Node con `assert`.

## Global Constraints

- Backend y frontend son repos separados: cambios en `api-porra/server.js` y `porra-spa/js/main.js`, `porra-spa/js/apiData.js` (nuevo), `porra-spa/index.html`, `porra-spa/tests/`, y los dos `AGENTS.md`.
- Cache-busting obligatorio (AGENTS.md): al tocar `js/main.js` subir `?v=` en `index.html` (hoy `js/main.js?v=64`).
- Código JS sin comentarios (norma del proyecto). Los comentarios con `//` en los snippets de este plan son descriptivos del cambio y NO deben copiarse al código.
- Privacidad: en `FASE_PRETEMPORADA` `predictions/all` solo devuelve el propio usuario (regla ya existente, no cambiar).
- Tests del repo se ejecutan con `node tests/<archivo>.test.js` (sin framework, patrón con `assert` y runner manual).
- `node --check` para validar sintaxis JS.

---
## Archivos del plan

| Archivo | Cambio |
|---------|--------|
| `api-porra/server.js` | `predictions/all`: proyección + `squad` en respuesta + criterio de inclusión |
| `porra-spa/js/apiData.js` | **Nuevo**: `unwrapAllPredictions(data)` (función pura, patrón IIFE de `eliminatorias.js`) |
| `porra-spa/js/main.js` | `fetchAllPredictions` (3 cachés), eliminar bloques `squad/all` y N `final-predictions`, invalidación de caché |
| `porra-spa/tests/unwrapAllPredictions.test.js` | **Nuevo**: tests de la función pura |
| `porra-spa/index.html` | Cargar `apiData.js` + cache-busting de `main.js` |
| `porra-spa/AGENTS.md`, `api-porra/AGENTS.md` | Documentar nuevo shape de `predictions/all` |

---

### Task 1: Backend — ampliar `GET /api/predictions/all`

**Files:**
- Modify: `api-porra/server.js:1194-1251`

**Interfaces:**
- Consumes: (nada)
- Produces: Respuesta `GET /api/predictions/all` → `{ ok, predictions: { username: { predictions, finalPredictions, squad } } }`, incluyendo usuarios con solo plantilla o solo finalPredictions.

- [ ] **Step 1: Modificar la proyección del `User.find`**

En `api-porra/server.js`, dentro de `GET /api/predictions/all`, añadir `squad` a las dos ramas del `User.find`:

```js
      if (isPublic || !auth.ok) {
        query = User.find({}, 'username predictions finalPredictions squad');
      } else {
        query = User.find({ username: auth.username }, 'username predictions finalPredictions squad');
      }
```

- [ ] **Step 2: Ampliar el criterio de inclusión y añadir `squad` al objeto**

Reemplazar el bloque del bucle `for (const user of users)` actual (líneas 1225-1245) por:

```js
      const predictions = {};
      for (const user of users) {
        let userPredictions = user.predictions || {};
        if (hiddenFase && matchFaseMap && auth.ok && user.username !== auth.username) {
          userPredictions = {};
          for (const [eventId, pred] of Object.entries(user.predictions || {})) {
            if (matchFaseMap[eventId] !== hiddenFase) {
              userPredictions[eventId] = pred;
            }
          }
        }
        const hasPredictions = Object.keys(userPredictions).length > 0;
        const hasFinal = user.finalPredictions && Object.keys(user.finalPredictions).length > 0;
        const hasSquad = Array.isArray(user.squad) && user.squad.length > 0;
        if (hasPredictions || hasFinal || hasSquad) {
          predictions[user.username] = {
            predictions: userPredictions,
            finalPredictions: user.finalPredictions || null,
            squad: user.squad || null
          };
        }
      }
```

Mantener intacto el resto (construcción de `matchFaseMap`, `sendJson`, catch).

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check server.js` en `api-porra`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: predictions/all incluye finalPredictions y plantillas de todos los usuarios"
```

---

### Task 2: Frontend — crear `js/apiData.js` con `unwrapAllPredictions` + tests

**Files:**
- Create: `porra-spa/js/apiData.js`
- Test: `porra-spa/tests/unwrapAllPredictions.test.js`

**Interfaces:**
- Consumes: (nada)
- Produces: `unwrapAllPredictions(data)` → `{ allPredictions, finalPredictionsCache, squadsCache }`. Expuesta en `window` y exportada con `module.exports` (patrón IIFE de `js/eliminatorias.js`).

- [ ] **Step 1: Escribir el test que falla**

Crear `porra-spa/tests/unwrapAllPredictions.test.js`:

```js
const assert = require('assert');
const { unwrapAllPredictions } = require('../js/apiData.js');

function test_unwrap_completo() {
  const data = {
    predictions: {
      juan: {
        predictions: { '1': { home: 2, away: 1 } },
        finalPredictions: { champion: 42 },
        squad: [{ id: 1, nombre: 'A' }]
      },
      maria: {
        predictions: { '2': { home: 0, away: 0 } },
        finalPredictions: null,
        squad: null
      },
      pedro: {
        predictions: {},
        finalPredictions: null,
        squad: [{ id: 2, nombre: 'B' }]
      }
    }
  };
  const r = unwrapAllPredictions(data);
  assert.deepStrictEqual(r.allPredictions, {
    juan: { '1': { home: 2, away: 1 } },
    maria: { '2': { home: 0, away: 0 } },
    pedro: {}
  });
  assert.deepStrictEqual(r.finalPredictionsCache, {
    juan: { champion: 42 },
    maria: null,
    pedro: null
  });
  assert.deepStrictEqual(r.squadsCache, {
    juan: [{ id: 1, nombre: 'A' }],
    pedro: [{ id: 2, nombre: 'B' }]
  });
}

function test_unwrap_vacio() {
  const r = unwrapAllPredictions({ predictions: {} });
  assert.deepStrictEqual(r, { allPredictions: {}, finalPredictionsCache: {}, squadsCache: {} });
}

function test_unwrap_sin_data() {
  assert.deepStrictEqual(unwrapAllPredictions(undefined), { allPredictions: {}, finalPredictionsCache: {}, squadsCache: {} });
}

const tests = [test_unwrap_completo, test_unwrap_vacio, test_unwrap_sin_data];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `node tests/unwrapAllPredictions.test.js` en `porra-spa`
Expected: FAIL con `Cannot find module '../js/apiData.js'`

- [ ] **Step 3: Implementar `js/apiData.js`**

Crear `porra-spa/js/apiData.js`:

```js
(function (global) {
  function unwrapAllPredictions(data) {
    const allPredictions = {};
    const finalPredictionsCache = {};
    const squadsCache = {};
    const entries = (data && data.predictions) ? Object.entries(data.predictions) : [];
    for (const [username, userData] of entries) {
      allPredictions[username] = userData.predictions || {};
      finalPredictionsCache[username] = userData.finalPredictions || null;
      if (Array.isArray(userData.squad) && userData.squad.length > 0) {
        squadsCache[username] = userData.squad;
      }
    }
    return { allPredictions, finalPredictionsCache, squadsCache };
  }

  global.unwrapAllPredictions = unwrapAllPredictions;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { unwrapAllPredictions };
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `node tests/unwrapAllPredictions.test.js` en `porra-spa`
Expected: `3 passing, 0 failing`

- [ ] **Step 5: Commit**

```bash
git add js/apiData.js tests/unwrapAllPredictions.test.js
git commit -m "feat: helper unwrapAllPredictions para poblar cachés desde predictions/all"
```

---

### Task 3: Frontend — `fetchAllPredictions` puebla las 3 cachés

**Files:**
- Modify: `porra-spa/js/main.js:514-533`

**Interfaces:**
- Consumes: `unwrapAllPredictions(data)` (Task 2)
- Produces: `AppState.allPredictions`, `AppState.finalPredictionsCache` (+ `AppState._finalPredictionsCacheTime` por usuario) y `AppState.squadsCache` poblados tras la llamada.

- [ ] **Step 1: Reescribir `fetchAllPredictions`**

En `porra-spa/js/main.js`, reemplazar el cuerpo de `fetchAllPredictions` (líneas 514-533) por:

```js
async function fetchAllPredictions() {
  if (AppState._allPredictionsTime && Date.now() - AppState._allPredictionsTime < CACHE_TTL) {
    return;
  }
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/predictions/all`, { headers: authHeaders() });
    const data = await res.json();
    if (data.ok && data.predictions) {
      const { allPredictions, finalPredictionsCache, squadsCache } = unwrapAllPredictions(data);
      AppState.allPredictions = allPredictions;
      if (!AppState.finalPredictionsCache) AppState.finalPredictionsCache = {};
      Object.assign(AppState.finalPredictionsCache, finalPredictionsCache);
      if (!AppState.squadsCache) AppState.squadsCache = {};
      Object.assign(AppState.squadsCache, squadsCache);
      if (!AppState._finalPredictionsCacheTime) AppState._finalPredictionsCacheTime = {};
      const now = Date.now();
      for (const username of Object.keys(finalPredictionsCache)) {
        AppState._finalPredictionsCacheTime[username] = now;
      }
      AppState._allPredictionsTime = now;
    }
  } catch (e) {
    console.error('Error cargando todas las predicciones:', e);
  }
}
```

> `unwrapAllPredictions` es global (`window.unwrapAllPredictions` cargado por `apiData.js` antes de `main.js`); no hay import. `AppState._allPredictionsTime` es propiedad dinámica (igual que hoy).

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check js/main.js` en `porra-spa`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: fetchAllPredictions puebla finalPredictionsCache y squadsCache"
```

---

### Task 4: Frontend — eliminar bloques redundantes en Clasificación y Resultados

**Files:**
- Modify: `porra-spa/js/main.js:899-909` (bloque `squad/all`), `:919` (Promise.all final-predictions), `:1537-1547` (bloque `squad/all` en Resultados)

**Interfaces:**
- Consumes: cachés pobladas por Task 3
- Produces: (nada nuevo)

> **IMPORTANTE**: NO tocar ni eliminar `fetchFinalPredictionsForUser` (`js/main.js:5649`) ni el fetch individual de `renderSquadTab` (`js/main.js:1230`) — se conservan como respaldo por si la caché no está poblada.

- [ ] **Step 1: Eliminar el bloque `squad/all` de `renderClasificacionTab`**

En `porra-spa/js/main.js`, eliminar las líneas 899-909 (el bloque comentado "// Obtener todas las plantillas en una sola petición (con caché)" y su `if`/`try`/`catch`).

Verificación tras eliminar: `AppState.squadsCache?.[p.name]` (línea ~927) y `AppState.finalPredictionsCache[p.name]` (línea ~942) siguen presentes y sin cambios.

- [ ] **Step 2: Eliminar el `Promise.all` de final-predictions de `renderClasificacionTab`**

En `renderClasificacionTab` (líneas 917-919) se debe eliminar el comentario (917) y la línea del `Promise.all` (919), **manteniendo** la línea 918:

```js
  // Precargar finalPredictions de todos los usuarios (con caché) para puntos de eliminatorias   ← ELIMINAR
  const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);             ← CONSERVAR
  await Promise.all(players.map(p => fetchFinalPredictionsForUser(p.name)));                     ← ELIMINAR
```

`computeReachedPhases` sigue usándose más abajo para calcular `eliminatoriasPoints` en el map de `playersWithPoints`.

- [ ] **Step 3: Eliminar el bloque `squad/all` de `renderResultadosTab`**

En `porra-spa/js/main.js`, eliminar las líneas 1537-1547 (el bloque "// Precargar plantillas de todos los usuarios (una sola petición, con caché)" y su `if`/`try`/`catch`). `fetchAllPredictions` (línea 1530) ya puebla `squadsCache`.

- [ ] **Step 4: Verificar que no quedan referencias rotas**

Run: `node --check js/main.js` en `porra-spa`
Expected: sin errores

Run: `grep -n "squad/all" js/main.js` en `porra-spa`
Expected: sin resultados (no debe quedar ninguna llamada a `squad/all`)

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "refactor: eliminar llamadas squad/all y final-predictions por usuario de Clasificación y Resultados"
```

---

### Task 5: Frontend — invalidación de caché al guardar datos propios

**Files:**
- Modify: `porra-spa/js/main.js:4132-4134` (`saveSquadToBackend`), `:5608-5610` (`saveFinalPredictionsToBackend`)

**Interfaces:**
- Consumes: (nada)
- Produces: `_allPredictionsTime` reset a 0 tras guardar plantilla o finalPredictions; `finalPredictionsCache[currentUser]` actualizado tras guardar finalPredictions.

- [ ] **Step 1: Invalidar `_allPredictionsTime` al guardar plantilla**

En `saveSquadToBackend` (`js/main.js:4132-4134`), tras `AppState._squadsCacheTime = 0;` añadir:

```js
      AppState._allPredictionsTime = 0;
```

- [ ] **Step 2: Invalidar caché al guardar finalPredictions**

En `saveFinalPredictionsToBackend` (`js/main.js:5608-5610`), dentro del `if (data.ok)`, tras `AppState.hasUnsavedFinalChanges = false;` añadir:

```js
      if (AppState.currentUser) {
        if (!AppState.finalPredictionsCache) AppState.finalPredictionsCache = {};
        AppState.finalPredictionsCache[AppState.currentUser.name] = AppState.finalPredictions;
        if (!AppState._finalPredictionsCacheTime) AppState._finalPredictionsCacheTime = {};
        AppState._finalPredictionsCacheTime[AppState.currentUser.name] = Date.now();
      }
      AppState._allPredictionsTime = 0;
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/main.js` en `porra-spa`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: invalidar caché de predictions/all al guardar plantilla o finalPredictions"
```

---

### Task 6: Frontend — cargar `apiData.js` y cache-busting

**Files:**
- Modify: `porra-spa/index.html`

**Interfaces:**
- Consumes: (nada)
- Produces: `js/apiData.js` cargado antes de `js/main.js`; `main.js?v=65`.

- [ ] **Step 1: Añadir `<script>` de `apiData.js` y subir versión de `main.js`**

En `porra-spa/index.html`, reemplazar las líneas 251-252:

```html
  <script src="js/eliminatorias.js?v=1"></script>
  <script src="js/main.js?v=64"></script>
```

por:

```html
  <script src="js/eliminatorias.js?v=1"></script>
  <script src="js/apiData.js?v=1"></script>
  <script src="js/main.js?v=65"></script>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting main.js v65 y cargar apiData.js"
```

---

### Task 7: Documentación — actualizar AGENTS.md (SPA y backend)

**Files:**
- Modify: `porra-spa/AGENTS.md` y `api-porra/AGENTS.md`

**Interfaces:**
- Consumes: (nada)
- Produces: documentación consistente con el nuevo shape.

- [ ] **Step 1: Actualizar `api-porra/AGENTS.md`**

En `api-porra/AGENTS.md`, en la sección de la tabla de endpoints, cambiar la fila de `GET /api/predictions/all` para indicar que devuelve `{ predictions, finalPredictions, squad }` por usuario. Localizar la sección "Respuesta Predictions All" y actualizar el JSON de ejemplo:

```json
{
  "ok": true,
  "predictions": {
    "juan123": {
      "predictions": {
        "14566909": { "home": 2, "away": 1 }
      },
      "finalPredictions": {
        "champion": 42
      },
      "squad": [
        { "id": 804508, "nombre": "Viktor Gyökeres", "posicion": "F", "club": "Arsenal", "equipo": 42 }
      ]
    }
  }
}
```

- [ ] **Step 2: Actualizar `porra-spa/AGENTS.md`**

En `porra-spa/AGENTS.md`, en el bloque de la API (sección 5.1, alrededor de la línea 231), actualizar el comentario de `GET /api/predictions/all`:

```js
GET  /api/predictions/all        // Post-freeze: todos (predictions + finalPredictions + squad). Pre-freeze: solo propio
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: actualizar shape de predictions/all en AGENTS.md"
```

---

### Task 8: Verificación final

**Files:**
- (ninguno)

- [ ] **Step 1: Ejecutar todos los tests del frontend**

Run (en `porra-spa`): `for f in tests/*.test.js; do echo "== $f =="; node "$f" || exit 1; done`
Expected: todos pasan, incluido `unwrapAllPredictions.test.js`

- [ ] **Step 2: Ejecutar `node --check` en ambos repos**

Run: `node --check js/main.js && node --check js/apiData.js` (en `porra-spa`)
Run: `node --check server.js` (en `api-porra`)
Expected: sin errores

- [ ] **Step 3: Verificación manual (usuario)**

- Abrir Clasificación y confirmar en la pestaña Network que NO se hacen llamadas a `final-predictions?username=` ni a `squad/all` (solo `predictions/all`).
- Confirmar que los puntos desglosados (pronósticos + plantilla + clasificación + eliminatorias) aparecen igual que antes.
- Abrir el perfil de un usuario → tabs Pronósticos, Plantilla y Eliminatorias funcionan.
- Guardar plantilla y finalPredictions y volver a Clasificación: los datos propios actualizados se ven.
