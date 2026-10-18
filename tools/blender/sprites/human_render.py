"""Renders the human as sprite LAYERS (one sheet per item) with holdout, so one fixed stack order is correct in all
8 directions.

Stack order / holdout: layers are drawn in ascending ORDER. When layer L is rendered, the default items of every
LOWER slot are in the scene as Cycles holdout objects, so L is cut away wherever a lower layer is nearer to the
camera. Higher layers never need cutting by lower ones' absence: they are drawn over them anyway. (Arm slots use the
union of all arm variants as holdout so a chunky cyber arm still occludes a rig that was cut by a flesh arm.)

No per-layer outline: the runtime draws ONE outline around the stacked layers (crewView outline filter).

Finishing (this module, after the raw render of a layer): the skin highlight on the head (body layer), brighter cyan on
the cyber arm, and +30% saturation on clothing pixels that are not palette-swap keys."""
import math
import bpy
import numpy as np
from . import core, post
from . import human_base as hb
from .human_base import SCALE, build_skinned, import_base
from . import human_gear as hg
from . import human_sit as hs

SS = core.SS
ORDER = {"body": 0, "eyes": 10, "legs": 20, "torso": 30, "gear.belt": 40, "arm.R": 50, "arm.L": 51, "hair": 60,
         "implant.temple": 65, "gear.head": 70, "gear.back": 80}
