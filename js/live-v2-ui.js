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

function bindLiveV2SoundToggle(root) {
  const scope = root || document;
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
  document.body.classList.add('live-fs');
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* sin API */ }
  updateLiveV2FsToggle();
}

function exitLiveV2Fullscreen() {
  document.body.classList.remove('live-fs');
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* sin API */ }
  updateLiveV2FsToggle();
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
      updateLiveV2FsToggle();
      if (!document.fullscreenElement) document.body.classList.remove('live-fs');
    });
  }
}

/** deps de soundApi.playLiveEvent, o null si el sonido está desactivado. */
function liveV2SoundDeps() {
  if (typeof soundApi === 'undefined' || !soundApi.playLiveEvent || !soundApi.loadSoundEnabled) return null;
  let enabled = true;
  try { enabled = soundApi.loadSoundEnabled(localStorage); } catch (e) { enabled = true; }
  if (!enabled) return null;
  return { enabled, ctx: _liveAudioCtx, navigatorRef: (typeof navigator !== 'undefined' ? navigator : null) };
}

/** Traduce un evento live a la forma que entiende soundApi.eventToTone (o null si no suena). */
function liveV2ToneEventFor(ev) {
  if (!ev) return null;
  if (ev.type === 'goal') return { type: 'goal' };
  if (ev.type === 'status') {
    const status = ev.payload && ev.payload.status;
    return status === 'FT' ? { type: 'end' } : { type: 'status' };
  }
  return null;
}

/** true si el goleador pertenece a mi plantilla (AppState.squadsCache[yo]). */
function liveV2GoalIsMine(ev) {
  const me = AppState.currentUser && AppState.currentUser.name;
  if (!me) return false;
  const squad = (AppState.squadsCache || {})[me];
  if (!Array.isArray(squad) || !squad.length) return false;
  const p = (ev && ev.payload) || {};
  const id = p.scorerId != null ? p.scorerId : (p.playerId != null ? p.playerId : ev.playerId);
  if (id == null) return false;
  return squad.some(sp => String(sp.id) === String(id));
}

