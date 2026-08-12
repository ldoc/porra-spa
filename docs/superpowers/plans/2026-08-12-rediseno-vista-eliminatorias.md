# Rediseño Vista Eliminatorias en Resultados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el layout de la sub-tab Eliminatorias en Resultados: 4 cajas por fila en 16avos/8avos/cuartos, semis centradas, y Subcampeón/Campeón en la misma fila.

**Architecture:** Cambios puramente de presentación sobre la vista read-only existente (`renderEliminatoriasView` → `.eliminatorias-view`). CSS específico con scope `.eliminatorias-view` (no afecta a la pantalla interactiva de predicciones) + un wrapper `<div class="eliminatorias-final-row">` en el render de la final.

**Tech Stack:** CSS3 vanilla (variables `:root`, Flexbox/Grid), JavaScript vanilla ES6+, HTML5.

## Global Constraints

- **Solo** afecta a la vista read-only de Resultados. La pantalla de Predicciones (tap-to-place) NO cambia.
- Reutilizar variables CSS de `:root`; no añadir valores estáticos nuevos salvo tamaños de escudo especificados.
- Cache-busting obligatorio (AGENTS.md): `css/styles.css?v=42` → `v=43` y `js/main.js?v=59` → `v=60` en `index.html`.
- Sin cambios en lógica de negocio ni en tests. Los 70 tests existentes deben seguir pasando.
- Orientación vertical móvil-first; el contenedor no supera 480px.

---

### Task 1: CSS — layout de 4 por fila y semis centradas

**Files:**
- Modify: `css/styles.css` (añadir al final del archivo, tras la línea 4472)

**Interfaces:**
- Consumes: clases existentes `.eliminatorias-view`, `.drop-zone[data-zone=...]`, `.drop-zone-slots`, `.drop-slot`, `.drop-slot-img` (definidas en `css/styles.css:3820-3992`).
- Produces: reglas CSS nuevas con scope `.eliminatorias-view` que laterales. No expone interfaces JS.

- [ ] **Step 1: Añadir las reglas CSS**

Añadir al final de `css/styles.css`:

```css
/* Rediseño vista Eliminatorias en Resultados (read-only) */
.eliminatorias-view .drop-zone[data-zone="roundOf32"] .drop-zone-slots,
.eliminatorias-view .drop-zone[data-zone="roundOf16"] .drop-zone-slots,
.eliminatorias-view .drop-zone[data-zone="quarterFinalists"] .drop-zone-slots {
  grid-template-columns: repeat(4, 1fr);
}

.eliminatorias-view .drop-zone[data-zone="roundOf32"] .drop-slot-img,
.eliminatorias-view .drop-zone[data-zone="roundOf16"] .drop-slot-img,
.eliminatorias-view .drop-zone[data-zone="quarterFinalists"] .drop-slot-img {
  width: 20px;
  height: 20px;
}

.eliminatorias-view .drop-zone[data-zone="semiFinalists"] .drop-zone-slots {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.eliminatorias-view .drop-zone[data-zone="semiFinalists"] .drop-slot {
  flex: 0 1 100px;
}

.eliminatorias-view .drop-zone[data-zone="semiFinalists"] .drop-slot-img {
  width: 22px;
  height: 22px;
}

.eliminatorias-final-row {
  display: flex;
  flex-direction: row;
  gap: 6px;
}

.eliminatorias-final-row .drop-zone {
  flex: 1;
  min-width: 0;
}
```

Nota: las cajas conservan `aspect-ratio: 1` heredado de `.drop-slot` (`css/styles.css:3889`), por lo que con 4 columnas quedan ~100px cuadradas y el nombre usa el `.drop-slot-name` existente (`8px`, ellipsis).

- [ ] **Step 2: Verificación estática del CSS**

Run: `node -e "const c=require('fs').readFileSync('css/styles.css','utf8'); const m=c.match(/grid-template-columns: repeat\(4, 1fr\)/g); if(!m||m.length<1) throw new Error('grid 4 col no presente'); console.log('CSS OK:', m.length, 'match(es)')"`
Expected: `CSS OK: 1 match(es)` (o más). No hay excepción.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: layout 4/fila en 16avos-8avos-cuartos y semis centradas (vista resultados)"
```

---

### Task 2: JS — wrapper de la fila final

**Files:**
- Modify: `js/main.js:1654-1657`

**Interfaces:**
- Consumes: `renderElimZona(title, emoji, zoneId, teamIds, max)` (`js/main.js:1664`) y `result.rondasResueltas` / `result.final` (del `computeEliminatorias(AppState.matches, AppState.matchStats)` en `js/eliminatorias.js`).
- Produces: el HTML de la final envuelto en `<div class="eliminatorias-final-row">`. No cambia ninguna firma de función.

- [ ] **Step 1: Envolver las dos zonas de la final**

En `js/main.js`, reemplazar:

```js
  if (result.rondasResueltas.includes('final')) {
    html += renderElimZona('Subcampeón', '🥈', 'runnerUp', result.final.subcampeon ? [result.final.subcampeon] : [], 1);
    html += renderElimZona('Campeón', '🏆', 'champion', result.final.campeon ? [result.final.campeon] : [], 1);
  }
