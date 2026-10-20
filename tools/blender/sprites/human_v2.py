"""Crew base v2: a new body built for game size (~60 px) on the existing rig, plus the starter gear.

The rig is the base GLB's armature with its rest bones moved to the new proportions (human_shape.shape on the bones only:
short legs, shorter arms, broad shoulders, a big head), so every clip (rotations, plus hip location) carries over. The
body and gear are NOT cut from the realistic base mesh: they are built here from big smooth forms placed on those bones
(a rounded-box head, a lofted torso that bends across the spine bones, thick capsule limbs, mitten hands, boot feet), and
clothing is a shell over the same forms with flat colour regions and hard colour edges. No detail smaller than ~2 px
(0.05 units; 1 unit is ~38 px at 1x).

Items (same slots and ids as before): body, eyes.organic, arm.L/R.flesh, torso.tee, torso.work_shirt, legs.cargo_pants,
hair.short, hair.ponytail, and the EVA suit (torso.eva, legs.eva, arm.L/R.eva, gear.head.eva_helmet, gear.back.eva_pack).
Coordinates: Blender rest space of the armature (z up, feet at 0, front = -y, +x = character left, arms out in a T)."""
import math

import bpy
import numpy as np
from mathutils import Vector

from . import human_shape
from .human_base import paint

SHIN_SLANT = 0.25                     # how much of the base's backward shin slant is kept in the rest pose
PUFF = "eva_puff"                     # the suit's thrust puff objects (human_suit.PUFF, read by the render)
N_RING = 16
SHELL = "medWhite"


# ---- mesh builder --------------------------------------------------------------------------------------------------

