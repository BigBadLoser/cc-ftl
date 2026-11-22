"""Kestrel tier fit-out study, round 16: the FA machine (sponson pumps, field rings, the crown) on a base whose inboard
end is a new shape. The Mk I side castings and sponsons now start at `start`; from the footprint's inboard edge to
there the block itself is each concept's own casting, full width.

  HA yoke: the base rises into a portal frame that carries the crown's stem in a bearing; a feed header on the deck
     under it. Mk III: two portals tied by top rails into a cage with a hoist trolley.
  HB terraces: the base steps down toward the inboard end across its full width, each step carrying its own fit-out
     (valve header, gauge risers, a tread). Mk III: four steps and a cascade of pipes down them.
  HC prow: a sloped wedge fairing across the full width, louvred, with an inspection port. Mk III: a knuckled
     two-pitch prow, cheek vents and a hatch.
"""
import math

from sprites import detail as D, greeble as G
from sprites.cmbkit import hazard_strip
from geometry import curved_pipe
import tierkit as T
from tier_r6 import casing
from tier_r7 import _crown
from tier_r14 import FIT, ST, SV1, duct_caps, field_ring, pipe_to, ring_bed, rings_at, sponson, stub


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def fa_body(f, fs, tier, a, start):
    """FA from `start` outboard: casing, crown, rings, side castings and sponsons (pumps in windows). Returns
    (stem_u, cu, cr)."""
    big = tier == 3
    uc = -2.45 if not big else -2.9
    casing(fs, a, uc, crown=False, ducts=False, lid=False, short=True)
    duct_caps(fs, a)
    cu, cr = uc - 0.15, 0.62
    _crown(fs, cu, a, cr)
    stem_u = uc - 0.45
    fs.hcyl(stem_u, uc - 0.3, 0, a, 0.28, "steel", sides=16, capstart="steelD")
    ring_bed(f, start, a, tier, saddle=lambda u: None)
    end = -1.75
    n = 2 if big else 1
    step = (end - start - 0.05) / n
    pumps = [(start + 0.1 + i * step, start + 0.05 + (i + 1) * step) for i in range(n)]
    for side in (-1, 1):
        sponson(f, side, start, end + 0.1, windows=[(p0 - 0.04, p1 + 0.04) for p0, p1 in pumps])
        for i, (p0, p1) in enumerate(pumps):
            T.pump(f, p0 + 0.14, p1 - 0.12, side * 1.65, 0.55, 0.25, "+v" if side > 0 else "-v")
            angle = 0 if i == 0 else 0.5
            zz = a + (cr + 0.2) * math.sin(angle) * FIT
            vv = stub(f, cu + 0.05 * i, side, zz, (cr + 0.2) * math.cos(angle))
            pipe_to(f, (p1 - 0.28, side * 1.65, 0.88), vv, cu, zz, side)
            D.flange(f, (p1 - 0.28, side * 1.65, ST + 0.02), "z", 0.14, "brass", t=0.06)
    for u in rings_at(tier):
        field_ring(fs, u, a)
    return stem_u, cu, cr


def _valves(f, u, vs, z, r=0.13):
    D.seg(f, (u, vs[0] - 0.12, z), (u, vs[-1] + 0.12, z), 0.08, "steel", 10, cap="steelL", capstart="steelL")
    for vv in vs:
        f.vcyl(u, vv, z - 0.1, 0.055, 0.22, "steelD", top="steel", sides=8)
        G.valve_wheel(f, "z", u, vv, z + 0.14, r=r)


# ---- HA: yoke --------------------------------------------------------------------------------------------------------

