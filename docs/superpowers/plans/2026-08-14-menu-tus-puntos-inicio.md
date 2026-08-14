# Menú «Tus puntos» en Inicio — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón compacto «Tus puntos» en la esquina superior izquierda de la pantalla Inicio que muestra los puntos totales del usuario y despliega una rejilla 2×2 con accesos directos a Pronósticos, Plantilla, Clasificación y Eliminatorias.

**Architecture:** El menú se renderiza como HTML dentro de `#inicio-container` en `renderInicioTab` (js/main.js). El número de puntos se calcula con una función auxiliar que replica la lógica de `renderClasificacionTab` (mismo total que la columna Total). El toggle y la navegación se manejan con listeners de evento; el cierre por clic fuera/Escape usa delegación global.

**Tech Stack:** HTML5 + CSS3 vanilla + JavaScript ES6 (sin frameworks). Tests con Node `assert` en scripts independientes (patrón del repo: se re-declaran las funciones puras en el test).

## Global Constraints

- **Cache-busting (AGENTS.md):** si se toca `css/styles.css`, incrementar `v=` en el `<link>` de `index.html`; si se toca `js/main.js`, incrementar `v=` en el `<script>`.
- **Mobile portrait first:** sin scroll horizontal (`overflow-x: hidden`); contenedor máximo 480px en escritorio.
- **Toque mínimo 44×44px** en elementos interactivos.
- **Reutilizar variables CSS** de `:root` (`--ucl-card`, `--ucl-surface`, `--ucl-card-hover`, `--accent-cyan`, `--text-secondary`, `--border-color`, `--radius-full`, `--radius-md`, `--radius-lg`, `--shadow-card`, `--transition-fast/normal`).
- **JS vanilla, sin frameworks.**
- El guard existente de la pestaña Eliminatorias (js/main.js:2622) se conserva: si `!AppState.predictionsConfirmed`, `navigateToTab('final-predictions')` muestra el toast y no navega.
- Los iconos de las celdas son SVG `stroke` idénticos a los del bottom-nav; Eliminatorias usa un trofeo nuevo.
- El número de puntos es el **total real** (`realPoints`) del usuario, siempre visible (0 en pretemporada).

---

### Task 1: Builder HTML del menú (`POINTS_MENU_TABS` + `buildPointsMenuHtml`)

**Files:**
- Create: `tests/menuTusPuntos.test.js`
- Modify: `js/main.js` (añadir constantes/función; cualquier lugar a nivel superior, p. ej. justo antes de `renderInicioTab` en ~line 2914)

**Interfaces:**
- Consumes: nada (función pura).
- Produces:
  - `const POINTS_MENU_TABS` — array de `{ tab, label, cls, icon }` (4 entradas; icon = string SVG).
  - `function buildPointsMenuHtml(totalPoints) → string` — HTML del botón (2 líneas: «TUS PUNTOS» + `⭐ <total> ▾`) y desplegable con `hidden`, `aria-expanded="false"`, y las 4 celdas con `data-tab`.

- [ ] **Step 1: Write the failing test**

Create `tests/menuTusPuntos.test.js` (sigue el patrón del repo: funciones re-declaradas + runner manual):

