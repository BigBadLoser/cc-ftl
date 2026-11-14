"""Bench look study, round 13 (family `bench13`, palette set bench7, preview only): the approved BN18O raised so crew
sit on it (user, 2026-11-14: "raise the bench seats", rather than a sit clip of its own). The crew sit clips pose the
pelvis on the console chair's 0.39-tile seat (human_sit.SEAT_Z, 15.3 px); BN18O's pans topped out at 12.7 px. Everything
above the feet goes up LIFT px (the beam, the seats, the pad arms), and the T-legs and gap posts stretch to meet it, so
every shape stays as approved.

  bn18p BN18O, LIFT 3 px

Same frame as bench_study (px of the footprint, u -32..32, v -16..16, z up; the front, +v, faces the camera)."""
from .bench_r12 import o
from .bunk_study import ZPX

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


DESIGNS = {"bn18p": raised(o)}


def jobs():
    from .bench_study import FP
    return [(f"module.bench13.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
