/**
 * PORRA SPA - UEFA Champions League 2026/2027
 * Flujo completo: Codigo → Perfil → Wizard Partidos → Plantilla Ideal → App
 */

// ============================================================
// ESTADO GLOBAL
// ============================================================
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://api-porra.vercel.app';

const AppState = {
  currentUser: null,
  sessionToken: null,
  isRegisterMode: false,
  validCodes: [],
  teamsMap: {},         // { teamId: { name, image } }
  matches: [],          // partidos transformados para la app
  allPlayers: [],       // array plano de jugadores desde jugadores.json
  scorePredictions: {}, // { matchId: { home: 0, away: 0 } }
  squadPicks: [],       // array de 25 jugadores seleccionados
  selectedAvatar: '⚽',
  wizardIndex: 0,
  blockedTeams: new Set(), // ids de equipos ya seleccionados
  appConfig: null,      // configuración del torneo desde backend
  players: [],          // todos los jugadores registrados (para clasificación)
  currentRound: 1,      // ronda actual en vista de pronósticos (1-8)
  hasUnsavedChanges: false, // flag de cambios sin guardar en predicciones
  hasUnsavedSquadChanges: false, // flag de cambios sin guardar en plantilla
  activeSlot: null,     // { position: 'G', index: 0 } - casilla activa para búsqueda
  teamFilter: null,     // filtro de equipo activo en búsqueda

  savedSquadSnapshot: [], // snapshot de plantilla al guardar para comparar
  matchStats: [],       // Array de todos los matchstats del backend
  resultadosRound: null, // Ronda seleccionada en pestaña resultados
  allPredictions: {},   // { username: { matchId: { home, away } } }
  userPoints: {},       // { username: { totalPoints, matchDetails } }
  squadsCache: {},      // { username: squad[] } - caché de plantillas para resultados
  currentSquadDetails: [], // detalles de plantilla para modal de desglose
  realStandings: [],    // Clasificación real calculada desde matchStats
  classificationPoints: {}, // { username: { totalPoints, teamDetails } }
  resultadosTab: 'jornadas', // Tab seleccionado en resultados: 'jornadas' o 'clasificacion'
  finalPredictions: null, // { champion, runnerUp, semiFinalists, quarterFinalists, roundOf16, roundOf32 }
  hasUnsavedFinalChanges: false, // flag de cambios sin guardar en fase final
  selectedFinalTeam: null, // teamId seleccionado para colocar en zona
  hasTop8InRoundOf32: false, // flag: hay equipos top-8 en deciseisavos (bloquea save)
  predictionsConfirmed: false, // flag: pronósticos confirmados (bloquea edición)
};

const SQUAD_SIZE = 25;

function authHeaders() {
  const token = AppState.sessionToken || localStorage.getItem('session_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function getFaseJuego() {
  return AppState.appConfig?.faseJuego || 'FASE_PRETEMPORADA';
}

async function fetchWithPhase(url, options = {}) {
  const headers = { ...options.headers };
  if (AppState.appConfig) {
    headers['X-Client-Phase'] = getFaseJuego();
  }
  const res = await fetch(url, { ...options, headers });

  if (res.status === 409) {
    try {
      const data = await res.json();
      if (data.error === 'PHASE_CHANGED') {
        showPhaseChangeModal(data.previousPhase, data.currentPhase);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    return new Response(JSON.stringify({ ok: false, error: 'PHASE_CHANGED' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return res;
}

function showPhaseChangeModal(previousPhase, currentPhase) {
  const existing = document.querySelector('.phase-change-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'phase-change-overlay';
  overlay.innerHTML = `
    <div class="phase-change-modal">
      <div class="phase-change-icon">🔄</div>
      <h3 class="phase-change-title">Cambio de Fase</h3>
      <p class="phase-change-text">
        La fase del juego ha cambiado de<br>
        <strong>${previousPhase}</strong><br>
        a<br>
        <strong>${currentPhase}</strong>
      </p>
      <p class="phase-change-subtext">La página se recargará automáticamente...</p>
    </div>
  `;

  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });

  const modal = overlay.querySelector('.phase-change-modal');
  Object.assign(modal.style, {
    backgroundColor: '#1E293B',
    borderRadius: '16px',
    padding: '32px 24px',
    textAlign: 'center',
    maxWidth: '320px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  });

  const icon = overlay.querySelector('.phase-change-icon');
  Object.assign(icon.style, { fontSize: '48px', marginBottom: '16px' });

  const title = overlay.querySelector('.phase-change-title');
  Object.assign(title.style, { color: '#F1F5F9', fontSize: '1.3rem', marginBottom: '16px' });

  const text = overlay.querySelector('.phase-change-text');
  Object.assign(text.style, { color: '#94A3B8', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '16px' });

  const subtext = overlay.querySelector('.phase-change-subtext');
  Object.assign(subtext.style, { color: '#64748B', fontSize: '0.8rem' });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  setTimeout(() => {
    window.location.reload();
  }, 3000);
}

function isFasePretemporada() {
  return getFaseJuego() === 'FASE_PRETEMPORADA';
}

function isFaseLiga() {
  const fase = getFaseJuego();
  return fase === 'FASE_LIGA' || fase === 'FASE_PRE16';
}

function isFasePre16() {
  return getFaseJuego() === 'FASE_PRE16';
}

const SQUAD_FORMATION = {
  G: { count: 3, label: 'Porteros' },
  D: { count: 8, label: 'Defensas' },
  M: { count: 8, label: 'Centrocampistas' },
  F: { count: 6, label: 'Delanteros' }
};

// ============================================================
// ARRANQUE
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  checkAuthStatus();
  setupNavigation();
});

// ============================================================
// CARGA DE DATOS JSON
// ============================================================
async function loadInitialData() {
  try {
    const [codesRes, calendarRes, jugadoresRes, teamsRes] = await Promise.all([
      fetch('data/codes.json').catch(() => null),
      fetch('data/calendar.json').catch(() => null),
      fetch('data/jugadores.json').catch(() => null),
      fetch('data/teams.json').catch(() => null),
    ]);

    // Codigos de acceso
    AppState.validCodes = codesRes?.ok
      ? await codesRes.json()
      : [{ code: 'UCL2026', used: false }, { code: 'PORRA-CHAMPS', used: false }, { code: 'DEMO123', used: false }];

    // Equipos → Mapa de busqueda por id
    if (teamsRes?.ok) {
      const teamsArr = await teamsRes.json();
      AppState.teamsMap = {};
      teamsArr.forEach(t => {
        AppState.teamsMap[t.id] = { name: t.name, ext: t.extension || 'png' };
      });
    }

    // Calendario → transformar al formato de la app
    if (calendarRes?.ok) {
      const rawCalendar = await calendarRes.json();
      AppState.matches = rawCalendar.map(m => buildMatchFromCalendar(m));
      // Ordenar por ronda y luego por fecha
      AppState.matches.sort((a, b) => a.ronda - b.ronda || a.fechaTs - b.fechaTs);
    }

    // Jugadores
    if (jugadoresRes?.ok) {
      AppState.allPlayers = await jugadoresRes.json();
    }

    // Configuración del torneo desde backend
    try {
      const configRes = await fetchWithPhase(`${API_BASE}/api/config?t=${Date.now()}`);
      const configData = await configRes.json();
      if (configData.ok) AppState.appConfig = configData.config;
    } catch (e) {
      // config por defecto si falla
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
        }
      };
    }

    // Recuperar predicciones del backend (localStorage se limpia al cargar)
    localStorage.removeItem('porra_ucl_scores');

    const savedSquad = localStorage.getItem('porra_ucl_squad');
    if (savedSquad) {
      const parsed = JSON.parse(savedSquad);
      // Migrar formato antiguo (objeto) al nuevo (array)
      if (Array.isArray(parsed)) {
        AppState.squadPicks = parsed;
      } else {
        AppState.squadPicks = [];
        localStorage.removeItem('porra_ucl_squad');
      }
      AppState.blockedTeams = new Set(AppState.squadPicks.map(p => p.equipo));
    }

  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

// ============================================================
// FUNCIONES AUXILIARES DE DATOS
// ============================================================

/** Carga predicciones desde el backend y sobreescribe el estado */
async function fetchPredictionsFromBackend() {
  if (!AppState.currentUser) return;
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/predictions`, { headers: authHeaders() });
    const data = await res.json();
    if (data.ok && data.predictions) {
      AppState.scorePredictions = data.predictions;
    }
  } catch (e) {
    console.error('Error cargando predicciones del backend:', e);
  }
  AppState.hasUnsavedChanges = false;
  localStorage.removeItem('porra_ucl_scores');
}

/** Guarda predicciones en el backend */
async function savePredictionsToBackend() {
  if (!AppState.currentUser) return false;
  if (isFaseLiga()) {
    showToast('Los pronósticos están bloqueados');
    return false;
  }
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/predictions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        predictions: AppState.scorePredictions
      })
    });
    if (res.status === 401) { logout(); return false; }
    const data = await res.json();
    if (data.ok) {
      AppState.hasUnsavedChanges = false;
      localStorage.removeItem('porra_ucl_scores');
      // Invalidar caché para que se refresquen los datos
      AppState._allPredictionsTime = 0;
      AppState._matchStatsTime = 0;
      showToast('Predicciones guardadas');
      return true;
    } else {
      showToast('Error al guardar');
      return false;
    }
  } catch (e) {
    console.error('Error guardando predicciones:', e);
    showToast('Error de conexion');
    return false;
  }
}

/** Transforma un partido del calendar.json al formato interno de la app */
function buildMatchFromCalendar(m) {
  const localId = m.equipoLocal.id;
  const visitId = m.equipoVisitante.id;
  const localTeam = AppState.teamsMap[localId] || { name: m.equipoLocal.name, ext: 'png' };
  const visitTeam = AppState.teamsMap[visitId] || { name: m.equipoVisitante.name, ext: 'png' };

  return {
    id: m.id,
    ronda: m.ronda,
    fechaTs: m.fecha,
    fecha: formatDate(m.fecha),
    journey: `Jornada ${m.ronda}`,
    homeTeam: localTeam.name,
    homeTeamId: localId,
    homeBadgeExt: localTeam.ext,
    awayTeam: visitTeam.name,
    awayTeamId: visitId,
    awayBadgeExt: visitTeam.ext,
  };
}

/** Convierte timestamp Unix a fecha legible en espanol */
function formatDate(ts) {
  const d = new Date(ts * 1000);
  const dia = d.getDate();
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mes = meses[d.getMonth()];
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia} ${mes} ${anio}, ${hora}:${min}`;
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function skeletonRows(count = 5) {
  return Array(count).fill('').map(() => `
    <div class="skeleton-row">
      <div class="skeleton skeleton-img"></div>
      <div style="flex:1">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text-sm"></div>
      </div>
    </div>
  `).join('');
}

function skeletonCards(count = 6) {
  return Array(count).fill('').map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-text" style="width:80%"></div>
      <div class="skeleton skeleton-text-sm" style="width:50%"></div>
    </div>
  `).join('');
}

function skeletonTableRows(count = 8) {
  return Array(count).fill('').map(() => `
    <div class="skeleton-table-row">
      <div class="skeleton" style="width:20px;height:14px"></div>
      <div class="skeleton skeleton-badge"></div>
      <div class="skeleton skeleton-text" style="margin:0"></div>
      <div class="skeleton" style="width:30px;height:14px"></div>
      <div class="skeleton" style="width:30px;height:14px"></div>
      <div class="skeleton" style="width:24px;height:14px"></div>
      <div class="skeleton" style="width:24px;height:14px"></div>
      <div class="skeleton" style="width:24px;height:14px"></div>
    </div>
  `).join('');
}

/** Devuelve el nombre de un equipo por su id */
function teamImgTag(teamId, ext, alt, className) {
  const cls = className ? ` class="${className}"` : '';
  return `<img src="data/imgEquipos/${teamId}.${ext}" alt="${alt}"${cls} loading="lazy">`;
}

/** Genera tag <img> para jugador */
function playerImgTag(playerId, ext, alt, className) {
  const cls = className ? ` class="${className}"` : '';
  return `<img src="data/imgJugadores/${playerId}.${ext}" alt="${alt}"${cls} loading="lazy">`;
}

/** Devuelve el nombre de un equipo por su id */
function teamName(teamId) {
  return AppState.teamsMap[teamId]?.name || 'Desconocido';
}

/** Filtro de jugadores por texto y posición activa. Solo muestra jugadores de equipos disponibles. */
function filterPlayers(query, selectedIds, positionFilter, teamFilter) {
  const q = query.toLowerCase().trim();
  return AppState.allPlayers.filter(p => {
    if (selectedIds.has(p.id)) return false;
    if (positionFilter && p.posicion !== positionFilter) return false;
    if (teamFilter && p.equipo !== parseInt(teamFilter)) return false;
    if (AppState.blockedTeams.has(p.equipo)) return false;
    if (q && !p.nombre.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ============================================================
// FUNCIONES DE CALCULO DE PUNTOS
// ============================================================

/** Obtiene todos los matchstats del backend */
const CACHE_TTL = 30000; // 30 segundos

async function fetchMatchStats(force = false) {
  // Usar caché si tiene menos de 30 segundos (salvo force)
  if (!force && AppState.matchStats.length > 0 && AppState._matchStatsTime && Date.now() - AppState._matchStatsTime < CACHE_TTL) {
    return;
  }
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/match-stats`);
    const data = await res.json();
    if (data.ok && data.matchStats) {
      const hadData = AppState.matchStats.length > 0;
      AppState.matchStats = data.matchStats;
      AppState._matchStatsTime = Date.now();
      // Invalidar caché de clasificación si se actualizaron los datos
      if (hadData || data.matchStats.length > 0) {
        invalidateClassificationCache();
      }
    }
  } catch (e) {
    console.error('Error cargando matchstats:', e);
  }
}

/** Obtiene las predicciones de todos los usuarios del backend */
async function fetchAllPredictions() {
  // Usar caché si tiene menos de 30 segundos
  if (AppState._allPredictionsTime && Date.now() - AppState._allPredictionsTime < CACHE_TTL) {
    return;
  }
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/predictions/all`, { headers: authHeaders() });
    const data = await res.json();
    if (data.ok && data.predictions) {
      const unwrapped = {};
      for (const [username, userData] of Object.entries(data.predictions)) {
        unwrapped[username] = userData.predictions || {};
      }
      AppState.allPredictions = unwrapped;
      AppState._allPredictionsTime = Date.now();
    }
  } catch (e) {
    console.error('Error cargando todas las predicciones:', e);
  }
}

// ============================================================
// AUTO-REFRESH DE RESULTADOS
// ============================================================

let _statsPollInterval = null;
let _statsVisibilityHandler = null;
let _lastStatsUpdate = null;

function showNewMatchToast() {
  document.querySelector('.toast-new-match')?.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-new-match';
  toast.innerHTML = 'Nuevo resultado disponible<br><span style="text-decoration:underline">Ver resultados</span>';

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    backgroundColor: '#10B981',
    color: '#021319',
    padding: '12px 20px',
    borderRadius: '20px',
    fontWeight: '700',
    fontSize: '0.85rem',
    whiteSpace: 'pre-line',
    textAlign: 'center',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    zIndex: '2000',
    opacity: '0',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    cursor: 'pointer',
  });

  toast.addEventListener('click', () => {
    toast.remove();
    navigateToTab('resultados');
  });

  (document.getElementById('app-viewport') || document.body).appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 8000);
}

async function fetchMatchStatsUpdated() {
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/match-stats/updated`);
    const data = await res.json();
    console.log('[POLL]', data, 'lastKnown:', _lastStatsUpdate);
    if (data.ok) {
      const newUpdate = data.lastUpdated || data.count;
      if (_lastStatsUpdate && newUpdate !== _lastStatsUpdate) {
        console.log('[POLL] ¡Nuevos datos! Refrescando...');
        await fetchMatchStats(true);
        const activeTab = document.querySelector('.nav-item.active')?.dataset?.tab;
        if (activeTab === 'resultados') renderResultadosTab();
        if (activeTab === 'clasificacion') renderClasificacionTab();
        showNewMatchToast();
      }
      _lastStatsUpdate = newUpdate;
    }
  } catch (e) {
    console.log('[POLL] Error:', e.message);
  }
}

function startMatchStatsPolling() {
  stopMatchStatsPolling();
  if (isFasePretemporada()) return;

  const poll = () => {
    if (document.visibilityState === 'visible') fetchMatchStatsUpdated();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      poll();
      _statsPollInterval = setInterval(poll, 60000);
    } else {
      stopMatchStatsPolling();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  _statsVisibilityHandler = onVisibilityChange;

  if (document.visibilityState === 'visible') {
    _statsPollInterval = setInterval(poll, 60000);
  }
}

function stopMatchStatsPolling() {
  if (_statsPollInterval) {
    clearInterval(_statsPollInterval);
    _statsPollInterval = null;
  }
  if (_statsVisibilityHandler) {
    document.removeEventListener('visibilitychange', _statsVisibilityHandler);
    _statsVisibilityHandler = null;
  }
}

/** Devuelve 'H', 'A' o 'D' según el resultado del partido */
function getMatchResult(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'H';
  if (homeGoals < awayGoals) return 'A';
  return 'D';
}

/** Calcula puntos y desglose para un partido individual */
function calculateMatchPoints(prediction, matchStats, match) {
  if (!matchStats || !matchStats.stats) {
    return { points: 0, breakdown: ['Partido sin resultado'] };
  }

  const realHome = matchStats.stats[match.homeTeamId]?.goles;
  const realAway = matchStats.stats[match.awayTeamId]?.goles;

  if (realHome === undefined || realAway === undefined) {
    return { points: 0, breakdown: ['Partido sin resultado'] };
  }

  if (!prediction || prediction.home === null || prediction.away === null) {
    return { points: 0, breakdown: ['Partido no pronosticado'] };
  }

  let points = 0;
  let breakdown = [];

  // Acierto de resultado (V/E/D)
  const predResult = getMatchResult(prediction.home, prediction.away);
  const realResult = getMatchResult(realHome, realAway);
  if (predResult === realResult) {
    points += 8;
    breakdown.push('8 por acertar resultado');
  }

  // Acierto de goles local
  if (prediction.home === realHome) {
    points += 3;
    breakdown.push('3 por goles local');
  }

  // Acierto de goles visitante
  if (prediction.away === realAway) {
    points += 3;
    breakdown.push('3 por goles visitante');
  }

  // Acierto de ambos goles (solo si acierta ambos individualmente)
  if (prediction.home === realHome && prediction.away === realAway) {
    points += 1;
    breakdown.push('1 por ambos goles');
  }

  return { points, breakdown };
}

/** Calcula puntos totales y desglose detallado para un usuario */
function calculateUserTotalPoints(username) {
  const predictions = AppState.allPredictions[username] || {};
  let totalPoints = 0;
  let matchDetails = [];

  for (const match of AppState.matches) {
    const matchStats = AppState.matchStats.find(ms => ms.eventId === match.id);
    if (!matchStats) continue;

    const prediction = predictions[match.id];
    const { points, breakdown } = calculateMatchPoints(prediction, matchStats, match);
    totalPoints += points;
    matchDetails.push({ match, points, breakdown });
  }

  return { totalPoints, matchDetails };
}

// ============================================================
// CALCULO DE PUNTOS DE PLANTILLA IDEAL
// ============================================================

/** Calcula los puntos de un jugador en un partido específico */
function calculatePlayerMatchPoints(playerData, squadPlayer, matchStat) {
  // Si no jugó, 0 puntos
  if (!playerData.minutos || playerData.minutos === 0) {
    return { total: 0, desglose: [] };
  }

  let total = 0;
  const desglose = [];

  // 1. Puntuación Sofascore (rating -> puntos)
  const rating = playerData.puntos || 0;
  // Si el rating es 0, Sofascore no asignó puntuación (suplente con poco tiempo)
  if (rating === 0) {
    return { total: 0, desglose: [] };
  }
  let ratingPoints = 0;
  if (rating >= 6) {
    ratingPoints = Math.min(13, Math.floor((rating - 6) / 0.3));
  } else if (rating >= 5.7) {
    ratingPoints = -1;
  } else {
    ratingPoints = Math.max(-13, -1 + Math.floor((rating - 5.7) / 0.3));
  }
  if (ratingPoints !== 0) {
    total += ratingPoints;
    desglose.push({ concepto: `Rating Sofascore (${rating.toFixed(1)})`, puntos: ratingPoints });
  }

  // 2. Puntuación por goles marcados
  const goles = playerData.goles || 0;
  if (goles > 0) {
    const pos = squadPlayer.posicion;
    const bonusMap = { F: 1, M: 2, D: 3, G: 4 };
    const penaltisMarcados = playerData.penaltiMarcado || 0;
    const golesCampo = goles - penaltisMarcados;

    for (let i = 0; i < goles; i++) {
      total += 1;
      desglose.push({ concepto: 'Gol marcado', puntos: 1 });
    }

    if (golesCampo > 0 && bonusMap[pos]) {
      const bonusTotal = golesCampo * bonusMap[pos];
      total += bonusTotal;
      desglose.push({ concepto: `Bonus ${pos} por ${golesCampo} gol(es) de campo`, puntos: bonusTotal });
    }
  }

  // 3. Porteros: goles recibidos y penaltis parados
  if (squadPlayer.posicion === 'G') {
    const golesRecibidos = playerData.golesRecibidos || 0;

    if (golesRecibidos > 0) {
      total -= golesRecibidos;
      desglose.push({ concepto: `${golesRecibidos} gol(es) recibido(s)`, puntos: -golesRecibidos });
    }

    const penaltisParados = playerData.penaltiParado || 0;
    if (penaltisParados > 0) {
      const bonus = penaltisParados * 3;
      total += bonus;
      desglose.push({ concepto: `${penaltisParados} penalti(s) parado(s)`, puntos: bonus });
    }
  }

  // 4. Portería a cero (G +5, D +2 si >70 min)
  const equipoId = String(squadPlayer.equipo);
  const statsKeys = Object.keys(matchStat.stats || {});
  const rivalId = statsKeys.find(id => id !== equipoId && id !== 'jugadores');
  const golesRival = rivalId ? (matchStat.stats[rivalId]?.goles || 0) : 0;
  if (golesRival === 0 && playerData.minutos > 70) {
    if (squadPlayer.posicion === 'G') {
      total += 5;
      desglose.push({ concepto: 'Portería a cero', puntos: 5 });
    } else if (squadPlayer.posicion === 'D') {
      total += 2;
      desglose.push({ concepto: 'Portería a cero', puntos: 2 });
    }
  }

  return { total, desglose };
}

/** Calcula los puntos de TODA la plantilla de un usuario */
function calculateSquadPoints(squad, matchStats) {
  let totalPoints = 0;
  const playerDetails = [];

  // Pre-construir índice de búsqueda O(1) por eventId y playerId
  const playerIndex = new Map();
  for (const ms of matchStats) {
    const map = new Map();
    if (ms.stats?.jugadores) {
      for (const j of ms.stats.jugadores) {
        map.set(String(j.id), j);
      }
    }
    playerIndex.set(ms.eventId, map);
  }

  for (const squadPlayer of squad) {
    let jugadorTotal = 0;
    const partidos = [];

    for (const ms of matchStats) {
      const jugadorData = playerIndex.get(ms.eventId)?.get(String(squadPlayer.id));
      if (!jugadorData) continue;

      const { total, desglose } = calculatePlayerMatchPoints(jugadorData, squadPlayer, ms);
      if (total !== 0 || desglose.length > 0) {
        jugadorTotal += total;
        partidos.push({ eventId: ms.eventId, puntos: total, desglose });
      }
    }

    totalPoints += jugadorTotal;
    playerDetails.push({
      jugador: squadPlayer,
      puntosTotal: jugadorTotal,
      partidos
    });
  }

  return { totalPoints, playerDetails };
}

/** Busca el nombre del partido (equipos) a partir de un eventId */
function getMatchName(eventId) {
  const match = AppState.matches.find(m => m.id === eventId);
  if (!match) return `Partido ${eventId}`;
  return `${match.homeTeam} vs ${match.awayTeam}`;
}

/** Renderiza la pestaña de clasificación con puntos reales */
async function renderClasificacionTab() {
  const container = document.getElementById('clasificacion-container');
  if (!container) return;

  container.innerHTML = skeletonRows(8);
  await Promise.all([fetchPlayers(), fetchMatchStats(), fetchAllPredictions()]);

  const players = AppState.players || [];

  if (!players.length) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando clasificación...</div>`;
    return;
  }

  // Pre-freeze: solo nombres, sin puntos; solo el propio usuario es clickable
  if (isFasePretemporada()) {
    // Calcular puntos del usuario actual para que su perfil funcione
    if (AppState.currentUser) {
      const myData = calculateUserTotalPoints(AppState.currentUser.name);
      AppState.userPoints[AppState.currentUser.name] = myData;
    }
    container.innerHTML = players.map((p, i) => {
      const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
      const clickAttr = isMe ? `onclick="showUserProfileModal('${p.name}')"` : `onclick="showToast('Los pronósticos de otros usuarios<br>se verán al inicio de la competición')"`;
      return `
        <div class="leaderboard-row ${isMe ? 'current-user' : ''}" ${clickAttr} style="${isMe ? 'cursor:pointer' : ''}">
          <div class="rank-badge">${i + 1}</div>
          <div class="player-avatar">${p.avatar}</div>
          <div class="player-info">
            <div class="player-name">${p.name}${isMe ? ' <span style="color:var(--accent-primary)">(Tu)</span>' : ''}</div>
          </div>
        </div>
      `;
    }).join('');
    return;
  }

   // Post-freeze: puntos reales + perfil clickable
   // Obtener todas las plantillas en una sola petición (con caché)
   if (!AppState.squadsCache || !Object.keys(AppState.squadsCache).length || !AppState._squadsCacheTime || Date.now() - AppState._squadsCacheTime >= CACHE_TTL) {
     try {
       const res = await fetchWithPhase(`${API_BASE}/api/squad/all`, { headers: authHeaders() });
       const data = await res.json();
       if (data.ok && data.squads) {
         AppState.squadsCache = { ...AppState.squadsCache, ...data.squads };
         AppState._squadsCacheTime = Date.now();
       }
    } catch (e) { /* ignore */ }
  }

  // Pre-calcular clasificación real una sola vez
  const hasMatchStats = AppState.matchStats.length > 0;
  if (hasMatchStats) {
    calculateRealStandings();
  }

  const playersWithPoints = players.map(p => {
    const userData = calculateUserTotalPoints(p.name);
    AppState.userPoints[p.name] = userData;

    // Obtener plantilla del caché
    let squadPoints = 0;
    const userSquad = AppState.squadsCache?.[p.name];
    if (userSquad && userSquad.length) {
      const { totalPoints } = calculateSquadPoints(userSquad, AppState.matchStats);
      squadPoints = totalPoints;
    }

    // Calcular puntos por clasificación
    let classificationPts = 0;
    if (hasMatchStats) {
      const classData = calculateClassificationPoints(p.name);
      classificationPts = classData.totalPoints;
    }

    return {
      ...p,
      predictionPoints: userData.totalPoints,
      squadPoints,
      classificationPoints: classificationPts,
      realPoints: userData.totalPoints + squadPoints + classificationPts
    };
  });

  // Ordenar por puntos descendente
  playersWithPoints.sort((a, b) => b.realPoints - a.realPoints);

  container.innerHTML = playersWithPoints.map((p, i) => {
    const rank = i + 1;
    const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
    const breakdownParts = [];
    if (p.predictionPoints) breakdownParts.push(`${p.predictionPoints} pronósticos`);
    if (p.squadPoints) breakdownParts.push(`${p.squadPoints} plantilla`);
    if (p.classificationPoints) breakdownParts.push(`${p.classificationPoints} clasificación`);
    const breakdownStr = breakdownParts.length ? ` (${breakdownParts.join(' + ')})` : '';
    return `
      <div class="leaderboard-row ${isMe ? 'current-user' : ''}" onclick="showUserProfileModal('${p.name}')">
        <div class="rank-badge rank-${rank}">${rank}</div>
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${p.name}${isMe ? ' <span style="color:var(--accent-primary)">(Tu)</span>' : ''}</div>
          <div class="player-breakdown" style="font-size:10px;color:var(--text-muted)">${breakdownStr}</div>
        </div>
        <div class="player-points">${p.realPoints} <span style="font-size:10px;color:var(--text-muted)">pts</span></div>
      </div>
    `;
  }).join('');
}

/** Renderiza la tab de pronósticos en el modal de perfil */
function showUserProfileModal(username) {
  const existing = document.querySelector('.breakdown-modal-overlay');
  if (existing) existing.remove();

  // Pre-freeze: no se puede ver el perfil de otros usuarios
  if (isFasePretemporada()) {
    const isMe = AppState.currentUser && username === AppState.currentUser.name;
    if (!isMe) {
      showToast('Los pronósticos y plantillas de otros usuarios<br>se verán al inicio de la competición');
      return;
    }
  }

  const userData = AppState.userPoints[username];
  if (!userData) {
    showToast('Cargando datos del usuario...');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'breakdown-modal-overlay';

  overlay.innerHTML = `
    <div class="breakdown-modal">
      <div class="breakdown-modal-header">
        <button class="breakdown-modal-back" id="breakdown-close">←</button>
        <h3 class="breakdown-modal-title">${username}</h3>
        <button class="breakdown-modal-close" id="breakdown-close-x">✕</button>
      </div>
      <div class="profile-tabs">
        <button class="profile-tab active" data-tab="predictions">Pronósticos</button>
        <button class="profile-tab" data-tab="squad">Plantilla</button>
        <button class="profile-tab" data-tab="classification">Clasificación</button>
      </div>
      <div class="breakdown-modal-content" id="profile-tab-content">
        <div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector('#breakdown-close').addEventListener('click', closeModal);
  overlay.querySelector('#breakdown-close-x').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const tabContent = overlay.querySelector('#profile-tab-content');
  const tabs = overlay.querySelectorAll('.profile-tab');

  function activateTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    if (tabName === 'predictions') renderPredictionsTab(tabContent, userData);
    else if (tabName === 'squad') renderSquadTab(tabContent, username);
    else if (tabName === 'classification') renderClassificationTab(tabContent, username);
  }

  tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));

  activateTab('predictions');
}

/** Renderiza la tab de pronósticos en el modal de perfil */
function renderPredictionsTab(container, userData) {
  let matchesByJourney = {};
  for (const detail of userData.matchDetails) {
    const journey = detail.match.journey;
    if (!matchesByJourney[journey]) matchesByJourney[journey] = [];
    matchesByJourney[journey].push(detail);
  }

  // Also include matches the user predicted but don't have results yet
  const username = Object.keys(AppState.userPoints).find(u => AppState.userPoints[u] === userData);
  const predictions = AppState.allPredictions[username] || {};
  for (const match of AppState.matches) {
    const prediction = predictions[match.id];
    if (!prediction) continue;
    const hasResult = AppState.matchStats.some(ms => ms.eventId === match.id);
    if (hasResult) continue; // already included
    const journey = match.journey;
    if (!matchesByJourney[journey]) matchesByJourney[journey] = [];
    matchesByJourney[journey].push({
      match,
      points: 0,
      breakdown: ['Pendiente'],
      predicted: prediction
    });
  }

  let contentHtml = '';
  for (const [journey, matches] of Object.entries(matchesByJourney)) {
    contentHtml += `
      <div class="breakdown-journey">
        <div class="breakdown-journey-title">${journey}</div>
        ${matches.map(m => {
          const matchStats = AppState.matchStats.find(ms => ms.eventId === m.match.id);
          const prediction = m.predicted || AppState.allPredictions[username]?.[m.match.id];
          const hasResult = !!matchStats;
          const realHome = hasResult ? matchStats.stats[m.match.homeTeamId]?.goles : null;
          const realAway = hasResult ? matchStats.stats[m.match.awayTeamId]?.goles : null;
          const predHome = prediction?.home;
          const predAway = prediction?.away;
          const isPending = !hasResult;
          const homeCorrect = hasResult && predHome === realHome;
          const awayCorrect = hasResult && predAway === realAway;

          return `
            <div class="profile-match">
              <div class="profile-match-teams">
                <div class="profile-match-team">
                  <img class="profile-match-badge" src="data/imgEquipos/${m.match.homeTeamId}.${m.match.homeBadgeExt}" alt="${m.match.homeTeam}" loading="lazy" onerror="this.style.display='none'">
                  <span>${m.match.homeTeam}</span>
                </div>
                <div class="profile-match-score">
                  <span class="profile-score-pred ${homeCorrect ? 'correct' : ''}">${predHome !== null && predHome !== undefined ? predHome : '-'}</span>
                  <span class="profile-score-sep">-</span>
                  <span class="profile-score-pred ${awayCorrect ? 'correct' : ''}">${predAway !== null && predAway !== undefined ? predAway : '-'}</span>
                </div>
                <div class="profile-match-team">
                  <span>${m.match.awayTeam}</span>
                  <img class="profile-match-badge" src="data/imgEquipos/${m.match.awayTeamId}.${m.match.awayBadgeExt}" alt="${m.match.awayTeam}" loading="lazy" onerror="this.style.display='none'">
                </div>
              </div>
              <div class="profile-match-real">
                ${isPending ? '<span class="profile-pending">⏳ Pendiente</span>' : `Real: ${realHome} - ${realAway}`}
              </div>
              ${hasResult ? `
                <div class="profile-match-points ${m.points > 0 ? 'has-points' : 'no-points'}">
                  → ${m.points} pts${m.breakdown.length ? ' (' + m.breakdown.join(', ') + ')' : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  if (!contentHtml) {
    contentHtml = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay pronósticos para mostrar</div>';
  }

  container.innerHTML = `
    <div class="profile-total-points">Puntos totales: <strong>${userData.totalPoints}</strong></div>
    ${contentHtml}
  `;
}

/** Renderiza la tab de plantilla en el modal de perfil */
async function renderSquadTab(container, username) {
  container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando plantilla...</div>';

  try {
    let squad = null;

    // Si es el usuario actual, usar datos locales (más recientes)
    if (AppState.currentUser && username === AppState.currentUser.name && AppState.squadPicks && AppState.squadPicks.length) {
      squad = AppState.squadPicks;
    } else if (AppState.squadsCache && AppState.squadsCache[username]) {
      // Intentar usar caché para otros usuarios
      squad = AppState.squadsCache[username];
    } else {
      // Fetch individual si no está en caché
      const res = await fetchWithPhase(`${API_BASE}/api/squad?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.ok && data.squad && data.squad.length) {
        squad = data.squad;
        // Guardar en caché
        if (!AppState.squadsCache) AppState.squadsCache = {};
        AppState.squadsCache[username] = squad;
      }
    }

    if (!squad || !squad.length) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Este usuario no tiene plantilla</div>';
      return;
    }

    // Enriquecer squad con datos completos de allPlayers (extension, etc.)
    squad = squad.map(sp => {
      const full = AppState.allPlayers.find(p => p.id === sp.id);
      return full ? { ...sp, extension: full.extension || sp.extension || 'png' } : { ...sp, extension: sp.extension || 'png' };
    });

    const positionOrder = ['G', 'D', 'M', 'F'];
    const positionNames = { G: 'Porteros', D: 'Defensas', M: 'Centrocampistas', F: 'Delanteros' };

    // Calcular puntos con la nueva función
    const { totalPoints, playerDetails } = calculateSquadPoints(squad, AppState.matchStats);

    const grouped = {};
    for (const pos of positionOrder) grouped[pos] = [];
    for (const detail of playerDetails) {
      const pos = detail.jugador.posicion || 'F';
      if (!grouped[pos]) grouped[pos] = [];
      grouped[pos].push(detail);
    }

    // Store details globally for modal access
    AppState.currentSquadDetails = playerDetails;

    let html = '';
    for (const pos of positionOrder) {
      const details = grouped[pos];
      if (!details.length) continue;
      html += `<div class="profile-squad-section"><div class="profile-squad-section-title">${positionNames[pos]}</div>`;
      html += '<div class="profile-squad-grid">';
      for (const detail of details) {
        const p = detail.jugador;
        const pts = detail.puntosTotal;
        const idx = playerDetails.indexOf(detail);
        html += `
          <div class="profile-squad-card" onclick="showPlayerPointsBreakdown(AppState.currentSquadDetails[${idx}])" style="cursor:pointer">
            <img class="profile-squad-img" src="data/imgJugadores/${p.id}.${p.extension || 'png'}" alt="${p.nombre}" loading="lazy">
            <div class="profile-squad-name">${p.nombre}</div>
            <div class="profile-squad-club">${p.club}</div>
            <div class="profile-squad-pts">${pts} pts</div>
          </div>
        `;
      }
      html += '</div></div>';
    }

    container.innerHTML = `
      <div class="profile-total-points">Puntos totales plantilla: <strong>${totalPoints}</strong></div>
      ${html}
    `;
  } catch (e) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Error al cargar plantilla</div>';
  }
}

