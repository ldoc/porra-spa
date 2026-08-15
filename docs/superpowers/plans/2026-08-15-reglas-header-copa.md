# Header — Copa UCL, botón Ayuda y modal "Reglas de la Porra" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la ⭐ del header por una 🏆, añadir un pill "Ayuda" a la izquierda del pill de perfil, y un modal "Reglas de la Porra" que muestra el contenido de `reglas/UCL.pdf` convertido a HTML estático con chips de navegación y enlace al PDF original.

**Architecture:** SPA Vanilla JS/CSS/HTML estática en Vercel. El contenido de reglas se convierte a un fichero estático `reglas/UCL.html` que el modal carga con `fetch()` (cacheado en `AppState.rulesHtml`). La lógica del modal se añade a `js/main.js` siguiendo los patrones de modales existentes; los estilos a `css/styles.css` reutilizando variables de `:root`.

**Tech Stack:** HTML5, CSS3 Vanilla (variables en `:root`), JavaScript ES6+ Vanilla. Tests en Node con `assert` (patrón de `tests/hoyPartidos.test.js`).

## Global Constraints

- **Cache-busting (AGENTS.md):** al tocar `css/styles.css` o `js/main.js`, incrementar SIEMPRE la versión en `index.html` (`?v=X`).
- **Sin dependencias externas:** nada de PDF.js ni frameworks. Solo HTML/CSS/JS vanilla.
- **Mobile vertical first:** área táctil ≥ 44px; respetar `env(safe-area-inset-*)`; contenedor máx `480px`/`460px` (variable `--max-app-width`).
- **Fuente de verdad:** el contenido de `reglas/UCL.html` transcribe el PDF `reglas/UCL.pdf` de forma fiel (errores tipográficos del PDF se conservan salvo que se indique).
- **CSS:** reutilizar variables de `:root` (`--ucl-card`, `--border-color`, `--accent-*`, `--text-*`, `--radius-*`) antes de valores estáticos.
- **JS:** Vanilla ES6+, sin frameworks; los modales siguen el patrón de `.profile-modal`.

---

### Task 1: Crear `reglas/UCL.html` con el contenido del PDF

**Files:**
- Create: `reglas/UCL.html`
- Test: `tests/reglasContent.test.js`

**Interfaces:**
- Consumes: el contenido textual de `reglas/UCL.pdf` (6 páginas).
- Produces: `reglas/UCL.html` — fragmento HTML con 4 secciones con `id` (`#fase-liga`, `#fase-final`, `#puntuacion`, `#plantilla`) que Task 4 inyecta en `#rules-body`.

- [ ] **Step 1: Write the failing test**

Create `tests/reglasContent.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../reglas/UCL.html'), 'utf8');

function test_tiene_las_4_secciones() {
  for (const id of ['fase-liga', 'fase-final', 'puntuacion', 'plantilla']) {
    assert.ok(html.includes(`id="${id}"`), `falta la sección #${id}`);
  }
}

function test_contenido_clave() {
  const markers = ['FASE DE LIGA', '36 equipos', 'JORNADA 1', 'PLAY-OFF', 'OCTAVOS DE FINAL',
    'CUARTOS DE FINAL', 'SEMIFINALES', '15 puntos', '60 puntos', '575 puntos',
    '25 jugadores', 'SOFASCORE', 'portera a cero'];
  for (const m of markers) {
    assert.ok(html.toLowerCase().includes(m.toLowerCase()), `falta el contenido: "${m}"`);
  }
}

