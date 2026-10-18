"""Clean Cycles renders of the combat models for review (runs in Blender): soft shadows, bounce light, bloomed glow.
  blender -b --factory-startup --python tools/blender/review/blender_cells.py -- <cells dir>
Writes <dir>/<id>.png (+ cells.json); blender_sheet.py lays them out with labels."""
import json
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, combat, post  # noqa: E402

OUT = Path(sys.argv[sys.argv.index("--") + 1])
OUT.mkdir(parents=True, exist_ok=True)
Q = 2          # render at Q x the cell size, box-filter down


def blur(a, r):
    k = np.ones(2 * r + 1, np.float32) / (2 * r + 1)
    for _ in range(2):
        a = np.apply_along_axis(lambda m: np.convolve(m, k, "same"), 0, a)
        a = np.apply_along_axis(lambda m: np.convolve(m, k, "same"), 1, a)
    return a


def setup():
    core.setup_scene()
    sc = core._state["scene"]
    c = sc.cycles
    c.samples, c.max_bounces, c.diffuse_bounces, c.filter_width = 32, 3, 2, 1.2
    sc.render.film_transparent = True
    sun = core._state["sun"]
    sun.data.use_shadow = True
    sun.data.angle = 0.12
    core.set_ambient(0.55, (0.8, 0.92, 1.15))


def plane(half):
    m = core.Mesh("deck")
    m.box((0, 0, -0.05), (half * 2, half * 2, 0.05), "plateA", top="steelD", base=True)
    return m.build()


def render_cell(sid, fn, kind, W, H):
    core.clear_scene_meshes()
    objs = fn()
    xmin, xmax, ymin, ymax = core.extent_px(objs)
    wpx, hpx = xmax - xmin, ymax - ymin
    units = max(wpx * 0.78 / (W / H) if kind == "prop" else wpx, hpx * 1.0) * 1.0 / core.PXU
    units = max(wpx / core.PXU * (H / W), hpx / core.PXU) * 1.22 + (0.5 if kind == "prop" else 0.1)
    if kind == "prop":
        plane(5)
    cam = core._state["cam"]
    sc = core._state["scene"]
    sc.render.resolution_x, sc.render.resolution_y = W * Q, H * Q
    cam.data.ortho_scale = units * W / H
    cam.data.sensor_fit = "HORIZONTAL"
    cam.data.shift_x = ((xmin + xmax) / 2 / core.PXU) / cam.data.ortho_scale
    cam.data.shift_y = ((ymin + ymax) / 2 / core.PXU) / cam.data.ortho_scale
    bg = core._state["world"].node_tree.nodes["Background"]
    out = {}
    for which in ("color", "glow"):
        core._set_pass(which)
        bg.inputs["Color"].default_value = (0.045, 0.06, 0.08, 1) if which == "color" else (0, 0, 0, 1)
        bg.inputs["Strength"].default_value = 1.0 if which == "color" else 0.0
        if which == "color":
            core.set_ambient(0.5, (0.8, 0.92, 1.15))
            bg.inputs["Color"].default_value = (0.5 * 0.8, 0.5 * 0.92, 0.5 * 1.15, 1)
            bg.inputs["Strength"].default_value = 1.0
        sc.render.filepath = str(OUT / "_t.png")
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(str(OUT / "_t.png"))
        px = np.empty(len(img.pixels), np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        out[which] = px.reshape(H * Q, W * Q, 4)[::-1]
    return out["color"], out["glow"]


def to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)


def finish(col, glow, kind):
    """col/glow: (H, W, 4) linear RGBA; composited over a dark deck-blue backdrop with a soft vignette."""
    h, w = col.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    bg = np.array([0.012, 0.017, 0.024]) * (1.5 - 0.6 * np.clip(r, 0, 1))[..., None]
    a = col[..., 3:4]
    lin = col[..., :3] * 0.62 + bg * (1 - a)
    g = glow[..., :3]
    halo = blur(g, 10 * Q) * 1.5 + blur(g, 4 * Q) * 0.8
    lin = lin + g * 0.9 + halo
    lin = lin / (1 + 0.2 * lin)
    img = to_srgb(lin * 1.1)
    img = img.reshape(h // Q, Q, w // Q, Q, 3).mean((1, 3))
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def pick():
    """(id, label, kind, fn, W, H) to render."""
    S = {s[0]: s for s in combat.SPRITES}
    want = []
    for n in ("burst_laser", "mass_driver", "missile_launcher", "ion_cannon", "incendiary_launcher"):
        want += [f"module.{n}.r1", f"module.{n}.r1.charged"]
    want += ["module.engine.r1", "module.engine.r1.active", "module.shield_gen.r1", "module.shield_gen_small", "module.weapons_console",
             "module.shield_console", "module.helm", "module.ai_core", "roof.generic.m15", "roof.generic.m6", "roof.weapon.m15",
             "roof.shield.m15", "roof.engine.m15"]
    out = []
    for sid in want:
        out.append((sid, S[sid][2], S[sid][3], 360, 300))
    fxs = [s for s in combat.SPRITES if s[0].startswith("fx.") and s[0].count(".") >= 2 and not s[0].startswith("fx.muzzle.") or s[0].startswith("fx.muzzle.") and s[0].endswith(".1")]
    fxs = [s for s in fxs if s[0].split(".")[-1].isdigit()]
    for s in fxs:
        out.append((s[0], "fx", s[3], 240, 190))
    return out


def main():
    setup()
    cells = []
    for sid, kind, fn, W, H in pick():
        col, glow = render_cell(sid, fn, "prop" if kind == "prop" else kind, W, H)
        arr = finish(col, glow, kind)
        from sprites import post as _p
        _p.write_png(OUT / f"{sid}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
        cells.append({"id": sid, "kind": kind, "w": W, "h": H})
        print("cell", sid, flush=True)
    (OUT / "cells.json").write_text(json.dumps(cells))


main()
