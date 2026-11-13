// ============================================================
// GRAVELIGHT - a tiny dark fantasy survival game
// Plain JavaScript + <canvas>. Art and sounds are Game Artist's,
// drawn and synthesized in code (assets/sprites.js, assets/sfx.js).
// ============================================================

// ---------- Tuning numbers (change these to rebalance) ----------
const WAVES = 5;
const MAX_FUEL = 100;
const FUEL_DRAIN = 2.2;       // fuel lost per second, always
const FUEL_PER_KILL = 6;      // fuel gained when a shadow burns
const HIT_COST = 18;          // fuel lost when a shadow touches you
const SWING_REACH = 85;       // px from the knight a swing can burn
const SWING_COOLDOWN = 0.25;  // seconds between swings
const FLARE_REACH = 120, FLARE_COST = 20, FLARE_COOLDOWN = 8;
const WARD_PUSH = 110, WARD_COOLDOWN = 4;
const DEADZONE = 0.2;         // controller stick deadzone

// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const screens = { title: $('title'), paused: $('paused'), win: $('win'), lose: $('lose') };

// ---------- Canvas size: match the element, sharp on Retina ----------
let W = 0, H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  ctx.imageSmoothingEnabled = false;       // crisp pixel art
}
window.addEventListener('resize', resize);
resize();
const groundY = () => H * 0.62;           // where feet touch the ground

// ---------- Game state ----------
let state = 'title';          // title | play | paused | win | lose
let fuel, wave, toSpawn, spawnTimer, breakTimer, shadows, effects;
let facing = 1;               // -1 = left, 1 = right
let swingCd = 0, swingAnim = 0, flareCd = 0, wardCd = 0, hurtFlash = 0;

let endedAt = 0;              // when the win/lose screen appeared
function startGame() {
  // Ignore restarts for 0.8s after win/lose, so a button you were
  // already mashing doesn't skip the ending screen.
  if ((state === 'win' || state === 'lose') && performance.now() - endedAt < 800) return;
  fuel = MAX_FUEL; wave = 0; shadows = []; effects = [];
  swingCd = flareCd = wardCd = hurtFlash = 0;
  nextWave();
  setState('play');
}

function nextWave() {
  wave++;
  toSpawn = 4 + wave * 3;     // wave 1: 7 shadows ... wave 5: 19
  spawnTimer = 1;
  breakTimer = 0;
  sound('bell');
}

function setState(s) {
  state = s;
  if (s === 'win' || s === 'lose') endedAt = performance.now();
  for (const k in screens) screens[k].classList.toggle('show', k === s);
  updatePrompt();
}

// ---------- Actions (every input method calls these) ----------
function swing(dir) {
  if (state !== 'play' || swingCd > 0) return;
  facing = dir; swingCd = SWING_COOLDOWN; swingAnim = 0.15;
  sound('swing');
  // find the nearest living shadow on that side, within reach
  const kx = W / 2;
  let best = null;
  for (const s of shadows) {
    const d = (s.x - kx) * dir;          // positive = on the side we swung
    if (d > 0 && d < SWING_REACH && (!best || d < (best.x - kx) * dir)) best = s;
  }
  if (best) burn(best);
}

function flare() {
  if (state !== 'play' || flareCd > 0) return;
  flareCd = FLARE_COOLDOWN; fuel -= FLARE_COST;
  effects.push({ type: 'flare', r: 10, max: FLARE_REACH, t: 0 });
  sound('flare'); rumble(120, 0.4);
  for (const s of [...shadows]) if (Math.abs(s.x - W / 2) < FLARE_REACH) burn(s);
}

function ward() {
  if (state !== 'play' || wardCd > 0) return;
  wardCd = WARD_COOLDOWN;
  effects.push({ type: 'ward', r: 10, max: W / 2, t: 0 });
  sound('ward');
  for (const s of shadows) s.x += Math.sign(s.x - W / 2) * WARD_PUSH; // shove outward
}

function burn(s) {
  shadows.splice(shadows.indexOf(s), 1);
  fuel = Math.min(MAX_FUEL, fuel + FUEL_PER_KILL);
  effects.push({ type: 'puff', x: s.x, t: 0 });
  sound('burn');
}

function togglePause() {
  if (state === 'play') setState('paused');
  else if (state === 'paused') { setState('play'); last = performance.now(); }
}

