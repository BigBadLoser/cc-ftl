"""Incremental crew build: render only what the cache lacks, then pack per-clip sheets.

  blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- public/assets crew [--item S[,S]] [--clip C[,C]] [--force] [--plan]

Pipeline: build the scene (human_items) -> digest every item and the rig -> key every (item, clip, direction, frame) ->
render the misses (pose each frame once, render only the items that miss it, store each result at once so an
interrupted build resumes) -> pack one sheet per (item, clip) from the cache (crew_pack).

Entry key = hash of: GLOBAL (render code core/post/human_render, palette, base GLB, Blender version, frame constants, rig
digest) + CLIP (name, frame count, and for sit_* / eva_float the files that pose them) + ITEM (its geometry digest) +
HOLDOUT (digests of the lower-slot items that hold it out) + direction + frame."""
import inspect
import os
import math
import time
from collections import defaultdict
from pathlib import Path
import bpy
import numpy as np
from . import core, crew_cache as cc, crew_digest as dg, crew_pack
from . import crew_spec as cs
from . import crew_clips as clips
from . import human_render as hr

SRC = Path(__file__).resolve().parent
BL = SRC.parent
REPO = BL.parents[1]
GLOBAL_FILES = [SRC / "core.py", SRC / "post.py", SRC / "human_render.py",
                BL / "lib/palette.py", REPO / "palette.json", BL / "palette_extra.json", BL / "source/base_cc0.glb"]
CLIP_FILES = {"sit_idle": ["human_sit.py", "console_proto.py", "cmbkit.py"], "sit_work": ["human_sit.py", "console_proto.py", "cmbkit.py"],
              "eva_float": ["human_suit.py", "human_sit.py"]}      # files a clip's pose/chair code leans on (hashed for that clip only)
for _c in ("aim_1h", "fire_1h", "aim_2h", "fire_2h", "aim_heavy", "fire_heavy"):
    CLIP_FILES[_c] = ["human_aim.py", "human_v2_weapons.py", "human_sit.py"]


def item_clips(it):
    """Clips an item has sheets for (Pose.items in crew_clips: no sit_* for gear.back, eva_float only for body and suit).
    Held weapons (gear.hand) only get the clips that ask for them: they are drawn only in their own family's combat clips."""
    if it.slot == "gear.hand":
        return [clip for clip, _, _, _ in cs.CLIPS if clips.pose_of(clip).items and clips.pose_of(clip).items(it)]
    return [clip for clip, _, _, _ in cs.CLIPS if not clips.pose_of(clip).items or clips.pose_of(clip).items(it)]


def muzzle_px(arm, it):
    """A held weapon's muzzle in sprite px from the anchor (x right, y down), or None."""
    mz = getattr(it, "muzzle", None)
    if mz is None:
        return None
    sx, sy = core.screen_xy(np.array(arm.matrix_world @ (arm.pose.bones["hand.R"].matrix @ mz)))
    return np.array([round(sx, 1), round(-sy, 1)], np.float32)


def clip_key(clip, n):
    """Everything about a clip's pose that can change its pixels: its table row, the source of its own pose functions and
    the files they lean on (CLIP_FILES). Other clips' code is not part of it."""
    p = clips.pose_of(clip)
    fns = [inspect.getsource(f) for f in (p.before, p.after, p.puffs) if f]
    return cc.digest(clip, n, p.action, p.hold, p.chair, *fns, cc.files_digest([SRC / f for f in CLIP_FILES.get(clip, [])]))


def _split(v):
    return [x for x in (v or "").split(",") if x]


def _log(*a):
    print(*a, flush=True)


