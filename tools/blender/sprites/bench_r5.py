"""Bench look study, round 5 (family `bench5`, palette set bench5, preview only): three concepts, each in its own
colours and materials (rounds 1-4 all wore the gym's off-white, slate and red).

  bn10 hoop: graphite: a seat beam threaded through two upright hoops that stand on the floor, an ochre fabric pad,
           the hoops brushed steel, dark collars where beam and hoops meet; backless
  bn11 monoliths: sage ceramic: two rounded ceramic blocks carry a plum upholstered seat and back, a copper trim line
  bn12 glass back: navy composite plinth, a cream seat slab, a tinted teal glass back panel in a thin navy frame

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_study import FP, along_u
from .exercise_r4 import build, sweep
from .exercise_r5 import loop
from .research_kit import Bench

GRAPH, GRAPH_D, OCHRE, OCHRE_D, STEEL = "bnGraph", "bnGraphD", "bnOchre", "bnOchreD", "bnSteel"
SAGE, SAGE_D, PLUM, PLUM_D, COPPER = "bnSage", "bnSageD", "bnPlum", "bnPlumD", "bnCopper"
NAVY, NAVY_D, CREAM, CREAM_D, TEAL = "bnNavy", "bnNavyD", "bnCream", "bnCreamD", "bnTeal"


def b10():
    k = Bench("bench_b10", FP)
    for u in (-21, 21):
        loop(k, u, -1, 9.5, 9, 1.5, STEEL)                                         # upright hoop
        along_u(k, u - 1.8, u + 1.8, -1, 13.2, 6.6, 2.4, GRAPH_D, p=3)             # collar
    along_u(k, -29, 29, -1, 13.2, 6, 1.6, GRAPH, p=3, taper=1.5, cap0=GRAPH_D, cap1=GRAPH_D)   # seat beam
    along_u(k, -27, 27, -0.5, 15.4, 5.4, 1.0, OCHRE, p=4, taper=1, cap0=OCHRE_D, cap1=OCHRE_D)  # fabric pad
    return build(k)


def b11():
    k = Bench("bench_b11", FP)
    for s in (-1, 1):                                                              # ceramic monoliths
        u = s * 25.5
        sweep(k, [(u, -1, 0, 4.6, 9.5), (u, -1, 7, 5.2, 10), (u, -1, 13, 5, 9.6), (u, -1, 15.5, 4.4, 9)], SAGE, p=3,
              cap1=SAGE_D)
    along_u(k, -26, 26, -10, 19.5, 2, 8.5, SAGE, p=3, taper=1, cap0=SAGE_D, cap1=SAGE_D)   # ceramic back slab
    along_u(k, -21, 21, 0, 12.5, 8.4, 2.6, PLUM, p=4, taper=1.2, cap0=PLUM_D, cap1=PLUM_D)   # upholstered seat
    along_u(k, -21, 21, -7.4, 21, 1.4, 5.4, PLUM, p=4, taper=1)                    # upholstered back
    along_u(k, -21, 21, 8.6, 10.6, 0.5, 0.6, COPPER, p=2.4)                        # copper trim line
    return build(k)


def b12():
    k = Bench("bench_b12", FP)
    along_u(k, -27, 27, -0.5, 4.2, 8, 4.2, NAVY, p=3, taper=1.5, cap0=NAVY_D, cap1=NAVY_D)   # composite plinth
    along_u(k, -30, 30, 0, 10.8, 9, 2, CREAM, p=3.5, taper=1.5, cap0=CREAM_D, cap1=CREAM_D)   # seat slab
    along_u(k, -28, 28, -10, 20.5, 0.8, 8.2, TEAL, p=4, cap0=TEAL, cap1=TEAL)      # tinted glass back panel
    along_u(k, -27, 27, -9.4, 26.5, 0.3, 0.5, "bnTealL", p=2.4)                    # its sheen line
    along_u(k, -29, 29, -10, 29, 1.3, 1.1, NAVY, p=3, cap0=NAVY_D, cap1=NAVY_D)    # frame top
    for u in (-28.6, 28.6):
        sweep(k, [(u, -10, 11.5, 1.2, 1.3), (u, -10, 29, 1.2, 1.3)], NAVY, p=3, side=(1.0, 0.0, 0.0))   # frame post
    return build(k)


DESIGNS = {"bn10": b10, "bn11": b11, "bn12": b12}


def jobs():
    return [(f"module.bench5.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
