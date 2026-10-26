"""Shared shapes for the item pack (family `items`, items_*.py): solids at any angle (tubes, cones, crystals, rock
chunks), a weapon from the crew weapon models laid flat on the deck, and the job list for one item's .s/.m/.l/.held.

All in the grid frame of items.py (x, y on the deck, z up, origin the tile centre at floor level). No randomness: the
rock chunks jitter by a fixed hash of their seed, so renders are reproducible."""
import math

import bmesh
from mathutils import Matrix, Vector

from . import core
from .items import HELD_K, STACK_K, _fin

SIZES = ("s", "m", "l")


def jobs(item, fn):
    """Sprite jobs for item.<id>.s/.m/.l/.held, from fn(m, size) that builds size "s", "m", "l" or "held" into m."""
    def one(size):
        m = core.Mesh(f"{item}_{size}")
        fn(m, size)
        return [_fin(m, HELD_K if size == "held" else STACK_K)]
    return [(f"item.{item}.{s}", (1, 1), "prop", lambda s=s: one(s)) for s in SIZES + ("held",)]


def hashf(*k):
    """A fixed pseudo-random float in [0, 1) from integers: placement jitter that never changes between renders."""
    x = 0
    for v in k:
        x = (x * 1000003 + int(v) * 7919 + 12345) & 0xFFFFFFFF
        x ^= x >> 13
        x = (x * 0x5BD1E995) & 0xFFFFFFFF
        x ^= x >> 15
    return x / 2 ** 32


def emit(m, bm, colour):
    """Push a bmesh solid (grid frame) into m, normals made outward; colour(face_normal, face_centre) -> palette name."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        col = colour(f.normal.copy(), f.calc_center_median())
        if col:
            m.poly([core.G(*v.co) for v in f.verts], col, flip=True)
    bm.free()


def _axes(a):
    a = Vector(a).normalized()
    u = a.cross(Vector((0, 0, 1)) if abs(a.z) < 0.95 else Vector((1, 0, 0))).normalized()
    return a, u, a.cross(u)


def tube(m, p0, p1, r, col, cap=None, sides=10, r1=None, ends=True):
    """A cylinder (or a cone, r1 at p1) from p0 to p1 at any angle; cap: the colour of both ends."""
    p0, p1 = Vector(p0), Vector(p1)
    a, u, v = _axes(p1 - p0)
    r1 = r if r1 is None else r1
    bm = bmesh.new()
    rings = []
    for p, rr in ((p0, r), (p1, r1)):
        rings.append([bm.verts.new(p + (u * math.cos(t) + v * math.sin(t)) * rr)
                      for t in (k * math.tau / sides + math.pi / sides for k in range(sides))])
    for k in range(sides):
        j = (k + 1) % sides
        bm.faces.new((rings[0][k], rings[0][j], rings[1][j], rings[1][k]))
    if ends:
        bm.faces.new(rings[0][::-1])
        if r1 > 1e-4:
            bm.faces.new(rings[1])
    emit(m, bm, lambda n, c: cap if cap and abs(n.dot(a)) > 0.5 else col)


def cone(m, base, tip, r, col, sides=8):
    """A pointed cone (a missile's nose, a crystal's tip)."""
    base, tip = Vector(base), Vector(tip)
    a, u, v = _axes(tip - base)
    bm = bmesh.new()
    ring = [bm.verts.new(base + (u * math.cos(t) + v * math.sin(t)) * r) for t in (k * math.tau / sides for k in range(sides))]
    t = bm.verts.new(tip)
    for k in range(sides):
        bm.faces.new((ring[k], ring[(k + 1) % sides], t))
    bm.faces.new(ring[::-1])
    emit(m, bm, lambda n, c: col)


def crystal(m, base, axis, L, r, side, tip, sides=6):
    """A pointed hexagonal crystal standing from base along axis: prism in `side`, the point in `tip`."""
    base = Vector(base)
    a, u, v = _axes(axis)
    bm = bmesh.new()
    ring0 = [bm.verts.new(base + (u * math.cos(t) + v * math.sin(t)) * r) for t in (k * math.tau / sides for k in range(sides))]
    ring1 = [bm.verts.new(p.co + a * (L * 0.7)) for p in ring0]
    pt = bm.verts.new(base + a * L)
    for k in range(sides):
        j = (k + 1) % sides
        bm.faces.new((ring0[k], ring0[j], ring1[j], ring1[k]))
        bm.faces.new((ring1[k], ring1[j], pt))
    bm.faces.new(ring0[::-1])
    tip_z = base + a * (L * 0.7)
    emit(m, bm, lambda n, c: tip if (c - base).dot(a) > (tip_z - base).dot(a) - 1e-6 else side)


def chunk(m, c, size, seed, top, side, under=None, rz=0.0):
    """A rock chunk: a jittered, flattened icosphere sitting on z = c.z; faces facing up take `top`, the rest `side`
    (a list cycles over faces: flecks). size = (sx, sy, sz)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.5)
    R = Matrix.Rotation(rz, 3, "Z")
    zmin = 1e9
    for i, vt in enumerate(bm.verts):
        j = 0.72 + 0.5 * hashf(seed, i)
        p = Vector((vt.co.x * size[0], vt.co.y * size[1], vt.co.z * size[2])) * j
        vt.co = R @ p
        zmin = min(zmin, vt.co.z)
    for vt in bm.verts:
        vt.co.z = max(vt.co.z - zmin, 0.0)
        vt.co += Vector((c[0], c[1], c[2]))
    tops = top if isinstance(top, (list, tuple)) else [top]
    sides = side if isinstance(side, (list, tuple)) else [side]
    cnt = [0]

    def colour(n, ctr):
        cnt[0] += 1
        if n.z > 0.55:
            return tops[int(hashf(seed, cnt[0], 7) * len(tops))]
        if n.z < -0.3 and under:
            return under
        return sides[int(hashf(seed, cnt[0], 3) * len(sides))]
    emit(m, bm, colour)


