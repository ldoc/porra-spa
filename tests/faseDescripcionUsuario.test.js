const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Descripcion de fase como se construye en renderInicioTab (js/main.js)
function buildDescripcion(currentFase, userName) {
  const descripcion = currentFase?.instrucciones || 'Cargando fase...';
  return descripcion.replace(/\{usuario\}/g, userName);
}

const fases = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/fases.json'), 'utf8')).fases;

function test_sustituye_usuario_en_pretemporada() {
  const pre = fases.find(f => f.nombre === 'FASE_PRETEMPORADA');
  const desc = buildDescripcion(pre, 'juan123');
  assert.ok(desc.startsWith('Hola juan123.'), `debe empezar con "Hola juan123." pero fue: ${desc.slice(0, 20)}`);
  assert.ok(!desc.includes('{usuario}'), 'no debe quedar el placeholder {usuario}');
}

function test_no_rompe_fases_sin_placeholder() {
  const liga = fases.find(f => f.nombre === 'FASE_LIGA');
  const desc = buildDescripcion(liga, 'juan123');
  assert.ok(desc.includes('fase de liga'), 'debe conservar el texto original');
  assert.ok(!desc.includes('{usuario}'));
}

function test_fallback_sin_fase() {
  assert.strictEqual(buildDescripcion(null, 'juan123'), 'Cargando fase...');
}

const tests = [test_sustituye_usuario_en_pretemporada, test_no_rompe_fases_sin_placeholder, test_fallback_sin_fase];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
