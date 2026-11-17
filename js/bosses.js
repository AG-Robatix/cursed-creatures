'use strict';
/* ============================================================
   bosses.js — the cursed creatures: Wraith, Werewolf,
   Elder Vampire and the Voidspawn
   ============================================================ */

/* ---------- THE WRAITH (stats grown from the original: 40 health, 20 attack, 15 defense) ---------- */
MOBS.wraith = {
  base: { fam: 'dead', name: 'The Wraith', boss: true, poiseMax: 110, hp: 440, atk: 22, def: 15, speed: 76, hw: 18, tall: 122, floaty: true, coin: [0, 0], blood: '#9fffee', vuln: .8, solid: 0, alpha: 1 },
  tick(e, dt) { if (e.solid > 0) { e.solid -= dt; if (e.solid <= 0) e.vuln = .8; } },
  onHurt(e, dmg, srcX, o) {
    if (o.fire) {
      if (e.solid <= 0) floatText(e.x, GROUND - 150, 'It takes form!', '#ffb04a', 16);
      e.solid = 4.5; e.vuln = 1.3; e.alpha = 1; e.untouchable = false; e.state = 'stagger'; e.st = 0;
    }
  },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), rage = e.hp < e.maxHp * .5, b = G.bounds;
    const wail = () => { e.state = 'wail'; e.st = 0; e.fired = 0; sfx('wail'); };
    switch (e.state) {
      case 'idle': e.anim = 'idle'; if (!e.passive) { e.state = 'drift'; e.cd = 1; } break;
      case 'drift':
        e.dir = sgn(dx); e.anim = 'idle'; e.cd -= dt;
        e.vx = approach(e.vx, ad > 70 ? e.dir * e.speed * (rage ? 1.4 : 1) : 0, 320 * dt);
        if (!e.w1 && e.hp < e.maxHp * .66) { e.w1 = true; wail(); }
        else if (!e.w2 && e.hp < e.maxHp * .33) { e.w2 = true; wail(); }
        else if (e.cd <= 0) {
          if (ad < 98) { e.state = 'windup'; e.st = 0; e.wu = .5; }
          else if (Math.random() < .6 && e.solid <= 0) { e.state = 'vanish'; e.st = 0; sfx('teleport'); }
          else e.cd = .45;
        }
        break;
      case 'windup':
        e.vx = approach(e.vx, 0, 600 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / e.wu);
        if (e.st >= e.wu) { e.state = 'strike'; e.st = 0; e.didHit = false; e.vx = e.dir * 120; sfx('heavy'); }
        break;
      case 'strike':
        e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .14); e.vx = approach(e.vx, 0, 500 * dt);
        if (!e.didHit && e.st < .18 && tryHitPlayer(e, 104, e.atk, { top: 112 })) e.didHit = true;
        if (e.st > .55) { e.state = 'drift'; e.cd = rand(.5, 1.1) * (rage ? .65 : 1); }
        break;
      case 'vanish':
        e.st += dt; e.alpha = Math.max(0, 1 - e.st / .32); e.untouchable = true; e.vx = approach(e.vx, 0, 600 * dt); e.anim = 'idle';
        if (e.st >= .55) { e.x = clamp(p.x - p.dir * 96, b.l + 40, b.r - 40); e.dir = sgn(p.x - e.x); e.state = 'appear'; e.st = 0; sfx('teleport'); }
        break;
      case 'appear':
        e.st += dt; e.alpha = Math.min(1, e.st / .28); e.dir = sgn(dx);
        if (e.st >= .28) { e.alpha = 1; e.untouchable = false; e.state = 'windup'; e.st = 0; e.wu = .4; }
        break;
      case 'wail':
        e.vx = approach(e.vx, 0, 600 * dt); e.st += dt; e.anim = 'wail'; if (e.st < 1) shake(2);
        if ((e.fired === 0 && e.st >= 1.0) || (e.fired === 1 && e.w2 && e.st >= 1.55)) {
          e.fired++; ringFx(e.x, GROUND - 70, 'rgba(170,255,240,.9)', 140, .5); shake(5);
          for (const d of [-1, 1]) G.ents.push(makeProj({ kind: 'wave', x: e.x + d * 20, h: 0, vx: d * 320, dmg: 20, life: 3 }));
        }
        if (e.st >= (e.w2 ? 2.1 : 1.5)) { e.state = 'drift'; e.cd = .8; }
        break;
      case 'stagger':
        e.st += dt; e.anim = 'idle'; e.vx = approach(e.vx, 0, 500 * dt);
        if (e.st > .95) { e.state = 'drift'; e.cd = .25; }
        break;
      default: e.state = 'drift'; e.cd = .5; e.alpha = 1; e.untouchable = false;
    }
  },
  draw(c, sx, sy, e) { shadow(c, sx, 30, 20); drawWraith(c, sx, sy, e); },
};

