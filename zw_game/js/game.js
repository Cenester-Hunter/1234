'use strict';
// Главный цикл: состояния (заставка → карта → бой → K.O. → итог), режимы, снаряды, камера, отрисовка, шейдеры.
// БЕЗ замедлений: ни hitstop, ни slow-mo (G.hitstop оставлен пустым, чтобы старый код не ломался).

const view0 = document.getElementById('c');
const cv = document.createElement('canvas');              // внутренний холст, в который рисует игра
cv.width = view0.width; cv.height = view0.height;
const c = cv.getContext('2d');
const Q = new URLSearchParams(location.search);

const G = {
  state: 'title', t: 0, fx: new FX(), projs: [], strikes: [], hero: null, foe: null, ai: null, heroAI: null,
  cam: { x: 0, s: 1 }, shake: 0, time: 99, paused: false, flashT: 0,
  auto: Q.get('auto') === '1', koT: 0, resT: 0, introT: 0, winner: null, banner: '',
  mode: 'tour', run: null, label: '', earn: 0, stats: { dmg: 0, hits: 0 }, noBlock: false,
};
G.hitstop = () => {};

// ---------- снаряды и молнии
G.shoot = (o, s) => {
  Sfx.play(s.kind === 'wave' ? 'katana' : 'magic');
  G.projs.push({
    x: o.W.hdF[0] + o.f * 20, y: o.W.hdF[1], vx: s.vx * o.f, vy: s.vy || 0, owner: o, t: 0,
    dmg: s.dmg, kb: s.kb, kind: s.kind, col: s.col, r: s.r, big: s.big, pierce: s.kind === 'wave', hit: false,
  });
};
G.bolt = o => {
  const tg = o === G.hero ? G.foe : G.hero;
  G.strikes.push({ x: tg.x, t: 0.6, owner: o }); Sfx.play('warn');
};

// ---------- режимы
G.begin = (mode, target) => {
  const d = Save.d, lv = Save.level(), gm = GAUNTLET[mode];
  const loc = gm ? gm.loc : (UI.loc || 1), L = LOCS[loc];
  G.mode = mode; G.stats = { dmg: 0, hits: 0 }; G.earn = 0; G.loc = loc; G.loot = null; G.bonus = '';
  const run = G.run = { mode, loc, idx: 0, wave: 0, queue: [], gold: 0, trial: null, gaunt: gm || null };
  switch (mode) {
    case 'tour':
      if ((d[L.tour] || 0) >= L.stages.length) d[L.tour] = 0;
      run.idx = d[L.tour] || 0; run.queue = L.stages.map(s => ({ st: s, mul: 1 })); break;
    case 'duel': {
      const i = Math.min(L.stages.length - 1, Math.floor(Math.random() * Math.min(5, 2 + lv)));
      run.queue = [{ st: L.stages[i], mul: 1 }]; break;
    }
    case 'hunter': case 'scarlett':
      {   // каждый бой акта — отдельный: победа сохраняется навсегда, после боя игрок возвращается на карту
        const i = target != null ? target : Acts.next(mode), lp = d[mode === 'scarlett' ? 'loop2' : 'loop1'] || 0, m = Math.min(2.2, 1 + 0.18 * lp);
        run.loopNo = lp + 1; run.target = i;
        run.queue = [{ st: i < 6 ? gm.guards[i] : gm.boss, mul: m, heal: 0, guard: i < 6, boss: i === 6, T: Acts.tier(mode, i), reqLv: Acts.req(mode, i)[0] }];
      }
      break;
    case 'surv': run.queue = null; break;
    case 'trial': {
      const T = run.trial = L.trials[(d[L.trial] || 0) % L.trials.length];
      run.queue = T.foes.map(i => ({ st: L.stages[i], mul: 1 })); break;
    }
  }
  G.hero = null;
  nextFight();
};

function nextFight() {
  const run = G.run, d = Save.d, L = LOCS[run.loc];
  let desc;
  if (run.mode === 'surv') {
    const w = run.wave, st = L.stages[w % L.stages.length];
    desc = { st, mul: 1 + 0.09 * w, wave: w + 1 };
  } else desc = run.queue[run.idx];
  startFight(desc);
}

