'use strict';
// Герой и враги. Все бойцы — чёрные силуэты; отличаются цветом контурного света (rim), глазами, оружием и повадками.

const HERO = {
  name: 'SF2: ZOMBIE WARRIOR', hp: 120, spd: 1, dmg: 1, weapon: 'katana', magic: 'spore', breath: true,
  rim: '#58ff7a', rim2: '#ff7a3a', glow: '#58ff7a', fire: '#35ff6c', fire2: '#d4ffdc', wglow: null, eyeCol: '#ff2b2b', aura: true,
  spr: true, sprHead: 'headA', scale: 1, cloak: true, m3d: true,
};

// Герой из сохранения: оружие, броня и заклинание влияют на цифры и внешний вид; уровень растёт от побед.
function heroCfg() {
  const d = Save.d, lv = Save.level(), A = ARMORS[d.eq.a] || ARMORS.knight;
  const wu = Gear.lv('w', d.eq.w), au = Gear.lv('a', d.eq.a);      // прокачка надетых оружия и брони
  return Object.assign({}, HERO, {
    weapon: d.eq.w, loadout: d.loadout.slice(), magic: d.eq.m, sprHead: A.head, cloak: A.cloak, scarf: !!A.scarf, horns: !!A.horns, scale: A.scale, hat: !!A.hat, ears: !!A.ears, tails: A.tails || 0,
    hp: 120 + A.hp + (lv - 1) * 6 + (au - 1) * 5, spd: A.spd, take: A.take / (1 + 0.08 * (au - 1)), dmg: (A.dmg || 1) * (1 + (lv - 1) * 0.04) * (1 + 0.1 * (wu - 1)),
  });
}

// ai: react = время реакции, block = шанс блока, cd = пауза между атаками, range = дистанция, aggr = агрессия, magic = кидает ли магию
const STAGES = [
  {
    title: 'Разбойник', bg: 'ruins', grade: [0, 0, 0, 0], reward: 120,
    cfg: { name: 'Разбойник', hp: 80, spd: 0.9, dmg: 0.8, weapon: 'blade', magic: 'spore', rim: '#e8a050', rim2: '#503010', eyeCol: '#fff0b0', spr: true, sprHead: 'headB', scale: 0.94 },
    ai: { react: 0.38, block: 0.15, cdMin: 0.9, cdMax: 1.7, range: 135, aggr: 0.5, magic: 0, jump: 0.04 },
  },
  {
    title: 'Монах', bg: 'ruins', grade: [200, 140, 40, 0.22], reward: 170,
    cfg: { name: 'Монах', hp: 95, spd: 0.95, dmg: 0.9, weapon: 'glaive', magic: 'spore', rim: '#ffd36b', rim2: '#503a10', eyeCol: '#ffe08a', spr: true, sprHead: 'headC', scale: 1, hat: true },
    ai: { react: 0.3, block: 0.3, cdMin: 0.8, cdMax: 1.5, range: 150, aggr: 0.55, magic: 0, jump: 0.05 },
  },
  {
    title: 'Громила', bg: 'ruins', grade: [40, 90, 200, 0.25], reward: 230,
    cfg: { name: 'Громила', hp: 135, spd: 0.85, dmg: 1.05, weapon: 'axe', magic: 'spore', rim: '#7fb0ff', rim2: '#102040', eyeCol: '#ff9a3a', spr: true, sprHead: 'headA', scale: 1.1, horns: true },
    ai: { react: 0.34, block: 0.25, cdMin: 0.8, cdMax: 1.4, range: 140, aggr: 0.65, magic: 0, jump: 0.02 },
  },
  {
    title: 'Убийца', bg: 'ruins', grade: [130, 40, 210, 0.3], reward: 300,
    cfg: { name: 'Убийца', hp: 105, spd: 1.2, dmg: 1, weapon: 'daggers', magic: 'blades', rim: '#b878ff', rim2: '#301060', eyeCol: '#d090ff', spr: true, sprHead: 'headC', scale: 1, scarf: true },
    ai: { react: 0.2, block: 0.45, cdMin: 0.55, cdMax: 1.1, range: 130, aggr: 0.7, magic: 1, jump: 0.1 },
  },
  {
    title: 'Титан', bg: 'lava', grade: [255, 70, 10, 0.4], reward: 420,
    cfg: { name: 'Титан', hp: 170, spd: 1, dmg: 1.1, weapon: 'scythe', magic: 'fire', rim: '#ff6a2a', rim2: '#401005', eyeCol: '#ffd02a', spr: true, sprHead: 'headB', scale: 1.14, horns: true },
    ai: { react: 0.18, block: 0.4, cdMin: 0.6, cdMax: 1.2, range: 150, aggr: 0.75, magic: 1, jump: 0.06 },
  },
];

