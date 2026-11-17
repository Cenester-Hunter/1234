'use strict';
// Боец: состояния, физика, удары, попадания, режим «Дыхание». Игрок и враг — один класс,
// отличаются только тем, кто подаёт «намерения» (intent) в update().

const GRAV = 2600, JUMPV = 980, ARENA = 880, SPEED = 270;
const ACTS = ['punch', 'kick', 'slash', 'magic'];
const CAPS = [
  ['pel', 'chest', 21], ['chest', 'head', 16], ['pel', 'knF', 14], ['knF', 'ftF', 12],
  ['pel', 'knB', 14], ['knB', 'ftB', 12], ['chest', 'elF', 11], ['elF', 'hdF', 10], ['chest', 'elB', 11], ['elB', 'hdB', 10],
];
const NOINPUT = { mx: 0, jump: 0, block: 0, punch: 0, kick: 0, slash: 0, magic: 0, breath: 0 };
const BREATH_CHARGE = 0.8, BREATH_TIME = 7, BREATH_CD = 8;

class Fighter {
  constructor(cfg, x, f, hero) {
    this.cfg = cfg; this.hero = !!hero;
    this.maxhp = cfg.hp; this.hp = cfg.hp; this.lag = cfg.hp;
    this.buffs = cfg.buffs || []; this.wrath = 0; this.volT = rand(3, 5);
    this.spd = cfg.spd || 1; this.dmgMul = cfg.dmg || 1; this.take = (cfg.take || 1) * (this.buffs.includes('stone') ? 0.8 : 1);
    this.wid = cfg.weapon || 'blade'; this.wk = WEAPONS[this.wid] || WEAPONS.blade;
    this.loadout = cfg.loadout ? cfg.loadout.slice() : null; this.swapCd = 0; this.swapLock = 0; this.swap = null;
    this.magicId = cfg.magic || 'spore';
    this.canBreathe = !!cfg.breath;
    this.en = hero ? 20 : 25;
    this.tmp = {}; this.trail = []; this.lastHit = -9; this.flash = 0; this.eyeCol = cfg.eyeCol || '#ff2b2b';
    this.sk = new Skeleton(); this.W = null; this.Wc = [0, 0]; this.gy = 0;
    this.cl = 0; this.clv = 0; this.nk = 0; this.nkv = 0; this.lastLean = 0; this.lastVx = 0;
    this.scarfPts = null; this.wd = 1; this.pp = null;
    this.fire = cfg.fire || cfg.rim || '#58ff7a'; this.fire2 = cfg.fire2 || '#e8ffe8';
    this.m3d = false; this.runPh = 0;
    if (cfg.m3d && typeof Hero3D !== 'undefined' && Hero3D.init(Render.rs || 1)) { this.m3d = true; this.an = new HeroAnimator(); }
    this.reset(x, f);
  }

