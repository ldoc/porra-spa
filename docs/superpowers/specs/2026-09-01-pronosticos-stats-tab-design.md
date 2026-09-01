# Diseño: Pestaña Pronósticos en Estadísticas (reemplaza Consenso)

**Fecha:** 2026-09-01
**Estado:** Aprobado (usuario eligió enfoque A - scroll apilado)
**Rama:** brainstorm 4090-1788261300

## 1. Resumen y Objetivo

Quitar la sub-pestaña **Consenso** de Estadísticas y añadir una nueva **Pronósticos** como **primera** del menú. Debe mostrar estadísticas agregadas de los pronósticos de todos los usuarios, agrupadas por tipo: Partidos (144 liga), Clasificación pronosticada (36 equipos), Eliminatorias (cuadro 24) y Plantilla (25 jugadores). Usar enfoque A: scroll vertical apilado con 4 cards, sin sub-navegación interna.

**Reglas acordadas:**
- Estadísticas sigue oculta en `FASE_PRETEMPORADA` (guard `isFasePretemporada()`). Cuando está visible, **Pronósticos** calcula aunque `matchStats` esté vacío (solo necesita `allPredictions`/caches); el guard no se relaja para Pronósticos solo.
- Eliminar Consenso por completo (no conservar campeón más votado/rareza en otro tab; se reinserta dentro de Pronósticos → Eliminatorias si hace falta).

## 2. Contexto y Archivos Afectados

- `js/stats.js:495-501` — `SUBTABS` actual `['evolucion','individual','rachas','consenso','plantillas']`
- `js/stats.js:567-677` — `renderEstadisticasTab()` + `renderStatsContent()` con `if (sub === 'consenso')`
- `js/stats.js:762-836` — `renderConsensoBody()`, `computeMatchConsensus()`, `tallyChampions()`, `compareQuadroWithCommunity()` (parcialmente reutilizado)
- `js/main.js:50-52` — `AppState.estadisticasSubTab/initial` default
- `css/styles.css` — clases `.stats-*` para cards, pills, barras
- `index.html:19,322` — versiones cache-busting

## 3. Enfoques Evaluados

| Enfoque | Descripción | Pros | Contras | Decisión |
|---------|-------------|------|---------|----------|
| **A - Scroll apilado** | 4 cards apiladas verticalmente, todo visible con scroll. | Escaneo rápido, menos estado, coherente con Rachas/Individual, YAGNI | Pantalla larga | **Elegido** |
| B - Mini-tabs | Barra secundaria Partidos/Clasif/Elims/Plantilla, 1 visible | Más limpio, foco | Doble nivel de tabs, oculta comparativa | Descartado |
| C - Dashboard + acordeón | 4 KPIs resumen + cada bloque colapsable (1 abierto) | Resumen global + detalle | Más JS, decidir KPI resumen | Descartado |

Maqueta visual servida en `http://localhost:57902/?key=3a6d773372dbff3cae5ab4036d4d932751bfefd80628c5d6d40ad1911a3ece07` (phone mockup con 4 cards con border-left color).

## 4. Diseño Detallado (Enfoque A)

### 4.1 Navegación

```js
const SUBTABS = [
  { key: 'pronosticos', label: 'Pronósticos' },
  { key: 'evolucion', label: 'Evolución' },
  { key: 'individual', label: 'Individual' },
  { key: 'rachas', label: 'Rachas' },
  { key: 'plantillas', label: 'Plantillas' },
];
```

- `AppState.estadisticasSubTab` default pasa de `'evolucion'` a `'pronosticos'` en `initStatsState()` y declaración inicial `js/main.js:50`.
- `renderStatsContent()` nuevo: `if (sub === 'pronosticos') body = renderPronosticosBody(aggregates);` como primera rama.
- Eliminar rama `consenso` y funciones asociadas (`renderConsensoBody`, `getDefaultConsensoRonda`, `normalizeConsensoRonda`, `consensoBars`, `consensoScoreGrid`). Mantener `tallyChampions`, `compareQuadroWithCommunity`, `aggregateSquads` porque se reutilizan en Pronósticos → Eliminatorias/Plantilla.

### 4.2 Estructura UI (4 cards apiladas)

Cada card: `.stats-card` con `border-left: 3px solid var(--color)` y `.stats-card-title`.

