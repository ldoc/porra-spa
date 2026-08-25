# Diseño: Pestaña de Estadísticas — Sub-tabs (Fiabilidad, Rachas, Consenso, Plantillas)

**Fecha:** 2026-08-25
**Proyecto:** porra-spa

## Contexto

La pestaña Estadísticas (spec `2026-08-14-estadisticas-evolucion-design.md`) muestra hoy un único gráfico: evolución de puntos acumulados por jornada con selector de fuente de puntos y chips de jugadores. Se quiere ampliar con **estadísticas comparativas entre jugadores**, integradas mediante **sub-tabs internos** (opción B validada en mockups).

Datos necesarios ya disponibles en cliente, sin cambios de backend ni nuevas llamadas:

- `AppState.allPredictions[username][matchId]` → `{ home, away }` (pronósticos de todos)
- `AppState.userPoints[username].matchDetails` → `{ match, points }` por partido
- `AppState.matchStats` → resultados reales (goles por equipo)
- `AppState.squadsCache[username]` → plantilla de cada usuario
- `AppState.finalPredictionsCache[username]` → predicciones de eliminatorias
- `AppState.matches`, `AppState.teamsMap`, `AppState.players`

**Restricción clave**: puede haber **15–30 usuarios registrados**. Todos los rankings deben escalar a N usuarios (listas de filas, sin podios fijos de 3).

## Objetivos

1. Añadir una barra de **sub-tabs** dentro de la pestaña Estadísticas: `Evolución · Fiabilidad · Rachas · Consenso · Plantillas`.
2. Cuatro vistas nuevas agregando datos de toda la comunidad, calculadas en cliente.
3. Lógica en **funciones puras testables** en `js/stats.js` (patrón IIFE + `module.exports` existente).
4. Escalable a 15–30 usuarios sin degradar rendimiento ni usabilidad móvil vertical.

## Decisiones acordadas

- **Integración**: sub-tabs internos (mockups opción B). El gráfico de evolución deja de ser siempre visible; es la primera sub-tab.
- **Alcance**: las 5 estadísticas propuestas (fiabilidad, rachas, consenso de partidos, consenso de eliminatorias/campeón, plantillas agregadas). Las dos últimas viven dentro de «Consenso» y «Plantillas» respectivamente.
- **Rankings**: filas escalables (posición, avatar, nombre, valores), orden descendente; la página hace scroll vertical natural (sin scrolls internos por tarjeta).
- **Selector de fuente y chips**: se aplican solo a Evolución; las demás vistas agregan siempre a todos los jugadores.

## Arquitectura

### Estado nuevo (`AppState`)

| Campo | Tipo | Descripción |
|---|---|---|
| `estadisticasSubTab` | string | Sub-tab activa: `'evolucion'` (default) \| `'fiabilidad'` \| `'rachas'` \| `'consenso'` \| `'plantillas'` |
| `estadisticasConsensoRonda` | number\|null | Ronda de liga seleccionada en Consenso (1–8). Default: última ronda con algún resultado; si no hay, ronda relevante de la fase actual |

### Estructura del render

```text
renderEstadisticasTab()
└── renderStatsContent()
    ├── Barra sub-tabs (.stats-subtabs)          ← nueva, siempre visible
    └── [según estadisticasSubTab]
        ├── 'evolucion'   → contenido actual íntegro (segmentado fuente + chips + gráfico + leyenda)
        ├── 'fiabilidad'  → renderFiabilidad(aggregates)
        ├── 'rachas'      → renderRachas(aggregates)
        ├── 'consenso'    → renderConsenso(aggregates, rondaActiva)
        └── 'plantillas'  → renderPlantillasAgg(aggregates)
```

### Agregación única por render

`buildStatsAggregates()` calcula en un solo pase, una vez por render de la pestaña:

```js
{
  reliabilityRows,   // ranking de fiabilidad (todos los usuarios)
  streaks,           // rachas por usuario
  bestJornadas,      // top 5 (usuario, jornada) históricas
  championsTally,    // votos a campeón
  quadroStats,       // rareza del cuadro propio
  squadOwnership,    // agregación de plantillas
}
```

El consenso por partido NO va en aggregates: se calcula on-demand solo para la ronda activa (9 partidos), al cambiar `estadisticasConsensoRonda`.

`buildUserData()` ya invoca `calculateSquadPoints` por usuario para Evolución; la agregación de plantillas reutiliza esos resultados (no se recalcula dos veces).

## Especificación por sub-tab

### 1 · Fiabilidad («¿quién se parece más al resultado real?»)

Por usuario, sobre **todos los partidos con resultado real** en `matchStats` (cualquier fase):

