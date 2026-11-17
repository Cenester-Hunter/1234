'use strict';
// СКЕЛЕТ. Иерархия костей (родитель -> ребёнок):
//
//   root (таз)
//    ├─ torso (торс)
//    │    ├─ neck -> head          (голова)
//    │    ├─ uaF -> faF -> wep     (передняя рука, меч — ребёнок предплечья)
//    │    └─ uaB -> faB            (задняя рука)
//    ├─ thF -> shF                 (передняя нога: бедро -> голень)
//    └─ thB -> shB                 (задняя нога)
//
// Каждая кость хранит: угол относительно родителя (local), длину (len), мировой угол (wang),
// начало (x,y) и конец (ex,ey). Угол 0 = кость смотрит вниз, плюс = вперёд по взгляду бойца.
// Боец всегда считается «лицом вправо», зеркалится уже при выводе в мир (см. Fighter.computeWorld).
// Тот же скелет используют и физика попаданий, и отрисовка спрайтов — расхождений быть не может.

// Длины костей в игровых единицах (подогнаны под арт-лист: spriteLen * 0.36).
const BONE = { torso: 60, neck: 10, head: 19, ua: 33, fa: 42, th: 43, sh: 48, foot: 11, wep: 78 };

const KEYS = ['dx', 'lean', 'neck', 'aF', 'eF', 'aB', 'eB', 'tF', 'kF', 'tB', 'kB', 'w', 'rot'];

// боевая стойка
const BASE = { dx: 0, lean: 10, neck: 0, aF: 38, eF: 78, aB: 14, eB: 95, tF: 22, kF: -26, tB: -16, kB: 14, w: -55, rot: 0 };

const P = o => Object.assign({}, BASE, o);

function mixPose(a, b, u, out) {
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * u;
  return out;
}

class Bone {
  constructor(name, len, off, parent) {
    this.name = name; this.len = len; this.off = off; this.local = 0; this.parent = parent || null;
    this.kids = [];
    if (parent) parent.kids.push(this);
    this.wang = 0; this.x = 0; this.y = 0; this.ex = 0; this.ey = 0;
  }

  update() {
    const p = this.parent;
    this.wang = (p ? p.wang : 0) + this.off + this.local;
    if (p) { this.x = p.ex; this.y = p.ey; }
    this.ex = this.x + Math.sin(this.wang) * this.len;
    this.ey = this.y + Math.cos(this.wang) * this.len;
    for (const k of this.kids) k.update();
  }
}

class Skeleton {
  constructor() {
    const root = this.root = new Bone('root', 0, 0, null);
    const torso = this.torso = new Bone('torso', BONE.torso, Math.PI, root);
    const neck = this.neck = new Bone('neck', BONE.neck, 0, torso);
    this.head = new Bone('head', BONE.head, 0, neck);
    this.uaF = new Bone('uaF', BONE.ua, Math.PI, torso);
    this.faF = new Bone('faF', BONE.fa, 0, this.uaF);
    this.wep = new Bone('wep', BONE.wep, 0, this.faF);          // меч — ребёнок передней руки
    this.uaB = new Bone('uaB', BONE.ua, Math.PI, torso);
    this.faB = new Bone('faB', BONE.fa, 0, this.uaB);
    this.thF = new Bone('thF', BONE.th, 0, root);
    this.shF = new Bone('shF', BONE.sh, 0, this.thF);
    this.thB = new Bone('thB', BONE.th, 0, root);
    this.shB = new Bone('shB', BONE.sh, 0, this.thB);
    this.gy = 0;
  }

  // Применяет позу (углы в градусах) и пересчитывает все кости. gy = на сколько самая нижняя точка ниже таза.
  apply(p, wepLen) {
    const r = DEG;
    this.root.x = p.dx; this.root.y = 0; this.root.local = -p.rot * r;   // поворот всего тела (падение)
    this.torso.local = -p.lean * r;
    this.neck.local = p.neck * r;
    this.uaF.local = p.aF * r; this.faF.local = p.eF * r; this.wep.local = p.w * r; this.wep.len = wepLen;
    this.uaB.local = p.aB * r; this.faB.local = p.eB * r;
    this.thF.local = p.tF * r; this.shF.local = p.kF * r;
    this.thB.local = p.tB * r; this.shB.local = p.kB * r;
    this.root.update();

    // нижняя точка тела: ею боец стоит на земле
    let gy = Math.max(this.shF.ey, this.shB.ey) + BONE.foot;
    for (const n of ['faF', 'faB', 'uaF', 'uaB', 'thF', 'thB']) gy = Math.max(gy, this[n].ey);
    gy = Math.max(gy, this.head.ey + 15, this.root.ey + 9, this.torso.ey + 9);
    this.gy = gy;
    return this;
  }
}
