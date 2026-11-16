"""Water purifier look study, round 9 (family `purifier9`, palette set purifier, preview only; issue #321). Rounds 5-8
had the right detail but read as two modules side by side (user). Here each is ONE mass: one dark band under the
whole machine, one trim line wrapping it, the stages built into the body instead of standing next to it.

  e1 embedded column: one long body, the melt column sunk into its right end so the body wraps the column's foot and
     the column bulges out of the front; the ice well sunk into the top at the left; a pipe along the
     front clamped to both
  e2 swept shell: one shell whose roof sweeps up from the low ice well at the left to the tall tank at the right,
     ribs wrapping it at intervals, a bay window standing out of the tall part, filter caps in its roof
  e3 cradled drum: one horizontal drum lying half sunk in its cradle body, domed ends standing out; the hopper neck
     rises out of the drum at the left, a glass filter dome sits on it at the right

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .purifier_kit import prism
from .purifier_kit import extrude
from .purifier_r3 import BAND, V0, V1, chamfered, lamp
from .purifier_r5 import D, body, deep_door, heap, skin, spout
from .purifier_r7 import marks
from .purifier_r8 import circle
from .purifier_study import span
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)


def well(k, u0, u1, v0, v1, z, lid=False, n=16):
    """An ice well sunk into a top at z: a raised rim, the ice below its lip, the lid standing up behind."""
    span(k, u0, u1, v0, v1, z, z + zpx(3), "pfTrayL", top="pfTrayL")
    span(k, u0 + 0.05, u1 - 0.05, v0 + 0.05, v1 - 0.05, z + zpx(3) - 0.01, z + zpx(3), "pfRecess")
    heap(k, (u0 + u1) / 2, (v0 + v1) / 2, z + zpx(2.4), u1 - u0 - 0.1, v1 - v0 - 0.1, n, 0.065)
    if lid:
        k.box((u0 + u1) / 2, v0 + 0.01, z + zpx(3), u1 - u0 - 0.02, 0.025, (v1 - v0) * 0.55, "pfHullM", top="pfTrayL",
              rx=-1.0)


# ---- e1 embedded column -----------------------------------------------------------------------------------------------
def e1():
    k = Bench("purifier_e1", FP)
    h, cu, cv, r = zpx(20), 0.5, 0.0, 0.4
    body(k, -0.94, 0.62, h, v1=V1 - D)                                                                   # the body
    door = (-0.7, -0.26, BAND + zpx(3), h - zpx(5))
    skin(k, -0.94 + 4 * PXG, 0.2, BAND, h, door)
    span(k, -0.94 + 4 * PXG, 0.2, V1 - D, V1, zpx(1), BAND, "pfFrame", top="pfFrame")
    deep_door(k, *door, V1, 2)
    k.cyl(cu, cv, zpx(1), r, BAND - zpx(1), "pfFrame", top="pfFrame", sides=28)                          # the column
    k.cyl(cu, cv, BAND, r - 0.5 * PXG, zpx(38) - BAND, "pfHull", top="pfHull", sides=28)
    tz = h - zpx(4)                                                                                       # trim line:
    prism(k, chamfered(-0.94 - 0.5 * PXG, 0.4, V0 - 0.5 * PXG, V1 + 0.5 * PXG), tz, zpx(2), "pfTrayL", "pfTrayL")
    k.cyl(cu, cv, tz, r + 0.5 * PXG, zpx(2), "pfTrayL", top="pfTrayL", sides=28)                         # body and
    k.cyl(cu, cv, zpx(30), r + 0.5 * PXG, zpx(2), "pfTrayL", top="pfTrayL", sides=28)                    # column
    k.cyl(cu, cv, zpx(38), r - 0.5 * PXG, zpx(5), "pfHullM", top="pfTrayL", sides=28, rtop=0.2)
    k.cyl(cu, cv, zpx(43), 0.1, zpx(2), "pfFrame", top="pfTray", sides=16)
    k.cyl(cu, cv, zpx(45), 0.04, zpx(2), "pfCyan", sides=10)
    sv = cv + r                                                                                           # sight slot
    span(k, cu - 0.07, cu + 0.07, sv - 0.04, sv + 0.012, zpx(19), zpx(29), "pfFrame")
    span(k, cu - 0.05, cu + 0.05, sv - 0.03, sv + 0.016, zpx(20), zpx(25), "pfWater", top="pfWaterL")
    k.part("glass").box(cu, sv + 0.016, zpx(20), 0.1, 0.006, zpx(8), "pfIce")
    well(k, -0.86, -0.12, -0.32, 0.26, h)                                                                 # ice well
    pz = BAND + zpx(2.5)                                                                                  # front pipe
    span(k, -0.2, cu - 0.1, V1 + 0.005, V1 + 0.075, pz, pz + zpx(2.8), "pfHullM", top="pfTrayL")
    for u in (-0.16, 0.12):
        span(k, u - 0.02, u + 0.02, V1 - 0.01, V1 + 0.09, pz - zpx(0.6), pz + zpx(3.4), "pfFrame", top="pfFrame")
    lamp(k, 0.0, h - zpx(11), V1)
    spout(k, cu + r - 0.06, 0.16, zpx(6))
    return k.build()


# ---- e2 swept shell ---------------------------------------------------------------------------------------------------
LO, HI = zpx(18), zpx(36)


def roof(u):
    """e2's roof height over u: low, a smooth rise, high, a chamfered end."""
    if u < -0.24:
        return LO
    if u < 0.24:
        t = (u + 0.24) / 0.48
        return LO + (HI - LO) * (0.5 - 0.5 * math.cos(math.pi * t))
    if u < 0.86:
        return HI
    return HI - zpx(5) * (u - 0.86) / 0.08


