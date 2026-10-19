"""Species experiment (preview only): rock and slime crew bodies on the human rig, so every human clip drives them.

  rock   a plain rock person: the body itself bulked up per bone (heavy chest and shoulders, big fists, a small head),
         collapse-decimated into big flat facets and jittered, stone colours in broad patches, a boulder on each
         shoulder, deep-set eyes under a heavy brow.
  slime  parked: a baked see-through shell over a dark core (core.py alpha / rim) reads as jelly but not as the
         translucent slime wanted; that needs runtime transparency (engine work).

  blender -b --factory-startup --python tools/blender/experiments/species/species.py -- <out dir>
    -> <out>/<species>.npz: raw layer frames (rgba, glow) for SE / S / SW / NW x idle 0, walk 0-7, work 3"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from sprites import core, post  # noqa: E402
from sprites import human_render as hr  # noqa: E402
from sprites.human_base import Item  # noqa: E402

FOLD = {"index": "hand", "middle": "hand", "ring": "hand", "pinky": "hand", "thumb": "hand", "toe": "foot", "toe_end": "foot",
        "neck_01": "head", "clavicle": "arm", "root": "hips"}
# rock bulk per bone (chunk radius over the body's own): a heavy chest and shoulders, big fists, a smaller head
BULK = {"hips": 1.3, "spine": 1.3, "spine_02": 1.35, "spine_03": 1.45, "arm": 1.4, "forearm": 1.3, "hand": 1.7, "leg": 1.45,
        "shin": 1.4, "foot": 1.3, "head": 0.85}


def fold(name):
    base, _, side = name.partition(".")
    for k, v in FOLD.items():
        if base.startswith(k):
            return f"{v}.{side}" if side and v not in ("head", "hips") else v
    return name


def weld(objs, name):
    """A joined copy of the given skinned meshes (vertex groups kept), parented to the same armature."""
    copies = []
    for ob in objs:
        c = ob.copy()
        c.data = ob.data.copy()
        bpy.context.collection.objects.link(c)
        copies.append(c)
    with bpy.context.temp_override(active_object=copies[0], selected_editable_objects=copies, object=copies[0]):
        bpy.ops.object.join()
    ob = copies[0]
    ob.name = name
    return ob


def paint_all(ob, color):
    """One palette colour on every face (core's per-face attributes, as human_base.paint does)."""
    from sprites.human_base import paint
    paint(ob, lambda c, i: color)


def bone_verts(ob):
    """{bone: (n, 3) rest-pose coords} by each vertex's dominant group (fingers fold into the hand, toes into the foot)."""
    names = {g.index: g.name for g in ob.vertex_groups}
    out = {}
    for v in ob.data.vertices:
        if not v.groups:
            continue
        g = max(v.groups, key=lambda g: g.weight)
        out.setdefault(fold(names[g.group]), []).append(tuple(v.co))
    return {k: np.array(v) for k, v in out.items()}


def chunk(m, centre, axis, half, rad, rng, color):
    """A faceted boulder: a jittered icosphere stretched along `axis` (half length) with radius `rad` across it."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    ph = rng.uniform(0, 10)
    a = Vector(axis).normalized()
    p1 = a.orthogonal().normalized()
    p1.rotate(Matrix.Rotation(rng.uniform(0, math.tau), 3, a))
    p2 = a.cross(p1)
    for f in bm.faces:
        pts = []
        for v in f.verts:
            j = 1 + 0.16 * math.sin(v.co.x * 7.1 + v.co.y * 5.3 + v.co.z * 3.7 + ph)
            co = v.co * j
            pts.append(Vector(centre) + a * (co.z * half) + p1 * (co.x * rad) + p2 * (co.y * rad))
        m.poly(pts, color)
    bm.free()


def attach(m, arm, bone):
    ob = m.build()
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    ob.parent = arm
    return ob


def facet(ob, ratio, rough, rng):
    """Break a skinned mesh into big flat facets: collapse-decimate it (weights are interpolated), jitter the verts along
    their normals, flat-shade. The armature modifier is set aside while the decimate is applied."""
    arm_mod = [(m.name, m.object) for m in ob.modifiers if m.type == "ARMATURE"]
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    dec = ob.modifiers.new("dec", "DECIMATE")
    dec.ratio = ratio
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier="dec")
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * float(rng.uniform(-rough, rough))
    bm.to_mesh(ob.data)
    bm.free()
    for poly in ob.data.polygons:
        poly.use_smooth = False
    for name, target in arm_mod:
        ob.modifiers.new(name, "ARMATURE").object = target


def squarify(ob, arm, k=0.9):
    """Square off the body's cross-sections: each vertex is pushed toward a box round its leading bone (lateral and
    front axes), so limbs and torso become blocky slabs instead of round tubes."""
    names = {g.index: g.name for g in ob.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    dl = bm.verts.layers.deform.active
    for v in bm.verts:
        g = v[dl] if dl else {}
        if not g:
            continue
        bone = arm.data.bones.get(fold(names[max(g.items(), key=lambda kv: kv[1])[0]]))
        if bone is None or (bone.tail_local - bone.head_local).length < 1e-4:
            continue
        a = (bone.tail_local - bone.head_local).normalized()
        h = bone.head_local
        r = v.co - (h + a * (v.co - h).dot(a))
        e1 = Vector((1, 0, 0)) if abs(a.x) < 0.7 else Vector((0, 1, 0))
        e1 = (e1 - a * e1.dot(a)).normalized()
        e2 = a.cross(e1)
        x, y = r.dot(e1), r.dot(e2)
        m, L = max(abs(x), abs(y)), math.hypot(x, y)
        if m > 1e-6:
            v.co += r * ((L / m) ** k - 1.0)
    bm.to_mesh(ob.data)
    bm.free()


def stone(c, i, nz):
    """Stone colour by which way the facet faces (tops light, undersides dark: true in every direction the body turns),
    with broad weathered patches over it."""
    tone = 0 if nz > 0.45 else 2 if nz < -0.3 else 1
    n = math.sin(c.x * 6 + 1.3) + math.sin(c.y * 5 - 0.7) + math.sin(c.z * 4 + 2.1)
    tone = max(0, tone - 1) if n > 1.7 else min(2, tone + 1) if n < -1.9 else tone
    return ("rkL", "rkM", "rkD")[tone]


def rock(arm, flesh):
    """A plain rock person: the body bulked up per bone (heavy chest and shoulders, big fists, a small head), broken into
    big flat facets, a boulder on each shoulder, dark eye sockets."""
    rng = np.random.default_rng(12)
    body = weld(flesh, "species.rock")
    swell = {k: 0.1 * (v - 1.0) for k, v in BULK.items() for k in (k, k + ".L", k + ".R")}
    smooth_inflate(body, 3, 0.01, swell)
    squarify(body, arm)
    facet(body, 0.045, 0.015, rng)
    from sprites.human_base import paint
    nz = [poly.normal.z for poly in body.data.polygons]
    paint(body, lambda c, i: stone(c, i, nz[i]))
    objs = [body]
    P0 = bone_verts(body)
    for side in ("L", "R"):                                                  # a boulder over each shoulder
        b = arm.data.bones[f"arm.{side}"]
        m = core.Mesh(f"rock.shoulder.{side}", selflit=True)
        sh = np.array(b.head_local) + np.array((0.0, 0.0, 0.06))
        chunk(m, sh, (0.3 if side == "L" else -0.3, 0.0, 1.0), 0.1, 0.11, rng, "rkM")
        objs.append(attach(m, arm, f"arm.{side}"))
    head = P0["head"]
    hz = np.percentile(head[:, 2], 55)
    hy, hx = front(head, hz)
    eyes = core.Mesh("rock.eyes", selflit=True)
    for sx in (1, -1):                                                       # deep-set eyes under a heavy brow
        eyes.box((hx + sx * 0.045, -(hy + 0.004), hz), (0.04, 0.02, 0.028), "dark")
        eyes.box((hx + sx * 0.045, -(hy - 0.012), hz + 0.03), (0.06, 0.04, 0.025), "rkM")
    objs.append(attach(eyes, arm, "head"))
    return Item("species", "rock", objs)


def smooth_inflate(ob, iters, grow, extra=None):
    """Weld (the glTF mesh is split at UV seams), Laplacian-smooth, then push along the normals by `grow`, plus
    extra[bone] for the verts that bone leads."""
    names = {g.index: g.name for g in ob.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    for _ in range(iters):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    dl = bm.verts.layers.deform.active
    for v in bm.verts:
        g = v[dl] if dl else {}
        lead = names.get(max(g.items(), key=lambda kv: kv[1])[0]) if g else None
        v.co += v.normal * (grow + (extra or {}).get(lead, 0.0))
    bm.to_mesh(ob.data)
    bm.free()


def front(P, z, band=0.05):
    """The body's front surface (most negative y) near height z, and the mean x there."""
    s = P[np.abs(P[:, 2] - z) < band]
    return s[:, 1].min(), s[:, 0].mean()


