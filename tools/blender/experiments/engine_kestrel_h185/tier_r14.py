"""Kestrel tier fit-out study, round 14: round 13's EA / EB / EC rebuilt with clearances, nothing ending inside
something else. Heights under the casing are taken from the thrust axis (`a`), which is 0.3 lower in rotations 1 / 2.

Rules: a field ring sits on a seat band on the casing's full-radius length (Mk II one ring, rear cap at -2.75; Mk III
two, cap at -3.15); the sump is cut away under each ring and the side castings slotted down to a sill; the casing's
crown ducts end in a flange cap ahead of the rings and the Mk I's side services are cut back clear of them; every
pipe ends on a flanged stub; every ring feed lands on the ring's outer face.

  EA intake plenum: sponsons and a plenum across the back as one U casting, a framed grille in the plenum, the suction
     bells in the sponson ends, a pump in each sponson window piped to stubs on the crown. Mk III two pumps a side.
  EB transverse pump: a pump across the machine behind the rear cap, between the side castings, its discharges up into
     stubs on the injector plate; sponson pump rooms with doors and a cast saddle up to each ring.
  EC power core: behind the rear cap an open coil stack on a plinth, copper bus bars to the sponsons, along their top
     edges and up onto each ring's outer face.
"""
import math

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import R, bed, casing
from tier_r7 import _crown

SV0, SV1, ST = 1.39, 1.92, 0.95
RR, RM = 1.2, 0.14                       # field ring radius and tube radius (on the squashed frame)
FIT = 0.66


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def _m():
    return T._m()


def rings_at(tier):
    return [-1.95] if tier == 2 else [-1.95, -2.4]


def cap_at(tier):
    return -2.75 if tier == 2 else -3.15


def field_ring(fs, u, a):
    """A field ring on a seat band: copper tube, eight navy clamps from the band to the ring."""
    annulus(fs, u - 0.2, u + 0.2, R - 0.02, 1.07, a, "steelD", "steel", sides=32)
    ring(fs, (u, 0, a), "u", RR, RM, "oM", n=40, sides=10)
    for k in range(8):
        t = k * math.tau / 8 + math.pi / 8
        fs.box(u, (RR - 0.04) * math.cos(t), a + (RR - 0.04) * math.sin(t), 0.3, 0.2, 0.2, "navy", top="blueGrey",
               base=False)


def duct_caps(fs, a):
    for side in (-1, 1):
        D.flange(fs, (T.CUT + 0.03, side * 0.79, a + 0.73), "u", 0.2, "brass", t=0.08)


def ring_bed(f, u0, a, tier, flank=None, saddle=None, openings=(), sump=None):
    at = rings_at(tier)
    spans = [(u - 0.24, u + 0.24) for u in at]
    bed(f, u0, a, flank or (lambda v, s: None), saddle, openings, gaps=spans, slots=spans, sump=sump)


def sponson(f, side, s0, s1, windows=(), doors=()):
    lo, hi = sorted((side * SV0, side * SV1))
    edges = sorted({s0, s1, *[x for w in windows for x in w]})
    for p, q in zip(edges, edges[1:]):
        if any(w0 <= p and q <= w1 for w0, w1 in windows):
            _m().prism(f, [(p, 0), (p, 0.2), (q, 0.2), (q, 0)], lo, hi, "navy", "blueGrey")
            _m().prism(f, [(p, ST - 0.12), (p, ST), (q, ST), (q, ST - 0.12)], lo, hi, "navy", "blueGrey")
        else:
            _m().prism(f, [(p, 0), (p, ST), (q, ST), (q, 0)], lo, hi, "navy", "blueGrey")
    _m().prism(f, [(s1, 0), (s1, ST), (s1 + 0.3, 0.62), (s1 + 0.3, 0)], lo, hi, "navy", "blueGrey")
    f.box((s0 + s1) / 2, side * (SV1 - 0.06), ST, s1 - s0, 0.12, 0.04, "blueGrey", top="steelL")
    for d0, d1 in doors:
        D.panel(f, (d0 + d1) / 2, side * SV1, 0.48, d1 - d0, 0.56, "blueGrey", face="+v" if side > 0 else "-v",
                t=0.02, ring=0.04, bolts=True)
    for u in (s0 + 0.15, s1 + 0.15):
        T.lug(f, u, side * 1.8)


def bell(f, u, v, z, r=0.24):
    f.hcyl(u - 0.16, u, v, z, r, "steelD", r1=r * 0.78, sides=16, capstart="dark")
    D.flange(f, (u, v, z), "u", r * 0.92, "brass", t=0.05)


