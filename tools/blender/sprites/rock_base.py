"""Asteroid rock (family `rock`): shared ground rules for every rock and ground tile.

Tile frame: local x, y in -0.5..0.5 (x = grid +x, y = grid +y), z up in tiles; neighbour masks N(-y)1 E(+x)2 S(+y)4 W(-x)8.
Seamless by construction: shared noise repeats every tile, a variant's own relief is windowed to zero at the border, and
every edge treatment depends only on the position along that edge (period one tile). Strata heights are shared too, so
cliff layers and lip layers line up across tiles."""
import bisect
import math

import numpy as np

from . import core


class Canvas:
    """A mesh in one tile's local frame: what every builder here draws into."""
    def __init__(self, name):
        self.m = core.Mesh(name)

    def p(self, u, v):
        return u, v

    def build(self):
        return [self.m.build()]


ZM = 1.2                                     # rock mass height (asteroidView.ROCK_MASS_Z)
NG = 40                                      # surface grid cells per tile side
TAU = math.tau


def rng(seed):
    return np.random.default_rng(seed)


def per1(t, seed, n=3, amp=1.0):
    r = rng(seed)
    out = 0.0
    for k in range(1, n + 1):
        out += r.uniform(0.4, 1.0) / k * math.sin(TAU * k * t + r.uniform(0, TAU))
    return out * amp


def per2(x, y, seed, n=5):
    r = rng(seed)
    out = 0.0
    for _ in range(n):
        i, j = int(r.integers(-3, 4)), int(r.integers(-3, 4))
        if i == 0 and j == 0:
            i = 1
        a = r.uniform(0.3, 1.0) / math.hypot(i, j)
        out += a * math.sin(TAU * (i * x + j * y) + r.uniform(0, TAU))
    return out


def tri1(t, seed, n=4):
    """A periodic (period 1) piecewise-linear noise: straight runs between kinks, for fracture planes."""
    r = rng(seed)
    out = 0.0
    for k in range(1, n + 1):
        ph = r.uniform(0, 1)
        u = (k * t + ph) % 1.0
        out += r.uniform(0.5, 1.0) / k * (4 * abs(u - 0.5) - 1)
    return out


def window(x, y):
    return (math.cos(math.pi * x) * math.cos(math.pi * y)) ** 2


SIDES = (("n", 1), ("e", 2), ("s", 4), ("w", 8))


def edge_dist(side, x, y):
    """(distance in from that edge, position along it)."""
    return {"n": (y + 0.5, x), "s": (0.5 - y, x), "e": (0.5 - x, y), "w": (x + 0.5, y)}[side]


SEED = {"n": 11, "e": 23, "s": 37, "w": 41}


def gbase(x, y):
    """The levelled ground's shared surface (period one tile): every solid tile's foot sits on it."""
    return 0.01 * per2(x, y, 9)


def _levels():
    """Rock strata: shared heights (every tile cuts the same layers, so cliffs line up) and a colour per layer: mostly
    plain rock, some paler beds, thin dark seams."""
    r = rng(4242)
    lv, cols, z, prev = [], [], -1.8, ""
    while z < 2.4:                               # past the top of the rock (1.2) and of the walls (2.05)
        c = str(r.choice(["rkD", "rkD", "rkD", "rkD", "rkM", "rkM", "rkK"]))
        c = "rkD" if c == prev else c
        lv.append(z)
        cols.append(c)
        z += r.uniform(0.025, 0.045) if c == "rkK" else r.uniform(0.07, 0.17)
        prev = c
    return lv, cols


LEVELS, LCOLS = _levels()


def terrace(z):
    """Stepped strata: within each layer the height bunches toward its foot (a ledge), then rises steeply (a riser)."""
    k = max(0, min(len(LEVELS) - 2, bisect.bisect_right(LEVELS, z) - 1))
    lo, hi = LEVELS[k], LEVELS[k + 1]
    r = max(0.0, min(1.0, (z - lo) / (hi - lo)))
    return lo + (hi - lo) * r ** 2.2


