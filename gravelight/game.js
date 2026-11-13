// ============================================================
// GRAVELIGHT v2 - a tiny top-down dungeon crawler
// Plain JavaScript + <canvas>. Art and sound come from Game Artist's
// assets/sprites.js and assets/sfx.js; anything missing falls back
// to simple placeholder shapes.
// ============================================================

// ---------- Tuning ----------
const T = 24;                     // one tile is 24 screen pixels
const MW = 48, MH = 48;           // map size in tiles
const MAX_HP = 5, MAX_FUEL = 100;
const FUEL_DRAIN = 1.1;           // per second
const SPEED = 95;                 // player pixels per second
const ATTACK_CD = 0.35, FLARE_CD = 8, FLARE_COST = 20, WARD_CD = 4;
const DEADZONE = 0.2;
const FLOORS = [
  { name: 'The Crypt',              floor: '#3a3440', wall: '#5b5566', top: '#6f4d8a', dark: '#07050a' },
  { name: 'The Catacombs',          floor: '#2b3346', wall: '#d8d0bc', top: '#8a8472', dark: '#03060c' },
  { name: "The Hollow King's Tomb", floor: '#141216', wall: '#26222a', top: '#b8963a', dark: '#000000' },
];

// ---------- Items: name, slot, rarity, flavor, and what they do ----------
const ITEMS = {
  rusted:     { name: 'Rusted Blade',     slot: 'sword', rarity: 'common',   rank: 0, flavor: 'It has seen better centuries.' },
  gravesteel: { name: 'Gravesteel Sword', slot: 'sword', rarity: 'uncommon', rank: 1, flavor: 'Forged from melted coffin nails. +1 damage.' },
  dawnedge:   { name: 'Dawnedge',         slot: 'sword', rarity: 'rare',     rank: 2, flavor: 'It glows like the sky just before morning. +2 damage.' },
  pitch:      { name: 'Pitch Torch',      slot: 'torch', rarity: 'common',   rank: 0, flavor: 'Smoky, sticky, and yours.' },
  everember:  { name: 'Everember Torch',  slot: 'torch', rarity: 'rare',     rank: 1, flavor: 'Its flame breathes slowly. Burns 30% longer and brighter.' },
  chain:      { name: 'Chain Shroud',     slot: 'armor', rarity: 'uncommon', rank: 1, flavor: 'Crypt-gate links sewn into cloth. Every third blow slides off.' },
  quickstep:  { name: 'Quickstep Band',   slot: 'ring',  rarity: 'uncommon', rank: 1, flavor: "A dancer's ring. You move 15% faster." },
  embers:     { name: 'Ring of Embers',   slot: 'ring',  rarity: 'uncommon', rank: 2, flavor: 'Warm to the touch. Kills feed the flame twice as much.' },
  potion:     { name: 'Health Potion',    rarity: 'common', flavor: 'Tastes like pennies and pine. Heals 2 hearts.' },
  oil:        { name: 'Torch Oil',        rarity: 'common', flavor: 'Thick lamp oil. Refills 40% of your light.' },
  gold:       { name: 'Gold',             rarity: 'common', flavor: 'Old coins stamped with a king nobody misses.' },
};
// What the chests on each floor hold (in order)
const CHESTS = [['gravesteel', 'quickstep', 'oil'], ['chain', 'embers', 'potion'], ['dawnedge', 'everember']];

// ---------- Story ----------
const INTRO = [
  'You are Aldren, the last Lamplighter of Mirehollow. For three hundred years your family has kept the village lamps burning through the night.',
  'Under the old graveyard lies the crypt of the Hollow King. He tried to buy his way out of death and was buried with a stolen piece of the night. Now the crypt is awake, and shadows crawl out after dark.',
  'You carry the Gravelight, a torch lit from the first dawn. It is the only fire the shadows fear, and it is slowly burning out. Go down, find oil, and end the darkness.',
];
const LORE = [
  [['tomb', 'Here lies Old Wick, lamplighter. He kept the dark out for sixty winters. Keep it out for sixty more.'],
   ['scroll', "The king's gold could not bribe death, so he bribed the night instead. The night took the gold, and then it took him."],
   ['carving', 'Where the light fails, the Shades walk. Where the Shades walk, nothing grows.']],
  [['tomb', 'The Bone Crawlers were diggers once. They dug too deep, and something dug back.'],
   ['scroll', "Wisps are a candle's last breath. They fear a strong flame, and they wait for it to weaken."],
   ['carving', 'Count the skulls in the walls. The Hollow King counted them too. He wanted more.'],
   ['tomb', "Mirehollow's first dawn was caught in a lantern and never let go. We call it the Gravelight."]],
  [['carving', 'Bow to the Hollow King, who wears the night like a crown.'],
   ['scroll', 'A shard of the night sleeps in his chest. Break the king, and the shard breaks with him.'],
   ['tomb', 'His servants were buried standing up, so they could keep serving. They are still waiting.']],
];

// ---------- Page setup ----------
const $ = (id) => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const screenIds = ['title', 'intro', 'read', 'paused', 'win', 'lose'];
let W = 0, H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// ---------- Art helper: use Game Artist's sprite if it exists, else a placeholder ----------
const artOK = {};
function hasArt(name) {
  if (!(name in artOK)) {
    try { Art.draw(document.createElement('canvas').getContext('2d'), name, 0, 0, {}); artOK[name] = true; }
    catch (e) { artOK[name] = false; }
  }
  return artOK[name];
}
function sprite(name, x, y, o, fallback) {   // x, y = bottom center, in screen pixels
  if (hasArt(name)) Art.draw(ctx, name, x, y, o);
  else fallback();
}
function box(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h); }

