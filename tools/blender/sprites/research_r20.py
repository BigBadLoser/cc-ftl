"""Research companions, round 20: three dissection tables (x23-x25) with nothing carried over from the earlier tables;
each is designed as one machine form first.

  x23 lectern hull: one section swept the length: low at the front, the top sloping up to a plumb instrument wall and a
      hood over the bed; brown bookend plates at both ends wrap every layer
  x24 capsule: a long faceted pod in two saddles, its canopy slid back and stacked over the far end, the shell open on
      the bed inside
  x25 anvil: an hourglass section (a wide foot, a narrow navy waist, a flared cream top) whose far end curls up and
      over the bed in one continuous hood"""
import math

from .modkit import K
from .research_kit import Bench
from .research_r13 import BROWN, CREAM, DARK, FP2, GL, NAVY, P, Z, blk, flat
from .research_r14 import CRK, side, top
from .research_r15 import on_slope, prism
from .research_r16 import INK, STEEL

GOLD = ("resGold",) * 3
GLS = ("resGls", "resGls", "resGlsD")
LIGHT = ("resCrL", "resCr", "resCrM")


def screen_u(k, u, v0, v1, z0, z1):
    """A framed screen on a +u face at u, glyph rows on it."""
    side(k, u, v0, v1, z0, z1, "resCrD")
    side(k, u + 0.004, v0 + P(1), v1 - P(1), z0 + Z(1), z1 - Z(1), "resNvyD")
    w = v1 - v0
    for a, b, z in ((0.2, 0.5, 0.6), (0.6, 0.8, 0.6), (0.2, 0.7, 0.35)):
        side(k, u + 0.008, v0 + w * a, v0 + w * b, z0 + (z1 - z0) * z, z0 + (z1 - z0) * z + Z(0.7), GL)


def screen_v(k, u0, u1, v, z0, z1):
    """A framed screen on a +v face at v."""
    flat(k, u0, u1, v, z0, z1, "resCrD")
    flat(k, u0 + P(1), u1 - P(1), v + 0.004, z0 + Z(1), z1 - Z(1), "resNvyD")
    w = u1 - u0
    for a, b, z in ((0.15, 0.45, 0.6), (0.55, 0.85, 0.6), (0.15, 0.65, 0.35)):
        flat(k, u0 + w * a, u0 + w * b, v + 0.008, z0 + (z1 - z0) * z, z0 + (z1 - z0) * z + Z(0.7), GL)


# ---- x23: lectern hull ----------------------------------------------------------------------------------------------

HULL = [(P(-14), Z(10)), (P(14), Z(10)), (P(14), Z(14)), (P(12), Z(16)), (P(-5), Z(21)), (P(-8), Z(22)),
        (P(-8), Z(34)), (P(-1), Z(36)), (P(-1), Z(39)), (P(-10), Z(42)), (P(-14), Z(42))]


