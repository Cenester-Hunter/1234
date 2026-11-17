'use strict';
// Оружие, броня и заклинания + сохранение прогресса.
// Хочешь своё: добавь запись сюда, затем (для оружия) нарисуй его в Render.weaponShape (js/render.js).

// Поля открытия: lvl — с какого уровня героя можно купить; need:'hunter' — только после победы над Зловещим Охотником (Локация II);
// boss:'hunter'|'scarlett' — выпадает только с босса. glow — цвет блика на лезвии.
const WEAPONS = {
  katana:  { name: 'Катана «Рассекающая»', kind: 'katana', len: 122, dmg: 0.95, spd: 1.3, anim: 'cut', price: 0, lvl: 1, desc: 'Быстрая, с длинным выпадом. В режиме Дыхания каждый удар пускает огненную волну.' },
  blade:   { name: 'Тёмный клинок', kind: 'blade', len: 100, dmg: 1.0, spd: 1.0, anim: 'slash', price: 150, lvl: 2, desc: 'Меч с арт-листа. Баланс силы и скорости.' },
  daggers: { name: 'Парные кинжалы', kind: 'daggers', len: 64, dmg: 0.62, spd: 1.7, anim: 'flurry', price: 500, lvl: 3, desc: 'Серия из трёх быстрых ударов.' },
  axe:     { name: 'Секира берсерка', kind: 'axe', len: 104, dmg: 1.5, spd: 0.7, anim: 'heavy', price: 1000, lvl: 4, desc: 'Медленная, но каждый удар сбивает с ног.' },
  scythe:  { name: 'Коса жнеца', kind: 'scythe', len: 132, dmg: 1.3, spd: 0.8, anim: 'heavy', price: 900, lvl: 5, steal: 0.15, desc: 'Тяжёлая. Возвращает 15% нанесённого урона здоровьем.' },
  glaive:  { name: 'Глефа', kind: 'glaive', len: 152, dmg: 1.1, spd: 0.95, anim: 'stab', price: 1100, lvl: 6, desc: 'Самая большая дальность, колющий удар.' },
  huntblades: { name: 'Клинки Охотника', kind: 'daggers', len: 66, dmg: 0.72, spd: 1.8, anim: 'flurry', price: 0, boss: 'hunter', steal: 0.05, glow: '#3affc8', desc: 'Награда за Зловещего Охотника. Парные клинки тени: очень быстрые.' },
  crimson: { name: 'Багровая катана «Закат»', kind: 'katana', len: 128, dmg: 1.15, spd: 1.3, anim: 'cut', price: 1500, lvl: 7, need: 'hunter', steal: 0.06, glow: '#ff4a5a', desc: 'Локация II. Быстрая и злая катана: 6% урона возвращается здоровьем.' },
  bloodaxe:{ name: 'Секира палача', kind: 'axe', len: 112, dmg: 1.85, spd: 0.75, anim: 'heavy', price: 1900, lvl: 8, need: 'hunter', glow: '#ff6a3a', desc: 'Локация II. Огромный урон, каждый удар валит с ног.' },
  foxfang: { name: 'Клыки кицунэ', kind: 'daggers', len: 70, dmg: 0.78, spd: 1.95, anim: 'flurry', price: 0, boss: 'scarlett', steal: 0.1, glow: '#ff5a9a', desc: 'Награда за Scarlett. Очень быстрые, 10% урона лечит тебя.' },
};