// ---------- Seeded random numbers: same dungeon every run ----------
function makeRng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

// ============================================================
// DUNGEON GENERATOR: drop random rooms, then join them with corridors
// ============================================================
let map, seen, rooms, objects, enemies, pickups, rings, effects;
function buildFloor(n) {                       // n = 0, 1, 2
  const rnd = makeRng(1234 + n * 999);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  map = new Uint8Array(MW * MH);               // 0 wall, 1 floor, 2 stairs
  seen = new Uint8Array(MW * MH);
  rooms = []; objects = []; enemies = []; pickups = []; rings = []; effects = [];

  if (n === 2) rooms.push({ x: MW - 16, y: MH - 14, w: 13, h: 11 });   // big boss room
  for (let tries = 0; tries < 400 && rooms.length < 8; tries++) {
    const r = { w: ri(5, 9), h: ri(5, 8) };
    r.x = ri(1, MW - r.w - 2); r.y = ri(1, MH - r.h - 2);
    const overlaps = rooms.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y);
    if (!overlaps) rooms.push(r);
  }
  // Sort from top-left to bottom-right, so the path runs across the map
  rooms.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const set = (x, y, v) => { if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) map[y * MW + x] = v; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, 1);
  const mid = (r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
  for (let i = 1; i < rooms.length; i++) {      // L-shaped, 2-tile-wide corridors
    const a = mid(rooms[i - 1]), b = mid(rooms[i]);
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) { set(x, a.y, 1); set(x, a.y + 1, 1); }
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) { set(b.x, y, 1); set(b.x + 1, y, 1); }
  }
  const start = rooms[0], last = rooms[rooms.length - 1];
  const center = (r) => ({ x: (r.x + r.w / 2) * T, y: (r.y + r.h / 2) * T });
  if (n < 2) { const m = mid(last); set(m.x, m.y, 2); }

  // a random free spot inside a room (in pixels), away from its center
  const spot = (r) => ({ x: (ri(r.x + 1, r.x + r.w - 2) + 0.5) * T, y: (ri(r.y + 1, r.y + r.h - 2) + 0.5) * T });
  const middle = rooms.slice(1, rooms.length - 1);
  CHESTS[n].forEach((item, i) => objects.push({ kind: 'chest', item, open: false, ...spot(middle[(i * 3 + 1) % middle.length]) }));
  LORE[n].forEach(([kind, text], i) => objects.push({ kind, text, ...spot(i === 0 ? start : middle[(i * 2) % middle.length]) }));

  // enemies: more and tougher on deeper floors
  const types = n === 0 ? ['shade', 'shade', 'wisp'] : ['shade', 'wisp', 'crawler'];
  for (const r of rooms.slice(1)) {
    if (n === 2 && r === last) continue;
    const count = ri(1, 2 + n);
    for (let i = 0; i < count; i++) enemies.push(makeEnemy(types[ri(0, types.length - 1)], spot(r)));
  }
  if (n === 2) enemies.push(makeEnemy('king', center(last)));

  const c = center(start);
  player.x = c.x; player.y = c.y;
  floorNum = n;
  banner(`Floor ${n + 1}: ${FLOORS[n].name}`);
}
const tileAt = (px, py) => {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 0 : map[ty * MW + tx];
};
// Is a circle of radius r at (x, y) touching a wall? (checks its 4 corners)
const blocked = (x, y, r) => !tileAt(x - r, y - r) || !tileAt(x + r, y - r) || !tileAt(x - r, y + r) || !tileAt(x + r, y + r);
// Move one axis at a time, so you slide along walls instead of sticking
function moveBody(b, dx, dy) {
  let hit = false;
  if (!blocked(b.x + dx, b.y, b.r)) b.x += dx; else hit = true;
  if (!blocked(b.x, b.y + dy, b.r)) b.y += dy; else hit = true;
  return hit;
}

// ============================================================
// GAME STATE
// ============================================================
const ENEMY_STATS = {
  shade:   { hp: 2,  speed: 42,  r: 7 },
  wisp:    { hp: 1,  speed: 80,  r: 5 },
  crawler: { hp: 5,  speed: 24,  r: 8 },
  king:    { hp: 30, speed: 20,  r: 14 },
};
function makeEnemy(type, pos) {
  const s = ENEMY_STATS[type];
  return { type, x: pos.x, y: pos.y, hp: s.hp, maxHp: s.hp, speed: s.speed, r: s.r, t: Math.random() * 9,
    back: 0, mode: 'walk', timer: 0, cd: 0, dx: 0, dy: 0, flash: 0, kx: 0, ky: 0, ringT: 3, summoned: false };
}

let state = 'title', introPage = 0, floorNum = 0, endedAt = 0;
const player = { x: 0, y: 0, r: 7 };
let hp, fuel, gold, potions, oils, gear, fx, fy, atkCd, atkAnim, flareCd, wardCd, inv, hitsTaken, darkTimer, playTime, walkT;

