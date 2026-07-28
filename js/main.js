/**
 * PORRA SPA - UEFA CHAMPIONS LEAGUE 2026/2027
 * Lógica Principal de Autenticación por Código, Pronósticos y Clasificación
 */

// Estado global de la aplicación
const AppState = {
  currentUser: null, // { code, name, avatar, points, hits }
  validCodes: [],
  matches: [],
  players: [],
  selectedAvatar: '⚽',
  predictions: {} // { matchId: '1'|'X'|'2' }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  checkAuthStatus();
  setupNavigation();
  setupAuthFlow();
  renderMatches();
  renderLeaderboard();
  renderStats();
  setupProfilePage();
});

/**
 * Cargar datos iniciales desde la carpeta data/ (JSON)
 */
async function loadInitialData() {
  try {
    const [codesRes, matchesRes, playersRes] = await Promise.all([
      fetch('data/codes.json').catch(() => null),
      fetch('data/matches.json').catch(() => null),
      fetch('data/players.json').catch(() => null)
    ]);

    if (codesRes && codesRes.ok) {
      AppState.validCodes = await codesRes.json();
    } else {
      // Fallback de códigos
      AppState.validCodes = [
        { code: "UCL2026", used: false },
        { code: "PORRA-CHAMPS", used: false },
        { code: "DEMO123", used: false }
      ];
    }

    if (matchesRes && matchesRes.ok) {
      AppState.matches = await matchesRes.json();
    }

    if (playersRes && playersRes.ok) {
      AppState.players = await playersRes.json();
    }

    // Cargar pronósticos guardados localmente
    const savedPreds = localStorage.getItem('porra_ucl_predictions');
    if (savedPreds) {
      AppState.predictions = JSON.parse(savedPreds);
    }
  } catch (err) {
    console.error('Error cargando ficheros JSON de data/:', err);
  }
}

/**
 * Comprobar estado de registro/autenticación en localStorage
 */
function checkAuthStatus() {
  const savedUser = localStorage.getItem('porra_ucl_user');
  const authOverlay = document.getElementById('auth-overlay');

  if (savedUser) {
    AppState.currentUser = JSON.parse(savedUser);
    if (authOverlay) authOverlay.style.display = 'none';
    updateUserHeader();
  } else {
    AppState.currentUser = null;
    if (authOverlay) authOverlay.style.display = 'flex';
  }
}

/**
 * Flujo de Validación de Código y Registro de Perfil
 */
function setupAuthFlow() {
  const step1 = document.getElementById('auth-step-1');
  const step2 = document.getElementById('auth-step-2');
  const btnValidate = document.getElementById('btn-validate-code');
  const btnComplete = document.getElementById('btn-complete-register');
  const inputCode = document.getElementById('input-access-code');
  const inputName = document.getElementById('input-player-name');
  const errorAlert = document.getElementById('auth-error-msg');
  const avatarOptions = document.querySelectorAll('.avatar-option');

  // Selección de Avatar
  avatarOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      avatarOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      AppState.selectedAvatar = opt.getAttribute('data-avatar');
    });
  });

  // Paso 1: Validar Código
  if (btnValidate) {
    btnValidate.addEventListener('click', () => {
      const enteredCode = inputCode.value.trim().toUpperCase();
      errorAlert.classList.remove('show');

      if (!enteredCode) {
        showAuthError('Por favor, introduce el código de invitación.');
        return;
      }

      // Buscar código en lista
      const matchCode = AppState.validCodes.find(c => c.code.toUpperCase() === enteredCode);

      if (!matchCode) {
        showAuthError('El código introducido no es válido. Comprueba el mensaje recibido.');
        return;
      }

      if (matchCode.used) {
        showAuthError('Este código ya ha sido utilizado por otro participante.');
        return;
      }

      // Código correcto: pasar al Paso 2
      step1.style.display = 'none';
      step2.style.display = 'flex';
      AppState.validatedCode = enteredCode;
    });
  }

  // Paso 2: Registro de Nombre y Avatar
  if (btnComplete) {
    btnComplete.addEventListener('click', () => {
      const name = inputName.value.trim();

      if (!name) {
        showToast('Introduce tu nombre de participante');
        return;
      }

      // Crear objeto de usuario
      const user = {
        code: AppState.validatedCode,
        name: name,
        avatar: AppState.selectedAvatar,
        points: 0,
        hits: 0
      };

      // Guardar en localStorage
      localStorage.setItem('porra_ucl_user', JSON.stringify(user));
      AppState.currentUser = user;

      // Marcar código como usado en memoria
      const codeObj = AppState.validCodes.find(c => c.code === user.code);
      if (codeObj) codeObj.used = true;

      // Ocultar modal
      document.getElementById('auth-overlay').style.display = 'none';
      updateUserHeader();
      renderLeaderboard();
      showToast(`¡Bienvenido a la Porra UCL, ${user.name}! 🚀`);
    });
  }

  function showAuthError(msg) {
    errorAlert.innerText = msg;
    errorAlert.classList.add('show');
  }
}

