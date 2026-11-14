"""Exercise look study round 8 (family `exercise8`, palette set gym, preview only, r0): the sparring droid, V3 with no
chest pad and no mat (V3f, picked), with a head that reads against the white body and arms built as jointed machinery.

  v3g dark head: a slate head and neck collar with the lit visor slit; each arm hangs off a shoulder socket sunk in the
     torso, a grey upper arm to a pivot pin at the elbow, a grey forearm through a wrist collar to the glove
  v3h faceplate: the white head kept, a dark faceplate wrapping its front with the lit slit in it; the arms hang off a
     slate yoke running through the shoulders, pivot discs at its ends, a piston beside each upper arm
  v3i cyclops: a mid-slate helmet, a dark face with one round lit eye; ball joints at shoulder, elbow and wrist

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
import math

from .exercise_r3 import hcyl
from .exercise_r4 import FRAME, FRAME_D, LIT, PAD, RAIL, SHELL, SHELL_D, build, sweep
from .exercise_r5 import loop, v3
from .exercise_study import FP
from .research_kit import Bench

V = -18                                                                            # the droid's v
SH, EL, WR, FI = (10, 0, 43), (13, 4, 34), (9, 9, 40), (8, 11, 43)                # shoulder, elbow, wrist, fist


def at(s, p):
    return (s * p[0], V + p[1], p[2])


def body(k):
    sweep(k, [(0, V, 0, 11, 11), (0, V, 3, 10, 10), (0, V, 6, 6, 6), (0, V, 8, 3, 3)], FRAME_D, p=2.0)   # base
    sweep(k, [(0, V, 8, 2, 2), (0, V, 24, 2, 2)], RAIL)                            # post
    loop(k, 0, V, 24, 6, 1, FRAME, plane="uv")                                     # gimbal ring
    sweep(k, [(0, V, 24, 5, 3.5), (0, V, 30, 8, 5), (0, V, 40, 9, 5.5), (0, V, 46, 6, 4)], SHELL, p=2.6,
          cap0=SHELL_D)                                                            # torso


def head(k, shell, face=None, eye="slit", collar=True):
    if collar:
        loop(k, 0, V, 46.5, 4, 1.2, FRAME_D, plane="uv")                           # neck collar
    sweep(k, [(0, V, 46, 2, 2), (0, V, 49, 2, 2)], FRAME_D)                        # neck
    sweep(k, [(0, V, 49, 4, 4), (0, V, 53, 5, 4.5), (0, V, 57, 3, 3), (0, V, 58, 1, 1)], shell, p=2.4)
    if face:                                                                       # a faceplate round the front
        arc = [(5.2 * math.sin(t), V + 4.7 * math.cos(t), 53, 0.8, 2.6) for t in (-1.1, -0.55, 0, 0.55, 1.1)]
        sweep(k, arc, face, p=3)
    if eye == "slit":
        arc = [(5.6 * math.sin(t), V + 5.1 * math.cos(t), 53.5, 0.5, 0.7) for t in (-0.8, -0.4, 0, 0.4, 0.8)]
        sweep(k, arc, LIT, p=2.0)
    else:                                                                          # one round eye
        sweep(k, [(0, V + 4.6, 53.5, 1.5, 1.5), (0, V + 5.6, 53.5, 1.3, 1.3)], LIT, p=2.0)


def glove(k, s):
    f = at(s, FI)
    sweep(k, [(f[0], f[1] - 1, f[2] - 1, 2.8, 2.8), (f[0], f[1] + 1, f[2] + 1, 4, 4), (f[0], f[1] + 3, f[2] + 2, 2.4, 2.4)],
          PAD, p=2.2)


def limb(k, a, b, r=1.8, col=RAIL):
    sweep(k, [(*a, r, r), (*b, r, r)], col)


def v3g():
    k = Bench("ex_v3g", FP)
    body(k)
    head(k, FRAME_D)
    for s in (-1, 1):
        hcyl(k, "u", s * 6, s * 12, V, 43, 3.2, FRAME_D, cap=FRAME)                # shoulder socket in the torso
        limb(k, at(s, (12, 0, 42)), at(s, EL), 2)                                  # upper arm
        hcyl(k, "u", s * 11, s * 15, V + 4, 34, 2.2, FRAME_D, cap=FRAME)           # elbow pin
        limb(k, at(s, EL), at(s, WR))                                              # forearm
        limb(k, at(s, WR), at(s, (8.5, 10, 41.5)), 2.4, FRAME_D)                   # wrist collar
        glove(k, s)
    return build(k)


def v3h():
    k = Bench("ex_v3h", FP)
    body(k)
    head(k, SHELL, face=FRAME_D)
    hcyl(k, "u", -12, 12, V, 43, 2.2, FRAME_D, cap=FRAME)                          # shoulder yoke through the torso
    for s in (-1, 1):
        hcyl(k, "u", s * 12, s * 14, V, 43, 3.4, FRAME, cap=FRAME_D)               # pivot disc
        limb(k, at(s, (13, 0, 42)), at(s, EL), 2)                                  # upper arm
        limb(k, at(s, (14.5, 1, 41)), at(s, (14.5, 4, 36)), 0.8, FRAME_D)          # piston beside it
        hcyl(k, "u", s * 11, s * 15, V + 4, 34, 2.2, FRAME_D, cap=FRAME)           # elbow pin
        limb(k, at(s, EL), at(s, WR))
        limb(k, at(s, WR), at(s, (8.5, 10, 41.5)), 2.4, FRAME_D)
        glove(k, s)
    return build(k)


def ball(k, p, r):
    sweep(k, [(p[0], p[1], p[2] - r, 0.5, 0.5), (p[0], p[1], p[2] - r * 0.6, r * 0.8, r * 0.8), (*p, r, r),
              (p[0], p[1], p[2] + r * 0.6, r * 0.8, r * 0.8), (p[0], p[1], p[2] + r, 0.5, 0.5)], FRAME_D, p=2.0)


def v3i():
    k = Bench("ex_v3i", FP)
    body(k)
    head(k, FRAME, face=FRAME_D, eye="round")
    for s in (-1, 1):
        ball(k, at(s, (10.5, 0, 43)), 3.2)                                         # shoulder ball
        limb(k, at(s, (11, 0, 42)), at(s, EL), 2)
        ball(k, at(s, EL), 2.4)                                                    # elbow ball
        limb(k, at(s, EL), at(s, WR))
        ball(k, at(s, WR), 2)                                                      # wrist ball
        glove(k, s)
    return build(k)


DESIGNS = {"v3f": lambda: v3(chest=False, mat=False, name="ex_v3f"),            # (the pick, for comparison)
           "v3g": v3g, "v3h": v3h, "v3i": v3i}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
