"""python3 showpieces.py <out.png> <npz>...: pieces side by side on magenta, 4x, each with its tile's diamond outline."""
import sys
import numpy as np
from PIL import Image, ImageDraw
ims = []
for f in sys.argv[2:]:
    z = np.load(f)
    r, (ax, ay) = z["rgba"].astype(float), z["a"]
    pad = 40
    h, w = r.shape[:2]
    c = np.zeros((h + 2 * pad, w + 2 * pad, 3)); c[:] = (255, 0, 255)
    a = r[..., 3:4] / 255
    c[pad:pad + h, pad:pad + w] = c[pad:pad + h, pad:pad + w] * (1 - a) + r[..., :3] * a
    im = Image.fromarray(c.astype("uint8"))
    d = ImageDraw.Draw(im)
    cx, cy = ax + pad, ay + pad
    d.polygon([(cx, cy - 16), (cx + 32, cy), (cx, cy + 16), (cx - 32, cy)], outline=(255, 255, 0))
    ims.append(im)
H = max(i.height for i in ims); W = sum(i.width + 4 for i in ims)
out = Image.new("RGB", (W, H), (0, 0, 0)); x = 0
for i in ims:
    out.paste(i, (x, 0)); x += i.width + 4
out.resize((W * 4, H * 4), Image.NEAREST).save(sys.argv[1])
