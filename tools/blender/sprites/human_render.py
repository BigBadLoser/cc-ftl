"""Renders the human as sprite LAYERS (one sheet per item) with holdout, so one fixed stack order is correct in all
8 directions.

Stack order / holdout: layers are drawn in ascending ORDER. When layer L is rendered, the default items of every
LOWER slot are in the scene as Cycles holdout objects, so L is cut away wherever a lower layer is nearer to the
camera. Higher layers never need cutting by lower ones' absence: they are drawn over them anyway. (Arm slots use the
union of all arm variants as holdout so a chunky cyber arm still occludes a rig that was cut by a flesh arm.)

Sit clips (sit_idle, sit_work): the console chair is in the scene as a holdout (chair_holdout), so every layer is already
cut where the backrest, seat or armrests are nearer the camera, and those pixels carry alpha HIDDEN_A so the runtime
filter draws neither outline nor rim along the cut; the gear.back slot is left empty while seated. The
runtime draws the console sprite (chair included) first, the seated crew over it, then the console's front overlay.

No per-layer outline: the runtime draws ONE outline around the stacked layers (crewView outline filter).

Finishing (this module, after the raw render of a layer): the skin highlight on the head (body layer), brighter cyan on
the cyber arm, and +30% saturation on clothing pixels that are not palette-swap keys."""
import math
import bpy
import numpy as np
from . import core, post
from .human_base import SCALE
from . import human_suit as suit
from . import crew_clips as clips
from .crew_spec import ORDER, CLIPS, W, H, ORIGIN, FRAME_W, FRAME_H, ANCHOR  # noqa: F401  (re-exported for the review scripts)

SS = core.SS
UNION_SLOTS = ("arm.L", "arm.R")
# sim facing d: 0 = grid +x, CCW in grid space, 2 = grid +y. Character faces Blender -Y at azimuth 0, and Blender
# y = -grid y, so the azimuth about +Z that faces grid angle phi=45*d deg is theta = 90 - phi.
THETA = [90 - 45 * d for d in range(8)]
TORSO_W = 1.1
SAT = 1.3                       # clothing saturation
CLOTHES = (("torso",), ("legs",), ("gear.belt",))
HIDDEN_A = 12                   # alpha of a chair-occluded pixel (sit clips): the crew filter draws it as nothing, no outline/rim
_CHAIR = []
_PUFFS = set()                  # eva_float: nozzles puffing in the frame being rendered


def hold_set(item, items):
    import os
    if os.environ.get('NOHOLD'):
        return []
    out = []
    for o in items:
        if o.order >= item.order:
            continue
        if suit.is_eva(item):                   # the suit cuts only against the body and the other suit pieces
            if o.slot == "body" or suit.is_eva(o):
                out.append(o)
            continue
        if suit.is_eva(o):
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
    for it in items:                            # eva pack thrust puffs: only on the nozzles puffing this frame
        for ob in it.objs:
            if suit.PUFF in ob and ob[suit.PUFF] not in _PUFFS:
                ob.hide_render = True


def pose_frame(arm, clip, i, name, f):
    """Pose the armature for frame i of a clip (the clip table is crew_clips.POSES)."""
    sc = bpy.context.scene
    p = clips.pose_of(clip)
    arm.animation_data.action = bpy.data.actions[name]
    arm.pose.bones["root"].location = (0, 0, 0)
    sc.frame_set(int(f), subframe=f - int(f))
    pb = arm.pose.bones
    for b in pb:
        b.scale = (1, 1, 1)
    arm.location = (0, 0, 0)
    br = p.before(arm, i, clip) if p.before else 0.0
    pb["spine_03"].scale = (TORSO_W, 1 + 0.03 * br, 1 + 0.03 * br)
    pb["spine_02"].scale = (1 + (TORSO_W - 1) / 2, 1 + 0.02 * br, 1 + 0.02 * br)
    if p.after:
        p.after(arm, i)


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


def _opaque(rgb, a):
    post.MERGE_BANDS = True
    try:
        return post.downsample(rgb, a > 0.5, SS, 6, True)
    finally:
        post.MERGE_BANDS = False


def render_item(item, items, head, with_glow=True, chair=None):
    """-> (rgba uint8 (H+2,W+2,4), glow uint8 or None) for the current pose and arm azimuth. With `chair` (the sit clips'
    holdout, visible): pixels the chair hides get alpha HIDDEN_A, so the runtime filter puts no outline or rim there."""
    hold = hold_set(item, items)
    set_state(items, [item], hold)
    hidden = None
    if chair is not None:
        chair.hide_render = True
        _, free = _opaque(*core.render(W, H, "color", ORIGIN))
        chair.hide_render = False
    rgb, a = core.render(W, H, "color", ORIGIN)
    c, op = _opaque(rgb, a)
    if chair is not None:
        hidden = np.pad(free & ~op, 1)
    c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    g = None
    if item.glow and with_glow:
        set_state(items, [item], hold)
        grgb, _ = core.render(W, H, "glow", ORIGIN)
        g = np.pad(post.glow_down(grgb, SS), ((1, 1), (1, 1), (0, 0)))
    out = finish(item, post.to_rgba(c, op), head)
    if hidden is not None:
        out[hidden] = (0, 0, 0, HIDDEN_A)
    return out, g


def chair_holdout():
    """The console swivel chair (console_proto.chair) at the sprite origin, facing the azimuth-0 way (grid +y, Frame rot 2).
    In the sit clips it is a Cycles holdout turned with the character, so the backrest, seat and armrests cut the crew
    exactly where they are nearer the camera (those pixels are kept as HIDDEN_A markers). The console sprite draws the chair
    itself, beneath the crew."""
    if not _CHAIR:
        from . import console_proto as C
        from .cmbkit import Frame
        m = core.Mesh("sit_chair_holdout")
        C.chair(Frame(m, 2, centre=(0.0, 0.0)), 0.0, 0.0, False)
        ob = m.build()
        ob.is_holdout, ob.hide_render = True, True
        _CHAIR.append(ob)
    return _CHAIR[0]