```

por:

```js
  if (result.rondasResueltas.includes('final')) {
    html += '<div class="eliminatorias-final-row">';
    html += renderElimZona('Subcampeón', '🥈', 'runnerUp', result.final.subcampeon ? [result.final.subcampeon] : [], 1);
    html += renderElimZona('Campeón', '🏆', 'champion', result.final.campeon ? [result.final.campeon] : [], 1);
    html += '</div>';
  }
```

- [ ] **Step 2: Sintaxis JS válida**

Run: `node --check js/main.js`
Expected: sin errores (exit 0).

- [ ] **Step 3: Tests existentes siguen pasando**

Run: `for f in tests/*.test.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`
Expected: sin salida (ningún `FAIL`).

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: subcampeón y campeón en la misma fila en vista eliminatorias de resultados"
```

---

### Task 3: Cache-busting en index.html

**Files:**
- Modify: `index.html` (líneas 19 y 252)

**Interfaces:**
- Consumes: nada.
- Produces: versiones `?v` incrementadas que fuerzan al navegador a descargar los ficheros modificados.

- [ ] **Step 1: Bump de versiones**

En `index.html`:
- Línea 19: `css/styles.css?v=42` → `css/styles.css?v=43`
- Línea 252: `js/main.js?v=59` → `js/main.js?v=60`

No tocar `js/eliminatorias.js?v=1` (sin cambios).

- [ ] **Step 2: Verificar los bumps**

Run: `grep -n "styles.css?v\|main.js?v\|eliminatorias.js?v" index.html`
Expected: `css/styles.css?v=43`, `js/main.js?v=60`, `js/eliminatorias.js?v=1`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting styles.css v=43 y main.js v=60 tras rediseño eliminatorias"
```

---

### Task 4: Verificación manual en navegador

**Files:** ninguno (verificación interactiva).

**Interfaces:**
- Consumes: la app con `renderResultadosTab()` y `renderEliminatoriasView()` funcionando tras Tasks 1-3.

- [ ] **Step 1: Servir la app localmente**

Run: `python3 -m http.server 8000` en la raíz del repo y abrir `http://localhost:8000` en el navegador (o usar el servidor local habitual del proyecto).

- [ ] **Step 2: Inyectar datos de ejemplo en la consola**

Con la app abierta y sesión iniciada, ejecutar en la consola del navegador:

```js
AppState.resultadosTab = 'eliminatorias';
AppState.matchStats = [/* al menos un resultado de fase de liga de 16avos+ para que computeEliminatorias devuelva zonas */];
AppState.finalPredictions = {
  champion: 10, runnerUp: 44,
  semiFinalists: [30, 61],
  quarterFinalists: [98, 32, 65, 67],
  roundOf16: [100, 4, 45, 77, 40, 42, 69, 80],
  roundOf32: [9, 12, 17, 21, 25, 28, 33, 38]
};
renderResultadosTab();
```

(Si los IDs de equipos no existen en `AppState.teamsMap`, la imagen cae a `default.png` por el `onerror`, lo que es válido para la comprobación de layout.)

- [ ] **Step 3: Comprobar el layout resultante**

Verificar visualmente:
- 16avos, 8avos y cuartos: **4 cajas por fila** (escudos de 20px).
- Semis: **2 cajas centradas** (~100px).
- Final: Subcampeón y Campeón **en la misma fila**, subcampeón a la izquierda.
- La pestaña de Predicciones de Eliminatorias (tap-to-place) **mantiene** su layout de 2 columnas.

Si algo difiere del spec, reportarlo y ajustar en Tasks 1-2 antes de continuar.

- [ ] **Step 4: Anotar resultado en el ledger de la sesión**

Registrar en el plan/ledger si la verificación manual se completó o queda para el usuario (este paso puede requerir sesión real en el navegador).

---

## Notas de implementación

- No hay lógica de negocio nueva → no hay tests nuevos. La suite existente (70 tests) es la red de seguridad.
- El selector de semis usa `flex: 0 1 100px`: en pantallas muy estrechas las cajas pueden encoger, manteniendo `aspect-ratio: 1` y `min-height: 60px` heredados de `.drop-slot`.
- La regla `.eliminatorias-final-row .drop-zone { flex: 1 }` convive con los bordes laterales existentes (`css/styles.css:4466-4472`): Subcampeón `#CBD5E1`, Campeón `--accent-gold`.
