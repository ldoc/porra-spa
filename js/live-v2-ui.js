/**
 * Live v2 UI (SPA, fase 1) — UI, animaciones, audio, fullscreen y polling.
 *
 * Extraído de js/main.js sin cambios de lógica. Las dependencias que viven en
 * main.js se inyectan con `liveV2Ui.init({...})` antes de usar la API.
 */
(function (global) {
  'use strict';

  let AppState;
  let API_BASE;
  let fetchWithPhase;
  let liveV2Api;
  let liveApi;
  let soundApi;
  let visiblePlayers;
  let getUserTotalRealPoints;
  let calculateMatchPoints;
  let calculatePlayerMatchPoints;
  let liveV2Abbr;

  function init(deps) {
    deps = deps || {};
    AppState = deps.AppState;
    API_BASE = deps.API_BASE;
    fetchWithPhase = deps.fetchWithPhase;
    liveV2Api = deps.liveV2Api;
    liveApi = deps.liveApi;
    soundApi = deps.soundApi;
    visiblePlayers = deps.visiblePlayers;
    getUserTotalRealPoints = deps.getUserTotalRealPoints;
    calculateMatchPoints = deps.calculateMatchPoints;
    calculatePlayerMatchPoints = deps.calculatePlayerMatchPoints;
    liveV2Abbr = deps.liveV2Abbr;
  }

// Singleton AudioContext memoizado en el cableado (no en js/sound.js):
// se crea perezosamente una sola vez y solo tras el primer gesto del
// usuario (autoplay policy). Antes de eso los beeps son no-op seguros.
let _liveAudioCtx = null;
let _liveAudioUnlocked = false;
function unlockLiveAudio() {
  if (_liveAudioUnlocked) return _liveAudioCtx;
  try {
    if (typeof soundApi !== 'undefined' && soundApi.realAudioContext) {
      const ctx = soundApi.realAudioContext();
      if (ctx) {
        _liveAudioCtx = ctx;
        _liveAudioUnlocked = true;
      }
    }
  } catch (e) { /* sin audio */ }
  return _liveAudioCtx;
}

// Sonido del Live v2: preferencia persistida en localStorage (default ON).
// El AudioContext se crea perezosamente en el primer tap del usuario (unlockLiveAudio).
let _liveV2SoundEnabled = null;
function liveV2SoundEnabled() {
  if (_liveV2SoundEnabled === null) {
    try {
      _liveV2SoundEnabled = (typeof soundApi !== 'undefined' && soundApi.loadSoundEnabled)
        ? soundApi.loadSoundEnabled(localStorage) : true;
    } catch (e) { _liveV2SoundEnabled = true; }
  }
  return _liveV2SoundEnabled;
}

function setLiveV2SoundEnabled(v) {
  _liveV2SoundEnabled = !!v;
  try {
    if (typeof soundApi !== 'undefined' && soundApi.saveSoundEnabled) {
      soundApi.saveSoundEnabled(localStorage, _liveV2SoundEnabled);
    }
  } catch (e) { /* sin storage */ }
}

/** Botón 🔔/🔕 de la cabecera fija del Live v2 (zona táctil ≥44px). */
function liveV2SoundToggleHtml() {
  const on = liveV2SoundEnabled();
  return `<button type="button" id="livev2-sound-toggle" class="livev2-sound${on ? ' on' : ''}"`
    + ` aria-label="${on ? 'Silenciar sonido' : 'Activar sonido'}" aria-pressed="${on ? 'true' : 'false'}">${on ? '🔔' : '🔕'}</button>`;
}

function updateLiveV2SoundToggle(root) {
  const scope = root || document;
  const btn = scope.querySelector('#livev2-sound-toggle');
  if (!btn) return;
  const on = liveV2SoundEnabled();
  btn.textContent = on ? '🔔' : '🔕';
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? 'Silenciar sonido' : 'Activar sonido');
}

/** Botón Reintentar del banner de error/stale (zona táctil ≥44px). */
function bindLiveV2Retry(root) {
  const scope = root || document;
  const btn = scope.querySelector('#livev2-retry');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => { retryLiveV2(); });
}

function bindLiveV2SoundToggle(root) {
  const scope = root || document;
  bindLiveV2Retry(scope);
  const btn = scope.querySelector('#livev2-sound-toggle');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    setLiveV2SoundEnabled(!liveV2SoundEnabled());
    unlockLiveAudio(); // crea el AudioContext en un gesto del usuario
    updateLiveV2SoundToggle(scope);
  });
}

// ── Pantalla completa del Live v2 (oculta header, nav inferior y tabs) ──
let _liveV2FsChangeBound = false;
let _liveV2FsHistoryPushed = false;

function liveV2FsHistoryRef() {
  try {
    if (typeof window !== 'undefined' && window.history) return window.history;
    if (typeof history !== 'undefined') return history;
  } catch (e) { /* sin historial */ }
  return null;
}

function liveV2FsActive() {
  return typeof document !== 'undefined' && document.body.classList.contains('live-fs');
}

function liveV2FsToggleHtml() {
  const on = liveV2FsActive();
  return `<button type="button" id="livev2-fs-toggle" class="livev2-fs${on ? ' on' : ''}"`
    + ` aria-label="${on ? 'Salir de pantalla completa' : 'Pantalla completa'}">${on ? '⤡' : '⛶'}</button>`;
}

function updateLiveV2FsToggle(root) {
  const btn = (root || document).querySelector('#livev2-fs-toggle');
  if (!btn) return;
  const on = liveV2FsActive();
  btn.textContent = on ? '⤡' : '⛶';
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
}

function enterLiveV2Fullscreen() {
  if (typeof document === 'undefined' || liveV2FsActive()) return;
  document.body.classList.add('live-fs');
  const hist = liveV2FsHistoryRef();
  if (hist && typeof hist.pushState === 'function') {
    try {
      hist.pushState({ liveFs: true }, '');
      _liveV2FsHistoryPushed = true;
    } catch (e) { _liveV2FsHistoryPushed = false; }
  }
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* sin API */ }
  updateLiveV2FsToggle();
}

function exitLiveV2Fullscreen(fromHistory) {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('live-fs');
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* sin API */ }
    updateLiveV2FsToggle();
  }
  const wasPushed = _liveV2FsHistoryPushed;
  _liveV2FsHistoryPushed = false;
  if (!fromHistory && wasPushed) {
    const hist = liveV2FsHistoryRef();
    if (hist && hist.state && hist.state.liveFs && typeof hist.back === 'function') {
      try { hist.back(); } catch (e) { /* sin historial */ }
    }
  }
}

function bindLiveV2Fullscreen(root) {
  const btn = (root || document).querySelector('#livev2-fs-toggle');
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => { if (liveV2FsActive()) exitLiveV2Fullscreen(); else enterLiveV2Fullscreen(); });
  }
  if (!_liveV2FsChangeBound && typeof document !== 'undefined') {
    _liveV2FsChangeBound = true;
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) exitLiveV2Fullscreen();
      else updateLiveV2FsToggle();
    });
    document.addEventListener('popstate', () => {
      _liveV2FsHistoryPushed = false;
      if (liveV2FsActive()) exitLiveV2Fullscreen(true);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !liveV2FsActive()) return;
      e.preventDefault();
      exitLiveV2Fullscreen();
    });
  }
}

/** Skeleton del Live con la salida de pantalla completa siempre disponible. */
function liveV2SkeletonHtml(bodyHtml) {
  return `<div class="livev2"><div class="livev2-fixed"><div class="livev2-status">`
    + `<span class="livev2-badge live">● CARGANDO</span>`
    + `<div class="livev2-status-right">${liveV2FsToggleHtml()}</div>`
    + `</div></div><div class="livev2-body">${bodyHtml || ''}</div></div>`;
}

/** deps de soundApi.playLiveEvent, o null si el sonido está desactivado. */
function liveV2SoundDeps() {
  if (typeof soundApi === 'undefined' || !soundApi.playLiveEvent || !soundApi.loadSoundEnabled) return null;
  let enabled = true;
  try { enabled = soundApi.loadSoundEnabled(localStorage); } catch (e) { enabled = true; }
  if (!enabled) return null;
  return { enabled, ctx: _liveAudioCtx, navigatorRef: (typeof navigator !== 'undefined' ? navigator : null) };
}

