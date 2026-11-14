"""Bench look study, round 11 (family `bench11`, palette set bench7, preview only): BN18's coral seats on supports that
read naturally from the high camera (round 10's slanted A-frames looked like stilts). Seats and pad arms as BN18E.

  bn18j plinth: a solid black base under the whole row, its front face just behind the pan fronts
  bn18k sled legs: upright chrome sled frames (floor runner + front and back posts) at the ends and in the gaps
  bn18l back spine: a black spine panel behind the backs from the floor up, the seats hung off it

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r7 import BLACK, CHROME, tube
from .bench_r9 import finish
from .bench_study import FP, along_u
from .research_kit import Bench

FRAMES = (-28.6, -9.6, 9.6, 28.6)


def j():
    k = Bench("bench_b18j", FP)
    along_u(k, -28, 28, -1.5, 5.2, 7.6, 5.2, BLACK, p=4, taper=1)                  # plinth
    along_u(k, -28.5, 28.5, -1.5, 0.5, 8.2, 0.5, CHROME, p=4, taper=1)              # chrome kick strip
    return finish(k)


def k_():
    k = Bench("bench_b18k", FP)
    along_u(k, -29, 29, -2, 8.6, 2, 2, BLACK, p=3, taper=0.8)                      # beam
    for u in FRAMES:
        tube(k, [(u, 6.5, 10.4), (u, 6.5, 1.6), (u, 5.5, 0.7), (u, -8.5, 0.7), (u, -9.5, 1.6), (u, -9.5, 10)], 0.9,
             CHROME)                                                               # sled frame
        tube(k, [(u, 6.5, 9), (u, -9.5, 9)], 0.7, CHROME)                          # top rail into the beam
    return finish(k)


def l():
    k = Bench("bench_b18l", FP)
    along_u(k, -29.5, 29.5, -10.5, 13, 1.8, 13, BLACK, p=3, taper=1)               # back spine, floor up
    along_u(k, -30, 30, -10.5, 0.6, 2.6, 0.6, CHROME, p=4)                         # its chrome foot
    for c in (-19.2, 0, 19.2):
        along_u(k, c - 3, c + 3, -5, 10.2, 5, 1, BLACK, p=3)                        # seat arm off the spine
    return finish(k)


DESIGNS = {"bn18j": j, "bn18k": k_, "bn18l": l}


def jobs():
    return [(f"module.bench11.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
