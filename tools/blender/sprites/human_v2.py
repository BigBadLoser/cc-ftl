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

    def loft(self, rings, exp=3.0, cap_lo=True, cap_hi=True):
        """A body of horizontal rings: [(centre, half x, half y, weights)], bottom to top."""
        ids = [self.ring(c, Vector((1, 0, 0)), Vector((0, 1, 0)), hx, hy, wt, exp=exp) for c, hx, hy, wt in rings]
        for r0, r1 in zip(ids, ids[1:]):
            self.bridge(r0, r1)
        if cap_lo:
            self.cap(ids[0], self.point(rings[0][0], rings[0][3]), flip=True)
        if cap_hi:
            self.cap(ids[-1], self.point(rings[-1][0], rings[-1][3]))

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
    """Rest positions of the bones the body is built on."""

    def __init__(self, arm):
        B = arm.data.bones
        self.h = {b.name: Vector(b.head_local) for b in B}
        self.t = {b.name: Vector(b.tail_local) for b in B}
        hb, ht = self.h["head"], self.t["head"]
        self.neck = self.h["neck_01"]
        self.head_c = Vector((0.0, hb.y - 0.01, ht.z + 0.02))   # head centre
        self.HX, self.HY, self.HZ = 0.165, 0.165, 0.19          # head half extents
        self.hips = self.h["hips"]
        self.chest = self.h["spine_03"]
        self.shoulder_z = self.h["arm.L"].z


# ---- body parts (shared by the body and the shells) -----------------------------------------------------------------

def torso(b, R, grow=0.0, lo=None, hi=None):
    """The torso loft from the crotch to the shoulders, grown by `grow`, clipped to lo <= z <= hi (hem lines)."""
    hz, cz, sz = R.hips.z, R.chest.z, R.shoulder_z
    rings = [((0, 0.02, hz - 0.1), 0.16, 0.11, W("hips")),
             ((0, 0.02, hz), 0.175, 0.115, W("hips")),
             ((0, 0.02, R.h["spine_02"].z), 0.16, 0.105, blend("spine", "spine_02", 0.5)),
             ((0, 0.02, cz + 0.04), 0.2, 0.125, blend("spine_02", "spine_03", 0.7)),
             ((0, 0.03, sz - 0.02), 0.215, 0.12, W("spine_03")),
             ((0, 0.03, sz + 0.06), 0.12, 0.09, W("spine_03"))]
    rings = [(Vector(c), hx + grow, hy + grow, w) for c, hx, hy, w in rings]
    zs = [r[0].z for r in rings]

    def at(z):                                                               # a ring interpolated at height z
        k = max(0, min(len(rings) - 2, int(np.searchsorted(zs, z)) - 1))
        r0, r1 = rings[k], rings[k + 1]
        t = (z - r0[0].z) / (r1[0].z - r0[0].z)
        return (r0[0].lerp(r1[0], t), r0[1] + (r1[1] - r0[1]) * t, r0[2] + (r1[2] - r0[2]) * t, r0[3] if t < 0.5 else r1[3])
    lo, hi = zs[0] if lo is None else lo, zs[-1] if hi is None else hi
    clip = [at(lo)] + [r for r in rings if lo < r[0].z < hi] + [at(hi)]
    b.loft(clip)


def arm(b, R, side, grow=0.0, upper=1.0, fore=True, hand=True):
    """Shoulder ball, upper arm, forearm, mitten hand; upper < 1 stops the upper arm part-way (short sleeves)."""
    s = side
    sh, el, wr = R.h[f"arm.{s}"], R.t[f"arm.{s}"], R.t[f"forearm.{s}"]
    b.tube(sh, sh + (el - sh) * upper, 0.075 + grow, 0.066 + grow, W(f"arm.{s}"), round_ends=upper >= 1)
    if fore:
        b.tube(el, wr, 0.066 + grow, 0.055 + grow, W(f"forearm.{s}"))
    if hand:
        d = (R.t[f"hand.{s}"] - R.h[f"hand.{s}"]).normalized()
        b.blob(wr + d * 0.07, 0.07 + grow, 0.055 + grow, 0.065 + grow, W(f"hand.{s}"), exp=2.6, nlat=8)


def leg(b, R, side, grow=0.0, foot=True, boot=0.0):
    s = side
    hp, kn, an = R.h[f"leg.{s}"], R.t[f"leg.{s}"], R.t[f"shin.{s}"]
    b.tube(hp, kn, 0.095 + grow, 0.078 + grow, W(f"leg.{s}"))
    b.tube(kn, an, 0.078 + grow, 0.064 + grow, W(f"shin.{s}"))
    if foot:
        toe = R.t[f"toe.{s}"]
        c = Vector(((an.x + toe.x) / 2, (an.y + toe.y) / 2 - 0.01, 0.075 + boot / 2))
        b.blob(c, 0.072 + grow + boot, 0.11 + grow + boot, 0.06 + boot / 2, W(f"foot.{s}"), exp=3.0, nlat=8)


def head(b, R, grow=0.0, keep=None):
    b.blob(R.head_c, R.HX + grow, R.HY + grow, R.HZ + grow, W("head"), exp=3.4, keep=keep)


def flat(colour):
    return lambda c, n: colour