CORNERS = {1: ("se", (0.5, 0.5), (1, 1), ("e", -0.5), ("s", -0.5)),
           2: ("sw", (-0.5, 0.5), (-1, 1), ("w", -0.5), ("s", 0.5)),
           4: ("ne", (0.5, -0.5), (1, -1), ("e", 0.5), ("n", -0.5)),
           8: ("nw", (-0.5, -0.5), (-1, -1), ("w", 0.5), ("n", 0.5))}
MIN_INSET = 0.13                             # a rock cliff's foot always stands this far back on levelled ground


def corner_terms(bits, x, y):
    """(distance to the open diagonal quadrant, blend toward its second side's cliff) for each corner cut."""
    out = []
    for bit, (_, P, (sx, sy), s1, s2) in CORNERS.items():
        if bits & bit:
            dx, dy = max(0.0, -sx * (x - P[0])), max(0.0, -sy * (y - P[1]))
            out.append((math.hypot(dx, dy), math.atan2(dy, dx) / (math.pi / 2), s1, s2))
    return out


def smin(terms):
    """terms: (q, weight-carried values...). Returns (smooth-min q, weighted values) or None when nothing is open."""
    acc, vals = 0.0, None
    for q, *v in terms:
        e = math.exp(-q * 6.0)
        acc += e
        vals = [e * a for a in v] if vals is None else [s + e * a for s, a in zip(vals, v)]
    if acc == 0.0:
        return None
    return max(0.0, min(1.0, -math.log(acc) / 6.0)), [s / acc for s in vals]


def polyg(k, pts, col, out):
    n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
    k.m.poly([core.G(*k.p(p.x, p.y), p.z) for p in pts], col, flip=n.dot(out) < 0)


def quad(k, a0, a1, b1, b0, col, out):
    polyg(k, [a0, a1, b1, b0], col, out)


def tri(k, a, b, c, col, out):
    polyg(k, [a, b, c], col, out)


def clip_z(pts, lo, hi):
    def clip(poly, keep, z):
        res = []
        for i, a in enumerate(poly):
            b = poly[(i + 1) % len(poly)]
            if keep(a):
                res.append(a)
            if keep(a) != keep(b):
                res.append(a.lerp(b, (z - a.z) / (b.z - a.z)))
        return res
    p = clip(pts, lambda q: q.z >= lo, lo)
    return clip(p, lambda q: q.z <= hi, hi) if len(p) >= 3 else []


def strata_faces(k, pts, out, darken=False):
    """A steep face cut along the shared strata heights, each band in its layer's colour: horizontal rock layers."""
    zs = [p.z for p in pts]
    i0 = max(0, bisect.bisect_right(LEVELS, min(zs)) - 1)
    for i in range(i0, len(LEVELS) - 1):
        if LEVELS[i] > max(zs):
            break
        piece = clip_z(pts, LEVELS[i], LEVELS[i + 1])
        if len(piece) >= 3:
            col = LCOLS[i]
            polyg(k, piece, "rkD" if darken and col == "rkM" else col, out)


def clip_f(pts, f):
    """Clip a 2D polygon (x, y tuples) to f >= 0, crossing points by linear interpolation of f."""
    res = []
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        fa, fb = f[a], f[b]
        if fa >= 0:
            res.append(a)
        if (fa >= 0) != (fb >= 0):
            t = fa / (fa - fb)
            p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            f[p] = 0.0
            res.append(p)
    return res


NEED = {1: 6, 2: 12, 4: 3, 8: 9}             # corner bit -> the side bits it needs closed (SE: S+E, SW: S+W, NE, NW)
DIAG = {1: (1, 1), 2: (-1, 1), 4: (1, -1), 8: (-1, -1)}
MASS_CORNERS = (1, 2, 4)                     # NW cuts sit behind the rock's own top: never seen
GROUND_CORNERS = (1, 2, 4, 8)                # but the ground's worn edge is seen from above at every inner corner


def valid_corners(mask, bits):
    return [b for b in bits if mask & NEED[b] == NEED[b]]