// runner
const tests = [
  ['4 secciones con id', test_tiene_las_4_secciones],
  ['contenido clave del PDF', test_contenido_clave],
];
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/reglasContent.test.js`
Expected: FAIL — `ENOENT: no such file or directory ... reglas/UCL.html`

- [ ] **Step 3: Create `reglas/UCL.html`**

Create the file with the complete content below (fragment, sin `<html>` — se inyecta en el modal). Fiel al PDF.

```html
<section id="fase-liga" class="rules-section">
  <div class="rules-section-head rules-head-liga">⚽ FASE DE LIGA</div>
  <p>El Torneo Champions League 2026-2027 se estructura en dos fases: una <strong>FASE DE LIGA</strong> inicial con 36 equipos, y una <strong>FASE FINAL</strong> eliminatoria con 24 equipos.</p>
  <p>En la FASE DE LIGA participan 36 equipos que compiten en una tabla de clasificación única. Cada equipo juega <strong>8 partidos</strong> contra 8 rivales diferentes (4 como local y 4 como visitante). Los enfrentamientos se definirán por sorteo, dividiendo a los 36 equipos en <strong>4 bombos con 9 equipos</strong> cada uno, asignados en función del coeficiente UEFA. El sorteo se celebrará el <strong>27 de agosto de 2026</strong>.</p>
  <p class="rules-sub">Los partidos se disputan a lo largo de 8 jornadas:</p>
  <ul class="rules-list">
    <li>JORNADA 1 · Del 8 al 10 de septiembre de 2026</li>
    <li>JORNADA 2 · Del 13 al 14 de octubre de 2026</li>
    <li>JORNADA 3 · Del 20 al 21 de octubre de 2026</li>
    <li>JORNADA 4 · Del 3 al 4 de noviembre de 2026</li>
    <li>JORNADA 5 · Del 24 al 25 de noviembre de 2026</li>
    <li>JORNADA 6 · Del 8 al 9 de diciembre de 2026</li>
    <li>JORNADA 7 · Del 19 al 20 de enero de 2027</li>
    <li>JORNADA 8 · El 27 de enero de 2027 (jornada única)</li>
  </ul>
  <p>Se obtienen <strong>3 puntos por victoria</strong>, <strong>1 punto por empate</strong> y <strong>0 por derrota</strong>.</p>
  <p class="rules-sub"><strong>Criterios de desempate</strong> (en orden):</p>
  <ol class="rules-list">
    <li>Mayor diferencia de goles</li>
    <li>Mayor número de goles marcados</li>
    <li>Mayor número de goles marcados como visitante</li>
    <li>Mayor número de victorias</li>
    <li>Mayor número de victorias como visitante</li>
    <li>Mayor suma de puntos obtenidos por todos los rivales de la FASE DE LIGA</li>
    <li>Mayor suma de diferencia de goles obtenida por todos los rivales de la FASE DE LIGA</li>
    <li>Mayor suma de goles marcados por todos los rivales de la FASE DE LIGA</li>
    <li>Menor número de puntos disciplinarios (tarjeta amarilla = 1, tarjeta roja = 3, expulsión por doble amarilla = 3)</li>
    <li>Mayor coeficiente de club</li>
  </ol>
</section>

<section id="fase-final" class="rules-section">
  <div class="rules-section-head rules-head-final">🏆 FASE FINAL</div>
  <p>Tras la FASE DE LIGA, la <strong>FASE FINAL</strong> dará acceso a los <strong>24 equipos</strong> con mayor puntuación. Los equipos que finalicen entre el puesto 9 y el 24 jugarán una ronda de <strong>PLAY-OFF</strong>; los del puesto 1 al 8 pasan directamente a <strong>OCTAVOS DE FINAL</strong>.</p>
  <p class="rules-sub"><strong>PLAY-OFF</strong> (eliminatoria a doble partido, sorteo el 29 de enero de 2027):</p>
  <ul class="rules-list">
    <li>Puesto 9/10 contra Puesto 23/24</li>
    <li>Puesto 11/12 contra Puesto 21/22</li>
    <li>Puesto 13/14 contra Puesto 19/20</li>
    <li>Puesto 15/16 contra Puesto 17/18</li>
    <li>Fechas: 16 y 17 de febrero de 2027 (IDA) · 23 y 24 de febrero de 2027 (VUELTA)</li>
  </ul>
  <p class="rules-sub"><strong>OCTAVOS DE FINAL</strong> (8 enfrentamientos a doble partido):</p>
  <ul class="rules-list">
    <li>9 y 10 de marzo de 2027 (IDA) · 16 y 17 de marzo de 2027 (VUELTA)</li>
  </ul>
  <p class="rules-sub"><strong>CUARTOS DE FINAL</strong> (4 enfrentamientos a doble partido):</p>
  <ul class="rules-list">
    <li>6 y 7 de abril de 2027 (IDA) · 13 y 14 de abril de 2027 (VUELTA)</li>
  </ul>
  <p class="rules-sub"><strong>SEMIFINALES</strong> (2 enfrentamientos a doble partido):</p>
  <ul class="rules-list">
    <li>27 y 28 de abril de 2027 (IDA) · 4 y 5 de mayo de 2027 (VUELTA)</li>
  </ul>
  <p class="rules-sub"><strong>FINAL</strong> (partido único):</p>
  <ul class="rules-list">
    <li>5 de junio de 2027. El ganador se proclamará CAMPEÓN de la UEFA Champions League 2026-2027.</li>
  </ul>
