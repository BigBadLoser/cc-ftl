"""Bar counter look study round 5 (family `barcounter5`, palette set bar4, preview only; frame and heights in
barcounter_study.py): three new designs in round 4's muted materials, each with a clear drink source behind or on it.

  g1 galley bar: a steel-topped counter with ribbed front panels and a tap tower; behind it a tall steel cooler with
     a glass door, shelves of bottles inside
  g2 brew bar: two copper brew tanks with sight glasses behind a wood-fronted counter, piped to a row of copper taps
  g3 rack bar: a counter under an overhead rack of hanging glasses on two posts, a low bottle cabinet behind it

All in px of the tile (u -48..48, v -32..32, z up), counter top 24, seats 15."""
from .barcounter_r3 import cyl, lathe
from .barcounter_r4 import drink, stool
from .barcounter_study import FP, STOOLS, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

BOTTLES = ("b4Drink", "b4Wine", "b4Green", "b4Copper")


def bottle(k, u, v, z, col, h=7):
    cyl(k, u, v, z, z + h - 2, 1.5, col)
    cyl(k, u, v, z + h - 2, z + h, 0.6, col)


def counter(k, body, top, u0=-48, u1=48, kick="b4Gun"):
    _px(k, u0, u1, -15, -2, 0, 2, kick)                                             # recessed plinth
    _px(k, u0, u1, -16, 0, 2, TOP - 2, body)                                       # body
    _px(k, u0, u1, -17, 2, TOP - 2, TOP, top)                                      # top, overhanging the front