/* ---------- THE WEREWOLF ---------- */
MOBS.werewolf = {
  base: { fam: 'beast', name: 'The Werewolf', boss: true, poiseMax: 130, hp: 640, atk: 25, def: 20, speed: 150, hw: 24, tall: 104, coin: [0, 0], look: LOOKS.werewolf, blood: '#6a1010' },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), rage = e.hp < e.maxHp * .5, spd = e.speed * (rage ? 1.22 : 1), b = G.bounds;
    const claw = (range, mul) => { if (!e.didHit && e.st < .17 && tryHitPlayer(e, range, e.atk * mul, { top: 96 })) e.didHit = true; };
    switch (e.state) {
      case 'idle': e.anim = 'idle'; if (!e.passive) { e.state = 'prowl'; e.cd = .8; } break;
      case 'prowl':
        e.dir = sgn(dx); e.cd -= dt;
        if (ad > 112) { e.vx = approach(e.vx, e.dir * spd, 900 * dt); e.anim = 'run'; e.runPh += spd * dt * .05; }
        else { e.vx = approach(e.vx, 0, 1200 * dt); e.anim = 'idle'; }
        if (!e.howled && rage) { e.howled = true; e.state = 'howl'; e.st = 0; sfx('howl'); }
        else if (e.cd <= 0) {
          const r = Math.random();
          if (ad < 124) e.state = r < .7 ? 'clawWind' : 'leapWind';
          else if (ad < 430) e.state = r < .5 ? 'leapWind' : 'chargeWind';
          else e.state = 'chargeWind';
          e.st = 0; if (e.state !== 'clawWind') sfx('growl');
        }
        break;
      case 'clawWind':
        e.vx = approach(e.vx, 0, 1200 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / .4);
        if (e.st >= .4) { e.state = 'claw1'; e.st = 0; e.didHit = false; e.vx = e.dir * 230; sfx('heavy'); }
        break;
      case 'claw1':
        e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .13); e.vx = approach(e.vx, 0, 900 * dt); claw(92, 1);
        if (e.st >= .3) { e.state = 'claw2Wind'; e.st = 0; }
        break;
      case 'claw2Wind':
        e.dir = sgn(dx); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / .22);
        if (e.st >= .22) { e.state = 'claw2'; e.st = 0; e.didHit = false; e.vx = e.dir * 320; sfx('heavy'); }
        break;
      case 'claw2':
        e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .13); e.vx = approach(e.vx, 0, 900 * dt); claw(96, 1);
        if (e.st >= .3 + (rage ? .45 : .7)) { e.state = 'prowl'; e.cd = rand(.5, 1.0) * (rage ? .6 : 1); }
        break;
      case 'leapWind':
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 1200 * dt); e.st += dt; e.anim = 'crouch';
        if (e.st >= .52) { const T = .78; e.state = 'leap'; e.st = 0; e.didHit = false; e.vx = clamp(dx / T, -640, 640); e.vh = GRAV * T / 2; }
        break;
      case 'leap':
        e.st += dt; e.anim = 'leap';
        if (!e.didHit && Math.abs(p.x - e.x) < 36 + p.hw && Math.abs(p.h - e.h) < 70 && e.st > .5 && playerHurt(p, e.atk * 1.1, e.x)) e.didHit = true;
        if (e.h <= 0 && e.st > .15) {
          sfx('thud'); shake(9); dustFx(e.x - 30, 6); dustFx(e.x + 30, 6);
          if (!e.didHit && Math.abs(p.x - e.x) < 92 && p.h < 26) playerHurt(p, e.atk * 1.1, e.x, { kb: 320 });
          e.state = 'recover'; e.st = 0; e.rec = rage ? .55 : .8; e.vx = 0;
        }
        break;
      case 'chargeWind':
        e.dir = sgn(dx); e.vx = approach(e.vx, -e.dir * 40, 800 * dt); e.st += dt; e.anim = 'crouch';
        if (e.st >= .62) { e.state = 'charge'; e.st = 0; e.didHit = false; }
        break;
      case 'charge':
        e.st += dt; e.vx = e.dir * 580; e.anim = 'run'; e.runPh += dt * 24; if (Math.random() < .6) dustFx(e.x - e.dir * 20, 1);
        if (!e.didHit && Math.abs(p.x - e.x) < 40 + p.hw && p.h < 60 && playerHurt(p, e.atk * 1.15, e.x, { kb: 380 })) e.didHit = true;
        if (e.st > .85 || e.x < b.l + 60 || e.x > b.r - 60) { e.state = 'recover'; e.st = 0; e.rec = rage ? .6 : .85; }
        break;
      case 'recover':
        e.vx = approach(e.vx, 0, 1100 * dt); e.anim = 'idle'; e.st += dt;
        if (e.st >= e.rec) { e.state = 'prowl'; e.cd = rand(.4, .9) * (rage ? .55 : 1); }
        break;
      case 'howl':
        e.vx = approach(e.vx, 0, 1200 * dt); e.anim = 'howl'; e.st += dt; shake(1.5);
        if (!e.summoned && e.st > .8) {
          e.summoned = true;
          for (const x of [b.l + 40, b.r - 40]) { const w = makeMob('wolf', x); w.state = 'chase'; w.cd = rand(.6, 1.4); G.ents.push(w); dustFx(x, 8); }
        }
        if (e.st >= 1.6) { e.state = 'prowl'; e.cd = .5; }
        break;
      default: e.state = 'prowl'; e.cd = .5;
    }
  },
  draw(c, sx, sy, e) { shadow(c, sx, e.h, 34); drawHuman(c, sx, sy, e); },
};