function startFight(desc) {
  const run = G.run, S = desc.st, lv = Save.level();
  G.desc = desc;
  // герой: создаётся в начале забега, между боями лечится
  if (!G.hero) {
    G.hero = new Fighter(heroCfg(), -260, 1, true);
    if (run.trial && run.trial.heroHp) { G.hero.maxhp = G.hero.hp = G.hero.lag = run.trial.heroHp; }
  } else {
    const heal = desc.heal != null ? desc.heal : run.mode === 'surv' ? 0.3 : 0.6;
    G.hero.hp = Math.min(G.hero.maxhp, Math.round(G.hero.hp + G.hero.maxhp * heal));
  }
  G.hero.reset(-260, 1); G.hero.lag = G.hero.hp; G.hero.en = Math.max(G.hero.en, 20);
  const cfg = Object.assign({}, S.cfg);
  // сила врага: стражи и боссы — по уровню снаряжения, на который они рассчитаны (хардкор); остальные режимы — по уровню героя
  const T = desc.T || Math.min(GEAR_MAX, lv), K = desc.boss ? BAL.boss : desc.guard ? BAL.guard : BAL.normal, sc = Tier.scale(T, K);
  cfg.hp = Math.round(cfg.hp * sc.hp * desc.mul); cfg.dmg = (cfg.dmg || 1) * sc.dmg * (1 + (desc.mul - 1) * 0.5);
  if (run.trial && run.trial.dark) cfg.dark = true;
  G.noBlock = !!(run.trial && run.trial.noBlock);
  G.foe = new Fighter(cfg, 260, -1, false);
  G.ai = new AI(S.ai);
  // нехватка снаряжения/уровня: на 1 ступень — враг бьёт в разы больнее, на 2 и больше — каждый удар врага убивает с одного раза (ваншот)
  G.foe.lethal = 0;
  if (desc.T) { const def = Math.max(desc.T - Gear.cur(), (desc.reqLv || 0) - lv); G.foe.lethal = def >= 2 ? 2 : def === 1 ? 1 : 0; }
  if (G.auto) G.heroAI = new AI({ react: 0.12, block: 0.5, cdMin: 0.35, cdMax: 0.8, range: 125, aggr: 0.8, magic: 1, jump: 0.02 });
  Bg.blood = !!S.blood || run.loc === 2;
  Bg.build(S.bg, S.grade);
  setGrade(S.grade);
  G.projs = []; G.strikes = []; G.fx = new FX();
  G.cam.x = 0; G.cam.s = 1.1;
  G.state = 'intro'; G.introT = 0; G.shake = 0; G.winner = null;
  G.time = run.trial ? run.trial.time : run.mode === 'surv' ? 999 : desc.boss ? 120 : 99;
  G.earn = 0;
  const sfx = run.loc === 2 ? ' II' : '';
  const lab = { tour: 'ТУРНИР' + sfx + ' · БОЙ ' + (run.idx + 1) + ' / 5', duel: 'ДУЭЛЬ' + sfx, surv: 'ВЫЖИВАНИЕ' + sfx + ' · ВОЛНА ' + (desc.wave || 1), trial: 'ИСПЫТАНИЕ' + sfx + ' · ' + (run.trial ? run.trial.name : '') };
  if (run.gaunt) lab[run.mode] = run.gaunt.name + (run.loopNo > 1 ? ' · КРУГ ' + run.loopNo : '') + (desc.boss ? ' · БОСС' : ' · СТРАЖ ' + (run.target + 1) + ' / 6');
  G.label = lab[run.mode];
  Sfx.startDrone();
}

function setGrade(gr) {
  const P = Post.P; gr = gr || [0, 0, 0, 0]; G.gradeA = gr[3] * 0.55; G.gradeT = [gr[0] / 255, gr[1] / 255, gr[2] / 255];
  P.tint = [gr[0] / 255, gr[1] / 255, gr[2] / 255]; P.tintA = gr[3] * 0.55;
}

