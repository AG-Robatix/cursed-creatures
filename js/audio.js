'use strict';
/* ============================================================
   audio.js — every sound in the game is synthesised here.
   There are no audio files: instruments, ambience and effects
   are built from oscillators and filtered noise, sent through
   a shared reverb and a compressor.
   ============================================================ */

const MASTER = 1.8;      // overall level going into the compressor
const Sound = {
  ac: null, muted: false, voices: 0, cap: 40, surface: 'grass', fxGain: 1,
  vol: { music: .7, sfx: .8 },
  unlock() {
    this.wakeSpeaker();
    if (this.ac) { if (this.ac.state === 'suspended' && !document.hidden) this.ac.resume(); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; this.build(new AC()); Music.start(); }
    catch (err) { this.ac = null; }
  },
  /* iPhones and iPads silence this kind of web sound whenever the ring/silent switch is set to silent (headphones still work).
     Telling the system the page is "playback" audio makes it use the speaker regardless. Newer iOS has a setting for that;
     on older iOS the same effect comes from keeping a silent <audio> element playing. The game's own Sound screen and M key
     remain the way to make it quiet. */
  wakeSpeaker() {
    if (this.woke) { if (this.silent && this.silent.paused && !document.hidden) this.silent.play().catch(() => { }); return; }
    this.woke = true;
    try { if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; } } catch (e) { }
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!iOS) return;
    try {
      const n = 4000, wav = new Uint8Array(44 + n), dv = new DataView(wav.buffer), put = (o, str) => { for (let i = 0; i < str.length; i++) wav[o + i] = str.charCodeAt(i); };
      put(0, 'RIFF'); dv.setUint32(4, 36 + n, true); put(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); put(36, 'data'); dv.setUint32(40, n, true);
      wav.fill(128, 44);      // half a second of silence
      const a = document.createElement('audio'); a.src = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })); a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0.01;
      this.silent = a; a.play().catch(() => { });
    } catch (e) { }
  },
  // builds the mixing desk: three buses (effects, music, ambience) -> reverb send -> compressor -> speakers
  build(ac) {
    this.ac = ac; this.voices = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 16; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .22;
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : MASTER;
    // a soft clipper after the compressor: very loud moments are rounded off instead of crackling
    const clip = ac.createWaveShaper(), curve = new Float32Array(2049), knee = .7;
    for (let i = 0; i < 2049; i++) { const x = i / 1024 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a < knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee))); }
    clip.curve = curve;
    this.master.connect(comp); comp.connect(clip); clip.connect(ac.destination);
    this.rev = ac.createConvolver(); this.rev.buffer = makeImpulse(ac, 2.8);
    const revOut = ac.createGain(); revOut.gain.value = .85; this.rev.connect(revOut); revOut.connect(this.master);
    this.sfx = ac.createGain(); this.music = ac.createGain(); this.amb = ac.createGain();
    for (const [bus, send, key] of [[this.sfx, .14, 'sfxSend'], [this.music, .4, 'musicSend'], [this.amb, .25, 'ambSend']]) {
      bus.connect(this.master); const s = ac.createGain(); s.gain.value = send; bus.connect(s); s.connect(this.rev); this[key] = s;
    }
    this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVol();
  },
  applyVol() {
    if (!this.ac) return;
    this.sfx.gain.value = this.vol.sfx; this.music.gain.value = this.vol.music; this.amb.gain.value = this.vol.sfx * .6;
  },
  setVol(kind, v) { this.vol[kind] = clamp(Math.round(v * 10) / 10, 0, 1); this.applyVol(); try { localStorage.setItem('cursedCreatures.sound', JSON.stringify(this.vol)); } catch (e) { } },
  loadVol() { try { const v = JSON.parse(localStorage.getItem('cursedCreatures.sound')); if (v && typeof v.music === 'number') this.vol = { music: clamp(v.music, 0, 1), sfx: clamp(v.sfx, 0, 1) }; } catch (e) { } },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : MASTER; },
};
Sound.loadVol();
// no sound is made while the tab is hidden
document.addEventListener('visibilitychange', () => { const ac = Sound.ac; if (Sound.silent) { if (document.hidden) Sound.silent.pause(); else Sound.silent.play().catch(() => { }); } if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

// a reverb "room" made from decaying noise
function makeImpulse(ac, secs) {
  const n = Math.floor(ac.sampleRate * secs), buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const k = 1 - i / n; lp += ((Math.random() * 2 - 1) - lp) * (.25 + .5 * k); d[i] = lp * Math.pow(k, 2.6) * (i < 400 ? i / 400 : 1); }
  }
  return buf;
}

