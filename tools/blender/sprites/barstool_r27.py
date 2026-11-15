"""Bar look study round 27 (family `barstool27`, palette sets bar22 + bar17 + bar9, preview only; seat 15 px): stools
for the O1 counter (round 26), in its materials: oxide leather, gunmetal, bone, black.

  s1 pedestal: a gunmetal foot and column, a black pan, a round oxide cushion with a lit rim
  s2 square: a square gunmetal foot, a bone column, a square oxide cushion lit along its top and camera-left edge,
     like the counter's panels
  s3 drum: a bone drum with a gunmetal band, an oxide cushion on top

All in px of the tile (u across, v deep, z up)."""
from .barcounter_r3 import cyl
from .barcounter_study import SEAT
from .bunk_study import _px
from .research_kit import Bench


def s1():
    k = Bench("stool_s1", (1, 1))
    cyl(k, 0, 0, 0, 1, 5, "x7Gun", sides=16)
    cyl(k, 0, 0, 1, SEAT - 4, 1.5, "r9Grey", sides=8)
    cyl(k, 0, 0, SEAT - 4, SEAT - 3, 5, "x7Black", sides=18)
    cyl(k, 0, 0, SEAT - 3, SEAT - 1, 6, "x7Oxide", sides=18)
    cyl(k, 0, 0, SEAT - 1, SEAT, 5, "k2OxideL", sides=18)
    return k.build()


def s2():
    k = Bench("stool_s2", (1, 1))
    _px(k, -5, 5, -5, 5, 0, 1, "x7Gun")
    _px(k, -1, 1, -1, 1, 1, SEAT - 4, "x7Bone")
    _px(k, -5, 5, -5, 5, SEAT - 4, SEAT - 3, "x7Black")
    _px(k, -5, 5, -5, 5, SEAT - 3, SEAT - 1, "x7Oxide")
    _px(k, -5, -4, -5, 5, SEAT - 3, SEAT - 1, "k2OxideL")                            # lit camera-left edge
    _px(k, -5, 5, -5, 5, SEAT - 1, SEAT, "k2OxideL")
    return k.build()


def s3():
    k = Bench("stool_s3", (1, 1))
    cyl(k, 0, 0, 0, 1, 5, "x7Black", sides=18)
    cyl(k, 0, 0, 1, SEAT - 3, 5, "x7Bone", sides=18)
    cyl(k, 0, 0, 5, 8, 5.3, "x7Gun", sides=18)
    cyl(k, 0, 0, SEAT - 3, SEAT - 1, 5.8, "x7Oxide", sides=18)
    cyl(k, 0, 0, SEAT - 1, SEAT, 5, "k2OxideL", sides=18)
    return k.build()


VARIANTS = {"s1": s1, "s2": s2, "s3": s3}


def jobs():
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in VARIANTS.items()]