def x23(layer):
    k = Bench(f"research_x23_{layer}", FP2)
    blk(k, P(-29), P(29), P(-13), P(13), 0, Z(3), DARK)
    blk(k, P(-29), P(29), P(-13), P(13), Z(3), Z(10), NAVY)                                # the lower body,
    for u in range(-26, 26, 9):
        flat(k, P(u), P(u + 7), P(13), Z(5), Z(8), "resNvyL")
    prism(k, "u", P(-29), P(29), HULL, CREAM, "resCrL")                                    # the hull
    for u0, u1 in ((P(-32), P(-29)), (P(29), P(32))):                                      # the bookends
        prism(k, "u", u0, u1, [(P(-15), 0), (P(15), 0)] + [(v + (P(1) if v > 0 else -P(1)), z + Z(1))
                                                           for v, z in HULL[1:-1]] + [(P(-15), Z(43))], BROWN,
              "resBrnL")
    # the bed on the slope: a dark tray, a grey ribbed pad
    A, B = (P(12), Z(16)), (P(-5), Z(21))
    on_slope(k, P(-26), P(26), A, B, 0.06, 0.94, "resNvyD")
    on_slope(k, P(-24), P(24), A, B, 0.2, 0.8, "resGls", off=0.008)
    for u in range(-23, 24, 3):
        on_slope(k, P(u), P(u + 1), A, B, 0.2, 0.8, "resGlsL", off=0.012)
    flat(k, P(-29), P(29), P(14), Z(12), Z(13), CRK)                                       # a seam on the front lip
    # the wall: three screens; the hood's lit underside over the bed
    for u0 in (P(-24), P(-7), P(10)):
        screen_v(k, u0, u0 + P(14), P(-8), Z(24), Z(32))
    blk(k, P(-27), P(27), P(-6), P(-2), Z(36) - 0.008, Z(36) - 0.002, GOLD)
    flat(k, P(-29), P(29), P(-1), Z(37), Z(38), CRK)
    for u in (P(-20), P(-16), P(-12)):
        flat(k, u, u + P(2), P(-1), Z(38.3), Z(39), GL)
    side(k, P(32), P(-10), P(10), Z(4), Z(5), "resBrnD")
    return k.build()


def x23_holo():
    k = K("research_x23_holo", FP2, 0)
    k.box(0.0, P(3), Z(20), 1.4, 0.012, Z(12), "resGoldF")
    return k


# ---- x24: capsule ---------------------------------------------------------------------------------------------------

ZC, R, ZS = Z(24), P(14), 0.75                              # the pod's axis height, radius, vertical squash


def arc(k, u0, u1, ri, ro, a0, a1, n, ramp):
    for i in range(n):
        a, b = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        pts = [(ri * math.cos(a), ZC + ZS * ri * math.sin(a)), (ro * math.cos(a), ZC + ZS * ro * math.sin(a)),
               (ro * math.cos(b), ZC + ZS * ro * math.sin(b)), (ri * math.cos(b), ZC + ZS * ri * math.sin(b))]
        prism(k, "u", u0, u1, pts, ramp)


def disc(k, u0, u1, r, ramp, n=8):
    prism(k, "u", u0, u1, [(r * math.cos(a), ZC + ZS * r * math.sin(a))
                           for a in (math.pi / n + i * math.tau / n for i in range(n))], ramp)


def x24(layer):
    k = Bench(f"research_x24_{layer}", FP2)
    # the saddles and the spine between them
    blk(k, P(-22), P(20), P(-4), P(4), 0, Z(8), NAVY)
    for u in (P(-21), P(17)):
        prism(k, "u", u - P(5), u + P(5), [(P(-14), 0), (P(14), 0), (P(14), Z(4)), (P(9), Z(12)), (P(-9), Z(12)),
                                           (P(-14), Z(4))], BROWN, "resBrnL")
    # the shell: the lower facets, open above; the ends closed by octagonal caps
    lo = math.pi + math.pi / 16
    arc(k, P(-28), P(28), R - P(2), R, lo, math.tau - math.pi / 16, 8, CREAM)
    disc(k, P(28), P(31), R + P(1), LIGHT)
    disc(k, P(-31), P(-28), R + P(1), LIGHT)
    arc(k, P(-4), P(-1), R, R + P(0.6), lo, math.tau - math.pi / 16, 8, NAVY)              # a navy band round it
    blk(k, P(-27), P(27), P(-9), P(9), ZC - Z(7), ZC - Z(5), INK)                          # the bed inside,
    blk(k, P(-25), P(25), P(-7), P(7), ZC - Z(5), ZC - Z(4), GLS)
    for u in range(-24, 25, 3):
        top(k, P(u), P(u + 1), P(-7), P(7), ZC - Z(4), "resGlsL")
    # the canopy slid back over the far end: the upper facets, a glass strip in them
    arc(k, P(-27), P(-9), R + P(0.2), R + P(2), math.pi / 8, math.pi - math.pi / 8, 6, CREAM)
    arc(k.part("glass"), P(-24), P(-12), R + P(2), R + P(2.3), math.pi * 0.3, math.pi * 0.7, 3, ("glassL",) * 3)
    for u in (P(-27), P(-9) - P(1)):
        arc(k, u, u + P(1), R + P(2), R + P(2.4), math.pi / 8, math.pi - math.pi / 8, 6, ("resCrK",) * 3)
    # the near cap: a screen; the band's lights
    screen_u(k, P(31), P(-7), P(7), ZC - Z(5), ZC + Z(4))
    for a in (math.pi * 1.25, math.pi * 1.5, math.pi * 1.75):
        k.box(P(-2.5), (R + P(0.7)) * math.cos(a), ZC + ZS * (R + P(0.7)) * math.sin(a) - 0.01, P(1.5), P(1.5),
              0.02, "resGold")
    return k.build()