const ARMORS = {
  none:   { name: 'Без брони', head: 'headA', cloak: false, scale: 1, take: 1.12, spd: 1.04, hp: 0, price: 0, lvl: 1, desc: 'Начало пути: ни защиты, ни тяжести. Чуть быстрее, но бьют больнее.' },
  knight: { name: 'Чёрный рыцарь', head: 'headA', cloak: true, scale: 1, take: 1.0, spd: 1.0, hp: 0, price: 0, lvl: 2, desc: 'Стандартные доспехи. Ничего лишнего.' },
  shade:  { name: 'Тень-убийца', head: 'headC', cloak: false, scarf: true, scale: 0.97, take: 1.12, spd: 1.18, hp: -10, price: 500, lvl: 3, desc: 'Быстрее на 18%, но получаешь на 12% больше урона.' },
  warden: { name: 'Страж', head: 'headB', cloak: true, scale: 1.1, take: 0.78, spd: 0.9, hp: 30, price: 800, lvl: 4, desc: '+30 здоровья, урон по тебе на 22% меньше, но медленнее.' },
  demon:  { name: 'Демон-ронин', head: 'headA', cloak: true, horns: true, scale: 1.05, take: 0.95, spd: 1.05, hp: 10, dmg: 1.12, price: 1300, lvl: 6, desc: 'Рога и ярость: +12% к урону, чуть быстрее и крепче.' },
  hunter: { name: 'Плащ Охотника', head: 'headC', cloak: true, scarf: true, scale: 1, take: 0.88, spd: 1.12, hp: 15, dmg: 1.06, price: 0, boss: 'hunter', desc: 'Награда за Зловещего Охотника. Плащ тени: +12% скорости и -12% урона по тебе.' },
  blood:  { name: 'Кровавые латы', head: 'headB', cloak: true, horns: true, scale: 1.08, take: 0.7, spd: 0.9, hp: 45, dmg: 1.05, price: 1800, lvl: 7, need: 'hunter', desc: 'Локация II. -30% получаемого урона и +45 здоровья.' },
  kitsune:{ name: 'Облик кицунэ', head: 'headC', cloak: false, scarf: true, ears: true, tails: 5, scale: 1, take: 0.85, spd: 1.15, hp: 20, dmg: 1.18, price: 0, boss: 'scarlett', desc: 'Награда за Scarlett. Лисьи уши и хвосты: быстрее, крепче и бьёшь на 18% сильнее.' },
};

// cast(G, owner) вызывается в момент выброса заклинания
const MAGICS = {
  none:   { name: 'Без магии', cost: 999, col: '#888', price: 0, lvl: 1, desc: 'Магия пока недоступна. Растёт уровень — открываются заклинания.', cast() {} },
  spore:  { name: 'Споровый шар', cost: 30, col: '#58ff7a', price: 0, lvl: 2, desc: 'Быстрый шар спор. 12 урона.',
    cast(G, o) { G.shoot(o, { vx: 560, dmg: 12, kb: 260, kind: 'orb', col: this.col, r: 20 }); } },
  blades: { name: 'Теневые клинки', cost: 36, col: '#b9a0ff', price: 700, lvl: 3, desc: 'Веер из трёх клинков по 7 урона.',
    cast(G, o) { for (const a of [-0.17, 0, 0.17]) G.shoot(o, { vx: 660 * Math.cos(a), vy: 660 * Math.sin(a), dmg: 7, kb: 150, kind: 'dagger', col: this.col, r: 12 }); } },
  fire:   { name: 'Огненный шар', cost: 42, col: '#ff7a2a', price: 600, lvl: 4, desc: 'Медленный и тяжёлый. 22 урона.',
    cast(G, o) { G.shoot(o, { vx: 430, dmg: 22, kb: 380, kind: 'orb', col: this.col, r: 30, big: 1 }); } },
  heal:   { name: 'Благословение', cost: 45, col: '#ffe27a', price: 800, lvl: 5, desc: 'Лечит 30 здоровья.',
    cast(G, o) {
      o.hp = Math.min(o.maxhp, o.hp + 30);
      G.fx.text(o.x, o.y - 210, '+30', '#9dff9d', 34);
      for (let i = 0; i < 26; i++) G.fx.spark(o.x + rand(-30, 30), o.y - rand(0, 150), 1, this.col, 120, 3, 0.9);
      Sfx.play('heal');
    } },
  storm:  { name: 'Грозовой разряд', cost: 40, col: '#7fc8ff', price: 0, boss: 'hunter', desc: 'Награда за Зловещего Охотника. Через миг молния бьёт туда, где стоял враг. 18 урона.',
    cast(G, o) { G.bolt(o); } },
  comet:  { name: 'Алая комета', cost: 48, col: '#ff3a5a', price: 1400, lvl: 7, need: 'hunter', desc: 'Локация II. Тяжёлая комета: 30 урона и мощный отброс.',
    cast(G, o) { G.shoot(o, { vx: 520, dmg: 30, kb: 520, kind: 'orb', col: this.col, r: 34, big: 1 }); } },
  foxfire:{ name: 'Лисье пламя', cost: 44, col: '#ff6a3a', price: 0, boss: 'scarlett', desc: 'Награда за Scarlett. Пять огоньков веером по 8 урона.',
    cast(G, o) { for (const a of [-0.3, -0.15, 0, 0.15, 0.3]) G.shoot(o, { vx: 560 * Math.cos(a), vy: 560 * Math.sin(a), dmg: 8, kb: 160, kind: 'orb', col: this.col, r: 16 }); } },
};