def e2():
    k = Bench("purifier_e2", FP)
    us = [-0.94, -0.24] + [-0.24 + 0.06 * i for i in range(1, 8)] + [0.24, 0.86, 0.94]
    us = sorted(set(round(u, 4) for u in us))
    prof = [(us[0], BAND)] + [(u, roof(u)) for u in us] + [(us[-1], BAND)]
    extrude(k, [(-0.94 + PXG, 0), (0.94 - PXG, 0), (0.94 - PXG, zpx(1)), (-0.94 + PXG, zpx(1))], "v", V0 + PXG,
            V1 - PXG, "pfRecess")
    extrude(k, [(-0.94, zpx(1)), (0.94, zpx(1)), (0.94, BAND), (-0.94, BAND)], "v", V0, V1, "pfFrame", top="pfFrame")
    extrude(k, prof, "v", V0, V1, "pfHull", top="pfHull")
    for u in (-0.62, -0.16, 0.3, 0.8):                                                                    # ribs
        hz = max(roof(u - 0.025), roof(u + 0.025)) + 0.5 * PXG
        span(k, u - 0.025, u + 0.025, V0 - 0.5 * PXG, V1 + 0.5 * PXG, BAND, hz, "pfTrayL", top="pfTrayL")
    well(k, -0.9, -0.28, -0.32, 0.26, LO, n=14)                                                           # ice well
    marks(k, -0.5, V1, BAND + zpx(2), 3)
    bu0, bu1, bz0, bz1 = 0.36, 0.74, zpx(13), zpx(31)                                                     # bay window
    span(k, bu0, bu1, V1, V1 + 0.08, bz0, bz1, "pfHullM", top="pfTrayL")
    span(k, bu0 + 0.04, bu1 - 0.04, V1 + 0.05, V1 + 0.082, bz0 + zpx(2), bz1 - zpx(2), "pfRecess")
    span(k, bu0 + 0.05, bu1 - 0.05, V1 + 0.06, V1 + 0.084, bz0 + zpx(2), zpx(23), "pfWater", top="pfWaterL")
    k.part("glass").box((bu0 + bu1) / 2, V1 + 0.085, bz0 + zpx(2), bu1 - bu0 - 0.08, 0.006, bz1 - bz0 - zpx(4), "pfIce")
    for u in (0.42, 0.56, 0.7):                                                                           # filter caps
        k.cyl(u, -0.1, HI, 0.05, zpx(2), "pfTrayL", top="pfTray", sides=14)
        k.cyl(u, -0.1, HI + zpx(2), 0.025, zpx(1), "pfFrame", sides=10)
    lamp(k, 0.07, roof(0.07) - zpx(9), V1)
    spout(k, 0.94, 0.12, zpx(6))
    return k.build()


