"""Windows (#516): the sprites of the `windows` family (sheet `windows`).

- tile.hull.ext.o1.m10.w1/.w2/.w3, tile.hull.ext.o2.m5.w1/.w2/.w3: the hull's straight runs (wall3d_ext) with a window
  (wall3d_ext_window): w1 the run's end at the lower tile coordinate (x for o1 m10, y for o2 m5), w3 the higher end,
  w2 the middles. Each with its deco layer `<id>.tint` as the hull family's pieces (hulltiles).
- tile.wall.full.m10.win.l/.m/.r, tile.wall.full.m5.win.l/.m/.r: the default walls' interior window (walls up;
  wall3d_iwin_def with the ramp of wall3d_iwin_ramp in its teal look): l the post at the lower tile coordinate end, r
  at the higher, m open across. m5 is the m10 piece mirrored onto the y axis (windows_iwin).

The pane is see-through and tinted: the "glass" render (render_glass): the solids as env_build's "wide" kind, the
pane in a pass of its own over them, blended by its coverage. Every job is a callable (the render cache keys it by
this module and what it imports)."""
import numpy as np

from . import core

HULL_GLASS = (np.array([12.0, 20.0, 20.0]), 0.45)   # the hull's pane: its tint (RGB) and opacity
WALL_GLASS = (np.array([12.0, 20.0, 20.0]), 0.25)   # the interior window's
PANE = None             # the last render_glass's pane px (uncropped): the pane's coverage over anything
HULL_NEXT = {"w1": (None, "w2"), "w2": ("w2", "w2"), "w3": ("w2", None)}   # a piece's neighbours in a run, at -1 and +1
                                                                           # along it (None: the plain hull)


