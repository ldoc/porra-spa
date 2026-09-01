const assert=require('assert');
const { calcClasificacionPronosticosStats } = require('../js/stats.js');
function test_freq_y_media(){
  const teamsMap={10:{name:'A'},20:{name:'B'},30:{name:'C'}};
  const matches=[
    {id:1, fase:'liga', ronda:1, homeTeamId:10, awayTeamId:20},
    {id:2, fase:'liga', ronda:1, homeTeamId:20, awayTeamId:30},
    {id:3, fase:'liga', ronda:1, homeTeamId:30, awayTeamId:10},
  ];
  const preds={
    u1:{1:{home:2,away:0},2:{home:1,away:1},3:{home:0,away:2}}, // A 6pts
    u2:{1:{home:0,away:2},2:{home:2,away:0},3:{home:2,away:0}}, // B?
  };
  const r=calcClasificacionPronosticosStats(preds, matches, teamsMap);
  assert.ok(r.freqPrimero.get(10) >=1);
  assert.ok(r.mediaPos.get(10) >0);
  assert.ok(Array.isArray(r.topMedia5));
}
function test_vacio(){
  const r=calcClasificacionPronosticosStats({}, [], {});
  assert.strictEqual(r.freqPrimero.size,0);
}
test_freq_y_media(); test_vacio(); console.log('OK clasificacion');
