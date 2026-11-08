"""Deskew our window run (l, m, r) and the ref's lower layer: column x shifted up by (x+1)//2 so the wall's lines
run level; one column = one art px along the wall. argv: npz_dir prefix refdir out."""
import sys
import numpy as np
from PIL import Image
D, pre, refd, out = sys.argv[1:5]
def ours():
    a = Image.new("RGBA", (200, 220), (0, 0, 0, 0))
    for i, n in enumerate([".win.l", ".win.m", ".win.r"]):
        z = np.load(f"{D}/{pre}{n}.npz"); im = Image.fromarray(z["rgba"].astype("uint8"))
        a.alpha_composite(im, (40 + 32 * i - int(z["a"][0]), 110 + 16 * i - int(z["a"][1])))
    return a
def desk(im):
    a = np.array(im); h, w = a.shape[:2]
    o = np.zeros((h + w // 2 + 2, w, 4), np.uint8)
    for x in range(w):
        s = (x + 1) // 2
        o[w // 2 + 2 - s: w // 2 + 2 - s + h, x] = a[:, x]
    r = Image.fromarray(o)
    return r.crop(r.getbbox())
o = desk(ours()); r = desk(Image.open(f"{refd}/small/assembled_from_tiles.png").convert("RGBA"))
o.save(out + "_ours.png"); r.save(out + "_ref.png")
print(o.size, r.size)
