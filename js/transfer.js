'use strict';
/* ============================================================
   transfer.js — moving a save to another device with a "save code"
   No account and no server: the save (the hunt in progress, the New Hunt + record and the list of things found)
   is packed into a block of letters and digits. The player copies it on one device and pastes it on the other.
   The screen is ordinary web-page elements laid over the game, because only a real text box can be pasted into
   on a phone, and only a real button press is allowed to copy to the clipboard.
   ============================================================ */

/* ---------- packing and unpacking ---------- */
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // 32 symbols; no I, O, 0 or 1, and nothing a message app would "tidy up"
function codeCheck(str) {                                  // 7 symbols that catch a mistyped or cut-off code
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let out = ''; for (let i = 0; i < 7; i++) { out += CODE_ALPHA[h % 32]; h = Math.floor(h / 32); }
  return out;
}
function bytesToCode(bytes) {
  let out = '', acc = 0, bits = 0;
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; out += CODE_ALPHA[(acc >> bits) & 31]; } acc &= (1 << bits) - 1; }
  if (bits) out += CODE_ALPHA[(acc << (5 - bits)) & 31];
  return out;
}
function codeToBytes(str) {
  const out = new Uint8Array(Math.floor(str.length * 5 / 8)); let acc = 0, bits = 0, n = 0;
  for (const ch of str) { acc = (acc << 5) | CODE_ALPHA.indexOf(ch); bits += 5; if (bits >= 8) { bits -= 8; out[n++] = (acc >> bits) & 255; acc &= (1 << bits) - 1; } }
  return out;
}
async function squeeze(bytes, Kind) {                      // shrink or un-shrink with the browser's built-in compressor
  const stream = new Blob([bytes]).stream().pipeThrough(new Kind('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// what this device has to give: null if there is nothing yet
function transferData() {
  const s = Save.read(), p = readPlus(), f = readFound();
  return s || p ? { v: 1, s, p, f } : null;
}
async function makeSaveCode(data) {
  const raw = new TextEncoder().encode(JSON.stringify(data));
  let kind = 'CC3', bytes = raw;                           // CC3 = plain, CC2 = shrunk (shorter, used whenever the browser can)
  if (typeof CompressionStream === 'function') { try { bytes = await squeeze(raw, CompressionStream); kind = 'CC2'; } catch (e) { bytes = raw; } }
  const body = kind + bytesToCode(bytes);
  return body + codeCheck(body);
}
// Reads a code out of whatever was pasted: spaces, line breaks and words around it do no harm.
// Returns { data } or { error }.
async function readSaveCode(text) {
  const tokens = String(text).toUpperCase().split(/\s+/).map(t => t.replace(/[^A-Z0-9]/g, '')).filter(Boolean);
  const start = tokens.findIndex(t => t.startsWith('CC2') || t.startsWith('CC3'));
  if (start < 0) return { error: 'That does not look like a save code. It should begin with CC2 or CC3.' };
  let body = null;
  for (let end = tokens.length; end > start && !body; end--) {          // the code may have been split over several lines
    const cand = tokens.slice(start, end).join('');
    if (cand.length > 12 && cand.length < 400000 && ![...cand.slice(3)].some(ch => CODE_ALPHA.indexOf(ch) < 0) && codeCheck(cand.slice(0, -7)) === cand.slice(-7)) body = cand.slice(0, -7);
  }
  if (!body) return { error: 'The code is incomplete or has a mistake in it. Copy the whole code and try again.' };
  let bytes = codeToBytes(body.slice(3));
  if (body.startsWith('CC2')) {
    if (typeof DecompressionStream !== 'function') return { error: 'This browser is too old to read this code. Update it, or use a newer browser.' };
    try { bytes = await squeeze(bytes, DecompressionStream); } catch (e) { return { error: 'The code could not be read.' }; }
  }
  let d; try { d = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { return { error: 'The code could not be read.' }; }
  const okSave = d && (d.s === null || (d.s && d.s.S && typeof d.s.S.name === 'string' && typeof d.s.S.maxHp === 'number' && LEVELS[d.s.level]));
  const okPlus = d && (d.p === null || (d.p && typeof d.p.plus === 'number'));
  if (!d || d.v !== 1 || !okSave || !okPlus || !(d.s || d.p)) return { error: 'This code comes from a version of the game this one cannot read.' };
  if (!Array.isArray(d.f)) d.f = [];
  d.f = d.f.filter(x => typeof x === 'string').slice(0, 500);
  return { data: d };
}
function describeSave(d) {
  if (!d) return 'nothing yet';
  const parts = [];
  if (d.s) parts.push(d.s.S.name + ', ' + LEVELS[d.s.level].name);
  if (d.p) parts.push('New Hunt +' + (d.p.plus > 1 ? ' ×' + d.p.plus : ''));
  return parts.join(' · ');
}
// Puts a save read from a code onto this device. The hunt in progress is replaced; the New Hunt + record is only
// ever raised, and the list of things found is added to.
function applySaveData(d) {
  let ok = true;
  if (d.s) ok = Save.write(d.s);
  const mine = readPlus();
  if (d.p && (!mine || d.p.plus >= mine.plus)) writePlus(d.p);
  if (d.f.length) addFound(d.f);
  return ok;
}

/* ---------- the screen ---------- */
const Transfer = {
  el: null, code: '', pending: null,
  build() {
    const el = this.el = document.createElement('div'); el.id = 'xfer'; el.hidden = true;
    el.innerHTML = `<div class="xf-box" role="dialog" aria-label="Save code">
      <h2>Move your save to another device</h2>
      <div class="xf-cols">
        <section>
          <h3>From this device</h3>
          <p id="xf-have"></p>
          <textarea id="xf-out" readonly rows="3" spellcheck="false" aria-label="This device's save code"></textarea>
          <div class="xf-row"><button id="xf-copy" type="button">Copy code</button><button id="xf-share" type="button">Send…</button><span id="xf-copied"></span></div>
          <p class="xf-small">Send the code to yourself (a message, an email, a note), then open the game on the other device and choose Save code.</p>
        </section>
        <section>
          <h3>To this device</h3>
          <p>Paste a code from another device here.</p>
          <textarea id="xf-in" rows="3" spellcheck="false" autocapitalize="characters" autocomplete="off" autocorrect="off" placeholder="CC2…" aria-label="Paste a save code"></textarea>
          <div class="xf-row"><button id="xf-load" type="button">Load this save</button><button id="xf-cancel" type="button" hidden>Keep mine</button></div>
          <p id="xf-msg" class="xf-small" aria-live="polite"></p>
        </section>
      </div>
      <button id="xf-close" type="button">Back</button>
    </div>`;
    document.body.appendChild(el);
    const $ = id => el.querySelector('#' + id);
    this.out = $('xf-out'); this.inp = $('xf-in'); this.msg = $('xf-msg'); this.have = $('xf-have'); this.copied = $('xf-copied');
    this.bCopy = $('xf-copy'); this.bShare = $('xf-share'); this.bLoad = $('xf-load'); this.bCancel = $('xf-cancel');
    this.bShare.hidden = !navigator.share;
    this.bCopy.addEventListener('click', () => this.copy());
    this.bShare.addEventListener('click', () => { navigator.share({ text: this.code }).catch(() => { }); });
    this.bLoad.addEventListener('click', () => this.load());
    this.bCancel.addEventListener('click', () => this.resetLoad('Nothing was changed.'));
    this.inp.addEventListener('input', () => this.resetLoad(''));
    $('xf-close').addEventListener('click', () => this.close());
    el.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  },
  open() {
    if (!this.el) this.build();
    G.state = 'xfer'; this.el.hidden = false;
    this.inp.value = ''; this.resetLoad(''); this.copied.textContent = '';
    this.refreshOut();
  },
  close() {
    if (this.el) this.el.hidden = true;
    if (G.state === 'xfer') { G.state = 'title'; G.menuSel = 0; }
    Keys.pressed = {}; Keys.down = {}; Mouse.clicked = false;
    try { canvas.focus(); } catch (e) { }
  },
  refreshOut() {
    const d = transferData();
    this.code = ''; this.out.value = ''; this.bCopy.disabled = this.bShare.disabled = true;
    this.have.textContent = d ? 'Your save: ' + describeSave(d) + '.' : 'There is no save on this device yet. Start a hunt first.';
    if (!d) return;
    makeSaveCode(d).then(code => { this.code = code; this.out.value = code; this.bCopy.disabled = this.bShare.disabled = false; });
  },
  copy() {
    const done = ok => { this.copied.textContent = ok ? 'Copied.' : 'Press and hold the code to copy it.'; };
    const byHand = () => { this.out.focus(); this.out.select(); try { this.out.setSelectionRange(0, this.code.length); } catch (e) { } let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } done(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) navigator.clipboard.writeText(this.code).then(() => done(true), byHand);
    else byHand();
  },
  resetLoad(text) { this.pending = null; this.bLoad.textContent = 'Load this save'; this.bCancel.hidden = true; this.msg.textContent = text; this.msg.className = 'xf-small'; },
  say(text, bad) { this.msg.textContent = text; this.msg.className = 'xf-small' + (bad ? ' xf-bad' : ' xf-good'); },
  async load() {
    if (this.pending) {                                    // second press: the player has confirmed replacing their own save
      const d = this.pending, ok = applySaveData(d);
      this.resetLoad(''); this.inp.value = '';
      if (ok) { this.say('Loaded: ' + describeSave(d) + '. Choose Back, then Continue.'); sfx('save'); } else this.say('This browser would not store the save (private browsing can block it).', true);
      this.refreshOut();
      return;
    }
    if (!this.inp.value.trim()) { this.say('Paste a code into the box first.', true); return; }
    const r = await readSaveCode(this.inp.value);
    if (r.error) { this.say(r.error, true); return; }
    const mine = Save.read();
    this.pending = r.data;
    if (r.data.s && mine) {                                // something would be overwritten: ask first
      this.bLoad.textContent = 'Replace my save'; this.bCancel.hidden = false;
      this.say('The code holds: ' + describeSave(r.data) + '. It will replace the hunt on this device (' + mine.S.name + ', ' + (LEVELS[mine.level] ? LEVELS[mine.level].name : '?') + '). This cannot be undone.', true);
    } else this.load();
  },
};
function drawTransfer(c) { drawTitleScene(c); c.fillStyle = 'rgba(4,5,6,.55)'; c.fillRect(0, 0, W, H); }
