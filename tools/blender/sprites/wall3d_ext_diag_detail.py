"""Detail on the exterior hull's generic pieces (wall3d_ext_diag): hull 46's layout for each side, drawn in the run
set's tones and line styles (wall3d_ext_t3, _t32, _t33: a seam a dark core with a lit px under it, recesses with a
dark wall and a shadow under their top, parts a px or two proud lit along the top and shaded round their unseen faces).
A side's detail is laid out along the side itself (in screen px across it, and px up from its bend or down from it),
repeating once a step, so a feature crossing from one tile into the next lines up: each tile draws its own share
(clipped to its column and the other sides' cuts, so it stops at a hip).

The near diagonal (BottomD1): over the bend, a panel framed by two seams under a seam across, two square vents sunk in
it, and two more seams across above; five slots recessed across the bend; the run's seam across the upright, a clamp
over it at each side of a plate a px proud from it down to the foot."""
import math

from mathutils import Vector

from .wall3d_ext_geom import D, HILITE, LEAN_RISE, LINE, LINE_W, PAINT, YS
from .wall3d_ext_t3 import UPRIGHT_SEAM
from . import hull_outline as HO

Z64 = 32 * math.sqrt(2) * math.cos(math.radians(30))     # px a unit of height at the art's tile (64 px across)
UP = Vector((0, 0, 1))
CORE, DARK, LIT = YS[3], YS[1], YS[4]                    # a seam's core on the lean; on the upright part; a lit px
WALL, FLOOR, SHADOW = "hsXM", "hsXS", "hsD"              # a recess's (T3-3's)

BD1_SEAMS = (20, 26, 32)            # px up the lean: seams right across (the lowest the panel's top)
LEVEL_SEAM = ("hsSeamSoft", CORE, "hsSeamMid", "hsSeamHi")    # a level seam on the lean, px rows down (as the run's
                                    # slant ones come out of coverage anti-aliasing)
FAINT_SEAM = (YS[4], "hsSeamSoft")  # the top one: the run's faint seam under its top panel (no dark core, no lit px)
BD1_PANEL = (-17, 15)               # px across: seams down the panel's sides, from the bend to its top
BD1_VENTS = ((-12, 5), (11, 6))     # two square vents sunk in the panel: their left edges; px up the lean, px square
BD1_SLOTS = (-15, 6, 5, 2, 18, 3)   # five slots: the first's left edge, pitch, width; their lip px up the lean, px
                                    # down the upright, their shadow px down from their top
BD1_CLAMPS = ((-9, -3), (4, 10), 4)     # px across; px up and down from the seam (2 px proud: wall3d_ext_t3's)
BD1_PLATE = ((-10, 9), 2)           # px across; up to this many px under the seam, from the foot (a px proud, lit bolts
                                    # 2 px in from its corners)
SIDE_SEAMS = (21, 33)               # the side diagonals (SideD1): seams along the lean at the near one's (px up it)


def _slab(n, c, t):
    """The thin slab just outside the plane n . p <= c, t thick."""
    return [(n, c + t * n.length), (-n, -c)]


def _seam(v0, v1, along, on="lean", rows=LEVEL_SEAM):
    """A seam's marks over [v0, v1] (px up the lean or down the upright; along: (u0, u1) across, or a seam down the
    face at u0 when u1 is None): its dark core (LINE_W thick), a lit px under it (on its +u side if down). One across
    the lean lies level on screen, where coverage anti-aliasing has nothing to soften: it is painted as a run's slant
    seam comes out (LEVEL_SEAM: a soft px over the core, a half-lit one and a lit one under it), on whole px rows."""
    core, hi = (CORE, HILITE) if on == "lean" else (DARK, LIT)
    u0, u1 = along
    if u1 is None:
        return [(on, u0 + 1 - LINE_W, u0 + 1, v0, v1, core, 1), (on, u0 + 1, u0 + 2, v0, v1, hi, 1)]
    if on == "lean":
        return [(on, u0, u1, v0 + 1 - i - (rows is FAINT_SEAM), v0 + 2 - i - (rows is FAINT_SEAM), col, 1)
                for i, col in enumerate(rows)]
    return [(on, u0, u1, v0, v0 + 1, core, 1), (on, u0, u1, v0 - 1, v0, hi, 1)]


