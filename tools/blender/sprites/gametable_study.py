"""Holo game table look study (family `gametable`, preview only): a 2x1 leisure table for two players, seated on stools
on the tiles in front and behind (+v and -v), each stool held off the table's foot by an arm so table and seats are one
body. The arcade's family look: navy with chrome trim and cyan light. The game is a hologram over the table top, from
emitter strips in the glass top. The variants share the table and differ in the game:

  k1 strategy board: a board of lit squares hovering over the top, tall pieces in pink (front) and cyan (back), one
      lifted mid-move
  k2 tabletop battle: holo terrain (mesas and a ridge), two small fleets facing off over it, shots crossing, a burst
  k3 card game: a fan of cards standing in front of each player, the draw pile and a face-up card in the middle, chips

Units: world (1 = a tile); z in world units too (a seat top at 0.39, the table top at 0.62, as the consoles' chair)."""
import math

from .arcade_study import ring_of
from .research_kit import Bench, bar
from .research_r15 import prism

FP2 = (2, 1)
TOP = 0.62                                                           # the table top's height
SEATS = ((-0.5, 1.0), (0.5, -1.0))                                   # the stools: front left, back right (local u, v)


def stadium(k, hu, hv, z, h, col, top=None, sides=16):
    """A rounded slab: a box with half-round ends, hu x hv half sizes, the ends' radius hv."""
    k.box(0.0, 0.0, z, 2 * (hu - hv), 2 * hv, h, col, top=top)
    for s in (-1, 1):
        k.cyl(s * (hu - hv), 0.0, z, hv, h, col, top=top, sides=sides)


def stool(k, u, v, face):
    """A stool: a disc foot, a post, a padded seat with a chrome rim, a low back on the side away from the table;
    `face` = the way the sitter faces (-1: toward -v)."""
    k.cyl(u, v, 0.0, 0.14, 0.03, "arcBodyK", top="arcBodyK", sides=12)
    k.cyl(u, v, 0.03, 0.045, 0.26, "arcChrD", top="arcChr", sides=8)
    k.cyl(u, v, 0.29, 0.19, 0.04, "arcChrD", top="arcChr", sides=14)
    k.cyl(u, v, 0.33, 0.17, 0.06, "arcBodyD", top="arcBody", sides=14)
    k.box(u, v - face * 0.16, 0.36, 0.3, 0.05, 0.2, "arcBodyD", top="arcBody")              # the back
    k.box(u, v - face * 0.16, 0.56, 0.3, 0.05, 0.02, "arcCyan", top="arcCyan")             # its lit edge


def table(name, rot=0):
    """The table: a plinth, a stadium pedestal, the thick top with its chrome rim and dark glass, a lit inset border and
    the emitter strips; the two stools on arms off the plinth."""
    k = Bench(name, FP2, rot)
    stadium(k, 0.7, 0.24, 0.0, 0.04, "arcBodyK", top="arcBodyK")                         # the plinth,
    stadium(k, 0.62, 0.18, 0.04, TOP - 0.12, "arcBodyD", top="arcBody")                  # the pedestal,
    for s in (-1, 1):                                                                    # its lit seams
        k.box(s * 0.3, 0.181, 0.12, 0.02, 0.006, TOP - 0.24, "arcCyan")
    stadium(k, 0.96, 0.44, TOP - 0.1, 0.06, "arcChrD", top="arcChr")                    # the top: a chrome rim,
    stadium(k, 0.93, 0.41, TOP - 0.04, 0.04, "arcBodyD", top="arcGlass")                # the dark glass,
    for s in (-1, 1):                                                                    # a lit inset border,
        k.box(0.0, s * 0.33, TOP, 1.0, 0.014, 0.004, "arcCyan", top="arcCyan")
        k.box(s * 0.55, 0.0, TOP, 0.014, 0.66, 0.004, "arcCyan", top="arcCyan")
    for s in (-1, 1):                                                                    # the emitter strips
        k.box(s * 0.18, 0.0, TOP, 0.06, 0.5, 0.008, "arcCyan", top="arcCyan")
    for u, v in SEATS:                                                                   # the stools on their arms
        bar(k, (u * 0.7, v * 0.12, 0.03), (u, v, 0.03), 0.06, "arcChrD")
        stool(k, u, v, -1 if v > 0 else 1)
    return k.build()


def k1():
    return table("gametable_k1")


def k2():
    return table("gametable_k2")


def k3():
    return table("gametable_k3")


Z0 = TOP + 0.08                                                      # the hologram's floor


def k1_holo():
    """A board of 8x4 squares hovering over the top (film squares, lit grid lines), pink pieces on the front rows, cyan
    on the back, one pink piece lifted mid-move."""
    k = Bench("gametable_k1_holo", FP2)
    s, nu, nv = 0.17, 8, 4
    hu, hv = s * nu / 2, s * nv / 2
    for i in range(nu):
        for jj in range(nv):
            if (i + jj) % 2 == 0:
                k.box(-hu + (i + 0.5) * s, -hv + (jj + 0.5) * s, Z0, s, s, 0.004, "arcCyanF", top="arcCyanF")
    for i in range(nu + 1):
        k.box(-hu + i * s, 0.0, Z0, 0.012, 2 * hv, 0.006, "arcCyan", top="arcCyan")
    for jj in range(nv + 1):
        k.box(0.0, -hv + jj * s, Z0, 2 * hu, 0.012, 0.006, "arcCyan", top="arcCyan")
    def at(i, jj):
        return -hu + (i + 0.5) * s, -hv + (jj + 0.5) * s
    pieces = [((0, 3), 0.1), ((2, 3), 0.16), ((3, 2), 0.1), ((6, 3), 0.1), ((7, 2), 0.13)], \
             [((1, 0), 0.1), ((3, 0), 0.16), ((4, 1), 0.1), ((5, 0), 0.13), ((7, 0), 0.1)]
    for side, col in ((0, "arcPink"), (1, "arcCyan")):
        for (i, jj), h in pieces[side]:
            u, v = at(i, jj)
            k.box(u, v, Z0, 0.08, 0.08, h, col, top=col)                                 # a piece,
            k.box(u, v, Z0 + h, 0.05, 0.05, 0.04, col, top=col)                          # its head
    u, v = at(4, 2)
    k.box(u, v, Z0 + 0.2, 0.08, 0.08, 0.13, "arcPink", top="arcPink")                   # the lifted piece,
    k.box(u, v, Z0 + 0.007, 0.08, 0.08, 0.004, "arcPinkF", top="arcPinkF")               # its shadow square
    return k


def k2_holo():
    """Holo terrain (film mesas with lit rims, a ridge), an amber fleet on the left and a cyan one on the right facing
    off over it, shots crossing, a burst on one ship."""
    k = Bench("gametable_k2_holo", FP2)
    k.box(0.0, 0.0, Z0, 1.4, 0.6, 0.004, "arcGrnF", top="arcGrnF")                      # the ground,
    for u, v, su, sv, h in ((-0.3, -0.1, 0.24, 0.2, 0.14), (0.25, 0.12, 0.2, 0.16, 0.2), (0.0, -0.18, 0.5, 0.1, 0.08)):
        k.box(u, v, Z0, su, sv, h, "arcGrnF", top="arcGrnF")                            # mesas and a ridge,
        k.box(u, v, Z0 + h, su + 0.01, sv + 0.01, 0.006, "arcGrn", top="arcGrn")         # their lit rims
    for u, v, su, sv in ((0.0, -0.3, 1.4, 0.012), (0.0, 0.3, 1.4, 0.012), (-0.7, 0.0, 0.012, 0.6), (0.7, 0.0, 0.012, 0.6)):
        k.box(u, v, Z0, su, sv, 0.008, "arcGrn", top="arcGrn")                         # the map's lit edge
    zf = Z0 + 0.32
    for sgn, col in ((-1, "arcAmb"), (1, "arcCyan")):                                    # the fleets
        for du, dv in ((0.0, 0.0), (0.12, 0.16), (0.12, -0.16)):
            u, v = sgn * (0.42 + du), dv
            k.box(u, v, zf, 0.15, 0.07, 0.05, col, top=col)
            k.box(u + sgn * 0.05, v, zf, 0.05, 0.17, 0.02, col, top=col)                # their wings
    for v, col in ((0.12, "arcAmb"), (-0.05, "arcCyan")):                                # shots crossing
        bar(k, (-0.32, v, zf + 0.015), (0.32, -v * 0.5, zf + 0.015), 0.014, col)
    for rz in (0.0, 0.785, 1.571, 2.356):                                                # a burst
        k.box(0.45, 0.12, zf + 0.015, 0.14, 0.014, 0.014, "arcMarq", rz=rz)
    return k