</section>

<section id="puntuacion" class="rules-section">
  <div class="rules-section-head rules-head-puntos">⭐ PUNTUACIÓN</div>
  <p>Una vez iniciada la competición, los participantes reciben puntos en cada partido disputado.</p>
  <p class="rules-sub"><strong>Puntuación por pronóstico de partido</strong>:</p>
  <table class="rules-table">
    <tr><td>Acierto de resultado (victoria local, empate o victoria visitante)</td><td class="rules-pts">8</td></tr>
    <tr><td>Acierto del número de goles del equipo local</td><td class="rules-pts">8</td></tr>
    <tr><td>Acierto del número de goles del equipo visitante</td><td class="rules-pts">8</td></tr>
    <tr><td>Acierto del número de goles de ambos equipos</td><td class="rules-pts">1</td></tr>
  </table>
  <p>La puntuación máxima por partido será de <strong>15 puntos</strong>.</p>
  <p class="rules-sub"><strong>Puntuación por pronóstico de clasificación</strong>:</p>
  <p>Solo obtendrán puntos los equipos que finalicen en una posición igual o superior al puesto 24:</p>
  <table class="rules-table">
    <tr><td>Puesto 1 (60)</td><td>Puesto 2 (51)</td><td>Puesto 3 (43)</td></tr>
    <tr><td>Puesto 4 (36)</td><td>Puesto 5 (30)</td><td>Puesto 6 (25)</td></tr>
    <tr><td>Puesto 7 (21)</td><td>Puesto 8 (18)</td><td>Puesto 9 (16)</td></tr>
    <tr><td>Puesto 10 (15)</td><td>Puesto 11 (14)</td><td>Puesto 12 (13)</td></tr>
    <tr><td>Puesto 13 (12)</td><td>Puesto 14 (11)</td><td>Puesto 15 (10)</td></tr>
    <tr><td>Puesto 16 (9)</td><td>Puesto 17 (8)</td><td>Puesto 18 (7)</td></tr>
    <tr><td>Puesto 19 (6)</td><td>Puesto 20 (5)</td><td>Puesto 21 (4)</td></tr>
    <tr><td>Puesto 22 (3)</td><td>Puesto 23 (2)</td><td>Puesto 24 (1)</td></tr>
  </table>
  <p>Solo se recibirán los puntos por el <strong>valor más bajo</strong> de posición entre la pronosticada y la real. Ejemplo: si se pronostica el puesto 7 y acaba 3, se reciben 21 puntos; si acaba 12, se reciben 13.</p>
  <p class="rules-sub"><strong>Pronóstico de equipos en la FASE FINAL</strong>:</p>
  <p>En el menú FASE FINAL (dentro de Pronósticos) se asignan los 24 equipos mejor clasificados según el pronóstico a cada ronda. Los equipos de los 8 primeros puestos <strong>no pueden</strong> incluirse en PLAY-OFF (acceden directos a OCTAVOS).</p>
  <table class="rules-table">
    <tr><td>Alcanzar PLAY-OFF</td><td class="rules-pts">10</td></tr>
    <tr><td>Alcanzar OCTAVOS DE FINAL</td><td class="rules-pts">15</td></tr>
    <tr><td>Alcanzar CUARTOS DE FINAL</td><td class="rules-pts">25</td></tr>
    <tr><td>Alcanzar SEMIFINALES</td><td class="rules-pts">50</td></tr>
    <tr><td>SUBCAMPEÓN</td><td class="rules-pts">75</td></tr>
    <tr><td>CAMPEÓN</td><td class="rules-pts">100</td></tr>
  </table>
  <p>Se reciben puntos solo por la <strong>máxima fase alcanzada</strong>. Si el equipo alcanza una fase superior a la pronosticada, se reciben como máximo los puntos de la fase pronosticada; si alcanza una inferior, los de la fase alcanzada. La puntuación máxima por este concepto es de <strong>575 puntos</strong>.</p>