function newGame() {
  hp = MAX_HP; fuel = MAX_FUEL; gold = 0; potions = 1; oils = 0;
  gear = { sword: 'rusted', torch: 'pitch', armor: null, ring: null };
  fx = 0; fy = 1; atkCd = atkAnim = flareCd = wardCd = inv = hitsTaken = darkTimer = playTime = walkT = 0;
  buildFloor(0);
  setState('play');
}
function setState(s) {
  state = s;
  if (s === 'win' || s === 'lose') endedAt = performance.now();
  if (s === 'win') $('winStats').textContent = `Gold: ${gold}. Time: ${Math.floor(playTime / 60)}m ${Math.floor(playTime % 60)}s.`;
  if (s === 'lose') $('loseStats').textContent = `You reached floor ${floorNum + 1}: ${FLOORS[floorNum].name}.`;
  for (const id of screenIds) $(id).classList.toggle('show', id === s);
  if (s === 'paused') renderInventory();
  updatePrompt();
}
function tryRestart() {           // 0.8s lockout so a mashed button can't skip the ending
  if (performance.now() - endedAt > 800) { introPage = 0; newGame(); }
}
// ---------- Music hooks (Audio Designer's assets/music.js, if loaded) ----------
const hasMusic = () => typeof window.Music === 'object';
let musicOn = localStorage.getItem('gl_music') !== 'off';
let musicVol = +(localStorage.getItem('gl_vol') || 0.6);
function startMusic() {                        // must run inside a tap/key/button press (iPhone rule)
  unlockAudio();
  if (!hasMusic()) return;
  try { Music.start(audio); Music.setVolume(musicVol); if (!musicOn) Music.toggle(false); } catch (e) {}
}
function setMusicOn(on) { musicOn = on; localStorage.setItem('gl_music', on ? 'on' : 'off'); if (hasMusic()) try { Music.toggle(on); } catch (e) {} }
function setMusicVol(v) { musicVol = v; localStorage.setItem('gl_vol', v); if (hasMusic()) try { Music.setVolume(v); } catch (e) {} }
// danger = 1 when an enemy is within 6 tiles, fading to 0 by 9 tiles; always 1 near the boss
function updateDanger() {
  if (!hasMusic() || !enemies) return;
  let near = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y) - (e.type === 'king' ? 150 : 0);
    if (d < near) near = d;
  }
  try { Music.setDanger(state === 'play' ? Math.max(0, Math.min(1, (9 * T - near) / (3 * T))) : 0); } catch (e) {}
}

function startIntro() { startMusic(); setTimeout(updateSoundTip, 300); introPage = 0; $('introText').textContent = INTRO[0]; setState('intro'); }
function nextIntro() {
  introPage++;
  if (introPage >= INTRO.length) return newGame();
  $('introText').textContent = INTRO[introPage];
}

// derived stats from gear
const damage = () => 1 + ITEMS[gear.sword].rank;
const lightR = () => fuel <= 0 ? 26 : 45 + fuel * 1.3 + (gear.torch === 'everember' ? 25 : 0);

// ============================================================
// ACTIONS
// ============================================================
function attack() {
  if (state !== 'play' || atkCd > 0) return;
  atkCd = ATTACK_CD; atkAnim = 0.15; sound('swing');
  for (const e of enemies) {
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy);
    // hit if close, and roughly in front of you (dot product > 0.2)
    if (d < 34 + e.r && (d < 12 || (dx * fx + dy * fy) / d > 0.2)) hurtEnemy(e, damage(), dx / d || 0, dy / d || 0);
  }
}
function flare() {
  if (state !== 'play' || flareCd > 0 || fuel < 5) return;
  flareCd = FLARE_CD; fuel = Math.max(0, fuel - FLARE_COST);
  effects.push({ type: 'flare', r: 10, max: 80, t: 0 }); sound('flare'); rumble(120, 0.4);
  for (const e of [...enemies]) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < 80) hurtEnemy(e, e.type === 'king' ? 3 : 99, 0, 0);
  }
}
function ward() {
  if (state !== 'play' || wardCd > 0) return;
  wardCd = WARD_CD; effects.push({ type: 'ward', r: 10, max: 90, t: 0 }); sound('ward');
  for (const e of enemies) {
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
    if (d < 90 && e.type !== 'king') { e.kx = dx / d * 260; e.ky = dy / d * 260; e.mode = 'walk'; }
  }
  // Ward also cancels the Hollow King's darkness rings near you
  rings = rings.filter((g) => Math.abs(Math.hypot(player.x - g.x, player.y - g.y) - g.r) > 90);
}
function interact() {
  if (state !== 'play') return;
  const o = nearbyObject();
  if (!o) return;
  if (o.kind === 'chest') {
    o.open = true; sound('chest');
    gold += 10 + floorNum * 10;
    grantItem(o.item);
  } else {
    $('readText').textContent = o.text; setState('read');
  }
}
function nearbyObject() {
  let best = null, bestD = 30;
  for (const o of objects) {
    if (o.kind === 'chest' && o.open) continue;
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < bestD) { best = o; bestD = d; }
  }
  return best;
}
function grantItem(id) {
  const it = ITEMS[id];
  const tag = `<span class="${it.rarity}">${it.name}</span>`;
  if (id === 'gold') { gold += 5 + floorNum * 5; sound('coin'); return; }
  if (id === 'potion') { potions++; sound('pickup'); return toast(`${tag}<br>${it.flavor}`); }
  if (id === 'oil') { oils++; sound('pickup'); return toast(`${tag}<br>Used automatically when your light runs low.`); }
  sound('pickup');
  const cur = gear[it.slot];
  if (!cur || ITEMS[cur].rank < it.rank) { gear[it.slot] = id; toast(`Equipped ${tag}<br>${it.flavor}`); }
  else { gold += 15; toast(`${tag}<br>Not better than yours. Sold for 15 gold.`); }
}
function drinkPotion() {
  if (potions <= 0 || hp >= MAX_HP) return false;
  potions--; hp = Math.min(MAX_HP, hp + 2); sound('gulp'); return true;
}
function pourOil() {
  if (oils <= 0 || fuel > 90) return false;
  oils--; fuel = Math.min(MAX_FUEL, fuel + 40); sound('pickup'); return true;
}
function hurtEnemy(e, dmg, nx, ny) {
  e.hp -= dmg; e.flash = 0.15;
  if (e.type !== 'king') { e.kx = nx * 180; e.ky = ny * 180; }
  sound('burn');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  enemies.splice(enemies.indexOf(e), 1);
  effects.push({ type: 'puff', x: e.x, y: e.y, t: 0 });
  fuel = Math.min(MAX_FUEL, fuel + (gear.ring === 'embers' ? 8 : 4));
  if (e.type === 'king') { sound('dawn'); return setState('win'); }
  // sometimes drop loot
  const roll = Math.random();
  const drop = roll < 0.25 ? 'gold' : roll < 0.37 ? 'oil' : roll < 0.45 ? 'potion' : null;
  if (drop) pickups.push({ item: drop, x: e.x, y: e.y });
}
function hurtPlayer(n) {
  if (inv > 0 || state !== 'play') return;
  inv = 1;
  if (gear.armor === 'chain' && ++hitsTaken % 3 === 0) { toast('The Chain Shroud blocks the blow!'); return; }
  hp -= n; sound('hit'); rumble(200, 0.8);
  if (hp === 1) drinkPotion();          // auto-drink at 1 heart
  if (hp <= 0) { hp = 0; setState('lose'); }
}
function togglePause() {
  if (state === 'play') setState('paused');
  else if (state === 'paused') { setState('play'); last = performance.now(); }
}