/* One voice: an oscillator or a slice of noise, optionally filtered, with an envelope.
   o.t = absolute start time (music) or o.at = delay from now (effects). */
function synth(o) {
  const A = Sound, ac = A.ac; if (!ac) return;
  const fx = !o.bus;                                // music is bounded by its own score; only effects are rationed
  if (fx && o.low && A.voices > A.cap * .6) return; // unimportant sounds give way when a lot is playing
  if (fx && A.voices > A.cap) return;
  const t0 = o.t !== undefined ? o.t : ac.currentTime + (o.at || 0), d = o.d || .2, a = o.a || .005, v = (o.v || .2) * (fx ? A.fxGain : 1);
  let src;
  if (o.noise) { src = ac.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true; }
  else {
    src = ac.createOscillator(); src.type = o.type || 'sine'; src.frequency.setValueAtTime(o.f, t0);
    if (o.glide) for (const [f, at] of o.glide) src.frequency.exponentialRampToValueAtTime(Math.max(20, f), t0 + at);
    if (o.f2) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + d);
    if (o.det) src.detune.value = o.det;
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib[0]; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(o.vib[1], t0 + Math.min(d * .5, .3)); l.connect(lg); lg.connect(src.frequency); l.start(t0); l.stop(t0 + d + .1); }
  }
  let node = src;
  if (o.filt) {
    const f = ac.createBiquadFilter(); f.type = o.filt[0]; f.frequency.setValueAtTime(o.filt[1], t0);
    if (o.filt[2]) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.filt[2]), t0 + (o.filt[4] || d));
    f.Q.value = o.filt[3] || .8; node.connect(f); node = f;
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + a);
  if (o.hold) g.gain.setValueAtTime(v, t0 + a + o.hold);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  node.connect(g);
  if (o.trem) { const l = ac.createOscillator(), lg = ac.createGain(), tg = ac.createGain(); l.type = o.trem[2] || 'sine'; l.frequency.value = o.trem[0]; lg.gain.value = o.trem[1]; tg.gain.value = 1 - o.trem[1]; l.connect(lg); lg.connect(tg.gain); g.connect(tg); tg.connect(o.bus || A.sfx); l.start(t0); l.stop(t0 + d + .1); }
  else g.connect(o.bus || A.sfx);
  if (o.wet) { const w = ac.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(A.rev); }
  if (fx) A.voices++;
  src.onended = () => { if (fx) A.voices--; try { g.disconnect(); } catch (e) { } };
  src.start(t0, o.noise ? Math.random() * 1.2 : 0); src.stop(t0 + d + .06);
}
const rv = (x, amt = .06) => x * (1 + (Math.random() * 2 - 1) * amt);   // a little variation so repeats do not sound identical
// struck metal: several partials that are not in tune with each other
function clang(base, v, d, at = 0) { [1, 2.32, 3.87, 5.41, 7.2].forEach((r, i) => synth({ type: i < 2 ? 'square' : 'sine', f: rv(base * r, .01), d: d * (1 - i * .14), v: v / (1 + i * .8), a: .002, at, wet: .25, filt: ['highpass', 500, null, .5] })); }

