# Diseño: Mostrar tanda de penaltis en resultados y desempate en eliminatorias

**Fecha:** 2026-08-13
**Estado:** Aprobado
**Proyectos:** porra-spa (implementación completa). api-porra sin cambios (matchstats ya expone `tandaPenaltis` por equipo).

## Contexto

- `scripts/matchStats.js` (api-porra) ahora guarda en cada equipo de matchstats `{ goles, tandaPenaltis? }`. `tandaPenaltis` solo existe cuando el partido se decidió en tanda de penaltis (verificado: Sofascore omite la clave `penalties` cuando no hay tanda). Además, `goles` usa `display` (goles reales, sin incluir los penaltis de la tanda).
- `porra-spa` muestra los resultados reales en dos sitios:
  1. Tab Resultados → **Jornadas**: `renderMatchResult` (`js/main.js:1846`), marcador en líneas 1938-1946.
  2. Modal de perfil → **Pronósticos**: línea `Real: X - Y` (`js/main.js:1169`).
- La resolución de eliminatorias vive en `js/eliminatorias.js`:
  - `resolveTie` (línea 20): si el agregado de los 2 partidos queda empatado → cruce pendiente (comentario: "tanda de penaltis no implementada", línea 18).
  - `computeEliminatorias` (línea 44): la final solo se resuelve si `gA !== gB`.
  - `computeReachedPhases` (línea 87): la final solo se resuelve si `gA !== gB`.
  - `calculateEliminatoriasPoints` (línea 138) puntúa usando `reachedPhases`. Un cruce decidido en penaltis quedaba sin resolver → `reachedPhases` provisional → puntos incorrectos.

## Reglas del negocio

1. **Mostrar tanda de penaltis**: en cualquier pantalla que muestre el resultado real de un partido, si ambos equipos tienen `tandaPenaltis`, se muestra entre paréntesis debajo del marcador en formato `(local - visitante)`, p.ej. `(4-3)`.
2. **Puntuación de pronóstico de partido** (8/3/3/1): **se mantiene con los goles reales únicamente**. Un partido decidido en tanda (p.ej. 1-1) cuenta como empate para los aciertos. La tanda solo interviene en la eliminación de la eliminatoria.
3. **Desempate de eliminatoria**: si el agregado de los 2 partidos de un cruce es el mismo, se consulta `tandaPenaltis` del partido que tuvo tanda. El equipo con más goles en la tanda avanza; el otro queda eliminado en esa ronda.
4. **Final**: partido único. Si `gA === gB`, se consulta `tandaPenaltis` para decidir campeón y subcampeón.
5. Si el agregado está empatado pero **ningún partido tiene `tandaPenaltis`** (datos ausentes), el cruce sigue **pendiente** (sin resolver), igual que hoy.

## Arquitectura y componentes

### Display

**a) `renderMatchResult` (js/main.js:1846)**

En la función ya se dispone de `matchStats` (línea 1848). Derivar:

```js
const pensHome = matchStats?.stats?.[match.homeTeamId]?.tandaPenaltis;
const pensAway = matchStats?.stats?.[match.awayTeamId]?.tandaPenaltis;
const hasPens = pensHome !== undefined && pensAway !== undefined;
```

En `scoreDisplay`, cuando `hasResult` y `hasPens`, añadir debajo del marcador:

```js
<div class="resultados-pens">(${pensHome} - ${pensAway})</div>
```

Nuevo estilo CSS `.resultados-pens`: texto pequeño, `var(--text-muted)`, centrado.

**b) Modal de perfil → Pronósticos (js/main.js:1169)**

Derivar `pensHome`/`pensAway` junto a `realHome`/`realAway` (líneas 1143-1144) y, cuando existan, mostrar la tanda en la misma línea `Real:`:

```js
`Real: ${realHome} - ${realAway}${hasPens ? ` <span class="profile-pens">(${pensHome} - ${pensAway})</span>` : ''}`
```

Estilo `.profile-pens`: pequeño, `var(--text-muted)`.

### Desempate de eliminatorias (`js/eliminatorias.js`)

**Nuevo helper puro** (exportado, siguiendo el patrón del módulo):

```js
/**
 * Devuelve el teamId ganador de la tanda de penaltis de un conjunto de
 * partidos, o null si ningún partido tiene tanda completa.
 */
function getShootoutWinner(matches, matchStatsById) {
  for (const m of matches) {
    const ms = matchStatsById.get(m.id);
    if (!ms) continue;
    const pHome = ms.stats?.[m.homeTeamId]?.tandaPenaltis;
    const pAway = ms.stats?.[m.awayTeamId]?.tandaPenaltis;
    if (pHome !== undefined && pAway !== undefined) {
      if (pHome > pAway) return m.homeTeamId;
      if (pAway > pHome) return m.awayTeamId;
      return null;
    }
  }
  return null;
}
```

