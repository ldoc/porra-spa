# Spec — Estadísticas › Estilo y suerte (Fase 2)

Fecha: 2026-11-06 · Estado: aprobado tras brainstorming
Predecesor: `docs/superpowers/specs/2026-11-06-jugador-v2-design.md`

## 1. Objetivo

Añadir a la sub-pestaña **Individual** tres métricas de estilo: suerte vs habilidad, robos/faroles y acierto según la confianza de la porra. Todo se calcula en cliente reutilizando predicciones, resultados y puntos ya disponibles. Sin cambios de API ni de backend.

## 2. Alcance

### 2.1 En alcance

- Puntos esperados vs reales y etiqueta de suerte.
- Detección de robos (acierto minoritario) y faroles (fallo con la opción más votada).
- Acierto 1X2 y exactos agrupado por apoyo de la porra al pick del usuario.

### 2.2 Fuera de alcance

- Duelo H2H, consenso global, explorador de partido, equipos sobre/infravalorados y bracket (Fase 3).
- Records, premios y resumen compartible (Fase 4).
- Cambios de backend, endpoints o payloads.

## 3. Datos y definiciones

### 3.1 Dataset

- Solo partidos de liga (`fase === 'liga'`) ya jugados (`playedMatches` con resultado).
- El usuario debe tener un pronóstico 1X2 completo (`home` y `away` finitos).
- La comunidad son los jugadores de `statsPlayers()` excluyendo al propio usuario. Cada partido necesita al menos **5 pronósticos de otros usuarios**; si no, se excluye y se cuenta como "pocos datos".
- Los puntos reales se leen de `userPoints[username].matchDetails`; no se duplica el scoring.

### 3.2 Consenso por partido

Para cada partido y usuario se construye un consenso con los pronósticos de los demás:

```javascript
{
  total,                              // nº de pronósticos ajenos válidos
  counts: { H, D, A },                // votos por resultado
  pct: { H, D, A },                   // porcentajes enteros
  scoreCounts: Map<string, number>,   // "2-1" → votos
  homeGoalCounts: Map<number, number>,// goles local → votos
  awayGoalCounts: Map<number, number>,// goles visitante → votos
  plurality                           // 'H' | 'D' | 'A' | null
}
```

- `plurality` = resultado más votado; empates se resuelven por orden `H > D > A`.
- El usuario analizado nunca forma parte de su propio consenso.

### 3.3 Puntos esperados

Con probabilidades empíricas de la comunidad:

```text
esperado = 8·P(resultado)
         + 3·P(goles local)
         + 3·P(goles visitante)
         + 1·P(marcador exacto)
```

- `P(resultado) = counts[resultado] / total`.
- `P(goles local) = homeGoalCounts[pred.home] / total`.
- `P(goles visitante) = awayGoalCounts[pred.away] / total`.
- `P(exacto) = scoreCounts["home-away"] / total`.
- La función pura devuelve el valor redondeado a 2 decimales; la UI lo muestra con 1 decimal.

### 3.4 Suerte vs habilidad

- `puntos reales` = suma de puntos del usuario en los partidos analizados.
- `puntos esperados` = suma de los esperados de esos partidos.
- `suerte neta = reales − esperados`.
- `suerte/partido = suerte neta / partidos analizados`.
- Etiqueta:
  - `suerte/partido ≥ +1` → `afortunado`.
  - `suerte/partido ≤ −1` → `desafortunado`.
  - resto → `neutro`.
  - Sin partidos analizados → `null`.

### 3.5 Robos y faroles

- **Robo**: el usuario acierta el 1X2, su opción tiene **<50%** de apoyo de la comunidad y sus puntos superan la media de puntos de los otros usuarios en ese partido.
- **Farol**: el usuario falla el 1X2 y su opción es la `plurality` de la comunidad.
- La media del partido se calcula con los otros usuarios que pronosticaron y tienen puntos disponibles en `userPoints`; si ninguno tiene puntos, la media es 0.
- Se devuelven todos los ejemplos ordenados:
  - Robos: mayor delta sobre la media primero; empate, menor apoyo.
  - Faroles: mayor apoyo primero; empate, menos puntos.
- La UI muestra como máximo 3 de cada tipo.

### 3.6 Acierto por confianza