/** Renderiza la tab de clasificación en el modal de perfil */
function renderClassificationTab(container, username) {
  // Verificar si hay clasificación real disponible
  if (!AppState.matchStats.length) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">La clasificación real estará disponible cuando se disputen partidos.</div>';
    return;
  }

  // Calcular puntos de clasificación del usuario
  const classData = calculateClassificationPoints(username);

  if (!classData.teamDetails.length) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay datos de clasificación disponibles.</div>';
    return;
  }

  // Filtrar solo equipos con posición real 1-24 (los que puntúan)
  const scoringTeams = classData.teamDetails.filter(t => t.realPos <= 24);
  const nonScoringTeams = classData.teamDetails.filter(t => t.realPos > 24);

  let html = `
    <div class="profile-total-points">Puntos totales clasificación: <strong>${classData.totalPoints}</strong></div>
    <div class="classification-legend" style="padding: 8px 16px; font-size: 11px; color: var(--text-muted); text-align: center;">
      Solo puntúan equipos en posición 1-24 | Mínimo entre posición pronosticada y real
    </div>
  `;

  // Tabla de equipos que puntúan
  if (scoringTeams.length) {
    html += `
      <div class="classification-section">
        <div class="classification-section-title">Equipos que puntúan (1º-24º)</div>
        <div class="classification-table">
          <div class="classification-header">
            <span class="col-pos">#</span>
            <span class="col-team">Equipo</span>
            <span class="col-pred">Pron.</span>
            <span class="col-real">Real</span>
            <span class="col-pts">Pts</span>
          </div>
    `;

    for (const team of scoringTeams.sort((a, b) => a.realPos - b.realPos)) {
      const predDisplay = team.predictedPos <= 36 ? team.predictedPos : '-';
      const ptsClass = team.points > 0 ? 'positive' : '';
      html += `
        <div class="classification-row">
          <span class="col-pos">${team.realPos}</span>
          <span class="col-team">
            <img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="classification-badge" alt="${team.name}" loading="lazy" onerror="this.style.display='none'">
            ${team.name}
          </span>
          <span class="col-pred">${predDisplay}</span>
          <span class="col-real">${team.realPos}</span>
          <span class="col-pts ${ptsClass}">${team.points}</span>
        </div>
      `;
    }

    html += '</div></div>';
  }

  // Tabla de equipos que no puntúan (resumen)
  if (nonScoringTeams.length) {
    html += `
      <div class="classification-section">
        <div class="classification-section-title">Equipos sin puntos (25º-36º)</div>
        <div class="classification-table">
          <div class="classification-header">
            <span class="col-pos">#</span>
            <span class="col-team">Equipo</span>
            <span class="col-pred">Pron.</span>
            <span class="col-real">Real</span>
            <span class="col-pts">Pts</span>
          </div>
    `;

    for (const team of nonScoringTeams.sort((a, b) => a.realPos - b.realPos)) {
      const predDisplay = team.predictedPos <= 36 ? team.predictedPos : '-';
      html += `
        <div class="classification-row muted">
          <span class="col-pos">${team.realPos}</span>
          <span class="col-team">
            <img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="classification-badge" alt="${team.name}" loading="lazy" onerror="this.style.display='none'">
            ${team.name}
          </span>
          <span class="col-pred">${predDisplay}</span>
          <span class="col-real">${team.realPos}</span>
          <span class="col-pts">0</span>
        </div>
      `;
    }

    html += '</div></div>';
  }

  container.innerHTML = html;
}

