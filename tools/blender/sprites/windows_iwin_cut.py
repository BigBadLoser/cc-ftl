"""The interior window's pieces with the walls cut down (family `windows`): tile.wall[.low].m10.win.l/.m/.r (along x)
and tile.wall[.low].m5.win.l/.m/.r (along y). Each is the default walls' plain piece at that level (envtiles: the
cut / low tile.wall[.low].m<10|5>, its run beside it as there) with the full window's blue lines on its top over
the window's span (wall3d_iwin_def: LINES apart about the wall's middle, LINE_W wide, LINE_COL), so a cut-down run
still shows where the window is: l / m / r as the full pieces', the lines stopping at the opening's ends (its posts'
inner faces, as on the full piece: wall3d_iwin_ramp.TEAL's thinner posts).

m5 is built along y as the plain m5 is (not the m10 piece mirrored, as the full m5 pieces are): so it is the plain
cut / low m5 px for px but for the lines, and its lines are the m10's mirrored across x = y (l at the low y end)."""
from mathutils import Vector

from . import wall3d as T

LEVELS = {"cut": "", "low": "low."}
PAL = "walls+hull+walls_aa"                 # (the plain pieces' own: they stay px for px but for the lines; the
                                            # blue, winBlue, quantises to the same blue as on the full pieces)


def _span(part):
    """The opening along the run in a tile's coordinates (wall3d_iwin_def._span with TEAL's posts), clipped to it."""
    from . import wall3d_iwin_def as D
    from . import wall3d_iwin_ramp as R
    post = D.POST - R.TEAL.post_in * R.L
    x0, x1 = {"l": (-0.5 + post, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - post)}[part]
    return max(x0, -0.5), min(x1, 0.5)


def _lines(k, m, part):
    """The window's blue lines on Relief k's top over its span (k a plain straight piece, m 10 or 5)."""
    from . import wall3d_iwin_def as D
    a, b = _span(part)
    zt = max(v[2] for v in k.m.v) + 0.002
    for c in (-D.LINES / 2, D.LINES / 2):
        y0, y1 = -c - D.LINE_W / 2, -c + D.LINE_W / 2
        q = [(a, y0), (b, y0), (b, y1), (a, y1)]
        k.poly([Vector((u, v, zt) if m == 10 else (v, u, zt)) for u, v in q], "wall", 2, Vector((0, 0, 1)),
               fixed=D.LINE_COL)


def _build(m, level, part):
    """(own, wide) of a piece: the plain piece's builder (envtiles) with the lines on it and, where the window runs
    on into the run built beside it (its -x / -y side: m and r), on that too."""
    from . import envtiles
    sid = f"tile.wall.{LEVELS[level]}m{m}"
    fn = next(f for s, _, _, f in envtiles.SPRITES if s == sid)
    seq = [part, "m" if part in "mr" else None]
    calls = [0]

    def hook(k, sp):
        i = calls[0]
        calls[0] += 1
        if i < len(seq) and seq[i]:
            _lines(k, m, seq[i])

    keep = T.HOOK
    T.HOOK = hook
    try:
        own, wide = fn()
    finally:
        T.HOOK = keep
    assert calls[0] == 2, calls[0]                  # (the piece and its one run: envtiles._with_runs, BEFORE)
    return own, wide


def piece(m, level, part):
    from . import core, env_build, post
    sid = f"tile.wall.{LEVELS[level]}m{m}.win.{part}"
    core.clear_scene_meshes()
    post.select(PAL)
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, "wide", _build(m, level, part)))
    return [it] if it else []


def jobs():
    return [lambda m=m, lv=lv, p=p: piece(m, lv, p) for lv in LEVELS for m in (10, 5) for p in ("l", "m", "r")]
