"""Water purifier look study, round 8 (family `purifier8`, palette set purifier, preview only; issue #321): three more
concepts where the form carries it.

  d1 press and tank: a gantry press at the left, its ram coming down on a block of ice in a crushing bed; the melt
     runs into a horizontal tank lying on two saddles at the right, domed at both ends
  d2 heat lamp: an open basin of ice and meltwater at the left, a jointed arm on the cabinet at the right reaching
     over it with a glowing lamp head; the cabinet holds the clean water behind a tall gauge
  d3 filling station: a tall melt tower at the left, a filling bay at the right under a canopy, two water canisters
     standing on the floor under its nozzles, one being filled

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .desk2_r4 import extrude
from .purifier_r3 import BAND, lamp
from .purifier_r5 import body, heap, pipe, spout
from .purifier_r7 import marks
from .purifier_study import span
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)


def circle(cx, cz, r, n=18):
    return [(cx + r * math.cos(a), cz + r * math.sin(a)) for a in (math.tau * i / n for i in range(n))]


def beam(k, a, b, v0, v1, w, col, top="pfTrayL"):
    """A slanted beam in the (u, z) plane from a to b, w thick, from v0 to v1."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz)
    nx, nz = -dz / L * w / 2, dx / L * w / 2
    extrude(k, [(a[0] + nx, a[1] + nz), (a[0] - nx, a[1] - nz), (b[0] - nx, b[1] - nz), (b[0] + nx, b[1] + nz)], "v",
            v0, v1, col, top=top)


# ---- d1 press and tank ------------------------------------------------------------------------------------------------
def d1():
    k = Bench("purifier_d1", FP)
    pu0, pu1, bh, gh = -0.9, -0.16, zpx(12), zpx(40)                                                      # crushing bed
    body(k, pu0 + 0.06, pu1 - 0.06, bh, -0.3, 0.3, 3 * PXG)
    span(k, pu0 + 0.06, pu1 - 0.06, -0.3, 0.3, bh, bh + zpx(2), "pfTrayL", top="pfTrayL")
    span(k, pu0 + 0.1, pu1 - 0.1, -0.26, 0.26, bh + zpx(2) - 0.01, bh + zpx(2), "pfRecess")
    mu = (pu0 + pu1) / 2
    heap(k, mu, 0.0, bh + zpx(2), 0.48, 0.44, 12, 0.05)
    k.box(mu, 0.0, bh + zpx(2), 0.26, 0.26, zpx(9), "pfIce", top="pfIce", rz=0.15)                        # the block
    for u in (pu0, pu1):                                                                                  # gantry
        k.box(u, 0.0, 0, 0.12, 0.34, zpx(1), "pfRecess")
        k.box(u, 0.0, zpx(1), 0.1, 0.3, BAND - zpx(1), "pfFrame", top="pfFrame")
        k.box(u, 0.0, BAND, 0.1, 0.26, gh - BAND, "pfHull", top="pfHull")
    k.box(mu, 0.0, gh - zpx(6), pu1 - pu0 + 0.1, 0.3, zpx(6), "pfHull", top="pfTrayL")
    k.box(mu, 0.0, gh, 0.22, 0.22, zpx(3), "pfFrame", top="pfTray")
    k.cyl(mu, 0.0, bh + zpx(18), 0.07, gh - zpx(6) - bh - zpx(18), "pfHullM", top="pfHullM", sides=14)  # the ram
    k.cyl(mu, 0.0, bh + zpx(11) + zpx(2), 0.045, zpx(6), "pfTrayL", sides=12)
    k.box(mu, 0.0, bh + zpx(11), 0.32, 0.3, zpx(2.5), "pfFrame", top="pfFrame")
    span(k, mu - 0.2, mu + 0.2, 0.15, 0.15 + 0.5 * PXG, gh - zpx(5), gh - zpx(1), "pfFrame")
    marks(k, mu - 0.15, 0.15 + 0.5 * PXG, gh - zpx(4), 1)
    lamp(k, mu + 0.12, gh - zpx(6), 0.15)
    tu0, tu1, tz, tr = 0.0, 0.92, zpx(18), 0.27                                                           # the tank
    for u in (0.2, 0.72):                                                                                 # saddles
        extrude(k, [(-0.3, 0), (0.3, 0), (0.3, tz - tr * 0.4), (-0.3, tz - tr * 0.4)], "u", u - 0.05, u + 0.05,
                "pfFrame", top="pfFrame")
    extrude(k, circle(0.0, tz, tr), "u", tu0 + 0.1, tu1 - 0.1, "pfHull", top="pfHull")
    for s in range(1, 4):                                                                                 # domed ends
        f = math.cos(s * 0.42)
        for a0, a1 in ((tu0 + 0.1 - 0.035 * s, tu0 + 0.1 - 0.035 * (s - 1)), (tu1 - 0.1 + 0.035 * (s - 1),
                                                                               tu1 - 0.1 + 0.035 * s)):
            extrude(k, circle(0.0, tz, tr * f), "u", a0, a1, "pfHull", top="pfHull")
    for u in (0.32, 0.6):                                                                                 # bands
        extrude(k, circle(0.0, tz, tr + 0.5 * PXG), "u", u - 0.02, u + 0.02, "pfTrayL", top="pfTrayL")
    k.cyl(0.46, 0.0, tz + tr - zpx(2), 0.08, zpx(4), "pfHullM", top="pfTrayL", sides=14)                 # its hatch
    k.cyl(0.46, 0.0, tz + tr + zpx(2), 0.035, zpx(1.5), "pfCyan", sides=10)
    gv = tr - 0.02                                                                                        # sight strip
    span(k, 0.38, 0.54, gv, gv + 0.05, tz - zpx(3), tz + zpx(3), "pfFrame")
    span(k, 0.4, 0.52, gv + 0.05, gv + 0.06, tz - zpx(2), tz + zpx(0.5), "pfWater", top="pfWaterL")
    pipe(k, (pu1 - 0.06, 0.12, zpx(6)), (tu0 + 0.1, 0.12, zpx(6)), 0.06, "pfHullM")                        # melt line
    spout(k, tu1 - 0.02, 0.0, zpx(5))
    return k.build()


