#!/usr/bin/env python3
"""build_assets.py - готовит картинки v3 и собирает js/assets.js (всё в data-URI, чтобы шейдеры работали и с file://).
  python3 -I build_assets.py ПАПКА_ИГРЫ ПАПКА_С_ИСХОДНИКАМИ(map_src.jpg)
Из исходников берёт: assets/atlas.png, env_atlas.png, bg_ruins.jpg, avatar_round.png, sheet_original.jpg."""
import base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

game, src = sys.argv[1], sys.argv[2]
A = os.path.join(game, 'assets')
sheet = np.array(Image.open(os.path.join(A, 'sheet_original.jpg')).convert('RGB')).astype(np.float32)

HEADS = {'headA': (62, 66, 157, 227), 'headB': (178, 66, 259, 197), 'headC': (170, 210, 259, 337)}
H, W, _ = sheet.shape
eyes = np.zeros((H, W, 4), np.uint8)
info = {}
for name, (x0, y0, x1, y1) in HEADS.items():
    c = sheet[y0:y1, x0:x1]
    red = c[..., 0] - np.maximum(c[..., 1], c[..., 2])
    a = np.clip((red - 55) / 90.0, 0, 1)
    a = ndi.gaussian_filter(a, 0.8) * 1.6
    a = np.clip(a, 0, 1)
    lab, n = ndi.label(a > 0.3)
    cents = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) >= 6:
            cents.append([round(x0 + float(xs.mean()), 1), round(y0 + float(ys.mean()), 1), int(len(xs))])
    cents.sort(key=lambda t: -t[2])
    info[name] = cents[:2]
    eyes[y0:y1, x0:x1, :3] = 255
    eyes[y0:y1, x0:x1, 3] = (a * 255).astype(np.uint8)
if not info['headC']:   # в шлеме C глаза не светятся ярко: щели визора найдены вручную по сетке
    info['headC'] = [[224.0, 272.0, 40], [246.0, 273.0, 30]]
Image.fromarray(eyes, 'RGBA').save(os.path.join(A, 'eyes.png'), optimize=True)
print('eyes', json.dumps(info))

# карта режимов: центральная часть присланной картинки (без подписи CENTRAL MAP SECTION), 2.4x с резкостью
m = Image.open(os.path.join(src, 'map_src.jpg')).convert('RGB')
crop = m.crop((254, 66, 727, 395))
big = crop.resize((int(crop.width * 2.4), int(crop.height * 2.4)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.2, percent=90, threshold=2))
big.save(os.path.join(A, 'map.jpg'), quality=88, optimize=True)
print('map', crop.size, '->', big.size)

# силуэт Отшельника с правой панели: тёмное -> непрозрачное, пергамент -> прозрачный
h = m.crop((780, 86, 900, 192))
ha = np.array(h).astype(np.float32)
lum = ha.mean(axis=2)
al = np.clip((105 - lum) / 45.0, 0, 1)
lab, n = ndi.label(al > 0.5)
ar = ndi.sum(al > 0.5, lab, range(1, n + 1))
keep = [i + 1 for i, v in enumerate(ar) if v >= 0.2 * ar.max()]
al = al * np.isin(lab, keep)
out = np.zeros(al.shape + (4,), np.uint8); out[..., :3] = 6; out[..., 3] = (ndi.gaussian_filter(al, 0.6) * 255).astype(np.uint8)
hh = Image.fromarray(out, 'RGBA'); hh = hh.resize((hh.width * 3, hh.height * 3), Image.LANCZOS)
hh.save(os.path.join(A, 'hermit.png'), optimize=True)
print('hermit', hh.size)

av = Image.open(os.path.join(A, 'avatar_round.png')).convert('RGBA').resize((256, 256), Image.LANCZOS)
av.save(os.path.join(A, 'avatar_256.png'), optimize=True)

def uri(fn, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(os.path.join(A, fn), 'rb').read()).decode())

files = {'atlas': ('atlas.png', 'image/png'), 'env': ('env_atlas.png', 'image/png'), 'bg': ('bg_ruins.jpg', 'image/jpeg'),
         'avatar': ('avatar_256.png', 'image/png'), 'eyes': ('eyes.png', 'image/png'), 'map': ('map.jpg', 'image/jpeg'),
         'hermit': ('hermit.png', 'image/png')}
js = "'use strict';\n// Сгенерировано tools/build_assets.py: картинки как data-URI, чтобы canvas не считался «чужим» (нужно для шейдеров при открытии файла напрямую).\nconst ASSET = {\n"
for k, (fn, mime) in files.items():
    js += "  %s: '%s',\n" % (k, uri(fn, mime))
js += "};\nconst EYE_INFO = %s;\n" % json.dumps(info)
open(os.path.join(game, 'js', 'assets.js'), 'w').write(js)
print('assets.js', os.path.getsize(os.path.join(game, 'js', 'assets.js')) // 1024, 'КБ')
