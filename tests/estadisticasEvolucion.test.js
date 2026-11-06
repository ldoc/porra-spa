const assert = require('assert');
const {
  buildTimeline,
  toStagePoints,
  calcEvolutionPositions,
  lastTimelinePoint,
  trimTimeline,
  buildEvolutionSeriesMap,
  buildAxisTicks,
  formatPointValue,
  buildPointTooltipText,
  EVO_METRIC_DEFAULT,
  EVO_MODE_DEFAULT,
} = require('../js/stats.js');

function series(values) {
  return values.slice();
}

function test_toStagePoints_acumulado_a_etapa() {
  const delta = toStagePoints(series([8, 10, 10, 14]));
  assert.deepStrictEqual(delta.slice(0, 5), [8, 2, 0, 4, 0]);
  assert.deepStrictEqual(delta.slice(5), Array(8).fill(0));
  assert.deepStrictEqual(toStagePoints([10, 8, 8]).slice(0, 4), [10, -2, 0, 0]);
}

function test_calcEvolutionPositions_empates_y_varias_etapas() {
  const map = new Map([
    ['a', { series: series([10, 20]), hasData: true }],
    ['b', { series: series([15, 15]), hasData: true }],
    ['c', { series: series([15, 0]), hasData: false }],
  ]);
  const pos = calcEvolutionPositions(map);
  assert.deepStrictEqual(pos.get('a').series.slice(0, 2), [3, 1]);
  assert.deepStrictEqual(pos.get('b').series.slice(0, 2), [1, 2]);
  assert.deepStrictEqual(pos.get('c').series.slice(0, 2), [1, 3]);
  assert.strictEqual(pos.get('c').hasData, false);
}

function test_lastTimelinePoint_y_trim() {
  const matches = [
    { id: 1, fase: 'liga', ronda: 1, homeTeamId: 10, awayTeamId: 20 },
    { id: 2, fase: 'liga', ronda: 3, homeTeamId: 10, awayTeamId: 20 },
    { id: 3, fase: '16', homeTeamId: 10, awayTeamId: 20 },
    { id: 4, fase: '16', homeTeamId: 10, awayTeamId: 20 },
  ];
  const stats = {
    1: { stats: { 10: { goles: 2 }, 20: { goles: 1 } } },
    2: { stats: { 10: { goles: 0 }, 20: { goles: 0 } } },
    3: { stats: { 10: { goles: 1 }, 20: { goles: 0 } } },
  };
  assert.strictEqual(lastTimelinePoint(matches, stats), 8);
  assert.strictEqual(lastTimelinePoint([], {}), 0);
  const tl = buildTimeline();
  assert.strictEqual(trimTimeline(tl, 2).length, 3);
  assert.strictEqual(trimTimeline(tl, 2)[2].label, 'J3');
  assert.strictEqual(trimTimeline(tl, 0).length, 1);
}

function test_buildEvolutionSeriesMap_puntos_y_posicion() {
  const source = new Map([
    ['a', { series: series([8, 10, 10]), hasData: true }],
  ]);
  const total = new Map([
    ['a', { series: series([8, 10, 10]), hasData: true }],
    ['b', { series: series([5, 12, 12]), hasData: true }],
  ]);
  assert.deepStrictEqual(
    buildEvolutionSeriesMap('puntos', 'acumulado', source, null).get('a').series.slice(0, 3),
    [8, 10, 10]
  );
  assert.deepStrictEqual(
    buildEvolutionSeriesMap('puntos', 'jornada', source, null).get('a').series.slice(0, 3),
    [8, 2, 0]
  );
  const pos = buildEvolutionSeriesMap('posicion', 'acumulado', null, total);
  assert.deepStrictEqual(pos.get('a').series.slice(0, 2), [1, 2]);
  assert.deepStrictEqual(pos.get('b').series.slice(0, 2), [2, 1]);
}

function test_defaults_evolucion() {
  assert.strictEqual(EVO_METRIC_DEFAULT, 'posicion');
  assert.strictEqual(EVO_MODE_DEFAULT, 'acumulado');
}

function test_buildAxisTicks_tres_marcas() {
  assert.deepStrictEqual(buildAxisTicks('puntos', 47), [
    { value: 0, label: '0' },
    { value: 24, label: '24' },
    { value: 47, label: '47' },
  ]);
  assert.deepStrictEqual(buildAxisTicks('posicion', 6), [
    { value: 1, label: '#1' },
    { value: 4, label: '#4' },
    { value: 6, label: '#6' },
  ]);
  assert.deepStrictEqual(buildAxisTicks('posicion', 1), [{ value: 1, label: '#1' }]);
  assert.deepStrictEqual(buildAxisTicks('puntos', 30, -6), [
    { value: -6, label: '-6' },
    { value: 12, label: '12' },
    { value: 30, label: '30' },
  ]);
}

function test_formatPointValue_y_tooltip() {
  assert.strictEqual(formatPointValue('puntos', 24), '24 pts');
  assert.strictEqual(formatPointValue('posicion', 4), '#4');
  assert.strictEqual(buildPointTooltipText('ldoc', 'J3', 'puntos', 24), 'ldoc · J3 · 24 pts');
  assert.strictEqual(buildPointTooltipText('ldoc', 'J3', 'posicion', 4), 'ldoc · J3 · #4');
}

test_toStagePoints_acumulado_a_etapa();
test_calcEvolutionPositions_empates_y_varias_etapas();
test_lastTimelinePoint_y_trim();
test_buildEvolutionSeriesMap_puntos_y_posicion();
test_defaults_evolucion();
test_buildAxisTicks_tres_marcas();
test_formatPointValue_y_tooltip();
console.log('OK estadisticasEvolucion');
