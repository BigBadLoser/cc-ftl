"""Water purifier look study, round 2 (family `purifier2`, palette set purifier, preview only; issue #321). Round 1 was
rejected: two designs stood on their own floor slab (against the art rules: modules stand on the ship floor) and none
read as one module. Here each purifier is ONE shaped housing standing straight on the floor (a dark kick recessed
under it), the working parts built into it: the ice hopper an opening in its top over the access tile (left), the
heated melt stage glowing through slits, the filter cartridges set into the body, the water shown through glass, the
outlet tap low at the right. One colour line wraps each body.

  x1 capsule: a long round-ended housing, flat-topped; the hopper mouth in its top at the left, a long sight glass
     along its front, three cartridge caps set into the top at the right
  x2 stepped: low at the left (the hopper at loading height), a sloped shoulder, tall at the right (the tank, its
     top corner rounded); a vertical sight glass in the tall part, the cartridges behind a window in the slope
  x3 barrel: a barrel-vaulted tank lying along the footprint, three hoops round it, the hopper a square collar rising
     out of the vault at the left, a glazed strip along the crown at the right showing the water

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .desk2_r2 import prism
from .desk2_r4 import extrude, quarter
from .purifier_study import cartridge, ice, span, valve
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)
V0, V1 = -0.42, 0.4                            # the bodies' back and front


def stadium(u0, u1, v0, v1, n=10):
    """A round-ended outline: straight along u, half-circles at both ends."""
    r, cv = (v1 - v0) / 2, (v0 + v1) / 2
    a = [(u1 - r + r * math.cos(t), cv + r * math.sin(t)) for t in (-math.pi / 2 + math.pi * i / n for i in range(n + 1))]
    b = [(u0 + r + r * math.cos(t), cv + r * math.sin(t)) for t in (math.pi / 2 + math.pi * i / n for i in range(n + 1))]
    return a + b


def slits(k, u0, v, z, n=4):
    """Glowing heat slits on a +v face: the melt stage."""
    for i in range(n):
        span(k, u0 + i * 0.07, u0 + i * 0.07 + 0.035, v, v + 0.4 * PXG, z, z + zpx(5), "pfHeat")


# ---- x1 capsule -------------------------------------------------------------------------------------------------------
def x1():
    k = Bench("purifier_x1", FP)
    h, u0, u1 = zpx(24), -0.95, 0.95
    prism(k, stadium(u0 + 2 * PXG, u1 - 2 * PXG, V0 + 2 * PXG, V1 - 2 * PXG), 0, zpx(2), "dark")         # kick
    prism(k, stadium(u0, u1, V0, V1), zpx(2), h - zpx(2), "pfBody", "pfBody")                              # the body
    prism(k, stadium(u0 - 0.5 * PXG, u1 + 0.5 * PXG, V0 - 0.5 * PXG, V1 + 0.5 * PXG), zpx(8), zpx(2), "pfWater")  # line
    span(k, -0.82, -0.28, -0.3, 0.26, h, h + zpx(1.5), "pfBodyD", top="pfBodyD")                          # hopper lip
    span(k, -0.78, -0.32, -0.26, 0.22, h + zpx(1.5), h + zpx(1.6), "dark")
    ice(k, -0.55, -0.02, h + zpx(1.5), 0.5, 0.52, 12)
    slits(k, -0.74, V1, zpx(13))
    span(k, -0.1, 0.62, V1 - PXG, V1 + 0.4 * PXG, zpx(12), zpx(20), "pfBodyD")                             # sight glass
    span(k, -0.08, 0.6, V1, V1 + 0.6 * PXG, zpx(12), zpx(17), "pfWater", top="pfWaterL")
    k.part("glass").box(0.26, V1 + 0.6 * PXG, zpx(12), 0.68, 0.012, zpx(8), "pfIce")
    for u in (0.12, 0.32, 0.52):                                                                          # cartridge caps
        k.cyl(u, -0.12, h, 0.065, zpx(2), "medWhite", top="steelD", sides=14)
        k.cyl(u, -0.12, h + zpx(2), 0.035, zpx(1), "pfWater", sides=10)
    valve(k, 0.8, V1, zpx(5))
    return k.build()


# ---- x2 stepped -------------------------------------------------------------------------------------------------------
LO, HI, SU0, SU1 = zpx(16), zpx(32), -0.2, 0.08     # x2's low and high tops, its shoulder's foot and head (u)


def x2_profile(g=0.0):
    r = 6
    return ([(-0.95 - g, 0.0), (-0.95 - g, LO + g), (SU0, LO + g), (SU1, HI + g)]
            + quarter(0.95 + g - r * PXG, HI + g - zpx(r), r * PXG, zpx(r), math.pi / 2, 0.0, 4)
            + [(0.95 + g, 0.0)])


def x2():
    k = Bench("purifier_x2", FP)
    extrude(k, [(-0.93, 0.0), (-0.93, zpx(2)), (0.93, zpx(2)), (0.93, 0.0)], "v", V0 + 2 * PXG, V1 - 2 * PXG,
            "dark")                                                                                       # kick
    body = [(u, max(z, zpx(2))) for u, z in x2_profile()]
    extrude(k, body, "v", V0, V1, "pfBody", top="pfBody")                                                  # the body
    extrude(k, [(-0.95 - 0.5 * PXG, zpx(8)), (-0.95 - 0.5 * PXG, zpx(10)), (0.95 + 0.5 * PXG, zpx(10)),
                (0.95 + 0.5 * PXG, zpx(8))], "v", V0 - 0.5 * PXG, V1 + 0.5 * PXG, "pfWater")                 # the line
    span(k, -0.84, -0.32, -0.3, 0.26, LO, LO + zpx(1.5), "pfBodyD", top="pfBodyD")                        # hopper lip
    ice(k, -0.58, -0.02, LO + zpx(1.5), 0.48, 0.52, 12)
    slits(k, -0.76, V1, zpx(3) + zpx(8))
    span(k, 0.38, 0.62, V1 - PXG, V1 + 0.4 * PXG, zpx(12), zpx(28), "pfBodyD")                             # sight glass
    span(k, 0.4, 0.6, V1, V1 + 0.6 * PXG, zpx(12), zpx(22), "pfWater", top="pfWaterL")
    k.part("glass").box(0.5, V1 + 0.6 * PXG, zpx(12), 0.22, 0.012, zpx(16), "pfIce")
    span(k, -0.16, 0.2, V1 - 0.12, V1 + 0.2 * PXG, zpx(12), LO - zpx(1), "dark")                            # cartridge
    for u in (-0.1, 0.02, 0.14):                                                                          # window
        cartridge(k, u, V1 - 0.06, zpx(12), zpx(8), 0.045)
    k.part("glass").box(0.02, V1 + 0.2 * PXG, zpx(12), 0.36, 0.012, LO - zpx(13), "pfIce")
    valve(k, 0.8, V1, zpx(5))
    return k.build()


# ---- x3 barrel --------------------------------------------------------------------------------------------------------
ZS, RZ = zpx(12), zpx(14)                       # x3's vault: its springing height and rise


def vault(g=0.0, n=12):
    r = (V1 - V0) / 2 + g
    cv = (V0 + V1) / 2
    arc = [(cv + r * math.cos(t), ZS + (RZ + g * 1.2) * math.sin(t)) for t in (math.pi * i / n for i in range(n + 1))]
    return [(cv + r, zpx(2))] + arc + [(cv - r, zpx(2))]


def crown(v):
    """The vault's height over v."""
    r, cv = (V1 - V0) / 2, (V0 + V1) / 2
    return ZS + RZ * math.sqrt(max(0.0, 1 - ((v - cv) / r) ** 2))