/** Muestra modal con desglose de puntos de un jugador por partido */
function showPlayerPointsBreakdown(detail) {
  const existing = document.querySelector('.player-breakdown-modal-overlay');
  if (existing) existing.remove();

  const p = detail.jugador;
  const overlay = document.createElement('div');
  overlay.className = 'player-breakdown-modal-overlay';

  let partidosHtml = '';
  if (detail.partidos.length === 0) {
    partidosHtml = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Sin puntos en ningún partido</div>';
  } else {
    for (const partido of detail.partidos) {
      const matchName = getMatchName(partido.eventId);
      const desgloseItems = partido.desglose.map(d =>
        `<div class="breakdown-item"><span>${d.concepto}</span><span class="${d.puntos >= 0 ? 'positive' : 'negative'}">${d.puntos > 0 ? '+' : ''}${d.puntos}</span></div>`
      ).join('');
      partidosHtml += `
        <div class="breakdown-match">
          <div class="breakdown-match-title">${matchName}</div>
          ${desgloseItems}
          <div class="breakdown-match-total">Subtotal: <strong>${partido.puntos > 0 ? '+' : ''}${partido.puntos}</strong></div>
        </div>
      `;
    }
  }

  overlay.innerHTML = `
    <div class="breakdown-modal">
      <div class="breakdown-modal-header">
        <button class="breakdown-modal-back" id="player-breakdown-close">←</button>
        <h3 class="breakdown-modal-title">${p.nombre}</h3>
        <button class="breakdown-modal-close" id="player-breakdown-close-x">✕</button>
      </div>
      <div class="breakdown-modal-subtitle">${p.club} | ${p.posicion === 'G' ? 'Portero' : p.posicion === 'D' ? 'Defensa' : p.posicion === 'M' ? 'Centrocampista' : 'Delantero'}</div>
      <div class="breakdown-modal-content">
        ${partidosHtml}
      </div>
      <div class="breakdown-modal-footer">
        <strong>Total: ${detail.puntosTotal} pts</strong>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector('#player-breakdown-close').addEventListener('click', closeModal);
  overlay.querySelector('#player-breakdown-close-x').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

/** Renderiza la pestaña de resultados por jornada */
async function renderResultadosTab() {
  const container = document.getElementById('resultados-container');
  if (!container) return;

  if (isFasePretemporada()) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Los resultados estarán disponibles al comenzar la competición.</div>`;
    return;
  }

  container.innerHTML = skeletonRows(6);
  await Promise.all([fetchMatchStats(), fetchAllPredictions()]);

  if (!AppState.matchStats.length) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay resultados disponibles aún.</div>`;
    return;
  }

   // Precargar plantillas de todos los usuarios (una sola petición, con caché)
   if (!AppState.squadsCache || !Object.keys(AppState.squadsCache).length || !AppState._squadsCacheTime || Date.now() - AppState._squadsCacheTime >= CACHE_TTL) {
     try {
       const res = await fetchWithPhase(`${API_BASE}/api/squad/all`, { headers: authHeaders() });
       const data = await res.json();
       if (data.ok && data.squads) {
         AppState.squadsCache = { ...AppState.squadsCache, ...data.squads };
         AppState._squadsCacheTime = Date.now();
       }
    } catch (e) { /* ignore */ }
  }

  // Pre-calcular clasificación real
  calculateRealStandings();

  // Selector de tabs
  const currentTab = AppState.resultadosTab || 'jornadas';
  let headerHtml = `
    <div class="resultados-tabs">
      <button class="resultados-tab ${currentTab === 'jornadas' ? 'active' : ''}" data-tab="jornadas">Jornadas</button>
      <button class="resultados-tab ${currentTab === 'clasificacion' ? 'active' : ''}" data-tab="clasificacion">Clasificación Real</button>
    </div>
  `;
  let scrollHtml = '';

  if (currentTab === 'clasificacion') {
    // Mostrar clasificación real
    scrollHtml = renderRealStandingsTable();
  } else {
    // Mostrar jornadas (código existente)
    // Obtener todas las rondas disponibles
    const availableRounds = [...new Set(AppState.matches.map(m => m.ronda))].sort((a, b) => a - b);

    if (!availableRounds.length) {
      scrollHtml = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay resultados disponibles aún.</div>`;
      container.innerHTML = headerHtml + scrollHtml;
      return;
    }

    // Determinar ronda por defecto: la última con resultados, o la última en general
    if (!AppState.resultadosRound || !availableRounds.includes(AppState.resultadosRound)) {
      const roundsWithResults = [...new Set(AppState.matchStats.map(ms => {
        const match = AppState.matches.find(m => m.id === ms.eventId);
        return match?.ronda;
      }).filter(Boolean))];
      AppState.resultadosRound = roundsWithResults.length ? roundsWithResults[roundsWithResults.length - 1] : availableRounds[availableRounds.length - 1];
    }

    const currentRound = AppState.resultadosRound;
    const roundMatches = AppState.matches.filter(m => m.ronda === currentRound);

    // Todos los partidos de la jornada
    const allRoundMatches = [];
    for (const match of roundMatches) {
      const matchStats = AppState.matchStats.find(ms => ms.eventId === match.id);
      const hasResult = matchStats && matchStats.stats;
      allRoundMatches.push({
        match,
        homeGoals: hasResult ? matchStats.stats[match.homeTeamId]?.goles : null,
        awayGoals: hasResult ? matchStats.stats[match.awayTeamId]?.goles : null,
        hasResult,
      });
    }

    // Ordenar: disputados primero (más reciente), luego sin disputar (por fecha)
    allRoundMatches.sort((a, b) => {
      if (a.hasResult && !b.hasResult) return -1;
      if (!a.hasResult && b.hasResult) return 1;
      return b.match.fechaTs - a.match.fechaTs;
    });

    const roundIndex = availableRounds.indexOf(currentRound);
    const hasPrev = roundIndex > 0;
    const hasNext = roundIndex < availableRounds.length - 1;

    headerHtml += `
      <div class="resultados-round-nav">
        <button class="resultados-round-btn" id="btn-resultados-round-prev" ${!hasPrev ? 'disabled' : ''}>◀</button>
        <span class="resultados-round-label">Jornada ${currentRound} <span class="resultados-round-count">(${allRoundMatches.length} partidos)</span></span>
        <button class="resultados-round-btn" id="btn-resultados-round-next" ${!hasNext ? 'disabled' : ''}>▶</button>
      </div>
    `;

    if (allRoundMatches.length) {
      scrollHtml = `
        <div class="resultados-journey">
          ${allRoundMatches.map(m => renderMatchResult(m)).join('')}
        </div>
      `;
    } else {
      scrollHtml = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay resultados en esta jornada.</div>`;
    }

    // Eventos de navegación de jornadas
    setTimeout(() => {
      document.getElementById('btn-resultados-round-prev')?.addEventListener('click', () => {
        if (roundIndex > 0) {
          AppState.resultadosRound = availableRounds[roundIndex - 1];
          renderResultadosTab();
        }
      });
      document.getElementById('btn-resultados-round-next')?.addEventListener('click', () => {
        if (roundIndex < availableRounds.length - 1) {
          AppState.resultadosRound = availableRounds[roundIndex + 1];
          renderResultadosTab();
        }
      });
    }, 0);
  }

  container.innerHTML = `
    <div class="resultados-header">${headerHtml}</div>
    <div class="resultados-scroll">${scrollHtml}</div>
  `;

  // Eventos de expand/collapse para partidos (directamente en cada botón)
  container.querySelectorAll('.resultados-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.dataset.matchId;
      const target = document.getElementById(`match-expand-${matchId}`);
      if (target) {
        target.classList.toggle('collapsed');
        btn.querySelector('.expand-icon').textContent = target.classList.contains('collapsed') ? '▼' : '▲';
      }
    });
  });

  // Eventos de expand/collapse para jugadores (directamente en cada botón)
  container.querySelectorAll('.resultados-player-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.playerTarget;
      const target = document.getElementById(targetId);
      if (target) {
        target.classList.toggle('collapsed');
        btn.textContent = target.classList.contains('collapsed') ? '▸' : '▾';
      }
    });
  });

  // Eventos de tabs (comunes a ambos modos)
  container.querySelectorAll('.resultados-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.resultadosTab = btn.dataset.tab;
      renderResultadosTab();
    });
  });
}

/** Renderiza la tabla de clasificación real en la pestaña de resultados */
function renderRealStandingsTable() {
  const standings = AppState.realStandings;
  if (!standings || !standings.length) {
    return '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay clasificación disponible.</div>';
  }

  // Contar partidos disputados
  const totalMatches = AppState.matches.length;
  const playedMatches = AppState.matchStats.length;
  const pct = totalMatches > 0 ? Math.round((playedMatches / totalMatches) * 100) : 0;

  let html = `
    <div class="standings-progress">
      <p class="standings-progress-text">
        Partidos disputados: <strong>${playedMatches}</strong>/${totalMatches}
      </p>
      <div class="standings-progress-bar">
        <div class="standings-progress-fill" style="width: ${pct}%"></div>
      </div>
    </div>
    <div class="standings-table-container">
      <table class="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th></th>
            <th>Equipo</th>
            <th>Pts</th>
            <th>DG</th>
            <th>GF</th>
            <th>GC</th>
            <th>PJ</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const team of standings) {
    const gdSign = team.gd > 0 ? '+' : '';
    let rowClass = '';
    if (team.position <= 8) rowClass = 'top-8';
    else if (team.position <= 24) rowClass = 'top-24';
    else rowClass = 'bottom-12';

    let gdClass = 'gd-zero';
    if (team.gd > 0) gdClass = 'gd-positive';
    else if (team.gd < 0) gdClass = 'gd-negative';

    html += `
      <tr class="${rowClass}">
        <td>${team.position}</td>
        <td><img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="standings-badge-img" alt="${team.name}" loading="lazy" onerror="this.style.display='none'"></td>
        <td><span class="standings-team-name">${team.name}</span></td>
        <td class="pts-col">${team.points}</td>
        <td class="gd-col ${gdClass}">${gdSign}${team.gd}</td>
        <td>${team.gf}</td>
        <td>${team.gc}</td>
        <td>${team.played}</td>
      </tr>
    `;
  }

  html += `
        </tbody>
      </table>
    </div>
    <div class="standings-legend">
      <span class="standings-color-item top-8">1-8: Clasificación directa</span>
      <span class="standings-color-item top-24">9-24: Playoffs</span>
      <span class="standings-color-item bottom-12">25-36: Eliminados</span>
    </div>
  `;

  return html;
}

/** Renderiza el resultado de un partido con puntos de jugadores */
function renderMatchResult({ match, homeGoals, awayGoals, hasResult }) {
  let playersHtml = '';
  const matchStats = hasResult ? AppState.matchStats.find(ms => ms.eventId === match.id) : null;

  const playersWithPoints = [];

  for (const player of AppState.players) {
    const predictions = AppState.allPredictions[player.name] || {};
    const prediction = predictions[match.id];

    let points = 0;
    let breakdown = [];

    const predHome = prediction?.home;
    const predAway = prediction?.away;
    const hasPrediction = prediction && predHome !== null && predHome !== undefined && predAway !== null && predAway !== undefined;

    if (hasResult && hasPrediction) {
      const result = calculateMatchPoints(prediction, matchStats, match);
      points = result.points;
      breakdown = result.breakdown;
    } else if (hasPrediction) {
      breakdown = [];
    } else {
      breakdown = ['Partido no pronosticado'];
    }

    let squadPoints = 0;
    let squadBreakdown = [];
    const userSquad = AppState.squadsCache?.[player.name];
    if (hasResult && userSquad && matchStats) {
      for (const squadPlayer of userSquad) {
        const jugadorData = matchStats.stats?.jugadores?.find(j => String(j.id) === String(squadPlayer.id));
        if (!jugadorData) continue;
        const { total, desglose } = calculatePlayerMatchPoints(jugadorData, squadPlayer, matchStats);
        if (total !== 0) {
          squadPoints += total;
          squadBreakdown.push({ nombre: squadPlayer.nombre, puntos: total, desglose });
        }
      }
    }

    const predStr = hasPrediction ? `${predHome} - ${predAway}` : 'S.P.';
    const totalUserPoints = points + squadPoints;

    playersWithPoints.push({ player, predStr, totalUserPoints, points, squadPoints, breakdown, squadBreakdown, hasPrediction });
  }

  // Ordenar: si hay resultado por puntos, si no alfabético
  if (hasResult) {
    playersWithPoints.sort((a, b) => b.totalUserPoints - a.totalUserPoints);
  } else {
    playersWithPoints.sort((a, b) => a.player.name.localeCompare(b.player.name));
  }

  playersWithPoints.forEach((p, pIdx) => {
    const hasSquad = hasResult && p.squadBreakdown.length > 0;
    const hasBreakdown = hasResult && p.breakdown.length > 0;
    const playerTargetId = `player-squad-${match.id}-${pIdx}`;

    const isCurrentUser = AppState.currentUser && p.player.name === AppState.currentUser.name;

    playersHtml += `
      <div class="resultados-player ${hasResult ? (p.totalUserPoints > 0 ? 'has-points' : 'no-points') : 'no-result'} ${isCurrentUser ? 'is-current-user' : ''}">
        <span class="resultados-player-name">${p.player.avatar} ${p.player.name}${isCurrentUser ? ' <span class="current-user-tag">(Tú)</span>' : ''}</span>
        <span class="resultados-player-pred">${p.predStr}</span>
        ${hasResult ? `<span class="resultados-player-points">${p.totalUserPoints} pts</span>` : ''}
        ${hasResult ? `<button class="resultados-player-expand-btn" data-player-target="${playerTargetId}">▸</button>` : ''}
      </div>
    `;

    if (hasResult) {
      playersHtml += `<div class="resultados-squad-breakdown collapsed" id="${playerTargetId}">`;
      if (hasBreakdown) {
        playersHtml += `<div class="resultados-breakdown-section">${p.breakdown.join(' · ')}</div>`;
      }
      if (hasSquad) {
        for (const sb of p.squadBreakdown) {
          const conceptos = sb.desglose.map(d => d.concepto).join(', ');
          playersHtml += `
            <div class="resultados-squad-item">
              <span class="resultados-squad-name">${sb.nombre}</span>
              <span class="resultados-squad-pts ${sb.puntos >= 0 ? 'positive' : 'negative'}">${sb.puntos > 0 ? '+' : ''}${sb.puntos} pts</span>
              <span class="resultados-squad-conceptos">${conceptos}</span>
            </div>
          `;
        }
      }
      playersHtml += '</div>';
    }
  });

  const scoreDisplay = hasResult ? `
    <span class="resultados-goals">${homeGoals}</span>
    <span class="resultados-separator">-</span>
    <span class="resultados-goals">${awayGoals}</span>
  ` : `
    <span class="resultados-goals pending">-</span>
    <span class="resultados-separator">-</span>
    <span class="resultados-goals pending">-</span>
  `;

  return `
    <div class="resultados-match ${!hasResult ? 'no-result' : ''}">
      <div class="resultados-match-header">
        <div class="resultados-team">
          ${teamImgTag(match.homeTeamId, match.homeBadgeExt, match.homeTeam, 'resultados-badge')}
          <span class="resultados-team-name">${match.homeTeam}</span>
        </div>
        <div class="resultados-score">
          ${scoreDisplay}
        </div>
        <div class="resultados-team">
          ${teamImgTag(match.awayTeamId, match.awayBadgeExt, match.awayTeam, 'resultados-badge')}
          <span class="resultados-team-name">${match.awayTeam}</span>
        </div>
      </div>
      <div class="resultados-match-date">${match.fecha}</div>
      <button class="resultados-expand-btn" data-match-id="${match.id}">
        ${hasResult ? 'Ver puntuaciones' : 'Ver pronósticos'} <span class="expand-icon">▼</span>
      </button>
      <div class="resultados-players collapsed" id="match-expand-${match.id}">
        <div class="resultados-players-title">${hasResult ? 'Puntos por jugador:' : 'Pronósticos de jugadores:'}</div>
        ${playersHtml}
      </div>
    </div>
  `;
}

// ============================================================
// AUTENTICACION Y FLUJO DE REGISTRO
// ============================================================

function checkAuthStatus() {
  const token = localStorage.getItem('session_token');
  const savedUser = localStorage.getItem('porra_ucl_user');
  const authOverlay = document.getElementById('auth-overlay');

  if (token && savedUser) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        AppState.currentUser = JSON.parse(savedUser);
        AppState.sessionToken = token;
        AppState.predictionsConfirmed = AppState.currentUser?.predictionsConfirmed || false;
        enterApp();
        return;
      }
    } catch (e) {
      localStorage.removeItem('session_token');
      localStorage.removeItem('porra_ucl_user');
    }
  }

  AppState.currentUser = null;
  AppState.sessionToken = null;
  if (authOverlay) {
    authOverlay.style.display = 'flex';
    setupAuthFlow();
    goToAuthStep(1);
  }
}

function setupAuthFlow() {
  const form = document.getElementById('auth-form');
  const toggleBtn = document.getElementById('btn-toggle-auth');
  const invitationGroup = document.getElementById('invitation-group');
  const formTitle = document.getElementById('auth-form-title');
  const submitBtn = document.getElementById('btn-auth-submit');

  form?.addEventListener('submit', handleAuthSubmit);

  toggleBtn?.addEventListener('click', () => {
    AppState.isRegisterMode = !AppState.isRegisterMode;
    document.getElementById('auth-error-msg').classList.remove('show');

    if (AppState.isRegisterMode) {
      formTitle.textContent = 'Registrarse';
      submitBtn.textContent = 'Registrarse';
      invitationGroup.style.display = 'flex';
      toggleBtn.textContent = '¿Ya tienes cuenta? Inicia sesión';
    } else {
      formTitle.textContent = 'Iniciar Sesión';
      submitBtn.textContent = 'Entrar';
      invitationGroup.style.display = 'none';
      toggleBtn.textContent = '¿No tienes cuenta? Regístrate';
    }
  });

  document.getElementById('btn-complete-register')?.addEventListener('click', completeProfile);

  // Capturar código de invitación de URL
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('invitation');
  if (codeFromUrl) {
    const invInput = document.getElementById('input-invitation');
    if (invInput) {
      invInput.value = codeFromUrl;
      AppState.isRegisterMode = true;
      formTitle.textContent = 'Registrarse';
      submitBtn.textContent = 'Registrarse';
      invitationGroup.style.display = 'flex';
      toggleBtn.textContent = '¿Ya tienes cuenta? Inicia sesión';
    }
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('auth-error-msg');
  errorEl.classList.remove('show');

  const username = document.getElementById('input-username').value.trim();
  const password = document.getElementById('input-password').value;
  const invitationCode = document.getElementById('input-invitation').value.trim();

  if (!username || !password) {
    showAuthError('Introduce usuario y contraseña', errorEl);
    return;
  }

  if (AppState.isRegisterMode) {
    if (!invitationCode) {
      showAuthError('Introduce el código de invitación', errorEl);
      return;
    }

    if (!/^[0-9A-Fa-f]{6}$/.test(invitationCode)) {
      showAuthError('El código debe tener 6 caracteres (0-9, A-F)', errorEl);
      return;
    }

    try {
      const res = await fetchWithPhase(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, invitationCode })
      });
      const data = await res.json();

      if (!data.ok) {
        showAuthError(data.error, errorEl);
        return;
      }

      localStorage.setItem('session_token', data.token);
      AppState.sessionToken = data.token;
      AppState.currentUser = data.user;

      goToAuthStep(2);
    } catch (err) {
      showAuthError('Error de conexión con el servidor', errorEl);
    }
  } else {
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!data.ok) {
        showAuthError(data.error, errorEl);
        return;
      }

      localStorage.setItem('session_token', data.token);
      AppState.sessionToken = data.token;

      if (data.user && data.user.avatar) {
        AppState.predictionsConfirmed = data.user?.predictionsConfirmed || false;
        const user = {
          username: data.user.username,
          name: data.user.username,
          avatar: data.user.avatar,
          points: 0,
          hits: 0,
          predictionsConfirmed: AppState.predictionsConfirmed,
        };
        localStorage.setItem('porra_ucl_user', JSON.stringify(user));
        AppState.currentUser = user;

        enterApp();
        showToast(`Bienvenido de nuevo, ${user.name}!`);
      } else {
        AppState.currentUser = { username: data.user.username };
        goToAuthStep(2);
      }
    } catch (err) {
      showAuthError('Error de conexión con el servidor', errorEl);
    }
  }
}

