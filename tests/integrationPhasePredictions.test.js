const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ── Load real calendar data ─────────────────────────────────────
const calendarPath = path.join(__dirname, '..', 'data', 'calendar.json');
const calendarData = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));

// ── Mock AppState ──────────────────────────────────────────────
const AppState = {
  matches: [],
  appConfig: {},
  scorePredictions: {},
  currentRound: 1,
  currentPhaseMatches: null,
  currentPhaseRounds: null,
  predictionsConfirmed: false,
  hasUnsavedChanges: false,
};

// ── Mock functions (mirror main.js) ────────────────────────────
function getFaseJuego() {
  return AppState.appConfig?.faseJuego || 'FASE_PRETEMPORADA';
}

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

function getMatchesForCurrentPhase() {
  const fase = getFaseForCurrentPhase();
  const phaseMatches = AppState.matches.filter(m => m.fase === fase);
  const rounds = phaseMatches.length > 0
    ? Math.max(...phaseMatches.map(m => m.ronda))
    : 1;
  return { matches: phaseMatches, rounds, fase };
}

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

function countPredictedInPhase(matches) {
  let count = 0;
  for (const m of matches) {
    const p = AppState.scorePredictions[m.id];
    if (p && typeof p.home === 'number' && typeof p.away === 'number') count++;
  }
  return count;
}

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

function shouldSaveButtonBeDisabled() {
  const { fase } = getMatchesForCurrentPhase();
  const confirmedForFase = AppState.predictionsConfirmed && fase === 'liga';
  return isPhaseFrozen(fase) || confirmedForFase || !AppState.hasUnsavedChanges;
}

function isFasePretemporada() {
  return getFaseJuego() === 'FASE_PRETEMPORADA';
}

function shouldShowConfirmButton() {
  const { fase } = getMatchesForCurrentPhase();
  const confirmedForFase = AppState.predictionsConfirmed && fase === 'liga';
  return isFasePretemporada() && !confirmedForFase;
}

function shouldConfirmButtonBeDisabled() {
  const { matches: phaseMatches, fase } = getMatchesForCurrentPhase();
  const total = phaseMatches.length;
  const predicted = countPredictedInPhase(phaseMatches);
  return isPhaseFrozen(fase) || predicted < total || AppState.hasUnsavedChanges;
}

function buildMatchFromCalendar(entry) {
  return {
    id: entry.id,
    ronda: entry.ronda,
    fase: entry.fase,
    homeTeamId: entry.equipoLocal.id,
    awayTeamId: entry.equipoVisitante.id,
    homeTeam: entry.equipoLocal.name,
    awayTeam: entry.equipoVisitante.name,
    fecha: entry.fecha,
  };
}

// ── Helper: reset state ────────────────────────────────────────
function resetState() {
  AppState.matches = calendarData.map(buildMatchFromCalendar);
  AppState.appConfig = {};
  AppState.scorePredictions = {};
  AppState.currentRound = 1;
  AppState.currentPhaseMatches = null;
  AppState.currentPhaseRounds = null;
  AppState.predictionsConfirmed = false;
  AppState.hasUnsavedChanges = false;
}

// ══════════════════════════════════════════════════════════════
// Step 1: Test FASE_PRETEMPORADA
// ══════════════════════════════════════════════════════════════

function test_pretemporada_shows_144_liga_matches() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';

  const { matches, rounds, fase } = getMatchesForCurrentPhase();
  assert.strictEqual(fase, 'liga', 'Should map to liga fase');
  assert.strictEqual(matches.length, 144, 'Should show 144 liga matches');
  assert.strictEqual(rounds, 8, 'Should have 8 rounds');
}

function test_pretemporada_can_edit_predictions() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';

  const { fase } = getMatchesForCurrentPhase();
  const frozen = isPhaseFrozen(fase);
  assert.strictEqual(frozen, false, 'Predictions should be editable in PRETEMPORADA');
}

function test_pretemporada_save_button_enabled_with_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, false, 'Save button should be enabled with unsaved changes');
}

// ══════════════════════════════════════════════════════════════
// Step 2: Test FASE_LIGA
// ══════════════════════════════════════════════════════════════

