"""Bar style kit (family `barkit`, palette set bar9, preview only): the parts the bar designs are built from, each on
its own so they can be judged and fixed before a design uses them. The look is a used, lived-in freighter: weathered
bone and tan panels, tuck-and-roll padding, dark lips, warm light low down, small purposeful fittings, no neon.
Designs import the part functions from here; the `k01_...` builders only stage them for the kit sheet.

Heights as barcounter_study.py: counter and table top 24 px, seats 15. All in px of the tile (u across, v deep, front
+v toward the camera, z up)."""
import math

from .barcounter_r10 import arcseg
from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import seg3
from .barcounter_r7 import hcyl
from .barcounter_study import SEAT, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench


# ---- parts --------------------------------------------------------------------------------------------------------
def stool(k, u, v):
    """A tapered column stool: a flange foot, a cone, a plate and a rounded, piped cushion."""
    lathe(k, u, v, ((0, 5), (1, 5), (1.5, 3.4), (SEAT - 5, 1.8), (SEAT - 4, 5)), "r9GreyD", sides=16)
    lathe(k, u, v, ((SEAT - 4, 5.4), (SEAT - 1, 5.4), (SEAT, 4.6)), "r9Pad", sides=16)
    cyl(k, u, v, SEAT - 3, SEAT - 2.4, 5.6, "r9PadD", sides=16)


def mug(k, u, v, col, z=TOP):
    """A metal mug, the drink showing at its top, a handle to the right."""
    cyl(k, u, v, z, z + 4, 1.7, "r9Metal", sides=10)
    cyl(k, u, v, z + 3.4, z + 4.05, 1.25, col, sides=10)
    _px(k, u + 1.5, u + 2.6, v - 0.4, v + 0.4, z + 1, z + 3.2, "r9Metal")


def pleats(k, pts, z0, z1, r=1.25):
    """Tuck-and-roll: vertical rolls at the given (u, v) points."""
    for u, v in pts:
        cyl(k, u, v, z0, z1, r, "r9Pad", sides=8)


def taphead(k, u, v, z, col="r9Orange"):
    """A tap head on a riser: a cowled body, a spout arm, a coloured nozzle and a lit tag."""
    cyl(k, u, v, z, z + 3, 1.2, "r9GreyD", sides=8)
    lathe(k, u, v + 1, ((z + 3, 2.4), (z + 7, 2.4), (z + 8, 1.6)), "r9Grey", sides=10)
    _px(k, u - 0.6, u + 0.6, v + 2.5, v + 4.5, z + 4, z + 5, "r9Grey")
    _px(k, u - 0.5, u + 0.5, v + 3.6, v + 4.6, z + 2, z + 4, col)
    _px(k, u - 1, u + 1, v + 3.3, v + 3.6, z + 6, z + 7, "r9Lamp")


def porthole(k, u, v, zc, r, rim="r9GreyD", face="r9Warm"):
    """A round port facing +v: two squares turned 45 deg apart make an octagon; a smaller one lit inside."""
    for rr, col, d in ((r, rim, 1.2), (r * 0.72, face, 1.6)):
        R = rr / 32
        for a in (0, math.pi / 4):
            k.box(u / 32, v / 32 + d / 64, zc / ZPX - R, 2 * R, d / 32, 2 * R, col, ry=a)


def vent(k, u0, u1, v, z0, z1):
    """A slatted vent on a face at depth v."""
    _px(k, u0, u1, v - 0.5, v, z0, z1, "r9Char")
    for z in range(int(z0) + 1, int(z1), 2):
        _px(k, u0 + 0.5, u1 - 0.5, v - 0.5, v + 0.3, z, z + 0.8, "r9GreyD")


def hatch(k, u0, u1, v, z0, z1):
    """A service hatch: a dark panel with a pull."""
    _px(k, u0, u1, v, v + 0.4, z0, z1, "r9GreyD")
    um, zm = (u0 + u1) / 2, (z0 + z1) / 2
    _px(k, um - 2, um + 2, v + 0.4, v + 1, zm - 0.5, zm + 0.5, "r9Grey")


def leds(k, u, v, z, cols=("r9LedR", "r9LedG", "r9Lamp")):
    for i, c in enumerate(cols):
        _px(k, u + 2 * i, u + 2 * i + 1, v, v + 0.6, z, z + 1, c)


def canister(k, u, v, z, h=12, r=4, band="r9Orange"):
    """A domed canister with a coloured band and a valve stub."""
    lathe(k, u, v, ((z, r), (z + h, r), (z + h + 3, r * 0.75), (z + h + 4.5, r * 0.35), (z + h + 6, r * 0.3)),
          "r9Bone", sides=14)
    cyl(k, u, v, z + h * 0.3, z + h * 0.3 + 2, r + 0.3, band, sides=14)


