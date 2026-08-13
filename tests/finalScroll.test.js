const assert = require('assert');
const { saveFinalScrollPositions, restoreFinalScrollPositions } = require('../js/eliminatorias.js');

const SELECTORS = ['.final-predictions-fixed', '.final-predictions-scroll', '#teams-pool-scroll'];

function makeEl() {
  const el = { style: { scrollBehavior: '' }, behaviorDuringSet: null };
  Object.defineProperty(el, 'scrollTop', {
    get() { return this._scrollTop || 0; },
    set(v) {
      this._scrollTop = v;
      this.behaviorDuringSet = this.style.scrollBehavior;
    }
  });
  return el;
}

function mockDoc() {
  const els = {};
  for (const sel of SELECTORS) els[sel] = makeEl();
  return { els, querySelector(sel) { return els[sel] || null; } };
}

function test_save_guarda_el_scroll_de_los_tres_contenedores() {
  const doc = mockDoc();
  doc.els['.final-predictions-scroll'].scrollTop = 320;
  doc.els['#teams-pool-scroll'].scrollTop = 180;
  assert.deepStrictEqual(saveFinalScrollPositions(doc), {
    '.final-predictions-fixed': 0,
    '.final-predictions-scroll': 320,
    '#teams-pool-scroll': 180
  });
}

function test_restore_fija_scrolltop_sin_animacion_smooth() {
  const doc = mockDoc();
  const positions = { '.final-predictions-scroll': 320, '#teams-pool-scroll': 180 };
  restoreFinalScrollPositions(positions, doc);
  assert.strictEqual(doc.els['.final-predictions-scroll'].scrollTop, 320);
  assert.strictEqual(doc.els['#teams-pool-scroll'].scrollTop, 180);
  assert.strictEqual(doc.els['.final-predictions-scroll'].behaviorDuringSet, 'auto');
  assert.strictEqual(doc.els['.final-predictions-scroll'].style.scrollBehavior, '');
}

function test_restore_ignora_contenedores_ausentes() {
  const doc = mockDoc();
  doc.querySelector = (sel) => (sel === '.final-predictions-scroll' ? doc.els['.final-predictions-scroll'] : null);
  restoreFinalScrollPositions({ '.final-predictions-scroll': 320, '#teams-pool-scroll': 180 }, doc);
  assert.strictEqual(doc.els['.final-predictions-scroll'].scrollTop, 320);
  assert.strictEqual(doc.els['#teams-pool-scroll'].scrollTop, 0);
}

function test_restore_ignora_posiciones_vacias() {
  const doc = mockDoc();
  restoreFinalScrollPositions({}, doc);
  for (const sel of SELECTORS) assert.strictEqual(doc.els[sel].scrollTop, 0);
}

const tests = [
  test_save_guarda_el_scroll_de_los_tres_contenedores,
  test_restore_fija_scrolltop_sin_animacion_smooth,
  test_restore_ignora_contenedores_ausentes,
  test_restore_ignora_posiciones_vacias
];
for (const t of tests) { t(); console.log('✓', t.name); }
console.log('OK', tests.length, 'tests');