// Зловещий Охотник — босс Локации I: элитный наёмник Тьмы, парные клинки, скорость не знает равных
const HUNTER = {
  title: 'Зловещий Охотник', bg: 'ruins', grade: [30, 110, 100, 0.3], reward: 600,
  cfg: { name: 'Зловещий Охотник', buffs: ['stone', 'wrath', 'regen'], hp: 330, spd: 1.38, dmg: 1.2, weapon: 'huntblades', magic: 'blades', rim: '#3affc8', rim2: '#08302a', eyeCol: '#eaffff', fire: '#2affc0', fire2: '#e0fff8', spr: true, sprHead: 'headC', scarf: true, scale: 1.02, portrait: 'hunter', breath: true },
  ai: { react: 0.1, block: 0.5, cdMin: 0.4, cdMax: 0.9, range: 120, aggr: 0.8, magic: 1, jump: 0.1 },
};

// Испытания (карта: ИСПЫТАНИЕ). mod: heroHp — фиксированное здоровье героя; time — лимит; foes — список бойцов
const TRIALS = [
  { name: 'Жажда крови', desc: 'Победи двух бойцов за 60 секунд.', reward: 350, time: 60, foes: [0, 3] },
  { name: 'Хрупкое стекло', desc: 'У тебя 40 здоровья. Враг — Громила.', reward: 450, time: 90, heroHp: 40, foes: [2] },
  { name: 'Тёмная ночь', desc: 'Убийца невидим, видны только глаза.', reward: 400, time: 80, foes: [3], dark: true },
  { name: 'Гнев титана', desc: 'Титан, и у тебя нет блока.', reward: 550, time: 90, foes: [4], noBlock: true },
];

// ---------------------------------------------------------------- телохранители и боссы
const RED = [255, 120, 160, 0.12];
const mk = (title, cfg, ai, reward, extra) => Object.assign({ title, bg: 'ruins', grade: [60, 100, 120, 0.3], reward, cfg: Object.assign({ name: title, spr: true, spd: 1, dmg: 1, magic: 'spore' }, cfg), ai }, extra || {});

// шесть телохранителей Охотника (Акт I «Вечный Мрак»); сам Охотник — седьмой
const GUARDS_HUNTER = [
  mk('Наёмник Тьмы', { hp: 170, spd: 1.1, dmg: 1.1, weapon: 'blade', rim: '#5affd8', rim2: '#082a24', eyeCol: '#d8fff6', sprHead: 'headB', scarf: true },
    { react: 0.24, block: 0.35, cdMin: 0.7, cdMax: 1.2, range: 130, aggr: 0.68, magic: 0, jump: 0.05 }, 180),
  mk('Призрачный клинок', { hp: 185, spd: 1.3, dmg: 1.1, weapon: 'daggers', magic: 'blades', rim: '#8affc8', rim2: '#082a20', eyeCol: '#c8ffe8', sprHead: 'headC', scarf: true, buffs: ['regen'] },
    { react: 0.18, block: 0.45, cdMin: 0.5, cdMax: 1.0, range: 125, aggr: 0.75, magic: 1, jump: 0.08 }, 230),
  mk('Чёрный палач', { hp: 260, spd: 0.95, dmg: 1.3, weapon: 'axe', magic: 'storm', rim: '#3aaaa0', rim2: '#06201e', eyeCol: '#ffe0a0', sprHead: 'headA', horns: true, scale: 1.12, buffs: ['stone'] },
    { react: 0.2, block: 0.4, cdMin: 0.6, cdMax: 1.1, range: 135, aggr: 0.72, magic: 1, jump: 0.03 }, 300),
  mk('Костяной жнец', { hp: 240, spd: 1.0, dmg: 1.25, weapon: 'scythe', magic: 'fire', rim: '#9ab8b0', rim2: '#0a1c18', eyeCol: '#f0ffe0', sprHead: 'headB', hat: true, scale: 1.08, buffs: ['regen'] },
    { react: 0.18, block: 0.4, cdMin: 0.6, cdMax: 1.1, range: 150, aggr: 0.74, magic: 1, jump: 0.04 }, 360),
  mk('Страж склепа', { hp: 300, spd: 0.9, dmg: 1.35, weapon: 'glaive', magic: 'storm', rim: '#4a8fff', rim2: '#081430', eyeCol: '#bfe4ff', sprHead: 'headA', horns: true, scale: 1.14, buffs: ['stone'] },
    { react: 0.16, block: 0.45, cdMin: 0.6, cdMax: 1.1, range: 155, aggr: 0.74, magic: 1, jump: 0.03 }, 420),
  mk('Герольд Мрака', { hp: 280, spd: 1.28, dmg: 1.3, weapon: 'katana', magic: 'blades', rim: '#c8ffe8', rim2: '#082018', eyeCol: '#ff5a5a', sprHead: 'headC', scarf: true, buffs: ['wrath'] },
    { react: 0.12, block: 0.5, cdMin: 0.45, cdMax: 0.95, range: 130, aggr: 0.8, magic: 1, jump: 0.08 }, 480),
];