function startKO() {
  const h = G.hero, f = G.foe;
  let w;
  if (f.hp <= 0) w = h;
  else if (h.hp <= 0) w = f;
  else w = (h.hp / h.maxhp >= f.hp / f.maxhp) ? h : f;
  G.banner = (h.hp > 0 && f.hp > 0) ? 'ВРЕМЯ' : 'K.O.';
  G.winner = w; G.state = 'ko'; G.koT = 0; G.shake = 7;
  for (const q of [h, f]) if (q.breathMode) { q.breathMode = 0; }
  Sfx.play('ko');
  if (f.hp > 0 && h.hp > 0) Sfx.play('laughKO');
}

// после победы/поражения: награда, сохранение
function finishFight() {
  const run = G.run, d = Save.d, S = G.desc.st, lv = Save.level(), L = LOCS[run.loc];
  G.lastWin = G.winner === G.hero; G.loot = null; G.bonus = '';
  if (!G.lastWin) { G.earn = 0; G.next = run.mode === 'surv' ? 'end' : 'retry'; if (run.mode === 'surv') endSurvival(); Save.put(); return; }
  Sfx.play('win');
  let gold = Math.round((S.reward || 100) * (1 + 0.05 * (lv - 1)) * (G.desc.T ? 1 + BAL.goldPerTier * (G.desc.T - 1) : 1));
  G.resNote = '';
  if (run.mode === 'surv') gold = Math.round(45 * L.gm);
  if (run.mode === 'trial') gold = run.trial.reward / run.queue.length | 0;
  gold += Math.floor(Math.max(0, G.time) / 4) * (run.mode === 'surv' ? 0 : 1);
  d.gold += gold; G.earn = gold; run.gold += gold; d.wins++;
  if (run.mode === 'tour') { run.idx++; d[L.tour] = run.idx; if (run.idx >= L.stages.length) { d[L.tour] = 0; G.next = 'victory'; } else { G.next = 'map'; G.resNote = 'Турнир: победа ' + run.idx + ' из ' + L.stages.length + ' сохранена'; } }
  else if (run.mode === 'surv') { run.wave++; if (run.wave > (d[L.best] || 0)) d[L.best] = run.wave; G.next = 'next'; }
  else if (run.mode === 'trial') { run.idx++; if (run.idx >= run.queue.length) { d[L.trial] = ((d[L.trial] || 0) + 1) % L.trials.length; G.next = 'victory'; } else G.next = 'next'; }
  else if (run.gaunt) {
    const act = run.mode, i = run.target;
    if (i < 6) {            // страж повержен навсегда: поражения дальше его не вернут
      Acts.win(act, i); G.next = 'map'; UI.gsel[act] = Acts.next(act);
      G.resNote = 'Страж ' + (i + 1) + ' повержен навсегда · стражей: ' + Acts.count(act) + ' / 6' + (Acts.count(act) === 6 ? ' · путь к боссу открыт' : '');
    } else {                // главный босс повержен: прогресс стражей сбрасывается, акт идёт по кругу
      const first = !d[act]; d[act] = 1; G.next = 'victory';
      Acts.reset(act); UI.gsel[act] = 0; d[act === 'scarlett' ? 'loop2' : 'loop1'] = (d[act === 'scarlett' ? 'loop2' : 'loop1'] || 0) + 1;
      G.resNote = 'Стражи снова на местах — акт можно пройти по кругу (враги сильнее)';
      if (!first) { const b = act === 'scarlett' ? 600 : 300; d.gold += b; G.earn += b; }
      if (first) {
        const names = [], DR = DROPS[act];
        for (const k of ['w', 'a', 'm']) for (const id of DR[k]) if (!d.owned[k].includes(id)) { d.owned[k].push(id); names.push(Items.dbs[k][id].name); }
        const bonus = act === 'hunter' ? 500 : 1000; d.gold += bonus; G.earn += bonus; G.loot = names;
        if (act === 'hunter') G.next = 'chapter';
      }
    }
  } else G.next = run.mode === 'duel' ? 'map' : 'victory';
  Save.put();
}

function endSurvival() { Save.put(); }

