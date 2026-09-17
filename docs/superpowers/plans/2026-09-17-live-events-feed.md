# Live Events Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar un bloque plegable `📣 ÚLTIMA HORA` en el tab Live con los eventos del día, persistido en localStorage e invalidado al cambiar el día, marcando en verde sólido (C1c) los goles de tu plantilla.

**Architecture:** Helpers puros en `js/live.js` (día, prune, append, builder del feed) testeados con `node:test`; `js/main.js` maneja localStorage, detecta los eventos en `pollLiveOnce` y usa un baseline para continuar el diff tras recargar. `cacheStore.js` purga la clave en logout.

**Tech Stack:** JavaScript vanilla (IIFE `js/live.js`), `node:test` + `node:assert/strict`.

## Global Constraints

- Rama `main` de `porra-spa`. No tocar `api-porra`.
- Vanilla JS, sin frameworks; los helpers nuevos van dentro del IIFE de `js/live.js` y se añaden a `liveApi` + `module.exports`.
- Nombres de funciones en inglés en `js/live.js` (convención del fichero).
- Día **local** `YYYY-MM-DD`; clave versionada `porra_live_events_v1_<username>`.
- Tope `LIVE_EVENTS_MAX = 50`; frescura del baseline `LIVE_BASELINE_STALE_MS = 5 * 60 * 1000`.
- Marca C1c: fondo `#0E3B2E`, borde `rgba(16,185,129,0.55)`, pestaña 4px `#10B981`, texto blanco, secundario `#6EE7B7`.
- Cache-busting en `index.html` al tocar `js/live.js` y `js/main.js` (regla de AGENTS.md).
- Comandos desde `/home/ldoc/Proyectos/porra-spa`.

---

### Task 1: Helpers puros del feed (`js/live.js`)

**Files:**
- Modify: `js/live.js` (dentro del IIFE, antes del objeto `liveApi`)
- Test: `tests/live.test.js`

**Interfaces:**
- Produces:
  - `LIVE_EVENTS_MAX = 50`
  - `liveDayKey(nowMs) -> 'YYYY-MM-DD'` (local)
  - `pruneLiveEvents(store, nowMs, max) -> { day, updatedAt, events, baseline }`
  - `appendLiveEvent(events, ev, max) -> events`
  - `buildLiveEventsFeed(events, open) -> string`
  - `describeLiveEvent(ev, ctx)` ampliado: `ctx.team` (goal) y `ctx.match` (start/status).

- [ ] **Step 1: Write the failing tests**

Ampliar el import de `tests/live.test.js` (línea 3) y añadir al final:

```js
const { resolveLiveRefreshSecs, diffLiveMatches, computeLiveGaps, ringOffset, liveGoalsOf, buildLiveTabsHtml, buildRingHtml, buildZoneHtml, buildLiveSquadPlayersHtml, liveStatusStyle, buildLivePredictionPill, buildLiveTeamCell, describeLiveEvent, liveDayKey, pruneLiveEvents, appendLiveEvent, buildLiveEventsFeed } = require('../js/live.js');
```

