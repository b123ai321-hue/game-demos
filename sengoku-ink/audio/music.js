/*! Sengoku Ink music player — dependency-free, WebKit-friendly.
 * Prefers Web Audio (decodeAudioData + looping AudioBufferSourceNode with
 * exact loopStart/loopEnd to dodge MP3 encoder padding). Falls back to
 * <audio loop> if fetch fails (e.g. file:// without MUSIC_DATA).
 * Nothing plays until unlock() after a user tap (iPhone autoplay rule).
 * Tracks: title, map, battle, victory.
 */
(function (global) {
  "use strict";

  var LOOP_END = {"title": 70.2439, "map": 63.157891, "battle": 64.0, "victory": 48.0};
  var NAMES = ["title", "map", "battle", "victory"];
  var BASE = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      if (s) return s.replace(/\/[^/]*$/, "/");
    } catch (e) {}
    return "audio/";
  })();

  var ctx = null;
  var master = null;
  var unlocked = false;
  var buffers = {};       // name -> AudioBuffer
  var current = null;      // {name, src, gain}
  var nextFade = null;
  var volume = 0.7;
  var usingElement = false;
  var el = null;           // HTMLAudioElement fallback
  var pendingName = null;

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    return ctx;
  }

  function b64ToArrayBuffer(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function dataUrlToBuf(dataUrl) {
    var i = dataUrl.indexOf(",");
    return b64ToArrayBuffer(dataUrl.slice(i + 1));
  }

  function loadOne(name) {
    return new Promise(function (resolve, reject) {
      if (buffers[name]) return resolve(buffers[name]);
      var data = global.MUSIC_DATA && global.MUSIC_DATA[name];
      function decode(ab) {
        ensureCtx();
        if (!ctx) return reject(new Error("no AudioContext"));
        ctx.decodeAudioData(ab.slice(0), function (buf) {
          buffers[name] = buf;
          resolve(buf);
        }, function (err) { reject(err || new Error("decode fail")); });
      }
      if (data) {
        try { decode(dataUrlToBuf(data)); } catch (e) { reject(e); }
        return;
      }
      var url = BASE + name + ".mp3";
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error("fetch " + url + " " + r.status);
        return r.arrayBuffer();
      }).then(decode).catch(reject);
    });
  }

  function stopSource(entry, fade) {
    if (!entry) return;
    var g = entry.gain;
    var s = entry.src;
    var t = ctx ? ctx.currentTime : 0;
    try {
      if (g && fade && ctx) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0.0001, t + fade);
        setTimeout(function () {
          try { s.stop(); } catch (e) {}
          try { s.disconnect(); g.disconnect(); } catch (e) {}
        }, fade * 1000 + 40);
      } else {
        try { s.stop(); } catch (e) {}
        try { s.disconnect(); g.disconnect(); } catch (e) {}
      }
    } catch (e) {}
  }

  function startBuffer(name, fadeIn) {
    ensureCtx();
    var buf = buffers[name];
    if (!buf || !ctx) return;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = LOOP_END[name] || buf.duration;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + (fadeIn || 0.01));
    src.connect(g);
    g.connect(master);
    src.start(0);
    current = { name: name, src: src, gain: g };
  }

  function playElement(name) {
    usingElement = true;
    if (!el) {
      el = document.createElement("audio");
      el.loop = true;
      el.preload = "auto";
      el.setAttribute("playsinline", "");
      el.style.display = "none";
      document.body.appendChild(el);
    }
    var data = global.MUSIC_DATA && global.MUSIC_DATA[name];
    el.src = data || (BASE + name + ".mp3");
    el.volume = volume;
    var p = el.play();
    if (p && p.catch) p.catch(function () {});
    current = { name: name, src: null, gain: null };
  }

  var Music = {
    unlock: function () {
      if (unlocked) {
        if (ctx && ctx.state === "suspended") ctx.resume();
        return;
      }
      unlocked = true;
      ensureCtx();
      if (ctx && ctx.state === "suspended") ctx.resume();
      // preload all
      NAMES.forEach(function (n) {
        loadOne(n).catch(function () { /* fallback path later */ });
      });
      if (pendingName) {
        var n = pendingName;
        pendingName = null;
        Music.play(n);
      }
    },

    play: function (name) {
      if (NAMES.indexOf(name) < 0) return;
      if (!unlocked) {
        pendingName = name;
        return;
      }
      ensureCtx();
      if (usingElement || !ctx) {
        if (current && current.name === name) return;
        playElement(name);
        return;
      }
      if (current && current.name === name) return;

      var fade = 0.7;
      var prev = current;
      loadOne(name).then(function () {
        if (ctx.state === "suspended") ctx.resume();
        stopSource(prev, fade);
        startBuffer(name, fade);
      }).catch(function () {
        // fetch/decode failed — element fallback
        stopSource(prev, 0.01);
        playElement(name);
      });
    },

    stop: function () {
      pendingName = null;
      if (usingElement && el) {
        try { el.pause(); el.removeAttribute("src"); el.load(); } catch (e) {}
        current = null;
        return;
      }
      stopSource(current, 0.4);
      current = null;
    },

    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, +v || 0));
      if (master) master.gain.value = volume;
      if (el) el.volume = volume;
    },

    _meta: LOOP_END
  };

  global.Music = Music;
})(typeof window !== "undefined" ? window : this);
