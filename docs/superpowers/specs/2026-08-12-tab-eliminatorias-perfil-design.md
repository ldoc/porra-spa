# Tab Eliminatorias en el modal de perfil de Clasificación + puntos en el ranking

**Fecha:** 2026-08-12
**Estado:** Diseño aprobado
**Scope:** Frontend `porra-spa` (sin cambios de backend).

## 1. Objetivo

Añadir un tab **"Eliminatorias"** al modal de perfil que se abre al pinchar en un jugador desde la pantalla de **Clasificación**. El tab muestra las predicciones de fase final del usuario (campo `finalPredictions`) en un layout de cajas por puestos, junto con los **puntos obtenidos** por cada equipo según las reglas de puntuación de eliminatorias.

Además, los puntos de eliminatorias se suman al **total de puntos reales** de cada usuario en la clasificación general (`realPoints`).

## 2. Reglas de puntuación (aprobadas)

### Fases ordenadas por rango

| Rango | Fase alcanzada | Puntos |
|-------|----------------|--------|
| 0 | No alcanza eliminatorias | 0 |
| 1 | Play-off (dieciseisavos) | 10 |
| 2 | Octavos | 15 |
| 3 | Cuartos | 25 |
| 4 | Semifinales | 50 |
| 5 | Final (subcampeón) | 75 |
| 6 | Final (campeón) | 100 |

### Regla central

> `puntos_equipo = PUNTOS[ min(rangoPronosticado, rangoAlcanzado) ]`

Se obtienen puntos solo por la máxima fase alcanzada (no se acumulan fases previas). Si el equipo alcanza una fase superior a la pronosticada, se puntúa por la pronosticada (la inferior); si alcanza una inferior, se puntúa por la alcanzada (la inferior). En ambos casos se aplica `min`.

**Puntuación máxima total:** 100 + 75 + 2·50 + 4·25 + 8·15 + 8·10 = **575 puntos**.

### Rango alcanzado "real" (provisional con fase mínima)

Durante la competición, para cada equipo se deduce del cuadro real resolviendo cruces (reutilizando `groupTies`/`resolveTie`):

- Eliminado en una ronda resuelta → rango de esa ronda.
- Aún vivo (pasó su cruce o su cruce está pendiente) → rango de la ronda en la que está (fase mínima).
- Sin datos de eliminatorias todavía → rango 0.

## 3. Funciones puras nuevas (`js/eliminatorias.js`)

### `computeReachedPhases(matches, matchStats)`

Devuelve `{ teamId: rangoAlcanzado }` para todos los equipos del cuadro real.

- Recorre las fases en orden (`16 → 8 → 4 → semis → final`).
- Para cada fase agrupa cruces con `groupTies` y resuelve con `resolveTie`.
- Eliminado en fase X → rango de X.
- Equipos que avanzan o cuyo cruce está pendiente → rango de la fase en la que están.
- Final: ganador → 6, perdedor → 5; si la final no está resuelta → ambos 5 (provisional).

### `calculateEliminatoriasPoints(finalPredictions, reachedPhases)`

Devuelve `{ totalPoints, teamDetails }`.

- `finalPredictions` → rango pronosticado de cada equipo (campeón=6, subcampeón=5, semis=4, cuartos=3, octavos=2, dieciseisavos=1).
- Por cada equipo pronosticado: `points = PUNTOS[min(rangoPronosticado, reachedPhases[teamId] ?? 0)]`.
- `teamDetails`: `{ teamId, predictedRank, reachedRank, points }`.
- Cajas sin equipo pronosticado no suman.
- `finalPredictions` vacío o `null` → `{ totalPoints: 0, teamDetails: [] }`.

Ambas funciones se exportan para poder unit-testearlas (mismo patrón que `eliminatorias.test.js`).

## 4. UI: tab Eliminatorias en el modal de perfil

### Ubicación

Cuarto tab del modal de perfil (`showUserProfileModal` en `js/main.js`), junto a Clasificación:

`Pronósticos | Plantilla | Clasificación | Eliminatorias`