/**
 * Delta de puntos del usuario por evento nuevo de un partido, antes/después del poll.
 * Precondición: sin eventos nuevos devuelve ceros; no se usa para consultar los
 * puntos actuales de un partido (ningún caller depende de `after` en ese caso).
 */
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
    status: s.status,
    stats: liveV2Api.matchStateToStats(s, fullCtx, serverNow)
  }, meta).total;
  const before = pointsOf(state);
  let prev = before;
  const out = [];
  for (const ev of liveV2Api.sortEvents(newFor)) {
    const nonScoring = ev.type === 'status' || ev.type === 'lineup';
    liveV2Api.applyEvent(state, ev, ctx || {});
    const now = pointsOf(state);
    if (!nonScoring && now !== prev) out.push({ event: ev, delta: now - prev });
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

/** Un sonido por partido/poll según el efecto neto en mis puntos (solo si el sonido está activo). */
function liveV2PlayNewEventSounds(newEvents) {
  if (!newEvents || !newEvents.length) return;
  if (typeof liveV2Api === 'undefined') return;
  const me = AppState.currentUser && AppState.currentUser.name;
  if (!me) return;
  const deps = liveV2SoundDeps();
  if (!deps) return;
  const finalized = new Set((AppState.matchStats || []).map(ms => String(ms.eventId)));
  for (const ev of newEvents) {
    if (ev.type !== 'status' || !ev.payload) continue;
    if (finalized.has(String(ev.eventId))) continue;
    const type = ev.payload.status === 'FT' ? 'end' : 'status';
    soundApi.playLiveEvent({ type }, true, deps);
  }
  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const serverNow = liveV2PlayheadMs(st);
  const byMatch = {};
  for (const ev of newEvents) (byMatch[String(ev.eventId)] = byMatch[String(ev.eventId)] || []).push(ev);
  for (const [id, events] of Object.entries(byMatch)) {
    if (finalized.has(id)) continue;
    const res = liveV2EventDeltas(me, id, events, st.events, ctxById[id] || {}, playersById, serverNow);
    const net = res.events.reduce((s, d) => s + d.delta, 0);
    const quality = liveV2SoundQuality(net, events.some(e => e.type === 'goal'));
    if (!quality) continue;
    soundApi.playLiveEvent({ type: 'goal' }, quality, deps);
  }
}

/** Suena rankUp/rankDown cuando mi puesto cambia respecto al poll anterior. */
function liveV2PlayRankSound(meRow, prevMe) {
  if (!meRow || !prevMe || prevMe.rank === meRow.rank) return;
  const deps = liveV2SoundDeps();
  if (!deps) return;
  soundApi.playLiveEvent({ type: meRow.rank < prevMe.rank ? 'rankUp' : 'rankDown' }, true, deps);
}

function liveState() {
  if (!AppState.live) AppState.live = {};
  return AppState.live;
}

/** Metadatos de un liveMatch: equipos desde AppState.matches o fallback a stats */
function liveMatchMeta(lm) {
  const m = (AppState.matches || []).find(x => String(x.id) === String(lm.eventId));
  if (m) {
    return { homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeBadgeExt: m.homeBadgeExt, awayBadgeExt: m.awayBadgeExt, fase: m.fase, ronda: m.ronda };
  }
  const goals = (typeof liveApi !== 'undefined') ? liveApi.liveGoalsOf(lm.stats) : {};
  const ids = Object.keys(goals);
  const h = ids[0], a = ids[1];
  const name = id => (AppState.teamsMap && AppState.teamsMap[id] && AppState.teamsMap[id].name) || `Equipo ${id}`;
  return { homeTeamId: h, awayTeamId: a, homeTeam: h !== undefined ? name(h) : '?', awayTeam: a !== undefined ? name(a) : '?' };
}

/** Puntos live de un usuario en un partido: pronóstico + plantilla (provisional si no FT) */
function liveUserMatchPoints(username, lm, meta) {
  if (lm.status === 'NS') return { matchPts: 0, breakdown: [], squadPts: 0, squadDetail: [], total: 0 };
  const preds = (AppState.allPredictions || {})[username] || {};
  const pseudoMs = { eventId: lm.eventId, stats: lm.stats };
  const mp = calculateMatchPoints(preds[lm.eventId], pseudoMs, { homeTeamId: meta.homeTeamId, awayTeamId: meta.awayTeamId });
  let squadPts = 0;
  const squadDetail = [];
  const squad = (AppState.squadsCache || {})[username];
  const jugadores = (lm.stats && lm.stats.jugadores) || [];
  if (squad && jugadores.length) {
    for (const sp of squad) {
      const jd = jugadores.find(j => String(j.id) === String(sp.id));
      if (!jd) continue;
      const r = calculatePlayerMatchPoints(jd, sp, pseudoMs);
      if (r.total !== 0 || r.desglose.length) {
        squadPts += r.total;
        const desglose = (r.desglose || []).map(d => (d.concepto === 'Portería a cero' && lm.status !== 'FT')
          ? { ...d, concepto: d.concepto + ' (provisional)' } : d);
        squadDetail.push({ nombre: sp.nombre, puntos: r.total, desglose });
      }
    }
  }
  return { matchPts: mp.points, breakdown: mp.breakdown, squadPts, squadDetail, total: mp.points + squadPts };
}

/** Clasificación oficial (puntos reales) con caché mientras no cambien los matchStats */
function liveOfficialRows() {
  const st = liveState();
  if (st.officialRows && st.officialStatsRef === AppState.matchStats) return st.officialRows;
  const rows = visiblePlayers().map(p => ({ name: p.name, officialPoints: getUserTotalRealPoints(p.name) }));
  rows.sort((a, b) => b.officialPoints - a.officialPoints || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.officialRank = i + 1; });
  st.officialRows = rows;
  st.officialStatsRef = AppState.matchStats;
  return rows;
}

// ============================================================
// TAB LIVE v2 (event-sourcing): fetch de eventos + clasificación incremental
// Layout A: estado (badge + puntos inline + sonido) + grid de partidos + clasificación general.
// ============================================================

const LIVEV2_CACHE_KEY = 'porra_live_events_v1';
let _liveV2CacheRestored = false;

/** localStorage del Live (datos públicos) o null si no está disponible (modo privado). */
function liveV2CacheStorage() {
  try {
    const storage = global.localStorage;
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
      ? storage : null;
  } catch (e) { return null; }
}

/** Día local en formato YYYY-MM-DD (la caché caduca al cambiar de día). */
function liveV2CacheDay(now) {
  const d = now == null ? new Date() : new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Clave de caché acotada a día local + usuario (null si no hay usuario). */
function liveV2CacheKey(username, now) {
  if (!username) return null;
  return `${LIVEV2_CACHE_KEY}:${liveV2CacheDay(now)}:${username}`;
}

/** Un full cacheado solo sirve si trae eventos, cursor y sello fullAt. */
function liveV2CacheIsFresh(cached) {
  return !!cached
    && Array.isArray(cached.events)
    && typeof cached.serverTime === 'string' && !!cached.serverTime
    && Number.isFinite(cached.fullAt);
}

/** Restaura el último full cacheado de hoy/usuario una sola vez por carga de página. */
function restoreLiveV2Cache(st) {
  if (_liveV2CacheRestored) return;
  const username = AppState && AppState.currentUser && AppState.currentUser.name;
  const key = liveV2CacheKey(username);
  if (!key) return; // aún sin sesión: se intentará al entrar en Live
  _liveV2CacheRestored = true;
  const storage = liveV2CacheStorage();
  if (!storage) return;
  try {
    const cached = JSON.parse(storage.getItem(key) || 'null');
    if (!liveV2CacheIsFresh(cached)) return; // sin fullAt o clave ajena → full
    st.events = cached.events;
    st.serverTime = cached.serverTime;
    st.serverNow = cached.serverTime;
    st._fullAt = cached.fullAt;
  } catch (e) { /* caché ausente, corrupta o sin storage */ }
}

/** Guarda el último full (eventos + cursor) para reutilizarlo como delta al recargar. */
function saveLiveV2Cache(st) {
  const username = AppState && AppState.currentUser && AppState.currentUser.name;
  const key = liveV2CacheKey(username);
  if (!key) return;
  const storage = liveV2CacheStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({
      events: st.events || [],
      serverTime: st.serverTime || null,
      fullAt: st._fullAt || Date.now(),
    }));
  } catch (e) { /* sin espacio o storage no disponible */ }
}