// ---------------------------------------------------------------- акты, уровни снаряжения, баланс
// Акт = 6 телохранителей + главный босс (7 врагов). req: [нужный уровень героя, нужный уровень снаряжения] для стражей 1..6 и босса.
// Акт I «Вечный Мрак»: страж N → ур. N и снаряжение N; босс — ур. 9. Акт II «Вечная Гроза»: вход с ур. 17, стражи с снаряжением 12..17, босс — ур. 18.
const ACTLIST = {
  hunter:   { loc: 1, num: 'I',  title: 'ВЕЧНЫЙ МРАК',  boss: 'Зловещий Охотник', req: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [9, 9]] },
  scarlett: { loc: 2, num: 'II', title: 'ВЕЧНАЯ ГРОЗА', boss: 'Scarlett',         req: [[17, 12], [17, 13], [17, 14], [17, 15], [17, 16], [17, 17], [18, 18]] },
};
const ACT2_MIN = 17;      // минимальный уровень героя, чтобы вообще попасть в Акт II
const GEAR_MAX = 18;
// Множители силы врагов акта относительно «нормального» героя того же уровня снаряжения. guard — стражи, boss — главный босс.
const BAL = { guard: { hp: 1.0, dmg: 1.5 }, boss: { hp: 1.15, dmg: 1.8 }, normal: { hp: 1, dmg: 1 }, goldPerTier: 0.12 };

// Уровень снаряжения: у каждого оружия и каждой брони свой уровень прокачки 1..18 (за монеты). Снаряжение героя = меньший из уровней надетых оружия и брони.
const Gear = {
  lv(k, id) { const u = Save.d.up; return Math.min(GEAR_MAX, (u && u[k + ':' + id]) || 1); },
  cur() { const e = Save.d.eq; return Math.min(this.lv('w', e.w), this.lv('a', e.a)); },
  cost(n) { return 30 * n + 3 * n * n; },          // цена подъёма до уровня n
  up(k, id) {
    const d = Save.d, n = this.lv(k, id) + 1;
    if (n > GEAR_MAX || !d.owned[k].includes(id)) return false;
    const c = this.cost(n); if (d.gold < c) return false;
    d.gold -= c; d.up[k + ':' + id] = n; return true;
  },
};
// Сила героя на уровне T (уровень и снаряжение = T) и во сколько раз растут урон и «эффективное здоровье» — по этому подгоняются враги.
const Tier = {
  heroDmg(T) { return (1 + 0.04 * (T - 1)) * (1 + 0.1 * (T - 1)); },
  heroEff(T) { return (120 + 11 * (T - 1)) * (1 + 0.08 * (T - 1)) / 120; },
  scale(T, k) { return { hp: this.heroDmg(T) * k.hp, dmg: this.heroEff(T) * k.dmg }; },
};
// Состояние актов: побеждённые стражи хранятся в сохранении и не сбрасываются поражением; сбрасываются после победы над боссом акта.
const Acts = {
  st(act) { const d = Save.d; if (!d.gdef[act]) d.gdef[act] = [0, 0, 0, 0, 0, 0]; return d.gdef[act]; },
  done(act, i) { return i < 6 && !!this.st(act)[i]; },
  count(act) { return this.st(act).filter(Boolean).length; },
  next(act) { const i = this.st(act).findIndex(x => !x); return i < 0 ? 6 : i; },
  req(act, i) { return ACTLIST[act].req[i]; },
  tier(act, i) { return ACTLIST[act].req[i][1]; },
  unlocked(act) { return act !== 'scarlett' || (!!Save.d.hunter && Save.level() >= ACT2_MIN); },
  // почему на этого врага нельзя (строка) или null
  lock(act, i) {
    const d = Save.d, r = this.req(act, i), g = Gear.cur();
    if (act === 'scarlett' && !d.hunter) return 'Сначала победи Зловещего Охотника';
    if (act === 'scarlett' && Save.level() < ACT2_MIN) return 'Для Акта II нужен уровень ' + ACT2_MIN;
    if (this.done(act, i)) return 'Повержен';
    if (Save.level() < r[0]) return 'Нужен уровень ' + r[0];
    if (g < r[1]) return 'Нужно снаряжение ' + r[1] + ' ур. (у тебя ' + g + ')';
    if (i === 6 && this.count(act) < 6) return 'Сначала повергни всех 6 стражей';
    return null;
  },
  win(act, i) { if (i < 6) this.st(act)[i] = 1; },
  reset(act) { Save.d.gdef[act] = [0, 0, 0, 0, 0, 0]; },
};
// Что выпадает с босса при первой победе (id предметов)
const DROPS = { hunter: { w: ['huntblades'], a: ['hunter'], m: ['storm'] }, scarlett: { w: ['foxfang'], a: ['kitsune'], m: ['foxfire'] } };
const BOSSNAME = { hunter: 'Зловещий Охотник', scarlett: 'Scarlett' };


