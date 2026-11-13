// Gravelight: Realm: slice 1 (the Blackpine Forest and the courtyard of Castle Morrow) + slice 2 (the Keep and the Hollow King).
// Three.js 3D, third-person camera over the knight's right shoulder.
// Models: Game Artist's CC0 set in assets/models (see CREDITS.md). Look and tints: assets/realm-art.js.
// Sound: Audio Designer's assets/sfx.js, music.js and ambience.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeBoundsTree, acceleratedRaycast } from './lib/three-mesh-bvh.js';   // MIT: fast floor + camera rays in the keep
import { Tween, Group as TweenGroup, Easing } from './lib/tween.esm.js';            // MIT: smooth doors, altar beat, King's collapse

const $ = (id) => document.getElementById(id);
const ART = window.RealmArt;
const DEBUG = /[?&]debug/.test(location.search);
const MAX_HP = 5, MAX_FUEL = 100, DEADZONE = 0.2, MAX_ACTIVE = 6;
// Polish pass: at most 8 characters think at once (Aldren + Oathbound + enemies). Summons cost fuel and have a cooldown.
const MAX_CHARS = 8, MAX_ALLIES = 2, SUMMON_COST = 25, SUMMON_CD = 20;
const BOUNDS = { x: 46, z0: -70, z1: 68 };
const REALM_B = { ...BOUNDS };
// Slice 2: the keep is built far from the forest (z around -150), so the two areas never overlap
const KZ = -150, RH = 3.5;                           // keep hall centre, rampart height
const THR = { x: -27.8, z: KZ, hx: 13, hz: 10, r: 9 };   // the throne room, west of the hall: 26 x 20 m (r: size of its mist)
const KEEP_B = { x: 46, z0: KZ - 24, z1: KZ + 24 };
const inThrone = (x, z) => z < -110 && Math.abs(x - THR.x) < THR.hx && Math.abs(z - THR.z) < THR.hz;
const KING_ART = ART.MODELS.hollowKing ? 'hollowKing' : 'king';   // Game Artist's Hollow King look (falls back to the plain king)
const isBoss = (e) => e.type === 'warden' || e.type === 'king';
const isSkel = (e) => e.type === 'warrior' || e.type === 'minion' || e.type === 'mage';
const torchOnly = (e) => e.type === 'shade' || (e.type === 'king' && e.phase === 3);   // only hurt inside torchlight
const CASTLE = { x: 0, z: -50, h: 16, top: 7 };   // courtyard: 32m square on a 7m hill
const GATE_W = 2.6;                                  // half width of the gate gap in the south wall
const SPOTS = {
  start: [0, 60], camp: [-26, 27], key: [-23, 24.4], fire: [-26, 27], shrine: [27, 19],
  gate: [0, -31], warden: [0, -52],
  keepGate: [0, -64], keepKey: [-12.5, KZ - 18.7], vault: [-7, KZ + 16.5], altar: [0, KZ],
};
// Dirt paths through the forest (trees never grow on them)
const PATHS = [
  [[0, 66], [0, 40], [-12, 32], [-24, 27]],
  [[0, 40], [14, 30], [26, 21]],
  [[0, 40], [0, 18], [0, 4], [0, -36]],
  [[-26, 27], [-14, 10], [0, 4]],
  [[27, 19], [14, 6], [0, 4]],
];
const INTRO = [
  'The graveyard is quiet now. Aldren walks out through its gate with one Ember of the Gravelight... and finds it only a spark.',
  'The other Embers were carried off to Castle Morrow, where the Hollow King holds court. Between here and there: the Blackpine Forest.',
  'Keep your torch burning. Shades fear the light. Wolves do not.',
];
const smooth01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function pathDist(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, distToSeg(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return d;
}
const castleD = (x, z) => Math.max(Math.abs(x - CASTLE.x), Math.abs(z - CASTLE.z));   // square distance
// Ground height: flat forest with small bumps, rising to the castle hill.
function groundH(x, z) {
  if (z < -110) return keepH(x, z);                  // the keep has its own flat floor + ramparts
  const hill = smooth01((42 - castleD(x, z)) / 20);
  return CASTLE.top * hill + (1 - hill) * (1.3 * Math.sin(x * 0.07 + 1) * Math.cos(z * 0.06) + 0.4 * Math.sin(x * 0.19 + z * 0.13));
}
// Keep floor height: 0, except the rampart walkway (north side, and east side with a ramp at its south end)
const _ray = new THREE.Raycaster(), _down = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3(), _hits = [];
_ray.firstHitOnly = true; _ray.far = 30;
function keepH(x, z) {
  if (K.walk) { _ray.set(_o.set(x, 20, z), _down); _hits.length = 0; K.walk.raycast(_ray, _hits); return _hits.length ? _hits[0].point.y : 0; }
  if (x > 14.5 || x < -14.5 || z < KZ - 20.5 || z > KZ + 20.5) return 0;
  if (z < KZ - 17) return RH;
  if (x > 11) return z < KZ + 6 ? RH : RH * Math.max(0, Math.min(1, (KZ + 14 - z) / 8));   // the stairs
  return 0;
}
const inCourtyard = (x, z) => Math.abs(x - CASTLE.x) < CASTLE.h && z < CASTLE.z + CASTLE.h && z > CASTLE.z - CASTLE.h;

// ============================================================
// RENDERER, SCENE, LIGHTS
// ============================================================
const gameEl = $('game');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.className = 'gl';
gameEl.insertBefore(renderer.domElement, gameEl.firstChild);
// Pixel look (Game Artist's pass). The 3D is drawn at a lower resolution, then scaled up, which is also FASTER on phones.
// "Soft" is the player's pick and the default: half resolution with no heavy dither or posterize (realm-art 'v2' style).
// L, M and S are opt-in "chunky" looks ('v3' style): bigger pixels, strong dither, a color grade and ACES tone mapping.
const PIXEL_SIZES = [
  { name: 'Soft', scale: 0.5, style: 'v2' },
  { name: 'L', scale: 0.25, style: 'v3' }, { name: 'M', scale: 0.3, style: 'v3' }, { name: 'S', scale: 0.35, style: 'v3' },
  { name: 'Off', scale: 0, style: 'v2' }];
const PIX_KEY = 'gravelight-realm.pixels2';   // new key so an old saved "M" doesn't override the new Soft default
let pixelSize = Math.min(PIXEL_SIZES.length - 1, Math.max(0, +(localStorage.getItem(PIX_KEY) ?? 0) || 0));
const px = ART.pixelPass(THREE, renderer, { scale: 0.5 });
function applyPixels() {
  const P = PIXEL_SIZES[pixelSize], S = ART.STYLES[P.style];
  // The shader settings are "uniforms", live values we can change at any time without rebuilding anything.
  ['levels', 'dither', 'bloom', 'vignette', 'sat', 'contrast', 'grade'].forEach(k => px.uniforms[k].value = S[k]);
  renderer.toneMapping = P.style === 'v3' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = S.exposure;
  px.enabled = P.scale > 0; if (P.scale) px.setScale(P.scale);
}
applyPixels();
function cyclePixelSize() {
  pixelSize = (pixelSize + 1) % PIXEL_SIZES.length;
  try { localStorage.setItem(PIX_KEY, pixelSize); } catch (e) {}
  applyPixels();
}
renderer.info.autoReset = false;   // count draw calls for the whole frame (3D + pixel pass)

const texOf = (name, repeat) => ART.tex(THREE, name, repeat);   // nearest-filtered pixel textures
const PAL = ART.PAL, LT = ART.LIGHTS;
// Blue hour (the player's reference). Uses Game Artist's palette names if realm-art.js has them.
const LOOK = {
  haze: PAL.haze ?? 0x7aa2dc, grass: PAL.grass ?? 0x4f8a36, curse: (LT.curse && LT.curse.fog) ?? 0x2a1240,
  hemiSky: LT.hemi.sky, hemiGround: LT.hemi.ground, hemiI: LT.hemi.intensity, sun: (LT.sky || LT.moon).color, sunI: (LT.sky || LT.moon).intensity,
  fogNear: LT.fog.near, fogFar: LT.fog.far, curseNear: LT.curse ? LT.curse.near : 1.5, curseFar: LT.curse ? LT.curse.far : 13, dim: LT.curse ? LT.curse.dim : 0.18,
  torchBoost: LT.curse ? LT.curse.torch / LT.torch.intensity : 1.3,
};
// Cursed mist zones: dark purple fog where only the torch gives light (and fuel burns)
const ZONES = [{ x: -26, z: 27, r: 12, name: 'camp' }, { x: 27, z: 19, r: 10, name: 'shrine' }, { x: 0, z: -50, r: 19, name: 'courtyard' },
  { x: 7, z: KZ - 9, r: 4, name: 'pocket' }, { x: THR.x, z: THR.z, r: -99, name: 'throne' }];   // keep: a mist pocket; the throne room (r > 0 only in the King's last phase)
function mistAt(x, z) { let k = 0; for (const zn of ZONES) k = Math.max(k, smooth01((zn.r + 5 - Math.hypot(x - zn.x, z - zn.z)) / 6)); return k; }
const scene = new THREE.Scene();
scene.background = new THREE.Color(LOOK.haze);
const FOG_FAR = 46;
scene.fog = new THREE.Fog(LOOK.haze, LOOK.fogNear, LOOK.fogFar);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

const hemi = new THREE.HemisphereLight(LOOK.hemiSky, LOOK.hemiGround, LOOK.hemiI);
scene.add(hemi);
const moonDir = new THREE.Vector3(...(LT.sky || LT.moon).dir).normalize();
const moon = new THREE.DirectionalLight(LOOK.sun, LOOK.sunI);   // the blue-hour sky light (only shadow caster)
scene.add(moon, moon.target);
const sh = ART.shadows(THREE, renderer, moon, { box: 9 });   // one soft shadow map that follows Aldren
const torchLight = new THREE.PointLight(PAL.torch, 30, 14, 1.5);
scene.add(torchLight);
const gateLight = new THREE.PointLight(PAL.torch, 25, 14, 1.6);
scene.add(gateLight);

// Sky: Game Artist's blue-hour sky texture on a big dome (top half = sky, bottom = haze), so the mist can darken it
const skyTex = texOf('sky');
skyTex.repeat.set(1, 2); skyTex.offset.set(0, -1); skyTex.magFilter = THREE.NearestFilter;
const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -2; scene.add(sky);
const TX = {};
['pxTorch', 'pxEmber', 'pxShade', 'flare', 'moon'].forEach((n) => { TX[n] = texOf(n); });
const backdrop = ART.backdrop(THREE); scene.add(backdrop);   // far cliffs, castle spires, hills, 2 haze rings
const hazeRings = backdrop.children.filter((m) => /^haze/.test(m.name)); hazeRings.forEach((m) => { m.userData.y0 = m.position.y; });
const COARSE = matchMedia('(pointer: coarse)').matches;
// Game Artist's grass: 1800 tufts + flowers in ONE instanced mesh. Phones get half (density 0.5), desktop full (1).
const GRASS_DENSITY = COARSE ? 0.5 : 1;
const grass = ART.grass(THREE, { density: GRASS_DENSITY }); scene.add(grass);
function liftTufts(mesh) {                // Game Artist's tufts follow Aldren; we lift them onto our rolling ground
  const v = mesh.instanceMatrix.version;
  mesh.userData.update(hero.x, hero.z);
  if (mesh.instanceMatrix.version === v) return;
  const a = mesh.instanceMatrix.array;
  for (let i = 0; i < mesh.count; i++) {
    const x = a[i * 16 + 12], z = a[i * 16 + 14], cz = inCourtyard(x, z) || pathDist(x, z) < 1.6 || mistAt(x, z) > 0.6;
    a[i * 16 + 13] = cz ? -5 : groundH(x, z);          // no grass on paths, cobbles or cursed ground
  }
}
function updateGrass() { liftTufts(grass); }
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.moon, fog: false, depthWrite: false, color: 0xdfe6ff }));
moonSprite.scale.set(40, 40, 1); moonSprite.material.opacity = 0.7; moonSprite.material.transparent = true; moonSprite.renderOrder = -1; scene.add(moonSprite);
const glowSprite = (tex, size, color, add = true) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: color || 0xffffff, transparent: true, depthWrite: false,
    blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
  s.scale.set(size, size, 1); return s;
};

// Castle stone uses thinner fog so its outline shows on the hill from far away.
function thinFog(mat, k) {
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <fog_fragment>',
      `#ifdef USE_FOG
        float fogFactor = smoothstep( fogNear, fogFar * ${k.toFixed(1)}, vFogDepth );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * 0.92 );
      #endif`);
  };
  mat.customProgramCacheKey = () => 'thinfog' + k;
}

// ============================================================
// COLLISION: circles (trees, rocks, towers) and wall segments
// ============================================================
const CELL = 4, grid = new Map(), circles = [], walls = [];
function addCircle(x, z, r, tag) {
  const c = { x, z, r, tag, on: true }; circles.push(c);
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i + ',' + j; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); }
  return c;
}
function addWall(x1, z1, x2, z2, t, on, top) { const w = { x1, z1, x2, z2, t, on: on || (() => true), top: top || 14 }; walls.push(w); return w; }
function nearCircles(x, z) { return grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || []; }
function pushOut(p, r) {
  p.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, p.x)); p.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, p.z));
  for (let n = 0; n < 2; n++) {
    for (const c of nearCircles(p.x, p.z)) {
      if (!c.on) continue;
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
    for (const w of walls) {
      if (!w.on()) continue;
      const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = dx * dx + dz * dz;
      let t = ((p.x - w.x1) * dx + (p.z - w.z1) * dz) / l; t = Math.max(0, Math.min(1, t));
      const cx = w.x1 + dx * t, cz = w.z1 + dz * t, ex = p.x - cx, ez = p.z - cz, d = Math.hypot(ex, ez), m = w.t + r;
      if (d < m) {
        if (d > 1e-4) { p.x = cx + ex / d * m; p.z = cz + ez / d * m; }
        else { p.x = cx - dz / Math.sqrt(l) * m; p.z = cz + dx / Math.sqrt(l) * m; }
      }
    }
  }
  return p;
}
function isFree(x, z, r = 0.4) {
  if (Math.abs(x) > BOUNDS.x || z < BOUNDS.z0 || z > BOUNDS.z1) return false;
  for (const c of nearCircles(x, z)) if (c.on && Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
  for (const w of walls) if (w.on() && distToSeg(x, z, w.x1, w.z1, w.x2, w.z2) < w.t + r) return false;
  return true;
}
// Solid for the camera: walls, towers and big rocks (not thin trees, the camera can pass through needles)
function camSolid(x, y, z) {
  for (const w of walls) if (w.on() && y < w.top && distToSeg(x, z, w.x1, w.z1, w.x2, w.z2) < w.t + 0.25) return true;
  for (const c of nearCircles(x, z)) if (c.on && c.tag === 'big' && y < groundH(c.x, c.z) + 12 && Math.hypot(x - c.x, z - c.z) < c.r + 0.2) return true;
  return false;
}

// ============================================================
// LOADING MODELS
// ============================================================
const loader = new GLTFLoader();
const GLTF = {};                      // file -> gltf
const USE = ['hero', 'oathbound', 'shade', 'wolf', 'warden', 'pines', 'pineTall', 'deadTree', 'rocks', 'rockLarge', 'bush', 'weeds', 'stump',
  'grave', 'tent', 'bonfire', 'logs', 'axe', 'cart', 'key', 'shrine', 'torch', 'banner', 'castleGate', 'castleWall', 'castleTower', 'skeletonKnight', KING_ART];
const gltfOf = (name) => GLTF[ART.MODELS[name].file];
async function loadAll(onProgress) {
  const need = [...new Set(USE.map((n) => ART.MODELS[n].file))];
  const OPT = ['skelWarrior', 'skelMinion', 'skelMage', 'wizard', 'keepExterior', 'keepInterior'];   // Game Artist's slice 2 models: optional
  const extra = [...new Set(OPT.filter((n) => ART.MODELS[n]).map((n) => ART.MODELS[n].file))].filter((f) => !need.includes(f));
  let done = 0; const all = need.length + extra.length;
  await Promise.all([...need.map((f) => loader.loadAsync(f).then((g) => { GLTF[f] = g; onProgress(++done / all); })),
    ...extra.map((f) => loader.loadAsync(f).then((g) => { GLTF[f] = g; }, () => console.info('optional model not there yet', f)).finally(() => onProgress(++done / all)))]);
  for (const d of Object.values(ENEMY_DEF)) if (d.key && d.fb && !GLTF[ART.MODELS[d.key].file] && ART.MODELS[d.fb] && GLTF[ART.MODELS[d.fb].file]) {
    d.art = d.key = d.fb; d.anim = ART.ANIMS[d.fb] ? d.fb : 'skeletonKnight';   // wizard missing: use the skeleton mage
  }
  for (const [t, d] of Object.entries(ENEMY_DEF)) if (d.key && !GLTF[ART.MODELS[d.key].file]) {   // its model didn't load: stand-in look
    const f = skelArt(null, ...d.stand); d.art = f.art; d.anim = f.anim; Object.assign(d, { scale: f.scale, tint: f.tint, glow: f.glow });
  }
}
const hasModel = (n) => !!(ART.MODELS[n] && GLTF[ART.MODELS[n].file]);
// A tinted, real-size copy of a static model, standing on y = 0.
function tmpl(name) {
  const r = gltfOf(name).scene.clone(true);
  ART.tint(r, name); ART.fit(THREE, r, name); r.updateMatrixWorld(true);
  return r;
}
// Many copies of one model = one InstancedMesh per part (a few draw calls for a whole forest).
// list: [{x, z, y?, ry, s, sx?}]
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function scatter(name, list, opt = {}) {
  const root = tmpl(name), out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (opt.fog) thinFog(o.material, opt.fog);
    if (opt.dark) o.material.color.multiplyScalar(opt.dark);
    const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
    list.forEach((p, i) => {
      _q.setFromAxisAngle(_up, p.ry || 0);
      _s.set((p.sx || 1) * p.s, p.s, (p.sz || 1) * p.s);
      _m.compose(_v.set(p.x, p.y != null ? p.y : groundH(p.x, p.z) - (opt.sink || 0), p.z), _q, _s);
      im.setMatrixAt(i, _m.multiply(o.matrixWorld));
    });
    im.castShadow = !!opt.cast; im.receiveShadow = opt.receive !== false;
    im.computeBoundingSphere(); scene.add(im); out.push(im);
  });
  return out;
}
function single(name, x, z, ry = 0, s = 1, y) {
  const g = new THREE.Group(), r = tmpl(name);
  r.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  g.add(r); g.position.set(x, y != null ? y : groundH(x, z), z); g.rotation.y = ry; g.scale.setScalar(s); scene.add(g);
  return g;
}

// ============================================================
// BUILDING THE WORLD
// ============================================================
let brambles = null, brambleT = 0, sealMesh = null, shrineCircle = null;
const glows = [];                      // flickering fire sprites
function buildWorld() {
  // --- Ground: forest floor with dirt paths, rising to the castle hill ---
  const W = 150, D = 190, g = new THREE.PlaneGeometry(W, D, 75, 95);
  g.rotateX(-Math.PI / 2); g.translate(0, 0, -1);
  const pos = g.attributes.position, col = [];
  const base = new THREE.Color(1, 1, 1), lush = new THREE.Color(1.15, 1.2, 1.05), dirt = new THREE.Color(1.9, 1.05, 0.6), stone = new THREE.Color(1.1, 1.1, 1.3), cursed = new THREE.Color(0.42, 0.34, 0.5), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    c.copy(base).lerp(lush, 0.5 + 0.5 * Math.sin(x * 0.21) * Math.cos(z * 0.17)).lerp(dirt, smooth01((2.8 - pathDist(x, z)) / 1.8)).lerp(stone, smooth01((30 - castleD(x, z)) / 8) * 0.6).lerp(cursed, mistAt(x, z) * 0.85);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texOf('forestFloor', 30), vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(CASTLE.h * 2, CASTLE.h * 2), new THREE.MeshStandardMaterial({ map: texOf('cobble', 7), color: 0xb0b0c8, roughness: 0.95 }));
  yard.rotation.x = -Math.PI / 2; yard.position.set(CASTLE.x, CASTLE.top + 0.03, CASTLE.z); yard.receiveShadow = true; scene.add(yard);

  // --- Castle Morrow: walls, corner towers, the Keep gate in the north wall ---
  const H = CASTLE.h, cz = CASTLE.z, y0 = CASTLE.top - 0.3, WL = 21;
  if (hasModel('keepExterior') && artFn('kit') && artFn('keepExterior')) {   // Game Artist's keep towering behind the courtyard's north wall
    const ex = ART.keepExterior(THREE, ART.kit(THREE, gltfOf('keepExterior').scene, 'keepExterior'), { s: 3 });
    ex.position.set(0, y0, cz - H - ex.userData.half - 2); ex.traverse((o) => { o.castShadow = false; }); scene.add(ex);
  }
  const L = H - GATE_W, wallList = [
    { x: -(H + GATE_W) / 2, z: cz + H, y: y0, s: 1, sx: L / WL }, { x: (H + GATE_W) / 2, z: cz + H, y: y0, s: 1, sx: L / WL },
    { x: -H, z: cz, y: y0, s: 1, sx: 2 * H / WL, ry: Math.PI / 2 }, { x: H, z: cz, y: y0, s: 1, sx: 2 * H / WL, ry: -Math.PI / 2 },
    { x: -14, z: cz - H, y: y0, s: 1, sx: 4 / WL }, { x: 14, z: cz - H, y: y0, s: 1, sx: 4 / WL },
  ];
  scatter('castleWall', wallList, { fog: 1.4 });
  scatter('castleGate', [{ x: 0, z: cz - H, y: y0, s: 1 }], { fog: 1.4 });
  const TS = 0.7, towers = [[-H, cz + H], [H, cz + H], [-H, cz - H], [H, cz - H]];
  scatter('castleTower', towers.map(([x, z], i) => ({ x, z, y: y0, s: TS, ry: i * Math.PI / 2 })), { fog: 1.4 });
  towers.forEach(([x, z]) => addCircle(x, z, 3.2, 'big'));
  const T = 1.66, top = CASTLE.top + 6;
  addWall(-H, cz + H, -GATE_W - T, cz + H, T, null, top); addWall(GATE_W + T, cz + H, H, cz + H, T, null, top);
  addWall(-H, cz - H, -H, cz + H, T, null, top); addWall(H, cz - H, H, cz + H, T, null, top);
  addWall(-H, cz - H, -GATE_W - 2, cz - H, 2.0, null, top + 3); addWall(GATE_W + 2, cz - H, H, cz - H, 2.0, null, top + 3);
  addWall(-GATE_W - 2, cz - H, GATE_W + 2, cz - H, 2.0, () => !run.ember2, top + 3);   // the Keep gate: open with the Ember of the Walls
  scatter('banner', [{ x: -7, z: cz + H + 1.8, y: CASTLE.top + 1.6, s: 1 }, { x: 7, z: cz + H + 1.8, y: CASTLE.top + 1.6, s: 1 },
    { x: -6, z: cz - H + 2.1, y: CASTLE.top + 2.5, s: 1, ry: Math.PI }, { x: 6, z: cz - H + 2.1, y: CASTLE.top + 2.5, s: 1, ry: Math.PI }], { fog: 2.6 });
  // Gate torches (orange light on the stone, like the mood picture)
  const gt = [[-GATE_W - 0.9, cz + H + 2.2], [GATE_W + 0.9, cz + H + 2.2]];
  scatter('torch', gt.map(([x, z]) => ({ x, z, s: 1 })));
  gt.forEach(([x, z]) => { const s = glowSprite(TX.pxTorch, 1.6); s.position.set(x, groundH(x, z) + 1.75, z); scene.add(s); glows.push(s); addCircle(x, z, 0.3); });
  gateLight.position.set(0, CASTLE.top + 2.6, cz + H + 3);
  // Shadow brambles in the gate: gone when you carry the Ember of the Wood
  const bg = new THREE.ConeGeometry(0.28, 2.6, 5); bg.translate(0, 1.2, 0);
  brambles = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0x1a0a26, emissive: 0x3a1060, emissiveIntensity: 0.6, roughness: 0.8 }), 26);
  for (let i = 0; i < 26; i++) {
    const x = -GATE_W + rnd() * GATE_W * 2, z = cz + H + (rnd() - 0.5) * 2.4;
    _q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.1, rnd() * 6, (rnd() - 0.5) * 1.1));
    _m.compose(_v.set(x, CASTLE.top - 0.2, z), _q, _s.set(1, 0.7 + rnd() * 0.8, 1)); brambles.setMatrixAt(i, _m);
  }
  brambles.userData.base = [...brambles.instanceMatrix.array];
  scene.add(brambles);
  addWall(-GATE_W, cz + H, GATE_W, cz + H, 0.9, () => !run.ember1, top);

  // --- Woodcutter's camp (abandoned, cold fire) ---
  const [cx, cz2] = SPOTS.camp;
  single('tent', cx - 4, cz2 + 4, 0.7); addCircle(cx - 4, cz2 + 4, 2.3, 'big');
  single('bonfire', cx, cz2); addCircle(cx, cz2, 1.0);
  { const s = glowSprite(TX.pxTorch, 1.4, 0xff7a30); s.position.set(cx, groundH(cx, cz2) + 0.3, cz2); scene.add(s); glows.push(s); }
  single('logs', cx + 3.3, cz2 - 2.8, 0.3); addCircle(cx + 3.3, cz2 - 2.8, 1.5);
  single('stump', cx - 1.8, cz2 - 3.6); addCircle(cx - 1.8, cz2 - 3.6, 0.6);
  single('axe', cx - 1.7, cz2 - 3.6, 0.5, 1, groundH(cx - 1.8, cz2 - 3.6) + 0.45).rotation.z = 0.35;
  single('cart', cx + 5.2, cz2 + 3.2, -0.5, 1.4); addCircle(cx + 5.2, cz2 + 3.2, 1.1);

  // --- Forest shrine, sealed by a purple ward until you have the key ---
  const [sx, sz] = SPOTS.shrine;
  single('shrine', sx, sz, -Math.PI / 2);
  shrineCircle = addCircle(sx, sz, 1.9);
  sealMesh = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 12), new THREE.MeshBasicMaterial({ color: 0x7a3cff, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  sealMesh.position.set(sx, groundH(sx, sz) + 1.3, sz); scene.add(sealMesh);
  const graves = [];
  for (let i = 0; i < 7; i++) {
    const a = -1.1 + i * 0.37, r = 4.5 + (i % 2) * 1.5, x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    graves.push({ x, z, s: 1, ry: a + Math.PI / 2 + (rnd() - 0.5) * 0.4 }); addCircle(x, z, 0.55);
  }
  scatter('grave', graves);

  // --- The forest ---
  const avoid = (x, z, pad) => pathDist(x, z) < 3.4 + pad || castleD(x, z) < 26 ||
    Math.hypot(x - cx, z - cz2) < 10 || Math.hypot(x - sx, z - sz) < 8.5 || Math.hypot(x - SPOTS.start[0], z - SPOTS.start[1]) < 6;
  const place = (n, pad, r, tag, outside) => {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 30; tries++) {
      const ox = outside ? 1.25 : 1, x = (rnd() * 2 - 1) * (BOUNDS.x + 4) * ox, z = BOUNDS.z0 - 4 + rnd() * (BOUNDS.z1 - BOUNDS.z0 + 8) * (outside ? 1.1 : 1);
      if (avoid(x, z, pad) || !isFree(x, z, r + 0.9)) continue;
      const s = 0.75 + rnd() * 0.5; out.push({ x, z, s, ry: rnd() * 6.28 });
      if (r) addCircle(x, z, r * s, tag);
    }
    return out;
  };
  scatter('pineTall', place(150, 0.5, 0.45, 'tree'), { dark: 0.4 });      // jagged tiers come from RealmArt.tint (MODELS.jag)
  scatter('pines', place(30, 1, 1.4, 'tree').map((p) => ({ ...p, s: p.s * 0.45 })), { dark: 0.7 });
  scatter('deadTree', place(12, 0, 0.35, 'tree'));
  scatter('rockLarge', place(12, 0.5, 1.9, 'big').map((p) => ({ ...p, s: p.s * 0.8 })), { sink: 0.3 });
  scatter('rocks', place(28, -1.8, 0.9, 'rock').map((p) => ({ ...p, s: p.s * 0.8 })), { sink: 0.1 });
  scatter('stump', place(18, -1, 0.5, 'rock'));
  scatter('bush', place(60, -1.5, 0, null), { dark: 0.75 });
  scatter('weeds', place(90, -3, 0, null).map((p) => ({ ...p, s: p.s * 1.5 })), { receive: false });
  // a dark ring of trees outside the play area so the edge of the world is hidden
  const ring = [];
  for (let i = 0; i < 80; i++) {
    const a = rnd() * 6.28, x = Math.sign(Math.cos(a)) * (BOUNDS.x + 3 + rnd() * 16), z = BOUNDS.z0 - 8 + rnd() * (BOUNDS.z1 - BOUNDS.z0 + 16);
    const zz = i % 3 === 0 ? (rnd() < 0.5 ? BOUNDS.z0 - 3 - rnd() * 12 : BOUNDS.z1 + 3 + rnd() * 12) : z, xx = i % 3 === 0 ? (rnd() * 2 - 1) * 60 : x;
    ring.push({ x: xx, z: zz, s: 0.9 + rnd() * 0.5, ry: rnd() * 6.28 });
  }
  scatter('pineTall', ring, { dark: 0.3 });

  // Cursed mist: pools of purple fog in the 3 zones (one draw call)
  const mp = [];
  for (const zn of ZONES) for (let i = 0; i < 45; i++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (zn.r + 2), x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
    mp.push(x, groundH(x, z) + 0.4 + rnd() * 2.2, z);
  }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  scene.add(new THREE.Points(mg, new THREE.PointsMaterial({ map: texOf('cursedMist'), size: 7, transparent: true, depthWrite: false, opacity: 1 })));
}

