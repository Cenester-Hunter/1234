'use strict';
// Звуки синтезируются на лету (WebAudio), файлов нет. Включается после первого касания.
// Смех (laugh) — «хэллоуинский»: пилообразный голос + форманты гласных + вибрато, импульсы «ха-ха-ха», реверб и октавой ниже.

const Sfx = {
  ctx: null, on: true, nb: null, out: null, wet: null, laughT: -9, drone: null, beatT: 0,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      const n = c.sampleRate;
      this.nb = c.createBuffer(1, n, n);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      // мастер: компрессор + общий реверб (сгенерированный импульс)
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      const master = c.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(c.destination);
      this.out = master;
      const conv = c.createConvolver(), L = Math.floor(c.sampleRate * 1.8), ir = c.createBuffer(2, L, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); for (let i = 0; i < L; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 2.6); }
      conv.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.5;
      conv.connect(wet); wet.connect(master);
      this.wet = conv;
    } catch (e) { this.ctx = null; }
  },

  // подключить узел к выходу (и к ревербу с долей rv)
  route(node, rv) {
    node.connect(this.out);
    if (rv) { const g = this.ctx.createGain(); g.gain.value = rv; node.connect(g); g.connect(this.wet); }
  },

  tone(f1, f2, dur, type, vol, rv) {
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); this.route(g, rv); o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol, type, f1, f2, rv, q) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; s.loop = true; fl.type = type; if (q) fl.Q.value = q;
    fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); this.route(g, rv); s.start(t); s.stop(t + dur + 0.02);
  },

  // шумовой «вдох/выдох» с плавным нарастанием: peak — момент максимума (0..1)
  breath(dur, vol, f1, f2, peak, q) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; s.loop = true; fl.type = 'bandpass'; fl.Q.value = q || 0.9;
    fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * peak); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); this.route(g, 0.3); s.start(t); s.stop(t + dur + 0.05);
  },

  // Один слог смеха «ха»: голос f0 с форматами; t0 — задержка, len — длина
  _ha(t0, f0, len, vol, vowel, f1) {
    const c = this.ctx, t = c.currentTime + t0;
    const F = vowel === 'o' ? [520, 900, 2400] : vowel === 'e' ? [450, 1900, 2600] : [800, 1250, 2500];
    const o = c.createOscillator(), o2 = c.createOscillator(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(50, f1 || f0 * 0.8), t + len);
    o2.frequency.setValueAtTime(f0 * 0.5, t); o2.frequency.exponentialRampToValueAtTime(Math.max(40, (f1 || f0 * 0.8) * 0.5), t + len);
    vib.frequency.value = 7 + Math.random() * 3; vg.gain.value = f0 * 0.03; vib.connect(vg); vg.connect(o.frequency);
    const sum = c.createGain(), env = c.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vol, t + 0.02); env.gain.exponentialRampToValueAtTime(0.001, t + len);
    const g2 = c.createGain(); g2.gain.value = 0.45; o.connect(sum); o2.connect(g2); g2.connect(sum);
    F.forEach((fr, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 7 + i * 2;
      const bg = c.createGain(); bg.gain.value = [1, 0.7, 0.35][i];
      sum.connect(bp); bp.connect(bg); bg.connect(env);
    });
    // придыхание «х»
    const ns = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    ns.buffer = this.nb; ns.loop = true; nf.type = 'highpass'; nf.frequency.value = 2500;
    ng.gain.setValueAtTime(vol * 0.55, t); ng.gain.exponentialRampToValueAtTime(0.001, t + len * 0.6);
    ns.connect(nf); nf.connect(ng); ng.connect(env);
    this.route(env, 0.55);
    o.start(t); o2.start(t); vib.start(t); ns.start(t);
    const e = t + len + 0.05; o.stop(e); o2.stop(e); vib.stop(e); ns.stop(e);
  },

  // n слогов «ха-ха-ха»: pitch — высота голоса, big — злой длинный хохот (K.O.)
  laugh(n, pitch, big) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    if (now - this.laughT < (big ? 0 : 1.1)) return;
    this.laughT = now + (big ? 2.5 : 0);
    let t = 0, f = pitch || 150;
    const vow = ['a', 'o', 'a', 'e'];
    for (let i = 0; i < n; i++) {
      const len = big ? 0.2 : 0.14;
      this._ha(t, f * (1 + Math.random() * 0.06), len, big ? 0.5 : 0.38, vow[i % 4], f * 0.78);
      t += len + (big ? 0.07 : 0.05) + Math.random() * 0.03;
      f *= big ? 0.965 : 0.93;
    }
    if (big) { this.tone(f * 0.5, f * 0.25, 1.2, 'sawtooth', 0.12, 0.8); }
  },

  // фоновый гул арены: два расстроенных низких пилообразных осциллятора
  startDrone() {
    if (!this.ctx || this.drone || this.noDrone) return;
    const c = this.ctx, g = c.createGain(), fl = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.07, c.currentTime + 3);
    fl.type = 'lowpass'; fl.frequency.value = 160; lfo.frequency.value = 0.12; lg.gain.value = 70; lfo.connect(lg); lg.connect(fl.frequency);
    const os = [41, 41.4, 61.6].map(f => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(fl); o.start(); return o; });
    fl.connect(g); this.route(g, 0.4); lfo.start();
    this.drone = { g, os, lfo };
  },
  stopDrone() {
    if (!this.drone) return;
    const d = this.drone; this.drone = null;
    try { d.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1); setTimeout(() => { d.os.forEach(o => o.stop()); d.lfo.stop(); }, 1200); } catch (e) { /* ok */ }
  },

  play(name) {
    if (!this.on || !this.ctx) return;
    try {
      switch (name) {
        case 'whoosh': this.noise(0.16, 0.22, 'bandpass', 600, 2800, 0.1); break;
        case 'katana': this.noise(0.18, 0.2, 'highpass', 2000, 6000, 0.15); this.tone(2300, 3600, 0.22, 'sine', 0.04, 0.4); break;
        case 'hit': this.noise(0.14, 0.5, 'lowpass', 2200, 200, 0.12); this.tone(160, 55, 0.12, 'sine', 0.5); break;
        case 'heavy': this.noise(0.28, 0.7, 'lowpass', 2600, 120, 0.2); this.tone(120, 38, 0.28, 'sine', 0.85, 0.2); break;
        case 'slice': this.noise(0.12, 0.45, 'highpass', 3500, 1200, 0.2); this.tone(220, 70, 0.14, 'sine', 0.4); this.tone(1800, 900, 0.1, 'triangle', 0.08, 0.3); break;
        case 'block': this.tone(520, 260, 0.08, 'square', 0.18, 0.2); this.noise(0.08, 0.3, 'highpass', 3000, 1500); this.tone(1400, 1100, 0.3, 'sine', 0.05, 0.5); break;
        case 'magic': this.tone(260, 1100, 0.35, 'sine', 0.3, 0.5); this.noise(0.3, 0.12, 'bandpass', 400, 2000, 0.4); break;
        case 'fire': this.noise(0.5, 0.35, 'lowpass', 1500, 200, 0.3); this.tone(180, 90, 0.4, 'sawtooth', 0.14); break;
        case 'bolt': this.noise(0.35, 0.8, 'highpass', 5000, 400, 0.5); this.tone(90, 30, 0.6, 'sine', 0.9, 0.5); break;
        case 'warn': this.tone(900, 1300, 0.3, 'sine', 0.08, 0.3); break;
        case 'heal': this.tone(520, 1040, 0.4, 'sine', 0.2, 0.6); setTimeout(() => this.ctx && this.tone(780, 1560, 0.4, 'sine', 0.15, 0.6), 120); break;
        case 'jump': this.tone(260, 520, 0.1, 'sine', 0.15); break;
        case 'land': this.noise(0.08, 0.25, 'lowpass', 500, 120); break;
        case 'inv': this.tone(1200, 1800, 0.12, 'triangle', 0.1, 0.5); break;
        case 'inhale': this.breath(0.9, 0.55, 250, 2200, 0.85, 1.4); this.tone(70, 110, 0.9, 'sawtooth', 0.1, 0.3); break;
        case 'exhale': this.breath(0.8, 0.5, 2400, 400, 0.15, 0.8); this.noise(0.5, 0.2, 'highpass', 4000, 3000, 0.3); this.tone(180, 60, 0.7, 'sawtooth', 0.12, 0.4); break;
        case 'breathOn': this.tone(110, 55, 1.0, 'sawtooth', 0.35, 0.6); this.tone(880, 1760, 0.6, 'sine', 0.12, 0.7); this.noise(0.7, 0.4, 'bandpass', 500, 4000, 0.5); break;
        case 'beat': this.tone(70, 40, 0.14, 'sine', 0.7); setTimeout(() => this.ctx && this.tone(60, 36, 0.16, 'sine', 0.5), 150); break;
        case 'laughHit': this.laugh(3 + (Math.random() * 2 | 0), 140 + Math.random() * 50, false); break;
        case 'laughKO': this.laugh(9, 125, true); break;
        case 'ko': this.tone(220, 35, 0.9, 'sawtooth', 0.35, 0.6); this.noise(0.6, 0.4, 'lowpass', 1500, 80, 0.4); break;
        case 'ui': this.tone(620, 880, 0.07, 'triangle', 0.2); break;
        case 'buy': this.tone(700, 1400, 0.1, 'square', 0.1); setTimeout(() => this.ctx && this.tone(1050, 2100, 0.2, 'triangle', 0.15, 0.4), 90); break;
        case 'win': this.tone(440, 880, 0.2, 'triangle', 0.25, 0.4); setTimeout(() => this.ctx && this.tone(660, 1320, 0.3, 'triangle', 0.25, 0.5), 180); break;
      }
    } catch (e) { /* звук не критичен */ }
  },
};
