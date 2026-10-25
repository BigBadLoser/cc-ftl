"""Steel shapes in a modkit.K local frame (u, v, z): polygons, plates, tubes and rolled sections, shared by the ore
cage, the tip bin and the refinery."""
import math

from mathutils import Vector

from . import core


def poly(k, pts, col):
    """pts: local (u, v, z), counter-clockwise seen from outside."""
    k.m.poly([core.G(*k.p(u, v), z) for u, v, z in pts], col, flip=True)


def face(k, pts, want, col):
    """A polygon turned to face `want`."""
    P = [Vector(p) for p in pts]
    n = Vector()
    for i, a in enumerate(P):
        b = P[(i + 1) % len(P)]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    poly(k, [tuple(p) for p in (P if n.dot(Vector(want)) >= 0 else P[::-1])], col)


def tube(k, p0, p1, r, col, sides=8, cap=None):
    """A round tube from p0 to p1 (local u, v, z), capped at both ends."""
    p0, p1 = Vector(p0), Vector(p1)
    a = (p1 - p0).normalized()
    t = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))).normalized()
    s = a.cross(t)
    ring = [(t * math.cos(i * math.tau / sides) + s * math.sin(i * math.tau / sides)) * r for i in range(sides)]
    for i in range(sides):
        j = (i + 1) % sides
        poly(k, [tuple(p0 + ring[i]), tuple(p0 + ring[j]), tuple(p1 + ring[j]), tuple(p1 + ring[i])], col)
    poly(k, [tuple(p1 + q) for q in ring], cap or col)
    poly(k, [tuple(p0 + q) for q in ring[::-1]], cap or col)


def slab(k, pts, axis, t, col, side=None):
    """A flat plate: the planar polygon pts thickened by t along axis."""
    a = Vector(axis).normalized() * t / 2
    P = [Vector(p) for p in pts]
    c = sum(P, Vector()) / len(P)
    f, b = [p + a for p in P], [p - a for p in P]
    face(k, f, a, col)
    face(k, b, -a, col)
    for i in range(len(P)):
        j = (i + 1) % len(P)
        face(k, [b[i], b[j], f[j], f[i]], (P[i] + P[j]) / 2 - c, side or col)


def channel(k, a, b, out, z0=0.0, H=0.2, F=0.13, t=0.025, col="steel", web="steelD", stiff=0.6):
    """A C-channel from a to b (local (u, v), axis-aligned), its flanges turned out to the side `out` (+-1), stiffeners
    inside every `stiff`."""
    along_u = abs(b[0] - a[0]) > abs(b[1] - a[1])
    L = abs(b[0] - a[0]) + abs(b[1] - a[1])
    cu, cv = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2

    def box(off, along0, along1, z, w, h, c, top=None):
        m = (along0 + along1) / 2
        u, v = (cu + m, cv + off) if along_u else (cu + off, cv + m)
        su, sv = (along1 - along0, w) if along_u else (w, along1 - along0)
        k.box(u, v, z, su, sv, h, c, top=top)
    box(0.0, -L / 2, L / 2, z0, t, H, web)
    for z in (z0, z0 + H - t):
        box(out * (F / 2 - t / 2), -L / 2, L / 2, z, F, t, col, top="steelL" if z > z0 else None)
    n = max(1, round(L / stiff))
    for i in range(1, n):
        s = -L / 2 + L * i / n
        box(out * F / 2, s - 0.01, s + 0.01, z0 + t, F - t, H - 2 * t, web)


def ibeam(k, a, b, z0=0.0, H=0.18, F=0.12, t=0.025, col="steel", web="steelD"):
    """An I-beam from a to b (local (u, v), axis-aligned)."""
    along_u = abs(b[0] - a[0]) > abs(b[1] - a[1])
    L = abs(b[0] - a[0]) + abs(b[1] - a[1])
    cu, cv = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    sz = (L, F) if along_u else (F, L)
    k.box(cu, cv, z0, *sz, t, web)
    k.box(cu, cv, z0 + t, *((L, t) if along_u else (t, L)), H - 2 * t, web)
    k.box(cu, cv, z0 + H - t, *sz, t, col, top="steel")
