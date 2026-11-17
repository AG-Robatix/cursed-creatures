'use strict';
/* ============================================================
   controls.js — other ways to play: a gamepad, a touch screen,
   and fullscreen. Both gamepad and touch simply "press" the same
   keys the keyboard uses, so the rest of the game needs no changes.
   ============================================================ */

function toggleFullscreen() {
  const d = document, el = d.documentElement, on = d.fullscreenElement || d.webkitFullscreenElement;
  try {
    if (on) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else {
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); }).catch(() => { });
    }
  } catch (e) { }
}
function pressKey(code) { Keys.down[code] = true; Keys.pressed[code] = true; }
function releaseKey(code) { Keys.down[code] = false; }
const inPlayNow = () => G.state === 'play' && !G.dialog && !G.shop && !G.pouch;

/* ---------- gamepad ----------
   Stick or d-pad left/right: move · A: jump · X: attack (hold to charge) · B: roll · Y: talk / use
   LB: block · RB: Ember · LT: Ward · RT: sprint · d-pad up: healing elixir · d-pad down: the right oil for the nearest creature
   L3 / R3: tonic / focus draught · Start: pause.  In menus: stick or d-pad to move, A to confirm, B to go back. */
const Pad = {
  prev: {}, seen: false,
  poll() {
    let gp = null;
    try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.connected) { gp = p; if (p.mapping === 'standard') break; } } catch (e) { }
    const now = {};
    if (gp) {
      const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5));
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (inPlayNow()) {
        if (ax < -.35 || b(14)) now.ArrowLeft = 1; if (ax > .35 || b(15)) now.ArrowRight = 1;
        if (b(0)) now.Space = 1; if (b(2)) now.KeyJ = 1; if (b(1)) now.KeyK = 1; if (b(3)) now.KeyE = 1;
        if (b(4)) now.KeyS = 1; if (b(5)) now.KeyL = 1; if (b(6)) now.KeyI = 1; if (b(7)) now.ShiftLeft = 1;
        if (b(12)) now.Digit1 = 1; if (b(10)) now.Digit2 = 1; if (b(11)) now.Digit3 = 1;
        if (b(13)) now[this.oilKey()] = 1;
        if (b(9)) now.Escape = 1;
      } else {
        if (ay < -.5 || b(12)) now.ArrowUp = 1; if (ay > .5 || b(13)) now.ArrowDown = 1;
        if (ax < -.5 || b(14)) now.ArrowLeft = 1; if (ax > .5 || b(15)) now.ArrowRight = 1;
        if (b(0) || b(2)) now.Enter = 1; if (b(1) || b(9)) now.Escape = 1;
      }
    }
    for (const c in now) if (!this.prev[c]) { pressKey(c); this.seen = true; }
    for (const c in this.prev) if (!now[c]) releaseKey(c);
    this.prev = now;
  },
  // which oil to apply: the one that suits the nearest creature, if you carry it
  oilKey() {
    const S = G.S, p = G.player; let fam = null, bd = 700;
    for (const e of G.ents) if (e.enemy && !e.dead && OIL_KEYS.includes(e.fam) && Math.abs(e.x - p.x) < bd) { bd = Math.abs(e.x - p.x); fam = e.fam; }
    let i = fam && S.oil[fam] ? OIL_KEYS.indexOf(fam) : OIL_KEYS.findIndex(k => S.oil[k] > 0);
    return 'Digit' + (4 + Math.max(0, i));
  },
};

/* ---------- touch screen ----------
   Left thumb: drag anywhere on the left to move (drag further to sprint).
   Right thumb: Attack, Roll, Jump, Block, the two glyphs (Ember, Ward), and Use when something is near.
   Top left, under the health bar: two quick buttons and the Pouch. The Pouch opens a tray with every potion and oil
   as a large button and pauses the fight while it is open. The quick buttons start as "healing elixir" and
   "best oil for the nearest creature"; tap one inside the Pouch to put something else on it (kept in G.S.quick).
   On a touch screen the small keyboard slots along the bottom are hidden; these buttons replace them. */