def stub(f, u, side, z, v0, v1=None):
    """A flanged inlet stub out of a round casting at (u, side * v0, z), ending at side * v1."""
    v1 = v1 or v0 + 0.2
    D.seg(f, (u, side * v0, z), (u, side * v1, z), 0.09, "steel", 12, cap="steelL")
    D.flange(f, (u, side * v1, z), "v", 0.14, "brass", t=0.06)
    return side * (v1 + 0.03)


def pipe_to(f, start, end_v, end_u, z, side):
    """From a pump's volute top straight up, over the sponson top, to a stub at (end_u, end_v, z)."""
    u0, v0, z0 = start
    curved_pipe(f, [(u0, v0, z0), (u0, v0, max(z0 + 0.15, ST + 0.15)), ((u0 + end_u) / 2, side * 1.58, (ST + z) / 2 + 0.1),
                    (end_u, end_v + side * 0.25, z), (end_u, end_v, z)], 0.08, "steelL", steps=4, sides=10)


# ---- EA: intake plenum -----------------------------------------------------------------------------------------------

def plenum(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = cap_at(tier)
    casing(fs, a, uc, crown=False, ducts=False, lid=False)
    duct_caps(fs, a)
    cu, cr = uc - 0.2, 0.62
    _crown(fs, cu, a, cr)
    fs.hcyl(uc - 0.5, uc - 0.32, 0, a, 0.3, "steel", sides=16, capstart="brass")
    pumps = [(u0 + 0.5, -2.25)] if not big else [(u0 + 0.5, -3.35), (-3.15, -2.25)]
    pd = u0 + 0.5
    top = a - 0.66

    def saddle(u0):
        f.box((u0 + pd) / 2, 0, 0, pd - u0, 2 * SV0, top, "navy", top="blueGrey")
        f.box(u0 - 0.02, 0, 0.1, 0.04, 2.3, top - 0.18, "steelD", top="steel")             # grille frame
        f.box(u0 - 0.04, 0, 0.16, 0.04, 2.1, top - 0.3, "dark")
        n = max(2, int((top - 0.3) / 0.1))
        for k in range(n):
            f.box(u0 - 0.06, 0, 0.19 + k * (top - 0.34) / n, 0.04, 2.06, 0.03, "steelL")
        f.box(u0 - 0.05, 0, top - 0.12, 0.05, 2.34, 0.04, "brass")
    ring_bed(f, u0, a, tier, saddle=saddle)
    for side in (-1, 1):
        s1 = pumps[-1][1] + 0.1
        sponson(f, side, u0 + 0.05, s1, windows=[(p0 - 0.04, p1 + 0.04) for p0, p1 in pumps])
        bell(f, u0 + 0.05, side * 1.65, 0.55)
        for i, (p0, p1) in enumerate(pumps):
            T.pump(f, p0, p1 - 0.12, side * 1.65, 0.55, 0.25, "+v" if side > 0 else "-v")
            angle = 0 if i == 0 else 0.5                              # the stubs, round the crown
            zz = a + (cr + 0.2) * math.sin(angle) * FIT
            vv = stub(f, cu, side, zz, (cr + 0.2) * math.cos(angle))
            pipe_to(f, (p1 - 0.28, side * 1.65, 0.55 + 0.25 + 0.08), vv, cu, zz, side)
            D.flange(f, (p1 - 0.28, side * 1.65, ST + 0.02), "z", 0.14, "brass", t=0.06)   # its gland in the rail
    for u in rings_at(tier):
        field_ring(fs, u, a)


# ---- EB: transverse pump ---------------------------------------------------------------------------------------------

def transverse(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = cap_at(tier)
    casing(fs, a, uc, crown=True, ducts=False, lid=False)
    duct_caps(fs, a)
    pu, pz = uc - 0.42, 0.5
    stages = [0.0] if not big else [-0.4, 0.4]
    vr = 0.26 if big else 0.3

    def saddle(u0):
        _m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.12), (uc - 0.05, 0.12), (uc - 0.05, 0)], -0.85, 0.85, "navy", "blueGrey")
        D.seg(f, (pu, -0.82, pz), (pu, 0.82, pz), 0.2, "steelD", 20, cap="steel", capstart="steel")
        for vv in stages:
            ring(f, (pu, vv, pz), "v", vr, 0.11, "navy", n=28, sides=8)
            D.seg(f, (pu, vv - 0.08, pz), (pu, vv + 0.08, pz), vr, "steelD", 20, cap="blueGrey", capstart="blueGrey")
        f.hcyl(u0 + 0.15, pu - 0.3, 0, pz, 0.12, "steel", sides=12)
        bell(f, u0 + 0.15, 0, pz, 0.24)
        for side in (-1, 1):
            f.box(pu, side * 0.65, 0.12, 0.26, 0.16, pz - 0.32, "navy", top="blueGrey")
            # Discharge: up off the barrel's end into a stub on the injector plate's flank.
            curved_pipe(f, [(pu, side * 0.7, pz + 0.18), (pu, side * 0.7, a - 0.2), (uc - 0.2, side * 0.5, a - 0.05),
                            (uc - 0.13, side * 0.42, a)], 0.07, "steelL", steps=4, sides=10)
            D.flange(f, (uc - 0.14, side * 0.42, a), "u", 0.11, "brass", t=0.05)
    ring_bed(f, u0, a, tier, saddle=saddle)
    at = rings_at(tier)
    for side in (-1, 1):
        s1 = at[0] + 0.38
        sponson(f, side, u0 + 0.05, s1, doors=[(u0 + 0.2, u0 + 0.7)] + [(u - 0.22, u + 0.22) for u in at])
        bell(f, u0 + 0.05, side * 1.65, 0.55)
        for u in at:
            # The ring's saddle: cast up from the sponson's top to meet the ring's outer face.
            lo, hi = sorted((side * 1.33, side * 1.8))
            _m().prism(f, [(u - 0.18, ST), (u - 0.18, ST + 0.06), (u - 0.08, a - 0.12), (u + 0.08, a - 0.12),
                           (u + 0.18, ST + 0.06), (u + 0.18, ST)], lo, hi, "navy", "blueGrey")
            G.disc(f, "+v" if side > 0 else "-v", u, 0.82, side * SV1, 0.045, 0, 0.02, "blueN", sides=8)
    for u in at:
        field_ring(fs, u, a)


