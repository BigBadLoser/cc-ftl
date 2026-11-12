"""Shared parts for the stasis slab storage study (slab_wheel.py; family `slab`, preview only; issue #116): the wheel's
slab placement (ten round a core, turned 40 deg off radial), rings, bolts, springs, motors, tubes and prisms drawn
into a modkit.K, and the striped base with its turning deck."""
import math

from . import detail as D
from .core import G as GV
from .recovery_study4 import quad
from .slab_study import Slab, cassette

UP = (0.0, 0.0, 1.0)
NS, SKEW, R0 = 10, math.radians(40), 1.05       # ten slabs: twelve clipped (round 10's review)
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
    return [math.radians(45 + 360 * i / NS) for i in range(NS)]


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


# ---- housings (round 11) --------------------------------------------------------------------------------------------
def sq(a, half=1.5):
    """The footprint square's edge at angle a."""
    return at(half / max(abs(math.cos(a)), abs(math.sin(a))), a)[:2]


def corner_fill(k, a0, a1, r_in, z0, z1, col, top=None, n=10, half=1.5):
    """The block between the circle r_in and the footprint's square from angle a0 to a1 (a corner housing)."""
    cs = sorted(c for c in (math.pi / 4 + j * math.pi / 2 for j in range(-4, 8)) if a0 < c < a1)
    outer = [sq(a0, half)] + [sq(c, half) for c in cs] + [sq(a1, half)]                    # straight edges: their ends and corners
    inner = [at(r_in, a1 - (a1 - a0) * i / n)[:2] for i in range(n + 1)]
    prism(k, outer + inner, z0, z1, col, top=top)


def floor_fill(k, r_in, z0, z1, col, half=1.5, n=256):
    """The block between a star-shaped hole (its radius r_in(a) at angle a) and the footprint's square."""
    for i in range(n):
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        cs = [c for c in (math.pi / 4 + j * math.pi / 2 for j in range(-4, 8)) if a0 < c < a1]
        prism(k, [at(r_in(a0), a0)[:2], sq(a0, half)] + [sq(c, half) for c in cs] + [sq(a1, half), at(r_in(a1), a1)[:2]],
              z0, z1, col)


def seams(k, r, z0, z1, n, a0=0.0, a1=math.tau, col="dark"):
    """Vertical panel seams round a drum of radius r."""
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        k.box(*at(r + 0.004, a)[:2], z0, 0.022, 0.012, z1 - z0, col, rz=a + math.pi / 2)


def base_drum(k, body, trim, deck, zb=0.42, window=None, wcol="hivis"):
    """The housed base: a kick recess, a panelled drum wall (with a service window at angle `window` showing the
    drive inside), a chamfered lip, and the rotor's deck turning on it with index marks."""
    k.cyl(0, 0, 0.0, 1.4, 0.06, "dark", sides=48)
    k.cyl(0, 0, 0.06, 1.3, zb - 0.14, "dark", sides=48)                   # the inside, seen through the window
    half = math.radians(13)
    skip = (lambda i: abs(math.remainder((i + 0.5) * math.tau / 48 - window, math.tau)) < half) if window else None
    ring(k, 1.45, 0.06, zb - 0.14, 0.07, body, n=48, skip=skip)
    seams(k, 1.48, 0.1, zb - 0.12, 12)
    k.cyl(0, 0, zb - 0.08, 1.48, 0.08, trim, sides=48, rtop=1.42)
    k.cyl(0, 0, zb, 1.42, 0.025, "dark", sides=48)                        # the seam the rotor turns on
    k.cyl(0, 0, zb + 0.025, 1.4, 0.07, deck, top="steelL", sides=48)
    ring(k, 1.37, zb + 0.095, 0.006, 0.05, "steelL", n=40, skip=lambda i: i % 2)
    if window is not None:                                                   # the drive behind the window
        for s_ in (-1, 1):
            k.box(*at(1.49, window + s_ * half)[:2], 0.06, 0.06, 0.08, zb - 0.14, wcol, rz=window)
        ring(k, 1.22, 0.12, 0.16, 0.08, "steelD", top="steel")
        ring(k, 1.27, 0.14, 0.12, 0.03, "black")
        for da in (-0.1, 0.1):
            t = at(1.38, window + da)
            k.cyl(t[0], t[1], 0.1, 0.11, 0.18, "black", top="steelD", sides=14)
            k.cyl(t[0], t[1], 0.28, 0.05, 0.02, "steelL", sides=8)


def canopy(k, z, body, trim, light="slbCy"):
    """The housed top: a chamfered underside, a panelled drum, a chamfered top with panel lines and vents, and the
    rotor's head ring hung under it."""
    k.cyl(0, 0, z, 1.32, 0.08, trim, sides=48, rtop=1.48)
    k.cyl(0, 0, z + 0.08, 1.48, 0.24, body, sides=48)
    seams(k, 1.48, z + 0.1, z + 0.3, 12)
    ring(k, 1.485, z + 0.13, 0.025, 0.012, light, n=48, skip=lambda i: i % 4 == 0)
    k.cyl(0, 0, z + 0.32, 1.48, 0.06, trim, sides=48, rtop=1.38)
    k.cyl(0, 0, z + 0.38, 1.0, 0.04, body, sides=32)
    for i in range(6):
        a = (i + 0.5) * math.tau / 6
        k.box(*at(1.18, a)[:2], z + 0.38, 0.3, 0.06, 0.012, "dark", rz=a + math.pi / 2)
    k.cyl(0, 0, z + 0.42, 0.36, 0.06, trim, sides=16)
    ring(k, R0, z - 0.12, 0.12, 0.12, "steelD", top="steel")              # the head ring


def console(k, a, zb, body, trim):
    """The control panel set into the base's front: a screen, a cell selector (one lit), a field gauge, a key."""
    c = at(1.56, a)
    k.box(c[0], c[1], 0.0, 0.32, 0.7, zb + 0.12, body, rz=a)
    k.box(*at(1.6, a)[:2], zb + 0.12, 0.22, 0.66, 0.05, trim, rz=a)
    f = lambda r, t, z, su, sv, sz, col: k.box(  # noqa: E731
        *(at(r, a)[0] - math.sin(a) * t, at(r, a)[1] + math.cos(a) * t), z, su, sv, sz, col, rz=a)
    f(1.72, 0.0, zb - 0.16, 0.012, 0.44, 0.18, "dark")                       # the screen
    f(1.725, -0.1, zb - 0.12, 0.006, 0.18, 0.1, "slbCy")
    f(1.725, 0.12, zb - 0.1, 0.006, 0.12, 0.04, "green")
    for j in range(NS):                                                      # the cell selector
        f(1.72, -0.22 + j * 0.049, 0.1, 0.012, 0.03, 0.04, "slbAmb" if j == 0 else "steelL")
    f(1.73, 0.26, 0.16, 0.02, 0.06, 0.06, "hivis")