// ============================================================
// CHARACTERS (skinned, animated)
// ============================================================
// Draw-call saver: the knight is 14 skinned parts, each painted ONE flat color, all on the same skeleton.
// Bake each part's color into vertex colors and merge them into ONE SkinnedMesh (14 draw calls -> 1). Looks identical.
function mergeSkinned(root) {
  const parts = [];
  root.traverse((o) => { if (o.isSkinnedMesh && !Array.isArray(o.material) && !o.material.map) parts.push(o); });
  if (parts.length < 2 || parts.some((o) => o.skeleton.bones[0] !== parts[0].skeleton.bones[0])) return;
  const keep = ['position', 'normal', 'skinIndex', 'skinWeight'];
  const geos = parts.map((o) => {
    const g = new THREE.BufferGeometry(), c = o.material.color, n = o.geometry.attributes.position.count;
    keep.forEach((k) => {                            // copy into plain float arrays (glTF parts are often interleaved)
      const src = o.geometry.attributes[k], sz = src.itemSize, arr = new Float32Array(src.count * sz), get = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < src.count; i++) for (let j = 0; j < sz; j++) arr[i * sz + j] = src[get[j]](i);
      g.setAttribute(k, new THREE.BufferAttribute(arr, sz));
    });
    g.setIndex(o.geometry.index);
    const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const geo = mergeGeometries(geos); if (!geo) return;
  const mat = parts[0].material; mat.vertexColors = true; mat.color.setRGB(1, 1, 1); mat.needsUpdate = true;
  const one = new THREE.SkinnedMesh(geo, mat); one.name = 'KnightMerged';
  parts[0].parent.add(one); one.bind(parts[0].skeleton, parts[0].bindMatrix);
  parts.forEach((o) => o.parent.remove(o));
  // Same trick for rigid pieces that share one texture (the 3-part sword): 3 draw calls -> 1
  const groups = new Map();
  root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.material.map && o.parent) {
    const k = o.parent.uuid + o.material.map.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); } });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const gs = list.map((o) => {
      const g = new THREE.BufferGeometry(), c = o.material.color, get = ['getX', 'getY', 'getZ'];
      ['position', 'normal', 'uv'].forEach((k) => { const a = o.geometry.attributes[k], sz = a.itemSize, arr = new Float32Array(a.count * sz);
        for (let i = 0; i < a.count; i++) for (let j = 0; j < sz; j++) arr[i * sz + j] = a[get[j]](i);
        g.setAttribute(k, new THREE.BufferAttribute(arr, sz)); });
      g.setIndex(o.geometry.index); g.applyMatrix4(o.matrix);          // bake each piece's local offset
      const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
    });
    const geo = mergeGeometries(gs); if (!geo) continue;
    const mat = list[0].material; mat.vertexColors = true; mat.color.setRGB(1, 1, 1); mat.needsUpdate = true;
    const one = new THREE.Mesh(geo, mat); one.name = list[0].parent.name + 'Merged'; list[0].parent.add(one);
    list.forEach((o) => o.parent.remove(o));
  }
}
// tmplRoot (optional): an already tinted + dressed model to clone. SkeletonUtils.clone shares its materials.
function spawnChar(artName, animKey, tmplRoot) {
  const src = gltfOf(artName), obj = skClone(tmplRoot || src.scene);
  if (!tmplRoot) {
    ART.tint(obj, artName); ART.fit(THREE, obj, artName);            // tint also adds Game Artist's rim light
    if (artName === 'hero' && ART.dressHero) ART.dressHero(THREE, obj);   // pleated red cape + plume
    if (artName === 'hero' || artName === KING_ART) mergeSkinned(obj);
  }
  const g = new THREE.Group(); g.add(obj); scene.add(g);
  const mats = [], allMats = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const tri = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    o.castShadow = tri > 400;                         // only the big parts cast shadows (fewer draw calls)
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (m.emissive) mats.push({ m, base: m.emissive.clone() });
      if (!allMats.includes(m)) allMats.push(m);
    });
  });
  const mixer = new THREE.AnimationMixer(obj), acts = {};
  for (const [k, short] of Object.entries(ART.ANIMS[animKey])) { const c = ART.clip(src.animations, short); if (c) acts[k] = mixer.clipAction(c); }
  if (acts.Resurrect) acts.resurrect = acts.Resurrect; if (acts.Block) acts.block = acts.Block;   // KayKit skeleton extras from the table
  for (const c of src.animations) {                   // ...or found by clip name
    const n = c.name.split('|').pop();
    if (/resurrect/i.test(n) && !acts.resurrect) acts.resurrect = mixer.clipAction(c);
    if (/^block/i.test(n) && !acts.block) acts.block = mixer.clipAction(c);
  }
  const deaths = [acts.Death_A, acts.Death_B, acts.Death_C].filter(Boolean);
  if (!deaths.length) deaths.push(...src.animations.filter((c) => /death_?[abc]$/i.test(c.name.split('|').pop())).map((c) => mixer.clipAction(c)));
  const casters = []; obj.traverse((o) => { if (o.isMesh && o.castShadow) casters.push(o); });   // for the crowd shadow budget
  const ch = { g, obj, mixer, acts, deaths, cur: null, mats, allMats, glow: 0, glowCol: new THREE.Color(), warn: 0, casters };
  play(ch, 'idle');
  return ch;
}
function play(ch, name, once, speed = 1) {
  const a = ch.acts[name] || ch.acts.idle;
  if (!a || (ch.cur === a && !once)) { if (a) a.timeScale = speed; return; }
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!once; a.timeScale = speed;
  a.enabled = true; a.setEffectiveWeight(1);
  if (ch.cur && ch.cur !== a) a.crossFadeFrom(ch.cur, 0.12, false);
  a.play(); ch.cur = a;
}
function tintChar(ch) {             // hit flash (white/red) and attack warning glow (red)
  const w = ch.warn > 0 ? 0.5 + 0.5 * Math.sin(performance.now() / 50) : 0;
  for (const { m, base } of ch.mats) {
    if (ch.glow > 0) m.emissive.copy(ch.glowCol).multiplyScalar(Math.min(1, ch.glow * 12));   // full white for most of an 80ms hit flash
    else if (w) m.emissive.setRGB(0.7 * w, 0.05 * w, 0.02 * w);
    else m.emissive.copy(base);
  }
}
const flashChar = (ch, hex, t = 0.18) => { ch.glow = t; ch.glowCol.setHex(hex); };

// ============================================================
// POLISH PASS (slice 1): graphics helpers, hit feel, deaths, Oathbound allies, checkpoint
// ============================================================

function setOpacity(ch, o) {                         // fade a whole character in or out
  for (const m of ch.allMats) {
    if (!m.transparent) { m.transparent = true; m.needsUpdate = true; }
    m.opacity = o;
  }
}

// ---- Pixel particles: ONE pooled Points object for sparks, shade wisps and ally shimmer (1 draw call) ----
const FX_N = 256;
const fxPos = new Float32Array(FX_N * 3).fill(-9999), fxCol = new Float32Array(FX_N * 3);
const fxGeo = new THREE.BufferGeometry();
fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3).setUsage(THREE.DynamicDrawUsage));
fxGeo.setAttribute('color', new THREE.BufferAttribute(fxCol, 3).setUsage(THREE.DynamicDrawUsage));
const fxPts = new THREE.Points(fxGeo, new THREE.PointsMaterial({ size: 0.24, map: TX.pxEmber, vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
fxPts.frustumCulled = false; fxPts.visible = false; scene.add(fxPts);
const fx = Array.from({ length: FX_N }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, r: 1, g: 1, b: 1 }));
let fxNext = 0, fxLive = 0;
const _fc = new THREE.Color();
// emit(where, how many, color, { speed, up, grav, life, spread })
function emit(x, y, z, n, hex, o = {}) {
  _fc.setHex(hex);
  for (let k = 0; k < n; k++) {
    const i = fxNext; fxNext = (fxNext + 1) % FX_N;   // reuse the oldest slot (the pool never grows)
    const p = fx[i], a = Math.random() * 6.283, sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.6), sr = o.spread ?? 0.1;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = (o.up ?? 2) * (0.5 + Math.random());
    p.grav = o.grav ?? 9; p.max = p.life = (o.life ?? 0.4) * (0.6 + Math.random() * 0.6);
    p.r = _fc.r; p.g = _fc.g; p.b = _fc.b;
    fxPos[i * 3] = x + (Math.random() - 0.5) * sr; fxPos[i * 3 + 1] = y + (Math.random() - 0.5) * sr; fxPos[i * 3 + 2] = z + (Math.random() - 0.5) * sr;
  }
  fxLive += n; fxPts.visible = true;
}
function updateFX(dt) {
  if (!fxLive) return;                               // nothing alive: skip the work (and the draw call)
  fxLive = 0;
  for (let i = 0; i < FX_N; i++) {
    const p = fx[i], j = i * 3; if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { fxPos[j + 1] = -9999; continue; }
    fxLive++;
    p.vy -= p.grav * dt;
    fxPos[j] += p.vx * dt; fxPos[j + 1] += p.vy * dt; fxPos[j + 2] += p.vz * dt;
    const k = p.life / p.max;                          // additive blending: darker = more see-through
    fxCol[j] = p.r * k; fxCol[j + 1] = p.g * k; fxCol[j + 2] = p.b * k;
  }
  fxGeo.attributes.position.needsUpdate = true; fxGeo.attributes.color.needsUpdate = true;
  fxPts.visible = fxLive > 0;
}


// ---- Sound: play the first name sfx.js actually has (Audio Designer's new names first, older ones as a fallback) ----
function sfx(...names) {
  if (typeof SFX === 'undefined' || !window.SFX || !Array.isArray(window.SFX.names)) return;
  const n = names.find((k) => window.SFX.names.includes(k));
  if (n) sound(n);
}

// ---- Hit feel ----
let hitStop = 0, shake = 0, slowT = 0, kickT = 0;                          // hitStop: seconds the game stays frozen; shake: camera shake strength
function hitFX(e, src) {
  flashChar(e.ch, 0xffffff, 0.08);                   // 80 ms white flash
  const y = groundH(e.x, e.z) + (isBoss(e) ? 2 : e.type === 'wolf' ? 0.6 : 1.0);
  emit(e.x, y, e.z, 8 + Math.floor(Math.random() * 5), e.type === 'shade' ? 0xd8b0ff : 0xffe0a0, { speed: 4, up: 2.5, life: 0.35 });
  if (src === 'hero') hitStop = 0.06;                // 60 ms freeze on Aldren's hits (allies don't freeze the game)
}

// ---- Deaths: clip or tip-over, then the body fades out; shades break into rising wisps ----
function removeBody(e) { scene.remove(e.ch.g); e.removed = true; }
function updateDeaths(dt) {
  for (const e of enemies) {
    if (e.alive || e.removed) continue;
    e.dieT += dt;
    if (e.vx || e.vz) moveEnemy(e, 0, 0, dt);          // slide with the last hit's knockback
    const g = e.ch.g;
    if (e.type === 'shade') {                          // no body: shrink, fade and rise away as purple wisps
      const k = Math.min(1, e.dieT / 0.8);
      g.scale.setScalar(1 - 0.7 * k); setOpacity(e.ch, 0.85 * (1 - k)); e.sink = -1.2 * k;
      if (k < 1) emit(e.x, groundH(e.x, e.z) + 0.6 + k, e.z, 2, Math.random() < 0.5 ? 0x9a5aff : 0x5a2aa0, { speed: 0.8, up: 1.6, grav: -1.5, life: 0.9, spread: 0.8 });
      else removeBody(e);
      continue;
    }
    if (!e.clipDeath) {                                // no Death clip: tip over (the Warden kneels first)
      g.rotation.order = 'YXZ';
      if (e.type === 'warden') { e.sink = 0.6 * smooth01(e.dieT / 0.6); g.rotation.x = -1.45 * smooth01((e.dieT - 0.5) / 1.0); }
      else g.rotation.x = -1.45 * smooth01(e.dieT / 0.4);
    }
    if (isBoss(e) && e.dieT > 1.3 && !e.thud) {   // the moment he hits the ground
      e.thud = true; shake = Math.max(shake, 0.6); rumble(350, 1);
      emit(e.x, groundH(e.x, e.z) + 0.4, e.z, 30, 0xffb060, { speed: 6, up: 3, life: 0.6, spread: 1.5 });
    }
    const T = Math.max(e.type === 'king' ? 6 : 0, (e.fadeAt || 2.4) + 0.8);   // death clip + 1.5 s hold, then a 0.8 s fade
    if (e.dieT > T - 0.8) setOpacity(e.ch, Math.max(0, (T - e.dieT) / 0.8));
    if (e.dieT >= T) removeBody(e);
  }
}

// ---- Oathbound: spirit knights Aldren can raise (max 2) ----
const allies = [];                                   // a pool of 2, built once at load and reused (no loading hitch)
let allyTmpl = null;
function makeAllies() {
  // ONE tinted Oathbound (RealmArt.MODELS.oathbound: pale blue plate, see-through, strong blue rim) + a spirit cape/plume.
  // Each ally is a SkeletonUtils clone of it, so all allies share the same materials.
  allyTmpl = skClone(gltfOf('oathbound').scene);
  ART.tint(allyTmpl, 'oathbound'); ART.fit(THREE, allyTmpl, 'oathbound');
  if (ART.dressHero) ART.dressHero(THREE, allyTmpl, { spirit: true });
  mergeSkinned(allyTmpl);
  for (let i = 0; i < MAX_ALLIES; i++) {
    const ch = spawnChar('oathbound', 'hero', allyTmpl);
    ch.obj.traverse((o) => { if (o.isMesh) o.castShadow = false; });          // spirits cast no shadow (and save draw calls)
    ch.mats = [];                                    // shared materials: skip the per-character hit flash (it would flash both)
    ch.g.visible = false;
    allies.push({ ch, i, on: false, alive: false, x: 0, z: 0, face: 0, hp: 3, fade: 0, cd: 0, swingT: 0, inv: 0, dieT: 0, kx: 0, kz: 0, retarget: 0, target: null });
  }
}
const alliesOn = () => allies.filter((a) => a.on).length;
const allyDmg = () => 0.5 * (1 + (run.sword === 'gravesteel' ? 1 : 0));    // half of Aldren's normal swing
function summon() {
  if (!canAct()) return false;
  const a = allies.find((x) => !x.on);
  if (!a) { toast('Two Oathbound already stand with you.'); return false; }
  if (run.summonCd > 0) { toast(`The oath renews in ${Math.ceil(run.summonCd)}s.`); return false; }
  if (run.fuel < SUMMON_COST) { toast('Not enough light.<br>Raising an Oathbound costs 25 torch fuel.'); return false; }
  run.fuel -= SUMMON_COST; run.summonCd = SUMMON_CD; run.summoned++;
  const side = a.i ? -1 : 1, rx = Math.cos(hero.face), rz = -Math.sin(hero.face);   // Aldren's right-hand side
  const p = pushOut({ x: hero.x + rx * 1.4 * side - Math.sin(hero.face) * 0.8, z: hero.z + rz * 1.4 * side - Math.cos(hero.face) * 0.8 }, 0.4);
  Object.assign(a, { sink: 0, on: true, alive: true, x: p.x, z: p.z, face: hero.face, hp: 3, fade: 0, cd: 0.6, swingT: 0, inv: 0, dieT: 0, kx: 0, kz: 0, target: null, dismissed: false });
  a.ch.g.visible = true; a.ch.g.scale.setScalar(0.05); play(a.ch, 'idle');
  emit(a.x, groundH(a.x, a.z) + 1, a.z, 30, 0x6fb0ff, { speed: 1.5, up: 2, grav: -1, life: 0.8, spread: 1 });
  sfx('summon', 'ring');
  rumble(120, 0.5); banner('An Oathbound answers');
  return true;
}
function hurtAlly(a, dmg, fx0, fz0, knock = 5) {
  if (!a.alive || a.fade < 1 || a.inv > 0) return false;
  a.hp -= dmg; a.inv = 0.5; sound('hit');
  if (fx0 != null) { const dx = a.x - fx0, dz = a.z - fz0, l = Math.hypot(dx, dz) || 1; a.kx = dx / l * knock; a.kz = dz / l * knock; }
  emit(a.x, groundH(a.x, a.z) + 1, a.z, 8, 0x9cc8ff, { life: 0.3 });
  if (a.hp <= 0) { a.alive = false; a.dismissed = false; a.dieT = 0; play(a.ch, 'death', true); sfx('allyDeath', 'death', 'burn'); }
  else play(a.ch, 'hit', true, 1.6);
  return true;
}
function dismissAllies(now) {                       // Aldren died, the slice ended, or a retry: they fade away
  endHorde(now);                                     // the Lanternkin go too
  for (const a of allies) {
    if (now) { a.on = a.alive = false; a.ch.g.visible = false; a.ch.g.scale.setScalar(1); continue; }
    if (a.alive) { a.alive = false; a.dismissed = true; a.dieT = 0; }
  }
}
// Enemies pick a target: Aldren, or an Oathbound that is clearly closer (within 7 m)
function enemyTarget(e) {
  const dh = Math.hypot(hero.x - e.x, hero.z - e.z);
  let best = null, bd = Math.min(dh - 0.5, 7);
  for (const a of allies) if (a.alive && a.fade >= 1) { const d = Math.hypot(a.x - e.x, a.z - e.z); if (d < bd) { bd = d; best = a; } }
  return best ? { x: best.x, z: best.z, ok: true, ally: best } : { x: hero.x, z: hero.z, ok: !hero.dying, ally: null };
}
const strike = (T, dmg, fx0, fz0, knock, e) => (T.ally ? hurtAlly(T.ally, dmg, fx0, fz0, knock)   // Part 3: light blows can be parried, 2-heart blows only rolled
  : enemyHit(e || { x: fx0, z: fz0 }, { kind: dmg >= 2 ? 'heavy' : 'light', dmg, parry: dmg < 2 }, T));
// Ally brain: follow Aldren -> pick the nearest enemy within 10 m -> chase -> swing on a cooldown
function updateAllies(dt) {
  for (const a of allies) {
    if (!a.on) continue;
    const ch = a.ch, gy = groundH(a.x, a.z);
    if (!a.alive) {                                    // dying (death clip, then fade) or dismissed (quick fade)
      a.dieT += dt;
      const start = a.dismissed ? 0 : 1.4, len = a.dismissed ? 0.6 : 0.8, k = Math.min(1, (a.dieT - start) / len);
      if (k > 0) { ch.g.scale.setScalar(Math.max(0.05, 1 - k)); a.sink = 0.8 * k; if (Math.random() < 0.6) emit(a.x, gy + 0.3 + Math.random() * 1.4, a.z, 1, 0x6fb0ff, { speed: 0.5, up: 1.5, grav: -1, life: 0.7, spread: 0.6 }); }
      if (k >= 1) { a.on = false; ch.g.visible = false; ch.g.scale.setScalar(1); a.sink = 0; }
      continue;
    }
    if (a.fade < 1) {                                  // rising in with a blue shimmer
      a.fade = Math.min(1, a.fade + dt / 0.6); ch.g.scale.setScalar(0.05 + 0.95 * smooth01(a.fade));
      emit(a.x, gy + Math.random() * 1.8, a.z, 1, 0x6fb0ff, { speed: 0.6, up: 1.2, grav: -1, life: 0.6, spread: 0.7 });
    }
    a.cd -= dt; a.inv -= dt; a.retarget -= dt;
    const dh = Math.hypot(hero.x - a.x, hero.z - a.z);
    if (dh > 22) {                                     // left far behind (stuck on a wall): shimmer back to Aldren
      const p = pushOut({ x: hero.x - Math.sin(hero.face) * 1.5, z: hero.z - Math.cos(hero.face) * 1.5 }, 0.4); a.x = p.x; a.z = p.z;
      emit(a.x, groundH(a.x, a.z) + 1, a.z, 16, 0x6fb0ff, { speed: 1.2, up: 1.5, grav: -1, life: 0.6, spread: 0.8 });
    }
    if (a.retarget <= 0) {                             // 1) look for the nearest enemy (not every frame: cheaper)
      a.retarget = 0.4; a.target = null; let bd = 10;
      for (const e of enemies) {
        if (!e.alive || (isBoss(e) && !e.awake) || Math.hypot(e.x - hero.x, e.z - hero.z) > 16) continue;
        const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < bd) { bd = d; a.target = e; }
      }
    }
    const t = a.target && a.target.alive ? a.target : null;
    let vx = 0, vz = 0;
    if (a.swingT > 0) {                                // 4) mid-swing: the blade lands halfway through
      a.swingT -= dt;
      if (!a.struck && a.swingT < 0.25) {
        a.struck = true;
        if (t) { const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz) || 1; if (d < 2.2 + t.r) hurtEnemy(t, allyDmg(), dx / d, dz / d, false, 'ally'); }
      }
    } else if (t) {                                    // 2) chase, 3) swing when close
      const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz) || 1;
      a.face += angDiff(Math.atan2(dx, dz), a.face) * Math.min(1, 10 * dt);
      if (d > 1.4 + t.r) { vx = dx / d * 5; vz = dz / d * 5; }
      else if (a.cd <= 0) { a.swingT = 0.5; a.struck = false; a.cd = 1.2; play(ch, 'attack', true, 1.3); sound('swing'); }
    } else if (dh > 3) {                               // 1) follow: walk to a spot beside Aldren
      const side = a.i ? -1 : 1, px = hero.x + Math.cos(hero.face) * 1.9 * side - Math.sin(hero.face) * 0.3, pz = hero.z - Math.sin(hero.face) * 1.9 * side - Math.cos(hero.face) * 0.3;
      const dx = px - a.x, dz = pz - a.z, d = Math.hypot(dx, dz) || 1, sp = dh > 6 ? 6.2 : 4.6;
      if (d > 0.3) { vx = dx / d * sp; vz = dz / d * sp; a.face += angDiff(Math.atan2(dx, dz), a.face) * Math.min(1, 10 * dt); }
    }
    const p = { x: a.x + (vx + a.kx) * dt, z: a.z + (vz + a.kz) * dt };
    a.kx *= Math.exp(-7 * dt); a.kz *= Math.exp(-7 * dt);
    for (const o of [hero, ...allies]) {               // don't stand inside Aldren or the other knight
      if (o === a || (o.on === false)) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      if (d < 0.9 && d > 1e-4) { p.x = o.x + dx / d * 0.9; p.z = o.z + dz / d * 0.9; }
    }
    pushOut(p, 0.4); a.x = p.x; a.z = p.z;
    const moving = Math.hypot(vx, vz) > 0.1;
    if (a.swingT <= 0 && !(ch.cur === ch.acts.hit && ch.cur.isRunning())) play(ch, moving ? 'run' : 'idle', false, moving ? 1 : 1);
  }
}

