/**
 * PORRA SPA - UEFA Champions League 2026/2027
 * Flujo completo: Código → Perfil → Wizard Partidos → Plantilla Ideal → App
 */

// ============================================================
// DATOS FALLBACK de jugadores (por si falla el fetch del JSON)
// ============================================================
const FALLBACK_CHAMP_PLAYERS = {
  goalkeepers: [
    { id: 'gk1', name: 'Thibaut Courtois', team: 'Real Madrid', badge: '👑' },
    { id: 'gk2', name: 'Gianluigi Donnarumma', team: 'PSG', badge: '🔵' },
    { id: 'gk3', name: 'Marc-André ter Stegen', team: 'FC Barcelona', badge: '🔵🔴' },
    { id: 'gk4', name: 'Alisson Becker', team: 'Liverpool', badge: '🔴' },
    { id: 'gk5', name: 'Manuel Neuer', team: 'Bayern München', badge: '🔴' },
  ],
  defenders: [
    { id: 'df1', name: 'Antonio Rüdiger', team: 'Real Madrid', badge: '👑' },
    { id: 'df2', name: 'William Saliba', team: 'Arsenal', badge: '🔴⚪' },
    { id: 'df3', name: 'Virgil van Dijk', team: 'Liverpool', badge: '🔴' },
    { id: 'df4', name: 'Alessandro Bastoni', team: 'Inter de Milán', badge: '⚫🔵' },
    { id: 'df5', name: 'Marquinhos', team: 'PSG', badge: '🔵' },
  ],
  midfielders: [
    { id: 'mf1', name: 'Jude Bellingham', team: 'Real Madrid', badge: '👑' },
    { id: 'mf2', name: 'Rodri Hernández', team: 'Manchester City', badge: '🩵' },
    { id: 'mf3', name: 'Pedri González', team: 'FC Barcelona', badge: '🔵🔴' },
    { id: 'mf4', name: 'Kevin De Bruyne', team: 'Manchester City', badge: '🩵' },
    { id: 'mf5', name: 'Federico Valverde', team: 'Real Madrid', badge: '👑' },
  ],
  forwards: [
    { id: 'fw1', name: 'Kylian Mbappé', team: 'Real Madrid', badge: '👑' },
    { id: 'fw2', name: 'Erling Haaland', team: 'Manchester City', badge: '🩵' },
    { id: 'fw3', name: 'Vinícius Júnior', team: 'Real Madrid', badge: '👑' },
    { id: 'fw4', name: 'Harry Kane', team: 'Bayern München', badge: '🔴' },
    { id: 'fw5', name: 'Robert Lewandowski', team: 'FC Barcelona', badge: '🔵🔴' },
  ],
};

// ============================================================
// ESTADO GLOBAL
// ============================================================
const AppState = {
  currentUser: null,     // { code, name, avatar, points, hits }
  validCodes: [],
  matches: [],
  players: [],
  champPlayers: FALLBACK_CHAMP_PLAYERS,
  // Predicciones de marcadores: { matchId: { home: 0, away: 0 } }
  scorePredictions: {},
  // Plantilla ideal: { goalkeeper: null, defender: null, midfielder: null, forward: null }
  squadPicks: { goalkeeper: null, defender: null, midfielder: null, forward: null },
  selectedAvatar: '⚽',
  validatedCode: null,
  // Wizard estado
  wizardIndex: 0,
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
    const [codesRes, matchesRes, playersRes, champRes] = await Promise.all([
      fetch('data/codes.json').catch(() => null),
      fetch('data/matches.json').catch(() => null),
      fetch('data/players.json').catch(() => null),
      fetch('data/champions_players.json').catch(() => null),
    ]);

    AppState.validCodes = codesRes?.ok
      ? await codesRes.json()
      : [{ code: 'UCL2026', used: false }, { code: 'PORRA-CHAMPS', used: false }, { code: 'DEMO123', used: false }];

    if (matchesRes?.ok) AppState.matches = await matchesRes.json();
    if (playersRes?.ok) AppState.players = await playersRes.json();

    if (champRes?.ok) {
      const champData = await champRes.json();
      // Asegurar que las claves existen y tienen datos válidos
      AppState.champPlayers = {
        goalkeepers: champData.goalkeepers?.length ? champData.goalkeepers : FALLBACK_CHAMP_PLAYERS.goalkeepers,
        defenders:   champData.defenders?.length   ? champData.defenders   : FALLBACK_CHAMP_PLAYERS.defenders,
        midfielders: champData.midfielders?.length ? champData.midfielders : FALLBACK_CHAMP_PLAYERS.midfielders,
        forwards:    champData.forwards?.length    ? champData.forwards    : FALLBACK_CHAMP_PLAYERS.forwards,
      };
      console.log('✅ champions_players.json cargado — porteros:', AppState.champPlayers.goalkeepers.length);
    } else {
      console.warn('⚠️ champions_players.json no disponible, usando datos fallback.');
    }

    // Recuperar predicciones guardadas localmente
    const savedScores = localStorage.getItem('porra_ucl_scores');
    if (savedScores) AppState.scorePredictions = JSON.parse(savedScores);

    const savedSquad = localStorage.getItem('porra_ucl_squad');
    if (savedSquad) AppState.squadPicks = JSON.parse(savedSquad);

  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

// ============================================================
// AUTENTICACIÓN Y FLUJO DE REGISTRO
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
  // --- Paso 1: Código de acceso ---
  document.getElementById('btn-validate-code')?.addEventListener('click', validateCode);

  // --- Paso 2: Nombre + Avatar ---
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
    showAuthError('Por favor, introduce el código de invitación.', errorEl);
    return;
  }

  const found = AppState.validCodes.find(c => c.code.toUpperCase() === code);
  if (!found) {
    showAuthError('Código no válido. Comprueba el mensaje recibido.', errorEl);
    return;
  }
  if (found.used) {
    showAuthError('Este código ya ha sido utilizado por otro participante.', errorEl);
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

  // Paso 3: Iniciar wizard de predicciones
  goToAuthStep(3);
  startWizard();
}