// Scarlett — босс Локации II: девять хвостов, багровая катана, лисье пламя, умеет Дыхание
const SCARLETT = mk('Scarlett', { name: 'Scarlett', hp: 470, spd: 1.2, dmg: 1.32, weapon: 'crimson', magic: 'foxfire', rim: '#ff3a5a', rim2: '#400a14', eyeCol: '#ffe0e8',
  fire: '#ff3a2a', fire2: '#ffd8c0', sprHead: 'headC', ears: true, tails: 9, scale: 1.03, breath: true, portrait: 'fox', buffs: ['stone', 'regen', 'wrath', 'volley'] },
  { react: 0.12, block: 0.5, cdMin: 0.45, cdMax: 0.95, range: 140, aggr: 0.78, magic: 1, jump: 0.08 }, 1000, { grade: RED, blood: true });

// шесть стражей Scarlett (Акт II «Вечная Гроза»); сама Scarlett — седьмая
const GUARDS_SCARLETT = [
  mk('Алый клык', { hp: 210, spd: 1.32, dmg: 1.15, weapon: 'foxfang', rim: '#ff5a7a', rim2: '#400a14', eyeCol: '#ffd0e0', sprHead: 'headC', ears: true, tails: 2, scarf: true },
    { react: 0.18, block: 0.4, cdMin: 0.5, cdMax: 1.0, range: 120, aggr: 0.75, magic: 0, jump: 0.1 }, 280, { grade: RED, blood: true }),
  mk('Жрица красной луны', { hp: 230, spd: 1.08, dmg: 1.15, weapon: 'glaive', magic: 'foxfire', rim: '#ff7a9a', rim2: '#401020', eyeCol: '#ffe0f0', sprHead: 'headB', ears: true, tails: 3 },
    { react: 0.2, block: 0.4, cdMin: 0.7, cdMax: 1.2, range: 150, aggr: 0.65, magic: 1, jump: 0.05 }, 320, { grade: RED, blood: true }),
  mk('Рогатый палач', { hp: 330, spd: 0.9, dmg: 1.45, weapon: 'bloodaxe', rim: '#ff5a3a', rim2: '#401005', eyeCol: '#ffb02a', sprHead: 'headA', horns: true, scale: 1.16, buffs: ['stone'] },
    { react: 0.22, block: 0.35, cdMin: 0.7, cdMax: 1.2, range: 135, aggr: 0.72, magic: 0, jump: 0.02 }, 380, { grade: RED, blood: true }),
  mk('Тень Синкъэна', { hp: 280, spd: 1.3, dmg: 1.25, weapon: 'crimson', magic: 'comet', rim: '#d04aff', rim2: '#300a40', eyeCol: '#f0b0ff', sprHead: 'headC', scarf: true, ears: true, tails: 4, buffs: ['regen'] },
    { react: 0.15, block: 0.5, cdMin: 0.5, cdMax: 1.0, range: 130, aggr: 0.78, magic: 1, jump: 0.09 }, 450, { grade: RED, blood: true }),
  mk('Кровавая жница', { hp: 320, spd: 1.12, dmg: 1.35, weapon: 'scythe', magic: 'foxfire', rim: '#ff2a4a', rim2: '#3a0610', eyeCol: '#ffe0a0', sprHead: 'headB', ears: true, tails: 5, scale: 1.08, buffs: ['regen'] },
    { react: 0.14, block: 0.5, cdMin: 0.5, cdMax: 1.0, range: 150, aggr: 0.78, magic: 1, jump: 0.05 }, 520, { grade: RED, blood: true }),
  mk('Страж грозы', { hp: 380, spd: 1.0, dmg: 1.5, weapon: 'glaive', magic: 'storm', rim: '#7ac8ff', rim2: '#0a1c40', eyeCol: '#ffffff', sprHead: 'headA', horns: true, scale: 1.18, buffs: ['stone', 'regen'] },
    { react: 0.12, block: 0.5, cdMin: 0.5, cdMax: 1.0, range: 155, aggr: 0.8, magic: 1, jump: 0.04 }, 600, { grade: RED, blood: true }),
];

