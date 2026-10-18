"""Smooth curved-surface helpers on top of cmbkit.Frame (runs inside Blender): lathed profiles (bells, chambers, pump
casings, tori), swept tubes along smooth Bezier paths (ducts and pipes without cube joints) and auto-smooth shading.

Coordinates are the module's LOCAL frame (u, v, z) like Frame. Every helper logs its volume to `cmbkit.REC` (when set)
so overlap.py can check it: lathe segments as coaxial cylinders, tubes as capsules per sample."""
import math
import bmesh
from mathutils import Vector
from . import cmbkit
from .detail import _basis


def _rec(shape):
    if cmbkit.REC is not None and not cmbkit.REC.depth:
        cmbkit.REC.add(shape)


def lathe(f, v, z, prof, sides=48, rec=True):
    """Surface of revolution about the u axis through (v, z). prof: [(u, r, mat[, flute])...]; segment i -> i+1 is
    coloured prof[i][2] (None skips it). flute = (n, depth): radius bulges into n round tubes (for tube walls); a change
    of flute between points makes a radial step. The profile direction sets the normal (travel +u => faces out; walk
    the outer skin front-wards, then the rim, then the inner skin back-wards for a hollow bell)."""
    a0 = math.pi / sides

    def rad(r, fl, i):
        if not fl:
            return r
        n, d = fl
        return r + d * math.sqrt(abs(math.cos(n * (a0 + i * math.tau / sides) / 2)))

    rings = []
    key = lambda p: (round(p[0], 6), round(p[1], 6), p[3] if len(p) > 3 else None)  # noqa: E731
    dedup = []
    for p in prof:                         # a repeated point only re-colours the next segment
        if dedup and key(dedup[-1]) == key(p):
            dedup[-1] = p
        else:
            dedup.append(p)
    prof = dedup
    for p in prof:
        u, r, fl = p[0], p[1], (p[3] if len(p) > 3 else None)
        rings.append([f.pt(u, v + rad(r, fl, i) * math.cos(a0 + i * math.tau / sides),
                           z + rad(r, fl, i) * math.sin(a0 + i * math.tau / sides)) for i in range(sides)])
    for k in range(len(prof) - 1):
        mat = prof[k][2]
        if mat is None:
            continue
        A, B = rings[k], rings[k + 1]
        for i in range(sides):
            j = (i + 1) % sides
            f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
        u0, u1 = prof[k][0], prof[k + 1][0]
        if rec and u1 - u0 > 1e-6:
            fl = max((p[3][1] if len(p) > 3 and p[3] else 0) for p in (prof[k], prof[k + 1]))
            _rec({"kind": "cyl", "axis": 0 if f.rot % 2 else 1, "c": f._cyl_c(u0, v, z), "r": (0.0, max(prof[k][1], prof[k + 1][1]) + fl),
                  "a": f._cyl_a(u0, u1), "src": "lathe"})


def torus(f, u, v, z, R, r, mat, sides=48, tsides=12, rec=True):
    """Fat ring (manifold) around the u axis: lathe of a small circle, walked so its normals face out."""
    prof = [(u + r * math.cos(-k * math.tau / tsides), R + r * math.sin(-k * math.tau / tsides), mat) for k in range(tsides + 1)]
    lathe(f, v, z, prof, sides, rec=False)
    if rec:
        _rec({"kind": "cyl", "axis": 0 if f.rot % 2 else 1, "c": f._cyl_c(u, v, z), "r": (R - r, R + r), "a": f._cyl_a(u - r, u + r),
              "src": "torus"})


def bezier(p0, p1, p2, p3, n=16):
    P = [Vector(p) for p in (p0, p1, p2, p3)]
    out = []
    for k in range(n + 1):
        t = k / n
        s = 1 - t
        out.append(P[0] * s ** 3 + P[1] * 3 * s * s * t + P[2] * 3 * s * t * t + P[3] * t ** 3)
    return out


def curve(a, da, b, db, k=0.45, n=16):
    """Bezier from a (leaving along da) to b (arriving along db); k scales the handles by the chord length."""
    a, b, da, db = Vector(a), Vector(b), Vector(da).normalized(), Vector(db).normalized()
    L = (b - a).length * k
    return bezier(a, a + da * L, b - db * L, b, n)


def tube(f, path, r, mat, sides=14, cap=None, capstart=None, rec=True):
    """Round tube swept along a polyline of local points (sample a Bezier for a smooth bend) with rotation-minimising
    frames, so the rings never twist."""
    P = [Vector(p) for p in path]
    n = len(P)
    T = [(P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).normalized() for i in range(n)]
    N = [_basis(T[0])[0]]
    for i in range(1, n):                                       # double reflection (Wang et al.)
        v1 = P[i] - P[i - 1]
        c1 = v1.dot(v1)
        rl = N[-1] - v1 * (2 / c1 * v1.dot(N[-1]))
        tl = T[i - 1] - v1 * (2 / c1 * v1.dot(T[i - 1]))
        v2 = T[i] - tl
        c2 = v2.dot(v2)
        N.append((rl - v2 * (2 / c2 * v2.dot(rl)) if c2 > 1e-12 else rl).normalized())
    a0 = math.pi / sides
    rings = []
    for i in range(n):
        e1, e2 = N[i], T[i].cross(N[i])
        rings.append([f.pt(*(P[i] + e1 * (r * math.cos(a0 + k * math.tau / sides)) + e2 * (r * math.sin(a0 + k * math.tau / sides))))
                      for k in range(sides)])
    for i in range(n - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(sides):
            j = (k + 1) % sides
            f.poly([A[k], A[j], B[j], B[k]], mat, flip=True)
    if cap:
        f.poly(rings[-1][::-1], cap, flip=True)
    if capstart:
        f.poly(rings[0], capstart, flip=True)
    if rec:
        for i in range(n - 1):
            _rec({"kind": "seg", "a": tuple(f.pt(*P[i])), "b": tuple(f.pt(*P[i + 1])), "r": r, "src": "tube"})


def collar(f, path, at, r, mat="brass", t=0.07, sides=14):
    """Flange ring on a swept tube at parameter `at` (0..1 along the samples), square to the path."""
    P = [Vector(p) for p in path]
    i = min(int(at * (len(P) - 1)), len(P) - 2)
    c = P[i] + (P[i + 1] - P[i]) * (at * (len(P) - 1) - i)
    d = (P[i + 1] - P[i]).normalized() * (t / 2)
    tube(f, [c - d, c + d], r, mat, sides, cap=mat, capstart=mat)


def smooth(ob, angle=38.0):
    """Weld coincident vertices and auto-smooth: curved surfaces shade as smooth gradients (quantised to clean bands),
    edges sharper than `angle` stay crisp."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(angle))
    return ob
