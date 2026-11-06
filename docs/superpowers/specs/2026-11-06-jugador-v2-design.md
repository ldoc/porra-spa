# Spec — Estadísticas › Jugador v2 (Fase 1)

Fecha: 2026-11-06 · Estado: aprobado tras brainstorming
Predecesor: `docs/superpowers/specs/2026-08-26-estadisticas-individual-design.md`

## 1. Objetivo

Ampliar la sub-pestaña **Individual** de Estadísticas con métricas que hoy no existen: exactos por jornada y rachas, puesto por fuente de puntos, mejor/peor partido frente a la media de la porra y cobertura de datos. Todo se calcula en cliente con los datos ya descargados; no hay cambios de API ni de backend.

## 2. Alcance

### 2.1 En alcance (Fase 1)

1. Exactos por jornada y rachas de marcadores exactos.
2. Puesto y "Top X%" por fuente de puntos.
3. Mejor y peor partido con delta frente a la media de ese partido.
4. Cobertura global de liga y cobertura individual de pronósticos.

### 2.2 Fuera de alcance (roadmap)

- **Fase 2 — Suerte y estilo:** puntos esperados vs reales, robos/faroles y acierto según confianza.
- **Fase 3 — Social:** duelo H2H, consenso vs resultado real, explorador de partido, equipos sobre/infravalorados y precisión del bracket.
- **Fase 4 — Records y compartir:** salón de la fama, premios por jornada y resumen PNG compartible.

Estas fases tendrán su propio spec. En particular, las fases 2 y 3 deben respetar `getHiddenFaseForOthers` para no revelar pronósticos de fases ocultas.

## 3. Datos mostrados

Todo vive en la sub-pestaña **Individual**, sin nuevas pestañas ni cambios de navegación.

| Orden | Bloque | Contenido |
|---|---|---|
| 1 | Selector + rank | Existente: avatar, nombre, desplegable y `#puesto` |
| 2 | Cobertura | Línea bajo los subtabs: `X/Y partidos de liga · N/M jornadas completas` + pill "Datos parciales" si falta algo. En el header individual: `Tus pronósticos con resultado: A/B` |
| 3 | Desglose de puntos | Existente (donut + comparativa vs media) |
| 4 | 🎯 Exactos por jornada | KPIs: exactos, % exactos, racha actual, mejor racha, aciertos 1X2. Filas por jornada con barra `exactos/pronosticados` y texto `x/y 1X2`; pill "parcial" si la jornada no está completa |
| 5 | 📊 Puesto por fuente | Filas Total, Pronóst., Plantilla, Clasif. y Elims. con `#puesto/n`, barra y "Top X%". Fuente sin puntos → "sin datos aún" |
| 6 | Pronósticos | Existente, ampliado con mejor y peor partido: puntos, rival, delta vs media y tamaño de muestra |
| 7 | Jornadas | Existente, sin cambios |
| 8 | Sesgo | Existente, sin cambios |
| 9 | Plantilla | Existente, sin cambios |

## 4. Definiciones exactas

### 4.1 Dataset

- Solo liga (`fase === 'liga'`, rondas 1–8) para exactos, rachas, mejor/peor partido y cobertura.
- Partido válido: resultado con goles finitos para ambos equipos y pronóstico del usuario con `home` y `away` finitos.
- Los puntos se leen siempre de `AppState.userPoints[username].matchDetails`; no se recalcula el scoring por otra vía.

### 4.2 Exactos por jornada

- `exacto`: `pred.home === real.home && pred.away === real.away`. El 0-0 cuenta.
- `acierto 1X2`: mismo signo (`H`/`D`/`A`) que el resultado real.
- Por jornada, el denominador son los partidos válidos que el usuario pronosticó. Los partidos no pronosticados se excluyen: no penalizan ni rompen rachas.
- Jornada completa: todos los partidos de esa ronda tienen resultado. Si no, se marca "parcial".

### 4.3 Rachas