/** Elimina todas las claves porra_live_events_v1* (logout). Devuelve cuántas borró. */
function purgeLiveV2Caches(storage) {
  const s = storage || liveV2CacheStorage();
  if (!s) return 0;
  let removed = 0;
  try {
    const keys = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.indexOf(LIVEV2_CACHE_KEY) === 0) keys.push(k);
    }
    for (const k of keys) { s.removeItem(k); removed++; }
  } catch (e) { /* storage no disponible */ }
  return removed;
}

function liveV2State() {
  if (!AppState.liveV2) {
    AppState.liveV2 = {
      events: [], serverTime: null, prevRanks: null, polling: false, _lastRows: [], _seenEventIds: null,
      _fullAt: 0, _needFull: false, lastFetchAt: null, error: null,
      _chipChanged: {}, // eventId -> ts del último cambio de marcador (para glow + orden)
      _chipScores: {},  // eventId -> "home-away" del poll anterior (detección de cambios)
    };
    restoreLiveV2Cache(AppState.liveV2);
  }
  if (!AppState.liveV2._chipChanged) AppState.liveV2._chipChanged = {};
  if (!AppState.liveV2._chipScores) AppState.liveV2._chipScores = {};
  return AppState.liveV2;
}

const LIVEV2_CHIP_GLOW_MS = 10000;

/** playerId -> { nombre, posicion, equipo } desde AppState.allPlayers */
function liveV2PlayersById() {
  const out = {};
  for (const p of AppState.allPlayers || []) out[String(p.id)] = { nombre: p.nombre, posicion: p.posicion, equipo: p.equipo };
  return out;
}

/** matchId -> { homeTeamId, awayTeamId } desde AppState.matches */
function liveV2CtxById() {
  const out = {};
  for (const m of AppState.matches || []) out[m.id] = { homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId };
  return out;
}

