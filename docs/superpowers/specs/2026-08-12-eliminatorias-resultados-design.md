# Diseño: Tab "Eliminatorias" en pantalla de Resultados

**Fecha:** 2026-08-12
**Estado:** Aprobado
**Proyectos:** porra-spa (implementación completa). api-porra sin cambios en este alcance.

## Objetivo

Añadir una tercera sub-tab **"Eliminatorias"** a la pantalla de Resultados (`tab-resultados`) que muestre los equipos que han caído en cada ronda eliminatoria (a partir de dieciseisavos), resuelta a partir de los resultados reales de los cruces a doble partido.

## Contexto actual

- La pantalla de resultados (`renderResultadosTab`, `js/main.js:1380`) tiene dos sub-tabs: "Jornadas" y "Clasificación Real", controladas por `AppState.resultadosTab`.
- `AppState.matches` contiene los partidos de `data/calendar.json` transformados (`fase`, `homeTeamId`, `awayTeamId`, `fechaTs`, etc. — `buildMatchFromCalendar`, `js/main.js:309`). Hoy hay 144 de liga (`fase:"liga"`) y 16 de dieciseisavos (`fase:"16"`, 8 de ida + 8 de vuelta, todos `ronda:1`). Las fases `8`, `4`, `semis`, `final` se añadirán al calendario más adelante.
- `AppState.matchStats` contiene los resultados reales de Sofascore (`stats[teamId].goles`) obtenidos con `fetchMatchStats()`.
- El menú de predicciones de eliminatorias (`renderFinalPredictionsTab`, `js/main.js:4652`) define el estilo visual de podium y drop-zones (`.podium-slot`, `.drop-zone`, `.team-chip`, etc.).
- **Tanda de penaltis: fuera de alcance.** El campo de penaltis en los matchstats está pendiente de implementar en api-porra. Para resolver cruces se usa **únicamente la suma de goles de ida y vuelta**. Un cruce empatado a agregado queda sin resolver.

## Enfoque elegido

**Enfoque A — Cálculo en la SPA** (aprobado por el usuario).

Sin cambios en api-porra: la tab se calcula en el cliente a partir de `AppState.matches` + `AppState.matchStats`, igual que el resto de la pantalla de resultados. Se beneficia del auto-refresh de matchstats existente.

## Reglas del negocio

1. Cada cruce de fase eliminatoria (16, 8, 4, semis) se juega a doble partido (ida y vuelta). La final es partido único.
2. Para saber qué equipos caen en una ronda se suman los goles de ambos partidos (agregado).
   - Si el agregado no es empate → el equipo con menor agregado queda **eliminado** en esa ronda.
   - Si el agregado es empate → el cruce queda **pendiente** (requeriría tanda de penaltis, fuera de alcance).
3. Un cruce solo está resuelto si **ambos** partidos tienen resultado en `matchStats` y el agregado no es empate.
4. Una **zona/ronda solo se muestra cuando todas sus eliminatorias están resueltas** (decisión del usuario: "Solo rondas completas").
5. La **final** (partido único con resultado) determina **Campeón** (ganador) y **Subcampeón** (perdedor).
6. Cuentas esperadas por zona: 8 eliminados en dieciseisavos, 8 en octavos, 4 en cuartos, 2 en semifinales, 1 subcampeón, 1 campeón.

## Arquitectura y componentes

### Estado (`AppState`)

Sin nuevas propiedades de estado persistente. Se reutiliza:

```javascript
resultadosTab: 'eliminatorias' // nuevo valor del selector existente
```

### Funciones puras (testables)

```javascript
// Empareja los partidos de una fase en cruces por par desordenado de equipos.
// Cada grupo = una eliminatoria (2 partidos de ida/vuelta; 1 en la final).
function groupTies(matches) => [{ teamA, teamB, matches: [...] }, ...]

// Resuelve un cruce doble por agregado.
// Devuelve { eliminado: teamId | null, resuelto: boolean }
function resolveTie(tie, matchStatsById) => { eliminado, resuelto }

// Calcula el cuadro completo de eliminatorias.
// Devuelve { zonas, final, rondasResueltas }
function computeEliminatorias() => {
  zonas: { '16': [teamId,...], '8': [teamId,...], '4': [teamId,...], 'semis': [teamId,...] },
  final: { campeon: teamId|null, subcampeon: teamId|null },
  rondasResueltas: ['16', ...] // fases dobles completas + 'final' si la final tiene resultado
}

// Regla de rondasResueltas:
// - Para fases dobles ('16','8','4','semis'): incluida solo si todas sus eliminatorias
//   tienen ganador por agregado.
// - Para 'final': incluida solo si el partido único tiene resultado.
// El contador "Eliminatorias resueltas: X/5" cuenta rondasResueltas sobre el total
// de 5 fases (16, 8, 4, semis, final).
```