// ---- Lanternkin: the Goblin Horde (50 goblins, ONE draw call, brains tick 15 times a second) ----
const HORDE_N = 50, HORDE_CD = 60, HORDE_LIFE = 20, TICK = 1 / 15;
let sw = null;                                       // Game Artist's swarm mesh (made once in boot; stays null if realm-art.js is old)
const gobs = Array.from({ length: HORDE_N }, (_, i) => ({ i, x: 0, z: 0, px: 0, pz: 0, vx: 0, vz: 0, alive: false, pop: 0, cd: 0, lunge: 0, dieIn: -1 }));
const horde = { on: false, t: 0, acc: 0, dmgW: 0 };  // t: seconds left, acc: time saved up for the next tick, dmgW: damage done to the Warden
const gobDmg = () => 0.1 * (1 + (run.sword === 'gravesteel' ? 1 : 0));   // 1/10 of Aldren's normal hit
function makeHorde() {
  if (typeof ART.swarm !== 'function') { console.warn('RealmArt.swarm missing: HORDE disabled'); $('hordeBtn').disabled = true; return; }
  sw = ART.swarm(THREE, HORDE_N); scene.add(sw); drawHorde(1);
}
function summonHorde() {
  if (!canAct()) return false;
  if (!sw) { toast('The horn is silent (old art file). Reload the page.'); return false; }
  if (horde.on) { toast('The Lanternkin are already here!'); return false; }
  if (run.hordeCharges < 1) { toast('No horn charge.<br>Each Ember you take gives one.'); return false; }
  if (run.hordeCd > 0) { toast(`The horn is still ringing. Ready in ${Math.ceil(run.hordeCd)}s.`); return false; }
  run.hordeCharges--; run.hordeCd = HORDE_CD; run.hordes++;
  Object.assign(horde, { on: true, t: HORDE_LIFE, acc: 0, dmgW: 0 });
  for (const g of gobs) {                            // pour out of the ground in a ring around Aldren
    const a = Math.random() * 6.283, r = 1 + Math.random() * 2.5, p = pushOut({ x: hero.x + Math.cos(a) * r, z: hero.z + Math.sin(a) * r }, 0.2);
    Object.assign(g, { x: p.x, z: p.z, px: p.x, pz: p.z, vx: 0, vz: 0, alive: true, pop: 0, cd: Math.random() * 0.5, lunge: 0, dieIn: -1 });
  }
  emit(hero.x, hero.y + 0.3, hero.z, 40, 0x9fe870, { speed: 3, up: 2, life: 0.6, spread: 3 });
  sound('horde'); rumble(200, 0.6); banner('The Lanternkin pour out!');
  return true;
}
function popGob(g) {                                 // a goblin dies: dust frames 5-7, 6 green pixels, a tiny pop
  if (!g.alive) return;
  g.alive = false; g.pop = 0.0001;
  emit(g.x, groundH(g.x, g.z) + 0.3, g.z, 6, 0x9fe870, { speed: 1.5, up: 1.5, life: 0.4, spread: 0.3 });
  sound('goblinPop');                                // sfx.js rate-limits this itself
}
function endHorde(now) {                             // time's up, Aldren died, a retry, or the slice ended
  if (!sw) return;
  for (const g of gobs) { if (now) { g.alive = false; g.pop = 0; } else if (g.alive) g.dieIn = Math.random() * 0.6; }
  if (now) { horde.on = false; drawHorde(1); }
}
// One brain tick for every goblin (boids-lite): push apart, chase the nearest enemy, or stay near Aldren
const cells = new Map();
function hordeTick(dt) {
  const foes = enemies.filter((e) => e.alive && !(isBoss(e) && !e.awake) && Math.hypot(e.x - hero.x, e.z - hero.z) < 25 &&
    !(torchOnly(e) && Math.hypot(e.x - hero.x, e.z - hero.z) > lightR()));   // shades only count inside the torchlight
  for (const e of foes) e.swat = (e.swat || 0) - dt;  // enemies can swat one touching goblin every so often
  cells.clear();                                     // 1 m grid, so each goblin only checks goblins next to it (cheap)
  for (const g of gobs) if (g.alive) { const k = Math.floor(g.x) * 1000 + Math.floor(g.z); (cells.get(k) || cells.set(k, []).get(k)).push(g); }
  for (const g of gobs) {
    g.px = g.x; g.pz = g.z;                          // remember where it was, to slide smoothly between ticks
    if (!g.alive) continue;
    if (g.dieIn >= 0 && (g.dieIn -= dt) < 0) { popGob(g); continue; }
    g.cd -= dt; g.lunge -= dt;
    let t = null, bd = 12;                           // 1) nearest enemy within 12 m
    for (const e of foes) { const d = Math.hypot(e.x - g.x, e.z - g.z); if (d < bd) { bd = d; t = e; } }
    let wx, wz, sp = 5.5;                            // wx, wz: the way this goblin WANTS to go
    if (t) { wx = t.x - g.x; wz = t.z - g.z; }
    else { wx = hero.x - g.x; wz = hero.z - g.z; const d = Math.hypot(wx, wz); if (d < 2.5) wx = wz = 0; if (d > 7) sp = 7.5; }   // 2) loosely follow Aldren
    const wl = Math.hypot(wx, wz) || 1; wx = wx / wl * sp; wz = wz / wl * sp;
    let sx = 0, sz = 0;                              // 3) separation: step away from goblins that are too close
    const cx = Math.floor(g.x), cz = Math.floor(g.z);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of cells.get((cx + a) * 1000 + cz + b) || []) {
      const dx = g.x - o.x, dz = g.z - o.z, d = dx * dx + dz * dz;
      if (o !== g && d < 0.25 && d > 1e-6) { sx += dx / d; sz += dz / d; }
    }
    const hx = g.x - hero.x, hz = g.z - hero.z, hd = hx * hx + hz * hz;   // don't crowd inside Aldren either
    if (hd < 0.6 && hd > 1e-6) { sx += hx / hd * 2; sz += hz / hd * 2; }
    if (t && bd < t.r + 0.4) {                       // 4) touching an enemy: stop, lunge, hit (1 s cooldown each)
      wx = wz = 0;
      if (g.cd <= 0) {
        g.cd = 1; g.lunge = 0.25;
        let dmg = gobDmg();
        if (t.type === 'warden') { dmg = Math.min(dmg, 0.25 * t.max - horde.dmgW); horde.dmgW += Math.max(0, dmg); }   // max 25% of the Warden per swarm (the King's cap is in hurtEnemy)
        if (dmg > 0) hurtEnemy(t, dmg, 0, 0, false, 'horde');
      }
      if (t.swat <= 0 && t.alive) { t.swat = t.type === 'warden' ? 0.25 : 0.5; popGob(g); continue; }   // 1 HP: one swat and it's dust
    }
    g.vx += (wx + sx - g.vx) * 0.5; g.vz += (wz + sz - g.vz) * 0.5;   // steer smoothly (not an instant turn)
    const p = pushOut({ x: g.x + g.vx * dt, z: g.z + g.vz * dt }, 0.2); g.x = p.x; g.z = p.z;
    if (Math.hypot(g.x - hero.x, g.z - hero.z) > 30) { g.x = g.px = hero.x; g.z = g.pz = hero.z; }   // lost behind a wall: back to Aldren
  }
}
function updateHorde(dt) {
  if (!horde.on || !sw) return;
  horde.t -= dt;
  if (horde.t <= 0 && horde.t + dt > 0) endHorde(false);   // 20 s are up: they all pop into dust
  horde.acc += dt;
  while (horde.acc >= TICK) { horde.acc -= TICK; hordeTick(TICK); }
  let busy = false;
  for (const g of gobs) { if (g.pop > 0) { g.pop += dt; if (g.pop > 0.3) g.pop = 0; } if (g.alive || g.pop > 0) busy = true; }
  if (!busy) horde.on = false;                       // everyone has popped
  drawHorde(horde.acc / TICK);
}
// Send every goblin to the swarm mesh: position (slid between the last two ticks), frame and size, then ONE flush
function drawHorde(k) {
  for (const g of gobs) {
    const x = g.px + (g.x - g.px) * k, z = g.pz + (g.z - g.pz) * k;
    let f = (g.i % 2) * 2 + (Math.floor(run.time * 7 + g.i) % 2);   // even goblins: spear walk 0-1, odd: lantern walk 2-3
    if (g.lunge > 0) f = 4;                                          // lunge / attack
    if (g.pop > 0) f = 5 + Math.min(2, Math.floor(g.pop / 0.1));     // dust pop 5, 6, 7
    sw.userData.set(g.i, x, groundH(x, z), z, f, g.alive || g.pop > 0 ? 1 : 0);   // scale 0 hides it
  }
  sw.userData.flush();
  sw.visible = horde.on;                             // no goblins out: skip the draw call
}

// ============================================================
// SLICE 2: THE KEEP, THE ALTAR, THE HOLLOW KING
// The keep is built far away from the forest (around z = -150), so nothing overlaps.
// Only ONE area is shown at a time: entering the keep hides the whole forest + courtyard (big draw call saver).
// ============================================================
const artFn = (n) => (typeof ART[n] === 'function' ? ART[n] : null);   // Game Artist's new helpers, only if they exist
const realmG = new THREE.Group(), keepG = new THREE.Group();          // everything in slice 1 / everything in the keep
keepG.visible = false;
// Anything a build function adds to the scene gets moved into a group, so we can hide the whole area in one go
function collect(group, build) {
  const before = new Set(scene.children); build();
  for (const o of [...scene.children]) if (!before.has(o)) group.add(o);
  scene.add(group);
}
const GATE_LIGHT0 = new THREE.Vector3();
function applyArea(a) {                              // 'realm' (forest + courtyard) or 'keep'
  const k = a === 'keep'; run.area = a;
  realmG.visible = backdrop.visible = grass.visible = !k;   // unload slice 1: hidden things cost 0 draw calls
  keepG.visible = k;
  Object.assign(BOUNDS, k ? KEEP_B : REALM_B);
  if (k) gateLight.position.set(0, 3.2, KZ); else gateLight.position.copy(GATE_LIGHT0);
}
const K = {};                                        // keep pieces we animate later (doors, flames, fires, shockwave, crown)
function firePoints(list, size = 1.8) {              // many fire glows in ONE draw call (instead of one sprite each)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: TX.pxTorch, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(p); return p;
}
function mistPoints(cx, cz, r, n) {                  // purple cursed mist puffs, one draw call
  const mp = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * r; mp.push(cx + Math.cos(a) * d, groundH(cx + Math.cos(a) * d, cz + Math.sin(a) * d) + 0.4 + rnd() * 2, cz + Math.sin(a) * d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: texOf('cursedMist'), size: 7, transparent: true, depthWrite: false })); scene.add(p); return p;
}
function buildKeep() {
  const hasT = (n) => (ART.textures || []).includes(n);
  const stone = new THREE.MeshStandardMaterial({ map: texOf(hasT('keepStone') ? 'keepStone' : 'cobble', 1), color: 0x9a92a8, roughness: 0.95 });
  // Game Artist's KayKit dungeon kit: every keep wall, stair, vault and torch below is baked from its pieces
  const kit = hasModel('keepInterior') && artFn('kit') ? ART.kit(THREE, gltfOf('keepInterior').scene, 'keepInterior') : null;
  const bake = (L, s = 1) => { const g = ART.bake(THREE, kit, L, s); scene.add(g); return g; };
  const walkG = [], camG = [];                       // world-space copies for the two BVHs (floor rays, camera rays)
  const bvhOf = (list, obj) => { obj.updateMatrixWorld(true); obj.traverse((o) => { if (o.isMesh && o.name !== 'ceiling' && o.name !== 'carpet') list.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); }); };
  const block = (x0, x1, z0, z1, h0, h1) => {        // a box whose top slopes from h0 (at z0) to h1 (at z1): rampart proxies
    const b = new THREE.BoxGeometry(x1 - x0, 1, z1 - z0); b.translate((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? (p.getZ(i) < (z0 + z1) / 2 ? h0 : h1) : 0);
    b.computeVertexNormals(); return b;
  };
  const parts = [block(-14.5, 14.5, KZ - 20.5, KZ - 17, RH, RH), block(11, 14.5, KZ - 17, KZ + 6, RH, RH)];   // north + east rampart tops (never drawn)
  const flat = new THREE.PlaneGeometry(90, 52).rotateX(-Math.PI / 2).translate(-15, 0, KZ);
  walkG.push(flat, ...parts);
  // --- the hall: keepRoom from the kit, 42 x 30 m, turned so its doorway (+Z) faces the throne room in the west ---
  if (artFn('keepRoom')) {
    K.hall = ART.keepRoom(THREE, kit ? { kit, s: 1.5, w: 42, d: 30, braziers: 0, pillars: 0, torches: 0 } : { w: 42, d: 30, h: 6, braziers: 0, pillars: 0 });
    K.hall.rotation.y = -Math.PI / 2; K.hall.position.set(0, kit ? -0.225 : 0, KZ); scene.add(K.hall); bvhOf(camG, K.hall);
  }
  const walls = [[-14.5, KZ - 20.8, 14.5, KZ - 20.8], [-14.5, KZ + 20.8, 14.5, KZ + 20.8], [14.5, KZ - 20.8, 14.5, KZ + 20.8],
    [-14.5, KZ - 20.8, -14.5, KZ - 2.6], [-14.5, KZ + 2.6, -14.5, KZ + 20.8]];   // west wall has the throne doorway
  walls.forEach(([a, b, c, d]) => addWall(a, b, c, d, 0.5, null, 6));
  // --- ramparts, stairs, vault and wall torches ---
  const tp = [[-14.1, KZ - 10, Math.PI / 2], [-14.1, KZ + 10, Math.PI / 2], [14.1, KZ + 12, -Math.PI / 2], [-4, KZ + 20.1, Math.PI], [4, KZ + 20.1, Math.PI]];
  if (kit && artFn('bake')) {
    const L = [], q = 0.875;                         // pieces at 0.875 scale: a 4 m wall becomes 3.5 m = the rampart height
    for (let i = 0; i < 8; i++) L.push(['wall', -12.75 + 3.5 * i, KZ - 17 - 0.44, 0, 0, q]);                    // north rampart face
    for (let i = 0; i < 7; i++) L.push(['wall', 11 + 0.44, KZ + 4.25 - 3.5 * i, Math.PI / 2, 0, q]);             // east rampart face
    for (let i = 0; i < 9; i++) L.push(['floor_tile_large', -12.75 + 3.5 * i, KZ - 18.75, 0, RH - 0.044, q]);    // rampart walkway
    for (let i = 0; i < 6; i++) L.push(['floor_tile_large', 12.75, KZ + 4.25 - 3.5 * i, 0, RH - 0.044, q]);
    [-13.3, -10.7, -8.1].forEach((x) => L.push(['wall', x, KZ + 13, 0, 0, 0.65]));                              // the vault
    L.push(['wall', -7, KZ + 14.3, Math.PI / 2, 0, 0.65], ['wall_doorway', -7, KZ + 16.9, Math.PI / 2, 0, 0.65], ['wall', -7, KZ + 19.5, Math.PI / 2, 0, 0.65]);
    L.push(['chest_gold', -13.2, KZ + 19.4, Math.PI / 2, 0, 0.8], ['barrier', -10.8, KZ + 13.8, 0, 0, 0.6]);
    tp.forEach(([x, z, r]) => L.push(['torch_mounted', x, z, r, 2.6]));
    const g = bake(L); g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); bvhOf(camG, g);
    // the stairs: one kit flight stretched to 8 m long and 3.5 m high (top at the rampart)
    const st = bake([['stairs', 0, 0, 0, 0, 1]]); st.position.set(12.75, 0, KZ + 6); st.scale.set(3.5 / 5, RH / 4, 8 / 4);   // its top tread is 4 m up
    const n0 = walkG.length; bvhOf(walkG, st); bvhOf(camG, st);
    for (const g of walkG.slice(n0)) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > RH) p.setY(i, RH); }   // flatten its back lip for floor rays
  } else {                                           // no kit: plain stone blocks (same sizes)
    const stone = new THREE.MeshStandardMaterial({ map: texOf('cobble', 1), color: 0x9a92a8, roughness: 0.95 });
    const sp = []; for (let i = 0; i < 8; i++) { const h = RH * (i + 1) / 8; sp.push(block(11, 14.5, KZ + 13 - i, KZ + 14 - i, h, h)); }
    const vb = [block(-14.6, -7, KZ + 12.8, KZ + 13.2, 2.6, 2.6), block(-7.2, -6.8, KZ + 13, KZ + 15.6, 2.6, 2.6), block(-7.2, -6.8, KZ + 18.2, KZ + 20.6, 2.6, 2.6)];
    const m = new THREE.Mesh(mergeGeometries([...parts, ...sp, ...vb].map((g) => g.index ? g.toNonIndexed() : g)), stone); m.receiveShadow = true; scene.add(m);
    walkG.push(...sp); camG.push(...parts, ...sp);
    if (!K.hall) walls.forEach(([a, b, c, d]) => camG.push(new THREE.BoxGeometry(Math.hypot(c - a, d - b) + 1, 6, 1).rotateY(-Math.atan2(d - b, c - a)).translate((a + c) / 2, 3, (b + d) / 2)));
  }
  K.hallFires = firePoints(tp.map(([x, z, r]) => [x + Math.sin(r) * 0.45, 3.4, z + Math.cos(r) * 0.45]));
  addWall(-14.6, KZ + 13, -7, KZ + 13, 0.4, null, 2.6); addWall(-7, KZ + 13, -7, KZ + 15.6, 0.4, null, 2.6); addWall(-7, KZ + 18.2, -7, KZ + 20.6, 0.4, null, 2.6);   // vault walls
  addCircle(-13.2, KZ + 19.4, 0.8);
  // BVH for the floor: groundH() shoots a ray down onto it (stairs + ramparts)
  const bvh = (list) => { const g = mergeGeometries(list.map((x) => { const c = x.index ? x.toNonIndexed() : x.clone(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k); return c; }));
    g.computeBoundsTree = computeBoundsTree; g.computeBoundsTree(); const m = new THREE.Mesh(g); m.raycast = acceleratedRaycast; m.updateMatrixWorld(true); return m; };
  K.walk = bvh(walkG);                                // never drawn
  // --- the throne room: Game Artist's keepRoom (pillars, braziers, carpet), turned so its throne end points west ---
  const x0 = THR.x - THR.hx, x1 = THR.x + THR.hx, z0 = THR.z - THR.hz, z1 = THR.z + THR.hz, room = artFn('keepRoom'), seg = (a, b, c, d) => addWall(a, b, c, d, 0.5, null, 6);
  if (room) {
    K.room = room(THREE, kit ? { kit, s: THR.hx * 2 / 16, w: THR.hz * 2, d: THR.hx * 2, braziers: 4 } : { w: THR.hz * 2, d: THR.hx * 2, h: 9, braziers: 4 });
    K.room.rotation.y = Math.PI / 2; K.room.position.set(THR.x, kit ? -0.1 * THR.hx * 2 / 16 : 0, THR.z); scene.add(K.room);
    const wm = K.room.getObjectByName('keepWalls'), wp = wm && wm.geometry.attributes.position;   // open its door end (the first wall in its merged mesh)
    if (wp && [0, 1, 2, 3].every((i) => Math.abs(wp.getZ(i) - THR.hx) < 0.01)) wm.geometry.setDrawRange(6, Infinity);
    const loc = (v) => [THR.x + v.z, THR.z - v.x];                                   // room space -> world (turned 90 degrees)
    (K.room.userData.braziers || []).forEach((b) => addCircle(...loc(b), 0.6));
    const np = Math.floor(THR.hx * 2 / 6);
    for (let i = 0; i < np; i++) for (const sx of [-1, 1]) addCircle(...loc({ x: sx * (THR.hz - 2), z: -THR.hx + (i + 0.5) * THR.hx * 2 / np }), 0.8);
    addWall(x1, z0, x0, z0, 0.4, null, 9); addWall(x0, z0, x0, z1, 0.4, null, 9); addWall(x0, z1, x1, z1, 0.4, null, 9);
    bvhOf(camG, K.room);
  } else { seg(x1, z0, x0, z0); seg(x0, z0, x0, z1); seg(x0, z1, x1, z1); }            // no keepRoom: collision only
  K.cam = bvh(camG);                                  // BVH for the camera: the real walls, stairs and rampart faces
  addWall(-14.5, KZ - 17, 11, KZ - 17, 0.25, null, RH); addWall(11, KZ - 17, 11, KZ + 6, 0.25, null, RH);   // rampart faces (the stairs are open)
  addWall(-14.8, KZ - 2.6, -14.8, KZ + 2.6, 0.8, () => !run.throneOpen, 6);    // throne doors (closed until the altar burns)
  addWall(-7, KZ + 15.6, -7, KZ + 18.2, 0.4, () => !run.vaultOpen, 4);         // vault bars
  if (!K.room) {                                     // placeholder braziers (keepRoom has its own)
    const bz = [[-6, -6], [-6, 6], [6, -6], [6, 6]].map(([a, b]) => [THR.x + a, THR.z + b]);
    scatter('bonfire', bz.map(([x, z]) => ({ x, z, s: 1.2 }))); bz.forEach(([x, z]) => addCircle(x, z, 0.7));
    K.throneFires = firePoints(bz.map(([x, z]) => [x, 0.9, z]), 2.6);
  }
  // --- the altar in the middle of the hall: a stone block with 3 empty Ember cups ---
  addCircle(0, KZ, 1.3);
  if (artFn('altar')) { K.altar = ART.altar(THREE); K.altar.position.set(0, 0, KZ); scene.add(K.altar); }   // Game Artist's altar (sockets, rune ring, light column)
  else {                                             // placeholder: a stone block with 3 Ember cups
    const altar = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2, 1.1, 1.4).translate(0, 0.55, 0), new THREE.BoxGeometry(2.4, 0.2, 1.8).translate(0, 1.2, 0)]), new THREE.MeshStandardMaterial({ color: 0x8a8298, roughness: 0.95 }));
    altar.position.set(0, 0, KZ); scene.add(altar);
    K.emb = [-0.7, 0, 0.7].map((x) => { const m = new THREE.Mesh(PGEO.ember, new THREE.MeshBasicMaterial({ color: 0x40302a })); m.scale.setScalar(0.7); m.position.set(x, 1.55, KZ); scene.add(m); return m; });
    K.altarFire = firePoints([[-0.7, 1.7, KZ], [0, 1.7, KZ], [0.7, 1.7, KZ]], 1.4); K.altarFire.visible = false;
  }
  // --- the throne, throne doors and vault bars ---
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a48, roughness: 0.8 });
  const throne = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.4, 1, 2).translate(0, 0.5, 0), new THREE.BoxGeometry(0.5, 4, 2.4).translate(-1, 2, 0)]), dark);
  throne.position.set(THR.x - THR.hx + 2, 0, THR.z); scene.add(throne); addCircle(THR.x - THR.hx + 2, THR.z, 1.3);
  K.door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 5.2), new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9 }));
  K.door.position.set(-14.8, 2.7, KZ); scene.add(K.door);
  K.bars = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 2.6), new THREE.MeshStandardMaterial({ color: 0x55586a, metalness: 0.5, roughness: 0.5 }));
  K.bars.position.set(-7, 1.5, KZ + 16.9); scene.add(K.bars);
  // --- cursed mist: a small pocket in the hall, and the throne room (only in the King's last phase) ---
  mistPoints(ZONES[3].x, ZONES[3].z, ZONES[3].r + 1, 26);
  K.throneMist = mistPoints(THR.x, THR.z, THR.r - 1, 50); K.throneMist.visible = false;
  // --- the King's shockwave ring and his crown ---
  if (artFn('shockwave')) { K.sw = ART.shockwave(THREE); scene.add(K.sw); }   // Game Artist's ring (else the plain ring below)
  K.wave = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  K.wave.visible = false; scene.add(K.wave);
  K.crown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 10), new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x6a5010, metalness: 0.7, roughness: 0.3 }));
  K.crown.visible = false; scene.add(K.crown);
  // Game Artist's keep looks, if realm-art.js has them yet (each one is optional)
  const look = artFn('keepLook'); if (look) try { look(THREE, keepG, K); } catch (e) { console.warn(e); }
}
// --- throne room state: braziers lit, no mist, no shockwave ---
function resetThrone() {
  run.kingMist = false; ZONES[4].r = -99; K.throneMist.visible = false; K.wave.visible = false; wave = null;
  if (K.throneFires) K.throneFires.visible = true;
  if (K.room) K.room.userData.snuff(false);
  try { if (window.Ambience && typeof Ambience.setBraziers === 'function') Ambience.setBraziers(true); } catch (e) {}
}
function resetKeep() {                               // a brand new game
  resetThrone(); setAltar(0);
  tweens.removeAll(); K.door.position.y = 2.7; K.bars.position.y = 1.5; K.crown.visible = false;
}
function setAltar(n) {                              // 0..3 Embers burning on the altar
  if (K.altar) K.altar.userData.setLit(n);
  if (K.emb) { K.emb.forEach((m, i) => m.material.color.setHex(i < n ? 0xffd36b : 0x40302a)); K.altarFire.visible = n > 0; }
}
function kingGlow(e) {                               // Game Artist's per-phase glow on the King
  if (!artFn('kingPhase')) return;
  ART.kingPhase(e.ch.obj, e.phase || 1); for (const mm of e.ch.mats) mm.base.copy(mm.m.emissive);   // keep it through hit flashes
}
const kPlay = (e, name, fb, once, sp) => play(e.ch, e.ch.acts[name] ? name : fb, once, sp);   // play a King clip if he has it
function enterKeep() {
  if (fadeT > 0) return;
  fade(() => {
    run.keepPending = false; applyArea('keep'); hero.x = 0; hero.z = KZ + 16; hero.face = Math.PI; hero.kx = hero.kz = 0; cam.yaw = 0; cam.pitch = 0.2;
    run.inKeep = true; run.checkpoint = { area: 'keep', x: 0, z: KZ + 16, horde: run.hordeCharges, name: 'the Keep Gate' };
    setZone('keep', true); banner('The Keep'); toast('Checkpoint: the Keep gate.');
  });
}
function openVault() {
  run.vaultOpen = true; emberMeshes.e3.locked = false; sfx('doorGrind', 'door'); banner('The vault opens');
  tw(K.bars.position, { y: -1.6 }, 1200, Easing.Quadratic.In);   // the bars slide down
}
function takeEmber3() {
  const p = emberMeshes.e3; p.taken = true; p.g.visible = false; p.glow.visible = false;
  run.ember3 = true; run.hordeCharges++; run.fuel = MAX_FUEL; sound('ember'); rumble(300, 0.7);
  story('THE EMBER OF THE KEEP\n\nThe last Ember hums in your hand. 3/3.\n\nIn the middle of the hall, the old altar waits for all three.', 'ember', () => { banner('Relight the altar'); toast('+1 Horde charge'); });
}
function relightAltar() {                            // the flames light one by one, the camera rises, the doors grind open
  run.altarT = 1; run.altarLit = 0; hero.moving = false; play(hero.ch, 'idle');   // altarT > 0: Aldren can't move or be hurt
  for (let i = 1; i <= 3; i++) later(700 * i, () => {
    setAltar(run.altarLit = i); emit((i - 2) * 0.65, 1.6, KZ, 14, 0xffc060, { speed: 2, up: 3, life: 0.6 }); sfx('altarLight', 'ember', 'relight');
  });
  tw(cam, { pitch: 0.85 }, 2000, Easing.Sinusoidal.InOut);                               // the camera rises
  later(2500, openThrone);
  later(4200, () => { run.altarT = 0; });
}
function openThrone() {
  run.throneOpen = true; sfx('doorGrind', 'door'); shake = Math.max(shake, 0.3); rumble(400, 0.5);
  tw(K.door.position, { y: -2.8 }, 2400, Easing.Sinusoidal.InOut);     // the doors grind down into the floor
  banner('The throne doors grind open');
  run.checkpoint = { area: 'keep', x: -10.5, z: KZ, horde: run.hordeCharges, name: 'the Altar' };
  toast('Checkpoint: the altar.');
}
// --- the Hollow King's moves ---
const SLAM_R = 7;                                    // how far the King's shockwave reaches (m): the red ring shows exactly this
let wave = null;                                     // the slam's shockwave: { x, z, r, hit: Set of who it already hit }
function kingSlam(e) {
  sfx('kingSlam', 'clank'); shake = Math.max(shake, 0.5); rumble(250, 0.8);
  emit(e.x, 0.3, e.z, 24, 0xc0a080, { speed: 6, up: 1.5, life: 0.5, spread: 1.5 });
  wave = { x: e.x, z: e.z, r: 0.6, hit: new Set() };
  if (K.sw) K.sw.userData.fire(e.x, e.z, SLAM_R, 0.8); else K.wave.visible = true;
  const d = Math.hypot(hero.x - e.x, hero.z - e.z); if (d < 2.4) enemyHit(e, { kind: 'heavy', dmg: 2, parry: false }, hero);   // right under the slam hurts more
  if (!run.slamTip) { run.slamTip = true; toast('Roll through the wave or get clear of the red.'); }
}
function kingPhase(e, ph) {
  while (e.phase < ph) {
    e.phase++; sfx('kingRoar', 'roar'); shake = Math.max(shake, 0.4); rumble(300, 0.6); kingGlow(e);
    try { if (window.Music && typeof Music.setPhase === 'function') Music.setPhase(e.phase); } catch (err) {}
    cancelAtk(e); dropToken(e); e.combo = e.comboI = e.slams = 0;
    e.state = 'stagger'; e.t = 1.1; e.ch.warn = 0; kPlay(e, e.phase === 2 ? 'raise' : 'roar', 'idle', true);   // a roar / raise before he fights on
    if (e.phase === 2) {                             // phase 2: two skeleton knights rise from the floor
      banner('The King raises his dead');
      enemies.filter((m) => m.minion && m.dormant).slice(0, 2).forEach((m, i) => {
        const a = e.face + (i ? 1.2 : -1.2), p = pushOut({ x: e.x + Math.sin(a) * 3, z: e.z + Math.cos(a) * 3 }, 0.6);
        raiseMinion(m, p.x, p.z);
      });
    }
    if (e.phase === 3) {                             // phase 3: braziers out, cursed mist, torchlight only
      banner('The braziers die!'); toast('Only inside your torchlight can the King be hurt!');
      run.kingMist = true; ZONES[4].r = THR.hx + 4; K.throneMist.visible = true;
      if (K.throneFires) K.throneFires.visible = false;
      if (K.room) K.room.userData.snuff(true);
      try { if (window.Ambience && typeof Ambience.setBraziers === 'function') Ambience.setBraziers(false); } catch (err) {}
    }
  }
}
function kingDies(e) {
  run.kingDead = true; resetThrone(); floodT = 2;    // the light floods back
  shake = 1; rumble(700, 1); sfx('kingDeath', 'wardenDeath', 'death'); banner('The Hollow King falls');
  emit(e.x, 2, e.z, 50, 0xffd070, { speed: 7, up: 4, life: 0.8, spread: 1.5 });
  // his crown flies off, bounces and rolls away; he sinks as he collapses (tween.js)
  const cp = pushOut({ x: e.x + Math.sin(e.face + 2.2) * 4, z: e.z + Math.cos(e.face + 2.2) * 4 }, 0.3);
  Object.assign(K.crown.position, { x: e.x, y: 3, z: e.z }); K.crown.rotation.set(0, 0, 0); K.crown.visible = true;
  tw(K.crown.position, { x: cp.x, z: cp.z }, 1600, Easing.Quadratic.Out);
  tw(K.crown.position, { y: 0.2 }, 1400, Easing.Bounce.Out);
  tw(K.crown.rotation, { x: 1.4, y: 9 }, 1600, Easing.Quadratic.Out);
  e.sink = 0; tw(e, { sink: 0.3 }, 2000, Easing.Cubic.In);
  const rid = runId;
  setTimeout(() => {
    if (rid !== runId || state === 'lose') return;
    sound('dawn'); dismissAllies();
    story(resultsText(), 'results', () => setState('win'));
  }, 3200);
}
let floodT = 0;
function updateKeep(dt) {
  if (run.area !== 'keep') return;
  // altar beat: 3 flames, 0.7 s apart, then the doors
  // shockwave: a ring that grows; it hurts whoever it passes (once each)
  if (K.sw) K.sw.userData.update(dt);
  if (wave) {
    if (K.sw) wave.r = K.sw.userData.radius();       // Game Artist's ring grows to 7 m in 0.8 s
    else { wave.r = Math.min(SLAM_R, wave.r + SLAM_R / 0.8 * dt); K.wave.position.set(wave.x, 0.15, wave.z); K.wave.scale.setScalar(wave.r); K.wave.material.opacity = 0.85 * (1 - wave.r / (SLAM_R + 1)); }
    const inRing = (x, z) => Math.abs(Math.hypot(x - wave.x, z - wave.z) - wave.r) < 0.6;
    if (!wave.hit.has(hero) && inRing(hero.x, hero.z)) { wave.hit.add(hero); enemyHit(wave, { kind: 'heavy', dmg: 1, parry: false }, hero); }
    for (const a of allies) if (a.alive && !wave.hit.has(a) && inRing(a.x, a.z)) { wave.hit.add(a); hurtAlly(a, 1, wave.x, wave.z, 6); }
    for (const g of gobs) if (g.alive && inRing(g.x, g.z)) popGob(g);
    if (K.sw ? !K.sw.userData.active() : wave.r >= SLAM_R) { wave = null; K.wave.visible = false; }
  }
  const f = 0.8 + Math.sin(performance.now() / 90) * 0.2, t = performance.now() / 1000; K.hallFires.material.opacity = f;
  if (K.throneFires) K.throneFires.material.opacity = f;
  if (K.room) K.room.userData.update(t);
  if (K.hall && K.hall.userData.update) K.hall.userData.update(t);
  if (K.altar) K.altar.userData.update(t);
  // ONE point light does double duty: over the altar in the hall (warm gold once lit), over the braziers in the throne room
  const inT = inThrone(hero.x, hero.z), B = LT.keep ? LT.keep.brazier : null;
  gateLight.intensity = inT ? (run.kingMist ? 0 : 26 + floodT * 60) : run.throneOpen ? 30 : 16;
  gateLight.color.setHex(inT && B ? B.color : PAL.torch);
  if (inT) gateLight.position.set(THR.x + 4, 3.5, THR.z); else gateLight.position.set(0, 3.2, KZ);
  floodT = Math.max(0, floodT - dt);
}
// fade to black and back; fn runs while the screen is black
let fadeT = 0, fadeFn = null;
const tweens = new TweenGroup(); let tweenMs = 0;    // tween.js on GAME time, so pause and hit-stop freeze them too
const tw = (obj, to, ms, ease = Easing.Quadratic.InOut, delay = 0) => new Tween(obj, tweens).to(to, ms).easing(ease).delay(delay).start(tweenMs);
const later = (ms, fn) => tw({}, {}, 1, Easing.Linear.None, ms).onComplete(fn);   // do something after ms (game time)
function fade(fn) { fadeT = 1.2; fadeFn = fn; }