def gun_flat(m, build, at, rz, k, side=1):
    """A crew weapon model (human_v2_weapons.BUILD[...]) lying on its side on the deck at `at`, its barrel along the
    ground heading rz, scaled by k. side=1 lies on its left (the right side up)."""
    from .human_v2_weapons import Gun
    g = Gun()
    build(g)
    # grip frame: x right, y forward (barrel), z up  ->  deck: forward along rz, the gun's up across, its right up
    fwd = Vector((math.cos(rz), math.sin(rz), 0))
    across = Vector((-math.sin(rz), math.cos(rz), 0))
    zs = [vt.x * side for vt in g.v]
    lift = -min(zs) * k
    ys, ws = [vt.y for vt in g.v], [vt.z for vt in g.v]
    my, mw = (min(ys) + max(ys)) / 2, (min(ws) + max(ws)) / 2          # centred on `at`, not on the grip
    bm = bmesh.new()
    vs = [bm.verts.new(Vector(at) + (fwd * (vt.y - my) + across * (vt.z - mw)) * k + Vector((0, 0, vt.x * side * k + lift)))
          for vt in g.v]
    cols = {}
    for f, c in zip(g.f, g.c):
        try:
            face = bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue
        cols[face] = c
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        m.poly([core.G(*v.co) for v in f.verts], cols.get(f, "dark"), flip=True)
    bm.free()


# Standard layouts: (x, y, z, rz) per unit, filled in order. FLOOR spreads units over the deck; PILE also stacks them.
FLOOR = {"held": [(0.0, 0.0, 0.0, 0.3)],
         "s": [(-0.07, -0.03, 0.0, 0.3), (0.1, 0.07, 0.0, 0.1)],
         "m": [(-0.12, -0.1, 0.0, 0.25), (0.13, -0.06, 0.0, 0.1), (-0.06, 0.15, 0.0, 0.4), (0.16, 0.18, 0.0, -0.1)],
         "l": [(-0.2, -0.14, 0.0, 0.25), (0.06, -0.18, 0.0, 0.1), (0.26, 0.0, 0.0, -0.1), (-0.18, 0.1, 0.0, 0.4),
               (0.08, 0.08, 0.0, 0.2), (-0.04, 0.3, 0.0, -0.2), (0.24, 0.26, 0.0, 0.3)]}


U = 1.4                         # unit scale of place(): the item models are laid out small, then drawn this much bigger


def place(m, size, unit, layout=FLOOR, held_k=0.8, k=U):
    """unit(m, (x, y), z, rz, k) at each slot of the layout for this size (the held one at held_k of the size)."""
    for x, y, z, rz in layout[size]:
        unit(m, (x, y), z, rz, k * (held_k if size == "held" else 1.0))


def pile(h, w=0.0, k=U):
    """A PILE layout for units h high and about w wide (before the unit scale k): two, three, then five on the deck with
    more stacked on top."""
    h, w = h * k, w * k
    d = max(w, 0.2) * 0.55
    return {"held": [(0.0, 0.0, 0.0, 0.3)],
            "s": [(-d * 0.4, 0.0, 0.0, 0.3), (d * 0.5, 0.05, 0.0, 0.15)],
            "m": [(-d * 0.6, -d * 0.4, 0.0, 0.25), (d * 0.6, -d * 0.3, 0.0, 0.1), (-d * 0.1, d * 0.7, 0.0, 0.35),
                  (-d * 0.55, -d * 0.35, h, 0.4)],
            "l": [(-d * 0.8, -d * 0.6, 0.0, 0.25), (d * 0.5, -d * 0.7, 0.0, 0.1), (d * 0.9, d * 0.5, 0.0, -0.1),
                  (-d * 0.5, d * 0.7, 0.0, 0.35), (-d * 0.75, -d * 0.55, h, 0.4), (d * 0.5, -d * 0.65, h, 0.2),
                  (-d * 0.5, d * 0.65, h, 0.3), (-d * 0.2, -d * 0.1, 2 * h, 0.3)]}


def rot(c, rz, u, v):
    """The point (u, v) in a frame at c turned by rz (box-local offsets)."""
    return (c[0] + u * math.cos(rz) - v * math.sin(rz), c[1] + u * math.sin(rz) + v * math.cos(rz))


def ingot(m, c, z, rz, k, side, top, mark=None):
    """A trapezoid ingot (wider at the foot), long along rz; an optional stamped mark on top."""
    L, W, H = 0.26 * k, 0.1 * k, 0.06 * k
    m.box((c[0], c[1], z), (L, W, H), side, top=top, rz=rz, taper=0.8, base=True, bevel=0.006)
    if mark:
        m.box((c[0], c[1], z + H), (L * 0.3, W * 0.4, 0.004), mark, rz=rz, base=True)


def ingots(m, size, side, top, mark=None):
    """Ingots stacked in crossed layers (counts per layer by size)."""
    layers = {"held": (2, 1), "s": (2, 1), "m": (2, 2, 2), "l": (3, 3, 3, 2)}[size]
    k = 0.9 if size == "held" else 1.2
    for layer, cnt in enumerate(layers):
        rz = 0.3 + (math.pi / 2 if layer % 2 else 0.0)
        for i in range(cnt):
            ingot(m, rot((0, 0), rz, 0, (i - (cnt - 1) / 2) * 0.115 * k), layer * 0.06 * k, rz, k, side, top, mark)
