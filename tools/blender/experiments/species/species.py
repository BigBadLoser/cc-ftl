"""Species experiment (preview only): rock and slime crew bodies on the human rig, so every human clip drives them.

  rock   faceted stone chunks, one or more per bone, fitted to the body's own verts for that bone and set slightly apart
         over a magma core (the body itself, self-lit orange): the gaps between chunks read as glowing cracks.
  slime  the body smoothed and puffed up into a see-through shell over a denser see-through goo (baked translucency,
         core.py alpha / rim), with eyes and a few bits of gear floating inside.

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
ROCK = ("rkL", "rkM", "rkM", "rkD")
# rock bulk per bone (chunk radius over the body's own): a heavy chest and shoulders, big fists, a smaller head
BULK = {"hips": 1.2, "spine": 1.3, "spine_02": 1.35, "spine_03": 1.45, "arm": 1.4, "forearm": 1.3, "hand": 1.7, "leg": 1.2,
        "shin": 1.2, "foot": 1.15, "head": 0.85}


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


def rock(arm, flesh):
    """Chunks per bone over a magma core."""
    rng = np.random.default_rng(12)
    body = weld(flesh, "species.rock.core")
    P0 = bone_verts(body)                                                    # fit the chunks to the full body
    swell = {k: 0.05 * (v - 1.0) for k, v in BULK.items() for k in (k, k + ".L", k + ".R")}
    smooth_inflate(body, 2, -0.03, swell)                                    # the core sits just inside the stone
    paint_all(body, "orange")
    objs = [body]
    for bone, P in P0.items():
        if bone not in arm.data.bones or len(P) < 12:
            continue
        b = arm.data.bones[bone]
        axis = np.array(b.tail_local - b.head_local)
        if np.linalg.norm(axis) < 1e-4:
            continue
        axis /= np.linalg.norm(axis)
        c0 = P.mean(0)
        t = (P - c0) @ axis
        lo, hi = np.percentile(t, 3), np.percentile(t, 97)
        n = max(1, min(4, round((hi - lo) / 0.12)))
        m = core.Mesh(f"rock.{bone}", selflit=True)
        for k in range(n):
            a, b_ = lo + (hi - lo) * k / n, lo + (hi - lo) * (k + 1) / n
            sel = P[(t >= a) & (t <= b_)]
            if len(sel) < 4:
                continue
            cen = sel.mean(0)
            radial = sel - cen - np.outer((sel - cen) @ axis, axis)
            r = (np.percentile(np.linalg.norm(radial, axis=1), 95) * 1.1 + 0.008) * BULK.get(bone.split(".")[0], 1.0)
            half = (b_ - a) / 2 * 1.0 + 0.008
            if bone == "head":                                               # the head: one round boulder
                half = r = max(r, half) * 0.95
            chunk(m, cen, axis, half, r, rng, ROCK[int(rng.integers(0, len(ROCK)))])
        if bone.startswith("arm."):                                          # a shoulder boulder over the joint
            sh = np.array(b.head_local) + np.array((0, 0.0, 0.05))
            chunk(m, sh, axis, 0.1, 0.12, rng, "rkM")
        if bone == "head":                                                   # ember eyes, set into the boulder
            c = P.mean(0)
            front = c[1] - np.percentile(np.abs(P[:, 1] - c[1]), 95) * 1.05 * BULK["head"]
            for sx in (1, -1):
                m.box((c[0] + sx * 0.042, -(front - 0.012), c[2] + 0.015), (0.035, 0.03, 0.018), "flameY")
        objs.append(attach(m, arm, bone))
    return Item("species", "rock", objs, glow=True)


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
