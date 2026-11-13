// ============================================================
// GRAVELIGHT 3D - backup art by Game Coder.
// If Game Artist's sprites.js already has a sprite with the same
// name (ember, altar, boneKey, gildedKey, vaultDoor, tombDoor,
// stairsVeiled1-3, warden, swordFP...), the game uses theirs.
// These simple ones only fill the gaps so nothing is ever missing.
// Same API as Art: Art3D.draw(ctx, name, x, feetY, {frame, scale})
// ============================================================
const Art3D = (() => {
  const PAL = {
    k: '#0b0612', d: '#1c1128', p: '#3d2a55', l: '#6b5a8a', b: '#e9e2d0', g: '#a89f8c',
    w: '#6b4a2b', o: '#ff9a3c', y: '#ffd36b', r: '#c2410c', v: '#fff4d6', x: '#d4af37',
    z: '#8a6d1f', t: '#8f8676', e: '#ff3b6b', h: '#4ade80', c: '#8fd3ff',
  };
  const recolor = (rows, m) => rows.map((r) => r.replace(/./g, (ch) => m[ch] || ch));

  const EMBER = ['....y.....', '...yoy....', '..yooy.y..', '..oyyoyo..', '.oyvvyoo..',
    '.oyvvvyor.', '.royvvyor.', '.rooyyoor.', '..rrooorr.', '...rrrrr..', '....kkk...'];
  const EMBER2 = ['.....y....', '..y.yoy...', '..yoooy...', '.oyyyoyo..', '.oyvvyoo..',
    '.oyvvvyor.', '.royvvyor.', '.rooyyoor.', '..rrooorr.', '...rrrrr..', '....kkk...'];
  const ALTAR = ['................', '................', '................',
    '.kk....kk....kk.', 'kzzk..kzzk..kzzk', '.kk....kk....kk.', '.kkkkkkkkkkkkkk.',
    'kllllllllllllllk', 'kppppxppppxppppk', 'kkkkkkkkkkkkkkkk', '..kpppppppppk...',
    '..kppllpplppk...', '..kpppppppppk...', '.kkkkkkkkkkkkk..'];
  const ALTAR_LIT = recolor(ALTAR.slice(3), {}); // flames go on top
  ALTAR_LIT.unshift('.y.....y.....y..', 'yoy...yoy...yoy.', '.o.....o.....o..');
  const KEY = ['..kkk.......', '.kAAAk......', 'kAk.kAk.....', 'kAk.kAk.....', '.kAAAAk.....',
    '..kkkAAk....', '.....kAAk...', '......kAAk..', '.....kAkAAk.', '......k.kAk.', '.........kk.'];
  const DOOR = ['kkkkkkkkkkkkkkkk', 'kwwwwwkwwwwwwwwk', 'kllllllllllllllk', 'kwwwwwkwwwwwwwwk',
    'kwwwwwkwwwwwwwwk', 'kwwwwwkwwwwwwwwk', 'kllllllllllllllk', 'kwwwwwkwwkxxkwwk',
    'kwwwwwkwwkxkkwwk', 'kwwwwwkwwkxxkwwk', 'kllllllllllllllk', 'kwwwwwkwwwwwwwwk',
    'kwwwwwkwwwwwwwwk', 'kllllllllllllllk', 'kwwwwwkwwwwwwwwk', 'kkkkkkkkkkkkkkkk'];
  const TOMBDOOR = recolor(DOOR, { w: 'k', l: 'x', x: 'e' });
  // Veiled stairs: dark steps under a purple haze
  const VEIL = ['kkkkkkkkkkkkkkkk', 'kdpdkdpdkdpdkdpk', 'kpdkdpdkpdkdpdkk', 'kkkkkkkkkkkkkkkk',
    'kkdpdkdpdkdpdkkk', 'kkpdkdpdkpdkdkkk', 'kkkkkkkkkkkkkkkk', 'kkkdpdkdpdkdpkkk',
    'kkkpdkdpdkpdkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkdpdkdpdkkkkk', 'kkkkpdkdpdkdkkkk',
    'kkkkkkkkkkkkkkkk', 'kkkkkdpdkdkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'];
  // First-person sword: tip up-left, hilt bottom-right. A/B = blade, G = guard, H = grip
  const SWORD = ['AA..............', 'ABA.............', 'kBAA............', '.kBAA...........',
    '..kBAA..........', '...kBAA.........', '....kBAA........', '.....kBAA.......',
    '......kBAA......', '.......kBAA.GG..', '........kBAAGk..', '.........kBGGk..',
    '..........GGGk..', '.........GkkHHk.', '.........Gk.kHHk', '.............kHk', '..............kk'];
  const SPR = {
    ember: [EMBER, EMBER2],
    altar: [ALTAR, ALTAR_LIT],
    boneKey: [recolor(KEY, { A: 'b' })],
    gildedKey: [recolor(KEY, { A: 'x' })],
    vaultDoor: [DOOR],
    tombDoor: [TOMBDOOR],
    stairsVeiled1: [VEIL], stairsVeiled2: [VEIL], stairsVeiled3: [VEIL],
    swordFP: [recolor(SWORD, { A: 't', B: 'w', G: 'w', H: 'p' })],
    swordFP_gravesteel: [recolor(SWORD, { A: 'v', B: 'l', G: 'h', H: 'd' })],
  };
  const cache = {};
  for (const name in SPR) {
    cache[name] = SPR[name].map((rows) => {
      const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); }
      }));
      return c;
    });
  }
  function draw(ctx, name, x, feetY, o = {}) {
    const frames = cache[name], s = o.scale || 2, img = frames[(o.frame || 0) % frames.length];
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x - img.width * s / 2), Math.round(feetY - img.height * s), img.width * s, img.height * s);
    ctx.restore();
  }
  return { draw, has: (n) => n in cache };
})();
window.Art3D = Art3D;
