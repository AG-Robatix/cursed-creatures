'use strict';
/* ============================================================
   art.js — every picture in the game is drawn here, in code:
   the five lands, the props, the hunter and the creatures.
   ============================================================ */

const TW = 1920; // width of one repeating scenery tile

/* ---------- small drawing helpers ---------- */
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function poly(c, pts, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fill();
}
function line(c, x1, y1, x2, y2, w, col) {
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
function disc(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
// Soft glows are used everywhere (eyes, lanterns, fire, fog). Each colour is painted once into a small sprite
// and then stamped at any size, which is far cheaper than building a new gradient on every call.
const GLOW_CACHE = {};
function glowSprite(rgb) {
  let s = GLOW_CACHE[rgb];
  if (!s) {
    s = GLOW_CACHE[rgb] = makeCanvas(96, 96); const g = s.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  }
  return s;
}
function glow(c, x, y, r, rgb, a) {
  if (!(a > 0) || !(r > 0)) return;
  const ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a);
  c.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2); c.globalAlpha = ga;
}

/* ---------- scenery painters (all tile seamlessly) ---------- */
function layerCanvas(seed, h, painter) {
  const cv = makeCanvas(TW, h), c = cv.getContext('2d');
  for (const ox of [-TW, 0, TW]) { c.save(); c.translate(ox, 0); painter(c, seeded(seed)); c.restore(); }
  return cv;
}
function skyCanvas(stops, extra) {
  const cv = makeCanvas(W, H), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (extra) extra(c);
  return cv;
}
function hills(c, rng, base, amp, col, bottom = H) {
  const ph = [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU];
  const f = x => { const u = x / TW * TAU; return base + amp * (Math.sin(u + ph[0]) * .5 + Math.sin(u * 2 + ph[1]) * .3 + Math.sin(u * 5 + ph[2]) * .15 + Math.sin(u * 9 + ph[3]) * .08); };
  c.fillStyle = col; c.beginPath(); c.moveTo(0, bottom);
  for (let x = 0; x <= TW; x += 8) c.lineTo(x, f(x));
  c.lineTo(TW, bottom); c.closePath(); c.fill();
  return f;
}
function branch(c, x, y, ang, len, w, depth, rng) {
  if (depth === 0 || len < 3) return;
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
  c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
  const n = rng() < .35 ? 3 : 2;
  for (let i = 0; i < n; i++) branch(c, x2, y2, ang + (rng() - .5) * 1.4, len * (.6 + rng() * .22), Math.max(.6, w * .62), depth - 1, rng);
}
function bareTree(c, rng, x, y, h, col, depth = 6) {
  c.strokeStyle = col; c.lineCap = 'round';
  branch(c, x, y, (rng() - .5) * .25, h * .34, Math.max(2, h * .05), depth, rng);
}
function pine(c, x, y, h, col) {
  c.fillStyle = col;
  c.fillRect(x - h * .02, y - h * .2, h * .04, h * .2);
  for (let i = 0; i < 5; i++) {
    const yy = y - h * .15 - i * h * .17, ww = h * (.22 - i * .035);
    c.beginPath(); c.moveTo(x - ww, yy); c.lineTo(x, yy - h * .3); c.lineTo(x + ww, yy); c.closePath(); c.fill();
  }
}
function tufts(c, rng, n, yf, hMin, hMax, col) {
  c.strokeStyle = col; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rng() * TW, y = typeof yf === 'function' ? yf(x) : yf, h = hMin + rng() * (hMax - hMin);
    const blades = 3 + Math.floor(rng() * 5);
    for (let b = 0; b < blades; b++) {
      const lean = (rng() - .5) * h * .9, bh = h * (.5 + rng() * .5);
      c.lineWidth = 1 + rng() * 1.6;
      c.beginPath(); c.moveTo(x + (rng() - .5) * 8, y + 2); c.quadraticCurveTo(x + lean * .3, y - bh * .6, x + lean, y - bh); c.stroke();
    }
  }
}
function bushes(c, rng, n, yf, rMin, rMax, col) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const x = rng() * TW, y = typeof yf === 'function' ? yf(x) : yf, r = rMin + rng() * (rMax - rMin);
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + (rng() - .5) * r * 2, y - rng() * r * .7, r * (.5 + rng() * .5), 0, TAU); c.fill(); }
  }
}
function trunks(c, rng, n, wMin, wMax, col, canopyCol, canopyY) {
  for (let i = 0; i < n; i++) {
    const x = (i + rng() * .8) * (TW / n), w = wMin + rng() * (wMax - wMin), lean = (rng() - .5) * 30;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x - w * .6, H); c.lineTo(x - w * .42 + lean, 0); c.lineTo(x + w * .42 + lean, 0); c.lineTo(x + w * .7, H); c.closePath(); c.fill();
    c.strokeStyle = col; c.lineCap = 'round';
    for (let b = 0; b < 3; b++) {
      const by = 40 + rng() * 220, d = rng() < .5 ? -1 : 1;
      branch(c, x + lean * (1 - by / H), by, d * (0.9 + rng() * .5), 30 + rng() * 50, w * .22, 4, rng);
    }
  }
  if (canopyCol) {
    c.fillStyle = canopyCol;
    for (let i = 0; i < 70; i++) { c.beginPath(); c.arc(rng() * TW, rng() * canopyY - 20, 30 + rng() * 60, 0, TAU); c.fill(); }
  }
}
function skyline(c, rng, baseY, hMin, hMax, col, winCol, winChance) {
  let x = -20;
  while (x < TW) {
    const w = 46 + rng() * 70, h = hMin + rng() * (hMax - hMin), top = baseY - h, kind = rng();
    c.fillStyle = col; c.fillRect(x, top, w, h + 200);
    if (kind < .55) { c.beginPath(); c.moveTo(x - 4, top); c.lineTo(x + w / 2, top - w * (.4 + rng() * .3)); c.lineTo(x + w + 4, top); c.closePath(); c.fill(); }
    else if (kind < .7) { c.fillRect(x + w * .3, top - h * .6, w * .4, h * .6); c.beginPath(); c.moveTo(x + w * .25, top - h * .6); c.lineTo(x + w / 2, top - h * .6 - w * .9); c.lineTo(x + w * .75, top - h * .6); c.closePath(); c.fill(); }
    else { for (let k = 0; k < w; k += 12) c.fillRect(x + k, top - 6, 7, 6); }
    if (rng() < .5) c.fillRect(x + w * .7, top - 26, 8, 30);
    if (winCol) for (let wy = top + 14; wy < baseY - 14; wy += 24) for (let wx = x + 10; wx < x + w - 12; wx += 20) {
      if (rng() < winChance) { c.fillStyle = winCol; c.fillRect(wx, wy, 7, 11); c.fillStyle = col; }
    }
    x += w + rng() * 6 - 2;
  }
}
function fence(c, rng, y, col) {
  c.strokeStyle = col; c.lineCap = 'butt';
  for (let seg = 0; seg < 5; seg++) {
    const x0 = seg * (TW / 5) + rng() * 120, len = 140 + rng() * 160;
    for (let x = x0; x < x0 + len; x += 26) { c.lineWidth = 5; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + (rng() - .5) * 3, y - 34); c.stroke(); }
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0 - 6, y - 26); c.lineTo(x0 + len, y - 24 + rng() * 5); c.stroke();
    c.beginPath(); c.moveTo(x0 - 6, y - 12); c.lineTo(x0 + len, y - 11 + rng() * 5); c.stroke();
  }
}
function stonesWall(c, rng, h, base, lines) {
  R(c, 0, 0, TW, h, base);
  for (let y = 0; y < h; y += 34) {
    const off = (y / 34) % 2 ? 30 : 0;
    for (let x = -60 + off; x < TW; x += 60) {
      const s = rng();
      c.fillStyle = `rgba(${s < .5 ? '255,255,255' : '0,0,0'},${.02 + rng() * .05})`;
      c.fillRect(x + 1, y + 1, 58, 32);
    }
    c.fillStyle = lines; c.fillRect(0, y, TW, 2);
    for (let x = -60 + off; x < TW; x += 60) c.fillRect(x, y, 2, 34);
  }
}

