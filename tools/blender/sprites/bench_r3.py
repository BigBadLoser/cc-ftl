"""Bench look study, round 3 (family `bench3`, palette set gym, preview only): BN2B grounded the shell but read as a
couch, so these are benches: thin hard seats, open underneath, a thin red pad, carried to the floor by visible frames.

  bn4 ribbon: one off-white band that rises from the floor, runs along as the seat and comes back down; backless
  bn5 lander legs: a thin seat and back plate on splayed slate legs (two per end, like landing gear) with rubber feet
  bn6 sled: the seat and a back plate on two slate floor runners with upturned toes, slanted posts carrying both

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_study import DARK, FP, FRAME, FRAME_D, PAD, PAD_D, SHELL, SHELL_D, along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench


def seat(k, u=28, pad=26):
    along_u(k, -u, u, 0, 12.5, 8.5, 1.6, SHELL, p=3, taper=1.5, cap0=SHELL_D, cap1=SHELL_D)   # hard seat
    along_u(k, -pad, pad, 0.5, 14.6, 7.2, 0.9, PAD, p=4, taper=1, cap0=PAD_D, cap1=PAD_D)     # thin pad


def back(k, u=26):
    along_u(k, -u, u, -10, 21.5, 1.3, 5, SHELL, p=3, taper=1, cap0=SHELL_D, cap1=SHELL_D)     # back plate
    along_u(k, -u + 2, u - 2, -8.6, 21.5, 0.6, 3.8, PAD, p=4, taper=0.6)                       # back pad


def foot(k, u, v):
    sweep(k, [(u, v, 0, 2.2, 2.2), (u, v, 1.2, 2.2, 2.2)], DARK, p=2.2)


def b4():
    k = Bench("bench_b4", FP)
    sweep(k, [(-31, 0, 0.9, 8, 1.4), (-29.5, 0, 5, 8, 1.8), (-26, 0, 11.5, 8.3, 1.8), (-20, 0, 13.3, 8.5, 1.8),
              (0, 0, 13.5, 8.5, 1.8), (20, 0, 13.3, 8.5, 1.8), (26, 0, 11.5, 8.3, 1.8), (29.5, 0, 5, 8, 1.8),
              (31, 0, 0.9, 8, 1.4)], SHELL, p=3, steps=10, cap0=DARK, cap1=DARK)       # the ribbon
    along_u(k, -20, 20, 0.5, 15.7, 7, 0.9, PAD, p=4, taper=1, cap0=PAD_D, cap1=PAD_D)   # pad
    along_u(k, -18, 18, 0, 11.2, 4, 1.2, FRAME, p=3, taper=1)                      # slate stiffener underneath
    return build(k)


def b5():
    k = Bench("bench_b5", FP)
    seat(k)
    back(k)
    for s in (-1, 1):
        u = s * 21
        sweep(k, [(u - s * 2, 0, 10.4, 3, 1.8), (u + s * 2, 0, 10.4, 3, 1.8)], FRAME, p=3, cap0=FRAME_D,
              cap1=FRAME_D)                                                        # knuckle under the seat
        for f in (1, -1):                                                          # splayed legs, front and back
            sweep(k, [(u, f * 1.5, 10, 1.8, 1.8), (u + s * 3, f * 6, 4.5, 1.5, 1.5), (u + s * 5, f * 9, 1.2, 1.3, 1.3)],
                  FRAME, p=2.4, cap1=FRAME_D)
            foot(k, u + s * 5, f * 9)
        sweep(k, [(u, -7.5, 13, 1.4, 1.4), (u, -9, 18, 1.2, 1.2), (u, -10.5, 26, 1.1, 1.1)], FRAME_D, p=2.4)   # back post
    return build(k)


def b6():
    k = Bench("bench_b6", FP)
    seat(k)
    back(k)
    for s in (-1, 1):
        u = s * 24
        sweep(k, [(u, 11, 3.6, 1.8, 1.1), (u, 9.5, 1.2, 1.8, 1.1), (u, 5, 0.9, 1.8, 1.1), (u, -9, 0.9, 1.8, 1.1),
                  (u, -12, 1.6, 1.8, 1.1)], FRAME, p=3, cap0=FRAME_D, cap1=FRAME_D)   # floor runner, toe up
        sweep(k, [(u, 6, 1, 1.5, 1.5), (u, 3, 11, 1.3, 1.3)], FRAME, p=2.4)        # front post
        sweep(k, [(u, -8, 1, 1.5, 1.5), (u, -6, 11, 1.4, 1.4), (u, -9, 19, 1.2, 1.2), (u, -11, 27, 1.1, 1.1)],
              FRAME, p=2.4, cap1=FRAME_D)                                          # back post into the back
        sweep(k, [(u, 9.5, 0, 2.2, 0.5), (u, -10, 0, 2.2, 0.5)], DARK, p=4)        # rubber sole
    return build(k)


DESIGNS = {"bn4": b4, "bn5": b5, "bn6": b6}


def jobs():
    return [(f"module.bench3.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
