const test = require('node:test');
const assert = require('node:assert/strict');
const {
  liveV2ChipLabel,
  liveV2StatusBadge,
  liveV2NextPollState,
  fetchLiveEvents,
  init,
  enterLiveV2Fullscreen,
  exitLiveV2Fullscreen,
  bindLiveV2Fullscreen,
  liveV2SkeletonHtml,
  liveV2ShowReason,
  renderLiveV2Html,
  liveV2CacheKey,
  liveV2CacheIsFresh,
  purgeLiveV2Caches,
  liveV2SoundQuality,
  liveV2EventDeltas,
  liveV2PlayNewEventSounds,
  liveV2TopContributions,
  liveV2ReasonLine,
  liveV2ReasonHtml,
  liveV2CountdownState,
  liveV2CountdownHtml,
} = require('../js/live-v2-ui.js');

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

test('liveV2ChipLabel sin estado devuelve NS', () => {
  assert.equal(liveV2ChipLabel(null), 'NS');
  assert.equal(liveV2ChipLabel(undefined), 'NS');
});

test('liveV2ChipLabel devuelve NS, HT y FT', () => {
  assert.equal(liveV2ChipLabel({ status: 'NS' }), 'NS');
  assert.equal(liveV2ChipLabel({ status: 'HT' }), 'HT');
  assert.equal(liveV2ChipLabel({ status: 'FT' }), 'FT');
});

test('liveV2ChipLabel en LIVE usa el minuto y cae a LIVE sin minuto', () => {
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: 63 }), "LIVE 63'");
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: 0 }), "LIVE 0'");
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: null }), 'LIVE');
});

test('liveV2ChipLabel calcula el minuto con el reloj del servidor', () => {
  const liveV2 = require('../js/liveV2.js');
  init({ AppState: { liveV2: null, matches: [], allPlayers: [] }, liveV2Api: liveV2 });
  const state = {
    status: 'LIVE', kickoffTs: '2026-09-16T20:00:00Z', period: 'period1', lastMinute: 0,
  };
  assert.equal(liveV2ChipLabel(state, Date.parse('2026-09-16T21:03:00Z')), "LIVE 63'");
});

test('liveV2StatusBadge marca error y deja el título con la última actualización', () => {
  const badge = liveV2StatusBadge({ error: true, lastFetchAt: Date.now() - 42000 });
  assert.equal(badge.text, '⚠️ Sin conexión');
  assert.equal(badge.cls, 'error');
  assert.match(badge.title, /^Actualizado hace 4[12]s$/);
});

test('liveV2StatusBadge marca stale a partir de 91 s', () => {
  const badge = liveV2StatusBadge({ error: null, lastFetchAt: Date.now() - 95000 });
  assert.equal(badge.cls, 'stale');
  assert.match(badge.text, /^⏸ Datos de hace 9[45]s$/);
  assert.match(badge.title, /^Actualizado hace 9[45]s$/);
});

test('liveV2StatusBadge está en directo con datos recientes', () => {
  const badge = liveV2StatusBadge({ error: null, lastFetchAt: Date.now() - 30000 });
  assert.deepEqual(badge, { text: '● EN DIRECTO', cls: 'live', title: 'Actualizado hace 30s' });
});

test('liveV2StatusBadge sin lastFetchAt indica que no hay actualización', () => {
  const badge = liveV2StatusBadge({ error: null, lastFetchAt: null });
  assert.equal(badge.cls, 'live');
  assert.equal(badge.title, 'Sin actualizar');
});

test('liveV2StatusBadge cambia a stale justo después de 90 s', () => {
  assert.equal(liveV2StatusBadge({ error: null, lastFetchAt: Date.now() - 90000 }).cls, 'live');
  assert.equal(liveV2StatusBadge({ error: null, lastFetchAt: Date.now() - 91000 }).cls, 'stale');
});

test('liveV2NextPollState limpia el error y fija la hora en éxito', () => {
  const next = liveV2NextPollState({ lastFetchAt: 100, error: true }, true, 200);
  assert.deepEqual(next, { lastFetchAt: 200, error: null });
});

test('liveV2NextPollState conserva lastFetchAt y marca error en fallo', () => {
  const next = liveV2NextPollState({ lastFetchAt: 100, error: null }, false, 200);
  assert.deepEqual(next, { lastFetchAt: 100, error: true });
});

test('fetchLiveEvents con payload.ok=false lanza y no pisa el estado previo', async () => {
  const AppState = {
    liveV2: {
      events: [{ id: 'previo' }],
      serverTime: '2026-10-19T10:00:00Z',
      lastFetchAt: 123,
      error: null,
      _fullAt: 456,
    },
  };
  init({
    AppState,
    API_BASE: 'https://api.test',
    fetchWithPhase: async () => ({ ok: true, json: async () => ({ ok: false, error: 'sin eventos' }) }),
    liveV2Api: { eventKey: e => e.id },
  });

  await assert.rejects(() => fetchLiveEvents(true), /sin eventos/);
  assert.deepEqual(AppState.liveV2.events, [{ id: 'previo' }]);
  assert.equal(AppState.liveV2.lastFetchAt, 123);
  assert.equal(AppState.liveV2._fullAt, 456);
  assert.equal(AppState.liveV2.error, true);
});

function setupDom() {
  const bodyClasses = new Set();
  const toggleClasses = new Set();
  const toggleAttrs = {};
  const listeners = {};
  let fullscreenEl = null;
  const makeClassList = (set) => ({
    add: c => set.add(c),
    remove: c => set.delete(c),
    toggle: (c, on) => { if (on) set.add(c); else set.delete(c); },
    contains: c => set.has(c),
  });
  const toggle = {
    textContent: '',
    dataset: {},
    classList: makeClassList(toggleClasses),
    setAttribute: (k, v) => { toggleAttrs[k] = v; },
    addEventListener: (type, fn) => { toggle[`on${type}`] = fn; },
  };
  const doc = {
    body: { classList: makeClassList(bodyClasses) },
    documentElement: {
      requestFullscreen: () => {
        fullscreenEl = doc.documentElement;
        return Promise.resolve();
      },
    },
    get fullscreenElement() { return fullscreenEl; },
    set fullscreenElement(v) { fullscreenEl = v; },
    exitFullscreen: () => { fullscreenEl = null; return Promise.resolve(); },
    querySelector: sel => (sel === '#livev2-fs-toggle' ? toggle : null),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: () => {},
    createElement: () => makeElement(),
  };
  return { doc, bodyClasses, toggleClasses, toggleAttrs, listeners, toggle };
}

