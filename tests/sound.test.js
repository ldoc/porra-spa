const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eventToTone, playLiveEvent, loadSoundEnabled, saveSoundEnabled } = require('../js/sound.js');

function memStore(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test('gol propio suena distinto que gol ajeno', () => {
  const mine = eventToTone({ type: 'goal' }, true);
  const other = eventToTone({ type: 'goal' }, false);
  assert.ok(mine.freqs.length > other.freqs.length);
  assert.equal(other.vibrateMs, 0);
  assert.ok(mine.vibrateMs > 0);
});

test('status y rank tienen tono, tipos raros no', () => {
  assert.ok(eventToTone({ type: 'status' }, false).freqs.length > 0);
  assert.ok(eventToTone({ type: 'rankUp' }, false).freqs.length > 0);
  assert.equal(eventToTone({ type: 'nada' }, false), null);
});

test('playLiveEvent respeta enabled=false y usa fakes', () => {
  const played = [];
  const fakeCtx = { play: f => played.push(f) };
  const vibrated = [];
  const fakeNav = { vibrate: ms => vibrated.push(ms) };
  playLiveEvent({ type: 'goal' }, true, { enabled: false, ctx: fakeCtx, navigatorRef: fakeNav });
  assert.equal(played.length, 0);
  playLiveEvent({ type: 'goal' }, true, { enabled: true, ctx: fakeCtx, navigatorRef: fakeNav });
  assert.equal(played.length, 1);
  assert.ok(vibrated.length > 0);
});

test('toggle persiste en storage', () => {
  const s = memStore({});
  assert.equal(loadSoundEnabled(s), true);
  saveSoundEnabled(s, false);
  assert.equal(loadSoundEnabled(s), false);
});