// ---------- шаг симуляции
function sim(dt, active) {
  Input.showSwap = !!(G.hero && G.hero.loadout && G.hero.loadout.length > 1);
  let hi = NOINPUT, ei = NOINPUT;
  if (active) {
    hi = G.auto ? G.heroAI.think(G.hero, G.foe, dt, G) : Input.read(G.hero.f);
    if (G.noBlock) hi = Object.assign({}, hi, { block: 0 });
    ei = G.ai.think(G.foe, G.hero, dt, G);
  } else Input.read(G.hero ? G.hero.f : 1);
  const a = G.hero, b = G.foe;
  a.update(dt, hi, b, G); b.update(dt, ei, a, G);

  // бойцы не проходят друг сквозь друга (в прыжке можно перелететь)
  const dx = b.x - a.x;
  if (Math.abs(dx) < 80 && a.y > -60 && b.y > -60) {
    const push = (80 - Math.abs(dx)) / 2, s = sign(dx) || a.f;
    a.x = clamp(a.x - push * s, -ARENA, ARENA); b.x = clamp(b.x + push * s, -ARENA, ARENA);
  }
  if (Math.abs(dx) > 1300) { const s = sign(dx), p = (Math.abs(dx) - 1300) / 2; a.x += p * s; b.x -= p * s; }

  // снаряды
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const q = G.projs[i];
    q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind !== 'wave') G.fx.spark(q.x, q.y, 1, q.col, 80, 3, 0.35);
    const tg = q.owner === a ? b : a;
    if (!q.hit && tg.hp > 0 && tg.state !== 'down' && tg.state !== 'getup' && tg.hitTest(q.x, q.y, q.r || 20)) {
      tg.takeHit(q.owner, { dmg: q.dmg, kb: q.kb, stun: 0.4, shake: 4, name: 'proj', snd: q.kind === 'wave' ? 'katana' : 'proj' }, G, [q.x, q.y], sign(q.vx));
      G.fx.spark(q.x, q.y, 18, q.col, 380, 4, 0.5);
      if (q.kind !== 'wave') G.fx.img('fxBurst', q.x, q.y + 40, 0.55, 0, 0.5);
      if (q.pierce) q.hit = true; else { G.projs.splice(i, 1); continue; }
    }
    if (Math.abs(q.x) > ARENA + 300 || q.t > 3) G.projs.splice(i, 1);
  }
  // молнии с задержкой: кольцо-предупреждение, затем удар
  for (let i = G.strikes.length - 1; i >= 0; i--) {
    const s = G.strikes[i]; s.t -= dt;
    if (s.t <= 0) {
      const tg = s.owner === a ? b : a;
      G.fx.bolt(s.x, '#8fd0ff'); G.fx.spark(s.x, -10, 24, '#bfe4ff', 500, 4, 0.5); G.shake = Math.max(G.shake, 5); G.flashT = 0.12; Sfx.play('bolt');
      if (tg.hp > 0 && Math.abs(tg.x - s.x) < 85 && tg.y > -170 && tg.state !== 'down')
        tg.takeHit(s.owner, { dmg: 18, kb: 300, stun: 0.5, shake: 6, name: 'bolt', kd: true, launch: 360 }, G, [tg.x, tg.y - 100], sign(tg.x - s.x) || 1);
      G.strikes.splice(i, 1);
    }
  }

  G.fx.update(dt);
  const mid = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
  const ts = clamp(1000 / (dist + 420), 0.85, 1.35), lim = Math.max(0, ARENA + 120 - 640 / ts);
  G.cam.s += (ts - G.cam.s) * Math.min(1, dt * 4);
  G.cam.x += (clamp(mid, -lim, lim) - G.cam.x) * Math.min(1, dt * 6);
}

