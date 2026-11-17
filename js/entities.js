'use strict';
/* ============================================================
   entities.js — effects, the hunter, ordinary enemies, people
   ============================================================ */

/* ---------- effects ---------- */
function addFx(o) { G.fx.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: .5, age: 0, size: 3, col: '#fff', type: 'dot' }, o)); }
function burst(x, y, n, col, o = {}) {
  const sp = o.speed || 160;
  for (let i = 0; i < n; i++) addFx({ x, y, vx: rand(-sp, sp) + (o.dx || 0), vy: rand(-sp, sp * .4), g: o.g === undefined ? 500 : o.g, life: rand(.25, .6) * (o.life || 1), size: rand(1.5, 3.5) * (o.size || 1), col, glow: o.glow });
}
function floatText(x, y, txt, col = '#fff', size = 15) { addFx({ type: 'text', x: x + rand(-8, 8), y, vy: -50, life: 1.0, txt: String(txt), col, size }); }
function ringFx(x, y, col, r = 60, life = .4) { addFx({ type: 'ring', x, y, life, size: r, col }); }
function dustFx(x, n = 6) { for (let i = 0; i < n; i++) addFx({ x: x + rand(-8, 8), y: GROUND - 2, vx: rand(-60, 60), vy: rand(-50, -10), g: 60, life: rand(.3, .6), size: rand(3, 6), col: 'rgba(200,190,170,.35)', type: 'puff' }); }
function flameFx(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) addFx({ type: 'flame', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-30, 30) + (o.vx || 0) * rand(.4, 1), vy: rand(-90, -20), g: -80, life: rand(.25, .55), size: rand(5, 12) });
}
function shake(n) { G.shake = Math.max(G.shake, n); }

function fxUpdate(dt) {
  for (const f of G.fx) { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; if (f.type === 'dot' && f.y > GROUND + 4) { f.y = GROUND + 4; f.vy = 0; f.vx *= .8; } }
  G.fx = G.fx.filter(f => f.age < f.life);
}
function fxDraw(c, camX) {
  for (const f of G.fx) {
    const k = 1 - f.age / f.life, sx = f.x - camX;
    if (sx < -120 || sx > W + 120) continue;
    if (f.type === 'dot') {
      c.globalAlpha = Math.min(1, k * 2);
      if (f.glow) { c.globalCompositeOperation = 'lighter'; glow(c, sx, f.y, f.size * 4, f.glow, .5 * k); c.globalCompositeOperation = 'source-over'; }
      disc(c, sx, f.y, f.size * (.5 + k * .5), f.col); c.globalAlpha = 1;
    } else if (f.type === 'puff') {
      c.globalAlpha = k; disc(c, sx, f.y, f.size * (1.6 - k * .6), f.col); c.globalAlpha = 1;
    } else if (f.type === 'flame') {
      c.globalCompositeOperation = 'lighter';
      glow(c, sx, f.y, f.size * (1 + (1 - k)), k > .5 ? '255,220,120' : '255,110,40', .8 * k);
      c.globalCompositeOperation = 'source-over';
    } else if (f.type === 'text') {
      c.globalAlpha = Math.min(1, k * 2.5); c.font = font(f.size, 'bold'); c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(f.txt, sx + 1, f.y + 1); c.fillStyle = f.col; c.fillText(f.txt, sx, f.y); c.globalAlpha = 1;
    } else if (f.type === 'ring') {
      c.globalAlpha = k; c.strokeStyle = f.col; c.lineWidth = 3 * k + 1; c.beginPath(); c.arc(sx, f.y, f.size * (1 - k * k) + 6, 0, TAU); c.stroke(); c.globalAlpha = 1;
    } else if (f.type === 'slash') {
      const p = f.follow, x = (p ? p.x : f.x) - camX, y = p ? GROUND - p.h - 36 : f.y, Rr = f.kind === 2 ? 76 : 60;
      c.save(); c.translate(x, y); c.scale(f.dir, f.kind === 1 ? -1 : 1); c.rotate(f.kind === 2 ? .1 : -.1);
      c.globalAlpha = k * .9; c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(-10, 0, Rr * .6, 0, 0, Rr); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, f.col || 'rgba(215,240,255,.95)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, Rr, -1.75 + (1 - k) * .5, 1.0); c.arc(-16, 2, Rr * .84, 1.0, -1.75 + (1 - k) * .5, true); c.closePath(); c.fill();
      c.restore();
    }
  }
}

/* ---------- shared physics ---------- */
const GRAV = 1300;
function physics(e, dt) {
  const px = e.x;
  e.x += e.vx * dt;
  if (!e.floaty) {
    e.h += e.vh * dt; e.vh -= GRAV * dt;
    if (e.h <= 0) { if (e.vh < -380 && !e.proj) dustFx(e.x, 5); e.h = 0; e.vh = 0; }
  }
  const b = G.bounds;
  if (e !== G.player && (px < b.l - 30 || px > b.r + 30)) return;   // creatures outside a locked arena stay outside
  if (e.x < b.l + e.hw) { e.x = b.l + e.hw; if (e.vx < 0) e.vx = 0; }
  if (e.x > b.r - e.hw) { e.x = b.r - e.hw; if (e.vx > 0) e.vx = 0; }
}

/* ============================================================
   THE HUNTER
   ============================================================ */
const ATK = [
  { d: .30, a0: .07, a1: .17, mul: .24, reach: 66, lunge: 80, kb: 120 },
  { d: .30, a0: .07, a1: .17, mul: .24, reach: 66, lunge: 80, kb: 120 },
  { d: .46, a0: .14, a1: .27, mul: .44, reach: 78, lunge: 170, kb: 280 },
];
// a charged blow: hold the attack key, release to strike
const HEAVY = { d: .52, a0: .12, a1: .27, reach: 90, lunge: 220, kb: 380 };
const COST = { roll: 12, ember: 22, ward: 18, heavy: 8, block: 9 };
const PARRY_WINDOW = .2;     // seconds after raising the guard in which a block counts as a parry
const CHARGE_TAP = .14, CHARGE_FULL = .55;
const SPRINT_COST = 9, SPRINT_SPEED = 1.6;   // stamina per second, and how much faster than a run

function makePlayer(x) {
  return {
    kind: 'player', x, h: 0, vx: 0, vh: 0, dir: 1, hw: 12, tall: 70, t: 0,
    state: 'free', st: 0, nextCombo: 0, comboT: 0, inv: 0, flash: 0, runPh: 0,
    ward: 0, tonic: 0, focus: 0, staDelay: 0, hitSet: null, didFx: false, queued: false,
    look: LOOKS.hunter, anim: 'idle', ap: 0, atkKind: 0, dead: false, walkTo: null, usedEmber: false,
    heavy: null, blockT: 9, parryCd: 0, rollAtk: false, chargeFx: false, sprinting: false, sprintT: 0,
  };
}

