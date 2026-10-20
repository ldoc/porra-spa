# Live v2 — Botón 🎯 para seguir mi fila

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un toggle persistente en la cabecera del Live que centra la fila del usuario logueado y la mantiene centrada tras cada actualización.

**Architecture:** Todo front-end. La preferencia vive en `localStorage`; el centrado calcula el `scrollTop` sobre `.resultados-scroll` a partir de `getBoundingClientRect` y lo aplica con `scrollTo` (suave salvo reduced-motion). Se engancha al render inicial y al final de `updateLiveV2Dom`.

**Tech Stack:** Vanilla JS (IIFE + `window`/`module.exports`), CSS3, `node:test`.

## Global Constraints

- Sin frameworks ni dependencias nuevas.
- Tests: `node --test tests/*.test.js`.
- Rama: `feature/live-v2`.
- Cache-busting: subir `js/live-v2-ui.js?v=` y `css/styles.css?v=` en `index.html`.
- Mantener layout móvil vertical y objetivos táctiles ≥44 px.
- No tocar archivos ajenos (`sounds/`, `sounds2/` untracked).
- Sin cambios en `api-porra`.

---

### Task 1: Persistencia y botón 🎯

**Files:**
- Modify: `js/live-v2-ui.js` (helpers de follow, `renderLiveV2Html`, `updateLiveV2Dom`, bindings)
- Modify: `js/main.js` (binding del toggle)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Produces: `liveV2FollowEnabled()`, `setLiveV2FollowEnabled(v)`, `liveV2FollowToggleHtml()`, `updateLiveV2FollowToggle(root)`, `bindLiveV2FollowToggle(root)`.
- Clave: `porra_live_follow_me` (`'1'`/`'0'`), por defecto off.

- [ ] **Step 1: Write the failing tests**

```js
test('liveV2FollowToggleHtml oculto sin usuario', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: null, currentUser: null }, liveV2Api: {} });
  assert.equal(ui.liveV2FollowToggleHtml(), '');
});

test('liveV2FollowToggleHtml refleja el estado persistido', () => {
  const prev = global.localStorage;
  const store = {};
  global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  try {
    const ui = freshUi();
    ui.init({ AppState: { liveV2: null, currentUser: { name: 'ana' } }, liveV2Api: {} });
    assert.match(ui.liveV2FollowToggleHtml(), /aria-pressed="false"/);
    ui.setLiveV2FollowEnabled(true);
    assert.match(ui.liveV2FollowToggleHtml(), /aria-pressed="true"/);
    assert.match(ui.liveV2FollowToggleHtml(), /class="livev2-follow on"/);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL (funciones no existen).

- [ ] **Step 3: Implement**

```js
const LIVEV2_FOLLOW_KEY = 'porra_live_follow_me';

function liveV2FollowEnabled() {
  try { return global.localStorage && global.localStorage.getItem(LIVEV2_FOLLOW_KEY) === '1'; }
  catch (e) { return false; }
}

function setLiveV2FollowEnabled(v) {
  try { global.localStorage && global.localStorage.setItem(LIVEV2_FOLLOW_KEY, v ? '1' : '0'); }
  catch (e) { /* sin storage */ }
}

function liveV2FollowToggleHtml() {
  if (!AppState || !AppState.currentUser) return '';
  const on = liveV2FollowEnabled();
  return `<button type="button" id="livev2-follow-toggle" class="livev2-follow${on ? ' on' : ''}"`
    + ` aria-pressed="${on ? 'true' : 'false'}"`
    + ` aria-label="${on ? 'Dejar de seguir mi fila' : 'Seguir mi fila'}">🎯</button>`;
}

function updateLiveV2FollowToggle(root) {
  const btn = (root || document).querySelector('#livev2-follow-toggle');
  if (!btn) return;
  const on = liveV2FollowEnabled();
  btn.textContent = '🎯';
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? 'Dejar de seguir mi fila' : 'Seguir mi fila');
}

function bindLiveV2FollowToggle(root) {
  const btn = (root || document).querySelector('#livev2-follow-toggle');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    const on = !liveV2FollowEnabled();
    setLiveV2FollowEnabled(on);
    updateLiveV2FollowToggle(root);
    if (on) liveV2CenterMe();
  });
}
```

- En `renderLiveV2Html`, dentro de `.livev2-status-right`, añadir
  `liveV2FollowToggleHtml()` después de `liveV2CountdownHtml()` y antes de los
  puntos.
- En `updateLiveV2Dom`, junto a `updateLiveV2SoundToggle(root)`, añadir
  `updateLiveV2FollowToggle(root)`.
- Enlazar en `js/live-v2-ui.js:978-979` y `js/main.js:2041-2042`:
  `bindLiveV2FollowToggle(target)` / `liveV2Ui.bindLiveV2FollowToggle(container)`.
- Añadir los helpers a los exports.

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js js/main.js tests/liveV2Ui.test.js
git commit -m "feat(live): boton persistente para seguir mi fila"
```

---