// Skeleton Warrior: slow, turns slowly (so you can get round to its side), shield up at the front
function warriorBrain(e, dt, T, d, toHero) {
  const same = Math.abs(groundH(e.x, e.z) - groundH(T.x, T.z)) < 1.5;   // don't chase you up or down the rampart wall
  if (!e.awake && d < 11 && T.ok && same) { e.awake = true; e.state = 'walk'; e.cd = 0.8; sound('clank'); }
  if (e.awake && (d > 20 || !T.ok)) { e.awake = false; e.state = 'idle'; cancelAtk(e); dropToken(e); }
  e.broken = (e.broken || 0) - dt; e.shieldDown = (e.shieldDown || 0) - dt;   // a Flare breaks the block for 3 s; after a combo the shield is down
  if (!e.awake) return goHome(e, dt);
  if (e.state === 'atk') {                           // combo: light, light, HEAVY (red ring: roll out of it)
    if (!updateAtk(e, dt, T, d, toHero) && e.state === 'walk') {
      if (++e.comboN < 3) windUp(e, e.comboN === 2 ? 'heavy' : 'light', e.comboN === 2 ? { wind: 0.6, rec: 1.0 } : { wind: 0.4, rec: 0.2 });
      else { e.comboN = 0; dropToken(e); e.cd = 1.5; e.shieldDown = 1.2; }
    }
  } else if (e.state === 'stagger') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) { e.state = 'walk'; e.cd = 0.5; } }
  else {
    e.state = 'walk'; e.blockT = (e.blockT || 0) - dt;
    const anim = e.blockT > 0 ? () => {} : (n) => play(e.ch, n);   // let the Block clip finish
    const mine = tokens.has(e) || (d < 5 && e.cd <= 0 && takeToken(e));
    if (!mine && d < 6) circle(e, dt, toHero, d, 3.6, e.speed * 0.6);   // no token: circle and wait your turn
    else {
      turnTo(e, toHero, dt, 3);
      if (d > 1.9) { moveEnemy(e, Math.sin(e.face) * e.speed, Math.cos(e.face) * e.speed, dt); anim('walk'); }
      else { moveEnemy(e, 0, 0, dt); anim(e.ch.acts.blocking && e.broken <= 0 && e.shieldDown <= 0 ? 'blocking' : 'idle'); }   // shield-up guard stance
      if (mine && d < 2.6) { e.comboN = 0; windUp(e, 'light', { wind: 0.45, rec: 0.2 }); }
    }
  }
}
// Raise a hidden pool Minion out of the floor (the King in phase 2, and the wizards)
function raiseMinion(m, x, z) {
  Object.assign(m, { x, z, hp: m.max, alive: true, removed: false, dormant: false, awake: true, state: 'rise', cd: 1, t: 1.4, broken: 0, dieT: 0, thud: false, face: Math.atan2(hero.x - x, hero.z - z) });
  const clip = ['rise', 'awaken', 'resurrect'].find((n) => m.ch.acts[n]);   // KayKit: climb out of the ground
  m.sink = clip ? 0 : 1.6;                          // the clip climbs up by itself; without one we lift him out of the floor
  m.ch.g.rotation.x = 0; setOpacity(m.ch, 1); play(m.ch, clip || 'idle', true); sfx('skelRise', 'skeletonDeath');
  emit(x, groundH(x, z) + 0.5, z, 24, 0x9a5aff, { speed: 2, up: 3, grav: 2, life: 0.8, spread: 1 });
}
// How many characters are out right now (Aldren + Oathbound + living enemies nearby). Never more than MAX_CHARS.
const charCount = () => 1 + alliesOn() + enemies.filter((e) => e.alive && !e.dormant && !e.removed && Math.hypot(e.x - hero.x, e.z - hero.z) < 30).length;
const poolMinion = () => enemies.find((m) => m.minion && m.dormant);
// Dark wizard: like the Mage (keeps 6-11 m away, slow bolt), but backs off / side-steps, and every 12 s raises a Minion
function wizardBrain(e, dt, T, d, toHero) {
  if (!e.awake && d < 15 && T.ok) { e.awake = true; e.state = 'walk'; e.cd = 1.5; e.raiseCd = 4; }
  if (e.awake && (d > 24 || !T.ok)) { e.awake = false; e.state = 'idle'; e.ch.warn = 0; dropToken(e); }
  if (!e.awake) return goHome(e, dt);
  e.raiseCd = (e.raiseCd || 0) - dt; e.dodgeCd = (e.dodgeCd || 0) - dt;
  if (e.state !== 'dodge') turnTo(e, toHero, dt, 5);
  if (e.state === 'cast') {                          // channel (cast loop), then the bolt (attack clip)
    moveEnemy(e, 0, 0, dt);
    if (e.t <= 0) { e.ch.warn = 0; fireBolt(e, T); play(e.ch, 'attack', true); e.state = 'shoot'; e.t = 0.5; dropToken(e); e.cd = 3.2 + rnd(); }
  } else if (e.state === 'shoot') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) e.state = 'walk'; }
  else if (e.state === 'raise') {                    // staff up (raise clip), then a Minion climbs out of the floor
    moveEnemy(e, 0, 0, dt);
    if (e.t <= 0) {
      const m = poolMinion();
      e.ch.warn = 0;
      if (m && charCount() < MAX_CHARS) { const p = pushOut({ x: e.x + Math.sin(e.face) * 2, z: e.z + Math.cos(e.face) * 2 }, 0.6); raiseMinion(m, p.x, p.z); }
      e.state = 'walk'; e.cd = Math.max(e.cd, 1.2);
    }
  } else if (e.state === 'dodge') { moveEnemy(e, e.dvx, e.dvz, dt); if (e.t <= 0) e.state = 'walk'; }
  else if (e.state === 'stagger') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) e.state = 'walk'; }
  else {
    e.state = 'walk';
    if (d < 3.5 && e.dodgeCd <= 0) {                 // too close: a quick side-step
      const sd = rnd() < 0.5 ? -1 : 1; e.dvx = Math.cos(toHero) * sd * 5; e.dvz = -Math.sin(toHero) * sd * 5;
      e.state = 'dodge'; e.t = 0.45; e.dodgeCd = 3; play(e.ch, e.ch.acts[sd < 0 ? 'dodgeL' : 'dodgeR'] ? (sd < 0 ? 'dodgeL' : 'dodgeR') : 'dodge', true, 1.2); return;
    }
    const v = d < 6 ? -e.speed : d > 11 ? e.speed : 0;
    moveEnemy(e, Math.sin(toHero) * v, Math.cos(toHero) * v, dt); play(e.ch, v < 0 && e.ch.acts.back ? 'back' : v ? 'walk' : 'idle');
    if (e.raiseCd <= 0 && poolMinion() && charCount() < MAX_CHARS) { e.state = 'raise'; e.t = 1.1; e.raiseCd = 12; e.ch.warn = 1; play(e.ch, 'raise', true); }
    else if (e.cd <= 0 && d < 15 && takeToken(e)) { e.state = 'cast'; e.t = 0.5; telegraph(e, 0.5); e.ch.warn = 1; play(e.ch, e.ch.acts.cast ? 'cast' : 'attack', !e.ch.acts.cast, 0.8); }
  }
}
// Walk home and stand there (any sleeping skeleton)
function goHome(e, dt) {
  const hx = e.hx - e.x, hz = e.hz - e.z, hd = Math.hypot(hx, hz);
  if (hd > 1) { moveEnemy(e, hx / hd * 1.5, hz / hd * 1.5, dt); turnTo(e, Math.atan2(hx, hz), dt, 3); play(e.ch, 'walk'); }
  else { moveEnemy(e, 0, 0, dt); play(e.ch, 'idle'); }
}
// Skeleton Minion: fast and weak, a quick claw with a short red wind-up
function minionBrain(e, dt, T, d, toHero) {
  if (e.state === 'rise') {                          // clawing up out of the floor (the King's phase 2)
    e.sink = Math.max(0, (e.sink || 0) - dt * 1.3); moveEnemy(e, 0, 0, dt);
    if (e.t <= 0) { e.state = 'walk'; e.sink = 0; }
    return;
  }
  const same = Math.abs(groundH(e.x, e.z) - groundH(T.x, T.z)) < 1.5;
  if (!e.awake && d < 12 && T.ok && same) { e.awake = true; e.state = 'walk'; e.cd = 0.5; }
  if (e.awake && (d > 22 || !T.ok)) { e.awake = false; e.state = 'idle'; cancelAtk(e); dropToken(e); }
  if (!e.awake) return goHome(e, dt);
  if (e.state === 'atk') { if (!updateAtk(e, dt, T, d, toHero) && e.state === 'walk') { dropToken(e); e.cd = 1.1; } }
  else if (e.state === 'stagger') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) e.state = 'walk'; }
  else {
    e.state = 'walk';
    const mine = tokens.has(e) || (d < 5 && e.cd <= 0 && takeToken(e));
    if (!mine && d < 5) return circle(e, dt, toHero, d, 3, e.speed * 0.5);   // no token: circle and close in
    turnTo(e, toHero, dt, 8);
    if (d > 1.3) { moveEnemy(e, Math.sin(e.face) * e.speed, Math.cos(e.face) * e.speed, dt); play(e.ch, 'run', false, 1.2); }
    else { moveEnemy(e, 0, 0, dt); play(e.ch, 'idle'); }
    if (mine && d < 1.8) windUp(e, 'light', { wind: 0.45, rec: 0.35, range: 1.7 });
  }
}
// Skeleton Mage: keeps 6-11 m away and casts a slow purple bolt you can step out of the way of
function mageBrain(e, dt, T, d, toHero) {
  if (!e.awake && d < 15 && T.ok) { e.awake = true; e.state = 'walk'; e.cd = 1.5; }
  if (e.awake && (d > 24 || !T.ok)) { e.awake = false; e.state = 'idle'; e.ch.warn = 0; dropToken(e); }
  if (!e.awake) return goHome(e, dt);
  turnTo(e, toHero, dt, 5);
  if (e.state === 'cast') {                          // 0.7 s glowing wind-up, then the bolt flies
    moveEnemy(e, 0, 0, dt);
    if (e.t <= 0) { e.ch.warn = 0; fireBolt(e, T); play(e.ch, 'attack', true); e.state = 'shoot'; e.t = 0.5; dropToken(e); e.cd = 3 + rnd(); }
  } else if (e.state === 'shoot') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) e.state = 'walk';
  } else if (e.state === 'stagger') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) e.state = 'walk'; }
  else {
    e.state = 'walk';
    const v = d < 6 ? -e.speed : d > 11 ? e.speed : 0;   // back off if you get close, come closer if you're far
    moveEnemy(e, Math.sin(toHero) * v, Math.cos(toHero) * v, dt); play(e.ch, v ? 'walk' : 'idle');
    if (e.cd <= 0 && d < 15 && takeToken(e)) { e.state = 'cast'; e.t = 0.5; telegraph(e, 0.5); e.ch.warn = 1; play(e.ch, e.ch.acts.cast ? 'cast' : 'attack', !e.ch.acts.cast, 0.8); }   // cast = the channel loop
  }
}
// Mage bolts: a small pool drawn as ONE Points object (1 draw call)
const BOLT_N = 8, boltPos = new Float32Array(BOLT_N * 3).fill(-999), bolts = Array.from({ length: BOLT_N }, () => ({ on: false }));
const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3).setUsage(THREE.DynamicDrawUsage));
const boltPts = new THREE.Points(boltGeo, new THREE.PointsMaterial({ map: TX.pxEmber, size: 0.9, color: 0xb070ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
boltPts.frustumCulled = false; boltPts.visible = false; scene.add(boltPts);
function fireBolt(e, T) {
  const b = bolts.find((x) => !x.on); if (!b) return;
  const dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz) || 1, y0 = groundH(e.x, e.z) + 1.4;
  Object.assign(b, { on: true, x: e.x + dx / d * 0.6, z: e.z + dz / d * 0.6, y: y0, vx: dx / d * 6, vz: dz / d * 6, life: 3.5 });
  sfx('mageCast', 'shadeDissolve', 'blip');
}
function updateBolts(dt) {
  let any = false;
  for (let i = 0; i < BOLT_N; i++) {
    const b = bolts[i];
    if (!b.on) { boltPos[i * 3 + 1] = -999; continue; }
    b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    b.y += (groundH(b.x, b.z) + 1.1 - b.y) * Math.min(1, dt * 2);   // drift down to chest height
    let hit = null;
    if (!hero.dying && Math.hypot(b.x - hero.x, b.z - hero.z) < 0.6) hit = hero;
    for (const a of allies) if (!hit && a.alive && Math.hypot(b.x - a.x, b.z - a.z) < 0.6) hit = a;
    if (hit) {
      if (hit === hero) enemyHit({ x: b.x - b.vx, z: b.z - b.vz }, { kind: 'light', dmg: 1, parry: true }, hero);   // a bolt can be parried too
      else hurtAlly(hit, 1, b.x - b.vx, b.z - b.vz, 4);
      sfx('mageBoltHit', 'hit');
    }
    if (hit || b.life <= 0 || !isFree(b.x, b.z, 0.1)) { b.on = false; emit(b.x, b.y, b.z, 10, 0xb070ff, { speed: 3, life: 0.3 }); boltPos[i * 3 + 1] = -999; continue; }
    boltPos[i * 3] = b.x; boltPos[i * 3 + 1] = b.y + Math.sin(b.life * 20) * 0.05; boltPos[i * 3 + 2] = b.z; any = true;
  }
  boltPts.visible = any; if (any) boltGeo.attributes.position.needsUpdate = true;
}
function clearBolts() { for (const b of bolts) b.on = false; boltPts.visible = false; }


// ============================================================
// PART 3: COMBAT (telegraphs, attack tokens, poise, stamina, roll, parry, lock-on)
// Rule from the player: mashing attack should get you killed. You win by reading wind-ups, rolling and parrying.
// ============================================================
const MAX_TOKENS = 2;                                // at most 2 enemies attack at once; the rest circle
const POISE = { minion: 1, mage: 2, wizard: 2, warrior: 4, king: 10, warden: 6, wolf: 1, shade: 1 };
const SHARDS = { minion: 1, mage: 2, wizard: 3, warrior: 3, wolf: 1, shade: 1, warden: 10, king: 20 };
const STA_MAX = 100, STA_ATK = 10, STA_ROLL = 25, STA_BLOCK = 20;
const parryWin = () => (inputMode === 'touch' ? 0.25 : 0.18);   // seconds before the hit lands (touch is a bit kinder)
const tokens = new Set();                            // enemies that hold an attack token right now
function takeToken(e) { if (tokens.has(e)) return true; if (tokens.size >= MAX_TOKENS) return false; tokens.add(e); e.tokT = 0; return true; }
function dropToken(e) { tokens.delete(e); }
function stealToken(e) {                             // the King: kick out a holder that is only walking up (not mid-swing)
  if (takeToken(e)) return true;
  for (const o of tokens) if (!o.atk && o.state !== 'cast') { tokens.delete(o); return takeToken(e); }
  return false;
}
// --- telegraph looks: Game Artist's red glint + danger ring (stand-ins if realm-art.js lacks them) ---
function mkGlint() {
  if (artFn('glint')) return ART.glint(THREE, 0.6);
  const s = glowSprite(TX.pxEmber, 0.6, 0xff2020); s.visible = false; let t = 0, dur = 0.4;   // stand-in: a red sprite
  s.userData.flash = (sec) => { dur = sec; t = 0; s.visible = true; };
  s.userData.update = (dt) => { if (!s.visible) return; t += dt; s.material.opacity = Math.sin(Math.min(1, t / dur) * Math.PI); if (t >= dur) s.visible = false; };
  return s;
}
function mkRing() {
  if (artFn('dangerRing')) return ART.dangerRing(THREE, 2);
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false }));
  m.visible = false; let t = 0, dur = 1;                                                     // stand-in: a red ring
  Object.assign(m.userData, { show: (x, z, sec, r = 2) => { m.position.set(x, 0.08, z); m.scale.set(r, 1, r); t = 0; dur = sec; m.visible = true; },
    hide: () => { m.visible = false; }, progress: () => Math.min(1, t / dur), update: (dt) => { if (m.visible && (t += dt) > dur + 0.15) m.visible = false; } });
  return m;
}
function mkBar(kind, parent) {                       // Game Artist's HUD bar, or a plain div with the same API
  if (artFn('bar')) return ART.bar(kind, parent);
  const el = document.createElement('div'), i = document.createElement('i');
  el.style.cssText = kind === 'poise' ? 'position:absolute;width:44px;height:6px;margin:-3px 0 0 -22px;background:#111;pointer-events:none' : 'position:absolute;width:120px;height:8px;background:#111';
  i.style.cssText = `display:block;height:100%;transform-origin:left;background:${kind === 'poise' ? '#ddd' : '#e0a030'}`; el.appendChild(i); parent.appendChild(el);
  return { el, set: (v) => { i.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`; }, winded: (on) => { el.style.outline = on ? '2px solid #f33' : ''; },
    flashBreak: () => {}, place: (x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; }, remove: () => el.remove() };
}
const glints = [], rings = [mkRing(), mkRing(), mkRing()];
rings.forEach((r) => scene.add(r));
function glintOf(e) {                                // one glint per enemy, made the first time it attacks
  if (!e.glint) {
    e.glint = mkGlint(); scene.add(e.glint); glints.push(e);
    e.ch.obj.traverse((o) => { if (!e.tip && o.isBone && /hand.?slot.?r|hand.?r\b|righthand|hand_r|weapon/i.test(o.name)) e.tip = o; });   // the weapon hand
  }
  return e.glint;
}
function telegraph(e, sec, ring) {                   // red glint on the weapon (+ a red ground ring for heavies)
  if (tokens.has(e) || isBoss(e)) glintOf(e).userData.flash(sec);   // only token holders (max 2) glint: keeps draw calls down
  if (ring) { const r = rings.find((x) => !x.visible) || rings[0]; r.userData.show(ring.x, ring.z, sec, ring.r); e.ring = r; }
  if (window.SFX && SFX.names && SFX.names.includes('telegraph')) sound('telegraph');   // Audio Designer's hiss, if it's there
}
const _gp = new THREE.Vector3();
function updateTelegraphs(dt) {
  for (const e of glints) {
    const g = e.glint; if (!g.visible) continue;
    if (!e.alive || (!tokens.has(e) && !isBoss(e))) { g.visible = false; continue; }
    if (e.tip) e.tip.getWorldPosition(_gp); else _gp.set(e.x + Math.sin(e.face) * 0.5, groundH(e.x, e.z) + (e.type === 'king' ? 2.6 : 1.5), e.z + Math.cos(e.face) * 0.5);
    g.position.copy(_gp); g.userData.update(dt);
  }
  for (const r of rings) r.userData.update(dt);
}
// --- enemy attacks: wind-up -> hit -> recovery. kind 'light' = parryable, 1 heart; 'heavy' = red ring, roll only, 2 hearts ---
function windUp(e, kind, o = {}) {
  const heavy = kind === 'heavy';
  const a = e.atk = { kind, dmg: o.dmg || (heavy ? 2 : 1), wind: o.wind || (heavy ? 0.6 : 0.45), range: o.range || 2.5, rec: o.rec || 0.45,
    parry: o.parry != null ? o.parry : !heavy, slam: !!o.slam, hit: false, ring: null };
  a.t = a.wind; e.state = 'atk'; e.ch.warn = 1;
  if (heavy) {                                        // the ring is committed where the blow will land: step out of it
    const f = o.slam ? 0 : 1.3; a.ring = { x: e.x + Math.sin(e.face) * f, z: e.z + Math.cos(e.face) * f, r: o.r || 1.9 };
  }
  play(e.ch, o.clip && e.ch.acts[o.clip] ? o.clip : 'attack', true, o.speed || (heavy ? 0.9 : 1.2));
  telegraph(e, a.wind, a.ring);
}
// returns true while the attack is still going
function updateAtk(e, dt, T, d, toHero) {
  const a = e.atk; if (!a) return false;
  a.t -= dt; moveEnemy(e, 0, 0, dt);
  if (!a.hit) {
    if (a.t > a.wind * 0.35 && !a.ring) turnTo(e, toHero, dt, 6);   // tracks you early in the wind-up, then commits
    if (a.t <= 0) {
      a.hit = true; e.ch.warn = 0; a.t = a.rec; sound('swing');
      if (a.slam) kingSlam(e);                         // the King: slam + shockwave (roll through it)
      else if (a.ring) { if (Math.hypot(T.x - a.ring.x, T.z - a.ring.z) < a.ring.r + 0.35) enemyHit(e, a, T); }
      else if (d < a.range + 0.3 && Math.abs(angDiff(toHero, e.face)) < 1.1) enemyHit(e, a, T);
    }
    return true;
  }
  if (a.t <= 0) { e.atk = null; e.state = 'walk'; return false; }
  return true;
}
function cancelAtk(e) { if (e.atk && e.atk.ring && e.ring) e.ring.userData.hide(); e.atk = null; if (e.glint) e.glint.visible = false; e.ch.warn = 0; }
// An enemy blow reaches Aldren (or an Oathbound): roll, parry, block or take it
function enemyHit(e, a, T) {
  if (T && T.ally) return hurtAlly(T.ally, a.dmg, e ? e.x : T.x, e ? e.z : T.z, a.kind === 'heavy' ? 9 : 6);
  if (!canAct() || hero.dying) return false;
  if (run.rollT > 0) { run.counterT = 0.7; return false; }   // rolled through it: a counter-attack now breaks poise
  const since = run.time - run.blockAt;
  if (a.parry && since >= 0 && since <= parryWin()) return parry(e);
  if (since >= 0 && since <= 0.6) {                  // blocking (but not a parry)
    if (a.kind === 'heavy' || a.dmg >= 2 || run.sta < STA_BLOCK || run.windedT > 0) return guardBreak(e, a);   // heavies, 2-heart finishers and an empty stamina bar smash through
    spendSta(STA_BLOCK); sfx('shieldBlock', 'clank'); emit(hero.x, hero.y + 1.2, hero.z, 6, 0x9cc0ff, { speed: 3, life: 0.2 });
    return false;                                    // late block: no damage, costs stamina
  }
  return hurtHero(a.dmg, e ? e.x : hero.x, e ? e.z : hero.z, a.kind === 'heavy' ? 10 : 6);
}
function guardBreak(e, a) {                          // mashing block fails: you take the full hit AND get winded
  run.blockAt = -9; run.guardT = 1; run.guardBreaks = (run.guardBreaks || 0) + 1;
  const hurt = hurtHero(a.dmg, e ? e.x : hero.x, e ? e.z : hero.z, a.kind === 'heavy' ? 10 : 6);   // full damage (winded doubling comes after)
  run.sta = 0; run.staT = 0; run.windedT = 0.8; run.winds = (run.winds || 0) + 1;
  sfx('staminaOut'); if (staBar) staBar.winded(true); toast('Guard broken!'); shake = Math.max(shake, 0.25);
  emit(hero.x, hero.y + 1.2, hero.z, 14, 0xff6040, { speed: 4, life: 0.3 });
  return hurt;
}
function parry(e) {
  run.crit = true; run.blockAt = -9; run.parries = (run.parries || 0) + 1; slowT = 0.35; hitStop = 0.06;
  sfx('parry', 'clank'); rumble(140, 0.9); flashChar(hero.ch, 0xffffff, 0.15);
  emit(hero.x + Math.sin(hero.face) * 0.7, hero.y + 1.3, hero.z + Math.cos(hero.face) * 0.7, 26, 0xfff2b0, { speed: 6, up: 2, life: 0.35 });
  if (e && e.alive) breakPoise(e, 1.2);
  return false;
}
// Poise: hits don't interrupt an enemy until its poise breaks; then it staggers (and parries / roll-counters break it at once)
function breakPoise(e, t = 1) {
  e.poiseV = 0; e.poiseT = t + 0.4; dropToken(e); cancelAtk(e); e.comboN = 0;
  if (e.type === 'wolf') { e.state = 'recover'; e.t = t; } else if (e.type === 'shade') { e.state = 'drift'; e.t = t; }
  else { e.state = 'stagger'; e.t = t; if (e.type === 'warrior') e.shieldDown = t + 0.3; }
  play(e.ch, 'hit', true, 0.7); flashChar(e.ch, 0xffe080, 0.2);
  if (e.bar) e.bar.flashBreak();
  if (window.SFX && SFX.names && SFX.names.includes('poiseBreak')) sound('poiseBreak');
}
function updatePoise(e, dt) {                        // refills 2.5 s after the last hit (or after a stagger)
  if (e.poiseV == null) e.poiseV = POISE[e.type] || 2;
  e.poiseT = (e.poiseT || 0) - dt;
  if (e.poiseT <= 0 && e.poiseV < (POISE[e.type] || 2)) e.poiseV = POISE[e.type] || 2;
}
// Circle Aldren at radius R while waiting for a token (strafe + ease in/out), facing him
function circle(e, dt, toHero, d, R, spd) {
  e.flipT = (e.flipT || 0) - dt;
  if (e.flipT <= 0) { e.flipT = 1.5 + rnd() * 2; if (!e.circleDir || rnd() < 0.35) e.circleDir = rnd() < 0.5 ? -1 : 1; }
  const tx = Math.cos(toHero) * e.circleDir, tz = -Math.sin(toHero) * e.circleDir, pull = Math.max(-1, Math.min(1, (d - R) * 0.8));
  const vx = (tx * 0.8 + Math.sin(toHero) * pull) * spd, vz = (tz * 0.8 + Math.cos(toHero) * pull) * spd;
  moveEnemy(e, vx, vz, dt); turnTo(e, toHero, dt, 6); play(e.ch, pull < -0.3 && e.ch.acts.back ? 'back' : 'walk');
}
// --- Aldren: stamina, roll, block/parry ---
function spendSta(n) {
  run.sta = Math.max(0, run.sta - n); run.staT = 0;
  if (run.sta <= 0 && run.windedT <= 0) { run.windedT = 0.8; run.winds = (run.winds || 0) + 1; sfx('staminaOut'); if (staBar) staBar.winded(true); toast('Winded! You take double damage.'); }
}
function updateStamina(dt) {
  run.staT += dt; run.counterT = Math.max(0, run.counterT - dt); run.guardT = Math.max(0, (run.guardT || 0) - dt);
  if (run.windedT > 0 && (run.windedT -= dt) <= 0) run.windedT = 0;
  if (staBar && staBar.on !== run.windedT > 0) { staBar.on = run.windedT > 0; staBar.winded(staBar.on); }   // the bar's winded look follows the state
  if (run.staT > 0.8 && run.windedT <= 0) run.sta = Math.min(STA_MAX, run.sta + 60 * dt);   // refills after 0.8 s without spending
}
function roll() {
  if (run.introT > 0) return skipKingIntro();
  if (!canAct() || run.rollT > 0 || run.windedT > 0) return;
  if (run.sta < STA_ROLL) { sfx('staminaOut'); return; }
  spendSta(STA_ROLL);
  let [mx, my] = moveInput(); const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let wx = rx * mx + fx * my, wz = rz * mx + fz * my;
  if (Math.hypot(wx, wz) < 0.2) { wx = -Math.sin(hero.face); wz = -Math.cos(hero.face); }      // no stick: a back-step roll
  const l = Math.hypot(wx, wz); hero.rvx = wx / l * 8.6; hero.rvz = wz / l * 8.6;              // about 3 m in 0.35 s
  hero.face = Math.atan2(wx, wz); run.rollT = 0.35; run.rolls = (run.rolls || 0) + 1; atkAnim = 0;
  play(hero.ch, hero.ch.acts.roll ? 'roll' : 'run', true, hero.ch.acts.roll ? 1.6 : 2);
  sfx('roll', 'whoosh'); rumble(40, 0.25);
}
const rollInv = () => run.rollT > 0.05;              // invulnerable for the first ~0.3 s of the roll
function ward() {                                    // BLOCK / PARRY: press just before a hit lands
  if (run.introT > 0) return skipKingIntro();
  if (!canAct() || run.windedT > 0) return;
  const mashed = run.time - run.lastBlock < 0.45;    // mashing block doesn't open a new parry window
  run.lastBlock = run.time; if (!mashed) run.blockAt = run.time;
  flashChar(hero.ch, 0x80b0ff, 0.12); emit(hero.x + Math.sin(hero.face) * 0.5, hero.y + 1.2, hero.z + Math.cos(hero.face) * 0.5, 4, 0x9cc0ff, { speed: 2, life: 0.2 });
}
// --- lock-on: nearest enemy in front, the camera keeps both framed; right stick / swipe switches ---
let lockT = null, lockAcc = 0;
const lockMark = glowSprite(TX.pxEmber, 0.45, 0xffe070); lockMark.visible = false; lockMark.renderOrder = 21; lockMark.material.depthTest = false; scene.add(lockMark);
const lockable = (e) => e.alive && !e.dormant && !e.removed && e.ch.g.visible && Math.hypot(e.x - hero.x, e.z - hero.z) < 15;
function pickTarget() {
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); let best = null, bs = 1e9;
  for (const e of enemies) if (lockable(e)) {
    const dx = e.x - hero.x, dz = e.z - hero.z, d = Math.hypot(dx, dz) || 1, a = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
    if (a < 1.3 && d + a * 6 < bs) { bs = d + a * 6; best = e; }
  }
  return best;
}
function toggleLock() {
  if (run.introT > 0) return skipKingIntro();
  if (lockT) { lockT = null; return; }
  lockT = pickTarget(); if (lockT) sfx('lockOn', 'blip'); else toast('Nothing to lock on to.');
}
function switchTarget(sign) {                        // the next enemy to the left (-1) or right (+1) of the current one
  if (!lockT) return;
  const base = Math.atan2(lockT.x - hero.x, lockT.z - hero.z); let best = null, bd = 9;
  for (const e of enemies) if (e !== lockT && lockable(e)) { const a = angDiff(base, Math.atan2(e.x - hero.x, e.z - hero.z)) * sign; if (a > 0.05 && a < bd) { bd = a; best = e; } }
  if (best) { lockT = best; sfx('lockOn', 'blip'); }
}
function updateLock(dt) {
  if (lockT && !lockable(lockT)) lockT = null;       // died, sank back, or ran beyond 15 m
  lockMark.visible = !!lockT;
  if (!lockT) return;
  const want = Math.atan2(hero.x - lockT.x, hero.z - lockT.z);   // camera behind Aldren, looking at the target
  cam.yaw += angDiff(want, cam.yaw) * Math.min(1, dt * 6);
  lockMark.position.set(lockT.x, groundH(lockT.x, lockT.z) + (lockT.type === 'king' ? 3.8 : lockT.type === 'warden' ? 3.3 : 2.3), lockT.z);
}
// --- HUD: stamina under the hearts, a small poise bar over each enemy in the fight ---
let staBar = null;
const _pp = new THREE.Vector3();
function updateCombatHUD() {
  if (!staBar) { staBar = mkBar('stamina', $('stats')); Object.assign(staBar.el.style, { position: 'relative', left: '0', top: '0', margin: '4px 0 2px' }); }
  staBar.set(run.sta / STA_MAX);
  const W = gameEl.clientWidth, H = gameEl.clientHeight;
  for (const e of enemies) {
    const show = state === 'play' && e.alive && e.awake && !e.removed && e.ch.g.visible && e.type !== 'shade' && Math.hypot(e.x - hero.x, e.z - hero.z) < 15;
    if (!show) { if (e.bar) e.bar.el.style.display = 'none'; continue; }
    if (!e.bar) e.bar = mkBar('poise', gameEl);
    _pp.set(e.x, groundH(e.x, e.z) + (e.type === 'king' ? 3.6 : e.type === 'warden' ? 3.1 : 2.15), e.z).project(camera);
    if (_pp.z > 1) { e.bar.el.style.display = 'none'; continue; }
    e.bar.el.style.display = ''; e.bar.place((_pp.x + 1) / 2 * W, (1 - _pp.y) / 2 * H); e.bar.set(e.poiseV / (POISE[e.type] || 2));
  }
}
function updateCombat(dt) {
  for (const e of tokens) if (!e.alive || e.removed || e.dormant || !e.awake || (!e.atk && (e.tokT = (e.tokT || 0) + dt) > 2.5)) { tokens.delete(e); if (!e.awake) cancelAtk(e); }   // dead, asleep, or held too long without swinging
  for (const e of enemies) if (e.alive) updatePoise(e, dt);
  // crowd budget: with 4+ enemies awake nearby, only the (max 2) attackers and bosses cast moon shadows (saves draw calls)
  const crowd = enemies.filter((e) => e.alive && e.awake && !e.dormant && Math.hypot(e.x - hero.x, e.z - hero.z) < 14).length >= 4;
  for (const e of enemies) {
    const on = !crowd || tokens.has(e) || isBoss(e);
    if (e.shadowOn !== on && e.ch.casters) { e.shadowOn = on; for (const m of e.ch.casters) m.castShadow = on; }
  }
  updateStamina(dt); updateLock(dt); updateTelegraphs(dt);
  if (run.introT > 0 && (run.introT -= dt) <= 0) endKingIntro();
}
// --- The Hollow King's name card (the camera sweep is CUT: name card + bar only). First time only; any button skips. ---
function kingIntroStart(e) {
  run.introT = 2.9; run.introSeen = true; e.state = 'intro'; e.t = 2.9; sfx('kingIntro', 'kingRoar', 'roar');
  $('kingCard').className = ''; later(2200, () => { if (run.introT > 0) $('kingCard').className = 'on'; });   // lands with the sound's hit at ~2.3 s
}
function skipKingIntro() { run.introT = 0.001; }
function endKingIntro() {
  run.introT = 0; const k = enemies.find((x) => x.type === 'king');
  if (k && k.state === 'intro') { k.state = 'walk'; k.cd = 0.8; }
  $('kingCard').className = 'on'; later(1400, () => { $('kingCard').className = ''; });
}
function resetCombat() {                            // new game / retry: nobody holds a token, no rings, no lock
  tokens.clear(); lockT = null; rings.forEach((r) => r.userData.hide());
  for (const e of enemies) { cancelAtk(e); if (e.bar) { e.bar.remove(); e.bar = null; } }
  if (staBar) staBar.winded(false); $('kingCard').className = '';
}
// Forced attack for Playtester: G.forceAttack(enemy, 'light' | 'heavy')
function forceAttack(e, kind = 'light') {
  if (!e || !e.alive) return false;
  tokens.add(e); e.awake = true; e.face = Math.atan2(hero.x - e.x, hero.z - e.z);
  if (e.type === 'king' && kind === 'heavy') windUp(e, 'heavy', { slam: true, wind: 0.5, r: SLAM_R, clip: 'slam' });
  else windUp(e, kind);
  return true;
}

// The Hollow King: sword combos with a clear wind-up, a ground slam with a shockwave, 3 phases
function kingSwing(e) {                              // one sword swing; the last one of a combo is the 2-heart finisher
  const last = e.comboI === e.combo - 1; e.comboI++;
  windUp(e, 'light', { dmg: last ? 2 : 1, wind: last ? 0.55 : e.phase === 1 ? 0.45 : 0.4, rec: last ? 0.6 : 0.15, range: 3.4, clip: 'combo', speed: 1.1 });
}
function kingSlamUp(e) { e.slams--; e.slamCd = 6; windUp(e, 'heavy', { slam: true, wind: 0.5, r: SLAM_R, clip: 'slam', rec: 0.6 }); }
function kingBrain(e, dt, T, d, toHero) {
  const heroIn = inThrone(hero.x, hero.z) && T.ok;
  if (!e.awake && heroIn) {
    e.awake = true; e.state = 'walk'; e.cd = 1.2; e.slamCd = 4; e.combo = e.comboI = e.slams = 0; kPlay(e, 'roar', 'idle', true);
    if (!run.introSeen) kingIntroStart(e); else { sfx('kingRoar', 'roar'); banner('The Hollow King'); }
    try { if (window.Music && typeof Music.setPhase === 'function') Music.setPhase(1); } catch (err) {}
  }
  if (!e.awake) { play(e.ch, 'idle'); return; }
  if (e.state === 'intro') { moveEnemy(e, 0, 0, dt); turnTo(e, toHero, dt, 2); return; }   // name card: he waits
  kingPhase(e, e.hp / e.max > 0.66 ? 1 : e.hp / e.max > 0.33 ? 2 : 3);
  e.slamCd -= dt; e.stepT -= dt;
  if (e.state === 'atk') {
    if (!updateAtk(e, dt, T, d, toHero) && e.state === 'walk') {
      if (e.comboI < e.combo) kingSwing(e);
      else if (e.slams > 0) kingSlamUp(e);             // phase 3: a second slam right after the first
      else { e.combo = e.comboI = 0; dropToken(e); e.cd = e.phase === 1 ? 1.2 : 0.9; }
    }
  } else if (e.state === 'slam' || e.state === 'stagger') { moveEnemy(e, 0, 0, dt); if (e.t <= 0) { e.state = 'walk'; e.cd = 0.6; } }
  else {
    e.state = 'walk'; turnTo(e, toHero, dt, 3.5);
    if (d > 2.8) { moveEnemy(e, Math.sin(e.face) * e.speed, Math.cos(e.face) * e.speed, dt); play(e.ch, 'walk'); if (e.stepT <= 0) { sound('clank'); e.stepT = 0.6; } }
    else { moveEnemy(e, 0, 0, dt); play(e.ch, 'idle'); }
    if (d < 3.4 && e.cd <= 0 && stealToken(e)) { e.combo = e.phase === 1 ? 3 : 4; e.comboI = 0; e.slams = 0; kingSwing(e); }
    else if (d > 4 && d < 10 && e.slamCd <= 0 && stealToken(e)) { e.combo = e.comboI = 0; e.slams = e.phase === 3 ? 2 : 1; kingSlamUp(e); }
  }
}

// ---- Checkpoints (shrine, keep gate, altar) and the results card ----
function retryCheckpoint() {
  if (!run.checkpoint || performance.now() - endedAt < 800) return false;
  const c = run.checkpoint;
  applyArea(c.area || 'realm'); resetThrone(); clearBolts(); fadeT = 0;
  try { if (window.Music && typeof Music.setPhase === 'function') Music.setPhase(1); } catch (err) {}
  Object.assign(run, { hp: run.maxHp, fuel: MAX_FUEL, inv: 1.5, darkT: 0, wardT: 0, atkCd: 0, flareCd: 0, wardCd: 0, summonCd: 0, hordeCd: 0,
    sta: STA_MAX, staT: 0, windedT: 0, rollT: 0, crit: false, counterT: 0, introT: 0 });
  resetCombat();
  run.hordeCharges = Math.max(run.hordeCharges, c.horde || 0);   // the shrine gives back its horn charge
  hero.x = c.x; hero.z = c.z; hero.face = Math.PI; hero.kx = hero.kz = 0; hero.dying = 0;
  hero.ch.g.visible = true; play(hero.ch, 'idle', true); play(hero.ch, 'idle');
  cam.yaw = 0; cam.pitch = 0.12;
  for (const e of enemies) {                         // the dead stay dead (the camp stays cleared); the living go home
    if (e.minion) { Object.assign(e, { alive: false, removed: true, dormant: true }); e.ch.g.visible = false; e.ch.warn = 0; continue; }   // the King's knights sink back
    if (!e.alive) continue;
    Object.assign(e, { x: e.hx, z: e.hz, hp: e.max, awake: false, state: 'idle', t: 0, cd: 0, vx: 0, vz: 0, burn: 0, phase: 1, slamCd: 4, broken: 0, sumDmg: 0, atk: null, poiseV: null, comboN: 0 });
    if (e.type === 'king') { e.face = Math.PI / 2; kingGlow(e); }
    e.ch.warn = 0;
  }
  dismissAllies(true); hitFlash = 0;
  setZone(c.area === 'keep' ? 'keep' : 'forest', true); setState('play');
  banner(`${c.name ? c.name[0].toUpperCase() + c.name.slice(1) : 'The shrine'} carries you back`);
  return true;
}
function resultsText() {
  const t = Math.floor(run.time);
  return `THE HOLLOW KING FALLS\n\nTime: ${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s\nEnemies defeated: ${run.kills}\nDeaths: ${run.deaths}\nOathbound summoned: ${run.summoned}\nHordes called: ${run.hordes}\nGrave shards: ${run.shards}\nParries: ${run.parries}`;
}

// ============================================================
// GAME STATE
// ============================================================
const run = { ember1: false, ember2: false };
const hero = { x: 0, z: 0, y: 0, face: Math.PI, ch: null, kx: 0, kz: 0, rvx: 0, rvz: 0, moving: false, dying: 0 };
const cam = { yaw: 0, pitch: 0.12, dist: 3.7, cur: 3.7 };   // low and close over the shoulder
let enemies = [], pickups = [], torchMesh = null, torchFlame = null, flareSprite = null, emberMeshes = {};
let heroHand = null, heroTorch = null;
const ITEMS = {
  woodkey: { name: "Woodcutter's Key", rarity: 'quest', flavor: 'An iron key on a leather cord. It smells of pine sap.' },
  keepkey: { name: 'Keep Key', rarity: 'quest', flavor: 'Heavy and cold. It opens the vault in the keep hall.' },
  gravesteel: { name: 'Gravesteel Sword', rarity: 'rare', flavor: 'Forged from grave iron. Hits harder (+1 damage).' },
  chain: { name: 'Woodcutter\'s Chainmail', rarity: 'uncommon', flavor: 'Rusty but tough. +1 heart.' },
  oil: { name: 'Torch Oil', rarity: 'common', flavor: 'Pour it on your torch for a bigger, brighter light.' },
  potion: { name: 'Health Potion', rarity: 'common', flavor: 'Heals 3 hearts.' },
  gold: { name: 'Gold', rarity: 'common', flavor: 'Old castle coins. Maybe someone in the Keep still wants them.' },
};
let runId = 0;
function newRun() {
  runId++;
  Object.assign(run, {
    hp: MAX_HP, maxHp: MAX_HP, fuel: MAX_FUEL, gold: 0, potions: 1, oils: 1, time: 0,
    key: false, shrineOpen: false, ember1: false, ember2: false, enteredCastle: false, wardenDead: false,
    sword: 'rusted', armor: null, atkCd: 0, combo: 0, comboT: 0, flareCd: 0, wardCd: 0, wardT: 0, inv: 0, darkT: 0,
    stepT: 0, hits: 0, sealNag: 0, zone: 'forest', bossOn: false,
    kills: 0, deaths: 0, summoned: 0, summonCd: 0, checkpoint: null,   // polish pass: results card + shrine checkpoint
    hordeCharges: 0, hordeCd: 0, hordes: 0,                            // Lanternkin: 1 charge per Ember taken
    area: 'realm', keepPending: false, inKeep: false, keepKey: false, vaultOpen: false, ember3: false, altarT: 0, altarLit: 0,   // slice 2
    throneOpen: false, kingDead: false, kingMist: false, slamTip: false, blockTip: false,
    sta: 100, staT: 0, windedT: 0, winds: 0, rollT: 0, blockAt: -9, lastBlock: -9, crit: false, counterT: 0,   // Part 3 combat
    introT: 0, introSeen: false, shards: 0, parries: 0, rolls: 0,
  });
}
newRun();

function makeHero() {
  hero.ch = spawnChar('hero', 'hero');
  // Torch in the left hand
  let hand = null;
  hero.ch.obj.traverse((o) => { if (o.isBone && !hand && /^(wrist|hand|fist)[._]?l$/i.test(o.name.replace(/^.*[:|]/, ''))) hand = o; });
  if (!hand) hero.ch.obj.traverse((o) => { if (o.isBone && !hand && /(hand|wrist|fist).*l/i.test(o.name)) hand = o; });
  heroHand = hand;
  heroTorch = tmpl('torch');
  const holder = new THREE.Group(); holder.add(heroTorch);
  heroTorch.scale.multiplyScalar(0.34); heroTorch.position.y -= 0.15;
  if (hand) {
    hand.add(holder); hero.ch.obj.updateMatrixWorld(true);
    const ws = new THREE.Vector3(); hand.getWorldScale(ws); holder.scale.setScalar(1 / ws.x);
  } else { hero.ch.g.add(holder); holder.position.set(-0.35, 0.9, 0.2); }
  // Dithered pixel glow on the sword (Game Artist's swordGlow texture)
  hero.ch.obj.traverse((o) => { if (o.isBone && /^(wrist|hand|fist)[._]?r$/i.test(o.name)) hero.rhand = hero.rhand || o; });
  const sgt = texOf('swordGlow');
  hero.swordGlow = glowSprite(sgt, 0.6); hero.swordGlow.material.opacity = 0.6; scene.add(hero.swordGlow);
  torchFlame = glowSprite(TX.pxTorch, 0.7); scene.add(torchFlame);
  flareSprite = glowSprite(TX.flare, 1); flareSprite.visible = false; scene.add(flareSprite);
}

// Enemies
function skelArt(key, scale = 1, tint = null, glow = null) {   // Game Artist's model if it's there, otherwise a stand-in look
  if (key && ART.MODELS[key]) return { art: key, anim: ART.ANIMS[key] ? key : 'skeletonKnight', key, stand: [scale, tint, glow] };
  return { art: 'skeletonKnight', anim: 'skeletonKnight', scale, tint, glow };
}
const ENEMY_DEF = {
  wolf: { art: 'wolf', hp: 4, r: 0.6, speed: 5.5 },
  shade: { art: 'shade', hp: 3, r: 0.5, speed: 2.4 },
  warden: { art: 'warden', hp: 20, r: 1.1, speed: 2.3 },
  // slice 2 skeletons: RealmArt.MODELS.skelWarrior / skelMinion / skelMage when they exist, else the tinted skeleton knight
  warrior: { ...skelArt('skelWarrior'), hp: 5, r: 0.55, speed: 2.6, brain: 'warriorBrain' },                   // shield: front hits blocked until his poise breaks
  minion: { ...skelArt('skelMinion', 0.8, 0xe8dcc0), hp: 2, r: 0.45, speed: 4.3, brain: 'minionBrain' },       // fast and weak, in pairs
  mage: { ...skelArt('skelMage', 0.95, 0x9a70ff, 0x2a0850), hp: 2, r: 0.45, speed: 1.8, brain: 'mageBrain' },  // stays back, slow purple bolts
  // dark wizard: RealmArt.MODELS.wizard (ANIMS.wizard) if there, else the skeleton mage; keeps away, bolts, raises Minions
  wizard: { ...(ART.MODELS.wizard ? { art: 'wizard', anim: ART.ANIMS.wizard ? 'wizard' : 'skelMage', key: 'wizard', fb: 'skelMage', stand: [1.1, 0x70a0ff, 0x081a40] } : skelArt('skelMage', 1.1)), hp: 3, r: 0.45, speed: 2 },
  king: { art: KING_ART, anim: ART.ANIMS[KING_ART] ? KING_ART : 'king', hp: 40, r: 0.9, speed: 3 },
};
function spawnEnemy(type, x, z) {
  const d = ENEMY_DEF[type], ch = spawnChar(d.art, d.anim || (type === 'warden' ? 'warden' : type));
  if (type === 'king' && KING_ART === 'king') ch.obj.scale.multiplyScalar(1.3);   // the plain king is small: make him about 3.1 m
  if (d.scale) ch.obj.scale.multiplyScalar(d.scale);                               // stand-in skeletons: size and color tell them apart
  if (d.tint) for (const m of ch.allMats) if (m.color) m.color.multiply(new THREE.Color(d.tint));
  if (d.glow) for (const mm of ch.mats) { mm.m.emissive.setHex(d.glow); mm.base.setHex(d.glow); }
  if (type === 'warden') {                            // dark red, bigger, heavier
    for (const { m, base } of ch.mats) { m.color.multiply(new THREE.Color(1.25, 0.55, 0.5)); base.setHex(0x2a0608); m.emissive.copy(base); }
  }
  const e = { type, ch, x, z, hx: x, hz: z, hp: d.hp, max: d.hp, r: d.r, speed: d.speed, state: 'idle', t: 0, cd: 0, face: rnd() * 6.28,
    alive: true, awake: false, gone: 0, growl: 0, circleDir: rnd() < 0.5 ? 1 : -1, burn: 0, stepT: 0, charges: 0, vx: 0, vz: 0 };
  enemies.push(e); return e;
}
function makeEnemies() {
  for (const e of enemies) scene.remove(e.ch.g);
  enemies = [];
  [[-21, 31], [-31, 22], [-23, 18.5], [-6, -8]].forEach(([x, z]) => spawnEnemy('wolf', x, z));
  [[13, 36], [22, 9], [-8, 14], [6, -18]].forEach(([x, z]) => spawnEnemy('shade', x, z));
  spawnEnemy('warden', ...SPOTS.warden).face = 0;
  // Slice 2 (far away in the keep: they stay hidden and asleep until you get there)
  [['warrior', 4, KZ + 6], ['minion', -5, KZ + 9], ['mage', 7, KZ + 11], ['wizard', -9, KZ - 9], ['warrior', 6, KZ - 18.7], ['wizard', -4, KZ - 18.7], ['warrior', 12.7, KZ - 6]]
    .forEach(([t, x, z]) => { spawnEnemy(t, x, z).face = 0; });
  kingGlow(Object.assign(spawnEnemy('king', THR.x - 6, THR.z), { face: Math.PI / 2, phase: 1, slamCd: 4 }));
  for (let i = 0; i < 4; i++) Object.assign(spawnEnemy('minion', THR.x, THR.z), { minion: true, dormant: true, alive: false, removed: true });   // a hidden pool: the King (phase 2) and the wizards raise these
  if (ready) flatten();
}

// Pickups: small glowing shapes (oil, potion, gold, gear) and the Embers
const PGEO = {
  oil: new THREE.CylinderGeometry(0.16, 0.2, 0.42, 8), potion: new THREE.SphereGeometry(0.2, 10, 8), gold: new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12),
  chain: new THREE.TorusGeometry(0.22, 0.07, 6, 12), gravesteel: new THREE.BoxGeometry(0.08, 1.0, 0.16), ember: new THREE.IcosahedronGeometry(0.28, 1),
};
const PMAT = {
  oil: new THREE.MeshStandardMaterial({ color: 0x8a5a20, emissive: 0x5a2a00 }), potion: new THREE.MeshStandardMaterial({ color: 0xc02030, emissive: 0x600010 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x5a4000, metalness: 0.6, roughness: 0.4 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x9aa0b0, emissive: 0x202a40, metalness: 0.6 }),
  gravesteel: new THREE.MeshStandardMaterial({ color: 0xb0c0e0, emissive: 0x3040a0, metalness: 0.7, roughness: 0.3 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xffd36b }),
};
function addPickup(kind, x, z, extra = {}) {
  let mesh;
  if (kind === 'woodkey' || kind === 'keepkey') mesh = tmpl('key');
  else mesh = new THREE.Mesh(PGEO[kind.startsWith('ember') ? 'ember' : kind], PMAT[kind.startsWith('ember') ? 'ember' : kind]);
  const g = new THREE.Group(); g.add(mesh);
  const y = extra.y != null ? extra.y : groundH(x, z) + 0.7;
  g.position.set(x, y, z); scene.add(g);
  const glow = glowSprite(kind.startsWith('ember') ? TX.pxEmber : TX.pxTorch, kind.startsWith('ember') ? 2.4 : 0.9, kind === 'potion' ? 0xff6070 : undefined);
  glow.position.copy(g.position); scene.add(glow);
  const p = { kind, x, z, y, g, glow, taken: false, auto: !kind.startsWith('ember'), spin: !kind.endsWith('key'), ...extra };
  pickups.push(p); return p;
}
function makePickups() {
  for (const p of pickups) { scene.remove(p.g); scene.remove(p.glow); }
  pickups = []; emberMeshes = {};
  addPickup('woodkey', SPOTS.key[0], SPOTS.key[1], { y: groundH(...SPOTS.key) + 0.95 });
  [[6, 48], [-14, 12], [16, 5], [-7, -12], [4, -26]].forEach(([x, z]) => addPickup('oil', x, z));
  [[-30, 23], [9, -22]].forEach(([x, z]) => addPickup('potion', x, z));
  [[-17, 40], [33, 24], [-4, -2], [10, -44]].forEach(([x, z]) => addPickup('gold', x, z));
  addPickup('chain', SPOTS.camp[0] + 5, SPOTS.camp[1] + 1.2);
  addPickup('gravesteel', SPOTS.shrine[0] + 4.2, SPOTS.shrine[1] - 5.5);
  emberMeshes.e1 = addPickup('ember1', SPOTS.shrine[0], SPOTS.shrine[1], { y: groundH(...SPOTS.shrine) + 1.3, locked: true });
  // slice 2: the Keep Key at the far end of the ramparts, the Ember of the Keep in the vault, some oil and a potion
  addPickup('keepkey', SPOTS.keepKey[0], SPOTS.keepKey[1], { y: RH + 0.95 });
  emberMeshes.e3 = addPickup('ember3', -11, KZ + 17, { y: 1.3, locked: true });
  [[8, KZ + 12], [-10, KZ - 6], [-12, KZ]].forEach(([x, z]) => addPickup('oil', x, z));
  addPickup('potion', 12.7, KZ - 12);
}

// ============================================================
// STATES: title, intro, play, story, paused, win, lose
// ============================================================
let state = 'title', introPage = 0, endedAt = 0, storyThen = null, storyAt = 0;
const screenIds = ['title', 'intro', 'story', 'paused', 'win', 'lose'];
function newGame() {
  newRun();
  hero.x = SPOTS.start[0]; hero.z = SPOTS.start[1]; hero.face = Math.PI; hero.kx = hero.kz = 0; hero.dying = 0;
  hero.ch.g.visible = true; play(hero.ch, 'idle', false);
  dismissAllies(true); hitStop = 0; shake = 0; fadeT = 0;
  cam.yaw = 0; cam.pitch = 0.12;
  resetCombat(); applyArea('realm'); resetKeep(); clearBolts();     // back to the forest (the keep is hidden again)
  makeEnemies(); makePickups();
  sealMesh.visible = true; shrineCircle.r = 1.9;
  brambleT = 0; brambles.visible = true; brambles.instanceMatrix.array.set(brambles.userData.base); brambles.instanceMatrix.needsUpdate = true;
  setZone('forest', true);
  setState('play');
  banner('The Blackpine Forest');
}
function setState(s) {
  state = s;
  if (s === 'win' || s === 'lose') {
    endedAt = performance.now();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (s === 'win') $('winStats').textContent = `Gold: ${run.gold}. Time: ${Math.floor(run.time / 60)}m ${Math.floor(run.time % 60)}s. Enemies defeated: ${run.kills}. Deaths: ${run.deaths}. Oathbound summoned: ${run.summoned}. Hordes called: ${run.hordes}. Grave shards: ${run.shards}. Parries: ${run.parries}.`;
  if (s === 'lose') { $('retryBtn').hidden = !run.checkpoint; if (run.checkpoint) $('retryBtn').textContent = `Retry at ${(run.checkpoint.name || 'the Shrine').replace(/^the /, 'the ')}`; }
  if (s === 'lose') $('loseStats').textContent = `Embers: ${emberCount()}/3.`;
  for (const id of screenIds) $(id).classList.toggle('show', id === s);
  if (s === 'paused') renderInventory();
  updatePrompt(); updateSoundTip();
}
function tryRestart() {           // 0.8s lockout so a mashed button can't skip the ending
  if (performance.now() - endedAt > 800) { introPage = 0; newGame(); return true; }
  return false;
}
function togglePause() {
  if (state === 'play') setState('paused');
  else if (state === 'paused') setState('play');
}
function story(text, kind, then) {
  $('storyText').textContent = text;
  $('story').className = 'screen ' + kind;
  storyThen = then || null; storyAt = performance.now();
  setState('story');
}
// (ignore taps in the first 0.4s, so the same tap that opened the card can't close it)
function closeStory() { if (performance.now() - storyAt < 400) return; setState('play'); const f = storyThen; storyThen = null; if (f) f(); }
function startIntro() { if (!ready) return; startMusic(); setTimeout(updateSoundTip, 300); introPage = 0; $('introText').textContent = INTRO[0]; setState('intro'); }
function nextIntro() {
  introPage++;
  if (introPage >= INTRO.length) return newGame();
  $('introText').textContent = INTRO[introPage];
}
// Zone music and ambience: only call when it changes
function setZone(z, force) {
  if (z === run.zone && !force) return;
  run.zone = z;
  $('zoneName').textContent = { castle: 'Castle Morrow', keep: 'The Keep', throne: 'The Throne Room' }[z] || 'Blackpine Forest';
  // try the newest names first (Audio Designer may add 'keep' / 'throne'); unknown names are ignored, so fall back
  const order = { keep: ['keep', 'castle'], throne: ['throne', 'keep', 'castle'] }[z] || [z];
  try { if (window.Music && typeof Music.setTheme === 'function') for (const n of order) { Music.setTheme(n); if (Music.theme === n) break; } } catch (e) {}
  try { if (window.Ambience && typeof Ambience.setZone === 'function') for (const n of order) { Ambience.setZone(n); if (Ambience.zone === n) break; } } catch (e) {}
}

// ============================================================
// COMBAT
// ============================================================
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
let atkAnim = 0, flareT = 0, hitFlash = 0;
const lightR = () => 1.5 + 6.5 * run.fuel / MAX_FUEL;   // torchlight radius in meters
function canAct() { return state === 'play' && !hero.dying && !(run.altarT > 0); }
function attack() {
  if (run.introT > 0) return skipKingIntro();
  if (!canAct() || run.atkCd > 0 || run.rollT > 0) return;
  if (run.windedT > 0) { if (run.time - (run.puffAt || -9) > 0.5) { run.puffAt = run.time; sfx('staminaOut'); } return; }   // winded: can't swing
  spendSta(STA_ATK);                                 // every swing costs stamina, so mashing runs you dry
  if (lockT) hero.face = Math.atan2(lockT.x - hero.x, lockT.z - hero.z);   // locked on: swing at the target
  run.combo = run.comboT > 0 ? (run.combo + 1) % 3 : 0;
  run.atkCd = 0.36; run.comboT = 0.8; atkAnim = 0.45;
  play(hero.ch, 'attack', true, 1.5 + run.combo * 0.25);
  sound('swing');
  const dmg = (run.combo === 2 ? 2 : 1) + (run.sword === 'gravesteel' ? 1 : 0);
  let hitAny = false;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - hero.x, dz = e.z - hero.z, d = Math.hypot(dx, dz);
    if (d < 2.3 + e.r && (d < 0.9 || Math.abs(angDiff(Math.atan2(dx, dz), hero.face)) < 1.25)) { hurtEnemy(e, dmg, dx / (d || 1), dz / (d || 1)); hitAny = true; }
  }
  if (hitAny) rumble(60, 0.4);
}
let immuneNag = 0, hordeHitSnd = 0;
// src: 'hero' (Aldren's sword or flare), 'ally' (an Oathbound) or 'light' (the torch burning a shade)
function hurtEnemy(e, dmg, nx = 0, nz = 0, byLight = false, src = 'hero') {
  if (!e || !e.alive) return;
  if (torchOnly(e) && !byLight && Math.hypot(e.x - hero.x, e.z - hero.z) > lightR()) {   // shades (and the King's last phase) only hurt inside Aldren's torchlight (allies too)
    if (src === 'horde') return;                      // goblins follow the torch rule too (quietly)
    flashChar(e.ch, 0x6040ff, 0.1); sound('blip');
    if (src === 'hero' && performance.now() - immuneNag > 4000) { immuneNag = performance.now(); toast(e.type === 'king' ? 'The King is wrapped in shadow.<br>Only inside your torchlight can he be hurt!' : 'Your blade passes through the shade.<br>Only inside your torchlight can it be hurt!'); }
    return;
  }
  // Part 3: after a parry the next hit is a 3x critical; a hit right after a roll-dodge (counter) breaks poise
  let crit = false, counter = false;
  if (src === 'hero') { if (run.crit) { crit = true; run.crit = false; dmg *= 3; } if (run.counterT > 0) { counter = true; run.counterT = 0; } }
  // skeleton knights block hits from the front until their poise breaks (hit the side or back, parry, or Flare)
  if (e.type === 'warrior' && !crit && (e.broken || 0) <= 0 && (e.shieldDown || 0) <= 0 && e.state !== 'stagger' && (nx || nz) && -(Math.sin(e.face) * nx + Math.cos(e.face) * nz) > 0.5) {
    flashChar(e.ch, 0x6080ff, 0.08); emit(e.x, groundH(e.x, e.z) + 1.1, e.z, 6, 0x9cc0ff, { speed: 3, life: 0.25 }); sfx('shieldBlock', 'clank'); e.awake = true;
    if (e.state === 'walk' && (e.ch.acts.blockHit || e.ch.acts.block)) { play(e.ch, e.ch.acts.blockHit ? 'blockHit' : 'block', true, 1.4); e.blockT = 0.45; }
    if (src === 'hero') {                            // each blocked hit chips his poise; at 0 the shield drops
      if (counter || (e.poiseV = (e.poiseV ?? POISE.warrior) - 1, e.poiseT = 2.5, e.poiseV <= 0)) breakPoise(e);
      if (!run.blockTip) { run.blockTip = true; toast('The Warrior blocks with his shield!<br>Break his poise, parry him, or hit his side or back.'); }
    }
    return;
  }
  // The Hollow King: ALL summons together (Oathbound + goblins) can take at most 25% of his HP per fight
  if (e.type === 'king' && (src === 'ally' || src === 'horde')) {
    dmg = Math.min(dmg, 0.25 * e.max - (e.sumDmg || 0)); if (dmg <= 0) return;
    e.sumDmg = (e.sumDmg || 0) + dmg;
  }
  e.hp -= dmg; e.awake = true;
  if (src === 'horde') {                             // goblin nibble: small flash, 3 sparks, no knockback, fewer sounds
    flashChar(e.ch, 0xffffff, 0.05); emit(e.x, groundH(e.x, e.z) + 0.5, e.z, 3, 0xffe0a0, { speed: 3, life: 0.25 });
    if (performance.now() - hordeHitSnd > 150) { hordeHitSnd = performance.now(); sound(isBoss(e) || e.type === 'warrior' ? 'clank' : 'hit'); }
    if (e.hp <= 0) killEnemy(e);
    return;
  }
  // Poise: Aldren's hits chip it; enemies fight through hits until it breaks (then a 1 s stagger)
  let broke = false;
  if (src === 'hero' && e.hp > 0) {
    if (crit || counter) { breakPoise(e); broke = true; }
    else if (e.state !== 'stagger') { e.poiseV = (e.poiseV ?? (POISE[e.type] || 2)) - 1; e.poiseT = 2.5; if (e.poiseV <= 0) { breakPoise(e); broke = true; } }
  }
  hitFX(e, src);                                     // white flash, sparks, hit-stop
  if (crit) { sfx('critHit', 'hit'); emit(e.x, groundH(e.x, e.z) + 1.3, e.z, 20, 0xffd060, { speed: 6, up: 2, life: 0.4 }); }
  else sound(isBoss(e) || e.type === 'warrior' ? 'clank' : 'hit');
  const reel = broke || e.state === 'stagger' || e.state === 'recover' || src !== 'hero';   // only a staggered enemy gets knocked back
  if (!isBoss(e) && reel) { e.vx = nx * 7; e.vz = nz * 7; }
  if (e.hp <= 0) killEnemy(e);
  else if (reel && !broke && src === 'hero') play(e.ch, 'hit', true, 1.4);
}
function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0; e.ch.warn = 0; e.dieT = 0; run.kills++;
  dropToken(e); cancelAtk(e); if (e.bar) e.bar.el.style.display = 'none';
  const sh = SHARDS[e.type] || 0;                    // grave shards (score)
  if (sh && !e.minion) { run.shards += sh; sfx('shardPickup', 'coin', 'blip'); emit(e.x, groundH(e.x, e.z) + 1, e.z, 8 + sh * 2, 0x9fe8ff, { speed: 3, up: 3, life: 0.6 }); }
  if (e.type === 'warrior' || isBoss(e)) rumble(220, 0.7);
  // Death clip if the model has one (RealmArt.ANIMS lists 'death'); otherwise updateDeaths() tips the body over
  // Bigger deaths: a random Death_A/B/C if the model has them, played at 0.7 speed (bosses: a slow 1.5 s / 2 s fall),
  // then the last frame holds 1.5 s before the body fades (updateDeaths)
  if (e.ch.deaths && e.ch.deaths.length) e.ch.acts.death = e.ch.deaths[Math.floor(Math.random() * e.ch.deaths.length)];
  e.clipDeath = !!e.ch.acts.death;
  const dur = e.clipDeath ? e.ch.acts.death.getClip().duration : 0.4, sp = isBoss(e) ? dur / (e.type === 'king' ? 2 : 1.5) : 0.7;
  if (e.clipDeath) play(e.ch, 'death', true, sp);
  else play(e.ch, 'hit', true, 0.8);
  e.fadeAt = (e.clipDeath ? dur / sp : 0.4) + 1.5;
  emit(e.x, groundH(e.x, e.z) + (isBoss(e) ? 2 : 0.9), e.z, 22, e.type === 'shade' ? 0xd8b0ff : 0xffe0a0, { speed: 5, up: 3, life: 0.45 });   // double sparks
  kickT = 0.04;                                      // a tiny camera kick on every kill
  const more = enemies.some((o) => o !== e && o.alive && !o.dormant && Math.hypot(o.x - hero.x, o.z - hero.z) < 18);
  if (isBoss(e) || !more) slowT = 0.4;               // slow motion on the last enemy of a room, and on bosses
  if (!isBoss(e)) { e.vx *= 1.4; e.vz *= 1.4; }   // a bit more knockback on the killing blow
  if (e.type === 'shade') sfx('shadeDissolve', 'shadeDeath', 'death', 'burn');
  else if (e.type === 'wizard') sfx('wizardDeath', 'skeletonDeath', 'death');
  else if (isSkel(e)) sfx('skeletonDeath', 'death');
  else if (e.type === 'king') kingDies(e);
  else sfx(e.type + 'Death', 'death');
  if (e.type === 'warden') {
    shake = 1; rumble(600, 0.8);
    emit(e.x, groundH(e.x, e.z) + 2, e.z, 40, 0xffd070, { speed: 6, up: 4, life: 0.7, spread: 1.2 });
    run.wardenDead = true; sound('roar'); banner('The Warden falls');
    const rid = runId;
    setTimeout(() => {
      if (rid !== runId || !run.wardenDead || run.ember2 || emberMeshes.e2) return;
      emberMeshes.e2 = addPickup('ember2', e.x, e.z, { y: groundH(e.x, e.z) + 1.2 }); sound('bell');
    }, 1200);
  }
}
function flare() {
  if (!canAct()) return;
  if (run.flareCd > 0) return;
  if (run.fuel < 12) { toast('Not enough light for a flare. Find torch oil.'); return; }
  run.fuel -= 12; run.flareCd = 6; flareT = 0.5; sound('flare'); rumble(120, 0.6);
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - hero.x, e.z - hero.z);
    if (d > 8) continue;
    if (e.type === 'shade') hurtEnemy(e, 3, 0, 0, true);
    else if (e.type === 'wolf') { e.awake = true; e.state = 'flee'; e.t = 2; e.ch.warn = 0; flashChar(e.ch, 0xffcc88); }
    else { if (e.type === 'warrior') e.broken = 3; hurtEnemy(e, 1); if (e.alive && e.state !== 'stagger') breakPoise(e, 0.7); }   // knights: block broken for 3 s
  }
}
function hurtHero(d, fx, fz, knock = 6) {
  if (!canAct() || run.inv > 0) return false;
  if (rollInv()) { run.counterT = 0.7; return false; }   // rolled through it
  if (run.windedT > 0) d *= 2;                       // winded: double damage
  run.hp -= d; run.hits++; run.inv = 0.9; hitFlash = 0.35;
  if (fx != null) { const dx = hero.x - fx, dz = hero.z - fz, l = Math.hypot(dx, dz) || 1; hero.kx = dx / l * knock; hero.kz = dz / l * knock; }
  sound('hit'); rumble(180, 0.9); flashChar(hero.ch, 0xff2020, 0.25);
  if (run.hp <= 0) { run.hp = 0; hero.dying = 1.8; play(hero.ch, 'death', true); atkAnim = 0; run.deaths++; dismissAllies(); }
  else play(hero.ch, 'hit', true, 1.6);
  return true;
}
function drinkPotion() {
  if (!run.potions || run.hp >= run.maxHp) return false;
  run.potions--; run.hp = Math.min(run.maxHp, run.hp + 3); sound('gulp'); toast('+3 hearts'); return true;
}
function pourOil() {
  if (!run.oils || run.fuel >= MAX_FUEL - 1) return false;
  run.oils--; run.fuel = Math.min(MAX_FUEL, run.fuel + 45); sound('relight'); toast('Your torch blazes brighter.'); return true;
}

// ============================================================
// ENEMY BRAINS
// ============================================================
function moveEnemy(e, vx, vz, dt) {
  const p = { x: e.x + (vx + e.vx) * dt, z: e.z + (vz + e.vz) * dt };
  pushOut(p, e.r);
  if (e.type === 'king') { p.x = Math.max(THR.x - THR.hx + 3, Math.min(THR.x + THR.hx - 2, p.x)); p.z = Math.max(THR.z - THR.hz + 2, Math.min(THR.z + THR.hz - 2, p.z)); }   // he stays in his throne room
  if (e.type === 'warden') { const H = CASTLE.h - 1.8; p.x = Math.max(-H, Math.min(H, p.x)); p.z = Math.max(CASTLE.z - H, Math.min(CASTLE.z + H, p.z)); }
  const moved = Math.hypot(p.x - e.x, p.z - e.z);
  e.x = p.x; e.z = p.z;
  e.vx *= Math.exp(-6 * dt); e.vz *= Math.exp(-6 * dt);
  return moved;
}
function turnTo(e, a, dt, rate = 8) { e.face += angDiff(a, e.face) * Math.min(1, rate * dt); }
function updateEnemy(e, dt) {
  const T = enemyTarget(e);                          // Aldren or a closer Oathbound
  const dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz) || 0.001, ax = dx / d, az = dz / d, toHero = Math.atan2(dx, dz);
  e.t -= dt; e.cd -= dt; e.growl -= dt;
  const heroOK = T.ok;
  if (e.type === 'warrior') return warriorBrain(e, dt, T, d, toHero);
  if (e.type === 'minion') return minionBrain(e, dt, T, d, toHero);
  if (e.type === 'mage') return mageBrain(e, dt, T, d, toHero);
  if (e.type === 'wizard') return wizardBrain(e, dt, T, d, toHero);
  if (e.type === 'king') return kingBrain(e, dt, T, d, toHero);
  if (e.type === 'wolf') {
    if (!e.awake && d < 14 && heroOK) { e.awake = true; e.state = 'circle'; e.t = 1.2 + rnd(); }
    if (e.awake && e.growl <= 0 && d < 14 && e.state === 'circle') { sound('wolfGrowl'); e.growl = 3 + rnd() * 2; }
    if (e.awake && (d > 30 || !heroOK)) { e.awake = false; e.state = 'home'; }
    if (e.state === 'idle' || e.state === 'home') {
      const hx = e.hx - e.x, hz = e.hz - e.z, hd = Math.hypot(hx, hz);
      if (hd > 1) { moveEnemy(e, hx / hd * 3, hz / hd * 3, dt); turnTo(e, Math.atan2(hx, hz), dt); play(e.ch, 'walk'); }
      else { moveEnemy(e, 0, 0, dt); play(e.ch, 'idle'); e.state = 'idle'; }
    } else if (e.state === 'circle') {
      const tx = -az * e.circleDir, tz = ax * e.circleDir, pull = (d - 5) * 0.8;
      const vx = tx * 4.5 + ax * pull, vz = tz * 4.5 + az * pull;
      moveEnemy(e, vx, vz, dt); turnTo(e, Math.atan2(vx, vz), dt); play(e.ch, 'run', false, 1);
      if (e.t <= 0 && d < 8 && heroOK && takeToken(e)) { e.state = 'crouch'; e.t = 0.6; e.ch.warn = 1; play(e.ch, 'crouch', false); telegraph(e, 0.6); }
    } else if (e.state === 'crouch') {
      moveEnemy(e, 0, 0, dt); turnTo(e, toHero, dt, 14);
      if (e.t <= 0) { e.state = 'lunge'; e.t = 0.42; e.lx = ax; e.lz = az; e.struck = false; e.ch.warn = 0; sound('wolfLunge'); play(e.ch, 'attack', true, 1.4); }
    } else if (e.state === 'lunge') {
      moveEnemy(e, e.lx * 12, e.lz * 12, dt);
      if (!e.struck && d < 1.4) { e.struck = true; strike(T, 1, e.x, e.z, 7, e); }
      if (e.t <= 0) { e.state = 'recover'; e.t = 0.8; play(e.ch, 'idle'); dropToken(e); }
    } else if (e.state === 'recover') {
      moveEnemy(e, 0, 0, dt);
      if (e.t <= 0) { dropToken(e); e.state = 'circle'; e.t = 1.6 + rnd() * 1.4; if (rnd() < 0.3) e.circleDir *= -1; }
    } else if (e.state === 'flee') {
      moveEnemy(e, -ax * 6, -az * 6, dt); turnTo(e, toHero + Math.PI, dt); play(e.ch, 'run');
      if (e.t <= 0) { e.state = 'circle'; e.t = 1.5; }
    }
  } else if (e.type === 'shade') {
    if (!e.awake && d < 16 && heroOK) e.awake = true;
    if (e.awake && (d > 32 || !heroOK)) { e.awake = false; cancelAtk(e); dropToken(e); }
    if (e.state === 'atk') {                            // 0.4 s lunge wind-up (glint), then the touch hits
      if (!updateAtk(e, dt, T, d, toHero)) { dropToken(e); if (e.state === 'walk') { e.state = 'drift'; e.t = 2.5; e.cd = 1.4; } }
      return;
    }
    let vx = 0, vz = 0;
    const edge = lightR() * 0.5, lit = run.fuel > 0 && Math.hypot(hero.x - e.x, hero.z - e.z) < edge;   // the light is around Aldren
    if (!e.awake) { const hx = e.hx - e.x, hz = e.hz - e.z, hd = Math.hypot(hx, hz); if (hd > 1) { vx = hx / hd * 1.5; vz = hz / hd * 1.5; } play(e.ch, 'idle'); }
    else if (e.state === 'dart') {
      vx = ax * 7; vz = az * 7; play(e.ch, 'run');
      if (d < 1.4 && e.cd <= 0 && takeToken(e)) { windUp(e, 'light', { wind: 0.4, range: 1.7, rec: 0.4, speed: 1.3 }); return; }
      if (e.t <= 0) { e.state = 'drift'; e.t = 2.5 + rnd() * 1.5; }
    } else {
      e.state = 'drift';
      if (lit) {                                          // the torch burns: back off
        e.burn += dt; vx = -ax * 2; vz = -az * 2;
        if (e.burn > 0.9) { e.burn = 0; hurtEnemy(e, 1, 0, 0, true, 'light'); sound('burn'); }
      } else if (d > edge + 0.5) { vx = ax * e.speed; vz = az * e.speed; }
      else { vx = -az * 1.5; vz = ax * 1.5; }             // hover at the edge of the light
      play(e.ch, d > edge + 2 ? 'run' : 'idle');
      if (e.t <= 0 && d < edge + 4 && heroOK) { e.state = 'dart'; e.t = 0.9; }
      if (d < 1.4 && e.cd <= 0 && heroOK && takeToken(e)) { windUp(e, 'light', { wind: 0.4, range: 1.7, rec: 0.4, speed: 1.3 }); return; }
    }
    if (e.alive) { moveEnemy(e, vx, vz, dt); turnTo(e, e.awake ? toHero : Math.atan2(vx, vz) || e.face, dt); }
  } else if (e.type === 'warden') {
    const heroIn = inCourtyard(hero.x, hero.z) && heroOK;
    if (!e.awake && heroIn) { e.awake = true; e.state = 'walk'; e.cd = 1; e.chargeCd = 3; }
    if (!e.awake) { play(e.ch, 'idle'); return; }
    e.chargeCd = (e.chargeCd || 0) - dt; e.stepT -= dt;
    if (!heroIn && e.state !== 'swing') {                // you left: he walks back to his post
      const hx = e.hx - e.x, hz = e.hz - e.z, hd = Math.hypot(hx, hz);
      if (hd > 1) { moveEnemy(e, hx / hd * 2, hz / hd * 2, dt); turnTo(e, Math.atan2(hx, hz), dt, 3); play(e.ch, 'walk'); }
      else { play(e.ch, 'idle'); turnTo(e, 0, dt, 3); e.awake = false; }
      e.state = 'walk'; e.ch.warn = 0; return;
    }
    if (e.state === 'walk') {
      turnTo(e, toHero, dt, 3);
      if (d > 2.6) { moveEnemy(e, Math.sin(e.face) * e.speed, Math.cos(e.face) * e.speed, dt); play(e.ch, 'walk', false, 1.1); if (e.stepT <= 0) { sound('clank'); e.stepT = 0.62; } }
      else { moveEnemy(e, 0, 0, dt); play(e.ch, 'idle'); }
      if (d < 3.4 && e.cd <= 0) { e.state = 'swing'; e.t = 1.0; e.struck = false; e.ch.warn = 1; play(e.ch, 'attack', true, 0.85); sound('clank'); telegraph(e, 0.55); }
      else if (d > 7 && d < 15 && e.chargeCd <= 0) { e.state = 'crouch'; e.t = 0.8; e.ch.warn = 1; play(e.ch, 'idle'); }
    } else if (e.state === 'swing') {
      moveEnemy(e, 0, 0, dt);
      if (e.t > 0.7) turnTo(e, toHero, dt, 4);
      if (!e.struck && e.t < 0.45) {
        e.struck = true; e.ch.warn = 0; sound('clank');
        if (d < 3.9 && Math.abs(angDiff(toHero, e.face)) < 1.1) strike(T, 2, e.x, e.z, 10);
      }
      if (e.t <= 0) { e.state = 'walk'; e.cd = 1.3; }
    } else if (e.state === 'crouch') {
      moveEnemy(e, 0, 0, dt); turnTo(e, toHero, dt, 6);
      if (e.t <= 0) { e.state = 'charge'; e.t = 1.4; e.lx = Math.sin(e.face); e.lz = Math.cos(e.face); e.ch.warn = 0; play(e.ch, 'run', false, 1.5); sound('roar'); }
    } else if (e.state === 'charge') {
      const moved = moveEnemy(e, e.lx * 9, e.lz * 9, dt);
      if (e.stepT <= 0) { sound('clank'); e.stepT = 0.3; }
      if (d < 1.9) { strike(T, 2, e.x, e.z, 12); e.state = 'walk'; e.cd = 1; e.chargeCd = 5; }
      else if (e.t <= 0 || moved < 9 * dt * 0.4) { e.state = 'stagger'; e.t = 0.9; e.chargeCd = 5; play(e.ch, 'idle'); }
    } else if (e.state === 'stagger') {
      moveEnemy(e, 0, 0, dt); if (e.t <= 0) { e.state = 'walk'; e.cd = 0.4; }
    }
  }
}

// ============================================================
// PICKUPS, SHRINE, EMBERS, OBJECTIVES
// ============================================================
function takePickup(p) {
  p.taken = true; p.g.visible = false; p.glow.visible = false;
  const it = ITEMS[p.kind];
  if (p.kind === 'woodkey') { run.key = true; sound('key'); toast(`<span class="quest">Woodcutter's Key</span><br>It opens the forest shrine.`); }
  else if (p.kind === 'keepkey') { run.keepKey = true; sound('key'); toast(`<span class="quest">Keep Key</span><br>It opens the vault.`); }
  else if (p.kind === 'oil') { run.oils++; sound('pickup'); toast(`<span class="common">Torch Oil</span> (Bag to use)`); }
  else if (p.kind === 'potion') { run.potions++; sound('pickup'); toast(`<span class="common">Health Potion</span> (Bag to drink)`); }
  else if (p.kind === 'gold') { const g = 5 + Math.floor(rnd() * 11); run.gold += g; sound('coin'); toast(`+${g} gold`); }
  else if (p.kind === 'chain') { run.armor = 'chain'; run.maxHp = MAX_HP + 1; run.hp = Math.min(run.maxHp, run.hp + 1); sound('chest'); toast(`<span class="uncommon">${it.name}</span><br>${it.flavor}`); }
  else if (p.kind === 'gravesteel') { run.sword = 'gravesteel'; sound('ring'); toast(`<span class="rare">${it.name}</span><br>${it.flavor}`); }
}
function unlockShrine() {
  run.shrineOpen = true; sealMesh.visible = false; shrineCircle.r = 1.0; emberMeshes.e1.locked = false;
  sound('door'); banner('The shrine opens');
}
function takeEmber1() {
  const p = emberMeshes.e1; p.taken = true; p.g.visible = false; p.glow.visible = false;
  run.ember1 = true; run.fuel = MAX_FUEL; sound('ember'); rumble(300, 0.7);
  run.hordeCharges++;                                                // +1 Lanternkin horn charge
  run.checkpoint = { x: SPOTS.shrine[0] - 3.2, z: SPOTS.shrine[1], horde: run.hordeCharges };   // from now on, death sends you back here
  story('THE EMBER OF THE WOOD\n\nIt is warm, like a hand on your shoulder. Far off, at the edge of the forest, the brambles around the castle gate hiss and shrink back from its light.\n\nYour torch is full again.', 'ember',
    () => { brambleT = 0.001; sound('relight'); banner('The brambles wither'); toast('Checkpoint: the shrine will bring you back.<br>+1 Horde charge: call the Lanternkin!'); });
}
function takeEmber2() {
  const p = emberMeshes.e2; p.taken = true; p.g.visible = false; p.glow.visible = false;
  run.ember2 = true; run.hordeCharges++; sound('ember'); rumble(300, 0.7);
  story('THE EMBER OF THE WALLS\n\nThe Warden\'s empty helm rolls to a stop. The Ember in your hand burns steady and gold. Above the courtyard, one window in the Keep lights up... and goes dark.', 'ember',
    () => { sfx('doorGrind', 'door'); banner('The Keep gate grinds open'); toast('+1 Horde charge. The Keep is open: go north through the gate.'); });
}
function nearbyThing() {
  if (!canAct()) return null;
  const [sx, sz] = SPOTS.shrine, ds = Math.hypot(hero.x - sx, hero.z - sz);
  if (!run.shrineOpen && run.key && ds < 4.2) return { label: 'Unlock', fn: unlockShrine };
  if (run.shrineOpen && !run.ember1 && ds < 3.4) return { label: 'Take', fn: takeEmber1 };
  const e2 = emberMeshes.e2;
  if (e2 && !e2.taken && Math.hypot(hero.x - e2.x, hero.z - e2.z) < 2.8) return { label: 'Take', fn: takeEmber2 };
  if (run.area === 'keep') {
    const near = (p, r) => Math.hypot(hero.x - p[0], hero.z - p[1]) < r, e3 = emberMeshes.e3;
    if (run.keepKey && !run.vaultOpen && near(SPOTS.vault, 3)) return { label: 'Unlock', fn: openVault };
    if (run.vaultOpen && e3 && !e3.taken && near([e3.x, e3.z], 2.6)) return { label: 'Take', fn: takeEmber3 };
    if (run.ember3 && !run.throneOpen && near(SPOTS.altar, 3.2)) return { label: 'Relight', fn: relightAltar };
  }
  return null;
}
function interact() { const t = nearbyThing(); if (t) t.fn(); }
function objective() {
  const w = enemies.find((e) => e.type === 'warden');
  if (!run.inKeep) {
  if (!run.key) return ["Find the Woodcutter's Key at the camp", SPOTS.key];
  if (!run.shrineOpen) return ['Open the forest shrine', SPOTS.shrine];
  if (!run.ember1) return ['Take the Ember of the Wood 0/1', SPOTS.shrine];
  if (!run.enteredCastle) return ['Enter Castle Morrow', SPOTS.gate];
  if (!run.wardenDead) return ['Defeat the Courtyard Warden', w ? [w.x, w.z] : SPOTS.warden];
  if (!run.ember2) return ['Take the Ember of the Walls 0/1', emberMeshes.e2 ? [emberMeshes.e2.x, emberMeshes.e2.z] : SPOTS.warden];
  return ['Enter the Keep', SPOTS.keepGate];
  }
  if (!run.keepKey) return ['Find the Keep Key on the ramparts', SPOTS.keepKey];
  if (!run.ember3) return ['Open the vault: Ember of the Keep 0/1', SPOTS.vault];
  if (!run.throneOpen) return ['Relight the altar with 3 Embers', SPOTS.altar];
  const k = enemies.find((e) => e.type === 'king');
  if (!run.kingDead) return ['Defeat the Hollow King', k ? [k.x, k.z] : [THR.x, THR.z]];
  return ['The light returns', null];
}

// ============================================================
// UPDATE (every frame while playing)
// ============================================================
const _hp = new THREE.Vector3();
let lastNear = null;
function updatePlay(dt) {
  run.time += dt;
  for (const k of ['atkCd', 'comboT', 'flareCd', 'wardCd', 'wardT', 'inv', 'sealNag', 'summonCd', 'hordeCd', 'rollT']) run[k] = Math.max(0, run[k] - dt);
  updateCombat(dt);                                  // Part 3: stamina, poise, tokens, lock-on, telegraphs
  atkAnim = Math.max(0, atkAnim - dt);
  // --- the knight ---
  if (hero.dying > 0) {
    hero.dying -= dt;
    if (hero.dying <= 0) { hero.dying = 0.0001; setState('lose'); return; }
  } else {
    let [mx, my] = moveInput(); if (run.altarT > 0 || fadeT > 0 || run.introT > 0 || run.rollT > 0) mx = my = 0;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 1e-3) { const l = Math.hypot(mx, my); mx /= l; my /= l; }
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const wx = rx * mx + fx * my, wz = rz * mx + fz * my, wl = Math.hypot(wx, wz) || 1;
    const speed = 5.4 * mag * (atkAnim > 0 ? 0.3 : 1);
    const rs = run.rollT > 0 ? dt : 0;                // rolling: slide along the roll direction
    const p = { x: hero.x + wx / wl * speed * dt + hero.kx * dt + hero.rvx * rs, z: hero.z + wz / wl * speed * dt + hero.kz * dt + hero.rvz * rs };
    hero.kx *= Math.exp(-7 * dt); hero.kz *= Math.exp(-7 * dt);
    const bx = p.x, bz = p.z;
    pushOut(p, 0.4);
    // bumping the sealed gate
    if (!run.ember1 && run.sealNag <= 0 && Math.abs(bx) < GATE_W + 0.5 && Math.abs(bz - (CASTLE.z + CASTLE.h)) < 2 && Math.hypot(bx - p.x, bz - p.z) > 0.01) {
      toast('Shadow brambles block the gate.<br>They fear the Ember of the Wood.'); run.sealNag = 4;
    }
    if (!run.key && !run.shrineOpen && run.sealNag <= 0 && Math.hypot(p.x - SPOTS.shrine[0], p.z - SPOTS.shrine[1]) < 3.4) {
      toast('A purple seal covers the shrine.<br>The woodcutter had a key...'); run.sealNag = 5;
    }
    hero.moving = mag > 0.05;
    if (hero.moving) {
      hero.face += angDiff(Math.atan2(wx, wz), hero.face) * Math.min(1, 12 * dt);
      run.stepT -= dt * mag;
      if (run.stepT <= 0) { run.stepT = 0.34; sound(run.zone === 'castle' ? 'stepStone' : 'stepGrass'); }
      if (!document.body.classList.contains('moved')) document.body.classList.add('moved');
    }
    hero.x = p.x; hero.z = p.z;
    if (atkAnim <= 0 && run.rollT <= 0 && !(hero.ch.cur === hero.ch.acts.hit && hero.ch.cur.isRunning())) play(hero.ch, hero.moving ? 'run' : 'idle', false, hero.moving ? 0.6 + 0.5 * mag : 1);
  }
  const gy = groundH(hero.x, hero.z);
  hero.y = run.area === 'keep' && gy > hero.y + 0.02 && gy - hero.y < 1 ? hero.y + (gy - hero.y) * Math.min(1, dt * 16) : gy;   // glide up stairs
  // --- zones: castle or forest (music + ambience only change when you cross) ---
  const inCastle = Math.abs(hero.x - CASTLE.x) < CASTLE.h + 2 && hero.z < CASTLE.z + CASTLE.h + 1.5;
  if (run.area === 'keep') setZone(inThrone(hero.x, hero.z) ? 'throne' : 'keep');
  else setZone(inCastle ? 'castle' : 'forest');
  // the Keep gate (north wall of the courtyard) is open once you hold the Ember of the Walls
  // Latch: once Aldren has crossed the gate line (or is past it) the keep entry is PENDING and retried every frame until
  // the fade starts, so a slow frame, a shove back by the Warden, or a fade already running can't make it miss.
  const gz = CASTLE.z - CASTLE.h + 2.3, inGate = Math.abs(hero.x) < GATE_W + 0.5;
  if (run.area === 'realm' && run.ember2 && !hero.dying && inGate && (hero.z < gz || (hero.pz >= gz && hero.z < gz))) run.keepPending = true;
  hero.pz = hero.z;
  if (run.keepPending && run.area === 'realm') enterKeep();
  if (!run.enteredCastle && inCourtyard(hero.x, hero.z)) { run.enteredCastle = true; banner('The Courtyard Warden'); sound('roar'); }
  // --- light and darkness ---
  run.mist = mistAt(hero.x, hero.z);
  if (run.mist > 0.3) run.fuel = Math.max(0, run.fuel - dt * 1.1);   // the curse eats your torch only inside the mist
  if (run.fuel <= 0 && run.mist > 0.3) {
    run.darkT += dt;
    if (run.darkT > 4) { run.darkT = 0; toast('The cursed dark bites. Find oil, or get out of the mist!'); hurtHero(1); }
  } else run.darkT = 0;
  // --- enemies: only the nearest 6 think, the rest wait ---
  const alive = enemies.filter((e) => e.alive).map((e) => [e, Math.hypot(e.x - hero.x, e.z - hero.z)]).sort((a, b) => a[1] - b[1]);
  // 8 characters max: Aldren + Oathbound + thinking enemies (2 allies => 5 enemies think)
  const cap = Math.min(MAX_ACTIVE, MAX_CHARS - 1 - alliesOn());
  alive.forEach(([e, d], i) => { if (i < cap && d < 40) updateEnemy(e, dt); });
  tweenMs += dt * 1000; tweens.update(tweenMs);
  updateDeaths(dt); updateAllies(dt); updateHorde(dt); updateKeep(dt); updateBolts(dt);
  // --- pickups ---
  for (const p of pickups) {
    if (p.taken) continue;
    const pd = Math.hypot(p.x - hero.x, p.z - hero.z); p.g.visible = pd < 34; p.glow.visible = pd < 14;
    if (p.spin) p.g.rotation.y += dt * 2;
    p.g.position.y = p.y + Math.sin(run.time * 2.5 + p.x) * 0.08;
    p.glow.position.copy(p.g.position);
    if (p.auto && !hero.dying && pd < (p.kind.endsWith('key') ? 2.3 : 1.4)) takePickup(p);
  }
  // --- brambles wither after Ember 1 ---
  if (brambleT > 0 && brambles.visible) {
    brambleT += dt;
    const k = Math.max(0.001, 1 - brambleT / 1.5), a = brambles.instanceMatrix.array, b = brambles.userData.base;
    for (let i = 0; i < 26; i++) { _m.fromArray(b, i * 16); _m.scale(_v.set(k, k, k)); _m.toArray(a, i * 16); }
    brambles.instanceMatrix.needsUpdate = true;
    if (k <= 0.001) brambles.visible = false;
  }
  // --- boss music only in the Warden fight ---
  run.bossOn = enemies.some((e) => isBoss(e) && e.awake && e.alive);   // boss music: the Warden or the King
  const near = nearbyThing(), label = near ? near.label : null;
  if (label !== lastNear) { lastNear = label; updatePrompt(); $('ctxBtn').textContent = label ? label.toUpperCase() : ''; $('ctxBtn').style.display = label ? 'block' : 'none'; }
}

// ============================================================
// DRAWING: characters, lights, camera
// ============================================================
function placeChars(dt, realDt = dt) {   // dt is 0 during hit-stop; flashes still count down in real time
  const hc = hero.ch;
  hc.g.position.set(hero.x, hero.y, hero.z); hc.g.rotation.y = hero.face;
  hc.g.visible = !(run.inv > 0 && !hero.dying && Math.floor(run.inv * 12) % 2);
  hc.mixer.update(dt); if (hc.glow > 0) hc.glow -= realDt; tintChar(hc);
  if (hero.swordGlow) {                // sword glow rides the right hand, a bit up the blade
    if (hero.rhand) { hc.g.updateMatrixWorld(true); hero.rhand.getWorldPosition(_v); } else _v.set(hero.x, hero.y + 1, hero.z);
    hero.swordGlow.position.set(_v.x + Math.sin(hero.face) * 0.35, _v.y + 0.25, _v.z + Math.cos(hero.face) * 0.35);
    hero.swordGlow.visible = hc.g.visible;
  }
  for (const e of enemies) {
    const d = Math.hypot(e.x - hero.x, e.z - hero.z);
    // keep: draw skeletons within 24 m only, and the King's room only once its doors open (draw-call budget)
    const show = !e.removed && (run.area !== 'keep' ? d < 40 : (e.type === 'king' || e.minion) ? run.throneOpen || inThrone(hero.x, hero.z) : d < 24);
    e.ch.g.visible = show;
    if (!show) continue;
    const hover = e.type === 'shade' ? 0.35 + Math.sin(run.time * 2 + e.hx) * 0.15 : 0;
    e.ch.g.position.set(e.x, groundH(e.x, e.z) + hover - (e.sink || 0), e.z); e.ch.g.rotation.y = e.face;
    e.ch.mixer.update(dt); if (e.ch.glow > 0) e.ch.glow -= realDt; tintChar(e.ch);
    if (isBoss(e) && e.alive) {                      // camera right against a boss: see-through, so he can't fill the screen
      const cd = Math.hypot(e.x - camera.position.x, e.z - camera.position.z), o = cd < e.r + 1.4 ? Math.max(0.15, (cd - e.r * 0.5) / 2) : 1;
      if (o !== e.camO) { setOpacity(e.ch, o); e.camO = o; }
    }
  }
  for (const a of allies) {                          // the Oathbound
    if (!a.on) continue;
    a.ch.g.position.set(a.x, groundH(a.x, a.z) - (a.sink || 0), a.z); a.ch.g.rotation.y = a.face;
    a.ch.mixer.update(dt); if (a.ch.glow > 0) a.ch.glow -= realDt; tintChar(a.ch);
  }
}
function updateLights(dt) {
  const fl = 1 + (Math.sin(performance.now() / 70) * 0.5 + Math.sin(performance.now() / 23) * 0.5) * 0.08;
  if (heroTorch) { heroTorch.getWorldPosition(_hp); _hp.y += 0.5; } else _hp.set(hero.x, hero.y + 1.5, hero.z);
  torchFlame.position.copy(_hp); torchFlame.scale.setScalar((0.5 + run.fuel / MAX_FUEL * 0.35) * fl * (1 - 0.8 * camClose));
  torchFlame.visible = camClose < 0.95;                // camera jammed against a wall: no giant glow squares
  if (hero.swordGlow) hero.swordGlow.material.opacity = 0.6 * (1 - camClose);
  const R = lightR();
  torchLight.position.set(_hp.x - Math.cos(hero.face) * 0.5 + Math.sin(hero.face) * 0.3, _hp.y + 0.7, _hp.z + Math.sin(hero.face) * 0.5 + Math.cos(hero.face) * 0.3);
  torchLight.intensity = (7 + 15 * run.fuel / MAX_FUEL) * fl + (flareT > 0 ? 220 * flareT : 0);
  torchLight.distance = R * 1.9 + (flareT > 0 ? 10 : 0);
  if (flareT > 0) { flareT -= dt; flareSprite.visible = true; flareSprite.position.copy(_hp); flareSprite.scale.setScalar(4 + (0.5 - flareT) * 30); flareSprite.material.opacity = flareT * 2; }
  else flareSprite.visible = false;
  for (const g of glows) g.material.opacity = 0.75 + Math.sin(performance.now() / 90 + g.position.x) * 0.2;
  if (run.area !== 'keep') gateLight.intensity = 22 * fl;   // (in the keep, updateKeep runs this light)
  // blue hour outside, dark purple inside a cursed mist zone
  mistK += ((run.mist || 0) - mistK) * Math.min(1, dt * 2.5);
  const fuelF = run.fuel / MAX_FUEL;
  if (run.area === 'keep' && LT.keep) { keepLights(dt); return; }
  hemi.color.setHex(LOOK.hemiSky); hemi.groundColor.setHex(LOOK.hemiGround);
  scene.fog.color.copy(_haze).lerp(_mist, mistK); scene.background.copy(scene.fog.color);
  scene.fog.near = LOOK.fogNear + (LOOK.curseNear - LOOK.fogNear) * mistK;
  scene.fog.far = LOOK.fogFar + (LOOK.curseFar * (0.6 + 0.4 * fuelF) - LOOK.fogFar) * mistK;
  const dimK = 1 + (LOOK.dim - 1) * mistK;
  hemi.intensity = LOOK.hemiI * dimK; moon.intensity = LOOK.sunI * dimK;
  sky.material.color.setRGB(1 - 0.85 * mistK, 1 - 0.9 * mistK, 1 - 0.8 * mistK);
  torchLight.intensity *= 0.5 + (LOOK.torchBoost - 0.5) * mistK; torchLight.distance = R * (1.2 + 0.3 * mistK);
  try { if (window.Ambience && typeof Ambience.setMist === 'function') Ambience.setMist(mistK); } catch (e) {}
  // moon shadows: a small box that follows the knight
  sh.follow(_v.set(hero.x, hero.y, hero.z));
  backdrop.position.set(hero.x, 0, hero.z);
  for (const hz of hazeRings) hz.position.y = hero.y + hz.userData.y0;   // Game Artist's 2 haze rings ride at Aldren's height (castle hill)
  if (run.area !== 'keep') updateGrass();
}
// Keep lighting (Game Artist's LIGHTS.keep / LIGHTS.throne, blending to LIGHTS.snuffed in the mist and the King's last phase)
let throneK = 0; const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const mixN = (a, b, k) => a + (b - a) * k;
function keepLights(dt) {
  throneK += ((inThrone(hero.x, hero.z) ? 1 : 0) - throneK) * Math.min(1, dt * 2);
  const A = LT.keep, T = LT.throne || A, S = LT.snuffed, k = mistK;
  _c1.setHex(A.fog.color).lerp(_c2.setHex(T.fog.color), throneK).lerp(_c2.setHex(S.fog.color), k);
  scene.fog.color.copy(_c1); scene.background.copy(_c1);
  scene.fog.near = mixN(mixN(A.fog.near, T.fog.near, throneK), S.fog.near, k);
  scene.fog.far = mixN(mixN(A.fog.far, T.fog.far, throneK), S.fog.far * (0.6 + 0.4 * run.fuel / MAX_FUEL), k);
  hemi.color.setHex(A.hemi.sky).lerp(_c2.setHex(T.hemi.sky), throneK); hemi.groundColor.setHex(A.hemi.ground).lerp(_c2.setHex(T.hemi.ground), throneK);
  hemi.intensity = mixN(mixN(A.hemi.intensity, T.hemi.intensity, throneK), S.hemi, k);
  moon.intensity = mixN(mixN(A.sky, T.sky, throneK), S.sky, k);
  sky.material.color.setRGB(0.45 * (1 - k), 0.45 * (1 - k), 0.6 * (1 - k));
  torchLight.intensity *= 0.9 + (LOOK.torchBoost - 0.5) * k;   // the torch matters more as it gets dark
  torchLight.distance = lightR() * (1.3 + 0.3 * k);
  try { if (window.Ambience && typeof Ambience.setMist === 'function') Ambience.setMist(k); } catch (e) {}
  sh.follow(_v.set(hero.x, hero.y, hero.z));
}
const _t = new THREE.Vector3(), _dir = new THREE.Vector3(), _haze = new THREE.Color(LOOK.haze), _mist = new THREE.Color(LOOK.curse);
let mistK = 0, camClose = 0;
function updateCamera(dt) {
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const shoulder = 0.55 * (1 - camClose);                  // over-the-shoulder offset; centered when jammed against a wall
  _t.set(hero.x + rx * shoulder, hero.y + 1.45, hero.z + rz * shoulder);
  _dir.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let want = cam.dist;
  if (run.area === 'keep' && K.cam) {                // keep: one BVH ray from Aldren's shoulder back to the camera
    _ray.set(_t, _dir); _ray.far = cam.dist; _hits.length = 0; K.cam.raycast(_ray, _hits);
    if (_hits.length) want = Math.max(0.8, _hits[0].distance - 0.25);
    _ray.far = 30;
  } else for (let i = 1; i <= 16; i++) {                      // pull in when a wall is behind the knight
    const s = cam.dist * i / 16, x = _t.x + _dir.x * s, y = _t.y + _dir.y * s, z = _t.z + _dir.z * s;
    if (camSolid(x, y, z) || y < groundH(x, z) + 0.3) { want = Math.max(0.8, s - cam.dist / 16 - 0.2); break; }
  }
  // Big bosses are solid for the camera too: stop the camera ray at a circle round them (the red-King-on-screen bug)
  for (const e of enemies) if (isBoss(e) && e.alive && !e.removed && e.ch.g.visible) {
    const R = e.r + 0.3, ox = _t.x - e.x, oz = _t.z - e.z, a = _dir.x * _dir.x + _dir.z * _dir.z, b = 2 * (ox * _dir.x + oz * _dir.z), c = ox * ox + oz * oz - R * R, disc = b * b - 4 * a * c;
    if (a > 1e-6 && c > 0 && disc > 0) { const hit = (-b - Math.sqrt(disc)) / (2 * a); if (hit > 0 && hit < want) want = Math.max(2, hit - 0.2); }   // never closer than 2 m: if he's that close he turns see-through instead
  }
  cam.cur = want < cam.cur ? want : cam.cur + (want - cam.cur) * Math.min(1, dt * 3);
  camera.position.copy(_t).addScaledVector(_dir, cam.cur);
  camera.position.y = Math.max(camera.position.y, groundH(camera.position.x, camera.position.z) + 0.4);
  if (shake > 0) {                                   // camera shake (the Warden's fall), fading out
    const k = shake * 0.12; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k;
    shake = Math.max(0, shake - dt * 0.8);
  }
  // Playtester bug: back to a courtyard wall pulls the camera to 0.8 m. Then lift it up and look down more,
  // so Aldren stays in frame (and updateLights shrinks the torch glow that would fill the screen).
  if (kickT > 0) { kickT -= dt; camera.position.addScaledVector(_dir, -0.15); }   // 40 ms kill kick toward Aldren
  camClose = smooth01((1.2 - cam.cur) / 0.4);          // 0 at 1.2 m or more, 1 at 0.8 m
  if (camClose > 0) camera.position.y += camClose * 0.9;
  camera.lookAt(_t.x, _t.y - camClose * 0.45, _t.z);
  sky.position.copy(camera.position);
  moonSprite.position.set(camera.position.x - 110, camera.position.y + 150, camera.position.z - 330);
}
function turnCamera(dx, dy) {
  if (lockT) {                                       // locked on: a flick left/right switches target instead of turning
    lockAcc += dx; if (Math.abs(lockAcc) > 0.35) { switchTarget(Math.sign(lockAcc)); lockAcc = 0; }
    cam.pitch = Math.max(-0.15, Math.min(1.05, cam.pitch + dy)); return;
  }
  cam.yaw -= dx; cam.pitch = Math.max(-0.15, Math.min(1.05, cam.pitch + dy));
}

// ============================================================
// HUD
// ============================================================
const arrowEl = $('arrow');
const emberCount = () => (run.ember1 ? 1 : 0) + (run.ember2 ? 1 : 0) + (run.ember3 ? 1 : 0);   // the 3 Embers of the realm
function updateHUD() {
  $('hearts').textContent = '♥'.repeat(Math.max(0, run.hp)) + '♡'.repeat(Math.max(0, run.maxHp - run.hp));
  $('fuel').style.width = (run.fuel / MAX_FUEL * 100).toFixed(1) + '%';
  $('embers').textContent = `Embers ${emberCount()}/3 · Shards ${run.shards}`;
  updateCombatHUD();
  const [text, tgt] = objective();
  if ($('objective').textContent !== text) $('objective').textContent = text;
  if (tgt) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), tx = tgt[0] - hero.x, tz = tgt[1] - hero.z;
    const rel = Math.atan2(fx * tz - fz * tx, fx * tx + fz * tz);
    arrowEl.style.transform = `rotate(${rel.toFixed(3)}rad)`; arrowEl.dataset.rel = rel.toFixed(3);
    $('dist').textContent = Math.round(Math.hypot(tx, tz)) + ' m';
    $('compass').style.visibility = 'visible';
  } else $('compass').style.visibility = 'hidden';
  const w = enemies.find((e) => isBoss(e) && e.awake && e.alive && (e.type === 'king') === (run.area === 'keep'));   // the Warden or the Hollow King
  $('bossBar').style.display = w ? 'block' : 'none';
  if (w) { $('bossHp').style.width = (w.hp / w.max * 100) + '%'; const n = w.type === 'king' ? 'THE HOLLOW KING' : 'THE COURTYARD WARDEN'; if ($('bossName').textContent !== n) $('bossName').textContent = n; }
  $('flareBtn').classList.toggle('cooling', run.flareCd > 0 || run.fuel < 12);
  $('wardBtn').classList.toggle('cooling', run.windedT > 0); $('rollBtn').classList.toggle('cooling', run.sta < STA_ROLL || run.windedT > 0); $('lockBtn').classList.toggle('on', !!lockT);
  // SUMMON button: a ring fills up during the 20 s cooldown, and it dims when you can't summon
  const sb = $('sumBtn'), n = alliesOn(), cdTxt = run.summonCd > 0 ? Math.ceil(run.summonCd) + 's' : 'SUMMON';
  sb.style.setProperty('--p', (1 - run.summonCd / SUMMON_CD).toFixed(3));
  if (sb.textContent !== cdTxt) sb.textContent = cdTxt;
  sb.classList.toggle('cooling', run.summonCd > 0 || run.fuel < SUMMON_COST || n >= MAX_ALLIES);
  const ai = `Oathbound ${n}/${MAX_ALLIES}${run.summonCd > 0 ? ' · ' + Math.ceil(run.summonCd) + 's' : ''}`;
  if ($('allyInfo').textContent !== ai) $('allyInfo').textContent = ai;
  // HORDE button: a green ring fills during the 60 s cooldown, shows the charges, dims with no charge
  const hb = $('hordeBtn'), hTxt = horde.on ? Math.ceil(Math.max(0, horde.t)) + 's' : run.hordeCd > 0 ? Math.ceil(run.hordeCd) + 's' : 'HORDE';
  hb.style.setProperty('--p', (1 - run.hordeCd / HORDE_CD).toFixed(3));
  if ($('hordeTxt').textContent !== hTxt) $('hordeTxt').textContent = hTxt;
  if ($('hordeN').textContent !== 'x' + run.hordeCharges) $('hordeN').textContent = 'x' + run.hordeCharges;
  hb.classList.toggle('cooling', !sw || run.hordeCharges < 1 || run.hordeCd > 0 || horde.on);
  const hi = `Horde ${run.hordeCharges}${horde.on ? ' · ' + gobs.filter((g) => g.alive).length + ' goblins' : run.hordeCd > 0 ? ' · ' + Math.ceil(run.hordeCd) + 's' : ''}`;
  if ($('hordeInfo').textContent !== hi) $('hordeInfo').textContent = hi;
  const f = $('flash');
  if (fadeT > 0) { f.style.background = '#000'; f.style.opacity = (1 - Math.abs(fadeT - 0.6) / 0.6).toFixed(2); }
  else if (hitFlash > 0) { f.style.background = '#a00'; f.style.opacity = (hitFlash * 1.2).toFixed(2); }
  else if (flareT > 0) { f.style.background = '#ffd9a0'; f.style.opacity = (flareT * 0.6).toFixed(2); }
  else f.style.opacity = 0;
}

