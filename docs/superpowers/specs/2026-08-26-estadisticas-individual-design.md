# Spec — Estadísticas › Individual (sustituye a Fiabilidad)

Fecha: 2026-08-26 · Estado: aprobado tras brainstorming
Predecesor: docs/superpowers/specs/2026-08-25-estadisticas-subtabs-design.md (sub-tabs existentes)

## 1. Objetivo

Sustituir la sub-tab **Fiabilidad** de la pestaña Estadísticas por una nueva sub-tab **Individual**: una ficha por usuario con desglose de sus puntos, aciertos de pronóstico, rendimiento por jornadas y mejores jugadores de su plantilla. Selector de usuario en desplegable; por defecto el usuario logado. Visible para todos los usuarios (cualquiera puede consultar la ficha de cualquiera), coherente con el perfil de Clasificación.

## 2. Datos mostrados

| Bloque | Contenido |
|---|---|
| Selector | Avatar + nombre + `#puesto` en clasificación general del usuario seleccionado |
| Desglose de puntos | Donut SVG (4 fuentes: Pronósticos, Plantilla, Clasificación, Eliminatorias) con total al centro; leyenda con valor absoluto y %; fila de chips `▲/▼ vs media` por fuente |
| Pronósticos | KPIs: aciertos 1X2, resultados exactos, fallidos. Pie: `% conversión de exactos` (= exactos ÷ aciertos) y `Mejor partido: X pts` |
| Jornadas | Mejor jornada (J·pts) · Media de pts/jornada · Veces mejor de la jornada · Mejor/peor puesto histórico; fila Momentum (`▲ En forma` / `→ Estable` / `▼ Bajón`) y Consistencia (σ + etiqueta) |
| Sesgo 1/X/2 | Tres filas: veces pronosticado 1/X/2 y % de acierto en cada caso |
| Plantilla ideal | Mejor POR/DEF/MED/DEL + ⭐ mejor jugador total + 💎 más rentable (pts/partido) |

Colores de las fuentes (idénticos al mockup aprobado): Pronósticos `#8B5CF6`, Plantilla `#10B981`, Clasificación `#22D3EE`, Eliminatorias `#F59E0B`.

### Definiciones exactas

- **Aciertos 1X2 / Exactos / Fallidos**: sobre partidos ya jugados (con resultado en matchstats). Fallidos = jugados − aciertos. Exactos ⊆ aciertos.
- **Mejor jornada**: la de máxima puntuación del usuario entre jornadas completas de liga (aunque no esté en el top-5 global).
- **Veces mejor de la jornada**: nº de jornadas donde los puntos del usuario igualan el máximo de esa jornada (los empates comparten el honor).
- **Media/jornada**: puntos de pronósticos ÷ jornadas completadas.
- **Puesto histórico**: por cada jornada completada, puesto del usuario en la suma acumulada de puntos de todos los jugadores, con **ranking competitivo** (empates comparten puesto: puesto = 1 + nº de usuarios con estrictamente más puntos acumulados). Mejor = mínimo; peor = máximo.
- **Momentum**: media de las últimas 3 jornadas completadas menos la media de temporada; `≥ +2` → «▲ En forma» (verde), `≤ −2` → «▼ Bajón» (rojo), resto «→ Estable». Con < 3 jornadas: «—».
- **Consistencia**: desviación típica (poblacional) de puntos por jornada, 1 decimal. Etiqueta: `σ ≤ 8` → «Regular», `> 8` → «Montaña rusa» (constante `STATS_CONSISTENCY_SIGMA = 8`). Con < 2 jornadas: «—».
- **Mejor partido**: entrada de `matchDetails` con máxima puntuación (se muestra aunque sea 0 si no hay ninguna positiva; lista vacía → «—»).
- **Sesgo**: solo partidos jugados con pronóstico numérico completo del usuario; se agrupan por resultado pronosticado (H/D/A); % de acierto por grupo. Partidos sin pronóstico válido se excluyen.
- **Más rentable**: jugador de su plantilla con mayor `puntosTotales/partidos disputados`, exigiendo ≥ 1 partido; empate → primero del array (orden determinista).
- **Comparativa vs media**: `miValor − media(porra)` por fuente; media calculada sobre todos los jugadores registrados usando su valor real (0 donde no haya dato).

## 3. Arquitectura (enfoque A: híbrido con caché)

Todo cliente, sin cambios de backend. Patrón idéntico al resto de sub-tabs: funciones puras exportadas + renderer + dispatcher + agregados compartidos.

### 3.1 Estado (`js/main.js`, bloque AppState)

```javascript
estadisticasIndividualUser: null, // usuario mostrado en sub-tab Individual (null → currentUser.name)
```

### 3.2 Cambios en SUBTABS y dispatcher (`js/stats.js`)

- `SUBTABS`: entrada `{ id:'fiabilidad', label:'Fiabilid.' }` → `{ id:'individual', label:'Individual' }`.
- Dispatcher `renderStatsContent()`: fuera la rama `renderFiabilidadBody(aggregates)`, dentro `renderIndividualBody(aggregates)`.
- Se eliminan solo los helpers que quedan sin uso (renderer de Fiabilidad y, si no queda otro consumidor, `calcReliabilityRows`). **Se conservan** `matchResultOf`, `extractPlayedMatches`, `calcReliabilityRow(s)` (los consume Individual) y `getPlayerMeta` (compartido). El plan verificará usos antes de borrar.
- Los tests que referencien funciones eliminadas se ajustan a las nuevas; los de funciones conservadas permanecen.

### 3.3 Nuevos agregados globales (`buildStatsAggregates()`)

Baratos porque derivan de `pointsByUserByJornada` ya construido:

| Clave | Forma | Uso |
|---|---|---|
| `positionHistory` | `{ username: number[] }` | Mejor/peor puesto |
| `timesTopJornada` | `{ username: number }` | Veces mejor de la jornada |

La **media de la porra por fuente** exige el desglose de todos los usuarios: se calcula una vez por render, la primera vez que Individual necesita una ficha, junto a la del usuario seleccionado.

### 3.4 Funciones puras nuevas (exportadas como el resto)

```javascript
// Geometría del donut. parts: [{key,label,value,color}]. Ignora value<=0.
// Devuelve [{key,label,value,pct,dasharray,dashoffset}] con C=2π·42,
// dasharray="len C-len", dashoffset=-acumuladoPrevio. total===0 → [].
buildDonutSegments(parts)

// { idx, pts } | null — mejor jornada del usuario (idx 0-based)
calcUserBestJornada(ptsArr)

// { username: [puestos] } — ranking competitivo por jornada completada
calcPositionHistory(pointsByUserByJornada)

// { username: n } — jornadas donde pts === máximo compartido
calcTimesTopJornada(pointsByUserByJornada)

// { H:{pred,hits}, D:{...}, A:{...} } — sesgo del usuario sobre partidos jugados
calcPredictionBias(userPredictions, playedMatches)

// { G,D,M,F,top } → null | { jugador, puntosTotal }
calcBestPlayersByPosition(playerDetails)

// null | { jugador, ptsPorPartido, partidos } — exige partidos >= 1
calcMostProfitablePlayer(playerDetails)

// null | { recent, avg, delta } — media últimas 3 vs media temporada (1 decimal)
calcMomentum(ptsArr)

// null | number — desviación típica poblacional, 1 decimal
calcConsistency(ptsArr)

// null | { points, matchId } — entrada de matchDetails con máxima puntuación
calcBestMatch(matchDetails)
```

La conversión de exactos se deriva en render (`exactos/aciertos`), sin función propia.

### 3.5 Desglose de 4 fuentes por usuario

Se reutiliza `computeUserRealPoints(username)` de `js/main.js`. El plan verificará su compatibilidad con `_userDataCache`; si duplica trabajo, se deriva de los campos de `getCachedUserData()` (`matchDetails`, `squadPoints.playerDetails`, `classificationTotal`, detalles de eliminatorias). La media de la porra usa el mismo helper para todos los usuarios.

### 3.6 Caché por render

`_individualCache = { porraAvgBySource: null }` — se reinicia en cada render de Estadísticas (mismo ciclo que `_userDataCache`). Cambiar de usuario en el dropdown reusa la media global ya calculada y solo computa la ficha del nuevo usuario.

## 4. Renderer (`renderIndividualBody(aggregates)`)

1. Resuelve `username = AppState.estadisticasIndividualUser || AppState.currentUser?.name`; valida que exista en `AppState.players`; si no, fallback al usuario logado.
2. `<select>` estilizado (clase `.stats-ind-select`) con todos los jugadores (`avatar nombre`), valor actual seleccionado.
3. Tarjetas (reutiliza `.stats-card`, `.stats-kpi-grid`, `.stats-kpi`, `.stats-kv`, `.stats-kl`, `.stats-empty`, `.stats-pill`): Desglose · Pronósticos · Jornadas · Sesgo · Plantilla, según §2.
4. Donut: `<svg viewBox="0 0 120 120">` con círculos `stroke-dasharray/dashoffset` y `transform="rotate(-90 60 60)"`; texto central con total.
5. Eventos: `change` del select → `AppState.estadisticasIndividualUser = valor` → `renderStatsContent()` → rebinding (patrón existente).

CSS nuevo mínimo: `.stats-ind-select` y clases propias del donut (`.stats-donut*`). Todo lo demás reutilizado.

## 5. Casos límite

- Sin `matchStats`: cards Pronósticos/Sesgo muestran `.stats-empty`; donut se dibuja con las fuentes disponibles; todo a cero → `.stats-empty`.
- Usuario sin plantilla guardada: card Plantilla `.stats-empty`.
- < 3 jornadas completadas o < 2: Momentum/Consistencia «—».
- Usuario del dropdown inexistente: fallback al usuario logado.
- Guard de fase intacto: toda la pestaña sigue oculta en `FASE_PRETEMPORADA`.
- Todos los valores dinámicos con `esc()`; sin comentarios en el código; solo tokens `:root` más literales permitidos.

## 6. Tests (`tests/estadisticas-subtabs.test.js`)

- `buildDonutSegments`: total cero → `[]`; suma de longitudes ≤ circunferencia; offsets acumulativos correctos; segmentos con value 0 omitidos.
- `calcPositionHistory`: empates comparten puesto; orden estable.
- `calcTimesTopJornada`: empate en el máximo cuenta para ambos.
- `calcUserBestJornada`: vacío → null; máximo correcto.
- `calcPredictionBias`: mezcla de pronósticos válidos, inválidos (null) y partidos jugados.
- `calcBestPlayersByPosition`: posiciones vacías → null; top global correcto.
- `calcMostProfitablePlayer`: sin partidos → null; cálculo a 1 decimal.
- `calcMomentum`: <3 jornadas → null; umbral ±2.
- `calcConsistency`: 1 jornada → null; valor esperado.
- `calcBestMatch`: lista vacía → null; máximo.

## 7. Despliegue

- AGENTS.md: actualizar el bullet de `tab-estadisticas` (Fiabilidad → Individual, descripción de bloques y estado `estadisticasIndividualUser`).
- Cache-busting en `index.html`: `js/stats.js?v=3`, `css/styles.css?v=79`, `js/main.js?v=115`.