// ---------- Update: move everything forward by dt seconds ----------
function update(dt) {
  swingCd -= dt; swingAnim -= dt; flareCd -= dt; wardCd -= dt; hurtFlash -= dt;
  fuel -= FUEL_DRAIN * dt;

  // spawn shadows from a random side
  if (toSpawn > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const side = Math.random() < 0.5 ? -1 : 1;
      shadows.push({ x: W / 2 + side * (W / 2 + 20), speed: 28 + wave * 9 + Math.random() * 10, step: 0 });
      toSpawn--;
      spawnTimer = Math.max(0.6, 2.4 - wave * 0.35) * (0.7 + Math.random() * 0.6);
    }
  }

  // walk toward the knight; touching him hurts and knocks the shadow back
  for (const s of shadows) {
    const dir = Math.sign(W / 2 - s.x);
    s.x += dir * s.speed * dt; s.step += dt;
    if (Math.abs(s.x - W / 2) < 18) {
      fuel -= HIT_COST; hurtFlash = 0.25; s.x -= dir * 120;
      sound('hit'); rumble(200, 0.8);
    }
  }

  // effects grow and fade
  for (const e of effects) { e.t += dt; if (e.type !== 'puff') e.r += (e.max / 0.35) * dt; }
  effects = effects.filter((e) => e.t < 0.4);

  // wave cleared? short pause, then next wave or dawn
  if (toSpawn === 0 && shadows.length === 0) {
    breakTimer += dt;
    if (breakTimer > 1.5) {
      if (wave >= WAVES) { sound('dawn'); return setState('win'); }
      nextWave();
    }
  }

  if (fuel <= 0) { fuel = 0; sound('hit'); setState('lose'); }
}

// ---------- Draw ----------
function draw(time) {
  const g = groundY(), kx = W / 2;
  // night sky
  ctx.fillStyle = '#0b0612'; ctx.fillRect(0, 0, W, H);
  // moon
  ctx.fillStyle = '#3d2a55'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.18, 26, 0, 7); ctx.fill();
  // background art from Game Artist (assets/sprites.js)
  Art.draw(ctx, 'tree', W * 0.12, g, { scale: 3 });
  Art.draw(ctx, 'tombA', W * 0.28, g, { scale: 2 });
  Art.draw(ctx, 'tombB', W * 0.68, g, { scale: 2 });
  Art.draw(ctx, 'tombA', W * 0.9, g, { scale: 2, flip: true });
  // ground: dark fill, then the tile strip along the top edge
  ctx.fillStyle = '#1a0f22'; ctx.fillRect(0, g, W, H - g);
  Art.ground(ctx, g, W);

  // shadows: 2-frame walk, flipped to face the knight
  for (const s of shadows) {
    Art.draw(ctx, 'shadow', s.x, g, { frame: Math.floor(s.step * 6), flip: s.x > kx });
  }

  // knight: bone-white body, dark helmet slit, torch on the facing side
  // (frame 1 = swing pose; blink half-transparent when hurt)
  Art.draw(ctx, 'knight', kx, g, { frame: swingAnim > 0 ? 1 : 0, flip: facing < 0,
    alpha: hurtFlash > 0 && Math.floor(time / 50) % 2 ? 0.4 : 1 });
  const swingOut = swingAnim > 0 ? 24 : 14;           // torch reaches out during a swing
  const tx = kx + facing * swingOut, ty = g - 26;
  Art.draw(ctx, 'torch', tx, ty + 12, { frame: Math.floor(time / 120), flip: facing < 0 });
  if (swingAnim > 0) {                                  // swing arc
    ctx.strokeStyle = 'rgba(255,154,60,.7)'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.arc(kx, g - 26, SWING_REACH * 0.6, facing > 0 ? -1.2 : Math.PI - 0.4, facing > 0 ? 0.4 : Math.PI + 1.2);
    ctx.stroke();
  }

  // effects: burn puffs and flare/ward rings
  for (const e of effects) {
    const a = 1 - e.t / 0.4;
    if (e.type === 'puff') Art.draw(ctx, 'puff', e.x, g, { frame: Math.floor(e.t / 0.4 * 3), alpha: a });
    else if (e.type === 'flare') Art.flare(ctx, kx, g - 20, e.r, a);
    else Art.ward(ctx, kx, g, e.r, a);
  }

  // DARKNESS: everything outside the torchlight fades to black.
  // The light radius shrinks with fuel, and flickers a little.
  const r = 55 + (fuel / MAX_FUEL) * 150 + Math.sin(time / 90) * 3;
  const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
  grad.addColorStop(0, 'rgba(255,140,40,0.12)');
  grad.addColorStop(0.55, 'rgba(8,3,14,0.35)');
  grad.addColorStop(1, 'rgba(3,1,6,0.97)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // shadow EYES glow on top of the dark, so you can see them coming
  ctx.fillStyle = '#ff3b6b';
  for (const s of shadows) {
    const bob = Math.sin(s.step * 10) * 2, look = Math.sign(kx - s.x) * 2;
    ctx.fillRect(s.x - 6 + look, g - 24 + bob, 3, 3); ctx.fillRect(s.x + 3 + look, g - 24 + bob, 3, 3);
  }

  // HUD (plain DOM elements, just update them)
  $('wave').textContent = `Wave ${wave || 1}/${WAVES}`;
  $('fuel').style.width = Math.max(0, fuel) + '%';
  $('flareBtn').classList.toggle('cooling', flareCd > 0);
  $('wardBtn').classList.toggle('cooling', wardCd > 0);
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // cap dt so a lag spike can't teleport shadows
  last = now;
  pollGamepad();
  if (state === 'play') update(dt);
  if (fuel !== undefined) draw(now); else drawTitleBg(now);
  requestAnimationFrame(loop);
}
function drawTitleBg(now) { fuel = MAX_FUEL; shadows = []; effects = []; draw(now); fuel = undefined; }
requestAnimationFrame(loop);

