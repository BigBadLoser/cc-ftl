"""Kestrel Mk II / Mk III: the inboard fit-out of the deeper engine tiers (4x6, 4x7). Study stage (round 2).

The hull row, bulkhead and bell are the Mk I's. A tier cuts the cassette's inboard end off (`cut`: the Mk I faces
inboard of a u are dropped, the injector plate and pump crown armour with them) and grows its own machinery out of the
casing, down to the footprint's inboard edge at u = 2.5 - DEPTH. Built in final coordinates: the thrust axis at
model.THRUST_Z (read while the model is lowered for stage 8), the deck at z = 0, nothing above the 2.05 roof. Round
castings that continue the cassette go on `fs`, squashed about the axis like the cassette. Same family as Mk I: navy
and blue-grey castings, steel trim, brass gaskets and unions, the same fasteners. Tiers read by shape and equipment.

Concepts:
  D  side pumps: the casing necks into a pre-burner drum; two turbopumps on cradles either side discharge into it.
     Mk III: a longer two-stage drum, bigger pumps, and two spherical propellant tanks feeding the pumps.
  E  inline pump: a coaxial turbopump continues the axis (inducer, volute, turbine), its turbine exhaust ducted
     along the deck to a dump beside the bulkhead. Mk III: a booster stage, and a saddle tank across the back.
  F  twin pre-burners: the casing ends in a Y; two angled pre-burners, a turbopump between them, low on the axis.
     Mk III: a pump per pre-burner, longer pre-burners, and a large spherical tank on the axis behind.
"""
import math
import sys

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe, sleeve, torus

CUT = -1.5              # the Mk I powerhead's faces inboard of this go (the injector plate, rear armour and clamps)


def cut(variant, name):
    return CUT if name == "powerhead" else -99


def _m():
    return sys.modules["model"]


def sphere(f, u, v, z, r, mat, n=8, sides=16):
    """A sphere as stacked frustums along u."""
    for i in range(n):
        a, b = math.pi * i / n, math.pi * (i + 1) / n
        f.hcyl(u - r * math.cos(a), u - r * math.cos(b), v, z, max(r * math.sin(a), 0.01), mat,
               r1=max(r * math.sin(b), 0.01), sides=sides)


def lug(f, u, v):
    """A mounting lug bolted to the deck, as on the Mk I's cast supports."""
    f.box(u, v, 0, 0.34, 0.34, 0.16, "steel", top="plate")
    G.disc(f, "z", u, v, 0.16, 0.07, 0, 0.05, "steelD", sides=6)


def bolts(f, u, a, r, n=6, face="-u"):
    for k in range(n):
        t = k * math.tau / n + math.pi / n
        G.disc(f, face, r * math.cos(t), a + r * math.sin(t), u, 0.045, 0, 0.04, "plate", sides=6)


def neck(fs, a, u1, r1):
    """The casing, cut at CUT, closes down to radius r1 at u1, with a clamp ring and gasket over the joint."""
    sleeve(fs, [(CUT + 0.02, 0.93, a), (CUT - 0.2, 0.9, a), (CUT - 0.42, 0.8, a), (u1, r1, a)], "steelD", sides=32)
    annulus(fs, CUT - 0.1, CUT + 0.04, 0.8, 1.0, a, "steelD", "steelL", sides=16)
    annulus(fs, CUT - 0.14, CUT - 0.1, 0.82, 0.95, a, "brass", "gm", sides=24)
    for k in range(4):
        t = k * math.pi / 2 + math.pi / 4
        _m().petal(fs, [(CUT - 0.1, 0.99, a), (CUT + 0.2, 1.02, a)], t - 0.09, t + 0.09, "steelL", thick=0.13)


def drum(fs, a, u0, u1, r, rings=2):
    """A pre-burner drum on the axis (u0 its inboard end), domed, banded, its igniter boss on the dome."""
    fs.hcyl(u0, u1, 0, a, r, "navy", sides=32)
    sleeve(fs, [(u0 - 0.26, 0.2, a), (u0 - 0.18, r * 0.72, a), (u0 - 0.06, r * 0.96, a), (u0, r, a)], "steel", sides=32)
    for k in range(rings):
        u = u0 + (u1 - u0) * (k + 0.5) / rings
        annulus(fs, u - 0.06, u + 0.06, r - 0.02, r + 0.07, a, "blueGrey", "steelL", sides=32)
    fs.hcyl(u0 - 0.34, u0 - 0.26, 0, a, 0.13, "steelD", sides=10, capstart="brass")
    bolts(fs, u0 - 0.26, a, 0.17)


