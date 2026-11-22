"""Kestrel Mk II / Mk III inboard fit-out (`KB`, the approved concept of the tier study, #105; see tierkit.py for the
frame and the cut). Same family as Mk I: navy and blue-grey castings, steel trim, brass gaskets and unions.

The Mk I's bed is rebuilt the full depth of the footprint: side castings, sponsons either side with a turbopump in a
window (its intake a guarded bell in the sponson's end), and between the castings a propellant tank in place of the
Mk I's sump. The armoured casing is lengthened to a short rear cap with a crown on it; copper field rings sit on seat
bands round the casing's full-radius length (the side castings slotted, the sump cut, under each ring).

  Mk II (4x6): one ring, one pump a side, one tank: a large banded body behind the crown, a hand valve on its domed nose,
     necking down to run on under the casing; a trunk from the body's top into the crown's stem; each pump's discharge
     rises over its sponson into a stub on the crown.
  Mk III (4x7): two rings, two pumps a side (their discharges joined on the sponson top, one riser to the crown), twin
     tanks joined by a cross header from which one trunk rises to the stem.

Heights under the casing come from the thrust axis `a`, 0.3 lower in rotations 1 / 2. Every pipe ends on a flanged
stub; nothing ends inside anything else.
"""
import math

from mathutils import Vector

from sprites import detail as D, greeble as G
from geometry import annulus, curved_pipe, sleeve
import tierkit as T

R = 0.89                 # the casing's section where the Mk I is cut (cassette.body_radius(-1.48))
STAVES = ((0.16, 1.1, "steel"), (1.1, 2.04, "blueGrey"), (2.04, 2.98, "steel"), (3.42, 6.0, "navy"))
SHAPE = [(0.56, 1.15), (-0.76, 1.12), (0.32, 0.84), (1.5, 0.55)]    # the side casting's top past its rear corner
SV0, SV1, ST = 1.39, 1.92, 0.95          # sponson inner / outer v and top
RR, RM = 1.2, 0.14                       # field ring radius and tube radius (on the squashed frame)
S = 0.3                                  # how far the rear cap, crown and rings sit outboard of the first layout
W = 0.84                                 # half the clear width between the side castings
AX = {"u": ((0, 1, 0), (0, 0, 1), (1, 0, 0)), "v": ((0, 0, 1), (1, 0, 0), (0, 1, 0)), "z": ((1, 0, 0), (0, 1, 0), (0, 0, 1))}


def ring(f, c, axis, R, r, mat, n=28, sides=8):
    """A torus centred on c (u, v, z) around a local axis."""
    e1, e2, ax = (Vector(x) for x in AX[axis])
    c = Vector(c)

    def p(t, s):
        q = c + (R + r * math.cos(s)) * (e1 * math.cos(t) + e2 * math.sin(t)) + ax * (r * math.sin(s))
        return f.pt(q.x, q.y, q.z)
    for i in range(n):
        t, a = i * math.tau / n, (i + 1) * math.tau / n
        for j in range(sides):
            s, b = j * math.tau / sides, (j + 1) * math.tau / sides
            f.poly([p(t, s), p(a, s), p(a, b), p(t, b)], mat, flip=True)


def frustum(f, u0, v, z0, r0, u1, z1, r1, mat, sides=20):
    """A lathed band along u at v from (u0, r0 about z0) to (u1, r1 about z1)."""
    def p(u, r, z, t):
        return f.pt(u, v + r * math.cos(t), z + r * math.sin(t))
    for i in range(sides):
        t, s = math.tau * i / sides, math.tau * (i + 1) / sides
        f.poly([p(u0, r0, z0, t), p(u0, r0, z0, s), p(u1, r1, z1, s), p(u1, r1, z1, t)], mat, flip=True)


def rings_at(tier):
    return [u + S for u in ([-1.95] if tier == 2 else [-1.95, -2.4])]


# ---- the bed: side castings and sponsons ------------------------------------------------------------------------------

def _top(u, u0):
    pts = [(u0, 0.79), (u0 + SHAPE[0][0], SHAPE[0][1])] + SHAPE[1:]
    for (p, a), (q, b) in zip(pts, pts[1:]):
        if p <= u <= q:
            return a + (b - a) * (u - p) / (q - p)
    return pts[-1][1]