- Orden cronológico: `ronda` → `fechaTs` → `id`.
- Secuencia considerada: partidos válidos con pronóstico del usuario.
- Racha de exactos: nº de exactos consecutivos. `racha actual` = cola final de la secuencia; `mejor racha` = máximo histórico.
- Un partido válido no exacto reinicia la racha. Un partido sin pronóstico no se incluye.

### 4.4 Puesto por fuente

- Jugadores considerados: `statsPlayers()` (invitados filtrados según el espectador).
- Valor por fuente desde `sourceSplitFromUserData`: `prediction`, `squad`, `classification`, `eliminatorias`. `total` = suma de las cuatro.
- Ranking descendente. Empates comparten puesto: `puesto = 1 + nº de jugadores con valor estrictamente mayor`.
- Etiqueta "Top X%" = `max(1, round(puesto / n * 100))`. Es más robusta que un percentil puro cuando hay empates.
- Si una fuente no tiene ningún valor distinto de 0 en toda la porra (incluidos los negativos de plantilla), `hasData = false` y se muestra "sin datos aún" (no se calcula Top).
- En `total` se usa el desempate oficial (`compareIndividualRows`) para coincidir con Clasificación.

### 4.5 Mejor y peor partido

- Candidatos: partidos válidos con pronóstico del usuario.
- Media del partido: media de puntos de todos los jugadores filtrados que pronosticaron ese partido, usando sus puntos reales. Se muestra el tamaño de muestra.
- `delta = puntos_usuario − media`, redondeado a 1 decimal.
- Empates: mejor y peor eligen el partido más antiguo cronológicamente.
- Sin partidos válidos → empty state.

### 4.6 Cobertura

- Global: `partidos_liga_con_resultado / total_partidos_liga` y `jornadas_completas / total_jornadas`. El total de jornadas se deriva de las rondas de liga presentes, sin hardcodear 8.
- Individual: `partidos_válidos_pronosticados / partidos_liga_con_resultado`.
- Pill "Datos parciales" si falta algún resultado o jornada.
- Las eliminatorias no entran en la cobertura de esta fase.

## 5. Arquitectura

Todo en `js/stats.js`, en un bloque delimitado `Jugador v2`, siguiendo el patrón actual IIFE + funciones puras exportadas. No se crean módulos nuevos para no alterar el orden de carga ni los tests existentes.

### 5.1 Funciones puras nuevas

```javascript
// {
//   byJornada: [{ ronda, played, exact, outcomeHits, complete }],
//   totals: { played, exact, outcomeHits, exactPct },
//   streaks: { currentExact, bestExact }
// }
calcExactStats(username, leagueMatches, matchStatsById, allPredictions)

// { [username]: {
//     total: { value, rank, n, topPct, hasData },
//     prediction: {...}, squad: {...}, classification: {...}, eliminatorias: {...}
// } }
calcSourceRanks(splitByUser, playerNames)

// { best: null | { matchId, match, points, avg, sample, delta },
//   worst: null | { matchId, match, points, avg, sample, delta } }
calcMatchExtremes(username, playedMatches, allPredictions, userPoints, matchesById)

// { totalLeague, playedLeague, completedJornadas, totalJornadas,
//   userPredictedPlayed, partial }
calcDataCoverage(matches, matchStats, allPredictions, username)
```

### 5.2 Agregados y render

- `buildStatsAggregates()` añade `coverage` y `sourceRanks`, calculados una sola vez por render.
- `renderIndividualBody()` calcula exactos y extremos solo para el usuario seleccionado.
- Renderers nuevos: `renderCoverageNote(aggregates)`, `renderExactCard(username, exactStats)`, `renderSourceRanksCard(username, ranks)` y las filas de extremos dentro de la tarjeta de Pronósticos.
- Se reutilizan clases existentes: `stats-card`, `stats-card-title`, `stats-kpi-grid`, `stats-consbar`, `stats-rank-row`, `stats-pill`, `stats-rank-sub`. Se añaden estilos mínimos para las filas de puesto por fuente.
- Sin cambios en `server.js`, endpoints, `cacheStore` ni payloads.

