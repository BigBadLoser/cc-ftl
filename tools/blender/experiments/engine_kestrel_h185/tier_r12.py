"""Kestrel tier fit-out study, round 12: new variants of round 9's AA (sponson pumps), AB (bottle) and AC (everything).

  DA sponsons first: Mk II short rear sponsons, each pump's suction bell facing inboard, a louvred sponson top and the
     crown; Mk III sponsons most of the length, tandem pumps, accumulator domes, a booster crown.
  DB growing bottle: Mk II a small bottle as the rear cap and one ring; Mk III a large bottle, three rings, and two
     satellite bottles on corner sponsons piped into it.
  DC flagship: Mk II the ring drive with louvred capacitor sponsons; Mk III field rings, the bottle as the rear cap
     and pump sponsons feeding the casing.
"""
import math

from sprites import detail as D
from geometry import annulus, curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import bed, casing
from tier_r7 import _field_ring
from tier_r8 import _cap_stack, _header, _rack, _ring_feeds
from tier_r9 import _crowned, sponson


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def bottle_cap(f, fs, a, uc, cu, r, gimbal):
    """The containment bottle as the rear cap: a throat from the casing, bands, clamps, a sight port."""
    fs.hcyl(cu + r - 0.12, uc, 0, a, 0.42 if r < 0.6 else 0.5, "steelD", r1=0.59, sides=24)
    annulus(fs, uc - 0.14, uc - 0.02, 0.44, 0.7, a, "steelD", "steelL", sides=16)
    annulus(fs, uc - 0.2, uc - 0.14, 0.46, 0.64, a, "brass", "gm", sides=24)
    T.sphere(f, cu, 0, a, r, "steel", n=12, sides=28)
    ring(f, (cu, 0, a), "z", r + 0.02, 0.07, "oM", n=36)
    ring(f, (cu, 0, a), "v", r + 0.02, 0.07, "oM", n=36)
    if gimbal:
        ring(f, (cu, 0, a), "u", r + 0.1, 0.04, "steelL", n=36, sides=6)
    n = 8 if gimbal else 6
    for k in range(n):
        t = k * math.tau / n
        f.box(cu + (r + 0.05) * math.cos(t), (r + 0.05) * math.sin(t), a, 0.15, 0.15, 0.2, "navy", top="blueGrey",
              base=False)
    f.hcyl(cu - r - 0.1, cu - r + 0.04, 0, a, 0.18, "steelD", sides=12, capstart="lens")


def cradle(f, cu, r, a):
    def saddle(u0):
        T._m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.42), (u0 + 0.25, 0.55), (cu + 0.5, 0.55), (cu + 0.5, 0)],
                     -0.85, 0.85, "navy", "blueGrey")
        for vv in (-(r - 0.06), r - 0.06):
            f.box(cu, vv, 0.55, 0.4, 0.16, a - 0.55, "navy", top="blueGrey")
    return saddle


def _louvred_top(f, side, s0, s1):
    D.slats(f, s0 + 0.1, s1 - 0.1, side * 1.655, 1.05, 1.05, 1, side, mat="dark")
    for k in range(int((s1 - s0) / 0.12)):
        u = s0 + 0.12 * (k + 0.5)
        f.box(u, side * 1.655, 1.05, 0.05, 0.4, 0.02, "dark")


# ---- DA: sponsons first ----------------------------------------------------------------------------------------------

def sponsons_first(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    cu = _crowned(fs, a, uc, big)
    pumps = [(u0 + 0.35, -2.25)] if not big else [(u0 + 0.35, -3.25), (-3.05, -1.95)]
    s1 = (-2.1 if not big else -0.9)
    bed(f, u0, a, None, lambda u: _header(f, u, 0.0))
    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, s1, pumps, a, cu, domes=big)
        _louvred_top(f, side, pumps[-1][1] + 0.15, s1) if big else None
        # Suction bells out of the sponson's inboard face.
        f.hcyl(u0 - 0.12, u0 + 0.05, side * 1.64, 0.57, 0.26, "steelD", r1=0.2, sides=16, capstart="dark")
        D.flange(f, (u0 + 0.05, side * 1.64, 0.57), "u", 0.24, "brass", t=0.05)


