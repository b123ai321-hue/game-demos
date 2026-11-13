// ============================================================
// GRAVELIGHT 3D - a pixelated first-person dungeon crawl
// Three.js draws the 3D world into a tiny picture (240 pixels tall),
// then CSS stretches it with chunky pixels. HUD and buttons are HTML.
// Art:   assets/sprites.js (Art, Game Artist) + assets/art3d.js (backup art)
// Sound: assets/sfx.js (SFX) + assets/music.js (Music)
// Anything missing falls back to something simple, so it never crashes.
// ============================================================
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ---------- Tuning (1 unit = 1 map tile) ----------
const BUFFER_H = 240;             // height of the low-res picture in pixels
const WALL_H = 1.4, EYE = 0.62;   // wall height and camera height
const MAX_HP = 5, MAX_FUEL = 100, FUEL_DRAIN = 1.1;
const SPEED = 2.6, TURN = 2.6;    // tiles per second, radians per second
const TOUCH_TURN = 0.009, MOUSE_TURN = 0.0028;   // radians per pixel dragged
const ATTACK_CD = 0.35, FLARE_CD = 8, FLARE_COST = 20, WARD_CD = 4;
const DEADZONE = 0.2, MAX_AWAKE = 8;

// ---------- The 3 floors, drawn as text ----------
// # wall  . floor  S start  > stairs (sealed until you hold the Ember)
// D vault door  T tomb door  K key  E Ember  A altar  C chest  L lore spot
// o oil  p potion  s shade  w wisp  c crawler  W Ossuary Warden  H Hollow King
const MAPS = [
  [ // Floor 1: The Crypt
    '#######################',
    '#.....#####...........#',
    '#..S..#####..C....L...#',
    '#.....................#',
    '#.....#####....s......#',
    '###.#######...........#',
    '###.###########.#######',
    '#.......#######.#######',
    '#..K.s..#######.#######',
    '#.......#.............#',
    '#...L...........s.....#',
    '#.......#.............#',
    '#########.....o.......#',
    '##########.########D###',
    '##########.#######...##',
    '#......###.#######.E.##',
    '#..>...w...#######...##',
    '#......################',
    '#######################',
  ],
  [ // Floor 2: The Catacombs
    '#######################',
    '#.......#####.........#',
    '#...S...#####...C.....#',
    '#.............L...w...#',
    '#.......#####.........#',
    '####.#########.########',
    '####.#########.########',
    '#.......###...........#',
    '#..c.o..###...........#',
    '#..........s....W.....#',
    '#...L...###...........#',
    '#.......###...........#',
    '####.######....p......#',
    '####.##################',
    '#......#######.......##',
    '#..c...........>.....##',
    '#...o..#######.......##',
    '#######################',
  ],
  [ // Floor 3: The Hollow King's Tomb
    '#########################',
    '#.......######..........#',
    '#...S...######..L...K...#',
    '#...................s...#',
    '#.......######..........#',
    '####.##########.#########',
    '####.##########.#########',
    '#.......####.........####',
    '#.C..s..####....A....####',
    '#...........w........####',
    '#.L.....####.........####',
    '#.......#######T#########',
    '####D##########.#########',
    '###...#####.............#',
    '###.E.#####.............#',
    '###...#####......H......#',
    '###.o.#####.............#',
    '###########.............#',
    '#########################',
  ],
];
const FLOORS = [
  { name: 'The Crypt', key: 'bonekey', ember: 'Ember of the Crypt', fog: 0x05030a },
  { name: 'The Catacombs', ember: 'Ember of the Catacombs', fog: 0x02040a },
  { name: "The Hollow King's Tomb", key: 'gildedkey', ember: 'Ember of the Tomb', fog: 0x000000 },
];

// ---------- Items ----------
const ITEMS = {
  rusted:     { name: 'Rusted Blade',     slot: 'sword', rarity: 'common',   rank: 0, flavor: 'It has seen better centuries.' },
  gravesteel: { name: 'Gravesteel Sword', slot: 'sword', rarity: 'uncommon', rank: 1, flavor: 'Forged from melted coffin nails. +1 damage.' },
  pitch:      { name: 'Pitch Torch',      slot: 'torch', rarity: 'common',   rank: 0, flavor: 'Smoky, sticky, and yours.' },
  everember:  { name: 'Everember Torch',  slot: 'torch', rarity: 'rare',     rank: 1, flavor: 'Its flame breathes slowly. Bigger light, burns 30% longer.' },
  chain:      { name: 'Chain Shroud',     slot: 'armor', rarity: 'uncommon', rank: 1, flavor: 'Crypt-gate links sewn into cloth. Every third blow slides off.' },
  embers:     { name: 'Ring of Embers',   slot: 'ring',  rarity: 'uncommon', rank: 1, flavor: 'Warm to the touch. Kills feed the flame twice as much.' },
  bonekey:    { name: 'Bone Key',   rarity: 'quest', flavor: "Carved from a giant's knuckle. It opens the Crypt Vault." },
  gildedkey:  { name: 'Gilded Key', rarity: 'quest', flavor: 'Heavy, cold, and stamped with a crown. It opens the Tomb Vault.' },
  potion:     { name: 'Health Potion', rarity: 'common', flavor: 'Tastes like pennies and pine. Heals 2 hearts.' },
  oil:        { name: 'Torch Oil',     rarity: 'common', flavor: 'Thick lamp oil. Refills 40% of your light.' },
  gold:       { name: 'Gold',          rarity: 'common', flavor: 'Old coins stamped with a king nobody misses.' },
};
const CHESTS = [['gravesteel'], ['chain'], ['embers']];   // what each floor's chests hold, in order

// ---------- Story ----------
const INTRO = [
  'You are Aldren, the last Lamplighter of Mirehollow. For three hundred years your family has kept the village lamps burning through the night.',
  'Then the Hollow King woke in his crypt, and shattered the Gravelight, the first flame of dawn, into three Embers. He hid one on each floor below.',
  'Your torch is only a splinter of that flame, and it is shrinking. Find the 3 Embers. Relight the altar. End the Hollow King.',
];
const EMBER_STORY = [
  'The Ember of the Crypt flares in your hand, warm as a heartbeat. Your torch drinks from it and burns bright again.\n\nThe black veil over the stairs shivers and tears.',
  'The Warden falls apart, and the Ember of the Catacombs rolls out from between its ribs.\n\nFar below, something enormous turns over in its sleep.',
  'The last Ember. The three shards hum together and pull you toward the altar outside the King\'s tomb.',
];
const ALTAR_STORY = 'You set the three Embers on the altar. The Gravelight roars back to life, white and gold, and the tomb door grinds open.\n\nThe Hollow King is awake.';
const LORE = [
  ['Here lies Old Wick, lamplighter. He kept the dark out for sixty winters. Keep it out for sixty more.',
   'Where the light fails, the Shades walk. Where the Shades walk, nothing grows.'],
  ["Wisps are a candle's last breath. They fear a strong flame, and they wait for it to weaken.",
   'The Warden guards what the King loves most. It charges in a straight line. Step aside.'],
  ['Bow to the Hollow King, who wears the night like a crown.',
   'A shard of the night sleeps in his chest. Break the king, and the shard breaks with him.'],
];
const LORE_ART = ['tomb', 'scroll', 'carving'];

