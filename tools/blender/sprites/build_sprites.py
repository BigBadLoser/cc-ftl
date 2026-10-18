"""Entry point (npm run sprites):
  blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- [outdir] [what]

`what` = all (default), crew, robots, or a comma list of families (families.py: env, walls, consoles, weapons, roof, sol).
Each family renders into its own sheets under <outdir>/sprites/ and is merged into <outdir>/manifest.json (shape:
src/render/assets/manifest.ts): its old sheets and ids are replaced, the rest is kept. So one family can be rebuilt
alone and the committed manifest is the cache. Default outdir = public/assets."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, pack, families, walls  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
MANIFEST_VERSION = 1


def base():
    from sprites.crew_pack import KEY_COLORS
    # Heights the renderer needs (tiles; zPx = art px per tile of height): walls.HF and the roof top (walls.hull_top()).
    return {"version": MANIFEST_VERSION, "tile": {"w": core.TILE_W, "h": core.TILE_H}, "keyColors": KEY_COLORS,
            "heights": {"wall": walls.HF, "roof": round(walls.hull_top(), 4), "zPx": round(core.ZPX, 4)}}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[0]) if argv else ROOT / "public/assets"
    what = argv[1] if len(argv) > 1 else "all"
    out.mkdir(parents=True, exist_ok=True)
    mpath = out / "manifest.json"
    names = (["crew", "robots"] + list(families.ALL)) if what == "all" else what.split(",")
    for name in names:
        m = pack.load_manifest(mpath, base())
        if name == "crew":
            from sprites import crew_pack, human_render as hr
            arm, items = hr.build_items()
            # CREW_QUICK=1: only the frames crew_check.py shows, in SE, S, SW, NW (fast iteration; not for commits)
            quick = os.environ.get("CREW_QUICK")
            res, cols = hr.render_all(arm, items, dirs=(0, 1, 2, 4) if quick else range(8),
                                      frames={("idle", 0), ("walk", 2), ("work", 3), ("sit_idle", 0), ("sit_work", 0)} if quick else None)
            sheets, assets = crew_pack.pack(items, res, cols, out)
            pack.merge(m, "crew", sheets, assets, crew=True)
        elif name == "robots":
            # ROBOT_QUICK=1: preview frames only (see robot_render.build); not for commits
            from sprites import robot_render
            sheets, assets = robot_render.build(out)
            pack.merge(m, "robots", sheets, assets)
        elif name == "sol":
            from sprites import sol_pack
            sheets, assets = sol_pack.build(out)
            for fam in sol_pack.SHEETS:
                pack.merge(m, fam, {k: v for k, v in sheets.items() if pack.owned(k, fam)},
                           {k: a for k, a in assets.items() if pack.owned(a["sheet"], fam)})
        else:
            from sprites import env_build
            core.setup_scene()
            jobs, extra = families.jobs(name)
            sheets, assets = pack.pack(name, env_build.render_jobs(jobs, extra), out)
            pack.merge(m, name, sheets, assets)
        pack.save_manifest(mpath, m)
        print("MANIFEST", name, len(m["sheets"]), "sheets", len(m["assets"]), "assets", flush=True)


main()
