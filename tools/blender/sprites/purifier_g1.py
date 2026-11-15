"""Water purifier, the picked design (family `purifier_g1`, palette set purifier; issue #321): round 10's g1 with its
polish pass (user: jagged pixels, a break in the mid band where the body's trim meets the tank's, the spigot hard to
read). One long chamfered body (dark band at its foot) runs into a round tank as deep as the body, their sides tangent;
the body's trim line runs straight into the tank's band; a big porthole on the body's front under the ice tray shows
the ice and the heater ring; a melt line runs from beside the porthole along the front, through a valve, and turns
square into the tank's front on its axis; the tap stands out of the tank's far end.

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""
import math

from .desk2_r2 import prism
from .purifier_r10 import porthole, rod, tray
from .purifier_r3 import BAND, V0, V1, lamp
from .purifier_r5 import body
from .purifier_study import span
from .research_kit import PXG, Bench, zpx

PAL = "purifier"
FP = (2, 1)
CU, CV, CR = 0.5, (V0 + V1) / 2, (V1 - V0) / 2  # the tank: as deep as the body, its sides tangent to the body's
H = zpx(27)                                      # the body's top
CH = H + zpx(18)                                 # the tank's shoulder
TZ = H - zpx(4)                                  # the trim line
SIDES = 64
ICE = (-0.86, -0.12)                             # the ice tray's span (u); the porthole sits under its middle
PU, PZ, PR = (ICE[0] + ICE[1]) / 2, BAND + (H - BAND) * 0.56, 0.2


def trim(k, z):
    """The body's trim line: chamfered at the left end, running straight into the tank's band at the right."""
    g, c = 0.5 * PXG, 4 * PXG
    u0, v0, v1 = -0.94 - g, V0 - g, V1 + g
    pts = [(u0 + c, v0), (CU, v0), (CU, v1), (u0 + c, v1), (u0, v1 - c), (u0, v0 + c)]
    prism(k, pts, z, zpx(2), "pfTrayL", "pfTrayL")


def tank(k):
    k.cyl(CU, CV, zpx(1), CR, BAND - zpx(1), "pfFrame", top="pfFrame", sides=SIDES)
    k.cyl(CU, CV, BAND, CR, CH - BAND, "pfHull", top="pfHull", sides=SIDES)
    for z in (TZ, CH - zpx(8)):                                                                           # bands
        k.cyl(CU, CV, z, CR + 0.5 * PXG, zpx(2), "pfTrayL", top="pfTrayL", sides=SIDES)
    k.cyl(CU, CV, CH, CR, zpx(5), "pfHullM", top="pfTrayL", sides=SIDES, rtop=0.2)                       # its cap
    k.cyl(CU, CV, CH + zpx(5), 0.1, zpx(2), "pfFrame", top="pfTray", sides=24)
    k.cyl(CU, CV, CH + zpx(7), 0.04, zpx(2), "pfCyan", sides=16)
    sv = CV + CR                                                                                          # sight slot
    span(k, CU - 0.07, CU + 0.07, sv - 0.04, sv + 0.012, TZ + zpx(3), CH - zpx(9), "pfFrame")
    span(k, CU - 0.05, CU + 0.05, sv - 0.03, sv + 0.016, TZ + zpx(4), TZ + zpx(10), "pfWater", top="pfWaterL")
    k.part("glass").box(CU, sv + 0.016, TZ + zpx(4), 0.1, 0.006, CH - zpx(10) - TZ - zpx(4), "pfIce")


def melt_line(k):
    """Out of the body beside the porthole, along the front through a valve, square into the tank on its axis."""
    pv, r, z = V1 + 0.075, 0.05, PZ - PR * 0.75
    u0, u1 = PU + PR + 0.17, CU
    rod(k, "v", V1 - 0.01, pv + r, u0, z, r, "pfTray", 20)                                                # out
    rod(k, "u", u0 - r, u1 + r, pv, z, r, "pfTray", 20)                                                   # along
    rod(k, "v", CV + CR - 0.02, pv + r, u1, z, r, "pfTray", 20)                                           # in
    for u, v in ((u0, V1), (u1, CV + CR)):                                                                # wall flanges
        rod(k, "v", v - 0.005, v + 0.02, u, z, r * 1.7, "pfFrame", 20)
    vu = (u0 + u1) / 2                                                                                    # the valve
    rod(k, "u", vu - 0.045, vu + 0.045, pv, z, r * 1.45, "pfFrame", 20)
    k.cyl(vu, pv, z + r * 1.3, 0.016, zpx(3), "pfHullM", sides=10)
    k.cyl(vu, pv, z + r * 1.3 + zpx(3), 0.055, zpx(1), "medRed", top="medRed", sides=20)


def tap(k):
    """The tap on the tank's far end, on its axis: a flange, a spout, a nozzle turned down, a red lever on top."""
    u, z = CU + CR, zpx(13)
    rod(k, "u", u - 0.02, u + 0.014, CV, z, 0.085, "pfFrame", 24)
    rod(k, "u", u - 0.01, u + 0.11, CV, z, 0.048, "pfHullM", 24)
    k.cyl(u + 0.085, CV, z - 0.1, 0.042, 0.1, "pfHullM", top="pfHullM", sides=20)
    k.cyl(u + 0.085, CV, z - 0.12, 0.03, 0.02, "pfRecess", sides=16)
    k.cyl(u + 0.045, CV, z + 0.04, 0.016, zpx(3), "pfHullM", sides=10)
    k.box(u + 0.045, CV, z + 0.04 + zpx(3), 0.04, 0.17, zpx(1.5), "medRed", top="medRed")


def build(name="purifier_g1"):
    k = Bench(name, FP)
    body(k, -0.94, CU, H)
    porthole(k, PU, PZ, PR, V1)
    tank(k)
    trim(k, TZ)
    tray(k, *ICE, -0.34, 0.3, H)
    melt_line(k)
    lamp(k, -0.02, TZ - zpx(7), V1)
    tap(k)
    return k.build()


def jobs():
    return [("module.water_purifier.g1", FP, "prop", build)]
