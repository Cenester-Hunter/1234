'use strict';
// Анимации: ключевые позы по времени. У каждого удара есть замах (anticipation), сам удар,
// перелёт (follow-through) и возврат, как в нормальной скелетной анимации.
// acts = окна, в которых удар наносит урон; pts = какие точки скелета бьют; weapon = урон зависит от оружия.

const ANIMS = {};

function defAnim(name, o) {
  o.name = name;
  o.keys = o.keys.map(([t, p, e]) => ({ t, p: P(p), e: e || EASE.out }));
  o.dur = o.keys[o.keys.length - 1].t;
  o.acts = o.acts || [o.act];
  o.act = o.acts[0]; o.act0 = o.acts[0][0];
  ANIMS[name] = o;
}

// ---- руки и ноги
const PUNCH_HIT = { lean: 26, aF: 98, eF: 4, dx: 22, aB: 8, eB: 112, tF: 32, kF: -28, tB: -26 };
defAnim('punch', {
  dmg: 5, kb: 130, stun: 0.28, act: [0.1, 0.2], shake: 2, lunge: 150, pts: ['hdF'], r: 17, snd: 'whoosh',
  keys: [
    [0, {}],
    [0.06, { lean: 15, aF: 24, eF: 128, dx: -9, aB: 32, eB: 98, tF: 26 }, EASE.io],
    [0.12, PUNCH_HIT, EASE.in],
    [0.22, Object.assign({}, PUNCH_HIT, { lean: 29, dx: 26, aF: 102 })],
    [0.42, {}, EASE.io],
  ],
});

const KICK_HIT = { lean: -16, tF: 98, kF: 6, dx: 10, aF: 52, eF: 60, aB: -22, eB: 80 };
defAnim('kick', {
  dmg: 8, kb: 230, stun: 0.36, act: [0.17, 0.3], shake: 3, lunge: 90, pts: ['ftF'], r: 20, snd: 'whoosh',
  keys: [
    [0, {}],
    [0.1, { lean: -4, tF: 56, kF: -90, dx: -5, aF: 20, eF: 100 }, EASE.io],
    [0.2, KICK_HIT, EASE.in],
    [0.33, Object.assign({}, KICK_HIT, { lean: -20, tF: 104 })],
    [0.58, {}, EASE.io],
  ],
});

// ---- мечи и клинки
const SL_HIT = { lean: 31, aF: 86, eF: 6, w: 5, dx: 36, aB: -10, eB: 112, tF: 38, kF: -34, tB: -30, kB: -20 };
defAnim('slash', {
  weapon: 1, dmg: 14, kb: 320, stun: 0.45, act: [0.24, 0.38], shake: 6, lunge: 120, kd: true, launch: 330,
  pts: ['blade'], r: 13, snd: 'whoosh',
  keys: [
    [0, {}],
    [0.14, { lean: -7, aF: 158, eF: 36, w: -10, dx: -15, aB: 42, eB: 90, tF: 30, kF: -20 }, EASE.io],
    [0.22, { lean: 6, aF: 130, eF: 20, w: -25, dx: 4, aB: 20, eB: 100 }, EASE.in],
    [0.3, SL_HIT, EASE.in],
    [0.44, Object.assign({}, SL_HIT, { lean: 36, aF: 70, dx: 42, w: 28 })],
    [0.7, {}, EASE.io],
  ],
});

// катана: быстрый выпад с широкой дугой
const CUT_W = { lean: -6, aF: 158, eF: 38, aB: 150, eB: 42, w: -100, dx: -18, tF: 36, kF: -46, tB: -34, kB: -8 };
const CUT_M = { lean: 20, aF: 112, eF: 12, aB: 92, eB: 30, w: -30, dx: 20, tF: 44, kF: -32, tB: -38, kB: -4 };
const CUT_H = { lean: 34, aF: 74, eF: 4, aB: 52, eB: 38, w: 6, dx: 52, tF: 52, kF: -28, tB: -44, kB: -2 };
defAnim('cut', {
  weapon: 1, dmg: 11, kb: 290, stun: 0.4, act: [0.17, 0.32], shake: 4, lunge: 200, pts: ['blade'], r: 13, snd: 'katana',
  keys: [
    [0, {}],
    [0.09, CUT_W, EASE.io],
    [0.17, CUT_M, EASE.in],
    [0.24, CUT_H, EASE.in],
    [0.36, Object.assign({}, CUT_H, { lean: 38, aF: 58, dx: 60, w: 26, aB: 40 })],
    [0.58, {}, EASE.io],
  ],
});

// тяжёлое оружие: коса, секира. Долгий замах над головой и сбивание с ног
const HV_W = { lean: -14, aF: 178, eF: 20, aB: 170, eB: 22, w: -120, dx: -24, tF: 30, kF: -50, tB: -30, kB: -14 };
const HV_H = { lean: 40, aF: 60, eF: 6, aB: 40, eB: 30, w: 12, dx: 46, tF: 56, kF: -34, tB: -44, kB: -2 };
defAnim('heavy', {
  weapon: 1, dmg: 16, kb: 380, stun: 0.5, act: [0.36, 0.52], shake: 8, lunge: 110, kd: true, launch: 380,
  pts: ['blade'], r: 15, snd: 'whoosh',
  keys: [
    [0, {}],
    [0.14, { lean: 14, aF: 60, eF: 80, aB: 50, eB: 90, dx: -10, tF: 44, kF: -70, tB: -30, kB: -30 }, EASE.io],
    [0.3, HV_W, EASE.io],
    [0.38, HV_H, EASE.in],
    [0.52, Object.assign({}, HV_H, { lean: 44, dx: 52 })],
    [0.86, {}, EASE.io],
  ],
});

