/**
 * PORRA SPA - UEFA Champions League 2026/2027
 * Flujo completo: Codigo → Perfil → Wizard Partidos → Plantilla Ideal → App
 */

// ============================================================
// ESTADO GLOBAL
// ============================================================
const AppState = {
  currentUser: null,
  validCodes: [],
  teamsMap: {},         // { teamId: { name, image } }
  matches: [],          // partidos transformados para la app
  allPlayers: [],       // array plano de jugadores desde jugadores.json
  scorePredictions: {}, // { matchId: { home: 0, away: 0 } }
  squadPicks: [],       // array de 11 jugadores seleccionados
  selectedAvatar: '⚽',
  validatedCode: null,
  wizardIndex: 0,
  blockedTeams: new Set(), // ids de equipos ya seleccionados
};

const SQUAD_SIZE = 11;

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
        AppState.teamsMap[t.id] = { name: t.name, image: `data/imgEquipos/${t.id}.png` };
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

    // Recuperar predicciones guardadas localmente
    const savedScores = localStorage.getItem('porra_ucl_scores');
    if (savedScores) AppState.scorePredictions = JSON.parse(savedScores);

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

/** Transforma un partido del calendar.json al formato interno de la app */
function buildMatchFromCalendar(m) {
  const localId = m.equipoLocal.id;
  const visitId = m.equipoVisitante.id;
  const localTeam = AppState.teamsMap[localId] || { name: m.equipoLocal.name, image: '' };
  const visitTeam = AppState.teamsMap[visitId] || { name: m.equipoVisitante.name, image: '' };

  return {
    id: m.id,
    ronda: m.ronda,
    fechaTs: m.fecha,
    fecha: formatDate(m.fecha),
    journey: `Jornada ${m.ronda}`,
    homeTeam: localTeam.name,
    homeTeamId: localId,
    homeBadge: localTeam.image,
    awayTeam: visitTeam.name,
    awayTeamId: visitId,
    awayBadge: visitTeam.image,
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

/** Devuelve la ruta de imagen de un equipo por su id */
function teamImage(teamId) {
  return AppState.teamsMap[teamId]?.image || '';
}

/** Genera tag <img> para equipo con fallback png/webp */
function teamImgTag(teamId, alt, className) {
  const base = `data/imgEquipos/${teamId}`;
  const cls = className ? ` class="${className}"` : '';
  return `<img src="${base}.png" alt="${alt}"${cls} onerror="this.onerror=null;this.src='${base}.webp'">`;
}

/** Genera tag <img> para jugador con fallback a webp y luego escudo del equipo */
function playerImgTag(playerId, teamId, alt, className) {
  const cls = className ? ` class="${className}"` : '';
  return `<img src="data/imgJugadores/${playerId}.png" alt="${alt}"${cls} onerror="this.onerror=function(){this.onerror=null;this.src='data/imgEquipos/${teamId}.png'};this.src='data/imgJugadores/${playerId}.webp'">`;
}

/** Devuelve el nombre de un equipo por su id */
function teamName(teamId) {
  return AppState.teamsMap[teamId]?.name || 'Desconocido';
}

/** Devuelve la imagen de un jugador por su id */
function playerImage(playerId) {
  return `data/imgJugadores/${playerId}.png`;
}

/** Filtro de jugadores por texto y equipos bloqueados */
function filterPlayers(query, selectedIds) {
  const q = query.toLowerCase().trim();
  return AppState.allPlayers.filter(p => {
    if (selectedIds.has(p.id)) return false;
    if (AppState.blockedTeams.has(p.equipo)) return false;
    if (q && !p.nombre.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ============================================================
// AUTENTICACION Y FLUJO DE REGISTRO
// ============================================================
function checkAuthStatus() {
  const savedUser = localStorage.getItem('porra_ucl_user');
  const authOverlay = document.getElementById('auth-overlay');

  if (savedUser) {
    AppState.currentUser = JSON.parse(savedUser);
    if (authOverlay) authOverlay.style.display = 'none';
    updateUserHeader();
    renderMatchesList();
    renderLeaderboard();
    renderStats();
    setupProfilePage();
  } else {
    AppState.currentUser = null;
    if (authOverlay) {
      authOverlay.style.display = 'flex';
      setupAuthFlow();
    }
  }
}

function setupAuthFlow() {
  document.getElementById('btn-validate-code')?.addEventListener('click', validateCode);

  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      AppState.selectedAvatar = opt.getAttribute('data-avatar');
    });
  });

  document.getElementById('btn-complete-register')?.addEventListener('click', completeProfile);
}

function validateCode() {
  const input = document.getElementById('input-access-code');
  const errorEl = document.getElementById('auth-error-msg');
  const code = input.value.trim().toUpperCase();

  errorEl.classList.remove('show');

  if (!code) {
    showAuthError('Por favor, introduce el codigo de invitacion.', errorEl);
    return;
  }

  const found = AppState.validCodes.find(c => c.code.toUpperCase() === code);
  if (!found) {
    showAuthError('Codigo no valido. Comprueba el mensaje recibido.', errorEl);
    return;
  }
  if (found.used) {
    showAuthError('Este codigo ya ha sido utilizado por otro participante.', errorEl);
    return;
  }

  AppState.validatedCode = code;
  goToAuthStep(2);
}

function completeProfile() {
  const nameInput = document.getElementById('input-player-name');
  const name = nameInput?.value.trim();

  if (!name) {
    showToast('Introduce tu nombre de participante');
    return;
  }

  const user = {
    code: AppState.validatedCode,
    name,
    avatar: AppState.selectedAvatar,
    points: 0,
    hits: 0,
  };

  localStorage.setItem('porra_ucl_user', JSON.stringify(user));
  AppState.currentUser = user;

  const codeObj = AppState.validCodes.find(c => c.code === user.code);
  if (codeObj) codeObj.used = true;

  goToAuthStep(3);
  startWizard();
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
}

function showAuthError(msg, el) {
  el.innerText = msg;
  el.classList.add('show');
}

// ============================================================
// WIZARD — PREDICCION PARTIDO A PARTIDO
// ============================================================
function startWizard() {
  AppState.wizardIndex = 0;
  renderWizardMatch();
}

function renderWizardMatch() {
  const match = AppState.matches[AppState.wizardIndex];
  if (!match) return;

  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.scrollTop = 0;

  const total = AppState.matches.length;
  const current = AppState.wizardIndex + 1;
  const savedPred = AppState.scorePredictions[match.id] || { home: 0, away: 0 };

  const container = document.getElementById('wizard-match-container');
  if (!container) return;

  const pct = Math.round(((current - 1) / total) * 100);

  container.innerHTML = `
    <div class="wizard-progress-bar">
      <div class="wizard-progress-fill" style="width: ${pct}%"></div>
    </div>
    <p class="wizard-progress-text">
      Partido <strong>${current}</strong> de <strong>${total}</strong> &nbsp;&middot;&nbsp;
      ${Object.keys(AppState.scorePredictions).length} guardados
    </p>

    <div class="wizard-match-card">
      <p class="wizard-journey-label">${match.journey} &nbsp;&middot;&nbsp; ${match.fecha}</p>

      <div class="wizard-teams">
        <div class="wizard-team">
          <div class="wizard-team-badge">
            ${teamImgTag(match.homeTeamId, match.homeTeam, '')}
          </div>
          <div class="wizard-team-name">${match.homeTeam}</div>
          <div class="goals-control">
            <span class="goals-label">Goles</span>
            <div class="goals-counter">
              <button class="goals-btn" id="home-minus" aria-label="Restar gol local">&minus;</button>
              <div class="goals-value" id="home-goals">${savedPred.home}</div>
              <button class="goals-btn" id="home-plus" aria-label="Anadir gol local">+</button>
            </div>
          </div>
        </div>

        <div class="wizard-score-divider">
          <span class="wizard-score-sep">&ndash;</span>
          <span class="wizard-date">VS</span>
        </div>

        <div class="wizard-team">
          <div class="wizard-team-badge">
            ${teamImgTag(match.awayTeamId, match.awayTeam, '')}
          </div>
          <div class="wizard-team-name">${match.awayTeam}</div>
          <div class="goals-control">
            <span class="goals-label">Goles</span>
            <div class="goals-counter">
              <button class="goals-btn" id="away-minus" aria-label="Restar gol visitante">&minus;</button>
              <div class="goals-value" id="away-goals">${savedPred.away}</div>
              <button class="goals-btn" id="away-plus" aria-label="Anadir gol visitante">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="wizard-nav">
      <button class="btn-wizard-prev" id="btn-wizard-prev" ${AppState.wizardIndex === 0 ? 'disabled' : ''}>
        &larr; Anterior
      </button>
      <button class="btn-wizard-next" id="btn-wizard-next">
        ${current === total ? 'Plantilla Ideal &rarr;' : 'Siguiente &rarr;'}
      </button>
    </div>
  `;

  let homeGoals = savedPred.home;
  let awayGoals = savedPred.away;

  function updateGoalsDisplay() {
    document.getElementById('home-goals').textContent = homeGoals;
    document.getElementById('away-goals').textContent = awayGoals;
    AppState.scorePredictions[match.id] = { home: homeGoals, away: awayGoals };
    localStorage.setItem('porra_ucl_scores', JSON.stringify(AppState.scorePredictions));
  }

  document.getElementById('home-minus').addEventListener('click', () => {
    if (homeGoals > 0) { homeGoals--; updateGoalsDisplay(); }
  });
  document.getElementById('home-plus').addEventListener('click', () => {
    homeGoals++;
    updateGoalsDisplay();
  });
  document.getElementById('away-minus').addEventListener('click', () => {
    if (awayGoals > 0) { awayGoals--; updateGoalsDisplay(); }
  });
  document.getElementById('away-plus').addEventListener('click', () => {
    awayGoals++;
    updateGoalsDisplay();
  });

  document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
    if (AppState.wizardIndex > 0) {
      AppState.wizardIndex--;
      renderWizardMatch();
    }
  });

  document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
    AppState.scorePredictions[match.id] = { home: homeGoals, away: awayGoals };
    localStorage.setItem('porra_ucl_scores', JSON.stringify(AppState.scorePredictions));

    if (AppState.wizardIndex < AppState.matches.length - 1) {
      AppState.wizardIndex++;
      renderWizardMatch();
    } else {
      goToAuthStep(4);
      renderSquadPicker();
    }
  });
}

