import json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

src = np.array(Image.open('sheet.jpg').convert('RGB')).astype(np.float32)
H, W, _ = src.shape
atlas = np.zeros((H, W, 4), np.uint8)

# имя: (x0,y0,x1,y1, режим)  режим: border = фон только снаружи, all = любой серый - фон, green = свечение
PARTS = {
  'headA':  (58, 62, 160, 232, 'border'),
  'headB':  (176, 62, 262, 200, 'border'),
  'headC':  (168, 205, 262, 337, 'border'),
  'torso':  (338, 134, 462, 336, 'border'),
  'arm':    (755, 68, 862, 347, 'border'),
  'legA':   (60, 384, 156, 702, 'border'),
  'legB':   (170, 384, 266, 702, 'border'),
  'cloak':  (703, 396, 876, 690, 'all'),
  'sword':  (884, 86, 992, 468, 'all'),
  'fxCrescent': (1196, 112, 1248, 192, 'green'),
  'fxBurst':    (1148, 462, 1330, 662, 'green'),
}

def clean(box, mode):
    x0, y0, x1, y1 = box
    c = src[y0:y1, x0:x1]
    h, w, _ = c.shape
    if mode == 'green':
        g = c[..., 1] - (c[..., 0] + c[..., 2]) / 2
        a = np.clip((g - 14) / 60.0, 0, 1)
        a = ndi.gaussian_filter(a, 0.6)
        out = np.zeros((h, w, 4), np.uint8)
        # убираем серую подложку из цвета: делаем цвет ярче там, где есть свечение
        col = np.clip((c - (1 - a[..., None]) * 150) / np.maximum(a[..., None], 0.25), 0, 255)
        out[..., :3] = col.astype(np.uint8); out[..., 3] = (a * 255).astype(np.uint8)
        return out
    border = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
    bgc = np.median(src[300:420, 1000:1040].reshape(-1, 3), axis=0) if mode == 'all' and box[0] == 884 else np.median(border, axis=0)
    diff = np.abs(c - bgc).max(axis=2)
    sat = c.max(axis=2) - c.min(axis=2)
    cand = (diff < 34) & (sat < 26)
    if mode == 'border':
        lab, n = ndi.label(cand)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(edge))
    else:
        bg = cand
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)                 # убирает тонкие линии сетки
    lab, n = ndi.label(fg)
    if n == 0: return np.zeros((h, w, 4), np.uint8)
    areas = ndi.sum(fg, lab, range(1, n + 1))
    keep = [i + 1 for i, a in enumerate(areas) if a >= 0.12 * areas.max()]   # подписи и мусор отпадают
    fg = np.isin(lab, keep)
    fg = ndi.binary_fill_holes(fg) if mode == 'border' else fg
    fg = ndi.binary_erosion(fg, iterations=1)                 # срезаем серую кайму
    a = ndi.gaussian_filter(fg.astype(np.float32), 0.7)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(c, 0, 255).astype(np.uint8)
    out[..., 3] = (a * 255).astype(np.uint8)
    return out

rects = {}
for name, (x0, y0, x1, y1, mode) in PARTS.items():
    o = clean((x0, y0, x1, y1), mode)
    atlas[y0:y1, x0:x1] = np.maximum(atlas[y0:y1, x0:x1], o) if False else o
    ys, xs = np.where(o[..., 3] > 20)
    rects[name] = [int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max() + 1), int(y0 + ys.max() + 1)]
    print(name, 'tight', rects[name])

Image.fromarray(atlas, 'RGBA').save('atlas.png', optimize=True)
json.dump(rects, open('rects.json', 'w'))
# контрольный просмотр на тёмной шашке
prev = Image.new('RGBA', (W, H), (70, 70, 90, 255))
prev.alpha_composite(Image.fromarray(atlas, 'RGBA'))
prev.convert('RGB').save('atlas_preview.png')