</section>

<section id="plantilla" class="rules-section">
  <div class="rules-section-head rules-head-plantilla">👥 PLANTILLA IDEAL</div>
  <p>Cada participante elabora una plantilla de <strong>25 jugadores</strong>: <strong>3 porteros</strong>, <strong>8 defensas</strong>, <strong>8 centrocampistas</strong> y <strong>6 delanteros</strong>. No puede haber más de un jugador del mismo club.</p>
  <p class="rules-sub"><strong>Puntuación Sofascore</strong>:</p>
  <p>6 puntos Sofascore equivalen a 0. Por encima de 6, se obtiene 1 punto por cada 0,3 puntos Sofascore (máximo 13). Por debajo de 6, puntuación negativa: hasta 5,7 → −1; por cada 0,3 menos, −1 adicional.</p>
  <p class="rules-sub"><strong>Puntuación por goles marcados</strong>:</p>
  <table class="rules-table">
    <tr><td>Delantero</td><td class="rules-pts">+1</td></tr>
    <tr><td>Centrocampista</td><td class="rules-pts">+2</td></tr>
    <tr><td>Defensa</td><td class="rules-pts">+3</td></tr>
    <tr><td>Portero</td><td class="rules-pts">+4</td></tr>
  </table>
  <p>Cada gol suma 1 punto adicional. Si el gol es de penalti, no se aplica la bonificación por demarcación.</p>
  <p class="rules-sub"><strong>Porteros</strong>:</p>
  <ul class="rules-list">
    <li>−1 punto por cada gol recibido</li>
    <li>+3 puntos por penalti parado</li>
  </ul>
  <p class="rules-sub"><strong>Portería a cero</strong> (si al finalizar el tiempo reglamentario el equipo no ha recibido goles):</p>
  <ul class="rules-list">
    <li>Portero: +5 puntos</li>
    <li>Defensas: +2 puntos</li>
    <li>Siempre que hayan jugado más de 70 minutos</li>
  </ul>
  <p>Los jugadores reciben puntos tanto en la FASE DE LIGA como en la FASE FINAL. En la FASE FINAL, una vez conocidos los emparejamientos, se abren de nuevo los pronósticos con el mismo sistema de puntuación, sumándose al total acumulado.</p>
</section>
```

> Nota: el PDF dice "8 puntos adicionales" por goles local/visitante (página 3), pero también fija el máximo en 15 y las reglas de la app (AGENTS.md) usan 3+3+1. Se transcribe el PDF tal cual; si se desea corregir a 3+3+1, avisar antes de implementar.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/reglasContent.test.js`
Expected: PASS — las 2 pruebas `ok`.

- [ ] **Step 5: Commit**

```bash
git add reglas/UCL.html tests/reglasContent.test.js
git commit -m "feat: contenido de reglas UCL en HTML estático (reglas/UCL.html)"
```

---

### Task 2: Header y estructura del modal en `index.html`

**Files:**
- Modify: `index.html` (header líneas 100-112; añadir modal junto a `#phase-change-modal` línea 236-263)

**Interfaces:**
- Consumes: nada de Task 1.
- Produces: `#user-help-pill`, `#rules-modal` con `#rules-body` y chips con `data-target` (Task 3 registra listeners; Task 4 los estiliza).

- [ ] **Step 1: Write the failing test**

Add to `tests/reglasContent.test.js` (o crea `tests/indexHeader.test.js`). Añade al fichero del test:

```js
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function test_header_tiene_copa_y_pill_ayuda() {
  assert.ok(indexHtml.includes('🏆'), 'brand-icon debería ser 🏆');
  assert.ok(indexHtml.includes('id="user-help-pill"'), 'falta el pill de ayuda');
  assert.ok(indexHtml.includes('user-help-pill'), 'falta la clase user-help-pill');
}

function test_modal_reglas_presente() {
  assert.ok(indexHtml.includes('id="rules-modal"'), 'falta el modal de reglas');
  assert.ok(indexHtml.includes('id="rules-body"'), 'falta el contenedor rules-body');
  assert.ok(indexHtml.includes('openRulesModal()'), 'falta el handler openRulesModal');
  assert.ok(indexHtml.includes('closeRulesModal()'), 'falta el handler closeRulesModal');
  assert.ok(indexHtml.includes('reglas/UCL.pdf'), 'falta el enlace al PDF original');
}

function test_chips_matched_a_secciones() {
  const chipTargets = [...indexHtml.matchAll(/data-target="(#fase-liga|#fase-final|#puntuacion|#plantilla)"/g)].map(m => m[1]);
  assert.strictEqual(chipTargets.length, 4, 'debe haber 4 chips');
  for (const t of chipTargets) {
    assert.ok(html.includes(`id="${t.slice(1)}"`), `el chip ${t} no tiene sección en UCL.html`);
  }
}
```

Y registra los tres (`test_header_tiene_copa_y_pill_ayuda`, `test_modal_reglas_presente`, `test_chips_matched_a_secciones`) en el array `tests` del runner.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/reglasContent.test.js`
Expected: FAIL — las nuevas pruebas fallan (`brand-icon debería ser 🏆`).

- [ ] **Step 3: Cambiar el icono del logo**

En `index.html` línea 102, cambiar `⭐` por `🏆`:

```html
<div class="brand-icon">🏆</div>
```

- [ ] **Step 4: Añadir el pill de ayuda**

En el header (`index.html` líneas 108-111), añadir el pill de ayuda **antes** de `#user-status-pill`:

```html
<div id="user-help-pill" class="user-help-pill" style="display: none;" onclick="openRulesModal()">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
  <span>Ayuda</span>
</div>
```

- [ ] **Step 5: Añadir el modal de reglas**

Junto a `#phase-change-modal` (antes de los `<script>`), añadir:

```html
<div id="rules-modal" class="rules-modal" style="display: none;">
  <div class="rules-overlay" onclick="closeRulesModal()"></div>
  <div class="rules-modal-content">
    <div class="rules-header">
      <div class="rules-title">
        <span class="rules-title-icon">🏆</span>
        <div>
          <div class="rules-title-main">Reglas de la Porra</div>
          <div class="rules-subtitle">Champions 2026/27</div>
        </div>
      </div>
      <button class="rules-close" onclick="closeRulesModal()">&times;</button>
    </div>
    <div class="rules-chips">
      <button class="rules-chip active" data-target="#fase-liga">⚽ Fase de Liga</button>
      <button class="rules-chip" data-target="#fase-final">🏆 Fase Final</button>
      <button class="rules-chip" data-target="#puntuacion">⭐ Puntuación</button>
      <button class="rules-chip" data-target="#plantilla">👥 Plantilla</button>
    </div>
    <div class="rules-body" id="rules-body">
      <div class="rules-loading">Cargando reglas…</div>
    </div>
    <div class="rules-footer">
      <button class="rules-pdf-btn" onclick="window.open('reglas/UCL.pdf', '_blank')">Abrir PDF original</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node tests/reglasContent.test.js`
Expected: PASS — todas las pruebas `ok` (incluidas las nuevas).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/reglasContent.test.js
git commit -m "feat: header con copa y pill Ayuda + estructura del modal de reglas"
```

---

### Task 3: Lógica del modal en `js/main.js`

**Files:**
- Modify: `js/main.js` — `AppState` (añadir `rulesHtml` cerca de línea 53), `updateUserHeader()` (línea 3663), y nuevo bloque "HEADER — Ayuda / Modal Reglas" junto a `setupHeaderClick()` (línea 3466).

**Interfaces:**
- Consumes: `#user-help-pill`, `#rules-modal`, `#rules-body`, chips con `data-target` (Task 2).
- Produces: funciones globales `openRulesModal()`, `closeRulesModal()`, `setupRulesChips()`, `setupHelpClick()`; campo `AppState.rulesHtml`. Task 4 estiliza los elementos que estas funciones manipulan.

- [ ] **Step 1: Syntax check antes de empezar**

Run: `node --check js/main.js`
Expected: sin salida (OK).

- [ ] **Step 2: Añadir campo de caché a AppState**

