"""Kestrel tier fit-out study, round 9: more variations on the one-machine build (round 6's bed and casing).

  AA sponson pumps: the side castings widen into sponsons that house the pumps behind cast windows, a crown on the
     rear cap. Mk III: sponsons most of the length, two pumps each, accumulator domes on their tops, a booster crown.
  AB bottle progression: the containment bottle is the rear cap in both tiers and grows. Mk II: a small bottle and one
     big field ring; Mk III: a large bottle in a gimbal band and three rings.
  AC ring drive to everything: Mk II two field rings and the capacitor stack; Mk III adds the pump crown and sponson
     pumps to the rings.
"""
import math

from sprites import detail as D
from geometry import annulus, curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import bed, casing
from tier_r7 import _crown, _field_ring
from tier_r8 import _cap_stack, _header, _rack, _ring_feeds


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def sponson(f, side, s0, s1, pumps, a, feed_u, domes=False):
    """A cast sponson off the side casting (v 1.39 to 1.92) from s0 to s1, open in windows over its pumps."""
    m = T._m()
    lo, hi = (1.39, 1.92) if side > 0 else (-1.92, -1.39)
    vm = side * 1.64
    edges = sorted({s0, s1, *[x for p in pumps for x in (p[0] - 0.05, p[1] + 0.05)]})
    for p, q in zip(edges, edges[1:]):
        if any(p0 - 0.05 <= p and q <= p1 + 0.05 for p0, p1 in pumps):
            m.prism(f, [(p, 0), (p, 0.22), (q, 0.22), (q, 0)], lo, hi, "navy", "blueGrey")
            m.prism(f, [(p, 0.92), (p, 1.05), (q, 1.05), (q, 0.92)], lo, hi, "navy", "blueGrey")
        else:
            m.prism(f, [(p, 0), (p, 1.05), (q, 1.05), (q, 0)], lo, hi, "navy", "blueGrey")
    m.prism(f, [(s1, 0), (s1, 1.05), (s1 + 0.3, 0.7), (s1 + 0.3, 0)], lo, hi, "navy", "blueGrey")   # fore chamfer
    for p0, p1 in pumps:
        T.pump(f, p0, p1 - 0.12, vm, 0.57, 0.3, "+v" if side > 0 else "-v")
        curved_pipe(f, [(p1 - 0.25, vm, 0.9), (p1 - 0.3, vm, 1.18), (p1 - 0.35, side * 1.15, 1.3),
                        (feed_u + 0.1, side * 0.95, a + 0.25), (feed_u, side * 0.8, a + 0.2)], 0.09, "steelL", steps=4)
        D.flange(f, (p1 - 0.3, vm, 1.1), "z", 0.13, "brass", t=0.07)
        if domes:
            um = (p0 + p1) / 2 - 0.15
            T.sphere(f, um, vm, 1.05 + 0.26, 0.26, "steel", n=8, sides=18)
            ring(f, (um, vm, 1.31), "z", 0.27, 0.03, "brass", n=24, sides=6)
    for u in (s0 + 0.15, s1 - 0.05):
        T.lug(f, u, side * 1.82)


def _crowned(fs, a, uc, big):
    crowns = [(uc - 0.2, 0.68)] if not big else [(uc - 0.2, 0.78), (uc + 0.55, 0.64)]
    for u, rr in crowns:
        _crown(fs, u, a, rr)
    fs.hcyl(uc - 0.5, uc - 0.3, 0, a, 0.32, "steel", sides=16, capstart="brass")
    T.bolts(fs, uc - 0.5, a, 0.24)
    return crowns[0][0]


# ---- AA: sponson pumps -----------------------------------------------------------------------------------------------

def sponsons(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    cu = _crowned(fs, a, uc, big)
    pumps = [(u0 + 0.25, -2.2)] if not big else [(u0 + 0.25, -3.2), (-3.0, -1.95)]
    s1 = pumps[-1][1] + 0.1
    bed(f, u0, a, None, lambda u: _header(f, u, 0.0))
    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, s1, pumps, a, cu, domes=big)


# ---- AB: bottle progression ------------------------------------------------------------------------------------------

def bottle(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.35 if not big else -2.75
    casing(fs, a, uc, crown=False)
    cu, r = (-3.0, 0.5) if not big else (-3.55, 0.72)
    at = [-1.75] if not big else [-1.45, -2.0, -2.55]
    rack = [] if not big else [(-4.35, -3.0)]

    def saddle(u0):
        T._m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.42), (u0 + 0.25, 0.55), (cu + 0.5, 0.55), (cu + 0.5, 0)],
                     -0.85, 0.85, "navy", "blueGrey")
        for vv in (-(r - 0.06), r - 0.06):
            f.box(cu, vv, 0.55, 0.4, 0.16, a - 0.55, "navy", top="blueGrey")

    bed(f, u0, a, lambda v, s: (_ring_feeds(f, at, s), _rack(f, v, rack)), saddle,
        [(u - 0.24, u + 0.24) for u in at] + rack)
    for u in at:
        _field_ring(fs, u, a, True)
    fs.hcyl(cu + r - 0.12, uc, 0, a, 0.42 if not big else 0.5, "steelD", r1=0.59, sides=24)
    annulus(fs, uc - 0.14, uc - 0.02, 0.44, 0.7, a, "steelD", "steelL", sides=16)
    annulus(fs, uc - 0.2, uc - 0.14, 0.46, 0.64, a, "brass", "gm", sides=24)
    T.sphere(f, cu, 0, a, r, "steel", n=12, sides=28)
    ring(f, (cu, 0, a), "z", r + 0.02, 0.07, "oM", n=36)
    ring(f, (cu, 0, a), "v", r + 0.02, 0.07, "oM", n=36)
    if big:
        ring(f, (cu, 0, a), "u", r + 0.1, 0.04, "steelL", n=36, sides=6)
    for k in range(8 if big else 6):
        t = k * math.tau / (8 if big else 6)
        f.box(cu + (r + 0.05) * math.cos(t), (r + 0.05) * math.sin(t), a, 0.15, 0.15, 0.2, "navy", top="blueGrey",
              base=False)
    f.hcyl(cu - r - 0.1, cu - r + 0.04, 0, a, 0.18, "steelD", sides=12, capstart="lens")


# ---- AC: ring drive to everything ------------------------------------------------------------------------------------

def everything(f, fs, tier, a):
    u0 = _u0()
    if tier == 2:
        uc = -2.95
        casing(fs, a, uc)
        at = [-1.7, -2.5]
        bed(f, u0, a, lambda v, s: _ring_feeds(f, at, s), lambda u: _cap_stack(f, u, a, uc),
            [(u - 0.26, u + 0.26) for u in at])
        for u in at:
            _field_ring(fs, u, a, False)
        return
    uc = -3.35
    casing(fs, a, uc, crown=False)
    cu = _crowned(fs, a, uc, False)
    at = [-1.6, -2.35]
    pumps = [(u0 + 0.25, -3.25)]
    bed(f, u0, a, lambda v, s: _ring_feeds(f, at, s), lambda u: _header(f, u, 0.0), [(u - 0.26, u + 0.26) for u in at])
    for u in at:
        _field_ring(fs, u, a, True)
    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, pumps[-1][1] + 0.1, pumps, a, cu)
