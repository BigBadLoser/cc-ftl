"""Research bench (family `research_bench`): `module.research`, the approved look study c1 (research_r9.py, built on
research_r6..r8; the kit is research_kit.py) as a 3x2 module, four rotations (modkit.K, front = +v; the chair is the
middle front tile). Sprites per rotation r (`.rN` from r1; r0 has no suffix): the bench idle, and `.active` (someone
works it): the same bench with its translucent hologram composited over it. Partial alpha survives the pipeline
(hydroponics glass already uses it), so the hologram is baked into `.active` rather than drawn as an overlay.
`.damaged`, `.damaged.flicker` and `.destroyed` come from damage.py (bases) off the idle build.

Seated crew work it as at a console: the chair is console_proto.chair (same shape and place, so the sit clips' baked chair
holdout matches it; only its cushions are the bench's colour), and `module.research.front.r<r>` (+ `.active`) is the
desk-front overlay drawn over the seated crew (consoles.py: the sprite's pixels where the bench hides a seated crew
member in some sit frame, grown 1 px over the outline ring). The full sprite keeps every pixel; its glow leaves out
the overlay's share. Layering in the renderer: bench at K, crew at the chair tile at K + 0.02, overlay at K + 0.03."""
import math

import bpy
import numpy as np

from . import console_proto as C
from . import consoles as CO
from . import core, env_build as E, post
from .cmbkit import Frame
from .modkit import K
from .research_kit import FP, holo_item
from .research_r7 import PUCKS, bench
from .research_r9 import _combo, c1_holo

PAL = "research"
PAD = 16                                            # canvas margin for the hologram, px
BENCH = bench("c1", PUCKS, _combo, right=False, open_top=True, seat=False)
HOLO = c1_holo
CUSHION = {"navy": "rust"}                          # the chair's pad in the bench's colour


class _Chair(Frame):
    def poly(self, pts, color, flip=False):
        super().poly(pts, CUSHION.get(color, color), flip)


def footprint(rot):
    return FP if rot % 2 == 0 else (FP[1], FP[0])


def sprite_id(rot, active=False):
    return "module.research" + ("" if rot == 0 else f".r{rot}") + (".active" if active else "")


def chair_xy(rot):
    """The chair tile (local u 0, v +0.5) relative to the sprite origin, in grid units."""
    return K("research_chair_xy", FP, rot).p(0.0, 0.5)


def chair(rot):
    """console_proto's swivel chair on the chair tile, facing the desk (grid -y at r0, as the consoles' SEAT_DIR)."""
    m = core.Mesh(f"research_chair_{rot}")
    C.chair(_Chair(m, rot, centre=chair_xy(rot)), 0.0, 0.0, False)
    return m.build()


def build(rot=0):
    """The idle bench's objects: the bench and its chair (last)."""
    return BENCH("on", rot) + [chair(rot)]


def drop(objs):
    """Remove built objects from the scene (not clear_scene_meshes: that would take the sit rig with it)."""
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def occluders(rot, W, H):
    """(hit, seen) as consoles._occluders: pixels where the bench (not its chair) hides the seated cast in any sit
    frame, and where the crew shows in front of it. The bench is built here, after the rig (building it clears
    the scene)."""
    hr, (arm, items) = CO._rig()
    objs = build(rot)
    by = {it.id: it for it in items}
    cx, cy = chair_xy(rot)
    hit = np.zeros((H + 2, W + 2), bool)
    seen = hit.copy()
    for clip, n, _, _ in [c for c in hr.CLIPS if c[0].startswith("sit")]:
        for i in range(n):
            arm.rotation_euler = (0, 0, math.radians(hr.THETA[CO.SEAT_DIR[rot]]))
            hr.pose_frame(arm, clip, i, "idle_Armature", 0)
            arm.location = (cx, -cy, 0)
            for cast in CO.SIT_CAST:
                hr.set_state(items, [by["crew.human." + c] for c in cast], [])
                vis = []
                for desk in (False, True):
                    for k, o in enumerate(objs):
                        o.is_holdout, o.hide_render = True, k == len(objs) - 1 or not desk
                    rgb, a = core.render(W, H, "color")
                    vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
                hit |= vis[0] & ~vis[1]
                seen |= vis[1]
    arm.location = (0, 0, 0)
    hr.set_state(items, [], [])
    drop(objs)
    return hit, seen


