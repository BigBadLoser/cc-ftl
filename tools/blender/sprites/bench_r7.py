"""Bench look study, round 7 (family `bench7`, palette set bench7, preview only): normal benches, each in its own
colours and materials.

  bn16 locker room: a long backless charcoal vinyl pad on two brushed-steel tube U-legs and a low stretcher
  bn17 park bench: a forest-green tube frame (legs, curved back posts, armrests) with teak-brown seat and back slats
  bn18 waiting room: three moulded coral plastic seats on a black beam, chrome T-legs and chrome armrests

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_study import FP, along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench

VINYL, VINYL_D, STEEL, STEEL_D = "b7Vinyl", "b7VinylD", "b7Steel", "b7SteelD"
GREEN, GREEN_D, TEAK, TEAK_D = "b7Green", "b7GreenD", "b7Teak", "b7TeakD"
CORAL, CORAL_D, BLACK, CHROME = "b7Coral", "b7CoralD", "b7Black", "b7Chrome"


def tube(k, pts, r, col, **kw):
    sweep(k, [(*p, r, r) for p in pts], col, p=2.2, n=12, **kw)


def b16():
    k = Bench("bench_b16", FP)
    for u in (-22, 22):                                                            # tube U-legs
        tube(k, [(u, -5.5, 0), (u, -5.5, 7.5), (u, -4, 9.3), (u, 4, 9.3), (u, 5.5, 7.5), (u, 5.5, 0)], 1.0, STEEL,
             cap0=STEEL_D, cap1=STEEL_D)
        for v in (-5.5, 5.5):
            tube(k, [(u, v, 0), (u, v, 0.8)], 1.4, BLACK)                          # rubber feet
    tube(k, [(-22, 0, 3), (22, 0, 3)], 0.8, STEEL_D)                               # stretcher
    tube(k, [(-22, -5.5, 3), (-22, 5.5, 3)], 0.7, STEEL_D)
    tube(k, [(22, -5.5, 3), (22, 5.5, 3)], 0.7, STEEL_D)
    along_u(k, -29, 29, 0, 10.6, 6.6, 0.9, STEEL_D, p=4, taper=0.5)                # board under the pad
    along_u(k, -29, 29, 0, 12.8, 6.8, 1.8, VINYL, p=4.5, taper=1.2, cap0=VINYL_D, cap1=VINYL_D)   # vinyl pad
    return build(k)


def b17():
    k = Bench("bench_b17", FP)
    for u in (-27, 27):                                                            # side frames
        tube(k, [(u, -7, 0), (u, -6.6, 11), (u, -8.6, 20), (u, -10.6, 28)], 1.1, GREEN, cap1=GREEN_D)   # back leg
        tube(k, [(u, 7, 0), (u, 7, 11)], 1.1, GREEN)                               # front leg
        tube(k, [(u, 8, 11), (u, -7, 11)], 1.0, GREEN)                             # seat rail
        tube(k, [(u, 7, 11), (u, 8.4, 18), (u, 4, 18.6), (u, -7.6, 18.4)], 1.0, GREEN, cap0=GREEN_D)   # armrest
    for v in (-5.4, -1.8, 1.8, 5.4):                                               # seat slats
        along_u(k, -28.5, 28.5, v, 12.7, 1.5, 0.8, TEAK, p=3, taper=0.4, cap0=TEAK_D, cap1=TEAK_D)
    for v, z in ((-8.1, 16.5), (-9.2, 20.8), (-10.2, 25)):                          # back slats
        along_u(k, -28.5, 28.5, v, z, 0.7, 1.6, TEAK, p=3, taper=0.4, cap0=TEAK_D, cap1=TEAK_D)
    return build(k)


def b18():
    k = Bench("bench_b18", FP)
    along_u(k, -27, 27, -2, 8.4, 1.3, 1.6, BLACK, p=3)                             # beam
    for u in (-21, 21):                                                            # chrome T-legs
        tube(k, [(u, -2, 0.6), (u, -2, 8.4)], 1.1, CHROME)
        sweep(k, [(u, -8.5, 0.6, 1.4, 0.6), (u, 5, 0.6, 1.4, 0.6)], BLACK, p=3)    # foot bar
    for c in (-19.2, 0, 19.2):                                                     # moulded seats
        along_u(k, c - 2.5, c + 2.5, -2, 10.2, 2.6, 0.9, BLACK, p=3)                # bracket
        along_u(k, c - 8.4, c + 8.4, 0.5, 11.6, 7, 1.1, CORAL, p=3, taper=1.6, cap0=CORAL_D, cap1=CORAL_D)   # pan
        along_u(k, c - 8.2, c + 8.2, -6.6, 13, 1.5, 1.8, CORAL, p=2.4, taper=1.6, cap0=CORAL_D, cap1=CORAL_D)   # bend
        along_u(k, c - 8, c + 8, -8.2, 19.5, 1.1, 6, CORAL, p=3, taper=1.8, cap0=CORAL_D, cap1=CORAL_D)   # back
    for u in (-28.6, -9.6, 9.6, 28.6):                                             # chrome armrests
        tube(k, [(u, -6.5, 11.8), (u, -5.5, 16.5), (u, 1, 17), (u, 5.5, 16.5)], 0.7, CHROME)
    return build(k)


DESIGNS = {"bn16": b16, "bn17": b17, "bn18": b18}


def jobs():
    return [(f"module.bench7.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
