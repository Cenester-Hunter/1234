'use strict';
// Простой ИИ: решает раз в несколько десятых секунды, что делать.
// Выдаёт тот же intent, что и игрок: {mx, jump, block, punch, kick, slash, magic}.

class AI {
  constructor(p) {
    this.p = Object.assign({ react: 0.3, block: 0.2, cdMin: 0.8, cdMax: 1.6, range: 125, aggr: 0.5, magic: 0, jump: 0.05 }, p);
    this.cool = rand(0.6, 1.3); this.blockT = 0; this.seen = false; this.rt = 0; this.willBlock = false;
    this.mode = 1; this.modeT = 0;
  }

  think(f, foe, dt, G) {
    const I = Object.assign({}, NOINPUT), p = this.p;
    if (f.state === 'breath') { I.breath = 1; return I; }        // держим вдох до конца
    if (f.canBreathe && f.breathMode === 0 && f.breathCd <= 0 && f.state === 'idle' && Math.random() < dt * 0.6) { I.breath = 1; return I; }
    if (f.state !== 'idle' && f.state !== 'jump' && f.state !== 'block' && f.state !== 'attack') return I;
    const dx = foe.x - f.x, d = Math.abs(dx), dir = sign(dx), reach = (f.wk.len - 100) * 0.55;
    this.cool -= dt;

    // реакция на удар или снаряд соперника
    let threat = foe.state === 'attack' && d < 240;
    for (const q of G.projs) if (q.owner !== f && Math.abs(q.x - f.x) < 260) threat = true;
    if (threat) {
      if (!this.seen) { this.seen = true; this.rt = p.react * rand(0.6, 1.3); this.willBlock = Math.random() < p.block; }
      if (this.rt > 0) this.rt -= dt; else if (this.willBlock) this.blockT = 0.3;
    } else this.seen = false;
    this.blockT -= dt;
    if (this.blockT > 0 && f.y >= 0 && f.state !== 'attack') { I.block = 1; return I; }
    if (f.state === 'attack') return I;

    this.modeT -= dt;
    if (this.modeT <= 0) {
      this.modeT = rand(0.25, 0.7);
      const r = Math.random();
      this.mode = d > p.range + reach + 40 ? 1 : d < p.range + reach - 60 ? (r < 0.5 ? -1 : 0) : (r < p.aggr ? 1 : r < 0.8 ? 0 : -1);
      if (Math.abs(f.x) > ARENA - 90 && this.mode === -1 && sign(f.x) === -dir) this.mode = 1;
    }
    I.mx = dir * this.mode;

    if (this.cool <= 0 && d < p.range + reach + 50 && f.state !== 'block') {
      const r = Math.random();
      if (d < 105) I[r < 0.4 ? 'punch' : r < 0.75 ? 'kick' : 'slash'] = 1;
      else I[r < 0.35 ? 'kick' : 'slash'] = 1;
      this.cool = rand(p.cdMin, p.cdMax);
    } else if (p.magic && f.en >= MAGICS[f.magicId].cost && d > 230 && this.cool <= 0 && Math.random() < 0.03) {
      I.magic = 1; this.cool = rand(p.cdMin, p.cdMax);
    }
    if (f.y >= 0 && Math.random() < p.jump * dt) I.jump = 1;
    return I;
  }
}
