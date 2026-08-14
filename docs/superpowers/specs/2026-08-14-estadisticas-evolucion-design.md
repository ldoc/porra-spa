# Diseño: Pestaña de Estadísticas — Evolución de puntos por jornada

**Fecha:** 2026-08-14
**Proyecto:** porra-spa

## Contexto

La aplicación tiene una barra de navegación inferior con 5 items (Inicio, Clasificación, Resultados, Pronósticos, Plantilla) y toda la información de puntos necesaria ya calculada o calculable desde `AppState`:

- `AppState.userPoints[user].matchDetails` → `{ match, points, breakdown }` por partido (puntos de pronósticos).
- `AppState.squadsCache[user]` + `calculateSquadPoints(squad, matchStats)` → puntos de plantilla con desglose por `eventId`.
- `calculateClassificationPoints(user)` → puntos por aciertos de clasificación de la liga.
- `AppState.finalPredictionsCache[user]` + `calculateEliminatoriasPoints(userFp, reachedPhases)` → puntos de eliminatorias.

Se quiere añadir una **nueva pestaña Estadísticas** (6º item de navegación) con un único gráfico por ahora: la **evolución de puntos acumulados por jornada y por jugador**, con selector de jugadores y conmutador del tipo de puntos. Sin librerías externas (CSS/SVG vanilla), respetando las normas de AGENTS.md.

Se parte de cero en `main` (se descartó la rama previa `feat/estadisticas`).

## Objetivos

1. Añadir un 6º item a la barra de navegación inferior: **Estadísticas** (`data-tab="estadisticas"`).
2. Nueva pestaña con un gráfico de **líneas SVG** (sin librerías) de evolución de puntos acumulados.
3. **Selector de jugadores** tipo chips en fila con scroll horizontal, con contador y acciones "Todos/Nadie".
4. **Conmutador de tipo de puntos**: Total, Pronósticos, Plantilla, Clasificación y Eliminatorias.
5. Lógica de cálculo en **funciones puras testables** en `js/stats.js` (patrón espejo de `tests/`).
6. Guard de fase simple: solo `FASE_PRETEMPORADA` muestra mensaje; en el resto se muestra el gráfico con resultados públicos.

## Decisiones acordadas

- **Entrada al menú**: 6º item en la barra inferior con etiqueta completa "Estadísticas" (variante validada en mockup: etiquetas completas, fuente 9px).
- **Formato gráfico**: SVG vanilla, sin librerías ni canvas.
- **Alcance inicial**: únicamente la evolución de puntos por jornada. El resto de estadísticas (histogramas, donut, top por jornada, etc.) queda fuera.
- **Archivo nuevo**: `js/stats.js` con los cálculos puros y el render, para no agrandar `js/main.js` (ya ~200KB).
- **Eje X**: línea temporal única fija: jornadas de liga `J1`–`J8` seguidas de las fases de eliminatorias `16, 8, 4, Semis, Final`.
- **Tipos de puntos**: 5 opciones — Total, Pronósticos, Plantilla, Clasificación, Eliminatorias. Total = suma de las 4.
- **Fases**: guard simple. `isFasePretemporada()` → mensaje "Disponible al inicio de la competición". En el resto de fases, el gráfico se muestra con los resultados disponibles (públicos).
- **Selector de jugadores**: chips en fila con scroll horizontal (opción A validada). Se descarta el chip "+ Añadir" (el scroll ya accede a todos).

## Línea temporal (eje X)

Posiciones ordenadas y fijas:

| Índice | Posición | Origen |
|--------|----------|--------|
| 0–7 | `J1` … `J8` | `match.ronda` (1-8) con `match.fase === 'liga'` |
| 8 | `16` | fase `16` |
| 9 | `8` | fase `8` |
| 10 | `4` | fase `4` |
| 11 | `Semis` | fase `semis` |
| 12 | `Final` | fase `final` |

- Etiquetas cortas para el eje: `J1`..`J8`, `16`, `8`, `4`, `Semis`, `Final`.
- Se usa la línea temporal completa siempre; las series solo tienen puntos donde existen datos (línea plana antes del primer dato y tras el último dato conocido de cada fuente).

## Fuentes de puntos y cálculo acumulado

Para cada fuente y cada usuario se produce una **serie acumulada**: array de `{ point (índice de línea temporal), value (acumulado) }`.