def pump(f, u0, u1, v, z, r, face):
    """A turbopump along u: suction bell at u0, barrel, volute at u1 (its discharge rising from the top)."""
    f.hcyl(u0 - 0.14, u0, v, z, r * 0.62, "steel", r1=r * 0.9, sides=16, capstart="dark")
    f.hcyl(u0, u1, v, z, r, "steelD", sides=16, cap="steelL")
    D.ribs(f, u0 + 0.12, u1 - 0.3, v, z, r, r, 3, thick=0.05, grow=0.03, mat="gm", sides=16)
    torus(f, u1 - 0.16, v, z, r * 1.02, r * 0.32, "navy", n=20, sides=8)
    f.hcyl(u1, u1 + 0.1, v, z, r * 0.7, "steel", sides=16, cap="blueGrey")           # turbine end cover
    G.hatch(f, face, (u0 + u1) / 2, z, v + math.copysign(r + 0.01, v), w=min(0.42, u1 - u0 - 0.3), h=r * 0.8)


def cradle(f, u0, u1, v, top, w=0.5):
    _m().prism(f, [(u0, 0), (u0, top - 0.1), (u0 + 0.12, top), (u1 - 0.12, top), (u1, top - 0.1), (u1, 0)],
               v - w / 2, v + w / 2, "navy", "blueGrey")
    for u in (u0 + 0.14, u1 - 0.14):
        lug(f, u, v + math.copysign(w / 2 + 0.12, v) if v else v)


def tank(f, u, v, z, r):
    """A spherical propellant tank on a ring cradle, a girth flange and a top fill boss."""
    f.vcyl(u, v, 0, r * 0.7, z - r * 0.7, "navy", top="blueGrey", sides=16)
    sphere(f, u, v, z, r, "steel", n=10, sides=20)
    f.vcyl(u, v, z - 0.03, r + 0.025, 0.06, "steelL", top="steelL", sides=20)
    f.vcyl(u, v, z + r - 0.05, 0.15, 0.1, "steelD", top="plate", sides=10)
    for k in (-1, 1):
        lug(f, u + k * (r * 0.7 + 0.1), v)


# ---- D: side pumps ---------------------------------------------------------------------------------------------------

def side_pumps(f, fs, tier, a):
    neck(fs, a, -1.98, 0.66 if tier == 2 else 0.7)
    d0 = -3.0 if tier == 2 else -3.35
    r = 0.66 if tier == 2 else 0.7
    drum(fs, a, d0, -1.98, r, rings=2 if tier == 2 else 3)
    if tier == 3:
        annulus(fs, -2.68, -2.6, r - 0.05, r + 0.12, a, "steelD", "steel", sides=32)      # the stage joint
        annulus(fs, -2.6, -2.56, r - 0.02, r + 0.06, a, "brass", "gm", sides=32)
    pr = 0.34 if tier == 2 else 0.42
    pu0, pu1 = (-3.2, -2.05) if tier == 2 else (-3.55, -2.05)
    pz = 0.2 + pr + 0.06
    for side in (-1, 1):
        v = side * (1.25 if tier == 2 else 1.3)
        face = "+v" if side > 0 else "-v"
        cradle(f, pu0 + 0.05, pu1 - 0.1, v, pz - pr + 0.04)
        pump(f, pu0, pu1, v, pz, pr, face)
        # Discharge: up off the volute and into the drum's flank.
        curved_pipe(f, [(pu1 - 0.16, v, pz + pr + 0.1), (pu1 - 0.22, v, pz + pr + 0.42),
                        (pu1 - 0.45, side * (r + 0.42), a + 0.18), (pu1 - 0.55, side * (r - 0.05), a + 0.08)],
                    0.11, "steelL", steps=5, sides=12)
        D.flange(f, (pu1 - 0.53, side * (r + 0.08), a + 0.09), "v", 0.17, "brass", t=0.09)
        G.valve_wheel(f, face, pu0 + 0.25, pz + pr + 0.05, v, r=0.1)
        if tier == 3:
            tank(f, -4.05, side * 0.98, 0.95, 0.55)
            curved_pipe(f, [(-3.6, side * 1.15, 0.62), (-3.68, v, pz), (pu0 - 0.13, v, pz)], 0.1, "gm", steps=4, sides=10)
            D.flange(f, (pu0 - 0.2, v, pz), "u", 0.15, "brass", t=0.08)