// ============================================================
// PAGE + THREE.JS SETUP
// ============================================================
const $ = (id) => document.getElementById(id);
const gameEl = $('game'), viewEl = $('view');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);                     // we choose the exact tiny size ourselves
  renderer.domElement.className = 'gl';
  viewEl.prepend(renderer.domElement);
} catch (e) { $('titleNote').textContent = 'Sorry, this browser cannot draw 3D (WebGL is off).'; }

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 1, 7);         // darkness beyond your torchlight
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 40);
const torch = new THREE.PointLight(0xffa050, 4, 9, 1);   // the torch rides along with the camera
torch.position.set(0.15, -0.05, 0);
camera.add(torch);
scene.add(camera);
scene.add(new THREE.AmbientLight(0x6a5a90, 0.5));  // a little light so you're never fully blind

// Size the view: on a tall phone the 3D view is the top part and the controls get the bottom.
let viewH = 0;
function resize() {
  const w = gameEl.clientWidth, h = gameEl.clientHeight;
  const portrait = w / h < 0.8;
  viewH = portrait ? Math.round(Math.max(h * 0.5, Math.min(h - 300, w * 1.3))) : h;
  viewEl.style.height = viewH + 'px';
  $('sword').style.width = Math.round(Math.min(w * 0.34, viewH * 0.4, 220)) + 'px';   // sword fits short views too
  $('bossBar').style.top = Math.round(viewH * 0.8) + 'px';   // low in the view, clear of the compass
  if (!renderer) return;
  renderer.setSize(Math.round(BUFFER_H * w / viewH), BUFFER_H, false);  // e.g. 185 x 240
  camera.aspect = w / viewH;
  camera.fov = portrait ? 72 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Pixel textures ----------
// Sprites come from Game Artist's Art first, then our backup Art3D.
function artSource(name) {
  if (typeof Art !== 'undefined' && Art.has && Art.has(name)) return Art;
  if (window.Art3D && Art3D.has(name)) return Art3D;
  return null;
}
function drawArt(ctx, name, x, feetY, o) {
  const src = artSource(name);
  if (!src) return false;
  try { src.draw(ctx, name, x, feetY, o); return true; } catch (e) { return false; }
}
const texCache = {};
// Paint a small canvas once and turn it into a crisp (NearestFilter) texture.
function pixelTex(key, w, h, paint) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  paint(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[key] = t);
}
// Random speckles, used when a tile picture is missing
function speckle(ctx, colors) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = colors[(x * 7 + y * 13 + x * y) % colors.length]; ctx.fillRect(x, y, 1, 1);
  }
}
const tileTex = (name, colors) => pixelTex(name, 16, 16, (ctx) => { if (!drawArt(ctx, name, 8, 16, { scale: 1 })) speckle(ctx, colors); });
// Sprites are painted feet-down in the middle of a 32x32 canvas (big enough for every v2 sprite).
const spriteTex = (name, frame = 0) => pixelTex(name + '#' + frame, 32, 32, (ctx) => {
  if (!drawArt(ctx, name, 16, 32, { frame, scale: 1 })) { ctx.fillStyle = '#f0f'; ctx.fillRect(11, 18, 10, 14); }
});
// A soft round glow for Embers and the altar flame
const glowTex = pixelTex('glow', 16, 16, (ctx) => {
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,200,90,1)'); g.addColorStop(0.5, 'rgba(255,120,30,.45)'); g.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
});

// ---------- Seeded-free helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ============================================================
// BUILDING A FLOOR
// ============================================================
let grid = [], group = null, objects = [], enemies = [], pickups = [], rings = [], effects = [];
let spots = {}, doors = {}, veil = null;
const player = { x: 0, z: 0, a: 0, r: 0.25, kx: 0, kz: 0 };
const run = {};   // everything about the current game (filled in by newGame)

const tile = (x, z) => (grid[Math.floor(z)] || '')[Math.floor(x)] || '#';
// Can you walk here? Walls, closed doors and the sealed stairs block you.
function solid(x, z) {
  const t = tile(x, z);
  return t === '#' || t === 'D' || t === 'T' || (t === '>' && !run.embers[run.floor]);
}
function setTile(x, z, ch) { const r = grid[z]; grid[z] = r.slice(0, x) + ch + r.slice(x + 1); }

function buildFloor(n) {
  if (group) {                                     // throw away the old floor's meshes
    group.traverse((o) => { if (o.geometry && !o.geometry.shared) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    scene.remove(group);
  }
  group = new THREE.Group(); scene.add(group);
  run.floor = n;
  grid = MAPS[n].slice();
  objects = []; enemies = []; pickups = []; rings = []; effects = []; spots = {}; doors = {};
  const H = grid.length, W = grid[0].length, num = n + 1;
  scene.fog.color.setHex(FLOORS[n].fog); scene.background.setHex(FLOORS[n].fog);

  // --- read the map letters ---
  let chest = 0, lore = 0;
  const wallCells = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = grid[z][x], pos = { x: x + 0.5, z: z + 0.5 };
    if (ch === '#') { if (nearFloor(x, z)) wallCells.push([x, z]); continue; }
    if ('SKEopCLAswcWH'.includes(ch)) setTile(x, z, '.');   // becomes plain floor
    if (ch === 'S') { player.x = pos.x; player.z = pos.z; }
    if (ch === 'K') spots.key = addPickup(FLOORS[n].key, pos);
    if (ch === 'E') spots.ember = addPickup('ember', pos);
    if (ch === 'o') addPickup('oil', pos);
    if (ch === 'p') addPickup('potion', pos);
    if (ch === 'C') addObject({ kind: 'chest', item: CHESTS[n][chest++] || 'oil', open: false, ...pos }, 'chest', 1);
    if (ch === 'L') { addObject({ kind: 'lore', text: LORE[n][lore % LORE[n].length], ...pos }, LORE_ART[lore % 3], 1); lore++; }
    if (ch === 'A') spots.altar = addObject({ kind: 'altar', ...pos }, 'altar', 0.85);
    if (ch === 's') enemies.push(makeEnemy('shade', pos));
    if (ch === 'w') enemies.push(makeEnemy('wisp', pos));
    if (ch === 'c') enemies.push(makeEnemy('crawler', pos));
    if (ch === 'W') enemies.push(spots.warden = makeEnemy('warden', pos));
    if (ch === 'H') enemies.push(spots.king = makeEnemy('king', pos));
    if (ch === 'D' || ch === 'T') {
      const tex = ch === 'D' ? tileTex('vaultDoor', ['#6b4a2b', '#3d2a55']) : tileTex('tombDoor', ['#0b0612', '#d4af37']);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_H, 1), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(pos.x, WALL_H / 2, pos.z); group.add(m);
      doors[x + ',' + z] = m;
      spots[ch === 'D' ? 'door' : 'tomb'] = { ...pos, tx: x, tz: z };
    }
    if (ch === '>') {
      spots.stairs = { ...pos };
      // the stairs picture on the floor: sealed version first, swapped for open stairs later
      const stairs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: tileTex('stairsVeiled' + num, ['#000', '#2b1044']) }));
      stairs.rotation.x = -Math.PI / 2; stairs.position.set(pos.x, 0.01, pos.z); group.add(stairs);
      spots.stairs.mesh = stairs;
      // the black veil: a shimmering dark block that melts away when you get the Ember
      const vt = pixelTex('veil', 16, 16, (ctx) => speckle(ctx, ['#0b0612', '#2b1044', '#4a1d6e', '#0b0612', '#1c1128'])).clone();
      vt.wrapS = vt.wrapT = THREE.RepeatWrapping; vt.needsUpdate = true;
      veil = new THREE.Mesh(new THREE.BoxGeometry(0.98, WALL_H, 0.98), new THREE.MeshBasicMaterial({ map: vt, color: 0x9a70d0, transparent: true, opacity: 0.85 }));
      veil.position.set(pos.x, WALL_H / 2, pos.z); group.add(veil);
    }
  }
  if (n !== 2) spots.tomb = null;

  // --- walls: ONE InstancedMesh = one draw call for every wall block ---
  const wallGeo = new THREE.BoxGeometry(1, WALL_H, 1);
  const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshLambertMaterial({ map: tileTex('wall' + num, ['#1b1822', '#3b3547']) }), wallCells.length);
  const m4 = new THREE.Matrix4();
  wallCells.forEach(([x, z], i) => walls.setMatrixAt(i, m4.makeTranslation(x + 0.5, WALL_H / 2, z + 0.5)));
  group.add(walls);

  // --- floor and ceiling: one big textured rectangle each ---
  const floorTex = tileTex('floor' + num, ['#1d1924', '#2a2533']).clone();
  const ceilTex = pixelTex('ceil' + num, 16, 16, (ctx) => {
    if (!drawArt(ctx, 'floor' + num, 8, 16, { scale: 1 })) speckle(ctx, ['#1d1924', '#2a2533']);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, 16, 16);
  }).clone();
  for (const [t, y, rot] of [[floorTex, 0, -Math.PI / 2], [ceilTex, WALL_H, Math.PI / 2]]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W, H); t.needsUpdate = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: t }));
    plane.rotation.x = rot; plane.position.set(W / 2, y, H / 2); group.add(plane);
  }
  banner(`Floor ${num}: ${FLOORS[n].name}`);
  player.a = firstOpenDirection();
}
// Is this wall touching a floor tile? (hidden walls are never drawn)
function nearFloor(x, z) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (tile(x + i, z + j) !== '#') return true;
  return false;
}
// Start each floor facing the longest open direction
function firstOpenDirection() {
  let best = 0, bestLen = -1;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2; let len = 0;
    while (len < 20 && !solid(player.x + Math.cos(a) * (len + 1), player.z + Math.sin(a) * (len + 1))) len++;
    if (len > bestLen) { bestLen = len; best = a; }
  }
  return best;
}

