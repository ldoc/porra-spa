const assert = require('assert');
const { calcPlayerExtremes, buildDuelContext, calcDuelCategories, calcDuelScore } = require('../js/stats.js');

function test_calcPlayerExtremes_ignora_jugadores_sin_partidos() {
  const r = calcPlayerExtremes([
    { jugador: { nombre: 'A' }, puntosTotal: 10, partidos: [{}] },
    { jugador: { nombre: 'B' }, puntosTotal: -3, partidos: [{}] },
    { jugador: { nombre: 'C' }, puntosTotal: 99, partidos: [] },
  ]);
  assert.strictEqual(r.best.jugador.nombre, 'A');
  assert.strictEqual(r.best.puntos, 10);
  assert.strictEqual(r.worst.jugador.nombre, 'B');
  assert.strictEqual(r.worst.puntos, -3);
  assert.strictEqual(calcPlayerExtremes([]), null);
  assert.strictEqual(calcPlayerExtremes([{ jugador: { nombre: 'C' }, puntosTotal: 1, partidos: [] }]), null);
}

function duelFixture() {
  const playedMatches = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 1, result: 'D' },
  ];
  return {
    playedMatches,
    matchesById: {
      1: { id: 1, fase: 'liga' },
      2: { id: 2, fase: 'liga' },
      3: { id: 3, fase: 'liga' },
    },
    splitByUser: {
      ana: { prediction: 20, squad: 5, classification: 2, eliminatorias: 1 },
      bob: { prediction: 18, squad: 7, classification: 1, eliminatorias: 3 },
    },
    reliabilityByUser: {
      ana: { played: 3, hits: 2, exactScores: 1, ptsPerMatch: 6.7 },
      bob: { played: 3, hits: 1, exactScores: 0, ptsPerMatch: 5.5 },
    },
    exactStatsByUser: {
      ana: { totals: { played: 3 }, streaks: { currentExact: 0, bestExact: 1 } },
      bob: { totals: { played: 3 }, streaks: { currentExact: 0, bestExact: 0 } },
    },
    matchExtremesByUser: {
      ana: { best: { points: 15 }, worst: { points: 0 } },
      bob: { best: { points: 8 }, worst: { points: 0 } },
    },
    playerExtremesByUser: {
      ana: { best: { puntos: 10 }, worst: { puntos: -2 } },
      bob: { best: { puntos: 12 }, worst: { puntos: -5 } },
    },
    styleByUser: {
      ana: { analyzedMatches: 3, robos: { count: 1 }, faroles: { count: 0 }, luckPerMatch: 0.4, confidence: { minority: { hitPct: 50, matches: 4 } } },
      bob: { analyzedMatches: 3, robos: { count: 0 }, faroles: { count: 2 }, luckPerMatch: -0.3, confidence: { minority: { hitPct: 25, matches: 4 } } },
    },
    leaguePoints: {
      ana: [10, 20, 5],
      bob: [8, 10, 15],
    },
    positionHistory: {
      ana: [1, 1, 5],
      bob: [2, 3, 4],
    },
    timesTopJornada: { ana: 2, bob: 1 },
    matchPointsByUser: {
      ana: { 1: 15, 2: 0, 3: 5 },
      bob: { 1: 8, 2: 5, 3: 5 },
    },
  };
}

function test_buildDuelContext_calcula_categorias_y_h2h() {
  const c = buildDuelContext('ana', 'bob', duelFixture());
  assert.strictEqual(c.jornada_count, 3);
  assert.strictEqual(c.played_league_count, 3);
  assert.strictEqual(c.left.points_total, 28);
  assert.strictEqual(c.right.points_total, 29);
  assert.strictEqual(c.left.best_jornada, 20);
  assert.strictEqual(c.left.worst_jornada, 5);
  assert.strictEqual(c.left.best_rank, 1);
  assert.strictEqual(c.left.worst_rank, 5);
  assert.strictEqual(c.left.h2h_jornadas_won, 2);
  assert.strictEqual(c.right.h2h_jornadas_won, 1);
  assert.strictEqual(c.left.h2h_partidos_won, 1);
  assert.strictEqual(c.right.h2h_partidos_won, 1);
  assert.strictEqual(c.left.biggest_win, 10);
  assert.strictEqual(c.left.biggest_loss, -10);
  assert.strictEqual(c.right.biggest_win, 10);
  assert.strictEqual(c.right.biggest_loss, -10);
}

