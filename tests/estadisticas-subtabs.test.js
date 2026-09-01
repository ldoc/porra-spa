const assert = require('assert');
const { matchResultOf, extractPlayedMatches, calcReliabilityRow } = require('../js/stats.js');
const { buildCompletedLeagueData, calcStreaks, calcBestJornadas, calcUserBestJornada, calcPositionHistory, calcTimesTopJornada, calcMomentum, calcConsistency } = require('../js/stats.js');
const { tallyChampions, finalPredictionTeamIds, compareQuadroWithCommunity } = require('../js/stats.js');
const { aggregateSquads } = require('../js/stats.js');
const { buildDonutSegments, calcPredictionBias, calcBestMatch } = require('../js/stats.js');
const { calcBestPlayersByPosition, calcMostProfitablePlayer, sourceSplitFromUserData } = require('../js/stats.js');

function test_matchResultOf() {
  assert.strictEqual(matchResultOf(2, 1), 'H');
  assert.strictEqual(matchResultOf(0, 3), 'A');
  assert.strictEqual(matchResultOf(1, 1), 'D');
}

function test_extractPlayedMatches_solo_con_goles_finitos() {
  const matches = [
    { id: 1, homeTeamId: 10, awayTeamId: 20 },
    { id: 2, homeTeamId: 30, awayTeamId: 40 },
    { id: 3, homeTeamId: 50, awayTeamId: 60 },
  ];
  const msById = {
    1: { eventId: 1, stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
    2: { eventId: 2, stats: { 30: { goles: 0 }, 40: { goles: 0 } } },
    3: { eventId: 3, stats: {} },
  };
  const played = extractPlayedMatches(matches, msById);
  assert.strictEqual(played.length, 2);
  assert.deepStrictEqual(played[0], { matchId: 1, home: 2, away: 1, result: 'H' });
  assert.deepStrictEqual(played[1], { matchId: 2, home: 0, away: 0, result: 'D' });
}

function test_calcReliabilityRow_metricas() {
  const playedMatches = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 3, result: 'A' },
    { matchId: 4, home: 2, away: 2, result: 'D' },
  ];
  const allPredictions = {
    ana: {
      1: { home: 2, away: 1 },
      2: { home: 0, away: 0 },
      3: { home: 2, away: 0 },
    },
  };
  const userPoints = { ana: { matchDetails: [
    { match: { id: 1 }, points: 15 },
    { match: { id: 2 }, points: 4 },
    { match: { id: 3 }, points: 11 },
    { match: { id: 99 }, points: 8 },
  ] } };
  const r = calcReliabilityRow('ana', playedMatches, allPredictions, userPoints);
  assert.strictEqual(r.played, 3);
  assert.strictEqual(r.hits, 2);
  assert.strictEqual(r.pctResult, 67);
  assert.strictEqual(r.ptsPerMatch, 10);
  assert.strictEqual(r.exactScores, 2);
  assert.strictEqual(r.perfect15, 1);
}

function test_calcReliabilityRow_sin_pronosticos() {
  const r = calcReliabilityRow('bob', [], {}, {});
  assert.strictEqual(r.played, 0);
  assert.strictEqual(r.pctResult, 0);
  assert.strictEqual(r.ptsPerMatch, 0);
}

test_matchResultOf();
test_extractPlayedMatches_solo_con_goles_finitos();
test_calcReliabilityRow_metricas();
test_calcReliabilityRow_sin_pronosticos();
console.log('OK estadisticas-subtabs T1');

