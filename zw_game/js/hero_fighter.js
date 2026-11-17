'use strict';
// Связка бойца с 3D-героем: состояния боя -> клипы единого скелета, хитбоксы из настоящих костей, оружие в правой кисти.

// насколько ладонь сдвинута от торца древка к середине (топоры, косы, глефы держат за середину)
function H3_GRIP(kind) { return kind === 'axe' || kind === 'scythe' || kind === 'glaive' ? 0.22 : 0; }
// где носится неактивное оружие: по порядку в слотах. Лёгкое — на поясе/плечах, кинжалы — на бёдрах, тяжёлое — по центру спины
function h3mountOf(F, id) {
  const l = F.loadout || [], k = (WEAPONS[id] || {}).kind, heavy = Loadout.heavy(id), dag = k === 'daggers';
  let n = 0; for (const x of l) { if (x === id) break; const kx = (WEAPONS[x] || {}).kind; if (Loadout.heavy(x) === heavy && (kx === 'daggers') === dag) n++; }
  // anchor: кость; o — смещение (вперёд, вверх) в «корпусной» системе; d — направление клинка (вперёд, вверх), back — рисовать за телом
  if (heavy) return { a: 'Hips', o: [-16, -2], d: [-0.30, 0.95], back: true };                          // по центру спины, головой вверх-назад
  if (dag) return n % 2 ? { a: 'Hips', o: [-8, 0], d: [0.06, -0.99], back: false } : { a: 'Hips', o: [11, 0], d: [0.10, -0.99], back: false };   // на бёдрах
  if (n === 0) return { a: 'Hips', o: [-14, 3], d: [-0.45, -0.89], back: true };                       // у пояса сзади, клинок вниз-назад
  if (n === 1) return { a: 'Spine2', o: [-9, 15], d: [0.55, -0.83], back: true };                      // крест-накрест за спиной
  return { a: 'Hips', o: [-6, 6], d: [-0.55, -0.83], back: true };
}
const H3_YAW = 68 * Math.PI / 180;    // 3/4: лицом к экрану чуть повёрнут к зрителю
// какие клипы играют удары героя: клип, с какого кадра стартуем (пропускаем долгую «раскачку»), окно удара, конец (кадры клипа, 30 к/с)
// всё взято из actions.json единого скелета (кадры удара посчитаны по движению конечности)
const H3_ATK = {
  punch: { clip: 'attack_punch', f0: 8, act: [15, 22], end: 36, strike: 'LeftHandEnd', pts: ['hdF'] },
  kick: { clip: 'attack_kick', f0: 8, act: [18, 23], end: 44, strike: 'RightToeEnd', pts: ['ftF'] },
  sword: { clip: 'attack_sword', f0: 10, act: [23, 29], end: 50, strike: 'RightHandEnd', pts: ['blade'] },
  slash: { clip: 'attack_slash', f0: 6, act: [16, 22], end: 42, strike: 'RightHandEnd', pts: ['blade'] },
  flip: { clip: 'attack_sword2', f0: 22, act: [33, 39], end: 64, strike: 'RightHandEnd', pts: ['blade'], air: true },
  great: { clip: 'attack_greatsword', f0: 6, act: [18, 25], end: 52, strike: 'RightHandEnd', pts: ['blade'] },
  stab: { clip: 'attack_elbow', f0: 12, act: [27, 37], end: 62, strike: 'RightHandEnd', pts: ['blade'] },
  cast: { clip: 'cast_magic', f0: 22, act: [40, 40], end: 72, strike: 'RightHandEnd', pts: [], spawn: 40 },
  heal: { clip: 'smoking', f0: 330, act: [385, 385], end: 428, strike: 'RightHandEnd', pts: [], spawn: 385 },
};
// вариации: удары по очереди, чтобы бой не был однотипным
const H3_VAR = { punch: ['punch'], kick: ['kick'], slash: ['sword', 'slash', 'sword', 'flip'], cut: ['slash', 'sword', 'slash', 'flip'], heavy: ['great'], stab: ['stab'], flurry: ['slash', 'sword'] };

// превращает исходную анимацию игры (урон, отбрасывание, оглушение) в анимацию героя на клипе скелета
function heroAnimFor(base, F) {
  let key;
  if (base.name === 'magic') key = F.magicId === 'heal' ? 'heal' : 'cast';
  else { const v = H3_VAR[base.name] || ['sword']; F.vn = (F.vn || 0) + 1; key = v[F.vn % v.length]; }
  const d = H3_ATK[key], sp = H3.SPEED[d.clip], fps = 30, t = f => (f - d.f0) / fps / sp;
  const o = Object.assign({}, base, { clip: d.clip, f0: d.f0, strike: d.strike, pts: d.pts.slice(), air: !!d.air });
  const a0 = t(d.act[0]); o.acts = [[a0, Math.max(t(d.act[1]), a0 + 0.1)]]; o.act = o.acts[0]; o.act0 = a0; o.dur = t(d.end);
  if (d.spawn) o.spawn = t(d.spawn);
  if (base.name === 'flurry') { const m = (o.act[0] + o.act[1]) / 2; o.acts = [[o.act[0], m], [m, o.act[1] + 0.05]]; }
  o.keys = null;
  return o;
}

