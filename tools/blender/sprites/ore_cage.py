"""ORE CAGE (family `ore_cage`): an open-frame bin of heavy girders with barred sides, holding loose raw ore, for mining
ships and stations. Local frame and placement: modkit.K (front = +v).

The bin: a base frame of C-channels on foot pads round a floor plate, fork pockets through the long sides, posts on base
plates with gussets (a middle post on a long side), kick plates recessed between the posts, round bars to a mid rail and
a hazard-striped top rail. A drop chute with a slide gate stands on the front. The ore is a faceted heap: a jittered
height field closed by a skirt against the bars, with loose chunks scattered on it and pressed into the sides, so it
shows through the bars. Wear is tip_bin_wear's soft grime on the frame's fine faces (rust run-off, dust low).

Fills: .empty (a little spill on the floor), .fill1 (a low pile), .fill2 (half), .full (heaped over the rim). Ores use
the rock family's colours: iron (or*), ice (ic*, a faint glow) and rare metals (rv*, glints on the glow layer)."""
import math

import numpy as np
from mathutils import Vector

from .modkit import K
from .steelkit import channel, poly as _poly, slab

FILLS = ("empty", "fill1", "fill2", "full")
H = 1.05                      # top of the top rail
GIRDER = 0.14                 # base girders and corner posts
KICK = 0.36                   # top of the kick plates
BASE = 0.16                   # top of the base frame
MID = (0.64, 0.71)            # the mid rail
RAIL = 0.12                   # the top rail's depth
BAR_R, BAR_PITCH = 0.022, 0.13
CHUTE = 0.32                  # the drop chute's reach out of the front wall
EDGE = 0.06                   # the frame's inset from the footprint edge
# fill -> (level at the walls, rise to the middle); the heap's surface between
HEAP = {"empty": None, "fill1": (0.2, 0.32), "fill2": (0.5, 0.24), "full": (0.86, 0.36)}
# ore -> faces of the heap (weighted), glow faces (a few), chunk two-tones
ORES = {
    "iron": dict(faces=("orM", "orD", "rkD", "rkM", "orD", "or", "rk"), glow=(), chunk=(("orM", "orD"), ("rkM", "rkD"), ("or", "orM"))),
    "ice": dict(faces=("icM", "ic", "icD", "icL", "icM", "rkM"), glow=("icG",), chunk=(("icL", "ic"), ("ic", "icD"), ("icM", "icD"))),
    "rare": dict(faces=("rkD", "rkM", "rvD", "rk", "rvM", "rkD"), glow=("rvG",), chunk=(("rvM", "rvD"), ("rkM", "rkD"), ("rk", "rkD"))),
}


def _smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


class Bin:
    def __init__(self, fp):
        w, d = fp
        self.u1 = w / 2 - EDGE
        self.v0 = -d / 2 + EDGE
        self.v1 = d / 2 - EDGE - CHUTE           # the front wall; the chute stands out past it
        self.u0 = -self.u1

    def walls(self):
        """(start, end) of each wall's centre line, counter-clockwise from above."""
        a, b, c, d = (self.u0, self.v0), (self.u1, self.v0), (self.u1, self.v1), (self.u0, self.v1)
        return ((a, b), (b, c), (c, d), (d, a))

    def posts(self):
        out = [(u, v) for u in (self.u0, self.u1) for v in (self.v0, self.v1)]
        if self.v1 - self.v0 > 1.6:              # a long side gets a middle post
            out += [(u, (self.v0 + self.v1) / 2) for u in (self.u0, self.u1)]
        return out


class Wear:
    """Wear as palette colours picked by place (blends would snap to off-palette tones): rust in blotches, heavier low
    down, and the asteroid's dust at the foot. A colour maps to itself, then darker stains, then rust."""
    STEPS = {"steel": ((0.58, "grime"), (0.75, "rustD"), (0.92, "rust")), "steelL": ((0.6, "steel"), (0.9, "rust")),
             "steelD": ((0.7, "rustD"),), "hazY": ((0.7, "c4T5"), (0.95, "rust")), "plateC": ((0.6, "grime"),)}

    def __init__(self, seed, amount=1.0, dust=True):
        self.ph = np.random.default_rng(seed).uniform(0, math.tau, 6)
        self.amount, self.dust = amount, dust

    def __call__(self, col, u, v, z):
        if col not in self.STEPS:
            return col
        ph = self.ph
        blot = (0.55 + 0.45 * math.sin(3.1 * u + ph[0]) * math.sin(2.7 * v + ph[1]) +
                0.3 * math.sin(8.3 * u + 5.9 * v + ph[2]) * math.sin(6.1 * z + ph[3]) + 0.2 * math.sin(17 * (u - v) + ph[4]))
        r = self.amount * blot * (0.55 + 0.6 * _smooth((0.6 - z) / 0.6))
        if self.dust and z < 0.22 and math.sin(11 * u + 7 * v + ph[5]) > 0.35 and col in ("steel", "steelD"):
            return "gdD"
        out = col
        for t, c in self.STEPS[col]:
            if r > t:
                out = c
        return out


