"""Bench look study, round 13 (family `bench13`, palette set bench7, preview only): the approved BN18O raised so crew
sit on it (user, 2026-11-14: "raise the bench seats", rather than a sit clip of its own). The crew sit clips pose the
pelvis on the console chair's 0.39-tile seat (human_sit.SEAT_Z, 15.3 px); BN18O's pans topped out at 12.7 px. Everything
above the feet goes up LIFT px (the beam, the seats, the pad arms), and the T-legs and gap posts stretch to meet it, so
every shape stays as approved.

  bn18p BN18O, LIFT 3 px
  bn18q bn18p with the pans 3 px shorter at the front (user: "the bottom part of the seat is too long, so they
        aren't up against the backrest"): 11 px deep, not 14; the sitters move back to the backrest (bench.SEATS)

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r7 import BLACK, CHROME, CORAL, CORAL_D, tube
from .bench_r8 import pad_arm
from .bench_r9 import ARMS, SEATS
from .bench_r12 import END, beam, o, t_leg
from .bench_study import FP, along_u
from .bunk_study import ZPX
from .exercise_r4 import build, sweep
from .research_kit import Bench

LIFT = 3.0                                          # px
FEET = 1.6                                          # px: vertices at or below this stay on the floor (feet, glides)


def raised(f, lift=LIFT):
    """A design built by `f` with every vertex above FEET moved up `lift` px (legs between stretch)."""
    def g():
        out = f()
        for ob in out:
            for v in ob.data.vertices:
                if v.co.z > FEET / ZPX:
                    v.co.z += lift / ZPX
            ob.data.update()
        return out
    return g


CUT = 3.0                                           # px off the front of each pan
# Where a sitter sits, tiles from the seat line along v (bench.SEATS, human_bench): sit_idle's back is 0.10 behind the
# pose origin at the shoulders (measured on the posed rig), 0.06 at the seat; the backrest's front face is 0.16 behind
# the seat line at the seat, 0.22 at the shoulders.
SIT_V = -0.11


def seat(k, c, w=7.8, cut=CUT):
    """bench_r8.seat with the pan `cut` px shorter at its front edge (+v)."""
    along_u(k, c - 2.5, c + 2.5, -2, 10.2, 2.6, 0.9, BLACK, p=3)                    # bracket
    along_u(k, c - w, c + w, 0.5 - cut / 2, 11.6, 7 - cut / 2, 1.1, CORAL, p=3, taper=1.6, cap0=CORAL_D,
            cap1=CORAL_D)                                                          # pan
    along_u(k, c - w + 0.2, c + w - 0.2, -6.6, 13, 1.5, 1.8, CORAL, p=2.4, taper=1.6, cap0=CORAL_D, cap1=CORAL_D)
    along_u(k, c - w + 0.4, c + w - 0.4, -8.2, 19.5, 1.1, 6, CORAL, p=3, taper=1.8, cap0=CORAL_D, cap1=CORAL_D)


def short():
    """bench_r12.o with the shorter pans."""
    k = Bench("bench_b18q", FP)
    beam(k)
    for u in (-END, END):
        t_leg(k, u)
    for u in (-9.6, 9.6):
        tube(k, [(u, -1, 0.8), (u, -1, 8.6)], 1.0, CHROME)                         # gap post
        sweep(k, [(u, -1, 0, 2.6, 2.6), (u, -1, 0.9, 2.4, 2.4)], BLACK, p=2.2)      # round foot
    for c in SEATS:
        seat(k, c)
    for u in ARMS:
        pad_arm(k, u)
    return build(k)


DESIGNS = {"bn18p": raised(o), "bn18q": raised(short)}


def jobs():
    return [(f"module.bench13.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