// ---------- Billboard sprites (they always face the camera) ----------
function makeSprite(name, k) {
  const mat = new THREE.SpriteMaterial({ map: spriteTex(name), alphaTest: 0.5, fog: true });
  const s = new THREE.Sprite(mat);
  s.center.set(0.5, 0);            // anchor at the feet
  s.scale.set(2 * k, 2 * k, 1);    // 32px canvas; k = 1 means 16 pixels per tile
  group.add(s);
  return s;
}
function makeGlow(size) {
  const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  g.scale.set(size, size, 1); group.add(g); return g;
}
function removeSprite(s) { if (s) { group.remove(s); s.material.dispose(); } }
function addObject(o, art, k) {
  o.sprite = makeSprite(art, k); o.sprite.position.set(o.x, 0, o.z);
  if (o.kind === 'altar') { o.glow = makeGlow(1.2); o.glow.visible = false; }
  objects.push(o); return o;
}
const PICKUP_ART = { bonekey: 'boneKey', gildedkey: 'gildedKey', ember: 'ember' };
function addPickup(item, pos) {
  const p = { item, x: pos.x, z: pos.z, t: Math.random() * 6 };
  p.sprite = makeSprite(PICKUP_ART[item] || 'item_' + item, item === 'ember' ? 0.9 : 0.7);
  if (item === 'ember') p.glow = makeGlow(1.1);
  pickups.push(p); return p;
}

// ============================================================
// ENEMIES
// ============================================================
const ENEMY_STATS = {        // speed in tiles per second, r = body radius, k = sprite size
  shade:   { hp: 2,  speed: 1.6, r: 0.3,  k: 1.3, art: 'shade' },
  wisp:    { hp: 1,  speed: 2.6, r: 0.25, k: 1.1, art: 'wisp', lift: 0.25 },
  crawler: { hp: 4,  speed: 1.0, r: 0.35, k: 1.3, art: 'crawler' },
  warden:  { hp: 12, speed: 1.2, r: 0.5,  k: 1.15, art: 'warden' },
  king:    { hp: 24, speed: 0.9, r: 0.55, k: 1.05, art: 'king' },
};
function makeEnemy(type, pos) {
  const s = ENEMY_STATS[type];
  const art = artSource(s.art) ? s.art : 'crawler';   // no Warden art yet? use a big red crawler
  const e = { type, x: pos.x, z: pos.z, hp: s.hp, maxHp: s.hp, speed: s.speed, r: s.r, t: Math.random() * 9, art,
    mode: 'walk', timer: 0, cd: 0, dx: 0, dz: 0, kx: 0, kz: 0, flash: 0, back: 0, awake: false, ringT: 3, summoned: false };
  e.sprite = makeSprite(art, s.k);
  e.tint = type === 'warden' && art === 'crawler' ? [1, 0.6, 0.5] : [1, 1, 1];
  if (art === 'crawler' && type === 'warden') e.sprite.scale.multiplyScalar(1.8);
  return e;
}
// Straight-line check: can a sees b without a wall in between?
function canSee(a, b) {
  const d = dist(a, b), n = Math.ceil(d / 0.25);
  for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n)) return false;
  return true;
}
// Is a round body of radius r touching anything solid? (checks its 4 corners)
const blocked = (x, z, r) => solid(x - r, z - r) || solid(x + r, z - r) || solid(x - r, z + r) || solid(x + r, z + r);
// Move one axis at a time, so you slide along walls instead of sticking
function moveBody(b, dx, dz) {
  let hit = false;
  if (!blocked(b.x + dx, b.z, b.r)) b.x += dx; else hit = true;
  if (!blocked(b.x, b.z + dz, b.r)) b.z += dz; else hit = true;
  return hit;
}