def card(k, u, v, z, face, col, w=0.2, h=0.28, lean=0.0):
    """A card standing up, facing +v (face 1) or -v (-1): film body, a lit border, a symbol on its face."""
    rx = face * lean
    k.box(u, v, z, w, 0.004, h, "arcShellD" if face > 0 else "arcCyanF", top="arcShellD", rx=rx)
    k.box(u, v + face * 0.003, z + h - 0.012, w, 0.004, 0.012, "arcMarq", rx=rx)
    k.box(u, v + face * 0.003, z, w, 0.004, 0.012, "arcMarq", rx=rx)
    if face > 0:
        k.box(u, v + 0.005, z + h * 0.35, w * 0.4, 0.004, h * 0.3, col, rx=rx)


def k3_holo():
    """A card game: three cards fanned in front of each player (the near hand's faces to us, the far hand's backs), the
    draw pile and a face-up card floating over the middle, a stack of chips by each hand."""
    k = Bench("gametable_k3_holo", FP2)
    for i, (du, col) in enumerate(((-0.24, "arcPink"), (0.0, "arcAmb"), (0.24, "arcGrn"))):
        card(k, -0.45 + du, 0.28, Z0 + 0.06 + (0.04 if i == 1 else 0), 1, col, lean=0.25)  # the near hand,
        card(k, 0.45 + du, -0.28, Z0 + 0.06 + (0.04 if i == 1 else 0), -1, col, lean=0.25)  # the far hand (backs)
    for n in range(4):                                                                   # the draw pile,
        k.box(-0.12, 0.0, Z0 + n * 0.016, 0.2, 0.28, 0.01, "arcCyanF", top="arcCyan" if n == 3 else "arcCyanF")
    card(k, 0.14, 0.0, Z0 + 0.14, 1, "arcPink", w=0.22, h=0.3)                           # the face-up card
    ring_of(k, 0.15, Z0 + 0.08, 12, 0.07, "arcCyan", h=0.01)
    for u, v, col in ((-0.82, 0.2, "arcAmb"), (0.82, -0.2, "arcAmb")):                   # chip stacks
        for n in range(4):
            k.cyl(u, v, Z0 + n * 0.03, 0.06, 0.022, col, top=col, sides=10)
    return k


# ---- round 2: the card game, cards that read (lit cream faces, bold suit marks), three tables -------------------------

SUITS = ("arcPink", "arcCyan", "arcGrn", "arcAmb")


def card2(k, u, v, z, face, suit, w=0.2, h=0.28, lean=0.2, turn=0.0):
    """A hologram card standing on its foot edge at (u, v, z), facing +v (face 1) or -v (-1), leaning back from the
    one it faces by `lean`, turned in its own plane by `turn` (a fan). Its face: lit cream with a bold suit mark in the
    middle and a pip in each corner; its back: cyan film with a lit border and a lit diamond."""
    rx = face * lean
    if face > 0:
        k.box(u, v, z, w, 0.006, h, "arcMarq", top="arcMarq", rx=rx, ry=turn)
        k.box(u, v + 0.006, z + h * 0.3, w * 0.5, 0.006, h * 0.4, suit, top=suit, rx=rx, ry=turn)
        k.box(u - w * 0.32, v + 0.006, z + h * 0.8, w * 0.18, 0.006, h * 0.12, suit, top=suit, rx=rx, ry=turn)
    else:
        k.box(u, v, z, w, 0.006, h, "arcCyanF", top="arcCyanF", rx=rx, ry=turn)
        for dz in (0.0, h - 0.016):
            k.box(u, v - 0.004, z + dz, w, 0.006, 0.016, "arcCyan", rx=rx, ry=turn)
        k.box(u, v - 0.006, z + h * 0.35, w * 0.3, 0.006, h * 0.3, "arcCyan", rx=rx, ry=turn + 0.785)


def hand(k, cu, cv, z, face, suits, spread=0.17, fan=0.22, w=0.2, h=0.28):
    """A fanned hand of cards around (cu, cv), facing `face`."""
    n = len(suits)
    for i, suit in enumerate(suits):
        t = i - (n - 1) / 2
        card2(k, cu + t * spread, cv - face * abs(t) * 0.02, z + 0.04 - abs(t) * 0.03, face, suit, w, h, turn=-t * fan * face)


def chips(k, u, v, z, cols, r=0.055):
    for n, col in enumerate(cols):
        k.cyl(u, v, z + n * 0.03, r, 0.022, col, top=col, sides=10)


def stadium_ring(k, hu, hv, z, h, w, col, top, n=8):
    """A stadium-shaped rail w wide: straight sides and half-round ends of boxes."""
    for s in (-1, 1):
        k.box(0.0, s * (hv - w / 2), z, 2 * (hu - hv), w, h, col, top=top)
        for i in range(n):
            a = s * math.pi / 2 + (i + 0.5) * math.pi / n * (-s)
            a = -math.pi / 2 + (i + 0.5) * math.pi / n if s > 0 else math.pi / 2 + (i + 0.5) * math.pi / n
            r = hv - w / 2
            k.box(s * (hu - hv) + r * math.cos(a), r * math.sin(a), z, math.pi * r / n * 1.15, w, h, col, top=top,
                  rz=a + math.pi / 2)


def l1():
    return table("gametable_l1")


def l1_holo():
    """K's table, the card game redone: each player's hand fanned and leaning back to them (cream faces with bold suit
    marks to us, cyan backs on the far hand), the draw pile and a big face-up card turning over a lit ring in the
    middle, the pot of chips beside it."""
    k = Bench("gametable_l1_holo", FP2)
    hand(k, -0.45, 0.25, Z0, 1, ("arcPink", "arcAmb", "arcCyan"))
    hand(k, 0.45, -0.25, Z0, -1, ("arcPink", "arcAmb", "arcCyan"))
    for n in range(4):                                                                   # the draw pile,
        k.box(-0.12, 0.0, Z0 + n * 0.016, 0.2, 0.26, 0.01, "arcCyanF", top="arcCyan" if n == 3 else "arcCyanF")
    ring_of(k, 0.16, Z0 + 0.01, 14, 0.075, "arcCyan", h=0.01)                            # the lit ring,
    card2(k, 0.14, 0.0, Z0 + 0.12, 1, "arcGrn", w=0.24, h=0.32, lean=0.0, turn=0.3)      # the face-up card
    chips(k, 0.4, 0.12, Z0, ("arcAmb", "arcAmb", "arcPink", "arcAmb"))
    chips(k, -0.4, -0.12, Z0, ("arcCyan", "arcAmb", "arcAmb"))
    return k


def l2():
    """Casino table: a padded navy bumper rail round a teal felt-glass top, gold trim, a deep skirt to the floor."""
    k = Bench("gametable_l2", FP2)
    stadium(k, 0.8, 0.32, 0.0, 0.05, "arcGoldD", top="arcGold")                          # a gold kick,
    stadium(k, 0.76, 0.28, 0.05, TOP - 0.17, "arcBodyD", top="arcBody")                 # the skirt,
    stadium(k, 0.92, 0.42, TOP - 0.12, 0.04, "arcGoldD", top="arcGold")                 # gold under the rail,
    stadium(k, 0.86, 0.36, TOP - 0.08, 0.08, "arcTealD", top="arcTeal")                 # the felt,
    stadium_ring(k, 0.96, 0.46, TOP - 0.08, 0.13, 0.1, "arcBodyD", "arcBodyL")           # the bumper rail,
    for s in (-1, 1):                                                                    # its lit seam
        k.box(0.0, s * 0.462, TOP - 0.02, 1.0, 0.006, 0.012, "arcAmb")
    for s in (-1, 1):                                                                    # the dealer's mark on the felt
        k.box(s * 0.16, 0.0, TOP, 0.05, 0.3, 0.006, "arcAmb", top="arcAmb")
    for u, v in SEATS:
        bar(k, (u * 0.7, v * 0.12, 0.03), (u, v, 0.03), 0.06, "arcGoldD")
        stool(k, u, v, -1 if v > 0 else 1)
    return k.build()


def l2_holo():
    """Over the felt: big hands fanned to each player, the pile and a dealt row of three face-up cards in the middle,
    chips piled by each hand."""
    k = Bench("gametable_l2_holo", FP2)
    z = TOP + 0.06
    hand(k, -0.45, 0.24, z, 1, ("arcPink", "arcGrn", "arcAmb", "arcCyan"), spread=0.13, fan=0.18)
    hand(k, 0.45, -0.24, z, -1, ("arcPink", "arcGrn", "arcAmb", "arcCyan"), spread=0.13, fan=0.18)
    for i, suit in enumerate(("arcCyan", "arcPink", "arcAmb")):                          # the dealt row, flat-ish
        card2(k, -0.2 + i * 0.2, 0.0, z + 0.02, 1, suit, w=0.17, h=0.24, lean=0.9)
    chips(k, 0.1, 0.24, z, ("arcAmb", "arcPink", "arcAmb"))
    chips(k, -0.1, -0.24, z, ("arcCyan", "arcAmb", "arcAmb", "arcCyan"))
    return k


