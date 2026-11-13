"""Vending machine look study, round 15 (family `vending15`, palette set vending, preview only): the bold cup
(round 14a, user's pick, 2026-11-13) wrapped round the whole machine. The user's note on 14c: front and side art
were separate pieces; here every stroke and the scribble are single long pieces that run from the side round the
corner across the front (windows, keypad, sign and tray cut into them) and on round the far side and the back,
meeting themselves seamlessly where they cross the back (the pattern repeats once round the outside, period P).
A first try with level bands round the whole body read as stripes; the strokes are separate tapered pieces again.

The scribble is a trochoid: a point circling while it travels along a base line, so it loops like the reference's
pen line.

  vm1c15a rising: the bold cup's climb; its strokes run from the back of the right side round the corner and taper
          out across the front, more start on the front and run onto the left side
  vm1c15b falling: the reference's direction, the same pieces sloping down towards the back of the right side
  vm1c15c big: one huge stroke round the corner, two smaller ones, a long looping scribble and a short one

Uses r13's wrap coordinate signed (px round the outside from the middle of the front, + towards the right side).
Previews render with SPRITE_SAMPLES=64 (see r13)."""
import math

from . import vending_r10 as R
from .research_kit import Bench
from .vending_r11 import ramp
from .vending_r13 import ARC, FVB, FVF, flat_top, scribble, shifted, stroke, wrap
from .vending_study import FP

P = 4 * R.FU + 2 * (FVF - FVB) + 4 * ARC                 # once round the outside
T, PU, M = "jzTeal", "jzPurple", "jzMagenta"


def trochoid(p0, p1, loops, r, n=160):
    (s0, z0), (s1, z1) = p0, p1
    return [(s0 + (s1 - s0) * t + r * math.cos(2 * math.pi * loops * t + 1.2),
             z0 + (z1 - z0) * t + r * math.sin(2 * math.pi * loops * t + 1.2)) for t in (i / n for i in range(n + 1))]


def band(z, rise, w0, w1, wave=0.0, start=50.0):
    """A stroke once round: from s=start going the long way to start-P, climbing `rise` (and waving)."""
    pts = [(start - P * i / 8, z + rise * i / 8 + wave * math.sin(i * 1.7 + z)) for i in range(9)]
    return (pts, w0, w1)


LOOKS = {  # strokes climb about 0.75 px per px of wrap (the bold cup's slope) and taper within ~45 px
    "vm1c15a": dict(strokes=[([(46, -4), (32, 7), (18, 18), (5, 28)], 17, 3),
                             ([(47, 19), (33, 30), (19, 41), (6, 51)], 18, 3),
                             ([(45, 42), (32, 52), (19, 62), (8, 70)], 14, 3),
                             ([(-4, 4), (-17, 14), (-30, 24), (-44, 34)], 15, 3),
                             ([(-3, 34), (-16, 44), (-29, 54), (-43, 64)], 15, 3)],
                    lines=[trochoid((44, 6), (4, 50), 3, 4.2), trochoid((-6, 14), (-42, 46), 2.5, 4.0)]),
    "vm1c15b": dict(strokes=[([(4, 66), (17, 56), (31, 46), (45, 35)], 14, 3),
                             ([(5, 44), (18, 34), (32, 24), (46, 13)], 18, 3),
                             ([(6, 21), (19, 11), (33, 1), (46, -9)], 16, 3),
                             ([(-44, 60), (-30, 50), (-17, 40), (-4, 30)], 15, 3),
                             ([(-44, 30), (-30, 20), (-17, 10), (-4, 0)], 15, 3)],
                    lines=[trochoid((4, 56), (44, 14), 3, 4.2), trochoid((-42, 52), (-6, 20), 2.5, 4.0)]),
    "vm1c15c": dict(strokes=[([(48, 0), (36, 12), (24, 25), (12, 37), (0, 47)], 24, 4),
                             ([(46, 42), (34, 52), (22, 61), (11, 69)], 16, 3),
                             ([(-2, 6), (-16, 17), (-30, 28), (-46, 38)], 16, 3)],
                    lines=[trochoid((44, 30), (2, 62), 3, 4.6), trochoid((44, 2), (16, 16), 1.5, 3.5)]),
}


def periodic(hit):
    return lambda s, z: hit(s, z) or hit(s + P, z) or hit(s - P, z)


def painter(look):
    strokes = [periodic(stroke(line, w0, w1, i * 7, *rest))
               for i, (line, w0, w1, *rest) in enumerate(look["strokes"])]
    inks = [periodic(scribble(line)) for line in look["lines"]]
    shadows = [periodic(scribble(shifted(line, 1.0, -1.0))) for line in look["lines"]]

    def paint(side, u, v, z):
        if side == "F" and R.SIGN[0] < u < R.SIGN[1] and R.SIGN[2] < z < R.SIGN[3]:
            return "vmSign"
        if side == "F" and R.DIVIDER[0] < u < R.DIVIDER[1] and R.DIVIDER[2] < z < R.DIVIDER[3]:
            return PU
        if z > R.CREAM_TOP:
            return "jzWhite"
        s = wrap(u, v)
        if any(hit(s, z) for hit in inks):
            return PU
        if any(hit(s, z) for hit in shadows):
            return M
        if any(hit(s, z) for hit in strokes):
            return T
        return "jzWhite"
    return paint


def make(name):
    look = LOOKS[name]

    def f():
        k = Bench(f"vending_{name}", FP)
        remap = {"vmWine": "jzWhite", "vmWineD": "jzGrey", "vmCreamD": "jzGrey", "vmCream": "jzWhite"}
        poly = k.m.poly
        k.m.poly = lambda pts, color, flip=False: poly(pts, remap.get(color, color), flip=flip)
        R.body(k, R.WAVES["vm1c10b"], paint=painter(look))
        R.contents(k)
        R.back(k)
        out = R.build(k)
        ramp(k, out[0], -0.12, 0.35, 0.40, pick=lambda r, g, b: True)
        flat_top(out[0])
        return out
    return f


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending15.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