function updateEnemy(e, dt) {
  e.t += dt; e.flash -= dt; e.back -= dt; e.cd -= dt;
  const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz) || 1;
  const ux = dx / d, uz = dz / d;
  // wake up when you're close and in sight (the King waits for the altar)
  if (e.type === 'king') e.awake = run.relit;
  else if (!e.awake && d < 7 && awakeCount() < MAX_AWAKE && canSee(e, player)) e.awake = true;
  else if (e.awake && d > 12) e.awake = false;
  let vx = 0, vz = 0;
  if (e.awake) {
    if (e.type === 'shade') { vx = ux; vz = uz; }
    else if (e.type === 'wisp') {
      if (e.back > 0) { vx = -ux; vz = -uz; }                                       // backing off after a hit
      else if (run.fuel > 50 && d < lightR() * 0.6) { vx = -ux * 0.4 - uz; vz = -uz * 0.4 + ux; } // circles strong light
      else { const zz = Math.sin(e.t * 6); vx = ux - uz * zz; vz = uz + ux * zz; }  // zigzag in
    } else if (e.type === 'crawler' || e.type === 'warden') {
      if (e.mode === 'walk') {
        vx = ux; vz = uz;
        if (d < 5 && e.cd <= 0 && canSee(e, player)) { e.mode = 'wind'; e.timer = 0.6; e.dx = ux; e.dz = uz; } // aim...
      } else if (e.mode === 'wind') { if ((e.timer -= dt) <= 0) { e.mode = 'charge'; e.timer = 0.8; } }  // ...wait...
      else if (e.mode === 'charge') {                                                                // ...CHARGE!
        const hit = moveBody(e, e.dx * 5.5 * dt, e.dz * 5.5 * dt);
        if ((e.timer -= dt) <= 0 || hit) { e.mode = 'walk'; e.cd = e.type === 'warden' ? 1.6 : 2; }
      }
    } else if (e.type === 'king') {
      vx = ux; vz = uz;
      if (!e.roared) { e.roared = true; sound('roar'); }
      if ((e.ringT -= dt) <= 0) { e.ringT = 3.5; addRing(e); sound('ring'); }
      if (!e.summoned && e.hp <= e.maxHp / 2) {
        e.summoned = true; sound('roar');
        for (const side of [-1, 1]) {
          const s = makeEnemy('shade', { x: e.x + uz * side * 0.8, z: e.z - ux * side * 0.8 });
          if (blocked(s.x, s.z, s.r)) { s.x = e.x; s.z = e.z; }
          s.awake = true; enemies.push(s);
        }
      }
    }
  }
  const sp = e.mode === 'walk' ? e.speed : 0, len = Math.hypot(vx, vz) || 1;
  moveBody(e, (vx / len * sp + e.kx) * dt, (vz / len * sp + e.kz) * dt);
  const fade = Math.exp(-8 * dt); e.kx *= fade; e.kz *= fade;           // knockback fades
  if (e.awake && d < e.r + player.r + 0.05) {                             // touching you hurts
    const wasCharging = e.mode === 'charge';
    if (hurtPlayer(e.type === 'king' ? 2 : 1) && e.type === 'warden' && wasCharging) {
      player.kx = e.dx * 7; player.kz = e.dz * 7;                         // the Warden's charge knocks you back
    }
    if (e.type === 'wisp') e.back = 1;
  }
}
const awakeCount = () => enemies.reduce((n, e) => n + (e.awake ? 1 : 0), 0);

// The Hollow King's darkness rings: flat purple rings that grow along the floor
const ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
ringGeo.shared = true;
function addRing(e) {
  const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8b3dff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false }));
  mesh.position.set(e.x, 0.05, e.z); group.add(mesh);
  rings.push({ x: e.x, z: e.z, r: 0.6, mesh, hit: false });
}

// ============================================================
// GAME STATE
// ============================================================
let state = 'title', introPage = 0, endedAt = 0, storyThen = null, storyAt = 0;
const screenIds = ['title', 'intro', 'story', 'paused', 'win', 'lose'];