// ============================================================
// UPDATE
// ============================================================
function update(dt) {
  playTime += dt;
  atkCd -= dt; atkAnim -= dt; flareCd -= dt; wardCd -= dt; inv -= dt;

  // --- torch fuel ---
  fuel -= FUEL_DRAIN * (gear.torch === 'everember' ? 0.7 : 1) * dt;
  if (fuel < 5 && oils > 0) pourOil();
  if (fuel <= 0) {
    fuel = 0; darkTimer += dt;
    if (darkTimer >= 2) { darkTimer = 0; inv = 0; hurtPlayer(1); }
  } else darkTimer = 0;

  // --- player movement ---
  const [mx, my] = moveInput();
  if (mx || my) {
    const len = Math.hypot(mx, my), sp = SPEED * (gear.ring === 'quickstep' ? 1.15 : 1) * Math.min(1, len);
    fx = mx / len; fy = my / len;
    moveBody(player, fx * sp * dt, fy * sp * dt);
    walkT += dt;
    if (Math.floor(walkT * 4) !== Math.floor((walkT - dt) * 4)) sound('step');
  }
  if (tileAt(player.x, player.y) === 2) { sound('stairs'); buildFloor(floorNum + 1); return; }

  // --- remember seen tiles (fog of war) ---
  const R = lightR(), ptx = player.x / T, pty = player.y / T, rt = R / T;
  for (let y = Math.floor(pty - rt); y <= pty + rt; y++) for (let x = Math.floor(ptx - rt); x <= ptx + rt; x++)
    if (x >= 0 && y >= 0 && x < MW && y < MH && Math.hypot(x + 0.5 - ptx, y + 0.5 - pty) < rt) seen[y * MW + x] = 1;

  // --- pick up loot by walking over it ---
  pickups = pickups.filter((p) => {
    if (Math.hypot(p.x - player.x, p.y - player.y) > 14) return true;
    grantItem(p.item); return false;
  });

  for (const e of [...enemies]) updateEnemy(e, dt, R);

  // --- darkness rings from the boss ---
  for (const g of rings) {
    g.r += 90 * dt;
    if (!g.hit && Math.abs(Math.hypot(player.x - g.x, player.y - g.y) - g.r) < 9) { g.hit = true; hurtPlayer(1); }
  }
  rings = rings.filter((g) => g.r < 260);

  for (const e of effects) { e.t += dt; if (e.max) e.r += (e.max / 0.35) * dt; }
  effects = effects.filter((e) => e.t < 0.4);
}

// Each enemy type moves differently
function updateEnemy(e, dt, R) {
  e.t += dt; e.flash -= dt; e.back -= dt; e.cd -= dt;
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  let vx = 0, vy = 0;
  if (d < 230 || e.type === 'king' && d < 320) {
    if (e.type === 'shade') { vx = ux; vy = uy; }
    else if (e.type === 'wisp') {
      if (e.back > 0) { vx = -ux; vy = -uy; }                       // backing off after a hit
      else if (fuel > 50 && d < R + 14) { vx = -ux * 0.6 - uy; vy = -uy * 0.6 + ux; } // hates strong light: circle outside it
      else { const z = Math.sin(e.t * 7); vx = ux - uy * z; vy = uy + ux * z; } // zigzag in
    } else if (e.type === 'crawler') {
      if (e.mode === 'walk') {
        vx = ux; vy = uy;
        const lined = Math.abs(dx) < 12 || Math.abs(dy) < 12;
        if (lined && d < 170 && e.cd <= 0) {                          // warning pause, then charge
          e.mode = 'wind'; e.timer = 0.5;
          if (Math.abs(dx) < 12) { e.dx = 0; e.dy = Math.sign(dy); } else { e.dx = Math.sign(dx); e.dy = 0; }
        }
      } else if (e.mode === 'wind') { if ((e.timer -= dt) <= 0) { e.mode = 'charge'; e.timer = 0.8; } }
      else if (e.mode === 'charge') {
        const hit = moveBody(e, e.dx * 170 * dt, e.dy * 170 * dt);
        if ((e.timer -= dt) <= 0 || hit) { e.mode = 'walk'; e.cd = 1.5; }
      }
    } else if (e.type === 'king') {
      vx = ux; vy = uy;
      if ((e.ringT -= dt) <= 0) { e.ringT = 3.5; rings.push({ x: e.x, y: e.y, r: e.r }); sound('ring'); }
      if (!e.summoned && e.hp <= e.maxHp / 2) {
        e.summoned = true; sound('roar');
        enemies.push(makeEnemy('shade', { x: e.x - 30, y: e.y }), makeEnemy('shade', { x: e.x + 30, y: e.y }));
      }
      if (!e.roared) { e.roared = true; sound('roar'); }
    }
  }
  const sp = e.speed * (e.mode === 'wind' ? 0 : 1);
  const len = Math.hypot(vx, vy) || 1;
  moveBody(e, (vx / len * sp + e.kx) * dt, (vy / len * sp + e.ky) * dt);
  e.kx *= 0.85; e.ky *= 0.85;                                     // knockback fades
  if (d < e.r + player.r) { hurtPlayer(e.type === 'king' ? 2 : 1); if (e.type === 'wisp') e.back = 1; }
}

