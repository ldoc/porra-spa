const assert = require('assert');

function getFasePillInfo(fase) {
  const map = {
    liga:  { label: 'Liga',        icono: '⚽',  color: '#FF9800' },
    '16':  { label: 'Dieciseisavos', icono: '⚔️', color: '#2196F3' },
    '8':   { label: 'Octavos',     icono: '⚔️',  color: '#F44336' },
    '4':   { label: 'Cuartos',     icono: '⚔️',  color: '#F44336' },
    semis: { label: 'Semifinal',   icono: '⚔️',  color: '#F44336' },
    final: { label: 'Final',       icono: '🏆',  color: '#F44336' }
  };
  return map[fase] || { label: fase, icono: '⚽', color: '#FF9800' };
}

function buildRoundFasePill(fase, round, totalRounds, predicted, total) {
  const info = getFasePillInfo(fase);
  if (totalRounds <= 1) return `${info.icono} ${info.label}`;
  return `${info.icono} ${info.label} · Jornada <span class="round-fase-jornada">${round}</span>/${totalRounds} <span class="round-fase-progress">${predicted}/${total}</span>`;
}

function test_pill_info_todas_las_fases() {
  const expected = {
    liga:  { label: 'Liga',        icono: '⚽',  color: '#FF9800' },
    '16':  { label: 'Dieciseisavos', icono: '⚔️', color: '#2196F3' },
    '8':   { label: 'Octavos',     icono: '⚔️',  color: '#F44336' },
    '4':   { label: 'Cuartos',     icono: '⚔️',  color: '#F44336' },
    semis: { label: 'Semifinal',   icono: '⚔️',  color: '#F44336' },
    final: { label: 'Final',       icono: '🏆',  color: '#F44336' }
  };
  for (const fase of Object.keys(expected)) {
    assert.deepStrictEqual(getFasePillInfo(fase), expected[fase], `info de fase ${fase}`);
  }
}

function test_pill_info_fallback() {
  assert.deepStrictEqual(getFasePillInfo('desconocida'), { label: 'desconocida', icono: '⚽', color: '#FF9800' });
}

function test_pill_liga_incluye_jornada_y_progreso() {
  const html = buildRoundFasePill('liga', 1, 8, 3, 18);
  assert.ok(html.includes('Liga'), 'debe incluir label Liga');
  assert.ok(html.includes('Jornada'), 'debe incluir palabra Jornada');
  assert.ok(html.includes('>1</span>/8'), 'jornada activa 1 de 8');
  assert.ok(html.includes('round-fase-jornada'), 'clase de jornada activa');
  assert.ok(html.includes('round-fase-progress'), 'clase de contador de progreso');
  assert.ok(html.includes('>3/18</span>'), 'contador 3/18');
}

function test_pill_eliminatorias_solo_fase() {
  const html = buildRoundFasePill('8', 1, 1, 0, 0);
  assert.strictEqual(html, '⚔️ Octavos');
  assert.ok(!html.includes('Jornada'), 'sin palabra Jornada');
  assert.ok(!html.includes('round-fase-progress'), 'sin contador de progreso');
  assert.ok(!html.includes('/1'), 'sin sufijo de jornada');
}

function test_pill_final_icono() {
  assert.ok(buildRoundFasePill('final', 1, 1, 1, 1).includes('🏆 Final'));
}

const tests = [
  test_pill_info_todas_las_fases,
  test_pill_info_fallback,
  test_pill_liga_incluye_jornada_y_progreso,
  test_pill_eliminatorias_solo_fase,
  test_pill_final_icono
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
