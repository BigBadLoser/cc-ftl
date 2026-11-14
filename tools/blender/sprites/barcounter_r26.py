"""Bar look study round 26 (family `barcounter26`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
O1 (round 25) as pieces that combine into an L, like round 21's t1 pieces. O1: a bone body, one gunmetal-framed field of
oxide leather panels per tile with bone between the fields, a black lip, a gunmetal top, a dark kick set back under
the padded faces; the padded faces sit on the tile edge by the stools.

Pieces (each runs to its tiles' edges along the run, so neighbours butt flush; the customer face is padded):
  o1s straight (3x1): front +v padded
  o1c corner (1x1): front +v and right +u padded; joins the straight on its left and the arm behind it
  o1a arm (1x2): the run going back from the corner along v; its right +u side padded
An L: o1s, then o1c at its right end, then o1a behind o1c. The bartender stands inside the L.

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r13 import mug
from .barcounter_r22 import OX
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench

E, I = 13, -7                                                    # the padded edge (panels end at E + 2.5) and the inner side


def box(k, ax, a0, a1, d0, d1, z0, z1, col):
    """_px with the face axis named: ax "v" = a along u, d along v; ax "u" = a along v, d along u."""
    if ax == "v":
        _px(k, a0, a1, d0, d1, z0, z1, col)
    else:
        _px(k, d0, d1, a0, a1, z0, z1, col)


def field(k, ax, a, b, d):
    """One gunmetal frame on the padded face at depth d over a..b, with O1's 2x2 oxide panels. On a +v face the panels
    are lit along their top and left; on a +u face along their top and camera-near (high v) side."""
    lit, base, dark = OX
    box(k, ax, a, b, d, d + 1, 5, TOP - 4, "x7Gun")
    box(k, ax, a + 1, b - 1, d + 1, d + 1.5, 6, TOP - 5, dark)
    n = max(1, round((b - a - 1) / 13))
    w = (b - a - 1) / n - 1
    rows, h = 2, (TOP - 10) / 2 - 1
    for i in range(n):
        p0 = round(a + 1 + i * (w + 1))
        p1 = round(p0 + w)
        for j in range(rows):
            c = round(TOP - 5 - j * (h + 1))
            dd = round(c - h)
            box(k, ax, p0, p1, d + 1, d + 2.5, c - 1, c, lit)
            s0, s1 = (p0, p0 + 1) if ax == "v" else (p1 - 1, p1)
            box(k, ax, s0, s1, d + 1, d + 2.5, dd, c - 1, lit)
            box(k, ax, p0 + 1 if ax == "v" else p0, p1 if ax == "v" else p1 - 1, d + 1, d + 2.5, dd, c - 1, base)


def run(k, ax, a0, a1, tiles):
    """A run of counter along ax from a0 to a1 (whole tiles), padded on its outer face, fields per tile."""
    box(k, ax, a0, a1, I, E - 4, 0, 4, "r9Char")
    box(k, ax, a0, a1, I, E, 4, TOP - 3, "x7Bone")
    for t in tiles:
        field(k, ax, t - 13, t + 13, E)
    box(k, ax, a0, a1, I, E + 1.5, TOP - 3, TOP - 1, "x7Black")
    box(k, ax, a0, a1, I, E + 1, TOP - 1, TOP, "x7Gun")


def o1s():
    k = Bench("bar_o1s", (3, 1))
    run(k, "v", -48, 48, (-32, 0, 32))
    for u, col in ((-26, "r9Amber"), (14, "r9Blue")):
        mug(k, u, 3, col)
    return k.build()


def o1c():
    k = Bench("bar_o1c", (1, 1))
    _px(k, -16, E - 4, I, E - 4, 0, 4, "r9Char")                                    # kick, both padded faces set back
    _px(k, I, E - 4, -16, I, 0, 4, "r9Char")
    _px(k, -16, E, I, E, 4, TOP - 3, "x7Bone")
    _px(k, I, E, -16, I, 4, TOP - 3, "x7Bone")
    field(k, "v", -13, E - 3, E)                                                     # 3 px of bone at the seam and the corner
    field(k, "u", -13, E - 3, E)
    _px(k, -16, E + 1.5, I, E + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, I, E + 1.5, -16, I, TOP - 3, TOP - 1, "x7Black")
    _px(k, -16, E + 1, I, E + 1, TOP - 1, TOP, "x7Gun")
    _px(k, I, E + 1, -16, I, TOP - 1, TOP, "x7Gun")
    return k.build()


def o1a():
    k = Bench("bar_o1a", (1, 2))
    run(k, "u", -32, 32, (-16, 16))
    mug(k, 3, 10, "r9Ruby")
    return k.build()


PIECES = {"o1s": ((3, 1), o1s), "o1c": ((1, 1), o1c), "o1a": ((1, 2), o1a)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in PIECES.items()]
