'use strict';
/* ============================================================
   Cursed Creatures: Tales of the Hunt
   core.js — canvas, helpers, input, sound, saving
   ============================================================ */

const W = 960, H = 540;      // logical screen size
const GROUND = 452;          // y of the ground line (feet)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/* If the game cannot keep up (frames taking longer than about 1/50 s for a couple of seconds), it helps itself in
   two stages. Some browsers (Safari on a Mac above all) paint large stretched pictures slowly.
     1. "Stamping": the scenery is kept at exactly screen size and laid down without stretching (see art.js).
        It costs some memory, which is why it is only switched on when needed.
     2. If that is not enough, the picture is drawn at a lower resolution: the slower the game is running, the bigger
        the step. The art is soft and painterly, so it still looks good, and it stays smooth.
   After each change the game checks that it actually helped. If it made no difference, the browser is simply holding
   the frame rate down (battery saver, a 30 Hz screen), so the change is undone. */
const Quality = { scale: 1, stamp: false, triedStamp: false, acc: 0, n: 0, slow: 0, trial: null, off: false };
function watchSpeed(raw) {
  if (Quality.off) return;
  if (raw > .25 || document.hidden || !document.hasFocus()) { Quality.acc = 0; Quality.n = 0; return; }   // not really running: say nothing
  Quality.acc += raw; if (++Quality.n < 60) return;
  const avg = Quality.acc / Quality.n; Quality.acc = 0; Quality.n = 0;
  if (Quality.trial) {                                    // first reading after a change: did it help at all?
    if (avg > Quality.trial.avg * .93) Quality.trial.undo();
    Quality.trial = null; Quality.slow = 0;
    return;
  }
  if (!(avg > .0195)) { Quality.slow = 0; return; }
  if (++Quality.slow < 2) return;
  Quality.slow = 0;
  if (!Quality.triedStamp) {
    Quality.triedStamp = Quality.stamp = true;
    Quality.trial = { avg, undo() { Quality.stamp = false; freeStamps(); } };
  } else if (Quality.scale > .5) {
    const prev = Quality.scale;
    Quality.scale = Math.max(.5, Math.min(prev * .85, prev * Math.sqrt(.0167 / avg) * 1.1));
    Quality.trial = { avg, undo() { Quality.scale = prev; Quality.off = true; fitCanvas(); } };
    fitCanvas();
  }
}
function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  const px = Math.max(640, Math.floor(Math.min(Math.floor(W * s * dpr), 1920) * Quality.scale));
  canvas.width = px;
  canvas.height = Math.round(px * H / W);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/* ---------- helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const sgn = v => v < 0 ? -1 : 1;
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);

// small seeded random generator, so scenery looks the same every time
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* ---------- input ---------- */
const Keys = { down: {}, pressed: {}, typed: [] };
const Mouse = { x: 0, y: 0, clicked: false, down: false };

const BIND = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
  attack: ['KeyJ', 'KeyZ'],
  dodge: ['KeyK', 'KeyX'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  ember: ['KeyL', 'KeyC'],
  ward: ['KeyI', 'KeyV'],
  block: ['ArrowDown', 'KeyS'],
  interact: ['KeyE'],
  confirm: ['Enter', 'Space', 'KeyE', 'KeyJ', 'KeyZ'],
  p1: ['Digit1'], p2: ['Digit2'], p3: ['Digit3'], p4: ['Digit4'], p5: ['Digit5'], p6: ['Digit6'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
};
const held = a => BIND[a].some(k => Keys.down[k]);
const tapped = a => !!BIND[a] && BIND[a].some(k => Keys.pressed[k]);

window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;
  if (G.state === 'xfer' && e.code !== 'Escape') return;      // the Save code screen has real text boxes: typing there is not for the game
  if (!e.repeat) Keys.pressed[e.code] = true;
  Keys.down[e.code] = true;
  if (e.code === 'KeyF' && !e.repeat && G.state !== 'name') toggleFullscreen();      // must happen inside the key event itself
  if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') Keys.typed.push(e.key);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
  Sound.unlock();
});
window.addEventListener('keyup', e => { Keys.down[e.code] = false; });
window.addEventListener('blur', () => { Keys.down = {}; Mouse.down = false; });

function mousePos(e) {
  const r = canvas.getBoundingClientRect();
  Mouse.x = (e.clientX - r.left) / r.width * W;
  Mouse.y = (e.clientY - r.top) / r.height * H;
}
canvas.addEventListener('mousemove', mousePos);
canvas.addEventListener('mousedown', e => { mousePos(e); Mouse.clicked = true; Mouse.down = true; Sound.unlock(); canvas.focus(); e.preventDefault(); });
window.addEventListener('mouseup', () => { Mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function endFrameInput() {
  Keys.pressed = {};
  Keys.typed.length = 0;
  Mouse.clicked = false;
}

/* (sound and music live in audio.js) */

/* ---------- saving (browser localStorage) ---------- */
const SAVE_KEY = 'cursedCreatures.save.v1';
const Save = {
  write(obj) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; } },
  read() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } },
};

/* ---------- text helpers ---------- */
const FONT = 'Georgia, "Palatino Linotype", "Book Antiqua", Palatino, serif';
function font(size, style = '') { return `${style} ${size}px ${FONT}`.trim(); }

function wrapText(c, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (c.measureText(test).width > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

function panel(c, x, y, w, h, alpha = 0.86) {
  c.save();
  c.fillStyle = `rgba(10,11,14,${alpha})`;
  c.strokeStyle = 'rgba(196,164,96,0.85)';
  c.lineWidth = 1.5;
  const n = 8;
  c.beginPath();
  c.moveTo(x + n, y); c.lineTo(x + w - n, y); c.lineTo(x + w, y + n); c.lineTo(x + w, y + h - n);
  c.lineTo(x + w - n, y + h); c.lineTo(x + n, y + h); c.lineTo(x, y + h - n); c.lineTo(x, y + n);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(196,164,96,0.22)';
  c.lineWidth = 1;
  c.strokeRect(x + 5, y + 5, w - 10, h - 10);
  c.restore();
}
