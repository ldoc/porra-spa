# Combo de orden por fuente en Clasificación (2026-10-22)

## Resumen

Añadir un `<select>` en la fila del toggle de la tab Clasificación para ordenar la tabla por: **Total** (default), Pronosticos, Plantilla, Clasificacion o Eliminatorias. La fila del toggle pasa a visible siempre que haya tabla con puntos (todo excepto `FASE_PRETEMPORADA`); el checkbox solo se inyecta en `FASE_LIGA` (sin cambio).

## Decisiones con el usuario

1. **Desempates**: columna elegida desc; en empate, comparador de normas existente (`compareClasificacionJugadores`).
2. **Vida del estado**: se pierde al salir de la pantalla (reset en `navigateToTab`, igual que el checkbox); re-renders por polling lo conservan. Sin persistencia.
3. **Trend**: las flechas ▲▼ y su leyenda SOLO se muestran con orden `total`; con otro orden se omiten (evita confusión: el trend es por Total).
4. **Posición**: junto al checkbox, misma fila centrada.

## Cambios

### `js/clasificacion.js`
- `sortClasificacionJugadores(rows, sortBy = 'total')`: nuevo parámetro opcional. Con `sortBy === 'total'`: `compareClasificacionJugadores` (idéntico a hoy). Con fuente `(pron|plant|clas|eli)`: ordenar por `predictionPoints|squadPoints|classificationPoints|eliminatoriasPoints` desc y, en empate, `compareClasificacionJugadores`. Exportado (ya en `api`/`module.exports`).
- Helper puro auxiliar `compareRowsPorFuente(a, b, sortBy)` interno o in-line en el sort. `compareClasificacionJugadores` sin cambios.

### `js/main.js`
- **Estado**: `AppState.clasifSortBy: 'total'`; reset a `'total'` en `navigateToTab` junto a `clasificacionClasOn` (mismo bloque `tabName !== 'clasificacion'`).
- **`syncClasifClasHeaderToggle()` → inyección de fila generalizada**: visible siempre que `!isFasePretemporada()`; la fila contiene: checkbox (solo `FASE_LIGA`, como hoy, con `title`) + `<select id="clasif-sort-select">` con opciones `total/pronosticos/plantilla/clasificacion/eliminatorias` (labels: Total, Pronosticos, Plantilla, Clasificacion, Eliminatorias) y `onchange="setClasifSortBy(this.value)"`. El `value` inicial del select es `AppState.clasifSortBy` en cada sync (idempotente: re-crea el innerHTML de la fila). Si no hay-checkbox ni combo que mostrar, no inyectar.
- **Handler nuevo**: `setClasifSortBy(value)` — setea `AppState.clasifSortBy` y `renderClasificacionTab()`.
- **`renderClasificacionTab`**: llamada a la sync ya existe (al principio). El sort de `playersWithPoints` pasa de `playersWithPoints.sort(cmpJugadores)` a `sortClasificacionJugadores(playersWithPoints, AppState.clasifSortBy)` (con guard `typeof clasificacionApi`). El bloque trend (`getClasificacionTrendMap`, `withTrend`, leyenda) se ejecuta solo si `AppState.clasifSortBy === 'total'`.
- **Invitados**: sin cambio (el sort es de la tabla, aplica a todos igual).

### `css/styles.css`
- `.clasif-clas-sort` (o reuso de la fila existente): `<select>` compacto alineado con el checkbox, `min-height: 44px` de fila ya existente, variables de `:root`, sin colores estáticos.

### Tests
- `tests/clasifClasToggle.test.js`: ampliar/crear test que importe `sortClasificacionJugadores` con las 5 fuentes y verifique total-desc + tiebreak de normas; checks de fuente de la fila generalizada (`clasif-sort-select`, `setClasifSortBy`, combo solo en la fila) y cache-busting (`main.js?v=179`, `clasificacion.js?v=3`, `styles.css?v=131`).

### Cache-busting
- `index.html`: `js/main.js?v=178→179`, `js/clasificacion.js?v=2→3` (línea 326), `css/styles.css?v=130→131` (línea 19).

## Sin cambios

- Comportamiento con orden Total (exacto al de hoy, incluido trend).
- Modales de perfil, "Tus puntos", Estadísticas, resultados/líve.
- Checkbox FASE_LIGA-solo y reset al salir.