// ============================================================
// DRAW
// ============================================================
let camX = 0, camY = 0;
function draw(time) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!map || !gear) return;                 // nothing to draw before the first game starts
  const P = FLOORS[floorNum], R = lightR() + Math.sin(time / 90) * 2;
  // camera follows the player, but stays inside the map
  camX = Math.max(0, Math.min(MW * T - W, player.x - W / 2));
  camY = Math.max(0, Math.min(MH * T - H, player.y - H / 2));
  const sx = (x) => x - camX, sy = (y) => y - camY;           // world -> screen
  const lit = (x, y) => Math.hypot(x - player.x, y - player.y) < R;

  // --- tiles ---
  const n = floorNum + 1;
  for (let ty = Math.floor(camY / T); ty <= (camY + H) / T; ty++) {
    for (let tx = Math.floor(camX / T); tx <= (camX + W) / T; tx++) {
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH || !seen[ty * MW + tx]) continue;
      const v = map[ty * MW + tx], X = tx * T - camX, Y = ty * T - camY;
      const isLit = lit(tx * T + T / 2, ty * T + T / 2);
      ctx.globalAlpha = isLit ? 1 : 0.28;                         // remembered tiles are dim
      if (v === 0) {
        if (!hasNeighborFloor(tx, ty)) { ctx.globalAlpha = 1; continue; }
        sprite('wall' + n, X + T / 2, Y + T, { scale: 1.5 }, () => {
          box(X + T / 2, Y + T, T, T, P.wall); box(X + T / 2, Y + 5, T, 5, P.top);
        });
      } else {
        sprite('floor' + n, X + T / 2, Y + T, { scale: 1.5 }, () => {
          box(X + T / 2, Y + T, T, T, P.floor);
          if ((tx * 7 + ty * 3) % 5 === 0) box(X + 8, Y + 14, 3, 3, P.top);
        });
        if (v === 2) sprite('stairs' + n, X + T / 2, Y + T, { scale: 1.5 }, () => {
          for (let i = 0; i < 4; i++) box(X + T / 2, Y + 6 + i * 5, T - i * 5, 4, i % 2 ? '#111' : P.top);
        });
      }
    }
  }
  ctx.globalAlpha = 1;

  // --- objects (visible once their tile has been seen) ---
  for (const o of objects) {
    if (!seen[Math.floor(o.y / T) * MW + Math.floor(o.x / T)]) continue;
    const X = sx(o.x), Y = sy(o.y) + 8;
    if (o.kind === 'chest') sprite(o.open ? 'chestOpen' : 'chest', X, Y, { scale: 1.5 }, () => {
      box(X, Y, 18, 12, '#6b4a2b'); box(X, Y - 5, 18, 2, o.open ? '#222' : '#d4af37');
    });
    else sprite(o.kind, X, Y, { scale: 1.5 }, () => {
      if (o.kind === 'tomb') { box(X, Y, 14, 16, '#77708a'); box(X, Y - 11, 2, 7, '#222'); }
      else if (o.kind === 'scroll') { box(X, Y, 14, 10, '#e9d9a8'); box(X, Y - 4, 10, 1, '#6b4a2b'); }
      else { box(X, Y, 16, 16, '#4a3f5c'); box(X, Y - 6, 8, 4, '#9fe870'); }
    });
  }
  // --- loot on the floor (only in light) ---
  for (const p of pickups) if (lit(p.x, p.y)) {
    sprite('item_' + p.item, sx(p.x), sy(p.y) + 6, { scale: 1 }, () =>
      box(sx(p.x), sy(p.y) + 5, 8, 8, p.item === 'gold' ? '#d4af37' : p.item === 'oil' ? '#ff9a3c' : '#ff4d6d'));
  }
  // --- enemies (fog of war: only drawn inside your light) ---
  for (const e of enemies) {
    if (!lit(e.x, e.y) && e.type !== 'king') continue;
    const X = sx(e.x), Y = sy(e.y) + e.r, flip = player.x < e.x;
    ctx.globalAlpha = e.flash > 0 ? 0.5 : 1;
    const fr = Math.floor(e.t * 5);
    if (e.type === 'shade') sprite('shade', X, Y, { frame: fr, flip, scale: 1.5 }, () => { box(X, Y, 14, 18, '#2b1044'); eyes(X, Y - 12); });
    if (e.type === 'wisp') sprite('wisp', X, Y, { frame: fr, scale: 1.5 }, () => { box(X, Y - Math.sin(e.t * 8) * 2, 9, 9, '#8fd3ff'); });
    if (e.type === 'crawler') sprite('crawler', X, Y, { frame: fr, flip, scale: 1.5 }, () => {
      box(X, Y, 20, 14, e.mode === 'wind' ? '#ff5050' : '#d8d0bc'); eyes(X, Y - 9);
    });
    if (e.type === 'king') sprite('king', X, Y, { frame: fr, flip, scale: 2 }, () => {
      box(X, Y, 28, 34, '#0d0a10'); box(X, Y - 34, 26, 6, '#d4af37'); eyes(X, Y - 24);
    });
    if (e.mode === 'wind') { ctx.fillStyle = '#ff5050'; ctx.fillRect(X - 1, Y - 34, 3, 8); }   // "!" warning
    ctx.globalAlpha = 1;
  }
  // --- player ---
  const dir = Math.abs(fx) > Math.abs(fy) ? 'Side' : fy < 0 ? 'Up' : 'Down';
  const PX = sx(player.x), PY = sy(player.y) + 8;
  ctx.globalAlpha = inv > 0 && Math.floor(time / 60) % 2 ? 0.4 : 1;
  sprite('hero' + dir, PX, PY, { frame: Math.floor(walkT * 6), flip: fx < -0.3, scale: 1.5 }, () => {
    box(PX, PY, 14, 18, '#e9e2d0'); box(PX + fx * 5, PY - 12 + fy * 3, 6, 3, '#0b0612');
  });
  ctx.globalAlpha = 1;
  box(PX + fx * 10 + fy * 6, PY - 12, 4, 6, '#ff9a3c');                         // torch flame
  if (atkAnim > 0) {                                                          // sword arc
    const a = Math.atan2(fy, fx);
    ctx.strokeStyle = '#e9e2d0'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.arc(PX, PY - 8, 26, a - 0.9, a + 0.9); ctx.stroke();
  }
  // --- effects and boss rings ---
  for (const e of effects) {
    const a = 1 - e.t / 0.4;
    if (e.type === 'puff') { ctx.fillStyle = `rgba(255,154,60,${a})`; for (let i = 0; i < 6; i++) ctx.fillRect(sx(e.x) + Math.cos(i) * e.t * 50, sy(e.y) - Math.sin(i * 2) * e.t * 40, 3, 3); }
    else if (e.type === 'flare') Art.flare(ctx, PX, PY - 8, e.r, a);
    else Art.ward(ctx, PX, PY, e.r, a);
  }
  for (const g of rings) {
    ctx.strokeStyle = 'rgba(120,40,200,.85)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(sx(g.x), sy(g.y), g.r, 0, 7); ctx.stroke();
  }

  // --- torchlight falloff: soft dark edge around your light circle ---
  const grad = ctx.createRadialGradient(PX, PY - 8, R * 0.3, PX, PY - 8, R);
  grad.addColorStop(0, 'rgba(255,140,40,0.08)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // --- joystick ---
  if (joy) {
    ctx.strokeStyle = 'rgba(233,226,208,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 40, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(233,226,208,.5)';
    const [jx, jy] = joyVec();
    ctx.beginPath(); ctx.arc(joy.ox + jx * 40, joy.oy + jy * 40, 16, 0, 7); ctx.fill();
  }
}
function eyes(x, y) { ctx.fillStyle = '#ff3b6b'; ctx.fillRect(x - 4, y, 2, 2); ctx.fillRect(x + 2, y, 2, 2); }
function hasNeighborFloor(tx, ty) {
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++)
    if (x >= 0 && y >= 0 && x < MW && y < MH && map[y * MW + x]) return true;
  return false;
}

