// Gravelight: Realm art direction, by Game Artist.
// No THREE import needed: this file only holds data and draws small canvas textures.
// game.js turns the canvases into THREE.CanvasTexture and calls RealmArt.tint() on loaded models.
(function () {
  // The one palette every model is pulled toward, so the different packs look like one world.
  // Look: blue hour (the player's reference, 2026-09-28). Bright saturated blue sky, blue haze, green hills.
  const PAL = {
    skyTop: 0x1846b0,    // deep saturated blue at the top of the sky
    haze: 0x7aa2dc,      // horizon haze (fog color and sky bottom, so far things melt into it)
    sky: 0xcfdcff,       // cool blue-hour key light (directional)
    moon: 0xcfdcff,      // kept for old code: same as sky
    moonSky: 0x9cbcff,   // hemisphere sky color
    ground: 0x3a5a2c,    // hemisphere ground color (green bounce from the grass)
    fog: 0x7aa2dc,       // = haze
    grass: 0x4f8a36,     // lush grass
    torch: 0xff9a3c,     // torch orange (point light on the knight)
    ember: 0xffd36b,     // Ember glow
    gold: 0xb08a2e,      // dull castle gold
    armor: 0x3a5ad8,     // Aldren's blue plate
    cape: 0xd01e2e,      // Aldren's red cape and plume
    shadow: 0x2b1044,    // shade purple
    curse: 0x2a1240,     // cursed mist fog (dark purple)
  };
  // Suggested lights (tuned for the palette above).
  const LIGHTS = {
    hemi: { sky: PAL.moonSky, ground: PAL.ground, intensity: 1.15 },
    sky: { color: PAL.sky, intensity: 1.7, dir: [-0.5, 0.8, -0.45] }, // the only shadow caster; keep its shadow box tight around the player
    torch: { color: PAL.torch, intensity: 2.4, distance: 9, decay: 1.6, flicker: 0.18 },
    fog: { color: PAL.fog, near: 18, far: 95 },   // far castle spires fade into the haze
    exposure: 1.05,         // only matters with tone mapping on (v3 style uses ACES)
    // Cursed mist zones (camp, shrine clearing, courtyard). Blend toward these by k = 0..1 as the player walks in:
    // fog.color.lerp(curse.fog), near/far lerp, hemi and sky intensity *= lerp(1, dim, k). Torch goes up to curse.torch, so it becomes the only real light.
    curse: { fog: PAL.curse, near: 1.5, far: 13, dim: 0.18, torch: 3.2 },
  };
  LIGHTS.moon = LIGHTS.sky; // old name still works
  // Slice 2 interiors. Blend to these when the keep loads (no sun inside: turn the sky light down to 'sky', keep its shadow for the torch area).
  // keep = hall, ramparts and vault (cold stone, warm braziers). throne = the Hollow King's hall. snuffed = phase 3 (braziers out, only the torch lights him).
  LIGHTS.keep = { hemi: { sky: 0x7a8ac8, ground: 0x2a2432, intensity: 0.7 }, sky: 0.35, fog: { color: 0x2a3050, near: 8, far: 45 }, torch: 3.0,
    brazier: { color: 0xff8a3a, intensity: 2.2, distance: 10, decay: 1.7, flicker: 0.25 } };
  LIGHTS.throne = { hemi: { sky: 0x8a78c8, ground: 0x2a1a30, intensity: 0.6 }, sky: 0.25, fog: { color: 0x241838, near: 10, far: 42 }, torch: 3.2,
    brazier: LIGHTS.keep.brazier, altar: { color: 0xffd36b, intensity: 3, distance: 12, decay: 1.5 } };
  LIGHTS.snuffed = { hemi: 0.14, sky: 0.05, fog: { color: 0x0e0818, near: 1.5, far: 14 }, torch: 3.6 };
  // Every model: file, target height in world units (1 unit = 1 m, the hero is 1.8), and a color tint.
  // fitMax uses the longest side instead of height (for flat things like the key).
  // Call RealmArt.fit(THREE, root, name) to scale it to that height with its feet on y = 0.
  // tint multiplies each material color; parts = per-mesh tint; paint = per-mesh flat color (drops the texture, for solid plate armor); rough sets roughness; emissive adds glow.
  const M = 'assets/models/';
  const MODELS = {
    hero:          { file: M + 'hero.glb', height: 1.8, tint: 0xffffff, rough: 0.45, rim: [0xbcd6ff, 0.8], paint: { Medieval_Body: 0x3a5ad8, Medieval_Legs: 0x2a3f9e, Medieval_Feet: 0x1c2658, Medieval_Head: 0x4a68e0 }, parts: { Sword: 0xe0ecff } }, // blue plate; add cape + plume with RealmArt.dressHero()
    shade:         { file: M + 'shade.glb', height: 1.6, tint: 0x6a4a9a, emissive: 0x2b1044, opacity: 0.85, rim: [0xc8a0ff, 0.9] },
    wolf:          { file: M + 'wolf.glb', height: 1.0, tint: 0x5a5a66, rough: 0.9, rim: [0xbfd4ff, 0.6] },
    warden:        { file: M + 'skeleton-knight.glb', height: 3.2, tint: 0x5a6070, emissive: 0x1a0610, rim: [0xff6a4a, 0.7] },
    skeletonKnight:{ file: M + 'skeleton-knight.glb', height: 1.8, tint: 0x7a8090, rim: [0xbfd4ff, 0.6] },
    // Oathbound: Aldren's summoned spirit knights (original design: the hero model in pale spirit-blue plate, see-through, strong blue rim).
    // Load like the hero, then RealmArt.dressHero(THREE, root, { spirit: true }) for a see-through red plume and cape. All allies share materials if you clone() the loaded root.
    oathbound:     { file: M + 'hero.glb', height: 1.8, tint: 0xffffff, rough: 0.5, opacity: 0.72, emissive: 0x0a1a48, rim: [0x7ab8ff, 1.4], paint: { Medieval_Body: 0x6f9aff, Medieval_Legs: 0x4a6ad0, Medieval_Feet: 0x33458a, Medieval_Head: 0x88aaff }, parts: { Sword: 0xcfe4ff } },
    // The Hollow King (slice 2 boss): the CC0 king in blackened iron with a violet rim. RealmArt.kingPhase(root, 1|2|3) shifts his glow per phase.
    hollowKing:    { file: M + 'king.glb', height: 3.1, tint: 0x9a8ab8, rough: 0.55, emissive: 0x1a0828, rim: [0xa060ff, 1.1],
                     paint: { King_Body: 0x2e2842, King_Legs: 0x221d30, King_Feet: 0x15111d } },
    king:          { file: M + 'king.glb', height: 2.4, tint: 0x6b5a8a, emissive: 0x1c1128, rim: [0xd0a0ff, 0.8] }, // slice 2
    pines:         { file: M + 'pines.glb', height: 7, tint: 0x1a3524, rough: 1, jag: 0.22 },   // instance this; dark so they read as silhouettes on the sky; jag = layered, jagged tiers
    pineTall:      { file: M + 'pine-tall.glb', height: 9, tint: 0x2a4a34, rough: 1, jag: 0.26 },
    deadTree:      { file: M + 'dead-tree.glb', height: 6, tint: 0x3a3040, rough: 1 },
    rocks:         { file: M + 'rocks.glb', height: 0.8, tint: 0x8a90a0, rough: 1 },
    rockLarge:     { file: M + 'rock-large.glb', height: 2.2, tint: 0x8a8a98, rough: 1 },
    bush:          { file: M + 'bush.glb', height: 1.1, tint: 0x4a8a3c, rough: 1 },
    weeds:         { file: M + 'weeds.glb', height: 0.6, tint: 0x7ab04a, rough: 1 },
    stump:         { file: M + 'stump.glb', height: 0.6, tint: 0x6a5a50, rough: 1 },
    grave:         { file: M + 'grave.glb', height: 1.1, tint: 0x7a7a8a, rough: 1 },
    tent:          { file: M + 'tent.glb', height: 2.2, tint: 0x7a6a58, rough: 1 },
    bonfire:       { file: M + 'bonfire.glb', height: 0.6, tint: 0x8a7a70, rough: 1 },       // cold, abandoned camp
    logs:          { file: M + 'logs.glb', height: 0.8, tint: 0x7a6250, rough: 1 },
    axe:           { file: M + 'axe.glb', height: 0.9, tint: 0xa0a0a8 },
    cart:          { file: M + 'cart.glb', height: 1.4, tint: 0x6a5a4a, rough: 1 },
    key:           { file: M + 'key.glb', height: 0.6, fitMax: true, tint: 0xd8c8a0, emissive: 0x3a2a08 },   // Woodcutter's Key
    shrine:        { file: M + 'shrine.glb', height: 2.6, tint: 0x8a8aa0, rough: 0.9 },
    torch:         { file: M + 'torch.glb', height: 1.8, tint: 0xc0b0a0 },
    banner:        { file: M + 'banner.glb', height: 3, tint: 0x7a2a3a, rough: 1 },
    castleGate:    { file: M + 'castle-gate.glb', height: 9, tint: 0x8c98c8, rough: 0.95 },
    castleWall:    { file: M + 'castle-wall.glb', height: 6, tint: 0x8c98c8, rough: 0.95 },
    castleTower:   { file: M + 'castle-tower.glb', height: 14, tint: 0x8c98c8, rough: 0.95 },
    castleWallTowers: { file: M + 'castle-wall-towers.glb', height: 9, tint: 0x8c98c8, rough: 0.95 },
    // ---- Slice 2 big castle (CC0). Skeletons are KayKit: one skinned body + glowing eyes + weapon(s) = 3-4 draw calls each. ----
    skelWarrior:   { file: M + 'skeleton-warrior.glb', height: 1.9, tint: 0xd8dcec, rough: 0.8, rim: [0xbfd4ff, 0.7] },   // blade + big shield (blocks from the front)
    skelMinion:    { file: M + 'skeleton-minion.glb', height: 1.6, tint: 0xe8e0d0, rough: 0.85, rim: [0xc8a0ff, 0.6] },  // axe, fast and weak
    skelMage:      { file: M + 'skeleton-mage.glb', height: 1.8, tint: 0xb8a0ff, rough: 0.8, rim: [0xa060ff, 1.1] },    // staff, violet robes
    // Dark wizard (KayKit Adventurers Mage, CC0): robe, hat, cape, staff. One merged skinned body + 3 props = 4 draw calls. Tinted near-black with a violet rim.
    wizard:        { file: M + 'wizard.glb', height: 1.9, tint: 0x4a3a66, rough: 0.8, emissive: 0x12061e, rim: [0xa060ff, 1.3] },
    // Kits: NOT characters. Load once, then RealmArt.kit(THREE, gltf.scene) and build with keepExterior() / keepRoom({ kit }). Don't fit() these.
    keepExterior:  { file: M + 'keep-exterior.glb', kit: true, tint: 0x8c98c8, rough: 0.95 },   // Quaternius Modular Castle Kit (matches castleWall etc.)
    keepInterior:  { file: M + 'keep-interior.glb', kit: true, tint: 0xb8bcd8, rough: 0.9 },    // KayKit Dungeon Remastered pieces (4 m grid)
  };
  // Animation clips have prefixes like "CharacterArmature|Run". clip() finds one by its short name.
  const ANIMS = {
    hero:   { idle: 'Idle_Sword', run: 'Run', walk: 'Walk', attack: 'Sword_Slash', hit: 'HitRecieve', death: 'Death', interact: 'Interact', roll: 'Roll' },
    shade:  { idle: 'Flying_Idle', run: 'Fast_Flying', attack: 'Headbutt', hit: 'HitReact', death: 'Death' },
    wolf:   { idle: 'Idle', run: 'Gallop', walk: 'Walk', attack: 'Attack', hit: 'Idle_HitReact_Left', death: 'Death', crouch: 'Idle_2_HeadLow' },
    warden: { idle: 'Idle', run: 'Run', walk: 'Walk', attack: 'Attack', hit: 'HitRecieve', death: 'Death' },
    skeletonKnight: { idle: 'Idle', run: 'Run', walk: 'Walk', attack: 'Attack', hit: 'HitRecieve', death: 'Death' },
    hollowKing: { idle: 'Idle_Sword', walk: 'Walk', run: 'Run', combo: 'Sword_Slash', slam: 'Punch_Right', raise: 'Interact', roar: 'Wave', hit: 'HitRecieve', death: 'Death' },
    // Skeletons: Death_A/B/C are the three deaths (RealmArt.deathClip() picks one), Resurrect = get back up from Death_C, rise = climb out of the ground.
    skelWarrior: { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', attack: '1H_Melee_Attack_Chop', attack2: '1H_Melee_Attack_Slice_Diagonal', hit: 'Hit_A', death: 'Death_A',
                   Death_A: 'Death_A', Death_B: 'Death_B', Death_C: 'Death_C_Skeletons', Resurrect: 'Death_C_Skeletons_Resurrect', rise: 'Spawn_Ground_Skeletons',
                   Block: 'Block', blocking: 'Blocking', blockHit: 'Block_Hit', taunt: 'Taunt' },
    skelMinion:  { idle: 'Idle', walk: 'Walking_A', run: 'Running_B', attack: '1H_Melee_Attack_Stab', hit: 'Hit_A', death: 'Death_A',
                   Death_A: 'Death_A', Death_B: 'Death_B', Death_C: 'Death_C_Skeletons', Resurrect: 'Death_C_Skeletons_Resurrect', rise: 'Spawn_Ground_Skeletons',
                   floorPose: 'Skeletons_Inactive_Floor_Pose', awaken: 'Skeletons_Awaken_Floor', taunt: 'Taunt' },
    skelMage:    { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', attack: 'Spellcast_Shoot', cast: 'Spellcasting', raise: 'Spellcast_Raise', hit: 'Hit_A', death: 'Death_A',
                   Death_A: 'Death_A', Death_B: 'Death_B', Death_C: 'Death_C_Skeletons', Resurrect: 'Death_C_Skeletons_Resurrect', rise: 'Spawn_Ground_Skeletons', taunt: 'Taunt' },
    // wizard: keeps its distance (backstep/dodge), attack = slow bolt, cast = channel loop, raise = raise a Minion (pair with skelMinion 'rise').
    wizard:      { idle: 'Idle', walk: 'Walking_A', back: 'Walking_Backwards', run: 'Running_A', attack: 'Spellcast_Shoot', cast: 'Spellcasting', raise: 'Spellcast_Raise', long: 'Spellcast_Long',
                   dodge: 'Dodge_Backward', dodgeL: 'Dodge_Left', dodgeR: 'Dodge_Right', hit: 'Hit_A', death: 'Death_A', Death_A: 'Death_A', Death_B: 'Death_B' },
    king:   { idle: 'Idle_Sword', run: 'Run', walk: 'Walk', attack: 'Sword_Slash', hit: 'HitRecieve', death: 'Death' },
  };
  function clip(clips, short) {
    return clips.find(c => c.name === short) || clips.find(c => c.name.split('|').pop() === short) || null;
  }
  // Pull a loaded model toward the palette. Clones materials so shared ones aren't double-tinted.
  function tint(root, name) {
    const m = MODELS[name]; if (!m) return root;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone();
      const pick = map => map && (map[o.name] != null ? map[o.name] : o.parent && map[o.parent.name] != null ? map[o.parent.name] : null); // multi-part meshes are children of a group with the part name
      if (m.jag && !o.geometry.userData.jagged) jag(o.geometry, m.jag);
      const pc = pick(m.paint);
      if (pc != null) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(mat => { mat.map = null; mat.color.setHex(pc); mat.roughness = 0.4; mat.metalness = 0.35; mat.flatShading = style !== 'v2';
        if (m.emissive != null && mat.emissive) mat.emissive.setHex(m.emissive);
        if (m.opacity != null) { mat.transparent = true; mat.opacity = m.opacity; mat.depthWrite = false; }
        if (m.rim) rim(mat, m.rim[0], m.rim[1]); mat.needsUpdate = true; }); return; }
      const pt = pick(m.parts), t = pt != null ? pt : m.tint; // per-mesh tint wins
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(mat => {
        if (mat.color && t != null) mat.color.multiply({ r: ((t >> 16) & 255) / 255, g: ((t >> 8) & 255) / 255, b: (t & 255) / 255 });
        if (style === 'v2') { if (m.rough != null && 'roughness' in mat) mat.roughness = m.rough; }
        else { if ('roughness' in mat) mat.roughness = m.rough != null ? m.rough : 0.85; mat.flatShading = true; } // v3: one matte look, faceted
        if (PIXEL.crisp && mat.map) { mat.map.magFilter = 1003; mat.map.minFilter = 1003; mat.map.generateMipmaps = false; mat.map.needsUpdate = true; } // 1003 = THREE.NearestFilter
        mat.needsUpdate = true;
        if ('metalness' in mat) mat.metalness = Math.min(mat.metalness || 0, 0.3);
        if (m.emissive != null && mat.emissive) mat.emissive.setHex(m.emissive);
        if (m.opacity != null) { mat.transparent = true; mat.opacity = m.opacity; mat.depthWrite = false; }
        if (m.rim) rim(mat, m.rim[0], m.rim[1]);
      });
    });
    return root;
  }
  // Rim light: a cheap fresnel glow on the edges that face away from the camera, so characters pop off the background.
  // Works on Soft and on the chunky pixel options (it's part of the material, not the post pass). No extra draw calls.
  function rim(mat, color, strength) {
    const c = { r: ((color >> 16) & 255) / 255, g: ((color >> 8) & 255) / 255, b: (color & 255) / 255 };
    mat.userData.rim = { value: [c.r * strength, c.g * strength, c.b * strength] };
    mat.onBeforeCompile = sh => {
      sh.uniforms.rimColor = { value: mat.userData.rim.value };
      sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  float rimF = 1.0 - abs(dot(normal, normalize(vViewPosition)));\n  totalEmissiveRadiance += rimColor * pow(rimF, 3.0) * step(0.55, rimF);');
    };
    mat.customProgramCacheKey = () => 'rim';
  }
  // Layered, jagged pine tiers: pushes each vertex out or in depending on its height (a sawtooth), plus a little seeded wobble.
  function jag(geo, amt) {
    const p = geo.attributes.position; if (!p) return; geo.computeBoundingBox(); const bb = geo.boundingBox, R = rng(99);
    const ext = ['x', 'y', 'z'].map(k => bb.max[k] - bb.min[k]), up = ext.indexOf(Math.max(...ext)); // the tree's tall axis (some glbs are Z-up inside)
    const a1 = (up + 1) % 3, a2 = (up + 2) % 3, mid = k => (bb.max['xyz'[k]] + bb.min['xyz'[k]]) / 2, c1 = mid(a1), c2 = mid(a2), lo = bb.min['xyz'[up]], h = ext[up] || 1;
    const G = ['getX', 'getY', 'getZ'], S = ['setX', 'setY', 'setZ'], get = (i, k) => p[G[k]](i), set = (i, k, v) => p[S[k]](i, v);
    for (let i = 0; i < p.count; i++) { const t = (get(i, up) - lo) / h; if (t < 0.15 || t > 0.95) continue; // trunk and tip stay put
      const saw = (t * 5) % 1, k = 1 + amt * (saw - 0.4) + (R() - 0.5) * amt * 0.4;
      set(i, a1, c1 + (get(i, a1) - c1) * k); set(i, a2, c2 + (get(i, a2) - c2) * k); }
    p.needsUpdate = true; geo.computeVertexNormals(); geo.userData.jagged = true;
  }
  // ---- Small textures and particles (canvas, drawn in code) ----
  function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
  function glow(size, stops) {
    return cv(size, size, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      stops.forEach(([t, col]) => r.addColorStop(t, col)); g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
  }
  // Seeded random so textures look the same every load.
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function pxGlow(w, hot, edge) {
    return cv(w, w, g => { const h = (w - 1) / 2;
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const v = Math.max(0, 1 - Math.hypot(x - h, y - h) / (w / 2));
        if (v * v * 16 > BAYER[(y % 4) * 4 + (x % 4)]) { g.fillStyle = v > 0.55 ? hot : edge; g.fillRect(x, y, 1, 1); } } });
  }
  // A jagged ridge line; spires = 1 adds our own castle (tall thin towers with pointed roofs) on one peak.
  function ridge(w, h, seed, top, bottom, lo, hi, spires) {
    return cv(w, h, g => { const R = rng(seed), gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr;
      let y = h * (1 - (lo + hi) / 2), pts = []; for (let x = 0; x <= w; x += 2) { y += (R() - 0.5) * h * 0.12; y = Math.max(h * (1 - hi), Math.min(h * (1 - lo), y)); pts.push([x, y]); }
      if (spires) { const c = w * 0.3; for (const p of pts) if (Math.abs(p[0] - c) < 60) p[1] = Math.min(p[1], h * 0.42 + Math.abs(p[0] - c) * 0.15); }
      g.beginPath(); g.moveTo(0, h); pts.forEach(p => g.lineTo(p[0], Math.round(p[1]))); g.lineTo(w, h); g.fill();
      if (spires) { const c = w * 0.3; [[-34, 10, 3], [-22, 16, 3], [-10, 22, 4], [0, 30, 5], [12, 20, 4], [24, 14, 3], [36, 9, 3]].forEach(([dx, th, tw]) => {
        const x = Math.round(c + dx), base = Math.round(h * 0.44); g.fillRect(x, base - th, tw, th + 4); g.beginPath(); g.moveTo(x - 1, base - th); g.lineTo(x + tw / 2, base - th - tw * 2); g.lineTo(x + tw + 1, base - th); g.fill(); }); }
      // haze band at the bottom
      const hz = g.createLinearGradient(0, h * 0.55, 0, h); hz.addColorStop(0, 'rgba(122,162,220,0)'); hz.addColorStop(1, bottom); g.fillStyle = hz; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; });
  }
  const TEX = {
    // Additive sprites (use with THREE.AdditiveBlending, depthWrite false).
    spark: () => glow(32, [[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,190,90,0.9)'], [1, 'rgba(255,90,20,0)']]),       // torch/Ember sparks
    emberGlow: () => glow(64, [[0, 'rgba(255,230,160,0.9)'], [0.3, 'rgba(255,160,60,0.45)'], [1, 'rgba(255,80,20,0)']]),  // fake bloom halo
    flare: () => glow(128, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,220,140,0.8)'], [0.6, 'rgba(255,120,40,0.25)'], [1, 'rgba(255,60,0,0)']]),
    shadeWisp: () => glow(32, [[0, 'rgba(200,150,255,0.9)'], [0.4, 'rgba(110,50,180,0.5)'], [1, 'rgba(43,16,68,0)']]),
    moon: () => glow(128, [[0, 'rgba(235,240,255,1)'], [0.45, 'rgba(210,220,255,1)'], [0.5, 'rgba(160,180,255,0.35)'], [1, 'rgba(120,140,255,0)']]),
    // Normal blending. Soft blue-white haze puff (open forest) and dark purple cursed mist puff (mist zones).
    mist: () => glow(64, [[0, 'rgba(200,215,255,0.30)'], [0.5, 'rgba(180,200,245,0.12)'], [1, 'rgba(170,190,240,0)']]),
    cursedMist: () => glow(64, [[0, 'rgba(60,20,90,0.55)'], [0.5, 'rgba(42,18,64,0.28)'], [1, 'rgba(42,18,64,0)']]),
    // Blob shadow under characters (normal blending, multiply-looking dark disc).
    blob: () => glow(64, [[0, 'rgba(0,0,0,0.6)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]),
    // Dithered pixel glows (additive, nearest filter): hard Bayer-dithered edges instead of smooth fades.
    swordGlow: () => pxGlow(16, '#f2f8ff', '#6fa8ff'),
    pxTorch: () => pxGlow(16, '#fff0b0', '#ff7a1c'),
    pxEmber: () => pxGlow(24, '#fff6c8', '#ffb838'),
    pxShade: () => pxGlow(16, '#e4c8ff', '#7a3ad0'),
    // Grass tuft card (alpha-tested, 16x16): pointy blades in 3 greens.
    // Grass atlas (32x16, alpha-tested): left half = a tuft of pointy blades, right half = a few flowers on stems.
    grassTuft: () => cv(32, 16, g => {
      const R = rng(31), cols = ['#7cc04c', '#5a9a38', '#9ad664', '#6aae42'];
      for (let i = 0; i < 12; i++) { let x = 1 + R() * 14, h = 5 + R() * 10; g.fillStyle = cols[i % 4];
        for (let y = 0; y < h; y++) { g.fillRect(Math.round(x), 15 - y, y < h - 3 ? 2 : 1, 1); x += (R() - 0.5) * 0.9; } }
      const fl = ['#ffe070', '#f4f4ff', '#c898ff', '#ff8a8a', '#ffe070'];
      for (let i = 0; i < 5; i++) { const x = 17 + ((i * 3 + R() * 2) | 0), h = 6 + ((R() * 6) | 0); g.fillStyle = '#5a9a38'; g.fillRect(x, 15 - h, 1, h);
        g.fillStyle = fl[i]; g.fillRect(x - 1, 14 - h, 3, 2); g.fillStyle = '#fff6c0'; g.fillRect(x, 14 - h, 1, 1); }
      g.fillStyle = '#6aae42'; for (let i = 0; i < 6; i++) g.fillRect(16 + ((R() * 15) | 0), 12 + ((R() * 4) | 0), 1, 4);
    }),
    // Lanternkin atlas (64x32, 8 cells of 16x16). Row 0: spear walk A, spear walk B, lantern walk A, lantern walk B.
    // Row 1: attack lunge, then 3 frames of pixel dust (the pop when one is killed). Original friendly goblins.
    lanternkin: () => cv(64, 32, g => {
      const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      const gob = (ox, oy, step, kind, lunge) => {
        const sk = '#6cc24a', skD = '#3f8a2e', tun = kind ? '#8a5a2a' : '#6a3a8a';
        px(ox + 5, oy + 10, 6, 4, tun); px(ox + 5, oy + 10, 6, 1, '#00000055');                 // tunic
        px(ox + 5 + (step ? 0 : 1), oy + 14, 2, 2, skD); px(ox + 9 - (step ? 0 : 1), oy + 14, 2, 2, skD); // legs
        px(ox + 4, oy + 4, 8, 6, sk); px(ox + 4, oy + 9, 8, 1, skD);                              // big round head
        px(ox + 2, oy + 5, 2, 2, sk); px(ox + 12, oy + 5, 2, 2, sk); px(ox + 1, oy + 4, 1, 1, sk); px(ox + 14, oy + 4, 1, 1, sk); // pointy ears
        px(ox + 5, oy + 6, 2, 2, '#fff8d8'); px(ox + 9, oy + 6, 2, 2, '#fff8d8'); px(ox + 6, oy + 7, 1, 1, '#1a1a2a'); px(ox + 10, oy + 7, 1, 1, '#1a1a2a'); // friendly eyes
        px(ox + 7, oy + 8, 2, 1, '#2a5a20');                                                       // grin
        px(ox + 5, oy + 3, 6, 1, '#b83a2a'); px(ox + 6, oy + 2, 4, 1, '#b83a2a');                  // little red cap
        if (kind) { px(ox + 13, oy + 9, 1, 2, '#5a4030'); px(ox + 12, oy + 11, 3, 3, '#ffd24a'); px(ox + 13, oy + 12, 1, 1, '#fff6c0'); } // lantern
        else { const l = lunge ? 2 : 0; px(ox + 12 + l, oy + 1, 1, 13, '#8a6a40'); px(ox + 11 + l, oy, 3, 2, '#d8e0f0'); } // spear
      };
      gob(0, 0, 0, 0); gob(16, 0, 1, 0); gob(32, 0, 0, 1); gob(48, 0, 1, 1); gob(0, 16, 1, 0, true);
      const R = rng(5); [[16, 5, 3], [32, 9, 2], [48, 6, 1]].forEach(([ox, n, sz], f) => { for (let i = 0; i < n + 6; i++) {
        const a = R() * 6.28, d = 2 + f * 2.2 + R() * 2; px(ox + 8 + Math.cos(a) * d | 0, 16 + 8 + Math.sin(a) * d | 0, sz, sz, ['#9ae06a', '#6cc24a', '#ffd24a', '#e8f0ff'][i % 4]); } });
    }),
    // Soft haze band for the two depth fog rings (alpha fades out upward).
    hazeBand: () => cv(4, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(122,162,220,0)'); gr.addColorStop(0.6, 'rgba(122,162,220,0.35)'); gr.addColorStop(1, 'rgba(140,175,228,0.7)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
    // Horizon silhouettes (transparent above the ridge, haze blue at the bottom = height fog).
    farCliffs: () => ridge(256, 64, 41, '#5a82c8', '#7aa2dc', 0.35, 0.8, 0),
    castleCliff: () => ridge(512, 64, 43, '#3e62ac', '#7aa2dc', 0.45, 0.75, 1),
    nearHills: () => ridge(256, 32, 47, '#2e5a3a', '#6a94c8', 0.3, 0.6, 0),
    // Blue-hour sky for scene.background (colorSpace SRGB). Gradient plus soft clouds; haze at the bottom matches the fog.
    sky: () => cv(256, 256, (g, w) => {
      const gr = g.createLinearGradient(0, 0, 0, w);
      gr.addColorStop(0, '#1846b0'); gr.addColorStop(0.55, '#3f72d0'); gr.addColorStop(0.85, '#7aa2dc'); gr.addColorStop(1, '#7aa2dc');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      const R = rng(5);
      for (let i = 0; i < 26; i++) {
        const x = R() * w, y = 20 + R() * 150, rx = 20 + R() * 50, ry = 5 + R() * 10;
        const c = g.createRadialGradient(x, y, 0, x, y, rx); c.addColorStop(0, 'rgba(225,235,255,0.35)'); c.addColorStop(1, 'rgba(225,235,255,0)');
        g.fillStyle = c; g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.beginPath(); g.arc(x, y, rx, 0, 7); g.fill(); g.restore();
      }
    }),
    // Tiling ground textures (256px, set wrapS/wrapT = RepeatWrapping). forestFloor is now lush grass.
    forestFloor: () => cv(128, 128, (g, w) => { // tight 1-2px speckle in close greens, no big blotches
      const R = rng(11); g.fillStyle = '#467f31'; g.fillRect(0, 0, w, w);
      const cols = ['#4c8735', '#40782d', '#528e39', '#3c7129', '#5a963e'];
      for (let i = 0; i < 2600; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect((R() * w) | 0, (R() * w) | 0, 1 + (R() < 0.3), 1); }
      for (let i = 0; i < 260; i++) { const x = (R() * w) | 0, y = (R() * w) | 0; g.fillStyle = R() < 0.5 ? '#6aa647' : '#2f5f22'; g.fillRect(x, y, 1, 2); } // blade flecks
    }),
    // Cursed ground inside mist zones (swap or blend in under the purple fog).
    cursedFloor: () => cv(256, 256, (g, w) => {
      const R = rng(13); g.fillStyle = '#1b1a22'; g.fillRect(0, 0, w, w);
      const cols = ['#23202c', '#15141a', '#2a2436', '#1e2a22'];
      for (let i = 0; i < 1400; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect(R() * w, R() * w, 2 + R() * 5, 2 + R() * 5); }
    }),
    cobble: () => cv(256, 256, (g, w) => {
      const R = rng(23); g.fillStyle = '#3a3a46'; g.fillRect(0, 0, w, w);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = 100 + ((R() * 34) | 0), ox = (y % 2) * 16;
        g.fillStyle = `rgb(${v},${v - 2},${v + 10})`; g.fillRect(((x * 32 + ox) % w) + 2, y * 32 + 2, 28, 28);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(((x * 32 + ox) % w) + 2, y * 32 + 2, 28, 3);
        if (R() < 0.25) { g.fillStyle = 'rgba(30,58,42,0.6)'; g.fillRect(((x * 32 + ox) % w) + R() * 20, y * 32 + 26, 8, 4); } // moss
      }
    }),
    // ---- Slice 2: the keep ----
    keepStone: () => cv(128, 128, (g, w) => { // cut stone blocks, cool blue-grey, dark mortar
      const R = rng(41); g.fillStyle = '#23242e'; g.fillRect(0, 0, w, w);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const ox = (y % 2) * 16, bx = (x * 32 + ox) % w, v = 78 + ((R() * 26) | 0);
        g.fillStyle = `rgb(${v - 6},${v - 2},${v + 12})`; g.fillRect(bx + 1, y * 16 + 1, 30, 14); if (bx + 31 > w) g.fillRect(bx - w + 1, y * 16 + 1, 30, 14);
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(bx + 1, y * 16 + 1, 30, 2); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(bx + 1, y * 16 + 13, 30, 2);
        for (let i = 0; i < 10; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; g.fillRect(bx + 2 + R() * 27, y * 16 + 3 + R() * 9, 1 + (R() < 0.3), 1); }
        if (R() < 0.08) { g.fillStyle = 'rgba(40,70,48,0.55)'; g.fillRect(bx + R() * 20, y * 16 + 11, 10, 4); } }
    }),
    keepFloor: () => cv(128, 128, (g, w) => { // worn flagstones
      const R = rng(43); g.fillStyle = '#1e1e28'; g.fillRect(0, 0, w, w);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 70 + ((R() * 22) | 0), jx = (R() * 3) | 0, jy = (R() * 3) | 0;
        g.fillStyle = `rgb(${v},${v - 3},${v + 6})`; g.fillRect(x * 32 + 1 + jx, y * 32 + 1 + jy, 30 - jx, 30 - jy);
        for (let i = 0; i < 30; i++) { g.fillStyle = R() < 0.6 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.05)'; g.fillRect(x * 32 + 2 + R() * 27, y * 32 + 2 + R() * 27, 1 + (R() < 0.3), 1); }
        if (R() < 0.15) { g.fillStyle = 'rgba(0,0,0,0.3)'; let cx = x * 32 + 6 + R() * 20, cy = y * 32 + 4; for (let k = 0; k < 20; k++) { g.fillRect(cx | 0, cy | 0, 1, 1); cx += (R() - 0.5) * 2; cy += 1; } } } // cracks
    }),
    carpet: () => cv(32, 64, (g, w, h) => { // royal runner: deep red, dull gold border, repeats along its length
      g.fillStyle = '#5a0e1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#b08a2e'; g.fillRect(2, 0, 2, h); g.fillRect(w - 4, 0, 2, h);
      g.fillStyle = '#7a1a28'; for (let y = 4; y < h; y += 16) { g.fillRect(12, y, 8, 8); g.fillStyle = '#b08a2e'; g.fillRect(15, y + 3, 2, 2); g.fillStyle = '#7a1a28'; }
      const R = rng(47); for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(R() * w, R() * h, 1, 1); }
    }),
    runeRing: () => cv(128, 128, (g, w) => { // the altar's rune circle (additive: black = invisible)
      const c = w / 2; g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
      const dot = (r, a, s, col) => { g.fillStyle = col; g.fillRect((c + Math.cos(a) * r - s / 2) | 0, (c + Math.sin(a) * r - s / 2) | 0, s, s); };
      for (let a = 0; a < 6.283; a += 0.02) { dot(58, a, 3, '#ffcf5a'); dot(44, a, 2, '#c88a2a'); }
      const R = rng(53); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; for (let i = 0; i < 5; i++) dot(51, a + (R() - 0.5) * 0.18, 2, '#ffe6a0'); } // rune marks
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283 - 1.571; for (let r = 8; r < 44; r += 2) dot(r, a, 2, '#a86a1e'); dot(30, a, 6, '#ffe6a0'); } // 3 spokes to the Ember sockets
    }),
    shockRing: () => cv(128, 128, (g, w) => { // the king's slam shockwave (additive)
      const c = w / 2, img = g.createImageData(w, w);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c + 0.5, y - c + 0.5) / c, k = Math.max(0, 1 - Math.abs(d - 0.85) / 0.13), q = Math.round(k * 4) / 4, i = (y * w + x) * 4;
        img.data[i] = 200 * q + 55 * q * q; img.data[i + 1] = 150 * q * q + 40 * q; img.data[i + 2] = 255 * q; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    }),
  };
  function fit(THREE, root, name) {
    const m = MODELS[name]; if (!m) return root;
    root.scale.setScalar(1); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), h = (m.fitMax ? Math.max(sz.x, sz.y, sz.z) : sz.y) || 1, k = m.height / h;
    root.scale.setScalar(k); root.position.y = -box.min.y * k;
    return root;
  }
  // Red cape and plume for Aldren. Call AFTER fit(), before adding to the scene. Cheap: 2 meshes, no textures.
  // They are attached to the Chest and Head bones, so they follow the animations.
  function dressHero(THREE, root, opts) {
    root.updateMatrixWorld(true);
    const chest = root.getObjectByName('Chest'), head = root.getObjectByName('Head'); if (!chest || !head) return root;
    const spirit = opts && opts.spirit; // Oathbound allies: see-through cloth
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x3a0508, roughness: 0.8, side: THREE.DoubleSide });
    if (spirit) { mat.transparent = true; mat.opacity = 0.72; mat.depthWrite = false; mat.emissive.setHex(0x3a0a30); }
    // The inside (back face) of the cape is a darker red, so it reads as cloth with a fold instead of a flat block.
    mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.45;'); };
    mat.customProgramCacheKey = () => 'cape2';
    const plumeMat = new THREE.MeshStandardMaterial({ color: PAL.cape, emissive: 0x3a0508, roughness: 0.7, flatShading: true, transparent: !!spirit, opacity: spirit ? 0.72 : 1 });
    const s = root.getWorldScale(new THREE.Vector3()).x, P = v => root.worldToLocal(v);
    const cp = chest.getWorldPosition(new THREE.Vector3()), hp = head.getWorldPosition(new THREE.Vector3());
    // Cape: a slightly curved plane hanging from the shoulders down the back (-Z is behind the model).
    const cg = new THREE.PlaneGeometry(0.46, 0.9, 6, 6); cg.translate(0, -0.5, 0);
    const pos = cg.attributes.position, col = [], base = new THREE.Color(PAL.cape), cc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), x = pos.getX(i);
      const pleat = Math.cos(x * 40) * 0.025 * (0.3 - y); // vertical folds that open up toward the hem
      pos.setZ(i, 0.18 * y - 0.12 * x * x + pleat); pos.setX(i, x * (1 - 0.35 * y));
      const shade = 0.55 + 0.45 * (Math.cos(x * 40) * 0.5 + 0.5) - 0.25 * Math.min(1, -y); // folds + darker toward the hem
      cc.copy(base).multiplyScalar(shade); col.push(cc.r, cc.g, cc.b); }
    cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); cg.computeVertexNormals();
    const cape = new THREE.Mesh(cg, mat); cape.name = 'Cape'; cape.castShadow = true;
    cape.position.copy(P(cp.clone().add(new THREE.Vector3(0, 0.2, -0.2)))); cape.scale.setScalar(1 / s); root.add(cape);
    // Plume: a tall flattened cone on top of the helmet, tilted back.
    const pg = new THREE.ConeGeometry(0.09, 0.42, 6); pg.scale(0.55, 1, 1.4);
    const plume = new THREE.Mesh(pg, plumeMat); plume.name = 'Plume'; plume.rotation.x = -0.45;
    plume.position.copy(P(hp.clone().add(new THREE.Vector3(0, 0.42, -0.06)))); plume.scale.setScalar(1 / s); root.add(plume);
    root.updateMatrixWorld(true); chest.attach(cape); head.attach(plume);
    return root;
  }
  // ---- Pixel look (the player: "more pixelated, not smooth") ----
  // Renders the scene at a LOW resolution (scale 0.25..0.35 of the screen), then blows it up with
  // nearest-neighbor (big crisp pixels, no smoothing). On the way it does, in one cheap shader:
  // ACES filmic tone mapping, a color grade (deeper blues, richer greens, warm reds), blocky fake bloom,
  // a posterize step with visible 4x4 ordered dithering, and a soft vignette.
  // Fewer pixels to draw also makes iPhone FASTER. Usage:
  //   renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  //   const px = RealmArt.pixelPass(THREE, renderer, { scale: 0.3 });   // px.setScale(0.25) any time; px.setSize() on resize
  //   loop: px.render(scene, camera)          px.enabled = false draws the plain smooth image
  // Two looks. 'v2' is the DEFAULT (the player's pick): blue hour, pixelPass at 0.5, light dither, no grade.
  // 'v3' is opt-in: heavy pixels (0.3), posterize + strong dither, grade, vignette, blocky bloom, flat shading, nearest textures, ACES.
  //   RealmArt.useStyle('v3') BEFORE loading models; with v3 also set renderer.toneMapping = THREE.ACESFilmicToneMapping.
  const STYLES = {
    v2: { scale: 0.5, levels: 28, dither: 1.0, bloom: 0, vignette: 0, sat: 1, contrast: 1, grade: 0, exposure: 1.05, crisp: false },
    v3: { scale: 0.3, levels: 9, dither: 1.0, bloom: 0.9, vignette: 0.35, sat: 1.25, contrast: 1.12, grade: 1, exposure: 1.35, crisp: true },
  };
  const PIXEL = Object.assign({}, STYLES.v2);
  let style = 'v2';
  function useStyle(name) { if (!STYLES[name]) return style; style = name; Object.assign(PIXEL, STYLES[name]); LIGHTS.exposure = PIXEL.exposure; return style; }
  function pixelPass(THREE, renderer, o = {}) {
    const P = Object.assign({}, PIXEL, o);
    const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, generateMipmaps: false });
    const U = { tex: { value: rt.texture }, res: { value: new THREE.Vector2(1, 1) } };
    ['levels', 'dither', 'bloom', 'vignette', 'sat', 'contrast', 'grade'].forEach(k => U[k] = { value: P[k] });
    const mat = new THREE.ShaderMaterial({
      uniforms: U, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform vec2 res; uniform float levels, dither, bloom, vignette, sat, contrast, grade; varying vec2 vUv;
        // 4x4 Bayer threshold built from two 2x2 steps (no arrays, works on every phone GPU)
        float bayer(vec2 p){ vec2 q = mod(p, 4.0), a = mod(q, 2.0), b = floor(q / 2.0);
          return (mod(a.x * 2.0 + a.y * 3.0, 4.0) * 4.0 + mod(b.x * 2.0 + b.y * 3.0, 4.0)) / 16.0 - 0.47; }
        vec3 hot(vec2 o){ vec3 c = texture2D(tex, vUv + o / res).rgb; return max(c - 0.85, 0.0); }
        void main(){
          vec3 c = texture2D(tex, vUv).rgb;
          // blocky fake bloom: 8 taps around this (big) pixel pick up anything brighter than 0.85
          vec3 b = hot(vec2(2.,0.)) + hot(vec2(-2.,0.)) + hot(vec2(0.,2.)) + hot(vec2(0.,-2.)) + hot(vec2(1.,1.)) + hot(vec2(-1.,1.)) + hot(vec2(1.,-1.)) + hot(vec2(-1.,-1.));
          gl_FragColor = vec4(c + b * bloom * 0.25, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          vec3 g = gl_FragColor.rgb;
          float l = dot(g, vec3(0.299, 0.587, 0.114));
          g = mix(vec3(l), g, sat);                                    // richer color
          g = (g - 0.5) * contrast + 0.5;                              // a bit more punch
          g *= mix(vec3(1.0), mix(vec3(0.86, 0.95, 1.14), vec3(1.08, 1.0, 0.9), smoothstep(0.2, 0.8, l)), grade); // blue shadows, warm highlights
          g *= 1.0 - vignette * smoothstep(0.35, 0.9, length((vUv - 0.5) * vec2(1.1, 0.9)) * 1.3);
          g = floor(clamp(g, 0.0, 1.0) * levels + 0.5 + bayer(floor(vUv * res)) * dither) / levels; // posterize + ordered dither
          gl_FragColor = vec4(g, 1.0); }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), s2 = new THREE.Scene(), c2 = new THREE.Camera(); quad.frustumCulled = false; s2.add(quad);
    const pass = { enabled: true, target: rt, uniforms: U, scale: P.scale,
      setSize() { const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(1, Math.round(v.x * this.scale)), h = Math.max(1, Math.round(v.y * this.scale)); rt.setSize(w, h); U.res.value.set(w, h); },
      setScale(s) { this.scale = s; this.setSize(); },
      render(scene, cam) { if (!this.enabled) return renderer.render(scene, cam);
        renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null); renderer.render(s2, c2); } };
    pass.setSize(); return pass;
  }
  // Canvas texture the pixel way: nearest filtering, no mipmaps, sRGB. repeat > 0 makes it tile.
  function tex(THREE, name, repeat) {
    const t = new THREE.CanvasTexture(texture(name)); t.colorSpace = THREE.SRGBColorSpace;
    if (PIXEL.crisp) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  }
  // Shadows: soft PCF, one 1024 map, a tight box that follows the player (call follow() every frame).
  function shadows(THREE, renderer, light, o = {}) {
    const box = o.box || 9; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    light.castShadow = true; light.shadow.mapSize.set(o.size || 1024, o.size || 1024); light.shadow.bias = -0.0006; light.shadow.normalBias = 0.03;
    Object.assign(light.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 1, far: 60 }); light.shadow.camera.updateProjectionMatrix();
    const off = new THREE.Vector3(...LIGHTS.sky.dir).normalize().multiplyScalar(25);
    if (!light.target.parent && light.parent) light.parent.add(light.target);
    return { follow(p) { light.position.copy(p).add(off); light.target.position.copy(p); } };
  }
  // Grass tufts: ONE draw call (InstancedMesh of crossed pixel cards) that stays around the player and
  // shrinks toward the edge so it melts into the ground texture. density 0..1 is the one knob to turn down.
  const GRASS = { density: 1, max: 1800, radius: 12, flowers: 0.1 }; // density 0..1 is the knob; flowers = share of tufts that are flowers
  function grass(THREE, o = {}) {
    const n = Math.max(0, Math.round((o.max || GRASS.max) * (o.density != null ? o.density : GRASS.density))), R = o.radius || GRASS.radius;
    const g1 = new THREE.PlaneGeometry(0.5, 0.26); g1.translate(0, 0.13, 0);
    const g2 = g1.clone().rotateY(Math.PI / 2), geo = new THREE.BufferGeometry();
    const merge = (a, b) => { const out = new THREE.BufferGeometry(); ['position', 'normal', 'uv'].forEach(k => { const A = a.attributes[k].array, B = b.attributes[k].array, arr = new Float32Array(A.length + B.length); arr.set(A); arr.set(B, A.length); out.setAttribute(k, new THREE.BufferAttribute(arr, a.attributes[k].itemSize)); });
      const ia = a.index.array, ib = b.index.array, off = a.attributes.position.count, idx = []; ia.forEach(v => idx.push(v)); ib.forEach(v => idx.push(v + off)); out.setIndex(idx); return out; };
    const tuft = merge(g1, g2); tuft.attributes.normal.array.fill(0); for (let i = 1; i < tuft.attributes.normal.array.length; i += 3) tuft.attributes.normal.array[i] = 1; // light them like the ground
    const gt = tex(THREE, 'grassTuft'); gt.magFilter = gt.minFilter = THREE.NearestFilter; gt.generateMipmaps = false; // crisp blades on every look
    const mat = new THREE.MeshLambertMaterial({ map: gt, alphaTest: 0.5, side: THREE.DoubleSide });
    // Each instance picks the grass half or the flower half of the atlas (one draw call for both).
    mat.onBeforeCompile = sh => { sh.vertexShader = 'attribute float aFlower;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv.x = vMapUv.x * 0.5 + aFlower * 0.5;'); };
    mat.customProgramCacheKey = () => 'grassAtlas';
    const mesh = new THREE.InstancedMesh(tuft, mat, Math.max(1, n)); mesh.count = n; mesh.frustumCulled = false; mesh.receiveShadow = true;
    const R0 = rng(77), base = [], c = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const fl = new Float32Array(Math.max(1, n)), fShare = o.flowers != null ? o.flowers : GRASS.flowers;
    for (let i = 0; i < n; i++) { const isF = R0() < fShare; fl[i] = isF ? 1 : 0; base.push([R0() * 2 * R, R0() * 2 * R, R0() * 6.28, (isF ? 0.8 : 0.7) + R0() * 0.7]); if (isF) c.setRGB(1, 1, 1); else c.setHSL(0.24 + R0() * 0.08, 0.45 + R0() * 0.15, 0.48 + R0() * 0.145); mesh.setColorAt(i, c); }
    tuft.setAttribute('aFlower', new THREE.InstancedBufferAttribute(fl, 1)); // same instance order as before, so game.js indexes still line up
    let lx = 1e9, lz = 1e9;
    mesh.userData.update = (cx, cz) => { // call every frame with the player x, z (cheap: only works when they moved 0.4 m)
      if (Math.abs(cx - lx) + Math.abs(cz - lz) < 0.4) return; lx = cx; lz = cz;
      for (let i = 0; i < n; i++) { const b = base[i];
        const x = cx - R + ((((b[0] - cx) % (2 * R)) + 2 * R) % (2 * R)), z = cz - R + ((((b[1] - cz) % (2 * R)) + 2 * R) % (2 * R));
        const d = Math.hypot(x - cx, z - cz) / R, k = d > 1 ? 0 : b[3] * (1 - d * d);
        m4.compose(p.set(x, 0, z), q.setFromAxisAngle(up, b[2]), s.set(k, k, k)); mesh.setMatrixAt(i, m4); }
      mesh.instanceMatrix.needsUpdate = true; };
    mesh.userData.update(0, 0); return mesh;
  }
  // Far layers for depth: 3 rings of pixel silhouettes (far cliffs, castle spires on a cliff, near hills) that
  // fade to haze at the bottom (fake height fog). Unlit, no fog math, 3 draw calls. Add the group to the scene
  // and copy the player x, z into group.position so the horizon never gets closer.
  function backdrop(THREE) {
    const grp = new THREE.Group();
    [['farCliffs', 150, 38, -4, 3], ['castleCliff', 125, 44, -6, 1], ['nearHills', 100, 16, -2, 4]].forEach(([name, r, h, y, rep]) => {
      const t = tex(THREE, name); t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.position.y = y + h / 2; m.renderOrder = -1; grp.add(m);
    });
    // Two depth fog layers: soft haze walls at 35 m and 65 m. Trees past each wall sink a little deeper into the mist. 2 draw calls.
    [[35, 7, 0.55], [65, 12, 0.8]].forEach(([r, h, op], i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true), new THREE.MeshBasicMaterial({ map: tex(THREE, 'hazeBand'), transparent: true, opacity: op, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.position.y = h / 2 - 0.5; m.name = 'haze' + (i + 1); grp.add(m);
    });
    return grp;
  }
  // Lanternkin swarm: ALL goblins in one draw call. Camera-facing pixel billboards via instancing.
  // const sw = RealmArt.swarm(THREE, 50); scene.add(sw);
  // each tick: sw.userData.set(i, x, y, z, frame, scale); ... then sw.userData.flush();
  // frames: 0-1 spear walk, 2-3 lantern walk, 4 lunge, 5-7 dust pop. scale 0 hides one. Height is about 0.7 m at scale 1.
  function swarm(THREE, n = 50) {
    const geo = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(0.7, 0.7); q.translate(0, 0.35, 0);
    geo.index = q.index; geo.setAttribute('position', q.attributes.position); geo.setAttribute('uv', q.attributes.uv);
    const P = new Float32Array(n * 4), F = new Float32Array(n);
    const aP = new THREE.InstancedBufferAttribute(P, 4), aF = new THREE.InstancedBufferAttribute(F, 1); aP.setUsage(THREE.DynamicDrawUsage); aF.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', aP); geo.setAttribute('aFrame', aF); geo.instanceCount = n;
    const t = tex(THREE, 'lanternkin'); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    const mat = new THREE.ShaderMaterial({ transparent: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, tint: { value: new THREE.Color(1, 1, 1) } }]),
      vertexShader: `attribute vec4 aPos; attribute float aFrame; varying vec2 vUv; #include <fog_pars_vertex>
        void main() { float f = floor(aFrame + 0.5); vUv = (uv + vec2(mod(f, 4.0), 1.0 - floor(f / 4.0))) * vec2(0.25, 0.5);
          vec4 mvPosition = viewMatrix * vec4(aPos.xyz, 1.0); mvPosition.xy += position.xy * aPos.w; // billboard: offset in view space
          gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include/g, '\n#include').replace(/> /g, '>\n'),
      fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying vec2 vUv; #include <fog_pars_fragment>
        void main() { vec4 c = texture2D(map, vUv); if (c.a < 0.5) discard; gl_FragColor = vec4(c.rgb * tint, 1.0); #include <fog_fragment> }`.replace(/#include/g, '\n#include').replace(/> /g, '>\n') });
    mat.uniforms.map.value = t; mat.uniforms.tint.value.setRGB(0.95, 0.98, 1.05); // a touch of blue hour
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
    mesh.userData.set = (i, x, y, z, frame, scale) => { P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = scale; F[i] = frame; };
    mesh.userData.flush = () => { aP.needsUpdate = true; aF.needsUpdate = true; };
    return mesh;
  }
  // ---- Slice 2 builders. Each returns a Group; about 6 draw calls for a whole room. ----
  // Glue several geometries (position/normal/uv) into one so they cost one draw call.
  function mergeGeo(THREE, list) {
    const out = new THREE.BufferGeometry(), keys = ['position', 'normal', 'uv'], arr = { position: [], normal: [], uv: [] }, idx = []; let off = 0;
    list.forEach(g => { keys.forEach(k => { const a = g.attributes[k]; for (let i = 0; i < a.count; i++) { arr[k].push(a.getX(i), a.getY(i)); if (k !== 'uv') arr[k].push(a.getZ(i)); } });
      const n = g.attributes.position.count; if (g.index) g.index.array.forEach(v => idx.push(v + off)); else for (let i = 0; i < n; i++) idx.push(i + off); off += n; });
    keys.forEach(k => out.setAttribute(k, new THREE.Float32BufferAttribute(arr[k], k === 'uv' ? 2 : 3))); out.setIndex(idx); return out;
  }
  const uvScale = (g, sx, sy) => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * sx, u.getY(i) * sy); return g; };
  // keepRoom(THREE, { w, d, h, pillars, braziers, carpet }): a stone hall centred on 0,0 with its long axis on Z (throne end is -Z).
  // group.userData: walls {w,d,h}, braziers = [Vector3...] (put point lights at up to 2 of them), snuff(bool), update(t).
  function keepRoom(THREE, o = {}) {
    if (o.kit) return kitRoom(THREE, o);
    const w = o.w || 14, d = o.d || 30, h = o.h || 8, grp = new THREE.Group(), T = 4; // one texture tile = 4 m
    const st = tex(THREE, 'keepStone'); st.wrapS = st.wrapT = THREE.RepeatWrapping;
    const stone = new THREE.MeshStandardMaterial({ map: st, roughness: 0.95, color: 0xb8bcd8 });
    const walls = [[w, 0, d / 2, Math.PI], [w, 0, -d / 2, 0], [d, w / 2, 0, -Math.PI / 2], [d, -w / 2, 0, Math.PI / 2]].map(([len, x, z, ry]) => {
      const g = uvScale(new THREE.PlaneGeometry(len, h), len / T, h / T); g.rotateY(ry); g.translate(x, h / 2, z); return g; });
    const ceil = uvScale(new THREE.PlaneGeometry(w, d), w / T, d / T); ceil.rotateX(Math.PI / 2); ceil.translate(0, h, 0);
    const wallMesh = new THREE.Mesh(mergeGeo(THREE, [...walls, ceil]), stone); wallMesh.receiveShadow = true; wallMesh.name = 'keepWalls'; grp.add(wallMesh);
    const ft = tex(THREE, 'keepFloor'); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(w / 3, d / 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9, color: 0xb0b0c8 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'keepFloor'; grp.add(floor);
    if (o.carpet !== false) { const ct = tex(THREE, 'carpet'); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(1, d / 4);
      const cp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, d - 2), new THREE.MeshStandardMaterial({ map: ct, roughness: 1 })); cp.rotation.x = -Math.PI / 2; cp.position.y = 0.02; cp.receiveShadow = true; cp.name = 'carpet'; grp.add(cp); }
    // Pillars down both sides (one instanced draw call), with a square base and cap.
    const np = o.pillars != null ? o.pillars : Math.floor(d / 6), m4 = new THREE.Matrix4();
    const pg = mergeGeo(THREE, [uvScale(new THREE.CylinderGeometry(0.55, 0.6, h, 8, 1, true), 2, h / T).translate(0, h / 2, 0), uvScale(new THREE.BoxGeometry(1.5, 0.6, 1.5), 0.4, 0.15).translate(0, 0.3, 0), uvScale(new THREE.BoxGeometry(1.5, 0.5, 1.5), 0.4, 0.12).translate(0, h - 0.25, 0)]);
    const pil = new THREE.InstancedMesh(pg, stone, Math.max(1, np * 2)); pil.count = np * 2; pil.name = 'pillars'; pil.castShadow = pil.receiveShadow = true;
    for (let i = 0; i < np; i++) { const z = -d / 2 + (i + 0.5) * d / np; pil.setMatrixAt(i * 2, m4.makeTranslation(-w / 2 + 2, 0, z)); pil.setMatrixAt(i * 2 + 1, m4.makeTranslation(w / 2 - 2, 0, z)); }
    grp.add(pil);
    // Braziers: iron bowls on a leg (1 call) + blocky flame sprites (1 call, Points). Pairs, evenly down the hall between the pillars.
    const nb = o.braziers != null ? o.braziers : 4, iron = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.6, metalness: 0.4, flatShading: true });
    const bg = mergeGeo(THREE, [new THREE.CylinderGeometry(0.55, 0.3, 0.4, 8).translate(0, 1.1, 0), new THREE.CylinderGeometry(0.08, 0.12, 0.9, 5).translate(0, 0.45, 0), new THREE.CylinderGeometry(0.4, 0.45, 0.08, 8).translate(0, 0.04, 0)]);
    const bowls = new THREE.InstancedMesh(bg, iron, Math.max(1, nb)); bowls.count = nb; bowls.name = 'braziers'; const bpos = [], pairs = Math.ceil(nb / 2);
    for (let i = 0; i < nb; i++) { const z = -d / 2 + ((i >> 1) + 0.5) * d / pairs, x = (i % 2 ? 1 : -1) * (w / 2 - 3.4); bowls.setMatrixAt(i, m4.makeTranslation(x, 0, z)); bpos.push(new THREE.Vector3(x, 1.4, z)); }
    grp.add(bowls);
    addFlames(THREE, grp, bpos); grp.userData.walls = { w, d, h };
    return grp;
  }
  // Flickering pixel flames over each brazier (1 draw call) + userData.snuff/update. Shared by keepRoom and kitRoom.
  function addFlames(THREE, grp, bpos) {
    const FL = 6, nb = bpos.length, fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(Math.max(1, nb * FL) * 3), 3));
    const pt = tex(THREE, 'pxTorch'); pt.magFilter = pt.minFilter = THREE.NearestFilter; pt.generateMipmaps = false;
    const flames = new THREE.Points(fg, new THREE.PointsMaterial({ map: pt, size: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb060 }));
    flames.name = 'flames'; flames.frustumCulled = false; grp.add(flames);
    grp.userData.braziers = bpos;
    grp.userData.snuff = off => { flames.visible = !off; }; // phase 3: braziers go dark (turn their point lights off in game.js too)
    grp.userData.update = t => { const a = fg.attributes.position; // flames lick upward and flicker
      for (let b = 0; b < bpos.length; b++) for (let k = 0; k < FL; k++) { const i = b * FL + k, ph = (t * 1.6 + k / FL + b * 0.37) % 1;
        a.setXYZ(i, bpos[b].x + Math.sin(t * 7 + i) * 0.12 * (1 - ph), bpos[b].y + ph * 0.8, bpos[b].z + Math.cos(t * 5 + i) * 0.12 * (1 - ph)); }
      a.needsUpdate = true; flames.material.size = 1.0 + Math.sin(t * 13) * 0.08; };
    grp.userData.update(0);
  }

  // ---- Slice 2 kits: build whole castles from CC0 modular pieces in ~1 draw call per material. ----
  // kit(THREE, gltf.scene, modelName) -> { pieceName: [{ geo, mat }] } once per kit. Each piece sits centred on 0,0 with its base at y = 0.
  function kit(THREE, scene, name) {
    const m = MODELS[name] || {}, pieces = {}, mats = new Map(); scene.updateMatrixWorld(true);
    const mat = src => { if (!mats.has(src)) { const x = src.clone(); if (m.tint != null && x.color) x.color.multiply(new THREE.Color(m.tint)); x.roughness = m.rough != null ? m.rough : 0.9; x.metalness = 0;
      x.flatShading = style !== 'v2'; if (x.map && PIXEL.crisp) { x.map.magFilter = x.map.minFilter = THREE.NearestFilter; x.map.generateMipmaps = false; x.map.needsUpdate = true; } mats.set(src, x); } return mats.get(src); };
    const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    scene.children.forEach(top => { const list = pieces[top.name] = [];
      top.traverse(o => { if (!o.isMesh) return; const g = toFloat(THREE, o.geometry); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); list.push({ geo: g, mat: mat(o.material) }); }); });
    return pieces;
  }
  // Quantized glb attributes -> plain floats, so they can be moved and merged.
  function toFloat(THREE, src) { const g = new THREE.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(k => { const a = src.attributes[k]; if (!a) return; const n = a.itemSize, arr = new Float32Array(a.count * n);
      for (let i = 0; i < a.count; i++) { arr[i * n] = a.getX(i); arr[i * n + 1] = a.getY(i); if (n > 2) arr[i * n + 2] = a.getZ(i); } g.setAttribute(k, new THREE.BufferAttribute(arr, n)); });
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals(); if (src.index) g.setIndex(Array.from(src.index.array)); return g; }
  // bake(THREE, pieces, layout, s): layout = [[pieceName, x, z, rotY, y = 0, scale = 1], ...]. Everything is glued into one Mesh per material (static, cheap).
  function bake(THREE, pieces, layout, s = 1) {
    const grp = new THREE.Group(), byMat = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    layout.forEach(([name, x, z, ry = 0, y = 0, k = 1]) => { const p = pieces[name]; if (!p) { console.warn('RealmArt: no kit piece', name); return; }
      m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(1, 1, 1).multiplyScalar(s * k));
      p.forEach(({ geo, mat }) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(geo.clone().applyMatrix4(m4)); }); });
    byMat.forEach((list, mat) => { const mesh = new THREE.Mesh(mergeGeo(THREE, list), mat); mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'kit'; grp.add(mesh); });
    return grp;
  }
  // keepExterior(THREE, pieces, { side, s }): the Hollow King's keep from the Quaternius kit. Square curtain wall with round corner towers,
  // a gatehouse in the middle of the +Z side (the way in), and a tall central keep with a red spire. 4 draw calls total.
  // userData: gate (Vector3, in front of the gate), walk (rampart top height), half (half the wall side), size.
  function keepExterior(THREE, pieces, o = {}) {
    const s = o.s || 3, n = o.side || 6, W = 1.52 * s, half = n * W / 2, L = [];
    for (let i = 0; i < n; i++) { const a = -half + (i + 0.5) * W, pick = i % 3 === 1 ? 'wallTallBricks' : 'wallTall';
      if (!(i === n / 2 - 1 || i === n / 2)) L.push([pick, a, half, 0]);           // front, leave the middle 2 for the gatehouse
      L.push([pick, a, -half, Math.PI], [pick, half, a, Math.PI / 2], [pick, -half, a, -Math.PI / 2]); }
    L.push(['gatehouse', 0, half, 0, 0, 1.4], ['turretSquare', -W * 1.15, half + 0.4, 0, 0, 1.2], ['turretSquare', W * 1.15, half + 0.4, 0, 0, 1.2]);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => L.push(['towerRound', x * half, z * half, 0, 0, 1.25]));
    [[-1, 0], [1, 0], [0, -1]].forEach(([x, z]) => L.push(['turretRoofA', x * half, z * half, 0, 0, 1.3]));  // red-roofed turrets mid-wall
    const k = W * 0.9;  // the central keep: 4 square towers, tall walls between, and the big red spire rising from the middle
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => L.push(['towerSquare', x * k, -k * 0.6 + z * k, 0, 0, 1.3]));
    [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]].forEach(([x, z, r]) => L.push([z > 0 ? 'wallTallArch' : 'wallTallBricks', x * k, -k * 0.6 + z * k, r, 0, 1.25]));
    L.push(['keepSpire', 0, -k * 0.6, 0, 0, 2.2]);
    (o.extra || []).forEach(e => L.push(e));
    const grp = bake(THREE, pieces, L, s); grp.name = 'keepExterior';
    grp.userData = { gate: new THREE.Vector3(0, 0, half + 2.6 * s), walk: 2.35 * s, half, size: half * 2 };
    return grp;
  }
  // kitRoom = keepRoom({ kit: RealmArt.kit(THREE, interiorScene, 'keepInterior'), w, d, pillars, braziers, torches, door }): the same hall and the
  // same userData (walls, braziers, snuff, update) but built from KayKit dungeon walls, tiles, pillars, torches and banners. The size snaps to the
  // 4 m grid times s (default 1.5, so walls are 6 m tall). door: true puts a doorway in the +Z wall (the -Z throne wall stays solid). ~6 draw calls.
  function kitRoom(THREE, o) {
    const P = o.kit, s = o.s || 1.5, G = 4 * s, nx = Math.max(2, Math.ceil((o.w || 14) / G)), nz = Math.max(2, Math.round((o.d || 30) / G)), w = nx * G, d = nz * G, h = 4 * s, L = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) L.push([(i === 0 || i === nx - 1) && (i + j) % 4 === 3 ? 'floor_tile_large_rocks' : 'floor_tile_large', -w / 2 + (i + 0.5) * G, -d / 2 + (j + 0.5) * G, ((i * 7 + j * 3) % 4) * Math.PI / 2, 0.1 * s]);
    for (let i = 0; i < nx; i++) { const x = -w / 2 + (i + 0.5) * G, mid = i === Math.floor(nx / 2);
      L.push([mid ? 'wall_arched' : 'wall', x, -d / 2, 0], [mid && o.door !== false ? 'wall_doorway' : 'wall', x, d / 2, Math.PI]); }
    for (let j = 0; j < nz; j++) { const z = -d / 2 + (j + 0.5) * G; L.push([j % 2 ? 'wall_pillar' : 'wall', -w / 2, z, Math.PI / 2], [j % 2 ? 'wall_pillar' : 'wall', w / 2, z, -Math.PI / 2]); }
    const np = o.pillars != null ? o.pillars : Math.floor(nz / 1.5), bpos = [], nb = o.braziers != null ? o.braziers : 4, pairs = Math.ceil(nb / 2);
    for (let i = 0; i < np; i++) { const z = -d / 2 + (i + 0.5) * d / np; L.push(['pillar_decorated', -w / 2 + G * 0.55, z, Math.PI / 2], ['pillar_decorated', w / 2 - G * 0.55, z, -Math.PI / 2]); }
    for (let i = 0; i < nb; i++) { const z = -d / 2 + ((i >> 1) + 0.5) * d / pairs, x = (i % 2 ? 1 : -1) * Math.max(2, w / 2 - G * 0.55 - 2.2); L.push(['column', x, z, 0]); bpos.push(new THREE.Vector3(x, 1.4 * s + 0.35, z)); }
    const nt = o.torches != null ? o.torches : nz; // wall torches on the side walls (lit by the flames sprite, no extra lights)
    for (let j = 0; j < nt; j++) { const z = -d / 2 + (j + 0.5) * d / nt, side = j % 2 ? 1 : -1; L.push(['torch_mounted', side * (w / 2 - 0.5 * s), z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2 * s]); }
    L.push(['banner_patternA_red', -G * 0.9, -d / 2 + 0.5 * s, 0], ['banner_patternA_red', G * 0.9, -d / 2 + 0.5 * s, 0], ['candle_triple', -G * 0.5, -d / 2 + 1.2 * s, 0], ['candle_triple', G * 0.5, -d / 2 + 1.2 * s, 0.5]);
    (o.extra || []).forEach(e => L.push(e));
    const grp = bake(THREE, P, L, s); grp.name = 'kitRoom';
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x1a1824, roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; ceil.name = 'ceiling'; grp.add(ceil);
    if (o.carpet !== false) { const ct = tex(THREE, 'carpet'); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(1, d / 4);
      const cp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, d - 2), new THREE.MeshStandardMaterial({ map: ct, roughness: 1 })); cp.rotation.x = -Math.PI / 2; cp.position.y = 0.2 * s; cp.receiveShadow = true; cp.name = 'carpet'; grp.add(cp); }
    addFlames(THREE, grp, bpos); grp.userData.walls = { w, d, h };
    return grp;
  }
  // deathClip(name): a random one of the three skeleton deaths, e.g. clip(gltf.animations, RealmArt.deathClip('skelMinion')).
  const deathClip = name => { const a = ANIMS[name] || {}; const l = [a.Death_A, a.Death_B, a.Death_C].filter(Boolean); return l.length ? l[Math.floor(Math.random() * l.length)] : a.death; };
  // altar(THREE): stone plinth + glowing rune circle + 3 Ember sockets + a light column when all 3 are lit. 4 draw calls.
  // group.userData.setLit(n) with n = 0..3, update(t) every frame. Add LIGHTS.throne.altar as a point light above it once lit.
  function altar(THREE) {
    const grp = new THREE.Group(), st = tex(THREE, 'keepStone'); st.wrapS = st.wrapT = THREE.RepeatWrapping;
    const stone = new THREE.MeshStandardMaterial({ map: st, color: 0xc8c0d8, roughness: 0.9 });
    const g = mergeGeo(THREE, [uvScale(new THREE.BoxGeometry(2.6, 0.3, 2.6), 0.7, 0.1).translate(0, 0.15, 0), uvScale(new THREE.BoxGeometry(2, 0.9, 2), 0.5, 0.25).translate(0, 0.75, 0), uvScale(new THREE.BoxGeometry(2.3, 0.18, 2.3), 0.6, 0.05).translate(0, 1.29, 0)]);
    const base = new THREE.Mesh(g, stone); base.castShadow = base.receiveShadow = true; base.name = 'altarStone'; grp.add(base);
    const rt = tex(THREE, 'runeRing'); rt.magFilter = rt.minFilter = THREE.NearestFilter; rt.generateMipmaps = false;
    const ringMat = new THREE.MeshBasicMaterial({ map: rt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25 });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.32; ring.name = 'runeRing'; grp.add(ring);
    const sockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, roughness: 0.4, flatShading: true });
    const sock = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2, 0), sockMat, 3), m4 = new THREE.Matrix4(), c = new THREE.Color(); sock.name = 'emberSockets';
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 - Math.PI / 2; sock.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * 0.65, 1.55, Math.sin(a) * 0.65)); sock.setColorAt(k, c.setRGB(0.2, 0.18, 0.25)); }
    grp.add(sock);
    const colMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 14, 10, 1, true), colMat); col.position.y = 8.3; col.visible = false; col.name = 'lightColumn'; grp.add(col);
    let lit = 0;
    grp.userData.setLit = n => { lit = Math.max(0, Math.min(3, n)); for (let k = 0; k < 3; k++) sock.setColorAt(k, k < lit ? c.setRGB(3, 2.2, 0.8) : c.setRGB(0.2, 0.18, 0.25)); sock.instanceColor.needsUpdate = true; col.visible = lit === 3; };
    grp.userData.update = t => { const pulse = 0.5 + 0.5 * Math.sin(t * 3); ringMat.opacity = 0.25 + lit * 0.22 + pulse * 0.08 * lit; ring.rotation.z = t * 0.15;
      sockMat.emissive.setRGB(lit ? 0.5 + 0.3 * pulse : 0, lit ? 0.3 + 0.2 * pulse : 0, lit ? 0.05 : 0); if (col.visible) colMat.opacity = 0.07 + pulse * 0.05; };
    grp.userData.setLit(0); grp.userData.update(0); return grp;
  }
  // shockwave(THREE): the Hollow King's slam ring. fire(x, z, maxRadius = 7, seconds = 0.6), update(dt) every frame.
  // radius() = current ring radius (hurt Aldren when |distance - radius| < 0.6 and he isn't rolling); active() = still expanding. 1 draw call while active.
  function shockwave(THREE) {
    const st = tex(THREE, 'shockRing'); st.magFilter = st.minFilter = THREE.NearestFilter; st.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: st, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.08; m.visible = false; m.name = 'shockwave';
    let t = 0, dur = 0.6, R = 7; const ease = () => 1 - (1 - Math.min(1, t / dur)) ** 2;
    m.userData.fire = (x, z, maxR = 7, sec = 0.6) => { m.position.x = x; m.position.z = z; R = maxR; dur = sec; t = 0; m.visible = true; m.userData.update(0); };
    m.userData.update = dt => { if (!m.visible) return; t += dt; const r = Math.max(0.01, R * ease() / 0.85); // ring sits at 85% of the texture radius
      m.scale.set(r, r, 1); mat.opacity = 1 - Math.min(1, t / dur) ** 2; if (t >= dur) m.visible = false; };
    m.userData.radius = () => R * ease();
    m.userData.active = () => m.visible;
    return m;
  }
  // kingPhase(root, n): 1 = cold violet, 2 = brighter violet (he raises knights), 3 = ember-red rim (braziers snuffed; only torchlight hurts him).
  function kingPhase(root, n) {
    const rimC = n === 3 ? [1.5, 0.35, 0.25] : n === 2 ? [0.9, 0.5, 1.7] : [0.7, 0.42, 1.1], em = n === 3 ? 0x2a0808 : n === 2 ? 0x241040 : 0x1a0828;
    root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(mat => {
      if (mat.userData.rim) { const v = mat.userData.rim.value; v[0] = rimC[0]; v[1] = rimC[1]; v[2] = rimC[2]; } if (mat.emissive) mat.emissive.setHex(em); }); });
  }

  // ---- Part 3 combat telegraphs (all canvas-drawn, pixel style, 1 draw call each while visible) ----
  const pxCanvas = (n, draw) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); return c; };
  const pxTex = (THREE, c) => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
  // glint(THREE, size = 0.55): red 4-point star Sprite. Parent it to the weapon tip. flash(sec = 0.35) at wind-up start, update(dt) every frame.
  function glint(THREE, size = 0.55) {
    const c = pxCanvas(16, (g, n) => { const h = n / 2; g.fillStyle = '#ff2a1a'; g.fillRect(h - 1, 1, 2, n - 2); g.fillRect(1, h - 1, n - 2, 2);
      g.fillStyle = '#ff8a60'; g.fillRect(h - 2, h - 2, 4, 4); g.fillStyle = '#fff4e0'; g.fillRect(h - 1, h - 1, 2, 2); });
    const mat = new THREE.SpriteMaterial({ map: pxTex(THREE, c), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false });
    const sp = new THREE.Sprite(mat); sp.name = 'glint'; sp.visible = false; sp.renderOrder = 20; let t = 0, dur = 0.35;
    sp.userData.flash = (sec = 0.35) => { dur = sec; t = 0; sp.visible = true; sp.userData.update(0); };
    sp.userData.update = dt => { if (!sp.visible) return; t += dt; const k = Math.min(1, t / dur), pop = Math.sin(k * Math.PI);
      const s = size * (0.4 + pop); sp.scale.set(s, s, 1); mat.rotation = k * 1.2; mat.opacity = pop; if (k >= 1) sp.visible = false; };
    return sp;
  }
  // dangerRing(THREE, radius = 3): red ground warning for heavy (roll-only) attacks. show(x, z, sec) = wind-up length; the inner disc
  // fills outward and hits the rim exactly when the attack lands (then a white flash). hide() cancels. progress() = 0..1. update(dt).
  function dangerRing(THREE, radius = 3) {
    const c = pxCanvas(64, (g, n) => { const h = n / 2; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      if (d > 1) continue; const hatch = ((x + y) >> 2) & 1; g.fillStyle = d > 0.88 ? '#ff2a1a' : d > 0.8 ? '#7a0c08' : hatch ? 'rgba(255,40,26,0.28)' : 'rgba(120,10,8,0.18)'; g.fillRect(x, y, 1, 1); } });
    const mk = (op) => new THREE.MeshBasicMaterial({ map: pxTex(THREE, c), transparent: true, depthWrite: false, fog: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -2 });
    const grp = new THREE.Group(); grp.name = 'dangerRing'; grp.visible = false;
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mk(0.9)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.06;
    const fillM = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 20), fillM); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.07;
    grp.add(rim, fill); grp.scale.set(radius, 1, radius); let t = 0, dur = 1, after = 0;
    grp.userData.show = (x, z, sec = 1, r = radius) => { grp.position.set(x, grp.position.y, z); grp.scale.set(r, 1, r); dur = sec; t = 0; after = 0; grp.visible = true; grp.userData.update(0); };
    grp.userData.hide = () => { grp.visible = false; };
    grp.userData.progress = () => Math.min(1, t / dur);
    grp.userData.update = dt => { if (!grp.visible) return; t += dt; const k = Math.min(1, t / dur);
      if (k < 1) { const f = Math.max(0.02, k); fill.scale.set(f, f, 1); fillM.color.setHex(0xff2a1a); fillM.opacity = 0.25 + 0.2 * k; rim.material.opacity = 0.6 + 0.4 * (Math.sin(t * 18) > 0 ? k : 0); }
      else { after += dt; fill.scale.set(1, 1, 1); fillM.color.setHex(0xfff0e0); fillM.opacity = Math.max(0, 0.7 - after * 5); rim.material.opacity = Math.max(0, 1 - after * 5); if (after > 0.15) grp.visible = false; } };
    return grp;
  }
  // HUD bars (DOM, pixel style). bar('stamina', parent) or bar('poise', parent) returns { el, set(0..1), winded(on), flashBreak(), place(x, y) }.
  // Stamina: gold, turns grey and blinks when winded (0 stamina = double damage). Poise: small bar over an enemy; place() with screen px
  // from vector.project(camera); flashBreak() when a parry or hits break it. All sizes fit 390px; bars are display-only (no touch).
  const HUD_CSS = `.ra-bar{position:absolute;pointer-events:none;image-rendering:pixelated;background:#1a1020;border:2px solid #0a0610;box-shadow:0 0 0 1px #6a5a7a inset;}
.ra-bar>i{display:block;height:100%;width:100%;transform-origin:left;transition:transform .08s steps(4);}
.ra-stam{left:12px;top:40px;width:120px;height:10px}.ra-stam>i{background:linear-gradient(#ffe08a 0 40%,#e0a030 40%)}
.ra-stam.winded>i{background:#6a6070}.ra-stam.winded{animation:raBlink .25s steps(2) infinite;border-color:#ff2a1a}
.ra-poise{width:44px;height:6px;margin-left:-22px;margin-top:-3px;border-width:1px}.ra-poise>i{background:linear-gradient(#fff 0 35%,#c8b8e0 35%)}
.ra-poise.broke{animation:raBreak .4s steps(3)}.ra-poise.broke>i{background:#ff2a1a}
@keyframes raBlink{50%{opacity:.35}}@keyframes raBreak{0%{transform:scale(1.8)}100%{transform:scale(1)}}`;
  function bar(kind, parent = document.body) {
    if (!document.getElementById('ra-hud-css')) { const st = document.createElement('style'); st.id = 'ra-hud-css'; st.textContent = HUD_CSS; document.head.appendChild(st); }
    const el = document.createElement('div'); el.className = 'ra-bar ra-' + (kind === 'poise' ? 'poise' : 'stam'); const i = document.createElement('i'); el.appendChild(i); parent.appendChild(el);
    return { el, set: v => { i.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`; }, winded: on => el.classList.toggle('winded', !!on),
      flashBreak: () => { el.classList.remove('broke'); void el.offsetWidth; el.classList.add('broke'); }, place: (x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; },
      remove: () => el.remove() };
  }
  // Pixel glows: blocky additive sprites. Use tex(THREE, 'pxTorch') etc. on a THREE.Sprite with AdditiveBlending.
  const cache = {};
  function texture(name) { return cache[name] || (cache[name] = TEX[name]()); }
  window.RealmArt = { PAL, LIGHTS, MODELS, ANIMS, PIXEL, STYLES, useStyle, get style() { return style; }, GRASS, clip, tint, fit, dressHero, pixelPass, tex, shadows, grass, backdrop, swarm, keepRoom, altar, shockwave, kingPhase, glint, dangerRing, bar, HUD_CSS, kit, bake, keepExterior, kitRoom, deathClip, texture, textures: Object.keys(TEX) };
})();
