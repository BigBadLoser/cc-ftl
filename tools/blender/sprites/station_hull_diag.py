"""The station hull's generic pieces (#524): every hull outline key that isn't the run set's (diagonals, far sides,
notches), built as the ship's are (wall3d_ext_diag: each tile's solid the convex solid inside its fronts' cuts) but on
the station's section (station_hull.RoundSection: upright, then the bullnose, as one flat cut per facet) and in its
tones and dress: the bullnose's bands, the groove, the step along the foot, the seams up the face and over into the
top, the line under the bullnose and the top's lines.

Along a front, a tile carries one panel set (as the run set's straight tile: two seams, the centre panel between
them), spread over the front's span across the tile (a diagonal's is a tile's diagonal): its px details stay px wide."""
import math
from itertools import product, repeat

from mathutils import Vector

from . import core
from . import hull_outline as HO
from . import wall3d as T
from . import walls as W
from . import station_hull as SH
from .wall3d_ext_diag import UP, WIDE, _cells, _corners, _front, _lift, _solid, _tile
from .wall3d_ext_geom import D, LINE, PAINT

EDGE = 1e-6
# A level line (along a near diagonal: level on screen, where coverage anti-aliasing has nothing to soften) is painted
# on whole px rows as the run set's slant ones come out: px rows from the one over its line down, by line.
LEVEL_LINE = ("stM", "stLnCore", "stLnLit")         # the groove, the line under the bullnose (a dark line, lit under)
LEVEL_FOOT = ("stLnSoft", "stLnMid")                # the seam where the step meets the face (over the step's lit top)


def _sec(H):
    return SH.RoundSection(H)


def _recess(sec, z):
    """How far the front stands in from the outline at height z (0 on the upright part, R_D at the top)."""
    return D - sec.lean_d(z)


def _cuts(s, c, w, sec, eps=0.0):
    """A front's cuts: its upright face and a flat cut per bullnose facet (s . p <= c - w recess(z), linear over
    each), eps behind them; unit normals (the facets near the top stand near flat: their normals long, single float
    precision drops their corners off them in _solid)."""
    out = [(s, c - eps * s.length)]
    for z0, z1 in zip(sec.levels, sec.levels[1:]):
        r0, r1 = _recess(sec, z0), _recess(sec, z1)
        m = (r1 - r0) / (z1 - z0)
        n = s + w * m * UP
        out.append((n / n.length, (c - w * r0 + w * m * z0) / n.length - eps))
    return out


def _part(g, side, sec, tile, extra=()):
    """A convex run's parts [(ends, rest)] (split at the groove: the face's two tones), the cuts they share and its
    fronts (s, c, w)."""
    fronts = [_front(f) for f in g]
    faces = [(UP, sec.H), (-UP, 0.0)]
    for s, c, w in fronts:
        faces += _cuts(s, c, w, sec)
    faces += list(extra)
    lo, hi = (UP, SH.GROOVE), (-UP, -SH.GROOVE)
    return [(tile, faces + side + [lo]), (tile, faces + side + [hi])], side + [lo, hi], fronts


def _ship(stretch, sec, eps=0.002):
    """A stretch's ship side as cells (wall3d_ext_diag._ship, on the station's section)."""
    cells = []
    for g, before, after in HO.groups(stretch):
        cell = [_lift(HO.nearer(o, f)) for o, f in ((before, g[0]), (after, g[-1])) if o]
        for s, c, w in map(_front, g):
            cell += _cuts(s, c, w, sec, eps)
        cells.append(cell)
    return cells


def _tone(pts, m, fronts, sec):
    """A face's tone by facing and height: the top TOP, the bullnose its bands (by the arc's angle at the face's
    height), a front's upright face FACE (FACE_LO under the groove), anything else the shell's END."""
    zc = sum(p.z for p in pts) / len(pts)
    if m.z > 0.85 and min(p.z for p in pts) >= sec.H - 1e-6:
        return SH.TOP
    if abs(m.z) < 1e-3 and any(abs(m.dot(s.normalized()) - 1) < 1e-6 for s, _, _ in fronts):
        return SH.FACE if zc > SH.GROOVE else SH.FACE_LO
    if m.z > 1e-3 and zc > sec.zb - 1e-6:
        return SH._band(1 - sec._angle(zc) / (math.pi / 2))
    return SH.END


