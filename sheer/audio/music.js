/*!
 * SHEER: a silent climb -- music player (tracks are original, synthesized in code).
 * window.Music = { play(name), stop(), setVolume(v), unlock() }
 *  - Web Audio first: decode once, loop an AudioBufferSourceNode with loopEnd set
 *    to the exact bar-length loop (trims MP3 encoder padding => gapless loops).
 *  - Crossfades between tracks.
 *  - Uses window.MUSIC_DATA (base64 data URLs from music-data.js) when present, so it
 *    works from . Otherwise fetches audio/<name>.mp3 next to this script.
 *  - Falls back to a hidden <audio loop> element if fetch/decode fails.
 *  - Silent until unlock() is called from the first tap/click (iPhone rule).
 *  - Keeps at most two decoded tracks in memory (phones).
 */
var Music = (function () {
  "use strict";
  var LOOP_END = {"title": 82.285714, "trek": 75.0, "climb": 60.0, "summit": 66.666667}; // seconds, exact loop lengths
  var FADE = 1.6;
  var AC = window.AudioContext || window.webkitAudioContext;
  var BASE = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/[^\/]*$/, "") : "audio/";
  })();
  var ctx = null, master = null, unlocked = false, volume = 0.8;
  var buffers = {}, loading = {}, cur = null, pending = null, want = null, token = 0, mode = AC ? "webaudio" : "element";

  function getCtx() {
    if (!ctx && AC) {
      try { ctx = new AC(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination); }
      catch (e) { ctx = null; mode = "element"; }
    }
    return ctx;
  }
  function dataUrl(name) { return window.MUSIC_DATA && window.MUSIC_DATA[name]; }
  function b64ToBuf(url) {
    var bin = atob(url.slice(url.indexOf(",") + 1)), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function getBytes(name) {
    var d = dataUrl(name);
    if (d) return Promise.resolve(b64ToBuf(d));
    if (!window.fetch) return Promise.reject(new Error("no fetch"));
    return fetch(BASE + name + ".mp3").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    });
  }
  function decode(ab) {          // promise + callback forms (older Safari)
    return new Promise(function (res, rej) {
      var p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  function load(name) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (!loading[name]) {
      loading[name] = getBytes(name).then(decode).then(function (b) {
        delete loading[name];
        for (var k in buffers) if (k !== name && (!cur || k !== cur.name)) delete buffers[k];
        buffers[name] = b; return b;
      }, function (e) { delete loading[name]; throw e; });
    }
    return loading[name];
  }
  function startWeb(name, buf) {
    var now = ctx.currentTime, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.loop = true; src.loopStart = 0;
    src.loopEnd = Math.min(LOOP_END[name] || buf.duration, buf.duration);
    g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(1, now + FADE);
    src.connect(g); g.connect(master); src.start(now);
    return { name: name, kind: "web", src: src, gain: g };
  }
  function startEl(name) {
    var a = document.createElement("audio");
    a.loop = true; a.preload = "auto"; a.setAttribute("playsinline", "");
    a.src = dataUrl(name) || (BASE + name + ".mp3");
    a.volume = volume;
    var p = a.play(); if (p && p.catch) p.catch(function () {});
    return { name: name, kind: "el", el: a };
  }
  function stopVoice(v, fade) {
    if (!v) return;
    if (v.kind === "web") {
      try {
        var now = ctx.currentTime, gg = v.gain.gain;
        gg.cancelScheduledValues(now); gg.setValueAtTime(gg.value, now);
        gg.linearRampToValueAtTime(0, now + fade); v.src.stop(now + fade + 0.05);
      } catch (e) {}
    } else {
      var a = v.el, steps = 10, i = 0, v0 = a.volume;
      var iv = setInterval(function () {
        i++; try { a.volume = Math.max(0, v0 * (1 - i / steps)); } catch (e) {}
        if (i >= steps) { clearInterval(iv); a.pause(); a.removeAttribute("src"); try { a.load(); } catch (e) {} }
      }, fade * 100);
    }
  }
  function swap(next) { var old = cur; cur = next; pending = null; stopVoice(old, FADE); }

  function play(name) {
    if (!Object.prototype.hasOwnProperty.call(LOOP_END, name)) return;
    want = name;
    if (!unlocked) return;                          // starts on unlock()
    if ((cur && cur.name === name) || pending === name) return;
    var my = ++token; pending = name;
    if (mode === "webaudio" && getCtx()) {
      if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function () {});
      load(name).then(function (buf) {
        if (my === token) swap(startWeb(name, buf));
      }, function () {
        if (my !== token) return;
        mode = "element"; swap(startEl(name));
      });
    } else {
      swap(startEl(name));
    }
  }
  function stop() {
    want = null; pending = null; token++;
    stopVoice(cur, 0.8); cur = null;
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    if (cur && cur.kind === "el") cur.el.volume = volume;
  }
  function unlock() {                                // call from a tap/click handler
    if (getCtx()) {
      if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function () {});
      try {                                          // tiny silent buffer: iOS unlock
        var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050);
        s.connect(ctx.destination); s.start(0);
      } catch (e) {}
    }
    if (!unlocked) { unlocked = true; if (want) play(want); }
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && unlocked && ctx && ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function () {});
  });
  return {
    play: play, stop: stop, setVolume: setVolume, unlock: unlock,
    tracks: Object.keys(LOOP_END), loopEnd: LOOP_END,
    _state: function () {
      return { unlocked: unlocked, mode: mode, current: cur && cur.name, pending: pending,
               ctx: ctx ? ctx.state : null, cached: Object.keys(buffers) };
    }
  };
})();
window.Music = Music;
