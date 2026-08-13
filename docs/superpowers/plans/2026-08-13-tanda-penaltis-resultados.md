# Tanda de penaltis en resultados y eliminatorias - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar la tanda de penaltis bajo los resultados reales y usar `tandaPenaltis` para desempatar cruces de eliminatorias en porra-spa.

**Architecture:** Todo el cambio es en el frontend `porra-spa` (vanilla JS). La lógica de eliminatorias está en `js/eliminatorias.js` (módulo IIFE con funciones puras exportadas y testables). El display de resultados está en `js/main.js` + `css/styles.css`. `api-porra` no se toca: matchstats ya expone `tandaPenaltis` por equipo.

**Tech Stack:** JavaScript vanilla (ES6), CSS vanilla, tests Node autónomos (patrón espejo, sin framework).

## Global Constraints

- La puntuación de pronóstico de partido (8/3/3/1) se mantiene **solo con goles reales**; la tanda de penaltis NO altera V/E/D.
- `tandaPenaltis` solo existe en matchstats cuando el partido tuvo tanda (si no, el campo está ausente).
- Un cruce con agregado empatado y sin `tandaPenaltis` en ningún partido sigue **pendiente** (no resuelto).
- Al tocar `css/styles.css` y `js/main.js` hay que incrementar `?v=` en `index.html` (hoy CSS `v=50`, JS `v=70`, `eliminatorias.js?v=1`).
- No usar frameworks. Seguir el patrón de las funciones/estilos existentes.
- Los tests NO importan `main.js`; espejan sus funciones (patrón existente).

---

### Task 1: Desempate de eliminatorias por tanda de penaltis

**Files:**
- Modify: `js/eliminatorias.js` (añadir `getShootoutWinner`; modificar `resolveTie`, la final de `computeEliminatorias` y de `computeReachedPhases`; exportar el nuevo helper)
- Test: `tests/eliminatorias.test.js`
- Modify: `index.html:251` (cache-busting de `eliminatorias.js`)

**Interfaces:**
- Produces: `getShootoutWinner(matches, matchStatsById)` → `teamId | null` (ganador de la tanda de un conjunto de partidos; `null` si ningún partido tiene tanda completa).
- Consumes: estructura existente de matchstats `{ eventId, stats: { [teamId]: { goles, tandaPenaltis? } } }`.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/eliminatorias.test.js`, modificar el `require` (línea 2) para incluir el nuevo helper:

```js
const { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner } = require('../js/eliminatorias.js');
```

Ampliar el helper `ms` (línea 9) para aceptar tanda de penaltis:

```js
function ms(eventId, goles, tanda) {
  const stats = {};
  for (const [teamId, g] of Object.entries(goles)) stats[teamId] = { goles: g };
  if (tanda) {
    for (const [teamId, p] of Object.entries(tanda)) {
      if (stats[teamId]) stats[teamId].tandaPenaltis = p;
      else stats[teamId] = { tandaPenaltis: p };
    }
  }
  return { eventId, stats };
}
```

Añadir estos tests (antes del runner, tras `test_resolveTie_cruce_con_menos_de_dos_partidos_no_resuelto`):

```js
function test_getShootoutWinner_gana_visitante() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 1, 200: 0 })],
    [2, ms(2, { 200: 3, 100: 4 }, { 200: 3, 100: 4 })]
  ]);
  // La vuelta tiene tanda: local 200 anota 3, visitante 100 anota 4 → gana 100
  assert.strictEqual(getShootoutWinner(tie.matches, byId), 100);
}

function test_getShootoutWinner_sin_tanda_devuelve_null() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 1, 200: 0 })],
    [2, ms(2, { 200: 1, 100: 0 })]
  ]);
  assert.strictEqual(getShootoutWinner(tie.matches, byId), null);
}

function test_resolveTie_agregado_empate_tanda_decide_eliminado() {
  const tie = groupTies([partido(1, '16', 100, 200), partido(2, '16', 200, 100)])[0];
  const byId = new Map([
    [1, ms(1, { 100: 1, 200: 0 })],
    [2, ms(2, { 200: 1, 100: 0 }, { 200: 3, 100: 4 })]
  ]);
  // Agregado 1-1. Tanda en la vuelta: 100 gana 4-3 → avanza 100, eliminado 200
  const r = resolveTie(tie, byId);
  assert.strictEqual(r.resuelto, true);
  assert.strictEqual(r.eliminado, 200);
}

function test_computeEliminatorias_final_empatada_tanda_resuelta() {
  const matches = [partido(1, 'final', 100, 200)];
  const matchStats = [ms(1, { 100: 1, 200: 1 }, { 100: 4, 200: 3 })];
  const r = computeEliminatorias(matches, matchStats);
  assert.strictEqual(r.rondasResueltas.includes('final'), true);
  assert.strictEqual(r.final.campeon, 100);
  assert.strictEqual(r.final.subcampeon, 200);
}

