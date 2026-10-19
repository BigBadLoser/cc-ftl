"""Hauling and meal clips for the human crew (food pack), posed procedurally on top of the base actions with
human_sit's armature-space bone aiming (character forward = -Y, up = +Z, its left = +X).

  carry       the walk with both forearms forward and the hands together at the belly: the hauled item (`<item>.held`)
              is drawn at the hands (crewView: CARRY_HAND per direction, printed by `hands()`).
  carry_idle  the idle with the same arms.
  eat         standing (at the galley): the left hand holds a ration tray (the renderer draws `item.ration.held` at
              EAT_HAND), the right brings food to the mouth and back over 4 frames, the head dips to meet it.
  sit_eat     the sit pose (human_sit) with the same arms over the mess table; seated on the mess chair (mess.chair),
              which is this clip's holdout instead of the console chair."""
import math

from mathutils import Vector

from . import human_sit as hs

BASE = {"carry": "walk", "carry_idle": "idle", "eat": "idle"}      # base action per clip (sit_eat: procedural, as sit_*)
CLIPS = [("carry", 8, 10, True), ("carry_idle", 4, 4, True), ("eat", 4, 4, True), ("sit_eat", 4, 4, True)]
MOUTH = (0.0, 0.45, 1.0, 0.45)                                     # right hand: 0 = at the tray, 1 = at the mouth


def _carry_arms(arm, b=0.0):
    for s, n in ((1, "L"), (-1, "R")):
        hs._aim(arm, f"arm.{n}", Vector((s * 0.12, -0.32, -0.94 + 0.02 * b)))
        hs._aim(arm, f"forearm.{n}", Vector((-s * 0.42, -0.9, 0.08)))
        hs._aim(arm, f"hand.{n}", Vector((-s * 0.5, -0.86, 0.06)))


def _eat_arms(arm, i, seated):
    """Left hand: the tray out in front; right hand: from beside it up to the mouth by MOUTH[i]."""
    k = MOUTH[i]
    hs._aim(arm, "arm.L", Vector((0.1, -0.3, -0.95)))
    hs._aim(arm, "forearm.L", Vector((-0.25, -0.96, -0.05 if seated else 0.02)))
    hs._aim(arm, "hand.L", Vector((-0.2, -0.97, -0.08)))
    lo = (Vector((-0.12, -0.32, -0.94)), Vector((0.25, -0.96, 0.02)), Vector((0.2, -0.97, 0.0)))
    hi = (Vector((-0.2, -0.75, -0.62)), Vector((0.3, -0.25, 0.92)), Vector((0.2, -0.3, 0.93)))
    for name, a, c in zip(("arm.R", "forearm.R", "hand.R"), lo, hi):
        hs._aim(arm, name, a.lerp(c, k))
    hs._aim(arm, "head", hs._fwd(0.12 * (1 - abs(k - 0.5) * 2) + 0.06))     # dips to meet the food


def apply(arm, clip, i, scale):
    """Pose frame i of a meal / haul clip over the base action already set on `arm`. Returns the breathing phase."""
    if clip == "sit_eat":
        b = hs.apply(arm, i, scale, "sit_idle")
        _eat_arms(arm, i, True)
        return b
    arm.animation_data.action = None
    if clip in ("carry", "carry_idle"):
        _carry_arms(arm)
    else:
        _eat_arms(arm, i, False)
    return 0.0


def hands(arm, pose_frame, theta):
    """Screen offsets (px right, px down) of the held item's spot from the feet, per direction: CARRY_HAND (between the
    hands, carry frame 0) and EAT_HAND (the left hand, eat frame 0), for crewView. `pose_frame` / `theta`: human_render's."""
    import bpy
    from . import core
    out = {}
    for clip, bones in (("carry", ("hand.L", "hand.R")), ("eat", ("hand.L",))):
        row = []
        for d in range(8):
            arm.rotation_euler = (0, 0, math.radians(theta[d]))
            act = f"{BASE[clip]}_Armature"
            pose_frame(arm, clip, 0, act, bpy.data.actions[act].frame_range[0])
            bpy.context.view_layer.update()
            pts = [arm.matrix_world @ arm.pose.bones[b].tail for b in bones]
            p = sum(pts, Vector((0, 0, 0))) / len(pts)
            x, y = core.screen_xy(p)
            row.append((round(x), round(-y)))
        out[clip] = row
    return out
