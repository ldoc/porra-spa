# Fechas de fases + countdown en Inicio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al admin definir fechas de inicio/fin de las 13 fases (MongoDB) y mostrar un countdown en el tab Inicio de la SPA hasta el siguiente hito de la fase actual.

**Architecture:** En el backend se añade `fasesFechas` al documento `GameConfig` de MongoDB, se expone en `GET /api/config` y se edita con un nuevo endpoint admin. En la SPA la lógica pura (cálculo del objetivo del countdown y formateo del tiempo) vive en un módulo testable (`js/fasesFechas.js`), el modal admin gana una sección de edición, y `renderInicioTab()` muestra el countdown.

**Tech Stack:** Node.js (ESM), MongoDB + Mongoose (api-porra); Vanilla JS + HTML/CSS (porra-spa, sin frameworks).

## Global Constraints

- Código en español para funciones y variables (convención de ambos repos).
- api-porra usa ES Modules (`import/export`), no CommonJS.
- En api-porra, tests con `node:test` + `assert/strict`; ejecutar con `node --test tests/<archivo>.test.js`.
- En porra-spa, tests estilo runner manual (función + array de tests + `process.exit`), ejecutar con `node tests/<archivo>.test.js`.
- Porra-spa: al tocar `js/*.js` o `css/*.css`, incrementar `?v=` en `index.html` (regla de AGENTS.md). Estado en `main.js` sin framework; AppState es la fuente de verdad.
- Los módulos JS de porra-spa reutilizables usan el patrón UMD de `js/apiData.js` (exponen global + `module.exports`).
- Fechas: se guardan como ISO string en MongoDB (`Date`), `null` = fecha aún desconocida.

---

### Task 1: Backend — Módulo de validación `api/fasesFechas.js` (TDD)

**Files:**
- Create: `api-porra/api/fasesFechas.js`
- Test: `api-porra/tests/fasesFechas.test.js`

**Interfaces:**
- Consumes: nada (función pura).
- Produces: `validateFasesFechas(fasesFechas, fasesValidas)` → `{ ok: true, fasesFechas }` o `{ ok: false, error }`. Normaliza `""` y `null` a `null`, valida claves y `inicio < fin`.

- [ ] **Step 1: Write the failing test**

Create `api-porra/tests/fasesFechas.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFasesFechas } from '../api/fasesFechas.js';

const FASES = ['FASE_PRETEMPORADA', 'FASE_LIGA', 'FASE_PRE16', 'FASE_16'];

test('acepta fases válidas con fechas ISO', () => {
  const r = validateFasesFechas({
    FASE_LIGA: { inicio: '2026-09-08T20:00:00.000Z', fin: '2026-12-11T20:00:00.000Z' }
  }, FASES);
  assert.equal(r.ok, true);
  assert.equal(r.fasesFechas.FASE_LIGA.inicio instanceof Date, true);
  assert.equal(r.fasesFechas.FASE_LIGA.fin instanceof Date, true);
});

test('acepta null y string vacío como sin fecha', () => {
  const r = validateFasesFechas({
    FASE_LIGA: { inicio: null, fin: '' }
  }, FASES);
  assert.equal(r.ok, true);
  assert.equal(r.fasesFechas.FASE_LIGA.inicio, null);
  assert.equal(r.fasesFechas.FASE_LIGA.fin, null);
});

test('rechaza clave de fase no válida', () => {
  const r = validateFasesFechas({ FASE_INEXISTENTE: { inicio: null, fin: null } }, FASES);
  assert.equal(r.ok, false);
  assert.match(r.error, /Fase inválida/);
});

test('rechaza inicio posterior o igual al fin', () => {
  const r = validateFasesFechas({
    FASE_LIGA: { inicio: '2026-12-11T20:00:00.000Z', fin: '2026-09-08T20:00:00.000Z' }
  }, FASES);
  assert.equal(r.ok, false);
  assert.match(r.error, /anterior al fin/);
});

test('rechaza fechas no parseables', () => {
  const r = validateFasesFechas({ FASE_LIGA: { inicio: 'no-es-fecha', fin: null } }, FASES);
  assert.equal(r.ok, false);
});

test('rechaza fasesFechas que no es objeto', () => {
  assert.equal(validateFasesFechas(null, FASES).ok, false);
  assert.equal(validateFasesFechas('x', FASES).ok, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api-porra && node --test tests/fasesFechas.test.js`
