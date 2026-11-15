"""Bar look study round 13 (family `barcounter13`, palette set bar9, preview only; heights as barcounter_study.py:
counter and table top 24 px, seats 15): the used freighter look, freestanding, built the way the style kit shows
(barkit.py): whole-px edges, patterns inlaid as flush bands in one raised panel, rounded profiles as stepped boxes,
nothing thin enough to break into dots.

  q1 dinette bar (3x2): an L booth, tuck-and-roll backs, round a lipped table; at the right a freestanding dispenser
     column with a louvre, a porthole gauge and a tap head, corrugated down its side
  q2 island bar (3x2): a round-ended counter, roll-and-pleat front over a lit kick, a lipped top; a tap tower of three
     heads over a drip tray
  q3 pod bar (3x2): an L counter channel-quilted on both faces that show, round a tall dispenser column with portholes
     and lights; stools along both runs

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r3 import cyl, lathe
from .barcounter_study import SEAT, TOP
from .barkit import ROLL, bands, indicators, kick, panel, panel_louvre, porthole, top_lip
from .bunk_study import _px
from .research_kit import Bench

FP3 = (3, 2)
CHANNEL = ((1, "r9PadL"), (4, "r9Pad"), (1, "r9PadD"))


def side_bands(k, u, v0, v1, z0, z1, seq, axis="z", d=1):
    """bands() for a face looking +u (the right-hand face): the panel from u to u + d over v0..v1, z0..z1; axis "v"
    runs stripes across it (toward the camera), "z" stacks them from the top down."""
    a, end = (v0, v1) if axis == "v" else (z0, z1)
    pos, i = a, 0
    while pos < end:
        w, col = seq[i % len(seq)]
        b = min(pos + w, end)
        if axis == "v":
            _px(k, u, u + d, pos, b, z0, z1, col)
        else:
            _px(k, u, u + d, v0, v1, z1 - (b - a), z1 - (pos - a), col)
        pos, i = b, i + 1


def stool(k, u, v):
    """A pedestal stool: a foot, a column, a dark seat pan and a cushion with a lit rim."""
    cyl(k, u, v, 0, 1, 5, "r9GreyD", sides=16)
    cyl(k, u, v, 1, SEAT - 4, 1.5, "r9Grey", sides=8)
    cyl(k, u, v, SEAT - 4, SEAT - 2, 6, "r9PadD", sides=18)
    cyl(k, u, v, SEAT - 2, SEAT - 1, 6, "r9Pad", sides=18)
    cyl(k, u, v, SEAT - 1, SEAT, 5, "r9PadL", sides=18)


def mug(k, u, v, col, z=TOP):
    cyl(k, u, v, z, z + 5, 2, "r9Metal", sides=10)
    cyl(k, u, v, z + 4.4, z + 5.05, 1.4, col, sides=10)
    _px(k, u + 2, u + 3, v - 0.5, v + 0.5, z + 1, z + 4, "r9Metal")


def taphead(k, u, v, z, col):
    """A tap head on a 2 px riser: a grey head with a lit top, a coloured nozzle under its front, a lit tag."""
    _px(k, u - 1, u + 1, v - 1, v + 1, z, z + 3, "r9GreyD")
    _px(k, u - 2, u + 2, v - 2, v + 3, z + 3, z + 7, "r9Grey")
    _px(k, u - 2, u + 2, v - 2, v + 3, z + 7, z + 8, "r9Metal")
    _px(k, u - 1, u + 1, v + 1, v + 3, z + 1, z + 3, col)
    _px(k, u - 1, u + 1, v + 3, v + 3.6, z + 5, z + 6, "r9Lamp")


def seat_run(k, u0, u1, v0, v1):
    """A booth seat: a lit kick, a tan box, a cushion with a lit front edge."""
    kick(k, u0, u1, v0, v1)
    _px(k, u0, u1, v0, v1, 4, SEAT - 3, "r9Tan")
    _px(k, u0, u1, v0, v1, SEAT - 3, SEAT, "r9Pad")
    _px(k, u0, u1, v1, v1 + 1, SEAT - 3, SEAT - 1, "r9PadL")


# ---- q1 dinette bar ----------------------------------------------------------------------------------------------
def q1():
    k = Bench("bar_q1", FP3)
    # the L booth: a back run along the rear, an arm down the left
    seat_run(k, -44, 18, -24, -12)
    seat_run(k, -44, -32, -12, 10)
    _px(k, -46, 18, -30, -24, 0, SEAT + 16, "r9Tan")                                 # back run's shell
    bands(k, panel(k, -44, 18, -24, SEAT, SEAT + 14), ROLL, "u")
    _px(k, -46, -40, -24, 10, 0, SEAT + 16, "r9Tan")                                 # arm's shell
    side_bands(k, -40, -12, 10, SEAT, SEAT + 14, ROLL, "v")
    _px(k, -47, 19, -31, -23, SEAT + 16, SEAT + 18, "r9GreyD")                       # cap rails
    _px(k, -47, -39, -23, 11, SEAT + 16, SEAT + 18, "r9GreyD")
    # the table
    for u in (-20, 0):
        _px(k, u - 2, u + 2, -8, -4, 0, TOP - 3, "r9Grey")
        _px(k, u - 5, u + 5, -10, -2, 0, 1, "r9GreyD")
    _px(k, -28, 8, -12, 0, TOP - 3, TOP - 1, "r9GreyD")                              # lip
    _px(k, -27, 7, -11, -1, TOP - 1, TOP, "r9Bone")
    for u, v, col in ((-22, -7, "r9Blue"), (-8, -5, "r9Amber"), (2, -8, "r9Ruby")):
        mug(k, u, v, col)
    # the dispenser column
    U0, U1, V0, V1 = 30, 44, -26, -12
    kick(k, U0, U1, V0, V1)
    _px(k, U0, U1, V0, V1, 4, 46, "r9Sand")
    top_lip(k, U0, U1, V0, V1, 46, over=1)
    panel_louvre(k, U0 + 3, U1 - 3, V1, 6, 16)
    porthole(k, (U0 + U1) / 2, V1, 38, 3.5)
    taphead(k, (U0 + U1) / 2, V1 + 2, 22, "r9Orange")
    _px(k, U0 + 2, U1 - 2, V1, V1 + 6, 18, 19, "r9GreyD")                            # drip tray
    side_bands(k, U1, V0 + 2, V1 - 2, 8, 42, ((1, "r9Metal"), (1, "r9Grey"), (1, "r9GreyD")), "v")
    return k.build()


# ---- q2 island bar -----------------------------------------------------------------------------------------------
def q2():
    k = Bench("bar_q2", FP3)
    U0, U1, V0, V1 = -34, 34, -18, -2
    r, vc = (V1 - V0) / 2, (V0 + V1) / 2
    kick(k, U0, U1, V0, V1)
    for u in (U0, U1):
        cyl(k, u, vc, 0, 4, r - 2, "r9Char", sides=18)
    _px(k, U0, U1, V0, V1, 4, TOP - 3, "r9Bone")
    for u in (U0, U1):
        cyl(k, u, vc, 4, TOP - 3, r, "r9Bone", sides=20)
    bands(k, panel(k, U0, U1, V1, TOP - 10, TOP - 3, d=2), ((1, "r9PadL"), (5, "r9Pad"), (1, "r9PadD")), "z")
    bands(k, panel(k, U0, U1, V1, 5, TOP - 10), ROLL, "u")
    _px(k, U0, U1, V0 - 2, V1 + 3, TOP - 3, TOP - 1, "r9GreyD")                      # lip
    for u in (U0, U1):
        cyl(k, u, vc, TOP - 3, TOP - 1, r + 2.5, "r9GreyD", sides=20)
    _px(k, U0, U1, V0 - 1, V1 + 2, TOP - 1, TOP, "r9Tan")                            # top
    for u in (U0, U1):
        cyl(k, u, vc, TOP - 1, TOP, r + 1.5, "r9Tan", sides=20)
    # the tap tower
    _px(k, -3, 3, -14, -9, TOP, TOP + 16, "r9GreyD")
    _px(k, -14, 14, -15, -9, TOP + 16, TOP + 19, "r9Grey")
    _px(k, -14, 14, -15, -9, TOP + 19, TOP + 20, "r9Metal")
    indicators(k, 6, -9, TOP + 17)
    for u, col in ((-10, "r9Orange"), (-4, "r9Blue"), (10, "r9Orange")):
        _px(k, u - 1, u + 1, -10, -7, TOP + 12, TOP + 16, "r9Grey")
        _px(k, u - 1, u + 1, -8, -6, TOP + 10, TOP + 12, col)
    _px(k, -14, 14, -11, -5, TOP, TOP + 1, "r9Grey")                                 # drip tray
    for u, col in ((-26, "r9Amber"), (20, "r9Blue"), (28, "r9Ruby")):
        mug(k, u, -8, col)
    for u in (-26, 0, 26):
        stool(k, u, 16)
    return k.build()


# ---- q3 pod bar --------------------------------------------------------------------------------------------------
def q3():
    k = Bench("bar_q3", FP3)
    # the column behind
    C0, C1, D0, D1 = -12, 8, -28, -10
    kick(k, C0, C1, D0, D1)
    _px(k, C0, C1, D0, D1, 4, 56, "r9Sand")
    top_lip(k, C0, C1, D0, D1, 56, over=1)
    for zc in (36, 48):
        porthole(k, (C0 + C1) / 2, D1, zc, 3.5)
    indicators(k, C0 + 6, D1, 28)
    side_bands(k, C1, D0 + 2, D1 - 2, 26, 54, ((1, "r9Metal"), (1, "r9Grey"), (1, "r9GreyD")), "v")
    # the L counter: a front run and a right run
    F = (-44, 22, -2, 12)                                                            # front run u0, u1, v0, v1
    R = (22, 36, -30, 12)                                                            # right run
    for u0, u1, v0, v1 in (F, R):
        kick(k, u0, u1, v0, v1)
        _px(k, u0, u1, v0, v1, 4, TOP - 3, "r9Bone")
    bands(k, panel(k, F[0], F[1], F[3], 6, TOP - 4), CHANNEL, "z")
    side_bands(k, R[1], R[2], R[3], 6, TOP - 4, CHANNEL, "z")
    _px(k, F[0] - 2, R[1] + 2, F[2] - 2, F[3] + 2, TOP - 3, TOP - 1, "r9GreyD")      # lips
    _px(k, R[0] - 2, R[1] + 2, R[2] - 2, F[2] - 2, TOP - 3, TOP - 1, "r9GreyD")
    _px(k, F[0] - 1, R[1] + 1, F[2] - 1, F[3] + 1, TOP - 1, TOP, "r9Tan")            # tops
    _px(k, R[0] - 1, R[1] + 1, R[2] - 1, F[2] - 1, TOP - 1, TOP, "r9Tan")
    # taps off the column over the front run
    _px(k, -10, 6, D1, D1 + 6, 30, 33, "r9Grey")
    _px(k, -10, 6, D1, D1 + 6, 33, 34, "r9Metal")
    for u, col in ((-6, "r9Orange"), (2, "r9Blue")):
        _px(k, u - 1, u + 1, D1 + 3, D1 + 5, 27, 30, col)
    for u, v, col in ((-30, 4, "r9Amber"), (12, 5, "r9Blue"), (29, -18, "r9Ruby")):
        mug(k, u, v, col)
    for u in (-32, -12, 8):
        stool(k, u, 22)
    for v in (-18, -2):
        stool(k, 44, v)
    return k.build()


DESIGNS = {"q1": (FP3, q1), "q2": (FP3, q2), "q3": (FP3, q3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