function step(dt) {
  G.t += dt; Bg.update(dt);
  if (Bg.blood && G.state === 'fight') {            // Вечная Гроза: далёкие вспышки молний
    G.stormT = (G.stormT == null ? 4 : G.stormT) - dt;
    if (G.stormT <= 0) { G.stormT = 6 + Math.random() * 8; G.flashT = Math.max(G.flashT || 0, 0.1); G.flick = 0.22; }
    if (G.flick > 0) { G.flick -= dt; if (G.flick < 0.12 && G.flick > 0.1) G.flashT = Math.max(G.flashT || 0, 0.07); }
  }
  Input.clock = () => G.t;
  // параметры шейдера
  const P = Post.P;
  G.flashT = Math.max(0, G.flashT - dt); P.flash = G.flashT * 0.8;
  let rage = 0, hh = G.hero;
  if (hh && (G.state === 'fight' || G.state === 'intro' || G.state === 'ko')) {
    rage = hh.breathMode === 2 ? 1 : hh.breathMode === 1 ? clamp(hh.bt / BREATH_CHARGE, 0, 1) * 0.7 : 0;
    P.warp = [clamp((640 + (hh.x - G.cam.x) * G.cam.s) / 1280, 0, 1), 1 - clamp((GSY - 90 * G.cam.s) / 720, 0, 1), hh.breathMode ? 1 : 0];
  } else P.warp[2] = 0;
  P.rage += (rage - P.rage) * Math.min(1, dt * 6);
  P.aber = 0.0012 + G.shake * 0.00018;
  // свет луны: в новолуние темнее, в полнолуние ярче лучи, при затмении сцена краснеет
  const ML = Bg.moon;
  P.dark = (1 - ML.m) * 0.15;
  P.light = [clamp(ML.x / 1280, 0, 1), 1 - clamp(ML.y / 720, 0, 1)];
  const gt = G.gradeT || [0, 0, 0], ga = G.gradeA || 0, e = ML.e;
  P.tint = [lerp(gt[0], 1, e), lerp(gt[1], 0.42, e), lerp(gt[2], 0.3, e)]; P.tintA = Math.max(ga, (Bg.blood ? 0.12 : 0.42) * e);
  if (G.paused) return;
  if (G.state === 'title' || G.state === 'map' || G.state === 'arsenal' || G.state === 'chapter') {
    Input.read(1);
    if (G.auto && G.state === 'title') {
      UI.loc = parseInt(Q.get('loc') || '1', 10);
      if (GAUNTLET[Q.get('mode')]) G.begin(Q.get('mode'), Q.get('t') != null ? parseInt(Q.get('t'), 10) : undefined);
      else G.begin(Q.get('mode') || 'tour'), (G.run.idx = parseInt(Q.get('stage') || '0', 10) || 0, nextFight());
    }
    return;
  }
  G.shake *= Math.exp(-dt * 9); if (G.shake < 0.1) G.shake = 0;
  switch (G.state) {
    case 'intro':
      G.introT += dt; sim(dt, false);
      if (G.introT > 1.7) G.state = 'fight';
      break;
    case 'fight':
      sim(dt, true); G.time -= dt;
      if (G.hero.hp <= 0 || G.foe.hp <= 0 || G.time <= 0) startKO();
      break;
    case 'ko':
      G.koT += dt; sim(dt, false);
      if (G.koT > 1.4 && G.winner.state !== 'win') { G.winner.anim = null; G.winner.state = 'win'; }
      if (G.koT > 2.6) { G.state = 'result'; G.resT = 0; finishFight(); }
      break;
    case 'result':
      G.resT += dt; sim(dt, false);
      if (G.auto && G.resT > 0.3) onTap(-1, -1);
      break;
  }
}

// ---------- ввод
function onTap(x, y) {
  Sfx.init(); Sfx.startDrone();
  if (G.paused) {
    if (x >= 0 && UI.tap(x, y)) return;
    G.paused = false; return;
  }
  switch (G.state) {
    case 'title':
      if (x >= 0 && UI.tap(x, y)) return;
      if (UI.slots) return;
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && (el.requestFullscreen || el.webkitRequestFullscreen)) {
          const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
          if (p && p.catch) p.catch(() => {});
        }
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (e) { /* не критично */ }
      Sfx.play('ui'); G.state = 'map'; break;
    case 'map': case 'arsenal':
      if (x >= 0) UI.tap(x, y); break;
    case 'result':
      if (G.resT < 0.5) return;
      if (x >= 0 && UI.tap(x, y)) return;
      resultDefault(); break;
    case 'victory':
      if (x >= 0 && UI.tap(x, y)) return;
      toMap(); break;
    case 'chapter':
      if (x >= 0) UI.tap(x, y); break;
  }
}

function resultDefault() {
  Sfx.play('ui');
  if (G.lastWin) {
    if (G.next === 'next') nextFight();
    else if (G.next === 'map') toMap();
    else if (G.next === 'chapter') { G.state = 'chapter'; Sfx.play('laughKO'); }
    else { G.state = 'victory'; G.vicT = 0; Bg.blood = G.run && G.run.loc === 2; Bg.build('lava', [255, 70, 10, 0.4]); setGrade([255, 70, 10, 0.4]); }
  } else if (G.next === 'end') toMap();
  else {
    G.hero = null;
    nextFight();
  }
}

