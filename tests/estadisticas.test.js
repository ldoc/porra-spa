const assert = require('assert');
const { buildTimeline, emptySeries, calcPredictionSeries, calcSquadSeries, calcClassificationSeries, calcEliminatoriasSeries, sumSeries, isLeagueComplete, getSeriesBySource } = require('../js/stats.js');

function test_buildTimeline_13_posiciones_ordenadas() {
  const tl = buildTimeline();
  assert.strictEqual(tl.length, 13);
  assert.deepStrictEqual(tl.map(t => t.point), [0,1,2,3,4,5,6,7,8,9,10,11,12]);
  // Jornadas de liga
  assert.strictEqual(tl[0].label, 'J1');
  assert.strictEqual(tl[7].label, 'J8');
  assert.strictEqual(tl[0].kind, 'liga');
  // Fases de eliminatorias
  assert.deepStrictEqual(tl.slice(8).map(t => t.kind), ['fase','fase','fase','fase','fase']);
  assert.deepStrictEqual(tl.slice(8).map(t => t.label), ['16','8','4','Semis','Final']);
}

function test_calcPredictionSeries_acumulado_solo_liga() {
  const matchDetails = [
    { match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 },
    { match: { id: 2, ronda: 1, fase: 'liga' }, points: 3 },
    { match: { id: 3, ronda: 2, fase: 'liga' }, points: 15 },
    { match: { id: 4, ronda: 3, fase: '16' }, points: 5 }, // fuera de liga → ignorado
  ];
  const r = calcPredictionSeries(matchDetails);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 11);
  assert.strictEqual(r.series[1], 26);
  assert.strictEqual(r.series[2], 26); // el partido de fase '16' no cuenta
  assert.strictEqual(r.series[12], 26);
}

function test_calcPredictionSeries_sin_datos() {
  const r = calcPredictionSeries([]);
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));
}

function test_calcSquadSeries_por_jornada_y_fase() {
  const squadPoints = { playerDetails: [{ jugador: {}, puntosTotal: 15, partidos: [
    { eventId: 1, puntos: 5 },
    { eventId: 2, puntos: 4 },
    { eventId: 11, puntos: 6 },
  ] }] };
  const matchesById = {
    1: { id: 1, fase: 'liga', ronda: 1 },
    2: { id: 2, fase: 'liga', ronda: 1 },
    11: { id: 11, fase: '16' },
  };
  const r = calcSquadSeries(squadPoints, matchesById);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 9);      // J1: 5+4
  assert.strictEqual(r.series[1], 9);      // J2 sin datos → se mantiene
  assert.strictEqual(r.series[7], 9);
  assert.strictEqual(r.series[8], 15);     // fase 16: +6
  assert.strictEqual(r.series[12], 15);
}

function test_calcSquadSeries_evento_sin_match_ignorado() {
  const squadPoints = { playerDetails: [{ jugador: {}, puntosTotal: 3, partidos: [
    { eventId: 999, puntos: 3 },
  ] }] };
  const r = calcSquadSeries(squadPoints, {});
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));
}

test_buildTimeline_13_posiciones_ordenadas();
test_calcPredictionSeries_acumulado_solo_liga();
test_calcPredictionSeries_sin_datos();
test_calcSquadSeries_por_jornada_y_fase();
test_calcSquadSeries_evento_sin_match_ignorado();
console.log('OK buildTimeline');

function test_calcClassificationSeries_salto_en_J8_solo_liga_completa() {
  const r = calcClassificationSeries(100, true);
  assert.strictEqual(r.hasData, true);
  assert.deepStrictEqual(r.series.slice(0, 7), Array(7).fill(0));
  assert.strictEqual(r.series[7], 100);
  assert.strictEqual(r.series[12], 100);
}

function test_calcClassificationSeries_liga_incompleta_sin_datos() {
  const r = calcClassificationSeries(100, false);
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));
}

function test_calcEliminatoriasSeries_saltos_por_fase_alcanzada() {
  const teamDetails = [
    { teamId: 1, reachedRank: 1, points: 10 },
    { teamId: 2, reachedRank: 4, points: 50 },
    { teamId: 3, reachedRank: 6, points: 100 },
    { teamId: 4, reachedRank: 5, points: 75 },
  ];
  const r = calcEliminatoriasSeries(teamDetails);
  assert.strictEqual(r.hasData, true);
  // pos 8 (16): 10 ; pos 11 (Semis): 10+50=60 ; pos 12 (Final): 60+100+75=235
  assert.strictEqual(r.series[7], 0);
  assert.strictEqual(r.series[8], 10);
  assert.strictEqual(r.series[11], 60);
  assert.strictEqual(r.series[12], 235);
}

function test_sumSeries_suma_posicion_a_posicion() {
  const a = { series: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], hasData: true };
  const b = { series: [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], hasData: true };
  const r = sumSeries([a, b]);
  assert.strictEqual(r.series[0], 1);
  assert.strictEqual(r.series[2], 2);
  assert.strictEqual(r.hasData, true);
}