function makeElement() {
  const attrs = {};
  return {
    className: '',
    textContent: '',
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k]; },
    remove() {},
  };
}

function setupHistory() {
  const stack = [{ state: null }];
  return {
    pushCount: 0,
    backCount: 0,
    get state() { return stack[stack.length - 1].state; },
    pushState(state) { stack.push({ state }); this.pushCount++; },
    back() { this.backCount++; if (stack.length > 1) stack.pop(); },
  };
}

function freshUi() {
  const file = require.resolve('../js/live-v2-ui.js');
  delete require.cache[file];
  return require('../js/live-v2-ui.js');
}

function withFullscreenGlobals(dom, hist, fn) {
  const prevDoc = global.document;
  const prevHistory = global.history;
  global.document = dom.doc;
  global.history = hist;
  try {
    fn();
  } finally {
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
    if (prevHistory === undefined) delete global.history; else global.history = prevHistory;
  }
}

test('fullscreen entra con historial y mantiene salida en el skeleton', () => {
  const ui = freshUi();
  const dom = setupDom();
  const hist = setupHistory();
  withFullscreenGlobals(dom, hist, () => {
    ui.enterLiveV2Fullscreen();
    assert.ok(dom.bodyClasses.has('live-fs'));
    assert.equal(hist.pushCount, 1);
    assert.deepEqual(hist.state, { liveFs: true });
    assert.equal(dom.toggle.textContent, '⤡');
    const skeleton = ui.liveV2SkeletonHtml('<div class="skeleton-row"></div>');
    assert.match(skeleton, /id="livev2-fs-toggle"/);
    assert.ok(skeleton.includes('⤡'));
    assert.match(skeleton, /aria-label="Salir de pantalla completa"/);
  });
});

test('Escape y popstate salen de pantalla completa', () => {
  const ui = freshUi();
  const dom = setupDom();
  const hist = setupHistory();
  withFullscreenGlobals(dom, hist, () => {
    ui.bindLiveV2Fullscreen();
    ui.enterLiveV2Fullscreen();
    let prevented = false;
    dom.listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
    assert.ok(prevented);
    assert.ok(!dom.bodyClasses.has('live-fs'));
    assert.equal(hist.backCount, 1);
    assert.equal(hist.state, null);

    ui.enterLiveV2Fullscreen();
    hist.back();
    dom.listeners.popstate();
    assert.ok(!dom.bodyClasses.has('live-fs'));
    assert.equal(hist.backCount, 2);
    assert.equal(hist.state, null);
  });
});

test('Escape con el popup de partido abierto no sale de pantalla completa', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: { _openMatchModal: '1' } }, liveV2Api: {} });
  const dom = setupDom();
  const hist = setupHistory();
  withFullscreenGlobals(dom, hist, () => {
    ui.bindLiveV2Fullscreen();
    ui.enterLiveV2Fullscreen();
    let prevented = false;
    dom.listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
    assert.ok(dom.bodyClasses.has('live-fs'));
    assert.equal(prevented, false);
  });
});

test('el motivo del cambio usa aria-live polite', () => {
  const ui = freshUi();
  const created = [];
  const prevDoc = global.document;
  const prevRaf = global.requestAnimationFrame;
  const prevSetTimeout = global.setTimeout;
  global.document = { createElement: () => { const el = makeElement(); created.push(el); return el; } };
  global.requestAnimationFrame = fn => fn();
  global.setTimeout = () => 0;
  try {
    ui.init({ AppState: { liveV2: null }, liveV2Api: { escapeHtml: s => String(s) } });
    const container = { querySelectorAll: () => [], appendChild: () => {} };
    ui.liveV2ShowReason(container, { offsetTop: 10, offsetHeight: 44 }, {
      lines: [{ icon: '⚽', text: 'Gol de X', delta: 3 }],
      total: 3,
      more: 1,
    });
    assert.equal(created.length, 1);
    assert.equal(created[0].getAttribute('aria-live'), 'polite');
    assert.match(created[0].innerHTML, /Gol de X/);
    assert.match(created[0].innerHTML, /\+1 más/);
    assert.match(created[0].innerHTML, /Total/);
  } finally {
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
    if (prevRaf === undefined) delete global.requestAnimationFrame; else global.requestAnimationFrame = prevRaf;
    if (prevSetTimeout === undefined) delete global.setTimeout; else global.setTimeout = prevSetTimeout;
  }
});

test('render Live v2 anuncia filas/feed y conserva la salida', () => {
  const ui = freshUi();
  ui.init({
    AppState: { liveV2: null, matches: [], allPlayers: [], squadsCache: {}, currentUser: null },
    liveV2Api: { escapeHtml: s => String(s) },
  });
  const html = ui.renderLiveV2Html([], { states: {} });
  assert.match(html, /id="livev2-toasts"[^>]*aria-live="polite"/);
  assert.match(html, /id="livev2-rows"[^>]*aria-live="polite"/);
  assert.match(html, /id="livev2-fs-toggle"/);
});

test('liveV2HasInPlay solo cuenta LIVE y HT', () => {
  const { liveV2HasInPlay: has } = require('../js/live-v2-ui.js');
  assert.equal(has({ states: {} }), false);
  assert.equal(has({ states: { 1: { status: 'NS' }, 2: { status: 'FT' } } }), false);
  assert.equal(has({ states: { 1: { status: 'LIVE' } } }), true);
  assert.equal(has({ states: { 1: { status: 'NS' }, 2: { status: 'HT' } } }), true);
});

test('liveV2ShouldPoll evita peticiones fuera de la ventana de partido', () => {
  const ui = freshUi();
  const now = Date.now();
  const AppState = {
    liveRefreshSecs: 30,
    matches: [{ id: 1, fechaTs: Math.floor((now + 60 * 60 * 1000) / 1000) }],
  };
  ui.init({ AppState, liveV2Api: { eventKey: e => e.id } });
  assert.equal(ui.liveV2ShouldPoll({ states: {} }, now), false);
  assert.equal(ui.liveV2ShouldPoll({ states: { 1: { status: 'LIVE' } } }, now), true);

  AppState.matches = [{ id: 1, fechaTs: Math.floor(now / 1000) }];
  assert.equal(ui.liveV2ShouldPoll({ states: {} }, now), true);
  assert.equal(ui.liveV2ShouldPoll({ states: { 1: { status: 'FT' } } }, now), false);
});