/* ---------- the lands ---------- */
const THEME_DEFS = {
  // Level 1 — fog and grassland
  moor() {
    return {
      mood: 'moor',
      sky: skyCanvas([[0, '#4f5d40'], [.45, '#8d9862'], [.8, '#c6c389'], [1, '#aab07a']], c => {
        glow(c, 690, 150, 260, '245,240,190', .5); disc(c, 690, 150, 34, 'rgba(250,246,214,.75)');
      }),
      layers: [
        { par: .06, cv: layerCanvas(11, H, (c, r) => { hills(c, r, 318, 26, '#8b9764'); }) },
        { par: .14, cv: layerCanvas(12, H, (c, r) => { const f = hills(c, r, 352, 22, '#74824f'); for (let i = 0; i < 9; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 4, 70 + r() * 60, '#66734a', 5); } }) },
        { par: .3, cv: layerCanvas(13, H, (c, r) => { const f = hills(c, r, 392, 14, '#56653a'); bushes(c, r, 14, f, 10, 26, '#4f5e35'); tufts(c, r, 60, f, 14, 34, '#4a5932'); for (let i = 0; i < 4; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 4, 130 + r() * 70, '#465430', 6); } }) },
        { par: .55, cv: layerCanvas(14, H, (c, r) => { const f = hills(c, r, 428, 8, '#39472a'); tufts(c, r, 120, f, 18, 46, '#34422a'); bushes(c, r, 8, f, 14, 30, '#324026'); }) },
      ],
      ground: groundCanvas(15, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#4d4a26'); g.addColorStop(.25, '#3a2f1b'); g.addColorStop(1, '#120e09');
        c.fillStyle = g; c.fillRect(0, 40, TW, h);
        for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(0,0,0,${.1 + r() * .2})`; c.beginPath(); c.ellipse(r() * TW, 56 + r() * 70, 6 + r() * 16, 2 + r() * 4, 0, 0, TAU); c.fill(); }
        R(c, 0, 38, TW, 5, '#5c6a33'); tufts(c, r, 240, 42, 6, 20, '#5d6c34'); tufts(c, r, 90, 42, 10, 30, '#44522b');
      }),
      fg: layerCanvas(16, 110, (c, r) => { tufts(c, r, 150, 112, 30, 86, '#10160c'); }),
      fog: { rgb: '206,208,160', n: 16, y0: 240, y1: 470, a: .34 },
      parts: { type: 'mote', n: 40 },
    };
  },
  // Level 2 — the forest
  wood() {
    return {
      mood: 'wood',
      sky: skyCanvas([[0, '#27351a'], [.4, '#63722d'], [.75, '#c8b55c'], [1, '#8a7a34']], c => { glow(c, 430, 250, 420, '255,236,150', .55); }),
      layers: [
        { par: .08, cv: layerCanvas(21, H, (c, r) => { trunks(c, r, 34, 8, 20, '#8e9648'); }) },
        { par: .16, cv: layerCanvas(22, H, (c, r) => { trunks(c, r, 24, 12, 28, '#646f33'); hills(c, r, 400, 10, '#5d672e'); }) },
        { par: .2, comp: 'lighter', cv: layerCanvas(27, H, (c, r) => {
          for (let i = 0; i < 9; i++) { const x = r() * TW, w = 30 + r() * 80, a = .05 + r() * .08; const g = c.createLinearGradient(0, 0, 0, 460); g.addColorStop(0, `rgba(255,236,150,${a})`); g.addColorStop(1, 'rgba(255,236,150,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w - 190, 460); c.lineTo(x - 230, 460); c.closePath(); c.fill(); }
        }) },
        { par: .32, cv: layerCanvas(23, H, (c, r) => { trunks(c, r, 15, 20, 42, '#3a4421', '#343f1c', 70); const f = hills(c, r, 418, 8, '#343d1c'); bushes(c, r, 16, f, 12, 30, '#2e3819'); }) },
        { par: .58, cv: layerCanvas(24, H, (c, r) => { trunks(c, r, 8, 34, 60, '#1c2311', '#1a210f', 46); const f = hills(c, r, 436, 5, '#1a200f'); tufts(c, r, 80, f, 14, 40, '#1c2411'); bushes(c, r, 10, f, 14, 34, '#182010'); }) },
      ],
      ground: groundCanvas(25, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#6b4420'); g.addColorStop(.3, '#3c2412'); g.addColorStop(1, '#100905');
        c.fillStyle = g; c.fillRect(0, 40, TW, h);
        const cols = ['#b5651d', '#d98a2b', '#8f4a17', '#c9a13a', '#6e3a14'];
        for (let i = 0; i < 700; i++) { c.fillStyle = cols[Math.floor(r() * 5)]; c.globalAlpha = .35 + r() * .5; c.beginPath(); c.ellipse(r() * TW, 40 + Math.pow(r(), 1.6) * 70, 2 + r() * 4, 1 + r() * 2, r() * 3, 0, TAU); c.fill(); }
        c.globalAlpha = 1; tufts(c, r, 60, 42, 6, 18, '#4a4a1e');
      }),
      fg: layerCanvas(26, 110, (c, r) => { tufts(c, r, 60, 112, 30, 70, '#0c1007'); bushes(c, r, 14, 116, 16, 40, '#0c1007'); }),
      fog: { rgb: '230,214,130', n: 9, y0: 300, y1: 460, a: .2 },
      parts: { type: 'leaf', n: 26 },
    };
  },
  // Level 3 — the trade road at dusk
  road() {
    return {
      mood: 'road',
      sky: skyCanvas([[0, '#151634'], [.4, '#4b3458'], [.72, '#b9603f'], [.9, '#e09a55'], [1, '#6b4a48']], c => {
        const r = seeded(31); for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${r() * .7})`; c.fillRect(r() * W, r() * 220, 1.4, 1.4); }
        glow(c, 740, 110, 170, '255,240,210', .35); disc(c, 740, 110, 38, '#f3ead2'); disc(c, 728, 100, 7, 'rgba(180,170,150,.5)'); disc(c, 752, 122, 10, 'rgba(180,170,150,.4)');
      }),
      layers: [
        { par: .04, cv: layerCanvas(32, H, (c, r) => { c.fillStyle = '#3a2f55'; c.beginPath(); c.moveTo(0, H); let x = 0; while (x <= TW) { c.lineTo(x, 300 - r() * 110); x += 60 + r() * 90; c.lineTo(x, 330 + r() * 20); x += 40 + r() * 60; } c.lineTo(TW, H); c.fill(); hills(c, r, 340, 12, '#3a2f55'); }) },
        { par: .12, cv: layerCanvas(33, H, (c, r) => { const f = hills(c, r, 362, 20, '#2d2746'); for (let i = 0; i < 40; i++) { const x = r() * TW; pine(c, x, f(x) + 6, 50 + r() * 50, '#2d2746'); } }) },
        { par: .3, cv: layerCanvas(34, H, (c, r) => { const f = hills(c, r, 400, 12, '#211d36'); for (let i = 0; i < 18; i++) { const x = r() * TW; pine(c, x, f(x) + 6, 90 + r() * 80, '#211d36'); } fence(c, r, 418, '#1b182d'); }) },
        { par: .58, cv: layerCanvas(35, H, (c, r) => { const f = hills(c, r, 432, 6, '#15132a'); tufts(c, r, 90, f, 14, 38, '#15132a'); bushes(c, r, 10, f, 12, 30, '#131126'); for (let i = 0; i < 3; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 4, 170 + r() * 80, '#131126', 7); } }) },
      ],
      ground: groundCanvas(36, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#5a4338'); g.addColorStop(.3, '#32252a'); g.addColorStop(1, '#0d0a10');
        c.fillStyle = g; c.fillRect(0, 40, TW, h);
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3;
        for (let k = 0; k < 2; k++) { c.beginPath(); for (let x = 0; x <= TW; x += 30) c.lineTo(x, 62 + k * 26 + Math.sin(x / TW * TAU * 3 + k) * 4); c.stroke(); }
        for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(150,130,120,${.15 + r() * .25})`; c.beginPath(); c.ellipse(r() * TW, 48 + r() * 70, 2 + r() * 6, 1 + r() * 3, 0, 0, TAU); c.fill(); }
        tufts(c, r, 110, 42, 5, 18, '#3a3340');
      }),
      fg: layerCanvas(37, 110, (c, r) => { tufts(c, r, 110, 112, 26, 70, '#07060d'); }),
      fog: { rgb: '190,140,150', n: 8, y0: 330, y1: 470, a: .18 },
      parts: { type: 'firefly', n: 22 },
    };
  },
  // Level 4 — the border town at night
  town() {
    return {
      mood: 'town',
      sky: skyCanvas([[0, '#090d1e'], [.5, '#1a2444'], [.85, '#3b3a5c'], [1, '#2a2942']], c => {
        const r = seeded(41); for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${r() * .8})`; c.fillRect(r() * W, r() * 300, 1.5, 1.5); }
        glow(c, 200, 90, 130, '220,230,255', .3); disc(c, 200, 90, 22, '#e7ecf7');
      }),
      layers: [
        { par: .06, cv: layerCanvas(42, H, (c, r) => { skyline(c, r, 360, 40, 130, '#161c33', '#5a4a3a', .08); }) },
        { par: .16, cv: layerCanvas(43, H, (c, r) => { skyline(c, r, 400, 60, 150, '#11162a', '#d99a4a', .16); }) },
        { par: .36, cv: layerCanvas(44, H, (c, r) => { skyline(c, r, 452, 110, 200, '#0c1021', '#f2b45a', .2); }) },
      ],
      ground: groundCanvas(45, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#3a3d4c'); g.addColorStop(.4, '#22242f'); g.addColorStop(1, '#0a0b10');
        c.fillStyle = g; c.fillRect(0, 40, TW, h);
        for (let row = 0; row < 6; row++) { const y = 44 + row * 13, ww = 24 + row * 4; for (let x = (row % 2) * ww / 2 - ww; x < TW; x += ww) { c.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${.03 + r() * .07})`; c.beginPath(); c.ellipse(x + ww / 2, y + 6, ww / 2 - 1.5, 5.5, 0, 0, TAU); c.fill(); } }
        R(c, 0, 40, TW, 3, '#4a4e60');
      }),
      fg: null,
      fog: { rgb: '120,140,200', n: 7, y0: 340, y1: 470, a: .14 },
      parts: { type: 'mote', n: 24 },
    };
  },
  // Level 5 — winter
  winter() {
    return {
      mood: 'winter',
      sky: skyCanvas([[0, '#062f45'], [.5, '#0f7ba2'], [.85, '#3fb4d2'], [1, '#2a93b4']], c => { glow(c, 250, 230, 420, '120,225,250', .45); }),
      layers: [
        { par: .07, cv: layerCanvas(51, H, (c, r) => { const f = hills(c, r, 340, 16, '#1f93b8'); for (let i = 0; i < 30; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 3, 50 + r() * 50, '#1f93b8', 5); } }) },
        { par: .16, cv: layerCanvas(52, H, (c, r) => { const f = hills(c, r, 372, 14, '#14779a'); for (let i = 0; i < 14; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 3, 110 + r() * 80, '#126f90', 6); } }) },
        { par: .34, cv: layerCanvas(53, H, (c, r) => { const f = hills(c, r, 410, 9, '#0d5673'); fence(c, r, 424, '#093f56'); for (let i = 0; i < 6; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 3, 200 + r() * 110, '#0a4760', 7); } }) },
        { par: .6, cv: layerCanvas(54, H, (c, r) => { const f = hills(c, r, 436, 5, '#083a50'); for (let i = 0; i < 3; i++) { const x = r() * TW; bareTree(c, r, x, f(x) + 3, 330 + r() * 120, '#062c3f', 8); } }) },
      ],
      ground: groundCanvas(55, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#8fd6e6'); g.addColorStop(.2, '#3f9dba'); g.addColorStop(1, '#06283a');
        c.fillStyle = g; c.fillRect(0, 40, TW, h);
        c.fillStyle = '#a9e4f0'; c.beginPath(); c.moveTo(0, 46); for (let x = 0; x <= TW; x += 16) c.lineTo(x, 39 + Math.sin(x / TW * TAU * 14) * 2 + Math.sin(x / TW * TAU * 37) * 1.5); c.lineTo(TW, 52); c.lineTo(0, 52); c.fill();
        for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(4,40,58,${.1 + r() * .2})`; c.beginPath(); c.ellipse(r() * TW, 56 + r() * 60, 8 + r() * 26, 2 + r() * 3, 0, 0, TAU); c.fill(); }
      }),
      fg: layerCanvas(56, H, (c, r) => {
        c.strokeStyle = '#031823'; c.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const x = r() * TW; branch(c, x, -10, Math.PI + (r() - .5) * .8, 70 + r() * 40, 9, 7, r); }
      }),
      fgFull: true,
      fog: { rgb: '110,215,240', n: 18, y0: 220, y1: 470, a: .3 },
      parts: { type: 'snow', n: 150 },
    };
  },
  // Interiors
  house() {
    return {
      mood: 'house', interior: true,
      sky: skyCanvas([[0, '#07060a'], [1, '#0d0a0c']]),
      layers: [{ par: 1, cv: layerCanvas(61, H, (c, r) => {
        R(c, 0, 0, TW, H, '#1f1610');
        for (let x = 0; x < TW; x += 44) { R(c, x, 0, 42, GROUND, `rgba(${r() < .5 ? '90,60,40' : '20,10,5'},${.08 + r() * .14})`); R(c, x + 42, 0, 2, GROUND, 'rgba(0,0,0,.45)'); }
        R(c, 0, 150, TW, 10, '#150e09'); R(c, 0, GROUND - 90, TW, 8, '#150e09');
        for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(0,0,0,${.2 + r() * .3})`; c.lineWidth = 1; const x = r() * TW, y = 170 + r() * 240; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 10 + r() * 30, y + (r() - .5) * 30); c.lineTo(x + 20 + r() * 40, y + (r() - .5) * 40); c.stroke(); }
        for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(90,10,10,${.12 + r() * .2})`; c.beginPath(); c.ellipse(r() * TW, 250 + r() * 180, 4 + r() * 16, 3 + r() * 8, r() * 3, 0, TAU); c.fill(); }
      }) }],
      ground: groundCanvas(62, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#3b2a1c'); g.addColorStop(1, '#0c0806'); c.fillStyle = g; c.fillRect(0, 40, TW, h);
        for (let x = 0; x < TW; x += 96) R(c, x, 40, 2, h, 'rgba(0,0,0,.4)'); for (let y = 58; y < h; y += 22) R(c, 0, y, TW, 2, 'rgba(0,0,0,.3)');
      }),
      fg: null, fog: { rgb: '120,110,100', n: 5, y0: 300, y1: 460, a: .1 }, parts: { type: 'dust', n: 30 },
      dark: { a: .7, rgb: '6,5,10', radius: 250 },
    };
  },
  cellar() {
    return {
      mood: 'house', interior: true,
      sky: skyCanvas([[0, '#040507'], [1, '#07090c']]),
      layers: [{ par: 1, cv: layerCanvas(71, H, (c, r) => { stonesWall(c, r, H, '#1b2028', 'rgba(0,0,0,.5)'); for (let i = 0; i < 12; i++) { const x = r() * TW; line(c, x, 0, x, 60 + r() * 120, 2, 'rgba(0,0,0,.6)'); } }) }],
      ground: groundCanvas(72, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#2c323b'); g.addColorStop(1, '#07080b'); c.fillStyle = g; c.fillRect(0, 40, TW, h);
        for (let x = 0; x < TW; x += 80) R(c, x + (r() * 10), 40, 2, 26, 'rgba(0,0,0,.5)'); R(c, 0, 66, TW, 2, 'rgba(0,0,0,.5)');
      }),
      fg: null, fog: { rgb: '150,190,200', n: 8, y0: 330, y1: 470, a: .16 }, parts: { type: 'dust', n: 30 },
      dark: { a: .9, rgb: '2,6,8', radius: 250, tint: '60,255,170' },
    };
  },
  crypt() {
    return {
      mood: 'crypt', interior: true,
      sky: skyCanvas([[0, '#030408'], [1, '#080a12']]),
      layers: [{ par: 1, cv: layerCanvas(81, H, (c, r) => {
        stonesWall(c, r, H, '#171a26', 'rgba(0,0,0,.55)');
        for (let x = 120; x < TW; x += 320) {
          c.fillStyle = '#0a0c14'; c.beginPath(); c.moveTo(x - 70, GROUND); c.lineTo(x - 70, 250); c.quadraticCurveTo(x, 150, x + 70, 250); c.lineTo(x + 70, GROUND); c.fill();
          R(c, x - 96, 120, 26, GROUND, '#232838'); R(c, x + 70, 120, 26, GROUND, '#232838'); R(c, x - 102, 112, 38, 12, '#2c3246'); R(c, x + 64, 112, 38, 12, '#2c3246');
        }
      }) }],
      ground: groundCanvas(82, (c, r, h) => {
        const g = c.createLinearGradient(0, 40, 0, h); g.addColorStop(0, '#2a2f42'); g.addColorStop(1, '#06070c'); c.fillStyle = g; c.fillRect(0, 40, TW, h);
        for (let x = 0; x < TW; x += 64) R(c, x, 40, 2, 30, 'rgba(0,0,0,.5)'); R(c, 0, 70, TW, 2, 'rgba(0,0,0,.5)');
        for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(200,200,190,.25)'; c.fillRect(r() * TW, 46 + r() * 30, 3 + r() * 8, 2); }
      }),
      fg: null, fog: { rgb: '90,120,220', n: 9, y0: 320, y1: 470, a: .16 }, parts: { type: 'dust', n: 30 },
      dark: { a: .72, rgb: '3,4,12', radius: 260 },
    };
  },
};
function groundCanvas(seed, painter) {
  const h = H - GROUND + 40;
  return layerCanvas(seed, h, (c, r) => painter(c, r, h));
}
// Each land's scenery is a set of large pictures. Only the three most recently used lands are kept, so a long
// session does not pile up picture memory (browsers, Safari especially, slow down or give up when it runs out).
const THEME_CACHE = {}, THEME_USED = [];
function getTheme(name) {
  if (THEME_USED[THEME_USED.length - 1] !== name) {
    freeStamps();
    const i = THEME_USED.indexOf(name); if (i >= 0) THEME_USED.splice(i, 1);
    THEME_USED.push(name);
    while (THEME_USED.length > 3) {
      const old = THEME_USED.shift(), th = THEME_CACHE[old]; delete THEME_CACHE[old];
      if (th) for (const cv of [th.sky, th.ground, th.fg, ...th.layers.map(L => L.cv), ...Object.values(th.fogCv || {})]) if (cv) cv.width = cv.height = 0;
    }
  }
  return THEME_CACHE[name] || (THEME_CACHE[name] = THEME_DEFS[name]());
}