const POUCH_TILES = [
  { id: 'pot:vit', kind: 'pot', key: 'vit', i: 0, note: 'Heals 40 health' }, { id: 'pot:tem', kind: 'pot', key: 'tem', i: 1, note: 'Attack +10 for 45s' }, { id: 'pot:foc', kind: 'pot', key: 'foc', i: 2, note: 'Stamina, 30s' },
  { id: 'oil:dead', kind: 'oil', key: 'dead', note: 'Against the dead' }, { id: 'oil:beast', kind: 'oil', key: 'beast', note: 'Against beasts' }, { id: 'oil:void', kind: 'oil', key: 'void', note: 'Against void things' },
];
const QUICK_DEFAULT = ['pot:vit', 'oil:auto'];
const Touch = {
  on: false, map: new Map(), stick: null, assign: -1,
  btns: [
    { x: 878, y: 448, r: 48, code: 'KeyJ', label: 'Attack' },
    { x: 776, y: 474, r: 36, code: 'KeyK', label: 'Roll' },
    { x: 800, y: 384, r: 36, code: 'Space', label: 'Jump' },
    { x: 892, y: 344, r: 36, code: 'KeyS', label: 'Block' },
    { x: 690, y: 432, r: 33, code: 'KeyL', label: 'Ember', icon: 'ember', ok: () => G.S.sta >= COST.ember },
    { x: 716, y: 346, r: 33, code: 'KeyI', label: 'Ward', icon: 'ward', ok: () => G.S.sta >= COST.ward && !(G.player.ward > 0) },
    { x: 806, y: 292, r: 30, code: 'KeyE', label: 'Use', when: () => !!G.near },
    { x: 56, y: 138, r: 31, quick: 0 },
    { x: 130, y: 138, r: 31, quick: 1 },
    { x: 204, y: 138, r: 31, icon: 'pouch', pouch: true },
    { x: 480, y: 28, r: 20, code: 'Escape', label: 'II' },
  ],
  // the oil the "best oil" button would apply: the one that suits the nearest creature if you carry it, otherwise any you have
  oilPick() {
    const S = G.S, p = G.player; let fam = null, bd = 700;
    for (const e of G.ents) if (e.enemy && !e.dead && OIL_KEYS.includes(e.fam) && Math.abs(e.x - p.x) < bd) { bd = Math.abs(e.x - p.x); fam = e.fam; }
    if (fam && S.oil[fam] > 0) return fam;
    return OIL_KEYS.find(k => S.oil[k] > 0) || null;
  },
  // what a quick button currently holds: its key press, how many are left, and how to draw it
  quick(i) {
    const S = G.S; if (!Array.isArray(S.quick)) S.quick = QUICK_DEFAULT.slice();
    const id = S.quick[i] || QUICK_DEFAULT[i], [kind, key] = id.split(':');
    if (kind === 'pot') return { id, name: POTIONS[key].name, oil: false, code: 'Digit' + (['vit', 'tem', 'foc'].indexOf(key) + 1), count: S.pot[key], draw: (c, x, y, k) => bottle(c, x, y + 2 * k, POTIONS[key].col, 1.9 * k) };
    const pick = key === 'auto' ? this.oilPick() : key, shown = pick || (S.oilOn && S.oilOn.type);
    return { id, name: key === 'auto' ? 'Best oil (automatic)' : OILS[key].name, oil: true, code: pick ? 'Digit' + (4 + OIL_KEYS.indexOf(pick)) : null, count: pick ? S.oil[pick] : 0,
      draw: (c, x, y, k) => { oilDrop(c, x, y + k, shown ? OILS[shown].col : '#777', 1.8 * k); if (key === 'auto') { c.font = font(9 * k, 'bold'); c.fillStyle = '#f3e2b0'; c.textAlign = 'center'; c.fillText('AUTO', x, y - 17 * k); } } };
  },
  // phones cannot go fullscreen from a web page (and do not need to), so the icon is only shown where it works
  fsButton() { return G.state === 'title' && !this.on && (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) ? { x: 926, y: 506, r: 18 } : null; },
  // ---- the pouch tray ----
  tile(i) { return { x: 172 + (i % 3) * 210, y: 194 + Math.floor(i / 3) * 110, w: 196, h: 98 }; },
  slotBox(i) { return { x: 262 + i * 228, y: 130, w: 208, h: 46 }; },
  autoBox() { return { x: 340, y: 420, w: 280, h: 40 }; },
  count(t) { return t.kind === 'pot' ? G.S.pot[t.key] : G.S.oil[t.key]; },
  closePouch() { G.pouch = false; this.assign = -1; },
  pouchTap(x, y) {
    const inside = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    for (let i = 0; i < 2; i++) if (inside(this.slotBox(i))) { this.assign = this.assign === i ? -1 : i; sfx('select'); return; }     // choose a quick button to change
    if (this.assign >= 0 && inside(this.autoBox())) { G.S.quick[this.assign] = 'oil:auto'; this.assign = -1; sfx('confirm'); return; }
    for (let i = 0; i < POUCH_TILES.length; i++) {
      const t = POUCH_TILES[i]; if (!inside(this.tile(i))) continue;
      if (this.assign >= 0) { this.quick(0); G.S.quick[this.assign] = t.id; this.assign = -1; sfx('confirm'); return; }     // put this item on the chosen quick button
      if (this.count(t) > 0) { if (t.kind === 'pot') usePotion(G.player, t.i); else useOil(G.player, t.key); this.closePouch(); }
      else sfx('select');
      return;
    }
    this.closePouch(); sfx('select');      // a tap anywhere else closes the pouch
  },
  start(id, x, y) {
    if (G.state === 'name') {      // no keyboard on a phone: ask for the name with the system prompt
      if (x > 500 && x < 780 && y > 340 && y < 392) { const n = window.prompt('Enter the name of your monster hunter', G.nameText); if (n !== null) G.nameText = n.replace(/[^a-zA-Z]/g, '').slice(0, 14); }
      else if (y > 396 && y < 440) Keys.typed.push('Enter');
      this.map.set(id, { type: 'ui' }); return;
    }
    if (G.state === 'play' && G.pouch) { this.pouchTap(x, y); this.map.set(id, { type: 'none' }); return; }
    if (inPlayNow() && !G.transition && !(G.cutscene > 0)) {
      if (!G.flags.h_touch) { G.flags.h_touch = 1; if (G.flags.h_move) hint('Drag on the left side to move; drag further to sprint. Your right thumb has Attack, Roll, Jump, Block and the two glyphs. At the top left are two quick buttons and the Pouch with everything else you carry.', 13); }
      for (const b of this.btns) {
        if ((b.when && !b.when()) || Math.hypot(x - b.x, y - b.y) > b.r + 10) continue;
        if (b.pouch) { G.pouch = true; this.assign = -1; sfx('select'); this.releaseAll(); this.map.set(id, { type: 'none' }); return; }
        const q = b.quick !== undefined ? this.quick(b.quick) : null, code = q ? q.code : b.code;
        if (!code) { G.toast('You carry no oils.'); this.map.set(id, { type: 'none' }); return; }
        pressKey(code); this.map.set(id, { type: 'btn', code }); return;
      }
      if (x < 440 && y > 180 && !this.stick) { this.stick = { id, x0: x, y0: y, x, y }; this.map.set(id, { type: 'stick' }); return; }
      this.map.set(id, { type: 'none' }); return;
    }
    const f = this.fsButton(); if (f && Math.hypot(x - f.x, y - f.y) < f.r + 10) { this.map.set(id, { type: 'fs' }); return; }
    Mouse.x = x; Mouse.y = y; Mouse.clicked = true; this.map.set(id, { type: 'ui' });       // everywhere else a tap is a click
  },
  move(id, x, y) {
    const m = this.map.get(id); if (!m || m.type !== 'stick' || !this.stick) return;
    this.stick.x = x; this.stick.y = y; this.applyStick();
  },
  applyStick() {
    const s = this.stick, dx = s ? s.x - s.x0 : 0;
    Keys.down.ArrowLeft = dx < -16; Keys.down.ArrowRight = dx > 16; Keys.down.ShiftLeft = Math.abs(dx) > 78;
  },
  releaseAll() { for (const m of this.map.values()) if (m.type === 'btn') releaseKey(m.code); this.stick = null; this.applyStick(); this.map.clear(); },
  end(id) {
    const m = this.map.get(id); if (!m) return; this.map.delete(id);
    if (m.type === 'btn') releaseKey(m.code);
    else if (m.type === 'stick') { this.stick = null; this.applyStick(); }
    else if (m.type === 'fs') toggleFullscreen();
  },
  icon(c, b) {
    const x = b.x, y = b.y;
    if (b.icon === 'ember') { c.globalCompositeOperation = 'lighter'; glow(c, x, y - 6, 20, '255,140,60', .7); c.globalCompositeOperation = 'source-over'; flame(c, x, y + 4, 6.5, G.t, 1); }
    else if (b.icon === 'ward') { c.strokeStyle = '#8fd0ff'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y - 6, 12, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y - 6, 5.5, 0, TAU); c.stroke(); }
    else if (b.icon === 'pouch') {      // a drawstring bag
      c.fillStyle = '#8a6a3a'; c.beginPath(); c.moveTo(x - 7, y - 8); c.quadraticCurveTo(x - 20, y + 6, x - 12, y + 15); c.lineTo(x + 12, y + 15); c.quadraticCurveTo(x + 20, y + 6, x + 7, y - 8); c.closePath(); c.fill();
      poly(c, [x - 9, y - 8, x - 12, y - 17, x, y - 12, x + 12, y - 17, x + 9, y - 8], '#6a4f2a'); line(c, x - 9, y - 8, x + 9, y - 8, 2.5, '#e2c27a');
    }
  },
  draw(c) {
    const f = this.fsButton();
    if (f) {      // fullscreen icon on the title screen (computers only)
      c.save(); c.globalAlpha = .55; c.strokeStyle = '#e2c27a'; c.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(f.x + sx * 9, f.y + sy * 3); c.lineTo(f.x + sx * 9, f.y + sy * 9); c.lineTo(f.x + sx * 3, f.y + sy * 9); c.stroke(); }
      c.restore();
    }
    if (this.on && G.state === 'play' && G.pouch) return this.drawPouch(c);
    if (!this.on || !inPlayNow() || G.cine > .5) return;
    const S = G.S;
    c.save(); c.textAlign = 'center';
    for (const b of this.btns) {
      if (b.when && !b.when()) continue;
      const q = b.quick !== undefined ? this.quick(b.quick) : null, code = q ? q.code : b.code;
      const down = !!(code && Keys.down[code]), ok = q ? q.count > 0 : (!b.ok || b.ok());
      c.globalAlpha = down ? .8 : .45; disc(c, b.x, b.y, b.r, down ? 'rgba(226,194,122,.5)' : 'rgba(10,11,14,.62)');
      c.strokeStyle = '#e2c27a'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.stroke();
      if (q && q.oil && S.oilOn) {      // a ring shows how long the oil on the blade has left
        c.globalAlpha = .95; c.strokeStyle = OILS[S.oilOn.type].col; c.lineWidth = 4; c.beginPath(); c.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * S.oilOn.t / OIL_TIME); c.stroke();
      }
      c.globalAlpha = ok ? .95 : .35;
      if (q) q.draw(c, b.x, b.y, 1); else if (b.icon) this.icon(c, b);
      c.textAlign = 'center'; c.fillStyle = '#f3e2b0';
      if (b.label) { c.font = font(b.r > 40 ? 16 : b.icon ? 10 : 13, 'bold'); c.fillText(b.label, b.x, b.icon ? b.y + 21 : b.y + 5); }
      if (q) { c.globalAlpha = .95; c.font = font(13, 'bold'); c.fillStyle = 'rgba(8,9,12,.85)'; c.beginPath(); c.arc(b.x + 21, b.y + 20, 11, 0, TAU); c.fill(); c.fillStyle = q.count ? '#fff' : '#888'; c.fillText(q.count, b.x + 21, b.y + 24.5); }
    }
    const s = this.stick, bx = s ? s.x0 : 140, by = s ? s.y0 : 420;      // the movement stick
    c.globalAlpha = s ? .5 : .22; c.strokeStyle = '#e2c27a'; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 78, 0, TAU); c.stroke();
    c.globalAlpha = s ? .35 : .18; c.beginPath(); c.arc(bx, by, 30, 0, TAU); c.stroke();
    const kx = s ? clamp(s.x, bx - 96, bx + 96) : bx; c.globalAlpha = s ? .7 : .3; disc(c, kx, by, 24, 'rgba(226,194,122,.55)');
    if (!s) { c.globalAlpha = .45; c.fillStyle = '#f3e2b0'; c.font = font(11, 'bold'); c.fillText('drag to move', bx, by - 90); }
    c.restore();
  },
  drawPouch(c) {
    const S = G.S, A = this.assign;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
    panel(c, 150, 62, 660, 416, .95);
    c.textAlign = 'center'; c.font = font(22, 'bold'); c.fillStyle = '#e2c27a'; c.fillText('Pouch', 480, 96);
    c.font = font(12, 'italic'); c.fillStyle = A >= 0 ? '#f3e2b0' : 'rgba(214,203,168,.75)';
    c.fillText(A >= 0 ? 'Now tap what should go on this quick button' : 'Your two quick buttons. Tap one to change what it holds.', 480, 120);
    for (let i = 0; i < 2; i++) {      // the two quick buttons, as they are set now
      const r = this.slotBox(i), q = this.quick(i), sel = A === i;
      c.fillStyle = sel ? 'rgba(226,194,122,.25)' : 'rgba(255,255,255,.06)'; c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = sel ? '#f3e2b0' : 'rgba(196,164,96,.6)'; c.lineWidth = sel ? 2.5 : 1.2; c.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
      c.save(); q.draw(c, r.x + 24, r.y + 23, .62); c.restore();
      c.textAlign = 'left'; c.font = font(10, 'bold'); c.fillStyle = '#c4a460'; c.fillText('QUICK ' + (i + 1), r.x + 46, r.y + 17);
      c.font = font(13, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText(q.name.length > 22 ? q.name.slice(0, 21) + '…' : q.name, r.x + 46, r.y + 34);
    }
    POUCH_TILES.forEach((t, i) => {
      const r = this.tile(i), n = this.count(t), D = t.kind === 'pot' ? POTIONS[t.key] : OILS[t.key], on = t.kind === 'oil' && S.oilOn && S.oilOn.type === t.key;
      c.globalAlpha = n || A >= 0 ? 1 : .4;
      c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(r.x, r.y, r.w, r.h); c.strokeStyle = on ? D.col : 'rgba(196,164,96,.55)'; c.lineWidth = on ? 2.5 : 1.2; c.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
      if (t.kind === 'pot') bottle(c, r.x + 34, r.y + 48, D.col, 2.2); else oilDrop(c, r.x + 34, r.y + 44, D.col, 2.2);
      c.textAlign = 'left'; c.font = font(14, 'bold'); c.fillStyle = '#f3e2b0';
      wrapText(c, D.name, 118).forEach((l, k) => c.fillText(l, r.x + 66, r.y + 26 + k * 17));
      c.font = font(12); c.fillStyle = '#b9b29e'; c.fillText(on ? 'On your blade' : t.note, r.x + 66, r.y + 68);
      c.textAlign = 'right'; c.font = font(20, 'bold'); c.fillStyle = n ? '#fff' : '#888'; c.fillText('×' + n, r.x + r.w - 12, r.y + r.h - 10);
      c.globalAlpha = 1;
    });
    c.textAlign = 'center';
    if (A >= 0) {      // one more thing a quick button can hold
      const r = this.autoBox(); c.fillStyle = 'rgba(226,194,122,.18)'; c.fillRect(r.x, r.y, r.w, r.h); c.strokeStyle = 'rgba(226,194,122,.9)'; c.lineWidth = 1.5; c.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
      c.font = font(14, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText('Best oil for the nearest creature', 480, r.y + 25);
    } else { c.font = font(13, 'italic'); c.fillStyle = 'rgba(214,203,168,.75)'; c.fillText('Tap something to use it  ·  tap anywhere else to close', 480, 446); }
    c.restore();
  },
};

// phones and tablets start in touch mode, so even the first screen speaks in taps instead of keys
try { if (window.matchMedia && matchMedia('(pointer: coarse)').matches) { Touch.on = true; G.mouseAttack = false; } } catch (e) { }
// tk('Press E', 'Tap Use'): the keyboard wording, or the touch wording on a touch screen
const tk = (keys, touch) => Touch.on ? touch : keys;

function touchXY(t) { const r = canvas.getBoundingClientRect(); return [(t.clientX - r.left) / r.width * W, (t.clientY - r.top) / r.height * H]; }
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); Touch.on = true; G.mouseAttack = false; Sound.unlock();
  for (const t of e.changedTouches) { const [x, y] = touchXY(t); Touch.start(t.identifier, x, y); }
}, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const [x, y] = touchXY(t); Touch.move(t.identifier, x, y); } }, { passive: false });
for (const ev of ['touchend', 'touchcancel']) canvas.addEventListener(ev, e => { e.preventDefault(); for (const t of e.changedTouches) Touch.end(t.identifier); }, { passive: false });
// a mouse click on the fullscreen icon (title screen)
canvas.addEventListener('click', () => { const f = Touch.fsButton(); if (f && Math.hypot(Mouse.x - f.x, Mouse.y - f.y) < f.r + 6) toggleFullscreen(); });
