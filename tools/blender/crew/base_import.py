"""EXPERIMENT: restyle a CC0 base character (Quaternius "Universal Base Characters" + "Universal Animation
Library") into our pipeline conventions. Standalone: it is not part of build.py.

    blender -b --factory-startup --python tools/blender/crew/base_import.py -- \
        --base <Superhero_Male_FullBody.gltf> --anims <UAL1_Standard.glb> --out public/assets/crew/human/base_cc0.glb

What it does
  1. imports the base, drops the stray scene objects (cube, icosphere, camera, light)
  2. classifies briefs faces from the base-colour texture (dark texels), as a vertex group
  3. head scale (toward ~6 heads), uniform scale to HEIGHT world units, feet on the floor
  4. collapse-decimates the body (symmetric) to ~TRIS triangles, flat shading, splits into
     skin@body.team.skin / skin@briefs.team.cloth / skin@brows.team.hair / skin@eyes.base
  5. rewrites the vertex colours (grey shading for team.* materials, palette colour for `base`)
  6. copies idle/walk/work/sit/sleep from the animation library (identical skeleton + bone names: the
     actions are simply assigned to our armature), renames bones to the standard names, adds sockets
  7. exports through lib.export
Textures are dropped on purpose: the look is flat colour + faceting, tinted per crew member at runtime.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import export, materials, palette, vcolor  # noqa: E402

HEIGHT = 1.7           # world units, feet to top of head
HEAD_SCALE = 1.30      # enlarges the head toward ~6 heads (source is ~7.3)
WIDTH = 1.10           # extra X/Y scale (chunkier limbs and torso, like the target)
TRIS = 1500            # body triangle budget after decimation
BRIEFS_LUM = 0.33  # texels darker than this (stored sRGB luminance) count as briefs
BRIEFS_Z = (0.40, 0.58)  # briefs only exist in this fraction of the body height

# source bone -> our bone. Standard names must exist; everything else keeps a clean, renamed form.
BONE_MAP = {"pelvis": "hips", "spine_01": "spine", "Head": "head"}
for _s, _n in (("l", "L"), ("r", "R")):
    BONE_MAP.update({
        f"upperarm_{_s}": f"arm.{_n}", f"lowerarm_{_s}": f"forearm.{_n}", f"hand_{_s}": f"hand.{_n}",
        f"thigh_{_s}": f"leg.{_n}", f"calf_{_s}": f"shin.{_n}", f"foot_{_s}": f"foot.{_n}",
        f"clavicle_{_s}": f"clavicle.{_n}", f"ball_{_s}": f"toe.{_n}", f"ball_leaf_{_s}": f"toe_end.{_n}",
    })
    for _f in ("index", "middle", "ring", "pinky", "thumb"):
        for _i in (1, 2, 3):
            BONE_MAP[f"{_f}_0{_i}_{_s}"] = f"{_f}_{_i}.{_n}"
        BONE_MAP[f"{_f}_04_leaf_{_s}"] = f"{_f}_end.{_n}"

# our clip -> animation-library action
CLIP_SOURCE = {"idle": "Idle_Loop", "walk": "Walk_Loop", "work": "Interact", "sit": "Sitting_Idle_Loop"}
SLEEP_FRAMES = 24     # the held pose is keyed twice
SLEEP_SOURCE = "Death01"  # no lying loop in the library: hold the final (lying) pose as a one-key clip


def log(*a):
    print("[base_import]", *a)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    opts = {argv[i].lstrip("-"): argv[i + 1] for i in range(0, len(argv), 2)}
    return Path(opts["base"]), Path(opts["anims"]), Path(opts["out"])


# ---- import ---------------------------------------------------------------------------------------------------------------------------

def import_base(base):
    export.clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(base))
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    keep = {"SuperHero_Male": "body", "Eyebrows": "brows", "Eyes": "eyes"}
    meshes = {}
    for o in list(bpy.data.objects):
        if o.name in keep:
            o.name = keep[o.name]
            meshes[o.name] = o
        elif o is not arm:
            bpy.data.objects.remove(o)
    for o in meshes.values():
        o.parent_type = "OBJECT"
    return arm, meshes


def briefs_weights(body):
    """Per-vertex fraction of adjacent faces whose texture is dark, within the pelvis height band."""
    me = body.data
    mat = me.materials[0]
    img = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and "Dark" in n.image.name or
               n.type == "TEX_IMAGE" and n.image and n.image.name.startswith("T_Superhero"))
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    lum = px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722
    uv = np.empty(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2) % 1.0
    tex = lum[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]
    zs = np.array([v.co.z for v in me.vertices])
    z0, z1 = zs.min(), zs.max()
    dark = np.zeros(len(me.polygons))
    for p in me.polygons:
        f = (p.center.z - z0) / (z1 - z0)
        dark[p.index] = float(tex[p.loop_start:p.loop_start + p.loop_total].mean() < BRIEFS_LUM and BRIEFS_Z[0] < f < BRIEFS_Z[1])
    num, den = np.zeros(len(me.vertices)), np.zeros(len(me.vertices))
    for p in me.polygons:
        for v in p.vertices:
            num[v] += dark[p.index]
            den[v] += 1
    vg = body.vertex_groups.new(name="_briefs")
    for i, (a, b) in enumerate(zip(num, den)):
        if a:
            vg.add([i], a / b, "REPLACE")
    log("briefs faces", int(dark.sum()), "of", len(me.polygons))


# ---- proportions ----------------------------------------------------------------------------------------------------------------------

def scale_head(arm, meshes, factor):
    """Scale vertices owned (>50%) by the Head bone about the neck joint, in each mesh's local space."""
    pivot = Vector(arm.data.bones["Head"].head_local)
    for o in meshes.values():
        gi = o.vertex_groups.get("Head")
        if gi is None:
            continue
        for v in o.data.vertices:
            wt = next((g.weight for g in v.groups if g.group == gi.index), 0.0)
            if wt > 0.5:
                v.co = pivot + (v.co - pivot) * factor