def slime(arm, flesh):
    """A thin see-through shell over a near-full dark core, so the body reads as jelly with a light rim; eyes, a glowing
    nucleus and gear float in the gap at the front, seen through the shell; drips off the hands and chin, puddles."""
    shell = weld(flesh, "species.slime.shell")
    P0 = bone_verts(shell)
    smooth_inflate(shell, 10, 0.045, {"head": 0.05, "neck_01": 0.05, "spine_03": 0.01})
    paint_all(shell, "slS")
    shell["alpha"], shell["rim"] = 0.34, 0.9
    goo = weld(flesh, "species.slime.goo")
    smooth_inflate(goo, 10, -0.005, {"head": 0.03, "neck_01": 0.03, "hand.L": -0.01, "hand.R": -0.01})
    paint_all(goo, "slD")
    goo["alpha"] = 0.6
    head, chest, belly = P0["head"], P0["spine_03"], P0["spine_02"]
    hz = np.percentile(head[:, 2], 60)
    hy, hx = front(head, hz)
    eyes = core.Mesh("slime.eyes", selflit=True)
    for sx in (1, -1):                                                       # eyes just under the shell's front
        eyes.box((hx + sx * 0.06, -(hy - 0.035), hz), (0.08, 0.03, 0.09), "medWhite")
        eyes.box((hx + sx * 0.06, -(hy - 0.052), hz - 0.01), (0.045, 0.02, 0.05), "dark")
    bits = core.Mesh("slime.bits", selflit=True)
    cz = chest[:, 2].mean()
    cy, cx = front(chest, cz)
    chunk(bits, Vector((cx + 0.03, cy - 0.015, cz)), (0, 0, 1), 0.04, 0.035, np.random.default_rng(2), "xnG")   # the nucleus
    bz = belly[:, 2].mean()
    by_, bx = front(belly, bz)
    bits.box((bx + 0.05, -(by_ - 0.02), bz + 0.02), (0.035, 0.035, 0.17), "steelL", rz=0.5, rx=0.6)   # a swallowed spanner
    bits.box((bx - 0.06, -(by_ - 0.02), bz - 0.05), (0.06, 0.06, 0.06), "brass", rz=0.7, rx=0.4)    # a nut
    objs = [shell, goo, attach(eyes, arm, "head"), attach(bits, arm, "spine_02")]
    for bone in ("hand.L", "hand.R", "head", "foot.L", "foot.R"):
        b = arm.data.bones[bone]
        m = core.Mesh(f"slime.drip.{bone}", selflit=True)
        if bone.startswith("hand"):                                          # a drip hanging off the hand
            h = b.tail_local
            m.cyl((h.x, -h.y, h.z - 0.12), 0.035, 0.1, "slS", sides=8, taper=0.35)
            m.cyl((h.x, -h.y, h.z - 0.17), 0.028, 0.03, "slS", sides=8)
        elif bone == "head":                                                 # one off the chin
            m.cyl((hx, -(hy + 0.02), hz - 0.16), 0.03, 0.08, "slS", sides=8, taper=0.35)
        else:                                                                # a puddle round the foot
            h = b.head_local
            m.cyl((h.x, -(h.y - 0.05), 0.002), 0.15, 0.015, "slM", sides=14)
        objs.append(attach(m, arm, bone))
    return Item("species", "slime", objs, glow=True)


