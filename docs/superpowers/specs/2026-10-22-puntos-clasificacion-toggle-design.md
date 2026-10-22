# Toggle de puntos por clasificación en Clasificación (2026-10-22)

## Resumen

Añadir un switch en la pestaña **Clasificación** que permita incluir o excluir los puntos por clasificación en la columna "Clas", en el **Total** y por tanto en el reordenamiento de la tabla. Por defecto está en `false` cada vez que se entra. Cuando termina la fase de liga (desde `FASE_PRE16` en adelante), el switch desaparece y los puntos por clasificación cuentan siempre (comportamiento actual de `isClassificationCounting()`).

## Decisiones tomadas con el usuario

1. **Alcance**: solo pantalla Clasificación (columnas, Total, orden y trend). No afecta al contador "Tus puntos" del header, ni a los modales de perfil, ni a Inicio/Estadísticas.
2. **Columna "Clas"**: con el toggle desactivado muestra 0 (comportamiento actual en fase liga). Activado muestra los puntos calculados y los suma al Total, reordenando la tabla.
3. **Fases**: el switch solo aparece en `FASE_LIGA`.
4. **Vida del estado**: se pierde al salir de la pantalla (re-entrar desde el menú lo reinicia a `false`). Sin persistencia.

## Diseño

### Enfoque elegido: parámetro explícito (A)

- `computeUserRealPoints(username, includeClassification)` en `js/main.js`:
  - Nuevo parámetro opcional. Default: `isClassificationCounting()` → sin cambios de comportamiento en llamadas existentes.
  - Con `true` y fase `FASE_LIGA`: calcula `classificationPoints` con `calculateClassificationPoints(username)` (clasificación real parcial vía `calculateRealStandings`), los suma en `computeRealPointsTotal`.
- `computeRankingForStats(matchStatsSubset)` acepta el flag y lo propaga a `computeUserRealPoints` (con el swap temporal de `AppState.matchStats`/cachés en `try/finally` respeta la caché `AppState.classificationPoints`).
- `getClasificacionTrendMap(currentRows)` propaga el flag para que las flechas ▲▼ comparen rankings consistentes (día anterior y actual con la misma regla).

### Estado

- Nuevo campo `AppState.clasificacionClasOn` (boolean, default `false`, se declara explícitamente en el objeto `AppState`).
- Reset a `false` en `navigateToTab(tabName)` cuando `tabName !== 'clasificacion'` (mismo patrón que `AppState.resultadosRound` en `js/main.js:3375`).
- Los re-renders por polling de matchstats (`renderClasificacionTab` re-invocado con la tab activa) NO resetean el flag.
- Al recargar la página: `false` (no hay persistencia en localStorage).

### Render

- `renderClasificacionTab()` (`js/main.js:1164`):
  - Si `isClassificationCounting()` es `false` y `getFaseJuego() === 'FASE_LIGA'`: renderizar encima de la tabla un switch (estilo del sistema, área táctil ≥44x44px, variables CSS de `:root`) con etiqueta **"Incluir puntos por clasificación"** + hint de que los puntos varían tras cada partido.
  - El estado inicial del checkbox es `AppState.incluirClasClasif`.
  - Al togglear: actualizar el flag y re-renderizar la tab.
  - Pasar el flag a `computeUserRealPoints` en el mapeo de `playersWithPoints`.
- `buildClasificacionHeader()` y `buildClasificacionRow()` no cambian de firma: consumen los valores ya calculados.

### Fuera de alcance (sin cambios)

- Modal de perfil (tabs Pronósticos/Plantilla/Clasificación/Eliminatorias): el total y el desglose por equipos de la tab Clasificación se muestran como hoy.
- Contador "Tus puntos" (`getUserTotalRealPoints`), menú de puntos de Inicio, Estadísticas.

### Caché e invalidación

- `AppState.classificationPoints` (caché por usuario en `calculateClassificationPoints`) ya se invalida con `invalidateClassificationCache()` al actualizar matchstats: no requiere cambios.

### Infraestructura y tests

- Bump de versión de `js/main.js` en `index.html` (regla cache-busting de AGENTS.md). Bump de `css/styles.css` si se añaden estilos del switch.
- Estilización del switch en `css/styles.css` reutilizando variables de `:root`.
- Tests node (`tests/`): los de `clasificacionTable.test.js` no dependen de las firmas nuevas (solo header/row); añadir fuzz mínimo si extraemos el cálculo a helper puro. Verificación manual: `serve` local + consola sin excepciones.

## Verificación

1. En `FASE_LIGA`: switch visible; al desactivar → igual que hoy; al activar → Clas > 0, Total suma, tabla reordena, trend consistente.
2. Al re-entrar a Clasificación: switch vuelve a `false` y la tabla al estado base.
3. Pretemporada: sin switch. Desde `FASE_PRE16`: sin switch y Clas siempre sumada (comportamiento actual).
4. "Tus puntos" del header y modales de perfil: sin cambios al togglear.