def l3():
    """Card dais: a slim table on one round column, a raised chrome dais in the middle of the top with a lit ring."""
    k = Bench("gametable_l3", FP2)
    k.cyl(0.0, 0.0, 0.0, 0.3, 0.04, "arcBodyK", top="arcBodyK", sides=16)               # the foot,
    k.cyl(0.0, 0.0, 0.04, 0.16, TOP - 0.14, "arcBodyD", top="arcBody", sides=16)        # the column,
    k.cyl(0.0, 0.0, 0.3, 0.17, 0.03, "arcChrD", top="arcChr", sides=16)                 # its chrome belt,
    stadium(k, 0.96, 0.4, TOP - 0.1, 0.06, "arcChrD", top="arcChr")
    stadium(k, 0.93, 0.37, TOP - 0.04, 0.04, "arcBodyD", top="arcGlass")
    k.cyl(0.0, 0.0, TOP, 0.2, 0.05, "arcChrD", top="arcChr", sides=16)                   # the dais,
    k.cyl(0.0, 0.0, TOP + 0.05, 0.16, 0.008, "arcCyan", top="arcCyan", sides=16)        # its lit ring,
    k.cyl(0.0, 0.0, TOP + 0.05, 0.12, 0.012, "arcBodyK", top="arcBodyK", sides=16)     # its lens well
    for s in (-1, 1):                                                                    # a lit pad at each place
        k.box(s * 0.55, s * -0.0, TOP, 0.3, 0.5, 0.004, "arcCyanF", top="arcCyanF")
    for u, v in SEATS:
        bar(k, (0.0, 0.0, 0.03), (u, v, 0.03), 0.06, "arcChrD")
        stool(k, u, v, -1 if v > 0 else 1)
    return k.build()


def l3_holo():
    """The dais throws a carousel of cards: a ring of cards standing round it facing out (the deck in play), one big
    card rising out of the middle; each player's hand floats over their pad."""
    k = Bench("gametable_l3_holo", FP2)
    zd = TOP + 0.07
    for i in range(8):                                                                   # the carousel
        a = i * math.tau / 8 + 0.2
        k.box(0.2 * math.cos(a), 0.2 * math.sin(a), zd + 0.04, 0.12, 0.006, 0.17,
              "arcCyanF", top="arcCyanF", rz=a + math.pi / 2)
        k.box(0.2 * math.cos(a), 0.2 * math.sin(a), zd + 0.2, 0.12, 0.006, 0.012, "arcCyan", rz=a + math.pi / 2)
    card2(k, 0.0, 0.0, zd + 0.1, 1, "arcPink", w=0.22, h=0.3, lean=0.0)                   # the card in play
    hand(k, -0.6, 0.15, TOP + 0.02, 1, ("arcAmb", "arcCyan", "arcGrn"))
    hand(k, 0.6, -0.15, TOP + 0.02, -1, ("arcAmb", "arcCyan", "arcGrn"))
    return k


# ---- round 3: three more games (the card game stays a candidate) ----------------------------------------------------

def m1_holo():
    """Disc duel (air hockey) on K's table: a lit rink with a centre line and circle, goal mouths at the ends, the
    pink and the cyan striker, the amber puck sliding with its trail."""
    k = Bench("gametable_m1_holo", FP2)
    hu, hv = 0.8, 0.34
    k.box(0.0, 0.0, Z0, 2 * hu, 2 * hv, 0.004, "arcCyanF", top="arcCyanF")              # the rink's floor,
    for sgn in (-1, 1):                                                                  # its walls, lit
        k.box(0.0, sgn * hv, Z0, 2 * hu, 0.014, 0.04, "arcCyan", top="arcCyan")
        for sv in (-1, 1):
            k.box(sgn * hu, sv * (hv + 0.12) / 2, Z0, 0.014, hv - 0.12, 0.04, "arcCyan", top="arcCyan")
        k.box(sgn * (hu + 0.03), 0.0, Z0, 0.05, 0.24, 0.012, "arcAmb", top="arcAmb")   # the goal mouths
    k.box(0.0, 0.0, Z0, 0.014, 2 * hv, 0.008, "arcCyan", top="arcCyan")                 # the centre line,
    ring_of(k, 0.12, Z0, 12, 0.065, "arcCyan", h=0.008)                                  # the centre circle
    for u, v, col in ((-0.5, 0.12, "arcPink"), (0.48, -0.1, "arcCyan")):                 # the strikers
        k.cyl(u, v, Z0, 0.075, 0.04, col, top=col, sides=12)
        k.cyl(u, v, Z0 + 0.04, 0.035, 0.05, col, top=col, sides=10)
    k.cyl(-0.12, 0.16, Z0, 0.05, 0.025, "arcAmb", top="arcAmb", sides=10)               # the puck,
    for i, (u, v) in enumerate(((0.0, 0.1), (0.1, 0.04))):                               # its trail
        k.cyl(u, v, Z0, 0.04 - i * 0.01, 0.012, "arcAmbF", top="arcAmbF", sides=8)
    return k


def m2_holo(z0=TOP + 0.08, name="gametable_m2_holo"):
    """Drop four on the dais table: an upright grid standing between the players (cyan film with a lit frame), pink
    and amber discs stacked in its columns, one pink disc dropping into a column."""
    k = Bench(name, FP2)
    nc, nr, s = 7, 5, 0.1
    w, h = nc * s, nr * s
    k.box(0.0, 0.0, z0, w, 0.01, h, "arcCyanF", top="arcCyanF")                         # the grid's film,
    for u in (-w / 2, w / 2):                                                            # its lit frame,
        k.box(u, 0.0, z0, 0.016, 0.03, h + 0.02, "arcCyan", top="arcCyan")
    k.box(0.0, 0.0, z0 - 0.016, w + 0.03, 0.03, 0.016, "arcCyan", top="arcCyan")
    for c in range(1, nc):                                                               # the column lines
        k.box(-w / 2 + c * s, 0.0, z0, 0.006, 0.014, h, "arcCyan")
    heights = (1, 3, 2, 4, 2, 1, 0)
    cols = ("arcPink", "arcAmb")
    for c, n in enumerate(heights):                                                      # the discs
        for r in range(n):
            col = cols[(c * 3 + r * 2 + (c > 3)) % 2]
            k.box(-w / 2 + (c + 0.5) * s, 0.0, z0 + (r + 0.12) * s, s * 0.76, 0.03, s * 0.76, col, top=col)
    k.box(-w / 2 + 6.5 * s, 0.0, z0 + h + 0.06, s * 0.76, 0.03, s * 0.76, "arcPink", top="arcPink")   # dropping
    return k


def m3_holo(z=TOP + 0.06, R=0.36, name="gametable_m3_holo"):
    """Creature duel on the casino table: a round arena (film disc, lit rim), a pink four-legged beast and a green
    robot squaring off, a burst between them, a health bar over each."""
    k = Bench(name, FP2)
    k.cyl(0.0, 0.0, z, R, 0.006, "arcCyanF", top="arcCyanF", sides=16)                  # the arena,
    ring_of(k, R, z, 20, R * 0.33, "arcCyan", h=0.014)
    bu = -0.17                                                                            # the beast:
    for du in (-0.06, 0.06):
        for dv in (-0.05, 0.05):
            k.box(bu + du, dv, z, 0.035, 0.035, 0.08, "arcPink", top="arcPink")          # legs,
    k.box(bu, 0.0, z + 0.08, 0.18, 0.12, 0.08, "arcPink", top="arcPink")                 # body,
    k.box(bu + 0.11, 0.0, z + 0.12, 0.08, 0.08, 0.07, "arcPink", top="arcPink")          # head
    ru = 0.17                                                                             # the robot:
    for dv in (-0.04, 0.04):
        k.box(ru, dv, z, 0.04, 0.04, 0.1, "arcGrn", top="arcGrn")                        # legs,
    k.box(ru, 0.0, z + 0.1, 0.09, 0.14, 0.11, "arcGrn", top="arcGrn")                    # body,
    k.box(ru, 0.0, z + 0.21, 0.07, 0.07, 0.06, "arcGrn", top="arcGrn")                   # head,
    k.box(ru - 0.06, 0.09, z + 0.15, 0.1, 0.03, 0.03, "arcGrn", top="arcGrn")            # a punching arm
    for rz in (0.0, 0.785, 1.571, 2.356):                                                # the burst
        k.box(0.03, 0.06, z + 0.15, 0.12, 0.014, 0.014, "arcAmb", rz=rz)
    for u, n, col in ((bu, 4, "arcPink"), (ru, 2, "arcGrn")):                            # the health bars
        for i in range(5):
            c = col if i < n else "arcCyanF"
            k.box(u - 0.08 + i * 0.04, 0.0, z + 0.36, 0.034, 0.02, 0.025, c, top=c)
    return k


# ---- round 4: three table bodies, each shown with drop four (a) and the creature duel (b) -----------------------------

