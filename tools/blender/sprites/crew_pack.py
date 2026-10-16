"""Packs rendered human layers into per-layer sheets (8 direction rows x all clip frames) + glow twins, and returns
the manifest fragments. All layers share one frame size and anchor so they stack exactly."""
import numpy as np
from . import human_render as hr
from . import post

KEY_COLORS = {"team.skin": "#ff00ff", "team.hair": "#00ff00", "team.cloth": "#ffff00", "team.accent": "#00ffff"}


def union_box(res):
    box = None
    for frames in res.values():
        for rgba, g in frames.values():
            op = rgba[..., 3] > 0
            if g is not None:
                op = op | (g[..., 3] > 0)
            if not op.any():
                continue
            b = post.crop_box(op)
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def pack(items, res, cols, outdir, log=print):
    """Writes sprites/crew.human.*.png (+ .glow.png). Returns (sheets, assets) manifest maps."""
    x0, y0, x1, y1 = union_box(res)
    cw, ch = int(x1 - x0), int(y1 - y0)
    ax, ay = hr.ORIGIN[0] + 1 - x0, hr.ORIGIN[1] + 1 - y0
    clips, start = {}, 0
    for clip, n, fps, loop in hr.CLIPS:
        clips[clip] = {"start": start, "frames": n, "fps": fps, "loop": loop}
        start += n
    sheets, assets, total = {}, {}, 0
    (outdir / "sprites").mkdir(parents=True, exist_ok=True)
    for k, it in enumerate(items):
        sheet = np.zeros((8 * ch, len(cols) * cw, 4), np.uint8)
        glow = np.zeros_like(sheet)
        for (d, col), (rgba, g) in res[k].items():
            sl = (slice(d * ch, (d + 1) * ch), slice(col * cw, (col + 1) * cw))
            sheet[sl] = rgba[y0:y1, x0:x1]
            if g is not None:
                glow[sl] = g[y0:y1, x0:x1]
        has_glow = bool(glow[..., 3].any())
        path = f"sprites/{it.id}.png"
        post.write_png(outdir / path, sheet)
        total += (outdir / path).stat().st_size
        sd = {"image": path}
        if has_glow:
            gp = f"sprites/{it.id}.glow.png"
            post.write_png(outdir / gp, glow)
            total += (outdir / gp).stat().st_size
            sd["glow"] = gp
        sheets[it.id] = sd
        a = {"kind": "crew.layer", "species": "human", "slot": it.slot, "order": it.order, "sheet": it.id,
             "frameW": cw, "frameH": ch, "anchor": {"x": int(ax), "y": int(ay)}, "clips": clips}
        if has_glow:
            a["glow"] = True
        assets[it.id] = a
    log(f"CREW cell {cw}x{ch} anchor {ax},{ay} sheet {len(cols) * cw}x{8 * ch} layers {len(items)} bytes {total}")
    return sheets, assets