function startAttack(p, kind) {
  const A = ATK[kind], S = G.S;
  if (held('left')) p.dir = -1; else if (held('right')) p.dir = 1;
  p.state = 'attack'; p.st = 0; p.atkKind = kind; p.hitSet = new Set(); p.didFx = false; p.queued = false; p.heavy = null;
  if (p.h <= 0) p.vx = p.dir * (A.lunge + (p.sprintT > 0 ? 130 : 0));     // attacking out of a sprint carries you further
  sfx(kind === 2 ? 'heavy' : 'swing');
}
function startHeavy(p, power) {
  const S = G.S;
  S.sta -= COST.heavy; p.staDelay = .5;
  if (held('left')) p.dir = -1; else if (held('right')) p.dir = 1;
  p.state = 'attack'; p.st = 0; p.atkKind = 2; p.hitSet = new Set(); p.didFx = false; p.queued = false;
  p.heavy = { mul: lerp(.55, 1.0, power), poise: lerp(20, 40, power), power };
  p.vx = p.dir * HEAVY.lunge; sfx('heavy');
}
// attacking in the air: drive the blade down and hit everything around the landing
function startPlunge(p) { p.state = 'plunge'; p.st = 0; p.heavy = null; p.vh = Math.min(p.vh, -620); p.vx = p.dir * 150; sfx('heavy'); }
function plungeLand(p) {
  const S = G.S; let any = false;
  sfx('thud'); shake(6); dustFx(p.x - 20, 6); dustFx(p.x + 20, 6); ringFx(p.x, GROUND - 8, 'rgba(215,240,255,.8)', 76, .3);
  for (const e of G.ents) {
    if (!e.enemy || e.dead || e.untouchable) continue;
    if (Math.abs(e.x - p.x) < 78 + e.hw && e.h < 90) {
      if (e.hurt((S.atk + (p.tonic > 0 ? 10 : 0)) * .4 * (S.crystal ? 1.25 : 1), p.x, { blade: true, plunge: true, kb: 260, heavy: true, poise: 16 })) any = true;
    }
  }
  if (any) G.hitstop = .06;
  p.state = 'land'; p.st = 0; p.vx = 0;
}
function playerStrike(p, A) {
  const S = G.S, cx = p.x + p.dir * (A.reach / 2 + 2);
  let any = false;
  for (const e of G.ents) {
    if (!e.enemy || e.dead || e.untouchable || p.hitSet.has(e)) continue;
    if (Math.abs(e.x - cx) < A.reach / 2 + e.hw + 4 && e.h < p.h + 96 && e.h + e.tall > p.h - 8) {
      p.hitSet.add(e);
      const H = p.heavy, big = A === ATK[2] || !!H;
      const dmg = (S.atk + (p.tonic > 0 ? 10 : 0)) * (H ? H.mul : A.mul) * (S.crystal ? 1.25 : 1);
      if (e.hurt(dmg, p.x, { blade: true, kb: A.kb, heavy: big, knock: !!H, poise: H ? H.poise : (A === ATK[2] ? 14 : 7) })) any = true;
    }
  }
  if (any) { G.hitstop = p.heavy ? .1 : A === ATK[2] ? .07 : .04; shake(p.heavy ? 8 : A === ATK[2] ? 5 : 2.5); }
}
function castEmber(p) {
  const S = G.S;
  sfx('ember'); p.usedEmber = true;
  for (let i = 0; i < 26; i++) addFx({ type: 'flame', x: p.x + p.dir * rand(20, 40), y: GROUND - p.h - rand(28, 52), vx: p.dir * rand(180, 460), vy: rand(-70, 50), g: -60, life: rand(.25, .5), size: rand(7, 15) });
  shake(3);
  for (const e of G.ents) {
    if (!e.enemy || e.dead || e.untouchable) continue;
    const dx = (e.x - p.x) * p.dir;
    if (dx > -10 && dx < 170 + e.hw && e.h < p.h + 110 && e.h + e.tall > p.h - 10) {
      e.hurt((S.atk + (p.tonic > 0 ? 10 : 0)) * .5 * (S.crystal ? 1.25 : 1), p.x, { kb: 200, fire: true, heavy: true, poise: 14 });
    }
  }
}
function usePotion(p, i) {
  const S = G.S, key = ['vit', 'tem', 'foc'][i];
  if (!S.pot[key]) { G.toast('You have none left.'); return; }
  if (key === 'vit' && S.hp >= S.maxHp) { G.toast('Your health is already full.'); return; }
  S.pot[key]--; sfx('potion');
  const y = GROUND - p.h - 80;
  if (key === 'vit') { const before = S.hp; S.hp = Math.min(S.maxHp, S.hp + 40); floatText(p.x, y, '+' + (S.hp - before) + ' health', '#ff8a8a'); burst(p.x, y + 40, 14, '#ff6a6a', { g: -200, glow: '255,90,90' }); }
  if (key === 'tem') { p.tonic = 45; floatText(p.x, y, 'Attack +10', '#ffd27a'); burst(p.x, y + 40, 14, '#ffd27a', { g: -200, glow: '255,210,120' }); }
  if (key === 'foc') { p.focus = 30; S.sta = S.maxSta; floatText(p.x, y, 'Stamina restored', '#9be8a0'); burst(p.x, y + 40, 14, '#9be8a0', { g: -200, glow: '150,240,160' }); }
}

