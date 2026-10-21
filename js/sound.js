(function (global) {
  const KEY = 'porra_live_sound';

  function eventToTone(event, quality) {
    switch (event.type) {
      case 'goal':
        if (quality === 'bad') return { freqs: [392, 311], durationMs: 140, vibrateMs: 120 };
        if (quality === 'good' || quality === true) {
          return { freqs: [523, 659, 784], durationMs: 120, vibrateMs: 200 };
        }
        return { freqs: [440, 440], durationMs: 120, vibrateMs: 0 };
      case 'status':
      case 'start':
      case 'end':
        return { freqs: [660], durationMs: 100, vibrateMs: 0 };
      case 'rankUp':
        return { freqs: [392, 523], durationMs: 110, vibrateMs: 100 };
      case 'rankDown':
        return { freqs: [330, 262], durationMs: 110, vibrateMs: 0 };
      default:
        return null;
    }
  }

  function beep(ctx, freq, durationMs) {
    if (!ctx || typeof ctx.play !== 'function') return;
    ctx.play({ freq, durationMs });
  }

  function playLiveEvent(event, quality, deps) {
    const { enabled, ctx, navigatorRef } = deps || {};
    if (!enabled) return;
    const tone = eventToTone(event, quality);
    if (!tone) return;
    tone.freqs.forEach((f, i) => {
      if (i === 0) beep(ctx, f, tone.durationMs);
      else setTimeout(() => beep(ctx, f, tone.durationMs), i * tone.durationMs);
    });
    if (tone.vibrateMs > 0 && navigatorRef && typeof navigatorRef.vibrate === 'function') {
      navigatorRef.vibrate(tone.vibrateMs);
    }
  }

  function loadSoundEnabled(storage) {
    try {
      const raw = storage.getItem(KEY);
      return raw === null ? true : raw === '1';
    } catch (e) {
      return true;
    }
  }

  function saveSoundEnabled(storage, v) {
    try { storage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* sin storage */ }
  }

  // Adaptador real Web Audio (solo se construye en navegador tras primer tap)
  function realAudioContext() {
    if (typeof AudioContext === 'undefined') return null;
    const ac = new AudioContext();
    return {
      play({ freq, durationMs }) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        gain.gain.setValueAtTime(0.2, ac.currentTime);
        osc.stop(ac.currentTime + durationMs / 1000);
      }
    };
  }

  function playFile(src, deps) {
    if (!deps || !deps.enabled || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(src);
      audio.volume = 0.7;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* sin audio o autoplay bloqueado */ }
  }

  function playBeep(deps) {
    if (!deps || !deps.enabled || !deps.ctx || typeof deps.ctx.play !== 'function') return;
    deps.ctx.play({ freq: 660, durationMs: 90 });
  }

  function playWhistle(deps, times) {
    if (!deps || !deps.enabled) return;
    const n = Math.max(1, Number(times) || 1);
    for (let i = 0; i < n; i++) {
      setTimeout(() => playFile('sounds/silbato.mp3', deps), i * 1000);
    }
  }

  const soundApi = {
    eventToTone, playLiveEvent, playFile, playBeep, playWhistle,
    loadSoundEnabled, saveSoundEnabled, realAudioContext, KEY,
  };
  global.soundApi = soundApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = soundApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
