# Evolución por jornada: posición por defecto y puntos acumulados/por jornada (2026-11-06)

## Resumen

Rehacer la lectura del gráfico de la subtab **Evolución** de Estadísticas para que muestre la evolución real por jornadas. Se añade un selector de métrica con dos vistas:

- **Posición** (por defecto): puesto de cada jugador tras cada etapa, calculado sobre el total acumulado de todas las fuentes.
- **Puntos**: puntos de cada jugador por etapa, con dos modos:
  - **Acumulado** (por defecto): total acumulado hasta la etapa.
  - **Por jornada**: solo los puntos obtenidos en esa etapa.

No se modifican los datos de origen ni el backend: todo se calcula en la SPA a partir de matchstats, predicciones, plantillas y predicciones finales ya disponibles.

## Decisiones tomadas con el usuario

1. **Selector Puntos/Posición**, con **Posición** como vista inicial.
2. **Acumulado por defecto** en la vista de Puntos, con toggle a **Por jornada**.
3. Eje X con **J1-J8 + fases eliminatorias**, recortado hasta la última etapa con resultados.
4. La vista de Posición usa **siempre el total** (todas las fuentes); al activarla se ocultan fuente y modo para evitar ambigüedad.
5. **Sin cambios en `api-porra`**: toda la lógica vive en `porra-spa`.

## Diseño

### Enfoque elegido: extender el pipeline actual de series (A)

Se reutilizan `buildTimeline`, `getSeriesBySource`, `sumSeries`, `buildLineChart` y `buildLegend`, añadiendo funciones puras pequeñas para deltas y posiciones.

### Estado (`AppState`)

- `estadisticasEvoMetric`: `'posicion' | 'puntos'`. Default `'posicion'`.
- `estadisticasEvoMode`: `'acumulado' | 'jornada'`. Default `'acumulado'`.
- Se mantiene `estadisticasPointType` (`'total' | 'pronosticos' | 'plantilla' | 'clasificacion' | 'eliminatorias'`) para la fuente en vista Puntos.
- Sin persistencia en localStorage: al recargar, vuelven los defaults.

### Cálculos puros (`js/stats.js`)

- `toStagePoints(series)`: convierte una serie acumulada de 13 posiciones en puntos por etapa. `delta[0] = serie[0]`; `delta[i] = serie[i] - serie[i-1]`. Devuelve `{ series, hasData }`.
- `calcEvolutionPositions(totalSeriesMap)`: recibe el mapa `username -> { series acumulada total, hasData }` y devuelve `username -> { series: [puestoPorEtapa], hasData }`. En cada índice el puesto es `1 + número de jugadores con más puntos acumulados`; los empates comparten puesto (misma regla que `calcPositionHistory`). El ranking se calcula sobre **todos** los `statsPlayers()`, no solo los visibles.
- `lastTimelinePoint(matches, matchStatsById)`: devuelve el índice de la última etapa del timeline con al menos un partido con resultado, usando `positionForMatch`. Mínimo `0` (J1).
- `trimTimeline(timeline, lastPoint)`: devuelve `timeline.slice(0, lastPoint + 1)`.
- `positionForMatch` se exporta para tests.

`buildSeriesMap(source, ...)` no cambia de firma. Para Posición se construye con `source = 'total'` y luego se aplica `calcEvolutionPositions`.

### Render (`renderEvolucionBody`)

1. Calcular `timeline = trimTimeline(buildTimeline(), lastTimelinePoint(...))`.
2. Construir el mapa de series según la métrica:
   - `puntos`: `buildSeriesMap(AppState.estadisticasPointType, ...)`. Si `modo === 'jornada'`, transformar cada serie con `toStagePoints`.
   - `posicion`: `buildSeriesMap('total', ...)` → `calcEvolutionPositions(...)`.