def tap_tower(k, g, u, v, n=3, col="b4Steel", pour=1):
    """A T tower on the counter: a post, a crossbar along u and n taps hanging from it, a drip tray under them."""
    _px(k, u - 1, u + 1, v - 1, v + 1, TOP, 36, col)
    w = 4 * n
    _px(k, u - w // 2, u + w // 2, v - 1, v + 1, 33, 36, col)
    _px(k, u - w // 2, u + w // 2, v + 1, v + 5, TOP, TOP + 1, "b4Gun")             # drip tray
    for i in range(n):
        tu = u - w // 2 + 2 + 4 * i
        _px(k, tu - 1, tu, v + 1, v + 3, 31, 33, col)                              # spout
        _px(k, tu - 1, tu, v - 2, v - 1, 36, 40, "b4Wood")                         # handle
    tu = u - w // 2 + 2 + 4 * pour
    drink(k, g, tu - 0.5, v + 3, TOP + 1, "b4Drink")


def g1():
    k = Bench("bar_g1", FP)
    g = k.part("glass")
    # the cooler, behind the counter's left half: a hollow ceramic case with a glass door facing the counter
    _px(k, -48, -12, -32, -29, 0, 50, "b4Steel")                                   # back
    _px(k, -48, -45, -29, -19, 0, 50, "b4Steel")                                   # sides
    _px(k, -15, -12, -29, -19, 0, 50, "b4Steel")
    _px(k, -45, -15, -29, -19, 0, 22, "b4Steel")                                   # base (hidden by the counter)
    _px(k, -48, -12, -32, -19, 46, 50, "b4Steel")                                  # top
    _px(k, -45, -15, -29, -28, 22, 46, "b4Navy")                                   # dark inside
    for zs in (26, 36):                                                            # shelves of bottles
        _px(k, -45, -15, -29, -20, zs - 1, zs, "b4Bronze")
        for j, u in enumerate(range(-42, -16, 5)):
            bottle(k, u, -24, zs, BOTTLES[(j + zs) % 4], 7 if zs == 26 else 6)
    _px(k, -32, -28, -28, -27, 44, 45, "b4Lamp")                                   # its lamp
    g.box(-30 / 32, -18.5 / 32, 22 / ZPX, 30 / 32, 1 / 32, 24 / ZPX, "b4Glass", top="b4Glass")   # the door
    _px(k, -45, -44, -18, -17, 24, 44, "b4Steel")                                  # its handle
    counter(k, "b4Gun", "b4Steel")
    for u in range(-44, 45, 8):                                                    # ribbed front panels
        _px(k, u, u + 2, 0, 1, 4, TOP - 4, "b4Top")
    _px(k, -48, 48, 0, 1, TOP - 4, TOP - 3, "b4Bronze")
    tap_tower(k, g, 20, -10)
    drink(k, g, -24, -6, TOP, "b4Wine")
    for u in STOOLS:
        stool(k, u, "b4Steel", "b4Seat")
    return k.build()


def g2():
    k = Bench("bar_g2", FP)
    g = k.part("glass")
    for u in (-30, -8):                                                            # two brew tanks
        for du in (-5, 5):
            _px(k, u + du - 1, u + du + 1, -26, -24, 0, 6, "b4Gun")                # legs
        lathe(k, u, -25, ((6, 5), (8, 8), (40, 8), (44, 6.5), (47, 3.5), (48, 1.5), (50, 1.5)), "b4Copper")
        cyl(k, u, -25, 20, 22, 8.3, "b4Bronze")                                    # a band
        _px(k, u - 1, u + 1, -17.5, -16.5, 26, 40, "b4Drink")                      # sight glass, the brew in it
        _px(k, u - 1, u + 1, -26, -24, 50, 52, "b4Copper")                         # pipe up from the dome
    _px(k, -31, 10, -26, -24, 52, 54, "b4Copper")                                  # the run across the tops
    _px(k, 8, 10, -26, -14, 52, 54, "b4Copper")                                    # and forward
    _px(k, 8, 10, -16, -14, TOP, 52, "b4Copper")                                   # down to the manifold
    counter(k, "b4Wood", "b4Steel", kick="b4Copper")
    for u in range(-44, 45, 12):                                                   # panel seams on the wood
        _px(k, u, u + 1, 0, 1, 3, TOP - 3, "b4Bronze")
    _px(k, 8, 40, -14, -12, 30, 32, "b4Copper")                                    # manifold along the counter
    for i, u in enumerate(range(13, 40, 6)):
        _px(k, u - 1, u + 1, -12, -9, 29, 31, "b4Copper")                          # taps
        _px(k, u - 1, u, -14, -13, 32, 36, "b4Wood")                               # handles
    _px(k, 10, 40, -10, -6, TOP, TOP + 1, "b4Gun")                                 # drip tray
    drink(k, g, 18.5, -8, TOP + 1, "b4Drink")
    _px(k, 30, 40, -30, -22, 0, 30, "b4Gun")                                       # the brewer's control box
    _px(k, 33, 35, -22, -21, 24, 26, "b4Lamp")
    drink(k, g, -24, -6, TOP, "b4Drink")
    for u in STOOLS:
        stool(k, u, "b4Copper", "b4Seat")
    return k.build()


def g3():
    k = Bench("bar_g3", FP)
    g = k.part("glass")
    _px(k, -48, 48, -32, -24, 0, 26, "b4Gun")                                      # low back cabinet
    _px(k, -48, 48, -32, -23, 26, 28, "b4Top")
    for j, u in enumerate(range(-44, 45, 6)):                                      # bottles on it
        bottle(k, u, -28, 28, BOTTLES[j % 4])
    counter(k, "b4Navy", "b4Wood")
    _px(k, -48, 48, 0, 1, TOP - 5, TOP - 4, "b4Bronze")                            # foot-rail line
    for su in (-1, 1):                                                             # the rack's posts
        _px(k, su * 46 - 1, su * 46 + 1, -9, -7, TOP, 58, "b4Steel")
    _px(k, -47, 47, -12, -4, 56, 58, "b4Gun")                                      # the rack
    _px(k, -47, 47, -12, -11, 58, 59, "b4Steel")
    _px(k, -47, 47, -5, -4, 58, 59, "b4Steel")
    for j, u in enumerate(range(-38, 39, 6)):                                      # glasses hanging from it
        cyl(g, u, -8, 49, 54, 1.6, "b4Glass")
        _px(k, u, u + 1, -8, -7, 54, 56, "b4Steel")
    for u in (-20, 20):
        _px(k, u - 1, u + 1, -9, -7, 55, 56, "b4Lamp")                             # lamps under the rack
    tap_tower(k, g, 0, -10, n=2, pour=0)
    drink(k, g, -28, -6, TOP, "b4Wine")
    drink(k, g, 28, -6, TOP, "b4Green")
    for u in STOOLS:
        stool(k, u, "b4Navy", "b4Seat")
    return k.build()


DESIGNS = {"g1": g1, "g2": g2, "g3": g3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
