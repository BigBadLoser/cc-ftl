"""Kestrel tier fit-out study, round 13: DA's inboard end (sponsons, suction bells, the crown) with T's field rings,
the space under the rear cap made the feature, and the sides designed as the path from it to the rings.

  EA intake plenum: the sponsons and a plenum across the back are one U casting; under the cap a framed intake
     grille, the suction bells set in its corners; copper risers from the sponson tops into the rings.
     Mk II one ring, one pump a side; Mk III two rings, two pumps a side, a booster crown.
  EB transverse pump: under the cap a big pump lies across the machine, its volute facing out and its suction bell
     on the axis; its discharges run into the sponsons, which are pump rooms with doors in step with the rings; each
     ring sits in a saddle cast up from the sponson. Mk III: two rings and a booster stage on the pump.
  EC power core: under the cap a caged bay holds a coil stack; copper bus bars leave it into the sponsons, run along
     their top edges and climb into each ring. Mk II two rings; Mk III three and a bigger core.
"""
import math

from sprites import detail as D, greeble as G
from geometry import curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import bed, casing
from tier_r7 import _field_ring
from tier_r9 import _crowned

SV0, SV1, ST = 1.39, 1.92, 0.95        # sponson inner / outer v, top


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def _m():
    return T._m()


def sponson(f, side, s0, s1, windows=(), doors=()):
    """A cast sponson off the side casting: a chamfered outer top edge, a top rail, windows (pump rooms) and doors."""
    lo, hi = sorted((side * SV0, side * SV1))
    edges = sorted({s0, s1, *[x for w in windows for x in w]})
    for p, q in zip(edges, edges[1:]):
        if any(w0 <= p and q <= w1 for w0, w1 in windows):
            _m().prism(f, [(p, 0), (p, 0.2), (q, 0.2), (q, 0)], lo, hi, "navy", "blueGrey")
            _m().prism(f, [(p, ST - 0.14), (p, ST), (q, ST), (q, ST - 0.14)], lo, hi, "navy", "blueGrey")
        else:
            _m().prism(f, [(p, 0), (p, ST), (q, ST), (q, 0)], lo, hi, "navy", "blueGrey")
    _m().prism(f, [(s1, 0), (s1, ST), (s1 + 0.3, 0.62), (s1 + 0.3, 0)], lo, hi, "navy", "blueGrey")
    # Chamfer strip along the outer top edge, and a rail along the inner one.
    f.box((s0 + s1) / 2, side * (SV1 - 0.05), ST, s1 - s0, 0.1, 0.04, "blueGrey", top="steelL")
    f.box((s0 + s1) / 2, side * (SV0 + 0.04), ST, s1 - s0, 0.08, 0.06, "steelD", top="steel")
    for d0, d1 in doors:
        D.panel(f, (d0 + d1) / 2, side * SV1, 0.5, d1 - d0, 0.6, "blueGrey", face="+v" if side > 0 else "-v",
                t=0.02, ring=0.04, bolts=True)
    for u in (s0 + 0.15, s1 - 0.05):
        T.lug(f, u, side * 1.82)


def bell(f, u, v, z, r=0.26):
    f.hcyl(u - 0.17, u, v, z, r, "steelD", r1=r * 0.78, sides=16, capstart="dark")
    D.flange(f, (u, v, z), "u", r * 0.92, "brass", t=0.05)


def riser(f, u, side, a, rr):
    """A copper riser from the sponson's top up into the ring's lower clamp: a bar in two brackets."""
    z1 = a - rr * T._m().CASSETTE_Z_FIT * math.sin(math.radians(35)) - 0.05
    v1 = side * rr * math.cos(math.radians(35))
    f.box(u, side * 1.5, ST, 0.16, 0.16, 0.08, "steelD", top="steel")
    D.seg(f, (u, side * 1.5, ST + 0.06), (u, v1 * 1.02, z1), 0.05, "oM", 8, cap="oL", capstart="oL")
    f.box(u, (side * 1.5 + v1) / 2, (ST + z1) / 2, 0.1, 0.12, 0.1, "navy", top="blueGrey", base=False)