let VIGNETTE = null;
function vignette() {
  if (VIGNETTE) return VIGNETTE;
  VIGNETTE = makeCanvas(W, H); const c = VIGNETTE.getContext('2d');
  const g = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return VIGNETTE;
}
// On the game screen the vignette and the sky are kept as copies at exactly the screen's size, so they are
// stamped on pixel for pixel: stretching a picture every frame is the slow part in Safari.
const VIG = { w: 0, cv: null }, SKY = { src: null, w: 0, cv: null };
function drawVignette(c) {
  if (c !== ctx) { c.drawImage(vignette(), 0, 0); return; }
  if (VIG.w !== canvas.width) {
    VIG.cv = VIG.cv || makeCanvas(2, 2); VIG.cv.width = canvas.width; VIG.cv.height = canvas.height; VIG.w = canvas.width;
    VIG.cv.getContext('2d').drawImage(vignette(), 0, 0, canvas.width, canvas.height);
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(VIG.cv, 0, 0); c.restore();
}
function drawSky(c, th, z = 1) {
  themeCrop(th);
  // rows of sky that can show above the solid scenery (plus a margin for screen shake)
  const rows = z >= 1 ? Math.min(H, Math.ceil(H - (H - th.skyRows) * z) + 16) : H;
  if (rows <= 0) return;
  if (c !== ctx) { c.drawImage(th.sky, 0, 0, W, rows, 0, 0, W, rows); return; }
  if (SKY.src !== th.sky || SKY.w !== canvas.width) {
    SKY.cv = SKY.cv || makeCanvas(2, 2); SKY.cv.width = canvas.width; SKY.cv.height = canvas.height; SKY.src = th.sky; SKY.w = canvas.width;
    SKY.cv.getContext('2d').drawImage(th.sky, 0, 0, canvas.width, canvas.height);
  }
  const ph = Math.min(canvas.height, Math.ceil(rows * canvas.height / H));
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(SKY.cv, 0, 0, canvas.width, ph, 0, 0, canvas.width, ph); c.restore();
}

/* Safari on a Mac paints stretched pictures far more slowly than Chrome, and the cost grows with every pixel touched.
   So each scenery strip is measured once: where its picture starts, where it ends, and from which row down it is solid.
   Then only the rows that can be seen are drawn: not the empty air above the hills, and not what the nearer hills hide. */
function measureStrip(cv) {
  if (cv.cy0 !== undefined) return cv;
  cv.cy0 = 0; cv.cy1 = cv.height; cv.solid = cv.height;                  // safe answer if the picture cannot be read
  const w = cv.width >> 1, h = cv.height >> 1;
  let d;
  try { const p = makeCanvas(w, h), c = p.getContext('2d', { willReadFrequently: true }); c.drawImage(cv, 0, 0, w, h); d = c.getImageData(0, 0, w, h).data; }
  catch (e) { return cv; }
  let top = -1, bottom = -1, solid = h;
  for (let y = 0; y < h; y++) {
    let any = false, all = true;
    for (let x = 0, i = y * w * 4 + 3; x < w && !(any && !all); x++, i += 4) { const a = d[i]; if (a) any = true; if (a !== 255) all = false; }
    if (any) { if (top < 0) top = y; bottom = y; }
    if (!all) solid = h; else if (solid === h) solid = y;
  }
  if (top < 0) { cv.cy1 = 0; return cv; }
  cv.cy0 = Math.max(0, top * 2 - 4); cv.cy1 = Math.min(cv.height, bottom * 2 + 6);
  cv.solid = solid === h ? cv.height : Math.min(cv.height, solid * 2 + 6);
  return cv;
}
function themeCrop(th) {
  if (th.cropped) return;
  th.cropped = true;
  if (th.fg) measureStrip(th.fg);
  let cover = Math.min(H, GROUND - 40 + measureStrip(th.ground).solid);      // everything below this row is hidden by the ground
  for (let i = th.layers.length - 1; i >= 0; i--) {
    const L = th.layers[i], cv = measureStrip(L.cv);
    cv.vy1 = Math.min(cv.cy1, cover);
    if (!L.comp) cover = Math.min(cover, cv.solid);
  }
  th.skyRows = cover;
}

/* ---------- scenery drawing each frame ---------- */
/* Stamping. When the browser has shown it is slow (Quality.stamp, see core.js), each scenery strip keeps a copy of the
   stretch around the screen at exactly the size it appears, and that copy is laid down pixel for pixel. Safari does
   that almost for free, where stretching a strip every frame is what makes it slow. The copy is renewed when the
   camera has moved far enough to run off its edge. Fast browsers and phones never switch this on. */
const STAMPS = [], STAMP_MARGIN = 480;
let STEADY = true;                       // false while the camera is zooming in or out: nothing is stamped then
function freeStamps() {
  for (const w of STAMPS) { w.cv.width = w.cv.height = 0; delete w.owner.win; }
  STAMPS.length = 0;
  for (const d of FOG_DEV) d.cv.width = d.cv.height = 0;
  FOG_DEV.length = 0;
}
function stampTile(c, cv, off, y, r0, r1) {
  const m = c.getTransform(), kx = m.a, ky = m.d;
  if (m.b || m.c || !(kx > 0) || !(ky > 0)) return false;
  const cw = canvas.width, ch = canvas.height;
  const D = off * kx - m.e;                // which column of the endless, enlarged strip sits at the screen's left edge
  let w = cv.win;
  if (!w || w.kx !== kx || w.ky !== ky || w.r0 !== r0 || w.r1 !== r1 || w.cw !== cw || D < w.B || D + cw > w.B + w.cv.width) {
    if (!w) { w = cv.win = { cv: makeCanvas(2, 2), owner: cv }; STAMPS.push(w); }
    const bw = cw + STAMP_MARGIN * 2, bh = Math.ceil(ky * (r1 - r0)) + 1;
    w.kx = kx; w.ky = ky; w.r0 = r0; w.r1 = r1; w.cw = cw; w.B = Math.round(D) - STAMP_MARGIN;
    w.cv.width = bw; w.cv.height = bh;       // (setting the size also wipes it)
    const b = w.cv.getContext('2d'); b.setTransform(kx, 0, 0, ky, -w.B, 0);
    for (let n = Math.floor(w.B / kx / TW); n * TW < (w.B + bw) / kx; n++) b.drawImage(cv, 0, r0, TW, r1 - r0, n * TW, 0, TW, r1 - r0);
  }
  const Y = Math.round(m.f + ky * (y + r0)), top = Math.max(0, -Y), tall = Math.min(w.cv.height - top, ch - Math.max(0, Y));
  if (tall <= 0) return true;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(w.cv, Math.round(D - w.B), top, cw, tall, 0, Y + top, cw, tall);
  c.restore();
  return true;
}
function tileDraw(c, cv, off, y, r0 = 0, r1 = cv.height) {      // r0..r1: the rows of the strip worth drawing
  if (r1 <= r0) return;
  if (Quality.stamp && STEADY && c === ctx && stampTile(c, cv, off, y, r0, r1)) return;
  for (let x = Math.round(-(((off % TW) + TW) % TW)); x < W + 16; x += TW) {
    const sx = Math.max(0, -16 - x), sw = Math.min(TW - sx, W + 16 - (x + sx));      // only the part across the screen
    if (sw > 0) c.drawImage(cv, sx, r0, sw, r1 - r0, x + sx, y + r0, sw, r1 - r0);
  }
}
function drawBackdrop(c, th, camX, noSky) {
  themeCrop(th);
  if (!noSky) drawSky(c, th);
  for (const L of th.layers) {
    if (L.comp) c.globalCompositeOperation = L.comp;
    tileDraw(c, L.cv, camX * L.par, 0, L.cv.cy0, L.cv.vy1);
    if (L.comp) c.globalCompositeOperation = 'source-over';
  }
}
function drawGround(c, th, camX) { tileDraw(c, th.ground, camX, GROUND - 40); }

const fogState = [];
for (let i = 0; i < 24; i++) fogState.push({ x: Math.random() * 2400, y: Math.random(), r: 160 + Math.random() * 240, s: 6 + Math.random() * 14, a: .4 + Math.random() * .6 });
// Fog used to be ~30 big gradients repainted every frame. Now each land's fog bank is painted once into a strip that
// repeats every 1200 px (wider than the screen, so the repeat is never seen) and simply scrolls past. Its strength is
// painted in, one strip per strength, because fading a picture while drawing it is several times slower in Safari.
const FOG_W = 1200;
function fogStrip(th, mul) {
  const key = Math.round(mul * 20), fc = th.fogCv || (th.fogCv = {});
  if (fc[key]) return fc[key];
  const f = th.fog, k = key / 20, n = Math.ceil(f.n / 2);
  let top = H, bot = 0;
  for (let i = 0; i < n; i++) { const b = fogState[i], y = lerp(f.y0, f.y1, b.y); top = Math.min(top, y - b.r * .42); bot = Math.max(bot, y + b.r * .42); }
  top = Math.max(0, Math.floor(top / 2) * 2); bot = Math.min(H, Math.ceil(bot / 2) * 2);
  const cv = makeCanvas(FOG_W / 2, Math.max(2, (bot - top) / 2)), c = cv.getContext('2d');
  c.scale(.5, .5); c.translate(0, -top);
  for (let i = 0; i < n; i++) {
    const b = fogState[i], y = lerp(f.y0, f.y1, b.y);
    for (let o = -2; o <= 2; o++) {             // repeated to either side so the strip joins up with itself
      const x = b.x % FOG_W + o * FOG_W; if (x + b.r * 1.8 < 0 || x - b.r * 1.8 > FOG_W) continue;
      const g = c.createRadialGradient(x, y, 0, x, y, b.r);
      g.addColorStop(0, `rgba(${f.rgb},${Math.min(1, f.a * b.a * k)})`); g.addColorStop(1, `rgba(${f.rgb},0)`); c.fillStyle = g;
      c.save(); c.translate(x, y); c.scale(1.8, .42); c.translate(-x, -y); c.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2); c.restore();
    }
  }
  cv.top = top; cv.tall = bot - top;
  return fc[key] = cv;
}
// When stamping is on (see tileDraw), the two fog strips on screen are also kept at exactly the size they appear, so
// they are laid down pixel for pixel instead of being stretched every frame (the single slowest thing in Safari).
const FOG_DEV = [];
function fogDevice(src, k) {
  const w = Math.round(FOG_W * k), h = Math.max(2, Math.ceil(src.tall * k));
  let d = FOG_DEV.find(e => e.src === src && e.w === w && e.h === h);
  if (!d) {
    if (FOG_DEV.length < 2) FOG_DEV.push(d = { cv: makeCanvas(2, 2) });
    else d = FOG_DEV[0].used <= FOG_DEV[1].used ? FOG_DEV[0] : FOG_DEV[1];
    d.src = src; d.w = d.cv.width = w; d.h = d.cv.height = h;
    d.cv.getContext('2d').drawImage(src, 0, 0, w, h);
  }
  d.used = performance.now();
  return d;
}
// zb: the zoom the picture is steady at (0 while the camera is still zooming, when the fog is stretched the old way)
function drawFog(c, th, camX, t, mul = 1, zb = 0) {
  if (!th.fog || !(mul > .02)) return;
  const m = fogStrip(th, mul), off = ((camX * .7 - t * 12) % FOG_W + FOG_W) % FOG_W;
  if (c !== ctx || !zb || !Quality.stamp) { for (let x = -off; x < W + 120; x += FOG_W) if (x + FOG_W > -120) c.drawImage(m, x, m.top, FOG_W, m.tall); return; }
  const s = canvas.width / W, d = fogDevice(m, s * zb), cw = canvas.width, ch = canvas.height;
  const y = Math.round(((m.top - H) * zb + H) * s), sy = Math.max(0, -y), sh = Math.min(d.h - sy, ch - Math.max(0, y));    // the zoom is anchored at the bottom centre
  if (sh <= 0) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  for (let x = Math.round(((-off - W / 2) * zb + W / 2) * s) - d.w; x < cw; x += d.w) {
    const sx = Math.max(0, -x), sw = Math.min(d.w - sx, cw - Math.max(0, x));
    if (sw > 0) c.drawImage(d.cv, sx, sy, sw, sh, x + sx, y + sy, sw, sh);
  }
  c.restore();
}
function drawForeground(c, th, camX) {
  if (!th.fg) return;
  themeCrop(th);
  tileDraw(c, th.fg, camX * 1.35, th.fgFull ? 0 : H - 104, th.fg.cy0, th.fg.cy1);
}

const ambient = [];
for (let i = 0; i < 160; i++) ambient.push({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * TAU, s: .4 + Math.random() * .6 });
function drawAmbient(c, th, camX, t) {
  const P = th.parts; if (!P) return;
  for (let i = 0; i < P.n; i++) {
    const a = ambient[i]; let x, y;
    const wrap = (v, m) => ((v % m) + m) % m;
    if (P.type === 'snow') {
      x = wrap(a.x - camX * (.6 + a.s * .6) - t * (40 + a.s * 50), W + 40) - 20; y = wrap(a.y + t * (50 + a.s * 70), H);
      c.fillStyle = `rgba(225,248,255,${.4 + a.s * .5})`; c.beginPath(); c.arc(x + Math.sin(t * 2 + a.p) * 6, y, 1 + a.s * 1.8, 0, TAU); c.fill();
    } else if (P.type === 'leaf') {
      x = wrap(a.x - camX * .8 - t * 14, W + 40) - 20; y = wrap(a.y + t * (24 + a.s * 22), H - 60);
      c.save(); c.translate(x + Math.sin(t * 1.4 + a.p) * 24, y); c.rotate(t * 2 * a.s + a.p);
      c.fillStyle = ['#c9781f', '#e0a235', '#9c4f18'][i % 3]; c.globalAlpha = .85; c.beginPath(); c.ellipse(0, 0, 5, 2.4, 0, 0, TAU); c.fill(); c.restore();
    } else if (P.type === 'firefly') {
      x = wrap(a.x - camX * .7 + Math.sin(t * .5 + a.p) * 30, W); y = 250 + a.y * .4 + Math.sin(t * .8 + a.p * 2) * 18;
      const al = Math.max(0, Math.sin(t * 1.6 + a.p * 3));
      glow(c, x, y, 9, '255,235,130', .5 * al); disc(c, x, y, 1.4, `rgba(255,245,180,${al})`);
    } else if (P.type === 'dust') {
      x = wrap(a.x - camX + Math.sin(t * .3 + a.p) * 20, W); y = wrap(a.y - t * 5 * a.s, H - 100);
      disc(c, x, y, 1, `rgba(200,200,190,${.12 + .1 * Math.sin(t + a.p)})`);
    } else { // mote
      x = wrap(a.x - camX * .7 + t * 9 * a.s, W); y = 200 + a.y * .5 + Math.sin(t * .6 + a.p) * 12;
      disc(c, x, y, 1.3, `rgba(245,245,210,${.2 + .15 * Math.sin(t + a.p)})`);
    }
  }
}

/* ============================================================
   PROPS — things standing in the world. Drawn at (0,0) = their
   base point on the ground.
   ============================================================ */
