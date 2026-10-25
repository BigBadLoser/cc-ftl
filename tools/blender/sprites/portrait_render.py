"""Crew portraits: one front-facing, eye-level render of every crew layer, packed into the `portraits` sheet.

Not the isometric camera: an orthographic camera looking along the horizon (a few degrees down) at the character's face,
framed on the head and shoulders. The pose is idle frame 0, facing the camera. Every layer of a species is rendered in
the same frame, so the layers stack exactly like the clip sheets (palette-swap key colours, the same holdout rules as
crew_build). The runtime composes the layers a crew member wears and runs the crew palette filter over them
(src/render/portrait.ts).

  humans   every human item but the EVA suit and the held weapons (the holsters show): `portrait.crew.human.<slot>.<name>`
  aliens   one body per creature, `portrait.crew.alien.body.hunter` ...: framed on the top of the body by its width
           (robots have no portraits: they are machines run by the AI core, not crew; the crew bar leaves them out)

Packed like any static family (pack.py): sheet `portraits`, assets `portrait.<crew layer id>` (kind static). Run alone:
  npm run sprites -- public/assets/1x portraits"""
import math
import time
import bpy
import numpy as np
from mathutils import Vector
from . import core, post, pack
from . import human_render as hr

PPU = 125               # px per world unit (the iso camera has 45): the human head comes out about 38 px tall
TILT = 4                # degrees the camera looks down
FRAME = (56, 60)        # portrait frame in px (the sheet cell is this plus the 1 px pad on each side)
FRONT = 2               # direction index whose azimuth is 0 (hr.THETA): the character faces the camera
SKIN_RX = 8.0           # lighten_skin's ellipse, in iso px (scaled by PPU / iso PXU)
ISO_PXU = 64 / math.sqrt(2)


def _aim(target, ppu):
    """Put the camera in front of `target` (Blender world, the character faces -Y), looking a little down."""
    cam = core._state["cam"]
    core.PXU = ppu
    t = math.radians(TILT)
    cam.rotation_euler = (math.radians(90 - TILT), 0, 0)
    cam.location = Vector(target) + Vector((0, -30 * math.cos(t), 30 * math.sin(t)))


def _item(sid, rgba, g):
    return {"id": f"portrait.{sid}", "fp": (1, 1), "rgba": rgba, "g": g if g is not None else np.zeros_like(rgba), "ax": 0, "ay": 0}


def _render(finish):
    W, H = FRAME
    rgb, a = core.render(W, H, "color", (W / 2, H / 2))
    c, op = hr._opaque(rgb, a)
    c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    return finish(post.to_rgba(c, op))


def _glow():
    W, H = FRAME
    grgb, _ = core.render(W, H, "glow", (W / 2, H / 2))
    g = np.pad(post.glow_down(grgb, core.SS), ((1, 1), (1, 1), (0, 0)))
    return g if g[..., 3].any() else None


def _head_px(arm):
    """Head bone (head, tail) in padded frame px, from the camera."""
    from bpy_extras.object_utils import world_to_camera_view
    sc, cam, mw, W, H = bpy.context.scene, core._state["cam"], arm.matrix_world, *FRAME
    out = []
    for p in (arm.pose.bones["head"].head, arm.pose.bones["head"].tail):
        v = world_to_camera_view(sc, cam, mw @ p)
        out.append((v.x * W + 1, (1 - v.y) * H + 1))
    return out


def _skin(rgb, a, head, k):
    """hr.lighten_skin at portrait scale: skin pixels round the head go one shade step lighter (a soft ellipse)."""
    (x0, y0), (x1, y1) = head
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ry = abs(y1 - y0) * 0.62 + 2 * k
    yy, xx = np.mgrid[:rgb.shape[0], :rgb.shape[1]]
    inside = (((xx - cx) / (SKIN_RX * k)) ** 2 + ((yy - cy) / ry) ** 2) < 1
    keys = post.KEYS.astype(np.uint8)
    t = post.TEAMS.index("team.skin")
    out = rgb.copy()
    for lv in range(4):
        out[inside & (a > 0) & (rgb == keys[t * 5 + lv]).all(-1)] = keys[t * 5 + lv + 1]
    return out