def rcounter(k, u0, u1, v0, v1, front="pleats"):
    """A counter with round ends: a body between two half-drums, a recessed kick lit warm, a dark lip, a tan top,
    warm light under the lip; its front pleated or panelled."""
    r, vc = (v1 - v0) / 2, (v0 + v1) / 2
    _px(k, u0, u1, v0 + 1.5, v1 - 1.5, 0, 3, "r9Char")
    for u in (u0, u1):
        cyl(k, u, vc, 0, 3, r - 1.5, "r9Char", sides=16)
    _px(k, u0, u1, v1 - 1.6, v1 - 1.2, 2.4, 3, "r9Warm")
    _px(k, u0, u1, v0, v1, 3, TOP - 3, "r9Bone")
    for u in (u0, u1):
        cyl(k, u, vc, 3, TOP - 3, r, "r9Bone", sides=20)
    _px(k, u0, u1, v0 - 1.5, v1 + 1.5, TOP - 3, TOP - 1, "r9GreyD")
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 3, TOP - 1, r + 1.5, "r9GreyD", sides=20)
    _px(k, u0, u1, v0 - 1, v1 + 1, TOP - 1, TOP, "r9Tan")
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 1, TOP, r + 1, "r9Tan", sides=20)
    _px(k, u0, u1, v1, v1 + 1.6, TOP - 3.6, TOP - 3, "r9Warm")
    if front == "pleats":
        _px(k, u0, u1, v1, v1 + 0.3, 6, TOP - 4, "r9PadD")
        pts = [(u, v1 + 0.3) for u in range(int(u0), int(u1) + 1, 4)]
        for i in range(1, 8):                                                        # round the right end
            a = math.pi / 2 - i * math.pi / 8
            pts.append((u1 + (r + 0.3) * math.cos(a), vc + (r + 0.3) * math.sin(a)))
        pleats(k, pts, 6, TOP - 4)
    else:
        for z in (8, 15):
            _px(k, u0, u1, v1, v1 + 0.4, z, z + 0.6, "r9Tan")                        # panel grooves
        hcyl(k, u0, u1, v1 + 1.6, TOP - 5, 2, "r9Pad", n=6)                          # padded bolster
        for u in range(int(u0) + 4, int(u1), 16):
            _px(k, u - 1, u + 1, v1 - 0.4, v1 + 1, TOP - 6, TOP - 4, "r9GreyD")      # its brackets
    return r, vc


def booth(k, cu, cv, a0, a1, n=14, rs=24, rb=31):
    """A booth on an arc about (cu, cv) from angle a0 to a1: a lit base, a seat box and cushion, a pleated back in a
    tan shell with a dark cap rail."""
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        w = (a1 - a0) / n * rs * 1.15
        arcseg(k, cu, cv, a, w * 0.8, rs - 1, 8, 0, 3, "r9Char")
        arcseg(k, cu, cv, a, w * 0.75, rs - 4.7, 0.6, 2.4, 3, "r9Warm")
        arcseg(k, cu, cv, a, w * 0.95, rs, 11, 3, SEAT - 2, "r9Tan")
        arcseg(k, cu, cv, a, w * 0.98, rs, 11.4, SEAT - 2, SEAT, "r9Pad")
        arcseg(k, cu, cv, a, w * 1.25, rb, 3, 3, SEAT + 13, "r9Tan")
        arcseg(k, cu, cv, a, w * 1.25, rb, 4, SEAT + 13, SEAT + 15, "r9GreyD")
    m = int(n * 1.7)
    for i in range(m):
        a = a0 + (a1 - a0) * (i + 0.5) / m
        pleats(k, [(cu + (rb - 2.4) * math.cos(a), cv + (rb - 2.4) * math.sin(a))], SEAT, SEAT + 12, r=1.4)


def table(k, u, v, r=12):
    """A round pedestal table: a flared foot and column, a dark lip, a bone top."""
    lathe(k, u, v, ((0, 6), (1, 6), (2, 2.6), (TOP - 5, 2), (TOP - 3, 5)), "r9Grey", sides=16)
    cyl(k, u, v, TOP - 3, TOP - 1, r + 0.5, "r9GreyD", sides=24)
    cyl(k, u, v, TOP - 1, TOP, r - 0.2, "r9Bone", sides=24)


def dispenser(k, u, v):
    """A round dispenser cabinet: a door with a seam, handle and vent; a cowled head with one tap and a porthole
    gauge; a drip tray; a hose to the floor behind."""
    lathe(k, u, v, ((0, 7), (2, 7), (2, 8), (30, 8)), "r9Bone", sides=20)
    _px(k, u - 0.5, u + 0.5, v + 7.6, v + 8.3, 4, 28, "r9GreyD")
    _px(k, u + 1.5, u + 2.5, v + 8, v + 8.8, 14, 19, "r9Grey")
    vent(k, u - 5, u - 1.5, v + 8.2, 6, 14)
    cyl(k, u, v, 30, 31.5, 8.6, "r9GreyD", sides=20)
    lathe(k, u, v - 1, ((31.5, 7), (38, 6), (42, 4), (43, 2)), "r9Grey", sides=16)
    porthole(k, u + 4, v + 3.6, 37, 2)
    taphead(k, u, v + 5, 31.5)
    _px(k, u - 4, u + 4, v + 7, v + 11, 18, 19.5, "r9GreyD")
    pts = ((u - 6, v - 4, 40), (u - 10, v - 8, 34), (u - 10, v - 9, 2), (u - 6, v - 9, 0.5))
    for a, b in zip(pts, pts[1:]):
        seg3(k, a, b, 1.6, "r9PadD")