/* ---------- THE ELDER VAMPIRE ---------- */
MOBS.bat = {
  base: { hp: 1, atk: 10, def: 0, hw: 10, tall: 16, floaty: true, fixed: true, coin: [0, 0], blood: '#5a0f1c', life: 6 },
  ai(e, dt, p) {
    e.life -= dt; const tx = p.x, th = p.h + 40, dx = tx - e.x, dh = th - e.h, d = Math.hypot(dx, dh) || 1;
    e.vx = approach(e.vx, dx / d * 190, 420 * dt); e.vh2 = approach(e.vh2 || 0, dh / d * 190, 420 * dt); e.h = Math.max(6, e.h + e.vh2 * dt);
    if (Math.abs(p.x - e.x) < 12 + p.hw && e.h > p.h - 6 && e.h < p.h + p.tall) { if (playerHurt(p, e.atk, e.x, { kb: 120 })) e.remove = true; }
    if (e.life <= 0) { e.remove = true; burst(e.x, GROUND - e.h, 5, '#2a0f18'); }
  },
  draw(c, sx, sy, e) { drawBat(c, sx, sy, e); },
};
MOBS.vampire = {
  base: { fam: 'dead', name: 'The Elder Vampire', boss: true, poiseMax: 130, hp: 780, atk: 28, def: 25, speed: 118, hw: 14, tall: 88, coin: [0, 0], look: LOOKS.vampire, blood: '#5a0f1c', alpha: 1 },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), rage = e.hp < e.maxHp * .4, b = G.bounds;
    switch (e.state) {
      case 'idle': e.anim = e.idleAnim || 'idle'; if (!e.passive) { e.idleAnim = null; e.state = 'stalk'; e.cd = 1; } break;
      case 'stalk':
        e.dir = sgn(dx); e.cd -= dt;
        if (ad > 92) { e.vx = approach(e.vx, e.dir * e.speed, 700 * dt); e.anim = 'walk'; e.runPh += e.speed * dt * .06; } else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; }
        if (e.cd <= 0) {
          const r = Math.random(), bats = G.ents.filter(x => x.kind === 'bat' && !x.dead).length;
          if (ad < 104) e.state = r < .55 ? 'flurryWind' : r < .82 || bats ? 'blink' : 'bats';
          else e.state = r < .4 ? 'dashWind' : r < .75 || bats ? 'blink' : 'bats';
          e.st = 0; e.wu = .32; if (e.state === 'blink') sfx('teleport');
        }
        break;
      case 'flurryWind':
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / e.wu);
        if (e.st >= e.wu) { e.state = 'flurry'; e.st = 0; e.n = -1; }
        break;
      case 'flurry': {
        e.st += dt; const i = Math.floor(e.st / .19);
        if (i > e.n && i < 3) { e.n = i; e.didHit = false; e.vx = e.dir * 170; sfx('swing'); e.subT = 0; }
        e.subT += dt; e.anim = i % 2 ? 'windup' : 'strike'; e.ap = Math.min(1, e.subT / .12); if (i % 2) e.ap = 1 - e.ap;
        e.vx = approach(e.vx, 0, 700 * dt);
        if (i < 3 && !e.didHit && e.subT < .12 && tryHitPlayer(e, 78, e.atk * .7, { top: 90 })) e.didHit = true;
        if (e.st >= .57) { e.state = 'recover'; e.st = 0; e.rec = rage ? .5 : .78; }
        break;
      }
      case 'blink':
        e.st += dt; e.alpha = Math.max(0, 1 - e.st / .25); e.untouchable = true; e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle';
        if (Math.random() < .5) addFx({ x: e.x + rand(-14, 14), y: GROUND - rand(10, 80), vy: -30, g: 0, life: .5, size: 5, col: 'rgba(60,10,20,.6)', type: 'puff' });
        if (e.st >= .42) { const side = Math.random() < .65 ? -p.dir : p.dir; e.x = clamp(p.x + side * 100, b.l + 30, b.r - 30); e.dir = sgn(p.x - e.x); e.state = 'blinkIn'; e.st = 0; }
        break;
      case 'blinkIn':
        e.st += dt; e.alpha = Math.min(1, e.st / .2); e.dir = sgn(dx);
        if (e.st >= .2) { e.alpha = 1; e.untouchable = false; e.state = 'flurryWind'; e.st = 0; e.wu = .26; }
        break;
      case 'dashWind':
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'crouch'; e.tele = Math.min(1, e.st / .55);
        if (e.st >= .55) { e.state = 'dash'; e.st = 0; e.didHit = false; e.tele = 0; sfx('heavy'); }
        break;
      case 'dash':
        e.st += dt; e.vx = e.dir * 800; e.anim = 'leap';
        addFx({ x: e.x, y: GROUND - 44, life: .25, size: 16, col: 'rgba(90,15,28,.5)', type: 'puff', g: 0 });
        if (!e.didHit && Math.abs(p.x - e.x) < 30 + p.hw && p.h < 76 && playerHurt(p, e.atk * 1.1, e.x - e.dir * 20, { kb: 320 })) e.didHit = true;
        if (e.st > .5 || e.x < b.l + 40 || e.x > b.r - 40) { e.state = 'recover'; e.st = 0; e.rec = rage ? .4 : .6; }
        break;
      case 'bats':
        e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'howl';
        if (!e.fired && e.st > .55) { e.fired = true; sfx('scream'); for (let i = 0; i < (rage ? 5 : 3); i++) { const bt = makeMob('bat', e.x + rand(-20, 20), { h: 70 + i * 16 }); bt.vx = rand(-200, 200); bt.state = 'fly'; G.ents.push(bt); } }
        if (e.st > .95) { e.fired = false; e.state = 'recover'; e.st = 0; e.rec = .4; }
        break;
      case 'recover':
        e.vx = approach(e.vx, 0, 1300 * dt); e.anim = 'idle'; e.st += dt;
        if (e.st >= e.rec) { e.state = 'stalk'; e.cd = rand(.35, .8) * (rage ? .55 : 1); }
        break;
      default: e.state = 'stalk'; e.cd = .5; e.alpha = 1; e.untouchable = false; e.tele = 0;
    }
  },
  draw(c, sx, sy, e) {
    if (e.tele > 0 && !e.dead) { c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(sx, 0, sx + e.dir * 460, 0); g.addColorStop(0, `rgba(255,40,60,${.5 * e.tele})`); g.addColorStop(1, 'rgba(255,40,60,0)'); c.fillStyle = g; c.fillRect(Math.min(sx, sx + e.dir * 460), sy - 62, 460, 44); c.globalCompositeOperation = 'source-over'; }
    shadow(c, sx, e.h, 18); drawHuman(c, sx, sy, e);
  },
};