/** ms del reloj de pared del servidor (X-Server-Time), o null si no hay. */
function liveV2PlayheadMs(st) {
  const raw = st && st.serverNow;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Carga inicial (forceFull) o delta (?since=serverTime); dedup por eventId|sourceId */
async function fetchLiveEvents(forceFull, _resyncGuard) {
  const st = liveV2State();
  const params = new URLSearchParams();
  if (!forceFull && st.serverTime) params.set('since', st.serverTime);
  const win = typeof window !== 'undefined' ? window : null;
  if (win && win.location && liveV2Api.wantSimSource(win.location.search, win.location.hostname)) params.set('source', 'sim');
  const qs = params.toString();
  const url = API_BASE + '/api/live/events' + (qs ? '?' + qs : '');
  const res = await fetchWithPhase(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const payload = await res.json();
  if (!payload || !payload.ok) {
    st.error = true;
    const detail = payload && payload.error ? String(payload.error) : 'respuesta no válida';
    throw new Error('Live events: ' + detail);
  }
  // Reloj de pared del servidor: el cursor `serverTime` es max(ingestedAt), no "ahora".
  const headerTime = res.headers && typeof res.headers.get === 'function'
    ? res.headers.get('X-Server-Time') : null;
  st.serverNow = headerTime || new Date().toISOString();

  const keyOf = e => liveV2Api.eventKey(e);
  const incoming = payload.events || [];
  if (!forceFull && payload.resync && !_resyncGuard) {
    // Delta truncado/cursor inválido: NO se anexa nada; full inmediato y autoritativo.
    st._needFull = true;
    return fetchLiveEvents(true, true);
  }
  if (forceFull) {
    // Un full es autoritativo: reemplaza eventos y resetea el estado derivado.
    st.events = incoming;
    st._seenEventIds = new Set(incoming.map(keyOf));
    st._chipChanged = {};
    st._chipScores = {};
    st.prevRanks = null;
    // Si el full no trae cursor, se invalida el delta (no se conserva el anterior).
    st.serverTime = payload.serverTime || null;
    st._fullAt = Date.now();
    st._needFull = false;
    saveLiveV2Cache(st);
  } else {
    const seen = new Set(st.events.map(keyOf));
    for (const e of incoming) {
      const k = keyOf(e);
      if (!seen.has(k)) { st.events.push(e); seen.add(k); }
    }
    st.serverTime = payload.serverTime || st.serverTime;
  }
  st.lastFetchAt = Date.now();
}

/** Pliega todos los eventos (presente) → { states, statsById } */
function liveV2Folded() {
  if (typeof liveV2Api === 'undefined') return { states: {}, statsById: {} };
  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const states = liveV2Api.foldAll(st.events, ctxById);
  const statsById = {};
  const playhead = liveV2PlayheadMs(st);
  for (const [id, s] of Object.entries(states)) {
    const ctx = { ...(ctxById[id] || {}), playersById };
    statsById[id] = liveV2Api.matchStateToStats(s, ctx, playhead);
  }
  return { states, statsById };
}

/** eventIds ya finalizados (tienen matchstat) para no duplicar con los puntos oficiales */
function liveV2FinalizedIds() {
  const set = new Set();
  for (const ms of AppState.matchStats || []) set.add(String(ms.eventId));
  return set;
}

/** Filas = puntos oficiales + delta de los partidos en juego, ordenadas con rankRows */
function liveV2Rows(folded) {
  const st = liveV2State();
  const official = liveOfficialRows();
  const officialByName = {};
  for (const r of official) officialByName[r.name] = r.officialPoints;
  const finalized = liveV2FinalizedIds();
  const players = visiblePlayers();
  const me = AppState.currentUser && AppState.currentUser.name;
  const rows = players.map(pl => {
    let delta = 0;
    for (const id of Object.keys(folded.statsById || {})) {
      if (finalized.has(String(id))) continue; // ya cuenta en los puntos oficiales
      const match = (AppState.matches || []).find(m => String(m.id) === String(id));
      if (!match) continue;
      const state = folded.states[id];
      const status = state?.status || 'NS';
      if (status === 'NS') continue;
      const lm = { eventId: match.id, stats: folded.statsById[id], status };
      delta += liveUserMatchPoints(pl.name, lm, liveMatchMeta(lm)).total;
    }
    const officialPoints = officialByName[pl.name] || 0;
    return { name: pl.name, avatar: pl.avatar, livePoints: officialPoints + delta, officialPoints, pointsDelta: delta, isMe: pl.name === me };
  });
  return liveV2Api.rankRows(rows, st.prevRanks);
}

function liveV2Esc(s) {
  return liveV2Api.escapeHtml(s);
}

/** Etiqueta de estado del chip: NS, LIVE 63', HT o FT (LIVE si no hay minuto). */
function liveV2ChipLabel(state, playheadTs) {
  if (!state) return 'NS';
  if (state.status === 'NS') return 'NS';
  if (state.status === 'HT') return 'HT';
  if (state.status === 'FT') return 'FT';
  const ts = playheadTs != null
    ? playheadTs
    : (typeof AppState !== 'undefined' && AppState ? liveV2PlayheadMs(liveV2State()) : null);
  const api = (typeof liveV2Api !== 'undefined' && liveV2Api) || global.liveV2Api;
  let minute = null;
  if (api && typeof api.matchClockAt === 'function') {
    minute = api.matchClockAt(state, ts);
  }
  if (minute == null) minute = state.lastMinute;
  if (minute == null) return 'LIVE';
  return `LIVE ${minute}'`;
}

/** true si hay al menos un partido en juego (LIVE o descanso HT). */
function liveV2HasInPlay(folded) {
  return Object.values((folded && folded.states) || {}).some(s => s && (s.status === 'LIVE' || s.status === 'HT'));
}

function liveV2BadgeSrc(teamId, ext) {
  return teamId != null ? `data/imgEquipos/${teamId}.${ext || 'webp'}` : null;
}

/** Datos derivados de un chip: se usan tanto para crear el HTML como para parchearlo. */
function liveV2ChipData(eventId, state) {
  // foldAll usa claves string (ids de partido); normaliza a match.id (number) para liveMatchMeta
  const match = (AppState.matches || []).find(m => String(m.id) === String(eventId));
  const meta = liveMatchMeta({ eventId: match ? match.id : eventId });
  return {
    meta,
    score: state && state.score ? `${state.score.home}-${state.score.away}` : '–',
    label: liveV2ChipLabel(state),
    chipCls: ((state && state.status) || 'NS').toLowerCase(),
    cls: `livev2-cell${state && (state.status === 'LIVE' || state.status === 'HT') ? ' live' : ''}`
      + `${state && state.status === 'FT' ? ' ft' : ''}`
      + `${liveV2ChipIsRecentChange(eventId) ? ' changed' : ''}`,
    fullTitle: `${meta.homeTeam} ${state && state.score ? `${state.score.home}-${state.score.away}` : '–'} ${meta.awayTeam} · ${liveV2ChipLabel(state)}`,
    homeBadge: liveV2BadgeSrc(meta.homeTeamId, meta.homeBadgeExt),
    awayBadge: liveV2BadgeSrc(meta.awayTeamId, meta.awayBadgeExt),
    homeAbbr: liveV2Abbr(meta.homeTeam),
    awayAbbr: liveV2Abbr(meta.awayTeam),
  };
}

function liveV2ChipHtml(eventId, state) {
  const d = liveV2ChipData(eventId, state);
  const hb = d.homeBadge
    ? `<img class="livev2-cell-badge home" src="${d.homeBadge}" alt="" loading="lazy" onerror="this.onerror=null;this.src='data/imgEquipos/default.webp'">`
    : '';
  const ub = d.awayBadge
    ? `<img class="livev2-cell-badge away" src="${d.awayBadge}" alt="" loading="lazy" onerror="this.onerror=null;this.src='data/imgEquipos/default.webp'">`
    : '';
  return `<div class="${d.cls}" data-livev2-chip="${liveV2Esc(eventId)}" title="${liveV2Esc(d.fullTitle)}" aria-label="${liveV2Esc(d.fullTitle)}">`
    + hb
    + `<span class="livev2-cell-team">${liveV2Esc(d.homeAbbr)}</span>`
    + `<span class="livev2-cell-score">${liveV2Esc(d.score)}</span>`
    + `<span class="livev2-chip-state ${liveV2Esc(d.chipCls)}">${liveV2Esc(d.label)}</span>`
    + `<span class="livev2-cell-team">${liveV2Esc(d.awayAbbr)}</span>`
    + ub
    + `</div>`;
}

/** Actualiza un chip existente sin recrear sus nodos. */
function patchLiveV2Chip(el, eventId, state) {
  const d = liveV2ChipData(eventId, state);
  if (el.className !== d.cls) el.className = d.cls;
  if (el.getAttribute('title') !== d.fullTitle) el.setAttribute('title', d.fullTitle);
  if (el.getAttribute('aria-label') !== d.fullTitle) el.setAttribute('aria-label', d.fullTitle);

  const homeBadge = el.querySelector('.livev2-cell-badge.home');
  if (homeBadge && d.homeBadge && homeBadge.getAttribute('src') !== d.homeBadge) {
    homeBadge.setAttribute('src', d.homeBadge);
  }
  const awayBadge = el.querySelector('.livev2-cell-badge.away');
  if (awayBadge && d.awayBadge && awayBadge.getAttribute('src') !== d.awayBadge) {
    awayBadge.setAttribute('src', d.awayBadge);
  }

  const teams = el.querySelectorAll('.livev2-cell-team');
  if (teams[0] && teams[0].textContent !== d.homeAbbr) teams[0].textContent = d.homeAbbr;
  if (teams[1] && teams[1].textContent !== d.awayAbbr) teams[1].textContent = d.awayAbbr;

  const scoreEl = el.querySelector('.livev2-cell-score');
  if (scoreEl && scoreEl.textContent !== d.score) scoreEl.textContent = d.score;

  const stateEl = el.querySelector('.livev2-chip-state');
  if (stateEl) {
    const cls = `livev2-chip-state ${d.chipCls}`;
    if (stateEl.className !== cls) stateEl.className = cls;
    if (stateEl.textContent !== d.label) stateEl.textContent = d.label;
  }
}

function createLiveV2Chip(eventId, state) {
  const tmp = document.createElement('div');
  tmp.innerHTML = liveV2ChipHtml(eventId, state).trim();
  return tmp.firstElementChild;
}

/**
 * Parchea el grid de chips por `data-livev2-chip`: solo crea/elimina nodos si
 * cambia el conjunto de partidos; el resto se actualiza en sitio y se reordena.
 */
function updateLiveV2Chips(root, folded) {
  const host = (root || document).querySelector('#livev2-chips-host');
  if (!host) return;
  const entries = liveV2OrderedStateEntries(folded);
  const desired = new Set(entries.map(([id]) => String(id)));
  const existing = new Map();
  host.querySelectorAll('[data-livev2-chip]').forEach(el => {
    existing.set(el.getAttribute('data-livev2-chip'), el);
  });
  for (const [key, el] of existing) {
    if (!desired.has(key)) { el.remove(); existing.delete(key); }
  }

  if (!entries.length) {
    if (!host.querySelector('.livev2-empty')) {
      const empty = document.createElement('div');
      empty.className = 'livev2-empty';
      empty.textContent = 'Sin partidos en directo ahora mismo';
      host.appendChild(empty);
    }
    return;
  }
  host.querySelectorAll('.livev2-empty').forEach(el => el.remove());

  for (const [id, state] of entries) {
    const key = String(id);
    let el = existing.get(key);
    if (!el) {
      el = createLiveV2Chip(id, state);
      if (!el) continue;
      host.appendChild(el);
      existing.set(key, el);
    }
    patchLiveV2Chip(el, id, state);
  }

  let prev = null;
  for (const [id] of entries) {
    const el = existing.get(String(id));
    if (!el) continue;
    if (prev) {
      if (prev.nextElementSibling !== el) host.insertBefore(el, prev.nextElementSibling);
    } else if (host.firstElementChild !== el) {
      host.insertBefore(el, host.firstElementChild);
    }
    prev = el;
  }
  liveV2ScheduleChipGlowTimers(host);
}

/** Timestamp de kickoff (segundos Unix) de un partido, o Infinity si no se conoce */
function liveV2KickoffTs(eventId) {
  const m = (AppState.matches || []).find(x => String(x.id) === String(eventId));
  return m && isFinite(m.fechaTs) ? m.fechaTs : Infinity;
}

/** true si el chip cambió de marcador en los últimos LIVEV2_CHIP_GLOW_MS */
function liveV2ChipIsRecentChange(eventId) {
  const st = liveV2State();
  const ts = st._chipChanged ? st._chipChanged[String(eventId)] : null;
  return !!(ts && (Date.now() - ts) < LIVEV2_CHIP_GLOW_MS);
}

/**
 * Detecta cambios de marcador entre polls comparando el `score` plegado.
 * Al cambiar, guarda `changedAt` (para glow + salto al frente). Puro sobre AppState.
 */
function liveV2DetectChipChanges(folded) {
  const st = liveV2State();
  const now = Date.now();
  for (const [id, s] of Object.entries((folded && folded.states) || {})) {
    const key = String(id);
    const cur = s && s.score ? `${s.score.home}-${s.score.away}` : null;
    const prev = st._chipScores[key];
    if (prev != null && cur != null && prev !== cur) st._chipChanged[key] = now;
    st._chipScores[key] = cur;
  }
}

/**
 * Orden de los chips (regla aprobada):
 * - Los partidos cuyo marcador cambió van al frente, más reciente primero.
 * - El resto, por hora de kickoff ascendente.
 */
function liveV2OrderedStateEntries(folded) {
  const st = liveV2State();
  const changed = st._chipChanged || {};
  const entries = Object.entries((folded && folded.states) || {});
  const changedEntries = entries.filter(([id]) => changed[String(id)]);
  const unchanged = entries.filter(([id]) => !changed[String(id)]);
  changedEntries.sort((a, b) => (changed[String(b[0])] || 0) - (changed[String(a[0])] || 0));
  unchanged.sort((a, b) => liveV2KickoffTs(a[0]) - liveV2KickoffTs(b[0]));
  return [...changedEntries, ...unchanged];
}

/** Texto del delta de puntos: ▲ +N / ▼ N / +0 */
function liveV2DeltaText(d) {
  if (d > 0) return `▲ +${d}`;
  if (d < 0) return `▼ ${d}`;
  return '+0';
}

/** Reaplica el glow 10 s a los chips que acaban de cambiar y lo retira solo (mantiene posición) */
function liveV2ScheduleChipGlowTimers(root) {
  const st = liveV2State();
  const now = Date.now();
  (root || document).querySelectorAll('.livev2-cell.changed').forEach(chip => {
    const id = chip.getAttribute('data-livev2-chip');
    const ts = id != null && st._chipChanged ? st._chipChanged[id] : null;
    if (!ts) return;
    const remaining = LIVEV2_CHIP_GLOW_MS - (now - ts);
    if (remaining <= 0) { chip.classList.remove('changed'); return; }
    setTimeout(() => chip.classList.remove('changed'), remaining);
  });
}

function liveV2RowHtml(r) {
  const d = r.delta || 0;
  const arrow = d > 0 ? `▲${d}` : d < 0 ? `▼${Math.abs(d)}` : '';
  return `<div class="livev2-row${r.isMe ? ' me' : ''}" data-livev2-row="${liveV2Esc(r.name)}">`
    + `<div class="livev2-inner">`
    + `<span class="livev2-rank">${r.rank}</span>`
    + `<span class="livev2-avatar">${liveV2Esc(r.avatar) || '⚽'}</span>`
    + `<span class="livev2-name">${liveV2Esc(r.name)}</span>`
    + `<span class="livev2-pts">${r.livePoints}</span>`
    + `<span class="livev2-arrow ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${arrow}</span>`
    + `</div></div>`;
}

/** innerHTML de las celdas del grid de partidos ('' si no hay ninguno en folded.states) */
function liveV2ChipsHtml(folded) {
  return liveV2OrderedStateEntries(folded).map(([id, s]) => liveV2ChipHtml(id, s)).join('');
}

/** Clave estable de un evento para parchear el feed sin duplicar nodos. */
function liveV2FeedKey(ev) {
  if (typeof liveV2Api !== 'undefined' && liveV2Api.eventKey) return liveV2Api.eventKey(ev);
  return `${ev.eventId || ''}|${ev.sourceId || ''}|${ev.ts || ''}|${ev.type || ''}`;
}

/** Items visibles del ticker (más recientes primero). */
function liveV2FeedItems() {
  const st = liveV2State();
  const playersById = liveV2PlayersById();
  const events = (st.events || [])
    .filter(e => isFinite(new Date(e.ts).getTime()))
    .filter(e => !['lineup', 'status'].includes(e.type))
    .sort((a, b) => new Date(a.ts) - new Date(b.ts) || ((a.seq || 0) - (b.seq || 0)))
    .slice(-4)
    .reverse();
  const items = [];
  for (const e of events) {
    const l = (typeof liveV2Api !== 'undefined' && liveV2Api.feedLabel) ? liveV2Api.feedLabel(e, playersById) : null;
    if (!l) continue;
    items.push({ key: liveV2FeedKey(e), icon: l.icon, text: l.text });
  }
  return items;
}

/** Ticker compacto (3–4 líneas) con los eventos útiles más recientes del presente. */
function liveV2FeedHtml() {
  const items = liveV2FeedItems().map(i =>
    `<span class="livev2-ticker-item" data-livev2-key="${liveV2Esc(i.key)}">${i.icon} ${liveV2Esc(i.text)}</span>`
  ).join('');
  return `<div class="livev2-ticker-head">📣 Últimos eventos</div>`
    + `<div class="livev2-ticker-body">${items || `<span class="livev2-ticker-empty">Aún no hay eventos.</span>`}</div>`;
}

/** Parchea el feed por `data-livev2-key`: texto en sitio y sin recrear nodos. */
function updateLiveV2Feed(root) {
  const feedEl = (root || document).querySelector('#livev2-feed');
  if (!feedEl) return;
  const body = feedEl.querySelector('.livev2-ticker-body');
  if (!body) { feedEl.innerHTML = liveV2FeedHtml(); return; }

  const items = liveV2FeedItems();
  const desired = new Set(items.map(i => i.key));
  const existing = new Map();
  body.querySelectorAll('[data-livev2-key]').forEach(el => {
    existing.set(el.getAttribute('data-livev2-key'), el);
  });
  for (const [key, el] of existing) {
    if (!desired.has(key)) { el.remove(); existing.delete(key); }
  }

  if (!items.length) {
    if (!body.querySelector('.livev2-ticker-empty')) {
      const empty = document.createElement('span');
      empty.className = 'livev2-ticker-empty';
      empty.textContent = 'Aún no hay eventos.';
      body.appendChild(empty);
    }
    return;
  }
  body.querySelectorAll('.livev2-ticker-empty').forEach(el => el.remove());

  for (const item of items) {
    let el = existing.get(item.key);
    if (!el) {
      el = document.createElement('span');
      el.className = 'livev2-ticker-item';
      el.setAttribute('data-livev2-key', item.key);
      body.appendChild(el);
      existing.set(item.key, el);
    }
    const text = `${item.icon} ${item.text}`;
    if (el.textContent !== text) el.textContent = text;
  }

  let prev = null;
  for (const item of items) {
    const el = existing.get(item.key);
    if (!el) continue;
    if (prev) {
      if (prev.nextElementSibling !== el) body.insertBefore(el, prev.nextElementSibling);
    } else if (body.firstElementChild !== el) {
      body.insertBefore(el, body.firstElementChild);
    }
    prev = el;
  }
}

function liveV2StatusBadge(st) {
  st = st || liveV2State();
  const age = st.lastFetchAt ? Math.max(0, Math.floor((Date.now() - st.lastFetchAt) / 1000)) : null;
  const title = age != null ? `Actualizado hace ${age}s` : 'Sin actualizar';
  if (st.error) return { text: '⚠️ Sin conexión', cls: 'error', title };
  if (age != null && age > 90) return { text: `⏸ Datos de hace ${age}s`, cls: 'stale', title };
  return { text: '● EN DIRECTO', cls: 'live', title };
}

/** Estado puro tras un poll: éxito fija la hora y limpia error; fallo conserva la última hora. */
function liveV2NextPollState(st, ok, now) {
  return {
    lastFetchAt: ok ? now : (st ? st.lastFetchAt : null),
    error: ok ? null : true,
  };
}

/** Repinta solo el badge y el estado del botón de reintento (sin tocar filas/chips). */
function updateLiveV2Badge(root) {
  const scope = root || document;
  const badgeEl = scope.querySelector('.livev2-badge');
  if (!badgeEl) return;
  const badge = liveV2StatusBadge();
  badgeEl.textContent = badge.text;
  badgeEl.className = `livev2-badge ${badge.cls}`;
  badgeEl.setAttribute('title', badge.title);
  updateLiveV2RetryState(scope);
}

function updateLiveV2RetryState(root) {
  const btn = (root || document).querySelector('#livev2-retry');
  if (!btn) return;
  const busy = !!liveV2State().polling;
  btn.disabled = busy;
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
  btn.textContent = busy ? '↻ Reintentando…' : '↻ Reintentar';
}

/** Reintento manual: fuerza un full y repinta el subtab Live sin recargar la página. */
async function retryLiveV2() {
  const st = liveV2State();
  if (st.polling) { updateLiveV2RetryState(); return; }
  const root = document.querySelector('.resultados-scroll .livev2') || document.querySelector('.livev2');
  if (!root) return;
  st.polling = true;
  _liveV2CountdownStart = Date.now();
  _liveV2CountdownPaused = false;
  liveV2UpdateCountdown();
  updateLiveV2RetryState(root);
  let target = root;
  try {
    st._needFull = true;
    const html = await renderLiveV2Tab();
    const scroll = root.parentElement;
    target = scroll && scroll.classList.contains('resultados-scroll') ? scroll : root;
    target.innerHTML = html;
    liveV2ScheduleChipGlowTimers(target);
    bindLiveV2SoundToggle(target);
    bindLiveV2Fullscreen(target);
  } finally {
    st.polling = false;
    updateLiveV2Badge(target);
  }
}

/** HTML de layout A (sin el header de subtabs, que lo pone renderResultadosTab) */
function renderLiveV2Html(rows, folded) {
  const me = rows.find(r => r.isMe);
  const chips = liveV2ChipsHtml(folded);
  const status = liveV2StatusBadge();
  const ptsDelta = me ? (me.pointsDelta || 0) : 0;
  return `<div class="livev2">`
    + `<div class="livev2-fixed">`
    + `<div class="livev2-status">`
    + `<span class="livev2-badge ${status.cls}" title="${liveV2Esc(status.title)}">${status.text}</span>`
    + `<button type="button" id="livev2-retry" class="livev2-retry" aria-label="Reintentar conexión">↻ Reintentar</button>`
    + `<div class="livev2-status-right">`
    + liveV2CountdownHtml()
    + `<span class="livev2-points-inline" id="livev2-points-inline">⚡ <b>${me ? me.livePoints : 0}</b>`
    + `<span class="livev2-points-delta ${ptsDelta < 0 ? 'down' : 'up'}">${liveV2DeltaText(ptsDelta)}</span></span>`
    + liveV2FsToggleHtml()
    + liveV2SoundToggleHtml()
    + `</div>`
    + `</div>`
    + `<div class="livev2-grid" id="livev2-chips-host">`
    + (chips || `<div class="livev2-empty">Sin partidos en directo ahora mismo</div>`)
    + `</div>`
    + `<div id="livev2-feed" class="livev2-feed" aria-live="polite">${liveV2FeedHtml()}</div>`
    + `</div>`
    + `<div class="livev2-body">`
    + `<div class="livev2-section-title">Clasificación en vivo</div>`
    + `<div class="livev2-rows" id="livev2-rows" aria-live="polite">${rows.map(liveV2RowHtml).join('')}</div>`
    + `</div>`
    + `</div>`;
}

// ── Animación "elevar 3D" + motivo (Task 7) ─────────────────────────────

const LIVEV2_FLIGHT_MS = 700;
const LIVEV2_REASON_MS = 2500;
const LIVEV2_REASON_TYPES = {
  goal: 1, goal_cancelled: 1, penalty_saved: 1, assist: 1, rating: 1,
  score: 1, match_final: 1, substitution: 1,
};
let _liveV2SettleTimer = null;

/** Snapshot ligero de filas (rank + puntos) para comparar en el siguiente update */
function liveV2Snapshot(rows) {
  return rows.map(r => ({ name: r.name, rank: r.rank, livePoints: r.livePoints }));
}

function liveV2PrefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { return false; }
}

/** Count-up de un número de puntos de `from` a `to` */
function liveV2CountUp(el, from, to, duration) {
  if (!el || from === to) { if (el) el.textContent = to; return; }
  if (typeof requestAnimationFrame !== 'function') { el.textContent = to; return; }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const t0 = now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (k < 1) requestAnimationFrame(tick); else el.textContent = to;
  };
  requestAnimationFrame(tick);
}

