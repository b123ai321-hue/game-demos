// ============================================================
// GRAVELIGHT SOUNDS - original, made in code with Web Audio.
// No sound files at all, so nothing to download.
// Usage: SFX.play(audioContext, 'swing')
// Names: swing burn hit flare ward bell dawn blip
//        step chest coin pickup gulp stairs ring roar
// Volume: SFX.setVolume(0..1), SFX.toggle(), SFX.enabled, SFX.volume
//         (saved in localStorage as gravelight.sfxVol / gravelight.sfxOn)
// ============================================================
const SFX = (() => {
  // ---- saved settings (try/catch because some browsers block storage) ----
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const api = {
    enabled: load('gravelight.sfxOn', 'on') !== 'off',
    volume: Math.max(0, Math.min(1, +load('gravelight.sfxVol', 0.9) || 0)),
  };

  // ---- one master volume knob per AudioContext; every sound goes through it ----
  const masters = [];                          // [{ ac, g }]
  function out(ac) {
    let m = masters.find((m) => m.ac === ac);
    if (!m) {
      const g = ac.createGain(); g.gain.value = api.enabled ? api.volume : 0;
      g.connect(ac.destination); m = { ac, g }; masters.push(m);
    }
    return m.g;
  }
  function applyVolume() {
    for (const m of masters) m.g.gain.setTargetAtTime(api.enabled ? api.volume : 0, m.ac.currentTime, 0.02);
  }

  const noiseBufs = [];                        // 1 second of white noise, made once per context
  function noise(ac) {
    let b = noiseBufs.find((b) => b.ac === ac);
    if (!b) {
      const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      b = { ac, buf }; noiseBufs.push(b);
    }
    const n = ac.createBufferSource(); n.buffer = b.buf; return n;
  }
  function env(ac, t, vol, attack, len) {      // volume shape: quick rise, fade out
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(out(ac)); return g;
  }
  function tone(ac, t, type, f1, f2, vol, len, attack = 0.005) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + len);
    o.connect(env(ac, t, vol, attack, len)); o.start(t); o.stop(t + len + 0.05);
  }
  function hiss(ac, t, filter, f1, f2, q, vol, len, attack = 0.01) {
    const n = noise(ac), f = ac.createBiquadFilter();
    f.type = filter; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + len);
    n.connect(f).connect(env(ac, t, vol, attack, len)); n.start(t); n.stop(t + len + 0.05);
  }
  // growl: a buzzy saw, made darker by a low-pass filter and shaken by a fast wobble
  function growl(ac, t, f1, f2, vol, len, cutoff, wobble) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), w = ac.createGain();
    const lfo = ac.createOscillator(), depth = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + len);
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 4;
    lfo.frequency.value = wobble; depth.gain.value = 0.5; w.gain.value = 0.6;   // gain swings 0.1..1.1
    lfo.connect(depth).connect(w.gain);
    o.connect(f).connect(w).connect(env(ac, t, vol, 0.12, len));
    o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  const S = {
    swing: (ac, t) => hiss(ac, t, 'bandpass', 600, 2400, 1.5, 0.35, 0.14, 0.03),       // whoosh
    burn:  (ac, t) => { hiss(ac, t, 'highpass', 3000, 6000, 0.7, 0.25, 0.18);          // hiss...
                        tone(ac, t + 0.1, 'square', 700, 90, 0.12, 0.09); },           // ...pop
    hit:   (ac, t) => { tone(ac, t, 'square', 110, 45, 0.25, 0.28);
                        hiss(ac, t, 'lowpass', 900, 200, 1, 0.3, 0.2); },
    flare: (ac, t) => { hiss(ac, t, 'lowpass', 300, 5000, 2, 0.45, 0.45, 0.04);        // whoomp
                        tone(ac, t, 'sawtooth', 90, 260, 0.1, 0.35, 0.03); },
    ward:  (ac, t) => { tone(ac, t, 'sine', 95, 32, 0.6, 0.45);                        // deep thud
                        hiss(ac, t, 'lowpass', 500, 80, 1, 0.4, 0.25); },
    bell:  (ac, t) => { for (const [m, v] of [[1, 0.18], [2.01, 0.09], [2.76, 0.07], [4.1, 0.04]])
                          tone(ac, t, 'sine', 196 * m, 194 * m, v, 2.2 / Math.sqrt(m)); }, // grave bell toll
    dawn:  (ac, t) => [523, 659, 784, 1047].forEach((f, i) =>
                          tone(ac, t + i * 0.16, 'triangle', f, f, 0.14, 0.9)),       // rising chime
    blip:  (ac, t) => tone(ac, t, 'square', 880, 1320, 0.07, 0.06),

    // --- new sounds (Audio Designer) ---
    step:  (ac, t) => { const r = rnd(0.85, 1.15);                                     // random pitch so
                        hiss(ac, t, 'bandpass', 1400 * r, 500 * r, 1.2, 0.05, 0.05, 0.003); // it never sounds
                        tone(ac, t, 'triangle', 170 * r, 90 * r, 0.035, 0.05, 0.002); },   // like a robot
    chest: (ac, t) => { for (let i = 0; i < 6; i++)                                    // creaky wood...
                          tone(ac, t + i * 0.045, 'sawtooth', 210 + i * 18 + rnd(-8, 8), 150 + i * 12, 0.035, 0.04, 0.004);
                        tone(ac, t + 0.3, 'sine', 170, 55, 0.3, 0.14);                 // ...latch clunk
                        hiss(ac, t + 0.3, 'lowpass', 1800, 250, 1, 0.18, 0.09, 0.002); },
    coin:  (ac, t) => { tone(ac, t, 'triangle', 1319, 1319, 0.12, 0.12);               // bright ping-
                        tone(ac, t + 0.07, 'triangle', 1976, 1976, 0.12, 0.35);        // -PING
                        tone(ac, t + 0.07, 'sine', 3952, 3952, 0.025, 0.2); },
    pickup:(ac, t) => [587, 740, 880, 1175].forEach((f, i) =>                           // short rising chime
                          tone(ac, t + i * 0.05, 'triangle', f, f * 1.01, 0.09, 0.28)),
    gulp:  (ac, t) => [[150, 290], [120, 250], [165, 330]].forEach(([a, b], i) =>      // three bubbly blips
                          tone(ac, t + i * 0.13, 'sine', a * rnd(0.95, 1.05), b, 0.22, 0.08, 0.01)),
    stairs:(ac, t) => { for (let i = 0; i < 4; i++) {                                  // steps going down...
                          const k = 1 - i * 0.13, at = t + i * 0.15;
                          tone(ac, at, 'triangle', 190 * k, 95 * k, 0.07, 0.07, 0.002);
                          hiss(ac, at, 'lowpass', 1200 * k, 300, 1, 0.06, 0.06, 0.003); }
                        hiss(ac, t + 0.1, 'bandpass', 1600, 180, 1.2, 0.12, 0.65, 0.15); }, // ...and a whoosh
    ring:  (ac, t) => { tone(ac, t, 'sine', 55, 46, 0.3, 1.1, 0.45);                   // two close low notes
                        tone(ac, t, 'sine', 58, 48, 0.25, 1.1, 0.45);                  // "beat" = dark pulse
                        tone(ac, t, 'sawtooth', 110, 92, 0.035, 1.0, 0.5);
                        hiss(ac, t, 'lowpass', 150, 700, 2, 0.12, 0.9, 0.5); },
    roar:  (ac, t) => { growl(ac, t, 68, 44, 0.22, 1.0, 420, 23);                      // two saws, slightly
                        growl(ac, t, 71.5, 45.5, 0.22, 1.0, 380, 29);                  // out of tune = growl
                        hiss(ac, t, 'lowpass', 700, 160, 3, 0.25, 1.0, 0.1); },
  };

  // when (optional) = exact time to play; normally "right now"
  api.play = function (ac, name, when) {
    if (!ac || !S[name] || !api.enabled) return;
    const offline = typeof OfflineAudioContext !== 'undefined' && ac instanceof OfflineAudioContext;
    if (ac.state !== 'running' && !offline) return;
    try { S[name](ac, when !== undefined ? when : ac.currentTime + 0.005); } catch (e) {}
  };
  api.setVolume = function (v) {
    api.volume = Math.max(0, Math.min(1, +v || 0)); save('gravelight.sfxVol', api.volume); applyVolume();
  };
  api.toggle = function (on) {                 // toggle() flips; toggle(true/false) sets it
    api.enabled = on === undefined ? !api.enabled : !!on;
    save('gravelight.sfxOn', api.enabled ? 'on' : 'off'); applyVolume(); return api.enabled;
  };
  api.names = Object.keys(S);
  return api;
})();

window.SFX = SFX; // make it visible to game.js (top-level const is not on window)
