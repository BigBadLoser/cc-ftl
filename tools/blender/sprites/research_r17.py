"""Research companions, round 17: three more dissection tables (x14-x16), shape study, each showing how it works.

  x14 rail ring: x11's ring made legible: an arch whose feet ride two rails down the base, end stops, a cable chain
      trailing its carriage, emitters on its inner face; the bed a thin contoured tray on a spine
  x15 surgical arm: x13's manipulator over a real surgical table: three hinged sections (legs angled down, head up) on
      a telescoping column
  x16 rotisserie: a cradle tilted on an axle between two end stands with big hubs, turned toward the viewer"""
import math

from .modkit import K
from .research_kit import Bench
from .research_r13 import BROWN, CREAM, CREAM_HI, DARK, FP2, GL, NAVY, P, Z, blk, flat
from .research_r14 import CRK, side, top
from .research_r15 import prism
from .research_r16 import INK, STEEL, bar, ring

GOLD = ("resGold",) * 3


# ---- x14: rail ring -------------------------------------------------------------------------------------------------

ZC14 = Z(16)
RI, RO = P(11), P(13.5)


def x14(layer):
    k = Bench(f"research_x14_{layer}", FP2)
    prism(k, "u", P(-31), P(31), [(P(-15), 0), (P(15), 0), (P(15), Z(3)), (P(14), Z(5)), (P(-14), Z(5)),
                                  (P(-15), Z(3))], BROWN)
    # the rails, with stops at their ends
    for v0 in (P(-13), P(10)):
        blk(k, P(-30), P(30), v0, v0 + P(3), Z(5), Z(7), STEEL)
        top(k, P(-29), P(29), v0 + P(1), v0 + P(2), Z(7), "steelD")
        for u0 in (P(-31), P(28)):
            blk(k, u0, u0 + P(3), v0 - P(0.5), v0 + P(3.5), Z(5), Z(9), ("resGold", "resGold", "resBrnD"))
    # the spine and the bed: a thin contoured tray, lips at its sides, a head rest
    blk(k, P(-24), P(24), P(-5), P(5), Z(5), Z(13), NAVY)
    for u in range(-20, 24, 8):
        flat(k, P(u), P(u + 1), P(5), Z(6), Z(12), "resNvyD")
    blk(k, P(-28), P(28), P(-8), P(8), Z(13), Z(15), CREAM)
    for v0 in (P(-8), P(6.5)):
        blk(k, P(-27), P(27), v0, v0 + P(1.5), Z(15), Z(17), CREAM_HI)
    blk(k, P(-26), P(26), P(-6.5), P(6.5), Z(15), Z(15.5), INK)
    blk(k, P(-27), P(-21), P(-5), P(5), Z(15), Z(18), CREAM_HI)
    # the arch on its carriage: shoes on the rails, legs, the half ring, emitters pointing in
    ua, ub = P(4), P(12)
    for v0, sv in ((P(-13), -1), (P(10), 1)):
        blk(k, ua - P(2), ub + P(2), v0 - P(0.5), v0 + P(3.5), Z(7), Z(10), NAVY)              # a shoe,
        lv0, lv1 = (-RO, -RI) if sv < 0 else (RI, RO)
        blk(k, ua, ub, lv0, lv1, Z(10), ZC14, CREAM)                                             # a leg
    ring(k, ua, ub, ZC14, RI, RO, CREAM, n=16, a0=0.0, a1=math.pi)
    ring(k, ub, ub + 0.004, ZC14, RI + P(1), RI + P(1.6), GOLD, n=16, a0=0.0, a1=math.pi)
    for a in (math.pi * 0.25, math.pi * 0.5, math.pi * 0.75):
        v, z = (RI - P(1)) * math.cos(a), ZC14 + (RI - P(1)) * math.sin(a)
        k.box((ua + ub) / 2, v, z - Z(1.5), P(4), P(2.5), Z(3), "steel")
        k.box((ua + ub) / 2, v - P(0.5) * math.cos(a), z - Z(1.5) - Z(1) * math.sin(a), P(2), P(1.5), Z(1.5),
              "resGold")
    # the cable chain: anchored on the base, along it, looping up and back to the carriage
    for u in range(-12, -26, -3):
        blk(k, P(u - 2), P(u), P(-16), P(-14), Z(5), Z(7), DARK)
    blk(k, P(-29), P(-27), P(-16), P(-14), Z(5), Z(10), DARK)
    for u in range(-26, 2, 3):
        blk(k, P(u), P(u + 2), P(-16), P(-14), Z(8), Z(10), DARK)
    return k.build()


def x14_holo():
    k = K("research_x14_holo", FP2, 0)
    k.box(P(8), 0.0, Z(15), 0.012, P(14), Z(10), "resGoldF")
    return k


# ---- x15: surgical arm ----------------------------------------------------------------------------------------------

