"""Vending machine look study, round 12 (family `vending12`, palette set vending, preview only): new shapes for the
cream/wine edge on the side (user, 2026-11-13), on round 11's body and its side gradient (near-black over the top
40%, eased down to a lighter wine at the floor).

  vm1c12a diagonal swoosh: from the bottom of the back corner up to the top of the front corner, an S that runs
          steep at both corners and flattens through the middle
  vm1c12b arrowhead: the cream comes to a point aimed at the back, halfway up
  vm1c12c fin: the cream stands straight up the lower half, then kinks forward to the top, a yellow pinstripe along
          the edge

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera. Edge values are v on the side: cream
where v is at or forward of the edge (the back corner is v -14.1, the flat side runs -10.6..7.6, the front 11.1)."""
from . import vending_r10 as R
from .research_kit import Bench
from .vending_r11 import ramp
from .vending_study import FP

GRADIENT = (-0.30, 0.50, 0.40)
EDGES = {  # (z, edge v) control points, and whether a pinstripe runs along the edge
    "vm1c12a": ([(0, -14.6), (9, -13.4), (22, -9), (33, -1.5), (44, 5), (57, 8.8), (66, 10.6)], False),
    "vm1c12b": ([(0, 7.5), (14, 1), (28, -7.5), (33, -9.5), (38, -7.5), (52, 1), (66, 7.5)], False),
    "vm1c12c": ([(0, -5.5), (26, -5.5), (31, -4.6), (36, -1.5), (50, 5.5), (60, 7.6), (66, 8)], True),
}


def make(name):
    def f():
        edge, stripe = EDGES[name]
        k = Bench(f"vending_{name}", FP)
        R.body(k, edge, stripe=stripe, kick=False)
        R.contents(k)
        R.back(k)
        out = R.build(k)
        ramp(k, out[0], *GRADIENT)
        return out
    return f


DESIGNS = {n: make(n) for n in EDGES}


def jobs():
    return [(f"module.vending12.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