/* ---------- THE VOIDSPAWN ---------- */
MOBS.rift = {
  base: { fam: 'void', hp: 40, atk: 0, def: 0, hw: 22, tall: 150, floaty: true, fixed: true, coin: [0, 0], blood: '#b070ff', life: 7.5, open: 0, made: 0 },
  ai(e, dt) {
    e.life -= dt; e.open = e.life < .4 ? e.life / .4 : Math.min(1, e.open + dt * 2.5);
    e.spawnT = (e.spawnT === undefined ? 1.2 : e.spawnT) - dt;
    const alive = G.ents.filter(x => x.kind === 'voidling' && !x.dead).length;
    if (e.spawnT <= 0 && e.made < 2 && alive < 4) { e.made++; e.spawnT = 2.2; const v = makeMob('voidling', e.x); v.state = 'chase'; v.cd = rand(.8, 1.4); v.open = 0; G.ents.push(v); sfx('teleport'); }
    if (e.life <= 0) e.remove = true;
  },
  onDie(e) { burst(e.x, GROUND - 80, 24, '#c090ff', { glow: '180,100,255', speed: 240 }); e.deadT = 5; },
  draw(c, sx, sy, e) { if (!e.dead) drawRift(c, sx, sy, e); },
};
MOBS.voidspawn = {
  base: { fam: 'void', name: 'The Voidspawn', boss: true, poiseMax: 170, hp: 1100, atk: 26, def: 15, speed: 30, hw: 58, tall: 240, floaty: true, coin: [0, 0], blood: '#b070ff', stun: 0, alpha: 1, phaseDone: 1, drainT: 0, last: '' },
  tick(e, dt) { if (e.stun > 0) { e.stun -= dt; e.vuln = 1.6; if (e.stun <= 0) e.vuln = 1; } },
  onBreak(e) { e.stun = 3; e.state = 'drift'; e.cd = 3.2; for (const x of G.ents) if (x.hazard) x.remove = true; },   // a full stagger meter exposes its core
  onDie(e) {
    for (const x of G.ents) { if ((x.kind === 'voidling' || x.kind === 'rift') && !x.dead) mobDie(x); if (x.hazard || x.proj) x.remove = true; }
    for (let i = 0; i < 8; i++) setTimeout(() => { if (G.boss === e || e.dead) { burst(e.x + rand(-60, 60), GROUND - rand(40, 220), 22, '#c090ff', { glow: '180,100,255', speed: 300 }); ringFx(e.x, GROUND - 130, 'rgba(210,150,255,.9)', 120 + i * 30, .6); shake(6); sfx('void'); } }, i * 220);
  },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), b = G.bounds, phase = e.hp < e.maxHp * .33 ? 3 : e.hp < e.maxHp * .66 ? 2 : 1;
    if (e.state === 'idle') { e.anim = 'idle'; if (!e.passive) { e.state = 'drift'; e.cd = 1.6; } return; }
    // touching the mass drains life
    e.drainT -= dt;
    if (ad < 50 && p.h < 210 && e.drainT <= 0 && e.stun <= 0 && playerHurt(p, 12, e.x, { kb: 340, unblockable: true })) e.drainT = .8;
    if (e.stun > 0) { e.vx = approach(e.vx, 0, 200 * dt); return; }
    const sweep = (charge) => { e.state = 'sweep'; e.st = 0; e.charge = charge; e.fired = false; sfx('void'); };
    switch (e.state) {
      case 'drift':
        e.dir = sgn(dx); e.cd -= dt;
        e.vx = approach(e.vx, ad > 150 ? e.dir * e.speed * (1 + phase * .25) : 0, 120 * dt);
        if (phase > e.phaseDone) { e.phaseDone = phase; e.state = 'warp'; e.st = 0; sfx('void'); }
        else if (e.cd <= 0) {
          const opts = ['tendrils', 'orbs'];
          if (!G.ents.some(x => x.kind === 'rift') && G.ents.filter(x => x.kind === 'voidling' && !x.dead).length < 3) opts.push('rift');
          if (phase >= 2) opts.push('sweep');
          let pickd = pick(opts); if (pickd === e.last) pickd = pick(opts);
          e.last = pickd; e.st = 0; e.n = 0;
          if (pickd === 'sweep') sweep(.9); else e.state = pickd;
        }
        break;
      case 'tendrils':
        e.st += dt; e.vx = approach(e.vx, 0, 200 * dt);
        if (e.st >= e.n * .4 && e.n < 3 + phase) { e.n++; G.ents.push(makeTendril(clamp(p.x + p.vx * .32 + rand(-14, 14), b.l + 20, b.r - 20), e.atk)); }
        if (e.st > (3 + phase) * .4 + .5) { e.state = 'drift'; e.cd = 2.1 - phase * .35; }
        break;
      case 'orbs':
        e.st += dt; e.vx = approach(e.vx, 0, 200 * dt);
        if (e.st >= .3 + e.n * .5 && e.n < 2 + phase) {
          e.n++; sfx('teleport');
          const sh = 130, ddx = p.x - e.x, ddh = (p.h + 34) - sh, T = Math.max(.5, Math.hypot(ddx, ddh) / 300);
          G.ents.push(makeProj({ kind: 'orb', x: e.x + sgn(ddx) * 30, h: sh, vx: ddx / T, vh: ddh / T, dmg: 17, life: T + 1.2, r: 11 }));
        }
        if (e.st > .3 + (2 + phase) * .5 + .4) { e.state = 'drift'; e.cd = 1.9 - phase * .3; }
        break;
      case 'rift': {
        const count = phase >= 3 ? 2 : 1;
        for (let i = 0; i < count; i++) { let x = rand(b.l + 80, b.r - 80), tries = 0; while ((Math.abs(x - p.x) < 180 || Math.abs(x - e.x) < 130) && tries++ < 20) x = rand(b.l + 80, b.r - 80); G.ents.push(makeMob('rift', x)); }
        sfx('void'); e.state = 'drift'; e.cd = 2.4;
        break;
      }
      case 'sweep': {
        e.st += dt; e.vx = approach(e.vx, 0, 200 * dt); if (e.st < e.charge) shake(1.5);
        if (!e.fired && e.st >= e.charge) {
          e.fired = true;
          for (const d of [-1, 1]) {
            const n = Math.floor((d < 0 ? e.x - b.l : b.r - e.x) / 62); if (n < 2) continue;
            const gap = n > 5 ? randi(2, n - 3) : -9;
            for (let i = 1; i <= n; i++) { if (i === gap || i === gap + 1) continue; G.ents.push(makeTendril(e.x + d * (40 + i * 62), e.atk, i * .085)); }
          }
          e.sweepEnd = e.st + 2.3;
        }
        if (e.fired && e.st >= e.sweepEnd) { e.stun = 2.8; e.state = 'drift'; e.cd = 3.2; floatText(e.x, GROUND - 270, 'Its core is exposed!', '#f0c0ff', 16); }
        break;
      }
      case 'warp':
        e.st += dt; e.vx = approach(e.vx, 0, 300 * dt); G.warp = Math.min(1, e.st / 1.0); shake(2.5);
        if (e.st >= 1.1) {
          const mid = (b.l + b.r) / 2; G.flashWhite = .5; G.warp = 0; shake(12); sfx('thud');
          e.x = p.x < mid ? b.r - 150 : b.l + 150; p.x = clamp(mid + sgn(mid - e.x) * 60, b.l + 30, b.r - 30); p.vx = 0;
          for (const x of G.ents) if (x.hazard || x.proj) x.remove = true;
          floatText(p.x, GROUND - 120, 'Reality folds...', '#e0c0ff', 16);
          sweep(1.0);
        }
        break;
      default: e.state = 'drift'; e.cd = 1;
    }
  },
  draw(c, sx, sy, e) { drawVoidspawn(c, sx, sy, e); },
};