function test_liga_shows_144_liga_matches() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';

  const { matches, rounds, fase } = getMatchesForCurrentPhase();
  assert.strictEqual(fase, 'liga', 'Should map to liga fase');
  assert.strictEqual(matches.length, 144, 'Should show 144 liga matches');
  assert.strictEqual(rounds, 8, 'Should have 8 rounds');
}

function test_liga_predictions_frozen() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';

  const { fase } = getMatchesForCurrentPhase();
  const frozen = isPhaseFrozen(fase);
  assert.strictEqual(frozen, true, 'Predictions should be frozen in FASE_LIGA');
}

function test_liga_save_button_disabled() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, true, 'Save button should be disabled in FASE_LIGA');
}

// ══════════════════════════════════════════════════════════════
// Step 3: Test FASE_PRE16
// ══════════════════════════════════════════════════════════════

function test_pre16_shows_16_round_of_16_matches() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const { matches, rounds, fase } = getMatchesForCurrentPhase();
  assert.strictEqual(fase, '16', 'Should map to fase 16');
  assert.strictEqual(matches.length, 16, 'Should show 16 round of 16 matches');
  assert.strictEqual(rounds, 1, 'Should have 1 round');
}

function test_pre16_can_edit_predictions() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const { fase } = getMatchesForCurrentPhase();
  const frozen = isPhaseFrozen(fase);
  assert.strictEqual(frozen, false, 'Predictions should be editable in PRE16');
}

function test_pre16_save_button_enabled_with_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, false, 'Save button should be enabled in PRE16');
}

function test_pre16_save_button_enabled_even_when_liga_confirmed() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';
  AppState.predictionsConfirmed = true; // liga confirmada en PRETEMPORADA
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, false, 'Save button should be enabled in PRE16 even when liga confirmed');
}

function test_pre16_save_button_disabled_when_no_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';
  AppState.hasUnsavedChanges = false;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, true, 'Save button should be disabled in PRE16 without changes');
}

function test_pre16_liga_matches_not_shown() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const { matches } = getMatchesForCurrentPhase();
  const ligaMatches = matches.filter(m => m.fase === 'liga');
  assert.strictEqual(ligaMatches.length, 0, 'Liga matches should not appear in PRE16');
}

// ══════════════════════════════════════════════════════════════
// Step 4: Test FASE_16
// ══════════════════════════════════════════════════════════════

function test_fase16_shows_16_round_of_16_matches() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';

  const { matches, rounds, fase } = getMatchesForCurrentPhase();
  assert.strictEqual(fase, '16', 'Should map to fase 16');
  assert.strictEqual(matches.length, 16, 'Should show 16 round of 16 matches');
  assert.strictEqual(rounds, 1, 'Should have 1 round');
}

function test_fase16_predictions_frozen() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';

  const { fase } = getMatchesForCurrentPhase();
  const frozen = isPhaseFrozen(fase);
  assert.strictEqual(frozen, true, 'Predictions should be frozen in FASE_16');
}

function test_fase16_save_button_disabled() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';
  AppState.hasUnsavedChanges = true;

  const disabled = shouldSaveButtonBeDisabled();
  assert.strictEqual(disabled, true, 'Save button should be disabled in FASE_16');
}

// ══════════════════════════════════════════════════════════════
// Step 5: Test round navigation
// ══════════════════════════════════════════════════════════════

function test_pretemporada_has_8_rounds_for_navigation() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';

  const { rounds } = getMatchesForCurrentPhase();
  assert.strictEqual(rounds, 8, 'Should have 8 rounds for navigation in PRETEMPORADA');
}

function test_pre16_has_1_round_no_navigation() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const { rounds } = getMatchesForCurrentPhase();
  assert.strictEqual(rounds, 1, 'Should have 1 round in PRE16 (no navigation needed)');
}

function test_round_navigation_counts_correct_per_round() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';

  const { matches } = getMatchesForCurrentPhase();
  for (let r = 1; r <= 8; r++) {
    const roundMatches = matches.filter(m => m.ronda === r);
    assert.strictEqual(roundMatches.length, 18, `Round ${r} should have 18 matches`);
  }
}

// ══════════════════════════════════════════════════════════════
// Step 6: Test save functionality
// ══════════════════════════════════════════════════════════════