def apply_scale(arm, meshes, factor):
    """Uniform scale of meshes and armature rest pose (edit bones); returns nothing, feet are put on z=0 afterwards."""
    for o in meshes.values():
        o.data.transform(Matrix.Scale(factor, 4))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        eb.head *= factor
        eb.tail *= factor
    bpy.ops.object.mode_set(mode="OBJECT")


def widen(arm, meshes, k):
    """Non-uniform X/Y scale of meshes and rest bones (height untouched)."""
    m = Matrix.Diagonal((k, k, 1, 1))
    for o in meshes.values():
        o.data.transform(m)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        eb.head.x, eb.head.y, eb.tail.x, eb.tail.y = eb.head.x * k, eb.head.y * k, eb.tail.x * k, eb.tail.y * k
    bpy.ops.object.mode_set(mode="OBJECT")


def fit(arm, meshes):
    body = meshes["body"]
    zs = [v.co.z for v in body.data.vertices]
    top = max(v.co.z for m in meshes.values() for v in m.data.vertices)
    f = HEIGHT / (top - min(zs))
    apply_scale(arm, meshes, f)
    dz = -min(v.co.z for v in body.data.vertices)
    for o in meshes.values():
        o.data.transform(Matrix.Translation((0, 0, dz)))
    bpy.ops.object.mode_set(mode="EDIT")
    for eb in arm.data.edit_bones:
        eb.head.z += dz
        eb.tail.z += dz
    bpy.ops.object.mode_set(mode="OBJECT")
    return f


# ---- restyle --------------------------------------------------------------------------------------------------------------------------

