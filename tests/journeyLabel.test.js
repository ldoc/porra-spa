const assert = require('assert');

// Copia de la lógica a probar: buildMatchFromCalendar usa journey = `Jornada ${ronda}`
// lo que colisiona entre liga (ronda 1..8) y fase 16 (ronda 1).
// La función propuesta debe devolver etiquetas por fase.

function getJourneyLabel(match) {
  if (match.fase === 'liga') return `Liga - Jornada ${match.ronda}`;
  const labels = {
    '16': 'Dieciseisavos',
    '8': 'Octavos',
    '4': 'Cuartos',
    'semis': 'Semifinal',
    'final': 'Final'
  };
  return labels[match.fase] || match.fase;
}

function test_liga_etiqueta_con_ronda() {
  assert.strictEqual(getJourneyLabel({ fase: 'liga', ronda: 1 }), 'Liga - Jornada 1');
  assert.strictEqual(getJourneyLabel({ fase: 'liga', ronda: 8 }), 'Liga - Jornada 8');
}

function test_dieciseisavos_no_colisiona_con_liga_j1() {
  const ligaJ1 = getJourneyLabel({ fase: 'liga', ronda: 1 });
  const r16 = getJourneyLabel({ fase: '16', ronda: 1 });
  assert.notStrictEqual(ligaJ1, r16, '16avos debe tener etiqueta distinta a Liga - Jornada 1');
  assert.strictEqual(r16, 'Dieciseisavos');
}

function test_otras_fases() {
  assert.strictEqual(getJourneyLabel({ fase: '8', ronda: 1 }), 'Octavos');
  assert.strictEqual(getJourneyLabel({ fase: '4', ronda: 1 }), 'Cuartos');
  assert.strictEqual(getJourneyLabel({ fase: 'semis', ronda: 1 }), 'Semifinal');
  assert.strictEqual(getJourneyLabel({ fase: 'final', ronda: 1 }), 'Final');
}

const tests = [test_liga_etiqueta_con_ronda, test_dieciseisavos_no_colisiona_con_liga_j1, test_otras_fases];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