const SFX = {
  swing() { synth({ noise: 1, d: .17, v: .17, a: .03, filt: ['bandpass', rv(900), 3400, .9, .09] }); synth({ noise: 1, d: .1, v: .06, at: .05, filt: ['highpass', 4000, null, .7] }); },
  heavy() { synth({ noise: 1, d: .28, v: .22, a: .05, filt: ['bandpass', rv(500), 2600, .8, .15] }); synth({ f: 120, f2: 60, d: .22, v: .14, type: 'triangle' }); },
  hit() { synth({ noise: 1, d: .09, v: .3, filt: ['lowpass', rv(1500), 300, .9] }); synth({ f: rv(160), f2: 62, d: .13, v: .3, type: 'triangle' }); synth({ noise: 1, d: .03, v: .12, filt: ['highpass', 3200, null, .7] }); },
  hurt() { synth({ f: rv(190), f2: 105, d: .26, v: .24, type: 'sawtooth', filt: ['lowpass', 900, 400, 1.5], vib: [9, 10] }); synth({ noise: 1, d: .12, v: .2, filt: ['lowpass', 700, 250, .8] }); synth({ f: 90, f2: 45, d: .16, v: .22 }); },
  die() { synth({ f: 170, f2: 42, d: 1.0, v: .26, type: 'sawtooth', filt: ['lowpass', 900, 200, 1], wet: .4 }); synth({ f: 70, f2: 32, d: .6, v: .3 }); },
  kill() { synth({ noise: 1, d: .3, v: .22, filt: ['lowpass', 1100, 120, .8] }); synth({ f: rv(115), f2: 44, d: .34, v: .26, type: 'triangle' }); },
  roll() { synth({ noise: 1, d: .22, v: .1, a: .04, filt: ['lowpass', 500, 1500, .6] }); },
  jump() { synth({ noise: 1, d: .09, v: .06, a: .02, filt: ['bandpass', 700, 1600, .7] }); },
  step() {
    const s = Sound.surface;
    if (s === 'stone') { synth({ low: 1, f: rv(170, .12), f2: 90, d: .05, v: .03, type: 'triangle' }); synth({ low: 1, noise: 1, d: .035, v: .09, filt: ['bandpass', rv(1400, .2), null, 1.2] }); }
    else if (s === 'wood') { synth({ low: 1, f: rv(120, .15), f2: 70, d: .07, v: .04, type: 'triangle' }); synth({ low: 1, noise: 1, d: .04, v: .1, filt: ['lowpass', 900, null, .8] }); }
    else if (s === 'snow') synth({ low: 1, noise: 1, d: .1, v: .12, a: .01, filt: ['bandpass', rv(2100, .2), 1200, 1.4] });
    else if (s === 'leaf') { synth({ low: 1, noise: 1, d: .06, v: .16, filt: ['lowpass', 500, null, .8] }); synth({ low: 1, noise: 1, d: .05, v: .035, at: .01, filt: ['highpass', rv(3500, .2), null, .8] }); }
    else synth({ low: 1, noise: 1, d: .055, v: .22, filt: ['lowpass', rv(480, .2), null, .8] });
  },
  coin() { const f = rv(1900, .03); synth({ f, d: .5, v: .08, wet: .2 }); synth({ f: f * 2.76, d: .3, v: .04 }); synth({ f: f * 1.5, d: .4, v: .06, at: .07, wet: .2 }); synth({ f: f * 1.5 * 2.76, d: .25, v: .03, at: .07 }); },
  select() { synth({ low: 1, f: 660, d: .09, v: .07, type: 'triangle', filt: ['lowpass', 2400, 900, .8] }); },
  confirm() { synth({ f: 523, d: .16, v: .09, type: 'triangle', wet: .2 }); synth({ f: 784, d: .28, v: .09, type: 'triangle', at: .07, wet: .25 }); },
  text() { synth({ low: 1, f: rv(420, .1), d: .03, v: .022, type: 'triangle', filt: ['lowpass', 1200, null, .7] }); },
  potion() { synth({ noise: 1, d: .05, v: .1, filt: ['bandpass', 1800, null, 3] }); for (let i = 0; i < 5; i++) synth({ f: rv(320 + i * 90, .1), f2: 620 + i * 110, d: .11, v: .09, at: .08 + i * .07 }); },
  oil() { synth({ noise: 1, d: .5, v: .08, a: .1, filt: ['bandpass', 2600, 5200, 2.5] }); synth({ f: 1320, f2: 1980, d: .5, v: .04, at: .1, wet: .3 }); },
  ember() { synth({ noise: 1, d: .6, v: .3, a: .03, filt: ['lowpass', 500, 300, .7] }); synth({ noise: 1, d: .45, v: .2, a: .04, filt: ['bandpass', 900, 3200, .8, .2] }); synth({ f: 80, f2: 170, d: .4, v: .16, type: 'sawtooth', filt: ['lowpass', 500, null, 1] }); for (let i = 0; i < 6; i++) synth({ noise: 1, d: .03, v: .1, at: .1 + Math.random() * .5, filt: ['highpass', 2500, null, .7] }); },
  ward() { [660, 990, 1320].forEach((f, i) => synth({ f, d: .9, v: .07, a: .12, at: i * .05, wet: .5 })); },
  wardBreak() { synth({ noise: 1, d: .3, v: .2, filt: ['highpass', 3200, 1500, 1] }); for (let i = 0; i < 6; i++) synth({ f: rv(2400, .4), d: .25, v: .05, at: Math.random() * .12, wet: .4 }); },
  parry() { clang(rv(820, .03), .2, .55); synth({ noise: 1, d: .05, v: .2, filt: ['highpass', 4500, null, .8] }); },
  block() { clang(rv(430, .04), .12, .22); synth({ f: 150, f2: 80, d: .1, v: .2, type: 'triangle' }); },
  charge() { synth({ f: 520, f2: 1040, d: .25, v: .07, type: 'triangle', wet: .3 }); synth({ noise: 1, d: .25, v: .04, a: .1, filt: ['bandpass', 3000, 6000, 3] }); },
  arrow() { synth({ f: 210, f2: 170, d: .12, v: .12, type: 'triangle' }); synth({ noise: 1, d: .22, v: .07, a: .02, filt: ['bandpass', 3200, 1600, 3] }); },
  growl() { synth({ f: rv(72), f2: 55, d: .85, v: .3, type: 'sawtooth', filt: ['lowpass', 420, 260, 2], trem: [27, .55, 'sawtooth'], wet: .25 }); synth({ noise: 1, d: .8, v: .08, a: .1, filt: ['lowpass', 320, null, .8] }); },
  howl() { for (const [det, v] of [[0, .16], [9, .1]]) synth({ f: 230, glide: [[450, .45], [440, 1.1], [300, 1.7]], d: 1.8, v, a: .15, det, type: 'sawtooth', filt: ['lowpass', 1300, 700, 2], vib: [6, 7], wet: .7 }); },
  wail() { for (const det of [0, 14]) synth({ f: 880, glide: [[1450, .4], [1300, 1.0], [640, 1.7]], d: 1.8, v: .1, a: .12, det, vib: [7, 22], wet: .9 }); synth({ noise: 1, d: 1.6, v: .05, a: .3, filt: ['bandpass', 2800, 1400, 5], wet: .8 }); },
  scream() { synth({ f: 620, glide: [[1150, .2], [900, .6], [480, 1.0]], d: 1.05, v: .13, a: .03, type: 'sawtooth', filt: ['bandpass', 1300, 900, 2.2], vib: [11, 30], wet: .7 }); synth({ noise: 1, d: .7, v: .05, filt: ['bandpass', 2400, null, 3], wet: .5 }); },
  teleport() { synth({ noise: 1, d: .4, v: .14, a: .2, filt: ['bandpass', 300, 5200, 3] }); synth({ f: 200, f2: 1600, d: .35, v: .06, wet: .4 }); },
  void() { synth({ f: 46, d: 1.5, v: .34, a: .08 }); synth({ f: 48.6, d: 1.5, v: .3, a: .08 }); synth({ f: 320, f2: 40, d: 1.1, v: .1, type: 'sawtooth', filt: ['lowpass', 600, 120, 2], wet: .6 }); synth({ noise: 1, d: 1.2, v: .1, a: .2, filt: ['lowpass', 180, 700, 1], wet: .5 }); },
  tendril() { synth({ noise: 1, d: .25, v: .22, filt: ['lowpass', 220, 1700, 1] }); synth({ f: 70, f2: 150, d: .22, v: .22, type: 'square', filt: ['lowpass', 700, null, 1] }); },
  thud() { synth({ f: 92, f2: 34, d: .34, v: .4, type: 'triangle' }); synth({ noise: 1, d: .22, v: .2, filt: ['lowpass', 260, 90, .8] }); },
  door() { synth({ f: 190, glide: [[260, .12], [215, .25], [280, .34]], d: .36, v: .06, type: 'sawtooth', filt: ['bandpass', 900, null, 4], wet: .4 }); synth({ f: 110, f2: 70, d: .16, v: .2, type: 'triangle', at: .34 }); synth({ noise: 1, d: .1, v: .12, at: .34, filt: ['lowpass', 500, null, .8] }); },
  lever() { synth({ f: 190, d: .05, v: .2, type: 'square', filt: ['lowpass', 900, null, 1] }); synth({ noise: 1, d: 1.1, v: .14, a: .1, at: .12, filt: ['lowpass', 190, 140, 1.2], trem: [13, .5, 'square'], wet: .4 }); },
  save() { synth({ f: 660, d: .7, v: .06, wet: .5 }); synth({ f: 990, d: .9, v: .06, at: .12, wet: .5 }); },
  fire() { for (let i = 0; i < 9; i++) synth({ noise: 1, d: .04, v: .1, at: Math.random() * .6, filt: ['highpass', rv(2200, .3), null, .7] }); synth({ noise: 1, d: .7, v: .09, a: .1, filt: ['lowpass', 600, 1400, .7] }); },
  crystal() { for (let i = 0; i < 7; i++) { const f = 523 * Math.pow(2, [0, 3, 7, 10, 12, 15, 19][i] / 12); synth({ f, d: 1.4, v: .07, at: i * .09, wet: .7 }); synth({ f: f * 2.01, d: .7, v: .03, at: i * .09 }); } },
  boss() { for (const f of [55, 82.4, 110]) synth({ f, d: 1.7, v: .2, a: .03, type: 'sawtooth', filt: ['lowpass', 900, 220, 1.2], wet: .5 }); synth({ f: 70, f2: 38, d: .9, v: .4 }); synth({ noise: 1, d: .5, v: .12, filt: ['lowpass', 300, 100, .8], wet: .4 }); },
  victory() { [392, 494, 587, 784].forEach((f, i) => { synth({ f, d: .9, v: .1, type: 'triangle', at: i * .14, filt: ['lowpass', 3000, 900, .8], wet: .5 }); synth({ f: f * 2, d: .4, v: .03, at: i * .14 }); }); },
};
// measured so that every effect sits at a sensible level next to the music
const SFX_GAIN = { swing: 2.6, heavy: 3, hit: 1.7, hurt: 1.8, kill: 2.4, roll: 3.5, jump: 5, step: 2.2, coin: 1.3, select: 3, confirm: 1.4, text: 3, potion: 1.4, oil: 1.8, ember: 1.6, wardBreak: 1.6, parry: 1.3, block: 1.7, charge: 3, arrow: 3.5, growl: 1.8, scream: 3.2, teleport: 3, void: .75, tendril: 2.4, thud: 1.8, door: .8, lever: 2.2, save: 1.2, fire: .9, crystal: .9, boss: .7 };
function playSfx(name) { Sound.fxGain = SFX_GAIN[name] || 1; SFX[name](); Sound.fxGain = 1; }
function sfx(name) { if (Sound.ac && Sound.ac.state === 'running' && SFX[name]) playSfx(name); }

