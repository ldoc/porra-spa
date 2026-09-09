const assert = require('assert');
const {
  getMatchDayKey, getLastTwoMatchDays, filterMatchStatsUpTo,
  countUserPredictionsInSubset, computeTrendMap, buildTrendCellHtml
} = require('../js/trend.js');

function ts(y, mo, d, h) {
  return Math.floor(new Date(y, mo, d, h, 0, 0).getTime() / 1000);
}

function test_getMatchDayKey_formato_y_nulos() {
  assert.strictEqual(getMatchDayKey(ts(2026, 8, 8, 21)), '2026-09-08');
  assert.strictEqual(getMatchDayKey(null), null);
  assert.strictEqual(getMatchDayKey(undefined), null);
  assert.strictEqual(getMatchDayKey('x'), null);
}

function test_getLastTwoMatchDays_ultimos_con_partidos() {
  const matches = [
    { id: 1, fechaTs: ts(2026, 8, 8, 21) },
    { id: 2, fechaTs: ts(2026, 8, 9, 21) },
    { id: 3, fechaTs: ts(2026, 8, 10, 21) }
  ];
  const stats = [{ eventId: 1 }, { eventId: 2 }, { eventId: 3 }];
  assert.deepStrictEqual(getLastTwoMatchDays(matches, stats), { prev: '2026-09-09', last: '2026-09-10' });
}

function test_getLastTwoMatchDays_salta_dias_sin_resultado_e_ignora_desconocidos() {
  const matches = [
    { id: 1, fechaTs: ts(2026, 8, 8, 21) },
    { id: 3, fechaTs: ts(2026, 8, 10, 21) }
  ];
  const stats = [{ eventId: 1 }, { eventId: 3 }, { eventId: 999 }];
  assert.deepStrictEqual(getLastTwoMatchDays(matches, stats), { prev: '2026-09-08', last: '2026-09-10' });
}

function test_getLastTwoMatchDays_menos_de_dos_dias_null() {
  const matches = [{ id: 1, fechaTs: ts(2026, 8, 8, 21) }];
  assert.strictEqual(getLastTwoMatchDays(matches, [{ eventId: 1 }]), null);
  assert.strictEqual(getLastTwoMatchDays([], []), null);
}

function test_filterMatchStatsUpTo_corte_inclusivo() {
  const matches = [
    { id: 1, fechaTs: ts(2026, 8, 8, 21) },
    { id: 2, fechaTs: ts(2026, 8, 9, 21) },
    { id: 3, fechaTs: ts(2026, 8, 10, 21) }
  ];
  const stats = [{ eventId: 1 }, { eventId: 2 }, { eventId: 3 }, { eventId: 999 }];
  assert.deepStrictEqual(
    filterMatchStatsUpTo('2026-09-09', matches, stats).map(s => s.eventId),
    [1, 2]
  );
}

function test_countUserPredictionsInSubset_solo_completos() {
  const preds = {
    1: { home: 2, away: 1 },
    2: { home: null, away: 1 },
    3: { home: 0, away: 0 }
  };
  assert.strictEqual(countUserPredictionsInSubset(preds, new Set([1, 2, 3, 4])), 2);
  assert.strictEqual(countUserPredictionsInSubset(undefined, new Set([1])), 0);
}

function test_computeTrendMap_sube_baja_igual_nuevo_ausente() {
  const prev = [
    { name: 'juan', realPoints: 300, predictedCount: 5 },
    { name: 'maria', realPoints: 200, predictedCount: 5 },
    { name: 'luis', realPoints: 100, predictedCount: 5 },
    { name: 'nuevo', realPoints: 0, predictedCount: 0 }
  ];
  const curr = [
    { name: 'maria', realPoints: 400, predictedCount: 9 },
    { name: 'juan', realPoints: 350, predictedCount: 9 },
    { name: 'luis', realPoints: 150, predictedCount: 9 },
    { name: 'nuevo', realPoints: 120, predictedCount: 4 },
    { name: 'extra', realPoints: 10, predictedCount: 1 }
  ];
  const map = computeTrendMap(prev, curr);
  assert.deepStrictEqual(map.maria, { dir: 'up', n: 1 });
  assert.deepStrictEqual(map.juan, { dir: 'down', n: 1 });
  assert.deepStrictEqual(map.luis, { dir: 'same', n: 0 });
  assert.strictEqual(map.nuevo, null);
  assert.strictEqual(map.extra, null);
}

function test_buildTrendCellHtml_apilado_direccional() {
  const up = buildTrendCellHtml({ dir: 'up', n: 2 });
  assert.ok(up.includes('trend-up'), 'clase up');
  assert.ok(up.indexOf('▲') < up.indexOf('>2<'), 'flecha arriba, numero debajo');
  assert.ok(up.includes('Sube 2 puestos'), 'title/aria');
  const down = buildTrendCellHtml({ dir: 'down', n: 1 });
  assert.ok(down.includes('trend-down'), 'clase down');
  assert.ok(down.indexOf('>1<') < down.indexOf('▼'), 'numero arriba, flecha debajo');
  assert.ok(down.includes('Baja 1 puesto respecto') && !down.includes('puestos'), 'singular sin s');
  const same = buildTrendCellHtml({ dir: 'same', n: 0 });
  assert.ok(same.includes('trend-same') && same.includes('＝'), 'igual solo');
  assert.ok(!same.includes('<span>0</span>'), 'igual sin numero');
  assert.strictEqual(buildTrendCellHtml(null), '<span class="trend"></span>');
}

const tests = [
  test_getMatchDayKey_formato_y_nulos,
  test_getLastTwoMatchDays_ultimos_con_partidos,
  test_getLastTwoMatchDays_salta_dias_sin_resultado_e_ignora_desconocidos,
  test_getLastTwoMatchDays_menos_de_dos_dias_null,
  test_filterMatchStatsUpTo_corte_inclusivo,
  test_countUserPredictionsInSubset_solo_completos,
  test_computeTrendMap_sube_baja_igual_nuevo_ausente,
  test_buildTrendCellHtml_apilado_direccional
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
