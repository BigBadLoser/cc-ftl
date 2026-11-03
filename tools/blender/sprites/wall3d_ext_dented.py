"""The exterior hull dented: battle damage's first layer, the intact piece's own geometry (every panel, clamp and seam
kept) bent in by impacts: bowl dents and a crease along each side, its faces re-toned for their new angles. The
renderer blends the intact piece into it round each hit (under the soot), so the hull crumples rather than turning
into another design; holes through to the machinery (wall3d_ext_stripped) come on top.

dent(objs, fronts, phase, H) works on any built hull objects (a generic piece, wall3d_ext_diag; a run set sprite):
their faces are cut fine enough to bend, each vertex pushed in along its nearest side's normal by the dent field, laid
out along each side over two tiles in phase (x + y) mod 2 (wall3d_ext_stripped's layout), so it lines up from tile to
tile, and faded out near the foot and the top so the outline holds."""
import math
import random

import bmesh
from mathutils import Vector

from . import core

P = 1 / 32
MAX_EDGE = 1.5 * P                  # faces cut until no edge is longer (tiles)
PERIOD = 2                          # tiles (as the machinery's layout)
DENTS = 5                           # bowl dents per period along a side
DENT_DEPTH = (1.5 * P, 3.5 * P)     # a dent's depth at its middle
DENT_SIZE = (4 * P, 8 * P)          # its radius (a gaussian's sigma, tiles)
CREASE = (2.5 * P, 1.2 * P)         # a crease (one per period): its depth, half width
FADE = (5 * P, 3 * P)               # no denting this near the foot, the top
TONE_STEP = 0.12                    # brightness change per ramp step (re-toning)
LIGHT = Vector((-0.35, 0.55, 0.76)).normalized()   # (key space: x, y, z) the art's light, for re-toning
RAMP = ("hsXK", "hsK", "hsXD", "hsD", "hsXM", "hsXS", "hsM", "hsXL", "hsS", "hsL", "hsH", "hsW")
SEED = 48


class _Front:
    def __init__(self, s, c, H):
        self.s = Vector((s[0], s[1], 0.0))
        self.n = self.s.normalized()
        self.t = Vector((-self.n.y, self.n.x, 0.0))
        self.off = c / 32 / self.s.length
        self.per = 1.0 if abs(self.t.x) + abs(self.t.y) < 1.2 else math.sqrt(0.5)
        rnd = random.Random(SEED)
        L = PERIOD * self.per
        self.dents = [((i + rnd.uniform(0.15, 0.85)) * L / DENTS, rnd.uniform(0.15, 0.9) * H,
                       rnd.uniform(*DENT_DEPTH), rnd.uniform(*DENT_SIZE)) for i in range(DENTS)]
        self.crease = (rnd.uniform(0, L), rnd.uniform(0.2, 0.7) * H, rnd.uniform(-0.6, 0.6))   # (at, height, slope)
        self.L = L

    def depth(self, p, phase, H):
        """How far in the field pushes a point (key space)."""
        u = self.t.dot(p) + phase * self.per
        z = p.z
        fade = min(1.0, max(0.0, z / FADE[0])) * min(1.0, max(0.0, (H - z) / FADE[1]))
        if fade <= 0:
            return 0.0
        d = 0.0
        for m in range(-2, 3):
            for at, hz, dep, sig in self.dents:
                du, dz = u - (at + m * self.L), z - hz
                d = max(d, dep * math.exp(-(du * du + dz * dz) / (2 * sig * sig)))
            at, hz, slope = self.crease
            du = u - (at + m * self.L)
            off = abs((z - hz) - slope * du) / math.sqrt(1 + slope * slope)
            if abs(du) < 0.35 * self.L:
                d = max(d, CREASE[0] * max(0.0, 1 - off / CREASE[1]) * (1 - abs(du) / (0.35 * self.L)))
        return d * fade


def _key(v):
    return Vector((v.x, -v.y, v.z))


def _ramp_lin():
    return {n: Vector(core.lin(n)) for n in RAMP}


def _retone(col, n0, n1, ramp):
    """A face's colour (linear) shifted along the hull ramp by how its turn changes its light."""
    c = Vector(col[:3])
    near = min(ramp, key=lambda k: (ramp[k] - c).length)
    if (ramp[near] - c).length > 0.08:                     # (not a hull tone: a seam's, a glow's: kept)
        return col
    step = round((max(0.0, n1.dot(LIGHT)) - max(0.0, n0.dot(LIGHT))) / TONE_STEP)
    i = max(0, min(len(RAMP) - 1, RAMP.index(near) + step))
    return (*ramp[RAMP[i]], col[3] if len(col) > 3 else 1.0)


def _flat(objs):
    for o in objs:
        if isinstance(o, (list, tuple)):
            yield from _flat(o)
        elif o is not None:
            yield o


def dent(objs, fronts, phase=0, H=None):
    """Dent the objects in place: fronts [((sx, sy), c32)] (tile-local, as a key's), phase (x + y) mod 2."""
    from . import walls as W
    H = W.hull_top() if H is None else H
    fs = [_Front(s, c, H) for s, c in fronts]
    ramp = _ramp_lin()
    for ob in _flat(objs):
        if ob.type != "MESH":
            continue
        me = ob.data
        bm = bmesh.new()
        bm.from_mesh(me)
        for _ in range(8):                                   # (cut long edges till every face can bend)
            long = [e for e in bm.edges if e.calc_length() > MAX_EDGE]
            if not long:
                break
            bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        n0 = {f.index: _key(f.normal) for f in bm.faces}
        mw = ob.matrix_world
        inv = mw.inverted()
        for v in bm.verts:
            p = _key(mw @ v.co)
            near = min(fs, key=lambda f: abs(f.n.dot(p) - f.off))
            d = near.depth(p, phase, H) if p.z < H - 1e-4 else 0.0
            if d > 0:
                q = p - near.n * d
                v.co = inv @ Vector((q.x, -q.y, q.z))
        bm.normal_update()
        for name in ("Self", "Col"):
            layer = bm.loops.layers.float_color.get(name) or bm.loops.layers.color.get(name)
            if layer is None:
                continue
            for f in bm.faces:
                n1 = _key(f.normal)
                if (n1 - n0[f.index]).length < 1e-4:
                    continue
                for lp in f.loops:
                    col = tuple(lp[layer])
                    if sum(col[:3]) > 0:
                        lp[layer] = _retone(col, n0[f.index], n1, ramp)
        bm.to_mesh(me)
        bm.free()
    return list(_flat(objs))
