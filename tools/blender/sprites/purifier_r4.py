"""Water purifier look study, round 4 (family `purifier4`, palette set purifier, preview only; issue #321): three more
concepts in life support's design language (user: new concepts on each variant). Round 3's parts (pale housing, dark
lower band, amber marks, cyan lamp, round end port) carry over; what changes is how ice goes in and water shows.

  z1 porthole: a front-loader; the ice goes in through a round hatch on the front at the left (the melt chamber behind
     it, its heater ring glowing round the ice), the right half louvred with a water sight strip and three filter caps
     in the top
  z2 drawer: a low housing; the ice goes in a drawer pulled out of its front at the left, the water stands in a round
     glass well set into the top at the right
  z3 wedge: one sloped body, low at the front, tall at the back; a slanted window across the slope shows the water and
     the ice floating on it, the ice goes in through a hatch on the flat top behind

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .purifier_kit import extrude
from .purifier_r3 import BAND, UE, V0, V1, door, housing, lamp, louvres, port
from .purifier_study import ice, span
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)


def disc(cu, cz, r, n=20):
    """A circle in the (u, z) plane, for extruding along v."""
    return [(cu + r * math.cos(a), cz + r * math.sin(a)) for a in (math.tau * i / n for i in range(n))]


# ---- z1 porthole ------------------------------------------------------------------------------------------------------
def z1():
    k = Bench("purifier_z1", FP)
    h = zpx(30)
    housing(k, -UE, UE, h)
    pu, pz, r = -0.36, zpx(18), 0.19                                                                      # the hatch
    extrude(k, disc(pu, pz, r + 0.04), "v", V1 - 0.01, V1 + 1.5 * PXG, "pfHullM")
    extrude(k, disc(pu, pz, r), "v", V1, V1 + 2 * PXG, "pfHeat")
    extrude(k, disc(pu, pz, r - 0.025), "v", V1, V1 + 2.4 * PXG, "pfRecess")
    for i, (du, dz, s) in enumerate(((-0.08, -0.1, 0.07), (0.0, -0.11, 0.08), (0.08, -0.09, 0.06), (-0.03, -0.04, 0.06),
                                     (0.05, -0.03, 0.05))):                                               # the ice
        k.box(pu + du, V1 + 2.4 * PXG, pz + dz, s, 0.012, s * 0.8, "pfIce" if i % 2 else "pfIceD", rz=0.0)
    k.part("glass").box(pu, V1 + 2.7 * PXG, pz - r + 0.03, 2 * r - 0.06, 0.006, 2 * r - 0.06, "pfIce")
    span(k, pu - r - 0.07, pu - r - 0.02, V1, V1 + 2 * PXG, pz - 0.06, pz + 0.06, "pfFrame")              # hinge
    span(k, pu + r + 0.02, pu + r + 0.06, V1, V1 + 2 * PXG, pz - 0.03, pz + 0.03, "pfAmber")              # latch
    span(k, 0.02, 0.06, V1 - PXG, V1 + 0.2 * PXG, BAND, h, "pfHullM")                                     # the seam
    louvres(k, 0.16, 0.8, h - zpx(9), h - zpx(2), n=4)
    span(k, 0.14, 0.82, V1 - 0.5 * PXG, V1 + 0.3 * PXG, BAND + zpx(3), BAND + zpx(10), "pfFrame")          # sight strip
    span(k, 0.16, 0.8, V1, V1 + 0.5 * PXG, BAND + zpx(4), BAND + zpx(7), "pfWater", top="pfWaterL")
    k.part("glass").box(0.48, V1 + 0.6 * PXG, BAND + zpx(4), 0.64, 0.008, zpx(5), "pfIce")
    lamp(k, 0.04, BAND + zpx(13))
    for u in (0.24, 0.48, 0.72):                                                                          # filter caps
        k.cyl(u, -0.06, h, 0.09, zpx(1.5), "pfTrayL", top="pfTray", sides=16)
        k.cyl(u, -0.06, h + zpx(1.5), 0.045, zpx(1), "pfFrame", top="pfRecess", sides=12)
    span(k, -0.8, -0.12, -0.3, 0.26, h, h + zpx(1), "pfTrayL", top="pfTrayL")                              # top plate
    for i in range(4):
        span(k, -0.72 + i * 0.16, -0.62 + i * 0.16, -0.22, 0.18, h + zpx(1), h + zpx(1.5), "pfRecess")
    port(k, UE, zpx(14))
    return k.build()


# ---- z2 drawer --------------------------------------------------------------------------------------------------------
def z2():
    k = Bench("purifier_z2", FP)
    h = zpx(22)
    housing(k, -UE, UE, h)
    u0, u1, z0, z1_ = -0.76, -0.12, BAND + zpx(2), h - zpx(3)                                             # the slot
    span(k, u0 - 0.03, u1 + 0.03, V1 - 0.5 * PXG, V1 + 0.3 * PXG, z0 - zpx(1), z1_ + zpx(1), "pfFrame")
    span(k, u0, u1, V1 - 0.3 * PXG, V1 + 0.35 * PXG, z0, z1_, "pfRecess")
    dv0, dv1, dz = V1 - 0.2, V1 + 0.2, z1_ - zpx(2)                                                       # the drawer
    span(k, u0 + 0.02, u1 - 0.02, dv0, dv1, z0 + zpx(1), dz, "pfTrayL", top="pfTrayL")
    span(k, u0 + 0.02, u1 - 0.02, dv1 - zpx(0) - 1.5 * PXG, dv1, z0 + zpx(1), dz + zpx(2), "pfHullM", top="pfHullM")
    span(k, u0 + 0.05, u1 - 0.05, dv0 + 0.03, dv1 - 0.06, dz, dz + zpx(0.2), "pfTray")
    ice(k, (u0 + u1) / 2, (dv0 + dv1) / 2 - 0.02, dz + zpx(0.2), u1 - u0 - 0.02, dv1 - dv0 - 0.04, 10)
    span(k, (u0 + u1) / 2 - 0.12, (u0 + u1) / 2 + 0.12, dv1, dv1 + 0.02, dz - zpx(3), dz - zpx(1.5), "pfFrame")
    span(k, u1 - 0.1, u1 - 0.05, dv1, dv1 + 0.6 * PXG, z0 + zpx(3), z0 + zpx(4), "pfAmber")
    wu, wv, r = 0.46, -0.04, 0.3                                                                          # the well
    k.cyl(wu, wv, h, r + 0.04, zpx(1.5), "pfTrayL", top="pfTrayL", sides=28)
    k.cyl(wu, wv, h + zpx(1.5), r, zpx(0.2), "pfTray", sides=28)
    k.cyl(wu, wv, h + zpx(1.7), r - 0.03, zpx(0.3), "pfWater", top="pfWater", sides=28)
    for i in range(7):                                                                                    # its swirl
        a = 0.6 + i * 0.55
        rr = 0.1 + i * 0.022
        k.box(wu + rr * math.cos(a), wv + rr * math.sin(a), h + zpx(2), 0.05, 0.02, zpx(0.2), "pfWaterL", rz=a + 1.57)
    k.part("glass").cyl(wu, wv, h + zpx(2.3), r, zpx(0.4), "pfIce", sides=28)
    door(k, 0.1, 0.82, BAND + zpx(2), h - zpx(3), marks=1)
    lamp(k, 0.0, BAND + zpx(5))
    port(k, UE, zpx(12), 0.09)
    return k.build()


# ---- z3 wedge ---------------------------------------------------------------------------------------------------------
LO, HI, BK = zpx(13), zpx(34), 0.24             # z3: the front's height, the back's, the flat top's depth


def slope(t, s):
    """A point on z3's slope: t along it from the front edge (0..1), s out from it."""
    fv, fz, bv, bz = V1, LO, V0 + BK, HI
    L = math.hypot(fv - bv, bz - fz)
    nv, nz = (bz - fz) / L, (fv - bv) / L
    return fv + (bv - fv) * t + nv * s, fz + (bz - fz) * t + nz * s


