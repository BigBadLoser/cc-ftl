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