function test_calcDuelCategories_y_marcador() {
  const c = buildDuelContext('ana', 'bob', duelFixture());
  const cats = calcDuelCategories(c);
  assert.strictEqual(cats.length, 28);
  const byKey = Object.fromEntries(cats.map(cat => [cat.key, cat]));

  assert.strictEqual(byKey.points_total.winner, 'right');
  assert.strictEqual(byKey.points_total.leftValue, '28');
  assert.strictEqual(byKey.points_total.rightValue, '29');
  assert.strictEqual(byKey.consistency.winner, 'right');
  assert.strictEqual(byKey.faroles.winner, 'left');
  assert.strictEqual(byKey.best_rank.winner, 'left');
  assert.strictEqual(byKey.worst_rank.winner, 'right');
  assert.strictEqual(byKey.best_player.winner, 'right');
  assert.strictEqual(byKey.worst_player.winner, 'left');
  assert.strictEqual(byKey.biggest_win.winner, 'tie');
  assert.strictEqual(byKey.biggest_win.leftValue, '+10');
  assert.strictEqual(byKey.biggest_loss.winner, 'tie');

  const score = calcDuelScore(cats, c);
  assert.strictEqual(score.leftWins + score.rightWins + score.na + cats.filter(x => x.winner === 'tie').length, 28);
  assert.strictEqual(score.disputed, 28);
}

function test_calcDuelScore_desempate() {
  const cats = [
    { winner: 'left' }, { winner: 'right' }, { winner: 'tie' }, { winner: 'na' },
  ];
  const ctx = {
    left: { points_total: 100, points_squad: 10, points_prediction: 50 },
    right: { points_total: 90, points_squad: 20, points_prediction: 40 },
  };
  const score = calcDuelScore(cats, ctx);
  assert.strictEqual(score.leftWins, 1);
  assert.strictEqual(score.rightWins, 1);
  assert.strictEqual(score.disputed, 3);
  assert.strictEqual(score.na, 1);
  assert.strictEqual(score.winner, 'left');
  assert.strictEqual(score.tieBreak, 'total');

  const squadTie = calcDuelScore(cats, {
    left: { points_total: 100, points_squad: 10, points_prediction: 50 },
    right: { points_total: 100, points_squad: 20, points_prediction: 40 },
  });
  assert.strictEqual(squadTie.winner, 'right');
  assert.strictEqual(squadTie.tieBreak, 'squad');

  const draw = calcDuelScore(cats, {
    left: { points_total: 100, points_squad: 10, points_prediction: 50 },
    right: { points_total: 100, points_squad: 10, points_prediction: 50 },
  });
  assert.strictEqual(draw.winner, 'draw');
  assert.strictEqual(draw.tieBreak, null);
}

function test_calcDuelCategories_na_y_peor_menos_malo() {
  const base = buildDuelContext('ana', 'bob', duelFixture());
  const c = JSON.parse(JSON.stringify(base));
  c.left.best_match = null;
  c.left.worst_match = 3;
  c.right.worst_match = 0;
  const cats = calcDuelCategories(c);
  const byKey = Object.fromEntries(cats.map(cat => [cat.key, cat]));
  assert.strictEqual(byKey.best_match.winner, 'na');
  assert.strictEqual(byKey.best_match.leftValue, '—');
  assert.strictEqual(byKey.worst_match.winner, 'left');
  assert.strictEqual(byKey.worst_match.leftValue, '3');
  assert.strictEqual(byKey.worst_match.rightValue, '0');
}

test_calcPlayerExtremes_ignora_jugadores_sin_partidos();
test_buildDuelContext_calcula_categorias_y_h2h();
test_calcDuelCategories_y_marcador();
test_calcDuelScore_desempate();
test_calcDuelCategories_na_y_peor_menos_malo();
console.log('OK estadisticasDuelos T2');
