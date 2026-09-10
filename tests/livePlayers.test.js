const assert = require('assert');
const { computeLivePlayerRanking, buildPlayerRankingHtml } = require('../js/liveTab.js');

const LIVES = [{ eventId: 16939028, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1,
  stats: { jugadores: [
    { id: '9', nombre: 'Kane', equipo: 2677, minutos: 67, puntos: 8.4, goles: 2, asistencias: 1 },
    { id: '10', nombre: 'Undav', equipo: 2677, minutos: 0, puntos: 0, goles: 0, asistencias: 0 },
    { id: '11', nombre: 'Nadie', equipo: 1164, minutos: 20, puntos: 6.1, goles: 0, asistencias: 0 }
  ] } }];
const SQUADS = { tu: [{ id: 9, posicion: 'F', equipo: 2677 }], javi: [{ id: 9, posicion: 'F', equipo: 2677 }], maria: [{ id: 9, posicion: 'F', equipo: 2677 }], pedro: [{ id: 9, posicion: 'F', equipo: 2677 }], luis: [{ id: 9, posicion: 'F', equipo: 2677 }], ana: [{ id: 9, posicion: 'F', equipo: 2677 }] };
const scorePlayer = () => ({ total: 14 });

function test_ranking_filtra_ordena_y_duenos() {
  const rows = computeLivePlayerRanking(LIVES, SQUADS, scorePlayer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].nombre, 'Kane');
  assert.equal(rows[0].rating, 8.4);
  const html = buildPlayerRankingHtml(rows, { currentUser: 'tu', playerExts: {} });
  assert.match(html, /tú/);
  assert.match(html, /\(\+2\)/);
  assert.match(html, /8\.4/);
}
test_ranking_filtra_ordena_y_duenos();

function test_sin_rating_muestra_guion() {
  const lives = [{ eventId: 1, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, stats: { jugadores: [{ id: '5', nombre: 'X', equipo: 1, minutos: 30, goles: 0, asistencias: 0 }] } }];
  const rows = computeLivePlayerRanking(lives, { tu: [{ id: 5, posicion: 'M', equipo: 1 }] }, () => ({ total: 1 }));
  const html = buildPlayerRankingHtml(rows, { currentUser: 'tu', playerExts: {} });
  assert.match(html, /–/);
}
test_sin_rating_muestra_guion();

function test_matchLabel_usa_nombres_cortos() {
  const rows = computeLivePlayerRanking(LIVES, SQUADS, scorePlayer, { 2677: 'VfB Stuttgart', 1164: 'Viking FK' });
  assert.equal(rows[0].matchLabel, 'VFB-VIK');
}
test_matchLabel_usa_nombres_cortos();

function test_matchLabel_fallback_a_ids_sin_nombres() {
  const rows = computeLivePlayerRanking(LIVES, SQUADS, scorePlayer);
  assert.equal(rows[0].matchLabel, '267-116');
}
test_matchLabel_fallback_a_ids_sin_nombres();
