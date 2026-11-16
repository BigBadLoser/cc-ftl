"""The default walls' interior window pieces for the `windows` family (windows.py): tile.wall.full.m10.win.l/.m/.r
(along x) and tile.wall.full.m5.win.l/.m/.r (along y); l is the post at the run's lower tile coordinate end, r at
the higher, m open across (wall3d_iwin_def's window with wall3d_iwin_ramp's TEAL ramp, approved on art/hull-windows).

The pieces build in the default walls' second look (wall3d_v2), the one the window was designed on: wall3d.V2 on and
STYLE its plain relief while they build. Each is env_build "wide" with one copy along the run, on the side drawn
before it (the window running on into it there, else the plain wall), as art/hull-windows' envtiles join rule.

m5: the m10 piece mirrored across the x = y diagonal (MODE; its near face +y onto +x, its l end onto the low y end),
its colours moved to the ramp each face takes there (wall3d.tone: the lit ramp toward +y, the shade ramp toward +x;
the walls' level for level, the other families SHADE levels down), so it shades as the plain tile.wall.full.m5: the
plain m10 built so comes out as the plain m5 but for 32 AA px on the cap's front edge (out of 3319). A quarter turn
about z (MODE "turn": m5's l is m10's r turned) brings m10's hidden faces into view: 203 px off the plain m5."""
import math

from . import core
from . import wall3d as T
from . import windows as WN

MODE = "mirror"         # how m5 comes from m10: "turn" (a quarter turn about z) | "mirror" (across the x = y diagonal)
PARTS = {"turn": {"l": "r", "m": "m", "r": "l"}, "mirror": {"l": "l", "m": "m", "r": "r"}}   # m5's part -> m10's
COPY = {"turn": 1, "mirror": -1}            # the canonical piece's copy (dx) that lands on m5's -y side


def _grid_map(n):
    """A grid vector of the m10 piece where m5 puts it."""
    return (n[1], -n[0], n[2]) if MODE == "turn" else (n[1], n[0], n[2])


def _xform():
    from mathutils import Matrix
    if MODE == "turn":
        return Matrix.Rotation(math.radians(90), 4, "Z")    # (blender (X, Y) -> (-Y, X): grid (x, y) -> (y, -x))
    return Matrix(((0, -1, 0, 0), (-1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))   # (grid (x, y) -> (y, x))
PAL = "walls+hull+window"                   # (as the walls family's tiles, plus the window's set)


def _side_shade(n, top_side):
    """Whether wall3d.tone puts a face with grid normal n on the shade ramp (top_side: its axis, for tops/slopes)."""
    if abs(n[2]) < 0.3:
        return n[0] > n[1] + 1e-6
    return top_side == "x"


def _swap(k):
    """Recolour Relief k's faces for the move onto m5 (_grid_map): each face whose ramp side changes (wall3d.tone)
    takes the matching level of the other side's ramp."""
    lin = {}
    for fam, (ys, xs) in T.RAMPS.items():
        sh = 0 if fam == "wall" else T.SHADE            # (the default walls' shade ramp level for level; the other
        for i in range(6):                              # families' SHADE levels darker: wall3d.tone)
            j = i if i == 0 else max(1, i - sh)
            lin.setdefault((True, _key(core.lin(ys[i]))), core.lin(xs[j]))      # lit -> shade
            lin.setdefault((False, _key(core.lin(xs[j]))), core.lin(ys[i]))     # shade -> lit
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            p = [core.Vector(m.v[i]) for i in f[0][:3]]
            nb = (p[1] - p[0]).cross(p[2] - p[0])
            n = (-nb.x, nb.y, -nb.z)                    # (grid space: y = -blender y, which turns the winding)
            if nb.length < 1e-12:
                out.append(f)
                continue
            ln = math.sqrt(sum(c * c for c in n))
            n = tuple(c / ln for c in n)
            before = _side_shade(n, "y")
            after = _side_shade(_grid_map(n), "x")
            if before == after:
                out.append(f)
                continue
            cols = list(f[1:])
            for j in range(len(cols)):
                if any(cols[j]):
                    cols[j] = lin.get((not before, _key(cols[j])), cols[j])
            out.append((f[0], *cols))
        m.f = out


def _key(c):
    return tuple(round(v, 5) for v in c)


def _build(m, part):
    """(own, wide, pane objects) of a window piece."""
    from mathutils import Matrix
    from . import wall3d_iwin_ramp as R
    from . import wall3d_v2 as V2
    turn = m == 5
    p = PARTS[MODE][part] if turn else part
    dx = COPY[MODE] if turn else -1             # (the copy on the side drawn before the piece: m10's -x, m5's -y)
    seq = (p, ("m" if p in "lm" else None) if dx > 0 else ("m" if p in "mr" else None))

    def fn():
        if turn:
            inner = T.HOOK

            def hook(k, sp):
                inner(k, sp)
                _swap(k)
            T.HOOK = hook
        own = T.block(10, "wall", level="up")
        copy = T.block(10, "wall", level="up")
        for o in copy:
            o.data.transform(Matrix.Translation(core.G(dx, 0, 0.0)))
            o.data.update()
        return own, own + copy

    keep = T.STYLE, T.V2, T.VARIANT
    T.STYLE, T.V2, T.VARIANT = V2.plain_relief(), True, (0, 0)
    try:
        own, wide, glass = R.window(fn, p, R.TEAL, seq)()
    finally:
        T.STYLE, T.V2, T.VARIANT = keep
    if turn:
        rot = _xform()
        for o in set(wide) | set(glass):
            o.data.transform(rot)
            o.data.update()
    return own, wide, glass


def piece(m, part):
    sid = f"tile.wall.full.m{m}.win.{part}"
    it = WN.glass_item(sid, lambda: _build(m, part), WN.WALL_GLASS, PAL)
    return [it] if it else []


def jobs():
    return [lambda m=m, p=p: piece(m, p) for m in (10, 5) for p in ("l", "m", "r")]
