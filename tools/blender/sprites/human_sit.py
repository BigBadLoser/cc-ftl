"""SIT clip: a procedural seated operator pose on the CC0 base rig (bone directions are set in armature space, so the rig's
odd bone axes do not matter). Pelvis on the console swivel chair (console_proto.chair: seat cushion top z = 0.39 tiles),
thighs ~horizontal, shins vertical, feet flat on the floor, torso slightly forward, hands forward at desk height.
The sprite origin is the chair centre on the floor (the crew stands where the chair is), the body is shifted back a little so
the pelvis sits on the cushion with the thighs pointing along the facing direction. A 4-frame loop: breathing + hand motion."""
import math
from mathutils import Matrix, Vector

SEAT_Z = 0.39            # console_proto.chair: seat pan 0.25 + 0.07, cushion 0.32 + 0.07 (tiles, world)
HIP_ABOVE_SEAT = 0.075   # hip joint above the cushion top (world tiles): the buttock mesh sits on the seat
BACK_SHIFT = 0.05        # world tiles: pelvis behind the chair centre
FRAMES = 4
REST_KNEE_Z, REST_HIP_Z, THIGH = 0.463, 0.825, 0.362     # rest-pose (unscaled rig units)


def _fwd(pitch, side=0.0, drop=0.0):
    """Armature-space direction: forward is -Y, up is +Z. pitch = lean from vertical; drop = extra downward."""
    return Vector((side, -math.sin(pitch), math.cos(pitch) - drop)).normalized()


def _aim(arm, name, direction):
    """Rotate pose bone `name` (minimal rotation) so its +Y axis points along `direction` (armature space)."""
    pb = arm.pose.bones[name]
    m = pb.matrix.copy()
    cur = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    out = q.to_matrix().to_4x4() @ m.to_3x3().to_4x4()
    out.translation = m.translation
    pb.matrix = out
    arm.update_tag()
    import bpy
    bpy.context.view_layer.update()


def _rest_dir(arm, name):
    return (arm.data.bones[name].matrix_local.to_3x3() @ Vector((0, 1, 0))).normalized()


def apply(arm, i, scale):
    """Pose `arm` (pose bones already reset to the idle pose for finger curl) as sit frame i. `scale` = rig scale."""
    arm.animation_data.action = None                         # keep the idle finger curl, but stop the action overwriting our pose
    pb = arm.pose.bones
    b = math.sin(math.tau * i / FRAMES)                      # breathing
    h = math.sin(math.tau * i / FRAMES + 1.0)                # hand motion
    H = SEAT_Z / scale + HIP_ABOVE_SEAT / scale              # target hip joint height, rig units
    a = math.asin(max(-1.0, min(1.0, (H - REST_KNEE_Z) / THIGH)))   # thigh drop angle so the feet land on the floor
    pb["root"].location = (0, BACK_SHIFT / scale, H - REST_HIP_Z)
    bpy_update()
    lean = 0.09
    _aim(arm, "hips", _fwd(lean * 0.3))
    _aim(arm, "spine", _fwd(lean))
    _aim(arm, "spine_02", _fwd(lean * 1.3))
    _aim(arm, "spine_03", _fwd(lean * 1.2))
    _aim(arm, "neck_01", _fwd(0.02))
    _aim(arm, "head", _fwd(0.02 - 0.03 * b * 0))
    for s, n in ((1, "L"), (-1, "R")):
        # legs: thighs forward and a hair outward, shins and feet keep their (vertical) rest directions
        _aim(arm, f"leg.{n}", Vector((s * 0.07, -math.cos(a), -math.sin(a))))
        _aim(arm, f"shin.{n}", _rest_dir(arm, f"shin.{n}") + Vector((0, 0.03, 0)))
        _aim(arm, f"foot.{n}", _rest_dir(arm, f"foot.{n}"))
        # arms: upper arm down and slightly forward, forearm forward and inward at desk height
        _aim(arm, f"arm.{n}", Vector((s * 0.2, -0.38, -0.9 + 0.02 * b)))
        _aim(arm, f"forearm.{n}", Vector((-s * 0.12, -0.95, -0.27 + 0.05 * h * s)))
        _aim(arm, f"hand.{n}", Vector((-s * 0.1, -0.97, -0.18 + 0.04 * h * s)))
    return b


def bpy_update():
    import bpy
    bpy.context.view_layer.update()
