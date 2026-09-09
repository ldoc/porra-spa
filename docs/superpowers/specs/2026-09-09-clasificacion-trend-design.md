# Indicador de tendencia en Clasificación (vs día anterior con partidos)

## Contexto

La pestaña `tab-clasificacion` (`renderClasificacionTab()` en `js/main.js:1135`) recalcula los puntos reales de cada usuario (`computeUserRealPoints`: pronóstico + plantilla + clasificación + eliminatorias), ordena por `realPoints` desc y pinta filas con `buildClasificacionRow()` (`js/main.js:1118`). No existe histórico de posiciones.

Ya hay auto-refresh: `fetchMatchStatsUpdated()` hace polling cada 60s a `/api/match-stats/updated` y re-renderiza `clasificacion`/`resultados` cuando cambia `count`/`lastUpdated`.

Se quiere un indicador por usuario en la clasificación: permanece igual (＝ azul), sube (▲ verde) o baja (▼ roja) respecto a la "subida" anterior, mostrando además cuántos puestos (ej. ▲2, ▼1). Definición acordada de "subida": **todos los partidos del mismo día cuentan como la misma subida** (fecha del partido, no momento de carga). Se compara el ranking con partidos hasta el **último día con partidos** frente al ranking con partidos hasta el **penúltimo día con partidos**.

## Diseño

### Definición de días

- Día de un partido = día local `YYYY-MM-DD` derivado de `AppState.matches[].fechaTs` (segundos Unix, misma lógica de fecha local que `js/hoyPartidos.js`: `new Date(fechaTs * 1000)` con `getFullYear/getMonth/getDate`).
- Días con resultados = días que tienen ≥1 `matchStat` cuyo partido (`eventId → match.id`) cae en ese día. Partidos con `matchStat` pero sin `fechaTs` resoluble se ignoran para el cálculo de días.
- `getLastTwoMatchDays(matches, matchStats)` devuelve `{ prev, last }` ordenados ascendentemente, o `null` si hay <2 días con resultados → en ese caso no se muestra ningún indicador.
- Los días sin partidos se saltan siempre: se comparan los dos últimos días **con** resultados aunque haya días vacíos entre medias (o antes).

### Cálculo (funciones NUEVAS, sin tocar las existentes)

Restricción: `calculateUserTotalPoints`, `getRealTeamStats`, `calculateRealStandings` y `calculateClassificationPoints` leen globales (`AppState.matchStats`) y usan cachés (`AppState.realStandings`, `AppState.classificationPoints`). **No se modifican.** Todo lo nuevo va en funciones nuevas parametrizadas:

```javascript
getMatchDayKey(fechaTs)                       // 'YYYY-MM-DD' local o null
getLastTwoMatchDays(matches, matchStats)      // { prev, last } o null
filterMatchStatsUpTo(dayKey, matches, matchStats) // subset con día <= dayKey
computeRankingForStats(matchStatsSubset)      // [{ name, realPoints }] ordenado
computeTrendMap(prevRanking, currRanking)     // { username: { prevRank, currRank, diff } }
```

`computeRankingForStats(subset)` replica el total con el subset filtrado, reutilizando lo ya parametrizable sin cambios:

- Pronóstico: mismo bucle que `calculateUserTotalPoints` pero sobre un `Map(eventId → matchStat)` del subset (no `AppState.matchStats.find` global).
- Plantilla: `calculateSquadPoints(squad, subset)` (ya acepta parámetro, se reutiliza tal cual).
- Clasificación: versiones parametrizadas nuevas que espejan la lógica actual (`computeRealStandingsForStats(subset, matches, teamsMap)` + `computeClassificationPointsForStats(...)`) **sin leer ni escribir** `AppState.realStandings` / `AppState.classificationPoints`.
- Eliminatorias: `computeReachedPhases(matches, subset)` + `calculateEliminatoriasPoints(userFp, reached)` (ambas ya puras/parametrizadas en `js/eliminatorias.js`, se reutilizan).
- `isClassificationCounting()` (depende de la fase actual) se aplica igual a ambos cortes; se documenta como supuesto asumido (la fase histórica se desconoce).

Orden del ranking histórico: mismo criterio que el actual (solo `realPoints` desc, sort estable) para que el diff sea coherente. `diff = prevRank - currRank`: `>0` sube, `<0` baja, `0` igual. Cada fila del ranking lleva además `predictedCount` (pronósticos completos del usuario en partidos del corte). Sin indicador cuando el usuario falta en el ranking previo **o** su `predictedCount` en el corte anterior es 0 (usuario nuevo: sin partidos pronosticados hasta el día anterior).

