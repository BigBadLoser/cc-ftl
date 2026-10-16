"""Human layer items, part 1: the CC0 Quaternius base (public/assets/crew/human/base_cc0.glb) imported, plus the
skinned items cut from its body mesh (body, shirts, pants/boots, belt, flesh arms). Rigid items (eyes, hair, cyber
arms, gear) live in human_gear.py.

An Item is one sprite layer: slot + name + the Blender objects that make it up. Slot order is the runtime stack
order; see human_render.py for how holdout makes that order valid in all directions."""
from dataclasses import dataclass, field
from pathlib import Path
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from . import core

ROOT = Path(__file__).resolve().parents[3]
GLB = ROOT / "public/assets/crew/human/base_cc0.glb"
HEIGHT_UNITS = 1.5            # crew height in tiles (x ~39 px/unit => ~59 px at 1x)
SCALE = HEIGHT_UNITS / 1.7
FINGER = ("index", "middle", "ring", "pinky", "thumb")


@dataclass
class Item:
    slot: str
    name: str
    objs: list = field(default_factory=list)
    outline: bool = True      # per-layer 1px outline (off for tiny face details)
    default: bool = False     # member of the default holdout set for higher slots
    glow: bool = False        # has emissive pixels
    order: int = 0            # stack order (set from the slot)

    @property
    def id(self):
        return ".".join(["crew.human", self.slot] + ([self.name] if self.name else []))


def import_base():
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    for n in ("Camera", "Cube", "Icosphere", "Light"):
        if n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    arm = bpy.data.objects["Armature"]
    arm.data.pose_position = "REST"
    return arm


def dominant(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    return [names[max(v.groups, key=lambda g: g.weight).group] for v in ob.data.vertices]


def part_kind(dom):
    base = dom.split(".")[0]
    if base in ("arm", "forearm", "hand") or base.startswith(FINGER):
        return "arm"
    return base


def clone_part(src, name, keep, offset, subdiv=0, grow=None):
    """Copy of `src` keeping only faces in `keep`, pushed out along normals by `offset`. `grow(co)->co` optional."""
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context="FACES")
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    if subdiv:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    for v in bm.verts:
        n, c = v.normal.copy(), v.co
        # the base's winding is not consistent: push radially outward from the body/limb axis, never inward
        ctr = Vector((0.114 * np.sign(c.x), 0.036, c.z)) if c.z < 0.9 else Vector((0.0, 0.02, c.z))
        r = Vector((c.x - ctr.x, c.y - ctr.y, 0.0))
        r = r.normalized() if r.length > 1e-6 else n
        if n.dot(c - ctr) < 0:
            n = -n
        v.co += (n * 0.5 + r * 0.5).normalized() * offset
        if grow:
            v.co = grow(v.co)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def paint(ob, fn):
    """fn(face centre, face index) -> colour name; sets Col per face."""
    core.finalize(ob)
    me = ob.data
    core.set_attr(me, "Col", [core.lin(fn(p.center, p.index)) for p in me.polygons])


class Regions:
    """Face classification of the base body mesh (dominant bone, height, side)."""

    def __init__(self, body):
        dom = dominant(body)
        self.me = body.data
        fdom = []
        for p in self.me.polygons:
            ds = [part_kind(dom[v]) for v in p.vertices]
            fdom.append(max(set(ds), key=ds.count))
        self.z = np.array([p.center.z for p in self.me.polygons])
        self.x = np.array([p.center.x for p in self.me.polygons])
        self.y = np.array([p.center.y for p in self.me.polygons])
        fd = np.array(fdom)
        self.arms = fd == "arm"
        clav = np.char.startswith(fd, "clavicle")
        self.head = fd == "head"
        neck = fd == "neck_01"
        z = self.z
        self.legs = ~self.arms & ~self.head & ~neck & ~clav & (z < 0.95)
        self.boots = self.legs & (z < 0.2)
        self.torso = (~self.arms & ~self.head & ~neck & (z >= 0.97)) | (clav & (z > 0.97))
        self.belt = ~self.arms & ~self.head & (z >= 0.92) & (z < 0.99)

    def ids(self, sel):
        return set(np.nonzero(sel)[0].tolist())


def _shirt_col(c, kind):
    if kind == "tee":
        return "black"
    # hi-vis vest: chest band, hem band and shoulder straps, wrapping front, sides and back
    if 1.27 < c.z < 1.335 or 0.995 < c.z < 1.045:
        return "hivis"
    if c.z >= 1.335 and 0.075 < abs(c.x) < 0.135:
        return "hivis"
    return "team.cloth" if c.z > 1.0 or abs(c.x) > 0.3 else "team.cloth*0.8"


def _widen(co):
    """Broaden the shirt shoulders/chest a little so the torso reads against the big head."""
    k = np.clip((co.z - 1.0) / 0.35, 0.0, 1.0)
    co.x *= 1.0 + 0.09 * k
    return co


def build_skinned(arm, body):
    """Returns (items, leftover objects to delete). `body` is the imported body mesh."""
    R = Regions(body)
    items = []

    def mk(slot, name, sel, off, fn, sd=0, grow=None, **kw):
        ob = clone_part(body, f"{slot}.{name}", R.ids(sel), off, sd, grow)
        paint(ob, fn)
        it = Item(slot, name, [ob], **kw)
        items.append(it)
        return it

    # flesh arms: the arm faces of the base, split by side (character left = +X)
    mk("arm.L", "flesh", R.arms & (R.x > 0), 0.0, lambda c, i: "team.skin", default=True)
    mk("arm.R", "flesh", R.arms & (R.x < 0), 0.0, lambda c, i: "team.skin", default=True)
    mk("torso", "work_shirt", R.torso & ~R.belt, 0.05, lambda c, i: _shirt_col(c, "shirt"), 2, _widen, default=True)
    mk("torso", "tee", R.torso & ~R.belt, 0.05, lambda c, i: _shirt_col(c, "tee"), 2, _widen)
    mk("legs", "cargo_pants", R.legs, 0.03,
       lambda c, i: "sole" if c.z < 0.05 else "boot" if c.z < 0.2 else ("pocket" if 0.4 < c.z < 0.5 and c.y < 0.05 else "pants"),
       0, default=True)
    mk("gear.belt", "tool_belt", R.belt, 0.05, lambda c, i: "leather", default=True)
    # hair caps cut from the scalp (rigid hair is in human_gear)
    cap = R.head & ((R.z > 1.635) | ((R.z > 1.59) & (R.y > 0.0)))
    mk("hair", "short", cap, 0.032, lambda c, i: "team.hair", 0, default=True)
    mk("hair", "ponytail", cap, 0.032, lambda c, i: "team.hair", 0)
    mk("hair", "shaved", cap, 0.008, lambda c, i: "team.hair*0.55", 0)
    # body: everything but the arms (head, torso, legs); skin, plus the briefs object from the base
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if R.arms[f.index]], context="FACES")
    bm.to_mesh(body.data)
    bm.free()
    paint(body, lambda c, i: "pants" if c.z < 0.95 else "team.skin")
    briefs = bpy.data.objects["skin@briefs.team.cloth"]
    paint(briefs, lambda c, i: "black")
    items.append(Item("body", "", [body, briefs], default=True))
    for n in ("skin@eyes.base", "skin@brows.team.hair"):
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    return items
