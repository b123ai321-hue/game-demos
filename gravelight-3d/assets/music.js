// ============================================================
// GRAVELIGHT MUSIC - original, made in code with Web Audio.
// EXPLORE = the mysterious main track, D Dorian (D E F G A B C; the B
//   natural is the spooky-but-hopeful color), 63 beats per minute:
//   plucked lute, breathy recorder tune, low D+A drone, far-away bells.
//   16-bar loop; every other loop the tune and lute patterns change.
// BOSS (tense layer) = same clock but driving: galloping low strings,
//   drums every beat, low brass power chords, a nervous high trill.
// Both layers always play; we fade between them.
//
// Music.start(ac)      start (only after a tap/key press). Safe to call twice.
// Music.setBoss(on)    true = boss fight (1s fade in), false = back to explore (~3s)
//                      Cheap to call every frame: repeats are ignored.
// Music.setDanger(x)   old API, still works: 0..1 = how much of the tense layer
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

  const BPM = 63, STEP = 60 / BPM / 4, BAR = STEP * 16;   // one "step" = a 16th note; 16 steps = 1 bar
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);     // note number -> pitch (62 = D)

  // ---- the song: D Dorian chords (G major has the B natural) ----
  const Dm = [50, 53, 57], C = [48, 52, 55], G = [55, 59, 62], Am = [45, 48, 52], Em = [52, 55, 59], F = [53, 57, 60];
  const SONG = [Dm, Dm, G, G, Dm, C, Am, Em,   F, C, G, Dm, F, G, Am, Dm];
  // lute: which chord tone on each 8th note (0-2 low, 3-5 an octave up), -1 = rest
  const LUTE = [[0, -1, 2, 4, -1, 3, -1, -1], [0, -1, -1, 2, 3, -1, 4, -1], [0, 2, -1, -1, 5, -1, 3, -1], [0, -1, 3, -1, -1, -1, -1, -1]];
  const SC = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];  // D Dorian scale, D4 up
  // recorder tune: [bar, step, scale index, length in steps]
  const TUNE = [[4, 0, 4, 8], [4, 8, 5, 6], [4, 14, 4, 2], [5, 0, 1, 12], [5, 12, 2, 4], [6, 0, 4, 12], [6, 12, 2, 4], [7, 0, 1, 16],
    [8, 0, 7, 8], [8, 8, 6, 8], [9, 0, 3, 12], [9, 12, 4, 4], [10, 0, 5, 8], [10, 8, 7, 8], [11, 0, 4, 16],
    [12, 0, 6, 6], [12, 6, 4, 2], [12, 8, 2, 8], [13, 0, 3, 6], [13, 6, 5, 2], [13, 8, 7, 8], [14, 0, 8, 8], [14, 8, 6, 8], [15, 0, 7, 16]];
  // 2nd time round: a quiet answer in bars 1-3 instead of bars 4-7, and a new ending
  const TUNE2 = [[1, 8, 4, 8], [2, 0, 5, 16], [3, 8, 3, 8]].concat(TUNE.slice(8, 15),
    [[12, 0, 9, 8], [12, 8, 7, 8], [13, 0, 5, 12], [13, 12, 7, 4], [14, 0, 8, 12], [14, 12, 6, 4], [15, 0, 7, 16]]);
  const BELLS = [[0, 74], [3, 81], [6, 69], [10, 77], [13, 74]];   // [bar, note]: about one every 3 bars

  let ac = null, master, comp, explore, danger, drone = [], timer = null;
  let step = 0, nextTime = 0, noiseBuf = null, lastDanger = -1, lastBoss = null;

  // ---- instruments ----
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate / 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; return n;
  }
  function env(g, t, vol, att, len) {                   // fade in over att, fade out by len
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  }
  function pluck(bus, t, midi, vol, decay, bright) {   // lute: fast attack, filter closes fast
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    const p = hz(midi);
    o.type = 'sawtooth'; o.frequency.value = p; o2.type = 'triangle'; o2.frequency.value = p * 2.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(p * bright, t);
    f.frequency.exponentialRampToValueAtTime(p * 1.1, t + decay * 0.25);
    env(g, t, vol, 0.003, decay);
    o.connect(f); o2.connect(f); f.connect(g).connect(bus);
    o.start(t); o2.start(t); o.stop(t + decay + 0.05); o2.stop(t + decay + 0.05);
  }
  function recorder(bus, t, midi, len, vol) {          // soft attack, 5 Hz vibrato, breath noise
    const p = hz(midi), o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
    const f = ac.createBiquadFilter(), g = ac.createGain(), n = noise(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    o.type = 'triangle'; o.frequency.value = p;
    lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(p * 0.007, t + Math.min(0.6, len * 0.5));
    lfo.connect(lg).connect(o.frequency);                // vibrato creeps in, like a real player
    f.type = 'lowpass'; f.frequency.value = p * 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
    g.gain.setValueAtTime(vol, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    nf.type = 'bandpass'; nf.frequency.value = p * 2; nf.Q.value = 2;
    env(ng, t, vol * 0.5, 0.05, len * 0.6);
    o.connect(f).connect(g).connect(bus); n.connect(nf).connect(ng).connect(bus);
    for (const x of [o, lfo, n]) { x.start(t); x.stop(t + len + 0.05); }
  }
  function bell(bus, t, midi, vol) {                   // inharmonic partials, long ring, dull = far away
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; f.connect(bus);
    [[1, 1, 6], [2.76, 0.45, 3.5], [5.4, 0.2, 2], [8.93, 0.1, 1.2], [0.5, 0.3, 7]].forEach(([r, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = hz(midi) * r; env(g, t, vol * a, 0.005, d);
      o.connect(g).connect(f); o.start(t); o.stop(t + d + 0.05);
    });
  }
  function chord(bus, t, notes, len, vol, attack, cut1, cut2) {   // saws + opening filter = strings/brass
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(cut1, t); f.frequency.exponentialRampToValueAtTime(cut2, t + attack * 1.5);
    f.frequency.exponentialRampToValueAtTime(cut1, t + len);
    env(g, t, vol, attack, len);
    f.connect(g).connect(bus);
    notes.forEach((m, i) => {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m); o.detune.value = i % 2 ? 7 : -7;
      o.connect(f); o.start(t); o.stop(t + len + 0.05);
    });
  }
  function drum(bus, t, vol, top = 120, bottom = 42, len = 0.4) {   // low "thum"
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(bottom, t + len * 0.75);
    env(g, t, vol, 0.006, len);
    o.connect(g).connect(bus); o.start(t); o.stop(t + len + 0.05);
  }
  function tick(bus, t, vol, cut = 5000, len = 0.06) {  // noise hit: "tss", or a low snare-ish slap
    const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = cut < 2000 ? 'lowpass' : 'highpass'; f.frequency.value = cut;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + len + 0.02);
  }
  function startDrone() {                             // low D + A that hum the whole time
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.055;
    f.connect(g).connect(master);
    drone = [[38, -5], [38, 5], [45, 0]].map(([m, d]) => {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m); o.detune.value = d; o.connect(f); o.start(); return o;
    });
  }

  // ---- play everything that belongs on one 16th-note step ----
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % SONG.length, pos = s % 16, ch = SONG[bar];
    const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12];
    const pass = Math.floor(s / (16 * SONG.length)) % 2;   // every other loop is a little different
    // EXPLORE: lute, recorder, bells, a rare soft drum
    if (pos % 2 === 0) {
      const n = LUTE[bar % 4 === 3 ? 3 : (bar + pass) % 3][pos / 2];
      if (n >= 0) pluck(explore, t, tones[n] + (pass && n > 3 ? 12 : 0), n ? 0.06 : 0.075, 1.5, 6);
    }
    for (const [b, p, i, len] of pass ? TUNE2 : TUNE) if (b === bar && p === pos) recorder(explore, t, SC[i], len * STEP, 0.05);
    for (const [b, m] of BELLS) if ((b + pass * 2) % 16 === bar && pos === 8) {
      bell(explore, t, m, 0.035); bell(explore, t + STEP * 3, m, 0.012);   // plus a faint echo
    }
    if (pos === 0 && bar % 4 === 0) drum(explore, t, 0.16, 90, 36, 0.8);
    // BOSS / DANGER layer (always playing, silent until setBoss/setDanger)
    const r = ch[0] - 12;
    if (pos % 4 !== 1) chord(danger, t, [r, r + 12], STEP * 0.9, pos % 4 ? 0.035 : 0.05, 0.01, 300, 1500);  // galloping strings
    if (pos % 4 === 0 || pos === 10 || pos === 14) drum(danger, t, pos % 4 ? 0.3 : 0.45, 110, 40, 0.35);
    if (pos === 4 || pos === 12) { tick(danger, t, 0.14, 1800, 0.14); drum(danger, t, 0.15, 220, 140, 0.1); }
    if (pos % 2 === 1) tick(danger, t, 0.03);
    if (pos === 0) chord(danger, t, [r, r + 7, r + 12], BAR * 0.95, 0.05, 0.25, 250, 1500);   // low brass
    if (bar % 2 === 1 && pos === 10) chord(danger, t, [r + 12, r + 19, r + 24], 0.45, 0.04, 0.02, 400, 2200);
    if (bar % 4 >= 2 && pos % 2 === 0) chord(danger, t, [r + 36 + (pos % 4 ? 1 : 0)], STEP * 2, 0.012, 0.03, 1500, 3000); // nervous trill
    if (bar % 4 === 3 && pos >= 13) drum(danger, t, 0.18, 150, 70, 0.2);   // drum roll into the next bar
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
    explore = ac.createGain(); danger = ac.createGain();
    const x = Math.max(lastDanger, 0); danger.gain.value = x; explore.gain.value = 1 - 0.75 * x;
    explore.connect(master); danger.connect(master); master.connect(comp).connect(ac.destination);
    startDrone();
    step = 0; nextTime = ac.currentTime + 0.1;
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    timer = setInterval(pump, 25); pump();
  };
  api.setDanger = function (x) {
    x = Math.max(0, Math.min(1, +x || 0));
    if (Math.abs(x - lastDanger) < 0.02) return;        // called every frame: only act on a real change
    const tc = x > lastDanger ? 0.33 : 1.0;             // up in ~1s, down in ~3s
    lastDanger = x;
    if (!ac) return;
    const now = ac.currentTime;
    for (const [g, v] of [[danger.gain, x], [explore.gain, 1 - 0.75 * x]]) {
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(v, now, tc);
    }
  };
  api.setBoss = function (on) {                        // boss fight on/off; repeats cost nothing
    on = !!on;
    if (on === lastBoss) return;
    lastBoss = on; api.setDanger(on ? 1 : 0);
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