// ============================================================
// INPUT: touch, keyboard + mouse, game controller
// ============================================================
let inputMode = 'touch';                  // touch | keys | pad (changes prompts and buttons)
function setMode(m) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.classList.toggle('pad', m === 'pad');
  if (m === 'touch') document.body.classList.add('touch');
  updatePrompt(); updateSoundTip();
}
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
else inputMode = 'keys';
const keys = {};
let padMove = [0, 0], padLook = [0, 0];
function moveInput() {
  let x = 0, y = 0;
  if (keys.a) x--; if (keys.d) x++;
  if (keys.w) y++; if (keys.s) y--;
  if (x || y) return [x, y];
  if (joy) return joyVec();
  return padMove;
}
// touch: joystick on the left half, drag on the right half to look around
let joy = null, lookTouch = null;
const TOUCH_LOOK = 0.007, MOUSE_LOOK = 0.0028;
function joyVec() {
  const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
  if (d < 6) return [0, 0];
  const k = Math.min(1, d / 44) / d;
  return [dx * k, -dy * k];
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
  if (e.pointerType === 'mouse') {
    if (state === 'play' && touchEl.requestPointerLock) { try { const r = touchEl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} }
    if (state === 'play' && e.button === 0 && document.pointerLockElement === touchEl) attack();
    return;
  }
  setMode('touch');
  const r = gameEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < r.width / 2 && !joy) joy = { id: e.pointerId, ox: x, oy: y, x, y };
  else if (x >= r.width / 2 && !lookTouch) lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  else return;
  try { touchEl.setPointerCapture(e.pointerId); } catch (err) {}
  showJoy();
});
touchEl.addEventListener('pointermove', (e) => {
  if (joy && e.pointerId === joy.id) {
    const r = gameEl.getBoundingClientRect();
    joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; showJoy();
  } else if (lookTouch && e.pointerId === lookTouch.id) {
    if (state === 'play') turnCamera((e.clientX - lookTouch.x) * TOUCH_LOOK, (e.clientY - lookTouch.y) * TOUCH_LOOK * 0.7);
    lookTouch.x = e.clientX; lookTouch.y = e.clientY;
  }
});
const endTouch = (e) => {
  if (joy && e.pointerId === joy.id) { joy = null; showJoy(); }
  if (lookTouch && e.pointerId === lookTouch.id) lookTouch = null;
};
touchEl.addEventListener('pointerup', endTouch);
touchEl.addEventListener('pointercancel', endTouch);
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === touchEl && state === 'play') turnCamera(e.movementX * MOUSE_LOOK, e.movementY * MOUSE_LOOK);
});
const tapBtn = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setMode('touch'); unlockAudio(); fn(); });
tapBtn('atkBtn', attack); tapBtn('flareBtn', flare); tapBtn('wardBtn', ward); tapBtn('ctxBtn', interact); tapBtn('sumBtn', summon); tapBtn('hordeBtn', summonHorde); tapBtn('rollBtn', roll); tapBtn('lockBtn', toggleLock);
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
  if (a === 'retry' && state === 'lose') retryCheckpoint();
}));
$('title').addEventListener('click', () => { if (state === 'title') startIntro(); });
$('story').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' && state === 'story') closeStory(); });

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
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
  else if (state === 'win' || state === 'lose') { if (k === 'enter' || k === ' ') { if (!(state === 'lose' && retryCheckpoint())) tryRestart(); } else if (k === 'r') tryRestart(); }
  else if (state === 'play') {
    if (k === 'j') attack();
    else if (k === ' ') roll();                      // Space: roll (dodge)
    else if (k === 'tab') toggleLock();              // Tab: lock on
    else if (k === 'k') flare();
    else if (k === 'l' || k === 'shift') ward();     // L / Shift: block (press just before a hit = parry)
    else if (k === 'e') interact();
    else if (k === 'q') summon();                    // Q: raise an Oathbound
    else if (k === 'h') summonHorde();               // H: horn for the Lanternkin (E is Interact)
    else if (k === 'escape' || k === 'p' || k === 'i') togglePause();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Game controller (standard layout). A press counts only on the frame a button goes from up to down.
let padPrev = {}, padStyle = 'ps';
window.addEventListener('gamepadconnected', (e) => {
  padStyle = /xbox|xinput/i.test(e.gamepad.id) ? 'xbox' : 'ps';
  toast('Controller connected'); sound('blip'); setMode('pad'); updatePrompt();
});
window.addEventListener('gamepaddisconnected', () => {
  toast('Controller disconnected'); padMove = [0, 0]; padLook = [0, 0];
  if (inputMode === 'pad') setMode('touch');
});
function pollGamepad() {
  const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
  if (!pad) { padMove = [0, 0]; padLook = [0, 0]; return; }
  const style = /xbox|xinput/i.test(pad.id) ? 'xbox' : 'ps';
  if (style !== padStyle) { padStyle = style; updatePrompt(); }
  const b = (i) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
  let ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
  if (Math.hypot(ax, ay) < DEADZONE) ax = ay = 0;
  if (Math.hypot(rx, ry) < DEADZONE) rx = ry = 0;
  const dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0), dy = (b(12) ? 1 : 0) - (b(13) ? 1 : 0);
  padMove = dx || dy ? [dx, dy] : [ax, -ay];           // stick up = forward
  padLook = lockT ? [0, ry] : [rx, ry];                // locked on: the stick flicks between targets
  if (lockT && Math.abs(rx) > 0.7 && !padPrev.flick) switchTarget(Math.sign(rx));
  const flick = Math.abs(rx) > 0.7;
  const now = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, x: b(0), o: b(1), ward: b(2), r2: b(7), r3: b(11),
    tri: b(3), opt: b(9), sum: b(4), horde: b(5), flick, any: pad.buttons.some((btn) => btn && btn.pressed) };
  const pressed = (k) => now[k] && !padPrev[k];
  if (now.any || ax || ay || rx || ry) setMode('pad');
  if (state === 'title') { if (pressed('any')) startIntro(); }
  else if (state === 'intro') { if (pressed('opt')) newGame(); else if (pressed('x')) nextIntro(); }
  else if (state === 'story') { if (pressed('x') || pressed('o') || pressed('tri')) closeStory(); }
  else if (state === 'paused') {
    if (pressed('up')) moveSel(-1); if (pressed('down')) moveSel(1);
    if (pressed('x')) useSel(); if (pressed('opt') || pressed('o')) togglePause();
  }
  else if (state === 'win' || state === 'lose') { if (pressed('x')) { if (!(state === 'lose' && retryCheckpoint())) tryRestart(); } else if (pressed('opt')) tryRestart(); }
  else if (state === 'play') {
    if (pressed('x')) attack(); if (pressed('o')) roll(); if (pressed('ward')) ward(); if (pressed('r2')) flare(); if (pressed('r3')) toggleLock();
    if (pressed('tri')) interact(); if (pressed('opt')) togglePause(); if (pressed('sum')) summon(); if (pressed('horde')) summonHorde();
  }
  padPrev = now;                                     // remember for next frame (ALWAYS last!)
}
let rumbleOn = true;
try { rumbleOn = localStorage.getItem('gravelight-realm.rumble') !== 'off'; } catch (e) {}
function rumble(ms, strength) {                      // DualSense / Xbox vibration (pattern from web.dev + MDN, see CREDITS.md)
  if (!rumbleOn) return;
  try {
    const pad = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((p) => p && p.connected);
    const act = pad && pad.vibrationActuator;       // Safari / iPhone: not there, so nothing happens
    if (act && act.playEffect && (!act.effects || act.effects.includes('dual-rumble')))
      act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: strength, strongMagnitude: strength }).catch(() => {});
  } catch (e) { /* no rumble, no problem */ }
}

