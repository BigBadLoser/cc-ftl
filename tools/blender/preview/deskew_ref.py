"""Deskew a ref window layer (assembled + each tile placed alone) as deskew_win.py: column x shifted up by (x+PH)//2.
argv: refdir layer out_prefix scale [phase 0|1, default 1]. Saves <out>_desk.npy, <out>_t<i>.npy and <out>.png."""
import sys, csv
import numpy as np
from PIL import Image, ImageDraw
refd, layer, out, sc = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
PH = int(sys.argv[5]) if len(sys.argv) > 5 else 1
def desk(a):
    h, w = a.shape[:2]; o = np.zeros((h + w // 2 + 2, w, 4), np.uint8)
    for x in range(w):
        s = (x + PH) // 2; o[w // 2 + 2 - s: w // 2 + 2 - s + h, x] = a[:, x]
    return o
A = Image.open(f"{refd}/{layer}/assembled_from_tiles.png").convert("RGBA")
rows = list(csv.DictReader(open(f"{refd}/{layer}/placement.csv")))
tiles = []
for r in rows:
    t = Image.new("RGBA", A.size); t.alpha_composite(Image.open(f"{refd}/{layer}/{r['filename']}").convert("RGBA"),
                                                    (int(r["placement_x"]), int(r["placement_y"])))
    tiles.append(desk(np.array(t)))
D = desk(np.array(A))
ys, xs = np.nonzero(D[..., 3]); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
D = D[y0:y1, x0:x1]; tiles = [t[y0:y1, x0:x1] for t in tiles]
np.save(out + "_desk.npy", D)
for i, t in enumerate(tiles): np.save(out + f"_t{i}.npy", t)
# picture: assembled deskewed, scaled, with a ruler every 4 px and the tiles' column extents
h, w = D.shape[:2]; pad = 30
im = Image.new("RGBA", (w * sc + 2 * pad, h * sc + 2 * pad + 40), (40, 40, 46, 255))
im.alpha_composite(Image.fromarray(D).resize((w * sc, h * sc), Image.NEAREST), (pad, pad))
d = ImageDraw.Draw(im)
for x in range(0, w + 1, 4):
    X = pad + x * sc; d.line([(X, pad - (8 if x % 16 == 0 else 4)), (X, pad)], fill="white")
    if x % 16 == 0: d.text((X + 2, 2), str(x + x0), fill="white")
for y in range(0, h + 1, 4):
    Y = pad + y * sc; d.line([(pad - (8 if y % 16 == 0 else 4), Y), (pad, Y)], fill="white")
    if y % 16 == 0: d.text((0, Y + 2), str(y), fill="white")
cols = [(255, 80, 80), (80, 255, 80), (80, 160, 255)]
for i, t in enumerate(tiles):
    xs = np.nonzero(t[..., 3].any(0))[0]
    Y = pad + h * sc + 8 + 10 * i
    d.line([(pad + xs.min() * sc, Y), (pad + (xs.max() + 1) * sc, Y)], fill=cols[i], width=4)
    print(f"tile {i+1}: deskewed cols {xs.min()}-{xs.max()}")
im.save(out + ".png"); print(D.shape)
