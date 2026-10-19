const test = require('node:test');
const assert = require('node:assert/strict');
const { liveV2ChipLabel } = require('../js/live-v2-ui.js');

test('liveV2ChipLabel sin estado devuelve NS', () => {
  assert.equal(liveV2ChipLabel(null), 'NS');
  assert.equal(liveV2ChipLabel(undefined), 'NS');
});

test('liveV2ChipLabel devuelve NS, HT y FT', () => {
  assert.equal(liveV2ChipLabel({ status: 'NS' }), 'NS');
  assert.equal(liveV2ChipLabel({ status: 'HT' }), 'HT');
  assert.equal(liveV2ChipLabel({ status: 'FT' }), 'FT');
});

test('liveV2ChipLabel en LIVE usa el minuto y cae a · sin minuto', () => {
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: 63 }), "LIVE 63'");
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: 0 }), "LIVE 0'");
  assert.equal(liveV2ChipLabel({ status: 'LIVE', lastMinute: null }), "LIVE ·'");
});