/* ============================================================
   SIDE CONTRACTS — three optional hunts from the notice boards
   ============================================================ */

/* ---------- GREYMAW, the black wolf (Hollow Wood) ---------- */
MOBS.greymaw = {
  base: { fam: 'beast', name: 'Greymaw', boss: true, poiseMax: 90, hp: 300, atk: 19, def: 5, speed: 200, hw: 34, tall: 60, coin: [0, 0], blood: '#6a1010', scale: 1.6, col: '#17181d', col2: '#0b0c0f' },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), rage = e.hp < e.maxHp * .5, b = G.bounds;
    switch (e.state) {
      case 'idle': e.anim = e.idleAnim || 'idle'; if (!e.passive) { e.idleAnim = null; e.state = 'prowl'; e.cd = .8; } break;
      case 'prowl':
        e.dir = sgn(dx); e.cd -= dt;
        if (ad > 240) { e.vx = approach(e.vx, e.dir * e.speed, 1000 * dt); e.anim = 'run'; e.runPh += dt * 14; }
        else if (ad < 120 && e.cd > .25) { e.vx = approach(e.vx, -e.dir * e.speed * .5, 900 * dt); e.anim = 'run'; e.runPh += dt * 10; }
        else { e.vx = approach(e.vx, 0, 1100 * dt); e.anim = 'idle'; }
        if (!e.howled && rage) { e.howled = true; e.state = 'howl'; e.st = 0; sfx('howl'); }
        else if (e.cd <= 0) { e.st = 0; if (ad < 126) e.state = 'biteWind'; else { e.state = 'crouch'; sfx('growl'); } }
        break;
      case 'biteWind':
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 1200 * dt); e.st += dt; e.anim = 'crouch';
        if (e.st >= .34) { e.state = 'bite'; e.st = 0; e.didHit = false; e.vx = e.dir * 280; sfx('heavy'); }
        break;
      case 'bite':
        e.st += dt; e.anim = 'run'; e.runPh += dt * 20; e.vx = approach(e.vx, 0, 800 * dt);
        if (!e.didHit && e.st < .17 && tryHitPlayer(e, 92, e.atk, { top: 76 })) e.didHit = true;
        if (e.st > .5) { e.state = 'prowl'; e.cd = rand(.5, 1.0) * (rage ? .6 : 1); }
        break;
      case 'crouch':
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 1200 * dt); e.st += dt; e.anim = 'crouch';
        if (e.st > (rage ? .4 : .54)) { const T = .62; e.state = 'leap'; e.st = 0; e.didHit = false; e.vx = clamp(dx / T, -640, 640); e.vh = GRAV * T / 2; }
        break;
      case 'leap':
        e.st += dt; e.anim = 'leap'; e.ap = Math.min(1, e.st / .6);
        if (!e.didHit && Math.abs(p.x - e.x) < 40 + p.hw && Math.abs(p.h - e.h) < 62 && playerHurt(p, e.atk * 1.15, e.x, { kb: 300 })) e.didHit = true;
        if (e.h <= 0 && e.st > .12) { dustFx(e.x, 8); shake(4); e.state = 'recover'; e.st = 0; e.rec = rage ? .45 : .72; }
        break;
      case 'recover':
        e.vx = approach(e.vx, 0, 1100 * dt); e.anim = 'idle'; e.st += dt;
        if (e.st >= e.rec) { e.state = 'prowl'; e.cd = rand(.4, .9) * (rage ? .6 : 1); }
        break;
      case 'howl':
        e.vx = approach(e.vx, 0, 1200 * dt); e.anim = 'howl'; e.st += dt; shake(1.2);
        if (!e.summoned && e.st > .7) { e.summoned = true; for (const x of [b.l + 40, b.r - 40]) { const w = makeMob('wolf', x); w.state = 'chase'; w.cd = rand(.6, 1.4); G.ents.push(w); dustFx(x, 8); } }
        if (e.st >= 1.4) { e.state = 'prowl'; e.cd = .5; }
        break;
      default: e.state = 'prowl'; e.cd = .5;
    }
  },
  draw(c, sx, sy, e) { shadow(c, sx, e.h, 42); drawWolf(c, sx, sy, e); },
};