function flame(c, x, y, s, t, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const w = s * (1 - i * .28), h = s * 2.2 * (1 - i * .25) * (.9 + .12 * Math.sin(t * 13 + i * 2 + seed));
    c.fillStyle = ['#e8641c', '#f5a52a', '#fff0a8'][i];
    c.beginPath(); c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 1.1, y - h * .5, x + Math.sin(t * 9 + i + seed) * s * .35, y - h);
    c.quadraticCurveTo(x + w * 1.1, y - h * .5, x + w, y); c.closePath(); c.fill();
  }
}
function facade(c, w, h, wall, roof, o = {}) {
  // a simple gabled building; origin = bottom centre
  R(c, -w / 2, -h, w, h, wall);
  poly(c, [-w / 2 - 12, -h, 0, -h - (o.roofH || w * .35), w / 2 + 12, -h], roof);
  if (o.beams) { for (let x = -w / 2; x <= w / 2; x += w / 4) R(c, x - 2, -h, 4, h, o.beams); R(c, -w / 2, -h * .55, w, 4, o.beams); }
}
function windowLit(c, x, y, w, h, col, t, flick = 0) {
  const a = .85 + flick * Math.sin(t * 7 + x) * .15;
  c.globalAlpha = a; R(c, x, y, w, h, col); c.globalAlpha = 1;
  R(c, x + w / 2 - 1, y, 2, h, 'rgba(0,0,0,.6)'); R(c, x, y + h / 2 - 1, w, 2, 'rgba(0,0,0,.6)');
}

