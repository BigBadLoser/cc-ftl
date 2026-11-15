"""Water purifier look study, round 6 (family `purifier6`, palette set purifier, preview only; issue #321): three more
concepts where the form carries it (user: round 5 a much better direction, they look like they do something).

  b1 coil still: a boiler box at the left (its ice hatch open on top, the heater glowing through a deep slot in its
     front), a glass column at the right with water in it and a coil wound round it, a vapour pipe arching back
  b2 filter press: a row of upright filter plates clamped between two end frames by tie rods, the ice funnel on the
     tall left frame, a drip trough along the front running to a spout at the right
  b3 sphere: a round melt vessel in a four-legged cradle, a banded equator and a round sight port; a small feeder
     at the left lifts the ice up a slanted screw tube into it; the water drains down to a tap below

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .desk2_r4 import extrude
from .purifier_r3 import BAND, V1, lamp
from .purifier_r5 import body, heap, pipe, skin, spout
from .purifier_study import span
from .research_kit import PXG, Bench, ring, zpx

PAL = "purifier"
FP = (2, 1)
D = 3 * PXG


def funnel(k, u, v, z, w, d, h, n=20):
    """A flared funnel standing on a top at z, ice heaped in its mouth."""
    k.box(u, v, z, w, d, zpx(2), "pfFrame", top="pfFrame")
    k.box(u, v, z + zpx(2), w, d, h, "pfHullM", top="pfTrayL", taper=1.3)
    k.box(u, v, z + zpx(2) + h - 0.01, w * 1.12, d * 1.12, 0.012, "pfRecess")
    heap(k, u, v, z + zpx(2) + h, w * 1.05, d * 1.05, n, 0.06)


# ---- b1 coil still ----------------------------------------------------------------------------------------------------
def b1():
    k = Bench("purifier_b1", FP)
    bh = zpx(20)
    body(k, -0.94, -0.06, bh, v1=V1 - D)                                                                 # the boiler
    slot = (-0.74, -0.26, BAND + zpx(3), BAND + zpx(7))
    skin(k, -0.94 + 4 * PXG, -0.06 - 4 * PXG, BAND, bh, slot)
    span(k, -0.94 + 4 * PXG, -0.06 - 4 * PXG, V1 - D, V1, zpx(1), BAND, "pfFrame", top="pfFrame")
    span(k, slot[0], slot[1], V1 - D, V1 - D + 0.4 * PXG, slot[2], slot[3], "pfRecess")
    for i in range(6):
        u = slot[0] + 0.04 + i * 0.08
        span(k, u, u + 0.04, V1 - D + 0.4 * PXG, V1 - D + 0.8 * PXG, slot[2] + zpx(1), slot[3] - zpx(1), "pfHeat")
    hu, hv = -0.52, -0.04                                                                                 # ice hatch
    span(k, hu - 0.26, hu + 0.26, hv - 0.26, hv + 0.24, bh, bh + zpx(2), "pfTrayL", top="pfTrayL")
    span(k, hu - 0.21, hu + 0.21, hv - 0.21, hv + 0.19, bh + zpx(2) - 0.01, bh + zpx(2), "pfRecess")
    heap(k, hu, hv - 0.01, bh + zpx(2), 0.4, 0.38, 16, 0.06)
    k.box(hu, hv - 0.27, bh + zpx(1), 0.5, 0.025, 0.3, "pfHullM", top="pfTrayL", rx=-0.35)                # its lid
    lamp(k, -0.14, bh - zpx(7), V1)
    cu, cv = 0.5, -0.02                                                                                   # the column
    k.cyl(cu, cv, zpx(1), 0.33, BAND - zpx(1), "pfFrame", top="pfFrame", sides=24)
    k.cyl(cu, cv, BAND, 0.31, zpx(6), "pfHull", top="pfTrayL", sides=24)
    k.cyl(cu, cv, BAND + zpx(6), 0.19, zpx(28), "pfRecess", sides=20)
    k.cyl(cu, cv, BAND + zpx(6), 0.17, zpx(17), "pfWater", top="pfWaterL", sides=20)
    k.part("glass").cyl(cu, cv, BAND + zpx(6), 0.2, zpx(28), "pfIce", sides=20)
    ct = BAND + zpx(34)
    k.cyl(cu, cv, ct, 0.27, zpx(5), "pfHull", top="pfHull", sides=24)
    k.cyl(cu, cv, ct + zpx(5), 0.27, zpx(2), "pfHullM", top="pfTrayL", sides=24, rtop=0.16)
    k.cyl(cu, cv, ct + zpx(7), 0.05, zpx(2), "pfCyan", sides=10)
    z0, z1, turns, n = BAND + zpx(8), ct - zpx(2), 4, 22                                                 # the coil
    for i in range(turns * n):
        a = math.tau * i / n + 0.6
        z = z0 + (z1 - z0) * i / (turns * n)
        k.box(cu + 0.235 * math.cos(a), cv + 0.235 * math.sin(a), z, 0.045, 0.045, zpx(2), "pfTrayL", top="pfTrayL",
              rz=a)
    py = cv - 0.12                                                                                        # vapour pipe
    pipe(k, (cu - 0.2, py, ct + zpx(3)), (hu + 0.36, py, ct + zpx(3)), 0.07, "pfHullM")
    pipe(k, (hu + 0.36, py, bh), (hu + 0.36, py, ct + zpx(3)), 0.07, "pfHullM")
    ring(k, "u", cu - 0.29, py, ct + zpx(3) - 0.04, 0.055, 12, 0.03, 0.02, "pfTrayL")
    spout(k, cu + 0.04, cv + 0.31, BAND + zpx(1), "v")
    return k.build()


# ---- b2 filter press --------------------------------------------------------------------------------------------------
def b2():
    k = Bench("purifier_b2", FP)
    fh, rh = zpx(26), zpx(22)
    body(k, -0.94, -0.66, fh, -0.38, 0.36, 3 * PXG)                                                       # end frames
    body(k, 0.68, 0.94, rh, -0.38, 0.36, 3 * PXG)
    for v in (-0.3, 0.26):                                                                                # floor rails
        span(k, -0.66, 0.68, v - 0.04, v + 0.04, zpx(1), zpx(4), "pfFrame", top="pfTrayL")
    plates = 8
    for i in range(plates):                                                                               # the plates
        u = -0.6 + i * 0.165
        span(k, u, u + 0.11, -0.3, 0.28, zpx(4), zpx(20), "pfHull", top="pfHull")
        span(k, u + 0.01, u + 0.1, 0.28, 0.28 + 0.5 * PXG, zpx(6), zpx(18), "pfTray")
        span(k, u + 0.03, u + 0.08, 0.28 + 0.5 * PXG, 0.28 + PXG, zpx(16), zpx(17), "pfAmber" if i == 3 else "pfFrame")
        span(k, u + 0.02, u + 0.09, -0.27, 0.25, zpx(20), zpx(21.5), "pfTrayL", top="pfTrayL")            # its grip
    for v in (-0.24, 0.2):                                                                                # tie rods
        pipe(k, (-0.66, v, zpx(23)), (0.68, v, zpx(23)), 0.045, "pfHullM")
        for u in (-0.64, 0.66):
            k.box(u, v, zpx(23) - 0.04, 0.03, 0.08, 0.08, "pfFrame")
    k.box(0.81, -0.02, rh, 0.14, 0.14, zpx(4), "pfFrame", top="pfTray")                                   # the ram
    pipe(k, (0.66, -0.02, zpx(13)), (0.5, -0.02, zpx(13)), 0.1, "pfHullM")
    funnel(k, -0.8, -0.02, fh, 0.24, 0.5, zpx(8), 16)                                                     # the funnel
    tv = 0.36                                                                                             # drip trough
    span(k, -0.66, 0.68, tv - 0.06, tv + 0.06, zpx(1), zpx(5), "pfTrayL", top="pfTrayL")
    span(k, -0.64, 0.66, tv - 0.04, tv + 0.04, zpx(5) - 0.01, zpx(5), "pfWater", top="pfWater")
    spout(k, 0.94, 0.2, zpx(8))
    lamp(k, -0.8, fh - zpx(8), 0.36)
    for i in range(2):
        span(k, -0.86, -0.74, 0.36, 0.36 + 0.5 * PXG, BAND + zpx(2 + 3 * i), BAND + zpx(3 + 3 * i), "pfAmber")
    return k.build()


# ---- b3 sphere --------------------------------------------------------------------------------------------------------
SU, SV, SZ, SR = 0.42, -0.02, zpx(28), 0.37    # b3's sphere: centre and radius


def b3():
    k = Bench("purifier_b3", FP)
    n = 14                                                                                                # the sphere
    for i in range(n):
        a0, a1 = -math.pi / 2 + math.pi * i / n, -math.pi / 2 + math.pi * (i + 1) / n
        k.cyl(SU, SV, SZ + SR * math.sin(a0), max(0.02, SR * math.cos(a0)), SR * (math.sin(a1) - math.sin(a0)), "pfHull",
              top="pfHull", sides=28, rtop=max(0.02, SR * math.cos(a1)))
    k.cyl(SU, SV, SZ - zpx(1.5), SR + 0.5 * PXG, zpx(3), "pfTrayL", top="pfTrayL", sides=28)            # equator
    k.cyl(SU, SV, SZ + SR - zpx(2), 0.12, zpx(4), "pfHullM", top="pfTrayL", sides=16)                   # top hatch
    k.cyl(SU, SV, SZ + SR + zpx(2), 0.05, zpx(2), "pfCyan", sides=10)
    pz = SZ + zpx(6)                                                                                      # sight port
    pv = SV + SR * math.cos(math.asin(zpx(6) / SR)) - 0.02
    extrude(k, [(SU - 0.1 + 0.1 * math.cos(a), pz + 0.1 * math.sin(a)) for a in (math.tau * i / 16 for i in range(16))],
            "v", pv, pv + 0.05, "pfHullM", top="pfTrayL")
    extrude(k, [(SU - 0.1 + 0.07 * math.cos(a), pz + 0.07 * math.sin(a)) for a in (math.tau * i / 16 for i in range(16))],
            "v", pv, pv + 0.055, "pfWater", top="pfWaterL")
    cr = SZ - zpx(9)                                                                                      # the cradle
    k.cyl(SU, SV, cr, SR * 0.86, zpx(2), "pfFrame", top="pfFrame", sides=28)
    for a in (0.785, 2.356, 3.927, 5.498):
        lu, lv = SU + 0.33 * math.cos(a), SV + 0.33 * math.sin(a)
        k.box(lu, lv, 0, 0.07, 0.07, cr + zpx(2), "pfFrame", top="pfFrame")
        k.box(lu, lv, 0, 0.1, 0.1, zpx(2), "pfRecess")
    k.cyl(SU, SV, SZ - SR - zpx(4), 0.05, zpx(5), "pfHullM", sides=10)                                  # drain
    k.box(SU, SV + 0.1, zpx(3), 0.22, 0.24, zpx(4), "pfHullM", top="pfTrayL")
    k.box(SU, SV + 0.1, zpx(7) - 0.01, 0.16, 0.18, 0.012, "pfWater", top="pfWater")
    spout(k, SU + 0.1, SV + 0.22, zpx(3), "v")
    fh = zpx(16)                                                                                          # the feeder
    body(k, -0.94, -0.36, fh, -0.32, 0.36)
    funnel(k, -0.72, -0.04, fh, 0.32, 0.4, zpx(6), 16)
    lamp(k, -0.5, BAND + zpx(2), 0.36)
    for i in range(2):
        span(k, -0.86, -0.74, 0.36, 0.36 + 0.5 * PXG, BAND + zpx(2 + 3 * i), BAND + zpx(3 + 3 * i), "pfAmber")
    a0, z0, a1, z1, w = -0.44, fh - zpx(2), SU - SR * 0.62, SZ + SR * 0.62, 0.06                          # screw tube
    dx, dz = a1 - a0, z1 - z0
    L = math.hypot(dx, dz)
    nx, nz = -dz / L * w, dx / L * w
    tube = [(a0 + nx, z0 + nz), (a0 - nx, z0 - nz), (a1 - nx, z1 - nz), (a1 + nx, z1 + nz)]
    extrude(k, tube, "v", 0.04 - w, 0.04 + w, "pfHullM", top="pfTrayL")
    for t in (0.2, 0.5, 0.8):
        cx, cz = a0 + dx * t, z0 + dz * t
        tx, tz = dx / L * 0.02, dz / L * 0.02
        band = [(cx - tx + nx * 1.35, cz - tz + nz * 1.35), (cx - tx - nx * 1.35, cz - tz - nz * 1.35),
                (cx + tx - nx * 1.35, cz + tz - nz * 1.35), (cx + tx + nx * 1.35, cz + tz + nz * 1.35)]
        extrude(k, band, "v", 0.04 - w * 1.35, 0.04 + w * 1.35, "pfTrayL", top="pfTrayL")
    k.box(-0.42, 0.04, fh, 0.14, 0.14, zpx(3), "pfFrame", top="pfTray")                                  # its motor
    return k.build()


VARIANTS = {"b1": b1, "b2": b2, "b3": b3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
