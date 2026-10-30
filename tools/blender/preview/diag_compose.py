"""python3 -I compose.py <npz dir> <repo> <out>: a staircase of diagonal tiles between straight runs, from per-tile
sprites (npz: diag pieces) and the preview's walls sheet (straight m10), drawn back to front at their tile anchors."""
import json, sys
import numpy as np
from PIL import Image
d, repo, out = sys.argv[1:4]
m = json.load(open(f"{repo}/public/assets/1x/manifest.json"))["assets"]
sheet = Image.open(f"{repo}/public/assets/1x/sprites/walls.png").convert("RGBA")
def sh(k):
    f, a = m[k]["frame"], m[k]["anchor"]
    return sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])), (a["x"], a["y"])
def npz(k):
    z = np.load(f"{d}/{k}.npz"); return Image.fromarray(z["rgba"].astype("uint8"), "RGBA"), tuple(int(v) for v in z["a"])
tiles = [((x, 0), sh("tile.wall.full.m10")) for x in range(-3, 1)]
for k in range(3):
    tiles += [((1 + k, -k), npz("tile.wall.diag.a.m9")), ((1 + k, -k - 1), npz("tile.wall.diag.a.m6"))]
tiles += [((x, -3), sh("tile.wall.full.m10")) for x in range(4, 7)]
W, H = 900, 520
img = Image.new("RGBA", (W, H), (40, 44, 50, 255))
ox, oy = 300, 330
from PIL import ImageDraw
dr = ImageDraw.Draw(img)
for x in range(-3, 7):
    for y in range(-4, 2):
        X, Y = ox + (x - y) * 32, oy + (x + y) * 16
        dr.polygon([(X, Y - 16), (X + 32, Y), (X, Y + 16), (X - 32, Y)], fill=(58, 62, 70) if (x + y) % 2 else (66, 70, 78))
for (x, y), (im, (ax, ay)) in sorted(tiles, key=lambda t: (t[0][0] + t[0][1], t[0][0])):
    img.alpha_composite(im, (ox + (x - y) * 32 - ax, oy + (x + y) * 16 - ay))
img.crop((60, 40, 880, 500)).resize((820 * 2, 460 * 2), Image.NEAREST).save(out)
