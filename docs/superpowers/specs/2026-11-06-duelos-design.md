# Spec — Estadísticas › Duelos (Fase 3)

Fecha: 2026-11-06 · Estado: aprobado tras brainstorming
Predecesor: `docs/superpowers/specs/2026-11-06-estilo-suerte-design.md`

## 1. Objetivo

Añadir a Estadísticas una sub-pestaña **Duelos** para comparar a dos usuarios cara a cara mediante 28 categorías. Cada categoría se desvela al hacer scroll, suma 1 punto al ganador y el marcador se actualiza con animación. Al final, confeti y fuegos artificiales en el lado del ganador.

Todo se calcula en cliente con los datos ya disponibles. Sin cambios de API ni backend.

## 2. Alcance

### 2.1 En alcance

- Nueva sub-pestaña `Duelos`.
- Dos selectores manuales de usuario (izquierda/derecha).
- 28 categorías de comparación, cada una en su propia tarjeta con explicación.
- Marcador fijo arriba, revelado por scroll y animación final.
- Tests de cálculo puro y verificación visual móvil.

### 2.2 Fuera de alcance

- Otras métricas sociales (consenso vs resultado, explorador de partido, equipos sobre/infravalorados, bracket) pasan a otra fase.
- Records y resumen compartible (Fase 4).
- Cambios de API/backend.

## 3. Reglas generales

- Solo partidos de liga (`fase === 'liga'`) con resultado para las métricas de partidos/jornadas.
- Los puntos reales se leen de `userPoints[username].matchDetails`; el scoring no se duplica.
- Los puntos por fuente salen de `sourceSplitFromUserData`.
- `statsPlayers()` filtra invitados según el espectador; los invitados ocultos no aparecen en los selectores.
- Si faltan datos para una categoría en cualquiera de los dos usuarios, la categoría es **No disputada** y no reparte punto.
- Si los dos usuarios son el mismo, no se inicia el duelo.
- Si no hay partidos con resultado, se muestra un empty state.
- Si los pronósticos del rival no están publicados, se muestra `Duelo disponible cuando se publiquen los pronósticos.`

## 4. Las 28 categorías

Cada categoría devuelve dos valores y un ganador (`left`, `right`, `tie`, `na`). Dirección `higher` = gana el valor mayor; `lower` = gana el menor. En las categorías “peor”, se usa `higher` sobre el mínimo para que gane el **menos malo**.

