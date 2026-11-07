"""Shapes for the weapon upgrade items (items_upgrades.py): an open sleeve, a head split into fragments, a tapered crystal
whose camera-facing facets carry the laser colours, an ogive nose and a radiation trefoil. Grid frame as items.py (x, y on
the deck, z up). Face winding does not matter here: the renderer shades both sides alike."""
import math

import bmesh
from mathutils import Vector

from . import core
from .items_kit import emit, rot, tube

CAMERA = math.radians(45)          # the camera looks from grid +x, +y: a face whose normal points this way faces it


def ring(m, c, z, ro, ri, h, side, top, inner, floor=None, sides=14):
    """An open sleeve: outer wall, top ring, inner wall, and (floor) a dark disc closing the bore at its foot."""
    ang = [math.tau * i / sides + math.pi / sides for i in range(sides)]

    def P(r, a, zz):
        return core.G(c[0] + r * math.cos(a), c[1] + r * math.sin(a), zz)
    for i in range(sides):
        a0, a1 = ang[i], ang[(i + 1) % sides]
        m.poly([P(ro, a0, z), P(ro, a1, z), P(ro, a1, z + h), P(ro, a0, z + h)], side, flip=True)
        m.poly([P(ri, a0, z), P(ri, a1, z), P(ri, a1, z + h), P(ri, a0, z + h)], inner, flip=True)
        m.poly([P(ro, a0, z + h), P(ro, a1, z + h), P(ri, a1, z + h), P(ri, a0, z + h)], top, flip=True)
        m.poly([P(ro, a0, z), P(ro, a1, z), P(ri, a1, z), P(ri, a0, z)], side, flip=True)
    if floor:
        m.poly([P(ri, a, z + 0.002) for a in ang], floor, flip=True)


def segments(m, c, z0, z1, r0, r1, n, gap, off, outer, top, cut):
    """One tier of a head split into n chunky fragments (radius r0 at z0 to r1 at z1), `gap` radians apart; outer(i) is a
    fragment's outer colour, top its top, cut the faces of the splits."""
    for i in range(n):
        a0, a1 = off + i * math.tau / n + gap / 2, off + (i + 1) * math.tau / n - gap / 2

        def P(r, a, zz):
            return core.G(c[0] + r * math.cos(a), c[1] + r * math.sin(a), zz)
        q0, q1 = r0 * 0.7, r1 * 0.7
        m.poly([P(r0, a0, z0), P(r0, a1, z0), P(r1, a1, z1), P(r1, a0, z1)], outer(i), flip=True)
        m.poly([P(r1, a0, z1), P(r1, a1, z1), P(q1, a1, z1), P(q1, a0, z1)], top, flip=True)
        for a in (a0, a1):
            m.poly([P(r0, a, z0), P(r1, a, z1), P(q1, a, z1), P(q0, a, z0)], cut, flip=True)


def crystal(m, base, L, r, rz, glass="upGlass", cols=("upRed", "upGrn", "upBlu")):
    """A six-sided crystal standing on `base`: narrow at the foot, full at a quarter up, a tall point. The three facets
    that face the camera are red, green and blue (whatever the heading), the rest and the point glass."""
    b = Vector(base)
    rings = [(0.0, 0.72), (0.22, 1.0), (0.6, 0.94)]
    bm = bmesh.new()
    vs = [[bm.verts.new(b + Vector((r * f * math.cos(t), r * f * math.sin(t), L * h))) for t in (k * math.tau / 6 + rz for k in range(6))]
          for h, f in rings]
    tip = bm.verts.new(b + Vector((0, 0, L)))
    for lo, hi in zip(vs, vs[1:]):
        for i in range(6):
            j = (i + 1) % 6
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    for i in range(6):
        bm.faces.new((vs[-1][i], vs[-1][(i + 1) % 6], tip))
    bm.faces.new(vs[0][::-1])

    def colour(n, ctr):
        if n.z < -0.5:
            return None
        if ctr.z > b.z + L * 0.6 + 1e-6:
            return glass
        d = (math.atan2(n.y, n.x) - CAMERA + math.pi) % math.tau - math.pi
        return cols[1] if abs(d) < math.radians(30) else cols[2] if math.radians(30) <= d < math.radians(90) \
            else cols[0] if -math.radians(90) < d <= -math.radians(30) else glass
    emit(m, bm, colour)


def ogive(m, c, rz, u0, u1, zc, R, col, tip):
    """A smooth nose cone lying along the heading from u0 (radius R) to the point at u1, as stacked frustums."""
    prof = (1.0, 0.97, 0.88, 0.72, 0.5, 0.24, 0.0)
    us = [u0 + (u1 - u0) * i / (len(prof) - 1) for i in range(len(prof))]
    for i in range(len(prof) - 1):
        a, b = rot(c, rz, us[i], 0), rot(c, rz, us[i + 1], 0)
        tube(m, (a[0], a[1], zc), (b[0], b[1], zc), R * prof[i], tip if i >= len(prof) - 2 else col, sides=14,
             r1=R * prof[i + 1], ends=i == 0)


def trefoil(m, c, rz, u0, zc, Rb, R, phi=0.5):
    """A radiation trefoil painted on a body of radius Rb lying along the heading rz, at u0 along it: three blades and a
    hub, black, on the side of the body facing the camera, raised phi towards the camera's height."""
    ax = Vector((math.cos(rz), math.sin(rz), 0.0))
    cam = Vector((math.cos(CAMERA), math.sin(CAMERA), 0.0))
    side = (cam - ax * cam.dot(ax)).normalized()                  # the horizontal across the body, towards the camera
    up = Vector((0.0, 0.0, 1.0))
    n = side * math.cos(phi) + up * math.sin(phi)
    w = up * math.cos(phi) - side * math.sin(phi)
    o = Vector((c[0], c[1], zc)) + ax * u0 + n * (Rb + 0.002)

    def at(x, y):
        return core.G(*(o + ax * x + w * y))
    for th in (90, 210, 330):
        a0, a1 = math.radians(th - 30), math.radians(th + 30)
        arc = [a0 + (a1 - a0) * i / 4 for i in range(5)]
        pts = [at(R * math.cos(a), R * math.sin(a)) for a in arc] + [at(R * 0.32 * math.cos(a), R * 0.32 * math.sin(a)) for a in arc[::-1]]
        m.poly(pts, "upBlack", flip=True)
    m.poly([at(R * 0.2 * math.cos(i * math.tau / 8), R * 0.2 * math.sin(i * math.tau / 8)) for i in range(8)], "upBlack", flip=True)
