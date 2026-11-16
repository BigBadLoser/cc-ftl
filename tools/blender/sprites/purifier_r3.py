"""Water purifier look study, round 3 (family `purifier3`, palette set purifier, preview only; issue #321): purifiers in
the life support module's design language (user: make it fit with life support, without copying or reusing it). Its
language, modelled fresh here: a pale grey-steel housing with chamfered upright corners over a dark lower band (one body,
standing on the floor), recessed blue-grey trays in the top, dark recessed panels with small amber marks, a cyan status
lamp in a seam, a round port on an end. The working parts sit in that language: the ice in a top tray over the access
tile (left), the water behind glass, the filter cartridges, the outlet at the right end.

  y1 twin bay: two top trays, ice in the left, water under a glass lid in the right; two dark doors below them, the
     lamp in the seam between; the outlet a round port with a valve on the right end
  y2 low and tall: one body stepping from a low hopper half (the ice tray in its top) up to a taller tank half with a
     vertical sight glass and blue-grey bands; the dark band runs under both
  y3 cartridge bank: a dark window across the front showing four filter cartridges, the ice tray and a louvred vent
     tray on top, a cyan water gauge beside the seam

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
from .purifier_kit import prism
from .purifier_study import cartridge, ice, span
from .research_kit import PXG, Bench, ring, zpx

PAL = "purifier"
FP = (2, 1)
V0, V1, UE = -0.42, 0.4, 0.94                  # the housing's back, front and half-length
CH = 4 * PXG                                   # its corner chamfer
BAND = zpx(7)                                  # the dark lower band's height


def chamfered(u0, u1, v0, v1, c=CH):
    return [(u0 + c, v0), (u1 - c, v0), (u1, v0 + c), (u1, v1 - c), (u1 - c, v1), (u0 + c, v1), (u0, v1 - c), (u0, v0 + c)]


def housing(k, u0, u1, h, v0=V0, v1=V1):
    """A chamfered pale housing from the floor to h over a dark lower band (inset a px at the floor)."""
    prism(k, chamfered(u0 + PXG, u1 - PXG, v0 + PXG, v1 - PXG), 0, zpx(1), "pfRecess")
    prism(k, chamfered(u0, u1, v0, v1), zpx(1), BAND - zpx(1), "pfFrame", "pfFrame")
    prism(k, chamfered(u0, u1, v0, v1), BAND, h - BAND, "pfHull", "pfHull")


def tray(k, u0, u1, v0, v1, z, fill=None):
    """A recessed blue-grey tray in a top at z: its rim, and its floor a px down (or ice / water in it)."""
    span(k, u0, u1, v0, v1, z, z + zpx(1.5), "pfTrayL", top="pfTrayL")
    span(k, u0 + 2 * PXG, u1 - 2 * PXG, v0 + 2 * PXG, v1 - 2 * PXG, z + zpx(1.5), z + zpx(1.6), "pfTray")
    if fill == "ice":
        ice(k, (u0 + u1) / 2, (v0 + v1) / 2, z + zpx(1.6), u1 - u0 - 0.06, v1 - v0 - 0.06, 12)
    elif fill == "water":
        span(k, u0 + 2 * PXG, u1 - 2 * PXG, v0 + 2 * PXG, v1 - 2 * PXG, z + zpx(1.6), z + zpx(1.8), "pfWater",
             top="pfWater")
        span(k, u0 + 4 * PXG, (u0 + u1) / 2, v0 + 4 * PXG, v0 + 5 * PXG, z + zpx(1.8), z + zpx(1.9), "pfWaterL")
        k.part("glass").box((u0 + u1) / 2, (v0 + v1) / 2, z + zpx(1.5), u1 - u0 - 4 * PXG, v1 - v0 - 4 * PXG,
                            zpx(0.6), "pfIce")


def door(k, u0, u1, z0, z1, v=V1, marks=2):
    """A dark recessed panel on the front, a frame round it, small amber marks."""
    span(k, u0, u1, v - 0.5 * PXG, v + 0.3 * PXG, z0, z1, "pfFrame")
    span(k, u0 + PXG, u1 - PXG, v - 0.3 * PXG, v + 0.35 * PXG, z0 + zpx(1), z1 - zpx(1), "pfRecess")
    for i in range(marks):
        z = z0 + zpx(3) + i * zpx(5)
        span(k, (u0 + u1) / 2 - 0.05, (u0 + u1) / 2 + 0.05, v + 0.35 * PXG, v + 0.5 * PXG, z, z + zpx(1), "pfAmber")


def lamp(k, u, z, v=V1):
    span(k, u - 0.025, u + 0.025, v, v + 0.5 * PXG, z, z + zpx(5), "pfFrame")
    span(k, u - 0.015, u + 0.015, v + 0.5 * PXG, v + 0.7 * PXG, z + zpx(1), z + zpx(4), "pfCyan")


def port(k, u, z, r=0.1):
    """A round outlet port on the +u end, with a red hand wheel."""
    ring(k, "u", u + 0.01, 0.0, z, r, 16, 0.03, 0.03, "pfHullM")
    ring(k, "u", u + 0.005, 0.0, z, r * 0.55, 12, 0.02, r * 0.9, "pfRecess")
    ring(k, "u", u + 0.05, 0.0, z, r * 0.45, 10, 0.012, 0.014, "medRed")


def louvres(k, u0, u1, z0, z1, v=V1, n=4):
    for i in range(n):
        z = z0 + (z1 - z0) * (i + 0.5) / n
        span(k, u0, u1, v, v + 0.4 * PXG, z, z + zpx(0.8), "pfHullM")


# ---- y1 twin bay ------------------------------------------------------------------------------------------------------
def y1():
    k = Bench("purifier_y1", FP)
    h = zpx(26)
    housing(k, -UE, UE, h)
    span(k, -0.02, 0.02, V1 - PXG, V1 + 0.2 * PXG, BAND, h, "pfHullM")                                    # the seam
    tray(k, -0.84, -0.1, -0.32, 0.3, h, "ice")
    tray(k, 0.1, 0.84, -0.32, 0.3, h, "water")
    door(k, -0.74, -0.2, BAND + zpx(2), h - zpx(7))
    door(k, 0.2, 0.74, BAND + zpx(2), h - zpx(7))
    louvres(k, -0.74, 0.74, h - zpx(6), h - zpx(1.5))
    lamp(k, 0.0, BAND + zpx(8))
    port(k, UE, zpx(13))
    return k.build()


# ---- y2 low and tall --------------------------------------------------------------------------------------------------
def y2():
    k = Bench("purifier_y2", FP)
    lo, hi, cut = zpx(20), zpx(34), 0.06
    prism(k, chamfered(-UE + PXG, UE - PXG, V0 + PXG, V1 - PXG), 0, zpx(1), "pfRecess")
    prism(k, chamfered(-UE, UE, V0, V1), zpx(1), BAND - zpx(1), "pfFrame", "pfFrame")                     # one band
    prism(k, chamfered(-UE, cut, V0, V1), BAND, lo - BAND, "pfHull", "pfHull")                            # low half
    prism(k, chamfered(cut - 2 * PXG, UE, V0 + 0.02, V1 - 0.02, 6 * PXG), BAND, hi - BAND, "pfHull", "pfHull")
    for z in (zpx(14), hi - zpx(5)):                                                                       # its bands
        prism(k, chamfered(cut - 2.5 * PXG, UE + 0.5 * PXG, V0 + 0.02 - 0.5 * PXG, V1 - 0.02 + 0.5 * PXG,
                           6 * PXG), z, zpx(2), "pfTrayL", "pfTrayL")
    tray(k, -0.84, -0.1, -0.32, 0.3, lo, "ice")
    door(k, -0.74, -0.2, BAND + zpx(2), lo - zpx(3))
    gu = 0.5                                                                                              # sight glass
    span(k, gu - 0.07, gu + 0.07, V1 - 0.02 - PXG, V1 - 0.02 + 0.4 * PXG, zpx(16), hi - zpx(7), "pfFrame")
    span(k, gu - 0.05, gu + 0.05, V1 - 0.02, V1 - 0.02 + 0.6 * PXG, zpx(17), zpx(23), "pfWater", top="pfWaterL")
    k.part("glass").box(gu, V1 - 0.02 + 0.6 * PXG, zpx(17), 0.1, 0.012, hi - zpx(25), "pfIce")
    span(k, 0.16, 0.86, -0.3, 0.26, hi, hi + zpx(1), "pfTray", top="pfTray")                              # tank lid
    for i in range(3):
        span(k, 0.26 + i * 0.2, 0.36 + i * 0.2, -0.22, 0.18, hi + zpx(1), hi + zpx(1.6), "pfRecess")
    lamp(k, 0.2, zpx(18), V1 - 0.02)
    port(k, UE, zpx(12))
    return k.build()


# ---- y3 cartridge bank ------------------------------------------------------------------------------------------------
def y3():
    k = Bench("purifier_y3", FP)
    h = zpx(28)
    housing(k, -UE, UE, h)
    wu0, wu1 = -0.1, 0.78                                                                                 # the window
    span(k, wu0, wu1, V1 - 0.1, V1 + 0.3 * PXG, BAND + zpx(2), h - zpx(5), "pfFrame")
    span(k, wu0 + PXG, wu1 - PXG, V1 - 0.09, V1 + 0.35 * PXG, BAND + zpx(3), h - zpx(6), "pfRecess")
    for i in range(4):
        cartridge(k, wu0 + 0.12 + i * 0.21, V1 - 0.04, BAND + zpx(3), h - BAND - zpx(10), 0.055)
    k.part("glass").box((wu0 + wu1) / 2, V1 + 0.4 * PXG, BAND + zpx(3), wu1 - wu0 - 2 * PXG, 0.01,
                        h - BAND - zpx(9), "pfIce")
    door(k, -0.8, -0.3, BAND + zpx(2), h - zpx(5))
    gu = -0.2                                                                                             # gauge
    span(k, gu - 0.03, gu + 0.03, V1, V1 + 0.4 * PXG, BAND + zpx(2), h - zpx(5), "pfFrame")
    span(k, gu - 0.018, gu + 0.018, V1 + 0.4 * PXG, V1 + 0.6 * PXG, BAND + zpx(3), zpx(18), "pfCyan")
    tray(k, -0.84, -0.12, -0.32, 0.3, h, "ice")
    span(k, 0.02, 0.84, -0.3, 0.28, h, h + zpx(1), "pfTrayL", top="pfTray")                               # vent tray
    for i in range(5):
        span(k, 0.1 + i * 0.15, 0.18 + i * 0.15, -0.24, 0.22, h + zpx(1), h + zpx(1.5), "pfRecess")
    port(k, UE, zpx(14))
    return k.build()


VARIANTS = {"y1": y1, "y2": y2, "y3": y3}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
