"""Bar look study round 32 (family `barcounter32`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
G1 (round 31: six tall bays on the counter's back, two per tile) with its two end bays closed as cabinets and generic
goods (boxes, tins, a folded cloth; no drinks) on the four between. The bays are 7 px deep so goods fit inside the
counter's line. Rendered at rotation 2, so the back faces the camera.

  h1 gunmetal cabinet doors with a bone pull; boxes and tins
  h2 bone doors with a gunmetal inset panel; tins in rows on a mid shelf
  h3 oxide padded doors, as the counter's front; crates, a stacked cloth and canisters

All in px of the tile at rotation 0 (u across, v deep, front +v toward the stools, z up)."""
from .barcounter_r26 import E, I, field
from .barcounter_r3 import cyl
from .barcounter_study import TOP
from .bunk_study import _px
from .leisure import turned
from .research_kit import Bench

U0, U1 = -48, 48
Z0, Z1 = 4, TOP - 3
D, R = 2, 7                                                                      # divider thickness, bay depth
F0 = Z0 + D                                                                      # a bay's floor


def splits(a, b, n):
    cell = (b - a - (n + 1) * D) / n
    return [(round(a + D + i * (cell + D)), round(a + D + i * (cell + D) + cell)) for i in range(n)]


def counter(k):
    """o1s with its back set in R px as six bays in a flush bone frame; returns the bays [(u0, u1), ...]."""
    _px(k, U0, U1, I, E - 4, 0, Z0, "r9Char")
    _px(k, U0, U1, I + R, E, Z0, Z1, "x7Bone")
    for t in (-32, 0, 32):
        field(k, "v", t - 13, t + 13, E)
    _px(k, U0, U1, I, E + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, I, E + 1, TOP - 1, TOP, "x7Gun")
    bays = splits(U0, U1, 6)
    _px(k, U0 + D, U1 - D, I + R - 0.5, I + R, Z0, Z1, "r9Char")                     # dark backs
    for u in [U0] + [b for _, b in bays]:
        _px(k, u, u + D, I, I + R, Z0, Z1, "x7Bone")
    for z in (Z0, Z1 - D):
        _px(k, U0, U1, I, I + R, z, z + D, "x7Bone")
    return bays


def door(k, a, b, face, panel=None, pull="x7Bone"):
    _px(k, a, b, I + 0.5, I + 1.5, F0, Z1 - D, face)
    if panel:
        _px(k, a + 2, b - 2, I + 0.2, I + 0.5, F0 + 2, Z1 - D - 2, panel)
    m = b - 3                                                                    # the pull, by the inner edge
    _px(k, m - 1, m + 1, I, I + 0.5, (F0 + Z1 - D) / 2 - 2, (F0 + Z1 - D) / 2 + 2, pull)


def box(k, u, v, z, w, d, h, col, lid):
    _px(k, u, u + w, v, v + d, z, z + h - 1, col)
    _px(k, u, u + w, v, v + d, z + h - 1, z + h, lid)


def tin(k, u, v, z, h, col, r=1.6):
    cyl(k, u, v, z, z + h - 1, r, col, sides=10)
    cyl(k, u, v, z + h - 1, z + h, r, "r9Grey", sides=10)


def h1():
    k = Bench("bar_h1", (3, 1))
    bays = counter(k)
    for a, b in (bays[0], bays[-1]):
        door(k, a, b, "x7Gun")
    v = I + 1.5
    (a1, _), (a2, _), (a3, _), (a4, _) = bays[1:5]
    box(k, a1 + 1, v, F0, 8, 4.5, 5, "r9Tan", "r9Sand")
    box(k, a1 + 2, v + 0.5, F0 + 5, 6, 4, 4, "x7Khaki", "r9Bone")
    for i in range(3):
        tin(k, a2 + 3 + i * 4, v + 2.5, F0, 5, "x7Teal")
    box(k, a2 + 1, v, F0 + 5, 11, 4.5, 3, "r9Orange", "r9Amber")
    box(k, a3 + 2, v, F0, 9, 4.5, 8, "x7Olive", "x7OliveL")
    for i in range(2):
        tin(k, a4 + 4 + i * 5, v + 2.5, F0, 6, "x7Oxide", r=2)
    return k.build()


def h2():
    k = Bench("bar_h2", (3, 1))
    bays = counter(k)
    for a, b in (bays[0], bays[-1]):
        door(k, a, b, "x7Bone", panel="x7Gun", pull="x7Gun")
    zm = round((F0 + Z1 - D) / 2)
    cols = ("x7Teal", "r9Orange", "x7Yellow", "x7Oxide")
    for j, (a, b) in enumerate(bays[1:5]):
        _px(k, a, b, I + 1, I + R, zm - 1, zm, "x7Gun")                             # mid shelf
        n = 3
        for i in range(n):
            u = a + 2.5 + i * (b - a - 5) / (n - 1)
            tin(k, u, I + 4, F0, 5, cols[(i + j) % 4])
            tin(k, u, I + 4, zm, 4 + (i + j) % 2, cols[(i + j + 2) % 4], r=1.4)
    return k.build()


def h3():
    k = Bench("bar_h3", (3, 1))
    bays = counter(k)
    for a, b in (bays[0], bays[-1]):
        door(k, a, b, "x7Oxide", panel="k2OxideL", pull="x7Bone")
        _px(k, a + 2, b - 2, I + 0.1, I + 0.2, F0 + 2, F0 + 3, "x7OxideD")
    v = I + 1.5
    (a1, _), (a2, _), (a3, _), (a4, _) = bays[1:5]
    box(k, a1 + 1, v, F0, 11, 5, 6, "x7Khaki", "r9Bone")                             # crates, a stencil band
    _px(k, a1 + 1, a1 + 12, v - 0.1, v, F0 + 2, F0 + 3, "x7Yellow")
    box(k, a2 + 1, v, F0, 10, 4.5, 2, "x7Teal", "k2TealL")                            # folded cloths, stacked
    box(k, a2 + 1, v, F0 + 2, 10, 4.5, 2, "x7Cream", "x7White")
    box(k, a2 + 1, v, F0 + 4, 10, 4.5, 2, "x7Teal", "k2TealL")
    for i, col in enumerate(("r9Orange", "x7Steel")):
        cyl(k, a3 + 4 + i * 6, I + 3.5, F0, F0 + 8, 2.4, col, sides=12)
        cyl(k, a3 + 4 + i * 6, I + 3.5, F0 + 8, F0 + 9, 1.4, "r9GreyD", sides=10)
    box(k, a4 + 1, v, F0, 11, 5, 4, "r9Tan", "r9Sand")
    box(k, a4 + 3, v + 0.5, F0 + 4, 7, 4, 4, "x7Olive", "x7OliveL")
    return k.build()


VARIANTS = {"h1": h1, "h2": h2, "h3": h3}


def jobs():
    return [(f"module.barcounter.{v}", (3, 1), "prop", (lambda f=f: turned(f, 2))) for v, f in VARIANTS.items()]
