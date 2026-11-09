"""Research companions, round 18: three dissection tables (x17-x19), each one machine. The brown is no longer a floor the
parts stand on: it is the machine's bottom layer, on its own outline, with the navy body and the cream over it, and
every part grows out of that body.

  x17 the reference, as close as we can: chamfered plinth, a bulging navy body, a cream deck with a long glass bed,
      ticks along the back rim, two sloped consoles and a dial block on the front edge, a chunky slanted arm off the
      near end reaching over the bed to a head
  x18 scanner hood: a hull whose cream shell rises at the near end into a hood over the bed's head, a tunnel open to
      the front that the bed slides into
  x19 tower: the body runs the length and rises at the far end into a tower; a jointed arm grows out of the tower's
      face and folds down over a tray"""
import math

from .modkit import K
from .research_kit import Bench
from .research_r13 import BROWN, CREAM, CREAM_HI, DARK, FP2, GL, NAVY, P, Z, blk, flat, glass
from .research_r14 import CRK, deck, dial, screen, side, top
from .research_r15 import console, on_slope, prism
from .research_r16 import INK, STEEL, bar, ring

GOLD = ("resGold",) * 3


def _mirror(k):
    """Turn k end for end (u -> -u), keeping the long side toward the camera; faces keep their outward winding."""
    p0, poly0 = k.p, k.m.poly
    k.p = lambda u, v: p0(-u, v)
    k.m.poly = lambda pts, color, flip=False: poly0(pts[::-1], color, flip)
    return k


class FlipBench(Bench):
    def __init__(self, name, fp=FP2):
        super().__init__(name, fp)
        _mirror(self)

    def part(self, name):
        if name not in self.parts:
            self.parts[name] = _mirror(K(f"{self.name}_{name}", self.fp, 0))
        return self.parts[name]


def ticks(k, u0, u1, v, z, step=6):
    for u in range(round(u0 / P(1)), round(u1 / P(1)) - 2, step):
        top(k, P(u), P(u + 3), v, v + P(1), z, CRK)


# ---- x17: the reference ---------------------------------------------------------------------------------------------

def bconsole(k, u0, u1, glyphs, vb=P(11), vf=P(15), z0=Z(8), z1=Z(14), z2=Z(20)):
    """The reference's console: a brown housing hung off the body's front, its top sloping toward the viewer, a dark
    framed screen on the slope with glyph rows."""
    A, B = (vf, z1), (vb + P(1), z2)
    prism(k, "u", u0, u1, [(vb, z0), (vf, z0), A, B, (vb, z2)], BROWN, "resBrnL")
    on_slope(k, u0 + P(1), u1 - P(1), A, B, 0.1, 0.9, "resBrnD")
    on_slope(k, u0 + P(1.5), u1 - P(1.5), A, B, 0.18, 0.82, "resNvyD", off=0.008)
    w = u1 - u0
    for t0, t1, a0, a1 in glyphs:
        on_slope(k, u0 + P(2) + (w - P(4)) * a0, u0 + P(2) + (w - P(4)) * a1, A, B, t0, t1, GL, off=0.012)
    flat(k, u0 + P(1), u1 - P(1), vf, z0 + Z(1), z0 + Z(2), "resBrnD")