def console(k, u0, u1, v0, v1, h=30):
    """A low freestanding back console with round ends: a lit kick, a sand body, a dark top."""
    rb, vb = (v1 - v0) / 2, (v0 + v1) / 2
    _px(k, u0, u1, v0 + 1.5, v1 - 1.5, 0, 3, "r9Char")
    _px(k, u0, u1, v0, v1, 3, h, "r9Sand")
    for u in (u0, u1):
        cyl(k, u, vb, 3, h, rb, "r9Sand", sides=16)
        cyl(k, u, vb, 0, 3, rb - 1.5, "r9Char", sides=16)
    _px(k, u0, u1, v0 - 1, v1 + 1, h, h + 2, "r9GreyD")
    for u in (u0, u1):
        cyl(k, u, vb, h, h + 2, rb + 1, "r9GreyD", sides=16)
    return rb, vb


# ---- the kit sheet: each part staged on its own ------------------------------------------------------------------
def k01_stool():
    k = Bench("kit_01", (1, 1))
    stool(k, 0, 0)
    return k.build()


def k02_mugs():
    k = Bench("kit_02", (1, 1))
    _px(k, -10, 10, -6, 6, 0, TOP, "r9GreyD")                                        # a plinth at counter height
    for u, col in ((-5, "r9Amber"), (0, "r9Blue"), (5, "r9Ruby")):
        mug(k, u, 0, col)
    return k.build()


def k03_taps():
    k = Bench("kit_03", (1, 1))
    _px(k, -10, 10, -8, 4, 0, TOP, "r9GreyD")
    for u, col in ((-5, "r9Orange"), (5, "r9Blue")):
        taphead(k, u, -4, TOP, col)
    return k.build()


def k04_pleated():
    k = Bench("kit_04", (2, 1))
    rcounter(k, -18, 18, -8, 8)
    return k.build()


def k05_panelled():
    k = Bench("kit_05", (2, 1))
    rcounter(k, -18, 18, -8, 8, front="panels")
    return k.build()


def k06_booth():
    k = Bench("kit_06", (2, 2))
    booth(k, 0, 4, math.radians(192), math.radians(348))
    return k.build()


def k07_table():
    k = Bench("kit_07", (1, 1))
    table(k, 0, 0)
    for u, v, col in ((-4, -3, "r9Blue"), (4, -2, "r9Amber")):
        mug(k, u, v, col)
    return k.build()


def k08_dispenser():
    k = Bench("kit_08", (1, 1))
    dispenser(k, 0, -2)
    return k.build()


def k09_canisters():
    k = Bench("kit_09", (1, 1))
    canister(k, -6, 0, 0, band="r9Orange")
    canister(k, 5, 2, 0, h=16, r=4.5, band="r9Blue")
    return k.build()


def k10_fittings():
    k = Bench("kit_10", (1, 1))
    _px(k, -12, 12, -10, 0, 0, 32, "r9Sand")                                         # a sample panel block
    porthole(k, -5, 0, 22, 4)
    vent(k, 1, 10, 0.3, 18, 28)
    hatch(k, -10, 0, 0, 4, 14)
    _px(k, 1.5, 2.1, 0, 0.4, 2, 16, "r9GreyD")                                       # a seam
    leds(k, 4, 0.2, 12)
    hcyl(k, -12, 12, 1.6, 30, 1.6, "r9Grey", n=6)                                    # a conduit with a clamp
    hcyl(k, 5, 7, 1.6, 30, 2.1, "r9GreyD", n=6)
    return k.build()


def k11_console():
    k = Bench("kit_11", (2, 1))
    rb, vb = console(k, -16, 16, -6, 6)
    hatch(k, 2, 14, 6, 8, 24)
    porthole(k, -8, 6, 17, 5, face="r9Amber")
    for u in (-12, -4):
        canister(k, u, vb, 32, h=8, r=3, band="r9Orange")
    return k.build()


PARTS = {
    "k01": ((1, 1), k01_stool, "01 stool"), "k02": ((1, 1), k02_mugs, "02 mugs"),
    "k03": ((1, 1), k03_taps, "03 tap heads"), "k04": ((2, 1), k04_pleated, "04 counter, pleated"),
    "k05": ((2, 1), k05_panelled, "05 counter, panelled"), "k06": ((2, 2), k06_booth, "06 booth"),
    "k07": ((1, 1), k07_table, "07 table"), "k08": ((1, 1), k08_dispenser, "08 dispenser"),
    "k09": ((1, 1), k09_canisters, "09 canisters"), "k10": ((1, 1), k10_fittings, "10 fittings"),
    "k11": ((2, 1), k11_console, "11 back console"),
}


def jobs():
    return [(f"module.barkit.{v}", fp, "prop", f) for v, (fp, f, _) in PARTS.items()]
