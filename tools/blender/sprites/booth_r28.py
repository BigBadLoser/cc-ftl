"""Booth look study round 28 (family `booth28`, palette sets bar22 + bar17 + bar9, preview only; seat 15 px, table top
24 px, backs 28 px): a 2x2 freestanding booth in the bar counter's (O1) materials: bone shells, oxide leather, a
gunmetal-framed padded face, gunmetal and black tops. No back walls: the room's walls stand behind it.

  e1 curved: a half-round booth wrapped round the back of a round pedestal table, its back tufted in vertical channels
  e2 facing: two benches facing across a square table, backs at the left and right; the near back's outer face carries
     the counter's framed panels
  e3 corner: an L booth along the back and the left round a square table, open to the front and right

All in px of the footprint's centre (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r10 import arcseg
from .barcounter_r26 import field
from .barcounter_r3 import cyl
from .barcounter_study import SEAT, TOP
from .bunk_study import _px
from .research_kit import Bench

FP = (2, 2)
BACK = SEAT + 13


def pedestal(k, u, v):
    cyl(k, u, v, 0, 1, 6, "x7Gun", sides=18)
    cyl(k, u, v, 1, TOP - 3, 2, "r9Grey", sides=10)


def sq_table(k, u0, u1, v0, v1):
    pedestal(k, (u0 + u1) / 2, (v0 + v1) / 2)
    _px(k, u0, u1, v0, v1, TOP - 3, TOP - 1, "x7Black")
    _px(k, u0, u1, v0, v1, TOP - 1, TOP, "x7Gun")


def seat_v(k, u0, u1, v0, v1):
    """A seat block: a set-back dark kick, a bone box, an oxide cushion lit on top."""
    _px(k, u0 + 2, u1 - 2, v0 + 2, v1 - 2, 0, 3, "r9Char")
    _px(k, u0, u1, v0, v1, 3, SEAT - 3, "x7Bone")
    _px(k, u0, u1, v0, v1, SEAT - 3, SEAT - 1, "x7Oxide")
    _px(k, u0, u1, v0, v1, SEAT - 1, SEAT, "k2OxideL")


def channels(k, ax, a0, a1, d, z0, z1, w=5):
    """Vertical channel tufting on an inner back face at depth d (ax "v": a face looking +v; "u": looking +u): oxide
    rolls w px wide, lit on top, with dark seams."""
    box = (lambda a, b, d0, d1, c0, c1, col: _px(k, a, b, d0, d1, c0, c1, col)) if ax == "v" else \
          (lambda a, b, d0, d1, c0, c1, col: _px(k, d0, d1, a, b, c0, c1, col))
    box(a0, a1, d, d + 0.5, z0, z1, "x7OxideD")
    n = max(1, round((a1 - a0) / (w + 1)))
    step = (a1 - a0) / n
    for i in range(n):
        a = round(a0 + i * step) + 1
        b = round(a0 + (i + 1) * step)
        box(a, b, d, d + 1.5, z0, z1 - 1, "x7Oxide")
        box(a, b, d, d + 1.5, z1 - 1, z1, "k2OxideL")


def e1():
    k = Bench("booth_e1", FP)
    CU, CV, N = 0, -2, 16
    a0, a1 = math.radians(180), math.radians(360)
    for i in range(N):
        a = a0 + (a1 - a0) * (i + 0.5) / N
        w = math.pi * 30 / N * 1.15
        arcseg(k, CU, CV, a, w * 0.8, 20, 10, 0, 3, "r9Char")
        arcseg(k, CU, CV, a, w * 0.9, 21, 12, 3, SEAT - 3, "x7Bone")
        arcseg(k, CU, CV, a, w * 0.9, 21, 12, SEAT - 3, SEAT, "x7Oxide")
        arcseg(k, CU, CV, a, w, 29.5, 3, 3, BACK, "x7Bone")                          # back shell
        arcseg(k, CU, CV, a, w * 0.7, 27.5, 1.5, SEAT, BACK - 2, "x7Oxide")         # one tufted channel per segment
        arcseg(k, CU, CV, a, w, 29.5, 4, BACK, BACK + 2, "x7Gun")                  # cap rail
    pedestal(k, CU, CV)
    cyl(k, CU, CV, TOP - 3, TOP - 1, 11, "x7Black", sides=24)
    cyl(k, CU, CV, TOP - 1, TOP, 10.5, "x7Gun", sides=24)
    return k.build()


def e2():
    k = Bench("booth_e2", FP)
    for s in (-1, 1):                                                                # left (s -1) and right benches
        seat_v(k, *sorted((s * 14, s * 27)), -28, 28)
        o0, o1 = sorted((s * 27, s * 32))
        _px(k, o0, o1, -28, 28, 0, BACK, "x7Bone")
        _px(k, o0 - 0.5, o1 + 0.5, -28.5, 28.5, BACK, BACK + 2, "x7Gun")
    channels(k, "u", -28, 28, -27, SEAT, BACK - 2)                                   # the far bench's back, inner face
    field(k, "u", -26, -2, 32)                                                       # the near back's outer face
    field(k, "u", 2, 26, 32)
    sq_table(k, -10, 10, -14, 14)
    return k.build()


def e3():
    k = Bench("booth_e3", FP)
    seat_v(k, -32, 32, -27, -13)                                                     # along the back
    seat_v(k, -27, -13, -13, 30)                                                     # along the left
    _px(k, -32, 32, -32, -27, 0, BACK, "x7Bone")
    _px(k, -32, -27, -27, 30, 0, BACK, "x7Bone")
    channels(k, "v", -27, 32, -27, SEAT, BACK - 2)
    channels(k, "u", -27, 30, -27, SEAT, BACK - 2)
    _px(k, -32.5, 32.5, -32.5, -26.5, BACK, BACK + 2, "x7Gun")
    _px(k, -32.5, -26.5, -26.5, 30.5, BACK, BACK + 2, "x7Gun")
    sq_table(k, -6, 22, -8, 20)
    return k.build()


VARIANTS = {"e1": e1, "e2": e2, "e3": e3}


def jobs():
    return [(f"module.booth.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