```js
const assert = require('assert');

const POINTS_MENU_TABS = [
  { tab: 'pronosticos', label: 'Pronósticos', cls: 'tile-pronosticos', icon: '<svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
  { tab: 'plantilla', label: 'Plantilla', cls: 'tile-plantilla', icon: '<svg viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>' },
  { tab: 'clasificacion', label: 'Clasificación', cls: 'tile-clasificacion', icon: '<svg viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
  { tab: 'final-predictions', label: 'Eliminatorias', cls: 'tile-eliminatorias', icon: '<svg viewBox="0 0 24 24"><path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/></svg>' },
];

function buildPointsMenuHtml(totalPoints) {
  const tiles = POINTS_MENU_TABS.map(t => `
      <div class="points-tile ${t.cls}" data-tab="${t.tab}">${t.icon}<span>${t.label}</span></div>`).join('');
  return `
    <div class="points-menu">
      <button class="points-trigger" id="points-trigger" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="points-lbl">Tus puntos</span>
        <span class="points-row">
          <span class="points-star">⭐</span>
          <span class="points-num">${totalPoints}</span>
          <span class="points-chev"><svg viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></span>
        </span>
      </button>
      <div class="points-dropdown" id="points-dropdown" hidden>
        <div class="points-grid">
          ${tiles}
        </div>
      </div>
    </div>`;
}

function test_mapping_correcto() {
  const esperado = [
    ['pronosticos', 'Pronósticos', 'tile-pronosticos'],
    ['plantilla', 'Plantilla', 'tile-plantilla'],
    ['clasificacion', 'Clasificación', 'tile-clasificacion'],
    ['final-predictions', 'Eliminatorias', 'tile-eliminatorias'],
  ];
  assert.strictEqual(POINTS_MENU_TABS.length, 4, '4 pestañas');
  POINTS_MENU_TABS.forEach((t, i) => {
    const [tab, label, cls] = esperado[i];
    assert.strictEqual(t.tab, tab, `tab ${i}`);
    assert.strictEqual(t.label, label, `label ${i}`);
    assert.strictEqual(t.cls, cls, `cls ${i}`);
  });
}

function test_html_incluye_puntos_y_estrella() {
  const html = buildPointsMenuHtml(123);
  assert.ok(html.includes('⭐'), 'estrella');
  assert.ok(html.includes('>123<'), 'número de puntos');
  assert.ok(html.includes('Tus puntos'), 'etiqueta');
}

function test_html_estado_inicial_cerrado() {
  const html = buildPointsMenuHtml(0);
  assert.ok(html.includes('aria-expanded="false"'), 'aria-expanded cerrado');
  assert.ok(html.includes('hidden'), 'dropdown oculto');
  assert.ok(html.includes('points-dropdown'), 'clase dropdown');
}

function test_html_celdas_con_data_tab() {
  const html = buildPointsMenuHtml(0);
  for (const t of POINTS_MENU_TABS) {
    assert.ok(html.includes(`data-tab="${t.tab}"`), `data-tab ${t.tab}`);
    assert.ok(html.includes(`<span>${t.label}</span>`), `label ${t.label}`);
    assert.ok(html.includes(t.cls), `clase ${t.cls}`);
  }
}

function test_html_chevron() {
  assert.ok(buildPointsMenuHtml(0).includes('M19 9l-7 7-7-7'), 'chevron abajo');
}

const tests = [
  test_mapping_correcto,
  test_html_incluye_puntos_y_estrella,
  test_html_estado_inicial_cerrado,
  test_html_celdas_con_data_tab,
  test_html_chevron,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify the contract**

> **Nota sobre el patrón TDD del repo:** los tests del repo se auto-contienen (re-declaran las funciones puras porque `js/main.js` es un script de navegador, no un módulo importable). Por tanto el test **pasa** desde el primer momento, incluso antes de tocar `js/main.js` — no hay fase RED clásica. La fase RED se aplica de forma adaptada: el test fija el **contrato exacto** que `js/main.js` debe reproducir **verbatim** en el Step 3; si el Step 3 se salta o se desvía, el siguiente test de regresión lo detecta.

Run: `node tests/menuTusPuntos.test.js`
Expected: PASS — `5 passing, 0 failing` (el test está autocontenido). Esto valida el contrato HTML antes de implementarlo en `js/main.js`.

- [ ] **Step 3: Add `POINTS_MENU_TABS` and `buildPointsMenuHtml` to js/main.js**

Insertar (a nivel superior, antes de `renderInicioTab` en ~line 2914) exactamente las mismas definiciones que en el test (copiar el bloque `const POINTS_MENU_TABS = [...]` y `function buildPointsMenuHtml(totalPoints) {...}`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/menuTusPuntos.test.js`
Expected: PASS — `5 passing, 0 failing`.

- [ ] **Step 5: Commit**

```bash
git add tests/menuTusPuntos.test.js js/main.js
git commit -m "feat: builder del menú 'Tus puntos' (HTML + mapeo de tabs)"
```

---

### Task 2: Suma pura de los 4 componentes de puntos (`computeRealPointsTotal`)

**Files:**
- Modify: `tests/menuTusPuntos.test.js` (añadir función + tests al runner)
- Modify: `js/main.js` (añadir función junto a `buildPointsMenuHtml`)

