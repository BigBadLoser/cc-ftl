"""Our window run (l | m | r) per look beside the ref's two layers. argv: out k then triples
'dir:prefix:refstyle' (prefix e.g. tile.wall.slate.full.m10)."""
import sys, glob
import numpy as np
from PIL import Image, ImageDraw
out, k = sys.argv[1], int(sys.argv[2])
REF = "/tmp/claude-0/-home-user/d90bd30e-5bfe-51f0-9d45-019095d96471/scratchpad/iwref"
BG = (58, 62, 72, 255)
def crop(im):
    return im.crop(im.getbbox())
def run(D, pre):
    a = Image.new("RGBA", (260, 220), (0, 0, 0, 0))
    for i, n in enumerate([".win.l", ".win.m", ".win.r"], 1):          # (the window alone: no base tiles, the user)
        z = np.load(f"{D}/{pre}{n}.npz"); im = Image.fromarray(z["rgba"].astype("uint8"))
        a.alpha_composite(im, (40 + 32 * i - int(z["a"][0]), 110 + 16 * i - int(z["a"][1])))
    return crop(a)
rows = []
for t in sys.argv[3:]:
    D, pre, st = t.split(":")
    d = glob.glob(f"{REF}/wall_style_{st}/3_tile_window_*")[0]
    ims = [run(D, pre)] + [crop(Image.open(f"{d}/{m}/assembled_from_tiles.png").convert("RGBA")) for m in ("full", "small")]
    rows.append((f"{pre} | ref {st}: upper layer, lower layer", [i.resize((i.width * k, i.height * k), Image.NEAREST) for i in ims]))
cw = [max(r[1][i].width for r in rows) + 30 for i in range(3)]
rh = [max(i.height for i in r[1]) + 40 for r in rows]
W = Image.new("RGBA", (sum(cw) + 20, 40 + sum(rh)), BG); dr = ImageDraw.Draw(W)
dr.text((10, 10), "Ours: Blender renders put together as 2D composites (win.l | win.m | win.r). Then the ref.", fill="white")
y = 40
for lab, ims in rows:
    dr.text((10, y), lab, fill="white"); x = 10
    for im, w in zip(ims, cw):
        W.alpha_composite(im, (x, y + 16)); x += w
    y += rh[rows.index((lab, ims))]
W.save(out)
