"""Research companions, round 16: three dissection tables (x11-x13), each its own machine assembly. No shared base or arm;
the round is about shape, detail is light.

  x11 scanner ring: a bed cantilevered off a tapered pedestal, running through a standing ring set in a cradle
  x12 trough: a flared hull with the bed sunk in it between a tall head tower and a lower foot tower; a portal frame
      straddling the bed on rails along its rims, a head hanging from its beam
  x13 lift rig: a sled with two piston lifts holding a tilted bed; a turret at the open end carrying a jointed
      manipulator (shoulder, raised upper arm, elbow, forearm reaching back over the bed, a gripper)"""
import math

from .modkit import K
from .research_kit import Bench
from .research_r13 import BROWN, CREAM, CREAM_HI, DARK, FP2, GL, NAVY, P, Z, blk, flat, glass
from .research_r14 import CRK, side, top
from .research_r15 import prism

STEEL = ("steelL", "steel", "steelD")
INK = ("resNvyD",) * 3


def bar(k, a0, a1, A, B, t, ramp, axis="v"):
    """A straight bar of thickness t from A to B in the (u, z) plane (axis 'v') or the (v, z) plane (axis 'u'), swept
    a0..a1."""
    d0, d1 = B[0] - A[0], B[1] - A[1]
    L = math.hypot(d0, d1)
    n0, n1 = -d1 / L * t / 2, d0 / L * t / 2
    prism(k, axis, a0, a1, [(A[0] - n0, A[1] - n1), (B[0] - n0, B[1] - n1), (B[0] + n0, B[1] + n1),
                            (A[0] + n0, A[1] + n1)], ramp)


def ring(k, u0, u1, zc, ri, ro, ramp, n=28, a0=0.0, a1=math.tau):
    """A ring standing across v (in the (v, z) plane), swept u0..u1, built from n segments."""
    for i in range(n):
        a, b = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        pts = [(ri * math.cos(a), zc + ri * math.sin(a)), (ro * math.cos(a), zc + ro * math.sin(a)),
               (ro * math.cos(b), zc + ro * math.sin(b)), (ri * math.cos(b), zc + ri * math.sin(b))]
        prism(k, "u", u0, u1, pts, ramp)


# ---- x11: scanner ring ----------------------------------------------------------------------------------------------

ZC11 = Z(4) + 0.49


def x11(layer):
    k = Bench(f"research_x11_{layer}", FP2)
    # the foot plate, chamfered
    prism(k, "u", P(-30), P(30), [(P(-14), 0), (P(14), 0), (P(14), Z(2)), (P(12), Z(4)), (P(-12), Z(4)),
                                  (P(-14), Z(2))], BROWN)
    # the pedestal: tapering up to a collar under the bed
    prism(k, "u", P(-22), P(-6), [(P(-9), Z(4)), (P(9), Z(4)), (P(6), Z(12)), (P(4), Z(19)), (P(-4), Z(19)),
                                  (P(-6), Z(12))], NAVY, "resNvyL")
    flat(k, P(-20), P(-8), P(7.5), Z(6), Z(7), "resNvyD")
    blk(k, P(-23), P(-5), P(-5), P(5), Z(19), Z(22), STEEL)
    # the bed: chamfered under its edges, cantilevered through the ring to the far end
    prism(k, "u", P(-30), P(30), [(P(-10), Z(22)), (P(10), Z(22)), (P(12), Z(24)), (P(12), Z(28)), (P(-12), Z(28)),
                                  (P(-12), Z(24))], CREAM, "resCrL")
    blk(k, P(-24), P(28), P(-8), P(8), Z(28), Z(29), INK)                                  # its pad,
    blk(k, P(-29), P(-22), P(-7), P(7), Z(28), Z(31), CREAM_HI)                           # a head rest,
    flat(k, P(-28), P(28), P(12), Z(25), Z(26), CRK)                                       # a seam along it
    # the ring in its cradle
    prism(k, "u", P(8), P(22), [(P(-13), 0), (P(13), 0), (P(10), Z(9)), (P(-10), Z(9))], NAVY, "resNvyL")
    ring(k, P(10), P(20), ZC11, 0.42, 0.5, CREAM)
    ring(k, P(20), P(20) + 0.004, ZC11, 0.445, 0.465, ("resGold",) * 3)                    # a lit band on its face
    ring(k, P(9), P(21), ZC11, 0.40, 0.42, INK)                                            # its dark lining
    flat(k, P(10), P(20), P(10), Z(3), Z(4), "resGold")
    return k.build()


def x11_holo():
    k = K("research_x11_holo", FP2, 0)
    k.box(P(15), 0.0, ZC11 - 0.05, 0.012, 0.5, 0.36, "resGoldF")
    return k


# ---- x12: trough ----------------------------------------------------------------------------------------------------