**Interfaces:**
- Consumes: nada (función pura).
- Produces: `function computeRealPointsTotal(components) → number` donde `components = { prediction, squad, classification, eliminatorias }`; cada campo opcional con fallback 0.

- [ ] **Step 1: Write the failing test**

Añadir a `tests/menuTusPuntos.test.js` (antes del array `tests`) la función re-declarada:

```js
function computeRealPointsTotal(components) {
  return (components.prediction || 0)
    + (components.squad || 0)
    + (components.classification || 0)
    + (components.eliminatorias || 0);
}

function test_suma_completa() {
  assert.strictEqual(
    computeRealPointsTotal({ prediction: 145, squad: 181, classification: 60, eliminatorias: 12 }),
    398, 'suma de los 4 componentes'
  );
}

function test_suma_fallbacks_a_cero() {
  assert.strictEqual(computeRealPointsTotal({}), 0, 'sin componentes');
  assert.strictEqual(computeRealPointsTotal({ prediction: 10 }), 10, 'solo prediction');
  assert.strictEqual(computeRealPointsTotal({ prediction: 1, squad: 2, classification: 3 }), 6, 'sin eliminatorias');
}

function test_suma_ignora_null() {
  assert.strictEqual(computeRealPointsTotal({ prediction: 5, squad: null, classification: undefined, eliminatorias: 0 }), 5);
}
```

Y añadir al runner `const tests = [ ... ]` las tres funciones nuevas (al final de la lista).

- [ ] **Step 2: Run test to verify the contract**

> Mismo patrón autocontenido que en la Task 1: el test pasa sin tocar `js/main.js`. Valida la suma antes de implementarla.

Run: `node tests/menuTusPuntos.test.js`
Expected: PASS — `8 passing, 0 failing`.

- [ ] **Step 3: Add `computeRealPointsTotal` to js/main.js**

Junto a `buildPointsMenuHtml`:

```js
function computeRealPointsTotal(components) {
  return (components.prediction || 0)
    + (components.squad || 0)
    + (components.classification || 0)
    + (components.eliminatorias || 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/menuTusPuntos.test.js`
Expected: PASS — `8 passing, 0 failing`.

- [ ] **Step 5: Commit**

```bash
git add tests/menuTusPuntos.test.js js/main.js
git commit -m "feat: suma pura de componentes de puntos reales"
```

---

### Task 3: Estilos CSS + cache-busting

**Files:**
- Modify: `css/styles.css` (añadir bloque al final del fichero)
- Modify: `index.html:19` (bump `css/styles.css?v=58` → `?v=59`)

**Interfaces:**
- Consumes: clases HTML generadas en Task 1 (`points-menu`, `points-trigger`, `points-lbl`, `points-row`, `points-star`, `points-num`, `points-chev`, `points-dropdown`, `points-grid`, `points-tile`, `tile-*`).
- Produces: estilos de la maqueta validada (píldora 2 líneas, parpadeo cian, rejilla 2×2 con iconos de color).

- [ ] **Step 1: Añadir los estilos**

Append al final de `css/styles.css`:

```css
/* ==========================================================================
   MENÚ TUS PUNTOS (Inicio)
   ========================================================================== */
.points-menu { position: relative; align-self: flex-start; }

.points-trigger {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, var(--ucl-card) 0%, var(--ucl-surface) 100%);
  border: 1px solid rgba(6, 182, 212, 0.4);
  padding: 5px 16px 6px;
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--text-primary);
  font-family: var(--font-family);
  animation: attentionPulse 2s ease-in-out infinite;
  transition: transform var(--transition-fast);
}
.points-trigger:active { transform: scale(0.97); }

@keyframes attentionPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.35), 0 0 18px rgba(6, 182, 212, 0.35); transform: scale(1); }
  50%      { box-shadow: 0 0 0 10px rgba(6, 182, 212, 0), 0 0 4px rgba(6, 182, 212, 0.15); transform: scale(0.99); }
}
.points-trigger.open { animation: none; }

.points-lbl {
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1.3px;
  line-height: 1;
  margin-bottom: 3px;
}
.points-row { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 800; }
.points-num { color: var(--accent-cyan); font-weight: 800; }
.points-chev { color: var(--text-secondary); display: inline-flex; }
.points-chev svg { width: 11px; height: 11px; stroke: currentColor; fill: none; stroke-width: 2.4; transition: transform var(--transition-normal); }
.points-trigger.open .points-chev svg { transform: rotate(180deg); }

.points-dropdown {
  margin-top: 8px;
  background: var(--ucl-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px;
  box-shadow: var(--shadow-card);
  animation: pointsPopIn 0.25s ease-out;
}
@keyframes pointsPopIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

.points-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.points-tile {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ucl-surface);
  border-radius: 10px;
  padding: 9px 8px;
  min-height: 44px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background var(--transition-fast);
}
.points-tile:active { background: var(--ucl-card-hover); }
.points-tile svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0; }
.points-tile span { font-size: 0.66rem; font-weight: 700; line-height: 1.1; }

.tile-pronosticos   { color: #10B981; border-left-color: #10B981; }
.tile-plantilla     { color: #8B5CF6; border-left-color: #8B5CF6; }
.tile-clasificacion { color: #06B6D4; border-left-color: #06B6D4; }
.tile-eliminatorias { color: #F59E0B; border-left-color: #F59E0B; }
```