const PROPS = {
  sign(c, p) {
    R(c, -3, -64, 6, 64, '#2b1f14'); c.save(); c.rotate(-.04);
    poly(c, [-34, -70, 30, -70, 42, -58, 30, -46, -34, -46], '#4a3622'); c.restore();
    if (p.text) { c.fillStyle = '#d9c9a0'; c.font = font(10, 'bold'); c.textAlign = 'center'; c.fillText(p.text, 0, -54); }
  },
  board(c) {
    R(c, -34, -70, 5, 70, '#2b1f14'); R(c, 29, -70, 5, 70, '#2b1f14'); R(c, -38, -84, 76, 50, '#4a3622'); poly(c, [-44, -84, 0, -98, 44, -84], '#33261a');
    R(c, -30, -78, 20, 26, '#d9cfae'); R(c, -6, -76, 16, 20, '#c9bf9c'); R(c, 13, -79, 18, 30, '#e3d9b8');
    for (let i = 0; i < 4; i++) R(c, -27, -73 + i * 5, 14, 1.5, 'rgba(40,30,20,.6)');
  },
  campfire(c, p, t) {
    line(c, -16, -2, 14, -8, 6, '#2a1b10'); line(c, 16, -2, -14, -8, 6, '#33210f');
    for (let i = 0; i < 6; i++) disc(c, Math.cos(i) * 20, -2 + Math.sin(i * 2) * 2, 4, '#3a3a3c');
    if (p.lit) { c.globalCompositeOperation = 'lighter'; glow(c, 0, -20, 130, '255,150,60', .22 + .04 * Math.sin(t * 11)); c.globalCompositeOperation = 'source-over'; flame(c, 0, -5, 9, t); }
    else { disc(c, 0, -6, 4, '#1a1410'); }
  },
  ruin(c, p) {
    const col = '#1c1a15', v = p.v || 0;
    R(c, -70, -8, 140, 8, '#26221b');
    R(c, -66, -(90 + v * 20), 9, 90 + v * 20, col); R(c, 52, -(60 + v * 10), 9, 60 + v * 10, col); R(c, -10, -(120 - v * 30), 8, 120 - v * 30, col);
    line(c, -62, -(86 + v * 20), -6, -(118 - v * 30), 7, col); line(c, -6, -(118 - v * 30), 30, -84, 6, col);
    line(c, -60, -44, 56, -40, 5, col);
    poly(c, [-40, 0, -30, -22, -8, -12, 14, -28, 40, -8, 50, 0], '#15130f');
  },
  scar(c, p, t) {
    c.save(); c.scale(1, .28); c.globalCompositeOperation = 'lighter';
    glow(c, 0, 0, 90, '170,70,255', .28 + .1 * Math.sin(t * 2));
    c.globalCompositeOperation = 'source-over'; c.strokeStyle = '#0a0410'; c.lineWidth = 6;
    c.beginPath(); for (let a = 0; a < 14; a += .2) { const r = a * 5; c.lineTo(Math.cos(a + t * .2) * r, Math.sin(a + t * .2) * r); } c.stroke();
    c.strokeStyle = `rgba(190,110,255,${.5 + .3 * Math.sin(t * 3)})`; c.lineWidth = 2; c.stroke(); c.restore();
  },
  cart(c, p, t) {
    R(c, -52, -40, 104, 22, '#4a3320'); R(c, -52, -22, 104, 5, '#2e1f13');
    c.fillStyle = '#b9ae90'; c.beginPath(); c.moveTo(-50, -40); c.quadraticCurveTo(-48, -96, 0, -98); c.quadraticCurveTo(48, -96, 50, -40); c.fill();
    c.strokeStyle = 'rgba(60,50,30,.5)'; c.lineWidth = 2; for (const x of [-24, 0, 24]) { c.beginPath(); c.moveTo(x, -40); c.quadraticCurveTo(x, -92, x * .4, -97); c.stroke(); }
    for (const x of [-32, 32]) { disc(c, x, -16, 16, '#22170e'); disc(c, x, -16, 12, '#4a3320'); disc(c, x, -16, 3, '#22170e'); for (let a = 0; a < 6; a++) line(c, x, -16, x + Math.cos(a * 1.05) * 12, -16 + Math.sin(a * 1.05) * 12, 1.5, '#22170e'); }
    line(c, 52, -30, 86, -22, 4, '#2e1f13');
    c.globalCompositeOperation = 'lighter'; glow(c, 56, -74, 60, '255,190,90', .28 + .04 * Math.sin(t * 9)); c.globalCompositeOperation = 'source-over';
    line(c, 50, -86, 56, -80, 2, '#222'); R(c, 52, -80, 8, 11, '#f5c56a');
  },
  hauntedHouse(c, p, t) {
    const w = '#17140f', d = '#0b0907';
    R(c, -170, -210, 340, 210, w); poly(c, [-190, -210, -60, -300, 40, -290, 60, -262, 110, -276, 190, -210], '#0f0d0a');
    R(c, 96, -330, 34, 80, '#0f0d0a');
    for (let x = -170; x < 170; x += 24) R(c, x, -210, 2, 210, 'rgba(0,0,0,.4)');
    R(c, -170, -112, 340, 6, d);
    for (const [x, y] of [[-130, -190], [-50, -190], [70, -190], [-130, -90], [90, -90]]) { R(c, x, y, 44, 56, d); line(c, x, y + 28, x + 44, y + 28, 2, w); line(c, x + 22, y, x + 22, y + 56, 2, w); }
    R(c, 70, -190, 44, 56, `rgba(120,220,200,${.07 + .05 * Math.sin(t * 1.3)})`);
    line(c, -130, -64, -90, -52, 5, w); line(c, -128, -44, -88, -58, 5, w);
    R(c, -26, -84, 52, 84, d); R(c, -30, -88, 60, 5, '#241d15');
    poly(c, [-26, -84, 4, -78, 4, -2, -26, 0], '#1e1812'); disc(c, -2, -40, 2, '#6a5a3a');
    R(c, -46, -6, 92, 6, '#241d15');
  },
  hut(c, p, t) {
    const v = p.v || 0;
    facade(c, 150, 86, '#3a2c1e', '#231a10', { roofH: 70, beams: '#1f160d' });
    poly(c, [-92, -86, 0, -160, 92, -86, 80, -80, 0, -146, -80, -80], '#4d3d22');
    R(c, -18 + v * 30, -52, 30, 52, '#1a120b'); windowLit(c, 34 - v * 90, -60, 22, 22, '#f2b45a', t, 1);
    c.globalCompositeOperation = 'lighter'; glow(c, 45 - v * 90, -49, 60, '255,180,90', .16); c.globalCompositeOperation = 'source-over';
  },
  body(c) {
    c.save(); c.lineCap = 'round';
    line(c, -22, -6, 6, -7, 11, '#4a3a2a'); line(c, 6, -7, 26, -4, 6, '#33281c'); line(c, 4, -5, 24, -9, 6, '#33281c');
    disc(c, -30, -7, 7, '#9c8468'); line(c, -18, -5, -30, 2, 4, '#4a3a2a'); poly(c, [-42, -9, -30, -19, -22, -9], '#2a1f14');
    c.fillStyle = 'rgba(70,8,8,.6)'; c.beginPath(); c.ellipse(-6, 0, 28, 4, 0, 0, TAU); c.fill(); c.restore();
  },
  gate(c, p, t) {
    R(c, -150, -200, 60, 200, '#231f24'); for (let y = -190; y < 0; y += 22) R(c, -150, y, 60, 2, 'rgba(0,0,0,.4)');
    poly(c, [-160, -200, -120, -250, -80, -200], '#16131a'); R(c, -132, -160, 24, 30, '#0c0a0e');
    windowLit(c, -132, -160, 24, 30, '#e8a44a', t, 1);
    R(c, 90, -120, 14, 120, '#231f24');
    if (!p.open) { line(c, -90, -56, 96, -56, 7, '#5a2a22'); for (let x = -70; x < 90; x += 40) R(c, x, -60, 18, 8, '#d9d0c0'); }
    else { c.save(); c.translate(-90, -56); c.rotate(-1.15); line(c, 0, 0, 186, 0, 7, '#5a2a22'); c.restore(); }
    R(c, -96, -70, 10, 70, '#2c2630');
    line(c, 97, -120, 97, -190, 3, '#231f24'); poly(c, [98, -190, 140, -180 + Math.sin(t * 3) * 3, 98, -164], '#7a2a2a');
    c.globalCompositeOperation = 'lighter'; glow(c, -40, -100, 120, '255,160,80', .12); c.globalCompositeOperation = 'source-over';
    line(c, -84, -70, -84, -110, 3, '#222'); flame(c, -84, -112, 5, t, 3);
  },
  wreck(c) {
    c.save(); c.rotate(-.12); R(c, -56, -36, 100, 20, '#3a2a1c'); R(c, -56, -18, 100, 5, '#22180f'); c.restore();
    disc(c, -36, -12, 15, '#1c130b'); disc(c, -36, -12, 11, '#3a2a1c'); c.save(); c.translate(52, -6); c.rotate(1.2); c.scale(1, .5); disc(c, 0, 0, 15, '#1c130b'); c.restore();
    poly(c, [-50, -40, -44, -84, -10, -70, 2, -40], '#8f866c'); R(c, 60, -10, 20, 10, '#33261a'); R(c, 70, -22, 16, 12, '#2a1f14');
  },
  inn(c, p, t) {
    facade(c, 300, 190, '#2a2430', '#17131c', { roofH: 90, beams: '#17131c' });
    for (const x of [-120, -60, 60, 120]) windowLit(c, x - 14, -160, 28, 34, '#f2b45a', t, 1);
    windowLit(c, -124, -74, 40, 40, '#f5c06a', t, 1); windowLit(c, 84, -74, 40, 40, '#f5c06a', t, 1);
    R(c, -24, -70, 48, 70, '#3a2516'); R(c, -28, -74, 56, 5, '#17131c'); disc(c, 14, -34, 2.5, '#c9a45a');
    line(c, 60, -112, 96, -112, 3, '#17131c'); c.save(); c.translate(84, -110); c.rotate(Math.sin(t * 1.5) * .06); R(c, -18, 0, 36, 24, '#4a3622'); c.fillStyle = '#e0c88a'; c.font = font(9, 'bold'); c.textAlign = 'center'; c.fillText('INN', 0, 16); c.restore();
    c.globalCompositeOperation = 'lighter'; glow(c, 0, -60, 220, '255,170,80', .13); c.globalCompositeOperation = 'source-over';
  },
  shop(c, p, t) {
    facade(c, 210, 150, '#232a2c', '#131a1b', { roofH: 70, beams: '#131a1b' });
    windowLit(c, -84, -80, 54, 46, '#9fe0a0', t, .5); windowLit(c, 34, -130, 26, 30, '#f2b45a', t, 1);
    R(c, 28, -66, 44, 66, '#2c1d12'); R(c, 24, -70, 52, 5, '#131a1b');
    for (let i = 0; i < 4; i++) { disc(c, -74 + i * 12, -44, 4, ['#c0392b', '#2e86c1', '#d4ac0d', '#7d3c98'][i]); R(c, -76 + i * 12, -52, 4, 5, '#ddd'); }
    c.globalCompositeOperation = 'lighter'; glow(c, -57, -57, 110, '130,255,150', .13); c.globalCompositeOperation = 'source-over';
    R(c, -40, -118, 80, 18, '#3a2c1e'); c.fillStyle = '#d6e8c0'; c.font = font(10, 'bold'); c.textAlign = 'center'; c.fillText('APOTHECARY', 0, -105);
  },
  chapel(c, p, t) {
    R(c, -110, -200, 220, 200, '#22242e'); poly(c, [-124, -200, 0, -290, 124, -200], '#14151c');
    R(c, -150, -300, 60, 300, '#1e2029'); poly(c, [-156, -300, -120, -400, -84, -300], '#14151c'); line(c, -120, -400, -120, -424, 3, '#14151c'); line(c, -128, -414, -112, -414, 3, '#14151c');
    R(c, -132, -280, 24, 40, '#0b0c10');
    disc(c, 0, -150, 30, '#0b0c10'); c.globalAlpha = .55 + .1 * Math.sin(t); disc(c, 0, -150, 25, '#3a4a9a'); c.globalAlpha = 1;
    for (let a = 0; a < 8; a++) line(c, 0, -150, Math.cos(a * .785) * 26, -150 + Math.sin(a * .785) * 26, 2, '#0b0c10');
    c.fillStyle = '#0b0c10'; c.beginPath(); c.moveTo(-28, 0); c.lineTo(-28, -64); c.quadraticCurveTo(0, -100, 28, -64); c.lineTo(28, 0); c.fill();
    c.fillStyle = '#2e2018'; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-22, -62); c.quadraticCurveTo(0, -90, 22, -62); c.lineTo(22, 0); c.fill(); line(c, 0, -80, 0, 0, 2, '#0b0c10');
    for (let y = -190; y < 0; y += 28) R(c, -110, y, 220, 2, 'rgba(0,0,0,.3)');
    for (const x of [80, 150, -190]) { R(c, x - 8, -34, 16, 34, '#2c2f3a'); c.beginPath(); c.fillStyle = '#2c2f3a'; c.arc(x, -34, 8, Math.PI, 0); c.fill(); }
  },
  townhouse(c, p, t) {
    const v = p.v || 0, w = 170 + v * 40, h = 150 + v * 50;
    facade(c, w, h, ['#262230', '#2a2a26', '#2c2428'][v % 3], '#15121a', { roofH: 60 + v * 14, beams: '#15121a' });
    for (let y = -h + 24; y < -30; y += 56) for (let x = -w / 2 + 22; x < w / 2 - 30; x += 50) if ((x * 7 + y * 3 + v * 11) % 5 > 1) windowLit(c, x, y, 24, 30, '#e8a850', t, 1); else R(c, x, y, 24, 30, '#0e0c12');
    R(c, -16, -60, 32, 60, '#2c1d12');
  },
  lamp(c, p, t) {
    line(c, 0, 0, 0, -120, 4, '#15161c'); line(c, 0, -120, 16, -128, 3, '#15161c'); R(c, 10, -128, 12, 16, '#f5c56a');
    c.globalCompositeOperation = 'lighter'; glow(c, 16, -120, 110, '255,190,100', .25 + .03 * Math.sin(t * 8 + p.x)); c.globalCompositeOperation = 'source-over';
  },
  northGate(c, p, t) {
    R(c, -140, -260, 90, 260, '#1b1d28'); R(c, 50, -260, 90, 260, '#1b1d28'); R(c, -140, -260, 280, 80, '#1b1d28');
    for (let x = -140; x < 140; x += 28) R(c, x, -274, 16, 14, '#1b1d28');
    c.fillStyle = '#05060a'; c.beginPath(); c.moveTo(-50, 0); c.lineTo(-50, -120); c.quadraticCurveTo(0, -180, 50, -120); c.lineTo(50, 0); c.fill();
    c.globalCompositeOperation = 'lighter'; glow(c, 0, -70, 120, '80,200,240', .16 + .04 * Math.sin(t * 2)); c.globalCompositeOperation = 'source-over';
    for (let y = -250; y < 0; y += 30) R(c, -140, y, 280, 2, 'rgba(0,0,0,.3)');
    for (const x of [-70, 70]) { line(c, x, -150, x, -180, 3, '#111'); flame(c, x, -182, 5, t, x); }
  },
  door(c, p) {
    R(c, -30, -108, 60, 108, '#0d0a08'); R(c, -25, -103, 50, 103, p.col || '#33241a');
    R(c, -25, -70, 50, 3, 'rgba(0,0,0,.4)'); R(c, -25, -36, 50, 3, 'rgba(0,0,0,.4)'); disc(c, 16, -52, 3, '#b08d4a');
  },
  bookshelf(c, p) {
    c.save(); c.translate(p.slide || 0, 0);
    R(c, -60, -170, 120, 170, '#241810'); const cols = ['#5a2a22', '#2a3a4a', '#4a4a2a', '#3a2a4a', '#2a4a3a'];
    for (let s = 0; s < 4; s++) { const y = -162 + s * 41; R(c, -54, y, 108, 34, '#120c08'); for (let i = 0; i < 12; i++) R(c, -52 + i * 8.6, y + 4 + (i * 7 % 5), 7, 30 - (i * 7 % 5), cols[(i + s * 2) % 5]); }
    c.restore();
  },
  fireplace(c) {
    R(c, -60, -110, 120, 110, '#2a2826'); R(c, -70, -120, 140, 14, '#383634'); R(c, -40, -72, 80, 72, '#060505');
    for (let i = 0; i < 6; i++) disc(c, -30 + i * 12, -3, 5, '#151312'); R(c, -40, -8, 80, 8, 'rgba(40,40,40,.6)');
  },
  table(c) {
    R(c, -50, -44, 100, 7, '#3a2a1c'); R(c, -44, -38, 6, 38, '#2a1d12'); R(c, 38, -38, 6, 38, '#2a1d12');
    c.save(); c.translate(78, 0); c.rotate(.5); R(c, -4, -40, 6, 40, '#2a1d12'); R(c, -4, -44, 30, 6, '#3a2a1c'); c.restore();
    R(c, -20, -52, 5, 8, '#8a8a7a'); disc(c, 14, -47, 5, '#5a4a3a');
  },
  tapestry(c, p) {
    const col = ['#4a2226', '#22344a', '#3a3a22'][p.v || 0];
    c.globalAlpha = .7; R(c, -34, -300, 68, 120, col); poly(c, [-34, -180, -17, -164, 0, -180, 17, -164, 34, -180], col);
    c.strokeStyle = 'rgba(200,170,100,.35)'; c.lineWidth = 2; c.strokeRect(-26, -292, 52, 100); disc(c, 0, -244, 14, 'rgba(200,170,100,.2)'); c.globalAlpha = 1;
    R(c, -40, -304, 80, 5, '#1a120b');
  },
  moonWindow(c, p, t) {
    R(c, -34, -330, 68, 58, '#0a0d12'); R(c, -28, -324, 56, 46, '#9fc4d8'); line(c, 0, -324, 0, -278, 3, '#0a0d12'); line(c, -28, -301, 28, -301, 3, '#0a0d12');
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, -324, 0, 0); g.addColorStop(0, 'rgba(160,210,235,.26)'); g.addColorStop(1, 'rgba(160,210,235,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-28, -324); c.lineTo(28, -324); c.lineTo(28 + (p.sx || 190), 0); c.lineTo(-28 + (p.sx || 190) - 90, 0); c.fill();
    c.globalCompositeOperation = 'source-over';
  },
  labBench(c, p, t) {
    R(c, -70, -50, 140, 8, '#33261a'); R(c, -64, -42, 7, 42, '#22180f'); R(c, 57, -42, 7, 42, '#22180f');
    const cols = ['120,255,170', '255,120,90', '130,170,255'];
    for (let i = 0; i < 3; i++) { const x = -44 + i * 40; R(c, x - 3, -72, 6, 10, '#9aa'); disc(c, x, -58, 9, `rgba(${cols[i]},.55)`); c.globalCompositeOperation = 'lighter'; glow(c, x, -58, 26, cols[i], .2 + .06 * Math.sin(t * 2 + i)); c.globalCompositeOperation = 'source-over'; }
    R(c, 20, -54, 30, 4, '#c9bf9c');
  },
  pedestal(c, p, t) {
    R(c, -22, -10, 44, 10, '#2a2f42'); R(c, -14, -64, 28, 54, '#232838'); R(c, -20, -72, 40, 9, '#2f3550');
    if (!p.taken) {
      const b = Math.sin(t * 2) * 4;
      c.globalCompositeOperation = 'lighter'; glow(c, 0, -100 + b, 190, '90,150,255', .3 + .08 * Math.sin(t * 3)); c.globalCompositeOperation = 'source-over';
      poly(c, [0, -124 + b, 12, -102 + b, 0, -80 + b, -12, -102 + b], '#bfe0ff'); poly(c, [0, -124 + b, 12, -102 + b, 0, -102 + b], '#e9f6ff'); poly(c, [0, -80 + b, -12, -102 + b, 0, -102 + b], '#6fa8ee');
    }
  },
  throne(c) {
    R(c, -34, -30, 68, 30, '#1a1c28'); R(c, -30, -150, 60, 122, '#1e2130'); poly(c, [-30, -150, -20, -180, -10, -150, 0, -190, 10, -150, 20, -180, 30, -150], '#1e2130');
    R(c, -42, -58, 12, 58, '#151722'); R(c, 30, -58, 12, 58, '#151722'); R(c, -22, -140, 44, 108, '#3a1420');
  },
  statue(c, p) {
    R(c, -22, -24, 44, 24, '#1e2230'); c.save(); if (p.broken) { c.beginPath(); c.rect(-40, -90, 80, 70); c.clip(); }
    R(c, -11, -100, 22, 76, '#262b3c'); disc(c, 0, -112, 11, '#262b3c'); line(c, -11, -92, -26, -50, 7, '#262b3c'); line(c, 11, -92, 22, -60, 7, '#262b3c'); line(c, 22, -60, 22, -140, 3, '#262b3c'); c.restore();
    if (p.broken) { disc(c, 34, -6, 9, '#262b3c'); }
  },
  // a side path leading away from the road, into the background
  sidepath(c, p) {
    // the path narrows as it runs away from the road, with a worn marker post either side
    poly(c, [-62, 2, 62, 2, 16, -84, -2, -84], p.col || '#5a4630'); poly(c, [-62, 2, -44, 2, 2, -84, -2, -84], 'rgba(0,0,0,.28)'); poly(c, [62, 2, 46, 2, 13, -84, 16, -84], 'rgba(255,255,255,.1)');
    for (let i = 1; i < 5; i++) { const k = i / 5, w = 62 - 50 * k; R(c, -w * .7 + 7 * k, 2 - 86 * k, w * 1.4, 1.5, 'rgba(0,0,0,.18)'); }
    c.save(); c.translate(-70, 0); c.rotate(-.14); R(c, -4, -62, 8, 62, '#2b1f14'); R(c, -6, -64, 12, 5, '#3a2a1c'); c.restore();
    c.save(); c.translate(70, 0); c.rotate(.1); R(c, -4, -52, 8, 52, '#2b1f14'); R(c, -18, -48, 30, 6, '#3a2a1c'); c.restore();
  },
  graves(c, p) {
    const stone = (x, h, tilt) => { c.save(); c.translate(x, 0); c.rotate(tilt); c.fillStyle = '#3a3846'; c.beginPath(); c.moveTo(-11, 0); c.lineTo(-11, -h + 10); c.quadraticCurveTo(0, -h - 6, 11, -h + 10); c.lineTo(11, 0); c.fill(); R(c, -6, -h + 16, 12, 2, 'rgba(0,0,0,.35)'); R(c, -1, -h + 10, 2, 14, 'rgba(0,0,0,.35)'); c.restore(); };
    stone(-46, 44, -.08); stone(40, 38, .14);
    c.fillStyle = '#07060a'; c.beginPath(); c.ellipse(-4, 1, 30, 7, 0, 0, TAU); c.fill();                     // the opened grave
    poly(c, [-52, 0, -40, -14, -22, -9, -10, 0], '#2a2226'); poly(c, [8, 0, 22, -12, 38, -6, 46, 0], '#2a2226');   // thrown earth
    line(c, 14, -3, 30, -7, 2, '#cfc8b4'); line(c, -30, -5, -20, -2, 2, '#cfc8b4');
  },
  bones(c) {
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { c.strokeStyle = '#cfc8b4'; c.lineWidth = 2; c.beginPath(); c.arc(-18 + i * 9, -2, 10, Math.PI, Math.PI * 1.75); c.stroke(); }
    line(c, -30, -3, 22, -3, 2.5, '#bdb6a2'); disc(c, 34, -6, 6, '#cfc8b4'); disc(c, 36, -7, 1.6, '#1a1612'); line(c, -44, -1, -34, -5, 2.5, '#bdb6a2');
  },
  hatch(c, p, t) {
    R(c, -44, -12, 88, 12, '#2c2f3a'); for (let x = -44; x < 44; x += 22) R(c, x, -12, 2, 12, 'rgba(0,0,0,.4)');
    R(c, -36, -9, 72, 9, '#040406');
    c.save(); c.translate(-36, -12); c.rotate(-1.05); R(c, 0, -5, 62, 6, '#3a2a1c'); R(c, 8, -5, 3, 6, '#1a140e'); R(c, 44, -5, 3, 6, '#1a140e'); c.restore();
    c.globalCompositeOperation = 'lighter'; glow(c, 0, -8, 60, '150,70,255', .16 + .06 * Math.sin(t * 2)); c.globalCompositeOperation = 'source-over';
  },
  junk(c) {
    line(c, -30, -2, 10, -8, 3, '#5a5a66'); line(c, -34, -4, -26, 0, 5, '#3a2c20'); c.fillStyle = '#3a3f52'; c.beginPath(); c.ellipse(30, -6, 15, 9, .3, 0, TAU); c.fill(); disc(c, 30, -6, 3, '#5a6078');
    line(c, 0, -3, 22, -1, 2, '#6a6a76');
  },
  tent(c, p) {
    poly(c, [-60, 0, 0, -70, 60, 0], '#0b4057'); poly(c, [-12, 0, 0, -42, 12, 0], '#041e2c'); line(c, 0, -70, 0, -80, 2, '#041e2c');
    c.fillStyle = '#b5e6f2'; c.beginPath(); c.moveTo(-50, -12); c.lineTo(0, -70); c.lineTo(50, -12); c.lineTo(34, -22); c.lineTo(0, -58); c.lineTo(-34, -22); c.fill();
    R(c, 70, -10, 26, 10, '#0a3549'); line(c, 104, 0, 112, -34, 3, '#7fb4c4');
  },
  frozen(c) {
    c.save(); c.globalAlpha = .9; c.lineCap = 'round';
    line(c, 0, -30, 0, -62, 12, '#2a7f9c'); disc(c, 0, -72, 8, '#3a9bb8'); line(c, -3, -30, -6, 0, 6, '#2a7f9c'); line(c, 3, -30, 8, 0, 6, '#2a7f9c'); line(c, 0, -58, 18, -78, 5, '#2a7f9c'); line(c, 0, -58, -14, -40, 5, '#2a7f9c');
    c.fillStyle = 'rgba(190,240,250,.35)'; poly(c, [-22, 0, -14, -70, 0, -96, 16, -72, 24, 0], 'rgba(190,240,250,.3)'); c.restore();
  },
  rock(c, p) { const s = p.s || 1; poly(c, [-26 * s, 0, -18 * s, -18 * s, -2 * s, -26 * s, 16 * s, -20 * s, 26 * s, 0], p.col || '#2a2c2a'); poly(c, [-2 * s, -26 * s, 16 * s, -20 * s, 4 * s, -12 * s], 'rgba(255,255,255,.06)'); },
  log(c, p) { c.lineCap = 'round'; line(c, -44, -9, 40, -9, 18, p.col || '#2f2216'); disc(c, 44, -9, 9, '#5a4630'); disc(c, 44, -9, 5, '#3a2c1c'); line(c, -10, -18, -22, -34, 4, p.col || '#2f2216'); },
  barrel(c) { R(c, -13, -34, 26, 34, '#3a2a1c'); R(c, -14, -28, 28, 3, '#1a140e'); R(c, -14, -10, 28, 3, '#1a140e'); },
  crates(c) { R(c, -30, -28, 30, 28, '#3d2e1e'); R(c, 2, -24, 26, 24, '#34271a'); R(c, -18, -50, 26, 22, '#45341f'); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; c.strokeRect(-30, -28, 30, 28); c.strokeRect(2, -24, 26, 24); c.strokeRect(-18, -50, 26, 22); },
  forge(c, p, t) {
    R(c, -92, -124, 184, 124, '#111218');
    R(c, -96, -128, 9, 128, '#2a1d12'); R(c, 87, -128, 9, 128, '#2a1d12');
    poly(c, [-112, -124, 0, -170, 112, -124, 112, -112, -112, -112], '#1c151b');
    R(c, 46, -170, 18, 60, '#26242a');                                              // chimney
    R(c, 30, -74, 52, 74, '#2c2a2e'); R(c, 26, -80, 60, 8, '#3a373c'); R(c, 40, -42, 32, 30, '#150906');   // furnace
    c.globalCompositeOperation = 'lighter'; glow(c, 56, -28, 130, '255,140,50', .26 + .06 * Math.sin(t * 9)); c.globalCompositeOperation = 'source-over';
    flame(c, 56, -14, 8, t, 2);
    R(c, -52, -16, 30, 16, '#3a2a1c');                                              // stump and anvil
    poly(c, [-64, -34, -14, -34, -14, -28, -26, -25, -26, -16, -48, -16, -48, -25, -70, -29], '#454955');
    poly(c, [-64, -34, -14, -34, -14, -31, -64, -31], '#6a6f7c');
    R(c, -84, -100, 44, 3, '#2a1d12'); for (let i = 0; i < 4; i++) line(c, -78 + i * 11, -97, -78 + i * 11, -76 - (i % 2) * 8, 2.5, '#5a5e68');   // tools
    R(c, -8, -20, 16, 20, '#2a2c33'); R(c, -9, -22, 18, 3, '#3c3f48');             // quenching bucket
    R(c, -36, -150, 72, 18, '#3a2c1e'); c.fillStyle = '#e0c88a'; c.font = font(10, 'bold'); c.textAlign = 'center'; c.fillText('SMITH', 0, -137);
    if (Math.sin(t * 3.1) > .96) { c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) disc(c, -40 + Math.sin(i * 9 + t * 40) * 14, -40 - (i * 7 % 22), 1.4, '#ffd27a'); c.globalCompositeOperation = 'source-over'; }
  },
  stall(c, p, t) {
    R(c, -50, -40, 100, 6, '#3a2a1c'); R(c, -46, -34, 5, 34, '#2a1d12'); R(c, 41, -34, 5, 34, '#2a1d12'); line(c, -48, -40, -48, -104, 3, '#2a1d12'); line(c, 48, -40, 48, -104, 3, '#2a1d12');
    for (let i = 0; i < 5; i++) poly(c, [-56 + i * 22.4, -104, -33.6 + i * 22.4, -104, -33.6 + i * 22.4, -84, -44.8 + i * 22.4, -78, -56 + i * 22.4, -84], i % 2 ? '#8a2f2a' : '#d6cdb4');
    for (let i = 0; i < 4; i++) { disc(c, -30 + i * 20, -47, 5, ['#c0392b', '#2e86c1', '#d4ac0d', '#58a05a'][i]); R(c, -32 + i * 20, -56, 4, 5, '#ddd'); }
  },
};

