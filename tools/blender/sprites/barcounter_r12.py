"""Bar look study round 12 (family `barcounter12`, palette set bar9, preview only; heights as barcounter_study.py:
counter and table top 24 px, seats 15): round 11's used freighter look and freestanding formats, executed afresh
with a new kit in place of the reused one: tuck-and-roll padding in vertical pleats, round-ended counters, warm
strip light under the lips, shaped tap heads, solid mugs, portholes, vents and seams placed on purpose.

  o1 booth bar (3x2): a pleated booth round a pedestal table with a lipped top; at its end a round dispenser
     cabinet with a cowled tap head and a porthole gauge, hosed down to the floor
  o2 island bar (3x2): a round-ended counter pleated all along its front, a cowled spine of three tap heads along
     the back of its top
  o3 console bar (3x2): a round-ended counter with a padded bolster rail; behind it a low freestanding back console
     with a porthole cooler, a rail of hung mugs and two domed canisters

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r10 import arcseg
from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import seg3
from .barcounter_r7 import hcyl
from .barcounter_study import SEAT, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

FP3 = (3, 2)


# ---- the kit ------------------------------------------------------------------------------------------------------
def stool(k, u, v):
    """A tapered column stool: a flange foot, a cone, a plate and a rounded cushion."""
    lathe(k, u, v, ((0, 5), (1, 5), (1.5, 3.4), (SEAT - 5, 1.8), (SEAT - 4, 5)), "r9GreyD", sides=16)
    lathe(k, u, v, ((SEAT - 4, 5.4), (SEAT - 1, 5.4), (SEAT, 4.6)), "r9Pad", sides=16)
    cyl(k, u, v, SEAT - 3, SEAT - 2.4, 5.6, "r9PadD", sides=16)                       # its piping


def mug(k, u, v, col, z=TOP):
    cyl(k, u, v, z, z + 4, 1.7, "r9Metal", sides=10)
    cyl(k, u, v, z + 3.4, z + 4.05, 1.25, col, sides=10)                              # the drink
    _px(k, u + 1.5, u + 2.6, v - 0.4, v + 0.4, z + 1, z + 3.2, "r9Metal")             # handle


def pleats(k, pts, z0, z1, r=1.5):
    """Tuck-and-roll: vertical rolls at the given (u, v) points, on a dark backing."""
    for u, v in pts:
        cyl(k, u, v, z0, z1, r, "r9Pad", sides=8)


def taphead(k, u, v, z, col="r9Orange"):
    """A tap head on a riser: a cowled body leaning forward, a spout and a lit tag."""
    cyl(k, u, v, z, z + 3, 1.2, "r9GreyD", sides=8)
    lathe(k, u, v + 1, ((z + 3, 2.4), (z + 7, 2.4), (z + 8, 1.6)), "r9Grey", sides=10)
    _px(k, u - 0.6, u + 0.6, v + 2.5, v + 4.5, z + 4, z + 5, "r9Grey")               # spout arm
    _px(k, u - 0.5, u + 0.5, v + 3.6, v + 4.6, z + 2, z + 4, col)                    # nozzle
    _px(k, u - 1, u + 1, v + 3.3, v + 3.6, z + 6, z + 7, "r9Lamp")                   # tag


def porthole(k, u, v, zc, r, rim="r9GreyD", face="r9Warm"):
    """A round port facing +v: two squares turned 45 deg apart make an octagon; a smaller one lit inside."""
    for rr, col, d in ((r, rim, 1.2), (r * 0.72, face, 1.6)):
        R = rr / 32
        for a in (0, math.pi / 4):
            k.box(u / 32, v / 32 + d / 64, zc / ZPX - R, 2 * R, d / 32, 2 * R, col, ry=a)


def vent(k, u0, u1, v, z0, z1):
    _px(k, u0, u1, v - 0.5, v, z0, z1, "r9Char")
    for z in range(int(z0) + 1, int(z1), 2):
        _px(k, u0 + 0.5, u1 - 0.5, v - 0.5, v + 0.3, z, z + 0.8, "r9GreyD")


def rcounter(k, u0, u1, v0, v1, front="pleats"):
    """A counter with round ends: a body between two half-drums, a recessed kick lit warm, a lipped top."""
    r, vc = (v1 - v0) / 2, (v0 + v1) / 2
    _px(k, u0, u1, v0 + 1.5, v1 - 1.5, 0, 3, "r9Char")                               # kick
    for u in (u0, u1):
        cyl(k, u, vc, 0, 3, r - 1.5, "r9Char", sides=16)
    _px(k, u0, u1, v1 - 1.6, v1 - 1.2, 2.4, 3, "r9Warm")                             # kick light
    _px(k, u0, u1, v0, v1, 3, TOP - 3, "r9Bone")
    for u in (u0, u1):
        cyl(k, u, vc, 3, TOP - 3, r, "r9Bone", sides=20)
    _px(k, u0, u1, v0 - 1.5, v1 + 1.5, TOP - 3, TOP - 1, "r9GreyD")                  # top: a dark lip,
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 3, TOP - 1, r + 1.5, "r9GreyD", sides=20)
    _px(k, u0, u1, v0 - 1, v1 + 1, TOP - 1, TOP, "r9Tan")                            # a tan surface
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 1, TOP, r + 1, "r9Tan", sides=20)
    _px(k, u0, u1, v1, v1 + 1.6, TOP - 3.6, TOP - 3, "r9Warm")                       # warm light under the lip
    if front == "pleats":
        _px(k, u0, u1, v1, v1 + 0.3, 6, TOP - 4, "r9PadD")                           # the pleats' backing
        pts = [(u, v1 + 0.3) for u in range(int(u0), int(u1) + 1, 4)]
        for s, u in ((-1, u0), (1, u1)):                                             # round the ends
            for i in range(7):
                a = math.pi / 2 + s * (-(i + 1) * math.pi / 8)
                pts.append((u + (r + 0.4) * math.cos(a) * -s * -1, vc + (r + 0.4) * math.sin(a)))
        pleats(k, pts, 6, TOP - 4, r=1.25)
    return r, vc


# ---- o1 booth bar -------------------------------------------------------------------------------------------------
def o1():
    k = Bench("bar_o1", FP3)
    CU, CV = -10, -2
    a0, a1 = math.radians(192), math.radians(348)
    N = 14
    for i in range(N):
        a = a0 + (a1 - a0) * (i + 0.5) / N
        w = (a1 - a0) / N * 24 * 1.15
        arcseg(k, CU, CV, a, w * 0.8, 23, 8, 0, 3, "r9Char")                         # base
        arcseg(k, CU, CV, a, w * 0.75, 19.3, 0.6, 2.4, 3, "r9Warm")                  # its light
        arcseg(k, CU, CV, a, w * 0.95, 24, 11, 3, SEAT - 2, "r9Tan")                 # seat box
        arcseg(k, CU, CV, a, w * 0.98, 24, 11.4, SEAT - 2, SEAT, "r9Pad")            # seat cushion
        arcseg(k, CU, CV, a, w * 1.25, 31, 3, 3, SEAT + 13, "r9Tan")                 # back shell
        arcseg(k, CU, CV, a, w * 1.25, 31, 4, SEAT + 13, SEAT + 15, "r9GreyD")       # cap rail
    M = 24
    for i in range(M):                                                               # the back's pleats
        a = a0 + (a1 - a0) * (i + 0.5) / M
        pleats(k, [(CU + 28.6 * math.cos(a), CV + 28.6 * math.sin(a))], SEAT, SEAT + 12, r=1.4)
    lathe(k, CU, CV, ((0, 6), (1, 6), (2, 2.6), (TOP - 5, 2), (TOP - 3, 5)), "r9Grey", sides=16)
    cyl(k, CU, CV, TOP - 3, TOP - 1, 12.5, "r9GreyD", sides=24)
    cyl(k, CU, CV, TOP - 1, TOP, 11.8, "r9Bone", sides=24)
    for u, v, col in ((-5, -3, "r9Blue"), (4, -5, "r9Amber"), (1, 4, "r9Ruby")):
        mug(k, CU + u, CV + v, col)
    # the dispenser cabinet
    DU, DV = 34, -8
    lathe(k, DU, DV, ((0, 7), (2, 7), (2, 8), (30, 8)), "r9Bone", sides=20)
    _px(k, DU - 0.5, DU + 0.5, DV + 7.6, DV + 8.3, 4, 28, "r9GreyD")                 # door seam
    _px(k, DU + 1.5, DU + 2.5, DV + 8, DV + 8.8, 14, 19, "r9Grey")                   # handle
    vent(k, DU - 5, DU - 1.5, DV + 8.2, 6, 14)
    cyl(k, DU, DV, 30, 31.5, 8.6, "r9GreyD", sides=20)
    lathe(k, DU, DV - 1, ((31.5, 7), (38, 6), (42, 4), (43, 2)), "r9Grey", sides=16)  # cowl
    porthole(k, DU + 4, DV + 3.6, 37, 2)
    taphead(k, DU, DV + 5, 31.5)
    _px(k, DU - 4, DU + 4, DV + 7, DV + 11, 18, 19.5, "r9GreyD")                     # drip tray
    hose = ((DU - 6, DV - 4, 40), (DU - 10, DV - 8, 34), (DU - 10, DV - 9, 2), (DU - 6, DV - 9, 0.5))
    for a, b in zip(hose, hose[1:]):
        seg3(k, a, b, 1.6, "r9PadD")
    mug(k, DU, DV + 9, "r9Amber", z=19.5)
    return k.build()


# ---- o2 island bar ------------------------------------------------------------------------------------------------
def o2():
    k = Bench("bar_o2", FP3)
    r, vc = rcounter(k, -38, 38, -18, 0)
    _px(k, -24, 24, -16, -12, TOP, TOP + 3, "r9GreyD")                               # the spine
    hcyl(k, -24, 24, -14, TOP + 6, 3.2, "r9Grey", n=6)
    for u in (-24, 24):
        cyl(k, u, -14, TOP, TOP + 9, 3.4, "r9GreyD", sides=12)                       # its end caps
    _px(k, -18, 18, -11.2, -10.8, TOP + 8, TOP + 9, "r9Warm")
    for u in (-14, 0, 14):
        taphead(k, u, -12, TOP + 3, col=("r9Orange", "r9Blue", "r9Orange")[(u + 14) // 14])
    _px(k, -18, 18, -9, -5, TOP, TOP + 0.8, "r9Grey")                                # drip rail
    for u, col in ((-30, "r9Amber"), (-6, "r9Blue"), (28, "r9Ruby")):
        mug(k, u, -6, col)
    for u in (-28, 0, 28):
        stool(k, u, 16)
    return k.build()


# ---- o3 console bar -----------------------------------------------------------------------------------------------
def o3():
    k = Bench("bar_o3", FP3)
    r, vc = rcounter(k, -34, 34, -12, 4, front="panels")
    for z in (8, 15):
        _px(k, -34, 34, 4, 4.4, z, z + 0.6, "r9Tan")                                 # panel grooves
    for u in (-17, 17):
        vent(k, u - 5, u + 5, 4.5, 5, 7)
    hcyl(k, -34, 34, 5.6, TOP - 5, 2, "r9Pad", n=6)                                  # padded bolster
    for u in (-26, 0, 26):
        _px(k, u - 1, u + 1, 3.6, 5, TOP - 6, TOP - 4, "r9GreyD")                    # its brackets
    # the back console, low and freestanding
    B0, B1 = -32, -20
    rb, vb = (B1 - B0) / 2, (B0 + B1) / 2
    _px(k, -38, 38, B0 + 1.5, B1 - 1.5, 0, 3, "r9Char")
    _px(k, -38, 38, B0, B1, 3, 30, "r9Sand")
    for u in (-38, 38):
        cyl(k, u, vb, 3, 30, rb, "r9Sand", sides=16)
        cyl(k, u, vb, 0, 3, rb - 1.5, "r9Char", sides=16)
    _px(k, -38, 38, B0 - 1, B1 + 1, 30, 32, "r9GreyD")
    for u in (-38, 38):
        cyl(k, u, vb, 30, 32, rb + 1, "r9GreyD", sides=16)
    _px(k, -36, -8, B1, B1 + 0.5, 4, 28, "r9Bone")                                   # cooler door
    porthole(k, -22, B1 + 0.5, 17, 6, face="r9Amber")                                # its window
    _px(k, -10, -9, B1 + 0.5, B1 + 1.4, 12, 22, "r9Grey")                            # handle
    vent(k, -4, 14, B1 + 0.3, 6, 14)
    _px(k, 18, 36, B1, B1 + 0.4, 18, 28, "r9GreyD")                                  # a hatch
    _px(k, 25, 29, B1 + 0.4, B1 + 1, 22, 23, "r9Grey")
    _px(k, -2, 6, B1, B1 + 0.4, 22, 24, "r9Warm")                                    # status strip
    # on the console: two domed canisters and a rail of hung mugs
    for u, band in ((-30, "r9Orange"), (-20, "r9Blue")):
        lathe(k, u, vb, ((32, 4), (44, 4), (47, 3), (48.5, 1.4), (50, 1.2)), "r9Bone", sides=14)
        cyl(k, u, vb, 36, 38, 4.3, band, sides=14)
    for u in (6, 30):
        _px(k, u - 0.8, u + 0.8, vb - 0.8, vb + 0.8, 32, 48, "r9GreyD")
    _px(k, 5, 31, vb - 1, vb + 1, 47, 48.5, "r9Grey")
    for u in range(9, 29, 4):
        _px(k, u - 0.3, u + 0.3, vb + 0.6, vb + 1, 43, 47, "r9GreyD")
        mug(k, u, vb + 1.4, "r9Metal", z=38)
    for u, col in ((-22, "r9Amber"), (10, "r9Blue"), (24, "r9Ruby")):
        mug(k, u, -4, col)
    for u in (-24, 0, 24):
        stool(k, u, 18)
    return k.build()


DESIGNS = {"o1": (FP3, o1), "o2": (FP3, o2), "o3": (FP3, o3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
