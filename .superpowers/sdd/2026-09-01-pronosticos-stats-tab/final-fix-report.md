# Final Fix Report — Whole-branch review (Important findings)

**Date:** 2026-09-01
**Branch review:** 99fef2c..c9ad556
**Fix commit:** a4911ff

## Findings addressed (both Important)

### 1. `js/stats.js:859` matchStats gating blocks pronosticos
**Before:**
```js
if (!AppState.matchStats.length) {
  container.innerHTML = '<div ...>No hay resultados...</div>';
  return;
}
```
Blocked pronosticos when matchStats empty, violating spec (Pronósticos must work with only allPredictions, even in FASE_LIGA without results). Also violated Task 5 global constraint "Cálculos de Pronósticos deben funcionar aunque matchStats esté vacío".

**After:**
```js
if (!AppState.matchStats.length && AppState.estadisticasSubTab !== 'pronosticos') {
  container.innerHTML = '<div ...>No hay resultados...</div>';
  return;
}
```
Keeps `if(isFasePretemporada())` guard intact above it. Verification: with FASE_LIGA and empty matchStats, pronosticos renders 4 cards; other subtabs (evolucion/individual/rachas/plantillas) still show "No hay resultados" as before. Tested via node mock:
- `AppState.matchStats=[]`, `estadisticasSubTab='pronosticos'` → `shouldBlock=false`
- `estadisticasSubTab='evolucion'` → `shouldBlock=true`

### 2. Incomplete card metrics — computed but not rendered
- **Partidos:** `leastRepeated` (stats.js:454) computed but not rendered. Added `leastRep` pill alongside `mostRep` and `raro` in `renderPronosticosPartidosCard`:
  `Más repetido: ${mostRep} Menos repetido: ${leastRep} Raro: ${raro}`
- **Clasificación:** `freqTop8` and `dispersion` computed but not rendered. Added in `renderPronosticosClasificacionCard`:
  - `freqTop8Entries` sorted top 3 → section "Más veces Top8"
  - `maxDisp` = max dispersion entry → section "Mayor dispersión σ X" with team image + sigma value
- **Plantilla:** `equipoMenos` computed but not rendered. Added alongside `equipoMas` in `renderPronosticosPlantillaCard`:
  `Equipo más elegido: ${equipoMas} Equipo menos elegido: ${equipoMenos}`
- **Minors:** Deleted unused `minEntropy` var from `let mostConsensus=null, mostDivided=null, maxPct=-1, minEntropy=Infinity` → `maxPct=-1`. Kept `diferencial <=30` threshold as per plan (no spec update). Ensured 2-space indentation inside IIFE for the 6 calc functions (outer `  function`).

## Tests

```
for f in tests/pronosticos*.test.js tests/estadisticas*.test.js; do node $f; done
  pronosticosClasificacion.test.js → OK clasificacion
  pronosticosElimsPlantilla.test.js → OK elimsPlantilla
  pronosticosPartidos.test.js → OK pronosticosPartidos
  pronosticosRender.test.js → OK render
  estadisticas-subtabs.test.js → OK 7/7
  estadisticas.test.js → OK buildTimeline
  estadisticasPronosticos.test.js → OK Task1
cleanupCheck.test.js → not exists (expected, no regression)
All pronosticos/estadisticas tests PASS.

Manual verification:
  renderPronosticosBody with empty squadOwnership returns 4 cards without throw → PASS
  leastRepeated pill present → PASS
  freqTop8 section present when users>0 → PASS (hidden when empty, correct)
  dispersion σ section present → PASS
  equipoMenos rendered when plantilla has data → PASS (hidden on empty plantilla, correct empty state)
  Broader suite: 30 passing, 4 failing in integrationPhasePredictions.test.js (same 4 failures as before stash, pre-existing, unrelated to stats.js)
```

## Files changed
- `js/stats.js` (gating, leastRepeated, freqTop8/dispersion, equipoMenos, minEntropy removal, indentation)
- `css/styles.css` — no change required (already contains .stats-pronosticos-* )
- `index.html` — no bump required (styles/js versions already at v86/v5/v124; no new CSS)

## Commit
```
git add js/stats.js css/styles.css index.html && git commit -m "fix(stats): allow pronosticos without matchStats and render missing metrics"
```