Se agrupa cada partido analizado por el apoyo de la comunidad a la opción 1X2 del usuario:

| Grupo | Apoyo |
|---|---|
| Mayoría | ≥50% |
| Ajustada | 33–49% (≥33 y <50) |
| Minoría | <33% |

Por grupo: partidos, aciertos 1X2, `% acierto`, exactos y `% exactos`. Los porcentajes se redondean al entero.

### 3.7 Casos límite

- Sin partidos analizables: contadores a 0, `luckLabel = null` y empty states.
- Partido con menos de 5 pronósticos ajenos: se excluye y se cuenta en `excludedLowSample`.
- Partidos de eliminatorias o sin resultado: se ignoran.
- Pronóstico sin marcador completo: se ignora.
- Datos de `matchesById` ausentes: se ignora el partido (no se puede verificar que sea liga).
- Invitados: se excluyen vía `statsPlayers()` antes de construir la comunidad.

## 4. UX

Las tres tarjetas se añaden al final de **Individual**, después de "Sesgo" y antes de "Plantilla", sin cambiar el orden existente.

### 4.1 🍀 Suerte vs habilidad

Texto explicativo:

> Compara tus puntos reales con los que cabría esperar según lo que votó la porra en cada partido. Por encima de lo esperado tuviste buena suerte; por debajo, fuiste desafortunado.

Contenido:

- KPIs 2×2: `Puntos reales`, `Puntos esperados`, `Suerte neta`, `Partidos analizados`.
- Dos barras comparativas real vs esperado, escaladas al máximo de ambas.
- Pill: `afortunado` / `neutro` / `desafortunado`.
- Nota: `Suerte neta = puntos reales − esperados. El esperado combina resultado (8), goles de cada equipo (3+3) y marcador exacto (1). Solo partidos con al menos 5 pronósticos de otros usuarios.`
- Empty: `Aún no hay partidos con muestra suficiente: necesitamos al menos 5 pronósticos de otros usuarios por partido.`

### 4.2 🎭 Robos y faroles

Texto explicativo:

> Un robo es acertar el resultado con una opción que casi nadie eligió. Un farol es seguir a la mayoría y fallar.

Contenido:

- KPIs: `Robos` y `Faroles`.
- Sección `Robos` con subtítulo `Aciertos minoritarios que te dieron ventaja sobre la media del partido.`
- Sección `Faroles` con subtítulo `Fallos con la opción más votada: la porra se equivocó contigo.`
- Hasta 3 ejemplos por sección:
  - Robo: jornada, equipos, marcador, puntos, `% que te siguió` y delta vs media.
  - Farol: jornada, equipos, 1X2 elegido, `% de la porra que falló contigo` y puntos.
- Nota: `Solo se analizan partidos con al menos 5 pronósticos de otros usuarios.`
- Empty robos: `Aún no hay robos: necesitas acertar en minoría y superar la media del partido.`
- Empty faroles: `Aún no hay faroles: necesitas fallar con la opción más votada.`

### 4.3 🎚️ Acierto por confianza

Texto explicativo:

> Agrupa tus partidos según cuánto apoyó la porra tu elección 1X2. Sirve para ver si aciertas más cuando vas con la mayoría o cuando te arriesgas.

Contenido:

- Tres filas:
  - `Mayoría` · `≥50% eligió tu opción`.
  - `Ajustada` · `33–49% eligió tu opción`.
  - `Minoría` · `<33% eligió tu opción`.
- Cada fila: barra de acierto 1X2, `x/y · pct%`, y debajo `N exactos · pct%` + tamaño de muestra.
- Nota: `La confianza mide el apoyo de la porra a tu pronóstico, no tu seguridad personal.`
- Si un grupo no tiene partidos: `—`.
- Empty global: `Aún no hay partidos con muestra suficiente para medir la confianza.`

### 4.4 Móvil

- Reutilizar `stats-card`, `stats-kpi-grid`, `stats-rank-sub`, `stats-pill` y `stats-empty`.
- Añadir CSS mínimo para barras de suerte, filas de robos/faroles y filas de confianza.
- Sin desbordamiento horizontal en 320 px y 375 px.

## 5. Arquitectura

Todo en `js/stats.js`, patrón IIFE + funciones puras exportadas.

