"""Exercise machine look study round 3 (family `exercise3`, preview only, r0): three new sci-fi machines on the 1 x 2
footprint, in the bunk's slate and red with off-white shells and a few small lit points. Round forms lying on their side
are real turned cylinders (`hcyl`), not pixel discs.

  z1 gyro hoop: a tall off-white hoop standing in a cradle of rollers, an inner slate hoop turning inside it with
     red grips and a foot plate, the user spun inside both
  z2 hover bike: a spin bike with no frame below the rider: a slim floor beam, two swept struts up to a red saddle and
     handlebars, and a smooth drum hub floating between them in place of the flywheel
  z3 climb wall: an endless climbing wall at the far end, a belt of hand-holds running over two rollers between slate
     pillars, a padded mat in front

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
import math

from . import core
from .barcounter_r3 import cyl, lathe
from .bunk_study import _px
from .exercise_r2 import SHELL, SHELL_D
from .exercise_study import FP, FRAME, FRAME_D, FRAME_L, LIT, PAD, PAD_D, RAIL, RUBBER, RUBBER_D
from .research_kit import ZPX, Bench, bar, ring

AXES = {"u": ((1, 0, 0), (0, 1, 0), (0, 0, 1)), "v": ((0, 1, 0), (0, 0, 1), (1, 0, 0))}   # axis, e1, e2


def hcyl(k, axis, a0, a1, b, z, r, col, cap=None, sides=16, r1=None):
    """A turned cylinder lying along `axis` ('u' or 'v') from a0 to a1, its centre line at (b, z): b is the other
    ground coordinate. All in px; r1 tapers it toward a1. Both ends capped (cap colour, default col)."""
    d, e1, e2 = AXES[axis]

    def pt(a, rad, t):
        c = [0.0, 0.0, 0.0]
        base = (a, b, z) if axis == "u" else (b, a, z)
        for i in range(3):
            c[i] = base[i] + rad * (math.cos(t) * e1[i] + math.sin(t) * e2[i])
        x, y = k.p(c[0] / 32, c[1] / 32)
        return core.G(x, y, c[2] / ZPX)

    ts = [math.pi / sides + i * math.tau / sides for i in range(sides)]
    bot = [pt(a0, r, t) for t in ts]
    top = [pt(a1, r if r1 is None else r1, t) for t in ts]
    for i in range(sides):
        j = (i + 1) % sides
        k.m.poly([bot[i], bot[j], top[j], top[i]], col, flip=True)
    k.m.poly(top[::-1], cap or col, flip=True)
    k.m.poly(bot, cap or col, flip=True)


def z1():
    k = Bench("ex_z1", FP)
    lathe(k, 0, 0, ((0, 14), (3, 14), (4, 12)), FRAME_D)                           # base
    _px(k, -12, 12, -20, 20, 0, 3, FRAME_D)                                        # cradle rails
    for v in (-15, 15):
        hcyl(k, "u", -8, 8, v, 6, 3, FRAME_L, cap=FRAME_D)                         # rollers under the hoop
    for v in (-19, 19):
        _px(k, -1, 1, v, v + 1, 3, 4, LIT)                                         # lamps on the rails
    C, R = 32 / ZPX, 26 / 32
    ring(k, "u", 0, 0, C, R, 32, 4 / 32, 3 / ZPX, SHELL)                           # outer hoop (v-z plane)
    ring(k, "u", 0, 0, C, R - 3 / 32, 32, 2 / 32, 1 / ZPX, SHELL_D)                # its inner lip
    ring(k, "v", 0, 0, C, 13 / 32, 24, 3 / 32, 2 / ZPX, FRAME)                     # inner hoop (u-z plane)
    for s in (-1, 1):
        hcyl(k, "u", s * 14, s * 12, 0, 32, 2, FRAME_D)                            # its pivots on the outer hoop
        _px(k, *sorted((s * 9, s * 12)), -1, 1, 40, 43, PAD)                       # red grips
    _px(k, -6, 6, -4, 4, 8, 10, FRAME_D)                                           # foot plate
    _px(k, -6, 6, -4, 4, 10, 11, PAD_D)
    return k.build()


def z2():
    k = Bench("ex_z2", FP)
    hcyl(k, "v", -24, 24, 0, 3, 3, FRAME_D, cap=FRAME)                             # floor beam
    for v in (-22, 22):
        hcyl(k, "u", -10, 10, v, 2, 2, RUBBER, cap=RUBBER_D)                       # its feet
    bar(k, (0, 14 / 32, 5 / ZPX), (0, 8 / 32, 26 / ZPX), 3 / 32, SHELL)            # rear strut to the saddle
    bar(k, (0, -18 / 32, 5 / ZPX), (0, -22 / 32, 38 / ZPX), 3 / 32, SHELL)         # front strut to the bars
    _px(k, -4, 4, 2, 13, 27, 29, PAD_D)                                            # saddle
    _px(k, -4, 4, 3, 12, 29, 31, PAD)
    _px(k, -11, 11, -24, -20, 38, 40, RAIL)                                        # handlebars
    for s in (-1, 1):
        _px(k, *sorted((s * 9, s * 11)), -20, -14, 38, 40, RUBBER_D)               # grips
    _px(k, -3, 3, -26, -22, 40, 43, FRAME_D)                                       # console
    _px(k, -2, 2, -22, -21, 41, 42, LIT)
    hcyl(k, "u", -4, 4, -8, 18, 9, SHELL, cap=SHELL_D, sides=20)                   # the floating drum hub
    for s in (-1, 1):
        hcyl(k, "u", s * 4, s * 5, -8, 18, 6, FRAME_D, sides=20)                   # its side plates
        hcyl(k, "u", s * 5, s * 6, -8, 18, 2.5, LIT, sides=12)                     # lit axle caps
        _px(k, *sorted((s * 6, s * 7)), -9, -1, 17, 19, RAIL)                      # crank arms
        _px(k, *sorted((s * 7, s * 11)), -3, 1, 16, 17, RUBBER_D)                  # pedals
    return k.build()


def z3():
    k = Bench("ex_z3", FP)
    for s in (-1, 1):
        _px(k, *sorted((s * 12, s * 16)), -32, -22, 0, 60, FRAME_D)                # pillars
        _px(k, *sorted((s * 12, s * 16)), -32, -22, 60, 63, FRAME)                 # their caps
        _px(k, *sorted((s * 12, s * 13)), -22, -21, 30, 32, LIT)                   # status lamps
    _px(k, -12, 12, -30, -28, 6, 57, FRAME)                                        # belt
    for z in (8, 56):
        hcyl(k, "u", -12, 12, -27, z, 4, SHELL, cap=SHELL_D)                       # rollers
    holds = ((-8, 14, PAD), (4, 18, SHELL), (-3, 24, PAD), (8, 28, PAD), (-9, 32, SHELL), (1, 36, PAD),
             (-5, 42, PAD), (7, 45, SHELL), (-1, 50, PAD))
    for u, z, c in holds:
        _px(k, u - 2, u + 2, -28, -25, z, z + 2, c)                                # hand-holds
    _px(k, -14, 14, -22, 28, 0, 2, RUBBER_D)                                       # mat
    _px(k, -14, 14, -22, 28, 2, 3, RUBBER)
    _px(k, -14, 14, 26, 28, 0, 3, PAD_D)                                           # its red edge
    return k.build()


DESIGNS = {"z1": z1, "z2": z2, "z3": z3}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
