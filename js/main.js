'use strict';
/* ============================================================
   main.js — title screen, menus, game over, ending, main loop
   ============================================================ */

const AUTHOR = 'AGRobatix';
G.rt = 0;
const titleHunter = { dir: 1, t: 0, anim: 'idle', ap: 0, look: LOOKS.hunter, vx: 0, flash: 0 };
let prevState = 'title';

function startNewGame(name, rec) {
  G.S = newStats(name); G.flags = { h_v3: 1 }; G.over = null; G.ending = null;
  G.S.diff = G.pendingDiff || 'hunter';
  if (rec) {      // New Hunt +: keep everything you carried and earned, and face tougher creatures
    Object.assign(G.S, { atk: rec.atk, def: rec.def, maxHp: rec.maxHp, hp: rec.maxHp, maxSta: rec.maxSta, sta: rec.maxSta, up: rec.up || {}, plus: rec.plus });
    if (rec.pot) G.S.pot = Object.assign({ vit: 0, tem: 0, foc: 0 }, rec.pot); if (rec.oil) G.S.oil = Object.assign({ beast: 0, dead: 0, void: 0 }, rec.oil); if (typeof rec.coins === 'number') G.S.coins = rec.coins;
    if (DIFFS[rec.diff]) G.S.diff = rec.diff;
  }
  G.state = 'play'; G.fade = 1;
  loadLevel('moor', 'start');
  G.transition = { phase: 'in', t: 0 };
}
function toTitle() { G.epoch++; cancelAll(); G.cutN = 0; G.state = 'title'; G.menuSel = 0; G.transition = null; G.fade = 0; G.boss = null; Music.set('title'); }

function menuInput(n, y0, dy, x0 = 300, x1 = 660) {
  let act = false;
  if (tapped('up')) { G.menuSel = (G.menuSel + n - 1) % n; sfx('select'); }
  if (tapped('down')) { G.menuSel = (G.menuSel + 1) % n; sfx('select'); }
  for (let i = 0; i < n; i++) {
    const y = y0 + i * dy;
    if (Mouse.x > x0 && Mouse.x < x1 && Mouse.y > y - dy * .65 && Mouse.y < y + dy * .35) { if (Mouse.x !== G.mmx || Mouse.y !== G.mmy) G.menuSel = i; if (Mouse.clicked) { G.menuSel = i; act = true; } }
  }
  G.mmx = Mouse.x; G.mmy = Mouse.y;
  if (Keys.pressed['Enter'] || Keys.pressed['Space'] || Keys.pressed['KeyE'] || Keys.pressed['KeyJ'] || Keys.pressed['KeyZ']) act = true;
  if (act) sfx('confirm');
  return act;
}
function drawMenu(c, items, y0, dy, cx = W / 2, size = 22) {
  c.textAlign = 'center';
  items.forEach((it, i) => {
    const sel = i === G.menuSel, y = y0 + i * dy;
    c.font = font(size, sel ? 'bold' : '');
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(it, cx + 1, y + 1);
    c.fillStyle = sel ? '#f3e2b0' : '#a9a28e'; c.fillText(it, cx, y);
    if (sel) { const w = c.measureText(it).width; c.fillStyle = '#c4a460'; poly(c, [cx - w / 2 - 22, y - 7, cx - w / 2 - 12, y - 12, cx - w / 2 - 12, y - 2], '#c4a460'); poly(c, [cx + w / 2 + 22, y - 7, cx + w / 2 + 12, y - 12, cx + w / 2 + 12, y - 2], '#c4a460'); }
  });
}