- [ ] **Step 2: Cache-busting CSS**

En `index.html:19`, cambiar:
```html
<link rel="stylesheet" href="css/styles.css?v=58">
```
por:
```html
<link rel="stylesheet" href="css/styles.css?v=59">
```

- [ ] **Step 3: Verificación manual**

Abrir la app en navegador (modo móvil vertical): el botón del menú aparece arriba-izquierda en Inicio parpadeando con halo cian; al abrir, la rejilla 2×2 se ve con los 4 colores. Sin scroll horizontal.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css index.html
git commit -m "feat: estilos del menú 'Tus puntos' + cache-busting css"
```

---

### Task 4: Cálculo de puntos + integración en `renderInicioTab` + comportamiento

**Files:**
- Modify: `js/main.js` (añadir `getUserTotalRealPoints`, `closePointsMenu`, `setupPointsMenu`, `setupPointsMenuGlobals`; modificar `renderInicioTab` ~2915; llamar `setupPointsMenuGlobals()` en el handler `DOMContentLoaded` ~220-224)
- Modify: `index.html:268` (bump `js/main.js?v=79` → `?v=80`)

**Interfaces:**
- Consumes:
  - `buildPointsMenuHtml(totalPoints)` (Task 1)
  - `computeRealPointsTotal(components)` (Task 2)
  - Helpers existentes: `calculateUserTotalPoints(username)` (js/main.js:714) → `{ totalPoints, matchDetails }`; `calculateSquadPoints(squad, matchStats)` (js/main.js:821) → `{ totalPoints, playerDetails }`; `calculateClassificationPoints(username)` (js/main.js:5145) → `{ totalPoints, teamDetails }`; `calculateEliminatoriasPoints(finalPredictions, reachedPhases)` (global, js/eliminatorias.js) → `{ totalPoints, teamDetails }`; `computeReachedPhases(matches, matchStats)` (global, js/eliminatorias.js).
  - `AppState.squadsCache`, `AppState.finalPredictionsCache` (se rellenan en js/main.js:4188, 5645 y js/apiData.js).
  - `navigateToTab(tabName)` (js/main.js:2603).
- Produces: número de puntos del botón = `getUserTotalRealPoints(user.name)`; comportamiento completo del menú.

- [ ] **Step 1: Add `getUserTotalRealPoints`**

Junto a `buildPointsMenuHtml`/`computeRealPointsTotal`:

```js
function getUserTotalRealPoints(username) {
  const userData = calculateUserTotalPoints(username);
  let squadPoints = 0;
  const userSquad = AppState.squadsCache?.[username];
  if (userSquad && userSquad.length) {
    squadPoints = calculateSquadPoints(userSquad, AppState.matchStats).totalPoints;
  }
  let classificationPoints = 0;
  if (AppState.matchStats.length > 0) {
    classificationPoints = calculateClassificationPoints(username).totalPoints;
  }
  let eliminatoriasPoints = 0;
  const userFp = AppState.finalPredictionsCache?.[username];
  if (userFp) {
    eliminatoriasPoints = calculateEliminatoriasPoints(userFp, computeReachedPhases(AppState.matches, AppState.matchStats)).totalPoints;
  }
  return computeRealPointsTotal({
    prediction: userData.totalPoints,
    squad: squadPoints,
    classification: classificationPoints,
    eliminatorias: eliminatoriasPoints,
  });
}
```

- [ ] **Step 2: Add `closePointsMenu`, `setupPointsMenu`, `setupPointsMenuGlobals`**

Junto a `getUserTotalRealPoints`:

```js
function closePointsMenu() {
  const trigger = document.getElementById('points-trigger');
  const dropdown = document.getElementById('points-dropdown');
  if (trigger) { trigger.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
  if (dropdown) dropdown.hidden = true;
}

function setupPointsMenu() {
  const trigger = document.getElementById('points-trigger');
  const dropdown = document.getElementById('points-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', () => {
    if (dropdown.hidden) {
      trigger.classList.add('open');
      dropdown.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    } else {
      closePointsMenu();
    }
  });

  dropdown.querySelectorAll('.points-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const tab = tile.getAttribute('data-tab');
      closePointsMenu();
      navigateToTab(tab);
    });
  });
}