  reset(x, f) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0; this.f = f;
    this.state = 'idle'; this.t = 0; this.anim = null; this.at = 0; this.hitMask = 0; this.spawned = false; this.wv = false;
    this.buf = null; this.stun = 0; this.lie = 0; this.chain = 0; this.ph = 0; this.moving = false;
    this.inv = 0; this.wrath = 0; this.volT = rand(3, 5); this.breathMode = 0; this.breathT = 0; this.breathCd = 0; this.bt = 0; this.steamT = 0; this.invTxt = 0;
    this.cur = Object.assign({}, BASE); this.trail.length = 0; this.scarfPts = null; this.eyeCol = this.cfg.eyeCol || '#ff2b2b';
    this.cl = this.clv = this.nk = this.nkv = 0; this.aspd = 1;
    this.computeWorld();
  }

  computeWorld() {
    const sk = this.sk.apply(this.cur, this.wk.len);
    this.gy = sk.gy;
    const x = this.x, f = this.f, oy = this.y - sk.gy;
    const m = b => [x + f * b.ex, oy + b.ey];     // конец кости -> мировая точка (с зеркалом по взгляду)
    this.W = {
      pel: m(sk.root), chest: m(sk.torso), neck: m(sk.neck), head: m(sk.head),
      elF: m(sk.uaF), hdF: m(sk.faF), elB: m(sk.uaB), hdB: m(sk.faB), tip: m(sk.wep),
      knF: m(sk.thF), ftF: m(sk.shF), knB: m(sk.thB), ftB: m(sk.shB),
    };
    this.Wc = this.W.hdF;
  }

  mouth() {
    const a = this.W.neck, b = this.W.head;
    return [lerp(a[0], b[0], 0.5) + this.f * 8, lerp(a[1], b[1], 0.5) + 4];
  }

  // скорость по умолчанию с учётом брони и Дыхания
  get speedMul() { return this.spd * (this.breathMode === 2 ? 1.22 : 1) * (this.wrath ? 1.2 : 1); }
  get dmgBuff() { return this.dmgMul * (this.breathMode === 2 ? 1.35 : 1) * (this.wrath ? 1.25 : 1); }

  update(dt, I, foe, G) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.inv = Math.max(0, this.inv - dt);
    this.invTxt -= dt;
    this.lag += (this.hp - this.lag) * Math.min(1, dt * (this.hp < this.lag ? 1.6 : 12));
    this.en = Math.min(100, this.en + dt * (this.hero ? 4 : 3));
    this.breathCd = Math.max(0, this.breathCd - dt);
    this.swapCd = Math.max(0, this.swapCd - dt); this.swapLock = Math.max(0, this.swapLock - dt); if (this.swap) { this.swap.t += dt; if (this.swap.t > 0.4) this.swap = null; }
    if (I.swap && this.hero && this.loadout && this.loadout.length > 1) this.doSwap(G);
    for (const a of ACTS) if (I[a]) this.buf = { a, t: 0.22 };
    if (this.swapLock > 0) this.buf = null;
    if (this.buf) { this.buf.t -= dt; if (this.buf.t <= 0) this.buf = null; }

    // баффы босса: регенерация, ярость на половине здоровья, залп хвостов
    if (this.buffs.length && this.hp > 0 && G.state === 'fight') this.updBuffs(dt, G, foe);

    // Дыхание: активный режим тикает и лечит
    if (this.breathMode === 2) {
      this.breathT -= dt;
      this.hp = Math.min(this.maxhp, this.hp + 3 * dt);
      this.steamT -= dt;
      const mo = this.mouth();
      if (this.steamT <= 0) { this.steamT = this.state === 'attack' ? 0.07 : 0.2; G.fx.steam(mo[0], mo[1], this.f, 1, false); }
      if (Math.random() < dt * 40) G.fx.ember(this.x, this.y - rand(20, 170), 1, Math.random() < 0.5 ? this.fire : this.fire2);
      if (this.breathT <= 0) this.endBreath(G);
    }

    const S = this.state, ground = this.y >= 0;
    if (S === 'idle' || S === 'jump' || S === 'block') {
      this.f = sign(foe.x - this.x) || this.f;
      if (S !== 'jump') {
        if (I.block && ground) { if (S !== 'block') { this.state = 'block'; this.t = 0; } }
        else if (S === 'block') this.state = 'idle';
      }
      if (this.state === 'block') this.vx *= Math.exp(-dt * 10);
      else {
        const rel = I.mx * this.f, sp = SPEED * this.speedMul * (rel < 0 ? 0.78 : 1);
        this.vx += (I.mx * sp - this.vx) * (1 - Math.exp(-dt * (ground ? 14 : 2.5)));
        if (I.breath && this.canBreathe && this.breathCd <= 0 && this.breathMode === 0 && ground && S === 'idle') this.startBreath(G);
        else if (I.jump && ground) { this.vy = -JUMPV; this.state = 'jump'; this.t = 0; Sfx.play('jump'); }
        else if (this.buf) this.tryAttack(G);
      }
    } else if (S === 'breath') {
      // вдох: стоим на месте, неуязвимы, дым втягивается в рот
      this.bt += dt; this.vx *= Math.exp(-dt * 12); this.inv = Math.max(this.inv, 0.12);
      const mo = this.mouth();
      G.fx.smoke(mo[0], mo[1], 3, '#a9b4c6');
      if (Math.random() < dt * 30) G.fx.puff(this.x + rand(-30, 30), 0, 1, '#9aa4b4', 7, 0.7, 40);
      if (this.bt >= BREATH_CHARGE) this.activateBreath(G);
      else if (!I.breath) { this.state = 'idle'; this.breathMode = 0; this.breathCd = 1.5; this.inv = 0.2; }
    } else if (S === 'attack') {
      const a = this.anim;
      this.at += dt * this.aspd;
      if (this.y >= 0) this.vx *= Math.exp(-dt * 8);
      if (a.name === 'magic' && !this.spawned && this.at >= a.spawn) {
        this.spawned = true; const m = MAGICS[this.magicId];
        this.en -= m.cost; m.cast(G, this); Sfx.play(this.magicId === 'fire' ? 'fire' : 'magic');
      }
      if (this.breathMode === 2 && this.wid === 'katana' && !this.wv && this.at >= a.act[0]) {
        this.wv = true; Sfx.play('katana');
        G.shoot(this, { vx: 720, dmg: 7, kb: 200, kind: 'wave', col: this.fire, r: 30, noRot: 1 });
      }
      if (this.at >= a.dur) { this.anim = null; this.state = this.y < 0 ? 'jump' : 'idle'; }
    } else if (S === 'hurt') {
      this.stun -= dt; this.vx *= Math.exp(-dt * 7);
      if (this.stun <= 0) this.state = this.y < 0 ? 'jump' : 'idle';
    } else if (S === 'down') {
      if (this.y >= 0) {
        this.vx *= Math.exp(-dt * 6); this.lie += dt;
        if (this.lie > 0.9 && this.hp > 0) { this.state = 'getup'; this.t = 0; }
      }
    } else if (S === 'getup') {
      this.vx *= Math.exp(-dt * 8);
      if (this.t > 0.4) this.state = 'idle';
    } else if (S === 'win') this.vx *= Math.exp(-dt * 8);

    // физика
    if (this.y < 0 || this.vy < 0) {
      this.vy += GRAV * dt; this.y += this.vy * dt;
      if (this.y >= 0) {
        if (this.vy > 450) { G.fx.puff(this.x, -4, 6, '#8a9098', 7, 0.6, 30); Sfx.play('land'); }
        this.y = 0; this.vy = 0;
        if (this.state === 'jump') this.state = 'idle';
        if (this.state === 'down') { this.vx *= 0.4; G.shake = Math.max(G.shake, 3); }
      }
    }
    this.x = clamp(this.x + this.vx * dt, -ARENA, ARENA);

    if (!this.m3d && this.cfg.m3d && window.HERO_DATA && typeof Hero3D !== 'undefined' && !Hero3D.err && Hero3D.init(Render.rs || 1)) { this.m3d = true; this.an = new HeroAnimator(); }
    if (this.m3d) this.h3update(dt);
    else {
    // поза
    this.moving = this.state === 'idle' && Math.abs(this.vx) > 40 && this.y >= 0;
    if (this.moving) { const dph = this.vx * this.f * dt * 0.035; this.ph += dph; this.wd = dph >= 0 ? 1 : -1; }
    if (this.state === 'attack') samplePose(this.anim, this.at, this.cur);
    else {
      let tg;
      switch (this.state) {
        case 'hurt': tg = POSE.hurt; break;
        case 'block': tg = POSE.block; break;
        case 'down': tg = POSE.down; break;
        case 'getup': tg = POSE.crouch; break;
        case 'win': tg = POSE.win; break;
        case 'jump': tg = POSE.air; break;
        case 'breath': tg = POSE.inhale; break;
        default:
          if (this.moving) tg = walkPose(this.ph, this.tmp, this.wd);
          else {
            // дыхание-покачивание: вес переносится с ноги на ногу, торс и плечи запаздывают
            tg = Object.assign(this.tmp, BASE);
            const sp = this.breathMode === 2 ? 5.2 : 3.2, b = Math.sin(this.t * sp), w = Math.sin(this.t * sp * 0.5);
            tg.lean += b * 1.6 + (this.breathMode === 2 ? 6 : 0); tg.eF += b * 3.5; tg.aB += b * 2.5; tg.aF += b * 1.5 - 2;
            tg.dx += w * 3; tg.tF += w * 3; tg.tB -= w * 3; tg.kF -= Math.abs(w) * 3; tg.neck += -b * 1.2;
          }
      }
      mixPose(this.cur, tg, 1 - Math.exp(-dt * (this.state === 'down' ? 10 : this.state === 'breath' ? 9 : 16)), this.cur);
    }

    // вторичное движение: голова и плащ отстают от тела и пружинят (даёт «живость» как у mocap)
    const dl = (this.cur.lean - this.lastLean) / Math.max(dt, 1e-4), ax = (this.vx - this.lastVx) / Math.max(dt, 1e-4) * this.f;
    this.lastLean = this.cur.lean; this.lastVx = this.vx;
    this.nkv += (-120 * this.nk - 9 * this.nkv - dl * 0.35) * dt; this.nk = clamp(this.nk + this.nkv * dt, -14, 14);
    this.cur.neck += this.nk;
    this.clv += (-38 * this.cl - 4.5 * this.clv - ax * 0.00042 * 0 + (-ax) * 0.0005 + Math.sin(this.t * 2 + this.x * 0.01) * 0.25) * dt;
    this.cl = clamp(this.cl + this.clv * dt, -0.9, 0.9);
    this.computeWorld();
    }

    // шарф: цепочка за шеей
    if (this.cfg.scarf) this.stepScarf(dt);


    // след от удара
    if (this.state === 'attack' && this.anim.pts.length) {
      const k = this.anim.pts[0], p = k === 'blade' ? this.W.tip : this.W[k];
      const h0 = this.W.hdF, bl = k === 'blade';
      this.trail.push([p[0], p[1], bl ? lerp(h0[0], p[0], 0.4) : p[0] - this.f * 14, bl ? lerp(h0[1], p[1], 0.4) : p[1] + 10]);
      if (this.trail.length > 9) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();

    if (this.state === 'attack' && this.anim.name !== 'magic') {
      const A = this.anim.acts;
      for (let i = 0; i < A.length; i++)
        if (!(this.hitMask & (1 << i)) && this.at >= A[i][0] && this.at <= A[i][1]) { if (this.tryHit(foe, G)) this.hitMask |= 1 << i; }
    }
    // точки удара этого кадра: в следующем кадре от них считается свип
    if (this.state === 'attack') this.pp = this.anim.pts.map(k => (k === 'blade' ? [this.W.hdF.slice(), this.W.tip.slice()] : [this.W[k].slice()]));
    else this.pp = null;
  }

  stepScarf(dt) {
    const a = this.W.neck, n = 8, seg = 12;
    if (!this.scarfPts) { this.scarfPts = []; for (let i = 0; i < n; i++) this.scarfPts.push([a[0] - this.f * i * seg, a[1] + i * 2]); }
    const P = this.scarfPts; P[0][0] = a[0]; P[0][1] = a[1];
    for (let i = 1; i < n; i++) {
      const p = P[i], q = P[i - 1];
      p[0] += (-this.f * 55 - this.vx * 0.7) * dt; p[1] += (60 + Math.sin(this.t * 6 + i) * 40) * dt;
      const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1;
      p[0] = q[0] + dx / d * seg; p[1] = q[1] + dy / d * seg;
    }
  }

  // ---- Дыхание ----
  startBreath(G) {
    this.state = 'breath'; this.bt = 0; this.breathMode = 1; this.eyeCol = '#bfe4ff'; this.anim = null; this.buf = null;
    this.inv = 0.15; Sfx.play('inhale');
    G.fx.ring(this.x, 0, 120, '#bfe4ff', 0.8);
  }

  activateBreath(G) {
    this.state = 'idle'; this.breathMode = 2; this.breathT = BREATH_TIME; this.inv = 0.7; this.eyeCol = this.fire2;
    const mo = this.mouth();
    G.fx.steam(mo[0], mo[1], this.f, 16, true);
    G.fx.ring(this.x, 0, 220, this.fire, 0.7); G.fx.ring(this.x, -90, 160, '#fff', 0.5);
    G.fx.spark(this.x, this.y - 100, 30, this.fire2, 520, 4, 0.7);
    G.shake = Math.max(G.shake, 5); G.flashT = 0.25;
    Sfx.play('exhale'); Sfx.play('breathOn');
    if (this.hero) G.fx.text(this.x, this.y - 240, 'ДЫХАНИЕ', this.fire2, 38);
  }

  updBuffs(dt, G, foe) {
    const B = this.buffs;
    if (B.includes('regen') && this.state !== 'down') this.hp = Math.min(this.maxhp, this.hp + 2.2 * dt);
    if (B.includes('wrath') && !this.wrath && this.hp < this.maxhp * 0.5) {
      this.wrath = 1; this.flash = 0.25; G.shake = Math.max(G.shake, 8); G.flashT = 0.15;
      G.fx.text(this.x, this.y - 230, 'ЯРОСТЬ!', '#ff4a3a', 40); Sfx.play('laughKO');
      for (let i = 0; i < 30; i++) G.fx.ember(this.x, this.y - rand(10, 180), 1, this.fire);
    }
    if (this.wrath && Math.random() < dt * 25) G.fx.ember(this.x + rand(-30, 30), this.y - rand(10, 190), 1, this.fire);
    if (B.includes('volley')) {
      this.volT -= dt * (this.wrath ? 1.5 : 1);
      if (this.volT <= 0 && this.state === 'idle' && Math.abs(foe.x - this.x) > 200) {
        this.volT = rand(5, 7.5);
        G.fx.text(this.x, this.y - 230, 'ХВОСТЫ!', this.fire, 30);
        for (const a of [-0.22, 0, 0.22]) G.shoot(this, { vx: 520 * Math.cos(a), vy: 520 * Math.sin(a), dmg: 9, kb: 200, kind: 'orb', col: this.fire, r: 20 });
      } else if (this.volT <= 0) this.volT = 0.4;
    }
  }

  endBreath(G) {
    this.breathMode = 0; this.breathCd = BREATH_CD; this.eyeCol = this.cfg.eyeCol || '#ff2b2b';
    const mo = this.mouth(); G.fx.steam(mo[0], mo[1], this.f, 8, true);
  }

  // смена оружия на лету: старое уходит в ножны, следующее из слотов оказывается в руке
  doSwap(G) {
    if (this.swapCd > 0 || this.state === 'attack' || this.state === 'hurt' || this.state === 'down' || this.state === 'getup' || this.state === 'breath' || this.y < 0) return;
    const l = this.loadout, i = l.indexOf(this.wid), to = l[(i + 1) % l.length], from = this.wid;
    if (to === from) return;
    const lv = id => 1 + 0.1 * (Gear.lv('w', id) - 1);
    this.dmgMul = this.dmgMul / lv(from) * lv(to);
    this.wid = to; this.wk = WEAPONS[to] || WEAPONS.blade;
    this.swap = { t: 0, from, to }; this.swapCd = 0.9; this.swapLock = 0.4; this.buf = null;
    if (G && G.fx) G.fx.text(this.x, this.y - 215, this.wk.name, '#ffd25a', 22);
    Sfx.play('ui');
  }

  tryAttack(G) {
    const n = this.buf.a, base = ANIMS[n];
    this.buf = null;
    if (n === 'magic' && this.magicId === 'none') return;
    if (n === 'magic' && this.en < MAGICS[this.magicId].cost) {
      if (this.hero) G.fx.text(this.x, this.y - 200, 'мало энергии', '#9cf', 22);
      return;
    }
    let a = n === 'slash' ? ANIMS[this.wk.anim] : base;
    if (this.m3d) a = heroAnimFor(a, this);
    this.anim = a; this.at = 0; this.hitMask = 0; this.spawned = false; this.wv = false;
    this.aspd = (a.weapon ? this.wk.spd : 1) * (this.breathMode === 2 ? 1.25 : 1);
    this.state = 'attack'; this.t = 0;
    if (this.y >= 0) this.vx = this.f * (a.lunge || 0) * 1.3;
    Sfx.play(a.snd);
  }

  // Попадание. Три проверки (любая засчитывается), чтобы клинок не «проходил сквозь» врага:
  // 1) сам клинок/конечность в этом кадре; 2) свип — всё, что клинок прошёл с прошлого кадра (быстрый взмах между кадрами);
  // 3) зона перед бойцом на длину оружия на уровне торса (на ближней дистанции клинок оказывался «за» врагом).
  tryHit(foe, G) {
    if (foe.state === 'down' || foe.state === 'getup' || foe.state === 'win' || foe.hp <= 0) return false;
    const a = this.anim, W = this.W, sc = this.cfg.scale || 1, r = a.r;
    const cur = a.pts.map(k => (k === 'blade' ? [W.hdF, W.tip] : [W[k]]));
    const prev = this.pp && this.pp.length === cur.length ? this.pp : cur;
    const hitAt = (px, py) => foe.hitTest(px, py, r);
    let hp = null;
    for (let j = 0; j < cur.length && !hp; j++) {
      const A = cur[j], B = prev[j];
      for (let u = 0; u <= 1.001 && !hp; u += 0.25) {          // u: от прошлого положения к текущему
        const q = A.map((p, i) => [lerp(B[i][0], p[0], u), lerp(B[i][1], p[1], u)]);
        if (q.length === 2) { for (let i = 0; i <= 7; i++) { const px = lerp(q[0][0], q[1][0], i / 7), py = lerp(q[0][1], q[1][1], i / 7); if (hitAt(px, py)) { hp = [px, py]; break; } } }
        else if (hitAt(q[0][0], q[0][1])) hp = q[0];
      }
    }
    if (!hp) {   // зона перед бойцом
      const reach = a.weapon ? this.wk.len * sc * 0.85 + 36 : (a.name === 'kick' ? 125 : 100);
      const y0 = W.chest[1] - 36, y1 = W.pel[1] + (a.name === 'kick' ? 80 : 40);
      for (let i = 1; i <= 6 && !hp; i++) for (let j = 0; j < 4; j++) {
        const px = this.x + this.f * (10 + reach * i / 6), py = lerp(y0, y1, j / 3);
        if (hitAt(px, py)) { hp = [px, py]; break; }
      }
    }
    if (hp) { foe.takeHit(this, a, G, hp, 0, a.weapon ? this.wk.dmg : 1); return true; }
    return false;
  }

  hitTest(px, py, r) {
    const W = this.W, sc = this.cfg.scale || 1;
    for (const [A, B, rad] of CAPS) if (segDist(px, py, W[A][0], W[A][1], W[B][0], W[B][1]) < r + rad * sc) return true;
    return false;
  }

  // dir: куда отбросит (+1 вправо). Если не задан, считаем от положения атакующего. mul — множитель оружия.
  takeHit(att, a, G, p, dir, mul) {
    dir = dir || sign(this.x - att.x) || 1;
    if (this.inv > 0) {   // неуязвимость: удар проходит насквозь
      if (this.invTxt <= 0) { this.invTxt = 0.35; G.fx.text(p[0], p[1] - 30, 'НЕУЯЗВИМ', '#bfe4ff', 22); Sfx.play('inv'); }
      G.fx.spark(p[0], p[1], 5, '#bfe4ff', 200, 2, 0.3);
      return;
    }
    const blk = this.state === 'block' && dir === -this.f;
    let dmg = a.dmg * (mul || 1) * att.dmgBuff * this.take;
    if (att.lethal === 2) dmg = Math.max(dmg, this.maxhp * 1.5);      // снаряжение слабее нужного на 2+ ступени: удар убивает с одного раза
    else if (att.lethal === 1) dmg *= 1.8;
    if (blk) {
      dmg = Math.max(1, Math.round(dmg * 0.12));
      this.hp = Math.max(0, this.hp - dmg);
      this.vx = dir * a.kb * 0.8; att.vx = -dir * 120;
      this.en = Math.min(100, this.en + 2); this.flash = 0.1;
      G.fx.spark(p[0], p[1], 8, '#9cf', 260, 3, 0.3);
      G.fx.text(p[0], p[1] - 30, 'БЛОК', '#9cf', 24);
      Sfx.play('block'); G.shake = Math.max(G.shake, 1.5);
      return;
    }
    dmg = Math.max(1, Math.round(dmg));
    this.hp = Math.max(0, this.hp - dmg);
    this.chain = (G.t - this.lastHit < 1.1) ? this.chain + 1 : 1;
    this.lastHit = G.t;
    const kd = a.kd || this.hp <= 0 || this.chain >= 4;
    this.anim = null; this.buf = null; this.vx = dir * a.kb; this.flash = 0.12;
    if (kd) { this.state = 'down'; this.t = 0; this.lie = 0; this.vy = -(a.launch || 260); this.chain = 0; }
    else { this.state = 'hurt'; this.t = 0; this.stun = a.stun; }
    if (att.breathMode === 1) { /* вдох прерван */ }
    att.en = Math.min(100, att.en + dmg * 0.8);
    this.en = Math.min(100, this.en + dmg * 0.5);
    if (a.weapon && att.wk.steal) att.hp = Math.min(att.maxhp, att.hp + dmg * att.wk.steal);
    G.stats.dmg += att.hero ? dmg : 0; if (att.hero) G.stats.hits++;
    const big = dmg >= 10;
    const col = att.breathMode === 2 ? att.fire : big ? '#ffd25a' : '#fff2c0';
    G.fx.spark(p[0], p[1], big ? 16 : 9, col, big ? 420 : 300, big ? 4 : 3, 0.4);
    if (a.snd === 'katana' || a.name === 'slash') G.fx.img('fxCrescent', p[0], p[1], 1.6, dir > 0 ? -0.6 : 0.6, 0.3, att.f);
    G.fx.text(p[0], p[1] - 34, String(dmg), big ? '#ffb02a' : '#ffffff', big ? 34 : 26);
    Sfx.play(a.snd === 'katana' ? 'slice' : big ? 'heavy' : 'hit');
    G.shake = Math.max(G.shake, (a.shake || 3) * 0.6);
    // жуткий смех при ударах (чаще при комбо) и злорадный хохот на добивании
    if (this.hp <= 0) Sfx.play('laughKO');
    else if (att.hero && (this.chain >= 2 || Math.random() < 0.35)) Sfx.play('laughHit');
  }
}
