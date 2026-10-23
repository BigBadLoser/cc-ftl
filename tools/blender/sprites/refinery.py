"""REFINERY (module.refinery, 3x4, family `refinery`): raw ore in, metal and electronics out. Built in stages after the
reference: 1 massing (this blockout, plain grey), 2 sub-forms, 3 colour and light, 4 detail and wear.

Massing, in tiers. The hull is one battered solid (walls leaning in, corners cut by a big chamfer) up to its rim; its
long sides have bays let into them (openings with real recesses behind): roller assemblies on the -u side, the input and
output hatches' bays on the crew side (+u) either side of a full-height slot through the rim, where the terminal's body
stands with a gap each side. Its top is a rim round a flush deck, and a one-tier
plinth about a tile wide runs down the middle carrying three round stacks. Local frame: modkit.K, u across the 3-tile
width, v along the 4."""
import math

from mathutils import Vector

from .modkit import K
from .steelkit import face, tube

FP = (3, 4)
U, V = 1.46, 1.96                    # the footprint's half extents, less a hair
HT = 0.8                             # the rim's top
H = 0.6                              # the deck floor, inside the rim
B = 0.2                              # the batter: how far the walls lean in, bottom to rim
C = 0.4                              # the corner chamfer at the bottom
RIM = 0.26                           # the rim's width
D = 0.22                             # how deep the bays go
BZ = (0.1, HT - 0.1)                 # the bays' floor and ceiling: the same margin above and below
AV = -0.5                            # the access tile's v
TS = 0.48                            # the terminal slot's half width: a gap either side of the terminal's body
BAYS = {1: [(-1.42, -0.62, "input"), (-TS, TS, "terminal"), (0.62, 1.42, "output")],
        -1: [(-1.42, -0.53, "rollers"), (-0.43, 0.43, "rollers"), (0.53, 1.42, "rollers")]}
G, GT, GD, HOLE = "gm", "plate", "steelD", "dark"      # blockout: faces, tops, recesses, holes


def _oct(r, c):
    u0, u1, v0, v1 = r
    return [(u0 + c, v0), (u1 - c, v0), (u1, v0 + c), (u1, v1 - c), (u1 - c, v1), (u0 + c, v1), (u0, v1 - c), (u0, v0 + c)]


LO = _oct((-U, U, -V, V), C)
HI = _oct((-U + B, U - B, -V + B, V - B), C - B * (math.sqrt(2) - 1))


def wall_u(s, z):
    """The u of the long side s (+-1) at height z."""
    return s * (U - B * z / HT)


def side_end(z):
    """How far along v the long sides run at height z (where the corner chamfers begin)."""
    t = z / HT
    return (V - C) * (1 - t) + abs(HI[3][1]) * t


def hull(k):
    """The battered hull: the eight outer faces (the long ones cut open for the bays), the bays' recesses, the rim."""
    cen = Vector((0, 0, HT / 2))
    for i in range(8):
        if i in (2, 6):
            continue
        j = (i + 1) % 8
        q = [(*LO[i], 0), (*LO[j], 0), (*HI[j], HT), (*HI[i], HT)]
        face(k, q, sum((Vector(p) for p in q), Vector()) / 4 - cen, G)
    for s in (1, -1):
        long_side(k, s)
    deck(k)