def bed(f, u0, tier, sump):
    """The Mk I's heavy_bed rebuilt from u0 to its front (1.5): the side castings, slotted down to a sill under each
    ring, and their lugs; sump(segs) fills the space between them, segs being the lengths clear of the rings."""
    m = T._m()
    slots = [(u - 0.24, u + 0.24) for u in rings_at(tier)]
    marks = sorted({u0 + 0.15, 1.4, *[x for g in slots for x in g]})
    sump([(p, q) for p, q in zip(marks, marks[1:]) if not any(g0 <= p and q <= g1 for g0, g1 in slots)])
    cuts = sorted({u0, u0 + 0.56, -0.76, 0.32, 1.5, *[x for o in slots for x in o]})
    for side in (-1, 1):
        v = side * 1.13
        for p, q in zip(cuts, cuts[1:]):
            if any(o0 <= p and q <= o1 for o0, o1 in slots):
                m.prism(f, [(p, 0), (p, 0.3), (q, 0.3), (q, 0)], v - 0.26, v + 0.26, "navy", "blueGrey")
            else:
                m.prism(f, [(p, 0), (p, _top(p, u0)), (q, _top(q, u0)), (q, 0)], v - 0.26, v + 0.26, "navy", "blueGrey")
        for u in (u0 + 0.08, (u0 + 1.18) / 2, 1.18):
            f.box(u, side * 1.5, 0, 0.34, 0.52, 0.16, "steel", top="plate")
            G.disc(f, "z", u, side * 1.58, 0.16, 0.07, 0, 0.05, "steelD", sides=6)


def lug(f, u, v):
    """A mounting lug bolted to the deck, as on the Mk I's cast supports."""
    f.box(u, v, 0, 0.34, 0.34, 0.16, "steel", top="plate")
    G.disc(f, "z", u, v, 0.16, 0.07, 0, 0.05, "steelD", sides=6)


def sponson(f, side, s0, s1, windows):
    lo, hi = sorted((side * SV0, side * SV1))
    edges = sorted({s0, s1, *[x for w in windows for x in w]})
    for p, q in zip(edges, edges[1:]):
        if any(w0 <= p and q <= w1 for w0, w1 in windows):
            T._m().prism(f, [(p, 0), (p, 0.2), (q, 0.2), (q, 0)], lo, hi, "navy", "blueGrey")
            T._m().prism(f, [(p, ST - 0.12), (p, ST), (q, ST), (q, ST - 0.12)], lo, hi, "navy", "blueGrey")
        else:
            T._m().prism(f, [(p, 0), (p, ST), (q, ST), (q, 0)], lo, hi, "navy", "blueGrey")
    T._m().prism(f, [(s1, 0), (s1, ST), (s1 + 0.3, 0.62), (s1 + 0.3, 0)], lo, hi, "navy", "blueGrey")
    f.box((s0 + s1) / 2, side * (SV1 - 0.06), ST, s1 - s0, 0.12, 0.04, "blueGrey", top="steelL")
    for u in (s0 + 0.15, s1 + 0.15):
        lug(f, u, side * 1.8)


def bell(f, u, v, z, r=0.24):
    """A pump's intake: a bell in the sponson's end, a brass flange and a cross guard."""
    f.hcyl(u - 0.16, u, v, z, r, "steelD", r1=r * 0.78, sides=16, capstart="dark")
    D.flange(f, (u, v, z), "u", r * 0.92, "brass", t=0.05)
    f.box(u - 0.17, v, z, 0.03, 0.05, 2 * r - 0.04, "steelL", base=False)
    f.box(u - 0.17, v, z, 0.03, 2 * r - 0.04, 0.05, "steelL", base=False)


# ---- the casing, crown and rings --------------------------------------------------------------------------------------

def casing(fs, a, uc):
    """The armoured casing continued from the cut back to a short rear cap at uc: its section, staves, rear clamp ring
    and petals (the Mk I's cap stations pressed into 0.3 tiles)."""
    m = T._m()

    def at(x):                          # a Mk I rear-cap station (its u) on this casing
        return uc + (x + 2.15) * 0.45
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


def duct_caps(fs, a):
    """The Mk I's crown ducts end in brass caps at the cut."""
    for side in (-1, 1):
        D.flange(fs, (T.CUT + 0.03, side * 0.79, a + 0.73), "u", 0.2, "brass", t=0.08)