class Build:
    """Verts, faces and per-vertex bone weights for one skinned mesh."""

    def __init__(self):
        self.v, self.f, self.w = [], [], []

    def ring(self, centre, e1, e2, r1, r2, wt, n=N_RING, exp=2.0):
        """A closed ring of n verts round `centre` in the plane (e1, e2); a superellipse of radii r1, r2."""
        idx = []
        for k in range(n):
            a = k * math.tau / n
            c, s = math.cos(a), math.sin(a)
            cx = math.copysign(abs(c) ** (2 / exp), c)
            sy = math.copysign(abs(s) ** (2 / exp), s)
            self.v.append(Vector(centre) + e1 * (r1 * cx) + e2 * (r2 * sy))
            self.w.append(wt)
            idx.append(len(self.v) - 1)
        return idx

    def point(self, p, wt):
        self.v.append(Vector(p))
        self.w.append(wt)
        return len(self.v) - 1

    def bridge(self, a, b):
        n = len(a)
        for k in range(n):
            self.f.append([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]])

    def cap(self, ring, pole, flip=False):
        n = len(ring)
        for k in range(n):
            f = [ring[k], ring[(k + 1) % n], pole]
            self.f.append(f[::-1] if flip else f)

    def tube(self, a, b, ra, rb, wt, round_ends=True, exp=2.0, rb2=None, ra2=None, up=None):
        """A capsule from a to b, radius ra at a and rb at b (ra2 / rb2: the second radius, along `up`)."""
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized()
        e2 = (Vector(up) - d * d.dot(Vector(up))).normalized() if up else d.orthogonal().normalized()
        e1 = e2.cross(d)
        ra2, rb2 = ra2 or ra, rb2 or rb
        rings = []
        if round_ends:
            for ph in (-70, -40):
                t = math.radians(ph)
                rings.append(self.ring(a + d * (ra * math.sin(t)), e1, e2, ra * math.cos(t), ra2 * math.cos(t), wt, exp=exp))
        rings.append(self.ring(a, e1, e2, ra, ra2, wt, exp=exp))
        rings.append(self.ring(b, e1, e2, rb, rb2, wt, exp=exp))
        if round_ends:
            for ph in (40, 70):
                t = math.radians(ph)
                rings.append(self.ring(b + d * (rb * math.sin(t)), e1, e2, rb * math.cos(t), rb2 * math.cos(t), wt, exp=exp))
        for r0, r1 in zip(rings, rings[1:]):
            self.bridge(r0, r1)
        lo = a - d * (ra if round_ends else 0)
        hi = b + d * (rb if round_ends else 0)
        self.cap(rings[0], self.point(lo, wt), flip=True)
        self.cap(rings[-1], self.point(hi, wt))

    def loft(self, rings, exp=3.0, cap_lo=True, cap_hi=True, keep=None):
        """A body of horizontal rings: [(centre, half x, half y, weights)], bottom to top."""
        f0 = len(self.f)
        ids = [self.ring(c, Vector((1, 0, 0)), Vector((0, 1, 0)), hx, hy, wt, exp=exp) for c, hx, hy, wt in rings]
        for r0, r1 in zip(ids, ids[1:]):
            self.bridge(r0, r1)
        if cap_lo:
            self.cap(ids[0], self.point(rings[0][0], rings[0][3]), flip=True)
        if cap_hi:
            self.cap(ids[-1], self.point(rings[-1][0], rings[-1][3]))
        if keep:
            self.f[f0:] = [f for f in self.f[f0:] if keep(sum((self.v[i] for i in f), Vector()) / len(f))]

    def sweep(self, rings, grow=0.0, exp=2.4, keep=None, round_ends=True):
        """Sections [(centre, e1, e2, r1, r2, weights)] joined in order, grown by `grow`, ends closed (rounded: an extra
        smaller ring just past each end). keep(face centre) -> bool trims faces."""
        f0 = len(self.f)
        ids = []
        if round_ends:
            c, e1, e2, r1, r2, wt = rings[0]
            ax = (rings[0][0] - rings[1][0]).normalized()
            ids.append(self.ring(c + ax * (0.6 * min(r1, r2)), e1, e2, (r1 + grow) * 0.6, (r2 + grow) * 0.6, wt, exp=exp))
        for c, e1, e2, r1, r2, wt in rings:
            ids.append(self.ring(c, e1, e2, r1 + grow, r2 + grow, wt, exp=exp))
        if round_ends:
            c, e1, e2, r1, r2, wt = rings[-1]
            ax = (rings[-1][0] - rings[-2][0]).normalized()
            ids.append(self.ring(c + ax * (0.6 * min(r1, r2)), e1, e2, (r1 + grow) * 0.6, (r2 + grow) * 0.6, wt, exp=exp))
        for r0, r1_ in zip(ids, ids[1:]):
            self.bridge(r0, r1_)
        self.cap(ids[0], self.point(sum((self.v[i] for i in ids[0]), Vector()) / len(ids[0]), rings[0][5]), flip=True)
        self.cap(ids[-1], self.point(sum((self.v[i] for i in ids[-1]), Vector()) / len(ids[-1]), rings[-1][5]))
        if keep:
            self.f[f0:] = [f for f in self.f[f0:] if keep(sum((self.v[i] for i in f), Vector()) / len(f))]

    def blob(self, centre, hx, hy, hz, wt, exp=2.8, nlat=10, keep=None):
        """A rounded box (superellipsoid) of half extents hx, hy, hz. keep(face centre) -> bool trims faces."""
        c = Vector(centre)
        e = 2 / exp
        sg = lambda v, p: math.copysign(abs(v) ** p, v)  # noqa: E731
        rows = []
        for i in range(1, nlat):
            lat = -math.pi / 2 + math.pi * i / nlat
            row = []
            for k in range(N_RING):
                lon = k * math.tau / N_RING
                x = hx * sg(math.cos(lat), e) * sg(math.cos(lon), e)
                y = hy * sg(math.cos(lat), e) * sg(math.sin(lon), e)
                z = hz * sg(math.sin(lat), e)
                row.append(self.point(c + Vector((x, y, z)), wt))
            rows.append(row)
        f0 = len(self.f)
        for r0, r1 in zip(rows, rows[1:]):
            self.bridge(r0, r1)
        self.cap(rows[0], self.point(c - Vector((0, 0, hz)), wt), flip=True)
        self.cap(rows[-1], self.point(c + Vector((0, 0, hz)), wt))
        if keep:
            self.f[f0:] = [f for f in self.f[f0:] if keep(sum((self.v[i] for i in f), Vector()) / len(f))]

    def mesh(self, name, arm, colour, smooth=True):
        """The skinned mesh object; colour(face centre, normal) -> palette name."""
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.v], [], self.f)
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        groups = {}
        for vi, wt in enumerate(self.w):
            for bone, x in wt.items():
                if bone not in groups:
                    groups[bone] = ob.vertex_groups.new(name=bone)
                groups[bone].add([vi], x, "REPLACE")
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
        ob.parent = arm
        normals = [p.normal.copy() for p in me.polygons]
        paint(ob, lambda c, i: colour(c, normals[i]))
        for p in me.polygons:
            p.use_smooth = smooth
        return ob


