'use strict';
/* ============================================================
   game.js — game state, story scripting tools, dialogue,
   shop, HUD, level loading and saving
   ============================================================ */

const G = {
  state: 'title', t: 0, S: null, flags: {}, level: null, levelId: null, entry: 'start', theme: null,
  ents: [], fx: [], props: [], triggers: [], interacts: [], player: null,
  cam: { x: 0 }, bounds: { l: 0, r: 1000 }, arena: null,
  cutN: 0, dialog: null, shop: null, transition: null, epoch: 0, waiters: [],
  boss: null, hint: null, toastMsg: null, banner: null, near: null,
  shake: 0, hitstop: 0, hurtFlash: 0, flashWhite: 0, warp: 0, fade: 0, darkMul: 1, nightAmt: 0,
  focus: null, cine: 0, cineT: 0, zoomMul: 1, zoomT: 1, ambT: 0, ambRate: 1, ambFreeze: false,
  mouseAttack: true, deathT: 0, over: null, menuSel: 0, nameText: '', nameErr: '', ending: null,
  get cutscene() { return this.cutN + (this.dialog ? 1 : 0) + (this.shop ? 1 : 0) + (this.pouch ? 1 : 0); },      // the touch pouch pauses the fight while open
  toast(msg) { this.toastMsg = { text: msg, t: 2.2 }; },
  onPlayerDeath() {
    this.deathT = 0;
    const sv = Save.read(); if (sv) { sv.S.deaths = (sv.S.deaths || 0) + 1; Save.write(sv); }
  },
};

// Difficulty changes how tough creatures are. It can be changed at any time from the pause menu.
const DIFFS = {
  story:     { name: 'Story',     hp: .7,   atk: .6,  desc: 'Creatures have less health and hit much softer. For enjoying the tale.' },
  hunter:    { name: 'Hunter',    hp: 1,    atk: 1,   desc: 'The game as it was designed.' },
  nightmare: { name: 'Nightmare', hp: 1.35, atk: 1.3, desc: 'Tougher creatures that hit harder. For hunters who parry.' },
};
const DIFF_KEYS = ['story', 'hunter', 'nightmare'];
function newStats(name) {
  // the original numbers from the text adventure: 100 health, 50 attack, 50 defense, 50 stamina, 10 coins
  return { name, hp: 100, maxHp: 100, atk: 50, def: 50, sta: 50, maxSta: 50, coins: 10, pot: { vit: 1, tem: 1, foc: 1 }, oil: { beast: 0, dead: 1, void: 0 }, oilOn: null, met: {}, diff: 'hunter', quick: ['pot:vit', 'oil:auto'], trophies: [], pass: false, crystal: false, kills: 0, deaths: 0, time: 0, objective: '' };
}

/* ---------- story scripting tools ---------- */
const CANCEL = { cancelled: true };
function waitFor(cond) {
  const pr = new Promise((res, rej) => G.waiters.push({ cond, res, rej }));
  pr.catch(() => { });   // a fire-and-forget tween that gets cancelled is not an error
  return pr;
}
function wait(sec) { let t = 0; return waitFor(dt => (t += dt) >= sec); }
function until(fn) { return waitFor(() => fn()); }
function updateWaiters(dt) {
  for (const w of G.waiters.slice()) if (w.cond(dt)) { const i = G.waiters.indexOf(w); if (i >= 0) G.waiters.splice(i, 1); w.res(); }
}
function cancelAll() {
  const ws = G.waiters; G.waiters = []; ws.forEach(w => w.rej(CANCEL));
  if (G.dialog) { const d = G.dialog; G.dialog = null; d.rej(CANCEL); }
  if (G.shop) { const s = G.shop; G.shop = null; s.rej(CANCEL); }
}
function run(fn) { Promise.resolve().then(fn).catch(e => { if (e !== CANCEL) console.error(e); }); }
async function cut(fn) {
  const ep = G.epoch; G.cutN++;
  try { return await fn(); } finally { if (G.epoch === ep) G.cutN = Math.max(0, G.cutN - 1); }
}
const fmt = s => String(s).replace(/\{name\}/g, G.S ? G.S.name : 'Hunter');

function say(who, text) { return new Promise((res, rej) => { G.dialog = { type: 'say', who, text: fmt(text), shown: 0, res, rej }; }); }
const narr = text => say(null, text);
async function narrs(...lines) { for (const l of lines) await narr(l); }
function choose(prompt, options, who = null) { return new Promise((res, rej) => { G.dialog = { type: 'choice', who, text: fmt(prompt), options: options.map(fmt), sel: 0, shown: 0, res, rej }; }); }
async function fadeTo(a, dur = .45) { const from = G.fade; let t = 0; await waitFor(dt => { t += dt; G.fade = lerp(from, a, Math.min(1, t / dur)); return t >= dur; }); }
function objective(text) { if (G.S.objective !== text) { G.S.objective = text; G.objFlash = 3; } }
function hint(text, t = 7) { G.hint = { text, t, max: t }; }
function addCoins(n) { G.S.coins += n; sfx('coin'); floatText(G.player.x, GROUND - 100, (n > 0 ? '+' : '') + n + ' coins', '#ffd76a', 15); }
function giveOil(key, n = 1) { G.S.oil[key] += n; sfx('oil'); G.toast('Received: ' + OILS[key].name + (n > 1 ? ' ×' + n : '')); }
function givePotion(key, n = 1) { G.S.pot[key] += n; sfx('potion'); G.toast('Received: ' + POTIONS[key].name + (n > 1 ? ' ×' + n : '')); }
function trophy(name) {
  // each cursed creature slain makes the hunter stronger (as in the original: health, attack, defense, stamina all rise)
  const S = G.S; S.trophies.push(name); S.maxHp += 10; S.hp = S.maxHp; S.atk += 4; S.def += 4; S.maxSta += 4; S.sta = S.maxSta;
  sfx('victory'); G.toast('Health, attack, defense and stamina increased.');
}

