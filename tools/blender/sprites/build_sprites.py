"""Entry point (npm run sprites):
  blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- [outdir] [what]

`what` = all (default), crew, robots, or a comma list of families (families.py: env, walls, consoles, weapons, roof, sol).
`crew` is incremental (crew_build.py: render cache under .cache/sprites/crew); options --item S, --clip C, --force, --plan.
Every other rendered family is cached too (sprite_cache.py, .cache/sprites/<family>): a job re-renders only when its key changed;
--force ignores the cache, --plan reports hits and misses and renders nothing, --no-cache bypasses it.
--preview renders at SS 2 and 1 sample (core.py): rough, cached apart, scratch outdir only.
`--only A,B` (families rendered through env_build) renders just the sprites whose id contains A or B; use it with a scratch outdir
for a quick check (the sheets are then partial: never commit them).
Each family renders into its own sheets under <outdir>/sprites/ and is merged into <outdir>/manifest.json (shape:
src/render/assets/manifest.ts): its old sheets and ids are replaced, the rest is kept. So one family can be rebuilt
alone and the committed manifest is the cache. Default outdir = public/assets."""
import os
import sys
from pathlib import Path

if "--preview" in sys.argv:         # before core is imported: it reads the quality from the environment
    os.environ["SPRITE_PREVIEW"] = "1"
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
        if a in ("--force", "--plan", "--preview", "--no-cache", "--cache-only"):
            opts[a[2:]] = True
        elif a in ("--item", "--clip", "--only") and k + 1 < len(argv):
            k += 1
            opts[a[2:]] = argv[k]
        elif a.startswith(("--item=", "--clip=", "--only=")):
            opts[a[2:].split("=")[0]] = a.split("=", 1)[1]
        else:
            pos.append(a)
        k += 1
    return pos, opts


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    argv, opts = parse_opts(argv)
    out = Path(argv[0]) if argv else ROOT / "public/assets"
    if (opts.get("preview") or opts.get("only")) and out.resolve() == (ROOT / "public/assets").resolve() \
            and not opts.get("plan"):
        sys.exit("--preview / --only give approximate or partial sheets: pass a scratch outdir "
                 "(npm run sprites -- -- /tmp/out walls --only tile.wall.m5 --preview), never public/assets")
    what = argv[1] if len(argv) > 1 else "all"
    out.mkdir(parents=True, exist_ok=True)
    mpath = out / "manifest.json"
    names = (["crew", "robots", "aliens"] + list(families.ALL)) if what == "all" else what.split(",")
    for name in names:
        m = pack.load_manifest(mpath, base())
        if name == "crew":
            from sprites import crew_build, crew_pack
            sheets, assets, full = crew_build.build(out, opts)
            if not opts.get("plan") and not opts.get("cache-only"):
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
            total = len(jobs)
            print("FAMILY_JOBS", name, total, flush=True)
            step = max(1, total // 100)

            def progress(done, count):
                if done == 1 or done == count or done % step == 0:
                    print("FAMILY_PROGRESS", name, done, count, flush=True)
            items = env_build.render_jobs(jobs, extra, only=opts["only"].split(",") if opts.get("only") else None,
                                          family=None if opts.get("no-cache") else name, force=bool(opts.get("force")),
                                          plan=bool(opts.get("plan")), progress=progress)
            if opts.get("plan"):
                continue
            sheets, assets = pack.pack(name, items, out)
            pack.merge(m, name, sheets, assets)
        pack.save_manifest(mpath, m)
        print("MANIFEST", name, len(m["sheets"]), "sheets", len(m["assets"]), "assets", flush=True)


main()
