# Navegación de jornadas compacta + indicador de fase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el menú de navegación de jornadas de Pronósticos por un selector ultracompacto centrado con píldora de fase (color por fase, progreso integrado) y, en eliminatorias, mostrar solo el título de la fase.

**Architecture:** SPA vanilla JS (`js/main.js`) + CSS (`css/styles.css`). Los tests son ficheros autónomos que espejan las funciones de `main.js` (no lo importan). El bloque a cambiar es el `.round-nav` de `renderPronosticosTab` y las funciones que lo actualizan (`renderRoundMatches`, `updateProgressCounts`). Los nuevos helpers (`getFasePillInfo`, `buildRoundFasePill`, `renderRoundNav`) son funciones puras o dependen solo de `AppState`, testables por espejo.

**Tech Stack:** JavaScript vanilla (ES6+), CSS vanilla (incluye `color-mix()`), Node.js para tests.

## Global Constraints

- No usar frameworks. Seguir el patrón de las funciones/estilos existentes de `main.js`/`styles.css`.
- La píldora de fase: `font-size: 12px`, `font-weight: 800`, borde/fondo con `--fc` (color de fase), radius `9999px`.
- Contador de progreso: fondo `#10B981`, texto `#021319`.
- Jornada activa: color `--accent-cyan` (`#06B6D4`).
- Flechas ‹ › de 36x36px; en eliminatorias no hay flechas ni contador.
- Colores por fase: `liga` → `#FF9800`, `16` → `#2196F3`, `8`/`4`/`semis`/`final` → `#F44336`.
- Etiquetas: `liga`→Liga, `16`→Dieciseisavos, `8`→Octavos, `4`→Cuartos, `semis`→Semifinal, `final`→Final. Iconos: liga `⚽`, `16`/`8`/`4`/`semis` `⚔️`, `final` `🏆`.
- Los tests NO importan `main.js`; espejan sus funciones (patrón existente en `tests/`).
- Cache-busting obligatorio al tocar `css/styles.css` y `js/main.js`: incrementar `?v=` en `index.html` (hoy CSS `v=48`, JS `v=68`).

---

### Task 1: Tests espejo de la píldora de fase y el navegador

**Files:**
- Create: `tests/roundNav.test.js`

**Interfaces:**
- Consumes: ninguna (funciones espejo autocontenidas).
- Produces: helpers espejo `getFasePillInfo(fase)` y `buildRoundFasePill(fase, round, totalRounds, predicted, total)` y sus tests, con el mismo contrato que se implementará en Task 2.

- [ ] **Step 1: Crear `tests/roundNav.test.js`**

