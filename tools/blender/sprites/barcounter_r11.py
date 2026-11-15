"""Bar look study round 11 (family `barcounter11`, palette set bar9, preview only; heights as barcounter_study.py:
counter and table top 24 px, seats 15): round 9's used freighter look, freestanding only (no back walls: a room's own
walls stand behind it).

  n1 booth bar (3x2): a curved quilted booth, its back low, round a pedestal table; at its right end a freestanding
     ribbed dispenser column with two nozzles over a drip tray, canisters strapped to its side
  n2 gantry bar (3x2): an island counter with a quilted front and a greebled service block on its top; an open gantry
     on two posts over it, hung with glasses and a strip light under a conduit
  n3 return bar (3x2): an L counter, its return reaching forward at the left round the stools; behind it a framed
     stack of canisters piped over to taps on the counter

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r10 import arcseg, canister
from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import seg3
from .barcounter_r7 import hcyl
from .barcounter_r9 import drink, greeble, leds, padstool, quilt
from .barcounter_study import SEAT, TOP
from .bunk_study import _px
from .research_kit import Bench

FP3 = (3, 2)


def nozzles(k, us, v, z):
    for u in us:
        cyl(k, u, v, z, z + 6, 1.4, "r9Grey")
        cyl(k, u, v, z - 2, z, 0.9, "r9Orange")


# ---- n1 booth bar -------------------------------------------------------------------------------------------------
def n1():
    k = Bench("bar_n1", FP3)
    g = k.part("glass")
    CU, CV, N = -10, -2, 13
    a0, a1 = math.radians(190), math.radians(350)
    for i in range(N):
        a = a0 + (a1 - a0) * (i + 0.5) / N
        w = 2 * math.pi * 30 / N / 2.1
        arcseg(k, CU, CV, a, w * 0.8, 22, 9, 0, 3, "r9Char")                        # recessed base
        arcseg(k, CU, CV, a, w * 0.85, 23, 10, 3, SEAT, "r9Pad")                    # seat
        arcseg(k, CU, CV, a, w, 29, 3, 3, SEAT + 11, "r9Tan")                         # back shell
        arcseg(k, CU, CV, a, w * 0.75, 27, 1.4, SEAT + 1 + 3 * (i % 2), SEAT + 9 + 1 * (i % 2), "r9Pad")  # tufted back
        arcseg(k, CU, CV, a, w, 29, 4, SEAT + 11, SEAT + 13, "r9Bone")              # cap rail
    cyl(k, CU, CV, 0, 2, 6, "r9GreyD")
    cyl(k, CU, CV, 2, TOP - 3, 2.2, "r9Grey")
    cyl(k, CU, CV, TOP - 3, TOP - 1, 12, "r9Tan", sides=20)
    cyl(k, CU, CV, TOP - 1, TOP, 11.4, "r9Bone", sides=20)
    for u, v, col in ((-5, -3, "r9Blue"), (4, -4, "r9Amber"), (1, 4, "r9Ruby")):
        drink(k, g, CU + u, CV + v, col)
    # the dispenser column at the right end
    DU, DV = 34, -8
    _px(k, DU - 9, DU + 9, DV - 9, DV + 9, 0, 3, "r9GreyD")
    lathe(k, DU, DV, ((3, 8), (40, 8), (44, 6), (50, 6), (52, 3)), "r9Grey", sides=16)
    for z in (8, 14, 36):
        cyl(k, DU, DV, z, z + 2, 8.5, "r9GreyD", sides=16)
    cyl(k, DU, DV, 44, 50, 6.4, "r9Sand", sides=16)
    greeble(k, DU - 4, DU + 4, DV + 8, 22, 34, 41, n=8)
    leds(k, DU - 2, DV + 8.4, 40)
    _px(k, DU - 6, DU + 6, DV + 6, DV + 13, 18, 20, "r9Tan")                         # drip tray
    nozzles(k, (DU - 3, DU + 3), DV + 10, 28)
    _px(k, DU - 6, DU + 6, DV + 8, DV + 10, 34, 36, "r9GreyD")                       # the nozzles' arm
    cyl(k, DU, DV, 52, 54, 2.2, "r9Lamp")
    for v in (DV - 4, DV + 3):
        canister(k, DU + 10, v, 3, h=14, r=3)
    _px(k, DU + 8, DU + 9, DV - 8, DV + 7, 9, 11, "r9Orange")                        # their strap
    drink(k, g, DU, DV + 9.5, "r9Amber")
    return k.build()


# ---- n2 gantry bar ------------------------------------------------------------------------------------------------
def n2():
    k = Bench("bar_n2", FP3)
    g = k.part("glass")
    U0, U1, V0, V1 = -40, 40, -18, 2
    _px(k, U0 + 2, U1 - 2, V0 + 2, V1 - 2, 0, 4, "r9Char")                           # recessed kick
    _px(k, U0, U1, V0, V1 - 1, 4, TOP - 2, "r9Bone")
    quilt(k, U0 + 2, U1 - 2, V1, 7, TOP - 4)
    _px(k, U1, U1 + 0.8, V0 + 2, V1 - 2, 7, TOP - 4, "r9PadD")                       # padded end
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1, TOP - 2, TOP, "r9Tan")
    hcyl(k, U0 - 1, U1 + 1, V1, TOP - 1.2, 1.6, "r9Pad", n=4)                        # rolled edge
    # the service block in the middle of the top
    _px(k, -12, 12, -14, -4, TOP, TOP + 12, "r9Grey")
    _px(k, -12, 12, -14, -4, TOP + 12, TOP + 13, "r9GreyD")
    greeble(k, -11, 11, -4, TOP + 7, TOP + 12, 51, n=10)
    leds(k, 6, -3.4, TOP + 2)
    nozzles(k, (-7, 0), -2, TOP + 6)
    _px(k, -9, 2, -4, -0.5, TOP + 10, TOP + 12, "r9GreyD")
    # the gantry: two posts, a beam, glasses hung under it, a strip light
    for u in (-36, 36):
        _px(k, u - 1.5, u + 1.5, -9.5, -6.5, TOP, 64, "r9GreyD")
    _px(k, -38, 38, -10, -6, 62, 65, "r9Tan")
    hcyl(k, -38, 38, -8, 67, 1.6, "r9Grey", n=6)                                     # conduit on it
    _px(k, -30, 30, -9, -7, 60, 62, "r9GreyD")                                       # glass rail
    for u in range(-28, 29, 4):
        if abs(u) > 14:
            cyl(g, u, -8, 52, 58, 1.8, "r9Glass")
            cyl(k, u, -8, 58, 60, 0.6, "r9GreyD")
    _px(k, -12, 12, -8.5, -7.5, 58, 59, "r9Lamp")
    for u, v, col in ((-24, -4, "r9Blue"), (22, -6, "r9Amber"), (30, -12, "r9Ruby")):
        drink(k, g, u, v, col)
    for u in (-28, 0, 28):
        padstool(k, u, 16)
    for u in (-20, 20):
        padstool(k, u, -28)
    return k.build()


# ---- n3 return bar ------------------------------------------------------------------------------------------------
def n3():
    k = Bench("bar_n3", FP3)
    g = k.part("glass")
    # the main run and its return at the left
    _px(k, -46, 46, -14, -3, 0, 4, "r9Char")
    _px(k, -46, -36, -3, 22, 0, 4, "r9Char")
    _px(k, -48, 48, -16, -1, 4, TOP - 2, "r9Bone")
    _px(k, -48, -34, -1, 26, 4, TOP - 2, "r9Bone")
    quilt(k, -34, 46, 0, 7, TOP - 4)                                                 # front of the run
    _px(k, 48, 48.8, -14, -2, 7, TOP - 4, "r9PadD")
    _px(k, -34, -33, 0, 24, 7, TOP - 4, "r9PadD")                                    # the return's inner face
    for v in range(1, 23, 4):
        _px(k, -33, -32.2, v + 0.4, v + 3.6, 8 + 4 * ((v // 4) % 2), TOP - 8 + 4 * ((v // 4) % 2), "r9Pad")
    quilt(k, -46, -36, 26, 7, TOP - 4)                                               # the return's end
    _px(k, -49, 49, -17, 0, TOP - 2, TOP, "r9Tan")
    _px(k, -49, -33, 0, 27, TOP - 2, TOP, "r9Tan")
    hcyl(k, -33, 49, 0, TOP - 1.2, 1.6, "r9Pad", n=4)
    # the canister stack behind, in a frame, piped over to taps
    FU, FV = 4, -26
    _px(k, FU - 14, FU + 14, FV - 6, FV + 6, 0, 2, "r9GreyD")
    for u in (FU - 14, FU + 13):
        _px(k, u, u + 1, FV - 6, FV + 6, 2, 52, "r9GreyD")
    for z in (2, 26):
        _px(k, FU - 13, FU + 13, FV - 6, FV + 6, z, z + 1.5, "r9Grey")
        for u in (FU - 7, FU + 7):
            canister(k, u, FV, z + 1.5, h=17, r=4.5, band=("r9Orange", "r9Blue")[z > 2])
    _px(k, FU - 14, FU + 14, FV - 6, FV + 6, 50, 52, "r9Tan")
    leds(k, FU + 8, FV + 6.2, 48)
    hcyl(k, FU - 7, FU + 7, FV + 2, 49, 1.2, "r9Grey", n=4)
    seg3(k, (FU, FV + 2, 49), (FU, -10, TOP + 14), 1.6, "r9Grey")                     # the pipe over
    _px(k, FU - 8, FU + 8, -11, -8, TOP + 12, TOP + 14, "r9GreyD")                   # tap bar
    nozzles(k, (FU - 5, FU, FU + 5), -9, TOP + 8)
    _px(k, FU - 8, FU + 8, -11, -6, TOP, TOP + 1, "r9Grey")                          # drip tray
    for u, v, col in ((-40, 12, "r9Blue"), (-22, -6, "r9Amber"), (30, -6, "r9Ruby")):
        drink(k, g, u, v, col)
    for u in (-18, 6, 30):
        padstool(k, u, 14)
    return k.build()


DESIGNS = {"n1": (FP3, n1), "n2": (FP3, n2), "n3": (FP3, n3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