// coat the blade: one oil at a time, each works against one kind of creature
function useOil(p, key) {
  const S = G.S, O = OILS[key];
  if (!S.oil[key]) { G.toast('You have no ' + O.name + '.'); return; }
  if (S.oilOn && S.oilOn.type === key && S.oilOn.t > OIL_TIME * .6) { G.toast('Your blade is already coated.'); return; }
  S.oil[key]--; S.oilOn = { type: key, t: OIL_TIME }; sfx('oil');
  const y = GROUND - p.h - 80;
  floatText(p.x, y, O.name, O.col); burst(p.x + p.dir * 16, y + 44, 14, O.col, { g: -160, glow: O.rgb });
}
function playerUpdate(p, dt) {
  const S = G.S;
  p.t += dt; p.inv = Math.max(0, p.inv - dt); p.flash = Math.max(0, p.flash - dt);
  p.ward = Math.max(0, p.ward - dt); p.tonic = Math.max(0, p.tonic - dt); p.focus = Math.max(0, p.focus - dt);
  p.parryCd = Math.max(0, p.parryCd - dt); p.sprintT = Math.max(0, p.sprintT - dt);
  if (p.state !== 'free') p.sprinting = false;
  if (S.oilOn && !(G.cutscene > 0)) { S.oilOn.t -= dt; if (S.oilOn.t <= 0) { S.oilOn = null; G.toast('The oil on your blade has worn off.'); } }
  const atkHeld = held('attack') || (Mouse.down && G.mouseAttack);
  if (p.staDelay > 0) p.staDelay -= dt; else S.sta = Math.min(S.maxSta, S.sta + (p.focus > 0 ? 34 : 16) * dt);

  const locked = G.cutscene > 0 || !!G.transition || p.dead;
  const ground = p.h <= 0;
  const speed = 200 * (S.crystal ? 1.12 : 1);
  let move = 0;
  if (!locked) { if (held('left')) move -= 1; if (held('right')) move += 1; }
  if (p.walkTo !== null && !p.dead) { if (Math.abs(p.walkTo - p.x) < 6) p.walkTo = null; else move = sgn(p.walkTo - p.x) * .6; }

  if (p.dead) {
    p.st += dt; p.anim = 'dead'; p.ap = Math.min(1, p.st / .7); p.vx = approach(p.vx, 0, 500 * dt);
  } else if (p.state === 'free') {
    if (move) p.dir = sgn(move);
    if (ground) {     // sprinting: hold Shift while moving. Faster, but it burns stamina
      if (!locked && held('sprint') && move && S.sta > (p.sprinting ? 0 : 6)) { p.sprinting = true; S.sta = Math.max(0, S.sta - SPRINT_COST * dt); p.staDelay = .35; p.sprintT = .3; if (Math.random() < .3) dustFx(p.x - p.dir * 10, 1); }
      else p.sprinting = false;
    }
    p.vx = approach(p.vx, move * speed * (p.sprinting ? SPRINT_SPEED : 1), (ground ? 2000 : 1000) * dt);
    if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.nextCombo = 0; }
    if (!locked) {
      if (tapped('jump') && ground) { p.vh = 460; sfx('jump'); dustFx(p.x, 3); }
      if (tapped('attack') || (Mouse.clicked && G.mouseAttack)) {
        if (!ground) startPlunge(p);
        else { p.state = 'charge'; p.st = 0; p.chargeFx = false; }     // a quick tap swings; holding charges a heavy blow
      }
      else if (tapped('dodge') && ground) tryRoll(p, move);
      else if (held('block') && ground) { p.state = 'block'; p.st = 0; p.blockT = p.parryCd > 0 ? 9 : 0; }
      else if (tapped('ember')) { if (S.sta >= COST.ember) { S.sta -= COST.ember; p.staDelay = .7; p.state = 'cast'; p.st = 0; p.didFx = false; p.castKind = 'ember'; } else G.toast('Not enough stamina.'); }
      else if (tapped('ward')) {
        if (p.ward > 0) G.toast('The ward is already up.');
        else if (S.sta >= COST.ward) { S.sta -= COST.ward; p.staDelay = .7; p.ward = 10; p.state = 'cast'; p.st = 0; p.didFx = true; p.castKind = 'ward'; sfx('ward'); ringFx(p.x, GROUND - p.h - 36, 'rgba(120,200,255,.9)', 50); }
        else G.toast('Not enough stamina.');
      }
      for (let i = 0; i < 3; i++) { if (tapped('p' + (i + 1))) usePotion(p, i); if (tapped('p' + (i + 4))) useOil(p, OIL_KEYS[i]); }
    }
    p.anim = ground ? (Math.abs(p.vx) > 25 ? 'run' : 'idle') : (p.vh > 0 ? 'jump' : 'fall');
    if (p.anim === 'run') {
      const before = Math.sin(p.runPh); p.runPh += Math.abs(p.vx) * dt * .058;
      if (before * Math.sin(p.runPh) < 0) sfx('step');
    }
  } else if (p.state === 'charge') {
    p.st += dt; if (move) p.dir = sgn(move);
    p.vx = approach(p.vx, move * speed * .35, 1600 * dt);
    p.anim = 'windup'; p.ap = clamp(p.st / CHARGE_FULL, .12, 1);
    if (p.st >= CHARGE_FULL && !p.chargeFx) { p.chargeFx = true; sfx('charge'); ringFx(p.x, GROUND - p.h - 44, 'rgba(255,220,140,.9)', 34, .3); }
    if (locked || !ground) p.state = 'free';
    else if (tapped('dodge')) tryRoll(p, move);
    else if (!atkHeld) {
      const power = clamp((p.st - CHARGE_TAP) / (CHARGE_FULL - CHARGE_TAP), 0, 1);
      if (power < .3 || S.sta < COST.heavy) startAttack(p, p.nextCombo); else startHeavy(p, power);
    }
  } else if (p.state === 'block') {
    p.st += dt; p.blockT += dt; if (move) p.dir = sgn(move);
    p.vx = approach(p.vx, 0, 2400 * dt); p.anim = 'block';
    if (locked || !ground || !held('block')) { p.state = 'free'; p.parryCd = .3; }
    else if (tapped('attack') || (Mouse.clicked && G.mouseAttack)) startAttack(p, p.nextCombo);
    else if (tapped('dodge')) { p.parryCd = .3; tryRoll(p, move); }
    else if (tapped('jump')) { p.state = 'free'; p.parryCd = .3; p.vh = 460; sfx('jump'); }
  } else if (p.state === 'plunge') {
    p.st += dt; p.anim = 'strike'; p.ap = Math.min(1, p.st / .12);
    if (ground) plungeLand(p);
  } else if (p.state === 'land') {
    p.st += dt; p.anim = 'crouch'; p.vx = approach(p.vx, 0, 2000 * dt);
    if (p.st >= .2) p.state = 'free';
  } else if (p.state === 'attack') {
    const A = p.heavy ? HEAVY : ATK[p.atkKind];
    p.st += dt; p.anim = 'attack'; p.ap = p.st / A.d;
    if (ground) p.vx = approach(p.vx, 0, 700 * dt);
    if (p.st >= A.a0 && !p.didFx) { p.didFx = true; addFx({ type: 'slash', follow: p, dir: p.dir, kind: p.atkKind, life: p.heavy ? .24 : .17, col: p.heavy || p.tonic > 0 ? 'rgba(255,220,150,.95)' : S.oilOn ? `rgba(${OILS[S.oilOn.type].rgb},.95)` : null }); }
    if (p.st >= A.a0 && p.st <= A.a1) playerStrike(p, A);
    if (!locked && p.st > A.d * .3 && (tapped('attack') || (Mouse.clicked && G.mouseAttack))) p.queued = true;
    if (!locked && p.st > A.a1 && tapped('dodge') && ground) { tryRoll(p, move); }
    else if (p.st >= A.d) {
      if (p.queued && p.atkKind < 2 && !locked) startAttack(p, p.atkKind + 1);
      else { p.state = 'free'; p.nextCombo = (p.atkKind + 1) % 3; p.comboT = .32; p.heavy = null; }
    }
  } else if (p.state === 'roll') {
    p.st += dt; p.anim = 'roll'; p.ap = Math.min(1, p.st / .44);
    p.vx = p.dir * lerp(380, 190, p.ap);
    if (Math.random() < .5) dustFx(p.x - p.dir * 8, 1);
    if (!locked && p.st > .12 && (tapped('attack') || (Mouse.clicked && G.mouseAttack))) p.rollAtk = true;
    if (p.st >= .44) { if (p.rollAtk && !locked) startAttack(p, 2); else p.state = 'free'; p.rollAtk = false; }   // attacking out of a roll goes straight to the finishing strike
  } else if (p.state === 'cast') {
    p.st += dt; p.anim = 'cast'; p.ap = Math.min(1, p.st / .4);
    if (ground) p.vx = approach(p.vx, 0, 1400 * dt);
    if (!p.didFx && p.st >= .12) { p.didFx = true; castEmber(p); }
    if (p.st >= (p.castKind === 'ward' ? .22 : .4)) p.state = 'free';
  } else if (p.state === 'hurt') {
    p.st += dt; p.anim = 'hurt'; if (ground) p.vx = approach(p.vx, 0, 500 * dt);
    if (p.st >= .28) p.state = 'free';
  }
  physics(p, dt);
}
function tryRoll(p, move) {
  const S = G.S;
  if (S.sta < COST.roll) { G.toast('Not enough stamina.'); return; }
  S.sta -= COST.roll; p.staDelay = .55;
  if (move) p.dir = sgn(move);
  p.state = 'roll'; p.st = 0; p.rollAtk = false; p.heavy = null; sfx('roll');
}
function playerHurt(p, dmg, srcX, o = {}) {
  if (p.dead || p.inv > 0 || G.cutscene > 0 || G.transition) return false;
  if (p.state === 'roll' && p.st < .36) return false;
  const y = GROUND - p.h - 40;
  const guarding = p.state === 'block' && !o.unblockable && (srcX - p.x) * p.dir >= -8;   // a raised guard is tried before the ward is spent
  if (p.ward > 0 && !guarding) {
    p.ward = 0; p.inv = .7; sfx('wardBreak'); ringFx(p.x, y, 'rgba(140,210,255,.95)', 70); burst(p.x, y, 16, '#aee0ff', { glow: '140,210,255' });
    floatText(p.x, y - 50, 'Warded!', '#aee0ff'); return true;
  }
  const S = G.S; let d = Math.max(1, Math.round(dmg * 100 / (100 + S.def)));
  // --- blocking and parrying: only against what is in front of you, and not against ground waves or tendrils ---
  if (guarding) {
    const gx = p.x + p.dir * 16;
    if (p.blockT <= PARRY_WINDOW) {
      p.inv = .4; S.sta = Math.min(S.maxSta, S.sta + 10); G.hitstop = .1; shake(5); sfx('parry');
      ringFx(gx, y, 'rgba(255,235,170,.95)', 60, .3); burst(gx, y, 16, '#ffe9a8', { glow: '255,225,150', speed: 260 });
      floatText(p.x, y - 52, 'Parry!', '#ffe08a', 18);
      if (!o.proj) { const e = o.src || nearestFoe(p, 180); if (e) parryFoe(e, p); }
      else if (o.projEnt) reflectShot(o.projEnt, p);
      p.blockT = 9; return true;
    }
    if (S.sta >= COST.block) {
      S.sta -= COST.block; p.staDelay = .6; d = Math.max(1, Math.round(d * .2)); S.hp -= d;
      sfx('block'); shake(3); burst(gx, y, 6, '#d8e2ea'); p.vx = -p.dir * 110; p.inv = .15;
      floatText(p.x, y - 46, 'Blocked  -' + d, '#cfd6da', 14);
      if (S.hp <= 0) { S.hp = 0; p.dead = true; p.state = 'dead'; p.st = 0; sfx('die'); G.onPlayerDeath(); }
      return true;
    }
    S.sta = 0; p.staDelay = 1; d = Math.max(1, Math.round(d * .7)); floatText(p.x, y - 66, 'Guard broken!', '#ff9a6a', 15);
  }
  S.hp -= d; p.flash = .12; shake(7); G.hurtFlash = .35;
  floatText(p.x, y - 46, '-' + d, '#ff6a6a', 17); burst(p.x, y, 10, '#a01818');
  if (S.hp <= 0) {
    S.hp = 0; p.dead = true; p.state = 'dead'; p.st = 0; p.vx = sgn(p.x - srcX) * 120; sfx('die'); G.onPlayerDeath();
  } else {
    p.state = 'hurt'; p.st = 0; p.vx = sgn(p.x - srcX) * (o.kb || 210); if (p.h <= 0) p.vh = 150; p.inv = .9; sfx('hurt');
  }
  return true;
}
// a parried arrow or orb is sent back at the nearest enemy ahead
function reflectShot(e, p) {
  e.reflected = true; e.life = 2.5;
  let tgt = null, bd = 900;
  for (const en of G.ents) { if (!en.enemy || en.dead) continue; const d = (en.x - p.x) * p.dir; if (d > 0 && d < bd) { bd = d; tgt = en; } }
  const sp = 640;
  if (tgt) { const dx = tgt.x - e.x, dh = (tgt.h + Math.min(tgt.tall, 140) * .5) - e.h, L = Math.hypot(dx, dh) || 1; e.vx = dx / L * sp; e.vh = dh / L * sp; }
  else { e.vx = p.dir * sp; e.vh = 0; }
}
// who just hit the hunter? (used when an attack did not say)
function nearestFoe(p, range) {
  let best = null, bd = range;
  for (const e of G.ents) { if (!e.enemy || e.dead) continue; const d = (e.x - p.x) * p.dir; if (d > -20 && d < bd) { best = e; bd = d; } }
  return best;
}
// a parried enemy is thrown off balance: ordinary ones are stunned, bosses reel and lose a chunk of poise
function parryFoe(e, p) {
  if (e.fixed) return;
  e.flash = .14; e.vx = p.dir * 150;
  if (!e.boss) { e.state = 'stun'; e.st = 0; e.stunT = 1.2; return; }
  reel(e, .8, false); addPoise(e, 38);
}
function reel(e, time, broken) { e.state = 'reel'; e.st = 0; e.reelT = time; e.broken = broken; e.alpha = 1; e.untouchable = false; e.tele = 0; }
// bosses have a stagger meter: fill it with hits, heavy blows and parries and they are left wide open
function addPoise(e, n) {
  if (!e.boss || e.fixed || e.dead || (e.state === 'reel' && e.broken) || e.stun > 0) return;
  e.poise = (e.poise || 0) + n; e.poiseT = 2.5;
  if (e.poise < (e.poiseMax || 120)) return;
  e.poise = 0; sfx('thud'); shake(7); G.hitstop = .12;
  floatText(e.x, GROUND - e.h - Math.min(e.tall, 150) - 30, 'Staggered!', '#ffe08a', 18);
  ringFx(e.x, GROUND - e.h - Math.min(e.tall, 120) * .5, 'rgba(255,225,150,.9)', 90, .4);
  if (e.T.onBreak) e.T.onBreak(e); else { reel(e, 2.6, true); e.vx = 0; }
}
function playerDraw(c, p, camX) {
  const sx = p.x - camX, sy = GROUND - p.h;
  shadow(c, sx, p.h, 16);
  p.look.blade = G.S.oilOn ? OILS[G.S.oilOn.type].blade : '#dfe9ee';      // an oiled blade takes the oil's colour
  if (p.state === 'block' && !p.dead) {     // the guard: bright during the parry window
    const hot = p.blockT <= PARRY_WINDOW;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hot ? 'rgba(255,230,160,.95)' : 'rgba(190,215,235,.45)'; c.lineWidth = hot ? 4 : 2.5;
    c.beginPath(); c.arc(sx + p.dir * 4, sy - 40, 34, p.dir > 0 ? -1.1 : Math.PI - 1.1, p.dir > 0 ? 1.1 : Math.PI + 1.1); c.stroke(); c.restore();
  }
  if (p.state === 'charge' && p.st > CHARGE_TAP) {   // the blade gathers light as the blow charges
    const k = clamp((p.st - CHARGE_TAP) / (CHARGE_FULL - CHARGE_TAP), 0, 1), full = k >= 1;
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, sx - p.dir * 8, sy - 74, 14 + 22 * k + (full ? Math.sin(p.t * 22) * 4 : 0), '255,215,130', .35 + .5 * k); c.restore();
  }
  const blink = p.inv > 0 && !p.dead && p.state !== 'roll' && Math.floor(p.t * 24) % 2 === 0;
  if (!blink) drawHuman(c, sx, sy, p);
  if (p.ward > 0) {
    const a = .35 + .15 * Math.sin(p.t * 5);
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, sx, sy - 38, 58, '110,190,255', a * .5);
    c.strokeStyle = `rgba(150,215,255,${a + .2})`; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy - 38, 30, 46, 0, 0, TAU); c.stroke();
    c.restore();
  }
  if (p.tonic > 0 && Math.random() < .25) addFx({ x: p.x + rand(-10, 10), y: sy - rand(10, 60), vy: -40, g: 0, life: .5, size: 2, col: '#ffd27a', glow: '255,210,120' });
}