function test_save_predictions_for_pre16() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const { matches } = getMatchesForCurrentPhase();
  // Simulate adding predictions for round of 16
  for (const m of matches) {
    AppState.scorePredictions[m.id] = { home: 2, away: 1 };
  }

  const predicted = countPredictedInPhase(matches);
  assert.strictEqual(predicted, 16, 'All 16 matches should be predicted');
}

function test_save_only_counts_current_phase() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  // Add some liga predictions (should not count)
  const ligaMatches = AppState.matches.filter(m => m.fase === 'liga');
  for (const m of ligaMatches.slice(0, 10)) {
    AppState.scorePredictions[m.id] = { home: 1, away: 0 };
  }

  const { matches: phaseMatches } = getMatchesForCurrentPhase();
  const predicted = countPredictedInPhase(phaseMatches);
  assert.strictEqual(predicted, 0, 'Liga predictions should not count in PRE16 phase');
}

// ══════════════════════════════════════════════════════════════
// Additional: cross-phase isolation tests
// ══════════════════════════════════════════════════════════════

function test_liga_frozen_in_pre16() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const frozen = isPhaseFrozen('liga');
  assert.strictEqual(frozen, true, 'Liga should be frozen in PRE16');
}

function test_16_not_frozen_in_pre16() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  const frozen = isPhaseFrozen('16');
  assert.strictEqual(frozen, false, 'Fase 16 should not be frozen in PRE16');
}

function test_16_frozen_in_fase16() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';

  const frozen = isPhaseFrozen('16');
  assert.strictEqual(frozen, true, 'Fase 16 should be frozen in FASE_16');
}

function test_liga_frozen_in_fase16() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';

  const frozen = isPhaseFrozen('liga');
  assert.strictEqual(frozen, true, 'Liga should remain frozen in FASE_16');
}

function test_predictions_from_previous_phase_remain_frozen() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRE16';

  // Liga predictions should still be frozen
  const ligaFrozen = isPhaseFrozen('liga');
  assert.strictEqual(ligaFrozen, true, 'Previous phase (liga) predictions remain frozen');

  // Current phase should be editable
  const currentFrozen = isPhaseFrozen('16');
  assert.strictEqual(currentFrozen, false, 'Current phase (16) should be editable');
}

// ══════════════════════════════════════════════════════════════
// Additional: data integrity tests
// ══════════════════════════════════════════════════════════════

function test_calendar_has_correct_structure() {
  assert.strictEqual(calendarData.length, 189, 'Calendar should have 189 total matches');

  const ligaMatches = calendarData.filter(m => m.fase === 'liga');
  assert.strictEqual(ligaMatches.length, 144, 'Should have 144 liga matches');

  const r16Matches = calendarData.filter(m => m.fase === '16');
  assert.strictEqual(r16Matches.length, 16, 'Should have 16 round of 16 matches');

  const r8Matches = calendarData.filter(m => m.fase === '8');
  assert.strictEqual(r8Matches.length, 16, 'Should have 16 round of 8 matches');

  const qfMatches = calendarData.filter(m => m.fase === '4');
  assert.strictEqual(qfMatches.length, 8, 'Should have 8 quarter final matches');

  const sfMatches = calendarData.filter(m => m.fase === 'semis');
  assert.strictEqual(sfMatches.length, 4, 'Should have 4 semi final matches');

  const finalMatches = calendarData.filter(m => m.fase === 'final');
  assert.strictEqual(finalMatches.length, 1, 'Should have 1 final match');
}

function test_buildMatchFromCalendar_preserves_fase() {
  const entry = calendarData[0];
  const match = buildMatchFromCalendar(entry);
  assert.strictEqual(match.fase, entry.fase, 'buildMatchFromCalendar should preserve fase field');
  assert.strictEqual(match.id, entry.id, 'Should preserve id');
  assert.strictEqual(match.ronda, entry.ronda, 'Should preserve ronda');
}

function test_all_matches_have_fase_field() {
  for (const m of calendarData) {
    assert.ok(m.fase, `Match ${m.id} should have a fase field`);
    assert.ok(['liga', '16', '8', '4', 'semis', 'final'].includes(m.fase), `Match ${m.id} fase should be 'liga', '16', '8', '4', 'semis' or 'final'`);
  }
}