test('liveV2ShouldPoll devuelve true mientras hay que forzar un full', () => {
  const ui = freshUi();
  const now = Date.now();
  const AppState = {
    liveRefreshSecs: 30,
    matches: [],
    liveV2: {
      events: [], serverTime: '2026-10-19T10:00:00Z', prevRanks: null, polling: false,
      _lastRows: [], _fullAt: 1, _needFull: true, lastFetchAt: null, error: null,
    },
  };
  ui.init({ AppState, liveV2Api: { eventKey: e => e.id } });
  assert.equal(ui.liveV2ShouldPoll({ states: {} }, now), true);
  AppState.liveV2._needFull = false;
  assert.equal(ui.liveV2ShouldPoll({ states: {} }, now), false);
});

test('liveV2ShouldPoll activo con liveSim en localhost', () => {
  const ui = freshUi();
  const now = Date.now();
  const AppState = { liveRefreshSecs: 30, matches: [], liveV2: { events: [], serverTime: null, _needFull: false } };
  ui.init({
    AppState,
    liveV2Api: { eventKey: e => e.id, wantSimSource: (search, host) => host === 'localhost' && search === '?liveSim=1' }
  });
  const prev = global.window;
  global.window = { location: { search: '?liveSim=1', hostname: 'localhost' } };
  try {
    assert.equal(ui.liveV2ShouldPoll({ states: {} }, now), true);
  } finally {
    if (prev === undefined) delete global.window; else global.window = prev;
  }
});

function jsonResponse(payload, serverTime) {
  return {
    ok: true,
    headers: { get: h => (h === 'X-Server-Time' ? (serverTime || null) : null) },
    json: async () => payload,
  };
}

test('fetchLiveEvents guarda X-Server-Time y el reloj avanza entre eventos', async () => {
  const liveV2 = require('../js/liveV2.js');
  const T1 = '2026-09-16T20:00:00Z';
  const T2 = '2026-09-16T21:03:00Z';
  let call = 0;
  const AppState = {
    liveV2: {
      events: [], serverTime: T1, prevRanks: null, polling: false, _lastRows: [],
      _fullAt: 0, _needFull: false, lastFetchAt: null, error: null,
    },
    matches: [], allPlayers: [],
  };
  const fetchWithPhase = async () => {
    const t = call++ === 0 ? T1 : T2;
    return jsonResponse({
      ok: true, serverTime: t,
      events: [{ eventId: 100, type: 'status', ts: T1, sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: T1 } }],
    }, t);
  };
  init({ AppState, API_BASE: 'https://api.test', fetchWithPhase, liveV2Api: liveV2 });

  await fetchLiveEvents(true);
  const st = AppState.liveV2;
  assert.equal(st.serverNow, T1);
  const fold1 = liveV2.foldAll(st.events, { 100: { homeTeamId: 1, awayTeamId: 2 } });
  assert.equal(liveV2.matchClockAt(fold1[100], Date.parse(T1)), 0);

  await fetchLiveEvents(false);
  assert.equal(st.serverNow, T2);
  const fold2 = liveV2.foldAll(st.events, { 100: { homeTeamId: 1, awayTeamId: 2 } });
  assert.equal(liveV2.matchClockAt(fold2[100], Date.parse(st.serverNow)), 63);
});

test('fetchLiveEvents ejecuta el resync al momento y reemplaza con el full', async () => {
  const AppState = {
    currentUser: { name: 'juan' },
    liveV2: {
      events: [{ eventId: 1, sourceId: 'old', type: 'goal', payload: {} }],
      serverTime: '2026-10-19T10:00:00Z', prevRanks: { juan: 1 }, polling: false,
      _lastRows: [], _fullAt: 1, _needFull: false, lastFetchAt: null, error: null,
    },
    matches: [], allPlayers: [],
  };
  let calls = 0;
  const fetchWithPhase = async () => {
    calls++;
    if (calls === 1) {
      return jsonResponse({
        ok: true, resync: true, serverTime: '2026-10-19T10:01:00Z',
        events: [{ eventId: 9, sourceId: 'partial', type: 'goal', payload: {} }],
      }, '2026-10-19T10:01:00Z');
    }
    return jsonResponse({
      ok: true, resync: false, serverTime: '2026-10-19T10:02:00Z',
      events: [
        { eventId: 2, sourceId: 'full-a', type: 'goal', payload: {} },
        { eventId: 3, sourceId: 'full-b', type: 'goal', payload: {} },
      ],
    }, '2026-10-19T10:02:00Z');
  };
  init({ AppState, API_BASE: 'https://api.test', fetchWithPhase, liveV2Api: { eventKey: e => e.sourceId } });

  await fetchLiveEvents(false);
  assert.equal(calls, 2, 'el resync dispara un full inmediato');
  assert.deepEqual(AppState.liveV2.events.map(e => e.sourceId), ['full-a', 'full-b']);
  assert.equal(AppState.liveV2.serverTime, '2026-10-19T10:02:00Z');
  assert.equal(AppState.liveV2._needFull, false);
  assert.equal(AppState.liveV2.prevRanks, null);
});

test('un full con serverTime null resetea el cursor', async () => {
  const AppState = {
    liveV2: {
      events: [{ eventId: 1, sourceId: 'old' }], serverTime: '2026-10-19T10:00:00Z',
      prevRanks: null, polling: false, _lastRows: [], _fullAt: 1, _needFull: true,
      lastFetchAt: null, error: null,
    },
    matches: [], allPlayers: [],
  };
  const fetchWithPhase = async () => jsonResponse(
    { ok: true, serverTime: null, events: [] }, '2026-10-19T10:05:00Z');
  init({ AppState, API_BASE: 'https://api.test', fetchWithPhase, liveV2Api: { eventKey: e => e.id } });

  await fetchLiveEvents(true);
  assert.equal(AppState.liveV2.serverTime, null);
  assert.equal(AppState.liveV2._needFull, false);
  assert.equal(AppState.liveV2.serverNow, '2026-10-19T10:05:00Z');
});

