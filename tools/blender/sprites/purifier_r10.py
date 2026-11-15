"""Water purifier look study, round 10 (family `purifier10`, palette set purifier, preview only; issue #321): round 9's
e1 (embedded column) taken further (user: do #1, with a porthole like round 4's z1, and the ice tray on top chamfered so
it reads like life support's top). The melt chamber in the body gets a round porthole on its front (a raised bezel,
the heater glowing round its rim, the ice inside); the ice tray becomes a raised blue-grey tray with chamfered corners
and one solid rim, like life support's trays; the porthole sits under the ice tray; the column is as deep as the body, their sides tangent.

  f1 the body at round 9's height, a small porthole, one chamfered ice tray
  f2 a taller body, a big porthole, the ice tray beside a smaller chamfered vent tray (slots), life support's pair
  f3 as f2, the porthole set in a chamfered panel sunk into the front

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .desk2_r2 import prism
from .desk2_r4 import extrude
from .purifier_r3 import BAND, V0, V1, chamfered, lamp
from .purifier_r5 import D, body, heap, skin, spout
from .purifier_study import span
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)
CU, CV, CR = 0.5, (V0 + V1) / 2, (V1 - V0) / 2   # the column: as deep as the body, its sides tangent to the body's


def disc(cu, cz, r, n=24):
    return [(cu + r * math.cos(a), cz + r * math.sin(a)) for a in (math.tau * i / n for i in range(n))]


def tray(k, u0, u1, v0, v1, z, fill="ice"):
    """A raised blue-grey tray with chamfered corners and one solid rim, dark inside: ice heaped in it, or slots."""
    c = 5 * PXG
    prism(k, chamfered(u0, u1, v0, v1, c), z, zpx(3.5), "pfTray", "pfTrayL")
    prism(k, chamfered(u0 + 3 * PXG, u1 - 3 * PXG, v0 + 3 * PXG, v1 - 3 * PXG, c - 1.5 * PXG), z + zpx(3.5) - 0.01,
          0.012, "pfRecess", "pfRecess")
    if fill == "ice":
        heap(k, (u0 + u1) / 2, (v0 + v1) / 2, z + zpx(3.7), u1 - u0 - 0.16, v1 - v0 - 0.16, 18, 0.06)
    else:
        n = 4
        for i in range(n):
            u = u0 + 0.08 + (u1 - u0 - 0.16) * (i + 0.5) / n
            span(k, u - 0.025, u + 0.025, v0 + 0.08, v1 - 0.08, z + zpx(3.5) - zpx(1.5), z + zpx(3.5) + 0.001, "pfFrame")


def porthole(k, pu, pz, r, fv=V1):
    """A round porthole on a +v face at fv: a raised bezel, the heater glowing round its rim, the ice inside, glass."""
    extrude(k, disc(pu, pz, r + 0.04), "v", fv - 0.01, fv + 1.5 * PXG, "pfHullM", top="pfTrayL")       # bezel
    extrude(k, disc(pu, pz, r), "v", fv, fv + 2 * PXG, "pfHeat")                                             # heater
    extrude(k, disc(pu, pz, r - 0.025), "v", fv, fv + 2.4 * PXG, "pfRecess")
    for i, (du, dz, s) in enumerate(((-0.4, -0.55, 0.4), (0.05, -0.6, 0.45), (0.45, -0.5, 0.35), (-0.15, -0.15, 0.35),
                                     (0.3, -0.12, 0.3))):                                                    # the ice
        k.box(pu + du * r, fv + 2.4 * PXG, pz + dz * r, s * r, 0.012, s * r * 0.8, "pfIce" if i % 2 else "pfIceD")
    extrude(k.part("glass"), disc(pu, pz, r - 0.03), "v", fv + 2.7 * PXG, fv + 2.9 * PXG, "pfIce")
    span(k, pu - r - 0.1, pu - r - 0.04, fv, fv + 2 * PXG, pz - 0.06, pz + 0.06, "pfFrame")              # hinge
    span(k, pu + r + 0.03, pu + r + 0.07, fv, fv + 2.5 * PXG, pz - 0.035, pz + 0.035, "pfAmber")          # latch


def rod(k, axis, a0, a1, p, q, r, col, n=16):
    """A round rod along axis ('u' or 'v') from a0 to a1, its section centred at (p, z=q)."""
    extrude(k, [(p + r * math.cos(t), q + r * math.sin(t)) for t in (math.tau * i / n for i in range(n))], axis, a0, a1,
            col, top="pfTrayL" if col in ("pfHullM", "pfTray") else col)


def plumbing(k, u0, fv, z):
    """The melt line along the front: out of the body beside the porthole, a valve and gauge on it, into the column."""
    pv, r = V1 + 0.075, 0.05
    u1 = CU - 0.2
    cvf = CV + math.sqrt(CR * CR - (u1 - CU) ** 2)                                                      # column face
    rod(k, "v", fv - 0.01, pv + r, u0, z, r, "pfTray")                                                    # out of the body
    rod(k, "u", u0 - r, u1 + r, pv, z, r, "pfTray")                                                       # along
    rod(k, "v", cvf - 0.01, pv + r, u1, z, r, "pfTray")                                                   # into column
    for u, v0, v1 in ((u0, fv - 0.005, fv + 0.022), (u1, cvf - 0.005, cvf + 0.022)):                      # wall flanges
        rod(k, "v", v0, v1, u, z, r * 1.7, "pfFrame")
    for u in (u0, u1):                                                                                    # elbows
        k.box(u, pv, z - r * 1.15, r * 2.4, r * 2.4, r * 2.3, "pfTray", top="pfTrayL", bevel=0.008)
    vu = u0 + (u1 - u0) * 0.42                                                                            # the valve
    for d in (-0.045, 0.045):
        rod(k, "u", vu + d - 0.012, vu + d + 0.012, pv, z, r * 1.6, "pfFrame")
    k.box(vu, pv, z - r * 1.2, 0.07, r * 2.6, r * 2.4, "pfFrame", top="pfFrame")
    k.box(vu, pv, z + r * 1.2, 0.016, 0.016, zpx(3), "pfHullM")
    wheel = [(vu + 0.045 * math.cos(t), pv + 0.045 * math.sin(t)) for t in (math.tau * i / 12 for i in range(12))]
    prism(k, wheel, z + r * 1.2 + zpx(3), zpx(0.8), "medRed", "medRed")
    gu = u0 + (u1 - u0) * 0.72                                                                            # the gauge
    k.box(gu, pv, z + r * 0.8, 0.014, 0.014, zpx(2.5), "pfHullM")
    rod(k, "v", pv - 0.012, pv + 0.012, gu, z + r * 0.8 + zpx(2.5) + 0.04, 0.04, "pfFrame")
    rod(k, "v", pv + 0.012, pv + 0.016, gu, z + r * 0.8 + zpx(2.5) + 0.04, 0.03, "pfIce")
    for u in (u0 + (u1 - u0) * 0.2, u0 + (u1 - u0) * 0.9):                                                # clamps
        span(k, u - 0.012, u + 0.012, V1 - 0.005, pv + r + 0.006, z - r - 0.006, z + r + 0.006, "pfFrame", top="pfFrame")


def build(name, h, pr, pair=False, panel=False):
    k = Bench(name, FP)
    ice = (-0.78, -0.2) if pair else (-0.86, -0.12)
    pu, pz = (ice[0] + ice[1]) / 2, BAND + (h - BAND) * 0.56
    if panel:                                                                                             # the body
        body(k, -0.94, 0.62, h, v1=V1 - D)
        hole = (pu - pr - 0.06, pu + pr + 0.06, pz - pr - zpx(1.5), pz + pr + zpx(1.5))
        skin(k, -0.94 + 4 * PXG, 0.2, BAND, h, (hole[0] + 0.04, hole[1] - 0.04, hole[2] + zpx(1.5), hole[3] - zpx(2)))
        for u in (hole[0], hole[1]):                                                                      # its frame
            span(k, u - 0.012, u + 0.012, V1 - D, V1 + 0.5 * PXG, hole[2], hole[3], "pfTrayL", top="pfTrayL")
        span(k, -0.94 + 4 * PXG, 0.2, V1 - D, V1, zpx(1), BAND, "pfFrame", top="pfFrame")
        span(k, hole[0], hole[1], V1 - D, V1 - D + 0.4 * PXG, hole[2], hole[3], "pfFrame")
        fv = V1 - D + 0.4 * PXG
    else:
        body(k, -0.94, 0.62, h)
        fv = V1
    porthole(k, pu, pz, pr, fv)
    k.cyl(CU, CV, zpx(1), CR, BAND - zpx(1), "pfFrame", top="pfFrame", sides=28)                         # the column
    ch = h + zpx(18)
    k.cyl(CU, CV, BAND, CR, ch - BAND, "pfHull", top="pfHull", sides=28)
    tz = h - zpx(4)                                                                                       # trim line
    prism(k, chamfered(-0.94 - 0.5 * PXG, 0.4, V0 - 0.5 * PXG, V1 + 0.5 * PXG), tz, zpx(2), "pfTrayL", "pfTrayL")
    for z in (tz, ch - zpx(8)):
        k.cyl(CU, CV, z, CR + 0.5 * PXG, zpx(2), "pfTrayL", top="pfTrayL", sides=28)
    k.cyl(CU, CV, ch, CR, zpx(5), "pfHullM", top="pfTrayL", sides=28, rtop=0.2)
    k.cyl(CU, CV, ch + zpx(5), 0.1, zpx(2), "pfFrame", top="pfTray", sides=16)
    k.cyl(CU, CV, ch + zpx(7), 0.04, zpx(2), "pfCyan", sides=10)
    sv = CV + CR                                                                                          # sight slot
    span(k, CU - 0.07, CU + 0.07, sv - 0.04, sv + 0.012, tz + zpx(3), ch - zpx(9), "pfFrame")
    span(k, CU - 0.05, CU + 0.05, sv - 0.03, sv + 0.016, tz + zpx(4), tz + zpx(10), "pfWater", top="pfWaterL")
    k.part("glass").box(CU, sv + 0.016, tz + zpx(4), 0.1, 0.006, ch - zpx(10) - tz - zpx(4), "pfIce")
    if pair:                                                                                              # the trays
        tray(k, *ice, -0.34, 0.3, h)
        tray(k, -0.14, 0.14, -0.32, 0.16, h, "vent")
    else:
        tray(k, *ice, -0.34, 0.3, h)
    plumbing(k, pu + pr + 0.1, fv, pz - pr * 0.75)
    lamp(k, 0.07, h - zpx(9), V1)
    spout(k, CU + CR - 0.06, 0.16, zpx(6))
    return k.build()


VARIANTS = {
    "f1": lambda: build("purifier_f1", zpx(22), 0.15),
    "f2": lambda: build("purifier_f2", zpx(27), 0.2, pair=True),
    "f3": lambda: build("purifier_f3", zpx(27), 0.2, pair=True, panel=True),
}


def jobs():
    return [(f"module.water_purifier.{v}", FP, "prop", f) for v, f in VARIANTS.items()]