# ---- EA: intake plenum -----------------------------------------------------------------------------------------------

def plenum(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    cu = _crowned(fs, a, uc, big)
    at = [-1.75] if not big else [-1.6, -2.3]
    pumps = [(u0 + 0.75, -2.25)] if not big else [(u0 + 0.75, -3.3), (-3.1, -2.05)]
    pd = u0 + 0.6                                                   # the plenum's fore face

    def saddle(u0):
        # The plenum: across the back between the sponsons, its face a framed grille, the bells in its corners.
        f.box((u0 + pd) / 2, 0, 0, pd - u0, 2 * SV0, ST, "navy", top="blueGrey")
        f.box(u0 - 0.01, 0, 0.12, 0.04, 2.2, 0.72, "steelD", top="steel")
        f.box(u0 - 0.03, 0, 0.18, 0.04, 2.0, 0.6, "dark")
        for k in range(5):
            f.box(u0 - 0.05, 0, 0.24 + k * 0.11, 0.04, 1.96, 0.035, "steelL")
        for z in (0.12, 0.82):
            f.box(u0 - 0.04, 0, z, 0.05, 2.24, 0.04, "brass")
    bed(f, u0, a, lambda v, s: None, saddle, [(u - 0.26, u + 0.26) for u in at])
    for side in (-1, 1):
        s1 = pumps[-1][1] + 0.1
        sponson(f, side, u0 + 0.05, s1, windows=[(p0 - 0.05, p1 + 0.05) for p0, p1 in pumps])
        bell(f, u0 + 0.04, side * 1.64, 0.55)
        for p0, p1 in pumps:
            T.pump(f, p0, p1 - 0.12, side * 1.64, 0.55, 0.28, "+v" if side > 0 else "-v")
            curved_pipe(f, [(p1 - 0.25, side * 1.64, 0.86), (p1 - 0.3, side * 1.64, ST + 0.1),
                            (cu + 0.1, side * 1.0, a + 0.2), (cu, side * 0.8, a + 0.18)], 0.08, "steelL", steps=4)
        for u in at:
            riser(f, u, side, a, 0.89 + 0.26)
    for u in at:
        _field_ring(fs, u, a, False)


# ---- EB: transverse pump ---------------------------------------------------------------------------------------------

def transverse(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    cu = _crowned(fs, a, uc, False)
    at = [-1.8] if not big else [-1.6, -2.35]
    pu = u0 + 0.55
    stages = [0.0] if not big else [-0.42, 0.42]

    def saddle(u0):
        _m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.16), (u0 + 1.05, 0.16), (u0 + 1.05, 0)], -SV0, SV0, "navy", "blueGrey")
        # The pump lies across the machine: barrel along v, volute(s) facing out, the suction bell on the axis.
        D.seg(f, (pu, -1.3, 0.5), (pu, 1.3, 0.5), 0.27, "steelD", 20, cap="steel", capstart="steel")
        for vv in stages:
            ring(f, (pu, vv, 0.5), "v", 0.36, 0.15, "navy", n=28, sides=8)
            D.seg(f, (pu, vv - 0.1, 0.5), (pu, vv + 0.1, 0.5), 0.4, "steelD", 20, cap="blueGrey", capstart="blueGrey")
        bell(f, pu - 0.4, 0, 0.5, 0.3)
        f.hcyl(pu - 0.4, pu, 0, 0.5, 0.18, "steel", sides=16)
        D.ribs(f, pu, pu, 0, 0.5, 0.27, 0.27, 1)
        for side in (-1, 1):
            f.box(pu, side * 0.95, 0.16, 0.3, 0.2, 0.1, "navy", top="blueGrey")
    bed(f, u0, a, lambda v, s: None, saddle, [(u - 0.26, u + 0.26) for u in at])
    s1 = at[0] + 0.35
    for side in (-1, 1):
        doors = [(u - 0.25, u + 0.25) for u in at] + [(pu + 0.3, pu + 0.8)]
        sponson(f, side, u0 + 0.05, s1, doors=doors)
        # The pump's discharge into the sponson, and up out of it to the crown.
        f.box(pu, side * (SV0 + 0.02), 0.5, 0.3, 0.06, 0.3, "steelD", base=False)
        curved_pipe(f, [(pu + 0.35, side * 1.64, ST), (pu + 0.4, side * 1.64, ST + 0.2), (cu + 0.1, side * 1.0, a + 0.2),
                        (cu, side * 0.8, a + 0.18)], 0.08, "steelL", steps=4)
        for u in at:
            # The ring's saddle: cast up from the sponson top to the ring's lower flank.
            lo, hi = sorted((side * 1.12, side * 1.85))
            _m().prism(f, [(u - 0.2, ST), (u - 0.2, ST + 0.1), (u - 0.1, ST + 0.28), (u + 0.1, ST + 0.28),
                           (u + 0.2, ST + 0.1), (u + 0.2, ST)], lo, hi, "navy", "blueGrey")
            f.box(u, side * (SV1 + 0.01), 0.82, 0.08, 0.02, 0.05, "blueN", base=False)
    for u in at:
        _field_ring(fs, u, a, big)


