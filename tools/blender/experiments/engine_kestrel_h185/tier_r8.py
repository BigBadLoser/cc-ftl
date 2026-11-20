"""Kestrel tier fit-out study, round 8: refining round 7's T (ring drive) and U (pump crown), and a hybrid of the two.

  W  ring drive, refined: Mk II two field rings, a capacitor stack in the saddle and a small rack in the side castings;
     Mk III three rings, the containment sphere as the rear cap itself (the casing ends in its throat), a gimbal band
     and a full capacitor rack in the castings.
  X  pump crown, refined: Mk II as round 7; Mk III a bigger crown and a booster crown, a brass feed manifold round the
     casing collecting the tandem pumps, and large accumulators on the suction header.
  Y  hybrid, a technology per tier: Mk II the pump crown (chemical, pump-fed); Mk III keeps it and adds field rings
     round the casing with capacitor bays in the castings (magnetically augmented).
"""
import math

from sprites import detail as D
from geometry import annulus, curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import R, bed, casing
from tier_r7 import _crown, _field_ring


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def _rack(f, v, spans):
    for o0, o1 in spans:
        n = max(2, int((o1 - o0) / 0.26))
        for i in range(n):
            u = o0 + (o1 - o0) * (i + 0.5) / n
            f.vcyl(u, v, 0.3, 0.12, 0.6, "lvW", top="medRed", sides=12)
            f.box(u, v + math.copysign(0.27, v), 0.83, 0.06, 0.02, 0.04, "blueN", base=False)


def _ring_feeds(f, at, side):
    for u in at:
        T.hose(f, [(u - 0.28, side * 1.4, 0.32), (u - 0.32, side * 1.45, 0.7), (u - 0.22, side * 1.25, 0.95)], 0.05)


def _cap_stack(f, u0, a, uc):
    f.box(u0 + 0.45, 0, 0, 0.8, 1.5, 0.62, "navy", top="blueGrey")
    D.slats(f, u0 + 0.12, u0 + 0.78, 0.75, 0.15, 0.5, 3, 1)
    for vv in (-0.45, 0, 0.45):
        f.vcyl(u0 + 0.42, vv, 0.62, 0.16, 0.42, "steel", top="brass", sides=14)
        f.vcyl(u0 + 0.42, vv, 0.8, 0.17, 0.05, "steelD", top="steelD", sides=14)
    curved_pipe(f, [(u0 + 0.42, 0, 1.04), (u0 + 0.55, 0, 1.15), (uc - 0.1, 0, a - 0.2)], 0.07, "gm", steps=4)


# ---- W: ring drive, refined ------------------------------------------------------------------------------------------

def ring_drive(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    if not big:
        uc = -2.95
        casing(fs, a, uc)
        at = [-1.7, -2.5]
        rack = [(-3.3, -2.85)]
        bed(f, u0, a, lambda v, s: (_ring_feeds(f, at, s), _rack(f, v, rack)),
            lambda u: _cap_stack(f, u, a, uc), [(u - 0.26, u + 0.26) for u in at] + rack)
        for u in at:
            _field_ring(fs, u, a, False)
        return
    uc = -2.75
    casing(fs, a, uc, crown=False)
    at = [-1.45, -2.0, -2.55]
    rack = [(-4.35, -3.0)]
    cu, r = -3.55, 0.72

    def saddle(u0):
        T._m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.42), (u0 + 0.25, 0.55), (u0 + 1.25, 0.55), (u0 + 1.25, 0)],
                     -0.85, 0.85, "navy", "blueGrey")
        for vv in (-0.66, 0.66):
            f.box(cu, vv, 0.55, 0.5, 0.16, a - 0.55, "navy", top="blueGrey")

    bed(f, u0, a, lambda v, s: (_ring_feeds(f, at, s), _rack(f, v, rack)), saddle,
        [(u - 0.22, u + 0.22) for u in at] + rack)
    for u in at:
        _field_ring(fs, u, a, True)
    # The sphere is the rear cap: the casing closes into a throat, banded and bolted, then the bottle.
    fs.hcyl(cu + r - 0.12, uc, 0, a, 0.5, "steelD", r1=0.59, sides=24)
    annulus(fs, uc - 0.14, uc - 0.02, 0.48, 0.7, a, "steelD", "steelL", sides=16)
    annulus(fs, uc - 0.2, uc - 0.14, 0.5, 0.64, a, "brass", "gm", sides=24)
    T.sphere(f, cu, 0, a, r, "steel", n=12, sides=28)
    ring(f, (cu, 0, a), "z", r + 0.02, 0.08, "oM", n=36)
    ring(f, (cu, 0, a), "v", r + 0.02, 0.08, "oM", n=36)
    ring(f, (cu, 0, a), "u", r + 0.1, 0.04, "steelL", n=36, sides=6)                 # gimbal band
    for k in range(8):
        t = k * math.tau / 8
        f.box(cu + (r + 0.05) * math.cos(t), (r + 0.05) * math.sin(t), a, 0.16, 0.16, 0.22, "navy", top="blueGrey",
              base=False)
    f.hcyl(cu - r - 0.1, cu - r + 0.04, 0, a, 0.2, "steelD", sides=12, capstart="lens")   # its sight port