/* ============================================================
   MUSIC — composed by rule. Each mood has a key, a scale, a chord
   progression and a set of instruments; a small scheduler plays
   them in time and invents a melody that follows the chords.
   ============================================================ */
const SCALES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
/* key: MIDI note of the tonic · step: seconds per step · bar: steps in a bar · prog: chords, as scale degrees, one per bar
   arp: which chord note the harp plays on each step ('.' = rest) · drum: x = drum, o = rim tick */
const MOODS = {
  title:  { key: 50, scale: 'aeolian',  step: .22, bar: 16, prog: [0, 5, 3, 4],             pad: .05,  bass: .07, arp: '0.1.2.1.0.2.1.2.', arpVol: .05,  lead: 'flute', leadVol: .05,  leadProb: .65, amb: 'wind' },
  moor:   { key: 45, scale: 'dorian',   step: .26, bar: 16, prog: [0, 0, 6, 0, 3, 0, 6, 4], pad: .055, bass: .06, arp: '0.......2...1...', arpVol: .04,  lead: 'flute', leadVol: .04,  leadProb: .4,  amb: 'wind', extra: 'crow', surface: 'grass', wet: .14 },
  wood:   { key: 52, scale: 'dorian',   step: .2,  bar: 12, prog: [0, 3, 6, 0, 0, 3, 4, 0], pad: .04,  bass: .055, arp: '0.21.20.21.2',    arpVol: .05,  lead: 'flute', leadVol: .055, leadProb: .7,  amb: 'leaves', extra: 'bird', surface: 'leaf', wet: .16 },
  house:  { key: 47, scale: 'phrygian', step: .3,  bar: 16, prog: [0, 0, 1, 0],             pad: .06,  bass: .05, arp: '........2.......', arpVol: .03,  lead: 'bell',  leadVol: .035, leadProb: .3,  amb: 'room', extra: 'creak', surface: 'wood', wet: .34 },
  road:   { key: 55, scale: 'dorian',   step: .17, bar: 12, prog: [0, 6, 3, 0, 0, 6, 4, 0], pad: .035, bass: .06, arp: '0..1..2..1..',    arpVol: .045, lead: 'viol',  leadVol: .042, leadProb: .6,  drum: 'x.....o..x..', drumVol: .05, amb: 'wind', extra: 'cricket', surface: 'dirt', wet: .14 },
  town:   { key: 50, scale: 'dorian',   step: .18, bar: 12, prog: [0, 3, 0, 6, 0, 3, 4, 0], pad: .03,  bass: .06, arp: '0.21.20.12.1',    arpVol: .055, lead: 'flute', leadVol: .05,  leadProb: .75, amb: 'night', extra: 'bell', surface: 'stone', wet: .2 },
  crypt:  { key: 48, scale: 'phrygian', step: .32, bar: 16, prog: [0, 1, 0, 6],             pad: .03,  choir: .05, bass: .06, lead: 'bell', leadVol: .04,  leadProb: .4,  amb: 'room', extra: 'drip', surface: 'stone', wet: .4 },
  winter: { key: 47, scale: 'aeolian',  step: .27, bar: 16, prog: [0, 5, 0, 4, 3, 5, 0, 0], pad: .05,  bass: .05, arp: '0...2...1...2...', arpVol: .03, arpOct: 2, lead: 'bell', leadVol: .04, leadProb: .5, amb: 'blizzard', surface: 'snow', wet: .2 },
  boss:   { key: 50, scale: 'harmonic', step: .115, bar: 16, prog: [0, 0, 5, 4, 0, 0, 3, 4], pad: .03, bass: .06, ost: .045, drum: 'x..ox...x.x.o...', drumVol: .045, stab: .036, lead: 'viol', leadVol: .05, leadProb: .5 },
};
// rhythms the melody can use: [step, length] pairs, by bar length
const RHYTHMS = {
  16: [[[0, 4], [4, 2], [6, 2], [8, 6]], [[0, 6], [6, 2], [8, 4], [12, 4]], [[2, 2], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 8]], [[4, 4], [8, 4], [12, 4]]],
  12: [[[0, 3], [3, 3], [6, 6]], [[0, 2], [2, 1], [3, 3], [6, 3], [9, 3]], [[0, 6], [6, 2], [8, 1], [9, 3]], [[3, 3], [6, 2], [8, 1], [9, 3]], [[0, 3], [3, 1], [4, 2], [6, 6]]],
};