**`resolveTie`** — sustituir la línea 33:

```js
if (totA === totB) {
  const winner = getShootoutWinner(tie.matches, matchStatsById);
  if (winner === null) return { resuelto: false, eliminado: null };
  return { resuelto: true, eliminado: winner === tie.teamA ? tie.teamB : tie.teamA };
}
```

**`computeEliminatorias`** (bloque de la final, líneas 65-75): resolver por tanda cuando `gA === gB`:

```js
if (gA !== undefined && gB !== undefined) {
  if (gA !== gB) {
    final.campeon = gA > gB ? f.homeTeamId : f.awayTeamId;
    final.subcampeon = gA > gB ? f.awayTeamId : f.homeTeamId;
    rondasResueltas.push('final');
  } else {
    const winner = getShootoutWinner([f], matchStatsById);
    if (winner !== null) {
      final.campeon = winner;
      final.subcampeon = winner === f.homeTeamId ? f.awayTeamId : f.homeTeamId;
      rondasResueltas.push('final');
    }
  }
}
```

**`computeReachedPhases`** (bloque de la final, líneas 113-126): misma lógica; cuando `gA === gB` y hay ganador por tanda → `reached[ganador] = 6`, `reached[perdedor] = 5`. Si no hay tanda → comportamiento actual (ambos provisionales en 5).

> `computeReachedPhases` ya usa `resolveTie` para las fases dobles, por lo que hereda el desempate por tanda automáticamente.

## Funciones JavaScript

| Función | Responsabilidad |
|---------|-----------------|
| `getShootoutWinner(matches, matchStatsById)` | Nueva. Devuelve el `teamId` ganador de la tanda o `null`. |
| `resolveTie(tie, matchStatsById)` | Modificada. Desempata agregados por tanda de penaltis. |
| `computeEliminatorias(matches, matchStats)` | Modificada. Final resuelta por tanda cuando `gA === gB`. |
| `computeReachedPhases(matches, matchStats)` | Modificada. Final resuelta por tanda cuando `gA === gB`. |
| `renderMatchResult(...)` | Modificada. Muestra `(4-3)` bajo el marcador. |
| `renderPredictionsTab(container, userData, username)` | Modificada. Muestra la tanda en la línea `Real:` del modal de perfil. |

## Testing

Ampliar `tests/eliminatorias.test.js` (patrón existente: `require('../js/eliminatorias.js')` + runner manual con `node`):

- Extender el helper de test `ms(eventId, goles)` para aceptar tanda: `ms(eventId, goles, tanda)` donde `tanda` es `{ teamId: pens }`.
- `resolveTie` agregado empatado + tanda decide → `resuelto: true` con el eliminado correcto.
- `resolveTie` agregado empatado + sin tanda → sigue pendiente (test existente `test_resolveTie_agregado_empate_pendiente`, actualizar comentario).
- `computeEliminatorias` final empatada + tanda → campeón/subcampeón resueltos.
- `computeEliminatorias` final empatada + sin tanda → no resuelta (test existente `test_computeEliminatorias_final_empatada_no_resuelta` se mantiene).
- `computeReachedPhases` final empatada + tanda → campeón 6, subcampeón 5.
- Ejecutar: `node tests/eliminatorias.test.js`.

## Cache-busting

Al modificar `js/main.js`, `js/eliminatorias.js` y `css/styles.css`, incrementar las versiones en `index.html` (regla de `AGENTS.md`):
- `js/main.js?v=70` → `v=71`
- `js/eliminatorias.js?v=1` → `v=2`
- `css/styles.css?v=<actual>` → +1

## Nota operativa (no código)

Los matchstats ya guardados en MongoDB fueron scrapeados antes de esta feature: tienen `goles` sin la corrección `display` (pueden incluir goles de la tanda) y **sin** `tandaPenaltis`. Tras desplegar, habrá que **re-scrapear los partidos de eliminatorias y la final** (p.ej. `node scripts/scrapeEliminatorias.js` en api-porra) para que el desempate por tanda y el display funcionen.

## Fuera de alcance

- Puntuación de pronóstico de partido (8/3/3/1): se mantiene con goles reales; la tanda no altera V/E/D.
- Cambios en api-porra (el campo `tandaPenaltis` ya se expone).
- Desglose de cruce por partido en la UI de eliminatorias.