# ---- E: inline pump --------------------------------------------------------------------------------------------------

def inline_pump(f, fs, tier, a):
    neck(fs, a, -1.95, 0.5)
    fs.hcyl(-2.25, -1.95, 0, a, 0.45, "steel", r1=0.5, sides=32)                          # inducer housing
    torus(fs, -2.45, 0, a, 0.56, 0.26, "navy", n=28, sides=10)                             # main volute
    fs.hcyl(-2.7, -2.25, 0, a, 0.5, "steelD", sides=32)
    stages = [(-2.45, 0.56)]
    t0 = -2.7
    if tier == 3:
        fs.hcyl(-3.2, -2.7, 0, a, 0.46, "steelD", sides=32)
        torus(fs, -3.0, 0, a, 0.5, 0.22, "navy", n=28, sides=10)                           # booster volute
        annulus(fs, -2.76, -2.66, 0.44, 0.62, a, "steelD", "steelL", sides=16)
        stages.append((-3.0, 0.5))
        t0 = -3.2
    # Turbine housing: ribbed, then the suction bellmouth on the axis.
    tu = t0 - 0.55
    fs.hcyl(tu, t0, 0, a, 0.6, "steelD", sides=32, capstart="steel")
    D.ribs(fs, tu + 0.08, t0 - 0.08, 0, a, 0.6, 0.6, 4, thick=0.05, grow=0.04, mat="gm", sides=32)
    annulus(fs, t0 - 0.06, t0 + 0.04, 0.42, 0.68, a, "brass", "gm", sides=24)
    bolts(fs, tu, a, 0.42, n=8)
    # Volute discharges: short elbows from each volute back into the casing.
    for u, rr in stages:
        for side in (-1, 1):
            curved_pipe(f, [(u, side * (rr + 0.22), a + 0.05), (u + 0.25, side * (rr + 0.32), a + 0.25),
                            (CUT - 0.05, side * 0.8, a + 0.3)], 0.09, "steelL", steps=4, sides=10)
    # Turbine exhaust: off the housing's +v side, down to a deck duct running out to a dump beside the bulkhead.
    ex = 1.62
    curved_pipe(f, [(tu + 0.28, 0.5, a - 0.1), (tu + 0.32, 1.15, a - 0.2), (tu + 0.5, ex, 0.7), (tu + 0.8, ex, 0.4)],
                0.17, "steel", steps=5, sides=12)
    f.hcyl(tu + 0.8, 0.85, ex, 0.4, 0.18, "steel", sides=12)
    for u in (tu + 1.0, -1.0, 0.2):
        D.flange(f, (u, ex, 0.4), "u", 0.24, "steelD", t=0.08)
        f.box(u, ex, 0, 0.14, 0.32, 0.22, "navy", top="blueGrey")
    f.box(1.05, ex, 0, 0.4, 0.5, 0.75, "navy", top="blueGrey")                             # the dump valve box
    G.valve_wheel(f, "+v", 1.05, 0.5, ex + 0.25, r=0.11)
    # Suction: the feed lines come up through the deck to the bellmouth.
    for side in (-1, 1):
        curved_pipe(f, [(tu - 0.35, side * 0.55, 0.0), (tu - 0.35, side * 0.55, 0.5), (tu - 0.25, side * 0.3, a - 0.2),
                        (tu - 0.02, side * 0.2, a - 0.1)], 0.1, "gm", steps=4, sides=10)
        f.box(tu - 0.35, side * 0.55, 0, 0.36, 0.36, 0.08, "steel", top="plate")
    cradle(f, tu + 0.05, -1.75, 0, a - 0.48, w=0.9)
    if tier == 3:
        # A saddle tank across the back of the footprint, on two cradles.
        u, z, r = -4.05, 0.82, 0.48
        D.seg(f, (u, -1.25, z), (u, 1.25, z), r, "steel", 20)
        for side in (-1, 1):
            sphere(f, u, side * 1.25, z, r, "steel", n=8, sides=16)    # (domed ends, as spheres)
            f.box(u, side * 0.8, 0, 0.62, 0.22, z - 0.2, "navy", top="blueGrey")
            lug(f, u + 0.42, side * 0.8)
        for vv in (-0.45, 0.45):
            D.flange(f, (u, vv, z), "v", r + 0.04, "steelL", t=0.06)
        curved_pipe(f, [(u + 0.4, 0, z), (u + 0.55, 0, 0.5), (tu - 0.35, 0, 0.3)], 0.1, "gm", steps=4)


