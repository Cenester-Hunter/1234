'use strict';
// Developer controls for local testing. The floating toggle stays available;
// progress changes affect this browser's save only.
(function () {
  const query = new URLSearchParams(location.search || '');
  const clampInt = (value, min, max, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };

  // Save, Items, Loadout and UI are top-level const bindings in the classic scripts,
  // not properties on window. Refer to the bindings directly.
  function gameReady() {
    return typeof Save !== 'undefined' && !!Save.d &&
      typeof Items !== 'undefined' && typeof Loadout !== 'undefined' && typeof UI !== 'undefined';
  }

  function setLevel(value) {
    if (!gameReady()) return;
    const level = clampInt(value, 1, 100, 1);
    Save.d.wins = (level - 1) * 3;
    Save.d.seenLv = level;
    Save.put();
  }

  function setGold(value) {
    if (!gameReady()) return;
    Save.d.gold = clampInt(value, 0, 999999999, 0);
    Save.put();
  }

  function setGearLevel(value) {
    if (!gameReady()) return;
    const level = clampInt(value, 1, 18, 1);
    for (const kind of ['w', 'a']) {
      for (const id of Save.d.owned[kind]) Save.d.up[kind + ':' + id] = level;
    }
    Save.put();
  }

  function unlockLocations() {
    if (!gameReady()) return;
    Save.d.hunter = 1;
    Save.d.wins = Math.max(Save.d.wins, 16 * 3); // Act II access (level 17)
    Save.d.seenLv = Math.max(Save.d.seenLv || 1, 17);
    Save.put();
    UI.loc = 2;
    UI.sel = 'scarlett';
    UI.panTo('scarlett');
    UI.pan2 = UI.pan2T;
    if (typeof G !== 'undefined') { G.state = 'map'; G.paused = false; }
  }

  function unlockAllItems() {
    if (!gameReady()) return;
    for (const kind of ['w', 'a', 'm']) {
      for (const id in Items.dbs[kind]) {
        if (!Save.d.owned[kind].includes(id)) Save.d.owned[kind].push(id);
      }
    }
    Save.d.hunter = 1;
    Save.d.wins = Math.max(Save.d.wins, 16 * 3);
    Save.d.seenLv = Math.max(Save.d.seenLv || 1, 17);
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
    style.textContent = `
      #zw-dev-toggle{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:1002;width:54px;height:54px;border:2px solid #9de9ff;border-radius:50%;background:#102331;color:#b8f1ff;font:700 24px Arial,sans-serif;box-shadow:0 4px 16px #000b;cursor:pointer;touch-action:manipulation}
      #zw-dev-panel{position:fixed;z-index:1003;right:16px;bottom:calc(82px + env(safe-area-inset-bottom));width:min(330px,calc(100vw - 32px));max-height:calc(100vh - 110px);overflow:auto;padding:12px;box-sizing:border-box;border:1px solid #536173;border-radius:12px;background:rgba(12,16,22,.97);color:#f4f7fb;font:14px Arial,sans-serif;box-shadow:0 12px 32px #000b;touch-action:auto}
      #zw-dev-panel[hidden]{display:none!important}
      #zw-dev-panel .zw-title{display:flex;justify-content:space-between;align-items:center;color:#8fe6ff;font-weight:700;letter-spacing:.08em;margin-bottom:10px}
      #zw-dev-panel .zw-row{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0}
      #zw-dev-panel label{display:block;color:#bbc6d3;font-size:12px;margin:8px 0 4px}
      #zw-dev-panel input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #475364;border-radius:7px;background:#1a2029;color:#fff;font-size:16px}
      #zw-dev-panel button{min-height:38px;padding:7px;border:1px solid #526174;border-radius:7px;background:#202936;color:#fff;font-weight:600;cursor:pointer;touch-action:manipulation}
      #zw-dev-panel button:active,#zw-dev-toggle:active{background:#34516b}
      #zw-dev-panel .zw-note{color:#99a7b5;font-size:11px;line-height:1.35;margin-top:8px}
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    if (document.getElementById('zw-dev-toggle')) return;
    addStyle();
    const toggle = document.createElement('button');
    toggle.id = 'zw-dev-toggle';
    toggle.type = 'button';
    toggle.textContent = '⚙';
    toggle.setAttribute('aria-label', 'Открыть меню разработчика');
    toggle.addEventListener('click', () => togglePanel());

    const panel = document.createElement('section');
    panel.id = 'zw-dev-panel';
    panel.setAttribute('aria-label', 'Меню разработчика');
    panel.hidden = true;
    panel.innerHTML = '<div class="zw-title"><span>DEV / ТЕСТ</span><button type="button" data-action="close" aria-label="Закрыть">✕</button></div>' +
      '<label for="zw-dev-level">Уровень (1–100)</label><div class="zw-row"><input id="zw-dev-level" type="number" min="1" max="100" value="17"><button type="button" data-action="level">Применить уровень</button></div>' +
      '<label for="zw-dev-gold">Монеты</label><div class="zw-row"><input id="zw-dev-gold" type="number" min="0" max="999999999" value="5000"><button type="button" data-action="gold">Установить монеты</button></div>' +
      '<label for="zw-dev-gear">Прокачка оружия/брони (1–18)</label><div class="zw-row"><input id="zw-dev-gear" type="number" min="1" max="18" value="18"><button type="button" data-action="gear">Применить прокачку</button></div>' +
      '<div class="zw-row"><button type="button" data-action="locations">Открыть Акты I и II</button><button type="button" data-action="items">Открыть всё оружие, магию и броню</button></div>' +
      '<div class="zw-row"><button type="button" data-action="save1">Слот 1</button><button type="button" data-action="save2">Слот 2</button><button type="button" data-action="save3">Слот 3</button></div>' +
      '<div class="zw-note">Изменения затрагивают только сохранение этой игры в браузере. Кнопка ⚙ остаётся на экране; ✕ закрывает панель.</div>';
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
      else if (action === 'save3') setSaveSlot(3);
    });
    document.body.append(toggle, panel);
  }

  function togglePanel(force) {
    createUI();
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

  if (!applyQuery()) {
    const wait = setInterval(() => { if (applyQuery()) clearInterval(wait); }, 100);
  }
  // Always make the floating launcher available; ?dev=1 opens the panel on load.
  createUI();
  if (query.get('dev') === '1' || query.get('menu') === '1') togglePanel(true);
})();
