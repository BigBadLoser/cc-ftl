"""Bar look study round 10 (family `barcounter10`, palette set bar9, preview only; heights as barcounter_study.py: counter
and table top 24 px, seats 15): round 9's used freighter look, in three new formats.

  m1 booth bar (3x2): a curved quilted booth wrapped round a round pedestal table, in front of a greebled wall with a
     self-serve dispenser alcove and a shelf of canisters
  m2 hatch bar (3x2): a thick bulkhead with a chamfered serving hatch, its roller shutter half up; a ledge through it;
     behind, shelves of bottles under a hanging lamp; stools in front
  m3 trolley bar (2x2): a drinks trolley on four wheels: a bone cabinet with corner posts and a tray top, a back unit of
     canisters with a push bar, a gooseneck lamp and a power cable to the floor

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import bottle, seg3
from .barcounter_r7 import hcyl
from .barcounter_r9 import drink, greeble, leds, padstool, quilt
from .barcounter_study import SEAT, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

FP3, FP2 = (3, 2), (2, 2)
BOTTLES = ("r9Amber", "r9Ruby", "r9Blue", "r9Glass")


def arcseg(k, cu, cv, a, w, r, d, z0, z1, col):
    """One box of a ring: centred at radius r, angle a about (cu, cv), w px along the ring, d px across it."""
    k.box((cu + r * math.cos(a)) / 32, (cv + r * math.sin(a)) / 32, z0 / ZPX, w / 32, d / 32, (z1 - z0) / ZPX, col,
          rz=a - math.pi / 2)


def canister(k, u, v, z, h=16, r=3.5, band="r9Orange"):
    lathe(k, u, v, ((z, r), (z + h, r), (z + h + 2, r * 0.6), (z + h + 3, 1)), "r9Bone", sides=12)
    cyl(k, u, v, z + h * 0.35, z + h * 0.35 + 2, r + 0.3, band, sides=12)


# ---- m1 booth bar -------------------------------------------------------------------------------------------------
def m1():
    k = Bench("bar_m1", FP3)
    g = k.part("glass")
    # the wall and its dispenser alcove
    _px(k, -48, 48, -32, -28, 0, 60, "r9Sand")
    for u in (-48, -20, 18, 46):
        _px(k, u, u + 2, -28, -27, 0, 60, "r9Tan")
    hcyl(k, -48, 48, -26, 55, 1.8, "r9Grey", n=6)
    greeble(k, -44, -22, -28, 30, 50, 21)
    _px(k, 22, 44, -28, -21, 30, 31.5, "r9Grey")                                     # shelf of canisters
    for u in (26, 33, 40):
        canister(k, u, -24.5, 31.5, h=12, r=3)
    _px(k, -16, 14, -28, -27, 18, 50, "r9GreyD")                                     # the alcove
    _px(k, -14, 12, -27.5, -26.5, 20, 48, "r9Char")
    _px(k, -13, 11, -27, -26, 46, 47, "r9Lamp")
    for u in (-8, -1, 6):
        cyl(k, u, -24, 34, 44, 1.6, "r9Grey")
        cyl(k, u, -24, 32, 34, 1, "r9Orange")
    _px(k, -14, 12, -27, -20, 20, 22, "r9Grey")                                      # drip tray
    leds(k, -14, -26.4, 49)
    # the booth: a seat and a quilted back on an arc round the back of the table
    CU, CV, N = 0, 0, 13
    a0, a1 = math.radians(196), math.radians(344)
    for i in range(N):
        a = a0 + (a1 - a0) * (i + 0.5) / N
        arcseg(k, CU, CV, a, 2 * math.pi * 30 / N / 2.3, 22, 9, 0, 3, "r9Char")       # recessed base
        arcseg(k, CU, CV, a, 2 * math.pi * 30 / N / 2.3, 23, 10, 3, SEAT, "r9Pad")    # seat
        arcseg(k, CU, CV, a, 2 * math.pi * 30 / N / 2.2, 29, 3, 3, SEAT + 15, "r9PadD")  # back shell
        arcseg(k, CU, CV, a, 2 * math.pi * 27 / N / 2.6, 27, 1.4, SEAT + 2 + 4 * (i % 2), SEAT + 12 + 2 * (i % 2),
               "r9Pad")                                                              # tufted back cushion
        arcseg(k, CU, CV, a, 2 * math.pi * 30 / N / 2.2, 29, 4, SEAT + 15, SEAT + 17, "r9Tan")  # cap rail
    # the table
    cyl(k, CU, CV, 0, 2, 6, "r9GreyD")
    cyl(k, CU, CV, 2, TOP - 3, 2.2, "r9Grey")
    cyl(k, CU, CV, TOP - 3, TOP - 1, 12, "r9Tan", sides=20)
    cyl(k, CU, CV, TOP - 1, TOP, 11.4, "r9Bone", sides=20)
    for u, v, col in ((-5, -3, "r9Blue"), (4, -4, "r9Amber"), (1, 4, "r9Ruby")):
        drink(k, g, u, v, col)
    return k.build()


# ---- m2 hatch bar -------------------------------------------------------------------------------------------------
def m2():
    k = Bench("bar_m2", FP3)
    g = k.part("glass")
    W0, W1, H0, H1 = -14, -6, 22, 50                                                 # the bulkhead's depth; hatch z
    _px(k, -48, 48, W0, W1, 0, H0, "r9Sand")
    _px(k, -48, 48, W0, W1, H1, 56, "r9Sand")
    _px(k, -48, -30, W0, W1, H0, H1, "r9Sand")
    _px(k, 30, 48, W0, W1, H0, H1, "r9Sand")
    for cu, cz, s in ((-30, H0, 1), (30, H0, -1), (-30, H1, 1), (30, H1, -1)):       # chamfered corners
        k.box((cu + 3 * s) / 32, (W0 + W1) / 64, (cz - 4 if cz == H1 else cz - 0.5) / ZPX + (0 if cz == H0 else 0),
              6 / 32, (W1 - W0) / 32, 4.5 / ZPX, "r9Sand", ry=s * (1 if cz == H1 else -1) * math.pi / 4)
    _px(k, -32, 32, W1, W1 + 1, H0 - 2, H0, "r9Tan")                                 # frame round the hatch
    _px(k, -32, 32, W1, W1 + 1, H1, H1 + 2, "r9Tan")
    for u in (-32, 30):
        _px(k, u, u + 2, W1, W1 + 1, H0 - 2, H1 + 2, "r9Tan")
    for u in range(-44, 44, 6):
        _px(k, u, u + 3, W1, W1 + 0.6, 4, 7, "r9Orange")                             # hazard dashes at its foot
    greeble(k, -46, -34, W1, 26, 52, 31)
    greeble(k, 34, 46, W1, 26, 52, 32)
    hcyl(k, -48, 48, W1 + 1.5, 53, 1.8, "r9Grey", n=6)                               # conduit over it
    leds(k, 36, W1 + 0.6, 46)
    # the shutter, half up: a roll housing and a few slats hanging below it
    hcyl(k, -30, 30, -10, 48, 2.5, "r9GreyD", n=6)
    for z in range(43, 47, 2):
        _px(k, -30, 30, -10.6, -9.4, z, z + 1.6, "r9Grey")
    _px(k, -30, 30, -10.8, -9.2, 42, 43, "r9Orange")                                 # its pull rail
    # the ledge through the hatch
    _px(k, -32, 32, -16, 4, TOP - 2, TOP, "r9Tan")
    for u in (-26, 26):
        seg3(k, (u, 3, TOP - 2), (u, W1 + 0.5, TOP - 10), 1.4, "r9GreyD")             # brackets
    # behind: shelves of bottles under a hanging lamp
    _px(k, -28, 28, -26, -22, 0, 46, "r9GreyD")
    for z in (28, 37):
        _px(k, -28, 28, -22, -18, z - 1, z, "r9Grey")
        for i, u in enumerate(range(-25, 26, 5)):
            bottle(k, u, -20, z, BOTTLES[(i + z) % 4], h=7, r=1.5)
    _px(k, -26, 26, -22, -21, 47, 48, "r9Lamp")                                      # a strip light over them
    for u, col in ((-16, "r9Amber"), (12, "r9Blue")):
        drink(k, g, u, 0, col)
    for u in (-24, 0, 24):
        padstool(k, u, 16)
    return k.build()


# ---- m3 trolley bar -----------------------------------------------------------------------------------------------
def m3():
    k = Bench("bar_m3", FP2)
    g = k.part("glass")
    U0, U1, V0, V1 = -16, 16, -12, 4
    for u in (U0 + 3, U1 - 3):                                                       # wheels
        hcyl(k, u - 1.5, u + 1.5, V0 + 3, 3, 3, "r9Char", n=4)
        hcyl(k, u - 1.5, u + 1.5, V1 - 3, 3, 3, "r9Char", n=4)
    _px(k, U0, U1, V0, V1, 5, 7, "r9GreyD")                                          # chassis
    _px(k, U0 + 1, U1 - 1, V0 + 1, V1 - 1, 7, TOP - 3, "r9Bone")                     # cabinet
    for u in (U0 + 1, U1 - 1):
        for v in (V0 + 1, V1 - 1):
            cyl(k, u, v, 5, TOP - 2, 1.4, "r9Tan")                                   # corner posts
    _px(k, U0 + 3, U1 - 3, V1 - 1, V1 - 0.4, 9, TOP - 6, "r9Sand")                   # door panel
    _px(k, -2, 2, V1 - 0.4, V1, 15, 16, "r9GreyD")                                   # its handle
    leds(k, U1 - 8, V1 - 0.4, TOP - 5)
    _px(k, U0, U1, V0, V1, TOP - 3, TOP - 1, "r9Tan")                                # tray top
    for u0, u1, v0, v1 in ((U0, U1, V1 - 1, V1), (U0, U1, V0, V0 + 1), (U0, U0 + 1, V0, V1), (U1 - 1, U1, V0, V1)):
        _px(k, u0, u1, v0, v1, TOP - 1, TOP + 1, "r9Tan")                            # its rim
    # the back unit: two canisters on a rack, a push bar over them
    for u in (U0 + 1, U1 - 2):
        _px(k, u, u + 1, V0, V0 + 1, TOP - 1, TOP + 22, "r9GreyD")
    _px(k, U0 + 1, U1 - 1, V0, V0 + 4, TOP + 1, TOP + 2, "r9Grey")
    for u in (-7, 0, 7):
        canister(k, u, V0 + 3, TOP + 2, h=11, r=2.6, band=("r9Orange", "r9Blue", "r9Orange")[(u + 7) // 7])
    hcyl(k, U0 - 2, U1 + 2, V0, TOP + 22, 1.2, "r9Pad", n=4)                          # push bar
    # side tray folded out, a gooseneck lamp, a cable to the floor
    _px(k, U1, U1 + 7, V0 + 2, V1 - 2, TOP - 4, TOP - 3, "r9Tan")
    seg3(k, (U1, V0 + 3, TOP - 10), (U1 + 6, V0 + 3, TOP - 4), 0.8, "r9GreyD")
    seg3(k, (U0 + 3, V0 + 2, TOP + 1), (U0 + 3, V0 + 2, TOP + 14), 0.8, "r9GreyD")
    seg3(k, (U0 + 3, V0 + 2, TOP + 14), (U0 + 7, V0 + 6, TOP + 17), 0.8, "r9GreyD")
    cyl(k, U0 + 8, V0 + 7, TOP + 14, TOP + 17, 2, "r9GreyD", r1=1)
    cyl(k, U0 + 8, V0 + 7, TOP + 13, TOP + 14, 1.6, "r9Lamp")
    seg3(k, (U0, V0 + 4, 8), (U0 - 8, V0 - 2, 0.5), 0.8, "r9Char")
    _px(k, U0 - 11, U0 - 6, V0 - 5, V0, 0, 1, "r9GreyD")                             # floor socket
    for u, v, col in ((-8, 0, "r9Amber"), (-2, -2, "r9Blue"), (6, 0, "r9Ruby")):
        drink(k, g, u, v, col)
    for u in (-14, 14):
        padstool(k, u, 18)
    return k.build()


DESIGNS = {"m1": (FP3, m1), "m2": (FP3, m2), "m3": (FP2, m3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