def render_glass(sid, solid, wide, glass, glass_look):
    """(c, op, g, ax, ay, al) as env_build.render_sprite's: solid (own) and wide as its "wide" kind (wide None: solid
    alone), the pane objects (glass) where nothing solid is in front of them, tinted over the solid by their coverage
    (a px on a seam, half each tile's, adds up to one whole, not two)."""
    from . import env_build, post
    tint, alpha = glass_look
    SS = env_build.SS
    xmin, xmax, ymin, ymax = core.extent_px(solid + glass)
    W = 2 * (int(np.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(np.ceil(max(-ymin, ymax))) + 5)
    for o in glass:
        o.hide_render = True
    extra = [o for o in (wide or []) if o not in solid]
    only = [o for o in solid if o not in (wide or [])]
    aa = sid.startswith(env_build.AA)
    if wide:
        cut = not only
        for o in extra:
            o.is_holdout, o.hide_render = cut, not cut
        _, a = core.render(W, H, "color")
        for o in extra:
            o.is_holdout, o.hide_render = False, False
        env_build._show(only, False)
        rgb, aw = core.render(W, H, "color")
        env_build._show(only, True)
        c, _ = post.downsample(rgb, aw > 0.5, SS, 8, True, aa)
        op = post.blocks(a > 0.5, SS).sum(-1) >= post.scaled(8, SS)
    else:
        rgb, a = core.render(W, H, "color")
        c, op = post.downsample(rgb, a > 0.5, SS, 8, True, aa)
    for o in glass:
        o.hide_render = False
    for o in solid + extra:
        o.is_holdout, o.hide_render = True, False       # (the pane only where nothing solid is in front of it)
    _, a2 = core.render(W, H, "color")
    for o in solid:
        o.is_holdout = False
    for o in extra:
        o.is_holdout, o.hide_render = False, True
    ga = alpha * post.blocks(a2 > 0.5, SS).sum(-1) / (SS * SS)
    g = ga > 0
    out = c.astype(float)
    m = g & op
    out[m] = out[m] * (1 - ga[m][:, None]) + tint * ga[m][:, None]
    out[g & ~op] = tint
    al = np.where(op, 255, np.round(ga * 255)).astype(np.uint8)
    out, al = np.pad(out.astype(np.uint8), ((1, 1), (1, 1), (0, 0))), np.pad(al, 1)
    global PANE
    PANE = np.pad(g, 1)
    z = np.zeros((H + 2, W + 2, 4), np.uint8)
    return out, al > 0, z, (W + 2) // 2, (H + 2) // 2, al


def glass_item(sid, build, glass_look, pal):
    """The cropped item of a window piece: build() -> (own, wide, pane objects)."""
    from . import env_build, post
    core.clear_scene_meshes()
    post.select(pal)
    own, wide, glass = build()
    return env_build.crop_item(sid, (1, 1), *render_glass(sid, own, wide, glass, glass_look))


def _hull_build(m, o, part, glass=True):
    """A hull window piece as (own, wide, pane objects): its px its own, their colours from it with its run neighbours
    beside it (HULL_NEXT), so a px on the tile's edge resolves as it does mid-run."""
    from . import wall3d_ext as X
    from . import wall3d_ext_window as WIN

    def build():
        dx, dy = X.STRAIGHT[(m, o)]
        WIN.PART = part
        try:
            solid = X.ext_block(m, o)
            pane = WIN.GLASS.build()
            more = []
            for k, n in zip((-1, 1), HULL_NEXT[part]):
                WIN.PART = n
                for ob in X.ext_block(m, o):
                    ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                    more.append(ob)
            if not glass:                               # (a mask pass: the solids alone)
                for ob in pane:
                    ob.hide_render = True
            return solid, solid + more, pane
        finally:
            WIN.PART = None
    return build


def _hull_tint(sid, m, o, part, item, glass):
    """The piece's deco layer (hulltiles' `.tint`): its px in the armour's tint tones less the exterior's seam
    lines, and less where the pane lies over it (the deco paint would cover the glass's tint)."""
    from . import env_build, hulltiles, post
    from . import wall3d_ext as X

    def white(tint, seam):
        core.clear_scene_meshes()
        post.select("hull")
        own, wide, _ = hulltiles._pass(_hull_build(m, o, part, glass=False), tint, seam)()
        r = env_build.render_sprite(sid, "wide", (own, wide))
        return r[1] & (r[0].min(-1) > 240), r
    msk, r = white(X.TINT, False)
    seams, _ = white(None, True)
    if seams.shape == msk.shape:
        msk &= ~seams
    if msk.shape != glass.shape:
        return None
    msk &= ~glass
    if not msk.any():
        return None
    ys, xs = np.where(msk)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    keep = msk[y0:y1, x0:x1]
    full = _uncrop(item, msk.shape, r[3], r[4])
    rgba[..., :3][keep] = full[y0:y1, x0:x1, :3][keep]
    rgba[..., 3][keep] = 255
    return {"id": sid + ".tint", "fp": (1, 1), "rgba": rgba, "g": np.zeros_like(rgba), "ax": r[3] - x0, "ay": r[4] - y0}


def _uncrop(item, shape, ax, ay):
    """A cropped item back on an uncropped canvas of `shape` whose anchor is (ax, ay)."""
    out = np.zeros(shape + (4,), np.uint8)
    y0, x0 = ay - item["ay"], ax - item["ax"]
    h, w = item["rgba"].shape[:2]
    out[y0:y0 + h, x0:x0 + w] = item["rgba"]
    return out


def hull_piece(m, o, part):
    """A hull window piece's items: the piece and its deco layer."""
    from . import env_build, post
    sid = f"tile.hull.ext.o{o}.m{m}.{part}"
    core.clear_scene_meshes()
    post.select("hull")
    own, wide, pane = _hull_build(m, o, part)()
    r = render_glass(sid, own, wide, pane, HULL_GLASS)
    it = env_build.crop_item(sid, (1, 1), *r)
    if it is None:
        return []
    tint = _hull_tint(sid, m, o, part, it, PANE)
    return [it] + ([tint] if tint else [])


def jobs():
    """Callable jobs (env_build.render_jobs)."""
    from . import windows_iwin as IW
    out = [lambda m=m, o=o, p=p: hull_piece(m, o, p) for m, o in ((10, 1), (5, 2)) for p in ("w1", "w2", "w3")]
    return out + IW.jobs()