UNION_SLOTS = ("arm.L", "arm.R")
# (clip, frames, fps, loop)
CLIPS = [("idle", 4, 4, True), ("walk", 8, 10, True), ("work", 6, 8, True), ("sleep", 3, 2, True), ("sit", 4, 3, True)]
# sim facing d: 0 = grid +x, CCW in grid space, 2 = grid +y. Character faces Blender -Y at azimuth 0, and Blender
# y = -grid y, so the azimuth about +Z that faces grid angle phi=45*d deg is theta = 90 - phi.
THETA = [90 - 45 * d for d in range(8)]
W, H = 124, 108
ORIGIN = (W // 2, 84)           # feet position in the render canvas (x, y from top)
TORSO_W = 1.1
SAT = 1.3                       # clothing saturation
CLOTHES = (("torso",), ("legs",), ("gear.belt",))
SLEEP_PHASE = (0.0, 1.0, 0.0)   # breathing: chest scale amount per sleep frame, then back


def build_items():
    core.setup_scene()
    arm = import_base()
    body = bpy.data.objects["skin@body.team.skin"]
    items = build_skinned(arm, body)
    by = {(i.slot, i.name): i for i in items}
    hg.nose_mouth(arm, by[("body", "")])
    hg.belt_extra(arm, by[("gear.belt", "tool_belt")])
    hg.legs_extra(arm, by[("legs", "cargo_pants")])
    hg.ponytail_extra(arm, by[("hair", "ponytail")])
    items += [hg.eyes(arm, False), hg.eyes(arm, True), hg.hair_mohawk(arm), hg.jack(arm), hg.goggles(arm),
              hg.engineer_rig(arm), hg.cyber_arm(arm, "L"), hg.cyber_arm(arm, "R")]
    for it in items:
        it.order = ORDER[it.slot]
        for ob in it.objs:
            ob.parent = arm
    for act in bpy.data.actions:       # we drive bone scale ourselves (head size, torso width, breathing)
        for fc in [f for f in act.fcurves if f.data_path.endswith("scale")]:
            act.fcurves.remove(fc)
    capture_idle_arms(arm)
    hb.warp_gear(items)
    arm.rotation_mode = "XYZ"
    arm.scale = (SCALE,) * 3
    arm.data.pose_position = "POSE"
    items.sort(key=lambda i: (i.order, i.name))
    return arm, items


def hold_set(item, items):
    import os
    if os.environ.get('NOHOLD'):
        return []
    out = []
    for o in items:
        if o.order >= item.order:
            continue
        if o.default or (item.slot not in ("body",) and o.slot in UNION_SLOTS and o.slot != item.slot):
            out.append(o)
    return out


def set_state(items, show, hold):
    for it in items:
        for ob in it.objs:
            ob.hide_render = True
            ob.is_holdout = False
    for it in show:
        for ob in it.objs:
            ob.hide_render = False
    for it in hold:
        for ob in it.objs:
            ob.hide_render = False
            ob.is_holdout = True


def clip_frames():
    """Yield (clip, index, action name, frame number)."""
    for clip, n, _, _ in CLIPS:
        if clip == "sit":               # procedural (human_sit): fingers come from idle frame 0
            for i in range(n):
                yield clip, i, "idle_Armature", 0
            continue
        act = bpy.data.actions[f"{clip}_Armature"]
        lo, hi = act.frame_range
        for i in range(n):
            f = hi if clip == "sleep" else lo + (hi - lo) * i / n
            yield clip, i, act.name, f


ARM_PREFIX = ("clavicle", "arm", "forearm", "hand", "index", "middle", "ring", "pinky", "thumb")
_IDLE_ARMS = {}
_SLEEP_LOC = {}
SLEEP_LIFT = 0.22        # lying on a bed: mattress height in tiles


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
    ob = next(o for o in bpy.data.objects if o.name.startswith("skin@body"))
    dg = bpy.context.evaluated_depsgraph_get()
    e = ob.evaluated_get(dg)
    me = e.to_mesh()
    co = np.array([v.co[:] for v in me.vertices])
    mw = np.array(e.matrix_world)
    w = (np.c_[co, np.ones(len(co))] @ mw.T)[:, :3]
    e.to_mesh_clear()
    lo, hi = w.min(0), w.max(0)
    arm.location = (-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, SLEEP_LIFT - lo[2])


def pose_frame(arm, clip, i, name, f):
    sc = bpy.context.scene
    arm.animation_data.action = bpy.data.actions[name]
    arm.pose.bones["root"].location = (0, 0, 0)
    sc.frame_set(int(f), subframe=f - int(f))
    pb = arm.pose.bones
    for b in pb:
        b.scale = (1, 1, 1)
    arm.location = (0, 0, 0)
    br = hs.apply(arm, i, SCALE) if clip == "sit" else 0.0
    pb["spine_03"].scale = (TORSO_W, 1 + 0.03 * br, 1 + 0.03 * br)
    pb["spine_02"].scale = (1 + (TORSO_W - 1) / 2, 1 + 0.02 * br, 1 + 0.02 * br)
    if clip == "sleep":
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


def head_px(arm):
    """Screen px (canvas coords, padded by 1) of the head bone's head and tail."""
    pb = arm.pose.bones
    mw = arm.matrix_world
    out = []
    for p in (pb["head"].head, pb["head"].tail):
        sx, sy = core.screen_xy(np.array(mw @ p))
        out.append((ORIGIN[0] + 1 + sx, ORIGIN[1] + 1 - sy))
    return out


def lighten_skin(rgb, a, head):
    """Skin highlight: skin-key pixels on the head go one shade step lighter (a soft ellipse round the head)."""
    (x0, y0), (x1, y1) = head
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ry = abs(y1 - y0) * 0.62 + 2
    yy, xx = np.mgrid[:rgb.shape[0], :rgb.shape[1]]
    inside = (((xx - cx) / 8.0) ** 2 + ((yy - cy) / ry) ** 2) < 1
    keys = post.KEYS.astype(np.uint8)
    k = post.TEAMS.index("team.skin")
    out = rgb.copy()
    for lv in range(4):
        out[inside & (a > 0) & (rgb == keys[k * 5 + lv]).all(-1)] = keys[k * 5 + lv + 1]
    return out


def _sat(rgb, f):
    g = rgb.astype(float) @ np.array([0.3, 0.59, 0.11])
    return np.clip(g[..., None] + (rgb - g[..., None]) * f, 0, 255)


def finish(item, rgba, head):
    """Per-layer finishing on the padded RGBA (see module doc)."""
    rgb, a = rgba[..., :3], rgba[..., 3]
    key = post._is_key(rgb)
    if item.slot == "body":
        rgba[..., :3] = lighten_skin(rgb, a, head)
    if item.slot.startswith("arm") and item.name == "cyber":
        r, g, b = (rgb[..., i].astype(int) for i in range(3))
        rgba[..., :3][(a > 0) & ~key & (b > 190) & (g > 160) & (r < 150) & (b - r > 90)] = (110, 255, 255)
    if any(item.slot.startswith(c[0]) for c in CLOTHES):
        m = (a > 0) & ~key
        rgba[..., :3][m] = _sat(rgb, SAT)[m].astype(np.uint8)
    return rgba


def render_item(item, items, head, with_glow=True):
    """-> (rgba uint8 (H+2,W+2,4), glow uint8 or None) for the current pose and arm azimuth."""
    hold = hold_set(item, items)
    set_state(items, [item], hold)
    rgb, a = core.render(W, H, "color", ORIGIN)
    post.MERGE_BANDS = True
    try:
        c, op = post.downsample(rgb, a > 0.5, SS, 6, True)
    finally:
        post.MERGE_BANDS = False
    c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    g = None
    if item.glow and with_glow:
        set_state(items, [item], hold)
        grgb, _ = core.render(W, H, "glow", ORIGIN)
        g = np.pad(post.glow_down(grgb, SS), ((1, 1), (1, 1), (0, 0)))
    return finish(item, post.to_rgba(c, op), head), g


def render_all(arm, items, dirs=range(8), clips=None, only=None, frames=None, log=print):
    """-> {item index: {(d, col): (rgba, glow)}}, plus the column list."""
    cols = [(clip, i) for clip, n, _, _ in CLIPS for i in range(n)]
    res = {k: {} for k in range(len(items))}
    todo = [k for k, it in enumerate(items) if only is None or any(s in it.id for s in only)]
    for d in dirs:
        arm.rotation_euler = (0, 0, math.radians(THETA[d]))
        for clip, i, name, f in clip_frames():
            if clips and clip not in clips:
                continue
            if frames and (clip, i) not in frames:
                continue
            pose_frame(arm, clip, i, name, f)
            head = head_px(arm)
            col = cols.index((clip, i))
            for k in todo:
                res[k][(d, col)] = render_item(items[k], items, head)
        log(f"dir {d} done")
    return res, cols
