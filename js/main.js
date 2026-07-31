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
  squadPicks: [],       // array de 11 jugadores seleccionados
  selectedAvatar: '⚽',
  wizardIndex: 0,
  blockedTeams: new Set(), // ids de equipos ya seleccionados
  appConfig: null,      // configuración del torneo desde backend
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
        squadSize: 11,
      };
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
  return `<img src="data/imgJugadores/${playerId}.${ext}" alt="${alt}"${cls} onerror="this.onerror=null;this.src='data/imgEquipos/${teamId}.${teamExt}'">`;
}

/** Devuelve el nombre de un equipo por su id */
function teamName(teamId) {
  return AppState.teamsMap[teamId]?.name || 'Desconocido';
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
function enterApp() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';

  updateUserHeader();
  navigateToTab('inicio');
  setupHeaderClick();
}

function navigateToTab(tabName) {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.tab-page');

  navItems.forEach(n => n.classList.remove('active'));
  pages.forEach(p => p.classList.remove('active'));

  const activeNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  const activePage = document.getElementById(`tab-${tabName}`);
  if (activeNav) activeNav.classList.add('active');
  if (activePage) activePage.classList.add('active');

  if (tabName === 'inicio') renderInicioTab();
  if (tabName === 'clasificacion') renderLeaderboard();
  if (tabName === 'pronosticos') renderPronosticosTab();
  if (tabName === 'plantilla') renderPlantillaTab();
}

// ============================================================
// TAB: INICIO
// ============================================================
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

function renderBlockedTeamsBar() {
  if (AppState.blockedTeams.size === 0) {
    return '<span class="blocked-teams-empty">Ningun equipo bloqueado aun</span>';
  }
  return Array.from(AppState.blockedTeams).map(teamId => {
    const t = AppState.teamsMap[teamId];
    return `
      <span class="blocked-team-tag">
        ${teamImgTag(teamId, t.ext, t.name, 'blocked-team-img')}
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
        ${playerImgTag(p.id, p.extension || 'png', p.equipo, AppState.teamsMap[p.equipo]?.ext || 'png', p.nombre, 'squad-chip-img')}
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
        ${playerImgTag(p.id, p.extension || 'png', p.equipo, AppState.teamsMap[p.equipo]?.ext || 'png', p.nombre, 'squad-player-img')}
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
    extension: player.extension || 'png',
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

      <button id="btn-logout" class="btn-primary" style="background: rgba(239,68,68,0.8); color: #fff; margin-top: 16px; width: 100%;">
        Cerrar Sesión
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-profile-modal');
  const logoutBtn = modal.querySelector('#btn-logout');

  closeBtn.addEventListener('click', () => modal.remove());
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('porra_ucl_user');
    localStorage.removeItem('session_token');
    AppState.currentUser = null;
    AppState.sessionToken = null;
    modal.remove();
    checkAuthStatus();
    showToast('Sesión cerrada correctamente');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
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
function renderPronosticosTab() {
  const container = document.getElementById('pronosticos-container');
  if (!container || !AppState.matches.length) return;

  container.innerHTML = `
    <div class="wizard-progress-bar">
      <div class="wizard-progress-fill" style="width: ${Math.round((Object.keys(AppState.scorePredictions).length / AppState.matches.length) * 100)}%"></div>
    </div>
    <p class="wizard-progress-text">
      <strong>${Object.keys(AppState.scorePredictions).length}</strong> de <strong>${AppState.matches.length}</strong> partidos pronosticados
    </p>
    <div id="wizard-match-container"></div>
  `;

  AppState.wizardIndex = 0;
  renderWizardMatchInTab();
}

function renderWizardMatchInTab() {
  const match = AppState.matches[AppState.wizardIndex];
  if (!match) return;

  const total = AppState.matches.length;
  const current = AppState.wizardIndex + 1;
  const savedPred = AppState.scorePredictions[match.id] || { home: 0, away: 0 };

  const container = document.getElementById('wizard-match-container');
  if (!container) return;

  container.innerHTML = `
    <div class="wizard-match-card">
      <p class="wizard-journey-label">${match.journey} &nbsp;&middot;&nbsp; ${match.fecha}</p>

      <div class="wizard-teams">
        <div class="wizard-team">
          <div class="wizard-team-badge">
            ${teamImgTag(match.homeTeamId, match.homeBadgeExt, match.homeTeam, '')}
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
            ${teamImgTag(match.awayTeamId, match.awayBadgeExt, match.awayTeam, '')}
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
      <p class="wizard-progress-text" style="margin: 0;">${current} / ${total}</p>
      <button class="btn-wizard-next" id="btn-wizard-next">
        ${current === total ? 'Último' : 'Siguiente →'}
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

  document.getElementById('home-minus')?.addEventListener('click', () => {
    if (homeGoals > 0) { homeGoals--; updateGoalsDisplay(); }
  });
  document.getElementById('home-plus')?.addEventListener('click', () => {
    homeGoals++;
    updateGoalsDisplay();
  });
  document.getElementById('away-minus')?.addEventListener('click', () => {
    if (awayGoals > 0) { awayGoals--; updateGoalsDisplay(); }
  });
  document.getElementById('away-plus')?.addEventListener('click', () => {
    awayGoals++;
    updateGoalsDisplay();
  });

  document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
    if (AppState.wizardIndex > 0) {
      AppState.wizardIndex--;
      renderWizardMatchInTab();
    }
  });

  document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
    AppState.scorePredictions[match.id] = { home: homeGoals, away: awayGoals };
    localStorage.setItem('porra_ucl_scores', JSON.stringify(AppState.scorePredictions));

    if (AppState.wizardIndex < AppState.matches.length - 1) {
      AppState.wizardIndex++;
      renderWizardMatchInTab();
    } else {
      showToast('¡Todos los partidos pronosticados!');
    }
  });
}

// ============================================================
// TAB: PLANTILLA IDEAL
// ============================================================
function renderPlantillaTab() {
  const container = document.getElementById('plantilla-container');
  if (!container) return;

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
    </div>
  `;

  // Evento de busqueda
  const searchInput = document.getElementById('squad-search-input');
  searchInput?.addEventListener('input', () => {
    const results = document.getElementById('squad-search-results');
    if (results) results.innerHTML = renderPlayerList(searchInput.value);
  });

  // Delegacion de eventos en el contenedor de resultados (anadir jugador)
  document.getElementById('squad-search-results')?.addEventListener('click', (e) => {
    const row = e.target.closest('.squad-player-row');
    if (row) {
      const playerId = parseInt(row.getAttribute('data-player-id'));
      addPlayerToSquad(playerId);
    }
  });

  // Delegacion de eventos en el contenedor de chips (quitar jugador)
  document.getElementById('squad-chips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.squad-chip-remove');
    if (btn) {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-remove-index'));
      removePlayerFromSquad(idx);
    }
  });
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
