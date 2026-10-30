"""python3 door_sheet.py <out.png> <scale> <npz>...: pieces side by side on a dark ground, each over its tile's
diamond, at `scale` (2: as the game draws the 1x art)."""
import sys

import numpy as np
from PIL import Image, ImageDraw

out, S, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = []
for f in files:
    z = np.load(f)
    r, (ax, ay) = z["rgba"].astype(float), z["a"]
    pad = 24
    h, w = r.shape[:2]
    c = np.zeros((h + 2 * pad, w + 2 * pad, 3))
    c[:] = (14, 16, 20)
    im = Image.fromarray(c.astype("uint8"))
    cx, cy = ax + pad, ay + pad
    ImageDraw.Draw(im).polygon([(cx, cy - 16), (cx + 32, cy), (cx, cy + 16), (cx - 32, cy)], fill=(40, 46, 54))
    c = np.asarray(im).astype(float)
    a = r[..., 3:4] / 255
    c[pad:pad + h, pad:pad + w] = c[pad:pad + h, pad:pad + w] * (1 - a) + r[..., :3] * a
    ims.append(Image.fromarray(c.astype("uint8")))
H = max(i.height for i in ims)
W = sum(i.width + 4 for i in ims)
sheet = Image.new("RGB", (W, H), (14, 16, 20))
x = 0
for i in ims:
    sheet.paste(i, (x, H - i.height))
    x += i.width + 4
sheet.resize((W * S, H * S), Image.NEAREST).save(out)
