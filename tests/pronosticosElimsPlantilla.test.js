const assert=require('assert');
const { calcEliminatoriasPronosticosStats, calcPlantillaPronosticosExtras, aggregateSquads } = require('../js/stats.js');
function test_elims(){
  const cache={a:{champion:10,runnerUp:20,semiFinalists:[30,40],quarterFinalists:[50,60,70,80],roundOf16:[1,2,3,4,5,6,7,8],roundOf32:[9,10,11,12,13,14,15,16]}, b:{champion:10,runnerUp:20,semiFinalists:[30,41],quarterFinalists:[50,60,70,81],roundOf16:[1,2,3,4,5,6,7,8],roundOf32:[9,10,11,12,13,14,15,16]}};
  const r=calcEliminatoriasPronosticosStats(cache);
  assert.strictEqual(r.championTally.teams[0].teamId,10);
  assert.ok(r.semisFreq.get(30)===2);
  assert.strictEqual(r.finalTally[0].pair,'10-20');
}
function test_plantilla(){
  const squads={a:[{id:1,posicion:'G',equipo:10},{id:2,posicion:'D',equipo:20}], b:[{id:1,posicion:'G',equipo:10}]};
  const pts={a:{playerDetails:[{jugador:{id:1},puntosTotal:10}]}, b:{playerDetails:[{jugador:{id:1},puntosTotal:5}]}};
  const agg=aggregateSquads(pts,squads);
  const r=calcPlantillaPronosticosExtras(agg, squads);
  assert.strictEqual(r.top3ByPos.G[0].player.id,1);
  assert.ok(r.equipoMas.equipo===10);
}
test_elims(); test_plantilla(); console.log('OK elimsPlantilla');