### Task 2: Centrado de la fila propia

**Files:**
- Modify: `js/live-v2-ui.js` (`liveV2CenterTarget`, `liveV2CenterMe`, hooks)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2FollowEnabled`, `liveV2PrefersReducedMotion`, `AppState.currentUser`, `[data-livev2-row]`, `.resultados-scroll`.
- Produces: `liveV2CenterTarget({ scrollTop, rowTop, rowHeight, viewportHeight, scrollHeight })` → número; `liveV2CenterMe()`.

- [ ] **Step 1: Write the failing test**

```js
test('liveV2CenterTarget centra y hace clamp en los extremos', () => {
  assert.equal(liveV2CenterTarget({
    scrollTop: 0, rowTop: 200, rowHeight: 50, viewportHeight: 400, scrollHeight: 1000
  }), 25);
  assert.equal(liveV2CenterTarget({
    scrollTop: 0, rowTop: 10, rowHeight: 50, viewportHeight: 400, scrollHeight: 1000
  }), 0);
  assert.equal(liveV2CenterTarget({
    scrollTop: 800, rowTop: 300, rowHeight: 50, viewportHeight: 400, scrollHeight: 1000
  }), 600);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
function liveV2CenterTarget({ scrollTop, rowTop, rowHeight, viewportHeight, scrollHeight }) {
  const target = scrollTop + rowTop + rowHeight / 2 - viewportHeight / 2;
  const max = Math.max(0, scrollHeight - viewportHeight);
  return Math.max(0, Math.min(max, target));
}

function liveV2CenterMe() {
  if (!liveV2FollowEnabled() || typeof document === 'undefined') return;
  const me = AppState && AppState.currentUser && AppState.currentUser.name;
  if (!me) return;
  let rowEl = null;
  document.querySelectorAll('[data-livev2-row]').forEach(el => {
    if (el.getAttribute('data-livev2-row') === me) rowEl = el;
  });
  if (!rowEl) return;
  const scroller = rowEl.closest('.resultados-scroll') || document.querySelector('.resultados-scroll');
  if (!scroller) return;
  const sRect = scroller.getBoundingClientRect();
  const rRect = rowEl.getBoundingClientRect();
  const top = liveV2CenterTarget({
    scrollTop: scroller.scrollTop,
    rowTop: rRect.top - sRect.top,
    rowHeight: rRect.height,
    viewportHeight: scroller.clientHeight,
    scrollHeight: scroller.scrollHeight
  });
  const behavior = liveV2PrefersReducedMotion() ? 'auto' : 'smooth';
  try { scroller.scrollTo({ top, behavior }); } catch (e) { scroller.scrollTop = top; }
}
```

- Al final de `updateLiveV2Dom` (después del motivo/animación), añadir
  `liveV2CenterMe()`.
- En el arranque del render inicial (`startLiveV2Polling`), junto al rAF del
  countdown, añadir `liveV2CenterMe()`:
  ```js
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => { liveV2UpdateCountdown(); liveV2CenterMe(); });
  } else {
    setTimeout(() => { liveV2UpdateCountdown(); liveV2CenterMe(); }, 0);
  }
  ```
- Añadir `liveV2CenterTarget`/`liveV2CenterMe` a los exports.

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live): centra mi fila y la sigue en cada poll"
```

---

### Task 3: Estilos, cache-busters y verificación

**Files:**
- Modify: `css/styles.css`
- Modify: `index.html`
- Test: suite + manual

- [ ] **Step 1: CSS**

```css
.livev2-follow {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s, color 0.2s;
}
.livev2-follow.on { color: var(--accent-primary); }
.livev2-follow:active { transform: scale(0.92); }
```

- [ ] **Step 2: Cache-busters**

Subir `js/live-v2-ui.js?v=` y `css/styles.css?v=` en `index.html`.

- [ ] **Step 3: Suite y checks**

Run: `node --test tests/*.test.js`
Expected: PASS.
Run: `node --check js/live-v2-ui.js && node --check js/main.js`
Expected: sin errores.

- [ ] **Step 4: Prueba manual**

Con el simulador y `http://localhost:8080/?liveSim=1` → Resultados → Live:
- Sin sesión: el 🎯 no aparece.
- Activar: tu fila queda centrada.
- Dejar pasar un poll: sigue centrada.
- Hacer scroll manual: el siguiente poll te recentra.
- Desactivar: deja de seguir.
- Recargar: recuerda el estado.
- 360 px: la fila de estado no desborda (si aprieta, reducir gaps, no el área táctil).

- [ ] **Step 5: Commit**

```bash
git add css/styles.css index.html
git commit -m "style(live): boton de seguimiento y cache-busters"
```

---

## Verificación final

- [ ] `node --test tests/*.test.js` verde.
- [ ] `node --check` de los JS tocados.
- [ ] Cache-busters de `live-v2-ui.js` y `styles.css`.
- [ ] Manual: centrar, seguir en polls, scroll manual, desactivar, persistencia y 360 px.