/** playerId relevante de un evento (playerId o payload.scorerId/keeperId) */
function liveV2EventPlayerId(ev) {
  if (!ev) return null;
  const p = ev.payload || {};
  const id = ev.playerId != null ? ev.playerId : (p.scorerId != null ? p.scorerId : (p.keeperId != null ? p.keeperId : null));
  return id != null ? String(id) : null;
}

/** Usuarios cuya plantilla incluye al jugador del evento (mapeo evento→fila por plantilla) */
function liveV2UsersAffectedBy(ev) {
  const pid = liveV2EventPlayerId(ev);
  if (!pid) return [];
  const out = [];
  for (const [user, squad] of Object.entries(AppState.squadsCache || {})) {
    if (Array.isArray(squad) && squad.some(sp => String(sp.id) === pid)) out.push(user);
  }
  return out;
}

/** Eventos con delta != 0 ordenados por impacto absoluto y limitados a `limit`. */
function liveV2TopContributions(list, limit = 3) {
  return [...(list || [])].filter(x => x.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}

/** Línea de motivo de un evento con su delta; null si el evento no tiene etiqueta. */
function liveV2ReasonLine(ev, delta) {
  const label = liveV2Api.liveV2ReasonForEvent
    ? liveV2Api.liveV2ReasonForEvent(ev, liveV2PlayersById(), delta)
    : liveV2Api.reasonLabel(ev, { delta });
  return label ? { icon: label.icon, text: label.text, delta } : null;
}

/** HTML del cartel de motivo: líneas, "+N más" y total. */
function liveV2ReasonHtml(reason) {
  const lines = (reason.lines || []).map(l =>
    `<div class="livev2-reason-line">${l.icon} ${liveV2Esc(l.text)} <b>${liveV2DeltaText(l.delta)}</b></div>`
  ).join('');
  const more = reason.more ? `<div class="livev2-reason-more">+${reason.more} más</div>` : '';
  const total = `<div class="livev2-reason-total">Total <b>${liveV2DeltaText(reason.total)}</b></div>`;
  return lines + more + total;
}

/**
 * Elige la fila "protagonista" y su motivo a partir de las filas que cambiaron
 * (puesto y/o puntos) y de los eventos nuevos del último poll.
 * Mapeo: evento→usuario por plantilla (squadsCache); si no hay datos de plantilla
 * se cae al evento relevante más reciente. Prioriza siempre la fila propia.
 * Devuelve `{ name, rankDelta, pointsDelta, lines, total, more }` o `null`.
 */
function liveV2MoverReason(rows, prevByName, newEvents) {
  if (typeof liveV2Api === 'undefined') return null;
  const finalized = new Set((AppState.matchStats || []).map(ms => String(ms.eventId)));
  const freshEvents = (newEvents || []).filter(ev => ev && !finalized.has(String(ev.eventId)));
  const relevant = freshEvents.filter(e => LIVEV2_REASON_TYPES[e.type]);
  const changed = [];
  for (const r of rows) {
    const p = prevByName ? prevByName[r.name] : null;
    const rankDelta = p ? p.rank - r.rank : 0;
    const pointsDelta = p ? r.livePoints - p.livePoints : 0;
    if (rankDelta !== 0 || pointsDelta !== 0) changed.push({ name: r.name, rankDelta, pointsDelta });
  }
  if (!changed.length) return null;

  const evByUser = {};
  for (const ev of relevant) {
    for (const u of liveV2UsersAffectedBy(ev)) {
      const cur = evByUser[u];
      if (!cur || new Date(ev.ts).getTime() >= new Date(cur.ts).getTime()) evByUser[u] = ev;
    }
  }
  const score = (c) => {
    let s = Math.abs(c.pointsDelta) * 10 + Math.abs(c.rankDelta) * 3;
    if (evByUser[c.name]) s += 300;
    if (rows.some(r => r.name === c.name && r.isMe)) s += 1000;
    return s;
  };
  changed.sort((a, b) => score(b) - score(a));
  const pick = changed[0];
  // El evento fallback se elige por ts máximo (no por orden del array: fetchLiveEvents
  // añade los eventos en el orden crudo de la API, no necesariamente cronológico).
  const newestRelevant = relevant.length
    ? relevant.reduce((a, b) => (new Date(a.ts).getTime() >= new Date(b.ts).getTime() ? a : b))
    : null;

  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const serverNow = liveV2PlayheadMs(st);
  const byMatch = {};
  for (const ev of freshEvents) (byMatch[String(ev.eventId)] = byMatch[String(ev.eventId)] || []).push(ev);
  const contributions = [];
  if (typeof calculateMatchPoints === 'function' && typeof calculatePlayerMatchPoints === 'function') {
    for (const [id, events] of Object.entries(byMatch)) {
      if (finalized.has(id)) continue;
      const res = liveV2EventDeltas(pick.name, id, events, st.events, ctxById[id] || {}, playersById, serverNow);
      for (const d of res.events) contributions.push(d);
    }
  }
  if (contributions.length) {
    const labeled = contributions
      .map(d => ({ ...d, line: liveV2ReasonLine(d.event, d.delta) }))
      .filter(x => x.line);
    if (labeled.length) {
      const top = liveV2TopContributions(labeled, 3);
      const lines = top.map(x => x.line);
      const more = Math.max(0, labeled.length - top.length);
      return { name: pick.name, rankDelta: pick.rankDelta, pointsDelta: pick.pointsDelta,
        lines, total: pick.pointsDelta, more };
    }
  }

  const ev = evByUser[pick.name] || newestRelevant;
  if (!ev) return null;
  // Solo se puede atribuir el delta del poll a un evento cuando es el único del
  // poll. Otros tipos (match_final, score, substitution, roja...) también mueven
  // puntos/minutos; con varios eventos no se reparte el total (sería inventado).
  const attributableDelta = freshEvents.length === 1 ? pick.pointsDelta : 0;
  const label = liveV2Api.liveV2ReasonForEvent
    ? liveV2Api.liveV2ReasonForEvent(ev, liveV2PlayersById(), attributableDelta)
    : liveV2Api.reasonLabel(ev, { delta: attributableDelta });
  if (!label) return null;
  return { name: pick.name, rankDelta: pick.rankDelta, pointsDelta: attributableDelta,
    lines: [label], total: attributableDelta, more: 0 };
}

/** Etiqueta flotante del motivo sobre la fila indicada; se retira tras ~2.5 s */
function liveV2ShowReason(container, rowEl, reason) {
  if (!container || !rowEl || !reason) return;
  container.querySelectorAll('.livev2-reason').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'livev2-reason' + (reason.total < 0 ? ' neg' : '');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = liveV2ReasonHtml(reason);
  // Se coloca DEBAJO de la fila para no quedar oculto por la cabecera fija (.livev2-fixed, z-index 20)
  el.style.top = (rowEl.offsetTop + rowEl.offsetHeight + 4) + 'px';
  container.appendChild(el);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => el.classList.add('show'));
  else el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 320);
  }, LIVEV2_REASON_MS);
}