function newGame() {
  Object.assign(run, {
    hp: MAX_HP, fuel: MAX_FUEL, gold: 0, potions: 1, oils: 1, time: 0, floor: 0,
    gear: { sword: 'rusted', torch: 'pitch', armor: null, ring: null },
    keys: { bonekey: false, gildedkey: false }, embers: [false, false, false], relit: false,
    atkCd: 0, atkAnim: 0, flareCd: 0, wardCd: 0, inv: 0, hitsTaken: 0, darkTimer: 0, walkT: 0, nagCd: 0, flash: 0,
  });
  player.kx = player.kz = 0;
  buildFloor(0);
  setState('play');
}
function setState(s) {
  state = s;
  if (s === 'win' || s === 'lose') {
    endedAt = performance.now();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (s === 'win') $('winStats').textContent = `Gold: ${run.gold}. Time: ${Math.floor(run.time / 60)}m ${Math.floor(run.time % 60)}s.`;
  if (s === 'lose') $('loseStats').textContent = `You reached floor ${run.floor + 1}: ${FLOORS[run.floor].name}. Embers: ${emberCount()}/3.`;
  for (const id of screenIds) $(id).classList.toggle('show', id === s);
  if (s === 'paused') renderInventory();
  updatePrompt();
}
function tryRestart() {           // 0.8s lockout so a mashed button can't skip the ending
  if (performance.now() - endedAt > 800) { introPage = 0; newGame(); return true; }
  return false;
}
function togglePause() {
  if (state === 'play') setState('paused');
  else if (state === 'paused') setState('play');
}
// Show a short story card over the paused game. then() runs after Continue.
function story(text, kind, then) {
  $('storyText').textContent = text;
  $('storyText').style.whiteSpace = 'pre-line';
  $('story').className = 'screen ' + kind;
  storyThen = then || null; storyAt = performance.now();
  setState('story');
}
// (ignore taps in the first 0.4s, so the same tap that opened the card can't close it)
function closeStory() { if (performance.now() - storyAt < 400) return; setState('play'); const f = storyThen; storyThen = null; if (f) f(); }

function startIntro() { startMusic(); setTimeout(updateSoundTip, 300); introPage = 0; $('introText').textContent = INTRO[0]; setState('intro'); }
function nextIntro() {
  introPage++;
  if (introPage >= INTRO.length) return newGame();
  $('introText').textContent = INTRO[introPage];
}

const emberCount = () => run.embers.filter(Boolean).length;
const damage = () => 1 + ITEMS[run.gear.sword].rank;
// How far your torch reaches, in tiles. It shrinks as the fuel burns.
const lightR = () => run.fuel <= 0 ? 2 : 3 + run.fuel * 0.04 + (run.gear.torch === 'everember' ? 1.5 : 0);

// ---------- The current objective (the HUD line + where the compass points) ----------
function objective() {
  const f = run.floor, F = FLOORS[f];
  if (f === 0 || f === 2) {
    const keyName = ITEMS[F.key].name;
    if (!run.keys[F.key] && doors[spots.door.tx + ',' + spots.door.tz]) return { text: `Find the ${keyName}`, target: spots.key };
    if (doors[spots.door.tx + ',' + spots.door.tz]) return { text: `Open the Vault with the ${keyName}`, target: spots.door };
  }
  if (f === 1 && enemies.includes(spots.warden)) return { text: 'Defeat the Ossuary Warden', target: spots.warden };
  if (!run.embers[f]) return { text: `Take the ${F.ember} 0/1`, target: spots.ember };
  if (f < 2) return { text: 'Take the stairs down', target: spots.stairs };
  if (!run.relit) return { text: 'Relight the Altar (3/3 Embers)', target: spots.altar };
  return { text: 'Defeat the Hollow King', target: enemies.includes(spots.king) ? spots.king : null };
}

// ============================================================
// ACTIONS
// ============================================================
const facing = () => ({ x: Math.cos(player.a), z: Math.sin(player.a) });
function attack() {
  if (state !== 'play' || run.atkCd > 0) return;
  run.atkCd = ATTACK_CD; run.atkAnim = 0.25; sound('swing');
  // hit the nearest enemy that is close AND roughly in front of you
  const f = facing(); let best = null, bestD = 99;
  for (const e of enemies) {
    const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz);
    const inFront = d < 0.5 || (dx * f.x + dz * f.z) / d > 0.55;     // dot product: 1 = straight ahead
    if (d < 1.3 + e.r && inFront && d < bestD) { best = e; bestD = d; }
  }
  if (best) hurtEnemy(best, damage(), (best.x - player.x) / bestD || 0, (best.z - player.z) / bestD || 0);
}
function flare() {
  if (state !== 'play' || run.flareCd > 0 || run.fuel < 5) return;
  run.flareCd = FLARE_CD; run.fuel = Math.max(0, run.fuel - FLARE_COST);
  flash('#ffb347', 0.7); sound('flare'); rumble(120, 0.4);
  for (const e of [...enemies]) if (dist(e, player) < 3.2) hurtEnemy(e, e.type === 'king' ? 3 : e.type === 'warden' ? 4 : 99, 0, 0);
}
function ward() {
  if (state !== 'play' || run.wardCd > 0) return;
  run.wardCd = WARD_CD; flash('#b9a6e8', 0.45); sound('ward');
  for (const e of enemies) {
    const d = dist(e, player) || 1;
    if (d < 3.5 && e.type !== 'king') { e.kx = (e.x - player.x) / d * 7; e.kz = (e.z - player.z) / d * 7; e.mode = 'walk'; e.cd = 1; }
  }
  // Ward also breaks the Hollow King's darkness rings near you
  rings = rings.filter((g) => { const near = Math.abs(dist(g, player) - g.r) < 3.5; if (near) group.remove(g.mesh); return !near; });
}
// The closest thing you can use right now (chest, lore, door, altar), or null
function nearbyThing() {
  let best = null, bestD = 1.35;
  const check = (o, kind, bonus = 0) => { const d = dist(o, player) - bonus; if (d < bestD) { best = { o, kind }; bestD = d; } };
  for (const o of objects) if (!(o.kind === 'chest' && o.open) && !(o.kind === 'altar' && run.relit)) check(o, o.kind);
  if (spots.door && doors[spots.door.tx + ',' + spots.door.tz] && run.keys[FLOORS[run.floor].key]) check(spots.door, 'door', 0.3);  // doors win ties
  return best;
}
function interact() {
  if (state !== 'play') return;
  const n = nearbyThing();
  if (!n) return;
  const o = n.o;
  if (n.kind === 'chest') { o.open = true; o.sprite.material.map = spriteTex('chestOpen'); sound('chest'); run.gold += 10 + run.floor * 10; grantItem(o.item); }
  else if (n.kind === 'lore') { sound('blip'); story(o.text, 'lore'); }
  else if (n.kind === 'door') openDoor(spots.door);
  else if (n.kind === 'altar') {
    if (emberCount() < 3) { toast(`The altar is cold. It needs 3 Embers (you have ${emberCount()}).`); return; }
    run.relit = true; sound('relight');
    o.sprite.material.map = altarLit(); o.glow.visible = true;
    story(ALTAR_STORY, 'ember', () => { openDoor(spots.tomb); banner('The tomb is open'); });
  }
}
// Lit altar = frame 1 of the altar sprite
const altarLit = () => spriteTex('altar', 1);
function openDoor(s) {
  const key = s.tx + ',' + s.tz, m = doors[key];
  if (!m) return;
  group.remove(m); m.geometry.dispose(); m.material.dispose(); delete doors[key];
  setTile(s.tx, s.tz, '.'); sound('door');
  if (s === spots.door) toast('The Vault door swings open.');
}
function grantItem(id) {
  const it = ITEMS[id], tag = `<span class="${it.rarity}">${it.name}</span>`;
  if (id === 'gold') { run.gold += 5 + run.floor * 5; sound('coin'); return; }
  if (id === 'potion') { run.potions++; sound('pickup'); return toast(`${tag}<br>${it.flavor}`); }
  if (id === 'oil') { run.oils++; sound('pickup'); return toast(`${tag}<br>Poured automatically when your light runs low.`); }
  if (it.rarity === 'quest') { run.keys[id] = true; sound('key'); return toast(`You found the ${tag}!<br>${it.flavor}`); }
  sound('pickup');
  const cur = run.gear[it.slot];
  if (!cur || ITEMS[cur].rank < it.rank) { run.gear[it.slot] = id; toast(`Equipped ${tag}<br>${it.flavor}`); }
  else { run.gold += 15; toast(`${tag}<br>Not better than yours. Sold for 15 gold.`); }
}
function takeEmber() {
  const f = run.floor;
  run.embers[f] = true; run.fuel = MAX_FUEL; sound('ember'); rumble(250, 0.6);
  if (veil) { group.remove(veil); veil = null; }        // the stairs' veil melts away
  if (spots.stairs) spots.stairs.mesh.material.map = tileTex('stairs' + (f + 1), ['#000', '#333']);
  story(EMBER_STORY[f], 'ember');
}
function drinkPotion() {
  if (run.potions <= 0 || run.hp >= MAX_HP) return false;
  run.potions--; run.hp = Math.min(MAX_HP, run.hp + 2); sound('gulp'); return true;
}
function pourOil() {
  if (run.oils <= 0 || run.fuel > 90) return false;
  run.oils--; run.fuel = Math.min(MAX_FUEL, run.fuel + 40); sound('pickup'); return true;
}
function hurtEnemy(e, dmg, nx, nz) {
  e.hp -= dmg; e.flash = 0.15;
  if (e.type !== 'king' && e.type !== 'warden') { e.kx = nx * 5; e.kz = nz * 5; }
  e.awake = true; sound('burn');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  enemies.splice(enemies.indexOf(e), 1); removeSprite(e.sprite);
  addPuff(e);
  run.fuel = Math.min(MAX_FUEL, run.fuel + (run.gear.ring === 'embers' ? 8 : 4));
  if (e.type === 'king') { sound('dawn'); return setState('win'); }
  if (e.type === 'warden') {                                  // drops the Ember and a torch
    spots.ember = addPickup('ember', e);
    addPickup('everember', { x: e.x + 0.4, z: e.z });
    return;
  }
  const roll = Math.random();
  const drop = roll < 0.25 ? 'gold' : roll < 0.4 ? 'oil' : roll < 0.48 ? 'potion' : null;
  if (drop) addPickup(drop, e);
}
function addPuff(e) { const s = makeSprite('puff', 0.8); s.position.set(e.x, 0.3, e.z); effects.push({ s, t: 0 }); }
function hurtPlayer(n) {
  if (run.inv > 0 || state !== 'play') return false;
  run.inv = 1;
  if (run.gear.armor === 'chain' && ++run.hitsTaken % 3 === 0) { toast('The Chain Shroud blocks the blow!'); return true; }
  run.hp -= n; sound('hit'); rumble(200, 0.8); flash('#ff2040', 0.5);
  if (run.hp === 1) drinkPotion();          // auto-drink at 1 heart
  if (run.hp <= 0) { run.hp = 0; setState('lose'); }
  return true;
}
function flash(color, strength) { $('flash').style.background = color; run.flash = strength; }

