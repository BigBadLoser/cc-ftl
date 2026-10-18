"""Shuttle review renders (runs in Blender). Writes pixel sprites as .npz (rgba, glow, ox, oy) + .png into <out>, plus
an optional beauty cell and the overlap check. shuttle_composite.py then lays them out on real floor tiles.
  blender -b --factory-startup --python tools/blender/review/shuttle_preview.py -- <out> [options]
Options: --parked 0,1,2,3   --fly 0,1,2   --docked 0,1,2,3   --pit (parked r0 sunk in the placeholder pit)
         --damaged   --cells parked.r2,fly.d5 (Blender beauty cells)   --check   --samples N (default 32)   --pit-depth D"""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sprites import core, post, env_build, cmbkit, overlap, shuttle_craft as S  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)


def opt(name, default=None):
    if name in args:
        i = args.index(name)
        return args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith("--") else True
    return default


SAMPLES = int(opt("--samples", 32))
PIT = float(opt("--pit-depth", S.PIT_SUGGESTED))


def ints(v):
    return [int(x) for x in str(v).split(",")] if v not in (None, True) else []


def pixel_sprite(tag, fn):
    core.setup_scene()
    core._state["scene"].cycles.samples = SAMPLES
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite(tag, "prop", fn())
    rgba = post.to_rgba(c, op)
    np.savez(OUT / f"px_{tag}.npz", rgba=rgba, glow=g, ox=ox, oy=oy)
    view = rgba.copy()                                   # png with the glow added, for a direct look
    on = g[..., 3] > 0
    view[..., :3][on] = np.minimum(255, view[..., :3][on].astype(int) + g[..., :3][on].astype(int)).astype(np.uint8)
    view[..., 3][on] = 255
    post.write_png(OUT / f"px_{tag}.png", view)
    print("pixel", tag, rgba.shape, "origin", ox, oy, flush=True)


def check(rot):
    """Overlap + floating-part report for the parked craft (axis-aligned headings only) on a pad."""
    rec = cmbkit.REC = overlap.Recorder()
    rec.group = "deck"
    rec.add({"kind": "box", "lo": [-2.5, -2.5, -0.05], "hi": [2.5, 2.5, 0.0], "src": "pad"})
    f = S.Spin(core.Mesh("chk"), S.rot_heading(rot))
    S.body(f, True, "dark", damaged="--damaged" in args)
    S.livery(S.Spin(core.Mesh("chk_lv", flat=True), S.rot_heading(rot)))
    cmbkit.REC = None
    print(f"== overlap check, parked r{rot}: {len(rec.parts)} parts")
    overlap.report(rec.parts, S.ALLOW)
    overlap.floating(rec.parts, anchors=("deck",))


def cell(tag, fn):
    import blender_cells as cells
    cells.OUT = OUT
    cells.setup()
    core._state["scene"].cycles.samples = 64
    try:
        core._state["scene"].cycles.use_denoising = True
    except Exception:
        pass
    col, glow = cells.render_cell(tag, fn, "prop", 760, 560)
    arr = cells.finish(col, glow, "prop")
    post.write_png(OUT / f"blender_{tag}.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
    print("cell", tag, flush=True)


def main():
    dmg = "--damaged" in args
    sfx = ".damaged" if dmg else ""
    if "--check" in args:
        for r in (0, 1):
            check(r)
    for r in ints(opt("--parked")):
        pixel_sprite(f"parked.r{r}{sfx}", lambda r=r: S.shuttle(S.rot_heading(r), "parked", dmg))
    for d in ints(opt("--fly")):
        pixel_sprite(f"fly.d{d}{sfx}", lambda d=d: S.shuttle(S.fly_heading(d), "fly", dmg))
    for r in ints(opt("--docked")):
        pixel_sprite(f"docked.r{r}{sfx}", lambda r=r: S.shuttle(S.rot_heading(r), "docked", dmg))
    if "--pit" in args:
        pixel_sprite(f"pit.r0{sfx}", lambda: S.pit(PIT) + S.shuttle(S.rot_heading(0), "parked", dmg, dz=-PIT))
    for tag in str(opt("--cells", "")).split(","):                                # e.g. --cells parked.r2,fly.d5
        if tag:
            state, k = tag.split(".")
            heading = S.rot_heading(int(k[1])) if k[0] == "r" else S.fly_heading(int(k[1]))
            cell(f"{tag}{sfx}", lambda: S.shuttle(heading, state, dmg))


main()
