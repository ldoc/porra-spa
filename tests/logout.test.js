const assert = require('assert');

// ── Mocks del entorno del navegador ─────────────────────────────
let localStorageStore = {};
global.localStorage = {
  getItem: k => (k in localStorageStore ? localStorageStore[k] : null),
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: k => { delete localStorageStore[k]; },
};

let cacheCleared = 0;
const porraCache = { clearPorraCaches: () => { cacheCleared++; } };

const AppState = {
  currentUser: null,
  sessionToken: null,
  _allPredictionsSeeded: true,
  hasUnsavedChanges: true,
  hasUnsavedSquadChanges: true,
  hasUnsavedFinalChanges: true,
};

let authStatusCalls = 0;
let countdownCalls = 0;
let pollingCalls = 0;
function checkAuthStatus() { authStatusCalls++; }
function clearInicioCountdown() { countdownCalls++; }
function stopMatchStatsPolling() { pollingCalls++; }

// ── Funciones espejo de main.js (versión corregida) ─────────────
function logout() {
  localStorage.removeItem('porra_ucl_user');
  localStorage.removeItem('session_token');
  porraCache.clearPorraCaches();
  AppState._allPredictionsSeeded = false;
  AppState.currentUser = null;
  AppState.sessionToken = null;
  AppState.hasUnsavedChanges = false;
  AppState.hasUnsavedSquadChanges = false;
  AppState.hasUnsavedFinalChanges = false;
  clearInicioCountdown();
  stopMatchStatsPolling();
  checkAuthStatus();
}

// Decisión de "Guardar y cerrar sesión": solo se cierra si TODOS los saves requeridos OK
function shouldCloseSessionAfterSave(hasPredictions, hasSquad, predOk, squadOk) {
  if (hasPredictions && predOk !== true) return false;
  if (hasSquad && squadOk !== true) return false;
  return true;
}

// ── Tests ───────────────────────────────────────────────────────

function reset() {
  localStorageStore = { session_token: 'tok', porra_ucl_user: '{"name":"juan"}' };
  cacheCleared = 0;
  authStatusCalls = 0;
  countdownCalls = 0;
  pollingCalls = 0;
  AppState.currentUser = { name: 'juan' };
  AppState.sessionToken = 'tok';
  AppState._allPredictionsSeeded = true;
  AppState.hasUnsavedChanges = true;
  AppState.hasUnsavedSquadChanges = true;
  AppState.hasUnsavedFinalChanges = true;
}

function test_logout_limpia_estado_y_sesion() {
  reset();
  logout();
  assert.strictEqual(localStorage.getItem('session_token'), null, 'session_token debe borrarse');
  assert.strictEqual(localStorage.getItem('porra_ucl_user'), null, 'porra_ucl_user debe borrarse');
  assert.strictEqual(AppState.currentUser, null, 'currentUser debe ser null');
  assert.strictEqual(AppState.sessionToken, null, 'sessionToken debe ser null');
  assert.strictEqual(AppState.hasUnsavedChanges, false, 'hasUnsavedChanges a false');
  assert.strictEqual(AppState.hasUnsavedSquadChanges, false, 'hasUnsavedSquadChanges a false');
  assert.strictEqual(AppState.hasUnsavedFinalChanges, false, 'hasUnsavedFinalChanges a false');
  assert.strictEqual(AppState._allPredictionsSeeded, false, '_allPredictionsSeeded a false');
  assert.strictEqual(cacheCleared, 1, 'logout debe purgar las cachés porra_cache_*');
  assert.strictEqual(authStatusCalls, 1, 'logout debe re-evaluar el estado de auth');
  assert.strictEqual(countdownCalls, 1, 'logout debe limpiar el countdown');
  assert.strictEqual(pollingCalls, 1, 'logout debe parar el polling de matchstats');
}

function test_guardar_y_cerrar_aborta_si_falla_alguna_guardada() {
  reset();
  assert.strictEqual(shouldCloseSessionAfterSave(true, true, true, false), false,
    'si la plantilla no se guarda (p.ej. incompleta) NO se cierra la sesión');
  assert.strictEqual(shouldCloseSessionAfterSave(true, false, false, null), false,
    'si las predicciones fallan NO se cierra la sesión');
  assert.strictEqual(shouldCloseSessionAfterSave(false, true, null, true), true,
    'solo plantilla guardada OK → se cierra');
  assert.strictEqual(shouldCloseSessionAfterSave(true, true, true, true), true,
    'todo guardado → se cierra');
  assert.strictEqual(shouldCloseSessionAfterSave(false, false, null, null), true,
    'sin cambios modificados → se cierra');
}

// ── Run ─────────────────────────────────────────────────────────
const tests = [
  test_logout_limpia_estado_y_sesion,
  test_guardar_y_cerrar_aborta_si_falla_alguna_guardada,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    passed++;
    console.log(`  ✓ ${test.name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${test.name}`);
    console.log(`    ${err.message}`);
  }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);