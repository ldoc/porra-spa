const assert = require('assert');
const { buildTimeline, calcPredictionSeries, calcSquadSeries } = require('../js/stats.js');

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
