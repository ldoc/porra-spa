// tests/pronosticosPartidos.test.js
const assert = require('assert');
const { calcPronosticosPartidosStats } = require('../js/stats.js');

function test_global_y_scoreVotes() {
  const league = [{id:1},{id:2},{id:3}];
  const preds = {
    a:{1:{home:2,away:1},2:{home:1,away:1},3:{home:0,away:1}},
    b:{1:{home:2,away:1},2:{home:0,away:0},3:{home:0,away:1}},
    c:{1:{home:1,away:0},2:{home:1,away:1}},
  };
  const r = calcPronosticosPartidosStats(preds, league);
  assert.strictEqual(r.globalCounts.H, 3); // 2-1,2-1,1-0
  assert.strictEqual(r.globalCounts.D, 3); // 1-1,0-0,1-1
  assert.strictEqual(r.globalCounts.A, 2);
  assert.strictEqual(r.mostRepeated.score, '2-1');
  assert.strictEqual(r.mostRepeated.votes, 2);
  assert.strictEqual(r.raro.score, '1-0'); // voto único <5%? en dataset pequeño 1/8=12% pero es único
  assert.ok(r.sesgo.H > 0);
  assert.strictEqual(r.conservador.username, 'b'); // b promedia menos goles (1.3 vs 1.5 vs 2.0)
  assert.strictEqual(r.arriesgado.username, 'a');
}

function test_vacio() {
  const r = calcPronosticosPartidosStats({}, []);
  assert.deepStrictEqual(r.globalCounts, {H:0,D:0,A:0});
  assert.strictEqual(r.mostRepeated, null);
  assert.strictEqual(r.raro, null);
}
test_global_y_scoreVotes();
test_vacio();
console.log('OK pronosticosPartidos');