def _portal(f, u, d, a, top):
    for side in (-1, 1):
        m = T._m()
        m.prism(f, [(u, 0), (u, top), (u + d, top), (u + d, 0)], side * 1.3, side * SV1, "navy", "blueGrey")
        f.box(u + d / 2, side * 1.61, 0, d + 0.12, 0.7, 0.12, "steel", top="plate")
    T._m().prism(f, [(u, top - 0.32), (u, top), (u + d, top), (u + d, top - 0.32)], -1.3, 1.3, "navy", "blueGrey")
    # The bearing beam at axis height, and its housing on the axis.
    T._m().prism(f, [(u, a - 0.2), (u, a + 0.16), (u + d, a + 0.16), (u + d, a - 0.2)], -1.3, 1.3, "steelD", "steel")
    f.hcyl(u - 0.06, u + d + 0.06, 0, a, 0.3, "blueGrey", sides=20, cap="steelL", capstart="steelL")
    D.flange(f, (u - 0.06, 0, a), "u", 0.22, "brass", t=0.04)
    for vv in (-0.9, 0.9):
        f.box(u + d / 2, vv, a - 0.2, d + 0.04, 0.12, 0.36, "steel", base=False)


def yoke(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    start = u0 + (0.45 if not big else 1.1)
    stem_u, cu, cr = fa_body(f, fs, tier, a, start)
    top = 1.95
    d = 0.3
    frames = [u0 + 0.05] if not big else [u0 + 0.05, start - d - 0.02]
    for u in frames:
        _portal(f, u, d, a, top)
    # The shaft from the bearing into the crown's stem.
    fs.hcyl(frames[-1] + d, stem_u, 0, a, 0.17, "steelL", sides=14)
    D.flange(f, (stem_u - 0.02, 0, a), "u", 0.22, "brass", t=0.05)
    if big:
        for side in (-1, 1):
            f.box((frames[0] + frames[1] + d) / 2, side * 1.6, top - 0.2, frames[1] - frames[0], 0.16, 0.2, "steel",
                  top="steelL")
        # Hoist trolley on a top rail, its block hanging.
        f.box((frames[0] + frames[1] + d) / 2, 0, top - 0.12, frames[1] - frames[0] - d, 0.14, 0.1, "steelD",
              top="steel", base=False)
        tu = (frames[0] + frames[1] + d) / 2
        f.box(tu, 0, top - 0.3, 0.26, 0.24, 0.18, "hazY", top="hazY")
        f.box(tu, 0, a + 0.2, 0.03, 0.03, top - 0.3 - a - 0.2, "steelD", base=False)
        f.box(tu, 0, a + 0.12, 0.14, 0.1, 0.08, "hazY", top="hazY")
    # Deck feed header under the bearing.
    hu = u0 + 0.05 + d / 2 if not big else (frames[0] + frames[1] + d) / 2
    f.box(hu, 0, 0, 0.5, 2.2, 0.18, "steelD", top="plateB")
    _valves(f, hu, (-0.7, -0.25, 0.25, 0.7) if big else (-0.6, 0, 0.6), 0.42)


# ---- HB: terraces ----------------------------------------------------------------------------------------------------

def terraces(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    start = u0 + (0.8 if not big else 1.45)
    stem_u, cu, cr = fa_body(f, fs, tier, a, start)
    hs = [0.3, 0.55, 0.8] if not big else [0.25, 0.45, 0.65, 0.85]
    d = (start - u0) / len(hs)
    m = T._m()
    for i, h in enumerate(hs):
        p, q = u0 + i * d, u0 + (i + 1) * d
        m.prism(f, [(p, 0), (p, h), (q, h), (q, 0)], -SV1, SV1, "navy", "blueGrey")
        f.box(p + 0.03, 0, h, 0.06, 2 * SV1 - 0.1, 0.02, "steelL", base=False)
    # Bottom step: tread and hazard edge. Middle riser(s): gauge panels. Top step: valve header.
    hazard_strip(f, u0, u0 + 0.06, 0, hs[0], step=0.06)
    for k in range(3):
        f.box(u0 + 0.12 + k * 0.08, 0, hs[0], 0.02, 2.4, 0.012, "steel")
    q1 = u0 + d
    D.panel(f, q1, 0, hs[0] + 0.03, 1.4, hs[1] - hs[0] - 0.06, "blueGrey", face="-u", t=0.02, ring=0.03, bolts=True)
    for vv in (-0.45, 0, 0.45):
        G.disc(f, "-u", vv, (hs[0] + hs[1]) / 2, q1 - 0.02, 0.07, 0, 0.02, "steelL", sides=12)
        G.disc(f, "-u", vv, (hs[0] + hs[1]) / 2, q1 - 0.04, 0.05, 0, 0.01, "lens", sides=12)
    for side in (-1, 1):
        for i in range(1, len(hs)):
            G.disc(f, "-u", side * 1.55, (hs[i - 1] + hs[i]) / 2, u0 + i * d - 0.01, 0.08, 0, 0.02, "steelD", sides=8)
    _valves(f, start - d / 2, (-0.75, -0.25, 0.25, 0.75) if big else (-0.6, 0, 0.6), hs[-1] + 0.12)
    curved_pipe(f, [(start - d / 2, 0, hs[-1] + 0.12), (start - 0.05, 0, a - 0.2), (stem_u - 0.06, 0, a)], 0.1,
                "steelL", steps=4, sides=12)
    D.flange(f, (stem_u - 0.04, 0, a), "u", 0.16, "brass", t=0.05)
    if big:
        # A cascade of pipes down the steps on each side to a deck manifold.
        for side in (-1, 1):
            v = side * 1.2
            pts = [(start - 0.05, v, hs[-1] + 0.08)]
            for i in range(len(hs) - 1, 0, -1):
                pts += [(u0 + i * d + 0.06, v, hs[i] + 0.08), (u0 + i * d - 0.06, v, hs[i - 1] + 0.08)]
            curved_pipe(f, pts, 0.06, "gm", steps=2, sides=8)
            D.flange(f, pts[-1], "u", 0.1, "brass", t=0.04)


# ---- HC: prow --------------------------------------------------------------------------------------------------------

def prow(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    start = u0 + (0.7 if not big else 1.3)
    stem_u, cu, cr = fa_body(f, fs, tier, a, start)
    m = T._m()
    if not big:
        prof = [(u0, 0.3), (start, ST)]
    else:
        prof = [(u0, 0.3), (u0 + 0.55, 0.52), (start, ST)]
    m.prism(f, [(u0, 0)] + prof + [(start, 0)], -SV1, SV1, "navy", "blueGrey")
    # Louvres: slats laid along each pitch, between cheek bands.
    for (p, zp), (q, zq) in zip(prof, prof[1:]):
        n = 4 if q - p > 0.5 else 3
        for k in range(n):
            t0, t1 = (k + 0.2) / n, (k + 0.6) / n
            pa, za = p + (q - p) * t0, zp + (zq - zp) * t0
            pb, zb = p + (q - p) * t1, zp + (zq - zp) * t1
            for v0, v1 in ((-1.7, -0.5), (0.5, 1.7)):
                m.prism(f, [(pa, za), (pa, za + 0.04), (pb, zb + 0.04), (pb, zb)], v0, v1, "steelD", "steel")
    for vv in (-1.82, -0.42, 0.42, 1.82):
        m.prism(f, [(u, z + 0.05) for u, z in prof] + [(u, z) for u, z in prof[::-1]], vv - 0.05,
                vv + 0.05, "blueGrey", "steelL")
    # Inspection port at the middle of the prow face.
    pu, pz = (prof[-2][0] + prof[-1][0]) / 2, (prof[-2][1] + prof[-1][1]) / 2
    f.vcyl(pu, 0, pz - 0.05, 0.3, 0.09, "steelL", top="steelD", sides=20)
    f.vcyl(pu, 0, pz + 0.04, 0.2, 0.03, "brass", top="lens", sides=20)
    for side in (-1, 1):
        T.lug(f, u0 + 0.2, side * 1.6)
    if big:
        # Cheek vents low on the sides.
        for side in (-1, 1):
            for k in range(3):
                f.box(u0 + 0.1 + k * 0.14, side * SV1, 0.08, 0.06, 0.02, 0.18, "dark", base=False)