/**
 * Actualizar avatar y nombre en la barra superior
 */
function updateUserHeader() {
  const userPill = document.getElementById('user-status-pill');
  const userAvatar = document.getElementById('user-header-avatar');
  const userName = document.getElementById('user-header-name');

  if (AppState.currentUser) {
    if (userAvatar) userAvatar.innerText = AppState.currentUser.avatar;
    if (userName) userName.innerText = AppState.currentUser.name;
    if (userPill) userPill.style.display = 'flex';
  } else {
    if (userPill) userPill.style.display = 'none';
  }
}

/**
 * Renderizar tarjetas de partidos de la Champions League
 */
function renderMatches() {
  const container = document.getElementById('matches-container');
  if (!container || !AppState.matches.length) return;

  container.innerHTML = AppState.matches.map(m => {
    const selectedVal = AppState.predictions[m.id] || null;

    return `
      <article class="match-card" data-id="${m.id}" data-match="${m.homeTeam} vs ${m.awayTeam}">
        <div class="match-header">
          <span>${m.journey} • ${m.date}</span>
          ${m.popular ? '<span class="match-badge">🔥 Top Votado</span>' : ''}
        </div>

        <div class="teams-container">
          <div class="team">
            <div class="team-badge">${m.homeBadge}</div>
            <span class="team-name">${m.homeTeam}</span>
          </div>
          <div class="vs-pill">VS</div>
          <div class="team">
            <div class="team-badge">${m.awayBadge}</div>
            <span class="team-name">${m.awayTeam}</span>
          </div>
        </div>

        <!-- Selector de Pronóstico 1-X-2 -->
        <div class="prediction-selector">
          <button class="pred-btn ${selectedVal === '1' ? 'selected' : ''}" data-val="1">
            1
            <span class="label">Victoria Local</span>
          </button>
          <button class="pred-btn ${selectedVal === 'X' ? 'selected' : ''}" data-val="X">
            X
            <span class="label">Empate</span>
          </button>
          <button class="pred-btn ${selectedVal === '2' ? 'selected' : ''}" data-val="2">
            2
            <span class="label">Visitante</span>
          </button>
        </div>

        <!-- Tendencia de Voto de la Comunidad -->
        <div class="community-votes-bar">
          <div class="vote-segment v1" style="width: ${m.communityVotes['1']}"></div>
          <div class="vote-segment vx" style="width: ${m.communityVotes['X']}"></div>
          <div class="vote-segment v2" style="width: ${m.communityVotes['2']}"></div>
        </div>
        <div class="community-votes-labels">
          <span>1: ${m.communityVotes['1']}</span>
          <span>X: ${m.communityVotes['X']}</span>
          <span>2: ${m.communityVotes['2']}</span>
        </div>
      </article>
    `;
  }).join('');

  // Asignar eventos de clic a los botones 1-X-2
  container.querySelectorAll('.match-card').forEach(card => {
    const matchId = card.getAttribute('data-id');
    const matchName = card.getAttribute('data-match');
    const buttons = card.querySelectorAll('.pred-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.currentUser) {
          document.getElementById('auth-overlay').style.display = 'flex';
          showToast('Inicia sesión con tu código para pronosticar');
          return;
        }

        const val = btn.getAttribute('data-val');
        const isSelected = btn.classList.contains('selected');

        buttons.forEach(b => b.classList.remove('selected'));

        if (!isSelected) {
          btn.classList.add('selected');
          AppState.predictions[matchId] = val;
          localStorage.setItem('porra_ucl_predictions', JSON.stringify(AppState.predictions));
          showToast(`Pronóstico [${val}] guardado para ${matchName}`);
        } else {
          delete AppState.predictions[matchId];
          localStorage.setItem('porra_ucl_predictions', JSON.stringify(AppState.predictions));
        }
      });
    });
  });
}

/**
 * Renderizar la tabla de clasificación
 */