/* ============================================================
   ORDINARY ENEMIES
   ============================================================ */
function mobHurt(e, dmg, srcX, o = {}) {
  if (e.dead || e.untouchable) return false;
  if (e.T.onHurt && e.T.onHurt(e, dmg, srcX, o) === false) return false;
  // a raised shield turns light sword strikes aside; the third strike of a combo knocks it away
  if (e.shield && o.blade && !o.knock && !o.plunge && (e.state === 'idle' || e.state === 'chase') && (srcX - e.x) * e.dir > 0) {
    const sy = GROUND - e.h - 40; sfx('block'); burst(e.x + e.dir * 12, sy, 7, '#d8e2ea'); e.flash = .06;
    if (o.heavy) { e.state = 'stun'; e.st = 0; e.stunT = .75; e.vx = sgn(e.x - srcX) * 170; floatText(e.x, sy - 44, 'Guard broken', '#ffe08a', 14); }
    else { e.vx = sgn(e.x - srcX) * 60; floatText(e.x, sy - 44, 'Blocked', '#9aa0ac', 12); }
    if (!G.flags.h_shield) { G.flags.h_shield = 1; hint('Its shield turns light strikes aside. The third strike of a combo breaks its guard. So does a charged heavy blow, a plunging strike or fire. Or parry its attack and hit it while it reels.', 11); }
    return true;
  }
  const open = e.state === 'reel' && e.broken ? 1.4 : 1;     // a staggered boss takes extra damage
  // weaknesses: the right oil for its kind; beasts fear fire; the dead break under heavy blows; void things hate their own darkness
  const S = G.S, oil = S.oilOn; let weak = 1, poiseMul = 1;
  if (o.blade && oil && e.fam === oil.type) weak *= 1.35;
  if (o.fire && e.fam === 'beast') weak *= 1.5;
  if ((o.knock || o.plunge) && e.fam === 'dead') { weak *= 1.3; poiseMul = 1.5; }
  if (o.reflect && e.fam === 'void') weak *= 1.5;
  if (e.fam) { S.met = S.met || {}; S.met[e.fam] = 1; }
  const d = Math.max(1, Math.round(dmg * (e.vuln || 1) * open * weak * 100 / (100 + (e.def || 0))));
  e.hp -= d; e.flash = .1;
  const y = GROUND - e.h - Math.min(e.tall, 120) * .6;
  floatText(e.x, GROUND - e.h - Math.min(e.tall, 150) - 8, weak > 1 ? d + '!' : d, weak > 1 ? '#ffe36a' : o.fire ? '#ffb04a' : '#ffffff', weak > 1 ? 17 : 15);
  burst(e.x, y, o.heavy ? 12 : 7, e.blood || '#7a1010', { dx: sgn(e.x - srcX) * 80 });
  sfx('hit');
  if (o.fire) e.burn = 3;
  if (e.hp <= 0) { mobDie(e); return true; }
  if (e.fixed) return true;
  if (!e.boss) {
    if (e.sturdy && !o.heavy) { e.vx += sgn(e.x - srcX) * 40; return true; }      // big creatures shrug off light hits
    e.state = 'stun'; e.st = 0; e.stunT = o.knock ? 1.0 : o.heavy ? .45 : .27;      // a charged blow knocks ordinary enemies flat
    e.vx = sgn(e.x - srcX) * (o.kb || 120); if (o.heavy && !e.floaty && e.h <= 0) e.vh = o.knock ? 230 : 130;
  } else { e.vx += sgn(e.x - srcX) * (o.kb || 120) * .12; addPoise(e, (o.poise || 7) * poiseMul); }
  return true;
}
function mobDie(e) {
  e.dead = true; e.hp = 0; e.state = 'dead'; e.st = 0; e.deadT = 0; e.untouchable = false;
  sfx('kill'); G.S.kills = (G.S.kills || 0) + 1; (G.S.slain = G.S.slain || {})[e.kind] = 1;
  if (e.coin) { const n = randi(e.coin[0], e.coin[1]); if (n > 0) { G.S.coins += n; floatText(e.x, GROUND - e.h - e.tall - 26, '+' + n + ' coins', '#ffd76a', 13); sfx('coin'); } }
  if (e.T.onDie) e.T.onDie(e);
}
function mobUpdate(e, dt) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  if (e.T.tick) e.T.tick(e, dt);
  if (e.burn > 0 && !e.dead) {
    e.burn -= dt; e.burnT = (e.burnT || 0) - dt;
    if (Math.random() < .5) flameFx(e.x + rand(-e.hw, e.hw), GROUND - e.h - rand(10, Math.min(e.tall, 110)), 1);
    if (e.burnT <= 0) { e.burnT = .5; e.hp -= 3; if (e.hp <= 0) { mobDie(e); } }
  }
  if (e.dead) {
    e.deadT += dt; e.anim = 'dead'; e.ap = Math.min(1, e.deadT / .6); e.vx = approach(e.vx, 0, 600 * dt);
    if (e.floaty) { e.h = Math.max(0, e.h - 120 * dt); }
    physics(e, dt);
    const hold = e.boss ? 2.6 : 1.5;
    if (e.deadT > hold) e.alpha = Math.max(0, 1 - (e.deadT - hold) / .7);
    if (e.deadT > hold + .7) e.remove = true;
    return;
  }
  if (G.cutscene > 0) { e.vx = approach(e.vx, 0, 900 * dt); if (e.anim === 'run' || e.anim === 'strike' || e.anim === 'windup') e.anim = 'idle'; if (e.state === 'windup' || e.state === 'strike') e.state = e.passive ? 'idle' : 'chase'; physics(e, dt); return; }
  if (e.boss && e.poise > 0) { e.poiseT -= dt; if (e.poiseT <= 0) e.poise = Math.max(0, e.poise - 12 * dt); }
  if (e.state === 'reel') {      // a boss knocked off balance by a parry or a full stagger meter
    e.st += dt; e.anim = 'hurt'; e.vx = approach(e.vx, 0, 700 * dt);
    if (e.st >= e.reelT) { e.state = 'recovering'; e.broken = false; e.cd = .4; }     // every boss falls back to its normal behaviour from an unknown state
    physics(e, dt); return;
  }
  if (e.state === 'stun') {
    e.st += dt; e.anim = 'hurt'; e.vx = approach(e.vx, 0, 520 * dt);
    if (e.st >= e.stunT) { e.state = 'chase'; e.st = 0; e.cd = Math.max(e.cd || 0, .25); }
    physics(e, dt); return;
  }
  e.T.ai(e, dt, G.player);
  physics(e, dt);
}