function togglePause() {
  if (G.state === 'intro' || G.state === 'fight' || G.state === 'ko') G.paused = !G.paused;
}


function toMap() { G.paused = false; G.state = 'map'; Bg.blood = false; Bg.build('ruins'); setGrade([0, 0, 0, 0]); }

// ---------- отрисовка
function drawFight() {
  Bg.draw(c, G.cam);
  Bg.atmos(c, G.cam, G.t);
  Bg.petals(c, false);
  const s = G.cam.s, sh = G.shake;
  c.save();
  c.translate(640 - G.cam.x * s + (Math.random() - 0.5) * sh, GSY + (Math.random() - 0.5) * sh);
  c.scale(s, s);
  Bg.posts(c); Bg.decor(c, G.t);
  // предупреждение молнии
  for (const k of G.strikes) {
    const p = 1 - k.t / 0.6;
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#8fd0ff'; c.globalAlpha = 0.4 + 0.5 * p; c.lineWidth = 4;
    c.beginPath(); c.ellipse(k.x, 6, 90 * (1.1 - p * 0.3), 20, 0, 0, TAU); c.stroke(); c.restore();
  }
  const a = G.hero, b = G.foe;
  if (a.state === 'attack' && b.state !== 'attack') { Render.fighter(c, b, G.t); Render.fighter(c, a, G.t); }
  else { Render.fighter(c, a, G.t); Render.fighter(c, b, G.t); }
  for (const q of G.projs) Render.proj(c, q, G.t);
  G.fx.draw(c);
  c.restore();
  Bg.fore(c, G.cam, G.t);
  Bg.front(c);
  Bg.petals(c, true);
  Render.hud(c, G);
  if (G.state === 'intro') {
    if (G.introT < 1.0) Render.bigText(c, G.label.split(' · ')[0], 300, 90, '#fff', G.foe.cfg.name.toUpperCase(), 38);
    else Render.bigText(c, 'В БОЙ!', 320, 110, '#ffd25a');
  } else if (G.state === 'ko') {
    Render.bigText(c, G.banner, 330, 130, '#ff4a3a');
  } else if (G.state === 'result' && G.resT > 0.3) drawResult();
  Input.draw(c);
  c.font = 'bold 30px Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillText('II', 1236, 165);
  if (G.paused) {
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, 1280, 720);
    Render.bigText(c, 'ПАУЗА', 330, 110, '#fff', 'Тапни или P — продолжить', 30);
    UI.button(c, 490, 480, 300, 64, 'НА КАРТУ', toMap, { size: 28 });
  }
}

function drawResult() {
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, 1280, 720);
  if (G.lastWin) {
    Render.bigText(c, 'ПОБЕДА', 250, 110, '#58ff7a', '+' + G.earn + ' монет' + (G.bonus ? ' · ' + G.bonus : ''), 32);
    if (G.loot && G.loot.length) {
      c.textAlign = 'center'; c.font = 'bold 26px Arial, sans-serif'; c.lineWidth = 5; c.strokeStyle = '#000';
      c.strokeText('ДОБЫЧА С БОССА', 640, 340); c.fillStyle = '#ffd25a'; c.fillText('ДОБЫЧА С БОССА', 640, 340);
      c.font = 'bold 22px Arial, sans-serif';
      G.loot.forEach((n, i) => { c.strokeText('✦ ' + n, 640, 372 + i * 28); c.fillStyle = '#fff'; c.fillText('✦ ' + n, 640, 372 + i * 28); });
    }
    if (G.resNote) { c.textAlign = 'center'; c.font = 'bold 22px Arial, sans-serif'; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#9fe8b0'; c.strokeText(G.resNote, 640, 408); c.fillText(G.resNote, 640, 408); }
    const label = G.next === 'next' ? 'ДАЛЬШЕ' : G.next === 'map' ? 'В ЛОББИ' : 'ПРОДОЛЖИТЬ';
    UI.button(c, 470, 430, 340, 72, label, resultDefault, { on: true, size: 36 });
    if (G.next !== 'map') UI.button(c, 470, 520, 340, 56, 'НА КАРТУ', () => { Sfx.play('ui'); toMap(); }, { size: 24 });
  } else {
    const sub = G.run.mode === 'surv' ? 'Пройдено волн: ' + G.run.wave + ' (рекорд ' + (Save.d.bestSurv || 0) + ')' : G.run.gaunt ? 'Побеждённые стражи остаются павшими' : 'Не сдавайся';
    Render.bigText(c, 'ПОРАЖЕНИЕ', 250, 110, '#ff4a3a', sub, 32);
    UI.button(c, 470, 430, 340, 72, G.run.mode === 'surv' ? 'НА КАРТУ' : 'ЕЩЁ РАЗ', resultDefault, { on: true, size: 36 });
    if (G.run.mode !== 'surv') UI.button(c, 470, 520, 340, 56, 'НА КАРТУ', () => { Sfx.play('ui'); toMap(); }, { size: 24 });
  }
}