const POTIONS = {
  vit: { name: 'Elixir of Avian Vitality', desc: 'Heals 40 health', price: 20, col: '#d8473f' },
  tem: { name: 'Tempest Tonic', desc: 'Attack +10 for 45 seconds', price: 25, col: '#e0b23a' },
  foc: { name: 'Focus-fire Draught', desc: 'Refills stamina, faster recovery for 30s', price: 20, col: '#5fbf6a' },
};
// What the blacksmith can do. Each upgrade has three tiers, each dearer than the last.
const UPGRADES = {
  atk: { name: 'Sharpen the blade', cost: [30, 55, 85], desc: S => 'Attack ' + S.atk + ' → ' + (S.atk + 5), apply(S) { S.atk += 5; },
         icon(c, x, y) { c.lineCap = 'round'; line(c, x - 8, y + 8, x + 8, y - 8, 3, '#dfe9ee'); line(c, x - 9, y + 2, x - 2, y + 9, 3, '#8a6a3a'); } },
  def: { name: 'Reinforce the armour', cost: [30, 55, 85], desc: S => 'Defense ' + S.def + ' → ' + (S.def + 6), apply(S) { S.def += 6; },
         icon(c, x, y) { poly(c, [x - 9, y - 9, x + 9, y - 9, x + 9, y + 1, x, y + 11, x - 9, y + 1], '#8f97a6'); poly(c, [x, y - 9, x + 9, y - 9, x + 9, y + 1, x, y + 11], '#6c7484'); } },
  hp:  { name: 'Padded gambeson', cost: [25, 45, 70], desc: S => 'Maximum health ' + S.maxHp + ' → ' + (S.maxHp + 15), apply(S) { S.maxHp += 15; S.hp += 15; },
         icon(c, x, y) { disc(c, x - 4.5, y - 3, 5.5, '#c8423a'); disc(c, x + 4.5, y - 3, 5.5, '#c8423a'); poly(c, [x - 9.6, y - .5, x + 9.6, y - .5, x, y + 10], '#c8423a'); } },
  sta: { name: 'Lighter harness', cost: [25, 45, 70], desc: S => 'Maximum stamina ' + S.maxSta + ' → ' + (S.maxSta + 8), apply(S) { S.maxSta += 8; S.sta += 8; },
         icon(c, x, y) { poly(c, [x + 3, y - 11, x - 7, y + 2, x - 1, y + 2, x - 3, y + 11, x + 7, y - 2, x + 1, y - 2], '#7fd98a'); } },
};
// Blade oils. Each lasts OIL_TIME seconds and adds 35% sword damage against one kind of creature.
const OIL_TIME = 90, OIL_KEYS = ['dead', 'beast', 'void'];     // keys 4, 5, 6 in this order
const OILS = {
  beast: { name: 'Wolfsbane Oil', desc: '+35% sword damage against beasts', price: 18, col: '#7fcf62', blade: '#bdf0a0', rgb: '130,225,100' },
  dead:  { name: 'Gravesalt Oil', desc: '+35% sword damage against the dead', price: 18, col: '#eadf9a', blade: '#fff3c4', rgb: '255,238,170' },
  void:  { name: 'Starglass Oil', desc: '+35% sword damage against void things', price: 18, col: '#86aaff', blade: '#b4ccff', rgb: '140,175,255' },
};
function oilDrop(c, x, y, col, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col; c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(9, 2, 0, 9); c.quadraticCurveTo(-9, 2, 0, -11); c.fill();
  disc(c, -2.5, 2, 1.8, 'rgba(255,255,255,.6)'); c.restore();
}
function potionItems(discount = 1) {
  const pots = ['vit', 'tem', 'foc'].map(k => {
    const P = POTIONS[k], price = Math.round(P.price * discount);
    return { name: () => P.name, desc: () => P.desc + '   ·   you carry ' + G.S.pot[k], price: () => price, icon: (c, x, y) => bottle(c, x, y, P.col, 1.2), buy() { G.S.pot[k]++; return 'Bought: ' + P.name; } };
  });
  const oils = OIL_KEYS.map(k => {
    const O = OILS[k], price = Math.round(O.price * discount);
    return { name: () => O.name, desc: () => O.desc + ', ' + OIL_TIME + 's   ·   carry ' + G.S.oil[k], price: () => price, icon: (c, x, y) => oilDrop(c, x, y, O.col, 1.2), buy() { G.S.oil[k]++; return 'Bought: ' + O.name; } };
  });
  return pots.concat(oils);
}
function upgradeItems() {
  const S = G.S; S.up = S.up || {};
  return Object.keys(UPGRADES).map(k => {
    const U = UPGRADES[k], tier = () => S.up[k] || 0;
    return {
      name: () => U.name, pips: tier, desc: () => tier() >= 3 ? 'Nothing more can be done here.' : U.desc(S),
      price: () => tier() >= 3 ? null : U.cost[tier()], icon: (c, x, y) => U.icon(c, x, y),
      buy() { U.apply(S); S.up[k] = tier() + 1; sfx('thud'); sfx('victory'); return 'Done: ' + U.name.toLowerCase() + '.'; },
    };
  });
}
// items: a list from potionItems() / upgradeItems(); a plain number means "potions at this price multiplier"
function openShop(title, items) {
  if (!Array.isArray(items)) items = potionItems(items || 1);
  return new Promise((res, rej) => { G.shop = { title, sel: 0, res, rej, items }; });
}

/* ---------- New Hunt+: a finished game leaves a record that a harder hunt can start from ---------- */
const PLUS_KEY = 'cursedCreatures.plus';
function readPlus() { try { const v = JSON.parse(localStorage.getItem(PLUS_KEY)); return v && v.plus ? v : null; } catch (e) { return null; } }
function writePlus(v) { try { localStorage.setItem(PLUS_KEY, JSON.stringify(v)); } catch (e) { } }

