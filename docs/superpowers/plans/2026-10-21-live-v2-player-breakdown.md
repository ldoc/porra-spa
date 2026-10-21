# Live v2 — Desglose de jugador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al pulsar una fila de la clasificación en vivo, abrir un modal con los pronósticos y el desglose de puntos live de ese jugador.

**Architecture:** Tres funciones nuevas en `js/live-v2-ui.js` calculan los partidos del jugador (`liveV2PlayerMatches`), su resumen (`liveV2PlayerSummary`) y el HTML (`liveV2PlayerModalHtml`). El modal reutiliza el patrón de `openLiveV2MatchModal` (overlay, Escape, foco, bloqueo de scroll) y se refresca en cada poll. Las filas delegan click y teclado en `#livev2-rows`.

**Tech Stack:** JavaScript ES5+ de navegador, módulo UMD de `live-v2-ui.js`, Node test runner (`node --test`), CSS plano.

## Global Constraints

- No hay cambios de backend, scoring, `liveevents`, poll ni base de datos.
- Solo se muestran partidos `LIVE`, `HT` y `FT`; cualquier `NS` se excluye.
- Los puntos mostrados son solo del Live, nunca `officialPoints`.
- Todo dato de usuario se escapa con `liveV2Esc`.
- El modal no convive con el modal de partido: abrir uno cierra el otro.
- `index.html` debe bumpear las versiones de CSS, `js/live-v2-ui.js` y `js/main.js`.
- Verificación final: `node --check js/live-v2-ui.js` y `node --test tests/*.test.js`.

---

### Task 1: Cálculo del desglose de un jugador

