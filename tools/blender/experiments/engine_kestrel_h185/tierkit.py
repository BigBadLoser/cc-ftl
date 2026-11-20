"""Kestrel Mk II / Mk III: the inboard fit-out of the deeper engine tiers (4x6, 4x7). Study stage.

The Mk I assembly (hull row, bulkhead, cassette, bell) is unchanged; a tier adds DEPTH - 5 tiles inboard of the
cassette's injector plate (u = -2.28), down to the footprint's inboard edge at u = 2.5 - DEPTH. Built in final
coordinates: the thrust axis at model.THRUST_Z (read while the model is lowered for stage 8), the ship deck at z = 0,
nothing above the 2.05 roof. Same family as Mk I: navy and blue-grey castings, steel trim, brass gaskets, the same
fasteners; each tier carries one accent band colour (ACCENT).

Variants (the study's three fit-out concepts):
  A  turbopump: a pre-burner drum on the axis fed by two flanking turbopumps; Mk III adds a pair of spherical
     propellant tanks on cradles behind them
  B  long casting: the cassette's armoured body continues inboard, a radiator crown along its top; Mk III longer
     still, with a second clamp ring and side radiator banks
  C  coil drive: a stack of field coils around a central core in a tie-rod frame; Mk III a longer stack plus two
     upright capacitor canisters and cable trays
"""
import math
import sys

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe, torus

ACCENT = {2: "polyB", 3: "hazY"}
FACE = -2.28            # the cassette's injector plate (the Mk I machine's inboard face)


def _m():
    return sys.modules["model"]


def sphere(f, u, v, z, r, mat, n=8, sides=16):
    """A sphere as stacked frustums along u."""
    for i in range(n):
        a, b = math.pi * i / n, math.pi * (i + 1) / n
        f.hcyl(u - r * math.cos(a), u - r * math.cos(b), v, z, max(r * math.sin(a), 0.01), mat,
               r1=max(r * math.sin(b), 0.01), sides=sides)


def coupling(f, a, tier):
    """The family joint onto the injector plate: a clamp ring, a brass gasket and the tier's accent band."""
    annulus(f, FACE - 0.14, FACE - 0.02, 0.3, 0.6, a, "steelD", "steelL", sides=16)
    annulus(f, FACE - 0.2, FACE - 0.14, 0.32, 0.56, a, "brass", "gm", sides=16)
    annulus(f, FACE - 0.3, FACE - 0.2, 0.32, 0.6, a, ACCENT[tier], "steel", sides=16)
    for k in range(6):
        t = k * math.tau / 6 + math.pi / 6
        G.disc(f, "-u", 0.5 * math.cos(t), a + 0.5 * math.sin(t), FACE - 0.14, 0.045, 0, 0.04, "plate", sides=6)


def lug(f, u, v):
    """A mounting lug bolted to the deck, as on the Mk I's cast supports."""
    f.box(u, v, 0, 0.34, 0.34, 0.16, "steel", top="plate")
    G.disc(f, "z", u, v, 0.16, 0.07, 0, 0.05, "steelD", sides=6)


# ---- A: turbopump --------------------------------------------------------------------------------------------------

def _pump(f, u0, u1, v, tier):
    z = 0.62
    f.hcyl(u0, u1, v, z, 0.34, "steelD", sides=16, cap="steelL", capstart="steel")
    torus(f, u1 - 0.22, v, z, 0.36, 0.11, "navy", n=20, sides=8)          # the volute
    annulus(f, u0 + 0.12, u0 + 0.2, 0.3, 0.42, z, ACCENT[tier], "steel", v=v, sides=16)
    D.ribs(f, u0 + 0.28, u1 - 0.4, v, z, 0.34, 0.34, 3, thick=0.05, grow=0.03, mat="gm", sides=16)
    f.box((u0 + u1) / 2, v, 0, u1 - u0 - 0.1, 0.5, 0.3, "navy", top="blueGrey")   # its cradle
    for u in (u0 + 0.12, u1 - 0.12):
        lug(f, u, v + math.copysign(0.32, v))