/* ---------- what has been found, across every hunt played in this browser ---------- */
const FOUND_KEY = 'cursedCreatures.found';
function readFound() { try { const v = JSON.parse(localStorage.getItem(FOUND_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function addFound(ids) { try { const s = new Set(readFound()); ids.forEach(i => s.add(i)); localStorage.setItem(FOUND_KEY, JSON.stringify([...s])); } catch (e) { } }

/* ---------- saving ---------- */
function saveGame(x) {
  if (!G.S || G.player.dead) return;
  Save.write({ S: G.S, flags: G.flags, level: G.levelId, entry: G.entry, x: x === undefined ? null : x });
  G.toast('Game saved.'); sfx('save');
}
function loadSave() {
  const sv = Save.read(); if (!sv) return false;
  G.S = sv.S; G.flags = sv.flags || {};
  if (!DIFFS[G.S.diff]) G.S.diff = 'hunter';
  if (!Array.isArray(G.S.quick)) G.S.quick = ['pot:vit', 'oil:auto'];      // what the two touch quick buttons hold
  G.S.oil = G.S.oil || { beast: 0, dead: 0, void: 0 }; G.S.met = G.S.met || {}; if (G.S.oilOn === undefined) G.S.oilOn = null;     // saves from before oils existed
  G.S.sta = G.S.maxSta; G.S.hp = Math.max(G.S.hp, Math.round(G.S.maxHp * .6));   // never reload into a hopeless fight
  G.state = 'play'; G.fade = 1; G.over = null;
  loadLevel(sv.level, sv.entry);
  if (sv.x !== null && sv.x !== undefined) { G.player.x = sv.x; snapCamera(); }
  G.transition = { phase: 'in', t: 0 };
  // saves made before blocking and heavy attacks existed get told about them once
  if (!G.flags.h_block && !G.flags.h_heavy && G.flags.h_roll) { G.flags.h_block = 1; G.flags.h_heavy = 1; hint('New moves. Hold S or ↓ to block; block at the last moment to parry. Hold the attack key to charge a heavy blow. Attack in the air for a plunging strike.', 14); }
  if (!G.flags.h_v3) { G.flags.h_v3 = 1; hint('New: hold Shift to sprint (it uses stamina; dodge is now K or X). Blade oils on 4, 5 and 6 add damage against the dead, beasts and void things. Shops sell them.', 14); }
  return true;
}

/* ---------- levels ---------- */
const LEVELS = {};
const ZOOM = 1.2;                       // the world is drawn slightly enlarged
const zoomNow = () => ZOOM * G.zoomMul;  // boss reveals zoom in a little further
const zmNow = () => (W - W / zoomNow()) / 2;   // how much of each side the zoom hides
const toScreenX = wx => (wx - G.cam.x - W / 2) * zoomNow() + W / 2;
const toScreenY = y => (y - H) * zoomNow() + H;
function loadLevel(id, entry = 'start') {
  G.epoch++; cancelAll(); G.cutN = 0;
  const def = LEVELS[id];
  G.levelId = id; G.level = def; G.entry = entry; G.theme = getTheme(def.theme);
  G.ents = []; G.fx = []; G.props = []; G.triggers = []; G.interacts = [];
  G.boss = null; G.hint = null; G.warp = 0; G.arena = null; G.darkMul = 1; G.nightAmt = 0; G.near = null; G.hitstop = 0;
  G.owlEye = false; G.lightMul = 1; G.deathT = 0;
  G.pouch = false;
  G.focus = null; G.cine = 0; G.cineT = 0; G.zoomMul = 1; G.zoomT = 1; G.ambFreeze = false; G.ambRate = 1;
  G.bounds = { l: 14, r: def.width - 14 };
  const sx = (def.entries && def.entries[entry] !== undefined) ? def.entries[entry] : (def.entries ? def.entries.start : 80);
  G.player = makePlayer(sx);
  if (entry === 'east') G.player.dir = -1;
  def.build(LevelAPI, entry);
  snapCamera();
  Music.set(G.theme.mood);
  G.banner = { text: def.name, sub: def.sub || '', t: 0 };
}
function gotoLevel(id, entry = 'start') { if (!G.transition) G.transition = { phase: 'out', t: 0, to: id, entry }; }
function snapCamera() { G.cam.x = camTarget(); }
function camTarget() {
  const p = G.player, w = G.level.width;
  const zm = zmNow();
  let lo = -zm, hi = Math.max(lo, w - W + zm);
  if (G.focus !== null) return clamp((typeof G.focus === 'object' ? G.focus.x : G.focus) - W / 2, lo, hi);   // cutscene camera
  if (G.arena) { lo = Math.max(lo, G.arena.l - 40 - zm); hi = Math.max(lo, Math.min(hi, G.arena.r + 40 - W + zm)); }
  return clamp(p.x - W * .44 + p.dir * 50, lo, hi);
}
function setArena(l, r) { G.arena = { l, r }; G.bounds = { l, r }; }
function clearArena() { G.arena = null; G.bounds = { l: 14, r: G.level.width - 14 }; if (G.level.wall) G.level.wall(); }
function startBoss(e) { G.boss = e; e.passive = false; Music.set('boss'); sfx('boss'); }
function endBoss() { G.boss = null; Music.set(G.theme.mood); }

const LevelAPI = {
  prop(kind, x, o = {}) { const p = Object.assign({ kind, x }, o); G.props.push(p); return p; },
  mob(type, x, o) { const e = makeMob(type, x, o); G.ents.push(e); return e; },
  npc(look, x, o) { const e = makeNPC(look, x, o); G.ents.push(e); return e; },
  // runs the script when the hunter walks into the zone
  zone(x0, x1, fn, o = {}) { const t = Object.assign({ x0, x1, fn, once: true, fired: false }, o); G.triggers.push(t); return t; },
  // a spot the hunter can use with [E]
  use(x, label, fn, o = {}) { const it = Object.assign({ x, label, fn, r: 46 }, o); G.interacts.push(it); return it; },
  hint(x, text, flag, touch) { this.zone(x, x + 120, () => hint(Touch.on && touch ? touch : text), { flag, noCut: true }); },      // the 4th text is used on touch screens
  campfire(x) {
    const p = this.prop('campfire', x, { lit: !!G.flags['fire_' + G.levelId + x], light: 150 });
    this.use(x, 'Rest by the fire', async () => {
      p.lit = true; G.flags['fire_' + G.levelId + x] = 1; sfx('fire');
      const S = G.S; S.hp = S.maxHp; S.sta = S.maxSta;
      burst(G.player.x, GROUND - 40, 14, '#ffb04a', { g: -160, glow: '255,170,80' });
      saveGame(G.player.x);
      await narr('You rest by the fire. Your wounds close and your breathing steadies.');
    });
    return p;
  },
  exit(x0, x1, to, entry) { this.zone(x0, x1, () => gotoLevel(to, entry), { once: false, noCut: true }); },
};

/* ---------- dialogue ---------- */
function dialogLayout(c) {
  const d = G.dialog, x = 80, w = 800;
  if (G.cineT > 0 && d.type === 'say') { c.font = font(17, d.who ? '' : 'italic'); return { cine: true, lines: wrapText(c, d.text, 740) }; }
  c.font = font(18, d.who ? '' : 'italic');
  const lines = wrapText(c, d.text, w - 56);
  const optH = d.type === 'choice' ? d.options.length * 30 + 10 : 0;
  const h = 24 + lines.length * 24 + optH + (d.who ? 10 : 0) + 8;
  // choices sit at the top and speech hugs the bottom edge, so the people talking stay in view
  const y = d.type === 'choice' ? 104 : H - h - 10;
  return { x, w, h, y, lines, optY: y + h - optH - 6 };
}
function updateDialog(dt) {
  const d = G.dialog; if (!d) return;
  const before = Math.floor(d.shown);
  d.shown = Math.min(d.text.length, d.shown + dt * 62);
  if (Math.floor(d.shown) > before && Math.floor(d.shown) % 3 === 0 && d.shown < d.text.length) sfx('text');
  const done = d.shown >= d.text.length;
  const finish = v => { G.dialog = null; sfx('confirm'); Keys.pressed = {}; Mouse.clicked = false; d.res(v); };
  if (d.type === 'say') {
    if (tapped('confirm') || Mouse.clicked) { if (!done) d.shown = d.text.length; else finish(); }
  } else {
    if (!done) { if (tapped('confirm') || Mouse.clicked) d.shown = d.text.length; return; }
    const n = d.options.length, L = dialogLayout(ctx);
    if (tapped('up')) { d.sel = (d.sel + n - 1) % n; sfx('select'); }
    if (tapped('down')) { d.sel = (d.sel + 1) % n; sfx('select'); }
    for (let i = 0; i < n; i++) {
      if (tapped('p' + (i + 1))) { d.sel = i; return finish(i); }
      const oy = L.optY + i * 30;
      if (Mouse.x > L.x + 20 && Mouse.x < L.x + L.w - 20 && Mouse.y > oy && Mouse.y < oy + 30) {
        if (d.sel !== i && (Mouse.x !== d.mx || Mouse.y !== d.my)) d.sel = i;
        if (Mouse.clicked) return finish(i);
      }
    }
    d.mx = Mouse.x; d.my = Mouse.y;
    if (Keys.pressed['Enter'] || Keys.pressed['Space'] || Keys.pressed['KeyE']) finish(d.sel);
  }
}
function drawDialog(c) {
  const d = G.dialog; if (!d) return;
  const L = dialogLayout(c);
  if (L.cine) {   // during a boss reveal the words sit in the lower black bar, so nothing covers the creature
    let ty = H - CINE_BOTTOM + (d.who ? 50 : 38), left = Math.floor(d.shown);
    c.textAlign = 'left';
    if (d.who) { c.font = font(12, 'bold'); c.fillStyle = '#e2c27a'; c.fillText(d.who.toUpperCase(), 110, H - CINE_BOTTOM + 26); }
    c.font = font(17, d.who ? '' : 'italic'); c.fillStyle = d.who ? '#ece6d6' : '#d6cfba';
    for (const ln of L.lines) { if (left <= 0) break; c.fillText(ln.slice(0, left), 110, ty); left -= ln.length + 1; ty += 24; }
    if (d.shown >= d.text.length) { c.fillStyle = `rgba(226,194,122,${.5 + .5 * Math.sin(G.rt * 6)})`; const ax = W - 104, ay = H - 20 + Math.sin(G.rt * 6) * 2; c.beginPath(); c.moveTo(ax - 6, ay - 4); c.lineTo(ax + 6, ay - 4); c.lineTo(ax, ay + 5); c.fill(); }
    return;
  }
  panel(c, L.x, L.y, L.w, L.h, .9);
  let ty = L.y + 28;
  if (d.who) {
    c.font = font(13, 'bold'); c.textAlign = 'left';
    const nw = c.measureText(d.who.toUpperCase()).width + 28;
    panel(c, L.x + 22, L.y - 15, nw, 28, .96);
    c.fillStyle = '#e2c27a'; c.fillText(d.who.toUpperCase(), L.x + 36, L.y + 4);
    ty += 10;
  }
  c.font = font(18, d.who ? '' : 'italic'); c.textAlign = 'left'; c.fillStyle = d.who ? '#ece6d6' : '#cfc8b4';
  let left = Math.floor(d.shown);
  for (const ln of L.lines) { if (left <= 0) break; c.fillText(ln.slice(0, left), L.x + 28, ty); left -= ln.length + 1; ty += 24; }
  const done = d.shown >= d.text.length;
  if (d.type === 'choice' && done) {
    for (let i = 0; i < d.options.length; i++) {
      const oy = L.optY + i * 30, sel = i === d.sel;
      if (sel) { c.fillStyle = 'rgba(196,164,96,.16)'; c.fillRect(L.x + 20, oy + 2, L.w - 40, 26); c.fillStyle = '#e2c27a'; c.fillRect(L.x + 20, oy + 2, 3, 26); }
      c.font = font(17, sel ? 'bold' : ''); c.fillStyle = sel ? '#f3e2b0' : '#b9b29e';
      c.fillText((i + 1) + '.  ' + d.options[i], L.x + 36, oy + 21);
    }
  } else if (d.type === 'say' && done) {
    c.fillStyle = `rgba(226,194,122,${.5 + .5 * Math.sin(G.rt * 6)})`; c.beginPath(); const ax = L.x + L.w - 30, ay = L.y + L.h - 15 + Math.sin(G.rt * 6) * 2;
    c.moveTo(ax - 6, ay - 4); c.lineTo(ax + 6, ay - 4); c.lineTo(ax, ay + 5); c.fill();
  }
}

/* ---------- shop ---------- */
function shopLayout(s) {
  const n = s.items.length, rh = n > 4 ? 50 : 58, h = 150 + n * rh, y = Math.round((H - h) / 2);     // long lists use tighter rows
  return { n, h, y, rh, k: rh / 58, row: i => y + 76 + i * rh };
}
function updateShop() {
  const s = G.shop; if (!s) return;
  const L = shopLayout(s), n = L.n + 1;
  if (tapped('up')) { s.sel = (s.sel + n - 1) % n; sfx('select'); }
  if (tapped('down')) { s.sel = (s.sel + 1) % n; sfx('select'); }
  let act = Keys.pressed['Enter'] || Keys.pressed['Space'] || Keys.pressed['KeyE'];
  for (let i = 0; i < n; i++) {
    const y = L.row(i);
    if (Mouse.x > 240 && Mouse.x < 720 && Mouse.y > y && Mouse.y < y + L.rh - 6) { if (Mouse.x !== s.mx || Mouse.y !== s.my) s.sel = i; if (Mouse.clicked) { s.sel = i; act = true; } }
    if (tapped('p' + (i + 1))) { s.sel = i; act = true; }
  }
  s.mx = Mouse.x; s.my = Mouse.y;
  if (tapped('pause')) { G.shop = null; s.res(); Keys.pressed = {}; return; }
  if (act) {
    if (s.sel === n - 1) { G.shop = null; sfx('confirm'); Keys.pressed = {}; Mouse.clicked = false; s.res(); return; }
    const it = s.items[s.sel], price = it.price();
    if (price === null) { s.msg = 'That is already as good as it can be made.'; sfx('select'); }
    else if (G.S.coins >= price) { G.S.coins -= price; sfx('coin'); s.msg = it.buy(); }
    else { s.msg = 'You do not have enough coins.'; sfx('select'); }
  }
}
function drawShop(c) {
  const s = G.shop; if (!s) return;
  const L = shopLayout(s);
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H);
  panel(c, 220, L.y, 520, L.h, .95);
  c.textAlign = 'center'; c.font = font(22, 'bold'); c.fillStyle = '#e2c27a'; c.fillText(s.title, 480, L.y + 38);
  c.font = font(14); c.fillStyle = '#ffd76a'; c.fillText('Your coins: ' + G.S.coins, 480, L.y + 62);
  s.items.forEach((it, i) => {
    const y = L.row(i), sel = i === s.sel, price = it.price();
    c.fillStyle = sel ? 'rgba(196,164,96,.18)' : 'rgba(255,255,255,.04)'; c.fillRect(240, y, 480, L.rh - 6);
    if (sel) { c.fillStyle = '#e2c27a'; c.fillRect(240, y, 3, L.rh - 6); }
    c.save(); it.icon(c, 270, y + (L.rh - 6) / 2 + 1); c.restore();
    c.textAlign = 'left'; c.font = font(16, 'bold'); c.fillStyle = sel ? '#f3e2b0' : '#cfc8b4'; c.fillText(it.name(), 296, y + Math.round(23 * L.k));
    if (it.pips) {   // three diamonds show how far this upgrade has gone
      const px = 296 + c.measureText(it.name()).width + 16, t = it.pips();
      for (let k = 0; k < 3; k++) { const x = px + k * 15; const py = y + Math.round(17 * L.k); poly(c, [x, py - 6, x + 5, py, x, py + 6, x - 5, py], k < t ? '#e2c27a' : 'rgba(226,194,122,.22)'); }
    }
    c.font = font(13); c.fillStyle = '#9c957f'; c.fillText(it.desc(), 296, y + Math.round(42 * L.k));
    c.textAlign = 'right'; c.font = font(16, 'bold');
    if (price === null) { c.fillStyle = '#8fbf8a'; c.fillText('Finished', 706, y + (L.rh - 6) / 2 + 6); }
    else { c.fillStyle = G.S.coins >= price ? '#ffd76a' : '#8a5a4a'; c.fillText(price + ' coins', 706, y + (L.rh - 6) / 2 + 6); }
  });
  const y = L.row(L.n), sel = s.sel === L.n;
  c.fillStyle = sel ? 'rgba(196,164,96,.18)' : 'rgba(255,255,255,.04)'; c.fillRect(240, y, 480, 40);
  c.textAlign = 'center'; c.font = font(16, sel ? 'bold' : ''); c.fillStyle = sel ? '#f3e2b0' : '#cfc8b4'; c.fillText('Leave', 480, y + 26);
  if (s.msg) { c.font = font(13, 'italic'); c.fillStyle = '#cfc8b4'; c.fillText(s.msg, 480, L.y + L.h - 12); }
}
function bottle(c, x, y, col, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  R(c, -2.5, -13, 5, 6, '#c8c0a8'); R(c, -3.5, -15, 7, 3, '#7a5a3a');
  c.fillStyle = 'rgba(220,230,235,.25)'; c.beginPath(); c.arc(0, 0, 8.5, 0, TAU); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(0, 0, 7.5, -.2, Math.PI + .2); c.fill();
  disc(c, -3, -2, 1.6, 'rgba(255,255,255,.55)'); c.restore();
}

/* ---------- HUD ---------- */
function bar(c, x, y, w, h, frac, col, back = 'rgba(0,0,0,.55)') {
  c.fillStyle = back; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, y, w, h);
  c.fillStyle = col; c.fillRect(x, y, w * clamp(frac, 0, 1), h);
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, w * clamp(frac, 0, 1), h * .35);
  c.strokeStyle = 'rgba(196,164,96,.6)'; c.lineWidth = 1; c.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
}
function keycap(c, x, y, label) {
  c.font = font(11, 'bold'); const w = Math.max(18, c.measureText(label).width + 10);
  c.fillStyle = 'rgba(20,20,24,.9)'; c.fillRect(x - w / 2, y - 9, w, 17); c.strokeStyle = 'rgba(226,194,122,.8)'; c.lineWidth = 1; c.strokeRect(x - w / 2 + .5, y - 8.5, w - 1, 16);
  c.fillStyle = '#f3e2b0'; c.textAlign = 'center'; c.fillText(label, x, y + 4);
  return w;
}
function drawHUD(c) {
  const S = G.S, p = G.player;
  // name, health, stamina
  c.textAlign = 'left'; c.font = font(13, 'bold'); c.fillStyle = 'rgba(0,0,0,.6)'; const tag = S.name.toUpperCase() + (S.plus ? '   +' + (S.plus > 1 ? S.plus : '') : ''); c.fillText(tag, 25, 27); c.fillStyle = '#e2c27a'; c.fillText(tag, 24, 26);
  const hw = Math.min(214, 150 + (S.maxHp - 100) * .9), sw = Math.min(190, 110 + (S.maxSta - 50) * 2);
  bar(c, 24, 36, hw, 12, S.hp / S.maxHp, '#b8322c');
  bar(c, 24, 58, sw, 7, S.sta / S.maxSta, p.focus > 0 ? '#8ff09a' : '#5fae5a');
  c.font = font(11, 'bold'); c.fillStyle = '#fff'; c.fillText(Math.ceil(S.hp) + ' / ' + S.maxHp, 30, 46.5);
  // buffs
  let bx = 24;
  const buff = (label, col) => { c.font = font(11, 'bold'); const w = c.measureText(label).width + 12; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(bx, 74, w, 17); c.fillStyle = col; c.fillText(label, bx + 6, 86.5); bx += w + 6; };
  if (p.ward > 0) buff('WARD', '#aee0ff');
  if (p.tonic > 0) buff('TONIC ' + Math.ceil(p.tonic) + 's', '#ffd27a');
  if (p.focus > 0) buff('FOCUS ' + Math.ceil(p.focus) + 's', '#9be8a0');
  if (S.crystal) buff('CRYSTAL', '#bfe0ff');
  if (S.oilOn) buff(OILS[S.oilOn.type].name.toUpperCase() + ' ' + Math.ceil(S.oilOn.t) + 's', OILS[S.oilOn.type].col);
  // coins + objective
  c.textAlign = 'right'; c.font = font(15, 'bold'); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(S.coins + ' coins', W - 23, 31); c.fillStyle = '#ffd76a'; c.fillText(S.coins + ' coins', W - 24, 30);
  disc(c, W - 36 - c.measureText(S.coins + ' coins').width, 25, 6, '#e8b93a'); disc(c, W - 36 - c.measureText(S.coins + ' coins').width, 25, 3.5, '#b8862a');
  if (!G.boss) {
    let oy = 50;
    const put = (text, col) => { for (const ln of wrapText(c, text, 262)) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(ln, W - 23, oy + 1); c.fillStyle = col; c.fillText(ln, W - 24, oy); oy += 15; } oy += 5; };
    c.font = font(12, 'italic');
    G.objFlash = Math.max(0, (G.objFlash || 0) - 1 / 60);
    if (S.objective) put(S.objective, G.objFlash > 0 ? '#f3e2b0' : 'rgba(225,215,190,.82)');
    // side contracts taken from notice boards
    for (const id in CONTRACTS) {
      const C = CONTRACTS[id], st = G.flags[id];
      if (st === 1) put('Side contract: ' + C.title + ', ' + C.where + '.', 'rgba(226,194,122,.85)');
      else if (st === 2) put('Contract fulfilled: collect ' + C.reward + ' coins from ' + C.claim + '.', '#9fe0a0');
    }
  }
  // potions and glyphs
  const keys = ['vit', 'tem', 'foc'], showBottom = !G.dialog && !G.shop && !Touch.on;      // on a touch screen the touch buttons replace these slots
  for (let i = 0; i < 3 && showBottom; i++) {
    const x = 42 + i * 46, y = H - 36, n = S.pot[keys[i]];
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 19, y - 22, 38, 44); c.strokeStyle = 'rgba(196,164,96,.5)'; c.lineWidth = 1; c.strokeRect(x - 18.5, y - 21.5, 37, 43);
    c.globalAlpha = n ? 1 : .3; bottle(c, x, y + 2, POTIONS[keys[i]].col, 1.1); c.globalAlpha = 1;
    c.font = font(11, 'bold'); c.textAlign = 'right'; c.fillStyle = n ? '#fff' : '#777'; c.fillText('×' + n, x + 16, y + 18);
    c.textAlign = 'left'; c.fillStyle = '#e2c27a'; c.fillText(String(i + 1), x - 15, y - 10);
  }
  const gl = [['L', 'Ember', COST.ember, '#ff9a4a'], ['I', 'Ward', COST.ward, '#8fd0ff']];
  for (let i = 0; i < 2 && showBottom; i++) {
    const x = 196 + i * 62, y = H - 36, ok = S.sta >= gl[i][2] && !(i === 1 && p.ward > 0);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 27, y - 22, 54, 44); c.strokeStyle = 'rgba(196,164,96,.5)'; c.strokeRect(x - 26.5, y - 21.5, 53, 43);
    c.globalAlpha = ok ? 1 : .35;
    if (i === 0) { c.globalCompositeOperation = 'lighter'; glow(c, x, y, 14, '255,140,60', .9); c.globalCompositeOperation = 'source-over'; flame(c, x, y + 8, 4.5, G.t, 1); }
    else { c.strokeStyle = gl[i][3]; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, 4, 0, TAU); c.stroke(); }
    c.globalAlpha = 1; c.font = font(10, 'bold'); c.textAlign = 'left'; c.fillStyle = '#e2c27a'; c.fillText(gl[i][0], x - 23, y - 10);
    c.textAlign = 'center'; c.fillStyle = ok ? '#ddd' : '#777'; c.fillText(gl[i][1], x, y + 19);
  }
  for (let i = 0; i < 3 && showBottom; i++) {     // blade oils on 4, 5, 6
    const key = OIL_KEYS[i], O = OILS[key], x = 386 + i * 46, y = H - 36, n = S.oil[key], on = S.oilOn && S.oilOn.type === key;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 19, y - 22, 38, 44); c.strokeStyle = on ? O.col : 'rgba(196,164,96,.5)'; c.lineWidth = on ? 2 : 1; c.strokeRect(x - 18.5, y - 21.5, 37, 43);
    if (on) { c.fillStyle = O.col; c.globalAlpha = .35; c.fillRect(x - 18, y + 21 - 42 * (S.oilOn.t / OIL_TIME), 36, 42 * (S.oilOn.t / OIL_TIME)); c.globalAlpha = 1; }
    c.globalAlpha = n || on ? 1 : .3; oilDrop(c, x, y + 1, O.col, 1.05); c.globalAlpha = 1;
    c.font = font(11, 'bold'); c.textAlign = 'right'; c.fillStyle = n ? '#fff' : '#777'; c.fillText('×' + n, x + 16, y + 18);
    c.textAlign = 'left'; c.fillStyle = '#e2c27a'; c.fillText(String(i + 4), x - 15, y - 10);
  }
  if (showBottom) {     // the guard
    const x = 320, y = H - 36, on = p.state === 'block';
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 27, y - 22, 54, 44); c.strokeStyle = on ? 'rgba(255,230,160,.9)' : 'rgba(196,164,96,.5)'; c.lineWidth = 1; c.strokeRect(x - 26.5, y - 21.5, 53, 43);
    poly(c, [x - 8, y - 9, x + 8, y - 9, x + 8, y, x, y + 9, x - 8, y], on ? '#ffe08a' : '#aab4c0'); line(c, x, y - 7, x, y + 5, 1.5, 'rgba(0,0,0,.45)');
    c.font = font(10, 'bold'); c.textAlign = 'left'; c.fillStyle = '#e2c27a'; c.fillText('S', x - 23, y - 10);
    c.textAlign = 'center'; c.fillStyle = '#ddd'; c.fillText('Block', x, y + 19);
  }
  // boss bar
  const ty = Touch.on ? 36 : 0;      // on a touch screen the pause button sits top centre, so the boss bar and messages move down
  if (G.boss && !G.boss.dead) {
    const b = G.boss, w = 460, x = (W - w) / 2;
    c.textAlign = 'center'; c.font = font(15, 'bold'); c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(b.name.toUpperCase(), W / 2 + 1, 39 + ty); c.fillStyle = '#e8d9b0'; c.fillText(b.name.toUpperCase(), W / 2, 38 + ty);
    const broken = b.state === 'reel' && b.broken;
    bar(c, x, 46 + ty, w, 9, b.hp / b.maxHp, b.solid > 0 || b.stun > 0 || broken ? '#e58a3a' : '#8f2636');
    if (!b.fixed) {     // stagger meter: fills with hits, heavy blows and parries
      const frac = broken ? 1 - b.st / b.reelT : b.stun > 0 ? 1 : (b.poise || 0) / (b.poiseMax || 120);
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, 60 + ty, w, 4);
      c.fillStyle = broken || b.stun > 0 ? `rgba(255,236,170,${.7 + .3 * Math.sin(G.t * 14)})` : '#c9a24a'; c.fillRect(x, 60 + ty, w * clamp(frac, 0, 1), 4);
      if (broken) { c.font = font(11, 'bold'); c.fillStyle = '#ffe08a'; c.fillText('STAGGERED', W / 2, 78 + ty); }
    }
  }
  // interact prompt
  if (G.near && !G.cutscene && !G.transition) {
    const it = G.near, sx = clamp(toScreenX(it.x), 120, W - 120), y = toScreenY(GROUND - (it.py || 118)) + Math.sin(G.t * 4) * 2;
    c.font = font(13, 'bold'); const tw = c.measureText(it.label).width;
    c.fillStyle = 'rgba(8,9,12,.82)'; c.fillRect(sx - tw / 2 - 26, y - 13, tw + 44, 25);
    keycap(c, sx - tw / 2 - (Touch.on ? 16 : 10), y, Touch.on ? 'Use' : 'E'); c.textAlign = 'left'; c.fillStyle = '#ece6d6'; c.font = font(13, 'bold'); c.fillText(it.label, sx - tw / 2 + 6, y + 4.5);
  }
  // hint
  if (G.hint && !G.cutscene) {
    const a = Math.min(1, G.hint.t * 2, (G.hint.max - G.hint.t) * 3);
    c.globalAlpha = clamp(a, 0, 1); c.font = font(15); const lines = wrapText(c, G.hint.text, 560), hh = lines.length * 21 + 16;
    const widest = Math.max(...lines.map(l => c.measureText(l).width));
    const hy = Touch.on ? 82 : 0;      // on a touch screen, sit below the item buttons at the top left
    panel(c, W / 2 - widest / 2 - 22, 100 + hy, widest + 44, hh, .8);
    c.textAlign = 'center'; c.fillStyle = '#ece6d6'; lines.forEach((ln, i) => c.fillText(ln, W / 2, 124 + hy + i * 21)); c.globalAlpha = 1;
  }
  // toast
  if (G.toastMsg) {
    c.globalAlpha = clamp(G.toastMsg.t * 2, 0, 1); c.font = font(14, 'italic'); c.textAlign = 'center';
    const tw = c.measureText(G.toastMsg.text).width; c.fillStyle = 'rgba(8,9,12,.75)'; const my = 68 + (Touch.on ? (G.boss && !G.boss.dead ? 86 : 0) : 0); c.fillRect(W / 2 - tw / 2 - 14, my, tw + 28, 24);
    c.fillStyle = '#e2c27a'; c.fillText(G.toastMsg.text, W / 2, my + 17); c.globalAlpha = 1;
  }
  // chapter banner
  if (G.banner && G.banner.t < 4.2 && !G.dialog && !G.boss) {
    const t = G.banner.t, a = clamp(Math.min(t * 1.5, (4.2 - t) * 1.2), 0, 1);
    c.globalAlpha = a; c.textAlign = 'center';
    c.font = font(34, 'bold'); const txt = G.banner.text.toUpperCase().split('').join(' ');
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(txt, W / 2 + 2, 172); c.fillStyle = '#efe3c0'; c.fillText(txt, W / 2, 170);
    const lw = 150 * easeOut(clamp(t / 1.2, 0, 1)); c.fillStyle = '#c4a460'; c.fillRect(W / 2 - lw, 184, lw * 2, 1.5);
    if (G.banner.sub) { c.font = font(15, 'italic'); c.fillStyle = '#cfc8b4'; c.fillText(G.banner.sub, W / 2, 208); }
    c.globalAlpha = 1;
  }
}

