"""Vending machine look study, round 5 (family `vending5`, palette set vending, preview only): VM1C5's wave side art
(the user liked it, 2026-11-13) cleaned up. Round 4's bands each had their own curve, so they wandered apart and the
blue broke into two loose pieces. Here every band follows one smooth centre S-curve at a fixed sideways offset, runs
the full height of the side (from just above the floor to just under the header) and stays clear of the front edge.
Locked back (vending_r3.back) and VM1C front as before.

  vm1c5a ribbons: a cream band with a thin yellow band behind and a thin blue band in front, all parallel
  vm1c5b tapered: the same three bands, each narrowing to a point at both ends
  vm1c5c bold: a wider cream band and a solid blue band, with a yellow pinstripe between them

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
from .exercise_r4 import build, sweep
from .research_kit import Bench
from .vending_r3 import SIDE, back, front
from .vending_study import FP

X = (1.0, 0.0, 0.0)
CURVE = [(3.5, 2), (3, 14), (-4.5, 28), (-6, 40), (0.5, 53), (2.5, 64)]   # (v, z) of the centre S


def band(k, s, dv, w, col, t=0.3, taper=False):
    u = s * (SIDE + t - 0.3)
    n = len(CURVE)
    pts = []
    for i, (v, z) in enumerate(CURVE):
        f = 1.0
        if taper:
            f = (0.25, 0.75, 1.0, 1.0, 0.75, 0.25)[i] if n == 6 else 1.0
        pts.append((u, v + dv, z, 0.3, w * f))
    sweep(k, pts, col, p=3, n=12, steps=10, side=X)


def art_a(k, s):
    band(k, s, 0, 2.6, "vmCream")
    band(k, s, -4.4, 0.75, "vmItemY", t=0.35)
    band(k, s, 4.2, 0.75, "vmItemB", t=0.35)


def art_b(k, s):
    band(k, s, 0, 2.8, "vmCream", taper=True)
    band(k, s, -4.6, 0.9, "vmItemY", t=0.35, taper=True)
    band(k, s, 4.4, 0.9, "vmItemB", t=0.35, taper=True)


def art_c(k, s):
    band(k, s, 0.8, 3.2, "vmCream")
    band(k, s, -5.2, 1.5, "vmItemB", t=0.35)
    band(k, s, -2.9, 0.4, "vmItemY", t=0.4)


ARTS = {"vm1c5a": art_a, "vm1c5b": art_b, "vm1c5c": art_c}


def make(name, art):
    def f():
        k = Bench(f"vending_{name}", FP)
        front(k)
        back(k)
        for s in (-1, 1):
            art(k, s)
        return build(k)
    return f


DESIGNS = {n: make(n, a) for n, a in ARTS.items()}


def jobs():
    return [(f"module.vending5.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