def crown(fs, u, a, rr):
    ring(fs, (u, 0, a), "u", rr, 0.24, "navy", n=36, sides=10)
    annulus(fs, u - 0.08, u + 0.08, rr - 0.1, rr + 0.27, a, "steelD", "blueGrey", sides=24)
    for k in range(6):
        t = k * math.tau / 6 + math.pi / 6
        fs.box(u, (rr + 0.2) * math.cos(t), a + (rr + 0.2) * math.sin(t), 0.26, 0.16, 0.16, "steel", top="steelL",
               base=False)


def field_ring(fs, u, a):
    """A field ring on a seat band: copper tube, eight navy clamps from the band to the ring."""
    annulus(fs, u - 0.2, u + 0.2, R - 0.02, 1.07, a, "steelD", "steel", sides=32)
    ring(fs, (u, 0, a), "u", RR, RM, "oM", n=40, sides=10)
    for k in range(8):
        t = k * math.tau / 8 + math.pi / 8
        fs.box(u, (RR - 0.04) * math.cos(t), a + (RR - 0.04) * math.sin(t), 0.3, 0.2, 0.2, "navy", top="blueGrey",
               base=False)


# ---- pipes ------------------------------------------------------------------------------------------------------------

def stub(f, u, side, z, v0):
    """A flanged inlet stub out of a round casting at (u, side * v0, z), 0.2 long; returns its flange's outer v."""
    v1 = v0 + 0.2
    D.seg(f, (u, side * v0, z), (u, side * v1, z), 0.09, "steel", 12, cap="steelL")
    D.flange(f, (u, side * v1, z), "v", 0.14, "brass", t=0.06)
    return side * (v1 + 0.03)


def pipe_to(f, start, end_v, end_u, z, side):
    """From a pump's discharge straight up, over the sponson top, to a stub at (end_u, end_v, z)."""
    u0, v0, z0 = start
    curved_pipe(f, [(u0, v0, z0), (u0, v0, max(z0 + 0.15, ST + 0.15)), ((u0 + end_u) / 2, side * 1.58, (ST + z) / 2 + 0.1),
                    (end_u, end_v + side * 0.25, z), (end_u, end_v, z)], 0.08, "steelL", steps=4, sides=10)


def trunk(f, um, z0, stem_u, a):
    """The tank's feed from its top at um up into the crown's stem on the axis."""
    curved_pipe(f, [(um, 0, z0), (um, 0, a - 0.25), (um + 0.12, 0, a), (stem_u - 0.06, 0, a)], 0.11, "steelL",
                steps=4, sides=12)
    D.flange(f, (stem_u - 0.05, 0, a), "u", 0.17, "brass", t=0.06)


# ---- the tank ---------------------------------------------------------------------------------------------------------

def low_tank(f, p, q, v, r):
    """The tank's run under the casing: domed inboard end at p, banding, saddles."""
    zc = 0.06 + r
    f.hcyl(p + 0.12, q, v, zc, r, "steelL", sides=20, cap="steel")
    f.hcyl(p, p + 0.12, v, zc, r * 0.82, "steelL", r1=r, sides=20, capstart="steelL")
    n = max(2, int((q - p) / 0.45))
    for k in range(n):
        u = p + 0.3 + k * (q - p - 0.45) / max(1, n - 1)
        f.hcyl(u - 0.03, u + 0.03, v, zc, r + 0.02, "brass", sides=20, cap="brass", capstart="brass")
    for u in (p + 0.25, q - 0.2):
        f.box(u, v, 0, 0.12, r * 1.6, zc - r * 0.55, "navy", top="blueGrey")


