"""Water purifier look study, round 1 (family `purifier`, palette set purifier, preview only; issue #321): three 2x1
machines that turn ice into water. Each shows the working parts in process order, left to right: an ice hopper (where
crew load ice, over the access tile in front of the left tile), a heated melt chamber (an orange heat window), filter
cartridges, a pump, a clean-water tank with a sight glass, and an outlet valve. One body per module: every part sits on
or in one plinth or cabinet.

  w1 tower: a plinth carrying the hopper on its melt chamber (left) and a tall round tank with a sight glass (right),
     filter cartridges and the pump between them, piped together, the outlet valve at the tank's foot
  w2 skid: a low steel skid, the process laid out along it: a squat hopper and drum, a row of three cartridges, a low
     bevelled tank with a level window, the pump and an outlet tap; everything below knee height but the hopper
  w3 cabinet: one appliance cabinet, the hopper lid open on the left showing ice, a control panel over the access
     tile, a round porthole on the right showing the water, the cartridges racked in an open bay at its end, a tap and drip tray

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .research_kit import PXG, Bench, bar, ring, zpx

PAL = "purifier"
FP = (2, 1)


def span(k, u0, u1, v0, v1, z0, z1, col, top=None):
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z0, u1 - u0, v1 - v0, z1 - z0, col, top=top)


def ice(k, cu, cv, z, w, d, n=14):
    """Chunks of ice heaped in a w x d opening at height z: a pale bed, chunks on it."""
    k.box(cu, cv, z - 0.03, w - 0.08, d - 0.08, 0.03, "pfIceD", top="pfIceD")
    for i in range(n):
        a = i * 2.4
        f = 0.25 + 0.75 * ((i * 7) % 10) / 10
        u = cu + (w / 2 - 0.08) * math.cos(a) * f
        v = cv + (d / 2 - 0.08) * math.sin(a) * f
        s = 0.07 + 0.025 * (i % 3)
        k.box(u, v, z - 0.01, s, s, s * 0.8, "pfIceD" if i % 3 == 0 else "pfIce", top="pfIce", rz=a)


def cartridge(k, u, v, z, h=zpx(12), r=0.055):
    """A filter cartridge: a white housing with a blue band and a dark cap."""
    k.cyl(u, v, z, r, h, "medWhite", top="steelD", sides=12)
    k.cyl(u, v, z + h * 0.55, r + 0.006, zpx(2), "pfWater", sides=12)
    k.cyl(u, v, z + h, r * 0.7, zpx(1.5), "steelD", top="gm", sides=10)


def valve(k, u, v, z):
    """An outlet: a short spout with a red hand wheel."""
    k.box(u, v, z, 0.06, 0.1, 0.05, "steelL")
    ring(k, "v", u, v + 0.06, z + 0.07, 0.04, 10, 0.01, 0.015, "medRed")
    k.box(u, v + 0.05, z - 0.04, 0.03, 0.03, 0.05, "steelL")


def pipe(k, a, b, w=0.04, col="steelL"):
    bar(k, a, b, w, col)


# ---- w1 tower ---------------------------------------------------------------------------------------------------------
def w1():
    k = Bench("purifier_w1", FP)
    pz = zpx(4)
    span(k, -0.96, 0.96, -0.44, 0.44, 0, pz, "steelD", top="plate")                                      # the plinth
    for i in range(10):                                                                                 # hazard edge
        u0 = -0.96 + i * 0.192
        span(k, u0, u0 + 0.192, 0.44, 0.44 + 0.5 * PXG, zpx(1), zpx(3), "hazY" if i % 2 == 0 else "hazK")
    mz = pz + zpx(16)                                                                                   # melt chamber
    span(k, -0.9, -0.2, -0.36, 0.36, pz, mz, "pfBodyD", top="pfBody")
    span(k, -0.78, -0.42, 0.36, 0.36 + 0.5 * PXG, pz + zpx(4), pz + zpx(8), "pfHeat")                     # heat window
    span(k, -0.8, -0.4, 0.36, 0.36 + 0.3 * PXG, pz + zpx(3), pz + zpx(9), "dark")
    k.box(-0.55, 0.0, mz, 0.56, 0.56, zpx(10), "pfBody", top="dark", taper=1.25)                         # the hopper
    ice(k, -0.55, 0.0, mz + zpx(10), 0.66, 0.66)
    span(k, -0.36, -0.24, 0.36, 0.37, pz + zpx(11), pz + zpx(14), "dark")                                 # controls
    k.box(-0.3, 0.37, pz + zpx(12), 0.02, 0.01, 0.02, "pfLamp")
    tu, tv, tr, th = 0.52, -0.06, 0.32, zpx(34)                                                           # the tank
    k.cyl(tu, tv, pz, tr, th, "pfBody", top="pfBodyD", sides=24)
    k.cyl(tu, tv, pz + th, tr * 0.9, zpx(3), "pfBodyD", top="plate", rtop=tr * 0.5, sides=24)
    for z in (pz + zpx(6), pz + zpx(28)):
        k.cyl(tu, tv, z, tr + 0.006, zpx(1.5), "steelD", sides=24)
    gu, gv = tu - 0.12, tv + tr * 0.95                                                                     # sight glass
    span(k, gu - 0.05, gu + 0.05, gv - 0.02, gv + 0.01, pz + zpx(8), pz + zpx(26), "pfWaterD")
    span(k, gu - 0.04, gu + 0.04, gv, gv + 0.02, pz + zpx(8), pz + zpx(19), "pfWater", top="pfWaterL")
    k.part("glass").box(gu, gv + 0.01, pz + zpx(8), 0.1, 0.03, zpx(18), "pfIce")
    for u in (0.0, 0.12):                                                                                 # cartridges
        cartridge(k, u, 0.24, pz)
    k.box(0.04, -0.26, pz, 0.18, 0.14, zpx(7), "gm", top="steelL")                                       # the pump
    k.cyl(0.04, -0.26, pz + zpx(7), 0.05, zpx(3), "steelD", top="gm", sides=10)
    pipe(k, (-0.2, 0.2, pz + zpx(10)), (0.0, 0.24, pz + zpx(12)))                                         # pipework
    pipe(k, (0.12, 0.24, pz + zpx(12)), (0.24, 0.18, pz + zpx(14)))
    pipe(k, (-0.2, -0.26, pz + zpx(5)), (0.13, -0.26, pz + zpx(5)))
    pipe(k, (0.13, -0.26, pz + zpx(5)), (0.24, -0.2, pz + zpx(20)))
    valve(k, 0.7, 0.24, pz + zpx(4))
    return k.build()


# ---- w2 skid ----------------------------------------------------------------------------------------------------------
def w2():
    k = Bench("purifier_w2", FP)
    for v in (-0.34, 0.34):                                                                              # the skid
        span(k, -0.96, 0.96, v - 0.05, v + 0.05, 0, zpx(3), "hazY" if v > 0 else "steelD", top="steelD")
    for u in (-0.8, 0.0, 0.8):
        span(k, u - 0.04, u + 0.04, -0.34, 0.34, 0, zpx(2.5), "steelD")
    span(k, -0.94, 0.94, -0.4, 0.4, zpx(3), zpx(4), "steelD", top="plate")                                # its deck
    z = zpx(4)
    k.cyl(-0.62, 0.0, z, 0.28, zpx(12), "pfBodyD", top="pfBody", sides=20)                                # melt drum
    ring(k, "z", -0.62, 0.0, z + zpx(5), 0.285, 22, zpx(2), 0.012, "pfHeat")                               # its coil
    k.box(-0.62, 0.0, z + zpx(12), 0.4, 0.4, zpx(8), "pfBody", top="dark", taper=1.3)                      # the hopper
    ice(k, -0.62, 0.0, z + zpx(20), 0.5, 0.5, 9)
    span(k, -0.24, 0.2, -0.16, 0.16, z, z + zpx(2), "gm", top="steelD")                                   # cartridge
    for u in (-0.16, -0.02, 0.12):                                                                        # rack
        cartridge(k, u, 0.0, z + zpx(2), zpx(13))
    tu0, tu1 = 0.3, 0.92                                                                                  # the tank
    k.box((tu0 + tu1) / 2, -0.04, z, tu1 - tu0, 0.62, zpx(16), "pfBody", top="pfBodyD", bevel=0.05)
    span(k, 0.38, 0.84, 0.27, 0.28, z + zpx(4), z + zpx(12), "pfWaterD")                                  # level window
    span(k, 0.39, 0.83, 0.28, 0.29, z + zpx(4), z + zpx(9), "pfWater", top="pfWaterL")
    k.part("glass").box(0.61, 0.29, z + zpx(4), 0.46, 0.015, zpx(8), "pfIce")
    k.box(0.0, -0.3, z, 0.16, 0.12, zpx(6), "gm", top="steelL")                                          # the pump
    pipe(k, (-0.34, 0.0, z + zpx(8)), (-0.2, 0.0, z + zpx(14)))                                           # pipework
    pipe(k, (0.16, 0.0, z + zpx(14)), (0.32, 0.0, z + zpx(14)))
    pipe(k, (0.08, -0.3, z + zpx(5)), (0.32, -0.3, z + zpx(5)))
    valve(k, 0.94, 0.0, z + zpx(6))
    return k.build()


# ---- w3 cabinet -------------------------------------------------------------------------------------------------------
def w3():
    k = Bench("purifier_w3", FP)
    h = zpx(28)
    cu1 = 0.62                                                                                            # body's end
    span(k, -0.94, cu1, -0.42, 0.38, zpx(2), h, "pfBody", top="pfBody")                                  # the cabinet
    span(k, -0.92, cu1, -0.4, 0.36, 0, zpx(2), "dark")
    span(k, cu1, 0.94, -0.42, 0.38, zpx(2), zpx(8), "pfBody", top="pfBodyD")                              # the bay:
    span(k, cu1, 0.94, -0.42, 0.38, h - zpx(4), h, "pfBody", top="pfBody")                                # sill, roof,
    span(k, cu1, 0.94, -0.42, -0.36, zpx(8), h - zpx(4), "pfBodyD")                                       # back
    span(k, 0.9, 0.94, -0.42, 0.38, zpx(8), h - zpx(4), "pfBody")                                         # and end post
    span(k, cu1, 0.92, -0.4, 0.36, 0, zpx(2), "dark")
    span(k, -0.94, 0.94, 0.38, 0.38 + 0.5 * PXG, zpx(3), zpx(5), "hazY")                                  # a kick line
    span(k, -0.86, -0.3, -0.34, 0.3, h, h + zpx(1), "pfBodyD", top="pfBodyD")                             # hopper well
    ice(k, -0.58, -0.02, h + zpx(1), 0.56, 0.64)
    k.box(-0.58, -0.36, h, 0.56, 0.04, 0.26, "pfBodyD", top="pfBody", rx=-0.45)                          # its lid, open
    span(k, -0.82, -0.36, 0.38, 0.39, zpx(10), zpx(22), "steelD")                                         # controls
    span(k, -0.78, -0.4, 0.39, 0.395, zpx(16), zpx(21), "dark")
    for i, col in enumerate(("pfLamp", "pfHeat", "pfWater")):
        span(k, -0.76 + i * 0.07, -0.72 + i * 0.07, 0.39, 0.396, zpx(12), zpx(14), col)
    pu, pv, pr = 0.26, 0.38, 0.17                                                                          # porthole
    ring(k, "v", pu, pv + 0.01, zpx(15), pr + 0.02, 20, 0.03, 0.035, "steelL")
    k.box(pu, pv + 0.004, zpx(15) - pr, 2 * pr * 0.95, 0.008, pr * 1.1, "pfWater", top="pfWaterL")
    k.box(pu, pv + 0.004, zpx(15) - pr + pr * 1.1, 2 * pr * 0.9, 0.006, pr * 0.85, "pfWaterD")
    k.part("glass").box(pu, pv + 0.016, zpx(15) - pr, 2 * pr, 0.01, 2 * pr, "pfIce")
    for v in (-0.2, 0.0, 0.2):                                                                           # cartridges
        cartridge(k, 0.77, v, zpx(8), zpx(14), 0.055)
    k.box(0.0, 0.42, zpx(2), 0.22, 0.12, zpx(1), "steelD", top="dark")                                    # drip tray
    valve(k, 0.0, 0.38, zpx(10))
    pipe(k, (-0.2, -0.2, h), (-0.2, -0.2, h + zpx(5)))                                                     # roof pipe
    pipe(k, (-0.2, -0.2, h + zpx(5)), (0.5, -0.2, h + zpx(5)))
    pipe(k, (0.5, -0.2, h + zpx(5)), (0.5, -0.2, h))
    return k.build()


VARIANTS = {"w1": w1, "w2": w2, "w3": w3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
