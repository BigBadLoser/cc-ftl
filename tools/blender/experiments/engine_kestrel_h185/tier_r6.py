"""Kestrel tier fit-out study, round 6: one machine, not a machine with neighbours.

Every concept rebuilds the Mk I's cast bed the full depth of the footprint (the Mk I bed is dropped: cut "bed") and
lengthens the armoured casing (its staves and crown ducts continued) to a rebuilt rear cap. The new equipment is built
into that casting rather than stood beside it.

  Q  nested turbopumps: pumps lie in cowls cast into the bed's flanks, discharging through grooves up the casing.
     Mk III: two pumps in tandem per side and a pump crown on the rear cap.
  R  field rings: copper-wound rings clamped round the casing itself, on saddles cast up from the bed; the bed's
     flanks are louvred capacitor bays with armoured feeds up to the rings. Mk III: three rings and a source window in
     the rear cap.
  S  turbo-compound: turbochargers set into the bed's rear corners, fed by a hot-gas duct let into the bed's top edge
     from the chamber. Mk III: one each side and the rear cap made an intercooler, finned, in the casing's section.
"""
import math

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe, sleeve
import tierkit as T
from tier_r5 import ring

STAVES = ((0.16, 1.1, "steel"), (1.1, 2.04, "blueGrey"), (2.04, 2.98, "steel"), (3.42, 6.0, "navy"))
R = 0.89                # the casing's section where the Mk I is cut (cassette.body_radius(-1.48))


SHAPE = [(0.56, 1.15), (-0.76, 1.12), (0.32, 0.84), (1.5, 0.55)]    # the side casting's top past its rear corner


def _top(u, u0):
    pts = [(u0, 0.79), (u0 + SHAPE[0][0], SHAPE[0][1])] + SHAPE[1:]
    for (p, a), (q, b) in zip(pts, pts[1:]):
        if p <= u <= q:
            return a + (b - a) * (u - p) / (q - p)
    return pts[-1][1]


def bed(f, u0, a, flank=None, saddle=None, openings=(), gaps=(), slots=()):
    """The Mk I's heavy_bed, from u0 to its front (1.5): sump, side castings with access castings, lugs and the rear
    saddle. flank(v, side) replaces the access castings (a concept's own flank equipment); saddle(u0) replaces the rear
    saddle; openings [(u0, u1)] cut the side castings through between a low sill and a top rail; gaps [(u0, u1)] cut
    the sump down to a low sill (where a ring passes under the casing)."""
    m = T._m()
    marks = sorted({u0 + 0.15, 1.4, *[x for g in gaps for x in g]})
    for p, q in zip(marks, marks[1:]):
        if not any(g0 <= p and q <= g1 for g0, g1 in gaps):
            f.box((p + q) / 2, 0, 0.2, q - p, 1.55, 0.5, "steelD", top="steel")
    cuts = sorted({u0, u0 + 0.56, -0.76, 0.32, 1.5, *[x for o in (*openings, *slots) for x in o]})
    for side in (-1, 1):
        v = side * 1.13
        for p, q in zip(cuts, cuts[1:]):
            tp, tq = _top(p, u0), _top(q, u0)
            if any(o0 <= p and q <= o1 for o0, o1 in slots):
                m.prism(f, [(p, 0), (p, 0.3), (q, 0.3), (q, 0)], v - 0.26, v + 0.26, "navy", "blueGrey")
            elif any(o0 <= p and q <= o1 for o0, o1 in openings):
                m.prism(f, [(p, 0), (p, 0.3), (q, 0.3), (q, 0)], v - 0.26, v + 0.26, "navy", "blueGrey")
                m.prism(f, [(p, tp - 0.16), (p, tp), (q, tq), (q, tq - 0.16)], v - 0.26, v + 0.26, "navy", "blueGrey")
            else:
                m.prism(f, [(p, 0), (p, tp), (q, tq), (q, 0)], v - 0.26, v + 0.26, "navy", "blueGrey")
        if flank:
            flank(v, side)
        else:
            u = u0 + 0.19
            while u < 0.2:
                b = min(u + 1.14, 0.48)
                top = 0.96 if b < -0.5 else 0.74
                m.prism(f, [(u, 0.38), (u, top - 0.08), (u + 0.24, top), (b, top - 0.12), (b, 0.38)],
                        v + side * 0.265, v + side * 0.285, "blueGrey", "steelL")
                u = b + 0.08
        for u in (u0 + 0.08, (u0 + 1.18) / 2, 1.18):
            f.box(u, side * 1.5, 0, 0.34, 0.52, 0.16, "steel", top="plate")
            G.disc(f, "z", u, side * 1.58, 0.16, 0.07, 0, 0.05, "steelD", sides=6)
    if saddle:
        saddle(u0)
    else:
        m.prism(f, [(u0 + 0.1, 0), (u0 + 0.1, 0.84), (u0 + 0.5, 1.08), (u0 + 0.94, 0.97), (u0 + 0.94, 0)], -0.8, 0.8,
                "steelD", "steel")


