"""Bench look study, round 2 (family `bench2`, palette set gym, preview only): BN2's lounge shell, grounded. Round 1's
shell read as floating over its thin recessed plinth; each design here carries the load visibly to the floor.

  bn2a solid body: the seat and back shells run down to the floor as one upholstered mass over a dark toe-kick shadow
  bn2b end panels: off-white side panels from the floor to the armrest hold the seat between them
  bn2c pedestal: a slate foot plate on the floor and a dark spine rising into the shell

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_study import DARK, FP, FRAME, FRAME_D, PAD, PAD_D, SHELL, SHELL_D, along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench


def cushions(k, u_end=27):
    for u0, u1 in ((-u_end, -1), (1, u_end)):
        along_u(k, u0, u1, 1.5, 14.2, 7, 1.3, PAD, p=4, taper=1, cap0=PAD_D, cap1=PAD_D)   # seat cushions
        along_u(k, u0, u1, -7.6, 21, 1.1, 5, PAD, p=4, taper=0.8)                  # back cushions


def a():
    k = Bench("bench_b2a", FP)
    along_u(k, -28, 28, -1, 1.3, 7.8, 1.3, DARK, p=5)                              # toe-kick shadow
    along_u(k, -30, 30, 0, 8, 9, 6, SHELL, p=3, taper=2, cap0=SHELL_D, cap1=SHELL_D)       # seat body, to the kick
    along_u(k, -30, 30, -10.5, 14.5, 3, 14, SHELL, p=3, taper=1.5, cap0=SHELL_D, cap1=SHELL_D)   # back, to the floor
    cushions(k)
    return build(k)


def b():
    k = Bench("bench_b2b", FP)
    along_u(k, -26, 26, -1, 1.5, 6, 1.5, DARK, p=5)                                # recessed plinth
    along_u(k, -27, 27, 0, 9, 9, 4.5, SHELL, p=3, cap0=SHELL_D, cap1=SHELL_D)      # seat shell
    along_u(k, -27, 27, -10.5, 19, 3, 9.5, SHELL, p=3, cap0=SHELL_D, cap1=SHELL_D)   # back shell
    for s in (-1, 1):                                                              # end panels, floor to armrest
        sweep(k, [(s * 29.5, 10, 8.5, 2.4, 8.5), (s * 29.5, 0, 9, 2.4, 9), (s * 29.5, -8, 12, 2.4, 12),
                  (s * 29.5, -12.5, 14, 2.4, 14)], SHELL, p=3, cap0=SHELL_D, cap1=SHELL_D)
        sweep(k, [(s * 29.5, 9, 0.8, 2.6, 0.8), (s * 29.5, -12, 0.8, 2.6, 0.8)], DARK, p=4)    # rubber shoe
    cushions(k, 26)
    return build(k)


def c():
    k = Bench("bench_b2c", FP)
    along_u(k, -26, 26, 0, 1.2, 13, 1.2, FRAME, p=4, taper=1, cap0=FRAME_D, cap1=FRAME_D)   # foot plate
    along_u(k, -22, 22, -1, 4.5, 8, 4, FRAME_D, p=3, taper=1.5)                    # spine into the shell
    along_u(k, -30, 30, 0, 9, 9, 4.5, SHELL, p=3, taper=2, cap0=SHELL_D, cap1=SHELL_D)   # seat shell
    along_u(k, -30, 30, -10.5, 19, 3, 9.5, SHELL, p=3, taper=1.5, cap0=SHELL_D, cap1=SHELL_D)   # back shell
    cushions(k)
    return build(k)


DESIGNS = {"bn2a": a, "bn2b": b, "bn2c": c}


def jobs():
    return [(f"module.bench2.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
