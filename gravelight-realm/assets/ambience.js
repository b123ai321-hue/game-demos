// ============================================================
// GRAVELIGHT: REALM AMBIENCE - background sounds of the world,
// original, made in code with Web Audio (no sound files).
//   forest = wind through pines, far-away owls, creaking branches
//   castle = cold empty wind, a low room rumble, drips, far chains
//   keep   = cold stone hall: wind moaning through arrow slits, a deep hall hum,
//            dripping water, a far chain rattle or creak every 8-20 s   (v4)
//   throne = the keep, darker, plus a low crackling brazier fire bed   (v4)
// It stays quiet (peaks around 0.2) so music and SFX sit on top.
//
// Ambience.start(ac)       start (after a tap). Safe to call twice.
// Ambience.setZone(name)   'forest' | 'castle' | 'keep' | 'throne' | 'none' (2 s crossfade)
//                          also sets the SFX room echo: SFX.setSpace(name) ('throne' -> 'keep')
// Ambience.setBraziers(on) true/false: the throne room fire crackle (false in phase 3). 1 s fade.
// Ambience.setMist(x)     0..1 cursed-mist layer ON TOP of the zone (1.5 s fade).
//                          Cheap to call every frame; 0 = silent and no cost.
// Ambience.setVolume(v)    0..1     Ambience.toggle() / toggle(true|false)
// Ambience.enabled, Ambience.volume, Ambience.zone, Ambience.stop()
// Saved in localStorage: gravelight-realm.ambVol / gravelight-realm.ambOn
// (if ambOn was never saved, it copies the Sound FX on/off setting)
// Nothing plays until the AudioContext is running (after the first tap).
// ============================================================
const Ambience = (() => {
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const sfxOff = window.SFX && !window.SFX.enabled;
  const api = {
    enabled: load('gravelight-realm.ambOn', sfxOff ? 'off' : 'on') !== 'off',
    volume: Math.max(0, Math.min(1, +load('gravelight-realm.ambVol', 0.8) || 0)),
    zone: 'forest',
  };
  const FADE = 2;                                   // zone crossfade in seconds
  const rnd = (a, b) => a + Math.random() * (b - a);

  let ac = null, master = null, buf = null, timer = null;
  let cur = null, old = null;                       // playing zone, and the one fading out
  let braziers = true;                              // are the throne room fires burning?
  let mist = null, mistX = 0;                       // cursed-mist layer and how strong it is (0..1)

  const offline = (c) => typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext;
  const ready = () => ac && (ac.state === 'running' || offline(ac));

  // ONE 2 s noise buffer, looped. Played at odd speeds + filters so the repeat is never heard.
  function noiseSrc(rate) {
    if (!buf) {
      buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = ac.createBufferSource(); n.buffer = buf; n.loop = true; n.playbackRate.value = rate;
    return n;
  }
  // noise -> filter -> gain -> zone. Returns the parts so we can sweep them.
  function windLayer(z, t, rate, type, freq, q, vol) {
    const n = noiseSrc(rate), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    n.connect(f).connect(g).connect(z.gain); n.start(t, Math.random() * 2);
    z.srcs.push(n); return { f, g };
  }
  // a sound that goes left or right (StereoPanner is missing on some old Safari: then just centre)
  function panned(z, pan) {
    if (!ac.createStereoPanner) return z.gain;
    const p = ac.createStereoPanner(); p.pan.value = pan; p.connect(z.gain); return p;
  }
  function env(g, t, vol, attack, len) {            // soft rise, then fade away
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  }
  function sine(dest, t, f1, f2, vol, attack, len, type = 'sine') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + len);
    env(g, t, vol, attack, len); o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.05);
    return o;
  }

  // ---- one-off events ----
  function owl(z, t) {                               // "hoo ... hoo-oo", far away
    const out = panned(z, rnd(-0.8, 0.8)), f = rnd(330, 420), v = rnd(0.03, 0.05);
    sine(out, t, f, f * 0.94, v, 0.08, 0.38);
    sine(out, t + 0.55, f * 0.9, f * 0.82, v * 0.9, 0.1, 0.6);
  }
  function creak(z, t) {                             // old branch groaning in the wind
    const out = panned(z, rnd(-0.7, 0.7)), bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = rnd(700, 1200); bp.Q.value = 5; bp.connect(out);
    const times = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < times; i++) {
      const at = t + i * rnd(0.5, 0.8), len = rnd(0.3, 0.6), f = rnd(140, 260);
      const o = sine(bp, at, f, f * rnd(0.7, 1.3), 0.05, 0.08, len, 'sawtooth');
      const lfo = ac.createOscillator(), d = ac.createGain();   // wobble = the creaky "rrrk"
      lfo.frequency.value = rnd(9, 18); d.gain.value = f * 0.12;
      lfo.connect(d).connect(o.frequency); lfo.start(at); lfo.stop(at + len + 0.05);
    }
  }
  function drip(z, t) {                              // "plink" + two quieter echoes
    const out = panned(z, rnd(-0.6, 0.6)), f = rnd(900, 1500);
    [1, 0.35, 0.12].forEach((k, i) => sine(out, t + i * 0.21, f, f * 1.9, 0.045 * k, 0.003, 0.09));
  }
  function chains(z, t) {                            // metal links rattling, far off
    const out = panned(z, rnd(-0.8, 0.8)), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3000; lp.connect(out);
    let at = t;
    for (let i = 0, n = 5 + Math.floor(Math.random() * 6); i < n; i++) {
      const f = rnd(1400, 2600);
      sine(lp, at, f, f * 0.98, 0.018, 0.002, 0.12, 'triangle');
      sine(lp, at, f * 2.43, f * 2.4, 0.008, 0.002, 0.07);        // "wrong" overtone = metal
      at += rnd(0.04, 0.14);
    }
  }

  function farThing(z, t) {                          // keep: sometimes a chain, sometimes a creak
    (Math.random() < 0.55 ? chains : creak)(z, t);
  }
  function crackle(z, t) {                           // brazier: a few tiny fire pops
    if (!braziers) return;
    for (let i = 0, n = 1 + Math.floor(Math.random() * 4); i < n; i++) {
      const at = t + rnd(0, 0.5), bp = ac.createBiquadFilter(), g = ac.createGain(), s = noiseSrc(1);
      bp.type = 'bandpass'; bp.frequency.value = rnd(1500, 4000); bp.Q.value = 1.5;
      env(g, at, rnd(0.03, 0.08), 0.001, rnd(0.01, 0.03));
      s.connect(bp).connect(g).connect(panned(z, rnd(-0.5, 0.5))); s.start(at, Math.random() * 2); s.stop(at + 0.06);
    }
  }
  // keep hall: build it; dark = the throne room (lower, darker, with a fire bed)
  function keepBuild(z, t, dark) {
    z.a = windLayer(z, t, 0.5, 'bandpass', dark ? 450 : 650, 9, 0.22);   // wind moaning through arrow slits
    z.b = windLayer(z, t, 0.2, 'lowpass', dark ? 65 : 80, 0.7, 0.8);     // deep hall hum
    if (dark) z.fire = windLayer(z, t, 0.8, 'lowpass', 380, 0.7, braziers ? 0.12 : 0.0001);  // soft fire roar
  }
  function keepSweep(z, t, dark) {
    const tc = rnd(2, 4);
    z.a.f.frequency.setTargetAtTime(rnd(350, dark ? 700 : 1000), t, tc);
    z.a.g.gain.setTargetAtTime(rnd(0.06, 0.3), t, tc);
    z.b.g.gain.setTargetAtTime(rnd(0.6, 0.95), t, tc);
    if (z.fire && braziers) z.fire.g.gain.setTargetAtTime(rnd(0.08, 0.16), t, 0.5);  // fire flickers
    return rnd(2.5, 6);
  }

  // ---- the zones: build(z, t) makes the steady wind, sweep() moves it, events() adds one-offs ----
  const ZONES = {
    forest: {
      build(z, t) {
        z.a = windLayer(z, t, 1, 'bandpass', 500, 0.6, 0.35);       // body of the wind
        z.b = windLayer(z, t, 0.77, 'bandpass', 2000, 2.5, 0.05);   // hiss through the needles
      },
      sweep(z, t) {                                                 // gusts: pick new random targets
        const tc = rnd(0.8, 2);
        z.a.f.frequency.setTargetAtTime(rnd(300, 900), t, tc);
        z.a.g.gain.setTargetAtTime(rnd(0.2, 0.6), t, tc);
        z.b.f.frequency.setTargetAtTime(rnd(1500, 3200), t, tc);
        z.b.g.gain.setTargetAtTime(rnd(0.02, 0.1), t, tc);
        return rnd(1.5, 4);                                         // next sweep in 1.5-4 s
      },
      events: [[owl, 8, 20], [creak, 10, 25]],                      // [sound, min gap, max gap] seconds
    },
    castle: {
      build(z, t) {
        z.a = windLayer(z, t, 0.6, 'bandpass', 900, 7, 0.25);       // thin cold whistle
        z.b = windLayer(z, t, 0.25, 'lowpass', 90, 0.7, 0.7);       // low room rumble
      },
      sweep(z, t) {
        const tc = rnd(1.5, 3);
        z.a.f.frequency.setTargetAtTime(rnd(500, 1400), t, tc);
        z.a.g.gain.setTargetAtTime(rnd(0.08, 0.35), t, tc);
        z.b.g.gain.setTargetAtTime(rnd(0.5, 0.9), t, tc);
        return rnd(2, 5);
      },
      events: [[drip, 5, 14], [chains, 14, 30]],
    },
    keep: {
      build: (z, t) => keepBuild(z, t, false),
      sweep: (z, t) => keepSweep(z, t, false),
      events: [[drip, 3, 10], [farThing, 8, 20]],
    },
    throne: {
      build: (z, t) => keepBuild(z, t, true),
      sweep: (z, t) => keepSweep(z, t, true),
      events: [[drip, 5, 14], [farThing, 8, 20], [crackle, 0.25, 0.9]],
    },
  };

  function makeZone(name, t) {
    const z = { name, def: ZONES[name], srcs: [], gain: ac.createGain() };
    z.gain.connect(master);
    z.gain.gain.setValueAtTime(0.0001, t); z.gain.gain.linearRampToValueAtTime(1, t + FADE);
    z.def.build(z, t);
    z.nextSweep = t + 0.5;
    z.next = z.def.events.map(([, lo, hi]) => t + rnd(lo * 0.4, hi * 0.6));  // first ones come a bit sooner
    return z;
  }
  function dropZone(z, t) {                         // fade out, then stop and unplug
    const g = z.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); g.linearRampToValueAtTime(0.0001, t + FADE);
    z.srcs.forEach((s) => { try { s.stop(t + FADE + 0.1); } catch (e) {} });
    z.end = t + FADE + 0.2;
  }


  // ================= CURSED MIST (a layer on top of the zone) =================
  // Low sines a tiny bit out of tune "beat" (wom-wom-wom), a breathy noise swell
  // like whispering, and every 6-15 s a backwards-sounding swell or a far low bell.
  // Only exists while mist > 0.
  function makeMist(t) {
    const m = { gain: ac.createGain(), oscs: [], srcs: [] };
    m.gain.gain.value = 0.0001; m.gain.connect(master);
    const low = ac.createGain(); low.gain.value = 0.05; low.connect(m.gain);
    for (const f of [73.4, 74.1, 110]) {                // D, D a bit sharp, A = slow beating
      const o = ac.createOscillator(); o.frequency.value = f; o.connect(low); o.start(t); m.oscs.push(o);
    }
    m.breath = windLayer(m, t, 0.9, 'bandpass', 900, 4, 0.05);   // the whisper
    m.nextSweep = t; m.nextEvt = t + rnd(3, 8);
    return m;
  }
  function swell(m, t) {                                 // fades IN slowly, stops suddenly = sounds reversed
    const f = [110, 131, 147, 165][Math.floor(Math.random() * 4)], out = panned(m, rnd(-0.6, 0.6));
    for (const k of [1, 1.5, 2.01]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f * k;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 / k, t + 1.8);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.9);
      o.connect(g).connect(out); o.start(t); o.stop(t + 2);
    }
  }
  function lowBell(m, t) {                               // far away funeral bell ("wrong" overtones = metal)
    const out = panned(m, rnd(-0.7, 0.7)), f = rnd(85, 110);
    for (const [k, v] of [[1, 0.06], [2.02, 0.03], [2.74, 0.02]]) sine(out, t, f * k, f * k * 0.99, v, 0.01, 3.5 / k);
  }
  function mistTick(now) {
    if (!mist && mistX > 0) { mist = makeMist(now); fadeMist(now); }
    if (!mist) return;
    if (mistX === 0 && now > mist.off) {                 // faded out: stop everything, zero cost
      mist.oscs.concat(mist.srcs).forEach((o) => { try { o.stop(); } catch (e) {} });
      try { mist.gain.disconnect(); } catch (e) {} mist = null; return;
    }
    if (now >= mist.nextSweep) {                         // the whisper breathes in and out
      const tc = rnd(0.6, 1.5);
      mist.breath.f.frequency.setTargetAtTime(rnd(500, 1800), now, tc);
      mist.breath.g.gain.setTargetAtTime(rnd(0.01, 0.09), now, tc);
      mist.nextSweep = now + rnd(1.2, 3);
    }
    if (now >= mist.nextEvt) {
      if (api.enabled && mistX > 0.2) (Math.random() < 0.6 ? swell : lowBell)(mist, now + 0.1);
      mist.nextEvt = now + rnd(6, 15);
    }
  }
  function fadeMist(t) {            // ~1.5 s glide
    const g = mist.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t);
    g.setTargetAtTime(Math.max(mistX, 0.0001), t, 0.45);
    mist.off = t + 2.5;
  }

  // ---- runs 4 times a second: book what happens in the next moment ----
  function tick(now) {
    if (!cur && ZONES[api.zone]) cur = makeZone(api.zone, now + 0.05);
    if (cur) {
      if (now >= cur.nextSweep) cur.nextSweep = now + cur.def.sweep(cur, now);
      cur.def.events.forEach(([fn, lo, hi], i) => {
        if (now >= cur.next[i]) { if (api.enabled) fn(cur, now + rnd(0.05, 0.3)); cur.next[i] = now + rnd(lo, hi); }
      });
    }
    mistTick(now);
    if (old && now > old.end) { try { old.gain.disconnect(); } catch (e) {} old = null; }
  }
  function pump() { if (ready()) tick(ac.currentTime); }

  function level() { return api.enabled ? api.volume * 0.6 : 0; }
  function applyVolume() {
    if (!master) return;
    master.gain.setTargetAtTime(level(), ac.currentTime, 0.1);
  }
  api.start = function (ctx) {
    if (!ctx) return;
    if (ac === ctx && timer) return;                // already running
    if (ac) api.stop();
    ac = ctx; buf = null; cur = old = mist = null;
    master = ac.createGain(); master.gain.value = level(); master.connect(ac.destination);
    timer = setInterval(pump, 250); pump();
  };
  api.setZone = function (name) {
    if (name !== 'none' && !ZONES[name]) return;
    try { if (window.SFX && window.SFX.setSpace) window.SFX.setSpace(name === 'throne' ? 'keep' : name); } catch (e) {}  // SFX echo follows the zone
    if (name === api.zone) return;
    api.zone = name;
    if (!ac || !cur && !ready()) return;            // not playing yet: start() will use the new zone
    const t = ac.currentTime;
    if (old) { try { old.gain.disconnect(); } catch (e) {} }
    old = cur; if (old) dropZone(old, t);
    cur = ZONES[name] ? makeZone(name, t + 0.02) : null;
  };
  api.setMist = function (x) {
    x = Math.max(0, Math.min(1, +x || 0));
    if (Math.abs(x - mistX) < 0.02 && !(x === 0 && mistX > 0)) return;   // tiny change: ignore
    mistX = x;
    if (mist && ready()) fadeMist(ac.currentTime);      // no mist yet? tick() builds it
    else if (ready()) mistTick(ac.currentTime);
  };
  api.setBraziers = function (on) {                // phase 3: the King snuffs the fires
    braziers = !!on;
    for (const z of [cur, old]) if (z && z.fire && ready()) z.fire.g.gain.setTargetAtTime(braziers ? 0.12 : 0.0001, ac.currentTime, 0.3);
  };
  api.setVolume = function (v) {
    api.volume = Math.max(0, Math.min(1, +v || 0)); save('gravelight-realm.ambVol', api.volume); applyVolume();
  };
  api.toggle = function (on) {                     // toggle() flips; toggle(true/false) sets it
    api.enabled = on === undefined ? !api.enabled : !!on;
    save('gravelight-realm.ambOn', api.enabled ? 'on' : 'off'); applyVolume(); return api.enabled;
  };
  api.stop = function () {
    if (!ac) return;
    clearInterval(timer); timer = null;
    const t = ac.currentTime, m = master;
    if (mist) mist.oscs.forEach((o) => { try { o.stop(t + 0.5); } catch (e) {} });
    for (const z of [cur, old, mist]) if (z) z.srcs.forEach((s) => { try { s.stop(t + 0.5); } catch (e) {} });
    m.gain.setTargetAtTime(0.0001, t, 0.1);
    setTimeout(() => { try { m.disconnect(); } catch (e) {} }, 800);
    ac = null; master = null; cur = old = mist = null;
  };
  // for tests (offline rendering): pretend the clock ran from 0 to "until"
  api._run = function (until, from = 0) { for (let t = from; t < until; t += 0.25) tick(t); };
  return api;
})();

// make it visible to game.js (a top-level const is not on window)
window.Ambience = Ambience;
