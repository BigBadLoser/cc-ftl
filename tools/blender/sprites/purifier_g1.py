"""Water purifier, the picked design (family `purifier_g1`, palette set purifier; issue #321): round 10's g1, polished
(user: jagged pixels on the band edges, the fill window and the tray edges). Built on the pixel grid: every plan edge on
a whole px (PX = 1/32 tile) and every height a whole px, the colour bands flush in the surface (a change of colour, no
half-px lip), the tray's insets and chamfers whole px, the fill window a frame standing a clear 2 px proud.

One long chamfered body (dark band at its foot) runs into a round tank as deep as the body, their sides tangent; the
body's trim band runs straight into the tank's lower band; a big porthole on the body's front under the ice tray shows
the ice and the heater ring; a melt line runs from beside the porthole along the front through a valve and turns square
into the tank's front on its axis; the tap stands out of the tank's far end.

Local frame modkit.K, footprint (2, 1): u -1..1 across, v -0.5..0.5 deep, front +v, z up; all sizes in tiles."""

from .desk2_r2 import prism
from .purifier_r10 import porthole, rod
from .purifier_r5 import heap
from .research_kit import Bench, zpx

PAL = "purifier"
FP = (2, 1)
PX = 1 / 32
U0, V0, V1 = -30 * PX, -13 * PX, 13 * PX        # the body: its left end, back and front
CU, CV, CR = 16 * PX, 0.0, 13 * PX              # the tank: as deep as the body, its sides tangent to the body's
BAND, TZ, H = zpx(7), zpx(23), zpx(27)          # dark band, trim band (2 px), body top
B2, CH = zpx(37), zpx(45)                       # the tank's upper band (2 px), its shoulder
SIDES = 64
TRAY = (-28 * PX, -4 * PX, -11 * PX, 9 * PX)    # the ice tray (u0, u1, v0, v1); the porthole sits under its middle
PU, PZ, PR = (TRAY[0] + TRAY[1]) / 2, zpx(17), 0.2


def box(k, u0, u1, v0, v1, z0, z1, col, top=None):
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z0, u1 - u0, v1 - v0, z1 - z0, col, top=top)


def cham(u0, u1, v0, v1, c):
    return [(u0 + c, v0), (u1 - c, v0), (u1, v0 + c), (u1, v1 - c), (u1 - c, v1), (u0 + c, v1), (u0, v1 - c), (u0, v0 + c)]


def layers(z0, z1):
    """The body's and tank's colour layers between z0 and z1, bottom up: (z0, z1, colour), flush, no overlaps."""
    cuts = [(zpx(1), BAND, "pfFrame"), (BAND, TZ, "pfHull"), (TZ, TZ + zpx(2), "pfTrayL"), (TZ + zpx(2), B2, "pfHull"),
            (B2, B2 + zpx(2), "pfTrayL"), (B2 + zpx(2), CH, "pfHull")]
    return [(max(a, z0), min(b, z1), c) for a, b, c in cuts if min(b, z1) > max(a, z0)]


def body(k):
    prism(k, cham(U0 + PX, CU, V0 + PX, V1 - PX, 3 * PX), 0, zpx(1), "pfRecess")
    for a, b, c in layers(zpx(1), H):
        prism(k, cham(U0, CU, V0, V1, 4 * PX), a, b - a, c, "pfHull" if b == H else c)


def tank(k):
    k.cyl(CU, CV, 0, CR - PX, zpx(1), "pfRecess", sides=SIDES)
    for a, b, c in layers(zpx(1), CH):
        k.cyl(CU, CV, a, CR, b - a, c, top=c, sides=SIDES)
    k.cyl(CU, CV, CH, CR, zpx(5), "pfHullM", top="pfTrayL", sides=SIDES, rtop=0.2)                       # its cap
    k.cyl(CU, CV, CH + zpx(5), 3 * PX, zpx(2), "pfFrame", top="pfTray", sides=24)
    k.cyl(CU, CV, CH + zpx(7), 1.5 * PX, zpx(2), "pfCyan", sides=16)


