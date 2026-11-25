const test = require('node:test');
const assert = require('node:assert/strict');

function freshUi() {
  const file = require.resolve('../js/live-v2-ui.js');
  delete require.cache[file];
  return require('../js/live-v2-ui.js');
}

test('liveV2CurrentRoundKey: gana la ronda con mas partidos en juego', () => {
  const ui = freshUi();
  const matches = [
    { id: 101, fase: 'liga', ronda: 3, fechaTs: 100 },
    { id: 102, fase: 'liga', ronda: 3, fechaTs: 100 },
    { id: 103, fase: 'liga', ronda: 2, fechaTs: 50 },
  ];
  const states = {
    101: { status: 'LIVE' }, 102: { status: 'HT' }, 103: { status: 'LIVE' },
  };
  assert.deepEqual(ui.liveV2CurrentRoundKey(matches, [], states), { fase: 'liga', ronda: 3 });
});

test('liveV2CurrentRoundKey: sin estados cae al ultimo matchStats por fecha', () => {
  const ui = freshUi();
  const matches = [
    { id: 101, fase: 'liga', ronda: 2, fechaTs: 100 },
    { id: 102, fase: 'liga', ronda: 3, fechaTs: 200 },
  ];
  const matchStats = [{ eventId: 101 }, { eventId: 102 }];
  assert.deepEqual(ui.liveV2CurrentRoundKey(matches, matchStats, {}), { fase: 'liga', ronda: 3 });
});

test('liveV2CurrentRoundKey: sin estados ni matchStats cae a partidos de hoy', () => {
  const ui = freshUi();
  const hoy = Math.floor(Date.now() / 1000);
  const ayer = hoy - 86400;
  const matches = [
    { id: 101, fase: 'liga', ronda: 1, fechaTs: ayer },
    { id: 102, fase: 'liga', ronda: 4, fechaTs: hoy },
  ];
  assert.deepEqual(ui.liveV2CurrentRoundKey(matches, [], {}), { fase: 'liga', ronda: 4 });
});

test('liveV2CurrentRoundKey: sin nada devuelve null', () => {
  const ui = freshUi();
  assert.equal(ui.liveV2CurrentRoundKey([], [], {}), null);
  assert.equal(ui.liveV2CurrentRoundKey([], [], null), null);
  assert.equal(ui.liveV2CurrentRoundKey(null, null, null), null);
});

function jornadaFixture() {
  const ui = freshUi();
  const AppState = {
    currentUser: { name: 'me' },
    live: {},
    liveV2: null,
    matches: [
      { id: 101, fase: 'liga', ronda: 3, fechaTs: 100, homeTeamId: 1, awayTeamId: 2 },
      { id: 104, fase: 'liga', ronda: 2, fechaTs: 50, homeTeamId: 7, awayTeamId: 8 },
    ],
    matchStats: [
      { eventId: 101, stats: { 1: { goles: 2 }, 2: { goles: 0 } } },
      { eventId: 104, stats: { 7: { goles: 1 }, 8: { goles: 1 } } },
    ],
    allPredictions: {
      me: { 101: { home: 2, away: 0 }, 104: { home: 1, away: 1 } },
      ana: { 101: { home: 1, away: 1 } },
    },
    squadsCache: {},
    _allPredictionsTime: 1,
  };
  ui.init({
    AppState,
    liveV2Api: { escapeHtml: s => String(s) },
    calculateMatchPoints: (pred) => ({ points: pred && pred.home != null ? pred.home * 2 : 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  return { ui, AppState };
}

test('liveV2JornadaOfficial solo suma matchStats de la ronda pedida', () => {
  const { ui } = jornadaFixture();
  const round = { fase: 'liga', ronda: 3 };
  const out = ui.liveV2JornadaOfficial(round, ['me', 'ana']);
  // me: 101 (ronda 3) pred.home=2 -> mock 4 puntos; 104 (ronda 2) NO cuenta
  assert.deepEqual(out.me, { pred: 4, squad: 0, total: 4 });
  assert.deepEqual(out.ana, { pred: 2, squad: 0, total: 2 });
});

test('liveV2JornadaOfficial con roundKey null devuelve ceros', () => {
  const { ui } = jornadaFixture();
  assert.deepEqual(ui.liveV2JornadaOfficial(null, ['me']).me, { pred: 0, squad: 0, total: 0 });
});

test('liveV2JornadaOfficial cachea y se invalida al cambiar matchStats', () => {
  const { ui, AppState } = jornadaFixture();
  const round = { fase: 'liga', ronda: 3 };
  const first = ui.liveV2JornadaOfficial(round, ['me']);
  const second = ui.liveV2JornadaOfficial(round, ['me']);
  assert.equal(first, second, 'misma referencia mientras no cambien los datos');
  AppState.matchStats = [{ eventId: 101, stats: { 1: { goles: 1 }, 2: { goles: 0 } } }];
  const third = ui.liveV2JornadaOfficial(round, ['me']);
  assert.notEqual(first, third, 'se recalcula al cambiar la ref de matchStats');
  assert.equal(third.me.total, 4, 'pred.home sigue siendo 2 -> 4 puntos');
});
