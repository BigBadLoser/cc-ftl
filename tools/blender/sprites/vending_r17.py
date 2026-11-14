"""Vending machine look study, round 17 (family `vending17`, palette set vending, preview only): round 16c (rising
zigzag wrap; user's pick, 2026-11-13) with taller teal teeth for more coverage and more white between neighbouring
teal teeth (fewer or narrower teeth, a thinner stroke back up between them). The pen line stays as 16c's (a first
take of this round opened the pen's hairpins instead; the user meant the teal).

  vm1c17a six teeth 60..10, narrower (13), thin stroke back up
  vm1c17b five teeth 60..10 (wider spacing), width 15
  vm1c17c five teeth 62..6, width 14, a longer run down

Uses r16's ribbon and pen and r15's painter. Previews render with SPRITE_SAMPLES=64."""
from . import vending_r15 as V
from .vending_r16 import pen, teeth
from .vending_study import FP

PEN = pen(5, 45, 46, 25, 29, d=-1)                      # 16c's, unchanged
LOOKS = {
    "vm1c17a": dict(strokes=teeth(6, 40, 60, 10, 27, 13, 5, d=-1), lines=[PEN]),
    "vm1c17b": dict(strokes=teeth(5, 40, 60, 10, 29, 15, 6, d=-1), lines=[PEN]),
    "vm1c17c": dict(strokes=teeth(5, 40, 62, 6, 32, 14, 5, d=-1), lines=[PEN]),
}


def make(name):
    V.LOOKS[name] = LOOKS[name]
    return V.make(name)


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending17.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