function tryHitPlayer(e, range, dmg, o = {}) {
  const p = G.player;
  const cx = e.x + e.dir * range * .5;
  if (Math.abs(cx - p.x) < range * .5 + p.hw + (o.pad || 0) && p.h < (o.top || 72) + e.h && p.h + p.tall > e.h - 4) return playerHurt(p, dmg, e.x, Object.assign({ src: e }, o));
  return false;
}

function meleeAI(e, dt, p) {
  const dx = p.x - e.x, ad = Math.abs(dx);
  switch (e.state) {
    case 'idle':
      e.anim = e.idleAnim || 'idle'; e.vx = approach(e.vx, 0, 500 * dt);
      if (!e.passive && ad < e.aggro && !p.dead) { e.state = 'chase'; e.cd = rand(.1, .5); }
      break;
    case 'chase':
      if (p.dead) { e.state = 'idle'; break; }
      e.dir = sgn(dx); e.cd -= dt;
      if (ad > e.range * .8) { e.vx = approach(e.vx, e.dir * e.speed, 700 * dt); e.anim = 'run'; e.runPh += e.speed * dt * .075; }
      else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; }
      if (ad < e.range && e.cd <= 0) { e.state = 'windup'; e.st = 0; }
      break;
    case 'windup':
      e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / e.windup);
      if (e.st >= e.windup) { e.state = 'strike'; e.st = 0; e.didHit = false; e.vx = e.dir * (e.lunge || 0); sfx('swing'); }
      break;
    case 'strike':
      e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .13); e.vx = approach(e.vx, 0, 700 * dt);
      if (!e.didHit && e.st < .17 && tryHitPlayer(e, e.range + 8, e.atk)) e.didHit = true;
      if (e.st >= .28 + e.recover) { e.state = 'chase'; e.cd = e.cdBase * rand(.7, 1.3); }
      break;
  }
}
function wolfAI(e, dt, p) {
  const dx = p.x - e.x, ad = Math.abs(dx);
  switch (e.state) {
    case 'idle': e.anim = 'idle'; e.vx = approach(e.vx, 0, 500 * dt); if (!e.passive && ad < e.aggro && !p.dead) { e.state = 'chase'; e.cd = rand(.2, .8); } break;
    case 'chase':
      if (p.dead) { e.state = 'idle'; break; }
      e.dir = sgn(dx); e.cd -= dt;
      if (ad > 190) { e.vx = approach(e.vx, e.dir * e.speed, 900 * dt); e.anim = 'run'; e.runPh += dt * 14; }
      else if (ad < 110 && e.cd > 0) { e.vx = approach(e.vx, -e.dir * e.speed * .6, 900 * dt); e.anim = 'run'; e.runPh += dt * 10; }
      else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; }
      if (ad < 240 && e.cd <= 0) { e.state = 'crouch'; e.st = 0; sfx('growl'); }
      break;
    case 'crouch': e.vx = approach(e.vx, 0, 1200 * dt); e.st += dt; e.anim = 'crouch'; if (e.st > .42) { e.state = 'leap'; e.st = 0; e.didHit = false; e.vx = e.dir * clamp(ad * 1.9, 300, 470); e.vh = 280; } break;
    case 'leap':
      e.st += dt; e.anim = 'leap'; e.ap = Math.min(1, e.st / .45);
      if (!e.didHit && Math.abs(p.x - e.x) < 30 + p.hw && Math.abs(p.h - e.h) < 50 && playerHurt(p, e.atk, e.x)) e.didHit = true;
      if (e.h <= 0 && e.st > .1) { e.state = 'recover'; e.st = 0; }
      break;
    case 'recover': e.anim = 'idle'; e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; if (e.st > .6) { e.state = 'chase'; e.cd = rand(.8, 1.6); } break;
  }
}
function archerAI(e, dt, p) {
  const dx = p.x - e.x, ad = Math.abs(dx);
  switch (e.state) {
    case 'idle': e.anim = 'idle'; e.vx = approach(e.vx, 0, 500 * dt); if (!e.passive && ad < e.aggro && !p.dead) { e.state = 'chase'; e.cd = rand(.4, 1); } break;
    case 'chase':
      if (p.dead) { e.state = 'idle'; break; }
      e.dir = sgn(dx); e.cd -= dt;
      if (ad > 460) { e.vx = approach(e.vx, e.dir * e.speed, 700 * dt); e.anim = 'run'; e.runPh += e.speed * dt * .075; }
      else if (ad < 170 && e.x > G.bounds.l + 60 && e.x < G.bounds.r - 60) { e.vx = approach(e.vx, -e.dir * e.speed, 700 * dt); e.anim = 'run'; e.runPh += e.speed * dt * .075; }
      else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; if (e.cd <= 0) { e.state = 'aim'; e.st = 0; } }
      break;
    case 'aim':
      e.dir = sgn(dx); e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'bowAim'; e.ap = Math.min(1, e.st / .85);
      if (e.st >= .85) { sfx('arrow'); G.ents.push(makeProj({ kind: 'arrow', x: e.x + e.dir * 20, h: 46, vx: e.dir * 520, dmg: e.atk, life: 2 })); e.state = 'chase'; e.cd = rand(1.2, 1.9); }
      break;
  }
}
function voidlingAI(e, dt, p) {
  const dx = p.x - e.x, ad = Math.abs(dx);
  e.open = Math.min(1, (e.open || 0) + dt * 2); e.alpha = e.open;
  switch (e.state) {
    case 'idle': e.anim = 'idle'; e.vx = approach(e.vx, 0, 300 * dt); if (!e.passive && ad < e.aggro && !p.dead) { e.state = 'chase'; e.cd = rand(.5, 1.2); } break;
    case 'chase':
      if (p.dead) { e.state = 'idle'; break; }
      e.dir = sgn(dx); e.cd -= dt; e.anim = 'idle';
      e.vx = approach(e.vx, ad > 170 ? e.dir * e.speed : (ad < 110 ? -e.dir * e.speed * .5 : 0), 500 * dt);
      if (ad < 230 && e.cd <= 0) { e.state = 'windup'; e.st = 0; }
      break;
    case 'windup': e.vx = approach(e.vx, -e.dir * 40, 600 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / .5); if (e.st >= .5) { e.state = 'strike'; e.st = 0; e.didHit = false; e.vx = e.dir * 540; sfx('teleport'); } break;
    case 'strike':
      e.st += dt; e.anim = 'strike';
      if (!e.didHit && Math.abs(p.x - e.x) < 24 + p.hw && p.h < 80 && playerHurt(p, e.atk, e.x)) e.didHit = true;
      if (Math.random() < .6) addFx({ x: e.x, y: GROUND - 46 + rand(-8, 8), life: .3, size: 4, col: '#1a0630', g: 0 });
      if (e.st > .36) { e.state = 'recover'; e.st = 0; }
      break;
    case 'recover': e.anim = 'idle'; e.vx = approach(e.vx, 0, 800 * dt); e.st += dt; if (e.st > .7) { e.state = 'chase'; e.cd = rand(.9, 1.7); } break;
  }
}