// ============================================================
// UPDATE (runs every frame while playing)
// ============================================================
function update(dt) {
  run.time += dt;
  run.atkCd -= dt; run.atkAnim -= dt; run.flareCd -= dt; run.wardCd -= dt; run.inv -= dt; run.nagCd -= dt;

  // --- torch fuel: your light is your timer ---
  run.fuel -= FUEL_DRAIN * (run.gear.torch === 'everember' ? 0.7 : 1) * dt;
  if (run.fuel < 5 && run.oils > 0) pourOil();
  if (run.fuel <= 0) {
    run.fuel = 0; run.darkTimer += dt;
    if (run.darkTimer >= 2) { run.darkTimer = 0; run.inv = 0; hurtPlayer(1); }
  } else run.darkTimer = 0;

  // --- turning and walking ---
  player.a += turnInput() * TURN * dt;
  const [sx, fw] = moveInput();
  const len = Math.hypot(sx, fw);
  if (len > 0.05) {
    const k = Math.min(1, len) / len, f = facing();
    // forward uses the facing direction, strafe uses the direction to your right
    const dx = (f.x * fw - f.z * sx) * k, dz = (f.z * fw + f.x * sx) * k;
    moveBody(player, dx * SPEED * dt, dz * SPEED * dt);
    run.walkT += dt * Math.min(1, len);
    if (Math.floor(run.walkT * 2.2) !== Math.floor((run.walkT - dt) * 2.2)) sound('step');
  }
  if (Math.abs(player.kx) + Math.abs(player.kz) > 0.05) {
    moveBody(player, player.kx * dt, player.kz * dt);
    const fade = Math.exp(-7 * dt); player.kx *= fade; player.kz *= fade;
  }

  // --- stairs, and friendly reminders at locked things ---
  if (tile(player.x, player.z) === '>' && run.embers[run.floor]) { sound('stairs'); buildFloor(run.floor + 1); return; }
  if (run.nagCd <= 0) {
    if (spots.stairs && !run.embers[run.floor] && dist(spots.stairs, player) < 1.1) {
      toast('A black veil seals the stairs.<br>You need this floor\'s Ember.'); sound('blip'); run.nagCd = 3;
    } else if (spots.door && doors[spots.door.tx + ',' + spots.door.tz] && !run.keys[FLOORS[run.floor].key] && dist(spots.door, player) < 1.1) {
      toast(`The Vault is locked.<br>Find the ${ITEMS[FLOORS[run.floor].key].name}.`); sound('blip'); run.nagCd = 3;
    }
  }

  // --- pick up loot by walking over it ---
  for (const p of [...pickups]) {
    if (dist(p, player) > 0.55) continue;
    pickups.splice(pickups.indexOf(p), 1); removeSprite(p.sprite); removeSprite(p.glow);
    if (p.item === 'ember') takeEmber(); else grantItem(p.item);
  }
  if (state !== 'play') return;                        // a story card popped up

  for (const e of [...enemies]) { updateEnemy(e, dt); if (state !== 'play') return; }

  // --- darkness rings from the boss ---
  for (const g of rings) {
    g.r += 2.6 * dt; g.mesh.scale.set(g.r, 1, g.r);
    if (!g.hit && Math.abs(dist(g, player) - g.r) < 0.3) { g.hit = true; hurtPlayer(1); }
  }
  rings = rings.filter((g) => { if (g.r < 9) return true; group.remove(g.mesh); g.mesh.material.dispose(); return false; });
  for (const fx of effects) { fx.t += dt; fx.s.material.map = spriteTex('puff', Math.min(2, Math.floor(fx.t * 10))); }
  effects = effects.filter((fx) => { if (fx.t < 0.3) return true; removeSprite(fx.s); return false; });
}

// ============================================================
// DRAW (3D view + sprites)
// ============================================================
let flick = 1;
function render(now, dt) {
  if (!renderer || !group) return;
  const R = lightR();
  // torch flicker: a wobbly mix of two sine waves plus a pinch of randomness
  flick += ((0.9 + Math.sin(now / 90) * 0.05 + Math.sin(now / 37) * 0.04 + Math.random() * 0.04) - flick) * 0.3;
  torch.intensity = (run.fuel <= 0 ? 1.6 : 4) * flick + run.flash * 6;
  torch.distance = R * 1.6;
  scene.fog.near = R * 0.3; scene.fog.far = R + 0.5;

  const bob = Math.sin(run.walkT * 9) * 0.025;
  camera.position.set(player.x, EYE + bob, player.z);
  camera.rotation.y = -player.a - Math.PI / 2;     // turn the camera to face angle a

  // Sprites aren't lit by the torch, so we darken them by distance ourselves
  const shade = (s, d, tint = [1, 1, 1]) => { const b = clamp(1.25 - d / R, 0.12, 1); s.material.color.setRGB(b * tint[0], b * tint[1], b * tint[2]); };
  const frame = Math.floor(now / 250) % 2;
  for (const e of enemies) {
    const s = ENEMY_STATS[e.type];
    e.sprite.position.set(e.x, (s.lift || 0) + (e.type === 'wisp' ? Math.sin(e.t * 4) * 0.1 : 0), e.z);
    e.sprite.material.map = spriteTex(e.art, frame);
    if (e.flash > 0) e.sprite.material.color.setRGB(1, 0.4, 0.4);
    else if (e.mode === 'wind') e.sprite.material.color.setRGB(1, 0.3, 0.2);   // red = about to charge!
    else shade(e.sprite, dist(e, player), e.tint);
  }
  for (const p of pickups) {
    p.t += dt;
    const y = 0.12 + Math.sin(p.t * 3) * 0.06;
    p.sprite.position.set(p.x, y, p.z);
    if (p.item === 'ember') {                                  // Embers glow and bob
      p.sprite.material.map = spriteTex('ember', frame);
      p.glow.position.set(p.x, y + 0.35, p.z);
      p.glow.material.opacity = 0.7 + Math.sin(p.t * 5) * 0.2;
    } else shade(p.sprite, dist(p, player));
  }
  for (const o of objects) {
    if (o.kind === 'altar' && run.relit) { o.glow.position.set(o.x, 0.9, o.z); continue; }
    shade(o.sprite, dist(o, player));
  }
  if (veil) veil.material.map.offset.y = (now / 4000) % 1;   // shimmering veil
  renderer.render(scene, camera);
}

// ---------- HUD (only touches the page when something changed) ----------
const shown = {};
function setText(id, v) { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } }
function setStyle(id, prop, v) { const k = id + prop; if (shown[k] !== v) { shown[k] = v; $(id).style[prop] = v; } }
let lastNear = null, lastSword = '';
function drawHud(dt) {
  if (!run.gear) return;
  setText('hearts', '♥'.repeat(Math.max(0, run.hp)) + '♡'.repeat(MAX_HP - Math.max(0, run.hp)));
  setStyle('fuel', 'width', Math.round(run.fuel) + '%');
  setText('embers', `Embers ${emberCount()}/3`);
  setText('floorName', `F${run.floor + 1} · ${run.gold}g`);
  $('flareBtn').classList.toggle('cooling', run.flareCd > 0);
  $('wardBtn').classList.toggle('cooling', run.wardCd > 0);
  // objective line + compass arrow
  const ob = objective();
  setText('objective', ob.text);
  if (ob.target) {
    const want = Math.atan2(ob.target.z - player.z, ob.target.x - player.x);
    const rel = want - player.a;                       // how far to turn (radians), + = to your right
    setStyle('arrow', 'transform', `rotate(${Math.round(rel * 180 / Math.PI)}deg)`);
    setText('dist', `${Math.round(dist(ob.target, player))} steps`);
    setStyle('compass', 'visibility', 'visible');
  } else setStyle('compass', 'visibility', 'hidden');
  // context button (OPEN / READ / UNLOCK / RELIGHT)
  const n = state === 'play' ? nearbyThing() : null;
  const label = n ? { chest: 'OPEN', lore: 'READ', door: 'UNLOCK', altar: 'RELIGHT' }[n.kind] : '';
  setStyle('ctxBtn', 'display', n ? 'block' : 'none');
  setText('ctxBtn', label);
  if (label !== lastNear) { lastNear = label; updatePrompt(); }
  // boss bar
  const king = spots.king && run.relit && enemies.includes(spots.king) ? spots.king : null;
  setStyle('bossBar', 'display', king ? 'block' : 'none');
  if (king) setStyle('bossHp', 'width', Math.round(king.hp / king.maxHp * 100) + '%');
  // screen flash fades out
  run.flash = Math.max(0, run.flash - dt * 2);
  setStyle('flash', 'opacity', run.flash.toFixed(2));
  drawSword();
}
// First-person sword in the corner: swings when you attack
const swordCtx = $('sword').getContext('2d');
function drawSword() {
  const name = artSource('swordFP_' + run.gear.sword) ? 'swordFP_' + run.gear.sword : 'swordFP';
  const swing = run.atkAnim > 0, key = name + swing;
  if (key !== lastSword) {
    lastSword = key;
    swordCtx.clearRect(0, 0, 48, 48); swordCtx.imageSmoothingEnabled = false;
    drawArt(swordCtx, name, 24, 48, { scale: artSource(name) === window.Art3D ? 2.8 : 4, frame: swing ? 1 : 0 });
  }
  const t = swing ? run.atkAnim / 0.25 : 0;              // 1 -> 0 during a swing
  const bob = Math.sin(run.walkT * 9) * 4;
  setStyle('sword', 'transform', `translate(${Math.round(-t * 40)}px, ${Math.round(bob + t * -10)}px) rotate(${Math.round(-t * 35)}deg)`);
}