def casing(fs, a, uc, crown=True, ducts=True, lid=True, short=False):
    """The armoured casing continued from the cut back to a rear cap at uc (the Mk I's -2.15 moved): its section,
    staves, rear clamp ring and petals, injector plate and the crown ducts' rear ends. short: the cap's taper, ring
    and petals pressed into 0.3 tiles instead of 0.67 (more full-radius length for the same cap position)."""
    m = T._m()
    du = uc + 2.15
    k = 0.45 if short else 1.0

    def at(x):                          # a Mk I rear-cap station (its u) on this casing
        return uc + (x + 2.15) * k
    sleeve(fs, [(uc, 0.59, a), (at(-1.92), 0.82, a), (at(-1.48), R, a), (T.CUT + 0.03, R, a)], "steelD", sides=32)
    fs.hcyl(uc - 0.05, uc, 0, a, 0.59, "steel", sides=16, capstart="blueGrey")
    for t0, t1, mat in STAVES:
        m.sculpted_stave(fs, [(u, R + 0.075, a) for u in (at(-1.75), (at(-1.75) + T.CUT) / 2, T.CUT + 0.03)], t0, t1, mat)
    annulus(fs, at(-1.94), at(-1.94) + 0.12, 0.69, 0.94, a, "steelD", "steelL", sides=16)
    annulus(fs, at(-1.94) + 0.12, at(-1.94) + 0.16, 0.74, 0.9, a, "brass", "gm", sides=24)
    for j in range(4):
        t = j * math.pi / 2 + math.pi / 4
        m.petal(fs, [(at(-2.02), 0.9, a), (at(-1.72), 0.99, a), (at(-1.45), 0.96, a)], t - 0.09, t + 0.09, "steelL",
                thick=0.13)
    if crown:
        annulus(fs, uc - 0.12, uc - 0.05, 0.26, 0.58, a, "steelD", "steel", sides=16)
        fs.hcyl(uc - 0.1, uc - 0.05, 0, a, 0.255, "navy", sides=8, capstart="navy")
        T.bolts(fs, uc - 0.13, a, 0.43)
    for side in ((-1, 1) if ducts else ()):
        curved_pipe(fs, [(-1.6 + du, side * 0.7, a + 0.58), (-1.25 + du, side * 0.8, a + 0.75),
                         (T.CUT + 0.1, side * 0.8, a + 0.76), (-1.25, side * 0.8, a + 0.75)], 0.15, "steelL", steps=4, sides=12)
        D.seg(fs, (-1.6 + du, side * 0.7, a + 0.58), (-1.5 + du, side * 0.76, a + 0.67), 0.2, "brass", 12,
              cap="steelL", capstart="steelL")
    # The service lid on the crown, repeated over the new length.
    if lid:
        D.panel(fs, (-1.48 + du + T.CUT) / 2, 0, a + 1.015, 0.64, 0.44, "blueGrey", t=0.02, ring=0.05, bolts=True)