def arms(k, root, col="arcChrD"):
    for u, v in SEATS:
        bar(k, root(u, v), (u, v, 0.03), 0.06, col)
        stool(k, u, v, -1 if v > 0 else 1)


def n1():
    """Ridge console: one angular body, the top rising from each player's edge in a sloped glass play deck to a
    raised central spine that carries the projector strip; chunky end caps, a dark base under it all."""
    k = Bench("gametable_n1", FP2)
    k.box(0.0, 0.0, 0.0, 1.5, 0.5, 0.04, "arcBodyK", top="arcBodyK")                    # the kick,
    k.box(0.0, 0.0, 0.04, 1.4, 0.42, TOP - 0.16, "arcBodyD", top="arcBody")             # the base,
    prof = [(-0.46, TOP - 0.12), (0.46, TOP - 0.12), (0.46, TOP - 0.04), (0.1, TOP + 0.06), (-0.1, TOP + 0.06),
            (-0.46, TOP - 0.04)]
    prism(k, "u", -0.82, 0.82, prof, ("arcBody", "arcBodyD", "arcBodyL"), slope="arcGlass")   # the decks and spine,
    for s in (-1, 1):
        k.box(s * 0.89, 0.0, 0.0, 0.14, 0.94, TOP + 0.1, "arcBodyD", top="arcBodyL")    # the end caps,
        k.box(s * 0.89, 0.0, TOP + 0.1, 0.15, 0.95, 0.02, "arcChrD", top="arcChr")
        k.box(s * 0.89, 0.472, 0.1, 0.06, 0.006, TOP - 0.1, "arcCyan")                   # their lit seams
    k.box(0.0, 0.0, TOP + 0.06, 1.5, 0.12, 0.012, "arcCyan", top="arcCyan")              # the projector strip,
    for s in (-1, 1):                                                                     # a lit edge on each deck
        k.box(0.0, s * 0.455, TOP - 0.05, 1.6, 0.014, 0.014, "arcCyan")
    arms(k, lambda u, v: (u * 0.6, v * 0.18, 0.03))
    return k.build()


def n2():
    """Cantilever slab: a heavy plinth at one end rising into a column that holds the top out over the floor, the far
    end floating; a lit underglow along the slab's underside."""
    k = Bench("gametable_n2", FP2)
    k.box(-0.74, 0.0, 0.0, 0.44, 0.7, 0.06, "arcBodyK", top="arcBodyK")                 # the plinth,
    k.box(-0.74, 0.0, 0.06, 0.3, 0.42, TOP - 0.16, "arcBodyD", top="arcBody")           # the column,
    k.box(-0.58, 0.0, 0.1, 0.012, 0.3, TOP - 0.22, "arcCyan")                            # its lit seam,
    stadium(k, 0.92, 0.4, TOP - 0.14, 0.02, "arcCyan", top="arcCyan")                    # the underglow,
    stadium(k, 0.96, 0.44, TOP - 0.12, 0.08, "arcBodyD", top="arcBodyL")                # the slab,
    stadium(k, 0.93, 0.41, TOP - 0.04, 0.04, "arcChrD", top="arcGlass")                 # its glass top,
    k.box(0.1, 0.0, TOP, 1.2, 0.08, 0.008, "arcCyan", top="arcCyan")                     # the emitter strip
    arms(k, lambda u, v: (-0.74, v * 0.2, 0.03))
    return k.build()


def n3():
    """Ring table: an open stadium ring for a top, on two end posts over a long plinth; the projector stands in the
    middle under the opening, its lit bowl seen through it."""
    k = Bench("gametable_n3", FP2)
    stadium(k, 0.84, 0.3, 0.0, 0.05, "arcBodyK", top="arcBodyK")                         # the plinth,
    for s in (-1, 1):
        k.cyl(s * 0.66, 0.0, 0.05, 0.13, TOP - 0.15, "arcBodyD", top="arcBody", sides=12)   # the end posts,
    k.cyl(0.0, 0.0, 0.05, 0.13, TOP - 0.3, "arcBodyD", top="arcBody", sides=12)         # the projector column,
    k.cyl(0.0, 0.0, TOP - 0.25, 0.2, 0.05, "arcChrD", top="arcBodyK", sides=16)          # its bowl,
    ring_of(k, 0.19, TOP - 0.2, 16, 0.08, "arcCyan", h=0.01)                             # the bowl's lit rim
    stadium_ring(k, 0.96, 0.44, TOP - 0.1, 0.08, 0.2, "arcChrD", "arcChr")               # the ring top,
    stadium_ring(k, 0.75, 0.25, TOP - 0.03, 0.012, 0.02, "arcCyan", "arcCyan")           # its lit inner edge
    arms(k, lambda u, v: (u * 0.9, v * 0.2, 0.03))
    return k.build()


N_HOLO = {"n1": (TOP + 0.1, 0.34), "n2": (TOP + 0.06, 0.36), "n3": (TOP - 0.18, 0.24)}   # each table's holo base, arena R


def n_holo(v, game):
    z, R = N_HOLO[v]
    if game == "a":
        return lambda: m2_holo(z0=z + 0.02, name=f"gametable_{v}a_holo")
    return lambda: m3_holo(z=z, R=R, name=f"gametable_{v}b_holo")


# ---- round 5: the three tables refined; drop four and the duel, two takes each --------------------------------------

def token(k, u, v, z, d, col):
    """A round-looking token facing +v: a square with a diamond over it."""
    k.box(u, v, z, d, 0.03, d, col, top=col)
    k.box(u, v, z + d * 0.1, d * 0.8, 0.032, d * 0.8, col, top=col, ry=math.pi / 4)


def drop_a(z0, name):
    """Drop four, upright: a film grid on lit posts with feet and a top rail, round tokens, a line of four pink
    marked by a cream bar through them, the next token dropping with its streaks."""
    k = Bench(name, FP2)
    nc, nr, s = 7, 5, 0.1
    w, h = nc * s, nr * s
    k.box(0.0, 0.0, z0, w, 0.01, h, "arcCyanF", top="arcCyanF")
    for u in (-w / 2, w / 2):
        k.box(u, 0.0, z0 - 0.03, 0.02, 0.03, h + 0.05, "arcCyan", top="arcCyan")          # the posts,
        k.box(u, 0.0, z0 - 0.03, 0.03, 0.16, 0.014, "arcCyan", top="arcCyan")             # their feet
    k.box(0.0, 0.0, z0 + h, w + 0.03, 0.03, 0.014, "arcCyan", top="arcCyan")              # the top rail
    grid = ("ap.....", "paap...", "papa.a.", "appap.p", "papapap")                          # rows top to bottom
    for r, row in enumerate(grid[::-1]):
        for c, ch in enumerate(row):
            if ch != ".":
                col = "arcPink" if ch == "p" else "arcAmb"
                token(k, -w / 2 + (c + 0.5) * s - s * 0.38, 0.0, z0 + (r + 0.12) * s, s * 0.76, col)
    for (c0, r0), (c1, r1) in (((0, 0), (3, 3)),):                                          # the line of four
        a = (-w / 2 + (c0 + 0.5) * s, 0.02, z0 + (r0 + 0.5) * s)
        b = (-w / 2 + (c1 + 0.5) * s, 0.02, z0 + (r1 + 0.5) * s)
        bar(k, a, b, 0.016, "arcMarq")
    u = -w / 2 + 5.5 * s
    token(k, u - s * 0.38, 0.0, z0 + h + 0.07, s * 0.76, "arcAmb")                        # the next one dropping,
    for du in (-0.02, 0.02):
        k.box(u + du, 0.0, z0 + h + 0.16, 0.008, 0.01, 0.06, "arcAmbF")                   # its streaks
    return k


def drop_b(z0, name):
    """Drop four in 3D: a 4x4 grid of lit rods on a film base, beads stacked on them in pink and amber, one bead
    dropping onto a rod."""
    k = Bench(name, FP2)
    su, sv, n = 0.16, 0.11, 4
    k.box(0.0, 0.0, z0, su * n, sv * n, 0.01, "arcCyanF", top="arcCyanF")                 # the base,
    for sgn in (-1, 1):
        k.box(0.0, sgn * sv * n / 2, z0, su * n, 0.012, 0.016, "arcCyan", top="arcCyan")
        k.box(sgn * su * n / 2, 0.0, z0, 0.012, sv * n, 0.016, "arcCyan", top="arcCyan")
    heights = ((1, 3, 0, 2), (2, 1, 4, 1), (0, 2, 3, 2), (3, 1, 1, 0))
    for i in range(n):
        for jj in range(n):
            u, v = -su * n / 2 + (i + 0.5) * su, -sv * n / 2 + (jj + 0.5) * sv
            k.box(u, v, z0, 0.012, 0.012, 0.36, "arcCyan")                                  # a rod,
            for b in range(heights[i][jj]):
                col = "arcPink" if (i + jj + b) % 2 else "arcAmb"
                k.box(u, v, z0 + 0.012 + b * 0.075, 0.065, 0.065, 0.065, col, top=col)      # its beads
    u, v = -su * n / 2 + 2.5 * su, -sv * n / 2 + 0.5 * sv
    k.box(u, v, z0 + 0.42, 0.065, 0.065, 0.065, "arcPink", top="arcPink")                 # the dropping bead
    return k


