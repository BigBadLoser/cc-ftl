"""Vending machine look study, round 21 (family `vending21`, palette set vending, preview only): round 20 with the
user's picks (2026-11-13): 20a's pickup slot (flap half way in) and 20b's keypad (four big keys, coin slot,
screen). The keypad moves in from the corner (its recess ran to within 0.6 px of the corner, so it seemed to wrap
round it): 5.8..9.8 instead of 6.6..11.2. The snack bags go back to the bright chip colours, darker (the muted set
looked bad), in three steps:

  vm1c21a bags 18% darker · vm1c21b 30% darker · vm1c21c 42% darker

The user picked 21a and asked for the glints on the snack window to go (they read as a white stain): no glass
marks at all now.

Uses round 20's front pieces, r10's body with its holes swapped while building, r15's painter and 19e's look."""
from . import vending_r10 as R
from . import vending_r15 as V
from . import vending_r20 as W
from .vending_r19 import LOOKS as L19
from .vending_study import FP

VF = R.VF
PAD = (5.8, 9.8, 33.0, 47.0, 0.8)                                    # u0, u1, z0, z1, depth
HOLES = [h for h in W.HOLES if h[1] != 6.6] + [("F", PAD[0], PAD[1], PAD[2], PAD[3], PAD[4], "vmPanel")]
DARK = {"a": "D1", "b": "D2", "c": "D3"}


def snacks(k, step):
    bags = [f"vmChip{c}{step}" for c in "RYBGOP"]
    v = VF - 2.0
    for row, z in enumerate((30.0, 37.0, 44.0, 51.0)):
        W.bx(k, -11.2, 4.8, v, v + 1.6, z - 0.6, z, "vmAluD")                    # shelf lip
        for j, u in enumerate((-9.2, -5.3, -1.4, 2.5)):
            col = bags[(row * 2 + j * 3 + row // 2) % len(bags)]
            W.bx(k, u - 1.5, u + 1.5, v + 0.1, v + 1.1, z + 0.4, z + 4.6, col, top="vmCreamL")


def keypad(k):
    back = VF - 0.8
    W.bx(k, 6.2, 9.4, back, back + 0.3, 42.8, 45.6, "vmScreen")
    W.bx(k, 7.3, 8.3, back, back + 0.4, 40.6, 41.2, "vmDark")                    # coin slot
    for u, z in [(u, z) for z in (34.0, 37.0) for u in (6.85, 8.75)]:
        W.bx(k, u - 0.85, u + 0.85, back, back + 0.6, z, z + 2.2, "vmAlu", top="vmCreamL")


def make(name):
    step = DARK[name[-1]]
    look = dict(L19["vm1c19e"])

    def f():
        old = R.HOLES
        R.HOLES = HOLES
        try:
            k = V.Bench(f"vending_{name}", FP)
            remap = {"vmWine": "jzWhite", "vmWineD": "jzGrey", "vmCreamD": "jzGrey", "vmCream": "jzWhite"}
            poly = k.m.poly
            k.m.poly = lambda pts, color, flip=False: poly(pts, remap.get(color, color), flip=flip)
            R.body(k, R.WAVES["vm1c10b"], paint=V.painter(look))
            snacks(k, step)
            W.cans(k)
            keypad(k)
            W.tray(k, "a")
            R.back(k)
            out = R.build(k)
            V.ramp(k, out[0], -0.12, 0.35, 0.40, pick=lambda r, g, b: True)
            V.flat_top(out[0])
            return out
        finally:
            R.HOLES = old
    return f


DESIGNS = {n: make(n) for n in ("vm1c21a", "vm1c21b", "vm1c21c")}


def jobs():
    return [(f"module.vending21.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
