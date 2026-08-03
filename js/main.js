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
  hideBlocked: false,   // ocultar jugadores de equipos bloqueados
  savedSquadSnapshot: [], // snapshot de plantilla al guardar para comparar
  matchStats: [],       // Array de todos los matchstats del backend
  allPredictions: {},   // { username: { matchId: { home, away } } }
  userPoints: {},       // { username: { totalPoints, matchDetails } }
  squadsCache: {},      // { username: squad[] } - caché de plantillas para resultados
  currentSquadDetails: [], // detalles de plantilla para modal de desglose
};

const SQUAD_SIZE = 25;

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
      const configRes = await fetch(`${API_BASE}/api/config`);
      const configData = await configRes.json();
      if (configData.ok) AppState.appConfig = configData.config;
    } catch (e) {
      // config por defecto si falla
      AppState.appConfig = {
        championsFreezeDate: '2026-09-15T21:00:00Z',
        championsFreezeLabel: 'Fase de Grupos',
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
    const res = await fetch(`${API_BASE}/api/predictions?username=${AppState.currentUser.username}`);
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
  try {
    const res = await fetch(`${API_BASE}/api/predictions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: AppState.currentUser.username,
        predictions: AppState.scorePredictions
      })
    });
    const data = await res.json();
    if (data.ok) {
      AppState.hasUnsavedChanges = false;
      localStorage.removeItem('porra_ucl_scores');
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

/** Devuelve el nombre de un equipo por su id */
function teamImgTag(teamId, ext, alt, className) {
  const cls = className ? ` class="${className}"` : '';
  return `<img src="data/imgEquipos/${teamId}.${ext}" alt="${alt}"${cls}>`;
}

/** Genera tag <img> para jugador con fallback a escudo del equipo */
function playerImgTag(playerId, ext, teamId, teamExt, alt, className) {
  const cls = className ? ` class="${className}"` : '';
  const fallbackExt = ext === 'png' ? 'webp' : 'png';
  return `<img src="data/imgJugadores/${playerId}.${ext}" alt="${alt}"${cls} onerror="this.onerror=null;this.src='data/imgJugadores/${playerId}.${fallbackExt}';this.onerror=function(){this.onerror=null;this.src='data/imgEquipos/${teamId}.${teamExt}'}">`;
}

/** Devuelve el nombre de un equipo por su id */
function teamName(teamId) {
  return AppState.teamsMap[teamId]?.name || 'Desconocido';
}

/** Filtro de jugadores por texto y posición activa */
function filterPlayers(query, selectedIds, positionFilter, teamFilter, hideBlocked) {
  const q = query.toLowerCase().trim();
  return AppState.allPlayers.filter(p => {
    if (selectedIds.has(p.id)) return false;
    if (positionFilter && p.posicion !== positionFilter) return false;
    if (teamFilter && p.equipo !== parseInt(teamFilter)) return false;
    if (hideBlocked && AppState.blockedTeams.has(p.equipo)) return false;
    if (q && !p.nombre.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ============================================================
// FUNCIONES DE CALCULO DE PUNTOS
// ============================================================

/** Obtiene todos los matchstats del backend */
async function fetchMatchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/match-stats`);
    const data = await res.json();
    if (data.ok && data.matchStats) {
      AppState.matchStats = data.matchStats;
    }
  } catch (e) {
    console.error('Error cargando matchstats:', e);
  }
}

/** Obtiene las predicciones de todos los usuarios del backend */
async function fetchAllPredictions() {
  try {
    const res = await fetch(`${API_BASE}/api/predictions/all`);
    const data = await res.json();
    if (data.ok && data.predictions) {
      AppState.allPredictions = data.predictions;
    }
  } catch (e) {
    console.error('Error cargando todas las predicciones:', e);
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
  const rivalId = Object.keys(matchStat.stats || {}).find(id => id !== equipoId && id !== 'jugadores');
  const golesEquipoRival = rivalId ? (matchStat.stats[rivalId]?.goles || 0) : 0;
  const golesRecibidosPortero = squadPlayer.posicion === 'G' ? (playerData.golesRecibidos || 0) : golesEquipoRival;
  if (golesRecibidosPortero === 0 && playerData.minutos > 70) {
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

  for (const squadPlayer of squad) {
    let jugadorTotal = 0;
    const partidos = [];

    for (const ms of matchStats) {
      const jugadorData = ms.stats?.jugadores?.find(j => String(j.id) === String(squadPlayer.id));
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

  // Siempre refrescar datos al entrar
  container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando datos...</div>`;
  await Promise.all([fetchPlayers(), fetchMatchStats(), fetchAllPredictions()]);

  const players = AppState.players || [];

  if (!players.length) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando clasificación...</div>`;
    return;
  }

  // Calcular puntos reales para cada usuario (predicciones + plantilla)
  const playersWithPoints = await Promise.all(players.map(async p => {
    const userData = calculateUserTotalPoints(p.name);
    AppState.userPoints[p.name] = userData;

    // Obtener plantilla y calcular puntos de plantilla
    let squadPoints = 0;
    try {
      const res = await fetch(`${API_BASE}/api/squad?username=${encodeURIComponent(p.name)}`);
      const data = await res.json();
      if (data.ok && data.squad && data.squad.length) {
        const { totalPoints } = calculateSquadPoints(data.squad, AppState.matchStats);
        squadPoints = totalPoints;
      }
    } catch (e) { /* sin plantilla */ }

    return {
      ...p,
      predictionPoints: userData.totalPoints,
      squadPoints,
      realPoints: userData.totalPoints + squadPoints
    };
  }));

  // Ordenar por puntos descendente
  playersWithPoints.sort((a, b) => b.realPoints - a.realPoints);

  container.innerHTML = playersWithPoints.map((p, i) => {
    const rank = i + 1;
    const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
    const breakdownParts = [];
    if (p.predictionPoints) breakdownParts.push(`${p.predictionPoints} pronósticos`);
    if (p.squadPoints) breakdownParts.push(`${p.squadPoints} plantilla`);
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
                  <img class="profile-match-badge" src="data/imgEquipos/${m.match.homeTeamId}.${m.match.homeBadgeExt}" alt="${m.match.homeTeam}" onerror="this.style.display='none'">
                  <span>${m.match.homeTeam}</span>
                </div>
                <div class="profile-match-score">
                  <span class="profile-score-pred ${homeCorrect ? 'correct' : ''}">${predHome !== null && predHome !== undefined ? predHome : '-'}</span>
                  <span class="profile-score-sep">-</span>
                  <span class="profile-score-pred ${awayCorrect ? 'correct' : ''}">${predAway !== null && predAway !== undefined ? predAway : '-'}</span>
                </div>
                <div class="profile-match-team">
                  <span>${m.match.awayTeam}</span>
                  <img class="profile-match-badge" src="data/imgEquipos/${m.match.awayTeamId}.${m.match.awayBadgeExt}" alt="${m.match.awayTeam}" onerror="this.style.display='none'">
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
    const res = await fetch(`${API_BASE}/api/squad?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!data.ok || !data.squad || !data.squad.length) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Este usuario no tiene plantilla</div>';
      return;
    }

    const squad = data.squad;
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
            <img class="profile-squad-img" src="data/imgJugadores/${p.id}.${p.extension || 'png'}" alt="${p.nombre}" onerror="this.onerror=null;this.src='data/imgJugadores/${p.id}.webp'">
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

  // Siempre refrescar datos al entrar
  container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando datos...</div>`;
  await Promise.all([fetchMatchStats(), fetchAllPredictions()]);

  if (!AppState.matchStats.length) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay resultados disponibles aún.</div>`;
    return;
  }

  // Precargar plantillas de todos los usuarios
  const squadsCache = {};
  if (AppState.players.length) {
    const squadPromises = AppState.players.map(async p => {
      try {
        const res = await fetch(`${API_BASE}/api/squad?username=${encodeURIComponent(p.name)}`);
        const data = await res.json();
        if (data.ok && data.squad) squadsCache[p.name] = data.squad;
      } catch (e) { /* ignore */ }
    });
    await Promise.all(squadPromises);
  }
  AppState.squadsCache = squadsCache;

  // Agrupar partidos por jornada
  const matchesByJourney = {};
  for (const match of AppState.matches) {
    const matchStats = AppState.matchStats.find(ms => ms.eventId === match.id);
    if (!matchStats) continue;

    const journey = match.journey;
    if (!matchesByJourney[journey]) matchesByJourney[journey] = [];

    const stats = matchStats.stats;
    const homeGoals = stats[match.homeTeamId]?.goles;
    const awayGoals = stats[match.awayTeamId]?.goles;

    matchesByJourney[journey].push({
      match,
      homeGoals,
      awayGoals,
    });
  }

  if (!Object.keys(matchesByJourney).length) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay resultados disponibles aún.</div>`;
    return;
  }

  let html = '';
  for (const [journey, matches] of Object.entries(matchesByJourney)) {
    html += `
      <div class="resultados-journey">
        <div class="resultados-journey-header">
          <h3 class="resultados-journey-title">${journey}</h3>
          <span class="resultados-journey-count">${matches.length} partido${matches.length > 1 ? 's' : ''}</span>
        </div>
        ${matches.map(m => renderMatchResult(m)).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
}

/** Renderiza el resultado de un partido con puntos de jugadores */
function renderMatchResult({ match, homeGoals, awayGoals }) {
  let playersHtml = '';
  const matchStats = AppState.matchStats.find(ms => ms.eventId === match.id);

  for (const player of AppState.players) {
    const predictions = AppState.allPredictions[player.name] || {};
    const prediction = predictions[match.id];

    let points = 0;
    let breakdown = [];

    const predHome = prediction?.home;
    const predAway = prediction?.away;
    const hasPrediction = prediction && predHome !== null && predHome !== undefined && predAway !== null && predAway !== undefined;

    if (hasPrediction) {
      const result = calculateMatchPoints(prediction, matchStats, match);
      points = result.points;
      breakdown = result.breakdown;
    } else {
      breakdown = ['Partido no pronosticado'];
    }

    // Calcular puntos de plantilla para este partido
    let squadPoints = 0;
    let squadBreakdown = [];
    const userSquad = AppState.squadsCache?.[player.name];
    if (userSquad && matchStats) {
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

    const predStr = hasPrediction ? `${predHome} - ${predAway}` : 'Sin pronóstico';
    const totalUserPoints = points + squadPoints;

    playersHtml += `
      <div class="resultados-player ${totalUserPoints > 0 ? 'has-points' : 'no-points'}">
        <span class="resultados-player-name">${player.avatar} ${player.name}</span>
        <span class="resultados-player-pred">${predStr}</span>
        <span class="resultados-player-points">${totalUserPoints} pts</span>
        <span class="resultados-player-breakdown">
          ${points !== 0 ? `${points} pronóst.` : ''}
          ${squadPoints !== 0 ? `${squadPoints > 0 ? '+' : ''}${squadPoints} plant.` : ''}
          ${points === 0 && squadPoints === 0 ? breakdown.join(', ') : ''}
        </span>
      </div>
    `;

    // Mostrar desglose de jugadores de plantilla si hay puntos
    if (squadBreakdown.length > 0) {
      playersHtml += '<div class="resultados-squad-breakdown">';
      for (const sb of squadBreakdown) {
        const conceptos = sb.desglose.map(d => d.concepto).join(', ');
        playersHtml += `
          <div class="resultados-squad-item">
            <span class="resultados-squad-name">${sb.nombre}</span>
            <span class="resultados-squad-pts ${sb.puntos >= 0 ? 'positive' : 'negative'}">${sb.puntos > 0 ? '+' : ''}${sb.puntos} pts</span>
            <span class="resultados-squad-conceptos">${conceptos}</span>
          </div>
        `;
      }
      playersHtml += '</div>';
    }
  }

  return `
    <div class="resultados-match">
      <div class="resultados-match-header">
        <div class="resultados-team">
          ${teamImgTag(match.homeTeamId, match.homeBadgeExt, match.homeTeam, 'resultados-badge')}
          <span class="resultados-team-name">${match.homeTeam}</span>
        </div>
        <div class="resultados-score">
          <span class="resultados-goals">${homeGoals}</span>
          <span class="resultados-separator">-</span>
          <span class="resultados-goals">${awayGoals}</span>
        </div>
        <div class="resultados-team">
          ${teamImgTag(match.awayTeamId, match.awayBadgeExt, match.awayTeam, 'resultados-badge')}
          <span class="resultados-team-name">${match.awayTeam}</span>
        </div>
      </div>
      <div class="resultados-players">
        <div class="resultados-players-title">Puntos por jugador:</div>
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

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
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
      const res = await fetch(`${API_BASE}/api/auth/login`, {
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
        const user = {
          username: data.user.username,
          name: data.user.username,
          avatar: data.user.avatar,
          points: 0,
          hits: 0,
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
    await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: AppState.currentUser.username,
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
  navigateToTab('inicio');
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
  const squadSize = config.squadSize || 11;
  const predicted = Object.keys(AppState.scorePredictions).length;
  const pending = totalMatches - predicted;
  const squadCount = AppState.squadPicks.length;
  const squadPending = squadSize - squadCount;

  // Calcular tiempo hasta freeze
  const freezeDate = config.championsFreezeDate ? new Date(config.championsFreezeDate) : null;
  const now = new Date();
  const isFrozen = freezeDate && now >= freezeDate;
  let freezeHtml = '';

  if (freezeDate && !isFrozen) {
    const diff = freezeDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let timeStr = '';
    if (days > 0) timeStr = `${days}d ${hours}h`;
    else if (hours > 0) timeStr = `${hours}h ${mins}min`;
    else timeStr = `${mins} minutos`;

    freezeHtml = `
      <div class="inicio-card inicio-freeze">
        <div class="inicio-card-icon">🔒</div>
        <div class="inicio-card-content">
          <div class="inicio-card-title">${config.championsFreezeLabel || 'Champions League'}</div>
          <div class="inicio-card-desc">
            Comienza en <strong>${timeStr}</strong>.<br>
            A partir de ese momento no podrás modificar pronósticos ni plantilla.
          </div>
        </div>
      </div>
    `;
  } else if (isFrozen) {
    freezeHtml = `
      <div class="inicio-card inicio-freeze frozen">
        <div class="inicio-card-icon">🔒</div>
        <div class="inicio-card-content">
          <div class="inicio-card-title">Ronda en curso</div>
          <div class="inicio-card-desc">
            La ${config.championsFreezeLabel || 'Champions League'} está en marcha. Los pronós y la plantilla están bloqueados.
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="inicio-welcome">
      <div class="inicio-avatar">${user.avatar}</div>
      <h2 class="inicio-greeting">Hola, ${user.name}! 👋</h2>
      <p class="inicio-subtitle">Bienvenido a la Porra UCL 2026/27</p>
    </div>

    ${freezeHtml}

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
    const res = await fetch(`${API_BASE}/api/avatars/taken`);
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
    const res = await fetch(`${API_BASE}/api/players`);
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

      <button id="btn-logout" class="btn-primary" style="background: rgba(239,68,68,0.8); color: #fff; margin-top: 8px; width: 100%;">
        Cerrar Sesión
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-profile-modal');
  const logoutBtn = modal.querySelector('#btn-logout');
  const changePasswordBtn = modal.querySelector('#btn-change-password');

  closeBtn.addEventListener('click', () => modal.remove());
  changePasswordBtn.addEventListener('click', () => {
    modal.remove();
    showChangePasswordModal();
  });
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
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: AppState.currentUser.username,
          currentPassword,
          newPassword
        })
      });
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

  container.innerHTML = `
    <div class="pronosticos-top-fixed">
      <div class="pronosticos-actions-row">
        <button class="save-predictions-btn" id="btn-save-predictions" disabled>💾 Guardar en servidor</button>
        <button class="standings-btn" id="btn-show-standings" onclick="showPredictedStandings()">📊 Ver Clasificación</button>
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
  if (btn) btn.disabled = !AppState.hasUnsavedChanges;
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
  const posCount = countByPosition(position);
  const maxCount = SQUAD_FORMATION[position].count;
  if (posCount >= maxCount) return;

  AppState.activeSlot = { position, index };
  AppState.teamFilter = null;
  AppState.hideBlocked = false;
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
  const hideBlocked = AppState.hideBlocked;
  const players = filterPlayers(query, selectedIds, positionFilter, teamFilter, hideBlocked);

  if (players.length === 0) {
    results.innerHTML = '<p class="squad-no-results">No se encontraron jugadores</p>';
    return;
  }

  results.innerHTML = players.slice(0, 50).map(p => {
    const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
    const team = AppState.teamsMap[p.equipo];
    const isBlocked = AppState.blockedTeams.has(p.equipo);
    return `
      <div class="squad-player-row ${isBlocked ? 'blocked' : ''}" data-player-id="${p.id}" ${isBlocked ? 'data-blocked="true"' : ''}>
        ${playerImgTag(p.id, p.extension || 'png', p.equipo, team?.ext || 'png', p.nombre, 'squad-player-img')}
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
        const team = AppState.teamsMap[player.equipo];
        const sourcePlayer = AppState.allPlayers.find(p => p.id === player.id);
        const playerExt = sourcePlayer?.extension || player.extension || 'png';
        slots.push(`
          <div class="squad-slot filled" data-position="${pos}" data-index="${i}">
            ${playerImgTag(player.id, playerExt, player.equipo, team?.ext || 'png', player.nombre, 'squad-slot-img')}
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

  container.innerHTML = `
    <div class="squad-picker-wrapper">

      <!-- Cabecera fija -->
      <div class="squad-top-fixed">
        <!-- Resumen -->
        <div class="squad-summary">
          <span class="squad-summary-text">Tu Plantilla (<span id="squad-count">${totalSelected}</span>/${SQUAD_SIZE})</span>
          <button class="squad-save-btn" id="btn-save-squad" ${totalSelected === 0 ? 'disabled' : ''}>💾 Guardar</button>
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
            <label class="squad-hide-blocked-toggle">
              <input type="checkbox" id="squad-hide-blocked" class="squad-hide-blocked-checkbox">
              <span class="squad-hide-blocked-label">No mostrar usados</span>
            </label>
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
  searchInput?.addEventListener('input', () => {
    renderSearchResults(searchInput.value);
  });

  // Checkbox ocultar bloqueados
  const hideBlockedCheck = document.getElementById('squad-hide-blocked');
  hideBlockedCheck?.addEventListener('change', (e) => {
    AppState.hideBlocked = e.target.checked;
    renderSearchResults(searchInput?.value || '');
  });

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

  const btn = document.getElementById('btn-save-squad');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/squad`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: AppState.currentUser.username,
        squad: AppState.squadPicks
      })
    });
    const data = await res.json();
    if (data.ok) {
      AppState.hasUnsavedSquadChanges = false;
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
    const res = await fetch(`${API_BASE}/api/squad?username=${AppState.currentUser.username}`);
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
  toast.textContent = message;

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
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    zIndex: '2000',
    opacity: '0',
    whiteSpace: 'nowrap',
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
        <td><img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="standings-badge-img" alt="${team.name}" onerror="this.style.display='none'"></td>
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
