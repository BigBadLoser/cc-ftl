"""Vending machine look study, round 6 (family `vending6`, palette set vending, preview only): round 4's wave
(VM1C5, the user's pick, 2026-11-13) exactly as drawn, without its broken pixels. Round 4's yellow and blue bands
were under a pixel wide, so they came out dotted, and they sat at the cream band's own depth, so where they crossed
it they cut notches in it. Here the thin bands are a little wider and stand proud of the cream, and every band is
lofted with more steps so its edges step evenly; the back-most points come in a pixel so they stay
on the flat of the side, off the cheek's rounded back corner. The upper blue band, a straight upright in
round 4, curves along the cream's upper sweep (user, 2026-11-13). Locked back and VM1C front as before.

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
from .exercise_r4 import build, sweep
from .research_kit import Bench
from .vending_r3 import SIDE, back, front
from .vending_study import FP

X = (1.0, 0.0, 0.0)


def band(k, s, pts, w, col, proud):
    u = s * (SIDE + proud)
    sweep(k, [(u, v, z, 0.3, w) for v, z in pts], col, p=3, n=12, steps=14, side=X)


def wave(k, s):
    band(k, s, [(6, 4), (4, 16), (-6, 30), (-8, 42), (2, 54), (4.5, 62)], 3.2, "vmCream", 0.0)
    band(k, s, [(1.5, 4), (-0.5, 15), (-10, 30), (-11, 42), (-2.5, 55), (0, 63)], 1.4, "vmItemY", 0.25)
    band(k, s, [(-2, 4), (-5, 14), (-11.8, 26)], 1.2, "vmItemB", 0.25)
    band(k, s, [(-0.5, 39), (3.5, 46), (6.8, 54), (7.8, 62)], 1.2, "vmItemB", 0.25)   # curved with the cream


def vm1c5():
    k = Bench("vending_vm1c5r", FP)
    front(k)
    back(k)
    for s in (-1, 1):
        wave(k, s)
    return build(k)


DESIGNS = {"vm1c5r": vm1c5}


def jobs():
    return [(f"module.vending6.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