/* ---------- darkness for interiors ---------- */
let darkCv = null;
function drawDarkness(c) {
  const D = G.theme.dark; if (!D) return;
  if (!darkCv) darkCv = makeCanvas(W / 2, H / 2);
  const d = darkCv.getContext('2d'), a = clamp(D.a * G.darkMul, 0, .98);
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W / 2, H / 2);
  d.fillStyle = `rgba(${D.rgb},${a})`; d.fillRect(0, 0, W / 2, H / 2);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, s = 1) => { const g = d.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, r / 2); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.5, `rgba(0,0,0,${s * .6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x / 2 - r / 2, y / 2 - r / 2, r, r); };
  const p = G.player; hole(p.x - G.cam.x, GROUND - p.h - 40, D.radius * (G.lightMul || 1));
  for (const pr of G.props) if (pr.light) hole(pr.x - G.cam.x + (pr.lx || 0), GROUND - (pr.ly || 60), pr.light, pr.ls || .9);
  for (const e of G.ents) if (e.boss && !e.dead) hole(e.x - G.cam.x, GROUND - 70, 170, .7 * (e.alpha === undefined ? 1 : e.alpha));
  c.drawImage(darkCv, 0, 0, W, H);
  if (D.tint && G.owlEye) { c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(${D.tint},.035)`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
}