def long_side(k, s):
    """A long side's face as cells round its bays, and each bay's recess."""
    bays = sorted(BAYS[s])
    rows = [(0.0, BZ[0], False), (BZ[0], BZ[1], True), (BZ[1], HT, False)]
    cols = [None] + [e for v0, v1, _ in bays for e in (v0, v1)] + [None]     # None: where the side meets a corner
    at = lambda c, z, end: (wall_u(s, z), end * side_end(z) if c is None else c, z)    # noqa: E731
    full = [kind == "terminal" for _, _, kind in bays]                        # the terminal's slot runs the full height
    for za, zb, cut in rows:
        for c in range(len(cols) - 1):
            if c % 2 == 1 and (cut or full[c // 2]):                          # a bay's opening
                continue
            ca, cb = cols[c], cols[c + 1]
            face(k, [at(ca, za, -1), at(cb, za, 1), at(cb, zb, 1), at(ca, zb, -1)], (s, 0, 0), G)
    for v0, v1, kind in bays:
        if kind == "terminal":
            slot(k, v0, v1)
            continue
        recess(k, s, v0, v1)
        if kind == "rollers":
            for z, r in ((0.27, 0.14), (0.55, 0.13)):
                u = wall_u(s, z) - s * (D - r - 0.01)
                tube(k, (u, v0 + 0.03, z), (u, v1 - 0.03, z), r, G, sides=14, cap=GT)


def rim_top():
    """The rim's top: the hull's at stage 1; at stage 2 the armour cap's, a little higher."""
    return HT + (0.05 if STAGE[0] >= 2 else 0.0)


def rim_outline(t):
    """The octagon of the rim's outer edge pushed out by t, mitred at the corners."""
    out = []
    for i in range(8):
        ns = []
        for e in ((i - 1) % 8, i):
            (a, b), (c, d) = LO[e], LO[(e + 1) % 8]
            n = Vector((d - b, -(c - a), 0)).normalized()
            ns.append(n if n.dot(Vector(((a + c) / 2, (b + d) / 2, 0))) > 0 else -n)
        m = (ns[0] + ns[1]).normalized() / math.cos(math.pi / 8)
        out.append((HI[i][0] + m.x * t, HI[i][1] + m.y * t))
    return out


def slot(k, v0, v1):
    """The terminal's slot, cut the full height of the +u side and through the rim, back to the deck opening's edge."""
    ub = U - B - RIM
    front = lambda v, z: (wall_u(1, z), v, z)                                 # noqa: E731
    zt = rim_top()
    face(k, [(ub, v0, 0), (ub, v1, 0), (ub, v1, zt), (ub, v0, zt)], (1, 0, 0), GD)
    face(k, [front(v0, 0), (ub, v0, 0), (ub, v0, zt), front(v0, HT)], (0, 1, 0), G)
    face(k, [front(v1, 0), (ub, v1, 0), (ub, v1, zt), front(v1, HT)], (0, -1, 0), G)


def recess(k, s, v0, v1):
    z0, z1 = BZ
    back = lambda v, z: (wall_u(s, z) - s * D, v, z)                          # noqa: E731
    front = lambda v, z: (wall_u(s, z), v, z)                                 # noqa: E731
    face(k, [back(v0, z0), back(v1, z0), back(v1, z1), back(v0, z1)], (s, 0, 0), GD)
    face(k, [front(v0, z0), front(v1, z0), back(v1, z0), back(v0, z0)], (0, 0, 1), G)
    face(k, [front(v0, z1), front(v1, z1), back(v1, z1), back(v0, z1)], (0, 0, -1), GD)
    face(k, [front(v0, z0), back(v0, z0), back(v0, z1), front(v0, z1)], (0, 1, 0), G)
    face(k, [front(v1, z0), back(v1, z0), back(v1, z1), front(v1, z1)], (0, -1, 0), G)


def deck(k):
    """The hull's top: the rim (one ring; at stage 2 the armour cap, reaching out flush with the armour) and the deck
    inside it, flush."""
    iu, iv = U - B - RIM, V - B - RIM                                         # the deck opening's half extents
    inner = [(-iu, -iv), (iu, -iv), (iu, -iv), (iu, iv), (iu, iv), (-iu, iv), (-iu, iv), (-iu, -iv)]
    zt = rim_top()
    if STAGE[0] >= 2:
        from .refinery_forms import ARM, T
        o, col = rim_outline(T), ARM
    else:
        o, col = HI, GT
    for i in range(8):                                                        # the rim, mitred to the octagon
        j = (i + 1) % 8
        if i == 2:                                                            # the +u side: cut by the terminal's slot
            for a, b, c, d in ((o[2], (o[2][0], -TS), (iu, -TS), inner[2]), ((o[3][0], TS), o[3], inner[3], (iu, TS))):
                face(k, [(*a, zt), (*b, zt), (*c, zt), (*d, zt)], (0, 0, 1), col)
            continue
        pts = [(*o[i], zt), (*o[j], zt), (*inner[j], zt), (*inner[i], zt)]
        if inner[i] == inner[j]:
            pts = pts[:3]
        face(k, pts, (0, 0, 1), col)
    face(k, [(-iu, -iv, zt), (iu, -iv, zt), (iu, iv, zt), (-iu, iv, zt)], (0, 0, 1), GT)   # the deck, flush with the rim
    spine(k, iu, iv)


def tier(k, lo, hi, z0, z1, c_lo, c_hi, col=G, top=GT):
    """A block from the rectangle lo (u0, u1, v0, v1) at z0 to hi at z1, corners cut by c_lo / c_hi."""
    a, b = _oct(lo, c_lo), _oct(hi, c_hi)
    cen = Vector(((lo[0] + lo[1]) / 2, (lo[2] + lo[3]) / 2, (z0 + z1) / 2))
    for i in range(8):
        j = (i + 1) % 8
        q = [(*a[i], z0), (*a[j], z0), (*b[j], z1), (*b[i], z1)]
        face(k, q, sum((Vector(p) for p in q), Vector()) / 4 - cen, col)
    face(k, [(*p, z1) for p in b], (0, 0, 1), top)


def spine(k, iu, iv):
    """The stacks' plinth down the middle of the deck: one tier, leaning and cut at the corners like the hull, and the
    three round stacks on top."""
    zt, top = rim_top(), H + 0.58
    w, l = 0.43, iv - 0.17
    tier(k, (-w, w, -l, l), (-w + 0.04, w - 0.04, -l + 0.04, l - 0.04), zt, top, 0.18, 0.15)
    for v in (-0.95, 0.0, 0.95):
        stack(k, 0.0, v, top, top + 0.62, 0.36, 0.26)
        if STAGE[0] >= 2:
            from . import refinery_forms as F
            F.stack_forms(k, 0.0, v, top, top + 0.62, 0.36)


def stack(k, u, v, z0, z1, r, ri, n=20):
    """A round stack: its wall, a ring on top, a round bore going down into the dark."""
    ring = lambda rad, z: [(u + rad * math.cos(i * math.tau / n), v + rad * math.sin(i * math.tau / n), z) for i in range(n)]   # noqa: E731
    o0, o1, i1, i0 = ring(r, z0), ring(r, z1), ring(ri, z1), ring(ri, z1 - 0.35)
    for i in range(n):
        j = (i + 1) % n
        out = Vector((math.cos((i + 0.5) * math.tau / n), math.sin((i + 0.5) * math.tau / n), 0))
        face(k, [o0[i], o0[j], o1[j], o1[i]], out, G)
        face(k, [o1[i], o1[j], i1[j], i1[i]], (0, 0, 1), GT)
        face(k, [i1[i], i1[j], i0[j], i0[i]], -out, GD)
    face(k, i0, (0, 0, 1), HOLE)


def terminal(k):
    """The terminal's body, filling its slot from the slot's back wall out to the footprint's edge, its front corners
    cut like the hull's and its top a shallow slope down toward the crew (a screen on a gimbal goes on the slope at the
    detail stage)."""
    v0, v1, c = -0.32, 0.32, 0.12
    ub, uf = U - B - RIM, U - 0.02
    zb, zf = 0.8, 0.58                                                        # the slope: high at the back, low in front
    z = lambda u: zb + (zf - zb) * (u - ub) / (uf - ub)                       # noqa: E731
    plan = [(ub, v0), (uf - c, v0), (uf, v0 + c), (uf, v1 - c), (uf - c, v1), (ub, v1)]
    face(k, [(u, v, z(u)) for u, v in plan], (zb - zf, 0, uf - ub), GT)
    for i in range(len(plan) - 1):
        (ua, va), (ub_, vb) = plan[i], plan[i + 1]
        out = Vector(((ua + ub_) / 2 - (ub + uf) / 2, (va + vb) / 2, 0))
        face(k, [(ua, va, 0), (ub_, vb, 0), (ub_, vb, z(ub_)), (ua, va, z(ua))], out, G)


STAGE = [1]                          # the stage being built (set by model)


def model(rot=0, stage=2):
    """The refinery as far as `stage` (1 the massing, 2 with its sub-forms)."""
    STAGE[0] = stage
    k = K(f"refinery_s{stage}_{rot}", FP, rot)
    hull(k)
    terminal(k)
    if stage >= 2:
        from . import refinery_forms as F
        F.forms(k)
    return k.build()


def blockout(rot=0):
    k = K(f"refinery_blockout_{rot}", FP, rot)
    hull(k)
    terminal(k)
    return k.build()