def beast(k, u, z, col, face):
    """A four-legged beast facing +u (face 1) or -u: legs, a long body, a head with two horns, a tail."""
    for du in (-0.07, 0.07):
        for dv in (-0.05, 0.05):
            k.box(u + du, dv, z, 0.04, 0.04, 0.09, col, top=col)
    k.box(u, 0.0, z + 0.09, 0.22, 0.13, 0.09, col, top=col)
    k.box(u + face * 0.14, 0.0, z + 0.13, 0.09, 0.09, 0.08, col, top=col)
    for dv in (-0.03, 0.03):
        k.box(u + face * 0.16, dv, z + 0.21, 0.02, 0.02, 0.05, "arcMarq")                 # its horns
    k.box(u - face * 0.14, 0.0, z + 0.16, 0.09, 0.025, 0.025, col, ry=-face * 0.6)        # its tail


def robot(k, u, z, col, face):
    """A robot facing -u (face -1) or +u: legs, a chunky torso, a head with a lit visor, big fists, one raised."""
    for dv in (-0.045, 0.045):
        k.box(u, dv, z, 0.045, 0.045, 0.11, col, top=col)
    k.box(u, 0.0, z + 0.11, 0.11, 0.17, 0.12, col, top=col)
    k.box(u, 0.0, z + 0.23, 0.08, 0.08, 0.06, col, top=col)
    k.box(u + face * 0.041, 0.0, z + 0.25, 0.004, 0.06, 0.014, "arcMarq")                 # its visor
    k.box(u + face * 0.04, 0.11, z + 0.14, 0.07, 0.06, 0.07, col, top=col)                # the low fist,
    k.box(u + face * 0.1, -0.1, z + 0.22, 0.07, 0.06, 0.07, col, top=col)                 # the raised one


def bars(k, u, z, n, col):
    for i in range(5):
        c = col if i < n else "arcCyanF"
        k.box(u - 0.1 + i * 0.05, 0.0, z, 0.044, 0.02, 0.03, c, top=c)


def duel_a(z, R, name):
    """The duel refined: a lit arena with four pylons, the horned pink beast and the green robot (fists up) closing,
    a cream burst where they meet, a bigger health bar over each."""
    k = Bench(name, FP2)
    k.cyl(0.0, 0.0, z, R, 0.006, "arcCyanF", top="arcCyanF", sides=16)
    ring_of(k, R, z, 20, R * 0.33, "arcCyan", h=0.014)
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        k.box(R * math.cos(a), R * math.sin(a), z, 0.025, 0.025, 0.09, "arcCyan", top="arcCyan")
    beast(k, -0.16, z, "arcPink", 1)
    robot(k, 0.16, z, "arcGrn", -1)
    for rz in (0.0, 0.785, 1.571, 2.356):
        k.box(0.0, 0.03, z + 0.17, 0.12, 0.016, 0.016, "arcMarq", rz=rz)
    bars(k, -0.17, z + 0.4, 4, "arcPink")
    bars(k, 0.17, z + 0.4, 2, "arcGrn")
    return k


def duel_b(z, R, name):
    """The duel on two podiums: each creature on its own lit disc, the robot's beam crossing to the beast and bursting
    on it, the health bars over them."""
    k = Bench(name, FP2)
    for u, dz in ((-0.24, 0.0), (0.24, 0.05)):
        k.cyl(u, 0.0, z + dz, R * 0.55, 0.03, "arcCyanF", top="arcCyanF", sides=14)
        ring_of(k, R * 0.55, z + dz + 0.03, 14, R * 0.25, "arcCyan", h=0.012)
    beast(k, -0.24, z + 0.03, "arcPink", 1)
    robot(k, 0.24, z + 0.08, "arcGrn", -1)
    bar(k, (0.18, 0.11, z + 0.25), (-0.12, 0.02, z + 0.2), 0.02, "arcAmb")               # the beam,
    for rz in (0.0, 0.785, 1.571, 2.356):                                                # its burst
        k.box(-0.13, 0.02, z + 0.19, 0.12, 0.016, 0.016, "arcMarq", rz=rz)
    bars(k, -0.24, z + 0.4, 4, "arcPink")
    bars(k, 0.24, z + 0.45, 2, "arcGrn")
    return k


def p1():
    """Ridge console refined: a stadium base with rounded ends; the sloped glass decks and the spine on it, stopping
    short of the ends so the base's round ends show as shelves; per-player controls on each deck; a chrome spine
    rail carrying the projector strip."""
    k = Bench("gametable_p1", FP2)
    stadium(k, 0.98, 0.47, 0.0, 0.04, "arcBodyK", top="arcBodyK")
    stadium(k, 0.95, 0.44, 0.04, TOP - 0.16, "arcBodyD", top="arcBody")
    stadium(k, 0.96, 0.45, TOP - 0.13, 0.02, "arcChrD", top="arcChr")                    # a chrome band,
    prof = [(-0.42, TOP - 0.11), (0.42, TOP - 0.11), (0.42, TOP - 0.05), (0.09, TOP + 0.04), (-0.09, TOP + 0.04),
            (-0.42, TOP - 0.05)]
    prism(k, "u", -0.62, 0.62, prof, ("arcBody", "arcBodyD", "arcBodyL"), slope="arcGlass")   # the decks and spine,
    k.box(0.0, 0.0, TOP + 0.04, 1.3, 0.2, 0.03, "arcChrD", top="arcChr")                 # the spine rail,
    k.box(0.0, 0.0, TOP + 0.07, 1.2, 0.08, 0.01, "arcCyan", top="arcCyan")               # the projector strip
    for s, (u0, col) in ((1, (-0.35, "arcPink")), (-1, (0.35, "arcGrn"))):              # each player's controls
        for du, c in ((-0.08, col), (0.0, "arcBtnY"), (0.08, "arcBtnB")):
            k.box(u0 + du, s * 0.3, TOP - 0.06 + 0.035, 0.05, 0.05, 0.02, c, top=c)
    for s in (-1, 1):                                                                     # the end shelves' lit rings
        k.cyl(s * 0.78, 0.0, TOP - 0.11, 0.12, 0.01, "arcCyan", top="arcCyan", sides=12)
        k.cyl(s * 0.78, 0.0, TOP - 0.11, 0.09, 0.012, "arcBodyK", top="arcBodyK", sides=12)
    arms(k, lambda u, v: (u * 0.6, v * 0.18, 0.03))
    return k.build()


def p2():
    """Cantilever refined: the column at the right end (where it shows), a tapered body wide at the floor, chrome
    banded; the slab with a chrome edge and a lit underglow along its front; the far end floating."""
    k = Bench("gametable_p2", FP2)
    k.box(0.72, 0.0, 0.0, 0.5, 0.8, 0.05, "arcBodyK", top="arcBodyK")                   # the plinth,
    k.box(0.72, 0.0, 0.05, 0.42, 0.56, TOP - 0.17, "arcBodyD", top="arcBody", taper=0.62)   # the tapered column,
    k.box(0.72, 0.0, 0.3, 0.33, 0.46, 0.03, "arcChrD", top="arcChr")                     # its chrome band,
    k.box(0.72, 0.24, 0.08, 0.16, 0.006, 0.18, "arcCyan")                                 # its lit badge
    stadium(k, 0.96, 0.44, TOP - 0.12, 0.08, "arcBodyD", top="arcBodyL")                # the slab,
    stadium(k, 0.97, 0.45, TOP - 0.05, 0.02, "arcChrD", top="arcChr")                   # its chrome edge,
    stadium(k, 0.93, 0.41, TOP - 0.03, 0.03, "arcChrD", top="arcGlass")                 # its glass top,
    k.box(-0.15, 0.445, TOP - 0.14, 1.3, 0.008, 0.02, "arcCyan")                          # the underglow, front
    k.box(-0.15, -0.445, TOP - 0.14, 1.3, 0.008, 0.02, "arcCyan")                         # and back,
    k.cyl(-0.82, 0.0, TOP - 0.14, 0.12, 0.02, "arcCyan", top="arcCyan", sides=12)        # a lit pad under the far end
    k.box(-0.1, 0.0, TOP, 1.2, 0.08, 0.008, "arcCyan", top="arcCyan")                     # the emitter strip
    arms(k, lambda u, v: (0.72, v * 0.25, 0.03))
    return k.build()