/* ---------- one frame of play ---------- */
function updatePlay(dt) {
  const p = G.player, S = G.S;
  G.t += dt; S.time += dt;
  if (G.dialog) updateDialog(dt); else if (G.shop) updateShop();
  if (G.banner) G.banner.t += dt;
  if (G.hint && !G.cutscene) { G.hint.t -= dt; if (G.hint.t <= 0) G.hint = null; }
  if (G.toastMsg) { G.toastMsg.t -= dt; if (G.toastMsg.t <= 0) G.toastMsg = null; }
  G.cine = approach(G.cine, G.cineT, dt * 2.4); G.zoomMul = lerp(G.zoomMul, G.zoomT, 1 - Math.pow(.03, dt)); if (Math.abs(G.zoomMul - G.zoomT) < .004) G.zoomMul = G.zoomT;
  G.ambRate = approach(G.ambRate, G.ambFreeze ? 0 : 1, dt * .9); G.ambT += dt * G.ambRate;
  G.shake = Math.max(0, G.shake - dt * 30); G.hurtFlash = Math.max(0, G.hurtFlash - dt); G.flashWhite = Math.max(0, G.flashWhite - dt);

  // level transition (fade out, swap level, fade in)
  if (G.transition) {
    const T = G.transition; T.t += dt;
    if (T.phase === 'out') { G.fade = Math.min(1, T.t / .45); if (T.t >= .5) { loadLevel(T.to, T.entry); G.transition = { phase: 'in', t: 0 }; saveGame(); } }
    else { G.fade = Math.max(0, 1 - T.t / .5); if (T.t >= .5) { G.transition = null; G.fade = 0; if (G.level.enter) run(() => cut(() => G.level.enter(G.entry))); } }
  }
  if (G.hitstop > 0) { G.hitstop -= dt; return; }

  updateWaiters(dt);
  if (G.level.tick) G.level.tick(dt);
  playerUpdate(p, dt);
  for (const e of G.ents) e.update(dt);
  // keep enemies from stacking on one spot
  const mobs = G.ents.filter(e => e.enemy && !e.dead && !e.floaty && !e.boss && e.h <= 0);
  for (let i = 0; i < mobs.length; i++) for (let j = i + 1; j < mobs.length; j++) {
    const a = mobs[i], b = mobs[j], d = b.x - a.x;
    if (Math.abs(d) < 26) { const push = (26 - Math.abs(d)) * 2.5 * dt * (d >= 0 ? 1 : -1); a.x -= push; b.x += push; }
  }
  G.ents = G.ents.filter(e => !e.remove);
  fxUpdate(dt);

  // zones and things to use
  if (!G.cutscene && !G.transition && !p.dead) {
    for (const z of G.triggers) {
      if (z.fired || p.x < z.x0 || p.x > z.x1) continue;
      if (z.flag && G.flags[z.flag]) { z.fired = true; continue; }
      if (z.cond && !z.cond()) continue;
      if (z.once) z.fired = true; if (z.flag) G.flags[z.flag] = 1;
      if (z.noCut) z.fn(); else run(() => cut(() => z.fn()));
      break;
    }
    let best = null, bd = 1e9;
    for (const it of G.interacts) { if (it.cond && !it.cond()) continue; const d = Math.abs(p.x - it.x); if (d < it.r && d < bd) { best = it; bd = d; } }
    G.near = best;
    if (best && tapped('interact') && p.h <= 0 && p.state === 'free') { p.vx = 0; run(() => cut(() => best.fn(best))); }
  } else G.near = null;

  // camera
  G.cam.x = lerp(G.cam.x, camTarget(), 1 - Math.pow(G.focus !== null || G.cine > .05 ? .07 : .002, dt));

  // death
  if (p.dead && G.state === 'play') { G.deathT += dt; if (G.deathT > 1.6) { G.state = 'over'; G.over = { kind: 'dead', title: 'You died.', lines: [], sel: 0 }; Music.set(null); } }
}
function gameOver(kind, title, lines) { if (kind === 'jail') addFound(['path:jail']); G.state = 'over'; G.over = { kind, title, lines: lines || [], sel: 0 }; Music.set(null); }