### Pronósticos
- De `AppState.userPoints[user].matchDetails`, sumando `d.points` por `d.match.ronda`, solo partidos con `match.fase === 'liga'`.
- Solo aporta a las posiciones `J1`–`J8`.

### Plantilla
- De `calculateSquadPoints(squad, matchStats).playerDetails[].partidos[{ eventId, puntos }]`, mapeando `eventId` → `match` → `(fase, ronda)`.
- Aporta a jornadas de liga (`J1`–`J8`) y, si hay datos de jugadores en eliminatorias, a las posiciones de fase.

### Clasificación
- Un único salto de `0 → total` en la posición `J8`.
- **Solo si la fase de liga está completa** (todos los partidos de `fase === 'liga'` tienen resultado en `matchStats`), para no creditar posiciones provisionales.
- Total = `calculateClassificationPoints(user).totalPoints`.

### Eliminatorias
- De `calculateEliminatoriasPoints(userFp, reachedPhases).teamDetails[{ teamId, predictedRank, reachedRank, points }]`.
- Cada equipo aporta sus `points` en la posición de fase correspondiente a `reachedRank`:
  - `1 → 16`, `2 → 8`, `3 → 4`, `4 → Semis`, `5/6 → Final`.
- Acumulado por fase.

### Total
- Suma de las 4 series en cada posición de la línea temporal.

## Funciones puras (`js/stats.js`)

Funciones sin DOM, testables con node:

```js
/** Línea temporal fija: [{ key, label, ronda|fase }] */
function buildTimeline() { ... }

/** Serie acumulada de pronósticos para un usuario (solo liga, por ronda). */
function calcPredictionSeries(userPoints, username) { ... }

/** Serie acumulada de plantilla (eventId → match → jornada/fase). */
function calcSquadSeries(squadPoints, matchesById) { ... }

/** Serie de clasificación: 0 hasta J8, salto si liga completa. */
function calcClassificationSeries(total, leagueComplete) { ... }

/** Serie de eliminatorias: saltos por reachedRank → fase. */
function calcEliminatoriasSeries(teamDetails) { ... }

/** Suma de varias series posición a posición. */
function sumSeries(seriesList) { ... }

/** Dado un jugador y fuente, devuelve la serie correspondiente (orquestador). */
function getSeriesBySource(source, userData) { ... }

/** Comprueba si la fase de liga está completa (todos los partidos con resultado). */
function isLeagueComplete(matches, matchStats) { ... }
```

Formas de datos de entrada (coinciden con `AppState`):

```js
AppState.userPoints           // { username: { totalPoints, matchDetails: [{ match, points, breakdown }] } }
AppState.squadsCache          // { username: squad[] }
AppState.finalPredictionsCache// { username: finalPredictions|null }
AppState.matches              // [{ id, ronda, fase, homeTeamId, awayTeamId, ... }]
AppState.matchStats           // [{ eventId, stats: {...} }]
AppState.players              // [{ name, avatar }]
```

## Render de la pestaña (`js/stats.js`)

- `renderEstadisticasTab()` — entrada principal: pinta el header, el selector de tipo de puntos, el contador/chips y el gráfico. Despachada desde `navigateToTab` (`js/main.js`).
- `renderPlayerChips(players, visibleSet, source)` — fila de chips con scroll horizontal.
- `buildLineChart(seriesByUser, visibleUsers, timeline)` — SVG de líneas.
- `buildLegend(seriesByUser, visibleUsers)` — leyenda con color y valor final.
- `showStatsToast(username, value, point)` — toast con el valor exacto al tocar el punto final.

### Selector de tipo de puntos
- Control segmentado con 5 opciones: `Total · Pronósticos · Plantilla · Clasificación · Eliminatorias`.
- Se persiste en `AppState.estadisticasPointType` (default `'total'`) y sobrevive a re-renders.
- Cambiar de fuente recalcula el gráfico **manteniendo los jugadores visibles** cuando es posible.

### Chips de jugadores (opción A)
- Fila única con `overflow-x: auto` (sin wrap), contador "X visibles de N" y botones **Todos / Nadie**.
- Orden de los chips: el usuario actual primero, después el resto ordenados por puntos de la fuente seleccionada (descendente).
- Tocar un chip añade/quita al jugador del gráfico (toggle). El estado se guarda en `AppState.estadisticasVisibleUsers` (Set).
- Visibilidad por defecto: usuario actual + top 3 según la fuente seleccionada.

