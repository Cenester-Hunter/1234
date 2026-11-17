'use strict';
// Фон «псевдо-3D»: небо, параллакс-слои разной скорости, пол в перспективе, колонны арены,
// живые частицы (лепестки, споры, угли). Слои рисуются один раз в offscreen-канвас.

const HZ = 430;      // линия горизонта на экране
const GSY = 600;     // y земли, на которой стоят бойцы
const LW = 2180, LH = 420;

function ridge(g, w, h, base, amp, col, rng, seg) {
  g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  let y = base;
  for (let x = 0; x <= w + seg; x += seg) {
    y = clamp(y + (rng() - 0.5) * amp, base - amp * 2.2, base + amp * 0.6);
    g.lineTo(x, y);
  }
  g.lineTo(w, h); g.closePath(); g.fill();
}

function glowDot(g, x, y, r, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

function pagoda(g, x, y, s, col) {
  g.fillStyle = col;
  for (let i = 0; i < 4; i++) {
    const w = (70 - i * 12) * s, yy = y - i * 34 * s;
    g.fillRect(x - w / 2 + 6 * s, yy - 22 * s, w - 12 * s, 22 * s);
    g.beginPath(); g.moveTo(x - w * 0.8, yy - 22 * s); g.lineTo(x, yy - 38 * s); g.lineTo(x + w * 0.8, yy - 22 * s); g.closePath(); g.fill();
  }
  g.fillRect(x - 2 * s, y - 4 * 34 * s - 30 * s, 4 * s, 30 * s);
}

function tree(g, x, y, len, ang, depth, rng) {
  if (depth <= 0 || len < 6) return;
  const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
  g.lineWidth = depth * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  tree(g, x2, y2, len * rng() * 0.25 + len * 0.6, ang - 0.3 - rng() * 0.5, depth - 1, rng);
  tree(g, x2, y2, len * rng() * 0.25 + len * 0.6, ang + 0.3 + rng() * 0.5, depth - 1, rng);
}

const THEMES = {
  dojo: {
    seed: 11, sky: ['#0d1533', '#2b2552', '#b5604c'], floor: ['#2a2038', '#0d0a14'], line: 'rgba(255,190,140,0.10)', post: '#3a1a16', lamp: '#ffb04a',
    amb: { col: '#ffb7c8', n: 22, vy: 28, vx: -18, s: 3 },
    layers: [
      { f: 0.03, draw(g, w, h, r) { for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.6) + ')'; g.fillRect(r() * w, r() * 240, 2, 2); } glowDot(g, 1520, 120, 150, 'rgba(255,230,190,0.35)'); g.fillStyle = '#fff1d6'; g.beginPath(); g.arc(1520, 120, 52, 0, TAU); g.fill(); } },
      { f: 0.1, draw(g, w, h, r) { ridge(g, w, h, 250, 60, '#1a2046', r, 40); } },
      { f: 0.25, draw(g, w, h, r) { ridge(g, w, h, 330, 30, '#121733', r, 50); for (const x of [350, 900, 1500, 1950]) { pagoda(g, x, 340, 1.1, '#0b0e21'); glowDot(g, x, 300, 24, 'rgba(255,170,70,0.5)'); } } },
      { f: 0.5, draw(g, w, h, r) { g.fillStyle = '#080b18'; for (let x = 20; x < w; x += 60 + r() * 90) { const bh = 180 + r() * 160; g.fillRect(x, h - bh, 9, bh); for (let k = 0; k < 3; k++) g.fillRect(x - 3, h - bh + k * 55, 15, 3); } for (const x of [260, 760, 1280, 1800]) { g.fillStyle = '#2a1a10'; g.fillRect(x - 1, h - 330, 2, 60); glowDot(g, x, h - 250, 46, 'rgba(255,140,50,0.8)'); } } },
    ],
  },
  ruins: {
    seed: 23, sky: ['#04100c', '#123226', '#2a5a45'], floor: ['#16241f', '#060c0a'], line: 'rgba(140,255,190,0.08)', post: '#1e2c26', lamp: '#58ff9a',
    amb: { col: '#8dffb0', n: 26, vy: -22, vx: 6, s: 3 },
    layers: [
      { f: 0.03, draw(g, w, h, r) { for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(200,255,220,' + (0.2 + r() * 0.5) + ')'; g.fillRect(r() * w, r() * 220, 2, 2); } glowDot(g, 640, 130, 190, 'rgba(120,255,170,0.28)'); g.fillStyle = '#d8ffe6'; g.beginPath(); g.arc(640, 130, 62, 0, TAU); g.fill(); } },
      { f: 0.1, draw(g, w, h, r) { ridge(g, w, h, 270, 50, '#0c2018', r, 36); } },
      { f: 0.25, draw(g, w, h, r) { g.strokeStyle = '#06100c'; for (const x of [200, 640, 1100, 1560, 1980]) tree(g, x, h, 110 + r() * 40, (r() - 0.5) * 0.3, 7, r); g.fillStyle = '#06100c'; for (const x of [420, 880, 1340]) { g.fillRect(x, h - 150, 22, 150); g.fillRect(x + 60, h - 100, 20, 100); } } },
      { f: 0.5, draw(g, w, h, r) { g.fillStyle = '#030806'; for (let x = 30; x < w; x += 90 + r() * 120) { const hh = 40 + r() * 50; g.beginPath(); g.moveTo(x, h); g.lineTo(x, h - hh + 14); g.arc(x + 15, h - hh + 14, 15, Math.PI, 0); g.lineTo(x + 30, h); g.fill(); } g.strokeStyle = '#030806'; tree(g, 1000, h, 150, 0.1, 7, r); } },
    ],
  },
  lava: {
    seed: 37, sky: ['#1a0504', '#6a1a0a', '#ff7a22'], floor: ['#2a0f0a', '#0a0302'], line: 'rgba(255,120,40,0.12)', post: '#2a0d08', lamp: '#ff6a1a',
    amb: { col: '#ff9a3a', n: 34, vy: -50, vx: 10, s: 2.5 },
    layers: [
      { f: 0.03, draw(g, w, h, r) { glowDot(g, 1100, 280, 340, 'rgba(255,120,30,0.5)'); g.fillStyle = '#ffd07a'; g.beginPath(); g.arc(1100, 280, 70, 0, TAU); g.fill(); } },
      { f: 0.1, draw(g, w, h, r) { g.fillStyle = '#2b0c07'; for (const x of [300, 900, 1650]) { g.beginPath(); g.moveTo(x - 330, h); g.lineTo(x - 50, 130); g.lineTo(x + 50, 130); g.lineTo(x + 330, h); g.fill(); glowDot(g, x, 130, 70, 'rgba(255,100,20,0.8)'); } } },
      { f: 0.25, draw(g, w, h, r) { ridge(g, w, h, 330, 90, '#1c0805', r, 30); for (let i = 0; i < 12; i++) glowDot(g, r() * w, h - 10 - r() * 30, 40, 'rgba(255,90,20,0.45)'); } },
      { f: 0.5, draw(g, w, h, r) { g.fillStyle = '#0d0403'; for (let x = 0; x < w; x += 130 + r() * 160) { const hh = 60 + r() * 130; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h - hh); g.lineTo(x + 60, h - hh * 0.6); g.lineTo(x + 90, h); g.fill(); } } },
    ],
  },
};

