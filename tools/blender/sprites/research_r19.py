"""Research companions, round 19: our own dissection table (x20-x22) in the construction learned from x17: a plinth 1 px
past a 10 px navy body, a 6 px deck overhanging it 4 px each side, 8 px rims round the bed, terminals set into slots
in the front rim, one feature growing out of the deck at the far end or the back so the bed stays in view.

  x20 gantry: a portal straddling the bed on tracks along both rims, sloped outside, plumb inside, a scanner bar under
      its beam
  x21 tool tower: a tower on the far end's back half, a short boom with a three-prong tool head over an open tray, a
      rack of instruments standing in a notch in the back rim
  x22 lid: a framed glass lid hinged along the back rim, tilted open over the bed"""
import math

from .modkit import K
from .research_kit import Bench
from .research_r13 import BROWN, CREAM, CREAM_HI, DARK, FP2, GL, NAVY, P, Z, blk, flat
from .research_r14 import CRK, dial, side, top
from .research_r15 import prism
from .research_r16 import INK, STEEL, bar
from .research_r18 import bconsole

ZT, ZD = Z(17), Z(23)                                       # the deck's underside and top
GLS = ("resGls", "resGls", "resGlsD")


def body(k):
    blk(k, P(-31), P(31), P(-12), P(12), 0, Z(1), DARK)
    blk(k, P(-32), P(32), P(-13), P(13), Z(1), Z(7), BROWN)
    flat(k, P(-32), P(32), P(13), Z(1), Z(2), "resBrnD")
    prism(k, "u", P(-31), P(31), [(P(-12), Z(7)), (P(12), Z(7)), (P(12), Z(16)), (P(11), ZT), (P(-12), ZT)],
          NAVY, "resNvyL")
    for u in range(-28, 28, 10):
        flat(k, P(u), P(u + 8), P(12), Z(9), Z(15), "resNvyL")
        flat(k, P(u), P(u + 8), P(12) + 0.002, Z(9), Z(10), "resNvyD")


def deck(k, bed=(P(-24), P(32)), slots=(), notch=None, ticks=True, floor=GLS):
    """The deck: an inner lip and the front rim broken by slots, the back rim (a notch u0..u1 x depth in it), solid
    ends outside the bed, the bed sunk 2 px."""
    b0, b1 = bed
    blk(k, P(-32), P(32), P(8), P(10), ZT, ZD, CREAM)
    edges = [P(-32)] + [x for s in slots for x in s] + [P(32)]
    for u0, u1 in zip(edges[::2], edges[1::2]):
        if u1 > u0:
            blk(k, u0, u1, P(10), P(16), ZT, ZD, CREAM)
            flat(k, u0, u1, P(16), ZD - Z(1), ZD, "resCrL")
    if notch:
        n0, n1, d = notch
        blk(k, P(-32), n0, P(-16), P(-8), ZT, ZD, CREAM)
        blk(k, n0, n1, P(-16) + d, P(-8), ZT, ZD, CREAM)
        blk(k, n1, P(32), P(-16), P(-8), ZT, ZD, CREAM)
    else:
        blk(k, P(-32), P(32), P(-16), P(-8), ZT, ZD, CREAM)
    for u0, u1 in ((P(-32), b0), (b1, P(32))):
        if u1 > u0:
            blk(k, u0, u1, P(-8), P(8), ZT, ZD, CREAM)
    blk(k, b0, b1, P(-8), P(8), ZT, Z(21), floor)
    if ticks:
        gaps = list(slots) + ([notch[:2]] if notch else [])
        for u in range(-30, 30, 4):
            if all(not (g0 - P(2) <= P(u) < g1) for g0, g1 in gaps):
                blk(k, P(u), P(u + 2), P(12), P(14.5), ZD, ZD + Z(1), CREAM_HI)
                blk(k, P(u), P(u + 2), P(-14), P(-11.5), ZD, ZD + Z(1), CREAM_HI)


def ribs(k, u0, u1):
    for u in range(round(u0 / P(1)) + 1, round(u1 / P(1)), 3):
        top(k, P(u), P(u + 1), P(-8), P(8), Z(21), "resGlsL")
    top(k, u0, u1, P(-8), P(-7), Z(21) + 0.004, "resGlsD")


