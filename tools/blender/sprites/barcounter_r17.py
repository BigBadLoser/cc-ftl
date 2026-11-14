"""Bar look study round 17 (families `barcounter17` and `barstool17`, palette set bar17, preview only; counter top 24
px, seat 15): new colours and shapes. Each counter has its own palette, and the shapes use faces set 45 deg across
the floor: in this view such a face's edges run straight up or straight across the screen, so they stay crisp.

Counters (3x1):
  x1 faceted counter: deep teal, its front a sawtooth of 45 deg facets that catch the light in turn; a cream top
     edged in brass; a brass foot rail on posts along the front
  x2 case counter: olive drab built like a transport case, with stepped corner guards, black rubber edges, recessed
     handholds, latches and a yellow stencilled number; a khaki top
  x3 prow counter: oxide red below a raised gunmetal rub strip, off-white above, its front corners cut at 45 deg;
     vertical steel ribs on the lower half; an off-white top cut to match
Stools (1x1), one to suit each: y1 brass pedestal with a teal seat; y2 olive tube stool with a khaki seat and a
foot ring; y3 gunmetal drum with an oxide band and an off-white seat.

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r13 import mug
from .barcounter_r3 import cyl
from .barcounter_study import SEAT, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

FP = (3, 1)
U0, U1, V0, V1 = -46, 46, -12, 4
Q = math.pi / 4


def diamond(k, u, v, z0, z1, half, col):
    """A square column turned 45 deg about z, centred at (u, v), its corners `half` px from the centre."""
    s = half * math.sqrt(2) / 32
    k.box(u / 32, v / 32, z0 / ZPX, s, s, (z1 - z0) / ZPX, col, rz=Q)


# ---- counters ----------------------------------------------------------------------------------------------------
def x1():
    k = Bench("bar_x1", FP)
    _px(k, U0 + 2, U1 - 2, V0 + 2, V1 - 2, 0, 3, "x7Black")
    _px(k, U0, U1, V0, V1, 3, TOP - 3, "x7Teal")
    for u in range(U0 + 6, U1 - 5, 12):                                              # the sawtooth front
        diamond(k, u, V1, 3, TOP - 2, 6, "x7Teal")
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 3, TOP - 2, "x7Brass")              # brass edge under the top
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 2, TOP, "x7Cream")                  # (the facets stand proud of it)
    for u in range(U0 + 4, U1 - 3, 22):                                              # foot rail posts
        _px(k, u, u + 2, V1 + 6, V1 + 8, 0, 5, "x7BrassD")
    _px(k, U0 + 2, U1 - 2, V1 + 7, V1 + 10, 4, 6, "x7Brass")                         # the rail
    _px(k, U0 + 2, U1 - 2, V1 + 7, V1 + 10, 6, 6.6, "x7Lit")
    for u, col in ((-26, "r9Amber"), (12, "r9Ruby")):
        mug(k, u, -4, col)
    return k.build()


def x2():
    k = Bench("bar_x2", FP)
    _px(k, U0, U1, V0, V1, 0, 2, "x7Black")                                          # rubber skid
    _px(k, U0, U1, V0, V1, 2, TOP - 3, "x7Olive")
    for z0, z1 in ((2, 4), (TOP - 5, TOP - 3)):                                      # rubber edges
        _px(k, U0 - 0.5, U1 + 0.5, V0, V1 + 0.6, z0, z1, "x7Black")
    for u in (U0, U1 - 6):                                                           # stepped corner guards
        for z0, z1 in ((2, 8), (TOP - 9, TOP - 3)):
            _px(k, u - 0.6, u + 6.6, V1 - 6, V1 + 1, z0, z1, "x7OliveD")
    for z0, z1 in ((2, 8), (TOP - 9, TOP - 3)):                                      # the guards round the end
        _px(k, U1, U1 + 0.6, V0, V1 - 6, z0, z1, "x7OliveD")
    for u in (-30, 18):                                                              # recessed handholds
        _px(k, u, u + 10, V1, V1 + 0.6, 12, 14, "x7Black")
        _px(k, u, u + 10, V1 + 0.6, V1 + 1, 14, 14.6, "x7OliveL")
    for u in (-12, 4):                                                               # latches
        _px(k, u, u + 4, V1, V1 + 1.4, 15, 18, "x7Steel")
        _px(k, u + 1, u + 3, V1 + 1.4, V1 + 2, 15, 16, "x7Black")
    _px(k, -40, -38, V1, V1 + 0.6, 6, 12, "x7Yellow")                                # a stencilled "17"
    _px(k, -35, -31, V1, V1 + 0.6, 10, 12, "x7Yellow")
    _px(k, -33, -31, V1, V1 + 0.6, 6, 10, "x7Yellow")
    _px(k, U0 - 1, U1 + 1, V0 - 1, V1 + 1, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, V0, V1 + 0.5, TOP - 1, TOP, "x7Khaki")
    for u, col in ((-24, "r9Amber"), (20, "r9Blue")):
        mug(k, u, -4, col)
    return k.build()


def x3():
    k = Bench("bar_x3", FP)
    C = 8                                                                            # the 45 deg cut, px
    u0, u1 = U0 + C, U1 - C

    def run(z0, z1, col, grow=0.0):
        """The prow-cut plan between z0 and z1: a middle box and a 45 deg corner column at each front corner."""
        _px(k, u0, u1, V0 - grow, V1 + grow, z0, z1, col)
        _px(k, U0 - grow, U1 + grow, V0 - grow, V1 - C, z0, z1, col)
        for u in (u0, u1):
            diamond(k, u, V1 - C, z0, z1, C + grow * math.sqrt(2), col)
    _px(k, u0, u1, V0 + 2, V1 - 2, 0, 3, "x7Gun")
    run(3, 12, "x7Oxide")
    for u in range(u0 + 2, u1 - 1, 5):
        _px(k, u, u + 2, V1, V1 + 0.8, 4, 11, "x7OxideD")                            # steel ribs, lower half
    run(12, 15, "x7Gun", grow=1)                                                     # the rub strip
    run(15, TOP - 2, "x7White")
    run(TOP - 2, TOP, "x7White", grow=1.5)                                           # the top, cut to match
    _px(k, u0, u1, V1 + 1.5, V1 + 2, TOP - 2, TOP - 1.4, "x7Gun")                    # shadow line under its lip
    for u, col in ((-22, "r9Amber"), (16, "r9Ruby")):
        mug(k, u, -4, col)
    return k.build()


# ---- stools ------------------------------------------------------------------------------------------------------
def y1():
    k = Bench("stool_y1", (1, 1))
    cyl(k, 0, 0, 0, 1, 5, "x7BrassD", sides=16)
    cyl(k, 0, 0, 1, SEAT - 3, 1.5, "x7Brass", sides=8)
    cyl(k, 0, 0, SEAT - 3, SEAT - 2, 6, "x7Brass", sides=18)
    cyl(k, 0, 0, SEAT - 2, SEAT, 5.6, "x7Teal", sides=18)
    return k.build()


def y2():
    k = Bench("stool_y2", (1, 1))
    _px(k, -5, 5, -5, 5, 0, 1, "x7Black")
    _px(k, -1, 1, -1, 1, 1, SEAT - 3, "x7OliveD")
    _px(k, -4, 4, -4, 4, 5, 6, "x7OliveD")
    _px(k, -5, 5, -5, 5, SEAT - 3, SEAT - 2, "x7Black")
    _px(k, -5, 5, -5, 5, SEAT - 2, SEAT, "x7Khaki")
    return k.build()


def y3():
    k = Bench("stool_y3", (1, 1))
    cyl(k, 0, 0, 0, SEAT - 2, 5.5, "x7Gun", sides=18)
    cyl(k, 0, 0, 4, 7, 5.8, "x7Oxide", sides=18)
    cyl(k, 0, 0, SEAT - 2, SEAT, 5.8, "x7White", sides=18)
    return k.build()


COUNTERS = {"x1": x1, "x2": x2, "x3": x3}
STOOLS = {"y1": y1, "y2": y2, "y3": y3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in COUNTERS.items()]


def stool_jobs():
    return [(f"module.barstool.{v}", (1, 1), "prop", f) for v, f in STOOLS.items()]
