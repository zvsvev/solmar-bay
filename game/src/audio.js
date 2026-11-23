// Synthesized sound: every effect is an oscillator or filtered noise burst through
// the Web Audio API, so the game ships no audio files at all. Audio starts on the
// first user gesture (the browser requires it) and M toggles the mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // A lazy bass line in A minor, one step every 190 ms while driving or on foot.
  const BASS = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineOsc.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      sirenTimer = setInterval(() => {
        if (!ctx || muted) return;
        sirenOsc.frequency.value = sirenOsc.frequency.value > 700 ? 540 : 760;
      }, 420);
      musicTimer = setInterval(() => {
        if (!ctx || muted) return;
        const freq = BASS[musicStep % BASS.length];
        musicStep += 1;
        if (!freq) return;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(g);
        g.connect(musicGain);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }, 190);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* sound is best-effort */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1800;
      const g = ctx.createGain();
      g.gain.value = vol || 0.4;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch { /* sound is best-effort */ }
  }

  return {
    ensure,
    engine(speed01) {
      if (!ensure()) return;
      engineGain.gain.value = muted ? 0 : 0.05 + speed01 * 0.09;
      engineOsc.frequency.value = 55 + speed01 * 130;
    },
    siren(on) {
      if (!ensure()) return;
      sirenGain.gain.value = on && !muted ? 0.045 : 0;
    },
    gunshot() { noise(0.14, 0.5, 2400); },
    punch() { noise(0.09, 0.35, 700); },
    pickup() { blip(880, 0.09, 'sine', 0.3); setTimeout(() => blip(1320, 0.12, 'sine', 0.3), 70); },
    cash() { blip(1046, 0.08, 'square', 0.2); setTimeout(() => blip(1568, 0.16, 'square', 0.2), 80); },
    alarm() { blip(620, 0.25, 'sawtooth', 0.25); setTimeout(() => blip(620, 0.25, 'sawtooth', 0.25), 300); },
    crash() { noise(0.25, 0.5, 500); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
}