const INSTR = {
  pad(s, f, t, d, v) { for (const det of [-7, 6]) synth({ type: 'sawtooth', f, det, t, d: d + 1.5, a: 1.0, hold: Math.max(.1, d - 1.0), v: v * .5, filt: ['lowpass', 720, null, .7], bus: s.gain }); },
  choir(s, f, t, d, v) { for (const [det, fq] of [[-9, 650], [8, 1050]]) synth({ type: 'sawtooth', f, det, t, d: d + 1.8, a: 1.3, hold: Math.max(.1, d - 1.3), v: v * .7, filt: ['bandpass', fq, null, 2.2], vib: [4.5, f * .004], bus: s.gain }); },
  bass(s, f, t, d, v) { synth({ f, t, d, a: .03, hold: d * .5, v, bus: s.gain }); synth({ type: 'triangle', f: f * 2, t, d: d * .6, a: .02, v: v * .25, bus: s.gain }); },
  harp(s, f, t, v) { synth({ type: 'triangle', f: rv(f, .002), t, d: 1.5, a: .004, v, filt: ['lowpass', 3400, 650, .8, .5], bus: s.gain }); synth({ f: f * 2, t, d: .5, a: .003, v: v * .3, bus: s.gain }); },
  flute(s, f, t, d, v) { synth({ f, t, d: d + .18, a: .07, hold: Math.max(.02, d - .1), v, vib: [5, f * .006], bus: s.gain }); synth({ f: f * 2, t, d: d + .1, a: .08, v: v * .16, bus: s.gain }); synth({ noise: 1, t, d: Math.min(d, .3), a: .03, v: v * .12, filt: ['bandpass', f * 2, null, 1.5], bus: s.gain }); },
  viol(s, f, t, d, v) { synth({ type: 'sawtooth', f, t, d: d + .2, a: .09, hold: Math.max(.02, d - .12), v: v * .8, vib: [5.5, f * .007], filt: ['lowpass', 1500, null, .9], bus: s.gain }); },
  bell(s, f, t, d, v) { [[1, 1], [2.76, .4], [5.4, .18]].forEach(([r, k]) => synth({ f: f * r, t, d: 2.6 / Math.sqrt(r), a: .003, v: v * k, bus: s.gain })); },
  drum(s, t, v) { synth({ f: 108, f2: 48, t, d: .3, a: .003, v, bus: s.gain }); synth({ noise: 1, t, d: .09, v: v * .5, filt: ['lowpass', 520, null, .8], bus: s.gain }); },
  tick(s, t, v) { synth({ noise: 1, t, d: .04, v: v * .45, filt: ['highpass', 5200, null, .8], bus: s.gain }); synth({ f: 420, f2: 300, t, d: .04, v: v * .3, type: 'triangle', bus: s.gain }); },
  ost(s, f, t, v) { synth({ type: 'sawtooth', f, t, d: .16, a: .006, v, filt: ['lowpass', 950, 500, 1], bus: s.gain }); },
  stab(s, f, t, v) { synth({ type: 'sawtooth', f, t, d: .7, a: .012, v, filt: ['lowpass', 1300, 380, 1.1], bus: s.gain }); },
};
// small sounds of the place, played now and then
const EXTRAS = {
  bird(s, t) { const f = rv(2600, .25), n = randi(2, 5); for (let i = 0; i < n; i++) synth({ f, f2: f * rv(1.25, .15), t: t + i * .11, d: .08, v: .022, bus: s.amb }); },
  crow(s, t) { for (let i = 0; i < randi(1, 3); i++) synth({ type: 'sawtooth', f: rv(520), f2: 420, t: t + i * .34, d: .22, v: .02, filt: ['bandpass', 1400, null, 3], trem: [48, .6, 'square'], bus: s.amb }); },
  cricket(s, t) { const f = rv(4300, .05); for (let i = 0; i < randi(4, 9); i++) synth({ f, t: t + i * .12, d: .07, v: .012, trem: [60, .9, 'square'], bus: s.amb }); },
  drip(s, t) { const f = rv(1500, .3); synth({ f, f2: f * 1.6, t, d: .09, v: .035, wet: .9, bus: s.amb }); },
  creak(s, t) { synth({ type: 'sawtooth', f: rv(90, .2), glide: [[rv(120), .3], [rv(80), .7]], t, d: .8, v: .012, filt: ['bandpass', 600, null, 5], bus: s.amb }); },
  bell(s, t) { INSTR.bell({ gain: s.amb }, 196, t, 0, .03); },
};

