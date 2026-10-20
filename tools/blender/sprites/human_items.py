"""Assembles the human layer items (the item registry). Adding an item = add its builder to human_base/human_gear/
human_suit and list it here. Deliberately outside the render-cache code hash: an item's geometry digest (crew_digest.py)
decides what re-renders, so editing this file re-renders only items whose geometry changed."""
import bpy
from . import core
from . import human_base as hb
from .human_base import SCALE, build_skinned, import_base
from . import human_gear as hg
from . import human_render as hr
from . import human_suit as suit
from . import crew_clips as clips


def build_items():
    core.setup_scene()
    arm = import_base()
    body = bpy.data.objects["skin@body.team.skin"]
    eva = suit.build_suit(arm, body)            # before build_skinned strips the arm faces off the body
    items = build_skinned(arm, body) + eva
    by = {(i.slot, i.name): i for i in items}
    hg.nose_mouth(arm, by[("body", "")])
    hg.belt_extra(arm, by[("gear.belt", "tool_belt")])
    hg.legs_extra(arm, by[("legs", "cargo_pants")])
    hg.ponytail_extra(arm, by[("hair", "ponytail")])
    items += [hg.eyes(arm, False), hg.eyes(arm, True), hg.hair_mohawk(arm), hg.jack(arm), hg.goggles(arm),
              hg.engineer_rig(arm), hg.cyber_arm(arm, "L"), hg.cyber_arm(arm, "R")]
    for it in items:
        it.order = hr.ORDER[it.slot]
        for ob in it.objs:
            ob.parent = arm
    for act in bpy.data.actions:       # we drive bone scale ourselves (head size, torso width, breathing)
        for fc in [f for f in act.fcurves if f.data_path.endswith("scale")]:
            act.fcurves.remove(fc)
    clips.capture_idle_arms(arm)
    hb.warp_gear(items)
    arm.rotation_mode = "XYZ"
    arm.scale = (SCALE,) * 3
    arm.data.pose_position = "POSE"
    items.sort(key=lambda i: (i.order, i.name))
    return arm, items
