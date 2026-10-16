"""Engineer: CC0 Quaternius base (public/assets/crew/human/base_cc0.glb) dressed with clothing cut from the body
mesh (same weights, offset along normals) plus rigid gear skinned to single bones."""
import math
from pathlib import Path
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from . import core, post
from .rigid import RigidSet

ROOT = Path(__file__).resolve().parents[3]
GLB = ROOT / "public/assets/crew/human/base_cc0.glb"
HEIGHT_UNITS = 1.5            # crew height in tiles (x ~39 px/unit => ~59 px at 1x)
SCALE = HEIGHT_UNITS / 1.7
DIRS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
THETA = [45, 0, -45, -90, -135, 180, 135, 90]   # facing azimuth about Z (face = -Y at 0)
CLIPS = [("idle", 4), ("walk", 8), ("work", 6)]
FINGER = ("index", "middle", "ring", "pinky", "thumb")


def _lin(n):
    return core.lin(n)


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


def clone_part(src, name, keep, offset, subdiv=0):
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    drop = [f for f in bm.faces if f.index not in keep]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    if subdiv:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def paint(ob, fn):
    """fn(centre Vector, face index) -> palette name; sets Col."""
    core.finalize(ob)
    me = ob.data
    cols = [_lin(fn(p.center, p.index)) for p in me.polygons]
    core.set_attr(me, "Col", cols)


def dress(arm):
    body = bpy.data.objects["skin@body.team.skin"]
    for n in ("skin@briefs.team.cloth",):
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    dom = dominant(body)
    me = body.data
    fdom = []
    for p in me.polygons:
        ds = [part_kind(dom[v]) for v in p.vertices]
        fdom.append(max(set(ds), key=ds.count))
    z = np.array([p.center.z for p in me.polygons])
    x = np.array([p.center.x for p in me.polygons])
    fd = np.array(fdom)
    arms = fd == "arm"
    clav = np.char.startswith(fd, "clavicle")
    head = (fd == "head")
    neck = fd == "neck_01"
    legs = ~arms & ~head & ~neck & ~clav & (z < 0.95)
    boots = legs & (z < 0.2)
    shirt = ~arms & ~head & ~neck & (z >= 0.97) | (arms & (x < 0) & (np.abs(x) < 0.45)) | (clav & (z > 0.97))
    shirt &= ~(arms & (x > 0))
    belt = ~arms & ~head & (z >= 0.92) & (z < 0.99)
    keepbody = ~(arms & (x > 0))   # left cyber arm replaces flesh
    parts = []

    def mk(name, sel, off, fn, sd=0):
        ids = set(np.nonzero(sel)[0].tolist())
        ob = clone_part(body, name, ids, off, sd)
        paint(ob, fn)
        parts.append(ob)

    mk("shirt", shirt & ~belt, 0.02, lambda c, i: shirt_col(c), 2)
    mk("pants", legs & ~boots, 0.018, lambda c, i: "pants" if not (0.4 < c.z < 0.5 and c.y < 0.05) else "pocket", 1)
    mk("boots", boots, 0.022, lambda c, i: "sole" if c.z < 0.05 else "boot")
    mk("belt", belt, 0.034, lambda c, i: "leather")
    # body skin: remove left arm, colour skin / stubble
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keepbody[f.index]], context="FACES")
    bm.to_mesh(me)
    bm.free()
    paint(body, lambda c, i: "hair" if (c.z > 1.665 or (c.z > 1.6 and c.y > 0.02)) else ("pants" if c.z < 0.95 else "skin"))
    parts.append(body)
    for n in ("skin@eyes.base", "skin@brows.team.hair"):
        o = bpy.data.objects[n]
        paint(o, lambda c, i, n=n: "black" if "eyes" in n else "hair")
        parts.append(o)
    return parts


def shirt_col(c):
    if abs(c.x) < 0.45 and ((1.14 < c.z < 1.19) or (1.0 < c.z < 1.045)):
        return "hivis"
    if c.x < -0.30 and c.x > -0.38:
        return "hivis"
    return "jacket" if c.z > 1.0 or abs(c.x) > 0.3 else "jacketD"