# ---- DB: growing bottle ----------------------------------------------------------------------------------------------

def growing_bottle(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.35 if not big else -2.75
    casing(fs, a, uc, crown=False)
    cu, r = (-3.0, 0.5) if not big else (-3.55, 0.72)
    at = [-1.75] if not big else [-1.45, -2.0, -2.55]
    rack = [] if not big else [(-2.95, -2.75)]
    bed(f, u0, a, lambda v, s: (_ring_feeds(f, at, s), _rack(f, v, rack)), cradle(f, cu, r, a),
        [(u - 0.24, u + 0.24) for u in at] + rack)
    for u in at:
        _field_ring(fs, u, a, True)
    bottle_cap(f, fs, a, uc, cu, r, big)
    if big:
        m = T._m()
        for side in (-1, 1):
            # A corner sponson carrying a satellite bottle, piped into the main one.
            lo, hi = sorted((side * 1.39, side * 1.95))
            m.prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.7), (u0 + 0.95, 0.7), (u0 + 1.2, 0.45), (u0 + 1.2, 0)], lo, hi,
                    "navy", "blueGrey")
            sv, sz, sr = side * 1.66, 0.7 + 0.36, 0.36
            T.sphere(f, u0 + 0.5, sv, sz, sr, "steel", n=10, sides=20)
            ring(f, (u0 + 0.5, sv, sz), "z", sr + 0.01, 0.05, "oM", n=28, sides=6)
            f.vcyl(u0 + 0.5, sv, 0.7, 0.2, 0.08, "steelD", top="steel", sides=12)
            curved_pipe(f, [(u0 + 0.5, side * 1.35, sz + 0.1), (u0 + 0.8, side * 1.0, a + 0.3), (cu, side * 0.5, a + 0.5)],
                        0.07, "brass", steps=4)


# ---- DC: flagship ----------------------------------------------------------------------------------------------------

def flagship(f, fs, tier, a):
    u0 = _u0()
    if tier == 2:
        uc = -2.95
        casing(fs, a, uc)
        at = [-1.7, -2.5]
        bed(f, u0, a, lambda v, s: _ring_feeds(f, at, s), lambda u: _cap_stack(f, u, a, uc),
            [(u - 0.26, u + 0.26) for u in at])
        for u in at:
            _field_ring(fs, u, a, False)
        m = T._m()
        for side in (-1, 1):
            # Capacitor sponsons: louvred cast boxes off the castings, lamps on their tops.
            lo, hi = sorted((side * 1.39, side * 1.9))
            m.prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.95), (-2.9, 0.95), (-2.65, 0.6), (-2.65, 0)], lo, hi, "navy",
                    "blueGrey")
            D.slats(f, u0 + 0.15, -2.95, side * 1.9, 0.25, 0.8, 5, side)
            for k in range(3):
                f.box(u0 + 0.25 + k * 0.15, side * 1.64, 0.95, 0.06, 0.06, 0.03, "blueN")
        return
    uc = -2.95
    casing(fs, a, uc, crown=False)
    cu, r = -3.6, 0.62
    at = [-1.6, -2.35]
    pumps = [(-2.75, -1.6)]
    bed(f, u0, a, lambda v, s: _ring_feeds(f, at, s), cradle(f, cu, r, a), [(u - 0.26, u + 0.26) for u in at])
    for u in at:
        _field_ring(fs, u, a, True)
    bottle_cap(f, fs, a, uc, cu, r, True)
    for side in (-1, 1):
        sponson(f, side, -2.9, pumps[-1][1] + 0.1, pumps, a, -1.75)