def decimate(ob, target_tris):
    me = ob.data
    bm = bmesh.new()  # UV seams leave duplicate vertices: weld them or the collapse opens cracks along the seams
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.calc_loop_triangles()
    ratio = min(1.0, target_tris / max(1, len(me.loop_triangles)))
    md = ob.modifiers.new("dec", "DECIMATE")
    md.decimate_type, md.ratio, md.use_collapse_triangulate = "COLLAPSE", ratio, True
    md.use_symmetry, md.symmetry_axis = True, "X"
    while ob.modifiers[0].name != md.name:
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.modifier_move_to_index(modifier=md.name, index=0)
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=md.name)


def set_material(ob, key):
    ob.data.materials.clear()
    ob.data.materials.append(materials.get(key))


def paint(ob, colour_fn):
    """Flat shading + one colour per face (corner colours) from colour_fn(face_center_world)."""
    me = ob.data
    for name in [a.name for a in me.color_attributes]:
        if name in me.color_attributes:
            me.color_attributes.remove(me.color_attributes[name])
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    me.polygons.foreach_set("use_smooth", [False] * len(me.polygons))
    data = attr.data
    for p in me.polygons:
        c = colour_fn(p.center)
        for li in range(p.loop_start, p.loop_start + p.loop_total):
            data[li].color = (*c, 1.0)
    me.update()


def grey_shade(seed):
    def fn(c):
        t = vcolor.shade((1, 1, 1), (c.x, c.z, -c.y), seed=seed, grime=0.025, low=0.04, floor_h=0.4)
        return t
    return fn


def briefs_band(body):
    """Hem and waist heights of the briefs: the 3rd/97th percentile of the vertices the texture marked."""
    gi = body.vertex_groups["_briefs"].index
    zs = sorted(v.co.z for v in body.data.vertices if any(g.group == gi and g.weight >= 0.5 for g in v.groups))
    return zs[int(len(zs) * 0.03)], zs[int(len(zs) * 0.97)]


def split_body(body):
    """Decimate, cut clean horizontal hem/waist lines (bisect), then split into skin and briefs parts."""
    hem, waist = briefs_band(body)
    decimate(body, TRIS)
    body.vertex_groups.remove(body.vertex_groups["_briefs"])
    me = body.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for z in (hem, waist):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(materials.get("team.skin"))
    me.materials.append(materials.get("team.cloth"))
    for p in me.polygons:
        p.material_index = 1 if hem - 1e-4 <= p.center.z <= waist + 1e-4 else 0
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = list(bpy.context.selected_objects)
    skin = next(o for o in parts if o.data.materials[0].name == "team.skin")
    briefs = next(o for o in parts if o.data.materials[0].name == "team.cloth")
    return skin, briefs


def restyle(meshes):
    skin, briefs = split_body(meshes["body"])
    skin.name, briefs.name = "skin@body.team.skin", "skin@briefs.team.cloth"
    paint(skin, grey_shade(1))
    paint(briefs, grey_shade(2))
    brows, eyes = meshes["brows"], meshes["eyes"]
    decimate(brows, 80)
    set_material(brows, "team.hair")
    paint(brows, grey_shade(3))
    brows.name = "skin@brows.team.hair"
    decimate(eyes, 60)
    set_material(eyes, "base")
    paint(eyes, lambda c: palette.linear("arc"))
    eyes.name = "skin@eyes.base"
    for o in (skin, briefs, brows, eyes):
        o.data.name = o.name
    return [skin, briefs, brows, eyes]


# ---- rig + clips ----------------------------------------------------------------------------------------------------------------------

