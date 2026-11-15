"""Bar look study round 16 (families `barcounter16` and `barstool16`, palette set bar9, preview only; counter top 24
px, seat 15): three more counters (3x1) and stools (1x1) in the used freighter look, to the kit's craft rules
(whole-px edges, detail as flush bands, curves as steps).

Counters:
  v1 hull counter: a section of hull laid on its side, its front a stepped curve bellying out, ribbed with frames,
     a hazard band along its belly
  v2 cantilever counter: a slab top with a padded front rail floats off a thick central pedestal (louvre, hatch,
     lights), a warm strip under the slab; open knee space either side
  v3 rack counter: an open steel frame of posts and rails, its three bays stowed with a crate, a canister pair and
     a stack of cases, strapped; a plate top with a padded strip
Stools:
  w1 saddle stool: a stepped saddle seat on one tube with a foot bar
  w2 tripod stool: a round cushion on three legs, a ring between them
  w3 backed stool: a square seat with a low padded back on the side away from the counter

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r13 import mug, side_bands
from .barcounter_r3 import cyl, lathe
from .barcounter_study import SEAT, TOP
from .barkit import bands, indicators, kick, panel, panel_louvre, profile
from .bunk_study import _px
from .research_kit import Bench

FP = (3, 1)
U0, U1, V0, V1 = -46, 46, -12, 8
CORRUGATE = ((1, "r9Metal"), (1, "r9Grey"), (1, "r9GreyD"))


def top(k, u0, u1, v0, v1, col="r9Tan"):
    _px(k, u0 - 1, u1 + 1, v0 - 1, v1 + 2, TOP - 3, TOP - 1, "r9GreyD")
    _px(k, u0, u1, v0, v1 + 1, TOP - 1, TOP, col)


# ---- counters ----------------------------------------------------------------------------------------------------
def v1():
    k = Bench("bar_v1", FP)
    # the stepped curve of the front: (z0, z1, how far the front stands out past V1 - 4)
    steps = ((0, 3, 0), (3, 6, 2), (6, 10, 3), (10, 15, 4), (15, 18, 3), (18, TOP - 3, 2))
    for z0, z1, d in steps:
        col = "r9Orange" if (z0, z1) == (10, 15) else "r9Bone"
        _px(k, U0, U1, V0, V1 - 4 + d, z0, z1, col)
    for u in range(U0 + 2, U1 - 1, 15):                                               # frames, following the curve
        for z0, z1, d in steps:
            _px(k, u, u + 2, V1 - 4 + d, V1 - 3 + d, z0, z1, "r9GreyD")
    top(k, U0, U1, V0, V1 - 1)
    for u, col in ((-28, "r9Amber"), (20, "r9Blue")):
        mug(k, u, -2, col)
    return k.build()


def v2():
    k = Bench("bar_v2", FP)
    P0, P1, PV = -16, 16, V1 - 1                                                     # the pedestal, its front
    kick(k, P0, P1, V0, PV)
    _px(k, P0, P1, V0, PV, 4, TOP - 5, "r9Sand")
    panel_louvre(k, P0 + 3, P1 - 3, PV, 5, 11)
    indicators(k, -3, PV, 14)
    side_bands(k, P1, V0 + 2, PV - 2, 5, TOP - 6, CORRUGATE, "v")
    _px(k, U0, U1, V0, V1, TOP - 5, TOP - 3, "r9GreyD")                              # the slab's underside
    _px(k, U0 + 2, U1 - 2, V1 - 3, V1 - 2, TOP - 5.6, TOP - 5, "r9Warm")             # strip light under it
    top(k, U0, U1, V0, V1)
    profile(k, U0, U1, V1 + 2, TOP - 7, ((0, 1, 1, "r9PadD"), (1, 5, 2, "r9Pad"), (5, 6, 1, "r9PadL")))   # rail
    for u, col in ((-30, "r9Ruby"), (-2, "r9Amber"), (28, "r9Blue")):
        mug(k, u, -2, col)
    return k.build()


def v3():
    k = Bench("bar_v3", FP)
    for u in (U0, -16, 14, U1 - 2):                                                  # posts
        for v in (V0, V1 - 2):
            _px(k, u, u + 2, v, v + 2, 0, TOP - 3, "r9GreyD")
    for z in (1, 11):                                                                # rails
        _px(k, U0, U1, V1 - 2, V1, z, z + 2, "r9Grey")
        _px(k, U0, U1, V0, V0 + 2, z, z + 2, "r9Grey")
    _px(k, U0, U1, V0, V1, 0.5, 1, "r9Char")                                         # a floor pan
    # the bays: a crate, a pair of canisters, a stack of cases
    _px(k, U0 + 4, -19, V0 + 3, V1 - 4, 3, 19, "r9Sand")
    _px(k, U0 + 4, -19, V1 - 4, V1 - 3, 3, 5, "r9Tan")
    _px(k, U0 + 4, -19, V1 - 4, V1 - 3, 17, 19, "r9Tan")
    _px(k, U0 + 10, U0 + 18, V1 - 3, V1 - 2.5, 9, 13, "r9Orange")
    for u in (-8, 4):
        lathe(k, u, -2, ((3, 4), (16, 4), (18, 2.5), (19, 1)), "r9Bone", sides=14)
        cyl(k, u, -2, 8, 10, 4.3, "r9Blue", sides=14)
    for z, col in ((3, "r9GreyD"), (9, "r9Tan"), (14, "r9GreyD")):
        _px(k, 18, U1 - 5, V0 + 4, V1 - 4, z, z + 5, col)
        _px(k, 28, 34, V1 - 4, V1 - 3.5, z + 2, z + 3, "r9Metal")                    # their latches
    _px(k, U0, U1, V1 - 2, V1 - 1.5, 6, 7, "r9Char")                                 # the strap across
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 3, TOP - 1, "r9Grey")               # the plate top
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 1, TOP, "r9GreyD")
    _px(k, U0, U1, V1 - 4, V1 + 1, TOP, TOP + 1, "r9Pad")                            # a padded strip on it
    for u, col in ((-30, "r9Amber"), (10, "r9Ruby")):
        mug(k, u, -6, col)
    return k.build()


# ---- stools ------------------------------------------------------------------------------------------------------
def w1():
    k = Bench("stool_w1", (1, 1))
    cyl(k, 0, 0, 0, 1, 5, "r9GreyD", sides=16)
    cyl(k, 0, 0, 1, SEAT - 3, 1.5, "r9Grey", sides=8)
    _px(k, -4, 4, -1, 1, 5, 6, "r9GreyD")                                            # foot bar
    profile(k, -5, 5, -5, SEAT - 3, ((0, 1, 9, "r9PadD"), (1, 2, 10, "r9Pad")))      # saddle pan and seat
    _px(k, -5, 5, -5, -2, SEAT - 1, SEAT + 1, "r9Pad")                               # its raised back
    _px(k, -5, 5, -2, -1, SEAT, SEAT + 1, "r9PadL")
    _px(k, -5, 5, 4, 5, SEAT - 2, SEAT - 1, "r9PadL")
    return k.build()


def w2():
    k = Bench("stool_w2", (1, 1))
    for u, v in ((-4, -3), (4, -3), (0, 4)):
        _px(k, u - 1, u + 1, v - 1, v + 1, 0, SEAT - 3, "r9Grey")
    cyl(k, 0, 0, 5, 6, 4.4, "r9GreyD", sides=16)                                      # the ring
    cyl(k, 0, 0, SEAT - 3, SEAT - 2, 6, "r9PadD", sides=18)
    cyl(k, 0, 0, SEAT - 2, SEAT, 5.6, "r9Pad", sides=18)
    return k.build()


def w3():
    k = Bench("stool_w3", (1, 1))
    _px(k, -5, 5, -5, 5, 0, 1, "r9GreyD")
    _px(k, -1, 1, -1, 1, 1, SEAT - 3, "r9Grey")
    _px(k, -5, 5, -5, 5, SEAT - 3, SEAT, "r9Pad")
    _px(k, -5, 5, 5, 5.5, SEAT - 3, SEAT - 1, "r9PadL")
    _px(k, -5, 5, 5.5, 7, SEAT, SEAT + 8, "r9GreyD")                                 # the back's frame
    bands(k, panel(k, -4, 4, 7, SEAT + 1, SEAT + 7), ((1, "r9PadL"), (2, "r9Pad"), (1, "r9PadD")), "z")
    return k.build()


COUNTERS = {"v1": v1, "v2": v2, "v3": v3}
STOOLS = {"w1": w1, "w2": w2, "w3": w3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in COUNTERS.items()]


def stool_jobs():
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in STOOLS.items()]
