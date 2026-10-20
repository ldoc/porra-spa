# Live v2 — Sonidos por efecto, countdown y motivo real

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Live suene según el efecto real de cada evento en tus puntos, muestre un countdown circular del próximo poll y explique el cambio de posición con los eventos que de verdad movieron tus puntos.

**Architecture:** Todo front-end. Se calcula el delta de puntos del usuario por partido/evento plegando los eventos antes y después; el sonido usa el efecto neto por partido/poll y el motivo usa la lista de eventos con delta ≠ 0 (máx. 3 + total). El countdown es un anillo SVG actualizado por un timer único.

**Tech Stack:** Vanilla JS (IIFE + `window`/`module.exports`), CSS3, `node:test`.

## Global Constraints

- Sin frameworks ni dependencias nuevas.
- Tests: `node --test tests/*.test.js`.
- Rama: `feature/live-v2`.
- Cache-busting: subir `?v=` en `index.html` de cada JS/CSS tocado.
- Mantener layout móvil vertical y objetivos táctiles ≥44 px.
- No tocar archivos ajenos (`sounds/`, `sounds2/` untracked).
- Los tonos v1 se conservan; solo se añade el malo.
- El sonido y el motivo comparten el cálculo por evento.

---

### Task 1: Tono malo y selección por calidad en `sound.js`

**Files:**
- Modify: `js/sound.js:4-21`
- Test: `tests/sound.test.js` (crear)

**Interfaces:**
- Produces: `eventToTone(event, quality)` donde `quality` es `'good' | 'bad' | 'neutral'` (compatibilidad: `true` = good, `false` = neutral).

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const sound = require('../js/sound.js');

test('eventToTone goal good/bad/neutral', () => {
  assert.deepEqual(sound.eventToTone({ type: 'goal' }, 'good'),
    { freqs: [523, 659, 784], durationMs: 120, vibrateMs: 200 });
  assert.deepEqual(sound.eventToTone({ type: 'goal' }, 'bad'),
    { freqs: [392, 311], durationMs: 140, vibrateMs: 120 });
  assert.deepEqual(sound.eventToTone({ type: 'goal' }, 'neutral'),
    { freqs: [440, 440], durationMs: 120, vibrateMs: 0 });
  assert.deepEqual(sound.eventToTone({ type: 'goal' }, true),
    sound.eventToTone({ type: 'goal' }, 'good'));
  assert.deepEqual(sound.eventToTone({ type: 'goal' }, false),
    sound.eventToTone({ type: 'goal' }, 'neutral'));
});

test('rank y status conservan los tonos v1', () => {
  assert.deepEqual(sound.eventToTone({ type: 'rankUp' }, true),
    { freqs: [392, 523], durationMs: 110, vibrateMs: 100 });
  assert.deepEqual(sound.eventToTone({ type: 'rankDown' }, false),
    { freqs: [330, 262], durationMs: 110, vibrateMs: 0 });
  assert.deepEqual(sound.eventToTone({ type: 'status' }, true),
    { freqs: [660], durationMs: 100, vibrateMs: 0 });
});