test('un full conserva el marcador previo y el pulso de cambio', async () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: {
      events: [], serverTime: '2026-09-16T20:00:00Z', prevRanks: null, polling: false,
      _lastRows: [], _fullAt: 1, _needFull: false, lastFetchAt: null, error: null,
      _chipScores: { 1: '0-0' }, _chipChanged: { 1: 123 }, _chipPulse: {},
      _chipUserPoints: { 1: 0 }, _rankMoves: {},
    },
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [] },
    matchStats: [],
  };
  const events = [
    { eventId: 1, type: 'status', ts: '2026-09-16T20:00:00Z', sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00Z' } },
    { eventId: 1, type: 'goal', ts: '2026-09-16T20:30:00Z', sourceId: 'g', payload: { isHome: true, scorerId: 11 } },
  ];
  ui.init({
    AppState,
    API_BASE: 'https://api.test',
    fetchWithPhase: async () => jsonResponse({ ok: true, serverTime: '2026-09-16T20:30:00Z', events }, '2026-09-16T20:30:00Z'),
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 5, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });

  await ui.fetchLiveEvents(true);
  const folded = {
    states: liveV2.foldAll(AppState.liveV2.events, { 1: { homeTeamId: 1, awayTeamId: 2 } }),
    statsById: {},
  };
  assert.deepEqual(folded.states[1].score, { home: 1, away: 0 });
  ui.liveV2DetectChipChanges(folded);
  assert.equal(AppState.liveV2._chipPulse['1'].state, 'fav');
  assert.equal(AppState.liveV2._chipScores['1'], '1-0');
  assert.notEqual(AppState.liveV2._chipChanged['1'], undefined);
});

test('liveV2CacheKey incluye día local y usuario', () => {
  const now = new Date(2026, 9, 19, 12, 0, 0).getTime();
  assert.equal(liveV2CacheKey('juan', now), 'porra_live_events_v1:2026-10-19:juan');
});

test('liveV2CacheIsFresh exige eventos, cursor y fullAt', () => {
  assert.equal(liveV2CacheIsFresh({ events: [], serverTime: 'T', fullAt: 1 }), true);
  assert.equal(liveV2CacheIsFresh({ events: [], serverTime: 'T' }), false);
  assert.equal(liveV2CacheIsFresh({ events: [], serverTime: null, fullAt: 1 }), false);
  assert.equal(liveV2CacheIsFresh(null), false);
});

test('restoreLiveV2Cache ignora claves de otro día', () => {
  const ui = freshUi();
  const saved = JSON.stringify({
    events: [{ eventId: 1, sourceId: 'a' }], serverTime: '2026-10-18T10:00:00Z', fullAt: 1,
  });
  const store = { 'porra_live_events_v1:2026-10-18:juan': saved };
  const prev = global.localStorage;
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  try {
    const AppState = { currentUser: { name: 'juan' }, liveV2: null };
    ui.init({ AppState, liveV2Api: {} });
    const st = ui.liveV2State();
    assert.equal(st.serverTime, null, 'la caché de ayer no se restaura');
    assert.deepEqual(st.events, []);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});

test('purgeLiveV2Caches elimina solo las claves del live', () => {
  const store = {
    a: 'x',
    'porra_live_events_v1:2026-10-19:juan': '{}',
    'porra_live_events_v1:2026-10-18:ana': '{}',
    other: 'y',
  };
  const storage = {
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
    removeItem: k => { delete store[k]; },
  };
  assert.equal(purgeLiveV2Caches(storage), 2);
  assert.deepEqual(Object.keys(store), ['a', 'other']);
});

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
    calculatePlayerMatchPoints: (jd) => ({ total: (jd.goles || 0) + (jd.asistencias || 0), desglose: [] })
  });
  const t = '2026-09-16T20:30:00.000Z';
  const live = { eventId: 1, type: 'status', minute: 0, ts: '2026-09-16T20:00:00.000Z', ingestedAt: '2026-09-16T20:00:00.000Z', seq: 0, sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00.000Z' } };
  const goal = { eventId: 1, type: 'goal', minute: 30, ts: t, ingestedAt: t, seq: 0, sourceId: 'g', payload: { scorerId: 13, isHome: true } };
  const assist = { eventId: 1, type: 'assist', minute: 30, ts: t, ingestedAt: t, seq: 1, sourceId: 'a', playerId: 12, payload: { asistencias: 1 } };
  const res = liveV2EventDeltas('me', 1, [goal, assist], [live, goal, assist],
    { homeTeamId: 1, awayTeamId: 2 },
    { 13: { nombre: 'F', posicion: 'F', equipo: 1 }, 12: { nombre: 'M', posicion: 'M', equipo: 1 } },
    null);
  assert.equal(res.before, 0);
  assert.equal(res.after, 10);
  assert.deepEqual(res.events.map(d => d.delta), [9, 1]);
});

test('liveV2EventDeltas no atribuye puntos si el estado previo es NS', () => {
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    liveV2: null,
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 0, away: 0 } } },
    squadsCache: { me: [{ id: 13, posicion: 'F', equipo: 1 }] },
    matchStats: []
  };
  init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: (pred, ms) => ({ points: Number(ms.stats[1]?.goles) === 0 ? 15 : 3 }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] })
  });
  const t = '2026-09-16T20:30:00.000Z';
  const goal = { eventId: 1, type: 'goal', minute: 30, ts: t, ingestedAt: t, seq: 0, sourceId: 'g', payload: { scorerId: 13, isHome: true } };
  const res = liveV2EventDeltas('me', 1, [goal], [goal],
    { homeTeamId: 1, awayTeamId: 2 },
    { 13: { nombre: 'F', posicion: 'F', equipo: 1 } },
    null);
  assert.equal(res.before, 0);
  assert.equal(res.after, 0);
});

test('liveV2EventDeltas aplica los eventos en orden canónico', () => {
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
    calculatePlayerMatchPoints: (jd) => ({ total: (jd.goles || 0) + (jd.asistencias || 0), desglose: [] })
  });
  const t = '2026-09-16T20:30:00.000Z';
  const live = { eventId: 1, type: 'status', minute: 0, ts: '2026-09-16T20:00:00.000Z', ingestedAt: '2026-09-16T20:00:00.000Z', seq: 0, sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00.000Z' } };
  const goal = { eventId: 1, type: 'goal', minute: 30, ts: t, ingestedAt: t, seq: 0, sourceId: 'g', payload: { scorerId: 13, isHome: true } };
  const assist = { eventId: 1, type: 'assist', minute: 30, ts: t, ingestedAt: t, seq: 1, sourceId: 'a', playerId: 12, payload: { asistencias: 1 } };
  const res = liveV2EventDeltas('me', 1, [assist, goal], [live, assist, goal],
    { homeTeamId: 1, awayTeamId: 2 },
    { 13: { nombre: 'F', posicion: 'F', equipo: 1 }, 12: { nombre: 'M', posicion: 'M', equipo: 1 } },
    null);
  assert.equal(res.after, 10);
  assert.deepEqual(res.events.map(d => d.delta), [9, 1]);
});

