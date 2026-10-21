"""One crew frame (default outfit + tee, idle frame 0, facing S, plus a sit_idle frame with the chair) in Cycles and Workbench:
blender -b --factory-startup --python crew_compare.py -- OUTDIR. Writes OUTDIR/<engine>/<clip>.npy (composited RGBA) and timings."""
import math
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
from sprites import core, post, crew_clips as clips, crew_spec as cs, human_items
from sprites import human_render as hr
import wb

out = Path(sys.argv[sys.argv.index("--") + 1])
arm, items = human_items.build_items()
chair = hr.chair_holdout()
wb.setup()
real = core.render
frames = {(c, i): (n, f) for c, i, n, f in clips.clip_frames()}
show = [it for it in items if it.default or it.id.endswith("torso.tee")]
show.sort(key=lambda i: i.order)
print("CREW layers", [i.id for i in show], flush=True)


def comp(layers):
    h, w = layers[0][0].shape[:2]
    cv = np.zeros((h, w, 4), float)
    for rgba, g in layers:
        a = rgba[..., 3:4] / 255.0
        cv[..., :3] = rgba[..., :3] * a + cv[..., :3] * (1 - a)
        cv[..., 3:] = np.maximum(cv[..., 3:], rgba[..., 3:])
    return cv.astype(np.uint8)


for clip, d in (("idle", 1), ("sit_idle", 2)):
    name, f = frames[(clip, 0)]
    for eng, r in (("cycles", real), ("workbench", wb.render)):
        core.render = r
        arm.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
        hr.pose_frame(arm, clip, 0, name, f)
        p = clips.pose_of(clip)
        hr._PUFFS.clear()
        head = hr.head_px(arm)
        chair.hide_render, chair.rotation_euler = not p.chair, arm.rotation_euler
        t = time.perf_counter()
        layers = [hr.render_item(it, items, head, chair=chair if p.chair else None) for it in show]
        dt = time.perf_counter() - t
        (out / eng).mkdir(parents=True, exist_ok=True)
        np.save(out / eng / f"{clip}.npy", comp(layers))
        print(f"CREWCMP {clip} {eng} {dt:.2f}s for {len(show)} layers ({dt/len(show):.2f}s/layer)", flush=True)