# ---- X: pump crown, refined ------------------------------------------------------------------------------------------

def _pump_flank(f, pumps, cu, a):
    def flank(v, side):
        face = "+v" if side > 0 else "-v"
        for p0, p1 in pumps:
            T.pump(f, p0 + 0.05, p1 - 0.12, v, 0.6, 0.27, face)
            curved_pipe(f, [(p1 - 0.25, v, 0.88), (p1 - 0.3, side * 1.25, 1.3), (cu + 0.1, side * 0.95, a + 0.25),
                            (cu, side * 0.8, a + 0.2)], 0.09, "steelL", steps=4, sides=10)
            D.flange(f, (p1 - 0.28, v, 0.95), "z", 0.13, "brass", t=0.07)
    return flank


def _header(f, u0, accum=0.0):
    T._m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.3), (u0 + 0.95, 0.3), (u0 + 0.95, 0)], -0.95, 0.95, "navy", "blueGrey")
    D.seg(f, (u0 + 0.45, -1.0, 0.5), (u0 + 0.45, 1.0, 0.5), 0.17, "steel", 16, cap="steelD", capstart="steelD")
    for vv in (-0.45, 0.45):
        f.hcyl(u0 + 0.05, u0 + 0.3, vv, 0.5, 0.18, "steelD", r1=0.12, sides=16, capstart="dark")
        D.flange(f, (u0 + 0.3, vv, 0.5), "u", 0.17, "brass", t=0.06)
    if accum:
        for vv in (-0.5, 0.5):
            f.vcyl(u0 + 0.55, vv, 0.58, 0.16, 0.14, "steelD", top="steel", sides=12)
            T.sphere(f, u0 + 0.55, vv, 0.72 + accum, accum, "steel", n=10, sides=20)
            ring(f, (u0 + 0.55, vv, 0.72 + accum), "z", accum + 0.01, 0.035, "brass", n=28, sides=6)
            f.vcyl(u0 + 0.55, vv, 0.68 + 2 * accum, 0.05, 0.08, "hivis", top="hivis", sides=6)


def pump_crown(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    crowns = [(uc - 0.2, 0.66)] if not big else [(uc - 0.2, 0.8), (uc + 0.55, 0.66)]
    for u, rr in crowns:
        _crown(fs, u, a, rr)
    fs.hcyl(uc - 0.5, uc - 0.3, 0, a, 0.32, "steel", sides=16, capstart="brass")
    T.bolts(fs, uc - 0.5, a, 0.24)
    pumps = [(u0 + 0.3, -1.95)] if not big else [(u0 + 0.3, -3.1), (-2.95, -1.95)]
    feed_to = crowns[0][0] if not big else -1.75
    bed(f, u0, a, _pump_flank(f, pumps, feed_to, a), lambda u: _header(f, u, 0.36 if big else 0.0),
        [(p0 - 0.08, p1 + 0.08) for p0, p1 in pumps])
    if big:
        # Feed manifold: a brass ring round the casing collecting the pumps, a trunk back to the main crown.
        ring(fs, (-1.75, 0, a), "u", R + 0.16, 0.09, "brass", n=36, sides=8)
        annulus(fs, -1.85, -1.65, R + 0.02, R + 0.08, a, "steelD", "steel", sides=32)
        for side in (-1, 1):
            curved_pipe(f, [(-1.85, side * 0.9, a + 0.35), (-2.4, side * 0.75, a + 0.55), (crowns[1][0] + 0.15, side * 0.6,
                            a + 0.62)], 0.08, "brass", steps=4)


# ---- Y: hybrid -------------------------------------------------------------------------------------------------------

def hybrid(f, fs, tier, a):
    if tier == 2:
        return pump_crown(f, fs, 2, a)
    u0 = _u0()
    uc = -3.3
    casing(fs, a, uc, crown=False)
    crown_u = uc - 0.2
    _crown(fs, crown_u, a, 0.74)
    fs.hcyl(uc - 0.5, uc - 0.3, 0, a, 0.32, "steel", sides=16, capstart="brass")
    T.bolts(fs, uc - 0.5, a, 0.24)
    at = [-1.6, -2.4]
    pumps = [(u0 + 0.3, -3.1)]
    bays = [(u - 0.3, u + 0.3) for u in at]
    pump_flank = _pump_flank(f, pumps, crown_u, a)

    def flank(v, side):
        pump_flank(v, side)
        _ring_feeds(f, at, side)
        for o0, o1 in bays:
            T._m().prism(f, [(o0, 0.3), (o0, 0.86), (o1, 0.86), (o1, 0.3)], v + side * 0.265 - (0.03 if side < 0 else 0),
                         v + side * 0.265 + (0.03 if side > 0 else 0), "blueGrey", "steelL")
            D.slats(f, o0 + 0.06, o1 - 0.06, v + side * 0.295, 0.38, 0.7, 4, side)
            f.box((o0 + o1) / 2, v + side * 0.3, 0.8, 0.2, 0.02, 0.04, "blueN", base=False)

    bed(f, u0, a, flank, lambda u: _header(f, u, 0.3), [(p0 - 0.08, p1 + 0.08) for p0, p1 in pumps])
    for u in at:
        _field_ring(fs, u, a, False)
