"""Front overlays for beds (`module.bunk`, `module.bed`; leisure.py renders them): the bed's pixels that hide a sleeper,
drawn over that sleeper, so the frame, rails and the upper deck sit in front of whoever lies behind them.

The sleeper is posed as the game draws one (src/render/bedPose.ts): the `sleep` clip, its head toward the pillow
(HEAD_DIR by rotation), centred on the footprint less SLEEP_SHIFT toward the foot and raised BED_LIFT art px plus BERTH_RISE per berth above the floor.
For each berth, every `sleep` frame and every cast in consoles.SIT_CAST is rendered alone and with the bed as a
holdout; `hit[b]` is where the bed hides it.

Sprites per rotation r: `<asset>.front.b<b>.r<r>` for each berth b, drawn in game right over berth b's sleeper (berth 0
under berth 1's sleeper, berth 1's over everything). Each pixel is in at most one overlay, the highest berth it hides;
the body keeps every pixel (the overlay draws its own again on top)."""
import math

import numpy as np

from . import consoles as CO
from . import core, post
from . import crew_clips as clips
from .bunk_study import ZPX
from .modkit import K
from mathutils import Vector

BED_LIFT, BERTH_RISE = 4, 33          # art px: src/render/bedPose.ts
HEAD_DIR = (2, 4, 6, 0)               # bedPose: the head toward the pillow per rotation (r0 -y, r1 +x, r2 +y, r3 -x)
SLEEP_SHIFT = 0.09                    # tiles toward the foot: bedPose.ts SLEEP_SHIFT


def grow(m):
    out = m.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out |= np.roll(m, (dy, dx), (0, 1))
    return out


SINK = 0.1                            # units: how far a sleeper may sink into what lies under it and not count as hidden


def occluders(objs, fp, rot, berths, W, H):
    """[(hit, seen) per berth]: hit, pixels where the bed (`objs`, already built at `rot`) hides a sleeper in that berth,
    not counting what lies within SINK in front of it (the mattress the body sinks into); seen, where the sleeper shows.
    The sleeper is moved SINK toward the camera for these renders: the camera is orthographic, so its outline stays put."""
    hr, (arm, items) = CO._rig()
    by = {it.id: it for it in items}
    cx, cy = K("bed_xy", fp, rot).p(0, 0)
    frames = [(i, name, f) for c, i, name, f in clips.clip_frames() if c == "sleep"]
    view = core._state["cam"].matrix_world.to_3x3() @ Vector((0, 0, 1))    # toward the camera
    hits = []
    for b in range(berths):
        hit = np.zeros((H + 2, W + 2), bool)
        seen = np.zeros_like(hit)
        for i, name, f in frames:
            th = math.radians(hr.THETA[HEAD_DIR[rot]])
            arm.rotation_euler = (0, 0, th)
            hr.pose_frame(arm, "sleep", i, name, f)
            lx, ly, lz = arm.location
            hx, hy = -math.sin(th), math.cos(th)                               # toward the head (Blender axes)
            arm.location = (lx + cx - hx * SLEEP_SHIFT, ly - cy - hy * SLEEP_SHIFT, lz + (BED_LIFT + b * BERTH_RISE) / ZPX)
            arm.location += view.normalized() * SINK
            for cast in CO.SIT_CAST:
                hr.set_state(items, [by["crew.human." + c] for c in cast], [])
                vis = []
                for shown in (False, True):                                     # the sleeper alone, behind the bed
                    for o in objs:
                        o.is_holdout, o.hide_render = True, not shown
                    rgb, a = core.render(W, H, "color")
                    vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
                hit |= vis[0] & ~vis[1]
                seen |= vis[1]
        hits.append((hit, seen))
    arm.location = (0, 0, 0)
    hr.set_state(items, [], [])
    return hits


def split(op, hits):
    """The overlay masks from occluders' (hit, seen) per berth: berth b's is the sprite's pixels where the bed hides its
    sleeper and no higher berth's, grown 1 px (the crew sprite's outline) but never onto a pixel where the sleeper shows
    in front of the bed in any frame (`seen`)."""
    masks, taken = [], np.zeros_like(op)
    for hit, seen in reversed(hits):
        m = op & (hit | (grow(hit) & ~(seen & ~hit))) & ~taken
        masks.append(m)
        taken |= m
    return masks[::-1]
