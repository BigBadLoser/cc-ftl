"""Environment sprites -> one atlas (sprites/env.png + env.glow.png) and StaticAsset manifest entries.

Outlines: floors and wall/door blocks none (blocks fill the footprint and tile into one mass); props a normal 1px ring."""
import math
import bpy
import numpy as np
from mathutils import Vector
from . import core, post, props, envtiles, logistics, combat
from . import items as itemart

SS = core.SS


def diamond_mask(W, H):
    ys, xs = np.mgrid[0:H, 0:W]
    x, y = xs + 0.5 - W / 2, ys + 0.5 - H / 2
    return np.abs(x) / (core.TILE_W / 2) + np.abs(y) / (core.TILE_H / 2) < 1.0


def _pad1(a):
    return np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2))


def _alpha_cnt(a):
    return post.blocks(a > 0.5, SS).sum(-1)


def render_ghost(objs, W, H):
    """objs = [plate, glass]. Plate: opaque palette-quantized floor plate. Glass: separate pass, never quantized or
    outlined; its brightness becomes alpha over a pale tint. Returns (rgb, alpha uint8, padded)."""
    plate, glass = objs
    glass.hide_render = True
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, SS, 8, True)
    glass.hide_render, plate.hide_render = False, True
    rgb2, a2 = core.render(W, H, "color")
    plate.hide_render = False
    cov = post.blocks(a2 > 0.5, SS)
    cnt = cov.sum(-1)
    lum = (post.blocks(rgb2.mean(-1), SS) * cov).sum(-1) / np.maximum(cnt, 1)
    ga = np.where(cnt >= 3, np.clip(lum / 255.0 * 0.65, 0, 0.9), 0.0)    # low threshold: thin lines stay unbroken
    tint = np.array([200.0, 214.0, 232.0])
    out = np.where(op[..., None], c.astype(float), tint)
    mixed = np.where(op[..., None], c * (1 - ga[..., None]) + tint * ga[..., None], tint)
    alpha = np.where(op, 255, np.round(ga * 255)).astype(np.uint8)
    return mixed.astype(np.uint8), alpha


def render_sprite(sid, kind, objs):
    if kind == "ghost":
        xs = core.extent_px(objs)
        xmin, xmax, ymin, ymax = xs
        W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
        H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
        c, al = render_ghost(objs, W, H)
        c, al = _pad1(c), np.pad(al, 1)
        z = np.zeros((H + 2, W + 2, 4), np.uint8)
        return c, al > 0, z, (W + 2) // 2, (H + 2) // 2, al
    xmin, xmax, ymin, ymax = core.extent_px(objs)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, SS, 8, True)
    if kind == "floor":
        op = diamond_mask(W, H)
        c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    elif kind in ("block", "fx", "ghost"):
        c, op = _pad1(c), _pad1(op)
    else:
        c, op = post.outline(c, op, True)
    grgb, _ = core.render(W, H, "glow")
    g = _pad1(post.glow_down(grgb, SS, 3))
    return c, op, g, (W + 2) // 2, (H + 2) // 2, None


def build(out, only=None, log=print):
    items = []
    new = {x[0] for x in combat.SPRITES}
    for sid, fp, kind, fn in envtiles.SPRITES + props.SPRITES + logistics.SPRITES + itemart.SPRITES + combat.SPRITES:
        if only and not any(o in sid for o in only):
            continue
        core.clear_scene_meshes()
        post.select(sid in new or sid.startswith(("tile.wall", "tile.hull", "tile.door")))
        c, op, g, ox, oy, al = render_sprite(sid, kind, fn())
        vis = op | (g[..., 3] > 0)
        if not vis.any():
            continue                                    # nothing visible (e.g. a corner ghost with no belly): no sprite
        x0, y0, x1, y1 = post.crop_box(vis)
        rgba = post.to_rgba(c, op)
        if al is not None:
            rgba[..., 3] = al
        items.append({"id": sid, "fp": fp, "rgba": rgba[y0:y1, x0:x1], "g": g[y0:y1, x0:x1],
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
