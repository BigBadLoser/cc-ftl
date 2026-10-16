"""Environment sprites -> one atlas (sprites/env.png + env.glow.png) and StaticAsset manifest entries.

Outlines: floors and wall/door blocks none (blocks fill the footprint and tile into one mass; panel seams, skirting
and a top lip are modelled instead); props a normal 1px ring."""
import math
import bpy
import numpy as np
from mathutils import Vector
from . import core, post, props

SS = core.SS


def diamond_mask(W, H):
    ys, xs = np.mgrid[0:H, 0:W]
    x, y = xs + 0.5 - W / 2, ys + 0.5 - H / 2
    return np.abs(x) / (core.TILE_W / 2) + np.abs(y) / (core.TILE_H / 2) < 1.0


def _pad1(a):
    return np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2))


def _alpha_cnt(a):
    return post.blocks(a > 0.5, SS).sum(-1)


def render_sprite(sid, kind, objs):
    xmin, xmax, ymin, ymax = core.extent_px(objs)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, SS, 8, True)
    if kind == "floor":
        op = diamond_mask(W, H)
        c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    elif kind == "block":
        c, op = _pad1(c), _pad1(op)
    else:
        c, op = post.outline(c, op, True)
    grgb, _ = core.render(W, H, "glow")
    g = _pad1(post.glow_down(grgb, SS, 3))
    return c, op, g, (W + 2) // 2, (H + 2) // 2


def build(out, only=None, log=print):
    items = []
    for sid, fp, kind, fn in props.SPRITES:
        if only and not any(o in sid for o in only):
            continue
        core.clear_scene_meshes()
        c, op, g, ox, oy = render_sprite(sid, kind, fn())
        x0, y0, x1, y1 = post.crop_box(op | (g[..., 3] > 0))
        items.append({"id": sid, "fp": fp, "rgba": post.to_rgba(c, op)[y0:y1, x0:x1], "g": g[y0:y1, x0:x1],
                      "ax": ox - x0, "ay": oy - y0})
    AW, x, y, rowh = 1024, 1, 1, 0
    for it in items:
        h, w = it["g"].shape[:2]
        if x + w + 1 > AW:
            x, y, rowh = 1, y + rowh + 1, 0
        it["x"], it["y"] = x, y
        x += w + 1
        rowh = max(rowh, h)
    AH = y + rowh + 1
    atlas = np.zeros((AH, AW, 4), np.uint8)
    glow = np.zeros_like(atlas)
    assets = {}
    for it in items:
        h, w = it["g"].shape[:2]
        atlas[it["y"]:it["y"] + h, it["x"]:it["x"] + w] = it["rgba"]
        glow[it["y"]:it["y"] + h, it["x"]:it["x"] + w] = it["g"]
        a = {"kind": "static", "sheet": "env", "frame": {"x": it["x"], "y": it["y"], "w": w, "h": h},
             "anchor": {"x": int(it["ax"]), "y": int(it["ay"])}, "footprint": list(it["fp"])}
        if it["g"][..., 3].any():
            a["glow"] = True
        assets[it["id"]] = a
    (out / "sprites").mkdir(parents=True, exist_ok=True)
    post.write_png(out / "sprites/env.png", atlas)
    post.write_png(out / "sprites/env.glow.png", glow)
    log(f"ENV atlas {AW}x{AH}, {len(items)} sprites")
    return {"env": {"image": "sprites/env.png", "glow": "sprites/env.glow.png"}}, assets