/* ---------- THE GRAVEMOTHER (Trade Road) ---------- */
MOBS.gravemother = {
  base: { fam: 'dead', name: 'The Gravemother', boss: true, poiseMax: 110, hp: 360, atk: 21, def: 10, speed: 76, hw: 24, tall: 100, coin: [0, 0], blood: '#3c5a2a', look: LOOKS.gravemother, graves: [] },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), rage = e.hp < e.maxHp * .5, b = G.bounds;
    switch (e.state) {
      case 'idle': e.anim = e.idleAnim || 'idle'; if (!e.passive) { e.idleAnim = null; e.state = 'stalk'; e.cd = .9; } break;
      case 'stalk':
        e.dir = sgn(dx); e.cd -= dt;
        if (ad > 96) { e.vx = approach(e.vx, e.dir * e.speed * (rage ? 1.3 : 1), 600 * dt); e.anim = 'run'; e.runPh += e.speed * dt * .06; }
        else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; }
        if (!e.called && rage) { e.called = true; e.state = 'screech'; e.st = 0; sfx('scream'); }
        else if (e.cd <= 0) { e.st = 0; if (ad < 116) e.state = Math.random() < .65 ? 'clawWind' : 'slamWind'; else if (Math.random() < .6) e.state = 'slamWind'; else e.cd = .6; }
        break;
      case 'clawWind':
        e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / .55);
        if (e.st >= .55) { e.state = 'claw'; e.st = 0; e.didHit = false; e.vx = e.dir * 210; sfx('heavy'); }
        break;
      case 'claw':
        e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .14); e.vx = approach(e.vx, 0, 800 * dt);
        if (!e.didHit && e.st < .18 && tryHitPlayer(e, 108, e.atk, { top: 96 })) e.didHit = true;
        if (e.st > .3 + (rage ? .5 : .75)) { e.state = 'stalk'; e.cd = rand(.5, 1.0); }
        break;
      case 'slamWind':
        e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'howl';
        if (e.st >= .75) {
          e.state = 'slam'; e.st = 0; sfx('thud'); shake(8); dustFx(e.x - 30, 6); dustFx(e.x + 30, 6);
          if (ad < 74 && p.h < 26) playerHurt(p, e.atk, e.x, { kb: 300 });
          for (const d of [-1, 1]) G.ents.push(makeProj({ kind: 'wave', x: e.x + d * 34, h: 0, vx: d * 300, dmg: 18, life: 2.6, col: 'rgba(200,235,160,.9)', rgb: '170,230,120' }));
        }
        break;
      case 'slam':
        e.st += dt; e.anim = 'crouch';
        if (e.st > (rage ? .6 : .9)) { e.state = 'stalk'; e.cd = rand(.6, 1.1); }
        break;
      case 'screech':
        e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'howl'; shake(1.5);
        if (!e.raised && e.st > .7) {
          e.raised = true;
          for (const gx of e.graves) { const x = clamp(gx, b.l + 30, b.r - 30), g = makeMob('ghoul', x); g.fromGrave = true; g.state = 'chase'; g.cd = rand(.8, 1.4); G.ents.push(g); dustFx(x, 10); burst(x, GROUND - 6, 10, '#2a2226', { speed: 120 }); }
        }
        if (e.st >= 1.3) { e.state = 'stalk'; e.cd = .6; }
        break;
      default: e.state = 'stalk'; e.cd = .5;
    }
  },
  onDie() { for (const x of G.ents) if (x.fromGrave && !x.dead) mobDie(x); },   // the ghouls she raised fall with her
  draw(c, sx, sy, e) { shadow(c, sx, e.h, 32); drawHuman(c, sx, sy, e); },
};

/* ---------- THE VOID WOUND (beneath Harrowmere) ---------- */
MOBS.wound = {
  base: { fam: 'void', name: 'The Void Wound', boss: true, hp: 210, atk: 16, def: 0, hw: 36, tall: 230, floaty: true, fixed: true, coin: [0, 0], blood: '#b070ff', open: 1, scale: 1.7 },
  ai(e, dt, p) {
    if (e.state === 'idle') { if (!e.passive) { e.state = 'active'; e.spawnT = 1.4; e.orbT = 2.4; e.tenT = 3; } return; }
    const half = e.hp < e.maxHp * .5;
    e.spawnT -= dt; e.orbT -= dt; e.tenT -= dt;
    if (e.spawnT <= 0) {
      e.spawnT = half ? 3.4 : 4.6;
      if (G.ents.filter(x => x.kind === 'voidling' && !x.dead).length < 3) { const v = makeMob('voidling', e.x + sgn(p.x - e.x) * 30); v.state = 'chase'; v.cd = rand(.8, 1.4); v.open = 0; G.ents.push(v); sfx('teleport'); }
    }
    if (e.orbT <= 0) {
      e.orbT = half ? 2.0 : 2.9; sfx('teleport');
      const sh = 120, ddx = p.x - e.x, ddh = (p.h + 34) - sh, T = Math.max(.5, Math.hypot(ddx, ddh) / 280);
      G.ents.push(makeProj({ kind: 'orb', x: e.x + sgn(ddx) * 20, h: sh, vx: ddx / T, vh: ddh / T, dmg: 15, life: T + 1, r: 11 }));
    }
    if (half && e.tenT <= 0) { e.tenT = 3.4; G.ents.push(makeTendril(clamp(p.x + p.vx * .3, G.bounds.l + 20, G.bounds.r - 20), e.atk)); }
  },
  onDie(e) {
    for (const x of G.ents) { if (x.kind === 'voidling' && !x.dead) mobDie(x); if (x.hazard || x.proj) x.remove = true; }
    burst(e.x, GROUND - 130, 40, '#c090ff', { glow: '180,100,255', speed: 320 }); ringFx(e.x, GROUND - 130, 'rgba(210,150,255,.9)', 180, .7); shake(8); sfx('void');
  },
  draw(c, sx, sy, e) { if (!e.dead) drawRift(c, sx, sy, e); },
};

