"""Environment sprites -> one atlas (sprites/env.png + env.glow.png) and StaticAsset manifest entries.

Outlines: floors and wall/door blocks none (blocks fill the footprint and tile into one mass); props a normal 1px ring."""
import math
import time
import bpy
import numpy as np
from mathutils import Vector
from . import core, post, sprite_cache
from . import geom_digest as gd

SS = core.SS
SHADOW = (0.5, 0.75)                    # a builder's shadows (core.SHADOWS): a px shaded with this much of it in
                                        # shadow, darkened by this (to the nearest palette tone)
AA = ("tile.hull.ext.",)              # sprites coverage anti-aliased (post.downsample aa): their painted seams


def diamond_mask(W, H):
    ys, xs = np.mgrid[0:H, 0:W]
    x, y = xs + 0.5 - W / 2, ys + 0.5 - H / 2
    return np.abs(x) / (core.TILE_W / 2) + np.abs(y) / (core.TILE_H / 2) < 1.0


def _pad1(a):
    return np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2))


def _alpha_cnt(a):
    return post.blocks(a > 0.5, SS).sum(-1)


def render_ghost(objs, W, H):
    """objs = [plate, glass]. Plate: opaque palette-quantized floor plate. Glass: separate pass, never quantized or
    outlined; its brightness becomes alpha over a pale tint. Returns (rgb, alpha uint8, padded)."""
    plate, glass = objs
    glass.hide_render = True
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, SS, 8, True)
    glass.hide_render, plate.hide_render = False, True
    rgb2, a2 = core.render(W, H, "color")
    plate.hide_render = False
    cov = post.blocks(a2 > 0.5, SS)
    cnt = cov.sum(-1)
    lum = (post.blocks(rgb2.mean(-1), SS) * cov).sum(-1) / np.maximum(cnt, 1)
    ga = np.where(cnt >= post.scaled(3, SS), np.clip(lum / 255.0 * 0.65, 0, 0.9), 0.0)    # low threshold: thin lines stay unbroken
    tint = np.array([200.0, 214.0, 232.0])
    out = np.where(op[..., None], c.astype(float), tint)
    mixed = np.where(op[..., None], c * (1 - ga[..., None]) + tint * ga[..., None], tint)
    alpha = np.where(op, 255, np.round(ga * 255)).astype(np.uint8)
    return mixed.astype(np.uint8), alpha


def render_sprite(sid, kind, objs):
    if kind == "ghost":
        xs = core.extent_px(objs)
        xmin, xmax, ymin, ymax = xs
        W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
        H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
        c, al = render_ghost(objs, W, H)
        c, al = _pad1(c), np.pad(al, 1)
        z = np.zeros((H + 2, W + 2, 4), np.uint8)
        return c, al > 0, z, (W + 2) // 2, (H + 2) // 2, al
    xmin, xmax, ymin, ymax = core.extent_px(objs)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, SS, 8, True, sid.startswith(AA))
    if core.SHADOWS.get("on"):                          # (a px in shadow: most of its samples)
        sh = op & (post.blocks(core.render_shadow(W, H), SS).mean(-1) >= SHADOW[0])
        if core.SHADOWS.get("band"):                    # (kept as a band along what casts it, toward the sun)
            x, y = core.screen_xy(Vector(core.SHADOWS.get("L", core.SHADOW_L)))
            sh = post.band(sh, op, (x / math.hypot(x, y), -y / math.hypot(x, y)), core.SHADOWS["band"])
        c = post.shade(c, sh, SHADOW[1], core.SHADOWS.get("ramp", ()), core.SHADOWS.get("steps", 1))
    if kind == "floor":
        op = diamond_mask(W, H)
        c, op = np.pad(c, ((1, 1), (1, 1), (0, 0))), np.pad(op, 1)
    elif kind in ("block", "fx", "ghost"):
        c, op = _pad1(c), _pad1(op)
    else:
        c, op = post.outline(c, op, True)
    grgb, _ = core.render(W, H, "glow")
    g = _pad1(post.glow_down(grgb, SS, 3))
    return c, op, g, (W + 2) // 2, (H + 2) // 2, None