| Métrica | Fórmula |
|---|---|
| `% resultado acertado` | nº partidos con `getMatchResult(pred) === getMatchResult(real)` / nº partidos con resultado × 100 |
| `pts/partido` | suma de `points` de `userPoints[].matchDetails` en partidos con resultado / nº partidos con resultado (1 decimal) |

**Tarjeta «Ranking de fiabilidad»**: una fila por usuario, ordenada por `% resultado` desc (desempate: pts/partido): `# · avatar · nombre · % · pts/partido`. Usuarios sin pronósticos: 0 %, al final.

**Tarjeta «Tu detalle»** (usuario actual): 3 KPIs — pts medios/partido, marcadores exactos (ambos goles acertados), partidos con 15 pts.

### 2 · Rachas y récords de jornada

Solo fase de liga. **Jornada completada** = todas sus partidos tienen resultado en `matchStats`.

- Puntos por jornada de un usuario = suma de `matchDetails.points` de esa ronda.
- **Racha**: mirando las jornadas completadas desde la más reciente hacia atrás, nº consecutivo de jornadas con puntos > jornada anterior (`▲ N mejorando`) o < jornada anterior (`▼ N empeorando`). Primera jornada o empate → sin badge.
- Tarjeta «🔥 Rachas»: fila por usuario con avatar, nombre y badge; ordenada por longitud de racha desc (a igualdad, gana quien más puntos hizo en su última jornada).
- Tarjeta «📈 Mejores jornadas históricas»: top 5 de todas las combinaciones (usuario, jornada completada) por puntos de jornada. Filas con medallas 🥇🥈🥉 y `+X pts`.

### 3 · Consenso (partidos de liga)

- Navegador ◀ Label ▶ de rondas 1–8 (mismo patrón que Resultados). Default según estado arriba.
- Por cada partido de la ronda activa, una tarjeta colapsada con:
  - Cabecera: escudos + nombres + hora/fecha corta.
  - Barras % 1X2 sobre jugadores con pronóstico numérico completo para ese partido.
  - Pill en la cabecera: «con la mayoría» (mi 1X2 = mayoría) / «⚖️ contra corriente» (≠ mayoría) / nada (sin pronóstico propio o partido sin pronósticos).
  - Tap → expande «Marcadores más votados»: grid de hasta 6 marcadores ordenados por nº de votos (`2-1 · 38%`). La celda de mi marcador se resalta en cyan; si no está en el top 6 se añade como séptima celda.
- Con resultado real disponible, la cabecera muestra también el resultado y cuántos acertaron el 1X2.

**Eliminatorias (dentro de Consenso, al final):**
- Tarjeta «👑 Campeón más votado»: recuento de `finalPredictionsCache[u].champion`; filas escudo + nombre + `X/N votos`, ordenadas desc (se muestran todos los equipos votados; normalmente ≤ 5).
- Tarjeta «Tu cuadro vs la porra»: sobre usuarios con `finalPredictions` distinta de null (excluido yo): media de equipos en común (de los 24 slots: champion, runnerUp y arrays) entre mi cuadro y el de cada uno → KPIs: `% coincidencia media`, `equipos en común de media (X/24)`, `N usuarios con cuadro muy distinto al mío (difieren en ≥12 de los 24 equipos)`. Si nadie tiene finalPredictions aún, tarjeta con estado vacío.

### 4 · Plantillas (agregación)

- Recorre `squadsCache`: para cada jugador real presente en alguna plantilla:
  - `puntosGenerados` = suma de los puntos de ese jugador entre todos los usuarios que lo tienen (de los `playerDetails` de `calculateSquadPoints` ya calculados por usuario).
  - `posesion` = nº usuarios que lo tienen / nº usuarios con plantilla (≥1 jugador) × 100.
- Tarjeta única «⭐ Jugadores estrella»: filas ordenadas por `puntosGenerados` desc, **limitadas a las 25 primeras** (nota «top 25 de X jugadores únicos»):
  `foto (imgJugadores/{id}.webp, fallback emoji por posición) · nombre · demarcación · pts generados · badge posesión`.
- Badges de posesión: `⭐ imprescindible` (≥70%), `🎯 diferencial` (≤30%), sin badge en el resto.

## Diseño para 15–30 usuarios

- Todos los rankings son **filas repetibles** (`display:flex`, altura fija ~40px): 30 filas ≈ 1200px, scroll vertical de página, sin paginación.
- Sin cálculos O(N²) salvo «Tu cuadro vs la porra» (N×24 comparaciones de Sets, trivial) y mejores jornadas (usuarios × jornadas completadas, máx 30×8).
- Re-render de sub-tab = solo HTML string nuevo desde aggregates ya calculados; sin refetch.

## Estados vacíos y edge cases