test('liveV2EventDeltas no atribuye delta al evento status LIVE', () => {
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    liveV2: null,
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 1, away: 1 } } },
    squadsCache: { me: [{ id: 13, posicion: 'F', equipo: 1 }] },
    matchStats: []
  };
  init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8 }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] })
  });
  const live = { eventId: 1, type: 'status', minute: 0, ts: '2026-09-16T20:00:00.000Z', ingestedAt: '2026-09-16T20:00:00.000Z', seq: 0, sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00.000Z' } };
  const res = liveV2EventDeltas('me', 1, [live], [live],
    { homeTeamId: 1, awayTeamId: 2 },
    { 13: { nombre: 'F', posicion: 'F', equipo: 1 } },
    null);
  assert.equal(res.before, 0);
  assert.equal(res.after, 8);
  assert.deepEqual(res.events, []);
});

test('liveV2TopContributions ordena por impacto, descarta ceros y limita a 3', () => {
  const list = [{ delta: 1 }, { delta: -5 }, { delta: 0 }, { delta: 3 }, { delta: 2 }];
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

test('liveV2EventDeltas no deja que status LIVE tape el delta del gol', () => {
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    liveV2: null,
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 1, away: 1 } } },
    squadsCache: { me: [{ id: 13, posicion: 'F', equipo: 1 }] },
    matchStats: []
  };
  init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: (pred, ms) => ({ points: (Number(ms.stats[1]?.goles) + Number(ms.stats[2]?.goles)) === 1 ? 8 : 0 }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] })
  });
  const live = { eventId: 1, type: 'status', minute: 0, ts: '2026-09-16T20:00:00.000Z', ingestedAt: '2026-09-16T20:00:00.000Z', seq: 0, sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00.000Z' } };
  const goal = { eventId: 1, type: 'goal', minute: 30, ts: '2026-09-16T20:30:00.000Z', ingestedAt: '2026-09-16T20:30:00.000Z', seq: 0, sourceId: 'g', payload: { scorerId: 13, isHome: true } };
  const res = liveV2EventDeltas('me', 1, [live, goal], [live, goal],
    { homeTeamId: 1, awayTeamId: 2 },
    { 13: { nombre: 'F', posicion: 'F', equipo: 1 } },
    null);
  assert.equal(res.events.length, 1);
  assert.equal(res.events[0].event, goal);
  assert.equal(res.events[0].delta, 8);
});

// ── Sonido integrado por partido/poll ────────────────────────────────

function withSoundApp({ newEvents, matchStats = [], matchPoints, playerPoints, allPredictions = {}, squadsCache = {} }) {
  const liveV2 = require('../js/liveV2.js');
  const calls = [];
  const prevLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '1' };
  const live = { eventId: 1, type: 'status', minute: 0, ts: '2026-09-16T20:00:00.000Z', ingestedAt: '2026-09-16T20:00:00.000Z', seq: 0, sourceId: 's', payload: { status: 'LIVE', period: 'period1', kickoffTs: '2026-09-16T20:00:00.000Z' } };
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: { events: [live, ...newEvents] },
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [
      { id: 13, nombre: 'F', posicion: 'F', equipo: 1 },
      { id: 12, nombre: 'M', posicion: 'M', equipo: 1 },
    ],
    allPredictions,
    squadsCache,
    matchStats,
  };
  init({
    AppState,
    liveV2Api: liveV2,
    soundApi: {
      loadSoundEnabled: () => true,
      playLiveEvent: (event, quality) => calls.push({ event, quality }),
    },
    calculateMatchPoints: matchPoints,
    calculatePlayerMatchPoints: playerPoints,
  });
  try {
    liveV2PlayNewEventSounds(newEvents);
  } finally {
    if (prevLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLocalStorage;
  }
  return calls;
}

function soundGoal() {
  const t = '2026-09-16T20:30:00.000Z';
  return { eventId: 1, type: 'goal', minute: 30, ts: t, ingestedAt: t, seq: 0, sourceId: 'g', payload: { scorerId: 13, isHome: true } };
}

function soundAssist() {
  const t = '2026-09-16T20:30:00.000Z';
  return { eventId: 1, type: 'assist', minute: 30, ts: t, ingestedAt: t, seq: 1, sourceId: 'a', playerId: 12, payload: { asistencias: 1 } };
}

test('liveV2PlayNewEventSounds: dos eventos con puntos producen un solo tono bueno', () => {
  const calls = withSoundApp({
    newEvents: [soundGoal(), soundAssist()],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [{ id: 13, posicion: 'F', equipo: 1 }, { id: 12, posicion: 'M', equipo: 1 }] },
    matchPoints: (pred, ms) => ({ points: Number(ms.stats[1]?.goles) === 1 ? 8 : 0, breakdown: [] }),
    playerPoints: (jd) => ({ total: (jd.goles || 0) + (jd.asistencias || 0), desglose: [] }),
  });
  assert.deepEqual(calls, [{ event: { type: 'goal' }, quality: 'good' }]);
});

test('liveV2PlayNewEventSounds: partido finalizado no suena (ni puntos ni FT)', () => {
  const ft = { eventId: 1, type: 'status', minute: 90, ts: '2026-09-16T21:50:00.000Z', ingestedAt: '2026-09-16T21:50:00.000Z', seq: 2, sourceId: 'ft', payload: { status: 'FT' } };
  const calls = withSoundApp({
    newEvents: [ft, soundGoal()],
    matchStats: [{ eventId: 1 }],
    matchPoints: () => ({ points: 8, breakdown: [] }),
    playerPoints: () => ({ total: 1, desglose: [] }),
  });
  assert.deepEqual(calls, []);
});

