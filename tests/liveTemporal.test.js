const assert = require('assert');
const { computeLiveTemporal } = require('../js/liveTab.js');

const LIVES = [
  { eventId: 16939028, estado: 'live', minuto: 67, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1, stats: { 2677: { goles: 3 }, 1164: { goles: 1 }, jugadores: [{ id: '9', equipo: 2677, minutos: 67, puntos: 8.4, goles: 2, asistencias: 1 }] } },
  { eventId: 7, estado: 'finalizado', minuto: 90, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, stats: { 1: { goles: 0 }, 2: { goles: 0 }, jugadores: [] } }
];
const PREDS = { javi: { 16939028: { home: 3, away: 1 }, 7: { home: 1, away: 0 } }, tu: { 16939028: { home: 2, away: 0 } } };
const SQUADS = { javi: [], tu: [{ id: 9, posicion: 'F', equipo: 2677 }] };
const scorePlayer = (pd) => ({ total: pd.goles * 5 });

function test_tabla_unica_ordenada_por_total() {
  const rows = computeLiveTemporal(LIVES, PREDS, SQUADS, scorePlayer);
  assert.deepEqual(rows.map(r => r.user), ['javi', 'tu']);
  assert.equal(rows[0].pron, 18);
  assert.equal(rows[1].plant, 10);
  assert.equal(rows[1].total, rows[1].pron + rows[1].plant);
}
test_tabla_unica_ordenada_por_total();