/* ============================================================
   CHARACTERS — one jointed "rig" draws every person in the game
   ============================================================ */
const LOOKS = {
  hunter:   { coat: '#27323a', coat2: '#1a2227', skin: '#c9a889', head: 'hood', hood: '#1f2a31', cloak: '#161d22', scarf: '#d1622b', weapon: 'sword', blade: '#dfe9ee', backSword: true, eye: '#ffd27a' },
  bandit:   { coat: '#4a3526', coat2: '#2e2118', skin: '#b08d6e', head: 'mask', hood: '#2a1c14', weapon: 'club', eye: null },
  cutthroat:{ coat: '#3b2b33', coat2: '#231a20', skin: '#b08d6e', head: 'mask', hood: '#501c1c', weapon: 'sword', blade: '#9a9a9a' },
  archer:   { coat: '#3a4028', coat2: '#232818', skin: '#b08d6e', head: 'hood', hood: '#2a301c', weapon: 'bow' },
  merchant: { coat: '#5c4a2a', coat2: '#3a2e1a', skin: '#c9a889', head: 'brim', hood: '#2e2416', weapon: 'none', belly: 1.25 },
  survivor: { coat: '#4a4a44', coat2: '#2e2e2a', skin: '#b9a48f', head: 'hair', hood: '#b8b8b0', weapon: 'staff' },
  elder:    { coat: '#4f3f33', coat2: '#30261e', skin: '#c2a58a', head: 'hair', hood: '#d0d0c8', weapon: 'staff', beard: '#d0d0c8' },
  villager: { coat: '#5a4c3a', coat2: '#3a3024', skin: '#c2a58a', head: 'hair', hood: '#4a3020', weapon: 'none' },
  woman:    { coat: '#4a3a4a', coat2: '#2e242e', skin: '#cbb09a', head: 'hair', hood: '#6a3a22', weapon: 'none', skirt: true },
  child:    { coat: '#55604a', coat2: '#363c2e', skin: '#cbb09a', head: 'hair', hood: '#8a6a3a', weapon: 'none', scale: .62 },
  guard:    { coat: '#6a2a2a', coat2: '#3a1a1a', skin: '#b9987a', head: 'helm', hood: '#8a8f98', weapon: 'halberd' },
  innkeeper:{ coat: '#6a5a44', coat2: '#3a3226', skin: '#c9a889', head: 'bald', weapon: 'none', belly: 1.3, beard: '#5a4030' },
  blacksmith:{ coat: '#4a3a30', coat2: '#2a201a', skin: '#b88a6a', head: 'bald', weapon: 'club', beard: '#2a1c14', belly: 1.2, bare: true, scale: 1.06 },
  apothecary:{ coat: '#2c4a3a', coat2: '#1c2e24', skin: '#cbb09a', head: 'hood', hood: '#1e3328', weapon: 'none' },
  traveler: { coat: '#4a4038', coat2: '#2c2620', skin: '#b9a08a', head: 'hair', hood: '#3a2a1c', weapon: 'none' },
  ghoul:    { coat: '#55604c', coat2: '#3c4436', skin: '#7c8a6c', head: 'ghoul', weapon: 'claws', lean: .5, arm: 34, eye: '#d8ff7a', bare: true },
  brute:    { coat: '#3f4a35', coat2: '#2a3224', skin: '#6c7a58', head: 'ghoul', weapon: 'claws', lean: .42, arm: 36, leg: 32, torso: 34, scale: 1.32, eye: '#d8ff7a', bare: true, thick: 1.35, belly: 1.2 },
  rimebound:{ coat: '#6f93a6', coat2: '#4b6b7c', skin: '#b4d8e6', head: 'ghoul', weapon: 'claws', lean: .4, arm: 34, eye: '#e8fbff', eyeGlow: '190,240,255', bare: true },
  boneguard:{ coat: '#b9b4a2', coat2: '#8f8a7a', skin: '#d8d2bd', head: 'skull', hood: '#5c616e', weapon: 'sword', blade: '#8a8f98', shield: '#4a5062', eye: '#bfe4ff', eyeGlow: '150,205,255', bare: true, thick: .82 },
  stalker:  { coat: '#0c0714', coat2: '#07040c', skin: '#0c0714', head: 'bald', weapon: 'claws', scale: 1.18, eye: '#d9b8ff', eyeGlow: '180,110,255', arm: 32, lean: .2, bare: true, thick: .9 },
  lantern:  { coat: '#2f3a33', coat2: '#1c2420', skin: '#7f9486', head: 'brim', hood: '#151b18', cloak: '#18201c', weapon: 'lantern', scale: 1.3, eye: '#d8ffb0', eyeGlow: '200,255,150', leg: 34, torso: 34, arm: 30 },
  gravemother: { coat: '#4d4a55', coat2: '#33313a', skin: '#8d8a96', head: 'ghoul', weapon: 'claws', lean: .5, arm: 38, leg: 32, torso: 34, scale: 1.55, eye: '#c8ff6a', bare: true, thick: 1.4, belly: 1.25 },
  werewolf: { coat: '#4a3a2a', coat2: '#2e2318', skin: '#4a3a2a', head: 'wolf', weapon: 'claws', lean: .42, arm: 36, leg: 34, torso: 36, scale: 1.5, eye: '#ff3b2b', fur: true, bare: true, thick: 1.35 },
  vampire:  { coat: '#15121a', coat2: '#0b090e', skin: '#e4e0ea', head: 'vamp', hood: '#0b090e', cloak: '#0e0b12', cloakIn: '#5a0f1c', weapon: 'claws', eye: '#ff2a3a', scale: 1.12, collar: true },
};