test('liveV2PlayNewEventSounds: gol neutro usa el tono neutro', () => {
  const calls = withSoundApp({
    newEvents: [soundGoal()],
    matchPoints: () => ({ points: 0, breakdown: [] }),
    playerPoints: () => ({ total: 0, desglose: [] }),
  });
  assert.deepEqual(calls, [{ event: { type: 'goal' }, quality: 'neutral' }]);
});

test('liveV2PlayNewEventSounds: status FT emite el tono end', () => {
  const ft = { eventId: 1, type: 'status', minute: 90, ts: '2026-09-16T21:50:00.000Z', ingestedAt: '2026-09-16T21:50:00.000Z', seq: 2, sourceId: 'ft', payload: { status: 'FT' } };
  const calls = withSoundApp({
    newEvents: [ft],
    matchPoints: () => ({ points: 0, breakdown: [] }),
    playerPoints: () => ({ total: 0, desglose: [] }),
  });
  assert.deepEqual(calls, [{ event: { type: 'end' }, quality: true }]);
});

test('liveV2FeedViews omite los eventos de nota', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const t = '2026-09-16T20:30:00.000Z';
  const base = { eventId: 1, ts: t, ingestedAt: t, minute: 30, sourceId: 'x' };
  ui.init({
    AppState: {
      liveV2: {
        events: [
          { ...base, type: 'goal', payload: { scorerId: 13 } },
          { ...base, type: 'rating', playerId: 13, payload: { rating: 7.5 } },
        ],
      },
      allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    },
    liveV2Api: liveV2,
  });
  const views = ui.liveV2FeedViews({ states: {} });
  assert.equal(views.length, 1);
  assert.match(views[0].text, /Gol/);
});

test('liveV2DetectRankMoves guarda subidas y bajadas', () => {
  const ui = freshUi();
  const rows = [
    { name: 'A', rank: 1 },
    { name: 'B', rank: 3 },
  ];
  const prev = {
    A: { rank: 3 },
    B: { rank: 2 },
  };
  const moves = ui.liveV2DetectRankMoves(rows, prev, {}, 1000);
  assert.deepEqual(moves, {
    A: { delta: 2, at: 1000 },
    B: { delta: -1, at: 1000 },
  });
});

test('liveV2RankMoveView pinta el cambio y caduca a los 30 s', () => {
  const ui = freshUi();
  assert.deepEqual(ui.liveV2RankMoveView('A', { A: { delta: 2, at: 1000 } }, 1000), {
    text: '▲2', cls: 'up', label: 'Sube 2 puestos',
  });
  assert.deepEqual(ui.liveV2RankMoveView('A', { A: { delta: -1, at: 1000 } }, 1000), {
    text: '▼1', cls: 'down', label: 'Baja 1 puesto',
  });
  assert.deepEqual(ui.liveV2RankMoveView('A', { A: { delta: 2, at: 1000 } }, 31000), {
    text: '=', cls: 'eq', label: 'Sin cambios',
  });
  assert.deepEqual(ui.liveV2RankMoveView('B', {}, 1000), {
    text: '=', cls: 'eq', label: 'Sin cambios',
  });
});

test('renderLiveV2Tab conserva el movimiento de puesto de los últimos 30 s', async () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const now = Date.now();
  const AppState = {
    currentUser: { name: 'me' },
    resultadosTab: 'jornadas',
    liveV2: {
      events: [], serverTime: '2026-09-16T20:00:00Z', prevRanks: null, polling: false,
      _lastRows: [], _fullAt: 1, _needFull: false, lastFetchAt: null, error: null,
      _chipScores: {}, _chipChanged: {}, _chipPulse: {}, _chipUserPoints: {},
      _rankMoves: { me: { delta: 2, at: now } },
    },
    matches: [], allPlayers: [], allPredictions: { me: {} }, squadsCache: { me: [] },
    matchStats: [], liveRefreshSecs: 30,
  };
  ui.init({
    AppState,
    API_BASE: 'https://api.test',
    fetchWithPhase: async () => jsonResponse({ ok: true, serverTime: '2026-09-16T20:00:00Z', events: [] }),
    liveV2Api: liveV2,
    visiblePlayers: () => [{ name: 'me', avatar: '⚽' }],
    getUserTotalRealPoints: () => 0,
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = await ui.renderLiveV2Tab();
  assert.match(html, /livev2-rank-move up/);
  assert.match(html, /▲2/);
  assert.match(html, /0pts/);
});

test('liveV2RowHtml pinta puesto, movimiento y diferencial sin flecha', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: null }, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2RowHtml({
    name: 'Yo', avatar: '⚽', rank: 3, livePoints: 42, pointsDiff: 5, isMe: true,
    rankMove: { text: '▲2', cls: 'up', label: 'Sube 2 puestos' },
  });
  assert.match(html, /livev2-rank-group/);
  assert.match(html, /livev2-rank-move up/);
  assert.match(html, /▲2/);
  assert.match(html, /livev2-pts-diff up/);
  assert.match(html, /\+5pts/);
  assert.match(html, /points-up/);
  assert.doesNotMatch(html, /livev2-arrow/);
});

test('liveV2RowPointsClass marca la fila según el diferencial', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2RowPointsClass(3), ' points-up');
  assert.equal(ui.liveV2RowPointsClass(-2), ' points-down');
  assert.equal(ui.liveV2RowPointsClass(0), '');
});

test('liveV2ApplyPointsClass alterna las clases de color', () => {
  const ui = freshUi();
  const classes = new Set();
  const el = {
    classList: {
      contains: c => classes.has(c),
      add: c => classes.add(c),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
    },
  };
  ui.liveV2ApplyPointsClass(el, 5);
  assert.ok(classes.has('points-up'));
  ui.liveV2ApplyPointsClass(el, -2);
  assert.ok(classes.has('points-down'));
  assert.ok(!classes.has('points-up'));
  ui.liveV2ApplyPointsClass(el, 0);
  assert.equal(classes.size, 0);
});

test('liveV2PointsDiffText, clase y etiqueta', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2PointsDiffText(5), '+5pts');
  assert.equal(ui.liveV2PointsDiffText(-2), '-2pts');
  assert.equal(ui.liveV2PointsDiffText(0), '0pts');
  assert.equal(ui.liveV2PointsDiffClass(5), 'up');
  assert.equal(ui.liveV2PointsDiffClass(-2), 'down');
  assert.equal(ui.liveV2PointsDiffClass(0), 'eq');
  assert.equal(ui.liveV2PointsDiffLabel(5), 'Suma 5 puntos en este refresco');
  assert.equal(ui.liveV2PointsDiffLabel(-2), 'Resta 2 puntos en este refresco');
  assert.equal(ui.liveV2PointsDiffLabel(0), 'Sin cambios de puntos');
});