function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  let allPlayers = [...AppState.players];

  // Si hay usuario actual, incluirlo en la clasificación
  if (AppState.currentUser) {
    const exists = allPlayers.some(p => p.name === AppState.currentUser.name);
    if (!exists) {
      allPlayers.push({
        id: 'user-curr',
        name: AppState.currentUser.name,
        avatar: AppState.currentUser.avatar,
        points: AppState.currentUser.points || 0,
        hits: AppState.currentUser.hits || 0,
        isCurrentUser: true
      });
    }
  }

  // Ordenar por puntos de mayor a menor
  allPlayers.sort((a, b) => b.points - a.points);

  container.innerHTML = allPlayers.map((p, index) => {
    const rank = index + 1;
    const isMe = AppState.currentUser && p.name === AppState.currentUser.name;

    return `
      <div class="leaderboard-row ${isMe ? 'current-user' : ''}">
        <div class="rank-badge rank-${rank}">${rank}</div>
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${p.name} ${isMe ? '(Tú)' : ''}</div>
          <div class="player-stats-sub">${p.hits || 0} aciertos acumulados</div>
        </div>
        <div class="player-points">${p.points} <span style="font-size: 10px; color: var(--text-muted);">pts</span></div>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar sección de estadísticas de porra
 */
function renderStats() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  const totalPreds = Object.keys(AppState.predictions).length;

  container.innerHTML = `
    <div class="ucl-banner" style="background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);">
      <span class="ucl-tag">Estadísticas Rápidas</span>
      <h2 class="ucl-title">Tus Pronósticos Guardados</h2>
      <p class="ucl-subtitle">Has realizado <strong>${totalPreds} de ${AppState.matches.length}</strong> pronósticos de la Jornada 1.</p>
    </div>
  `;
}

/**
 * Configurar vista de perfil del usuario
 */
function setupProfilePage() {
  const profileContainer = document.getElementById('profile-content');
  const user = AppState.currentUser;

  if (!profileContainer) return;

  if (!user) {
    profileContainer.innerHTML = `
      <div class="match-card" style="text-align: center; padding: 30px;">
        <div style="font-size: 3rem; margin-bottom: 10px;">🔒</div>
        <h3>No has iniciado sesión</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px; margin-bottom: 16px;">
          Introduce tu código de acceso exclusivo para consultar tus datos.
        </p>
        <button id="btn-open-auth-modal" class="btn-primary">Introducir Código</button>
      </div>
    `;

    document.getElementById('btn-open-auth-modal')?.addEventListener('click', () => {
      document.getElementById('auth-overlay').style.display = 'flex';
    });
    return;
  }

  profileContainer.innerHTML = `
    <div class="match-card" style="text-align: center; padding: 24px;">
      <div style="font-size: 3.5rem; margin-bottom: 8px;">${user.avatar}</div>
      <h2 style="font-size: 1.4rem; font-weight: 800;">${user.name}</h2>
      <span class="ucl-tag" style="margin-top: 8px;">Código Usado: ${user.code}</span>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px;">
        <div style="background: var(--ucl-surface); padding: 14px; border-radius: var(--radius-md);">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-primary);">${user.points || 0}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">PUNTOS TOTALES</div>
        </div>
        <div style="background: var(--ucl-surface); padding: 14px; border-radius: var(--radius-md);">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-cyan);">${user.hits || 0}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">ACIERTOS</div>
        </div>
      </div>

      <button id="btn-logout" class="btn-primary" style="margin-top: 20px; background: #EF4444; color: #fff;">
        Cerrar Sesión
      </button>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('porra_ucl_user');
    AppState.currentUser = null;
    checkAuthStatus();
    renderLeaderboard();
    setupProfilePage();
    showToast('Sesión cerrada correctamente');
  });
}

/**
 * Control de navegación por pestañas (Inicio, Clasificación, Estadísticas, Perfil)
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.tab-page');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      const targetTab = item.getAttribute('data-tab');

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      pages.forEach(page => {
        if (page.id === `tab-${targetTab}`) {
          page.classList.add('active');
        } else {
          page.classList.remove('active');
        }
      });

      if (targetTab === 'perfil') setupProfilePage();
      if (targetTab === 'estadisticas') renderStats();
    });
  });
}

/**
 * Helper para notificaciones tipo Toast
 */
function showToast(message) {
  const existingToast = document.querySelector('.toast-msg');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerText = message;

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
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  });

  const viewport = document.getElementById('app-viewport');
  (viewport || document.body).appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