/** Suena cada evento nuevo con tono (solo si el sonido está activo). */
function liveV2PlayNewEventSounds(newEvents) {
  const deps = liveV2SoundDeps();
  if (!deps) return;
  for (const ev of newEvents || []) {
    const tone = liveV2ToneEventFor(ev);
    if (!tone) continue;
    const isMine = tone.type === 'goal' ? liveV2GoalIsMine(ev) : false;
    soundApi.playLiveEvent(tone, isMine, deps);
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
  const m = (AppState.matches || []).find(x => x.id === lm.eventId);
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

function liveV2State() {
  if (!AppState.liveV2) {
    AppState.liveV2 = {
      events: [], serverTime: null, prevRanks: null, polling: false, _lastRows: [], _seenEventIds: null,
      _fullAt: 0, lastFetchAt: null, error: null,
      _chipChanged: {}, // eventId -> ts del último cambio de marcador (para glow + orden)
      _chipScores: {},  // eventId -> "home-away" del poll anterior (detección de cambios)
    };
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

/** Carga inicial (forceFull) o delta (?since=serverTime); dedup por eventId|sourceId */
async function fetchLiveEvents(forceFull) {
  const st = liveV2State();
  const url = API_BASE + '/api/live/events' + (!forceFull && st.serverTime ? `?since=${encodeURIComponent(st.serverTime)}` : '');
  const res = await fetchWithPhase(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const payload = await res.json();
  if (!payload || !payload.ok) return;
  const keyOf = e => liveV2Api.eventKey(e);
  const incoming = payload.events || [];
  if (forceFull) {
    // Un full es autoritativo: reemplaza eventos y resetea el estado derivado.
    st.events = incoming;
    st._seenEventIds = new Set(incoming.map(keyOf));
    st._chipChanged = {};
    st._chipScores = {};
  } else {
    const seen = new Set(st.events.map(keyOf));
    for (const e of incoming) {
      const k = keyOf(e);
      if (!seen.has(k)) { st.events.push(e); seen.add(k); }
    }
  }
  st.serverTime = payload.serverTime || st.serverTime;
  st.lastFetchAt = Date.now();
  if (payload.resync) st._fullAt = 0;
}

/** Pliega todos los eventos (presente) → { states, statsById } */
function liveV2Folded() {
  if (typeof liveV2Api === 'undefined') return { states: {}, statsById: {} };
  const st = liveV2State();
  const ctxById = liveV2CtxById();
  const playersById = liveV2PlayersById();
  const states = liveV2Api.foldAll(st.events, ctxById);
  const statsById = {};
  const playhead = st.serverTime ? new Date(st.serverTime).getTime() : null;
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

/** Etiqueta de estado del chip: NS, LIVE 63', HT o FT (fallback `·` si no hay minuto). */
function liveV2ChipLabel(state) {
  if (!state) return 'NS';
  if (state.status === 'NS') return 'NS';
  if (state.status === 'HT') return 'HT';
  if (state.status === 'FT') return 'FT';
  const m = state.lastMinute != null ? state.lastMinute : '·';
  return `LIVE ${m}'`;
}

function liveV2ChipHtml(eventId, state) {
  // foldAll usa claves string (ids de partido); normaliza a match.id (number) para liveMatchMeta
  const match = (AppState.matches || []).find(m => String(m.id) === String(eventId));
  const meta = liveMatchMeta({ eventId: match ? match.id : eventId });
  const score = state && state.score ? `${state.score.home}-${state.score.away}` : '–';
  const live = !!(state && (state.status === 'LIVE' || state.status === 'HT'));
  const ft = !!(state && state.status === 'FT');
  const changed = liveV2ChipIsRecentChange(eventId);
  const cls = `livev2-cell${live ? ' live' : ''}${ft ? ' ft' : ''}${changed ? ' changed' : ''}`;
  const label = liveV2ChipLabel(state);
  const chipCls = ((state && state.status) || 'NS').toLowerCase();
  const fullTitle = `${meta.homeTeam} ${score} ${meta.awayTeam} · ${label}`;
  const hb = meta.homeTeamId != null
    ? `<img class="livev2-cell-badge" src="data/imgEquipos/${meta.homeTeamId}.${meta.homeBadgeExt || 'webp'}" alt="" loading="lazy" onerror="this.onerror=null;this.src='data/imgEquipos/default.webp'">`
    : '';
  const ub = meta.awayTeamId != null
    ? `<img class="livev2-cell-badge" src="data/imgEquipos/${meta.awayTeamId}.${meta.awayBadgeExt || 'webp'}" alt="" loading="lazy" onerror="this.onerror=null;this.src='data/imgEquipos/default.webp'">`
    : '';
  return `<div class="${cls}" data-livev2-chip="${liveV2Esc(eventId)}" title="${liveV2Esc(fullTitle)}" aria-label="${liveV2Esc(fullTitle)}">`
    + hb
    + `<span class="livev2-cell-team">${liveV2Esc(liveV2Abbr(meta.homeTeam))}</span>`
    + `<span class="livev2-cell-score">${score}</span>`
    + `<span class="livev2-chip-state ${chipCls}">${liveV2Esc(label)}</span>`
    + `<span class="livev2-cell-team">${liveV2Esc(liveV2Abbr(meta.awayTeam))}</span>`
    + ub
    + `</div>`;
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

/** Ticker compacto (1–2 líneas) con los eventos más recientes del presente. */
function liveV2FeedHtml() {
  const st = liveV2State();
  const playersById = liveV2PlayersById();
  const events = (st.events || [])
    .filter(e => isFinite(new Date(e.ts).getTime()))
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .slice(-2)
    .reverse();
  const items = events.map(e => {
    const l = (typeof liveV2Api !== 'undefined' && liveV2Api.feedLabel) ? liveV2Api.feedLabel(e, playersById) : null;
    if (!l) return '';
    return `<span class="livev2-ticker-item">${l.icon} ${liveV2Esc(l.text)}</span>`;
  }).filter(Boolean).join('');
  return `<div class="livev2-ticker-head">📣 Últimos eventos</div>`
    + `<div class="livev2-ticker-body">${items || `<span class="livev2-ticker-empty">Aún no hay eventos.</span>`}</div>`;
}

function liveV2StatusBadge() {
  return { text: '● EN DIRECTO', cls: 'live' };
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
    + `<span class="livev2-badge ${status.cls}">${status.text}</span>`
    + `<div class="livev2-status-right">`
    + `<span class="livev2-points-inline" id="livev2-points-inline">⚡ <b>${me ? me.livePoints : 0}</b>`
    + `<span class="livev2-points-delta ${ptsDelta < 0 ? 'down' : 'up'}">${liveV2DeltaText(ptsDelta)}</span></span>`
    + liveV2FsToggleHtml()
    + liveV2SoundToggleHtml()
    + `</div>`
    + `</div>`
    + `<div class="livev2-grid" id="livev2-chips-host">`
    + (chips || `<div class="livev2-empty">Sin partidos en directo ahora mismo</div>`)
    + `</div>`
    + `<div id="livev2-feed" class="livev2-feed">${liveV2FeedHtml()}</div>`
    + `</div>`
    + `<div class="livev2-body">`
    + `<div class="livev2-section-title">Clasificación en vivo</div>`
    + `<div class="livev2-rows" id="livev2-rows">${rows.map(liveV2RowHtml).join('')}</div>`
    + `</div>`
    + `</div>`;
}

// ── Animación "elevar 3D" + motivo (Task 7) ─────────────────────────────

const LIVEV2_FLIGHT_MS = 700;
const LIVEV2_REASON_MS = 2500;
const LIVEV2_REASON_TYPES = { goal: 1, goal_cancelled: 1, penalty_saved: 1, assist: 1, rating: 1 };
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

/**
 * Elige la fila "protagonista" y su motivo a partir de las filas que cambiaron
 * (puesto y/o puntos) y de los eventos nuevos del último poll.
 * Mapeo: evento→usuario por plantilla (squadsCache); si no hay datos de plantilla
 * se cae al evento relevante más reciente. Prioriza siempre la fila propia.
 * Devuelve `{ name, rankDelta, pointsDelta, label }` o `null`.
 */
function liveV2MoverReason(rows, prevByName, newEvents) {
  if (typeof liveV2Api === 'undefined') return null;
  const relevant = (newEvents || []).filter(e => e && LIVEV2_REASON_TYPES[e.type]);
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
  const ev = evByUser[pick.name] || newestRelevant;
  if (!ev) return null;
  const label = liveV2Api.liveV2ReasonForEvent
    ? liveV2Api.liveV2ReasonForEvent(ev, liveV2PlayersById(), pick.pointsDelta)
    : liveV2Api.reasonLabel(ev, { delta: pick.pointsDelta });
  if (!label) return null;
  return { name: pick.name, rankDelta: pick.rankDelta, pointsDelta: pick.pointsDelta, label };
}

/** Etiqueta flotante del motivo sobre la fila indicada; se retira tras ~2.5 s */
function liveV2ShowReason(container, rowEl, label) {
  if (!container || !rowEl || !label) return;
  container.querySelectorAll('.livev2-reason').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'livev2-reason' + (label.delta < 0 ? ' neg' : '');
  el.textContent = `${label.icon} ${label.text}` + (label.delta ? ` · ${label.delta > 0 ? '+' : ''}${label.delta} pts` : '');
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

  // Transición vacío↔en vivo: re-render completo del contenido live (chips y mensaje
  // de "sin partidos" no se pueden parchear limpiamente entre sí).
  const nowEmpty = Object.keys(folded.states || {}).length === 0;
  const wasEmpty = !root.querySelector('.livev2-cell') && !!root.querySelector('.livev2-empty');
  if (wasEmpty !== nowEmpty) {
    const scroll = root.parentElement;
    const target = scroll && scroll.classList.contains('resultados-scroll') ? scroll : root;
    target.innerHTML = renderLiveV2Html(rows, folded);
    liveV2ScheduleChipGlowTimers(target);
    bindLiveV2SoundToggle(target);
    bindLiveV2Fullscreen(target);
    st._lastRows = liveV2Snapshot(rows);
    return;
  }

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

  // Celdas: rebuild siempre desde el estado actual dentro del host estable
  const chipsHtml = liveV2ChipsHtml(folded);
  const chipHost = root.querySelector('#livev2-chips-host');
  if (chipHost) {
    chipHost.innerHTML = chipsHtml || `<div class="livev2-empty">Sin partidos en directo ahora mismo</div>`;
    liveV2ScheduleChipGlowTimers(chipHost);
  }

  // Feed de última hora (eventos más recientes del presente)
  const feedEl = root.querySelector('#livev2-feed');
  if (feedEl) feedEl.innerHTML = liveV2FeedHtml();
  const badgeEl = root.querySelector('.livev2-badge');
  if (badgeEl) {
    const badge = liveV2StatusBadge();
    badgeEl.textContent = badge.text;
    badgeEl.className = `livev2-badge ${badge.cls}`;
  }
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
    liveV2ShowReason(container, rowEl, mover.label);
  }

  st._lastRows = liveV2Snapshot(rows);
}

let _liveV2PollTimer = null;
let _liveV2VisHandler = null;

function stopLiveV2Polling() {
  if (_liveV2PollTimer) { clearInterval(_liveV2PollTimer); _liveV2PollTimer = null; }
  if (_liveV2VisHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', _liveV2VisHandler);
    _liveV2VisHandler = null;
  }
}

function startLiveV2Polling() {
  stopLiveV2Polling();
  const total = AppState.liveRefreshSecs || 30;
  if (typeof document !== 'undefined') {
    const onVis = () => {
      if (document.visibilityState === 'visible' && AppState.resultadosTab === 'live') {
        liveV2State()._fullAt = 0; // al volver a visible se resincroniza con un full
        pollLiveV2();
      }
    };
    _liveV2VisHandler = onVis;
    document.addEventListener('visibilitychange', onVis);
  }
  _liveV2PollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (AppState.resultadosTab !== 'live') { stopLiveV2Polling(); return; }
    pollLiveV2();
  }, total * 1000);
}

/** Poll en segundo plano: delta de eventos + render incremental (no recarga la página) */
async function pollLiveV2() {
  const st = liveV2State();
  if (st.polling || AppState.resultadosTab !== 'live') return;
  st.polling = true;
  try {
    const prevRanks = {};
    for (const r of (st._lastRows || [])) prevRanks[r.name] = r.rank;
    st.prevRanks = prevRanks;
    const forceFull = !st.serverTime || (Date.now() - (st._fullAt || 0) > 10 * 60 * 1000);
    await fetchLiveEvents(forceFull);
    if (forceFull) st._fullAt = Date.now();
    const folded = liveV2Folded();
    const rows = liveV2Rows(folded);
    updateLiveV2Dom(rows, folded); // actualiza st._lastRows tras comparar/anima
    st.lastFetchAt = Date.now();
    st.error = null;
  } catch (e) {
    st.error = true; // reintenta al siguiente tick
  } finally {
    st.polling = false;
  }
}

/** Render del subtab Live v2 (fetch + fold + poll). Devuelve el HTML de layout A. */
async function renderLiveV2Tab() {
  stopLiveV2Polling();
  const st = liveV2State();
  const forceFull = !st.serverTime;
  try {
    await fetchLiveEvents(forceFull);
    if (forceFull) st._fullAt = Date.now();
    st.error = null;
  } catch (e) { st.error = true; /* sin eventos disponibles */ }
  const folded = liveV2Folded();
  liveV2DetectChipChanges(folded);
  st.prevRanks = null;
  const rows = liveV2Rows(folded);
  st._lastRows = liveV2Snapshot(rows);
  st._seenEventIds = new Set((st.events || []).map(e => liveV2Api.eventKey(e)));
  if (AppState.resultadosTab === 'live') startLiveV2Polling();
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
    liveV2State,
    liveV2ChipLabel,
    liveV2ScheduleChipGlowTimers,
    unlockLiveAudio,
    exitLiveV2Fullscreen,
  };

  global.liveV2Ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
