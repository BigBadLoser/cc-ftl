"""The hull from outside and its belly, by hull key (hull_outline): the sprites of the `hull` family.

- tile.hull.ext.o<o>.m<mask>: the run set's near runs and corners (wall3d_ext; o 1 = space at +y, 2 = at +x, 3 =
  both), the straight runs (o1 m10, o2 m5) also in designs .a1 .. .a3.
- tile.hull.ext.g.<key>: every catalog key's generic piece (wall3d_ext_diag: diagonals, far sides, notches, and the
  stand-in for a near piece the run set lacks), tile.roof.g.<key> its roof over the rest of the tile.
- tile.hull.belly.<under|low>.<key>: the belly below the deck (under) and its cut top over it (low), in the plain
  look; .l<look> the other bay looks (wall3d_belly_run), only where one differs from the plain.
- <id>.tint: a hull piece's deco layer, Hull 46's bottomDeco: the piece's own px where the ship's deco colour goes
  (drawn over the piece and tinted with it; the armour colour tints the piece): its tones in the piece's TINT set
  (core.TINT), less the exterior's seam pass (wall3d.SEAM_PASS).

A key is hull_outline.name(key); the catalog is hull_keys.json (hull_catalog). Each job is a callable rendering a
piece and its mask together, so the mask shares the piece's anchor."""
import numpy as np

from . import core
from . import hull_catalog as HC
from . import hull_outline as HO
from . import wall3d as T

OUT_MASK = {1: 4, 2: 2, 3: 6}       # mask bits that must be clear for each outward set (envtiles.OUT_MASK)
LOOKS = (20, 21, 22, 26, 27, 28)    # the belly's bay looks (wall3d_belly_run): plain first


def _render(sid, kind, build):
    """(c, op, g, ox, oy) of a builder's objects, uncropped; None if it built nothing."""
    from . import env_build, post
    core.clear_scene_meshes()
    post.select(True)
    objs = build()
    if not objs:
        return None
    return env_build.render_sprite(sid, kind, objs)[:5]


def _white(r):
    return r[1] & (r[0].min(-1) > 240) if r is not None else None


def _pass(build, tint, seam):
    def run():
        core.TINT, T.SEAM_PASS = tint, "tintW" if seam else None
        try:
            return build()
        finally:
            core.TINT, T.SEAM_PASS = None, None
    return run


def _items(sid, kind, build, tint=None, seams=False):
    """The piece's item and its mask's ([] if it is empty; no mask without `tint`)."""
    from . import env_build
    r = _render(sid, kind, build)
    if r is None:
        return []
    it = env_build.crop_item(sid, (1, 1), *r)
    if it is None or tint is None:
        return [it] if it else []
    m = _white(_render(sid, kind, _pass(build, tint, False)))
    if m is not None and seams:
        s = _white(_render(sid, kind, _pass(build, None, True)))
        if s is not None and s.shape == m.shape:
            m &= ~s
    if m is None or m.shape != r[1].shape or not (m := m & r[1]).any():
        return [it]
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    keep = m[y0:y1, x0:x1]
    rgba[..., :3][keep] = r[0][y0:y1, x0:x1][keep]
    rgba[..., 3][keep] = 255
    mask = {"id": sid + ".tint", "fp": (1, 1), "rgba": rgba, "g": np.zeros_like(rgba), "ax": r[3] - x0,
            "ay": r[4] - y0}
    return [it, mask]


def _variant(fn, tr):
    def build():
        T.VARIANT = tr
        try:
            return fn()
        finally:
            T.VARIANT = (0, 0)
    return build


def _belly(k, layer):
    """Every look of a key's belly layer: the plain one, then each other look that differs from it."""
    from . import wall3d_belly as B
    from . import walls as W
    lv = "under" if layer == "under" else "over"
    out, plain = [], None
    for lk in LOOKS:
        sid = f"tile.hull.belly.{layer}.{HO.name(k)}" + ("" if lk == LOOKS[0] else f".l{lk}")
        items = _items(sid, "wide", lambda lk=lk: B.wide(k, W.ZG, lv, look=lk), B.TINT, False)
        if not items:
            break
        if plain is None:
            plain = items[0]
        elif (items[0]["rgba"].shape == plain["rgba"].shape and (items[0]["rgba"] == plain["rgba"]).all()
              and (items[0]["ax"], items[0]["ay"]) == (plain["ax"], plain["ay"])):
            continue
        out += items
    return out


def _run_set(m, o, design):
    """A run set piece, a straight run in a design (0: the base one)."""
    from . import wall3d_ext as X
    run = (m, o) in X.STRAIGHT
    fn = (lambda: X.ext_run_wide(m, o)) if run else (lambda: X.ext_block(m, o))
    sid = f"tile.hull.ext.o{o}.m{m}" + (f".a{design}" if design else "")
    return _items(sid, "wide" if run else "block", _variant(fn, X.EXT_PAIRS[design - 1]) if design else fn, X.TINT,
                  True)


def _generic(k):
    """A key's generic piece and its roof."""
    from . import wall3d_ext as X
    from . import wall3d_ext_diag as DG
    n = HO.name(k)
    if DG.uses_art(k):
        out = _items(f"tile.hull.ext.g.{n}", "block", lambda: DG.piece(k), X.TINT, True)
    else:
        out = _items(f"tile.hull.ext.g.{n}", "wide", lambda: (DG.piece(k), DG.piece(k, margin=DG.WIDE)), X.TINT, True)
    return out + _items(f"tile.roof.g.{n}", "block", lambda: DG.roof(k))


def jobs():
    """Callable jobs (env_build.render_jobs), their defaults plain data (the render cache keys on them). HULL_SLICE=i/n
    keeps every n-th job from the i-th (n processes fill the render cache at once; a run without it packs them)."""
    import os
    from . import wall3d_ext as X
    out = []
    for o, clear in OUT_MASK.items():
        for m in range(16):
            if not m & clear:
                for d in range(len(X.EXT_PAIRS) + 1 if (m, o) in X.STRAIGHT else 1):
                    out.append(lambda m=m, o=o, d=d: _run_set(m, o, d))
    for k in HC.keys():
        if k:
            out.append(lambda k=k: _generic(k))
            out += [lambda k=k, layer=layer: _belly(k, layer) for layer in ("under", "low")]
    i, n = map(int, os.environ.get("HULL_SLICE", "0/1").split("/"))
    return out[i::n]
