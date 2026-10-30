"""python3 doors_mock.py <out.png> <scale> <npz dir>: jobs_doors' designs, one row each: a wall run along x with the
door in its middle (closed, open), then one along y (closed, open), on the floor, drawn as the game draws them."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

DESIGNS = ("navy", "rose", "split")     # (doors3d.DESIGNS; it needs Blender)

out, S, src = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])
TW, TH = 64, 32
VW, VH = 4 * TW + 24, 4 * TH + 110          # one vignette: 3 x 3 tiles
LW = 70                                     # the row labels


def load(n):
    z = np.load(src / f"{n}.npz")
    return z["rgba"].astype(np.float32), z["a"]


def vignette(axis, door):
    img = np.zeros((VH, VW, 3), np.float32)
    img[:] = (14, 16, 20)
    ox, oy = VW // 2, 108

    def paste(n, x, y):
        rgba, a = load(n)
        cx, cy = ox + (x - y) * TW // 2, oy + (x + y) * TH // 2
        x0, y0 = int(cx - a[0]), int(cy - a[1])
        h, w = rgba.shape[:2]
        al = rgba[..., 3:4] / 255.0
        img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - al) + rgba[..., :3] * al
    for s in range(-1, 5):                           # back to front (a row behind the wall: the doorway shows it)
        for x in range(-1, 3):
            y = s - x
            if -1 <= y < 3 and (x >= 0 if axis == "x" else y >= 0):
                paste("tile.floor.a", x, y)
    walls = [(i, 0) for i in range(3)] if axis == "x" else [(0, i) for i in range(3)]
    for x, y in sorted(walls, key=lambda t: t[0] + t[1]):
        paste(door if (x, y) == walls[1] else f"wall.m{10 if axis == 'x' else 5}", x, y)
    return img


cols = [("x", ""), ("x", ".open"), ("y", ""), ("y", ".open")]
sheet = np.zeros((len(DESIGNS) * VH + 24, LW + len(cols) * VW, 3), np.float32)
sheet[:] = (14, 16, 20)
for r, d in enumerate(DESIGNS):
    for c, (ax, op) in enumerate(cols):
        sheet[24 + r * VH:24 + (r + 1) * VH, LW + c * VW:LW + (c + 1) * VW] = vignette(ax, f"door.{d}.{ax}{op}")
im = Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8))
im = im.resize((im.width * S, im.height * S), Image.NEAREST)
dr = ImageDraw.Draw(im)
for r, d in enumerate(DESIGNS):
    dr.text((6 * S, (24 + r * VH + VH // 2) * S), f"{r} {d}", fill=(220, 220, 220))
for c, (ax, op) in enumerate(cols):
    dr.text(((LW + c * VW + 8) * S, 6 * S), f"along {ax}{' open' if op else ' closed'}", fill=(220, 220, 220))
im.save(out)