function goToAuthStep(step) {
  document.querySelectorAll('.auth-step').forEach(el => el.style.display = 'none');
  const el = document.getElementById(`auth-step-${step}`);
  if (el) el.style.display = 'flex';

  // Volver al inicio del overlay al cambiar de paso
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.scrollTop = 0;

  // Actualizar indicadores de paso
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
// WIZARD — PREDICCIÓN PARTIDO A PARTIDO
// ============================================================
function startWizard() {
  AppState.wizardIndex = 0;
  renderWizardMatch();
}

function renderWizardMatch() {
  const match = AppState.matches[AppState.wizardIndex];
  if (!match) return;

  // Scroll al inicio al cambiar de partido
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.scrollTop = 0;

  const total = AppState.matches.length;
  const current = AppState.wizardIndex + 1;
  const savedPred = AppState.scorePredictions[match.id] || { home: 0, away: 0 };

  const container = document.getElementById('wizard-match-container');
  if (!container) return;

  // Barra de progreso
  const pct = Math.round(((current - 1) / total) * 100);

  container.innerHTML = `
    <div class="wizard-progress-bar">
      <div class="wizard-progress-fill" style="width: ${pct}%"></div>
    </div>
    <p class="wizard-progress-text">
      Partido <strong>${current}</strong> de <strong>${total}</strong> &nbsp;·&nbsp;
      ${Object.keys(AppState.scorePredictions).length} guardados
    </p>

    <div class="wizard-match-card">
      <p class="wizard-journey-label">${match.journey} &nbsp;·&nbsp; ${match.date}</p>

      <div class="wizard-teams">

        <!-- Equipo Local -->
        <div class="wizard-team">
          <div class="wizard-team-badge">${match.homeBadge}</div>
          <div class="wizard-team-name">${match.homeTeam}</div>
          <div class="goals-control">
            <span class="goals-label">Goles</span>
            <div class="goals-counter">
              <button class="goals-btn" id="home-minus" aria-label="Restar gol local">−</button>
              <div class="goals-value" id="home-goals">${savedPred.home}</div>
              <button class="goals-btn" id="home-plus" aria-label="Añadir gol local">+</button>
            </div>
          </div>
        </div>

        <!-- Separador -->
        <div class="wizard-score-divider">
          <span class="wizard-score-sep">–</span>
          <span class="wizard-date">VS</span>
        </div>

        <!-- Equipo Visitante -->
        <div class="wizard-team">
          <div class="wizard-team-badge">${match.awayBadge}</div>
          <div class="wizard-team-name">${match.awayTeam}</div>
          <div class="goals-control">
            <span class="goals-label">Goles</span>
            <div class="goals-counter">
              <button class="goals-btn" id="away-minus" aria-label="Restar gol visitante">−</button>
              <div class="goals-value" id="away-goals">${savedPred.away}</div>
              <button class="goals-btn" id="away-plus" aria-label="Añadir gol visitante">+</button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Navegación -->
    <div class="wizard-nav">
      <button class="btn-wizard-prev" id="btn-wizard-prev" ${AppState.wizardIndex === 0 ? 'disabled' : ''}>
        ← Anterior
      </button>
      <button class="btn-wizard-next" id="btn-wizard-next">
        ${current === total ? 'Plantilla Ideal →' : 'Siguiente →'}
      </button>
    </div>
  `;

  // Variables temporales de goles para este partido
  let homeGoals = savedPred.home;
  let awayGoals = savedPred.away;

  function updateGoalsDisplay() {
    document.getElementById('home-goals').textContent = homeGoals;
    document.getElementById('away-goals').textContent = awayGoals;
    // Guardar automáticamente cada cambio
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
    // Guardar antes de avanzar
    AppState.scorePredictions[match.id] = { home: homeGoals, away: awayGoals };
    localStorage.setItem('porra_ucl_scores', JSON.stringify(AppState.scorePredictions));

    if (AppState.wizardIndex < AppState.matches.length - 1) {
      AppState.wizardIndex++;
      renderWizardMatch();
    } else {
      // Pasar al wizard de Plantilla Ideal
      goToAuthStep(4);
      renderSquadPicker();
    }
  });
}

