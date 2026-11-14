"""Bench look study (family `bench`, palette set gym, preview only, r0): three sci-fi benches on a 2 x 1 footprint, built
from swept shells (exercise_r4.sweep) in the exercise droid's colours: off-white shell, slate frame, red cushions. The
seat top is at 15 px (the crew's seated height); the back is at -v, the front (+v) faces the camera.

  bn1 cantilever: a seat shell and a backrest hung on two C-shaped swept slate frames at its ends
  bn2 lounge shell: one sculpted off-white shell, seat and back, on a recessed dark plinth, two red cushions
  bn3 slat bench: curved slats for seat and back between two sculpted end pedestals, a small side table on one

All in px of the footprint (u -32..32 across, v -16..16, z up)."""
from .exercise_r4 import build, sweep
from .research_kit import Bench

FP = (2, 1)
SHELL, SHELL_D, FRAME, FRAME_D, PAD, PAD_D, RAIL, DARK = ("gymShell", "gymShellD", "gymSlate", "gymSlateD", "gymRed",
                                                         "gymRedD", "gymRail", "gymRubber")


def along_u(k, u0, u1, v, z, a, b, col, p=4, taper=0.0, **kw):
    """A rounded bar along u from u0 to u1 (a half depth along v, b half height), its ends eased by `taper` px."""
    pts = [(u0, v, z, a - taper, b - taper * 0.5), (u0 + 3, v, z, a, b), (u1 - 3, v, z, a, b),
           (u1, v, z, a - taper, b - taper * 0.5)]
    sweep(k, pts, col, p=p, **kw)


def b1():
    k = Bench("bench_b1", FP)
    for u in (-26, 26):                                                            # C-shaped end frames
        sweep(k, [(u, 8, 1, 2.2, 1.4), (u, -5, 1, 2.2, 1.4), (u, -10, 6, 2.2, 1.6), (u, -11, 15, 2.2, 1.6),
                  (u, -12.5, 27, 2, 1.4)], FRAME, p=2.6, cap0=FRAME_D, cap1=FRAME_D)
        sweep(k, [(u, 8, 0, 3, 1), (u, 5, 0, 3, 1)], DARK, p=3)                    # rubber foot
    along_u(k, -28, 28, 1, 12.5, 7.5, 1.8, SHELL, taper=1.5, cap0=SHELL_D, cap1=SHELL_D)   # seat shell
    along_u(k, -26, 26, 1, 14.4, 6.6, 0.9, PAD, taper=1, cap0=PAD_D, cap1=PAD_D)   # cushion
    for z, v in ((19, -11.6), (25, -12.6)):
        along_u(k, -28, 28, v, z, 1.6, 2.6, SHELL, p=3, taper=0.8, cap0=SHELL_D, cap1=SHELL_D)   # backrest rails
    along_u(k, -25, 25, -11.2, 22, 1.2, 4.2, PAD, p=4, taper=0.6)                  # back pad
    return build(k)


def b2():
    k = Bench("bench_b2", FP)
    along_u(k, -26, 26, -1, 1.5, 6, 1.5, DARK, p=5)                                # recessed plinth
    along_u(k, -30, 30, 0, 9, 9, 4.5, SHELL, p=3, taper=2, cap0=SHELL_D, cap1=SHELL_D)   # seat shell
    along_u(k, -30, 30, -10.5, 19, 3, 9.5, SHELL, p=3, taper=1.5, cap0=SHELL_D, cap1=SHELL_D)   # back shell
    for u0, u1 in ((-27, -1), (1, 27)):
        along_u(k, u0, u1, 1.5, 14.2, 7, 1.3, PAD, p=4, taper=1, cap0=PAD_D, cap1=PAD_D)   # seat cushions
        along_u(k, u0, u1, -7.6, 21, 1.1, 5, PAD, p=4, taper=0.8)                  # back cushions
    return build(k)


def b3():
    k = Bench("bench_b3", FP)
    for s in (-1, 1):                                                              # sculpted end pedestals
        u = s * 27
        sweep(k, [(u, -2, 0, 4, 9), (u, -2, 6, 3, 8), (u, -2, 13, 3.6, 9), (u, -2, 15, 3, 8.5)], FRAME, p=3,
              cap1=FRAME_D)
    for v in (-6, -2, 2, 6):                                                       # seat slats, bowed a little
        sweep(k, [(-25, v, 14, 1.3, 0.8), (0, v, 13.2, 1.3, 0.8), (25, v, 14, 1.3, 0.8)], SHELL, p=2.6)
    for v, z in ((-9.5, 19), (-10.5, 23), (-11.5, 27)):                            # back slats
        sweep(k, [(-25, v, z, 0.8, 1.2), (0, v - 0.6, z, 0.8, 1.2), (25, v, z, 0.8, 1.2)], SHELL, p=2.6)
    for s in (-1, 1):
        sweep(k, [(s * 25, -8.5, 14, 1.6, 1.6), (s * 25, -11.8, 28, 1.4, 1.4)], FRAME_D, p=2.4)   # back uprights
    sweep(k, [(29, -2, 15, 4.5, 9.5), (29, -2, 16.5, 4.5, 9.5)], SHELL, p=3, cap0=SHELL_D)       # side table top
    return build(k)


DESIGNS = {"bn1": b1, "bn2": b2, "bn3": b3}


def jobs():
    return [(f"module.bench.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