# ---- d2 heat lamp -----------------------------------------------------------------------------------------------------
def d2():
    k = Bench("purifier_d2", FP)
    bu0, bu1, bh = -0.94, 0.2, zpx(13)                                                                    # the basin
    body(k, bu0, bu1, bh, -0.36, 0.36)
    span(k, bu0, bu1, -0.36, 0.36, bh, bh + zpx(3), "pfTrayL", top="pfTrayL")
    span(k, bu0 + 0.05, bu1 - 0.05, -0.31, 0.31, bh + zpx(3) - 0.01, bh + zpx(3), "pfRecess")
    k.box((bu0 + bu1) / 2, 0.0, bh + zpx(1.5), bu1 - bu0 - 0.11, 0.61, zpx(1.7), "pfWater", top="pfWater")
    for i, (u, v, s, r) in enumerate(((-0.7, -0.12, 0.2, 0.3), (-0.44, 0.1, 0.17, 1.1), (-0.5, -0.16, 0.12, 2.0),
                                      (-0.2, -0.06, 0.18, 0.7), (-0.02, 0.14, 0.11, 1.6), (-0.76, 0.16, 0.1, 2.4))):
        k.box(u, v, bh + zpx(2.6), s, s * 0.85, s * 0.5, "pfIce" if i % 2 else "pfIceD", top="pfIce", rz=r)
    marks(k, bu0 + 0.14, 0.36, BAND + zpx(1), 2)
    cu0, cu1, ch = 0.26, 0.94, zpx(26)                                                                    # the cabinet
    body(k, cu0, cu1, ch, -0.38, 0.36)
    span(k, 0.36, 0.48, 0.36 - 0.02, 0.36 + 0.5 * PXG, BAND + zpx(2), ch - zpx(4), "pfFrame")              # its gauge
    span(k, 0.38, 0.46, 0.36 + 0.5 * PXG, 0.36 + PXG, BAND + zpx(3), zpx(18), "pfWater", top="pfWaterL")
    lamp(k, 0.6, ch - zpx(9), 0.36)
    for i in range(4):
        span(k, 0.68, 0.86, 0.36, 0.36 + 0.5 * PXG, BAND + zpx(3 + 3 * i), BAND + zpx(4 + 3 * i), "pfHullM")
    spout(k, cu1, 0.1, zpx(6))
    tu, tv = 0.6, -0.12                                                                                   # the arm
    k.cyl(tu, tv, ch, 0.14, zpx(4), "pfFrame", top="pfTray", sides=18)
    k.cyl(tu, tv, ch + zpx(4), 0.08, zpx(4), "pfHullM", top="pfTrayL", sides=14)
    j1 = (tu, ch + zpx(20))
    j2 = (-0.36, ch + zpx(22))
    beam(k, (tu, ch + zpx(7)), j1, tv - 0.04, tv + 0.04, 0.08, "pfHull")
    beam(k, j1, j2, tv - 0.035, tv + 0.035, 0.07, "pfHull")
    for (u, z) in (j1, j2):
        extrude(k, circle(u, z, 0.06, 12), "v", tv - 0.06, tv + 0.06, "pfFrame", top="pfFrame")
    hu, hz = -0.36, ch + zpx(9)                                                                           # lamp head
    beam(k, j2, (hu, hz + zpx(6)), tv - 0.03, tv + 0.03, 0.05, "pfHullM")
    k.box(hu, tv + 0.06, hz, 0.28, 0.26, zpx(6), "pfHull", top="pfHull", taper=0.6)
    k.box(hu, tv + 0.06, hz - zpx(1), 0.26, 0.24, zpx(1), "pfHeat")
    return k.build()