def panel(k, t0, t1, s0, s1, a0, a1, col, part=None):
    pts = [slope(t0, s0), slope(t1, s0), slope(t1, s1), slope(t0, s1)]
    extrude(part and k.part(part) or k, pts, "u", a0, a1, col, top=col)


def z3():
    k = Bench("purifier_z3", FP)
    extrude(k, [(V0 + PXG, 0), (V1 - PXG, 0), (V1 - PXG, zpx(1)), (V0 + PXG, zpx(1))], "u", -UE + PXG, UE - PXG,
            "pfRecess")
    extrude(k, [(V0, zpx(1)), (V1, zpx(1)), (V1, BAND), (V0, BAND)], "u", -UE, UE, "pfFrame", top="pfFrame")
    body = [(V0, BAND), (V1, BAND), (V1, LO), (V0 + BK, HI), (V0, HI)]
    extrude(k, body, "u", -UE + 0.04, UE - 0.04, "pfHull", top="pfHull")
    g = 0.5 * PXG                                                                                         # end frames
    cap = [(V0 - g, BAND), (V1 + g, BAND), (V1 + g, LO + g), (V0 + BK, HI + g), (V0 - g, HI + g)]
    for a0, a1 in ((-UE, -UE + 0.04), (UE - 0.04, UE)):
        extrude(k, cap, "u", a0, a1, "pfHullM", top="pfTrayL")
    a0, a1 = -0.72, 0.6                                                                                   # the window
    panel(k, 0.1, 0.9, 0, 0.8 * PXG, a0 - 0.03, a1 + 0.03, "pfFrame")
    panel(k, 0.14, 0.52, 0, 1.2 * PXG, a0, a1, "pfWater")
    panel(k, 0.5, 0.53, 0, 1.3 * PXG, a0, a1, "pfWaterL")
    panel(k, 0.53, 0.86, 0, 1.2 * PXG, a0, a1, "pfRecess")
    for i in range(7):                                                                                    # floating ice
        u = a0 + 0.1 + i * 0.18
        t = 0.55 + 0.06 * (i % 2)
        panel(k, t, t + 0.1 + 0.03 * (i % 3), 1.2 * PXG, 2 * PXG, u, u + 0.1 + 0.02 * (i % 2),
              "pfIce" if i % 2 else "pfIceD")
    panel(k, 0.14, 0.86, 2.2 * PXG, 2.5 * PXG, a0, a1, "pfIce", "glass")
    span(k, a1 + 0.08, a1 + 0.2, V1, V1 + 0.6 * PXG, BAND + zpx(2), LO - zpx(2), "pfFrame")              # lamp, marks
    span(k, a1 + 0.11, a1 + 0.17, V1 + 0.6 * PXG, V1 + 0.8 * PXG, BAND + zpx(3), LO - zpx(3), "pfCyan")
    for i in range(3):
        span(k, a0 + 0.06 + i * 0.12, a0 + 0.14 + i * 0.12, V1, V1 + 0.5 * PXG, BAND + zpx(2.5), BAND + zpx(3.5),
             "pfAmber")
    span(k, -0.82, -0.12, V0 + 0.03, V0 + BK - 0.02, HI, HI + zpx(1.5), "pfTrayL", top="pfTrayL")        # the hatch
    span(k, -0.78, -0.16, V0 + 0.06, V0 + BK - 0.05, HI + zpx(1.5), HI + zpx(1.6), "pfRecess")
    ice(k, -0.47, V0 + BK / 2 + 0.005, HI + zpx(1.6), 0.62, BK - 0.04, 8)
    span(k, 0.0, 0.8, V0 + 0.05, V0 + BK - 0.04, HI, HI + zpx(1), "pfTray", top="pfTray")                 # vent
    for i in range(5):
        span(k, 0.06 + i * 0.15, 0.14 + i * 0.15, V0 + 0.08, V0 + BK - 0.07, HI + zpx(1), HI + zpx(1.5), "pfRecess")
    port(k, UE, zpx(12))
    return k.build()


VARIANTS = {"z1": z1, "z2": z2, "z3": z3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
