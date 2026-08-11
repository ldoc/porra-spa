const assert = require('assert');

// ── Mock AppState ──────────────────────────────────────────────
const AppState = {
  matches: [],
  appConfig: {},
  scorePredictions: {},
  currentRound: 1,
  currentPhaseMatches: null,
  currentPhaseRounds: null,
  predictionsConfirmed: false,
};

// ── Mock getFaseJuego ──────────────────────────────────────────
function getFaseJuego() {
  return AppState.appConfig?.faseJuego || 'FASE_PRETEMPORADA';
}

// ── getFaseForCurrentPhase (from Task 1) ───────────────────────
function getFaseForCurrentPhase() {
  const phase = getFaseJuego();
  const faseMap = {
    'FASE_PRETEMPORADA': 'liga',
    'FASE_LIGA': 'liga',
    'FASE_PRE16': '16',
    'FASE_16': '16',
    'FASE_PRE8': '8',
    'FASE_8': '8',
    'FASE_PRE4': '4',
    'FASE_4': '4',
    'FASE_PRESEMIS': 'semis',
    'FASE_SEMIS': 'semis',
    'FASE_PREFINAL': 'final',
    'FASE_FINAL': 'final',
    'FASE_POSTFINAL': 'final',
  };
  return faseMap[phase] || 'liga';
}

// ── getMatchesForCurrentPhase (from Task 2) ────────────────────
function getMatchesForCurrentPhase() {
  const fase = getFaseForCurrentPhase();
  const phaseMatches = AppState.matches.filter(m => m.fase === fase);
  const rounds = phaseMatches.length > 0
    ? Math.max(...phaseMatches.map(m => m.ronda))
    : 1;
  return { matches: phaseMatches, rounds, fase };
}

// ── countPredictedInPhase (implementation) ─────────────────────
function countPredictedInPhase(matches) {
  let count = 0;
  for (const m of matches) {
    const p = AppState.scorePredictions[m.id];
    if (p && typeof p.home === 'number' && typeof p.away === 'number') count++;
  }
  return count;
}

// ── isPhaseFrozen (implementation) ─────────────────────────────
function isPhaseFrozen(fase) {
  const phase = getFaseJuego();
  const faseOrder = ['liga', '16', '8', '4', 'semis', 'final'];
  const faseIndex = faseOrder.indexOf(fase);
  const currentFase = getFaseForCurrentPhase();
  const currentFaseIndex = faseOrder.indexOf(currentFase);

  if (phase.startsWith('FASE_PRE')) {
    return faseIndex < currentFaseIndex;
  }
  return faseIndex <= currentFaseIndex;
}

// ── countPredictedInRound (phase-aware implementation) ─────────
function countPredictedInRound(round) {
  const phaseMatches = AppState.currentPhaseMatches || [];
  const roundMatches = phaseMatches.filter(m => m.ronda === round);
  let count = 0;
  for (const m of roundMatches) {
    const p = AppState.scorePredictions[m.id];
    if (p && typeof p.home === 'number' && typeof p.away === 'number') count++;
  }
  return count;
}

// ── Helper: reset state ────────────────────────────────────────
function resetState() {
  AppState.matches = [];
  AppState.appConfig = {};
  AppState.scorePredictions = {};
  AppState.currentRound = 1;
  AppState.currentPhaseMatches = null;
  AppState.currentPhaseRounds = null;
  AppState.predictionsConfirmed = false;
}

// ══════════════════════════════════════════════════════════════
// RED: Tests for countPredictedInPhase
// ══════════════════════════════════════════════════════════════

function test_countPredictedInPhase_counts_predicted_matches() {
  resetState();
  const matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: 'liga' },
    { id: 3, ronda: 2, fase: 'liga' },
  ];
  AppState.scorePredictions = {
    1: { home: 2, away: 1 },
    2: { home: null, away: null },
    // 3 not predicted at all
  };

  const count = countPredictedInPhase(matches);
  assert.strictEqual(count, 1, 'Should count 1 predicted match');
}

function test_countPredictedInPhase_returns_zero_for_empty() {
  resetState();
  AppState.scorePredictions = { 1: { home: 2, away: 1 } };

  const count = countPredictedInPhase([]);
  assert.strictEqual(count, 0, 'Should return 0 for empty matches');
}

function test_countPredictedInPhase_requires_both_scores() {
  resetState();
  const matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: 'liga' },
  ];
  AppState.scorePredictions = {
    1: { home: 2, away: null },  // only home predicted
    2: { home: 3, away: 1 },     // both predicted
  };

  const count = countPredictedInPhase(matches);
  assert.strictEqual(count, 1, 'Should only count matches with both scores');
}

// ══════════════════════════════════════════════════════════════
// RED: Tests for isPhaseFrozen
// ══════════════════════════════════════════════════════════════

function test_isPhaseFrozen_returns_false_in_pretemporada() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';

  // Liga phase should be editable in pretemporada
  assert.strictEqual(isPhaseFrozen('liga'), false, 'liga should not be frozen in PRETEMPORADA');
}

function test_isPhaseFrozen_returns_true_in_liga_for_liga() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';

  // Liga phase should be frozen when competition has started
  assert.strictEqual(isPhaseFrozen('liga'), true, 'liga should be frozen in FASE_LIGA');
}

function test_isPhaseFrozen_returns_true_in_16_for_liga() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';

  // Liga phase should be frozen in later phases
  assert.strictEqual(isPhaseFrozen('liga'), true, 'liga should be frozen in FASE_16');
}

