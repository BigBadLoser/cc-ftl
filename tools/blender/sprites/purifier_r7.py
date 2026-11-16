"""Water purifier look study, round 7 (family `purifier7`, palette set purifier, preview only; issue #321): three more
concepts where the form carries it.

  c1 conveyor and centrifuge: the ice dropped in a low loading tray at the left rides a slanted belt up into an
     octagonal centrifuge at the right; under its glass dome a rotor spins in a ring of water
  c2 cascade: three stepped tanks falling left to right, ice in the top one, slush in the middle, water in the
     bottom; a spout on each step pours a sheet of water into the next
  c3 UV rack: a melt tank at the left feeds an open frame at the right where the water runs through three glowing
     UV tubes, U-bends joining them at the ends, a ballast box on top

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .purifier_kit import prism
from .purifier_kit import extrude
from .purifier_r3 import BAND, lamp
from .purifier_r5 import body, heap, pipe, spout
from .purifier_study import span
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)


def octagon(cu, cv, r):
    return [(cu + r * math.cos(a), cv + r * math.sin(a)) for a in (math.pi / 8 + math.tau * i / 8 for i in range(8))]


def marks(k, u0, v, z, n=2, col="pfAmber"):
    for i in range(n):
        span(k, u0, u0 + 0.1, v, v + 0.5 * PXG, z + zpx(3 * i), z + zpx(3 * i + 1), col)


# ---- c1 conveyor and centrifuge ---------------------------------------------------------------------------------------
def c1():
    k = Bench("purifier_c1", FP)
    cu, cv, r, h = 0.5, -0.02, 0.4, zpx(27)                                                               # centrifuge
    prism(k, octagon(cu, cv, r - PXG), 0, zpx(1), "pfRecess")
    prism(k, octagon(cu, cv, r), zpx(1), BAND - zpx(1), "pfFrame", "pfFrame")
    prism(k, octagon(cu, cv, r), BAND, h - BAND, "pfHull", "pfHull")
    prism(k, octagon(cu, cv, r + 0.5 * PXG), zpx(14), zpx(2), "pfTrayL", "pfTrayL")
    prism(k, octagon(cu, cv, r + PXG), h, zpx(2), "pfTrayL", "pfTrayL")                                  # its rim
    prism(k, octagon(cu, cv, r - 0.07), h + zpx(2) - 0.01, 0.012, "pfRecess")
    k.cyl(cu, cv, h + zpx(2), r - 0.1, zpx(0.3), "pfWater", top="pfWater", sides=24)
    k.cyl(cu, cv, h + zpx(2), 0.08, zpx(3), "pfHullM", top="pfTrayL", sides=14)                         # rotor
    for i in range(4):
        a = i * math.pi / 2 + 0.4
        k.box(cu + 0.15 * math.cos(a), cv + 0.15 * math.sin(a), h + zpx(2.3), 0.22, 0.05, zpx(1.2), "pfTrayL",
              top="pfTrayL", rz=a)
    k.part("glass").cyl(cu, cv, h + zpx(2), r - 0.04, zpx(9), "pfIce", sides=24, rtop=0.12)
    k.cyl(cu, cv, h + zpx(11), 0.1, zpx(1.5), "pfFrame", top="pfFrame", sides=14)
    k.cyl(cu, cv, h + zpx(12.5), 0.04, zpx(1.5), "pfCyan", sides=10)
    span(k, cu - 0.16, cu + 0.16, cv + r - 0.05, cv + r + 0.5 * PXG, BAND + zpx(1), BAND + zpx(4), "pfRecess")
    marks(k, cu - 0.12, cv + r + 0.5 * PXG, BAND + zpx(2), 1, "pfAmber")
    spout(k, cu + r - 0.04, cv + 0.14, zpx(6))
    tu, tv = -0.72, 0.06                                                                                  # load tray
    body(k, tu - 0.22, tu + 0.22, zpx(10), tv - 0.26, tv + 0.26, 3 * PXG)
    span(k, tu - 0.22, tu + 0.22, tv - 0.26, tv + 0.26, zpx(10), zpx(13), "pfTrayL", top="pfTrayL")
    span(k, tu - 0.18, tu + 0.18, tv - 0.22, tv + 0.22, zpx(13) - 0.01, zpx(13), "pfRecess")
    heap(k, tu, tv, zpx(13), 0.34, 0.42, 12, 0.07)
    marks(k, tu - 0.14, tv + 0.26, BAND + zpx(1))
    a0, z0, a1, z1, bw = tu + 0.1, zpx(11), cu - r + 0.06, h + zpx(4), 0.13                               # the belt
    dx, dz = a1 - a0, z1 - z0
    L = math.hypot(dx, dz)
    nx, nz = -dz / L, dx / L
    t = zpx(2)
    belt = [(a0, z0), (a1, z1), (a1 + nx * t, z1 + nz * t), (a0 + nx * t, z0 + nz * t)]
    extrude(k, belt, "v", tv - bw, tv + bw, "pfRecess", top="pfFrame")
    rail = [(a0 - nx * t, z0 - nz * t), (a1 - nx * t, z1 - nz * t), (a1 + nx * 2.4 * t, z1 + nz * 2.4 * t),
            (a0 + nx * 2.4 * t, z0 + nz * 2.4 * t)]
    for v0, v1 in ((tv - bw - 0.04, tv - bw), (tv + bw, tv + bw + 0.04)):
        extrude(k, rail, "v", v0, v1, "pfHull", top="pfTrayL")
    for i in range(4):                                                                                    # ice riding it
        f = 0.2 + 0.2 * i
        u, z = a0 + dx * f, z0 + dz * f + t
        s = 0.08 + 0.015 * (i % 2)
        k.box(u, tv - 0.04 + 0.06 * (i % 2), z - 0.01, s, s, s * 0.7, "pfIce" if i % 2 else "pfIceD", top="pfIce",
              rz=i * 1.1, ry=-math.atan2(dz, dx))
    lu = a0 + dx * 0.55                                                                                   # its leg
    for v in (tv - bw - 0.02, tv + bw + 0.02):
        k.box(lu, v, 0, 0.05, 0.04, z0 + dz * 0.55, "pfFrame", top="pfFrame")
    span(k, lu - 0.04, lu + 0.04, tv - bw - 0.04, tv + bw + 0.04, zpx(1), zpx(3), "pfFrame", top="pfFrame")
    return k.build()


# ---- c2 cascade -------------------------------------------------------------------------------------------------------
STEPS = ((-0.94, -0.3, zpx(30)), (-0.36, 0.3, zpx(21)), (0.24, 0.94, zpx(12)))
CV0, CV1 = -0.36, 0.36


def c2():
    k = Bench("purifier_c2", FP)
    for i, (u0, u1, h) in enumerate(STEPS):
        body(k, u0, u1, h, CV0 - 0.02 * i, CV1 - 0.02 * i, 3 * PXG)
        span(k, u0 + 0.02, u1 - 0.02, CV0 + 0.02, CV1 - 0.04 - 0.02 * i, h, h + zpx(2), "pfTrayL", top="pfTrayL")
        span(k, u0 + 0.06, u1 - 0.06, CV0 + 0.06, CV1 - 0.08 - 0.02 * i, h + zpx(2) - 0.01, h + zpx(2), "pfRecess")
    (a0, a1, h0), (b0, b1, h1), (c0, c1_, h2) = STEPS
    heap(k, (a0 + a1) / 2, -0.03, h0 + zpx(2), 0.5, 0.56, 16, 0.07)                                       # ice,
    k.box((b0 + b1) / 2, -0.04, h1 + zpx(2) - 0.01, b1 - b0 - 0.14, 0.56, zpx(0.4), "pfWaterL", top="pfWaterL")
    for i, (du, dv) in enumerate(((-0.14, -0.1), (0.05, 0.08), (0.12, -0.12), (-0.06, 0.12))):             # slush,
        k.box((b0 + b1) / 2 + du, -0.04 + dv, h1 + zpx(2), 0.06, 0.06, 0.03, "pfIce", top="pfIce", rz=i)
    k.box((c0 + c1_) / 2, -0.05, h2 + zpx(2) - 0.01, c1_ - c0 - 0.14, 0.54, zpx(0.5), "pfWater", top="pfWater")
    for (u, z_top, z_bot) in ((a1 - 0.02, h0 + zpx(1.5), h1 + zpx(2)), (b1 - 0.02, h1 + zpx(1.5), h2 + zpx(2))):
        span(k, u - 0.03, u + 0.09, -0.12, 0.04, z_top - zpx(1), z_top + zpx(0.5), "pfHullM", top="pfTrayL")  # spout
        span(k, u + 0.06, u + 0.075, -0.1, 0.02, z_bot, z_top - zpx(1), "pfWaterL")                         # its sheet
    marks(k, a0 + 0.2, CV1, BAND + zpx(4), 3)                                                             # fronts
    for i in range(4):
        u = b0 + 0.12 + i * 0.1
        span(k, u, u + 0.05, CV1 - 0.02, CV1 - 0.02 + 0.5 * PXG, BAND + zpx(3), BAND + zpx(9), "pfHeat")
    lamp(k, c0 + 0.16, BAND + zpx(1), CV1 - 0.04)
    span(k, c0 + 0.3, c1_ - 0.12, CV1 - 0.04, CV1 - 0.04 + 0.5 * PXG, BAND + zpx(1), h2 - zpx(1), "pfFrame")
    span(k, c0 + 0.32, c1_ - 0.14, CV1 - 0.04 + 0.5 * PXG, CV1 - 0.04 + PXG, BAND + zpx(1.5), h2 - zpx(2.5), "pfWater")
    spout(k, c1_, 0.1, zpx(6))
    return k.build()


# ---- c3 UV rack -------------------------------------------------------------------------------------------------------
RU0, RU1, RV0, RV1, RH = -0.24, 0.94, -0.3, 0.3, zpx(30)


def tube(k, u0, u1, v, z, r):
    circle = [(v + r * math.cos(a), z + r * math.sin(a)) for a in (math.tau * i / 14 for i in range(14))]
    return extrude(k, circle, "u", u0, u1, "pfCyan")


def c3():
    k = Bench("purifier_c3", FP)
    body(k, -0.94, -0.3, zpx(26), -0.38, 0.36)                                                            # melt tank
    span(k, -0.86, -0.38, -0.3, 0.26, zpx(26), zpx(28), "pfTrayL", top="pfTrayL")
    span(k, -0.82, -0.42, -0.26, 0.22, zpx(28) - 0.01, zpx(28), "pfRecess")
    heap(k, -0.62, -0.02, zpx(28), 0.38, 0.46, 14, 0.07)
    marks(k, -0.84, 0.36, BAND + zpx(3), 3)
    lamp(k, -0.48, BAND + zpx(3), 0.36)
    for u, v in ((RU0, RV0), (RU0, RV1), (RU1 - 0.04, RV0), (RU1 - 0.04, RV1)):                           # the frame
        k.box(u + 0.02, v, 0, 0.08, 0.08, zpx(2), "pfRecess")
        k.box(u + 0.02, v, zpx(1), 0.06, 0.06, RH - zpx(1), "pfHull", top="pfHull")
    for z in (zpx(3), RH - zpx(2)):
        for v in (RV0, RV1):
            span(k, RU0 + 0.05, RU1 - 0.06, v - 0.025, v + 0.025, z, z + zpx(2), "pfHull", top="pfTrayL")
        for u in (RU0 + 0.02, RU1 - 0.02):
            span(k, u - 0.025, u + 0.025, RV0 + 0.03, RV1 - 0.03, z, z + zpx(2), "pfHull", top="pfTrayL")
    zs = (zpx(9), zpx(15.5), zpx(22))                                                                     # the tubes
    for i, z in enumerate(zs):
        tube(k, RU0 + 0.12, RU1 - 0.12, 0.0, z, 0.035)
        circle = [(0.075 * math.cos(a), z + 0.075 * math.sin(a)) for a in (math.tau * j / 16 for j in range(16))]
        extrude(k.part("glass"), circle, "u", RU0 + 0.1, RU1 - 0.1, "pfIce")
        for u in (RU0 + 0.08, RU1 - 0.12):
            k.box(u + 0.02, 0.0, z - 0.06, 0.05, 0.17, 0.12, "pfHullM", top="pfTrayL")                      # end caps
    for (u, za, zb) in ((RU1 - 0.07, zs[0], zs[1]), (RU0 + 0.13, zs[1], zs[2])):                            # U-bends
        span(k, u - 0.025, u + 0.025, 0.06, 0.11, za, zb, "pfHullM", top="pfTrayL")
    pipe(k, (-0.3, 0.0, zs[2]), (RU0 + 0.08, 0.0, zs[2]), 0.06, "pfHullM")                                 # inlet
    k.box(0.35, 0.0, RH, 0.5, 0.3, zpx(5), "pfFrame", top="pfTray")                                        # ballast
    for i in range(4):
        span(k, 0.16 + i * 0.12, 0.22 + i * 0.12, -0.11, 0.11, RH + zpx(5), RH + zpx(5.5), "pfRecess")
    marks(k, 0.3, 0.15, RH + zpx(1.5), 1)
    spout(k, RU1, 0.14, zpx(6))
    return k.build()


VARIANTS = {"c1": c1, "c2": c2, "c3": c3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
