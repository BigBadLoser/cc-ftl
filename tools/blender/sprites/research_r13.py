"""Research companions, round 13: one dissection table (x8) and one analyzer (y8), empty (a specimen comes with a
working state later), drawn the reference's way: right-angled blocks on the px grid, each coloured by the way its
faces turn (a light top, a mid front, a dark side) from a warm cream ramp, 1 px gaps between blocks showing a dark
core so every part is outlined, detail every 2-4 px, a thick brown plinth and a navy body with its own panels, framed
screen stations along the work edge, glass that reads by its streaks.

  x8  dissection table: a low bed under glass between notched rails, a chunky end block with a dial, three screen
      stations along the front rail, a scanner frame rising off the back rail and reaching over the bed
  y8  sample analyzer: a stepped housing at the left with a framed chamber door, vents and a stack; a low deck at the
      right with a turntable well under glass, a pipette arm off the housing over it, two screen stations"""
from .core import G as GV
from .modkit import K
from .research_kit import PXG, Bench, zpx

FP2 = (2, 1)
CREAM = ("resCr", "resCrM", "resCrD")           # top, front (+v), side (+u)
CREAM_HI = ("resCrL", "resCr", "resCrM")        # a raised or small part, a step lighter
NAVY = ("resNvyL", "resNvy", "resNvyD")
BROWN = ("resBrnL", "resBrn", "resBrnD")
DARK = ("resCrK", "resCrK", "resCrK")
INK = ("resNvyD", "resNvyD", "resNvyD")
GL = "resGlyph"


def P(n):
    return n * PXG


Z = zpx


def blk(k, u0, u1, v0, v1, z0, z1, ramp):
    """A block from u0..u1, v0..v1, z0..z1 (px grid units: P(n), Z(n)), its top, front (+v) and side faces in ramp."""
    top, front, side = ramp

    def q(*pts):
        return [GV(*k.p(u, v), z) for u, v, z in pts]
    m = k.m
    m.poly(q((u0, v0, z1), (u1, v0, z1), (u1, v1, z1), (u0, v1, z1)), top, flip=True)
    m.poly(q((u0, v0, z0), (u0, v1, z0), (u1, v1, z0), (u1, v0, z0)), side, flip=True)
    m.poly(q((u0, v1, z0), (u0, v1, z1), (u1, v1, z1), (u1, v1, z0)), front, flip=True)
    m.poly(q((u0, v0, z0), (u1, v0, z0), (u1, v0, z1), (u0, v0, z1)), side, flip=True)
    m.poly(q((u1, v0, z0), (u1, v1, z0), (u1, v1, z1), (u1, v0, z1)), side, flip=True)
    m.poly(q((u0, v0, z0), (u0, v0, z1), (u0, v1, z1), (u0, v1, z0)), side, flip=True)


def flat(k, u0, u1, v, z0, z1, col):
    """A flush patch on a +v face at v (screens, glyphs, slits)."""
    blk(k, u0, u1, v, v + 0.004, z0, z1, (col, col, col))


def base(k, u0=P(-30), u1=P(30), v0=P(-15), v1=P(15)):
    """The thick brown plinth, a dark kick under it, the navy body on it with panels and slits."""
    blk(k, u0 + P(1), u1 - P(1), v0 + P(1), v1 - P(1), 0, Z(1), DARK)
    blk(k, u0, u1, v0, v1, Z(1), Z(5), BROWN)
    blk(k, u0 + P(2), u1 - P(2), v0 + P(2), v1 - P(2), Z(5), Z(12), NAVY)
    u = u0 + P(4)
    while u + P(6) <= u1 - P(4):                                                      # panels a px proud, 2 px apart
        blk(k, u, u + P(6), v1 - P(2), v1 - P(1), Z(6), Z(11), NAVY)
        flat(k, u + P(2), u + P(4), v1 - P(1), Z(7), Z(8), "resNvyD")                  # a slit in each
        u += P(8)
    for v in (v0 + P(5), v0 + P(13)):                                                 # and on the side
        blk(k, u1 - P(2), u1 - P(1), v, v + P(6), Z(6), Z(11), NAVY)


def rail(k, u0, u1, v0, v1, z0, z1, step=4):
    """A rail of notched segments: blocks step-1 px long, 1 px apart, over a dark core 2 px lower."""
    blk(k, u0, u1, v0, v1, z0, z1 - Z(2), DARK)
    u = u0
    while u < u1 - 1e-6:
        blk(k, u, min(u + P(step - 1), u1), v0, v1, z0, z1, CREAM)
        u += P(step)


