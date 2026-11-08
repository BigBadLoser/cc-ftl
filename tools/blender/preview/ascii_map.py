"""ASCII luminance map of an rgba .npy. argv: npy x0 x1 y0 y1"""
import sys
import numpy as np
D = np.load(sys.argv[1]); x0, x1, y0, y1 = map(int, sys.argv[2:6])
def ch(p):
    if p[3] < 128: return " "
    r, g, b = (int(v) for v in p[:3])
    if (r, g, b) == (8, 19, 38): return "P"
    if r > 140 and b < 60: return "Y"
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    for t, c in ((20, ","), (30, "."), (38, ":"), (46, "-"), (56, "="), (70, "+"), (85, "o"), (100, "O"), (115, "#")):
        if L < t: return c
    return "@"
print("     " + "".join(str((x // 100) % 10) if x % 10 == 0 else " " for x in range(x0, x1)))
print("     " + "".join(str((x // 10) % 10) if x % 10 == 0 else " " for x in range(x0, x1)))
print("     " + "".join(str(x % 10) for x in range(x0, x1)))
for y in range(y0, y1):
    print(f"{y:4d} " + "".join(ch(D[y, x]) for x in range(x0, x1)))
