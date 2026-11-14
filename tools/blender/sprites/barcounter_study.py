"""Bar counter look study (family `barcounter`, preview only): a straight 3x2 module, r0. The counter fills the back row
(the bartender's side behind it), three stools stand on the front row where crew sit facing it. Its ends are plain
flat faces at the footprint's edge, so a corner piece can butt against them later.

Local frame modkit.K, footprint (3, 2), in px of the tile (bunk_study._px): u -48..48 across, v -32..32 deep, front
+v (toward the camera at r0); heights in px (crew are about 59 px tall). Counter top at 24 px, stool seats at 15 (0.62
and 0.39 of a tile, the game table's, so the seated poses fit). Round 1: c1-c3; round 2 (where the drinks come from):
d1-d3."""
import math

from .bunk_study import _px
from .modkit import K

FP = (3, 2)
TOP, SEAT = 24, 15                                      # as the game table: the sit poses fit these
STOOLS = (-32, 0, 32)                                   # stool centres along u, one a tile
SV = 16                                                 # stools' v: the middle of the front row


def _stool_round(k, u, seat, seat_top, post, base, r=5):
    """A round stool: a disc base, a 2 px post, a round seat r px across (cyl, 12 sides)."""
    k.cyl(u / 32, SV / 32, 0, 4 / 32, 1 / ZPX, base, top=base, sides=12)
    _px(k, u - 1, u + 1, SV - 1, SV + 1, 1, SEAT - 2, post, post)
    k.cyl(u / 32, SV / 32, (SEAT - 2) / ZPX, r / 32, 2 / ZPX, seat, top=seat_top, sides=12)


ZPX = 32 * math.sqrt(2) * math.cos(math.radians(30))


def c1():
    """C1 diner: a teal counter with a cream top and a chrome trim line, a chrome foot rail along its front, round
    chrome stools with teal seats."""
    k = K("bar_c1", FP)
    _px(k, -48, 48, -16, -2, 0, 3, "wD", "wD")                                     # kick, set back 2 px
    _px(k, -48, 48, -16, 0, 3, TOP - 2, "wM", "wL")                                # body
    _px(k, -48, 48, 0, 1, 15, 16, "nvW1", "nvW1")                                  # chrome trim line (1 px proud)
    _px(k, -48, 48, -17, 3, TOP - 2, TOP, "c2T1", "c2T0")                          # top, overhanging 3 px
    _px(k, -46, 46, 2, 3, 5, 6, "nvW1", "nvW1")                                    # foot rail
    for u in (-40, 0, 40):
        _px(k, u, u + 1, 0, 2, 5, 6, "nvW2", "nvW2")                               # its brackets
    for u in STOOLS:
        _stool_round(k, u, "wL", "wH", "nvW1", "nvW2")
    return k.build()


def c2():
    """C2 lounge: a dark warm counter with a recessed panel a tile and a thick light top, a brass foot rail, square
    stools in plum with a low back."""
    k = K("bar_c2", FP)
    _px(k, -48, 48, -16, -3, 0, 3, "gdD", "gdD")
    _px(k, -47, 47, -16, -1, 3, TOP - 3, "gdD", "gdD")                             # core (inside the end caps)
    _px(k, -48, 48, -1, 0, 3, 6, "gdM", "gd")                                      # the front frame: bottom rail,
    _px(k, -48, 48, -1, 0, TOP - 7, TOP - 3, "gdM", "gd")                          # top rail,
    for u0, u1 in ((-48, -44), (-20, -12), (12, 20), (44, 48)):                    # and stiles between the panels
        _px(k, u0, u1, -1, 0, 6, TOP - 7, "gdM", "gd")
    for u0 in (-48, 47):                                                           # end caps in the frame's colour
        _px(k, u0, u0 + 1, -16, -1, 3, TOP - 3, "gdM", "gd")
    _px(k, -48, 48, -18, 3, TOP - 3, TOP, "gdL", "gdL")                            # thick top
    _px(k, -46, 46, 2, 3, 5, 6, "oM", "oL")                                        # brass foot rail
    for u in (-40, 0, 40):
        _px(k, u, u + 1, 0, 2, 5, 6, "oD", "oD")
    for u in STOOLS:
        _px(k, u - 4, u + 4, SV - 4, SV + 4, 0, 1, "gdD", "gdD")                   # foot plate
        _px(k, u - 1, u + 1, SV - 1, SV + 1, 1, SEAT - 3, "oM", "oL")              # brass post
        _px(k, u - 5, u + 5, SV - 5, SV + 5, SEAT - 3, SEAT, "rD", "rL")           # square seat
        _px(k, u - 5, u + 5, SV + 4, SV + 5, SEAT, SEAT + 5, "rD", "rL")           # low back (away from the bar)
    return k.build()