```js
test('liveDayKey usa fecha local YYYY-MM-DD', () => {
  const t = new Date(2026, 8, 17, 15, 30).getTime();
  assert.equal(liveDayKey(t), '2026-09-17');
});

test('pruneLiveEvents invalida al cambiar de día y recorta', () => {
  const day = liveDayKey(Date.now());
  const store = { day, updatedAt: 1, events: [{ id: 1 }, { id: 2 }, { id: 3 }], baseline: { a: 1 } };
  const p = pruneLiveEvents(store, Date.now(), 2);
  assert.deepEqual(p.events.map(e => e.id), [2, 3]);
  assert.equal(p.baseline.a, 1);
  const other = pruneLiveEvents({ day: '2000-01-01', events: [{ id: 9 }], baseline: { x: 1 } }, Date.now(), 50);
  assert.deepEqual(other.events, []);
  assert.equal(other.baseline, null);
  assert.equal(other.day, day);
});

test('appendLiveEvent recorta al máximo', () => {
  let evs = [];
  for (let i = 0; i < 5; i++) evs = appendLiveEvent(evs, { id: i }, 3);
  assert.deepEqual(evs.map(e => e.id), [2, 3, 4]);
});

test('buildLiveEventsFeed vacío/punteado y reglas de despliegue', () => {
  const empty = buildLiveEventsFeed([], false);
  assert.ok(empty.includes('ÚLTIMA HORA'));
  assert.ok(empty.includes('display:none'));
  assert.ok(empty.toLowerCase().includes('aún no hay eventos'));
  const open = buildLiveEventsFeed([{ id: '1', text: '⚽ ¡GOL! X', ts: Date.now(), mine: false }], true);
  assert.ok(open.includes('display:block'));
  assert.ok(open.includes('¡GOL! X'));
});

test('buildLiveEventsFeed marca tu jugador en C1c', () => {
  const html = buildLiveEventsFeed([{ id: '1', text: '⚽ ¡GOL! Mbappé', ts: Date.now(), mine: true }], true);
  assert.ok(html.includes('#0E3B2E'));
  assert.ok(html.includes('rgba(16,185,129,0.55)'));
  assert.ok(html.includes('4px'));
});

test('describeLiveEvent añade equipo y partido desde el contexto', () => {
  assert.equal(describeLiveEvent({ type: 'goal' }, { scorer: 'Mbappé', minute: 23, team: 'R. Madrid' }), "⚽ ¡GOL! Mbappé (23') · R. Madrid");
  assert.equal(describeLiveEvent({ type: 'status', to: 'HT' }, { match: 'R. Madrid - Inter' }), '⏸ DESCANSO · R. Madrid - Inter');
  assert.equal(describeLiveEvent({ type: 'start' }, { match: 'A - B' }), '🟢 ¡Empieza el partido · A - B');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/live.test.js`
Expected: FAIL (`liveDayKey is not a function`).

- [ ] **Step 3: Implementar en `js/live.js`**

Antes de `const liveApi = { ... }`, añadir:

```js
  const LIVE_EVENTS_MAX = 50;

  function liveDayKey(nowMs) {
    const d = new Date(nowMs);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function pruneLiveEvents(store, nowMs, max) {
    const day = liveDayKey(nowMs);
    const cap = (Number.isInteger(max) && max > 0) ? max : LIVE_EVENTS_MAX;
    if (!store || store.day !== day || !Array.isArray(store.events)) {
      return { day, updatedAt: nowMs, events: [], baseline: null };
    }
    const events = store.events.length > cap ? store.events.slice(store.events.length - cap) : store.events;
    return { day, updatedAt: nowMs, events, baseline: store.baseline || null };
  }

  function appendLiveEvent(events, ev, max) {
    const cap = (Number.isInteger(max) && max > 0) ? max : LIVE_EVENTS_MAX;
    const next = (Array.isArray(events) ? events : []).concat([ev]);
    return next.length > cap ? next.slice(next.length - cap) : next;
  }

  function buildLiveEventRow(e) {
    const time = new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = e.text || '';
    if (e.mine) {
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;position:relative;background:#0E3B2E;border:1px solid rgba(16,185,129,0.55);border-radius:8px;margin:3px 0">`
        + `<span style="position:absolute;left:-8px;top:5px;bottom:5px;width:4px;border-radius:3px;background:#10B981"></span>`
        + `<span style="flex:1;font-size:12px;font-weight:800;color:#FFFFFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}</span>`
        + `<span style="font-size:10px;color:#6EE7B7">${time}</span></div>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,0.06)">`
      + `<span style="flex:1;font-size:12px;font-weight:700;color:#F8FAFC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}</span>`
      + `<span style="font-size:10px;color:#64748B">${time}</span></div>`;
  }

  function buildLiveEventsFeed(events, open) {
    const list = Array.isArray(events) ? events : [];
    const isOpen = !!open;
    const rows = [...list].reverse().map(buildLiveEventRow).join('');
    const badge = list.length ? ` <span style="font-size:9px;color:#10B981;background:rgba(16,185,129,0.16);border-radius:99px;padding:1px 6px">${list.length}</span>` : '';
    return `<div style="margin-top:10px;background:rgba(0,0,0,0.28);border-radius:10px;overflow:hidden">`
      + `<div class="live-events-toggle" style="display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:44px">`
      + `<div style="font-size:11px;color:#F8FAFC;font-weight:800;flex:1">📣 ÚLTIMA HORA <span style="font-weight:400;color:#94A3B8">· hoy</span>${badge}</div>`
      + `<div class="live-events-chev" style="font-size:14px;color:#94A3B8">${isOpen ? '▾' : '▸'}</div></div>`
      + `<div class="live-events-body" style="padding:0 8px 6px;display:${isOpen ? 'block' : 'none'}">`
      + (list.length ? rows : `<div style="padding:8px 4px;font-size:12px;color:#94A3B8">Aún no hay eventos.</div>`)
      + `</div></div>`;
  }
