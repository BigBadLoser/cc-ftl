"""Vending machine look study, round 14 (family `vending14`, palette set vending, preview only): variants of round
13's cup (user, 2026-11-13: "cup is pretty good"), white with teal brush strokes and a purple scribble with a
magenta shadow, on round 10's body with the soft side gradient.

  vm1c14a bold cup: the cup's climb with fatter, overlapping strokes and a bigger looping scribble
  vm1c14b falling cup: the strokes slope down to the back like the reference, two scribbles
  vm1c14c full wrap: the pattern runs round the whole machine, over the front too; the windows, keypad, sign
          and tray are cut into it and the glass, cans and keys sit in front of it

The wrap coordinate s is r13's (px round the outside from the middle of the front). a and b mirror it on the -u
half and keep the front clean; c uses it signed, so one pattern runs from the left side across the front to the
right side and meets itself at the middle of the back. Previews render with SPRITE_SAMPLES=64 (see r13)."""
from . import vending_r10 as R
from .research_kit import Bench
from .vending_r11 import ramp
from .vending_r13 import FVF, flat_top, scribble, shifted, stroke, wrap
from .vending_study import FP

T, P, M = "jzTeal", "jzPurple", "jzMagenta"
LOOKS = {
    "vm1c14a": dict(
        strokes=[([(44, 0), (30, 10), (12, 23)], 16.0, 5.0),
                 ([(45, 21), (31, 31), (12, 45)], 17.0, 5.0),
                 ([(43, 43), (30, 52), (14, 63)], 13.0, 4.0)],
        lines=[[(41, 4), (33, 11), (28, 17), (32, 21), (37, 19), (33, 25), (25, 33), (19, 38), (16, 43),
                (20, 47), (26, 45), (23, 51), (16, 59)]]),
    "vm1c14b": dict(
        strokes=[([(13, 62), (27, 55), (43, 45)], 13.0, 4.0),
                 ([(12, 41), (27, 33), (44, 22)], 14.0, 4.0),
                 ([(16, 18), (29, 11), (43, 2)], 11.0, 3.5)],
        lines=[[(14, 52), (23, 47), (28, 43), (25, 40), (21, 42), (26, 45), (34, 39), (40, 33)],
               [(18, 27), (26, 23), (31, 19), (28, 16), (24, 18), (29, 21), (36, 15), (41, 9)]]),
    "vm1c14c": dict(
        full=True,
        strokes=[([(46, 2), (32, 11), (16, 20)], 14.0, 4.0),
                 ([(14, 4), (0, 12), (-16, 21)], 13.0, 4.0),
                 ([(-20, 6), (-34, 14), (-48, 22)], 12.0, 4.0),
                 ([(44, 27), (30, 36), (13, 46)], 15.0, 4.0),
                 ([(12, 30), (-3, 39), (-20, 48)], 14.0, 4.0),
                 ([(-22, 32), (-36, 40), (-50, 49)], 13.0, 4.0),
                 ([(42, 50), (30, 57), (17, 64)], 11.0, 3.5),
                 ([(10, 55), (-2, 61), (-14, 66)], 9.0, 3.0),
                 ([(-24, 56), (-36, 62), (-48, 66)], 9.0, 3.0)],
        lines=[[(44, 8), (34, 15), (28, 20), (31, 24), (36, 22), (30, 28), (18, 33), (8, 36), (2, 40), (6, 44),
                (11, 42), (6, 48), (-6, 51), (-16, 53), (-22, 57), (-18, 60), (-13, 58), (-20, 63)],
               [(-46, 10), (-38, 16), (-32, 20), (-35, 24), (-40, 22), (-34, 28), (-26, 32)]]),
}


def painter(look):
    strokes = [stroke(line, w0, w1, i * 7) for i, (line, w0, w1) in enumerate(look["strokes"])]
    inks = [scribble(line) for line in look["lines"]]
    shadows = [scribble(shifted(line, 1.0, -1.0)) for line in look["lines"]]
    full = look.get("full", False)

    def paint(side, u, v, z):
        if side == "F" and R.SIGN[0] < u < R.SIGN[1] and R.SIGN[2] < z < R.SIGN[3]:
            return "vmSign"
        if side == "F" and R.DIVIDER[0] < u < R.DIVIDER[1] and R.DIVIDER[2] < z < R.DIVIDER[3]:
            return P
        if z > R.CREAM_TOP:
            return "jzWhite"
        if not full and u < 0 and v >= FVF:
            return "jzWhite"                                                       # the front stays clean
        s = wrap(u, v) if full else abs(wrap(u, v))
        if any(hit(s, z) for hit in inks):
            return P
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
    return [(f"module.vending14.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
