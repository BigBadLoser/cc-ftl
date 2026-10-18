"""Local-frame builder for the combat modules (runs inside Blender).

A model is written once in a LOCAL frame: u along the module's long axis (+u = the hull side / muzzle / nozzle),
v across (-0.5..0.5), z up, origin at the middle of the footprint. `Frame(rot)` maps it to the grid for the four sim
rotations of a [1, 2] footprint (r0 muzzle -y, r1 +x, r2 +y, r3 -x; clockwise like the fabricator) and places the
body so that the sprite origin is the centre of the front-most footprint tile, as for every other module.
Parts can be pitched about the v axis (nose up) around a pivot (pu, pz)."""
import math
from mathutils import Vector
from . import core

# footprint centre relative to the front-most tile centre, per rotation
CENTRE = {0: (0.0, -0.5), 1: (-0.5, 0.0), 2: (0.0, -0.5), 3: (-0.5, 0.0)}


class Recorder:
    """Optional geometry log for overlap.py: every primitive Frame/detail builds becomes a part (bounding box or cylinder
    shape, in Blender space) tagged with the current `group`. Off unless `cmbkit.REC` is set."""

    def __init__(self):
        self.parts, self.group, self.depth, self.pts, self.custom = [], "", 0, None, False

    def add(self, shape):
        shape["group"] = self.group
        self.parts.append(shape)


REC = None


def prim(fn):
    """Decorator for primitives: collect the polygon points of the outermost call into one box part (unless the
    primitive registers its own shape through REC.add)."""
    def wrapper(self, *a, **k):
        r = REC
        if r is None or r.depth:
            return fn(self, *a, **k)
        r.depth, r.pts, r.custom = 1, [], False
        try:
            out = fn(self, *a, **k)
        finally:
            r.depth = 0
            pts, r.pts = r.pts, None
        if pts and not r.custom:
            r.add({"kind": "box", "lo": [min(p[i] for p in pts) for i in range(3)], "hi": [max(p[i] for p in pts) for i in range(3)],
                   "src": fn.__name__})
        return out
    return wrapper


class Frame:
    def __init__(self, m, rot=0, centre=None, square=False):
        self.m, self.rot = m, rot
        self.cx, self.cy = (0.0, 0.0) if square else (centre or CENTRE[rot])

    def xy(self, u, v):
        r = self.rot
        if r == 0:
            return self.cx + v, self.cy - u
        if r == 1:
            return self.cx + u, self.cy + v
        if r == 2:
            return self.cx - v, self.cy + u
        return self.cx - u, self.cy - v

    def pt(self, u, v, z, pitch=0.0, pu=0.0, pz=0.0):
        if pitch:
            du, dz = u - pu, z - pz
            c, s = math.cos(pitch), math.sin(pitch)
            u, z = pu + du * c - dz * s, pz + du * s + dz * c
        x, y = self.xy(u, v)
        return core.G(x, y, z)

    def poly(self, pts, color, flip=False):
        if REC is not None and REC.pts is not None:
            REC.pts.extend(tuple(p) for p in pts)
        self.m.poly(pts, color, flip=flip)

    # ---- primitives -------------------------------------------------------------------------------------------

    @prim
    def box(self, u, v, z, su, sv, sz, color, top=None, pitch=0.0, pu=0.0, pz=0.0, base=True, taper=1.0, tv=None):
        """Box centred at (u, v) with its bottom at z (base) or centred on z. taper scales the top face; tv scales
        only its v extent (a wedge across)."""
        zc = z + sz / 2 if base else z
        h = sz / 2
        t = taper
        tw = taper if tv is None else tv
        # corners: (du, dv, dz) with top corners tapered
        def c(a, b, d):
            k = t if d > 0 else 1.0
            kv = tw if d > 0 else 1.0
            return self.pt(u + a * su / 2 * k, v + b * sv / 2 * kv, zc + d * h, pitch, pu, pz)
        P = {(a, b, d): c(a, b, d) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)}
        faces = [
            ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1), top or color),     # top
            ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1), color),
            ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1), color),            # +u
            ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1), color),        # -u
            ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1), color),            # +v
            ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1), color),        # -v
        ]
        for *ks, col in faces:
            self.poly([P[k] for k in ks], col, flip=True)

    @prim
    def hcyl(self, u0, u1, v, z, r0, color, r1=None, sides=8, pitch=0.0, pu=0.0, pz=0.0, cap=None, capstart=None):
        """Cylinder (or cone frustum) along u from u0 to u1 with centre height z; radius r0 at u0 to r1 at u1."""
        r1 = r0 if r1 is None else r1
        if REC is not None and REC.depth == 1:
            REC.custom = True
            REC.add({"kind": "cyl", "axis": 0 if self.rot % 2 else 1, "c": self._cyl_c(u0, v, z), "r": (0.0, max(r0, r1)),
                     "a": self._cyl_a(u0, u1), "src": "hcyl"})
        a0 = math.pi / sides
        ring = lambda u, r: [self.pt(u, v + r * math.cos(a0 + i * math.tau / sides), z + r * math.sin(a0 + i * math.tau / sides), pitch, pu, pz) for i in range(sides)]  # noqa: E731
        A, B = ring(u0, r0), ring(u1, r1)
        for i in range(sides):
            j = (i + 1) % sides
            self.poly([A[i], A[j], B[j], B[i]], color, flip=True)
        if cap:
            self.poly(B[::-1], cap, flip=True)
        if capstart:
            self.poly(A, capstart, flip=True)

    @prim
    def vcyl(self, u, v, z, r, h, color, top=None, rtop=None, sides=8):
        x, y = self.xy(u, v)
        if REC is not None and REC.depth == 1:
            REC.custom = True
            REC.add({"kind": "box", "lo": [x - r, -y - r, z], "hi": [x + r, -y + r, z + h], "src": "vcyl"})
        self.m.cyl((x, y, z), r, h, color, sides=sides, top=top, rtop=rtop)

    def _cyl_c(self, u, v, z):
        p = self.pt(u, v, z)
        return (p.y, p.z) if self.rot % 2 else (p.x, p.z)

    def _cyl_a(self, u0, u1):
        a, b = self.pt(u0, 0, 0), self.pt(u1, 0, 0)
        i = 0 if self.rot % 2 else 1
        return (min(a[i], b[i]), max(a[i], b[i]))

    def vring_disc(self, u, v, z, r, color, sides=8, thick=0.01):
        x, y = self.xy(u, v)
        self.m.cyl((x, y, z), r, thick, color, sides=sides)


def platform(f, length=1.9, width=0.92, h=0.1):
    """No slab any more: modules sit on the ship floor. The geometry that used to sit on a plate of height h is dropped
    by h so it rests on the floor (length and width are kept for the call sites)."""
    f.m.dz = -h


def hazard_strip(f, u0, u1, v, z, step=0.1, w=0.05, h=0.03):
    """Alternating hazard blocks along u at v."""
    n = int(round((u1 - u0) / step))
    for k in range(n):
        f.box(u0 + (k + 0.5) * step, v, z, step, w, h, "hazY" if k % 2 == 0 else "hazK")


def lerp(a, b, t):
    return a + (b - a) * t
