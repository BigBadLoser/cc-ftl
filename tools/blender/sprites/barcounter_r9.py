"""Bar look study round 9 (family `barcounter9`, palette set bar9, preview only; heights as barcounter_study.py: counter
top 24 px, stool seats 15): a used, lived-in freighter look; weathered bone and tan panels, quilted padding, conduit,
greebles and small indicator lights, no neon.

  l1 arc bar (3x2): a semicircular bone counter with a quilted padded front, opening to the back round a squat greebled
     dispenser column; a tall rack of canisters at each side
  l2 galley bar (3x2): a straight counter with a quilted front and a rolled tan edge, in front of a greebled galley wall:
     conduit runs, grilles, a lit dispenser bay with three nozzles; domed kegs at the left
  l3 tank bar (3x2): a slab counter laid on a big ribbed tank; behind it a domed distiller with a porthole, hosed to a tap
     on the counter, and a stack of supply crates

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import seg3, stool
from .barcounter_r7 import hcyl
from .barcounter_r8 import hose
from .barcounter_study import TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

FP3 = (3, 2)


def rnd(seed):
    """A small deterministic generator: yields floats in [0, 1)."""
    x = seed * 2654435761 % 4294967296
    while True:
        x = (1103515245 * x + 12345) % 2147483648
        yield x / 2147483648


def greeble(k, u0, u1, v, z0, z1, seed, cols=("r9Grey", "r9GreyD", "r9Sand"), n=None):
    """Small boxes stuck out of the face at depth v (facing +v) over u0..u1, z0..z1 px."""
    r = rnd(seed)
    for _ in range(n or int((u1 - u0) * (z1 - z0) / 30)):
        w, h, d = 1 + 4 * next(r), 1 + 3 * next(r), 0.5 + 1.2 * next(r)
        u, z = u0 + (u1 - u0 - w) * next(r), z0 + (z1 - z0 - h) * next(r)
        _px(k, u, u + w, v, v + d, z, z + h, cols[int(next(r) * len(cols))])


def quilt(k, u0, u1, v, z0, z1, s=4):
    """Quilted padding facing +v: a grid of squares stood out alternately."""
    _px(k, u0, u1, v - 1, v, z0, z1, "r9PadD")
    for i, u in enumerate(range(int(u0), int(u1) - s + 1, s)):
        for j, z in enumerate(range(int(z0), int(z1) - s + 1, s)):
            _px(k, u + 0.4, u + s - 0.4, v, v + (0.9 if (i + j) % 2 else 0.6), z + 0.4, z + s - 0.4, "r9Pad")


def leds(k, u, v, z, cols=("r9LedR", "r9LedG", "r9Lamp")):
    for i, c in enumerate(cols):
        _px(k, u + 2 * i, u + 2 * i + 1, v, v + 0.6, z, z + 1, c)


def drink(k, g, u, v, col):
    cyl(g, u, v, TOP, TOP + 5, 1.8, "r9Glass")
    cyl(k, u, v, TOP, TOP + 3, 1.5, col)


def padstool(k, u, v):
    cyl(k, u, v, 0, 2, 4.5, "r9GreyD")
    cyl(k, u, v, 2, 11, 2.2, "r9Grey")
    cyl(k, u, v, 11, 15, 5.5, "r9Pad", r1=5)


# ---- l1 arc bar ---------------------------------------------------------------------------------------------------
def l1():
    k = Bench("bar_l1", FP3)
    g = k.part("glass")
    CV, N = -26, 14
    for i in range(N):                                                               # the arc, segment by segment
        a = math.pi * (i + 0.5) / N
        ca, sa, rz = math.cos(a), math.sin(a), a - math.pi / 2
        w = math.pi * 27 / N * 1.08

        def seg(r, d, z0, z1, col, wf=1.0):
            k.box(r * ca / 32, (CV + r * sa) / 32, z0 / ZPX, w * wf * r / 27 / 32, d / 32, (z1 - z0) / ZPX, col, rz=rz)
        seg(20, 8, 0, 3, "r9Char")                                                   # recessed kick
        seg(21, 10, 3, TOP - 2, "r9Bone")
        seg(26.3, 1.2, 7, TOP - 5, "r9Pad")                                          # padded front
        seg(26.3, 1.5, 7 + 7.5 * (i % 2), 8.2 + 7.5 * (i % 2), "r9PadD")             # its tufting
        seg(21.5, 13, TOP - 2, TOP, "r9Tan")                                         # the top
    # the dispenser column in the middle
    lathe(k, 0, CV, ((0, 9), (4, 9), (4, 7), (34, 7), (38, 5), (52, 5), (56, 7), (60, 7)), "r9Grey", sides=16)
    for z in (12, 20, 28):
        cyl(k, 0, CV, z, z + 2, 7.6, "r9GreyD", sides=16)                            # ribs
    cyl(k, 0, CV, 38, 52, 5.6, "r9Sand", sides=16)
    greeble(k, -5, 5, CV + 6.6, 40, 50, 3, n=10)
    leds(k, -3, CV + 7.4, 31)
    for a in (-0.7, 0.7):                                                            # two nozzles over the counter
        u, v = 8 * math.sin(a), CV + 8 * math.cos(a)
        seg3(k, (u * 0.8, v - 1, 36), (u * 1.5, CV + 13, TOP + 9), 1.4, "r9GreyD")
        cyl(k, u * 1.5, CV + 13, TOP + 6, TOP + 9, 1, "r9Orange")
    # canister racks at the sides
    for u0 in (-46, 34):
        _px(k, u0, u0 + 12, -32, -22, 0, 2, "r9GreyD")
        for uu in (u0, u0 + 11):
            _px(k, uu, uu + 1, -32, -22, 2, 50, "r9GreyD")
        for z in (2, 26):
            _px(k, u0, u0 + 12, -32, -22, z, z + 1.5, "r9Grey")
            lathe(k, u0 + 6, -27, ((z + 1.5, 4), (z + 18, 4), (z + 21, 2.5), (z + 22, 1)), "r9Bone", sides=12)
            cyl(k, u0 + 6, -27, z + 7, z + 9, 4.3, "r9Orange", sides=12)
        _px(k, u0, u0 + 12, -32, -22, 50, 52, "r9Grey")
    drink(k, g, -18, -12, "r9Blue")
    drink(k, g, 14, -6, "r9Amber")
    for a in (35, 90, 145):
        r = math.radians(a)
        padstool(k, 33 * math.cos(r), CV + 33 * math.sin(r))
    return k.build()


# ---- l2 galley bar ------------------------------------------------------------------------------------------------
def l2():
    k = Bench("bar_l2", FP3)
    g = k.part("glass")
    # the galley wall
    _px(k, -48, 48, -32, -28, 0, 64, "r9Sand")
    for u in (-48, -16, 16, 46):
        _px(k, u, u + 2, -28, -27, 0, 64, "r9Tan")                                  # frame ribs
    for zc in (58, 53):
        hcyl(k, -48, 48, -26, zc, 2, "r9Grey", n=6)                                       # conduit
    for u in range(-44, 46, 12):
        hcyl(k, u, u + 2, -26, 58, 2.6, "r9GreyD")                                   # clamps
    for u0 in (-44, 20):                                                             # vent grilles
        _px(k, u0, u0 + 22, -28, -27.6, 30, 44, "r9Char")
        for z in range(31, 44, 2):
            _px(k, u0 + 1, u0 + 21, -27.6, -26.8, z, z + 0.8, "r9GreyD")
    greeble(k, -44, -18, -28, 2, 28, 11)
    greeble(k, 18, 44, -28, 2, 28, 12)
    # the dispenser bay
    _px(k, -12, 12, -28, -27, 26, 50, "r9GreyD")
    _px(k, -10, 10, -27.5, -26.5, 28, 48, "r9Char")
    _px(k, -9, 9, -27, -26, 46, 47, "r9Lamp")                                        # a warm bay light
    for u in (-6, 0, 6):
        cyl(k, u, -24, 36, 46, 1.4, "r9Grey")
        cyl(k, u, -24, 34, 36, 0.9, "r9Orange")
    _px(k, -10, 10, -27, -21, 26, 28, "r9Grey")                                      # drip tray
    leds(k, -10, -26.4, 49)
    # domed kegs at the left
    for u in (-40, -30):
        lathe(k, u, -21, ((0, 4.5), (20, 4.5), (23, 3), (24, 1)), "r9Bone", sides=12)
        cyl(k, u, -21, 6, 8, 4.8, "r9Orange", sides=12)
    # the counter
    _px(k, -48, 48, -14, -3, 0, 4, "r9Char")                                         # recessed kick
    _px(k, -48, 48, -16, -1, 4, TOP - 2, "r9Bone")
    quilt(k, -46, 46, 0, 7, TOP - 4)
    _px(k, -49, 49, -17, 0, TOP - 2, TOP, "r9Tan")
    hcyl(k, -49, 49, 0, TOP - 1.2, 1.6, "r9Pad")                                     # rolled edge
    for u, col in ((-24, "r9Blue"), (-4, "r9Amber"), (28, "r9Ruby")):
        drink(k, g, u, -8, col)
    for u in (-32, 0, 32):
        padstool(k, u, 16)
    return k.build()


# ---- l3 tank bar --------------------------------------------------------------------------------------------------
def l3():
    k = Bench("bar_l3", FP3)
    g = k.part("glass")
    _px(k, -42, -34, -16, 0, 0, 3, "r9GreyD")                                        # cradles
    _px(k, 34, 42, -16, 0, 0, 3, "r9GreyD")
    hcyl(k, -46, 46, -8, 10, 8, "r9Grey", n=6)                                            # the tank
    for u in range(-44, 45, 11):
        hcyl(k, u, u + 2, -8, 10, 8.5, "r9GreyD", n=6)                                    # ribs
    _px(k, -10, 10, 0, 1.6, 10, 16, "r9Orange")                                      # a stencil plate
    _px(k, -8, 8, 1.6, 2, 12, 14, "r9Bone")
    for u in (-30, 30):
        _px(k, u - 2, u + 2, -14, -2, 18, TOP - 2, "r9GreyD")                        # risers
    _px(k, -48, 48, -17, 1, TOP - 2, TOP, "r9Bone")                                  # the slab
    _px(k, -48, 48, 1, 1.6, TOP - 3, TOP, "r9Tan")
    # the distiller
    DU, DV = -22, -25
    lathe(k, DU, DV, ((0, 10), (3, 10), (3, 9), (36, 9), (42, 6), (44, 2)), "r9Bone", sides=18)
    for z in (8, 30):
        cyl(k, DU, DV, z, z + 2, 9.5, "r9Tan", sides=18)
    cyl(k, DU, DV - 9, 44, 50, 0.8, "r9GreyD")
    _px(k, DU - 4, DU + 4, DV + 8.5, DV + 9.5, 14, 24, "r9GreyD")                    # porthole bezel
    _px(g, DU - 3, DU + 3, DV + 9.5, DV + 10, 15, 23, "r9Glass")
    _px(k, DU - 3, DU + 3, DV + 9, DV + 9.4, 15, 19, "r9Amber")                      # the brew behind it
    leds(k, DU - 3, DV + 9.2, 27)
    hose(k, ((DU + 8, DV + 4, 30), (DU + 16, DV + 8, 34), (DU + 20, -10, TOP + 12)), 1.8, "r9GreyD")
    cyl(k, DU + 20, -10, TOP, TOP + 12, 1.2, "r9Grey")                               # the tap
    seg3(k, (DU + 20, -10, TOP + 12), (DU + 20, -6, TOP + 10), 1, "r9Orange")
    # supply crates and a canister at the right
    for (u, v, z, s) in ((22, -26, 0, 12), (35, -26, 0, 11), (28, -26, 12, 11)):
        _px(k, u - s / 2, u + s / 2, v - s / 2, v + s / 2, z, z + s, "r9Tan")
        _px(k, u - s / 2, u + s / 2, v + s / 2, v + s / 2 + 0.6, z + s / 2 - 1, z + s / 2 + 1, "r9PadD")
        greeble(k, u - s / 2 + 1, u + s / 2 - 1, v + s / 2, z + 1, z + s / 2 - 1, int(u), n=3)
    lathe(k, 2, -28, ((0, 4), (26, 4), (29, 2)), "r9Grey", sides=12)
    cyl(k, 2, -28, 18, 20, 4.3, "r9Orange", sides=12)
    # a caged work lamp on the distiller
    cyl(k, DU, DV, 44, 47, 2.2, "r9Lamp")
    for u, col in ((-34, "r9Blue"), (8, "r9Amber"), (34, "r9Amber")):
        drink(k, g, u, -8, col)
    for u in (-32, 0, 32):
        padstool(k, u, 16)
    return k.build()


DESIGNS = {"l1": (FP3, l1), "l2": (FP3, l2), "l3": (FP3, l3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
