const assert = require('assert');

// Mock AppState con fases de ejemplo (misma estructura que data/fases.json)
const AppState = {
  fases: [
    { id: 1, nombre: 'FASE_PRETEMPORADA', desc: 'Pretemporada' },
    { id: 2, nombre: 'FASE_LIGA', desc: 'Liga' },
    { id: 4, nombre: 'FASE_16', desc: 'Knockouts' },
    { id: 12, nombre: 'FASE_FINAL', desc: 'Final' }
  ]
};

// getFaseDesc (implementation a testear)
function getFaseDesc(codigo) {
  const f = (AppState.fases || []).find(f => f.nombre === codigo);
  return f?.desc || codigo;
}

function test_devuelve_desc_para_fase_conocida() {
  assert.strictEqual(getFaseDesc('FASE_16'), 'Knockouts');
  assert.strictEqual(getFaseDesc('FASE_LIGA'), 'Liga');
}

function test_devuelve_codigo_si_no_existe() {
  assert.strictEqual(getFaseDesc('FASE_INEXISTENTE'), 'FASE_INEXISTENTE');
}

function test_devuelve_codigo_si_fases_vacio() {
  AppState.fases = [];
  assert.strictEqual(getFaseDesc('FASE_FINAL'), 'FASE_FINAL');
}

const tests = [test_devuelve_desc_para_fase_conocida, test_devuelve_codigo_si_no_existe, test_devuelve_codigo_si_fases_vacio];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
