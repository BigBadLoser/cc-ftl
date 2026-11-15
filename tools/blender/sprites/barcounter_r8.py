"""Bar look study round 8 (family `barcounter8`, palette set bar8, preview only; heights as barcounter_study.py: counter
top 24 px, stool seats 15): three shipboard formats built from station hardware, each with its own source of drink.

  k1 cryo bar (3x2): a white panelled counter, its frosted top lit cyan from below; behind it a frame of three frosted
     cryo canisters banded in cyan, piped over the top into a three-tap tower on the counter; a holo menu on a post
  k2 lab bar (3x2): a steel lab bench; behind it a back bench with a lit rack of glowing test tubes, a round-bottom flask
     on a cyan burner piped to a beaker, and a centrifuge; conical flasks of drink on the counter
  k3 fuel bar (3x2): a hazard-chevroned counter; behind it two refuelling pumps with lit displays, their hoses looped down
     to nozzles, one filling a glass on the counter; a pair of banded fuel tanks lying behind them

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r3 import cyl, lathe
from .barcounter_r6 import bottle, seg3, stool
from .barcounter_r7 import hcyl
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench

FP3 = (3, 2)


def hose(k, pts, w, col):
    for a, b in zip(pts, pts[1:]):
        seg3(k, a, b, w, col)


def glass(k, g, u, v, col, h=6):
    cyl(g, u, v, TOP, TOP + h, 1.8, "r8Glass")
    cyl(k, u, v, TOP, TOP + h - 2, 1.5, col)


def counter(k, body, top, seams):
    _px(k, -48, 48, -15, -2, 0, 2, "r8Char")                                         # plinth
    _px(k, -48, 48, -16, 0, 2, TOP - 2, body)
    for u in (-16, 16):
        _px(k, u, u + 1, 0, 1, 4, TOP - 4, seams)                                    # panel seams
    _px(k, -49, 49, -17, 2, TOP - 2, TOP, top)


# ---- k1 cryo bar --------------------------------------------------------------------------------------------------
def k1():
    k = Bench("bar_k1", FP3)
    g = k.part("glass")
    counter(k, "r8White", "r8Steel", "r8Grey")
    _px(k, -47, 47, -17, 1, TOP - 3, TOP - 2, "r8Cyan")                              # light under the top
    _px(g, -49, 49, -17, 2, TOP, TOP + 1, "r8Frost")                                 # frosted top
    _px(k, -46, 46, 0, 0.6, 3, 4, "r8Cyan")                                          # a kick light
    # the canister frame
    _px(k, -44, 10, -32, -20, 0, 3, "r8Grey")
    for u in (-44, 8):
        _px(k, u, u + 2, -31, -21, 3, 50, "r8Grey")
    _px(k, -44, 10, -31, -21, 50, 52, "r8Grey")
    for u in (-34, -18, -2):
        cyl(k, u, -26, 3, 6, 5.5, "r8Steel")
        cyl(k, u, -26, 6, 42, 5, "r8Frost")                                          # the canister
        for z in (14, 30):
            cyl(k, u, -26, z, z + 2, 5.3, "r8Cyan")                                  # lit bands
        cyl(k, u, -26, 42, 46, 3, "r8Steel")                                         # its valve head
        seg3(k, (u, -26, 46), (u, -26, 48), 1.6, "r8Steel")
    hose(k, ((-34, -26, 48), (-2, -26, 48), (-8, -26, 48), (-8, -14, 48), (-8, -10, TOP + 16)), 1.8, "r8Steel")
    cyl(k, -8, -10, TOP, TOP + 18, 2, "r8Grey")                                      # the tap tower
    cyl(k, -8, -10, TOP + 18, TOP + 20, 3, "r8Cyan")
    for du, col in ((-4, "r8Cyan"), (0, "r8Steel"), (4, "r8Cyan")):
        _px(k, -8 + du - 0.7, -8 + du + 0.7, -9, -5, TOP + 12, TOP + 13.4, "r8Steel")  # spouts
    # holo menu at the right: a post and a tilted lit pane
    cyl(k, 30, -24, 0, 2, 4, "r8Char")
    cyl(k, 30, -24, 2, 34, 0.9, "r8Grey")
    _px(k, 24, 36, -25, -24, 34, 50, "r8Holo")
    for z in (38, 42, 46):
        _px(k, 26, 34, -24, -23.6, z, z + 1, "r8White")
    for u, col in ((-30, "r8Cyan"), (14, "r8Amber"), (28, "r8Cyan")):
        glass(k, g, u, -6, col)
    for u in (-32, 0, 32):
        stool(k, u, 16, "r8White", stem="r8Grey")
    return k.build()


# ---- k2 lab bar ---------------------------------------------------------------------------------------------------
def flask(k, g, u, v, z, col, s=1.0):
    lathe(g, u, v, ((z, 4 * s), (z + 5 * s, 1.5 * s), (z + 8 * s, 1.2 * s)), "r8Glass")
    lathe(k, u, v, ((z, 3.6 * s), (z + 3 * s, 2.2 * s)), col)


def k2():
    k = Bench("bar_k2", FP3)
    g = k.part("glass")
    counter(k, "r8Steel", "r8Char", "r8Grey")
    for u in (-40, -8, 24):
        _px(k, u, u + 12, 0, 0.6, 14, 15, "r8Grey")                                  # drawer pulls
    # back bench, raised so its kit shows over the counter
    B = TOP + 8
    _px(k, -48, 48, -32, -20, 0, B - 2, "r8Grey")
    _px(k, -48, 48, -32, -19, B - 2, B, "r8White")
    # a lit rack of test tubes at the left
    _px(k, -44, -18, -30, -24, B, B + 2, "r8Holo")                               # light box
    for i, u in enumerate(range(-42, -19, 4)):
        col = ("r8Cyan", "r8Lime", "r8Pink", "r8Amber")[i % 4]
        cyl(g, u, -27, B + 2, B + 16, 1.4, "r8Glass")
        cyl(k, u, -27, B + 2, B + 8 + (i * 5) % 7, 1.1, col)
    _px(k, -44, -18, -29, -25, B + 11, B + 12, "r8Steel")                        # rack rail
    # round-bottom flask on a burner, a glass tube to a beaker
    cyl(k, -4, -26, B, B + 6, 3, "r8Steel")
    cyl(k, -4, -26, B + 6, B + 7, 2.6, "r8Cyan")                                 # burner ring
    lathe(g, -4, -26, ((B + 7, 1), (B + 9, 5), (B + 13, 6), (B + 17, 4), (B + 19, 1.4), (B + 26, 1.2)),
          "r8Glass", sides=16)
    lathe(k, -4, -26, ((B + 7.5, 1), (B + 9, 4.4), (B + 11, 5.4), (B + 13, 5.6), (B + 14, 5.2)), "r8Pink",
          sides=16)
    hose(g, ((-4, -26, B + 26), (4, -24, B + 28), (12, -24, B + 18)), 1.2, "r8Glass")
    cyl(g, 12, -24, B, B + 10, 3.4, "r8Glass")                                   # the beaker
    cyl(k, 12, -24, B, B + 5, 3, "r8Pink")
    # a centrifuge at the right
    cyl(k, 34, -26, B, B + 6, 7, "r8Grey", sides=20)
    lathe(k, 34, -26, ((B + 6, 7), (B + 8, 6), (B + 9, 3)), "r8Steel", sides=20)
    _px(k, 31, 37, -19.5, -18.8, B + 1, B + 4, "r8Lime")                         # its display
    # on the counter
    for u, col in ((-30, "r8Cyan"), (-14, "r8Lime"), (20, "r8Amber"), (30, "r8Pink")):
        flask(k, g, u, -7, TOP, col)
    for u in (-32, 0, 32):
        stool(k, u, 16, "r8Char", stem="r8Steel")
    return k.build()


# ---- k3 fuel bar --------------------------------------------------------------------------------------------------
def k3():
    k = Bench("bar_k3", FP3)
    g = k.part("glass")
    counter(k, "r8Char", "r8Grey", "r8Char")
    for u in range(-46, 46, 8):                                                      # hazard chevrons on the front
        _px(k, u, u + 4, 0, 0.6, 5, TOP - 6, "r8Hivis")
    # fuel tanks lying at the back
    for v in (-28,):
        for u0, u1 in ((-46, -2), (2, 46)):
            hcyl(k, u0, u1, v, 8, 6, "r8Grey")
            for a in (u0 + 3, u1 - 6):
                hcyl(k, a, a + 3, v, 8, 6.5, "r8Red")
            _px(k, u0 + 4, u0 + 4 + 2, v - 6, v + 6, 0, 2, "r8Char")                 # cradles
            _px(k, u1 - 6, u1 - 4, v - 6, v + 6, 0, 2, "r8Char")
    # two pumps standing on the tanks' line
    for pu, col in ((-22, "r8Cyan"), (22, "r8Amber")):
        _px(k, pu - 7, pu + 7, -25, -17, 0, 50, "r8Hivis")                           # the pump body
        _px(k, pu - 7, pu + 7, -25, -17, 50, 53, "r8Char")
        _px(k, pu - 5, pu + 5, -17, -16.4, 38, 47, "r8Char")                         # display bezel
        _px(k, pu - 4, pu + 4, -16.4, -16, 39, 46, col)                              # lit display
        cyl(k, pu, -16, 30, 34, 2, "r8White")                                        # a gauge
        _px(k, pu - 7, pu + 7, -17, -16.6, 10, 12, "r8Char")
        # hose from the pump's side, looped down to the counter
        hose(k, ((pu + 7, -20, 32), (pu + 10, -16, 26), (pu + 10, -12, TOP + 4), (pu + 6, -9, TOP + 10)), 2.4, "r8Char")
    # the left nozzle fills a glass; the right one sits in a holster on the counter
    _px(k, -18, -15, -11, -6, TOP + 8, TOP + 12, "r8Hivis")
    seg3(k, (-15, -8, TOP + 9), (-12, -6, TOP + 7), 1.4, "r8Steel")
    _px(k, -12.5, -11.5, -6.5, -5.5, TOP + 5, TOP + 7, "r8Cyan")                     # the pour
    glass(k, g, -12, -6, "r8Cyan")
    _px(k, 26, 30, -12, -6, TOP, TOP + 4, "r8Char")                                  # holster
    _px(k, 26, 30, -11, -7, TOP + 4, TOP + 9, "r8Hivis")
    for u, col in ((-34, "r8Amber"), (6, "r8Cyan"), (38, "r8Amber")):
        glass(k, g, u, -6, col)
    for u in (-32, 0, 32):
        stool(k, u, 16, "r8Red", stem="r8Char")
    return k.build()


DESIGNS = {"k1": (FP3, k1), "k2": (FP3, k2), "k3": (FP3, k3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