def p3():
    """Ring table refined: a chrome ring over a navy band with a lit seam and a lit inner edge; two tapered posts with
    chrome collars; the projector column with its lit bowl and lens in the opening; a plinth with a lit edge."""
    k = Bench("gametable_p3", FP2)
    stadium(k, 0.86, 0.32, 0.0, 0.05, "arcBodyK", top="arcBodyK")
    stadium_ring(k, 0.86, 0.32, 0.05, 0.008, 0.02, "arcCyan", "arcCyan")                  # the plinth's lit edge,
    for s in (-1, 1):
        k.cyl(s * 0.66, 0.0, 0.05, 0.16, TOP - 0.17, "arcBodyD", top="arcBody", sides=12, rtop=0.11)   # the posts,
        k.cyl(s * 0.66, 0.0, TOP - 0.16, 0.13, 0.03, "arcChrD", top="arcChr", sides=12)                # collars
    k.cyl(0.0, 0.0, 0.05, 0.12, TOP - 0.32, "arcBodyD", top="arcBody", sides=12)
    k.cyl(0.0, 0.0, TOP - 0.27, 0.21, 0.05, "arcChrD", top="arcBodyK", sides=16)          # the bowl,
    ring_of(k, 0.2, TOP - 0.22, 16, 0.085, "arcCyan", h=0.012)
    k.cyl(0.0, 0.0, TOP - 0.23, 0.06, 0.01, "arcCyan", top="arcCyan", sides=10)           # the lens
    stadium_ring(k, 0.96, 0.44, TOP - 0.13, 0.05, 0.2, "arcBodyD", "arcBody")             # the navy band,
    stadium_ring(k, 0.96, 0.44, TOP - 0.09, 0.012, 0.012, "arcCyan", "arcCyan")           # its lit seam,
    stadium_ring(k, 0.96, 0.44, TOP - 0.08, 0.05, 0.2, "arcChrD", "arcChr")               # the chrome ring,
    stadium_ring(k, 0.75, 0.25, TOP - 0.03, 0.012, 0.02, "arcCyan", "arcCyan")           # its lit inner edge
    arms(k, lambda u, v: (u * 0.9, v * 0.2, 0.03))
    return k.build()


P_SET = {"p1": (p1, TOP + 0.09, 0.32, "a", "a"), "p2": (p2, TOP + 0.05, 0.36, "b", "b"),
         "p3": (p3, TOP - 0.2, 0.24, "b", "a")}                       # table, holo base, arena R, drop take, duel take


def p_holo(v, game):
    cab, z, R, dt, wt = P_SET[v]
    if game == "a":
        f = drop_a if dt == "a" else drop_b
        return lambda: f(z + 0.03, f"gametable_{v}a_holo")
    f = duel_a if wt == "a" else duel_b
    dz = 0.1 if v == "p3" else 0.0                                   # (up out of the ring, so the ring hides less)
    return lambda: f(z + dz, R, f"gametable_{v}b_holo")


# ---- round 6: on the card dais table (l3), readability first: fewer, bigger, bolder pieces, the dais as projector ----

LENS3 = (0.0, 0.0, TOP + 0.062)                                      # l3's lens, in the dais's well


def rays(k, pts, col="arcCyanF"):
    for q in pts:
        bar(k, LENS3, q, 0.01, col)


def q1_holo():
    """Drop four, big: a 5x4 grid hovering over the dais (cyan film, lit border), big pink and amber tokens, one
    dropping in; rays from the lens to its foot."""
    k = Bench("gametable_q1_holo", FP2)
    nc, nr, s, z0 = 5, 4, 0.13, TOP + 0.16
    w, h = nc * s, nr * s
    k.box(0.0, 0.0, z0, w, 0.01, h, "arcCyanF", top="arcCyanF")
    for u in (-w / 2, w / 2):
        k.box(u, 0.0, z0, 0.018, 0.02, h, "arcCyan", top="arcCyan")
    for z in (z0 - 0.018, z0 + h):
        k.box(0.0, 0.0, z, w + 0.036, 0.02, 0.018, "arcCyan", top="arcCyan")
    grid = ("p....", "ap.a.", "pap.p", "apapa")                                           # rows top to bottom
    for r, row in enumerate(grid[::-1]):
        for c, ch in enumerate(row):
            if ch != ".":
                token(k, -w / 2 + (c + 0.5) * s, 0.0, z0 + (r + 0.11) * s, s * 0.78,
                      "arcPink" if ch == "p" else "arcAmb")
    token(k, -w / 2 + 3.5 * s, 0.0, z0 + h + 0.05, s * 0.78, "arcAmb")                    # dropping in
    rays(k, [(-w / 2, 0.0, z0 - 0.018), (w / 2, 0.0, z0 - 0.018)], "arcCyan")
    return k


def q2_holo():
    """Drop four in tubes: five lit-edged film tubes standing over the dais, the tokens stacked inside them, one
    dropping into a tube; rays from the lens to the tubes' feet."""
    k = Bench("gametable_q2_holo", FP2)
    nc, s, z0, h = 5, 0.13, TOP + 0.14, 0.52
    heights = ("ap", "pap", "a", "papa", "pa")
    for c in range(nc):
        u = -nc * s / 2 + (c + 0.5) * s
        k.box(u, 0.0, z0, s * 0.86, s * 0.5, h, "arcCyanF", top="arcCyanF")              # the tube,
        for du in (-s * 0.43, s * 0.43):
            k.box(u + du, s * 0.25, z0, 0.012, 0.006, h, "arcCyan")                       # its lit edges
        k.box(u, 0.0, z0 + h, s * 0.86, s * 0.5, 0.012, "arcCyan", top="arcCyan")         # its lit mouth
        for r, ch in enumerate(heights[c]):
            token(k, u, s * 0.27, z0 + 0.01 + r * s * 0.95, s * 0.72, "arcPink" if ch == "p" else "arcAmb")
    token(k, -nc * s / 2 + 2.5 * s, s * 0.27, z0 + h + 0.06, s * 0.72, "arcPink")          # dropping in
    rays(k, [(-nc * s / 2, 0.0, z0), (nc * s / 2, 0.0, z0)], "arcCyan")
    return k


def beast2(k, u, z, col, face, scale=1.0):
    """A big, simple beast facing +u: four legs, a long low body, a head held forward."""
    q = scale
    for du in (-0.08, 0.08):
        for dv in (-0.05, 0.05):
            k.box(u + du * q, dv * q, z, 0.045 * q, 0.045 * q, 0.08 * q, col, top=col)
    k.box(u, 0.0, z + 0.08 * q, 0.26 * q, 0.14 * q, 0.1 * q, col, top=col)
    k.box(u + face * 0.16 * q, 0.0, z + 0.12 * q, 0.1 * q, 0.1 * q, 0.09 * q, col, top=col)


def robot2(k, u, z, col, face, scale=1.0):
    """A big, simple robot: two legs, a tall torso, a head; tall and narrow against the beast's long and low."""
    q = scale
    for dv in (-0.045, 0.045):
        k.box(u, dv * q, z, 0.05 * q, 0.05 * q, 0.12 * q, col, top=col)
    k.box(u, 0.0, z + 0.12 * q, 0.1 * q, 0.16 * q, 0.15 * q, col, top=col)
    k.box(u, 0.0, z + 0.27 * q, 0.08 * q, 0.08 * q, 0.07 * q, col, top=col)
    k.box(u + face * 0.08 * q, 0.1 * q, z + 0.2 * q, 0.1 * q, 0.05 * q, 0.05 * q, col, top=col)   # a reaching arm


def bar2(k, u, z, frac, col):
    """One health bar: the lit share, the rest in film."""
    W = 0.2
    k.box(u - W / 2 + W * frac / 2, 0.0, z, W * frac, 0.02, 0.03, col, top=col)
    k.box(u + W * frac / 2, 0.0, z, W * (1 - frac), 0.02, 0.03, "arcCyanF", top="arcCyanF")


def q3_holo():
    """The duel over the dais: a film arena with a lit rim hovering over it, rays from the lens to the rim, the long
    pink beast and the tall green robot facing off, one health bar over each."""
    k = Bench("gametable_q3_holo", FP2)
    z, R = TOP + 0.14, 0.32
    k.cyl(0.0, 0.0, z, R, 0.006, "arcCyanF", top="arcCyanF", sides=16)
    ring_of(k, R, z, 20, R * 0.33, "arcCyan", h=0.016)
    rays(k, [(R * math.cos(a), R * math.sin(a), z) for a in (0.6, 2.6, 4.6)], "arcCyan")
    beast2(k, -0.15, z, "arcPink", 1)
    robot2(k, 0.17, z, "arcGrn", -1)
    bar2(k, -0.15, z + 0.38, 0.75, "arcPink")
    bar2(k, 0.17, z + 0.44, 0.4, "arcGrn")
    return k


def q4_holo():
    """The duel on the dais itself: no arena disc, the creatures larger, standing on the dais's lit ring as their
    stage, a shot crossing between them, the health bars over them."""
    k = Bench("gametable_q4_holo", FP2)
    z = TOP + 0.07
    beast2(k, -0.2, z, "arcPink", 1, scale=1.25)
    robot2(k, 0.2, z, "arcGrn", -1, scale=1.25)
    for i in range(3):                                                                    # a shot, dashed
        u = 0.08 - i * 0.07
        k.box(u, 0.06, z + 0.25, 0.04, 0.02, 0.02, "arcAmb", top="arcAmb")
    bar2(k, -0.2, z + 0.46, 0.75, "arcPink")
    bar2(k, 0.2, z + 0.52, 0.4, "arcGrn")
    return k


