"""Vending machine look study, round 23 (family `vending23`, palette set vending, preview only): 21a with the
livery carried over the roof, after the user asked for my own read of round 22's roofs (the teal was a ragged blob
that stopped short of every edge, too small and busy next to the side's big teeth, and the pen line came out as two
stacked little zigzags). Here:

- the roof pattern is one 2D picture over the whole top, painted both on the body's own faces above the side
  (the band and the rounded edge, so it runs over the edge with no seam) and, on the flat, as small square decal
  cells just above it;
- two big strokes at the side's scale, parallel, both coming in off the right side's edge (so they continue the
  side) and tapering across to the left, white between them (a first layout had one from the right edge and one
  from the front edge; on screen they met at the top like a bow tie);
- one pen line in a Z whose long runs cross the strokes on the diagonal, rounded at its turns, drawn 2 px wide
  (at 1.3 px it broke into dashes on the roof), its magenta shadow beside it.

  vm1c23a the two strokes and the Z
  vm1c23b wider strokes
  vm1c23c the pen line as a looser S

Uses round 21's machine (r20/r21 front pieces, r10 body, r15 painter, 19e look). SPRITE_SAMPLES=64."""
from . import vending_r10 as R
from . import vending_r15 as V
from . import vending_r20 as W
from . import vending_r21 as X
from .vending_r13 import scribble, shifted, stroke
from .vending_r19 import LOOKS as L19
from .vending_study import FP

ZT = R.TOP + 0.06
CELL = 0.5
T1 = [(18.0, 0.5), (3.0, 4.0), (-13.5, 8.0)]                          # in from the right side's edge, to the
T2 = [(18.0, -10.5), (3.0, -7.0), (-13.5, -3.0)]                       # left; two parallel strokes
Z = [(12.0, 7.5), (-3.0, -3.5), (5.0, -3.5), (-10.0, -11.0)]           # a Z crossing them on the diagonal
S = [(13.0, 6.5), (-2.0, -2.0), (6.0, -4.5), (-9.0, -11.5)]
ROOFS = {  # teal (points, start width, end width), pen line, pen half width
    "a": ([(T1, 13, 3), (T2, 13, 3)], Z, 0.8),
    "b": ([(T1, 16, 4), (T2, 16, 4)], Z, 0.8),
    "c": ([(T1, 13, 3), (T2, 13, 3)], S, 0.85),
}


def roof_picture(style):
    strokes, pen, half = ROOFS[style]
    teal = [stroke(line, w0, w1, i * 5, 0.02) for i, (line, w0, w1) in enumerate(strokes)]
    ink, shadow = scribble(pen, half), scribble(shifted(pen, 0.9, -0.9), half)

    def at(u, v):
        if ink(u, v):
            return "jzPurple"
        if shadow(u, v):
            return "jzMagenta"
        if any(hit(u, v) for hit in teal):
            return "jzTeal"
        return None
    return at


def decals(k, at):
    """The picture on the roof's flat, as small cells just above it."""
    a, b = R.A - R.RT, R.B - R.RT
    n_u, n_v = int(2 * a / CELL), int(2 * b / CELL)
    for i in range(n_u):
        for j in range(n_v):
            u0, v0 = -a + i * CELL, R.CY - b + j * CELL
            col = at(u0 + CELL / 2, v0 + CELL / 2)
            if col:
                R.face(k, [(u0, v0, ZT), (u0 + CELL, v0, ZT), (u0 + CELL, v0 + CELL, ZT), (u0, v0 + CELL, ZT)],
                       col, (0, 0, 1))


def make(name):
    style = name[-1]
    look = dict(L19["vm1c19e"])
    at = roof_picture(style)

    def f():
        old = R.HOLES
        R.HOLES = X.HOLES
        try:
            k = V.Bench(f"vending_{name}", FP)
            remap = {"vmWine": "jzWhite", "vmWineD": "jzGrey", "vmCreamD": "jzGrey", "vmCream": "jzWhite"}
            poly = k.m.poly
            k.m.poly = lambda pts, color, flip=False: poly(pts, remap.get(color, color), flip=flip)
            paint = V.painter(look)

            def body_paint(side, u, v, z):
                if z > R.CREAM_TOP:
                    return at(u, v) or "jzWhite"                                    # the band and the edge
                return paint(side, u, v, z)
            R.body(k, R.WAVES["vm1c10b"], paint=body_paint)
            X.snacks(k, "D1")
            W.cans(k)
            X.keypad(k)
            W.tray(k, "a")
            decals(k, at)
            R.back(k)
            out = R.build(k)
            V.ramp(k, out[0], -0.12, 0.35, 0.40, pick=lambda r, g, b: True)
            V.flat_top(out[0])
            return out
        finally:
            R.HOLES = old
    return f


DESIGNS = {n: make(n) for n in ("vm1c23a", "vm1c23b", "vm1c23c")}


def jobs():
    return [(f"module.vending23.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