/** FLIP + lift/dim/destello para una actualización con cambios. `mover` = motivo elegido */
function liveV2AnimateReorder(container, firstRects, rows, prevByName, mover) {
  if (typeof liveV2Api === 'undefined') return;
  const elByName = {};
  const lastRects = {};
  container.querySelectorAll('[data-livev2-row]').forEach(el => {
    const name = el.getAttribute('data-livev2-row');
    elByName[name] = el;
    lastRects[name] = el.getBoundingClientRect();
  });
  const deltas = liveV2Api.flipDelta(firstRects, lastRects);

  const changed = [];
  let liftName = null, liftScore = 0;
  for (const r of rows) {
    const p = prevByName ? prevByName[r.name] : null;
    const rankDelta = p ? p.rank - r.rank : 0;
    const pointsDelta = p ? r.livePoints - p.livePoints : 0;
    if (rankDelta !== 0 || pointsDelta !== 0) changed.push({ name: r.name, rankDelta, pointsDelta });
    if (rankDelta > liftScore) { liftScore = rankDelta; liftName = r.name; }
  }
  if (!changed.length) return;

  const spotlight = (mover && mover.name) || liftName;

  // Cancela el settle de una animación anterior: evita que un closure viejo retire
  // clases/transform de esta nueva animación.
  if (_liveV2SettleTimer) { clearTimeout(_liveV2SettleTimer); _liveV2SettleTimer = null; }

  // FIRST→invert: colocar cada fila movida en su posición previa, sin transición
  const flying = [];
  for (const name of Object.keys(lastRects)) {
    const el = elByName[name];
    const inner = el && el.querySelector('.livev2-inner');
    if (!inner) continue;
    const dy = deltas[name] || 0;
    if (dy) {
      inner.style.transition = 'none';
      inner.style.transform = `translateY(${dy}px)`;
      flying.push({ inner });
    }
  }
  void container.offsetHeight; // forzar reflow

  // clases de estado: dim al contenedor, mv a la protagonista, lift a la que sube, fu/fd destello
  container.classList.add('dim');
  for (const c of changed) {
    const el = elByName[c.name];
    const inner = el && el.querySelector('.livev2-inner');
    if (!inner) continue;
    // `.mv` exime de `.dim`: tanto la protagonista como la fila que se eleva (.lift)
    if (c.name === spotlight || c.name === liftName) el.classList.add('mv');
    if (c.name === liftName) inner.classList.add('lift');
    if (c.rankDelta > 0 || (c.rankDelta === 0 && c.pointsDelta > 0)) inner.classList.add('fu');
    else if (c.rankDelta < 0 || (c.rankDelta === 0 && c.pointsDelta < 0)) inner.classList.add('fd');
  }

  // LAST→play: animar a destino con la curva de vuelo
  const flight = `transform ${LIVEV2_FLIGHT_MS}ms cubic-bezier(.22,1,.36,1), box-shadow .3s, opacity .3s, background .3s`;
  for (const f of flying) {
    f.inner.style.transition = flight;
    f.inner.style.transform = '';
  }

  // settle: retirar clases y estilos inline
  _liveV2SettleTimer = setTimeout(() => {
    _liveV2SettleTimer = null;
    container.classList.remove('dim');
    for (const c of changed) {
      const el = elByName[c.name];
      if (!el) continue;
      el.classList.remove('mv');
      const inner = el.querySelector('.livev2-inner');
      if (inner) {
        inner.style.transition = '';
        inner.style.transform = '';
        inner.classList.remove('lift', 'fu', 'fd');
      }
    }
    container.querySelectorAll('.livev2-reason').forEach(el => {
      if (!el.classList.contains('show')) el.remove();
    });
  }, LIVEV2_FLIGHT_MS + 60);
}

