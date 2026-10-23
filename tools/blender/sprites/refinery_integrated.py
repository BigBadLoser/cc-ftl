"""Refinery, integrated (blockout): no deck for things to stand on. The hull's top rises from the rim as armoured
shoulders, a hip roof, to a ridge; the machine comes up out of the ridge or sits sunk in a pit in it, with armour
collars where it meets the roof, and pipes running from it down the slopes into the hull. Two machines:

  A  crucible  sunk in a pit in the ridge, its molten pool showing; a flue pipe to a stack rising out of the ridge, a
               feed chute from the near end, a pipe down the slope into the hull
  B  stacks    three stacks rising out of a closed ridge through armour collars, a header pipe along them, a downcomer
               down the slope into the hull

Shares the hull, bays, terminal and armour of refinery.py / refinery_forms.py."""
import math

from mathutils import Vector

from . import refinery as R
from . import refinery_forms as F
from .modkit import K
from .steelkit import face, tube


def _poly_ok(pts):
    out = []
    for p in pts:
        if not out or (Vector(p) - Vector(out[-1])).length > 1e-6:
            out.append(p)
    if len(out) > 1 and (Vector(out[0]) - Vector(out[-1])).length < 1e-6:
        out.pop()
    return out


def roof(k, w, l, zs, pit=None):
    """The hip roof: from the deck's edge (inside the rim) up to a ridge w x l at zs, its long slopes armour, its ends
    and hips body. pit: a square (half side) opened in the ridge, its walls dropping to the deck."""
    zt = R.rim_top()
    iu, iv = R.U - R.B - R.RIM, R.V - R.B - R.RIM
    lo = R._oct((-iu, iu, -iv, iv), 0.0)
    hi = R._oct((-w, w, -l, l), 0.14)
    cen = Vector((0, 0, zt))
    for i in range(8):
        j = (i + 1) % 8
        q = _poly_ok([(*lo[i], zt), (*lo[j], zt), (*hi[j], zs), (*hi[i], zs)])
        if len(q) < 3:
            continue
        mid = sum((Vector(p) for p in q), Vector()) / len(q)
        col = F.ARM if i in (2, 6) else R.G
        face(k, q, mid - cen + Vector((0, 0, 0.5)), col)
    if pit is None:
        face(k, [(*p, zs) for p in hi], (0, 0, 1), R.GT)
        return
    s = pit
    sq = [(-s, -s), (s, -s), (s, s), (-s, s)]
    ring = [(-s, -s), (s, -s), (s, -s), (s, s), (s, s), (-s, s), (-s, s), (-s, -s)]
    for i in range(8):                                                       # the coping round the pit
        j = (i + 1) % 8
        q = _poly_ok([(*hi[i], zs), (*hi[j], zs), (*ring[j], zs), (*ring[i], zs)])
        if len(q) >= 3:
            face(k, q, (0, 0, 1), R.GT)
    for i in range(4):                                                       # the pit's walls
        a, b = sq[i], sq[(i + 1) % 4]
        m = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0))
        face(k, [(*a, zt), (*b, zt), (*b, zs), (*a, zs)], -m, R.GD)


def roof_z(u, w, zs):
    """The roof's height over u on a long slope (for pipes running down it)."""
    zt, iu = R.rim_top(), R.U - R.B - R.RIM
    t = (iu - abs(u)) / (iu - w)
    return zt + (zs - zt) * max(0.0, min(1.0, t))


def flange(k, p, axis, r):
    a = Vector(axis).normalized()
    tube(k, Vector(p) - a * 0.025, Vector(p) + a * 0.025, r, F.ARM, sides=12)


def down_pipe(k, u0, v, z0, w, zs, r=0.06, side=-1):
    """A pipe from (u0, v, z0) out over the long slope on `side` and down it into the hull at the rim."""
    iu = R.U - R.B - R.RIM
    lift = r + 0.03
    pts = [Vector((u0, v, z0)), Vector((side * w, v, zs + lift)), Vector((side * (iu - 0.04), v, R.rim_top() + lift))]
    for a, b in zip(pts, pts[1:]):
        tube(k, a, b, r, R.G, sides=10)
    flange(k, pts[-1] - Vector((0, 0, lift - 0.02)), (0, 0, 1), r + 0.04)
    tube(k, pts[-1], pts[-1] - Vector((0, 0, lift)), r, R.G, sides=10)