### Flujo de datos

1. `renderResultadosTab()` detecta `AppState.resultadosTab === 'eliminatorias'` y llama a `renderEliminatoriasTab()`.
2. `renderEliminatoriasTab()` invoca `computeEliminatorias()` (usa `AppState.matches` y `AppState.matchStats`, ya cargados por `fetchMatchStats()`).
3. Pinta las zonas en orden cronológico, solo las de `rondasResueltas`.

### Renderizado (`renderEliminatoriasTab`)

Orden de zonas, de arriba a abajo (cronológico, decisión del usuario):

| # | Zona | Ícono | Cantidad |
|---|------|-------|----------|
| 1 | Eliminados en dieciseisavos | 📋 | 8 |
| 2 | Eliminados en octavos | ⚡ | 8 |
| 3 | Eliminados en cuartos | 🏅 | 4 |
| 4 | Eliminados en semifinales | ⚔️ | 2 |
| 5 | Subcampeón | 🥈 | 1 |
| 6 | Campeón | 🏆 | 1 |

- Cada zona muestra los escudos + nombre de los equipos eliminados (sin desglose de marcadores — decisión del usuario).
- Solo se pintan las zonas de rondas completas; las no resueltas se omiten (no se muestran vacías).
- Si no hay ninguna ronda resuelta → mensaje "Aún no hay eliminatorias resueltas".
- Cabecera con progreso: "Eliminatorias resueltas: X/5".
- Vista **read-only**: sin interacción de arrastrar/guardar.
- Reutiliza las clases CSS del menú de predicciones (`.podium-slot`, `.drop-zone`, `.team-chip`, ...) con variantes read-only si fuera necesario.

## Edge cases

- **Partido sin resultado aún** (uno o ambos de un cruce) → cruce no resuelto → la ronda no se muestra hasta que todos sus cruces estén resueltos.
- **Agregado empatado** → cruce pendiente (sin tanda de penaltis) → ronda no completa.
- **Fase sin partidos en el calendario** (8, 4, semis, final aún sin definir) → no hay cruces → no se muestra.
- **Durante FASE_PRETEMPORADA** → `renderResultadosTab` ya muestra el mensaje genérico de "resultados no disponibles" y no llega a esta tab.
- **Imagen de escudo ausente** → `onerror` para ocultar/reemplazar, patrón ya usado en la app.

## Funciones JavaScript

| Función | Responsabilidad |
|---------|-----------------|
| `computeEliminatorias()` | Lógica pura que devuelve `{ zonas, final, rondasResueltas }` a partir de `AppState.matches` y `AppState.matchStats`. |
| `groupTies(matches)` | Agrupa partidos de una fase en cruces por par desordenado de equipos. |
| `resolveTie(tie, matchStatsById)` | Suma el agregado de ida y vuelta; devuelve eliminado o pendiente. |
| `renderEliminatoriasTab()` | Genera el HTML de la tab (cabecera de progreso + zonas en orden cronológico). |

## Persistencia

- **No requiere persistencia**: es un cálculo derivado de los resultados reales en `AppState.matchStats`.
- **Cálculo dinámico**: se recalcula cada vez que se renderiza la tab o se refrescan matchstats.

## Testing

Añadir tests unitarios en `porra-spa/tests/` (patrón existente: mocks de `AppState` + `require`):

- `groupTies`: agrupa ida/vuelta por par de equipos; casos con 1 o 2 partidos por cruce.
- `resolveTie`: agregado decidido, agregado empatado (→ pendiente), partido(s) sin resultado (→ no resuelto).
- `computeEliminatorias`: ronda completa vs incompleta; cálculo de `final` (campeón/subcampeón); solo rondas completas en `rondasResueltas`.

## Cache-busting

Al modificar `js/main.js`, incrementar la versión `?v=` de `css/styles.css` y `js/main.js` en `index.html` (regla de `AGENTS.md`).

## Fuera de alcance (trabajo futuro)

- **Tanda de penaltis en matchstats** (api-porra): scraper de Sofascore + modelo MongoDB + endpoint. Cuando exista, `resolveTie` deberá usarla para desempatar agregados.
- Desglose por cruce (ida, vuelta, agregado) en la UI, si el usuario lo solicita.