// Какая дорожка играет: Акт I — 'dark' («Вечный Мрак»), Акт II — 'storm' («Вечная Гроза»). Чужая никогда не звучит: дорожку выбирает только номер акта.
function wantMusic() {
  const st = G.state, tr = loc => loc === 2 ? 'storm' : 'dark';
  if (st === 'map') return tr(UI.loc);
  if (st === 'arsenal') return Music.want;        // арсенал открыт с карты: музыка как была
  if (st === 'intro' || st === 'fight' || st === 'ko' || st === 'result' || st === 'victory') return G.run ? tr(G.run.loc) : null;
  return null;
}

function draw() {
  Music.update(wantMusic());
  c.setTransform(RS, 0, 0, RS, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  UI.regs = [];
  switch (G.state) {
    case 'title':
      Bg.draw(c, G.cam); Bg.front(c); UI.title(c, G); break;
    case 'map': UI.map(c, G); break;
    case 'arsenal': UI.arsenal(c, G); break;
    case 'chapter': UI.chapter(c, G); break;
    case 'victory':
      Bg.draw(c, G.cam); Bg.front(c);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, 1280, 720);
      if (G.run && G.run.gaunt) {
        Render.bigText(c, G.run.mode === 'scarlett' ? 'SCARLETT ПОВЕРЖЕНА' : 'ОХОТНИК ПОВЕРЖЕН', 250, 78, '#58ff7a', 'Акт ' + ACTLIST[G.run.mode].num + ' · ' + ACTLIST[G.run.mode].title + ' · круг ' + (G.run.loopNo || 1) + ' пройден', 30);
        if (G.loot && G.loot.length) {
          c.textAlign = 'center'; c.font = 'bold 26px Arial, sans-serif'; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#ffd25a';
          c.strokeText('ДОБЫЧА', 640, 340); c.fillText('ДОБЫЧА', 640, 340); c.font = 'bold 22px Arial, sans-serif';
          G.loot.forEach((n, i) => { c.strokeText('✦ ' + n, 640, 374 + i * 28); c.fillStyle = '#fff'; c.fillText('✦ ' + n, 640, 374 + i * 28); });
        }
        c.font = 'bold 22px Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#9fe8b0'; c.lineWidth = 5; c.strokeStyle = '#000';
        c.strokeText(G.resNote || '', 640, 500); c.fillText(G.resNote || '', 640, 500);
      } else Render.bigText(c, 'ТЫ ПРОШЁЛ ИСПЫТАНИЕ', 300, 78, '#58ff7a', G.run && G.run.mode === 'tour' ? 'Все ' + LOCS[G.run.loc].stages.length + ' бойцов повержены' : G.label, 34);
      c.font = 'bold 26px Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd25a'; c.fillText('Тапни — в лобби', 640, 560);
      break;
    default:
      drawFight();
  }
  Post.present(G.t);
}

