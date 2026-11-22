"""Kestrel tier fit-out study, round 7: round 6's one-machine build (full-depth bed, lengthened casing), pushed for
variety and tier identity. The bed's rear saddle (the block under the inboard end) carries each concept's own
equipment, and the side castings are cut open where the machinery needs to show or pass through. Mk II adds one strong
feature; Mk III changes the silhouette.

  T  ring drive: big copper field rings round the casing, through slots in the side castings, a capacitor stack in
     the saddle. Mk III: three rings and a containment sphere fused onto the rear, the castings opened on a capacitor
     rack, the saddle its cast cradle.
  U  pump crown: a large volute crown on the rear cap feeding pumps nested in openings in the side castings, a suction
     header in the saddle. Mk III: a second, booster crown, tandem pumps and two accumulator domes on the header.
  V  turbo-compound: the saddle is a turbocharger, its scrolls either side of the axis, hot-gas ducts along the side
     castings' top edges. Mk III: twin turbos, both ducts, the rear cap an intercooler, wastegate stacks off the castings.
"""
import math

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe
import tierkit as T
from tier_r5 import ring
from tier_r6 import R, bed, casing


def _u0():
    return 2.5 - T._m().DEPTH + 0.05


def _m():
    return T._m()


# ---- T: ring drive ---------------------------------------------------------------------------------------------------

def _field_ring(fs, u, a, big):
    rr = R + (0.32 if big else 0.26)
    ring(fs, (u, 0, a), "u", rr, 0.19 if big else 0.16, "oM", n=40, sides=10)
    for k in range(10):
        t = k * math.tau / 10 + math.pi / 10
        fs.box(u, rr * math.cos(t), a + rr * math.sin(t), 0.34, 0.22, 0.22, "navy", top="blueGrey", base=False)
        G.disc(fs, "-u", rr * math.cos(t), a + rr * math.sin(t), u - 0.17, 0.035, 0, 0.03, "brass", sides=6)
    annulus(fs, u - 0.2, u - 0.16, R + 0.02, R + 0.12, a, "brass", "gm", sides=32)
    annulus(fs, u + 0.16, u + 0.2, R + 0.02, R + 0.12, a, "brass", "gm", sides=32)


def ring_drive(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.95 if not big else -3.1
    casing(fs, a, uc)
    at = [-1.7, -2.5] if not big else [-1.55, -2.2, -2.85]
    slots = [(u - 0.26, u + 0.26) for u in at]
    rack = [(-4.3, -3.25)] if big else []

    def flank(v, side):
        for u in at:
            T.hose(f, [(u - 0.28, side * 1.4, 0.32), (u - 0.32, side * 1.45, 0.7), (u - 0.22, side * 1.25, 0.95)], 0.05)
        for o0, o1 in rack:
            n = 4
            for i in range(n):
                u = o0 + (o1 - o0) * (i + 0.5) / n
                f.vcyl(u, v, 0.3, 0.13, 0.62, "lvW", top="medRed", sides=12)
                f.box(u, v + math.copysign(0.27, v), 0.85, 0.06, 0.02, 0.04, "blueN", base=False)

    def saddle(u0):
        if big:
            # The sphere's cast cradle: a stepped plinth and two cheeks up to the sphere's equator.
            _m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.42), (u0 + 0.25, 0.55), (u0 + 1.1, 0.55), (u0 + 1.1, 0)],
                       -0.85, 0.85, "navy", "blueGrey")
            for vv in (-0.62, 0.62):
                f.box(u0 + 0.6, vv, 0.55, 0.5, 0.16, a - 0.55, "navy", top="blueGrey")
            return
        # Capacitor stack: a louvred cast box, three big cans on top, their bus into the rear cap.
        f.box(u0 + 0.45, 0, 0, 0.8, 1.5, 0.62, "navy", top="blueGrey")
        D.slats(f, u0 + 0.12, u0 + 0.78, 0.75, 0.15, 0.5, 3, 1)
        for vv in (-0.45, 0, 0.45):
            f.vcyl(u0 + 0.42, vv, 0.62, 0.16, 0.42, "steel", top="brass", sides=14)
            f.vcyl(u0 + 0.42, vv, 0.8, 0.17, 0.05, "steelD", top="steelD", sides=14)
        curved_pipe(f, [(u0 + 0.42, 0, 1.04), (u0 + 0.55, 0, 1.15), (uc - 0.1, 0, a - 0.2)], 0.07, "gm", steps=4)

    bed(f, u0, a, flank, saddle, slots + rack)
    for u in at:
        _field_ring(fs, u, a, big)
    if big:
        cu, r = -3.75, 0.66
        T.sphere(f, cu, 0, a, r, "steel", n=12, sides=28)
        ring(f, (cu, 0, a), "z", r + 0.02, 0.08, "oM", n=36)
        ring(f, (cu, 0, a), "v", r + 0.02, 0.08, "oM", n=36)
        for k in range(8):
            t = k * math.tau / 8
            f.box(cu + (r + 0.05) * math.cos(t), (r + 0.05) * math.sin(t), a, 0.16, 0.16, 0.22, "navy", top="blueGrey",
                  base=False)
        f.hcyl(cu + r - 0.08, uc - 0.12, 0, a, 0.36, "steelD", sides=20)          # the bottle's throat into the cap
        annulus(f, cu + r - 0.1, cu + r + 0.02, 0.34, 0.5, a, "brass", "gm", sides=20)