En `js/main.js`, dentro del objeto `AppState` (tras `fases: [],` línea 53):

```js
  rulesHtml: null,         // caché del HTML de reglas cargado de reglas/UCL.html
```

- [ ] **Step 3: Añadir las funciones de ayuda y modal**

Inmediatamente después de `setupHeaderClick()` (que termina en la línea 3473), añadir:

```js
// ============================================================
// HEADER — Ayuda y Modal de Reglas de la Porra
// ============================================================
function setupHelpClick() {
  const pill = document.getElementById('user-help-pill');
  if (pill) {
    pill.addEventListener('click', () => openRulesModal());
  }
}

async function openRulesModal() {
  const modal = document.getElementById('rules-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const body = document.getElementById('rules-body');
  if (!body) return;

  if (AppState.rulesHtml) {
    body.innerHTML = AppState.rulesHtml;
    setupRulesChips();
    return;
  }

  body.innerHTML = '<div class="rules-loading">Cargando reglas…</div>';
  try {
    const res = await fetch('reglas/UCL.html');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    AppState.rulesHtml = await res.text();
    body.innerHTML = AppState.rulesHtml;
  } catch (e) {
    console.error('Error cargando reglas:', e);
    body.innerHTML = '<div class="rules-error">No se pudieron cargar las reglas. ' +
      '<a href="reglas/UCL.pdf" target="_blank" rel="noopener">Abrir PDF original</a></div>';
  }
  setupRulesChips();
}

function closeRulesModal() {
  const modal = document.getElementById('rules-modal');
  if (modal) modal.style.display = 'none';
}

function setupRulesChips() {
  const chips = document.querySelectorAll('#rules-modal .rules-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const target = document.querySelector(chip.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
```

- [ ] **Step 4: Mostrar/ocultar el pill junto al de perfil**

En `updateUserHeader()` (`js/main.js:3663`), mostrar el pill de ayuda con el mismo criterio que el de perfil:

```js
function updateUserHeader() {
  const pill = document.getElementById('user-status-pill');
  const helpPill = document.getElementById('user-help-pill');
  const avatar = document.getElementById('user-header-avatar');
  const name = document.getElementById('user-header-name');

  if (AppState.currentUser) {
    if (avatar) avatar.textContent = AppState.currentUser.avatar;
    if (name) name.textContent = AppState.currentUser.name;
    if (pill) pill.style.display = 'flex';
    if (helpPill) helpPill.style.display = 'flex';
  } else {
    if (pill) pill.style.display = 'none';
    if (helpPill) helpPill.style.display = 'none';
  }
}
```

- [ ] **Step 5: Registrar el listener de ayuda en el arranque**

En `enterApp()` (junto a `setupHeaderClick();` línea 2230):

```js
  setupHeaderClick();
  setupHelpClick();
```

- [ ] **Step 6: Syntax check tras los cambios**

Run: `node --check js/main.js`
Expected: sin salida (OK).

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: lógica del modal Reglas de la Porra (openRulesModal, chips, fetch de reglas/UCL.html)"
```

---

### Task 4: Estilos de `css/styles.css`

**Files:**
- Modify: `css/styles.css` (añadir bloque tras el header, junto a `.user-status-pill` ~línea 170, y bloque de modal al final del archivo)

**Interfaces:**
- Consumes: clases usadas en Tasks 2 y 3 (`.user-help-pill`, `.rules-modal`, `.rules-overlay`, `.rules-modal-content`, `.rules-header`, `.rules-title`, `.rules-title-icon`, `.rules-title-main`, `.rules-subtitle`, `.rules-close`, `.rules-chips`, `.rules-chip`, `.rules-body`, `.rules-loading`, `.rules-error`, `.rules-footer`, `.rules-pdf-btn`) y las clases de `reglas/UCL.html` (`.rules-section`, `.rules-section-head`, `.rules-head-liga/final/puntos/plantilla`, `.rules-sub`, `.rules-list`, `.rules-table`, `.rules-pts`).

- [ ] **Step 1: Escribir el test de presencia de clases**

Add to `tests/reglasContent.test.js`:

```js
const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
const NEEDED_CSS = [
  '.user-help-pill', '.rules-modal', '.rules-overlay', '.rules-modal-content',
  '.rules-header', '.rules-title', '.rules-close', '.rules-chips', '.rules-chip',
  '.rules-body', '.rules-loading', '.rules-error', '.rules-footer', '.rules-pdf-btn',
  '.rules-section', '.rules-section-head', '.rules-table', '.rules-pts',
];