/* ============================================================
   MORE CREATURES — extra enemy kinds for variety
   ============================================================ */

/* ---------- Wisp: a marsh light that spits sparks from a distance (parry one and it flies back) ---------- */
function wispAI(e, dt, p) {
  const dx = p.x - e.x, ad = Math.abs(dx);
  switch (e.state) {
    case 'idle': e.anim = 'idle'; e.vx = approach(e.vx, 0, 200 * dt); if (!e.passive && ad < e.aggro && !p.dead) { e.state = 'chase'; e.cd = rand(.8, 1.6); } break;
    case 'chase':
      if (p.dead) { e.state = 'idle'; break; }
      e.dir = sgn(dx); e.cd -= dt; e.anim = 'idle';
      e.vx = approach(e.vx, (ad > 320 ? e.dir : ad < 200 ? -e.dir : Math.sin(e.t * 1.3 + e.seed)) * e.speed, 260 * dt);
      if (ad < 430 && e.cd <= 0) { e.state = 'windup'; e.st = 0; }
      break;
    case 'windup':
      e.vx = approach(e.vx, 0, 300 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / .6);
      if (e.st >= .6) {
        const sh = 52, ddx = p.x - e.x, ddh = (p.h + 36) - sh, T = Math.max(.5, Math.hypot(ddx, ddh) / 250);
        G.ents.push(makeProj({ kind: 'spark', x: e.x + e.dir * 10, h: sh, vx: ddx / T, vh: ddh / T, dmg: e.atk, life: T + 1, r: 8 }));
        sfx('teleport'); e.anim = 'idle'; e.state = 'chase'; e.cd = rand(1.8, 2.6);
      }
      break;
    default: e.state = 'chase'; e.cd = 1;
  }
}
MOBS.wisp = {
  base: { fam: 'dead', hp: 22, atk: 10, def: 0, speed: 72, aggro: 520, hw: 13, tall: 72, floaty: true, coin: [1, 3], blood: '#bff7e0' },
  ai: wispAI,
  onDie(e) { burst(e.x, GROUND - 52, 16, '#d8ffe8', { glow: '150,255,210', speed: 200, g: 0 }); e.deadT = 5; },
  draw(c, sx, sy, e) { if (!e.dead) drawWisp(c, sx, sy, e); },
};

/* ---------- Bog brute: slow, heavy, and it shrugs off light hits ---------- */
MOBS.brute = { base: { fam: 'dead', hp: 150, atk: 20, def: 8, speed: 52, aggro: 440, range: 64, windup: .7, recover: .8, cdBase: 1.0, lunge: 160, hw: 18, tall: 84, coin: [6, 12], blood: '#3c5a2a', look: LOOKS.brute, sturdy: true }, ai: meleeAI, draw: drawRig };

/* ---------- Bone guard: the dead with a shield. Light strikes from the front bounce off ---------- */
MOBS.boneguard = { base: { fam: 'dead', hp: 70, atk: 17, def: 10, speed: 72, aggro: 460, range: 58, windup: .5, recover: .6, cdBase: .9, lunge: 150, hw: 13, tall: 68, coin: [4, 8], blood: '#cfc8b4', look: LOOKS.boneguard, shield: true }, ai: meleeAI, draw: drawRig };

/* ---------- Rime wolf and the Rimebound: beasts and the dead of the Frostfang Pass ---------- */
MOBS.rimewolf = { base: { fam: 'beast', hp: 46, atk: 16, def: 0, speed: 182, aggro: 500, hw: 22, tall: 40, coin: [0, 0], blood: '#6a1010', col: '#b9d8e4', col2: '#7fa9bb' }, ai: wolfAI, draw: MOBS.wolf.draw };
MOBS.rimebound = { base: { fam: 'dead', hp: 64, atk: 18, def: 6, speed: 58, aggro: 480, range: 52, windup: .55, recover: .6, cdBase: .8, lunge: 130, hw: 13, tall: 64, coin: [2, 6], blood: '#bfe8f4', look: LOOKS.rimebound }, ai: meleeAI, draw: drawRig };

/* ---------- Void stalker: steps out of the air behind you ---------- */
function stalkerAI(e, dt, p) {
  const dx = p.x - e.x, ad = Math.abs(dx), b = G.bounds;
  switch (e.state) {
    case 'idle': e.anim = 'idle'; e.vx = approach(e.vx, 0, 500 * dt); if (!e.passive && ad < e.aggro && !p.dead) { e.state = 'chase'; e.cd = rand(.8, 1.6); } break;
    case 'chase':
      if (p.dead) { e.state = 'idle'; break; }
      e.alpha = 1; e.untouchable = false; e.dir = sgn(dx); e.cd -= dt;
      if (ad > 80) { e.vx = approach(e.vx, e.dir * e.speed, 600 * dt); e.anim = 'walk'; e.runPh += e.speed * dt * .06; } else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; }
      if (e.cd <= 0) { e.st = 0; if (ad < 74) e.state = 'windup'; else if (ad < 460) { e.state = 'fade'; sfx('teleport'); } else e.cd = .5; }
      break;
    case 'fade':
      e.st += dt; e.alpha = Math.max(0, 1 - e.st / .3); e.untouchable = true; e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle';
      if (e.st >= .5) { e.x = clamp(p.x - p.dir * 74, b.l + 30, b.r - 30); e.dir = sgn(p.x - e.x); e.state = 'appear'; e.st = 0; sfx('teleport'); }
      break;
    case 'appear':
      e.st += dt; e.alpha = Math.min(1, e.st / .26); e.dir = sgn(dx);
      if (Math.random() < .5) addFx({ x: e.x + rand(-12, 12), y: GROUND - rand(10, 80), life: .35, size: 4, col: '#1a0630', g: 0 });
      if (e.st >= .26) { e.alpha = 1; e.untouchable = false; e.state = 'windup'; e.st = 0; }
      break;
    case 'windup':
      e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / .4);
      if (e.st >= .4) { e.state = 'strike'; e.st = 0; e.didHit = false; e.vx = e.dir * 170; sfx('swing'); }
      break;
    case 'strike':
      e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .13); e.vx = approach(e.vx, 0, 700 * dt);
      if (!e.didHit && e.st < .17 && tryHitPlayer(e, 74, e.atk, { top: 90 })) e.didHit = true;
      if (e.st >= .9) { e.state = 'chase'; e.cd = rand(1.8, 3.0); }
      break;
    default: e.state = 'chase'; e.cd = 1; e.alpha = 1; e.untouchable = false;
  }
}
MOBS.stalker = { base: { fam: 'void', hp: 70, atk: 19, def: 0, speed: 95, aggro: 520, hw: 13, tall: 82, coin: [2, 6], blood: '#8a40e0', look: LOOKS.stalker, alpha: 1 }, ai: stalkerAI, draw: drawRig };

