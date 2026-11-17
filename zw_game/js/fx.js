'use strict';
// Частицы, всплывающие числа, спрайтовые эффекты, пар/дым дыхания, молнии и волны — в мировых координатах.

// Живое пламя: несколько языков, каждый дёргается (случайные рывки раз в ~1/14 с + плавное покачивание),
// огонь горит на месте, а не плывёт. col — внешний цвет, core — яркая сердцевина.
function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function drawFlame(c, x, y, w, h, t, seed, col, core, alpha) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const n = 6, step = Math.floor(t * 14);
  for (let i = 0; i < n; i++) {
    const ph = seed * 13.7 + i * 2.399, jit = h1(step * 0.37 + i * 7.1 + seed * 3.3) - 0.5;
    const fl = clamp(0.7 + 0.16 * Math.sin(t * (8 + i * 1.7) + ph) + 0.28 * jit, 0.3, 1.1);
    const hh = h * fl * (0.55 + 0.45 * ((i * 0.618 + seed) % 1));
    const bx = x + ((i + 0.5) / n - 0.5) * w;
    const sway = Math.sin(t * (3 + i * 0.9) + ph) * w * 0.1 + jit * w * 0.12;
    const ww = w / n * (1.5 + 0.35 * Math.sin(t * 11 + ph));
    for (const [k, col2, a] of [[1, col, 0.5], [0.45, core, 0.32]]) {
      const wk = ww * k, hk = hh * (k === 1 ? 1 : 0.62);
      const gr = c.createLinearGradient(0, y, 0, y - hk);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, col2); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = a * alpha; c.fillStyle = gr;
      c.beginPath(); c.moveTo(bx - wk, y);
      c.bezierCurveTo(bx - wk, y - hk * 0.45, bx - wk * 0.3 + sway * 0.5, y - hk * 0.72, bx + sway, y - hk);
      c.bezierCurveTo(bx + wk * 0.3 + sway * 0.5, y - hk * 0.72, bx + wk, y - hk * 0.45, bx + wk, y);
      c.closePath(); c.fill();
    }
  }
  // пульсирующее свечение у основания
  const gl = c.createRadialGradient(x, y - h * 0.2, 2, x, y - h * 0.2, w * 1.1);
  gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = alpha * (0.22 + 0.1 * Math.sin(t * 13 + seed) + 0.1 * (h1(step + seed) - 0.5));
  c.fillStyle = gl; c.beginPath(); c.arc(x, y - h * 0.2, w * 1.1, 0, TAU); c.fill();
  c.restore();
}

const SOFT = {};
function softPuff(col) {      // мягкий шарик (кэш по цвету) для дыма и пара
  if (SOFT[col]) return SOFT[col];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  // холст рисуем с альфой-градиентом: цвет задаётся через маску
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(32, 32, 0, 32, 32, 32); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.45, 'rgba(0,0,0,0.6)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 64, 64);
  return (SOFT[col] = cv);
}

class FX {
  constructor() { this.p = []; this.t = []; this.s = []; this.bolts = []; this.rings = []; }