def _run(k, p, q, z, sz, wd, col, top=None, seg=None, w=None, piece=0.22):
    """A girder of depth wd along the wall p -> q, z .. z + sz, built in pieces so wear can stain it in patches; seg =
    (length, colours) cuts it into stripes instead."""
    L = math.dist(p, q)
    du, dv = (q[0] - p[0]) / L, (q[1] - p[1]) / L
    rz = math.atan2(dv, du)
    n = max(1, round((L + wd) / (seg[0] if seg else piece)))
    s = (L + wd) / n
    for i in range(n):
        t = -wd / 2 + (i + 0.5) * s
        u, v = p[0] + du * t, p[1] + dv * t
        c, tc = (seg[1][i % 2], None) if seg else (col, top)
        if w:
            c, tc = w(c, u, v, z), (w(tc, u, v, z + sz) if tc else None)
        k.box(u, v, z, s, wd, sz, c, top=tc, rz=rz)


def _band(k, p, q, z, sz, off, seg=0.15):
    """Hazard stripes on the outer face of the wall p -> q (off out from its centre line)."""
    L = math.dist(p, q)
    du, dv = (q[0] - p[0]) / L, (q[1] - p[1]) / L
    nu, nv = dv, -du                                                                    # outward (walls run ccw)
    n = max(1, round(L / seg))
    for i in range(n):
        t = (i + 0.5) * L / n
        u, v = p[0] + du * t, p[1] + dv * t
        k.box(u + nu * off, v + nv * off, z, L / n, 0.016, sz, ("hazY", "hazK")[i % 2], rz=math.atan2(dv, du))


def _sections(b, p, q):
    """(t0, t1) spans of the wall p -> q between its posts."""
    L = math.dist(p, q)
    cuts = sorted({0.0, 1.0} | {round(math.dist(p, c) / L, 6) for c in b.posts()
                                if abs(math.dist(p, c) + math.dist(c, q) - L) < 1e-6})
    return list(zip(cuts, cuts[1:]))


def bars(b, p, q, drop=0):
    """Bar positions along the wall p -> q: every BAR_PITCH, clear of the posts. With drop, each section between posts
    has `drop` fewer bars, spaced evenly post to post."""
    L = math.dist(p, q)
    n = max(1, int(L / BAR_PITCH))
    at = lambda t: (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)  # noqa: E731
    ts = [i / n for i in range(1, n) if min(math.dist(at(i / n), c) for c in b.posts()) > GIRDER * 0.8]
    if not drop:
        return [at(t) for t in ts]
    out = []
    for t0, t1 in _sections(b, p, q):
        m = sum(t0 < t < t1 for t in ts) - drop
        out += [at(t0 + (t1 - t0) * (j + 1) / (m + 1)) for j in range(max(0, m))]
    return out


def base(k, b):
    """The base frame: C-channels round the walls on foot pads, fork pockets through the long sides."""
    for (p, q) in b.walls():
        along_u = abs(q[0] - p[0]) > abs(q[1] - p[1])
        du, dv = (q[0] - p[0]) / math.dist(p, q), (q[1] - p[1]) / math.dist(p, q)
        out = round(-du) if along_u else round(dv)                          # the wall's outward side (walls run ccw)
        e = GIRDER / 2
        channel(k, (p[0] - du * e, p[1] - dv * e), (q[0] + du * e, q[1] + dv * e), out,
                z0=0.02, H=BASE - 0.02, F=0.1, web="steel")
    for u, v in b.posts():                                                  # foot pads under the corners
        k.box(u, v, 0.0, 0.3, 0.3, 0.025, "steelD", top="steel")
    for v in ((b.v0 * 2 + b.v1) / 3, (b.v0 + b.v1 * 2) / 3):                 # fork pockets across
        k.box(0, v, 0.03, 2 * b.u1 + 0.22, 0.24, 0.11, "steelL", top="steelL")
        for s in (-1, 1):
            k.box(s * (b.u1 + 0.112), v, 0.042, 0.008, 0.2, 0.086, "dark")