// ============================================================
// BAG (the pause screen)
// ============================================================
let invSel = 0, invRows = [];
const bars = (v) => '▮'.repeat(Math.round(v * 5)) + '▯'.repeat(5 - Math.round(v * 5));
const stepVol = (v) => (v >= 0.95 ? 0.2 : Math.round((v + 0.2) * 10) / 10);
function renderInventory() {
  const M = window.Music, X = window.SFX, A = window.Ambience, n = emberCount();
  invRows = [
    { html: `<span class="quest">Embers ${n}/3</span>`, info: 'One Ember waits in the forest shrine, one with the Courtyard Warden, one in the vault of the Keep. Bring all three to the altar.' },
    ...(run.key ? [{ html: `<span class="quest">${ITEMS.woodkey.name}</span> (quest)`, info: ITEMS.woodkey.flavor }] : []),
    ...(run.keepKey ? [{ html: `<span class="quest">${ITEMS.keepkey.name}</span> (quest)`, info: ITEMS.keepkey.flavor }] : []),
    { html: `Sword: ${run.sword === 'gravesteel' ? `<span class="rare">${ITEMS.gravesteel.name}</span>` : '<span class="common">Rusted Sword</span>'}`, info: run.sword === 'gravesteel' ? ITEMS.gravesteel.flavor : 'Old, but it still cuts. 3 swings in a row: the third hits twice as hard.' },
    { html: `Armor: ${run.armor ? `<span class="uncommon">${ITEMS.chain.name}</span>` : 'None'}`, info: run.armor ? ITEMS.chain.flavor : 'Nothing equipped yet.' },
    { html: `Health Potions x${run.potions} (use)`, info: ITEMS.potion.flavor, use: () => drinkPotion() || toast(run.potions ? 'Already at full health.' : 'No potions.') },
    { html: `Torch Oil x${run.oils} (use)`, info: ITEMS.oil.flavor, use: () => pourOil() || toast(run.oils ? 'Your light is already full.' : 'No oil.') },
    { html: `<span style="color:#d4af37">${run.gold} gold</span>`, info: ITEMS.gold.flavor },
    { html: `Music: ${M && M.enabled ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn the music on or off.', use: () => { if (M) try { M.toggle(!M.enabled); } catch (e) {} } },
    { html: `Music Volume: ${bars(M ? M.volume : 0.5)}`, info: 'Tap or press ✕ / Enter to change the music volume.', use: () => { if (M) try { M.setVolume(stepVol(M.volume)); } catch (e) {} } },
    { html: `Sound FX: ${X && X.enabled ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn sound effects on or off.', use: () => { if (X) try { X.toggle(!X.enabled); } catch (e) {} } },
    { html: `FX Volume: ${bars(X ? X.volume : 1)}`, info: 'Tap or press ✕ / Enter to change the sound effects volume.', use: () => { if (X) try { X.setVolume(stepVol(X.volume)); sound('blip'); } catch (e) {} } },
    { html: `Ambience: ${A && A.enabled ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter to turn the forest and castle sounds on or off.', use: () => { if (A) try { A.toggle(!A.enabled); } catch (e) {} } },
    { html: `Pixels: ${PIXEL_SIZES[pixelSize].name}`, info: 'Tap or press ✕ / Enter: Soft = the default look, L / M / S = chunky pixel looks, Off = smooth.', use: cyclePixelSize },
    { html: `Rumble: ${rumbleOn ? 'On' : 'Off'}`, info: 'Tap or press ✕ / Enter: controller vibration on or off.', use: () => { rumbleOn = !rumbleOn; try { localStorage.setItem('gravelight-realm.rumble', rumbleOn ? 'on' : 'off'); } catch (e) {} rumble(150, 0.8); } },
    { html: `Ambience Volume: ${bars(A ? A.volume : 0.5)}`, info: 'Tap or press ✕ / Enter to change the forest and castle sounds volume.', use: () => { if (A) try { A.setVolume(stepVol(A.volume)); } catch (e) {} } },
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
// PROMPTS (bottom right), TOASTS, BANNERS
// ============================================================
function updatePrompt() {
  const p = $('prompt');
  if (state !== 'play') { p.textContent = ''; return; }
  const act = lastNear ? lastNear.toLowerCase() : '';
  if (inputMode === 'pad') {
    const L = padStyle === 'xbox' ? ['A', 'B', 'X', 'Y', 'Menu', 'R stick', 'LB', 'RB', 'RT', 'R3'] : ['✕', '○', '□', '△', 'Options', 'R stick', 'L1', 'R1', 'R2', 'R3'];
    p.innerHTML = `${act ? `<b>${L[3]} ${act}</b><br>` : ''}${L[0]} attack · ${L[1]} roll · ${L[2]} block · ${L[8]} flare · ${L[9]} lock<br>${L[6]} summon · ${L[7]} horde · ${L[5]} look · ${L[4]} bag`;
  } else if (inputMode === 'keys' && !matchMedia('(pointer: coarse)').matches) {
    p.innerHTML = `${act ? `<b>E ${act}</b><br>` : ''}WASD move · mouse/arrows look<br>J/click attack · Space roll · L block · Tab lock<br>K flare · Q summon · H horde · I bag`;
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
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('paused'); });

// ============================================================
// SOUND (Audio Designer's sfx.js, music.js, ambience.js)
// ============================================================
// iPhone: sound only unlocks inside a real tap or key press (not a controller button),
// and the silent switch mutes Web Audio unless the page is a "playback" app.
let audio = null, silentOK = false;
const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (!audio) return;
  if (audio.state !== 'running') audio.resume().catch(() => {});
  try { const s = audio.createBufferSource(); s.buffer = audio.createBuffer(1, 1, 22050); s.connect(audio.destination); s.start(0); } catch (e) {}
  if (!silentOK) {
    try {
      const el = document.createElement('audio'); el.src = SILENT_WAV; el.loop = true; el.setAttribute('playsinline', '');
      el.play().then(() => { silentOK = true; }).catch(() => {});
    } catch (e) {}
  }
  if (state !== 'title') { try { if (window.Music) Music.start(audio); } catch (e) {} try { if (window.Ambience) Ambience.start(audio); } catch (e) {} }
  audio.onstatechange = updateSoundTip;
  updateSoundTip();
}
['touchend', 'click', 'keydown'].forEach((t) => window.addEventListener(t, unlockAudio, { capture: true, passive: true }));
function updateSoundTip() {
  const locked = !audio || audio.state !== 'running';
  $('soundTip').hidden = !(locked && inputMode === 'pad' && state !== 'title');
}
function sound(name) {
  const X = window.SFX;
  if (!X || !audio) return;
  try { X.play(audio, name); } catch (e) {}
}
function startMusic() {                        // runs inside the Start tap (iPhone rule)
  unlockAudio();
  if (!audio) return;
  try { if (window.Music) Music.start(audio); } catch (e) {}
  try { if (window.Ambience) Ambience.start(audio); } catch (e) {}
}
// Danger music ONLY in the Warden fight
function updateDanger() {
  if (!window.Music) return;
  const boss = state === 'play' && run.bossOn;
  try { if (typeof Music.setBoss === 'function') Music.setBoss(boss); else if (typeof Music.setDanger === 'function') Music.setDanger(boss ? 1 : 0); } catch (e) {}
}

// ============================================================
// MAIN LOOP
// ============================================================
let ready = false, last = performance.now(), fps = 60, fpsAcc = 0, fpsN = 0, lowT = 0;
function resize() {
  const w = gameEl.clientWidth, h = gameEl.clientHeight;
  renderer.setSize(w, h, false); px.setSize(); camera.aspect = w / h;
  camera.fov = w < h ? 72 : 60; camera.updateProjectionMatrix();
  cam.dist = w < h ? 4.8 : 3.7;              // portrait phones: a bit further back so Aldren doesn't fill the screen
}
window.addEventListener('resize', resize);
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.3, (now - last) / 1000), dt = Math.min(0.05, rdt); last = now;   // rdt: real time (fades), dt: game time
  pollGamepad();
  if (!ready) return;
  if (document.hidden) return;
  // Hit-stop: for 60 ms after a sword hit the world gets dt = 0 (frozen), but the camera and screen keep drawing
  let gdt = dt;
  if (fadeT > 0) { const was = fadeT; fadeT -= rdt;   // real time, so slow frames can't stretch the fade
    if (was > 0.6 && fadeT <= 0.6 && fadeFn) { const f = fadeFn; fadeFn = null; f(); } }   // fade: act while black
  if (hitStop > 0) { hitStop -= dt; gdt = 0; }
  if (slowT > 0) { slowT -= dt; gdt *= 0.3; }         // slow motion (last kill of a room, bosses)
  if (state === 'play') {
    if (padLook[0] || padLook[1]) turnCamera(padLook[0] * 2.6 * dt, padLook[1] * 1.6 * dt);
    const kl = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0), ku = (keys.arrowdown ? 1 : 0) - (keys.arrowup ? 1 : 0);
    if (kl || ku) turnCamera(kl * 2.4 * dt, ku * 1.4 * dt);
    updatePlay(gdt);
  }
  hitFlash = Math.max(0, hitFlash - dt);
  placeChars(state === 'play' || state === 'title' ? gdt : 0, dt);
  updateFX(gdt);
  updateLights(dt); updateCamera(dt);
  if (state === 'play') updateHUD();
  updateDanger();
  renderer.info.reset();
  px.render(scene, camera);
  // frames per second (and lower the resolution if the phone is struggling)
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) {
    fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (DEBUG) { $('fps').hidden = false; $('fps').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · x${pixelRatio}`; }
  }
  if (state === 'play' && fps < 27) { lowT += dt; if (lowT > 2 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); lowT = 0; } }
  else lowT = 0;
}

// Low-poly look: flat shading and nearest-neighbor textures on everything
function flatten() {
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(m)) continue; seen.add(m);
      if ('flatShading' in m && !m.isPointsMaterial && !m.isSpriteMaterial) { m.flatShading = true; m.needsUpdate = true; }
      for (const k of ['map', 'emissiveMap']) if (m[k]) { m[k].magFilter = THREE.NearestFilter; m[k].minFilter = THREE.NearestMipmapNearestFilter; m[k].needsUpdate = true; }
    }
  });
}
// ---------- Start! ----------
async function boot() {
  if (!ART) { $('titleNote').textContent = 'Could not load the art file (assets/realm-art.js).'; return; }
  resize(); requestAnimationFrame(frame);
  try {
    await loadAll((f) => { $('loading').textContent = `Loading the realm... ${Math.round(f * 100)}%`; });
  } catch (e) {
    console.warn(e); $('titleNote').textContent = 'Could not load the 3D models. Check your internet and reload.'; return;
  }
  collect(realmG, buildWorld); collect(keepG, buildKeep);   // slice 1 and slice 2 each in their own group (only one is shown)
  keepG.visible = true; try { renderer.compile(scene, camera); } catch (e) {} keepG.visible = false;   // build the keep's shaders now, not mid-fade
  GATE_LIGHT0.copy(gateLight.position);
  makeHero(); makeAllies(); makeHorde(); makeEnemies(); makePickups();
  flatten();
  hero.x = SPOTS.start[0]; hero.z = SPOTS.start[1]; hero.y = groundH(hero.x, hero.z);
  cam.yaw = 0; cam.pitch = 0.12;
  ready = true;
  $('loading').textContent = '';
  const sb = $('startBtn'); sb.disabled = false; sb.textContent = 'Start';
}
boot();