function test_estilos_definidos() {
  for (const cls of NEEDED_CSS) {
    assert.ok(css.includes(cls), `falta la clase CSS ${cls}`);
  }
}
```

Y registra en el array `tests` del runner.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/reglasContent.test.js`
Expected: FAIL — `falta la clase CSS .user-help-pill`.

- [ ] **Step 3: Añadir el estilo del pill de ayuda**

Junto a `.user-status-pill` (tras la línea 170 de `styles.css`):

```css
.user-help-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--ucl-card);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  cursor: pointer;
  color: var(--accent-cyan);
  font-size: var(--font-size-xs);
  font-weight: 700;
  line-height: 1;
}
.user-help-pill svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.user-help-pill:active {
  background: var(--ucl-card-hover);
}
```

- [ ] **Step 4: Añadir los estilos del modal de reglas**

Al final de `styles.css`:

```css
/* ==========================================================================
   MODAL — REGLAS DE LA PORRA
   ========================================================================== */
.rules-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  animation: fadeIn 0.2s ease;
}

.rules-modal-content {
  position: relative;
  width: 92%;
  max-width: 440px;
  max-height: min(86dvh, 720px);
  background: var(--ucl-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.rules-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rules-title-icon { font-size: 1.5rem; }
.rules-title-main {
  font-weight: 800;
  font-size: 1.05rem;
  color: var(--text-primary);
}
.rules-subtitle {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-purple);
}

.rules-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--text-muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.rules-close:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--text-primary);
}

.rules-chips {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}
.rules-chips::-webkit-scrollbar { display: none; }

.rules-chip {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
  font-weight: 800;
  padding: 7px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 34px;
}
.rules-chip.active {
  background: rgba(139, 92, 246, 0.25);
  color: #c4b5fd;
  border-color: rgba(139, 92, 246, 0.5);
}
.rules-chip:active { opacity: 0.8; }

.rules-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}
.rules-body::-webkit-scrollbar { width: 4px; }
.rules-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }

.rules-loading,
.rules-error {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: 24px 8px;
}
.rules-error a {
  color: var(--accent-cyan);
  font-weight: 700;
}

.rules-section { margin-bottom: 22px; }
.rules-section:last-child { margin-bottom: 0; }
.rules-section p { color: var(--text-secondary); font-size: var(--font-size-sm); line-height: 1.55; margin: 8px 0; }
.rules-section p strong { color: var(--text-primary); }
.rules-section .rules-sub { margin-top: 12px; color: var(--text-primary); }

.rules-section-head {
  font-weight: 800;
  font-size: var(--font-size-sm);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}
.rules-head-liga { background: rgba(139, 92, 246, 0.14); color: #c4b5fd; border-left: 3px solid var(--accent-purple); }
.rules-head-final { background: rgba(6, 182, 212, 0.12); color: #67e8f9; border-left: 3px solid var(--accent-cyan); }
.rules-head-puntos { background: rgba(245, 158, 11, 0.12); color: #fcd34d; border-left: 3px solid var(--accent-gold); }
.rules-head-plantilla { background: rgba(16, 185, 129, 0.12); color: #6ee7b7; border-left: 3px solid var(--accent-primary); }

.rules-list {
  margin: 8px 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}
.rules-list li { margin-bottom: 3px; }

.rules-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 8px 0;
}
.rules-table td {
  padding: 8px 10px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}
.rules-table tr:last-child td { border-bottom: none; }
.rules-table .rules-pts {
  color: var(--accent-primary);
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
}

.rules-footer {
  display: flex;
  justify-content: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.rules-pdf-btn {
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.4);
  color: #c4b5fd;
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  font-weight: 700;
  padding: 9px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  min-height: 44px;
  transition: all var(--transition-fast);
}
.rules-pdf-btn:active { background: rgba(139, 92, 246, 0.32); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/reglasContent.test.js`
Expected: PASS — todas las pruebas `ok`.

- [ ] **Step 6: Commit**