```js
const assert = require('assert');

function getFasePillInfo(fase) {
  const map = {
    liga:  { label: 'Liga',        icono: '⚽',  color: '#FF9800' },
    '16':  { label: 'Dieciseisavos', icono: '⚔️', color: '#2196F3' },
    '8':   { label: 'Octavos',     icono: '⚔️',  color: '#F44336' },
    '4':   { label: 'Cuartos',     icono: '⚔️',  color: '#F44336' },
    semis: { label: 'Semifinal',   icono: '⚔️',  color: '#F44336' },
    final: { label: 'Final',       icono: '🏆',  color: '#F44336' }
  };
  return map[fase] || { label: fase, icono: '⚽', color: '#FF9800' };
}

function buildRoundFasePill(fase, round, totalRounds, predicted, total) {
  const info = getFasePillInfo(fase);
  if (totalRounds <= 1) return `${info.icono} ${info.label}`;
  return `${info.icono} ${info.label} · Jornada <span class="round-fase-jornada">${round}</span>/${totalRounds} <span class="round-fase-progress">${predicted}/${total}</span>`;
}

function test_pill_info_todas_las_fases() {
  const expected = {
    liga:  { label: 'Liga',        icono: '⚽',  color: '#FF9800' },
    '16':  { label: 'Dieciseisavos', icono: '⚔️', color: '#2196F3' },
    '8':   { label: 'Octavos',     icono: '⚔️',  color: '#F44336' },
    '4':   { label: 'Cuartos',     icono: '⚔️',  color: '#F44336' },
    semis: { label: 'Semifinal',   icono: '⚔️',  color: '#F44336' },
    final: { label: 'Final',       icono: '🏆',  color: '#F44336' }
  };
  for (const fase of Object.keys(expected)) {
    assert.deepStrictEqual(getFasePillInfo(fase), expected[fase], `info de fase ${fase}`);
  }
}

function test_pill_info_fallback() {
  assert.deepStrictEqual(getFasePillInfo('desconocida'), { label: 'desconocida', icono: '⚽', color: '#FF9800' });
}

function test_pill_liga_incluye_jornada_y_progreso() {
  const html = buildRoundFasePill('liga', 1, 8, 3, 18);
  assert.ok(html.includes('Liga'), 'debe incluir label Liga');
  assert.ok(html.includes('Jornada'), 'debe incluir palabra Jornada');
  assert.ok(html.includes('>1</span>/8'), 'jornada activa 1 de 8');
  assert.ok(html.includes('round-fase-jornada'), 'clase de jornada activa');
  assert.ok(html.includes('round-fase-progress'), 'clase de contador de progreso');
  assert.ok(html.includes('>3/18</span>'), 'contador 3/18');
}

function test_pill_eliminatorias_solo_fase() {
  const html = buildRoundFasePill('8', 1, 1, 0, 0);
  assert.strictEqual(html, '⚔️ Octavos');
  assert.ok(!html.includes('Jornada'), 'sin palabra Jornada');
  assert.ok(!html.includes('round-fase-progress'), 'sin contador de progreso');
  assert.ok(!html.includes('/1'), 'sin sufijo de jornada');
}

function test_pill_final_icono() {
  assert.ok(buildRoundFasePill('final', 1, 1, 1, 1).includes('🏆 Final'));
}

const tests = [
  test_pill_info_todas_las_fases,
  test_pill_info_fallback,
  test_pill_liga_incluye_jornada_y_progreso,
  test_pill_eliminatorias_solo_fase,
  test_pill_final_icono
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test y verificar que pasa**

Run: `node tests/roundNav.test.js`
Expected: 5 passing, 0 failing.

- [ ] **Step 3: Commit**

```bash
git add tests/roundNav.test.js
git commit -m "test: contrato de la píldora de fase y navegación de jornadas"
```

---

### Task 2: Helpers de la píldora en main.js

**Files:**
- Modify: `js/main.js` (insertar tras `isPhaseFrozen`, ~línea 3407, antes de `renderPronosticosTab`)

**Interfaces:**
- Consumes: `AppState.currentPhaseMatches`, `AppState.currentRound`, `AppState.currentPhaseRounds`, `getMatchesForCurrentPhase()`, `countPredictedInRound(round)`.
- Produces:
  - `getFasePillInfo(fase) → { label, icono, color }`
  - `buildRoundFasePill(fase, round, totalRounds, predicted, total) → string` (contenido HTML)
  - `renderRoundNav() → void`

- [ ] **Step 1: Insertar los tres helpers** justo antes de `function renderPronosticosTab()` (línea 3409)

```js
function getFasePillInfo(fase) {
  const map = {
    liga:  { label: 'Liga',        icono: '⚽',  color: '#FF9800' },
    '16':  { label: 'Dieciseisavos', icono: '⚔️', color: '#2196F3' },
    '8':   { label: 'Octavos',     icono: '⚔️',  color: '#F44336' },
    '4':   { label: 'Cuartos',     icono: '⚔️',  color: '#F44336' },
    semis: { label: 'Semifinal',   icono: '⚔️',  color: '#F44336' },
    final: { label: 'Final',       icono: '🏆',  color: '#F44336' }
  };
  return map[fase] || { label: fase, icono: '⚽', color: '#FF9800' };
}

