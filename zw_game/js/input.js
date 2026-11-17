'use strict';
// Клавиатура + сенсорные кнопки (рисуются на канвасе, мультитач).

const Input = {
  keys: {}, edge: {}, pts: {}, held: {}, touch: false, sw: null, swipeMode: null, swipeCb: null, dragCb: null, tapCb: null, pauseCb: null, debugCb: null, keyCb: null, cv: null,
  clock: () => performance.now() / 1000, last: { left: -9, right: -9 }, prev: { left: false, right: false }, armed: 0, brHeld: false,

  BTN: [
    { n: 'left', x: 95, y: 625, r: 62, t: '◀' },
    { n: 'right', x: 265, y: 625, r: 62, t: '▶' },
    { n: 'jump', x: 180, y: 505, r: 52, t: '▲' },
    { n: 'block', x: 920, y: 630, r: 50, t: 'БЛОК' },
    { n: 'punch', x: 1040, y: 630, r: 56, t: 'УДАР' },
    { n: 'kick', x: 1160, y: 580, r: 56, t: 'НОГА' },
    { n: 'slash', x: 1160, y: 450, r: 52, t: 'МЕЧ' },
    { n: 'magic', x: 1040, y: 500, r: 50, t: 'МАГИЯ' },
    { n: 'breath', x: 800, y: 640, r: 46, t: 'ДЫХ.' },
    { n: 'swap', x: 1160, y: 320, r: 44, t: 'СМЕНА' },
  ],
  showSwap: false,
  HOLD: { left: 1, right: 1, block: 1, breath: 1 },

  init(cv) {
    this.cv = cv;
    this.touch = (navigator.maxTouchPoints || 0) > 0 || /touch=1/.test(location.search);
    const map = {
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyS: 'block', ArrowDown: 'block',
      KeyW: 'jump', ArrowUp: 'jump', Space: 'jump', KeyJ: 'punch', KeyZ: 'punch', KeyK: 'kick', KeyX: 'kick',
      KeyL: 'slash', KeyC: 'slash', KeyU: 'magic', KeyV: 'magic', KeyH: 'breath', KeyQ: 'breath', KeyE: 'swap', KeyR: 'swap',
    };
    addEventListener('keydown', e => {
      if (map[e.code]) e.preventDefault();
      this.touch = false;
      if (e.repeat) return;
      const a = map[e.code];
      if (a) { if (this.HOLD[a]) this.keys[a] = true; else this.edge[a] = true; }
      if (e.code === 'KeyP' || e.code === 'Escape') this.pauseCb && this.pauseCb();
      if (e.code === 'KeyM') { Sfx.on = !Sfx.on; }
      if (e.code === 'KeyB') this.debugCb && this.debugCb();
      if (this.keyCb && this.keyCb(e.code)) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') this.tapCb && this.tapCb(-1, -1);
    });
    addEventListener('keyup', e => { const a = map[e.code]; if (a) this.keys[a] = false; });
    addEventListener('blur', () => { this.keys = {}; this.pts = {}; });

    const pos = e => { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) * 1280 / r.width, (e.clientY - r.top) * 720 / r.height]; };
    const T = document;
    T.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (e.pointerType !== 'mouse') this.touch = true;
      const [x, y] = pos(e);
      this.pts[e.pointerId] = [x, y];
      if (Object.keys(this.pts).length >= 3 && this.debugCb) { this.debugCb(); return; }   // три пальца = отладка
      if (x > 1190 && y > 120 && y < 190 && this.pauseCb) { this.pauseCb(); return; }
      if (this.swipeMode && this.swipeMode()) {   // карта/арсенал: тап срабатывает при отпускании, жест — взмах
        this.sw = { id: e.pointerId, x0: x, y0: y, x, y, moved: false };
        return;
      }
      const b = this.hit(x, y);
      if (b && !this.HOLD[b.n]) this.edge[b.n] = true;
      this.tapCb && this.tapCb(x, y);
    });
    T.addEventListener('pointermove', e => {
      if (this.pts[e.pointerId]) this.pts[e.pointerId] = pos(e);
      const w = this.sw; if (!w || w.id !== e.pointerId) return;
      const [x, y] = pos(e);
      if (!w.moved && Math.hypot(x - w.x0, y - w.y0) > 16) w.moved = true;
      if (w.moved && this.dragCb) this.dragCb(x - w.x, y - w.y);
      w.x = x; w.y = y;
    });
    const up = e => {
      delete this.pts[e.pointerId];
      const w = this.sw; if (!w || w.id !== e.pointerId) return;
      this.sw = null;
      if (e.type === 'pointercancel') return;
      const [x, y] = pos(e), dx = x - w.x0, dy = y - w.y0;
      if (!w.moved) { this.tapCb && this.tapCb(w.x0, w.y0); return; }
      if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.4 && this.swipeCb) this.swipeCb(dx, dy);
    };
    T.addEventListener('pointerup', up); T.addEventListener('pointercancel', up);
    T.addEventListener('contextmenu', e => e.preventDefault());
  },

  hit(x, y) {
    let best = null, bd = 1e9;
    for (const b of this.BTN) {
      if (b.n === 'swap' && !this.showSwap) continue;
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r * 1.3 && d < bd) { best = b; bd = d; }
    }
    return best;
  },

  // f — куда смотрит боец (+1 вправо). Двойное нажатие «вперёд» и удержание = Дыхание.
  read(f) {
    const h = {};
    for (const id in this.pts) { const b = this.hit(this.pts[id][0], this.pts[id][1]); if (b) h[b.n] = true; }
    this.held = h;
    const k = this.keys, e = this.edge, now = this.clock();
    const cur = { left: !!(k.left || h.left), right: !!(k.right || h.right) };
    for (const d of ['left', 'right']) {
      if (cur[d] && !this.prev[d]) {                       // новое нажатие
        this.armed = (now - this.last[d] < 0.33) ? (d === 'right' ? 1 : -1) : 0;
        this.last[d] = now;
      }
      if (!cur[d] && this.prev[d] && this.armed === (d === 'right' ? 1 : -1)) this.armed = 0;
    }
    this.prev = cur;
    const fw = f || 1;
    const dbl = this.armed === fw && ((fw > 0 && cur.right) || (fw < 0 && cur.left));
    const I = {
      mx: (cur.right ? 1 : 0) - (cur.left ? 1 : 0),
      block: (k.block || h.block) ? 1 : 0,
      jump: e.jump ? 1 : 0, punch: e.punch ? 1 : 0, kick: e.kick ? 1 : 0, slash: e.slash ? 1 : 0, magic: e.magic ? 1 : 0, swap: e.swap ? 1 : 0,
      breath: (dbl || k.breath || h.breath) ? 1 : 0,
    };
    this.edge = {};
    return I;
  },

  draw(c) {
    if (!this.touch) return;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const b of this.BTN) {
      if (b.n === 'swap' && !this.showSwap) continue;
      const on = this.held[b.n];
      c.globalAlpha = on ? 0.6 : 0.28; c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
      c.globalAlpha = 0.7; c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.stroke();
      c.globalAlpha = 0.95; c.fillStyle = '#fff';
      c.font = 'bold ' + (b.t.length > 2 ? 20 : 34) + 'px Arial, sans-serif';
      c.fillText(b.t, b.x, b.y + 1);
    }
    c.restore();
  },
};