async function completeProfile() {
  const user = {
    ...AppState.currentUser,
    name: AppState.currentUser.username,
    avatar: AppState.selectedAvatar,
    points: 0,
    hits: 0,
  };

  try {
    await fetchWithPhase(`${API_BASE}/api/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        avatar: AppState.selectedAvatar
      })
    });
  } catch (err) {
    console.error('Error guardando avatar en backend:', err);
  }

  localStorage.setItem('porra_ucl_user', JSON.stringify(user));
  AppState.currentUser = user;

  enterApp();
  showToast(`¡Bienvenido, ${user.name}!`);
}

function goToAuthStep(step) {
  document.querySelectorAll('.auth-step').forEach(el => el.style.display = 'none');
  const el = document.getElementById(`auth-step-${step}`);
  if (el) el.style.display = 'flex';

  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.scrollTop = 0;

  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 < step) dot.classList.add('done');
    if (i + 1 === step) dot.classList.add('active');
  });

  if (step === 2) loadAvatars();
}

function showAuthError(msg, el) {
  el.innerText = msg;
  el.classList.add('show');
}

// ============================================================
// ENTRAR A LA APP (tras login/registro)
// ============================================================
async function enterApp() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';

  updateUserHeader();
  setupHeaderClick();
  fetchPlayers();
  await fetchPredictionsFromBackend();
  fetchSquadFromBackend();
  fetchMatchStats();
  fetchAllPredictions();
  fetchFinalPredictionsFromBackend();
  startMatchStatsPolling();
  navigateToTab('inicio');
}

// ============================================================
// ADMIN PANEL
// ============================================================

async function checkAdminStatus() {
  const token = localStorage.getItem('session_token');
  if (!token || !AppState.currentUser) return false;

  try {
    const response = await fetchWithPhase(`${API_BASE}/api/auth/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    return data.isAdmin === true;
  } catch (error) {
    console.error('Error verificando admin:', error);
    return false;
  }
}

function showAdminModal() {
  const fase = getFaseJuego();

  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-modal-content" style="max-width: 400px;">
      <button class="profile-modal-close" id="close-admin-modal">&times;</button>
      <div style="font-size: 2rem; margin-bottom: 8px;">⚙️</div>
      <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 4px;">Panel de Administración</h2>
      <span class="admin-badge" style="background: rgba(102,126,234,0.2); color: #667eea; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;">ADMIN</span>

      <div style="width: 100%; margin-top: 20px; text-align: left;">
        <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 8px;">Fase Actual:</label>
        <div style="display: flex; gap: 10px;">
          <select id="admin-phase-select" style="flex: 1; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--ucl-border); background: var(--ucl-surface); color: var(--text-primary); font-size: 14px;">
            <option value="FASE_PRETEMPORADA" ${fase === 'FASE_PRETEMPORADA' ? 'selected' : ''}>FASE_PRETEMPORADA</option>
            <option value="FASE_LIGA" ${fase === 'FASE_LIGA' ? 'selected' : ''}>FASE_LIGA</option>
            <option value="FASE_PRE16" ${fase === 'FASE_PRE16' ? 'selected' : ''}>FASE_PRE16</option>
          </select>
        </div>
      </div>

      <div style="width: 100%; margin-top: 16px; background: var(--ucl-surface); padding: 12px; border-radius: var(--radius-md);">
        <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Fase actual: <strong style="color: var(--text-primary);">${fase}</strong></p>
      </div>

      <button id="btn-admin-change-phase" class="btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; margin-top: 16px; width: 100%;">
        Cambiar Fase
      </button>

      <button id="btn-manage-invitations" class="btn-primary" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; margin-top: 8px; width: 100%;">
        Gestionar Códigos de Invitación
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-admin-modal');
  const changePhaseBtn = modal.querySelector('#btn-admin-change-phase');
  const manageInvitationsBtn = modal.querySelector('#btn-manage-invitations');

  closeBtn.addEventListener('click', () => modal.remove());
  changePhaseBtn.addEventListener('click', () => {
    const select = modal.querySelector('#admin-phase-select');
    const targetPhase = select.value;
    const currentPhase = getFaseJuego();

    if (targetPhase === currentPhase) {
      showToast('Ya estás en esta fase');
      return;
    }

    modal.remove();
    showPhaseConfirmModal(targetPhase);
  });

  if (manageInvitationsBtn) {
    manageInvitationsBtn.addEventListener('click', () => {
      modal.remove();
      showInvitationCodesModal();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function showInvitationCodesModal() {
  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-modal-content" style="max-width: 400px; max-height: 80vh; overflow-y: auto;">
      <button class="profile-modal-close" id="close-invitations-modal">&times;</button>
      <h2 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 4px;">Códigos de Invitación</h2>
      <span class="ucl-tag" style="margin-bottom: 16px;">Gestión de códigos</span>

      <div style="display: flex; gap: 8px; margin-bottom: 16px; width: 100%;">
        <button id="tab-available" class="btn-tab active" style="flex: 1;">Disponibles</button>
        <button id="tab-used" class="btn-tab" style="flex: 1;">Usados</button>
      </div>

      <button id="btn-create-code" class="btn-primary" style="background: var(--accent-green, #10B981); color: #fff; width: 100%; margin-bottom: 12px;">
        + Nuevo Código
      </button>

      <div id="invitations-list" style="width: 100%;">
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">Cargando...</div>
      </div>

      <div id="invitations-count" style="width: 100%; text-align: center; margin-top: 12px; font-size: 12px; color: var(--text-muted);"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-invitations-modal');
  const tabAvailable = modal.querySelector('#tab-available');
  const tabUsed = modal.querySelector('#tab-used');
  const createBtn = modal.querySelector('#btn-create-code');

  let currentTab = 'available';
  let invitations = [];

  closeBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  tabAvailable.addEventListener('click', () => {
    currentTab = 'available';
    tabAvailable.classList.add('active');
    tabUsed.classList.remove('active');
    renderInvitationsList();
  });

  tabUsed.addEventListener('click', () => {
    currentTab = 'used';
    tabUsed.classList.add('active');
    tabAvailable.classList.remove('active');
    renderInvitationsList();
  });

  createBtn.addEventListener('click', async () => {
    await createInvitationCode();
    await loadInvitations();
  });

  async function loadInvitations() {
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/invitations`, {
        headers: authHeaders()
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (data.ok) {
        invitations = data.invitations;
        renderInvitationsList();
      } else {
        showToast('Error al cargar códigos');
      }
    } catch (e) {
      console.error('Error cargando invitaciones:', e);
      showToast('Error de conexión');
    }
  }

  function renderInvitationsList() {
    const list = modal.querySelector('#invitations-list');
    const count = modal.querySelector('#invitations-count');

    const filtered = currentTab === 'available'
      ? invitations.filter(inv => inv.usedBy === null)
      : invitations.filter(inv => inv.usedBy !== null);

    if (filtered.length === 0) {
      list.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No hay códigos ${currentTab === 'available' ? 'disponibles' : 'usados'}</div>`;
      count.textContent = `Total: 0 códigos`;
      return;
    }

    list.innerHTML = filtered.map(inv => `
      <div style="background: var(--ucl-surface); padding: 12px; border-radius: var(--radius-md); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-family: monospace; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${inv.code}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            ${currentTab === 'available'
              ? `Creado: ${new Date(inv.createdAt).toLocaleDateString('es-ES')}`
              : `Usado por: ${inv.usedBy}`
            }
          </div>
        </div>
        ${currentTab === 'available' ? `<button onclick="deleteInvitationCode('${inv.code}')" style="background: rgba(239,68,68,0.2); border: none; color: #ef4444; padding: 8px; border-radius: 8px; cursor: pointer;">🗑️</button>` : ''}
      </div>
    `).join('');

    count.textContent = `Total: ${filtered.length} códigos`;
  }

  async function createInvitationCode() {
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (data.ok) {
        showToast(`Código creado: ${data.invitation.code}`);
      } else {
        showToast('Error al crear código');
      }
    } catch (e) {
      console.error('Error creando invitación:', e);
      showToast('Error de conexión');
    }
  }

  window.deleteInvitationCode = async function(code) {
    if (!confirm(`¿Eliminar el código ${code}?`)) return;
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/invitations/${code}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (data.ok) {
        showToast(`Código ${code} eliminado`);
        await loadInvitations();
      } else {
        showToast(data.error || 'Error al eliminar código');
      }
    } catch (e) {
      console.error('Error eliminando invitación:', e);
      showToast('Error de conexión');
    }
  };

  loadInvitations();
}

function showPhaseConfirmModal(targetPhase) {
  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-modal-content" style="max-width: 400px;">
      <button class="profile-modal-close" id="close-confirm-modal">&times;</button>
      <div style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>
      <h2 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 12px;">Cambiar Fase del Juego</h2>

      <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
        ¿Estás seguro de cambiar a <strong style="color: var(--text-primary);">${targetPhase}</strong>?
      </p>

      <div style="width: 100%; background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px;">
        <p style="font-size: 12px; color: #ffc107; margin: 0 0 8px 0; font-weight: 700;">⚠️ Advertencia:</p>
        <ul style="font-size: 12px; color: var(--text-muted); margin: 0; padding-left: 16px;">
          <li>Esto afectará a <strong>todos</strong> los usuarios</li>
          <li>Las predicciones pueden bloquearse/desbloquearse</li>
          <li>La visibilidad de datos cambiará inmediatamente</li>
        </ul>
      </div>

      <div style="display: flex; gap: 10px; width: 100%;">
        <button id="btn-cancel-phase" class="btn-primary" style="flex: 1; background: var(--ucl-surface); color: var(--text-primary);">Cancelar</button>
        <button id="btn-confirm-phase" class="btn-primary" style="flex: 1; background: rgba(239,68,68,0.8); color: #fff;">Confirmar Cambio</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-confirm-modal');
  const cancelBtn = modal.querySelector('#btn-cancel-phase');
  const confirmBtn = modal.querySelector('#btn-confirm-phase');

  closeBtn.addEventListener('click', () => modal.remove());
  cancelBtn.addEventListener('click', () => modal.remove());
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Cambiando...';

    const token = localStorage.getItem('session_token');
    if (!token) {
      showToast('No estás autenticado');
      modal.remove();
      return;
    }

    try {
      const response = await fetchWithPhase(`${API_BASE}/api/admin/fase-juego`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ faseJuego: targetPhase })
      });

      const data = await response.json();

      if (data.ok) {
        showToast(`Fase cambiada a ${targetPhase}`);
        modal.remove();

        try {
          const configRes = await fetchWithPhase(`${API_BASE}/api/config?t=${Date.now()}`);
          const configData = await configRes.json();
          if (configData.ok) AppState.appConfig = configData.config;
        } catch (e) {
          AppState.appConfig.faseJuego = targetPhase;
        }

        const activeTab = document.querySelector('.nav-item.active')?.dataset?.tab || 'inicio';
        if (activeTab === 'inicio') renderInicioTab();
        else if (activeTab === 'clasificacion') renderClasificacionTab();
        else if (activeTab === 'resultados') renderResultadosTab();
        else if (activeTab === 'pronosticos') renderPronosticosTab();
        else if (activeTab === 'plantilla') renderPlantillaTab();
      } else {
        showToast(`Error: ${data.error}`);
        modal.remove();
      }
    } catch (error) {
      console.error('Error cambiando fase:', error);
      showToast('Error al cambiar fase');
      modal.remove();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function navigateToTab(tabName) {
  // Si hay cambios sin guardar en pronosticos, mostrar aviso
  if (AppState.hasUnsavedChanges && tabName !== 'pronosticos') {
    showUnsavedChangesModal(tabName);
    return;
  }

  // Si hay cambios sin guardar en plantilla, mostrar aviso
  if (AppState.hasUnsavedSquadChanges && tabName !== 'plantilla') {
    showUnsavedSquadChangesModal(tabName);
    return;
  }

  // Si hay cambios sin guardar en fase final, mostrar aviso
  if (AppState.hasUnsavedFinalChanges && tabName !== 'final-predictions') {
    showUnsavedFinalChangesModal(tabName);
    return;
  }

  if (tabName === 'final-predictions' && !AppState.predictionsConfirmed) {
    showToast('Debes confirmar tus pronósticos de liga primero');
    return;
  }

  // Resetear ronda de resultados al salir de la pestaña
  if (tabName !== 'resultados') {
    AppState.resultadosRound = null;
  }

  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.tab-page');

  navItems.forEach(n => n.classList.remove('active'));
  pages.forEach(p => p.classList.remove('active'));

  const activeNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  const activePage = document.getElementById(`tab-${tabName}`);
  if (activeNav) activeNav.classList.add('active');
  if (activePage) activePage.classList.add('active');

  const appContent = document.querySelector('.app-content');
  if (appContent) appContent.classList.toggle('no-scroll', tabName === 'pronosticos');

  if (tabName === 'inicio') renderInicioTab();
  if (tabName === 'clasificacion') renderClasificacionTab();
  if (tabName === 'resultados') renderResultadosTab();
  if (tabName === 'pronosticos') renderPronosticosTab();
  if (tabName === 'final-predictions') renderFinalPredictionsTab();
  if (tabName === 'plantilla') renderPlantillaTab();
}

// ============================================================
// TAB: INICIO
// ============================================================

/** Muestra modal de aviso cuando hay cambios sin guardar */
function showUnsavedChangesModal(targetTab) {
  const existing = document.querySelector('.unsaved-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'unsaved-modal-overlay';
  overlay.innerHTML = `
    <div class="unsaved-modal">
      <div class="unsaved-modal-icon">⚠️</div>
      <h3 class="unsaved-modal-title">Cambios sin guardar</h3>
      <p class="unsaved-modal-text">Tienes predicciones modificadas que no se han guardado en el servidor. Si sales, se perderán.</p>
      <div class="unsaved-modal-actions">
        <button class="unsaved-modal-btn unsaved-modal-btn-save" id="modal-save-exit">Guardar y salir</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-discard" id="modal-discard-exit">Salir sin guardar</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-cancel" id="modal-cancel">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#modal-save-exit').addEventListener('click', async () => {
    overlay.remove();
    await savePredictionsToBackend();
    forceNavigateToTab(targetTab);
  });

  overlay.querySelector('#modal-discard-exit').addEventListener('click', () => {
    overlay.remove();
    AppState.hasUnsavedChanges = false;
    localStorage.removeItem('porra_ucl_scores');
    forceNavigateToTab(targetTab);
  });

  overlay.querySelector('#modal-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/** Modal de aviso cuando hay cambios sin guardar en plantilla */
function showUnsavedSquadChangesModal(targetTab) {
  const existing = document.querySelector('.unsaved-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'unsaved-modal-overlay';
  overlay.innerHTML = `
    <div class="unsaved-modal">
      <div class="unsaved-modal-icon">⚠️</div>
      <h3 class="unsaved-modal-title">Plantilla sin guardar</h3>
      <p class="unsaved-modal-text">Has modificado tu plantilla pero no la has guardado en el servidor. Si sales, los cambios se perderán.</p>
      <div class="unsaved-modal-actions">
        <button class="unsaved-modal-btn unsaved-modal-btn-save" id="modal-save-squad">Guardar y salir</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-discard" id="modal-discard-squad">Salir sin guardar</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-cancel" id="modal-cancel-squad">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#modal-save-squad').addEventListener('click', async () => {
    overlay.remove();
    await saveSquadToBackend();
    AppState.hasUnsavedSquadChanges = false;
    forceNavigateToTab(targetTab);
  });

  overlay.querySelector('#modal-discard-squad').addEventListener('click', () => {
    overlay.remove();
    AppState.hasUnsavedSquadChanges = false;
    forceNavigateToTab(targetTab);
  });

  overlay.querySelector('#modal-cancel-squad').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/** Modal de aviso cuando hay cambios sin guardar en fase final */
function showUnsavedFinalChangesModal(targetTab) {
  const existing = document.querySelector('.unsaved-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'unsaved-modal-overlay';
  overlay.innerHTML = `
    <div class="unsaved-modal">
      <div class="unsaved-modal-icon">⚠️</div>
      <h3 class="unsaved-modal-title">Eliminatorias sin guardar</h3>
      <p class="unsaved-modal-text">Has modificado tus predicciones de eliminatorias pero no las has guardado. Si sales, los cambios se perderán.</p>
      <div class="unsaved-modal-actions">
        <button class="unsaved-modal-btn unsaved-modal-btn-save" id="modal-save-final">Guardar y salir</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-discard" id="modal-discard-final">Salir sin guardar</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-cancel" id="modal-cancel-final">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#modal-save-final').addEventListener('click', async () => {
    overlay.remove();
    await saveFinalPredictionsToBackend();
    AppState.hasUnsavedFinalChanges = false;
    forceNavigateToTab(targetTab);
  });

  overlay.querySelector('#modal-discard-final').addEventListener('click', () => {
    overlay.remove();
    AppState.hasUnsavedFinalChanges = false;
    forceNavigateToTab(targetTab);
  });

  overlay.querySelector('#modal-cancel-final').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/** Modal de logout cuando hay cambios sin guardar */
function showLogoutWithUnsavedModal() {
  const existing = document.querySelector('.unsaved-modal-overlay');
  if (existing) existing.remove();

  const hasPredictions = AppState.hasUnsavedChanges;
  const hasSquad = AppState.hasUnsavedSquadChanges;
  const text = hasPredictions && hasSquad
    ? 'Tienes predicciones y plantilla modificadas que no se han guardado. Si cierras sesion, se perderan.'
    : hasPredictions
      ? 'Tienes predicciones modificadas que no se han guardado. Si cierras sesion, se perderan.'
      : 'Tu plantilla modificada no se ha guardado. Si cierras sesion, los cambios se perderan.';

  const overlay = document.createElement('div');
  overlay.className = 'unsaved-modal-overlay';
  overlay.innerHTML = `
    <div class="unsaved-modal">
      <div class="unsaved-modal-icon">⚠️</div>
      <h3 class="unsaved-modal-title">Cambios sin guardar</h3>
      <p class="unsaved-modal-text">${text}</p>
      <div class="unsaved-modal-actions">
        <button class="unsaved-modal-btn unsaved-modal-btn-save" id="modal-save-logout">Guardar y cerrar sesion</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-discard" id="modal-discard-logout">Cerrar sesion sin guardar</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-cancel" id="modal-cancel-logout">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#modal-save-logout').addEventListener('click', async () => {
    overlay.remove();
    if (hasPredictions) await savePredictionsToBackend();
    if (hasSquad) await saveSquadToBackend();
    localStorage.removeItem('porra_ucl_user');
    localStorage.removeItem('session_token');
    AppState.currentUser = null;
    AppState.sessionToken = null;
    AppState.hasUnsavedChanges = false;
    AppState.hasUnsavedSquadChanges = false;
    stopMatchStatsPolling();
    checkAuthStatus();
    showToast('Sesion cerrada correctamente');
  });

  overlay.querySelector('#modal-discard-logout').addEventListener('click', () => {
    overlay.remove();
    localStorage.removeItem('porra_ucl_user');
    localStorage.removeItem('session_token');
    localStorage.removeItem('porra_ucl_scores');
    AppState.currentUser = null;
    AppState.sessionToken = null;
    AppState.hasUnsavedChanges = false;
    AppState.hasUnsavedSquadChanges = false;
    stopMatchStatsPolling();
    checkAuthStatus();
    showToast('Sesion cerrada correctamente');
  });

  overlay.querySelector('#modal-cancel-logout').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/** Navega a una pestaña sin comprobar cambios (uso interno) */
function forceNavigateToTab(tabName) {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.tab-page');

  navItems.forEach(n => n.classList.remove('active'));
  pages.forEach(p => p.classList.remove('active'));

  const activeNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  const activePage = document.getElementById(`tab-${tabName}`);
  if (activeNav) activeNav.classList.add('active');
  if (activePage) activePage.classList.add('active');

  const appContent = document.querySelector('.app-content');
  if (appContent) appContent.classList.toggle('no-scroll', tabName === 'pronosticos');

  if (tabName === 'inicio') renderInicioTab();
  if (tabName === 'clasificacion') renderClasificacionTab();
  if (tabName === 'resultados') renderResultadosTab();
  if (tabName === 'pronosticos') renderPronosticosTab();
  if (tabName === 'plantilla') renderPlantillaTab();
}
function renderInicioTab() {
  const container = document.getElementById('inicio-container');
  if (!container || !AppState.currentUser) return;

  const user = AppState.currentUser;
  const config = AppState.appConfig || {};
  const totalMatches = config.totalMatches || AppState.matches.length || 144;
  const squadSize = config.squadSize || 25;
  const predicted = Object.keys(AppState.scorePredictions).length;
  const pending = totalMatches - predicted;
  const squadCount = AppState.squadPicks.length;
  const squadPending = squadSize - squadCount;

  // Información de la fase de juego actual
  const fase = getFaseJuego();
  const faseInfo = {
    'FASE_PRETEMPORADA': {
      titulo: 'Pretemporada',
      descripcion: 'Estamos en pretemporada. Puedes hacer tus predicciones y plantilla.',
      icono: '📝',
      color: '#4CAF50'
    },
    'FASE_LIGA': {
      titulo: 'Fase de Liga',
      descripcion: 'La competición ha comenzado. Predicciones y plantilla bloqueadas.',
      icono: '⚽',
      color: '#FF9800'
    },
    'FASE_PRE16': {
      titulo: 'Fase de Dieciseisavos',
      descripcion: 'Fase de dieciseisavos. Predicciones bloqueadas.',
      icono: '🏆',
      color: '#F44336'
    }
  };

  const info = faseInfo[fase] || faseInfo['FASE_PRETEMPORADA'];

  const faseHtml = `
    <div class="inicio-card inicio-fase" style="border-left: 4px solid ${info.color}">
      <div class="inicio-card-icon">${info.icono}</div>
      <div class="inicio-card-content">
        <div class="inicio-card-title">${info.titulo}</div>
        <div class="inicio-card-desc">${info.descripcion}</div>
        <span class="fase-badge" style="background: ${info.color}">${fase}</span>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="inicio-welcome">
      <div class="inicio-avatar">${user.avatar}</div>
      <h2 class="inicio-greeting">Hola, ${user.name}! 👋</h2>
      <p class="inicio-subtitle">Bienvenido a la Porra UCL 2026/27</p>
    </div>

    ${faseHtml}

    ${pending > 0 ? `
      <div class="inicio-card inicio-pending" onclick="navigateToTab('pronosticos')">
        <div class="inicio-card-icon">⚽</div>
        <div class="inicio-card-content">
          <div class="inicio-card-title">${pending} partidos pendientes</div>
          <div class="inicio-card-desc">Te quedan ${pending} de ${totalMatches} partidos por pronosticar.</div>
        </div>
        <div class="inicio-card-arrow">→</div>
      </div>
    ` : `
      <div class="inicio-card inicio-done">
        <div class="inicio-card-icon">✅</div>
        <div class="inicio-card-content">
          <div class="inicio-card-title">Todos pronosticados</div>
          <div class="inicio-card-desc">Ya has predicho los ${totalMatches} partidos. ¡Buena suerte!</div>
        </div>
      </div>
    `}

    ${squadPending > 0 ? `
      <div class="inicio-card inicio-pending" onclick="navigateToTab('plantilla')">
        <div class="inicio-card-icon">🌟</div>
        <div class="inicio-card-content">
          <div class="inicio-card-title">Plantilla incompleta</div>
          <div class="inicio-card-desc">Te quedan ${squadPending} de ${squadSize} jugadores por elegir.</div>
        </div>
        <div class="inicio-card-arrow">→</div>
      </div>
    ` : `
      <div class="inicio-card inicio-done">
        <div class="inicio-card-icon">✅</div>
        <div class="inicio-card-content">
          <div class="inicio-card-title">Plantilla completa</div>
          <div class="inicio-card-desc">Ya tienes los ${squadSize} jugadores seleccionados.</div>
        </div>
      </div>
    `}
  `;
}

// ============================================================
// AVATARES DINÁMICOS
// ============================================================
const ALL_AVATARS = [
  // Fútbol
  '⚽', '🥅', '🧤', '🏟️', '🎯',
  // Deportes
  '🏆', '🥇', '🥈', '🥉', '🏅', '⚡', '🎽', '🏃', '🚴', '🏊',
  // Animales
  '🦁', '🐯', '🐺', '🦅', '🐙', '🐉', '🦄', '🐵', '🐶', '🐱', '🐼', '🦊', '🐮', '🐷',
  // Gestos/Divertidos
  '😎', '🤓', '🤡', '👽', '🤖', '😈', '🥳', '😤', '🤯', '💪', '🫡', '🫠', '🤌', '✌️', '🤘',
  // Otros
  '🔥', '⭐', '💎', '🎮', '🎸', '🌈',
];

async function loadAvatars() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;

  let taken = [];
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/avatars/taken`);
    const data = await res.json();
    if (data.ok) taken = data.taken || [];
  } catch (e) {
    // Si falla, mostramos todos
  }

  const takenSet = new Set(taken);
  const available = ALL_AVATARS.filter(a => !takenSet.has(a));

  if (available.length === 0) {
    grid.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Todos los avatares están ocupados. Contacta con el admin.</p>';
    return;
  }

  // Si el avatar seleccionado ya no está disponible, resetear al primero
  if (takenSet.has(AppState.selectedAvatar)) {
    AppState.selectedAvatar = available[0];
  }

  grid.innerHTML = available.map((a, i) =>
    `<div class="avatar-option${i === 0 ? ' selected' : ''}" data-avatar="${a}">${a}</div>`
  ).join('');

  // Re-asignar event listeners
  grid.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      grid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      AppState.selectedAvatar = opt.getAttribute('data-avatar');
    });
  });
}

// ============================================================
// JUGADORES (para Clasificación)
// ============================================================
async function fetchPlayers() {
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/players`);
    const data = await res.json();
    if (data.ok) AppState.players = data.players || [];
  } catch (e) {
    AppState.players = [];
  }
}