def turbopump(f, fs, tier, a, u_in):
    m = _m()
    # Pre-burner drum on the axis, its dome to the inboard side.
    d0 = -3.15 if tier == 2 else -3.25
    f.hcyl(d0, FACE - 0.3, 0, a, 0.52, "navy", sides=24)
    m.sleeve(f, [(d0 - 0.24, 0.18, a), (d0 - 0.16, 0.38, a), (d0 - 0.05, 0.5, a), (d0, 0.52, a)], "steel", sides=24)
    for u in (d0 + 0.18, FACE - 0.45):
        annulus(f, u - 0.05, u + 0.05, 0.5, 0.58, a, "blueGrey", "steelL", sides=24)
    f.hcyl(d0 - 0.3, d0 - 0.24, 0, a, 0.12, "steelD", sides=8, capstart="brass")
    m.prism(f, [(d0 + 0.05, 0), (d0 + 0.05, a - 0.35), (FACE - 0.3, a - 0.35), (FACE - 0.3, 0)], -0.42, 0.42, "steelD", "steel")
    pu0 = (-3.3 if tier == 2 else -3.42)
    for side in (-1, 1):
        v = side * 1.25
        _pump(f, pu0, FACE - 0.1, v, tier)
        # Discharge: up off the volute and into the drum's shoulder.
        curved_pipe(f, [(FACE - 0.32, v, 0.98), (FACE - 0.36, v, 1.35), (FACE - 0.55, side * 0.95, 1.62),
                        (FACE - 0.62, side * 0.45, a + 0.32)], 0.1, "steelL", steps=5, sides=10)
        D.flange(f, (FACE - 0.6, side * 0.5, a + 0.3), "v", 0.15, "brass", t=0.08)
        G.valve_wheel(f, "+v" if side > 0 else "-v", pu0 + 0.45, 0.62, v + side * 0.36, r=0.11)
    if tier == 3:
        # Two spherical propellant tanks on ring cradles, feeding the pumps' suction ends.
        for side in (-1, 1):
            v = side * 0.95
            u, z, r = -4.0, 0.92, 0.6
            f.vcyl(u, v, 0, 0.42, 0.42, "navy", top="blueGrey", sides=16)
            sphere(f, u, v, z, r, "steel", n=10, sides=20)
            f.vcyl(u, v, z - 0.04, r + 0.02, 0.08, ACCENT[tier], top=ACCENT[tier], sides=20)
            f.vcyl(u, v, z + r - 0.04, 0.16, 0.1, "steelD", top="plate", sides=10)
            for k in (-1, 1):
                lug(f, u + k * 0.36, v)
            curved_pipe(f, [(u + 0.45, v, 0.7), (u + 0.62, side * 1.15, 0.62), (pu0 - 0.02, side * 1.25, 0.62)],
                        0.09, "gm", steps=4, sides=10)
        f.box(-4.0, 0, 0, 0.6, 0.5, 0.95, "navy", top="blueGrey")             # the bus box between the tanks
        D.panel(f, -4.0, 0, 0.95, 0.46, 0.36, "blueGrey", t=0.02, ring=0.04, bolts=True)


# ---- B: long casting -----------------------------------------------------------------------------------------------

def _body(f, fs, u0, u1, a, tier):
    """The round body on fs (squashed under the roof like the cassette), its side castings on f."""
    m = _m()
    r = 0.86
    # Armoured body, continuing the cassette's section, with the cassette's sculpted staves.
    f.hcyl(u0, u1, 0, a, r, "steelD", sides=32)
    for t0, t1, mat in ((0.16, 1.1, "steel"), (1.1, 2.04, "blueGrey"), (2.04, 2.98, "steel"), (3.42, 6.0, "navy")):
        m.sculpted_stave(fs, [(u0 + 0.12, r + 0.06, a), (u1 - 0.12, r + 0.06, a)], t0, t1, mat)
    # Squashed under the roof like the cassette: clip with a crown plate rather than rising above 2.05.
    m.sleeve(fs, [(u0 - 0.3, 0.3, a), (u0 - 0.2, 0.62, a), (u0 - 0.06, 0.82, a), (u0, 0.86, a)], "steel", sides=32)
    f.hcyl(u0 - 0.36, u0 - 0.3, 0, a, 0.28, "navy", sides=12, capstart="navy")
    for k in range(6):
        t = k * math.tau / 6
        G.disc(fs, "-u", 0.2 * math.cos(t), a + 0.2 * math.sin(t), u0 - 0.36, 0.04, 0, 0.035, "plate", sides=6)
    annulus(fs, u1 - 0.12, u1, 0.7, 0.95, a, "steelD", "steelL", sides=16)
    annulus(fs, u1 - 0.18, u1 - 0.12, 0.74, 0.92, a, ACCENT[tier], "gm", sides=24)
    # Side castings down to the deck, as heavy_bed's.
    for side in (-1, 1):
        v = side * 1.13
        m.prism(f, [(u0, 0), (u0, 0.8), (u1, 0.8), (u1, 0)], v - 0.26, v + 0.26, "navy", "blueGrey")
        lug(f, u0 + 0.2, side * 1.5)


