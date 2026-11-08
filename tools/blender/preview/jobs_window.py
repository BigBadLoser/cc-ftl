"""Window pieces (wall3d_ext_window) as whole blocks (the tile's own geometry, its sides showing):
tile.hull.ext.o<o>.m<mask>.w1/w2/w3, the pane see-through and tinted (kind "glass": the solids rendered as usual,
the pane in a pass of its own over them); and the base piece the same way (.base)."""
import numpy as np
from sprites import core, env_build, post
from sprites import wall3d_ext as X
from sprites import wall3d_ext_window as WIN

TINT, ALPHA = np.array([12.0, 20.0, 20.0]), 0.45      # the glass: its tint, its opacity


def _render(sid, kind, objs):
    if kind != "glass":
        return _orig(sid, kind, objs)
    solid, wide, glass = objs if len(objs) == 3 else (objs[0], None, objs[1])
    xmin, xmax, ymin, ymax = core.extent_px(solid + glass)
    W = 2 * (int(np.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(np.ceil(max(-ymin, ymax))) + 5)
    SS = env_build.SS
    for o in glass:
        o.hide_render = True
    extra = [o for o in (wide or []) if o not in solid]  # (a wide piece: its px as the pipeline's "wide" kind,
    only = [o for o in solid if o not in (wide or [])]   # the copies past the tile hiding its ends)
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
        c, _ = post.downsample(rgb, aw > 0.5, SS, 8, True, sid.startswith(env_build.AA))
        op = post.blocks(a > 0.5, SS).sum(-1) >= post.scaled(8, SS)
    else:
        rgb, a = core.render(W, H, "color")
        c, op = post.downsample(rgb, a > 0.5, SS, 8, True, sid.startswith(env_build.AA))   # (coverage AA)
    for o in glass:
        o.hide_render = False
    for o in solid + extra:
        o.is_holdout, o.hide_render = True, False       # (the pane only where nothing solid is in front of it)
    _, a2 = core.render(W, H, "color")
    for o in solid:
        o.is_holdout = False
    for o in extra:
        o.is_holdout, o.hide_render = False, True
    cnt = post.blocks(a2 > 0.5, SS).sum(-1)
    ga = ALPHA * cnt / (SS * SS)                        # (by coverage: a px on a seam, half each tile's, adds up
    g = ga > 0                                          # to one whole, not two)
    out = c.astype(float)
    m = g & op
    out[m] = out[m] * (1 - ga[m][:, None]) + TINT * ga[m][:, None]
    out[g & ~op] = TINT
    al = np.where(op, 255, np.round(ga * 255)).astype(np.uint8)
    out, al = np.pad(out.astype(np.uint8), ((1, 1), (1, 1), (0, 0))), np.pad(al, 1)
    z = np.zeros((H + 2, W + 2, 4), np.uint8)
    return out, al > 0, z, (W + 2) // 2, (H + 2) // 2, al


_orig = env_build.render_sprite
env_build.render_sprite = _render


NEXT = {"w1": (None, "w2"), "w2": ("w2", "w2"), "w3": ("w2", None)}   # each piece's neighbours in a run (None:
                                                                    # the base hull)


def piece(m, o, part):
    """A piece as the pipeline's "wide" kind: its px its own, their colours from it with its run neighbours beside
    it, so a px on the tile's edge resolves as it does mid-run (alone, edges blend into empty space: 1 px lines)."""
    def build():
        if part is None:
            return X.ext_run_wide(m, o)
        dx, dy = X.STRAIGHT[(m, o)]
        WIN.PART = part
        try:
            solid = X.ext_block(m, o)
            glass = WIN.GLASS.build()
            more = []
            for k, n in zip((-1, 1), NEXT[part]):
                WIN.PART = n
                for ob in X.ext_block(m, o):
                    ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                    more.append(ob)
            return solid, solid + more, glass
        finally:
            WIN.PART = None
    return build


JOBS = {}
for (m, o) in ((10, 1), (5, 2)):
    JOBS[f"tile.hull.ext.o{o}.m{m}.base"] = ("wide", piece(m, o, None))
    for part in ("w1", "w2", "w3"):
        JOBS[f"tile.hull.ext.o{o}.m{m}.{part}"] = ("glass", piece(m, o, part))
