ZOMBIE WARRIOR — единый скелет и набор анимаций (без модели, без кожи)

Что внутри
  viewer.html       — открой в браузере (работает и с телефона): кнопки Рука / Нога / Меч / Локоть / Вертушка / Разворот+нога /
                      Получил удар / Смерть / Прыжок / Бег / Джог. Клавиши 1-9,0,h,d. Показывает фазы удара (РАЗМАХ / УДАР / ВОЗВРАТ).
  skeleton.json     — один скелет: 27 костей (Mixamo-тело без пальцев + HeadTop, HandEnd, ToeEnd), ед. измерения см, +Y вверх, лицом к +Z, левая сторона +X.
  clips/*.json      — 12 анимаций, 30 к/с: локальные кватернионы (x,y,z,w) на кость + root (смещение Hips). Одни и те же кости во всех клипах.
  actions.json      — какая кнопка какой клип запускает, плюс тайминги ударов (кадры РАЗМАХ / УДАР / ВОЗВРАТ, какая кость бьёт, досягаемость).
  ZW_skeleton.glb   — тот же скелет и все анимации одним файлом (без меша), открывается в Blender и других редакторах.
  tools/            — скрипты, которыми всё собрано из FBX.

Клипы и источники
  idle (синтез: стойка из «меч+щит» + дыхание), run (Sword And Shield Run), jog (Jog In Circle), jump (Sword And Shield Jump),
  attack_punch (Punching), attack_elbow (Illegal Elbow Punch), attack_kick (Mma Kick), attack_sword (Sword And Shield Attack),
  attack_spin (Chapa Giratória), attack_turnkick (Rifle Turn And Kick), hit_uppercut (Receive Uppercut To The Face), die (Dying).
  Оружие крепится к правой кисти: направление RightHand → RightHandEnd (см. skeleton.json → sockets).

Чего нет в наборе (нужно докачать с Mixamo): блок, вставание после падения, победная поза, удар в спину.
Тайминги ударов в actions.json посчитаны автоматически по движению конечности и годятся как стартовые; их можно править руками.
Проверка: расчёт позы по нашим кватернионам совпадает с исходными FBX (разница меньше 0.01 см).


=== Обновление v2: +5 новых клипов (итого 17) ===
  attack_sword2 (Sword And Shield Attack — вариант с прыжком/сальто), attack_slash (Sword And Shield Slash — быстрый рубящий),
  attack_greatsword (Great Sword Slash — тяжёлый удар двуручным), cast_magic (Standing 2H Magic Attack 01 — дальняя магия),
  smoking (Smoking — спокойная стойка с дыханием; кадры ~330-420: рука к лицу — используется как «лечение»).
  Тайминги новых ударов — в actions.json (strikes).
