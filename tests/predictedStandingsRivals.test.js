const assert = require('assert');

// ── Mock AppState (mismo shape que main.js) ─────────────────────
const AppState = {
  matches: [],
  leagueMatches: [],
  matchStats: [],
  teamsMap: {},
  scorePredictions: {},
};

function buildMatch(id, fase, homeTeamId, awayTeamId) {
  return { id, fase, homeTeamId, awayTeamId };
}

// ── Funciones espejo de main.js (versión CORREGIDA: getRivalsStats) ──
function findTeamMatches(teamId) {
  return AppState.leagueMatches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

function getTeamStats(teamId) {
  const stats = { teamId, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, gc: 0, gd: 0, points: 0, awayWins: 0, awayGoals: 0 };
  const teamMatches = findTeamMatches(teamId);
  for (const match of teamMatches) {
    const pred = AppState.scorePredictions[match.id];
    if (!pred || typeof pred.home !== 'number' || typeof pred.away !== 'number') continue;
    const isHome = match.homeTeamId === teamId;
    const goalsFor = isHome ? pred.home : pred.away;
    const goalsAgainst = isHome ? pred.away : pred.home;
    stats.played++;
    stats.gf += goalsFor;
    stats.gc += goalsAgainst;
    if (goalsFor > goalsAgainst) { stats.wins++; stats.points += 3; if (!isHome) stats.awayWins++; }
    else if (goalsFor === goalsAgainst) { stats.draws++; stats.points += 1; }
    else { stats.losses++; }
    if (!isHome) stats.awayGoals += goalsFor;
  }
  stats.gd = stats.gf - stats.gc;
  return stats;
}

function getRivalsStats(teamId, statsCache) {
  const rivalIds = new Set();
  for (const match of findTeamMatches(teamId)) {
    rivalIds.add(match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId);
  }
  let rivalPointsSum = 0, rivalGDSum = 0, rivalGFSum = 0;
  for (const rivalId of rivalIds) {
    let rivalStats = statsCache.get(rivalId);
    if (!rivalStats) { rivalStats = getTeamStats(rivalId); statsCache.set(rivalId, rivalStats); }
    rivalPointsSum += rivalStats.points;
    rivalGDSum += rivalStats.gd;
    rivalGFSum += rivalStats.gf;
  }
  return { rivalPointsSum, rivalGDSum, rivalGFSum };
}

function comparePredicted(a, b, statsCache) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  if (b.awayGoals !== a.awayGoals) return b.awayGoals - a.awayGoals;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.awayWins !== a.awayWins) return b.awayWins - a.awayWins;
  const aRivals = getRivalsStats(a.teamId, statsCache);
  const bRivals = getRivalsStats(b.teamId, statsCache);
  if (bRivals.rivalPointsSum !== aRivals.rivalPointsSum) return bRivals.rivalPointsSum - aRivals.rivalPointsSum;
  if (bRivals.rivalGDSum !== aRivals.rivalGDSum) return bRivals.rivalGDSum - aRivals.rivalGDSum;
  if (bRivals.rivalGFSum !== aRivals.rivalGFSum) return bRivals.rivalGFSum - aRivals.rivalGFSum;
  const aName = AppState.teamsMap[a.teamId]?.name || '';
  const bName = AppState.teamsMap[b.teamId]?.name || '';
  return aName.localeCompare(bName);
}

function calculatePredictedStandings() {
  const teams = [];
  const statsCache = new Map();
  for (const teamId of Object.keys(AppState.teamsMap).map(Number)) {
    const stats = getTeamStats(teamId);
    teams.push({ ...stats });
    statsCache.set(teamId, stats);
  }
  const sorted = teams.sort((a, b) => comparePredicted(a, b, statsCache));
  return sorted.map((t, i) => ({ ...t, position: i + 1 }));
}

// ── Tests ───────────────────────────────────────────────────────

function test_getRivalsStats_usa_puntos_predichos_sin_matchstats() {
  AppState.matches = [
    buildMatch(1, 'liga', 10, 20),
    buildMatch(2, 'liga', 20, 30),
    buildMatch(3, 'liga', 30, 10),
  ];
  AppState.leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
  AppState.matchStats = []; // pretemporada: sin resultados reales
  AppState.teamsMap = { 10: { name: 'BTeam', ext: 'png' }, 20: { name: 'ATeam', ext: 'png' }, 30: { name: 'CTeam', ext: 'png' } };
  AppState.scorePredictions = {
    1: { home: 2, away: 1 }, // 10 gana a 20
    2: { home: 2, away: 1 }, // 20 gana a 30
    3: { home: 0, away: 1 }, // 10 gana a 30
  };
  const statsCache = new Map();
  for (const id of [10, 20, 30]) statsCache.set(id, getTeamStats(id));
  const rivals = getRivalsStats(10, statsCache);
  assert.ok(rivals.rivalPointsSum > 0, 'los puntos de rivales deben venir de las predicciones (no 0)');
  assert.strictEqual(rivals.rivalPointsSum, statsCache.get(20).points + statsCache.get(30).points);
}

function test_desempate_rivales_predichos_rompe_empate() {
  // 10 y 20 empatan en criterios 1-5; 10 tiene más puntos de rivales
  AppState.matches = [
    buildMatch(1, 'liga', 10, 20),
    buildMatch(2, 'liga', 30, 40),
    buildMatch(3, 'liga', 20, 40),
    buildMatch(4, 'liga', 30, 10),
  ];
  AppState.leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
  AppState.matchStats = [];
  AppState.teamsMap = {
    10: { name: 'BTeam', ext: 'png' }, 20: { name: 'ATeam', ext: 'png' },
    30: { name: 'CTeam', ext: 'png' }, 40: { name: 'DTeam', ext: 'png' },
  };
  AppState.scorePredictions = {
    1: { home: 1, away: 0 }, // 10 gana
    2: { home: 1, away: 0 }, // 30 gana
    3: { home: 1, away: 0 }, // 20 gana
    4: { home: 1, away: 0 }, // 30 gana
  };
  const standings = calculatePredictedStandings();
  const team10 = standings.find(t => t.teamId === 10);
  const team20 = standings.find(t => t.teamId === 20);
  assert.strictEqual(team10.points, team20.points, 'empate en puntos');
  assert.strictEqual(team10.gf, team20.gf, 'empate en goles a favor');
  assert.strictEqual(team10.gd, team20.gd, 'empate en diferencia');
  assert.ok(team10.position < team20.position,
    '10 (más puntos de rivales pronosticados) debe ir antes que 20 (alfabéticamente antes)');
}

// ── Run ─────────────────────────────────────────────────────────
const tests = [
  test_getRivalsStats_usa_puntos_predichos_sin_matchstats,
  test_desempate_rivales_predichos_rompe_empate,
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