// ---------- HUD ----------
function drawHud() {
  if (!gear) return;
  $('hearts').textContent = '♥'.repeat(Math.max(0, hp)) + '♡'.repeat(MAX_HP - Math.max(0, hp));
  $('fuel').style.width = fuel + '%';
  $('floorName').textContent = `F${floorNum + 1} · ${gold} gold`;
  $('flareBtn').classList.toggle('cooling', flareCd > 0);
  $('wardBtn').classList.toggle('cooling', wardCd > 0);
  const o = state === 'play' && nearbyObject();
  $('ctxBtn').style.display = o ? 'block' : 'none';
  $('ctxBtn').textContent = o ? (o.kind === 'chest' ? 'OPEN' : 'READ') : '';
  if (o !== lastNear) { lastNear = o; updatePrompt(); }
  const king = enemies && enemies.find((e) => e.type === 'king' && Math.hypot(e.x - player.x, e.y - player.y) < 320);
  $('bossBar').style.display = king ? 'block' : 'none';
  if (king) $('bossHp').style.width = (king.hp / king.maxHp * 100) + '%';
}
let lastNear = null;

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pollGamepad();
  if (state === 'play') update(dt);
  updateDanger();
  draw(now); drawHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// INPUT
// ============================================================
let inputMode = 'touch';                  // touch | keys | pad (changes the prompts)
function setMode(m) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.classList.toggle('pad', m === 'pad');
  updatePrompt();
}
const keys = {};                          // keys held right now
let padMove = [0, 0];

// Combine every input into one movement direction
function moveInput() {
  let x = 0, y = 0;
  if (keys.arrowleft || keys.a) x--; if (keys.arrowright || keys.d) x++;
  if (keys.arrowup || keys.w) y--;   if (keys.arrowdown || keys.s) y++;
  if (x || y) return [x, y];
  if (joy) return joyVec();
  return padMove;
}