test('liveV2HeaderBreakdown separa pronostico y plantilla y excluye oficiales', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: null,
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B' }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }] },
    matchStats: [],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: ['8 por acertar resultado'] }),
    calculatePlayerMatchPoints: () => ({ total: 3, desglose: [{ concepto: 'Gol marcado', puntos: 3 }] }),
  });
  const folded = {
    states: { 1: { status: 'LIVE' } },
    statsById: { 1: { 1: { goles: 1 }, 2: { goles: 0 }, jugadores: [{ id: '13', nombre: 'F', posicion: 'F', equipo: 1, puntos: 7, goles: 1, minutos: 60 }] } },
  };
  assert.deepEqual(ui.liveV2HeaderBreakdown(folded), { total: 11, predictionPts: 8, squadPts: 3 });

  AppState.matchStats = [{ eventId: 1 }];
  assert.deepEqual(ui.liveV2HeaderBreakdown(folded), { total: 0, predictionPts: 0, squadPts: 0 });
});

test('liveV2HeaderBreakdownHtml pinta total, pronostico y plantilla', () => {
  const ui = freshUi();
  const html = ui.liveV2HeaderBreakdownHtml({ total: 11, predictionPts: 8, squadPts: 3 });
  assert.match(html, /⚡ <b>11<\/b>/);
  assert.match(html, /Pron\. <b>8<\/b>/);
  assert.match(html, /Plantilla <b>3<\/b>/);
});

test('render Live v2 incluye la cabecera de desglose', () => {
  const ui = freshUi();
  ui.init({
    AppState: { liveV2: null, matches: [], allPlayers: [], squadsCache: {}, currentUser: null },
    liveV2Api: { escapeHtml: s => String(s) },
  });
  const html = ui.renderLiveV2Html([], { states: {}, statsById: {} });
  assert.match(html, /id="livev2-breakdown"/);
});

function liveMatchFixture() {
  return {
    currentUser: { name: 'me' },
    liveV2: null,
    matches: [{
      id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B',
      homeBadgeExt: 'webp', awayBadgeExt: 'webp',
    }],
    allPlayers: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [{ id: 13, nombre: 'F', posicion: 'F', equipo: 1 }] },
    matchStats: [],
  };
}

test('liveV2MatchBreakdown devuelve pronostico y plantilla', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = liveMatchFixture();
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: ['8 por acertar resultado'] }),
    calculatePlayerMatchPoints: () => ({ total: 3, desglose: [{ concepto: 'Gol marcado', puntos: 3 }] }),
  });
  const state = {
    status: 'LIVE', score: { home: 1, away: 0 },
    players: {
      13: {
        id: 13, rating: 7, goals: 1, assists: 0, penaltyScored: 0, penaltySaved: 0,
        cards: [], onPitch: true, entered: true, entryMinute: 0, exitMinute: null, goalsReceived: 0,
      },
    },
    goals: [],
    kickoffTs: '2026-09-16T20:00:00Z', lastMinute: 60,
  };
  const d = ui.liveV2MatchBreakdown(1, state);
  assert.equal(d.prediction.home, 1);
  assert.equal(d.prediction.away, 0);
  assert.equal(d.predictionPts, 8);
  assert.equal(d.squadPts, 3);
  assert.equal(d.total, 11);
  assert.equal(d.status, 'LIVE');
});

test('liveV2MatchBreakdown en NS no da puntos pero conserva el pronostico', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = liveMatchFixture();
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 3, desglose: [] }),
  });
  const d = ui.liveV2MatchBreakdown(1, { status: 'NS', score: { home: 0, away: 0 }, players: {} });
  assert.equal(d.prediction.home, 1);
  assert.equal(d.predictionPts, 0);
  assert.equal(d.squadPts, 0);
  assert.equal(d.total, 0);
  assert.equal(d.label, 'NS');
});