def x17(layer, flip=False):
    """Measured off the reference (r90, its near corner column): plinth 7 px, navy body 10, deck front 6 (cream over a
    2 px brown band), the deck top at 24; the plinth 64 x 26 px, the body 1 px in from it all round."""
    k = (FlipBench if flip else Bench)(f"research_x17{'r' if flip else ''}_{layer}", FP2)
    blk(k, P(-31), P(31), P(-12), P(12), 0, Z(1), DARK)
    blk(k, P(-32), P(32), P(-13), P(13), Z(1), Z(7), BROWN)
    flat(k, P(-32), P(32), P(13), Z(1), Z(2), "resBrnD")
    prism(k, "u", P(-31), P(31), [(P(-12), Z(7)), (P(12), Z(7)), (P(12), Z(16)), (P(11), Z(17)), (P(-12), Z(17))],
          NAVY, "resNvyL")
    for u0, u1 in ((P(-28), P(-20)), (P(-18), P(-10)), (P(-8), P(0)), (P(2), P(10)), (P(12), P(20)), (P(22), P(29))):
        flat(k, u0, u1, P(12), Z(9), Z(15), "resNvyL")                                     # rounded panels,
        flat(k, u0, u1, P(12) + 0.002, Z(9), Z(10), "resNvyD")                            # shaded at their feet
    # the deck: rims round a channel that runs out to the near end; a ribbed grey floor, darker under the arm
    zt, zd = Z(17), Z(23)
    for v0, v1 in ((P(-13), P(-8)), (P(8), P(13))):
        blk(k, P(-32), P(32), v0, v1, zt, zd, CREAM)
    blk(k, P(20), P(32), P(-8), P(8), zt, zd, CREAM)
    flat(k, P(-32), P(32), P(13), zt, zt + Z(2), "resBrn")                                 # the brown band under it,
    side(k, P(32), P(-13), P(13), zt, zt + Z(2), "resBrnD")
    blk(k, P(-32) - 0.004, P(-32), P(-13), P(13), zt, zt + Z(2), ("resBrnD",) * 3)         # (both ends)
    blk(k, P(-32), P(20), P(-8), P(8), zt, Z(21), ("resGls", "resGls", "resGlsD"))
    for u in range(-31, 8, 3):
        top(k, P(u), P(u + 1), P(-8), P(8), Z(21), "resGlsL")                              # ribs across it,
    top(k, P(9), P(20), P(-8), P(8), Z(21), "resGlsD")                                     # the scanner's patch
    top(k, P(-32), P(20), P(-8), P(-7), Z(21) + 0.004, "resGlsD")
    for cu, w in ((P(-14), 0.035), (P(-9), 0.015)):
        k.box(cu, 0.0, Z(22.5), w, P(15), 0.004, "resGlsL", rz=0.55)                         # the glass's streaks
    for v0 in (P(-12), P(9.5)):                                                             # ticks on the rims
        for u in range(-30, 30, 4):
            blk(k, P(u), P(u + 2), v0, v0 + P(2.5), zd, zd + Z(1), CREAM_HI)
    flat(k, P(-32), P(32), P(13), zd - Z(1), zd, "resCrL")                                 # the rim's lit edge
    # the arm, rising off the back half of the deck's far end over the channel to a head
    arm = [(P(31), zd), (P(31), Z(32)), (P(28), Z(35)), (P(-1), Z(35)), (P(-1), Z(31)), (P(19), Z(31)),
           (P(24), zd)]                                                                     # an inverted L, a gap under it
    prism(k, "v", P(-9), P(1), arm, CREAM, "resCrL")
    flat(k, P(0), P(29), P(1), Z(33), Z(34), CRK)                                          # a seam along it
    blk(k, P(-1), P(6), P(-8), P(0), Z(28), Z(31), STEEL)                                  # the head,
    flat(k, P(0), P(5), P(0), Z(28.5), Z(30), "resGold")                                   # its light to the front,
    top(k, P(0), P(5), P(-7), P(-1), Z(28) - 0.006, "resGold")                             # its emitter
    # the console side: from the arm end, one console, the dial block, a pair of consoles
    def hang(u0, u1, glyphs):
        bconsole(k, u0, u1, glyphs, vb=P(12), vf=P(16), z0=Z(9), z1=Z(17), z2=Z(22))
    hang(P(10), P(19), ((0.3, 0.45, 0.1, 0.5), (0.55, 0.7, 0.1, 0.8)))
    blk(k, P(2), P(8), P(12), P(16), Z(9), Z(22), CREAM)
    dial(k, P(5), P(14), Z(22))
    flat(k, P(3), P(7), P(16), Z(11), Z(12), CRK)
    hang(P(-8), P(0), ((0.3, 0.45, 0.1, 0.6), (0.55, 0.7, 0.3, 0.9)))
    hang(P(-17), P(-9), ((0.3, 0.45, 0.4, 0.9), (0.55, 0.7, 0.1, 0.6)))
    # the screen in the far end (in view once turned): a cream frame on the body's end, a dark pane, glyphs
    e = P(-31) - 0.004
    blk(k, e, P(-31), P(-8), P(8), Z(9), Z(16), ("resCrD",) * 3)
    blk(k, e - 0.004, e, P(-7), P(7), Z(10), Z(15), ("resNvyD",) * 3)
    for v0, v1, z in ((P(-5), P(-1), Z(12.5)), (P(1), P(5), Z(12.5)), (P(-5), P(3), Z(11))):
        blk(k, e - 0.008, e - 0.004, v0, v1, z, z + Z(0.7), (GL,) * 3)
    return k.build()