// ============================================================
// WIZARD — PLANTILLA IDEAL
// ============================================================
function renderSquadPicker() {
  const container = document.getElementById('squad-picker-container');
  if (!container) return;

  const positions = [
    { key: 'goalkeeper', label: 'Portero', pill: 'POR', players: AppState.champPlayers.goalkeepers || [] },
    { key: 'defender', label: 'Defensa', pill: 'DEF', players: AppState.champPlayers.defenders || [] },
    { key: 'midfielder', label: 'Centrocampista', pill: 'MED', players: AppState.champPlayers.midfielders || [] },
    { key: 'forward', label: 'Delantero', pill: 'DEL', players: AppState.champPlayers.forwards || [] },
  ];

  container.innerHTML = `
    <div class="squad-section">
      ${positions.map(pos => `
        <div>
          <div class="squad-position-label">
            <span class="position-pill">${pos.pill}</span>
            <span class="position-name">${pos.label}</span>
          </div>
          <div class="squad-players-list" id="list-${pos.key}">
            ${pos.players.map(p => `
              <div class="squad-player-row ${AppState.squadPicks[pos.key]?.id === p.id ? 'selected' : ''}"
                   data-pos="${pos.key}" data-id="${p.id}" data-name="${p.name}" data-team="${p.team}" data-badge="${p.badge}">
                <div class="squad-team-badge">${p.badge}</div>
                <div class="squad-player-info">
                  <div class="squad-player-name">${p.name}</div>
                  <div class="squad-player-team">${p.team}</div>
                </div>
                <div class="squad-check"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Resumen -->
    <div class="squad-summary">
      <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Tu Selección Actual</p>
      ${positions.map(pos => `
        <div class="squad-summary-row">
          <span class="squad-summary-pos">${pos.pill}</span>
          <span class="squad-summary-player ${AppState.squadPicks[pos.key] ? '' : 'squad-summary-empty'}" id="summary-${pos.key}">
            ${AppState.squadPicks[pos.key]?.name || 'No seleccionado'}
          </span>
        </div>
      `).join('')}
    </div>

    <button class="btn-primary" id="btn-finish-squad">Finalizar y Guardar Porra ✅</button>
  `;

  // Eventos de selección
  container.querySelectorAll('.squad-player-row').forEach(row => {
    row.addEventListener('click', () => {
      const pos = row.getAttribute('data-pos');
      const id = row.getAttribute('data-id');
      const name = row.getAttribute('data-name');
      const team = row.getAttribute('data-team');
      const badge = row.getAttribute('data-badge');

      // Deseleccionar otros de la misma posición
      document.querySelectorAll(`[data-pos="${pos}"]`).forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');

      AppState.squadPicks[pos] = { id, name, team, badge };
      localStorage.setItem('porra_ucl_squad', JSON.stringify(AppState.squadPicks));

      // Actualizar resumen
      const summaryEl = document.getElementById(`summary-${pos}`);
      if (summaryEl) {
        summaryEl.textContent = name;
        summaryEl.classList.remove('squad-summary-empty');
      }
    });
  });

  // Botón Finalizar
  document.getElementById('btn-finish-squad')?.addEventListener('click', finishRegistration);
}

function finishRegistration() {
  const picks = AppState.squadPicks;
  const allSelected = picks.goalkeeper && picks.defender && picks.midfielder && picks.forward;

  if (!allSelected) {
    showToast('¡Selecciona un jugador para cada posición! 👆');
    return;
  }

  // Cerrar overlay y lanzar la app
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';

  updateUserHeader();
  renderMatchesList();
  renderLeaderboard();
  renderStats();
  setupProfilePage();


  showToast(`¡Porra guardada, ${AppState.currentUser.name}! 🚀🏆`);
}

// ============================================================
// LISTA DE PARTIDOS (pestaña Inicio — solo lectura)
// ============================================================
function renderMatchesList() {
  const container = document.getElementById('matches-list');
  if (!container || !AppState.matches.length) return;

  container.innerHTML = AppState.matches.map(m => {
    const pred = AppState.scorePredictions[m.id];
    return `
      <div class="match-card">
        <div class="match-header">
          <span>${m.journey} · ${m.date}</span>
          ${pred ? '<span class="match-badge" style="background: rgba(16,185,129,0.15); color: var(--accent-primary);">✓ Pronosticado</span>' : '<span class="match-badge">Pendiente</span>'}
        </div>
        <div class="teams-container">
          <div class="team">
            <div class="team-badge">${m.homeBadge}</div>
            <span class="team-name">${m.homeTeam}</span>
          </div>
          <div class="vs-pill" style="${pred ? 'color: var(--accent-cyan); font-size: 1.1rem;' : ''}">
            ${pred ? `${pred.home} – ${pred.away}` : 'VS'}
          </div>
          <div class="team">
            <div class="team-badge">${m.awayBadge}</div>
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
// CLASIFICACIÓN
// ============================================================
function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  let all = [...AppState.players];

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
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Aún no hay participantes registrados.</div>`;
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
          <div class="player-name">${p.name}${isMe ? ' <span style="color:var(--accent-primary)">(Tú)</span>' : ''}</div>
          <div class="player-stats-sub">${p.hits || 0} aciertos acumulados</div>
        </div>
        <div class="player-points">${p.points} <span style="font-size:10px;color:var(--text-muted)">pts</span></div>
      </div>
    `;
  }).join('');
}

// ============================================================
// ESTADÍSTICAS
// ============================================================
function renderStats() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  const total = AppState.matches.length;
  const saved = Object.keys(AppState.scorePredictions).length;
  const squad = AppState.squadPicks;
  const squadComplete = squad.goalkeeper && squad.defender && squad.midfielder && squad.forward;

  container.innerHTML = `
    <div class="ucl-banner" style="background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);">
      <span class="ucl-tag">📊 Mis Predicciones</span>
      <h2 class="ucl-title">Estado de tu Porra</h2>
      <p class="ucl-subtitle">
        Marcadores introducidos: <strong style="color: var(--accent-cyan)">${saved} de ${total} partidos</strong>
      </p>
    </div>

    <div class="match-card">
      <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Plantilla Ideal</p>
      ${squadComplete ? `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${[
            { label: 'POR', val: squad.goalkeeper },
            { label: 'DEF', val: squad.defender },
            { label: 'MED', val: squad.midfielder },
            { label: 'DEL', val: squad.forward },
          ].map(r => `
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 10px; font-weight: 800; color: var(--accent-cyan); width: 30px;">${r.label}</span>
              <span style="font-size: 1.2rem;">${r.val.badge}</span>
              <div>
                <div style="font-weight: 700; font-size: var(--font-size-sm);">${r.val.name}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${r.val.team}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <p style="color: var(--text-muted); font-size: var(--font-size-xs);">Plantilla ideal no completada todavía.</p>
      `}
    </div>

    ${AppState.currentUser ? `
    <div class="match-card" style="gap: 10px;">
      <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Últimas Predicciones de Marcadores</p>
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
        <h3>No has iniciado sesión</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Introduce tu código de acceso exclusivo.</p>
        <button id="btn-open-auth" class="btn-primary">Introducir Código</button>
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
      <span class="ucl-tag">Código: ${user.code}</span>

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

      ${squad.goalkeeper ? `
      <div style="text-align: left; width: 100%;">
        <p style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px;">Mi Plantilla Ideal</p>
        ${[
          { label: 'POR', val: squad.goalkeeper },
          { label: 'DEF', val: squad.defender },
          { label: 'MED', val: squad.midfielder },
          { label: 'DEL', val: squad.forward },
        ].map(r => `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 10px; font-weight: 800; color: var(--accent-cyan); width: 28px;">${r.label}</span>
            <span style="font-size: 1.1rem;">${r.val?.badge || ''}</span>
            <span style="font-weight: 700; font-size: var(--font-size-sm);">${r.val?.name || ''}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <button id="btn-logout" class="btn-primary" style="background: rgba(239,68,68,0.8); color: #fff; margin-top: 4px;">
        Cerrar Sesión
      </button>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('porra_ucl_user');
    AppState.currentUser = null;
    checkAuthStatus();
    setupProfilePage();
    showToast('Sesión cerrada correctamente');
  });
}

// ============================================================
// NAVEGACIÓN
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