def kick(k, b, p, q):
    """Kick plates between the posts of the wall p -> q, set in from the posts' faces, a flat bar on top."""
    from .tip_bin_wear import band
    L = math.dist(p, q)
    du, dv = (q[0] - p[0]) / L, (q[1] - p[1]) / L
    nu, nv = dv, -du                                                        # outward (walls run ccw)
    for t0, t1 in _sections(b, p, q):
        a0, a1 = t0 * L + GIRDER / 2, t1 * L - GIRDER / 2
        pt = lambda t, off, z: (p[0] + du * t + nu * off, p[1] + dv * t + nv * off, z)   # noqa: E731
        band(k, [pt(a0, 0.02, BASE), pt(a1, 0.02, BASE), pt(a1, 0.02, KICK), pt(a0, 0.02, KICK)], "steelL")
        band(k, [pt(a1, -0.02, BASE), pt(a0, -0.02, BASE), pt(a0, -0.02, KICK), pt(a1, -0.02, KICK)], "steelD")
        m = (a0 + a1) / 2
        k.box(p[0] + du * m, p[1] + dv * m, KICK - 0.02, a1 - a0, 0.06, 0.04, "steelD", top="steelL", rz=math.atan2(dv, du))


def post(k, u, v, b):
    """A post on a base plate, gussets on its outer faces, in courses (for the wear), a cap plate."""
    k.box(u, v, BASE, GIRDER + 0.1, GIRDER + 0.1, 0.025, "steelD", top="steel")
    z = BASE
    while z < H - 1e-6:
        z1 = min(H, z + 0.12)
        k.box(u, v, z, GIRDER, GIRDER, z1 - z, "steel", top="steelD")
        z = z1
    k.box(u, v, H, GIRDER + 0.04, GIRDER + 0.04, 0.04, "steelD", top="steel")
    for su, sv in ((1, 0), (-1, 0), (0, 1), (0, -1)):                        # gussets, on the outside only
        if (su and u * su <= 0) or (sv and (v - (b.v0 + b.v1) / 2) * sv <= 0):
            continue
        f = GIRDER / 2
        pts = [(u + su * f, v + sv * f, BASE + 0.02), (u + su * (f + 0.1), v + sv * (f + 0.1), BASE + 0.02),
               (u + su * f, v + sv * f, BASE + 0.22)]
        slab(k, pts, (sv, su, 0), 0.02, "steelD")