// ---------------------------------------------------------------- слоты оружия (1..4), тяжёлое занимает 2
const SLOT_MAX = 4, SLOT_PRICE = { 2: 500, 3: 1200, 4: 2200 };
const Loadout = {
  heavy(id) { const k = (WEAPONS[id] || {}).kind; return k === 'axe' || k === 'scythe' || k === 'glaive'; },
  cost(id) { return this.heavy(id) ? 2 : 1; },
  used(l) { return l.reduce((s, i) => s + this.cost(i), 0); },
  cap() { const d = Save.d; return Math.max(d.slots, this.cost(d.eq.w)); },    // одно тяжёлое оружие влезает всегда
  fix() {
    const d = Save.d; d.slots = Math.min(SLOT_MAX, Math.max(1, d.slots | 0 || 1));
    const l = (d.loadout || []).filter((x, i, a) => d.owned.w.includes(x) && a.indexOf(x) === i);
    if (!l.includes(d.eq.w)) l.unshift(d.eq.w);
    while (this.used(l) > this.cap() && l.length > 1) { for (let j = l.length - 1; j >= 0; j--) if (l[j] !== d.eq.w) { l.splice(j, 1); break; } }
    d.loadout = l;
  },
  equip(id) {
    const d = Save.d, prev = d.eq.w; d.eq.w = id;
    if (!d.loadout.includes(id)) {
      const need = this.used(d.loadout) + this.cost(id);
      if (need > Math.max(d.slots, this.cost(id))) { const i = d.loadout.indexOf(prev); if (i >= 0) d.loadout.splice(i, 1); }
      d.loadout.push(id);
    }
    this.fix();
  },
  toggle(id) {
    const d = Save.d;
    if (!d.owned.w.includes(id)) return 'Сначала купи оружие';
    if (d.loadout.includes(id)) { if (id === d.eq.w) return 'Это оружие надето сейчас'; d.loadout.splice(d.loadout.indexOf(id), 1); return 'Убрано из слотов'; }
    if (this.used(d.loadout) + this.cost(id) > d.slots) return this.heavy(id) ? 'Тяжёлому нужно 2 свободных слота' : 'Нет свободного слота';
    d.loadout.push(id); return 'Добавлено в слоты';
  },
  buy() {
    const d = Save.d, n = d.slots + 1;
    if (n > SLOT_MAX) return 'Максимум ' + SLOT_MAX + ' слота';
    if (d.gold < SLOT_PRICE[n]) return 'Слот ' + n + ' стоит ' + SLOT_PRICE[n];
    d.gold -= SLOT_PRICE[n]; d.slots = n; Sfx.play('buy'); return 'Куплен слот ' + n;
  },
};

