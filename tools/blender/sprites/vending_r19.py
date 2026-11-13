"""Vending machine look study, round 19 (family `vending19`, palette set vending, preview only): round 18a (user's
pick, 2026-11-13) with slight variants of the purple pen line; the teal is 18a's.

  vm1c19a a taller swing (50..22), the same five switchbacks
  vm1c19b four switchbacks with longer runs (33 on), 18a's swing
  vm1c19c 18a's line drawn thicker, its magenta shadow sitting lower

Uses r18's ribbon and sharp pen and r15's painter. Previews render with SPRITE_SAMPLES=64."""
from . import vending_r15 as V
from .vending_r16 import pen
from .vending_r18 import sharp, teeth
from .vending_study import FP

TEAL = teeth(6, 40, 60, 10, 27, 15, 5, d=-1)             # 18a's
LOOKS = {
    "vm1c19a": dict(strokes=TEAL, lines=[sharp(pen(5, 45, 50, 22, 29, d=-1))]),
    "vm1c19b": dict(strokes=TEAL, lines=[sharp(pen(4, 45, 46, 25, 33, d=-1))]),
    "vm1c19c": dict(strokes=TEAL, lines=[sharp(pen(5, 45, 46, 25, 29, d=-1))], half=0.95, shadow=(0.6, -1.4)),
}


def make(name):
    V.LOOKS[name] = LOOKS[name]
    return V.make(name)


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending19.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
