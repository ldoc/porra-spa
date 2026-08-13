# Diseño: Unificar predicciones + finalPredictions + plantillas en una única llamada `predictions/all`

**Fecha:** 2026-08-13
**Repositorios:** `porra-spa` (frontend SPA) + `api-porra` (backend)

## 1. Problema

En la pestaña **Clasificación** (`renderClasificacionTab`, `js/main.js:860`) se necesitan las predicciones, las `finalPredictions` y las plantillas de **todos** los usuarios para calcular los puntos reales.

Hoy se obtienen en **varias llamadas**:

1. `GET /api/predictions/all` → predicciones de partidos de todos (via `fetchAllPredictions`, `js/main.js:514`).
2. `GET /api/squad/all` → plantillas de todos (bloque inline en `renderClasificacionTab`, `js/main.js:900-909`, y duplicado en `renderResultadosTab`, `js/main.js:1537-1547`).
3. `GET /api/final-predictions?username=xxx` → **una llamada por usuario** (`fetchFinalPredictionsForUser`, `js/main.js:5649`), lanzada en paralelo con `Promise.all` (`js/main.js:919`). Con 30 usuarios son 30 peticiones.

Además, el backend **ya devuelve** `finalPredictions` embebidas en `predictions/all` (`api-porra/server.js:1239-1242`), pero `fetchAllPredictions` lo descarta (`js/main.js:522-527`): se piden dos veces los mismos datos.

## 2. Solución

**Opción 2 aprobada por el usuario**: convertir `GET /api/predictions/all` en la **única** fuente de predicciones + finalPredictions + plantillas de todos los usuarios, y eliminar las llamadas redundantes (`squad/all` y las N de `final-predictions`) del frontend.

## 3. Cambios en backend (`api-porra/server.js`)

Endpoint `GET /api/predictions/all` (líneas 1194-1251):

### 3.1. Incluir `squad` en la proyección

```js
// Antes
query = User.find({}, 'username predictions finalPredictions');
// Después
query = User.find({}, 'username predictions finalPredictions squad');
```

Idéntico en la rama pre-temporada (solo el propio usuario).

### 3.2. Añadir `squad` al objeto por usuario

```js
predictions[user.username] = {
  predictions: userPredictions,
  finalPredictions: user.finalPredictions || null,
  squad: user.squad || null
};
```

### 3.3. Ampliar el criterio de inclusión

Hoy un usuario solo entra en `predictions` si tiene predicciones (`if (user.predictions && Object.keys(user.predictions).length > 0)`). Con el merge, un usuario con plantilla pero sin predicciones **debe** aparecer también (si no, se pierden sus puntos de plantilla en la clasificación y se rompe el perfil).

Nuevo criterio: incluir si cumple **cualquiera** de:

- `predictions` no vacío (tras el filtrado de `hiddenFase`)
- `finalPredictions` no nulo
- `squad` no vacío

> Nota: al filtrar `hiddenFase` las predicciones de otros pueden quedar vacías para la fase oculta; un usuario con plantilla o finalPredictions en esa situación debe seguir apareciendo.

### 3.4. Privacidad (sin cambios)

En `FASE_PRETEMPORADA` con auth solo se devuelve el propio usuario, misma regla que ya aplica `squad/all`. El filtrado de `hiddenFase` sigue afectando solo a `predictions`, no a `squad` ni `finalPredictions` (igual que hoy).

## 4. Cambios en frontend (`porra-spa/js/main.js`)

### 4.1. `fetchAllPredictions` (`js/main.js:514`) → poblar las 3 cachés

Al recibir `data.predictions` (mapa `username → { predictions, finalPredictions, squad }`), poblar:

```js
AppState.allPredictions[user] = userData.predictions || {};
AppState.finalPredictionsCache[user] = userData.finalPredictions || null;
AppState._finalPredictionsCacheTime[user] = Date.now(); // ver nota de caché
if (userData.squad && userData.squad.length) {
  AppState.squadsCache[user] = userData.squad;
}
```

> **Nota de caché**: `fetchFinalPredictionsForUser` (`js/main.js:5649`) solo reutiliza `finalPredictionsCache` si `_finalPredictionsCacheTime[username]` está fresco (`< CACHE_TTL`). Al poblar desde `predictions/all` hay que actualizar ese timestamp por usuario; si no, la función caería al fetch individual de respaldo y no se eliminarían las llamadas.