  spark(x, y, n, col, spd = 300, size = 3, life = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(0.3, 1) * spd;
      this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rand(0.5, 1) * life, max: life, s: rand(0.6, 1.4) * size, col, g: 700, add: true });
    }
  }

  // медленный дымок: пыль, споры
  puff(x, y, n, col, size = 6, life = 0.8, up = 40) {
    for (let i = 0; i < n; i++) {
      this.p.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-30, 30), vy: -rand(0.3, 1) * up, life: rand(0.6, 1) * life, max: life, s: rand(0.6, 1.3) * size, col, g: -20, add: false });
    }
  }

  // пар изо рта: белое облачко, растёт и расползается вперёд-вверх
  steam(x, y, f, n, big) {
    for (let i = 0; i < n; i++) {
      const sp = rand(60, 150) * (big ? 1.5 : 1);
      this.p.push({ x, y, vx: f * sp + rand(-20, 20), vy: -rand(10, 60), life: rand(0.8, 1.3), max: 1.3, s: rand(5, 9) * (big ? 1.4 : 1), col: '#e8f0ff', g: -30, add: false, grow: 3.2, a: 0.5, drag: 2.2 });
    }
  }

  // густой дым вдоха: рождается вокруг, втягивается в рот (tx,ty)
  smoke(tx, ty, n, col) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = rand(70, 190);
      this.p.push({ x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r * 0.8, vx: 0, vy: 0, life: rand(0.5, 0.9), max: 0.9, s: rand(14, 28), col: col || '#aab4c4', g: 0, add: false, grow: -0.6, a: 0.55, suck: [tx, ty, 420], drag: 0 });
    }
  }

  ember(x, y, n, col) {
    for (let i = 0; i < n; i++)
      this.p.push({ x: x + rand(-30, 30), y: y + rand(-10, 10), vx: rand(-40, 40), vy: -rand(60, 200), life: rand(0.6, 1.2), max: 1.2, s: rand(1.5, 3.5), col, g: -60, add: true });
  }

  text(x, y, str, col, size) { this.t.push({ x, y, str, col, size, life: 0.9, max: 0.9 }); }

  // спрайт из арт-листа (fxBurst, fxCrescent): вспыхивает, растёт и гаснет
  img(name, x, y, scale, rot, life, flip) { this.s.push({ name, x, y, scale, rot, life, max: life, flip: flip || 1 }); }

  // молния сверху вниз в точку x
  bolt(x, col) {
    const pts = [[x + rand(-90, 90), -760]];
    for (let i = 1; i < 9; i++) pts.push([x + rand(-45, 45) * (1 - i / 9), -760 + i * 95]);
    pts.push([x, 0]);
    this.bolts.push({ pts, life: 0.28, max: 0.28, col });
  }

  // расходящееся кольцо (ударная волна, активация дыхания)
  ring(x, y, r, col, life) { this.rings.push({ x, y, r, col, life, max: life }); }

  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt;
      if (q.life <= 0) { this.p.splice(i, 1); continue; }
      if (q.suck) {
        const dx = q.suck[0] - q.x, dy = q.suck[1] - q.y, d = Math.hypot(dx, dy) || 1, a = q.suck[2];
        q.vx += dx / d * a * dt * 3; q.vy += dy / d * a * dt * 3; q.vx *= 0.94; q.vy *= 0.94;
        if (d < 14) { this.p.splice(i, 1); continue; }
      }
      if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; }
      q.vy += q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.grow) q.s = Math.max(1, q.s + q.grow * dt * 6);
    }
    for (let i = this.t.length - 1; i >= 0; i--) {
      const q = this.t[i];
      q.life -= dt;
      if (q.life <= 0) { this.t.splice(i, 1); continue; }
      q.y -= 60 * dt;
    }
    for (let i = this.s.length - 1; i >= 0; i--) { this.s[i].life -= dt; if (this.s[i].life <= 0) this.s.splice(i, 1); }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
    if (this.p.length > 700) this.p.splice(0, this.p.length - 700);
  }

  draw(c) {
    c.save();
    if (Sprites.ok) {
      c.globalCompositeOperation = 'lighter';
      for (const q of this.s) {
        const k = q.life / q.max, S = SpriteData[q.name], sc = q.scale * (1.5 - k * 0.5) * (S.k || 1);
        c.globalAlpha = Math.min(1, k * 1.6);
        c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.scale(q.flip * sc, sc);
        c.drawImage(Sprites.atlas, S.sx, S.sy, S.sw, S.sh, -S.sw / 2, -S.sh / 2, S.sw, S.sh);
        c.restore();
      }
    }
    // кольца
    c.globalCompositeOperation = 'lighter';
    for (const q of this.rings) {
      const k = q.life / q.max;
      c.globalAlpha = k * 0.8; c.strokeStyle = q.col; c.lineWidth = 3 + 10 * k;
      c.beginPath(); c.ellipse(q.x, q.y, q.r * (1.2 - k) * 1.2, q.r * (1.2 - k) * 0.4, 0, 0, TAU); c.stroke();
    }
    // молнии
    for (const b of this.bolts) {
      const k = b.life / b.max;
      for (const [w, a, col] of [[16, 0.25, b.col], [6, 0.7, b.col], [2.5, 1, '#fff']]) {
        c.globalAlpha = a * k; c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round';
        c.beginPath(); b.pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
      }
    }
    for (const q of this.p) {
      const k = q.life / q.max;
      c.globalCompositeOperation = q.add ? 'lighter' : 'source-over';
      c.globalAlpha = q.add ? k : k * (q.a || 0.45);
      if (q.grow || q.suck) { const s = q.s * 2.4; c.drawImage(softPuff(q.col), q.x - s, q.y - s, s * 2, s * 2); continue; }
      c.fillStyle = q.col;
      c.beginPath();
      c.arc(q.x, q.y, q.s * (q.add ? k : 1.6 - k * 0.6), 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    c.textAlign = 'center';
    for (const q of this.t) {
      const k = q.life / q.max;
      c.globalAlpha = Math.min(1, k * 2);
      c.font = 'bold ' + q.size + 'px Impact, "Arial Black", sans-serif';
      c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(q.str, q.x, q.y);
      c.fillStyle = q.col; c.fillText(q.str, q.x, q.y);
    }
    c.restore();
  }
}