def humans(log):
    from . import human_items, human_suit as suit
    arm, items = human_items.build_items()
    arm.rotation_euler = (0, 0, math.radians(hr.THETA[FRONT]))
    hr.pose_frame(arm, "idle", 0, "idle_Armature", 0)
    bpy.context.view_layer.update()
    pb, mw = arm.pose.bones, arm.matrix_world
    h0, h1 = Vector(mw @ pb["head"].head), Vector(mw @ pb["head"].tail)
    _aim(h0 + (h1 - h0) * 0.9, PPU)
    bpy.context.view_layer.update()
    head, k = _head_px(arm), PPU / ISO_PXU
    out = []
    for it in items:
        if suit.is_eva(it) or it.slot == "gear.hand":
            continue
        hold = hr.hold_set(it, items)
        hr.set_state(items, [it], hold)

        def finish(rgba, it=it):
            if it.slot == "body":                      # same finishing as the clip sheets, at this scale
                rgba[..., :3] = _skin(rgba[..., :3], rgba[..., 3], head, k)
            return _finish(it, rgba)
        rgba = _render(finish)
        g = None
        if it.glow:
            hr.set_state(items, [it], hold)
            g = _glow()
        out.append(_item(it.id, rgba, g))
    log(f"PORTRAITS humans {len(out)} layers")
    return out


def _finish(it, rgba):
    """hr.finish minus the head highlight (done above, at portrait scale)."""
    far = ((-1e4, -1e4), (-1e4, -1e4))
    return hr.finish(it, rgba, far)


def _bbox():
    dg = bpy.context.evaluated_depsgraph_get()
    lo, hi = np.full(3, 1e9), np.full(3, -1e9)
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.hide_render:
            continue
        e = ob.evaluated_get(dg)
        me = e.to_mesh()
        if len(me.vertices):
            co = np.array([v.co[:] for v in me.vertices])
            w = (np.c_[co, np.ones(len(co))] @ np.array(e.matrix_world).T)[:, :3]
            lo, hi = np.minimum(lo, w.min(0)), np.maximum(hi, w.max(0))
        e.to_mesh_clear()
    return lo, hi


def singles(log):
    """Creatures (one body each): the top of the figure, fitted by width."""
    from . import alien, alien_render
    out = []
    for mod, build, sp in ((alien_render, alien.BUILD, None),):
        for kind, make in build.items():
            core.setup_scene()
            post.select(True)
            rig = make()
            rig.root.rotation_euler = (0, 0, math.radians(hr.THETA[FRONT]))
            mod.pose(rig, "idle", 0)
            bpy.context.view_layer.update()
            lo, hi = _bbox()
            ppu = FRAME[0] * 0.92 / max(hi[0] - lo[0], 1e-3)
            top = hi[2] - FRAME[1] / ppu / 2 + 0.04
            _aim(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, top), ppu)
            rgba = _render(lambda r: r)
            species = sp[kind] if sp else "alien"
            out.append(_item(f"crew.{species}.body.{kind}", rgba, _glow()))
    log(f"PORTRAITS creatures {len(out)}")
    return out


def build(out, opts=None, log=print):
    """-> (sheets, assets) of the `portraits` family (merge with pack.merge(manifest, 'portraits', ...))."""
    t0 = time.time()
    pxu = core.PXU
    try:
        items = humans(log) + singles(log)
    finally:
        core.PXU = pxu          # _aim set the portrait scale; later families in this process need the iso one back
    sheets, assets = pack.pack("portraits", items, out, log)
    log(f"PORTRAITS {len(items)} portraits in {time.time() - t0:.1f}s")
    return sheets, assets