function buildRoundFasePill(fase, round, totalRounds, predicted, total) {
  const info = getFasePillInfo(fase);
  if (totalRounds <= 1) return `${info.icono} ${info.label}`;
  return `${info.icono} ${info.label} · Jornada <span class="round-fase-jornada">${round}</span>/${totalRounds} <span class="round-fase-progress">${predicted}/${total}</span>`;
}

function renderRoundNav() {
  const phaseMatches = AppState.currentPhaseMatches || [];
  const round = AppState.currentRound;
  const totalRounds = AppState.currentPhaseRounds || 1;
  const { fase } = getMatchesForCurrentPhase();
  const roundMatches = phaseMatches.filter(m => m.ronda === round);
  const roundTotal = roundMatches.length;
  const roundPredicted = countPredictedInRound(round);

  const pill = document.getElementById('round-fase-pill');
  if (pill) {
    pill.style.setProperty('--fc', getFasePillInfo(fase).color);
    pill.innerHTML = buildRoundFasePill(fase, round, totalRounds, roundPredicted, roundTotal);
  }

  const prevBtn = document.getElementById('btn-round-prev');
  const nextBtn = document.getElementById('btn-round-next');
  if (prevBtn) prevBtn.disabled = round <= 1;
  if (nextBtn) nextBtn.disabled = round >= totalRounds;
}
```

- [ ] **Step 2: Verificar sintaxis y tests**

Run: `node --check js/main.js && node tests/roundNav.test.js`
Expected: sin errores de sintaxis; 5 passing, 0 failing (los helpers de main.js no se ejecutan en los tests, que usan sus espejos).

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: helpers de píldora de fase y renderRoundNav"
```

---

### Task 3: Refactor del template y de las actualizaciones de indicadores

**Files:**
- Modify: `js/main.js` (template de `renderPronosticosTab` ~3441-3446; `renderRoundMatches` ~3484-3524; `updateProgressCounts` ~3632-3653)

**Interfaces:**
- Consumes: `renderRoundNav()` (Task 2), `rounds` de `getMatchesForCurrentPhase()`.
- Produces: navegador nuevo en el DOM (`#round-nav`, `#round-fase-pill`, `#btn-round-prev`, `#btn-round-next`); se eliminan `#round-indicator` y `#round-progress-text`.

- [ ] **Step 1: Sustituir el bloque `.round-nav` + `.round-progress-text` del template** (líneas 3441-3446)

Reemplazar:

```js
      <div class="round-nav">
        <button class="round-nav-btn" id="btn-round-prev" disabled>&larr; Jornada anterior</button>
        <span class="round-indicator" id="round-indicator">Jornada 1 de ${rounds}</span>
        <button class="round-nav-btn" id="btn-round-next">Siguiente jornada &rarr;</button>
      </div>
      <div class="round-progress-text" id="round-progress-text"></div>
```

por:

```js
      <div class="round-nav ${rounds > 1 ? '' : 'round-nav-single'}" id="round-nav">
        ${rounds > 1 ? `
          <button class="round-nav-arrow" id="btn-round-prev" disabled>&lsaquo;</button>
          <span class="round-fase-pill" id="round-fase-pill"></span>
          <button class="round-nav-arrow" id="btn-round-next">&rsaquo;</button>
        ` : `
          <span class="round-fase-pill round-fase-pill-single" id="round-fase-pill"></span>
        `}
      </div>
```

Nota: `renderRoundMatches()` se llama justo después de `container.innerHTML = ...` en `renderPronosticosTab`, así que la píldora se rellena en el primer render sin cambios adicionales.

- [ ] **Step 2: Sustituir las actualizaciones de indicadores en `renderRoundMatches`** (líneas 3495-3523)

Reemplazar:

```js
  // Actualizar indicadores
  const indicator = document.getElementById('round-indicator');
  if (indicator) indicator.textContent = `Jornada ${round} de ${totalRounds}`;

  const roundPredicted = countPredictedInRound(round);
  const roundTotal = roundMatches.length;
  const roundPct = Math.round((roundPredicted / roundTotal) * 100);

  const roundProgressEl = document.getElementById('round-progress-text');
  if (roundProgressEl) {
    roundProgressEl.innerHTML = `Jornada ${round}: <strong>${roundPredicted}</strong> de <strong>${roundTotal}</strong> pronosticados`;
  }

  // Actualizar barra de progreso global
  const totalPredicted = countPredictedInPhase(phaseMatches);
  const totalMatches = phaseMatches.length;
  const globalPct = Math.round((totalPredicted / totalMatches) * 100);
  const progressFill = document.querySelector('.wizard-progress-fill');
  const progressText = document.querySelector('.wizard-progress-text');
  if (progressFill) progressFill.style.width = `${globalPct}%`;
  if (progressText) {
    progressText.innerHTML = `<strong>${totalPredicted}</strong> de <strong>${totalMatches}</strong> partidos pronosticados`;
  }

  // Botones prev/next de ronda
  const prevBtn = document.getElementById('btn-round-prev');
  const nextBtn = document.getElementById('btn-round-next');
  if (prevBtn) prevBtn.disabled = round <= 1;
  if (nextBtn) nextBtn.disabled = round >= totalRounds;
```

por:

```js
  // Píldora de fase + estado de flechas
  renderRoundNav();

  // Actualizar barra de progreso global
  const totalPredicted = countPredictedInPhase(phaseMatches);
  const totalMatches = phaseMatches.length;
  const globalPct = Math.round((totalPredicted / totalMatches) * 100);
  const progressFill = document.querySelector('.wizard-progress-fill');
  const progressText = document.querySelector('.wizard-progress-text');
  if (progressFill) progressFill.style.width = `${globalPct}%`;
  if (progressText) {
    progressText.innerHTML = `<strong>${totalPredicted}</strong> de <strong>${totalMatches}</strong> partidos pronosticados`;
  }
```

Y eliminar la declaración ahora sin uso `const totalRounds = AppState.currentPhaseRounds || 1;` (línea 3491). `roundMatches` (línea 3490) y `frozen`/`fase` (líneas 3492-3493) se siguen usando más abajo y deben permanecer.

- [ ] **Step 3: Sustituir la actualización del progreso de ronda en `updateProgressCounts`** (líneas 3632-3642)

Reemplazar:

```js
function updateProgressCounts() {
  const round = AppState.currentRound;
  const phaseMatches = AppState.currentPhaseMatches || [];
  const roundPredicted = countPredictedInRound(round);
  const roundMatches = phaseMatches.filter(m => m.ronda === round);
  const roundTotal = roundMatches.length;

  const roundProgressEl = document.getElementById('round-progress-text');
  if (roundProgressEl) {
    roundProgressEl.innerHTML = `Jornada ${round}: <strong>${roundPredicted}</strong> de <strong>${roundTotal}</strong> pronosticados`;
  }
```

por:

```js
function updateProgressCounts() {
  const phaseMatches = AppState.currentPhaseMatches || [];

  renderRoundNav();
```

(el resto de la función — progreso global — se mantiene igual.)

- [ ] **Step 4: Verificar sintaxis y ejecutar los tests de rondas**

Run: `node --check js/main.js && node tests/roundNav.test.js && node tests/getMatchesForCurrentPhase.test.js`
Expected: sin errores de sintaxis; todos pasan.

- [ ] **Step 5: Verificación manual en navegador**