def load_clips(arm, anims):
    """Import the animation library, assign its actions to our armature (same bone names), keep the chosen clips."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(anims))
    donors = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in donors if o.type == "ARMATURE")
    ratio = arm.data.bones["pelvis"].head_local.z / src.data.bones["pelvis"].head_local.z  # location keys scale with the body
    by_name = {a.name.split("_Armature")[0]: a for a in bpy.data.actions if "_Armature" in a.name}
    out = {}
    for clip, key in CLIP_SOURCE.items():
        out[clip] = by_name[key]
    sleep = by_name[SLEEP_SOURCE]
    last = int(sleep.frame_range[1])
    arm.animation_data_create()
    arm.animation_data.action = sleep
    bpy.context.scene.frame_set(last)
    pose = {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy()) for pb in arm.pose.bones}
    act = bpy.data.actions.new("sleep")
    act.id_root = "OBJECT"
    for name, (q, loc) in pose.items():
        for i in range(4):
            fc = act.fcurves.new(f'pose.bones["{name}"].rotation_quaternion', index=i)
            fc.keyframe_points.insert(1, q[i])
            fc.keyframe_points.insert(SLEEP_FRAMES, q[i])
        if name in ("root", "pelvis"):
            for i in range(3):
                fc = act.fcurves.new(f'pose.bones["{name}"].location', index=i)
                fc.keyframe_points.insert(1, loc[i])
                # 2 mm of drift on the last key: the exporter drops fully constant clips
                fc.keyframe_points.insert(SLEEP_FRAMES, loc[i] + (2e-3 if (name, i) == ("root", 0) else 0.0))
    out["sleep"] = act
    for clip, act in out.items():
        for fc in act.fcurves:
            if fc.data_path.endswith("location"):
                for kp in fc.keyframe_points:
                    kp.co.y *= ratio
                    kp.handle_left.y *= ratio
                    kp.handle_right.y *= ratio
        act.name = clip
        act.use_fake_user = True
    for a in list(bpy.data.actions):
        if a not in out.values():
            bpy.data.actions.remove(a)
    for o in donors:
        bpy.data.objects.remove(o)
    arm.animation_data.action = None


def rename_bones(arm):
    """Rename bones (vertex groups follow) and rewrite the fcurve paths ourselves: actions that are not assigned
    are not touched by Blender's rename. Location/scale tracks on anything but root/pelvis are dropped (the
    library's bone lengths differ, rotations are all we retarget)."""
    for old, new in BONE_MAP.items():
        arm.data.bones[old].name = new
    for act in bpy.data.actions:
        for fc in list(act.fcurves):
            bone = fc.data_path.split('"')[1]
            kind = fc.data_path.rsplit(".", 1)[1]
            if kind != "rotation_quaternion" and bone not in ("root", "pelvis"):
                act.fcurves.remove(fc)
                continue
            fc.data_path = fc.data_path.replace(f'"{bone}"', f'"{BONE_MAP.get(bone, bone)}"')


def add_sockets(arm):
    spots = {"socket.back": ("spine_03", (0, 0.10, 0.02)), "socket.head": ("head", (0, 0, 0.2)),
             "socket.hand.L": ("hand.L", (0, 0, 0)), "socket.hand.R": ("hand.R", (0, 0, 0))}
    out = []
    for name, (bone, off) in spots.items():
        e = bpy.data.objects.new(name, None)
        e.empty_display_type, e.empty_display_size = "ARROWS", 0.04
        bpy.context.scene.collection.objects.link(e)
        e.parent, e.parent_type, e.parent_bone = arm, "BONE", bone
        b = arm.data.bones[bone]
        e.matrix_world = arm.matrix_world @ Matrix.Translation(b.head_local + Vector(off))
        out.append(e)
    return out


def main():
    base, anims, out = parse_args()
    arm, meshes = import_base(base)
    briefs_weights(meshes["body"])
    scale_head(arm, meshes, HEAD_SCALE)
    widen(arm, meshes, WIDTH)
    f = fit(arm, meshes)
    log("scale", round(f, 4))
    parts = restyle(meshes)
    load_clips(arm, anims)
    rename_bones(arm)
    sockets = add_sockets(arm)
    tris = 0
    for o in parts:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    log("tris", tris, "bones", len(arm.data.bones), "clips", [a.name for a in bpy.data.actions])
    out.parent.mkdir(parents=True, exist_ok=True)
    export.export_glb(out, [arm] + parts + sockets, animations=True, skins=True)
    log("wrote", out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
