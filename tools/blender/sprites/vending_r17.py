"""Vending machine look study, round 17 (family `vending17`, palette set vending, preview only): round 16c (rising
zigzag wrap; user's pick, 2026-11-13) with taller teal teeth for more coverage, and more room between the pen
line's runs either side of a switchback (they ran nearly parallel and close on the side): the run back up is
shorter and steeper, so the hairpins open wider.

  vm1c17a teeth 60..10, pen runs 25 on (back 4)
  vm1c17b teeth 62..6 and wider, pen runs 23 on (back 2)
  vm1c17c teeth 60..8 and widest, pen runs 23 on over a taller swing (50..21)

Uses r16's ribbon and pen and r15's painter. Previews render with SPRITE_SAMPLES=64."""
from . import vending_r15 as V
from .vending_r16 import pen, teeth
from .vending_study import FP

LOOKS = {
    "vm1c17a": dict(strokes=teeth(6, 40, 60, 10, 27, 15, 8, d=-1), lines=[pen(5, 45, 46, 25, 25, d=-1)]),
    "vm1c17b": dict(strokes=teeth(6, 40, 62, 6, 27, 17, 9, d=-1), lines=[pen(5, 45, 46, 25, 23, d=-1)]),
    "vm1c17c": dict(strokes=teeth(6, 40, 60, 8, 28, 19, 10, d=-1), lines=[pen(5, 45, 50, 21, 23, d=-1)]),
}


def make(name):
    V.LOOKS[name] = LOOKS[name]
    return V.make(name)


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending17.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