**Files:**
- Modify: `js/live-v2-ui.js` (añadir funciones tras `liveUserMatchPoints`, sobre la línea 325; exportar en `api`, sobre la línea 2276)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2OrderedStateEntries(folded)`, `liveMatchMeta(lm)`, `liveUserMatchPoints(username, lm, meta)`, `liveV2ChipLabel(state, playheadTs, observedMinute)`, `liveV2ObservedMinute(eventId)`, `AppState.allPredictions`, `AppState.matches`
- Produces:
  - `liveV2PlayerMatches(username, folded)` → `Array<{ eventId, meta, status, label, score, prediction, predictionPts, predictionBreakdown, squadPts, squadDetail, total }>`
  - `liveV2PlayerSummary(matches)` → `{ predictionPts, squadPts, total }`

- [ ] **Step 1: Write the failing test**

Añadir al final de `tests/liveV2Ui.test.js`:

```js
test('liveV2PlayerMatches incluye solo partidos empezados y suma pronóstico y plantilla', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const stats2 = { jugadores: [{ id: 7, minutos: 90 }] };
  const stats3 = { jugadores: [] };
  const AppState = {
    matches: [
      { id: 1, fechaTs: 100, homeTeamId: 10, awayTeamId: 20, homeTeam: 'Local', awayTeam: 'Visita' },
      { id: 2, fechaTs: 200, homeTeamId: 10, awayTeamId: 20, homeTeam: 'Local', awayTeam: 'Visita' },
      { id: 3, fechaTs: 300, homeTeamId: 30, awayTeamId: 40, homeTeam: 'Otro', awayTeam: 'Rival' },
    ],
    allPredictions: {
      rival: {
        1: { home: 1, away: 0 },
        2: { home: 2, away: 1 },
      },
    },
    squadsCache: { rival: [{ id: 7, nombre: 'Delantero' }] },
    allPlayers: [],
    liveV2: null,
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: (pred) => pred
      ? { points: 10, breakdown: ['10 por acierto'] }
      : { points: 0, breakdown: ['Partido no pronosticado'] },
    calculatePlayerMatchPoints: () => ({
      total: 4,
      desglose: [{ concepto: 'Gol' }, { concepto: 'Asistencia' }],
    }),
  });
  const folded = {
    states: {
      3: { status: 'FT', score: { home: 0, away: 0 } },
      1: { status: 'NS', score: null },
      2: { status: 'LIVE', score: { home: 2, away: 1 } },
    },
    statsById: { 2: stats2, 3: stats3 },
  };
  const matches = ui.liveV2PlayerMatches('rival', folded);
  assert.deepEqual(matches.map(m => m.eventId), [2, 3]);
  assert.deepEqual(matches[0].prediction, { home: 2, away: 1 });
  assert.equal(matches[0].predictionPts, 10);
  assert.deepEqual(matches[0].predictionBreakdown, ['10 por acierto']);
  assert.equal(matches[0].squadPts, 4);
  assert.deepEqual(matches[0].squadDetail[0].desglose.map(d => d.concepto), ['Gol', 'Asistencia']);
  assert.equal(matches[0].total, 14);
  assert.equal(matches[1].prediction, null);
  assert.equal(matches[1].predictionPts, 0);
  assert.equal(matches[1].total, 0);
  assert.deepEqual(ui.liveV2PlayerSummary(matches), { predictionPts: 10, squadPts: 4, total: 14 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL con `ui.liveV2PlayerMatches is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir justo después de `liveUserMatchPoints`:

```js
/** Partidos Live de un jugador (LIVE/HT/FT) con pronóstico y desglose de plantilla. */
function liveV2PlayerMatches(username, folded) {
  const preds = (AppState.allPredictions || {})[username] || {};
  const out = [];
  for (const [id, state] of liveV2OrderedStateEntries(folded)) {
    if (!state || state.status === 'NS') continue;
    const match = (AppState.matches || []).find(m => String(m.id) === String(id));
    const matchId = match ? match.id : id;
    const lm = { eventId: matchId, stats: (folded.statsById || {})[id], status: state.status };
    const meta = liveMatchMeta(lm);
    const r = liveUserMatchPoints(username, lm, meta);
    const pred = preds[matchId] != null ? preds[matchId] : preds[String(matchId)];
    const hasPred = pred && pred.home != null && pred.away != null;
    out.push({
      eventId: matchId,
      meta,
      status: state.status,
      label: liveV2ChipLabel(state, null, liveV2ObservedMinute(id)),
      score: state.score ? { ...state.score } : null,
      prediction: hasPred ? { home: pred.home, away: pred.away } : null,
      predictionPts: r.matchPts,
      predictionBreakdown: r.breakdown || [],
      squadPts: r.squadPts,
      squadDetail: r.squadDetail || [],
      total: r.total,
    });
  }
  return out;
}

/** Suma pronóstico, plantilla y total de los partidos de un jugador. */
function liveV2PlayerSummary(matches) {
  const out = { predictionPts: 0, squadPts: 0, total: 0 };
  for (const m of matches || []) {
    out.predictionPts += m.predictionPts || 0;
    out.squadPts += m.squadPts || 0;
    out.total += m.total || 0;
  }
  return out;
}
```

Añadir al objeto `api` (junto a `liveV2HeaderBreakdown`):

```js
    liveV2PlayerMatches,
    liveV2PlayerSummary,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live): calcular desglose live de cualquier jugador"
```

---

### Task 2: HTML del modal de jugador

**Files:**
- Modify: `js/live-v2-ui.js` (añadir `liveV2PlayerMatchHtml` y `liveV2PlayerModalHtml` tras `liveV2MatchModalHtml`, sobre la línea 940; exportar en `api`)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2Esc`, `liveV2BadgeSrc`, el objeto que produce `liveV2PlayerMatches` y el resumen de `liveV2PlayerSummary`
- Produces:
  - `liveV2PlayerMatchHtml(m)` → `string`
  - `liveV2PlayerModalHtml({ username, avatar, summary, matches })` → `string`

- [ ] **Step 1: Write the failing test**

Añadir al final de `tests/liveV2Ui.test.js`:

```js
test('liveV2PlayerModalHtml pinta resumen, pronóstico, motivos y plantilla', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: null }, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2PlayerModalHtml({
    username: 'Ana',
    avatar: '⚽',
    summary: { predictionPts: 10, squadPts: 4, total: 14 },
    matches: [{
      eventId: 2,
      meta: { homeTeam: 'Local', awayTeam: 'Visita', homeTeamId: 10, awayTeamId: 20 },
      status: 'LIVE',
      label: "EN JUEGO 63'",
      score: { home: 2, away: 1 },
      prediction: { home: 2, away: 1 },
      predictionPts: 10,
      predictionBreakdown: ['10 por acierto'],
      squadPts: 4,
      squadDetail: [{ nombre: 'Delantero', puntos: 4, desglose: [{ concepto: 'Gol' }] }],
      total: 14,
    }],
  });
  assert.match(html, /Ana/);
  assert.match(html, /Total Live/);
  assert.match(html, /Pronóstico 2-1/);
  assert.match(html, /10 por acierto/);
  assert.match(html, /Delantero/);
  assert.match(html, /Gol/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-labelledby="livev2-player-modal-title"/);
});

test('liveV2PlayerModalHtml muestra avisos de vacío y escapa el nombre', () => {
  const ui = freshUi();
  ui.init({
    AppState: { liveV2: null },
    liveV2Api: {
      escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c])),
    },
  });
  const html = ui.liveV2PlayerModalHtml({
    username: '<b>Ana</b>',
    avatar: '⚽',
    summary: { predictionPts: 0, squadPts: 0, total: 0 },
    matches: [{
      eventId: 3,
      meta: { homeTeam: 'A', awayTeam: 'B' },
      status: 'FT',
      label: 'FINAL',
      score: { home: 0, away: 0 },
      prediction: null,
      predictionPts: 0,
      predictionBreakdown: [],
      squadPts: 0,
      squadDetail: [],
      total: 0,
    }],
  });
  assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;/);
  assert.match(html, /Sin pronóstico/);
  assert.match(html, /Ningún jugador de su plantilla en este partido/);

  const empty = ui.liveV2PlayerModalHtml({
    username: 'Ana', avatar: '⚽',
    summary: { predictionPts: 0, squadPts: 0, total: 0 }, matches: [],
  });
  assert.match(empty, /Sin partidos en directo/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL con `ui.liveV2PlayerModalHtml is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir después de `liveV2MatchModalHtml`:

```js
function liveV2PlayerMatchHtml(m) {
  const homeBadge = liveV2BadgeSrc(m.meta.homeTeamId, m.meta.homeBadgeExt);
  const awayBadge = liveV2BadgeSrc(m.meta.awayTeamId, m.meta.awayBadgeExt);
  const badge = (src, cls) => src
    ? `<img class="livev2-modal-badge ${cls}" src="${liveV2Esc(src)}" alt="" loading="lazy">`
    : '';
  const score = m.score ? `${liveV2Esc(m.score.home)}-${liveV2Esc(m.score.away)}` : '–';
  const pred = m.prediction
    ? `<div class="livev2-player-pred">`
      + `<span>Pronóstico ${liveV2Esc(m.prediction.home)}-${liveV2Esc(m.prediction.away)}</span>`
      + `<b class="${m.predictionPts >= 0 ? 'positive' : 'negative'}">`
      + `${m.predictionPts > 0 ? '+' : ''}${m.predictionPts} pts</b></div>`
      + ((m.predictionBreakdown || []).length
        ? `<ul class="livev2-modal-list">${m.predictionBreakdown.map(x => `<li>${liveV2Esc(x)}</li>`).join('')}</ul>`
        : '')
    : `<div class="livev2-modal-empty">Sin pronóstico</div>`;
  const squad = (m.squadDetail || []).length
    ? `<div class="livev2-modal-squad">${m.squadDetail.map(p => `
        <div class="livev2-modal-player">
          <span class="livev2-modal-player-name">${liveV2Esc(p.nombre)}</span>
          <b class="${p.puntos >= 0 ? 'positive' : 'negative'}">${p.puntos > 0 ? '+' : ''}${p.puntos} pts</b>
          <small>${(p.desglose || []).map(x => liveV2Esc(x.concepto)).join(' · ')}</small>
        </div>`).join('')}</div>`
    : `<div class="livev2-modal-empty">Ningún jugador de su plantilla en este partido</div>`;
  return `<div class="livev2-player-match">`
    + `<div class="livev2-player-match-head">`
    + badge(homeBadge, 'home')
    + `<span class="livev2-player-team">${liveV2Esc(m.meta.homeTeam || '?')}</span>`
    + `<b>${score}</b>`
    + `<span class="livev2-player-state">${liveV2Esc(m.label)}</span>`
    + `<span class="livev2-player-team away">${liveV2Esc(m.meta.awayTeam || '?')}</span>`
    + badge(awayBadge, 'away')
    + `</div>`
    + pred
    + squad
    + `</div>`;
}

function liveV2PlayerModalHtml(data) {
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const s = data.summary || { predictionPts: 0, squadPts: 0, total: 0 };
  const body = matches.length
    ? matches.map(liveV2PlayerMatchHtml).join('')
    : `<div class="livev2-modal-empty">Sin partidos en directo ahora mismo</div>`;
  const avatar = data.avatar ? liveV2Esc(data.avatar) : '⚽';
  return `<div class="breakdown-modal livev2-match-modal livev2-player-modal" role="dialog" aria-modal="true" aria-labelledby="livev2-player-modal-title">`
    + `<div class="breakdown-modal-header">`
    + `<h3 class="breakdown-modal-title" id="livev2-player-modal-title">${avatar} ${liveV2Esc(data.username)}</h3>`
    + `<button class="breakdown-modal-close" data-livev2-player-close="1" aria-label="Cerrar">✕</button>`
    + `</div>`
    + `<div class="breakdown-modal-content livev2-match-content">`
    + `<div class="livev2-player-summary">`
    + `<span class="livev2-player-summary-total">⚡ Total Live <b>${s.total}</b></span>`
    + `<span class="livev2-player-summary-item pred">🎯 Pron. <b>${s.predictionPts}</b></span>`
    + `<span class="livev2-player-summary-item squad">👥 Plantilla <b>${s.squadPts}</b></span>`
    + `</div>`
    + body
    + `</div></div>`;
}
```

Añadir al objeto `api` (junto a `liveV2MatchModalHtml`):

```js
    liveV2PlayerModalHtml,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live): HTML del desglose de jugador"
```

---

### Task 3: Ciclo de vida del modal y refresco

**Files:**
- Modify: `js/live-v2-ui.js` (nuevas `openLiveV2PlayerModal`, `closeLiveV2PlayerModal`, `refreshLiveV2PlayerModal` tras el modal de partido, sobre la línea 605; llamar a `closeLiveV2PlayerModal()` al abrir el modal de partido; llamar a `refreshLiveV2PlayerModal()` en `updateLiveV2Dom`, sobre la línea 2007; exportar en `api`)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `liveV2PlayerMatches`, `liveV2PlayerSummary`, `liveV2PlayerModalHtml`, `liveV2Folded`, `visiblePlayers`, `liveV2State`
- Produces:
  - `openLiveV2PlayerModal(username, returnFocusEl)` → `void`
  - `closeLiveV2PlayerModal()` → `void`
  - `refreshLiveV2PlayerModal()` → `void`
  - Estado en `AppState.liveV2`: `_openPlayerModal`, `_playerModalKeyHandler`, `_playerModalReturnFocus`, `_playerModalPrevOverflow`

- [ ] **Step 1: Write the failing test**

Añadir al final de `tests/liveV2Ui.test.js`:

```js
test('openLiveV2PlayerModal no abre nada si no hay partidos en el Live', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    liveV2: { events: [] }, matches: [], allPredictions: {}, squadsCache: {},
    allPlayers: [], matchStats: [],
  };
  ui.init({ AppState, liveV2Api: liveV2, visiblePlayers: () => [] });
  const prevDoc = global.document;
  let created = 0;
  global.document = { createElement: () => { created++; return {}; } };
  try {
    ui.openLiveV2PlayerModal('Ana');
    assert.equal(created, 0);
    assert.equal(AppState.liveV2._openPlayerModal, undefined);
  } finally {
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
  }
});

test('refreshLiveV2PlayerModal cierra el modal si el jugador ya no está visible', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    liveV2: { _openPlayerModal: 'Fantasma' }, matches: [], allPredictions: {},
    squadsCache: {}, allPlayers: [], matchStats: [],
  };
  ui.init({ AppState, liveV2Api: liveV2, visiblePlayers: () => [{ name: 'Ana' }] });
  const prevDoc = global.document;
  global.document = {
    getElementById: id => (id === 'livev2-player-modal' ? {} : null),
    removeEventListener: () => {},
  };
  try {
    ui.refreshLiveV2PlayerModal();
    assert.equal(AppState.liveV2._openPlayerModal, null);
  } finally {
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL con `ui.openLiveV2PlayerModal is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir tras `openLiveV2MatchModal`:

```js
function closeLiveV2PlayerModal() {
  const st = liveV2State();
  const overlay = typeof document !== 'undefined' ? document.getElementById('livev2-player-modal-overlay') : null;
  if (overlay) overlay.remove();
  if (st._playerModalKeyHandler && typeof document !== 'undefined') {
    document.removeEventListener('keydown', st._playerModalKeyHandler);
  }
  st._playerModalKeyHandler = null;
  if (typeof document !== 'undefined' && document.body) {
    document.body.style.overflow = st._playerModalPrevOverflow || '';
  }
  st._playerModalPrevOverflow = null;
  st._openPlayerModal = null;
  const focus = st._playerModalReturnFocus;
  st._playerModalReturnFocus = null;
  if (focus && focus.focus) {
    try { focus.focus(); } catch (e) { /* sin foco */ }
  }
}

function refreshLiveV2PlayerModal() {
  const st = liveV2State();
  const username = st._openPlayerModal;
  if (!username || typeof document === 'undefined') return;
  const host = document.getElementById('livev2-player-modal');
  if (!host) return;
  const players = typeof visiblePlayers === 'function' ? visiblePlayers() : [];
  const player = players.find(p => p.name === username);
  if (!player) { closeLiveV2PlayerModal(); return; }
  const matches = liveV2PlayerMatches(username, liveV2Folded());
  if (!matches.length) { closeLiveV2PlayerModal(); return; }
  const content = host.querySelector('.livev2-match-content');
  const scrollTop = content ? content.scrollTop : null;
  host.innerHTML = liveV2PlayerModalHtml({
    username,
    avatar: player.avatar,
    matches,
    summary: liveV2PlayerSummary(matches),
  });
  const nextContent = host.querySelector('.livev2-match-content');
  if (nextContent && scrollTop != null) nextContent.scrollTop = scrollTop;
}

function openLiveV2PlayerModal(username, returnFocusEl) {
  if (typeof document === 'undefined' || !username) return;
  const matches = liveV2PlayerMatches(username, liveV2Folded());
  if (!matches.length) return;
  const returnFocus = returnFocusEl || document.activeElement || null;
  closeLiveV2MatchModal();
  closeLiveV2PlayerModal();
  const st = liveV2State();
  st._openPlayerModal = username;
  st._playerModalReturnFocus = returnFocus;
  st._playerModalPrevOverflow = document.body.style.overflow || '';
  const overlay = document.createElement('div');
  overlay.className = 'breakdown-modal-overlay livev2-player-overlay';
  overlay.id = 'livev2-player-modal-overlay';
  overlay.innerHTML = `<div id="livev2-player-modal"></div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const onKey = (e) => { if (e.key === 'Escape') closeLiveV2PlayerModal(); };
  st._playerModalKeyHandler = onKey;
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLiveV2PlayerModal();
    else if (e.target.closest && e.target.closest('[data-livev2-player-close]')) closeLiveV2PlayerModal();
  });
  refreshLiveV2PlayerModal();
  const closeBtn = overlay.querySelector('[data-livev2-player-close]');
  if (closeBtn && closeBtn.focus) {
    try { closeBtn.focus(); } catch (e) { /* sin foco */ }
  }
}
```

Al inicio de `openLiveV2MatchModal`, tras `closeLiveV2MatchModal();`, añadir:

```js
  closeLiveV2PlayerModal();
