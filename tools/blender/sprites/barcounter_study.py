"""Bar counter look study (family `barcounter`, preview only): a straight 3x2 module, r0. The counter fills the back row
(the bartender's side behind it), three stools stand on the front row where crew sit facing it. Its ends are plain
flat faces at the footprint's edge, so a corner piece can butt against them later.

Local frame modkit.K, footprint (3, 2), in px of the tile (bunk_study._px): u -48..48 across, v -32..32 deep, front
+v (toward the camera at r0); heights in px (crew are about 59 px tall). Counter top at 30 px, stool seats at 19."""
import math

from .bunk_study import _px
from .modkit import K

FP = (3, 2)
TOP, SEAT = 30, 19
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


DESIGNS = {"c1": c1, "c2": c2, "c3": c3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
