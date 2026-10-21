"""Entry point (npm run sprites):
  blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- [outdir] [what]

`what` = all (default), crew, robots, or a comma list of families (families.py: env, walls, consoles, weapons, roof, sol).
`crew` is incremental (crew_build.py: render cache under .cache/sprites/crew); options --item S, --clip C, --force, --plan.
Every other rendered family is cached too (sprite_cache.py, .cache/sprites/<family>): a job re-renders only when its key changed;
--force ignores the cache, --plan reports hits and misses and renders nothing, --no-cache bypasses it.
--preview renders at SS 2 and 1 sample (core.py): rough, cached apart, scratch outdir only.
`--jobs N` builds N families at once, one Blender process each. Off by default: output is identical but it measured slower than serial.
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
        if a in ("--force", "--plan", "--preview", "--no-cache"):
            opts[a[2:]] = True
        elif a in ("--item", "--clip", "--only", "--part", "--jobs") and k + 1 < len(argv):
            k += 1
            opts[a[2:]] = argv[k]
        elif a.startswith(("--item=", "--clip=", "--only=", "--part=", "--jobs=")):
            opts[a[2:].split("=")[0]] = a.split("=", 1)[1]
        else:
            pos.append(a)
        k += 1
    return pos, opts


def build_one(name, out, opts):
    """Render one family -> merge records: ("fam", family, sheets, assets) or ("crew", sheets, assets, full). Writes only
    the family's own sheet files, never the manifest, so several of these can run at once (see run_parallel)."""
    if name == "crew":
        from sprites import crew_build
        sheets, assets, full = crew_build.build(out, opts)
        return [] if opts.get("plan") else [("crew", sheets, assets, full)]
    if name == "aliens":
        # ALIEN_QUICK=1: preview frames only (see alien_render.build); not for commits
        from sprites import alien_render
        return [("fam", "aliens", *alien_render.build(out))]
    if name == "robots":
        # ROBOT_QUICK=1: preview frames only (see robot_render.build); not for commits
        from sprites import robot_render
        return [("fam", "robots", *robot_render.build(out))]
    if name == "sol":
        from sprites import sol_pack
        sheets, assets = sol_pack.build(out)
        return [("fam", fam, {k: v for k, v in sheets.items() if pack.owned(k, fam)},
                 {k: a for k, a in assets.items() if pack.owned(a["sheet"], fam)}) for fam in sol_pack.SHEETS]
    from sprites import env_build
    core.setup_scene()
    jobs, extra = families.jobs(name)
    items = env_build.render_jobs(jobs, extra, only=opts["only"].split(",") if opts.get("only") else None,
                                  family=None if opts.get("no-cache") else name, force=bool(opts.get("force")),
                                  plan=bool(opts.get("plan")))
    if opts.get("plan"):
        return []
    return [("fam", name, *pack.pack(name, items, out))]


def apply(m, rec, out):
    if rec[0] == "crew":
        from sprites import crew_pack
        crew_pack.merge(m, rec[1], rec[2], rec[3], out)
    else:
        pack.merge(m, rec[1], rec[2], rec[3])


# Rough render cost, heaviest first, so the pool starts the long families early (the build ends when the last one does).
WEIGHT = {"consoles": 9, "vehicle_bay": 8, "shuttle": 8, "airlock": 7, "crew": 7, "robots": 6, "aliens": 6, "weapons": 5,
          "robot_bay": 4, "sol": 4, "roof": 3, "walls": 3, "eggsac": 2, "galley": 2}


def run_parallel(names, out, argv_flags, jobs):
    """One Blender process per family, `jobs` at a time, each with cpu/jobs Cycles threads (the output does not depend on the
    thread count). Each child writes its merge records to <out>/.parts/<name>.json; the parent merges them in `names` order."""
    import json
    import subprocess
    from concurrent.futures import ThreadPoolExecutor
    import bpy
    parts = out / ".parts"
    parts.mkdir(parents=True, exist_ok=True)
    threads = max(1, (os.cpu_count() or 1) // jobs)

    def child(name):
        f = parts / f"{name}.json"
        f.unlink(missing_ok=True)
        cmd = [bpy.app.binary_path, "-b", "-t", str(threads), "--factory-startup", "--python-exit-code", "1", "--python",
               str(Path(__file__).resolve()), "--", str(out), name, "--part", str(f)] + argv_flags
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        tail = "\n".join(l for l in r.stdout.splitlines() if l.startswith(("CACHE", "PACK", "CREW", "RENDERED", "SOL", "Error", "Traceback")) or "Error" in l)
        print(f"--- {name} (exit {r.returncode})\n{tail}", flush=True)
        return r.returncode, f

    order = sorted(names, key=lambda n: -WEIGHT.get(n, 1))
    with ThreadPoolExecutor(jobs) as ex:
        res = dict(zip(order, ex.map(child, order)))
    failed = [n for n in names if res[n][0]]
    if failed:
        sys.exit(f"families failed: {', '.join(failed)} (the manifest is unchanged)")
    return [tuple(r) for n in names if res[n][1].exists() for r in json.loads(res[n][1].read_text())]


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
    if opts.get("part"):                      # child of run_parallel: render one family, hand the records to the parent
        import json
        Path(opts["part"]).write_text(json.dumps(build_one(names[0], out, opts)))
        return
    jobs = int(opts.get("jobs") or 1)      # opt-in: measured slower than serial on 4 cores (Cycles already uses every thread)
    if jobs > 1 and len(names) > 1 and "sol" not in names:      # sol runs its own Blender jobs (SOL_THREADS), one at a time
        flags = [f for f in ("--force", "--plan", "--preview", "--no-cache") if opts.get(f[2:])]
        flags += [x for k in ("item", "clip", "only") if opts.get(k) for x in (f"--{k}", opts[k])]
        recs = run_parallel(names, out, flags, jobs)
    else:
        recs = None
    for name in names:
        rs = build_one(name, out, opts) if recs is None else None
        if rs is not None:
            m = pack.load_manifest(mpath, base())
            for r in rs:
                apply(m, r, out)
            pack.save_manifest(mpath, m)
            print("MANIFEST", name, len(m["sheets"]), "sheets", len(m["assets"]), "assets", flush=True)
    if recs:
        m = pack.load_manifest(mpath, base())
        for r in recs:
            apply(m, r, out)
        pack.save_manifest(mpath, m)
        print("MANIFEST", len(m["sheets"]), "sheets", len(m["assets"]), "assets", flush=True)
        for f in (out / ".parts").glob("*.json"):
            f.unlink()
        (out / ".parts").rmdir()


main()