```

En `updateLiveV2Dom`, tras `refreshLiveV2MatchModal();`, añadir:

```js
  refreshLiveV2PlayerModal();
```

Añadir al objeto `api` (junto a `openLiveV2MatchModal`):

```js
    openLiveV2PlayerModal,
    closeLiveV2PlayerModal,
    refreshLiveV2PlayerModal,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js tests/liveV2Ui.test.js
git commit -m "feat(live): modal de desglose de jugador con refresco"
```

---

### Task 4: Filas interactivas y binding

**Files:**
- Modify: `js/live-v2-ui.js` (`liveV2RowHtml`, sobre la línea 1260; nuevo `bindLiveV2Rows` tras `bindLiveV2Chips`, sobre la línea 1005; exportar en `api`)
- Modify: `js/main.js:2047` (llamar a `bindLiveV2Rows`)
- Modify: `js/live-v2-ui.js` en `retryLiveV2`, sobre la línea 1504 (llamar a `bindLiveV2Rows`)
- Modify: `js/live-v2-ui.js` en `bindLiveV2Fullscreen`, sobre la línea 195 (ignorar Escape con modal de jugador abierto)
- Test: `tests/liveV2Ui.test.js`

**Interfaces:**
- Consumes: `openLiveV2PlayerModal(username, returnFocusEl)` (se define en Task 3; el binding solo la llama)
- Produces: `bindLiveV2Rows(root)` → `void`; filas con `role="button"`, `tabindex="0"`, `aria-label` y `.livev2-row-chevron`

- [ ] **Step 1: Write the failing test**

Añadir al final de `tests/liveV2Ui.test.js`:

```js
test('liveV2RowHtml marca la fila como botón accesible con chevron', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: null }, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2RowHtml({
    name: 'Ana', avatar: '⚽', rank: 2, livePoints: 30, pointsDiff: 0, isMe: false,
    rankMove: { text: '=', cls: 'eq', label: 'Sin cambios' },
  });
  assert.match(html, /role="button"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-label="Ver desglose de Ana"/);
  assert.match(html, /livev2-row-chevron/);
  assert.match(html, />›<\/span>/);
});