function test_buildCompletedLeagueData_solo_jornadas_completas() {
  const leagueMatches = [
    { id: 1, ronda: 1, homeTeamId: 10, awayTeamId: 20, fase: 'liga' },
    { id: 2, ronda: 1, homeTeamId: 30, awayTeamId: 40, fase: 'liga' },
    { id: 3, ronda: 2, homeTeamId: 10, awayTeamId: 30, fase: 'liga' },
    { id: 4, ronda: 3, homeTeamId: 20, awayTeamId: 40, fase: 'liga' },
  ];
  const msById = {
    1: { eventId: 1, stats: { 10: { goles: 1 }, 20: { goles: 0 } } },
    2: { eventId: 2, stats: { 30: { goles: 2 }, 40: { goles: 2 } } },
    3: { eventId: 3, stats: { 10: { goles: 3 }, 30: { goles: 1 } } },
  };
  const detailsByUser = {
    ana: [
      { match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 },
      { match: { id: 2, ronda: 1, fase: 'liga' }, points: 7 },
      { match: { id: 3, ronda: 2, fase: 'liga' }, points: 15 },
      { match: { id: 4, ronda: 3, fase: 'liga' }, points: 5 },
      { match: { id: 999, ronda: 4, fase: '16' }, points: 9 },
    ],
  };
  const r = buildCompletedLeagueData(leagueMatches, msById, detailsByUser);
  assert.deepStrictEqual(r.completedRondas, [1, 2]);
  assert.deepStrictEqual(r.pointsByUserByJornada.ana, [15, 15]);
}

function test_calcStreaks_up_down_y_empate() {
  const st = calcStreaks({
    a: [10, 20, 30],
    b: [30, 25, 10],
    c: [10, 10, 20],
    d: [5],
    e: [],
  });
  assert.deepStrictEqual(st.a, { dir: 'up', len: 2, lastPts: 30 });
  assert.deepStrictEqual(st.b, { dir: 'down', len: 2, lastPts: 10 });
  assert.deepStrictEqual(st.c, { dir: 'up', len: 1, lastPts: 20 });
  assert.strictEqual(st.d, null);
  assert.strictEqual(st.e, null);
}

function test_calcStreaks_corte_al_cambiar_direccion() {
  const st = calcStreaks({ x: [10, 30, 20, 25] });
  assert.deepStrictEqual(st.x, { dir: 'up', len: 1, lastPts: 25 });
}

function test_calcBestJornadas_top_n() {
  const best = calcBestJornadas({
    ana: [15, 30],
    bea: [40],
  }, 2);
  assert.deepStrictEqual(best, [
    { username: 'bea', jornadaIdx: 0, pts: 40 },
    { username: 'ana', jornadaIdx: 1, pts: 30 },
  ]);
}

test_buildCompletedLeagueData_solo_jornadas_completas();
test_calcStreaks_up_down_y_empate();
test_calcStreaks_corte_al_cambiar_direccion();
test_calcBestJornadas_top_n();
console.log('OK estadisticas-subtabs T2');

function test_tallyChampions() {
  const t = tallyChampions({
    ana: { champion: 100 },
    bea: { champion: 100 },
    cal: { champion: 200 },
    dan: { champion: null },
    eve: null,
  });
  assert.strictEqual(t.total, 3);
  assert.deepStrictEqual(t.teams, [{ teamId: 100, votes: 2 }, { teamId: 200, votes: 1 }]);
}

function test_finalPredictionTeamIds_24_slots() {
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4],
    quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24],
  };
  assert.strictEqual(finalPredictionTeamIds(fp).length, 24);
  assert.strictEqual(finalPredictionTeamIds(null).length, 0);
}

function test_compareQuadroWithCommunity() {
  const mk = (base) => ({ champion: base, runnerUp: base + 1,
    semiFinalists: [base + 2, base + 3],
    quarterFinalists: [base + 4, base + 5, base + 6, base + 7],
    roundOf16: Array.from({ length: 8 }, (_, i) => base + 8 + i),
    roundOf32: Array.from({ length: 8 }, (_, i) => base + 16 + i) });
  const cache = { yo: mk(100), igual: mk(100), medio: mk(112), muydistinto: mk(124) };
  const r = compareQuadroWithCommunity('yo', cache);
  assert.strictEqual(r.users, 3);
  assert.strictEqual(r.avgCommon, 12);
  assert.strictEqual(r.avgPct, 50);
  assert.strictEqual(r.veryDiffCount, 2);
}

test_tallyChampions();
test_finalPredictionTeamIds_24_slots();
test_compareQuadroWithCommunity();
console.log('OK estadisticas-subtabs T3');