def _emit(rel, parts, fronts, skip, sec):
    """Each part as one solid, toned by facing (_tone); its ends on the tile's edges in a fan, each wedge in the tone
    of the face across its edge (wall3d_ext_diag._emit). Faces on a plane in `skip` left out."""
    for ends, rest in parts:
        planes = ends + rest
        faces = _solid(planes)

        def across(p, q, j):
            for pts, m, i in faces:
                if i != j and any((p - r).length < 1e-6 for r in pts) and any((q - r).length < 1e-6 for r in pts):
                    return SH.FACE if i < len(ends) else _tone(pts, m, fronts, sec)
            return SH.FACE
        for pts, m, i in faces:
            if any(planes[i] is q for q in skip):
                continue
            if i >= len(ends):
                rel.poly(pts, "steel", 3, m, fixed=_tone(pts, m, fronts, sec))
                continue
            mid = sum(pts, Vector()) / len(pts)
            for p, q in zip(pts, pts[1:] + pts[:1]):
                rel.poly([mid, p, q], "steel", 3, m, fixed=across(p, q, i))


def _paint(rel, planes, i, col, more=()):
    """The face on planes[i] of the solid inside planes and `more`, lifted PAINT off it, in col (lifted after the cut:
    a raised plane would be cut away by a near flat neighbour, the bullnose's facets)."""
    for pts, m, j in _solid(list(planes) + list(more)):
        if j == i:
            rel.poly([p + m * PAINT for p in pts], "steel", 3, m, fixed=T.SEAM_PASS or col)


def _along(s):
    """A front's run direction (level, unit), its span across a tile (1 a run, sqrt 2 a diagonal: the tile's
    diagonal) and an art px along it (tile units)."""
    t = UP.cross(s).normalized()
    return t, s.length, 1 / max(abs(t.x - t.y) * core.TILE_W / 2, abs(t.x + t.y) * core.TILE_H / 2)


def _level(s):
    """Whether a front lies level on screen (a near diagonal: seen face on)."""
    return abs(s.x - s.y) < 1e-6 and s.x > 0


def _snap(sec, z):
    """The height nearest z on the groove's px rows (the groove's line lies on whole rows)."""
    return sec.z_at(SH.GROOVE, round(sec.sy(z) - sec.sy(SH.GROOVE)))


def _phase(f, L):
    """Where the front's tiles' centre panels sit along it (tile-local): a diagonal's tiles step half its span along
    it a tile out (its key's c says how many tiles out the front runs)."""
    if L < 1.01:
        return 0.0
    n = round((f[1] + 1) / 32)
    return (n % 2) * L / 2


def _range(t, a, b):
    """Cuts a <= t . p <= b."""
    return [(t, b), (-t, -a)]