/* ---------- THE LANTERN MAN — the first boss, out on the Mistmoor ---------- */
MOBS.lanternman = {
  base: { fam: 'dead', name: 'The Lantern Man', boss: true, poiseMax: 100, hp: 330, atk: 16, def: 5, speed: 66, hw: 16, tall: 98, coin: [0, 0], blood: '#9fd8b0', look: LOOKS.lantern, alpha: 1, lit: true },
  ai(e, dt, p) {
    const dx = p.x - e.x, ad = Math.abs(dx), rage = e.hp < e.maxHp * .5, b = G.bounds;
    switch (e.state) {
      case 'idle': e.anim = 'idle'; if (!e.passive) { e.state = 'stalk'; e.cd = 1; } break;
      case 'stalk':
        e.dir = sgn(dx); e.cd -= dt; e.lit = true; e.alpha = 1; e.untouchable = false;
        if (ad > 100) { e.vx = approach(e.vx, e.dir * e.speed * (rage ? 1.3 : 1), 500 * dt); e.anim = 'walk'; e.runPh += e.speed * dt * .055; } else { e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle'; }
        if (!e.called && rage) { e.called = true; e.state = 'call'; e.st = 0; sfx('wail'); }
        else if (e.cd <= 0) { e.st = 0; e.n = 0; if (ad < 116) { e.state = 'swingWind'; e.wu = .52; } else e.state = Math.random() < .6 ? 'sparks' : 'snuff'; if (e.state === 'snuff') sfx('teleport'); }
        break;
      case 'swingWind':
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'windup'; e.ap = Math.min(1, e.st / e.wu);
        if (e.st >= e.wu) { e.state = 'swing'; e.st = 0; e.didHit = false; e.vx = e.dir * 190; sfx('heavy'); }
        break;
      case 'swing':
        e.st += dt; e.anim = 'strike'; e.ap = Math.min(1, e.st / .14); e.vx = approach(e.vx, 0, 700 * dt);
        if (!e.didHit && e.st < .18 && tryHitPlayer(e, 106, e.atk, { top: 96 })) e.didHit = true;
        if (e.st > .3 + (rage ? .5 : .8)) { e.state = 'stalk'; e.cd = rand(.5, 1.0); }
        break;
      case 'sparks':       // three sparks shaken from the lantern, one after another
        e.dir = sgn(dx); e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'cast'; e.ap = Math.min(1, e.st / .4);
        if (e.st >= .45 + e.n * .22 && e.n < (rage ? 4 : 3)) {
          e.n++; sfx('fire');
          const sh = 78, ddx = p.x - e.x, ddh = (p.h + 36) - sh, T = Math.max(.5, Math.hypot(ddx, ddh) / 270);
          G.ents.push(makeProj({ kind: 'spark', x: e.x + e.dir * 30, h: sh, vx: ddx / T, vh: ddh / T, dmg: e.atk * .7, life: T + 1, r: 8 }));
        }
        if (e.st > 1.6) { e.state = 'stalk'; e.cd = rand(.7, 1.2); }
        break;
      case 'snuff':        // the light goes out; he is somewhere else when it returns
        e.st += dt; e.lit = false; e.alpha = Math.max(0, 1 - e.st / .4); e.untouchable = true; e.vx = approach(e.vx, 0, 900 * dt); e.anim = 'idle';
        if (e.st >= .8) { const side = p.x < (b.l + b.r) / 2 ? 1 : -1; e.x = clamp(p.x + side * 150, b.l + 40, b.r - 40); e.dir = sgn(p.x - e.x); e.state = 'relight'; e.st = 0; sfx('fire'); }
        break;
      case 'relight':
        e.st += dt; e.lit = true; e.alpha = Math.min(1, e.st / .35); e.dir = sgn(dx);
        if (e.st >= .35) { e.alpha = 1; e.untouchable = false; e.state = 'swingWind'; e.st = 0; e.wu = .4; }
        break;
      case 'call':
        e.vx = approach(e.vx, 0, 900 * dt); e.st += dt; e.anim = 'howl'; shake(1.2);
        if (!e.summoned && e.st > .7) { e.summoned = true; for (const x of [b.l + 60, b.r - 60]) { const w = makeMob('wisp', x); w.state = 'chase'; w.cd = rand(1, 2); G.ents.push(w); } }
        if (e.st >= 1.3) { e.state = 'stalk'; e.cd = .6; }
        break;
      default: e.state = 'stalk'; e.cd = .5; e.alpha = 1; e.untouchable = false; e.lit = true;
    }
  },
  onDie(e) { e.lit = false; for (const x of G.ents) { if (x.kind === 'wisp' && !x.dead) mobDie(x); if (x.proj) x.remove = true; } },
  draw(c, sx, sy, e) { shadow(c, sx, e.h, 22); drawHuman(c, sx, sy, e); },
};