def x15(layer):
    k = Bench(f"research_x15_{layer}", FP2)
    # the foot and the telescoping column
    prism(k, "u", P(-24), P(10), [(P(-12), 0), (P(12), 0), (P(12), Z(2)), (P(9), Z(4)), (P(-9), Z(4)),
                                  (P(-12), Z(2))], BROWN)
    blk(k, P(-14), P(0), P(-6), P(6), Z(4), Z(11), NAVY)
    flat(k, P(-13), P(-1), P(6), Z(9), Z(10), "resNvyL")
    blk(k, P(-12), P(-2), P(-4), P(4), Z(11), Z(15), STEEL)
    blk(k, P(-20), P(6), P(-5), P(5), Z(15), Z(16), DARK)                                    # the frame under the bed
    # the bed in three hinged sections, thin, pads inset, a side rail along each
    def section(A, B):
        bar(k, P(-10), P(10), A, B, Z(3), CREAM)
        bar(k, P(-6), P(6), (A[0], A[1] + Z(1.6)), (B[0], B[1] + Z(1.6)), Z(1), INK)
        bar(k, P(10), P(10.6), (A[0], A[1] - Z(0.5)), (B[0], B[1] - Z(0.5)), Z(1), STEEL)
    section((P(-30), Z(12)), (P(-18), Z(16.5)))                                              # legs, angled down
    section((P(-16), Z(17.5)), (P(4), Z(17.5)))                                              # torso
    section((P(6), Z(18)), (P(16), Z(23)))                                                   # head, raised
    for u, z in ((P(-17), Z(17)), (P(5), Z(17.5))):
        blk(k, u - P(1), u + P(1), P(-9), P(9), z - Z(1), z + Z(1), STEEL)                   # the hinges
    # the turret and the manipulator (as x13), reaching back over the torso
    blk(k, P(17), P(31), P(-8), P(8), 0, Z(3), BROWN)
    k.cyl(P(24), 0.0, Z(3), 0.2, Z(8), "resNvy", top="resNvyL", sides=24)
    blk(k, P(19), P(29), P(-5), P(5), Z(11), Z(20), CREAM)
    flat(k, P(20), P(28), P(5), Z(14), Z(15), "resGold")
    flat(k, P(20), P(28), P(5), Z(17), Z(18), GL)
    bar(k, P(-2.5), P(2.5), (P(24), Z(18)), (P(20), Z(42)), P(6), CREAM)
    blk(k, P(16), P(23), P(-4), P(4), Z(39), Z(45), STEEL)
    bar(k, P(-2), P(2), (P(17), Z(42)), (P(-4), Z(34)), P(5), CREAM)
    blk(k, P(-7), P(-1), P(-3), P(3), Z(30), Z(35), STEEL)
    for dv in (P(-1.5), P(1.5)):
        blk(k, P(-4.5), P(-3.5), dv - P(0.5), dv + P(0.5), Z(26), Z(30), STEEL)
    return k.build()


def x15_holo():
    k = K("research_x15_holo", FP2, 0)
    k.box(P(-4), 0.0, Z(21), 0.1, 0.1, 0.006, "resGoldF")
    return k


# ---- x16: rotisserie ------------------------------------------------------------------------------------------------

ZC16 = Z(22)
TH = -0.22                                                                                   # the cradle's tilt


def rrect(k, u0, u1, v0, v1, z0, z1, ramp, th=TH, zc=ZC16):
    """A rect in the (v, z) plane about the axle (v 0, zc), turned by th, swept u0..u1."""
    c, s = math.cos(th), math.sin(th)
    pts = [(v * c - z * s, zc + v * s + z * c) for v, z in ((v0, z0), (v1, z0), (v1, z1), (v0, z1))]
    prism(k, "u", u0, u1, pts, ramp)


def x16(layer):
    k = Bench(f"research_x16_{layer}", FP2)
    blk(k, P(-31), P(31), P(-10), P(10), 0, Z(4), BROWN)
    blk(k, P(-24), P(24), P(-4), P(4), Z(4), Z(8), NAVY)                                    # the stretcher
    flat(k, P(-23), P(23), P(4), Z(6), Z(7), "resNvyD")
    # the stands: tapering towers, the hubs on their inner faces
    for u0, u1, inner in ((P(-31), P(-23), P(-23)), (P(23), P(31), P(23))):
        prism(k, "u", u0, u1, [(P(-14), 0), (P(14), 0), (P(9), Z(30)), (P(-9), Z(30))], CREAM, "resCrL")
        blk(k, u0, u1, P(-14), P(14), 0, Z(4), BROWN)
        sgn = 1 if inner > 0 else -1
        a, b = (inner - P(2), inner) if sgn > 0 else (inner, inner + P(2))
        ring(k, a, b, ZC16, P(1), P(8), NAVY, n=24)                                          # the hub,
        ring(k, a - 0.004 * sgn, b + 0.004 * sgn, ZC16, P(6), P(6.6), GOLD, n=24)
        blk(k, min(a, b) - P(1), max(a, b) + P(1), P(-1.5), P(1.5), ZC16 - Z(1.5), ZC16 + Z(1.5), STEEL)
    ring(k, P(31), P(32), ZC16, P(1), P(7), NAVY, n=24)                                     # the drive disc outside,
    ring(k, P(32), P(32) + 0.004, ZC16, P(5), P(5.6), GOLD, n=24)
    blk(k, P(31), P(33), P(-1.5), P(1.5), ZC16 - Z(1.5), ZC16 + Z(1.5), STEEL)
    # the axle and the cradle on it: ribs from the axle to a tray with lips, a pad in it
    blk(k, P(-22), P(22), P(-1), P(1), ZC16 - Z(1), ZC16 + Z(1), STEEL)
    for u in (P(-16), P(0), P(16)):
        rrect(k, u - P(1), u + P(1), P(-1), P(1), 0.0, Z(4), STEEL)
    rrect(k, P(-21), P(21), P(-8), P(8), Z(4), Z(6), CREAM)
    for v0 in (P(-8), P(6.5)):
        rrect(k, P(-21), P(21), v0, v0 + P(1.5), Z(6), Z(9), CREAM_HI)
    rrect(k, P(-20), P(20), P(-6.5), P(6.5), Z(6), Z(6.6), INK)
    for u0 in (P(-23), P(19)):
        rrect(k, u0, u0 + P(4), P(-8), P(8), Z(4), Z(10), CREAM)                         # the tray's end plates
    return k.build()


def x16_holo():
    k = K("research_x16_holo", FP2, 0)
    k.box(0.0, P(-2), ZC16 + Z(8), 0.6, 0.012, 0.012, "resGold")
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x14", "x15", "x16")}