def crop_item(sid, fp, c, op, g, ox, oy, al=None):
    """Cropped manifest item {id, fp, rgba, g, ax, ay} of a rendered sprite."""
    vis = op | (g[..., 3] > 0)
    if not vis.any():
        return None                                     # nothing visible (e.g. a corner ghost with no belly)
    x0, y0, x1, y1 = post.crop_box(vis)
    rgba = post.to_rgba(c, op)
    if al is not None:
        rgba[..., 3] = al
    return {"id": sid, "fp": fp, "rgba": rgba[y0:y1, x0:x1], "g": g[y0:y1, x0:x1], "ax": ox - x0, "ay": oy - y0}


def global_digest():
    """Everything global that can change a rendered sprite: the render code (core, post, this file), the palette files, the
    tile scale, the Blender version and the quality settings. Per-sprite inputs (geometry, scene state) are keyed separately."""
    b = sprite_cache.BL
    files = [sprite_cache.SRC / f for f in ("core.py", "post.py", "env_build.py", "scale.py", "geom_digest.py", "sprite_cache.py")]
    files += [b / "lib/palette.py", sprite_cache.ROOT / "palette.json", b / "palette_extra.json"]
    return sprite_cache.digest(sprite_cache.files_digest(files), bpy.app.version_string, core.TILE_W, core.TILE_H, core.SS,
                               core.SAMPLES, core.PREVIEW)


def render_jobs(jobs, extra=True, only=None, log=print, family=None, force=False, plan=False, progress=None):
    """Render sprite jobs: (id, footprint, kind, builder) tuples, or callables returning ready items (multi-part
    sprites such as a console and its front overlay). `extra` picks the quantisation palette (see post.select).

    With `family` the render cache (sprite_cache.py) is used: a job whose key is unchanged loads its items instead of
    rendering. A tuple job is keyed by its built geometry, so editing one builder re-renders only the sprites whose meshes
    changed. A callable job renders itself, so it is keyed by the source of its module and everything that module imports.
    `force` ignores the cache for the selected jobs; `plan` only counts hits and misses (nothing renders or is stored).
    `progress(done, total)` is called as the jobs go by (the sprite dashboard, progress.py)."""
    items, hits, misses, miss_ids = [], 0, 0, []
    glob = global_digest() if family else None
    t0 = time.time()

    def cached(stem, key):
        nonlocal hits
        path = sprite_cache.entry_path(family, stem, key)
        if family and not force and path.exists():
            hits += 1
            return path, sprite_cache.load(path)
        return path, None

    for index, job in enumerate(jobs, 1):
        if progress:
            progress(index, len(jobs))
        if callable(job):
            stem = None
            if family:
                # The job's own code is part of its identity: two lambdas with the same defaults (fly.d0 and docked.d0,
                # say) are different sprites and must never share a cache entry.
                code = getattr(job, "__code__", None)
                ident = (job.__module__, getattr(job, "__qualname__", None), code.co_firstlineno if code else None,
                         code.co_code.hex() if code else None, repr([c for c in code.co_consts if not hasattr(c, 'co_code')]) if code else None, getattr(job, "__defaults__", None))
                stem = "call." + sprite_cache.digest(ident)[:10]
                key = sprite_cache.digest(glob, ident, sprite_cache.files_digest(sprite_cache.closure_files(job.__module__)),
                                          gd.scene_digest())
                path, got = cached(stem, key)
                if got is not None:
                    items += got
                    continue
            misses += 1
            miss_ids.append(stem or "callable")
            if plan:
                continue
            res = job()
            items += res
            if family:
                sprite_cache.store(path, res)
            continue
        sid, fp, kind, fn = job
        if only and not any(o in sid for o in only):
            continue
        core.clear_scene_meshes()
        pal = bool(extra(sid) if callable(extra) else extra)
        post.select(pal)
        objs = fn()
        if family:
            key = sprite_cache.digest(glob, sid, fp, kind, pal, gd.scene_digest(), gd.objects_digest(objs),
                                      repr(core.SHADOWS))
            path, got = cached(sid, key)
            if got is not None:
                items += got
                continue
        misses += 1
        miss_ids.append(sid)
        if plan:
            continue
        it = crop_item(sid, fp, *render_sprite(sid, kind, objs))
        if it:
            items.append(it)
        if family:
            sprite_cache.store(path, [it] if it else [])
    if family:
        log(f"CACHE {family}: {hits} hits, {misses} misses{' (planned: nothing rendered)' if plan else ''} in {time.time() - t0:.1f}s"
            + (f"; first misses: {', '.join(miss_ids[:8])}" if miss_ids else ""))
    log(f"RENDERED {len(items)} sprites")
    return items
