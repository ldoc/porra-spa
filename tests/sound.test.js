const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eventToTone, playLiveEvent, playFile, playBeep, playWhistle, loadSoundEnabled, saveSoundEnabled } = require('../js/sound.js');

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

test('playLiveEvent respeta enabled=false, reproduce malo/bueno y usa fakes', () => {
  const played = [];
  const fakeCtx = { play: f => played.push(f) };
  const vibrated = [];
  const fakeNav = { vibrate: ms => vibrated.push(ms) };
  playLiveEvent({ type: 'goal' }, true, { enabled: false, ctx: fakeCtx, navigatorRef: fakeNav });
  assert.equal(played.length, 0);
  playLiveEvent({ type: 'goal' }, 'bad', { enabled: true, ctx: fakeCtx, navigatorRef: fakeNav });
  assert.equal(played.length, 1);
  assert.equal(played[0].freq, 392);
  assert.equal(vibrated[0], 120);
  playLiveEvent({ type: 'goal' }, 'good', { enabled: true, ctx: fakeCtx, navigatorRef: fakeNav });
  assert.equal(played.length, 2);
  assert.equal(played[1].freq, 523);
  assert.equal(vibrated[1], 200);
});

test('toggle persiste en storage', () => {
  const s = memStore({});
  assert.equal(loadSoundEnabled(s), true);
  saveSoundEnabled(s, false);
  assert.equal(loadSoundEnabled(s), false);
});

test('playFile respeta enabled y crea un Audio', () => {
  const prev = global.Audio;
  const played = [];
  global.Audio = function (src) {
    this.play = () => { played.push(src); return Promise.resolve(); };
  };
  try {
    playFile('sounds/gol_otro.mp3', { enabled: true });
    playFile('sounds/gol_otro.mp3', { enabled: false });
    assert.deepEqual(played, ['sounds/gol_otro.mp3']);
  } finally {
    if (prev === undefined) delete global.Audio; else global.Audio = prev;
  }
});

test('playWhistle reproduce el archivo 1 o 3 veces', async () => {
  const prev = global.Audio;
  const played = [];
  global.Audio = function (src) {
    this.play = () => { played.push(src); return Promise.resolve(); };
  };
  try {
    playWhistle({ enabled: true }, 1);
    playWhistle({ enabled: true }, 3);
    await new Promise(r => setTimeout(r, 900));
    assert.equal(played.filter(x => x === 'sounds/silbato.mp3').length, 4);
  } finally {
    if (prev === undefined) delete global.Audio; else global.Audio = prev;
  }
});

test('playBeep usa el AudioContext y respeta enabled', () => {
  const played = [];
  playBeep({ enabled: true, ctx: { play: p => played.push(p) } });
  playBeep({ enabled: false, ctx: { play: p => played.push(p) } });
  assert.deepEqual(played, [{ freq: 660, durationMs: 90 }]);
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