### Gráfico de líneas SVG
- Eje X: línea temporal completa con etiquetas cortas.
- Eje Y: puntos acumulados (escala según el máximo de los datos visibles, mínimo 10).
- Una polyline por jugador visible con paleta de colores fija (reutiliza variables CSS).
- Rejilla horizontal (3 niveles) y línea de base.
- Punto final de cada línea como círculo relleno; **tocarlo** muestra un toast con el valor exacto (ej. "juan123 · 132 pts (J8)").

### Leyenda
- Bajo el gráfico: color + nombre + valor final de cada jugador visible.

### Estados vacíos
- `FASE_PRETEMPORADA` (`isFasePretemporada()`): mensaje "Disponible al inicio de la competición".
- Sin `matchStats`: "No hay resultados disponibles aún".
- Sin jugadores visibles: mensaje indicando que se añadan jugadores.

## Rendimiento

- Para ordenar chips y calcular el top 3 por fuente, se calculan los **totales por fuente de todos los usuarios** una vez por render (hay pocos usuarios registrados); las **series acumuladas** solo se calculan para los jugadores visibles.
- `calculateSquadPoints` es la operación más cara y solo se invoca para los jugadores cuyos datos se necesitan (totales de todos + series de visibles). No requiere caché persistente.
- Los cálculos de series son O(nº partidos × jugadores visibles), despreciables.

## Ficheros modificados

| Fichero | Cambio |
|---------|--------|
| `index.html` | 6º item en `.bottom-nav`; sección `#tab-estadisticas`; `<script src="js/stats.js?v=1">`; bump de cache-busting de `styles.css` y `main.js` |
| `js/stats.js` (nuevo) | Funciones puras de cálculo + render |
| `css/styles.css` | Estilos: selector segmentado, chips con scroll, gráfico SVG, leyenda, contador, toast |
| `js/main.js` | Despachar `renderEstadisticasTab()` en `navigateToTab` (línea ~2860) |
| `tests/estadisticas.test.js` (nuevo) | Tests de funciones puras |
| `AGENTS.md` | Documentar la pestaña de estadísticas |

## Cache-busting (norma AGENTS.md)

- `css/styles.css?v=X` → `?v=X+1`
- `js/main.js?v=X` → `?v=X+1`
- Añadir `js/stats.js?v=1`

## Tests (`tests/estadisticas.test.js`)

Patrón espejo de función pura + assert (`node tests/estadisticas.test.js`):

- `buildTimeline()` → 13 posiciones en orden (J1–J8, 16, 8, 4, Semis, Final).
- `calcPredictionSeries` → acumulado correcto por jornada y solo fase liga.
- `calcSquadSeries` → acumulado por jornada/fase desde `eventId`.
- `calcClassificationSeries` → 0 hasta J8; salto solo si liga completa.
- `calcEliminatoriasSeries` → saltos por `reachedRank` en su fase.
- `sumSeries` → suma correcta posición a posición.
- `getSeriesBySource` → selecciona la serie correcta según fuente.
- `isLeagueComplete` → true solo con todos los partidos de liga con resultado.

## Validación manual

1. Abrir `index.html` con vista móvil vertical (o `python3 -m http.server 8000`).
2. Ver el 6º item "Estadísticas" en la barra inferior; al pulsarlo se abre la pestaña.
3. **FASE_PRETEMPORADA**: mensaje "Disponible al inicio de la competición".
4. **Fase en curso con resultados**:
   - El gráfico muestra la evolución acumulada de los jugadores visibles por defecto (actual + top 3).
   - Cambiar de tipo de puntos (Pronósticos/Plantilla/Clasificación/Eliminatorias/Total) actualiza el gráfico manteniendo jugadores visibles.
   - Chips con scroll horizontal: tocar añade/quita jugadores; contador y botones Todos/Nadie funcionan.
   - Tocar el punto final de una línea muestra el toast con el valor exacto.
5. Sin errores en consola; scroll fluido; estilos consistentes (modo oscuro, variables CSS).

## Fuera de alcance

- El resto de gráficas de estadísticas (histogramas, donut de precisión, top por jornada, tendencias de pronósticos).
- Cambiar el cálculo de puntos existente (`calculateUserTotalPoints`, `calculateSquadPoints`, `calculateClassificationPoints`, `calculateEliminatoriasPoints`).
- Introducir librerías de gráficos.
- Ocultar datos por fase PRE (`getHiddenFaseForOthers`) en estadísticas.
