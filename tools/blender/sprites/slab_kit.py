"""Shared parts for the stasis slab storage study (slab_wheel.py; family `slab`, preview only; issue #116): the wheel's
slab placement (twelve round a core, turned 40 deg off radial), rings, bolts, springs, motors, tubes and prisms drawn
into a modkit.K, and the striped base with its turning deck."""
import math

from . import detail as D
from .core import G as GV
from .recovery_study4 import quad
from .slab_study import Slab, cassette

UP = (0.0, 0.0, 1.0)
N12, SKEW, R0 = 12, math.radians(40), 1.0
FRONT = math.pi / 4                                 # the footprint's front corner (toward the viewer)
BACK = FRONT + math.pi


class KF:
    """A modkit.K seen as a cmbkit Frame (pt, poly), so detail.py's tubes draw into it."""

    def __init__(self, k):
        self.k, self.m = k, k.m

    def pt(self, u, v, z, **_):
        return GV(*self.k.p(u, v), z)

    def poly(self, pts, color, flip=False):
        self.k.m.poly(pts, color, flip=flip)


def tube(k, a, b, r, col, sides=8):
    D.seg(KF(k), a, b, r, col, sides, cap=col, capstart=col)


def prism(k, pts, z0, z1, col, top=None):
    """A flat polygon [(u, v)] (counter-clockwise from above) extruded from z0 to z1."""
    quad(k, [(u, v, z1) for u, v in pts], top or col, (0, 0, 1))
    quad(k, [(u, v, z0) for u, v in pts], col, (0, 0, -1))
    for (u0, v0), (u1, v1) in zip(pts, pts[1:] + pts[:1]):
        quad(k, [(u0, v0, z0), (u1, v1, z0), (u1, v1, z1), (u0, v0, z1)], col, (v1 - v0, u0 - u1, 0))


def angles():
    return [math.radians(45 + 360 * i / N12) for i in range(N12)]


def at(r, a, z=0.0):
    return (r * math.cos(a), r * math.sin(a), z)


def slab_at(k, th, z0, r=R0, caps="dark"):
    ts = th - SKEW
    return cassette(k, Slab(at(r, th, z0), UP, (-math.sin(ts), math.cos(ts), 0.0)), body="gm", caps=caps)


def ring(k, r, z, h, w, col, top=None, n=48, skip=None, colf=None):
    """A ring of n segments at radius r: w wide (radially), h tall. skip(i): leave segment i out; colf(i): its colour."""
    for i in range(n):
        if skip and skip(i):
            continue
        a = (i + 0.5) * math.tau / n
        c = colf(i) if colf else col
        k.box(*at(r, a)[:2], z, math.tau * r / n * 1.08, w, h, c, top=top or c, rz=a + math.pi / 2)


def hazard(k, r, z, w=0.08, n=40):
    ring(k, r, z, 0.012, w, None, n=n, colf=lambda i: "hazY" if i % 2 else "hazK")


def bolts(k, r, z, n, s=0.05, col="steelL"):
    for i in range(n):
        k.cyl(*at(r, (i + 0.5) * math.tau / n)[:2], z, s / 2, 0.025, col, top=col, sides=6)


def motor(k, u, v, z, h=0.4, body="gm", fins="steelD"):
    """A finned drive motor standing on its bracket."""
    k.box(u, v, z, 0.36, 0.36, 0.06, "steelD", top="steel")
    k.cyl(u, v, z + 0.06, 0.15, h, body, sides=12)
    for i in range(4):
        k.cyl(u, v, z + 0.14 + i * (h - 0.14) / 4, 0.2, 0.03, fins, sides=12)
    k.cyl(u, v, z + 0.06 + h, 0.08, 0.07, "steelD", top="steel", sides=10)


def spring(k, a, b, r=0.05, n=5, col="brass"):
    """A coil spring from a to b: a rod and n coils."""
    tube(k, a, b, r * 0.35, "steelL")
    for i in range(n):
        t0, t1 = (i + 0.2) / n, (i + 0.6) / n
        p = [tuple(a[j] + (b[j] - a[j]) * t for j in range(3)) for t in (t0, t1)]
        tube(k, p[0], p[1], r, col, sides=8)


def base(k, deck, rim="steelD"):
    """The fixed striped platform; the turning deck (colour `deck`) on a race over it."""
    k.cyl(0, 0, 0.0, 1.48, 0.1, "steelD", top="steel", sides=48)
    hazard(k, 1.42, 0.1)
    k.cyl(0, 0, 0.1, 1.28, 0.06, "steelD", top="steel", sides=48)
    k.cyl(0, 0, 0.16, 1.25, 0.02, "dark", sides=48)
    if deck:
        k.cyl(0, 0, 0.18, 1.25, 0.12, deck, sides=48)


def rot(v, axis, ang):
    """v turned by ang about the unit axis (Rodrigues)."""
    c, s_ = math.cos(ang), math.sin(ang)
    d = sum(axis[i] * v[i] for i in range(3))
    x = (axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0])
    return tuple(v[i] * c + x[i] * s_ + axis[i] * d * (1 - c) for i in range(3))