def frame(k, b, drop=0):
    base(k, b)
    for p, q in b.walls():
        kick(k, b, p, q)
        _run(k, p, q, MID[0], MID[1] - MID[0], 0.07, "steel", top="steelL", piece=0.1)   # mid rail
        _run(k, p, q, H - 0.1, 0.1, RAIL, "steel", top="steelL", piece=0.1)              # top rail
        _band(k, p, q, H - 0.09, 0.07, RAIL / 2 + 0.008)                                 # its hazard band
        for u, v in bars(b, p, q, drop):
            k.cyl(u, v, KICK, BAR_R, H - 0.1 - KICK, "steelL", sides=6)
    k.box((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, 0.06, b.u1 - b.u0, b.v1 - b.v0, 0.1, "plateC")   # floor plate
    for u, v in b.posts():
        post(k, u, v, b)


def chute(k, b):
    """The drop chute on the front wall: a spout sloping down and out of a bolted flange round the wall opening, a slide
    gate in guide rails across its mouth (stripes, a pull handle), a lever to lift it, legs under the mouth."""
    from .steelkit import face, tube
    from .tip_bin_wear import _clip
    w0, v0, v1 = 0.24, b.v1 + 0.025, b.v1 + CHUTE - 0.03
    zb, zt = (0.3, 0.17), (0.62, 0.48)                                       # spout floor and cover, wall .. mouth
    for s_ in (-1, 1):                                                       # the flange round the opening
        k.box(s_ * (w0 + 0.05), b.v1 + 0.015, BASE, 0.07, 0.03, zt[0] + 0.07 - BASE, "steelD", top="steel")
    for z in (BASE, zt[0] + 0.02):
        k.box(0, b.v1 + 0.015, z, 2 * w0 + 0.17, 0.03, 0.05, "steelD", top="steel")
    for s_ in (-1, 1):                                                       # cheeks
        slab(k, [(s_ * w0, v0, zb[0] - 0.05), (s_ * w0, v1, zb[1] - 0.05), (s_ * w0, v1, zt[1]), (s_ * w0, v0, zt[0])],
             (1, 0, 0), 0.04, "steel", side="steelD")
    for (za, zc), col, t in ((zb, "steelD", 0.03), (zt, "c4T3", 0.035)):    # floor and cover (painted)
        nrm = (0, -(zc - za), v1 - v0)
        slab(k, [(-w0, v0, za), (w0, v0, za), (w0, v1, zc), (-w0, v1, zc)], nrm, t, col, side="steelD")
    for f in (0.35, 0.7):                                                    # ribs across the cover
        v, z = v0 + (v1 - v0) * f, zt[0] + (zt[1] - zt[0]) * f
        k.box(0, v, z, 2 * w0 + 0.06, 0.04, 0.04, "c4T4", top="c4T3")
    g0, g1, vg = zb[1] - 0.07, zt[1] + 0.05, v1 + 0.012                      # the gate, shut
    ug = w0 + 0.035
    for s_ in (-1, 1):                                                       # its guides, either side of the mouth
        k.box(s_ * ug, v1 + 0.005, g0 - 0.02, 0.05, 0.05, g1 - g0 + 0.06, "steelD", top="steel")
    k.box(0, vg - 0.005, g0, 2 * w0, 0.02, g1 - g0, "hazK")
    rect = [(-w0 + 0.01, g0 + 0.01), (w0 - 0.01, g0 + 0.01), (w0 - 0.01, g1 - 0.01), (-w0 + 0.01, g1 - 0.01)]
    for i in range(-6, 8):                                                   # diagonal stripes
        c = i * 0.14
        band_ = [(c - 1.0, -1.0 + g0), (c + 0.07 - 1.0, -1.0 + g0), (c + 0.07 + 1.0, 1.0 + g0), (c + 1.0, 1.0 + g0)]
        cut = _clip(band_, rect)
        if cut:
            face(k, [(u, vg + 0.007, z) for u, z in cut], (0, 1, 0), "hazY")
    tube(k, (-0.1, vg + 0.04, g1 - 0.06), (0.1, vg + 0.04, g1 - 0.06), 0.014, "steelL", sides=6)   # pull handle
    for s_ in (-0.1, 0.1):
        k.box(s_, vg + 0.02, g1 - 0.075, 0.02, 0.04, 0.03, "steelD")
    piv = (w0 + 0.02, (v0 + v1) / 2, (zb[0] + zt[0] + zb[1] + zt[1]) / 4)   # the lift lever, on the +u cheek
    tube(k, (piv[0], piv[1], piv[2]), (piv[0] + 0.07, piv[1], piv[2]), 0.04, "steel", sides=8, cap="steelD")
    end = (piv[0] + 0.07, piv[1] - 0.06, piv[2] + 0.26)
    tube(k, (piv[0] + 0.06, piv[1], piv[2]), end, 0.02, "steelD", sides=6)
    tube(k, end, (end[0], end[1] - 0.02, end[2] + 0.1), 0.03, "hazY", sides=6, cap="hazK")
    for s_ in (-1, 1):                                                       # legs under the mouth
        k.box(s_ * (w0 - 0.04), v1 - 0.05, 0.02, 0.05, 0.05, zb[1] - 0.07, "steelD", top="steel")
        k.box(s_ * (w0 - 0.04), v1 - 0.05, 0.0, 0.12, 0.12, 0.025, "steelD", top="steel")


def _lump(k, c, axis, r, L, cols, rng, sides=5):
    """A chunk: an irregular cone of `sides` faces about axis, its base sunk into the heap."""
    a = Vector(axis).normalized()
    t = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))).normalized()
    s = a.cross(t)
    c = Vector(c)
    ring = [c - a * r * 0.4 + (t * math.cos(q) + s * math.sin(q)) * r * rng.uniform(0.7, 1.25)
            for q in np.linspace(0, math.tau, sides, endpoint=False) + rng.uniform(0, 1)]
    tip = c + a * L + (t * rng.uniform(-0.3, 0.3) + s * rng.uniform(-0.3, 0.3)) * r
    for i in range(sides):
        p, q = ring[i], ring[(i + 1) % sides]
        _poly(k, [tuple(p), tuple(q), tuple(tip)], cols[i % 2] if rng.random() < 0.8 else cols[1 - i % 2])


