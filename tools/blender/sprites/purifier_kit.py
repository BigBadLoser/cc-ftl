"""Shape helpers for the water purifier's art (issue #321): a vertical prism over a plan outline, a profile extruded
along u or v, and points round an elliptic arc. Each builds through K.p, so a piece turns with the module's rotation."""
import math

from . import core


def prism(k, pts, z, h, col, top=None):
    """A vertical prism over the outline pts (local (u, v), either winding), z..z + h, as one closed mesh."""
    if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1])) < 0:
        pts = pts[::-1]
    g = [k.p(u, v) for u, v in pts]
    bot = [core.G(x, y, z) for x, y in g]
    tp = [core.G(x, y, z + h) for x, y in g]
    n = len(g)
    for i in range(n):
        j = (i + 1) % n
        k.m.poly([bot[i], bot[j], tp[j], tp[i]], col, flip=True)
    k.m.poly(tp[::-1], top or col, flip=True)
    k.m.poly(bot, col, flip=True)


def extrude(k, pts, axis, a0, a1, col, top=None):
    """A profile pts [(x, z)] (x is v when axis is "u", u when axis is "v"), extruded along axis from a0 to a1, as one
    closed mesh; `top` colours the faces that look up."""
    if sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1])) < 0:
        pts = pts[::-1]

    def g(x, z, a):
        u, v = (a, x) if axis == "u" else (x, a)
        return core.G(*k.p(u, v), z)
    s0, s1 = [g(x, z, a0) for x, z in pts], [g(x, z, a1) for x, z in pts]
    n = len(pts)
    flip = axis == "u"
    for i in range(n):
        j = (i + 1) % n
        up = pts[j][0] < pts[i][0]                                       # (the outline runs counter-clockwise)
        k.m.poly([s0[i], s0[j], s1[j], s1[i]], (top if top and up else col), flip=not flip)
    k.m.poly(s0, col, flip=flip)
    k.m.poly(s1[::-1], col, flip=flip)


def quarter(cx, cz, rx, rz, a0, a1, n=6):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cz + rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