def near(rel, solid, others, s, c, g, H):
    """The near diagonal's detail (s = (1, 1), its outline s . p = c in the tile; `others`: the cuts from the tile and
    the other sides, `solid`: the convex solid builder, rel: the piece's Relief)."""
    k, zb = D / LEAN_RISE, H - LEAN_RISE
    t = Vector((1.0, -1.0, 0.0))                                        # (u: px across, x - y = px / 32)
    lean = (s + g * k * UP, c - g * D + g * k * H)
    rise = _rise(g)                                                     # (screen px a unit of height up the lean)
    step = round((c * 32 + 1) / 32) % 2                                 # (rows behind the steps: their middles at u
    centres = [(2 * m - step) for m in (-1, 0, 1)]                      # = -rows, mod 2)

    off = (c * 16 - zb * Z64) % 1                                       # (the bend's px row: px up the lean / down
                                                                        # the upright counted from its top, so marks
    def z(on, v):                                                       # land on whole px rows)
        return zb + (v + off) / rise if on == "lean" else zb - (v - off) / Z64
    marks = []                                                          # (on, u0, u1, v0, v1, tone, layer)
    for v in BD1_SEAMS:
        marks += _seam(v, v, (-32, 32), rows=FAINT_SEAM if v == max(BD1_SEAMS) else LEVEL_SEAM)
    for u in BD1_PANEL:
        marks += _seam(0, BD1_SEAMS[0], (u, None))
    (a0, a1), (v, n) = BD1_VENTS
    for a in (a0, a1):                                                  # (sunk: its top and left edges dark, its
        marks += [("lean", a, a + n, v + n - 1, v + n, CORE, 1), ("lean", a, a + 1, v, v + n, CORE, 1),   # bottom
                  ("lean", a + 1, a + n, v, v + 1, HILITE, 1), ("lean", a + n - 1, a + n, v + 1, v + n, HILITE, 1)]
    x0, pitch, w, lip, down, sh = BD1_SLOTS                             # (and right edges lit)
    for i in range(5):
        a = x0 + i * pitch
        marks += [("lean", a, a + w, 0, lip, CORE, 1), ("up", a, a + w, 0, down, FLOOR, 1),
                  ("up", a, a + 1, 0, down, WALL, 2), ("up", a + w - 1, a + w, 0, down, DARK, 2),
                  ("up", a + 1, a + w - 1, 0, sh, SHADOW, 2)]
    gz = (zb - UPRIGHT_SEAM) * Z64                                      # (the run's seam, px down the upright)
    marks += [("up", -32, 32, gz - 1, gz, DARK, 1), ("up", -32, 32, gz, gz + 1, LIT, 1)]
    raised = []                                                         # (u0, u1, v0, v1, px proud)
    (pa, pb), gap = BD1_PLATE
    raised.append((pa, pb, gz + gap, zb * Z64, 1))
    *clamps, ch = BD1_CLAMPS
    raised += [(a, b, gz - ch, gz + ch, 2) for a, b in clamps]
    for a, b, v0, v1, _ in raised:                                      # (shaded round its unseen faces: a px
        marks += [("up", a - 1, a, v0, v1, DARK, 2), ("up", a - 1, b, v1, v1 + 2, DARK, 2)]  # beside, 2 under)
    for cu in centres:
        def box(u0, u1, v0, v1, on):
            za, zc = sorted((z(on, v0), z(on, v1)))
            return [(t, cu + u1 / 32), (-t, -(cu + u0 / 32)), (UP, zc), (-UP, -za)]
        for on, u0, u1, v0, v1, col, layer in marks:
            n, cc = (s, c) if on == "up" else lean
            _paint(rel, solid, others + box(u0, u1, v0, v1, on), n, cc, col, layer)
        for a, b, v0, v1, out in raised:
            _raised(rel, solid, others + box(a, b, v0, v1, "up"), s, c, out * LINE)
            if out == 1:                                                # (the plate's bolts)
                for u in (a + 2, b - 3):
                    for v in (v0 + 2, v1 - 3):
                        _paint(rel, solid, others + box(u, u + 1, v, v + 1, "up"), s, c + LINE * s.length, LIT, 1)


