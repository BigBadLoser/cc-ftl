"""Vending machine look study, round 24 (family `vending24`, palette set vending, preview only): the red machine
back as a second variant beside the approved paper-cup one (user, 2026-11-14). Its livery is round 11b's: wine
with the cream front wrapping round the corners to round 10b's rising sweep on the side, and the side gradient
(near-black over the top 40%, eased to a lighter wine at the floor). Its front gets round 21a/23a's details: no
pane, 18% darker bright snack bags, two rows of cans (one flavour per column), keypad B moved off the corner,
pickup slot A. The back is round 3's locked back.

  vm1c24a the red machine

Then (user: "put the can on the side", round 3's can graphic): a soda can painted on the wine part of each side,
on the body's own faces (round 3's was stuck-on geometry), drawn as a cylinder side on: curved rims, a darker
back edge, a broad gently waving label band, no highlight stripe (a first take, a plain rounded rectangle with a
wide label, read as a blue and white card; any vertical highlight crossing the label read as a window frame).
  vm1c24b upright, in the upper wine · vm1c24c tilted, as if poured · vm1c24d upright with fizz bubbles above
  vm1c24e (user: "C, moved down, with D's bubbles") the tilted can lower, bigger bubbles rising off its top
Uses r10's body (holes as round 21), r11's gradient, r20/r21's front pieces. SPRITE_SAMPLES=64 for previews."""
import math

from . import vending_r10 as R
from . import vending_r15 as V
from . import vending_r20 as W
from . import vending_r21 as X
from .vending_r11 import ramp
from .vending_study import FP

CANS = {  # centre v, centre z, half width, half height, tilt (degrees, + leans the top to the back), bubbles
    "b": (-4.5, 42.0, 5.0, 15.0, 0, False),
    "c": (-4.0, 41.0, 5.0, 15.0, 18, False),
    "d": (-4.5, 38.0, 5.0, 13.5, 0, True),
    "e": (-5.5, 33.0, 5.0, 15.0, 18, True),
}
BUBBLES = [(-2.5, 55.0, 1.7), (-6.5, 58.0, 1.3), (-3.5, 61.5, 1.0)]


def can_paint(style):
    """A can drawn as a cylinder seen side on: curved rims top and bottom, dark at its back edge, a broad wavy cream
    label band; fizz bubbles off its top if asked."""
    cv, cz, hw, hh, tilt, bubbles = CANS[style]
    c, sn = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    if tilt:                                                                   # fizz rising off the can's top
        tv, tz = cv + hh * sn, cz + hh * c
        fizz = [(tv + 0.5, tz + 3.0, 1.9), (tv - 2.8, tz + 6.5, 1.5), (tv + 0.8, tz + 10.0, 1.1)]
    else:
        fizz = BUBBLES

    def paint(side, u, v, z):
        if side not in "RL":
            return None
        if bubbles and any(math.hypot(v - bv, z - bz) <= r for bv, bz, r in fizz):
            return "vmCreamL"
        dx, dz = v - cv, z - cz
        x, y = dx * c - dz * sn, dx * sn + dz * c                              # into the can's own frame
        if abs(x) > hw:
            return None
        xn = x / hw
        arc = math.sqrt(max(0.0, 1 - xn * xn))
        top, bot = hh - 1.2 + 1.2 * arc, -(hh - 1.2 + 1.2 * arc)               # curved rims
        if y > top or y < bot:
            return None
        if y > top - 1.8:
            return "vmAlu"                                                     # top rim
        if y > top - 2.4:
            return "vmAluD"                                                    # its lip
        if y < bot + 1.4:
            return "vmAluD"                                                    # base
        if abs(y - (1.0 + 1.2 * math.sin(xn * 2.2))) < 2.6:
            return "vmCreamL"                                                  # label band, a gentle wave
        if xn < -0.72:
            return "vmChipBD2"                                                 # back edge, turning away
        if xn > 0.84:
            return "vmChipBD1"                                                 # front edge
        return "vmChipB"
    return paint


def make(name):
    style = name[-1]
    paint = can_paint(style) if style in CANS else None

    def f():
        old = R.HOLES
        R.HOLES = X.HOLES
        try:
            k = V.Bench(f"vending_{name}", FP)
            R.body(k, R.WAVES["vm1c10b"], paint=paint)
            X.snacks(k, "D1")
            W.cans(k)
            X.keypad(k)
            W.tray(k, "a")
            R.back(k)
            out = R.build(k)
            ramp(k, out[0], -0.30, 0.50, 0.40)
            V.flat_top(out[0])
            return out
        finally:
            R.HOLES = old
    return f


DESIGNS = {n: make(n) for n in ("vm1c24a", "vm1c24b", "vm1c24c", "vm1c24d", "vm1c24e")}


def jobs():
    return [(f"module.vending24.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