// Почему предмет закрыт (строка) или null, если доступен
const Items = {
  dbs: { w: WEAPONS, a: ARMORS, m: MAGICS },
  lock(k, id) {
    const it = this.dbs[k][id], d = Save.d;
    if (d.owned[k].includes(id)) return null;
    if (it.boss) return 'БОСС';
    if (it.need && !d[it.need]) return 'ЛОК. II';
    if ((it.lvl || 1) > Save.level()) return 'УР. ' + it.lvl;
    return null;
  },
  // что открывается на уровне lv (для окна «новый уровень»)
  at(lv) {
    const r = [];
    for (const k of ['w', 'a', 'm']) for (const id in this.dbs[k]) { const it = this.dbs[k][id]; if (!it.boss && !it.need && (it.lvl || 1) === lv) r.push(it.name); }
    return r;
  },
};

// ---------------------------------------------------------------- сохранение
const Save = {
  d: null, slot: 1, SLOTS: 3,
  key(n) { return n === 1 ? 'zw_save3' : 'zw_save3_' + n; },
  // краткая сводка слота для окна «Прогресс»: null — слот пуст
  peek(n) {
    const s = n === this.slot && this.d ? this.d : Store.get(this.key(n), null);
    if (!s) return null;
    return { level: 1 + Math.floor((s.wins || 0) / 3), wins: s.wins || 0, gold: s.gold || 0, hunter: !!(s.hunter || s.hermit), scarlett: !!s.scarlett, guards1: ((s.gdef || {}).hunter || []).filter(Boolean).length, guards2: ((s.gdef || {}).scarlett || []).filter(Boolean).length };
  },
  // переключиться на слот (пустой создаётся заново)
  use(n) { if (this.d) this.put(); this.slot = n; Store.set('zw_slot', n); this.load(); },
  // сбросить прогресс слота: он станет новым
  reset(n) {
    Store.set(this.key(n), null);
    if (n === this.slot) this.load();
  },
  load() {
    this.slot = Store.get('zw_slot', 1) || 1;
    const def = {
      gdef: { hunter: [0, 0, 0, 0, 0, 0], scarlett: [0, 0, 0, 0, 0, 0] }, up: {}, loop1: 0,
      gold: 600, wins: 0, tour: 0, bestTour: 0, bestSurv: 0, hunter: 0, scarlett: 0, tour2: 0, trial2: 0, bestSurv2: 0,
      owned: { w: ['katana'], a: ['none'], m: ['none'] },
      eq: { w: 'katana', a: 'none', m: 'none' },
      slots: 1, loadout: ['katana'],
    };
    const s = Store.get(this.key(this.slot), null) || {};
    this.d = Object.assign({}, def, s);
    this.d.owned = Object.assign({}, def.owned, s.owned || {});
    this.d.eq = Object.assign({}, def.eq, s.eq || {});
    this.d.gdef = Object.assign({}, def.gdef, s.gdef || {}); this.d.up = Object.assign({}, s.up || {});
    // старые сохранения: Отшельник стал Зловещим Охотником
    if (s.hermit && !s.hunter) this.d.hunter = 1;
    delete this.d.hermit;
    const o = this.d.owned;
    o.a = o.a.map(x => x === 'sage' ? 'hunter' : x); if (this.d.eq.a === 'sage') this.d.eq.a = 'hunter';
    o.m = o.m.map(x => x);
    if (this.d.hunter) for (const k of ['w', 'a', 'm']) for (const id of DROPS.hunter[k]) if (!o[k].includes(id)) o[k].push(id);
    if (this.d.scarlett) for (const k of ['w', 'a', 'm']) for (const id of DROPS.scarlett[k]) if (!o[k].includes(id)) o[k].push(id);
    for (const k of ['w', 'a', 'm']) {      // экипировано должно быть своё
      if (!o[k].includes(this.d.eq[k])) this.d.eq[k] = o[k][0];
      if (k !== 'w' && !o[k].includes('none')) o[k].unshift('none');
    }
    this.d.slots = Math.min(4, Math.max(1, this.d.slots | 0 || 1)); this.d.loadout = Array.isArray(s.loadout) ? s.loadout.slice() : [this.d.eq.w];
    Loadout.fix();
    if (this.d.seenLv == null) this.d.seenLv = this.level();
    return this.d;
  },
  put() { Store.set(this.key(this.slot), this.d); },
  level() { return 1 + Math.floor(this.d.wins / 3); },
};