def W(bone):
    return {bone: 1.0}


def blend(a, b, t):
    return {a: 1 - t, b: t} if 0 < t < 1 else W(a if t <= 0 else b)


# ---- rig -----------------------------------------------------------------------------------------------------------

def reshape_rig(arm):
    """Move the rest bones to the game-size proportions (the armature in REST, unscaled)."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        h, tl = human_shape.shape(np.array([tuple(eb.head), tuple(eb.tail)]), bones=True)
        eb.head, eb.tail = tuple(h), tuple(tl)
    for s in "LR":                     # the base's ankle sits far behind the knee (a heel joint): stand the shins up
        sh = arm.data.edit_bones[f"shin.{s}"]
        tail = sh.tail.copy()
        tail.y = sh.head.y + (tail.y - sh.head.y) * SHIN_SLANT
        sh.tail = tail                 # the foot is connected: its head follows
    bpy.ops.object.mode_set(mode="OBJECT")


class Rig:
    """Rest bone positions and the traced sections (human_trace.measure) the body is built from."""

    def __init__(self, arm, T):
        B = arm.data.bones
        self.h = {b.name: Vector(b.head_local) for b in B}
        self.t = {b.name: Vector(b.tail_local) for b in B}
        self.T = T
        self.neck = self.h["neck_01"]
        self.hips = self.h["hips"]
        self.chest = self.h["spine_03"]
        self.shoulder_z = self.h["arm.L"].z
        hr = [r for r in T["head"] if "head" in r[3] and r[3]["head"] > 0.5]
        zs = [r[0].z for r in hr]
        self.HX = max(r[1] for r in hr)
        self.HY = max(r[2] for r in hr)
        self.HZ = (max(zs) - min(zs)) / 2 + 0.015
        mid = hr[len(hr) // 2]
        self.head_c = Vector((0.0, mid[0].y, (max(zs) + min(zs)) / 2))
        self.front = min(r[0].y - r[2] for r in hr)                # the face plane (most forward point of the head)


# ---- body parts (shared by the body and the shells) -----------------------------------------------------------------

def torso(b, R, grow=0.0, lo=None, hi=None, cuts=(), keep=None):
    """The traced torso from the crotch to the shoulders, grown by `grow`, clipped to lo <= z <= hi (hem lines); cuts:
    extra rings at those heights, so a colour edge (a waistband) lands on a ring instead of across a tall face; keep:
    trims faces (a neckline)."""
    rings = [(c, hx + grow, hy + grow, w) for c, hx, hy, w in R.T["torso"]]
    zs = [r[0].z for r in rings]

    def at(z):                                                               # a section interpolated at height z
        k = max(0, min(len(rings) - 2, int(np.searchsorted(zs, z)) - 1))
        r0, r1 = rings[k], rings[k + 1]
        t = (z - r0[0].z) / (r1[0].z - r0[0].z)
        return (r0[0].lerp(r1[0], t), r0[1] + (r1[1] - r0[1]) * t, r0[2] + (r1[2] - r0[2]) * t, r0[3] if t < 0.5 else r1[3])
    lo, hi = zs[0] if lo is None else lo, zs[-1] if hi is None else hi
    mid = [r for r in rings if lo < r[0].z < hi] + [at(z) for z in cuts if lo < z < hi]
    clip = [at(lo)] + sorted(mid, key=lambda r: r[0].z) + [at(hi)]
    b.loft(clip, keep=keep)


def chain(b, R, bones, grow=0.0, t0=0.0, t1=1.0, exp=2.4):
    """A limb swept as ONE surface through the traced sections of consecutive bones (shoulder to wrist, hip to ankle),
    each section skinned to its bone, the two sections either side of a joint shared half and half so it bends
    smoothly; t0..t1 clips it to that fraction of the sections (sleeves, hems)."""
    rows = []
    for k, bone in enumerate(bones):
        secs = R.T["limb"][bone]
        if k:
            secs = secs[1:]                                                  # the joint section is the previous bone's last
        for j, (c, e1, e2, r1, r2) in enumerate(secs):
            w = W(bone)
            if k and j == 0:
                w = {bones[k - 1]: 0.5, bone: 0.5}
            rows.append((c, e1, e2, r1, r2, w))
        if k + 1 < len(bones):                                               # the last section of this bone blends forward
            c, e1, e2, r1, r2, _ = rows[-1]
            rows[-1] = (c, e1, e2, r1, r2, {bone: 0.5, bones[k + 1]: 0.5})
    rows = transport(rows)
    n = len(rows)
    k0, k1 = int(round(t0 * (n - 1))), int(round(t1 * (n - 1)))
    b.sweep(rows[k0:max(k1, k0 + 1) + 1], grow=grow, exp=exp, round_ends=True)


def transport(rows):
    """One ring orientation carried down the whole chain (parallel transport along its centre line), so neighbouring
    rings line up vertex for vertex and the surface does not twist where one bone's sections meet the next."""
    out = []
    e1 = None
    for k, (c, _, _, r1, r2, w) in enumerate(rows):
        nxt = rows[min(k + 1, len(rows) - 1)][0]
        prv = rows[max(k - 1, 0)][0]
        a = (nxt - prv).normalized()
        if e1 is None:
            e1 = rows[0][1]
        e1 = (e1 - a * e1.dot(a)).normalized()
        out.append((c, e1, a.cross(e1), r1, r2, w))
    return out