def x12(layer):
    k = Bench(f"research_x12_{layer}", FP2)
    # the hull: a dark kick, then flaring out to the rims
    prism(k, "u", P(-22), P(22), [(P(-9), 0), (P(9), 0), (P(9), Z(3)), (P(15), Z(13)), (P(-15), Z(13)),
                                  (P(-9), Z(3))], NAVY, "resNvyL")
    blk(k, P(-22), P(22), P(-15), P(-10), Z(13), Z(17), CREAM)                              # the rims,
    blk(k, P(-22), P(22), P(10), P(15), Z(13), Z(17), CREAM)
    blk(k, P(-22), P(22), P(-10), P(10), Z(13), Z(14), INK)                                # the trough's floor
    glass(k, P(-22), P(22), P(-10), P(10), Z(16))
    for v in (P(-13), P(12)):
        top(k, P(-21), P(21), v, v + P(1), Z(17), CRK)                                     # the portal's rails
    # the towers: the head tall, the foot lower, both sloping toward the bed
    prism(k, "v", P(-16), P(16), [(P(-32), Z(6)), (P(-22), Z(6)), (P(-22), Z(24)), (P(-26), Z(32)), (P(-32), Z(32))],
          CREAM, "resCrL")
    blk(k, P(-32), P(-22), P(-16), P(16), 0, Z(6), BROWN)
    flat(k, P(-31), P(-23), P(16), Z(10), Z(22), "resNvyD")                                # a dark panel,
    for z in (Z(13), Z(16), Z(19)):
        flat(k, P(-29), P(-25), P(16) + 0.004, z, z + Z(1), GL)
    prism(k, "v", P(-16), P(16), [(P(22), Z(6)), (P(32), Z(6)), (P(32), Z(22)), (P(26), Z(22)), (P(22), Z(18))],
          CREAM, "resCrL")
    blk(k, P(22), P(32), P(-16), P(16), 0, Z(6), BROWN)
    side(k, P(32), P(-10), P(10), Z(10), Z(18), "resNvyD")
    # the portal: two posts on the rails, a beam across, a head hanging from it
    for v0 in (P(-15), P(11)):
        blk(k, P(2), P(8), v0, v0 + P(4), Z(17), Z(34), CREAM)
    blk(k, P(1), P(9), P(-16), P(16), Z(34), Z(38), CREAM)
    flat(k, P(1), P(9), P(16), Z(35), Z(36), CRK)
    blk(k, P(2), P(8), P(-4), P(3), Z(28), Z(34), STEEL)
    top(k, P(3), P(7), P(-3), P(2), Z(28) - 0.006, "resGold")
    return k.build()


def x12_holo():
    k = K("research_x12_holo", FP2, 0)
    k.box(P(5), P(-0.5), Z(16), 0.012, P(18), Z(12), "resGoldF")
    return k


# ---- x13: lift rig --------------------------------------------------------------------------------------------------

def x13(layer):
    k = Bench(f"research_x13_{layer}", FP2)
    # the sled: two skids, a deck between them
    for v0 in (P(-15), P(10)):
        prism(k, "v", v0, v0 + P(5), [(P(-31), Z(1)), (P(-29), 0), (P(29), 0), (P(31), Z(1)), (P(31), Z(4)),
                                      (P(-31), Z(4))], BROWN)
    blk(k, P(-28), P(28), P(-10), P(10), Z(1), Z(4), DARK)
    # the lifts: housings, pistons up to the bed's underside
    for u in (P(-20), P(6)):
        blk(k, u - P(5), u + P(5), P(-8), P(8), Z(4), Z(10), NAVY)
        flat(k, u - P(4), u + P(4), P(8), Z(6), Z(7), "resNvyD")
        for v in (-0.12, 0.12):
            k.cyl(u, v, Z(10), 0.05, Z(8), "steel", top="steelL", sides=12)
    # the bed: tilted, its head end high
    prism(k, "v", P(-13), P(13), [(P(-30), Z(19)), (P(14), Z(17)), (P(14), Z(21)), (P(-30), Z(25))], CREAM, "resCrL")
    prism(k, "v", P(-9), P(9), [(P(-26), Z(24.8)), (P(12), Z(21.1)), (P(12), Z(22.1)), (P(-26), Z(25.8))], INK)
    # the turret at the open end and the manipulator: shoulder, raised upper arm, elbow, forearm back over the bed
    k.cyl(P(24), 0.0, Z(4), 0.2, Z(8), "resNvy", top="resNvyL", sides=24)
    blk(k, P(19), P(29), P(-5), P(5), Z(12), Z(21), CREAM)                                 # the shoulder,
    flat(k, P(20), P(28), P(5), Z(15), Z(16), "resGold")
    bar(k, P(-2.5), P(2.5), (P(24), Z(19)), (P(18), Z(40)), P(6), CREAM)                   # the upper arm,
    blk(k, P(14), P(21), P(-4), P(4), Z(37), Z(43), STEEL)                                 # the elbow,
    bar(k, P(-2), P(2), (P(15), Z(40)), (P(-6), Z(34)), P(5), CREAM)                       # the forearm reaching back,
    blk(k, P(-9), P(-3), P(-3), P(3), Z(31), Z(36), STEEL)                                 # the wrist,
    for dv in (P(-1.5), P(1.5)):
        blk(k, P(-6.5), P(-5.5), dv - P(0.5), dv + P(0.5), Z(27), Z(31), STEEL)            # the gripper's fingers
    flat(k, P(20), P(28), P(5), Z(18), Z(19), GL)
    return k.build()


def x13_holo():
    k = K("research_x13_holo", FP2, 0)
    k.box(P(-6), 0.0, Z(24), 0.1, 0.1, 0.006, "resGoldF")
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x11", "x12", "x13")}
