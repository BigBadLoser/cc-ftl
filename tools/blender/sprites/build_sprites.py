"""Entry point: blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- [outdir] [chars|env|all]

Renders the engineer (8 dirs x idle/walk/work) and the environment kit to pixel-art sprite sheets + JSON.
Variants (suffix): q/r = palette-quantized / raw colour, o/n = with / without outline. Plus a glow sheet."""
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import character as ch  # noqa: E402
from sprites import core, post, props  # noqa: E402

SS = core.SS
DEFAULT_OUT = "/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/pixel-test/sprites"
VARIANTS = [("qo", True, True), ("qn", True, False), ("ro", False, True), ("rn", False, False)]
FPS = {"idle": 3, "walk": 7, "work": 8}


def process(rgb, a, thresh, do_outline, vonly=False, mask=None):
    """-> {variant: (rgb, opaque)} at 1x canvas."""
    out = {}
    for key, quant, line in VARIANTS:
        c, op = post.downsample(rgb, a > 0.5, SS, thresh, quant)
        if mask is not None:
            op = mask
        if line and do_outline:
            c, op = post.outline(c, op, quant, vonly)
        else:
            c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
        out[key] = (c, op)
    return out


def diamond_mask(W, H):
    ys, xs = np.mgrid[0:H, 0:W]
    x, y = xs + 0.5 - W / 2, ys + 0.5 - H / 2
    return np.abs(x) / (core.TILE_W / 2) + np.abs(y) / (core.TILE_H / 2) < 1.0


def pad1(a):
    return np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2))


def build_chars(out):
    core.setup_scene()
    arm, parts = ch.build()
    W, H = 96, 160
    frames = {}   # (dir, clip, i) -> ({variant:(rgb,op)}, glow)
    sc = bpy.context.scene
    for d, theta in enumerate(ch.THETA):
        arm.rotation_euler = (0, 0, math.radians(theta))
        for clip, i, f in ch.frames():
            arm.animation_data.action = bpy.data.actions[f"{clip}_Armature"]
            sc.frame_set(int(f), subframe=f - int(f))
            rgb, a = core.render(W, H, "color")
            v = process(rgb, a, 6, True)
            grgb, _ = core.render(W, H, "glow")
            g = pad1(post.glow_down(grgb, SS))
            frames[(d, clip, i)] = (v, g)
    union = None
    for v, g in frames.values():
        op = v["qo"][1] | (g[..., 3] > 0)
        bb = post.crop_box(op)
        union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
    x0, y0, x1, y1 = union
    cw, chh = x1 - x0, y1 - y0
    ax, ay = (W + 2) // 2 - x0, (H + 2) // 2 - y0
    cols = [(clip, i) for clip, n in ch.CLIPS for i in range(n)]
    sheets = {k: np.zeros((8 * chh, len(cols) * cw, 4), np.uint8) for k, _, _ in VARIANTS}
    glow = np.zeros_like(sheets["qo"])
    for (d, clip, i), (v, g) in frames.items():
        col = cols.index((clip, i))
        sl = (slice(d * chh, (d + 1) * chh), slice(col * cw, (col + 1) * cw))
        for k, _, _ in VARIANTS:
            c, op = v[k]
            sheets[k][sl] = post.to_rgba(c, op)[y0:y1, x0:x1]
        glow[sl] = g[y0:y1, x0:x1]
    clips, start = {}, 0
    for clip, n in ch.CLIPS:
        clips[clip] = {"start": start, "count": n, "fps": FPS[clip]}
        start += n
    for k, _, _ in VARIANTS:
        post.write_png(out / f"engineer.{k}.png", sheets[k])
    post.write_png(out / "engineer.glow.png", glow)
    meta = {"id": "engineer", "cell": [int(cw), int(chh)], "anchor": [int(ax), int(ay)], "dirs": ch.DIRS,
            "cols": len(cols), "clips": clips, "variants": [k for k, _, _ in VARIANTS], "glow": "engineer.glow.png",
            "frames": [{"dir": ch.DIRS[d], "clip": clip, "i": i, "x": cols.index((clip, i)) * int(cw), "y": d * int(chh),
                        "w": int(cw), "h": int(chh)} for (d, clip, i) in frames],
            "heightPx": int(ay - 1)}
    (out / "engineer.json").write_text(json.dumps(meta))
    print("CHAR cell", cw, chh, "anchor", ax, ay, "sheet", sheets["qo"].shape[1], sheets["qo"].shape[0])


def build_env(out):
    core.setup_scene()
    items = []
    for sid, fp, kind, fn in props.SPRITES:
        core.clear_scene_meshes()
        objs = fn()
        xmin, xmax, ymin, ymax = core.extent_px(objs)
        W = 2 * (int(math.ceil(max(-xmin, xmax))) + 4)
        H = 2 * (int(math.ceil(max(-ymin, ymax))) + 4)
        rgb, a = core.render(W, H, "color")
        mask = diamond_mask(W, H) if kind == "floor" else None
        v = process(rgb, a, 8, kind != "floor", vonly=(kind in ("wall", "light")), mask=mask)
        grgb, _ = core.render(W, H, "glow")
        g = pad1(post.glow_down(grgb, SS, 3))
        op = v["qo"][1] | (g[..., 3] > 0)
        x0, y0, x1, y1 = post.crop_box(op)
        items.append({"id": sid, "fp": fp, "kind": kind, "v": {k: (c[y0:y1, x0:x1], o[y0:y1, x0:x1]) for k, (c, o) in v.items()},
                      "g": g[y0:y1, x0:x1], "ax": (W + 2) // 2 - x0, "ay": (H + 2) // 2 - y0})
    # shelf pack
    AW, x, y, rowh = 1024, 1, 1, 0
    for it in items:
        h, w = it["g"].shape[:2]
        if x + w + 1 > AW:
            x, y, rowh = 1, y + rowh + 1, 0
        it["x"], it["y"] = x, y
        x += w + 1
        rowh = max(rowh, h)
    AH = y + rowh + 1
    atlas = {k: np.zeros((AH, AW, 4), np.uint8) for k, _, _ in VARIANTS}
    gl = np.zeros((AH, AW, 4), np.uint8)
    meta = []
    for it in items:
        h, w = it["g"].shape[:2]
        for k, _, _ in VARIANTS:
            c, o = it["v"][k]
            atlas[k][it["y"]:it["y"] + h, it["x"]:it["x"] + w] = post.to_rgba(c, o)
        gl[it["y"]:it["y"] + h, it["x"]:it["x"] + w] = it["g"]
        meta.append({"id": it["id"], "kind": it["kind"], "footprint": list(it["fp"]), "x": it["x"], "y": it["y"], "w": w, "h": h,
                     "ax": int(it["ax"]), "ay": int(it["ay"]), "glow": bool(it["g"][..., 3].any())})
    for k, _, _ in VARIANTS:
        post.write_png(out / f"env.{k}.png", atlas[k])
    post.write_png(out / "env.glow.png", gl)
    (out / "env.json").write_text(json.dumps({"tile": [core.TILE_W, core.TILE_H], "sprites": meta}))
    print("ENV atlas", AW, AH, [(m["id"], m["w"], m["h"]) for m in meta])


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[0] if argv else DEFAULT_OUT)
    what = argv[1] if len(argv) > 1 else "all"
    out.mkdir(parents=True, exist_ok=True)
    if what in ("env", "all"):
        build_env(out)
    if what in ("chars", "all"):
        build_chars(out)


main()