test('Escape con el modal de jugador abierto no sale de pantalla completa', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: { _openPlayerModal: 'Ana' } }, liveV2Api: {} });
  const dom = setupDom();
  const hist = setupHistory();
  withFullscreenGlobals(dom, hist, () => {
    ui.bindLiveV2Fullscreen();
    ui.enterLiveV2Fullscreen();
    let prevented = false;
    dom.doc.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
    assert.ok(dom.bodyClasses.has('live-fs'));
    assert.equal(prevented, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveV2Ui.test.js`
Expected: FAIL en los dos tests: falta `role="button"` y Escape sale de pantalla completa.

- [ ] **Step 3: Write minimal implementation**

En `liveV2RowHtml`, sustituir el `return` por:

```js
  return `<div class="livev2-row${r.isMe ? ' me' : ''}${liveV2RowPointsClass(diff)}"`
    + ` data-livev2-row="${liveV2Esc(r.name)}" role="button" tabindex="0"`
    + ` aria-label="${liveV2Esc('Ver desglose de ' + r.name)}">`
    + `<div class="livev2-inner">`
    + `<span class="livev2-rank-group">`
    + `<span class="livev2-rank">${r.rank}</span>`
    + `<span class="livev2-rank-move ${move.cls}" aria-label="${liveV2Esc(move.label)}">${liveV2Esc(move.text)}</span>`
    + `</span>`
    + `<span class="livev2-avatar">${liveV2Esc(r.avatar) || '⚽'}</span>`
    + `<span class="livev2-name">${liveV2Esc(r.name)}</span>`
    + `<span class="livev2-pts">${r.livePoints}</span>`
    + `<span class="livev2-pts-diff ${liveV2PointsDiffClass(diff)}" aria-label="${liveV2Esc(liveV2PointsDiffLabel(diff))}">${liveV2PointsDiffText(diff)}</span>`
    + `<span class="livev2-row-chevron" aria-hidden="true">›</span>`
    + `</div></div>`;
```

Añadir tras `bindLiveV2Chips`:

```js
function bindLiveV2Rows(root) {
  const host = (root || document).querySelector('#livev2-rows');
  if (!host || host.dataset.bound === '1') return;
  host.dataset.bound = '1';
  const openFromEvent = (e) => {
    const row = e.target.closest ? e.target.closest('[data-livev2-row]') : null;
    if (!row) return;
    e.preventDefault();
    openLiveV2PlayerModal(row.getAttribute('data-livev2-row'), row);
  };
  host.addEventListener('click', openFromEvent);
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    openFromEvent(e);
  });
}
```

Añadir al objeto `api` (junto a `bindLiveV2Chips`):

```js
    bindLiveV2Rows,
```

En `js/main.js`, tras `if (isLiveTab) liveV2Ui.bindLiveV2Chips(container);`:

```js
  if (isLiveTab) liveV2Ui.bindLiveV2Rows(container);
```

En `retryLiveV2`, tras `bindLiveV2Chips(target);`:

```js
    bindLiveV2Rows(target);
```

En el listener de Escape de `bindLiveV2Fullscreen`, cambiar:

```js
      if (AppState && liveV2State()._openMatchModal != null) return;
```

por:

```js
      if (AppState && (liveV2State()._openMatchModal != null
        || liveV2State()._openPlayerModal != null)) return;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/liveV2Ui.test.js`
Expected: PASS. `bindLiveV2Rows` no se ejecuta en los tests, pero el archivo debe cargar sin errores.

- [ ] **Step 5: Commit**

```bash
git add js/live-v2-ui.js js/main.js tests/liveV2Ui.test.js
git commit -m "feat(live): filas clicables para abrir el desglose de jugador"
```

---

### Task 5: Estilos, cache-busting y verificación manual

**Files:**
- Modify: `css/styles.css` (tras `.livev2-modal-total b`, sobre la línea 2725; y en el bloque `.livev2-row`, sobre la línea 6923)
- Modify: `index.html:19` (CSS `v=120` → `v=121`)
- Modify: `index.html:332` (`js/live-v2-ui.js?v=28` → `v=29`)
- Modify: `index.html:333` (`js/main.js?v=172` → `v=173`)

**Interfaces:**
- Consumes: las clases generadas en las tareas anteriores
- Produces: estilos de fila interactiva y del modal de jugador

- [ ] **Step 1: Write the failing check**

Ejecutar una comprobación manual de que los estilos no existen todavía:

Run: `grep -n "livev2-player-summary" css/styles.css`
Expected: sin resultados (exit code 1).

- [ ] **Step 2: Add the styles**

Tras `.livev2-modal-total b` añadir:

```css
/* Desglose de otro jugador */
.livev2-player-overlay { z-index: 1200; }
.livev2-player-modal { max-height: 82vh; }
.livev2-player-modal .breakdown-modal-close {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
}

.livev2-player-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.livev2-player-summary b {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.livev2-player-summary-total b {
  color: var(--accent-gold);
  font-size: 1.15rem;
}

.livev2-player-match {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
}

.livev2-player-match:last-child { border-bottom: 0; }

.livev2-player-match-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-weight: 700;
}

.livev2-player-match-head b {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.livev2-player-team {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.livev2-player-team.away { text-align: right; }

.livev2-player-state {
  margin-left: auto;
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
}

.livev2-player-pred {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.livev2-player-pred b {
  color: var(--accent-gold);
  font-variant-numeric: tabular-nums;
}

.livev2-player-pred b.negative { color: #F87171; }
.livev2-player-match .livev2-modal-empty { padding-left: 0; padding-right: 0; }
.livev2-player-match .livev2-modal-list { margin-top: 2px; }
.livev2-player-match .livev2-modal-squad { margin-top: 8px; }
```

En el bloque `.livev2-row`, añadir:

```css
.livev2-row { cursor: pointer; }
.livev2-row:focus-visible { outline: none; }

.livev2-row:hover > .livev2-inner,
.livev2-row:focus-visible > .livev2-inner {
  background: var(--ucl-card-hover);
}

.livev2-row:focus-visible > .livev2-inner {
  box-shadow: 0 0 0 2px var(--accent-primary);
}

.livev2-row:active > .livev2-inner { transform: scale(0.99); }

.livev2-row-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: var(--font-size-lg);
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .livev2-row:active > .livev2-inner { transform: none; }
}
```

Aplicar los bumps de versión en `index.html`.

- [ ] **Step 3: Verify styles and syntax**

Run: `grep -n "livev2-player-summary\|livev2-row-chevron" css/styles.css`
Expected: las dos clases aparecen.

Run: `node --check js/live-v2-ui.js && node --check js/main.js`
Expected: sin salida y exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `node --test tests/*.test.js`
Expected: todos los tests PASS.

- [ ] **Step 5: Manual QA**

Run: `node server.mjs` y abrir `http://localhost:8080/?liveSim=1` en modo móvil vertical.

Comprobar:
- Click en una fila abre el modal con el nombre correcto.
- Enter y Espacio sobre una fila enfocada abren el mismo modal.
- El resumen es la suma de los partidos Live mostrados y puede diferir del delta de la fila o del total de cabecera cuando un partido `FT` ya está finalizado y contabilizado en `officialPoints`.
- No aparece ningún partido `NS`.
- Sin pronóstico y sin jugadores muestran sus mensajes.
- El modal se actualiza tras un poll sin perder el scroll.
- Escape, botón ✕ y click en el fondo cierran el modal.
- Al cerrar, el foco vuelve a la fila de origen.
- Abrir un chip de partido cierra el modal de jugador y viceversa.
- Con `prefers-reduced-motion` no hay scale en `:active`.

- [ ] **Step 6: Commit**

```bash
git add css/styles.css index.html
git commit -m "style(live): estilos y cache-bust del desglose de jugador"
```

---

## Self-Review

- **Cobertura del spec:** modal con resumen y partidos (Tasks 1-2), refresco y ciclo de vida (Task 3), filas interactivas (Task 4), estilos y cache-bust (Task 5), tests en todas las tareas.
- **Placeholders:** ninguno; cada paso incluye código o comandos exactos.
- **Consistencia de tipos:** `liveV2PlayerMatches` devuelve `prediction`, `predictionPts`, `predictionBreakdown`, `squadPts`, `squadDetail` y `total`, que son exactamente los campos que consumen `liveV2PlayerSummary` y `liveV2PlayerModalHtml`.
- **Dependencia entre tareas:** Task 4 referencia `openLiveV2PlayerModal`, que se implementa en Task 3. Cada commit deja el árbol funcional: primero el modal, después el binding que lo abre.