// Test hooks (so automated tests can peek inside). Harmless for players.
window.G = {
  run, hero, cam, SPOTS, CASTLE, get enemies() { return enemies; }, get pickups() { return pickups; }, get state() { return state; }, get fps() { return fps; },
  drawCalls: () => renderer.info.render.calls, tris: () => renderer.info.render.triangles, get loaded() { return ready; }, get pixelRatio() { return pixelRatio; },
  get bossOn() { return run.bossOn; }, get zone() { return run.zone; }, newGame, setState, attack, flare, ward, interact, objective, groundH, isFree,
  inCourtyard, hurtHero, hurtEnemy, killEnemy, tryRestart, nearbyThing, updateSoundTip, lightR, camera, get audio() { return audio; }, get inputMode() { return inputMode; },
  scene, summon, retryCheckpoint, resultsText, dismissAllies, get allies() { return allies; }, get hitStop() { return hitStop; }, get fxLive() { return fxLive; },
  get camDist() { return cam.cur; }, get pixelSize() { return PIXEL_SIZES[pixelSize].name; }, px, cyclePixelSize, grass, get pxTarget() { return px.target; }, get mist() { return mistK; }, camSolid, get fogFar() { return scene.fog.far; },
  summonHorde, horde, gobs, get sw() { return sw; }, spawnEnemy,   // Lanternkin test hooks
  enterKeep, applyArea, relightAltar, openVault, takeEmber3, THR, KZ, realmG, keepG, K, get fadeT() { return fadeT; }, get wave() { return wave; }, inThrone, emberCount, bolts, get slowT() { return slowT; }, keepH, closeStory, ENEMY_DEF, raiseMinion, charCount, get wizards() { return enemies.filter((e) => e.type === 'wizard'); },   // slice 2
  // Part 3 combat hooks
  get stamina() { return run.sta; }, get winded() { return run.windedT > 0; }, get tokens() { return [...tokens]; }, get tokensUsed() { return tokens.size; },
  get parryWindow() { return parryWin(); }, get lockTarget() { return lockT; }, get hearts() { return run.hp; }, get maxHearts() { return run.maxHp; },
  poise: (e) => e.poiseV, forceAttack, roll, block: ward, toggleLock, switchTarget, get rollT() { return run.rollT; }, get guardBroken() { return run.guardT > 0; }, get guardBreaks() { return run.guardBreaks || 0; }, SLAM_R, get glintsOn() { return enemies.filter((e) => e.glint && e.glint.visible).length; }, get rings() { return rings; }, rumbleOn: () => rumbleOn,
};