function test_aggregateSquads_pts_posesion() {
  const squadsCache = {
    ana: [{ id: 1, nombre: 'Mbappé', posicion: 'F' }, { id: 2, nombre: 'Courtois', posicion: 'G' }],
    bea: [{ id: 1, nombre: 'Mbappé', posicion: 'F' }],
  };
  const squadPointsByUser = {
    ana: { playerDetails: [
      { jugador: { id: 1 }, puntosTotal: 50 },
      { jugador: { id: 2 }, puntosTotal: 20 },
    ] },
    bea: { playerDetails: [{ jugador: { id: 1 }, puntosTotal: 36 }] },
    cal: null,
  };
  const r = aggregateSquads(squadPointsByUser, squadsCache);
  assert.strictEqual(r.usersWithSquad, 2);
  assert.strictEqual(r.uniquePlayers, 2);
  assert.strictEqual(r.rows[0].player.nombre, 'Mbappé');
  assert.strictEqual(r.rows[0].pts, 86);
  assert.strictEqual(r.rows[0].ownerCount, 2);
  assert.strictEqual(r.rows[0].possessionPct, 100);
  assert.strictEqual(r.rows[1].player.nombre, 'Courtois');
  assert.strictEqual(r.rows[1].possessionPct, 50);
}

function test_aggregateSquads_vacio() {
  const r = aggregateSquads({}, {});
  assert.strictEqual(r.usersWithSquad, 0);
  assert.deepStrictEqual(r.rows, []);
}

test_aggregateSquads_pts_posesion();
test_aggregateSquads_vacio();
console.log('OK estadisticas-subtabs T4');

function test_calcUserBestJornada_maximo_y_vacio() {
  assert.deepStrictEqual(calcUserBestJornada([30, 55, 40]), { idx: 1, pts: 55 });
  assert.strictEqual(calcUserBestJornada([]), null);
  assert.strictEqual(calcUserBestJornada(undefined), null);
}

function test_calcPositionHistory_empates_comparten_puesto() {
  const hist = calcPositionHistory({
    a: [10, 20],
    b: [15, 15],
    c: [15, 0],
  });
  assert.deepStrictEqual(hist.a, [3, 1]);
  assert.deepStrictEqual(hist.b, [1, 1]);
  assert.deepStrictEqual(hist.c, [1, 3]);
}

function test_calcTimesTopJornada_empate_cuenta_para_ambos() {
  const tops = calcTimesTopJornada({
    a: [10, 15],
    b: [15, 15],
    c: [15, 0],
  });
  assert.deepStrictEqual(tops, { a: 1, b: 2, c: 1 });
}

function test_calcMomentum_ultimas_3_vs_media() {
  const m = calcMomentum([10, 10, 10, 25, 25, 35]);
  assert.strictEqual(m.recent, 85);
  assert.strictEqual(m.avg, 19.2);
  assert.strictEqual(m.delta, 9.2);
  assert.strictEqual(calcMomentum([10, 10]), null);
}

function test_calcConsistency_desviacion_tipica() {
  assert.strictEqual(calcConsistency([10, 10, 10, 10]), 0);
  assert.strictEqual(calcConsistency([0, 10]), 5);
  assert.strictEqual(calcConsistency([10]), null);
}

test_calcUserBestJornada_maximo_y_vacio();
test_calcPositionHistory_empates_comparten_puesto();
test_calcTimesTopJornada_empate_cuenta_para_ambos();
test_calcMomentum_ultimas_3_vs_media();
test_calcConsistency_desviacion_tipica();
console.log('OK estadisticas-subtabs T5');

function test_buildDonutSegments_geometria_y_filtrado() {
  const segs = buildDonutSegments([
    { key: 'p', label: 'Pronósticos', color: '#8B5CF6', value: 75 },
    { key: 's', label: 'Plantilla', color: '#10B981', value: 25 },
    { key: 'z', label: 'Cero', color: '#000000', value: 0 },
  ]);
  assert.strictEqual(segs.length, 2);
  assert.strictEqual(segs[0].pct, 75);
  assert.ok(Math.abs(parseFloat(segs[0].dasharray) - (2 * Math.PI * 42 * 0.75)) < 0.01);
  assert.ok(Math.abs(parseFloat(segs[1].dashoffset) + (2 * Math.PI * 42 * 0.75)) < 0.01);
  assert.strictEqual(buildDonutSegments([{ key: 'a', value: 0 }]).length, 0);
  assert.strictEqual(buildDonutSegments([]).length, 0);
}