// ---------- INPUT: touch / mouse ----------
let inputMode = 'touch';      // touch | keys | pad  (changes prompts)
function setMode(m) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.classList.toggle('pad', m === 'pad');
  updatePrompt();
}
canvas.addEventListener('pointerdown', (e) => {
  setMode('touch'); unlockAudio();
  const rect = canvas.getBoundingClientRect();
  swing(e.clientX - rect.left < rect.width / 2 ? -1 : 1);   // left half or right half
});
$('flareBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); setMode('touch'); flare(); });
$('wardBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); setMode('touch'); ward(); });
$('pauseBtn').addEventListener('click', togglePause);
document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation(); unlockAudio();
  if (b.dataset.action === 'resume') togglePause(); else if (state !== 'play') startGame();
}));
screens.title.addEventListener('pointerdown', () => { unlockAudio(); if (state === 'title') startGame(); }); // tap anywhere to start

// ---------- INPUT: keyboard ----------
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  setMode('keys'); unlockAudio();
  const k = e.key.toLowerCase();
  if (state === 'title' || state === 'win' || state === 'lose') {
    if (state === 'title' || k === 'enter' || k === ' ') startGame();
    return;
  }
  if (k === 'arrowleft' || k === 'a') swing(-1);
  else if (k === 'arrowright' || k === 'd') swing(1);
  else if (k === ' ' || k === 'arrowup' || k === 'w') flare();
  else if (k === 'shift' || k === 'arrowdown' || k === 's') ward();
  else if (k === 'p' || k === 'escape') togglePause();
  else return;
  e.preventDefault();
});

// ---------- INPUT: game controller (Gamepad API) ----------
// Browsers don't send "button pressed" events for controllers.
// Instead we ask navigator.getGamepads() every frame and compare
// with last frame, so each press fires exactly once.
let padPrev = {};             // what was held last frame
let padStyle = 'ps';          // ps = ✕○□ symbols, xbox = A/B/X
window.addEventListener('gamepadconnected', (e) => {
  padStyle = /xbox/i.test(e.gamepad.id) ? 'xbox' : 'ps';
  toast('Controller connected'); sound('blip');
  setMode('pad'); updatePrompt();
});
window.addEventListener('gamepaddisconnected', () => {
  toast('Controller disconnected');
  if (inputMode === 'pad') setMode('touch');
});

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find((p) => p && p.connected);
  if (!pad) return;
  const style = /xbox/i.test(pad.id) ? 'xbox' : 'ps';
  if (style !== padStyle) { padStyle = style; updatePrompt(); }
  const b = (i) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
  const x = pad.axes[0] || 0;
  const now = {
    left: x < -DEADZONE || b(14), right: x > DEADZONE || b(15),
    cross: b(0), circle: b(1), ward: b(2) || b(7), options: b(9),
    any: pad.buttons.some((btn) => btn.pressed),
  };
  const pressed = (k) => now[k] && !padPrev[k];   // true only on the frame it goes down
  if (now.any || Math.abs(x) > DEADZONE) setMode('pad');

  if (state === 'title' || state === 'win' || state === 'lose') {
    if (pressed('cross') || pressed('options') || (state === 'title' && pressed('any'))) { unlockAudio(); startGame(); }
  } else {
    if (pressed('options')) togglePause();
    if (state === 'play') {
      if (pressed('left')) swing(-1);
      if (pressed('right')) swing(1);
      if (pressed('cross')) swing(facing);
      if (pressed('circle')) flare();
      if (pressed('ward')) ward();
    }
  }
  padPrev = now;
}

// Rumble only if this browser supports it (iPhone browsers don't).
function rumble(ms, strength) {
  try {
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    const act = pad && pad.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength }).catch(() => {});
  } catch (e) { /* no rumble, no problem */ }
}

// ---------- Prompts and toast ----------
function updatePrompt() {
  const p = $('prompt');
  if (state !== 'play') { p.textContent = ''; return; }
  if (inputMode === 'pad') {
    p.textContent = padStyle === 'xbox'
      ? 'Stick/D-pad or A swing · B flare · X/RT ward · Menu pause'
      : 'Stick/D-pad or ✕ swing · ○ flare · □/R2 ward · Options pause';
  } else if (inputMode === 'keys') {
    p.textContent = '←/→ swing · Space flare · Shift ward · P pause';
  } else {
    p.textContent = 'Tap left or right to swing';
  }
}
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// Pause automatically when you switch apps or tabs
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('paused'); });

// ---------- Sounds ----------
let audio = null;
function unlockAudio() {           // iPhone only allows sound after a tap or key press
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (audio && audio.state === 'suspended') audio.resume();
}
function sound(name) {
  SFX.play(audio, name);   // Game Artist's synthesized sounds (assets/sfx.js)
}