// --- touch: virtual joystick on the left half of the screen ---
let joy = null;
function joyVec() {
  const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
  if (d < 8) return [0, 0];                           // small deadzone
  const k = Math.min(1, d / 40) / d;
  return [dx * k, dy * k];
}
canvas.addEventListener('pointerdown', (e) => {
  setMode('touch'); unlockAudio();
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < r.width / 2 && !joy) { joy = { id: e.pointerId, ox: x, oy: y, x, y }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', (e) => {
  if (!joy || e.pointerId !== joy.id) return;
  const r = canvas.getBoundingClientRect();
  joy.x = e.clientX - r.left; joy.y = e.clientY - r.top;
});
const endJoy = (e) => { if (joy && e.pointerId === joy.id) joy = null; };
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);

const tapBtn = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); setMode('touch'); unlockAudio(); fn(); });
tapBtn('atkBtn', attack); tapBtn('flareBtn', flare); tapBtn('wardBtn', ward); tapBtn('ctxBtn', interact);
$('pauseBtn').addEventListener('click', togglePause);
$('bagBtn').addEventListener('click', () => { if (state === 'play') setState('paused'); });
document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation(); unlockAudio();
  const a = b.dataset.action;
  if (a === 'start' && state === 'title') startIntro();
  if (a === 'next') nextIntro();
  if (a === 'skip') newGame();
  if (a === 'close') setState('play');
  if (a === 'resume') togglePause();
  if (a === 'restart') tryRestart();
}));
$('title').addEventListener('pointerdown', () => { unlockAudio(); if (state === 'title') startIntro(); });
$('read').addEventListener('pointerdown', (e) => { if (e.target.tagName !== 'BUTTON') setState('play'); });

// --- keyboard ---
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.repeat) return;
  setMode('keys'); unlockAudio();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  const ok = k === 'enter' || k === ' ' || k === 'e';
  if (state === 'title') startIntro();
  else if (state === 'intro') { if (k === 'escape') newGame(); else if (ok) nextIntro(); }
  else if (state === 'read') { if (ok || k === 'escape') setState('play'); }
  else if (state === 'paused') {
    if (k === 'arrowup' || k === 'w') moveSel(-1);
    else if (k === 'arrowdown' || k === 's') moveSel(1);
    else if (k === 'enter' || k === ' ') useSel();
    else if (k === 'escape' || k === 'p' || k === 'i') togglePause();
  }
  else if (state === 'win' || state === 'lose') { if (k === 'enter' || k === ' ') tryRestart(); }
  else if (state === 'play') {
    if (k === 'j' || k === ' ') attack();
    else if (k === 'k') flare();
    else if (k === 'l' || k === 'shift') ward();
    else if (k === 'e') interact();
    else if (k === 'escape' || k === 'p' || k === 'i') togglePause();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// --- game controller (Gamepad API) ---
// Browsers don't send events for controller buttons, so we read the
// whole pad every frame and compare with last frame: a press fires
// only on the frame a button goes from up to down.
let padPrev = {}, padStyle = 'ps';
window.addEventListener('gamepadconnected', (e) => {
  padStyle = /xbox/i.test(e.gamepad.id) ? 'xbox' : 'ps';
  toast('Controller connected'); sound('blip'); setMode('pad'); updatePrompt();
});
window.addEventListener('gamepaddisconnected', () => {
  toast('Controller disconnected'); padMove = [0, 0];
  if (inputMode === 'pad') setMode('touch');
});
function pollGamepad() {
  const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
  if (!pad) { padMove = [0, 0]; return; }
  const style = /xbox/i.test(pad.id) ? 'xbox' : 'ps';
  if (style !== padStyle) { padStyle = style; updatePrompt(); }
  const b = (i) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
  let ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  if (Math.hypot(ax, ay) < DEADZONE) ax = ay = 0;
  const dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0), dy = (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
  padMove = dx || dy ? [dx, dy] : [ax, ay];
  const now = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, x: b(0), o: b(1), ward: b(2) || b(7),
    tri: b(3), opt: b(9), any: pad.buttons.some((btn) => btn.pressed) };
  const pressed = (k) => now[k] && !padPrev[k];   // down this frame, up last frame
  if (now.any || ax || ay) setMode('pad');
  if (state === 'title') { if (pressed('any')) { unlockAudio(); startIntro(); } }
  else if (state === 'intro') { if (pressed('opt')) newGame(); else if (pressed('x')) nextIntro(); }
  else if (state === 'read') { if (pressed('x') || pressed('o') || pressed('tri')) setState('play'); }
  else if (state === 'paused') {
    if (pressed('up')) moveSel(-1); if (pressed('down')) moveSel(1);
    if (pressed('x')) useSel(); if (pressed('opt') || pressed('o')) togglePause();
  }
  else if (state === 'win' || state === 'lose') { if (pressed('x') || pressed('opt')) tryRestart(); }
  else if (state === 'play') {
    if (pressed('x')) attack(); if (pressed('o')) flare(); if (pressed('ward')) ward();
    if (pressed('tri')) interact(); if (pressed('opt')) togglePause();
  }
  padPrev = now;                                   // remember for next frame
}
function rumble(ms, strength) {       // only if this browser supports it (iPhone doesn't)
  try {
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    const act = pad && pad.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength }).catch(() => {});
  } catch (e) { /* no rumble, no problem */ }
}

