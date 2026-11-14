"""Bench look study, round 9 (family `bench9`, palette set bench7, preview only): BN18 with its middle seat carried
visibly. Round 8's legs stood under the outer seats only and the beam hid under the pans, so the middle seat floated.
All three keep BN18A's pad arms, and narrow the seats a little so gaps open between them (the frame shows there);
from this high camera whatever stands under a pan is hidden, so the support has to show in the gaps or in front.

  bn18d three legs: a chrome T-leg under every seat, its foot bar running out in front of the pan
  bn18e gap legs: chrome A-frame legs in the two gaps between the seats, the beam visible there
  bn18f floor rail: a black floor rail in front along the whole bench, chrome uprights in the gaps

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r7 import BLACK, CHROME, tube
from .bench_r8 import pad_arm, seat
from .bench_study import FP, along_u
from .exercise_r4 import build, sweep
from .research_kit import Bench

SEATS, ARMS = (-19.2, 0, 19.2), (-28.6, -9.6, 9.6, 28.6)


def t_leg(k, u, r=1.1, foot=1.4):
    tube(k, [(u, -2, 0.6), (u, -2, 8.4)], r, CHROME)
    sweep(k, [(u, -8.5, 0.6, foot, 0.7), (u, 9.5, 0.6, foot, 0.7)], BLACK, p=3)       # foot bar, out in front


def finish(k):
    for c in SEATS:
        seat(k, c, 7.8)
    for u in ARMS:
        pad_arm(k, u)
    return build(k)


def d():
    k = Bench("bench_b18d", FP)
    along_u(k, -27, 27, -2, 8.4, 1.3, 1.6, BLACK, p=3)                             # beam
    for u in SEATS:
        t_leg(k, u)
    return finish(k)


def e():
    k = Bench("bench_b18e", FP)
    along_u(k, -29, 29, -2, 8.6, 2, 2, BLACK, p=3, taper=0.8)                      # beam
    for u in (-9.6, 9.6):                                                          # A-frame legs in the gaps
        tube(k, [(u, 8, 0.6), (u, -2, 8.6)], 1.2, CHROME)
        tube(k, [(u, -10, 0.6), (u, -2, 8.6)], 1.2, CHROME)
        for v in (8, -10):
            tube(k, [(u, v, 0), (u, v, 0.9)], 1.6, BLACK)                          # feet
    return finish(k)


def f():
    k = Bench("bench_b18f", FP)
    along_u(k, -29, 29, 2.5, 1.2, 7.5, 1.2, BLACK, p=4, taper=1)                   # floor rail, out in front
    along_u(k, -27, 27, -2, 8.4, 1.3, 1.6, BLACK, p=3)                             # beam
    for u in (-28.6, -9.6, 9.6, 28.6):
        tube(k, [(u, 1, 1.5), (u, -2, 8.4)], 1.1, CHROME)                          # upright in the gap
    return finish(k)


DESIGNS = {"bn18d": d, "bn18e": e, "bn18f": f}


def jobs():
    return [(f"module.bench9.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