# ---- EC: power core --------------------------------------------------------------------------------------------------

def power_core(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    _crowned(fs, a, uc, False)
    at = [-1.7, -2.4] if not big else [-1.5, -2.1, -2.7]
    cr = 0.36 if not big else 0.46
    cc = u0 + 0.6

    def saddle(u0):
        # The caged bay: a dark recess under the cap, a coil stack in it, bars across its mouth.
        f.box((u0 + 1.15) / 2 + u0 / 2, 0, 0, 1.15, 2 * SV0, 0.12, "navy", top="blueGrey")
        f.box(u0 + 0.95, 0, 0.12, 0.3, 2 * SV0, 0.78, "navy", top="blueGrey")
        f.box(u0 + 0.6, 0, 0.82, 1.1, 2 * SV0, 0.1, "navy", top="blueGrey")
        f.vcyl(cc, 0, 0.12, cr + 0.06, 0.06, "steelD", top="steel", sides=24)
        for k in range(6):
            f.vcyl(cc, 0, 0.18 + k * 0.105, cr, 0.085, "oM" if k % 2 == 0 else "oD", top="oL", sides=24)
        f.vcyl(cc, 0, 0.5, cr + 0.03, 0.03, "blueN", top="blueN", sides=24)
        f.vcyl(cc, 0, 0.82, cr * 0.4, 0.04, "steelL", top="brass", sides=12)
        for k in range(7):
            vv = -0.9 + k * 0.3
            f.box(u0 + 0.06, vv, 0.12, 0.05, 0.05, 0.72, "steelL", top="steelL")
        f.box(u0 + 0.06, 0, 0.45, 0.05, 2.0, 0.04, "steelL")
        for side in (-1, 1):
            f.box(cc, side * (cr + 0.45), 0.62, 0.9, 0.08, 0.06, "oM", top="oL", base=False)   # bus out of the core
    bed(f, u0, a, lambda v, s: None, saddle, [(u - 0.26, u + 0.26) for u in at])
    s1 = at[0] + 0.35
    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, s1)
        bell(f, u0 + 0.04, side * 1.64, 0.55)
        # Bus bars along the sponson's top edge, a lamp at each ring, then the riser into it.
        f.box((cc + at[0]) / 2, side * 1.5, ST, at[0] - cc, 0.1, 0.07, "oM", top="oL")
        for u in at:
            riser(f, u, side, a, 0.89 + (0.32 if big else 0.26))
            G.disc(f, "+v" if side > 0 else "-v", u, 0.75, side * SV1, 0.05, 0, 0.02, "blueN", sides=8)
        for u in [cc + 0.3 + 0.45 * k for k in range(int((at[-1] - cc) / 0.45))]:
            D.slats(f, u - 0.15, u + 0.15, side * SV1, 0.3, 0.7, 4, side)
    for u in at:
        _field_ring(fs, u, a, big)