# ---- Q: nested turbopumps --------------------------------------------------------------------------------------------

def nested(f, fs, tier, a):
    u0 = 2.5 - T._m().DEPTH + 0.05
    uc = -2.95 if tier == 2 else -3.75
    casing(fs, a, uc)
    units = [(u0 + 0.2, -1.95)] if tier == 2 else [(u0 + 0.2, -3.1), (-2.95, -1.95)]
    m = T._m()

    def flank(v, side):
        face = "+v" if side > 0 else "-v"
        vv = side * 1.48
        for p0, p1 in units:
            # The cowl: a casting out of the flank that the pump lies in, its top at the pump's axis.
            lo, hi = sorted((side * 1.38, side * 1.86))
            m.prism(f, [(p0 - 0.05, 0), (p0 - 0.05, 0.58), (p1 + 0.05, 0.58), (p1 + 0.05, 0)], lo, hi, "navy", "blueGrey")
            T.pump(f, p0 + 0.05, p1 - 0.12, vv, 0.62, 0.3, face)
            # Discharge: up the flank in a groove cast in the casing's side, into the shoulder.
            curved_pipe(f, [(p1 - 0.25, vv, 0.95), (p1 - 0.3, side * 1.3, 1.25), (p1 - 0.3, side * 1.0, a + 0.12),
                            (p1 - 0.32, side * 0.86, a + 0.12)], 0.09, "steelL", steps=4, sides=10)
            D.flange(f, (p1 - 0.32, side * 0.9, a + 0.12), "v", 0.14, "brass", t=0.08)
        G.valve_wheel(f, face, units[0][0] + 0.4, 0.95, vv + side * 0.05, r=0.1)

    bed(f, u0, a, flank)
    if tier == 3:
        # Pump crown on the rear cap: an annular pump casing round the injector, four feeds from the tandem pumps.
        ring(fs, (uc - 0.1, 0, a), "u", 0.5, 0.17, "navy", n=28, sides=10)
        annulus(fs, uc - 0.3, uc - 0.12, 0.28, 0.62, a, "steelD", "steelL", sides=16)
        fs.hcyl(uc - 0.4, uc - 0.3, 0, a, 0.22, "steel", sides=12, capstart="brass")
        for side in (-1, 1):
            curved_pipe(f, [(uc - 0.05, side * 0.55, a - 0.25), (uc + 0.05, side * 1.0, 0.85), (-3.25, side * 1.48, 0.95)],
                        0.08, "steelL", steps=4)


# ---- R: field rings --------------------------------------------------------------------------------------------------

def rings(f, fs, tier, a):
    u0 = 2.5 - T._m().DEPTH + 0.05
    uc = -2.95 if tier == 2 else -3.75
    casing(fs, a, uc, crown=tier == 2)
    at = [-1.65, -2.45] if tier == 2 else [-1.6, -2.35, -3.1]
    m = T._m()
    for u in at:
        # On the squashed frame, so each ring follows the casing's section.
        ring(fs, (u, 0, a), "u", R + 0.2, 0.13, "oM", n=36, sides=10)
        for k in range(8):
            t = k * math.tau / 8 + math.pi / 8
            fs.box(u, (R + 0.2) * math.cos(t), a + (R + 0.2) * math.sin(t), 0.3, 0.2, 0.2, "navy", top="blueGrey",
                   base=False)
        annulus(fs, u - 0.16, u - 0.12, R + 0.02, R + 0.1, a, "brass", "gm", sides=32)
        annulus(fs, u + 0.12, u + 0.16, R + 0.02, R + 0.1, a, "brass", "gm", sides=32)

    def flank(v, side):
        # Capacitor bays: the flank's access castings become louvred doors with charge lamps.
        for u in at:
            b0, b1 = u - 0.32, u + 0.32
            m.prism(f, [(b0, 0.3), (b0, 0.86), (b1, 0.86), (b1, 0.3)], v + side * 0.265, v + side * 0.295,
                    "blueGrey", "steelL")
            D.slats(f, b0 + 0.06, b1 - 0.06, v + side * 0.295, 0.38, 0.7, 4, side)
            f.box(u, v + side * 0.3, 0.8, 0.2, 0.02, 0.04, "blueN", base=False)
            # The ring's feed: an armoured cable out of the bay's top, up into the ring's lower clamp.
            T.hose(f, [(u, side * 1.2, 1.0), (u, side * 1.05, 1.2), (u, side * 0.85, a - 0.32)], 0.05, "gm", "brass")
            # A saddle cast up from the flank to the ring.
            lo, hi = sorted((side * 0.62, side * 0.92))
            m.prism(f, [(u - 0.12, 0.8), (u - 0.12, 1.05), (u + 0.12, 1.05), (u + 0.12, 0.8)], lo, hi, "navy", "blueGrey")
    bed(f, u0, a, flank)
    if tier == 3:
        # Source window in the rear cap: a brass-rimmed port onto the core.
        annulus(fs, uc - 0.14, uc - 0.04, 0.2, 0.58, a, "steelD", "steel", sides=16)
        fs.hcyl(uc - 0.2, uc - 0.14, 0, a, 0.3, "brass", sides=16, capstart="lens")
        T.bolts(fs, uc - 0.15, a, 0.45, n=8)


