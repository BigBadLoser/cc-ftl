"""The machinery behind the exterior hull's plating (wall3d_ext_stripped): a small kit of composed units, each built of
convex parts (boxes with bevelled edges, many-sided cylinders along any of a side's three axes) in a side's own
terms: u along it, d in from its upright face, z up. Sizes are in art px (P: a 32nd of a tile). A unit returns
[(planes, its front's depth, its kind)]; the kind picks its tones (wall3d_ext_stripped.TONES)."""
import math

from mathutils import Vector

P = 1 / 32
SIDES = 12
UP = Vector((0, 0, 1))


def box(side, u0, u1, d0, d1, z0, z1, kind, bevel=0.0):
    """A box (u, d, z ranges), its twelve edges bevelled this much."""
    n, t = side.n, side.t
    planes = [(t, u1), (-t, -u0), (n, side.off - d0), (-n, -(side.off - d1)), (UP, z1), (-UP, -z0)]
    if bevel:
        corners = [side.at(d, z, u) for d in (d0, d1) for z in (z0, z1) for u in (u0, u1)]
        axes = (n, -n, t, -t, UP, -UP)
        for i, a in enumerate(axes):
            for b in axes[i + 1:]:
                if a.dot(b) < -0.5:
                    continue
                m = (a + b).normalized()
                planes.append((m, max(m.dot(q) for q in corners) - bevel * 0.7071))
    return [(planes, d0, kind)]


def cyl(side, axis, centre, r, half, kind, front=None):
    """A cylinder along axis ("t", "n" or "z") through centre (u, d, z), radius r, half its length."""
    u, d, z = centre
    c = side.at(d, z, u)
    a = {"t": side.t, "n": -side.n, "z": UP}[axis]
    e1, e2 = {"t": (side.n, UP), "n": (side.t, UP), "z": (side.n, side.t)}[axis]
    planes = [(a, a.dot(c) + half), (-a, -a.dot(c) + half)]
    for i in range(SIDES):
        ang = 2 * math.pi * (i + 0.5) / SIDES
        m = e1 * math.cos(ang) + e2 * math.sin(ang)
        planes.append((m, m.dot(c) + r))
    return [(planes, d - r if front is None else front, kind)]


def pump(side, u, z0):
    """A pump: a motor lying along the side on a plinth, its housing at one end, a riser elbowing into the wall."""
    out = box(side, u, u + 16 * P, 3 * P, 10 * P, z0, z0 + 3 * P, "cradle", bevel=1 * P)
    out += cyl(side, "t", (u + 6 * P, 6 * P, z0 + 7.5 * P), 4.5 * P, 5 * P, "body")
    for k in (0, 1, 2):                                     # (the motor's cooling rings)
        out += cyl(side, "t", (u + 3 * P + k * 3 * P, 6 * P, z0 + 7.5 * P), 5 * P, 0.5 * P, "trim")
    out += box(side, u + 11 * P, u + 17 * P, 2.5 * P, 10 * P, z0 + 2 * P, z0 + 12 * P, "body", bevel=2 * P)
    out += cyl(side, "z", (u + 14 * P, 6 * P, z0 + 17 * P), 1.5 * P, 5 * P, "coolant")
    out += cyl(side, "n", (u + 14 * P, 8 * P, z0 + 21 * P), 1.5 * P, 2.5 * P, "coolant", front=4.5 * P)
    out += box(side, u + 12 * P, u + 13 * P, 2 * P, 3 * P, z0 + 9 * P, z0 + 10 * P, "light_r")   # (its status light)
    out += box(side, u + 12.5 * P, u + 15.5 * P, 4.5 * P, 7.5 * P, z0 + 19.5 * P, z0 + 22.5 * P, "trim", bevel=0.5 * P)
    return out


def junction(side, u, z0):
    """A junction box: a rounded box with a lid band, three conduits rising from it and bending into the wall."""
    out = box(side, u, u + 10 * P, 3.5 * P, 10 * P, z0, z0 + 14 * P, "body", bevel=1.5 * P)
    out += box(side, u + 0.5 * P, u + 9.5 * P, 3 * P, 10 * P, z0 + 9 * P, z0 + 10 * P, "hazard")
    out += box(side, u + 2 * P, u + 3 * P, 3 * P, 4 * P, z0 + 5 * P, z0 + 6 * P, "light_c")     # (its status light)
    for k, h in enumerate((6, 9, 7)):
        cu = u + (2.5 + 2.5 * k) * P
        out += cyl(side, "z", (cu, 6.5 * P, z0 + 14 * P + h * P / 2), 1 * P, h * P / 2, "pipe")
        out += cyl(side, "n", (cu, 8.5 * P, z0 + 14 * P + h * P), 1 * P, 2 * P, "pipe", front=5.5 * P)
    return out


def tanks(side, u, z0, h):
    """A stack of three coolant tanks on a cradle: upright, banded, domed."""
    out = box(side, u, u + 22 * P, 4 * P, 10 * P, z0, z0 + 2 * P, "cradle")
    for k in range(3):
        cu, dep = u + (4 + 7 * k) * P, (6.5 if k != 1 else 7.5) * P
        hk = h * (1, 0.85, 0.95)[k]
        out += cyl(side, "z", (cu, dep, z0 + 2 * P + hk / 2), 3.2 * P, hk / 2, "body")
        out += cyl(side, "z", (cu, dep, z0 + 2 * P + hk + 1 * P), 2.2 * P, 1 * P, "body")   # (its dome)
        for fz, kind in ((0.3, "trim"), (0.7, "hazard")):
            out += cyl(side, "z", (cu, dep, z0 + 2 * P + hk * fz), 3.6 * P, 0.6 * P, kind)
    return out


def actuator(side, u, lean_at, length):
    """A hydraulic ram on the lean: its barrel along the lean on two lugs, the rod out of its upper end."""
    ln = side.lean[0].normalized()
    up = (UP - ln * ln.dot(UP)).normalized()                # (up the lean)
    base = lean_at(0.15, 4 * P, u)
    out = []
    for frac, r, half, kind in ((0.3, 3.5 * P, 0.22, "ram"), (0.68, 1.8 * P, 0.2, "pipe")):
        c = base + up * (length * frac)
        planes = [(up, up.dot(c) + half * length), (-up, -up.dot(c) + half * length)]
        for i in range(SIDES):
            ang = 2 * math.pi * (i + 0.5) / SIDES
            m = side.t * math.cos(ang) + ln * math.sin(ang)
            planes.append((m, m.dot(c) + r))
        out.append((planes, 4 * P - r, kind))
    for frac in (0.12, 0.5):                                 # (the lugs)
        c = base + up * (length * frac) + ln * (-2 * P)
        planes = [(side.t, side.t.dot(c) + 1.5 * P), (-side.t, -side.t.dot(c) + 1.5 * P),
                  (up, up.dot(c) + 1.5 * P), (-up, -up.dot(c) + 1.5 * P),
                  (ln, ln.dot(c) + 2 * P), (-ln, -ln.dot(c) + 2 * P)]
        out.append((planes, 6 * P, "cradle"))
    return out
