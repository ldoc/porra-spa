const test = require('node:test');
const assert = require('node:assert/strict');
const {
  liveV2ChipLabel,
  liveV2StatusBadge,
  liveV2NextPollState,
  liveV2ShouldFullOnEntry,
  fetchLiveEvents,
  fetchLiveSnapshots,
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
  liveV2TrimCacheEvents,
  liveV2StatusWhistleCount,
  liveV2EventDeltas,
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

test('liveV2ChipLabel sin estado devuelve SIN EMPEZAR', () => {
  assert.equal(liveV2ChipLabel(null), 'SIN EMPEZAR');
  assert.equal(liveV2ChipLabel(undefined), 'SIN EMPEZAR');
});

test('liveV2ChipLabel devuelve SIN EMPEZAR, DESCANSO y FINAL', () => {
  assert.equal(liveV2ChipLabel({ status: 'NS' }), 'SIN EMPEZAR');
  assert.equal(liveV2ChipLabel({ status: 'HT' }), 'DESCANSO');
  assert.equal(liveV2ChipLabel({ status: 'FT' }), 'FINAL');
});

test('liveV2ChipLabel en LIVE usa el minuto y cae a LIVE sin minuto', () => {
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: 63 }), "EN JUEGO 63'");
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: 0 }), "EN JUEGO 0'");
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: null }), 'EN JUEGO');
});

test('liveV2ChipLabel calcula el minuto con el reloj del servidor', () => {
  const liveV2 = require('../js/liveV2.js');
  init({ AppState: { liveV2: null, matches: [], allPlayers: [] }, liveV2Api: liveV2 });
  const state = {
    status: 'LIVE', kickoffTs: '2026-09-16T20:00:00Z', period: 'period1', lastMinute: 0,
  };
  assert.equal(liveV2ChipLabel(state, Date.parse('2026-09-16T21:03:00Z')), "EN JUEGO 63'");
});

test('liveV2ChipLabel prefiere el minuto observado de livematches', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({ AppState: { liveV2: null }, liveV2Api: liveV2 });
  const state = { status: 'LIVE', kickoffTs: '2026-09-16T20:00:00Z', period: 'period1' };
  assert.equal(ui.liveV2ChipLabel(state, Date.parse('2026-09-16T20:30:00Z'), 63), "EN JUEGO 63'");
});

test('liveV2ChipData usa el minuto del snapshot de livematches', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      currentUser: { name: 'me' },
      liveV2: { _liveSnapshots: { 1: { minute: 63, lastUpdated: new Date().toISOString() } } },
      matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'Local', awayTeam: 'Visitante' }],
      allPredictions: { me: { 1: { home: 1, away: 0 } } },
      allPlayers: [],
    },
    liveV2Api: liveV2,
    liveV2Abbr: s => String(s).slice(0, 3),
  });
  const d = ui.liveV2ChipData(1, {
    status: 'LIVE', kickoffTs: '2026-09-16T20:00:00Z', period: 'period1',
  });
  assert.equal(d.label, "EN JUEGO 63'");
});

test('liveV2OrderedStateEntries mantiene el orden por kickoff aunque cambie el marcador', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: {
      liveV2: { _chipChanged: { 1: 200, 2: 100 } },
      matches: [{ id: 1, fechaTs: 200 }, { id: 2, fechaTs: 100 }],
    },
    liveV2Api: liveV2,
  });
  const out = ui.liveV2OrderedStateEntries({ states: { 1: {}, 2: {} } });
  assert.deepEqual(out.map(([id]) => id), ['2', '1']);
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
  const removed = [];
  let fullscreenEl = null;
  let activeElement = null;
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
  const all = [];
  const body = makeElement('body');
  body._root = true;
  body.classList = makeClassList(bodyClasses);
  const doc = {
    visibilityState: 'visible',
    _all: all,
    body,
    documentElement: {
      requestFullscreen: () => {
        fullscreenEl = doc.documentElement;
        return Promise.resolve();
      },
    },
    get fullscreenElement() { return fullscreenEl; },
    set fullscreenElement(v) { fullscreenEl = v; },
    exitFullscreen: () => { fullscreenEl = null; return Promise.resolve(); },
    get activeElement() { return activeElement; },
    set activeElement(v) { activeElement = v; },
    register: el => { el._doc = doc; all.push(el); return el; },
    getElementById: id => all.find(el => el.id === id && !el._removed) || null,
    querySelector: sel => {
      if (sel === '#livev2-fs-toggle') return toggle;
      return all.find(el => !el._removed && matchesSelector(el, sel)) || null;
    },
    addEventListener: (type, fn) => {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener: (type, fn) => {
      const list = listeners[type] || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
      removed.push({ type, fn });
    },
    dispatch: (type, ev) => {
      for (const fn of [...(listeners[type] || [])]) fn(ev);
    },
    createElement: tag => {
      const el = makeElement(tag);
      el._doc = doc;
      all.push(el);
      return el;
    },
    createDocumentFragment: () => {
      const fragment = makeElement('#fragment');
      fragment._fragment = true;
      fragment._doc = doc;
      return fragment;
    },
  };
  body._doc = doc;
  return { doc, bodyClasses, toggleClasses, toggleAttrs, listeners, removed, toggle };
}

function matchesSelector(el, sel) {
  if (!el || !sel) return false;
  if (sel[0] === '#') return el.id === sel.slice(1);
  if (sel[0] === '.') {
    const m = sel.slice(1).match(/^([\w-]+)(?:\[([\w-]+)\])?$/);
    if (!m) return false;
    if (!el.classList.contains(m[1])) return false;
    return !m[2] || el.hasAttribute(m[2]);
  }
  if (sel[0] === '[') return el.hasAttribute(sel.slice(1, -1).split('=')[0]);
  return el.tagName === sel;
}