// ============================================================
// WIZARD — PLANTILLA IDEAL (11 jugadores, busqueda, sin repetir equipo)
// ============================================================
function renderSquadPicker() {
  const container = document.getElementById('squad-picker-container');
  if (!container) return;

  const selectedIds = new Set(AppState.squadPicks.map(p => p.id));

  container.innerHTML = `
    <div class="squad-picker-wrapper">

      <!-- Barra de equipos bloqueados -->
      <div class="blocked-teams-bar" id="blocked-teams-bar">
        ${renderBlockedTeamsBar()}
      </div>

      <!-- Jugadores seleccionados -->
      <div class="squad-selected-section">
        <p class="squad-selected-title">Tu Once (<span id="squad-count">${AppState.squadPicks.length}</span>/${SQUAD_SIZE})</p>
        <div class="squad-chips-container" id="squad-chips">
          ${renderSquadChips()}
        </div>
      </div>

      <!-- Busqueda -->
      <div class="squad-search-wrapper">
        <input type="text" class="squad-search-input" id="squad-search-input"
               placeholder="Buscar jugador por nombre..." autocomplete="off" spellcheck="false">
      </div>

      <!-- Resultados -->
      <div class="squad-players-list" id="squad-search-results">
        ${renderPlayerList('')}
      </div>

      <!-- Boton finalizar -->
      <button class="btn-primary" id="btn-finish-squad"
        ${AppState.squadPicks.length === SQUAD_SIZE ? '' : 'disabled'}>
        Finalizar y Guardar Porra
      </button>
    </div>
  `;

  // Evento de busqueda
  const searchInput = document.getElementById('squad-search-input');
  searchInput?.addEventListener('input', () => {
    const results = document.getElementById('squad-search-results');
    if (results) results.innerHTML = renderPlayerList(searchInput.value);
    attachPlayerRowEvents();
  });

  // Eventos de filas de jugadores
  attachPlayerRowEvents();

  // Evento finalizar
  document.getElementById('btn-finish-squad')?.addEventListener('click', finishRegistration);
}

