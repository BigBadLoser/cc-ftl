"""Exercise machine look study round 2 (family `exercise2`, preview only, r0): sci-fi machines on the 1 x 2 footprint.
The bunk's slate and red, plus off-white shells and a few small lit points (no light strips). Each faces -v.

  y1 omni pad: a round low-friction running dish on the front tile; a pylon behind it reaches over on an arm to hold
     a waist ring the runner stands in
  y2 mag rower: a slim rail with a sliding red seat; at the far end a rounded shell hides the magnetic drum, a lit
     ring on its side, a cable to the handle
  y3 field station: a round floor pad between two tapered emitter pylons, the grips held in their field; a console
     pillar behind

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
from .barcounter_r3 import cyl, lathe
from .bunk_study import _px
from .exercise_study import FP, FRAME, FRAME_D, FRAME_L, LIT, PAD, PAD_D, RAIL, RUBBER_D, SCREEN, disc_vz
from .research_kit import Bench, ring

Z = 39.19

SHELL, SHELL_D = "lvW2", "nvW2"


def y1():
    k = Bench("ex_y1", FP)
    lathe(k, 0, 10, ((0, 13), (2, 15), (4, 15)), FRAME_D)                          # the dish's base
    cyl(k, 0, 10, 4, 5, 14, RUBBER_D)                                              # running surface
    cyl(k, 0, 10, 5, 5.3, 6, FRAME_D)                                              # its centre ring
    for u in (-14, 14):
        _px(k, *sorted((u, u - 1 if u > 0 else u + 1)), 9, 11, 3, 4, LIT)          # rim lamps
    lathe(k, 0, -24, ((0, 7), (3, 7), (3, 5.5), (38, 4.5), (42, 3.5)), SHELL)      # pylon
    cyl(k, 0, -24, 14, 16, 5.6, FRAME_D)                                           # its band
    _px(k, -1, 1, -20, -19, 26, 28, LIT)                                           # status lamp
    _px(k, -3, 3, -27, -1, 40, 43, SHELL)                                          # arm over the dish
    _px(k, -2, 2, -3, 1, 32, 40, FRAME_D)                                          # its drop
    ring(k, "z", 0, 10 / 32, 30 / Z, 10 / 32, 16, 3 / Z, 2 / 32, FRAME)         # the waist ring
    ring(k, "z", 0, 10 / 32, 33 / Z, 10 / 32, 16, 1 / Z, 2.2 / 32, PAD)         # its red pad
    return k.build()


def y2():
    k = Bench("ex_y2", FP)
    _px(k, -2, 2, -22, 30, 3, 5, FRAME_L)                                          # rail
    for v in (-20, 28):
        _px(k, -9, 9, v - 2, v + 2, 0, 3, FRAME_D)                                 # feet
    disc_vz(k, -7, 7, -22, 12, 11, SHELL)                                          # shell
    disc_vz(k, 7, 8, -22, 12, 9, SHELL_D)                                          # side caps
    disc_vz(k, -8, -7, -22, 12, 9, SHELL_D)
    disc_vz(k, 8, 9, -22, 12, 4, FRAME_D)
    disc_vz(k, -9, -8, -22, 12, 4, FRAME_D)
    for dv, dz in ((0, 5), (0, -6), (5, 0), (-6, 0), (4, 4), (-5, 4), (4, -5), (-5, -5)):
        _px(k, 8, 9, -22 + dv, -21 + dv, 12 + dz, 13 + dz, LIT)                    # lit ring on the side
    _px(k, -7, 7, -12, -11, 4, 6, FRAME_D)                                         # shell foot
    for s in (-1, 1):
        _px(k, *sorted((s * 3, s * 9)), -12, -6, 6, 7, FRAME_D)                    # foot plates
        _px(k, *sorted((s * 3, s * 9)), -7, -6, 7, 12, PAD_D)                      # heel cups
    _px(k, -1, 1, -12, -6, 14, 15, RUBBER_D)                                       # cable to
    _px(k, -8, 8, -6, -4, 14, 16, RAIL)                                            # the handle
    _px(k, -4, 4, 8, 18, 5, 7, FRAME_D)                                            # seat carriage
    _px(k, -5, 5, 7, 19, 7, 10, PAD)                                               # seat
    _px(k, -3, 3, 26, 30, 5, 9, SHELL)                                             # rail end cap
    return k.build()


def y3():
    k = Bench("ex_y3", FP)
    lathe(k, 0, 8, ((0, 15), (2, 15), (3, 14)), FRAME_D)                           # floor pad
    cyl(k, 0, 8, 3, 3.3, 13, FRAME)
    cyl(k, 0, 8, 3.3, 3.6, 4, PAD)                                                 # standing mark
    for s in (-1, 1):
        u = s * 13
        lathe(k, u, 8, ((3, 3.5), (36, 2.2), (38, 2.2)), SHELL)                    # emitter pylons
        lathe(k, u, 8, ((38, 3), (42, 3), (44, 2)), FRAME_D)                       # emitter heads
        _px(k, *sorted((u - s * 2, u - s * 3)), 7, 9, 39, 41, LIT)                 # lit face, turned inward
        _px(k, *sorted((u - s * 2, u - s * 6)), 7, 9, 31, 33, RAIL)                # grips in the field
        cyl(k, u, 8, 16, 18, 2.9, PAD)                                             # red bands
    lathe(k, 0, -24, ((0, 6), (3, 6), (3, 4), (30, 4)), SHELL)                     # console pillar
    _px(k, -6, 6, -28, -20, 30, 33, FRAME_D)                                       # console
    _px(k, -5, 5, -21, -20, 33, 37, SCREEN)                                        # screen
    _px(k, -3, 2, -20, -19, 35, 36, LIT)
    return k.build()


DESIGNS = {"y1": y1, "y2": y2, "y3": y3}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
