// ============================================================
// GRAVELIGHT MUSIC - original, made in code with Web Audio.
// Dark medieval loop in D minor: plucked harp notes, a low drone,
// a soft drum and a choir-like pad. Two layers play at the same time:
//   EXPLORE = calm, slow (70 beats per minute)
//   DANGER  = faster notes, low pulse, more drum
// We just fade between them with Music.setDanger(0..1).
//
// Music.start(ac)      start (only after a tap/key press). Safe to call twice.
// Music.setDanger(x)   0 = calm, 1 = danger (1s fade in, ~3s fade out)
// Music.setVolume(v)   0..1     Music.toggle() / toggle(true|false)
// Music.enabled, Music.volume, Music.stop()
// Settings are saved in localStorage: gravelight.musicVol / gravelight.musicOn
// ============================================================
const Music = (() => {
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const api = {
    enabled: load('gravelight.musicOn', 'on') !== 'off',
    volume: Math.max(0, Math.min(1, +load('gravelight.musicVol', 0.5) || 0)),
  };

  const BPM = 70, STEP = 60 / BPM / 4;   // one "step" = a 16th note; 16 steps = 1 bar
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);   // note number -> pitch

  // Chords as note numbers (62 = D). A section, then a B section = 16 bars.
  const Dm = [50, 53, 57], C = [48, 52, 55], Bb = [46, 50, 53], Am = [45, 48, 52];
  const F = [41, 45, 48], Gm = [43, 46, 50], A = [45, 49, 52];   // A major pulls back home to D
  const SONG = [Dm, Dm, C, Bb, Dm, F, Gm, A,    Bb, F, Gm, Dm, Bb, C, A, A];
  // Harp patterns: which chord note to play on each 8th note (-1 = rest)
  const ARP = [[0, 2, 3, 4, 3, 2, 1, 2], [0, 1, 2, 3, 4, 3, 2, -1], [0, -1, 2, -1, 3, -1, 4, -1]];
  const FAST = [0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 3, 4, 3, 2, 1];   // danger: every 16th note
  const MELODY = [5, -1, 4, 3, 2, -1, 3, -1];                      // B section, one note per 2 beats
  const KICK = [0, 3, 8, 10, 11];                                  // danger drum steps

  let ac = null, master, comp, explore, danger, drone = [], timer = null;
  let step = 0, nextTime = 0, noiseBuf = null, lastDanger = -1;

  // ---- instruments ----
  function pluck(bus, t, midi, vol, decay, bright) {   // harp/lute: fast attack, fast fade
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    const p = hz(midi);
    o.type = 'sawtooth'; o.frequency.value = p; o2.type = 'triangle'; o2.frequency.value = p;
    f.type = 'lowpass'; f.frequency.setValueAtTime(p * bright, t);
    f.frequency.exponentialRampToValueAtTime(p * 1.2, t + decay * 0.4);   // bright "pling", then mellow
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(f); o2.connect(f); f.connect(g).connect(bus);
    o.start(t); o2.start(t); o.stop(t + decay + 0.05); o2.stop(t + decay + 0.05);
  }
  function pad(t, chord, len) {                       // soft "aah" choir: two slightly out-of-tune notes each
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + len * 0.35);   // slow swell in...
    g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.05);  // ...and out
    f.connect(g).connect(explore);
    for (const m of chord) for (const d of [-7, 7]) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m + 12); o.detune.value = d;
      o.connect(f); o.start(t); o.stop(t + len * 1.1);
    }
  }
  function drum(bus, t, vol) {                        // soft low "thum" of a frame drum
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.45);
  }
  function tick(bus, t, vol) {                        // tiny brushed "tss"
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate / 4, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 5000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + 0.08);
  }
  function startDrone() {                             // low D that hums the whole time
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.frequency.value = 280; g.gain.value = 0.06;
    f.connect(g).connect(master);
    drone = [[38, -5], [38, 5], [45, 0]].map(([m, d]) => {      // D, D (out of tune a bit), A
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m); o.detune.value = d; o.connect(f); o.start(); return o;
    });
  }

  // ---- play everything that belongs on one 16th-note step ----
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % SONG.length, pos = s % 16, chord = SONG[bar];
    const tones = [chord[0], chord[1], chord[2], chord[0] + 12, chord[1] + 12, chord[2] + 12];
    const pass = Math.floor(s / (16 * SONG.length)) % 2;   // every other loop is a little different
    // EXPLORE layer
    if (pos % 2 === 0) {
      const pat = ARP[(bar % 4 === 3) ? 2 : (bar + pass) % 2], n = pat[pos / 2];
      if (n >= 0) pluck(explore, t, tones[n], 0.1, 1.3, 7);
    }
    if (bar >= 8 && pos % 8 === 0) {                        // B section: a slow tune on top
      const n = MELODY[(bar % 4) * 2 + pos / 8];
      if (n >= 0) pluck(explore, t, tones[n] + 12 - (pass && n === 5 ? 2 : 0), 0.07, 2.2, 5);
    }
    if (pos === 0) pad(t, chord, STEP * 16);
    if (pos === 0 || (pos === 8 && bar % 2 === 1)) drum(explore, t, 0.35);
    // DANGER layer (always playing, just silent until setDanger)
    pluck(danger, t, tones[FAST[pos]] + 12, pos % 4 === 0 ? 0.08 : 0.055, 0.35, 5);
    if (pos % 2 === 0) pluck(danger, t, chord[0] - 12, 0.12, 0.22, 3);    // low pulse
    if (KICK.includes(pos)) drum(danger, t, pos === 0 || pos === 8 ? 0.4 : 0.25);
    if (pos % 4 === 2) tick(danger, t, 0.05);
  }

  // ---- lookahead scheduler: every 25ms, book notes for the next 0.1s ----
  function fill(until) {
    while (nextTime < until) { if (api.enabled) playStep(step, nextTime); step++; nextTime += STEP; }
  }
  function pump() {
    if (!ac || ac.state !== 'running') return;          // context paused (tab hidden etc): just wait
    const now = ac.currentTime;
    if (nextTime < now - 0.2) nextTime = now + 0.05;    // we fell behind (e.g. timers slowed): skip ahead
    fill(now + 0.1);
  }

  function level() { return api.enabled ? api.volume * 0.65 : 0; }
  api.start = function (ctx) {
    if (!ctx) return;
    if (ac === ctx && timer) return;                    // already playing
    if (ac) api.stop();
    ac = ctx;
    comp = ac.createDynamicsCompressor();               // safety net so it never gets too loud
    master = ac.createGain(); master.gain.value = 0.0001;
    master.gain.setTargetAtTime(level(), ac.currentTime, 0.5);   // gentle fade in
    explore = ac.createGain(); danger = ac.createGain(); danger.gain.value = 0;
    explore.connect(master); danger.connect(master); master.connect(comp).connect(ac.destination);
    startDrone();
    step = 0; nextTime = ac.currentTime + 0.1; lastDanger = -1;
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    timer = setInterval(pump, 25); pump();
  };
  api.setDanger = function (x) {
    x = Math.max(0, Math.min(1, +x || 0));
    if (!ac || Math.abs(x - lastDanger) < 0.02) return;    // called every frame: only act on a real change
    const tc = x > lastDanger ? 0.33 : 1.0, now = ac.currentTime;   // up in ~1s, down in ~3s
    lastDanger = x;
    for (const [g, v] of [[danger.gain, x], [explore.gain, 1 - 0.65 * x]]) {
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(v, now, tc);
    }
  };
  function applyVolume() {
    if (!ac) return;
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
    master.gain.setTargetAtTime(Math.max(level(), 0.0001), now, 0.1);
  }
  api.setVolume = function (v) {
    api.volume = Math.max(0, Math.min(1, +v || 0)); save('gravelight.musicVol', api.volume); applyVolume();
  };
  api.toggle = function (on) {                         // toggle() flips; toggle(true/false) sets it
    api.enabled = on === undefined ? !api.enabled : !!on;
    save('gravelight.musicOn', api.enabled ? 'on' : 'off'); applyVolume(); return api.enabled;
  };
  api.stop = function () {
    if (!ac) return;
    clearInterval(timer); timer = null;
    const t = ac.currentTime, old = master, oldDrone = drone;
    old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.setTargetAtTime(0.0001, t, 0.15);
    oldDrone.forEach((o) => o.stop(t + 1));
    setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 1200);
    ac = null; drone = [];
  };
  api._fill = function (until) { if (ac) fill(until); };   // for tests (offline rendering)
  return api;
})();

window.Music = Music; // make it visible to game.js (top-level const is not on window)
