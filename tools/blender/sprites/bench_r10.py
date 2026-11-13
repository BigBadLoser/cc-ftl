"""Bench look study, round 10 (family `bench10`, palette set bench7, preview only): BN18E's gap legs (user's pick), with
legs at both ends too. Seats, arms and beam as BN18E.

  bn18g four frames: the same chrome A-frame at both ends and in both gaps
  bn18h splayed ends: the end frames lean out past the seats, the gap frames upright
  bn18i stretcher: four A-frames tied by a low chrome stretcher along the back feet

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r7 import BLACK, CHROME, tube
from .bench_r9 import finish
from .bench_study import FP, along_u
from .research_kit import Bench

GAPS, ENDS = (-9.6, 9.6), (-28.6, 28.6)


def a_frame(k, u, top=None):
    t = top if top is not None else u
    for v in (8, -10):
        tube(k, [(u, v, 0.6), (t, -2, 8.6)], 1.2, CHROME)
        tube(k, [(u, v, 0), (u, v, 0.9)], 1.6, BLACK)                              # foot


def beam(k, u=29):
    along_u(k, -u, u, -2, 8.6, 2, 2, BLACK, p=3, taper=0.8)


def g():
    k = Bench("bench_b18g", FP)
    beam(k)
    for u in GAPS + ENDS:
        a_frame(k, u)
    return finish(k)


def h():
    k = Bench("bench_b18h", FP)
    beam(k)
    for u in GAPS:
        a_frame(k, u)
    for u in ENDS:
        a_frame(k, u * 1.08, top=u * 0.97)                                         # splayed out
    return finish(k)


def i():
    k = Bench("bench_b18i", FP)
    beam(k)
    for u in GAPS + ENDS:
        a_frame(k, u)
    tube(k, [(-28.6, -10, 1.6), (28.6, -10, 1.6)], 0.8, CHROME)                     # stretcher
    return finish(k)


DESIGNS = {"bn18g": g, "bn18h": h, "bn18i": i}


def jobs():
    return [(f"module.bench10.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
