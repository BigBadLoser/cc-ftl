"""python3 foot_scan.py <mask.npz>: the px just under the exterior's foot (its lowest px in a column, over a belly)
that stand out from both columns beside them: lone dots along the junction. Prints (x, y, colour, owner tile)."""
import sys
import numpy as np
z = np.load(sys.argv[1])
img, ext, own = z["img"].astype(int), z["ext"], z["own"]
H, W = ext.shape
bg = img[0, 0]
rows = []
for x in range(W):
    ys = np.where(ext[:, x])[0]
    if not len(ys):
        rows.append(None)
        continue
    y = ys.max() + 1                                    # (the px under its foot)
    rows.append(y if y < H and np.abs(img[y, x] - bg).sum() > 6 else None)
hits = 0
for x in range(1, W - 1):
    y, a, b = rows[x], rows[x - 1], rows[x + 1]
    if y is None or a is None or b is None or abs(a - y) > 1 or abs(b - y) > 1:
        continue
    for k in range(2):                                  # (the two rows under it)
        c, l, r = img[y + k, x], img[a + k, x - 1], img[b + k, x + 1]
        if np.abs(c - l).sum() > 24 and np.abs(c - r).sum() > 24 and np.abs(l - r).sum() < 24:
            hits += 1
            print(x, y + k, tuple(c), "beside", tuple(l), "tile", divmod(int(own[y + k, x]), 100))
print("hits", hits)
