const assert = require('assert');
const fasesJson = require('../data/fases.json');

function test_todas_las_fases_tienen_desc() {
  const fases = fasesJson.fases;
  assert.ok(Array.isArray(fases), 'fases debe ser un array');
  assert.strictEqual(fases.length, 13, 'debe haber 13 fases');
  for (const f of fases) {
    assert.ok(f.nombre, `fase ${f.id} debe tener nombre`);
    assert.ok(f.desc && f.desc.trim().length > 0, `fase ${f.nombre} debe tener desc no vacío`);
  }
}

function test_valores_desc_esperados() {
  const expected = {
    'FASE_PRETEMPORADA': 'Pretemporada',
    'FASE_LIGA': 'Liga',
    'FASE_PRE16': 'Previa Knockouts',
    'FASE_16': 'Knockouts',
    'FASE_PRE8': 'Previa Octavos',
    'FASE_8': 'Octavos de final',
    'FASE_PRE4': 'Previa Cuartos',
    'FASE_4': 'Cuartos de final',
    'FASE_PRESEMIS': 'Previa Semifinales',
    'FASE_SEMIS': 'Semifinales',
    'FASE_PREFINAL': 'Previa Final',
    'FASE_FINAL': 'Final',
    'FASE_POSTFINAL': 'Fin de porra'
  };
  for (const f of fasesJson.fases) {
    assert.strictEqual(f.desc, expected[f.nombre], `desc de ${f.nombre} debe ser "${expected[f.nombre]}"`);
  }
}

const tests = [test_todas_las_fases_tienen_desc, test_valores_desc_esperados];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
