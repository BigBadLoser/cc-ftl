"""Bar look study round 15 (families `barcounter15` and `barstool15`, palette set bar9, preview only; counter top 24
px, seat 15): the counter and the stools split into two modules, so the counter doubles as a shop counter. The used
freighter look, freestanding, to the kit's craft rules (whole-px edges, detail as flush bands, stepped curves).

Counters (3x1, the module's one row of tiles; the crew stand or sit in the row in front):
  t1 padded counter: round ends, tuck-and-roll front over a lit kick, a dark lip and tan top
  t2 plated counter: bolted hull plates with a painted hazard band, a corrugated kick, a rubber bumper along the
     front, and a raised back ledge along the top
  t3 display counter: channel-quilted front, its tan top running down the right end to the floor as one slab; at the
     left end a lit glass display case set into the counter
Stools (1x1):
  u1 pedestal stool: a foot, a column, a padded seat with a lit rim
  u2 square stool: a square padded seat on a square column, a foot ring
  u3 drum stool: a metal cargo drum, two rolling hoops and a painted band, a padded top

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r13 import mug, side_bands, stool as pedestal
from .barcounter_r3 import cyl
from .barcounter_study import SEAT, TOP
from .barkit import ROLL, bands, kick, panel, panel_seams, stencil, top_lip
from .bunk_study import _px
from .research_kit import Bench

FP = (3, 1)
U0, U1, V0, V1 = -46, 46, -12, 8                                                     # the counter body
CHANNEL = ((1, "r9PadL"), (4, "r9Pad"), (1, "r9PadD"))
CORRUGATE = ((1, "r9Metal"), (1, "r9Grey"), (1, "r9GreyD"))


# ---- counters ----------------------------------------------------------------------------------------------------
def t1():
    k = Bench("bar_t1", FP)
    u0, u1 = U0 + 8, U1 - 8
    r, vc = (V1 - V0) / 2, (V0 + V1) / 2
    kick(k, u0, u1, V0, V1)
    for u in (u0, u1):
        cyl(k, u, vc, 0, 4, r - 2, "r9Char", sides=20)
        cyl(k, u, vc, 4, TOP - 3, r, "r9Bone", sides=24)
    _px(k, u0, u1, V0, V1, 4, TOP - 3, "r9Bone")
    bands(k, panel(k, u0, u1, V1, 5, TOP - 4), ROLL, "u")
    _px(k, u0, u1, V0 - 2, V1 + 2, TOP - 3, TOP - 1, "r9GreyD")
    _px(k, u0, u1, V0 - 1, V1 + 1, TOP - 1, TOP, "r9Tan")
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 3, TOP - 1, r + 2, "r9GreyD", sides=24)
        cyl(k, u, vc, TOP - 1, TOP, r + 1, "r9Tan", sides=24)
    for u, col in ((-24, "r9Amber"), (14, "r9Blue")):
        mug(k, u, -2, col)
    return k.build()


def t2():
    k = Bench("bar_t2", FP)
    _px(k, U0 + 2, U1 - 2, V0 + 2, V1 - 2, 0, 4, "r9GreyD")
    bands(k, panel(k, U0 + 2, U1 - 2, V1 - 2, 0, 4), CORRUGATE, "u")                 # corrugated kick
    side_bands(k, U1 - 2, V0 + 2, V1 - 2, 0, 4, CORRUGATE, "v")
    _px(k, U0, U1, V0, V1, 4, TOP - 2, "r9Sand")
    panel_seams(k, U0, U1, V1, 4, TOP - 2, cols=4)
    stencil(k, -8, 8, V1 + 1, 7, 13)
    _px(k, U0 - 1, U1 + 1, V1, V1 + 3, 13, 16, "r9Char")                             # rubber bumper
    _px(k, U0 - 1, U1 + 1, V1 + 3, V1 + 3.5, 14, 15, "r9GreyD")
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 2, TOP, "r9Grey")                   # the top, plate grey
    _px(k, U0 - 1, U1 + 1, V0 - 1, V0 + 4, TOP, TOP + 4, "r9GreyD")                  # the raised back ledge
    _px(k, U0 - 1, U1 + 1, V0 + 4, V0 + 5, TOP + 3, TOP + 4, "r9Metal")
    for u, col in ((-30, "r9Ruby"), (-4, "r9Amber"), (24, "r9Blue")):
        mug(k, u, 0, col)
    return k.build()


def t3():
    k = Bench("bar_t3", FP)
    E = U1 - 3                                                                       # where the waterfall end starts
    kick(k, U0, E, V0, V1)
    _px(k, U0, E, V0, V1, 4, TOP - 3, "r9Bone")
    bands(k, panel(k, -14, E, V1, 5, TOP - 4), CHANNEL, "z")
    # the display case at the left: a dark frame, lit back, two shelves of goods, glass front
    _px(k, U0, -16, V1, V1 + 1, 4, TOP - 3, "r9GreyD")
    _px(k, U0 + 2, -18, V1 + 1, V1 + 1.4, 6, TOP - 5, "r9Warm")
    for z in (7, 13):
        _px(k, U0 + 2, -18, V1 + 1.4, V1 + 3, z, z + 1, "r9Grey")
        for i, u in enumerate(range(U0 + 4, -20, 5)):
            col = ("r9Amber", "r9Ruby", "r9Blue", "r9Orange")[(i + z) % 4]
            _px(k, u, u + 3, V1 + 1.6, V1 + 2.6, z + 1, z + 5, col)
    _px(k.part("glass"), U0 + 2, -18, V1 + 3, V1 + 3.4, 6, TOP - 5, "r9Glass")
    _px(k, U0 + 1, -17, V1 + 3, V1 + 3.6, TOP - 5, TOP - 4, "r9GreyD")
    # the tan slab: the top, and down the right end to the floor
    _px(k, U0 - 1, U1, V0 - 1, V1 + 1, TOP - 3, TOP, "r9Tan")
    _px(k, E, U1, V0 - 1, V1 + 1, 0, TOP - 3, "r9Tan")
    _px(k, U0 - 1, U1, V1 + 1, V1 + 1.5, TOP - 3, TOP - 2, "r9PadD")                  # a shadow line under the lip
    for u, col in ((-34, "r9Blue"), (8, "r9Amber")):
        mug(k, u, -2, col)
    return k.build()


# ---- stools ------------------------------------------------------------------------------------------------------
def u1():
    k = Bench("stool_u1", (1, 1))
    pedestal(k, 0, 0)
    return k.build()


def u2():
    k = Bench("stool_u2", (1, 1))
    _px(k, -5, 5, -5, 5, 0, 1, "r9GreyD")
    _px(k, -1, 1, -1, 1, 1, SEAT - 4, "r9Grey")
    _px(k, -4, 4, -4, 4, 6, 7, "r9GreyD")                                            # foot ring
    _px(k, -5, 5, -5, 5, SEAT - 4, SEAT - 3, "r9GreyD")
    _px(k, -5, 5, -5, 5, SEAT - 3, SEAT, "r9Pad")
    _px(k, -5, 5, 5, 5.5, SEAT - 3, SEAT - 1, "r9PadL")
    return k.build()


def u3():
    k = Bench("stool_u3", (1, 1))
    cyl(k, 0, 0, 0, SEAT - 2, 5.5, "r9Sand", sides=18)
    for z, col in ((0, "r9GreyD"), (5, "r9Orange"), (SEAT - 4, "r9GreyD")):
        cyl(k, 0, 0, z, z + 2, 5.9, col, sides=18)                                   # rolling hoops, a painted band
    cyl(k, 0, 0, SEAT - 2, SEAT, 5.8, "r9Pad", sides=18)
    return k.build()


COUNTERS = {"t1": t1, "t2": t2, "t3": t3}
STOOLS = {"u1": u1, "u2": u2, "u3": u3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in COUNTERS.items()]


def stool_jobs():
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in STOOLS.items()]
