"""Bench look study, round 8 (family `bench8`, palette set bench7, preview only): BN18 picked (user, 2026-11-13), the
waiting-room seats: moulded coral shells on a black beam with chrome T-legs. Round 7's bent chrome armrests read
oddly, so these refine them.

  bn18a pad arms: a black armrest pad on a chrome post at both ends and between each seat
  bn18b end loops: chrome D-loop armrests at the two ends only, none between the seats
  bn18c with table: two seats with a small black side table on the beam between them, chrome-post arms at the ends

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r7 import BLACK, CHROME, CORAL, CORAL_D, tube
from .bench_study import FP, along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench


def frame(k):
    along_u(k, -27, 27, -2, 8.4, 1.3, 1.6, BLACK, p=3)                             # beam
    for u in (-21, 21):                                                            # chrome T-legs
        tube(k, [(u, -2, 0.6), (u, -2, 8.4)], 1.1, CHROME)
        sweep(k, [(u, -8.5, 0.6, 1.4, 0.6), (u, 5, 0.6, 1.4, 0.6)], BLACK, p=3)    # foot bar


def seat(k, c, w=8.4):
    along_u(k, c - 2.5, c + 2.5, -2, 10.2, 2.6, 0.9, BLACK, p=3)                    # bracket
    along_u(k, c - w, c + w, 0.5, 11.6, 7, 1.1, CORAL, p=3, taper=1.6, cap0=CORAL_D, cap1=CORAL_D)   # pan
    along_u(k, c - w + 0.2, c + w - 0.2, -6.6, 13, 1.5, 1.8, CORAL, p=2.4, taper=1.6, cap0=CORAL_D, cap1=CORAL_D)
    along_u(k, c - w + 0.4, c + w - 0.4, -8.2, 19.5, 1.1, 6, CORAL, p=3, taper=1.8, cap0=CORAL_D, cap1=CORAL_D)


def pad_arm(k, u):
    tube(k, [(u, -2, 8.4), (u, -2, 12), (u, -1.2, 16)], 0.8, CHROME)                # post off the beam
    sweep(k, [(u, -6.5, 16.6, 1.2, 0.8), (u, -5, 16.9, 1.3, 0.9), (u, 4, 16.9, 1.3, 0.9), (u, 5.5, 16.6, 1.2, 0.8)],
          BLACK, p=3)                                                              # arm pad


def a():
    k = Bench("bench_b18a", FP)
    frame(k)
    for c in (-19.2, 0, 19.2):
        seat(k, c)
    for u in (-28.6, -9.6, 9.6, 28.6):
        pad_arm(k, u)
    return build(k)


def b():
    k = Bench("bench_b18b", FP)
    frame(k)
    for c in (-19.2, 0, 19.2):
        seat(k, c)
    for u in (-29, 29):                                                            # chrome D-loops
        tube(k, [(u, -6.8, 12.4), (u, -6.4, 16.2), (u, -3, 17.2), (u, 3, 17.2), (u, 6, 16), (u, 6.4, 12.4)], 0.75,
             CHROME)
    return build(k)


def c():
    k = Bench("bench_b18c", FP)
    frame(k)
    for cc in (-18.5, 18.5):
        seat(k, cc, 9)
    along_u(k, -3, 3, -2, 10, 3, 1.4, BLACK, p=3)                                   # table bracket
    along_u(k, -8, 8, -1, 12.6, 7.5, 0.9, BLACK, p=4, taper=1)                      # side table top
    along_u(k, -7.6, 7.6, 6.4, 12.6, 0.4, 0.6, CHROME, p=2.4)                       # its chrome front edge
    for u in (-28.6, 28.6):
        pad_arm(k, u)
    return build(k)


DESIGNS = {"bn18a": a, "bn18b": b, "bn18c": c}


def jobs():
    return [(f"module.bench8.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