function test_reachedPhases_final_tanda_campeon() {
  const matches = [partido(1, 'final', 100, 200)];
  const matchStats = [ms(1, { 100: 1, 200: 1 }, { 100: 4, 200: 3 })];
  const r = computeReachedPhases(matches, matchStats);
  assert.strictEqual(r[100], 6);
  assert.strictEqual(r[200], 5);
}
```

Actualizar el comentario del test existente `test_resolveTie_agregado_empate_pendiente` (línea 46: `// Agregado: 1-1 → pendiente (penaltis no implementados)`) por `// Agregado 1-1 sin tanda → pendiente`.

Registrar los nuevos tests en el array `tests` (líneas 231-246), tras `test_resolveTie_cruce_con_menos_de_dos_partidos_no_resuelto`:

```js
  test_getShootoutWinner_gana_visitante,
  test_getShootoutWinner_sin_tanda_devuelve_null,
  test_resolveTie_agregado_empate_tanda_decide_eliminado,
  test_computeEliminatorias_final_empatada_tanda_resuelta,
  test_reachedPhases_final_tanda_campeon,
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `node tests/eliminatorias.test.js` (en `/home/ldoc/Proyectos/porra-spa`)
Expected: FAIL con errores tipo `getShootoutWinner is not a function` y asserts fallidos en los nuevos tests.

- [ ] **Step 3: Implementar `getShootoutWinner` en `js/eliminatorias.js`**

Insertar justo antes de `resolveTie` (línea 20):

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

Actualizar el comentario de `resolveTie` (líneas 15-19) para reflejar el desempate por tanda:

```js
  /**
   * Resuelve un cruce a doble partido por agregado.
   * Devuelve { resuelto, eliminado }. resuelto=false si falta algún resultado.
   * Si el agregado queda empatado, se desempata por tanda de penaltis
   * (getShootoutWinner); sin tanda, el cruce queda sin resolver.
   */
```

- [ ] **Step 4: Usar la tanda en `resolveTie`**

Sustituir la línea 33:

```js
    if (totA === totB) return { resuelto: false, eliminado: null };
```

por:

```js
    if (totA === totB) {
      const winner = getShootoutWinner(tie.matches, matchStatsById);
      if (winner === null) return { resuelto: false, eliminado: null };
      return { resuelto: true, eliminado: winner === tie.teamA ? tie.teamB : tie.teamA };
    }
```

- [ ] **Step 5: Resolver la final por tanda en `computeEliminatorias`**

Sustituir el bloque de la final (líneas 63-75) por:

```js
    const final = { campeon: null, subcampeon: null };
    const finalMatches = (matches || []).filter(m => m.fase === 'final');
    if (finalMatches.length === 1) {
      const f = finalMatches[0];
      const ms = matchStatsById.get(f.id);
      const gA = ms?.stats?.[f.homeTeamId]?.goles;
      const gB = ms?.stats?.[f.awayTeamId]?.goles;
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
    }
```

- [ ] **Step 6: Resolver la final por tanda en `computeReachedPhases`**

Sustituir el bloque de la final (líneas 113-126) por:

```js
    const finalMatches = (matches || []).filter(m => m.fase === 'final');
    for (const f of finalMatches) {
      const ms = matchStatsById.get(f.id);
      const gA = ms?.stats?.[f.homeTeamId]?.goles;
      const gB = ms?.stats?.[f.awayTeamId]?.goles;
      if (gA !== undefined && gB !== undefined && gA !== gB) {
        reached[gA > gB ? f.homeTeamId : f.awayTeamId] = 6;
        reached[gA > gB ? f.awayTeamId : f.homeTeamId] = 5;
      } else if (gA !== undefined && gB !== undefined) {
        const winner = getShootoutWinner([f], matchStatsById);
        if (winner !== null) {
          reached[winner] = 6;
          reached[winner === f.homeTeamId ? f.awayTeamId : f.homeTeamId] = 5;
        } else {
          // Final empatada sin tanda: ambos alcanzaron la final (provisional)
          reached[f.homeTeamId] = 5;
          reached[f.awayTeamId] = 5;
        }
      } else {
        // Final pendiente: ambos alcanzaron la final (provisional)
        reached[f.homeTeamId] = 5;
        reached[f.awayTeamId] = 5;
      }
    }
```

- [ ] **Step 7: Exportar el nuevo helper**

En `js/eliminatorias.js` (líneas 170-177), añadir:

```js
  global.getShootoutWinner = getShootoutWinner;