// ============================================================
// INVENTORY (the pause screen)
// ============================================================
let invSel = 0, invRows = [];
function renderInventory() {
  const g = (slot, label) => {
    const id = gear[slot], it = id && ITEMS[id];
    return { html: `${label}: ${it ? `<span class="${it.rarity}">${it.name}</span>` : 'None'}`, info: it ? it.flavor : 'Nothing equipped yet.' };
  };
  invRows = [
    g('sword', 'Sword'), g('torch', 'Torch'), g('armor', 'Armor'), g('ring', 'Ring'),
    { html: `Health Potions x${potions} (use)`, info: ITEMS.potion.flavor, use: () => drinkPotion() || toast(potions ? 'Already at full health.' : 'No potions.') },
    { html: `Torch Oil x${oils} (use)`, info: ITEMS.oil.flavor, use: () => pourOil() || toast(oils ? 'Your light is already full.' : 'No oil.') },
    { html: `<span style="color:#d4af37">${gold} gold</span>`, info: ITEMS.gold.flavor },
    { html: `Music: ${musicOn ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn the music on or off.', use: () => setMusicOn(!musicOn) },
    { html: `Volume: ${'▮'.repeat(Math.round(musicVol * 5))}${'▯'.repeat(5 - Math.round(musicVol * 5))}`, info: 'Tap or press ✕ / Enter to change the volume.',
      use: () => setMusicVol(musicVol >= 1 ? 0.2 : Math.round((musicVol + 0.2) * 10) / 10) },
    // Sound FX rows: sfx.js saves these settings itself (Audio Designer's snippet)
    { html: `Sound FX: ${window.SFX && SFX.enabled ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn sound effects on or off.',
      use: () => { if (window.SFX) SFX.toggle(!SFX.enabled); } },
    { html: `FX Volume: ${'▮'.repeat(Math.round((window.SFX ? SFX.volume : 1) * 5))}${'▯'.repeat(5 - Math.round((window.SFX ? SFX.volume : 1) * 5))}`,
      info: 'Tap or press ✕ / Enter to change the sound effects volume.',
      use: () => { if (window.SFX) { const v = SFX.volume; SFX.setVolume(v >= 0.95 ? 0.2 : Math.round((v + 0.2) * 10) / 10); sound('blip'); } } },
  ];
  invSel = Math.min(invSel, invRows.length - 1);
  const box = $('inv'); box.innerHTML = '';
  invRows.forEach((r, i) => {
    const b = document.createElement('button');
    b.innerHTML = r.html; b.className = i === invSel ? 'sel' : '';
    b.addEventListener('click', () => { if (invSel === i) useSel(); else { invSel = i; renderInventory(); } });
    box.appendChild(b);
  });
  $('invInfo').textContent = invRows[invSel].info;
}
function moveSel(d) { invSel = (invSel + d + invRows.length) % invRows.length; renderInventory(); }
function useSel() { const r = invRows[invSel]; if (r.use) { r.use(); renderInventory(); } }

// ============================================================
// PROMPTS, TOASTS, BANNERS
// ============================================================
function updatePrompt() {
  const p = $('prompt');
  if (state !== 'play') { p.textContent = ''; return; }
  const near = nearbyObject(), act = near ? (near.kind === 'chest' ? 'open' : 'read') : '';
  if (inputMode === 'pad') {
    const L = padStyle === 'xbox' ? ['A', 'B', 'X/RT', 'Y', 'Menu'] : ['✕', '○', '□/R2', '△', 'Options'];
    p.textContent = `${L[0]} attack · ${L[1]} flare · ${L[2]} ward · ${act ? L[3] + ' ' + act + ' · ' : ''}${L[4]} bag`;
  } else if (inputMode === 'keys') {
    p.textContent = `WASD move · J attack · K flare · L ward · ${act ? 'E ' + act + ' · ' : ''}I bag`;
  } else p.textContent = '';
}
let toastTimer;
function toast(html) {
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
let bannerTimer;
function banner(text) {
  const b = $('banner'); b.textContent = text; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 2200);
}

// Pause automatically when you switch apps or tabs
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('paused'); });

// ---------- Sound (Game Artist's synthesized sounds in assets/sfx.js) ----------
// iPhone (Safari, and Edge/Chrome on iPhone, which all use WebKit) is strict about sound:
//  1. Sound only unlocks inside a real tap (touchend/click) or key press, NOT a gamepad button.
//  2. The ring/silent switch mutes Web Audio unless the page says it is a "playback" app.
let audio = null, silentOK = false;
const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS 17+
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (!audio) return;
  if (audio.state !== 'running') audio.resume().catch(() => {});
  // Old trick: play a 1-sample silent sound right now, inside the tap, to wake the speaker up
  try { const s = audio.createBufferSource(); s.buffer = audio.createBuffer(1, 1, 22050); s.connect(audio.destination); s.start(0); } catch (e) {}
  // Older iOS: a looping silent <audio> tag moves the page to the "media" channel, so the silent switch won't mute it
  if (!silentOK) {
    const el = new Audio(SILENT_WAV); el.loop = true; el.setAttribute('playsinline', '');
    el.play().then(() => { silentOK = true; }).catch(() => {});
  }
  audio.onstatechange = updateSoundTip;
  updateSoundTip();
}
// Real taps and key presses anywhere on the page unlock audio (capture = runs before other handlers)
['touchend', 'click', 'keydown'].forEach((t) => window.addEventListener(t, unlockAudio, { capture: true, passive: true }));
// If a controller started the game, sound may still be locked, so ask for one tap
function updateSoundTip() {
  const locked = !audio || audio.state !== 'running';
  $('soundTip').hidden = !(locked && inputMode === 'pad' && state !== 'title');
}
function sound(name) { if (window.SFX) SFX.play(audio, name); }