// ============================================================
// HEADER — Click para Perfil
// ============================================================
function setupHeaderClick() {
  const pill = document.getElementById('user-status-pill');
  if (pill) {
    pill.addEventListener('click', () => {
      showProfileModal();
    });
  }
}

function showProfileModal() {
  if (!AppState.currentUser) return;

  const user = AppState.currentUser;
  const squad = AppState.squadPicks;
  const saved = Object.keys(AppState.scorePredictions).length;

  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-modal-content">
      <button class="profile-modal-close" id="close-profile-modal">&times;</button>
      <div style="font-size: 3.5rem;">${user.avatar}</div>
      <h2 style="font-size: 1.4rem; font-weight: 800;">${user.name}</h2>
      <span class="ucl-tag">Usuario: ${user.username}</span>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; width: 100%;">
        <div style="background: var(--ucl-surface); padding: 12px 8px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-primary);">${saved}</div>
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">PARTIDOS</div>
        </div>
        <div style="background: var(--ucl-surface); padding: 12px 8px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-cyan);">${squad.length}/${SQUAD_SIZE}</div>
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">PLANTILLA</div>
        </div>
      </div>

      <button id="btn-change-password" class="btn-primary" style="background: var(--accent-primary); color: #fff; margin-top: 12px; width: 100%;">
        Cambiar Contraseña
      </button>

      <button id="btn-admin-panel" class="btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; margin-top: 8px; width: 100%; display: none;">
        Panel de Administración
      </button>

      <button id="btn-logout" class="btn-primary" style="background: rgba(239,68,68,0.8); color: #fff; margin-top: 8px; width: 100%;">
        Cerrar Sesión
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-profile-modal');
  const logoutBtn = modal.querySelector('#btn-logout');
  const changePasswordBtn = modal.querySelector('#btn-change-password');
  const adminBtn = modal.querySelector('#btn-admin-panel');

  // Show admin button if user is admin
  checkAdminStatus().then(isAdmin => {
    if (isAdmin && adminBtn) {
      adminBtn.style.display = 'block';
    }
  });

  closeBtn.addEventListener('click', () => modal.remove());
  changePasswordBtn.addEventListener('click', () => {
    modal.remove();
    showChangePasswordModal();
  });
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      modal.remove();
      showAdminModal();
    });
  }
  logoutBtn.addEventListener('click', () => {
    if (AppState.hasUnsavedChanges || AppState.hasUnsavedSquadChanges) {
      modal.remove();
      showLogoutWithUnsavedModal();
      return;
    }
    localStorage.removeItem('porra_ucl_user');
    localStorage.removeItem('session_token');
    localStorage.removeItem('porra_ucl_scores');
    AppState.currentUser = null;
    AppState.sessionToken = null;
    AppState.hasUnsavedChanges = false;
    stopMatchStatsPolling();
    modal.remove();
    checkAuthStatus();
    showToast('Sesion cerrada correctamente');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function showChangePasswordModal() {
  if (!AppState.currentUser) return;

  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-modal-content">
      <button class="profile-modal-close" id="close-change-password-modal">&times;</button>
      <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 16px;">Cambiar Contraseña</h2>

      <form id="change-password-form" style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
        <div style="width: 100%; text-align: left;">
          <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Contraseña actual</label>
          <input type="password" id="current-password" placeholder="Tu contraseña actual" required
            style="width: 100%; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--ucl-border);
            background: var(--ucl-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>

        <div style="width: 100%; text-align: left;">
          <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Nueva contraseña</label>
          <input type="password" id="new-password" placeholder="Mínimo 6 caracteres" required minlength="6"
            style="width: 100%; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--ucl-border);
            background: var(--ucl-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>

        <div style="width: 100%; text-align: left;">
          <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 4px;">Confirmar nueva contraseña</label>
          <input type="password" id="confirm-new-password" placeholder="Repite la nueva contraseña" required minlength="6"
            style="width: 100%; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--ucl-border);
            background: var(--ucl-surface); color: var(--text-primary); font-size: 14px; box-sizing: border-box;">
        </div>

        <div id="change-password-error" style="color: #ef4444; font-size: 12px; display: none;"></div>

        <button type="submit" class="btn-primary" style="background: var(--accent-primary); color: #fff; width: 100%; margin-top: 4px;">
          Guardar Contraseña
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-change-password-modal');
  const form = modal.querySelector('#change-password-form');
  const errorDiv = modal.querySelector('#change-password-error');

  closeBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = modal.querySelector('#current-password').value;
    const newPassword = modal.querySelector('#new-password').value;
    const confirmPassword = modal.querySelector('#confirm-new-password').value;

    if (newPassword !== confirmPassword) {
      errorDiv.textContent = 'Las contraseñas no coinciden';
      errorDiv.style.display = 'block';
      return;
    }

    if (newPassword.length < 6) {
      errorDiv.textContent = 'La nueva contraseña debe tener al menos 6 caracteres';
      errorDiv.style.display = 'block';
      return;
    }

    try {
      const res = await fetchWithPhase(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();

      if (data.ok) {
        modal.remove();
        showToast('Contraseña actualizada correctamente');
      } else {
        errorDiv.textContent = data.error || 'Error al cambiar la contraseña';
        errorDiv.style.display = 'block';
      }
    } catch (err) {
      errorDiv.textContent = 'Error de conexión con el servidor';
      errorDiv.style.display = 'block';
    }
  });
}

// ============================================================
// HEADER — Indicador de Usuario
// ============================================================
function updateUserHeader() {
  const pill = document.getElementById('user-status-pill');
  const avatar = document.getElementById('user-header-avatar');
  const name = document.getElementById('user-header-name');

  if (AppState.currentUser) {
    if (avatar) avatar.textContent = AppState.currentUser.avatar;
    if (name) name.textContent = AppState.currentUser.name;
    if (pill) pill.style.display = 'flex';
  } else {
    if (pill) pill.style.display = 'none';
  }
}

// ============================================================
// TAB: PRONÓSTICOS
// ============================================================

/** Cuenta predicciones completas (home y away son números) */
function countPredicted() {
  let count = 0;
  for (const id of Object.keys(AppState.scorePredictions)) {
    const p = AppState.scorePredictions[id];
    if (typeof p.home === 'number' && typeof p.away === 'number') count++;
  }
  return count;
}

/** Cuenta predicciones completas de una ronda */
function countPredictedInRound(round) {
  const roundMatches = AppState.matches.filter(m => m.ronda === round);
  let count = 0;
  for (const m of roundMatches) {
    const p = AppState.scorePredictions[m.id];
    if (p && typeof p.home === 'number' && typeof p.away === 'number') count++;
  }
  return count;
}

function renderPronosticosTab() {
  const container = document.getElementById('pronosticos-container');
  if (!container || !AppState.matches.length) return;

  AppState.currentRound = 1;

  const total = AppState.matches.length;
  const predicted = countPredicted();
  const pct = Math.round((predicted / total) * 100);
  const frozen = isFaseLiga();

  container.innerHTML = `
    <div class="pronosticos-top-fixed">
      ${frozen ? '<div style="background:rgba(239,68,68,0.15);color:#ef4444;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;text-align:center;">🔒 Pronósticos bloqueados — la competición ha comenzado</div>' : ''}
      <div class="pronosticos-actions-row">
        <button class="save-predictions-btn" id="btn-save-predictions" disabled ${frozen || AppState.predictionsConfirmed ? 'style="opacity:0.5;pointer-events:none"' : ''}>💾 Guardar</button>
        <button class="confirm-predictions-btn" id="btn-confirm-predictions" ${frozen || AppState.predictionsConfirmed || predicted < total ? 'disabled' : ''}>✅ Confirmar</button>
        <button class="standings-btn" id="btn-show-standings" onclick="showPredictedStandings()">📊 Clasificación</button>
        ${AppState.predictionsConfirmed ? '<button class="standings-btn" id="btn-show-final" onclick="navigateToTab(\'final-predictions\')" style="background: linear-gradient(135deg, #8B5CF6, #EC4899);">🏆 Eliminatorias</button>' : ''}
      </div>
      <div class="wizard-progress-bar">
        <div class="wizard-progress-fill" style="width: ${pct}%"></div>
      </div>
      <p class="wizard-progress-text">
        <strong>${predicted}</strong> de <strong>${total}</strong> partidos pronosticados
      </p>
      <div class="round-nav">
        <button class="round-nav-btn" id="btn-round-prev" disabled>&larr; Ronda anterior</button>
        <span class="round-indicator" id="round-indicator">Ronda 1 de 8</span>
        <button class="round-nav-btn" id="btn-round-next">Siguiente ronda &rarr;</button>
      </div>
      <div class="round-progress-text" id="round-progress-text"></div>
    </div>

    <div id="round-matches-container" class="round-matches-scroll"></div>
  `;

  renderRoundMatches();
  setupRoundNavigation();
  setupSaveButton();

  const confirmBtn = document.getElementById('btn-confirm-predictions');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => confirmPredictions());
  }

  // Delegacion de eventos para botones +/- (una sola vez)
  const matchesContainer = document.getElementById('round-matches-container');
  if (matchesContainer) {
    matchesContainer.removeEventListener('click', handleGoalButtonClick);
    matchesContainer.addEventListener('click', handleGoalButtonClick);
  }
}

function renderRoundMatches() {
  const container = document.getElementById('round-matches-container');
  if (!container) return;

  const round = AppState.currentRound;
  const roundMatches = AppState.matches.filter(m => m.ronda === round);

  // Actualizar indicadores
  const indicator = document.getElementById('round-indicator');
  if (indicator) indicator.textContent = `Ronda ${round} de 8`;

  const roundPredicted = countPredictedInRound(round);
  const roundTotal = roundMatches.length;
  const roundPct = Math.round((roundPredicted / roundTotal) * 100);

  const roundProgressEl = document.getElementById('round-progress-text');
  if (roundProgressEl) {
    roundProgressEl.innerHTML = `Ronda ${round}: <strong>${roundPredicted}</strong> de <strong>${roundTotal}</strong> pronosticados`;
  }

  // Actualizar barra de progreso global
  const totalPredicted = countPredicted();
  const totalMatches = AppState.matches.length;
  const globalPct = Math.round((totalPredicted / totalMatches) * 100);
  const progressFill = document.querySelector('.wizard-progress-fill');
  const progressText = document.querySelector('.pronosticos-header .wizard-progress-text');
  if (progressFill) progressFill.style.width = `${globalPct}%`;
  if (progressText) {
    progressText.innerHTML = `<strong>${totalPredicted}</strong> de <strong>${totalMatches}</strong> partidos pronosticados`;
  }

  // Botones prev/next de ronda
  const prevBtn = document.getElementById('btn-round-prev');
  const nextBtn = document.getElementById('btn-round-next');
  if (prevBtn) prevBtn.disabled = round <= 1;
  if (nextBtn) nextBtn.disabled = round >= 8;

  container.innerHTML = roundMatches.map(match => {
    const pred = AppState.scorePredictions[match.id];
    const homeDisplay = (pred && typeof pred.home === 'number') ? pred.home : '-';
    const awayDisplay = (pred && typeof pred.away === 'number') ? pred.away : '-';
    const isComplete = pred && typeof pred.home === 'number' && typeof pred.away === 'number';
    const cardClass = isComplete
      ? 'match-card-round match-card-round-done'
      : 'match-card-round match-card-round-pending';
    const checkIcon = isComplete
      ? '<span class="match-done-check">✓</span>'
      : '';

    return `
      <div class="${cardClass}" data-match-id="${match.id}">
        <p class="match-card-round-date">${match.fecha}${checkIcon}</p>
        <div class="match-card-round-teams">
          <div class="match-card-round-team">
            <div class="match-card-round-badge">
              ${teamImgTag(match.homeTeamId, match.homeBadgeExt, match.homeTeam, 'match-card-round-img')}
            </div>
            <span class="match-card-round-name">${match.homeTeam}</span>
          </div>

          <div class="match-card-round-controls">
            <div class="match-card-round-score">
              <button class="goals-btn-round goals-btn-round-plus" data-side="home" data-match="${match.id}" aria-label="Anadir gol local">+</button>
              <span class="goals-value-round" id="home-${match.id}">${homeDisplay}</span>
              <button class="goals-btn-round goals-btn-round-minus" data-side="home" data-match="${match.id}" aria-label="Restar gol local">&minus;</button>
            </div>
            <span class="match-card-round-vs">VS</span>
            <div class="match-card-round-score">
              <button class="goals-btn-round goals-btn-round-plus" data-side="away" data-match="${match.id}" aria-label="Anadir gol visitante">+</button>
              <span class="goals-value-round" id="away-${match.id}">${awayDisplay}</span>
              <button class="goals-btn-round goals-btn-round-minus" data-side="away" data-match="${match.id}" aria-label="Restar gol visitante">&minus;</button>
            </div>
          </div>

          <div class="match-card-round-team">
            <div class="match-card-round-badge">
              ${teamImgTag(match.awayTeamId, match.awayBadgeExt, match.awayTeam, 'match-card-round-img')}
            </div>
            <span class="match-card-round-name">${match.awayTeam}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleGoalButtonClick(e) {
  if (isFaseLiga()) {
    showToast('Los pronósticos están bloqueados<br>la competición ha comenzado');
    return;
  }
  const btn = e.target.closest('.goals-btn-round');
  if (!btn) return;

  const matchId = btn.getAttribute('data-match');
  const side = btn.getAttribute('data-side');
  const isPlus = btn.classList.contains('goals-btn-round-plus');

  const pred = AppState.scorePredictions[matchId] || { home: null, away: null };
  let value = pred[side];

  if (isPlus) {
    // Primera vez que pulsa +: si es null, poner 0
    value = (value === null) ? 0 : value + 1;
  } else {
    // Primera vez que pulsa -: si es null, no hacer nada
    if (value === null) return;
    if (value > 0) value--;
  }

  pred[side] = value;
  AppState.scorePredictions[matchId] = pred;

  // Actualizar display
  const el = document.getElementById(`${side}-${matchId}`);
  if (el) el.textContent = value;

  // Actualizar clase de la tarjeta (verde si falta algun marcador)
  const card = document.querySelector(`.match-card-round[data-match-id="${matchId}"]`);
  if (card) {
    const bothNumbers = typeof pred.home === 'number' && typeof pred.away === 'number';
    card.classList.toggle('match-card-round-pending', !bothNumbers);
  }

  // Guardar en localStorage y marcar cambios
  localStorage.setItem('porra_ucl_scores', JSON.stringify(AppState.scorePredictions));
  AppState.hasUnsavedChanges = true;

  // Actualizar boton guardar
  updateSaveButton();

  // Actualizar contadores de ronda y global
  updateProgressCounts();
}

function updateProgressCounts() {
  const round = AppState.currentRound;
  const roundPredicted = countPredictedInRound(round);
  const roundMatches = AppState.matches.filter(m => m.ronda === round);
  const roundTotal = roundMatches.length;

  const roundProgressEl = document.getElementById('round-progress-text');
  if (roundProgressEl) {
    roundProgressEl.innerHTML = `Ronda ${round}: <strong>${roundPredicted}</strong> de <strong>${roundTotal}</strong> pronosticados`;
  }

  const totalPredicted = countPredicted();
  const totalMatches = AppState.matches.length;
  const globalPct = Math.round((totalPredicted / totalMatches) * 100);
  const progressFill = document.querySelector('.wizard-progress-fill');
  const progressText = document.querySelector('.pronosticos-header .wizard-progress-text');
  if (progressFill) progressFill.style.width = `${globalPct}%`;
  if (progressText) {
    progressText.innerHTML = `<strong>${totalPredicted}</strong> de <strong>${totalMatches}</strong> partidos pronosticados`;
  }
}

function setupRoundNavigation() {
  document.getElementById('btn-round-prev')?.addEventListener('click', () => {
    if (AppState.currentRound > 1) {
      AppState.currentRound--;
      renderRoundMatches();
    }
  });

  document.getElementById('btn-round-next')?.addEventListener('click', () => {
    if (AppState.currentRound < 8) {
      AppState.currentRound++;
      renderRoundMatches();
    }
  });
}

function setupSaveButton() {
  const btn = document.getElementById('btn-save-predictions');
  if (!btn) return;
  btn.disabled = !AppState.hasUnsavedChanges;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    const ok = await savePredictionsToBackend();
    btn.textContent = 'Guardar en servidor';
    updateSaveButton();
    if (ok) {
      renderRoundMatches();
      updateProgressCounts();
    }
  });
}

function updateSaveButton() {
  const btn = document.getElementById('btn-save-predictions');
  if (btn) btn.disabled = isFaseLiga() || !AppState.hasUnsavedChanges;
}

async function confirmPredictions() {
  const token = AppState.sessionToken || localStorage.getItem('session_token');
  if (!token) {
    showToast('Debes iniciar sesión para confirmar');
    return;
  }

  if (AppState.predictionsConfirmed) {
    showToast('Ya has confirmado tus pronósticos');
    return;
  }

  const total = AppState.matches.length;
  const predicted = countPredicted();
  if (predicted < total) {
    showToast(`Faltan pronósticos. Has completado ${predicted} de ${total} partidos`);
    return;
  }

  try {
    const response = await fetchWithPhase(`${API_BASE}/api/predictions/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.ok) {
      AppState.predictionsConfirmed = true;
      AppState.hasUnsavedChanges = false;
      const userData = JSON.parse(localStorage.getItem('porra_ucl_user') || '{}');
      userData.predictionsConfirmed = true;
      localStorage.setItem('porra_ucl_user', JSON.stringify(userData));
      showToast('✅ Pronósticos confirmados correctamente');
      renderPronosticosTab();
    } else {
      showToast('❌ ' + (data.error || 'Error al confirmar'));
    }
  } catch (error) {
    console.error('Error confirming predictions:', error);
    showToast('❌ Error de conexión al confirmar');
  }
}

// ============================================================
// TAB: PLANTILLA IDEAL
// ============================================================

/** Cuenta cuántos jugadores hay de una posición en la plantilla */
function countByPosition(position) {
  return AppState.squadPicks.filter(p => p.posicion === position).length;
}

/** Obtiene el jugador de una casilla específica */
function getSlotPlayer(position, index) {
  const positionPlayers = AppState.squadPicks.filter(p => p.posicion === position);
  return positionPlayers[index] || null;
}

/** Abre el panel de búsqueda para una casilla */
function openSlotSearch(position, index) {
  if (isFaseLiga()) {
    showToast('La plantilla está bloqueada<br>la competición ha comenzado');
    return;
  }
  const posCount = countByPosition(position);
  const maxCount = SQUAD_FORMATION[position].count;
  if (posCount >= maxCount) return;

  AppState.activeSlot = { position, index };
  AppState.teamFilter = null;

  const panel = document.getElementById('squad-search-panel');
  if (panel) {
    panel.classList.add('active');
    const input = document.getElementById('squad-search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    renderTeamFilter();
    renderSearchResults('');
  }
}

/** Cierra el panel de búsqueda */
function closeSlotSearch() {
  AppState.activeSlot = null;
  const panel = document.getElementById('squad-search-panel');
  if (panel) panel.classList.remove('active');
}

/** Renderiza el filtro de equipos disponible (equipos sin jugador seleccionado) */
function renderTeamFilter() {
  const container = document.getElementById('squad-team-filter');
  if (!container) return;

  const positionFilter = AppState.activeSlot?.position || null;
  const availableTeams = new Set();

  AppState.allPlayers.forEach(p => {
    if (positionFilter && p.posicion !== positionFilter) return;
    if (AppState.blockedTeams.has(p.equipo)) return;
    availableTeams.add(p.equipo);
  });

  if (availableTeams.size === 0) {
    container.innerHTML = '';
    return;
  }

  const sortedTeams = [...availableTeams]
    .map(id => ({ id, name: AppState.teamsMap[id]?.name || `Equipo ${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));

  container.innerHTML = `
    <select class="squad-team-select" id="squad-team-select">
      <option value="">Todos los equipos (${sortedTeams.length})</option>
      ${sortedTeams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
    </select>
  `;

  document.getElementById('squad-team-select')?.addEventListener('change', (e) => {
    AppState.teamFilter = e.target.value || null;
    const input = document.getElementById('squad-search-input');
    renderSearchResults(input?.value || '');
  });
}

/** Renderiza los resultados de búsqueda filtrados por posición activa */
function renderSearchResults(query) {
  const results = document.getElementById('squad-search-results');
  if (!results) return;

  const selectedIds = new Set(AppState.squadPicks.map(p => p.id));
  const positionFilter = AppState.activeSlot?.position || null;
  const teamFilter = AppState.teamFilter || null;
  const players = filterPlayers(query, selectedIds, positionFilter, teamFilter);

  if (players.length === 0) {
    results.innerHTML = '<p class="squad-no-results">No se encontraron jugadores</p>';
    return;
  }

  results.innerHTML = players.slice(0, 50).map(p => {
    const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
    const isBlocked = AppState.blockedTeams.has(p.equipo);
    return `
      <div class="squad-player-row ${isBlocked ? 'blocked' : ''}" data-player-id="${p.id}" ${isBlocked ? 'data-blocked="true"' : ''}>
        ${playerImgTag(p.id, p.extension || 'png', p.nombre, 'squad-player-img')}
        <div class="squad-player-info">
          <div class="squad-player-name">${p.nombre}</div>
          <div class="squad-player-team">${p.club}</div>
        </div>
        ${isBlocked ? '<span class="squad-player-blocked-badge">EQUIPO USADO</span>' : `<span class="squad-player-pos">${posLabel}</span>`}
        ${isBlocked ? '' : `<button class="squad-add-btn" data-player-id="${p.id}" aria-label="Anadir ${p.nombre}">+</button>`}
      </div>
    `;
  }).join('');
}

/** Selecciona un jugador para la casilla activa */
function selectPlayerForSlot(playerId) {
  if (isFaseLiga()) {
    showToast('La plantilla está bloqueada');
    return;
  }
  if (!AppState.activeSlot) return;

  const { position } = AppState.activeSlot;
  const posCount = countByPosition(position);
  const maxCount = SQUAD_FORMATION[position].count;

  if (posCount >= maxCount) return;
  if (AppState.squadPicks.some(p => p.id === playerId)) return;

  const player = AppState.allPlayers.find(p => p.id === playerId);
  if (!player) return;
  if (AppState.blockedTeams.has(player.equipo)) return;

  AppState.squadPicks.push({
    id: player.id,
    nombre: player.nombre,
    posicion: player.posicion,
    club: player.club,
    equipo: player.equipo,
    extension: player.extension || 'png',
  });

  AppState.blockedTeams.add(player.equipo);
  AppState.hasUnsavedSquadChanges = true;
  localStorage.setItem('porra_ucl_squad', JSON.stringify(AppState.squadPicks));

  closeSlotSearch();
  refreshSquadUI();
}

function removePlayerFromSquad(position, index) {
  if (isFaseLiga()) {
    showToast('La plantilla está bloqueada');
    return;
  }
  const positionPlayers = AppState.squadPicks.filter(p => p.posicion === position);
  const playerToRemove = positionPlayers[index];
  if (!playerToRemove) return;

  const mainIndex = AppState.squadPicks.findIndex(p => p.id === playerToRemove.id);
  if (mainIndex === -1) return;

  const removed = AppState.squadPicks.splice(mainIndex, 1)[0];

  const stillHasTeam = AppState.squadPicks.some(p => p.equipo === removed.equipo);
  if (!stillHasTeam) {
    AppState.blockedTeams.delete(removed.equipo);
  }

  AppState.hasUnsavedSquadChanges = true;
  localStorage.setItem('porra_ucl_squad', JSON.stringify(AppState.squadPicks));
  refreshSquadUI();
}

/** Renderiza las casillas de selección agrupadas por posición */
function renderSquadSlots() {
  const positions = ['G', 'D', 'M', 'F'];

  return positions.map(pos => {
    const config = SQUAD_FORMATION[pos];
    const count = countByPosition(pos);
    const slots = [];

    for (let i = 0; i < config.count; i++) {
      const player = getSlotPlayer(pos, i);
      if (player) {
        const sourcePlayer = AppState.allPlayers.find(p => p.id === player.id);
        const playerExt = sourcePlayer?.extension || player.extension || 'png';
        slots.push(`
          <div class="squad-slot filled" data-position="${pos}" data-index="${i}">
            ${playerImgTag(player.id, playerExt, player.nombre, 'squad-slot-img')}
            <div class="squad-slot-info">
              <span class="squad-slot-name">${player.nombre}</span>
              <span class="squad-slot-team">${player.club}</span>
            </div>
            <button class="squad-slot-remove" data-position="${pos}" data-index="${i}" aria-label="Quitar ${player.nombre}">&times;</button>
          </div>
        `);
      } else {
        slots.push(`
          <div class="squad-slot empty" data-position="${pos}" data-index="${i}">
            <span class="squad-slot-plus">+</span>
            <span class="squad-slot-label">Vacío</span>
          </div>
        `);
      }
    }

    return `
      <div class="squad-position-group">
        <h3 class="squad-position-title">${config.label} <span class="squad-position-count">(${count}/${config.count})</span></h3>
        <div class="squad-slots-grid">
          ${slots.join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderPlantillaTab() {
  const container = document.getElementById('plantilla-container');
  if (!container) return;

  const totalSelected = AppState.squadPicks.length;
  const frozen = isFaseLiga();

  container.innerHTML = `
    <div class="squad-picker-wrapper">

      <!-- Cabecera fija -->
      <div class="squad-top-fixed">
        ${frozen ? '<div style="background:rgba(239,68,68,0.15);color:#ef4444;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;text-align:center;">🔒 Plantilla bloqueada — la competición ha comenzado</div>' : ''}
        <!-- Resumen -->
        <div class="squad-summary">
          <span class="squad-summary-text">Tu Plantilla (<span id="squad-count">${totalSelected}</span>/${SQUAD_SIZE})</span>
          <button class="squad-save-btn" id="btn-save-squad" ${totalSelected === 0 || frozen ? 'disabled' : ''} ${frozen ? 'style="opacity:0.5"' : ''}>💾 Guardar</button>
        </div>
      </div>

      <!-- Contenido con scroll -->
      <div class="squad-scroll-content" id="squad-slots">
        ${renderSquadSlots()}
      </div>
    </div>

    <!-- Panel de búsqueda (overlay) -->
    <div class="squad-search-panel" id="squad-search-panel">
      <div class="squad-search-panel-content">
        <div class="squad-search-panel-header">
          <h3 class="squad-search-panel-title" id="squad-search-panel-title">Buscar jugador</h3>
          <button class="squad-search-panel-close" id="btn-close-search">&times;</button>
        </div>
        <div class="squad-filters-row">
          <div class="squad-team-filter" id="squad-team-filter"></div>
          <div class="squad-search-input-row">
            <div class="squad-search-wrapper">
              <input type="text" class="squad-search-input" id="squad-search-input"
                     placeholder="Buscar por nombre..." autocomplete="off" spellcheck="false">
            </div>

          </div>
        </div>
        <div class="squad-players-list" id="squad-search-results"></div>
      </div>
    </div>
  `;

  // Eventos de casillas vacías
  container.querySelectorAll('.squad-slot.empty').forEach(slot => {
    slot.addEventListener('click', () => {
      const position = slot.getAttribute('data-position');
      const index = parseInt(slot.getAttribute('data-index'));
      openSlotSearch(position, index);
    });
  });

  // Eventos de casillas llenas (quitar)
  container.querySelectorAll('.squad-slot-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const position = btn.getAttribute('data-position');
      const index = parseInt(btn.getAttribute('data-index'));
      removePlayerFromSquad(position, index);
    });
  });

  // Cerrar panel de búsqueda
  document.getElementById('btn-close-search')?.addEventListener('click', closeSlotSearch);

  // Búsqueda de jugadores
  const searchInput = document.getElementById('squad-search-input');
  const debouncedSearch = debounce((val) => renderSearchResults(val), 300);
  searchInput?.addEventListener('input', (e) => debouncedSearch(e.target.value));



  // Seleccionar jugador de la lista
  document.getElementById('squad-search-results')?.addEventListener('click', (e) => {
    const row = e.target.closest('.squad-player-row');
    if (row) {
      const playerId = parseInt(row.getAttribute('data-player-id'));
      selectPlayerForSlot(playerId);
    }
  });

  // Guardar plantilla
  document.getElementById('btn-save-squad')?.addEventListener('click', saveSquadToBackend);

  // Cerrar panel al hacer clic fuera
  document.getElementById('squad-search-panel')?.addEventListener('click', (e) => {
    if (e.target.id === 'squad-search-panel') closeSlotSearch();
  });
}

async function saveSquadToBackend() {
  if (!AppState.currentUser) return false;
  if (isFaseLiga()) {
    showToast('La plantilla está bloqueada');
    return false;
  }

  const btn = document.getElementById('btn-save-squad');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetchWithPhase(`${API_BASE}/api/squad`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        squad: AppState.squadPicks
      })
    });
    if (res.status === 401) { logout(); return false; }
    const data = await res.json();
    if (data.ok) {
      AppState.hasUnsavedSquadChanges = false;
      // Actualizar caché con los nuevos datos y invalidar timestamp
      if (!AppState.squadsCache) AppState.squadsCache = {};
      AppState.squadsCache[AppState.currentUser.name] = AppState.squadPicks;
      AppState._squadsCacheTime = 0;
      showToast('Plantilla guardada');
      return true;
    } else {
      showToast(data.error || 'Error al guardar');
      return false;
    }
  } catch (e) {
    console.error('Error guardando plantilla:', e);
    showToast('Error de conexion');
    return false;
  } finally {
    if (btn) {
      btn.disabled = AppState.squadPicks.length === 0;
      btn.textContent = '💾 Guardar';
    }
  }
}

async function fetchSquadFromBackend() {
  if (!AppState.currentUser) return;

  try {
    const res = await fetchWithPhase(`${API_BASE}/api/squad`, { headers: authHeaders() });
    const data = await res.json();
    if (data.ok && Array.isArray(data.squad)) {
      AppState.squadPicks = data.squad;
      AppState.blockedTeams = new Set(data.squad.map(p => p.equipo));
      AppState.hasUnsavedSquadChanges = false;
      localStorage.setItem('porra_ucl_squad', JSON.stringify(AppState.squadPicks));
    }
  } catch (e) {
    console.error('Error cargando plantilla del backend:', e);
  }
}

function refreshSquadUI() {
  const slotsContainer = document.getElementById('squad-slots');
  const countEl = document.getElementById('squad-count');
  const saveBtn = document.getElementById('btn-save-squad');

  if (slotsContainer) slotsContainer.innerHTML = renderSquadSlots();
  if (countEl) countEl.textContent = AppState.squadPicks.length;
  if (saveBtn) saveBtn.disabled = AppState.squadPicks.length === 0;

  // Re-asignar eventos de casillas
  const container = document.getElementById('plantilla-container');
  if (container) {
    container.querySelectorAll('.squad-slot.empty').forEach(slot => {
      slot.addEventListener('click', () => {
        const position = slot.getAttribute('data-position');
        const index = parseInt(slot.getAttribute('data-index'));
        openSlotSearch(position, index);
      });
    });

    container.querySelectorAll('.squad-slot-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const position = btn.getAttribute('data-position');
        const index = parseInt(btn.getAttribute('data-index'));
        removePlayerFromSquad(position, index);
      });
    });
  }
}

