// ============================================================
// GRAVELIGHT ART - original pixel art by Game Artist.
// Every sprite is a tiny text grid: one letter = one pixel color.
// At load, each grid is painted once onto a small hidden canvas,
// so drawing is fast and there are no image files to download.
// Usage: Art.draw(ctx, 'knight', x, feetY, {frame, flip, scale})
//   x, feetY = bottom-center of the sprite (where it stands).
// ============================================================
const Art = (() => {
  const PAL = {
    k: '#0b0612', // outline / night black
    d: '#1c1128', // deep purple
    p: '#3d2a55', // purple stone
    l: '#6b5a8a', // light steel purple
    b: '#e9e2d0', // bone white
    g: '#a89f8c', // bone shade
    w: '#6b4a2b', // torch wood
    o: '#ff9a3c', // torch orange
    y: '#ffd36b', // flame yellow
    r: '#c2410c', // ember red
    s: '#2b1044', // shadow body
    m: '#4a1d6e', // shadow highlight
    e: '#ff3b6b', // shadow eyes
  };

  // name: [ [frame rows...], ... ]   ('.' = see-through)
  const SPR = {
    knight: [[ // idle
      '....kkkk......',
      '...kllllk.....',
      '..kllllllk....',
      '..klkkkklk....',
      '..kllllllk....',
      '...kllllk.....',
      '..kkppppkk....',
      '.kbbpppbbbk...',
      '.kbbbpbbbbk...',
      '.kgbbbbbbbkk..',
      '.kgbbbbbbbbk..',
      '.kgbbbbbbbbk..',
      '..kppppppkk...',
      '..kbbbbbbk....',
      '..kbbkkbbk....',
      '..kbbk.kbbk...',
      '..kppk.kppk...',
      '..kkkk.kkkk...',
    ], [ // swing (arm thrust forward)
      '....kkkk......',
      '...kllllk.....',
      '..kllllllk....',
      '..klkkkklk....',
      '..kllllllk....',
      '...kllllk.....',
      '..kkppppkk....',
      '.kbbpppbbbkkkk',
      '.kbbbpbbbbbbbk',
      '.kgbbbbbbbkkkk',
      '.kgbbbbbbbk...',
      '.kgbbbbbbk....',
      '..kppppppk....',
      '..kbbbbbbk....',
      '.kbbk.kbbk....',
      '.kbbk..kbbk...',
      '.kppk..kppk...',
      '.kkkk..kkkk...',
    ]],
    shadow: [[
      '....ssss....',
      '..ssmmssss..',
      '.ssmmsssss..',
      '.smssssssss.',
      'ssmsesssess.',
      'ssssssssssss',
      'sssssssssss.',
      '.sssssssssss',
      'ssssssssssss',
      '.ssssssssss.',
      'ss.sssss.sss',
      's..ss.ss..s.',
      '...s...s....',
    ], [
      '............',
      '...ssss.....',
      '.sssmmssss..',
      '.smmsssssss.',
      'ssmsesssess.',
      'ssssssssssss',
      'sssssssssss.',
      'ssssssssssss',
      '.ssssssssss.',
      'sssssssssss.',
      'sss.sss.sss.',
      '.s..ss..s..s',
      '..s....s....',
    ]],
    torch: [[
      '..y...', '.yy.o.', '.yoyo.', 'oyyyoo', 'ooyoor', '.roor.',
      '..ww..', '..ww..', '..ww..', '..ww..', '..ww..', '..ww..',
    ], [
      '...y..', '.o.yy.', '.oyoy.', 'ooyyyo', 'royooo', '.roor.',
      '..ww..', '..ww..', '..ww..', '..ww..', '..ww..', '..ww..',
    ]],
    puff: [[ // burn puff, 3 frames
      '........', '........', '...yo...', '..oyyo..', '..oyyr..', '...or...', '........', '........',
    ], [
      '........', '..o..y..', '.y.ro...', '..oyo.o.', '.o.yyr..', '..r..o..', '....r...', '........',
    ], [
      '.o....y.', '....r...', 'r.......', '......o.', '.y......', '.......r', '..r..o..', 'o.......',
    ]],
    tombA: [[
      '...kkkkkk...',
      '..kppppppk..',
      '.kpppllppdk.',
      '.kpplllppdk.',
      '.kppplpppdk.',
      '.kppplpppdk.',
      '.kpppppppdk.',
      '.kpppppppdk.',
      '.kppdppppdk.',
      '.kpppppdpdk.',
      '.kpppppppdk.',
      'kkkkkkkkkkkk',
      'kddddddddddk',
      'kkkkkkkkkkkk',
    ]],
    tombB: [[
      '....kkkk....',
      '....kplk....',
      '.kkkkplkkkk.',
      '.kppppplllk.',
      '.kkkkpplkkk.',
      '....kplk....',
      '....kplk....',
      '....kpdk....',
      '...kkpdkk...',
      '..kkddddkk..',
      '..kkkkkkkk..',
    ]],
    tree: [[
      '...k..........k.',
      '...dk........kd.',
      '....dk..k...kd..',
      '.k...dk.dk.kd...',
      '.dk...dddkkd....',
      '..dd...ddkd.....',
      '...ddk.ddd..kk..',
      '....dddddd.kdd..',
      '.......ddddd....',
      '.......dddd.....',
      '.......ddd......',
      '.......ddd......',
      '.......ddd......',
      '......dddd......',
      '......ddpd......',
      '......ddpd......',
      '......dddd......',
      '......ddpd......',
      '.....dddpdd.....',
      '....dddddddd....',
      '...dd.dddd.dd...',
    ]],
    ground: [[ // repeats sideways
      'pplpppppplpppppl',
      'dpdddpdddddpdddd',
      'dddddddkdddddddd',
      'ddkddddddddddkdd',
      'dddddddddddddddd',
      'ddddkddddddkdddd',
    ]],
  };

  // ================= v2: top-down dungeon art =================
  Object.assign(PAL, {
    c: '#8fd3ff', v: '#d8f3ff', n: '#3a6fb0',   // wisp blues
    x: '#d4af37', z: '#8a6d1f',                 // gold, dark gold
    h: '#4ade80', u: '#60a5fa', q: '#ff4d6d',   // green gem, blue gem, potion red
    j: '#e9d9a8', t: '#8f8676',                 // parchment, old bone
  });
  // Swap letters in a grid: recolor(rows, {a:'x'})
  const recolor = (rows, m) => rows.map((r) => r.replace(/./g, (ch) => m[ch] || ch));

  // Tile templates use 1-4 as "shade slots" that each floor fills with its own colors.
  const WALL = [
    '3333333333333333',
    '2222222222222222',
    '4444444444444444',
    '1222222212222222',
    '1222222212222222',
    '1222222212222222',
    '1111111111111111',
    '2222122222221222',
    '2222122222221222',
    '2222122222221222',
    '1111111111111111',
    '1222222212222222',
    '1222222212222222',
    '1222222212222222',
    '1111111111111111',
    'kkkkkkkkkkkkkkkk',
  ];
  const FLOOR = [
    '2222222122222221',
    '2322222122222221',
    '2222222122242221',
    '2222222122222221',
    '2224222122222221',
    '2222222111111111',
    '2222222122222221',
    '1111111122223221',
    '2222122222222221',
    '2222122222222221',
    '2322122224222221',
    '2222122222222221',
    '2222122222222221',
    '2222111111111111',
    '2222122222222222',
    '1111111111111111',
  ];
  const STAIRS = [
    'kkkkkkkkkkkkkkkk',
    'k33333333333333k',
    'k22222222222222k',
    'k11111111111111k',
    'kk333333333333kk',
    'kk222222222222kk',
    'kk111111111111kk',
    'kkk3333333333kkk',
    'kkk2222222222kkk',
    'kkk1111111111kkk',
    'kkkk33333333kkkk',
    'kkkk22222222kkkk',
    'kkkk11111111kkkk',
    'kkkkk333333kkkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
  ];
  // Floor looks: 1 Crypt (grey stone + purple moss), 2 Catacombs (bone + deep blue), 3 Tomb (black marble + gold)
  const FLOORPAL = [
    { wall: ['#1b1822', '#3b3547', '#5a5268', '#4a2d63'], floor: ['#1d1924', '#2a2533', '#3a3345', '#4a2d63'] },
    { wall: ['#5e574c', '#8f8676', '#c9bfa8', '#0e1222'], floor: ['#0e1222', '#141a2e', '#222c4c', '#2c3a66'] },
    { wall: ['#08060a', '#141018', '#241e2a', '#d4af37'], floor: ['#08060a', '#0f0c12', '#1a161f', '#3a2f14'] },
  ];
  FLOORPAL.forEach((fp, i) => {
    const map = (c) => ({ 1: c[0], 2: c[1], 3: c[2], 4: c[3] });
    SPR['wall' + (i + 1)] = [{ rows: WALL, pal: map(fp.wall) }];
    SPR['floor' + (i + 1)] = [{ rows: FLOOR, pal: map(fp.floor) }];
    SPR['stairs' + (i + 1)] = [{ rows: STAIRS, pal: map(fp.wall) }];
  });

  // Hero (Aldren) seen from above: Down = facing you, Up = back, Side = facing right.
  const HEAD = ['....kkkk....', '...kllllk...', '..kllllllk..'];
  SPR.heroDown = [
    [...HEAD, '..klkkkklk..', '..kllllllk..', '...kllllk...', '..kbbppbbk..', '.kbbbppbbbk.', '.kgbbppbbgk.',
     '.kgbbbbbbgk.', '..kppppppk..', '..kbbkkbbk..', '..kbk..kbk..', '..kkk..kkk..'],
    [...HEAD, '..klkkkklk..', '..kllllllk..', '...kllllk...', '..kbbppbbk..', '.kbbbppbbbk.', '.kgbbppbbgk.',
     '.kgbbbbbbgk.', '..kppppppk..', '..kbbkkbbk..', '..kbk..kkk..', '..kkk.......'],
  ];
  SPR.heroUp = [
    [...HEAD, '..kllllllk..', '..kllllllk..', '...kllllk...', '..kppppppk..', '.kbppppppbk.', '.kgppppppgk.',
     '.kgppppppgk.', '..kppppppk..', '..kbbkkbbk..', '..kbk..kbk..', '..kkk..kkk..'],
    [...HEAD, '..kllllllk..', '..kllllllk..', '...kllllk...', '..kppppppk..', '.kbppppppbk.', '.kgppppppgk.',
     '.kgppppppgk.', '..kppppppk..', '..kbbkkbbk..', '..kkk..kbk..', '.......kkk..'],
  ];
  SPR.heroSide = [
    [...HEAD, '..kllllkkk..', '..kllllllk..', '...kllllk...', '...kbbbbk...', '..kbbbbbbk..', '..kpbbbbbk..',
     '..kpbbbbbk..', '...kppppk...', '...kbbbbk...', '...kbkkbk...', '...kk..kk...'],
    [...HEAD, '..kllllkkk..', '..kllllllk..', '...kllllk...', '...kbbbbk...', '..kbbbbbbk..', '..kpbbbbbk..',
     '..kpbbbbbk..', '...kppppk...', '...kbbbbk...', '..kbk.kbk...', '..kk...kk...'],
  ];

  // Enemies
  SPR.shade = SPR.shadow;
  SPR.wisp = [
    ['...cc...', '..cvvc..', '.cvvvvc.', '.cvkvkc.', '.cvvvvc.', '..cvvc..', '.c.cc.c.', '..c..c..', '...n....'],
    ['...c....', '..cvvc..', '.cvvvvc.', '.cvkvkc.', '.cvvvvc.', '..cvvc..', '..cccc..', '.c.nn.c.', '....n...'],
  ];
  SPR.crawler = [
    ['.k..k....k..k.', '..kgk.kk.kgk..', '...kbkbbkbk...', '..kbbbbbbbbk..', '.kbgbebbebgbk.',
     '.kbbbbbbbbbbk.', '..kbkbkbkbkk..', '.kgk......kgk.', 'k.k........k.k'],
    ['..k.k....k.k..', '...kgkkkkgk...', '...kbkbbkbk...', '..kbbbbbbbbk..', '.kbgbebbebgbk.',
     '.kbbbbbbbbbbk.', '..kkbkbkbkbk..', '..kgk....kgk..', '.k.k......k.k.'],
  ];
  const KING = [
    '...x..x..x..x...',
    '...xxxxxxxxxx...',
    '...xzxxzxxzxx...',
    '..kkkkkkkkkkkk..',
    '..kddddddddddk..',
    '..kdkeekkeekdk..',
    '..kddddddddddk..',
    '..kdddkkkkdddk..',
    '...kddddddddk...',
    '..kkssssssssk...',
    '.kssmsssssmssk..',
    'kssmssxxssmsssk.',
    'ksmsssxxsssmssk.',
    'ksmssssssssmssk.',
    'kssmssssssmsssk.',
    '.ksmssssssmssk..',
    '.kssmssssmsssk..',
    'kssssmssmssssk..',
    'ksmsmssssmsmsk..',
    '.k.k.k..k.k.k...',
  ];
  SPR.king = [KING, [...KING.slice(0, 17), '.kssssmssmssssk.', '.ksmsmssssmsmsk.', '..k.k.k..k.k.k..']];

  // Objects
  SPR.chest = [[
    '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwzzzzzzzzwk', 'kkkkkxxkkkkk', 'kwwwwxxwwwwk',
    'kwwwwkkwwwwk', 'kwwwwwwwwwwk', 'kzwwwwwwwwzk', 'kkkkkkkkkkkk',
  ]];
  SPR.chestOpen = [[
    '.kkkkkkkkkk.', 'kwzzzzzzzzwk', 'kkkkkkkkkkkk', 'kkyxkkkxykkk', 'kwwwwwwwwwwk',
    'kwwwwxxwwwwk', 'kwwwwwwwwwwk', 'kzwwwwwwwwzk', 'kkkkkkkkkkkk',
  ]];
  SPR.tomb = SPR.tombA;
  SPR.scroll = [[
    '.kkkkkkkkk..', 'kjjjjjjjjjk.', 'kwkjjjjjjjjk', '.kjrrjrjjjk.', '.kjjjjjjjjk.',
    '.kjrjrrjrjk.', 'kjjjjjjjjkwk', '.kjjjjjjjjjk', '..kkkkkkkkk.',
  ]];
  SPR.carving = [[
    'kkkkkkkkkkkkkkkk', 'kppppppppppppppk', 'kpdddddddddddddk', 'kpdddddhddddddpk', 'kpddddhhhdddddpk',
    'kpdddhdhdhddddpk', 'kpddddhhhdddddpk', 'kpdddddhddddddpk', 'kpddhdddddhdddpk', 'kpdddhhhhhddddpk',
    'kpdddddddddddddk', 'kppppppppppppppk', 'kkkkkkkkkkkkkkkk',
  ]];

  // Item icons (12x12). Swords share one shape, recolored by rarity/material.
  const SWORD = [
    '..........kk', '.........kAk', '........kABk', '.......kABk.', '......kABk..', '.....kABk...',
    '.kk.kABk....', '.kGkABk.....', '..kGGk......', '.kHkGGk.....', 'kHk..kk.....', 'kk..........',
  ];
  SPR.item_rusted = [recolor(SWORD, { A: 't', B: 'w', G: 'w', H: 'p' })];
  SPR.item_gravesteel = [recolor(SWORD, { A: 'v', B: 'l', G: 'h', H: 'd' })];
  SPR.item_dawnedge = [recolor(SWORD, { A: 'y', B: 'o', G: 'x', H: 'w' })];
  const TORCHICON = ['...y....', '..yyo...', '..oyyo..', '.royyor.', '.rooor..', '..kwwk..', '...ww...', '...ww...', '...ww...', '...ww...', '..kwwk..'];
  SPR.item_pitch = [TORCHICON];
  SPR.item_everember = [recolor(TORCHICON, { y: 'v', o: 'c', r: 'n' })];
  SPR.item_chain = [[
    '..kk....kk..', '.kllk..kllk.', 'klllkkkkllk.', 'klpllllllpk.', '.klplplplk..', '.kllplplpk..',
    '.klplplplk..', '.kllplplpk..', '.kkkkkkkkk..',
  ]];
  const RING = ['....kk....', '...kGGk...', '...kGGk...', '..kxkkxk..', '.kx....xk.', '.kx....xk.', '.kz....zk.', '..kzzzzk..', '...kkkk...'];
  SPR.item_quickstep = [recolor(RING, { G: 'h' })];
  SPR.item_embers = [recolor(RING, { G: 'o' })];
  SPR.item_potion = [[
    '....kk....', '...kwwk...', '....kk....', '...kvvk...', '..kvqqvk..', '.kqqqqqqk.', '.kqyqqqqk.', '.kqqqqqrk.', '..krrrrk..', '...kkkk...',
  ]];
  SPR.item_oil = [[
    '...kkk....', '..kwwwk...', '...kok....', '..kkkkkk..', '.kooooook.', '.koyooork.', '.kooooork.', '.korrrrrk.', '..kkkkkk..',
  ]];
  SPR.item_gold = [[
    '..........', '....kkk...', '...kxyxk..', '..kkxxzkk.', '.kxykzkxyk', '.kxxzkkxxk', 'kxykxyxkzk', 'kxxzxxzkkk', '.kkkkkkkk.',
  ]];

  // Paint every frame onto its own tiny canvas once.
  // A frame is either a list of rows, or {rows, pal} with its own colors.
  const cache = {};
  for (const name in SPR) {
    cache[name] = SPR[name].map((f) => {
      const rows = f.rows || f, pal = f.pal ? { ...PAL, ...f.pal } : PAL;
      const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
      }));
      return c;
    });
  }

  // Draw a sprite standing at (x, feetY). flip = face left.
  function draw(ctx, name, x, feetY, o = {}) {
    const frames = cache[name], s = o.scale || 2;
    const img = frames[(o.frame || 0) % frames.length];
    const w = img.width * s, h = img.height * s;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(x), Math.round(feetY));
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-w / 2), -h, w, h);
    ctx.restore();
  }

  // Fill a strip with the ground tile.
  function ground(ctx, y, width, s = 2) {
    const t = cache.ground[0];
    for (let x = 0; x < width; x += t.width * s) ctx.drawImage(t, x, y, t.width * s, t.height * s);
  }

  // Chunky pixel ring (for Flare and Ward). t goes 0 -> 1 over the effect.
  function ring(ctx, cx, cy, r, colors, alpha, px = 4) {
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
    const steps = Math.max(16, Math.floor(r * 0.8));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(Math.round((cx + Math.cos(a) * r) / px) * px, Math.round((cy + Math.sin(a) * r) / px) * px, px, px);
    }
    ctx.restore();
  }
  // Flare: two hot rings plus flying sparks.
  function flare(ctx, cx, cy, r, alpha) {
    ring(ctx, cx, cy, r, ['#ffd36b', '#ff9a3c'], alpha, 4);
    ring(ctx, cx, cy, r * 0.7, ['#ff9a3c', '#c2410c'], alpha * 0.8, 3);
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha); ctx.fillStyle = '#ffd36b';
    for (let i = 0; i < 10; i++) { const a = i * 0.63; ctx.fillRect(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1, 3, 3); }
    ctx.restore();
  }
  // Ward: a flat, heavy shockwave along the ground (pale purple and bone).
  function ward(ctx, cx, groundY, r, alpha) {
    ctx.save(); ctx.translate(cx, groundY); ctx.scale(1, 0.35);
    ring(ctx, 0, 0, r, ['#e9e2d0', '#6b5a8a', '#6b5a8a'], alpha, 5);
    ring(ctx, 0, 0, r * 0.8, ['#6b5a8a', '#3d2a55'], alpha * 0.7, 4);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha); ctx.fillStyle = '#e9e2d0';
    for (let i = -3; i <= 3; i++) ctx.fillRect(cx + i * r * 0.3, groundY - 4 - Math.abs(i) * 2, 3, 3); // dust
    ctx.restore();
  }

  // Sword slash: a chunky bone-white arc. angle = facing direction in radians, alpha fades it.
  function slash(ctx, cx, cy, angle, r, alpha) {
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
    for (let i = -6; i <= 6; i++) {
      const a = angle + i * 0.15, rr = r - Math.abs(i) * 0.8;
      ctx.fillStyle = Math.abs(i) < 3 ? '#ffffff' : '#e9e2d0';
      ctx.fillRect(Math.round(cx + Math.cos(a) * rr) - 2, Math.round(cy + Math.sin(a) * rr) - 2, 4, 4);
      ctx.fillStyle = '#a89f8c';
      ctx.fillRect(Math.round(cx + Math.cos(a) * (rr - 5)) - 1, Math.round(cy + Math.sin(a) * (rr - 5)) - 1, 3, 3);
    }
    ctx.restore();
  }
  // Darkness ring from the Hollow King: purple and black.
  function voidRing(ctx, cx, cy, r, alpha = 1) {
    ring(ctx, cx, cy, r, ['#7c3aed', '#2b1044', '#4a1d6e'], alpha * 0.95, 5);
    ring(ctx, cx, cy, r - 5, ['#0b0612', '#2b1044'], alpha * 0.8, 4);
  }
  // Item icon for menus (top-left corner at x, y).
  function icon(ctx, id, x, y, scale = 3) {
    const img = cache['item_' + id][0];
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale); ctx.restore();
  }
  // Same icon as a data URL, handy for <img> tags in an HTML inventory.
  function iconURL(id, scale = 3) {
    const img = cache['item_' + id][0], c = document.createElement('canvas');
    c.width = img.width * scale; c.height = img.height * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL();
  }

  return { draw, ground, ring, flare, ward, slash, voidRing, icon, iconURL, PAL, has: (n) => n in cache };

})();