```

Sustituir `describeLiveEvent` por la versión ampliada:

```js
  function describeLiveEvent(ev, ctx) {
    ctx = ctx || {};
    if (ev.type === 'goal') {
      const who = ctx.scorer ? ` ${ctx.scorer}` : '';
      const min = (ctx.minute !== null && ctx.minute !== undefined) ? ` (${ctx.minute}')` : '';
      const team = ctx.team ? ` · ${ctx.team}` : '';
      return `⚽ ¡GOL!${who}${min}${team}`;
    }
    if (ev.type === 'rankUp') return `▲ Subes al ${ctx.rank}º`;
    if (ev.type === 'rankDown') return `▼ Bajas al ${ctx.rank}º`;
    if (ev.type === 'start') return `🟢 ¡Empieza el partido${ctx.match ? ` · ${ctx.match}` : ''}`;
    if (ev.type === 'end') return '🏁 FINAL';
    if (ev.type === 'status') {
      const m = ctx.match ? ` · ${ctx.match}` : '';
      if (ev.to === 'HT') return `⏸ DESCANSO${m}`;
      if (ev.to === 'FT') return `🏁 FINAL${m}`;
      return `▶️ ${ev.to}${m}`;
    }
    return '';
  }
```

Añadir al objeto `liveApi` (y por tanto a `module.exports`) los nuevos nombres:

```js
  const liveApi = { resolveLiveRefreshSecs, LIVE_DEFAULT_SECS, liveGoalsOf, diffLiveMatches, computeLiveGaps, ringOffset, buildLiveTabsHtml, buildRingHtml, buildZoneHtml, buildLiveSquadPlayersHtml, liveStatusStyle, buildLivePredictionPill, buildLiveTeamCell, describeLiveEvent, liveDayKey, pruneLiveEvents, appendLiveEvent, buildLiveEventsFeed, LIVE_EVENTS_MAX };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/live.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live.js tests/live.test.js
git commit -m "feat(live): helpers puros del feed de eventos (dia, prune, builder)"
```

---

### Task 2: Cableado en `js/main.js`

**Files:**
- Modify: `js/main.js` (sección Live, líneas ~1841-2144)
- Test: manual + suite

**Interfaces:**
- Consumes: `liveApi.liveDayKey`, `liveApi.pruneLiveEvents`, `liveApi.appendLiveEvent`, `liveApi.buildLiveEventsFeed`, `liveApi.describeLiveEvent`, `teamName` (existente `js/main.js:686`).
- Produces: feed persistido en `localStorage` bajo `porra_live_events_v1_<username>`, con baseline para continuidad.

- [ ] **Step 1: Constantes y helpers de almacenamiento (junto a la sección Live, tras `_liveRenderGen`)**

```js
const LIVE_EVENTS_PREFIX = 'porra_live_events_v1_';
const LIVE_BASELINE_STALE_MS = 5 * 60 * 1000;

function liveEventsKey() {
  const u = AppState.currentUser && AppState.currentUser.name;
  return u ? `${LIVE_EVENTS_PREFIX}${u}` : null;
}

function readLiveEventsStore() {
  const key = liveEventsKey();
  if (!key) return null;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

function writeLiveEventsStore(store) {
  const key = liveEventsKey();
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(store)); } catch (e) { /* noop */ }
}

