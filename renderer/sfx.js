// Chiptune sound effects synthesized with Web Audio, so there are no audio files to ship.
// Each effect takes k (combo level 1-5); higher k plays a little higher.
const sfx = (() => {
  let ctx = null;
  const live = new Set(); // sources still playing, so an interrupt can cut them off
  let enabled = true;
  try { enabled = localStorage.getItem('clawd-sound') !== 'off'; } catch { /* storage unavailable */ }

  function audio() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function start(src, t, end) {
    live.add(src);
    src.onended = () => live.delete(src);
    src.start(t);
    src.stop(end);
  }

  // One oscillator sweeping from -> to Hz with a fast attack and decay.
  function tone(type, from, to, dur, vol, at = 0) {
    const c = audio();
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    start(o, t, t + dur + 0.02);
  }

  // A burst of low-passed white noise (impacts).
  function noise(dur, vol, cutoff, at = 0) {
    const c = audio();
    const t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    start(src, t, t + dur);
  }

  const up = (k) => 1 + (k - 1) * 0.12;
  const effect = (fn) => (k = 1) => {
    if (!enabled) return;
    try { fn(k); } catch (err) { console.warn('sfx', err); }
  };

  return {
    bonk: effect((k) => { tone('square', 620 * up(k), 140, 0.13, 0.12); noise(0.06, 0.25, 1800); }),
    boing: effect((k) => { tone('sine', 160 * up(k), 760 * up(k), 0.28, 0.22); tone('triangle', 320 * up(k), 1100 * up(k), 0.2, 0.06, 0.03); }),
    thud: effect(() => { noise(0.12, 0.35, 500); tone('sine', 120, 50, 0.12, 0.25); }),
    dizzy: effect((k) => {
      for (let i = 0; i < 6; i++) tone('triangle', (1200 - i * 110) * up(k), (900 - i * 110) * up(k), 0.09, 0.08, i * 0.11);
    }),
    recover: effect((k) => { tone('square', 300 * up(k), 600 * up(k), 0.07, 0.07); tone('square', 450 * up(k), 900 * up(k), 0.08, 0.07, 0.08); }),
    // costume actions (renderer/costumes.js); roll / sizzle / melody take a duration in seconds
    tick: effect(() => tone('square', 1800, 1200, 0.025, 0.035)),
    chime: effect(() => [880, 1109, 1319, 1760].forEach((f, i) => tone('triangle', f, f, 0.14, 0.07, i * 0.07))),
    melody: effect((dur) => {
      const seq = [523, 659, 784, 659, 698, 880, 1047, 880];
      for (let i = 0; i * 0.2 < dur; i++) tone('square', seq[i % seq.length], seq[i % seq.length], 0.17, 0.03, i * 0.2);
    }),
    roll: effect((dur) => noise(dur, 0.09, 350)),
    sizzle: effect((dur) => noise(dur, 0.04, 6000)),
    flip: effect(() => tone('sine', 300, 900, 0.12, 0.12)),
    clank: effect(() => { tone('square', 1400, 900, 0.08, 0.07); tone('triangle', 2600, 2200, 0.15, 0.05); noise(0.05, 0.2, 4000); }),
    whoosh: effect(() => { noise(0.2, 0.1, 900); tone('sine', 200, 420, 0.2, 0.04); }),
    yeehaw: effect(() => { tone('square', 500, 900, 0.18, 0.06); tone('square', 900, 600, 0.25, 0.06, 0.18); }),
    aha: effect(() => { tone('square', 600, 600, 0.08, 0.06); tone('square', 900, 900, 0.14, 0.06, 0.09); }),
    blip: effect(() => { tone('sine', 900, 1400, 0.06, 0.06); tone('sine', 1400, 900, 0.06, 0.06, 0.1); }),
    toot: effect(() => { tone('sawtooth', 440, 520, 0.22, 0.05); tone('sawtooth', 660, 700, 0.3, 0.05, 0.22); }),
    thunk: effect(() => { tone('sine', 300, 90, 0.12, 0.25); noise(0.05, 0.2, 1200); }),
    stopAll() {
      for (const src of live) { try { src.stop(); } catch { /* already stopped */ } }
      live.clear();
    },
    get enabled() { return enabled; },
    set enabled(on) {
      enabled = on;
      try { localStorage.setItem('clawd-sound', on ? 'on' : 'off'); } catch { /* storage unavailable */ }
      if (!on) this.stopAll();
    },
  };
})();
