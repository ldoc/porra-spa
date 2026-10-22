const assert = require('assert');
const { shouldCountClassification } = require('../js/clasificacion.js');

function test_countsnow_true_gana() {
  assert.strictEqual(shouldCountClassification(true, undefined), true, 'fase conteo -> true sin flag');
  assert.strictEqual(shouldCountClassification(true, false), true, 'fase conteo -> true aunque flag false');
  assert.strictEqual(shouldCountClassification(true, true), true, 'fase conteo -> true con flag true');
}

function test_countsnow_false_default_false() {
  assert.strictEqual(shouldCountClassification(false, undefined), false, 'sin flag -> no cuenta');
}

function test_countsnow_false_flag_true() {
  assert.strictEqual(shouldCountClassification(false, true), true, 'flag on -> cuenta');
}

function test_countsnow_false_flag_false() {
  assert.strictEqual(shouldCountClassification(false, false), false, 'flag off -> no cuenta');
}

const tests = [
  test_countsnow_true_gana,
  test_countsnow_false_default_false,
  test_countsnow_false_flag_true,
  test_countsnow_false_flag_false
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