def _dress(rel, g, fronts, cut, top, ups, sec):
    """The fronts' dress (cut: the part's planes, the groove's split left out; top: the top's index in it; ups: each
    front's upright face's, its facets after it): the groove (a dark line, a lit one under it), the seam where the
    step meets the face, the seams up the face and over the bullnose to the top's seam, the line under the bullnose
    (on the centre panels), and the top's two lines."""
    H = sec.H
    zt = sec.z_at(sec.zb, SH.UNDER)
    ts = round((SH.R_D + SH.TOP_SEAM) * 32) / 32           # (the top's seam: this far in from the front)
    rail = HO.LIP - SH.RAIL - LINE                          # (its line along the back)
    nf = len(sec.levels) - 1
    for f, (s, c, w), up in zip(g, fronts, ups):
        t, L, px = _along(s)
        level = _level(s)
        sh = px / 2 if level else 0.0                       # (level: its marks on whole px columns)
        ph = _phase(f, L)
        lines = []                                          # (the level lines: z, rows, from row, t range)
        for z, rows, n0, cols in ((SH.GROOVE, LEVEL_LINE, -2, (SH.GROOVE_D, SH.GROOVE_L)),
                                  (SH.FOOT_H, LEVEL_FOOT, -3, (SH.GROOVE_D,))):  # (over the step's top's
            lines.append((z, rows, n0, cols, ()))                                   # lit front px)
        for k in range(-2, 3):                              # (the line under the bullnose, on the centre panels)
            m = ph + k * L + sh
            lines.append((zt, LEVEL_LINE, -2, (SH.GROOVE_D, SH.UNDER_L),
                          _range(t, m - L / 4 + px / 2, m + L / 4 - px / 2)))
        for z, rows, n0, cols, band in lines:
            if level:
                z = _snap(sec, z)
                for i, col in enumerate(rows):
                    n = n0 + i
                    _paint(rel, cut, up, col, list(band) + [(UP, sec.z_at(z, n)), (-UP, -sec.z_at(z, n + 1))])
            else:
                for n, col in zip((-1, 0), cols):
                    _paint(rel, cut, up, col, list(band) + [(UP, sec.z_at(z, n)), (-UP, -sec.z_at(z, n + 1))])
        for k in range(-3, 3):                              # (the seams: from the groove up, over the bullnose)
            a = ph + k * L / 2 + L / 4 + sh
            band = _range(t, a - px / 2, a + px / 2)
            _paint(rel, cut, up, SH.SEAM, band + [(-UP, -sec.z_at(SH.GROOVE, -1))])
            for j in range(1, nf + 1):
                _paint(rel, cut, up + j, SH.SEAM, band)
            _paint(rel, cut, top, SH.SEAM, band + [_lift(HO.at_least(f, SH.R_D - 0.01)),
                                                    _lift(tuple(-v for v in HO.at_least(f, ts)))])
        for d0 in (ts, rail):                               # (the top's seam and its line along the back)
            band = [_lift(HO.at_least(f, d0)), _lift(tuple(-v for v in HO.at_least(f, d0 + LINE)))]
            band += [_lift(HO.at_least(h, d0)) for h in g if h is not f]
            _paint(rel, cut, top, SH.SEAM, band)
        del c, w


def _step(rel, g, cut, sec):
    """The step along the foot: the run's fronts facing the camera or edge-on FOOT_OUT out (those facing away flush:
    unseen), its front STEP_FRONT px tall (cut: the tile's column, its cells), its top FOOT_TOP and front
    FOOT."""
    zf = sec.z_at(SH.FOOT_H, SH.STEP_FRONT)
    planes = [(UP, SH.FOOT_H), (-UP, -zf)] + [(s, c + w * (SH.FOOT_OUT if s.x + s.y >= 0 else 0.0))
                                              for s, c, w in map(_front, g)]
    for pts, m, i in _solid(cut + planes):
        if i >= len(cut):
            rel.poly(pts, "steel", 3, m, fixed=SH.FOOT_TOP if m.z > 0.85 else SH.FOOT if m.z > -0.5 else SH.END)


def _box(rel, cut, s, c, w, t, a, b, z0, z1, out, front, top, side):
    """A block proud of a front's upright face: [a, b] along it, z0 to z1, out proud (cut: the tile's column, its
    cells); its front, top and sides in their tones."""
    planes = _range(t, a, b) + [(UP, z1), (-UP, -z0), (s, c + w * out)]
    for pts, m, i in _solid(cut + planes):
        if i >= len(cut) and m.z > -0.5:
            rel.poly(pts, "steel", 3, m, fixed=top if m.z > 0.85 else front if abs(m.dot(s.normalized()) - 1) < 1e-6
                     else side)


