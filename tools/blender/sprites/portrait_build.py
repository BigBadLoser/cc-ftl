"""Crew portraits (prototype): one front-facing, eye-level render of every human layer, in one fixed frame.

  blender -b --factory-startup --python tools/blender/sprites/portrait_build.py -- <outdir> [--item S[,S]] [--ppu N]

Not the isometric camera: an orthographic camera looking horizontally (a few degrees down) at the character's face, framed on
the head and shoulders. The pose is idle frame 0, facing the camera. Every layer is rendered in the same frame, so the
layers stack exactly like the clip sheets (palette-swap key colours, same holdout rules as human_render). Writes
<outdir>/<layer id>.png (+ .glow.png) and <outdir>/portraits.json {frame, layers}."""
import json
import math
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from sprites import core, post, human_items, human_render as hr, human_suit as suit  # noqa: E402

PPU = 125               # px per world unit (the iso camera has 45): the head comes out about 38 px tall
TILT = 4                # degrees the camera looks down
FRAME = (56, 60)        # portrait frame, px (w, h); the bar shows it 1:1 (pixelated, so a whole device-pixel multiple)
EYE_UP = 0.30           # frame centre sits this fraction of a head length above the head bone's head


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[0])
    opts = {argv[i]: argv[i + 1] for i in range(1, len(argv) - 1, 2)}
    only = [s for s in opts.get("--item", "").split(",") if s]
    ppu = float(opts.get("--ppu", PPU))
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    arm, items = human_items.build_items()
    core.PXU = ppu                                         # the renderer's px per ortho unit
    cam = core._state["cam"]
    arm.rotation_euler = (0, 0, 0)                          # faces -Y, at the camera
    hr.pose_frame(arm, "idle", 0, "idle_Armature", 0)
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    pb = arm.pose.bones
    h0, h1 = Vector(mw @ pb["head"].head), Vector(mw @ pb["head"].tail)
    head_len = (h1 - h0).length
    target = h0 + (h1 - h0) * 0.9
    tilt = math.radians(TILT)
    cam.rotation_euler = (math.radians(90 - TILT), 0, 0)
    cam.location = target + Vector((0, -30 * math.cos(tilt), 30 * math.sin(tilt)))
    W, H = FRAME
    layers = {}
    wanted = [it for it in items if not suit.is_eva(it) and it.slot != "gear.hand" and (not only or any(s in it.id for s in only))]
    far = ((-1e4, -1e4), (-1e4, -1e4))
    for n, it in enumerate(wanted):
        hold = hr.hold_set(it, items)
        hr.set_state(items, [it], hold)
        rgb, a = core.render(W, H, "color", (W / 2, H / 2))
        c, op = hr._opaque(rgb, a)
        c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
        rgba = hr.finish(it, post.to_rgba(c, op), far)
        has_glow = False
        if it.glow:
            hr.set_state(items, [it], hold)
            grgb, _ = core.render(W, H, "glow", (W / 2, H / 2))
            g = np.pad(post.glow_down(grgb, core.SS), ((1, 1), (1, 1), (0, 0)))
            has_glow = bool(g[..., 3].any()) if g.shape[-1] == 4 else bool(g.any())
            if has_glow:
                post.write_png(out / f"{it.id}.glow.png", g)
        post.write_png(out / f"{it.id}.png", rgba)
        layers[it.id] = {"slot": it.slot, "order": it.order, "glow": has_glow}
        print(f"portrait {n + 1}/{len(wanted)} {it.id}", flush=True)
    meta = {"w": W + 2, "h": H + 2, "ppu": ppu, "headPx": round(head_len * ppu, 1), "layers": layers}
    (out / "portraits.json").write_text(json.dumps(meta, indent=1))
    print(f"PORTRAITS {len(wanted)} layers in {time.time() - t0:.1f}s; head bone {head_len * ppu:.1f} px; frame {W + 2}x{H + 2}", flush=True)


main()