const Bg = {
  th: null, layers: [], amb: [], t: 0, fog: null, pil: null,
  bgc: null, bgKey: 'bg', sky: null, msk: null, stars: [], meteors: [], metT: 2, moonCv: null, moonSurf: null, moonKey: -1,
  moon: { m: 0.5, e: 0, x: 834, y: 78, p: 0.3 }, PERIOD: 80, P0: 0.3, tx: 0, ts: 1,

  build(name, grade) {
    const th = this.th = THEMES[name], rng = mulberry32(th.seed);
    this.grade = grade || null;
    const bk = this.blood && Sprites.bg3Ok && Sprites.bg3mOk ? 'bg3' : 'bg';
    if (bk !== this.bgKey) { this.bgKey = bk; this.bgc = null; }
    if (Sprites.bgOk) this.layers = [];      // есть нарисованный фон: процедурные слои не нужны
    else this.layers = th.layers.map(L => {
      const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH;
      L.draw(cv.getContext('2d'), LW, LH, rng);
      return { cv, f: L.f };
    });
    this.makeDepth();
    this.amb = [];
    for (let i = 0; i < th.amb.n; i++) this.amb.push({ x: Math.random() * 1280, y: Math.random() * 720, ph: Math.random() * 6 });
  },


  // Заготовки для глубины: текстура тумана и тёмная размытая колонна переднего плана
  makeDepth() {
    if (!this.fog) {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
      const g = cv.getContext('2d'), r = mulberry32(5);
      for (let i = 0; i < 26; i++) {
        const x = r() * 1024, y = 70 + r() * 20, rad = 40 + r() * 38, gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(200,220,235,0.30)'); gr.addColorStop(1, 'rgba(200,220,235,0)');
        for (const dx of [-1024, 0, 1024]) { g.fillStyle = gr; g.save(); g.translate(dx, 0); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); g.restore(); }
      }
      this.fog = cv;
    }
    if (!this.pil) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 780;
      const g = cv.getContext('2d');
      try { g.filter = 'blur(4px)'; } catch (e) { /* без размытия тоже ок */ }
      const lg = g.createLinearGradient(30, 0, 170, 0);
      lg.addColorStop(0, '#05070a'); lg.addColorStop(0.55, '#0b0f14'); lg.addColorStop(1, '#020304');
      g.fillStyle = lg; g.fillRect(36, 0, 128, 780);
      g.fillStyle = '#0a0d12'; g.fillRect(24, 0, 152, 56); g.fillRect(24, 724, 152, 56);   // капитель и основание
      this.pil = cv;
    }
  },

  // воздух между задним планом и бойцами: лучи света и дальний туман (экранные координаты)
  atmos(c, cam, t) {
    const cx = cam.x * cam.s;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = 230 + i * 300 - cx * 0.18 + Math.sin(t * 0.25 + i * 1.7) * 30, a = (0.02 + 0.07 * this.moon.m) + 0.02 * Math.sin(t * 0.6 + i * 2.1);
      const gr = c.createLinearGradient(x, 0, x + 160, 560);
      const rc = this.bgKey === 'bg3' ? '255,170,200' : '190,230,255'; gr.addColorStop(0, 'rgba(' + rc + ',' + a * 2 + ')'); gr.addColorStop(1, 'rgba(' + rc + ',0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 90, 0); c.lineTo(x + 330, 640); c.lineTo(x + 150, 640); c.closePath(); c.fill();
    }
    c.restore();
    c.save(); c.globalAlpha = 0.5;
    const off = (t * 14 + cx * 0.4) % 1024;
    for (const dx of [-1024, 0, 1024]) c.drawImage(this.fog, dx - off, 380, 1024, 200);
    c.restore();
  },

  // передний план: размытые колонны по краям (параллакс сильнее, чем у бойцов), низкий туман и пыль
  fore(c, cam, t) {
    const s = cam.s, cx = cam.x;
    if (this.bgKey === 'bg3') {
      if (!this.branch) this.makeBranch();
      for (const side of [-1, 1]) {
        const sw = Math.sin(t * 0.6 + side) * 6;
        c.save(); c.globalAlpha = 0.95; c.translate(640 + side * 640, -6 + sw * 0.4); c.scale(-side * 1.3, 1.3); c.drawImage(this.branch, 0, 0); c.restore();
      }
    } else for (const side of [-1, 1]) {
      const sx = 640 + side * (655 - clamp(cx * side * 0.2, -30, 50));
      c.save(); c.globalAlpha = 0.9; c.drawImage(this.pil, sx - 100 * s, -30, 200 * s, 780); c.restore();
    }
    c.save(); c.globalAlpha = 0.5;
    const off = (t * 26 + cx * s * 1.5) % 1024;
    for (const dx of [-1024, 0, 1024]) c.drawImage(this.fog, dx - off, 600, 1024, 160);
    c.restore();
  },

  // лепестки сакуры (Локация II): мягко падают, кувыркаются; дальние — позади бойцов, ближние — поверх
  petalInit() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(16, 20, 2, 16, 16, 15); gr.addColorStop(0, '#ffe6ef'); gr.addColorStop(0.6, '#ffb3cc'); gr.addColorStop(1, '#e8618f');
    g.fillStyle = gr; g.beginPath(); g.moveTo(16, 2); g.bezierCurveTo(30, 6, 28, 24, 16, 30); g.bezierCurveTo(4, 24, 2, 6, 16, 2); g.fill();
    g.strokeStyle = 'rgba(190,60,100,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, 6); g.lineTo(16, 26); g.stroke();
    this.petSpr = cv; this.pet = [];
    for (let i = 0; i < 46; i++) this.pet.push({ x: Math.random() * 1360 - 40, y: Math.random() * 760 - 40, z: 0.35 + Math.random() * 1.15, ph: Math.random() * 6.28, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2.4, tw: Math.random() * 6.28 });
  },
  petalsUpdate(dt) {
    if (!this.pet) this.petalInit();
    for (const p of this.pet) {
      p.y += (26 + 26 * p.z) * dt; p.x += (Math.sin(this.t * 0.7 + p.ph) * 26 + 16 * p.z) * dt; p.r += p.vr * dt; p.tw += dt * (1.5 + p.z);
      if (p.y > 750) { p.y = -30; p.x = Math.random() * 1360 - 40; }
      if (p.x > 1320) p.x = -40; if (p.x < -50) p.x = 1310;
    }
  },
  petals(c, front, force) {
    if (!(this.blood || force) || !this.pet) return;
    const S = this.petSpr;
    for (const p of this.pet) {
      if ((p.z > 1) !== front) continue;
      const sz = 11 * p.z, sx = 0.35 + 0.65 * Math.abs(Math.cos(p.tw));
      c.save(); c.globalAlpha = front ? 0.92 : 0.7; c.translate(p.x, p.y); c.rotate(p.r); c.scale(sx, 1);
      c.drawImage(S, -sz, -sz, sz * 2, sz * 2); c.restore();
    }
  },

  update(dt) {
    this.t += dt;
    if (this.blood) this.petalsUpdate(dt);
    this.updateSky(dt);
    const a = this.th.amb;
    for (const p of this.amb) {
      p.y += a.vy * dt; p.x += (a.vx + Math.sin(this.t + p.ph) * 14) * dt;
      if (p.y > 740) p.y = -10; if (p.y < -10) p.y = 740;
      if (p.x < -10) p.x = 1290; if (p.x > 1290) p.x = -10;
    }
  },

  draw(c, cam) {
    const th = this.th, cx = cam.x * cam.s;
    if (Sprites.bgOk) { this.drawImage(c, cx); return; }
    const sk = c.createLinearGradient(0, 0, 0, HZ + 20);
    sk.addColorStop(0, th.sky[0]); sk.addColorStop(0.6, th.sky[1]); sk.addColorStop(1, th.sky[2]);
    c.fillStyle = sk; c.fillRect(0, 0, 1280, HZ + 20);
    for (const L of this.layers) c.drawImage(L.cv, (1280 - LW) / 2 - cx * L.f, HZ - LH);

    // пол в перспективе
    const fl = c.createLinearGradient(0, HZ, 0, 720);
    fl.addColorStop(0, th.floor[0]); fl.addColorStop(1, th.floor[1]);
    c.fillStyle = fl; c.fillRect(0, HZ, 1280, 720 - HZ);
    c.strokeStyle = th.line; c.lineWidth = 2;
    const step = 150 * cam.s, off = ((-cx) % step + step) % step;
    c.beginPath();
    for (let i = -14; i <= 14; i++) {
      const xb = 640 + i * step + off - step * 0;
      c.moveTo(640 + (xb - 640) * 0.12, HZ); c.lineTo(xb, 720);
    }
    for (let k = 1; k < 9; k++) { const y = HZ + Math.pow(k / 9, 1.9) * (720 - HZ); c.moveTo(0, y); c.lineTo(1280, y); }
    c.stroke();
    // свет на полу под бойцами
    const lg = c.createRadialGradient(640, GSY, 20, 640, GSY, 520);
    lg.addColorStop(0, 'rgba(255,255,255,0.07)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg; c.fillRect(0, HZ, 1280, 720 - HZ);
  },

  // Нарисованный фон: параллакс (фон двигается медленнее бойцов), затемнение пола, цветокоррекция стадии.
  drawImage(c, cx) {
    if (!this.bgc) this.prepBg();
    const im = this.bgc || Sprites.bg, s = 720 / im.height, w = im.width * s, mx = (w - 1280) / 2;
    const sh = clamp(cx * 0.2, -mx, mx), ox = (1280 - w) / 2 - sh;
    this.tx = ox; this.ts = s;
    c.drawImage(im, ox, 0, w, 720);
    if (this.bgc) this.drawSky(c);
    const g = c.createLinearGradient(0, 400, 0, 720);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = g; c.fillRect(0, 400, 1280, 320);
    if (this.bgc && this.bgKey !== 'bg3') this.drawFires(c);
    const gr = this.grade;
    if (gr && gr[3] > 0) {
      c.save(); c.globalCompositeOperation = 'color'; c.globalAlpha = gr[3];
      c.fillStyle = 'rgb(' + gr[0] + ',' + gr[1] + ',' + gr[2] + ')'; c.fillRect(0, 0, 1280, 720); c.restore();
    }
  },

  // ---------- небо: убираем нарисованную луну, ставим живую (фазы), звёзды и падающие звёзды только в просветах неба
  prepBg() {
    if (!Sprites.bgOk) return;
    const b3 = this.bgKey === 'bg3', im = b3 ? Sprites.bg3 : Sprites.bg, W = im.width, H = im.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    let d;
    try { d = g.getImageData(0, 0, W, H); } catch (e) { return; }
    const px = d.data, mx = 631, my = 47, R = 19, K = W / 1024;
    const cxm = Math.round(mx * K), cym = Math.round(my * K), Rk = Math.ceil(R * K);
    for (let y = cym - Rk; y <= (b3 ? cym - Rk - 1 : cym + Rk); y++) {          // закрашиваем старую луну: строка за строкой плавный переход слева направо
      const xl = cxm - Rk - 4, xr = cxm + Rk + 4, il = (y * W + xl) * 4, ir = (y * W + xr) * 4;
      for (let x = cxm - Rk - 1; x <= cxm + Rk + 1; x++) {
        if (Math.hypot(x - cxm, y - cym) > Rk + 1) continue;
        const u = (x - xl) / (xr - xl), i = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) px[i + k] = px[il + k] + (px[ir + k] - px[il + k]) * u;
      }
    }
    g.putImageData(d, 0, 0);
    // маска неба: голубовато-серые пиксели верхней части картинки
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mg = m.getContext('2d'), md = mg.createImageData(W, H);
    const pos = [];
    let mk = null;       // японская арена: маска неба нарисована вместе с картинкой
    if (b3) { const t = document.createElement('canvas'); t.width = W; t.height = H; const tg = t.getContext('2d'); tg.drawImage(Sprites.bg3m, 0, 0, W, H); try { mk = tg.getImageData(0, 0, W, H).data; } catch (e) { mk = null; } }
    for (let y = 0; y < Math.floor(H * (b3 ? 0.7 : 0.62)); y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = px[i], gg = px[i + 1], bl = px[i + 2];
      if (mk ? mk[i] > 128 : (bl >= gg + 3 && bl >= r + 10 && r + gg + bl > 150)) { md.data[i + 3] = 255; if (!(x % 3) && !(y % 3)) pos.push([x / K, y / K]); }
    }
    mg.putImageData(md, 0, 0);
    this.bgc = cv; this.sky = m;
    this.msk = document.createElement('canvas'); this.msk.width = 640; this.msk.height = 360;
    // звёзды
    const r = mulberry32(99); this.stars = [];
    for (let i = 0; i < 70 && pos.length; i++) { const p = pos[Math.floor(r() * pos.length)]; this.stars.push({ x: p[0], y: p[1], ph: r() * 6, sz: 0.6 + r() * 1.3, sp: 1.5 + r() * 4 }); }
    // поверхность луны (процедурная): моря, кратеры, затемнение к краю
    const ms = document.createElement('canvas'); ms.width = ms.height = 128;
    const s = ms.getContext('2d'), rr = mulberry32(7);
    s.beginPath(); s.arc(64, 64, 63, 0, TAU); s.clip();
    s.fillStyle = '#d6d9de'; s.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 10; i++) { const x = 20 + rr() * 88, y = 20 + rr() * 88, q = 9 + rr() * 20, gr = s.createRadialGradient(x, y, 0, x, y, q); gr.addColorStop(0, 'rgba(82,88,102,0.62)'); gr.addColorStop(1, 'rgba(82,88,102,0)'); s.fillStyle = gr; s.beginPath(); s.arc(x, y, q, 0, TAU); s.fill(); }
    for (let i = 0; i < 55; i++) { const x = rr() * 128, y = rr() * 128, q = 1.5 + rr() * 5; s.strokeStyle = 'rgba(255,255,255,0.35)'; s.lineWidth = 1; s.beginPath(); s.arc(x, y, q, 0, TAU); s.stroke(); s.fillStyle = 'rgba(60,66,80,0.25)'; s.beginPath(); s.arc(x + 0.8, y + 0.8, q * 0.8, 0, TAU); s.fill(); }
    const lb = s.createRadialGradient(64, 64, 30, 64, 64, 64); lb.addColorStop(0, 'rgba(0,0,0,0)'); lb.addColorStop(1, 'rgba(0,0,0,0.55)');
    s.fillStyle = lb; s.fillRect(0, 0, 128, 128);
    this.moonSurf = ms;
    this.moonCv = document.createElement('canvas'); this.moonCv.width = this.moonCv.height = 128;
    this.moonTmp = document.createElement('canvas'); this.moonTmp.width = this.moonTmp.height = 128;
  },

  // Фаза луны p: 0 новолуние, 0.5 полнолуние. Освещённая часть = полудиск + полуэллипс-терминатор.
  // На полнолуние в каждый второй цикл бывает затмение: диск краснеет, как «кровавая луна».
  renderMoon(p, e) {
    const cv = this.moonCv, g = cv.getContext('2d'), tm = this.moonTmp, tg = tm.getContext('2d');
    const th = p * TAU, wax = p < 0.5, a = wax ? th : (1 - p) * TAU, R = 62;
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, 128, 128);
    tg.save(); tg.translate(64, 64); if (!wax) tg.scale(-1, 1);
    tg.fillStyle = '#fff'; tg.beginPath(); tg.moveTo(0, -R); tg.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
    const cs = Math.cos(a); tg.ellipse(0, 0, Math.max(0.5, Math.abs(cs) * R), R, 0, Math.PI / 2, -Math.PI / 2, cs > 0); tg.closePath(); tg.fill(); tg.restore();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, 128, 128);
    try { g.filter = 'blur(1.2px)'; } catch (er) { /* ок */ }
    g.drawImage(tm, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-in'; g.drawImage(this.moonSurf, 0, 0);           // освещённая часть = поверхность
    g.globalCompositeOperation = 'destination-over'; g.globalAlpha = 0.07 + 0.8 * e; g.drawImage(this.moonSurf, 0, 0); g.globalAlpha = 1;   // тёмная сторона едва видна (при затмении — почти вся)
    if (e > 0) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(205,70,28,' + (0.72 * e) + ')'; g.fillRect(0, 0, 128, 128); }
    g.globalCompositeOperation = 'source-over';
  },

  updateSky(dt) {
    if (!this.bgc) return;
    const cyc = this.t / this.PERIOD + this.P0, n = Math.floor(cyc), p = cyc - n;
    const m = (1 - Math.cos(p * TAU)) / 2, e = (n % 2 === 1) ? clamp(1 - Math.abs(p - 0.5) / 0.045, 0, 1) : 0;
    this.moon.m = m; this.moon.e = e * e * (3 - 2 * e); this.moon.p = p;
    if (this.blood) { this.moon.m = 0.95; this.moon.e = 1; this.moon.p = 0.5; }
    const key = Math.round(p * 160) + this.moon.e * 1000 | 0;
    if (key !== this.moonKey) { this.moonKey = key; this.renderMoon(p, this.moon.e); }
    this.metT -= dt;
    if (this.metT <= 0) {
      this.metT = 2 + Math.random() * 4.5;
      const k = 1 + (Math.random() < 0.3 ? 1 : 0);
      for (let i = 0; i < k; i++) this.meteors.push({ x: 520 + Math.random() * 230, y: 5 + Math.random() * 80, vx: -(110 + Math.random() * 70), vy: 120 + Math.random() * 60, life: 1.3, max: 1.3 });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) { const q = this.meteors[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) this.meteors.splice(i, 1); }
  },

  drawSky(c) {
    const s = this.ts, ox = this.tx, M = this.moon;
    const X = x => ox + x * s, Y = y => y * s;
    c.save(); c.globalCompositeOperation = 'lighter';
    // звёзды мерцают
    for (const q of this.stars) {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(this.t * q.sp + q.ph)) * (0.5 + 0.5 * (1 - M.m * 0.7));
      c.globalAlpha = a; c.fillStyle = '#e8f0ff'; const z = q.sz * 1.2;
      c.fillRect(X(q.x) - z / 2, Y(q.y) - z / 2, z, z);
      if (q.sz > 1.5) { c.fillRect(X(q.x) - z * 1.5, Y(q.y) - 0.4, z * 3, 0.8); c.fillRect(X(q.x) - 0.4, Y(q.y) - z * 1.5, 0.8, z * 3); }
    }
    // луна: ореол по яркости фазы (при затмении красный), диск
    const mx = X(631), my = Y(47), R = 27 * s / 1.659;
    M.x = mx; M.y = my;
    const hr = (45 + 90 * M.m) * s / 1.659, hc = M.e > 0.05 ? '210,80,40' : '190,215,255';
    const gr = c.createRadialGradient(mx, my, R * 0.8, mx, my, hr);
    gr.addColorStop(0, 'rgba(' + hc + ',' + (0.07 + 0.2 * M.m) + ')'); gr.addColorStop(1, 'rgba(' + hc + ',0)');
    c.globalAlpha = 1; c.fillStyle = gr; c.beginPath(); c.arc(mx, my, hr, 0, TAU); c.fill();
    c.restore();
    c.drawImage(this.moonCv, mx - R, my - R, R * 2, R * 2);
    // падающие звёзды: рисуются во временный холст и режутся маской неба, так что видны только в просветах
    if (this.meteors.length) {
      const t = this.msk, g = t.getContext('2d'), k = 0.5;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 640, 360);
      g.drawImage(this.sky, ox * k, 0, this.sky.width * s * k, 720 * k);
      g.globalCompositeOperation = 'source-in'; g.lineCap = 'round';
      for (const q of this.meteors) {
        const f = Math.min(1, q.life / q.max), fi = Math.min(1, (q.max - q.life) / 0.12) , a = f * fi;
        const hx = X(q.x) * k, hy = Y(q.y) * k, L = 0.13, tx = hx - q.vx * L * s * k, ty = hy - q.vy * L * s * k;
        const lg = g.createLinearGradient(hx, hy, tx, ty); lg.addColorStop(0, 'rgba(255,255,255,' + a + ')'); lg.addColorStop(1, 'rgba(160,200,255,0)');
        g.strokeStyle = lg; g.lineWidth = 2.8; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
        g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.arc(hx, hy, 1.8, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(t, 0, 0, 1280, 720); c.restore();
    }
  },

  // ---------- живой зелёный огонь поверх нарисованного: горит на месте, дёргается
  drawFires(c) {
    const s = this.ts, ox = this.tx, t = this.t;
    const F = (xi, yi, w, h, seed, a) => drawFlame(c, ox + xi * s, yi * s, w * s, h * s, t, seed, this.blood ? '#ff3a2a' : '#2cff66', this.blood ? '#ffd0a0' : '#9dffb8', a);
    F(348, 392, 100, 170, 0.11, 0.5);
    F(310, 402, 50, 70, 0.52, 0.6);
    F(392, 402, 44, 60, 0.83, 0.55);
    F(452, 408, 36, 44, 0.27, 0.6);
    F(236, 372, 30, 38, 0.66, 0.5);
  },

  // рунический круг на полу (из листа окружения): пульсирует, чтобы пол не был мёртвым
  // Японская арена: магическая руна кицунэ на земле (эллипс-перспектива, пульсирует)
  rune(c, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const pu = 0.55 + 0.2 * Math.sin(t * 2), rx = 360, ry = 66;
    c.translate(0, 52); c.lineCap = 'round';
    for (const [k, w, a] of [[1, 3, 0.9], [0.86, 2, 0.7], [0.5, 2, 0.6]]) {
      c.strokeStyle = 'rgba(255,70,120,' + a * pu + ')'; c.lineWidth = w; c.beginPath(); c.ellipse(0, 0, rx * k, ry * k, 0, 0, TAU); c.stroke();
    }
    c.strokeStyle = 'rgba(255,110,150,' + 0.7 * pu + ')'; c.lineWidth = 2;
    for (const off of [0, Math.PI]) {       // две перевёрнутые треугольные звезды (хэксаграмма)
      c.beginPath();
      for (let i = 0; i < 3; i++) { const a = off - Math.PI / 2 + i * TAU / 3; c.lineTo(Math.cos(a) * rx * 0.86, Math.sin(a) * ry * 0.86); }
      c.closePath(); c.stroke();
    }
    c.fillStyle = 'rgba(255,150,180,' + 0.8 * pu + ')';
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU + t * 0.1; c.fillRect(Math.cos(a) * rx * 0.93 - 1, Math.sin(a) * ry * 0.93 - 1, 3, 3); }
    const gr = c.createRadialGradient(0, 0, 10, 0, 0, rx); gr.addColorStop(0, 'rgba(255,60,110,' + 0.25 * pu + ')'); gr.addColorStop(1, 'rgba(255,60,110,0)');
    c.save(); c.scale(1, ry / rx); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    c.restore();
  },
  // ветви сакуры на краях кадра (передний план, размыто)
  makeBranch() {
    const cv = document.createElement('canvas'); cv.width = 420; cv.height = 300; const g = cv.getContext('2d'), r = mulberry32(21);
    g.strokeStyle = '#140810'; g.lineCap = 'round'; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 40); g.quadraticCurveTo(150, 30, 300, 150); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(130, 60); g.quadraticCurveTo(220, 80, 330, 40); g.stroke();
    for (let i = 0; i < 46; i++) {
      const t = r(), x = t * 330 + (r() - 0.5) * 70, y = 40 + t * 100 + (r() - 0.3) * 100, q = 10 + r() * 20, gr = g.createRadialGradient(x, y, 0, x, y, q);
      gr.addColorStop(0, 'rgba(255,205,225,0.95)'); gr.addColorStop(0.6, 'rgba(255,140,185,0.8)'); gr.addColorStop(1, 'rgba(255,120,170,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, q, 0, TAU); g.fill();
    }
    this.branch = cv;
  },
  decor(c, t) {
    if (this.bgKey === 'bg3') { this.rune(c, t); return; }
    if (!Sprites.envOk) return;
    const S = EnvData.circle;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.18 * Math.sin(t * 2);
    c.drawImage(Sprites.env, S.sx, S.sy, S.sw, S.sh, -380, -22, 760, 150);
    c.restore();
  },

  // колонны по краям арены (в мировых координатах, вызывать внутри трансформа камеры)
  posts(c) {
    const th = this.th;
    if (this.bgKey === 'bg3' && Sprites.komainuOk) {     // статуи Комаину по краям арены
      const K = Sprites.komainu, k = 2.1, w = K.width * k, h = K.height * k;
      for (const [x, f] of [[-ARENA - 110, 1], [ARENA + 110, -1]]) {
        c.save(); c.translate(x, 18); c.scale(f, 1);
        c.fillStyle = '#1a0c16'; c.fillRect(-w * 0.55, -26, w * 1.1, 30); c.fillStyle = '#2a1424'; c.fillRect(-w * 0.5, -34, w, 12);   // постамент
        c.drawImage(K, -w / 2, -26 - h, w, h);
        const g = c.createRadialGradient(0, -h * 0.5, 6, 0, -h * 0.5, 150); g.addColorStop(0, 'rgba(255,60,100,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(0, -h * 0.5, 150, 0, TAU); c.fill(); c.restore();
      }
      return;
    }
    if (Sprites.envOk) {
      for (const [x, S] of [[-ARENA - 120, EnvData.colA], [ARENA + 120, EnvData.colB]]) {
        const k = 2.5, w = S.sw * k, h = S.sh * k;
        c.drawImage(Sprites.env, S.sx, S.sy, S.sw, S.sh, x - w / 2, 14 - h, w, h);
        const g = c.createRadialGradient(x, -h * 0.55, 6, x, -h * 0.55, 150);
        g.addColorStop(0, 'rgba(90,255,140,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, -h * 0.55, 150, 0, TAU); c.fill(); c.restore();
      }
      return;
    }
    for (const x of [-ARENA - 70, ARENA + 70]) {
      c.fillStyle = th.post; c.fillRect(x - 16, -300, 32, 300);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 4, -300, 12, 300);
      const g = c.createRadialGradient(x, -310, 4, x, -310, 110);
      g.addColorStop(0, th.lamp); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; c.fillStyle = g;
      c.beginPath(); c.arc(x, -310, 110, 0, TAU); c.fill(); c.restore();
      c.fillStyle = th.lamp; c.fillRect(x - 9, -322, 18, 20);
    }
  },

  // частицы поверх сцены
  front(c) {
    const a = this.th.amb;
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = a.col;
    for (const p of this.amb) { c.globalAlpha = clamp(0.25 + 0.35 * Math.sin(this.t * 2 + p.ph) + 0.4 * (h1(Math.floor(this.t * 12) + p.ph * 9) - 0.5), 0.05, 1); c.beginPath(); c.arc(p.x, p.y, a.s, 0, TAU); c.fill(); }
    c.restore();
  },
};