function test_isPhaseFrozen_pre16_allows_16_editing() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  // In PRE16, fase 16 should be editable
  assert.strictEqual(isPhaseFrozen('16'), false, 'fase 16 should not be frozen in PRE16');
  // Liga should be frozen
  assert.strictEqual(isPhaseFrozen('liga'), true, 'liga should be frozen in PRE16');
}

function test_isPhaseFrozen_16_freezes_16() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';

  // In FASE_16, fase 16 should be frozen
  assert.strictEqual(isPhaseFrozen('16'), true, 'fase 16 should be frozen in FASE_16');
}

function test_isPhaseFrozen_pre8_allows_8_editing() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE8';

  assert.strictEqual(isPhaseFrozen('8'), false, 'fase 8 should not be frozen in PRE8');
  assert.strictEqual(isPhaseFrozen('16'), true, 'fase 16 should be frozen in PRE8');
  assert.strictEqual(isPhaseFrozen('liga'), true, 'liga should be frozen in PRE8');
}

function test_isPhaseFrozen_ordering() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_SEMIS';

  assert.strictEqual(isPhaseFrozen('liga'), true);
  assert.strictEqual(isPhaseFrozen('16'), true);
  assert.strictEqual(isPhaseFrozen('8'), true);
  assert.strictEqual(isPhaseFrozen('4'), true);
  assert.strictEqual(isPhaseFrozen('semis'), true);
  assert.strictEqual(isPhaseFrozen('final'), false);
}

// ══════════════════════════════════════════════════════════════
// RED: Tests for updated countPredictedInRound (phase-aware)
// ══════════════════════════════════════════════════════════════

function test_countPredictedInRound_uses_phase_matches() {
  resetState();
  AppState.currentPhaseMatches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: 'liga' },
    { id: 3, ronda: 2, fase: 'liga' },
  ];
  AppState.scorePredictions = {
    1: { home: 2, away: 1 },
    2: { home: 0, away: 0 },
    3: { home: 1, away: 1 },
  };

  const count = countPredictedInRound(1);
  assert.strictEqual(count, 2, 'Should count 2 predicted in round 1');
}

function test_countPredictedInRound_ignores_non_phase_matches() {
  resetState();
  // Only phase matches set in AppState.currentPhaseMatches
  AppState.currentPhaseMatches = [
    { id: 1, ronda: 1, fase: 'liga' },
  ];
  // scorePredictions also has match 10 which is NOT in currentPhaseMatches
  AppState.scorePredictions = {
    1: { home: 2, away: 1 },
    10: { home: 3, away: 0 },
  };

  const count = countPredictedInRound(1);
  assert.strictEqual(count, 1, 'Should only count phase matches');
}

// ── shouldSaveButtonBeDisabled (Task 4: phase-aware save) ──────
function shouldSaveButtonBeDisabled() {
  const { fase } = getMatchesForCurrentPhase();
  return isPhaseFrozen(fase) || !AppState.hasUnsavedChanges;
}

// ══════════════════════════════════════════════════════════════
// RED: Tests for shouldSaveButtonBeDisabled (Task 4)
// ══════════════════════════════════════════════════════════════

function test_saveButton_disabled_when_phase_frozen_even_with_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
  ];
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, true, 'Save button should be disabled when phase is frozen, even with unsaved changes');
}

function test_saveButton_enabled_when_phase_not_frozen_and_has_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
  ];
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, false, 'Save button should be enabled when phase not frozen and has unsaved changes');
}

function test_saveButton_disabled_when_no_unsaved_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
  ];
  AppState.hasUnsavedChanges = false;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, true, 'Save button should be disabled when no unsaved changes');
}

function test_saveButton_respects_current_phase_fase() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: '16' },
  ];
  AppState.hasUnsavedChanges = true;

  // In PRE16, fase '16' is not frozen, so save should be enabled
  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, false, 'Save button should be enabled when current phase (16) is not frozen in PRE16');
}

function test_saveButton_disabled_for_frozen_phase_in_later_phase() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';
  AppState.matches = [
    { id: 1, ronda: 1, fase: '16' },
  ];
  AppState.hasUnsavedChanges = true;

  // In FASE_16, fase '16' is frozen, so save should be disabled
  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, true, 'Save button should be disabled when current phase is frozen in FASE_16');
}

// ══════════════════════════════════════════════════════════════
// Run tests (RED phase - these will fail until implementation)
// ══════════════════════════════════════════════════════════════

const tests = [
  test_countPredictedInPhase_counts_predicted_matches,
  test_countPredictedInPhase_returns_zero_for_empty,
  test_countPredictedInPhase_requires_both_scores,
  test_isPhaseFrozen_returns_false_in_pretemporada,
  test_isPhaseFrozen_returns_true_in_liga_for_liga,
  test_isPhaseFrozen_returns_true_in_16_for_liga,
  test_isPhaseFrozen_pre16_allows_16_editing,
  test_isPhaseFrozen_16_freezes_16,
  test_isPhaseFrozen_pre8_allows_8_editing,
  test_isPhaseFrozen_ordering,
  test_countPredictedInRound_uses_phase_matches,
  test_countPredictedInRound_ignores_non_phase_matches,
  test_saveButton_disabled_when_phase_frozen_even_with_changes,
  test_saveButton_enabled_when_phase_not_frozen_and_has_changes,
  test_saveButton_disabled_when_no_unsaved_changes,
  test_saveButton_respects_current_phase_fase,
  test_saveButton_disabled_for_frozen_phase_in_later_phase,
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
