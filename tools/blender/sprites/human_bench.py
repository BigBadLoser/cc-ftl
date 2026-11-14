"""The bench seat as a sit-clip holdout (clip `sit_bench`; docs/ARCHITECTURE.md, seats), as human_stool.py does for the
game-table stool.

`sit_bench` is the `sit_idle` pose rendered against one seat of the bench (bench.py, bench_r13 bn18q: the pan, its
backrest and the pad arms either side), so a crew member seated on it is cut where that seat is nearer the camera and
nowhere else (the console clips' cut, the swivel chair's taller and wider back, left holes above the bench's backrest).
The bench's neighbouring seats are covered by its front overlay (bench.py)."""
from . import bench_r13 as R
from .bench_r8 import pad_arm
from .bunk_study import ZPX
from .modkit import K

_BENCH = []


class _Seat(K):
    """K with every point moved `dv` tiles along v: the seat drawn where it is relative to the sitter."""
    def __init__(self, name, dv):
        super().__init__(name, (1, 1), 0)
        self.dv = dv

    def p(self, u, v):
        return super().p(u, v + self.dv)


def bench_holdout():
    """The bench's middle seat with its two pad arms, raised as bench_r13, placed so the sprite origin is the sitter's
    (bench_r13.SIT_V: the sitter sits that far from the seat line, facing +v = grid +y, the azimuth-0 way, as the stool),
    as a hidden Cycles holdout turned with the character like the console chair."""
    if not _BENCH:
        k = _Seat("sit_bench_holdout", -R.SIT_V)
        R.seat(k, 0.0)
        for u in (-9.6, 9.6):
            pad_arm(k, u)
        ob = k.build()[0]
        for v in ob.data.vertices:                                  # bench_r13.raised
            if v.co.z > R.FEET / ZPX:
                v.co.z += R.LIFT / ZPX
        ob.data.update()
        ob.is_holdout, ob.hide_render = True, True
        _BENCH.append(ob)
    return _BENCH[0]
