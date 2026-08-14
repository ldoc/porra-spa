const assert = require('assert');
const { buildTimeline } = require('../js/stats.js');

function test_buildTimeline_13_posiciones_ordenadas() {
  const tl = buildTimeline();
  assert.strictEqual(tl.length, 13);
  assert.deepStrictEqual(tl.map(t => t.point), [0,1,2,3,4,5,6,7,8,9,10,11,12]);
  // Jornadas de liga
  assert.strictEqual(tl[0].label, 'J1');
  assert.strictEqual(tl[7].label, 'J8');
  assert.strictEqual(tl[0].kind, 'liga');
  // Fases de eliminatorias
  assert.deepStrictEqual(tl.slice(8).map(t => t.kind), ['fase','fase','fase','fase','fase']);
  assert.deepStrictEqual(tl.slice(8).map(t => t.label), ['16','8','4','Semis','Final']);
}

test_buildTimeline_13_posiciones_ordenadas();
console.log('OK buildTimeline');
