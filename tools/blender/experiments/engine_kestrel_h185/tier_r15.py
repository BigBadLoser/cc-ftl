"""Kestrel tier fit-out study, round 15: FA (round 14) kept — sponsons with pumps, field rings, the crown — with a
shorter rear cap so the crown sits further forward, and the inboard end (section A, under and behind the crown)
given real equipment in place of the grille. The sponson-end bells get guard bars.

  GA feed station: a cast header block with valve wheels on a feed bar, a gauge panel facing out, deck feed hoses
     into its flanks, a trunk up into the crown's stem. Mk III: two rows of valves, a wider block.
  GB pump bay: a low-walled bay; a pump on the axis, its guarded suction bell facing out, its discharge rising into
     the crown's stem, Mk III: two stages and a longer barrel.
  GC operator step: a tread-plate step with hazard edges, a control console facing out against the
     crown. Mk III: a wider console with two screens and a floor hatch.
"""
import math

from sprites import detail as D, greeble as G
from sprites.cmbkit import hazard_strip
from geometry import curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import casing
from tier_r7 import _crown
from tier_r14 import FIT, ST, SV0, duct_caps, field_ring, pipe_to, ring_bed, rings_at, sponson, stub


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def bell(f, u, v, z, r=0.24):
    f.hcyl(u - 0.16, u, v, z, r, "steelD", r1=r * 0.78, sides=16, capstart="dark")
    D.flange(f, (u, v, z), "u", r * 0.92, "brass", t=0.05)
    f.box(u - 0.17, v, z, 0.03, 0.05, 2 * r - 0.04, "steelL", base=False)
    f.box(u - 0.17, v, z, 0.03, 2 * r - 0.04, 0.05, "steelL", base=False)


def fa_base(f, fs, tier, a, end):
    """FA's machine with a short cap; end(u0, ue, stem_u) builds section A from u0 to ue, the crown's stem end at
    stem_u (a trunk may land there on the axis at height a)."""
    u0 = _u0()
    big = tier == 3
    uc = -2.45 if not big else -2.9
    casing(fs, a, uc, crown=False, ducts=False, lid=False, short=True)
    duct_caps(fs, a)
    cu, cr = uc - 0.15, 0.62
    _crown(fs, cu, a, cr)
    stem_u = uc - 0.45
    fs.hcyl(stem_u, uc - 0.3, 0, a, 0.28, "steel", sides=16, capstart="steelD")
    pumps = [(u0 + 0.35, -2.25)] if not big else [(u0 + 0.35, -3.35), (-3.15, -2.25)]
    ue = stem_u - 0.05
    ring_bed(f, u0, a, tier, saddle=lambda u: end(u, ue, stem_u))
    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, pumps[-1][1] + 0.1, windows=[(p0 - 0.04, p1 + 0.04) for p0, p1 in pumps])
        bell(f, u0 + 0.05, side * 1.65, 0.55)
        for i, (p0, p1) in enumerate(pumps):
            T.pump(f, p0, p1 - 0.12, side * 1.65, 0.55, 0.25, "+v" if side > 0 else "-v")
            angle = 0 if i == 0 else 0.5
            zz = a + (cr + 0.2) * math.sin(angle) * FIT
            vv = stub(f, cu, side, zz, (cr + 0.2) * math.cos(angle))
            pipe_to(f, (p1 - 0.28, side * 1.65, 0.88), vv, cu, zz, side)
            D.flange(f, (p1 - 0.28, side * 1.65, ST + 0.02), "z", 0.14, "brass", t=0.06)
    for u in rings_at(tier):
        field_ring(fs, u, a)
    return big


def _trunk(f, um, z0, stem_u, a):
    curved_pipe(f, [(um, 0, z0), (um, 0, a - 0.25), (um + 0.12, 0, a), (stem_u - 0.06, 0, a)], 0.11, "steelL",
                steps=4, sides=12)
    D.flange(f, (stem_u - 0.05, 0, a), "u", 0.17, "brass", t=0.06)


# ---- GA: feed station ------------------------------------------------------------------------------------------------

