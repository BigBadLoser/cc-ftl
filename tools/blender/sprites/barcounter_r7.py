"""Bar look study round 7 (family `barcounter7`, palette set bar7, preview only; heights as barcounter_study.py: counter
top 24 px, stool seats 15): three new formats, each with its own source of drink.

  j1 still bar (3x2): a stave-fronted oak counter; behind it a copper pot still on a brick firebox, its swan neck run
     into a coiled condenser whose spout drips into a jug on the counter; a pyramid of casks on a rack at the right
  j2 pod bar (2x2): a scorched escape pod stood on end, its hatch dropped forward into a ledge on two chains; inside
     the hatch a lit nook of bottle shelves; stools round the front
  j3 garden bar (3x2): a stone-topped terracotta counter with a planter trough along its foot; behind it hydroponic
     towers, a stand of three juice urns with taps, and a pergola beam hung with vines and magenta grow lamps

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import bottle, seg3, stool
from .barcounter_study import TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

FP3, FP2 = (3, 2), (2, 2)
BOTTLES = ("r7Amber", "r7Ruby", "r7Mint", "r7Glass")


def hcyl(k, u0, u1, v, zc, r, col):
    """A cylinder lying along u from u0 to u1 px, axis at depth v and height zc px, radius r px: three square boxes
    turned 30 deg apart about the axis (a dodecagon)."""
    R = r / 32
    for i in range(3):
        k.box((u0 + u1) / 64, v / 32, zc / ZPX - R, (u1 - u0) / 32, 2 * R, 2 * R, col, rx=i * math.pi / 6)


def cask(k, u0, u1, v, zc, r):
    hcyl(k, u0, u1, v, zc, r, "r7Oak")
    for a, b in ((u0 + 1, u0 + 3), (u1 - 3, u1 - 1), ((u0 + u1) / 2 - 1, (u0 + u1) / 2 + 1)):
        hcyl(k, a, b, v, zc, r + 0.5, "r7Hoop")                                     # hoops


def bush(k, u, v, z, s, cols=("r7Leaf", "r7LeafD")):
    """A leafy clump about s px across: tilted leaf slabs fanned round a centre."""
    for i in range(6):
        a = i * math.tau / 6 + 0.4 * (i % 2)
        cu, cv = u + math.cos(a) * s / 4, v + math.sin(a) * s / 4
        k.box(cu / 32, cv / 32, z / ZPX, s / 64, s / 110, s / 3 / ZPX * 2, cols[i % 2], rz=a, rx=0.5 + 0.3 * (i % 3))


# ---- j1 still bar -------------------------------------------------------------------------------------------------
def j1():
    k = Bench("bar_j1", FP3)
    g = k.part("glass")
    _px(k, -48, 48, -15, -2, 0, 2, "r7OakD")                                         # plinth
    _px(k, -48, 48, -16, 0, 2, TOP - 2, "r7Oak")                                     # body
    for u in range(-46, 47, 5):
        _px(k, u, u + 1, 0, 1, 2, TOP - 2, "r7OakD")                                 # staves
    for z in (6, 16):
        _px(k, -48, 48, 0, 1.5, z, z + 1.5, "r7Hoop")                                # iron bands
    _px(k, -49, 49, -17, 2, TOP - 2, TOP, "r7OakD")                                  # plank top
    # the pot still at the left, on a brick firebox
    PU, PV = -30, -26
    _px(k, PU - 9, PU + 9, PV - 7, PV + 7, 0, 7, "r7Brick")
    _px(k, PU - 3, PU + 3, PV + 7, PV + 8, 1, 5, "r7Fire")                           # the firebox mouth, glowing
    lathe(k, PU, PV, ((7, 8), (10, 11), (20, 12), (26, 10), (31, 5), (34, 3), (38, 2.5)), "r7Copper", sides=20)
    cyl(k, PU, PV, 18, 19, 12.4, "r7CopperD", sides=20)                              # a seam round the pot
    # swan neck to the condenser
    CU, CV = 2, -26
    seg3(k, (PU, PV, 38), (PU + 10, PV, 46), 2.5, "r7Copper")
    seg3(k, (PU + 10, PV, 46), (CU - 4, CV, 42), 2.5, "r7Copper")
    cyl(k, CU, CV, 0, 2, 7, "r7Char")
    cyl(k, CU, CV, 2, 42, 6, "r7Steel")                                              # the condenser tank
    for z in range(8, 40, 4):
        cyl(k, CU, CV, z, z + 1.5, 7, "r7Copper")                                    # its coil
    cyl(k, CU, CV, 42, 44, 6.5, "r7CopperD")
    seg3(k, (CU, CV + 6, 34), (CU, -10, TOP + 9), 1.5, "r7Copper")                   # spout over the counter
    _px(k, CU - 0.5, CU + 0.5, -10, -9, TOP + 5, TOP + 8, "r7Amber")                 # the drip
    cyl(g, CU, -9, TOP, TOP + 7, 2.6, "r7Glass")                                     # the jug
    cyl(k, CU, -9, TOP, TOP + 3, 2.3, "r7Amber")
    # casks on a rack at the right
    _px(k, 14, 47, -32, -16, 0, 3, "r7OakD")
    cask(k, 15, 30, -24, 11, 8)
    cask(k, 31, 46, -24, 11, 8)
    cask(k, 23, 38, -24, 26, 8)
    _px(k, 37, 39, -16, -15, 6, 10, "r7Brass")                                        # a tap in the low cask
    # a cage lamp on a post between still and condenser, drinks on the counter
    cyl(k, -12, -28, 0, 50, 0.8, "r7Hoop")
    cyl(k, -12, -26, 46, 50, 2, "r7Lamp")
    for u, col in ((-34, "r7Amber"), (-20, "r7Ruby"), (22, "r7Amber")):
        cyl(g, u, -6, TOP, TOP + 5, 1.8, "r7Glass")
        cyl(k, u, -6, TOP, TOP + 3, 1.5, col)
    for u in (-32, 0, 32):
        stool(k, u, 16, "r7Seat", stem="r7Hoop")
    return k.build()


# ---- j2 pod bar ---------------------------------------------------------------------------------------------------
def j2():
    k = Bench("bar_j2", FP2)
    g = k.part("glass")
    PV = -12
    lathe(k, 0, PV, ((0, 20), (2, 20), (4, 17)), "r7Char", sides=24)                 # landing ring
    lathe(k, 0, PV, ((4, 17), (52, 17), (64, 9), (67, 7)), "r7Hull", sides=24)       # the pod
    cyl(k, 0, PV, 67, 70, 5, "r7Scorch", sides=16)                                   # burnt nose
    lathe(k, 0, PV, ((52, 17.2), (60, 12.6)), "r7Scorch", sides=24)                  # scorch on the shoulder
    for z in (10, 50):
        cyl(k, 0, PV, z, z + 3, 17.4, "r7Hazard", sides=24)                          # hazard bands
    cyl(k, 0, PV, 70, 78, 0.5, "r7Char")                                             # an antenna
    cyl(k, 0, PV, 78, 79, 1, "r7Lamp")
    # the open hatch: a frame, a dark lit nook with shelves of bottles
    _px(k, -12, 12, 2, 7, 22, 50, "r7Hazard")
    _px(k, -10, 10, 2, 7.5, 24, 48, "r7Dark")
    for z in (30, 39):
        _px(k, -10, 10, 7.5, 10, z - 1, z, "r7Oak")
        for i, u in enumerate(range(-8, 9, 4)):
            bottle(k, u, 9, z, BOTTLES[(i + z) % 4], h=7, r=1.4)
    cyl(k, 0, 8, 46, 48, 3, "r7Lamp")                                                # a lamp in the nook's roof
    # the hatch door, dropped forward into a ledge, on two chains
    _px(k, -12, 12, 7, 19, TOP - 2, TOP, "r7Hull")
    _px(k, -12, 12, 17, 19, TOP - 3, TOP, "r7Hazard")
    for u in (-11, 11):
        seg3(k, (u, 18, TOP), (u, 7.5, 48), 0.8, "r7Char")
    for u, col in ((-6, "r7Ruby"), (5, "r7Mint")):
        cyl(g, u, 14, TOP, TOP + 5, 1.8, "r7Glass")
        cyl(k, u, 14, TOP, TOP + 3, 1.5, col)
    for a in (-55, 0, 55):
        r = math.radians(a + 90)
        stool(k, 30 * math.cos(r), PV + 30 * math.sin(r), "r7Hazard")
    return k.build()


# ---- j3 garden bar ------------------------------------------------------------------------------------------------
def j3():
    k = Bench("bar_j3", FP3)
    g = k.part("glass")
    _px(k, -48, 48, -16, 0, 0, TOP - 2, "r7Terra")                                   # counter body
    _px(k, -49, 49, -17, 2, TOP - 2, TOP, "r7Stone")                                 # stone top
    _px(k, -46, 46, 0, 5, 0, 8, "r7TerraD")                                          # planter trough at its foot
    _px(k, -45, 45, 1, 4, 8, 8.5, "r7Soil")
    for u in range(-40, 41, 10):
        bush(k, u, 2.5, 7, 9)
    # back: two hydroponic towers, a stand of juice urns between them
    for u in (-36, 36):
        cyl(k, u, -26, 0, 2, 6, "r7Char")
        cyl(k, u, -26, 2, 52, 4.5, "r7Bone")
        for z in range(10, 50, 9):
            bush(k, u, -22, z, 7)
    _px(k, -18, 18, -32, -20, 0, 20, "r7Stone")                                      # urn stand
    for u, col in ((-11, "r7Mint"), (0, "r7Juice"), (11, "r7Berry")):
        cyl(k, u, -26, 20, 21, 5, "r7Steel")
        cyl(k, u, -26, 21, 34, 4.5, col)                                             # the juice
        cyl(g, u, -26, 20, 38, 5, "r7Glass")                                         # the urn
        cyl(k, u, -26, 38, 40, 5.2, "r7Steel")                                       # lid
        _px(k, u - 1, u + 1, -21, -18, 22, 24, "r7Steel")                            # tap
    # pergola: two posts, a beam across, grow lamps under it, vines hung down
    for u in (-47, 45):
        _px(k, u, u + 2, -31, -29, 0, 62, "r7Oak")
    _px(k, -48, 48, -31, -27, 62, 65, "r7Oak")
    for u in (-30, 0, 30):
        _px(k, u - 10, u + 10, -29, -27, 59, 61, "r7Grow")
    for u in range(-44, 45, 7):
        h = 6 + (u * 7) % 11
        _px(k, u, u + 1.5, -27, -26, 62 - h, 62, "r7LeafD")
        bush(k, u, -26, 60 - h, 4)
    # on the counter: a fruit bowl and glasses
    cyl(k, -24, -8, TOP, TOP + 3, 5, "r7Bone", r1=6)
    for du, dv, col in ((-2, -1, "r7Juice"), (2, 0, "r7Berry"), (0, 2, "r7Mint")):
        cyl(k, -24 + du, -8 + dv, TOP + 3, TOP + 5, 1.8, col)
    for u, col in ((6, "r7Juice"), (20, "r7Berry"), (32, "r7Mint")):
        cyl(g, u, -6, TOP, TOP + 6, 1.8, "r7Glass")
        cyl(k, u, -6, TOP, TOP + 4, 1.5, col)
    for u in (-32, 0, 32):
        stool(k, u, 16, "r7Leaf", stem="r7Steel")
    return k.build()


DESIGNS = {"j1": (FP3, j1), "j2": (FP2, j2), "j3": (FP3, j3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
