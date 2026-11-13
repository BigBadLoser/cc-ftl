"""Vending machine look study, round 22 (family `vending22`, palette set vending, preview only): 21a (user's pick,
2026-11-13) with something on the roof (user: "top feels blank").

  vm1c22a livery over the top: two teal brush strokes and the purple pen line (with its magenta shadow) laid
          across the roof from the edge of its flat above the side, as if the side's pattern carried on over it
  vm1c22b a purple lid: the roof and its rounded edge in the livery's purple
  vm1c22c roof hardware: a slatted vent grille towards the back, a round fan cap, a small hatch plate

Uses round 21's machine (r20/r21 front pieces, r10 body, r15 painter, 19e look). SPRITE_SAMPLES=64."""
import math

from . import vending_r10 as R
from . import vending_r15 as V
from . import vending_r20 as W
from . import vending_r21 as X
from .vending_r19 import LOOKS as L19
from .vending_study import FP

ZT = R.TOP + 0.06                                                    # just above the flat top


def ribbon(k, pts, w0, w1, col):
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
        R.face(k, [(*left[i], ZT), (*right[i], ZT), (*right[i + 1], ZT), (*left[i + 1], ZT)], col, (0, 0, 1))


def livery_top(k):
    for pts, w0, w1 in (([(12.7, 6.0), (6, 1), (-2, -4.5), (-9, -10)], 8.0, 1.0),         # from the flat's edge
                        ([(12.7, -5.0), (8, -8.5), (3, -11.5)], 6.5, 1.0)):              # over the side
        ribbon(k, pts, w0, w1, "jzTeal")
    pen = [(12.7, 1.0), (1.0, -3.5), (6.5, -5.5), (-6.0, -10.5), (-2.5, -11.4)]
    ribbon(k, [(u + 0.6, v - 0.6) for u, v in pen], 1.2, 1.2, "jzMagenta")
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
            if style == "a":
                livery_top(k)
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


DESIGNS = {n: make(n) for n in ("vm1c22a", "vm1c22b", "vm1c22c")}


def jobs():
    return [(f"module.vending22.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