function renderBlockedTeamsBar() {
  if (AppState.blockedTeams.size === 0) {
    return '<span class="blocked-teams-empty">Ningun equipo bloqueado aun</span>';
  }
  return Array.from(AppState.blockedTeams).map(teamId => {
    const t = AppState.teamsMap[teamId];
    return `
      <span class="blocked-team-tag">
        ${teamImgTag(teamId, t.name, 'blocked-team-img')}
        ${t?.name || 'Equipo'}
      </span>
    `;
  }).join('');
}

function renderSquadChips() {
  if (AppState.squadPicks.length === 0) {
    return '<p class="squad-chips-empty">Anade jugadores desde la lista de abajo</p>';
  }
  return AppState.squadPicks.map((p, i) => {
    const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
    return `
      <div class="squad-chip">
        ${playerImgTag(p.id, p.equipo, p.nombre, 'squad-chip-img')}
        <div class="squad-chip-info">
          <span class="squad-chip-name">${p.nombre}</span>
          <span class="squad-chip-team">${p.club} &middot; ${posLabel}</span>
        </div>
        <button class="squad-chip-remove" data-remove-index="${i}" aria-label="Quitar ${p.nombre}">&times;</button>
      </div>
    `;
  }).join('');
}

function renderPlayerList(query) {
  const selectedIds = new Set(AppState.squadPicks.map(p => p.id));
  const players = filterPlayers(query, selectedIds);

  if (players.length === 0) {
    return '<p class="squad-no-results">No se encontraron jugadores</p>';
  }

  return players.slice(0, 50).map(p => {
    const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
    return `
      <div class="squad-player-row" data-player-id="${p.id}">
        ${playerImgTag(p.id, p.equipo, p.nombre, 'squad-player-img')}
        <div class="squad-player-info">
          <div class="squad-player-name">${p.nombre}</div>
          <div class="squad-player-team">${p.club}</div>
        </div>
        <span class="squad-player-pos">${posLabel}</span>
        <button class="squad-add-btn" data-player-id="${p.id}" aria-label="Anadir ${p.nombre}">+</button>
      </div>
    `;
  }).join('');
}