def station(k, u, v1, z0, w=8):
    """A screen station breaking the front rail: a block out to v1 with a framed dark screen and gold glyphs on its
    front, a lighter lip over it."""
    u0, u1 = u - P(w / 2), u + P(w / 2)
    blk(k, u0, u1, v1 - P(5), v1, z0, z0 + Z(7), CREAM)
    blk(k, u0 - P(1), u1 + P(1), v1 - P(6), v1 + P(0.0) - P(1), z0 + Z(7), z0 + Z(8), CREAM_HI)
    flat(k, u0 + P(1), u1 - P(1), v1, z0 + Z(2), z0 + Z(6), "resNvyD")
    for i, (a, b, z) in enumerate(((1.5, 3.5, 4), (4.5, 5.5, 4), (1.5, 2.5, 3), (3.5, 6.5, 3))):
        flat(k, u0 + P(a), u0 + P(min(b, w - 1.5)), v1 + 0.004, z0 + Z(z), z0 + Z(z + 1) - 0.002, GL)


def glass(k, u0, u1, v0, v1, z):
    """A glass lid at z, with two diagonal streaks of light across it."""
    k.part("glass").box((u0 + u1) / 2, (v0 + v1) / 2, z - 0.01, u1 - u0, v1 - v0, 0.01, "glassL")
    for t, w in ((0.3, 0.03), (0.42, 0.015)):
        cu = u0 + (u1 - u0) * t
        k.box(cu, (v0 + v1) / 2, z, w, (v1 - v0) * 0.9, 0.004, "resCrL", rz=0.6)


def dial(k, u, v, z):
    k.cyl(u, v, z, 0.07, Z(2), "resCrD", top="resCrM", sides=14)
    k.cyl(u, v, z + Z(2), 0.05, Z(1), "resNvyD", sides=14)
    k.box(u + 0.015, v, z + Z(3), 0.04, 0.012, 0.004, GL, rz=0.5)


# ---- x8: dissection table -------------------------------------------------------------------------------------------

def x8(layer):
    k = Bench(f"research_x8_{layer}", FP2)
    base(k)
    zt = Z(12)
    # the bed: a dark well under glass, a gold seam round its floor
    blk(k, P(-18), P(22), P(-9), P(8), zt, Z(14), INK)
    blk(k, P(-18), P(22), P(7), P(8), Z(14), Z(14) + 0.004, ("resGold",) * 3)
    glass(k, P(-18), P(22), P(-9), P(8), Z(17))
    # rails: notched at the back, plain at the front with stations breaking it
    rail(k, P(-30), P(30), P(-15), P(-9), zt, Z(18))
    blk(k, P(-30), P(30), P(8), P(13), zt, Z(16), CREAM)
    for u in (P(-12), P(4), P(18)):
        station(k, u, P(15), zt - Z(3))                                              # level with the rail
    # the end blocks: a chunky head at the left (a stepped top, a dial), a plain foot at the right
    blk(k, P(-30), P(-19), P(-9), P(8), zt, Z(20), CREAM)
    blk(k, P(-29), P(-20), P(-8), P(5), Z(20), Z(22), CREAM_HI)
    blk(k, P(-30), P(-19), P(7), P(8), Z(14), Z(18), DARK)                              # a seam down its front
    dial(k, P(-24.5), P(-1.5), Z(22))
    blk(k, P(23), P(30), P(-9), P(8), zt, Z(17), CREAM)
    for v in (P(-6), P(-2), P(2)):
        blk(k, P(24), P(29), v, v + P(2), Z(17), Z(18), CREAM_HI)                        # grip ridges on the foot
    # the scanner frame: a leg off the back rail, a beam reaching over the bed, a head with a gold emitter
    blk(k, P(5), P(13), P(-15), P(-10), Z(18), Z(30), CREAM)
    blk(k, P(6), P(12), P(-10), P(-9), Z(20), Z(28), DARK)                              # its inset front
    blk(k, P(4), P(14), P(-16), P(6), Z(30), Z(34), CREAM)
    blk(k, P(5), P(13), P(-15), P(5), Z(34), Z(35), CREAM_HI)
    for v in (P(-12), P(-7), P(-2)):
        blk(k, P(4), P(14), v, v + P(1), Z(34), Z(35), DARK)                            # notches across it
    blk(k, P(6), P(12), P(0), P(6), Z(27), Z(30), CREAM)                                # the head,
    blk(k, P(7), P(11), P(1), P(5), Z(27) - 0.006, Z(27), ("resGold",) * 3)             # its emitter
    flat(k, P(6), P(12), P(6), Z(31), Z(32), GL)
    return k.build()