test('liveV2MatchBreakdown incluye a un jugador de plantilla que jugó con 0 puntos', () => {
  const ui = freshUi();
  const AppState = liveMatchFixture();
  ui.init({
    AppState,
    liveV2Api: {
      matchStateToStats: () => ({
        1: { goles: 0 }, 2: { goles: 0 },
        jugadores: [{ id: '13', nombre: 'F', posicion: 'F', equipo: 1, minutos: 60 }],
      }),
      escapeHtml: s => String(s),
    },
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const d = ui.liveV2MatchBreakdown(1, { status: 'LIVE', score: { home: 0, away: 0 } });
  assert.equal(d.squadDetail.length, 1);
  assert.equal(d.squadDetail[0].puntos, 0);
  assert.equal(d.squadPts, 0);
  assert.equal(d.total, 0);
});

test('liveV2MatchModalHtml pinta pronostico, plantilla, total y aviso NS', () => {
  const ui = freshUi();
  ui.init({ AppState: {}, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2MatchModalHtml({
    meta: { homeTeam: 'A', awayTeam: 'B', homeTeamId: 1, awayTeamId: 2, homeBadgeExt: 'webp', awayBadgeExt: 'webp' },
    status: 'NS',
    label: 'NS',
    score: { home: 0, away: 0 },
    loggedIn: true,
    prediction: { home: 1, away: 0 },
    predictionPts: 0,
    predictionBreakdown: [],
    squadPts: 0,
    squadDetail: [],
    total: 0,
  });
  assert.match(html, /Tú 1-0/);
  assert.match(html, /Pronóstico/);
  assert.match(html, /Plantilla/);
  assert.match(html, /El partido aún no ha empezado/);
  assert.doesNotMatch(html, /Ningún jugador de tu plantilla/);
});

test('liveV2MatchModalHtml muestra un solo total y ninguno sin sesion', () => {
  const ui = freshUi();
  ui.init({ AppState: {}, liveV2Api: { escapeHtml: s => String(s) } });
  const base = {
    meta: { homeTeam: 'A', awayTeam: 'B', homeTeamId: 1, awayTeamId: 2, homeBadgeExt: 'webp', awayBadgeExt: 'webp' },
    status: 'LIVE', label: "LIVE 60'", score: { home: 1, away: 0 }, loggedIn: true,
    prediction: { home: 1, away: 0 }, predictionPts: 8, predictionBreakdown: [], squadPts: 3, squadDetail: [], total: 11,
  };
  const html = ui.liveV2MatchModalHtml(base);
  assert.equal((html.match(/Total:/g) || []).length, 1);
  const loggedOut = ui.liveV2MatchModalHtml({ ...base, loggedIn: false });
  assert.doesNotMatch(loggedOut, /Total:/);
  assert.match(loggedOut, /Inicia sesión para ver tu desglose/);
});

test('refreshLiveV2MatchModal conserva el scroll y devuelve el foco al cerrar', () => {
  const ui = freshUi();
  const state = { active: { id: 'inside-modal' } };
  const content = { scrollTop: 0 };
  const close = { focused: 0, focus() { this.focused++; } };
  const host = {
    _html: '',
    contains(node) { return node === state.active; },
    querySelector(sel) {
      if (sel === '.livev2-match-content') return content;
      if (sel === '.breakdown-modal-close') return close;
      return null;
    },
    set innerHTML(v) {
      this._html = v;
      content.scrollTop = 0;
      close.focused = 0;
    },
    get innerHTML() { return this._html; },
  };
  const doc = {
    getElementById: id => (id === 'livev2-match-modal' ? host : null),
    get activeElement() { return state.active; },
    createElement: () => makeElement(),
  };
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: {
      events: [], _openMatchModal: '1', _chipScores: {}, _chipChanged: {},
      _chipUserPoints: {}, _chipPulse: {}, _rankMoves: {},
    },
    matches: [{
      id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B',
      homeBadgeExt: 'webp', awayBadgeExt: 'webp',
    }],
    allPlayers: [],
    allPredictions: { me: {} },
    squadsCache: { me: [] },
    matchStats: [],
  };
  ui.init({
    AppState,
    liveV2Api: {
      foldAll: () => ({ 1: { status: 'LIVE', score: { home: 1, away: 0 } } }),
      matchStateToStats: () => ({ 1: { goles: 1 }, 2: { goles: 0 }, jugadores: [] }),
      escapeHtml: s => String(s),
    },
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  content.scrollTop = 120;
  const prevDoc = global.document;
  global.document = doc;
  try {
    ui.refreshLiveV2MatchModal();
  } finally {
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
  }
  assert.equal(content.scrollTop, 120);
  assert.equal(close.focused, 1);
});

test('liveV2ChipEventId resuelve el chip desde el target', () => {
  const ui = freshUi();
  const chip = { getAttribute: k => (k === 'data-livev2-chip' ? '1' : null) };
  const target = { closest: sel => (sel === '[data-livev2-chip]' ? chip : null) };
  assert.equal(ui.liveV2ChipEventId(target), '1');
  assert.equal(ui.liveV2ChipEventId({ closest: () => null }), null);
  assert.equal(ui.liveV2ChipEventId(null), null);
});

test('el chip muestra el pronostico propio', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: null,
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B', homeBadgeExt: 'webp', awayBadgeExt: 'webp' }],
      allPlayers: [],
      allPredictions: { me: { 1: { home: 2, away: 1 } } },
      squadsCache: {},
      matchStats: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: () => 'A',
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = ui.renderLiveV2Html([], { states: { 1: { status: 'LIVE', lastMinute: 63, score: { home: 1, away: 0 } } }, statsById: {} });
  assert.match(html, /livev2-cell-pred/);
  assert.match(html, /Tú 2-1/);
});

test('el chip muestra S/P sin pronostico', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: null,
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B', homeBadgeExt: 'webp', awayBadgeExt: 'webp' }],
      allPlayers: [],
      allPredictions: { me: {} },
      squadsCache: {},
      matchStats: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: () => 'A',
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = ui.renderLiveV2Html([], { states: { 1: { status: 'NS', score: { home: 0, away: 0 } } }, statsById: {} });
  assert.match(html, /S\/P/);
});

test('liveV2ChipPulseState clasifica el delta', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2ChipPulseState(5), 'fav');
  assert.equal(ui.liveV2ChipPulseState(-2), 'hurt');
  assert.equal(ui.liveV2ChipPulseState(0), 'neutral');
});

test('liveV2DetectChipChanges calcula el pulso y lo retira sin cambio', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: {
      _chipScores: { 1: '0-0' },
      _chipUserPoints: { 1: 0 },
      _chipPulse: {},
      _chipChanged: {},
    },
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [] },
    matchStats: [],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 5, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const folded = {
    states: { 1: { status: 'LIVE', score: { home: 1, away: 0 }, players: {} } },
    statsById: { 1: { 1: { goles: 1 }, 2: { goles: 0 }, jugadores: [] } },
  };
  ui.liveV2DetectChipChanges(folded);
  assert.equal(AppState.liveV2._chipPulse['1'].state, 'fav');

  ui.liveV2DetectChipChanges(folded);
  assert.equal(AppState.liveV2._chipPulse['1'], undefined);
});

test('liveV2DetectChipChanges no pulsa un partido ya finalizado', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: {
      _chipScores: { 1: '0-0' },
      _chipUserPoints: { 1: 0 },
      _chipPulse: {},
      _chipChanged: {},
    },
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2 }],
    allPlayers: [],
    allPredictions: { me: { 1: { home: 1, away: 0 } } },
    squadsCache: { me: [] },
    matchStats: [{ eventId: 1 }],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 5, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const folded = {
    states: { 1: { status: 'FT', score: { home: 1, away: 0 }, players: {} } },
    statsById: { 1: { 1: { goles: 1 }, 2: { goles: 0 }, jugadores: [] } },
  };
  ui.liveV2DetectChipChanges(folded);
  assert.equal(AppState.liveV2._chipPulse['1'], undefined);
  assert.equal(AppState.liveV2._chipScores['1'], '1-0');
});

test('el chip aplica la clase de pulso', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: { _chipPulse: { 1: { state: 'hurt', delta: -2, at: Date.now() } } },
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'A', awayTeam: 'B', homeBadgeExt: 'webp', awayBadgeExt: 'webp' }],
      allPlayers: [],
      allPredictions: { me: {} },
      squadsCache: {},
      matchStats: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: () => 'A',
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const html = ui.renderLiveV2Html([], { states: { 1: { status: 'LIVE', lastMinute: 20, score: { home: 1, away: 0 } } }, statsById: {} });
  assert.match(html, /score-hurt/);
});
