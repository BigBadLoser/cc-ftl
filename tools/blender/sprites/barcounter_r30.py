"""Bar look study round 30 (family `barcounter30`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
cubby shelves on the back (the bartender's side, -v) of the O1 straight (round 26's o1s; the counter in game). The
body behind the back face is set in 3 px, a dark ground closes the cubbies' backs and a bone frame of 2 px dividers
and shelves stands flush with the top's back edge. Rendered at rotation 2, so the back faces the camera.

  c1 open grid: two rows of square cubbies, nine across
  c2 tall bays: one row of tall cubbies, a gunmetal shelf halfway up each
  c3 mixed: open cubbies over a row of gunmetal drawer fronts with bone pulls
Round 31 (same family), fewer and bigger:
  g1 six tall bays, two per tile
  g2 one wide cubby per tile, two rows
  g3 one big bay per tile with a gunmetal shelf across it

All in px of the tile at rotation 0 (u across, v deep, front +v toward the stools, z up)."""
from .barcounter_r22 import OX  # noqa: F401  (palette set bar22 is the study's)
from .barcounter_r26 import E, I, field
from .barcounter_study import TOP
from .bunk_study import _px
from .leisure import turned
from .research_kit import Bench

U0, U1 = -48, 48
Z0, Z1 = 4, TOP - 3                                                              # the back face under the lip
D = 2                                                                            # divider and shelf thickness
R = 3                                                                            # recess depth


def body(k):
    """o1s with its back face set in R px: kick, bone body, padded front fields, lip and top."""
    _px(k, U0, U1, I, E - 4, 0, Z0, "r9Char")
    _px(k, U0, U1, I + R, E, Z0, Z1, "x7Bone")
    for t in (-32, 0, 32):
        field(k, "v", t - 13, t + 13, E)
    _px(k, U0, U1, I, E + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, I, E + 1, TOP - 1, TOP, "x7Gun")
    _px(k, U0 + D, U1 - D, I + R - 0.5, I + R, Z0, Z1, "r9Char")                     # the cubbies' dark backs
    for u in (U0, U1 - D):                                                       # end posts, full depth
        _px(k, u, u + D, I, I + R, Z0, Z1, "x7Bone")


def splits(a, b, n):
    """n openings between a and b with D px dividers at both ends and between: [(o0, o1), ...]."""
    cell = (b - a - (n + 1) * D) / n
    return [(round(a + D + i * (cell + D)), round(a + D + i * (cell + D) + cell)) for i in range(n)]


def frame(k, cols, rows, z0=Z0, z1=Z1, col="x7Bone"):
    """A flush frame over u U0..U1, z z0..z1: dividers between cols, shelves between rows (and at both ends)."""
    cs, rs = splits(U0, U1, cols), splits(z0, z1, rows)
    for u in [U0] + [c[1] for c in cs]:
        _px(k, u, u + D, I, I + R - 0.5, z0, z1, col)
    for z in [z0] + [r[1] for r in rs]:
        _px(k, U0, U1, I, I + R - 0.5, z, z + D, col)
    return cs, rs


def c1():
    k = Bench("bar_c1", (3, 1))
    body(k)
    frame(k, 9, 2)
    return k.build()


def c2():
    k = Bench("bar_c2", (3, 1))
    body(k)
    cs, rs = frame(k, 9, 1)
    zm = round((Z0 + Z1) / 2)
    for a, b in cs:
        _px(k, a, b, I + 0.5, I + R - 0.5, zm - 1, zm, "x7Gun")
    return k.build()


def c3():
    k = Bench("bar_c3", (3, 1))
    body(k)
    zd = 11                                                                      # drawers below, cubbies above
    cs, _ = frame(k, 9, 1, zd, Z1)
    _px(k, U0, U1, I, I + R - 0.5, Z0, Z0 + D, "x7Bone")
    for u in [U0] + [c[1] for c in cs]:
        _px(k, u, u + D, I, I + R - 0.5, Z0, zd, "x7Bone")
    for a, b in cs:
        _px(k, a, b, I + 0.5, I + R - 0.5, Z0 + D, zd, "x7Gun")
        m = (a + b) / 2
        _px(k, m - 1.5, m + 1.5, I, I + 0.5, zd - 3, zd - 2, "x7Bone")             # the pull
    return k.build()


# round 31: fewer, bigger cubbies
def g1():
    """Six tall bays, two per tile."""
    k = Bench("bar_g1", (3, 1))
    body(k)
    frame(k, 6, 1)
    return k.build()


def g2():
    """One wide cubby per tile, two rows."""
    k = Bench("bar_g2", (3, 1))
    body(k)
    frame(k, 3, 2)
    return k.build()


def g3():
    """One big bay per tile with a gunmetal shelf across it."""
    k = Bench("bar_g3", (3, 1))
    body(k)
    cs, _ = frame(k, 3, 1)
    zm = round((Z0 + Z1) / 2)
    for a, b in cs:
        _px(k, a, b, I + 0.5, I + R - 0.5, zm - 1, zm + 1, "x7Gun")
    return k.build()


VARIANTS = {"c1": c1, "c2": c2, "c3": c3, "g1": g1, "g2": g2, "g3": g3}


def jobs():
    return [(f"module.barcounter.{v}", (3, 1), "prop", (lambda f=f: turned(f, 2))) for v, f in VARIANTS.items()]