def x8_holo():
    k = K("research_x8_holo", FP2, 0)
    k.box(P(9), P(-0.5), Z(17), 0.012, P(16), Z(9), "resGoldF")                          # the scan plane, faint
    k.box(P(9), P(-0.5), Z(17), 0.03, P(16), 0.012, "resGold")
    return k


# ---- y8: sample analyzer --------------------------------------------------------------------------------------------

def y8(layer):
    k = Bench(f"research_y8_{layer}", FP2)
    base(k)
    zt = Z(12)
    # the housing at the left: a lower block with the chamber door, an upper block stepped back, vents, a stack
    blk(k, P(-30), P(-8), P(-15), P(11), zt, Z(26), CREAM)
    blk(k, P(-26), P(-12), P(10), P(11), Z(14), Z(25), DARK)                             # the door's frame (a gap),
    blk(k, P(-25), P(-13), P(10.5), P(11), Z(15), Z(24), INK)                          # the chamber behind it,
    k.part("glass").box(P(-19), P(11) - 0.006, Z(15), P(12), 0.006, Z(9), "glassL")
    for u in (P(-23), P(-21)):
        k.box(u, P(11) + 0.002, Z(16), 0.02, 0.004, Z(7), "resCrL", ry=0.4)             # streaks on the door
    for z in (Z(16), Z(23)):
        flat(k, P(-24), P(-14), P(11) - 0.003, z, z + Z(1) - 0.002, "resGold")          # the chamber's lights
    blk(k, P(-30), P(-8), P(10), P(11), Z(26), Z(27), CREAM_HI)
    blk(k, P(-29), P(-10), P(-14), P(4), Z(26), Z(36), CREAM)                           # the upper block,
    for u in range(-27, -11, 3):
        blk(k, P(u), P(u + 2), P(3), P(4), Z(29), Z(34), DARK)                            # vents across its front
    blk(k, P(-28), P(-22), P(-12), P(-6), Z(36), Z(41), CREAM_HI)                        # a stack on it,
    blk(k, P(-27), P(-23), P(-11), P(-7), Z(41), Z(41) + 0.004, DARK)
    flat(k, P(-20), P(-12), P(4), Z(36) - Z(2), Z(36) - Z(1), GL)
    # the low deck at the right: rails, a turntable well under glass, two stations
    rail(k, P(-8), P(30), P(-15), P(-9), zt, Z(17))
    blk(k, P(-8), P(30), P(9), P(13), zt, Z(16), CREAM)
    blk(k, P(-8), P(-2), P(-9), P(9), zt, Z(16), CREAM)
    blk(k, P(24), P(30), P(-9), P(9), zt, Z(16), CREAM)
    blk(k, P(-2), P(24), P(-9), P(9), zt, Z(13), INK)                                  # the well's floor,
    k.cyl(P(11), 0.0, Z(13), 0.3, Z(1), "resCrD", top="resCrM", sides=28)               # the turntable,
    k.cyl(P(11), 0.0, Z(14), 0.06, Z(1), "resCrK", sides=12)
    for i in range(10):
        import math
        a = i * math.tau / 10
        k.cyl(P(11) + 0.21 * math.cos(a), 0.21 * math.sin(a), Z(14) - 0.003, 0.03, 0.006, "resNvyD", sides=8)
    glass(k, P(-2), P(24), P(-9), P(9), Z(16))
    for u in (P(4), P(19)):
        station(k, u, P(15), zt, w=7)
    # the pipette arm off the housing over the turntable
    blk(k, P(-8), P(12), P(-4), P(1), Z(30), Z(33), CREAM)
    blk(k, P(-8), P(11), P(-3), P(0), Z(33), Z(34), CREAM_HI)
    blk(k, P(9), P(13), P(-4), P(1), Z(24), Z(30), CREAM)
    blk(k, P(10), P(12), P(-3), P(0), Z(19), Z(24), ("steelL", "steel", "steelD"))
    blk(k, P(10), P(12), P(-3), P(0), Z(19) - 0.006, Z(19), ("resGold",) * 3)
    return k.build()


def y8_holo():
    k = K("research_y8_holo", FP2, 0)
    import math
    for z, r in ((Z(20), 0.18), (Z(23), 0.12)):
        for i in range(16):
            a = i * math.tau / 16
            k.box(P(11) + r * math.cos(a), r * math.sin(a), z, 0.03, 0.012, 0.012, "resGold", rz=a + math.pi / 2)
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x8", "y8")}
