"""Bench look study, round 4 (family `bench4`, palette set gym, preview only): three separate concepts, no shared
seat or back parts.

  bn7 seat row: three round seat pucks with red pads, each with a curved back lip, on stems from one slate floor rail
  bn8 crescent: a solid off-white bench curved in plan (ends swept back), a red pad following the arc, dark toe-kick
  bn9 jump seats: a tall slate bulkhead panel with three fold-out seats on angled brackets, a red back cushion per bay

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
import math

from .bench_study import DARK, FP, FRAME, FRAME_D, PAD, PAD_D, SHELL, SHELL_D, along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench


def b7():
    k = Bench("bench_b7", FP)
    along_u(k, -29, 29, -2, 2, 5, 2, FRAME, p=3, taper=1.5, cap0=FRAME_D, cap1=FRAME_D)   # floor rail
    for u in (-20, 0, 20):
        sweep(k, [(u, -2, 3, 2, 2), (u, -1, 10, 1.6, 1.6)], FRAME_D, p=2.2)          # stem
        sweep(k, [(u, 0, 11, 7, 6.5), (u, 0, 12.4, 7.8, 7.3), (u, 0, 13.4, 7.5, 7)], SHELL, p=2.2, cap0=SHELL_D,
              cap1=SHELL_D)                                                        # puck
        along_u(k, u - 6, u + 6, 0.5, 14.2, 5.6, 0.9, PAD, p=2.2, taper=2.5)        # red seat pad
        lip = [(u + 6.8 * math.cos(math.radians(t)), 6.3 * math.sin(math.radians(t)), 17.5, 1.1, 3.6)
               for t in (-165, -130, -90, -50, -15)]
        sweep(k, lip, SHELL, p=3, cap0=SHELL_D, cap1=SHELL_D)                      # back lip
    return build(k)


def arc(z, a, b, ends=1.0):
    pts = []
    for i in range(9):
        u = -29 + 58 * i / 8
        e = 1 - (1 - ends) * (abs(u) / 29) ** 4
        pts.append((u, 4 - 10 * (u / 29) ** 2, z, a * e, b))
    return pts


def b8():
    k = Bench("bench_b8", FP)
    sweep(k, arc(1.2, 5.5, 1.2), DARK, p=4, steps=6)                               # toe-kick
    sweep(k, arc(8, 6.8, 6.6, 0.8), SHELL, p=3, steps=6, cap0=SHELL_D, cap1=SHELL_D)   # crescent body
    sweep(k, arc(14.7, 5.3, 0.9, 0.75)[1:-1], PAD, p=4, steps=6, cap0=PAD_D, cap1=PAD_D)   # pad
    return build(k)


def b9():
    k = Bench("bench_b9", FP)
    along_u(k, -30, 30, -11.5, 0.8, 4, 0.8, DARK, p=4)                             # plinth
    along_u(k, -29, 29, -12, 15.5, 2.5, 15, FRAME, p=3, taper=1, cap0=FRAME_D, cap1=FRAME_D)   # bulkhead panel
    along_u(k, -30, 30, -12, 30.8, 3.2, 1, FRAME_D, p=4)                           # top cap
    for c in (-19.4, 0, 19.4):
        along_u(k, c - 8.5, c + 8.5, -2, 12.3, 7.5, 1.5, SHELL, p=3, taper=1, cap0=SHELL_D, cap1=SHELL_D)   # seat
        along_u(k, c - 7.5, c + 7.5, -1.5, 14.2, 6.3, 0.9, PAD, p=4, taper=1, cap0=PAD_D, cap1=PAD_D)      # pad
        along_u(k, c - 7.5, c + 7.5, -8.6, 21.5, 1.1, 5.5, PAD, p=4, taper=0.8)    # back cushion
    for u in (-28.5, -9.7, 9.7, 28.5):
        sweep(k, [(u, -9.5, 24, 1.1, 2), (u, -6, 15, 1.2, 2.2), (u, 4.5, 11.5, 1.1, 1.4)], FRAME_D, p=2.6)   # bracket
    return build(k)


DESIGNS = {"bn7": b7, "bn8": b8, "bn9": b9}


def jobs():
    return [(f"module.bench4.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