function drawHuman(c, sx, sy, e) {
  const L = e.look, S = (L.scale || 1) * (e.scale || 1), t = e.t || 0, anim = e.anim || 'idle', ap = e.ap || 0;
  const K = e.flash > 0 ? () => '#ffffff' : x => x;
  const legL = L.leg || 30, th = legL * .52, sh = legL * .5, torL = L.torso || 30, armL = L.arm || 26, hr = 8.5, TH = L.thick || 1;

  // ---- pose ----
  let lean = (L.lean || 0), legA = [.16, -.16], knee = [.12, .12], armA = [.25, -.2], elb = [.25, .25];
  let rot = 0, air = 0, wAng = null, headTilt = 0, headRot = null, crouch = 0, squash = 1;
  const breathe = Math.sin(t * 2.2) * .8;
  switch (anim) {
    case 'run': case 'walk': {
      const ph = e.runPh || 0, amp = anim === 'run' ? .82 : .5;
      legA = [Math.sin(ph) * amp, -Math.sin(ph) * amp];
      knee = [Math.max(0, -Math.cos(ph)) * 1.25 * amp + .12, Math.max(0, Math.cos(ph)) * 1.25 * amp + .12];
      armA = [-Math.sin(ph) * .7 * amp + .1, Math.sin(ph) * .7 * amp];
      elb = [.7, .7]; lean += (anim === 'run' ? .16 : .06) + (e.sprinting ? .13 : 0);
      if (L.weapon !== 'none' && L.weapon !== 'claws') { armA[0] = .5 + Math.sin(ph) * .12; elb[0] = .9; }
      break;
    }
    case 'jump': legA = [.7, -.25]; knee = [1.2, .5]; armA = [1.1, -.9]; elb = [.5, .4]; air = 1; lean += .08; break;
    case 'fall': legA = [.3, -.45]; knee = [.4, .7]; armA = [2.0, -1.6]; elb = [.3, .3]; air = 1; break;
    case 'attack': {
      const k = e.atkKind || 0;
      const sw = easeOut(clamp((ap - .12) / .42, 0, 1));
      const from = [3.5, .1, 3.9][k % 3], to = [.55, 2.9, .2][k % 3];
      armA = [lerp(from, to, sw), -.6]; elb = [.15, .9];
      lean += lerp(-.1, .32, sw) * (k === 2 ? 1.3 : 1);
      legA = [.5, -.5]; knee = [.5, .15];
      wAng = armA[0] + (k === 1 ? -.35 : .35) * (sw * 2 - 1);
      break;
    }
    case 'windup': { armA = [lerp(.4, 3.3, easeOut(ap)), -.5]; elb = [.3, .6]; lean -= .16 * ap; legA = [.3, -.4]; knee = [.3, .2]; wAng = armA[0] - .3; break; }
    case 'strike': { const sw = easeOut(ap); armA = [lerp(3.3, .5, sw), -.6]; elb = [.15, .8]; lean += .3 * sw; legA = [.55, -.5]; knee = [.5, .12]; wAng = armA[0] + .3; break; }
    case 'roll': rot = easeInOut(ap) * TAU; legA = [1.5, 1.2]; knee = [2.1, 2.0]; armA = [1.2, 1.0]; elb = [1.6, 1.6]; lean += .5; squash = .9; break;
    case 'cast': armA = [1.65 + Math.sin(ap * Math.PI) * .1, -.5]; elb = [.05, .7]; lean += .12; legA = [.4, -.4]; knee = [.3, .1]; wAng = -1; break;
    case 'hurt': lean -= .35; armA = [-.9, -1.2]; elb = [.6, .6]; legA = [.3, -.2]; knee = [.4, .2]; headTilt = -.3; break;
    case 'dead': rot = -easeOut(Math.min(1, ap * 1.6)) * 1.5; legA = [.3, -.1]; knee = [.2, .5]; armA = [-.6, -1.4]; elb = [.3, .3]; break;
    case 'talk': armA = [.9 + Math.sin(t * 5) * .25, -.2]; elb = [1.2, .3]; break;
    case 'cower': crouch = .45; lean += .5; armA = [2.4, 2.2]; elb = [1.8, 1.8]; legA = [.9, .6]; knee = [1.7, 1.6]; break;
    case 'bowAim': armA = [1.57, 1.3]; elb = [0, 1.4]; legA = [.3, -.3]; knee = [.1, .1]; break;
    case 'howl': lean -= .5; armA = [-.7, -.9]; elb = [.4, .4]; legA = [.4, -.4]; knee = [.3, .3]; headTilt = -.2; headRot = -1.0; break;   // head thrown back, muzzle to the sky
    case 'block': armA = [1.7, -.3]; elb = [.75, .5]; lean -= .05; legA = [.45, -.4]; knee = [.35, .2]; wAng = 3.05; break;   // blade held upright in front
    case 'sit': legA = [1.2, 1.05]; knee = [1.2, 1.05]; armA = [.75, .5]; elb = [.8, .8]; lean -= .06; break;
    case 'crouch': crouch = .35; lean += .35; armA = [.8, .2]; elb = [.9, .9]; legA = [.8, -.3]; knee = [1.5, 1.1]; break;
    case 'leap': lean += .7; armA = [2.2, 1.9]; elb = [.2, .2]; legA = [-.5, -.9]; knee = [.3, .5]; air = 1; break;
    default: armA = [.22 + breathe * .02, -.2 - breathe * .02]; if (L.weapon === 'staff') { armA[0] = .9; elb[0] = 1.2; }
  }

  if (L.shield && (anim === 'idle' || anim === 'run' || anim === 'walk')) { armA[1] = 1.05; elb[1] = .8; }     // shield held out in front

  // ---- skeleton ----
  const legPts = i => {
    const a = legA[i], k = knee[i];
    const kx = Math.sin(a) * th, ky = Math.cos(a) * th;
    return [kx, ky, kx + Math.sin(a - k) * sh, ky + Math.cos(a - k) * sh];
  };
  const l0 = legPts(0), l1 = legPts(1);
  let hipY = air ? -legL * .92 : -Math.max(l0[3], l1[3], legL * .35);
  if (anim === 'sit') hipY = -25;
  hipY += breathe * (anim === 'idle' || anim === 'talk' ? 1 : 0);
  const shX = Math.sin(lean) * torL, shY = hipY - Math.cos(lean) * torL;
  const hdX = shX + Math.sin(lean + headTilt) * (hr + 2), hdY = shY - Math.cos(lean + headTilt) * (hr + 2);
  const armPts = i => {
    const a = armA[i] , b = elb[i];
    const ex = shX + Math.sin(a) * armL * .5, ey = shY + Math.cos(a) * armL * .5;
    return [ex, ey, ex + Math.sin(a + b) * armL * .5, ey + Math.cos(a + b) * armL * .5];
  };
  const a0 = armPts(0), a1 = armPts(1);

  c.save();
  c.translate(sx, sy);
  if (e.alpha !== undefined) c.globalAlpha = e.alpha;
  c.scale(e.dir * S, S * squash);
  if (rot) { const pv = anim === 'dead' ? 0 : -legL * .8; c.translate(0, pv); c.rotate(rot); c.translate(0, -pv); }
  if (anim === 'dead') c.translate(0, -4 * easeOut(Math.min(1, ap * 1.6)));
  c.lineCap = 'round'; c.lineJoin = 'round';

  // back sword
  if (L.backSword) { line(c, shX - 8, shY + 20, shX + 4, shY - 14, 3, K('#3a2c20')); line(c, shX + 4, shY - 14, shX + 8, shY - 24, 3, K('#8a6a3a')); }
  // cloak (behind)
  if (L.cloak && anim !== 'roll') {
    const sway = clamp(Math.abs(e.vx || 0) / 200, 0, 1) * 14 + Math.sin(t * 4) * 2 + (air ? 8 : 0);
    c.fillStyle = K(L.cloak); c.beginPath(); c.moveTo(shX + 5, shY - 2); c.lineTo(shX - 8, shY);
    c.quadraticCurveTo(-12 - sway * .5, hipY, -10 - sway, hipY + legL * .62 + Math.sin(t * 6) * 2);
    c.lineTo(-2 - sway * .6, hipY + legL * .7); c.lineTo(4 - sway * .3, hipY + legL * .58 + Math.sin(t * 5 + 1) * 2); c.lineTo(7, hipY + 4); c.closePath(); c.fill();
    if (L.cloakIn) { c.fillStyle = K(L.cloakIn); c.beginPath(); c.moveTo(shX - 4, shY + 2); c.quadraticCurveTo(-8 - sway * .4, hipY, -6 - sway * .8, hipY + legL * .56); c.lineTo(2, hipY + legL * .5); c.lineTo(4, hipY); c.closePath(); c.fill(); }
  }
  // back arm + back leg
  line(c, shX, shY + 3, a1[0], a1[1], 5.5 * TH, K(L.coat2)); line(c, a1[0], a1[1], a1[2], a1[3], 5 * TH, K(L.bare ? L.skin : L.coat2));
  line(c, 0, hipY, l1[0], hipY + l1[1], 7 * TH, K(L.coat2)); line(c, l1[0], hipY + l1[1], l1[2], hipY + l1[3], 6 * TH, K(L.coat2));
  if (L.weapon === 'claws') clawHand(c, a1[2], a1[3], armA[1] + elb[1], K('#ddd'));
  // torso
  const tw = 8.5 * TH * (L.belly || 1);
  c.strokeStyle = K(L.coat); c.lineWidth = tw * 2; c.beginPath(); c.moveTo(0, hipY - 2); c.lineTo(shX, shY + 5); c.stroke();
  if (L.skirt) poly(c, [-9, hipY - 4, 9, hipY - 4, 13, hipY + legL * .7, -13, hipY + legL * .7], K(L.coat));
  if (L.fur) { c.fillStyle = K(L.coat2); for (let i = 0; i < 6; i++) { const u = i / 5, bx = lerp(0, shX, u) - 9, by = lerp(hipY, shY, u); c.beginPath(); c.moveTo(bx + 4, by - 5); c.lineTo(bx - 9 - Math.sin(t * 5 + i) * 2, by - 2); c.lineTo(bx + 4, by + 6); c.fill(); } }
  // front leg
  line(c, 0, hipY, l0[0], hipY + l0[1], 7.5 * TH, K(L.coat)); line(c, l0[0], hipY + l0[1], l0[2], hipY + l0[3], 6.5 * TH, K(L.coat2));
  line(c, l0[2], hipY + l0[3], l0[2] + 5, hipY + l0[3], 5 * TH, K(L.coat2));
  // scarf
  if (L.scarf && anim !== 'roll') {
    const sway = clamp(Math.abs(e.vx || 0) / 200, 0, 1);
    c.strokeStyle = K(L.scarf); c.lineWidth = 4.5; c.beginPath(); c.moveTo(shX + 4, shY - 2); c.lineTo(shX - 4, shY);
    c.quadraticCurveTo(shX - 12 - sway * 8, shY + 4 - sway * 4 + Math.sin(t * 7) * 2, shX - 20 - sway * 14, shY + 9 - sway * 9 + Math.sin(t * 6 + 1) * 4); c.stroke();
  }
  if (L.shield && anim !== 'dead') {
    const up = anim === 'idle' || anim === 'run' || anim === 'walk', kx = a1[2] + 3, ky = a1[3] - 2;
    c.save(); c.translate(kx, ky); if (!up) c.rotate(.9);
    poly(c, [-9, -14, 9, -14, 9, 2, 0, 15, -9, 2], K(L.shield)); poly(c, [0, -14, 9, -14, 9, 2, 0, 15], K('rgba(0,0,0,.28)')); disc(c, 0, -2, 2.5, K('#9aa0ac')); c.restore();
  }
  // head
  headDraw(c, L, hdX, hdY, hr, headRot !== null ? -headRot / .6 : lean + headTilt, K, t, e);
  // front arm
  line(c, shX, shY + 3, a0[0], a0[1], 6 * TH, K(L.coat)); line(c, a0[0], a0[1], a0[2], a0[3], 5.5 * TH, K(L.bare ? L.skin : L.coat));
  // weapon
  const hx = a0[2], hy = a0[3], handAng = armA[0] + elb[0];
  if (L.weapon === 'sword') {
    const wa = wAng !== null ? wAng : handAng + .62, len = 36;
    if (wAng !== -1) {
      const tx = hx + Math.sin(wa) * len, ty = hy + Math.cos(wa) * len;
      line(c, hx - Math.sin(wa) * 5, hy - Math.cos(wa) * 5, hx + Math.sin(wa) * 4, hy + Math.cos(wa) * 4, 3.5, K('#5a3e22'));
      line(c, hx + Math.sin(wa) * 4 + Math.cos(wa) * 5, hy + Math.cos(wa) * 4 - Math.sin(wa) * 5, hx + Math.sin(wa) * 4 - Math.cos(wa) * 5, hy + Math.cos(wa) * 4 + Math.sin(wa) * 5, 2.5, K('#8a8a8a'));
      line(c, hx + Math.sin(wa) * 5, hy + Math.cos(wa) * 5, tx, ty, 2.6, K(L.blade || '#cfd6da'));
    }
  } else if (L.weapon === 'club') {
    const wa = wAng !== null ? wAng : handAng + .9;
    line(c, hx, hy, hx + Math.sin(wa) * 20, hy + Math.cos(wa) * 20, 3.5, K('#4a3622')); line(c, hx + Math.sin(wa) * 20, hy + Math.cos(wa) * 20, hx + Math.sin(wa) * 32, hy + Math.cos(wa) * 32, 7, K('#3a2a1a'));
  } else if (L.weapon === 'halberd') {
    line(c, hx + 2, hy + 26, hx + 2, hy - 54, 3, K('#3a2c20')); poly(c, [hx + 2, hy - 68, hx + 6, hy - 54, hx - 2, hy - 54], K('#b8bcc4')); poly(c, [hx + 3, hy - 52, hx + 16, hy - 46, hx + 3, hy - 38], K('#b8bcc4'));
  } else if (L.weapon === 'staff') {
    line(c, hx + 1, 0, hx + 1, hy - 28, 3, K('#3a2c20'));
  } else if (L.weapon === 'bow') {
    c.strokeStyle = K('#5a3e22'); c.lineWidth = 2.5; c.beginPath(); c.arc(hx - 6, hy, 22, -1.1, 1.1); c.stroke();
    const pull = anim === 'bowAim' ? ap * 12 : 0;
    line(c, hx - 6 + Math.cos(1.1) * 22, hy - Math.sin(1.1) * 22, hx + 4 - pull, hy, 1, K('#ccc')); line(c, hx + 4 - pull, hy, hx - 6 + Math.cos(1.1) * 22, hy + Math.sin(1.1) * 22, 1, K('#ccc'));
    if (anim === 'bowAim') line(c, hx - pull, hy, hx + 26 - pull, hy, 1.6, K('#d8d0c0'));
  } else if (L.weapon === 'lantern') {
    const wa = wAng !== null && wAng !== -1 ? wAng : 2.5, ex = hx + Math.sin(wa) * 30, ey = hy + Math.cos(wa) * 30;
    line(c, hx, hy, ex, ey, 2.5, K('#2a2018')); line(c, ex, ey, ex, ey + 7, 1.2, K('#666'));
    R(c, ex - 5, ey + 7, 10, 13, K('#1a1410')); poly(c, [ex - 6, ey + 7, ex, ey + 2, ex + 6, ey + 7], K('#1a1410'));
    if (e.lit !== false) { R(c, ex - 3.5, ey + 9, 7, 9, K('#c8ff8a')); if (!e.flash) { c.globalCompositeOperation = 'lighter'; glow(c, ex, ey + 13, 64, '170,255,120', .5 + .1 * Math.sin(t * 9)); c.globalCompositeOperation = 'source-over'; } }
  } else if (L.weapon === 'claws') clawHand(c, hx, hy, handAng, K('#eee'));
  c.restore();
}
function clawHand(c, x, y, ang, col) {
  for (let i = -1; i <= 1; i++) { const a = ang + i * .35; line(c, x, y, x + Math.sin(a) * 9, y + Math.cos(a) * 9, 1.6, col); }
}
function headDraw(c, L, x, y, r, tilt, K, t, e) {
  c.save(); c.translate(x, y); c.rotate(-tilt * .6);
  if (L.head === 'wolf') {
    c.fillStyle = K(L.coat); c.beginPath(); c.ellipse(0, 0, r * 1.15, r, 0, 0, TAU); c.fill();
    poly(c, [4, -5, 22, -1, 22, 4, 4, 6], K(L.coat)); poly(c, [8, 3, 21, 4, 9, 9], K('#1a0f0a'));
    for (let i = 0; i < 3; i++) poly(c, [11 + i * 4, 3, 13 + i * 4, 8, 15 + i * 4, 3], K('#f0ece0'));
    poly(c, [-6, -7, -9, -20, 0, -9], K(L.coat2)); poly(c, [0, -8, 2, -21, 7, -7], K(L.coat));
    for (let i = 0; i < 4; i++) poly(c, [-8, -4 + i * 4, -17 - Math.sin(t * 6 + i) * 2, -2 + i * 4, -8, 2 + i * 4], K(L.coat2));
    if (!e.flash) { c.globalCompositeOperation = 'lighter'; glow(c, 6, -2, 9, '255,60,40', .8); c.globalCompositeOperation = 'source-over'; } disc(c, 6, -2, 1.6, K('#ffd0c0'));
  } else if (L.head === 'ghoul') {
    disc(c, 0, 0, r, K(L.skin)); poly(c, [2, 2, 10, 5, 3, 8], K('#1a1f14'));
    if (!e.flash) { c.globalCompositeOperation = 'lighter'; glow(c, 4, -2, 7, L.eyeGlow || '210,255,120', .7); c.globalCompositeOperation = 'source-over'; } disc(c, 4, -2, 1.5, K('#f4ffd0'));
  } else {
    disc(c, 0, 0, r, K(L.skin));
    if (L.beard) { c.fillStyle = K(L.beard); c.beginPath(); c.moveTo(-2, 3); c.quadraticCurveTo(6, 16, 9, 2); c.lineTo(8, -1); c.closePath(); c.fill(); }
    if (L.head === 'hood') {
      c.fillStyle = K(L.hood); c.beginPath(); c.moveTo(7, -7); c.quadraticCurveTo(-2, -15, -11, -6); c.quadraticCurveTo(-15, 4, -8, 10); c.lineTo(-2, 9); c.quadraticCurveTo(-7, 0, 2, -6); c.quadraticCurveTo(6, -6, 9, -3); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; if (!e.flash) { c.beginPath(); c.arc(1, 0, r * .9, -1.9, 1.2); c.fill(); }
    } else if (L.head === 'mask') {
      c.fillStyle = K(L.hood); c.beginPath(); c.arc(0, 0, r + .5, Math.PI * .95, Math.PI * 2.02); c.fill(); R(c, -r, 1, r * 2, 6, K(L.hood)); c.beginPath(); c.arc(0, 1, r, 0, Math.PI); c.fill();
      R(c, 1, -3, 7, 2.5, K(L.skin));
    } else if (L.head === 'brim') {
      R(c, -15, -8, 30, 3.5, K(L.hood)); c.fillStyle = K(L.hood); c.beginPath(); c.arc(0, -8, 8, Math.PI, 0); c.fill();
    } else if (L.head === 'helm') {
      c.fillStyle = K(L.hood); c.beginPath(); c.arc(0, -1, r + 1.5, Math.PI, 0); c.fill(); R(c, -r - 2, -2, r * 2 + 5, 3, K(L.hood)); R(c, 3, -2, 2.5, 9, K(L.hood));
    } else if (L.head === 'hair') {
      c.fillStyle = K(L.hood); c.beginPath(); c.arc(-1, -1.5, r + .8, Math.PI * .75, Math.PI * 1.9); c.fill();
      if (L.skirt) { c.beginPath(); c.moveTo(-r, -2); c.quadraticCurveTo(-r - 5, 10, -r + 1, 16); c.lineTo(-2, 6); c.fill(); }
    } else if (L.head === 'vamp') {
      c.fillStyle = K('#17121c'); c.beginPath(); c.arc(-1.5, -1.5, r + .6, Math.PI * .7, Math.PI * 1.85); c.fill(); poly(c, [-r, 2, -r - 2, 12, -4, 6], K('#17121c'));
      poly(c, [3, 5, 4.4, 9, 5.8, 5], K('#fff'));
    } else if (L.head === 'skull') {
      disc(c, 3.8, -1, 2.7, K('#14110f')); R(c, 1, 4.6, 7, 1.6, K('#14110f')); R(c, 3, 3, 1.2, 4, K('#14110f')); R(c, 5.4, 3, 1.2, 4, K('#14110f'));
      c.fillStyle = K(L.hood); c.beginPath(); c.arc(0, -1.5, r + 1.4, Math.PI, 0); c.fill(); R(c, -r - 2, -2.5, r * 2 + 4, 2.5, K(L.hood));
    }
    if (L.collar) { poly(c, [-9, 8, -14, -8, -4, 6], K(L.cloak)); poly(c, [6, 9, 12, -4, 2, 8], K(L.cloak)); }
    if (L.eye) { if (!e.flash) { c.globalCompositeOperation = 'lighter'; glow(c, 4.5, -1, 7, L.eyeGlow || (L.head === 'vamp' ? '255,40,60' : '255,200,110'), .75); c.globalCompositeOperation = 'source-over'; } disc(c, 4.5, -1, 1.3, K(L.eye)); }
    else if (!e.flash) disc(c, 4.5, -1, 1, 'rgba(0,0,0,.7)');
  }
  c.restore();
}