# ---- e3 cradled drum --------------------------------------------------------------------------------------------------
def e3():
    k = Bench("purifier_e3", FP)
    tz, tr, du0, du1 = zpx(22), 0.32, -0.74, 0.74
    body(k, -0.84, 0.84, tz, -0.38, 0.36 - D, 6 * PXG)                                                   # the cradle
    door = (-0.36, 0.36, BAND + zpx(3), tz - zpx(5))
    skin(k, -0.84 + 6 * PXG, 0.84 - 6 * PXG, BAND, tz, door)
    span(k, -0.84 + 6 * PXG, 0.84 - 6 * PXG, 0.36 - D, 0.36, zpx(1), BAND, "pfFrame", top="pfFrame")
    span(k, door[0], door[1], 0.36 - D, 0.36 - D + 0.4 * PXG, door[2], door[3], "pfRecess")             # sight bay
    span(k, door[0] + 0.02, door[1] - 0.02, 0.36 - D + 0.4 * PXG, 0.36 - D + 0.8 * PXG, door[2] + zpx(1),
         door[2] + zpx(5), "pfWater", top="pfWaterL")
    k.part("glass").box(0.0, 0.36 - D + 0.9 * PXG, door[2] + zpx(1), door[1] - door[0] - 0.04, 0.006,
                        door[3] - door[2] - zpx(2), "pfIce")
    for u in (-0.6, -0.48, 0.48, 0.6):
        span(k, u - 0.04, u + 0.04, 0.36, 0.36 + 0.5 * PXG, BAND + zpx(3), BAND + zpx(4), "pfAmber" if u < 0 else "pfHullM")
    extrude(k, circle(-0.01, tz, tr, 24), "u", du0, du1, "pfHull", top="pfHull")                          # the drum
    for s in range(1, 4):                                                                                 # domed ends
        f = math.cos(s * 0.45)
        extrude(k, circle(-0.01, tz, tr * f, 24), "u", du0 - 0.04 * s, du0 - 0.04 * (s - 1), "pfHull", top="pfHull")
        extrude(k, circle(-0.01, tz, tr * f, 24), "u", du1 + 0.04 * (s - 1), du1 + 0.04 * s, "pfHull", top="pfHull")
    for u in (du0 + 0.02, -0.12, 0.12, du1 - 0.02):                                                       # bands
        extrude(k, circle(-0.01, tz, tr + 0.5 * PXG, 24), "u", u - 0.025, u + 0.025, "pfTrayL", top="pfTrayL")
    hu = -0.42                                                                                            # hopper neck
    k.cyl(hu, -0.01, tz + tr - zpx(3), 0.15, zpx(9), "pfHull", top="pfHull", sides=20)
    k.cyl(hu, -0.01, tz + tr + zpx(6), 0.16, zpx(2), "pfTrayL", top="pfTrayL", sides=20)
    k.cyl(hu, -0.01, tz + tr + zpx(8), 0.16, zpx(6), "pfHullM", top="pfTrayL", sides=20, rtop=0.24)
    k.cyl(hu, -0.01, tz + tr + zpx(14) - 0.01, 0.21, 0.012, "pfRecess", sides=20)
    heap(k, hu, -0.01, tz + tr + zpx(14), 0.32, 0.32, 12, 0.06)
    fu = 0.42                                                                                             # filter dome
    k.cyl(fu, -0.01, tz + tr - zpx(2), 0.19, zpx(4), "pfTrayL", top="pfTrayL", sides=24)
    k.cyl(fu, -0.01, tz + tr + zpx(2), 0.16, zpx(4), "pfWater", top="pfWaterL", sides=24)
    for i in range(3):
        a = 0.6 + i * 2.1
        k.cyl(fu + 0.08 * math.cos(a), -0.01 + 0.08 * math.sin(a), tz + tr + zpx(2), 0.035, zpx(7), "medWhite",
              top="pfTray", sides=10)
    k.part("glass").cyl(fu, -0.01, tz + tr + zpx(2), 0.17, zpx(9), "pfIce", sides=24, rtop=0.07)
    k.cyl(fu, -0.01, tz + tr + zpx(11), 0.05, zpx(1.5), "pfFrame", top="pfCyan", sides=12)
    lamp(k, 0.6, BAND + zpx(6), 0.36)
    spout(k, du1 + 0.12, 0.08, zpx(6))
    return k.build()


VARIANTS = {"e1": e1, "e2": e2, "e3": e3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
