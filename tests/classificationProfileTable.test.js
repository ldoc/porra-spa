const assert = require('assert');

function sortTeamsByPredicted(teamDetails) {
  return [...teamDetails].sort((a, b) => a.predictedPos - b.predictedPos);
}

function buildClassificationRowHtml(team) {
  const muted = team.realPos > 24 ? ' muted' : '';
  const ptsClass = team.points > 0 ? ' positive' : '';
  return `
    <div class="classification-row${muted}">
      <span class="col-pos">${team.predictedPos}</span>
      <span class="col-team">
        <img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="classification-badge" alt="${team.name}" loading="lazy" onerror="this.style.display='none'">
        <span class="col-team-name">${team.name}</span>
      </span>
      <span class="col-real">${team.realPos}</span>
      <span class="col-pts${ptsClass}">${team.points}</span>
    </div>
  `;
}

function team(overrides = {}) {
  return Object.assign({
    teamId: 2817, name: 'FC Barcelona', badgeExt: 'png',
    predictedPos: 2, realPos: 1, points: 51
  }, overrides);
}

function test_sort_por_predicted_ascendente() {
  const result = sortTeamsByPredicted([
    team({ predictedPos: 20, name: 'B' }),
    team({ predictedPos: 3, name: 'A' }),
    team({ predictedPos: 36, name: 'Sin pronóstico' }),
    team({ predictedPos: 9, name: 'C' })
  ]);
  assert.deepStrictEqual(result.map(t => t.name), ['A', 'C', 'B', 'Sin pronóstico'], 'orden por predictedPos');
  assert.deepStrictEqual(result.map(t => t.predictedPos), [3, 9, 20, 36], 'posiciones');
}

function test_fila_incluye_cuatro_columnas() {
  const html = buildClassificationRowHtml(team());
  assert.ok(html.includes('classification-row'), 'clase fila');
  assert.ok(html.includes('col-team-name'), 'clase nombre');
  assert.ok(html.includes('FC Barcelona'), 'nombre');
  assert.ok(html.includes('>2</span>'), 'primera columna = predictedPos');
  assert.ok(html.includes('>1</span>'), 'columna Real = realPos');
  assert.ok(html.includes('>51</span>'), 'columna Pts');
  assert.ok(html.includes('col-pts positive'), 'puntos positivos resaltados');
  assert.ok(!html.includes(' muted'), 'sin muted si realPos <= 24');
  assert.ok(html.includes('classification-badge'), 'escudo');
}

function test_fila_muted_cuando_no_puntua() {
  const html = buildClassificationRowHtml(team({ realPos: 30, points: 0 }));
  assert.ok(html.includes('classification-row muted'), 'clase muted');
  assert.ok(html.includes('>0</span>'), '0 puntos');
  assert.ok(!html.includes('col-pts positive'), 'sin resaltado si 0 puntos');
}

const tests = [
  test_sort_por_predicted_ascendente,
  test_fila_incluye_cuatro_columnas,
  test_fila_muted_cuando_no_puntua
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