def x24_holo():
    k = K("research_x24_holo", FP2, 0)
    k.box(P(10), 0.0, ZC - Z(6), 0.012, P(12), Z(14), "resGoldF")
    return k


# ---- x25: anvil -----------------------------------------------------------------------------------------------------

def x25(layer):
    k = Bench(f"research_x25_{layer}", FP2)
    U0, U1 = P(-31), P(31)
    prism(k, "u", U0, U1, [(P(-15), 0), (P(15), 0), (P(15), Z(3)), (P(10), Z(7)), (P(-10), Z(7)), (P(-15), Z(3))],
          BROWN, "resBrnL")                                                                # the foot,
    blk(k, U0 + P(1), U1 - P(1), P(-8), P(8), Z(7), Z(13), NAVY)                           # the waist,
    for u in range(-26, 28, 6):
        flat(k, P(u), P(u + 4), P(8), Z(8), Z(12), "resNvyL")
    prism(k, "u", U0, U1, [(P(-8), Z(13)), (P(8), Z(13)), (P(16), Z(19)), (P(16), Z(23)), (P(-16), Z(23)),
                           (P(-16), Z(19))], CREAM, "resCrL")                              # the flared top
    flat(k, U0, U1, P(16), Z(21), Z(22), CRK)
    # the bed: a dark tray let into the top, a grey pad
    blk(k, P(-14), P(29), P(-11), P(11), Z(23), Z(23) + 0.004, ("resNvyD",) * 3)
    blk(k, P(-12), P(27), P(-8), P(8), Z(23), Z(24), GLS)
    for u in range(-11, 27, 3):
        top(k, P(u), P(u + 1), P(-8), P(8), Z(24), "resGlsL")
    # the far end curling up and over the bed: one section swept across the width
    curl = [(P(-31), Z(23)), (P(-18), Z(23)), (P(-18), Z(34)), (P(-12), Z(37)), (P(2), Z(37)), (P(2), Z(41)),
            (P(-6), Z(46)), (P(-24), Z(46)), (P(-31), Z(40))]
    prism(k, "v", P(-14), P(14), curl, CREAM, "resCrL")
    screen_v(k, P(-30), P(-19), P(14), Z(26), Z(36))
    flat(k, P(-31), P(2), P(14), Z(42), Z(43), CRK)
    for u in (P(-4), P(-8), P(-12)):
        flat(k, u, u + P(2), P(14), Z(39), Z(39.7), GL)
    blk(k, P(-16), P(1), P(-10), P(10), Z(37) - 0.008, Z(37) - 0.002, GOLD)                # its lit underside
    screen_u(k, U1, P(-6), P(6), Z(15), Z(21))
    return k.build()


def x25_holo():
    k = K("research_x25_holo", FP2, 0)
    k.box(P(-7), 0.0, Z(24), 0.012, P(16), Z(12), "resGoldF")
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x23", "x24", "x25")}