def _raised(rel, solid, cuts, n, c, out):
    """A part `out` proud of the face n . p = c inside the cuts: its front the upright part's tone, lit along its
    top, its sides shaded."""
    m0 = n.normalized()
    for pts, m, _ in solid(cuts + [(n, c + out * n.length), (-n, -c + 0.002)]):
        rel.poly(pts, "steel", 3, m, fixed=YS[2] if (m - m0).length < 1e-6 else LIT if m.z > 0.85 else DARK)


def _paint(rel, solid, cuts, n, c, col, layer):
    """A painted mark on the face n . p = c (its slab `layer` PAINTs out), inside the cuts."""
    out = n.normalized()
    for pts, m, _ in solid(cuts + _slab(n, c, layer * PAINT)):
        if (m - out).length < 1e-6:                                     # (its outer face)
            rel.poly(pts, "steel", 3, m, fixed=col)


def _rise(g):
    """Screen px a unit of height up a lean of depth scale g, at the art's tile (a near diagonal's or a run's)."""
    return Z64 + 16 * g * D / LEAN_RISE


def side_diag(rel, solid, others, s, c, g, H):
    """A side diagonal's detail (SideD1): seams along its lean, at the heights of the near diagonal's (its upright is
    edge-on to the camera)."""
    k, zb = D / LEAN_RISE, H - LEAN_RISE
    lean = (s + g * k * UP, c - g * D + g * k * H)
    rise = _rise(HO.deep((1, 1)))                                       # (the near diagonal's)
    for v in SIDE_SEAMS:
        for _, _, _, v0, v1, col, layer in _seam(v, v, (0, 0)):
            _paint(rel, solid, others + [(UP, zb + v1 / rise), (-UP, -(zb + v0 / rise))], *lean, col, layer)


def run(rel, solid, others, s, c):
    """A near straight run's share of a piece (a join's, a corner's): the run's seam across its upright, as the run
    set draws it (wall3d_ext_t3), so it carries on round to the diagonal's."""
    for z0, z1, col in ((UPRIGHT_SEAM, UPRIGHT_SEAM + 1 / Z64, DARK), (UPRIGHT_SEAM - 1 / Z64, UPRIGHT_SEAM, LIT)):
        _paint(rel, solid, others + [(UP, z1), (-UP, -z0)], s, c, col, 1)


def detail(rel, solid, fronts, g_fronts, side, tile, H, skip=()):
    """Each side's detail on a convex run's part: fronts (s, c, g) as Vectors, g_fronts their keys' (s, c32); not on
    those in `skip` (their art the run set's)."""
    k = D / LEAN_RISE
    for i, ((s, c, g), (s2, _)) in enumerate(zip(fronts, g_fronts)):
        if i in skip or s2 not in ((1, 1), (1, 0), (0, 1), (1, -1), (-1, 1)):
            continue
        others = tile + side + [(UP, H), (-UP, 0.0)]
        for j, (sj, cj, gj) in enumerate(fronts):
            if j != i:
                others += [(sj, cj), (sj + gj * k * UP, cj - gj * D + gj * k * H)]
        if s2 == (1, 1):
            near(rel, solid, others, s, c, g, H)
        elif s2 in ((1, -1), (-1, 1)):
            side_diag(rel, solid, others, s, c, g, H)
        else:
            run(rel, solid, others, s, c)