const drawRig = (c, sx, sy, e) => { shadow(c, sx, e.h, 16 * (e.look.scale || 1)); drawHuman(c, sx, sy, e); };
const MOBS = {
  ghoul:     { base: { fam: 'dead', hp: 46, atk: 13, def: 0, speed: 62, aggro: 420, range: 50, windup: .5, recover: .55, cdBase: .7, lunge: 120, hw: 13, tall: 62, coin: [1, 4], blood: '#3c5a2a', look: LOOKS.ghoul }, ai: meleeAI, draw: drawRig },
  bandit:    { base: { fam: 'man', hp: 56, atk: 15, def: 8, speed: 96, aggro: 460, range: 56, windup: .46, recover: .5, cdBase: .8, lunge: 150, hw: 13, tall: 68, coin: [4, 9], look: LOOKS.bandit }, ai: meleeAI, draw: drawRig },
  cutthroat: { base: { fam: 'man', hp: 70, atk: 18, def: 12, speed: 112, aggro: 500, range: 60, windup: .4, recover: .45, cdBase: .7, lunge: 190, hw: 13, tall: 68, coin: [6, 12], look: LOOKS.cutthroat }, ai: meleeAI, draw: drawRig },
  archer:    { base: { fam: 'man', hp: 44, atk: 14, def: 0, speed: 100, aggro: 620, hw: 13, tall: 68, coin: [4, 9], look: LOOKS.archer }, ai: archerAI, draw: drawRig },
  wolf:      { base: { fam: 'beast', hp: 32, atk: 14, def: 0, speed: 170, aggro: 480, hw: 22, tall: 40, coin: [0, 0], blood: '#6a1010' }, ai: wolfAI, draw: (c, sx, sy, e) => { shadow(c, sx, e.h, 26); drawWolf(c, sx, sy, e); } },
  voidling:  { base: { fam: 'void', hp: 36, atk: 15, def: 0, speed: 120, aggro: 560, hw: 16, tall: 70, floaty: true, coin: [0, 3], blood: '#8a40e0' }, ai: voidlingAI, draw: (c, sx, sy, e) => { shadow(c, sx, 50, 14); drawVoidling(c, sx, sy, e); } },
};