function attachPlayerRowEvents() {
  // Botones de anadir
  document.querySelectorAll('.squad-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerId = parseInt(btn.getAttribute('data-player-id'));
      addPlayerToSquad(playerId);
    });
  });

  // Filas clickeables tambien anaden
  document.querySelectorAll('.squad-player-row').forEach(row => {
    row.addEventListener('click', () => {
      const playerId = parseInt(row.getAttribute('data-player-id'));
      addPlayerToSquad(playerId);
    });
  });

  // Botones de quitar del chip
  document.querySelectorAll('.squad-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-remove-index'));
      removePlayerFromSquad(idx);
    });
  });
}

function addPlayerToSquad(playerId) {
  if (AppState.squadPicks.length >= SQUAD_SIZE) return;
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
  });

  AppState.blockedTeams.add(player.equipo);
  localStorage.setItem('porra_ucl_squad', JSON.stringify(AppState.squadPicks));

  refreshSquadUI();
}

function removePlayerFromSquad(index) {
  if (index < 0 || index >= AppState.squadPicks.length) return;

  const removed = AppState.squadPicks.splice(index, 1)[0];

  // Verificar si queda algun jugador de ese equipo
  const stillHasTeam = AppState.squadPicks.some(p => p.equipo === removed.equipo);
  if (!stillHasTeam) {
    AppState.blockedTeams.delete(removed.equipo);
  }

  localStorage.setItem('porra_ucl_squad', JSON.stringify(AppState.squadPicks));
  refreshSquadUI();
}