def c3():
    """C3 neon: a near-black counter whose front steps back under a dark glass top, a magenta light strip under the
    overhang, drum stools in violet."""
    k = K("bar_c3", FP)
    _px(k, -48, 48, -16, -4, 0, TOP - 2, "xnD", "xnM")                             # body, stepped back 4 px
    _px(k, -48, 48, -16, 0, 0, 10, "xnD", "xnM")                                   # lower front, full depth
    _px(k, -48, 48, 0, 1, 10, 11, "xnL", "xnL")                                    # its lip (1 px proud)
    _px(k, -48, 48, -4, -3, TOP - 4, TOP - 3, "magenta")                           # light strip under the top
    _px(k, -48, 48, -17, 3, TOP - 2, TOP, "glassD", "glassL")                      # dark glass top
    for u in STOOLS:                                                               # drum stools
        k.cyl(u / 32, SV / 32, 0, 5 / 32, (SEAT - 2) / ZPX, "xnM", top="xnL", sides=12)
        k.cyl(u / 32, SV / 32, (SEAT - 2) / ZPX, 5 / 32, 2 / ZPX, "xnL", top="xnH", sides=12)
        k.cyl(u / 32, SV / 32, 3 / ZPX, 5.2 / 32, 1 / ZPX, "magenta", sides=12)    # a light ring at the foot
    return k.build()


def _drum_u(k, u0, u1, v, zc, col, top):
    """A drum lying along u from u0 to u1, centred at (v, zc): an octagon 12 px across from three boxes."""
    for vh, zh in ((6, 3), (5, 5), (3, 6)):
        _px(k, u0, u1, v - vh, v + vh, zc - zh, zc + zh, col, top)


def d1():
    """D1 tap gantry: three tall kegs plumbed in behind the counter, each with its coloured line up and along the beam
    of a steel gantry over the counter to a tap; drip trays under the taps, a glass filling under one. Steel blue."""
    k = K("bar_d1", FP)
    _px(k, -48, 48, -15, -2, 0, 2, "barBlueK", "barBlueK")                         # kick
    _px(k, -48, 48, -16, 0, 2, TOP - 2, "barBlue", "barBlue")                      # body
    _px(k, -48, 48, 0, 1, 7, 8, "barSteel", "barSteel")                            # trim (1 px proud)
    _px(k, -48, 48, -17, 3, TOP - 2, TOP, "barSteel", "barSteel")                  # steel top
    for u in (-46, 44):                                                            # gantry posts
        _px(k, u, u + 2, -14, -12, TOP, 52, "barGun", "barGun")
    _px(k, -46, 46, -14, -12, 50, 53, "barGun", "barGun")                          # beam
    for ku, u, col in ((-32, -24, "barAmber"), (-16, 0, "barGreen"), (0, 24, "barRed")):
        k.cyl(ku / 32, -25 / 32, 0, 5 / 32, 34 / ZPX, "barSteel", top="barSteel", sides=12)   # keg, tall enough to
        k.cyl(ku / 32, -25 / 32, 26 / ZPX, 5.3 / 32, 3 / ZPX, col, top=col, sides=12)          # show over the top
        _px(k, ku, ku + 1, -25, -24, 34, 51, col, col)                             # its line up to the beam,
        _px(k, min(ku, u), max(ku, u) + 1, -12, -11, 51, 52, col, col)             # along the beam's front
        _px(k, u - 1, u + 1, -11, -9, 42, 51, "barBrass", "barBrass")              # the tap's body
        _px(k, u - 1, u + 1, -9, -5, 42, 44, "barBrass", "barBrass")               # its spout, over the counter
        _px(k, u, u + 1, -10, -9, 51, 55, col, col)                                # its handle in the line's colour
        _px(k, u - 3, u + 3, -9, -3, TOP, TOP + 1, "barGun", "barGun")             # drip tray
    _px(k, -1, 1, -7, -5, TOP + 1, TOP + 5, "barGlass", "barGlass")                # a glass under the middle tap
    _px(k, -1, 1, -7, -5, TOP + 1, TOP + 3, "barAmber", "barAmber")
    for u in STOOLS:
        _stool_round(k, u, "barAmber", "barAmber", "barSteel", "barGun")
    return k.build()