# ---- S: turbo-compound -----------------------------------------------------------------------------------------------

def turbo(f, fs, tier, a):
    u0 = 2.5 - T._m().DEPTH + 0.05
    uc = -2.95 if tier == 2 else -3.55
    casing(fs, a, uc, crown=tier == 2)
    sides = (1,) if tier == 2 else (-1, 1)
    m = T._m()
    tu = u0 + 0.42

    def flank(v, side):
        if side not in sides:
            return
        # The turbo's casting: the flank's rear widened into its housing, the scrolls on its outer face.
        lo, hi = sorted((side * 1.38, side * 1.62))
        m.prism(f, [(u0 + 0.05, 0), (u0 + 0.05, 0.98), (tu + 0.45, 0.98), (tu + 0.75, 0.6), (tu + 0.75, 0)], lo, hi,
                "navy", "blueGrey")
        ring(f, (tu, side * 1.68, 0.62), "v", 0.24, 0.11, "steel", n=24)
        D.seg(f, (tu, side * 1.62, 0.62), (tu, side * 1.76, 0.62), 0.25, "steelD", 16, cap="navy", capstart="navy")
        # Hot-gas duct let into the bed's top edge, from the chamber's flank to the turbine.
        curved_pipe(f, [(1.05, side * 0.95, a - 0.05), (0.95, side * 1.25, 1.05), (0.3, side * 1.3, 1.02),
                        (tu + 0.6, side * 1.32, 1.08), (tu + 0.2, side * 1.6, 0.85)], 0.11, "steel", steps=5, sides=12)
        for uu in (0.3, -0.9, tu + 0.6):
            D.flange(f, (uu, side * 1.31, 1.05), "u", 0.15, "brass", t=0.07)
        # Charge air: from the compressor scroll up into the casing's shoulder.
        curved_pipe(f, [(tu + 0.3, side * 1.4, 1.0), (tu + 0.55, side * 1.15, a + 0.05), (tu + 0.9, side * 0.9, a + 0.1)],
                    0.09, "steelL", steps=4)

    bed(f, u0, a, flank)
    if tier == 3:
        # The rear cap as an intercooler: a finned core in the casing's own section, banded and bolted.
        fs.hcyl(uc - 0.55, uc, 0, a, 0.62, "navy", sides=32, capstart="steelD")
        for k in range(7):
            u = uc - 0.5 + k * 0.075
            annulus(fs, u - 0.015, u + 0.015, 0.6, 0.72, a, "steelL", "plate", sides=32)
        annulus(fs, uc - 0.6, uc - 0.53, 0.3, 0.7, a, "steelD", "steel", sides=16)
        T.bolts(fs, uc - 0.61, a, 0.5, n=8)
