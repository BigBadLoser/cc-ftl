"""SIT clip: a procedural seated operator pose on the CC0 base rig (bone directions are set in armature space, so the rig's
odd bone axes do not matter). Pelvis on the console swivel chair (console_proto.chair: seat cushion top z = 0.39 tiles),
thighs ~horizontal, shins vertical, feet flat on the floor, torso slightly forward, hands forward at desk height.
The sprite origin is the chair centre on the floor (the crew stands where the chair is), the body is shifted back a little so
the pelvis sits on the cushion with the thighs pointing along the facing direction. A 4-frame loop: breathing + hand motion.
Occlusion by the chair is baked in (human_render.chair_holdout); the 3D pose clears the backrest and armrests, the
buttocks press ~0.035 into the 0.07 cushion."""
import math
from mathutils import Matrix, Vector

SEAT_Z = 0.39            # console_proto.chair: seat pan 0.25 + 0.07, cushion 0.32 + 0.07 (tiles, world)
HIP_ABOVE_SEAT = 0.105   # hip joint above the cushion top (world tiles): the buttock mesh sits on the seat
IDLE_SHIFT = 0.10        # world tiles: pelvis forward of the chair centre (backrest front face is at -0.155)
WORK_SHIFT = 0.065       # leaning in
FRAMES_IDLE, FRAMES_WORK = 4, 6
FOOT_FIX = 0.14          # lowers the thigh drop: the stylised mesh puts the soles 0.046 below the bone floor
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


def apply(arm, i, scale, clip="sit_idle"):
    """Pose `arm` (pose bones already reset to the idle pose for finger curl) as frame i of `sit_idle` (4 frames: watching,
    leaning back a little, hands resting) or `sit_work` (6 frames: leaning in, both hands reaching onto the desk and
    tapping alternately). `scale` = rig scale. Returns the breathing phase."""
    arm.animation_data.action = None                         # keep the idle finger curl, but stop the action overwriting our pose
    pb = arm.pose.bones
    work = clip == "sit_work"
    n = FRAMES_WORK if work else FRAMES_IDLE
    ph = math.tau * i / n
    b = math.sin(ph)                                         # breathing
    H = SEAT_Z / scale + HIP_ABOVE_SEAT / scale              # target hip joint height, rig units
    a = math.asin(max(-1.0, min(1.0, (H - REST_KNEE_Z) / THIGH - FOOT_FIX)))   # thigh drop angle so the feet land on the floor
    shift = WORK_SHIFT if work else IDLE_SHIFT               # pelvis forward of the chair centre keeps the back off the backrest
    pb["root"].location = (0, -shift / scale, H - REST_HIP_Z)
    bpy_update()
    lean = 0.2 if work else 0.07
    _aim(arm, "hips", _fwd(lean * 0.3))
    _aim(arm, "spine", _fwd(lean))
    _aim(arm, "spine_02", _fwd(lean * 1.3))
    _aim(arm, "spine_03", _fwd(lean * 1.2))
    _aim(arm, "neck_01", _fwd(0.02))
    _aim(arm, "head", _fwd(-0.05 if work else 0.02))
    for s, n_ in ((1, "L"), (-1, "R")):
        # legs: thighs forward and a hair outward, shins and feet keep their (vertical) rest directions
        _aim(arm, f"leg.{n_}", Vector((s * 0.07, -math.cos(a), -math.sin(a))))
        _aim(arm, f"shin.{n_}", _rest_dir(arm, f"shin.{n_}") + Vector((0, 0.03, 0)))
        _aim(arm, f"foot.{n_}", _rest_dir(arm, f"foot.{n_}"))
        if work:
            # elbows stay above the armrest pads (z 0.56) and inside them; forearms reach forward onto the desk, tapping
            tap = math.sin(ph + (0 if s > 0 else math.pi))
            _aim(arm, f"arm.{n_}", Vector((s * -0.05, -0.55, -0.83)))
            _aim(arm, f"forearm.{n_}", Vector((-s * 0.10, -0.97, -0.12 - 0.07 * tap)))
            _aim(arm, f"hand.{n_}", Vector((-s * 0.08, -0.98, -0.14 - 0.12 * tap)))
        else:
            h = math.sin(ph + (1.0 if s > 0 else 2.2))
            _aim(arm, f"arm.{n_}", Vector((s * 0.05, -0.38, -0.92 + 0.02 * b)))
            _aim(arm, f"forearm.{n_}", Vector((-s * 0.12, -0.95, -0.27 + 0.05 * h)))
            _aim(arm, f"hand.{n_}", Vector((-s * 0.1, -0.97, -0.18 + 0.04 * h)))
    return b


def bpy_update():
    import bpy
    bpy.context.view_layer.update()