/** Actualización incremental del DOM keyed por usuario (sin re-render completo) */
function updateLiveV2Dom(rows, folded) {
  const root = document.querySelector('.resultados-scroll .livev2') || document.querySelector('.livev2');
  const container = document.getElementById('livev2-rows');
  if (!root || !container) return;

  const st = liveV2State();
  const prevByName = {};
  for (const r of (st._lastRows || [])) prevByName[r.name] = r;

  // Detectar cambios de marcador (glow + salto al frente) antes de reconstruir chips
  liveV2DetectChipChanges(folded);

  // Eventos aparecidos desde el último render (para la etiqueta de motivo)
  if (!(st._seenEventIds instanceof Set)) st._seenEventIds = new Set();
  const newEvents = [];
  for (const e of (st.events || [])) {
    const key = liveV2Api.eventKey(e);
    if (!st._seenEventIds.has(key)) {
      newEvents.push(e);
      st._seenEventIds.add(key);
    }
  }

  // Sonido: eventos nuevos (gol/estado) y cambio de MI puesto vs el poll anterior.
  liveV2PlayNewEventSounds(newEvents);
  const meRowNow = rows.find(r => r.isMe);
  liveV2PlayRankSound(meRowNow, meRowNow ? prevByName[meRowNow.name] : null);

  const reduced = liveV2PrefersReducedMotion();

  // FIRST: medir posiciones previas de cada fila (solo si vamos a animar)
  const firstRects = {};
  if (!reduced) {
    container.querySelectorAll('[data-livev2-row]').forEach(el => {
      firstRects[el.getAttribute('data-livev2-row')] = el.getBoundingClientRect();
    });
  }

  const existing = new Map();
  container.querySelectorAll('[data-livev2-row]').forEach(el => existing.set(el.getAttribute('data-livev2-row'), el));
  const present = new Set(rows.map(r => r.name));
  const countUps = [];
  let prev = null;
  for (const r of rows) {
    let el = existing.get(r.name);
    if (!el) {
      const tmp = document.createElement('div');
      tmp.innerHTML = liveV2RowHtml(r).trim();
      el = tmp.firstElementChild;
    } else {
      el.querySelector('.livev2-rank').textContent = r.rank;
      const ptsEl = el.querySelector('.livev2-pts');
      const prevPts = prevByName[r.name] ? prevByName[r.name].livePoints : null;
      if (!reduced && prevPts != null && prevPts !== r.livePoints) {
        ptsEl.textContent = prevPts;
        countUps.push({ el: ptsEl, from: prevPts, to: r.livePoints });
      } else {
        ptsEl.textContent = r.livePoints;
      }
      const d = r.delta || 0;
      const arrow = el.querySelector('.livev2-arrow');
      arrow.textContent = d > 0 ? `▲${d}` : d < 0 ? `▼${Math.abs(d)}` : '';
      arrow.className = `livev2-arrow ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`;
      el.classList.toggle('me', !!r.isMe);
    }
    if (prev) {
      if (prev.nextElementSibling !== el) container.insertBefore(el, prev.nextElementSibling);
    } else if (container.firstElementChild !== el) {
      container.insertBefore(el, container.firstElementChild);
    }
    prev = el;
  }
  for (const [name, el] of existing) { if (!present.has(name)) el.remove(); }

  const me = rows.find(r => r.isMe);
  const pointsInline = root.querySelector('#livev2-points-inline');
  if (pointsInline && me) {
    const pd = me.pointsDelta || 0;
    pointsInline.innerHTML = `⚡ <b>${me.livePoints}</b>`
      + `<span class="livev2-points-delta ${pd < 0 ? 'down' : 'up'}">${liveV2DeltaText(pd)}</span>`;
  }

  // Celdas y feed: parche por clave (solo se crean/eliminan nodos al cambiar el conjunto)
  updateLiveV2Chips(root, folded);
  updateLiveV2Feed(root);
  updateLiveV2Badge(root);
  updateLiveV2SoundToggle(root);

  // Motivo del cambio (fila protagonista) + animación "elevar 3D"
  const mover = liveV2MoverReason(rows, prevByName, newEvents);
  if (!reduced && Object.keys(firstRects).length) {
    liveV2AnimateReorder(container, firstRects, rows, prevByName, mover);
  }
  for (const c of countUps) liveV2CountUp(c.el, c.from, c.to, LIVEV2_FLIGHT_MS);
  if (mover) {
    let rowEl = null;
    container.querySelectorAll('[data-livev2-row]').forEach(el => {
      if (el.getAttribute('data-livev2-row') === mover.name) rowEl = el;
    });
    liveV2ShowReason(container, rowEl, mover);
  }

  st._lastRows = liveV2Snapshot(rows);
}

