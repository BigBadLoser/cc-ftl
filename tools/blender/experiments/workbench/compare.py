"""Cycles vs Workbench on a test set (blender -b --python compare.py -- OUTDIR [samples]); needs EGL (xvfb-run not needed
once libegl1 + mesa are installed). Writes OUTDIR/<engine>/<sprite>.npz and prints timings."""
import os
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
from sprites import core, post, env_build, families
import wb

out = Path(sys.argv[sys.argv.index("--") + 1])
IDS = {"walls": ["tile.floor.a", "tile.wall.full.m5", "tile.wall.full.m10", "tile.wall.full.m15", "tile.wall.m6", "tile.door.x"],
       "env": ["module.fabricator.active", "prop.crate"], "weapons": ["turret.burst_laser.d0"]}
core.setup_scene()
wb.setup()
real = core.render
for fam, ids in IDS.items():
    jobs, extra = families.jobs(fam)
    for sid, fp, kind, fn in [j for j in jobs if not callable(j) and j[0] in ids]:
        for eng, r in (("cycles", real), ("workbench", wb.render)):
            core.render = r
            env_build.core.render = r
            core.clear_scene_meshes()
            post.select(extra(sid) if callable(extra) else extra)
            objs = fn()
            t = time.perf_counter()
            it = env_build.crop_item(sid, fp, *env_build.render_sprite(sid, kind, objs))
            dt = time.perf_counter() - t
            (out / eng).mkdir(parents=True, exist_ok=True)
            np.savez_compressed(out / eng / f"{fam}__{sid}.npz", rgba=it["rgba"], g=it["g"], a=np.array([it["ax"], it["ay"]]))
            print(f"CMP {fam}:{sid} {eng} {dt:.2f}s {it['rgba'].shape}", flush=True)
