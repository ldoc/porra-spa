# Tabla de desglose de puntos en Clasificación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el desglose de puntos en texto plano de la pestaña Clasificación (post-freeze) por una tabla con cabecera sticky y 5 columnas por usuario (Pronósticos, Plantilla, Clasificación, Eliminatorias, Total), manteniendo badges de podio y el modal de perfil.

**Architecture:** Tres funciones puras nuevas (`getRankBadgeClass`, `buildClasificacionHeader`, `buildClasificacionRow`) se definen en `js/main.js` y se testean con el patrón espejo de `tests/` (funciones copiadas en el fichero de test + asserts con `node`). `renderClasificacionTab` usa esas funciones para renderizar cabecera + filas con CSS Grid de 6 columnas. Cambio 100% frontend estático; no se toca el backend.

**Tech Stack:** HTML5 + CSS3 Vanilla (variables `:root`), JavaScript Vanilla ES6+, tests en Node.js `assert`.

## Global Constraints

- Cache-busting obligatorio (AGENTS.md): al tocar `css/styles.css` o `js/main.js`, incrementar `?v=` en `index.html`. Hoy: `css/styles.css?v=51` (línea 19) y `js/main.js?v=73` (línea 253).
- Orientación vertical (portrait) móvil; contenedor máximo ~480px.
- No usar frameworks CSS/JS (Vanilla).
- Modo pre-freeze de Clasificación NO se modifica (solo nombres, sin puntos).
- Estilos con variables CSS de `:root` (`--ucl-card`, `--border-color`, `--text-secondary`, `--text-muted`, `--accent-primary`).
- Los tests se ejecutan con `node tests/<fichero>.test.js` (patrón espejo: las funciones se copian dentro del test).

---

### Task 1: Test de las funciones puras de la tabla

**Files:**
- Create: `tests/clasificacionTable.test.js`

**Interfaces:**
- Consumes: nada (funciones espejo autocontenidas en el test).
- Produces: contrato que debe implementar `js/main.js` en Task 2:
  - `getRankBadgeClass(rank)` → `string` (`'rank-1'` | `'rank-2'` | `'rank-3'` | `'rank-n'`).
  - `buildClasificacionHeader()` → `string` HTML de la cabecera con clase `clasificacion-header` y 6 `<span>`: `Jugador`, `Pron`, `Plant`, `Clas`, `Elim`, `Total`.
  - `buildClasificacionRow(p, rank, isMe)` → `string` HTML de una fila con clase `clasificacion-row`, identidad (`.clasificacion-id`, `.rank-pill`, `.player-avatar`, `.clasificacion-name`), 4 valores (`.clasificacion-val`) y el total (`.clasificacion-val clasificacion-total`). Acepta `p = { name, avatar, predictionPoints, squadPoints, classificationPoints, eliminatoriasPoints, realPoints }`.

- [ ] **Step 1: Escribir el fichero de test**

Crear `tests/clasificacionTable.test.js`:

```js
const assert = require('assert');

function getRankBadgeClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-n';
}

function buildClasificacionHeader() {
  return `
    <div class="clasificacion-header">
      <span>Jugador</span><span>Pron</span><span>Plant</span><span>Clas</span><span>Elim</span><span>Total</span>
    </div>`;
}

function buildClasificacionRow(p, rank, isMe) {
  return `
    <div class="clasificacion-row ${isMe ? 'current-user' : ''}" onclick="showUserProfileModal('${p.name}')">
      <div class="clasificacion-id">
        <div class="rank-pill ${getRankBadgeClass(rank)}">${rank}</div>
        <span class="player-avatar">${p.avatar}</span>
        <span class="clasificacion-name">${p.name}${isMe ? ' <span class="clasificacion-you">(Tu)</span>' : ''}</span>
      </div>
      <span class="clasificacion-val">${p.predictionPoints}</span>
      <span class="clasificacion-val">${p.squadPoints}</span>
      <span class="clasificacion-val">${p.classificationPoints}</span>
      <span class="clasificacion-val">${p.eliminatoriasPoints}</span>
      <span class="clasificacion-val clasificacion-total">${p.realPoints}</span>
    </div>`;
}

function user(overrides = {}) {
  return Object.assign({
    name: 'juan.antonio_pvz', avatar: '⚽',
    predictionPoints: 145, squadPoints: 181,
    classificationPoints: 60, eliminatoriasPoints: 12, realPoints: 398
  }, overrides);
}

function test_rank_badge_class_podio() {
  assert.strictEqual(getRankBadgeClass(1), 'rank-1');
  assert.strictEqual(getRankBadgeClass(2), 'rank-2');
  assert.strictEqual(getRankBadgeClass(3), 'rank-3');
}

function test_rank_badge_class_resto() {
  assert.strictEqual(getRankBadgeClass(4), 'rank-n');
  assert.strictEqual(getRankBadgeClass(20), 'rank-n');
}

function test_cabecera_etiquetas() {
  const html = buildClasificacionHeader();
  assert.ok(html.includes('clasificacion-header'), 'clase contenedor');
  for (const lbl of ['Jugador', 'Pron', 'Plant', 'Clas', 'Elim', 'Total']) {
    assert.ok(html.includes(`>${lbl}</span>`), `etiqueta ${lbl}`);
  }
}

function test_fila_incluye_identidad_y_valores() {
  const html = buildClasificacionRow(user(), 1, false);
  assert.ok(html.includes('clasificacion-row'), 'clase fila');
  assert.ok(html.includes('juan.antonio_pvz'), 'nombre');
  assert.ok(html.includes('⚽'), 'avatar');
  assert.ok(html.includes('rank-pill rank-1'), 'badge rank 1');
  assert.ok(html.includes('clasificacion-total'), 'clase total');
  for (const val of ['145', '181', '60', '12', '398']) {
    assert.ok(html.includes(`>${val}</span>`), `valor ${val}`);
  }
  assert.ok(!html.includes('current-user'), 'sin resaltado propio');
  assert.ok(!html.includes('(Tu)'), 'sin marcador Tu');
}

function test_fila_usuario_actual() {
  const html = buildClasificacionRow(user(), 2, true);
  assert.ok(html.includes('current-user'), 'resaltado propio');
  assert.ok(html.includes('(Tu)'), 'marcador Tu');
  assert.ok(html.includes('rank-pill rank-2'), 'badge rank 2');
}

function test_fila_ceros_siempre_visibles() {
  const html = buildClasificacionRow(user({ predictionPoints: 0, squadPoints: 0,
    classificationPoints: 0, eliminatoriasPoints: 0, realPoints: 0 }), 4, false);
  assert.ok(html.includes('>0</span>'), 'ceros presentes');
  assert.ok(html.includes('rank-pill rank-n'), 'badge gris para rank > 3');
}

const tests = [
  test_rank_badge_class_podio,
  test_rank_badge_class_resto,
  test_cabecera_etiquetas,
  test_fila_incluye_identidad_y_valores,
  test_fila_usuario_actual,
  test_fila_ceros_siempre_visibles
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test**

Run: `node tests/clasificacionTable.test.js` (en `porra-spa`)
Expected: `6 passing, 0 failing` (las funciones espejo están en el propio fichero).

- [ ] **Step 3: Commit**

```bash
git add tests/clasificacionTable.test.js
git commit -m "test: funciones de tabla de desglose en clasificacion"
```

---

### Task 2: Implementar funciones puras en main.js y usarlas en renderClasificacionTab

**Files:**
- Modify: `js/main.js` (insertar funciones puras antes de `renderClasificacionTab`, línea 871)
- Modify: `js/main.js:957-977` (template post-freeze de `container.innerHTML`)
- Test: `tests/clasificacionTable.test.js` (existente, no se toca)

**Interfaces:**
- Consumes: contrato de Task 1 (`getRankBadgeClass`, `buildClasificacionHeader`, `buildClasificacionRow`).
- Produces: `renderClasificacionTab()` renderiza cabecera + filas con la nueva tabla. `playersWithPoints` mantiene las props `name`, `avatar`, `predictionPoints`, `squadPoints`, `classificationPoints`, `eliminatoriasPoints`, `realPoints`.

- [ ] **Step 1: Insertar las funciones puras en `js/main.js`**

Justo antes de `async function renderClasificacionTab()` (línea 871), añadir el mismo código que en Task 1 (idéntico al test espejo):

```js
/** Devuelve el class del badge de posición */
function getRankBadgeClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-n';
}