| # | Clave | Título | Explicación | Criterio | Formato | No disputada si… |
|---|---|---|---|---|---|---|
| 1 | `points_prediction` | Puntos pronósticos | Puntos conseguidos con los marcadores de los partidos. | Mayor | entero | — |
| 2 | `points_squad` | Puntos plantilla | Puntos de tu plantilla ideal. | Mayor | entero | — |
| 3 | `points_classification` | Puntos clasificación | Puntos por acertar la clasificación final; durante la liga se muestra el cálculo provisional. | Mayor | entero | — |
| 4 | `points_eliminatorias` | Puntos eliminatorias | Puntos del cuadro de eliminatorias. | Mayor | entero | — |
| 5 | `points_total` | Puntos totales | Suma de las cuatro fuentes de puntos. | Mayor | entero | — |
| 6 | `hits_1x2` | Aciertos 1X2 | Partidos en los que acertaste el resultado. | Mayor | entero | — |
| 7 | `exact_scores` | Marcadores exactos | Partidos en los que acertaste el marcador completo. | Mayor | entero | — |
| 8 | `best_match` | Mejor partido | Tu mayor puntuación en un solo partido, sumando pronóstico y jugadores. | Mayor | entero | Falta el mejor partido de alguno |
| 9 | `worst_match` | Peor partido | Tu puntuación más baja sumando pronóstico y jugadores; gana la menos mala. | Mayor (min) | entero | Falta el peor partido de alguno |
| 10 | `best_jornada` | Mejor jornada | Tu mayor puntuación en una jornada completa. | Mayor | entero | No hay jornadas completas |
| 11 | `worst_jornada` | Peor jornada | Tu jornada más baja; gana la menos mala. | Mayor (min) | entero | No hay jornadas completas |
| 12 | `consistency` | Regularidad | Desviación de tus puntos por jornada; gana el más regular. | Menor σ | 1 decimal | Alguno tiene <2 jornadas |
| 13 | `momentum` | Momentum | Media de las últimas 3 jornadas frente a tu media de temporada. | Mayor | 1 decimal con signo | Alguno tiene <3 jornadas |
| 14 | `best_exact_streak` | Mejor racha de exactos | Marcadores exactos consecutivos; gana la racha más larga. | Mayor | entero | Alguno no tiene partidos jugados |
| 15 | `best_player` | Mejor jugador | El jugador de tu plantilla con más puntos. | Mayor | entero | Alguno no tiene jugadores con partidos |
| 16 | `worst_player` | Peor jugador | El jugador con menos puntos; gana el menos malo. | Mayor (min) | entero | Alguno no tiene jugadores con partidos |
| 17 | `robos` | Robos | Aciertos minoritarios que te dieron ventaja sobre la media. | Mayor | entero | Alguno no tiene partidos analizados |
| 18 | `faroles` | Faroles | Fallos con la opción más votada; gana quien tenga menos. | Menor | entero | Alguno no tiene partidos analizados |
| 19 | `luck_per_match` | Suerte/partido | Puntos reales menos puntos esperados por partido. | Mayor | 1 decimal con signo | Alguno no tiene partidos analizados |
| 20 | `minority_hit` | Acierto en minoría | Acierto 1X2 cuando tu opción tenía menos del 33% de apoyo. | Mayor | porcentaje | Alguno tiene <3 partidos en minoría |
| 21 | `times_top_jornada` | Veces mejor de la jornada | Jornadas en las que igualaste la máxima puntuación de la porra. | Mayor | entero | No hay jornadas completas |
| 22 | `avg_points_per_match` | Media de puntos por partido | Puntos de pronósticos divididos entre partidos jugados. | Mayor | 1 decimal | Alguno no tiene partidos jugados |
| 23 | `h2h_jornadas_won` | Jornadas ganadas | Jornadas completas en las que superaste a tu rival. | Mayor | entero | No hay jornadas completas |
| 24 | `h2h_partidos_won` | Partidos ganados | Partidos jugados en los que superaste a tu rival. | Mayor | entero | No hay partidos jugados |
| 25 | `biggest_win` | Mayor victoria | Tu mayor diferencia positiva en una jornada. | Mayor | entero con signo | No hay jornadas completas |
| 26 | `biggest_loss` | Mayor derrota | Tu mayor diferencia negativa; gana la menos abultada. | Mayor (min) | entero con signo | No hay jornadas completas |
| 27 | `best_rank` | Mejor puesto histórico | Tu mejor posición en la clasificación; gana el puesto más bajo. | Menor | `Nº` | No hay jornadas completas |
| 28 | `worst_rank` | Peor puesto histórico | Tu peor posición; gana el puesto más bajo (el menos malo). | Menor | `Nº` | No hay jornadas completas |

### 4.1 Detalles de cálculo

- **Puntos por fuente:** `split.prediction`, `split.squad`, `split.classification`, `split.eliminatorias`; total = suma.
- **Puntos clasificación:** usa `classificationProvisionalByUser`. Si la fase aún no cuenta clasificación, se calcula con la clasificación real actual y **no se suma a Puntos totales** hasta que la fase oficial lo active.
- **Aciertos/exactos/media:** `calcReliabilityRow` (`hits`, `exactScores`, `ptsPerMatch`).
- **Mejor/peor partido:** `calcMatchExtremesCombined` suma los puntos de pronóstico y los puntos de los jugadores de la plantilla en cada partido de liga.
- **Mejor/peor jornada:** máximo/mínimo de `leaguePoints[username]` (jornadas completas).
- **Regularidad:** `calcConsistency(leaguePoints)`.
- **Momentum:** `calcMomentum(leaguePoints)`.
- **Racha de exactos:** `calcExactStats(...).streaks.bestExact`.
- **Mejor/peor jugador:** máximo/mínimo `puntosTotal` entre `squadPoints.playerDetails` con al menos 1 partido.
- **Robos/faroles/suerte:** `styleByUser[username]`.
- **Acierto en minoría:** `styleByUser[username].confidence.minority.hitPct` con al menos 3 partidos en ese grupo.
- **Veces mejor:** `timesTopJornada[username]`.
- **Cara a cara por jornadas:** sobre `completedRondas`, comparar `leaguePoints` de ambos; victorias y deltas.
- **Cara a cara por partidos:** sobre `playedMatches`, comparar los puntos de cada partido desde `matchDetails`.
- **Mayor victoria/derrota:** máximo y mínimo delta de puntos por jornada (left − right).
- **Mejor/peor puesto:** mínimo/máximo de `positionHistory[username]`.