function makeMob(type, x, o = {}) {
  const T = MOBS[type];
  const e = Object.assign({
    kind: type, enemy: true, x, h: 0, vx: 0, vh: 0, dir: -1, t: rand(10), state: 'idle', st: 0, cd: 0,
    flash: 0, dead: false, remove: false, deadT: 0, burn: 0, anim: 'idle', ap: 0, runPh: rand(6), seed: rand(100), stunT: 0,
  }, T.base, o);
  const plus = (G.S && G.S.plus) || 0;     // each New Hunt+ makes everything tougher
  const D = DIFFS[(G.S && G.S.diff) || 'hunter'] || DIFFS.hunter;
  if (plus || D !== DIFFS.hunter) { e.hp = Math.max(1, Math.round(e.hp * (1 + .6 * plus) * D.hp)); e.atk = Math.round(e.atk * (1 + .3 * plus) * D.atk); }
  e.maxHp = e.hp; e.T = T;
  e.update = dt => mobUpdate(e, dt);
  e.draw = (c, camX) => { const sx = e.x - camX; if (sx < -260 || sx > W + 260) return; T.draw(c, sx, GROUND - e.h, e); };
  e.hurt = (d, sx, opt) => mobHurt(e, d, sx, opt);
  return e;
}

/* ---------- projectiles & hazards ---------- */
function makeProj(o) {
  const e = Object.assign({ proj: true, x: 0, h: 40, vx: 0, vh: 0, life: 3, dmg: 10, r: 8, t: 0, hw: 4, tall: 8, remove: false }, o);
  e.update = dt => {
    e.t += dt; e.life -= dt; e.x += e.vx * dt; e.h += e.vh * dt;
    if (e.life <= 0 || e.x < G.bounds.l - 200 || e.x > G.bounds.r + 200 || e.h < -10) { e.remove = true; return; }
    const p = G.player;
    if (e.kind === 'wave') {
      if (Math.random() < .7) addFx({ x: e.x, y: GROUND - rand(0, 26), vx: -e.vx * .1, vy: -60, g: 0, life: .3, size: 3, col: e.col || '#9ff', glow: e.rgb || '150,255,240' });
      if (!e.done && Math.abs(p.x - e.x) < 18 + p.hw && p.h < 26) { if (playerHurt(p, e.dmg, e.x - e.vx, { unblockable: true })) e.done = true; }
      return;
    }
    if (e.kind === 'orb' && Math.random() < .6) addFx({ x: e.x, y: GROUND - e.h, life: .35, size: 5, col: '#12041f', g: 0 });
    if (e.kind === 'spark' && Math.random() < .6) addFx({ x: e.x, y: GROUND - e.h, life: .3, size: 2.5, col: '#c8ffd8', g: 0, glow: '150,255,200' });
    if (e.reflected) {      // a parried shot strikes whatever it meets on the way back
      for (const en of G.ents) if (en.enemy && !en.dead && !en.untouchable && Math.abs(en.x - e.x) < e.r + en.hw && e.h > en.h - 8 && e.h < en.h + en.tall + 8) {
        en.hurt(e.dmg * 3, e.x - e.vx * .1, { poise: 30, heavy: true, reflect: true, kb: 200 }); e.remove = true; burst(e.x, GROUND - e.h, 10, e.kind === 'orb' ? '#b070ff' : '#c8c0a8'); break;
      }
      return;
    }
    if (Math.abs(p.x - e.x) < e.r + p.hw && e.h > p.h - 6 && e.h < p.h + p.tall + 4) {
      if (playerHurt(p, e.dmg, e.x - e.vx * .1, { proj: true, projEnt: e }) && !e.reflected) { e.remove = true; burst(e.x, GROUND - e.h, 6, e.kind === 'orb' ? '#b070ff' : '#c8c0a8'); }
    }
  };
  e.draw = (c, camX) => {
    const sx = e.x - camX, sy = GROUND - e.h;
    if (e.kind === 'arrow') { const d = sgn(e.vx); line(c, sx - d * 16, sy, sx + d * 10, sy, 2, '#d8d0c0'); poly(c, [sx + d * 14, sy, sx + d * 8, sy - 3, sx + d * 8, sy + 3], '#bbb'); line(c, sx - d * 16, sy, sx - d * 20, sy - 3, 1.5, '#a33'); line(c, sx - d * 16, sy, sx - d * 20, sy + 3, 1.5, '#a33'); }
    else if (e.kind === 'spark') { c.globalCompositeOperation = 'lighter'; glow(c, sx, sy, 26, '150,255,200', .8); c.globalCompositeOperation = 'source-over'; disc(c, sx, sy, 4, '#f0fff4'); }
    else if (e.kind === 'orb') { c.globalCompositeOperation = 'lighter'; glow(c, sx, sy, 30, '170,80,255', .7); c.globalCompositeOperation = 'source-over'; disc(c, sx, sy, 9, '#07020e'); disc(c, sx + Math.sin(e.t * 20) * 2, sy, 3, '#e0b0ff'); }
    else if (e.kind === 'wave') { const d = sgn(e.vx); c.globalCompositeOperation = 'lighter'; glow(c, sx, GROUND - 12, 36, e.rgb || '150,255,240', .6); c.globalCompositeOperation = 'source-over'; c.fillStyle = e.col || 'rgba(190,255,245,.9)'; c.beginPath(); c.moveTo(sx - d * 22, GROUND); c.quadraticCurveTo(sx + d * 6, GROUND - 6, sx + d * 12, GROUND - 30); c.quadraticCurveTo(sx + d * 16, GROUND - 8, sx + d * 20, GROUND); c.fill(); }
  };
  return e;
}

