const test = require('node:test');
const assert = require('node:assert/strict');
const {
  liveV2ChipLabel,
  liveV2StatusBadge,
  fetchLiveEvents,
  init,
} = require('../js/live-v2-ui.js');

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

test('liveV2StatusBadge marca error y deja el título con la última actualización', () => {
  const badge = liveV2StatusBadge({ error: true, lastFetchAt: Date.now() - 42000 });
  assert.equal(badge.text, '⚠️ Sin conexión');
  assert.equal(badge.cls, 'error');
  assert.match(badge.title, /^Actualizado hace 4[12]s$/);
});

test('liveV2StatusBadge marca stale a partir de 91 s', () => {
  const badge = liveV2StatusBadge({ error: null, lastFetchAt: Date.now() - 95000 });
  assert.equal(badge.cls, 'stale');
  assert.match(badge.text, /^⏸ Datos de hace 9[45]s$/);
  assert.match(badge.title, /^Actualizado hace 9[45]s$/);
});

test('liveV2StatusBadge está en directo con datos recientes', () => {
  const badge = liveV2StatusBadge({ error: null, lastFetchAt: Date.now() - 30000 });
  assert.deepEqual(badge, { text: '● EN DIRECTO', cls: 'live', title: 'Actualizado hace 30s' });
});

test('liveV2StatusBadge sin lastFetchAt indica que no hay actualización', () => {
  const badge = liveV2StatusBadge({ error: null, lastFetchAt: null });
  assert.equal(badge.cls, 'live');
  assert.equal(badge.title, 'Sin actualizar');
});

test('fetchLiveEvents con payload.ok=false lanza y no pisa el estado previo', async () => {
  const AppState = {
    liveV2: {
      events: [{ id: 'previo' }],
      serverTime: '2026-10-19T10:00:00Z',
      lastFetchAt: 123,
      error: null,
      _fullAt: 456,
    },
  };
  init({
    AppState,
    API_BASE: 'https://api.test',
    fetchWithPhase: async () => ({ ok: true, json: async () => ({ ok: false, error: 'sin eventos' }) }),
    liveV2Api: { eventKey: e => e.id },
  });

  await assert.rejects(() => fetchLiveEvents(true), /sin eventos/);
  assert.deepEqual(AppState.liveV2.events, [{ id: 'previo' }]);
  assert.equal(AppState.liveV2.lastFetchAt, 123);
  assert.equal(AppState.liveV2._fullAt, 456);
  assert.equal(AppState.liveV2.error, true);
});