def fill_window(k):
    """The fill level window on the tank's front, on its axis: a frame 2 px proud, the window sunk 1 px in it."""
    u0, u1, z0, z1 = CU - 3 * PX, CU + 3 * PX, TZ + zpx(3), B2 - zpx(1)
    back, face, rim = CR - 2 * PX, CR + 1 * PX, CR + 2 * PX
    box(k, u0, u1, back, face, z0, z1, "pfFrame")
    for a, b, c, d in ((u0, u0 + PX, z0, z1), (u1 - PX, u1, z0, z1), (u0, u1, z0, z0 + zpx(1)), (u0, u1, z1 - zpx(1), z1)):
        box(k, a, b, face, rim, c, d, "pfFrame", top="pfFrame")
    box(k, u0 + PX, u1 - PX, face, face + 0.3 * PX, z0 + zpx(1), z0 + zpx(6), "pfWater", top="pfWaterL")
    box(k, u0 + PX, u1 - PX, face, face + 0.3 * PX, z0 + zpx(6), z1 - zpx(1), "pfRecess")
    k.part("glass").box(CU, face + 0.6 * PX, z0 + zpx(1), u1 - u0 - 2 * PX, 0.2 * PX, z1 - z0 - zpx(2), "pfIce")


def tray(k):
    """The ice tray: a blue-grey chamfered rim 3 px tall, dark inside (3 px in), the ice heaped in it."""
    u0, u1, v0, v1 = TRAY
    prism(k, cham(u0, u1, v0, v1, 5 * PX), H, zpx(3), "pfTray", "pfTrayL")
    prism(k, cham(u0 + 3 * PX, u1 - 3 * PX, v0 + 3 * PX, v1 - 3 * PX, 3 * PX), H + zpx(3), 0.2 * PX, "pfRecess",
          "pfRecess")
    heap(k, (u0 + u1) / 2, (v0 + v1) / 2, H + zpx(3.2), u1 - u0 - 6 * PX, v1 - v0 - 6 * PX, 18, 0.06)


def melt_line(k):
    """Out of the body beside the porthole, along the front through a valve, square into the tank on its axis."""
    pv, r, z = V1 + 2.5 * PX, 1.5 * PX, zpx(11)
    u0, u1 = PU + PR + 5 * PX, CU
    rod(k, "v", V1 - PX, pv + r, u0, z, r, "pfTray", 20)                                                  # out
    rod(k, "u", u0 - r, u1 + r, pv, z, r, "pfTray", 20)                                                   # along
    rod(k, "v", CR - PX, pv + r, u1, z, r, "pfTray", 20)                                                  # in
    for u, v in ((u0, V1), (u1, CR)):                                                                     # wall flanges
        rod(k, "v", v - 0.2 * PX, v + 0.8 * PX, u, z, r * 1.7, "pfFrame", 20)
    vu = (u0 + u1) / 2                                                                                    # the valve
    rod(k, "u", vu - 1.5 * PX, vu + 1.5 * PX, pv, z, r * 1.45, "pfFrame", 20)
    k.cyl(vu, pv, z + r * 1.3, 0.5 * PX, zpx(3), "pfHullM", sides=10)
    k.cyl(vu, pv, z + r * 1.3 + zpx(3), 1.75 * PX, zpx(1), "medRed", top="medRed", sides=20)


def lamp(k):
    u, z = -1 * PX, zpx(16)
    box(k, u - PX, u + PX, V1, V1 + 0.5 * PX, z, z + zpx(5), "pfFrame")
    box(k, u - 0.5 * PX, u + 0.5 * PX, V1 + 0.5 * PX, V1 + 0.7 * PX, z + zpx(1), z + zpx(4), "pfCyan")


def tap(k):
    """The tap on the tank's far end, on its axis: a flange, a spout, a nozzle turned down, a red lever on top."""
    u, z = CU + CR, zpx(13)
    rod(k, "u", u - 0.6 * PX, u + 0.5 * PX, CV, z, 2.7 * PX, "pfFrame", 24)
    rod(k, "u", u - 0.3 * PX, u + 3.5 * PX, CV, z, 1.5 * PX, "pfHullM", 24)
    k.cyl(u + 2.7 * PX, CV, z - 3.2 * PX, 1.3 * PX, 3.2 * PX, "pfHullM", top="pfHullM", sides=20)
    k.cyl(u + 2.7 * PX, CV, z - 3.8 * PX, 1 * PX, 0.6 * PX, "pfRecess", sides=16)
    k.cyl(u + 1.4 * PX, CV, z + 1.3 * PX, 0.5 * PX, zpx(3), "pfHullM", sides=10)
    k.box(u + 1.4 * PX, CV, z + 1.3 * PX + zpx(3), 1.2 * PX, 5.5 * PX, zpx(1.5), "medRed", top="medRed")


def build(name="purifier_g1"):
    k = Bench(name, FP)
    body(k)
    tank(k)
    porthole(k, PU, PZ, PR, V1)
    fill_window(k)
    tray(k)
    melt_line(k)
    lamp(k)
    tap(k)
    return k.build()


def jobs():
    return [("module.water_purifier.g1", FP, "prop", build)]
