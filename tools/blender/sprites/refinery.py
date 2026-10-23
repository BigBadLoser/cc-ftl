"""REFINERY (module.refinery, 3x4, family `refinery`): raw ore in, metal and electronics out. Built in stages after the
reference: 1 massing (this blockout, plain grey), 2 sub-forms, 3 colour and light, 4 detail and wear.

Massing, in tiers: a battered base hull (walls leaning in) with machinery bays let into its long sides between armour
pilasters and big corner armour; a deck at its top, rimmed, with a channel along the +u half holding two sunken
hoppers; a spine block along the -u half carrying three octagonal stacks. The crew side (+u, access tile at v -0.5,
sim access [3, 1]) has the terminal slab in its middle and an output hatch beside it. Local frame: modkit.K, u across
the 3-tile width, v along the 4."""
import math

from mathutils import Vector

from .modkit import K
from .steelkit import face, tube

FP = (3, 4)
U, V = 1.46, 1.96                    # the footprint's half extents, less a hair
H = 0.62                             # the deck
BAT = 0.18                           # the hull's batter: how far its walls lean in, bottom to deck
BAY = 0.2                            # how deep the bays are let in
AV = -0.5                            # the access tile's v
G, GT, GD = "gm", "plate", "steel"   # blockout greys: faces, tops, recesses
HOLE = "dark"


def _oct(r, c):
    """Eight corners going round; c = chamfer, one for all or per corner (u0v0, u1v0, u1v1, u0v1)."""
    u0, u1, v0, v1 = r
    a, b, d, e = (c,) * 4 if isinstance(c, (int, float)) else c
    return [(u0 + a, v0), (u1 - b, v0), (u1, v0 + b), (u1, v1 - d), (u1 - d, v1), (u0 + e, v1), (u0, v1 - e), (u0, v0 + a)]


def frustum(k, lo, hi, z0, z1, c_lo=0.0, c_hi=0.0, col=G, top=GT):
    """A block from the rectangle lo (u0, u1, v0, v1) at z0 to hi at z1, its corners chamfered by c_lo / c_hi."""
    a, b = _oct(lo, c_lo), _oct(hi, c_hi)
    cen = Vector(((lo[0] + lo[1]) / 2, (lo[2] + lo[3]) / 2, (z0 + z1) / 2))
    for i in range(8):
        j = (i + 1) % 8
        q = [(*a[i], z0), (*a[j], z0), (*b[j], z1), (*b[i], z1)]
        if math.dist(a[i], a[j]) + math.dist(b[i], b[j]) < 1e-6:
            continue
        mid = sum((Vector(p) for p in q), Vector()) / 4
        face(k, q, mid - cen, col)
    face(k, [(*p, z1) for p in b], (0, 0, 1), top)


def wall_block(k, side, s0, s1, z1, depth, col=G, c=0.0):
    """A block standing on a long side (+-u), s0 .. s1 along v, its outer face on the battered line, `depth` deep."""
    e = 1 if side > 0 else -1
    out_lo, out_hi = U, U - BAT * z1 / H
    lo = sorted((e * out_lo, e * (out_lo - depth)))
    hi = sorted((e * out_hi, e * (out_lo - depth)))
    frustum(k, (*lo, s0, s1), (*hi, s0, s1), 0, z1, c, c, col)


def corner(k, su, sv, L, depth=0.62, z1=H + 0.08):
    """A corner armour block: out on the batter line on both outer faces, its outer corner cut by a big chamfer."""
    top = BAT * z1 / H
    us = sorted((su * U, su * (U - depth)))
    vs = sorted((sv * V, sv * (V - L)))
    hus = sorted((su * (U - top), su * (U - depth)))
    hvs = sorted((sv * (V - top), sv * (V - L)))
    i = {(-1, -1): 0, (1, -1): 1, (1, 1): 2, (-1, 1): 3}[(su, sv)]
    c_lo, c_hi = [0.0] * 4, [0.0] * 4
    c_lo[i], c_hi[i] = 0.3, 0.3 - top * 0.5
    frustum(k, (*us, *vs), (*hus, *hvs), 0, z1, tuple(c_lo), tuple(c_hi))