function test_calcPredictionBias_por_resultado_pronosticado() {
  const preds = {
    1: { home: 2, away: 1 },
    2: { home: 0, away: 0 },
    3: { home: 1, away: 3 },
    4: { home: 0, away: 0 },
  };
  const played = [
    { matchId: 1, home: 2, away: 1, result: 'H' },
    { matchId: 2, home: 0, away: 0, result: 'D' },
    { matchId: 3, home: 1, away: 3, result: 'A' },
    { matchId: 4, home: 3, away: 1, result: 'H' },
    { matchId: 5, home: 1, away: 0, result: 'H' },
  ];
  const bias = calcPredictionBias(preds, played);
  assert.deepStrictEqual(bias.H, { pred: 1, hits: 1 });
  assert.deepStrictEqual(bias.D, { pred: 2, hits: 1 });
  assert.deepStrictEqual(bias.A, { pred: 1, hits: 1 });
}

function test_calcBestMatch_maximo_y_vacio() {
  assert.deepStrictEqual(
    calcBestMatch([{ match: { id: 7 }, points: 3 }, { match: { id: 9 }, points: 12 }]),
    { points: 12, matchId: 9 }
  );
  assert.strictEqual(calcBestMatch([]), null);
  assert.strictEqual(calcBestMatch(undefined), null);
}

test_buildDonutSegments_geometria_y_filtrado();
test_calcPredictionBias_por_resultado_pronosticado();
test_calcBestMatch_maximo_y_vacio();
console.log('OK estadisticas-subtabs T6');

function test_calcBestPlayersByPosition_top_por_demarcacion() {
  const details = [
    { jugador: { nombre: 'Courtois', posicion: 'G' }, puntosTotal: 38, partidos: [{}, {}] },
    { jugador: { nombre: 'Ederson', posicion: 'G' }, puntosTotal: 14, partidos: [{}] },
    { jugador: { nombre: 'Hakimi', posicion: 'D' }, puntosTotal: 41, partidos: [{}] },
    { jugador: { nombre: 'Mbappé', posicion: 'F' }, puntosTotal: 61, partidos: [{}] },
  ];
  const best = calcBestPlayersByPosition(details);
  assert.strictEqual(best.G.jugador.nombre, 'Courtois');
  assert.strictEqual(best.D.jugador.nombre, 'Hakimi');
  assert.strictEqual(best.M, null);
  assert.strictEqual(best.F.jugador.nombre, 'Mbappé');
  assert.strictEqual(best.top.jugador.nombre, 'Mbappé');
  assert.strictEqual(calcBestPlayersByPosition([]).top, null);
}

function test_calcMostProfitablePlayer_exige_partidos() {
  const details = [
    { jugador: { nombre: 'A' }, puntosTotal: 20, partidos: [{}, {}] },
    { jugador: { nombre: 'B' }, puntosTotal: 9, partidos: [{}] },
    { jugador: { nombre: 'C' }, puntosTotal: 50, partidos: [] },
  ];
  const best = calcMostProfitablePlayer(details);
  assert.strictEqual(best.jugador.nombre, 'A');
  assert.strictEqual(best.ptsPorPartido, 10);
  assert.strictEqual(best.partidos, 2);
  assert.strictEqual(calcMostProfitablePlayer([]), null);
  assert.strictEqual(calcMostProfitablePlayer([{ jugador: { nombre: 'D' }, puntosTotal: 99, partidos: [] }]), null);
}

function test_sourceSplitFromUserData_reparte_cuatro_fuentes() {
  const split = sourceSplitFromUserData(120, {
    squadPoints: { totalPoints: 60 },
    classificationTotal: 30,
    eliminatoriasTeamDetails: [{ points: 10 }, { points: 5 }, { points: 0 }],
  });
  assert.deepStrictEqual(split, { prediction: 120, squad: 60, classification: 30, eliminatorias: 15 });
  const vacio = sourceSplitFromUserData(undefined, {});
  assert.deepStrictEqual(vacio, { prediction: 0, squad: 0, classification: 0, eliminatorias: 0 });
}

test_calcBestPlayersByPosition_top_por_demarcacion();
test_calcMostProfitablePlayer_exige_partidos();
test_sourceSplitFromUserData_reparte_cuatro_fuentes();
console.log('OK estadisticas-subtabs T7');