/** Cabecera de la tabla de clasificación (6 columnas) */
function buildClasificacionHeader() {
  return `
    <div class="clasificacion-header">
      <span>Jugador</span><span>Pron</span><span>Plant</span><span>Clas</span><span>Elim</span><span>Total</span>
    </div>`;
}

/** Fila de usuario con desglose: identidad + 5 valores alineados */
function buildClasificacionRow(p, rank, isMe) {
  return `
    <div class="clasificacion-row ${isMe ? 'current-user' : ''}" onclick="showUserProfileModal('${p.name}')">
      <div class="clasificacion-id">
        <div class="rank-pill ${getRankBadgeClass(rank)}">${rank}</div>
        <span class="player-avatar">${p.avatar}</span>
        <span class="clasificacion-name">${p.name}${isMe ? ' <span class="clasificacion-you">(Tu)</span>' : ''}</span>
      </div>
      <span class="clasificacion-val">${p.predictionPoints}</span>
      <span class="clasificacion-val">${p.squadPoints}</span>
      <span class="clasificacion-val">${p.classificationPoints}</span>
      <span class="clasificacion-val">${p.eliminatoriasPoints}</span>
      <span class="clasificacion-val clasificacion-total">${p.realPoints}</span>
    </div>`;
}
```

- [ ] **Step 2: Reemplazar el template de renderizado (js/main.js:957-977)**

Sustituir el bloque completo:

```js
  container.innerHTML = playersWithPoints.map((p, i) => {
    const rank = i + 1;
    const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
    const breakdownParts = [];
    if (p.predictionPoints) breakdownParts.push(`${p.predictionPoints} pronósticos`);
    if (p.squadPoints) breakdownParts.push(`${p.squadPoints} plantilla`);
    if (p.classificationPoints) breakdownParts.push(`${p.classificationPoints} clasificación`);
    if (p.eliminatoriasPoints) breakdownParts.push(`${p.eliminatoriasPoints} eliminatorias`);
    const breakdownStr = breakdownParts.length ? ` (${breakdownParts.join(' + ')})` : '';
    return `
      <div class="leaderboard-row ${isMe ? 'current-user' : ''}" onclick="showUserProfileModal('${p.name}')">
        <div class="rank-badge rank-${rank}">${rank}</div>
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${p.name}${isMe ? ' <span style="color:var(--accent-primary)">(Tu)</span>' : ''}</div>
          <div class="player-breakdown" style="font-size:10px;color:var(--text-muted)">${breakdownStr}</div>
        </div>
        <div class="player-points">${p.realPoints} <span style="font-size:10px;color:var(--text-muted)">pts</span></div>
      </div>
    `;
  }).join('');
```

por:

```js
  container.innerHTML =
    buildClasificacionHeader() +
    playersWithPoints.map((p, i) => {
      const rank = i + 1;
      const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
      return buildClasificacionRow(p, rank, isMe);
    }).join('');
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/main.js` (en `porra-spa`)
Expected: sin salida (éxito).

- [ ] **Step 4: Verificar que el test de contrato sigue en verde**

Run: `node tests/clasificacionTable.test.js` (en `porra-spa`)
Expected: `6 passing, 0 failing` (contrato espejo intacto).

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: tabla de desglose de puntos en clasificacion (cabecera + filas)"
```

---

### Task 3: Estilos CSS de la tabla

**Files:**
- Modify: `css/styles.css` (añadir al final del fichero)

**Interfaces:**
- Consumes: clases generadas por `buildClasificacionHeader`/`buildClasificacionRow` (Task 2): `clasificacion-header`, `clasificacion-row`, `clasificacion-id`, `clasificacion-name`, `clasificacion-you`, `clasificacion-val`, `clasificacion-total`, `rank-pill`, `rank-n`, `current-user`. Variables `:root` existentes.
- Produces: estilos aplicados (cabecera sticky, grid 6 columnas, wrap de nombres, badges de podio, resaltado del usuario actual).

- [ ] **Step 1: Añadir los estilos al final de `css/styles.css`**