function initLiveEvents() {
  const st = liveState();
  const nowMs = Date.now();
  const store = liveApi.pruneLiveEvents(readLiveEventsStore(), nowMs, liveApi.LIVE_EVENTS_MAX);
  st.events = store.events;
  st.baselineFromStore = store.baseline || null;
  st.baselineAt = store.updatedAt || 0;
  st.eventsOpen = false;
}

function persistLiveEvents(snapshot) {
  const st = liveState();
  const nowMs = Date.now();
  const store = liveApi.pruneLiveEvents({ day: liveApi.liveDayKey(nowMs), updatedAt: nowMs, events: st.events || [], baseline: snapshot || null }, nowMs, liveApi.LIVE_EVENTS_MAX);
  writeLiveEventsStore(store);
}

function liveMatchLabel(lm) {
  const meta = liveMatchMeta(lm);
  return `${meta.homeTeam} - ${meta.awayTeam}`;
}
```

- [ ] **Step 2: `findLiveScorer` devuelve `{ id, nombre }`**

Sustituir el cuerpo de `findLiveScorer` para devolver el objeto en vez del nombre:

```js
function findLiveScorer(prev, next, eventId, teamId) {
  const n = (next || []).find(m => m.eventId === eventId);
  if (!n) return null;
  const p = (prev || []).find(m => m.eventId === eventId);
  const prevGoals = new Map((((p && p.stats) || {}).jugadores || []).map(j => [String(j.id), j.goles || 0]));
  const cand = ((((n.stats || {}).jugadores) || []).filter(j => String(j.equipo) === String(teamId) && (j.goles || 0) > (prevGoals.get(String(j.id)) || 0)));
  if (!cand.length) return null;
  const s = cand[cand.length - 1];
  return { id: s.id, nombre: s.nombre };
}
```

- [ ] **Step 3: Inicialización en `renderLiveTab` y baseline del primer diff**

Al inicio de `renderLiveTab`, tras `st.soundOn = isLiveSoundOn();`, añadir:

```js
  if (!st.eventsInited) { initLiveEvents(); st.eventsInited = true; }
```

Sustituir `if (payload && payload.ok) st.prev = liveMatches;` por:

```js
  if (payload && payload.ok) {
    if (!st.prevInited) {
      const fresh = st.baselineFromStore && (Date.now() - (st.baselineAt || 0) < LIVE_BASELINE_STALE_MS);
      st.prev = fresh ? st.baselineFromStore : liveMatches;
      st.prevInited = true;
    } else {
      st.prev = liveMatches;
    }
  }
```

- [ ] **Step 4: Detectar y guardar eventos en `pollLiveOnce`**

Sustituir el bloque `const events = liveApi.diffLiveMatches(...)` … `if (lastMsg) st.lastEvent = ...;` por:

```js
      const events = liveApi.diffLiveMatches(prev, next);
      if (rb !== null && ra !== null && ra < rb) events.push({ type: 'rankUp' });
      else if (rb !== null && ra !== null && ra > rb) events.push({ type: 'rankDown' });
      const meSquadIds = new Set((AppState.squadsCache?.[meName] || []).map(p => String(p.id)));
      let lastMsg = '';
      for (const ev of events) {
        const ctx = {};
        let mine = false;
        if (ev.type === 'goal') {
          const scorer = findLiveScorer(prev, next, ev.eventId, ev.teamId);
          ctx.scorer = scorer ? scorer.nombre : null;
          mine = scorer ? meSquadIds.has(String(scorer.id)) : false;
          const nm = next.find(x => x.eventId === ev.eventId);
          ctx.minute = nm ? nm.minute : null;
          ctx.team = teamName(ev.teamId);
        } else if (ev.type === 'rankUp' || ev.type === 'rankDown') {
          ctx.rank = ra;
        } else {
          const nm = next.find(x => x.eventId === ev.eventId);
          ctx.match = nm ? liveMatchLabel(nm) : '';
        }
        const text = liveApi.describeLiveEvent(ev, ctx);
        if (!text) continue;
        lastMsg = text;
        const at = Date.now();
        st.events = liveApi.appendLiveEvent(st.events || [], { id: `${ev.eventId}:${ev.type}:${at}`, eventId: ev.eventId, type: ev.type, text, ts: at, mine }, liveApi.LIVE_EVENTS_MAX);
      }
      if (lastMsg) st.lastEvent = { text: lastMsg, at: Date.now() };
      persistLiveEvents(next);
