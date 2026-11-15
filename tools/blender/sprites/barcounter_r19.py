"""Bar look study round 19 (families `barcounter19` and `barstool19`, palette set bar19, preview only; counter top 24
px, seat 15): three more colour and shape directions, each with its own palette; angles at 45 deg across the floor or
as whole-px steps, so they stay crisp in this view.

Counters (3x1):
  b1 console counter: warm grey, its front leaning back in whole-px steps like a cockpit console, a signal red
     stripe across it and a row of small amber lamps; a black top
  b2 column counter: three round plum columns, each with a gold collar, standing apart under
     one long pale lilac-grey top
  b3 lozenge counter: both ends cut to a point at 45 deg, its front banded sand over terracotta over deep green; a
     sand top cut to match
Stools (1x1): c1 black column, red seat; c2 gold pedestal, plum seat; c3 terracotta drum, green band, sand seat.

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r13 import mug
from .barcounter_r17 import diamond
from .barcounter_r3 import cyl
from .barcounter_study import SEAT, TOP
from .bunk_study import _px
from .research_kit import Bench

FP = (3, 1)
U0, U1, V0, V1 = -46, 46, -12, 4


# ---- counters ----------------------------------------------------------------------------------------------------
def b1():
    k = Bench("bar_b1", FP)
    _px(k, U0 + 2, U1 - 2, V0 + 2, V1 + 4, 0, 3, "q9Black")
    for i, z in enumerate(range(3, TOP - 3, 3)):                                     # the front leans back 1 px a step
        col = "q9Red" if z in (12, 15) else ("q9GreyL" if i % 2 else "q9Grey")
        _px(k, U0, U1, V0, V1 + 6 - i, z, z + 3, col)
    for u in range(U0 + 6, U1 - 4, 8):
        _px(k, u, u + 2, V1 + 1, V1 + 1.6, 19, 20, "q9Lamp")                           # amber lamps, on a step face
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 3, TOP, "q9Black")
    for u, col in ((-26, "r9Amber"), (14, "r9Blue")):
        mug(k, u, -4, col)
    return k.build()


def b2():
    k = Bench("bar_b2", FP)
    for u in (-30, 0, 30):
        cyl(k, u, -4, 0, 2, 8, "q9PlumD", sides=24)
        cyl(k, u, -4, 2, TOP - 4, 9, "q9Plum", sides=28)
        cyl(k, u, -4, TOP - 9, TOP - 7, 9.5, "q9Gold", sides=28)                     # gold collar
    _px(k, U0 - 1, U1 + 1, V0 - 2, V1 + 3, TOP - 4, TOP - 1, "q9PlumD")
    _px(k, U0 - 1, U1 + 1, V0 - 2, V1 + 3, TOP - 1, TOP, "q9Lilac")
    for u, col in ((-24, "r9Amber"), (20, "r9Ruby")):
        mug(k, u, -4, col)
    return k.build()


def b3():
    k = Bench("bar_b3", FP)
    H = (V1 - V0) / 2
    vc = (V0 + V1) / 2
    u0, u1 = U0 + H, U1 - H

    def lozenge(z0, z1, col, grow=0.0):
        _px(k, u0, u1, V0 - grow, V1 + grow, z0, z1, col)
        for u in (u0, u1):
            diamond(k, u, vc, z0, z1, H + grow * math.sqrt(2), col)
    lozenge(0, 3, "q9Black", grow=-2)
    for z0, z1, col in ((3, 10, "q9Green"), (10, 16, "q9Terra"), (16, TOP - 3, "q9Sand")):
        lozenge(z0, z1, col)
    for z in (10, 16):
        lozenge(z - 0.6, z, "q9Black", grow=0.4)                                     # dark seams between the bands
    lozenge(TOP - 3, TOP - 1, "q9Black", grow=1.5)
    lozenge(TOP - 1, TOP, "q9Sand", grow=1)
    for u, col in ((-22, "r9Amber"), (16, "r9Blue")):
        mug(k, u, -4, col)
    return k.build()


# ---- stools ------------------------------------------------------------------------------------------------------
def c1():
    k = Bench("stool_c1", (1, 1))
    _px(k, -5, 5, -5, 5, 0, 1, "q9Black")
    _px(k, -2, 2, -2, 2, 1, SEAT - 3, "q9Black")
    _px(k, -5, 5, -5, 5, SEAT - 3, SEAT, "q9Red")
    return k.build()


def c2():
    k = Bench("stool_c2", (1, 1))
    diamond(k, 0, 0, 0, 1, 6, "q9Gold")
    cyl(k, 0, 0, 1, SEAT - 3, 1.5, "q9Gold", sides=8)
    cyl(k, 0, 0, SEAT - 3, SEAT, 5.8, "q9Plum", sides=18)
    return k.build()


def c3():
    k = Bench("stool_c3", (1, 1))
    cyl(k, 0, 0, 0, SEAT - 2, 5.5, "q9Terra", sides=18)
    cyl(k, 0, 0, 4, 7, 5.8, "q9Green", sides=18)
    cyl(k, 0, 0, SEAT - 2, SEAT, 5.8, "q9Sand", sides=18)
    return k.build()


COUNTERS = {"b1": b1, "b2": b2, "b3": b3}
STOOLS = {"c1": c1, "c2": c2, "c3": c3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in COUNTERS.items()]


def stool_jobs():
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in STOOLS.items()]
