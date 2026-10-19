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
} = require('../js/live-v2-ui.js');

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
    const container = { querySelectorAll: () => [], appendChild: () => {} };
    ui.liveV2ShowReason(container, { offsetTop: 10, offsetHeight: 44 }, { icon: '⚽', text: 'Gol', delta: 1 });
    assert.equal(created.length, 1);
    assert.equal(created[0].getAttribute('aria-live'), 'polite');
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
  assert.match(html, /id="livev2-feed"[^>]*aria-live="polite"/);
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