// a tendril that bursts from the ground after a warning glow
function makeTendril(x, dmg, delay = 0) {
  const e = { hazard: true, x, t: -delay, done: false, remove: false, warn: .78 };
  e.update = dt => {
    e.t += dt; const p = G.player;
    if (e.t >= e.warn && !e.snd) { e.snd = true; sfx('tendril'); shake(3); }
    if (e.t >= e.warn && e.t < e.warn + .3 && !e.done && Math.abs(p.x - e.x) < 22 + p.hw && p.h < 112) { if (playerHurt(p, dmg, e.x + (p.x < e.x ? 10 : -10), { unblockable: true })) e.done = true; }
    if (e.t > e.warn + .75) e.remove = true;
  };
  e.draw = (c, camX) => {
    if (e.t < 0) return; const sx = e.x - camX;
    if (e.t < e.warn) {
      const k = e.t / e.warn; c.save(); c.translate(sx, GROUND + 2); c.scale(1, .3); c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 20 + 26 * k, '200,90,255', .35 + .5 * k); c.restore();
      c.strokeStyle = `rgba(220,150,255,${.4 + .6 * k})`; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, GROUND + 2, 24, 5, 0, 0, TAU); c.stroke();
    } else {
      const u = e.t - e.warn, k = u < .1 ? u / .1 : u < .4 ? 1 : Math.max(0, 1 - (u - .4) / .35), hh = 122 * k, wob = Math.sin(e.t * 20) * 4;
      c.globalCompositeOperation = 'lighter'; glow(c, sx, GROUND - hh * .5, 50, '170,80,255', .35 * k); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#07020e'; c.strokeStyle = 'rgba(190,110,255,.8)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(sx - 16, GROUND + 3); c.quadraticCurveTo(sx - 8 + wob, GROUND - hh * .6, sx + wob * .5, GROUND - hh); c.quadraticCurveTo(sx + 9 + wob, GROUND - hh * .6, sx + 16, GROUND + 3); c.closePath(); c.fill(); c.stroke();
    }
  };
  return e;
}

/* ---------- people who do not fight ---------- */
function makeNPC(lookName, x, o = {}) {
  const e = Object.assign({ npc: true, x, h: 0, vx: 0, vh: 0, dir: -1, t: rand(10), look: LOOKS[lookName], anim: 'idle', ap: 0, runPh: 0, hw: 12, tall: 68, flash: 0, face: true, remove: false }, o);
  e.update = dt => {
    e.t += dt;
    if (e.walkTo !== undefined && e.walkTo !== null) {
      const d = e.walkTo - e.x; if (Math.abs(d) < 5) { e.walkTo = null; e.anim = 'idle'; if (e.onArrive) { const f = e.onArrive; e.onArrive = null; f(); } }
      else { e.dir = sgn(d); e.x += e.dir * (e.walkSpeed || 110) * dt; e.anim = 'run'; e.runPh += (e.walkSpeed || 110) * dt * .07; }
    } else if (e.face && G.player && e.anim !== 'dead' && e.anim !== 'cower') e.dir = sgn(G.player.x - e.x);
    if (e.anim === 'dead') e.ap = Math.min(1, e.ap + dt * 1.5);
  };
  e.draw = (c, camX) => { const sx = e.x - camX; if (sx < -200 || sx > W + 200) return; shadow(c, sx, 0, 16 * (e.look.scale || 1)); drawHuman(c, sx, GROUND, e); };
  return e;
}
