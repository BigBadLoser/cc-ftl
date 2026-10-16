"""Assemble a full engineer from the same builders the glb export uses and render review PNGs.
    blender -b --factory-startup --python tools/blender/preview.py [-- outdir]
Views: front, iso (game camera: ortho, 45 deg yaw, 35.264 deg pitch), back, and each clip at a telling frame.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import export, materials, palette, rig  # noqa: E402
from crew import human  # noqa: E402
from crew.body import build_body  # noqa: E402
from crew.clips import CLIPS  # noqa: E402
from crew.registry import ITEMS  # noqa: E402

OUT = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else Path("/tmp/assets-preview")
ENGINEER = [
    "crew.human.arm.L.cyber", "crew.human.arm.R.flesh", "crew.human.hair.mohawk", "crew.human.eyes.cyber",
    "crew.human.implant.temple.neural_jack", "crew.human.undershirt.tee_black", "crew.human.torso.work_shirt",
    "crew.human.legs.cargo_pants", "crew.human.gear.back.engineer_rig", "crew.human.gear.belt.tool_belt",
    "crew.human.gear.head.welding_goggles", "crew.human.gear.hand.R.hammer",
]
TINTS = {"skin": "skin", "hair": "mohawk", "cloth": "jacket", "accent": "hivis"}  # the runtime would do this per crew member
HAMMER = []
MID = {"idle": 0.25, "walk": 0.25, "work": 0.72, "sleep": 0.25}


def assemble():
    export.clear_scene()
    arm = rig.create_armature()
    rig.add_sockets(arm)
    b = human._builder("body", skinned=True)
    build_body(b)
    human._meshes(b, arm)
    by_id = {i.id: i for i in ITEMS}
    for iid in ENGINEER:
        it = by_id[iid]
        b = human._builder(it.name, it.skinned)
        it.build(b)
        for _t, ob in human._meshes(b, arm, attach=not it.skinned):
            if "hammer" in it.id:
                HAMMER.append(ob)
    human.build_clips(arm)
    for role, pal in TINTS.items():
        m = materials.get(f"team.{role}")
        mix = next(n for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeMix")
        mix.inputs["B"].default_value = (*palette.linear(pal), 1)
    return arm


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"  # EEVEE/Workbench need a GL context (libEGL), absent in the headless container
    sc.render.resolution_x, sc.render.resolution_y = 640, 800
    sc.render.film_transparent = False
    if sc.render.engine == "CYCLES":
        sc.cycles.device, sc.cycles.samples = "CPU", 24
        sc.cycles.use_denoising = False
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.012, 0.016, 0.024, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = w
    floor = bpy.data.objects.new("floor", bpy.data.meshes.new("floor"))
    floor.data.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    fm = bpy.data.materials.new("floor")
    fm.diffuse_color = (0.05, 0.06, 0.075, 1)
    fm.use_nodes = True
    fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.04, 0.047, 0.058, 1)
    floor.data.materials.append(fm)
    sc.collection.objects.link(floor)

    def light(kind, loc, energy, size=1.0):
        d = bpy.data.lights.new(kind, kind)
        d.energy = energy
        if kind == "SUN":
            d.angle = 0.2
        o = bpy.data.objects.new(kind, d)
        o.location = loc
        sc.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 0.8)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return o
    light("SUN", (-3, -4, 6), 3.0)
    f = light("SUN", (4, 3, 2), 0.8)
    f.data.color = (0.6, 0.75, 1.0)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type, cam.data.ortho_scale = "ORTHO", 1.95
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def aim(cam, yaw, pitch, target=(0, 0, 0.74), dist=12):
    """Camera on the front(-Y)/+X side rotated by `yaw` degrees around Z; looks at target."""
    y, p = math.radians(yaw), math.radians(pitch)
    d = Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p)))
    cam.location = Vector(target) + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()


def render(name):
    bpy.context.scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    arm = assemble()
    cam = setup_scene()
    arm.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(1)
    for h in HAMMER:
        h.hide_render = True
    for name, yaw, pitch in (("front", 0, 3), ("iso", 45, 35.264), ("back", 180, 3)):
        aim(cam, yaw, pitch)
        render(name)
    aim(cam, 45, 35.264)
    cam.data.ortho_scale = 2.3
    for clip, (_fn, n) in CLIPS.items():
        arm.animation_data.action = bpy.data.actions[clip]
        bpy.context.scene.frame_set(1 + int(n * MID[clip]))
        for h in HAMMER:
            h.hide_render = clip != "work"
        if clip == "sleep":
            aim(cam, 45, 35.264, target=(0, 0.45, 0.2))
            cam.data.ortho_scale = 2.8
        render(f"clip_{clip}")


main()
