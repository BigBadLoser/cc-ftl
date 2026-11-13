"""Exercise look study round 25 (family `exercise12`, palette set gym, preview only, r0 at round 5's turn): three more
takes on the sparring droid, mixing what was liked: the round droid's head (white ear plates, T visor, green eyes), the
heavy robot's forward lean, and a guard held forward off the chest.

  v6a round + lean: the round droid tipped forward 12 degrees at the waist like the heavy robot, dark arms with white
     joint discs, the guard pushed forward
  v6b athletic: a V-shaped torso (narrow waist, broad chest), leaning 10 degrees, the same forward guard
  v6c heavy + round head: the heavy robot (V4b, lean and reach of V4t) with smaller shoulder plates and the round droid's
     white ear plates on its sensor head

Sweep parts in px of the droid frame (exercise_r9.D); robot parts in tiles (exercise_r10)."""
import math

from . import exercise_r9 as R9
from . import exercise_r10 as R10
from .exercise_r4 import build
from .exercise_r9 import glove, head_plates, sw, turned
from .exercise_study import FP
from .research_kit import Bench

SHELL, SHELL_D, DARK, MID = "gymShell", "gymShellD", "gymSlateD", "gymSlate"
EYE = "gymEyeG"


def stand(k):
    R10.stand(k)


def disc(k, x, y, z, r):
    sw(k, [(x - 1, y, z, r), (x + 1, y, z, r)], SHELL, p=2.0, cap0=SHELL_D, cap1=SHELL_D)
    sw(k, [(x + math.copysign(1, x), y, z, r * 0.38), (x + math.copysign(1.6, x), y, z, r * 0.38)], DARK, p=2.0)


def guard_arms(k, sh=(11, 0, 43), el=(14, 6, 35), wr=(10, 12, 40), fist=(8, 15, 43.5)):
    """Dark arms, white discs at shoulder and elbow, the guard held forward of the chest."""
    for s in (-1, 1):
        S, E, W = (s * sh[0], sh[1], sh[2]), (s * el[0], el[1], el[2]), (s * wr[0], wr[1], wr[2])
        disc(k, s * (sh[0] - 0.5), sh[1], sh[2], 3.6)
        sw(k, [(*S, 2.4), ((S[0] + E[0]) / 2, (S[1] + E[1]) / 2, (S[2] + E[2]) / 2, 2.3), (*E, 2.2)], DARK)
        disc(k, s * (el[0] + 1), el[1], el[2], 3.2)
        sw(k, [(*E, 2.1), (*W, 2)], DARK)
        sw(k, [(W[0], W[1] + 0.2, W[2] + 0.3, 2.6), (s * (wr[0] - 0.7), wr[1] + 1.2, wr[2] + 1.8, 2.6)], SHELL)
        glove(k, s * fist[0], fist[1], fist[2])


def leaned(f, lean, name):
    def g(nm=name):
        R9.LEAN[0] = math.radians(lean)
        try:
            return f(nm)
        finally:
            R9.LEAN[0] = 0.0
    return g


def v6a(name):
    k = Bench(name, FP)
    stand(k)
    sw(k, [(0, 0, 24, 5, 3.5), (0, 0, 30, 8, 5), (0, 0, 40, 9, 5.5), (0, 0, 46, 6, 4)], SHELL, p=2.6, cap0=SHELL_D)
    head_plates(k, EYE)
    guard_arms(k)
    return build(k)


def v6b(name):
    k = Bench(name, FP)
    stand(k)
    sw(k, [(0, 0, 24, 4, 3), (0, 0, 29, 5, 3.8), (0, 0, 36, 8.5, 5), (0, 0, 43, 11, 6), (0, 0, 46.5, 8, 4.5),
           (0, 0, 47.5, 4, 3)], SHELL, p=2.8, cap0=SHELL_D)                        # V-shaped torso
    sw(k, [(0, 0, 25, 4.2, 3.2), (0, 0, 28, 4.6, 3.5)], DARK, p=2.6)               # dark waist band
    head_plates(k, EYE)
    guard_arms(k, sh=(12.5, 0, 43), el=(15, 6, 35), wr=(11, 12, 40), fist=(9, 15, 43.5))
    return build(k)


def v6c_upper(p):
    R10.v4b(p, R10.SH_F, plate_k=0.75, **R10.REACH["v4t"])
    for sx in (1, -1):                                                             # white ear plates on the head
        p.rbox((sx * 0.085, 0.1, 1.2), (0.03, 0.1, 0.11), R10.CLOTH, r=0.012)


R12 = {
    "v6a": turned(leaned(v6a, 12, "ex_v6a"), 0.0, "ex_v6a"),
    "v6b": turned(leaned(v6b, 10, "ex_v6b"), 0.0, "ex_v6b"),
    "v6c": R10.droid("ex_v6c", v6c_upper),
}
DESIGNS = R12


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