def over(base, top):
    """Item `top` (straight alpha) alpha-composited over `base` (same keys: rgba (h,w,4), g, ax, ay), anchors aligned; the
    blended px are snapped back to the palette and the glow layers are merged (per channel max)."""
    x0 = -max(base["ax"], top["ax"])
    y0 = -max(base["ay"], top["ay"])
    x1 = max(base["rgba"].shape[1] - base["ax"], top["rgba"].shape[1] - top["ax"])
    y1 = max(base["rgba"].shape[0] - base["ay"], top["rgba"].shape[0] - top["ay"])
    W, H = x1 - x0, y1 - y0

    def put(it, key, ch):
        out = np.zeros((H, W, ch), np.uint8)
        h, w = it[key].shape[:2]
        ox, oy = -it["ax"] - x0, -it["ay"] - y0
        out[oy:oy + h, ox:ox + w] = it[key]
        return out

    a, b = put(base, "rgba", 4).astype(np.float32), put(top, "rgba", 4).astype(np.float32)
    ab, bb = a[..., 3:] / 255, b[..., 3:] / 255
    oa = bb + ab * (1 - bb)
    rgb = np.where(oa > 0, (b[..., :3] * bb + a[..., :3] * ab * (1 - bb)) / np.maximum(oa, 1e-6), 0)
    mixed = (bb[..., 0] > 0) & (ab[..., 0] > 0)                    # a hologram px over a bench px: a new colour
    if mixed.any():
        rgb[mixed] = post.PALETTE[post.quantize(rgb[mixed])]
    rgba = np.concatenate([rgb, oa * 255], -1).round().astype(np.uint8)
    g = np.maximum(put(base, "g", 4), put(top, "g", 4))
    return {"id": top["id"], "fp": base["fp"], "rgba": rgba, "g": g, "ax": -x0, "ay": -y0}


def items(rot):
    """The idle and `.active` sprites of one rotation and their front overlays."""
    CO._rig()                                         # (the rig first: building it clears the scene)
    post.select(PAL)
    fp = footprint(rot)
    objs = build(rot)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", objs)
    W, H = op.shape[1] - 2, op.shape[0] - 2
    rgb, a = core.render(W, H, "color")
    ring = op & ~np.pad(post.downsample(rgb, a > 0.5, core.SS, 8, False)[1], 1)      # the sprite's outline pixels
    drop(objs)
    hit, seen = occluders(rot, W, H)
    near = hit.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        near |= np.roll(hit, (dy, dx), (0, 1))
    front = hit | (near & (ring | ~seen))
    mask, hobjs = build(rot), HOLO(rot).build()
    holo = holo_item("holo", fp, mask, hobjs)
    drop(mask + hobjs)
    pad = lambda a: np.pad(a, ((PAD, PAD), (PAD, PAD)) + ((0, 0),) * (a.ndim - 2))   # noqa: E731
    c, op, g, front = pad(c), pad(op), pad(g), pad(front)
    ox, oy = ox + PAD, oy + PAD
    rgba = np.dstack([c, (op * 255).astype(np.uint8)])
    full = {"rgba": rgba, "g": g, "ax": ox, "ay": oy, "fp": fp, "id": "x"}
    act = over(full, holo) if holo else full
    # the active canvas is full's (cropped to what shows); put it back on full's grid for the mask
    out = []
    for item, tag in ((full, ""), (act, ".active")):
        cv = np.zeros(full["rgba"].shape, np.uint8)
        gv = np.zeros(full["g"].shape, np.uint8)
        h, w = item["rgba"].shape[:2]
        x0, y0 = ox - item["ax"], oy - item["ay"]
        ys, xs = max(0, y0), max(0, x0)
        ye, xe = min(cv.shape[0], y0 + h), min(cv.shape[1], x0 + w)
        cv[ys:ye, xs:xe] = item["rgba"][ys - y0:ye - y0, xs - x0:xe - x0]
        gv[ys:ye, xs:xe] = item["g"][ys - y0:ye - y0, xs - x0:xe - x0]
        al = cv[..., 3]
        fr = (al > 0) & front
        gb, gf = gv.copy(), gv.copy()
        gb[fr] = 0
        gf[~fr] = 0
        sid = sprite_id(rot, bool(tag))
        out.append(E.crop_item(sid, fp, cv[..., :3], al > 0, gb, ox, oy, al))
        if fr.any():
            out.append(E.crop_item(f"module.research.front.r{rot}{tag}", fp, cv[..., :3], fr, gf, ox, oy, np.where(fr, al, 0)))
    return out


def job(rot):
    """The sprites of one rotation."""
    def run(rot=rot):
        return items(rot)
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
