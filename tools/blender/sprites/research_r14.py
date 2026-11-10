"""Research companions, round 14: x8 and y8 again (x9, y9), empty, with a clean silhouette and the detail moved onto
the faces. Round 13 broke every edge into blocks (notched rails, stations standing up, stepped tops, ridges, a stack),
so the outline read as lumpy; the reference keeps one long low mass and one big feature, and its interest is surface
work inside that outline: dashes inlaid in a smooth rim, screens set into the front face, a dial, seams on the body.

  x9  dissection table: a plinth, a navy body and one continuous cream deck with a glass bed sunk in it; one L-shaped
      scanner arm off the left end reaching over the bed
  y9  sample analyzer: the same deck at the right with a turntable sunk under glass, one plain housing block at the
      left with the chamber window set into its front, one pipette arm off it over the turntable"""
import math

from .modkit import K
from .research_kit import Bench
from .research_r13 import CREAM, CREAM_HI, DARK, FP2, GL, INK, NAVY, BROWN, P, Z, blk, flat, glass

CRK = "resCrK"


def top(k, u0, u1, v0, v1, z, col):
    """A flush inlay on a top face at z."""
    blk(k, u0, u1, v0, v1, z, z + 0.004, (col,) * 3)


def side(k, u, v0, v1, z0, z1, col):
    """A flush patch on a +u face at u."""
    blk(k, u, u + 0.004, v0, v1, z0, z1, (col,) * 3)


def screen(k, u0, u1, v, z0, z1, rows=((1, 3, 3), (4, 5, 3), (1, 2, 2), (3, 6, 2))):
    """A screen set into a +v face: a 1 px dark-cream frame, a dark pane, gold glyph rows (px from its corner)."""
    flat(k, u0, u1, v, z0, z1, "resCrD")
    flat(k, u0 + P(1), u1 - P(1), v + 0.004, z0 + Z(1), z1 - Z(1), "resNvyD")
    w = round((u1 - u0) / P(1))
    for a, b, z in rows:
        flat(k, u0 + P(a + 1), u0 + P(min(b + 1, w - 1)), v + 0.008, z0 + Z(z), z0 + Z(z + 1) - 0.002, GL)


def base(k):
    """The plinth and the navy body, plain masses; seams on the body are flush lines, not panels."""
    blk(k, P(-29), P(29), P(-14), P(14), 0, Z(1), DARK)
    blk(k, P(-30), P(30), P(-15), P(15), Z(1), Z(5), BROWN)
    blk(k, P(-28), P(28), P(-13), P(13), Z(5), Z(12), NAVY)
    for u in range(-18, 28, 10):
        flat(k, P(u), P(u + 1), P(13), Z(6), Z(11), "resNvyD")                       # seams down the front,
    flat(k, P(-28), P(28), P(13), Z(10), Z(10) + Z(1) - 0.002, "resNvyL")             # a light line under the deck,
    side(k, P(28), P(-13), P(13), Z(10), Z(10) + Z(1) - 0.002, "resNvy")
    side(k, P(28), P(-1), P(0), Z(6), Z(11), "resNvyD")                                # and a seam on the end
    flat(k, P(-30), P(30), P(15), Z(4), Z(4) + Z(1) - 0.002, "resBrnL")              # the plinth's edge catching light


def deck(k, u0, u1, bu0, bu1, bv0=P(-9), bv1=P(8)):
    """One continuous cream deck from u0 to u1, Z12-18, with a well bu0..bu1 x bv0..bv1 sunk in it, its floor at Z14.
    The rim is built as four blocks of one height so the outline stays a single box."""
    zt, zr = Z(12), Z(18)
    blk(k, u0, u1, P(-15), bv0, zt, zr, CREAM)                                         # back rim
    blk(k, u0, u1, bv1, P(14), zt, zr, CREAM)                                          # front rim
    blk(k, u0, bu0, bv0, bv1, zt, zr, CREAM)                                           # ends
    blk(k, bu1, u1, bv0, bv1, zt, zr, CREAM)
    blk(k, bu0, bu1, bv0, bv1, zt, Z(14), INK)                                         # the well's floor
    top(k, bu0, bu1, bv1 - P(1), bv1, Z(14), "resGold")                                # a gold seam at its front
    for u in range(round(u0 / P(1)) + 3, round(u1 / P(1)) - 3, 6):                     # dashes inlaid in the back rim
        top(k, P(u), P(u + 3), P(-13), P(-12), zr, CRK)
    top(k, u0 + P(1), u1 - P(1), P(12), P(13), zr, "resCrM")                           # a groove along the front rim
    flat(k, u0, u1, P(14), Z(17), Z(17) + Z(1) - 0.002, "resCrL")                      # its lit top edge


def dial(k, u, v, z):
    """A flush dial inlaid in a top face."""
    k.cyl(u, v, z, 0.07, 0.004, "resCrD", sides=16)
    k.cyl(u, v, z + 0.004, 0.05, 0.004, "resNvyD", sides=16)
    k.box(u + 0.015, v, z + 0.008, 0.04, 0.012, 0.003, GL, rz=0.5)


# ---- x9: dissection table -------------------------------------------------------------------------------------------

