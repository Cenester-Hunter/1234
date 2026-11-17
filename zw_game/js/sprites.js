'use strict';
// SpriteData — ГДЕ КАКАЯ ДЕТАЛЬ ЛЕЖИТ НА АРТ-ЛИСТЕ. Если какая-то деталь вырезана криво, правь цифры здесь.
//
// Все координаты — пиксели файла assets/atlas.png (он 1380x752 и совпадает с исходным арт-листом,
// только серый фон, сетка и подписи убраны).
//   sx, sy, sw, sh — вырезаемый прямоугольник (в режиме DEBUG он рисуется красной рамкой)
//   px, py         — pivot, то есть сустав, вокруг которого деталь вращается (жёлтая точка)
//   ex, ey         — дальний сустав (запястье, лодыжка, центр головы...): по расстоянию pivot -> end
//                    деталь растягивается под длину кости, чтобы суставы не расходились
//   k              — если задан, масштаб фиксирован (головы и плащ), иначе масштаб подгоняется под кость
// Включить отладку: добавь ?debug=1 к адресу, нажми B на клавиатуре или коснись экрана тремя пальцами.

const SpriteData = {
  // ---- Голова (HEAD). pivot = низ горжета на шее, end = центр шлема ----
  headA: { sx: 62, sy: 66, sw: 95, sh: 161, px: 110, py: 220, ex: 110, ey: 135, k: 0.34 },
  headB: { sx: 178, sy: 66, sw: 81, sh: 131, px: 219, py: 186, ex: 219, ey: 126, k: 0.36 },
  headC: { sx: 170, sy: 210, sw: 89, sh: 127, px: 214, py: 318, ex: 214, ey: 262, k: 0.36 },

  // ---- Торс (TORSO): нагрудник + пояс. pivot = таз (низ пояса), end = линия плеч ----
  torso: { sx: 338, sy: 137, sw: 124, sh: 199, px: 399, py: 320, ex: 399, ey: 150 },

  // ---- Рука (ARM). Одна рука с арт-листа разрезана по локтю: плечо+локоть и предплечье+кисть ----
  armUp: { sx: 758, sy: 71, sw: 101, sh: 134, px: 800, py: 105, ex: 822, ey: 195 },   // pivot = плечо
  armLo: { sx: 770, sy: 188, sw: 90, sh: 153, px: 822, py: 195, ex: 803, ey: 312 },   // pivot = локоть

  // ---- Ноги (LEGS). Каждая нога разрезана по колену: бедро и голень с сабатоном ----
  legAUp: { sx: 62, sy: 387, sw: 91, sh: 161, px: 108, py: 415, ex: 108, ey: 535 },   // pivot = бедро
  legALo: { sx: 62, sy: 525, sw: 91, sh: 174, px: 108, py: 535, ex: 108, ey: 668 },   // pivot = колено
  legBUp: { sx: 173, sy: 387, sw: 91, sh: 161, px: 219, py: 415, ex: 219, ey: 535 },
  legBLo: { sx: 173, sy: 525, sw: 91, sh: 174, px: 219, py: 535, ex: 219, ey: 668 },

  // ---- Меч (WEAPON). pivot = рукоять (то место, где его держит кулак), end = остриё ----
  sword: { sx: 884, sy: 87, sw: 107, sh: 379, px: 938, py: 150, ex: 938, ey: 462 },

  // ---- Плащ (CLOAK). pivot = верх у шеи ----
  cloak: { sx: 705, sy: 401, sw: 168, sh: 283, px: 789, py: 408, ex: 789, ey: 684, k: 0.36 },

  // ---- Эффекты (FX) ----
  fxBurst: { sx: 1167, sy: 488, sw: 151, sh: 174, px: 1242, py: 650, ex: 1242, ey: 488, k: 1 },
  fxCrescent: { sx: 1197, sy: 113, sw: 41, sh: 68, px: 1217, py: 147, ex: 1217, ey: 113, k: 1 },
};

// Детали окружения (assets/env_atlas.png, тоже 1380x752 как исходный лист).
const EnvData = {
  circle: { sx: 58, sy: 377, sw: 206, sh: 101 },
  colA: { sx: 632, sy: 64, sw: 56, sh: 151 },
  colB: { sx: 704, sy: 70, sw: 46, sh: 146 },
};

const Sprites = {
  atlas: null, env: null, bg: null, eyes: null, map: null, hunter: null, bg3: null, bg3m: null, komainu: null, avatar: null, map2: null, chapter: null, fox: null,
  ok: false, envOk: false, bgOk: false, eyesOk: false, mapOk: false, hunterOk: false, bg3Ok: false, bg3mOk: false, komainuOk: false, avatarOk: false, map2Ok: false, chapterOk: false, foxOk: false,

  // Картинки лежат в js/assets.js как data-URI (так холст остаётся «чистым» и шейдеры работают даже с file://).
  init() {
    const load = (src, cb) => { const i = new Image(); i.onload = cb; i.src = src; return i; };
    this.atlas = load(ASSET.atlas, () => { this.ok = true; });
    this.env = load(ASSET.env, () => { this.envOk = true; });
    this.bg = load(ASSET.bg, () => { this.bgOk = true; });
    this.eyes = load(ASSET.eyes, () => { this.eyesOk = true; });
    this.map = load(ASSET.map, () => { this.mapOk = true; });
    this.hunter = load(ASSET.hunter, () => { this.hunterOk = true; });
    this.bg3 = load(ASSET.bg3, () => { this.bg3Ok = true; });
    this.bg3m = load(ASSET.bg3m, () => { this.bg3mOk = true; });
    this.komainu = load(ASSET.komainu, () => { this.komainuOk = true; });
    this.avatar = load(ASSET.avatar, () => { this.avatarOk = true; });
    this.map2 = load(ASSET.map2, () => { this.map2Ok = true; });
    this.chapter = load(ASSET.chapter, () => { this.chapterOk = true; });
    this.fox = load(ASSET.fox, () => { this.foxOk = true; });
  },
};