// Локация II: пятёрка бойцов покрепче, красная арена
const S2 = (title, cfg, ai, reward) => mk(title, Object.assign({ hp: 160 }, cfg), ai, reward, { grade: RED, blood: true });
const STAGES2 = [
  S2('Охотник на лис', { hp: 150, weapon: 'blade', rim: '#ff8a6a', rim2: '#401408', eyeCol: '#fff0b0', sprHead: 'headB', hat: true, dmg: 1.0 }, { react: 0.26, block: 0.3, cdMin: 0.7, cdMax: 1.3, range: 130, aggr: 0.6, magic: 0, jump: 0.05 }, 250),
  S2('Багровый монах', { hp: 175, weapon: 'glaive', magic: 'fire', rim: '#ff5a5a', rim2: '#401010', eyeCol: '#ffd0a0', sprHead: 'headC', hat: true, dmg: 1.1 }, { react: 0.22, block: 0.35, cdMin: 0.7, cdMax: 1.3, range: 150, aggr: 0.65, magic: 1, jump: 0.05 }, 320),
  S2('Кровавый громила', { hp: 230, weapon: 'axe', rim: '#ff3a3a', rim2: '#300808', eyeCol: '#ffb02a', sprHead: 'headA', horns: true, scale: 1.14, spd: 0.9, dmg: 1.3 }, { react: 0.22, block: 0.3, cdMin: 0.7, cdMax: 1.2, range: 140, aggr: 0.7, magic: 0, jump: 0.02 }, 400),
  S2('Лисья тень', { hp: 190, weapon: 'daggers', magic: 'blades', rim: '#ff7aff', rim2: '#300a30', eyeCol: '#ffd0ff', sprHead: 'headC', ears: true, tails: 3, scarf: true, spd: 1.3, dmg: 1.15 }, { react: 0.15, block: 0.5, cdMin: 0.5, cdMax: 1.0, range: 125, aggr: 0.75, magic: 1, jump: 0.1 }, 480),
  S2('Лорд пламени', { hp: 280, weapon: 'scythe', magic: 'comet', rim: '#ff6a2a', rim2: '#401005', eyeCol: '#ffe02a', sprHead: 'headB', horns: true, scale: 1.18, dmg: 1.35, buffs: ['stone'] }, { react: 0.14, block: 0.45, cdMin: 0.55, cdMax: 1.1, range: 150, aggr: 0.78, magic: 1, jump: 0.06 }, 650),
];
const TRIALS2 = [
  { name: 'Кровавая жатва', desc: 'Победи двух бойцов за 70 секунд.', reward: 700, time: 70, foes: [0, 3] },
  { name: 'Стеклянный клинок', desc: 'У тебя 50 здоровья. Враг — Кровавый громила.', reward: 850, time: 90, heroHp: 50, foes: [2] },
  { name: 'Красная ночь', desc: 'Лисья тень невидима, видны только глаза.', reward: 800, time: 80, foes: [3], dark: true },
  { name: 'Гнев лорда', desc: 'Лорд пламени, и у тебя нет блока.', reward: 1000, time: 100, foes: [4], noBlock: true },
];

// Описание локаций: набор бойцов, испытания, ключи сохранения, множитель наград
const LOCS = {
  1: { stages: STAGES, trials: TRIALS, tour: 'tour', trial: 'trial', best: 'bestSurv', gm: 1, boss: 'hunter' },
  2: { stages: STAGES2, trials: TRIALS2, tour: 'tour2', trial: 'trial2', best: 'bestSurv2', gm: 1.5, boss: 'scarlett' },
};
// «забеги» боссов: стражи подряд, затем сам босс
const GAUNTLET = {
  hunter: { loc: 1, guards: GUARDS_HUNTER, boss: HUNTER, name: 'ВЕЧНЫЙ МРАК' },
  scarlett: { loc: 2, guards: GUARDS_SCARLETT, boss: SCARLETT, name: 'ВЕЧНАЯ ГРОЗА' },
};