function makeElement(tag) {
  const attrs = {};
  const classes = new Set();
  const el = {
    tagName: tag || 'div',
    _listeners: {},
    _fragment: false,
    _root: false,
    _removed: false,
    _doc: null,
    _text: null,
    _html: '',
    children: [],
    parentNode: null,
    style: {},
    dataset: {},
    get className() { return [...classes].join(' '); },
    set className(v) {
      classes.clear();
      String(v == null ? '' : v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
    classList: {
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
      contains: c => classes.has(c),
    },
    get textContent() {
      if (this._text != null) return this._text;
      return this.children.map(c => c.textContent).join('');
    },
    set textContent(v) { this._text = String(v); this.children = []; this._html = ''; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; this._text = null; },
    setAttribute(k, v) { attrs[k] = String(v); if (k === 'id') this.id = String(v); },
    getAttribute(k) { return attrs[k] == null ? null : attrs[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child) child.parentNode = null;
      return child;
    },
    appendChild(child) {
      if (!child) return child;
      if (child._fragment) {
        for (const c of child.children.slice()) this.appendChild(c);
        child.children = [];
        return child;
      }
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      child._removed = false;
      this.children.push(child);
      return child;
    },
    prepend(child) {
      if (!child) return child;
      if (child._fragment) {
        const kids = child.children.slice();
        child.children = [];
        for (const c of kids) {
          if (c.parentNode) c.parentNode.removeChild(c);
          c.parentNode = this;
          c._removed = false;
        }
        this.children = kids.concat(this.children);
        return child;
      }
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      child._removed = false;
      this.children.unshift(child);
      return child;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
      this._removed = true;
    },
    focus() {
      if (this._doc) this._doc.activeElement = this;
      this.focused = true;
    },
    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    _emit(type, ev) { for (const fn of (this._listeners[type] || [])) fn(ev); },
    querySelectorAll(sel) {
      const out = [];
      const walk = node => {
        for (const c of node.children) {
          if (matchesSelector(c, sel)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    closest(sel) {
      let node = this;
      while (node) {
        if (matchesSelector(node, sel)) return node;
        node = node.parentNode;
      }
      return null;
    },
    get isConnected() {
      let node = this;
      while (node) { if (node._root) return true; node = node.parentNode; }
      return false;
    },
  };
  Object.defineProperty(el, 'id', {
    get() { return attrs.id || ''; },
    set(v) { attrs.id = String(v); },
  });
  return el;
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
    dom.doc.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
    assert.ok(prevented);
    assert.ok(!dom.bodyClasses.has('live-fs'));
    assert.equal(hist.backCount, 1);
    assert.equal(hist.state, null);

    ui.enterLiveV2Fullscreen();
    hist.back();
    dom.doc.dispatch('popstate');
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
    dom.doc.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
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

test('render Live v2 anuncia eventos y filas y conserva la salida', () => {
  const ui = freshUi();
  ui.init({
    AppState: { liveV2: null, matches: [], allPlayers: [], squadsCache: {}, currentUser: null },
    liveV2Api: { escapeHtml: s => String(s) },
  });
  const html = ui.renderLiveV2Html([], { states: {} });
  assert.match(html, /id="livev2-sr-events"[^>]*aria-live="polite"[^>]*aria-atomic="false"/);
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

test('fetchLiveEvents full conserva los vistos y deja los nuevos para el carrusel', async () => {
  const old = { eventId: 1, sourceId: 'old', type: 'goal', ts: '2026-10-21T14:00:00Z', payload: {} };
  const fresh = { eventId: 1, sourceId: 'new', type: 'goal', ts: '2026-10-21T14:10:00Z', payload: {} };
  const AppState = {
    liveV2: {
      events: [old], _seenEventIds: new Set(['1|old']), serverTime: '2026-10-21T14:00:00Z',
      prevRanks: null, polling: false, _lastRows: [], _fullAt: 1, _needFull: false,
      lastFetchAt: null, error: null,
    },
    matches: [], allPlayers: [],
  };
  init({
    AppState, API_BASE: 'https://api.test',
    fetchWithPhase: async () => jsonResponse({
      ok: true, serverTime: '2026-10-21T14:10:00Z', events: [old, fresh],
    }, '2026-10-21T14:10:00Z'),
    liveV2Api: { eventKey: e => `${e.eventId}|${e.sourceId}` },
  });
  await fetchLiveEvents(true);
  assert.deepEqual(AppState.liveV2.events.map(e => e.sourceId), ['old', 'new']);
  assert.ok(AppState.liveV2._seenEventIds.has('1|old'));
  assert.equal(AppState.liveV2._seenEventIds.has('1|new'), false);
});

test('fetchLiveEvents full inicial marca todo como visto (sin carrusel de backlog)', async () => {
  const a = { eventId: 1, sourceId: 'a', type: 'goal', ts: '2026-10-21T14:00:00Z', payload: {} };
  const b = { eventId: 1, sourceId: 'b', type: 'goal', ts: '2026-10-21T14:01:00Z', payload: {} };
  const AppState = {
    liveV2: {
      events: [], _seenEventIds: null, serverTime: null,
      prevRanks: null, polling: false, _lastRows: [], _fullAt: 0, _needFull: false,
      lastFetchAt: null, error: null,
    },
    matches: [], allPlayers: [],
  };
  init({
    AppState, API_BASE: 'https://api.test',
    fetchWithPhase: async () => jsonResponse({
      ok: true, serverTime: '2026-10-21T14:01:00Z', events: [a, b],
    }, '2026-10-21T14:01:00Z'),
    liveV2Api: { eventKey: e => `${e.eventId}|${e.sourceId}` },
  });
  await fetchLiveEvents(true);
  assert.ok(AppState.liveV2._seenEventIds.has('1|a'));
  assert.ok(AppState.liveV2._seenEventIds.has('1|b'));
});

test('un full al volver visible siembra los eventos ocultos (_seedOnFull)', async () => {
  const old = { eventId: 1, sourceId: 'old', type: 'goal', ts: '2026-10-21T14:00:00Z', payload: {} };
  const hidden = { eventId: 1, sourceId: 'hidden', type: 'goal', ts: '2026-10-21T14:05:00Z', payload: {} };
  const AppState = {
    liveV2: {
      events: [old], _seenEventIds: new Set(['1|old']), _seedOnFull: true,
      serverTime: '2026-10-21T14:00:00Z', prevRanks: null, polling: false,
      _lastRows: [], _fullAt: 1, _needFull: true, lastFetchAt: null, error: null,
    },
    matches: [], allPlayers: [],
  };
  init({
    AppState, API_BASE: 'https://api.test',
    fetchWithPhase: async () => jsonResponse({
      ok: true, serverTime: '2026-10-21T14:05:00Z', events: [old, hidden],
    }, '2026-10-21T14:05:00Z'),
    liveV2Api: { eventKey: e => `${e.eventId}|${e.sourceId}` },
  });
  await fetchLiveEvents(true);
  assert.ok(AppState.liveV2._seenEventIds.has('1|hidden'));
  assert.equal(AppState.liveV2._seedOnFull, false);
});

test('fetchLiveSnapshots guarda el minuto/estado de livematches', async () => {
  const AppState = { liveV2: {} };
  init({
    AppState, API_BASE: 'https://api.test',
    fetchWithPhase: async () => jsonResponse({
      ok: true,
      liveMatches: [{ eventId: 1, minute: 63, status: 'LIVE', lastUpdated: '2026-09-16T21:03:00Z' }],
    }),
    liveV2Api: { eventKey: e => `${e.eventId}|${e.sourceId}` },
  });
  await fetchLiveSnapshots();
  assert.equal(AppState.liveV2._liveSnapshots['1'].minute, 63);
  assert.equal(AppState.liveV2._liveSnapshots['1'].status, 'LIVE');
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

test('liveV2ShouldFullOnEntry exige full si el full es viejo o falta', () => {
  const now = 1_000_000;
  const fresh = { serverTime: '2026-10-21T20:00:00Z', events: [{}], _fullAt: now - 59_000 };
  assert.equal(liveV2ShouldFullOnEntry(fresh, now), false);

  assert.equal(liveV2ShouldFullOnEntry({ ...fresh, _fullAt: now - 60_001 }, now), true);
  assert.equal(liveV2ShouldFullOnEntry({ ...fresh, serverTime: null }, now), true);
  assert.equal(liveV2ShouldFullOnEntry({ ...fresh, events: [] }, now), true);
  assert.equal(liveV2ShouldFullOnEntry({ ...fresh, _needFull: true }, now), true);
  assert.equal(liveV2ShouldFullOnEntry({ ...fresh, _fullAt: 0 }, now), true);
  assert.equal(liveV2ShouldFullOnEntry({ serverTime: 'T', events: [{}] }, now), true);
});

test('liveV2CacheKey incluye source y fase', () => {
  const now = new Date(2026, 9, 19, 12, 0, 0).getTime();
  assert.equal(
    liveV2CacheKey('juan', now, { source: 'real', phase: 'FASE_LIGA' }),
    'porra_live_events_v2:2026-10-19:juan:real:FASE_LIGA'
  );
  assert.equal(
    liveV2CacheKey('juan', now, { source: 'sim', phase: 'FASE_8' }),
    'porra_live_events_v2:2026-10-19:juan:sim:FASE_8'
  );
  assert.equal(liveV2CacheKey(null, now, { source: 'real', phase: 'FASE_LIGA' }), null);
});

test('liveV2CacheIsFresh exige versión, source, fase, eventos, cursor y fullAt', () => {
  const opts = { source: 'real', phase: 'FASE_LIGA' };
  const ok = { version: 2, source: 'real', phase: 'FASE_LIGA', events: [], serverTime: 'T', fullAt: 1 };
  assert.equal(liveV2CacheIsFresh(ok, opts), true);
  assert.equal(liveV2CacheIsFresh({ ...ok, version: 1 }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, source: 'sim' }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, phase: 'FASE_8' }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, events: null }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, serverTime: null }, opts), false);
  assert.equal(liveV2CacheIsFresh({ ...ok, fullAt: null }, opts), false);
  assert.equal(liveV2CacheIsFresh(null, opts), false);
});

test('restoreLiveV2Cache ignora una caché de otro source', () => {
  const ui = freshUi();
  const day = ui.liveV2CacheDay();
  const saved = JSON.stringify({
    version: 2, source: 'sim', phase: 'FASE_LIGA',
    events: [{ eventId: 1, sourceId: 'a' }], serverTime: '2026-10-21T10:00:00Z', fullAt: 1,
  });
  const store = { [`porra_live_events_v2:${day}:juan:sim:FASE_LIGA`]: saved };
  const prev = global.localStorage;
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  try {
    const AppState = {
      currentUser: { name: 'juan' },
      appConfig: { faseJuego: 'FASE_LIGA' },
      liveV2: null,
    };
    ui.init({ AppState, liveV2Api: {} });
    const st = ui.liveV2State();
    assert.equal(st.serverTime, null, 'la caché sim no se restaura en real');
    assert.deepEqual(st.events, []);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});

test('purgeLiveV2Caches elimina todas las versiones del live', () => {
  const store = {
    a: 'x',
    'porra_live_events_v1:2026-10-19:juan': '{}',
    'porra_live_events_v2:2026-10-19:juan:real:FASE_LIGA': '{}',
    'porra_live_events_v2:2026-10-18:ana:sim:FASE_8': '{}',
    other: 'y',
  };
  const storage = {
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
    removeItem: k => { delete store[k]; },
  };
  assert.equal(purgeLiveV2Caches(storage), 3);
  assert.deepEqual(Object.keys(store), ['a', 'other']);
});

test('liveV2StatusWhistleCount mapea inicio, descanso y final', () => {
  assert.equal(liveV2StatusWhistleCount('LIVE', 'period1'), 1);
  assert.equal(liveV2StatusWhistleCount('LIVE', 'period2'), 1);
  assert.equal(liveV2StatusWhistleCount('HT', null), 3);
  assert.equal(liveV2StatusWhistleCount('FT', null), 3);
  assert.equal(liveV2StatusWhistleCount('NS', null), 0);
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

test('liveV2PlayNewEventSounds: HT dispara 3 silbatos', () => {
  const calls = [];
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: { liveV2: { events: [] }, matchStats: [], currentUser: { name: 'me' } },
    liveV2Api: liveV2,
    soundApi: {
      loadSoundEnabled: () => true,
      playWhistle: (_deps, times) => calls.push(times),
      playFile: () => {},
      playBeep: () => {},
      playLiveEvent: () => {},
    },
  });
  const ht = { eventId: 1, type: 'status', minute: 45, ts: '2026-09-16T21:45:00.000Z', sourceId: 'ht', payload: { status: 'HT' } };
  ui.liveV2PlayNewEventSounds([ht]);
  assert.deepEqual(calls, [3]);
});

test('liveV2PlayNewEventSounds: no falla si soundApi no expone playWhistle', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: { liveV2: { events: [] }, matchStats: [], currentUser: { name: 'me' } },
    liveV2Api: liveV2,
    soundApi: { loadSoundEnabled: () => true, playLiveEvent: () => {} },
  });
  const ht = { eventId: 1, type: 'status', minute: 45, ts: '2026-09-16T21:45:00.000Z', sourceId: 'ht', payload: { status: 'HT' } };
  assert.doesNotThrow(() => ui.liveV2PlayNewEventSounds([ht]));
});

test('liveV2PlayNewEventSounds: un gol ya no emite tono de gol', () => {
  const calls = [];
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({
    AppState: { liveV2: { events: [] }, matchStats: [], currentUser: { name: 'me' } },
    liveV2Api: liveV2,
    soundApi: { loadSoundEnabled: () => true, playWhistle: () => calls.push('w'), playLiveEvent: () => calls.push('tone'), playFile: () => {}, playBeep: () => {} },
  });
  const goal = { eventId: 1, type: 'goal', minute: 10, ts: '2026-09-16T20:10:00.000Z', sourceId: 'g', payload: { scorerId: 11 } };
  ui.liveV2PlayNewEventSounds([goal]);
  assert.deepEqual(calls, []);
});

function withFeedDom(fn) {
  const prevDoc = global.document;
  const prevSetTimeout = global.setTimeout;
  const prevClearTimeout = global.clearTimeout;
  const timers = new Map();
  let nextId = 1;
  global.setTimeout = (cb, ms) => {
    const id = nextId++;
    timers.set(id, { cb, ms });
    return id;
  };
  global.clearTimeout = id => { timers.delete(id); };
  const dom = setupDom();
  global.document = dom.doc;
  try {
    return fn(dom, timers);
  } finally {
    global.setTimeout = prevSetTimeout;
    global.clearTimeout = prevClearTimeout;
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
  }
}

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
  assert.doesNotMatch(html, /0pts/);
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
  assert.equal(ui.liveV2PointsDiffText(0), '');
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
  assert.match(html, /id="livev2-sr-events"[^>]*aria-atomic="false"/);
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
  assert.equal(d.label, 'SIN EMPEZAR');
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

test('liveV2MatchBreakdown cuenta el evento seed en eventsCount', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = liveMatchFixture();
  AppState.liveV2 = {
    events: [
      {
        eventId: 1, type: 'goal', minute: 0, ts: '2026-09-16T20:00:00Z',
        ingestedAt: '2026-09-16T20:00:00Z', seq: 0, sourceId: 'seed',
        payload: { seed: true, scorerId: 13, isHome: true },
      },
      {
        eventId: 1, type: 'card', minute: 20, ts: '2026-09-16T20:20:00Z',
        ingestedAt: '2026-09-16T20:20:00Z', seq: 1, sourceId: 'c1',
        playerId: 13, payload: { cardType: 'yellow' },
      },
    ],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  const d = ui.liveV2MatchBreakdown(1, {
    status: 'LIVE', score: { home: 0, away: 0 }, goals: [], players: {}, lastMinute: 0,
  });
  assert.equal(d.eventsCount, 2);
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

function modalEventView() {
  return {
    key: '1|goal|1', type: 'goal', icon: '⚽', tone: 'goal',
    minuteText: "23'", text: 'Gol de Ana', teamName: 'Local', detail: 'asistencia de Beto',
    match: { homeTeam: 'Local', awayTeam: 'Visitante', scoreHome: 1, scoreAway: 0 },
  };
}

test('liveV2ToggleMatchEvents alterna el estado', () => {
  const ui = freshUi();
  const st = { _matchEventsOpen: false };
  assert.equal(ui.liveV2ToggleMatchEvents(st), true);
  assert.equal(st._matchEventsOpen, true);
  assert.equal(ui.liveV2ToggleMatchEvents(st), false);
});

test('openLiveV2MatchModal pliega los eventos al abrir', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = liveMatchFixture();
  AppState.liveV2 = { events: [], _matchEventsOpen: true };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  withFeedDom(() => {
    ui.openLiveV2MatchModal('1');
    assert.equal(ui.liveV2State()._matchEventsOpen, false);
  });
});

test('liveV2MatchModalHtml pinta Eventos plegado por defecto y lo abre con el estado', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({ AppState: { liveV2: { events: [], _matchEventsOpen: false } }, liveV2Api: liveV2 });
  const base = {
    meta: { homeTeam: 'Local', awayTeam: 'Visitante', homeTeamId: 1, awayTeamId: 2 },
    score: { home: 1, away: 0 }, label: "LIVE 23'", status: 'LIVE', loggedIn: true,
    prediction: null, predictionPts: 0, predictionBreakdown: [], squadDetail: [], total: 0,
    events: [modalEventView()], eventsCount: 1,
  };
  const closed = ui.liveV2MatchModalHtml(base);
  assert.match(closed, /Eventos · 1/);
  assert.doesNotMatch(closed, /id="livev2-match-events-list"/);
  assert.doesNotMatch(closed, /aria-controls=/);
  ui.liveV2State()._matchEventsOpen = true;
  const open = ui.liveV2MatchModalHtml(base);
  assert.match(open, /id="livev2-match-events-list"/);
  assert.match(open, /aria-controls="livev2-match-events-list"/);
  assert.match(open, /Gol de Ana/);
  assert.match(open, /Local<\/span> <span class="livev2-event-detail">· asistencia de Beto/);
});

test('liveV2MatchModalHtml no pinta Eventos si no hay eventos', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({ AppState: { liveV2: { events: [], _matchEventsOpen: false } }, liveV2Api: liveV2 });
  const html = ui.liveV2MatchModalHtml({
    meta: { homeTeam: 'Local', awayTeam: 'Visitante', homeTeamId: 1, awayTeamId: 2 },
    score: { home: 0, away: 0 }, label: 'NS', status: 'NS', loggedIn: true,
    prediction: null, predictionPts: 0, predictionBreakdown: [], squadDetail: [], total: 0,
    events: [], eventsCount: 0,
  });
  assert.doesNotMatch(html, /Eventos ·/);
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

test('refreshLiveV2MatchModal mantiene el foco en el toggle de eventos', () => {
  const ui = freshUi();
  const state = { active: null };
  const content = { scrollTop: 0 };
  const close = { focused: 0, focus() { this.focused++; } };
  const prevToggle = {
    focused: 0,
    closest(sel) { return sel === '[data-livev2-events-toggle]' ? this : null; },
    focus() { this.focused++; },
  };
  const nextToggle = {
    focused: 0,
    closest(sel) { return sel === '[data-livev2-events-toggle]' ? this : null; },
    focus() { this.focused++; },
  };
  state.active = prevToggle;
  const host = {
    _html: '',
    contains(node) { return node === state.active; },
    querySelector(sel) {
      if (sel === '.livev2-match-content') return content;
      if (sel === '.breakdown-modal-close') return close;
      if (sel === '[data-livev2-events-toggle]') return nextToggle;
      return null;
    },
    set innerHTML(v) {
      this._html = v;
      content.scrollTop = 0;
      close.focused = 0;
      nextToggle.focused = 0;
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
      events: [], _openMatchModal: '1', _matchEventsOpen: true, _chipScores: {}, _chipChanged: {},
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
  assert.equal(nextToggle.focused, 1);
  assert.equal(close.focused, 0);
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

test('liveV2ChipEventText compone el texto completo', () => {
  const ui = freshUi();
  assert.equal(
    ui.liveV2ChipEventText({ icon: '⚽', minuteText: "23'", text: 'Gol de Ana', detail: 'asistencia de Beto' }),
    "⚽ 23' Gol de Ana · asistencia de Beto");
});

test('liveV2ChipSoundKind distingue gol del resto', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2ChipSoundKind({ type: 'goal' }), 'goal');
  assert.equal(ui.liveV2ChipSoundKind({ type: 'card' }), 'beep');
  assert.equal(ui.liveV2ChipSoundKind({ type: 'goal_cancelled' }), 'beep');
});

test('liveV2PlayChipEventSound no llama a un soundApi obsoleto', () => {
  const ui = freshUi();
  const prevLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '1' };
  let calls = 0;
  ui.init({
    AppState: { liveV2: null },
    liveV2Api: require('../js/liveV2.js'),
    soundApi: {
      loadSoundEnabled: () => true,
      playLiveEvent: () => { calls++; },
    },
  });
  try {
    assert.doesNotThrow(() => ui.liveV2PlayChipEventSound({ type: 'goal' }));
    assert.doesNotThrow(() => ui.liveV2PlayChipEventSound({ type: 'card' }));
    assert.equal(calls, 0);
  } finally {
    if (prevLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLocalStorage;
  }
});

test('liveV2PlayChipEventSound usa playFile para gol y playBeep para tarjeta', () => {
  const ui = freshUi();
  const prevLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '1' };
  const calls = [];
  ui.init({
    AppState: { liveV2: null },
    liveV2Api: require('../js/liveV2.js'),
    soundApi: {
      loadSoundEnabled: () => true,
      playLiveEvent: () => {},
      playFile: (src, deps) => calls.push(['file', src, deps]),
      playBeep: deps => calls.push(['beep', deps]),
    },
  });
  try {
    ui.liveV2PlayChipEventSound({ type: 'goal' });
    ui.liveV2PlayChipEventSound({ type: 'card' });
  } finally {
    if (prevLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLocalStorage;
  }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 2), ['file', 'sounds/gol_otro.mp3']);
  assert.equal(calls[0][2].enabled, true);
  assert.equal(calls[1][0], 'beep');
  assert.equal(calls[1][1].enabled, true);
});

test('liveV2AppendChipViews deduplica y conserva el orden', () => {
  const ui = freshUi();
  const q = ui.liveV2AppendChipViews([], [{ key: 'a' }, { key: 'b' }]);
  const next = ui.liveV2AppendChipViews(q, [{ key: 'b' }, { key: 'c' }]);
  assert.deepEqual(next.map(v => v.key), ['a', 'b', 'c']);
});

test('liveV2StartNextChipEvent pinta el evento y restaura la línea normal', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({ AppState: { liveV2: { events: [], _chipEventQueue: {} }, matches: [], allPlayers: [] }, liveV2Api: liveV2 });
  withFeedDom((dom, timers) => {
    dom.doc.querySelectorAll = sel => dom.doc._all.filter(el => matchesSelector(el, sel));
    const sr = dom.doc.createElement('div');
    sr.id = 'livev2-sr-events';
    const chip = dom.doc.createElement('div');
    chip.setAttribute('data-livev2-chip', '1');
    const meta = dom.doc.createElement('div');
    meta.className = 'livev2-chip-meta';
    const layer = dom.doc.createElement('span');
    layer.className = 'livev2-chip-event';
    meta.appendChild(layer);
    chip.appendChild(meta);
    chip._root = true;
    dom.doc.register(chip);
    ui.liveV2State()._chipEventQueue['1'] = [{
      key: 'g1', type: 'goal', icon: '⚽', minuteText: "23'",
      text: 'Gol de Ana', detail: 'asistencia de Beto', tone: 'goal',
    }];
    ui.liveV2StartNextChipEvent('1');
    assert.equal(meta.classList.contains('has-event'), true);
    assert.match(layer.textContent, /Gol de Ana/);
    assert.equal(sr.children.length, 1);
    assert.equal(sr.textContent, "⚽ 23' Gol de Ana · asistencia de Beto");
    const srTimer = [...timers.values()].find(t => t.ms === 2500);
    assert.ok(srTimer);
    srTimer.cb();
    assert.equal(sr.children.length, 0);
    const timer = [...timers.values()].find(t => t.ms === 8000);
    assert.ok(timer);
    timer.cb();
    assert.equal(meta.classList.contains('has-event'), false);
    assert.equal(layer.textContent, '');
  });
});

test('liveV2StartNextChipEvent acumula anuncios de dos partidos en el mismo tick', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  ui.init({ AppState: { liveV2: { events: [], _chipEventQueue: {} }, matches: [], allPlayers: [] }, liveV2Api: liveV2 });
  withFeedDom(dom => {
    dom.doc.querySelectorAll = sel => dom.doc._all.filter(el => matchesSelector(el, sel));
    const sr = dom.doc.createElement('div');
    sr.id = 'livev2-sr-events';
    const addChip = id => {
      const chip = dom.doc.createElement('div');
      chip.setAttribute('data-livev2-chip', id);
      const meta = dom.doc.createElement('div');
      meta.className = 'livev2-chip-meta';
      const layer = dom.doc.createElement('span');
      layer.className = 'livev2-chip-event';
      meta.appendChild(layer);
      chip.appendChild(meta);
      chip._root = true;
      dom.doc.register(chip);
    };
    addChip('1');
    addChip('2');
    ui.liveV2State()._chipEventQueue['1'] = [{
      key: 'g1', type: 'goal', icon: '⚽', minuteText: "23'", text: 'Gol de Ana', tone: 'goal',
    }];
    ui.liveV2State()._chipEventQueue['2'] = [{
      key: 'c2', type: 'card', icon: '🟨', minuteText: "30'", text: 'Amarilla · Beto', tone: 'card-yellow',
    }];
    ui.liveV2StartNextChipEvent('1');
    ui.liveV2StartNextChipEvent('2');
    assert.equal(sr.children.length, 2);
    assert.match(sr.textContent, /Gol de Ana/);
    assert.match(sr.textContent, /Amarilla · Beto/);
  });
});

test('liveV2EnqueueChipEvents encola FIFO, excluye seed y no interrumpe el activo', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const seed = {
    eventId: 1, type: 'goal', minute: 0, ts: '2026-09-16T20:00:00Z',
    ingestedAt: '2026-09-16T20:00:00Z', seq: 0, sourceId: 'seed',
    payload: { seed: true, scorerId: 11, isHome: true },
  };
  const goal = {
    eventId: 1, type: 'goal', minute: 10, ts: '2026-09-16T20:10:00Z',
    ingestedAt: '2026-09-16T20:10:00Z', seq: 1, sourceId: 'g1',
    payload: { scorerId: 11, isHome: true },
  };
  const card = {
    eventId: 1, type: 'card', minute: 20, ts: '2026-09-16T20:20:00Z',
    ingestedAt: '2026-09-16T20:20:00Z', seq: 2, sourceId: 'c2', playerId: 12,
    payload: { cardType: 'yellow' },
  };
  const sub = {
    eventId: 1, type: 'substitution', minute: 30, ts: '2026-09-16T20:30:00Z',
    ingestedAt: '2026-09-16T20:30:00Z', seq: 3, sourceId: 's3',
    payload: { inId: 12, outId: 11 },
  };
  const AppState = {
    currentUser: { name: 'me' },
    liveV2: { events: [seed, goal, card], _chipEventQueue: {} },
    matches: [{ id: 1, homeTeamId: 1, awayTeamId: 2, homeTeam: 'Local', awayTeam: 'Visitante' }],
    allPlayers: [
      { id: 11, nombre: 'Ana', posicion: 'F', equipo: 1 },
      { id: 12, nombre: 'Beto', posicion: 'M', equipo: 2 },
    ],
    allPredictions: { me: {} },
    squadsCache: { me: [] },
    matchStats: [],
  };
  ui.init({ AppState, liveV2Api: liveV2 });
  withFeedDom((dom, timers) => {
    dom.doc.querySelectorAll = sel => dom.doc._all.filter(el => matchesSelector(el, sel));
    const chip = dom.doc.createElement('div');
    chip.setAttribute('data-livev2-chip', '1');
    const meta = dom.doc.createElement('div');
    meta.className = 'livev2-chip-meta';
    const layer = dom.doc.createElement('span');
    layer.className = 'livev2-chip-event';
    meta.appendChild(layer);
    chip.appendChild(meta);
    chip._root = true;
    dom.doc.register(chip);

    ui.liveV2EnqueueChipEvents([card, seed, goal]);
    assert.match(layer.textContent, /Gol de Ana/);
    assert.deepEqual(ui.liveV2State()._chipEventQueue['1'].map(v => v.key), ['1|c2']);

    AppState.liveV2.events.push(sub);
    ui.liveV2EnqueueChipEvents([sub]);
    assert.match(layer.textContent, /Gol de Ana/);
    assert.deepEqual(ui.liveV2State()._chipEventQueue['1'].map(v => v.key), ['1|c2', '1|s3']);

    const timer = [...timers.values()].find(t => t.ms === 8000);
    assert.ok(timer);
    timer.cb();
    assert.match(layer.textContent, /Amarilla · Beto/);
    assert.deepEqual(ui.liveV2State()._chipEventQueue['1'].map(v => v.key), ['1|s3']);
  });
});

test('liveV2TrimCacheEvents limita y marca truncated', () => {
  const events = Array.from({ length: 5 }, (_, i) => ({
    eventId: i,
    ingestedAt: new Date(1000 + i).toISOString(),
    ts: new Date(1000 + i).toISOString(),
  }));
  const out = liveV2TrimCacheEvents(events, 3);
  assert.equal(out.truncated, true);
  assert.deepEqual(out.events.map(e => e.eventId), [4, 3, 2]);
  assert.equal(liveV2TrimCacheEvents(events, 5).truncated, false);
});

test('liveV2TrimCacheEvents desempata por ts cuando ingestedAt coincide', () => {
  const ingestedAt = '2026-10-21T10:00:00.000Z';
  const events = [
    { eventId: 'a', ingestedAt, ts: '2026-10-21T09:00:00.000Z' },
    { eventId: 'b', ingestedAt, ts: '2026-10-21T09:05:00.000Z' },
    { eventId: 'c', ingestedAt, ts: '2026-10-21T09:02:00.000Z' },
  ];
  const out = liveV2TrimCacheEvents(events, 2);
  assert.equal(out.truncated, true);
  assert.deepEqual(out.events.map(e => e.eventId), ['b', 'c']);
});

test('saveLiveV2Cache purga claves viejas y reintenta si falla la cuota', () => {
  const ui = freshUi();
  const day = ui.liveV2CacheDay();
  const staleKey = `porra_live_events_v2:${day}:ana:real:FASE_LIGA`;
  const store = { [staleKey]: '{}' };
  let writes = 0;
  const storage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      writes++;
      if (writes === 1) throw new Error('QuotaExceededError');
      store[k] = String(v);
    },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  const prev = global.localStorage;
  global.localStorage = storage;
  try {
    const AppState = {
      currentUser: { name: 'juan' },
      appConfig: { faseJuego: 'FASE_LIGA' },
      liveV2: {
        events: [{ eventId: 1, sourceId: 'a', ingestedAt: '2026-10-21T10:00:00Z', ts: '2026-10-21T10:00:00Z' }],
        serverTime: '2026-10-21T10:00:00Z',
        _fullAt: 1,
      },
    };
    ui.init({ AppState, liveV2Api: {} });
    ui.saveLiveV2Cache(AppState.liveV2);
    const key = ui.liveV2CacheKey('juan', null, { source: 'real', phase: 'FASE_LIGA' });
    assert.equal(writes, 2, 'reintenta una vez');
    assert.equal(staleKey in store, false, 'purga claves antiguas');
    const saved = JSON.parse(store[key]);
    assert.equal(saved.version, 2);
    assert.equal(saved.source, 'real');
    assert.equal(saved.phase, 'FASE_LIGA');
    assert.equal(saved.serverTime, '2026-10-21T10:00:00Z');
    assert.equal(saved.fullAt, 1);
    assert.equal(saved.truncated, false);
    assert.equal(saved.events.length, 1);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});

test('saveLiveV2Cache purga claves antiguas tras un guardado correcto', () => {
  const ui = freshUi();
  const day = ui.liveV2CacheDay();
  const staleKeys = [
    'porra_live_events_v2:2026-10-20:ana:real:FASE_LIGA',
    `porra_live_events_v2:${day}:juan:sim:FASE_8`,
    `porra_live_events_v1:${day}:juan`,
  ];
  const store = { unrelated: 'x' };
  for (const k of staleKeys) store[k] = '{}';
  let writes = 0;
  const storage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { writes++; store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  const prev = global.localStorage;
  global.localStorage = storage;
  try {
    const AppState = {
      currentUser: { name: 'juan' },
      appConfig: { faseJuego: 'FASE_LIGA' },
      liveV2: {
        events: [{ eventId: 1, sourceId: 'a', ingestedAt: '2026-10-21T10:00:00Z', ts: '2026-10-21T10:00:00Z' }],
        serverTime: '2026-10-21T10:00:00Z',
        _fullAt: 1,
      },
    };
    ui.init({ AppState, liveV2Api: {} });
    ui.saveLiveV2Cache(AppState.liveV2);
    const key = ui.liveV2CacheKey('juan', null, { source: 'real', phase: 'FASE_LIGA' });
    assert.equal(writes, 1, 'no necesita reintento');
    for (const k of staleKeys) assert.equal(k in store, false, `purga ${k}`);
    assert.equal(store.unrelated, 'x', 'no toca claves ajenas');
    assert.ok(key in store, 'guarda la clave actual');
    const saved = JSON.parse(store[key]);
    assert.equal(saved.serverTime, '2026-10-21T10:00:00Z');
    assert.equal(saved.fullAt, 1);
    assert.equal(saved.truncated, false);
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});

test('saveLiveV2Cache no lanza si fallan dos escrituras y borra la clave actual', () => {
  const ui = freshUi();
  const key = ui.liveV2CacheKey('juan', null, { source: 'real', phase: 'FASE_LIGA' });
  const staleKey = 'porra_live_events_v2:2026-10-20:ana:real:FASE_LIGA';
  const store = { [key]: 'old', [staleKey]: '{}' };
  let writes = 0;
  const storage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: () => { writes++; throw new Error('QuotaExceededError'); },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i],
  };
  const prev = global.localStorage;
  global.localStorage = storage;
  try {
    const AppState = {
      currentUser: { name: 'juan' },
      appConfig: { faseJuego: 'FASE_LIGA' },
      liveV2: {
        events: [{ eventId: 1, sourceId: 'a', ingestedAt: '2026-10-21T10:00:00Z', ts: '2026-10-21T10:00:00Z' }],
        serverTime: '2026-10-21T10:00:00Z',
        _fullAt: 1,
      },
    };
    ui.init({ AppState, liveV2Api: {} });
    assert.doesNotThrow(() => ui.saveLiveV2Cache(AppState.liveV2));
    assert.equal(writes, 2, 'reintenta una sola vez');
    assert.equal(key in store, false, 'elimina la clave actual');
    assert.equal(staleKey in store, false, 'la purga previa elimina claves viejas');
  } finally {
    if (prev === undefined) delete global.localStorage; else global.localStorage = prev;
  }
});

test('liveV2Folded rellena un partido que solo está en livematches', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const now = Date.now();
  const stats = { 10: { goles: 2 }, 20: { goles: 1 }, jugadores: [] };
  const AppState = {
    currentUser: { name: 'me' },
    appConfig: { faseJuego: 'FASE_LIGA' },
    liveV2: {
      events: [],
      _liveSnapshots: {
        2: { eventId: 2, status: 'LIVE', minute: 33, lastUpdated: new Date(now).toISOString(), stats },
      },
    },
    matches: [{ id: 2, homeTeamId: 10, awayTeamId: 20 }],
    allPlayers: [],
  };
  ui.init({ AppState, liveV2Api: liveV2 });
  const folded = ui.liveV2Folded();
  assert.equal(folded.states[2].status, 'LIVE');
  assert.deepEqual(folded.states[2].score, { home: 2, away: 1 });
  assert.equal(folded.statsById[2], stats);
});

test('un partido solo en livematches cuenta en filas, chip y modal sin estar en matches', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const liveApi = require('../js/live.js');
  const now = Date.now();
  const stats = { 10: { goles: 2 }, 20: { goles: 1 }, jugadores: [] };
  const AppState = {
    currentUser: { name: 'me' },
    appConfig: { faseJuego: 'FASE_LIGA' },
    liveV2: {
      events: [],
      _liveSnapshots: {
        2: { eventId: 2, status: 'LIVE', minute: 33, lastUpdated: new Date(now).toISOString(), stats },
      },
    },
    matches: [],
    teamsMap: { 10: { name: 'Local' }, 20: { name: 'Visitante' } },
    allPredictions: { me: { 2: { home: 2, away: 1 } } },
    squadsCache: { me: [] },
    matchStats: [],
    allPlayers: [],
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    liveApi,
    liveV2Abbr: s => String(s).slice(0, 3),
    visiblePlayers: () => [{ name: 'me', avatar: '⚽' }],
    getUserTotalRealPoints: () => 0,
    calculateMatchPoints: (pred, ms, lm) => {
      const home = Number(ms.stats[lm.homeTeamId] && ms.stats[lm.homeTeamId].goles);
      const away = Number(ms.stats[lm.awayTeamId] && ms.stats[lm.awayTeamId].goles);
      return { points: home === 2 && away === 1 ? 15 : 0, breakdown: ['15 por marcador exacto'] };
    },
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });

  const folded = ui.liveV2Folded();
  const rows = ui.liveV2Rows(folded);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].livePoints, 15);
  assert.equal(rows[0].pointsDelta, 15);
  assert.equal(rows[0].officialPoints, 0);

  const chip = ui.liveV2ChipData(2, folded.states[2]);
  assert.equal(chip.meta.homeTeamId, '10');
  assert.equal(chip.meta.awayTeamId, '20');
  assert.equal(chip.meta.homeTeam, 'Local');
  assert.equal(chip.meta.awayTeam, 'Visitante');
  assert.equal(chip.score, '2-1');
  assert.equal(chip.homeBadge, 'data/imgEquipos/10.webp');
  assert.equal(chip.awayBadge, 'data/imgEquipos/20.webp');

  const modal = ui.liveV2MatchBreakdown(2, folded.states[2]);
  assert.equal(modal.meta.homeTeamId, '10');
  assert.equal(modal.meta.awayTeamId, '20');
  assert.equal(modal.meta.homeTeam, 'Local');
  assert.equal(modal.meta.awayTeam, 'Visitante');
  assert.deepEqual(modal.score, { home: 2, away: 1 });
  assert.equal(modal.predictionPts, 15);
  assert.equal(modal.total, 15);
  assert.deepEqual(modal.predictionBreakdown, ['15 por marcador exacto']);
});

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