def main():
    out = Path(sys.argv[sys.argv.index("--") + 1])
    out.mkdir(parents=True, exist_ok=True)
    arm, items = hr.build_items()
    by = {(i.slot, i.name): i for i in items}
    flesh = by[("body", "")].objs[:2] + [by[("arm.L", "flesh")].objs[0], by[("arm.R", "flesh")].objs[0]]
    arm.data.pose_position = "REST"
    arm.scale = (1, 1, 1)
    sp = [rock(arm, flesh), slime(arm, flesh)]
    arm.scale = (hr.SCALE,) * 3
    arm.data.pose_position = "POSE"
    for it in sp:
        it.order = 0
    every = items + sp
    post.select(True)
    res, cols = hr.render_all(arm, every, dirs=(0, 1, 2, 4), only=["species"],
                              frames={("idle", 0), ("work", 3)} | {("walk", i) for i in range(8)})
    for k, it in enumerate(every):
        if not res[k]:
            continue
        arrays = {}
        for (d, col), (rgba, g) in res[k].items():
            clip, i = cols[col]
            arrays[f"{d}_{clip}_{i}"] = rgba
            if g is not None:
                arrays[f"{d}_{clip}_{i}_glow"] = g
        np.savez_compressed(out / f"{it.name}.npz", **arrays)
        print("WROTE", it.name, len(arrays))


main()