Expected: FAIL — `Error: Cannot find module '../api/fasesFechas.js'`

- [ ] **Step 3: Write minimal implementation**

Create `api-porra/api/fasesFechas.js`:

```js
/**
 * Validación y normalización de las fechas de inicio/fin de las fases.
 * Valores permitidos: ISO date string, "" o null (→ null = fecha desconocida).
 */

export function validateFasesFechas(fasesFechas, fasesValidas) {
  if (!fasesFechas || typeof fasesFechas !== 'object' || Array.isArray(fasesFechas)) {
    return { ok: false, error: 'fasesFechas debe ser un objeto' };
  }
  const validas = new Set(fasesValidas);
  const result = {};
  for (const [nombre, rango] of Object.entries(fasesFechas)) {
    if (!validas.has(nombre)) {
      return { ok: false, error: `Fase inválida: ${nombre}` };
    }
    const r = rango || {};
    const inicio = r.inicio == null || r.inicio === '' ? null : new Date(r.inicio);
    const fin = r.fin == null || r.fin === '' ? null : new Date(r.fin);
    if (inicio && isNaN(inicio.getTime())) {
      return { ok: false, error: `Fecha de inicio inválida en ${nombre}` };
    }
    if (fin && isNaN(fin.getTime())) {
      return { ok: false, error: `Fecha de fin inválida en ${nombre}` };
    }
    if (inicio && fin && inicio.getTime() >= fin.getTime()) {
      return { ok: false, error: `La fecha de inicio debe ser anterior al fin en ${nombre}` };
    }
    result[nombre] = { inicio, fin };
  }
  return { ok: true, fasesFechas: result };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api-porra && node --test tests/fasesFechas.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add api/fasesFechas.js tests/fasesFechas.test.js
git commit -m "feat: validación de fechas de fases (api/fasesFechas.js)"
```

---

### Task 2: Backend — Modelo `GameConfig`, `GET /api/config` y endpoint admin

**Files:**
- Modify: `api-porra/db/models/GameConfig.js:3-24`
- Modify: `api-porra/server.js:1-30` (import), `:408-440` (GET /api/config), `:479-526` (tras /api/admin/config añadir nuevo endpoint)
- Test: `api-porra/tests/fasesFechas.test.js` (ya existe)

**Interfaces:**
- Consumes: `validateFasesFechas` de Task 1, `FASES_VALIDAS` (ya en server.js, línea 221), `verifyAdmin` (línea 197), `parseBody` (línea 240).
- Produces: campo `fasesFechas` en `GameConfig`; `GET /api/config` devuelve `config.fasesFechas`; `PUT /api/admin/fases-fechas`.

- [ ] **Step 1: Add field to model**

In `api-porra/db/models/GameConfig.js`, inside the schema object (tras el bloque `tournament`, línea 18):

```js
  fasesFechas: { type: Object, default: {} },
```

- [ ] **Step 2: Add import in server.js**

En `api-porra/server.js`, junto a los otros imports (línea 15):

```js
import { validateFasesFechas } from './api/fasesFechas.js';
```

- [ ] **Step 3: Return fasesFechas in GET /api/config**

En `server.js` GET `/api/config` (línea 408-440), añadir `fasesFechas` en los **dos** objetos `config`:

Branch sin doc (línea 416-421):
```js
        config: {
          faseJuego: 'FASE_PRETEMPORADA',
          totalMatches: 144,
          squadSize: 25,
          squadFormation: { G: 3, D: 8, M: 8, F: 6 },
          fasesFechas: {}
        }
```

Branch con doc (línea 428-433):
```js
        config: {
          faseJuego: config.faseJuego,
          totalMatches: config.tournament.totalMatches,
          squadSize: config.tournament.squadSize,
          squadFormation: config.tournament.squadFormation,
          fasesFechas: config.fasesFechas || {}
        }
```

- [ ] **Step 4: Add PUT /api/admin/fases-fechas**

En `server.js`, justo después del bloque `PUT /api/admin/config` (tras la línea 526), insertar:

```js
  // Endpoint Admin: Actualizar fechas de inicio/fin de las fases
  if (reqUrl.pathname === '/api/admin/fases-fechas' && req.method === 'PUT') {
    const admin = await verifyAdmin(req);
    if (!admin) {
      sendJson(req, res, 403, { ok: false, error: 'Acceso denegado. Se requieren permisos de administrador.' });
      return;
    }
    const body = await parseBody(req);
    if (!body || body.__error) {
      const status = body?.__error?.status || 400;
      sendJson(req, res, status, { ok: false, error: body?.__error?.error || 'Body inválido' });
      return;
    }
    const valid = validateFasesFechas(body.fasesFechas, FASES_VALIDAS);
    if (!valid.ok) {
      sendJson(req, res, 400, { ok: false, error: valid.error });
      return;
    }
    try {
      const config = await GameConfig.findByIdAndUpdate(
        'gameConfig',
        { $set: { fasesFechas: valid.fasesFechas, updatedBy: admin.username, updatedAt: new Date() } },
        { new: true, upsert: true }
      );
      sendJson(req, res, 200, {
        ok: true,
        fasesFechas: config.fasesFechas,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt
      });
    } catch (error) {
      console.error('Error actualizando fechas de fases:', error);
      sendJson(req, res, 500, { ok: false, error: 'Error interno del servidor' });
    }
    return;
  }
```

- [ ] **Step 5: Verify syntax and tests**

Run: `cd api-porra && node --test tests/fasesFechas.test.js`
Expected: PASS. Comprobar que el servidor arranca sin errores de sintaxis:
`node --check server.js` → sin salida (exit 0).

- [ ] **Step 6: Commit**

```bash
git add db/models/GameConfig.js server.js
git commit -m "feat: fasesFechas en GameConfig + GET /api/config y PUT /api/admin/fases-fechas"
```

---

### Task 3: Frontend — Módulo `js/fasesFechas.js` (lógica pura, TDD)

**Files:**
- Create: `porra-spa/js/fasesFechas.js`
- Test: `porra-spa/tests/fasesFechas.test.js`

**Interfaces:**
- Consumes: nada.
- Produces (expuestos en `window` y `module.exports`):
  - `getCountdownTarget(faseActual, fases, fasesFechas, ahora)` → `{ target, label } | null`
    - `target`: epoch ms de la fecha objetivo; `label`: string (ej. `'Fin fase actual'`, `'Inicio FASE_LIGA'`).
    - Regla 1: si `ahora` está dentro de `[inicio, fin]` de la fase actual → `target = fin`, `label = 'Fin fase actual'`.
    - Regla 2: si no, y existe fase siguiente con `inicio` y `ahora < inicio` → `target = inicio`, `label = 'Inicio <nombre>'`.
    - Regla 3: si no aplica (sin fechas, `FASE_POSTFINAL`, fechas pasadas) → `null`.
  - `formatCountdown(ms)` → string `"2d 14h 03m 25s"` (días sin cero delante, h/m/s con 2 dígitos). Si `ms <= 0` → `null`.
  - `isoToDatetimeLocal(iso)` → `"YYYY-MM-DDTHH:mm"` local para `<input type="datetime-local">`. `null`/vacío → `''`.
  - `datetimeLocalToIso(value)` → ISO string o `null` si vacío/inválido.

- [ ] **Step 1: Write the failing test**

Create `porra-spa/tests/fasesFechas.test.js`:

```js
const assert = require('assert');
const { getCountdownTarget, formatCountdown, isoToDatetimeLocal, datetimeLocalToIso } = require('../js/fasesFechas.js');

const FASES = [
  { id: 1, nombre: 'FASE_PRETEMPORADA', desc: 'Pretemporada' },
  { id: 2, nombre: 'FASE_LIGA', desc: 'Liga' },
  { id: 3, nombre: 'FASE_PRE16', desc: 'Previa Knockouts' },
  { id: 4, nombre: 'FASE_16', desc: 'Knockouts' },
  { id: 13, nombre: 'FASE_POSTFINAL', desc: 'Fin de porra' }
];

const ISO = {
  ligaIni: '2026-09-08T20:00:00.000Z',
  ligaFin: '2026-12-11T20:00:00.000Z'
};

function test_dentro_de_fase_cuenta_al_fin() {
  const t = getCountdownTarget('FASE_LIGA', FASES, { FASE_LIGA: { inicio: ISO.ligaIni, fin: ISO.ligaFin } }, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t.target, Date.parse(ISO.ligaFin));
  assert.strictEqual(t.label, 'Fin fase actual');
}

function test_antes_de_siguiente_fase_cuenta_al_inicio() {
  const t = getCountdownTarget('FASE_PRETEMPORADA', FASES, { FASE_LIGA: { inicio: ISO.ligaIni, fin: ISO.ligaFin } }, Date.parse('2026-08-15T12:00:00Z'));
  assert.strictEqual(t.target, Date.parse(ISO.ligaIni));
  assert.match(t.label, /Inicio/);
}

function test_sin_fechas_devuelve_null() {
  const t = getCountdownTarget('FASE_LIGA', FASES, {}, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_fase_postfinal_devuelve_null() {
  const t = getCountdownTarget('FASE_POSTFINAL', FASES, {}, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_antes_del_inicio_de_la_propia_fase_cuenta_al_inicio_de_siguiente() {
  // FASE_LIGA activa pero ahora < inicio de FASE_LIGA y PRE16 sin fechas → sigue regla 2 con siguiente fase (sin fechas) → null
  const t = getCountdownTarget('FASE_LIGA', FASES, { FASE_LIGA: { inicio: ISO.ligaIni, fin: ISO.ligaFin } }, Date.parse('2026-08-15T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_formatCountdown_basico() {
  // 2d 14h 03m 25s
  const ms = ((2 * 86400) + (14 * 3600) + (3 * 60) + 25) * 1000;
  assert.strictEqual(formatCountdown(ms), '2d 14h 03m 25s');
}

function test_formatCountdown_cero_o_negativo() {
  assert.strictEqual(formatCountdown(0), null);
  assert.strictEqual(formatCountdown(-5), null);
}

function test_formatCountdown_unidades_pequeñas() {
  const ms = ((0 * 86400) + (1 * 3600) + (5 * 60) + 9) * 1000;
  assert.strictEqual(formatCountdown(ms), '0d 01h 05m 09s');
}

function test_isoToDatetimeLocal_vacio() {
  assert.strictEqual(isoToDatetimeLocal(null), '');
  assert.strictEqual(isoToDatetimeLocal(''), '');
}

function test_datetimeLocalToIso_vacio() {
  assert.strictEqual(datetimeLocalToIso(''), null);
  assert.strictEqual(datetimeLocalToIso(null), null);
}

function test_datetimeLocalToIso_redondea_minutos() {
  const iso = datetimeLocalToIso('2026-09-08T20:00');
  assert.ok(iso.startsWith('2026-09-08T'));
}

const tests = [
  test_dentro_de_fase_cuenta_al_fin,
  test_antes_de_siguiente_fase_cuenta_al_inicio,
  test_sin_fechas_devuelve_null,
  test_fase_postfinal_devuelve_null,
  test_antes_del_inicio_de_la_propia_fase_cuenta_al_inicio_de_siguiente,
  test_formatCountdown_basico,
  test_formatCountdown_cero_o_negativo,
  test_formatCountdown_unidades_pequeñas,
  test_isoToDatetimeLocal_vacio,
  test_datetimeLocalToIso_vacio,
  test_datetimeLocalToIso_redondea_minutos,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd porra-spa && node tests/fasesFechas.test.js`
Expected: FAIL — `Cannot find module '../js/fasesFechas.js'`

- [ ] **Step 3: Write minimal implementation**

Create `porra-spa/js/fasesFechas.js` (patrón UMD como `js/apiData.js`):

```js
(function (global) {
  function getCountdownTarget(faseActual, fases, fasesFechas, ahora) {
    const fechas = fasesFechas || {};
    const sorted = [...(fases || [])].sort((a, b) => a.id - b.id);
    const idx = sorted.findIndex(f => f.nombre === faseActual);
    if (idx === -1) return null;
    const current = sorted[idx];
    const next = sorted[idx + 1] || null;
    const cur = fechas[current.nombre];
    const nextF = next ? fechas[next.nombre] : null;

    // Regla 1: dentro de [inicio, fin] de la fase actual → fin
    if (cur && cur.inicio && cur.fin) {
      const ini = new Date(cur.inicio).getTime();
      const fin = new Date(cur.fin).getTime();
      if (ahora >= ini && ahora < fin) {
        return { target: fin, label: 'Fin fase actual' };
      }
    }

    // Regla 2: antes del inicio de la siguiente fase → inicio
    if (next && nextF && nextF.inicio) {
      const nextIni = new Date(nextF.inicio).getTime();
      if (ahora < nextIni) {
        return { target: nextIni, label: `Inicio ${next.desc || next.nombre}` };
      }
    }

    // Regla 3: sin fechas / fase postfinal / fechas pasadas → null
    return null;
  }

  function formatCountdown(ms) {
    if (ms <= 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = n => String(n).padStart(2, '0');
    return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }

  function isoToDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function datetimeLocalToIso(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  const api = { getCountdownTarget, formatCountdown, isoToDatetimeLocal, datetimeLocalToIso };
  global.fasesFechasApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd porra-spa && node tests/fasesFechas.test.js`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add js/fasesFechas.js tests/fasesFechas.test.js