Run: `node server.mjs` (desde `/home/ldoc/Proyectos/porra-spa`) y abrir `http://localhost:8080`. En la pestaña Pronósticos (fase Liga):
- El navegador aparece centrado con `[‹] ⚽ Liga · Jornada 1/8 · [0/18] [›]`.
- El botón derecho no se corta en ventana estrecha (~360px).
- Pulsar `›` cambia de jornada y el contador `X/18` se actualiza.
- Tras pulsar `+`/`−` en un partido, el contador de la jornada se actualiza sin errores de consola.
- En una fase de eliminatoria (cambiar `faseJuego` en la respuesta de config si es posible) solo aparece la píldora centrada sin flechas.

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "feat: navegación de jornadas compacta con píldora de fase en pronósticos"
```

---

### Task 4: Estilos del nuevo navegador (css/styles.css)

**Files:**
- Modify: `css/styles.css` (bloque `.round-nav`...`.round-progress-text strong`, líneas 1830-1884)

**Interfaces:**
- Consumes: clases HTML del nuevo navegador (`round-nav`, `round-nav-single`, `round-nav-arrow`, `round-fase-pill`, `round-fase-pill-single`, `round-fase-jornada`, `round-fase-progress`).
- Produces: navegador centrado (grid `1fr auto 1fr`), flechas 36px, píldora con `--fc`, contador verde.

- [ ] **Step 1: Reemplazar el bloque de navegación de rondas** (líneas 1830-1884: `.round-nav`, `.round-nav-btn`, `.round-nav-btn:disabled`, `.round-nav-btn:not(:disabled):active`, `.round-indicator`, `.round-progress-text`, `.round-progress-text strong`) por:

```css
/* Navegación de rondas (compacta) */
.round-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.round-nav-single {
  grid-template-columns: 1fr;
  justify-items: center;
}

.round-nav-arrow {
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--ucl-card);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  justify-self: stretch;
  transition: all var(--transition-fast);
}

.round-nav-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.round-nav-arrow:not(:disabled):active {
  background: var(--accent-cyan);
  color: #021319;
  transform: scale(0.95);
}

.round-fase-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--fc, #FF9800) 12%, transparent);
  border: 1px solid var(--fc, #FF9800);
  border-radius: 9999px;
  padding: 5px 12px;
  white-space: nowrap;
}

.round-fase-pill-single {
  padding: 6px 14px;
}

.round-fase-jornada {
  color: var(--accent-cyan);
}

.round-fase-progress {
  background: #10B981;
  color: #021319;
  border-radius: 9999px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 800;
}
```

- [ ] **Step 2: Comprobar que no quedan referencias huérfanas a clases antiguas**

Run (desde `/home/ldoc/Proyectos/porra-spa`):
```bash
grep -n "round-nav-btn\|round-indicator\|round-progress-text" css/styles.css js/main.js index.html
```
Expected: 0 coincidencias (todas las referencias se han migrado o eliminado).

- [ ] **Step 3: Verificación manual en navegador** (repetición de Task 3 Step 5, con el navegador ya abierto): comprobar que la píldora tiene el borde/fondo naranja en Liga, que el contador verde `0/18` se ve bien, y que en eliminatorias la píldora aparece centrada y con su color.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: selector de jornadas compacto con píldora de fase"
```

---

### Task 5: Cache-busting y verificación final

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Incrementar versiones** en `index.html`

```html
<link rel="stylesheet" href="css/styles.css?v=49">
...
<script src="js/main.js?v=69"></script>
```

- [ ] **Step 2: Ejecutar toda la batería de tests de porra-spa**

Run (desde `/home/ldoc/Proyectos/porra-spa`):
```bash
node tests/buildPhaseOptionsHtml.test.js
node tests/eliminatorias.test.js
node tests/fasesDesc.test.js
node tests/getFaseDesc.test.js
node tests/getMatchesForCurrentPhase.test.js
node tests/getRelevantJourney.test.js
node tests/integrationPhasePredictions.test.js
node tests/journeyLabel.test.js
node tests/journeySort.test.js
node tests/phaseAwarePredictions.test.js
node tests/roundNav.test.js
node tests/unwrapAllPredictions.test.js
```
Expected: todos pasan (0 failing).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting css v49 y main.js v69"
```
