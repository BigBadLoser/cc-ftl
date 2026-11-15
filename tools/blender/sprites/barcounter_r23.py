"""Bar look study round 23 (family `barcounter23`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
three takes on K1 (round 22): a bone body, oxide leather panels in a gunmetal frame per tile, bone pilasters at the
tile seams.

  m1 wide vertical panels: two tall panels per tile, gunmetal top
  m2 long horizontal rolls (three per tile) and a brass foot rail on standoffs at the seams, gunmetal top
  m3 K1's 2x2 panels under a tan top on a black lip, brass caps on the pilasters

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r22 import OX, B, F, U0, U1, kick, mugs, panels
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench


def framed(k, cw=None, ch=None):
    """K1's body: a bone block, one gunmetal-framed oxide field per tile."""
    kick(k)
    _px(k, U0, U1, B, F, 4, TOP - 3, "x7Bone")
    for t in range(3):
        a, b = U0 + 32 * t + 3, U0 + 32 * t + 29
        _px(k, a, b, F, F + 1, 5, TOP - 4, "x7Gun")
        if cw:
            panels(k, a + 1, b - 1, F + 1, 6, TOP - 5, OX, cw=cw, ch=ch)


def gun_top(k):
    _px(k, U0, U1, B, F + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, B, F + 1, TOP - 1, TOP, "x7Gun")


def m1():
    k = Bench("bar_m1", (3, 1))
    framed(k)
    lit, base, dark = OX
    for t in range(3):
        a, b = U0 + 32 * t + 4, U0 + 32 * t + 28
        _px(k, a, b, F + 1, F + 1.5, 6, TOP - 5, dark)
        for p0, p1 in ((a, a + 11), (a + 13, b)):                                    # two tall panels, 2 px seam
            _px(k, p0, p1, F + 1, F + 2.5, TOP - 6, TOP - 5, lit)
            _px(k, p0, p0 + 1, F + 1, F + 2.5, 6, TOP - 6, lit)
            _px(k, p0 + 1, p1, F + 1, F + 2.5, 6, TOP - 6, base)
    gun_top(k)
    mugs(k)
    return k.build()


def m2():
    k = Bench("bar_m2", (3, 1))
    framed(k, cw=26, ch=4)
    for u in (U0 + 1, U0 + 31, U0 + 63, U1 - 3):                                     # rail standoffs at the seams
        _px(k, u, u + 2, F, F + 4, 1, 3, "x7BrassD")
    _px(k, U0 + 1, U1 - 1, F + 4, F + 6, 1, 3, "x7Brass")                            # the foot rail
    gun_top(k)
    mugs(k)
    return k.build()


def m3():
    k = Bench("bar_m3", (3, 1))
    framed(k, cw=12, ch=7)
    for u in (U0, U0 + 29, U0 + 61, U1 - 3):                                         # brass pilaster caps
        _px(k, u, u + 3, F - 1, F + 1, TOP - 5, TOP - 3, "x7Brass")
    _px(k, U0, U1, B, F + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, B, F + 1, TOP - 1, TOP, "r9Tan")
    mugs(k)
    return k.build()


VARIANTS = {"m1": m1, "m2": m2, "m3": m3}


def jobs():
    return [(f"module.barcounter.{v}", (3, 1), "prop", f) for v, f in VARIANTS.items()]