def d2():
    """D2 crate dive: a counter of three cargo crates under a plank top, a drum lying on a cradle on the bar with a
    tap and a mug under it, string lights between two poles, upturned crates for stools."""
    k = K("bar_d2", FP)
    for u0 in (-47, -15, 17):                                                      # crates
        _px(k, u0, u0 + 30, -16, 0, 0, TOP - 3, "barCrate", "barCrate")
        for z in (7, 14):                                                          # slats (1 px proud)
            _px(k, u0 + 1, u0 + 29, 0, 1, z, z + 1, "barCrateK", "barCrateK")
        for uu in (u0, u0 + 29):                                                   # corner battens
            _px(k, uu, uu + 1, 0, 1, 0, TOP - 3, "barCrateK", "barCrateK")
    _px(k, -48, 48, -18, 2, TOP - 3, TOP, "barPlank", "barPlank")                  # plank top
    for u in (30, 42):                                                             # the drum's cradle
        _px(k, u, u + 2, -12, -2, TOP, TOP + 4, "barGun", "barGun")
    _drum_u(k, 28, 46, -7, TOP + 9, "barDrum", "barDrum")                          # the drum, lying on it
    _px(k, 33, 35, -14, 0, TOP + 3, TOP + 15, "barHaz", "barHaz")                  # its hazard band
    _px(k, 36, 38, -1, 3, TOP + 5, TOP + 7, "barSteel", "barSteel")                # tap, out of its +v face
    _px(k, 36, 38, 1, 3, TOP + 3, TOP + 5, "barSteel", "barSteel")
    _px(k, 35, 39, 0, 3, TOP, TOP + 3, "barMug", "barMug")                         # a mug under it
    for u in (-47, 45):                                                            # the light poles
        _px(k, u, u + 2, -16, -14, TOP, 48, "barGun", "barGun")
    _px(k, -45, 45, -15, -14, 46, 47, "barGun", "barGun")                          # the wire
    for i, u in enumerate((-36, -20, -4, 12, 28)):
        _px(k, u, u + 1, -15, -14, 43, 46, ("barBulbY", "barBulbO", "barBulbM")[i % 3])
    for u in STOOLS:                                                               # upturned crates
        _px(k, u - 5, u + 5, SV - 5, SV + 5, 0, SEAT, "barCrate", "barCrate")
        _px(k, u - 5, u + 5, SV + 5, SV + 6, 5, 6, "barCrateK", "barCrateK")
    return k.build()


def d3():
    """D3 cooler bar: a pale counter whose top holds three ice wells, bottle necks standing in the ice; a frosted
    chiller tower behind it feeding the wells, a cold light at the kick, white tulip stools."""
    k = K("bar_d3", FP)
    _px(k, -48, 48, -15, -2, 0, 2, "barCold", "barCold")                           # kick
    _px(k, -48, 48, -2, -1, 0, 1, "barCyan")                                       # cold light along it
    _px(k, -48, 48, -16, 0, 2, TOP - 2, "barWhite", "barWhite")                    # body
    _px(k, -48, 48, -17, 3, TOP - 2, TOP, "barSteel", "barSteel")                  # top
    necks = ("barGreen", "barAmber", "barRed", "barGreen", "barAmber")
    for w, u in enumerate((-32, 0, 32)):                                           # ice wells
        _px(k, u - 11, u + 11, -14, -2, TOP, TOP + 1, "barGun", "barGun")          # the well's rim
        _px(k, u - 10, u + 10, -13, -3, TOP, TOP + 2, "barIce", "barIce")          # the ice
        for j, du in enumerate((-7, -3, 1, 5)):                                    # bottle necks in it
            dv = (-10, -6, -9, -5)[j]
            _px(k, u + du, u + du + 2, dv, dv + 2, TOP + 2, TOP + 6, necks[(w + j) % 5], necks[(w + j) % 5])
            _px(k, u + du, u + du + 2, dv, dv + 2, TOP + 6, TOP + 7, "barMug", "barMug")
    _px(k, -46, -30, -31, -19, 0, 44, "barWhite", "barWhite")                      # chiller tower, back left
    _px(k, -45, -31, -19, -18, 20, 38, "barCold", "barCold")                       # its grille (1 px proud)
    for z in range(22, 37, 3):
        _px(k, -45, -31, -18, -17, z, z + 1, "barSteel", "barSteel")
    _px(k, -46, -30, -31, -19, 44, 46, "barIce", "barIce")                         # frost on its top
    _px(k, -40, -36, -18, -17, 40, 42, "barCyan")                                  # status light
    for u in STOOLS:                                                               # tulip stools
        k.cyl(u / 32, SV / 32, 0, 4 / 32, 1 / ZPX, "barSteel", top="barSteel", sides=12)
        _px(k, u - 1, u + 1, SV - 1, SV + 1, 1, SEAT - 3, "barSteel", "barSteel")
        k.cyl(u / 32, SV / 32, (SEAT - 3) / ZPX, 3 / 32, 1 / ZPX, "barWhite", top="barWhite", sides=12, rtop=5 / 32)
        k.cyl(u / 32, SV / 32, (SEAT - 2) / ZPX, 5 / 32, 2 / ZPX, "barWhite", top="barWhite", sides=12)
    return k.build()


DESIGNS = {"c1": c1, "c2": c2, "c3": c3, "d1": d1, "d2": d2, "d3": d3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