def x17_holo(flip=False):
    k = K(f"research_x17{'r' if flip else ''}_holo", FP2, 0)
    if flip:
        _mirror(k)
    k.box(P(2.5), P(-4), Z(21), 0.06, 0.06, Z(7), "resGoldF")
    return k


# ---- x18: scanner hood ----------------------------------------------------------------------------------------------

def x18(layer, flip=False):
    k = (FlipBench if flip else Bench)(f"research_x18{'r' if flip else ''}_{layer}", FP2)
    # the hull's lower layers: a skirt sloping in, the navy body ribbed
    prism(k, "u", P(-31), P(31), [(P(-13), 0), (P(13), 0), (P(15), Z(5)), (P(-15), Z(5))], BROWN, "resBrnL")
    blk(k, P(-29), P(29), P(-13), P(13), Z(5), Z(12), NAVY)
    for u in range(-26, 28, 4):
        flat(k, P(u), P(u + 2), P(13), Z(6), Z(11), "resNvyL")
    # the shell: a low foot end, rims along the bed, the hood rising at the near end
    prism(k, "v", P(-14), P(14), [(P(-30), Z(12)), (P(-22), Z(12)), (P(-22), Z(17)), (P(-30), Z(19))], CREAM,
          "resCrL")
    for v0 in (P(-14), P(9)):
        blk(k, P(-22), P(10), v0, v0 + P(5), Z(12), Z(17), CREAM)
    top(k, P(-21), P(9), P(13), P(14), Z(17), "resCrL")
    blk(k, P(-22), P(10), P(-9), P(9), Z(12), Z(13), INK)
    blk(k, P(-22), P(16), P(-7), P(7), Z(13), Z(15), CREAM_HI)                             # the bed, sliding in
    blk(k, P(-21), P(15), P(-5), P(5), Z(15), Z(15.5), INK)
    hood = [(P(10), Z(12)), (P(31), Z(12)), (P(31), Z(31)), (P(26), Z(37)), (P(-8), Z(37)), (P(-11), Z(33)),
            (P(-11), Z(29)), (P(10), Z(29))]
    prism(k, "v", P(-14), P(14), hood, CREAM, "resCrL")
    blk(k, P(-11), P(10), P(-14), P(-11), Z(17), Z(29), ("resNvy", "resNvyD", "resNvyD"))   # the tunnel's back wall,
    blk(k, P(-10), P(10), P(-11), P(11), Z(29) - 0.006, Z(29), ("resNvyD",) * 3)          # the hood's dark underside,
    blk(k, P(-10), P(9), P(-1), P(1), Z(29) - 0.012, Z(29) - 0.006, GOLD)                 # its emitter strip,
    flat(k, P(-10), P(9), P(-11), Z(26), Z(27), "resGold")                                 # a light along the wall
    # detail on the hood
    flat(k, P(-11), P(26), P(14), Z(33), Z(34), CRK)
    screen(k, P(16), P(28), P(14), Z(16), Z(27), rows=((1, 4, 7), (6, 9, 7), (1, 7, 5), (1, 3, 3), (5, 9, 3)))
    side(k, P(31), P(-10), P(10), Z(20), Z(21), CRK)
    for v in (P(-8), P(-4), P(0), P(4)):
        side(k, P(31), v, v + P(2), Z(23), Z(29), CRK)
    for u in (P(-6), P(2), P(10), P(18)):
        top(k, u, u + P(4), P(-10), P(-9), Z(37), CRK)
    return k.build()