test('liveV2PlayerMatches mantiene un FT ya finalizado en matchStats y lo suma al resumen', () => {
  const ui = freshUi();
  const liveV2 = require('../js/liveV2.js');
  const AppState = {
    matches: [
      { id: 3, fechaTs: 300, homeTeamId: 30, awayTeamId: 40, homeTeam: 'Otro', awayTeam: 'Rival' },
    ],
    allPredictions: { rival: { 3: { home: 1, away: 0 } } },
    squadsCache: { rival: [{ id: 7, nombre: 'Delantero' }] },
    allPlayers: [],
    matchStats: [{ eventId: 3, stats: { 30: { goles: 1 }, 40: { goles: 0 } } }],
    liveV2: null,
  };
  ui.init({
    AppState,
    liveV2Api: liveV2,
    calculateMatchPoints: () => ({ points: 8, breakdown: ['8 por acertar resultado'] }),
    calculatePlayerMatchPoints: () => ({ total: 2, desglose: [{ concepto: 'Gol' }] }),
  });
  const folded = {
    states: { 3: { status: 'FT', score: { home: 1, away: 0 } } },
    statsById: { 3: { jugadores: [{ id: 7, minutos: 90 }] } },
  };
  const matches = ui.liveV2PlayerMatches('rival', folded);
  assert.deepEqual(matches.map(m => m.eventId), [3]);
  assert.equal(matches[0].status, 'FT');
  assert.deepEqual(ui.liveV2PlayerSummary(matches), { predictionPts: 8, squadPts: 2, total: 10 });
});

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