git commit -m "feat: lógica de countdown y fechas de fases (js/fasesFechas.js)"
```

---

### Task 4: Frontend — Edición admin en `showAdminModal()`

**Files:**
- Modify: `porra-spa/js/main.js` — `showAdminModal()` (~línea 2282), añadir `guardarFasesFechas`; actualizar fallback de config (~línea 302); incrementar `index.html` versión de main.js
- Modify: `porra-spa/index.html:268` (bump `main.js?v=89` → `v=90`) y añadir script `fasesFechas.js` antes de main.js

**Interfaces:**
- Consumes: `AppState.fases`, `AppState.appConfig.fasesFechas`, `fasesFechasApi` (Task 3), `fetchWithPhase`, `showToast`, `API_BASE`, `authHeaders`, `getFaseDesc`.
- Produces: función `guardarFasesFechas(fasesFechas)` que hace `PUT /api/admin/fases-fechas` y actualiza `AppState.appConfig.fasesFechas`.

- [ ] **Step 1: Update config fallback**

En `js/main.js`, en el fallback de config (línea ~302-313), añadir `fasesFechas: {}`:

```js
      AppState.appConfig = {
        championsStartRoundsDate: '2026-09-08T21:00:00Z',
        championsStartRoundsLabel: 'Fase de Grupos',
        totalMatches: 144,
        squadSize: 25,
        squadFormation: {
          G: 3,
          D: 8,
          M: 8,
          F: 6
        },
        fasesFechas: {}
      };
```

- [ ] **Step 2: Add the fases-fechas section in showAdminModal**

En `js/main.js`, dentro de `showAdminModal()`, justo después del bloque "Fase actual" (línea 2307-2309) y **antes** del botón "Cambiar Fase", insertar:

```js
      <div style="width: 100%; margin-top: 20px; text-align: left;">
        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 8px;">📅 Fechas de fases (inicio / fin)</label>
        <div id="admin-fases-fechas" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${renderAdminFasesFechas()}
        </div>
        <button id="btn-admin-save-fechas" class="btn-primary" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #fff; margin-top: 12px; width: 100%;">
          Guardar Fechas
        </button>
      </div>
```

- [ ] **Step 3: Add renderAdminFasesFechas() helper**

Añadir en `js/main.js` (función auxiliar antes de `showAdminModal`):

```js
function renderAdminFasesFechas() {
  const fechas = AppState.appConfig?.fasesFechas || {};
  return (AppState.fases || []).map(f => {
    const ff = fechas[f.nombre] || {};
    const inputStyle = 'width: 45%; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--ucl-border); background: var(--ucl-surface); color: var(--text-primary); font-size: 11px;';
    return `
      <div style="display: flex; align-items: center; gap: 6px; background: var(--ucl-surface); padding: 6px 8px; border-radius: var(--radius-sm);">
        <span style="font-size: 11px; color: var(--text-primary); font-weight: 700; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.desc || f.nombre}</span>
        <input type="datetime-local" data-fase="${f.nombre}" data-tipo="inicio" value="${isoToDatetimeLocal(ff.inicio)}" style="${inputStyle}">
        <input type="datetime-local" data-fase="${f.nombre}" data-tipo="fin" value="${isoToDatetimeLocal(ff.fin)}" style="${inputStyle}">
      </div>
    `;
  }).join('');
}
```

> Nota: `isoToDatetimeLocal` se usa como global expuesto por `fasesFechasApi` (se asigna también a `window.isoToDatetimeLocal` en Task 3). Si prefieres, desestructúralo: en el evento de guardar se usa `fasesFechasApi.datetimeLocalToIso`.

- [ ] **Step 4: Wire the save button**

En `showAdminModal()`, tras crear `manageInvitationsBtn` listener (línea ~2342), añadir:

```js
  const saveFechasBtn = modal.querySelector('#btn-admin-save-fechas');
  if (saveFechasBtn) {
    saveFechasBtn.addEventListener('click', async () => {
      const inputs = modal.querySelectorAll('#admin-fases-fechas input[type="datetime-local"]');
      const fasesFechas = {};
      inputs.forEach(inp => {
        const nombre = inp.dataset.fase;
        const tipo = inp.dataset.tipo;
        if (!fasesFechas[nombre]) fasesFechas[nombre] = { inicio: null, fin: null };
        fasesFechas[nombre][tipo] = fasesFechasApi.datetimeLocalToIso(inp.value);
      });
      try {
        const res = await fetchWithPhase(`${API_BASE}/api/admin/fases-fechas`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ fasesFechas })
        });
        const data = await res.json();
        if (data.ok) {
          AppState.appConfig.fasesFechas = data.fasesFechas;
          showToast('Fechas guardadas');
        } else {
          showToast(data.error || 'Error guardando fechas');
        }
      } catch (e) {
        showToast('Error de conexión');
      }
    });
  }