/* ---------- title ---------- */
function titleItems() {
  const items = ['New Hunt', 'Save code', 'Sound', 'Controls', 'Credits'], rec = readPlus();
  if (rec) items.splice(1, 0, 'New Hunt +');
  if (Save.read()) items.unshift('Continue');
  return items;
}
const TITLE_Y = 306, titleStep = items => items.length > 6 ? 28 : 32;     // a full menu (seven lines) is set a little closer
function updateTitle(dt) {
  const items = titleItems();
  if (G.menuSel >= items.length) G.menuSel = 0;
  if (menuInput(items.length, TITLE_Y, titleStep(items), 500, 900)) {
    const it = items[G.menuSel];
    if (it === 'Continue') { if (!loadSave()) G.toast('No save file found.'); }
    else if (it === 'New Hunt') { G.state = 'name'; G.nameText = ''; G.nameErr = ''; }
    else if (it === 'New Hunt +') { const rec = readPlus(); G.pendingDiff = DIFFS[rec.diff] ? rec.diff : 'hunter'; startNewGame(rec.name, rec); }      // the harder hunt starts at once, on the difficulty you finished with
    else if (it === 'Save code') Transfer.open();
    else if (it === 'Credits') { prevState = 'title'; G.state = 'credits'; }
    else if (it === 'Sound') { prevState = 'title'; G.state = 'sound'; G.menuSel = 0; }
    else { prevState = 'title'; G.state = 'controls'; }
    Keys.pressed = {}; Mouse.clicked = false;
  }
}
function drawTitleScene(c) {
  const th = getTheme('moor'), camX = G.rt * 14; STEADY = true;
  drawBackdrop(c, th, camX); drawFog(c, th, camX, G.rt, .8, 1); drawGround(c, th, camX);
  c.save(); c.translate(250, GROUND); PROPS.campfire(c, { lit: true }, G.rt); c.restore();
  titleHunter.t = G.rt; shadow(c, 170, 0, 16); drawHuman(c, 170, GROUND, titleHunter);
  drawAmbient(c, th, camX, G.rt); drawFog(c, th, camX * 1.2 + 400, G.rt * 1.3, .6, 1); drawForeground(c, th, camX);
  c.fillStyle = 'rgba(6,8,6,.38)'; c.fillRect(0, 0, W, H);
  drawVignette(c);
}
function drawTitleText(c) {
  c.textAlign = 'center';
  try { c.letterSpacing = '4px'; } catch (e) { }
  c.font = font(44, 'bold'); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillText('CURSED CREATURES', 643, 173);
  const g = c.createLinearGradient(0, 120, 0, 180); g.addColorStop(0, '#f6ecc9'); g.addColorStop(1, '#b89a56'); c.fillStyle = g; c.fillText('CURSED CREATURES', 640, 170);
  try { c.letterSpacing = '8px'; } catch (e) { }
  c.font = font(20, 'italic'); c.fillStyle = '#d6cba8'; c.fillText('TALES OF THE HUNT', 640, 212);
  try { c.letterSpacing = '0px'; } catch (e) { }
  c.fillStyle = '#c4a460'; c.fillRect(480, 228, 320, 1.5); poly(c, [640, 222, 647, 229, 640, 236, 633, 229], '#c4a460');
}
const COVER_MODE = /[?&]cover/.test(location.search);      // index.html?cover shows only the title art, for making a preview image
function drawTitle(c) {
  drawTitleScene(c); drawTitleText(c);
  if (COVER_MODE) { c.font = font(15, 'italic'); c.fillStyle = 'rgba(214,203,168,.8)'; c.textAlign = 'center'; c.fillText('a game by ' + AUTHOR, 640, 262); return; }
  const items = titleItems(); drawMenu(c, items, TITLE_Y, titleStep(items), 640, 20);
  c.font = font(12, 'italic'); c.fillStyle = 'rgba(214,203,168,.55)'; c.textAlign = 'center'; c.fillText('a game by ' + AUTHOR, 640, 250);
  Touch.draw(c);
  c.font = font(12); c.fillStyle = 'rgba(214,203,168,.6)'; c.textAlign = 'center';
  c.fillText(Touch.on ? 'Tap to choose' : 'Arrow keys or mouse to choose  ·  Enter to confirm  ·  M mutes  ·  F fullscreen', 640, 506);
  if (G.toastMsg) { c.font = font(14, 'italic'); c.fillStyle = '#e2c27a'; c.fillText(G.toastMsg.text, 640, 528); }
}

