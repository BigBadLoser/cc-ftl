"""The crew clip table: how each clip poses the armature, and the clip-specific pose code. Runs inside Blender.

Adding a clip = a row in crew_spec.CLIPS (name, frames, fps, loop) and an entry in POSES here. This file is NOT part of the
render-cache global hash: every clip's cache key covers only its own row and the source of its own pose functions (plus the
files in crew_build.CLIP_FILES), so a new clip, or a change to one clip's pose, re-renders that clip alone.
Procedural clips (sit_*, eva_float) take their fingers from idle frame 0 and then pose the bones themselves."""
from dataclasses import dataclass
from typing import Callable, Optional
import bpy
import numpy as np
from .human_base import SCALE
from . import human_aim as aim
from . import human_sit as hs
from . import human_suit as suit
from . import human_v2_weapons as hw
from .crew_spec import CLIPS

SIT_HIDE = ("gear.back",)        # slots left empty in the sit clips (the engineer rig would sit inside the backrest)
SLEEP_PHASE = (0.0, 1.0, 0.0)    # breathing: chest scale amount per sleep frame, then back
SLEEP_LIFT = 0.22                # lying on a bed: mattress height in tiles
ARM_PREFIX = ("clavicle", "arm", "forearm", "hand", "index", "middle", "ring", "pinky", "thumb")
_IDLE_ARMS = {}
_SLEEP_LOC = {}


@dataclass(frozen=True)
class Pose:
    action: Optional[str] = None            # armature action; default "<clip>_Armature"
    hold: Optional[str] = None              # None: sweep the action's frame range over the clip's frames; "first" / "last": that key frame
    before: Optional[Callable] = None       # (arm, i, clip) -> breathing amount: poses bones after the action, before torso scaling
    after: Optional[Callable] = None        # (arm, i): final touches
    puffs: Optional[Callable] = None        # (i) -> nozzle indices puffing in frame i (glow only)
    chair: bool = False                     # render against the console chair as holdout
    items: Optional[Callable] = None        # (item) -> bool: which items get this clip (default all)


def _sit(arm, i, clip):
    return hs.apply(arm, i, SCALE, clip)


def _float(arm, i, clip):
    return suit.float_pose(arm, i, SCALE)


def _sit_items(it):
    if it.slot == "gear.holster":                       # a weapon slung or stowed on the back sits in the backrest too
        return hw.CARRY[hw.FAMILY[it.name]] in ("thigh", "belt")
    return it.slot not in SIT_HIDE


def _float_items(it):
    return suit.is_eva(it) or it.slot == "body"


def _combat(arm, i, clip):
    return aim.apply(arm, i, clip)


def _combat_items(family):
    """Every layer but the holstered weapons, and of the held weapons only those of this pose family."""
    return lambda it: it.slot != "gear.holster" and (it.slot != "gear.hand" or hw.FAMILY.get(it.name) == family)


def _is_arm_bone(n):
    return n.split(".")[0].split("_")[0] in ARM_PREFIX


def capture_idle_arms(arm):
    """The Death pose the base uses for sleep has the arms flung up: take the arm bones from idle instead."""
    sc = bpy.context.scene
    arm.animation_data.action = bpy.data.actions["idle_Armature"]
    sc.frame_set(0)
    for b in arm.pose.bones:
        if _is_arm_bone(b.name):
            _IDLE_ARMS[b.name] = (b.rotation_mode, tuple(b.rotation_quaternion), tuple(b.rotation_euler))
    sl = bpy.data.actions["sleep_Armature"]
    for fc in [f for f in sl.fcurves if _is_arm_bone(f.data_path.split('"')[1] if '"' in f.data_path else "")]:
        sl.fcurves.remove(fc)


def centre_on_origin(arm):
    """Lying poses are ~1.7 tiles long: shift the armature so the body's mid-point sits on the world origin (+lift)."""
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    ob = next(o for o in bpy.data.objects if o.name.startswith(("skin@body", "v2.body")))   # old or v2 base
    dg = bpy.context.evaluated_depsgraph_get()
    e = ob.evaluated_get(dg)
    me = e.to_mesh()
    co = np.array([v.co[:] for v in me.vertices])
    mw = np.array(e.matrix_world)
    w = (np.c_[co, np.ones(len(co))] @ mw.T)[:, :3]
    e.to_mesh_clear()
    lo, hi = w.min(0), w.max(0)
    arm.location = (-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, SLEEP_LIFT - lo[2])


def _sleep(arm, i):
    pb = arm.pose.bones
    for b in pb:
        if b.name in _IDLE_ARMS:
            mode, q, e = _IDLE_ARMS[b.name]
            b.rotation_quaternion, b.rotation_euler = q, e
    k = SLEEP_PHASE[i]
    for n in ("spine_02", "spine_03"):
        pb[n].scale = (1 + 0.025 * k, 1 + 0.03 * k, 1 + 0.03 * k)
    key = round(arm.rotation_euler.z, 3)
    if key not in _SLEEP_LOC:           # from the un-breathed pose, so the body does not jitter between frames
        for n in ("spine_02", "spine_03"):
            pb[n].scale = (1, 1, 1)
        centre_on_origin(arm)
        _SLEEP_LOC[key] = tuple(arm.location)
        for n in ("spine_02", "spine_03"):
            pb[n].scale = (1 + 0.025 * k, 1 + 0.03 * k, 1 + 0.03 * k)
    arm.location = _SLEEP_LOC[key]


POSES = {
    "sleep": Pose(hold="last", after=_sleep),
    "sit_idle": Pose(action="idle_Armature", hold="first", before=_sit, chair=True, items=_sit_items),
    "sit_work": Pose(action="idle_Armature", hold="first", before=_sit, chair=True, items=_sit_items),
    "eva_float": Pose(action="idle_Armature", hold="first", before=_float, puffs=suit.puffs, items=_float_items),
}
for _c in ("aim_1h", "fire_1h", "aim_2h", "fire_2h", "aim_heavy", "fire_heavy", "ready_1m", "swing_1m", "ready_2m",
           "swing_2m"):
    POSES[_c] = Pose(action="idle_Armature", hold="first", before=_combat, items=_combat_items(_c.rsplit("_", 1)[1]))
for _c in ("walk_aim_1h", "walk_aim_2h", "walk_heavy"):                 # the walk cycle's legs, the aim's arms
    POSES[_c] = Pose(action="walk_Armature", before=_combat, items=_combat_items(_c.rsplit("_", 1)[1]))


def pose_of(clip):
    """Clips without an entry sweep their own action `<clip>_Armature` (idle, walk, work)."""
    return POSES.get(clip, Pose())


def clip_frames(only=None):
    """Yield (clip, index, action name, frame number)."""
    for clip, n, _, _ in CLIPS:
        if only and clip not in only:
            continue
        p = pose_of(clip)
        act = bpy.data.actions[p.action or f"{clip}_Armature"]
        lo, hi = act.frame_range
        for i in range(n):
            f = 0 if p.hold == "first" else hi if p.hold == "last" else lo + (hi - lo) * i / n   # "first": procedural, idle frame 0
            yield clip, i, act.name, f
