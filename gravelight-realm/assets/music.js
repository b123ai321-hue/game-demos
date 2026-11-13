// ============================================================
// GRAVELIGHT: REALM MUSIC - original, made in code with Web Audio.
// Each THEME (song) has two LAYERS: EXPLORE (calm) and DANGER (tense boss
// layer), always playing. setBoss() fades between them.
//   'forest' = mysterious main track, D Dorian (the B natural is the spooky
//     color), 63 bpm: plucked lute, breathy recorder, low D+A drone, far bells.
//     Boss layer: galloping low strings, drums, low brass, a nervous trill.
//   'castle' = C minor with a dark Phrygian "Db": brass, war drum, choir,
//     plucked tune, a distant bell.
//   'keep' = sparse and tense, D minor: low drone, a far slow drum, a choir
//     swell now and then, a far bell. Boss layer: a low pulse (rarely used).
//   'throne' = D Phrygian (the dark "Eb"), 70 bpm: brooding low brass, choir,
//     slow war drum, tolling bell. Boss layer = the Hollow King theme: heavy
//     drum pulse, brass stabs, a low ostinato, full choir, a bell on every bar.
// Music.start(ac)       start (after a tap). Safe to call twice.
// Music.setTheme(name)  'forest' | 'castle' | 'keep' | 'throne': switches at the next bar, 2s crossfade
// Music.setBoss(on)     true while the Warden / Hollow King is awake: boss layer
//                       fades in (1s), out on false (~3s). Call every frame.
// Music.setDanger(x)    old API, still works: 0..1 of the boss layer
// Music.setPhase(n)     1 | 2 | 3 in the Hollow King fight. 2 = more drums,
//                       3 = the dark phase: only drums, low drone and a heartbeat.
//                       Goes back to 1 on setBoss(false). Changes at the next beat.
// Also: setVolume(0..1), toggle(), stop(), .enabled .volume .theme .phase (saved: gravelight-realm.*)
// ============================================================
const Music = (() => {
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const api = {
    enabled: load('gravelight-realm.musicOn', 'on') !== 'off',
    volume: Math.max(0, Math.min(1, +load('gravelight-realm.musicVol', 0.5) || 0)),
    theme: 'forest',
    phase: 1,  // read-only: current boss phase
  };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);  // note -> pitch (60 = middle C)
  const FADE = 2;  // theme crossfade, seconds

  let ac = null, master, comp, timer = null, noiseBuf = null, lastDanger = 0, lastBoss = null, live = false;
  let cur = null, old = null;  // playing theme, theme fading out
  let wanted = 'forest', phase = 1;

  // ---- instruments (bus = where the sound goes) ----
  function osc(type, f, dest, t, end) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest);
    o.start(t); if (end) o.stop(end); return o;
  }
  function filt(type, f, dest) { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.connect(dest); return x; }
  function env(bus, t, vol, att, len) {
    const g = ac.createGain(); g.connect(bus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len); return g;
  }
  function pluck(bus, t, midi, vol, decay, bright) {  // lute/harp
    const p = hz(midi), f = filt('lowpass', p * bright, env(bus, t, vol, 0.003, decay));
    f.frequency.setValueAtTime(p * bright, t); f.frequency.exponentialRampToValueAtTime(p * 1.1, t + decay * 0.25);
    osc('sawtooth', p, f, t, t + decay + 0.05); osc('triangle', p * 2.003, f, t, t + decay + 0.05);
  }
  // saws + low-pass: slow attack = choir "aah", fast + opening filter = brass/strings
  function chord(bus, t, notes, len, vol, attack, cut1, cut2) {
    const f = filt('lowpass', cut1, env(bus, t, vol, attack, len)); f.Q.value = 1.5;
    f.frequency.setValueAtTime(cut1, t); f.frequency.exponentialRampToValueAtTime(cut2, t + attack * 1.5);
    f.frequency.exponentialRampToValueAtTime(cut1, t + len);
    notes.forEach((m, i) => { osc('sawtooth', hz(m), f, t, t + len + 0.05).detune.value = i % 2 ? 7 : -7; });
  }
  function drum(bus, t, vol, top = 120, bottom = 42, len = 0.4) {  // low "thum"
    const o = osc('sine', top, env(bus, t, vol, 0.006, len), t, t + len + 0.05);
    o.frequency.setValueAtTime(top, t); o.frequency.exponentialRampToValueAtTime(bottom, t + len * 0.75);
  }
  function noise(dest, t, end) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate / 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.connect(dest); n.start(t); n.stop(end);
  }
  function tick(bus, t, vol, cut = 5000, len = 0.06) {  // noise: "tss" or snare-ish slap
    noise(filt(cut < 2000 ? 'lowpass' : 'highpass', cut, env(bus, t, vol, 0.002, len)), t, t + len + 0.02);
  }
  function recorder(bus, t, midi, len, vol) {  // soft attack, 5 Hz vibrato, breath noise
    const p = hz(midi), g = ac.createGain(), lg = ac.createGain();
    g.connect(bus); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
    g.gain.setValueAtTime(vol, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const o = osc('triangle', p, filt('lowpass', p * 3, g), t, t + len + 0.05);
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(p * 0.007, t + Math.min(0.6, len / 2));
    lg.connect(o.frequency); osc('sine', 5, lg, t, t + len + 0.05);  // vibrato creeps in
    const nf = filt('bandpass', p * 2, env(bus, t, vol * 0.5, 0.05, len * 0.6)); nf.Q.value = 2;
    noise(nf, t, t + len);  // breath
  }
  function bell(bus, t, midi, vol) {  // inharmonic partials, long ring, dull = far
    const f = filt('lowpass', 1600, bus);
    [[1,1,6],[2.76,0.45,3.5],[5.4,0.2,2],[8.93,0.1,1.2],[0.5,0.3,7]].forEach(([r,a,d]) =>
      osc('sine', hz(midi) * r, env(f, t, vol * a, 0.005, d), t, t + d + 0.05));
  }
  function drone(bus, notes, cut, vol) {  // low hum, always on
    const g = ac.createGain(); g.gain.value = vol; g.connect(bus);
    const f = filt('lowpass', cut, g);
    return notes.map(([m, d]) => { const o = osc('sawtooth', hz(m), f, 0); o.detune.value = d; return o; });
  }

  // ===== THE SONGS =====
  // Each song: bpm, drone, play(th, s, t) = notes for 16th-note step s (16 = 1 bar) at time t.
  // th.ex = explore bus, th.dg = boss bus.
  // forest: D Dorian chords (G major carries the B natural)
  const Dm = [50,53,57], C = [48,52,55], G = [55,59,62], Am = [45,48,52], Em = [52,55,59], F = [53,57,60];
  const FOREST_SONG = [Dm,Dm,G,G,Dm,C,Am,Em,F,C,G,Dm,F,G,Am,Dm];
  const LUTE = [[0,-1,2,4,-1,3,-1,-1],[0,-1,-1,2,3,-1,4,-1],[0,2,-1,-1,5,-1,3,-1],[0,-1,3,-1,-1,-1,-1,-1]];
  const SC = [62,64,65,67,69,71,72,74,76,77,79];  // D Dorian, D4 up
  // recorder tune: [bar, step, scale index, length in steps]; TUNE2 = every other loop
  const TUNE = [[4,0,4,8],[4,8,5,6],[4,14,4,2],[5,0,1,12],[5,12,2,4],[6,0,4,12],[6,12,2,4],[7,0,1,16],
    [8,0,7,8],[8,8,6,8],[9,0,3,12],[9,12,4,4],[10,0,5,8],[10,8,7,8],[11,0,4,16],
    [12,0,6,6],[12,6,4,2],[12,8,2,8],[13,0,3,6],[13,6,5,2],[13,8,7,8],[14,0,8,8],[14,8,6,8],[15,0,7,16]];
  const TUNE2 = [[1,8,4,8],[2,0,5,16],[3,8,3,8]].concat(TUNE.slice(8,15),
    [[12,0,9,8],[12,8,7,8],[13,0,5,12],[13,12,7,4],[14,0,8,12],[14,12,6,4],[15,0,7,16]]);
  const BELLS = [[0,74],[3,81],[6,69],[10,77],[13,74]];  // [bar, note]

  const Cm = [48,51,55], Db = [49,53,56], Ab = [44,48,51], Fm = [41,44,48], Gc = [43,47,50];
  const CASTLE_SONG = [Cm,Cm,Db,Cm,Ab,Fm,Db,Gc];
  // castle tune: one note per beat, -1 = rest. Bars 0-1 and 4-5.
  const MOTIF = [[67,68,67,65,63,61,60,-1],[72,70,68,67,65,63,65,-1]];

  // throne: D Phrygian chords (Dm, Eb, Gm, Bb, Cm, and A major for the dread at the end)
  const Dt = [50,53,57], Eb = [51,55,58], Gm = [43,46,50], Bb = [46,50,53], Ct = [48,51,55], At = [45,49,52];
  const THRONE_SONG = [Dt,Dt,Eb,Dt,Gm,Bb,Eb,At];

  const SONGS = {
    forest: {
      bpm: 63, drone: [[[38, -5],[38, 5],[45, 0]], 260, 0.055],  // D, D, A
      play(th, s, t) {
        const E = th.ex, D = th.dg;
        const bar = Math.floor(s / 16) % FOREST_SONG.length, pos = s % 16, ch = FOREST_SONG[bar];
        const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12], st = th.step16;
        const pass = Math.floor(s / (16 * FOREST_SONG.length)) % 2;
        // EXPLORE: lute, recorder, far bells, a rare soft drum
        if (pos % 2 === 0) {
          const n = LUTE[bar % 4 === 3 ? 3 : (bar + pass) % 3][pos / 2];
          if (n >= 0) pluck(E, t, tones[n] + (pass && n > 3 ? 12 : 0), n ? 0.06 : 0.075, 1.5, 6);
        }
        for (const [b, p, i, len] of pass ? TUNE2 : TUNE) if (b === bar && p === pos) recorder(E, t, SC[i], len * st, 0.05);
        for (const [b, m] of BELLS) if ((b + pass * 2) % 16 === bar && pos === 8) { bell(E, t, m, 0.035); bell(E, t + st * 3, m, 0.012); }
        if (pos === 0 && bar % 4 === 0) drum(E, t, 0.16, 90, 36, 0.8);
        // DANGER = boss: strings, drums, low brass, trill
        const r = ch[0] - 12;
        if (pos % 4 !== 1) chord(D, t, [r, r + 12], st * 0.9, pos % 4 ? 0.035 : 0.05, 0.01, 300, 1500);
        if (pos % 4 === 0 || pos === 10 || pos === 14) drum(D, t, pos % 4 ? 0.3 : 0.45, 110, 40, 0.35);
        if (pos === 4 || pos === 12) { tick(D, t, 0.14, 1800, 0.14); drum(D, t, 0.15, 220, 140, 0.1); }
        if (pos % 2 === 1) tick(D, t, 0.03);
        if (pos === 0) chord(D, t, [r, r + 7, r + 12], th.bar * 0.95, 0.05, 0.25, 250, 1500);
        if (bar % 2 === 1 && pos === 10) chord(D, t, [r + 12, r + 19, r + 24], 0.45, 0.04, 0.02, 400, 2200);
        if (bar % 4 >= 2 && pos % 2 === 0) chord(D, t, [r + 36 + (pos % 4 ? 1 : 0)], st * 2, 0.012, 0.03, 1500, 3000);
        if (bar % 4 === 3 && pos >= 13) drum(D, t, 0.18, 150, 70, 0.2);
      },
    },
    castle: {
      bpm: 60, drone: [[[36, -4],[36, 4],[43, 0]], 220, 0.05],  // C, C, G
      play(th, s, t) {
        const E = th.ex, D = th.dg;
        const bar = Math.floor(s / 16) % CASTLE_SONG.length, pos = s % 16, ch = CASTLE_SONG[bar];
        const pass = Math.floor(s / (16 * CASTLE_SONG.length)) % 2;  // every other loop: higher tune
        // EXPLORE: brass, choir, slow war drum, plucked tune
        if (pos === 0) {
          chord(E, t, [ch[0] - 12, ch[0], ch[1], ch[2]], th.bar * 1.05, 0.05, 0.5, 250, 1100);  // brass
          chord(E, t, [ch[0] + 12, ch[1] + 12, ch[2] + 12], th.bar * 1.1, 0.022, th.bar * 0.5, 600, 1000); // choir
        }
        if (pos === 0) { drum(E, t, 0.4, 85, 34, 1.1); tick(E, t, 0.08, 900, 0.15); }  // BOOM...
        if (bar % 2 === 1 && (pos === 10 || pos === 12)) drum(E, t, 0.22, 80, 36, 0.8);  // ...ba-boom
        const mi = [0, 1, -1, -1, 0, 1, -1, -1][bar], half = bar >= 4 ? 1 : 0;
        if (mi >= 0 && pos % 4 === 0) {
          const n = MOTIF[half][mi * 4 + pos / 4];
          if (n > 0) pluck(E, t, n + (pass ? 12 : 0) - (pass && half ? 12 : 0), 0.07, 1.6, 6);
        }
        if (bar % 4 === 2 && pos === 8) bell(E, t, pass ? 73 : 67, 0.03);  // far bell (Db/G): Phrygian color
        // DANGER: galloping strings, drums, brass stabs
        if (pos % 4 !== 1) pluck(D, t, ch[0] - 12 + (pos % 8 === 0 ? 12 : 0), 0.1, 0.25, 4);
        if (pos % 4 === 0) drum(D, t, pos === 0 ? 0.45 : 0.3, 95, 38, 0.5);
        if (pos >= 13) drum(D, t, 0.18, 140, 70, 0.2);  // drum roll
        if (pos === 0 || pos === 6) chord(D, t, [ch[0], ch[1], ch[2], ch[0] + 12], 0.6, 0.045, 0.03, 400, 2000);
        if (pos % 4 === 2) tick(D, t, 0.04);
      },
    },
    keep: {
      bpm: 60, drone: [[[26, -3],[38, 3],[45, 0]], 150, 0.055],  // low D, D, A
      play(th, s, t) {
        const E = th.ex, D = th.dg;
        const bar = Math.floor(s / 16) % THRONE_SONG.length, pos = s % 16, ch = THRONE_SONG[bar];
        // EXPLORE: mostly silence and drone; things happen far away
        if (pos === 0 && bar % 2 === 0) { drum(E, t, 0.2, 70, 30, 1.4); tick(E, t, 0.04, 500, 0.3); }  // distant drum
        if (pos === 8 && bar % 4 === 1) drum(E, t, 0.1, 65, 30, 1.2);  // its echo
        if (pos === 0 && bar % 4 === 2) chord(E, t, [ch[0] + 12, ch[1] + 12, ch[2] + 12], th.bar * 2, 0.02, th.bar, 400, 800);  // choir swell
        if (pos === 4 && bar === 5) bell(E, t, 62, 0.02);  // far bell
        // BOSS: low pulse + brass
        if (pos % 4 === 0) drum(D, t, pos === 0 ? 0.35 : 0.2, 90, 36, 0.5);
        if (pos === 0) chord(D, t, [ch[0] - 12, ch[0]], th.bar, 0.04, 0.3, 200, 900);
      },
    },
    throne: {
      bpm: 70, drone: [[[26, -4],[26, 4],[38, 0],[45, 0]], 170, 0.05],  // very low D, D, D, A
      play(th, s, t) {
        const E = th.ex, D = th.dg, dark = phase === 3 && lastBoss;  // dark = phase 3 of the fight
        const bar = Math.floor(s / 16) % THRONE_SONG.length, pos = s % 16, ch = THRONE_SONG[bar];
        // EXPLORE (brooding, before the fight): low brass, choir, slow drum, tolling bell
        if (!dark) {
          if (pos === 0) {
            chord(E, t, [ch[0] - 12, ch[0], ch[1]], th.bar * 1.05, 0.05, 0.7, 180, 800);  // low brass swell
            chord(E, t, [ch[0] + 12, ch[1] + 12, ch[2] + 12], th.bar * 1.1, 0.02, th.bar * 0.5, 500, 900);  // choir "aah"
            drum(E, t, 0.38, 80, 32, 1.2); tick(E, t, 0.06, 700, 0.2);  // BOOM
          }
          if (pos === 8 && bar % 2 === 1) drum(E, t, 0.2, 75, 32, 0.9);  // ...and a softer one
          if (pos === 0 && bar % 2 === 0) bell(E, t, 50, 0.04);  // low tolling bell (D)
          if (pos === 8 && bar === 6) bell(E, t, 63, 0.02);  // far high bell (Eb): Phrygian shiver
        }
        // BOSS = the Hollow King theme
        const r = ch[0] - 12;
        if (dark) {  // phase 3: heartbeat "lub-dub" + a drum every bar, nothing else
          if (pos === 0 || pos === 8) { drum(D, t, 0.4, 60, 30, 0.3); drum(D, t + th.step16 * 1.3, 0.25, 55, 30, 0.25); }
          if (pos === 0) { drum(D, t, 0.3, 90, 34, 1.2); chord(D, t, [r - 12, r], th.bar, 0.04, 0.8, 120, 260); }  // low growl
          return;
        }
        if (pos % 4 === 0) drum(D, t, pos === 0 ? 0.45 : 0.3, 95, 36, 0.5);  // heavy pulse on every beat
        if (pos % 4 === 2) pluck(D, t, r + (pos === 6 ? 1 : 0), 0.08, 0.35, 3);  // low ostinato, D-Eb
        if (pos === 0 || pos === 10) chord(D, t, [r, r + 7, r + 12], 0.55, 0.05, 0.03, 300, 1600);  // brass stab
        if (pos === 0) { chord(D, t, [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24], th.bar, 0.025, 0.4, 700, 1400);  // choir
                         bell(D, t, 38, 0.05); }  // the bell tolls every bar
        if (phase === 2) {  // phase 2: the drums get angrier
          if (pos % 2 === 1) tick(D, t, 0.03);
          if (pos % 4 === 2) drum(D, t, 0.2, 130, 60, 0.18);
          if (pos >= 12) drum(D, t, 0.12 + (pos - 12) * 0.04, 150, 70, 0.15);  // roll into the next bar
          if (pos === 4 || pos === 12) { tick(D, t, 0.12, 1800, 0.14); drum(D, t, 0.14, 220, 140, 0.1); }
        }
      },
    },
  };

  // explore + danger -> theme gain -> master
  function makeTheme(name, t) {
    const song = SONGS[name], th = { name, song, step: 0, next: t, bar: 240 / song.bpm };
    th.step16 = 60 / song.bpm / 4;
    th.gain = ac.createGain(); th.ex = ac.createGain(); th.dg = ac.createGain();
    th.ex.gain.value = 1 - 0.75 * lastDanger; th.dg.gain.value = lastDanger;
    th.ex.connect(th.gain); th.dg.connect(th.gain); th.gain.connect(master);
    th.drone = drone(th.gain, ...song.drone);
    return th;
  }
  function fadeTheme(th, t, from, to) {
    th.gain.gain.setValueAtTime(from, t); th.gain.gain.linearRampToValueAtTime(to, t + FADE);
  }
  function killTheme(th, t) {
    th.drone.forEach((o) => { try { o.stop(t); } catch (e) {} });
    th.dead = t;
  }

  // ---- lookahead scheduler: every 25ms, book notes for the next 0.1s ----
  function fill(until) {
    if (!cur) { cur = makeTheme(wanted, ac.currentTime + 0.1); fadeTheme(cur, cur.next, 0.0001, 1); }
    while (cur.next < until) {
      // at a bar line: switch theme if asked
      if (cur.step % 16 === 0 && wanted !== cur.name) {
        if (old) { killTheme(old, cur.next); try { old.gain.disconnect(); } catch (e) {} }
        old = cur; fadeTheme(old, old.next, 1, 0.0001); old.end = old.next + FADE;
        cur = makeTheme(wanted, old.next); fadeTheme(cur, cur.next, 0.0001, 1);
      }
      if (api.enabled) cur.song.play(cur, cur.step, cur.next);
      cur.step++; cur.next += cur.step16;
    }
    if (old) {  // old song plays while fading
      while (old.next < until && old.next < old.end) { if (api.enabled) old.song.play(old, old.step, old.next); old.step++; old.next += old.step16; }
      if (old.next >= old.end && !old.dead) killTheme(old, old.end + 0.1);
      if (old.dead && ac.currentTime > old.dead + 3) { try { old.gain.disconnect(); } catch (e) {} old = null; }
    }
  }
  function pump() {
    if (!ac || ac.state !== 'running') return;  // no tap yet / tab hidden: wait
    const now = ac.currentTime;
    if (!live) { live = true; master.gain.setTargetAtTime(level(), now, 0.5); }  // gentle fade in
    if (cur && cur.next < now - 0.2) {  // fell behind: skip ahead
      const skip = Math.ceil((now + 0.05 - cur.next) / cur.step16);
      cur.step += skip; cur.next += skip * cur.step16;
      if (old) { old.next = old.end; }
    }
    fill(now + 0.1);
  }

  function level() { return api.enabled ? api.volume * 0.65 : 0; }
  api.start = function (ctx) {
    if (!ctx) return;
    if (ac === ctx && timer) return;  // already playing
    if (ac) api.stop();
    ac = ctx; live = false; cur = old = null;
    comp = ac.createDynamicsCompressor();  // never too loud
    master = ac.createGain(); master.gain.value = 0.0001;
    master.connect(comp).connect(ac.destination);
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    timer = setInterval(pump, 25); pump();
  };
  api.setTheme = function (name) {
    if (!SONGS[name]) return;  // unknown name: ignore
    wanted = api.theme = name;
  };
  api.setDanger = function (x) {
    x = Math.max(0, Math.min(1, +x || 0));
    if (Math.abs(x - lastDanger) < 0.02) return;  // only act on a real change
    const up = x > lastDanger; lastDanger = x;
    if (!ac) return;
    const tc = up ? 0.33 : 1.0, now = ac.currentTime;  // up in ~1s, down in ~3s
    for (const th of [cur, old]) if (th) for (const [g, v] of [[th.dg.gain, x], [th.ex.gain, 1 - 0.75 * x]]) {
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(v, now, tc);
    }
  };
  api.setBoss = function (on) {  // boss fight on/off; repeats cost nothing
    on = !!on;
    if (on === lastBoss) return;
    lastBoss = on; api.setDanger(on ? 1 : 0);
    if (!on) phase = api.phase = 1;  // fight over (or restart): back to phase 1
  };
  api.setPhase = function (n) {  // 1, 2 or 3 (only the throne theme uses it)
    n = Math.round(+n);
    if (n >= 1 && n <= 3) phase = api.phase = n;
  };
  function applyVolume() {
    if (!ac || !live) return;
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
    master.gain.setTargetAtTime(Math.max(level(), 0.0001), now, 0.1);
  }
  api.setVolume = function (v) {
    api.volume = Math.max(0, Math.min(1, +v || 0)); save('gravelight-realm.musicVol', api.volume); applyVolume();
  };
  api.toggle = function (on) {
    api.enabled = on === undefined ? !api.enabled : !!on;
    save('gravelight-realm.musicOn', api.enabled ? 'on' : 'off'); applyVolume(); return api.enabled;
  };
  api.stop = function () {
    if (!ac) return;
    clearInterval(timer); timer = null;
    const t = ac.currentTime, m = master;
    m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(m.gain.value, t); m.gain.setTargetAtTime(0.0001, t, 0.15);
    for (const th of [cur, old]) if (th) killTheme(th, t + 1);
    setTimeout(() => { try { m.disconnect(); } catch (e) {} }, 1200);
    ac = null; cur = old = null;
  };
  // for tests (offline rendering): book all notes up to "until"
  api._fill = function (until) {
    if (!ac) return;
    if (!live) { live = true; master.gain.setTargetAtTime(level(), 0, 0.5); }
    fill(until);
  };
  return api;
})();

// make it visible to game.js (a top-level const is not on window)
window.Music = Music;
