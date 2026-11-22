"""Kestrel tier fit-out study, round 18: IB (round 17) polished. The rear cap, crown and field rings move 0.3 forward,
deepening the clear space behind the crown, and each take uses it to make the tank bigger.

  JA pressure sphere: a large sphere on a ring cradle behind the crown, feeding the low tank that runs on under the
     casing. Mk III: twin spheres and twin tanks.
  JB bottle: the tank itself swells behind the crown into a large body and necks down to run on under the casing.
     Mk III: twin bottles, a manway on each body.
  JC standing bottles: a pair of tall banded bottles standing behind the crown either side of the stem, piped down
     into the low tank. Mk III: four bottles in two rows and twin tanks.
"""
import math

from sprites import detail as D, greeble as G
from geometry import curved_pipe
import tierkit as T
from tier_r15 import _trunk, fa_base

S = 0.3           # how far the rear cap, crown and rings move outboard
W = 0.84


def _none(u0, ue, stem_u):
    return None


def _stem(big):
    return (-2.45 if not big else -2.9) + S - 0.45


def frustum(f, u0, v, z0, r0, u1, z1, r1, mat, sides=20):
    """A lathed band along u at v from (u0, r0 about z0) to (u1, r1 about z1)."""
    def p(u, r, z, t):
        return f.pt(u, v + r * math.cos(t), z + r * math.sin(t))
    for i in range(sides):
        t, s = math.tau * i / sides, math.tau * (i + 1) / sides
        f.poly([p(u0, r0, z0, t), p(u0, r0, z0, s), p(u1, r1, z1, s), p(u1, r1, z1, t)], mat, flip=True)


def low_tank(f, p, q, v, r, valve=False):
    """The IB tank under the casing: domed inboard end at p, banding, saddles."""
    zc = 0.06 + r
    f.hcyl(p + 0.12, q, v, zc, r, "steelL", sides=20, cap="steel")
    f.hcyl(p, p + 0.12, v, zc, r * 0.82, "steelL", r1=r, sides=20, capstart="steelL")
    n = max(2, int((q - p) / 0.45))
    for k in range(n):
        u = p + 0.3 + k * (q - p - 0.45) / max(1, n - 1)
        f.hcyl(u - 0.03, u + 0.03, v, zc, r + 0.02, "brass", sides=20, cap="brass", capstart="brass")
    for u in (p + 0.25, q - 0.2):
        f.box(u, v, 0, 0.12, r * 1.6, zc - r * 0.55, "navy", top="blueGrey")
    if valve:
        D.seg(f, (p, v, zc), (p - 0.14, v, zc), 0.06, "steel", 10, cap="steelL")
        G.valve_wheel(f, "-u", v, zc, p - 0.14, r=0.1)
    return zc


def _deck(f, segs, u0, q):
    for p2, q2 in segs[1:]:
        f.box((p2 + q2) / 2, 0, 0, q2 - p2, 2 * W, 0.12, "steelD", top="steel")
    f.box((u0 + 0.05 + q) / 2, 0, 0, q - u0 - 0.05, 2 * W, 0.06, "plateA", top="plateB")


def _r_low(a):
    return (a - 0.63 - 0.08) / 2


# ---- JA: pressure sphere ---------------------------------------------------------------------------------------------

def sphere(f, fs, tier, a):
    big = tier == 3
    stem_u = _stem(big)

    def sump(segs):
        u0 = segs[0][0] - 0.15
        q = segs[0][1] - 0.05
        rl = _r_low(a)
        vs = (0,) if not big else (-0.42, 0.42)
        rs = min(0.4, (stem_u - 0.05 - u0 - 0.1) / 2) if not big else 0.4
        su = u0 + 0.05 + rs + 0.05
        sz = rs + 0.2
        for v in vs:
            T.tank(f, su, v, sz, rs)
            p = su + rs + 0.12
            zc = low_tank(f, p, q, v, rl)
            curved_pipe(f, [(su + rs * 0.6, v, sz - rs * 0.6), (p - 0.12, v, zc - 0.05), (p, v, zc)], 0.07, "steel",
                        steps=3, sides=10)
            D.flange(f, (p - 0.02, v, zc), "u", 0.12, "brass", t=0.04)
        tz = sz + rs + 0.05
        if big:
            D.seg(f, (su, -0.42, tz + 0.08), (su, 0.42, tz + 0.08), 0.06, "steel", 10, cap="steelL", capstart="steelL")
        _trunk(f, su, tz + 0.08, stem_u, a)
        _deck(f, segs, u0, q)

    fa_base(f, fs, tier, a, _none, sump=sump, s=S)


# ---- JB: bottle ------------------------------------------------------------------------------------------------------

