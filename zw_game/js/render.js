'use strict';
// Отрисовка бойцов, снарядов и боевого интерфейса.
// КОНВЕЙЕР БОЙЦА (все бойцы — абсолютно чёрные силуэты, но с объёмом):
//   1) задний слой (плащ, дальние рука и нога) рисуется из деталей арт-листа в буфер A и закрашивается чёрным;
//   2) передний слой (торс, голова, ближняя нога, оружие, рука) рисуется в буфер T, закрашивается чёрным
//      с градиентом сверху (свет с неба), и поверх добавляется контровой свет (rim light) по краю силуэта;
//   3) T кладётся на A, поверх добавляются светящиеся глаза;
//   4) готовый боец выводится в мир + зеркальное отражение на полу с лёгкой рябью.
// Скелет и детали — те же, что в rig.js / sprites.js; DEBUG показывает кости.

let DEBUG = /[?&]debug=1/.test(location.search);

const Render = {
  BW: 560, BH: 450, OX: 280, OY: 400, RH: 140,   // размер буфера бойца и положение ног в нём (логические пиксели)
  rs: 1, ca: null, ct: null, cr: null, cf: null, A: null, T: null, R: null, F: null,
  pcache: {},

  alloc(rs) {
    this.rs = rs;
    const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.round(w * rs); cv.height = Math.round(h * rs); return cv; };
    this.A = mk(this.BW, this.BH); this.T = mk(this.BW, this.BH); this.R = mk(this.BW, this.BH); this.F = mk(this.BW, this.RH);
    this.ca = this.A.getContext('2d'); this.ct = this.T.getContext('2d'); this.cr = this.R.getContext('2d'); this.cf = this.F.getContext('2d');
    this.pcache = {};
  },

  // Рисует одну деталь арт-листа на кости. Порядок преобразований:
  //  1) в сустав кости  2) поворот на угол кости  3) зеркало по взгляду  4) поворот «покоя» детали
  //  (чтобы вектор pivot -> end на картинке совпал с направлением кости)  5) картинка со сдвигом на pivot
  part(c, img, S, x, y, theta, f, k, cb) {
    const rest = Math.atan2(S.ex - S.px, S.ey - S.py);
    c.save();
    c.translate(x, y); c.rotate(-f * theta); c.scale(f, 1); c.rotate(rest);
    if (img) c.drawImage(img, S.sx, S.sy, S.sw, S.sh, (S.sx - S.px) * k, (S.sy - S.py) * k, S.sw * k, S.sh * k);
    if (cb) cb(c, k, S);
    c.restore();
  },

  // ---------- оружие (векторные силуэты; +y = вдоль клинка от кулака, +x = вперёд) ----------
  katanaX(y, L) { const u = y / L; return 6 * u * u; },

  weaponShape(c, kind, L) {
    c.beginPath();
    switch (kind) {
      case 'katana': {
        c.rect(-3.2, -28, 6.4, 40);                           // рукоять
        c.moveTo(-12, 12); c.quadraticCurveTo(0, 8, 12, 12); c.quadraticCurveTo(0, 17, -12, 12);   // цуба
        const n = 12, a = [], b = [];
        for (let i = 0; i <= n; i++) { const y = 14 + (L - 28) * i / n, xc = this.katanaX(y, L), w = 3.4 - 1.0 * i / n; a.push([xc - w, y]); b.push([xc + w + 0.6, y]); }
        c.moveTo(a[0][0], a[0][1]); a.forEach(p => c.lineTo(p[0], p[1]));
        c.lineTo(this.katanaX(L, L) + 4.5, L); b.reverse().forEach(p => c.lineTo(p[0], p[1]));
        break;
      }
      case 'scythe':
        c.rect(-2.6, -34, 5.2, L + 30);
        c.arc(0, -34, 5, 0, TAU);
        c.moveTo(-3, L - 10); c.bezierCurveTo(30, L + 40, 88, L + 24, 108, L - 24);
        c.bezierCurveTo(78, L + 4, 40, L + 8, 3, L - 34);
        break;
      case 'glaive': {
        c.rect(-2.6, -30, 5.2, L - 40); c.arc(0, -30, 4.5, 0, TAU);
        c.moveTo(-4, L - 66); c.lineTo(-7, L - 56); c.bezierCurveTo(-8, L - 20, -2, L - 6, 22, L + 2);
        c.bezierCurveTo(14, L - 20, 14, L - 50, 5, L - 66);
        break;
      }
      case 'axe':
        c.rect(-3, -30, 6, L + 24); c.arc(0, -30, 5, 0, TAU);
        c.moveTo(2, L - 56); c.bezierCurveTo(34, L - 76, 66, L - 60, 68, L - 22);
        c.bezierCurveTo(66, L - 4, 38, L + 8, 2, L - 10); c.closePath();
        c.moveTo(-2, L - 44); c.lineTo(-24, L - 30); c.lineTo(-2, L - 18);
        break;
      case 'dagger':
        c.moveTo(-9, 6); c.lineTo(9, 6); c.lineTo(9, 10); c.lineTo(-9, 10); c.closePath();
        c.rect(-2.6, -16, 5.2, 22);
        c.moveTo(-4.2, 10); c.lineTo(-2.4, L - 10); c.lineTo(0.6, L); c.lineTo(4, L - 10); c.lineTo(4.2, 10);
        break;
    }
    c.closePath();
  },

  // блик по лезвию (рисуется поверх чёрного клинка, 'lighter')
  gleam(c, kind, L, glow, time) {
    c.save(); c.lineCap = 'round'; c.globalCompositeOperation = 'lighter';
    const line = () => {
      c.beginPath();
      if (kind === 'katana') { for (let i = 0; i <= 10; i++) { const y = 20 + (L - 36) * i / 10; const x = this.katanaX(y, L) + 3.6; i ? c.lineTo(x, y) : c.moveTo(x, y); } }
      else if (kind === 'scythe') { c.moveTo(3, L - 34); c.bezierCurveTo(40, L + 8, 78, L + 4, 108, L - 24); }
      else if (kind === 'glaive') { c.moveTo(5, L - 66); c.bezierCurveTo(14, L - 50, 14, L - 20, 22, L + 2); }
      else if (kind === 'axe') { c.moveTo(2, L - 56); c.bezierCurveTo(34, L - 76, 66, L - 60, 68, L - 22); c.bezierCurveTo(66, L - 4, 38, L + 8, 2, L - 10); }
      else { c.moveTo(3.6, 12); c.lineTo(0.6, L - 4); }
    };
    if (glow) { line(); c.strokeStyle = glow; c.globalAlpha = 0.35; c.lineWidth = 11; c.stroke(); c.globalAlpha = 0.9; c.lineWidth = 3.5; c.stroke(); }
    line(); c.strokeStyle = '#cfe8ff'; c.globalAlpha = 0.5 + 0.25 * Math.sin(time * 5); c.lineWidth = 1.3; c.stroke();
    c.restore();
  },

  // ---------- боец ----------
  fighter(c, F, time) {
    if (!Sprites.ok || !this.A) return;
    const g = F.cfg, sk = F.sk, f = F.f, sc = g.scale || 1, D = SpriteData, img = Sprites.atlas;
    const rs = this.rs, BW = this.BW, BH = this.BH, OX = this.OX, OY = this.OY, W = this.A.width, H = this.A.height;
    const ox = F.x, oy = F.y - F.gy, rim = g.rim || '#58ff7a', rim2 = g.rim2 || '#ff7a3a';
    const X = b => ox + f * b.x, Y = b => oy + b.y;
    const fit = (S, len) => sc * len / Math.hypot(S.ex - S.px, S.ey - S.py);
    const wk = WEAPONS[F.wid] || WEAPONS.blade, wc = F.Wc;
    const breath = F.breathMode;
    const tf = cx => cx.setTransform(rs, 0, 0, rs, (OX - F.x) * rs, (OY - F.y) * rs);
    const id = cx => cx.setTransform(1, 0, 0, 1, 0, 0);
    const prt = (cx, S, bone, k) => this.part(cx, img, S, X(bone), Y(bone), bone.wang, f, k || fit(S, bone.len));
    const hgt = clamp(-F.y / 320, 0, 1);

    // ---- свет на земле и ореол за спиной (чёрный силуэт хорошо читается на свету)
    c.save(); c.globalCompositeOperation = 'lighter';
    let gr = c.createRadialGradient(F.x, 4, 4, F.x, 4, 150 * sc);
    gr.addColorStop(0, rim); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = (0.22 + (breath ? 0.16 : 0)) * (1 - hgt * 0.6); c.save(); c.translate(0, 4); c.scale(1, 0.18); c.translate(0, -4 / 0.18 + 4); c.fillStyle = gr; c.beginPath(); c.arc(F.x, 4, 150 * sc, 0, TAU); c.fill(); c.restore();
    const cy = F.W.chest[1] + 20;
    gr = c.createRadialGradient(F.x, cy, 10, F.x, cy, 190 * sc);
    const hc = breath === 2 ? F.fire : breath === 1 ? '#bfe4ff' : rim;
    gr.addColorStop(0, hc); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = breath ? 0.42 + 0.1 * Math.sin(time * 14) : 0.14 + 0.03 * Math.sin(time * 3 + F.x);
    c.fillStyle = gr; c.beginPath(); c.arc(F.x, cy, 190 * sc, 0, TAU); c.fill();
    c.restore();

    // ---- живое пламя ауры: горит на месте у ног (у героя), в режиме Дыхания поднимается до плеч
    if (g.aura || breath) {
      const al = (breath === 2 ? 0.95 : breath === 1 ? 0.5 : 0.6) * (1 - hgt * 0.7), sd = (F.x * 0.013) % 1;
      drawFlame(c, F.x - 34 * sc, 2, 50 * sc, (breath === 2 ? 120 : 56) * sc, time, sd, F.fire, F.fire2, al * 0.6);
      drawFlame(c, F.x + 30 * sc, 2, 50 * sc, (breath === 2 ? 110 : 48) * sc, time + 1.7, sd + 0.37, F.fire, F.fire2, al * 0.6);
      if (breath === 2) {
        drawFlame(c, F.W.pel[0], F.W.pel[1] + 18, 80 * sc, 150 * sc, time + 0.6, sd + 0.2, F.fire, F.fire2, 0.8);
        drawFlame(c, F.W.chest[0] - F.f * 14, F.W.chest[1] + 26, 60 * sc, 110 * sc, time + 2.3, sd + 0.6, F.fire, F.fire2, 0.65);
      }
    }

    if (g.tails) this.tails(c, F, time, false);

    // ---- задний слой -> A
    const a = this.ca; id(a); a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1; a.clearRect(0, 0, W, H); tf(a);
    if (F.m3d) this.fill3d(a, F, time, tf, id);
    else {
    if (g.cloak !== false) {
      const cl = -(0.1 + clamp(F.vx * f / SPEED, -1, 1) * 0.35) + F.cl + sk.root.local;
      this.part(a, img, D.cloak, ox + f * sk.torso.ex, oy + sk.torso.ey, cl, f, D.cloak.k * sc);
    }
    if (g.tails) this.tails(a, F, time, true);
    if (g.scarf && F.scarfPts) this.scarf(a, F);
    prt(a, D.legAUp, sk.thB); prt(a, D.legALo, sk.shB);
    prt(a, D.armUp, sk.uaB); prt(a, D.armLo, sk.faB);
    if (wk.kind === 'daggers') {   // второй кинжал в задней руке
      a.save(); a.translate(F.W.hdB[0], F.W.hdB[1]); a.rotate(-f * sk.faB.wang); a.scale(f, 1);
      this.weaponShape(a, 'dagger', 56 * sc); a.fillStyle = '#222'; a.fill(); a.restore();
    }
    id(a); a.globalCompositeOperation = 'source-atop'; a.fillStyle = 'rgba(2,3,5,0.95)'; a.fillRect(0, 0, W, H);

    // ---- передний слой -> T
    const t = this.ct; id(t); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, W, H); tf(t);
    prt(t, D.torso, sk.torso);
    const HS = D[g.sprHead || 'headA'], hk = HS.k * sc;
    this.part(t, img, HS, X(sk.neck), Y(sk.neck), sk.neck.wang, f, hk, (cx, k) => {
      if (g.horns) {
        cx.fillStyle = '#222';
        for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * 10 * sc, -44 * sc); cx.quadraticCurveTo(s * 30 * sc, -52 * sc, s * 34 * sc, -86 * sc); cx.quadraticCurveTo(s * 20 * sc, -62 * sc, s * 3 * sc, -38 * sc); cx.fill(); }
      }
      if (g.ears) {   // лисьи уши
        cx.fillStyle = '#222';
        for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * 4 * sc, -46 * sc); cx.quadraticCurveTo(s * 14 * sc, -78 * sc, s * 27 * sc, -102 * sc); cx.quadraticCurveTo(s * 40 * sc, -76 * sc, s * 36 * sc, -48 * sc); cx.fill(); }
      }
      if (g.hat) {   // соломенная шляпа-кегаса
        cx.fillStyle = '#222'; cx.beginPath(); cx.moveTo(-44 * sc, -42 * sc); cx.quadraticCurveTo(0, -60 * sc, 0, -92 * sc); cx.quadraticCurveTo(0, -60 * sc, 44 * sc, -42 * sc);
        cx.quadraticCurveTo(0, -36 * sc, -44 * sc, -42 * sc); cx.fill();
      }
    });
    prt(t, D.legBUp, sk.thF); prt(t, D.legBLo, sk.shF);
    const wk2 = wk.kind;
    prt(t, D.armUp, sk.uaF); prt(t, D.armLo, sk.faF);

    // чёрная заливка (оставляет ~8% рисунка брони — тонкие детали видны) и градиент света сверху: даёт объём
    id(t); t.globalCompositeOperation = 'source-atop'; t.fillStyle = 'rgba(3,4,7,0.92)'; t.fillRect(0, 0, W, H);
    const hy = (F.W.head[1] - F.y + OY) * rs, fh = (F.gy + 20) * rs;
    let lg = t.createLinearGradient(0, hy - 50 * rs, 0, hy + fh);
    lg.addColorStop(0, 'rgba(110,125,150,0.42)'); lg.addColorStop(0.45, 'rgba(60,70,90,0.16)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = lg; t.fillRect(0, 0, W, H);
    // боковой градиент: передняя сторона чуть светлее (объём «цилиндра»)
    const cx0 = (F.x + f * 6 - F.x + OX) * rs;
    lg = t.createLinearGradient(cx0 - 38 * rs * f, 0, cx0 + 38 * rs * f, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.3)'); lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(90,100,130,0.2)');
    t.fillStyle = lg; t.fillRect(0, 0, W, H);

    // контровой свет: основной со спины-сверху (цвет бойца) и слабый тёплый спереди
    const r = this.cr;
    const rimPass = (dx, dy, col, al, blur) => {
      id(r); r.globalCompositeOperation = 'source-over'; r.globalAlpha = 1; r.clearRect(0, 0, W, H);
      r.drawImage(this.T, 0, 0);
      r.globalCompositeOperation = 'source-in'; r.fillStyle = col; r.fillRect(0, 0, W, H);
      r.globalCompositeOperation = 'destination-out'; r.drawImage(this.T, dx * rs, dy * rs);
      id(t); t.globalCompositeOperation = 'source-over'; t.globalAlpha = al; t.drawImage(this.R, 0, 0);
      if (blur) { t.globalCompositeOperation = 'lighter'; t.globalAlpha = al * 0.5; t.drawImage(this.R, -dx * rs * 0.5, -dy * rs * 0.5); }
      t.globalAlpha = 1;
    };
    rimPass(3.2 * f, 2.6, rim, 0.95, true);
    rimPass(-2.4 * f, 1.8, rim2, 0.5, false);
    rimPass(0, 3, '#dfe9ff', 0.35, false);      // верхняя кромка: свет неба

    // оружие рисуется ПОСЛЕ контрового света: остаётся чёрным, видно по тонкой кромке-блику
    {
      const sl = wk2 === 'daggers' ? 56 * sc : wk.len * sc;
      if (wk2 === 'blade') {
        const S = D.sword, k = sc * wk.len / Math.hypot(S.ex - S.px, S.ey - S.py);
        id(r); r.globalCompositeOperation = 'source-over'; r.globalAlpha = 1; r.clearRect(0, 0, W, H); tf(r);
        this.part(r, img, S, wc[0], wc[1], sk.wep.wang, f, k);
        id(r); r.globalCompositeOperation = 'source-atop'; r.fillStyle = 'rgba(3,4,7,0.94)'; r.fillRect(0, 0, W, H);
        id(t); t.globalCompositeOperation = 'source-over'; t.drawImage(this.R, 0, 0);
        if (g.wglow || F.breathMode === 2) {
          tf(t); t.save(); t.globalCompositeOperation = 'lighter'; t.lineCap = 'round'; t.strokeStyle = F.breathMode === 2 ? F.fire : g.wglow;
          t.globalAlpha = 0.3; t.lineWidth = 12; t.beginPath(); t.moveTo(F.W.hdF[0], F.W.hdF[1]); t.lineTo(F.W.tip[0], F.W.tip[1]); t.stroke();
          t.globalAlpha = 0.7; t.lineWidth = 3; t.stroke(); t.restore();
        }
      } else {
        tf(t); t.save(); t.translate(wc[0], wc[1]); t.rotate(-f * sk.wep.wang); t.scale(f, 1);
        t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1;
        this.weaponShape(t, wk2 === 'daggers' ? 'dagger' : wk2, sl); t.fillStyle = '#05070a'; t.fill();
        this.gleam(t, wk2 === 'daggers' ? 'dagger' : wk2, sl, F.breathMode === 2 ? F.fire : (wk.glow || g.wglow || rim), time);
        t.restore();
      }
    }

    // T -> A
    id(a); a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1; a.drawImage(this.T, 0, 0);

    // ---- светящиеся глаза (маска глаз из арт-листа + ореол)
    if (Sprites.eyesOk) {
      tf(a); a.globalCompositeOperation = 'lighter';
      const ec = F.eyeCol, big = breath ? 1.7 : 1, pulse = 0.85 + 0.15 * Math.sin(time * 6 + F.x);
      const eyes = EYE_INFO[g.sprHead || 'headA'] || [];
      this.part(a, Sprites.eyes, HS, X(sk.neck), Y(sk.neck), sk.neck.wang, f, hk, (cx) => {
        for (const e of eyes) {
          const lx = (e[0] - HS.px) * hk, ly = (e[1] - HS.py) * hk, rr = (10 + Math.sqrt(e[2]) * 0.5) * sc * big;
          const gg = cx.createRadialGradient(lx, ly, 0, lx, ly, rr);
          gg.addColorStop(0, '#fff'); gg.addColorStop(0.25, ec); gg.addColorStop(1, 'rgba(0,0,0,0)');
          cx.globalAlpha = pulse; cx.fillStyle = gg; cx.beginPath(); cx.arc(lx, ly, rr, 0, TAU); cx.fill();
          if (breath) { // световой хвост от глаз назад
            cx.globalAlpha = 0.55; cx.strokeStyle = ec; cx.lineWidth = 2.2 * sc; cx.lineCap = 'round';
            cx.beginPath(); cx.moveTo(lx, ly); cx.lineTo(lx - 38 * sc, ly - 6 * sc - Math.sin(time * 20) * 3); cx.stroke();
          }
        }
        cx.globalAlpha = 1;
      });
    }
    }
    if (g.dark) {   // «Тёмная ночь»: силуэт почти не виден, глаза светятся отдельно
      id(a); a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1;
    }
    // вспышка попадания: силуэт белеет
    if (F.flash > 0) { id(a); a.globalCompositeOperation = 'source-atop'; a.globalAlpha = clamp(F.flash * 6, 0, 0.9); a.fillStyle = '#fff'; a.fillRect(0, 0, W, H); a.globalAlpha = 1; }
    // неуязвимость: мерцающая оболочка
    if (F.inv > 0) { id(a); a.globalCompositeOperation = 'source-atop'; a.globalAlpha = 0.25 + 0.2 * Math.sin(time * 40); a.fillStyle = '#9fd4ff'; a.fillRect(0, 0, W, H); a.globalAlpha = 1; }
    a.globalCompositeOperation = 'source-over';

    // ---- отражение на полу: перевёрнутая нижняя часть, рябь полосами, затухание вниз
    if (hgt < 0.9 && !F.noRefl) {
      const f2 = this.cf, FW = this.F.width, FH = this.F.height;
      id(f2); f2.globalCompositeOperation = 'source-over'; f2.globalAlpha = 1; f2.clearRect(0, 0, FW, FH);
      f2.setTransform(rs, 0, 0, -rs, 0, (OY - F.y) * rs); f2.drawImage(this.A, 0, 0, BW, BH);
      id(f2); f2.globalCompositeOperation = 'destination-in';
      const mg = f2.createLinearGradient(0, 0, 0, FH); mg.addColorStop(0, 'rgba(0,0,0,0.75)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      f2.fillStyle = mg; f2.fillRect(0, 0, FW, FH); f2.globalCompositeOperation = 'source-over';
      c.save(); c.globalAlpha = 0.55 * (1 - hgt);
      const strip = 7;
      for (let i = 0; i * strip < this.RH; i++) c.drawImage(this.F, 0, i * strip * rs, FW, strip * rs, F.x - OX + Math.sin(time * 2.6 + i * 0.8) * 2.2, 2 + i * strip, BW, strip);
      c.restore();
    }

    // ---- боец в мир (+ «призраки» скорости в режиме Дыхания)
    if (breath === 2) {
      c.save();
      for (let i = 3; i >= 1; i--) { c.globalAlpha = 0.16 * (4 - i) / 3; c.drawImage(this.A, F.x - OX - f * i * 22, F.y - OY, BW, BH); }
      c.restore();
    }
    if (g.dark) c.globalAlpha = 0.05;
    c.drawImage(this.A, F.x - OX, F.y - OY, BW, BH);
    c.globalAlpha = 1;
    if (g.dark && Sprites.eyesOk) this.darkEyes(c, F, time);

    // след от удара
    if (F.trail.length > 2) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      const tc = breath === 2 ? F.fire : (g.wglow || rim), T = F.trail;
      for (let i = 1; i < T.length; i++) {      // лента между кончиком и серединой клинка: дуга удара
        const k = i / T.length;
        c.globalAlpha = k * 0.55; c.fillStyle = tc;
        c.beginPath(); c.moveTo(T[i - 1][0], T[i - 1][1]); c.lineTo(T[i][0], T[i][1]); c.lineTo(T[i][2], T[i][3]); c.lineTo(T[i - 1][2], T[i - 1][3]); c.closePath(); c.fill();
        c.globalAlpha = k * 0.9; c.strokeStyle = '#fff'; c.lineWidth = 1.5 + k * 2; c.beginPath(); c.moveTo(T[i - 1][0], T[i - 1][1]); c.lineTo(T[i][0], T[i][1]); c.stroke();
      }
      c.restore();
    }
    if (DEBUG) this.debugBones(c, F);
  },

  // 3D-герой: модель на едином скелете -> буфер бойца (дальше работают отражение, вспышки, призраки Дыхания)
  // одно оружие (в руке или в ножнах). (x,y) — хват/ножны, (dx,dy) — куда смотрит клинок на экране
  wep3d(a, F, wid, x, y, dx, dy, sheath, tf, id, time) {
    const wk = WEAPONS[wid] || WEAPONS.blade, kind = wk.kind, f = F.f, g = F.cfg, sc = g.scale || 1, D = SpriteData, img = Sprites.atlas;
    const wang = Math.atan2(dx * f, dy), dag = kind === 'daggers', shape = dag ? 'dagger' : kind === 'blade' ? 'katana' : kind;
    const sl = dag ? 56 * sc : wk.len * sc, gf = !sheath && (kind === 'axe' || kind === 'scythe' || kind === 'glaive') ? 0.22 : 0;
    const glow = F.breathMode === 2 ? F.fire : (wk.glow || g.wglow || g.rim);
    if (!sheath && kind === 'blade') {
      const S = D.sword, k = sc * wk.len / Math.hypot(S.ex - S.px, S.ey - S.py), r = this.cr;
      id(r); r.globalCompositeOperation = 'source-over'; r.globalAlpha = 1; r.clearRect(0, 0, a.canvas.width, a.canvas.height); tf(r);
      this.part(r, img, S, x, y, wang, f, k);
      id(r); r.globalCompositeOperation = 'source-atop'; r.fillStyle = 'rgba(6,8,12,0.94)'; r.fillRect(0, 0, a.canvas.width, a.canvas.height);
      id(a); a.globalCompositeOperation = 'source-over'; a.drawImage(this.R, 0, 0);
      if (g.wglow || F.breathMode === 2) {
        tf(a); a.save(); a.globalCompositeOperation = 'lighter'; a.lineCap = 'round'; a.strokeStyle = F.breathMode === 2 ? F.fire : g.wglow;
        a.globalAlpha = 0.3; a.lineWidth = 12; a.beginPath(); a.moveTo(x, y); a.lineTo(x + dx * sl, y + dy * sl); a.stroke();
        a.globalAlpha = 0.7; a.lineWidth = 3; a.stroke(); a.restore();
      }
      return;
    }
    tf(a); a.save(); a.translate(x, y); a.rotate(-f * wang); a.scale(f, 1); a.translate(0, -gf * sl);
    a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1;
    if (sheath && (kind === 'blade' || kind === 'katana' || dag)) {
      // в ножнах: видна рукоять с гардой, клинок скрыт тёмными ножнами
      a.save(); a.beginPath(); a.rect(-40, -70, 80, 86); a.clip(); this.weaponShape(a, shape, sl); a.fillStyle = '#05070a'; a.fill(); a.restore();
      const path = off => { a.beginPath(); for (let i = 0; i <= 10; i++) { const yy = 14 + (sl * 0.94 - 14) * i / 10, xx = (dag ? 0 : this.katanaX(yy, sl)) + off; i ? a.lineTo(xx, yy) : a.moveTo(xx, yy); } };
      a.lineCap = 'round'; a.lineJoin = 'round'; a.strokeStyle = '#06080c'; a.lineWidth = dag ? 6 : 8; path(0.6); a.stroke();
      a.strokeStyle = 'rgba(130,170,200,0.4)'; a.lineWidth = 1.2; path(-2.2); a.stroke();
      a.fillStyle = '#10151b'; a.beginPath(); a.arc(this.katanaX ? (dag ? 0 : this.katanaX(sl * 0.94, sl)) + 0.6 : 0, sl * 0.94, 4, 0, TAU); a.fill();
    } else {
      this.weaponShape(a, shape, sl); a.fillStyle = '#05070a'; a.fill();
      if (!sheath) this.gleam(a, shape, sl, glow, time);
    }
    a.restore();
  },

  fill3d(a, F, time, tf, id) {
    const H = Hero3D, rs = this.rs, g = F.cfg, f = F.f;
    if (H.cv.width !== Math.round(this.BW * rs)) { H.cv.width = Math.round(this.BW * rs); H.cv.height = Math.round(this.BH * rs); H.rs = rs; }
    F.an.apply(); F.h3world();   // позиция меча считается ровно в тот кадр, что рисуется (без отставания от руки)
    const tint = F.inv > 0 ? [0.62, 0.83, 1] : [1, 1, 1];
    // оружие в ножнах: что носим и где
    const sw = F.swap && F.swap.t < 0.4 ? F.swap : null, ph1 = sw && sw.t < 0.2;
    let sheathed = (F.loadout || []).filter(x => x !== F.wid);
    if (ph1) sheathed = sheathed.filter(x => x !== sw.from).concat([sw.to]);
    else if (sw) sheathed = sheathed.filter(x => x !== sw.to);
    const mounts = sheathed.map(x => [x, F.h3mount(x)]);
    for (const [x, m] of mounts) if (m.back) this.wep3d(a, F, x, m.x, m.y, m.dx, m.dy, true, tf, id, time);   // за спиной — под телом
    const cv = H.render(F.an.yaw, g.rim || '#58ff7a', F.eyeCol, Math.min(0.85, F.flash * 6), tint, F.inv > 0 ? 0.22 + 0.18 * Math.sin(time * 40) : 0, time, 1);
    id(a); a.globalCompositeOperation = 'source-over';
    if (cv) a.drawImage(cv, 0, 0, a.canvas.width, a.canvas.height);
    for (const [x, m] of mounts) if (!m.back) this.wep3d(a, F, x, m.x, m.y, m.dx, m.dy, true, tf, id, time);  // на бёдрах — поверх тела
    // оружие в руке (или на пути между рукой и ножнами при смене)
    if (!Sprites.ok || !F.wRoot) return;
    const wc = F.wRoot, hd = F.wDir, ease = u => u * u * (3 - 2 * u);
    const lerp = (A, B, u) => A + (B - A) * u;
    let held = F.wid, hx = wc[0], hy = wc[1], hdx = hd[0], hdy = hd[1], draw = true;
    if (sw) {
      draw = true;
      if (ph1) { const m = F.h3mount(sw.from), u = ease(sw.t / 0.2); held = sw.from; hx = lerp(wc[0], m.x, u); hy = lerp(wc[1], m.y, u); hdx = lerp(hd[0], m.dx, u); hdy = lerp(hd[1], m.dy, u); }
      else { const m = F.h3mount(sw.to), u = ease((sw.t - 0.2) / 0.2); held = sw.to; hx = lerp(m.x, wc[0], u); hy = lerp(m.y, wc[1], u); hdx = lerp(m.dx, hd[0], u); hdy = lerp(m.dy, hd[1], u); }
      const hl = Math.hypot(hdx, hdy) || 1; hdx /= hl; hdy /= hl;
    }
    if (draw) this.wep3d(a, F, held, hx, hy, hdx, hdy, false, tf, id, time);
    // второй кинжал — в левой руке
    const wk = WEAPONS[held] || WEAPONS.blade;
    if (wk.kind === 'daggers' && F.lRoot) this.wep3d(a, F, held, F.lRoot[0] + (hx - wc[0]) * 0, F.lRoot[1], F.lDir[0], F.lDir[1], false, tf, id, time);
    // кулак поверх рукояти: пальцы «обхватывают» оружие, рукоять не торчит из ладони
    if (cv && F.palmR && !sw) {
      const fist = (c0, rr) => { tf(a); a.save(); a.beginPath(); a.arc(c0[0], c0[1], rr, 0, 6.2832); a.clip(); id(a); a.drawImage(cv, 0, 0, a.canvas.width, a.canvas.height); a.restore(); };
      fist(wc, F.palmR); if (wk.kind === 'daggers' && F.lRoot) fist(F.lRoot, F.lR);
    }
    id(a);
  },

  // хвосты кицунэ: веер за спиной, покачиваются; solid=true — силуэт в заднем слое, false — огоньки на кончиках
  tails(c, F, time, solid) {
    const g = F.cfg, n = g.tails, sc = g.scale || 1, f = F.f, bx = F.W.pel[0] - f * 8, by = F.W.pel[1] - 6;
    if (solid) c.fillStyle = '#222';
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const ph = 0.08 + u * 1.25 + Math.sin(time * 1.7 + i * 0.9) * 0.1 - clamp(F.vx * f / SPEED, -1, 1) * 0.12;   // угол вверх от горизонтали
      const L = (105 + 24 * Math.sin(i * 2.1)) * sc, ux = -f * Math.cos(ph), uy = -Math.sin(ph);
      const tx = bx + ux * L, ty = by + uy * L, px = -uy, py = ux;          // перпендикуляр
      if (solid) {
        const w = 17 * sc, mx = bx + ux * L * 0.55, my = by + uy * L * 0.55;
        c.beginPath(); c.moveTo(bx + px * 6 * sc, by + py * 6 * sc);
        c.quadraticCurveTo(mx + px * w * 1.4, my + py * w * 1.4, tx, ty);
        c.quadraticCurveTo(mx - px * w * 1.2, my - py * w * 1.2, bx - px * 6 * sc, by - py * 6 * sc); c.fill();
      } else if (i % 2 === 0) drawFlame(c, tx, ty + 14 * sc, 22 * sc, 40 * sc, time + i, i * 0.31, F.fire, F.fire2, 0.38);
    }
  },

  // только светящиеся глаза поверх тьмы (режим «Тёмная ночь»)
  darkEyes(c, F, time) {
    const g = F.cfg, sk = F.sk, f = F.f, sc = g.scale || 1, HS = SpriteData[g.sprHead || 'headA'], hk = HS.k * sc;
    const ox = F.x, oy = F.y - F.gy;
    c.save(); c.globalCompositeOperation = 'lighter';
    this.part(c, null, HS, ox + f * sk.neck.x, oy + sk.neck.y, sk.neck.wang, f, hk, (cx) => {
      for (const e of EYE_INFO[g.sprHead || 'headA'] || []) {
        const lx = (e[0] - HS.px) * hk, ly = (e[1] - HS.py) * hk, rr = 22 * sc, gg = cx.createRadialGradient(lx, ly, 0, lx, ly, rr);
        gg.addColorStop(0, '#fff'); gg.addColorStop(0.3, F.eyeCol); gg.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = gg; cx.beginPath(); cx.arc(lx, ly, rr, 0, TAU); cx.fill();
      }
    });
    c.restore();
  },

  // шарф: цепочка точек из Fighter (тянется за бойцом), рисуется сужающейся лентой
  scarf(c, F) {
    const p = F.scarfPts; c.fillStyle = '#222'; c.beginPath();
    const w = i => 7 * (1 - i / p.length) + 1;
    c.moveTo(p[0][0], p[0][1] - w(0));
    for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1] - w(i));
    for (let i = p.length - 1; i >= 0; i--) c.lineTo(p[i][0], p[i][1] + w(i));
    c.closePath(); c.fill();
  },

  // Отладка: скелет (голубые линии), суставы, капсулы попадания (зелёные)
  debugBones(c, F) {
    const W = F.W;
    c.save(); c.lineWidth = 2; c.strokeStyle = '#00e5ff';
    for (const [A, B] of [['pel', 'chest'], ['chest', 'head'], ['chest', 'elF'], ['elF', 'hdF'], ['hdF', 'tip'], ['chest', 'elB'], ['elB', 'hdB'], ['pel', 'knF'], ['knF', 'ftF'], ['pel', 'knB'], ['knB', 'ftB']]) {
      c.beginPath(); c.moveTo(W[A][0], W[A][1]); c.lineTo(W[B][0], W[B][1]); c.stroke();
    }
    c.fillStyle = '#ffe000'; for (const k in W) { c.beginPath(); c.arc(W[k][0], W[k][1], 3.5, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(80,255,80,0.7)'; const sc = F.cfg.scale || 1;
    for (const [A, B, rad] of CAPS) { c.lineWidth = rad * 2 * sc; c.lineCap = 'round'; c.globalAlpha = 0.18; c.beginPath(); c.moveTo(W[A][0], W[A][1]); c.lineTo(W[B][0], W[B][1]); c.stroke(); }
    c.restore();
  },

  // ---------- снаряды ----------
  proj(c, p, time) {
    c.save(); c.globalCompositeOperation = 'lighter';
    if (p.kind === 'wave') {          // огненная волна катаны: полумесяц
      const dir = sign(p.vx);
      c.translate(p.x, p.y); c.scale(dir, 1);
      for (const [w, a, col] of [[22, 0.3, p.col], [10, 0.7, p.col], [3.5, 1, '#fff']]) {
        c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
        c.beginPath(); c.arc(-40, 0, 62, -0.9, 0.9); c.stroke();
      }
    } else if (p.kind === 'dagger') { // метательный клинок
      c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy || 0, p.vx));
      const gr = c.createLinearGradient(-34, 0, 14, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, p.col);
      c.fillStyle = gr; c.beginPath(); c.moveTo(-34, 0); c.lineTo(8, -5); c.lineTo(18, 0); c.lineTo(8, 5); c.closePath(); c.fill();
      c.globalAlpha = 0.9; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -1.5); c.lineTo(16, 0); c.lineTo(0, 1.5); c.fill();
    } else {
      const r = (p.r || 22) + Math.sin(time * 20) * 3;
      const gr = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 1.8);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, p.col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, r * 1.8, 0, TAU); c.fill();
      if (Sprites.ok) {
        const S = SpriteData.fxBurst, k = (p.big ? 0.42 : 0.3) + Math.sin(time * 25) * 0.03;
        c.save(); c.translate(p.x, p.y); c.rotate(sign(p.vx) * Math.PI / 2); c.scale(k, k);
        c.drawImage(Sprites.atlas, S.sx, S.sy, S.sw, S.sh, -S.sw / 2, -S.sh * 0.7, S.sw, S.sh); c.restore();
      }
    }
    c.restore();
  },

  // ---------- интерфейс ----------
  bar(c, x, y, w, h, v, max, lag, col, dir) {
    const sk = 14, fill = (ww, style) => {
      c.fillStyle = style; c.beginPath();
      if (dir > 0) { c.moveTo(x, y); c.lineTo(x + ww, y); c.lineTo(x + ww - sk, y + h); c.lineTo(x - sk, y + h); }
      else { c.moveTo(x, y); c.lineTo(x - ww, y); c.lineTo(x - ww + sk, y + h); c.lineTo(x + sk, y + h); }
      c.closePath(); c.fill();
    };
    fill(w, 'rgba(0,0,0,0.6)');
    fill(w * clamp(lag / max, 0, 1), '#f2b83a');
    fill(w * clamp(v / max, 0, 1), col);
  },

  // портрет врага: его шлем с арт-листа, закрашенный чёрным, с красными глазами (кэшируется)
  portrait(head, eye) {
    const key = head + eye;
    if (this.pcache[key]) return this.pcache[key];
    const S = SpriteData[head], cv = document.createElement('canvas'); cv.width = 110; cv.height = 110;
    const g = cv.getContext('2d'), k = 0.95;
    g.translate(55, 62 + (S.ey - S.py) * -0.0); g.drawImage(Sprites.atlas, S.sx, S.sy, S.sw, S.sh, (S.sx - S.ex) * k, (S.sy - S.ey) * k, S.sw * k, S.sh * k);
    g.globalCompositeOperation = 'source-atop'; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(4,5,8,0.92)'; g.fillRect(0, 0, 110, 110);
    g.globalCompositeOperation = 'lighter';
    g.setTransform(1, 0, 0, 1, 55, 62);
    if (Sprites.eyesOk) {
      g.drawImage(Sprites.eyes, S.sx, S.sy, S.sw, S.sh, (S.sx - S.ex) * k, (S.sy - S.ey) * k, S.sw * k, S.sh * k);
      for (const e of EYE_INFO[head] || []) {
        const lx = (e[0] - S.ex) * k, ly = (e[1] - S.ey) * k, gg = g.createRadialGradient(lx, ly, 0, lx, ly, 14);
        gg.addColorStop(0, '#fff'); gg.addColorStop(0.3, eye); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.beginPath(); g.arc(lx, ly, 14, 0, TAU); g.fill();
      }
    }
    return (this.pcache[key] = cv);
  },

  hud(c, G) {
    const hero = G.hero, foe = G.foe;
    // герой
    this.bar(c, 150, 28, 430, 26, hero.hp, hero.maxhp, hero.lag, '#4cd964', 1);
    this.bar(c, 142, 60, 250, 10, hero.en, 100, hero.en, hero.en >= 30 ? '#4aa8ff' : '#37577a', 1);
    // дыхание: шкала зарядки / длительности
    const bk = hero.breathMode === 2 ? hero.breathT / 7 : 1 - clamp(hero.breathCd / 8, 0, 1);
    this.bar(c, 134, 76, 200, 8, bk, 1, bk, hero.breathMode === 2 ? hero.fire : bk >= 1 ? '#ffe9a0' : '#8a7a50', 1);
    c.font = 'bold 14px Arial, sans-serif'; c.textAlign = 'left'; c.fillStyle = bk >= 1 || hero.breathMode ? '#ffe9a0' : '#8a8a8a';
    c.fillText(hero.breathMode === 2 ? 'ДЫХАНИЕ' : bk >= 1 ? 'ДЫХАНИЕ ГОТОВО' : 'дыхание…', 342, 85);
    c.font = 'bold 22px Impact, "Arial Black", sans-serif'; c.fillStyle = '#fff';
    c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(HERO.name, 148, 112); c.fillText(HERO.name, 148, 112);
    // аватар
    c.save(); c.beginPath(); c.arc(70, 66, 48, 0, TAU); c.closePath(); c.fillStyle = '#0a140d'; c.fill(); c.clip();
    if (Sprites.avatarOk) c.drawImage(Sprites.avatar, 22, 18, 96, 96);
    c.restore();
    c.lineWidth = 5; c.strokeStyle = '#58ff7a'; c.beginPath(); c.arc(70, 66, 48, 0, TAU); c.stroke();
    // враг
    this.bar(c, 1130, 28, 430, 26, foe.hp, foe.maxhp, foe.lag, '#e5483c', -1);
    c.textAlign = 'right'; c.font = 'bold 22px Impact, "Arial Black", sans-serif'; c.fillStyle = '#fff'; c.lineWidth = 4; c.strokeStyle = '#000';
    c.strokeText(foe.cfg.name.toUpperCase(), 1132, 112); c.fillText(foe.cfg.name.toUpperCase(), 1132, 112);
    c.save(); c.beginPath(); c.arc(1210, 66, 48, 0, TAU); c.closePath(); { const pg = c.createRadialGradient(1210, 80, 4, 1210, 66, 52); pg.addColorStop(0, foe.cfg.rim || '#a33'); pg.addColorStop(1, '#0d0809'); c.fillStyle = pg; } c.fill(); c.clip();
    if (foe.cfg.portrait === 'hunter' && Sprites.hunterOk) c.drawImage(Sprites.hunter, 1160, 16, 100, 100);
    else if (foe.cfg.portrait === 'fox' && Sprites.foxOk) c.drawImage(Sprites.fox, 1160, 16, 100, 100);
    else if (Sprites.ok) c.drawImage(this.portrait(foe.cfg.sprHead || 'headA', foe.cfg.eyeCol || '#f33'), 1155, 11, 110, 110);
    c.restore();
    c.lineWidth = 5; c.strokeStyle = foe.cfg.rim || '#e5483c'; c.beginPath(); c.arc(1210, 66, 48, 0, TAU); c.stroke();
    // баффы босса
    if (foe.buffs.length) {
      const BN = { stone: 'Каменная кожа', regen: 'Регенерация', wrath: foe.wrath ? 'ЯРОСТЬ!' : 'Ярость', volley: 'Залп хвостов' };
      c.font = 'bold 14px Arial, sans-serif'; c.textAlign = 'right'; let yy = 132;
      for (const b of foe.buffs) { c.fillStyle = b === 'wrath' && foe.wrath ? '#ff5a3a' : '#e8c0c0'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText('▲ ' + BN[b], 1262, yy); c.fillText('▲ ' + BN[b], 1262, yy); yy += 18; }
    }
    // таймер и режим
    c.textAlign = 'center'; c.font = 'bold 44px Impact, "Arial Black", sans-serif';
    c.lineWidth = 5; c.strokeStyle = '#000'; const t = G.time > 900 ? '∞' : String(Math.max(0, Math.ceil(G.time)));
    c.strokeText(t, 640, 62); c.fillStyle = G.time < 10 ? '#ff5a4a' : '#fff'; c.fillText(t, 640, 62);
    c.font = 'bold 18px Arial, sans-serif'; c.fillStyle = '#ccc';
    c.fillText(G.label || '', 640, 86);
    // золото
    c.textAlign = 'center'; c.fillStyle = '#ffd25a'; c.font = 'bold 20px Arial, sans-serif'; c.fillText('● ' + Save.d.gold + (G.earn ? '  +' + G.earn : ''), 640, 110);
  },

  bigText(c, text, y, size, col, sub, subSize) {
    c.textAlign = 'center';
    c.font = 'bold ' + size + 'px Impact, "Arial Black", sans-serif';
    c.lineWidth = size / 8; c.strokeStyle = '#000'; c.strokeText(text, 640, y);
    c.fillStyle = col; c.fillText(text, 640, y);
    if (sub) {
      c.font = 'bold ' + (subSize || 26) + 'px Arial, sans-serif'; c.lineWidth = 5;
      c.strokeText(sub, 640, y + size * 0.7); c.fillStyle = '#fff'; c.fillText(sub, 640, y + size * 0.7);
    }
  },
};