def casting(f, fs, tier, a, u_in):
    if tier == 2:
        _body(f, fs, -3.1, FACE - 0.3, a, tier)
        D.fins(f, -3.0, FACE - 0.4, 0, 2.0 - 0.05, 0.9, 0.05, 6, thick=0.05, mat="steelL", top="plate", base=False)
        f.box((-3.0 + FACE - 0.4) / 2, 0, a + 0.62, 0.9, 1.0, 0.08, "steelD", top="steel")
        for side in (-1, 1):
            G.hatch(f, "+v" if side > 0 else "-v", -2.85, 0.5, side * 1.4, w=0.4, h=0.26)
        return
    _body(f, fs, -4.1, FACE - 0.3, a, tier)
    annulus(fs, -3.35, -3.2, 0.82, 1.0, a, "steelD", "steelL", sides=16)     # the second clamp ring
    annulus(fs, -3.2, -3.15, 0.86, 0.96, a, "brass", "gm", sides=24)
    f.box(-3.2, 0, a + 0.62, 1.8, 1.0, 0.08, "steelD", top="steel")
    D.fins(f, -4.0, FACE - 0.4, 0, a + 0.7, 0.9, 0.05, 12, thick=0.05, mat="steelL", top="plate")
    for side in (-1, 1):
        v = side * 1.62
        # Side radiator banks on standoffs.
        f.box(-3.5, v, 0, 1.3, 0.12, 0.2, "steelD", top="steel")
        D.fins(f, -4.1, -2.9, v, 0.2, 0.22, 0.95, 9, thick=0.05, mat="steelL", top="plate")
        f.box(-3.5, v, 1.15, 1.3, 0.26, 0.06, ACCENT[tier], top=ACCENT[tier])
        curved_pipe(f, [(-2.95, v, 1.0), (-2.8, side * 1.35, 1.1), (-2.7, side * 1.0, 1.25)], 0.08, "gm", steps=4)


# ---- C: coil drive -------------------------------------------------------------------------------------------------

def coils(f, fs, tier, a, u_in):
    n = 3 if tier == 2 else 6
    u0 = -3.2 if tier == 2 else -4.15
    u1 = FACE - 0.3
    f.hcyl(u0 - 0.1, u1, 0, a, 0.3, "gm", sides=16, capstart="steelL")             # the core
    step = (u1 - u0) / n
    for k in range(n):
        c = u0 + step * (k + 0.5)
        annulus(f, c - step * 0.32, c + step * 0.32, 0.3, 0.62, a, "brass", "steelD", sides=24)   # a field coil
        annulus(f, c - 0.03, c + 0.03, 0.62, 0.66, a, "steelD", "steelD", sides=24)
    for c in [u0 + step * k for k in range(n + 1)]:
        annulus(f, c - 0.04, c + 0.04, 0.3, 0.7, a, "steel", "steelL", sides=16)   # spacer plates
    # Tie-rod frame: four rods at the corners, end plates down to the deck.
    for vv, zz in ((-0.62, a - 0.52), (0.62, a - 0.52), (-0.62, a + 0.52), (0.62, a + 0.52)):
        D.seg(f, (u0 - 0.15, vv, zz), (u1, vv, zz), 0.05, "steelL", 8, cap="plate", capstart="plate")
    for u in (u0 - 0.15, u1 - 0.05):
        f.box(u, 0, 0, 0.1, 1.6, a - 0.5, "navy", top="blueGrey")
        f.box(u, 0, a + 0.3, 0.1, 1.6, 0.4, "navy", top="blueGrey")
        for side in (-1, 1):
            lug(f, u, side * 1.1)
    f.box((u0 + u1) / 2, 0, a + 0.7, u1 - u0 + 0.2, 0.3, 0.06, ACCENT[tier], top=ACCENT[tier])
    for side in (-1, 1):
        D.conduit_bundle(f, (u0, side * 1.3, 0.3), (u1, side * 1.3, 0.3), n=3, pitch=0.12, r=0.045, across="z", clamps=3)
    if tier == 3:
        for side in (-1, 1):
            v = side * 1.45
            D.tank(f, -4.1, v, 0, 0.32, 1.25, mat="navy", cap="blueGrey", bands=2, sides=14)
            f.vcyl(-4.1, v, 0.7, 0.35, 0.08, ACCENT[tier], top=ACCENT[tier], sides=14)
            curved_pipe(f, [(-4.1, v, 1.4), (-3.85, side * 1.1, 1.55), (-3.7, side * 0.85, a + 0.5)], 0.06, "brass", steps=4)
        f.box(-3.6, 0, a + 0.8, 1.0, 0.5, 0.06, "steelD", top="steel")             # cable tray over the stack


VARIANTS = {"A": turbopump, "B": casting, "C": coils}


def build(f, fs, tier, variant):
    """The tier's inboard fit-out on frame f (final coordinates); fs is a frame whose mesh the caller squashes about
    the thrust axis by model.CASSETTE_Z_FIT, as the cassette is, for round castings too big for the roof."""
    a = _m().THRUST_Z
    u_in = 2.5 - _m().DEPTH
    coupling(f, a, tier)
    VARIANTS[variant](f, fs, tier, a, u_in)