/* ---------- naming your hunter ---------- */
function updateName() {
  for (const k of Keys.typed) {
    if (k === 'Backspace') G.nameText = G.nameText.slice(0, -1);
    else if (k === 'Enter') {
      const n = G.nameText.trim();
      const name = n === '' ? 'Hunter' : n[0].toUpperCase() + n.slice(1);       // an empty name becomes "Hunter"
      sfx('confirm'); Keys.pressed = {}; G.pending = { name, rec: null }; G.state = 'diff'; G.menuSel = 1; return;
    } else if (/^[a-zA-Z]$/.test(k)) { if (G.nameText.length < 14) { G.nameText += k; G.nameErr = ''; sfx('text'); } }
    else if (/^[0-9]$/.test(k)) G.nameErr = 'Enter the name in letters.';
  }
  if (Keys.pressed['Escape']) { G.state = 'title'; }
}
function drawName(c) {
  drawTitleScene(c); drawTitleText(c);
  panel(c, 430, 290, 420, 150, .9);
  c.textAlign = 'center'; c.font = font(17); c.fillStyle = '#ece6d6'; c.fillText('Enter the name of your monster hunter:', 640, 328);
  c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(500, 346, 280, 40); c.strokeStyle = 'rgba(196,164,96,.7)'; c.strokeRect(500.5, 346.5, 279, 39);
  c.font = font(22, 'bold'); c.fillStyle = '#f3e2b0';
  if (Touch.on && !G.nameText) { c.font = font(15, 'italic'); c.fillStyle = 'rgba(214,203,168,.6)'; c.fillText('tap here to type a name', 640, 372); }
  else { const txt = G.nameText + (Math.floor(G.rt * 2) % 2 ? '|' : ' '); c.fillText(txt, 640, 374); }
  c.font = font(13, 'italic'); c.fillStyle = G.nameErr ? '#e07a6a' : 'rgba(214,203,168,.7)';
  if (Touch.on) {
    c.fillStyle = 'rgba(196,164,96,.22)'; c.fillRect(550, 398, 180, 34); c.strokeStyle = 'rgba(226,194,122,.9)'; c.lineWidth = 1.5; c.strokeRect(550.5, 398.5, 179, 33);
    c.font = font(16, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText(G.nameText ? 'Continue' : 'Continue as Hunter', 640, 421);
  } else c.fillText(G.nameErr || 'Press Enter to continue  ·  leave it empty to be called Hunter', 640, 418);
}

/* ---------- choosing a difficulty ---------- */
function updateDiff() {
  if (Keys.pressed['Escape']) { G.state = 'title'; G.menuSel = 0; return; }
  if (menuInput(3, 338, 34, 440, 840)) {
    G.pendingDiff = DIFF_KEYS[G.menuSel]; const P = G.pending; G.pending = null;
    Keys.pressed = {}; Mouse.clicked = false; startNewGame(P.name, P.rec);
  }
}
function drawDiff(c) {
  drawTitleScene(c); drawTitleText(c);
  panel(c, 410, 270, 460, 210, .92);
  c.textAlign = 'center'; c.font = font(16); c.fillStyle = '#ece6d6'; c.fillText('How hard should the hunt be?', 640, 302);
  drawMenu(c, DIFF_KEYS.map(k => DIFFS[k].name), 338, 34, 640, 20);
  c.font = font(13, 'italic'); c.fillStyle = '#cfc8b4'; wrapText(c, DIFFS[DIFF_KEYS[G.menuSel]].desc, 410).forEach((l, i) => c.fillText(l, 640, 436 + i * 17));
  c.font = font(11, 'italic'); c.fillStyle = 'rgba(214,203,168,.55)'; c.fillText('You can change this later from the pause menu.', 640, 470);
}

/* ---------- credits ---------- */
function drawCredits(c) {
  drawTitleScene(c); c.fillStyle = 'rgba(4,5,8,.66)'; c.fillRect(0, 0, W, H);
  panel(c, 200, 70, 560, 400, .93);
  c.textAlign = 'center';
  c.font = font(30, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText('CURSED CREATURES', 480, 124);
  c.font = font(15, 'italic'); c.fillStyle = '#d6cba8'; c.fillText('Tales of the Hunt', 480, 150);
  c.fillStyle = '#c4a460'; c.fillRect(400, 166, 160, 1.5);
  c.font = font(13); c.fillStyle = '#9c957f'; c.fillText('A game by', 480, 204);
  c.font = font(26, 'bold'); c.fillStyle = '#e2c27a'; c.fillText(AUTHOR, 480, 236);
  c.font = font(14); c.fillStyle = '#cfc8b4';
  c.fillText('Story, world and design: ' + AUTHOR, 480, 284);
  c.fillText('Code, art and sound created with Claude,', 480, 314); c.fillText('an AI assistant made by Anthropic.', 480, 334);
  c.font = font(13, 'italic'); c.fillStyle = '#9c957f';
  c.fillText('Everything you see is drawn in code, and everything you hear is synthesised.', 480, 378);
  c.fillText('No image or audio files were used.', 480, 396);
  c.font = font(12, 'italic'); c.fillStyle = 'rgba(214,203,168,.65)'; c.fillText('Thank you for playing.  ·  ' + tk('Press any key to go back', 'Tap to go back'), 480, 446);
}

/* ---------- controls ---------- */
const CONTROLS = [
  ['A / D   or   ← →', 'Move'], ['W / Space / ↑', 'Jump'], ['J / Z / mouse click', 'Sword attack (press again to chain up to three strikes)'],
  ['Hold J / Z', 'Charge a heavy blow: knocks enemies down, staggers bosses'],
  ['S / ↓ (hold)', 'Block. Block just before a hit lands to parry it'],
  ['Attack in the air', 'Plunging strike that hits everything around you'],
  ['K / X', 'Dodge-roll: you cannot be hit while rolling'], ['Shift (hold)', 'Sprint. Uses stamina'], ['L / C', 'Ember glyph: a burst of fire that burns and staggers'],
  ['I / V', 'Ward glyph: absorbs the next blow'], ['1  2  3', 'Drink a potion'], ['4  5  6', 'Coat your blade with an oil (the dead, beasts, void things)'], ['E', 'Talk, examine, rest at campfires'],
  ['Esc / P', 'Pause'], ['M / F', 'Mute sound / fullscreen'],
];
const TOUCH_CONTROLS = [
  ['Drag on the left', 'Move. Drag further to sprint (uses stamina)'], ['Attack', 'Sword strike. Tap again to chain three; hold to charge'],
  ['Jump', 'Jump. Tap Attack in the air for a plunging strike'], ['Roll', 'Dodge-roll: you cannot be hit while rolling'],
  ['Block (hold)', 'Guard. Raise it just before a hit lands to parry'], ['Ember / Ward', 'Glyph buttons beside the attack buttons'],
  ['Quick buttons (top left)', 'Healing elixir and best oil, until you change them'], ['Pouch (top left)', 'Every potion and oil. Tap a quick button there to change it'],
  ['Use', 'Appears when you can talk, examine or rest'], ['II', 'Pause'],
];
function drawControls(c) {
  if (prevState === 'title') drawTitleScene(c); else { drawWorld(c); }
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
  panel(c, 150, 60, 660, 420, .93);
  c.textAlign = 'center'; c.font = font(24, 'bold'); c.fillStyle = '#e2c27a'; c.fillText('CONTROLS', 480, 102);
  (Touch.on ? TOUCH_CONTROLS : CONTROLS).forEach(([k, d], i) => {
    const y = Touch.on ? 142 + i * 29 : 124 + i * 21;
    c.textAlign = 'right'; c.font = font(15, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText(k, 372, y);
    c.textAlign = 'left'; c.font = font(15); c.fillStyle = '#cfc8b4'; c.fillText(d, 392, y);
  });
  c.textAlign = 'center'; c.font = font(13, 'italic'); c.fillStyle = 'rgba(214,203,168,.7)';
  if (!Touch.on) c.fillText('Gamepad: stick move · A jump · X attack · B roll · Y use · LB block · RB Ember · LT Ward · RT sprint', 480, 446);
  c.fillText(tk('Press any key to go back', 'Tap to go back'), 480, 466);
}

/* ---------- pause, game over, ending ---------- */
const pauseItems = () => ['Resume', 'Bestiary', 'Difficulty: ' + DIFFS[G.S.diff].name, 'Sound', 'Controls', 'Quit to title'];
function updatePause() {
  if (tapped('pause')) { G.state = 'play'; return; }
  const items = pauseItems();
  if (menuInput(items.length, 238, 31)) {
    const it = items[G.menuSel];
    if (it === 'Resume') G.state = 'play';
    else if (it === 'Quit to title') toTitle();
    else if (it.startsWith('Difficulty')) { G.S.diff = DIFF_KEYS[(DIFF_KEYS.indexOf(G.S.diff) + 1) % 3]; }     // applies to creatures met from now on
    else { prevState = 'pause'; G.state = it.toLowerCase(); G.menuSel = 0; }
    Keys.pressed = {}; Mouse.clicked = false;
  }
}

/* ---------- sound settings ---------- */
const SOUND_ROWS = [['music', 'Music'], ['sfx', 'Effects and ambience']];
function updateSound() {
  if (tapped('up')) { G.menuSel = (G.menuSel + 1) % 2; sfx('select'); }
  if (tapped('down')) { G.menuSel = (G.menuSel + 1) % 2; sfx('select'); }
  const key = SOUND_ROWS[G.menuSel][0];
  let d = (tapped('left') ? -1 : 0) + (tapped('right') ? 1 : 0);
  let onBar = false;
  if (Mouse.clicked) for (let i = 0; i < 2; i++) { const y = 236 + i * 74; if (Mouse.y > y - 30 && Mouse.y < y + 26 && Mouse.x > 330 && Mouse.x < 630) { onBar = true; G.menuSel = i; Sound.setVol(SOUND_ROWS[i][0], Math.round((Mouse.x - 330) / 30) / 10); sfx('coin'); } }
  if (d) { Sound.setVol(key, Sound.vol[key] + d * .1); sfx(key === 'music' ? 'confirm' : 'coin'); }
  if (Keys.pressed['Escape'] || Keys.pressed['Enter'] || Keys.pressed['KeyE'] || (Mouse.clicked && !onBar && Touch.on)) { G.state = prevState; G.menuSel = 0; Keys.pressed = {}; Mouse.clicked = false; }
}
function drawSound(c) {
  if (prevState === 'title') drawTitleScene(c); else drawWorld(c);
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
  panel(c, 270, 130, 420, 290, .94);
  c.textAlign = 'center'; c.font = font(24, 'bold'); c.fillStyle = '#e2c27a'; c.fillText('SOUND', 480, 174);
  SOUND_ROWS.forEach(([key, label], i) => {
    const y = 236 + i * 74, sel = i === G.menuSel, v = Sound.vol[key];
    c.textAlign = 'left'; c.font = font(15, sel ? 'bold' : ''); c.fillStyle = sel ? '#f3e2b0' : '#a9a28e'; c.fillText(label, 330, y - 12);
    c.textAlign = 'right'; c.fillText(Math.round(v * 10) + ' / 10', 630, y - 12);
    for (let k = 0; k < 10; k++) { c.fillStyle = k < Math.round(v * 10) ? (sel ? '#e2c27a' : '#8f7a48') : 'rgba(255,255,255,.1)'; c.fillRect(330 + k * 30, y, 26, 12); }
  });
  c.textAlign = 'center'; c.font = font(13, 'italic'); c.fillStyle = 'rgba(214,203,168,.7)';
  c.fillText(tk('↑ ↓ choose   ·   ← → change   ·   M mutes everything', 'Tap a bar to set the volume'), 480, 372);
  c.fillText(tk('Esc or Enter to go back', 'Tap anywhere else to go back'), 480, 394);
}

/* ---------- bestiary: what the hunter has learned about each kind of creature ---------- */
const BESTIARY = [
  { fam: 'beast', title: 'Beasts', who: 'Wolves · rime wolves · the Werewolf · Greymaw', oil: 'Wolfsbane Oil', weak: 'Fire. The Ember glyph burns them for half again as much.', tip: 'They crouch before they leap. Roll through, or parry the landing.' },
  { fam: 'dead', title: 'The Dead', who: 'Ghouls · wisps · brutes · bone guards · the Rimebound · the bosses of the dead', oil: 'Gravesalt Oil', weak: 'Heavy blows and plunging strikes: more damage, and bosses stagger faster.', tip: 'A wraith must be burned into form. A bone guard\'s shield stops light strikes: break it with a third strike or a heavy blow.' },
  { fam: 'void', title: 'Void Things', who: 'Voidlings · stalkers · rifts · the Void Wound · the Voidspawn', oil: 'Starglass Oil', weak: 'Their own darkness. Parry an orb and it flies back at whatever threw it.', tip: 'Tendrils and shockwaves cannot be blocked. A stalker vanishes, then strikes from behind: turn and parry.' },
  { fam: 'man', title: 'Men', who: 'Bandits · cutthroats · archers', oil: 'none needed', weak: 'A parry leaves them stunned and open. A parried arrow flies back.', tip: 'A charged heavy blow knocks them flat.' },
];
function drawBestiary(c) {
  drawWorld(c); c.fillStyle = 'rgba(0,0,0,.68)'; c.fillRect(0, 0, W, H);
  panel(c, 90, 40, 780, 460, .95);
  c.textAlign = 'center'; c.font = font(24, 'bold'); c.fillStyle = '#e2c27a'; c.fillText('BESTIARY', 480, 80);
  const met = G.S.met || {};
  BESTIARY.forEach((b, i) => {
    const y = 104 + i * 93, known = !!met[b.fam];
    c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(112, y, 736, 84);
    c.textAlign = 'left'; c.font = font(17, 'bold'); c.fillStyle = known ? '#f3e2b0' : '#6f6a5c'; c.fillText(known ? b.title : '? ? ?', 128, y + 24);
    if (!known) { c.font = font(13, 'italic'); c.fillStyle = '#6f6a5c'; c.fillText('You have not fought these yet.', 128, y + 50); return; }
    c.font = font(12, 'italic'); c.fillStyle = '#9c957f'; c.fillText(b.who, 128 + c.measureText('').width + 150, y + 23);
    c.font = font(13); c.fillStyle = '#cfc8b4';
    c.fillText('Oil:  ' + b.oil, 128, y + 44);
    c.fillText('Weakness:  ' + b.weak, 300, y + 44);
    c.fillStyle = '#9c957f'; c.font = font(13, 'italic'); c.fillText(b.tip, 128, y + 66);
    if (OIL_KEYS.includes(b.fam)) oilDrop(c, 826, y + 24, OILS[b.fam].col, 1);
  });
  c.textAlign = 'center'; c.font = font(12, 'italic'); c.fillStyle = 'rgba(214,203,168,.65)'; c.fillText(tk('Press any key to go back', 'Tap to go back'), 480, 488);
}
function drawPause(c) {
  drawWorld(c); c.fillStyle = 'rgba(0,0,0,.62)'; c.fillRect(0, 0, W, H);
  panel(c, 280, 112, 400, 340, .93);
  c.textAlign = 'center'; c.font = font(26, 'bold'); c.fillStyle = '#e2c27a'; c.fillText('PAUSED', 480, 156);
  drawMenu(c, pauseItems(), 238, 31, W / 2, 19);
  c.font = font(12, 'italic'); c.fillStyle = 'rgba(214,203,168,.65)';
  c.fillText('A new difficulty applies to creatures you meet from now on.', 480, 416);
  c.fillText('Quitting returns you to your last save.', 480, 434);
  const S = G.S; c.font = font(13); c.fillStyle = '#cfc8b4';
  c.fillText('Attack ' + S.atk + '   ·   Defense ' + S.def + '   ·   Health ' + S.maxHp + '   ·   Stamina ' + S.maxSta, 480, 184);
}
const OVER_ITEMS = ['Load last save', 'Quit to title'];
function updateOver(dt) {
  G.over.t = (G.over.t || 0) + dt;
  if (G.over.t < .8) return;
  if (menuInput(2, 340, 42)) {
    if (G.menuSel === 0) { if (!loadSave()) toTitle(); else G.toast('Last save loaded. Resuming the game...'); }
    else toTitle();
    Keys.pressed = {}; Mouse.clicked = false; G.menuSel = 0;
  }
}
function drawOver(c) {
  drawWorld(c);
  const a = clamp((G.over.t || 0) / .8, 0, 1);
  c.fillStyle = `rgba(${G.over.kind === 'jail' ? '6,6,10' : '30,0,0'},${.78 * a})`; c.fillRect(0, 0, W, H);
  c.globalAlpha = a; c.textAlign = 'center';
  if (G.over.kind === 'jail') { c.fillStyle = 'rgba(0,0,0,.8)'; for (let x = 80; x < W; x += 110) c.fillRect(x, 0, 16, H); }
  c.font = font(50, 'bold'); c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(G.over.title.toUpperCase(), 482, 202); c.fillStyle = G.over.kind === 'jail' ? '#cfc8b4' : '#c23a34'; c.fillText(G.over.title.toUpperCase(), 480, 200);
  c.font = font(18, 'italic'); c.fillStyle = '#cfc8b4'; G.over.lines.forEach((l, i) => c.fillText(l, 480, 246 + i * 26));
  c.font = font(15); c.fillStyle = '#a9a28e'; c.fillText('What would you like to do now?', 480, 296);
  if (a >= 1) drawMenu(c, OVER_ITEMS, 340, 42);
  c.globalAlpha = 1;
}
function updateEnding(dt) {
  const E = G.ending; E.t += dt;
  if ((tapped('confirm') || Mouse.clicked) && E.t > .6) {
    if (E.i <= E.lines.length) { E.i++; E.t = 0; sfx('select'); }      // epilogue lines, then the numbers page, then the last page
    else if (E.t > 1.2) { toTitle(); }
  }
}
function drawEnding(c) {
  const E = G.ending;
  drawTitleScene(c); c.fillStyle = 'rgba(4,5,8,.62)'; c.fillRect(0, 0, W, H);
  c.textAlign = 'center';
  if (E.i < E.lines.length) {
    c.font = font(13, 'bold'); c.fillStyle = '#c4a460'; c.fillText('EPILOGUE', 480, 120); c.fillRect(420, 132, 120, 1.5);
    c.font = font(22, 'italic'); const lines = wrapText(c, E.lines[E.i], 640);
    c.globalAlpha = clamp(E.t / .7, 0, 1); c.fillStyle = '#ece6d6'; lines.forEach((l, i) => c.fillText(l, 480, 250 - lines.length * 16 + i * 34)); c.globalAlpha = 1;
    c.font = font(12); c.fillStyle = 'rgba(214,203,168,.55)'; c.fillText(tk('Press Enter to continue', 'Tap to continue'), 480, 480);
  } else if (E.i === E.lines.length) {
    // how much of the game this hunt uncovered: counts only, so nothing is given away
    const Fd = E.found, a = clamp(E.t / .6, 0, 1);
    c.font = font(13, 'bold'); c.fillStyle = '#c4a460'; c.fillText('THE HUNT IN NUMBERS', 480, 84); c.fillRect(400, 96, 160, 1.5);
    c.font = font(30, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText('You uncovered ' + Math.round(Fd.pct * a) + '% of this tale.', 480, 146);
    Fd.cats.forEach((cat, i) => {
      const y = 196 + i * 40, bx = 440, bw = 250;
      c.textAlign = 'right'; c.font = font(15); c.fillStyle = '#cfc8b4'; c.fillText(cat.label, bx - 18, y + 11);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(bx, y, bw, 12);
      c.fillStyle = 'rgba(196,164,96,.35)'; c.fillRect(bx, y, bw * Math.min(1, cat.all / cat.total) * a, 12);      // found in any hunt so far
      c.fillStyle = '#e2c27a'; c.fillRect(bx, y, bw * Math.min(1, cat.n / cat.total) * a, 12);                      // found in this hunt
      c.textAlign = 'left'; c.font = font(15, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText(cat.n + ' of ' + cat.total, bx + bw + 16, y + 11);
    });
    c.textAlign = 'center';
    if (Fd.allPct > Fd.pct) { c.font = font(14); c.fillStyle = '#b9a56e'; c.fillText('Across all your hunts so far: ' + Fd.allPct + '%', 480, 412); }
    c.font = font(14, 'italic'); c.fillStyle = '#d6cba8'; c.fillText(Fd.pct >= 100 ? 'There is nothing left that you have not seen.' : 'Some things only happen if you choose differently. They are still out there.', 480, 440);
    c.font = font(12); c.fillStyle = 'rgba(214,203,168,.55)'; c.fillText(tk('Press Enter to continue', 'Tap to continue'), 480, 480);
  } else {
    c.font = font(40, 'bold'); c.fillStyle = '#f3e2b0'; c.fillText('You have completed the game!', 480, 150);
    c.font = font(20, 'italic'); c.fillStyle = '#d6cba8'; c.fillText('Thank you for playing, ' + G.S.name + '.', 480, 190);
    c.fillStyle = '#c4a460'; c.fillRect(380, 212, 200, 1.5);
    c.font = font(16); c.fillStyle = '#cfc8b4'; E.stats.forEach((s, i) => c.fillText(s, 480, 256 + i * 28));
    c.font = font(14, 'bold'); c.fillStyle = '#e2c27a'; c.fillText('New Hunt + is now open on the title screen: keep all you carry, face stronger creatures.', 480, 424);
    c.font = font(13, 'italic'); c.fillStyle = 'rgba(214,203,168,.6)'; c.fillText('Cursed Creatures: Tales of the Hunt  ·  a game by ' + AUTHOR, 480, 448);
    c.font = font(12); c.fillText(tk('Press Enter to return to the title', 'Tap to return to the title'), 480, 480);
  }
}

/* ---------- main loop ---------- */
let lastT = performance.now();
function frame(now) {
  if (window.__sim) { lastT = now; requestAnimationFrame(frame); return; }   // used only by automated tests
  const raw = Math.max(0, (now - lastT) / 1000), dt = Math.min(.034, raw); lastT = now; G.rt += dt;
  watchSpeed(raw);
  Pad.poll();
  if (tapped('mute') && G.state !== 'name') { Sound.toggleMute(); G.toast(Sound.muted ? 'Sound off' : 'Sound on'); }
  if (G.state !== 'play' && G.toastMsg) { G.toastMsg.t -= dt; if (G.toastMsg.t <= 0) G.toastMsg = null; }

  switch (G.state) {
    case 'title': updateTitle(dt); break;
    case 'name': updateName(); break;
    case 'diff': updateDiff(); break;
    case 'controls': case 'bestiary': case 'credits': if (Object.keys(Keys.pressed).length || Mouse.clicked) { G.state = prevState; G.menuSel = 0; Keys.pressed = {}; Mouse.clicked = false; } break;
    case 'sound': updateSound(); break;
    case 'xfer': if (Keys.pressed['Escape']) Transfer.close(); break;
    case 'play':
      if (tapped('pause') && !G.dialog && !G.shop && !G.transition && !G.player.dead) { G.state = 'pause'; G.menuSel = 0; sfx('select'); }
      else {
        // the world always advances by real time: a slow frame is split into smaller steps, so the game
        // never drops into slow motion on a slower machine or a throttled browser
        let rem = Math.min(raw, .1);
        do { const d = Math.min(rem, .02); updatePlay(d); rem -= d; if (rem > .0005) { Keys.pressed = {}; Keys.typed.length = 0; Mouse.clicked = false; } } while (rem > .0005 && G.state === 'play');
      }
      break;
    case 'pause': updatePause(); break;
    case 'over': updateOver(dt); break;
    case 'ending': updateEnding(dt); break;
  }

  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  switch (G.state) {
    case 'title': drawTitle(ctx); break;
    case 'name': drawName(ctx); break;
    case 'controls': drawControls(ctx); break;
    case 'sound': drawSound(ctx); break;
    case 'xfer': drawTransfer(ctx); break;
    case 'bestiary': drawBestiary(ctx); break;
    case 'diff': drawDiff(ctx); break;
    case 'credits': drawCredits(ctx); break;
    case 'play':
      drawWorld(ctx);
      if (G.cine < .5) drawHUD(ctx);
      Touch.draw(ctx);
      drawDialog(ctx); drawShop(ctx);
      if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, W, H); }
      break;
    case 'pause': drawPause(ctx); break;
    case 'over': drawOver(ctx); break;
    case 'ending': drawEnding(ctx); break;
  }
  endFrameInput();
  requestAnimationFrame(frame);
}
// leaving the tab or window pauses the game
function autoPause() { if (G.state === 'play' && !G.dialog && !G.shop && !G.transition && G.player && !G.player.dead) { G.state = 'pause'; G.menuSel = 0; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', autoPause);
Music.set('title');
requestAnimationFrame(frame);