def terminals(k, us):
    for i, (u0, u1) in enumerate(us):
        g = ((0.3, 0.45, 0.1, 0.5 + 0.1 * (i % 3)), (0.55, 0.7, 0.1 + 0.15 * (i % 2), 0.8))
        bconsole(k, u0, u1, g, vb=P(10), vf=P(16), zb=ZD, za=Z(19))


def end_screen(k):
    e = P(31) + 0.004
    side(k, P(31), P(-8), P(8), Z(9), Z(16), "resCrD")
    side(k, e, P(-7), P(7), Z(10), Z(15), "resNvyD")
    for v0, v1, z in ((P(-5), P(-1), Z(12.5)), (P(1), P(5), Z(12.5)), (P(-5), P(3), Z(11))):
        side(k, e + 0.004, v0, v1, z, z + Z(0.7), GL)


# ---- x20: gantry ----------------------------------------------------------------------------------------------------

def x20(layer):
    k = Bench(f"research_x20_{layer}", FP2)
    body(k)
    slots = ((P(4), P(12)), (P(13), P(21)))
    deck(k, bed=(P(-22), P(32)), slots=slots, ticks=False)
    ribs(k, P(-22), P(32))
    for v in (P(-13), P(12)):
        top(k, P(-30), P(31), v, v + P(1), ZD, "resNvyD")                                  # the tracks
    terminals(k, slots)
    dial(k, P(-5), P(12.5), ZD)
    # the gantry: legs in the rims, sloped outside, plumb inside, a beam across
    arch = [(P(-16), ZD), (P(-9), ZD), (P(-9), Z(35)), (P(9), Z(35)), (P(9), ZD), (P(16), ZD), (P(13), Z(40)),
            (P(-13), Z(40))]
    prism(k, "u", P(-14), P(-6), arch, CREAM, "resCrL")
    flat(k, P(-14), P(-6), P(16) - P(3) * (Z(2) / Z(17)), Z(25), Z(26), CRK)
    side(k, P(-6), P(-12), P(12), Z(37), Z(38), CRK)
    side(k, P(-6), P(-4), P(4), Z(38.5), Z(39.2), GL)
    blk(k, P(-13), P(-7), P(-9), P(9), Z(32), Z(35), STEEL)                                # the scanner bar,
    top(k, P(-12), P(-8), P(-8), P(8), Z(32) - 0.006, "resGold")                           # its emitter
    for v0 in (P(-16), P(14)):
        blk(k, P(-15), P(-5), v0, v0 + P(2), ZD - Z(1), ZD + Z(1), STEEL)                  # its shoes on the tracks
    # the far end: a solid block with a vent and a lamp
    for v in (P(-4), P(0), P(4)):
        top(k, P(-30), P(-24), v, v + P(2), ZD, CRK)
    end_screen(k)
    return k.build()


def x20_holo():
    k = K("research_x20_holo", FP2, 0)
    k.box(P(-10), 0.0, Z(21), 0.012, P(16), Z(11), "resGoldF")
    return k


# ---- x21: tool tower ------------------------------------------------------------------------------------------------