### 4.2 Marcador y desempate

- Cada categoría ganada suma **1 punto**; empate = **0**; `na` = **0**.
- `disputed` = categorías con ganador distinto de `na`.
- Gana quien tenga más puntos de categoría.
- Si empatan a categorías: desempata **puntos totales** → **puntos plantilla** → **puntos pronósticos**.
- Si sigue empatado: duelo empatado.
- La cabecera muestra `A x – y B` y `N de 28 categorías disputadas`.

## 5. UX

### 5.1 Navegación y estado

- `SUBTABS` añade `{ key: 'duelos', label: 'Duelos' }` al final.
- Estado: `AppState.duelosLeftUser`, `AppState.duelosRightUser` (null por defecto; selección manual).
- Al cambiar un selector se reinicia el duelo.

### 5.2 Cabecera fija

- Dos columnas con avatar y selector; centro `VS`.
- Marcador y barra de progreso en la misma tarjeta.
- La cabecera queda **fuera del área de scroll**, siempre visible al bajar.
- Estados:
  - Sin usuarios: `Elige dos usuarios para empezar el duelo.`
  - Mismo usuario: `Elige dos usuarios distintos.`
  - Sin datos del rival: `Este duelo estará disponible cuando se publiquen los pronósticos.`
  - Sin partidos: `Aún no hay partidos con resultado.`

### 5.3 Tarjetas de categoría

- Una tarjeta por categoría, sin agrupar en bloques.
- Cada tarjeta muestra: título, explicación, valores de ambos usuarios y badge:
  - `Gana <usuario> · +1`
  - `Empate · 0`
  - `No disputada`
- Las tarjetas empiezan **bloqueadas** (atenuadas, borde discontinuo, `🔒 Por desvelar`).
- El primer scroll activa el `IntersectionObserver`; al entrar en pantalla la tarjeta se ilumina, aparece un brillo, el valor ganador pulsa y se suma el punto.
- Una tarjeta solo se desvela una vez.

### 5.4 Marcador animado

- El número del ganador hace un “bump”.
- Sale un `+1` flotante en el lado del ganador.
- La barra de progreso avanza.
- El contador `N de 28 categorías` se actualiza.

### 5.5 Final

- Tras desvelar la última tarjeta: banner `🏆 Gana <usuario> x – y` y confeti + fuegos artificiales en el lado del ganador.
- Si el desempate acaba en empate: `🤝 Empate x – x` sin fuegos.
- Botón `Repetir duelo` que reinicia bloqueo, marcador y animaciones.

### 5.6 Accesibilidad y móvil

- `prefers-reduced-motion`: revelado instantáneo, sin confeti ni pulsos.
- El estado se comunica con texto y color.
- Dos columnas legibles a 320 px; nombres largos con ellipsis.
- El canvas de confeti no captura eventos (`pointer-events: none`).

## 6. Arquitectura

Todo en `js/stats.js` y `css/styles.css`, patrón IIFE + funciones puras exportadas.

### 6.1 Funciones puras nuevas

```javascript
// Reúne métricas de los dos usuarios a partir de los agregados.
buildDuelContext(leftUser, rightUser, aggregates)

// Devuelve 28 objetos:
// { key, title, desc, leftValue, rightValue, leftNum, rightNum, winner, direction, format }
calcDuelCategories(context)

// { leftWins, rightWins, disputed, na, winner, tieBreak }
calcDuelScore(categories, context)
```