// ============================================================
// CLASIFICACION
// ============================================================
function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  let all = [...AppState.players || []];

  if (AppState.currentUser) {
    const exists = all.some(p => p.name === AppState.currentUser.name);
    if (!exists) {
      all.push({
        name: AppState.currentUser.name,
        avatar: AppState.currentUser.avatar,
        points: AppState.currentUser.points || 0,
        hits: AppState.currentUser.hits || 0,
      });
    }
  }

  all.sort((a, b) => b.points - a.points);

  if (!all.length) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Aun no hay participantes registrados.</div>`;
    return;
  }

  container.innerHTML = all.map((p, i) => {
    const rank = i + 1;
    const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
    return `
      <div class="leaderboard-row ${isMe ? 'current-user' : ''}">
        <div class="rank-badge rank-${rank}">${rank}</div>
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${p.name}${isMe ? ' <span style="color:var(--accent-primary)">(Tu)</span>' : ''}</div>
          <div class="player-stats-sub">${p.hits || 0} aciertos acumulados</div>
        </div>
        <div class="player-points">${p.points} <span style="font-size:10px;color:var(--text-muted)">pts</span></div>
      </div>
    `;
  }).join('');
}

// ============================================================
// NAVEGACION
// ============================================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.tab-page');

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      navigateToTab(tab);
    });
  });
}

// ============================================================
// TOAST
// ============================================================
function showToast(message) {
  document.querySelector('.toast-msg')?.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerHTML = message;

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    backgroundColor: '#06B6D4',
    color: '#021319',
    padding: '10px 18px',
    borderRadius: '20px',
    fontWeight: '700',
    fontSize: '0.85rem',
    whiteSpace: 'pre-line',
    textAlign: 'center',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    zIndex: '2000',
    opacity: '0',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  });

  (document.getElementById('app-viewport') || document.body).appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ============================================================
// CLASIFICACIÓN PRONOSTICADA
// ============================================================

/**
 * Busca todos los partidos donde participa un equipo (local o visitante)
 * @param {number} teamId - ID del equipo
 * @returns {Array} Array de partidos del equipo
 */
function findTeamMatches(teamId) {
  return AppState.matches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

/**
 * Calcula estadísticas individuales de un equipo
 * @param {number} teamId - ID del equipo
 * @returns {Object} Estadísticas del equipo
 */
function getTeamStats(teamId) {
  const stats = {
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    gc: 0,
    gd: 0,
    points: 0,
    awayWins: 0,
    awayGoals: 0
  };

  const teamMatches = findTeamMatches(teamId);

  for (const match of teamMatches) {
    const pred = AppState.scorePredictions[match.id];
    if (!pred || typeof pred.home !== 'number' || typeof pred.away !== 'number') continue;

    const isHome = match.homeTeamId === teamId;
    const teamGoals = isHome ? pred.home : pred.away;
    const rivalGoals = isHome ? pred.away : pred.home;

    stats.played++;
    stats.gf += teamGoals;
    stats.gc += rivalGoals;

    if (teamGoals > rivalGoals) {
      stats.wins++;
      stats.points += 3;
      if (!isHome) stats.awayWins++;
    } else if (teamGoals === rivalGoals) {
      stats.draws++;
      stats.points += 1;
    } else {
      stats.losses++;
    }

    if (!isHome) {
      stats.awayGoals += teamGoals;
    }
  }

  stats.gd = stats.gf - stats.gc;
  return stats;
}

/**
 * Calcula las estadísticas acumuladas de los 8 rivales de un equipo
 * en TODOS sus partidos de la fase de liga (no solo contra el equipo en cuestión)
 * @param {number} teamId - ID del equipo
 * @param {Map} statsCache - Caché de estadísticas { teamId → stats }
 * @returns {Object} { rivalPointsSum, rivalGDSum, rivalGFSum }
 */
function getRivalsStats(teamId, statsCache) {
  const teamMatches = findTeamMatches(teamId);
  const rivalIds = new Set();

  for (const match of teamMatches) {
    const rivalId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
    rivalIds.add(rivalId);
  }

  let rivalPointsSum = 0;
  let rivalGDSum = 0;
  let rivalGFSum = 0;

  for (const rivalId of rivalIds) {
    let rivalStats = statsCache.get(rivalId);
    if (!rivalStats) {
      rivalStats = getTeamStats(rivalId);
      statsCache.set(rivalId, rivalStats);
    }
    rivalPointsSum += rivalStats.points;
    rivalGDSum += rivalStats.gd;
    rivalGFSum += rivalStats.gf;
  }

  return { rivalPointsSum, rivalGDSum, rivalGFSum };
}

/**
 * Ordena array de equipos aplicando criterios de desempate UCL
 * Los criterios de desempate solo se aplican cuando es necesario
 * @param {Array} teams - Array de objetos de equipo con stats
 * @returns {Array} Array ordenado
 */
function sortTeams(teams) {
  if (teams.length <= 1) return teams;

  // Caché de stats para no recalcular
  const statsCache = new Map();
  for (const t of teams) {
    statsCache.set(t.teamId, t);
  }

  // Función de comparación con criterios de desempate
  function compareTeams(a, b) {
    // Criterio 0: Puntos (primero, siempre)
    if (b.points !== a.points) return b.points - a.points;

    // Criterio 1: Diferencia de goles
    if (b.gd !== a.gd) return b.gd - a.gd;

    // Criterio 2: Goles marcados
    if (b.gf !== a.gf) return b.gf - a.gf;

    // Criterio 3: Goles como visitante
    if (b.awayGoals !== a.awayGoals) return b.awayGoals - a.awayGoals;

    // Criterio 4: Victorias
    if (b.wins !== a.wins) return b.wins - a.wins;

    // Criterio 5: Victorias como visitante
    if (b.awayWins !== a.awayWins) return b.awayWins - a.awayWins;

    // Criterios 6-8: Estadísticas de rivales (más costosos)
    // Solo se calculan si hay empate persistente
    const aRivals = getRivalsStats(a.teamId, statsCache);
    const bRivals = getRivalsStats(b.teamId, statsCache);

    // Criterio 6: Suma de puntos de rivales
    if (bRivals.rivalPointsSum !== aRivals.rivalPointsSum) {
      return bRivals.rivalPointsSum - aRivals.rivalPointsSum;
    }

    // Criterio 7: Suma de diferencia de goles de rivales
    if (bRivals.rivalGDSum !== aRivals.rivalGDSum) {
      return bRivals.rivalGDSum - aRivals.rivalGDSum;
    }

    // Criterio 8: Suma de goles marcados por rivales
    if (bRivals.rivalGFSum !== aRivals.rivalGFSum) {
      return bRivals.rivalGFSum - aRivals.rivalGFSum;
    }

    // Si todo es igual, ordenar por nombre (estable)
    const aName = AppState.teamsMap[a.teamId]?.name || '';
    const bName = AppState.teamsMap[b.teamId]?.name || '';
    return aName.localeCompare(bName);
  }

  return [...teams].sort(compareTeams);
}

/**
 * Determina qué criterio de desempate separa a dos equipos empatados
 * @param {Object} a - Primer equipo
 * @param {Object} b - Segundo equipo
 * @param {Map} statsCache - Caché de estadísticas
 * @returns {number|null} Número de criterio (1-8) o null si no están empatados
 */
function getTiebreakCriterion(a, b, statsCache) {
  // Si no están empatados en puntos, no hay criterio
  if (a.points !== b.points) return null;

  // Criterio 1: Diferencia de goles
  if (a.gd !== b.gd) return 1;

  // Criterio 2: Goles marcados
  if (a.gf !== b.gf) return 2;

  // Criterio 3: Goles como visitante
  if (a.awayGoals !== b.awayGoals) return 3;

  // Criterio 4: Victorias
  if (a.wins !== b.wins) return 4;

  // Criterio 5: Victorias como visitante
  if (a.awayWins !== b.awayWins) return 5;

  // Criterios 6-8
  const aRivals = getRivalsStats(a.teamId, statsCache);
  const bRivals = getRivalsStats(b.teamId, statsCache);

  if (aRivals.rivalPointsSum !== bRivals.rivalPointsSum) return 6;
  if (aRivals.rivalGDSum !== bRivals.rivalGDSum) return 7;
  if (aRivals.rivalGFSum !== bRivals.rivalGFSum) return 8;

  return null; // Totalmente iguales
}

/**
 * Calcula la clasificación completa de los 36 equipos
 * @returns {Array} Array ordenado de equipos con estadísticas, posición y criterio
 */
function calculateStandings() {
  const teamIds = Object.keys(AppState.teamsMap).map(Number);
  const teams = [];
  const statsCache = new Map();

  for (const teamId of teamIds) {
    const stats = getTeamStats(teamId);
    const teamInfo = AppState.teamsMap[teamId];
    teams.push({
      ...stats,
      name: teamInfo?.name || 'Desconocido',
      badgeExt: teamInfo?.ext || 'png'
    });
    statsCache.set(teamId, stats);
  }

  const sorted = sortTeams(teams);

  // Asignar posición y criterio de desempate
  return sorted.map((team, index) => {
    let criterion = null;

    // Si hay un equipo anterior con mismos puntos, buscar qué criterio los separó
    if (index > 0) {
      const prevTeam = sorted[index - 1];
      if (prevTeam.points === team.points) {
        // Buscar el criterio entre este equipo y el anterior
        criterion = getTiebreakCriterion(prevTeam, team, statsCache);
      }
    }

    return {
      ...team,
      position: index + 1,
      criterion: criterion
    };
  });
}

/**
 * Renderiza el contenido del modal de clasificación pronosticada
 */
function renderPredictedStandings() {
  const container = document.getElementById('pred-standings-container');
  if (!container) return;

  const standings = calculateStandings();
  const totalMatches = AppState.matches.length;
  const predicted = countPredicted();
  const pct = Math.round((predicted / totalMatches) * 100);

  const rows = standings.map(team => {
    const gdSign = team.gd > 0 ? '+' : '';
    let rowClass = '';
    if (team.position <= 8) rowClass = 'top-8';
    else if (team.position <= 24) rowClass = 'top-24';
    else rowClass = 'bottom-12';

    let gdClass = 'gd-zero';
    if (team.gd > 0) gdClass = 'gd-positive';
    else if (team.gd < 0) gdClass = 'gd-negative';

    const criterionDisplay = team.criterion !== null ? team.criterion : '-';

    return `
      <tr class="${rowClass}">
        <td>${team.position}</td>
        <td><img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="standings-badge-img" alt="${team.name}" loading="lazy" onerror="this.style.display='none'"></td>
        <td><span class="standings-team-name">${team.name}</span></td>
        <td class="pts-col">${team.points}</td>
        <td class="gd-col ${gdClass}">${gdSign}${team.gd}</td>
        <td>${team.gf}</td>
        <td>${team.gc}</td>
        <td>${team.wins}</td>
        <td>${team.draws}</td>
        <td>${team.losses}</td>
        <td class="criterion-col">${criterionDisplay}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="standings-progress">
      <p class="standings-progress-text">
        Partidos pronosticados: <strong>${predicted}</strong>/${totalMatches}
      </p>
      <div class="standings-progress-bar">
        <div class="standings-progress-fill" style="width: ${pct}%"></div>
      </div>
    </div>

    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th></th>
          <th>Equipo</th>
          <th>Pts</th>
          <th>DG</th>
          <th>GF</th>
          <th>GC</th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          <th>Des.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="standings-legend">
      <span><strong>Pts</strong>=Puntos</span>
      <span><strong>DG</strong>=Dif.Goles</span>
      <span><strong>GF</strong>=Goles+</span>
      <span><strong>GC</strong>=Goles-</span>
      <span><strong>V</strong>=Victorias</span>
      <span><strong>E</strong>=Empates</span>
      <span><strong>D</strong>=Derrotas</span>
    </div>
    <div class="standings-color-legend">
      <span class="standings-color-item top-8">1-8: Clasificación directa</span>
      <span class="standings-color-item top-24">9-24: Playoffs</span>
      <span class="standings-color-item bottom-12">25-36: Eliminados</span>
    </div>
  `;
}

/**
 * Navega a la pantalla de clasificación pronosticada
 */
function showPredictedStandings() {
  renderPredictedStandings();
  navigateToTab('pred-standings');
}

// ============================================================
// CLASIFICACIÓN REAL (basada en resultados de partidos)
// ============================================================

/**
 * Tabla de puntos por posición en la clasificación
 * Solo se asignan puntos a equipos en posición 1-24
 */
const CLASSIFICATION_POINTS = {
  1: 60, 2: 51, 3: 43, 4: 36, 5: 30, 6: 25,
  7: 21, 8: 18, 9: 16, 10: 15, 11: 14, 12: 13,
  13: 12, 14: 11, 15: 10, 16: 9, 17: 8, 18: 7,
  19: 6, 20: 5, 21: 4, 22: 3, 23: 2, 24: 1
};

/**
 * Busca todos los partidos con resultado donde participa un equipo
 * @param {number} teamId - ID del equipo
 * @returns {Array} Array de partidos con resultado del equipo
 */
function findRealTeamMatches(teamId) {
  return AppState.matches.filter(m => {
    const matchStat = AppState.matchStats.find(ms => ms.eventId === m.id);
    return matchStat && matchStat.stats &&
           matchStat.stats[m.homeTeamId] !== undefined &&
           matchStat.stats[m.awayTeamId] !== undefined;
  }).filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

/**
 * Calcula estadísticas reales de un equipo desde matchStats
 * @param {number} teamId - ID del equipo
 * @returns {Object} Estadísticas reales del equipo
 */
function getRealTeamStats(teamId) {
  const stats = {
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    gc: 0,
    gd: 0,
    points: 0,
    awayWins: 0,
    awayGoals: 0
  };

  const teamMatches = findRealTeamMatches(teamId);

  for (const match of teamMatches) {
    const matchStat = AppState.matchStats.find(ms => ms.eventId === match.id);
    if (!matchStat || !matchStat.stats) continue;

    const realHome = matchStat.stats[match.homeTeamId]?.goles;
    const realAway = matchStat.stats[match.awayTeamId]?.goles;
    if (realHome === undefined || realAway === undefined) continue;

    const isHome = match.homeTeamId === teamId;
    const teamGoals = isHome ? realHome : realAway;
    const rivalGoals = isHome ? realAway : realHome;

    stats.played++;
    stats.gf += teamGoals;
    stats.gc += rivalGoals;

    if (teamGoals > rivalGoals) {
      stats.wins++;
      stats.points += 3;
      if (!isHome) stats.awayWins++;
    } else if (teamGoals === rivalGoals) {
      stats.draws++;
      stats.points += 1;
    } else {
      stats.losses++;
    }

    if (!isHome) {
      stats.awayGoals += teamGoals;
    }
  }

  stats.gd = stats.gf - stats.gc;
  return stats;
}

/**
 * Calcula las estadísticas acumuladas de los 8 rivales de un equipo
 * usando datos reales de matchStats
 * @param {number} teamId - ID del equipo
 * @param {Map} statsCache - Caché de estadísticas { teamId → stats }
 * @returns {Object} { rivalPointsSum, rivalGDSum, rivalGFSum }
 */
function getRealRivalsStats(teamId, statsCache) {
  const teamMatches = findRealTeamMatches(teamId);
  const rivalIds = new Set();

  for (const match of teamMatches) {
    const rivalId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
    rivalIds.add(rivalId);
  }

  let rivalPointsSum = 0;
  let rivalGDSum = 0;
  let rivalGFSum = 0;

  for (const rivalId of rivalIds) {
    let rivalStats = statsCache.get(rivalId);
    if (!rivalStats) {
      rivalStats = getRealTeamStats(rivalId);
      statsCache.set(rivalId, rivalStats);
    }
    rivalPointsSum += rivalStats.points;
    rivalGDSum += rivalStats.gd;
    rivalGFSum += rivalStats.gf;
  }

  return { rivalPointsSum, rivalGDSum, rivalGFSum };
}

/**
 * Calcula la clasificación real completa de los 36 equipos
 * basada en los resultados de los partidos (matchStats)
 * @returns {Array} Array ordenado de equipos con estadísticas y posición
 */
function calculateRealStandings() {
  // Si ya está calculada y hay datos, devolverla
  if (AppState.realStandings.length > 0 && AppState.matchStats.length > 0) {
    return AppState.realStandings;
  }

  const teamIds = Object.keys(AppState.teamsMap).map(Number);
  const teams = [];
  const statsCache = new Map();

  for (const teamId of teamIds) {
    const stats = getRealTeamStats(teamId);
    const teamInfo = AppState.teamsMap[teamId];
    teams.push({
      ...stats,
      name: teamInfo?.name || 'Desconocido',
      badgeExt: teamInfo?.ext || 'png'
    });
    statsCache.set(teamId, stats);
  }

  // Función de comparación con criterios de desempate UCL
  function compareTeams(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.awayGoals !== a.awayGoals) return b.awayGoals - a.awayGoals;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.awayWins !== a.awayWins) return b.awayWins - a.awayWins;

    const aRivals = getRealRivalsStats(a.teamId, statsCache);
    const bRivals = getRealRivalsStats(b.teamId, statsCache);

    if (bRivals.rivalPointsSum !== aRivals.rivalPointsSum) {
      return bRivals.rivalPointsSum - aRivals.rivalPointsSum;
    }
    if (bRivals.rivalGDSum !== aRivals.rivalGDSum) {
      return bRivals.rivalGDSum - aRivals.rivalGDSum;
    }
    if (bRivals.rivalGFSum !== aRivals.rivalGFSum) {
      return bRivals.rivalGFSum - aRivals.rivalGFSum;
    }

    const aName = AppState.teamsMap[a.teamId]?.name || '';
    const bName = AppState.teamsMap[b.teamId]?.name || '';
    return aName.localeCompare(bName);
  }

  const sorted = teams.sort(compareTeams);

  // Asignar posición
  const result = sorted.map((team, index) => ({
    ...team,
    position: index + 1
  }));

  // Guardar en caché
  AppState.realStandings = result;
  return result;
}

/**
 * Comprueba si un equipo está entre los 8 primeros de la clasificación real
 * Los 8 primeros pasan directamente a octavos de final (no juegan deciseisavos)
 * @param {number} teamId - ID del equipo
 * @returns {boolean} true si el equipo es top-8
 */
function isTop8Team(teamId) {
  if (!AppState.realStandings || AppState.realStandings.length === 0) return false;
  return AppState.realStandings.slice(0, 8).some(t => t.teamId === teamId);
}

function isTop8Predicted(teamId) {
  const standings = calculatePredictedStandings();
  if (!standings || standings.length === 0) return false;
  return standings.slice(0, 8).some(t => t.teamId === teamId);
}

/**
 * Calcula la clasificación pronosticada por un usuario
 * basada en sus predicciones de marcadores
 * @param {string} username - Nombre del usuario
 * @returns {Array} Array ordenado de equipos con posición pronosticada
 */
function calculateUserPredictedStandings(username) {
  const predictions = AppState.allPredictions[username];
  if (!predictions) return [];

  const teamIds = Object.keys(AppState.teamsMap).map(Number);
  const teams = [];
  const statsCache = new Map();

  for (const teamId of teamIds) {
    const stats = {
      teamId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      gc: 0,
      gd: 0,
      points: 0,
      awayWins: 0,
      awayGoals: 0
    };

    const teamMatches = AppState.matches.filter(m =>
      m.homeTeamId === teamId || m.awayTeamId === teamId
    );

    for (const match of teamMatches) {
      const pred = predictions[match.id];
      if (!pred || typeof pred.home !== 'number' || typeof pred.away !== 'number') continue;

      const isHome = match.homeTeamId === teamId;
      const teamGoals = isHome ? pred.home : pred.away;
      const rivalGoals = isHome ? pred.away : pred.home;

      stats.played++;
      stats.gf += teamGoals;
      stats.gc += rivalGoals;

      if (teamGoals > rivalGoals) {
        stats.wins++;
        stats.points += 3;
        if (!isHome) stats.awayWins++;
      } else if (teamGoals === rivalGoals) {
        stats.draws++;
        stats.points += 1;
      } else {
        stats.losses++;
      }

      if (!isHome) {
        stats.awayGoals += teamGoals;
      }
    }

    stats.gd = stats.gf - stats.gc;
    const teamInfo = AppState.teamsMap[teamId];
    teams.push({
      ...stats,
      name: teamInfo?.name || 'Desconocido',
      badgeExt: teamInfo?.ext || 'png'
    });
    statsCache.set(teamId, stats);
  }

  // Usar la misma función de ordenación
  function compareTeams(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.awayGoals !== a.awayGoals) return b.awayGoals - a.awayGoals;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.awayWins !== a.awayWins) return b.awayWins - a.awayWins;

    // Para la pronosticada, calcular stats de rivales usando el caché local
    function getLocalRivalsStats(teamId) {
      const teamMatches = AppState.matches.filter(m =>
        m.homeTeamId === teamId || m.awayTeamId === teamId
      );
      const rivalIds = new Set();
      for (const match of teamMatches) {
        const rivalId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
        rivalIds.add(rivalId);
      }

      let rivalPointsSum = 0;
      let rivalGDSum = 0;
      let rivalGFSum = 0;

      for (const rivalId of rivalIds) {
        const rivalStats = statsCache.get(rivalId);
        if (rivalStats) {
          rivalPointsSum += rivalStats.points;
          rivalGDSum += rivalStats.gd;
          rivalGFSum += rivalStats.gf;
        }
      }

      return { rivalPointsSum, rivalGDSum, rivalGFSum };
    }

    const aRivals = getLocalRivalsStats(a.teamId);
    const bRivals = getLocalRivalsStats(b.teamId);

    if (bRivals.rivalPointsSum !== aRivals.rivalPointsSum) {
      return bRivals.rivalPointsSum - aRivals.rivalPointsSum;
    }
    if (bRivals.rivalGDSum !== aRivals.rivalGDSum) {
      return bRivals.rivalGDSum - aRivals.rivalGDSum;
    }
    if (bRivals.rivalGFSum !== aRivals.rivalGFSum) {
      return bRivals.rivalGFSum - aRivals.rivalGFSum;
    }

    const aName = AppState.teamsMap[a.teamId]?.name || '';
    const bName = AppState.teamsMap[b.teamId]?.name || '';
    return aName.localeCompare(bName);
  }

  const sorted = teams.sort(compareTeams);
  return sorted.map((team, index) => ({
    ...team,
    position: index + 1
  }));
}

function calculatePredictedStandings() {
  const predictions = AppState.scorePredictions;
  if (!predictions || Object.keys(predictions).length === 0) return [];

  const teamIds = Object.keys(AppState.teamsMap).map(Number);
  const teams = [];
  const statsCache = new Map();

  for (const teamId of teamIds) {
    const stats = {
      teamId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      gc: 0,
      gd: 0,
      points: 0,
      awayWins: 0,
      awayGoals: 0
    };

    const teamMatches = AppState.matches.filter(m =>
      m.homeTeamId === teamId || m.awayTeamId === teamId
    );

    for (const match of teamMatches) {
      const pred = predictions[match.id];
      if (!pred || typeof pred.home !== 'number' || typeof pred.away !== 'number') continue;

      stats.played++;
      const isHome = match.homeTeamId === teamId;
      const goalsFor = isHome ? pred.home : pred.away;
      const goalsAgainst = isHome ? pred.away : pred.home;

      stats.gf += goalsFor;
      stats.gc += goalsAgainst;

      if (goalsFor > goalsAgainst) {
        stats.wins++;
        stats.points += 3;
        if (!isHome) stats.awayWins++;
      } else if (goalsFor === goalsAgainst) {
        stats.draws++;
        stats.points += 1;
      } else {
        stats.losses++;
      }

      if (!isHome) stats.awayGoals += goalsFor;
    }

    stats.gd = stats.gf - stats.gc;

    const teamInfo = AppState.teamsMap[teamId];
    teams.push({
      ...stats,
      name: teamInfo?.name || 'Desconocido',
      badgeExt: teamInfo?.ext || 'png'
    });
    statsCache.set(teamId, stats);
  }

  function compareTeams(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.awayGoals !== a.awayGoals) return b.awayGoals - a.awayGoals;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.awayWins !== a.awayWins) return b.awayWins - a.awayWins;

    const aRivals = getRealRivalsStats(a.teamId, statsCache);
    const bRivals = getRealRivalsStats(b.teamId, statsCache);

    if (bRivals.rivalPointsSum !== aRivals.rivalPointsSum) {
      return bRivals.rivalPointsSum - aRivals.rivalPointsSum;
    }
    if (bRivals.rivalGDSum !== aRivals.rivalGDSum) {
      return bRivals.rivalGDSum - aRivals.rivalGDSum;
    }
    if (bRivals.rivalGFSum !== aRivals.rivalGFSum) {
      return bRivals.rivalGFSum - aRivals.rivalGFSum;
    }

    const aName = AppState.teamsMap[a.teamId]?.name || '';
    const bName = AppState.teamsMap[b.teamId]?.name || '';
    return aName.localeCompare(bName);
  }

  const sorted = teams.sort(compareTeams);

  return sorted.map((team, index) => ({
    ...team,
    position: index + 1
  }));
}

/**
 * Calcula los puntos por pronóstico de clasificación para un usuario
 * Regla: solo se reciben puntos por el valor más bajo de posición
 * (pronosticada vs real)
 * @param {string} username - Nombre del usuario
 * @returns {Object} { totalPoints, teamDetails: [{ teamId, name, predictedPos, realPos, points }] }
 */
function calculateClassificationPoints(username) {
  // Si ya está calculada, devolverla
  if (AppState.classificationPoints[username]) {
    return AppState.classificationPoints[username];
  }

  const realStandings = calculateRealStandings();
  if (!realStandings.length) {
    return { totalPoints: 0, teamDetails: [] };
  }

  const predictedStandings = calculateUserPredictedStandings(username);
  if (!predictedStandings.length) {
    return { totalPoints: 0, teamDetails: [] };
  }

  // Crear mapas de posición por teamId
  const realPositionMap = {};
  for (const team of realStandings) {
    realPositionMap[team.teamId] = team.position;
  }

  const predictedPositionMap = {};
  for (const team of predictedStandings) {
    predictedPositionMap[team.teamId] = team.position;
  }

  let totalPoints = 0;
  const teamDetails = [];

  for (const team of realStandings) {
    const teamId = team.teamId;
    const realPos = realPositionMap[teamId] || 36;
    const predictedPos = predictedPositionMap[teamId] || 36;

    // Solo se asignan puntos a equipos en posición real 1-24
    if (realPos > 24) {
      teamDetails.push({
        teamId,
        name: team.name,
        badgeExt: team.badgeExt,
        predictedPos,
        realPos,
        points: 0
      });
      continue;
    }

    // Obtener puntos por cada posición
    const realPts = CLASSIFICATION_POINTS[realPos] || 0;
    const predictedPts = CLASSIFICATION_POINTS[predictedPos] || 0;

    // Regla: el valor más bajo de posición
    const pts = Math.min(realPts, predictedPts);
    totalPoints += pts;

    teamDetails.push({
      teamId,
      name: team.name,
      badgeExt: team.badgeExt,
      predictedPos,
      realPos,
      points: pts
    });
  }

  const result = { totalPoints, teamDetails };
  AppState.classificationPoints[username] = result;
  return result;
}

/**
 * Invalida la caché de clasificación real y puntos de clasificación
 * Se llama cuando se actualizan los matchStats
 */
function invalidateClassificationCache() {
  AppState.realStandings = [];
  AppState.classificationPoints = {};
}

// ============================================================
// TAB: FASE FINAL - PRONÓSTICOS
// ============================================================

/**
 * Renderiza la pestaña de predicciones de fase final
 */
async function renderFinalPredictionsTab() {
  const container = document.getElementById('final-predictions-container');
  if (!container) return;

  const frozen = AppState.predictionsConfirmed;
  
  const standings = calculatePredictedStandings();
  
  if (!standings || standings.length === 0) {
    container.innerHTML = `
      <div class="final-predictions-empty">
        <div class="empty-icon">📊</div>
        <div class="empty-text">Clasificación pronosticada no disponible</div>
        <div class="empty-subtext">Debes completar los 144 pronósticos de liga primero</div>
      </div>
    `;
    return;
  }

  const predictedTop8 = new Set(standings.slice(0, 8).map(t => t.teamId));

  function isTop8Predicted(teamId) {
    return predictedTop8.has(teamId);
  }

  const qualifiedTeams = standings.slice(0, 24).map(s => ({
    id: s.teamId,
    name: s.name,
    position: s.position
  }));

  if (!AppState.finalPredictions) {
    AppState.finalPredictions = {
      champion: null,
      runnerUp: null,
      semiFinalists: [],
      quarterFinalists: [],
      roundOf16: [],
      roundOf32: []
    };
  }

  const fp = AppState.finalPredictions;

  // Comprobar si hay equipos top-8 en deciseisavos (restricción de fase final)
  if (fp.roundOf32 && fp.roundOf32.length > 0) {
    const top8InRoundOf32 = fp.roundOf32.filter(teamId => isTop8Predicted(teamId));
    if (top8InRoundOf32.length > 0) {
      showToast('Hay equipos top-8 en deciseisavos que deben moverse a octavos o superior. No podrás guardar hasta corregirlo.');
      AppState.hasTop8InRoundOf32 = true;
    } else {
      AppState.hasTop8InRoundOf32 = false;
    }
  } else {
    AppState.hasTop8InRoundOf32 = false;
  }

  const assignedTeams = new Set([
    fp.champion,
    fp.runnerUp,
    ...fp.semiFinalists,
    ...fp.quarterFinalists,
    ...fp.roundOf16,
    ...fp.roundOf32
  ].filter(Boolean));

  const availableTeams = qualifiedTeams.filter(t => !assignedTeams.has(t.id));

  const savedScrollLeft = document.querySelector('.final-predictions-fixed')?.scrollTop || 0;
  const savedScrollRight = document.querySelector('.final-predictions-scroll')?.scrollTop || 0;

  function getTeamImg(teamId) {
    const ext = AppState.teamsMap[teamId]?.ext || 'png';
    return `data/imgEquipos/${teamId}.${ext}`;
  }

  // --- Champion podium slot ---
  function renderPodiumSlot(type, teamId) {
    const isChampion = type === 'champion';
    const label = isChampion ? 'Campeón' : 'Subcampeón';
    const icon = isChampion ? '🏆' : '🥈';

    if (teamId) {
      const team = qualifiedTeams.find(t => t.id === teamId);
      if (!team) return '';
      return `
        <div class="podium-slot ${type}">
          <span class="podium-label">${label}</span>
          <span class="podium-icon">${icon}</span>
          <div class="podium-team">
            <img class="podium-team-img" src="${getTeamImg(teamId)}" alt="${team.name}" onerror="this.src='data/imgEquipos/default.png'">
            <span class="podium-team-name">${team.name}</span>
          </div>
          ${!frozen ? `<div class="podium-remove" data-zone="${type}" data-action="remove-podium">✕</div>` : ''}
        </div>
      `;
    }
    return `
      <div class="podium-slot ${type}">
        <span class="podium-label">${label}</span>
        <span class="podium-icon">${icon}</span>
        <div class="podium-empty">
          <div class="podium-empty-icon">${icon}</div>
          <span class="podium-empty-text">Toca para asignar</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="final-predictions-layout">
      <div class="final-predictions-fixed">
        ${frozen ? `
          <div class="final-predictions-frozen">
            <div class="frozen-icon">🔒</div>
            <div class="frozen-text">Pronósticos confirmados</div>
            <div class="frozen-subtext">Los pronósticos han sido confirmados</div>
          </div>
        ` : ''}

        ${!frozen ? '<div class="selection-hint">Toca un equipo y luego un hueco para colocarlo</div>' : ''}

        <div class="teams-pool">
          <div class="teams-pool-header">Equipos disponibles (${availableTeams.length})</div>
          <div class="teams-pool-scroll" id="teams-pool-scroll">
            ${availableTeams.map(team => {
              const top8 = isTop8Predicted(team.id);
              return `
              <div class="team-chip ${top8 ? 'top-8' : ''} ${AppState.selectedFinalTeam === team.id ? 'selected' : ''}" data-team-id="${team.id}">
                <img class="team-chip-img" src="${getTeamImg(team.id)}" alt="${team.name}" onerror="this.src='data/imgEquipos/default.png'">
                <span class="team-chip-name">${team.name}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="final-predictions-scroll">
        <div class="podium-row">
          ${renderPodiumSlot('champion', fp.champion)}
          ${renderPodiumSlot('runnerUp', fp.runnerUp)}
        </div>

        <div class="drop-zones-container">
          ${renderDropZone('⚔️ Semifinalistas', 'semiFinalists', fp.semiFinalists, 2, qualifiedTeams, frozen)}
          ${renderDropZone('🏅 Cuartos de final', 'quarterFinalists', fp.quarterFinalists, 4, qualifiedTeams, frozen)}
          ${renderDropZone('⚡ Octavos de final', 'roundOf16', fp.roundOf16, 8, qualifiedTeams, frozen)}
          ${renderDropZone('📋 Dieciseisavos', 'roundOf32', fp.roundOf32, 8, qualifiedTeams, frozen)}
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    const left = document.querySelector('.final-predictions-fixed');
    const right = document.querySelector('.final-predictions-scroll');
    if (left) left.scrollTop = savedScrollLeft;
    if (right) right.scrollTop = savedScrollRight;
  });

  if (!frozen) {
    setupFinalPredictionsTapToPlace();

    document.querySelectorAll('.podium-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const zone = btn.getAttribute('data-zone');
        if (zone === 'champion') fp.champion = null;
        else if (zone === 'runnerUp') fp.runnerUp = null;
        AppState.hasUnsavedFinalChanges = true;
        await renderFinalPredictionsTab();
      });
    });
  }

  const headerSaveBtn = document.getElementById('btn-save-final-header');
  if (headerSaveBtn) {
    headerSaveBtn.disabled = frozen || AppState.hasTop8InRoundOf32;
    headerSaveBtn.style.display = frozen ? 'none' : '';
  }
}

function renderDropZone(title, zoneId, value, maxSlots, qualifiedTeams, frozen) {
  const values = Array.isArray(value) ? value : (value ? [value] : []);
  const isComplete = values.length === maxSlots;
  const slots = [];
  
  for (let i = 0; i < maxSlots; i++) {
    const teamId = values[i] || null;
    if (teamId) {
      const team = qualifiedTeams.find(t => t.id === teamId);
      if (team) {
        const ext = AppState.teamsMap[teamId]?.ext || 'png';
        slots.push(`
          <div class="drop-slot filled" data-zone="${zoneId}" data-index="${i}" data-team-id="${teamId}">
            <img class="drop-slot-img" src="data/imgEquipos/${teamId}.${ext}" alt="${team.name}" onerror="this.src='data/imgEquipos/default.png'">
            <span class="drop-slot-name">${team.name}</span>
            ${!frozen ? '<div class="drop-slot-remove" data-action="remove">✕</div>' : ''}
          </div>
        `);
      }
    } else {
      slots.push(`
        <div class="drop-slot" data-zone="${zoneId}" data-index="${i}">
          <span class="drop-slot-empty">+</span>
        </div>
      `);
    }
  }

  return `
    <div class="drop-zone" data-zone="${zoneId}">
      <div class="drop-zone-header">
        <span class="drop-zone-title">${title}</span>
        <span class="drop-zone-count ${isComplete ? 'complete' : ''}">${values.length}/${maxSlots}</span>
      </div>
      <div class="drop-zone-slots" data-zone="${zoneId}">
        ${slots.join('')}
      </div>
    </div>
  `;
}

/**
 * Configura tap-to-place para la fase final
 */
function setupFinalPredictionsTapToPlace() {
  const poolChips = document.querySelectorAll('.team-chip');
  poolChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      const teamId = parseInt(chip.getAttribute('data-team-id'));
      if (AppState.selectedFinalTeam === teamId) {
        AppState.selectedFinalTeam = null;
        chip.classList.remove('selected');
      } else {
        document.querySelectorAll('.team-chip.selected').forEach(c => c.classList.remove('selected'));
        AppState.selectedFinalTeam = teamId;
        chip.classList.add('selected');
      }
    });
  });

  const emptySlots = document.querySelectorAll('.drop-slot:not(.filled)');
  emptySlots.forEach(slot => {
    slot.addEventListener('click', () => {
      if (!AppState.selectedFinalTeam) return;
      const zoneId = slot.getAttribute('data-zone');
      const index = parseInt(slot.getAttribute('data-index'));
      addTeamToZone(AppState.selectedFinalTeam, zoneId, index);
      AppState.selectedFinalTeam = null;
    });
  });

  // Podium empty slots (champion / runnerUp)
  document.querySelectorAll('.podium-slot').forEach(slot => {
    if (slot.querySelector('.podium-empty')) {
      slot.addEventListener('click', () => {
        if (!AppState.selectedFinalTeam) return;
        const zone = slot.classList.contains('champion') ? 'champion' : 'runnerUp';
        addTeamToZone(AppState.selectedFinalTeam, zone, 0);
        AppState.selectedFinalTeam = null;
      });
    }
  });

  const removeButtons = document.querySelectorAll('.drop-slot-remove');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', handleRemoveFromZone);
  });
}

/**
 * Añade un equipo a una zona específica
 */
async function addTeamToZone(teamId, zoneId, index) {
  const fp = AppState.finalPredictions;
  if (!fp) return;

  // Validación: los 8 primeros clasificados no pueden ir a deciseisavos
  if (zoneId === 'roundOf32' && isTop8Predicted(teamId)) {
    showToast('Top 8 no va a dieciseisavos.<br>Pásalos a octavos o superior.');
    return;
  }

  // Si es zona individual (champion, runnerUp)
  if (zoneId === 'champion') {
    fp.champion = teamId;
  } else if (zoneId === 'runnerUp') {
    fp.runnerUp = teamId;
  } else {
    // Zonas de array
    const arr = fp[zoneId];
    if (Array.isArray(arr)) {
      // Si hay un equipo en ese índice, reemplazar
      if (index < arr.length) {
        arr[index] = teamId;
      } else {
        // Añadir al final
        arr.push(teamId);
      }
    }
  }

  AppState.hasUnsavedFinalChanges = true;
  await renderFinalPredictionsTab();
}

/**
 * Maneja la eliminación de un equipo de una zona
 */
function handleRemoveFromZone(e) {
  e.stopPropagation();
  const slot = e.target.closest('.drop-slot');
  if (!slot) return;

  const zoneId = slot.getAttribute('data-zone');
  const index = parseInt(slot.getAttribute('data-index'));
  const teamId = parseInt(slot.getAttribute('data-team-id'));

  removeTeamFromZone(zoneId, index, teamId);
}

/**
 * Elimina un equipo de una zona específica
 */
async function removeTeamFromZone(zoneId, index, teamId) {
  const fp = AppState.finalPredictions;
  if (!fp) return;

  if (zoneId === 'champion' && fp.champion === teamId) {
    fp.champion = null;
  } else if (zoneId === 'runnerUp' && fp.runnerUp === teamId) {
    fp.runnerUp = null;
  } else if (Array.isArray(fp[zoneId])) {
    const arr = fp[zoneId];
    const idx = arr.indexOf(teamId);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
  }

  AppState.hasUnsavedFinalChanges = true;
  await renderFinalPredictionsTab();
}

/**
 * Guarda las predicciones de fase final en el backend
 */
async function saveFinalPredictionsToBackend() {
  const token = AppState.sessionToken || localStorage.getItem('session_token');
  if (!token) {
    showToast('Debes iniciar sesión para guardar');
    return;
  }

  const fp = AppState.finalPredictions;
  if (!fp) {
    showToast('No hay predicciones para guardar');
    return;
  }

  try {
    const response = await fetchWithPhase(`${API_BASE}/api/final-predictions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ finalPredictions: fp })
    });

    const data = await response.json();

    if (data.ok) {
      AppState.hasUnsavedFinalChanges = false;
      showToast('✅ Predicciones guardadas correctamente');
    } else {
      showToast('❌ Error al guardar: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error saving final predictions:', error);
    showToast('❌ Error de conexión al guardar');
  }
}

/**
 * Obtiene las predicciones de fase final del backend
 */
async function fetchFinalPredictionsFromBackend() {
  if (!AppState.predictionsConfirmed) return;
  const token = AppState.sessionToken || localStorage.getItem('session_token');
  if (!token) return;

  try {
    const response = await fetchWithPhase(`${API_BASE}/api/final-predictions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.ok && data.finalPredictions) {
      AppState.finalPredictions = data.finalPredictions;
    }
  } catch (error) {
    console.error('Error fetching final predictions:', error);
  }
}