El ranking visible actual se sigue calculando con el código existente intacto (con globales + cachés). El ranking histórico solo alimenta el diff y su cómputo se envuelve en `try/catch` en `renderClasificacionTab()`: si algo falla, la tabla se pinta sin indicadores.

Coste: un re-cómputo completo adicional solo cuando hay ≥2 días con resultados (jugadores × 144 partidos; mismo orden de magnitud que el render actual).

### Cambios en render

`buildClasificacionHeader(showTrendCol = false)` y `buildClasificacionRow(p, rank, isMe, trendCellHtml = null)`: parámetros nuevos **opcionales** (no rompen llamadas ni tests actuales). Si `trendCellHtml` es `null` se pinta la fila clásica de 6 columnas; si es string se añade la 2ª celda y la clase `with-trend`. La celda se construye con `buildTrendCellHtml(trend)` (función pura nueva en `js/trend.js`):

```html
<span class="trend trend-up" title="Sube 2 puestos respecto al día anterior con partidos" aria-label="Sube 2 puestos respecto al día anterior con partidos"><span>▲</span><span>2</span></span>
<span class="trend trend-down" ...><span>1</span><span>▼</span></span>
<span class="trend trend-same" ...><span>＝</span></span>
```

El número va siempre en el sentido del movimiento (sube: ▲ arriba / número abajo; baja: número arriba / ▼ abajo); el ＝ va solo, sin número.

Sin `trend` en una fila (usuario nuevo o error) la celda queda vacía. Con <2 días con resultados la columna se oculta por completo (vuelve el grid original de 6 columnas). Leyenda bajo la tabla solo cuando hay trend disponible: `▲ sube · ▼ baja · ＝ igual vs día anterior`. La cabecera (`buildClasificacionHeader`) añade una 2ª celda vacía (columna sin título entre Jugador y Pron) y el grid de `.clasificacion-header` / `.clasificacion-row` pasa a `1fr minmax(18px,24px) repeat(5, minmax(22px,32px))` (columna estrecha que solo crece con movimientos de dos dígitos).

### Estilos CSS

En `css/styles.css`, junto a `.rank-pill`:

```css
.clasificacion-header.with-trend, .clasificacion-row.with-trend {
  grid-template-columns: 1fr minmax(18px,24px) repeat(5, minmax(22px,32px));
}
.trend { display: flex; flex-direction: column; align-items: center; line-height: 1.15; font-size: 9px; font-weight: 800; font-variant-numeric: tabular-nums; }
.trend-up { color: #10B981; }
.trend-down { color: #EF4444; }
.trend-same { color: #38BDF8; }
```

Reutilizar variables existentes si existen equivalentes; span no interactivo (sin requisito táctil 44px).

### Casos borde

- 0–1 días con resultados → sin indicadores, sin leyenda, tabla idéntica a la actual.
- Empates a puntos → mismo orden estable en ambos cortes; diff coherente.
- Usuario nuevo el último día (0 pronósticos hasta el día anterior) → celda vacía en su fila.
- `fechaTs` ausente → partido excluido del cálculo de días (no bloquea).
- Error en cómputo histórico → tabla sin indicadores (fail-safe).

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `js/trend.js` (nuevo) | Módulo IIFE (patrón `hoyPartidos.js`): puras de días/filtrado/trend + `buildTrendCellHtml`. Sin acceso a `AppState`/DOM en carga (testeable en node) |
| `js/main.js` | `computeRankingForStats` (swap temporal de `matchStats` + cachés con `try/finally`) + `getClasificacionTrendMap` (fail-safe) + params opcionales en header/row + hook en `renderClasificacionTab` |
| `css/styles.css` | Estilos `.trend`, `.trend-up/down/same` |
| `index.html` | Cache-busting: incrementar `?v=` de `js/main.js` y `css/styles.css` (norma AGENTS.md) |
| `tests/trend.test.js` (nuevo, o extender `clasificacionTable.test.js`) | Tests de puras: agrupar por día, filtrar por corte, ranking + trend, empates, 1 solo día, usuario nuevo |

## Verificación

1. Con 1 solo día con resultados: tabla sin indicadores ni leyenda.
2. Con 2+ días: cada fila muestra el indicador correcto contra el penúltimo día con partidos (▲ con N debajo, N con ▼ debajo, ＝ solo), incluyendo el salto de días vacíos (comprobar a mano con 2–3 usuarios y `N` puestos).
3. Usuario nuevo el último día: sin indicador.
4. `node tests/trend.test.js` (y suite existente) en verde; consola sin excepciones; layout mobile 480px sin scroll horizontal.