# ---- EC: power core --------------------------------------------------------------------------------------------------

def power_core(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = cap_at(tier)
    casing(fs, a, uc, crown=True, ducts=False, lid=False)
    duct_caps(fs, a)
    cr = 0.3 if not big else 0.42
    cc = (u0 + uc - 0.25) / 2
    h = 1.45 if not big else 1.7

    def saddle(u0):
        f.box(cc, 0, 0, 2 * cr + 0.3, 2 * cr + 0.3, 0.16, "navy", top="blueGrey")
        f.vcyl(cc, 0, 0.16, cr + 0.08, 0.06, "steelD", top="steel", sides=24)
        n = int((h - 0.4) / 0.12)
        for k in range(n):
            f.vcyl(cc, 0, 0.22 + k * 0.12, cr, 0.1, "oM" if k % 2 == 0 else "oL", top="oL", sides=24)
        f.vcyl(cc, 0, 0.22 + n * 0.12, cr + 0.06, 0.08, "steelD", top="steel", sides=24)
        f.vcyl(cc, 0, 0.3 + n * 0.12, 0.12, 0.08, "brass", top="steelL", sides=12)
        for k in range(4):                                                   # four tie rods round the stack
            t = k * math.tau / 4 + math.pi / 4
            f.vcyl(cc + (cr + 0.1) * math.cos(t), (cr + 0.1) * math.sin(t), 0.16, 0.035, 0.14 + n * 0.12, "steelL",
                   top="steelL", sides=6)
        f.vcyl(cc, 0, 0.22 + (n // 2) * 0.12, cr + 0.02, 0.03, "blueN", top="blueN", sides=24)
    ring_bed(f, u0, a, tier, saddle=saddle)
    at = rings_at(tier)
    for side in (-1, 1):
        s1 = at[0] + 0.38
        sponson(f, side, u0 + 0.05, s1)
        bell(f, u0 + 0.05, side * 1.65, 0.55)
        # Bus bar: out of the stack to the sponson, along its top edge, up and onto each ring's outer face.
        f.box(cc, side * (cr + 0.55), 0.7, 0.1, 1.1 - cr, 0.08, "oM", top="oL", base=False)
        f.box(cc, side * 1.5, 0.7, 0.1, 0.1, ST - 0.7, "oM", top="oL")
        f.box((cc + at[0]) / 2, side * 1.5, ST, at[0] - cc + 0.1, 0.1, 0.07, "oM", top="oL")
        for u in at:
            f.box(u, side * 1.5, ST, 0.1, 0.1, a - ST, "oM", top="oL")
            f.box(u, side * 1.42, a - 0.05, 0.1, 0.16, 0.1, "oM", top="oL")
            f.box(u, side * 1.5, ST, 0.22, 0.2, 0.06, "steelD", top="steel")
        for k in range(int((at[0] - u0 - 0.6) / 0.4)):
            um = u0 + 0.5 + 0.4 * k
            D.slats(f, um - 0.13, um + 0.13, side * SV1, 0.3, 0.72, 4, side)
    for u in at:
        field_ring(fs, u, a)