def top_crucible(k, iu, iv):
    w, l, zs, zt = 0.72, 1.18, 1.18, R.rim_top()
    roof(k, w, l, zs, pit=0.55)
    r = 0.5                                                                   # the crucible, sunk in its pit
    k.cyl(0, 0, zt, r, zs + 0.1 - zt, R.G, top=R.GD, sides=24)
    F.annulus(k, 0, 0, zs + 0.06, zs + 0.16, r + 0.04, r - 0.12, F.ARM)      # its collar and lip
    k.cyl(0, 0, zs + 0.08, r - 0.12, 0.04, R.HOLE, sides=22)                   # the melt (lit at the finish)
    sv = -0.98                                                                 # the stack, out of the ridge
    k.cyl(0, sv, zs, 0.2, 0.66, R.G, top=R.HOLE, sides=16)
    k.cyl(0, sv, zs, 0.26, 0.1, F.ARM, top=F.ARM, sides=16)
    F.annulus(k, 0, sv, zs + 0.6, zs + 0.68, 0.23, 0.14, F.ARM)
    tube(k, (0, -0.52, zs + 0.24), (0, sv + 0.19, zs + 0.24), 0.08, R.G, sides=10)    # the flue
    flange(k, (0, -0.6, zs + 0.24), (0, 1, 0), 0.11)
    flange(k, (0, sv + 0.24, zs + 0.24), (0, 1, 0), 0.11)
    k.box(0, 0.98, zs, 0.44, 0.3, 0.24, R.G, top=R.GT)                         # the feed hopper, on the ridge
    k.box(0, 0.98, zs + 0.24, 0.34, 0.2, 0.01, R.HOLE)
    tube(k, (0, 0.86, zs + 0.18), (0, 0.5, zs + 0.13), 0.07, R.G, sides=10)   # its chute into the crucible
    down_pipe(k, -0.5, 0.25, zs + 0.06, w, zs)


def top_stacks(k, iu, iv):
    w, l, zs = 0.5, 1.32, 1.15
    roof(k, w, l, zs)
    for v in (-0.9, 0.0, 0.9):
        k.cyl(0, v, zs - 0.05, 0.3, 0.62, R.G, top=R.GD, sides=20)
        k.cyl(0, v, zs, 0.37, 0.12, F.ARM, top=F.ARM, sides=20)                # the collar where it leaves the roof
        F.annulus(k, 0, v, zs + 0.52, zs + 0.6, 0.33, 0.22, F.ARM)
        k.cyl(0, v, zs + 0.3, 0.22, 0.02, R.HOLE, sides=16)                    # the bore
        for a in (-0.42, 0.42):
            k.box(0.3 * math.cos(a), v + 0.3 * math.sin(a), zs + 0.18, 0.03, 0.09, 0.2, R.HOLE, rz=a)
    hz, hu = zs + 0.36, -0.4                                                   # the header along the stacks
    tube(k, (hu, -0.9, hz), (hu, 0.9, hz), 0.06, R.G, sides=10, cap=F.ARM)
    for v in (-0.9, 0.0, 0.9):
        tube(k, (hu, v, hz), (-0.28, v, hz), 0.05, R.G, sides=10)
        flange(k, (hu + 0.06, v, hz), (1, 0, 0), 0.08)
    down_pipe(k, hu, -0.9, hz, w, zs, side=-1)


VARIANTS = {"A": top_crucible, "B": top_stacks}


def refinery(variant, rot=0):
    R.G, R.GT, R.GD, R.HOLE = "gm", "plate", "steelD", "dark"
    F.ARM, F.LIT[0] = "lvW2", None
    R.STAGE[0] = 2
    R.TOP[0] = VARIANTS[variant]
    k = K(f"refinery_int_{variant}_{rot}", R.FP, rot)
    R.hull(k)
    R.terminal(k)
    F.forms(k)
    R.TOP[0] = R.spine
    return k.build()
