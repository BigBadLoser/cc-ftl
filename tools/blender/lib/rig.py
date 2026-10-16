"""Standard humanoid armature, sockets and posing helpers.

All bones are short stubs along +Y (Blender) so every bone's rest orientation is the identity: the exported
glTF joints have translation-only rest poses and a rotation of `rx` on a bone means exactly `rotation.x = rx`
(three.js Euler in lab space), like groups in a scene graph. Origin at the feet, ~1.5 tiles tall.
"""
import bpy
from mathutils import Matrix, Quaternion, Vector
from .kit import bl

# bone -> (parent, rest head in lab space = world, y up, front +z)
_ARM_X, _LEG_X = 0.39, 0.14
BONES = {
    "root": (None, (0, 0, 0)),
    "hips": ("root", (0, 0.5, 0)),
    "spine": ("hips", (0, 0.57, 0)),
    "head": ("spine", (0, 1.07, 0)),
}
for _n, _s in (("L", 1), ("R", -1)):
    BONES[f"arm.{_n}"] = ("spine", (_s * _ARM_X, 0.97, 0))
    BONES[f"forearm.{_n}"] = (f"arm.{_n}", (_s * _ARM_X, 0.74, 0))
    BONES[f"hand.{_n}"] = (f"forearm.{_n}", (_s * _ARM_X, 0.52, 0.02))
    BONES[f"leg.{_n}"] = ("hips", (_s * _LEG_X, 0.45, 0))
    BONES[f"shin.{_n}"] = (f"leg.{_n}", (_s * _LEG_X, 0.22, 0))
    BONES[f"foot.{_n}"] = (f"shin.{_n}", (_s * _LEG_X, 0.08, 0))

# socket -> (bone, rest position in lab space); empties named `socket.<name>`, identity orientation
SOCKETS = {
    "socket.back": ("spine", (0, 0.84, -0.26)),
    "socket.head": ("head", (0, 1.41, 0)),
    "socket.hand.L": ("hand.L", (_ARM_X, 0.44, 0.08)),
    "socket.hand.R": ("hand.R", (-_ARM_X, 0.44, 0.08)),
}

REST = {n: v[1] for n, v in BONES.items()}
REST.update({n: v[1] for n, v in SOCKETS.items()})
PARENT_BONE = {n: n for n in BONES}
PARENT_BONE.update({n: v[0] for n, v in SOCKETS.items()})
STUB = 0.05


def create_armature(name="armature"):
    """Create the standard armature object at the origin (object mode on return)."""
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bn, (parent, head) in BONES.items():
        eb = data.edit_bones.new(bn)
        eb.head = bl(head)
        eb.tail = eb.head + Vector((0, STUB, 0))
        eb.roll = 0.0
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def attach(obj, arm, target):
    """Parent `obj` to the bone owning `target` (bone or socket name), keeping its world position at the target head."""
    bone = PARENT_BONE[target]
    obj.parent, obj.parent_type, obj.parent_bone = arm, "BONE", bone
    obj.matrix_world = Matrix.Translation(bl(REST[target]))


def add_sockets(arm):
    """Create `socket.<name>` empties parented to their bones."""
    out = []
    for name, (_bone, _pos) in SOCKETS.items():
        e = bpy.data.objects.new(name, None)
        e.empty_display_type, e.empty_display_size = "ARROWS", 0.04
        bpy.context.scene.collection.objects.link(e)
        attach(e, arm, name)
        out.append(e)
    return out


# ---- posing (lab-space angles/offsets, as in the crew lab) -------------------------------------------------------

def lab_quat(r):
    """Lab Euler (three order) -> Blender quaternion for a bone with identity rest orientation."""
    rx, ry, rz = r
    return Quaternion((1, 0, 0), rx) @ Quaternion((0, 0, 1), ry) @ Quaternion((0, 1, 0), -rz)


def key_pose(arm, frame, pose):
    """Set and keyframe every bone for `frame`. pose: {bone: {'r': (x,y,z), 'p': (x,y,z), 's': (x,y,z)}} (missing = rest)."""
    for pb in arm.pose.bones:
        d = pose.get(pb.name, {})
        pb.rotation_quaternion = lab_quat(d.get("r", (0, 0, 0)))
        pb.location = Vector(bl(d.get("p", (0, 0, 0))))
        s = d.get("s", (1, 1, 1))
        pb.scale = (s[0], s[2], s[1])
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if pb.name in ("root", "hips"):
            pb.keyframe_insert("location", frame=frame)
        if pb.name == "spine" or "s" in d:
            pb.keyframe_insert("scale", frame=frame)


def new_action(arm, name, loop_frames):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create().action = act
    return act
