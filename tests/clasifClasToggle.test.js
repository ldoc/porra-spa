const assert = require('assert');
const { shouldCountClassification } = require('../js/clasificacion.js');
const fs = require('fs');
const path = require('path');
const mainSrc = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
const indexSrc = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

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

function test_toggle_en_header_no_en_tabla() {
  assert.ok(mainSrc.includes('function syncClasifClasHeaderToggle()'), 'helper sync existe');
  assert.ok(mainSrc.includes('clasif-clas-header-toggle'), 'id del nodo header');
  assert.ok(!mainSrc.includes('toggleHtml'), 'toggle ya no se concatena en la tabla');
  assert.ok(!mainSrc.includes('<small>Los puntos por clasificación varían'), 'hint visible eliminado');
  assert.ok(mainSrc.includes('<span>Mostrar ptos clasificación temporal</span>'), 'etiqueta toggle');
  assert.ok(mainSrc.includes("querySelector('#tab-clasificacion .section-header')"), 'localiza el header');
  assert.ok(mainSrc.includes('header.after(wrap)'), 'toggle en fila propia bajo el titulo');
}

function test_css_compacto() {
  assert.ok(cssSrc.includes('.clasif-clas-toggle'), 'clase existe');
  assert.ok(!cssSrc.includes('flex-wrap: wrap;\n  gap: 2px 10px;'), 'sin layout multi-fila previo');
  assert.ok(!cssSrc.includes('.clasif-clas-toggle small'), 'hint css eliminado');
}

function test_cache_busting() {
  assert.ok(indexSrc.includes('styles.css?v=130'), 'css v130');
  assert.ok(indexSrc.includes('main.js?v=178'), 'main v178');
}

const tests = [
  test_countsnow_true_gana,
  test_countsnow_false_default_false,
  test_countsnow_false_flag_true,
  test_countsnow_false_flag_false,
  test_toggle_en_header_no_en_tabla,
  test_css_compacto,
  test_cache_busting
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