def base(k):
    """The hull: a battered core set back by the bay depth, armour pilasters and corner blocks out on the batter line,
    roller assemblies in the bays."""
    ci = U - BAY                                                              # the core's (bay back wall's) half width
    frustum(k, (-ci, ci, -V, V), (-ci + BAT * 0.6, ci - BAT * 0.6, -V + BAT, V - BAT), 0, H, 0.3, 0.22, GD)
    corners = 0.46
    for su in (-1, 1):                                                        # corner armour, wrapping each corner
        for sv in (-1, 1):
            corner(k, su, sv, corners)
    piers = {1: [(-1.12, -0.96), (0.62, 0.78)], -1: [(-0.58, -0.42), (0.42, 0.58)]}
    for side, ps in piers.items():
        for s0, s1 in ps:
            wall_block(k, side, s0, s1, H, BAY + 0.02)
    bays = {1: [(V - corners, 0.78), (0.62, -0.05)], -1: [(-V + corners, -0.58), (-0.42, 0.42), (0.58, V - corners)]}
    for side, bs in bays.items():                                             # rollers: two drums stacked in each bay
        for s0, s1 in bs:
            a, b = sorted((s0, s1))
            for z, r in ((0.17, 0.13), (0.43, 0.12)):
                u = side * (U - BAT * z / H - r - 0.02)
                tube(k, (u, a + 0.04, z), (u, b - 0.04, z), r, G, sides=12, cap=GT)
    for end in (-1, 1):                                                       # end armour, across each short end
        v0, v1 = sorted((end * V, end * (V - BAY - 0.02)))
        hv0, hv1 = sorted((end * (V - BAT * (H + 0.06) / H), end * (V - BAY - 0.02)))
        frustum(k, (-U + corners * 0.6, U - corners * 0.6, v0, v1), (-U + corners * 0.8, U - corners * 0.8, hv0, hv1),
                0, H + 0.06, 0.0, 0.0)


def deck(k):
    """The deck's rim along the +u edge and the ends, the channel inside it, two sunken hoppers in the channel."""
    ci = U - BAY - BAT * 0.6
    frustum(k, (ci - 0.3, ci, -V + BAT + 0.3, V - BAT - 0.3), (ci - 0.28, ci - 0.03, -V + BAT + 0.32, V - BAT - 0.32),
            H, H + 0.16)
    for e in (-1, 1):
        v0, v1 = sorted((e * (V - BAT), e * (V - BAT - 0.35)))
        frustum(k, (-ci, ci, v0, v1), (-ci + 0.03, ci - 0.03, v0 + 0.02, v1 - 0.02), H, H + 0.16)
    for v in (0.2, 1.0):                                                      # hoppers: open boxes sunk in the channel
        u, s = 0.42, 0.27
        k.box(u, v, H - 0.02, 2 * s - 0.08, 2 * s - 0.08, 0.04, HOLE)
        for du, dv, su, sv in ((-s, 0, 0.06, 2 * s), (s, 0, 0.06, 2 * s), (0, -s, 2 * s, 0.06), (0, s, 2 * s, 0.06)):
            k.box(u + du, v + dv, H, su, sv, 0.2, G, top=GT)


def spine(k):
    """The raised block along the -u half and its three octagonal stacks, hollow at the top."""
    frustum(k, (-1.12, 0.02, -1.55, 1.55), (-1.06, -0.04, -1.5, 1.5), H, H + 0.55, 0.12, 0.1)
    for v in (-1.0, 0.0, 1.0):
        u, z0, z1, r = -0.55, H + 0.55, H + 1.2, 0.36
        frustum(k, (u - r, u + r, v - r, v + r), (u - r, u + r, v - r, v + r), z0, z1, 0.22, 0.22)
        k.box(u, v, z1 - 0.04, 1.2 * r, 1.2 * r, 0.05, HOLE)


def terminal(k):
    """The crew side's middle: a slab tower at the access tile (screen up top later), an output hatch beside it."""
    frustum(k, (U - 0.44, U, AV - 0.36, AV + 0.36), (U - 0.44, U - 0.08, AV - 0.32, AV + 0.32), 0, H + 0.5, 0.06, 0.06)
    k.box(U - 0.05, -1.37, 0.06, 0.04, 0.42, 0.42, GD)                       # the output hatch, set in its bay


def blockout(rot=0):
    k = K(f"refinery_blockout_{rot}", FP, rot)
    base(k)
    deck(k)
    spine(k)
    terminal(k)
    return k.build()