// ---------- Main loop ----------
let last = performance.now(), fps = 0, fpsFrames = 0, fpsT = 0;
const showFps = /fps/.test(location.search);
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsFrames++; fpsT += dt;
  if (fpsT >= 1) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; if (showFps) { $('fps').hidden = false; $('fps').textContent = fps + ' fps'; } }
  pollGamepad();
  if (state === 'play') update(dt);
  updateDanger();
  render(now, dt); drawHud(dt);
  requestAnimationFrame(loop);
}

// ============================================================
// INPUT
// ============================================================
let inputMode = 'touch';                  // touch | keys | pad (changes prompts and buttons)
function setMode(m) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.classList.toggle('pad', m === 'pad');
  if (m === 'touch') document.body.classList.add('touch');
  updatePrompt();
}
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
else inputMode = 'keys';
const keys = {};                          // keys held down right now
let padMove = [0, 0], padTurn = 0;

// Every input becomes [strafe, forward], each from -1 to 1
function moveInput() {
  let x = 0, y = 0;
  if (keys.a) x--; if (keys.d) x++;
  if (keys.w || keys.arrowup) y++; if (keys.s || keys.arrowdown) y--;
  if (x || y) return [x, y];
  if (joy) return joyVec();
  return padMove;
}
function turnInput() {
  const k = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0) + (keys.q ? -1 : 0) + (keys.e && false ? 1 : 0);
  return k || padTurn;
}

// --- touch: joystick on the left half, drag to turn on the right half ---
let joy = null, turnTouch = null;
function joyVec() {
  const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
  if (d < 6) return [0, 0];                           // small deadzone
  const k = Math.min(1, d / 44) / d;
  return [dx * k, -dy * k];                          // screen up = walk forward
}
function showJoy() {
  const on = !!joy;
  $('joyBase').style.display = $('joyKnob').style.display = on ? 'block' : 'none';
  if (!on) return;
  const [x, y] = joyVec();
  Object.assign($('joyBase').style, { left: joy.ox + 'px', top: joy.oy + 'px' });
  Object.assign($('joyKnob').style, { left: joy.ox + x * 44 + 'px', top: joy.oy - y * 44 + 'px' });
}
const touchEl = $('touch');
touchEl.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') {                     // desktop: click to lock the mouse for turning
    if (state === 'play' && touchEl.requestPointerLock) try { touchEl.requestPointerLock(); } catch (err) {}
    return;
  }
  setMode('touch');
  const r = gameEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < r.width / 2 && !joy) joy = { id: e.pointerId, ox: x, oy: y, x, y };
  else if (!turnTouch) turnTouch = { id: e.pointerId, x: e.clientX };
  else return;
  try { touchEl.setPointerCapture(e.pointerId); } catch (err) {}
  showJoy();
});
touchEl.addEventListener('pointermove', (e) => {
  if (joy && e.pointerId === joy.id) {
    const r = gameEl.getBoundingClientRect();
    joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; showJoy();
  } else if (turnTouch && e.pointerId === turnTouch.id) {
    if (state === 'play') player.a += (e.clientX - turnTouch.x) * TOUCH_TURN;
    turnTouch.x = e.clientX;
  }
});
const endTouch = (e) => {
  if (joy && e.pointerId === joy.id) { joy = null; showJoy(); }
  if (turnTouch && e.pointerId === turnTouch.id) turnTouch = null;
};
touchEl.addEventListener('pointerup', endTouch);
touchEl.addEventListener('pointercancel', endTouch);
// mouse turning while the pointer is locked
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === touchEl && state === 'play') player.a += e.movementX * MOUSE_TURN;
});

const tapBtn = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setMode('touch'); unlockAudio(); fn(); });
tapBtn('atkBtn', attack); tapBtn('flareBtn', flare); tapBtn('wardBtn', ward); tapBtn('ctxBtn', interact);
$('pauseBtn').addEventListener('click', togglePause);
$('bagBtn').addEventListener('click', () => { if (state === 'play') setState('paused'); });
document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation(); unlockAudio();
  const a = b.dataset.action;
  if (a === 'start' && state === 'title') startIntro();
  if (a === 'next' && state === 'intro') nextIntro();
  if (a === 'skip' && state === 'intro') newGame();
  if (a === 'close' && state === 'story') closeStory();
  if (a === 'resume' && state === 'paused') togglePause();
  if (a === 'restart') tryRestart();
}));
$('title').addEventListener('click', () => { if (state === 'title') startIntro(); });
$('story').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' && state === 'story') closeStory(); });

// --- keyboard ---
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  setMode('keys');
  const ok = k === 'enter' || k === ' ' || k === 'e';
  if (state === 'title') startIntro();
  else if (state === 'intro') { if (k === 'escape') newGame(); else if (ok) nextIntro(); }
  else if (state === 'story') { if (ok || k === 'escape' || k === 'j') closeStory(); }
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

// --- game controller (Gamepad API, "Standard" button layout) ---
// Browsers don't send events for controller buttons, so we read the whole pad
// every frame. A press counts only on the frame a button goes from up to down.
let padPrev = {}, padStyle = 'ps';
window.addEventListener('gamepadconnected', (e) => {
  padStyle = /xbox|xinput/i.test(e.gamepad.id) ? 'xbox' : 'ps';
  toast('Controller connected'); sound('blip'); setMode('pad'); updatePrompt();
});
window.addEventListener('gamepaddisconnected', () => {
  toast('Controller disconnected'); padMove = [0, 0]; padTurn = 0;
  if (inputMode === 'pad') setMode('touch');
});
function pollGamepad() {
  const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
  if (!pad) { padMove = [0, 0]; padTurn = 0; return; }
  const style = /xbox|xinput/i.test(pad.id) ? 'xbox' : 'ps';
  if (style !== padStyle) { padStyle = style; updatePrompt(); }
  const b = (i) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
  let ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, rx = pad.axes[2] || 0;
  if (Math.hypot(ax, ay) < DEADZONE) ax = ay = 0;
  if (Math.abs(rx) < DEADZONE) rx = 0;
  const dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0), dy = (b(12) ? 1 : 0) - (b(13) ? 1 : 0);
  padMove = dx || dy ? [dx, dy] : [ax, -ay];           // stick up = forward
  padTurn = rx;
  const now = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, x: b(0), o: b(1), ward: b(2) || b(7),
    tri: b(3), opt: b(9), any: pad.buttons.some((btn) => btn && btn.pressed) };
  const pressed = (k) => now[k] && !padPrev[k];      // down this frame, up last frame
  if (now.any || ax || ay || rx) setMode('pad');
  if (state === 'title') { if (pressed('any')) startIntro(); }
  else if (state === 'intro') { if (pressed('opt')) newGame(); else if (pressed('x')) nextIntro(); }
  else if (state === 'story') { if (pressed('x') || pressed('o') || pressed('tri')) closeStory(); }
  else if (state === 'paused') {
    if (pressed('up')) moveSel(-1); if (pressed('down')) moveSel(1);
    if (pressed('x')) useSel(); if (pressed('opt') || pressed('o')) togglePause();
  }
  else if (state === 'win' || state === 'lose') { if (pressed('x') || pressed('opt')) tryRestart(); }
  else if (state === 'play') {
    if (pressed('x')) attack(); if (pressed('o')) flare(); if (pressed('ward')) ward();
    if (pressed('tri')) interact(); if (pressed('opt')) togglePause();
  }
  padPrev = now;                                     // remember for next frame (ALWAYS last!)
}
function rumble(ms, strength) {       // only if this browser supports it (iPhone doesn't)
  try {
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    const act = pad && pad.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength }).catch(() => {});
  } catch (e) { /* no rumble, no problem */ }
}