def bottle(f, fs, tier, a):
    big = tier == 3
    stem_u = _stem(big)

    def sump(segs):
        u0 = segs[0][0] - 0.15
        q = segs[0][1] - 0.05
        rl = _r_low(a)
        vs = (0,) if not big else (-0.42, 0.42)
        rb = 0.44 if not big else 0.4
        zb = 0.06 + rb
        pb, qb = u0 + 0.25, stem_u - 0.15
        for v in vs:
            # Domed inboard end, the body, a neck down to the low tank.
            frustum(f, pb - 0.2, v, zb, 0.02, pb - 0.12, zb, rb * 0.62, "steelL")
            frustum(f, pb - 0.12, v, zb, rb * 0.62, pb, zb, rb, "steelL")
            f.hcyl(pb, qb, v, zb, rb, "steelL", sides=24)
            zl = 0.06 + rl
            frustum(f, qb, v, zb, rb, qb + 0.22, zl, rl, "steelL")
            low_tank(f, qb + 0.1, q, v, rl)
            for u in (pb + 0.08, qb - 0.08):
                f.hcyl(u - 0.035, u + 0.035, v, zb, rb + 0.025, "brass", sides=24, cap="brass", capstart="brass")
            f.box((pb + qb) / 2, v, 0, 0.14, rb * 1.5, zb - rb * 0.6, "navy", top="blueGrey")
            D.seg(f, (pb - 0.2, v, zb), (pb - 0.3, v, zb), 0.06, "steel", 10, cap="steelL")
            G.valve_wheel(f, "-u", v, zb, pb - 0.3, r=0.11)
            if big:
                f.vcyl((pb + qb) / 2, v, zb + rb - 0.06, 0.14, 0.1, "steelD", top="plate", sides=12)
        tz = zb + rb + (0.1 if big else 0)
        if not big:
            _trunk(f, (pb + qb) / 2, tz, stem_u, a)
        else:
            hu = qb - 0.1
            D.seg(f, (hu, -0.42, tz), (hu, 0.42, tz), 0.06, "steel", 10, cap="steelL", capstart="steelL")
            _trunk(f, hu, tz, stem_u, a)
        _deck(f, segs, u0, q)

    fa_base(f, fs, tier, a, _none, sump=sump, s=S)


# ---- JC: standing bottles --------------------------------------------------------------------------------------------

def _standing(f, u, v, r, h):
    f.vcyl(u, v, 0, r + 0.06, 0.12, "navy", top="blueGrey", sides=16)
    f.vcyl(u, v, 0.12, r, h - 0.12, "steelL", top="steelL", sides=18)
    z = h
    for k, dz in ((0.8, 0.07), (0.5, 0.05), (0.18, 0.04)):
        f.vcyl(u, v, z, r * k, dz, "steelL", top="steelL", sides=18)
        z += dz
    for zb in (0.35, h - 0.25):
        f.vcyl(u, v, zb, r + 0.02, 0.06, "brass", top="brass", sides=18)
    f.vcyl(u, v, h + 0.16, 0.05, 0.1, "steel", top="plate", sides=8)


def standing(f, fs, tier, a):
    big = tier == 3

    def sump(segs):
        u0 = segs[0][0] - 0.15
        q = segs[0][1] - 0.05
        rl = _r_low(a)
        r, h = 0.25, 1.3
        rows = [u0 + 0.05 + 0.33] if not big else [u0 + 0.05 + 0.33, u0 + 0.05 + 0.92]
        vt = (0,) if not big else (-0.42, 0.42)
        p = rows[-1] + 0.36
        for v in vt:
            low_tank(f, p, q, v, rl)
        zl = 0.06 + rl
        for u in rows:
            for side in (-1, 1):
                _standing(f, u, side * 0.52, r, h)
        # Header across the last row's feet into the tank end(s), and a feed up from it to the stem.
        hu = rows[-1] + 0.2
        D.seg(f, (hu, -0.52, 0.2), (hu, 0.52, 0.2), 0.06, "steel", 10, cap="steelL", capstart="steelL")
        for u in rows:
            for side in (-1, 1):
                D.seg(f, (u + r * 0.9, side * 0.52, 0.2), (hu, side * 0.52, 0.2), 0.05, "steel", 8)
        for v in vt:
            curved_pipe(f, [(hu, v, 0.2), (p - 0.1, v, zl - 0.04), (p, v, zl)], 0.06, "steel", steps=3, sides=10)
        if big:
            D.seg(f, (rows[0], -0.52, h - 0.1), (rows[1], -0.52, h - 0.1), 0.04, "steelL", 8)
            D.seg(f, (rows[0], 0.52, h - 0.1), (rows[1], 0.52, h - 0.1), 0.04, "steelL", 8)
        _deck(f, segs, u0, q)

    fa_base(f, fs, tier, a, _none, sump=sump, s=S)
