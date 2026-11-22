"""Kestrel tier fit-out study, round 19: JB (round 18) with its plumbing made to read as one flow:
tank -> sponson pumps -> crown.

  KA: the tank's outlet riser (with its isolation valve) rises from the bottle's shoulder into a cross header behind the
     crown; the header runs over the side castings and drops into each sponson's top, straight into the pump's suction.
     The sponson ends lose their intake bells (blanked with covers). Each pump's discharge rises over the sponson and
     into the crown's side stub. Mk III: twin bottles each with a riser into the header, and the two pumps on a side
     joined by a discharge header on the sponson top with one riser to the crown. The bottle tops carry relief valves,
     not pipes.
"""

from sprites import detail as D, greeble as G
from geometry import curved_pipe
import tierkit as T
from tier_r6 import casing
from tier_r7 import _crown
from tier_r14 import ST, duct_caps, field_ring, pipe_to, ring_bed, rings_at, sponson, stub
from tier_r15 import _trunk, bell
from tier_r18 import S, _deck, _r_low, frustum, low_tank


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def bottle_plumbed(f, fs, tier, a, trunk=False):
    u0 = _u0()
    big = tier == 3
    uc = (-2.45 if not big else -2.9) + S
    casing(fs, a, uc, crown=False, ducts=False, lid=False, short=True)
    duct_caps(fs, a)
    cu, cr = uc - 0.15, 0.62
    _crown(fs, cu, a, cr)
    stem_u = uc - 0.45
    fs.hcyl(stem_u, uc - 0.3, 0, a, 0.28, "steel", sides=16, capstart="steelD")
    pumps = [(u0 + 0.35, -2.25 + S)] if not big else [(u0 + 0.35, -3.35 + S), (-3.15 + S, -2.25 + S)]

    hu, hz = u0 + 0.17, 1.1  # the suction header: its u and height over the side castings
    vs = (0,) if not big else (-0.42, 0.42)
    rb = 0.44 if not big else 0.4
    zb = 0.06 + rb
    pb = u0 + (0.25 if trunk else 0.3)

    def sump(segs):
        q = segs[0][1] - 0.05
        rl = _r_low(a)
        qb = stem_u - 0.15
        for v in vs:
            frustum(f, pb - 0.2, v, zb, 0.02, pb - 0.12, zb, rb * 0.62, "steelL")
            frustum(f, pb - 0.12, v, zb, rb * 0.62, pb, zb, rb, "steelL")
            f.hcyl(pb, qb, v, zb, rb, "steelL", sides=24)
            frustum(f, qb, v, zb, rb, qb + 0.22, 0.06 + rl, rl, "steelL")
            low_tank(f, qb + 0.1, q, v, rl)
            for u in (pb + 0.08, qb - 0.08):
                f.hcyl(u - 0.035, u + 0.035, v, zb, rb + 0.025, "brass", sides=24, cap="brass", capstart="brass")
            f.box((pb + qb) / 2, v, 0, 0.14, rb * 1.5, zb - rb * 0.6, "navy", top="blueGrey")
            if trunk:
                # JB's hand valve on the dome's nose.
                D.seg(f, (pb - 0.2, v, zb), (pb - 0.3, v, zb), 0.06, "steel", 10, cap="steelL")
                G.valve_wheel(f, "-u", v, zb, pb - 0.3, r=0.11)
            else:
                # Drain valve on the dome.
                D.seg(f, (pb - 0.2, v, zb - 0.1), (pb - 0.28, v, zb - 0.1), 0.045, "steel", 8, cap="steelL")
            # Outlet riser from the shoulder up into the header, an isolation valve on it.
            ru = pb + 0.06
            if not trunk:
                f.vcyl(ru, v, zb + rb - 0.04, 0.1, 0.05, "brass", top="brass", sides=12)
                curved_pipe(
                    f,
                    [(ru, v, zb + rb), (ru, v, hz - 0.12), (hu + 0.03, v, hz - 0.02), (hu, v, hz)],
                    0.07,
                    "steel",
                    steps=3,
                    sides=10,
                )
                G.valve_wheel(f, "-u", v, zb + rb + 0.08, ru - 0.07, r=0.1)
            if trunk:
                if big:
                    f.vcyl(pb + 0.2, v, zb + rb - 0.06, 0.14, 0.1, "steelD", top="plate", sides=12)
            else:
                # Relief valve and gauge on the body's crown, a manway on Mk III.
                ku = (pb + qb) / 2 + 0.05
                f.vcyl(ku, v, zb + rb - 0.04, 0.06, 0.14, "steel", top="steelL", sides=10)
                f.vcyl(ku, v, zb + rb + 0.1, 0.09, 0.05, "brass", top="brass", sides=10)
                if big:
                    f.vcyl(qb - 0.15, v, zb + rb - 0.06, 0.14, 0.1, "steelD", top="plate", sides=12)
        if trunk:
            tz = zb + rb + (0.1 if big else 0)
            if not big:
                _trunk(f, (pb + qb) / 2, tz, stem_u, a)
            else:
                ju = (pb + qb) / 2
                D.seg(f, (ju, -0.42, tz), (ju, 0.42, tz), 0.06, "steel", 10, cap="steelL", capstart="steelL")
                for v in vs:
                    f.vcyl(ju, v, zb + rb - 0.04, 0.05, 0.12, "steel", top="steel", sides=8)
                _trunk(f, ju, tz, stem_u, a)
        _deck(f, segs, u0, q)

    ring_bed(f, u0, a, tier, saddle=lambda u: None, sump=sump, shift=S)

    # The suction header: over the side castings, dropping into each sponson's top.
    if not trunk:
        curved_pipe(
            f,
            [
                (hu, -1.65, ST + 0.02),
                (hu, -1.65, hz - 0.1),
                (hu, -1.5, hz),
                (hu, 1.5, hz),
                (hu, 1.65, hz - 0.1),
                (hu, 1.65, ST + 0.02),
            ],
            0.08,
            "steelL",
            steps=4,
            sides=12,
        )
        for v in (-0.9, 0.9):
            D.flange(f, (hu, v, hz), "v", 0.12, "brass", t=0.04)

    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, pumps[-1][1] + 0.1, windows=[(p0 - 0.04, p1 + 0.04) for p0, p1 in pumps])
        if trunk:
            bell(f, u0 + 0.05, side * 1.65, 0.55)
        else:
            D.panel(f, u0 + 0.05, side * 1.65, 0.28, 0.42, 0.46, "blueGrey", face="-u", t=0.02, ring=0.03, bolts=True)
            D.flange(f, (hu, side * 1.65, ST + 0.02), "z", 0.14, "brass", t=0.06)
        for p0, p1 in pumps:
            T.pump(f, p0, p1 - 0.12, side * 1.65, 0.55, 0.25, "+v" if side > 0 else "-v")
            D.flange(f, (p1 - 0.28, side * 1.65, ST + 0.02), "z", 0.14, "brass", t=0.06)
        zz = a
        vv = stub(f, cu, side, zz, cr + 0.2)
        if not big:
            pipe_to(f, (pumps[0][1] - 0.28, side * 1.65, 0.88), vv, cu, zz, side)
        else:
            # Both pumps' discharges join on the sponson top; one riser to the crown.
            d0, d1 = pumps[0][1] - 0.28, pumps[1][1] - 0.28
            hz2 = ST + 0.14
            for d in (d0, d1):
                f.vcyl(d, side * 1.65, ST + 0.02, 0.07, hz2 - ST - 0.02, "steel", top="steel", sides=10)
            D.seg(
                f,
                (d0 - 0.07, side * 1.65, hz2),
                (d1 + 0.07, side * 1.65, hz2),
                0.08,
                "steelL",
                12,
                cap="steelL",
                capstart="steelL",
            )
            pipe_to(f, (cu - 0.1, side * 1.65, hz2), vv, cu, zz, side)
    for u in rings_at(tier):
        field_ring(fs, u + S, a)


def bottle_trunk(f, fs, tier, a):
    """KB: KA with JB's feed trunk from the tank into the crown's stem kept, the cross header dropped and the sponson
    end intakes back."""
    bottle_plumbed(f, fs, tier, a, trunk=True)
