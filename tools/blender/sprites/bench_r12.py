"""Bench look study, round 12 (family `bench12`, palette set bench7, preview only): BN18's waiting-room seats (the user
likes them; the support is the open question). From this high camera anything under a pan is hidden, so these carry
the row the way real beam seating does and put the support where it shows: a chunky beam running past the outer
seats (visible in the gaps) on legs at its two ends, seen in profile. Seats and pad arms as BN18E.

  bn18m end T-legs: a vertical chrome post at each end of the beam on a long black foot running front to back
  bn18n panel ends: a solid black end panel at each end, wide at the floor, narrowing up to the beam
  bn18o posts: end T-legs plus straight vertical chrome posts in the two gaps, each on a round black foot

Approved (user, 2026-11-13): BN18O (`bn18o`), the bench's art: three moulded coral plastic seats with black pad arms on
a chunky black beam, chrome T-legs with long black feet at both ends of the beam and straight chrome posts on round black
feet in the two gaps between the seats; palette set bench7, 2 x 1.

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r7 import BLACK, CHROME, tube
from .bench_r9 import finish
from .bench_study import FP, along_u
from .exercise_r4 import sweep
from .research_kit import Bench

END = 30.6


def beam(k):
    along_u(k, -END - 0.6, END + 0.6, -2, 8.6, 2.4, 2.2, BLACK, p=3)


def t_leg(k, u):
    tube(k, [(u, -2, 0.8), (u, -2, 8.6)], 1.2, CHROME)
    sweep(k, [(u, -10, 0.6, 1.5, 0.7), (u, 7, 0.6, 1.5, 0.7)], BLACK, p=3)          # foot


def m():
    k = Bench("bench_b18m", FP)
    beam(k)
    for u in (-END, END):
        t_leg(k, u)
    return finish(k)


def n():
    k = Bench("bench_b18n", FP)
    beam(k)
    for u in (-END, END):                                                          # end panels, profile
        sweep(k, [(u, -2, 0, 1.0, 9), (u, -2, 2, 1.0, 8.4), (u, -2, 6, 1.0, 4.6), (u, -2, 9, 1.0, 2.6)], BLACK, p=4,
              side=(1.0, 0.0, 0.0))
        along_u(k, u - 1.2, u + 1.2, -2, 0.3, 9.4, 0.3, CHROME, p=4)                 # chrome glide
    return finish(k)


def o():
    k = Bench("bench_b18o", FP)
    beam(k)
    for u in (-END, END):
        t_leg(k, u)
    for u in (-9.6, 9.6):
        tube(k, [(u, -1, 0.8), (u, -1, 8.6)], 1.0, CHROME)                         # gap post
        sweep(k, [(u, -1, 0, 2.6, 2.6), (u, -1, 0.9, 2.4, 2.4)], BLACK, p=2.2)      # round foot
    return finish(k)


DESIGNS = {"bn18m": m, "bn18n": n, "bn18o": o}


def jobs():
    return [(f"module.bench12.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
