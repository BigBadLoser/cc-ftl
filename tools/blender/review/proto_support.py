"""Support-module style prototype render (runs in Blender): module + roof-part pixel sprites (idle + active, rot 0 and 1) as .npz,
raised-height (2.2) wall and roof tiles, optional Blender cells, and meta.json. Composite with proto_support_composite.py.
Files: px_ (module), roofpart_ (deployed roof part), roofstow_ (stowed), roofdep_..._f0..f3 (deploy frames).
  blender -b --factory-startup --python tools/blender/review/proto_support.py -- <out dir> [--cell] [--tiles] [--only name]"""
import json
import sys
from pathlib import Path

import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import support_proto as S
from sprites import core, env_build, post, roofs, walls
from sprites.cmbkit import Frame

walls.HF = 2.4          # local override: raised full walls and roof plane
roofs.ZR = 2.4
S.install_palette()
args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)
_src = Path(__file__).with_name("blender_cells.py").read_text().rsplit("\nmain()", 1)[0]
_ns = {"__name__": "blender_cells_lib", "__file__": str(Path(__file__).with_name("blender_cells.py"))}
exec(compile(_src, "blender_cells.py", "exec"), _ns)


def fresh():
    core.setup_scene()
    core._state["scene"].cycles.samples = 64
    core.clear_scene_meshes()


def meta(name, rot):
    nu, nv = S.FOOT[name]
    cx, cy = S.centre(rot, nu, nv)
    f = Frame(None, rot, centre=(cx, cy))
    tiles = [f.xy(-nu / 2 + .5 + i, -nv / 2 + .5 + j) for i in range(nu) for j in range(nv)]
    mnx, mny = min(t[0] for t in tiles), min(t[1] for t in tiles)
    grid = lambda p: (round(p[0] - mnx), round(p[1] - mny))
    return {"foot_xy": (nu if rot % 2 else nv, nv if rot % 2 else nu), "origin_tile_from_min": grid((0, 0)), "centre": [cx, cy],
            "solid_tiles": [grid(t) for t in tiles], "walkable_tiles": [], "roof_z": S.ZR}


def pixel(objs, prop=True):
    post.select(prop)
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop" if prop else "block", objs)
    return post.to_rgba(c, op), g, ox, oy


def save(path, t):
    np.savez(path, rgba=t[0], glow=t[1], ox=t[2], oy=t[3])


def main():
    only = args[args.index('--only') + 1] if '--only' in args else None
    names = [n for n in S.BUILD if not only or n == only]
    mp = OUT / "meta.json"
    old = json.loads(mp.read_text()) if mp.exists() else {}
    for name in names:
        jobs = []                                                                       # (file, model kwargs)
        for rot in (0, 1):
            old[f"{name}.r{rot}"] = meta(name, rot)
            for st in (False, True):
                tag = f"{name}_r{rot}{'_active' if st else ''}"
                if "--roofonly" not in args:
                    jobs.append((f"px_{tag}", dict(name=name, rot=rot, st=st)))
                if st or rot == 0:
                    jobs.append((f"roofpart_{tag}", dict(name=name, rot=rot, st=st, roof=True)))
            jobs.append((f"roofstow_{name}_r{rot}", dict(name=name, rot=rot, st=False, roof=True, stage="stowed")))
        for k in range(4):
            jobs.append((f"roofdep_{name}_r0_f{k}", dict(name=name, rot=0, st=True, roof=True, stage=k)))
        for fn, kw in jobs:
            fresh()
            save(OUT / f"{fn}.npz", pixel(S.model(**kw)))
            print("pixel", fn, flush=True)
        if "--meta" in args or True:
            old_now = json.loads(mp.read_text()) if mp.exists() else {}
            old_now.update({k: v for k, v in old.items() if k.startswith(name)})
            mp.write_text(json.dumps(old_now, indent=1))
    if "--tiles" in args:
        for m in (3, 5, 6, 9, 10, 12):
            fresh()
            save(OUT / f"wall_full_m{m}.npz", pixel(walls.block(m, "wall", None, None, True), False))
        for m in (3, 6, 7, 9, 11, 12, 13, 14, 15):
            fresh()
            save(OUT / f"roof_m{m}.npz", pixel(roofs.generic(m), False))
        print("tiles", flush=True)


main()