/* ---------- creatures with their own shapes ---------- */
function drawWolf(c, sx, sy, e) {
  const K = e.flash > 0 ? () => '#fff' : x => x, t = e.t, ph = e.runPh || 0;
  const sc = e.scale || 1;
  c.save(); c.translate(sx, sy); c.scale(e.dir * sc, sc); c.lineCap = 'round';
  let stretch = 0, rot = 0, crouch = 0;
  if (e.anim === 'leap') { stretch = 8; rot = -.25 + e.ap * .5; }
  if (e.anim === 'howl') rot = -.42;
  if (e.anim === 'crouch') crouch = 6;
  if (e.anim === 'dead') { c.translate(0, -6); c.rotate(Math.min(1, e.ap * 2) * 1.45); c.translate(0, 12); }
  c.translate(0, -26 + crouch); c.rotate(rot);
  const body = K(e.col || '#2f3138'), dark = K(e.col2 || '#1e2026');
  const sw = e.anim === 'run' ? Math.sin(ph) * .7 : e.anim === 'leap' ? .9 : 0;
  line(c, -16, 2, -18 - sw * 12, 24 - crouch, 4.5, dark); line(c, 14, 2, 16 + sw * 12, 24 - crouch, 4.5, dark);
  line(c, -22 - stretch, 0, -36 - stretch, -8 + Math.sin(t * 5) * 3, 5, body); // tail
  c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 24 + stretch, 11, 0, 0, TAU); c.fill();
  for (let i = 0; i < 5; i++) poly(c, [-14 + i * 7, -9, -18 + i * 7, -16, -8 + i * 7, -10], dark);
  line(c, -14, 4, -12 + sw * 12, 25 - crouch, 5, body); line(c, 16, 4, 18 - sw * 12, 25 - crouch, 5, body);
  c.translate(24 + stretch, -7); disc(c, 0, 0, 9, body); poly(c, [4, -3, 19, 1, 18, 5, 4, 6], body); poly(c, [8, 3, 18, 4, 9, 8], K('#120b0b'));
  poly(c, [-5, -6, -6, -17, 2, -8], dark); poly(c, [1, -7, 4, -17, 7, -5], body);
  if (!e.flash) { c.globalCompositeOperation = 'lighter'; glow(c, 5, -2, 7, '255,210,90', .7); c.globalCompositeOperation = 'source-over'; } disc(c, 5, -2, 1.3, K('#ffe9a0'));
  c.restore();
}

function drawWraith(c, sx, sy, e) {
  const t = e.t, K = e.flash > 0 ? () => '#fff' : x => x;
  c.save(); c.translate(sx, sy - 14 + Math.sin(t * 2.4) * 5); c.scale(e.dir, 1);
  c.globalAlpha = (e.alpha === undefined ? 1 : e.alpha) * .92;
  const solid = e.solid ? 1 : 0;
  c.globalCompositeOperation = 'lighter'; glow(c, 0, -64, 86, solid ? '255,170,110' : '140,255,230', .32); c.globalCompositeOperation = 'source-over';
  const g = c.createLinearGradient(0, -120, 0, 0);
  g.addColorStop(0, K(solid ? '#6a5c58' : '#4c7a78')); g.addColorStop(.6, K(solid ? '#3a2f2c' : '#1f3c40')); g.addColorStop(1, 'rgba(10,30,34,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, -122); c.quadraticCurveTo(16, -118, 17, -98); c.quadraticCurveTo(30, -84, 26, -50);
  for (let i = 0; i <= 8; i++) { const x = 26 - i * 7, y = (i % 2 ? -4 : -22) + Math.sin(t * 5 + i * 1.3) * 5; c.lineTo(x - (e.vx || 0) * .04, y); }
  c.quadraticCurveTo(-30, -84, -15, -100); c.quadraticCurveTo(-14, -120, 0, -122); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = K('#04090a'); c.beginPath(); c.ellipse(4, -101, 9, 12, 0, 0, TAU); c.fill();
  if (!e.flash) { c.globalCompositeOperation = 'lighter'; glow(c, 2, -104, 9, '170,255,235', .9); glow(c, 9, -104, 9, '170,255,235', .9); c.globalCompositeOperation = 'source-over'; }
  disc(c, 2, -104, 1.6, '#eafffa'); disc(c, 9, -104, 1.6, '#eafffa');
  // arms
  let a = .9, reach = 0;
  if (e.anim === 'windup') a = lerp(.9, 3.0, easeOut(e.ap)); if (e.anim === 'strike') { a = lerp(3.0, 1.2, easeOut(e.ap)); reach = 14; }
  if (e.anim === 'wail') a = 2.6 + Math.sin(t * 30) * .08;
  c.lineCap = 'round';
  for (const off of [0, -8]) {
    const ex = 10 + off + Math.sin(a) * 20, ey = -86 + Math.cos(a) * 20, hx = ex + Math.sin(a + .5) * (24 + reach), hy = ey + Math.cos(a + .5) * (24 + reach);
    line(c, 10 + off, -86, ex, ey, 3, K('#9fc4bd')); line(c, ex, ey, hx, hy, 2.5, K('#b9d8d2')); clawHand(c, hx, hy, a + .5, K('#e8fffa'));
  }
  c.restore();
}

function drawVoidspawn(c, sx, sy, e) {
  const t = e.t, flash = e.flash > 0, stun = e.stun > 0;
  const cy = sy - 130 + Math.sin(t * 1.3) * 8;
  c.save();
  if (e.alpha !== undefined) c.globalAlpha = e.alpha;
  c.fillStyle = 'rgba(8,0,18,.55)'; c.beginPath(); c.ellipse(sx, sy + 2, 120, 12, 0, 0, TAU); c.fill();
  // tendrils
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + Math.sin(t * .7 + i) * .4, L = 120 + Math.sin(t * 1.7 + i * 2) * 30;
    const ex = sx + Math.cos(a) * L * 1.2, ey = Math.min(sy, cy + Math.sin(a) * L + 60);
    const mx = sx + Math.cos(a + Math.sin(t * 2 + i) * .8) * L * .6, my = cy + Math.sin(a + Math.cos(t * 1.6 + i) * .8) * L * .6;
    c.strokeStyle = 'rgba(160,80,255,.28)'; c.lineWidth = 13; c.beginPath(); c.moveTo(sx, cy); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
    c.strokeStyle = flash ? '#fff' : '#07020e'; c.lineWidth = 8; c.stroke();
  }
  // glow halo
  c.globalCompositeOperation = 'lighter'; glow(c, sx, cy, 190, '140,60,255', .35 + .1 * Math.sin(t * 2)); c.globalCompositeOperation = 'source-over';
  // swirling mass
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996 + t * (.5 + (i % 4) * .22) * (i % 2 ? 1 : -1), r = 26 + (i % 5) * 12 + Math.sin(t * 2 + i) * 8;
    const bx = sx + Math.cos(a) * r, by = cy + Math.sin(a) * r * .8, br = 34 + (i % 3) * 12 + Math.sin(t * 3 + i * 2) * 6;
    const g = c.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, flash ? 'rgba(255,255,255,.9)' : 'rgba(4,0,10,.96)'); g.addColorStop(.7, flash ? 'rgba(255,255,255,.5)' : 'rgba(14,2,30,.8)'); g.addColorStop(1, 'rgba(40,10,80,0)');
    c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
  }
  // stars inside the void
  for (let i = 0; i < 14; i++) { const a = i * 1.9 + t * .3, r = 10 + (i * 13 % 50); disc(c, sx + Math.cos(a) * r, cy + Math.sin(a) * r * .8, .9, `rgba(255,255,255,${.3 + .5 * Math.abs(Math.sin(t * 2 + i))})`); }
  // core
  c.globalCompositeOperation = 'lighter';
  glow(c, sx, cy, stun ? 70 : 34, stun ? '255,200,255' : '230,120,255', stun ? .95 : .55 + .25 * Math.sin(t * 5));
  c.globalCompositeOperation = 'source-over';
  c.restore();
}
function drawVoidling(c, sx, sy, e) {
  const t = e.t, K = e.flash > 0;
  c.save(); c.translate(sx, sy - 46 + Math.sin(t * 4 + e.seed) * 5); c.scale(e.dir, 1);
  if (e.alpha !== undefined) c.globalAlpha = e.alpha;
  c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 46, '150,70,255', .3); c.globalCompositeOperation = 'source-over';
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) { c.strokeStyle = K ? '#fff' : '#0a0314'; c.lineWidth = 5 - i; c.beginPath(); c.moveTo(-6, 4); c.quadraticCurveTo(-22 - i * 6, 10 + Math.sin(t * 6 + i) * 10, -34 - i * 8, 14 + i * 5 + Math.sin(t * 5 + i * 2) * 8); c.stroke(); }
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + t * 2; disc(c, Math.cos(a) * 7, Math.sin(a) * 6, 13, K ? '#fff' : '#0a0314'); }
  const lunge = e.anim === 'strike' ? 1.4 : 1;
  disc(c, 6, -3, 2.6 * lunge, '#fff'); disc(c, 13, -2, 2.2 * lunge, '#fff');
  if (e.anim === 'windup') { c.globalCompositeOperation = 'lighter'; glow(c, 9, -2, 22, '255,120,255', .7 * e.ap); c.globalCompositeOperation = 'source-over'; }
  c.restore();
}
function drawWisp(c, sx, sy, e) {
  const t = e.t, y = sy - 52 + Math.sin(t * 3 + e.seed) * 7, hot = e.anim === 'windup' ? 1 + e.ap * .8 : 1;
  c.save(); if (e.alpha !== undefined) c.globalAlpha = e.alpha;
  c.globalCompositeOperation = 'lighter'; glow(c, sx, y, 48 * hot, '150,255,210', .42); glow(c, sx, y, 17 * hot, '230,255,240', .9); c.globalCompositeOperation = 'source-over';
  c.fillStyle = e.flash > 0 ? '#fff' : '#eafff4'; c.beginPath(); c.moveTo(sx - 5, y + 2); c.quadraticCurveTo(sx + Math.sin(t * 9) * 3, y - 19 - Math.sin(t * 7) * 3, sx + 5, y + 2); c.quadraticCurveTo(sx, y + 8, sx - 5, y + 2); c.fill();
  c.restore();
}
function drawBat(c, sx, sy, e) {
  const f = Math.sin(e.t * 26) * 7;
  c.save(); c.translate(sx, sy);
  poly(c, [0, 0, -12, -5 - f, -8, 2, -15, 3 - f * .6], '#190b12'); poly(c, [0, 0, 12, -5 - f, 8, 2, 15, 3 - f * .6], '#190b12'); disc(c, 0, 0, 4, '#2a0f18');
  disc(c, -1.5, -1, .9, '#ff4050'); disc(c, 1.5, -1, .9, '#ff4050'); c.restore();
}
function drawRift(c, sx, sy, e) {
  const t = e.t, big = e.scale || 1, s = clamp(e.open, 0, 1) * big;
  c.save(); c.translate(sx, sy - 80 * big); c.scale(s, s);
  c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 120, '170,80,255', .4); c.globalCompositeOperation = 'source-over';
  c.fillStyle = e.flash > 0 ? '#fff' : '#030008'; c.beginPath();
  for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = 1 + .14 * Math.sin(a * 5 + t * 6); c.lineTo(Math.cos(a) * 26 * r, Math.sin(a) * 62 * r); }
  c.fill(); c.strokeStyle = `rgba(210,140,255,${.7 + .3 * Math.sin(t * 8)})`; c.lineWidth = 3; c.stroke();
  for (let i = 0; i < 8; i++) disc(c, Math.sin(i * 4.1 + t) * 14, Math.cos(i * 2.7 + t * .7) * 44, 1, 'rgba(255,255,255,.8)');
  c.restore();
}

/* ---------- shadows ---------- */
function shadow(c, sx, h, w) {
  const s = clamp(1 - h / 260, .3, 1);
  c.fillStyle = `rgba(0,0,0,${.32 * s})`; c.beginPath(); c.ellipse(sx, GROUND + 3, w * s, 4.5 * s, 0, 0, TAU); c.fill();
}
