"""Crew v2: hand-held weapons, gear layers `gear.hand.<weapon>` skinned whole to hand.R, so they follow the hand.

Each weapon is modelled in the hand bone's own frame, which the combat poses (human_aim) set outright: +Y along the
barrel, +Z up, +X to the character's right, origin at the wrist. Coordinates below are relative to the grip (the fist,
GRIP of the way down the hand), in rig units (~36 px each at game size: no part thinner than ~0.06, 2 px).

Every weapon belongs to a pose family (FAMILY), and its support point (where the left hand goes) is the family's
SUPPORT point, so one pose serves every weapon of a family. `muzzle` (grip-relative) is exported per clip frame into the
manifest (crew_build / crew_pack) for the flash, tracer or beam."""
import bmesh
import bpy
from mathutils import Vector

from .human_base import Item, paint

GRIP = 0.55                               # the fist's centre, as a fraction of the hand bone from the wrist
SUPPORT = {"2h": Vector((0.0, 0.33, -0.01)), "heavy": Vector((0.0, 0.1, 0.2))}   # the left hand, grip-relative
FAMILY = {"sidearm": "1h", "rifle": "2h", "heavy_repeater": "heavy"}


class Gun:
    """Boxes and tubes in the grip frame (x right, y forward, z up), one palette colour per face."""

    def __init__(self):
        self.v, self.f, self.c = [], [], []

    def box(self, c, s, col, top=None):
        x, y, z = c
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        b = len(self.v)
        self.v += [Vector((x + sx * hx, y + sy * hy, z + sz * hz)) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        for f, top_face in (((0, 1, 3, 2), False), ((4, 6, 7, 5), True), ((0, 4, 5, 1), False), ((2, 3, 7, 6), False),
                            ((0, 2, 6, 4), False), ((1, 5, 7, 3), False)):
            self.f.append([b + i for i in f])
            self.c.append(top if top_face and top else col)

    def tube(self, y0, y1, x, z, r, col, n=8, cap=None):
        """A cylinder along y at (x, z); cap: the colour of its front end (a bore)."""
        import math
        b = len(self.v)
        for y in (y0, y1):
            self.v += [Vector((x + r * math.cos(t), y, z + r * math.sin(t))) for t in (k * math.tau / n for k in range(n))]
        for k in range(n):
            self.f.append([b + k, b + (k + 1) % n, b + n + (k + 1) % n, b + n + k])
            self.c.append(col)
        self.f.append([b + k for k in range(n)][::-1])
        self.c.append(col)
        self.f.append([b + n + k for k in range(n)])
        self.c.append(cap or col)

    def mesh(self, name, A):
        """The skinned object: grip frame -> hand.R rest frame -> armature rest space."""
        bone = A.data.bones["hand.R"]
        g = Vector((0.0, bone.length * GRIP, 0.0))
        M = bone.matrix_local
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(M @ (v + g)) for v in self.v], [], self.f)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.vertex_groups.new(name="hand.R").add(list(range(len(self.v))), 1.0, "REPLACE")
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = A
        ob.parent = A
        cols = list(self.c)
        paint(ob, lambda c, i: cols[i])
        return ob


def grip_y(A):
    return A.data.bones["hand.R"].length * GRIP


def sidearm(g):
    g.box((0, 0.1, 0.065), (0.06, 0.26, 0.08), "gmD", top="gm")                          # slide
    g.box((0, 0.07, 0.025), (0.055, 0.18, 0.03), "dark")                                 # frame
    g.box((0, 0.0, -0.015), (0.055, 0.075, 0.12), "dark")                               # grip, through the fist
    return Vector((0, 0.24, 0.065))


def rifle(g):
    g.box((0, 0.08, 0.06), (0.075, 0.34, 0.1), "gm", top="steelL")                      # receiver
    g.box((0, 0.33, 0.05), (0.08, 0.2, 0.085), "dark")                                  # handguard
    g.tube(0.42, 0.66, 0, 0.065, 0.026, "gmD", cap="dark")                               # barrel
    g.box((0, -0.2, 0.045), (0.065, 0.26, 0.11), "dark")                                # stock
    g.box((0, -0.335, 0.04), (0.07, 0.03, 0.13), "gmD")                                 # its butt pad
    g.box((0, 0.13, -0.045), (0.055, 0.075, 0.13), "gmD")                               # magazine
    g.box((0, 0.0, -0.03), (0.05, 0.055, 0.1), "dark")                                  # pistol grip
    g.box((0, 0.06, 0.13), (0.035, 0.1, 0.045), "dark")                                 # sight
    return Vector((0, 0.67, 0.065))


def heavy_repeater(g):
    g.box((0, 0.06, 0.06), (0.17, 0.36, 0.17), "gm", top="steelL")                      # receiver
    for dx, dz in ((-0.038, 0.025), (0.038, 0.025), (-0.038, 0.095), (0.038, 0.095)):    # the barrel cluster
        g.tube(0.24, 0.62, dx, dz, 0.026, "gmD", cap="dark")
    g.box((0, 0.5, 0.06), (0.15, 0.05, 0.15), "dark")                                   # the clamp round it
    g.box((-0.14, 0.06, 0.0), (0.1, 0.2, 0.15), "jacketD", top="jacket")               # ammo box, left side
    g.box((0, 0.1, 0.18), (0.04, 0.22, 0.04), "dark")                                   # carry handle
    for y in (0.0, 0.2):
        g.box((0, y, 0.15), (0.04, 0.035, 0.05), "dark")
    g.box((0, 0.0, -0.04), (0.055, 0.065, 0.12), "dark")                                # grip
    return Vector((0, 0.63, 0.06))


BUILD = {"sidearm": sidearm, "rifle": rifle, "heavy_repeater": heavy_repeater}


def build(A):
    out = []
    for name, fn in BUILD.items():
        g = Gun()
        muzzle = fn(g)
        it = Item("gear.hand", name, [g.mesh(f"v2.weapon.{name}", A)])
        it.muzzle = muzzle + Vector((0.0, grip_y(A), 0.0))          # wrist frame (hand.R local), for crew_build
        it.family = FAMILY[name]
        out.append(it)
    return out
