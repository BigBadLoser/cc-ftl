"""Vending machine look study, round 7 (family `vending7`, palette set vending, preview only): the wave as a split
side (the user's pick of the suggestions, 2026-11-13). Round 6's wave was four loose strokes that read as separate
marks at this size; here the wave is the boundary between two big fields: the side is light cream in front of an
S-curve and wine behind it, with a thin yellow pinstripe on the boundary. The cream is a lighter shade (vmCreamL) so
it stays cream, not grey, on the shaded side. Locked back and VM1C front as before.

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
from . import core
from .exercise_r4 import build, spline, sweep
from .research_kit import ZPX, Bench
from .vending_r3 import SIDE, back, front
from .vending_study import FP

X = (1.0, 0.0, 0.0)
FRONT = 9.8                                                                      # the flat of the side ends here
WAVE = [(1, 4), (4, 2), (16, 0), (30, -10), (42, -11), (54, -1), (65, 2)]        # (z, v) of the boundary


def split(k, s):
    u = s * (SIDE + 0.3)
    edge = [(v, z) for z, v in spline(WAVE, 12)]                                  # bottom to top along the wave
    outline = edge + [(FRONT, WAVE[-1][0]), (FRONT, WAVE[0][0])]
    pts = [core.G(*k.p(u / 32, v / 32), z / ZPX) for v, z in outline]
    k.m.poly(pts, "vmCreamL", flip=s < 0)                                        # cream field: one flat face
    # (a loft or stacked courses of the field shaded unevenly; a single flat face takes one tone)
    sweep(k, [(s * (SIDE + 0.25), v, z, 0.3, 0.75) for z, v in WAVE[1:]], "vmItemY", p=3, n=12, steps=10,
          side=X)                                                                  # pinstripe on the boundary


def vm1c7():
    k = Bench("vending_vm1c7", FP)
    front(k)
    back(k)
    for s in (-1, 1):
        split(k, s)
    return build(k)


DESIGNS = {"vm1c7": vm1c7}


def jobs():
    return [(f"module.vending7.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