// древковое оружие: колющий удар
const ST_H = { lean: 22, aF: 92, eF: 4, w: 2, aB: 70, eB: 30, dx: 46, tF: 50, kF: -34, tB: -40, kB: -4 };
defAnim('stab', {
  weapon: 1, dmg: 10, kb: 230, stun: 0.34, act: [0.17, 0.3], shake: 3, lunge: 170, pts: ['blade'], r: 13, snd: 'whoosh',
  keys: [
    [0, {}],
    [0.1, { lean: 6, aF: 52, eF: 92, w: -30, aB: 20, eB: 100, dx: -14, tF: 30, kF: -40 }, EASE.io],
    [0.18, ST_H, EASE.in],
    [0.32, Object.assign({}, ST_H, { lean: 26, dx: 54 })],
    [0.52, {}, EASE.io],
  ],
});

// кинжалы: три быстрых укола
const FL_A = { lean: 18, aF: 96, eF: 6, w: 0, aB: 40, eB: 100, dx: 24, tF: 40, kF: -30 };
const FL_B = { lean: 18, aF: 40, eF: 100, w: 0, aB: 96, eB: 6, dx: 26, tF: 40, kF: -30 };
defAnim('flurry', {
  weapon: 1, dmg: 8, kb: 120, stun: 0.22, acts: [[0.06, 0.13], [0.18, 0.25], [0.3, 0.38]], shake: 2, lunge: 120,
  pts: ['blade', 'hdB'], r: 14, snd: 'whoosh',
  keys: [
    [0, {}],
    [0.06, FL_A, EASE.in],
    [0.12, FL_A],
    [0.18, FL_B, EASE.in],
    [0.24, FL_B],
    [0.3, FL_A, EASE.in],
    [0.37, Object.assign({}, FL_A, { lean: 24, dx: 32 })],
    [0.6, {}, EASE.io],
  ],
});

// заклинание: руки вперёд
const MAGIC_HIT = { lean: 10, aF: 98, eF: 4, aB: 96, eB: 6, dx: 8 };
defAnim('magic', {
  spawn: 0.3, act: [9, 9], pts: [], snd: 'magic',
  keys: [
    [0, {}],
    [0.18, { lean: 6, aF: 60, eF: 60, aB: 55, eB: 65, dx: -6 }, EASE.io],
    [0.3, MAGIC_HIT],
    [0.46, MAGIC_HIT],
    [0.7, {}, EASE.io],
  ],
});

function samplePose(a, t, out) {
  const k = a.keys;
  if (t <= 0) return Object.assign(out, k[0].p);
  if (t >= a.dur) return Object.assign(out, k[k.length - 1].p);
  let i = 0;
  while (i < k.length - 2 && t >= k[i + 1].t) i++;
  const u = (t - k[i].t) / (k[i + 1].t - k[i].t);
  return mixPose(k[i].p, k[i + 1].p, k[i + 1].e(u), out);
}

// Позы состояний
const POSE = {
  idle: BASE,
  block: P({ lean: 14, neck: 6, aF: 70, eF: 115, aB: 60, eB: 120, dx: -6, tF: 36, kF: -50, tB: -20, kB: 0 }),
  hurt: P({ lean: -20, neck: -12, aF: -35, eF: 45, aB: -15, eB: 70, dx: -10, tF: 10, kF: -15, tB: -22, kB: 8 }),
  air: P({ lean: 6, aF: 120, eF: 40, aB: 100, eB: 60, tF: 60, kF: -80, tB: -10, kB: -90 }),
  down: P({ rot: -88, lean: 0, aF: 140, eF: 15, aB: 120, eB: 10, tF: 20, kF: -10, tB: -5, kB: -10 }),
  crouch: P({ lean: 24, aF: 50, eF: 70, aB: 30, eB: 90, tF: 70, kF: -100, tB: -30, kB: -70 }),
  win: P({ lean: -4, aF: 165, eF: 10, aB: 150, eB: 15, tF: 12, kF: -14, tB: -12, kB: -14, w: -10 }),
  // глубокий вдох: грудь вперёд, голова назад, руки раскрыты
  inhale: P({ lean: -9, neck: -12, aF: 26, eF: 62, aB: 20, eB: 70, dx: -4, tF: 26, kF: -34, tB: -22, kB: -10, w: -70 }),
};

// Ходьба: цикл из двух фаз на каждую ногу. Нога, идущая вперёд (перенос), сгибает колено, опорная — почти прямая.
// Скорость фазы привязана к скорости тела, поэтому стопа не «скользит». dir = +1 вперёд, -1 назад (фаза идёт в обратную сторону).
function walkPose(ph, out, dir) {
  const s = Math.sin(ph), c = Math.cos(ph) * (dir || 1);
  const swF = Math.pow(Math.max(0, c), 1.2), swB = Math.pow(Math.max(0, -c), 1.2);
  return Object.assign(out, BASE, {
    tF: 14 + 30 * s, kF: -(6 + 58 * swF),
    tB: -12 - 30 * s, kB: -(6 + 58 * swB),
    aF: 36 - 12 * s, aB: 16 + 12 * s, lean: 11 + 1.5 * Math.abs(c), dx: 0,
  });
}