class Heap:
    def __init__(self, b, fill, seed):
        self.b, self.rng = b, np.random.default_rng(seed)
        self.level, self.rise = HEAP[fill]
        self.a = b.u1 - GIRDER / 2 - 0.01                        # inside the bars
        self.cu = 0.0
        self.cv = (b.v0 + b.v1) / 2
        self.bv = (b.v1 - b.v0) / 2 - GIRDER / 2 - 0.01

    def h(self, u, v):
        x, y = (u - self.cu) / self.a, (v - self.cv) / self.bv
        r = min(1.0, math.hypot(x, y) / math.sqrt(2) * 1.15)
        return self.level + self.rise * (1 - r * r) + 0.03 * math.sin(7 * u + 1.3) * math.sin(6 * v + 0.4)

    def build(self, k, ore, walls=True):
        o, rng = ORES[ore], self.rng
        nu = max(4, round(2 * self.a / 0.1))
        nv = max(4, round(2 * self.bv / 0.1))
        us = np.linspace(-self.a, self.a, nu + 1) + self.cu
        vs = np.linspace(-self.bv, self.bv, nv + 1) + self.cv
        P = {}
        for i, u in enumerate(us):
            for j, v in enumerate(vs):
                inner = 0 < i < nu and 0 < j < nv
                ju = rng.uniform(-0.025, 0.025) if inner else 0.0
                jv = rng.uniform(-0.025, 0.025) if inner else 0.0
                P[i, j] = (u + ju, v + jv, self.h(u, v) + rng.uniform(-0.04, 0.04))

        def face():
            if o["glow"] and rng.random() < 0.04:
                return o["glow"][0]
            return o["faces"][rng.integers(len(o["faces"]))]
        for i in range(nu):                                                          # the surface
            for j in range(nv):
                a, b_, c, d = P[i, j], P[i + 1, j], P[i + 1, j + 1], P[i, j + 1]
                _poly(k, [a, b_, c], face())
                _poly(k, [a, c, d], face())
        ring = ([P[i, 0] for i in range(nu)] + [P[nu, j] for j in range(nv)] +       # the skirt against the bars
                [P[i, nv] for i in range(nu, 0, -1)] + [P[0, j] for j in range(nv, 0, -1)])
        for i in range(len(ring) if walls else 0):
            p, q = ring[i], ring[(i + 1) % len(ring)]
            _poly(k, [(p[0], p[1], 0.09), (q[0], q[1], 0.09), q, p], face())
        area = 4 * self.a * self.bv
        for _ in range(int(area * 34)):                                             # chunks on the surface
            u = self.cu + rng.uniform(-0.94, 0.94) * self.a
            v = self.cv + rng.uniform(-0.94, 0.94) * self.bv
            r = rng.uniform(0.045, 0.11)
            _lump(k, (u, v, self.h(u, v) + 0.01), (rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 1), r,
                  r * rng.uniform(0.6, 1.1), o["chunk"][rng.integers(len(o["chunk"]))], rng)
        for i in range(len(ring) if walls else 0):                                 # chunks pressed into the sides
            p, q = ring[i], ring[(i + 1) % len(ring)]
            out = Vector((q[1] - p[1], -(q[0] - p[0]), 0)).normalized()
            top = min(p[2], q[2])
            for _ in range(int(top / 0.12) if top > 0.25 else 0):
                t = rng.uniform(0.1, 0.9)
                z = rng.uniform(0.15, top - 0.04)
                r = rng.uniform(0.04, 0.08)
                c = Vector((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, z)) - out * 0.04
                _lump(k, c, out + Vector((0, 0, 0.3)), r, r * 0.8, o["chunk"][rng.integers(len(o["chunk"]))], rng)


def spill(k, b, ore, n, seed):
    """Loose chunks on the floor of the empty bin."""
    rng, o = np.random.default_rng(seed), ORES[ore]
    for _ in range(n):
        u = rng.uniform(b.u0 + 0.15, b.u1 - 0.15)
        v = rng.uniform(b.v0 + 0.15, b.v1 - 0.15)
        r = rng.uniform(0.04, 0.09)
        _lump(k, (u, v, 0.09), (0, 0, 1), r, r * 0.8, o["chunk"][rng.integers(len(o["chunk"]))], rng)


def cage(fp, fill, rot, ore="iron", drop=0):
    from .tip_bin_wear import grime
    k = K(f"ore_cage_{ore}_{fill}_{rot}", fp, rot)
    b = Bin(fp)
    frame(k, b, drop)
    chute(k, b)
    grime(k, 0, len(k.m.f), Vector((0, (b.v0 + b.v1) / 2, 0.6)), lambda v: H, low_z=0.45, run_k=0.5, dust_k=0.6, run_col="grime")
    seed = {"iron": 11, "ice": 23, "rare": 37}[ore] + FILLS.index(fill)
    if HEAP[fill]:
        Heap(b, fill, seed).build(k, ore)
    else:
        spill(k, b, ore, 7, seed)
    return k.build()
