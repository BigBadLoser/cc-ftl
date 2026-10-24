"""Crew corpses (family `corpse`): a dead crew member lying on the deck, loot for derelict ships. One tile, drawn on the
tile it lies on (~1.7 tiles long, centred like the sleep pose). Built from the real crew rig and items (human_items), a
plain jumpsuit and trousers, short hair, no helmet; every palette-swap key colour is replaced by a fixed muted one.

  decay.corpse     the base rig's raw Death pose: face down, arms flung up and out
  decay.corpse.v1  the sleep pose (Death with idle arms): arms down by the sides
Each in four rotations: <id>, <id>.r1 .. .r3 (the root turned about z by -rot*pi/2, as clutter.py)."""
import math
import numpy as np
import bpy
from mathutils import Matrix, Vector
from . import core, crew_clips as clips, human_items
from . import human_render as hr

KEEP = {"body", "eyes.organic", "arm.L.flesh", "arm.R.flesh", "torso.tee", "legs.cargo_pants", "hair.short"}  # outfit
SKIN, CREASE, SUIT, ACCENT = "rM", "rD", "c1T4", "c4W3"                             # mauve-grey, faded orange
FIXED = {"team.skin": SKIN, "team.skin*0.5": CREASE, "team.hair": "hair", "team.hair*0.55": "hair",
         "team.cloth": SUIT, "team.accent": ACCENT}
DEATH = "corpse_death"                      # copy of the base Death action, arms kept
VARIANTS = (("decay.corpse", False), ("decay.corpse.v1", True))      # (id, sleep-style arms)


def _build():
    """The crew scene with only the outfit left, and the raw Death action kept under DEATH."""
    orig = clips.capture_idle_arms

    def keep_death(arm):
        bpy.data.actions["sleep_Armature"].copy().name = DEATH
        orig(arm)
    clips.capture_idle_arms = keep_death
    try:
        arm, items = human_items.build_items()
    finally:
        clips.capture_idle_arms = orig
    objs = []
    for it in items:
        if it.id.removeprefix("crew.human.") in KEEP:
            objs += it.objs
        else:
            for ob in it.objs:
                bpy.data.objects.remove(ob, do_unlink=True)
    return arm, objs


def _fix_colours(objs):
    """Swap each key colour for its fixed palette colour in the per-face Col attribute."""
    for ob in objs:
        col = ob.data.color_attributes["Col"].data
        a = np.empty(len(col) * 4, np.float32)
        col.foreach_get("color", a)
        a = a.reshape(-1, 4)
        for key, name in FIXED.items():
            a[np.isclose(a[:, :3], core.lin(key), atol=1e-4).all(-1), :3] = core.lin(name)
        col.foreach_set("color", a.ravel())


def _low_z(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    z = []
    for ob in objs:
        e = ob.evaluated_get(dg)
        me = e.to_mesh()
        mw = np.array(e.matrix_world)
        z.append((np.c_[np.array([v.co[:] for v in me.vertices]), np.ones(len(me.vertices))] @ mw.T)[:, 2].min())
        e.to_mesh_clear()
    return min(z)


def corpse(rot, sleeping):
    arm, objs = _build()
    _fix_colours(objs)
    pb = arm.pose.bones
    act = bpy.data.actions["sleep_Armature" if sleeping else DEATH]   # sleep's has no arms: they come from idle
    hr.pose_frame(arm, "idle", 0, act.name, act.frame_range[1])      # "idle": no pose hooks, just action + torso
    if sleeping:
        for b in pb:
            if b.name in clips._IDLE_ARMS:
                b.rotation_mode = clips._IDLE_ARMS[b.name][0]
                b.rotation_quaternion, b.rotation_euler = clips._IDLE_ARMS[b.name][1:]
    clips.centre_on_origin(arm)                     # body middle on the origin (+ mattress lift)
    bpy.context.view_layer.update()
    loc = Vector(arm.location) - Vector((0, 0, _low_z(objs)))        # lowest point on the deck
    rz = -rot * math.pi / 2
    arm.rotation_euler.z = rz
    arm.location = Matrix.Rotation(rz, 3, "Z") @ loc
    bpy.context.view_layer.update()
    return objs


SPRITES = [(sid + ("" if r == 0 else f".r{r}"), (1, 1), "prop", lambda s=s, r=r: corpse(r, s))
           for sid, s in VARIANTS for r in range(4)]