```bash
git add css/styles.css tests/reglasContent.test.js
git commit -m "style: estilos del pill Ayuda y del modal Reglas de la Porra"
```

---

### Task 5: Cache-busting, limpieza y verificación final

**Files:**
- Modify: `index.html` (versiones de `css/styles.css` y `js/main.js`)
- Delete: `reglas/UCL.pdf:Zone.Identifier`

**Interfaces:**
- Consumes: todos los cambios de Tasks 1-4.

- [ ] **Step 1: Subir versiones de cache en `index.html`**

Incrementar `?v=` en:
- `<link rel="stylesheet" href="css/styles.css?v=66">` → `?v=67`
- `<script src="js/main.js?v=102"></script>` → `?v=103`

(Ver los valores actuales en el fichero; subir cada uno en +1.)

- [ ] **Step 2: Eliminar el artefacto de Windows**

```bash
rm -f "reglas/UCL.pdf:Zone.Identifier"
```

- [ ] **Step 3: Ejecutar todos los tests**

Run: `node tests/reglasContent.test.js` y `node tests/hoyPartidos.test.js` (y el resto de `tests/*.test.js`)
Expected: todos PASS. Confirmar que no se rompió nada:

```bash
for f in tests/*.test.js; do node "$f" >/dev/null 2>&1 || echo "FALLA: $f"; done
```

- [ ] **Step 4: Syntax check de main.js**

Run: `node --check js/main.js`
Expected: sin salida (OK).

- [ ] **Step 5: Verificación manual (servidor local)**

Levantar el servidor de desarrollo y comprobar en navegador:
1. `npm run dev` o `node server.mjs` según `README.md` (usa el workdir del repo).
2. Con sesión iniciada: header muestra 🏆 y el pill "Ayuda" a la izquierda del perfil.
3. Pulsar "Ayuda" → se abre el modal con las 4 secciones y sus chips.
4. Los chips saltan a cada sección y marcan el activo.
5. "Abrir PDF original" abre `reglas/UCL.pdf` en pestaña nueva.
6. Cerrar con ✕ y con clic fuera del modal.
7. Sin sesión: el pill de ayuda no aparece.
8. Móvil vertical (view <= 480px): modal no desborda, scroll interno funciona, `--max-app-width` respetado.

- [ ] **Step 6: Commit**

```bash
git add index.html
git rm --cached "reglas/UCL.pdf:Zone.Identifier" 2>/dev/null; rm -f "reglas/UCL.pdf:Zone.Identifier"
git add -A reglas/ 2>/dev/null || true
git commit -m "chore: cache-busting (styles/main) y limpieza de Zone.Identifier"
```

> Nota: si `reglas/` aún no estaba en git (estado `??`), `git add -A reglas/` sube el PDF y el HTML. El `.gitignore` no excluye `reglas/` (comprobado).

---

## Self-Review

- **Cobertura de la spec:** 
  - Spec §1 (icono ⭐→🏆) → Task 2 Step 3. ✓
  - Spec §2 (pill Ayuda a la izquierda, estilo perfil, solo con sesión) → Task 2 Step 4, Task 3 Step 4, Task 4 Step 3. ✓
  - Spec §3 (`reglas/UCL.html` con 4 secciones) → Task 1. ✓
  - Spec §4 (modal con chips, cabecera, footer "Abrir PDF original", cierre) → Task 2 Step 5, Task 3, Task 4. ✓
  - Spec §5 (funciones JS) → Task 3. ✓
  - Spec §6 (estilos) → Task 4. ✓
  - Spec §7 (cache-busting) → Task 5. ✓
  - Spec §8 (borrar `Zone.Identifier`) → Task 5 Step 2. ✓
- **Placeholders:** ninguno; todos los pasos de código tienen contenido literal.
- **Consistencia de tipos:** las clases de `UCL.html` (`.rules-section`, `.rules-table`, `.rules-pts`, `.rules-section-head`, `.rules-head-*`) coinciden con las que define CSS en Task 4; los `data-target` del modal coinciden con los `id` de las secciones; las funciones `openRulesModal`/`closeRulesModal`/`setupRulesChips`/`setupHelpClick` se definen en Task 3 y se usan en Tasks 2 y 5.