```

`persistLiveEvents(next)` va dentro del `if (meName && (prev.length || next.length))`, justo después de `if (lastMsg) st.lastEvent = { text: lastMsg, at: Date.now() };`. No dupliques `st.prev = next;` (ya existe más abajo en la función).

- [ ] **Step 5: Pintar el feed en la cabecera y toggle**

En `renderLiveTab`, dentro de `headerCard`, insertar el feed tras el cierre de la fila del anillo y antes de `zoneHtml`:

```js
    + `<div id="live-ring">${liveApi.buildRingHtml(st.secsLeft, total)}</div></div>`
    + liveApi.buildLiveEventsFeed(st.events || [], st.eventsOpen)
    + zoneHtml
```

En `bindLiveTabInteractions`, tras el bloque de `.live-squad-player`, añadir:

```js
  const evToggle = container.querySelector('.live-events-toggle');
  if (evToggle) {
    evToggle.style.cursor = 'pointer';
    evToggle.addEventListener('click', () => {
      const body = container.querySelector('.live-events-body');
      const chev = container.querySelector('.live-events-chev');
      if (!body) return;
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      if (chev) chev.textContent = isHidden ? '▾' : '▸';
      st.eventsOpen = isHidden;
    });
  }
```

- [ ] **Step 6: Verificar**

Run: `node --check js/main.js && node --test tests/*.test.js`
Expected: `syntax OK` y todos los tests en verde.

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat(live): feed de eventos persistido en localStorage con baseline"
```

---

### Task 3: Purga en logout, cache-busting y verificación manual

**Files:**
- Modify: `js/cacheStore.js` (función `clearPorraCaches`, línea 67)
- Modify: `index.html` (versiones)
- Test: manual con la demo

**Interfaces:**
- Consumes: clave `porra_live_events_v1_<username>`.
- Produces: purga al cerrar sesión + assets versionados.

- [ ] **Step 1: Purga en `clearPorraCaches`**

Sustituir la condición de `clearPorraCaches` por:

```js
        if (k && (k === KEYS.matchstats || k.indexOf(PREDALL_PREFIX) === 0 || k.indexOf(MESSAGES_PREFIX) === 0 || k.indexOf('porra_live_events_') === 0)) toRemove.push(k);
```

- [ ] **Step 2: Cache-busting en `index.html`**

Incrementar las versiones de `js/live.js` y `js/main.js`:

```html
  <script src="js/live.js?v=5"></script>
  <script src="js/main.js?v=140"></script>
```

- [ ] **Step 3: Verificar la suite**

Run: `node --test tests/*.test.js`
Expected: PASS.

- [ ] **Step 4: Verificación manual (demo en local)**

Requiere api-porra con la DB `/test`, `node server.js` (puerto 3000), `node server.mjs` (8080) y `node --env-file=.env scripts/seedLiveDemo.js --tick 30` en api-porra. Luego:

1. Abrir `http://localhost:8080`, tab Resultados → Live, y desplegar `📣 ÚLTIMA HORA`.
2. Esperar un gol: debe aparecer la fila con hora; si el goleador es de tu plantilla, la fila sale en C1c (fondo `#0E3B2E`).
3. Recargar (Ctrl+Shift+R): el feed debe conservar los eventos del día.
4. Cambiar el día (localStorage: editar `day` a ayer) y recargar: el feed debe quedar vacío.

- [ ] **Step 5: Commit**

```bash
git add js/cacheStore.js index.html
git commit -m "chore(live): purga del feed en logout y cache-busting"
```

---

## Notas de verificación final

- El aviso del último evento (línea v9) usa el mismo texto que la fila del feed.
- `describeLiveEvent` sigue devolviendo el mismo texto sin contexto (`ctx` vacío) para no romper tests previos.
- El feed es por usuario (`porra_live_events_v1_<username>`); los invitados invisibles no cambian de comportamiento.