def x21(layer):
    k = Bench(f"research_x21_{layer}", FP2)
    body(k)
    slots = ((P(6), P(14)), (P(15), P(23)))
    deck(k, bed=(P(-18), P(32)), slots=slots, notch=(P(-12), P(14), P(4)), floor=INK)
    blk(k, P(-15), P(29), P(-5), P(5), Z(21), Z(22), GLS)                                     # the specimen pad
    for u in range(-16, 31, 4):
        top(k, P(u), P(u + 2), P(6), P(7), Z(21), "resGold")                               # a drain grille
    terminals(k, slots)
    dial(k, P(-3), P(12.5), ZD)
    # the instrument rack, standing in the back rim's notch
    for i, u in enumerate(range(-11, 13, 3)):
        h = (8, 5, 10, 6, 9, 4, 7, 11)[i % 8]
        blk(k, P(u), P(u + 1), P(-15), P(-14), ZD - Z(1), ZD + Z(h), STEEL)
        blk(k, P(u), P(u + 1), P(-15), P(-14), ZD + Z(h), ZD + Z(h + 1), ("resGold",) * 3 if i % 3 == 0 else STEEL)
    blk(k, P(-12), P(14), P(-13), P(-12), ZD - Z(1), ZD + Z(3), ("resCrM", "resCrD", "resCrD"))   # the rack's rail
    # the tower on the far end's back half, its top sloping toward the bed, a boom and the tool head
    prism(k, "u", P(-32), P(-19), [(P(-16), ZD), (P(0), ZD), (P(0), Z(36)), (P(-4), Z(42)), (P(-16), Z(42))],
          CREAM, "resCrL")
    flat(k, P(-31), P(-20), P(0), Z(26), Z(27), CRK)
    flat(k, P(-29), P(-22), P(0) + 0.002, Z(29), Z(34), "resNvyD")
    for z in (Z(30.5), Z(32)):
        flat(k, P(-28), P(-24), P(0) + 0.006, z, z + Z(0.7), GL)
    side(k, P(-19), P(-14), P(-2), Z(38), Z(39), CRK)
    blk(k, P(-19), P(-2), P(-8), P(-2), Z(36), Z(39), CREAM)                              # the boom,
    blk(k, P(-6), P(0), P(-9), P(-1), Z(32), Z(36), STEEL)                                # the head,
    for dv, h in ((P(-7), 5), (P(-5), 7), (P(-3), 4)):
        blk(k, P(-3.5), P(-2.5), dv, dv + P(1), Z(32 - h), Z(32), STEEL)                  # its three tools
    top(k, P(-4), P(-2), P(-6), P(-4), Z(25) - 0.006, "resGold")
    end_screen(k)
    return k.build()


def x21_holo():
    k = K("research_x21_holo", FP2, 0)
    k.box(P(-3), P(-5), Z(22), 0.08, 0.08, 0.006, "resGoldF")
    return k


# ---- x22: lid -------------------------------------------------------------------------------------------------------

TH = math.radians(68)                                       # the lid's lift
LID = P(17)


def lid_pt(d):
    """The point d along the lid from its hinge (v -8, ZD) at the lift TH, back and up: (v, z)."""
    return (P(-8) - d * math.cos(TH), ZD + d * math.sin(TH))


def x22(layer):
    k = Bench(f"research_x22_{layer}", FP2)
    body(k)
    slots = ((P(-20), P(-12)), (P(-11), P(-3)), (P(18), P(26)))
    deck(k, bed=(P(-26), P(32)), slots=slots, ticks=False)
    ribs(k, P(-26), P(32))
    terminals(k, slots)
    dial(k, P(8), P(12.5), ZD)
    # the hinges along the back rim
    for u in (P(-22), P(0), P(22)):
        blk(k, u - P(2), u + P(2), P(-11), P(-7), ZD, ZD + Z(2), STEEL)
    # the lid: a cream frame round a glass pane, tilted back over the back rim
    A, B = lid_pt(0.0), lid_pt(LID)
    u0, u1 = P(-25), P(30)
    bar(k, u0, u0 + P(3), A, B, P(2), CREAM, axis="u")                                    # its sides,
    bar(k, u1 - P(3), u1, A, B, P(2), CREAM, axis="u")
    bar(k, u0, u1, lid_pt(LID - P(1.5)), B, P(2), CREAM, axis="u")                        # its top rail,
    bar(k, u0, u1, A, lid_pt(P(1.5)), P(2), CREAM, axis="u")                              # its hinge rail
    a, b = lid_pt(P(1.5)), lid_pt(LID - P(1.5))
    bar(k.part("glass"), u0 + P(3), u1 - P(3), a, b, P(0.6), ("glassL",) * 3, axis="u")   # the pane,
    for cu in (P(-8), P(6)):
        bar(k, cu, cu + P(1.5), lid_pt(P(4)), lid_pt(P(10)), P(0.9), ("resCrL",) * 3, axis="u")   # streaks on it
    blk(k, P(-6), P(6), P(-16), P(-13), ZD, ZD + Z(6), CREAM)                              # the stay holding it
    # the far end block's vents
    for v in (P(-4), P(0), P(4)):
        top(k, P(-31), P(-27), v, v + P(2), ZD, CRK)
    end_screen(k)
    return k.build()


def x22_holo():
    k = K("research_x22_holo", FP2, 0)
    k.box(P(3), 0.0, Z(21), 0.5, 0.012, Z(6), "resGoldF")
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x20", "x21", "x22")}
