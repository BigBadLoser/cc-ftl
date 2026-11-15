"""Bar look study round 14 (family `barcounter14`, palette set bar9, preview only; heights as barcounter_study.py:
counter top 24 px, seats 15): new ideas in the used freighter look, freestanding; salvage turned into a bar. Built to
the kit's craft rules only (whole-px edges, detail as flush bands, stepped curves, nothing sub-px), not its parts.

  r1 crate bar (3x2): three strapped cargo crates in a row under a riveted slab of hull plate; behind, an A-frame hung
     with a fuel bladder of drink, hosed down to a tap; crates for seats
  r2 thruster bar (2x2): a salvaged engine bell stood on its nozzle, scorched low down, its wide mouth ringed with a
     tan lip as the counter; in its throat a glowing core of drink with three spouts; stools round it
  r3 turret bar (3x2): a decommissioned gun turret behind a panelled counter, its four barrels now tap lines reaching
     over the counter to the glasses; hazard bands on the housing

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r13 import mug, stool
from .barcounter_r3 import cyl, lathe
from .barcounter_study import SEAT, TOP
from .barkit import kick, panel_seams, top_lip
from .bunk_study import _px
from .research_kit import Bench

FP3, FP2 = (3, 2), (2, 2)


def crate(k, u0, u1, v0, v1, z0, z1, col, rib="r9Tan", strap=True):
    """A cargo crate: a body, a frame round its front and right faces, a strap, a stencil plate."""
    _px(k, u0, u1, v0, v1, z0, z1, col)
    for a, b, c, d in ((u0, u1, z0, z0 + 2), (u0, u1, z1 - 2, z1), (u0, u0 + 2, z0 + 2, z1 - 2),
                       (u1 - 2, u1, z0 + 2, z1 - 2)):
        _px(k, a, b, v1, v1 + 1, c, d, rib)                                          # front frame
    for a, b in ((v0, v0 + 2), (v1 - 2, v1)):
        _px(k, u1, u1 + 1, a, b, z0, z1, rib)                                        # right face uprights
    if strap:
        um = (u0 + u1) // 2
        _px(k, um - 1, um + 1, v1 + 1, v1 + 1.5, z0, z1, "r9Char")
        _px(k, um - 1, um + 1, v0, v1 + 1, z1, z1 + 0.5, "r9Char")
    _px(k, u0 + 4, u0 + 10, v1 + 1, v1 + 1.5, z1 - 8, z1 - 5, "r9Orange")              # stencil


# ---- r1 crate bar ------------------------------------------------------------------------------------------------
def r1():
    k = Bench("bar_r1", FP3)
    for u0, u1, col in ((-44, -16, "r9Sand"), (-15, 14, "r9GreyD"), (15, 44, "r9Tan")):
        crate(k, u0, u1, -16, 2, 0, TOP - 3, col, rib="r9Bone" if col != "r9Sand" else "r9Tan")
    _px(k, -47, 47, -18, 5, TOP - 3, TOP - 1, "r9GreyD")                              # the hull plate
    _px(k, -47, 47, -18, 5, TOP - 1, TOP, "r9Grey")
    for u in range(-44, 45, 6):
        _px(k, u, u + 1, 4, 5, TOP - 1, TOP, "r9Metal")                               # rivets on its edge
    # the A-frame and its bladder
    for u in (-30, 10):
        _px(k, u - 1, u + 1, -30, -28, 0, 54, "r9GreyD")
        _px(k, u - 4, u + 4, -31, -27, 0, 1, "r9GreyD")
    _px(k, -32, 12, -30, -28, 54, 57, "r9Grey")
    lathe(k, -10, -27, ((24, 1), (26, 6), (32, 8), (44, 8), (49, 5), (51, 1.5)), "r9Pad", sides=18)
    for z in (33, 41):
        cyl(k, -10, -27, z, z + 1, 8.4, "r9Char", sides=18)                          # its straps
    cyl(k, -10, -27, 51, 54, 1, "r9Char", sides=6)                                   # its hanger
    _px(k, -11, -9, -27, -25, 20, 24, "r9PadD")                                      # the hose, down and
    _px(k, -11, -9, -25, -12, 20, 22, "r9PadD")                                      # forward to the tap
    _px(k, -12, -8, -12, -8, TOP, TOP + 6, "r9Grey")                                 # the tap
    _px(k, -11, -9, -8, -6, TOP + 3, TOP + 5, "r9Orange")
    for u, col in ((-30, "r9Amber"), (6, "r9Blue"), (28, "r9Ruby")):
        mug(k, u, -6, col)
    for u, col in ((-30, "r9Sand"), (0, "r9Tan"), (30, "r9GreyD")):                  # crate seats
        crate(k, u - 5, u + 5, 12, 22, 0, SEAT - 2, col, rib="r9Bone", strap=False)
        _px(k, u - 5, u + 5, 12, 22, SEAT - 2, SEAT, "r9Pad")
    return k.build()


# ---- r2 thruster bar ---------------------------------------------------------------------------------------------
def r2():
    k = Bench("bar_r2", FP2)
    CU, CV = 0, -6
    prof = ((0, 9), (3, 9), (3, 11), (8, 13), (13, 15.5), (18, 18.5), (TOP - 3, 21.5))
    for (z0, r0), (z1, r1_) in zip(prof, prof[1:]):
        col = "r9Soot" if z1 <= 8 else ("r9GreyD" if z1 <= 13 else "r9Grey")
        cyl(k, CU, CV, z0, z1, r0, col, r1=r1_, sides=28)
    for z in (8, 13, 18):
        r = dict(prof)[z]
        cyl(k, CU, CV, z, z + 1, r + 0.8, "r9Metal", sides=28)                       # its cooling bands
    cyl(k, CU, CV, TOP - 3, TOP - 1, 23.5, "r9GreyD", sides=28)                      # lip
    cyl(k, CU, CV, TOP - 1, TOP, 23, "r9Tan", sides=28)                              # the counter ring
    cyl(k, CU, CV, TOP, TOP + 0.4, 15, "r9Char", sides=24)                           # the throat, dark
    cyl(k, CU, CV, TOP + 0.4, TOP + 1, 14, "r9Soot", sides=24)
    # the core of drink in the throat, its spouts
    cyl(k, CU, CV, TOP, TOP + 12, 4, "r9Core", sides=14)
    cyl(k, CU, CV, TOP + 12, TOP + 14, 5, "r9GreyD", sides=14)
    cyl(k, CU, CV, TOP + 14, TOP + 15, 2, "r9Metal", sides=8)
    for a in (-50, 0, 50):
        r = math.radians(a + 90)
        for d in range(4, 18, 2):
            u, v = CU + d * math.cos(r), CV + d * math.sin(r)
            _px(k, round(u) - 1, round(u) + 1, round(v) - 1, round(v) + 1, TOP + 9, TOP + 11, "r9Grey")
        u, v = round(CU + 18 * math.cos(r)), round(CV + 18 * math.sin(r))
        _px(k, u - 1, u + 1, v - 1, v + 1, TOP + 6, TOP + 9, "r9Orange")
        mug(k, u, v, "r9Amber")
    for a in (-55, 0, 55):
        r = math.radians(a + 90)
        stool(k, round(CU + 31 * math.cos(r)), round(CV + 31 * math.sin(r)))
    return k.build()


# ---- r3 turret bar -----------------------------------------------------------------------------------------------
def r3():
    k = Bench("bar_r3", FP3)
    # the turret
    TU, TV = 0, -22
    cyl(k, TU, TV, 0, 3, 13, "r9Char", sides=24)
    cyl(k, TU, TV, 3, 30, 14, "r9GreyD", sides=24)
    for z in (10, 18):
        cyl(k, TU, TV, z, z + 3, 14.4, "r9Orange" if z == 10 else "r9Grey", sides=24)
    lathe(k, TU, TV, ((30, 14), (36, 12), (40, 8), (42, 4)), "r9Grey", sides=24)
    _px(k, TU - 7, TU + 7, TV + 8, TV + 13, 30, 38, "r9GreyD")                       # the mantlet
    _px(k, TU - 5, TU + 5, TV + 9, TV + 14, 36, 38, "r9Char")                        # its slot
    for du, zb in ((-5, 31), (-2, 31), (2, 31), (5, 31)):
        _px(k, TU + du - 1, TU + du + 1, TV + 13, -4, zb, zb + 2, "r9Grey")          # the barrels, now tap lines
        _px(k, TU + du - 1.5, TU + du + 1.5, -6, -4, zb - 0.5, zb + 2.5, "r9Metal")  # muzzle rings
        _px(k, TU + du - 1, TU + du + 1, -5, -3, TOP + 6, zb, "r9GreyD")             # down to the counter
        _px(k, TU + du - 1, TU + du + 1, -4, -2, TOP + 5, TOP + 6, "r9Orange")
    # the counter: panels and seams, a lit kick, a lip
    kick(k, -40, 40, -10, 6)
    _px(k, -40, 40, -10, 6, 4, TOP - 3, "r9Bone")
    panel_seams(k, -38, 38, 6, 6, TOP - 5, cols=4)
    top_lip(k, -40, 40, -10, 6, TOP - 3, over=1.5)
    for u, col in ((-5, "r9Amber"), (5, "r9Blue"), (-28, "r9Ruby"), (26, "r9Amber")):
        mug(k, u, 2, col)
    for u in (-26, 0, 26):
        stool(k, u, 20)
    return k.build()


DESIGNS = {"r1": (FP3, r1), "r2": (FP2, r2), "r3": (FP3, r3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
