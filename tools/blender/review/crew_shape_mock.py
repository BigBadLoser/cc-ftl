"""Crew body mock: a solid-shaded turnaround (Cycles, plain colours per part) of one crew base in a default outfit, idle
frame 0, four angles. Run once per base and put the two side by side.

  CREW_BASE=old|v2 blender -b --factory-startup --python tools/blender/review/crew_shape_mock.py -- <out prefix>
    -> <prefix>_<base>_<angle>.png (angles 0, 45, 90, 180)"""
import math
import os
import sys
from pathlib import Path

import bpy

TAG = os.environ.setdefault("CREW_BASE", "v2")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import human_items as hi  # noqa: E402
from sprites import human_render as hr  # noqa: E402

OUTFIT = {"crew.human.body": (0.85, 0.66, 0.52), "crew.human.eyes.organic": (0.1, 0.1, 0.12),
          "crew.human.legs.cargo_pants": (0.28, 0.31, 0.36),
          "crew.human.arm.L.flesh": (0.85, 0.66, 0.52), "crew.human.arm.R.flesh": (0.85, 0.66, 0.52),
          "crew.human.hair.short": (0.35, 0.22, 0.13), "crew.human.gear.belt.tool_belt": (0.3, 0.22, 0.15),
          "crew.human.torso.work_shirt": (0.24, 0.42, 0.7)}
ANGLES = (0, 45, 90, 180)
SIZE = 360


def setup(items):
    """Cycles (no GPU here for Workbench): plain diffuse colours per part, a key light and a fill, a dark backdrop."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 16
    sc.cycles.device = "CPU"
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    world = sc.world or bpy.data.worlds.new("mock")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    mats = {}
    for it in items:
        for ob in it.objs:
            ob.hide_render = it.id not in OUTFIT
            if it.id in OUTFIT:
                if it.id not in mats:
                    m = bpy.data.materials.new(it.id)
                    m.use_nodes = True
                    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*OUTFIT[it.id], 1)
                    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
                    mats[it.id] = m
                ob.data.materials.clear()
                ob.data.materials.append(mats[it.id])
                for poly in ob.data.polygons:
                    poly.material_index = 0
    for name, rot, energy in (("key", (50, 0, 35), 3.0), ("fill", (70, 0, -140), 1.0)):
        ld = bpy.data.lights.new(name, "SUN")
        ld.energy = energy
        lo = bpy.data.objects.new(name, ld)
        lo.rotation_euler = tuple(math.radians(v) for v in rot)
        sc.collection.objects.link(lo)
    cam = bpy.data.objects.new("mock_cam", bpy.data.cameras.new("mock_cam"))
    sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.0
    cam.location = (0, -6, 0.75)
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.camera = cam
    for ob in sc.objects:                                                   # the sprite pipeline's own camera / chair stay out
        if ob.type == "CAMERA" and ob is not cam:
            ob.hide_render = True


def shots(arm, tag, out):
    if os.environ.get("MOCK_REST"):                                         # the rest pose (geometry check)
        arm.data.pose_position = "REST"
    else:
        hr.pose_frame(arm, "idle", 0, "idle_Armature", bpy.data.actions["idle_Armature"].frame_range[0])
    ims = []
    for a in ANGLES:
        arm.rotation_euler = (0, 0, math.radians(a))
        path = f"{out}_{tag}_{a}.png"
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        ims.append(path)
    return ims


def main():
    out = sys.argv[sys.argv.index("--") + 1]
    arm, items = hi.build_items()
    setup(items)
    print("MOCK", shots(arm, TAG, out))


main()
