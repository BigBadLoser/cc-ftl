"""Exercise machine look study round 6 (family `exercise6`, palette set gym, preview only, r0): the sparring droid
(round 5's v3, picked) in three takes. The droid stands on the far tile facing the camera (+v), a mat on the near tile.

  v3a guard droid: v3 cleaned up and bigger, a domed head with a lit visor band, a broad padded chest, articulated
     arms up in guard with big red gloves, on a gimbal post over a weighted dome base
  v3b drill column: a slimmer droid with four padded arms at two heights on turning collars, for strike drills
  v3c hover droid: no post: a round-bodied droid floating over a lit emitter base, two padded arms

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
import math

from .bunk_study import _px
from .exercise_r4 import FRAME, FRAME_D, LIT, PAD, PAD_D, RAIL, RUBBER_D, SHELL, SHELL_D, build, sweep
from .exercise_r5 import loop
from .exercise_study import FP
from .research_kit import Bench

V = -16                                                                            # the droid's v


def mat(k):
    _px(k, -14, 14, 0, 30, 0, 1, RUBBER_D)
    for v0, v1 in ((28, 30), (0, 2)):
        _px(k, -14, 14, v0, v1, 0, 2, PAD_D)


def base(k, top=26):
    sweep(k, [(0, V, 0, 12, 12), (0, V, 3, 11, 11), (0, V, 7, 6, 6), (0, V, 9, 3, 3)], FRAME_D, p=2.0)
    sweep(k, [(0, V, 9, 2, 2), (0, V, top, 2, 2)], RAIL)                           # post
    loop(k, 0, V, top, 6, 1.2, FRAME, plane="uv")                                  # gimbal ring
    _px(k, -1, 1, V + 10, V + 11, 3, 4, LIT)                                       # status lamp on the base


def head(k, z, w=5):
    sweep(k, [(0, V, z - 3, 2, 2), (0, V, z, 2, 2)], FRAME_D)                      # neck
    sweep(k, [(0, V, z, w - 1, w - 1), (0, V, z + 4, w, w), (0, V, z + 8, w - 1, w - 1), (0, V, z + 10, 2, 2),
              (0, V, z + 10.5, 0.5, 0.5)], SHELL, p=2.2)                            # dome
    sweep(k, [(-w + 1, V + w - 1.5, z + 5, 1, 0.9), (0, V + w + 0.3, z + 5, 1, 0.9), (w - 1, V + w - 1.5, z + 5, 1, 0.9)],
          LIT, p=2.0)                                                              # visor band round its front


def arm(k, s, sh, el, fist, glove=4.0):
    """An arm on side s: shoulder ball, upper arm to the elbow, forearm to a padded glove."""
    sweep(k, [(s * sh[0], V + sh[1], sh[2], 3.5, 3.5), (s * (sh[0] + 1), V + sh[1], sh[2] + 1, 3, 3)], SHELL, p=2.2)
    sweep(k, [(s * sh[0], V + sh[1], sh[2], 2.2, 2.2), (s * el[0], V + el[1], el[2], 2, 2)], FRAME)
    sweep(k, [(s * el[0], V + el[1], el[2], 2, 2), (s * fist[0], V + fist[1], fist[2], 1.8, 1.8)], FRAME)
    sweep(k, [(s * fist[0], V + fist[1] - 1, fist[2] - 1, glove * 0.7, glove * 0.7),
              (s * fist[0], V + fist[1] + 1, fist[2] + 1, glove, glove),
              (s * fist[0], V + fist[1] + 3, fist[2] + 2, glove * 0.6, glove * 0.6)], PAD, p=2.2)


def v3a():
    k = Bench("ex_v3a", FP)
    base(k)
    sweep(k, [(0, V, 26, 5, 4), (0, V, 31, 9, 5.5), (0, V, 41, 11, 6), (0, V, 48, 8, 5)], SHELL, p=2.6,
          cap0=SHELL_D)                                                            # torso
    sweep(k, [(0, V + 4, 31, 6, 2), (0, V + 5, 37, 8, 2.4), (0, V + 5, 44, 7, 2.2)], PAD, p=3)   # chest pad
    head(k, 50)
    for s in (-1, 1):
        arm(k, s, (11, 0, 45), (13, 5, 36), (7, 11, 44), glove=4.2)
    mat(k)
    return build(k)


def v3b():
    k = Bench("ex_v3b", FP)
    base(k, top=12)
    sweep(k, [(0, V, 12, 4.5, 4.5), (0, V, 50, 4, 4)], SHELL, p=2.2, cap0=SHELL_D)   # column body
    for z in (26, 40):
        loop(k, 0, V, z, 5.2, 1.4, FRAME_D, plane="uv")                           # turning collars
        for i, a in enumerate((0.5, math.pi - 0.5)):                                # two padded arms on each
            a += 0.3 if z == 40 else -0.3
            tip = (13 * math.cos(a), V + 13 * math.sin(a), z + (2 if z == 40 else -2))
            sweep(k, [(5 * math.cos(a), V + 5 * math.sin(a), z, 1.8, 1.8), (*tip, 1.6, 1.6)], RAIL)
            sweep(k, [(tip[0] * 0.9, tip[1] - 1, tip[2], 2.6, 2.6), (tip[0] * 1.05, tip[1] + 2, tip[2], 3.4, 3.4),
                      (tip[0] * 1.1, tip[1] + 4, tip[2], 2, 2)], PAD, p=2.2)
    head(k, 52, w=4.5)
    _px(k, -2, 2, V + 4, V + 5, 30, 34, LIT)                                       # strike target lamp
    mat(k)
    return build(k)


def v3c():
    k = Bench("ex_v3c", FP)
    sweep(k, [(0, V, 0, 11, 11), (0, V, 2, 10, 10), (0, V, 4, 7, 7)], FRAME_D, p=2.0)   # emitter base
    loop(k, 0, V, 4.5, 7, 1, LIT, plane="uv")                                      # its lit ring
    sweep(k, [(0, V, 20, 4, 4), (0, V, 24, 8, 8), (0, V, 34, 10, 9), (0, V, 42, 8, 7), (0, V, 45, 3, 3)], SHELL,
          p=2.2, cap0=SHELL_D)                                                     # round floating body
    loop(k, 0, V, 33, 10.2, 1.2, FRAME_D, plane="uv")                              # its waist band
    sweep(k, [(0, V, 20, 3, 3), (0, V, 17, 1.5, 1.5)], FRAME_D)                     # thruster nub under it
    sweep(k, [(-5, V + 7, 38, 1, 0.9), (0, V + 9.3, 38, 1, 0.9), (5, V + 7, 38, 1, 0.9)], LIT, p=2.0)  # visor
    sweep(k, [(0, V + 7, 26, 5, 2), (0, V + 8, 32, 6, 2)], PAD, p=3)                # chest pad
    for s in (-1, 1):
        arm(k, s, (10, 0, 34), (13, 5, 28), (7, 11, 36), glove=4.0)
    mat(k)
    return build(k)


DESIGNS = {"v3a": v3a, "v3b": v3b, "v3c": v3c}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
