"""Vending machine look study, round 24 (family `vending24`, palette set vending, preview only): the red machine
back as a second variant beside the approved paper-cup one (user, 2026-11-14). Its livery is round 11b's: wine
with the cream front wrapping round the corners to round 10b's rising sweep on the side, and the side gradient
(near-black over the top 40%, eased to a lighter wine at the floor). Its front gets round 21a/23a's details: no
pane, 18% darker bright snack bags, two rows of cans (one flavour per column), keypad B moved off the corner,
pickup slot A. The back is round 3's locked back.

  vm1c24a the red machine

Uses r10's body (holes as round 21), r11's gradient, r20/r21's front pieces. SPRITE_SAMPLES=64 for previews."""
from . import vending_r10 as R
from . import vending_r15 as V
from . import vending_r20 as W
from . import vending_r21 as X
from .vending_r11 import ramp
from .vending_study import FP


def make(name):
    def f():
        old = R.HOLES
        R.HOLES = X.HOLES
        try:
            k = V.Bench(f"vending_{name}", FP)
            R.body(k, R.WAVES["vm1c10b"])
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


DESIGNS = {n: make(n) for n in ("vm1c24a",)}


def jobs():
    return [(f"module.vending24.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