```

- [ ] **Step 5: Update index.html — script tag + cache-busting**

En `porra-spa/index.html`:
- Añadir `<script src="js/fasesFechas.js?v=1"></script>` antes de `<script src="js/main.js?v=89"></script>` (línea 268).
- Cambiar `main.js?v=89` → `main.js?v=90`.

- [ ] **Step 6: Verify**

Run: `cd porra-spa && node tests/fasesFechas.test.js` → PASS.
Comprobar en navegador (o con el servidor local `node server.mjs`) que el modal admin muestra las 13 fases con sus inputs. Abrir la SPA en `http://localhost:8080`, login como admin, pulsar el avatar → Panel de Administración.

- [ ] **Step 7: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: edición de fechas de fases en el panel admin (SPA)"
```

---

### Task 5: Frontend — Countdown en `renderInicioTab()`

**Files:**
- Modify: `porra-spa/js/main.js` — `renderInicioTab()` (~línea 3052); incrementar `index.html` main.js a `v=91`

**Interfaces:**
- Consumes: `getFaseJuego()`, `AppState.fases`, `AppState.appConfig.fasesFechas`, `fasesFechasApi.getCountdownTarget`, `fasesFechasApi.formatCountdown`.
- Produces: HTML del countdown en `inicio-container` + intervalo de 1s que actualiza el texto.

- [ ] **Step 1: Add countdown HTML helper**

Añadir en `js/main.js` una función auxiliar antes de `renderInicioTab`:

```js
function renderInicioCountdownHtml(fase, fases) {
  const fechas = AppState.appConfig?.fasesFechas || {};
  const target = fasesFechasApi.getCountdownTarget(fase, fases, fechas, Date.now());
  if (!target) return '';
  const remain = target.target - Date.now();
  return `
    <div style="text-align: right; padding: 4px 4px 0;">
      <div style="display: inline-block; text-align: left; border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 12px; padding: 8px 14px; background: rgba(245, 158, 11, 0.06);">
        <div style="font-size: 9px; color: #94A3B8; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 4px;">⏳ ${target.label}</div>
        <div id="inicio-countdown-time" style="text-align: right; color: #F59E0B; font-variant-numeric: tabular-nums; letter-spacing: 1px;">${fasesFechasApi.formatCountdown(remain)}</div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Insert countdown at top of the Inicio container**

En `renderInicioTab()`, al inicio del template de `container.innerHTML` (línea ~3102, justo antes de `${buildPointsMenuHtml(...)}`), insertar:

```js
    ${renderInicioCountdownHtml(fase, fases)}
```

- [ ] **Step 3: Start/clear the 1-second interval**

En `renderInicioTab()`, al inicio de la función (tras `const container = ...`), limpiar el intervalo previo:

```js
  if (window._inicioCountdownInterval) {
    clearInterval(window._inicioCountdownInterval);
    window._inicioCountdownInterval = null;
  }
```

Y al final de `renderInicioTab()` (tras `setupPointsMenu();`, línea ~3231), iniciar el intervalo si el countdown está visible:

```js
  const countdownEl = document.getElementById('inicio-countdown-time');
  if (countdownEl) {
    const fechas = AppState.appConfig?.fasesFechas || {};
    const target = fasesFechasApi.getCountdownTarget(fase, fases, fechas, Date.now());
    if (target) {
      window._inicioCountdownInterval = setInterval(() => {
        const remain = target.target - Date.now();
        if (remain <= 0) {
          clearInterval(window._inicioCountdownInterval);
          window._inicioCountdownInterval = null;
          renderInicioTab();
          return;
        }
        countdownEl.textContent = fasesFechasApi.formatCountdown(remain);
      }, 1000);
    }
  }
```

> El `renderInicioTab()` en el branch de `remain <= 0` re-renderiza el tab (que limpiará el intervalo viejo y empezará el siguiente hito, o dejará de mostrar el countdown).

- [ ] **Step 4: Bump cache-busting**

En `porra-spa/index.html`: `main.js?v=90` → `main.js?v=91`.

- [ ] **Step 5: Verify**

Run: `cd porra-spa && node tests/fasesFechas.test.js` → PASS.
Prueba manual con `node server.mjs` → abrir `http://localhost:8080`: el countdown dorado aparece debajo de la cabecera, a la derecha, se actualiza cada segundo y cumple las reglas (dentro de fase → fin; en pretemporada con FASE_LIGA con inicio → inicio; sin fechas → no aparece). Probar `FASE_POSTFINAL` y fases sin fechas: no debe mostrarse.

- [ ] **Step 6: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: countdown de fin/inicio de fase en el tab Inicio"
```

---

### Task 6: Documentación

**Files:**
- Modify: `api-porra/AGENTS.md` (sección API Endpoints + modelo GameConfig)
- Modify: `porra-spa/AGENTS.md` (sección AppState + API del backend)
- Modify: `porra-spa/data/README.md` (si aplica)

**Interfaces:**
- Consumes: los cambios de las Tasks 1-5.

- [ ] **Step 1: Update api-porra/AGENTS.md**

- En la tabla de endpoints de Administración, añadir fila:
  `| PUT | /api/admin/fases-fechas | Actualizar fechas de inicio/fin de las fases (fasesFechas) |`
- En la sección Configuración / GET /api/config, añadir `fasesFechas` al JSON de ejemplo.
- En la descripción del modelo `GameConfig` (si existe), mencionar el campo nuevo.

- [ ] **Step 2: Update porra-spa/AGENTS.md**

- En la sección API del backend, añadir:
  `PUT /api/admin/fases-fechas   // Body: { fasesFechas } — actualizar fechas de fases (admin)`
- En AppState, documentar que `appConfig.fasesFechas` contiene `{ FASE_X: { inicio, fin } }`.
- En el apartado del tab Inicio / countdown, describir brevemente el countdown dorado debajo de la cabecera.

- [ ] **Step 3: Verify**

Comprobar que no quedan referencias a `fasesFechas` sin documentar y que los ejemplos JSON son coherentes con la implementación.

- [ ] **Step 4: Commit (por cada repo)**

```bash
# api-porra
git add AGENTS.md
git commit -m "docs: documentar fasesFechas y endpoint /api/admin/fases-fechas"

# porra-spa
git add AGENTS.md
git commit -m "docs: documentar fasesFechas en AppState y countdown del Inicio"
```

---

## Self-Review

**Spec coverage:**
- Backend: campo `fasesFechas` en GameConfig ✓ (Task 2), `GET /api/config` lo devuelve ✓ (Task 2), `PUT /api/admin/fases-fechas` ✓ (Task 2), validación de claves e `inicio < fin` ✓ (Task 1).
- Frontend: sección en `showAdminModal` ✓ (Task 4), countdown debajo de la cabecera a la derecha ✓ (Task 5), lógica de countdown por faseJuego con reglas acordadas ✓ (Task 3), sin caché ✓ (no implementado, como decidido).
- Tests: backend `node:test` ✓ (Task 1), frontend runner manual ✓ (Task 3).

**Placeholder scan:** sin TBD/TODO; todos los pasos tienen código concreto.

**Type consistency:** `validateFasesFechas` devuelve `{ ok, fasesFechas | error }` en backend; `getCountdownTarget` devuelve `{ target, label } | null` y `formatCountdown(ms)` string|null en frontend; `isoToDatetimeLocal`/`datetimeLocalToIso` consistentes entre Tasks 3 y 4. `fasesFechasApi` se expone en `window` y via `module.exports`.