def build(out, opts, log=_log):
    """-> (sheets, assets, full). opts: item/clip (comma lists), force, plan."""
    from . import human_items
    t0 = time.time()
    arm, items = human_items.build_items()
    # The sit chair (a hidden holdout) is always in the scene, like in every full build: Cycles output at a few knife-edge
    # pixels depends on what else is in the scene, so the scene must not depend on which clips this run renders.
    hr.chair_holdout()
    sc = bpy.context.scene
    rig = dg.rig_digest(arm)
    idig = {it.id: dg.item_digest(it) for it in items}
    fdig = cc.files_digest([p for p in GLOBAL_FILES if p.exists()])
    glob = cc.digest(fdig, bpy.app.version_string, rig, cs.FRAME_W, cs.FRAME_H,
                     cs.ANCHOR, sc.cycles.samples, sc.cycles.filter_width, sc.render.engine, core.SS)
    log(f"CREW keys: global {glob[:8]} (files {fdig[:8]}, rig {rig[:8]}), {len(items)} items")
    only, only_clips = _split(opts.get("item")), _split(opts.get("clip"))
    full = not only and not only_clips
    nframes = {c: n for c, n, _, _ in cs.CLIPS}
    ckey = {c: clip_key(c, nframes[c]) for c in nframes}

    if os.environ.get("CREW_KEYDUMP"):      # debugging: why did an entry miss? diff two dumps
        import json
        hd = {it.id: [o.id for o in hr.hold_set(it, items)] for it in items}
        Path(os.environ["CREW_KEYDUMP"]).write_text(json.dumps({"global": glob, "clips": ckey, "items": idig, "holdouts": hd}, indent=1, sort_keys=True))
    entries = []       # (item index, clip, d, i, key, path)
    for k, it in enumerate(items):
        if only and not any(s in it.id for s in only):
            continue
        hold = cc.digest(*[idig[o.id] for o in hr.hold_set(it, items)])
        for clip in item_clips(it):
            if only_clips and clip not in only_clips:
                continue
            for d in range(8):
                for i in range(nframes[clip]):
                    key = cc.digest(glob, ckey[clip], idig[it.id], hold, d, i)
                    entries.append((k, clip, d, i, key, cc.entry_path(it.id, clip, d, i, key)))
    force = bool(opts.get("force"))
    miss = [e for e in entries if force or not e[5].exists()]
    log(f"CREW scene {time.time() - t0:.1f}s; {len(entries)} entries, {len(entries) - len(miss)} cache hits, {len(miss)} misses"
        + (" (forced)" if force else ""))
    per = defaultdict(lambda: [0, 0])
    for e in entries:
        per[(items[e[0]].id, e[1])][0] += 1
    for e in miss:
        per[(items[e[0]].id, e[1])][1] += 1
    for (iid, clip), (n, m) in sorted(per.items()):
        if m:
            log(f"  MISS {iid}.{clip}: {m}/{n}")
    if opts.get("plan"):
        return {}, {}, full
    t1 = time.time()
    _render(arm, items, miss, log)
    if miss:
        log(f"CREW rendered {len(miss)} entries in {time.time() - t1:.1f}s")
    t2 = time.time()
    sheets, assets = crew_pack.pack(items, entries, out, log)
    log(f"CREW pack {time.time() - t2:.1f}s; total {time.time() - t0:.1f}s; hits {len(entries) - len(miss)} misses {len(miss)}")
    return sheets, assets, full


def _render(arm, items, miss, log):
    """Pose each (direction, clip frame) once and render the items that miss it."""
    todo = defaultdict(list)
    for e in miss:
        todo[(e[2], e[1], e[3])].append(e)
    if not todo:
        return
    frames = {(c, i): (name, f) for c, i, name, f in clips.clip_frames()}
    order = {c: n for n, (c, _, _, _) in enumerate(cs.CLIPS)}
    chair = hr.chair_holdout()
    done, last_d = 0, None
    for d, clip, i in sorted(todo, key=lambda k: (k[0], order[k[1]], k[2])):
        if d != last_d:
            arm.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
            last_d = d
        name, f = frames[(clip, i)]
        hr.pose_frame(arm, clip, i, name, f)
        p = clips.pose_of(clip)
        hr._PUFFS.clear()
        if p.puffs:
            hr._PUFFS.update(p.puffs(i))
        head = hr.head_px(arm)
        chair.hide_render, chair.rotation_euler = not p.chair, arm.rotation_euler
        for k, _, _, _, _, path in todo[(d, clip, i)]:
            rgba, g = hr.render_item(items[k], items, head, chair=chair if p.chair else None)
            cc.store(path, rgba, g, muzzle_px(arm, items[k]))
            done += 1
        if done % 200 < len(todo[(d, clip, i)]):
            log(f"  rendered {done}/{len(miss)}")
