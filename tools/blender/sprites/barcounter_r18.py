"""Bar look study round 18 (families `barcounter18` and `barstool18`, palette set bar18, preview only; counter top 24
px, seat 15): three more colour and shape directions, each with its own palette, faces at 45 deg across the floor
where a shape needs an angle (they stay crisp in this view).

Counters (3x1):
  z1 fluted counter: slate blue, its front fluted with small 45 deg ridges in two alternating tones under a mustard
     band; the middle third stands forward of the ends; a pale grey top
  z2 pill counter: burnt orange with big round ends, its front two stacked rounded bulges; a charcoal top with a
     cream inset strip
  z3 tray counter: seafoam with all four corners cut at 45 deg, dark brown inset panels with copper fasteners, and a
     tray top: a raised copper-edged rim round a sunken surface
Stools (1x1): a1 slate tube stool, mustard seat; a2 burnt orange base, cream seat; a3 seafoam drum, copper band.

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r13 import mug
from .barcounter_r17 import diamond
from .barcounter_r3 import cyl
from .barcounter_study import SEAT, TOP
from .barkit import profile
from .bunk_study import _px
from .research_kit import Bench

FP = (3, 1)
U0, U1, V0, V1 = -46, 46, -12, 4


# ---- counters ----------------------------------------------------------------------------------------------------
def z1():
    k = Bench("bar_z1", FP)
    M0, M1, F = -16, 16, 3                                                            # middle third, stood forward F
    for u0, u1, vf in ((U0, M0, V1), (M0, M1, V1 + F), (M1, U1, V1)):
        _px(k, u0 + 2, u1 - 2, V0 + 2, vf - 2, 0, 3, "z8Char")
        _px(k, u0, u1, V0, vf, 3, TOP - 3, "z8Slate")
        for i, u in enumerate(range(u0 + 2, u1 - 1, 4)):                             # flutes, two tones in turn
            diamond(k, u, vf, 4, 16, 2, "z8SlateL" if i % 2 else "z8SlateD")
        _px(k, u0, u1, vf, vf + 1, 16, 19, "z8Mustard")                               # the band
        _px(k, u0 - 1, u1 + 1, V0 - 1, vf + 2, TOP - 3, TOP - 1, "z8SlateD")
        _px(k, u0 - 1, u1 + 1, V0 - 1, vf + 1.5, TOP - 1, TOP, "z8Grey")
    for u, col in ((-28, "r9Amber"), (6, "r9Blue")):
        mug(k, u, -4, col)
    return k.build()


def z2():
    k = Bench("bar_z2", FP)
    r, vc = (V1 - V0) / 2, (V0 + V1) / 2
    u0, u1 = U0 + r, U1 - r
    for u in (u0, u1):
        cyl(k, u, vc, 0, 3, r - 2, "z8Char", sides=24)
        cyl(k, u, vc, 3, TOP - 3, r, "z8Orange", sides=28)
    _px(k, u0, u1, V0 + 2, V1 - 2, 0, 3, "z8Char")
    _px(k, u0, u1, V0, V1, 3, TOP - 3, "z8Orange")
    for z in (3, 12):                                                                # two rounded bulges
        profile(k, u0, u1, V1, z, ((0, 1, 1, "z8OrangeD"), (1, 2, 2, "z8Orange"), (2, 6, 3, "z8Orange"),
                                   (6, 7, 2, "z8OrangeL"), (7, 8, 1, "z8OrangeL")))
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 3, TOP - 1, r + 1.5, "z8Char", sides=28)
        cyl(k, u, vc, TOP - 1, TOP, r + 1, "z8Char", sides=28)
    _px(k, u0, u1, V0 - 1.5, V1 + 1.5, TOP - 3, TOP - 1, "z8Char")
    _px(k, u0, u1, V0 - 1, V1 + 1, TOP - 1, TOP, "z8Char")
    _px(k, u0, u1, vc - 1, vc + 1, TOP, TOP + 0.5, "z8Cream")                        # the inset strip
    for u, col in ((-24, "r9Amber"), (18, "r9Ruby")):
        mug(k, u, V1 - 2, col)
    return k.build()


def z3():
    k = Bench("bar_z3", FP)
    C = 6

    def octo(z0, z1, col, grow=0.0):
        """The plan with all four corners cut at 45 deg, grown outward by `grow`."""
        _px(k, U0 + C, U1 - C, V0 - grow, V1 + grow, z0, z1, col)
        _px(k, U0 - grow, U1 + grow, V0 + C, V1 - C, z0, z1, col)
        for u in (U0 + C, U1 - C):
            for v in (V0 + C, V1 - C):
                diamond(k, u, v, z0, z1, C + grow * math.sqrt(2), col)
    _px(k, U0 + C, U1 - C, V0 + 2, V1 - 2, 0, 3, "z8Brown")
    octo(3, TOP - 4, "z8Sea")
    for u0 in range(U0 + C + 2, U1 - C - 10, 14):                                     # inset panels
        _px(k, u0, u0 + 12, V1, V1 + 0.6, 6, TOP - 7, "z8Brown")
        for u in (u0 + 1, u0 + 10):
            _px(k, u, u + 1, V1 + 0.6, V1 + 1, TOP - 9, TOP - 8, "z8Copper")
    octo(TOP - 4, TOP - 2, "z8Brown", grow=1)
    octo(TOP - 2, TOP, "z8Copper", grow=1)                                           # the raised rim
    _px(k, U0 + 4, U1 - 4, V0 + 2, V1 - 2, TOP - 1, TOP + 0.3, "z8SeaD")             # the sunken tray, inside it
    for u, col in ((-22, "r9Amber"), (18, "r9Blue")):
        mug(k, u, -4, col, z=TOP + 0.3)
    return k.build()


# ---- stools ------------------------------------------------------------------------------------------------------
def a1():
    k = Bench("stool_a1", (1, 1))
    cyl(k, 0, 0, 0, 1, 5, "z8SlateD", sides=16)
    cyl(k, 0, 0, 1, SEAT - 3, 1.5, "z8Slate", sides=8)
    cyl(k, 0, 0, 6, 7, 4, "z8SlateD", sides=16)
    cyl(k, 0, 0, SEAT - 3, SEAT, 5.6, "z8Mustard", sides=18)
    return k.build()


def a2():
    k = Bench("stool_a2", (1, 1))
    cyl(k, 0, 0, 0, 2, 5.5, "z8Char", sides=18)
    cyl(k, 0, 0, 2, SEAT - 3, 3, "z8Orange", r1=4.5, sides=18)
    cyl(k, 0, 0, SEAT - 3, SEAT, 5.8, "z8Cream", sides=18)
    return k.build()


def a3():
    k = Bench("stool_a3", (1, 1))
    cyl(k, 0, 0, 0, SEAT - 2, 5.5, "z8Sea", sides=18)
    cyl(k, 0, 0, 5, 7, 5.8, "z8Copper", sides=18)
    cyl(k, 0, 0, SEAT - 2, SEAT, 5.8, "z8Brown", sides=18)
    return k.build()


COUNTERS = {"z1": z1, "z2": z2, "z3": z3}
STOOLS = {"a1": a1, "a2": a2, "a3": a3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in COUNTERS.items()]


def stool_jobs():
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in STOOLS.items()]