### Contenido del tab

- **Header**: "Puntos totales eliminatorias: `<total>`".
- **Zonas** en el mismo orden y con los mismos emojis/colores que la vista read-only de Eliminatorias en Resultados:
  - 📋 Dieciseisavos (8 cajas) — `roundOf32`
  - ⚡ Octavos (8 cajas) — `roundOf16`
  - 🏅 Cuartos (4 cajas) — `quarterFinalists`
  - ⚔️ Semifinales (2 cajas) — `semiFinalists`
  - Fila final: 🥈 Subcampeón (1) + 🏆 Campeón (1) en la misma fila.
- **Cada caja** muestra el equipo pronosticado (badge + nombre, reutilizando `.drop-slot`) y debajo los puntos obtenidos:
  - `> 0` → badge verde `🎯 N pts`
  - `0` → `—`
- **Estados especiales**:
  - Usuario sin `finalPredictions` → "No hay predicciones de eliminatorias".
  - Sin resultados de eliminatorias → equipos visibles con puntos `—`.

### Estilos

Reutilizar la base CSS de `.eliminatorias-view` (`.drop-zone`, `.drop-slot`, `.drop-slot-img`, `.drop-slot-name`), adaptada al ancho del modal (~400px).

## 5. Integración en la clasificación general

- Nuevo helper `fetchFinalPredictionsForUser(username)`: `GET /api/final-predictions?username=xxx`, con caché `AppState.finalPredictionsCache` (mismo `CACHE_TTL` de 30s que `squadsCache`).
- En `renderClasificacionTab`, se fetchea la finalPredictions de cada jugador en paralelo.
- Nuevo campo `eliminatoriasPoints` por usuario:
  ```
  realPoints = predictionPoints + squadPoints + classificationPoints + eliminatoriasPoints
  ```
- Breakdown de cada fila: `(X pronósticos + Y plantilla + Z clasificación + W eliminatorias)`.
- En pretemporada sin resultados, los puntos de eliminatorias son 0 (coherente con la pantalla).

### Privacidad (sin cambios en backend)

La visibilidad del tab sigue la regla existente de fase de juego: el backend ya devuelve 403 en `FASE_PRETEMPORADA` para finalPredictions de otros usuarios (`api-porra/server.js` GET `/api/final-predictions`). El modal ya bloquea abrir perfiles ajenos en pretemporada. No se introduce ninguna fecha de freeze nueva (se descarta `finalsFreezeDate`, que no existe en el código real).

## 6. Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `js/eliminatorias.js` | `computeReachedPhases` + `calculateEliminatoriasPoints` (funciones puras exportadas) |
| `js/main.js` | Tab Eliminatorias en `showUserProfileModal`, `fetchFinalPredictionsForUser`, integración en `renderClasificacionTab` |
| `css/styles.css` | Estilos del tab (reuso de `.drop-zone`/`.drop-slot`) |
| `index.html` | Cache-busting: `main.js?v=61`, `styles.css?v=46` |
| `tests/eliminatorias.test.js` | Nuevos tests |

## 7. Tests

- `computeReachedPhases`:
  - Equipo eliminado en ronda resuelta → rango correcto.
  - Equipo aún vivo → rango provisional (fase mínima).
  - Final resuelta → campeón 6, subcampeón 5.
  - Final pendiente → ambos 5.
  - Sin matchStats → rango 0.
- `calculateEliminatoriasPoints`:
  - Acierto exacto por ronda (campeón=100, subcampeón=75, semis=50, cuartos=25, octavos=15, dieciseisavos=10).
  - Regla del mínimo: alcanza campeón / pronostica octavos → 15; alcanza play-off / pronostica semis → 10.
  - Caja sin equipo pronosticado → no suma.
  - Total máximo = 575.
  - `finalPredictions` vacío/null → 0.

## 8. Fuera de scope

- Cambios en el backend (`api-porra`).
- Edición de predicciones desde el tab (solo lectura).
- Sumar puntos de eliminatorias a ninguna otra pantalla (solo clasificación y el nuevo tab).
