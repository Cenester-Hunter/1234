'use strict';
// Экраны: заставка, карта режимов (из твоей картинки SF2), арсенал (оружие, броня, магия).
// Все кнопки регистрируются в UI.regs при отрисовке, нажатие ищет кнопку под пальцем.

// позиции значков на картинке карты Акта I (1135x789), пересчитываются под размер карты
const NODE_SRC = { duel: [410, 148], hunter: [935, 553], surv: [673, 327], trial: [115, 568], tour: [503, 640] };
const MAP_X = 20, MAP_Y = 46, MAP_W = 900;
const NODES = {};
for (const k in NODE_SRC) NODES[k] = { x: MAP_X + NODE_SRC[k][0] * MAP_W / 1135, y: MAP_Y + NODE_SRC[k][1] * MAP_W / 1135 };
const NODE_ORDER = ['tour', 'duel', 'hunter', 'surv', 'trial'];
// Акт II («Вечная Гроза»): вертикальная красная карта 896x1200 на всю ширину, листается пальцем вверх-вниз
const NODE_SRC2 = { duel: [365, 310], scarlett: [268, 598], surv: [572, 535], trial: [165, 935], tour: [452, 1030] };
const MAP2_W = 940, MAP2_K = MAP2_W / 896, MAP2_X = 20, MAP2_Y = 46, MAP2_VH = 670, MAP2_H = 1200 * MAP2_K;
const NODE_ORDER2 = ['tour', 'duel', 'scarlett', 'surv', 'trial'];