3. Controles en la tarjeta superior:
   - Selector `Métrica`: `Posición` / `Puntos` (siempre visible).
   - Si `puntos`: selector de fuente actual + selector `Modo`: `Acumulado` / `Por jornada`.
   - Si `posicion`: ocultar fuente y modo; mostrar nota `Ranking general · todas las fuentes`.
4. Título dinámico:
   - Posición: `Evolución de posición por jornada`.
   - Puntos acumulados: `Evolución de puntos por jornada`.
   - Puntos por jornada: `Puntos por jornada`.
5. Gráfico:
   - Puntos: eje Y normal (0 abajo, máximo arriba).
   - Posición: eje Y invertido (puesto 1 arriba). Si todos empatan en el puesto 1, evitar división por cero.
   - Con una sola etapa visible, dibujar igualmente el punto final.
6. Leyenda:
   - Posición: orden ascendente por puesto actual; muestra `#N · X pts`.
   - Puntos: orden descendente por puntos actuales; muestra `N pts · #N`.
   - Se usa el último índice visible (`timeline.length - 1`), no el índice fijo 12.
7. `orderPlayers`: mantiene al usuario logado primero y ordena al resto según la métrica (posición ascendente / puntos descendentes).
8. Toast del último punto:
   - Posición: `#N en <etapa>`.
   - Puntos: `N pts en <etapa>`.
9. Chips, búsqueda, filtro de invitados y resaltado del usuario logado se mantienen sin cambios.

### Eventos (`bindStatsEvents`)

- `.stats-evo-metric` → actualiza `estadisticasEvoMetric` y re-renderiza.
- `.stats-evo-mode` → actualiza `estadisticasEvoMode` y re-renderiza.
- El selector de fuente existente (`.stats-source`) sigue funcionando solo en vista Puntos.

### Casos límite

- Sin etapas con resultados: se mantiene el estado vacío actual.
- Una sola etapa: punto final visible sin depender de la polilínea.
- Todos empatados en posición 1: escala estable.
- Clasificación y eliminatorias: en modo `Por jornada` aparecen como pico en la etapa en que se otorgan; en acumulado se integran en la línea.
- Invitados: mismo filtrado actual (`statsHideGuests` / `statsFilterMap`).
- Jugadores sin datos: se mantiene el criterio actual (`hasData`) para decidir qué líneas se dibujan; aun así, su puesto se calcula sobre todos los jugadores.

### Fuera de alcance

- No se cambia el cálculo de `calcPositionHistory` usado por la pestaña **Individual**.
- No se toca la API ni el modelo de datos de `api-porra`.
- No se añaden nuevas fuentes de puntos ni se altera el cálculo de puntos existente.

### Infraestructura y cache-busting

- Bump de versión de `js/stats.js` y `css/styles.css` en `index.html` (regla de `AGENTS.md`).
- Nuevos estilos de los selectores reutilizando variables de `:root`.

## Tests

Tests node en `porra-spa/tests/` (ejecución directa con `node tests/<archivo>.js`):

- `toStagePoints`: serie acumulada con ceros, saltos y `hasData`.
- `calcEvolutionPositions`: empates comparten puesto, varias etapas, jugador sin datos.
- `lastTimelinePoint` / `trimTimeline`: liga, fases eliminatorias, sin partidos, una sola etapa.
- Defaults de estado (`posicion` / `acumulado`).
- Se mantienen los tests existentes de `estadisticas.test.js` y `estadisticas-subtabs.test.js`.

## Verificación manual

1. Estadísticas → Evolución: abre en **Posición** y muestra el ranking por etapa hasta la última con resultados.
2. Cambiar a **Puntos** → **Acumulado**: líneas acumuladas; el total final coincide con la clasificación.
3. Cambiar a **Por jornada**: se ven picos aislados por etapa; la suma de deltas coincide con el acumulado.
4. Cambiar de fuente en Puntos: cada fuente responde.
5. Posición con empates: varios jugadores comparten puesto.
6. Invitados y usuario logado: filtrado y resaltado intactos.
7. Consola sin excepciones y sin scroll horizontal en móvil vertical.