`winner`: `'left' | 'right' | 'tie' | 'na'`.

### 6.2 Agregados nuevos

`buildStatsAggregates()` añade, solo si hay datos suficientes:

```javascript
classificationProvisionalByUser: { [username]: number },
reliabilityByUser: { [username]: reliabilityRow },
exactStatsByUser: { [username]: exactStats },
matchExtremesByUser: { [username]: { best, worst } },
playerExtremesByUser: { [username]: { best, worst } | null },
```

Se reutilizan `splitByUser`, `leaguePoints`, `positionHistory`, `timesTopJornada`, `styleByUser`, `playedMatches` y `completedRondas`.

### 6.3 Render e interacción

- `renderDuelosBody(aggregates)` genera la cabecera fija, las 28 tarjetas y el banner final.
- `bindDuelEvents(aggregates)`:
  - escucha cambios de los dos selectores y reinicia el duelo;
  - intercambia usuarios;
  - activa el observer en el primer scroll;
  - actualiza marcador/progreso al desvelar;
  - lanza confeti/fuegos al terminar;
  - `Repetir duelo`.
- El observer usa como root el contenedor scroll de Duelos.
- El canvas se dimensiona al contenedor y limpia sus partículas al terminar.
- Sin librerías externas.

### 6.4 CSS y cache-busting

- Nuevas clases: `.duel-fixed-header`, `.duel-users`, `.duel-score-*`, `.duel-progress*`, `.duel-cat-card`, `.duel-status`, `.duel-final`, `.scroll-fab`, `.score-plus`.
- `index.html`: `js/stats.js?v=27` y `css/styles.css?v=139`.

## 7. Tests

Nuevo `tests/estadisticasDuelos.test.js` con Node `assert`.

Casos mínimos:

1. Categorías `higher` y `lower` con ganador correcto.
2. Empates → `tie` sin punto.
3. Categorías “peor”: gana el menos malo.
4. `na` cuando falta el dato de uno de los dos.
5. Puestos y regularidad con dirección `lower`.
6. `calcDuelScore`: suma de victorias, empates y `na`.
7. Desempate por puntos totales → plantilla → pronósticos.
8. Empate final si no hay desempate.
9. Cara a cara por jornadas y partidos.
10. Sin partidos → contexto vacío/estado controlado.

Regresión: `estadisticasEstilo`, `estadisticasJugadorV2`, `estadisticas`, `estadisticas-subtabs`, `estadisticasEvolucion`, `estadisticasIndividualDesempate`.

## 8. Verificación

- Ejecutar el test nuevo y las seis suites de estadísticas.
- `node -e "require('./js/stats.js')"` sin errores.
- Harness headless/manual a 320/375 px:
  - selectores y estados vacíos;
  - cabecera fija al hacer scroll;
  - tarjetas bloqueadas y revelado al hacer scroll;
  - incremento animado del marcador;
  - banner final y confeti;
  - `prefers-reduced-motion` sin animaciones.
- Revisión final de rama completa antes de cerrar.

## 9. Criterios de aceptación

- La sub-pestaña Duelos existe y permite elegir dos usuarios distintos.
- Las 28 categorías aparecen en tarjetas individuales con explicación.
- La cabecera con el marcador queda fija y visible durante el scroll.
- Las tarjetas se desvelan al hacer scroll y marcan al ganador.
- El marcador suma con animación y el desempate funciona en el orden acordado.
- Al final hay banner y confeti/fuegos en el lado del ganador.
- Cero cambios de API y cero regresiones.

## 10. Riesgos y decisiones

- **Muchas categorías:** 28 tarjetas pueden alargar el scroll; el revelado progresivo y la cabecera fija mantienen el contexto.
- **Categorías sin datos:** se marcan como `na` y no reparten punto para no penalizar injustamente.
- **Animaciones:** canvas y CSS vanilla; se desactivan con `prefers-reduced-motion`.
- **Crecimiento de `stats.js`:** se añade un bloque delimitado y funciones puras exportadas; la modularización queda fuera de alcance.