// ============================================================
// BAG (the pause screen)
// ============================================================
let invSel = 0, invRows = [];
const bars = (v) => '▮'.repeat(Math.round(v * 5)) + '▯'.repeat(5 - Math.round(v * 5));
function renderInventory() {
  const g = (slot, label) => {
    const id = run.gear[slot], it = id && ITEMS[id];
    return { html: `${label}: ${it ? `<span class="${it.rarity}">${it.name}</span>` : 'None'}`, info: it ? it.flavor : 'Nothing equipped yet.' };
  };
  const M = window.Music, X = window.SFX;
  invRows = [
    { html: `<span class="quest">Embers ${emberCount()}/3</span>`, info: 'One Ember hides on each floor. Bring all 3 to the altar.' },
    ...['bonekey', 'gildedkey'].filter((k) => run.keys[k]).map((k) => ({ html: `<span class="quest">${ITEMS[k].name}</span> (quest)`, info: ITEMS[k].flavor })),
    g('sword', 'Sword'), g('torch', 'Torch'), g('armor', 'Armor'), g('ring', 'Ring'),
    { html: `Health Potions x${run.potions} (use)`, info: ITEMS.potion.flavor, use: () => drinkPotion() || toast(run.potions ? 'Already at full health.' : 'No potions.') },
    { html: `Torch Oil x${run.oils} (use)`, info: ITEMS.oil.flavor, use: () => pourOil() || toast(run.oils ? 'Your light is already full.' : 'No oil.') },
    { html: `<span style="color:#d4af37">${run.gold} gold</span>`, info: ITEMS.gold.flavor },
    { html: `Music: ${M && M.enabled ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn the music on or off.',
      use: () => { if (M) try { M.toggle(!M.enabled); } catch (e) {} } },
    { html: `Music Volume: ${bars(M ? M.volume : 0.5)}`, info: 'Tap or press ✕ / Enter to change the music volume.',
      use: () => { if (M) try { M.setVolume(M.volume >= 0.95 ? 0.2 : Math.round((M.volume + 0.2) * 10) / 10); } catch (e) {} } },
    { html: `Sound FX: ${X && X.enabled ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn sound effects on or off.',
      use: () => { if (X) X.toggle(!X.enabled); } },
    { html: `FX Volume: ${bars(X ? X.volume : 1)}`, info: 'Tap or press ✕ / Enter to change the sound effects volume.',
      use: () => { if (X) { X.setVolume(X.volume >= 0.95 ? 0.2 : Math.round((X.volume + 0.2) * 10) / 10); sound('blip'); } } },
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
  const act = lastNear ? lastNear.toLowerCase() : '';
  if (inputMode === 'pad') {
    const L = padStyle === 'xbox' ? ['A', 'B', 'X/RT', 'Y', 'Menu'] : ['✕', '○', '□/R2', '△', 'Options'];
    p.textContent = `${L[0]} attack · ${L[1]} flare · ${L[2]} ward · ${act ? L[3] + ' ' + act + ' · ' : ''}${L[4]} bag`;
  } else if (inputMode === 'keys' && !matchMedia('(pointer: coarse)').matches) {   // no keyboard hints on phones
    p.textContent = `WASD move · ←→/mouse turn · J attack · K flare · L ward · ${act ? 'E ' + act + ' · ' : ''}I bag`;
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

// ============================================================
// SOUND AND MUSIC (Audio Designer's assets/sfx.js and assets/music.js)
// ============================================================
// iPhone (Safari, and Chrome/Edge on iPhone, which all use WebKit) is strict about sound:
//  1. Sound only unlocks inside a real tap (touchend/click) or key press, NOT a gamepad button.
//  2. The ring/silent switch mutes Web Audio unless the page says it is a "playback" app.
let audio = null, silentOK = false;
const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS 17+
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (!audio) return;
  if (audio.state !== 'running') audio.resume().catch(() => {});
  // Old trick: play a 1-sample silent sound right now, inside the tap, to wake the speaker up
  try { const s = audio.createBufferSource(); s.buffer = audio.createBuffer(1, 1, 22050); s.connect(audio.destination); s.start(0); } catch (e) {}
  // Older iOS: a looping silent <audio> tag moves the page to the "media" channel, so the silent switch won't mute it
  if (!silentOK) {
    try {
      const el = document.createElement('audio'); el.src = SILENT_WAV; el.loop = true; el.setAttribute('playsinline', '');
      el.play().then(() => { silentOK = true; }).catch(() => {});
    } catch (e) {}
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
// New sounds (ember, relight, key, door) use Audio Designer's version if it exists, else a v2 sound.
const SOUND_BACKUP = { ember: 'bell', relight: 'dawn', key: 'pickup', door: 'chest' };
function sound(name) {
  const X = window.SFX;
  if (!X || !audio) return;
  if (X.names && !X.names.includes(name)) name = SOUND_BACKUP[name] || name;
  try { X.play(audio, name); } catch (e) {}
}
function startMusic() {                        // must run inside a tap/key press (iPhone rule)
  unlockAudio();
  if (!window.Music || !audio) return;
  try { Music.start(audio); } catch (e) {}
}
// Danger music plays ONLY in boss fights (the player's request): the Warden once he's awake, or the Hollow King.
// Regular enemies keep the calm, mysterious track going.
function updateDanger() {
  if (!window.Music) return;
  const boss = state === 'play' && enemies.some((e) => (e.type === 'warden' || e.type === 'king') && e.awake && e.hp > 0);
  try { if (Music.setBoss) Music.setBoss(boss); else Music.setDanger(boss ? 1 : 0); } catch (e) {}
}

// ---------- Start! ----------
// Test hooks (so automated tests can peek inside). Harmless for players.
window.G = {
  THREE, renderer, scene, camera, run, player, MAPS,
  get state() { return state; }, get grid() { return grid; }, get enemies() { return enemies; }, get pickups() { return pickups; },
  get objects() { return objects; }, get spots() { return spots; }, get doors() { return doors; }, get rings() { return rings; },
  get fps() { return fps; }, get audio() { return audio; }, get inputMode() { return inputMode; }, get padStyle() { return padStyle; },
  setState, newGame, buildFloor, attack, flare, ward, interact, objective, solid, tile, lightR, hurtPlayer, killEnemy,
  tryRestart, makeEnemy, updateSoundTip, nearbyThing, drawCalls: () => renderer && renderer.info.render.calls,
};
requestAnimationFrame(loop);
