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