const Music = {
  wanted: 'title', mood: null, session: null, timer: null,
  start() { if (!Sound.ac) return; if (!this.timer) this.timer = setInterval(() => this.pump(), 90); this.apply(); },
  set(name) { this.wanted = name; if (Sound.ac) this.apply(); },
  apply() {
    if (this.mood === this.wanted) return;
    const ac = Sound.ac, now = ac.currentTime;
    this.end(this.session, now);
    this.mood = this.wanted; this.session = null;
    const cfg = MOODS[this.mood]; if (!cfg) return;
    if (cfg.surface) Sound.surface = cfg.surface;
    if (cfg.wet !== undefined && Sound.sfxSend) Sound.sfxSend.gain.setTargetAtTime(cfg.wet, now, .3);   // caves and halls echo more
    this.session = this.begin(cfg, now + .12);
  },
  begin(cfg, t0) {
    const ac = Sound.ac, s = { cfg, i: 0, nextT: t0, motif: null, nodes: [], dead: false };
    s.gain = ac.createGain(); s.gain.gain.setValueAtTime(.0001, t0); s.gain.gain.linearRampToValueAtTime(1, t0 + 2.2); s.gain.connect(Sound.music);
    s.amb = ac.createGain(); s.amb.gain.setValueAtTime(.0001, t0); s.amb.gain.linearRampToValueAtTime(1, t0 + 2.5); s.amb.connect(Sound.amb);
    this.bed(s, cfg.amb, t0);
    return s;
  },
  end(s, now) {
    if (!s) return; s.dead = true;
    for (const g of [s.gain, s.amb]) { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(.0001, g.gain.value), now); g.gain.exponentialRampToValueAtTime(.0001, now + 1.6); }
    for (const n of s.nodes) { try { n.stop(now + 1.8); } catch (e) { } }
  },
  // the continuous bed under each place: wind, rustling leaves, a blizzard, the hum of a closed room
  bed(s, kind, t0) {
    if (!kind) return; const ac = Sound.ac;
    const B = { wind: [420, .6, .05, .12], leaves: [1800, .5, .03, .2], night: [300, .5, .03, .09], blizzard: [760, 2.4, .1, .17], room: [110, .7, .05, .07] }[kind];
    const src = ac.createBufferSource(); src.buffer = Sound.noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = kind === 'room' ? 'lowpass' : 'bandpass'; f.frequency.value = B[0]; f.Q.value = B[1];
    const g = ac.createGain(); g.gain.value = B[2];
    const l = ac.createOscillator(), lf = ac.createGain(), lg = ac.createGain(); l.frequency.value = B[3]; lf.gain.value = B[0] * .45; lg.gain.value = B[2] * .6;
    l.connect(lf); lf.connect(f.frequency); l.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(s.amb); src.start(t0); l.start(t0); s.nodes.push(src, l);
  },
  pump() { const ac = Sound.ac; if (!ac || ac.state !== 'running' || !this.session) return; this.schedule(this.session, ac.currentTime + .4); },
  schedule(s, until) {
    const ac = Sound.ac;
    if (s.nextT < ac.currentTime - .05) s.nextT = ac.currentTime + .05;     // after a pause, pick up from now instead of rushing to catch up
    while (s.nextT < until && !s.dead) { this.step(s, s.i, s.nextT); s.nextT += s.cfg.step; s.i++; }
  },
  step(s, i, t) {
    const c = s.cfg, scale = SCALES[c.scale], bar = Math.floor(i / c.bar), st = i % c.bar, barDur = c.bar * c.step;
    const deg = c.prog[bar % c.prog.length];
    const note = (d, oct) => mtof(c.key + 12 * oct + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7));
    const chord = [deg, deg + 2, deg + 4];
    if (st === 0) {
      if (c.pad) { INSTR.pad(s, note(chord[0], 0), t, barDur, c.pad); INSTR.pad(s, note(chord[1], 0), t, barDur, c.pad * .8); INSTR.pad(s, note(chord[2], 0), t, barDur, c.pad * .8); }
      if (c.choir) { INSTR.choir(s, note(chord[0], 0), t, barDur, c.choir); INSTR.choir(s, note(chord[2], 0), t, barDur, c.choir * .8); }
      if (c.bass) INSTR.bass(s, note(deg, -1), t, barDur * .92, c.bass);
      if (c.stab) for (const d of chord) INSTR.stab(s, note(d, 0), t, c.stab);
      // a new melodic idea every four bars; it is then repeated over the changing chords
      if (bar % 4 === 0 || !s.motif) { let d = pick([0, 2, 4]); s.motif = pick(RHYTHMS[c.bar]).map(([at, len]) => { d = clamp(d + pick([-2, -1, -1, 0, 1, 1, 2]), -2, 7); return { at, len, d }; }); }
      s.playLead = Math.random() < c.leadProb;
    }
    if (c.arp) { const ch = c.arp[st]; if (ch !== '.' && ch !== undefined) INSTR.harp(s, note(chord[+ch], c.arpOct || 1), t, c.arpVol * rv(1, .15)); }
    if (c.lead && s.playLead) for (const m of s.motif) if (m.at === st) {
      const last = m === s.motif[s.motif.length - 1] && bar % 4 === 3;         // the phrase comes to rest at the end of the fourth bar
      const d = last ? pick([0, 4]) : deg + m.d, len = (last ? Math.max(m.len, 6) : m.len) * c.step;
      INSTR[c.lead](s, note(d, c.lead === 'viol' ? 1 : 2), t, len * .92, c.leadVol);
    }
    if (c.ost && st % 2 === 0) INSTR.ost(s, note(st % 8 === 6 ? deg + 4 : deg, 0), t, c.ost * (st % 4 === 0 ? 1 : .7));
    if (c.drum) { const ch = c.drum[st]; if (ch === 'x') INSTR.drum(s, t, c.drumVol); else if (ch === 'o') INSTR.tick(s, t, c.drumVol); }
    if (c.extra && Math.random() < c.step * .09) EXTRAS[c.extra](s, t + Math.random() * c.step);
  },
};