def gear(arm):
    rs = RigidSet(arm)
    # --- cyber left arm (rest pose: arm along +X) ---
    a = rs.on("arm.L")
    a.box((0.232, 0.07, 1.33), (0.1, 0.2, 0.21), "gmD", bevel=0.02)
    a.box((0.34, 0.07, 1.323), (0.25, 0.17, 0.17), "gm", bevel=0.015)
    a.box((0.30, 0.07, 1.323), (0.035, 0.19, 0.19), "gmD", bevel=0.008)
    a.box((0.38, 0.07, 1.323), (0.035, 0.19, 0.19), "gmD", bevel=0.008)
    a.box((0.34, -0.022, 1.323), (0.16, 0.014, 0.034), "cyan")
    a.box((0.34, 0.07, 1.412), (0.16, 0.034, 0.014), "cyan")
    f = rs.on("forearm.L")
    f.box((0.47, 0.07, 1.323), (0.07, 0.14, 0.14), "dark", bevel=0.01)
    f.box((0.60, 0.07, 1.323), (0.22, 0.165, 0.165), "gm", bevel=0.015)
    f.box((0.60, 0.07, 1.41), (0.16, 0.1, 0.02), "plate", bevel=0.006)
    f.box((0.60, -0.018, 1.323), (0.17, 0.014, 0.04), "cyan")
    f.box((0.60, 0.07, 1.409), (0.1, 0.03, 0.014), "cyan")
    f.box((0.705, 0.07, 1.323), (0.03, 0.19, 0.19), "cyan")
    h = rs.on("hand.L")
    h.box((0.765, 0.057, 1.318), (0.09, 0.105, 0.07), "gmD", bevel=0.01)
    for i, yy in enumerate((0.03, 0.057, 0.084)):
        h.box((0.83, yy, 1.31), (0.06, 0.022, 0.03), "gm")
    h.box((0.75, 0.0, 1.325), (0.05, 0.03, 0.03), "gm")
    # --- head ---
    hd = rs.on("head")
    for zy, hh in ((0.08, 0.1), (0.035, 0.17), (-0.01, 0.2), (-0.055, 0.15), (-0.1, 0.1)):
        hd.box((0, zy, 1.69 + hh / 2), (0.03, 0.03, hh), "medRed", taper=0.35)
    hd.box((0, 0.0, 1.69), (0.05, 0.22, 0.025), "mohawk")
    hd.box((0, -0.14, 1.645), (0.25, 0.03, 0.05), "strap")
    hd.box((-0.118, 0.0, 1.645), (0.03, 0.27, 0.05), "strap")
    hd.box((0.118, 0.0, 1.645), (0.03, 0.27, 0.05), "strap")
    for sx in (-1, 1):
        hd.box((sx * 0.052, -0.158, 1.648), (0.09, 0.03, 0.075), "brass", bevel=0.008)
        hd.box((sx * 0.052, -0.176, 1.648), (0.068, 0.02, 0.055), "lens")
    hd.box((-0.045, -0.157, 1.565), (0.06, 0.05, 0.06), "gmD", bevel=0.006)   # cyber eye housing (char right)
    hd.box((-0.045, -0.185, 1.565), (0.045, 0.02, 0.045), "cyan")
    hd.box((0.123, 0.0, 1.58), (0.03, 0.085, 0.085), "gmD", bevel=0.006)       # neural jack (char left)
    hd.box((0.14, 0.0, 1.58), (0.02, 0.045, 0.045), "magenta")
    # --- back rig ---
    sp = rs.on("spine_03")
    sp.box((0, 0.17, 1.22), (0.27, 0.05, 0.3), "gmD", bevel=0.012)
    for sx in (-1, 1):
        sp.cyl((sx * 0.075, 0.215, 1.07), 0.05, 0.3, "steelL", sides=6)
        sp.box((sx * 0.075, 0.215, 1.30), (0.075, 0.075, 0.03), "orange")
    sp.box((0, 0.2, 1.21), (0.2, 0.03, 0.05), "brass")
    sp.box((-0.12, 0.19, 1.42), (0.02, 0.02, 0.26), "gm")
    sp.box((-0.12, 0.19, 1.56), (0.035, 0.035, 0.035), "cyan")
    # --- belt, pouches, tool ---
    hp = rs.on("hips")
    hp.box((0, -0.12, 0.955), (0.08, 0.04, 0.06), "brass", bevel=0.008)
    for sx in (-1, 1):
        hp.box((sx * 0.13, -0.095, 0.93), (0.075, 0.06, 0.09), "leather", bevel=0.01)
    hp.box((0.09, -0.11, 0.86), (0.03, 0.03, 0.14), "plate")
    hp.box((0.09, -0.11, 0.78), (0.06, 0.03, 0.04), "orange")
    # --- legs ---
    for s, sx in (("L", 1), ("R", -1)):
        lg = rs.on(f"leg.{s}")
        lg.box((sx * 0.205, 0.02, 0.66), (0.04, 0.11, 0.13), "pocket", bevel=0.008)
        sh = rs.on(f"shin.{s}")
        sh.box((sx * 0.125, -0.052, 0.5), (0.11, 0.035, 0.09), "gmD", bevel=0.008)
    return rs.build()


def build():
    arm = import_base()
    parts = dress(arm)
    parts += gear(arm)
    for ob in parts:
        ob.parent = arm
    arm.rotation_mode = "XYZ"
    arm.scale = (SCALE,) * 3
    arm.data.pose_position = "POSE"
    return arm, parts


def frames():
    """Yield (clip, index, frame_number)."""
    for clip, n in CLIPS:
        act = bpy.data.actions[f"{clip}_Armature"]
        lo, hi = act.frame_range
        for i in range(n):
            yield clip, i, lo + (hi - lo) * i / n