Object.assign(Fighter.prototype, {
  h3src() {
    const S = this.state, an = this.an, H = Hero3D, br = Math.sin(this.t * (this.breathMode === 2 ? 5.2 : 3.2));
    const idleMods = (extra) => {
      const m = [['Spine1', 0, br * 0.018], ['Spine2', 0, br * 0.025], ['Neck', 0, -br * 0.012], ['LeftArm', 2, br * 0.02], ['RightArm', 2, -br * 0.02]];
      return extra ? m.concat(extra) : m;
    };
    let s;
    if (S === 'attack') {
      const a = this.anim, f = a.f0 + this.at * H3.SPEED[a.clip] * 30;
      s = { clip: a.clip, f, loop: false, key: 'atk' + a.clip, air: a.air };
    } else if (S === 'hurt') {
      s = { clip: 'hit_uppercut', f: Math.min(24, this.t * 30 * 1.7), loop: false };
    } else if (S === 'down') {
      s = { clip: 'die', f: Math.min(132, this.t * 30 * 2.4), loop: false };
    } else if (S === 'getup') {
      s = { clip: 'die', f: Math.max(40, 120 - this.t / 0.4 * 80), loop: false, key: 'getup' };
    } else if (S === 'jump') {
      const u = clamp((this.vy + JUMPV) / (2 * JUMPV), 0, 1);
      s = { clip: 'jump', f: 6 + u * 18, loop: false };
    } else if (S === 'block') {
      s = { clip: 'attack_greatsword', f: 0, loop: false, key: 'block', mods: [['Spine', 0, 0.20], ['Spine1', 0, 0.2], ['Neck', 0, 0.18], ['LeftArm', 2, 0.5], ['RightArm', 2, -0.5], ['LeftForeArm', 0, -0.7], ['RightForeArm', 0, -0.7]] };
    } else if (S === 'breath') {
      s = { clip: 'attack_greatsword', f: 0, loop: false, key: 'inhale', mods: [['Spine', 0, -0.12], ['Spine1', 0, -0.16], ['Spine2', 0, -0.14], ['Neck', 0, -0.2]] };
    } else if (S === 'win') {
      s = { clip: 'attack_greatsword', f: 0, loop: false, key: 'win', mods: [['Spine1', 0, -0.1], ['Spine2', 0, -0.12], ['Neck', 0, -0.1], ['LeftArm', 2, 0.9], ['RightArm', 2, -0.9]] };
    } else if (this.moving) {
      const rel = this.vx * this.f >= 0;
      s = { clip: 'run', f: this.runPh * 22 * (rel ? 1 : -1), loop: true, key: rel ? 'runF' : 'runB' };
    } else {
      s = { clip: 'attack_greatsword', f: 0, loop: false, key: 'idle', mods: idleMods() };
    }
    an.setSrc(s, S === 'attack' ? 0.07 : S === 'hurt' ? 0.04 : S === 'down' ? 0.06 : 0.12);
  },

  h3update(dt) {
    const an = this.an;
    this.moving = this.state === 'idle' && Math.abs(this.vx) > 40 && this.y >= 0;
    if (this.moving) this.runPh = ((this.runPh || 0) + Math.abs(this.vx) * dt / 290);
    const yawT = this.f * H3_YAW; an.yaw = an.yaw === undefined || an.yaw === 0 ? yawT : an.yaw;
    an.yaw += clamp(yawT - an.yaw, -dt * 14, dt * 14);
    this._h3dt = dt; this.h3src(); an.update(dt);
    this.computeWorld();
  },

  // экранные координаты кости (тот же проект, что и в рендере)
  h3pt(name) {
    const an = this.an, p = an.pw[Hero3D.idx[name]], k = H3.K * (this.cfg.scale || 1), s = Math.sin(an.yaw), c = Math.cos(an.yaw);
    return [this.x + (c * p[0] + s * p[2]) * k, this.y - p[1] * k];
  },

  h3pp(p) { const an = this.an, k = H3.K * (this.cfg.scale || 1), s = Math.sin(an.yaw), c = Math.cos(an.yaw); return [this.x + (c * p[0] + s * p[2]) * k, this.y - p[1] * k]; },

  // экранная точка и направление ножен для оружия id
  h3mount(id) {
    const m = h3mountOf(this, id), P = n => this.h3pt(n), A = P(m.a), hp = P('Hips'), sp = P('Spine2'), sc = this.cfg.scale || 1, f = this.f;
    const ux = sp[0] - hp[0], uy = sp[1] - hp[1], ang = Math.atan2(ux, -uy), cs = Math.cos(ang), sn = Math.sin(ang);
    const R = (fx, up) => { const x = f * fx, y = -up; return [x * cs - y * sn, x * sn + y * cs]; };
    const o = R(m.o[0] * sc, m.o[1] * sc), d = R(m.d[0], m.d[1]), dl = Math.hypot(d[0], d[1]) || 1;
    return { x: A[0] + o[0], y: A[1] + o[1], dx: d[0] / dl, dy: d[1] / dl, back: m.back };
  },

  h3world() {
    const an = this.an; if (!an.pw) { this.h3src(); an.update(0); }
    an.apply();   // матрицы кожи именно этого бойца
    const palm = Hero3D.palmWorld(), P = n => this.h3pt(n), a = this.anim, st = this.state === 'attack' && a && a.strike ? a.strike : '';
    const lead = st.startsWith('Left') ? 'Left' : 'Right', other = lead === 'Left' ? 'Right' : 'Left';
    let legF = 'Left'; if (st.endsWith('ToeEnd')) legF = st.startsWith('Left') ? 'Left' : 'Right';
    const legB = legF === 'Left' ? 'Right' : 'Left';
    const hand = P(lead + 'HandEnd'), hand2 = P(other + 'HandEnd');
    const sc = this.cfg.scale || 1, rw = P('RightHand'), re = P('RightHandEnd'), rh = palm ? this.h3pp(palm) : [(rw[0] + re[0]) / 2, (rw[1] + re[1]) / 2], wl = this.wk.len * sc;
    // направление клинка: по кисти; если кисть смотрит в камеру/от камеры (вертушки) — подмешиваем направление предплечья, чтобы меч не дёргался
    let dx = re[0] - rw[0], dy = re[1] - rw[1]; const dl = Math.hypot(dx, dy) || 1;
    const pw = an.pw, I = Hero3D.idx, d3 = Math.hypot(pw[I.RightHandEnd][0] - pw[I.RightHand][0], pw[I.RightHandEnd][1] - pw[I.RightHand][1], pw[I.RightHandEnd][2] - pw[I.RightHand][2]) * H3.K * sc || 1;
    const fa = P('RightForeArm'); let fx = rw[0] - fa[0], fy = rw[1] - fa[1]; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const wgt = clamp(dl / (d3 * 0.7), 0, 1); dx = dx / dl * wgt + fx * (1 - wgt); dy = dy / dl * wgt + fy * (1 - wgt);
    const dn = Math.hypot(dx, dy) || 1; dx /= dn; dy /= dn;
    if (this.wd) { const k = 1 - Math.exp(-60 * (this._h3dt || 0.016)); if (dx * this.wd[0] + dy * this.wd[1] > -0.3) { dx = this.wd[0] + (dx - this.wd[0]) * Math.min(1, k * 1.5); dy = this.wd[1] + (dy - this.wd[1]) * Math.min(1, k * 1.5); const n2 = Math.hypot(dx, dy) || 1; dx /= n2; dy /= n2; } }
    this.wd = [dx, dy];
    this.W = {
      pel: P('Hips'), chest: P('Spine2'), neck: P('Neck'), head: P('Head'),
      elF: P(lead + 'ForeArm'), hdF: st.startsWith('Right') || !st ? rh : hand, elB: P(other + 'ForeArm'), hdB: hand2,
      knF: P(legF + 'Leg'), ftF: P(legF + 'ToeEnd'), knB: P(legB + 'Leg'), ftB: P(legB + 'ToeEnd'),
      tip: [rh[0] + dx * wl * (1 - H3_GRIP(this.wk.kind)), rh[1] + dy * wl * (1 - H3_GRIP(this.wk.kind))],
    };
    if (this.state === 'attack' && a && a.strike && a.strike.startsWith('Left') && a.pts.includes('hdF')) this.W.hdF = P(a.strike);
    if (this.state === 'attack' && a && a.strike && a.strike.endsWith('ToeEnd')) this.W.ftF = P(a.strike);
    // левая кисть (второй кинжал)
    const pl = Hero3D.palmWorld('Left'), lw = P('LeftHand'), le = P('LeftHandEnd'); let lx = le[0] - lw[0], ly = le[1] - lw[1]; const ll = Math.hypot(lx, ly) || 1;
    this.lRoot = pl ? this.h3pp(pl) : [(lw[0] + le[0]) / 2, (lw[1] + le[1]) / 2]; this.lDir = [lx / ll, ly / ll]; this.lR = Hero3D.palmS.Left.r * H3.K * sc;
    this.wRoot = rh; this.wDir = [dx, dy]; this.palmR = palm ? Hero3D.palmR * H3.K * sc : 0;
    this.sk.wep.wang = Math.atan2((dx) * this.f, dy);
    this.W.hdF = this.W.hdF || rh;
    this.Wc = this.W.hdF; this.gy = 0;
    // слабые места для «стойка/удар» рисуются от земли: оставляем gy=0
  },
});

(function () {   // computeWorld героя
  const _cw = Fighter.prototype.computeWorld;
  Fighter.prototype.computeWorld = function () { if (this.m3d) return this.h3world(); return _cw.call(this); };
})();