- `FASE_PRETEMPORADA`: guard existente («Disponible al inicio…») sigue aplicando a toda la pestaña.
- Sin `matchStats`: mensaje actual; sub-tabs visibles pero cada vista muestra su `.stats-empty`.
- Partidos sin resultado: excluidos de denominadores (fiabilidad) y de jornadas incompletas (rachas).
- Usuario actual sin pronóstico en un partido: pill omitida, celda propia solo si tiene marcador.
- `finalPredictionsCache` vacío: tarjetas de campeón/cuadro con estado vacío.
- Usuarios sin plantilla guardada: excluidos del denominador de posesión.

## CSS nuevo (`css/styles.css`, solo variables `:root`)

Clases: `.stats-subtabs` (+ botones, variante verde del segmentado existente), `.stats-rank-row`, `.stats-rank-pos` (medalla/ranking), `.stats-kpi-grid`/`.stats-kpi`, `.stats-consbar` (+`.track`/`.fill`), `.stats-scoregrid`/`.stats-scorecell`(+`.mine`), `.stats-pill`, `.stats-badge-up`/`.stats-badge-dn`. Mismo vocabulario visual: tarjetas `--ucl-card`, radios `--radius-*`, colores `--accent-primary/cyan/gold/purple`.

## Ficheros modificados

| Fichero | Cambio |
|---|---|
| `js/stats.js` | Sub-tabs, funciones puras nuevas, renders nuevos |
| `css/styles.css` | Clases nuevas listadas arriba |
| `index.html` | Bump cache-busting de `css/styles.css` y `js/stats.js` |
| `tests/estadisticas-subtabs.test.js` (nuevo) | Tests de funciones puras nuevas |
| `AGENTS.md` | Actualizar sección de tab-estadisticas con las sub-tabs |

## Cache-busting (norma AGENTS.md)

Bump de `?v=` en `index.html` para `css/styles.css` y `js/stats.js`.

## Funciones puras nuevas (exportables para tests)

```js
/** Ranking de fiabilidad: [{ username, pctResult, ptsPerMatch, exactScores, perfect15 }] */
function calcReliabilityRows(allPredictions, players, matchesById, matchStatsById, userPoints)

/** Rachas por usuario a partir de series por jornada: { username: { dir:'up'|'down', len } | null } */
function calcStreaks(pointsByUserByJornada)

/** Top N (usuario, jornada, puntos) históricos */
function calcBestJornadas(pointsByUserByJornada, topN)

/** Consenso 1X2 + marcadores de un partido: { counts, pct, total, topScores, majorityResult } */
function computeMatchConsensus(matchId, allPredictions)

/** Recuento de campeones: [{ teamId, votes }] */
function tallyChampions(finalPredictionsCache)

/** Rareza de mi cuadro: { avgCommon, avgPct, veryDiffCount } */
function compareQuadroWithCommunity(myFp, finalPredictionsCache)

/** Agregación de plantillas: Map playerId → { player, pts, owners } */
function aggregateSquads(squadPointsByUser, squadsCache)
```

## Tests (`tests/estadisticas-subtabs.test.js`)

Patrón espejo (`node tests/estadisticas-subtabs.test.js`):

- `calcReliabilityRows`: % correcto con mezcla de aciertos; excluye partidos sin resultado; usuarios sin predicciones al final con 0.
- `calcStreaks`: racha ↑ de 2, racha ↓ de 1, empate corta racha, sin datos → null.
- `calcBestJornadas`: orden desc y corte en topN.
- `computeMatchConsensus`: conteo 1/X/2 solo con pronósticos completos; topScores ordenado y con % correctos; mayoría correcta.
- `tallyChampions`: agrupa votos e ignora nulls.
- `compareQuadroWithCommunity`: común de 24 slots correcto; media sobre usuarios válidos.
- `aggregateSquads`: suma de puntos entre dueños y posesión correcta; ignora usuarios sin plantilla.

## Validación manual

1. Servir localmente, abrir Estadísticas con fase ≠ pretemporada y con algunos matchstats.
2. Cambiar entre las 5 sub-tabs: estado persiste al volver a entrar.
3. Evolución intacta (fuente, chips, toast del punto final).
4. Fiabilidad/Rachas: 15–30 usuarios renderizan en lista completa sin lag.
5. Consenso: navegar rondas ◀▶, expandir un partido, verificar pill y marcador propio resaltado.
6. Plantillas: badges imprescindible/diferencial coherentes con posesión.
7. Sin errores de consola; estilos consistentes con variables CSS.

## Fuera de alcance

- Cambios de backend, endpoints o esquema MongoDB.
- Modificar cálculos de puntos existentes (`calculateUserTotalPoints`, `calculateSquadPoints`, …).
- Librerías de gráficos externas.
- Filtros adicionales por usuario en las vistas nuevas (siempre agregan a todos).