def _bits(rel, f, fr, cut, sec):
    """A front's proud bits, as the run set's straight tile's: a tab on the groove in from each seam, a plate on the
    line under the bullnose in the middle of the centre panel, the step's two blocks."""
    s, c, w = fr
    t, L, px = _along(s)
    ph = _phase(f, L) + (px / 2 if _level(s) else 0.0)     # (level: on whole px columns, as _dress's marks)
    zt = sec.z_at(sec.zb, SH.UNDER)
    g0, g1 = sec.z_at(SH.GROOVE, 3), sec.z_at(SH.GROOVE, -2)
    pz = SH.PLATE_Z(sec, zt)
    bt, bf = sec.z_at(SH.FOOT_H, -1), sec.z_at(SH.FOOT_H, SH.STEP_FRONT + 1)
    for k in range(-2, 3):
        m = ph + k * L
        for sg in (1, -1):                                  # (the tabs: in from the seams toward the middle)
            g = m - sg * L / 4 + sg * SH.TAB_IN * px
            _box(rel, cut, s, c, w, t, g - SH.TAB_W / 2 * px, g + SH.TAB_W / 2 * px, g0, g1, LINE,
                 SH.TAB, SH.TAB_TOP, SH.TAB_SIDE)
            b = m + sg * 6.5 / 32 * L                       # (the step's blocks)
            _box(rel, cut, s, c, w, t, b - 3.5 * px, b + 3.5 * px, bf, bt, SH.FOOT_OUT + LINE,
                 SH.BLOCK, SH.BLOCK, SH.GROOVE_D)
            _paint(rel, cut + _range(t, b - 3.5 * px, b + 3.5 * px) + [(s, c + w * (SH.FOOT_OUT + LINE))],
                   len(cut) + 2, SH.BLOCK_LIT, [(UP, bt), (-UP, -sec.z_at(bt, 1))])
        hw = (SH.TAB_W / 2 + 1) * px
        _box(rel, cut, s, c, w, t, m - hw, m + hw, pz[0], pz[1], LINE, SH.TAB, SH.TAB_TOP, SH.TAB_SIDE)


def piece(key, H=None, margin=0.0):
    """The station hull piece of a tile with this key (hull_outline.key); as wall3d_ext_diag.piece."""
    H = W.hull_top() if H is None else H
    sec = _sec(H)
    rel = T.Relief(f"st_solid_{HO.name(key)}")
    art, stretches = [], HO.parse(key)
    for n, stretch in enumerate(stretches):
        groups = HO.groups(stretch)
        others = [_ship(st, sec) for j, st in enumerate(stretches) if j != n]
        for gi, (g, before, after) in enumerate(groups):
            runs = [i for i, (s2, _) in enumerate(g) if s2 in HO.NEAR] if len(g) > 1 or before or after else []
            for side in _cells(g, _corners(groups, gi)):
                for extra in map(sum, product(*others), repeat([])):
                    parts, shared, fronts = _part(g, side, sec, _tile(margin), extra)
                    nl, rest = len(sec.levels), parts[0][1]         # (each front's cuts: its face, its facets)
                    mine = [rest[2 + i * nl:2 + (i + 1) * nl] for i in range(len(g))]
                    _emit(rel, parts, fronts, shared + [q for i in runs for q in mine[i]], sec)
                    tile = _tile(margin)
                    keep = [i for i in range(len(g)) if i not in runs and g[i][0][0] + g[i][0][1] > 0]
                    _dress(rel, [g[i] for i in keep], [fronts[i] for i in keep], tile + rest[:-1], len(tile),
                           [len(tile) + 2 + i * nl for i in keep], sec)
                    out = SH.FOOT_OUT + LINE                        # (the step and its blocks stand out past
                    wide = [(n, c + (out if any(n.dot(fr[0]) > 1e-6 and fr[0].x + fr[0].y >= 0 for fr in fronts)
                                     else 0.0)) for n, c in tile] + side + list(extra)    # the tile only in front)
                    _step(rel, g, wide, sec)
                    for i in keep:
                        _bits(rel, g[i], fronts[i], wide, sec)
                    for i in runs:                                  # (the run's art, cut by the rest's faces)
                        art.append((g[i][0], [q for j in range(len(g)) if j != i for q in mine[j]] + side + extra))
    objs = rel.build() if rel.m.f else []
    for s2, cut in art:
        objs += _run_art(s2, cut)
    return objs


def _run_art(s2, cut):
    """The station's plain straight run along a near side, clipped to the cuts (wall3d_ext_diag._run_art)."""
    from unittest import mock
    from . import wall3d_ext, wall3d_ext_diag as DG
    with mock.patch.object(wall3d_ext, "ext_block", SH._block):
        return DG._run_art(s2, cut)


def roof(key, H=None):
    """The roof over the rest of the tile, in the station's top tone (wall3d_ext_diag.roof)."""
    from unittest import mock
    from . import wall3d_ext_diag as DG
    with mock.patch.object(DG, "TOP", SH.TOP):
        return DG.roof(key, H)
