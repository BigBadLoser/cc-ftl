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


def segments(m, c, z0, z1, r0, r1, n, gap, off, outer, top, cut, pick=None):
    """One tier of a head split into n chunky fragments (radius r0 at z0 to r1 at z1), `gap` radians apart; outer(i) is a
    fragment's outer colour, top its top, cut the faces of the splits; pick: only these fragments."""
    for i in (range(n) if pick is None else pick):
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


def arch(m, c, rz, u0, u1, ro, ri, z, outer, inner, end, n=10):
    """A half sleeve (an arch, open side down) lying along the heading from u0 to u1, its feet at z: outer and inner
    skins and the two end faces."""
    def P(u, a, r):
        x, y = rot(c, rz, u, r * math.cos(a))
        return core.G(x, y, z + r * math.sin(a))
    angs = [math.pi * i / n for i in range(n + 1)]
    for a0, a1 in zip(angs, angs[1:]):
        m.poly([P(u0, a0, ro), P(u1, a0, ro), P(u1, a1, ro), P(u0, a1, ro)], outer, flip=True)
        m.poly([P(u0, a0, ri), P(u1, a0, ri), P(u1, a1, ri), P(u0, a1, ri)], inner, flip=True)
        for u in (u0, u1):
            m.poly([P(u, a0, ri), P(u, a0, ro), P(u, a1, ro), P(u, a1, ri)], end, flip=True)
    for a in (0.0, math.pi):                                                              # the feet
        m.poly([P(u0, a, ri), P(u1, a, ri), P(u1, a, ro), P(u0, a, ro)], end, flip=True)


def dome(m, c, z, r, h, col, n=5, sides=14):
    """A low glass dome (a lens) of radius r and height h on z, as stacked frustums; col one colour or one per tier
    (foot first)."""
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        r0, r1 = r * math.cos(t0 * math.pi / 2), r * math.cos(t1 * math.pi / 2)
        m.cyl((c[0], c[1], z + h * math.sin(t0 * math.pi / 2)), r0, h * (math.sin(t1 * math.pi / 2) - math.sin(t0 * math.pi / 2)),
              col if isinstance(col, str) else col[i], sides=sides, rtop=max(r1, 0.0005))


def glint(m, c, z, r, h, col, halo=None, spots=((-0.3, 0.58, 0.2, 2.6), (-0.02, 0.28, 0.08, 1.0))):
    """Specular highlights on a dome, each (half-turns round from the camera's line, distance out, size, stretch) as
    fractions of its radius: an oval laid on the surface, stretched along the rim (a curved streak), with an optional
    halo colour around it, one step larger. The default: a streak up and to the camera's left, a dot nearer the middle."""
    def on(x, y, lift):
        d = math.hypot(x - c[0], y - c[1])
        return core.G(x, y, z + h * math.sqrt(max(0.0, 1 - (d / r) ** 2)) + lift)
    for at, out, size, el in spots:
        th, s = CAMERA + at * math.pi, r * size
        cx, cy = c[0] + r * out * math.cos(th), c[1] + r * out * math.sin(th)
        tx, ty, nx, ny = -math.sin(th), math.cos(th), math.cos(th), math.sin(th)
        for sc, colr, lift in ((1.45, halo, 0.0008), (1.0, col, 0.0016)):
            if not colr:
                continue
            pts = []
            for i in range(12):
                a = i * math.tau / 12
                u, v = s * sc * el * math.cos(a), s * sc * 0.75 * math.sin(a)
                pts.append(on(cx + tx * u + nx * v, cy + ty * u + ny * v, lift))
            m.poly(pts, colr, flip=True)


def torus(m, c, z, R, r, col, n=18, ring_n=8):
    """A ring doughnut lying flat on centre height z (a tesla coil's crown)."""
    bm = bmesh.new()
    rings = [[bm.verts.new(Vector((c[0] + (R + r * math.cos(b)) * math.cos(a), c[1] + (R + r * math.cos(b)) * math.sin(a),
                                   z + r * math.sin(b)))) for b in (j * math.tau / ring_n for j in range(ring_n))]
             for a in (i * math.tau / n for i in range(n))]
    for i in range(n):
        for j in range(ring_n):
            i1, j1 = (i + 1) % n, (j + 1) % ring_n
            bm.faces.new((rings[i][j], rings[i1][j], rings[i1][j1], rings[i][j1]))
    emit(m, bm, lambda nn, ctr: col)


def bolt(m, c, pts, w, col):
    """A lightning bolt: a zigzag ribbon through pts, (across, z) in the plane through c that faces the camera."""
    side = Vector((math.cos(CAMERA - math.pi / 2), math.sin(CAMERA - math.pi / 2), 0.0))
    cam = Vector((math.cos(CAMERA), math.sin(CAMERA), 0.0)) * 0.004

    def P(sv, zz, dz):
        q = Vector((c[0], c[1], 0.0)) + side * sv + cam
        return core.G(q.x, q.y, zz + dz)
    for (s0, z0), (s1, z1) in zip(pts, pts[1:]):
        m.poly([P(s0, z0, -w / 2), P(s1, z1, -w / 2), P(s1, z1, w / 2), P(s0, z0, w / 2)], col, flip=True)