```

y en `module.exports` (línea 176) incluir `getShootoutWinner`:

```js
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner };
```

- [ ] **Step 8: Ejecutar los tests y verificar que pasan**

Run: `node tests/eliminatorias.test.js` (en `/home/ldoc/Proyectos/porra-spa`)
Expected: PASS (19 tests: 14 existentes + 5 nuevos), salida limpia.

- [ ] **Step 9: Cache-busting de `eliminatorias.js`**

En `index.html:251`, cambiar:

```html
<script src="js/eliminatorias.js?v=1"></script>
```

por:

```html
<script src="js/eliminatorias.js?v=2"></script>
```

- [ ] **Step 10: Commit**

```bash
git add js/eliminatorias.js tests/eliminatorias.test.js index.html
git commit -m "feat: desempatar eliminatorias por tanda de penaltis"
```

---

### Task 2: Mostrar la tanda de penaltis bajo los resultados reales

**Files:**
- Modify: `js/main.js` (`renderMatchResult`, líneas 1846-1973; `renderPredictionsTab`, líneas 1143-1169)
- Modify: `css/styles.css` (bloque `.resultados-score` línea 2745; bloque `.profile-match-real` línea 2492)
- Modify: `index.html` (cache-busting de `main.js` y `styles.css`)

**Interfaces:**
- Consumes: `matchStats.stats[teamId].tandaPenaltis` (ausente si no hay tanda). Los `match` tienen `homeTeamId`/`awayTeamId`.

- [ ] **Step 1: Modificar `renderMatchResult` para mostrar la tanda**

En `js/main.js`, dentro de `renderMatchResult`, sustituir el bloque `scoreDisplay` (líneas 1938-1946) por:

```js
  const pensHome = matchStats?.stats?.[match.homeTeamId]?.tandaPenaltis;
  const pensAway = matchStats?.stats?.[match.awayTeamId]?.tandaPenaltis;
  const hasPens = hasResult && pensHome !== undefined && pensAway !== undefined;

  const scoreDisplay = hasResult ? `
    <div class="resultados-score-line">
      <span class="resultados-goals">${homeGoals}</span>
      <span class="resultados-separator">-</span>
      <span class="resultados-goals">${awayGoals}</span>
    </div>
    ${hasPens ? `<span class="resultados-pens">(${pensHome} - ${pensAway})</span>` : ''}
  ` : `
    <span class="resultados-goals pending">-</span>
    <span class="resultados-separator">-</span>
    <span class="resultados-goals pending">-</span>
  `;
```

> Nota: `matchStats` ya existe en `renderMatchResult` (línea 1848: `const matchStats = hasResult ? AppState.matchStats.find(ms => ms.eventId === match.id) : null;`). No crear una segunda variable con el mismo nombre.

- [ ] **Step 2: Modificar `renderPredictionsTab` para mostrar la tanda en "Real:"**

En `js/main.js`, dentro de `renderPredictionsTab`, tras las líneas 1143-1144 (`realHome`/`realAway`), añadir:

```js
            const pensHome = hasResultMatch ? matchStats.stats[m.match.homeTeamId]?.tandaPenaltis : undefined;
            const pensAway = hasResultMatch ? matchStats.stats[m.match.awayTeamId]?.tandaPenaltis : undefined;
            const hasPens = pensHome !== undefined && pensAway !== undefined;
```

Sustituir la línea 1169:

```js
                  ${isPending ? '<span class="profile-pending">⏳ Pendiente</span>' : `Real: ${realHome} - ${realAway}`}
```

por:

```js
                  ${isPending ? '<span class="profile-pending">⏳ Pendiente</span>' : `Real: ${realHome} - ${realAway}${hasPens ? ` <span class="profile-pens">(${pensHome} - ${pensAway})</span>` : ''}`}
```

- [ ] **Step 3: Añadir estilos CSS**

En `css/styles.css`, modificar el bloque `.resultados-score` (línea 2745) para que sea columna y añadir `.resultados-score-line` y `.resultados-pens`:

```css
.resultados-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.resultados-score-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resultados-pens {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  font-weight: 400;
}
```

En `css/styles.css`, tras el bloque `.profile-match-real` (línea 2492), añadir:

```css
.profile-pens {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
```

- [ ] **Step 4: Verificar sintaxis y tests**

Run (en `/home/ldoc/Proyectos/porra-spa`):
```bash
node --check js/main.js && node tests/eliminatorias.test.js
```
Expected: sin errores de sintaxis; eliminatorias 19 passing, 0 failing.

Run (regresión, los demás tests del repo):
```bash
for f in tests/*.test.js; do node "$f" >/dev/null 2>&1 || echo "FAIL: $f"; done
```
Expected: sin líneas `FAIL:`.

- [ ] **Step 5: Cache-busting de `main.js` y `styles.css`**

En `index.html`:
- Línea 19: `<link rel="stylesheet" href="css/styles.css?v=50">` → `v=51`
- Línea 253: `<script src="js/main.js?v=70"></script>` → `v=71`

- [ ] **Step 6: Commit**

```bash
git add js/main.js css/styles.css index.html
git commit -m "feat: mostrar tanda de penaltis bajo los resultados reales"
```

---

## Nota operativa (fuera de código)

Tras desplegar, re-scrapear en `api-porra` los partidos de eliminatorias y la final ya guardados en MongoDB (p.ej. `node scripts/scrapeEliminatorias.js`) para que incluyan `tandaPenaltis` y `goles` con `display`, ya que fueron scrapeados antes de estas features. Sin re-scrapeo, los cruces empatados seguirán pendientes.