def x18_holo(flip=False):
    k = K(f"research_x18{'r' if flip else ''}_holo", FP2, 0)
    if flip:
        _mirror(k)
    k.box(P(3), 0.0, Z(16), 0.012, P(12), Z(12), "resGoldF")
    return k


# ---- x19: tower -----------------------------------------------------------------------------------------------------

def x19(layer):
    k = Bench(f"research_x19_{layer}", FP2)
    blk(k, P(-30), P(30), P(-14), P(14), 0, Z(1), DARK)
    blk(k, P(-31), P(31), P(-15), P(15), Z(1), Z(5), BROWN)
    flat(k, P(-31), P(31), P(15), Z(4), Z(4) + Z(1) - 0.002, "resBrnL")
    # the body: low under the tray, rising into the tower at the far end
    blk(k, P(-17), P(29), P(-13), P(13), Z(5), Z(12), NAVY)
    prism(k, "u", P(-30), P(-16), [(P(-14), Z(5)), (P(14), Z(5)), (P(14), Z(22)), (P(11), Z(25)), (P(-14), Z(25))],
          NAVY, "resNvyL")
    for z in (Z(9), Z(15)):
        flat(k, P(-30), P(-16), P(14), z, z + Z(1), "resNvyD")
    # the tray deck along the body
    deck(k, P(-16), P(30), P(-12), P(26))
    for u in (P(-8), P(4), P(16)):
        for v in (P(-9), P(7)):
            blk(k, u, u + P(2), v, v + P(2), Z(14), Z(16), STEEL)                            # clamps in the tray
    console(k, P(4), P(16), vb=P(8), vf=P(16), z0=Z(8), z1=Z(15), z2=Z(20))
    # the tower's cream cap, sloped at its front, a screen in it
    prism(k, "u", P(-31), P(-15), [(P(-15), Z(25)), (P(15), Z(25)), (P(15), Z(29)), (P(9), Z(38)), (P(-15), Z(38))],
          CREAM, "resCrL")
    flat(k, P(-29), P(-17), P(15), Z(26), Z(27), CRK)
    side(k, P(-15), P(-12), P(10), Z(27), Z(28), CRK)
    # the arm: a hub on the tower's face, an upper arm up and out, an elbow, a forearm down to a gripper over the tray
    ring(k, P(-15), P(-13), Z(31), P(1), P(5), STEEL, n=20)
    ring(k, P(-13), P(-13) + 0.004, Z(31), P(3), P(3.6), GOLD, n=20)
    bar(k, P(-3), P(3), (P(-14), Z(31)), (P(0), Z(44)), P(6), CREAM)
    blk(k, P(-3), P(3), P(-4), P(4), Z(41), Z(47), STEEL)
    bar(k, P(-2.5), P(2.5), (P(0), Z(44)), (P(12), Z(27)), P(5), CREAM)
    blk(k, P(9), P(15), P(-3), P(3), Z(23), Z(28), STEEL)
    for dv in (P(-1.5), P(1.5)):
        blk(k, P(11.5), P(12.5), dv - P(0.5), dv + P(0.5), Z(19), Z(23), STEEL)
    flat(k, P(-12), P(-6), P(3), Z(34), Z(35), GL)
    return k.build()


def x19_holo():
    k = K("research_x19_holo", FP2, 0)
    k.box(P(12), 0.0, Z(16), 0.1, 0.1, 0.006, "resGoldF")
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x17", "x18", "x19")}
BUILD.update({"x17r": (lambda layer: x17(layer, True), lambda: x17_holo(True), FP2),      # end for end
              "x18r": (lambda layer: x18(layer, True), lambda: x18_holo(True), FP2)})