# ---- round 7: the dais table with a recessed projector (as the arcade's), the duel spread over the whole table -------

def r_table(name, trough=False):
    """L3's table (slim top on one round column), its dais replaced by a recessed projector: a chrome collar with a lit
    rim round a dark well, the lens(es) on a chrome housing held by struts. `trough`: a long stadium-shaped well along
    the table with three lenses in a row, in place of the round one."""
    k = Bench(name, FP2)
    k.cyl(0.0, 0.0, 0.0, 0.3, 0.04, "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, 0.04, 0.16, TOP - 0.14, "arcBodyD", top="arcBody", sides=16)
    k.cyl(0.0, 0.0, 0.3, 0.17, 0.03, "arcChrD", top="arcChr", sides=16)
    stadium(k, 0.96, 0.4, TOP - 0.1, 0.06, "arcChrD", top="arcChr")
    stadium(k, 0.93, 0.37, TOP - 0.04, 0.04, "arcBodyD", top="arcGlass")
    if trough:
        stadium(k, 0.6, 0.15, TOP, 0.004, "arcBodyK", top="arcBodyK")                    # the well's floor,
        stadium_ring(k, 0.64, 0.19, TOP, 0.045, 0.05, "arcChrD", "arcChr")               # the collar,
        stadium_ring(k, 0.64, 0.19, TOP + 0.045, 0.008, 0.02, "arcCyan", "arcCyan")      # its lit rim
        for u in LENSES_T:
            for a in (0.0, math.pi):
                k.box(u, 0.0, TOP + 0.004, 0.012, 0.24, 0.012, "arcChrD", top="arcChr")  # the struts,
            k.cyl(u, 0.0, TOP + 0.004, 0.06, 0.02, "arcChrD", top="arcChr", sides=10)    # a housing,
            k.cyl(u, 0.0, TOP + 0.024, 0.038, 0.004, "arcCyan", top="arcCyan", sides=10)  # a lens
    else:
        r, n = 0.22, 20
        k.cyl(0.0, 0.0, TOP, 0.2, 0.004, "arcBodyK", top="arcBodyK", sides=16)           # the well's floor,
        for i in range(n):                                                               # the collar,
            a = i * math.tau / n
            k.box(r * math.cos(a), r * math.sin(a), TOP, math.tau * r / n * 1.12, 0.05, 0.045, "arcChrD",
                  top="arcChr", rz=a + math.pi / 2)
        ring_of(k, r, TOP + 0.045, n, 0.075, "arcCyan", h=0.008)                         # its lit rim,
        for a in (0.5, 2.6, 4.7):                                                        # the struts,
            k.box(0.12 * math.cos(a), 0.12 * math.sin(a), TOP + 0.004, 0.12, 0.018, 0.012, "arcChrD",
                  top="arcChr", rz=a)
        k.cyl(0.0, 0.0, TOP + 0.004, 0.07, 0.025, "arcChrD", top="arcChr", sides=12)       # the housing,
        k.cyl(0.0, 0.0, TOP + 0.029, 0.045, 0.004, "arcCyan", top="arcCyan", sides=12)    # the lens
    for sgn in (-1, 1):                                                                  # a lit pad at each place
        k.box(sgn * 0.72, 0.0, TOP, 0.22, 0.46, 0.004, "arcCyanF", top="arcCyanF")
    for u, v in SEATS:
        bar(k, (0.0, 0.0, 0.03), (u, v, 0.03), 0.06, "arcChrD")
        stool(k, u, v, -1 if v > 0 else 1)
    return k.build()


LENSES_T = (-0.38, 0.0, 0.38)
ZA, AU, AV = TOP + 0.4, 0.78, 0.3                                   # the arena's height and half sizes


def arena_duel(k):
    """A wide stadium arena floating over the whole table (a lit rim and centre line, a film pad under each fighter;
    no floor fill, which would hide the rays under it), the beast and the robot at its two ends with room between them,
    a health bar over each."""
    stadium_ring(k, AU, AV, ZA, 0.016, 0.02, "arcCyan", "arcCyan")                       # the rim,
    k.box(0.0, 0.0, ZA, 0.014, 2 * AV, 0.008, "arcCyan", top="arcCyan")                  # the centre line,
    for u in (-0.44, 0.44):                                                              # a film pad under each
        k.cyl(u, 0.0, ZA, 0.16, 0.004, "arcCyanF", top="arcCyanF", sides=14)             # (no floor fill: the rays
                                                                                         # show through)
    beast2(k, -0.44, ZA, "arcPink", 1)
    robot2(k, 0.44, ZA, "arcGrn", -1)
    bar2(k, -0.44, ZA + 0.36, 0.75, "arcPink")
    bar2(k, 0.44, ZA + 0.42, 0.4, "arcGrn")


def rim_points(n, inset=0.0):
    """n points round the arena's stadium edge."""
    pts = []
    for i in range(n):
        a = i * math.tau / n + 0.2
        x, y = math.cos(a), math.sin(a)
        u = (AU - AV) * (1 if x > 0 else -1) * min(1.0, abs(x) * 3) + AV * x
        pts.append((u * (1 - inset), AV * y * (1 - inset), ZA))
    return pts


def r1_holo():
    """One lens: the arena over the whole table, a fan of rays from the lens up to its rim (lit to four points, film to
    the points between)."""
    k = Bench("gametable_r1_holo", FP2)
    arena_duel(k)
    lens = (0.0, 0.0, TOP + 0.033)
    for i, q in enumerate(rim_points(12)):
        bar(k, lens, q, 0.01, "arcCyan" if i % 3 == 0 else "arcCyanF")
    return k


def r2_holo():
    """The trough: three lenses in a row, each throwing its own fan of rays to the part of the rim over it."""
    k = Bench("gametable_r2_holo", FP2)
    arena_duel(k)
    pts = rim_points(15)
    for i, q in enumerate(pts):
        u0 = min(LENSES_T, key=lambda u: abs(u - q[0]))
        bar(k, (u0, 0.0, TOP + 0.028), q, 0.01, "arcCyan" if i % 3 == 0 else "arcCyanF")
    return k


def r1():
    return r_table("gametable_r1")


def r2():
    return r_table("gametable_r2", trough=True)


# ---- round 8: R1 with more interesting creatures, three pairings (pink: the front player's, green: the back one's) ----

def bx(k, u, v, z, su, sv, sz, col, **kw):
    k.box(u, v, z, su, sv, sz, col, top=col, **kw)


def beast3(k, u, z, col, f):
    """The beast: four legs, a long body with three spines down its back, a head low and forward with its jaw open and a
    cream eye, a tail curling up behind."""
    for du in (-0.08, 0.08):
        for dv in (-0.05, 0.05):
            bx(k, u + du, dv, z, 0.045, 0.045, 0.08, col)
    bx(k, u, 0.0, z + 0.08, 0.26, 0.14, 0.1, col)
    for i, du in enumerate((-0.07, 0.0, 0.07)):                                          # the spines
        h = 0.07 - abs(i - 1) * 0.02
        bx(k, u + du, 0.0, z + 0.18, 0.04, 0.03, h, col, ry=f * 0.35)
    bx(k, u + f * 0.17, 0.0, z + 0.13, 0.11, 0.1, 0.06, col)                             # the head,
    bx(k, u + f * 0.19, 0.0, z + 0.08, 0.09, 0.08, 0.025, col)                           # its open jaw,
    bx(k, u + f * 0.2, 0.051, z + 0.16, 0.025, 0.004, 0.02, "arcMarq")                   # its eye
    bx(k, u - f * 0.16, 0.0, z + 0.14, 0.1, 0.03, 0.03, col, ry=f * 0.7)                 # the tail,
    bx(k, u - f * 0.21, 0.0, z + 0.2, 0.04, 0.04, 0.04, col)                             # its tip


def robot3(k, u, z, col, f):
    """The robot: thick legs on feet, a torso wider at the shoulders, shoulder pads, a head with a cream visor and an
    antenna, an arm cannon levelled at the beast, the other fist down."""
    for dv in (-0.05, 0.05):
        bx(k, u, dv, z, 0.08, 0.05, 0.02, col)                                            # feet,
        bx(k, u, dv, z + 0.02, 0.05, 0.05, 0.1, col)                                      # legs
    bx(k, u, 0.0, z + 0.12, 0.1, 0.15, 0.15, col, taper=1.25)                             # the torso,
    for dv in (-0.1, 0.1):
        bx(k, u, dv, z + 0.24, 0.08, 0.06, 0.05, col)                                     # shoulder pads,
    bx(k, u, 0.0, z + 0.27, 0.07, 0.07, 0.06, col)                                        # the head,
    bx(k, u + f * 0.036, 0.0, z + 0.29, 0.004, 0.055, 0.016, "arcMarq")                  # its visor,
    bx(k, u - 0.01, -0.02, z + 0.33, 0.01, 0.01, 0.06, col)                               # the antenna,
    bx(k, u - 0.01, -0.02, z + 0.39, 0.02, 0.02, 0.02, "arcMarq")                         # its tip
    bx(k, u + f * 0.1, 0.12, z + 0.2, 0.16, 0.05, 0.05, col)                              # the arm cannon,
    bx(k, u + f * 0.19, 0.12, z + 0.205, 0.02, 0.04, 0.04, "arcMarq")                     # its muzzle
    bx(k, u, -0.13, z + 0.1, 0.06, 0.05, 0.07, col)                                       # the other fist


def dragon(k, u, z, col, f):
    """A dragon: hind legs, a body, a long neck up to a horned head, two wings raised, a tail."""
    for dv in (-0.05, 0.05):
        bx(k, u - f * 0.04, dv, z, 0.05, 0.04, 0.08, col)
    bx(k, u, 0.0, z + 0.08, 0.18, 0.12, 0.09, col)
    bx(k, u + f * 0.1, 0.0, z + 0.14, 0.04, 0.05, 0.12, col, ry=f * 0.35)                # the neck,
    bx(k, u + f * 0.15, 0.0, z + 0.25, 0.1, 0.07, 0.05, col)                             # the head,
    bx(k, u + f * 0.12, 0.0, z + 0.3, 0.015, 0.05, 0.04, "arcMarq", ry=-f * 0.4)         # its horns,
    for sv in (-1, 1):                                                                    # the wings
        bx(k, u - f * 0.02, sv * 0.12, z + 0.17, 0.16, 0.1, 0.012, col, rx=sv * 0.7)
    bx(k, u - f * 0.15, 0.0, z + 0.09, 0.14, 0.03, 0.03, col, ry=-f * 0.3)              # the tail


def golem(k, u, z, col, f):
    """A golem: stumpy legs, a massive block body hunched forward, a small head sunk between the shoulders with a
    cream eye slit, two huge fists on long arms reaching the ground."""
    for dv in (-0.05, 0.05):
        bx(k, u, dv, z, 0.06, 0.06, 0.06, col)
    bx(k, u, 0.0, z + 0.06, 0.15, 0.2, 0.17, col, ry=f * 0.15)
    bx(k, u + f * 0.06, 0.0, z + 0.2, 0.07, 0.07, 0.05, col)
    bx(k, u + f * 0.096, 0.0, z + 0.215, 0.004, 0.05, 0.012, "arcMarq")
    for sv in (-1, 1):
        bx(k, u + f * 0.06, sv * 0.14, z + 0.08, 0.04, 0.04, 0.14, col)                  # arms,
        bx(k, u + f * 0.08, sv * 0.14, z, 0.09, 0.09, 0.08, col)                          # fists


def serpent(k, u, z, col, f):
    """A serpent: a coil on the ground, its body rising in an S to a hooded head with cream eyes."""
    for i in range(6):                                                                    # the coil
        a = i * math.tau / 6
        bx(k, u + 0.07 * math.cos(a), 0.07 * math.sin(a), z, 0.06, 0.06, 0.05, col)
    for i, (du, dz, sz) in enumerate(((0.02, 0.05, 0.06), (0.05, 0.11, 0.055), (0.04, 0.17, 0.05),
                                      (0.07, 0.22, 0.045))):
        bx(k, u + f * du, 0.0, z + dz, sz, sz, sz, col)                                   # the rising body,
    bx(k, u + f * 0.1, 0.0, z + 0.26, 0.06, 0.14, 0.07, col)                              # the hood,
    bx(k, u + f * 0.13, 0.0, z + 0.27, 0.07, 0.06, 0.045, col)                            # the head,
    for dv in (-0.018, 0.018):
        bx(k, u + f * 0.166, dv, z + 0.29, 0.004, 0.012, 0.012, "arcMarq")               # the eyes


def crab(k, u, z, col, f):
    """A crab mech: a wide flat body on six splayed legs, two big claws raised toward its foe, cream eye stalks."""
    for du in (-0.06, 0.0, 0.06):
        for sv in (-1, 1):
            bx(k, u + du, sv * 0.11, z, 0.025, 0.08, 0.025, col, rx=-sv * 0.8)            # the legs,
    bx(k, u, 0.0, z + 0.06, 0.18, 0.2, 0.07, col)                                         # the body,
    for sv in (-1, 1):
        bx(k, u + f * 0.12, sv * 0.08, z + 0.1, 0.08, 0.035, 0.035, col, ry=-f * 0.5)    # the arms,
        bx(k, u + f * 0.18, sv * 0.08, z + 0.15, 0.08, 0.06, 0.07, col)                   # the claws
        bx(k, u + f * 0.05, sv * 0.04, z + 0.13, 0.012, 0.012, 0.05, col)                 # the eye stalks,
        bx(k, u + f * 0.05, sv * 0.04, z + 0.18, 0.024, 0.024, 0.024, "arcMarq")


def s_holo(name, left, right):
    """R1's projection (the ray fan to a lit rim, no floor) with a pair of creatures."""
    def make():
        k = Bench(name, FP2)
        stadium_ring(k, AU, AV, ZA, 0.016, 0.02, "arcCyan", "arcCyan")
        k.box(0.0, 0.0, ZA, 0.014, 2 * AV, 0.008, "arcCyan", top="arcCyan")
        for u in (-0.44, 0.44):
            k.cyl(u, 0.0, ZA, 0.16, 0.004, "arcCyanF", top="arcCyanF", sides=14)
        left(k, -0.44, ZA, "arcPink", 1)
        right(k, 0.44, ZA, "arcGrn", -1)
        bar2(k, -0.44, ZA + 0.46, 0.75, "arcPink")
        bar2(k, 0.44, ZA + 0.5, 0.4, "arcGrn")
        lens = (0.0, 0.0, TOP + 0.033)
        for i, q in enumerate(rim_points(12)):
            bar(k, lens, q, 0.01, "arcCyan" if i % 3 == 0 else "arcCyanF")
        return k
    return make


S_SET = (("s1", beast3, robot3), ("s2", dragon, golem), ("s3", serpent, crab))


def holo_job(sid, cab, holo):
    def run(sid=sid):
        from . import core, post
        from .research_kit import holo_item
        core.clear_scene_meshes()
        post.select("arcade")
        it = holo_item(sid, FP2, cab(), holo().build())
        return [it] if it else []
    return run


def jobs():
    out = [(f"module.gametable.{v}", FP2, "prop", f) for v, f in (("k1", k1), ("k2", k2), ("k3", k3), ("l1", l1),
                                                                 ("l2", l2), ("l3", l3), ("m1", k1),
                                                                 ("m2", l3), ("m3", l2))]
    for v, cab in (("n1", n1), ("n2", n2), ("n3", n3)):
        out += [(f"module.gametable.{v}{g}", FP2, "prop", cab) for g in "ab"]
    out += [(f"module.gametable.{v}", FP2, "prop", l3) for v in ("q1", "q2", "q3", "q4")]
    out += [("module.gametable.r1", FP2, "prop", r1), ("module.gametable.r2", FP2, "prop", r2)]
    out += [(f"module.gametable.{v}", FP2, "prop", r1) for v, _, _ in S_SET]
    for v, (cab, *_) in P_SET.items():
        out += [(f"module.gametable.{v}{g}", FP2, "prop", cab) for g in "ab"]
    return out + [holo_job(f"module.gametable.{v}.holo", cab, holo) for v, cab, holo in
                  (("k1", k1, k1_holo), ("k2", k2, k2_holo), ("k3", k3, k3_holo), ("l1", l1, l1_holo),
                   ("l2", l2, l2_holo), ("l3", l3, l3_holo), ("m1", k1, m1_holo), ("m2", l3, m2_holo),
                   ("m3", l2, m3_holo))] + \
        [holo_job(f"module.gametable.{v}{g}.holo", cab, n_holo(v, g)) for v, cab in (("n1", n1), ("n2", n2), ("n3", n3))
         for g in "ab"] + \
        [holo_job(f"module.gametable.{v}{g}.holo", P_SET[v][0], p_holo(v, g)) for v in P_SET for g in "ab"] + \
        [holo_job(f"module.gametable.{v}.holo", l3, h) for v, h in
         (("q1", q1_holo), ("q2", q2_holo), ("q3", q3_holo), ("q4", q4_holo))] + \
        [holo_job("module.gametable.r1.holo", r1, r1_holo), holo_job("module.gametable.r2.holo", r2, r2_holo)] + \
        [holo_job(f"module.gametable.{v}.holo", r1, s_holo(f"gametable_{v}_holo", a, b)) for v, a, b in S_SET]