# ---- U: pump crown ---------------------------------------------------------------------------------------------------

def _crown(fs, u, a, rr):
    ring(fs, (u, 0, a), "u", rr, 0.24, "navy", n=36, sides=10)
    annulus(fs, u - 0.08, u + 0.08, rr - 0.1, rr + 0.27, a, "steelD", "blueGrey", sides=24)
    for k in range(6):
        t = k * math.tau / 6 + math.pi / 6
        fs.box(u, (rr + 0.2) * math.cos(t), a + (rr + 0.2) * math.sin(t), 0.26, 0.16, 0.16, "steel", top="steelL",
               base=False)


def pump_crown(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.75 if not big else -3.35
    casing(fs, a, uc, crown=False)
    crowns = [(uc - 0.2, 0.66)] if not big else [(uc - 0.2, 0.7), (uc + 0.55, 0.62)]
    for u, rr in crowns:
        _crown(fs, u, a, rr)
    fs.hcyl(uc - 0.5, uc - 0.3, 0, a, 0.32, "steel", sides=16, capstart="brass")
    T.bolts(fs, uc - 0.5, a, 0.24)
    pumps = [(u0 + 0.3, -1.95)] if not big else [(u0 + 0.3, -3.1), (-2.95, -1.95)]
    gal = [(p0 - 0.08, p1 + 0.08) for p0, p1 in pumps]

    def flank(v, side):
        face = "+v" if side > 0 else "-v"
        for p0, p1 in pumps:
            T.pump(f, p0 + 0.05, p1 - 0.12, v, 0.6, 0.27, face)
            # Feed: from the pump's volute up the flank to the crown.
            cu = crowns[0][0]
            curved_pipe(f, [(p1 - 0.25, v, 0.88), (p1 - 0.3, side * 1.25, 1.3), (cu + 0.1, side * 0.95, a + 0.25),
                            (cu, side * 0.8, a + 0.2)], 0.09, "steelL", steps=4, sides=10)
            D.flange(f, (p1 - 0.28, v, 0.95), "z", 0.13, "brass", t=0.07)

    def saddle(u0):
        _m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.3), (u0 + 0.9, 0.3), (u0 + 0.9, 0)], -0.95, 0.95, "navy", "blueGrey")
        # Suction header across the saddle, its inlet bells facing inboard, feeding both pumps' suction ends.
        D.seg(f, (u0 + 0.45, -1.0, 0.5), (u0 + 0.45, 1.0, 0.5), 0.17, "steel", 16, cap="steelD", capstart="steelD")
        for vv in (-0.45, 0.45):
            f.hcyl(u0 + 0.05, u0 + 0.3, vv, 0.5, 0.18, "steelD", r1=0.12, sides=16, capstart="dark")
            D.flange(f, (u0 + 0.3, vv, 0.5), "u", 0.17, "brass", t=0.06)
        if big:
            for vv in (-0.55, 0.55):
                T.sphere(f, u0 + 0.5, vv, 0.95, 0.32, "steel", n=8, sides=18)
                f.vcyl(u0 + 0.5, vv, 0.58, 0.16, 0.12, "steelD", top="steel", sides=12)
                ring(f, (u0 + 0.5, vv, 0.95), "z", 0.33, 0.035, "brass", n=24, sides=6)
                f.vcyl(u0 + 0.5, vv, 1.25, 0.05, 0.08, "hivis", top="hivis", sides=6)

    bed(f, u0, a, flank, saddle, gal)


