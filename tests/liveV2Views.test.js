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

function viewsFixture() {
  const ui = freshUi();
  const AppState = {
    currentUser: { name: 'me' },
    live: {},
    liveV2: null,
    matches: [
      { id: 101, fase: 'liga', ronda: 3, fechaTs: 100, homeTeamId: 1, awayTeamId: 2 },
      { id: 102, fase: 'liga', ronda: 3, fechaTs: 100, homeTeamId: 3, awayTeamId: 4 },
      { id: 103, fase: 'liga', ronda: 3, fechaTs: 200, homeTeamId: 5, awayTeamId: 6 },
      { id: 104, fase: 'liga', ronda: 2, fechaTs: 50, homeTeamId: 7, awayTeamId: 8 },
    ],
    // 101 consolidado (ronda 3); 104 consolidado (ronda 2) -> cuenta en total, NO en jornada
    matchStats: [
      { eventId: 101, stats: { 1: { goles: 2 }, 2: { goles: 0 } } },
      { eventId: 104, stats: { 7: { goles: 1 }, 8: { goles: 1 } } },
    ],
    allPredictions: {
      me: { 101: { home: 2, away: 0 }, 102: { home: 0, away: 0 }, 103: { home: 1, away: 0 }, 104: { home: 1, away: 1 } },
      ana: { 101: { home: 1, away: 1 }, 102: { home: 0, away: 0 }, 103: { home: 0, away: 0 }, 104: { home: 0, away: 0 } },
    },
    squadsCache: {},
    _allPredictionsTime: 1,
  };
  ui.init({
    AppState,
    liveV2Api: require('../js/liveV2.js'),
    liveV2Abbr: s => String(s).slice(0, 3),
    visiblePlayers: () => [
      { name: 'me', avatar: '😎' },
      { name: 'ana', avatar: '🦊' },
    ],
    getUserTotalRealPoints: (name) => (name === 'me' ? 100 : 50),
    calculateMatchPoints: (pred) => ({ points: pred && pred.home != null ? pred.home * 2 : 0, breakdown: [] }),
    calculatePlayerMatchPoints: () => ({ total: 0, desglose: [] }),
  });
  AppState.liveV2 = ui.liveV2State(); // estado real: los tests mutan viewMode sobre él
  // Estados live: 102 FT sin consolidar (ronda 3) y 103 LIVE (ronda 3)
  const folded = {
    states: {
      102: { status: 'FT', score: { home: 0, away: 0 } },
      103: { status: 'LIVE', score: { home: 1, away: 0 } },
    },
    statsById: {
      102: { 3: { goles: 0 }, 4: { goles: 0 } },
      103: { 5: { goles: 1 }, 6: { goles: 0 } },
    },
  };
  return { ui, AppState, folded };
}

test('liveV2ViewMode devuelve total por defecto y valida el valor', () => {
  const { ui, AppState } = viewsFixture();
  assert.equal(ui.liveV2ViewMode(), 'total');
  AppState.liveV2.viewMode = 'jornada';
  assert.equal(ui.liveV2ViewMode(), 'jornada');
  AppState.liveV2.viewMode = 'bogus';
  assert.equal(ui.liveV2ViewMode(), 'total');
});

test('liveV2Rows vista total: consolidados + delta (comportamiento actual)', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'total';
  const rows = ui.liveV2Rows(folded);
  const me = rows.find(r => r.name === 'me');
  // oficial 100 + delta (102: pred.home 0 -> 0; 103: pred.home 1 -> 2) = 102
  assert.equal(me.livePoints, 102);
  assert.equal(me.officialPoints, 100);
  assert.equal(me.pointsDelta, 2);
  assert.equal(rows[0].name, 'me');
});

test('liveV2Rows vista jornada: consolidados de la ronda + delta de la ronda', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'jornada';
  const rows = ui.liveV2Rows(folded);
  const me = rows.find(r => r.name === 'me');
  // jornadaOfficial: 101 (ronda 3) pred.home 2 -> 4; 104 (ronda 2) excluido
  // deltaRonda: 102 (FT sin consolidar, ronda 3) 0 + 103 (LIVE, ronda 3) 2
  assert.equal(me.jornadaOfficial, 4);
  assert.equal(me.deltaRonda, 2);
  assert.equal(me.livePoints, 6);
  const ana = rows.find(r => r.name === 'ana');
  // ana: 101 pred.home 1 -> 2; 102 0; 103 0 => jornada 2
  assert.equal(ana.livePoints, 2);
  assert.equal(rows[0].name, 'me');
});