def tanks(f, segs, u0, a, big, stem_u):
    """Between the side castings: the tank(s), their trunk into the stem and the deck plate; the sump's other lengths
    (ahead of the rings' gaps) a low casting."""
    vs = (0,) if not big else (-0.42, 0.42)
    rb = 0.44 if not big else 0.4
    zb = 0.06 + rb
    pb, qb = u0 + 0.25, stem_u - 0.15
    q = segs[0][1] - 0.05
    rl = (a - 0.63 - 0.08) / 2
    for v in vs:
        # Domed nose, the body, a neck down to the run under the casing.
        frustum(f, pb - 0.2, v, zb, 0.02, pb - 0.12, zb, rb * 0.62, "steelL")
        frustum(f, pb - 0.12, v, zb, rb * 0.62, pb, zb, rb, "steelL")
        f.hcyl(pb, qb, v, zb, rb, "steelL", sides=24)
        frustum(f, qb, v, zb, rb, qb + 0.22, 0.06 + rl, rl, "steelL")
        low_tank(f, qb + 0.1, q, v, rl)
        for u in (pb + 0.08, qb - 0.08):
            f.hcyl(u - 0.035, u + 0.035, v, zb, rb + 0.025, "brass", sides=24, cap="brass", capstart="brass")
        f.box((pb + qb) / 2, v, 0, 0.14, rb * 1.5, zb - rb * 0.6, "navy", top="blueGrey")
        D.seg(f, (pb - 0.2, v, zb), (pb - 0.3, v, zb), 0.06, "steel", 10, cap="steelL")      # hand valve on the nose
        G.valve_wheel(f, "-u", v, zb, pb - 0.3, r=0.11)
    tz = zb + rb + (0.1 if big else 0)
    ju = (pb + qb) / 2
    if big:
        D.seg(f, (ju, -0.42, tz), (ju, 0.42, tz), 0.06, "steel", 10, cap="steelL", capstart="steelL")
        for v in vs:
            f.vcyl(ju, v, zb + rb - 0.04, 0.05, 0.12, "steel", top="steel", sides=8)
    trunk(f, ju, tz, stem_u, a)
    for p2, q2 in segs[1:]:
        f.box((p2 + q2) / 2, 0, 0, q2 - p2, 2 * W, 0.12, "steelD", top="steel")
    f.box((u0 + 0.05 + q) / 2, 0, 0, q - u0 - 0.05, 2 * W, 0.06, "plateA", top="plateB")


# ---- the machine ------------------------------------------------------------------------------------------------------

def build(f, fs, tier, a):
    """Mk II (tier 2) or Mk III (tier 3) on frame f; fs is squashed about the thrust axis like the cassette."""
    u0 = 2.5 - T._m().DEPTH + 0.05
    big = tier == 3
    uc = (-2.45 if not big else -2.9) + S
    casing(fs, a, uc)
    duct_caps(fs, a)
    cu, cr = uc - 0.15, 0.62
    crown(fs, cu, a, cr)
    stem_u = uc - 0.45
    fs.hcyl(stem_u, uc - 0.3, 0, a, 0.28, "steel", sides=16, capstart="steelD")
    pumps = [(u0 + 0.35, -2.25 + S)] if not big else [(u0 + 0.35, -3.35 + S), (-3.15 + S, -2.25 + S)]
    bed(f, u0, tier, lambda segs: tanks(f, segs, u0, a, big, stem_u))
    for side in (-1, 1):
        sponson(f, side, u0 + 0.05, pumps[-1][1] + 0.1, [(p0 - 0.04, p1 + 0.04) for p0, p1 in pumps])
        bell(f, u0 + 0.05, side * 1.65, 0.55)
        for p0, p1 in pumps:
            T.pump(f, p0, p1 - 0.12, side * 1.65, 0.55, 0.25, "+v" if side > 0 else "-v")
            D.flange(f, (p1 - 0.28, side * 1.65, ST + 0.02), "z", 0.14, "brass", t=0.06)
        vv = stub(f, cu, side, a, cr + 0.2)
        if not big:
            pipe_to(f, (pumps[0][1] - 0.28, side * 1.65, 0.88), vv, cu, a, side)
        else:
            # Both pumps' discharges join on the sponson top; one riser to the crown.
            d0, d1 = pumps[0][1] - 0.28, pumps[1][1] - 0.28
            hz = ST + 0.14
            for d in (d0, d1):
                f.vcyl(d, side * 1.65, ST + 0.02, 0.07, hz - ST - 0.02, "steel", top="steel", sides=10)
            D.seg(f, (d0 - 0.07, side * 1.65, hz), (d1 + 0.07, side * 1.65, hz), 0.08, "steelL", 12, cap="steelL",
                  capstart="steelL")
            pipe_to(f, (cu - 0.1, side * 1.65, hz), vv, cu, a, side)
    for u in rings_at(tier):
        field_ring(fs, u, a)
