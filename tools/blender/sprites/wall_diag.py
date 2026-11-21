"""Diagonal far walls with the walls up (#561): the partition face on a far hull diagonal (hull front (-1, -1)), seen square
on, with the hull's cap over it, as one piece per step tile of the hull's staircase (render/tiles.ts `diagRole`).

  tile.wall.diag.<r>                 the wall: panels (the straight wall piece narrowed to PS) on the staircase's inner
                                     tiles, a gap column (stacked boxes, wall3d_v2.GAP) on its step tiles, and at each end
                                     the bend: a post, the end gap and the straight wall carried on to the faces' meeting
  tile.hull.cap.diag.<r>             the ship's cap over it (wall3d.hull_cap's, along the diagonal, mitred at the bends)
  tile.hull.station.cap.diag.<r>     the station's (station_hull_walls.cap's), with its `.tint` livery mask

r: "a" the end meeting the run along y (the left bend on screen), "m" a step between, "b" the end meeting the run along x.
A step tile draws its own column and the panel on the inner tile at +x (a wall tile owns them: the inner tiles are floor),
so "a" carries a panel and "b" none. The run's rhythm is a module every half a tile's diagonal, centred on the cut, so the
end pieces are the same for every cut's length.

Built as a cut K + 1 tiles deep (K = 2: a, two steps, b) with the straight runs on past it, in tile coords with the cut's
step tiles on x + y = K - 1; each piece renders "wide" against the whole of it (so its edges resolve as mid-run)."""
import math

from mathutils import Matrix, Vector

from . import walls as W
from . import wall3d
from . import wall3d_v2

K = 2                                   # the cut built (a, the steps (0, 1) and (1, 0), b)
ROLES = {"a": (-1, K), "m": (0, K - 1), "b": (K, -1)}
PS = 0.79                               # a panel's length along the wall (as wide on screen as the runs' panels)
JOIN = 0.19                             # the bend's post along the diagonal (as wide on screen as its straight side)
CAPX = 0.6                              # the end caps carried on past the bend before their mitre
SNAP0 = 0.125                           # the face's row phase (wall3d_v2.SNAPD's at a tile-centred piece)
F = Matrix.Diagonal((1, -1, 1, 1))      # (tile coords to Blender's: y flipped)
R2 = math.sqrt(2)
PW = 1 / R2                             # one module: half a tile's diagonal


def _T(x, y):
    return Matrix.Translation((x, y, 0))


def _place(objs, M):
    objs = [o for o in objs]
    MB = F @ M @ F
    for ob in objs:
        ob.matrix_world = MB @ ob.matrix_world
    return objs


def _piece(mask, panels=True, posts="tile", nudge=False):
    """The partition piece (wall3d_v2's look) on a straight face (nudge) or square on (the diagonal)."""
    V = wall3d_v2
    V.POSTS, V.NUDGE, wall3d.DIAG = posts, nudge, not nudge
    wall3d.STYLE, wall3d.V2 = V.plain_relief(), True
    wall3d.VARIANT = (0, 0)
    V.PLAIN = not panels
    try:
        return list(wall3d.block(mask, "wall", level="up"))
    finally:
        wall3d.STYLE, wall3d.V2, wall3d.OPEN = None, False, None
        V.NUDGE, wall3d.DIAG, V.PLAIN, V.POSTS = True, False, False, "tile"


def _cap(look, mask):
    if look == "station":
        from . import station_hull_walls as SW
        return list(SW.cap(mask)[0])
    return list(wall3d.hull_cap(mask)[0])


def _mitre(obs, at, n):
    """Cut each object at the vertical plane through tile point `at`, keeping the side `n` (tile coords) points to."""
    import bmesh
    co, no = Vector((at[0], -at[1], 0)), Vector((n[0], -n[1], 0)).normalized()
    for o in obs:
        if o.type != "MESH":
            continue
        o.data = o.data.copy()
        lco, lno = o.matrix_world.inverted() @ co, o.matrix_world.to_3x3().transposed() @ no
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=lco, plane_no=lno,
                               clear_inner=True)
        bm.to_mesh(o.data)
        bm.free()


def _home(cx, cy):
    """The step tile owning a piece centred at (cx, cy): its own, or the one at -x of an inner tile."""
    t = (math.floor(cx + 0.5), math.floor(cy + 0.5))
    return (t[0] - 1, t[1]) if t[0] + t[1] == K else t