def feed_station(f, fs, tier, a):
    def end(u0, ue, stem_u):
        big = tier == 3
        w = 1.0 if not big else 1.2
        h = 0.5
        T._m().prism(f, [(u0 + 0.1, 0), (u0 + 0.1, h - 0.12), (u0 + 0.22, h), (ue, h), (ue, 0)], -w, w, "navy", "blueGrey")
        D.panel(f, u0 + 0.1, 0, 0.22, 1.2, 0.26, "blueGrey", face="-u", t=0.02, ring=0.03, bolts=True)
        for k, vv in enumerate((-0.4, 0, 0.4)):
            G.disc(f, "-u", vv, 0.22, u0 + 0.08, 0.075, 0, 0.03, "steelL", sides=12)
            G.disc(f, "-u", vv, 0.22, u0 + 0.05, 0.055, 0, 0.01, "lens", sides=12)
        rows = [(u0 + ue) / 2] if not big else [u0 + 0.45, ue - 0.3]
        vs = (-0.6, 0, 0.6) if not big else (-0.75, -0.25, 0.25, 0.75)
        for u in rows:
            D.seg(f, (u, vs[0] - 0.12, h + 0.16), (u, vs[-1] + 0.12, h + 0.16), 0.08, "steel", 10, cap="steelL",
                  capstart="steelL")
            for vv in vs:
                f.vcyl(u, vv, h, 0.06, 0.26, "steelD", top="steel", sides=8)
                G.valve_wheel(f, "z", u, vv, h + 0.28, r=0.14)
        _trunk(f, rows[-1], h + 0.14, stem_u, a)
        for side in (-1, 1):
            um = (u0 + ue) / 2
            f.box(um, side * (w + 0.15), 0, 0.22, 0.22, 0.06, "steel", top="plate")
            curved_pipe(f, [(um, side * (w + 0.15), 0.06), (um, side * (w + 0.15), 0.25), (um, side * (w - 0.02), 0.3)],
                        0.06, "gm", steps=3)
            D.flange(f, (um, side * w, 0.3), "v", 0.1, "brass", t=0.05)
    fa_base(f, fs, tier, a, end)


# ---- GB: pump bay ----------------------------------------------------------------------------------------------------

def pump_bay(f, fs, tier, a):
    def end(u0, ue, stem_u):
        big = tier == 3
        f.box((u0 + ue) / 2, 0, 0, ue - u0, 2 * SV0 - 0.1, 0.06, "plateA", top="plateB")
        f.box(u0 + 0.08, 0, 0, 0.12, 2 * SV0 - 0.1, 0.24, "navy", top="blueGrey")
        hazard_strip(f, u0 + 0.02, u0 + 0.14, 0, 0.24, step=0.06)
        pz = 0.52
        vu = [ue - 0.18] if not big else [ue - 0.18, ue - 0.55]
        bu = u0 + 0.4
        bell(f, bu, 0, pz, 0.3)
        f.hcyl(bu, vu[-1] - 0.1, 0, pz, 0.22, "steelD", sides=16)
        for u in vu:
            ring(f, (u, 0, pz), "u", 0.3, 0.12, "navy", n=28, sides=8)
            f.hcyl(u - 0.08, u + 0.08, 0, pz, 0.32, "steelD", sides=20, cap="blueGrey", capstart="blueGrey")
        for u in (bu + 0.1, vu[0]):
            f.box(u, 0, 0.06, 0.16, 0.5, pz - 0.28, "navy", top="blueGrey")
        _trunk(f, vu[0], pz + 0.42, stem_u, a)
    fa_base(f, fs, tier, a, end)


# ---- GC: operator step -----------------------------------------------------------------------------------------------

def operator_step(f, fs, tier, a):
    def end(u0, ue, stem_u):
        big = tier == 3
        w = 1.15
        f.box((u0 + ue) / 2, 0, 0, ue - u0 - 0.1, 2 * w, 0.22, "steelD", top="plateB")
        hazard_strip(f, u0 + 0.08, u0 + 0.14, 0, 0.22, step=0.06)
        for k in range(int((ue - u0) / 0.16)):
            f.box(u0 + 0.2 + k * 0.16, 0, 0.22, 0.02, 2 * w - 0.2, 0.012, "steel")
        cw = 0.4 if not big else 0.7
        c0 = ue - 0.42
        T._m().prism(f, [(c0, 0.22), (c0, 0.82), (c0 + 0.2, 1.0), (ue - 0.02, 1.0), (ue - 0.02, 0.22)], -cw, cw, "navy",
                     "blueGrey")
        screens = [0.0] if not big else [-0.33, 0.33]
        for vv in screens:
            f.box(c0 + 0.1, vv, 0.91, 0.12, 0.28, 0.02, "cyan", base=False)
        for vv in ([-0.25, 0.25] if not big else [-0.55, 0, 0.55]):
            G.disc(f, "-u", vv, 0.6, c0 - 0.005, 0.05, 0, 0.02, "steelL", sides=10)
            G.disc(f, "-u", vv, 0.6, c0 - 0.025, 0.035, 0, 0.005, "lens", sides=10)
        if big:
            D.panel(f, (u0 + c0) / 2, 0, 0.22, 0.42, 0.5, "blueGrey", t=0.02, ring=0.04, bolts=True)
            f.box((u0 + c0) / 2 + 0.15, 0, 0.24, 0.05, 0.1, 0.03, "brass")
    fa_base(f, fs, tier, a, end)