test('liveV2Rows vista enjuego: solo partidos LIVE/HT', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'enjuego';
  const rows = ui.liveV2Rows(folded);
  const me = rows.find(r => r.name === 'me');
  // solo 103 (LIVE): 2 puntos; 102 es FT sin consolidar y NO cuenta
  assert.equal(me.livePoints, 2);
  assert.equal(me.deltaInPlay, 2);
});

test('liveV2HeaderBreakdown por vista: total, jornada y en juego', () => {
  const { ui, AppState, folded } = viewsFixture();
  AppState.liveV2.viewMode = 'total';
  // total (default): delta de partidos no consolidados (102 FT + 103 LIVE)
  const bt = ui.liveV2HeaderBreakdown(folded);
  assert.deepEqual(bt, { total: 2, predictionPts: 2, squadPts: 0 });

  // jornada: consolidados de la ronda 3 (101 -> 4) + delta de la ronda (102 + 103)
  const bj = ui.liveV2HeaderBreakdown(folded, 'jornada');
  assert.deepEqual(bj, { total: 6, predictionPts: 6, squadPts: 0 });

  // en juego: solo 103 (LIVE); 102 es FT sin consolidar y queda fuera
  const be = ui.liveV2HeaderBreakdown(folded, 'enjuego');
  assert.deepEqual(be, { total: 2, predictionPts: 2, squadPts: 0 });
});

test('liveV2SectionTitle mapea cada vista', () => {
  const { ui, AppState } = viewsFixture();
  assert.equal(ui.liveV2SectionTitle('total'), 'Clasificación en vivo');
  assert.equal(ui.liveV2SectionTitle('jornada'), 'Jornada en vivo');
  assert.equal(ui.liveV2SectionTitle('enjuego'), 'Partidos en vivo');
  assert.equal(ui.liveV2SectionTitle(), 'Clasificación en vivo');
  AppState.liveV2.viewMode = 'jornada';
  assert.equal(ui.liveV2SectionTitle(), 'Jornada en vivo');
});

test('liveV2ViewSegHtml marca la vista activa y deshabilita segun datos', () => {
  const { ui, AppState, folded } = viewsFixture();
  // hay un partido LIVE y hay matchStats -> nada deshabilitado
  let html = ui.liveV2ViewSegHtml(folded);
  assert.match(html, /data-livev2-view="total"/);
  assert.match(html, /data-livev2-view="jornada"/);
  assert.match(html, /data-livev2-view="enjuego"/);
  assert.match(html, /class="livev2-viewseg-btn on"/);
  assert.doesNotMatch(html, /disabled/);

  // sin eventos ni partidos en juego: 'enjuego' deshabilitado
  AppState.liveV2.events = [];
  html = ui.liveV2ViewSegHtml({ states: {}, statsById: {} });
  assert.match(html, /data-livev2-view="enjuego"[^>]*disabled/);

  // sin ronda determinable: 'jornada' deshabilitado
  AppState.matches = [];
  AppState.matchStats = [];
  html = ui.liveV2ViewSegHtml({ states: {}, statsById: {} });
  assert.match(html, /data-livev2-view="jornada"[^>]*disabled/);
});

test('renderLiveV2Html incluye seg dentro del breakdown y titulo por vista', () => {
  const { ui, AppState, folded } = viewsFixture();
  const rows = ui.liveV2Rows(folded);
  AppState.liveV2.viewMode = 'total';
  let html = ui.renderLiveV2Html(rows, folded);
  assert.match(html, /<div class="livev2-breakdown" id="livev2-breakdown">/);
  assert.match(html, /livev2-viewseg/);
  assert.match(html, /id="livev2-section-title">Clasificación en vivo</);

  AppState.liveV2.viewMode = 'jornada';
  rows.splice(0, rows.length, ...ui.liveV2Rows(folded));
  html = ui.renderLiveV2Html(rows, folded);
  assert.match(html, /id="livev2-section-title">Jornada en vivo</);
});
