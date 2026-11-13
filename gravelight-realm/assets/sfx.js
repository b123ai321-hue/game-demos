// ============================================================
// GRAVELIGHT: REALM SOUNDS (v8) - original, made in code with Web Audio.
// No sound files at all, so nothing to download.
// v3 = "serious" foley: real-ish metal, cloth, stone, grass, breath and fire.
//   Only sine waves and filtered noise are used (no chiptune beeps).
//   Every play is a little different (pitch +-6%, volume +-15%).
//   A small reverb (echo of the room) sits on everything: big in the castle,
//   small in the forest. Ambience.setZone() switches it for you.
// Usage: SFX.play(audioContext, 'swing')
// Names: swing burn hit flare ward bell dawn blip step chest coin pickup gulp stairs ring roar
//        ember relight key door stepGrass stepStone wolfGrowl wolfLunge clank
//        summon allyDeath wolfDeath skeletonDeath wardenDeath shadeDissolve   (new in v4)
//        horde goblinPop   (new in v5; goblinPop is rate-limited, safe to spam)
//        altarLight kingSlam kingRoar kingDeath doorGrind   (new in v6, slice 2)
//        skelRise shieldBlock mageCast mageBoltHit   (also v6)
//        wizardDeath   (new in v7)
//        roll parry critHit shardPickup upgradeBuy wallBreak loreNote kingIntro lockOn staminaOut telegraph poiseBreak
//          (new in v8, Part 3; also callable as SFX.roll() etc. shardPickup and telegraph are rate-limited)
//        ('step' is the same as 'stepStone')
// Nothing plays until the AudioContext is running (after the first tap).
// Volume: SFX.setVolume(0..1), SFX.toggle(), SFX.enabled, SFX.volume
//         (saved in localStorage as gravelight-realm.sfxVol / gravelight-realm.sfxOn)
// Room:   SFX.setSpace('forest' | 'castle' | 'keep' | 'none'), SFX.space
//         ('keep' = huge dark stone hall, ~3 s echo; 'throne' means the same)
// ============================================================
const SFX = (() => {
  // ---- saved settings (try/catch because some browsers block storage) ----
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const api = {
    enabled: load('gravelight-realm.sfxOn', 'on') !== 'off',
    volume: Math.max(0, Math.min(1, +load('gravelight-realm.sfxVol', 0.9) || 0)),
    space: 'forest',
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- reverb levels: [forest echo, castle echo, keep echo] for each space ----
  const SPACES = { forest: [0.16, 0, 0], castle: [0, 0.3, 0], keep: [0, 0, 0.3], none: [0, 0, 0] };
  SPACES.throne = SPACES.keep;  // the throne room is inside the keep

  // A fake "impulse response" = the sound of a room after one clap.
  // It is just stereo noise that fades out and gets darker (stone eats the highs).
  function makeRoom(ac, secs, bright) {
    const n = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        lp += (Math.random() * 2 - 1 - lp) * bright * (1 - 0.7 * k);  // simple low-pass, darker as it fades
        d[i] = lp * Math.exp(-6.5 * k) * Math.min(1, i / 300);
      }
    }
    return b;
  }

  // ---- one "rig" per AudioContext: master knob + reverb ----
  // sound -> bus -> master -> speakers
  //          bus -> forest/castle/keep reverb -> wet knob -> master
  const rigs = [];
  function rig(ac) {
    let r = rigs.find((r) => r.ac === ac);
    if (r) return r;
    const g = ac.createGain(); g.gain.value = api.enabled ? api.volume : 0; g.connect(ac.destination);
    r = { ac, g, bus: g, cv: [], wet: [], on: [false, false, false] };
    try {
      const bus = ac.createGain(); bus.connect(g);
      [[0.6, 0.55], [1.6, 0.3], [3, 0.18]].forEach(([secs, bright], i) => {  // forest short, castle long, keep longest + darkest
        const cv = ac.createConvolver(); cv.buffer = makeRoom(ac, secs, bright);
        const w = ac.createGain(); w.gain.value = SPACES[api.space][i];
        cv.connect(w); w.connect(g); r.cv.push(cv); r.wet.push(w);
      });
      r.bus = bus; plugRooms(r);
    } catch (e) { r.cv = []; }  // no reverb? sounds still play dry
    rigs.push(r); return r;
  }
  // only feed the reverb that is actually heard (saves phone CPU)
  function plugRooms(r) {
    r.cv.forEach((cv, i) => {
      const want = SPACES[api.space][i] > 0;
      if (want && !r.on[i]) { r.bus.connect(cv); r.on[i] = true; }
      if (!want && r.on[i]) setTimeout(() => {  // unplug after the echo fades
        if (SPACES[api.space][i] > 0 || !r.on[i]) return;
        try { r.bus.disconnect(cv); r.on[i] = false; } catch (e) {}
      }, 2500);
    });
  }
  function applyVolume() {
    for (const r of rigs) r.g.gain.setTargetAtTime(api.enabled ? api.volume : 0, r.ac.currentTime, 0.02);
  }

  // ---- building blocks. AC = context, OUT = where to plug in, P/V = random pitch/volume ----
  let AC = null, OUT = null, P = 1, V = 1;
  const noiseBufs = [];  // 1 s of white noise, made once per context
  function noise(t, len) {
    let b = noiseBufs.find((b) => b.ac === AC);
    if (!b) {
      const buf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      b = { ac: AC, buf }; noiseBufs.push(b);
    }
    const n = AC.createBufferSource(); n.buffer = b.buf; n.loop = true;
    n.start(t, Math.random() * 0.9); n.stop(t + len + 0.05); return n;
  }
  function env(t, vol, attack, len, to = OUT) { // volume shape: rise, then fade out (to = where it goes)
    const g = AC.createGain(); g.gain.value = 0.0001;  // silent until it starts (no click)
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * V, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(to); return g;
  }
  function envBack(t, vol, len) {  // "backwards" shape: slow fade IN, then a sudden stop
    const g = AC.createGain(); g.gain.value = 0.0001;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * V, t + len);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.04);
    g.connect(OUT); return g;
  }
  function filt(t, type, f1, f2, q, len) {  // a filter that slides from f1 to f2
    const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1 * P, t);
    if (f2 !== f1) f.frequency.exponentialRampToValueAtTime(f2 * P, t + len);
    return f;
  }
  // hiss = noise through a filter (whooshes, scrapes, cracks, fire)
  const hiss = (t, type, f1, f2, q, vol, len, attack = 0.005) =>
    noise(t, len).connect(filt(t, type, f1, f2, q, len)).connect(env(t, vol, attack, len));
  // swell = a hiss played "backwards": grows slowly and cuts off (shade / magic air)
  const swell = (t, type, f1, f2, q, vol, len) =>
    noise(t, len).connect(filt(t, type, f1, f2, q, len)).connect(envBack(t, vol, len));
  function sine(t, f1, f2, vol, len, attack = 0.002) {  // a plain sine (used for thumps and rings)
    const o = AC.createOscillator();
    o.frequency.setValueAtTime(f1 * P, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2 * P, t + len);
    o.connect(env(t, vol, attack, len)); o.start(t); o.stop(t + len + 0.05);
  }
  // metal = a few sines at "wrong" (not musical) ratios. That is what makes metal sound like metal.
  // Higher partials die faster, like a real bar or bell.
  function metal(t, base, parts, vol, len) {
    for (const [m, v] of parts) sine(t, base * m, base * m, vol * v, len / Math.sqrt(m), 0.001);
  }
  const CLANG = [[1, 1], [2.76, 0.6], [5.4, 0.4], [8.93, 0.25]];  // sword / steel bar
  const PLATE = [[1, 1], [1.59, 0.7], [2.35, 0.5], [3.9, 0.3]];  // armor plate
  const BELL  = [[1, 1], [2.01, 0.5], [2.76, 0.4], [4.07, 0.2]];  // church bell
  const WARM  = [[1, 1], [2.32, 0.35], [4.2, 0.12]];  // soft, low chime
  const thump = (t, f, vol, len = 0.16) => sine(t, f, f * 0.4, vol, len);  // low "dum" of weight
  const crack = (t, vol, f = 2200) => hiss(t, 'highpass', f, f, 0.7, vol, 0.025, 0.001);  // tiny hit transient

  // growl = breath noise through "mouth" filters (formants), shaken fast by a wobble,
  // plus a low rumble shaken by the SAME wobble (sounds like a throat)
  function growl(t, formants, rate, vol, len, attack, low) {
    const am = AC.createGain(), lfo = AC.createOscillator(), depth = AC.createGain(), e = env(t, vol, attack, len);
    am.gain.value = 3; depth.gain.value = 2.6;  // loudness swings 0.4..5.6
    lfo.frequency.setValueAtTime(rate * P, t); lfo.frequency.linearRampToValueAtTime(rate * P * rnd(0.7, 1.2), t + len);
    lfo.connect(depth).connect(am.gain);
    const n = noise(t, len);
    for (const [f, q] of formants) n.connect(filt(t, 'bandpass', f, f * 0.85, q, len)).connect(am);
    am.connect(e);
    if (low) {
      const o = AC.createOscillator(), rg = AC.createGain(); rg.gain.value = 0.25; depth.connect(rg.gain);
      o.frequency.setValueAtTime(low * P, t); o.frequency.exponentialRampToValueAtTime(low * 0.8 * P, t + len);
      o.connect(rg).connect(e); o.start(t); o.stop(t + len + 0.05);
    }
    lfo.start(t); lfo.stop(t + len + 0.05);
  }
  // creak = lots of tiny clicks, slowing down, through a ringing filter (wood rubbing on wood)
  function creak(t, len, f, vol) {
    const sr = AC.sampleRate, n = Math.floor(sr * len), b = AC.createBuffer(1, n, sr), d = b.getChannelData(0);
    const rate = rnd(35, 60);
    for (let i = 0, next = 0; i < n; i++) if (i >= next) { d[i] = rnd(0.5, 1); next = i + sr / (rate * (1 - 0.5 * i / n) * rnd(0.8, 1.2)); }
    const s = AC.createBufferSource(); s.buffer = b;
    s.connect(filt(t, 'bandpass', f, f * 0.8, 10, len)).connect(env(t, vol, 0.05, len)); s.start(t);
  }
  // sword impact: metal clang + scrape + crack + thump, all at once
  function impact(t, base, v) {
    metal(t, base, CLANG, 0.07 * v, 0.45);
    hiss(t + 0.004, 'bandpass', 4200, 1300, 3, 0.35 * v, 0.16, 0.004);  // scrape of blade on blade
    crack(t, 0.3 * v);
    thump(t, 120, 0.3 * v);
  }
  function stoneStep(t, vol, dark = 1) {  // boot on stone: dull click + small body thump
    hiss(t, 'lowpass', 1500 * dark, 600 * dark, 0.8, vol * 1.3, 0.035, 0.001);
    thump(t, 150 * dark, vol, 0.07);
  }

  // drone = a few sines mixed, with a slow loudness wobble (tremolo). parts = [[freq, loudness]].
  // from = start off-pitch, slide to the note in 0.25 s (like a horn). to = bend pitch by the end.
  function drone(t, parts, vol, len, attack, rate, depth, from = 1, to = 1) {
    const am = AC.createGain(), lfo = AC.createOscillator(), dg = AC.createGain();
    am.gain.value = 1; dg.gain.value = depth; lfo.frequency.value = rate * P;
    lfo.connect(dg).connect(am.gain); am.connect(env(t, vol, attack, len));
    for (const [f, v] of parts) {
      const o = AC.createOscillator(), g = AC.createGain(); g.gain.value = v;
      o.frequency.setValueAtTime(f * from * P, t);
      if (from !== 1) o.frequency.exponentialRampToValueAtTime(f * P, t + 0.25);
      if (to !== 1) o.frequency.exponentialRampToValueAtTime(f * to * P, t + len);
      o.connect(g).connect(am); o.start(t); o.stop(t + len + 0.05);
    }
    lfo.start(t); lfo.stop(t + len + 0.05);
  }
  // cold shimmer = soft high sines at "wrong" ratios, gently wobbling (spirit light)
  const shimmer = (t, base, vol, len, attack) =>
    drone(t, [[base, 1], [base * 1.47, 0.7], [base * 2.09, 0.45], [base * 2.8, 0.3]], vol, len, attack, rnd(5, 7), 0.5);
  // grain = one tiny whisper tick of high hiss, placed left or right (if the browser can pan)
  function grain(t, f, vol, len, pan) {
    let to = OUT;
    if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; p.connect(OUT); to = p; }
    noise(t, len).connect(filt(t, 'highpass', f, f, 0.8, len)).connect(env(t, vol, 0.002, len, to));
  }
  // body = something heavy landing on the ground: low thud + dull dirt/stone crunch
  function body(t, f, vol, len) {
    thump(t, f, vol, len); hiss(t, 'lowpass', 900, 150, 0.8, vol * 0.8, len, 0.002); crack(t, vol * 0.3, 1500);
  }

  // yip = one tiny goblin syllable ("hup!"): a high sine that shakes fast (a nervous little
  // voice) plus breath through a "mouth" filter (formant). Pitch jumps up, then falls.
  function yip(t, f, form, vol, len) {
    const o = AC.createOscillator(), lfo = AC.createOscillator(), dg = AC.createGain();
    lfo.frequency.value = rnd(18, 30); dg.gain.value = f * 0.04; lfo.connect(dg).connect(o.frequency);
    o.frequency.setValueAtTime(f * 0.9 * P, t); o.frequency.linearRampToValueAtTime(f * 1.1 * P, t + len * 0.3);
    o.frequency.exponentialRampToValueAtTime(f * 0.8 * P, t + len);
    o.connect(env(t, vol * 0.25, 0.01, len)); o.start(t); o.stop(t + len + 0.05); lfo.start(t); lfo.stop(t + len + 0.05);
    hiss(t, 'bandpass', form, form * 0.8, 5, vol, len, 0.01);
  }

  // grind = noise that sticks and slips: loudness jumps around every few hundredths
  // of a second (like stone dragging over stone), through a low filter
  function grind(t, len, f, vol) {
    const j = AC.createGain(); j.gain.setValueAtTime(0.3, t);
    for (let at = t; at < t + len; at += rnd(0.03, 0.12)) j.gain.linearRampToValueAtTime(rnd(0.15, 1), at);
    noise(t, len).connect(filt(t, 'lowpass', f, f * 0.7, 1.5, len)).connect(j).connect(env(t, vol, 0.3, len));
  }
  // debris = small stones rattling down: dull ticks that get quieter and further apart
  function debris(t, n, len, vol) {
    for (let i = 0; i < n; i++) { const k = i / n, f = rnd(700, 2000);
      hiss(t + len * k * k * rnd(0.9, 1.1), 'bandpass', f, f * 0.8, 3, vol * (1 - k * 0.8), rnd(0.02, 0.05), 0.001); }
  }

  // ================= THE SOUNDS =================
  const S = {
    swing: (t) => { hiss(t, 'bandpass', 450, 1900, 1.2, 0.32, 0.22, 0.07);  // air
                    hiss(t, 'lowpass', 600, 1100, 0.7, 0.12, 0.2, 0.05);  // cloth
                    sine(t + 0.03, 3100, 3000, 0.01, 0.18, 0.08);  // faint steel shimmer
                    sine(t + 0.03, 4650, 4500, 0.006, 0.16, 0.08); },
    hit:   (t) => impact(t, rnd(480, 620), 0.72),
    burn:  (t) => { swell(t, 'bandpass', 500, 3000, 0.8, 0.22, 0.28);  // shade air sucks in...
                    const h = t + 0.28;  // ...then the blade bites
                    metal(h, rnd(650, 760), CLANG, 0.04, 0.3); crack(h, 0.2); thump(h, 110, 0.16);
                    hiss(h, 'highpass', 3500, 2000, 0.7, 0.12, 0.4, 0.01); },  // sizzle as it burns
    flare: (t) => { swell(t, 'lowpass', 300, 3500, 0.9, 0.25, 0.3);  // light gathers...
                    hiss(t + 0.3, 'lowpass', 3500, 350, 0.8, 0.26, 0.55, 0.005);  // ...WHOOMF
                    thump(t + 0.3, 90, 0.22, 0.3); },
    ward:  (t) => { swell(t, 'bandpass', 300, 1400, 1, 0.16, 0.25);
                    const h = t + 0.25;
                    thump(h, 95, 0.38, 0.45);  // deep shield thud
                    hiss(h, 'lowpass', 500, 80, 1, 0.3, 0.3, 0.003);
                    metal(h, 150, BELL, 0.07, 1.4); },  // low hum of the ward
    bell:  (t) => { metal(t, rnd(150, 160), BELL, 0.2, 3); hiss(t, 'lowpass', 900, 300, 1, 0.08, 0.06, 0.002); },
    dawn:  (t) => { swell(t, 'bandpass', 400, 2400, 0.8, 0.08, 0.8);  // morning air rises
                    metal(t + 0.8, 220, WARM, 0.14, 2.6);  // one warm chime
                    sine(t + 0.8, 110, 110, 0.05, 2.6, 0.2); },  // soft low hum under it
    blip:  (t) => { hiss(t, 'bandpass', 1700, 1500, 4, 0.2, 0.03, 0.001);  // soft wooden tick (UI)
                    sine(t, 380, 340, 0.05, 0.05, 0.001); },

    chest: (t) => { creak(t, 0.45, rnd(600, 850), 3);  // old hinge creaks...
                    const h = t + 0.42;
                    hiss(h, 'lowpass', 900, 200, 1, 0.25, 0.12, 0.002);  // ...wooden lid thunk
                    thump(h, 120, 0.25, 0.15);
                    metal(h + 0.02, 1100, CLANG, 0.02, 0.2); },  // metal latch
    coin:  (t) => { const c = [[1, 1], [1.51, 0.6], [2.34, 0.35]];  // coins clink together
                    metal(t, rnd(880, 960), c, 0.07, 0.45); crack(t, 0.05, 5000);
                    metal(t + rnd(0.05, 0.09), rnd(840, 980), c, 0.035, 0.35); },
    pickup:(t) => { metal(t, 440, WARM, 0.12, 0.9); crack(t, 0.04, 3000);
                    hiss(t, 'lowpass', 800, 400, 0.7, 0.05, 0.12, 0.01); },  // hand grabs it
    gulp:  (t) => { for (let i = 0; i < 3; i++) {  // three swallows of liquid
                      const at = t + i * rnd(0.17, 0.22);
                      hiss(at, 'bandpass', 450, 1100, 6, 1.1, 0.09, 0.01);
                      thump(at, 90, 0.1, 0.08); } },
    stairs:(t) => { for (let i = 0; i < 4; i++) stoneStep(t + i * 0.16, 0.07 * (1 - i * 0.15), 1 - i * 0.1);
                    hiss(t + 0.1, 'bandpass', 1400, 250, 1.2, 0.1, 0.65, 0.15); }, // cloak whoosh going down
    ring:  (t) => { hiss(t, 'bandpass', 5000, 2500, 3, 0.12, 0.35, 0.02);  // blade slides out...
                    metal(t + 0.3, 330, CLANG, 0.05, 1.8);  // ...dark ringing steel
                    sine(t + 0.1, 55, 55, 0.22, 1.2, 0.4); sine(t + 0.1, 58, 58, 0.18, 1.2, 0.4); // cursed beat
                    swell(t, 'lowpass', 150, 700, 2, 0.1, 0.3); },
    roar:  (t) => { growl(t, [[300, 4], [750, 5], [1800, 6]], 32, 0.1, 1.1, 0.15, 55);
                    hiss(t, 'lowpass', 600, 150, 1, 0.12, 1.1, 0.1); },  // hot breath

    ember: (t) => { swell(t, 'bandpass', 400, 2500, 1.2, 0.12, 0.5);  // fire breathes in...
                    metal(t + 0.5, 196, WARM, 0.12, 1.8);  // ...warm glow chime
                    for (let i = 0; i < 4; i++) crack(t + 0.5 + rnd(0, 0.6), 0.04, 4000); }, // crackles
    relight:(t) => { swell(t, 'lowpass', 200, 3500, 1, 0.25, 0.4);  // flame gathers...
                    hiss(t + 0.4, 'lowpass', 3500, 300, 0.8, 0.24, 0.9, 0.01);  // ...big WHOOMF
                    thump(t + 0.4, 70, 0.16, 0.6);
                    metal(t + 0.45, 147, WARM, 0.12, 2.6); },  // low warm ring
    key:   (t) => { for (let i = 0; i < 3; i++)  // key ring jingles...
                      metal(t + i * rnd(0.04, 0.07), rnd(1100, 1500), CLANG, 0.02, 0.12);
                    metal(t + 0.16, 620, WARM, 0.07, 0.7); },  // ...and rings softly
    door:  (t) => { metal(t, 300, CLANG, 0.05, 0.25); crack(t, 0.15); thump(t, 110, 0.3, 0.2); // lock clunk
                    growl(t + 0.15, [[250, 1.2], [600, 2]], 11, 0.1, 1.1, 0.2, 40); },  // heavy stone grinds open

    stepGrass:(t) => { const n = 2 + (Math.random() < 0.5 ? 1 : 0);  // crunch = 2-3 tiny grains
                    for (let i = 0; i < n; i++) {
                      const at = t + i * rnd(0.012, 0.03), f = rnd(1800, 3200);
                      hiss(at, 'bandpass', f, f * 0.7, 1.2, rnd(0.06, 0.1), rnd(0.012, 0.025), 0.001); }
                    thump(t, 100, 0.02, 0.05); },
    stepStone:(t) => stoneStep(t, 0.06),
    wolfGrowl:(t) => growl(t, [[380, 5], [1000, 6]], 28, 0.1, 0.8, 0.15, 80),
    wolfLunge:(t) => { growl(t, [[700, 4], [1700, 5]], 40, 0.12, 0.35, 0.03, 120); // snarl...
                    hiss(t + 0.12, 'bandpass', 400, 2000, 1.2, 0.25, 0.25, 0.06); }, // ...and the leap
    clank:(t) => { metal(t, rnd(300, 420), PLATE, 0.07, 0.3); crack(t, 0.12, 4000); // armor plates
                    for (let i = 0; i < 2; i++) hiss(t + 0.03 + i * rnd(0.02, 0.05), 'bandpass', 6000, 5000, 3, 0.08, 0.015, 0.001); // mail rattle
                    thump(t, 90, 0.1, 0.1); },

    // ---- v4: summons and deaths ----
    summon:(t) => { const f = rnd(112, 128);  // far-off war horn: 3 slightly out-of-tune sines,
      drone(t, [[f, 1], [f * 1.007, 0.8], [f * 0.993, 0.7], [f * 2, 0.3]], 0.17, 1.4, 0.4, 4, 0.1, 0.94); // pitch pushes up
      hiss(t, 'bandpass', 380, 520, 1.5, 0.16, 1.3, 0.35);  // breath through the horn
      shimmer(t + 0.3, rnd(1700, 1900), 0.022, 1.3, 0.7); },  // cold blue spirit light
    allyDeath:(t) => { body(t, 75, 0.28, 0.25);  // armor slumps down...
      metal(t + 0.03, rnd(380, 460), PLATE, 0.05, 0.3);  // ...plates clank
      hiss(t + 0.1, 'bandpass', 1500, 350, 1, 0.14, 0.8, 0.1);  // last breath goes out
      shimmer(t + 0.45, rnd(1400, 1600), 0.01, 0.75, 0.15); },  // and the spirit fades
    wolfDeath:(t) => { hiss(t, 'bandpass', 950, 520, 6, 0.9, 0.28, 0.01);  // pained yelp = breath through
      hiss(t, 'bandpass', 2300, 1300, 7, 0.5, 0.24, 0.01);  // two "mouth" filters, falling
      sine(t, 560, 330, 0.025, 0.25, 0.01);  // a hint of voice
      body(t + 0.36, 85, 0.25, 0.3); },  // body hits the ground
    skeletonDeath:(t) => { const n = 5 + Math.floor(Math.random() * 4);  // 5-8 dry bone clacks
      for (let i = 0; i < n; i++) { const f = rnd(1600, 3400);
        hiss(t + rnd(0, 0.85), 'bandpass', f, f * 0.9, 6, rnd(0.5, 0.9), rnd(0.015, 0.03), 0.001); }
      metal(t + rnd(0.15, 0.3), rnd(420, 520), PLATE, 0.045, 0.35);  // two bits of armor
      metal(t + rnd(0.5, 0.7), rnd(320, 400), PLATE, 0.045, 0.35);
      body(t + 1, 85, 0.26, 0.3); },  // what is left lands, heavily
    wardenDeath:(t) => { drone(t, [[rnd(46, 54), 1], [75, 0.25]], 0.16, 1.9, 0.25, 2.5, 0.5, 1, 0.78); // deep groan
      hiss(t, 'lowpass', 320, 110, 1, 0.14, 1.8, 0.3);  // rumble of breath
      [0.35, 0.62, 0.95].forEach((d, i) => {  // armor crashes, piece by piece
        metal(t + d, rnd(200, 300) + i * 40, i === 1 ? CLANG : PLATE, 0.035, 0.5);
        crack(t + d, 0.1, 3000); thump(t + d, 110, 0.1, 0.12); });
      body(t + 1.35, 48, 0.3, 0.55);  // final heavy hit on the ground
      hiss(t + 1.35, 'lowpass', 400, 60, 0.8, 0.1, 0.6, 0.01); },
    shadeDissolve:(t) => { swell(t, 'bandpass', 400, 3500, 0.9, 0.2, 0.45);  // reversed whoosh rises...
      for (let i = 0; i < 22; i++) { const k = Math.random();  // ...then breaks into whispers
        grain(t + 0.45 + k * 0.7, rnd(3000, 7000), 0.12 * (1 - k * 0.8), rnd(0.01, 0.035), rnd(-0.9, 0.9)); }
      hiss(t + 0.45, 'highpass', 5000, 3000, 0.7, 0.04, 0.7, 0.01); },  // soft fading air

    // ---- v5: Lanternkin goblin horde ----
    horde:(t) => { const n = 10 + Math.floor(Math.random() * 5);  // 10-14 little voices
      for (let i = 0; i < n; i++) {  // each shouts 1-3 quick "hup"s, starting at a random moment
        let at = t + rnd(0, 1.1); const f = rnd(420, 720), form = rnd(800, 2500);
        for (let k = 0, m = 1 + Math.floor(Math.random() * 3); k < m; k++) {
          const len = rnd(0.07, 0.14); yip(at, f * rnd(0.95, 1.05), form, rnd(0.25, 0.45), len); at += len + rnd(0.03, 0.08); } }
      swell(t, 'bandpass', 500, 1600, 1.5, 0.1, 1.3);  // the whole group's shout rises
      growl(t + 0.4, [[700, 3], [1500, 4]], 9, 0.03, 1.1, 0.7);  // crowd murmur under it
      [0.3, 0.75, 1.2].forEach((d) => body(t + d, 90, 0.18, 0.18)); },  // stomp, stomp, stomp: charge!
    // goblinPop: up to 50 goblins can pop at once, so it guards itself (see pop below)
    goblinPop:(t) => { if (!pop(t)) return;
      hiss(t, 'highpass', 3500, 1800, 0.7, 0.09, 0.07, 0.002);  // tiny puff of dust
      hiss(t + 0.02, 'bandpass', 1800, 900, 4, 0.1, 0.2, 0.03);   // little sigh...
      sine(t + 0.02, 900, 620, 0.012, 0.2, 0.03); },  // ...with a faint squeak in it

    // ---- v6: slice 2, the Keep and the Hollow King ----
    altarLight:(t) => { swell(t, 'lowpass', 200, 2500, 1, 0.2, 0.35);  // fire breathes in...
      hiss(t + 0.35, 'lowpass', 2800, 250, 0.8, 0.22, 0.9, 0.01); thump(t + 0.35, 65, 0.25, 0.5);  // ...soft WHOOMPH
      [[146.8, 0.08], [220, 0.06], [293.7, 0.045], [370, 0.03]].forEach(([f, v], i) =>  // D major bell chord
        metal(t + 0.4 + i * 0.05, f, WARM, v, 2.2 - i * 0.1));  // blooms one note at a time
      sine(t + 0.4, 73.4, 73.4, 0.06, 1.8, 0.3);  // deep D hum under it
      hiss(t + 0.4, 'bandpass', 400, 3000, 1.2, 0.1, 1.6, 0.8); },  // column of warm air rising
    kingSlam:(t) => { sine(t, 60, 40, 0.3, 0.6, 0.003);  // sub THUMP you feel
      for (let i = 0; i < 3; i++) { const f = rnd(700, 1800);  // stone cracks: 3 quick bursts
        hiss(t + i * rnd(0.01, 0.03), 'bandpass', f, f * 0.6, 2, 0.28, 0.06, 0.001); }
      crack(t, 0.2, 2500); metal(t, rnd(260, 320), CLANG, 0.025, 0.35);  // the blade rings a little
      hiss(t, 'lowpass', 1200, 150, 0.8, 0.14, 0.9, 0.01);  // dust and rumble
      debris(t + 0.08, 12, 1, 0.14); },  // bits of stone rattle down
    kingRoar:(t) => { growl(t, [[220, 3], [450, 4], [800, 5]], 21, 0.09, 1.8, 0.3, 80);  // throat of a dead king
      drone(t, [[85, 1], [86.4, 0.8], [128, 0.4], [255, 0.15]], 0.07, 1.8, 0.35, 13, 0.6, 1.08, 0.85);  // growling low voice
      hiss(t + 0.2, 'bandpass', 320, 140, 3, 0.07, 2.2, 0.6); },  // hollow, echoing tail
    kingDeath:(t) => { drone(t, [[72, 1], [73.1, 0.8], [108, 0.3]], 0.1, 3, 0.3, 3, 0.5, 1, 0.6);  // long falling groan
      growl(t, [[250, 3], [520, 4]], 7, 0.04, 3, 0.4, 0);  // breath in the groan
      const c = t + 1.1;  // armor gives way, the crown falls and rolls
      [0, 0.18, 0.4].forEach((d) => { metal(c + d, rnd(220, 340), PLATE, 0.035, 0.4); crack(c + d, 0.08, 3000); });
      [0.25, 0.5, 0.68, 0.8, 0.88].forEach((d, i) => metal(c + d, rnd(950, 1050), BELL, 0.03 * (1 - i * 0.15), 0.5));
      body(t + 2, 45, 0.28, 0.6); debris(t + 2.05, 8, 0.7, 0.08);  // heavy collapse
      hiss(t + 2.4, 'bandpass', 1200, 300, 1, 0.1, 1.5, 0.2);  // ghostly last breath
      shimmer(t + 2.5, rnd(1300, 1500), 0.01, 1.2, 0.2); },
    doorGrind:(t) => { grind(t, 2.3, 380, 0.5);  // stone drags: stick, slip, stick...
      creak(t, 2.2, 160, 1.2);  // low groaning of the hinges
      sine(t, 45, 40, 0.08, 2.3, 0.4); hiss(t, 'lowpass', 120, 90, 0.7, 0.2, 2.3, 0.4);  // floor rumble
      body(t + 2.3, 60, 0.25, 0.3); metal(t + 2.3, 140, PLATE, 0.03, 0.5); },  // BOOM: fully open
    skelRise:(t) => { swell(t, 'bandpass', 200, 700, 2, 0.18, 1.1);  // low hollow whoosh, growing
      hiss(t, 'bandpass', 900, 1600, 2, 0.1, 0.9, 0.3);  // bones scraping up out of the stone
      for (let i = 0; i < 10; i++) { const k = i / 10, f = rnd(1600, 3400);  // dry clacks, coming faster and louder
        hiss(t + 1.1 * (1 - (1 - k) * (1 - k)), 'bandpass', f, f * 0.9, 6, 0.25 + k * 0.5, rnd(0.015, 0.03), 0.001); }
      metal(t + 1.05, rnd(380, 460), PLATE, 0.03, 0.25); },  // armor settles: standing
    shieldBlock:(t) => { thump(t, 110, 0.35, 0.15);  // solid thud of the wooden shield
      hiss(t, 'lowpass', 900, 300, 1, 0.3, 0.08, 0.001); crack(t, 0.15, 2500);
      metal(t, rnd(500, 600), PLATE, 0.04, 0.35); },  // short ring of the iron rim
    mageCast:(t) => { swell(t, 'bandpass', 300, 2500, 4, 0.4, 0.8);   // dark swirl winding up
      swell(t, 'bandpass', 1800, 600, 5, 0.18, 0.75);  // a second swirl turning the other way
      drone(t, [[98, 1], [99.4, 0.8], [147, 0.3]], 0.1, 0.85, 0.5, 7, 0.4, 0.95, 1.05); },  // low uneasy hum
    mageBoltHit:(t) => { hiss(t, 'bandpass', 2500, 800, 1.2, 0.3, 0.12, 0.001); thump(t, 140, 0.12, 0.1);  // burst
      sine(t, 1400, 300, 0.05, 0.3, 0.002);  // falling zap
      hiss(t, 'highpass', 4000, 2000, 0.7, 0.07, 0.45, 0.005);  // fizz
      for (let i = 0; i < 5; i++) crack(t + rnd(0.03, 0.4), 0.06, 3500); },  // sparks crackle out
    wizardDeath:(t) => { hiss(t, 'bandpass', 800, 450, 6, 0.7, 0.35, 0.02);  // pained gasp: breath through
      hiss(t, 'bandpass', 1900, 1100, 7, 0.35, 0.3, 0.02);  // two "mouth" filters, falling
      hiss(t + 0.25, 'bandpass', 500, 1400, 1, 0.12, 0.45, 0.2);  // robes whoosh as he falls
      [0.55, 0.68, 0.76].forEach((d, i) => {  // wooden staff knocks on the floor, 3 times
        const f = rnd(700, 1000); hiss(t + d, 'bandpass', f, f, 8, 0.6 - i * 0.15, 0.04, 0.001); thump(t + d, 180, 0.06, 0.06); });
      body(t + 0.62, 80, 0.24, 0.3);  // body hits the ground
      swell(t + 0.7, 'highpass', 5000, 2500, 0.8, 0.05, 0.25);  // his dark magic unravels...
      shimmer(t + 0.8, rnd(1100, 1300), 0.008, 0.6, 0.05); },  // ...and fades
    // ---- v8: Part 3 feel pass ----
    roll:(t) => { hiss(t, 'bandpass', 500, 1600, 1.1, 0.28, 0.22, 0.05);  // cloak whoosh
      hiss(t + 0.02, 'lowpass', 700, 1200, 0.7, 0.1, 0.2, 0.04);  // body air
      for (let i = 0; i < 2; i++) hiss(t + 0.05 + i * rnd(0.03, 0.06), 'bandpass', 5500, 4500, 3, 0.05, 0.015, 0.001);  // mail rattle
      body(t + 0.24, 95, 0.2, 0.12); },  // lands on the stone
    parry:(t) => { const f = rnd(1150, 1300), R = [[1, 1], [2.41, 0.55], [3.87, 0.35], [6.1, 0.2]];
      crack(t, 0.22, 3500); hiss(t, 'highpass', 6000, 4000, 0.7, 0.12, 0.05, 0.001);  // sharp steel-on-steel bite
      metal(t, f, R, 0.09, 0.6);  // bright ring...
      metal(t + 0.01, f * 1.5, R.slice(0, 2), 0.035, 0.5);  // ...and the other blade a fifth up (feels "right")
      thump(t, 160, 0.12, 0.08);
      hiss(t + 0.03, 'bandpass', 5000, 2500, 4, 0.08, 0.3, 0.01); },  // sparks
    critHit:(t) => { impact(t, rnd(420, 520), 0.7);
      sine(t, 70, 38, 0.26, 0.45, 0.003);  // low BOOM
      hiss(t, 'lowpass', 1400, 180, 0.8, 0.22, 0.3, 0.002);  // meaty crunch
      hiss(t, 'bandpass', 700, 300, 1.5, 0.28, 0.12, 0.002);
      metal(t + 0.05, rnd(2200, 2500), [[1, 1], [1.47, 0.6], [2.09, 0.4]], 0.02, 0.45); },  // high sparkle tail
    // shardPickup: many shards drop at once, so it guards itself like goblinPop
    shardPickup:(t) => { if (!limit(t, 'shard', 0.3)) return;
      const f = rnd(1500, 2300);  // random pitch: a burst becomes a sparkle run
      metal(t, f, [[1, 1], [2.76, 0.35], [5.4, 0.15]], 0.035, 0.3); crack(t, 0.03, 6000);
      sine(t + 0.04, f * 1.5, f * 1.5, 0.012, 0.22); },
    upgradeBuy:(t) => { drone(t, [[196, 1], [246.9, 0.8], [293.7, 0.7], [392, 0.35]], 0.06, 0.9, 0.4, 4, 0.1, 0.97);  // warm chord swells up
      swell(t, 'bandpass', 400, 2000, 1, 0.06, 0.4);  // warm air
      metal(t + 0.4, 587, BELL, 0.05, 0.6); },  // soft shrine bell
    wallBreak:(t) => { crack(t, 0.3, 1800);
      for (let i = 0; i < 4; i++) { const f = rnd(600, 1600); hiss(t + i * rnd(0.02, 0.05), 'bandpass', f, f * 0.6, 2, 0.3, 0.07, 0.001); }  // stone splits
      sine(t, 70, 42, 0.24, 0.5, 0.003);  // thud of the wall giving way
      grind(t + 0.05, 1.1, 500, 0.3);  // rubble tumbling
      hiss(t, 'lowpass', 900, 120, 0.8, 0.14, 1.2, 0.01);  // dust rumble
      debris(t + 0.15, 16, 1, 0.16); },
    loreNote:(t) => { for (let i = 0; i < 3; i++) hiss(t + i * rnd(0.07, 0.12), 'bandpass', rnd(2500, 4000), 1800, 1.2, 0.12, rnd(0.08, 0.14), 0.01);  // parchment crinkles
      hiss(t, 'highpass', 3000, 2000, 0.7, 0.04, 0.35, 0.05);  // paper slides open
      const f = rnd(92, 100); drone(t + 0.1, [[f, 1], [f * 1.06, 0.6], [f * 2.01, 0.2]], 0.05, 0.7, 0.3, 3, 0.4); },  // faint eerie tone
    kingIntro:(t) => { const f = rnd(40, 44), h = t + 2.3;  // kept controlled: it sits over the music
      swell(t, 'lowpass', 120, 900, 1, 0.2, 2.3);  // dread rises...
      drone(t, [[f, 1], [f * 1.5, 0.4], [f * 2, 0.25]], 0.12, 2.5, 1.6, 2, 0.3);  // deep drone swelling
      drone(t + 0.5, [[110, 1], [116.5, 0.8], [123.5, 0.6], [155.6, 0.4]], 0.035, 2, 1.3, 5, 0.3);  // low dissonant cluster
      sine(h, 62, 34, 0.22, 0.8, 0.003); body(h, 55, 0.14, 0.5); crack(h, 0.12, 2000);  // ...final heavy HIT
      metal(h, rnd(180, 220), PLATE, 0.03, 0.9); hiss(h, 'lowpass', 1000, 80, 0.8, 0.14, 0.8, 0.005); },
    lockOn:(t) => { hiss(t, 'bandpass', 3200, 2800, 5, 0.15, 0.025, 0.001); sine(t, 1250, 1100, 0.02, 0.07, 0.001); },  // soft tick
    staminaOut:(t) => { hiss(t, 'bandpass', 1400, 500, 2.5, 0.35, 0.3, 0.02);  // tired "hhuh" through the mouth
      hiss(t, 'lowpass', 900, 250, 0.8, 0.1, 0.28, 0.02); },
    // telegraph: enemy wind-up warning "shing" (rate-limited: 1 per 80 ms, max 2 at once)
    telegraph:(t) => { if (!limit(t, 'tele', 0.25, 0.08, 2)) return;
      hiss(t, 'bandpass', 3000, 7000, 4, 0.7, 0.2, 0.02);  // blade drawn: high scrape sweeping up
      hiss(t + 0.02, 'highpass', 6500, 5000, 0.7, 0.12, 0.16, 0.03);  // glint air
      sine(t + 0.05, 2900, 3150, 0.09, 0.2, 0.004); },  // thin ping rising
    poiseBreak:(t) => { crack(t, 0.25, 2000);  // armor cracks...
      for (let i = 0; i < 3; i++) { const f = rnd(1200, 2600); hiss(t + i * rnd(0.015, 0.035), 'bandpass', f, f * 0.7, 3, 0.25, 0.05, 0.001); }
      metal(t, rnd(260, 320), PLATE, 0.05, 0.4);  // dented plate
      thump(t, 100, 0.22, 0.18);  // low thud
      sine(t + 0.06, 180, 70, 0.08, 0.45, 0.03);  // groaning drop as he reels
      hiss(t + 0.05, 'bandpass', 700, 300, 3, 0.1, 0.4, 0.04); },
  };
  // goblinPop rate limit: per audio context, remember when the last pop started and when the
  // playing ones end. Say "no" if the last was under 60 ms ago or 4 are still playing.
  // (v8: shared with shardPickup, each with its own counter)
  function limit(t, k, len, gap = 0.06, max = 4) {
    const r = rig(AC), q = r['q' + k] || (r['q' + k] = { last: -1, ends: [] });
    q.ends = q.ends.filter((e) => e > t);
    if (t - q.last < gap || q.ends.length >= max) return false;
    q.last = t; q.ends.push(t + len); return true;
  }
  const pop = (t) => limit(t, 'pop', 0.25);
  S.step = S.stepStone;  // old name still works
  const DRY = { blip: 1 };  // menu sounds skip the reverb

  // when (optional) = exact time to play; normally "right now"
  api.play = function (ac, name, when) {
    try {
      if (!ac || !S[name] || !api.enabled) return;
      const offline = typeof OfflineAudioContext !== 'undefined' && ac instanceof OfflineAudioContext;
      if (ac.state !== 'running' && !offline) return;
      const r = rig(ac);
      AC = ac; OUT = DRY[name] ? r.g : r.bus;
      P = rnd(0.94, 1.06); V = rnd(0.85, 1.15);  // never exactly the same twice
      S[name](when !== undefined ? when : ac.currentTime + 0.005);
    } catch (e) {}
  };
  api.setSpace = function (s) {  // 'forest' | 'castle' | 'keep' | 'none': 1 s crossfade of the echo
    if (!SPACES[s]) return;
    api.space = s;
    for (const r of rigs) {
      try { plugRooms(r); r.wet.forEach((w, i) => w.gain.setTargetAtTime(SPACES[s][i], r.ac.currentTime, 0.3)); } catch (e) {}
    }
  };
  api.setVolume = function (v) {
    api.volume = Math.max(0, Math.min(1, +v || 0)); save('gravelight-realm.sfxVol', api.volume); applyVolume();
  };
  api.toggle = function (on) {  // toggle() flips; toggle(true/false) sets it
    api.enabled = on === undefined ? !api.enabled : !!on;
    save('gravelight-realm.sfxOn', api.enabled ? 'on' : 'off'); applyVolume(); return api.enabled;
  };
  // v8: SFX.roll(), SFX.parry()... (optional: SFX.roll(ctx, when)). With no context they use the last one
  // SFX.play saw, else game.js's `audio`. Still silent until that context is running (first tap).
  const ctxOf = (ac) => { if (ac && ac.createGain) return ac; if (rigs.length) return rigs[rigs.length - 1].ac;
    try { return typeof audio !== 'undefined' && audio && audio.createGain ? audio : null; } catch (e) { return null; } };
  ['roll', 'parry', 'critHit', 'shardPickup', 'upgradeBuy', 'wallBreak', 'loreNote', 'kingIntro', 'lockOn', 'staminaOut', 'telegraph', 'poiseBreak']
    .forEach((n) => { api[n] = (ac, when) => api.play(ctxOf(ac), n, when); });
  api.names = Object.keys(S);
  return api;
})();

// make it visible to game.js (a top-level const is not on window)
window.SFX = SFX;
