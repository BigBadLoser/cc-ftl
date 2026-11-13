"""Vending machine look study, round 8 (family `vending8`, palette set vending, preview only): suggestion 1 (the
user's pick, 2026-11-13, after the split side): one continuous ribbon. The cream S of round 4's wave (its swing eased
a little so the edges stay on the flat of the side) in the lighter side cream, with a yellow band along its back edge
and a blue band along its front edge, both following the ribbon at a fixed perpendicular distance for the full
height. Locked back and VM1C front as before.

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
import math

from .exercise_r4 import build, spline, sweep
from .research_kit import Bench
from .vending_r3 import SIDE, back, front
from .vending_study import FP

X = (1.0, 0.0, 0.0)
CENTRE = [(v * 0.85 - 0.15, z) for v, z in ((6, 4), (4, 16), (-6, 30), (-8, 42), (2, 54), (4.5, 62))]
W, EDGE, GAP = 2.8, 0.75, 0.05                    # ribbon half width, edge band half width, gap between them


def offset(d):
    """The centre S moved d px square to it (in the side's plane), sampled densely."""
    pts = spline(CENTRE, 12)
    out = []
    for i, (v, z) in enumerate(pts):
        (v0, z0), (v1, z1) = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        ln = math.hypot(v1 - v0, z1 - z0) or 1
        out.append((v + d * (z1 - z0) / ln, z - d * (v1 - v0) / ln))
    return out[::3] + ([out[-1]] if (len(out) - 1) % 3 else [])


def band(k, s, pts, w, col, proud):
    sweep(k, [(s * (SIDE + proud), v, z, 0.3, w) for v, z in pts], col, p=3, n=12, steps=6, side=X)


def ribbon(k, s):
    band(k, s, offset(0), W, "vmCreamL", 0.0)
    band(k, s, offset(-(W + GAP + EDGE)), EDGE, "vmItemY", 0.2)                  # back edge
    band(k, s, offset(W + GAP + EDGE), EDGE, "vmItemB", 0.2)                     # front edge


def vm1c8():
    k = Bench("vending_vm1c8", FP)
    front(k)
    back(k)
    for s in (-1, 1):
        ribbon(k, s)
    return build(k)


DESIGNS = {"vm1c8": vm1c8}


def jobs():
    return [(f"module.vending8.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