def x9(layer):
    k = Bench(f"research_x9_{layer}", FP2)
    base(k)
    deck(k, P(-30), P(30), P(-18), P(25))
    glass(k, P(-18), P(25), P(-9), P(8), Z(17))
    screen(k, P(-6), P(4), P(14), Z(12), Z(17))                                        # screens set into the front rim
    screen(k, P(8), P(18), P(14), Z(12), Z(17), rows=((1, 2, 3), (3, 7, 3), (1, 5, 2)))
    dial(k, P(27.5), P(0), Z(18))                                                      # a dial in the foot end
    top(k, P(26), P(29), P(-6), P(-5), Z(18), CRK)
    top(k, P(26), P(29), P(5), P(6), Z(18), CRK)
    # the scanner arm: one L, a column off the left end and a beam over the bed, its detail flush
    blk(k, P(-29), P(-20), P(-14), P(-4), Z(18), Z(34), CREAM)
    blk(k, P(-29), P(4), P(-8), P(-1), Z(34), Z(38), CREAM)
    blk(k, P(-2), P(4), P(-8), P(-1), Z(31), Z(34), CREAM)                             # its head,
    top(k, P(-1), P(3), P(-7), P(-2), Z(31) - 0.006, "resGold")                        # the emitter under it
    flat(k, P(-28), P(-21), P(-4), Z(30), Z(31), CRK)                                  # seams on the column,
    flat(k, P(-28), P(-21), P(-4), Z(20), Z(21), CRK)
    screen(k, P(-27), P(-22), P(-4), Z(23), Z(29), rows=((1, 2, 4), (1, 3, 2)))       # a small readout,
    flat(k, P(-29), P(4), P(-1), Z(36), Z(36) + Z(1) - 0.002, CRK)                     # a seam along the beam,
    for u in (P(-14), P(-8)):
        flat(k, u, u + P(2), P(-1), Z(34) + Z(1), Z(34) + Z(2), GL)                    # status lights
    top(k, P(-28), P(3), P(-5), P(-4), Z(38), "resCrL")                                # a lit ridge on its top
    return k.build()


def x9_holo():
    k = K("research_x9_holo", FP2, 0)
    k.box(P(1), P(-0.5), Z(17), 0.012, P(16), Z(14), "resGoldF")                       # the scan plane, faint
    k.box(P(1), P(-0.5), Z(17), 0.03, P(16), 0.012, "resGold")
    return k


# ---- y9: sample analyzer --------------------------------------------------------------------------------------------

def y9(layer):
    k = Bench(f"research_y9_{layer}", FP2)
    base(k)
    deck(k, P(-8), P(30), P(-2), P(24))
    tu = P(11)
    k.cyl(tu, 0.0, Z(14), 0.3, 0.006, "resCrD", sides=28)                              # the turntable, flat in the well
    k.cyl(tu, 0.0, Z(14) + 0.006, 0.26, 0.004, "resCrM", sides=28)
    k.cyl(tu, 0.0, Z(14) + 0.01, 0.06, 0.004, CRK, sides=12)
    for i in range(10):
        a = i * math.tau / 10
        k.cyl(tu + 0.2 * math.cos(a), 0.2 * math.sin(a), Z(14) + 0.01, 0.03, 0.004, "resNvyD", sides=8)
    glass(k, P(-2), P(24), P(-9), P(8), Z(17))
    screen(k, P(2), P(20), P(14), Z(12), Z(17), rows=((1, 4, 3), (6, 7, 3), (9, 14, 3), (1, 2, 2), (4, 10, 2)))
    # the housing: one plain block, the chamber window and its detail set into its faces
    blk(k, P(-30), P(-8), P(-15), P(14), Z(12), Z(36), CREAM)
    flat(k, P(-27), P(-11), P(14), Z(15), Z(30), "resCrD")                              # the window's frame,
    flat(k, P(-26), P(-12), P(14) + 0.004, Z(16), Z(29), "resNvyD")                          # the dark chamber,
    k.part("glass").box(P(-19), P(14) + 0.01, Z(16), P(14), 0.004, Z(13), "glassL")
    for u in (P(-24), P(-22)):
        k.box(u, P(14) + 0.014, Z(17), 0.02, 0.003, Z(10), "resCrL", ry=0.4)            # streaks on it
    for z in (Z(17), Z(27)):
        flat(k, P(-25), P(-13), P(14) + 0.008, z, z + Z(1) - 0.002, "resGold")          # the chamber's lights
    flat(k, P(-30), P(-8), P(14), Z(32), Z(33), CRK)                                    # a seam near the top,
    for u in range(-27, -11, 3):
        flat(k, P(u), P(u + 2), P(14), Z(33) + Z(1), Z(35), CRK)                        # vent slits above it,
    flat(k, P(-30), P(-8), P(14), Z(35), Z(36), "resCrL")                               # its lit top edge
    side(k, P(-8), P(-12), P(10), Z(32), Z(33), CRK)                                    # the seam round the end,
    for v in (P(-10), P(-6), P(-2)):
        side(k, P(-8), v, v + P(2), Z(20), Z(28), CRK)                                  # vents on it
    top(k, P(-28), P(-10), P(-13), P(-12), Z(36), CRK)                                  # panel lines on its top
    top(k, P(-28), P(-10), P(11), P(12), Z(36), CRK)
    dial(k, P(-19), P(-1), Z(36))
    # the pipette arm off the housing over the turntable: one clean bar and a drop
    blk(k, P(-8), P(14), P(-3), P(2), Z(28), Z(31), CREAM)
    blk(k, P(8), P(14), P(-3), P(2), Z(22), Z(28), CREAM)
    blk(k, P(10), P(12), P(-2), P(1), Z(19), Z(22), ("steelL", "steel", "steelD"))
    top(k, P(10), P(12), P(-2), P(1), Z(19) - 0.006, "resGold")
    flat(k, P(-8), P(14), P(2), Z(29), Z(30), CRK)                                      # a seam along it
    return k.build()


def y9_holo():
    k = K("research_y9_holo", FP2, 0)
    for z, r in ((Z(20), 0.18), (Z(23), 0.12)):
        for i in range(16):
            a = i * math.tau / 16
            k.box(P(11) + r * math.cos(a), r * math.sin(a), z, 0.03, 0.012, 0.012, "resGold", rz=a + math.pi / 2)
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x9", "y9")}