// Fuera de la ventana de un partido no se pide nada al servidor. Dentro de la
// ventana se sigue sondeando aunque aún no haya eventos LIVE (arranque del scraper).
const LIVEV2_KICKOFF_WINDOW_MS = 3.5 * 60 * 60 * 1000;

/** true si hay que sondear: full pendiente, partido en juego o kickoff en ventana. */
function liveV2ShouldPoll(folded, now) {
  if (liveV2State()._needFull) return true;
  if (liveV2HasInPlay(folded)) return true;
  const at = now == null ? Date.now() : now;
  const interval = (AppState.liveRefreshSecs || 30) * 1000;
  return (AppState.matches || []).some(m => {
    if (!isFinite(m.fechaTs)) return false;
    const state = folded && folded.states ? folded.states[String(m.id)] : null;
    if (state && state.status === 'FT') return false;
    const kickoff = m.fechaTs * 1000;
    return kickoff <= at + interval && kickoff >= at - LIVEV2_KICKOFF_WINDOW_MS;
  });
}

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

const LIVEV2_COUNTDOWN_RADIUS = 8;

function liveV2CountdownHtml() {
  const r = LIVEV2_COUNTDOWN_RADIUS;
  const c = 2 * Math.PI * r;
  return `<span class="livev2-countdown" id="livev2-countdown" role="status" aria-live="off" aria-label="Próxima actualización">`
    + `<svg viewBox="0 0 20 20" aria-hidden="true">`
    + `<circle class="livev2-countdown-track" cx="10" cy="10" r="${r}"></circle>`
    + `<circle class="livev2-countdown-progress" cx="10" cy="10" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"></circle>`
    + `</svg><span class="livev2-countdown-num">—</span></span>`;
}

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
  if (prog) prog.style.strokeDashoffset = String(2 * Math.PI * LIVEV2_COUNTDOWN_RADIUS * (1 - state.progress));
  el.classList.toggle('paused', state.paused);
  el.classList.toggle('polling', state.polling);
  el.setAttribute('aria-label', state.paused
    ? 'Actualización en pausa'
    : `Próxima actualización en ${state.seconds} segundos`);
}

let _liveV2PollTimer = null;
let _liveV2VisHandler = null;

function stopLiveV2Polling() {
  if (_liveV2PollTimer) { clearInterval(_liveV2PollTimer); _liveV2PollTimer = null; }
  if (_liveV2CountdownTimer) { clearInterval(_liveV2CountdownTimer); _liveV2CountdownTimer = null; }
  if (_liveV2VisHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', _liveV2VisHandler);
    _liveV2VisHandler = null;
  }
}

function startLiveV2Polling(folded) {
  stopLiveV2Polling();
  const total = AppState.liveRefreshSecs || 30;
  const snap = folded || liveV2Folded();
  _liveV2CountdownStart = Date.now();
  _liveV2CountdownPaused = !liveV2ShouldPoll(snap);
  _liveV2CountdownTimer = setInterval(liveV2UpdateCountdown, 1000);
  liveV2UpdateCountdown();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(liveV2UpdateCountdown);
  else setTimeout(liveV2UpdateCountdown, 0);
  if (typeof document !== 'undefined') {
    const onVis = () => {
      if (document.visibilityState !== 'visible') {
        _liveV2CountdownPaused = true;
        liveV2UpdateCountdown();
        return;
      }
      if (AppState.resultadosTab === 'live') {
        _liveV2CountdownStart = Date.now();
        _liveV2CountdownPaused = false;
        if (!liveV2ShouldPoll(liveV2Folded())) { // respeta la ventana de partido
          _liveV2CountdownPaused = true;
          liveV2UpdateCountdown();
          return;
        }
        liveV2UpdateCountdown();
        liveV2State()._needFull = true; // al volver a visible se resincroniza con un full
        pollLiveV2();
      }
    };
    _liveV2VisHandler = onVis;
    document.addEventListener('visibilitychange', onVis);
  }
  _liveV2PollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      _liveV2CountdownPaused = true;
      liveV2UpdateCountdown();
      return;
    }
    if (AppState.resultadosTab !== 'live') { stopLiveV2Polling(); return; }
    if (!liveV2ShouldPoll(liveV2Folded())) { // sin partidos en juego, no poll
      _liveV2CountdownPaused = true;
      liveV2UpdateCountdown();
      return;
    }
    _liveV2CountdownStart = Date.now();
    _liveV2CountdownPaused = false;
    pollLiveV2();
  }, total * 1000);
}

/** Poll en segundo plano: delta de eventos + render incremental (no recarga la página) */
async function pollLiveV2() {
  const st = liveV2State();
  if (st.polling || AppState.resultadosTab !== 'live') return;
  st.polling = true;
  _liveV2CountdownStart = Date.now();
  _liveV2CountdownPaused = false;
  liveV2UpdateCountdown();
  updateLiveV2RetryState();
  try {
    const prevRanks = {};
    for (const r of (st._lastRows || [])) prevRanks[r.name] = r.rank;
    st.prevRanks = prevRanks;
    const forceFull = !st.serverTime || !st.events.length || !!st._needFull
      || (Date.now() - (st._fullAt || 0) > 10 * 60 * 1000);
    await fetchLiveEvents(forceFull);
    // Estado antes del render: el badge debe reflejar ya este poll, no el anterior.
    Object.assign(st, liveV2NextPollState(st, true, Date.now()));
    const folded = liveV2Folded();
    const rows = liveV2Rows(folded);
    updateLiveV2Dom(rows, folded); // actualiza st._lastRows tras comparar/anima
  } catch (e) {
    Object.assign(st, liveV2NextPollState(st, false));
    updateLiveV2Badge(); // error visible de inmediato (y botón de reintento)
  } finally {
    st.polling = false;
    liveV2UpdateCountdown();
    updateLiveV2RetryState();
  }
}

/** Render del subtab Live v2 (fetch + fold + poll). Devuelve el HTML de layout A. */
async function renderLiveV2Tab() {
  stopLiveV2Polling();
  const st = liveV2State();
  // Con eventos y cursor en memoria (visita anterior o caché de sesión) se entra
  // con delta: el full solo se fuerza en resync/retry, nunca por entrar a Live.
  const forceFull = !st.serverTime || !st.events.length || !!st._needFull;
  try {
    await fetchLiveEvents(forceFull);
    st.error = null;
  } catch (e) { st.error = true; /* sin eventos disponibles */ }
  const folded = liveV2Folded();
  liveV2DetectChipChanges(folded);
  st.prevRanks = null;
  const rows = liveV2Rows(folded);
  st._lastRows = liveV2Snapshot(rows);
  st._seenEventIds = new Set((st.events || []).map(e => liveV2Api.eventKey(e)));
  if (AppState.resultadosTab === 'live') startLiveV2Polling(folded);
  return renderLiveV2Html(rows, folded);
}

  const api = {
    init,
    renderLiveV2Html,
    updateLiveV2Dom,
    renderLiveV2Tab,
    pollLiveV2,
    startLiveV2Polling,
    stopLiveV2Polling,
    bindLiveV2SoundToggle,
    bindLiveV2Fullscreen,
    enterLiveV2Fullscreen,
    exitLiveV2Fullscreen,
    liveV2SkeletonHtml,
    liveV2ShowReason,
    liveV2State,
    liveV2ChipLabel,
    liveV2HasInPlay,
    liveV2ShouldPoll,
    liveV2FeedHtml,
    liveV2FeedItems,
    updateLiveV2Chips,
    updateLiveV2Feed,
    liveV2MoverReason,
    liveV2StatusBadge,
    liveV2NextPollState,
    fetchLiveEvents,
    retryLiveV2,
    liveV2ScheduleChipGlowTimers,
    unlockLiveAudio,
    liveV2CacheKey,
    liveV2CacheDay,
    liveV2CacheIsFresh,
    purgeLiveV2Caches,
    liveV2EventDeltas,
    liveV2SoundQuality,
    liveV2PlayNewEventSounds,
    liveV2TopContributions,
    liveV2ReasonLine,
    liveV2ReasonHtml,
    liveV2CountdownState,
    liveV2CountdownHtml,
  };

  global.liveV2Ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
