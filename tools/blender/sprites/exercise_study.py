"""Exercise machine look study (family `exercise`, preview only, r0): three machines on a 1 x 2 footprint in the
approved bunk's scheme (slate frame, dark rubber, red pads), built on the pixel grid like the bunk (`_px`, no bevels).
Each faces -v: the user's back is to the camera.

  x1 treadmill: a long belt deck with side treads, a motor hood at the far end, two uprights to a console with a
     screen, handrails along the sides
  x2 exercise bike: a floor frame, a flywheel in a slate shroud at the far end, a crank and pedals, a red saddle on a
     post, handlebars and a small console
  x3 cable station: a tall frame at the far end holding a weight stack on guide rods, a pulley and cable down to a
     pull-down bar, a red padded bench in front

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall, seats 15."""
import math

from .bunk_study import _px
from .research_kit import Bench

FP = (1, 2)
FRAME, FRAME_D, FRAME_L, RAIL = "nvW5", "nvW6", "nvW3", "nvW2"
RUBBER, RUBBER_D = "dnW2", "dnW3"
PAD, PAD_D = "lvR", "lvRS"
SCREEN, LIT = "dnW3", "icG"


def disc_vz(k, u0, u1, cv, cz, r, col):
    """A disc in the v-z plane on the pixel grid: rows 1 px tall, u0..u1 thick."""
    for dz in range(-r, r):
        h = math.sqrt(max(r * r - (dz + 0.5) ** 2, 0))
        w = int(round(h))
        if w:
            _px(k, u0, u1, cv - w, cv + w, cz + dz, cz + dz + 1, col)


def x1():
    k = Bench("ex_x1", FP)
    _px(k, -12, 12, -24, 26, 0, 3, RUBBER)                                          # deck frame
    _px(k, -9, 9, -24, 25, 3, 4, RUBBER_D)                                         # belt
    for s in (-1, 1):
        _px(k, *sorted((s * 9, s * 12)), -24, 26, 3, 5, FRAME)                     # side treads
    _px(k, -12, 12, 25, 27, 0, 4, FRAME_D)                                         # rear roller cap
    _px(k, -12, 12, -31, -24, 0, 8, FRAME)                                         # motor hood
    _px(k, -12, 12, -24, -23, 2, 6, PAD)                                           # its red band
    for s in (-1, 1):
        u0, u1 = sorted((s * 10, s * 12))
        _px(k, u0, u1, -30, -28, 8, 42, FRAME_D)                                   # uprights
        _px(k, u0, u1, -28, -12, 32, 34, RAIL)                                     # handrails
        _px(k, u0, u1, -14, -12, 28, 32, RAIL)                                     # their front drop
    _px(k, -12, 12, -31, -26, 40, 46, FRAME)                                       # console
    _px(k, -8, 8, -26, -25, 41, 45, SCREEN)                                        # its screen (faces the runner,
    _px(k, -6, 2, -25, -24, 43, 44, LIT)                                           #  a lit readout line)
    _px(k, -12, 12, -29, -27, 37, 40, RAIL)                                        # grip bar under it
    return k.build()


def x2():
    k = Bench("ex_x2", FP)
    for v in (-22, 18):
        _px(k, -11, 11, v - 2, v + 2, 0, 3, RUBBER)                                # floor feet
    _px(k, -2, 2, -22, 18, 3, 6, FRAME_D)                                          # main beam
    _px(k, -4, 4, -30, -10, 6, 8, FRAME_D)                                         # flywheel cradle
    disc_vz(k, -3, 3, -20, 18, 10, FRAME)                                          # flywheel shroud
    disc_vz(k, -4, -3, -20, 18, 4, FRAME_L)                                        # its hub caps
    disc_vz(k, 3, 4, -20, 18, 4, FRAME_L)
    _px(k, -3, 3, -11, -8, 6, 18, FRAME_D)                                         # crank post
    _px(k, -7, 7, -10, -8, 12, 14, RAIL)                                           # crank arms
    for s in (-1, 1):
        _px(k, *sorted((s * 7, s * 10)), -12, -6, 11, 13, RUBBER_D)                # pedals
    _px(k, -2, 2, 6, 9, 6, 27, FRAME_D)                                            # seat post
    _px(k, -4, 4, 2, 13, 27, 29, PAD_D)                                            # saddle
    _px(k, -4, 4, 3, 12, 29, 31, PAD)
    _px(k, -2, 2, -24, -21, 26, 40, FRAME_D)                                       # handlebar post
    _px(k, -11, 11, -22, -18, 38, 40, RAIL)                                        # handlebars
    for s in (-1, 1):
        _px(k, *sorted((s * 9, s * 11)), -18, -12, 38, 40, RUBBER_D)               # grips
    _px(k, -4, 4, -26, -22, 40, 44, FRAME)                                         # console
    _px(k, -3, 3, -22, -21, 41, 43, LIT)
    return k.build()


def x3():
    k = Bench("ex_x3", FP)
    _px(k, -14, 14, -32, -26, 0, 3, RUBBER)                                        # base
    for s in (-1, 1):
        _px(k, *sorted((s * 12, s * 14)), -31, -27, 3, 62, FRAME_D)                # uprights
    _px(k, -14, 14, -31, -20, 60, 63, FRAME)                                       # top beam, reaching forward
    for s in (-1, 1):
        _px(k, *sorted((s * 6, s * 7)), -29, -28, 3, 58, RAIL)                     # guide rods
    for i, z in enumerate(range(3, 27, 3)):                                        # weight stack
        _px(k, -5, 5, -31, -26, z, z + 3, FRAME if i % 2 else FRAME_L)
    _px(k, -1, 1, -29, -28, 27, 60, RUBBER_D)                                      # cable up to the pulley
    _px(k, -2, 2, -24, -20, 56, 60, FRAME_L)                                       # pulley block
    _px(k, -1, 1, -23, -22, 40, 56, RUBBER_D)                                      # cable down
    _px(k, -14, 14, -24, -21, 38, 40, RAIL)                                        # pull-down bar
    for s in (-1, 1):
        _px(k, *sorted((s * 11, s * 14)), -24, -21, 37, 41, RUBBER_D)              # grips
    for v in (-12, 20):
        _px(k, -3, 3, v - 2, v + 2, 0, 12, FRAME_D)                                # bench legs
    _px(k, -6, 6, -16, 24, 12, 14, FRAME_D)                                        # bench frame
    _px(k, -6, 6, -16, 24, 14, 17, PAD)                                            # pad
    _px(k, -6, 6, 23, 24, 12, 17, PAD_D)
    _px(k, -10, 10, -14, -12, 6, 8, RUBBER_D)                                      # knee roller bar
    return k.build()


DESIGNS = {"x1": x1, "x2": x2, "x3": x3}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