// ---------- размер, качество, цикл
let RS = 1, RSMAX = 1.5;
const isPortrait = () => innerHeight > innerWidth;
function fit() {
  const view = Post.view || view0;
  if (!(innerWidth > 0 && innerHeight > 0)) return;
  // в портрете игра скрыта плашкой «поверни телефон»: холсты не трогаем (иначе на каждый промежуточный размер
  // пересоздаются большие буферы и видеокарта может отобрать WebGL-контекст -> чёрный экран)
  if (isPortrait()) { if (G.state === 'fight' || G.state === 'intro') G.paused = true; return; }
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  view.style.width = Math.floor(1280 * s) + 'px'; view.style.height = Math.floor(720 * s) + 'px';
  const rs = clamp(s * (window.devicePixelRatio || 1), 0.75, RSMAX);
  if (!Render.A || Math.abs(rs - RS) > 0.01 || cv.width !== Math.round(1280 * rs)) {
    RS = rs; cv.width = Math.round(1280 * RS); cv.height = Math.round(720 * RS);
    view.width = cv.width; view.height = cv.height;
    Render.alloc(RS);
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
}
// поворот шлёт пачку событий с промежуточными размерами: берём последнее после паузы и повторяем через 0.5 с (браузер дообновляет размер)
let fitTimer = 0;
function fitSoon() { clearTimeout(fitTimer); fitTimer = setTimeout(() => { try { fit(); } catch (e) { console.error(e); } }, 120); }
addEventListener('resize', fitSoon);
addEventListener('orientationchange', () => { fitSoon(); setTimeout(fitSoon, 500); setTimeout(fitSoon, 1200); });
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => { fitSoon(); setTimeout(fitSoon, 500); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { fitSoon(); setTimeout(fitSoon, 500); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.state === 'fight' || G.state === 'intro')) G.paused = true; });

Save.load(); Sprites.init();
if (Q.get('lvl')) Save.d.wins = (parseInt(Q.get('lvl'), 10) - 1) * 3;
if (Q.get('hermit') || Q.get('hunter')) Save.d.hunter = 1;
if (Q.get('gear')) { const n = parseInt(Q.get('gear'), 10); Save.d.up['w:' + Save.d.eq.w] = n; Save.d.up['a:' + Save.d.eq.a] = n; }
if (Q.get('gold')) Save.d.gold = parseInt(Q.get('gold'), 10);
if (Q.get('seen')) Save.d.seenLv = Save.level();
const VIEW = Post.init(view0, cv);
Post.onView = v => { Input.cv = v; fit(); };
Input.init(VIEW);
Input.swipeMode = () => G.state === 'map' || G.state === 'arsenal';
Input.swipeCb = (dx, dy) => UI.swipe(dx, dy);
Input.dragCb = (dx, dy) => UI.drag(dx, dy);
Input.tapCb = onTap; Input.pauseCb = () => { if (G.state === 'map' || G.state === 'arsenal' || G.state === 'chapter' || G.state === 'victory') return; togglePause(); };
Input.debugCb = () => { DEBUG = !DEBUG; }; Input.keyCb = code => UI.key(code);
Bg.build('ruins'); fit();
if (Q.get('q')) Post.q = parseInt(Q.get('q'), 10);

// адаптивное качество: если кадры тяжёлые, сначала режем шейдеры, потом разрешение
const perf = { acc: 0, n: 0 };
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const raw = (ts - last) / 1000 || 0;
  const dt = Math.min(0.033, raw);
  last = ts;
  if (!G.auto && !G.paused && raw < 0.5) {
    perf.acc += raw; perf.n++;
    if (perf.n >= 90) {
      const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
      if (avg > 0.026) { if (Post.q > 0) Post.q--; else if (RSMAX > 0.8) { RSMAX = Math.max(0.8, RSMAX - 0.2); fit(); } }
    }
  }
  if (isPortrait()) return;        // экран повёрнут: ничего не рисуем, пока не вернут горизонт
  // одна ошибка в кадре не должна оставлять экран чёрным: цикл живёт дальше, кадр всё равно выводится на экран
  try { step(dt); } catch (e) { console.error(e); }
  try { draw(); } catch (e) { console.error(e); try { Post.present(G.t); } catch (e2) { } }
}
requestAnimationFrame(frame);

// для автотестов: прогнать n шагов по 1/60 с без ожидания кадров
window.__G = G; window.__UI = UI; window.__Save = Save;
window.__step = n => { for (let i = 0; i < n; i++) step(1 / 60); draw(); };
