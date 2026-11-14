"""The bench (family `bench_module`): `module.bench`, the approved BN18O raised for sitting, its pans shorter so
sitters sit back against the backrest (bench_r13 bn18q), a 2x1 module, four rotations, front = +v. Three crew sit on
it, one per seat, facing +v (SEATS: local tiles; src/content/modules.ts must match).

Sprites per rotation r: `module.bench.r<r>` (`module.bench` is the r0 copy), and `module.bench.front.r<r>`, the overlay
drawn over seated crew: the sprite's pixels where the bench hides a sitter on any seat in any sit_idle frame, grown 1 px
over the outline ring (as gametable.py). Layering: the bench at K, the sitters at K + 0.02, the front overlay at
K + 0.03."""
import math

import numpy as np

from . import bench_r13
from . import consoles as CO
from . import core, env_build as E, post
from .bench_study import FP
from .leisure import turned
from .modkit import K
from .research_bench import drop

PAL = "only:bench7"
# Seats, local tiles: u bench_r9.SEATS (px -19.2, 0, 19.2); v puts the sitter's back on the backrest (sit_idle's back is
# 0.10 behind the pose origin at the shoulders, 0.06 at the seat; the backrest's front face is at -0.16 at the seat and
# -0.22 at the shoulders, bench_r13.seat).
SEATS = ((-0.6, -0.11), (0.0, -0.11), (0.6, -0.11))
CLIP = "sit_idle"                                      # (src/render: the bench's seat kind plays this clip)


def sid(rot, tag=""):
    return f"module.bench{tag}.r{rot}"


def body(rot):
    return turned(bench_r13.DESIGNS["bn18q"], rot)


def facing(rot):
    """The crew direction (human_render.THETA index) facing local +v: the console seat faces -v (CO.SEAT_DIR)."""
    return CO.SEAT_DIR[(rot + 2) % 4]


def occluders(rot, W, H):
    """(hit, seen) as gametable.occluders: pixels where the bench hides a seated cast member on any seat in any frame,
    and where the crew shows in front of it."""
    hr, (arm, items) = CO._rig()
    objs = body(rot)
    by = {it.id: it for it in items}
    hit = np.zeros((H + 2, W + 2), bool)
    seen = hit.copy()
    n = next(c[1] for c in hr.CLIPS if c[0] == CLIP)
    for su, sv in SEATS:
        cx, cy = K("bench_xy", FP, rot).p(su, sv)
        for i in range(n):
            arm.rotation_euler = (0, 0, math.radians(hr.THETA[facing(rot)]))
            hr.pose_frame(arm, CLIP, i, "idle_Armature", 0)
            arm.location = (cx, -cy, 0)
            for cast in CO.SIT_CAST:
                hr.set_state(items, [by["crew.human." + c] for c in cast], [])
                vis = []
                for shown in ((), objs):                                # crew alone, crew behind the bench
                    for o in objs:
                        o.is_holdout, o.hide_render = True, o not in shown
                    rgb, a = core.render(W, H, "color")
                    vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
                hit |= vis[0] & ~vis[1]
                seen |= vis[1]
    arm.location = (0, 0, 0)
    hr.set_state(items, [], [])
    drop(objs)
    return hit, seen


def grow(m):
    out = m.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out |= np.roll(m, (dy, dx), (0, 1))
    return out


def items(rot):
    fp = FP if rot % 2 == 0 else FP[::-1]
    hr, (_, rig) = CO._rig()                          # (the rig first: building it clears the scene)
    hr.set_state(rig, [], [])                         # and hidden, or the first job's sprite has it in
    post.select(PAL)
    objs = body(rot)
    c, op, g, ox, oy, al = E.render_sprite("x", "prop", objs)
    W, H = op.shape[1] - 2, op.shape[0] - 2
    rgb, a = core.render(W, H, "color")
    ring = op & ~np.pad(post.downsample(rgb, a > 0.5, core.SS, 8, False)[1], 1)      # the sprite's outline px
    drop(objs)
    hit, seen = occluders(rot, W, H)
    fr = op & (hit | (grow(hit) & (ring | ~seen)))
    gb, gf = g.copy(), g.copy()
    gb[fr] = 0
    gf[~fr] = 0
    out = [E.crop_item(sid(rot), fp, c, op, gb, ox, oy, al)]
    if rot == 0:
        out.append(E.crop_item("module.bench", fp, c, op, gb, ox, oy, al))
    if fr.any():
        out.append(E.crop_item(sid(rot, ".front"), fp, c, fr, gf, ox, oy, np.where(fr, al, 0) if al is not None else None))
    return [it for it in out if it]


def job(rot):
    def run(rot=rot):
        return items(rot)
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
