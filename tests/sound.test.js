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

test('eventToTone goal good/bad/neutral', () => {
  assert.deepEqual(eventToTone({ type: 'goal' }, 'good'),
    { freqs: [523, 659, 784], durationMs: 120, vibrateMs: 200 });
  assert.deepEqual(eventToTone({ type: 'goal' }, 'bad'),
    { freqs: [392, 311], durationMs: 140, vibrateMs: 120 });
  assert.deepEqual(eventToTone({ type: 'goal' }, 'neutral'),
    { freqs: [440, 440], durationMs: 120, vibrateMs: 0 });
  assert.deepEqual(eventToTone({ type: 'goal' }, true),
    eventToTone({ type: 'goal' }, 'good'));
  assert.deepEqual(eventToTone({ type: 'goal' }, false),
    eventToTone({ type: 'goal' }, 'neutral'));
});

test('rank y status conservan los tonos v1', () => {
  assert.deepEqual(eventToTone({ type: 'rankUp' }, true),
    { freqs: [392, 523], durationMs: 110, vibrateMs: 100 });
  assert.deepEqual(eventToTone({ type: 'rankDown' }, false),
    { freqs: [330, 262], durationMs: 110, vibrateMs: 0 });
  assert.deepEqual(eventToTone({ type: 'status' }, true),
    { freqs: [660], durationMs: 100, vibrateMs: 0 });
});

test('playLiveEvent desactivado no reproduce', () => {
  let plays = 0;
  playLiveEvent({ type: 'goal' }, 'good', { enabled: false, ctx: { play: () => plays++ } });
  assert.equal(plays, 0);
});
