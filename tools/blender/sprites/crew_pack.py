"""Packs cached crew renders into one sheet per (item, clip) + glow twins, and merges them into the manifest.

Sheet `crew.human.torso.tee.walk` = 8 direction rows x that clip's frames, every cell the fixed crew frame (crew_spec).
A layer's manifest asset lists its clips, each with the sheet it lives in (`clips.walk.sheet`, `start` is always 0)."""
import json
import numpy as np
from . import crew_cache as cc
from . import crew_spec as cs
from . import post

KEY_COLORS = {"team.skin": "#ff00ff", "team.hair": "#00ff00", "team.cloth": "#ffff00", "team.accent": "#00ffff"}


def _packed_path():
    return cc.root() / "packed.json"


def pack(items, entries, outdir, log=print):
    """entries: (item index, clip, d, i, key, path) for every wanted cell. Writes sprites/<item>.<clip>.png (+ .glow.png),
    skipping sheets whose entry keys are unchanged since they were last written to this outdir.
    -> (sheets, assets) manifest fragments."""
    by = {}
    for e in entries:
        by.setdefault((e[0], e[1]), []).append(e)
    meta = {c: (n, fps, loop) for c, n, fps, loop in cs.CLIPS}
    pp = _packed_path()
    seen = json.loads(pp.read_text()) if pp.exists() else {}
    sheets, assets, wrote, kept = {}, {}, 0, 0
    (outdir / "sprites").mkdir(parents=True, exist_ok=True)
    for (k, clip), es in sorted(by.items()):
        it = items[k]
        n, fps, loop = meta[clip]
        sid = f"{it.id}.{clip}"
        es.sort(key=lambda e: (e[2], e[3]))
        skey = cc.digest(*[e[4] for e in es])
        img, gl = f"sprites/{sid}.png", f"sprites/{sid}.glow.png"
        tag = f"{outdir.resolve()}::{sid}"
        cached = seen.get(tag)
        if cached and cached["key"] == skey and (outdir / img).exists() and (not cached["glow"] or (outdir / gl).exists()):
            has_glow = cached["glow"]
            kept += 1
        else:
            sheet = np.zeros((8 * cs.FRAME_H, n * cs.FRAME_W, 4), np.uint8)
            glow = np.zeros_like(sheet)
            for _, _, d, i, _, path in es:
                rgba, g = cc.load(path)
                sl = (slice(d * cs.FRAME_H, (d + 1) * cs.FRAME_H), slice(i * cs.FRAME_W, (i + 1) * cs.FRAME_W))
                sheet[sl] = rgba
                if g is not None:
                    glow[sl] = g
            has_glow = bool(glow[..., 3].any())
            post.write_png(outdir / img, sheet)
            if has_glow:
                post.write_png(outdir / gl, glow)
            elif (outdir / gl).exists():
                (outdir / gl).unlink()
            seen[tag] = {"key": skey, "glow": has_glow}
            wrote += 1
        sd = {"image": img}
        if has_glow:
            sd["glow"] = gl
        sheets[sid] = sd
        a = assets.setdefault(it.id, {"kind": "crew.layer", "species": "human", "slot": it.slot, "order": it.order,
                                      "frameW": cs.FRAME_W, "frameH": cs.FRAME_H, "anchor": {"x": cs.ANCHOR[0], "y": cs.ANCHOR[1]},
                                      "clips": {}})
        a["clips"][clip] = {"sheet": sid, "start": 0, "frames": n, "fps": fps, "loop": loop}
        if has_glow:
            a["glow"] = True
    pp.parent.mkdir(parents=True, exist_ok=True)
    pp.write_text(json.dumps(seen, indent=0))
    for a in assets.values():
        a["clips"] = dict(sorted(a["clips"].items(), key=lambda kv: [c for c, *_ in cs.CLIPS].index(kv[0])))
    log(f"CREW sheets {len(sheets)} (written {wrote}, up to date {kept}); frame {cs.FRAME_W}x{cs.FRAME_H} anchor {cs.ANCHOR}")
    return sheets, assets


def merge(manifest, sheets, assets, full, outdir):
    """full: replace every human layer (and drop stale human crew sheet files). Otherwise update only the given layers' clips."""
    human = lambda a: a["kind"] == "crew.layer" and a.get("species") == "human"  # noqa: E731
    if full:
        old = {s for a in manifest["assets"].values() if human(a) for s in _sheets_of(a)}
        manifest["assets"] = {k: a for k, a in manifest["assets"].items() if not human(a)}
        for s in old:
            manifest["sheets"].pop(s, None)
    for lid, a in assets.items():
        cur = manifest["assets"].get(lid)
        if cur and not full:
            for c, cd in a["clips"].items():
                old = cur["clips"].get(c)
                if old and old["sheet"] != cd["sheet"]:
                    manifest["sheets"].pop(old["sheet"], None)
            cur["clips"].update(a["clips"])
            cur["clips"] = dict(sorted(cur["clips"].items(), key=lambda kv: [c for c, *_ in cs.CLIPS].index(kv[0])))
            glow = cur.get("glow") or a.get("glow")
            cur.update({k: v for k, v in a.items() if k != "clips"})
            if glow:
                cur["glow"] = True
        else:
            manifest["assets"][lid] = a
    manifest["sheets"].update(sheets)
    if full:
        keep = {s for a in manifest["assets"].values() for s in _sheets_of(a)}
        for f in (outdir / "sprites").glob("crew.human.*.png"):
            sid = f.name[:-len(".glow.png")] if f.name.endswith(".glow.png") else f.name[:-len(".png")]
            if sid not in keep:
                f.unlink()
    return manifest


def _sheets_of(a):
    return {c.get("sheet", a.get("sheet")) for c in a.get("clips", {}).values()} | ({a["sheet"]} if a.get("sheet") else set())
