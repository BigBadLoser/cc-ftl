"""Entry point (npm run sprites):
  blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- [outdir] [what]

`what` = all (default), crew, robots, or a comma list of families (families.py: env, walls, consoles, weapons, roof, sol).
`crew` is incremental (crew_build.py: render cache under .cache/sprites/crew); options --item S, --clip C, --force, --plan.
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


def parse_opts(argv):
    """-> (positional args, crew options). Flags: --force, --plan, --item S[,S], --clip C[,C] (also --item=S)."""
    pos, opts, k = [], {}, 0
    while k < len(argv):
        a = argv[k]
        if a in ("--force", "--plan"):
            opts[a[2:]] = True
        elif a in ("--item", "--clip") and k + 1 < len(argv):
            k += 1
            opts[a[2:]] = argv[k]
        elif a.startswith(("--item=", "--clip=")):
            opts[a[2:].split("=")[0]] = a.split("=", 1)[1]
        else:
            pos.append(a)
        k += 1
    return pos, opts


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    argv, opts = parse_opts(argv)
    out = Path(argv[0]) if argv else ROOT / "public/assets"
    what = argv[1] if len(argv) > 1 else "all"
    out.mkdir(parents=True, exist_ok=True)
    mpath = out / "manifest.json"
    names = (["crew", "robots", "aliens"] + list(families.ALL)) if what == "all" else what.split(",")
    for name in names:
        m = pack.load_manifest(mpath, base())
        if name == "crew":
            from sprites import crew_build, crew_pack
            sheets, assets, full = crew_build.build(out, opts)
            if not opts.get("plan"):
                crew_pack.merge(m, sheets, assets, full, out)
        elif name == "aliens":
            # ALIEN_QUICK=1: preview frames only (see alien_render.build); not for commits
            from sprites import alien_render
            sheets, assets = alien_render.build(out)
            pack.merge(m, "aliens", sheets, assets)
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