const UI = {
  regs: [], loc: 1, pop: null, gsel: { hunter: null, scarlett: null }, sel: 'hunter', pan2: 0, pan2T: 0, slideX: 0, slots: false, confirm: 0, tab: 0, row: 0, prev: null, prevKey: '', prevT: 0, msg: '', msgT: 0,

  reg(x, y, w, h, cb) { this.regs.push({ x, y, w, h, cb }); },
  tap(x, y) {
    for (let i = this.regs.length - 1; i >= 0; i--) {
      const r = this.regs[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.cb(); return true; }
    }
    return false;
  },

  wrap(c, text, x, y, maxW, lh, align) {
    const words = text.split(' '); let line = '';
    c.textAlign = align || 'left';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; } else line = t;
    }
    if (line) { c.fillText(line, x, y); y += lh; }
    return y;
  },

  // кнопка в стиле SF2: золотой свиток
  button(c, x, y, w, h, label, cb, o) {
    o = o || {};
    const on = o.on, dis = o.dis;
    c.save();
    const g = c.createLinearGradient(0, y, 0, y + h);
    if (dis) { g.addColorStop(0, '#6b6458'); g.addColorStop(1, '#443f36'); }
    else if (on) { g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#f1c453'); g.addColorStop(1, '#b57a1c'); }
    else { g.addColorStop(0, '#e9d8ac'); g.addColorStop(0.5, '#c9a867'); g.addColorStop(1, '#8c6a32'); }
    c.fillStyle = g; c.strokeStyle = '#2a1a0a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x + 14, y); c.lineTo(x + w - 14, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w - 14, y + h); c.lineTo(x + 14, y + h); c.lineTo(x, y + h / 2); c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = dis ? '#2a2a26' : '#2a1608'; c.font = 'bold ' + (o.size || 28) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, x + w / 2, y + h / 2 + 2);
    c.restore();
    if (cb) this.reg(x, y, w, h, cb);
  },

  panel(c, x, y, w, h) {
    c.save();
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#cdb68a'); g.addColorStop(0.5, '#e0cfa6'); g.addColorStop(1, '#b89a68');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.lineWidth = 6; c.strokeStyle = '#3a2814'; c.strokeRect(x, y, w, h);
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,230,160,0.6)'; c.strokeRect(x + 6, y + 6, w - 12, h - 12);
    c.restore();
  },

  topBar(c, G) {
    c.save();
    c.fillStyle = 'rgba(8,5,3,0.85)'; c.fillRect(0, 0, 1280, 44);
    c.font = 'bold 22px Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    // звезда уровня
    c.fillStyle = '#e8c868'; c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 16, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(540 + Math.cos(a) * r, 22 + Math.sin(a) * r); }
    c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.fillText(String(Save.level()), 564, 23);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(600, 18, 110, 9);
    c.fillStyle = '#f1c453'; c.fillRect(600, 18, 110 * ((Save.d.wins % 3) / 3), 9);
    // золото
    c.fillStyle = '#e8b830'; c.beginPath(); c.arc(790, 22, 14, 0, TAU); c.fill(); c.strokeStyle = '#6a4a08'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#fff'; c.fillText(String(Save.d.gold), 814, 23);
    c.fillStyle = '#9ad'; c.fillText('победы: ' + Save.d.wins, 900, 23); c.fillStyle = '#ffd25a'; c.fillText('снаряж. ур. ' + Gear.cur(), 1060, 23);
    c.restore();
  },

  // ---------------------------------------------------------------- заставка
  title(c, G) {
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, 1280, 720);
    const pulse = 1 + Math.sin(G.t * 3) * 0.02;
    c.save(); c.translate(330, 360); c.scale(pulse, pulse);
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(0, 0, 100, 0, 0, 300);
    gr.addColorStop(0, 'rgba(88,255,122,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 300, 0, TAU); c.fill(); c.restore();
    c.beginPath(); c.arc(0, 0, 190, 0, TAU); c.fillStyle = '#0a140d'; c.fill();
    c.save(); c.clip(); if (Sprites.avatarOk) c.drawImage(Sprites.avatar, -190, -190, 380, 380); c.restore();
    c.lineWidth = 8; c.strokeStyle = '#58ff7a'; c.beginPath(); c.arc(0, 0, 190, 0, TAU); c.stroke();
    c.restore();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = 'bold 84px Impact, "Arial Black", sans-serif'; c.lineWidth = 10; c.strokeStyle = '#000';
    c.strokeText('ZOMBIE', 590, 250); c.fillStyle = '#58ff7a'; c.fillText('ZOMBIE', 590, 250);
    c.strokeText('WARRIOR', 590, 335); c.fillStyle = '#fff'; c.fillText('WARRIOR', 590, 335);
    c.font = 'bold 26px Arial, sans-serif'; c.lineWidth = 5; c.fillStyle = '#ddd';
    const sub = 'v6 · Акт I «Вечный Мрак» · Акт II «Вечная Гроза»';
    c.strokeText(sub, 594, 380); c.fillText(sub, 594, 380);
    { const p = Save.peek(Save.slot); c.font = 'bold 20px Arial, sans-serif'; c.fillStyle = '#9fe8b0';
      const st = 'Слот ' + Save.slot + ' · Ур. ' + p.level + ' · победы ' + p.wins + ' · монеты ' + p.gold;
      c.strokeText(st, 594, 424); c.fillText(st, 594, 424); }
    if (Math.sin(G.t * 4) > -0.3 && !this.slots) {
      c.font = 'bold 40px Impact, "Arial Black", sans-serif'; c.fillStyle = '#ffd25a';
      c.strokeText('ТАПНИ, ЧТОБЫ НАЧАТЬ', 594, 470); c.fillText('ТАПНИ, ЧТОБЫ НАЧАТЬ', 594, 470);
    }
    c.font = '20px Arial, sans-serif'; c.fillStyle = '#b8c4b8';
    c.font = '18px Arial, sans-serif';
    ['A/D ходьба · W прыжок · S блок · J удар · K нога · L оружие · U магия',
      'ДЫХАНИЕ: два раза «вперёд» и держи (или H) — пока вдыхаешь, ты неуязвим', 'P пауза · M звук']
      .forEach((s, i) => c.fillText(s, 594, 530 + i * 28));
    this.button(c, 1060, 646, 200, 54, 'ПРОГРЕСС', () => { this.slots = true; this.confirm = 0; Sfx.play('ui'); }, { size: 24 });
    if (this.slots) this.drawSlots(c, G);
  },

  // ---------------------------------------------------------------- карта
  order() { return this.loc === 2 ? NODE_ORDER2 : NODE_ORDER; },
  // позиция узла на экране (Локация II зависит от прокрутки карты)
  node(id) {
    if (this.loc === 2) { const n = NODE_SRC2[id]; return { x: MAP2_X + n[0] * MAP2_K, y: MAP2_Y + n[1] * MAP2_K - this.pan2 }; }
    return NODES[id];
  },
  panTo(id) { if (this.loc === 2) this.pan2T = clamp(NODE_SRC2[id][1] * MAP2_K - MAP2_VH / 2, 0, MAP2_H - MAP2_VH); },
  // почему узел закрыт (строка) или null
  locked(id) {
    if (ACTLIST[id]) { const i = this.target(id); return Acts.lock(id, i); }
    return null;
  },
  // какого врага акта выбрано атаковать: выбранный тапом или первый непобеждённый
  target(act) { let i = this.gsel[act]; if (i == null || Acts.done(act, i)) i = this.gsel[act] = Acts.next(act); return i; },
  enemyName(act, i) { const A = GAUNTLET[act]; return i < 6 ? A.guards[i].title : A.boss.title; },
  nodeInfo(id) {
    const d = Save.d, L = LOCS[this.loc], i2 = this.loc === 2 ? ' II' : '';
    switch (id) {
      case 'tour': return { t: 'Турнир' + i2, line: 'Пять бойцов подряд. Бой ' + Math.min(5, (d[L.tour] || 0) + 1) + ' из 5.', rew: this.loc === 2 ? '250–650 монет за бой' : '120–420 монет за бой' };
      case 'duel': return { t: 'Дуэль' + i2, line: 'Один бой со случайным противником. Чем выше уровень — тем жёстче враг.', rew: this.loc === 2 ? '250–650 монет' : '100–260 монет' };
      case 'hunter': case 'scarlett': { const i = this.target(id), A = GAUNTLET[id], S = i < 6 ? A.guards[i] : A.boss, r = Acts.req(id, i);
        const g = 1 + BAL.goldPerTier * (r[1] - 1);
        return { t: 'Акт ' + ACTLIST[id].num + ' · ' + ACTLIST[id].title, act: id, line: S.title + ' — ' + (i < 6 ? 'страж ' + (i + 1) + ' из 6' : 'главный босс') + '. Нужно: уровень ' + r[0] + ', снаряжение ' + r[1] + '.',
          rew: '≈' + Math.round(S.reward * g) + ' монет' + (i === 6 && !d[id] ? ' + бонус и добыча босса' : ''), hunter: id === 'hunter' && i === 6, fox: id === 'scarlett' && i === 6 }; }
      case 'surv': return { t: 'Выживание' + i2, line: 'Волны врагов без передышки. Каждая волна сильнее. Рекорд: волна ' + (d[L.best] || 0) + '.', rew: Math.round(45 * L.gm) + ' монет за волну' };
      case 'trial': { const T = L.trials[(d[L.trial] || 0) % L.trials.length]; return { t: 'Испытание' + i2, line: T.name + ': ' + T.desc, rew: T.reward + ' монет' }; }
    }
  },

  // окно «новый уровень»: что открылось
  checkLevel() {
    const d = Save.d, lv = Save.level();
    if (this.pop || lv <= d.seenLv) return;
    const items = [], notes = [];
    for (let l = d.seenLv + 1; l <= lv; l++) {
      items.push(...Items.at(l));
      for (const act in ACTLIST) { const A = ACTLIST[act];
        if (act === 'scarlett' && l === ACT2_MIN && d.hunter) notes.push('Акт II «Вечная Гроза» открыт!');
        A.req.forEach((r, i) => { if (r[0] === l && !(act === 'scarlett' && l === ACT2_MIN)) notes.push(this.enemyName(act, i) + ': уровень есть, нужно снаряжение ' + r[1]); }); }
    }
    notes.splice(5); this.pop = { lv, items, notes }; Sfx.play('win');
  },
  drawPop(c) {
    const P = this.pop; if (!P) return;
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0, 0, 1280, 720);
    const h = 190 + (P.items.length + P.notes.length) * 30; const y = 360 - h / 2;
    this.panel(c, 380, y, 520, h);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#1a0f06'; c.font = 'bold 40px Impact, "Arial Black", sans-serif';
    c.fillText('УРОВЕНЬ ' + P.lv + '!', 640, y + 64);
    c.font = 'bold 20px Arial, sans-serif'; c.fillStyle = '#5a3a08'; c.fillText(P.items.length ? 'Открыто в арсенале:' : 'Ты стал сильнее: +здоровье, +урон', 640, y + 98);
    c.font = 'bold 22px Arial, sans-serif'; c.fillStyle = '#1a5a2a';
    P.items.forEach((n, i) => c.fillText('✦ ' + n, 640, y + 130 + i * 30));
    c.fillStyle = '#8a1a1a';
    P.notes.forEach((n, i) => c.fillText(n, 640, y + 130 + (P.items.length + i) * 30));
    this.button(c, 540, y + h - 70, 200, 52, 'ОК', null, { on: true, size: 28 });
    this.reg(0, 0, 1280, 720, () => { Save.d.seenLv = P.lv; Save.put(); this.pop = null; Sfx.play('ui'); });
  },

  chapter(c, G) {
    c.fillStyle = '#000'; c.fillRect(0, 0, 1280, 720);
    if (Sprites.chapterOk) c.drawImage(Sprites.chapter, 0, 72, 1280, 576);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = 'bold 30px Impact, "Arial Black", sans-serif'; c.lineWidth = 6; c.strokeStyle = '#000';
    c.fillStyle = 'rgba(255,210,90,' + (0.7 + 0.3 * Math.sin(G.t * 4)) + ')';
    const t = 'АКТ II · ВЕЧНАЯ ГРОЗА';
    c.strokeText(t, 640, 52); c.fillText(t, 640, 52);
    c.font = '18px Arial, sans-serif'; c.fillStyle = '#aaa'; c.fillText('Акт II откроется с уровня ' + ACT2_MIN + ': шесть стражей и только потом — Scarlett (ур. 18)', 640, 690);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.12 * Math.sin(G.t * 5); c.fillStyle = '#ff4a4a';
    c.fillRect(822, 588, 205, 36); c.restore();
    this.reg(790, 566, 260, 76, () => this.chapterGo());
  },
  chapterGo() { Sfx.play('ui'); this.loc = 2; this.sel = 'scarlett'; this.pan2 = this.pan2T = 0; this.panTo('scarlett'); this.pan2 = this.pan2T; toMap(); },

  map(c, G) {
    this.checkLevel();
    if (this.loc === 2 && !Acts.unlocked('scarlett')) this.loc = 1;
    if (!this.order().includes(this.sel)) { this.sel = this.loc === 2 ? 'scarlett' : 'hunter'; this.panTo(this.sel); }
    const dt = 1 / 60;
    this.pan2 += (this.pan2T - this.pan2) * Math.min(1, dt * 9);
    this.slideX *= Math.pow(0.0008, dt);      // плавный «взмах» между локациями
    if (Math.abs(this.slideX) < 0.5) this.slideX = 0;
    c.fillStyle = this.loc === 2 ? '#12060a' : '#0b0705'; c.fillRect(0, 0, 1280, 720);
    c.save(); c.beginPath(); c.rect(0, 46, 970, 674); c.clip(); c.translate(this.slideX, 0);
    if (this.loc === 2) {
      if (Sprites.map2Ok) c.drawImage(Sprites.map2, MAP2_X, MAP2_Y - this.pan2, MAP2_W, MAP2_H);
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,120,150,0.5)'; c.strokeRect(MAP2_X + 3, MAP2_Y + 3, MAP2_W - 6, MAP2_VH - 6);
    } else {
      const mh = MAP_W * 789 / 1135;
      if (Sprites.mapOk) c.drawImage(Sprites.map, MAP_X, MAP_Y, MAP_W, mh);
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,225,150,0.5)'; c.strokeRect(MAP_X + 3, MAP_Y + 3, MAP_W - 6, mh - 6);
    }
    const rad = this.loc === 2 ? 62 : 66;
    for (const id of this.order()) {
      const n = this.node(id), sel = id === this.sel, lk = this.locked(id);
      if (n.y < 30 || n.y > 740) continue;
      if (sel) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const r = rad + 8 + Math.sin(G.t * 4) * 5, gr = c.createRadialGradient(n.x, n.y, rad * 0.6, n.x, n.y, r);
        const col = this.loc === 2 ? '255,90,130' : '90,255,230';
        gr.addColorStop(0, 'rgba(' + col + ',0.0)'); gr.addColorStop(0.7, 'rgba(' + col + ',0.5)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        c.fillStyle = gr; c.beginPath(); c.arc(n.x, n.y, r, 0, TAU); c.fill();
        c.lineWidth = 3; c.strokeStyle = 'rgba(' + col + ',0.9)'; c.beginPath(); c.arc(n.x, n.y, rad - 2, 0, TAU); c.stroke(); c.restore();
      }
      if (lk && lk !== 'Повержен') {   // замок: затемнение и плашка с требованием
        const r = ACTLIST[id] ? Acts.req(id, this.target(id)) : null;
        c.save(); c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.arc(n.x, n.y, rad - 6, 0, TAU); c.fill();
        c.fillStyle = '#e8c868'; c.fillRect(n.x - 12, n.y - 2, 24, 18); c.strokeStyle = '#e8c868'; c.lineWidth = 4; c.beginPath(); c.arc(n.x, n.y - 3, 8, Math.PI, 0); c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(n.x - 46, n.y + 22, 92, 22);
        c.fillStyle = '#ffd25a'; c.font = 'bold 14px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(r ? 'УР.' + r[0] + ' · СН.' + r[1] : '', n.x, n.y + 33); c.restore();
      } else if (lk === 'Повержен') { c.save(); c.fillStyle = '#58ff7a'; c.font = 'bold 40px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✔', n.x, n.y); c.restore(); }
      this.reg(n.x - rad, n.y - rad, rad * 2, rad * 2, () => { if (this.sel === id) this.go(); else { this.sel = id; this.panTo(id); Sfx.play('ui'); } });
    }
    c.restore();
    // правая панель
    const info = this.nodeInfo(this.sel), lk = this.locked(this.sel);
    this.panel(c, 985, 46, 280, 600);
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#1a0f06'; c.textAlign = 'center'; c.font = 'bold 36px Impact, "Arial Black", sans-serif'; { const w0 = c.measureText(info.t.toUpperCase()).width; if (w0 > 250) c.font = 'bold ' + Math.floor(36 * 250 / w0) + 'px Impact, "Arial Black", sans-serif'; } c.fillText(info.t.toUpperCase(), 1125, 100);
    if (info.act) {      // лестница акта: 6 стражей и босс
      const act = info.act, sel = this.target(act);
      c.font = 'bold 15px Arial, sans-serif'; c.fillStyle = '#6a3a08'; c.fillText('Победи 6 стражей, затем босса', 1125, 120);
      for (let i = 0; i < 7; i++) {
        const y = 130 + i * 38, dn = Acts.done(act, i), r = Acts.req(act, i), here = i === sel, bad = !dn && Acts.lock(act, i);
        c.fillStyle = here ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.07)'; c.fillRect(996, y, 258, 34);
        if (here) { c.lineWidth = 2; c.strokeStyle = '#7a4a10'; c.strokeRect(996, y, 258, 34); }
        c.textAlign = 'left'; c.font = 'bold 16px Arial, sans-serif'; c.fillStyle = dn ? '#1a7a2a' : bad ? '#7a6a58' : '#1a0f06';
        const nm = this.enemyName(act, i); c.fillText((dn ? '✔ ' : i === 6 ? '★ ' : (i + 1) + '. ') + (nm.length > 17 ? nm.slice(0, 16) + '…' : nm), 1004, y + 15);
        c.font = '13px Arial, sans-serif'; c.fillStyle = dn ? '#1a7a2a' : bad ? '#9a1a1a' : '#5a3a08'; c.fillText(dn ? 'повержен' : 'ур.' + r[0] + ' · снаряж.' + r[1], 1004, y + 29);
        this.reg(996, y, 258, 34, () => { this.gsel[act] = i; Sfx.play('ui'); });
      }
      c.textAlign = 'center';
    } else {
      c.save(); c.beginPath(); c.arc(1125, 186, 70, 0, TAU); c.fillStyle = '#10100f'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#3a2814'; c.stroke(); c.clip();
      const ST = LOCS[this.loc].stages, d = Save.d;
      const st = this.sel === 'tour' ? ST[Math.min(4, d[LOCS[this.loc].tour] || 0)] : this.sel === 'surv' ? ST[4] : this.sel === 'trial' ? ST[3] : ST[2];
      if (Sprites.ok) c.drawImage(Render.portrait(st.cfg.sprHead, st.cfg.eyeCol), 1070, 131, 110, 110);
      c.restore();
    }
    c.fillStyle = '#1a0f06'; c.font = info.act ? 'bold 15px Arial, sans-serif' : 'bold 20px Arial, sans-serif';
    if (info.act) { this.wrap(c, info.line, 1125, 420, 248, 19, 'center'); c.font = 'bold 15px Arial, sans-serif'; c.fillStyle = '#6a3a08'; this.wrap(c, 'Награда: ' + info.rew, 1125, 486, 248, 18, 'center'); }
    else { this.wrap(c, info.line, 1125, 292, 248, 25, 'center'); c.font = 'bold 17px Arial, sans-serif'; c.fillStyle = '#6a3a08'; this.wrap(c, 'Награда: ' + info.rew, 1125, 478, 248, 22, 'center'); }
    if (lk && lk !== 'Повержен') { c.fillStyle = '#9a1a1a'; c.font = 'bold ' + (lk.length > 24 ? 15 : 19) + 'px Arial, sans-serif'; c.textAlign = 'center'; this.wrap(c, lk, 1125, 524, 250, 19, 'center'); }
    const boss = info.act && this.target(info.act) === 6;
    this.button(c, 1010, 556, 230, 70, lk === 'Повержен' ? 'ПОВЕРЖЕН' : lk ? 'ЗАКРЫТО' : boss ? 'ВСТРЕЧА С БОССОМ' : info.act ? 'ДРАТЬСЯ' : 'В БОЙ!', () => this.go(), { on: !lk, dis: !!lk, size: (boss || info.act) && !lk ? 20 : 34 });
    // нижние кнопки
    this.button(c, 985, 660, 130, 48, 'АРСЕНАЛ', () => this.openArsenal(), { size: 19 });
    this.button(c, 1120, 660, 70, 48, Sfx.on ? '♪' : '✕', () => { Sfx.on = !Sfx.on; }, { size: 22 });
    this.button(c, 1195, 660, 70, 48, '←', () => { G.state = 'title'; }, { size: 24 });
    this.topBar(c, G);
    // название локации и точки-страницы: переключение взмахом пальца влево/вправо
    const has2 = Acts.unlocked('scarlett');
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = 'bold 19px Arial, sans-serif'; c.lineWidth = 4; c.strokeStyle = '#000';
    const nm = this.loc === 2 ? 'АКТ II · ВЕЧНАЯ ГРОЗА' : 'АКТ I · ВЕЧНЫЙ МРАК';
    c.fillStyle = this.loc === 2 ? '#ff8aa8' : '#8affd8'; c.strokeText(nm, 20, 23); c.fillText(nm, 20, 23);
    for (let i = 0; i < 2; i++) { c.fillStyle = i + 1 === this.loc ? '#ffd25a' : (i === 1 && !has2 ? '#444' : 'rgba(255,255,255,0.45)'); c.beginPath(); c.arc(330 + i * 22, 23, 6, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = '15px Arial, sans-serif';
    c.fillText(this.loc === 1 ? (has2 ? 'свайп влево →' : 'Акт II с ур. ' + ACT2_MIN) : ('← свайп · карта ↕' + ((Save.d.loop2 || 0) ? ' · круг ' + ((Save.d.loop2 || 0) + 1) : '')), 372, 23);
    c.fillStyle = '#c9b88a'; c.font = '15px Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('Тап по значку, потом «В БОЙ!». Свайп ← → меняет локацию.', 24, 706);
    if (this.msgT > 0) { this.msgT -= 1 / 60; c.textAlign = 'center'; c.fillStyle = '#ffd25a'; c.font = 'bold 24px Arial, sans-serif'; c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeText(this.msg, 640, 80); c.fillText(this.msg, 640, 80); }
    this.drawPop(c);
  },

  setLoc(n, byKey) {
    if (n === this.loc) return;
    if (n === 2 && !Acts.unlocked('scarlett')) { this.msg = !Save.d.hunter ? 'Победи Зловещего Охотника — откроется Акт II' : 'Для Акта II нужен уровень ' + ACT2_MIN + ' (у тебя ' + Save.level() + ')'; this.msgT = 2.5; Sfx.play('block'); this.slideX = -40; return; }
    this.slideX = n > this.loc ? 520 : -520;
    this.loc = n; this.sel = n === 2 ? 'scarlett' : 'hunter'; this.pan2 = 0; this.panTo(this.sel); this.pan2 = this.pan2T; Sfx.play('ui');
  },
  // жесты на карте и в арсенале
  swipe(dx, dy) {
    if (this.pop || G.state !== 'map' && G.state !== 'arsenal') return;
    if (G.state === 'map') this.setLoc(dx < 0 ? 2 : 1);
    else { this.tab = clamp(this.tab + (dx < 0 ? 1 : -1), 0, 2); this.row = 0; this.prevKey = ''; Sfx.play('ui'); }
  },
  drag(dx, dy) {          // листание карты Локации II (палец вниз — карта вниз)
    if (G.state === 'map' && this.loc === 2) { this.pan2T = clamp(this.pan2T - dy, 0, MAP2_H - MAP2_VH); this.pan2 = this.pan2T; }
  },

  go() {
    const lk = this.locked(this.sel);
    if (lk) { Sfx.play('block'); return; }
    Sfx.play('ui'); G.begin(this.sel, ACTLIST[this.sel] ? this.target(this.sel) : undefined);
  },

  // ---------------------------------------------------------------- слоты прогресса (окно на заставке)
  drawSlots(c, G) {
    c.fillStyle = 'rgba(0,0,0,0.78)'; c.fillRect(0, 0, 1280, 720);
    this.reg(0, 0, 1280, 720, () => { this.slots = false; this.confirm = 0; });
    this.panel(c, 330, 90, 620, 540);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#1a0f06'; c.font = 'bold 38px Impact, "Arial Black", sans-serif';
    c.fillText('ПРОГРЕСС', 640, 148);
    c.font = '17px Arial, sans-serif'; c.fillStyle = '#5a3a08'; c.fillText('Выбери слот или начни новую игру. Слоты не мешают друг другу.', 640, 176);
    this.reg(330, 90, 620, 540, () => {});
    for (let n = 1; n <= Save.SLOTS; n++) {
      const y = 200 + (n - 1) * 124, p = Save.peek(n), act = n === Save.slot;
      c.fillStyle = act ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.08)'; c.fillRect(354, y, 572, 108);
      c.lineWidth = act ? 4 : 2; c.strokeStyle = act ? '#7a4a10' : '#a58a55'; c.strokeRect(354, y, 572, 108);
      c.textAlign = 'left'; c.fillStyle = '#1a0f06'; c.font = 'bold 26px Arial, sans-serif'; c.fillText('Слот ' + n + (act ? '  · играешь' : ''), 372, y + 36);
      c.font = '18px Arial, sans-serif'; c.fillStyle = '#3a2a16';
      c.fillText(p ? 'Уровень ' + p.level + ' · победы ' + p.wins + ' · монеты ' + p.gold : 'Пусто — начнёшь с нуля', 372, y + 64);
      if (p) { c.fillStyle = '#6a3a08'; c.fillText('Акт I: стражи ' + p.guards1 + '/6' + (p.hunter ? ' · Охотник повержен' : '') + ' · Акт II: ' + p.guards2 + '/6' + (p.scarlett ? ' · Scarlett повержена' : ''), 372, y + 90); }
      this.button(c, 700, y + 14, 105, 40, act ? 'ИГРАЕШЬ' : p ? 'ВЫБРАТЬ' : 'НОВЫЙ', () => { if (!act) { Save.use(n); this.afterSlot(); } this.slots = false; Sfx.play('ui'); }, { size: 15, on: !act, dis: act });
      if (p) {
        const cf = this.confirm === n;
        this.button(c, 815, y + 14, 105, 40, cf ? 'ТОЧНО?' : 'СБРОС', () => {
          if (cf) { Save.reset(n); this.confirm = 0; if (act) this.afterSlot(); Sfx.play('block'); } else { this.confirm = n; Sfx.play('ui'); }
        }, { size: 15, on: cf });
      }
    }
    this.button(c, 540, 580, 200, 40, 'ЗАКРЫТЬ', () => { this.slots = false; this.confirm = 0; }, { size: 18 });
  },
  afterSlot() { this.gsel = { hunter: null, scarlett: null }; this.loc = 1; this.sel = 'hunter'; this.pop = null; this.pan2 = this.pan2T = 0; this.confirm = 0; },

  // ---------------------------------------------------------------- арсенал
  lists() {
    return [
      { name: 'ОРУЖИЕ', db: WEAPONS, k: 'w' },
      { name: 'БРОНЯ', db: ARMORS, k: 'a' },
      { name: 'МАГИЯ', db: MAGICS, k: 'm' },
    ];
  },

  openArsenal() { Sfx.play('ui'); G.state = 'arsenal'; this.tab = 0; this.row = 0; this.prevKey = ''; },

  cur() {
    const L = this.lists()[this.tab], ids = Object.keys(L.db);
    this.row = clamp(this.row, 0, ids.length - 1);
    return { L, ids, id: ids[this.row] };
  },

  act() {
    const { L, id } = this.cur(), d = Save.d, it = L.db[id];
    const lk = Items.lock(L.k, id);
    if (d.owned[L.k].includes(id)) { d.eq[L.k] = id; if (L.k === 'w') Loadout.equip(id); Sfx.play('ui'); this.msg = 'Надето: ' + it.name; }
    else if (lk) { this.msg = 'Закрыто: ' + this.lockText(it); Sfx.play('block'); }
    else if (d.gold >= it.price) { d.gold -= it.price; d.owned[L.k].push(id); d.eq[L.k] = id; if (L.k === 'w') Loadout.equip(id); Sfx.play('buy'); this.msg = 'Куплено: ' + it.name; }
    else { this.msg = 'Не хватает монет: нужно ' + it.price; Sfx.play('block'); }
    this.msgT = 2; Save.put(); this.prevKey = '';
  },

  upgrade() {
    const { L, id } = this.cur();
    if (Gear.up(L.k, id)) { Sfx.play('buy'); this.msg = 'Прокачка ' + L.db[id].name + ': ур. ' + Gear.lv(L.k, id); Save.put(); this.prevKey = ''; }
    else { Sfx.play('block'); this.msg = 'Не хватает монет или максимум'; }
    this.msgT = 2;
  },

  lockText(it) {
    if (it.boss) return 'выпадает с босса (' + BOSSNAME[it.boss] + ')';
    const r = [];
    if (it.need) r.push('победа над Зловещим Охотником');
    if ((it.lvl || 1) > Save.level()) r.push('уровень ' + it.lvl);
    return r.join(' и ');
  },

  stats(L, it) {
    if (L.k === 'm' && it.cost > 200) return [];
    if (L.k === 'w') return [['Урон', it.dmg], ['Скорость', it.spd], ['Дальность', it.len / 100]];
    if (L.k === 'a') return [['Получаемый урон', it.take], ['Скорость', it.spd], ['Здоровье', (120 + (it.hp || 0)) / 120], ['Урон', it.dmg || 1]];
    return [['Расход энергии', it.cost / 30]];
  },

  arsenal(c, G) {
    const bg = c.createLinearGradient(0, 0, 0, 720); bg.addColorStop(0, '#17100a'); bg.addColorStop(1, '#070504');
    c.fillStyle = bg; c.fillRect(0, 0, 1280, 720);
    const { L, ids, id } = this.cur(), d = Save.d;
    // вкладки
    this.lists().forEach((t, i) => this.button(c, 30 + i * 200, 58, 190, 54, t.name, () => { this.tab = i; this.row = 0; this.prevKey = ''; Sfx.play('ui'); }, { on: i === this.tab, size: 24 }));
    // список предметов
    this.panel(c, 30, 124, 580, 560);
    ids.forEach((k, i) => {
      const it = L.db[k], step = Math.min(88, Math.floor(536 / ids.length)), y = 140 + i * step, owned = d.owned[L.k].includes(k), eq = d.eq[L.k] === k, sel = i === this.row, lk = Items.lock(L.k, k), rh = step - 8, ty = rh > 70 ? 34 : Math.round(rh * 0.5), dy = rh > 70 ? 62 : Math.round(rh * 0.88);
      c.globalAlpha = lk ? 0.68 : 1;
      c.fillStyle = sel ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.07)'; c.fillRect(44, y, 552, rh);
      if (sel) { c.lineWidth = 3; c.strokeStyle = '#7a4a10'; c.strokeRect(44, y, 552, rh); }
      c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = '#1a0f06'; c.font = 'bold 24px Arial, sans-serif'; c.fillText(it.name, 60, y + ty);
      c.font = '16px Arial, sans-serif'; c.fillStyle = '#3a2a16'; c.fillText(lk ? 'Закрыто: ' + this.lockText(it) : it.desc.length > 62 ? it.desc.slice(0, 60) + '…' : it.desc, 60, y + dy);
      c.textAlign = 'right'; c.font = 'bold 22px Arial, sans-serif';
      c.fillStyle = eq ? '#1a7a2a' : owned ? '#2a4a8a' : '#8a5a08'; c.fillText(eq ? 'НАДЕТО' : owned ? 'ЕСТЬ' : lk ? lk : it.price + ' ●', 584, y + ty); c.globalAlpha = 1;
      this.reg(44, y, 552, rh, () => { this.row = i; this.prevKey = ''; Sfx.play('ui'); });
    });
    // слоты оружия (1..4): тяжёлое занимает два; закрытый слот покупается нажатием
    if (L.k === 'w') {
      const cells = []; for (const w of d.loadout) { const n = Loadout.cost(w); for (let q = 0; q < n; q++) cells.push({ w, q, n }); }
      for (let i = 0; i < SLOT_MAX; i++) {
        const x = 650 + i * 62, y = 130, cell = i < d.slots ? cells[i] : null, locked = i >= d.slots;
        c.fillStyle = locked ? 'rgba(0,0,0,0.35)' : cell ? (cell.w === d.eq.w ? 'rgba(120,255,140,0.35)' : 'rgba(255,255,255,0.22)') : 'rgba(255,255,255,0.08)';
        c.fillRect(x, y, 56, 44); c.lineWidth = 2; c.strokeStyle = cell && cell.w === d.eq.w ? '#7dff9a' : '#c9b48a'; c.strokeRect(x, y, 56, 44);
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.font = 'bold 13px Arial, sans-serif';
        const lab = cell ? WEAPONS[cell.w].name.replace(/[«»]/g, '').split(' ').slice(-1)[0].slice(0, 7) + (cell.n === 2 ? (cell.q ? ' ▸' : ' ◂') : '') : locked ? (i + 1 === d.slots + 1 ? SLOT_PRICE[i + 1] + '●' : '🔒') : 'пусто';
        c.fillText(lab, x + 28, y + 22); c.textBaseline = 'alphabetic';
        if (locked) this.reg(x, y, 56, 44, () => { if (i === d.slots) { this.msg = Loadout.buy(); this.msgT = 2; Save.put(); this.prevKey = ''; } else { this.msg = 'Сначала купи предыдущий слот'; this.msgT = 2; Sfx.play('block'); } });
      }
      const inL = d.loadout.includes(id), ownedW = d.owned.w.includes(id);
      this.button(c, 905, 130, 170, 44, inL ? 'ИЗ СЛОТОВ' : 'В СЛОТЫ', () => { this.msg = Loadout.toggle(id); this.msgT = 2; Save.put(); this.prevKey = ''; Sfx.play('ui'); }, { size: 17, dis: !ownedW, on: ownedW && !inL });
      c.textAlign = 'left'; c.fillStyle = '#d8c9a8'; c.font = '13px Arial, sans-serif'; c.fillText('Смена в бою: клавиша E или кнопка СМЕНА. Тяжёлое занимает 2 слота.', 650, 192);
    }
    // правая часть: превью бойца
    const it = L.db[id], owned = d.owned[L.k].includes(id), eq = d.eq[L.k] === id;
    this.preview(c, G);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = 'bold 32px Impact, "Arial Black", sans-serif'; c.lineWidth = 6; c.strokeStyle = '#000';
    c.strokeText(it.name, 950, 112); c.fillText(it.name, 950, 112);
    // характеристики
    c.textAlign = 'left'; c.font = 'bold 18px Arial, sans-serif';
    this.stats(L, it).forEach(([n, v], i) => {
      const y = 250 + i * 40; c.fillStyle = '#ddd'; c.font = 'bold 16px Arial, sans-serif'; c.fillText(n, 1000, y - 16);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(1000, y - 10, 190, 12);
      c.fillStyle = v > 1.001 ? '#6adf6a' : v < 0.999 ? '#e86a5a' : '#c9c9c9'; c.fillRect(1000, y - 10, 190 * clamp(v / 1.6, 0.05, 1), 12);
      c.fillStyle = '#ddd'; c.fillText('×' + v.toFixed(2), 1198, y + 1);
    });
    c.fillStyle = '#b9b9b9'; c.font = '16px Arial, sans-serif'; this.wrap(c, it.desc, 660, 612, 580, 20, 'left');
    const lk0 = Items.lock(L.k, id);
    if (L.k !== 'm' && owned) {
      const gl = Gear.lv(L.k, id), nx = gl + 1, can = nx <= GEAR_MAX && d.gold >= Gear.cost(nx);
      c.textAlign = 'left'; c.fillStyle = '#ffd25a'; c.font = 'bold 20px Arial, sans-serif'; c.fillText('Прокачка: ур. ' + gl + ' / ' + GEAR_MAX, 1000, 410);
      c.fillStyle = '#ccc'; c.font = '14px Arial, sans-serif';
      c.fillText(L.k === 'w' ? 'урон ×' + (1 + 0.1 * (gl - 1)).toFixed(2) : 'броня −' + Math.round((1 - 1 / (1 + 0.08 * (gl - 1))) * 100) + '% урона, +' + 5 * (gl - 1) + ' здоровья', 1000, 432);
      this.button(c, 990, 446, 270, 52, nx > GEAR_MAX ? 'МАКС. УРОВЕНЬ' : 'УЛУЧШИТЬ → ' + nx + ' (' + Gear.cost(nx) + ')', () => this.upgrade(), { on: can, dis: !can, size: 20 });
    }
    this.button(c, 960, 642, 290, 60, eq ? 'НАДЕТО' : owned ? 'НАДЕТЬ' : lk0 ? 'ЗАКРЫТО: ' + lk0 : 'КУПИТЬ ' + it.price, () => this.act(), { on: !eq && !lk0, dis: eq || !!lk0, size: lk0 ? 22 : 28 });
    this.button(c, 690, 642, 250, 60, 'НА КАРТУ', () => { G.state = 'map'; Sfx.play('ui'); }, { size: 24 });
    if (this.msgT > 0) { this.msgT -= 1 / 60; c.textAlign = 'center'; c.fillStyle = '#ffd25a'; c.font = 'bold 24px Arial, sans-serif'; c.fillText(this.msg, 950, 222); }
    this.topBar(c, G);
  },

  // живое превью героя с выбранным предметом (периодически делает удар)
  preview(c, G) {
    const { L, id } = this.cur(), key = this.tab + id + JSON.stringify(Save.d.eq);
    if (key !== this.prevKey || !this.prev) {
      this.prevKey = key;
      const eq = Object.assign({}, Save.d.eq); eq[L.k] = id;
      const old = Save.d.eq; Save.d.eq = eq; const cfg = heroCfg(); Save.d.eq = old;
      this.prev = new Fighter(cfg, 0, 1, true); this.prev.noRefl = false; this.prevT = 0; this.prevFoe = { x: 900, state: 'idle', hp: 1, y: 0 };
    }
    const F = this.prev; this.prevT += 1 / 60;
    const I = Object.assign({}, NOINPUT);
    if (this.prevT > 2.2) { this.prevT = 0; I[this.tab === 2 ? 'magic' : 'slash'] = 1; F.en = 100; }
    F.update(1 / 60, I, this.prevFoe, G);
    // сцена: свет за спиной
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(800, 400, 20, 800, 400, 260); gr.addColorStop(0, 'rgba(120,200,255,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(640, 120, 600, 520); c.restore();
    c.save(); c.beginPath(); c.rect(640, 124, 620, 520); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(640, 556, 620, 90);
    c.translate(800, 560); c.scale(1.4, 1.4);
    Render.fighter(c, F, G.t);
    G.fx.draw(c);
    c.restore();
    G.fx.update(1 / 60);
  },

  key(code) {
    if (G.state === 'map') {
      if (this.pop) { Save.d.seenLv = this.pop.lv; Save.put(); this.pop = null; return true; }
      const O = this.order(), i = O.indexOf(this.sel);
      if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') { this.sel = O[(i + 1) % 5]; this.panTo(this.sel); Sfx.play('ui'); return true; }
      if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') { this.sel = O[(i + 4) % 5]; this.panTo(this.sel); Sfx.play('ui'); return true; }
      if (code === 'KeyL') { this.setLoc(this.loc === 1 ? 2 : 1); return true; }
      if (code === 'Enter' || code === 'Space') { this.go(); return true; }
      if (code === 'KeyE') { this.openArsenal(); return true; }
      if (code === 'Escape') { G.state = 'title'; return true; }
    } else if (G.state === 'title') {
      if (this.slots && (code === 'Escape' || code === 'Enter')) { this.slots = false; return true; }
    } else if (G.state === 'chapter') {
      if (code === 'Enter' || code === 'Space') { this.chapterGo(); return true; }
    } else if (G.state === 'arsenal') {
      if (code === 'ArrowDown' || code === 'KeyS') { this.row++; this.prevKey = ''; return true; }
      if (code === 'ArrowUp' || code === 'KeyW') { this.row--; this.prevKey = ''; return true; }
      if (code === 'ArrowRight' || code === 'KeyD') { this.tab = (this.tab + 1) % 3; this.row = 0; this.prevKey = ''; return true; }
      if (code === 'ArrowLeft' || code === 'KeyA') { this.tab = (this.tab + 2) % 3; this.row = 0; this.prevKey = ''; return true; }
      if (code === 'Enter' || code === 'Space') { this.act(); return true; }
      if (code === 'Escape' || code === 'KeyE') { G.state = 'map'; return true; }
    }
    return false;
  },
};