test('playLiveEvent desactivado no reproduce', () => {
  let plays = 0;
  sound.playLiveEvent({ type: 'goal' }, 'good', { enabled: false, ctx: { play: () => plays++ } });
  assert.equal(plays, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sound.test.js`
Expected: FAIL (el tono malo no existe; `quality` no se interpreta).

- [ ] **Step 3: Implement**

```js
function eventToTone(event, quality) {
  switch (event.type) {
    case 'goal':
      if (quality === 'bad') return { freqs: [392, 311], durationMs: 140, vibrateMs: 120 };
      if (quality === 'good' || quality === true) {
        return { freqs: [523, 659, 784], durationMs: 120, vibrateMs: 200 };
      }
      return { freqs: [440, 440], durationMs: 120, vibrateMs: 0 };
    case 'status':
    case 'start':
    case 'end':
      return { freqs: [660], durationMs: 100, vibrateMs: 0 };
    case 'rankUp':
      return { freqs: [392, 523], durationMs: 110, vibrateMs: 100 };
    case 'rankDown':
      return { freqs: [330, 262], durationMs: 110, vibrateMs: 0 };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/sound.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/sound.js tests/sound.test.js
git commit -m "feat(live): tono malo y calidad good/bad/neutral"
```

---

### Task 2: Delta de puntos por evento y sonido por efecto neto

**Files:**
- Modify: `js/live-v2-ui.js` (helpers y `liveV2PlayNewEventSounds`, ~211-253)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2Api.foldMatch`, `applyEvent`, `matchStateToStats`, `eventKey`; `liveUserMatchPoints`, `liveV2CtxById`, `liveV2PlayersById`, `liveV2PlayheadMs`, `liveMatchMeta`.
- Produces:
  - `liveV2EventDeltas(username, eventId, newEvents, allEvents, ctx, playersById, serverNow)` → `{ events: [{ event, delta }], before, after }`.
  - `liveV2SoundQuality(delta, hasGoal)` → `'good' | 'bad' | 'neutral' | null`.

- [ ] **Step 1: Write the failing tests**

Añadir a `tests/liveV2Ui.test.js` (usa el `init` ya existente):

```js
test('liveV2SoundQuality good/bad/neutral/null', () => {
  assert.equal(liveV2SoundQuality(2, true), 'good');
  assert.equal(liveV2SoundQuality(-1, true), 'bad');
  assert.equal(liveV2SoundQuality(0, true), 'neutral');
  assert.equal(liveV2SoundQuality(0, false), null);
});

test('liveV2EventDeltas atribuye gol (+8 pronóstico +1 plantilla) y asistencia (+1)', () => {
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    liveV2: null,
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [
      { id: 13, nombre: 'F', posicion: 'F', equipo: 1 },
      { id: 12, nombre: 'M', posicion: 'M', equipo: 1 }
    ],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [{ id: 13, posicion: 'F', equipo: 1 }, { id: 12, posicion: 'M', equipo: 1 }] },
    matchStats: []
  };
  init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: (pred, ms) => ({ points: Number(ms.stats[1]?.goles) === 1 ? 8 : 0 }),
    calculatePlayerMatchPoints: (jd) => ({ total: (jd.goles || 0) + (jd.asistencias || 0) })
  });
  const t = '2026-09-16T20:30:00.000Z';
  const goal = { eventId: 1, type: 'goal', minute: 30, ts: t, ingestedAt: t, seq: 0, sourceId: 'g', payload: { scorerId: 13, isHome: true } };
  const assist = { eventId: 1, type: 'assist', minute: 30, ts: t, ingestedAt: t, seq: 1, sourceId: 'a', playerId: 12, payload: { asistencias: 1 } };
  const res = liveV2EventDeltas('me', 1, [goal, assist], [goal, assist],
    { homeTeamId: 1, awayTeamId: 2 },
    { 13: { nombre: 'F', posicion: 'F', equipo: 1 }, 12: { nombre: 'M', posicion: 'M', equipo: 1 } },
    null);
  assert.equal(res.before, 0);
  assert.equal(res.after, 9);
  assert.deepEqual(res.events.map(d => d.delta), [9, 1]);
});
```

Añadir `liveV2SoundQuality`/`liveV2EventDeltas` a la desestructuración de `require('../js/live-v2-ui.js')` al inicio del archivo y a los exports del módulo.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL (`liveV2SoundQuality`/`liveV2EventDeltas` no existen).

- [ ] **Step 3: Implement**

Añadir en `js/live-v2-ui.js`:

```js
function liveV2EventDeltas(username, eventId, newEvents, allEvents, ctx, playersById, serverNow) {
  const id = String(eventId);
  const newFor = (newEvents || []).filter(e => String(e.eventId) === id);
  if (!newFor.length) return { events: [], before: 0, after: 0 };
  const newKeys = new Set(newFor.map(e => liveV2Api.eventKey(e)));
  const allFor = (allEvents || []).filter(e => String(e.eventId) === id);
  const beforeEvents = allFor.filter(e => !newKeys.has(liveV2Api.eventKey(e)));
  const state = liveV2Api.foldMatch(beforeEvents, ctx || {});
  const meta = liveMatchMeta({ eventId: id });
  const fullCtx = { ...(ctx || {}), playersById };
  const pointsOf = (s) => liveUserMatchPoints(username, {
    eventId: id,
    stats: liveV2Api.matchStateToStats(s, fullCtx, serverNow)
  }, meta).total;
  const before = pointsOf(state);
  let prev = before;
  const out = [];
  for (const ev of newFor) {
    liveV2Api.applyEvent(state, ev, ctx || {});
    const now = pointsOf(state);
    if (now !== prev) out.push({ event: ev, delta: now - prev });
    prev = now;
  }
  return { events: out, before, after: prev };
}

function liveV2SoundQuality(delta, hasGoal) {
  if (delta > 0) return 'good';
  if (delta < 0) return 'bad';
  if (hasGoal) return 'neutral';
  return null;
}
```

Sustituir `liveV2PlayNewEventSounds` por:

```js
function liveV2PlayNewEventSounds(newEvents) {
  if (!newEvents || !newEvents.length) return;
  if (typeof liveV2Api === 'undefined') return;
  const me = AppState.currentUser && AppState.currentUser.name;
  if (!me) return;
  const deps = liveV2SoundDeps();
  if (!deps) return;
  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const serverNow = liveV2PlayheadMs(st);
  const finalized = new Set((AppState.matchStats || []).map(ms => String(ms.eventId)));
  const byMatch = {};
  for (const ev of newEvents) (byMatch[String(ev.eventId)] = byMatch[String(ev.eventId)] || []).push(ev);
  for (const [id, events] of Object.entries(byMatch)) {
    if (finalized.has(id)) continue;
    const res = liveV2EventDeltas(me, id, events, st.events, ctxById[id] || {}, playersById, serverNow);
    const quality = liveV2SoundQuality(res.after - res.before, events.some(e => e.type === 'goal'));
    if (!quality) continue;
    soundApi.playLiveEvent({ type: 'goal' }, quality, deps);
  }
}
```

Eliminar `liveV2GoalIsMine` si queda sin usos. Añadir `liveV2EventDeltas` y `liveV2SoundQuality` al objeto `api` exportado.

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live): sonido por delta de puntos de cualquier evento"
```

---

### Task 3: Motivo con los eventos reales (hasta 3 + total)

**Files:**
- Modify: `js/live-v2-ui.js` (`liveV2MoverReason`, `liveV2ShowReason`, helpers; ~1040-1100)
- Modify: `js/liveV2.js` (`reasonLabel`, añadir `card`)
- Modify: `css/styles.css` (`.livev2-reason-*`)
- Test: `tests/liveV2Ui.test.js`, `tests/liveV2.test.js`

**Interfaces:**
- Consumes: `liveV2EventDeltas`, `liveV2Api.liveV2ReasonForEvent`, `liveV2DeltaText`, `liveV2Esc`.
- Produces:
  - `liveV2TopContributions(list, limit = 3)` → array ordenado por `|delta|`.
  - `liveV2ReasonLine(ev, delta)` → `{ icon, text, delta } | null`.
  - `liveV2ReasonHtml(reason)` → HTML con líneas + `+N más` + total.
  - `liveV2MoverReason(...)` devuelve `{ name, rankDelta, pointsDelta, lines, total, more }`.

- [ ] **Step 1: Write the failing tests**

```js
test('liveV2TopContributions ordena por impacto y limita a 3', () => {
  const list = [{ delta: 1 }, { delta: -5 }, { delta: 3 }, { delta: 2 }];
  assert.deepEqual(liveV2TopContributions(list, 3).map(x => x.delta), [-5, 3, 2]);
});

test('liveV2ReasonHtml pinta varias lineas, +N mas y total', () => {
  const html = liveV2ReasonHtml({
    lines: [
      { icon: '⚽', text: 'Gol de X', delta: 8 },
      { icon: '🅰️', text: 'Asistencia de Y', delta: 1 }
    ],
    more: 2,
    total: 9
  });
  assert.match(html, /Gol de X/);
  assert.match(html, /Asistencia de Y/);
  assert.match(html, /\+2 más/);
  assert.match(html, /Total/);
});
```

Añadir en `tests/liveV2.test.js`:

```js
test('reasonLabel cubre tarjeta', () => {
  const label = liveV2.reasonLabel({ type: 'card', minute: 80, payload: { cardType: 'red' } }, { delta: -2 });
  assert.ok(label);
  assert.equal(label.delta, -2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/liveV2Ui.test.js tests/liveV2.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

En `js/live-v2-ui.js`:

```js
function liveV2TopContributions(list, limit = 3) {
  return [...(list || [])].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}

function liveV2ReasonLine(ev, delta) {
  const label = liveV2Api.liveV2ReasonForEvent
    ? liveV2Api.liveV2ReasonForEvent(ev, liveV2PlayersById(), delta)
    : liveV2Api.reasonLabel(ev, { delta });
  return label ? { icon: label.icon, text: label.text, delta } : null;
}

function liveV2ReasonHtml(reason) {
  const lines = (reason.lines || []).map(l =>
    `<div class="livev2-reason-line">${l.icon} ${liveV2Esc(l.text)} <b>${liveV2DeltaText(l.delta)}</b></div>`
  ).join('');
  const more = reason.more ? `<div class="livev2-reason-more">+${reason.more} más</div>` : '';
  const total = `<div class="livev2-reason-total">Total <b>${liveV2DeltaText(reason.total)}</b></div>`;
  return lines + more + total;
}
```

En `liveV2MoverReason`, antes del fallback actual:

```js
  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const serverNow = liveV2PlayheadMs(st);
  const finalized = new Set((AppState.matchStats || []).map(ms => String(ms.eventId)));
  const byMatch = {};
  for (const ev of newEvents || []) (byMatch[String(ev.eventId)] = byMatch[String(ev.eventId)] || []).push(ev);
  const contributions = [];
  for (const [id, events] of Object.entries(byMatch)) {
    if (finalized.has(id)) continue;
    const res = liveV2EventDeltas(pick.name, id, events, st.events, ctxById[id] || {}, playersById, serverNow);
    for (const d of res.events) contributions.push(d);
  }
  if (contributions.length) {
    const top = liveV2TopContributions(contributions, 3);
    const lines = top.map(d => liveV2ReasonLine(d.event, d.delta)).filter(Boolean);
    if (lines.length) {
      return { name: pick.name, rankDelta: pick.rankDelta, pointsDelta: pick.pointsDelta,
        lines, total: pick.pointsDelta, more: Math.max(0, contributions.length - top.length) };
    }
  }
```

El fallback existente (`evByUser[pick.name] || newestRelevant`) debe devolver el mismo shape:

```js
  const ev = evByUser[pick.name] || newestRelevant;
  if (!ev) return null;
  const attributableDelta = (newEvents || []).length === 1 ? pick.pointsDelta : 0;
  const label = liveV2Api.liveV2ReasonForEvent
    ? liveV2Api.liveV2ReasonForEvent(ev, liveV2PlayersById(), attributableDelta)
    : liveV2Api.reasonLabel(ev, { delta: attributableDelta });
  if (!label) return null;
  return { name: pick.name, rankDelta: pick.rankDelta, pointsDelta: attributableDelta,
    lines: [label], total: attributableDelta, more: 0 };
```

`liveV2ShowReason` renderiza el HTML:

```js
function liveV2ShowReason(container, rowEl, reason) {
  if (!container || !rowEl || !reason) return;
  container.querySelectorAll('.livev2-reason').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'livev2-reason' + (reason.total < 0 ? ' neg' : '');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = liveV2ReasonHtml(reason);
  el.style.top = (rowEl.offsetTop + rowEl.offsetHeight + 4) + 'px';
  container.appendChild(el);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => el.classList.add('show'));
  else el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 320); }, LIVEV2_REASON_MS);
}
```

En `updateLiveV2Dom`, cambiar `liveV2ShowReason(container, rowEl, mover.label)` por `liveV2ShowReason(container, rowEl, mover)`.

En `js/liveV2.js` `reasonLabel`, añadir:

```js
      case 'card': return {
        icon: (event.payload?.cardType === 'red' || event.payload?.cardType === 'yellowRed') ? '🟥' : '🟨',
        text: `${min}${(event.payload?.cardType === 'red' || event.payload?.cardType === 'yellowRed') ? 'Roja' : 'Tarjeta'}`,
        delta: d
      };
```

CSS:

```css
.livev2-reason { white-space: normal; max-width: min(320px, calc(100vw - 32px)); line-height: 1.35; }
.livev2-reason-line { display: flex; gap: 4px; align-items: center; }
.livev2-reason-line b { margin-left: auto; }
.livev2-reason-more { font-size: 9px; opacity: 0.75; }
.livev2-reason-total { margin-top: 2px; border-top: 1px solid var(--border-color); padding-top: 2px; font-weight: 700; }
```

Añadir `liveV2TopContributions`, `liveV2ReasonLine` y `liveV2ReasonHtml` a los exports.

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2Ui.test.js tests/liveV2.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js js/liveV2.js css/styles.css tests/liveV2Ui.test.js tests/liveV2.test.js
git commit -m "feat(live): motivo con los eventos reales y su delta"
```

---

### Task 4: Countdown circular del poll (anillo C)

**Files:**
- Modify: `js/live-v2-ui.js` (`renderLiveV2Html`, `startLiveV2Polling`, `stopLiveV2Polling`, helpers)
- Modify: `css/styles.css`
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Produces:
  - `liveV2CountdownState(elapsedMs, intervalMs, { polling, paused })` → `{ seconds, progress, label, polling, paused }`.
  - `liveV2CountdownHtml()` → HTML del anillo.

- [ ] **Step 1: Write the failing tests**

```js
test('liveV2CountdownState calcula segundos, progreso y estados', () => {
  assert.deepEqual(liveV2CountdownState(0, 30000, {}), { seconds: 30, progress: 1, label: '30s', polling: false, paused: false });
  assert.deepEqual(liveV2CountdownState(15000, 30000, {}), { seconds: 15, progress: 0.5, label: '15s', polling: false, paused: false });
  assert.equal(liveV2CountdownState(0, 30000, { polling: true }).label, '…');
  assert.equal(liveV2CountdownState(0, 30000, { paused: true }).label, '—');
});

test('liveV2CountdownHtml incluye anillo y numero', () => {
  const html = liveV2CountdownHtml();
  assert.match(html, /livev2-countdown/);
  assert.match(html, /livev2-countdown-num/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
function liveV2CountdownState(elapsedMs, intervalMs, opts = {}) {
  const total = Math.max(1, intervalMs || 1);
  const elapsed = Math.max(0, elapsedMs || 0);
  const remaining = Math.max(0, total - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  const progress = Math.max(0, Math.min(1, remaining / total));
  if (opts.paused) return { seconds: 0, progress: 0, label: '—', polling: false, paused: true };
  if (opts.polling) return { seconds, progress, label: '…', polling: true, paused: false };
  return { seconds, progress, label: `${seconds}s`, polling: false, paused: false };
}

function liveV2CountdownHtml() {
  const r = 8;
  const c = 2 * Math.PI * r;
  return `<span class="livev2-countdown" id="livev2-countdown" role="status" aria-live="off" aria-label="Próxima actualización">`
    + `<svg viewBox="0 0 20 20" aria-hidden="true">`
    + `<circle class="livev2-countdown-track" cx="10" cy="10" r="${r}"></circle>`
    + `<circle class="livev2-countdown-progress" cx="10" cy="10" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"></circle>`
    + `</svg><span class="livev2-countdown-num">—</span></span>`;
}
```

En `renderLiveV2Html`, añadir `liveV2CountdownHtml()` al principio de `.livev2-status-right`.

Timer:

```js
let _liveV2CountdownTimer = null;
let _liveV2CountdownStart = 0;
let _liveV2CountdownPaused = false;

function liveV2UpdateCountdown() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('livev2-countdown');
  if (!el) return;
  const st = liveV2State();
  const intervalMs = (AppState.liveRefreshSecs || 30) * 1000;
  const state = liveV2CountdownState(Date.now() - _liveV2CountdownStart, intervalMs,
    { polling: st.polling, paused: _liveV2CountdownPaused });
  const num = el.querySelector('.livev2-countdown-num');
  const prog = el.querySelector('.livev2-countdown-progress');
  if (num) num.textContent = state.label;
  if (prog) prog.style.strokeDashoffset = String(2 * Math.PI * 8 * (1 - state.progress));
  el.classList.toggle('paused', state.paused);
  el.classList.toggle('polling', state.polling);
  el.setAttribute('aria-label', state.paused
    ? 'Actualización en pausa'
    : `Próxima actualización en ${state.seconds} segundos`);
}
```

- En `startLiveV2Polling`: `_liveV2CountdownStart = Date.now(); _liveV2CountdownPaused = false; if (_liveV2CountdownTimer) clearInterval(_liveV2CountdownTimer); _liveV2CountdownTimer = setInterval(liveV2UpdateCountdown, 1000); liveV2UpdateCountdown();`
- En el callback del intervalo: si `!liveV2ShouldPoll(...)`, `_liveV2CountdownPaused = true; liveV2UpdateCountdown(); return;`; si va a poll, `_liveV2CountdownStart = Date.now(); _liveV2CountdownPaused = false;`.
- En `pollLiveV2` (inicio) y `retryLiveV2`: `_liveV2CountdownStart = Date.now(); _liveV2CountdownPaused = false; liveV2UpdateCountdown();`.
- En `stopLiveV2Polling`: `if (_liveV2CountdownTimer) { clearInterval(_liveV2CountdownTimer); _liveV2CountdownTimer = null; }`.
- En el handler de visibilidad: al volver visible, reset del start.

CSS:

```css
.livev2-countdown { display: inline-flex; align-items: center; gap: 3px; height: 20px; }
.livev2-countdown svg { width: 20px; height: 20px; transform: rotate(-90deg); }
.livev2-countdown-track { fill: none; stroke: var(--border-color); stroke-width: 2.5; }
.livev2-countdown-progress { fill: none; stroke: var(--accent-primary); stroke-width: 2.5; stroke-linecap: round; transition: stroke-dashoffset 0.9s linear; }
.livev2-countdown-num { font-size: 9px; font-weight: 700; color: var(--text-secondary); min-width: 14px; text-align: center; }
.livev2-countdown.paused .livev2-countdown-progress { stroke: var(--text-muted); }
.livev2-countdown.paused .livev2-countdown-num { color: var(--text-muted); }
.livev2-countdown.polling .livev2-countdown-progress { stroke: var(--accent-gold); }
```

Añadir `liveV2CountdownState` y `liveV2CountdownHtml` a los exports.

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js css/styles.css tests/liveV2Ui.test.js
git commit -m "feat(live): countdown circular del proximo poll"
```

---

### Task 5: Integración, cache-busters y verificación manual

**Files:**
- Modify: `index.html` (versiones)
- Test: verificación manual + suite

- [ ] **Step 1: Bump de versiones**

Subir `?v=` en `index.html` para `js/sound.js`, `js/live-v2-ui.js`, `js/liveV2.js` (si se tocó) y `css/styles.css`.

- [ ] **Step 2: Suite completa**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 3: `node --check`**

Run: `node --check js/sound.js && node --check js/liveV2.js && node --check js/live-v2-ui.js`
Expected: sin errores.

- [ ] **Step 4: Prueba manual con el simulador**

1. API: `cd ../api-porra && node server.js`
2. Front: `cd ../porra-spa && node server.mjs`
3. Simulador: `cd ../api-porra && node --env-file=.env scripts/simulateLiveEvents.js --auto 5 --tick 10`
4. Abrir `http://localhost:8080/?liveSim=1` → Resultados → Live.

Comprobar:
- Gol que sube puntos → tono bueno y motivo con el gol y su delta.
- Gol que baja puntos → tono malo y motivo con delta negativo.
- Gol neutro → tono neutro; no-gol neutro → silencio y sin línea.
- Asistencia/penalti/nota que mueve puntos → sonido y motivo.
- Varios eventos → hasta 3 líneas + total.
- Anillo: baja de 30 a 0, se reinicia, pausa fuera de ventana y se limpia al salir.
- Toggle 🔔 off → silencio.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "chore(live): cache-busters de sonido, motivo y countdown"
```

---

## Verificación final

- [ ] `node --test tests/*.test.js` verde.
- [ ] `node --check` de los JS tocados.
- [ ] Cache-busters de `sound.js`, `live-v2-ui.js`, `liveV2.js` y `styles.css`.
- [ ] Manual: sonido bueno/malo/neutro, motivo real, countdown, toggle.