function test_sumSeries_sin_datos() {
  const r = sumSeries([emptySeries(), emptySeries()]);
  assert.strictEqual(r.hasData, false);
}

function test_isLeagueComplete() {
  const matches = [{ id: 1, fase: 'liga' }, { id: 2, fase: 'liga' }, { id: 3, fase: '16' }];
  assert.strictEqual(isLeagueComplete(matches, [{ eventId: 1 }, { eventId: 2 }]), true);
  assert.strictEqual(isLeagueComplete(matches, [{ eventId: 1 }]), false);
  assert.strictEqual(isLeagueComplete(matches, []), false);
  assert.strictEqual(isLeagueComplete([], []), false);
}

function test_getSeriesBySource_total_suma_todas() {
  const userData = {
    matchDetails: [{ match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 }],
    squadPoints: { playerDetails: [{ jugador: {}, puntosTotal: 4, partidos: [{ eventId: 1, puntos: 4 }] }] },
    classificationTotal: 100,
    leagueComplete: true,
    eliminatoriasTeamDetails: [{ teamId: 1, reachedRank: 6, points: 100 }],
    matchesById: { 1: { id: 1, fase: 'liga', ronda: 1 } },
  };
  const r = getSeriesBySource('total', userData);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 12);      // 8 + 4
  assert.strictEqual(r.series[7], 112);     // +100 clasificación
  assert.strictEqual(r.series[12], 212);    // +100 eliminatorias
}

function test_getSeriesBySource_pronosticos_elige_serie_correcta() {
  const userData = {
    matchDetails: [{ match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 }],
    squadPoints: { playerDetails: [] },
    classificationTotal: 0,
    leagueComplete: false,
    eliminatoriasTeamDetails: [],
    matchesById: {},
  };
  const r = getSeriesBySource('pronosticos', userData);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 8);
  assert.strictEqual(r.series[12], 8);
}

function test_calcPredictionSeries_ronda_fuera_de_rango_ignorada() {
  // Solo partidos con ronda fuera de rango o NaN: no deben marcar hasData ni
  // escribir en acc[NaN] (agujero que distorsionaba el resultado).
  const matchDetails = [
    { match: { id: 1, ronda: 9, fase: 'liga' }, points: 8 },        // ronda > 8 → ignorado
    { match: { id: 2, ronda: 0, fase: 'liga' }, points: 4 },        // ronda < 1 → ignorado
    { match: { id: 3, ronda: NaN, fase: 'liga' }, points: 5 },      // ronda NaN → ignorado
    { match: { id: 4, ronda: undefined, fase: 'liga' }, points: 6 }, // sin ronda → ignorado
  ];
  const r = calcPredictionSeries(matchDetails);
  assert.strictEqual(r.hasData, false);
  assert.deepStrictEqual(r.series, Array(13).fill(0));

  // Con un partido válido además, los inválidos no cuentan.
  const mixto = calcPredictionSeries([...matchDetails, { match: { id: 5, ronda: 1, fase: 'liga' }, points: 15 }]);
  assert.strictEqual(mixto.hasData, true);
  assert.strictEqual(mixto.series[0], 15);
  assert.strictEqual(mixto.series[12], 15);
}

function test_calcPredictionSeries_partido_liga_points_0_hasData() {
  const matchDetails = [
    { match: { id: 1, ronda: 1, fase: 'liga' }, points: 0 },
  ];
  const r = calcPredictionSeries(matchDetails);
  assert.strictEqual(r.hasData, true);
  assert.strictEqual(r.series[0], 0);
  assert.strictEqual(r.series[12], 0);
}

function test_getSeriesBySource_datos_mixtos_hasData_por_fuente() {
  // Jugador con datos totales pero sin datos de clasificación (liga incompleta):
  // la fuente 'clasificacion' debe reportar hasData=false mientras 'total' reporta true.
  const userData = {
    matchDetails: [{ match: { id: 1, ronda: 1, fase: 'liga' }, points: 8 }],
    squadPoints: { playerDetails: [] },
    classificationTotal: 0,
    leagueComplete: false,
    eliminatoriasTeamDetails: [],
    matchesById: {},
  };
  assert.strictEqual(getSeriesBySource('total', userData).hasData, true);
  assert.strictEqual(getSeriesBySource('clasificacion', userData).hasData, false);
  assert.strictEqual(getSeriesBySource('clasificacion', userData).series[12], 0);
}

test_calcClassificationSeries_salto_en_J8_solo_liga_completa();
test_calcClassificationSeries_liga_incompleta_sin_datos();
test_calcEliminatoriasSeries_saltos_por_fase_alcanzada();
test_sumSeries_suma_posicion_a_posicion();
test_sumSeries_sin_datos();
test_isLeagueComplete();
test_getSeriesBySource_total_suma_todas();
test_getSeriesBySource_pronosticos_elige_serie_correcta();
test_calcPredictionSeries_ronda_fuera_de_rango_ignorada();
test_calcPredictionSeries_partido_liga_points_0_hasData();
test_getSeriesBySource_datos_mixtos_hasData_por_fuente();
