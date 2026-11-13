"""Vending machine look study, round 22 (family `vending22`, palette set vending, preview only): 21a (user's pick,
2026-11-13) with something on the roof (user: "top feels blank").

  vm1c22a livery over the top: two teal brush strokes and the purple pen line (with its magenta shadow) laid
          across the roof from the edge of its flat above the side, as if the side's pattern carried on over it
  vm1c22b a purple lid: the roof and its rounded edge in the livery's purple
  vm1c22c roof hardware: a slatted vent grille towards the back, a round fan cap, a small hatch plate

Then (user: "something like a with a little more coverage"):
  vm1c22d a third stroke coming over the front edge, all wider
  vm1c22e the same three strokes wider still
  vm1c22f four strokes over the right and front edges, a longer pen line across the whole roof

Uses round 21's machine (r20/r21 front pieces, r10 body, r15 painter, 19e look). SPRITE_SAMPLES=64."""
import math

from . import vending_r10 as R
from . import vending_r15 as V
from . import vending_r20 as W
from . import vending_r21 as X
from .vending_r19 import LOOKS as L19
from .vending_study import FP

ZT = R.TOP + 0.06                                                    # just above the flat top


def ribbon(k, pts, w0, w1, col, z=ZT):
    """A flat tapered band on the roof along (u, v) points, w0 wide at the start, w1 at the end."""
    n = len(pts)
    left, right = [], []
    for i, (u, v) in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        du, dv = b[0] - a[0], b[1] - a[1]
        L = math.hypot(du, dv) or 1.0
        w = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((u - dv / L * w, v + du / L * w))
        right.append((u + dv / L * w, v - du / L * w))
    for i in range(n - 1):
        R.face(k, [(*left[i], z), (*right[i], z), (*right[i + 1], z), (*left[i + 1], z)], col, (0, 0, 1))


ROOFS = {  # teal strokes (points, start width, end width) and the pen line, in (u, v) on the roof's flat
    "a": ([([(12.7, 6.0), (6, 1), (-2, -4.5), (-9, -10)], 8.0, 1.0),
           ([(12.7, -5.0), (8, -8.5), (3, -11.5)], 6.5, 1.0)],
          [(12.7, 1.0), (1.0, -3.5), (6.5, -5.5), (-6.0, -10.5), (-2.5, -11.4)]),
    "d": ([([(12.7, 7.0), (5, 1.5), (-3, -4.5), (-11, -10.5)], 10.0, 2.0),
           ([(12.7, -3.5), (6, -7.5), (-1, -11.4)], 9.0, 2.0),
           ([(3.5, 8.5), (-4, 3), (-12.6, -3.5)], 8.0, 1.5)],
          [(12.7, 2.0), (0.0, -3.0), (7.0, -5.5), (-6.5, -10.5), (-2.5, -11.4)]),
    "e": ([([(12.7, 7.0), (5, 1.5), (-3, -4.5), (-11, -10.5)], 13.0, 3.0),
           ([(12.7, -3.5), (6, -7.5), (-1, -11.4)], 11.0, 2.5),
           ([(3.5, 8.5), (-4, 3), (-12.6, -3.5)], 10.0, 2.0)],
          [(12.7, 2.0), (0.0, -3.0), (7.0, -5.5), (-6.5, -10.5), (-2.5, -11.4)]),
    "f": ([([(12.7, 8.3), (6, 4), (-1, -0.5), (-8, -5)], 9.0, 2.0),
           ([(12.7, 0.5), (5, -4.5), (-3, -9.5)], 9.0, 2.0),
           ([(12.7, -8.0), (8, -11.4)], 6.0, 2.0),
           ([(-1, 8.5), (-7, 4), (-12.6, 0.5)], 8.0, 2.0)],
          [(12.7, 4.0), (-4.0, -1.0), (4.0, -4.0), (-10.0, -9.0), (-6.0, -11.4)]),
}


def livery_top(k, roof="a"):
    strokes, pen = ROOFS[roof]
    for pts, w0, w1 in strokes:
        ribbon(k, pts, w0, w1, "jzTeal")
    ribbon(k, [(u + 0.6, v - 0.6) for u, v in pen], 1.2, 1.2, "jzMagenta", ZT + 0.02)   # over the teal
    ZT2 = ZT + 0.04
    for a, b in zip(pen, pen[1:]):
        du, dv = b[0] - a[0], b[1] - a[1]
        L = math.hypot(du, dv)
        nu, nv = -dv / L * 0.6, du / L * 0.6
        R.face(k, [(a[0] - nu, a[1] - nv, ZT2), (b[0] - nu, b[1] - nv, ZT2), (b[0] + nu, b[1] + nv, ZT2),
                   (a[0] + nu, a[1] + nv, ZT2)], "jzPurple", (0, 0, 1))


def hardware(k):
    z = R.TOP
    W.bx(k, -9.0, 3.0, -12.0, -4.0, z, z + 0.8, "jzGrey")                        # vent grille frame
    for i in range(6):
        u0 = -8.2 + i * 1.8
        W.bx(k, u0, u0 + 0.9, -11.3, -4.7, z + 0.8, z + 0.85, "vmDark")           # slots
    k.cyl(7.5 / 32, -7.5 / 32, z / R.ZPX, 3.0 / 32, 0.9 / R.ZPX, "vmAluD", top="vmAlu", sides=16)   # fan cap
    W.bx(k, -6.0, 6.0, 1.0, 7.5, z, z + 0.3, "jzGrey")                          # hatch plate
    for u in (-5.2, 5.2):
        for v in (1.8, 6.7):
            W.bx(k, u - 0.35, u + 0.35, v - 0.35, v + 0.35, z + 0.3, z + 0.5, "vmDark")   # its screws


def make(name):
    style = name[-1]
    look = dict(L19["vm1c19e"])
    lid = "jzPurple" if style == "b" else "jzWhite"

    def f():
        old = R.HOLES
        R.HOLES = X.HOLES
        try:
            k = V.Bench(f"vending_{name}", FP)
            remap = {"vmWine": lid, "vmWineD": "jzGrey", "vmCreamD": "jzGrey", "vmCream": "jzWhite"}
            poly = k.m.poly
            k.m.poly = lambda pts, color, flip=False: poly(pts, remap.get(color, color), flip=flip)
            paint = V.painter(look)
            R.body(k, R.WAVES["vm1c10b"], paint=lambda s, u, v, z: lid if z > R.CREAM_TOP else paint(s, u, v, z))
            X.snacks(k, "D1")
            W.cans(k)
            X.keypad(k)
            W.tray(k, "a")
            if style in ROOFS:
                livery_top(k, style)
            if style == "c":
                hardware(k)
            R.back(k)
            out = R.build(k)
            V.ramp(k, out[0], -0.12, 0.35, 0.40, pick=lambda r, g, b: True)
            V.flat_top(out[0])
            return out
        finally:
            R.HOLES = old
    return f


DESIGNS = {n: make(n) for n in ("vm1c22a", "vm1c22b", "vm1c22c", "vm1c22d", "vm1c22e", "vm1c22f")}


def jobs():
    return [(f"module.vending22.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
