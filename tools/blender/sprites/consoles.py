"""Production bridge consoles (console_proto models, approved): helm 3x2, weapons 2x2, shield 3x2, in four rotations.

Per console and rotation r (footprint rotated like the sim, clockwise):
  module.<c>.r<r>            idle (screens dark)          module.<c>.r<r>.active   powered and manned
  module.<c>.front.r<r>      desk-front overlay (+ .active): the sprite's pixels where the desk hides a seated
                             operator in some sit_idle / sit_work frame, grown 1 px over the crew outline ring.
The full sprite keeps every pixel (the chair is baked in); its glow leaves out the overlay's share so the pair adds up
to the full glow. Seated-crew layering in the renderer: console at K, crew at the chair tile at K + 0.02 (facing
SEAT_DIR[r], floor shadow hidden), front overlay at K + 0.03. The operator faces +u (the desk); see console_proto.
Content (src/content/modules.ts) must match `meta()`: chair = access tile = an open tile, EMPTY tiles open too."""
import math

import bpy
import numpy as np

from . import console_proto as C
from . import core, env_build, post
from .cmbkit import Frame

IDS = {"helm": "module.helm", "weapons": "module.weapons_console", "shield": "module.shield_console"}
SEAT_DIR = {0: 6, 1: 0, 2: 2, 3: 4}      # seated crew direction per rotation (faces +u: r0 -y, r1 +x, r2 +y, r3 -x)
SIT_CAST = (("body", "legs.cargo_pants", "gear.belt.tool_belt", "eyes.cyber", "hair.mohawk", "arm.L.cyber", "arm.R.cyber",
             "torso.work_shirt", "gear.head.welding_goggles"),
            ("body", "legs.cargo_pants", "gear.belt.tool_belt", "eyes.organic", "hair.ponytail", "arm.L.flesh", "arm.R.flesh",
             "torso.tee"))
_RIG = []


def meta(name, rot):
    """Footprint tiles relative to the footprint's min corner: chair (access) tile, solid and walkable tiles."""
    nu, nv = C.FOOT[name]
    cx, cy = C.centre(rot, nu, nv)
    f = Frame(None, rot, centre=(cx, cy))
    tiles = [(f.xy(-nu / 2 + .5 + i, -nv / 2 + .5 + j), (i, j)) for i in range(nu) for j in range(nv)]
    mnx, mny = min(t[0][0] for t in tiles), min(t[0][1] for t in tiles)
    grid = lambda p: (round(p[0] - mnx), round(p[1] - mny))  # noqa: E731
    walk = {(round(a + nu / 2 - .5), round(b + nv / 2 - .5)) for a, b in [C.CHAIR[name]] + C.EMPTY.get(name, [])}
    return {"chair_tile": grid(f.xy(*C.CHAIR[name])), "chair_rel_origin": list(f.xy(*C.CHAIR[name])),
            "solid_tiles": [grid(t[0]) for t in tiles if t[1] not in walk],
            "walkable_tiles": [grid(t[0]) for t in tiles if t[1] in walk]}


def _rig():
    if not _RIG:
        from . import human_render as hr
        _RIG.append((hr, hr.build_items()))
    return _RIG[0]


def _occluders(name, rot, W, H):
    """(hit, seen): pixels where the desk (not the chair) hides the seated cast in any sit frame, and where the crew shows
    in front of the desk in any frame (3D: crew alone vs crew with the desk as a holdout)."""
    hr, (arm, items) = _rig()
    by = {it.id: it for it in items}
    parts = C.console_parts(name, rot, True)
    cx, cy = meta(name, rot)["chair_rel_origin"]
    hit = np.zeros((H + 2, W + 2), bool)
    seen = hit.copy()
    for clip, n, _, _ in [c for c in hr.CLIPS if c[0].startswith("sit")]:
        for i in range(n):
            arm.rotation_euler = (0, 0, math.radians(hr.THETA[SEAT_DIR[rot]]))
            hr.pose_frame(arm, clip, i, "idle_Armature", 0)
            arm.location = (cx, -cy, 0)
            for cast in SIT_CAST:
                hr.set_state(items, [by["crew.human." + c] for c in cast], [])
                vis = []
                for desk in (False, True):
                    for k, o in parts.items():
                        o.is_holdout, o.hide_render = True, k == "chair" or not desk
                    rgb, a = core.render(W, H, "color")
                    vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
                hit |= vis[0] & ~vis[1]
                seen |= vis[1]
    arm.location = (0, 0, 0)
    hr.set_state(items, [], [])
    for o in parts.values():
        bpy.data.objects.remove(o, do_unlink=True)
    return hit, seen


def _full(name, rot, st):
    post.select(True)
    objs = C.console(name, rot, st)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", objs)
    W, H = op.shape[1] - 2, op.shape[0] - 2
    rgb, a = core.render(W, H, "color")
    ring = op & ~np.pad(post.downsample(rgb, a > 0.5, core.SS, 8, False)[1], 1)     # the sprite's outline pixels
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return c, op, g, ox, oy, ring, W, H


def console_items(name, rot):
    hr, (arm, items) = _rig()
    arm.location = (0, 0, 0)
    hr.set_state(items, [], [])
    nu, nv = C.FOOT[name]
    fp = (nv, nu) if rot % 2 == 0 else (nu, nv)
    sid = IDS[name]
    out, front = [], None
    for st in (True, False):                     # active first: its canvas defines the overlay mask
        c, op, g, ox, oy, ring, W, H = _full(name, rot, st)
        if front is None:
            hit, seen = _occluders(name, rot, W, H)
            near = hit.copy()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                near |= np.roll(hit, (dy, dx), (0, 1))
            front = hit | (near & (ring | ~seen))
            size = op.shape
        assert op.shape == size, (name, rot, op.shape, size)
        fr = op & front
        tag = ".active" if st else ""
        gb, gf = g.copy(), g.copy()
        gb[fr] = 0
        gf[~fr] = 0
        out.append(env_build.crop_item(f"{sid}.r{rot}{tag}", fp, c, op, gb, ox, oy))
        if fr.any():
            out.append(env_build.crop_item(f"{sid}.front.r{rot}{tag}", fp, c, fr, gf, ox, oy))
    print("CONSOLE", name, rot, meta(name, rot), flush=True)
    return out


def jobs():
    return [lambda n=n, r=r: console_items(n, r) for n in IDS for r in range(4)]
