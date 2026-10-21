"""Combat clips: procedural aim and fire poses on the v2 rig, over idle frame 0 (finger curl, legs). Armature space:
forward -Y, up +Z, character left +X.

The right hand holds the weapon (human_v2_weapons: a gear.hand layer modelled in hand.R's own frame), so the hand's
whole frame is set, not just its direction: +Y along the barrel, +Z up. The arms reach their targets with a two-bone
IK; two-hand and heavy holds put the left hand on the family's support point (human_v2_weapons.SUPPORT).
  aim_1h / fire_1h        one arm out at shoulder height, the other at the side; fire: a kick up and back, then settle
  aim_2h / fire_2h        stock in the right shoulder, left hand on the foregrip; fire: as 1h, smaller
  aim_heavy / fire_heavy  braced at the right hip, a wide knees-bent stance, left hand on the top handle; fire: a
                          sustained shudder (4 frames, looping)
  walk_aim_1h / walk_aim_2h / walk_heavy   the walk cycle's legs (the walk action at that frame) under the aim's arms"""
import math

from mathutils import Matrix, Vector

from . import human_v2_weapons as hw
from .human_sit import _aim, bpy_update

FWD, UP, LEFT = Vector((0, -1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))
KICK = {"fire_1h": (1.0, 0.5, 0.15), "fire_2h": (1.0, 0.45, 0.1), "fire_heavy": (0.6, 0.25, 0.55, 0.2)}


def _ik(arm, s, target, pole):
    """arm.s and forearm.s so the wrist lands on `target`; the elbow bends toward `pole`."""
    pb, B = arm.pose.bones, arm.data.bones
    S = pb[f"arm.{s}"].head.copy()
    a, b = B[f"arm.{s}"].length, B[f"forearm.{s}"].length
    d = target - S
    L = min(d.length, (a + b) * 0.995)
    u = d.normalized()
    x = (a * a - b * b + L * L) / (2 * L)
    v = (pole - u * pole.dot(u)).normalized()
    E = S + u * x + v * math.sqrt(max(0.0, a * a - x * x))
    _aim(arm, f"arm.{s}", E - S)
    _aim(arm, f"forearm.{s}", S + u * L - E)


def _frame(arm, name, fwd, up):
    """Set a bone's whole armature-space frame: +Y along fwd, +Z toward up, its head where it is."""
    pb = arm.pose.bones[name]
    right = fwd.cross(up).normalized()
    up = right.cross(fwd).normalized()
    m = Matrix((right, fwd, up)).transposed().to_4x4()
    m.translation = pb.head
    pb.matrix = m
    bpy_update()


def _hold(arm, s, grip, fwd, up, pole):
    """Hand s closes on the grip-frame point `grip` (armature space), barrel along fwd."""
    _ik(arm, s, grip - fwd * hw.grip_y(arm), pole)
    _frame(arm, f"hand.{s}", fwd, up)


def _stance(arm, wide):
    pb = arm.pose.bones
    pb["root"].location = (0, 0, -0.035 if wide else 0.0)
    bpy_update()
    for s, n in ((1, "L"), (-1, "R")):
        if wide:                                                              # feet apart, knees a little bent
            _aim(arm, f"leg.{n}", Vector((s * 0.2, -0.08, -1)))
            _aim(arm, f"shin.{n}", Vector((s * 0.12, 0.1, -1)))


def apply(arm, i, clip):
    """Pose frame i of a combat clip (see the module docstring). -> breathing amount."""
    arm.animation_data.action = None                                         # keep the action's pose, stop it
    pb = arm.pose.bones                                                      # overwriting ours
    fam = clip.rsplit("_", 1)[1]
    walk = clip.startswith("walk")
    k = KICK[clip][i] if clip in KICK else 0.0
    breath = 0.0 if clip in KICK or walk else math.sin(math.pi * i)
    pitch = 0.12 * k + (0.05 if fam == "heavy" else 0.0)
    fwd = (FWD * math.cos(pitch) + UP * math.sin(pitch)).normalized()
    up = (UP * math.cos(pitch) - FWD * math.sin(pitch)).normalized()
    back = -FWD * 0.04 * k                                                   # the kick
    if not walk:
        _stance(arm, fam == "heavy")
    _aim(arm, "spine_02", Vector((0, -0.08 if fam != "heavy" else 0.04, 1)))   # lean into it (heavy: lean back)
    if fam == "1h":
        S = pb["arm.R"].head.copy()
        reach = (arm.data.bones["arm.R"].length + arm.data.bones["forearm.R"].length) * 0.96
        wrist = S + (FWD * 0.94 + LEFT * 0.28 - UP * 0.1).normalized() * reach + back
        _ik(arm, "R", wrist, -UP + LEFT * 0.2 + FWD * 0.1)
        _frame(arm, "hand.R", fwd, up)
    elif fam == "2h":
        sh = pb["arm.R"].head.copy()
        grip = sh + FWD * 0.34 + LEFT * 0.05 - UP * 0.08 + back
        _hold(arm, "R", grip, fwd, up, -UP - LEFT * 0.6 + FWD * 0.2)
        sup = pb["hand.R"].matrix @ (hw.SUPPORT["2h"] * hw.SIZE + Vector((0, hw.grip_y(arm), 0)))
        _hold(arm, "L", sup - up * 0.03, fwd, up, -UP + LEFT * 0.8)
    else:
        hips = pb["hips"].head.copy()
        grip = hips + FWD * 0.24 - LEFT * 0.11 + UP * 0.14 + back * 0.6
        _hold(arm, "R", grip, fwd, up, -UP - LEFT * 0.5 - FWD * 0.3)
        sup = pb["hand.R"].matrix @ (hw.SUPPORT["heavy"] * hw.SIZE + Vector((0, hw.grip_y(arm), 0)))
        _hold(arm, "L", sup + up * 0.02, fwd, up, -UP + LEFT * 0.9)
    _aim(arm, "head", Vector((0, -0.1, 1)))
    return 0.4 * breath
