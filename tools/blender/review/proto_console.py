"""Console style prototype render (runs in Blender): pixel sprites (idle + active, rot 0 and 1) as .npz, optional Blender cells,
and meta.json (footprint, chair tile, entry tile, per rotation). Composite with proto_console_composite.py.
  blender -b --factory-startup --python tools/blender/review/proto_console.py -- <out dir> [--cell]"""
import json
import sys
from pathlib import Path

import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import console_proto as C
from sprites import core, env_build, post
from sprites.cmbkit import Frame

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def meta(name, rot):
    nu, nv = C.FOOT[name]
    cx, cy = C.centre(rot, nu, nv)
    f = Frame(None, rot, centre=(cx, cy))
    tiles = [(f.xy(-nu / 2 + .5 + i, -nv / 2 + .5 + j), (i, j)) for i in range(nu) for j in range(nv)]
    mnx, mny = min(t[0][0] for t in tiles), min(t[0][1] for t in tiles)
    grid = lambda p: (round(p[0] - mnx), round(p[1] - mny))
    cu, cv = C.CHAIR[name]
    return {"foot_xy": grid((cx + (nu if rot % 2 else nv) - 1, cy)) if False else (nu if rot % 2 else nv, nv if rot % 2 else nu),
            "origin_tile_from_min": grid((0, 0)),
            "chair_tile": grid(f.xy(cu, cv)), "entry_tile": grid(f.xy(cu - 1.0, cv)),
            "chair_rel_origin": [f.xy(cu, cv)[0], f.xy(cu, cv)[1]], "entry_rel_origin": [f.xy(cu - 1.0, cv)[0], f.xy(cu - 1.0, cv)[1]],
            "centre": [cx, cy], "solid_tiles": [grid(t[0]) for t in tiles if t[1] != (C.CHAIR[name][0] + nu / 2 - .5, C.CHAIR[name][1] + nv / 2 - .5)]}


def pixel(name, rot, st):
    core.setup_scene()
    core.clear_scene_meshes()
    post.select(True)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", C.console(name, rot, st))
    return post.to_rgba(c, op), g, ox, oy


def main():
    info = {}
    only = args[args.index('--only') + 1] if '--only' in args else None
    names = [n for n in C.BUILD if not only or n == only]
    for name in names:
        for rot in (0, 1):
            info[f"{name}.r{rot}"] = meta(name, rot)
            for st in (False, True):
                rgba, g, ox, oy = pixel(name, rot, st)
                np.savez(OUT / f"px_{name}_r{rot}{'_active' if st else ''}.npz", rgba=rgba, glow=g, ox=ox, oy=oy)
                print("pixel", name, rot, st, rgba.shape, flush=True)
    if not only:
        (OUT / "meta.json").write_text(json.dumps(info, indent=1))
    if "--cell" in args:
        for name in names:
            _ns["setup"]()
            core.clear_scene_meshes()
            col, glow = _ns["render_cell"]("cell", lambda n=name: C.console(n, 0, True), "prop", 760, 620)
            arr = _ns["finish"](col, glow, "prop")
            post.write_png(OUT / f"blender_{name}_r0_active_v2.png", np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)]))
            print("cell", name, flush=True)


main()