def build(look):
    """{tile: (walls, caps)} for the whole cut, its straight runs (a tile on past each bend) included."""
    h, run = W.TW / 2, W.skirt_run()
    fx = -1 + h                                     # (the y run's face: x = fx; the x run's: y = fx)
    d = K - run * R2                                # (the diagonal's face: x + y = d)
    P, Q = (fx, d - fx), (d - fx, fx)               # (where the faces meet)
    ext = K + 0.5 - (d - fx)                        # (each run carried on past its last tile to them)
    L = math.hypot(Q[0] - P[0], Q[1] - P[1])
    c0 = (P[0] - h / R2, P[1] - h / R2)
    A = Vector((1, -1)) / R2                        # (along the diagonal, from P toward Q)
    Rz = Matrix.Rotation(-math.pi / 4, 4, "Z")
    out = {}

    def add(t, walls=(), caps=()):
        w, c = out.setdefault(t, ([], []))
        w += walls
        c += caps

    for x in range(K + 1, K + 3):                   # (the straight runs: what the bends' edges resolve against)
        add((x, -1), _place(_piece(10, nudge=True), _T(x, -1)), _place(_cap(look, 10), _T(x, -1)))
    for y in range(K + 1, K + 3):
        add((-1, y), _place(_piece(5, nudge=True), _T(-1, y)), _place(_cap(look, 5), _T(-1, y)))
    ex2 = ext + CAPX
    for mask, M, Mc, cut in ((5, _T(-1, K + 0.5 - ext / 2) @ Matrix.Diagonal((1, ext, 1, 1)),
                              _T(-1, K + 0.5 - ex2 / 2) @ Matrix.Diagonal((1, ex2, 1, 1)), (P, Vector((0, 1)) - A)),
                             (10, _T(K + 0.5 - ext / 2, -1) @ Matrix.Diagonal((ext, 1, 1, 1)),
                              _T(K + 0.5 - ex2 / 2, -1) @ Matrix.Diagonal((ex2, 1, 1, 1)), (Q, Vector((1, 0)) + A))):
        caps = _place(_cap(look, mask), Mc)
        _mitre(caps, *cut)
        add(_home(M[0][3], M[1][3]), _place(_piece(mask, False, "all", nudge=True), M), caps)
    mid, h1 = L / 2, PS / 2
    segs, a0 = [(0, JOIN, "J")], JOIN
    for c in [mid + j * PW for j in range(-K, K + 1) if (j + K) % 2 == 0]:   # (a panel on each inner tile)
        segs += [(a0, c - h1, "F"), (c - h1, c + h1, "P")]
        a0 = c + h1
    segs += [(a0, L - JOIN, "F"), (L - JOIN, L, "J")]
    X0, KX = (c0[0] - c0[1]) * 32, 32 * R2          # (the pieces' joins on whole screen px)
    sn = lambda v: v if v in (0, L) else (round(X0 + v * KX) - X0) / KX     # noqa: E731
    gap, wall3d_v2.GAP = wall3d_v2.GAP, True
    try:
        for s0, s1, t in [(sn(a), sn(b), t) for a, b, t in segs]:
            M = _T(*c0) @ Rz @ _T((s0 + s1) / 2, 0) @ Matrix.Diagonal((s1 - s0, 1, 1, 1))
            cx, cy = M[0][3], M[1][3]
            wall3d_v2.PX0D = ((cx - cy) * 32) % 1   # (its px grid, as a tile-centred piece's)
            wall3d_v2.USCALE = s1 - s0
            wall3d_v2.SNAPD = (SNAP0 + (cx + cy) * 16) % 1
            walls = _place(_piece(10, t == "P", {"J": "all", "F": "none", "P": "tile"}[t]), M)
            if t == "J":                            # (the bend's post: its cap on past the bend, mitred)
                e0, e1 = (s0 - CAPX, s1) if s0 < 1e-6 else (s0, s1 + CAPX)
                caps = _place(_cap(look, 10), _T(*c0) @ Rz @ _T((e0 + e1) / 2, 0) @ Matrix.Diagonal((e1 - e0, 1, 1, 1)))
                _mitre(caps, *((P, A - Vector((0, 1))) if s0 < 1e-6 else (Q, -A - Vector((1, 0)))))
            else:
                caps = _place(_cap(look, 10), M)
            add(_home(cx, cy), walls, caps)
    finally:
        wall3d_v2.GAP, wall3d_v2.PX0D, wall3d_v2.USCALE = gap, 0.0, 1.0
        wall3d_v2.SNAPD = SNAP0
    return out


def _shift(objs, t):
    MB = F @ _T(-t[0], -t[1]) @ F
    for o in objs:
        o.matrix_world = MB @ o.matrix_world


def pieces(look, role, part):
    """(own, all) of `part` ("walls" or "caps") for a role's tile, the cut shifted to put that tile at the origin. The caps'
    all is every cap and wall (drawn over the wall piece, as the straight caps)."""
    from . import core
    core.clear_scene_meshes()
    tiles = build(look)
    walls = [o for w, _ in tiles.values() for o in w]
    caps = [o for _, c in tiles.values() for o in c]
    import bpy
    keep = {o.name for o in walls + caps}
    for o in list(bpy.data.objects):                # (the builders' strays, left at the origin)
        if o.type == "MESH" and o.name not in keep:
            bpy.data.objects.remove(o)
    _shift(walls + caps, ROLES[role])
    own = tiles[ROLES[role]][0 if part == "walls" else 1]
    if part == "walls":
        for o in caps:
            o.hide_render = True
        return own, walls
    return own, caps + walls


def _render(sid, kind, own_all):
    from . import env_build
    for o in own_all[1]:
        o.hide_render = False
    r = env_build.render_sprite(sid, kind, own_all)
    it = env_build.crop_item(sid, (1, 1), *r)
    return [it] if it else []


def wall_jobs():
    """The walls family's: the wall pieces and the ship's caps (callables, each selecting its palette)."""
    from . import post
    out = []
    for r in ROLES:
        def wall(r=r, pal=post.palette_digest("walls+hull+walls_aa")):
            post.select("walls+hull+walls_aa")
            return _render(f"tile.wall.diag.{r}", "wide", pieces("ship", r, "walls"))

        def cap(r=r, pal=post.palette_digest("walls+hull")):
            post.select("walls+hull")
            return _render(f"tile.hull.cap.diag.{r}", "over", pieces("ship", r, "caps"))
        out += [wall, cap]
    return out


def station_jobs():
    """The station hull family's: its caps with their livery masks (station_hull_walls._masked)."""
    from . import station_hull_walls as SW
    from .hulltiles import _guard
    out = []
    for r in ROLES:
        sid = f"tile.hull.station.cap.diag.{r}"
        out.append(lambda r=r, sid=sid: _guard(sid, lambda: SW._masked(sid, "over", lambda: pieces("station", r, "caps")))())
    return out