### 5.3 Datos de entrada ya disponibles

- `AppState.matches` / `AppState.leagueMatches` (con `ronda`, `fase`, `fechaTs`, nombres de equipos).
- `AppState.matchStats` (goles por equipo).
- `AppState.allPredictions` (pronósticos por usuario y partido).
- `AppState.userPoints` (puntos y `matchDetails`).
- `AppState.players`, `AppState.squadsCache`, `AppState.finalPredictionsCache`.

## 6. Estados y casos límite

- Sin partidos con resultado: empty state existente; las tarjetas nuevas muestran "Aún no hay partidos con resultado".
- Fuente sin datos: "sin datos aún", sin Top.
- Jornada parcial: pill "parcial"; no cuenta como completa.
- Invitados: se respeta `statsPlayers()` y `statsHideGuests()`.
- Cambio de usuario seleccionado o invitado oculto: se recalcula con `resolveIndividualUsername`.
- MatchStats ausente o incompleto: el partido se ignora.
- Valores `null`, `NaN` o no finitos: se ignoran.
- IDs duplicados: `Map` con último valor ganador.
- Móvil vertical: sin desbordamiento horizontal; tarjetas y barras reutilizan el diseño existente.

## 7. Tests y verificación

### 7.1 Tests nuevos

Nuevo `tests/estadisticasJugadorV2.test.js` con Node puro, mismo estilo que los existentes.

Casos mínimos:

1. Exactos y 1X2 por jornada; 0-0 cuenta como exacto.
2. Jornada parcial marcada como no completa.
3. Partidos no pronosticados excluidos de denominador y rachas.
4. Racha actual/mejor y reset con un partido no exacto.
5. Ranking por fuente con empates compartiendo puesto y `topPct` correcto.
6. `hasData = false` cuando todos los valores de una fuente son 0.
7. `total` usa el desempate oficial.
8. Mejor/peor partido con media, muestra y delta; empate resuelto por antigüedad.
9. Sin partidos válidos → `null`.
10. Cobertura completa y parcial; jornadas totales derivadas.

### 7.2 Regresión

Se mantienen y ejecutan:

- `tests/estadisticas.test.js`
- `tests/estadisticas-subtabs.test.js`
- `tests/estadisticasEvolucion.test.js`
- `tests/estadisticasIndividualDesempate.test.js`

### 7.3 Comprobación manual

- Viewport móvil vertical con datos completos.
- Una jornada parcial y una fuente aún a cero.
- Sin resultados disponibles.
- Usuario sin plantilla.
- Invitado oculto para el espectador.
- Sin errores en consola ni desbordamiento horizontal.

### 7.4 Cache-busting

Incrementar la versión de `js/stats.js` en `index.html` y, si se añaden estilos, también la de `css/styles.css`, según la regla de `AGENTS.md`.

## 8. Criterios de aceptación

- Las cuatro mejoras aparecen en Individual y respetan los filtros de invitados.
- Exactos, 1X2 y puntos cuadran con Clasificación y con los valores ya mostrados.
- "Top X%" y los puestos coinciden con el orden oficial en Total.
- La cobertura avisa cuando los datos son parciales.
- Cero cambios de API y cero regresiones en los tests existentes.

## 9. Riesgos y decisiones

- **Crecimiento de `stats.js`:** se mitiga con un bloque delimitado y funciones puras exportadas; una modularización futura queda fuera de esta fase.
- **Semántica del percentil:** se usa "Top X%" basado en puesto para evitar resultados engañosos con empates.
- **Datos parciales:** la cobertura explícita evita conclusiones erróneas cuando faltan resultados.
- **Rendimiento:** el ranking por fuente es O(n · fuentes) y exactos/extremos se calculan solo para el usuario visible; no se añaden recálculos globales pesados.