Extraer el unwrap a una **función pura** `unwrapAllPredictions(data)` (devuelve `{ allPredictions, finalPredictionsCache, squadsCache }`) para poder testearla y reutilizarla. La función **no** toca timestamps: `fetchAllPredictions` aplica la función y luego asigna los cachés + `_finalPredictionsCacheTime` en `AppState`.

> `finalPredictionsCache` ya existe en `AppState` (`js/main.js:47`). Se respeta la caché global de 30s (`CACHE_TTL`) existente: `_allPredictionsTime`.

### 4.2. `renderClasificacionTab` (`js/main.js:860`)

- **Eliminar** el bloque inline de `squad/all` (`js/main.js:899-909`). Las plantillas ya vienen en `fetchAllPredictions` (ya llamado en `js/main.js:866`).
- **Eliminar** `await Promise.all(players.map(p => fetchFinalPredictionsForUser(p.name)))` (`js/main.js:919`). Las `finalPredictionsCache` ya se poblan en `fetchAllPredictions`.
- El resto del código (`AppState.squadsCache?.[p.name]`, `AppState.finalPredictionsCache[p.name]`) se mantiene igual; solo lee de cachés ya pobladas.

### 4.3. `renderResultadosTab` (`js/main.js:1519`)

- **Eliminar** el bloque inline de `squad/all` (`js/main.js:1537-1547`). `fetchAllPredictions` ya está llamado (`js/main.js:1530`).

### 4.4. Fallbacks conservados (seguridad)

- `fetchFinalPredictionsForUser(username)` (`js/main.js:5649`) mantiene su lógica: lee de `finalPredictionsCache` si está fresca; si no, hace la llamada individual como respaldo. Tras el merge casi siempre acertará en caché.
- `renderSquadTab` (`js/main.js:1216`) mantiene su fetch individual `GET /api/squad?username=` como respaldo si la plantilla no está en `squadsCache`.

### 4.5. Invalidación de caché

Para que tras guardar datos propios la siguiente visita a Clasificación recargue todo en **una** llamada:

- Tras guardar plantilla (`saveSquadToBackend`, `js/main.js:4132-4134`): además de actualizar `squadsCache[currentUser]`, poner `AppState._allPredictionsTime = 0` (hoy solo resetea `_squadsCacheTime`).
- Tras guardar finalPredictions (`saveFinalPredictionsToBackend`, `js/main.js:5583`): actualizar `finalPredictionsCache[currentUser]` + su timestamp y poner `AppState._allPredictionsTime = 0`.

## 5. Cache-busting y docs

- `index.html`: subir `js/main.js?v=` (obligatorio según `AGENTS.md`). No se toca `css/styles.css`.
- Actualizar `porra-spa/AGENTS.md` y `api-porra/AGENTS.md`: shape de `GET /api/predictions/all` ahora incluye `squad` por usuario; `squad/all` deja de ser necesario en el flujo de clasificación/resultados.

## 6. Verificación

- Tests unitarios nuevos en `porra-spa/tests` para `unwrapAllPredictions`:
  - Unwrap correcto de las 3 cachés a partir de una respuesta de `predictions/all`.
  - Usuario con solo `predictions` (sin squad/finalPredictions).
  - Usuario con solo `squad`.
  - Usuario con `finalPredictions: null` → `null` en `finalPredictionsCache`.
- `node --check js/main.js`.
- Verificación manual (usuario): Clasificación muestra puntos de pronósticos + plantilla + clasificación + eliminatorias sin peticiones extra; perfil → tab Eliminatorias y tab Plantilla funcionan.

## 7. Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `api-porra/server.js` | `predictions/all`: proyección + `squad` en respuesta + criterio de inclusión |
| `js/main.js` | `unwrapAllPredictions` + `fetchAllPredictions` (3 cachés) + eliminar bloques `squad/all` y N `final-predictions` + invalidación de caché |
| `porra-spa/tests/` | Tests de `unwrapAllPredictions` |
| `index.html` | Cache-busting `main.js` |
| `AGENTS.md` (porra-spa y api-porra) | Documentación del nuevo shape |
