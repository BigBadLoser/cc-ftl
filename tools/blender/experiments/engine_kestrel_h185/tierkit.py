"""Kestrel Mk II / Mk III: the inboard fit-out of the deeper engine tiers (4x6, 4x7), issue #105.

The hull row, bulkhead and bell are the Mk I's. A tier cuts the cassette's inboard end off (`cut`: the Mk I faces
inboard of a u are dropped: the powerhead's injector plate and pump crown armour, the whole heavy bed, the side services
back clear of the field rings) and grows its own machinery out of the casing, down to the footprint's inboard edge at
u = 2.5 - DEPTH. Built in final coordinates: the thrust axis at model.THRUST_Z (read while the model is lowered for
stage 8), the deck at z = 0, nothing above the 2.05 roof. Round castings that continue the cassette go on `fs`, squashed
about the axis like the cassette. The fit-out itself is tier_kb.py (the study's approved concept, KB; the study rounds
are in git history before the tiers' art landed).
"""
import math
import sys

from sprites import detail as D, greeble as G
from geometry import torus

CUT = -1.5              # the Mk I powerhead's faces inboard of this go (the injector plate, rear armour and clamps)
CUTS = {"KB": {"bed": 99, "services": -0.9}}


def cut(variant, name):
    """u below which the Mk I's `name` mesh is dropped for this concept."""
    return CUTS.get(variant, {}).get(name, CUT if name == "powerhead" else -99)


def _m():
    return sys.modules["model"]


def pump(f, u0, u1, v, z, r, face):
    """A turbopump along u: suction bell at u0, barrel, volute at u1 (its discharge rising from the top)."""
    f.hcyl(u0 - 0.14, u0, v, z, r * 0.62, "steel", r1=r * 0.9, sides=16, capstart="dark")
    f.hcyl(u0, u1, v, z, r, "steelD", sides=16, cap="steelL")
    D.ribs(f, u0 + 0.12, u1 - 0.3, v, z, r, r, 3, thick=0.05, grow=0.03, mat="gm", sides=16)
    torus(f, u1 - 0.16, v, z, r * 1.02, r * 0.32, "navy", n=20, sides=8)
    f.hcyl(u1, u1 + 0.1, v, z, r * 0.7, "steel", sides=16, cap="blueGrey")           # turbine end cover
    G.hatch(f, face, (u0 + u1) / 2, z, v + math.copysign(r + 0.01, v), w=min(0.42, u1 - u0 - 0.3), h=r * 0.8)


def build(f, fs, tier, variant="KB"):
    """The tier's inboard fit-out on frame f (final coordinates); fs is a frame whose mesh the caller squashes about
    the thrust axis by model.CASSETTE_Z_FIT, as the cassette is, for castings that continue its round section."""
    if variant != "KB":
        raise KeyError(f"engine tier fit-out {variant!r}: only KB remains (the study rounds are in git history)")
    import tier_kb
    tier_kb.build(f, fs, tier, _m().THRUST_Z)
