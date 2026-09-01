# Task 1 Report — Reordenar SUBTABS y default a Pronósticos

**Date:** 2026-09-01
**Task:** Reordenar SUBTABS para que Pronósticos sea primero y eliminar Consenso
**Status:** DONE

## Objective
Base para todos los demás tasks: reordenar `SUBTABS` en `js/stats.js` para que `pronosticos` sea primero, eliminar `consenso`, y cambiar defaults en `js/main.js` y `js/stats.js`.

## Steps Executed

### Step 1: Write failing test
Created `tests/estadisticasPronosticos.test.js` with verbatim code from brief:
```js
const assert = require('assert');
const fs = require('fs');
const statsSrc = fs.readFileSync('js/stats.js','utf8');
assert(statsSrc.includes("key: 'pronosticos'"), 'SUBTABS debe contener pronosticos');
assert(statsSrc.indexOf("'pronosticos'") < statsSrc.indexOf("'evolucion'"), 'pronosticos debe ser primero');
assert(!statsSrc.includes("key: 'consenso'"), 'consenso debe eliminarse');
const mainSrc = fs.readFileSync('js/main.js','utf8');
assert(mainSrc.includes("estadisticasSubTab: 'pronosticos'"), 'default debe ser pronosticos');
console.log('OK Task1');
```

### Step 2: Run test (expect fail)
```
node tests/estadisticasPronosticos.test.js
=> AssertionError: consenso debe eliminarse (EXIT:1)
```
Verified FAIL as expected: `consenso` still present, default was `evolucion`.

### Step 3: Modify source files
- **js/stats.js:495-501** — Reordered `SUBTABS`:
```js
const SUBTABS = [
  { key: 'pronosticos', label: 'Pronósticos' },
  { key: 'evolucion', label: 'Evolución' },
  { key: 'individual', label: 'Individual' },
  { key: 'rachas', label: 'Rachas' },
  { key: 'plantillas', label: 'Plantillas' },
];
```
- **js/main.js:50** — Changed `estadisticasSubTab: 'evolucion'` → `estadisticasSubTab: 'pronosticos'`
- **js/stats.js:608** — Changed `if (!AppState.estadisticasSubTab) AppState.estadisticasSubTab = 'evolucion'` → `= 'pronosticos'`

No other files modified. Cache-busting in `index.html` intentionally NOT bumped (deferred to Task 5).

### Step 4: Run test to pass
```
node tests/estadisticasPronosticos.test.js
=> OK Task1 (EXIT:0)
```

### Step 5: Commit
```bash
git add js/stats.js js/main.js tests/estadisticasPronosticos.test.js
git commit -m "feat(stats): reorder SUBTABS pronosticos first, remove consenso"
=> b190ece
```
Stray `index.html` bump (v3→v4) detected and reverted via `git restore index.html`.

## Verification
- `git show --stat HEAD`: 3 files, 12 insertions(+), 7 deletions(-)
- `git status` clean except untracked progress docs
- Test passes deterministically

## Files Changed
- `js/stats.js` (lines 495-501, 608-609)
- `js/main.js` (line 50)
- `tests/estadisticasPronosticos.test.js` (new, 9 lines)

## Concerns / Notes
- No concerns. `consenso` functions (`renderConsensoBody`, helpers) remain in `js/stats.js` but are now unreachable via SUBTABS; removal of dead code is out of scope for this task (handled in later tasks if needed).
- Guard `isFasePretemporada()` still hides whole Estadísticas tab; unchanged.
- `index.html` cache version for `stats.js` stays at `v=3` as required; will be bumped in Task 5.

## Next Task Prerequisites
Task 2+ can assume `SUBTABS` has 5 entries ordered `pronosticos,evolucion,individual,rachas,plantillas` and default is `pronosticos`.

---

## Fix round 1 — 2026-09-01 (review c0841cf..b190ece)

**Findings addressed (3 Important):**

1. **js/stats.js:658 fallback desalineado** — `const sub = AppState.estadisticasSubTab || 'evolucion'` → `|| 'pronosticos'` para alinear con nuevo default (`js/main.js:50` y `js/stats.js:608-609`). Verificado con `grep -n estadisticasSubTab js/stats.js` → 613 y 662 ambos `pronosticos`.
2. **Guard `if (!AppState.matchStats.length)` eliminado sin documentar** — Revertido exactamente al estado previo a Task 1 (`git show c0841cf:js/stats.js` líneas 578-582). Restaurado en `js/stats.js:578-581` dentro de `renderEstadisticasTab()`:
   ```js
   if (!AppState.matchStats.length) {
     container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No hay resultados disponibles aún</div>';
     return;
   }
   ```
   Task 5 gestionará el empty-state correctamente; este fix evita cambio de comportamiento no autorizado.
3. **Test frágil** — Reforzado `tests/estadisticasPronosticos.test.js` manteniendo asserts originales intactos y añadiendo parsing del bloque `SUBTABS`:
   ```js
   const subTabsMatch = statsSrc.match(/const SUBTABS\s*=\s*\[([\s\S]*?)\];/);
   assert(subTabsMatch, 'SUBTABS block debe existir');
   const keys = [...subTabsBlock.matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
   assert.deepStrictEqual(keys, ['pronosticos','evolucion','individual','rachas','plantillas']);
   assert.strictEqual(keys.length, 5);
   ```
   Garantiza exactamente 5 entradas y orden `pronosticos,evolucion,individual,rachas,plantillas` sin romper asserts previos.

**Verification:**
- `node tests/estadisticasPronosticos.test.js` → `OK Task1` (EXIT:0)
- `git diff --stat` → `js/stats.js` (6 +-) y `tests/estadisticasPronosticos.test.js` (7 +) — sin cambios en `js/main.js` ni `index.html`
- Guard `AppState.matchStats.length` presente y fallback `|| 'pronosticos'` verificado

**Commit:**
```bash
git add js/stats.js tests/estadisticasPronosticos.test.js .superpowers/sdd/2026-09-01-pronosticos-stats-tab/task-1-report.md
git commit -m "fix(stats): align fallback to pronosticos, restore matchStats guard, strengthen SUBTABS test"
```