# ---- F: twin pre-burners ---------------------------------------------------------------------------------------------

def twin_preburners(f, fs, tier, a):
    neck(fs, a, -1.95, 0.7)
    fs.hcyl(-2.15, -1.95, 0, a, 0.72, "steel", sides=32, capstart="steelD")                # the Y manifold's back plate
    bolts(fs, -2.15, a, 0.55, n=8)
    length = 1.05 if tier == 2 else 1.5
    spread = 0.62 if tier == 2 else 0.78
    r = 0.34
    for side in (-1, 1):
        p0 = (-2.1, side * 0.32, a)
        p1 = (-2.1 - length, side * (0.32 + spread), a - 0.08)
        D.seg(f, p0, p1, r, "navy", 20)
        sphere(f, p1[0], p1[1], p1[2], r, "steel", n=8, sides=20)
        for t in (0.3, 0.75):
            q = tuple(x + (y - x) * t for x, y in zip(p0, p1))
            D.seg(f, (q[0] + 0.05, q[1] + side * 0.03 * spread, q[2]), (q[0] - 0.05, q[1] - side * 0.0, q[2]), r + 0.05,
                  "blueGrey", 20)
        f.box(p1[0] + 0.2, p1[1], 0, 0.4, 0.4, p1[2] - r + 0.05, "navy", top="blueGrey")
        lug(f, p1[0] + 0.2, p1[1] + side * 0.32)
        f.hcyl(p1[0] - r - 0.1, p1[0] - r + 0.02, p1[1], p1[2], 0.11, "steelD", sides=10, capstart="brass")
        if tier == 3:
            v = side * 1.55
            pump(f, -3.5, -2.35, v, 0.52, 0.32, "+v" if side > 0 else "-v")
            cradle(f, -3.45, -2.45, v, 0.24, w=0.42)
            curved_pipe(f, [(-2.51, v, 0.88), (-2.6, v, 1.15), (-2.85, side * 1.22, a + 0.05),
                            (-2.95, side * 1.0, a)], 0.09, "steelL", steps=4, sides=10)
    pu0 = -3.3 if tier == 2 else -3.6
    pump(f, pu0, -2.3, 0, 0.5, 0.3, "+v")
    cradle(f, pu0 + 0.05, -2.4, 0, 0.24, w=0.42)
    for side in (-1, 1):
        curved_pipe(f, [(-2.45, 0, 0.82), (-2.5, side * 0.2, 1.0), (-2.6, side * 0.48, a - 0.2),
                        (-2.6, side * 0.65, a - 0.25)], 0.08, "steelL", steps=4, sides=10)
    if tier == 3:
        tank(f, -4.05, 0, 0.82, 0.62)
        curved_pipe(f, [(-3.5, 0, 0.62), (pu0 - 0.13, 0, 0.5)], 0.1, "gm", steps=3)


VARIANTS = {"D": side_pumps, "E": inline_pump, "F": twin_preburners}


def build(f, fs, tier, variant):
    """The tier's inboard fit-out on frame f (final coordinates); fs is a frame whose mesh the caller squashes about
    the thrust axis by model.CASSETTE_Z_FIT, as the cassette is, for castings that continue its round section."""
    VARIANTS[variant](f, fs, tier, _m().THRUST_Z)