### 5.1 Funciones puras nuevas

```javascript
// Map<matchId, { total, counts, pct, scoreCounts, homeGoalCounts, awayGoalCounts, plurality }>
buildMatchConsensus(allPredictions, playerNames, excludeUsername)

// Número redondeado a 2 decimales; consensus.total <= 0 → 0.
expectedPointsForPrediction(prediction, consensus)

// {
//   analyzedMatches, excludedLowSample,
//   actualPoints, expectedPoints, luckDelta, luckPerMatch, luckLabel,
//   robos: { count, items: [...] },
//   faroles: { count, items: [...] },
//   confidence: { majority, tight, minority }
// }
calcStyleStats(username, playedMatches, allPredictions, userPoints, matchesById, playerNames)
```

Cada item de robos/faroles:

```javascript
{ matchId, match, pred, result, points, avgPoints, delta, supportPct, exact }
```

Cada grupo de confianza:

```javascript
{ matches, hits, hitPct, exacts, exactPct }
```

### 5.2 Integración

- `renderIndividualBody` calcula `styleStats` solo para el usuario seleccionado, usando `statsPlayers().map(p => p.name)` y `AppState.allPredictions`.
- Nuevos renderers: `renderLuckCard`, `renderRobosFarolesCard`, `renderConfidenceCard`.
- Se insertan en el `return` de `renderIndividualBody` después de `sesgoCard` y antes de `plantillaCard`.
- No se añaden agregados globales: el cálculo es por usuario y barato (una pasada sobre partidos jugados).

### 5.3 CSS y cache-busting

- Nuevas clases: `.stats-luck-*`, `.stats-style-*`, `.stats-conf-*`.
- `index.html`: `js/stats.js?v=22` y `css/styles.css?v=137`.

## 6. Tests

Nuevo fichero `tests/estadisticasEstilo.test.js` (Node `assert`, mismo estilo que los existentes) o ampliación de `estadisticasJugadorV2.test.js` si no crece demasiado.

Casos mínimos:

1. `expectedPointsForPrediction` con distribución conocida: resultado, goles local/visitante y exacto.
2. `buildMatchConsensus` excluye al usuario indicado y calcula `plurality` con desempate `H > D > A`.
3. `calcStyleStats` excluye partidos con menos de 5 pronósticos ajenos y los cuenta en `excludedLowSample`.
4. Robo: acierto minoritario con puntos por encima de la media.
5. Farol: fallo con la opción más votada.
6. Buckets de confianza: mayoría, ajustada y minoría, con `hitPct`/`exactPct`.
7. Solo liga: partidos de eliminatorias ignorados.
8. Sin partidos analizables: contadores a 0, `luckLabel = null`, confianza a cero.
9. Invitados excluidos por la lista de nombres recibida.

Regresión: `estadisticasJugadorV2`, `estadisticas`, `estadisticas-subtabs`, `estadisticasEvolucion`, `estadisticasIndividualDesempate`.

## 7. Verificación

- Ejecutar el test nuevo y las cinco suites de estadísticas.
- `node -e "require('./js/stats.js')"` sin errores.
- Harness headless a 320/375 px con datos sintéticos: sin errores de consola, sin overflow, empty states correctos, invitado oculto excluido.
- Revisión final de rama completa antes de cerrar.

## 8. Criterios de aceptación

- Las tres tarjetas aparecen en Individual con los textos explicativos acordados.
- Los puntos esperados cuadran con la fórmula 8+3+3+1 y excluyen al propio usuario.
- Robos y faroles respetan las definiciones y la muestra mínima de 5.
- La confianza agrupa correctamente por apoyo y muestra `—` cuando no hay datos.
- Cero cambios de API y cero regresiones.

## 9. Riesgos y decisiones

- **Ruido con muestras pequeñas:** se exige mínimo 5 ajenos y se informa de partidos excluidos.
- **Exacto disperso:** el componente exacto solo aporta 1 punto; su impacto en el esperado es limitado.
- **Crecimiento de `stats.js`:** se añade un bloque delimitado y funciones puras exportadas; la modularización queda fuera de alcance.
- **Confianza:** se mide el apoyo de la porra al pick, no la seguridad subjetiva del usuario; el microcopy lo aclara.
