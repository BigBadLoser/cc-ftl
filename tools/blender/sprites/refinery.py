"""REFINERY (module.refinery, 3x4, family `refinery`): raw ore in, metal and electronics out. Built in stages after the
reference: 1 massing (this blockout, plain grey), 2 sub-forms, 3 colour and light, 4 detail and wear.

Massing, in tiers. The hull is one battered solid (walls leaning in, corners cut by a big chamfer) up to its rim; its
long sides have bays let into them (openings with real recesses behind) for the roller assemblies, the output hatch and
the terminal. Its top is a rim round a deck opening: inside, the deck floor sits lower, with a channel along the +u half
holding two sunken hoppers beside a spine about a tile wide down the middle, carrying three round stacks. The crew
side (+u) has the terminal slab in its middle bay, a roller bay either side. Local frame: modkit.K, u across the 3-tile width, v
along the 4."""
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
BAYS = {1: [(-1.42, -0.46, "rollers"), (-0.36, 0.36, "terminal"), (0.46, 1.42, "rollers")],
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
    for za, zb, cut in rows:
        for c in range(len(cols) - 1):
            if cut and c % 2 == 1:                                            # a bay's opening
                continue
            ca, cb = cols[c], cols[c + 1]
            face(k, [at(ca, za, -1), at(cb, za, 1), at(cb, zb, 1), at(ca, zb, -1)], (s, 0, 0), G)
    for v0, v1, kind in bays:
        recess(k, s, v0, v1)
        if kind == "rollers":
            for z, r in ((0.27, 0.14), (0.55, 0.13)):
                u = wall_u(s, z) - s * (D - r - 0.01)
                tube(k, (u, v0 + 0.03, z), (u, v1 - 0.03, z), r, G, sides=14, cap=GT)


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
    """The rim (one ring round the hull's top), the walls inside it down to the deck floor, the floor."""
    iu, iv = U - B - RIM, V - B - RIM                                         # the deck opening's half extents
    inner = [(-iu, -iv), (iu, -iv), (iu, -iv), (iu, iv), (iu, iv), (-iu, iv), (-iu, iv), (-iu, -iv)]
    for i in range(8):                                                        # the rim, mitred to the octagon
        j = (i + 1) % 8
        pts = [(*HI[i], HT), (*HI[j], HT), (*inner[j], HT), (*inner[i], HT)]
        if inner[i] == inner[j]:
            pts = pts[:3]
        face(k, pts, (0, 0, 1), GT)
    sq = [(-iu, -iv), (iu, -iv), (iu, iv), (-iu, iv)]
    for i in range(4):                                                        # the opening's walls, facing in
        a, b = sq[i], sq[(i + 1) % 4]
        mid = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0))
        face(k, [(*a, H), (*b, H), (*b, HT), (*a, HT)], -mid, GD)
    face(k, [(*p, H) for p in sq], (0, 0, 1), G)
    spine(k, iu, iv)
    for v in (-0.45, 0.45):                                                   # hoppers sunk in the channel
        u, s = 0.73, 0.23
        k.box(u, v, H - 0.02, 2 * s - 0.08, 2 * s - 0.08, 0.04, HOLE)
        for du, dv, su, sv in ((-s, 0, 0.06, 2 * s), (s, 0, 0.06, 2 * s), (0, -s, 2 * s, 0.06), (0, s, 2 * s, 0.06)):
            k.box(u + du, v + dv, H, su, sv, 0.22, G, top=GT)


def spine(k, iu, iv):
    """The raised block along the -u half of the deck, inside the rim, and its three round stacks."""
    u0, u1, v0, v1, top = -0.45, 0.45, -iv + 0.1, iv - 0.1, H + 0.6        # about a tile wide, centred
    lo, hi = (u0, u1, v0, v1), (u0 + 0.05, u1 - 0.05, v0 + 0.05, v1 - 0.05)
    a, b = _oct(lo, 0.1), _oct(hi, 0.08)
    cen = Vector(((u0 + u1) / 2, 0, (H + top) / 2))
    for i in range(8):
        j = (i + 1) % 8
        q = [(*a[i], H), (*a[j], H), (*b[j], top), (*b[i], top)]
        face(k, q, sum((Vector(p) for p in q), Vector()) / 4 - cen, G)
    face(k, [(*p, top) for p in b], (0, 0, 1), GT)
    for v in (-0.95, 0.0, 0.95):
        stack(k, (u0 + u1) / 2, v, top, top + 0.62, 0.36, 0.26)


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
    """The terminal slab, standing in its bay at the access tile and rising above the rim (screen up top later)."""
    v0, v1 = -0.32, 0.32
    u_in = wall_u(1, 0) - D
    k.box((u_in + U) / 2 - 0.02, (v0 + v1) / 2, 0, U - u_in - 0.04, v1 - v0, HT + 0.45, G, top=GT)


def blockout(rot=0):
    k = K(f"refinery_blockout_{rot}", FP, rot)
    hull(k)
    terminal(k)
    return k.build()
