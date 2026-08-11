const assert = require('assert');

// Mock AppState
const AppState = {
  matches: [],
  appConfig: {}
};

// Mock getFaseJuego
function getFaseJuego() {
  return AppState.appConfig?.faseJuego || 'FASE_PRETEMPORADA';
}

// getFaseForCurrentPhase (from Task 1)
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
    'FASE_POSTFINAL': 'final'
  };
  return faseMap[phase] || 'liga';
}

// getMatchesForCurrentPhase (implementation)
function getMatchesForCurrentPhase() {
  const fase = getFaseForCurrentPhase();
  const phaseMatches = AppState.matches.filter(m => m.fase === fase);

  const rounds = phaseMatches.length > 0
    ? Math.max(...phaseMatches.map(m => m.ronda))
    : 1;

  return { matches: phaseMatches, rounds, fase };
}

// ── Test helper: reset state ──────────────────────────────────
function resetState() {
  AppState.matches = [];
  AppState.appConfig = {};
}

// ── RED: Tests for getMatchesForCurrentPhase ──────────────────

function test_filters_matches_by_liga_fase() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: 'liga' },
    { id: 3, ronda: 1, fase: '16' },
  ];

  const result = getMatchesForCurrentPhase();
  assert.strictEqual(result.matches.length, 2, 'Should filter to liga matches');
  assert.strictEqual(result.fase, 'liga');
}

function test_returns_correct_rounds_count() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 2, fase: 'liga' },
    { id: 3, ronda: 3, fase: 'liga' },
    { id: 4, ronda: 1, fase: '16' },
  ];

  const result = getMatchesForCurrentPhase();
  assert.strictEqual(result.rounds, 3, 'Should return max ronda as rounds count');
}

function test_returns_empty_when_no_phase_matches() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_16';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 2, fase: 'liga' },
  ];

  const result = getMatchesForCurrentPhase();
  assert.strictEqual(result.matches.length, 0, 'Should return empty array');
  assert.strictEqual(result.rounds, 1, 'Should return 1 as default rounds');
  assert.strictEqual(result.fase, '16');
}

function test_defaults_to_liga_when_unknown_phase() {
  resetState();
  AppState.appConfig.faseJuego = 'UNKNOWN_PHASE';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: '16' },
  ];

  const result = getMatchesForCurrentPhase();
  assert.strictEqual(result.fase, 'liga', 'Should default to liga');
  assert.strictEqual(result.matches.length, 1);
}

function test_handles_empty_matches_array() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_LIGA';
  AppState.matches = [];

  const result = getMatchesForCurrentPhase();
  assert.strictEqual(result.matches.length, 0);
  assert.strictEqual(result.rounds, 1, 'Should return 1 for empty matches');
  assert.strictEqual(result.fase, 'liga');
}

function test_filters_for_elimination_phases() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_8';
  AppState.matches = [
    { id: 1, ronda: 1, fase: 'liga' },
    { id: 2, ronda: 1, fase: '8' },
    { id: 3, ronda: 2, fase: '8' },
    { id: 4, ronda: 1, fase: '16' },
  ];

  const result = getMatchesForCurrentPhase();
  assert.strictEqual(result.matches.length, 2, 'Should filter to fase 8 matches');
  assert.strictEqual(result.rounds, 2);
  assert.strictEqual(result.fase, '8');
}

// ── Run tests ─────────────────────────────────────────────────
const tests = [
  test_filters_matches_by_liga_fase,
  test_returns_correct_rounds_count,
  test_returns_empty_when_no_phase_matches,
  test_defaults_to_liga_when_unknown_phase,
  test_handles_empty_matches_array,
  test_filters_for_elimination_phases,
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