def frame(th, z0, r=R0, tilt=0.0, lift=0.0):
    """The slab at wheel angle th: its foot at radius r, height z0 + lift, tipped `tilt` outward about its foot."""
    ts = th - SKEW
    U, N = UP, (-math.sin(ts), math.cos(ts), 0.0)
    if tilt:
        T = (-math.sin(th), math.cos(th), 0.0)
        U, N = rot(U, T, tilt), rot(N, T, tilt)
    return Slab(at(r, th, z0 + lift), U, N)



# ---- drives (liked in rounds 8-9) -----------------------------------------------------------------------------------
def tyre_drive(k, a, house, guard, r=1.42, rm=1.66):
    """A tyre drive at angle a: two tyres pressing on the rotor's rim from outside, a slatted motor behind them."""
    k.box(*at((r + rm) / 2, a)[:2], 0.1, 0.4, 0.6, 0.12, "steelD", top="steel", rz=a)
    for da in (-0.13, 0.13):
        t = at(r, a + da)
        k.cyl(t[0], t[1], 0.26, 0.14, 0.14, "black", top="steelD", sides=16)
        k.cyl(t[0], t[1], 0.4, 0.06, 0.03, "steelL", sides=10)
    m = at(rm, a)
    k.box(m[0], m[1], 0.22, 0.26, 0.42, 0.28, house, rz=a)
    for dz in (0.28, 0.36, 0.44):
        k.box(*at(rm + 0.135, a)[:2], dz, 0.012, 0.34, 0.03, "dark", rz=a)
    k.box(m[0], m[1], 0.5, 0.2, 0.3, 0.03, guard, rz=a)


def links(k, pts, z, closed=False, cols=("dark", "steelL"), h=0.07, w=0.05, pitch=0.09):
    """A chain (or, in one colour, a belt) along the polyline pts: segments every `pitch`."""
    segs = list(zip(pts, pts[1:] + (pts[:1] if closed else [])))
    j = 0
    for (u0, v0), (u1, v1) in segs:
        ln = math.hypot(u1 - u0, v1 - v0)
        n = max(1, round(ln / pitch))
        for t in range(n):
            u, v = u0 + (u1 - u0) * (t + 0.5) / n, v0 + (v1 - v0) * (t + 0.5) / n
            k.box(u, v, z, ln / n * (0.9 if len(cols) > 1 else 1.04), w, h, cols[j % len(cols)],
                  rz=math.atan2(v1 - v0, u1 - u0))
            j += 1


def arc(c, r, a0, a1, n):
    return [(c[0] + r * math.cos(a0 + (a1 - a0) * i / n), c[1] + r * math.sin(a0 + (a1 - a0) * i / n))
            for i in range(n + 1)]


def loop(c1, r1, c2, r2):
    """The path of a chain or belt round two pulleys (centres c1, c2; r1 >= r2), wrapped the long way round c1."""
    d = math.hypot(c2[0] - c1[0], c2[1] - c1[1])
    sa = math.atan2(c2[1] - c1[1], c2[0] - c1[0])
    al = math.acos((r1 - r2) / d)
    return arc(c1, r1, sa + al, sa + math.tau - al, 72) + arc(c2, r2, sa - al, sa + al, 10)


def truss_post(k, u, v, z0, z1, col, w=0.22, n=7):
    """A square lattice post: four chords, zigzag lacing on each face, base and cap plates."""
    cs = [(u + du, v + dv) for du, dv in ((-w / 2, -w / 2), (w / 2, -w / 2), (w / 2, w / 2), (-w / 2, w / 2))]
    k.box(u, v, z0, w + 0.14, w + 0.14, 0.05, "steelD", top="steel")
    for c in cs:
        tube(k, (*c, z0), (*c, z1), 0.032, col)
    dz = (z1 - z0) / n
    for i in range(n):
        for j in range(4):
            p, q = cs[j], cs[(j + 1) % 4]
            if i % 2:
                p, q = q, p
            tube(k, (*p, z0 + i * dz), (*q, z0 + (i + 1) * dz), 0.016, col)
    k.box(u, v, z1, w + 0.08, w + 0.08, 0.05, col)


def truss_beam(k, a, b, z, h, col, n=None):
    """A Warren truss from a to b (local u, v) centred at height z, h deep: two chords and diagonals."""
    ln = math.hypot(b[0] - a[0], b[1] - a[1])
    n = n or max(2, round(ln / h))
    for dz in (-h / 2, h / 2):
        tube(k, (a[0], a[1], z + dz), (b[0], b[1], z + dz), 0.035, col)
    for i in range(n):
        p = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for t in (i / n, (i + 1) / n)]
        lo, hi = (z - h / 2, z + h / 2) if i % 2 == 0 else (z + h / 2, z - h / 2)
        tube(k, (*p[0], lo), (*p[1], hi), 0.018, col)
