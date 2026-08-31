const assert = require('assert');
const {
  countPredictedMatches,
  computeFinalSlotsFilled,
  computeProgressForUser,
  computeSummaries,
  sortUsers
} = require('../js/progresoAdmin.js');

const LIGA_144 = Array.from({ length: 144 }, (_, i) => ({ id: String(i + 1), fase: 'liga' }));

function test_countPredictedMatches_cuenta_solo_numericos() {
  const matches = [{ id: '1', fase: 'liga' }, { id: '2', fase: 'liga' }, { id: '3', fase: 'liga' }];
  const predictions = { '1': { home: 2, away: 1 }, '2': { home: null, away: null } };
  assert.strictEqual(countPredictedMatches(matches, predictions), 1);
  assert.strictEqual(countPredictedMatches(matches, null), 0);
  assert.strictEqual(countPredictedMatches(matches, {}), 0);
}

function test_computeFinalSlotsFilled_vacio() {
  assert.strictEqual(computeFinalSlotsFilled(null), 0);
  assert.strictEqual(computeFinalSlotsFilled({}), 0);
}

function test_computeFinalSlotsFilled_parcial() {
  const fp = { champion: 42, runnerUp: null, semiFinalists: [1, 2], quarterFinalists: [], roundOf16: [], roundOf32: [] };
  assert.strictEqual(computeFinalSlotsFilled(fp), 3);
}

function test_computeFinalSlotsFilled_completo_24() {
  const fp = {
    champion: 1, runnerUp: 2,
    semiFinalists: [3, 4], quarterFinalists: [5, 6, 7, 8],
    roundOf16: [9, 10, 11, 12, 13, 14, 15, 16],
    roundOf32: [17, 18, 19, 20, 21, 22, 23, 24]
  };
  assert.strictEqual(computeFinalSlotsFilled(fp), 24);
}

function test_computeProgressForUser_liga_y_lock() {
  const predictions = {};
  for (let i = 0; i < 100; i++) predictions[String(i + 1)] = { home: 1, away: 0 };
  const user = {
    username: 'juan123', avatar: '⚽', isAdmin: false, predictionsConfirmed: false,
    predictions, finalPredictions: null, squadCount: 18
  };
  const p = computeProgressForUser(user, { liga: LIGA_144 });
  assert.strictEqual(p.byFase.liga.done, 100);
  assert.strictEqual(p.byFase.liga.total, 144);
  assert.strictEqual(p.finalLocked, true);
  assert.strictEqual(p.finalFilled, 0);
  assert.strictEqual(p.squadCount, 18);
  assert.strictEqual(p.squadTotal, 25);
}

function test_computeProgressForUser_confirmado_elimina_lock() {
  const user = {
    username: 'marta7', avatar: '🏆', isAdmin: false, predictionsConfirmed: true,
    predictions: {}, finalPredictions: null, squadCount: 25
  };
  const p = computeProgressForUser(user, { liga: LIGA_144 });
  assert.strictEqual(p.finalLocked, false);
  assert.strictEqual(p.predictionsConfirmed, true);
}

function test_computeSummaries() {
  const list = [
    { byFase: { liga: { done: 144, total: 144 } }, predictionsConfirmed: true, squadCount: 25, squadTotal: 25, finalFilled: 24, finalTotal: 24, finalLocked: false },
    { byFase: { liga: { done: 89, total: 144 } }, predictionsConfirmed: false, squadCount: 18, squadTotal: 25, finalFilled: 0, finalTotal: 24, finalLocked: true },
    { byFase: { liga: { done: 144, total: 144 } }, predictionsConfirmed: true, squadCount: 25, squadTotal: 25, finalFilled: 20, finalTotal: 24, finalLocked: false }
  ];
  const s = computeSummaries(list);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.ligaComplete, 2);
  assert.strictEqual(s.confirmed, 2);
  assert.strictEqual(s.squadComplete, 2);
  assert.strictEqual(s.finalComplete, 1);
}

function test_sortUsers_nombre() {
  const list = [
    { username: 'luciab', byFase: { liga: { done: 89, total: 144 } } },
    { username: 'marta7', byFase: { liga: { done: 144, total: 144 } } },
    { username: 'admin', byFase: { liga: { done: 144, total: 144 } } }
  ];
  const sorted = sortUsers(list, 'name');
  assert.deepStrictEqual(sorted.map(u => u.username), ['admin', 'luciab', 'marta7']);
}

function test_sortUsers_liga_menos_completados_primero() {
  const list = [
    { username: 'marta7', byFase: { liga: { done: 144, total: 144 } } },
    { username: 'luciab', byFase: { liga: { done: 89, total: 144 } } },
    { username: 'pablo_', byFase: { liga: { done: 102, total: 144 } } }
  ];
  const sorted = sortUsers(list, 'liga');
  assert.deepStrictEqual(sorted.map(u => u.username), ['luciab', 'pablo_', 'marta7']);
}

function test_sortUsers_confirmados_primero() {
  const list = [
    { username: 'luciab', predictionsConfirmed: false },
    { username: 'marta7', predictionsConfirmed: true }
  ];
  const sorted = sortUsers(list, 'confirmed');
  assert.deepStrictEqual(sorted.map(u => u.username), ['marta7', 'luciab']);
}

const tests = [
  test_countPredictedMatches_cuenta_solo_numericos,
  test_computeFinalSlotsFilled_vacio,
  test_computeFinalSlotsFilled_parcial,
  test_computeFinalSlotsFilled_completo_24,
  test_computeProgressForUser_liga_y_lock,
  test_computeProgressForUser_confirmado_elimina_lock,
  test_computeSummaries,
  test_sortUsers_nombre,
  test_sortUsers_liga_menos_completados_primero,
  test_sortUsers_confirmados_primero
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);