function drawWorld(c) {
  const th = G.theme, camX = G.cam.x, t = G.t;
  c.save();
  if (G.shake > 0) c.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake) * .6);
  const z = zoomNow(), zb = G.zoomMul === G.zoomT ? z : 0; STEADY = !!zb; drawSky(c, th, z);
  c.translate(W / 2, H); c.scale(z, z); c.translate(-W / 2, -H);
  drawBackdrop(c, th, camX, true);
  drawFog(c, th, camX, t, .7, zb);
  drawGround(c, th, camX);
  for (const p of G.props) {
    const sx = p.x - camX; if (sx < -420 || sx > W + 420 || p.hidden) continue;
    c.save(); c.translate(Math.round(sx), GROUND); if (p.flip) c.scale(-1, 1); PROPS[p.kind](c, p, t); c.restore();
  }
  // arena edges
  if (G.arena) for (const x of [G.arena.l, G.arena.r]) {
    const sx = x - camX; c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(sx - 40, 0, sx + 40, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(${th.fog ? th.fog.rgb : '255,255,255'},${.16 + .05 * Math.sin(t * 3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(sx - 40, 120, 80, GROUND - 110); c.globalCompositeOperation = 'source-over';
  }
  for (const e of G.ents) if (e.npc) e.draw(c, camX);
  for (const e of G.ents) if (e.hazard) e.draw(c, camX);
  for (const e of G.ents) if (e.enemy) { c.save(); e.draw(c, camX); c.restore(); }
  playerDraw(c, G.player, camX);
  for (const e of G.ents) if (e.proj) e.draw(c, camX);
  fxDraw(c, camX);
  drawAmbient(c, th, camX, G.ambT);
  drawFog(c, th, camX * 1.2 + 500, t * 1.3, .5, zb);
  drawForeground(c, th, camX);
  if (G.nightAmt > 0) { c.fillStyle = `rgba(6,8,30,${G.nightAmt * .34})`; c.fillRect(-20, -20, W + 40, H + 40); }
  drawDarkness(c);
  if (G.level.overlay) G.level.overlay(c, camX, t);
  c.restore();
  if (G.warp > 0) {
    c.globalCompositeOperation = 'difference'; c.fillStyle = `rgba(${Math.floor(150 * G.warp)},${Math.floor(60 * G.warp)},${Math.floor(200 * G.warp)},1)`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  }
  drawVignette(c);
  if (G.hurtFlash > 0) { const g = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8); g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${G.hurtFlash * 1.4})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  if (G.S.hp / G.S.maxHp < .3 && !G.player.dead) { const g = c.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, H * .85); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(120,0,0,${.25 + .12 * Math.sin(G.t * 5)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  if (G.flashWhite > 0) { c.fillStyle = `rgba(240,225,255,${Math.min(1, G.flashWhite * 2)})`; c.fillRect(0, 0, W, H); }
  // cinematic bars for boss reveals
  if (G.cine > 0) { c.fillStyle = '#000'; c.fillRect(0, 0, W, CINE_TOP * G.cine); c.fillRect(0, H - CINE_BOTTOM * G.cine, W, CINE_BOTTOM * G.cine + 1); }
}
const CINE_TOP = 44, CINE_BOTTOM = 118;
