const assert = require('assert');

function getRankBadgeClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-n';
}

function buildClasificacionHeader() {
  return `
    <div class="clasificacion-header">
      <span>Jugador</span><span>Pron</span><span>Plant</span><span>Clas</span><span>Elim</span><span>Total</span>
    </div>`;
}

function buildClasificacionRow(p, rank, isMe) {
  return `
    <div class="clasificacion-row ${isMe ? 'current-user' : ''}" onclick="showUserProfileModal('${p.name}')">
      <div class="clasificacion-id">
        <div class="rank-pill ${getRankBadgeClass(rank)}">${rank}</div>
        <span class="player-avatar">${p.avatar}</span>
        <span class="clasificacion-name">${p.name}${isMe ? ' <span class="clasificacion-you">(Tu)</span>' : ''}</span>
      </div>
      <span class="clasificacion-val">${p.predictionPoints}</span>
      <span class="clasificacion-val">${p.squadPoints}</span>
      <span class="clasificacion-val">${p.classificationPoints}</span>
      <span class="clasificacion-val">${p.eliminatoriasPoints}</span>
      <span class="clasificacion-val clasificacion-total">${p.realPoints}</span>
    </div>`;
}

function user(overrides = {}) {
  return Object.assign({
    name: 'juan.antonio_pvz', avatar: '⚽',
    predictionPoints: 145, squadPoints: 181,
    classificationPoints: 60, eliminatoriasPoints: 12, realPoints: 398
  }, overrides);
}

function test_rank_badge_class_podio() {
  assert.strictEqual(getRankBadgeClass(1), 'rank-1');
  assert.strictEqual(getRankBadgeClass(2), 'rank-2');
  assert.strictEqual(getRankBadgeClass(3), 'rank-3');
}

function test_rank_badge_class_resto() {
  assert.strictEqual(getRankBadgeClass(4), 'rank-n');
  assert.strictEqual(getRankBadgeClass(20), 'rank-n');
}

function test_cabecera_etiquetas() {
  const html = buildClasificacionHeader();
  assert.ok(html.includes('clasificacion-header'), 'clase contenedor');
  for (const lbl of ['Jugador', 'Pron', 'Plant', 'Clas', 'Elim', 'Total']) {
    assert.ok(html.includes(`>${lbl}</span>`), `etiqueta ${lbl}`);
  }
}

function test_fila_incluye_identidad_y_valores() {
  const html = buildClasificacionRow(user(), 1, false);
  assert.ok(html.includes('clasificacion-row'), 'clase fila');
  assert.ok(/<span class="clasificacion-name">juan\.antonio_pvz/.test(html), 'nombre');
  assert.ok(/<span class="player-avatar">⚽<\/span>/.test(html), 'avatar');
  assert.ok(html.includes('rank-pill rank-1'), 'badge rank 1');
  assert.ok(html.includes('clasificacion-total'), 'clase total');
  assert.ok(html.includes("showUserProfileModal('juan.antonio_pvz')"), 'handler de perfil');
  for (const val of ['145', '181', '60', '12', '398']) {
    assert.ok(html.includes(`>${val}</span>`), `valor ${val}`);
  }
  assert.ok(!html.includes('current-user'), 'sin resaltado propio');
  assert.ok(!html.includes('(Tu)'), 'sin marcador Tu');
}

function test_fila_usuario_actual() {
  const html = buildClasificacionRow(user(), 2, true);
  assert.ok(html.includes('current-user'), 'resaltado propio');
  assert.ok(html.includes('(Tu)'), 'marcador Tu');
  assert.ok(html.includes('rank-pill rank-2'), 'badge rank 2');
}

function test_fila_ceros_siempre_visibles() {
  const html = buildClasificacionRow(user({ predictionPoints: 0, squadPoints: 0,
    classificationPoints: 0, eliminatoriasPoints: 0, realPoints: 0 }), 4, false);
  assert.strictEqual((html.match(/>0<\/span>/g) || []).length, 5, 'cinco ceros presentes');
  assert.ok(html.includes('rank-pill rank-n'), 'badge gris para rank > 3');
}

const tests = [
  test_rank_badge_class_podio,
  test_rank_badge_class_resto,
  test_cabecera_etiquetas,
  test_fila_incluye_identidad_y_valores,
  test_fila_usuario_actual,
  test_fila_ceros_siempre_visibles
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