function refreshSquadUI() {
  const chipsContainer = document.getElementById('squad-chips');
  const blockedBar = document.getElementById('blocked-teams-bar');
  const countEl = document.getElementById('squad-count');
  const finishBtn = document.getElementById('btn-finish-squad');
  const searchInput = document.getElementById('squad-search-input');
  const results = document.getElementById('squad-search-results');

  if (chipsContainer) chipsContainer.innerHTML = renderSquadChips();
  if (blockedBar) blockedBar.innerHTML = renderBlockedTeamsBar();
  if (countEl) countEl.textContent = AppState.squadPicks.length;
  if (finishBtn) finishBtn.disabled = AppState.squadPicks.length !== SQUAD_SIZE;
  if (results) results.innerHTML = renderPlayerList(searchInput?.value || '');

  // Re-attach events
  document.querySelectorAll('.squad-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-remove-index'));
      removePlayerFromSquad(idx);
    });
  });
  attachPlayerRowEvents();
}

// ============================================================
// LISTA DE PARTIDOS (pestana Inicio — solo lectura)
// ============================================================
function renderMatchesList() {
  const container = document.getElementById('matches-list');
  if (!container || !AppState.matches.length) return;

  container.innerHTML = AppState.matches.map(m => {
    const pred = AppState.scorePredictions[m.id];
    return `
      <div class="match-card">
        <div class="match-header">
          <span>${m.journey} &middot; ${m.fecha}</span>
          ${pred ? '<span class="match-badge" style="background: rgba(16,185,129,0.15); color: var(--accent-primary);">Pronosticado</span>' : '<span class="match-badge">Pendiente</span>'}
        </div>
        <div class="teams-container">
          <div class="team">
            <div class="team-badge">
              ${teamImgTag(m.homeTeamId, m.homeTeam, '')}
            </div>
            <span class="team-name">${m.homeTeam}</span>
          </div>
          <div class="vs-pill" style="${pred ? 'color: var(--accent-cyan); font-size: 1.1rem;' : ''}">
            ${pred ? `${pred.home} – ${pred.away}` : 'VS'}
          </div>
          <div class="team">
            <div class="team-badge">
              ${teamImgTag(m.awayTeamId, m.awayTeam, '')}
            </div>
            <span class="team-name">${m.awayTeam}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
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
// ESTADISTICAS
// ============================================================
function renderStats() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  const total = AppState.matches.length;
  const saved = Object.keys(AppState.scorePredictions).length;
  const squad = AppState.squadPicks;
  const squadComplete = squad.length === SQUAD_SIZE;

  container.innerHTML = `
    <div class="ucl-banner" style="background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);">
      <span class="ucl-tag">Mis Predicciones</span>
      <h2 class="ucl-title">Estado de tu Porra</h2>
      <p class="ucl-subtitle">
        Marcadores introducidos: <strong style="color: var(--accent-cyan)">${saved} de ${total} partidos</strong>
      </p>
    </div>

    <div class="match-card">
      <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Plantilla Ideal (${squad.length}/${SQUAD_SIZE})</p>
      ${squadComplete ? `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${squad.map((p, i) => {
            const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
            return `
              <div style="display: flex; align-items: center; gap: 12px;">
                ${playerImgTag(p.id, p.equipo, p.nombre, 'squad-chip-img')}
                <span style="font-size: 10px; font-weight: 800; color: var(--accent-cyan); width: 30px;">${posLabel}</span>
                <div>
                  <div style="font-weight: 700; font-size: var(--font-size-sm);">${p.nombre}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${p.club}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : squad.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${squad.map(p => {
            const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
            return `<span style="font-size: 12px; color: var(--text-secondary);">${posLabel} - ${p.nombre} (${p.club})</span>`;
          }).join('')}
          <p style="color: var(--accent-gold); font-size: 11px; font-weight: 700; margin-top: 4px;">Faltan ${SQUAD_SIZE - squad.length} jugadores</p>
        </div>
      ` : `
        <p style="color: var(--text-muted); font-size: var(--font-size-xs);">Plantilla ideal no completada todavia.</p>
      `}
    </div>

    ${AppState.currentUser ? `
    <div class="match-card" style="gap: 10px;">
      <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Ultimas Predicciones de Marcadores</p>
      ${AppState.matches.slice(0, 5).map(m => {
        const pred = AppState.scorePredictions[m.id];
        return pred ? `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-sm);">
            <span style="color: var(--text-secondary); flex: 1; font-size: 11px;">${m.homeTeam} vs ${m.awayTeam}</span>
            <span style="font-weight: 800; color: var(--accent-cyan);">${pred.home} – ${pred.away}</span>
          </div>
        ` : '';
      }).join('')}
    </div>
    ` : ''}
  `;
}

// ============================================================
// PERFIL
// ============================================================
function setupProfilePage() {
  const container = document.getElementById('profile-content');
  if (!container) return;

  const user = AppState.currentUser;

  if (!user) {
    container.innerHTML = `
      <div class="match-card" style="text-align: center; padding: 30px; gap: 16px;">
        <div style="font-size: 3rem;">🔒</div>
        <h3>No has iniciado sesion</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Introduce tu codigo de acceso exclusivo.</p>
        <button id="btn-open-auth" class="btn-primary">Introducir Codigo</button>
      </div>
    `;
    document.getElementById('btn-open-auth')?.addEventListener('click', () => {
      const overlay = document.getElementById('auth-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        setupAuthFlow();
      }
    });
    return;
  }

  const squad = AppState.squadPicks;
  const saved = Object.keys(AppState.scorePredictions).length;

  container.innerHTML = `
    <div class="match-card" style="text-align: center; padding: 24px; gap: 16px;">
      <div style="font-size: 3.5rem;">${user.avatar}</div>
      <h2 style="font-size: 1.4rem; font-weight: 800;">${user.name}</h2>
      <span class="ucl-tag">Codigo: ${user.code}</span>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 4px;">
        <div style="background: var(--ucl-surface); padding: 12px 8px; border-radius: var(--radius-md);">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-primary);">${user.points || 0}</div>
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">PUNTOS</div>
        </div>
        <div style="background: var(--ucl-surface); padding: 12px 8px; border-radius: var(--radius-md);">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-cyan);">${user.hits || 0}</div>
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">ACIERTOS</div>
        </div>
        <div style="background: var(--ucl-surface); padding: 12px 8px; border-radius: var(--radius-md);">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-gold);">${saved}</div>
          <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">PARTIDOS</div>
        </div>
      </div>

      ${squad.length > 0 ? `
      <div style="text-align: left; width: 100%;">
        <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px;">Mi Plantilla Ideal (${squad.length}/${SQUAD_SIZE})</p>
        ${squad.map(p => {
          const posLabel = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' }[p.posicion] || p.posicion;
          return `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              ${playerImgTag(p.id, p.equipo, p.nombre, 'squad-chip-img')}
              <span style="font-size: 10px; font-weight: 800; color: var(--accent-cyan); width: 28px;">${posLabel}</span>
              <div>
                <span style="font-weight: 700; font-size: var(--font-size-sm);">${p.nombre}</span>
                <span style="font-size: 11px; color: var(--text-muted);"> — ${p.club}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      <button id="btn-logout" class="btn-primary" style="background: rgba(239,68,68,0.8); color: #fff; margin-top: 4px;">
        Cerrar Sesion
      </button>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('porra_ucl_user');
    AppState.currentUser = null;
    checkAuthStatus();
    setupProfilePage();
    showToast('Sesion cerrada correctamente');
  });
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

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      pages.forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

      if (tab === 'perfil') setupProfilePage();
      if (tab === 'estadisticas') renderStats();
      if (tab === 'clasificacion') renderLeaderboard();
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
