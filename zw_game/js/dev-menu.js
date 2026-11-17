'use strict';
// Optional local developer helpers. Enabled only with ?dev=1 / ?menu=1 or the ~ key.
(function () {
  const query = new URLSearchParams(location.search);
  const clampInt = (value, min, max, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };

  function gameReady() {
    return window.Save && Save.d && window.Items && window.Loadout && window.UI;
  }

  function setLevel(level) {
    if (!gameReady()) return;
    const value = clampInt(level, 1, 100, 1);
    Save.d.wins = (value - 1) * 3;
    Save.d.seenLv = value;
    Save.put();
  }

  function setGold(amount) {
    if (!gameReady()) return;
    Save.d.gold = clampInt(amount, 0, 999999999, 0);
    Save.put();
  }

  function setGearLevel(level) {
    if (!gameReady()) return;
    const value = clampInt(level, 1, 18, 1);
    for (const kind of ['w', 'a']) {
      for (const id of Save.d.owned[kind]) Save.d.up[kind + ':' + id] = value;
    }
    Save.put();
  }

  function unlockLocations() {
    if (!gameReady()) return;
    Save.d.hunter = 1;
    Save.d.wins = Math.max(Save.d.wins, (17 - 1) * 3);
    Save.d.seenLv = Math.max(Save.d.seenLv || 1, 17);
    Save.put();
    UI.loc = 2;
    UI.sel = 'scarlett';
    UI.panTo('scarlett');
    UI.pan2 = UI.pan2T;
  }

  function unlockAllItems() {
    if (!gameReady()) return;
    for (const kind of ['w', 'a', 'm']) {
      for (const id in Items.dbs[kind]) {
        if (!Save.d.owned[kind].includes(id)) Save.d.owned[kind].push(id);
      }
    }
    Save.d.hunter = 1;
    Save.d.wins = Math.max(Save.d.wins, (17 - 1) * 3);
    Save.d.gold = Math.max(Save.d.gold, 999999);
    for (const kind of ['w', 'a']) {
      for (const id of Save.d.owned[kind]) Save.d.up[kind + ':' + id] = 18;
    }
    Loadout.fix();
    Save.put();
  }

  function setSaveSlot(slot) {
    if (!gameReady()) return;
    Save.use(clampInt(slot, 1, Save.SLOTS || 3, 1));
    if (UI.afterSlot) UI.afterSlot();
  }

  function applyQuery() {
    if (!gameReady()) return false;
    // Keep the existing game's legacy test parameters working; cap requested level to 100.
    if (query.has('lvl')) setLevel(query.get('lvl'));
    if (query.has('gold')) setGold(query.get('gold'));
    if (query.has('gear')) setGearLevel(query.get('gear'));
    if (query.get('hunter') === '1') Save.d.hunter = 1;
    if (query.get('scarlett') === '1') Save.d.scarlett = 1;
    if (query.get('all') === '1') unlockAllItems();
    Save.put();
    return true;
  }

  function addStyle() {
    if (document.getElementById('zw-dev-style')) return;
    const style = document.createElement('style');
    style.id = 'zw-dev-style';
    style.textContent = '#zw-dev-panel{position:fixed;z-index:1001;right:12px;top:12px;width:min(310px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:12px;box-sizing:border-box;border:1px solid #536173;border-radius:12px;background:rgba(12,16,22,.96);color:#f4f7fb;font:14px Arial,sans-serif;box-shadow:0 12px 32px #0009}#zw-dev-panel[hidden]{display:none!important}#zw-dev-panel .zw-title{display:flex;justify-content:space-between;align-items:center;color:#8fe6ff;font-weight:700;letter-spacing:.08em;margin-bottom:10px}#zw-dev-panel .zw-row{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0}#zw-dev-panel label{display:block;color:#bbc6d3;font-size:12px;margin:8px 0 4px}#zw-dev-panel input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #475364;border-radius:7px;background:#1a2029;color:#fff;font-size:16px}#zw-dev-panel button{min-height:38px;padding:7px;border:1px solid #526174;border-radius:7px;background:#202936;color:#fff;font-weight:600;cursor:pointer}#zw-dev-panel button:active{background:#34516b}#zw-dev-panel .zw-note{color:#99a7b5;font-size:11px;line-height:1.35;margin-top:8px}';
    document.head.appendChild(style);
  }

  function makePanel() {
    if (document.getElementById('zw-dev-panel')) return;
    addStyle();
    const panel = document.createElement('section');
    panel.id = 'zw-dev-panel';
    panel.setAttribute('aria-label', 'Developer tools');
    panel.hidden = true;
    panel.innerHTML = '<div class="zw-title"><span>DEV / ТЕСТ</span><button type="button" data-action="close" aria-label="Закрыть">×</button></div>' +
      '<label for="zw-dev-level">Уровень (1–100)</label><div class="zw-row"><input id="zw-dev-level" type="number" min="1" max="100" value="17"><button type="button" data-action="level">Применить уровень</button></div>' +
      '<label for="zw-dev-gold">Монеты</label><div class="zw-row"><input id="zw-dev-gold" type="number" min="0" max="999999999" value="5000"><button type="button" data-action="gold">Установить монеты</button></div>' +
      '<label for="zw-dev-gear">Уровень оружия/брони (1–18)</label><div class="zw-row"><input id="zw-dev-gear" type="number" min="1" max="18" value="18"><button type="button" data-action="gear">Применить снаряжение</button></div>' +
      '<div class="zw-row"><button type="button" data-action="locations">Открыть Акты I и II</button><button type="button" data-action="items">Открыть оружие, магию и броню</button></div>' +
      '<div class="zw-row"><button type="button" data-action="save1">Слот 1</button><button type="button" data-action="save2">Слот 2</button></div>' +
      '<div class="zw-note">Инструменты меняют только сохранение в этом браузере. Панель открывается клавишей ~ или параметром ?dev=1. На телефоне используйте ссылку с ?dev=1.</div>';
    panel.addEventListener('click', event => {
      const action = event.target && event.target.dataset && event.target.dataset.action;
      if (!action) return;
      if (action === 'close') panel.hidden = true;
      else if (action === 'level') setLevel(document.getElementById('zw-dev-level').value);
      else if (action === 'gold') setGold(document.getElementById('zw-dev-gold').value);
      else if (action === 'gear') setGearLevel(document.getElementById('zw-dev-gear').value);
      else if (action === 'locations') unlockLocations();
      else if (action === 'items') unlockAllItems();
      else if (action === 'save1') setSaveSlot(1);
      else if (action === 'save2') setSaveSlot(2);
    });
    document.body.appendChild(panel);
  }

  function togglePanel(force) {
    makePanel();
    const panel = document.getElementById('zw-dev-panel');
    panel.hidden = force == null ? !panel.hidden : !force;
  }

  window.__zwDev = { applyQuery, setLevel, setGold, setGearLevel, unlockLocations, unlockAllItems, togglePanel };
  window.addEventListener('keydown', event => {
    if (event.key === '`' || event.key === '~') {
      togglePanel();
      event.preventDefault();
    }
  });

  // game.js has synchronously loaded and initialized the save before this file runs.
  if (!applyQuery()) {
    const wait = setInterval(() => { if (applyQuery()) clearInterval(wait); }, 100);
  }
  if (query.get('dev') === '1' || query.get('menu') === '1') togglePanel(true);
})();