# ---- V: turbo-compound -----------------------------------------------------------------------------------------------

def _turbo(f, u, v, z, axis_v=True):
    """A turbocharger: compressor (steel) and turbine (navy) scrolls on one shaft along v, around (u, v, z)."""
    for dv, R_, mat in ((-0.3, 0.3, "steel"), (0.3, 0.27, "navy")):
        c = (u, v + dv, z)
        D.seg(f, (u, v + dv - 0.12, z), (u, v + dv + 0.12, z), R_, "steelD", 18, cap=mat, capstart=mat)
        ring(f, c, "v", R_, 0.12, mat, n=28, sides=8)
    D.seg(f, (u, v - 0.18, z), (u, v + 0.18, z), 0.12, "brass", 12)
    f.hcyl(u - 0.55, u - 0.3, v - 0.3, z, 0.2, "steelD", r1=0.14, sides=16, capstart="dark")         # compressor inlet


def turbo_compound(f, fs, tier, a):
    u0 = _u0()
    big = tier == 3
    uc = -2.8 if not big else -3.15
    casing(fs, a, uc, crown=not big)
    sides = (1,) if not big else (-1, 1)
    vents = [(-1.0, -0.4)] if big else []

    def flank(v, side):
        if side in sides:
            # Hot-gas duct along the casting's top edge, from the chamber's flank back to the turbine in the saddle.
            curved_pipe(f, [(1.05, side * 0.95, a - 0.05), (0.95, side * 1.15, 1.25), (0.3, side * 1.13, 1.27),
                            (u0 + 1.0, side * 1.13, 1.27), (u0 + 0.6, side * 0.95, 1.0)], 0.14, "steel", steps=5, sides=12)
            for uu in (0.3, -0.9, u0 + 1.0):
                D.flange(f, (uu, side * 1.13, 1.27), "u", 0.19, "brass", t=0.07)
        for o0, o1 in vents:
            # Wastegate: a valve body in the casting's opening, its stack up beside the casing.
            um = (o0 + o1) / 2
            f.box(um, v, 0.3, 0.3, 0.3, 0.4, "steelD", top="steel")
            f.vcyl(um, v, 0.7, 0.07, 1.15, "steelL", top="dark", sides=10)
            f.vcyl(um, v, 1.5, 0.1, 0.06, "brass", top="brass", sides=10)

    def saddle(u0):
        _m().prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.36), (u0 + 1.0, 0.36), (u0 + 1.0, 0)], -1.0, 1.0, "navy", "blueGrey")
        units = [0.0] if not big else [-0.55, 0.55]
        for vv in units:
            _turbo(f, u0 + 0.6, vv, 0.75)
            # Charge air: from the compressor up into the rear cap.
            curved_pipe(f, [(u0 + 0.6, vv - 0.3, 1.1), (u0 + 0.8, vv * 0.5 - 0.15, 1.35), (uc - 0.15, vv * 0.4, a + 0.1)],
                        0.09, "steelL", steps=4)

    bed(f, u0, a, flank, saddle, vents)
    if big:
        fs.hcyl(uc - 0.6, uc, 0, a, 0.66, "navy", sides=32, capstart="steelD")
        for k in range(8):
            u = uc - 0.55 + k * 0.07
            annulus(fs, u - 0.015, u + 0.015, 0.64, 0.78, a, "steelL", "plate", sides=32)
        annulus(fs, uc - 0.66, uc - 0.58, 0.3, 0.72, a, "steelD", "steel", sides=16)
        T.bolts(fs, uc - 0.67, a, 0.5, n=8)
