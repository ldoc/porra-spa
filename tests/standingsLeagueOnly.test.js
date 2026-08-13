const assert = require('assert');

// ── Mock AppState (mismo shape que main.js) ─────────────────────
const AppState = {
  matches: [],
  leagueMatches: [],
  matchStats: [],
  teamsMap: {},
  scorePredictions: {},
  allPredictions: {},
};

function buildMatch(id, ronda, fase, homeTeamId, awayTeamId) {
  return { id, ronda, fase, homeTeamId, awayTeamId };
}

function resetState() {
  AppState.matches = [
    buildMatch(1, 1, 'liga', 10, 20),
    buildMatch(2, 1, 'liga', 20, 30),
    buildMatch(3, 1, 'liga', 30, 10),
    buildMatch(100, 1, '16', 10, 30),
    buildMatch(101, 1, '8', 20, 10),
    buildMatch(102, 1, 'final', 30, 20),
  ];
  AppState.leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
  AppState.matchStats = [];
  AppState.teamsMap = { 10: { name: 'A', ext: 'png' }, 20: { name: 'B', ext: 'png' }, 30: { name: 'C', ext: 'png' } };
  AppState.scorePredictions = {};
  AppState.allPredictions = {};
}

// ── Funciones espejo de main.js (versión corregida) ─────────────
function findTeamMatches(teamId) {
  return AppState.leagueMatches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

function findRealTeamMatches(teamId) {
  return AppState.leagueMatches.filter(m => {
    const matchStat = AppState.matchStats.find(ms => ms.eventId === m.id);
    return matchStat && matchStat.stats &&
           matchStat.stats[m.homeTeamId] !== undefined &&
           matchStat.stats[m.awayTeamId] !== undefined;
  }).filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

function getTeamStats(teamId) {
  const stats = { teamId, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, gc: 0, gd: 0, points: 0, awayWins: 0, awayGoals: 0 };
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
    if (teamGoals > rivalGoals) { stats.wins++; stats.points += 3; if (!isHome) stats.awayWins++; }
    else if (teamGoals === rivalGoals) { stats.draws++; stats.points += 1; }
    else { stats.losses++; }
    if (!isHome) stats.awayGoals += teamGoals;
  }
  stats.gd = stats.gf - stats.gc;
  return stats;
}

function getRealTeamStats(teamId) {
  const stats = { teamId, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, gc: 0, gd: 0, points: 0, awayWins: 0, awayGoals: 0 };
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
    if (teamGoals > rivalGoals) { stats.wins++; stats.points += 3; if (!isHome) stats.awayWins++; }
    else if (teamGoals === rivalGoals) { stats.draws++; stats.points += 1; }
    else { stats.losses++; }
    if (!isHome) stats.awayGoals += teamGoals;
  }
  stats.gd = stats.gf - stats.gc;
  return stats;
}

function countPredictedInPhase(matches) {
  let count = 0;
  for (const m of matches) {
    const p = AppState.scorePredictions[m.id];
    if (p && typeof p.home === 'number' && typeof p.away === 'number') count++;
  }
  return count;
}

// ── Tests ───────────────────────────────────────────────────────

function test_leagueMatches_has_only_liga() {
  resetState();
  assert.strictEqual(AppState.matches.length, 6, 'Fixture should have 6 total matches');
  assert.strictEqual(AppState.leagueMatches.length, 3, 'leagueMatches should have 3 liga matches');
  assert.ok(AppState.leagueMatches.every(m => m.fase === 'liga'), 'All leagueMatches must be fase liga');
}

function test_findTeamMatches_excludes_ko() {
  resetState();
  const teamMatches = findTeamMatches(10);
  const ids = teamMatches.map(m => m.id);
  assert.deepStrictEqual(ids, [1, 3], 'findTeamMatches should only return liga matches for team 10');
}

function test_findRealTeamMatches_excludes_ko() {
  resetState();
  // Resultado real SOLO en el partido KO 100 (equipo 10 vs 30)
  AppState.matchStats = [{ eventId: 100, stats: { 10: { goles: 2 }, 30: { goles: 1 } } }];
  const teamMatches = findRealTeamMatches(10);
  assert.strictEqual(teamMatches.length, 0, 'findRealTeamMatches should ignore KO matchstats');
}

function test_getTeamStats_ignores_ko_predictions() {
  resetState();
  // Predicción SOLO en partidos KO del equipo 10
  AppState.scorePredictions = {
    100: { home: 2, away: 1 },   // fase 16
    102: { home: 1, away: 1 },   // final
  };
  const stats = getTeamStats(10);
  assert.strictEqual(stats.played, 0, 'getTeamStats should not count KO predictions');
  assert.strictEqual(stats.points, 0, 'getTeamStats should have 0 points from KO predictions');
}

function test_getTeamStats_counts_only_liga_predictions() {
  resetState();
  AppState.scorePredictions = {
    1: { home: 2, away: 1 },     // liga: equipo 10 gana → 3 pts
    100: { home: 2, away: 1 },   // KO: ignorado
  };
  const stats = getTeamStats(10);
  assert.strictEqual(stats.played, 1, 'getTeamStats should count only liga match 1');
  assert.strictEqual(stats.points, 3, 'getTeamStats should give 3 points for liga win');
  assert.strictEqual(stats.gf, 2, 'getTeamStats gf should be 2');
}

function test_getRealTeamStats_counts_only_liga_matchstats() {
  resetState();
  // Resultado real en liga (match 1) y en KO (match 100)
  AppState.matchStats = [
    { eventId: 1, stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
    { eventId: 100, stats: { 10: { goles: 3 }, 30: { goles: 0 } } },
  ];
  const stats = getRealTeamStats(10);
  assert.strictEqual(stats.played, 1, 'getRealTeamStats should count only liga match 1');
  assert.strictEqual(stats.points, 3, 'getRealTeamStats should give 3 points for liga win');
  assert.strictEqual(stats.gf, 2, 'getRealTeamStats gf should be 2 (KO goal ignored)');
}

function test_countPredictedInPhase_counts_only_liga_predictions() {
  resetState();
  AppState.scorePredictions = { 100: { home: 2, away: 1 } };   // fase 16
  assert.strictEqual(countPredictedInPhase(AppState.leagueMatches), 0,
    'KO-only prediction should not count');
  AppState.scorePredictions = { 1: { home: 2, away: 1 } };     // liga
  assert.strictEqual(countPredictedInPhase(AppState.leagueMatches), 1,
    'liga prediction should count as 1');
}

function test_counter_denominator_is_144() {
  resetState();
  // Simular que el calendario real tiene 189 con 144 liga
  AppState.matches = [];
  for (let i = 1; i <= 144; i++) AppState.matches.push(buildMatch(i, 1, 'liga', 10, 20));
  for (let i = 145; i <= 189; i++) AppState.matches.push(buildMatch(i, 1, '8', 10, 20));
  AppState.leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
  assert.strictEqual(AppState.matches.length, 189, 'Fixture should have 189 total matches');
  assert.strictEqual(AppState.leagueMatches.length, 144, 'Denominator for progress should be 144');
}

// ── Run ─────────────────────────────────────────────────────────
const tests = [
  test_leagueMatches_has_only_liga,
  test_findTeamMatches_excludes_ko,
  test_findRealTeamMatches_excludes_ko,
  test_getTeamStats_ignores_ko_predictions,
  test_getTeamStats_counts_only_liga_predictions,
  test_getRealTeamStats_counts_only_liga_matchstats,
  test_countPredictedInPhase_counts_only_liga_predictions,
  test_counter_denominator_is_144,
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