// ══════════════════════════════════════════════════════════════
// Confirm button: visibility y disabled
// ══════════════════════════════════════════════════════════════

function test_confirm_button_visible_in_pretemporada() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  assert.strictEqual(shouldShowConfirmButton(), true, 'Confirm button should show in PRETEMPORADA');
}

function test_confirm_button_hidden_when_confirmed() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  AppState.predictionsConfirmed = true;
  assert.strictEqual(shouldShowConfirmButton(), false, 'Confirm button should hide after confirming');
}

function test_confirm_button_hidden_in_other_phases() {
  const fases = ['FASE_LIGA', 'FASE_PRE16', 'FASE_16', 'FASE_PRE8', 'FASE_8', 'FASE_PRE4', 'FASE_4', 'FASE_PRESEMIS', 'FASE_SEMIS', 'FASE_PREFINAL', 'FASE_FINAL', 'FASE_POSTFINAL'];
  for (const fase of fases) {
    resetState();
    AppState.appConfig.faseJuego = fase;
    assert.strictEqual(shouldShowConfirmButton(), false, `Confirm button should not show in ${fase}`);
  }
}

function test_confirm_button_disabled_when_incomplete() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  assert.strictEqual(shouldConfirmButtonBeDisabled(), true, 'Confirm disabled when predictions incomplete');
}

function test_confirm_button_disabled_with_unsaved_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  const { matches } = getMatchesForCurrentPhase();
  for (const m of matches) {
    AppState.scorePredictions[m.id] = { home: 2, away: 1 };
  }
  AppState.hasUnsavedChanges = true;
  assert.strictEqual(shouldConfirmButtonBeDisabled(), true, 'Confirm disabled when there are unsaved changes');
}

function test_confirm_button_enabled_when_complete_and_saved() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  const { matches } = getMatchesForCurrentPhase();
  for (const m of matches) {
    AppState.scorePredictions[m.id] = { home: 2, away: 1 };
  }
  AppState.hasUnsavedChanges = false;
  assert.strictEqual(shouldConfirmButtonBeDisabled(), false, 'Confirm enabled when complete and saved');
}

// ══════════════════════════════════════════════════════════════
// Run all tests
// ══════════════════════════════════════════════════════════════

const tests = [
  // Step 1: FASE_PRETEMPORADA
  test_pretemporada_shows_144_liga_matches,
  test_pretemporada_can_edit_predictions,
  test_pretemporada_save_button_enabled_with_changes,
  test_confirm_button_visible_in_pretemporada,
  test_confirm_button_disabled_when_incomplete,
  test_confirm_button_disabled_with_unsaved_changes,
  test_confirm_button_enabled_when_complete_and_saved,
  // Step 2: FASE_LIGA
  test_liga_shows_144_liga_matches,
  test_liga_predictions_frozen,
  test_liga_save_button_disabled,
  // Step 3: FASE_PRE16
  test_pre16_shows_16_round_of_16_matches,
  test_pre16_can_edit_predictions,
  test_pre16_save_button_enabled_with_changes,
  test_pre16_save_button_enabled_even_when_liga_confirmed,
  test_pre16_save_button_disabled_when_no_changes,
  test_pre16_liga_matches_not_shown,
  // Step 4: FASE_16
  test_fase16_shows_16_round_of_16_matches,
  test_fase16_predictions_frozen,
  test_fase16_save_button_disabled,
  // Step 5: Round navigation
  test_pretemporada_has_8_rounds_for_navigation,
  test_pre16_has_1_round_no_navigation,
  test_round_navigation_counts_correct_per_round,
  // Step 6: Save functionality
  test_save_predictions_for_pre16,
  test_save_only_counts_current_phase,
  // Cross-phase isolation
  test_liga_frozen_in_pre16,
  test_16_not_frozen_in_pre16,
  test_16_frozen_in_fase16,
  test_liga_frozen_in_fase16,
  test_predictions_from_previous_phase_remain_frozen,
  // Data integrity
  test_calendar_has_correct_structure,
  test_buildMatchFromCalendar_preserves_fase,
  test_all_matches_have_fase_field,
  // Confirm button
  test_confirm_button_hidden_when_confirmed,
  test_confirm_button_hidden_in_other_phases,
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