# ---- d3 filling station -----------------------------------------------------------------------------------------------
def canister(k, u, v, z, fill=None):
    k.box(u, v, z, 0.2, 0.26, zpx(13), "pfWaterD", top="pfWater", bevel=0.015)
    k.box(u, v, z + zpx(4), 0.205, 0.265, zpx(2), "pfWater")
    k.box(u, v - 0.02, z + zpx(13), 0.05, 0.16, zpx(3), "pfWaterD", top="pfWater")                       # handle
    k.cyl(u + 0.05, v + 0.07, z + zpx(13), 0.03, zpx(2), "pfFrame", top="pfTrayL", sides=10)               # cap


def d3():
    k = Bench("purifier_d3", FP)
    th = zpx(38)
    body(k, -0.94, -0.3, th, -0.38, 0.36)                                                                 # the tower
    span(k, -0.88, -0.36, -0.32, 0.3, th, th + zpx(2), "pfTrayL", top="pfTrayL")
    span(k, -0.84, -0.4, -0.28, 0.26, th + zpx(2) - 0.01, th + zpx(2), "pfRecess")
    heap(k, -0.62, -0.01, th + zpx(2), 0.4, 0.5, 14, 0.07)
    for i in range(5):                                                                                    # its fins
        z = BAND + zpx(6 + 4 * i)
        span(k, -0.9, -0.34, 0.36, 0.36 + 0.06, z, z + zpx(1.5), "pfHullM", top="pfTrayL")
    marks(k, -0.84, 0.36, BAND + zpx(1), 1)
    lamp(k, -0.48, BAND + zpx(1), 0.36)
    span(k, -0.3, 0.94, -0.38, -0.22, 0, zpx(1), "pfRecess")                                             # back wall
    span(k, -0.3, 0.94, -0.38, -0.22, zpx(1), BAND, "pfFrame", top="pfFrame")
    span(k, -0.3, 0.94, -0.38, -0.22, BAND, zpx(32), "pfHull", top="pfHull")
    cz = zpx(28)                                                                                          # canopy
    span(k, -0.3, 0.94, -0.22, 0.2, cz, zpx(32), "pfHull", top="pfHull")
    span(k, -0.28, 0.92, 0.2, 0.22, cz + zpx(0.5), zpx(31.5), "pfTrayL", top="pfTrayL")
    lamp(k, 0.3, cz - zpx(0.5), 0.22)
    marks(k, 0.66, 0.22, cz + zpx(1.5), 1)
    span(k, 0.9, 0.94, -0.22, 0.24, 0, cz, "pfHull", top="pfHull")                                        # end post
    for u in (0.05, 0.55):                                                                                # nozzles
        k.cyl(u, 0.02, cz - zpx(4), 0.05, zpx(4), "pfHullM", top="pfHullM", sides=12)
        k.cyl(u, 0.02, cz - zpx(5), 0.025, zpx(1), "pfFrame", sides=10)
    canister(k, 0.05, 0.04, 0)
    canister(k, 0.55, 0.04, 0)
    k.cyl(0.55, 0.02, zpx(16), 0.012, cz - zpx(5) - zpx(16), "pfWaterL", sides=8)            # the stream
    return k.build()


VARIANTS = {"d1": d1, "d2": d2, "d3": d3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
