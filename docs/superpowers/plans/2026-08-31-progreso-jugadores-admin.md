# Progreso de jugadores (panel admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al panel de administración una pantalla a pantalla completa que muestre una tabla con el progreso de cada usuario en liguilla, eliminatorias, plantilla, validación y fases knockout.

**Architecture:** Endpoint admin dedicado `GET /api/admin/progress` en `api-porra` que devuelve datos crudos por usuario; el frontend (`porra-spa`) calcula el progreso por fase contra `AppState.matches` (data-driven) y lo pinta en un modal reutilizando el patrón `.breakdown-modal`. El cálculo puro vive en un módulo IIFE testable `js/progresoAdmin.js` estilo `js/stats.js`.

**Tech Stack:** Node.js HTTP nativo + Mongoose (backend), JavaScript Vanilla ES6+ (frontend), tests con `node` + `assert` (CommonJS).

## Global Constraints

- Cache-busting (AGENTS.md): al tocar `css/styles.css`, `js/main.js` o añadir JS, incrementar `v=` en `index.html`. Versiones actuales: `css/styles.css?v=81`, `js/main.js?v=120`.
- Diseño móvil vertical first: máximo `460px` de ancho, sin scroll horizontal involuntario (el único scroll permitido es vertical dentro del modal).
- Reutilizar variables CSS de `:root`; verde = `--accent-primary` (#10B981), rojo = `#ef4444` (no existe variable `--danger`), dorado = `--accent-gold`.
- No usar frameworks; JS vanilla ES6+; funciones puras exportables para tests vía guard `typeof module !== 'undefined'`.
- Backend: endpoints admin protegidos con `verifyAdmin(req)` → 403 si no es admin.
- Copiar los textos exactos de la spec: botón `📊 Progreso de jugadores`, estados `✅ Validado` / `⏳ Pendiente`, `🔒` para eliminatorias bloqueadas.

---

### Task 1: Endpoint admin `GET /api/admin/progress`

**Files:**
- Modify: `api-porra/server.js` (insertar justo antes del endpoint `GET /api/players`, línea 533)

**Interfaces:**
- Consumes: `verifyAdmin(req)`, `User` (modelo Mongoose), `sendJson(req, res, status, payload, cacheSeconds)`.
- Produces: `GET /api/admin/progress` → `{ ok: true, users: [{ username, avatar, isAdmin, predictionsConfirmed, predictions, finalPredictions, squadCount }] }`. Este contrato lo consumen las tareas 2-3.

- [ ] **Step 1: Insertar el endpoint**

En `api-porra/server.js`, entre la línea 531 (cierre del endpoint `fases-fechas`) y la 533 (`GET /api/players`), insertar:

```js
  // Endpoint Admin: Progreso de jugadores (panel admin)
  if (reqUrl.pathname === '/api/admin/progress' && req.method === 'GET') {
    const admin = await verifyAdmin(req);
    if (!admin) {
      sendJson(req, res, 403, { ok: false, error: 'Acceso denegado. Se requieren permisos de administrador.' });
      return;
    }
    try {
      const users = await User.find(
        {},
        'username avatar isAdmin predictions predictionsConfirmed finalPredictions squad'
      );
      const result = users.map(u => ({
        username: u.username,
        avatar: u.avatar || null,
        isAdmin: u.isAdmin === true,
        predictionsConfirmed: u.predictionsConfirmed === true,
        predictions: u.predictions || {},
        finalPredictions: u.finalPredictions || null,
        squadCount: Array.isArray(u.squad) ? u.squad.length : 0
      }));
      sendJson(req, res, 200, { ok: true, users: result });
    } catch (e) {
      console.error('Error obteniendo progreso:', e);
      sendJson(req, res, 500, { ok: false, error: 'Error interno del servidor' });
    }
    return;
  }
```

- [ ] **Step 2: Verificar el endpoint**

Run: `cd /home/ldoc/Proyectos/api-porra && node server.js` (en otra terminal).

```bash
# Login como admin para obtener token (sustituye por credenciales admin reales)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<admin>","password":"<pass>"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
# Llamada al endpoint
curl -s http://localhost:3000/api/admin/progress -H "Authorization: Bearer $TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.ok, j.users && j.users[0] && {username:j.users[0].username, predictionsConfirmed:j.users[0].predictionsConfirmed, squadCount:j.users[0].squadCount, hasPredictions:Object.keys(j.users[0].predictions||{}).length})})"
```

Expected: `true` y un objeto por usuario con `username`, `predictionsConfirmed`, `squadCount` y `hasPredictions`.

Verificar también que un token NO admin recibe 403:

```bash
TOKEN_NORMAL=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<noAdmin>","password":"<pass>"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/progress -H "Authorization: Bearer $TOKEN_NORMAL"
```

Expected: `403`.

- [ ] **Step 3: Commit**

```bash
cd /home/ldoc/Proyectos/api-porra
git add server.js
git commit -m "feat: endpoint admin GET /api/admin/progress"
```

---

### Task 2: Módulo `js/progresoAdmin.js` — funciones puras (TDD)

**Files:**
- Create: `porra-spa/js/progresoAdmin.js`
- Test: `porra-spa/tests/progresoAdmin.test.js`

**Interfaces:**
- Consumes: nada (funciones puras; solo estructuras de datos).
- Produces (exportadas vía `module.exports` y `global`):
  - `countPredictedInPhase(matches, predictions) → number`
  - `computeFinalSlotsFilled(finalPredictions) → number`
  - `computeProgressForUser(user, matchesByFase) → { username, avatar, isAdmin, predictionsConfirmed, byFase: { [fase]: { done, total } }, finalFilled, finalTotal, finalLocked, squadCount, squadTotal }`
  - `computeSummaries(progressList) → { total, ligaComplete, confirmed, squadComplete, finalComplete }`
  - `sortUsers(progressList, sortKey) → array`
  - Estas las consume la tarea 3 (`buildProgressTableHtml`, `showAdminProgressModal`).

- [ ] **Step 1: Escribir el test que falla**

Crear `porra-spa/tests/progresoAdmin.test.js`:

```js
const assert = require('assert');
const {
  countPredictedInPhase,
  computeFinalSlotsFilled,
  computeProgressForUser,
  computeSummaries,
  sortUsers
} = require('../js/progresoAdmin.js');

const LIGA_144 = Array.from({ length: 144 }, (_, i) => ({ id: String(i + 1), fase: 'liga' }));

function test_countPredictedInPhase_cuenta_solo_numericos() {
  const matches = [{ id: '1', fase: 'liga' }, { id: '2', fase: 'liga' }, { id: '3', fase: 'liga' }];
  const predictions = { '1': { home: 2, away: 1 }, '2': { home: null, away: null } };
  assert.strictEqual(countPredictedInPhase(matches, predictions), 1);
  assert.strictEqual(countPredictedInPhase(matches, null), 0);
  assert.strictEqual(countPredictedInPhase(matches, {}), 0);
}

function test_computeFinalSlotsFilled_vacio() {
  assert.strictEqual(computeFinalSlotsFilled(null), 0);
  assert.strictEqual(computeFinalSlotsFilled({}), 0);
}

function test_computeFinalSlotsFilled_parcial() {
  const fp = { champion: 42, runnerUp: null, semiFinalists: [1, 2], quarterFinalists: [], roundOf16: [], roundOf32: [] };
  assert.strictEqual(computeFinalSlotsFilled(fp), 3);
}

function test_computeFinalSlotsFilled_completo_24() {
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4], quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24]
  };
  assert.strictEqual(computeFinalSlotsFilled(fp), 24);
}

function test_computeProgressForUser_liga_y_lock() {
  const predictions = {};
  for (let i = 0; i < 100; i++) predictions[String(i + 1)] = { home: 1, away: 0 };
  const user = {
    username: 'juan123', avatar: '⚽', isAdmin: false, predictionsConfirmed: false,
    predictions, finalPredictions: null, squadCount: 18
  };
  const p = computeProgressForUser(user, { liga: LIGA_144 });
  assert.strictEqual(p.byFase.liga.done, 100);
  assert.strictEqual(p.byFase.liga.total, 144);
  assert.strictEqual(p.finalLocked, true);
  assert.strictEqual(p.finalFilled, 0);
  assert.strictEqual(p.squadCount, 18);
  assert.strictEqual(p.squadTotal, 25);
}

function test_computeProgressForUser_confirmado_elimina_lock() {
  const user = {
    username: 'marta7', avatar: '🏆', isAdmin: false, predictionsConfirmed: true,
    predictions: {}, finalPredictions: null, squadCount: 25
  };
  const p = computeProgressForUser(user, { liga: LIGA_144 });
  assert.strictEqual(p.finalLocked, false);
  assert.strictEqual(p.predictionsConfirmed, true);
}

function test_computeSummaries() {
  const list = [
    { byFase: { liga: { done: 144, total: 144 } }, predictionsConfirmed: true, squadCount: 25, squadTotal: 25, finalFilled: 24, finalTotal: 24, finalLocked: false },
    { byFase: { liga: { done: 89, total: 144 } }, predictionsConfirmed: false, squadCount: 18, squadTotal: 25, finalFilled: 0, finalTotal: 24, finalLocked: true },
    { byFase: { liga: { done: 144, total: 144 } }, predictionsConfirmed: true, squadCount: 25, squadTotal: 25, finalFilled: 20, finalTotal: 24, finalLocked: false }
  ];
  const s = computeSummaries(list);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.ligaComplete, 2);
  assert.strictEqual(s.confirmed, 2);
  assert.strictEqual(s.squadComplete, 2);
  assert.strictEqual(s.finalComplete, 1);
}

function test_sortUsers_nombre() {
  const list = [
    { username: 'luciab', byFase: { liga: { done: 89, total: 144 } } },
    { username: 'marta7', byFase: { liga: { done: 144, total: 144 } } },
    { username: 'admin', byFase: { liga: { done: 144, total: 144 } } }
  ];
  const sorted = sortUsers(list, 'name');
  assert.deepStrictEqual(sorted.map(u => u.username), ['admin', 'luciab', 'marta7']);
}

function test_sortUsers_liga_menos_completados_primero() {
  const list = [
    { username: 'marta7', byFase: { liga: { done: 144, total: 144 } } },
    { username: 'luciab', byFase: { liga: { done: 89, total: 144 } } },
    { username: 'pablo_', byFase: { liga: { done: 102, total: 144 } } }
  ];
  const sorted = sortUsers(list, 'liga');
  assert.deepStrictEqual(sorted.map(u => u.username), ['luciab', 'pablo_', 'marta7']);
}

function test_sortUsers_confirmados_primero() {
  const list = [
    { username: 'luciab', predictionsConfirmed: false },
    { username: 'marta7', predictionsConfirmed: true }
  ];
  const sorted = sortUsers(list, 'confirmed');
  assert.deepStrictEqual(sorted.map(u => u.username), ['marta7', 'luciab']);
}

const tests = [
  test_countPredictedInPhase_cuenta_solo_numericos,
  test_computeFinalSlotsFilled_vacio,
  test_computeFinalSlotsFilled_parcial,
  test_computeFinalSlotsFilled_completo_24,
  test_computeProgressForUser_liga_y_lock,
  test_computeProgressForUser_confirmado_elimina_lock,
  test_computeSummaries,
  test_sortUsers_nombre,
  test_sortUsers_liga_menos_completados_primero,
  test_sortUsers_confirmados_primero
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `cd /home/ldoc/Proyectos/porra-spa && node tests/progresoAdmin.test.js`
Expected: FAIL con `Cannot find module '../js/progresoAdmin.js'`.

- [ ] **Step 3: Implementar las funciones puras**

Crear `porra-spa/js/progresoAdmin.js`:

```js
(function (global) {
  const FASE_LABELS = { liga: 'Liguilla', '16': '16avos', '8': 'Octavos', '4': 'Cuartos', semis: 'Semifinales', final: 'Final' };

  function countPredictedInPhase(matches, predictions) {
    let done = 0;
    for (const m of matches || []) {
      const p = predictions && predictions[m.id];
      if (p && typeof p.home === 'number' && typeof p.away === 'number') done++;
    }
    return done;
  }

  function computeFinalSlotsFilled(fp) {
    if (!fp) return 0;
    const slots = [
      fp.champion != null ? 1 : 0,
      fp.runnerUp != null ? 1 : 0,
      (fp.semiFinalists || []).filter(Boolean).length,
      (fp.quarterFinalists || []).filter(Boolean).length,
      (fp.roundOf16 || []).filter(Boolean).length,
      (fp.roundOf32 || []).filter(Boolean).length
    ];
    return slots.reduce((a, b) => a + b, 0);
  }

  function computeProgressForUser(user, matchesByFase) {
    const byFase = {};
    for (const [fase, matches] of Object.entries(matchesByFase || {})) {
      byFase[fase] = {
        done: countPredictedInPhase(matches, user.predictions),
        total: (matches || []).length
      };
    }
    return {
      username: user.username,
      avatar: user.avatar || '👤',
      isAdmin: user.isAdmin === true,
      predictionsConfirmed: user.predictionsConfirmed === true,
      byFase,
      finalFilled: computeFinalSlotsFilled(user.finalPredictions),
      finalTotal: 24,
      finalLocked: user.predictionsConfirmed !== true,
      squadCount: typeof user.squadCount === 'number' ? user.squadCount : (Array.isArray(user.squad) ? user.squad.length : 0),
      squadTotal: 25
    };
  }

  function computeSummaries(progressList) {
    const total = progressList.length;
    const ligaComplete = progressList.filter(p => {
      const liga = p.byFase && p.byFase.liga;
      return liga && liga.total > 0 && liga.done === liga.total;
    }).length;
    const confirmed = progressList.filter(p => p.predictionsConfirmed).length;
    const squadComplete = progressList.filter(p => p.squadCount === p.squadTotal).length;
    const finalComplete = progressList.filter(p => !p.finalLocked && p.finalFilled === p.finalTotal).length;
    return { total, ligaComplete, confirmed, squadComplete, finalComplete };
  }

  function sortUsers(progressList, sortKey) {
    const arr = [...progressList];
    const byName = (a, b) => String(a.username).localeCompare(String(b.username));
    if (sortKey === 'name') return arr.sort(byName);
    if (sortKey === 'confirmed') return arr.sort((a, b) => (Number(b.predictionsConfirmed) - Number(a.predictionsConfirmed)) || byName(a, b));
    const ligaDone = p => (p.byFase && p.byFase.liga) ? p.byFase.liga.done : 0;
    return arr.sort((a, b) => (ligaDone(a) - ligaDone(b)) || byName(a, b));
  }

  global.FASE_LABELS = FASE_LABELS;
  global.countPredictedInPhase = countPredictedInPhase;
  global.computeFinalSlotsFilled = computeFinalSlotsFilled;
  global.computeProgressForUser = computeProgressForUser;
  global.computeSummaries = computeSummaries;
  global.sortUsers = sortUsers;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FASE_LABELS, countPredictedInPhase, computeFinalSlotsFilled, computeProgressForUser, computeSummaries, sortUsers };
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `cd /home/ldoc/Proyectos/porra-spa && node tests/progresoAdmin.test.js`
Expected: `10 passing, 0 failing`.

- [ ] **Step 5: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add js/progresoAdmin.js tests/progresoAdmin.test.js
git commit -m "feat: funciones puras de progreso de jugadores (admin)"
```

---

### Task 3: Render del modal y tabla `buildProgressTableHtml`

**Files:**
- Modify: `porra-spa/js/progresoAdmin.js` (añadir al final, antes de los `global.*` exports)
- Test: `porra-spa/tests/progresoAdmin.test.js` (añadir casos)

**Interfaces:**
- Consumes: funciones de la tarea 2, `AppState` (global), `API_BASE` (global de main.js), `authHeaders()`, `fetchWithPhase()`, `logout()`, `showToast()` (todas globales de main.js), `FASE_LABELS`.
- Produces:
  - `buildProgressTableHtml(progressList, phaseOrder, sortKey) → string` (HTML de chips + tabla; sin DOM).
  - `showAdminProgressModal() → void` (crea overlay `.breakdown-modal`, hace fetch a `/api/admin/progress`, renderiza).
  - `loadAdminProgress(contentEl, refreshBtn) → Promise<void>` (fetch + render + manejo de errores).

- [ ] **Step 1: Añadir tests que fallan para `buildProgressTableHtml`**

Añadir al final de `tests/progresoAdmin.test.js`, antes del bloque `const tests`, e incluir las nuevas funciones en el `require` y en el array `tests`:

```js
function test_buildProgressTableHtml_celdas_estado() {
  const list = [
    { username: 'luciab', avatar: '⚽', isAdmin: false, predictionsConfirmed: false, byFase: { liga: { done: 89, total: 144 } }, finalFilled: 0, finalTotal: 24, finalLocked: true, squadCount: 18, squadTotal: 25 },
    { username: 'marta7', avatar: '🏆', isAdmin: false, predictionsConfirmed: true, byFase: { liga: { done: 144, total: 144 } }, finalFilled: 24, finalTotal: 24, finalLocked: false, squadCount: 25, squadTotal: 25 }
  ];
  const html = buildProgressTableHtml(list, ['liga']);
  assert.match(html, /89\/144/);
  assert.match(html, /state-pending/);
  assert.match(html, /144\/144/);
  assert.match(html, /state-done/);
  assert.match(html, /🔒/);
  assert.match(html, /⏳/);
  assert.match(html, /✅/);
  assert.match(html, /Liguilla/);
}

function test_buildProgressTableHtml_fases_dinamicas() {
  const list = [
    { username: 'x', avatar: '👤', isAdmin: false, predictionsConfirmed: true, byFase: { liga: { done: 144, total: 144 }, '16': { done: 5, total: 16 } }, finalFilled: 24, finalTotal: 24, finalLocked: false, squadCount: 25, squadTotal: 25 }
  ];
  const html = buildProgressTableHtml(list, ['liga', '16']);
  assert.match(html, /16avos/);
  assert.match(html, /5\/16/);
}

function test_buildProgressTableHtml_sumario() {
  const list = [
    { username: 'marta7', avatar: '🏆', isAdmin: false, predictionsConfirmed: true, byFase: { liga: { done: 144, total: 144 } }, finalFilled: 24, finalTotal: 24, finalLocked: false, squadCount: 25, squadTotal: 25 }
  ];
  const html = buildProgressTableHtml(list, ['liga']);
  assert.match(html, /👥 1/);
  assert.match(html, /Liguilla 1\/1/);
  assert.match(html, /Validados 1/);
}
```

Añadir `buildProgressTableHtml` al `require` del test:

```js
const {
  countPredictedInPhase,
  computeFinalSlotsFilled,
  computeProgressForUser,
  computeSummaries,
  sortUsers,
  buildProgressTableHtml
} = require('../js/progresoAdmin.js');
```

Añadir las 3 nuevas funciones al array `tests` (antes del cierre `];`).

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `cd /home/ldoc/Proyectos/porra-spa && node tests/progresoAdmin.test.js`
Expected: FAIL con `buildProgressTableHtml is not a function`.

- [ ] **Step 3: Implementar render y modal**

En `js/progresoAdmin.js`, justo antes del bloque `global.FASE_LABELS = ...`, añadir:

```js
  function countCellHtml(done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const state = (done >= total && total > 0) ? 'state-done' : 'state-pending';
    return `<td class="count ${state}">${done}/${total}<span class="bar"><span style="width:${pct}%"></span></span></td>`;
  }

  function buildProgressTableHtml(progressList, phaseOrder, sortKey) {
    const sorted = sortUsers(progressList, sortKey || 'liga');
    const s = computeSummaries(progressList);
    const summary = `
      <div class="admin-progress-summary">
        <span class="chip">👥 ${s.total}</span>
        <span class="chip">✅ Liguilla ${s.ligaComplete}/${s.total}</span>
        <span class="chip">🏆 Validados ${s.confirmed}</span>
        <span class="chip">🧩 Plantilla ${s.squadComplete}/${s.total}</span>
        <span class="chip">🗓️ Eliminatorias ${s.finalComplete}/${s.total}</span>
      </div>`;
    const headerCells = ['Jugador'].concat(
      phaseOrder.map(f => FASE_LABELS[f] || f),
      ['Validado', 'Eliminatorias', 'Plantilla']
    );
    const thead = `<thead><tr>${headerCells.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const rows = sorted.map(p => {
      const phaseCells = phaseOrder.map(f => {
        const c = p.byFase[f];
        return c ? countCellHtml(c.done, c.total) : '<td class="count state-pending">-</td>';
      });
      const valCell = p.predictionsConfirmed
        ? '<td class="val state-done">✅</td>'
        : '<td class="val state-pending">⏳</td>';
      const finalCell = p.finalLocked
        ? '<td class="count state-locked">🔒</td>'
        : countCellHtml(p.finalFilled, p.finalTotal);
      const squadCell = countCellHtml(p.squadCount, p.squadTotal);
      return `<tr>
        <td class="col-user"><span class="avatar">${p.avatar}</span> ${p.username}</td>
        ${phaseCells.join('')}
        ${valCell}
        ${finalCell}
        ${squadCell}
      </tr>`;
    }).join('');
    return `${summary}<div class="admin-progress-table-wrap"><table class="admin-progress-table">${thead}<tbody>${rows}</tbody></table></div>`;
  }

  async function loadAdminProgress(contentEl) {
    contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando...</div>';
    let data;
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/progress`, { headers: authHeaders() });
      if (res.status === 401) { logout(); return; }
      if (res.status === 403) {
        contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Acceso denegado</div>';
        return;
      }
      data = await res.json();
      if (!data.ok || !data.users) throw new Error('Respuesta inválida');
    } catch (e) {
      contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Error de conexión<br><button id="admin-progress-retry" class="btn-primary" style="margin-top: 12px;">Reintentar</button></div>';
      contentEl.querySelector('#admin-progress-retry')?.addEventListener('click', () => loadAdminProgress(contentEl));
      return;
    }

    const matchesByFase = {};
    for (const m of AppState.matches || []) {
      (matchesByFase[m.fase] = matchesByFase[m.fase] || []).push(m);
    }
    const phaseOrder = ['liga', '16', '8', '4', 'semis', 'final'].filter(f => (matchesByFase[f] || []).length);
    const progressList = (data.users || []).map(u => computeProgressForUser(u, matchesByFase));
    let sortKey = 'liga';

    function render() {
      contentEl.innerHTML = `
        <div class="admin-progress-toolbar">
          <select id="admin-progress-sort" class="admin-progress-sort">
            <option value="liga"${sortKey === 'liga' ? ' selected' : ''}>Orden: Liguilla ↑</option>
            <option value="name"${sortKey === 'name' ? ' selected' : ''}>Orden: Nombre</option>
            <option value="confirmed"${sortKey === 'confirmed' ? ' selected' : ''}>Orden: Validados</option>
          </select>
          <span class="admin-progress-time">Actualizado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${buildProgressTableHtml(progressList, phaseOrder, sortKey)}
      `;
      contentEl.querySelector('#admin-progress-sort').addEventListener('change', e => {
        sortKey = e.target.value;
        render();
      });
    }
    render();
  }

  function showAdminProgressModal() {
    const existing = document.querySelector('.breakdown-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'breakdown-modal-overlay';
    overlay.innerHTML = `
      <div class="breakdown-modal admin-progress-modal">
        <div class="breakdown-modal-header">
          <button class="breakdown-modal-close" id="admin-progress-close">✕</button>
          <h3 class="breakdown-modal-title" style="flex: 1; text-align: center; font-size: 1rem;">📊 Progreso de jugadores</h3>
          <button class="breakdown-modal-close" id="admin-progress-refresh" title="Refrescar">↻</button>
        </div>
        <div class="admin-progress-content" id="admin-progress-content">
          <div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#admin-progress-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    const contentEl = overlay.querySelector('#admin-progress-content');
    overlay.querySelector('#admin-progress-refresh').addEventListener('click', () => loadAdminProgress(contentEl));
    loadAdminProgress(contentEl);
  }

  global.buildProgressTableHtml = buildProgressTableHtml;
  global.showAdminProgressModal = showAdminProgressModal;
  global.loadAdminProgress = loadAdminProgress;
```

Y añadir `buildProgressTableHtml` (y `showAdminProgressModal`/`loadAdminProgress` si se quieren exponer en CommonJS) al `module.exports`:

```js
    module.exports = { FASE_LABELS, countPredictedInPhase, computeFinalSlotsFilled, computeProgressForUser, computeSummaries, sortUsers, buildProgressTableHtml };
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `cd /home/ldoc/Proyectos/porra-spa && node tests/progresoAdmin.test.js`
Expected: `13 passing, 0 failing`.

- [ ] **Step 5: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add js/progresoAdmin.js tests/progresoAdmin.test.js
git commit -m "feat: render del modal y tabla de progreso de jugadores (admin)"
```

---

### Task 4: Estilos CSS `.admin-progress-*`

**Files:**
- Modify: `porra-spa/css/styles.css` (añadir al final, tras la sección ADMIN PANEL)

**Interfaces:**
- Consumes: clases generadas por `buildProgressTableHtml` y `showAdminProgressModal` (Task 3): `.admin-progress-modal`, `.admin-progress-content`, `.admin-progress-toolbar`, `.admin-progress-sort`, `.admin-progress-time`, `.admin-progress-summary`, `.admin-progress-table-wrap`, `.admin-progress-table`, `.col-user`, `.avatar`, `.count`, `.bar`, `.val`, `.state-done`, `.state-pending`, `.state-locked`.
- Produces: estilos consistentes con el modo oscuro (`:root`).

- [ ] **Step 1: Añadir los estilos**

Añadir al final de `porra-spa/css/styles.css`:

```css
/* ==========================================================================
   ADMIN PROGRESS
   ========================================================================== */
.admin-progress-modal {
  max-width: 460px;
  width: 100%;
}
.admin-progress-content {
  overflow-y: auto;
  padding: 12px;
}
.admin-progress-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.admin-progress-sort {
  background: var(--ucl-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 12px;
  min-height: 44px;
}
.admin-progress-time {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.admin-progress-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.admin-progress-summary .chip {
  background: var(--ucl-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-secondary);
}
.admin-progress-table-wrap {
  overflow-x: auto;
}
.admin-progress-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.admin-progress-table thead th {
  position: sticky;
  top: 0;
  background: var(--ucl-card);
  color: var(--text-muted);
  font-weight: 700;
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}
.admin-progress-table td {
  padding: 8px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  white-space: nowrap;
}
.admin-progress-table .col-user {
  font-weight: 700;
  color: var(--text-primary);
}
.admin-progress-table .avatar {
  margin-right: 4px;
}
.admin-progress-table .count {
  font-weight: 800;
}
.admin-progress-table .count .bar {
  display: block;
  height: 4px;
  width: 48px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  margin-top: 3px;
}
.admin-progress-table .count .bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: currentColor;
}
.admin-progress-table .state-done {
  color: var(--accent-primary);
}
.admin-progress-table .state-pending {
  color: #ef4444;
}
.admin-progress-table .state-locked {
  color: var(--text-muted);
}
```

- [ ] **Step 2: Verificación visual**

Run: `cd /home/ldoc/Proyectos/porra-spa && node server.mjs` y abre `http://localhost:3000` (o el puerto que use `server.mjs`) en modo responsive 390px. Con el modal de progreso abierto (tras Task 5) comprobar: chips en cabecera, celdas rojas `#ef4444` y verdes `--accent-primary`, `🔒` gris, header sticky al hacer scroll, sin scroll horizontal del layout completo.

- [ ] **Step 3: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add css/styles.css
git commit -m "feat: estilos de la tabla de progreso de jugadores (admin)"
```

---

### Task 5: Botón en el modal admin + `index.html` + cache-busting

**Files:**
- Modify: `porra-spa/js/main.js` (en `showAdminModal()`, tras el botón `btn-manage-invitations`, líneas ~2499-2501)
- Modify: `porra-spa/index.html` (líneas 19, 319-325)

**Interfaces:**
- Consumes: `showAdminProgressModal()` (Task 3, global), patrón de botón existente en `showAdminModal()`.
- Produces: botón `📊 Progreso de jugadores` en el panel admin; `js/progresoAdmin.js` incluido en el HTML; cache-busting actualizado.

- [ ] **Step 1: Añadir el botón en `showAdminModal()`**

En `js/main.js`, dentro del `innerHTML` de `showAdminModal()` (tras el botón `btn-manage-invitations`), añadir:

```js
      <button id="btn-admin-progress" class="btn-primary" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; margin-top: 8px; width: 100%;">
        📊 Progreso de jugadores
      </button>
```

Y, junto a los otros listeners del modal (tras el bloque de `manageInvitationsBtn`), añadir:

```js
  const progressBtn = modal.querySelector('#btn-admin-progress');
  if (progressBtn) {
    progressBtn.addEventListener('click', () => {
      modal.remove();
      showAdminProgressModal();
    });
  }
```

- [ ] **Step 2: Añadir el script en `index.html` y cache-busting**

En `porra-spa/index.html`:
- Añadir `<script src="js/progresoAdmin.js?v=1"></script>` tras la línea del `hoyPartidos.js` (línea 324).
- Bump `js/main.js?v=120` → `js/main.js?v=121`.
- Bump `css/styles.css?v=81` → `css/styles.css?v=82`.

- [ ] **Step 3: Verificación funcional**

Run: `cd /home/ldoc/Proyectos/porra-spa && node server.mjs` y abrir la app como admin.
1. Perfil → Panel de Administración → botón `📊 Progreso de jugadores` visible.
2. Pulsar → se abre el modal a pantalla completa con chips de resumen y la tabla (usuario, liguilla `X/144`, validado `✅`/`⏳`, eliminatorias `X/24` o `🔒`, plantilla `X/25`).
3. Cambiar el desplegable de orden y comprobar que reordena.
4. Pulsar `↻` y comprobar refresco.
5. En consola del navegador: sin excepciones.

- [ ] **Step 4: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add js/main.js index.html
git commit -m "feat: botón progreso de jugadores en panel admin + cache-busting"
```

---

## Self-Review

**Spec coverage:**
- Endpoint admin (`GET /api/admin/progress`) → Task 1. ✔
- Módulo frontend + funciones puras → Task 2. ✔
- Render modal/taabla → Task 3. ✔
- Estilos `.admin-progress-*` → Task 4. ✔
- Botón en modal admin + cache-busting → Task 5. ✔
- Celdas rojas/verdes, `🔒` si no confirmado, `✅`/`⏳` validado, orden por defecto y desplegable → Tasks 2-3 (lógica) y Task 4 (estilos). ✔
- Errores 401/403/red → Task 3 (`loadAdminProgress`). ✔
- Tests → Tasks 2-3 (`tests/progresoAdmin.test.js`, 13 casos). ✔
- Cache-busting → Task 5. ✔

**Type consistency:** `computeProgressForUser` devuelve `{ byFase, finalFilled, finalTotal, finalLocked, squadCount, squadTotal, predictionsConfirmed, username, avatar, isAdmin }`; `buildProgressTableHtml` lo consume igual en Task 3 y los tests. `sortUsers(progressList, sortKey)` acepta `'name' | 'confirmed' | 'liga'`. ✔