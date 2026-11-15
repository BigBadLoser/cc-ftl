"""Bar look study round 22 (family `barcounter22`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
t1's straight (3x1, square corners, big padded panels) in three colour splits so it stops reading as one tan block.

  k1 bone body, oxide leather panels in a gunmetal frame, bone pilasters at each tile seam, gunmetal top
  k2 gunmetal body, teal panels, a thick bone slab top over a black lip
  k3 two-tone: ribbed gunmetal lower half, one tall row of tan cushions under a black top with a brass edge

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r13 import mug
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench

U0, U1, B, F = -48, 48, -12, 8
OX = ("k2OxideL", "x7Oxide", "x7OxideD")
TEAL = ("k2TealL", "x7Teal", "k2TealD")
TAN = ("r9PadL", "r9Pad", "r9PadD")


def panels(k, u0, u1, v, z0, z1, pal, cw=10, ch=6):
    """Big padded panels on the +v face at depth v over u0..u1, z0..z1: a dark ground, panels 1.5 proud, lit top and
    left. pal = (lit, base, dark)."""
    lit, base, dark = pal
    _px(k, u0, u1, v, v + 0.5, z0, z1, dark)
    n = max(1, round((u1 - u0 + 1) / (cw + 1)))
    w = (u1 - u0 + 1) / n - 1
    rows = max(1, round((z1 - z0 + 1) / (ch + 1)))
    h = (z1 - z0 + 1) / rows - 1
    for i in range(n):
        a = round(u0 + i * (w + 1))
        b = round(a + w)
        for j in range(rows):
            c = round(z1 - j * (h + 1))
            d = round(c - h)
            _px(k, a, b, v, v + 1.5, c - 1, c, lit)
            _px(k, a, a + 1, v, v + 1.5, d, c - 1, lit)
            _px(k, a + 1, b, v, v + 1.5, d, c - 1, base)


def kick(k, col="r9Char"):
    _px(k, U0, U1, B, F - 3, 0, 4, col)
    _px(k, U0, U1, F - 3, F - 2.5, 0.3, 1.3, "r9Warm")


def mugs(k):
    for u, col in ((-26, "r9Amber"), (14, "r9Blue")):
        mug(k, u, -2, col)


def k1():
    k = Bench("bar_k1", (3, 1))
    kick(k)
    _px(k, U0, U1, B, F, 4, TOP - 3, "x7Bone")
    for t in range(3):                                                               # one framed field per tile
        a, b = U0 + 32 * t + 3, U0 + 32 * t + 29
        _px(k, a, b, F, F + 1, 5, TOP - 4, "x7Gun")
        panels(k, a + 1, b - 1, F + 1, 6, TOP - 5, OX, cw=12, ch=7)
    _px(k, U0, U1, B, F + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, B, F + 1, TOP - 1, TOP, "x7Gun")
    mugs(k)
    return k.build()


def k2():
    k = Bench("bar_k2", (3, 1))
    kick(k)
    _px(k, U0, U1, B, F, 4, TOP - 4, "x7Gun")
    _px(k, U0, U1, F, F + 1, 4, 5, "x7Black")
    panels(k, U0 + 2, U1 - 2, F, 5, TOP - 5, TEAL, cw=14, ch=7)
    _px(k, U0, U1, B, F + 1, TOP - 4, TOP - 3, "x7Black")
    _px(k, U0, U1, B - 1, F + 2, TOP - 3, TOP, "r9Bone")                            # thick bone slab
    mugs(k)
    return k.build()


def k3():
    k = Bench("bar_k3", (3, 1))
    kick(k, "x7Black")
    _px(k, U0, U1, B, F, 4, 9, "x7Gun")
    for u in range(U0 + 2, U1 - 1, 6):                                               # vertical ribs, lower half
        _px(k, u, u + 2, F, F + 1, 4, 9, "r9Grey")
    _px(k, U0, U1, B, F + 1, 9, 10, "x7Black")
    _px(k, U0, U1, B, F, 10, TOP - 3, "r9PadD")
    panels(k, U0, U1, F, 10, TOP - 3, TAN, cw=15, ch=11)
    _px(k, U0, U1, B, F + 1, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, F + 1, F + 2, TOP - 3, TOP - 1, "x7Brass")                       # brass edge strip
    _px(k, U0, U1, B, F + 2, TOP - 1, TOP, "x7Gun")
    mugs(k)
    return k.build()


VARIANTS = {"k1": k1, "k2": k2, "k3": k3}


def jobs():
    return [(f"module.barcounter.{v}", (3, 1), "prop", f) for v, f in VARIANTS.items()]