def arm(b, R, side, grow=0.0, upper=1.0, fore=True, hand=True):
    """upper < 1: only that fraction of the upper arm (short sleeves); fore / hand: carry on through them."""
    s = side
    bones = [f"arm.{s}"] + ([f"forearm.{s}"] if fore else []) + ([f"hand.{s}"] if hand else [])
    if upper < 1:
        n_up = len(R.T["limb"][f"arm.{s}"])
        n = sum(len(R.T["limb"][x]) for x in bones) - (len(bones) - 1)
        chain(b, R, bones, grow, t1=upper * (n_up - 1) / (n - 1))
    else:
        chain(b, R, bones, grow)


def leg(b, R, side, grow=0.0, foot=True, boot=0.0):
    s = side
    chain(b, R, [f"leg.{s}", f"shin.{s}"], grow)
    if foot:
        secs = R.T["limb"][f"foot.{s}"]
        b.sweep(transport([(c, e1, e2, r1, r2, W(f"foot.{s}")) for c, e1, e2, r1, r2 in secs]), grow=grow + boot, exp=3.0)


def head(b, R, grow=0.0, keep=None):
    rings = [(c, hx + grow, hy + grow, w) for c, hx, hy, w in R.T["head"]]
    top = rings[-1]
    rings.append((top[0] + Vector((0, 0, 0.012 + grow)), top[1] * 0.55, top[2] * 0.55, top[3]))   # rounded crown
    b.loft(rings, exp=2.8, keep=keep)


def flat(colour):
    return lambda c, n: colour