test('refreshLiveV2PlayerModal conserva el foco dentro del modal', () => {
  const ui = freshUi();
  const liveV2Api = {
    foldAll: () => ({ 2: { status: 'LIVE', score: { home: 1, away: 0 } } }),
    matchStateToStats: () => ({ jugadores: [] }),
    escapeHtml: s => String(s),
  };
  const AppState = {
    liveV2: { events: [], _openPlayerModal: 'Ana' },
    matches: [{
      id: 2, fechaTs: 200, homeTeamId: 10, awayTeamId: 20,
      homeTeam: 'Local', awayTeam: 'Visita',
    }],
    allPredictions: {}, squadsCache: {}, allPlayers: [], matchStats: [],
  };
  ui.init({
    AppState,
    liveV2Api,
    visiblePlayers: () => [{ name: 'Ana', avatar: '⚽' }],
    calculateMatchPoints: () => ({ points: 0, breakdown: [] }),
  });
  const focused = [];
  const closeOld = { focus() { focused.push('old'); } };
  const closeNew = { focus() { focused.push('new'); } };
  const host = {
    contains: el => el === closeOld,
    querySelector: sel => (sel === '.breakdown-modal-close' ? closeNew : null),
    innerHTML: '',
  };
  const prevDoc = global.document;
  global.document = {
    getElementById: id => (id === 'livev2-player-modal' ? host : null),
    activeElement: closeOld,
    removeEventListener: () => {},
  };
  try {
    ui.refreshLiveV2PlayerModal();
  } finally {
    if (prevDoc === undefined) delete global.document; else global.document = prevDoc;
  }
  assert.deepEqual(focused, ['new']);
});

test('liveV2RowHtml marca la fila como botón accesible con chevron', () => {
  const ui = freshUi();
  ui.init({ AppState: { liveV2: null }, liveV2Api: { escapeHtml: s => String(s) } });
  const html = ui.liveV2RowHtml({
    name: 'Ana', avatar: '⚽', rank: 2, livePoints: 30, pointsDiff: 0, isMe: false,
    rankMove: { text: '=', cls: 'eq', label: 'Sin cambios' },
  });
  assert.match(html, /role="button"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-label="Ver desglose de Ana, puesto 2, 30 puntos"/);
  assert.equal(
    ui.liveV2RowAriaLabel({ name: 'Ana', rank: 2, livePoints: 30 }),
    'Ver desglose de Ana, puesto 2, 30 puntos',
  );
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
