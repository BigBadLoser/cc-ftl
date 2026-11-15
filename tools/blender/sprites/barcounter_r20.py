"""Bar look study round 20 (family `barcounter20`, palette sets bar17 + bar9, preview only; counter top 24 px): the
three counters picked so far, refined.

  x3b prow counter (from x3): the off-white top toned down to a warm bone and framed by a gunmetal lip, so it no
     longer outshines the oxide red; seams split the upper band into panels; the rub strip carries a few fasteners
  v3b rack counter (from v3): calmer bays, one kind of cargo each in matching tones (a strapped crate, a pair of
     canisters, a stack of cases); the frame in gunmetal; the padded strip runs the length of the plate top
  t1b padded counter (from t1): a darker lip and a slimmer top, the kick light dimmer and deeper under the body, a
     gunmetal band at the foot of the pleats

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r13 import mug
from .barcounter_r17 import diamond
from .barcounter_r3 import cyl, lathe
from .barcounter_study import TOP
from .barkit import ROLL, bands, panel
from .bunk_study import _px
from .research_kit import Bench

FP = (3, 1)
U0, U1, V0, V1 = -46, 46, -12, 4


def x3b():
    k = Bench("bar_x3b", FP)
    C = 8
    u0, u1 = U0 + C, U1 - C

    def run(z0, z1, col, grow=0.0):
        _px(k, u0, u1, V0 - grow, V1 + grow, z0, z1, col)
        _px(k, U0 - grow, U1 + grow, V0 - grow, V1 - C, z0, z1, col)
        for u in (u0, u1):
            diamond(k, u, V1 - C, z0, z1, C + grow * math.sqrt(2), col)
    _px(k, u0, u1, V0 + 2, V1 - 2, 0, 3, "x7Gun")
    run(3, 12, "x7Oxide")
    for u in range(u0 + 2, u1 - 1, 5):
        _px(k, u, u + 2, V1, V1 + 0.8, 4, 11, "x7OxideD")
    run(12, 15, "x7Gun", grow=1)
    for u in range(u0 + 4, u1 - 2, 12):
        _px(k, u, u + 1, V1 + 1, V1 + 1.6, 13, 14, "x7Steel")                        # fasteners on the rub strip
    run(15, TOP - 3, "x7Bone")
    for u in range(u0 + 12, u1 - 4, 14):
        _px(k, u, u + 1, V1, V1 + 0.6, 15, TOP - 3, "x7Gun")                          # panel seams
    run(TOP - 3, TOP - 1, "x7Gun", grow=1.5)                                         # gunmetal lip
    run(TOP - 1, TOP, "x7Bone", grow=1)
    for u, col in ((-22, "r9Amber"), (16, "r9Ruby")):
        mug(k, u, -4, col)
    return k.build()


def v3b():
    k = Bench("bar_v3b", FP)
    for u in (U0, -16, 14, U1 - 2):
        for v in (V0, V1 - 2):
            _px(k, u, u + 2, v, v + 2, 0, TOP - 3, "x7Gun")
    for z in (1, 11):
        _px(k, U0, U1, V1 - 2, V1, z, z + 2, "r9GreyD")
        _px(k, U0, U1, V0, V0 + 2, z, z + 2, "r9GreyD")
    _px(k, U0, U1, V0, V1, 0.5, 1, "r9Char")
    # a strapped crate
    _px(k, U0 + 4, -19, V0 + 3, V1 - 4, 3, 19, "r9Sand")
    for z0, z1 in ((3, 5), (17, 19)):
        _px(k, U0 + 4, -19, V1 - 4, V1 - 3, z0, z1, "r9Tan")
    _px(k, U0 + 14, U0 + 16, V1 - 4, V1 - 3, 3, 19, "r9Char")
    # a pair of canisters
    for u in (-8, 5):
        lathe(k, u, -2, ((3, 4.5), (16, 4.5), (18, 3), (19, 1)), "r9Bone", sides=16)
        cyl(k, u, -2, 9, 11, 4.8, "r9Orange", sides=16)
    # a stack of cases
    for z, col in ((3, "r9Sand"), (9, "r9Tan"), (15, "r9Sand")):
        _px(k, 18, U1 - 5, V0 + 4, V1 - 4, z, z + 5, col)
        _px(k, 29, 33, V1 - 4, V1 - 3.4, z + 2, z + 3, "r9GreyD")
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 3, TOP - 1, "r9GreyD")
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 1, TOP, "r9Grey")
    _px(k, U0 - 1, U1 + 1, V1 - 3, V1 + 1, TOP, TOP + 1, "r9Pad")
    _px(k, U0 - 1, U1 + 1, V1 + 1, V1 + 1.5, TOP - 0.5, TOP + 1, "r9PadD")
    for u, col in ((-30, "r9Amber"), (10, "r9Ruby")):
        mug(k, u, -6, col)
    return k.build()


def t1b():
    k = Bench("bar_t1b", FP)
    V0_, V1_ = -12, 8
    u0, u1 = U0 + 8, U1 - 8
    r, vc = (V1_ - V0_) / 2, (V0_ + V1_) / 2
    _px(k, u0, u1, V0_ + 3, V1_ - 3, 0, 4, "r9Char")                                 # deeper kick
    _px(k, u0, u1, V1_ - 3, V1_ - 2.5, 0.3, 1.3, "r9Warm")
    for u in (u0, u1):
        cyl(k, u, vc, 0, 4, r - 3, "r9Char", sides=20)
        cyl(k, u, vc, 4, TOP - 3, r, "r9Bone", sides=24)
    _px(k, u0, u1, V0_, V1_, 4, TOP - 3, "r9Bone")
    _px(k, u0, u1, V1_, V1_ + 1, 4, 6, "x7Gun")                                      # a band at the pleats' foot
    bands(k, panel(k, u0, u1, V1_, 6, TOP - 4), ROLL, "u")
    _px(k, u0, u1, V0_ - 1.5, V1_ + 1.5, TOP - 3, TOP - 1, "x7Gun")                   # darker lip
    _px(k, u0, u1, V0_ - 1, V1_ + 1, TOP - 1, TOP, "r9Tan")
    for u in (u0, u1):
        cyl(k, u, vc, TOP - 3, TOP - 1, r + 1.5, "x7Gun", sides=24)
        cyl(k, u, vc, TOP - 1, TOP, r + 1, "r9Tan", sides=24)
    for u, col in ((-24, "r9Amber"), (14, "r9Blue")):
        mug(k, u, -2, col)
    return k.build()


COUNTERS = {"x3b": x3b, "v3b": v3b, "t1b": t1b}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in COUNTERS.items()]


def y3b():
    """y3 (gunmetal drum, oxide band) with its seat in x3b's bone."""
    k = Bench("stool_y3b", (1, 1))
    cyl(k, 0, 0, 0, 13, 5.5, "x7Gun", sides=18)
    cyl(k, 0, 0, 4, 7, 5.8, "x7Oxide", sides=18)
    cyl(k, 0, 0, 13, 15, 5.8, "x7Bone", sides=18)
    return k.build()


def stool_jobs():
    """The stools paired with these counters: y3b (y3 with a bone seat) for x3b, and from round 15 u2 (square) for
    v3b and u1 (pedestal) for t1b."""
    from .barcounter_r15 import u1, u2
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in (("y3b", y3b), ("u2", u2), ("u1", u1))]