def x3():
    k = Bench("purifier_x3", FP)
    extrude(k, [(V0 + 2 * PXG, 0.0), (V0 + 2 * PXG, zpx(2)), (V1 - 2 * PXG, zpx(2)), (V1 - 2 * PXG, 0.0)], "u",
            -0.93, 0.93, "dark")                                                                          # kick
    extrude(k, vault(), "u", -0.95, 0.95, "pfBody", top="pfBody")                                          # the barrel
    for a0, a1 in ((-0.95 - 0.5 * PXG, -0.85), (-0.05, 0.05), (0.85, 0.95 + 0.5 * PXG)):                    # hoops
        extrude(k, vault(0.5 * PXG), "u", a0, a1, "pfBodyD", top="pfBodyD")
    span(k, -0.95, 0.95, V1, V1 + 0.5 * PXG, zpx(6), zpx(8), "pfWater")                                    # the line
    cz = crown((V0 + V1) / 2)
    span(k, -0.78, -0.3, -0.24, 0.2, ZS, cz + zpx(5), "pfBody", top="pfBodyD")                             # the collar
    span(k, -0.74, -0.34, -0.2, 0.16, cz + zpx(5), cz + zpx(5.1), "dark")
    ice(k, -0.54, -0.02, cz + zpx(5), 0.44, 0.44, 10)
    slits(k, -0.74, V1, zpx(9) - zpx(5))
    gv0, gv1 = -0.14, 0.1                                                                                 # crown glass
    span(k, 0.12, 0.8, gv0, gv1, ZS, crown(0.0) + 0.5 * PXG, "pfWaterD", top="pfWater")
    k.part("glass").box(0.46, (gv0 + gv1) / 2, crown(0.0) + 0.5 * PXG, 0.66, gv1 - gv0 + 0.02, zpx(1), "pfIce")
    for u in (0.12, 0.24, 0.36):                                                                          # cartridges,
        cartridge(k, u, V1 - 0.02, zpx(2), zpx(7), 0.045)                                                  # at its foot
    valve(k, 0.72, V1, zpx(5))
    return k.build()


VARIANTS = {"x1": x1, "x2": x2, "x3": x3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