function setupPointsMenuGlobals() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.points-menu')) return;
    const dropdown = document.getElementById('points-dropdown');
    if (dropdown && !dropdown.hidden) closePointsMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const dropdown = document.getElementById('points-dropdown');
      if (dropdown && !dropdown.hidden) closePointsMenu();
    }
  });
}
```

- [ ] **Step 3: Wire en `renderInicioTab`**

En `renderInicioTab` (js/main.js:2915), dentro de la asignación `container.innerHTML = \`...\``, anteponer el menú **antes** de `<div class="inicio-welcome">`:

```js
  container.innerHTML = `
    ${buildPointsMenuHtml(getUserTotalRealPoints(user.name))}

    <div class="inicio-welcome">
      ...
```

Y **al final** de la función (después de la asignación de `innerHTML`), llamar:

```js
  setupPointsMenu();
```

- [ ] **Step 4: Llamar `setupPointsMenuGlobals` una sola vez**

En el handler `DOMContentLoaded` (js/main.js:220-224), añadir la llamada:

```js
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  checkAuthStatus();
  setupNavigation();
  setupPointsMenuGlobals();
});
```

- [ ] **Step 5: Cache-busting JS**

En `index.html:268`, cambiar:
```html
<script src="js/main.js?v=79"></script>
```
por:
```html
<script src="js/main.js?v=80"></script>
```

- [ ] **Step 6: Verificación manual**

1. En Inicio, el botón muestra el **mismo número** que la columna Total de la pestaña Clasificación para el propio usuario (tras cargar datos).
2. Click en el botón → se despliega la rejilla 2×2, la flecha gira 180°, el parpadeo se detiene.
3. Click fuera / `Escape` → se cierra.
4. Cada celda navega a su pestaña: Pronósticos→`pronosticos`, Plantilla→`plantilla`, Clasificación→`clasificacion`, Eliminatorias→`final-predictions` (con su toast si no hay pronósticos confirmados).
5. En pretemporada muestra 0.
6. Consola sin excepciones.
7. No se acumulan listeners globales al navegar entre pestañas (abrir/cerrar varias veces y verificar en consola que no se disparan múltiples cierres).

- [ ] **Step 7: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: integración del menú 'Tus puntos' en Inicio + cache-busting js"
```

---

## Self-Review

- **Spec coverage:** botón 2 líneas con etiqueta (T1 HTML), parpadeo que se detiene al abrir (T3 CSS `.open`), puntos = total real (T2+T4), siempre visible 0 en pretemporada (T4, `computeRealPointsTotal` fallback), rejilla 2×2 con iconos de color (T1+T3), mapeo de las 4 pestañas (T1), navegación con guard de Eliminatorias intacto (T4 reusa `navigateToTab`), cache-busting (T3, T4). Sin huecos.
- **Placeholder scan:** todas las tareas incluyen código completo y comandos; sin TBD/TODO.
- **Type consistency:** `buildPointsMenuHtml(totalPoints)`, `computeRealPointsTotal(components)`, `getUserTotalRealPoints(username)`, `closePointsMenu()`, `setupPointsMenu()`, `setupPointsMenuGlobals()` — mismos nombres y firmas en todas las tareas. `POINTS_MENU_TABS` idéntico en T1 test y T1 código.