**Card 1 — ⚽ Pronósticos de partidos (verde #10B981)**
- KPIs grid 2x2: Más repetido (1X2 global), Menos repetido, Más repetido marcador exacto (ej 1-1 18%), "🤯 Se te ha ido la olla" (marcador con <5% o voto único, 1 voto, usuario).
- Filas: Más consenso (partido con mayor % en un resultado, >70%), Más dividido (entropía máxima, ej 34/33/33), Sesgo global 1-X-2 (barras + pills), Promedio goles local vs visitante (delta), Conservador (min goles/part) vs Arriesgado (max).
- Cálculos puros: `calcPartidosPronosticosStats(allPredictions, leagueMatches)` — itera todos los `matchId` de liga, cuenta `counts` 1X2 y `scoreVotes` (map `home-away`), calcula porcentajes, entropía, promedio goles por usuario.

**Card 2 — 📊 Clasificación pronosticada (cyan #06B6D4)**
- Métricas: Equipo más veces 1º, Más veces Top8, Más veces fuera Top24, Mayor dispersión (σ posición), Clasificación media predicha Top5 (lista ordenada por media posición ascendente).
- Cálculo: Para cada usuario calcular standings pronosticada (helper que inyecta `userPredictions` en `AppState.scorePredictions` temporal o factoriza `getTeamStats` para no mutar global). Luego agrega frecuencias por equipo. Reutiliza lógica de `calculatePredictedStandings` refactorizada a función pura `calcPredictedStandingsForPreds(preds, matches, teamsMap)`.

**Card 3 — 🏆 Eliminatorias (violeta #8B5CF6)**
- Métricas: Campeón más votado (reuse `tallyChampions`), Final más repetida (par campeón+subcampeón más frecuente), Equipo más veces en semis, Rareza cuadro (reuse `compareQuadroWithCommunity` — avgCommon, veryDiffCount).
- Fuente: `AppState.finalPredictionsCache`.

**Card 4 — 👥 Plantilla (dorado #F59E0B)**
- Métricas: Top 3 por posición (G/D/M/F) con barras posesión, Equipo más/menos representado (cuenta picks por `equipo`), Imprescindible (>70% posesión) vs Diferencial (<20%), Hipster vs Mainstream (usuario con menor/mayor coincidencia media con aggregateSquads).
- Reutiliza `aggregateSquads` + nuevo `calcPlantillaExtras()`.

### 4.3 Datos y Flujo

- Entrada: `AppState.allPredictions`, `AppState.squadsCache`, `AppState.finalPredictionsCache`, `AppState.leagueMatches`, `AppState.teamsMap`, `AppState.players`.
- `buildStatsAggregates()` se amplía para incluir `pronosticosPartidos`, `pronosticosClasificacion`, `pronosticosEliminatorias`, `pronosticosPlantilla` o se calculan lazy dentro de `renderPronosticosBody()`.
- Todas las funciones nuevas son puras (`(data) => result`) y exportadas vía `global.PorraStats` para tests (patrón IIFE actual).

### 4.4 Estados Vacíos y Errores

- Si `allPredictions` vacío: cada card muestra `statsEmpty('Aún no hay pronósticos')`.
- Si pocos usuarios (<2): dispersión y hipster/mainstream muestran `—` o se ocultan.
- Si `leagueMatches` vacío: Partidos card muestra `Sin calendario`.
- Guard pretemporada: `renderEstadisticasTab()` mantiene `if (isFasePretemporada()) return statsEmpty('Disponible al inicio de la competición')` — aplica a todo, incluido Pronósticos, tal como acordado.

### 4.5 Estilos

- Reusa `.stats-card`, `.stats-kpi-grid`, `.stats-rank-row`, `.stats-pill`, `.stats-consbar` etc.
- Añadir `.stats-pronosticos-kpi` si hace falta grid 2x2 para partidos; bordes left por card.
- No se requiere nuevo layout mobile; respeta `max-width:480px` y scroll vertical.

## 5. Cambios por Fichero

| Fichero | Cambio |
|---------|--------|
| `js/stats.js` | Reordenar `SUBTABS`, borrar `renderConsensoBody` y helpers consenso no reutilizados, añadir `renderPronosticosBody` + 4 helpers por bloque + funciones puras de cálculo + exportarlas |
| `js/main.js` | `estadisticasSubTab: 'pronosticos'` default, `initStatsState` default |
| `css/styles.css` | Añadir `border-left` variants y `.stats-pronosticos-*` si hace falta, incrementar `v` |
| `index.html` | Bump `css/styles.css?v`, `js/main.js?v`, `js/stats.js?v` |
| `tests/pronosticosStats.test.js` | Nuevo — tests unitarios puros para cada cálculo |

No se añade nuevo módulo (se mantiene IIFE para no romper carga vía `<script>`).

## 6. Testing

- Tests unitarios puros sin DOM: `calcPartidosPronosticosStats` (más/menos, raro, consenso, sesgo, conservador/arriesgado), `calcClasificacionPronosticosStats` (frecuencias, media, dispersión), `calcEliminatoriasPronosticosStats` (champion, final, semis), `calcPlantillaPronosticosExtras` (top3 por pos, equipo +/- , hipster).
- Tests de integración ligera: `renderPronosticosBody` genera HTML con 4 títulos y vacío correcto.
- Verificar guard pretemporada oculta toda Estadísticas.
- Ejecutar `npm test` (o `node --test` según repo) y `bash` sanity check.

## 7. Riesgos y Mitigaciones

- **Cálculo de standings por usuario costoso (36 equipos x N usuarios x 144 partidos):** Mitigar cacheando `calcPredictedStandingsForPreds` por usuario y solo para métricas de clasificación.
- **Mutación de AppState global al calcular standings:** Factorizar `getTeamStats(preds, matches)` para no depender de `AppState.scorePredictions`.
- **Eliminación Consenso rompe navegación con `estadisticasConsensoRonda`:** Limpiar esa clave de AppState o dejarla huérfana sin uso.

## 8. Criterios de Aceptación

- [ ] Subtabs muestra Pronósticos primero y es el default al entrar a Estadísticas
- [ ] Consenso no aparece en ningún sitio
- [ ] Las 4 cards de Pronósticos renderizan con datos reales y con estados vacíos correctos
- [ ] Métricas A-G, P1-4, C1-4, E1-4 visibles según maqueta
- [ ] Funciona aún sin matchStats (solo pronósticos)
- [ ] Sigue oculto en pretemporada
- [ ] Tests nuevos pasan y existentes no rompen
- [ ] Bump versiones cache-busting en index.html

## 9. Referencias

- AGENTS.md §5 Estadísticas y §3 Stack
- `js/stats.js` SUBTABS y renderConsensoBody
- `js/main.js` AppState y isFasePretemporada
- Maqueta: `.superpowers/brainstorm/4090-1788261300/content/pronosticos-mockup.html`