```css
/* Tabla de desglose en Clasificación (C2) */
.clasificacion-header {
  display: grid;
  grid-template-columns: 1fr repeat(5, 40px);
  gap: 4px;
  align-items: center;
  padding: 8px 10px;
  background: var(--ucl-card);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 2;
}
.clasificacion-header span {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
  text-align: right;
}
.clasificacion-header span:first-child { text-align: left; }

.clasificacion-row {
  display: grid;
  grid-template-columns: 1fr repeat(5, 40px);
  gap: 4px;
  align-items: center;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.clasificacion-row:last-child { border-bottom: none; }
.clasificacion-row.current-user {
  background: rgba(16, 185, 129, 0.12);
  border-left: 4px solid var(--accent-primary);
}

.clasificacion-id {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.clasificacion-name {
  font-weight: 600;
  font-size: 10.5px;
  line-height: 1.25;
  overflow-wrap: break-word;
  word-break: break-all;
}
.clasificacion-you { color: var(--accent-primary); }
.clasificacion-val {
  text-align: right;
  font-weight: 700;
  font-size: 11px;
  color: var(--text-secondary);
}
.clasificacion-total {
  color: var(--accent-primary);
  font-weight: 800;
  font-size: 12px;
}

.rank-pill {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 10px;
}
.rank-1 { background: #F59E0B; color: #000; }
.rank-2 { background: #94A3B8; color: #000; }
.rank-3 { background: #B45309; color: #fff; }
.rank-n { background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); }
```

> Nota: `.rank-1/2/3` ya existen en `css/styles.css:774-776`. La redefinición es intencionada para agruparlas con `.rank-pill` y es idéntica en valores; no rompe el resto (pre-freeze sigue usando `.rank-badge`, que no se toca).

- [ ] **Step 2: Verificar que el grid está presente**

Run: `node -e "const c=require('fs').readFileSync('css/styles.css','utf8'); if(!c.includes('grid-template-columns: 1fr repeat(5, 40px);')) throw new Error('grid no presente'); console.log('CSS OK')"` (en `porra-spa`)
Expected: `CSS OK`

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: estilos de tabla de desglose en clasificacion"
```

---

### Task 4: Cache-busting y verificación final

**Files:**
- Modify: `index.html:19` (`css/styles.css?v=51` → `?v=52`)
- Modify: `index.html:253` (`js/main.js?v=73` → `?v=74`)

**Interfaces:**
- Consumes: cambios de Tasks 2 y 3 ya commiteados.

- [ ] **Step 1: Subir versiones en `index.html`**

- Línea 19: `<link rel="stylesheet" href="css/styles.css?v=51">` → `<link rel="stylesheet" href="css/styles.css?v=52">`
- Línea 253: `<script src="js/main.js?v=73"></script>` → `<script src="js/main.js?v=74"></script>`

- [ ] **Step 2: Verificar versiones**

Run: `grep -n "styles.css?v\|main.js?v" index.html` (en `porra-spa`)
Expected: `css/styles.css?v=52` y `js/main.js?v=74`.

- [ ] **Step 3: Verificación de sintaxis y tests**

Run:
```bash
node --check js/main.js
node tests/clasificacionTable.test.js
```
Expected: `--check` sin salida; `6 passing, 0 failing`.

- [ ] **Step 4: Verificación manual en navegador**

Servir localmente (`python3 -m http.server 8000`) y en vista móvil vertical (post-freeze; si la fecha actual es anterior a `championsFreezeDate`, forzar temporalmente en el código el flujo post-freeze o comprobar solo con el modal): 

1. Cabecera sticky `Jugador | Pron | Plant | Clas | Elim | Total` visible.
2. 3 primeros con badge oro/plata/bronce; resto gris.
3. Nombres largos en 1-2 líneas (word-break), sin cortar.
4. Total en verde a la derecha; valores alineados.
5. Al hacer scroll, la cabecera permanece visible.
6. Clic en fila abre el modal de perfil.
7. Usuario actual resaltado (borde verde + fondo sutil).
8. Modo pre-freeze sin cambios (solo nombres).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting styles.css v=52 y main.js v=74"
```

---

## Fuera de alcance

- Cálculo de puntos (`calculateUserTotalPoints`, `calculateSquadPoints`, `calculateClassificationPoints`, `calculateEliminatoriasPoints`): no se tocan.
- Modal de perfil (`showUserProfileModal`) y sus pestañas.
- Pestaña de Resultados y `renderLeaderboard` (js/main.js:4259).
- Optimización de rendimiento del cálculo por usuario (documentada en `docs/rendimiento-analisis.md`, acción 9).
