"""Tan (set 3, a working name): tan panelling. A lit header block under the cap; under it louvred slats either side of
a raised centre panel; a lip at the face's foot over a dark line and a blue one; the ramp pale tan cushions in
brown joints over a blue toe."""
import math

from mathutils import Vector

from .. import wall3d as T
from .base import Faction, _style
from .parts import LINE, PAINT, PX, PZ, R2, body, flat, prism
from .shell import Chamfer, FaceHoles, Feature, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends
from .tan_ramps import BLUE, FACE, OUTER, TAN_RAMPS
from .tan_tops import TAN_TOPS

HEAD_END = "fTS8"                  # the header block's ends on the lit side (they face the shade; its darkest blends
                                   # with the backdrop)
HEAD_D, HEAD_H = PX, 11 * PZ       # the header block: its depth (2 px of lit top), its front (a lit edge, 10 of face)
LIP_D, LIP_TOP = PX / 2, 6 * PZ    # the lip at the face's foot: its depth (a px of lit top), its top over the slope's
                                    # top (its front from there down to it: 4 px of face over a dark one)
GROOVES = (0, 10, 21)               # the face's upright grooves, by pixel column across a tile (32): its edge, the
                                    # centre panel's sides (10 px of face either side of it, 10 px of panel)
SLAT = 4 * PZ                       # the slats' pitch: a dark line, a lit one, 2 px of face
END = {"x": "fTX5", "y": "fTX4"}    # a free end's section, on an x / y end face; its front edge's highlight
END_EDGE = {"x": "fTX3", "y": "fTX2"}
SHADES = ("fTS0", "fTS1", "fTS2", "fTS3", "fTS8", "fTS7", "fTS4", "fTS5", "fTS6")   # the face's tones, light to dark


def _hid(d):
    """The rows a part d proud hides of the face under it (a PX shows 2 px down a lit face)."""
    return d / (PX / 2) * PZ


def sd(name, ax):
    """A face tone on an x (shade) face: a step darker (other colours, a screen's, as they are)."""
    if ax != "x" or name not in SHADES:
        return name
    return SHADES[min(len(SHADES) - 1, SHADES.index(name) + 1)]


class TanTones(Feature):
    """The shell's faces in the face's tan (the second tone), a free end's in the slate blue; the dark outlines at
    the foot and under the top stay."""
    def col_face(self, sp, face, x, y, z):
        if face != "d" and sp.end_face(face, x if face == "x" else y):
            return END[face]
        c = T.Shell.col_face(sp, face, x, y, z)
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        top = r[3] if r else sp.top
        if z < sp.zs + 0.02 or z > top - 0.03:
            return c
        if face == "d":                                 # (an outer corner's chamfer: a step lighter than the lit face's
            return lit("fTS3")                          # fTS3)
        return T.RAMPS[FACE][1 if face == "x" else 0][3]

    def end_tone(self, sp, fam, ox):                    # (the ramps' caps at a free end: its section's)
        return END[ox]


RIDGE = 1 / 32                      # an outer corner: chamfered this along each axis, wall and ramp (2 px across on
                                    # screen)


class RampRidge(Feature):
    """The ramp's chamfer band (Chamfer's) in the plates' tone between the blue line under the lip and the blue toe
    band, as the faces' bands run (the plates' pale edges either side of it: tan_ramps)."""
    def band(self, sp, fam):
        from .tan_ramps import EDGE
        B = T.RAMPS[BLUE][0][2]
        return [(0.02 + EDGE, B), (sp.run - 0.045 - EDGE, RIDGE_TONE), (sp.run - 0.045, OUTER), (sp.run - 1 / 32, B),
                (sp.run, "fTT2")]                       # (the plates' foot joint across it too)


RIDGE_TONE = "fTW2"


def lit(name):
    """A face tone on an outer corner's chamfer: a step lighter than the lit face's (it catches the light)."""
    return SHADES[max(0, SHADES.index(name) - 1)] if name in SHADES else name


def _rj(X, Y, C, s, d, z):
    return Vector((X - (1 - s) * C + d, Y + d - s * C, z))


def _round(k, X, Y, C, prof, cols, fam=FACE, lvl=3):
    """A face part's (d, z) profile carried round an outer corner chamfered C (parts.corner_piece), its edges with
    cols False left out."""
    m = len(prof)
    dc, zc = sum(q[0] for q in prof) / m, sum(q[1] for q in prof) / m
    for i in range(m):
        if cols[i] is False:
            continue
        (d0, z0), (d1, z1) = prof[i], prof[(i + 1) % m]
        pd, pz = z1 - z0, d0 - d1
        if pd * ((d0 + d1) / 2 - dc) + pz * ((z0 + z1) / 2 - zc) < 0:
            pd, pz = -pd, -pz
        k.poly([_rj(X, Y, C, 0, d0, z0), _rj(X, Y, C, 1, d0, z0), _rj(X, Y, C, 1, d1, z1), _rj(X, Y, C, 0, d1, z1)],
               fam, lvl, Vector((R2, R2, 0)) * pd + Vector((0, 0, 1)) * pz, fixed=cols[i])


def _cflat(k, X, Y, C, z0, z1, d, col):
    """A face band (flat) carried across an outer corner's chamfer, d proud."""
    k.poly([_rj(X, Y, C, 0, d, z0), _rj(X, Y, C, 1, d, z0), _rj(X, Y, C, 1, d, z1), _rj(X, Y, C, 0, d, z1)],
           "wall", 0, Vector((R2, R2, 0)), fixed=col)


def _col(c, n):
    """Pixel column n across the tile centred on c, as an upright 1 px groove (u0, u1): a touch narrower than a
    column, on its centre (a column's edges sit a quarter px past the tile's 32nds), so it stays one column wide."""
    u = c - 0.5 + (n + 0.3) / 32
    return u, u + 0.7 * LINE


def _panels(a, b):
    """The face over [a, b] on each tile's grid: (u0, u1, centre panel?, its grooves' columns: (u0, u1) each)."""
    out = []
    for c in range(-1, 2):
        e, l, r = (_col(c, n) for n in GROOVES)
        for u0, u1, mid, gs in ((c - 0.5, l[0], False, (e,)), (l[0], r[1], True, (l, r)),
                                (r[1], c + 0.5, False, ())):
            q0, q1 = max(a, u0), min(b, u1)
            if q1 - q0 > 1e-6:
                out.append((q0, q1, mid, gs))
    return out


HEAD_CURVE = 3                                  # the header cushions' corners: their curve's radius, in px


def _header(a, b, mit, lo_free, hi_free):
    """The header over [a, b] as a cushion: (u0, u1, mitre, its top and foot in by r) slices, square where the face
    turns a corner (mitred), else in half a px at a tile edge (a px at a free end), its corners curved in half px
    slices; and (u0, u1, False, None) over each end's outline (the gap and the curve, on the face behind)."""
    C, h = HEAD_CURVE, LINE / 2
    rnd = (mit[0] == 0.0, mit[1] == 0.0)
    ha = a + ((LINE if lo_free else LINE / 2) if rnd[0] else 0.0)
    hb = b - ((LINE if hi_free else LINE / 2) if rnd[1] else 0.0)
    ma, mb = ha + (C * LINE if rnd[0] else 0.0), hb - (C * LINE if rnd[1] else 0.0)
    out = [(ma, mb, (0.0 if rnd[0] else mit[0], 0.0 if rnd[1] else mit[1]), 0.0)]

    def ins(x):                                         # (x px from the end: the curve's inset there, in z)
        return (C - math.sqrt(max(0.0, C * C - (C - x) ** 2))) * PZ
    for i in range(2 * C):
        x = (i + 0.5) / 2
        if rnd[0]:
            out.append((ha + i * h, ha + (i + 1) * h, (False, False), ins(x)))
        if rnd[1]:
            out.append((hb - (i + 1) * h, hb - i * h, (False, False), ins(x)))
    if rnd[0]:
        out.append((a, ma, False, None))
    if rnd[1]:
        out.append((mb, b, False, None))
    return out


def tan(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, corner, back = _ends(ax, plane, b, ends)
        X, C = b, (RIDGE if getattr(T.SHELL, "clip", 0.0) else 0.0)
        if corner and C:                                # the chamfered corner: the parts stop where it starts and
            b -= C                                      # carry round it (drawn with the y face)
        cp = bool(corner and C and ax == "y")
        mit = (0.0 if back else {"in": -1.0}.get(ends[0], 0.0), {"out": 1.0, "in": -1.0}.get(ends[1], 0.0))
        rt = min(top, T.W.wall_top("wall", "up")) if full else top
        z1 = rt - 0.031                                 # the header's top (under the cap's black: Faction.paint)
        if endf:                                        # a wall's free end: its section in the slate blue
            _end_section(k, ax, plane, a, b, zs, top, F, col=END[ax], edge=END_EDGE[ax])
            sh = T.SHELL                                # (its feet too, over the section's in the face's colour)
            run, ft = getattr(sh, "run", T.W.skirt_run()), getattr(sh, "foot", 0.0)
            if ft > 0.0035:
                k.poly([T.P(ax, plane, u, z, 2 * PAINT) for u, z in ((a - run, 0.0035), (b + run, 0.0035),
                                                                     (b + run, ft), (a - run, ft))],
                       F, 2, T.OUT(ax), fixed=END[ax])
            return

        def band(u0, u1, z0, z1_, col, d=0.0):          # (a strip of one tone on the face, or on a part d proud)
            flat(k, ax, plane, u0, u1, z0, z1_, d + PAINT, sd(col, ax))
            if cp and abs(u1 - b) < 1e-6:
                _cflat(k, X, plane, C, z0, z1_, d + PAINT, lit(col))

        # the foot: the lip (its front's last px dark; the ramp's first row is the blue line under it)
        lip = T.fill("lip", True)                       # (a face design may go without it, down to the slope)
        zl0, zl1 = zs, zs + (LIP_TOP if lip else 0.0)
        if lip:
            prism(k, ax, plane, a, b, [(0.0, zl0), (LIP_D, zl0), (LIP_D, zl1), (0.0, zl1)], FACE, 3,
                  cols=[False, None, sd("fTS1", ax), False], mitre=mit)
            if cp:
                _round(k, X, plane, C, [(0.0, zl0), (LIP_D, zl0), (LIP_D, zl1), (0.0, zl1)], [False, "fTS2", "fTS0", False])
            band(a, b, zl0, zl0 + PZ, "fTS4", LIP_D)
        if not full:
            return

        def cushion(shaded=None):                       # the header block: its pale top, a lit edge on its front,
                                                        # a shadow 3 px under it (its front on the shaded side in
                                                        # this tone: a design's, over a darker face)
            zh0 = z1 - HEAD_H
            hd = _header(a, b, mit, back, end1)
            mb = max(q[1] for q in hd if q[3] == 0.0)   # (the cushion's curve at b: its slices' ends, seen through
            sm = (ends[0] == "cont" and not back, ends[1] == "cont" and not end1)   # the gap at a tile seam, dark;
            seam = OUTER if sm[1] else HEAD_END         # the gap dark on down to the shadow under the cushion)
            zg = zh0 - _hid(HEAD_D)
            for u0, u1, m, r in hd:                                 # (a cushion a tile: in half a px at a tile
                if r is not None:                                   # edge, a px at a free end, its corners curved,
                    continue                                        # the face behind the gap and the curves the
                lo = sm[1] if u0 > a + 1e-9 else sm[0]              # block's outline)
                band(u0, u1, zg if lo else zh0, z1, OUTER)
            for u0, u1, m, r in hd:
                if r is None:
                    continue
                prism(k, ax, plane, u0, u1, [(0.0, zh0 + r), (HEAD_D, zh0 + r), (HEAD_D, z1 - r), (0.0, z1 - r)],
                      FACE, 3, cols=[False, shaded if ax == "x" else None, sd("fTS0", ax), False], mitre=m,
                      cap=(HEAD_END, seam if u1 > mb - 1e-9 else HEAD_END) if ax == "y" else None)
                                                        # (its ends on the lit side: they face the shade)
                if cp and abs(u1 - b) < 1e-6:
                    _round(k, X, plane, C, [(0.0, zh0 + r), (HEAD_D, zh0 + r), (HEAD_D, z1 - r), (0.0, z1 - r)],
                           [False, "fTS2", "fTS0", False])
                band(u0, u1, z1 - r - PZ, z1 - r, "fTS1", HEAD_D)
            zs0 = zh0 - _hid(HEAD_D)                    # (the face's first row seen under the header)
            band(a, b, zs0 - 3 * PZ, zs0, "fTS7")      # (its shadow: 3 rows of a soft brown)
            return zs0

        alt = T.fill("body")                            # (a face design's own face over the lip, under the
        if alt:                                         # cushion if it keeps it)
            cu = T.fill("cushion", False)
            if cu:
                cushion(cu if isinstance(cu, str) else None)
            alt(k, ax, plane, a, b, mit, zl1, z1, band, sd)
            return
        zs0 = cushion()
        zt = zs0 - 6.5 * PZ                             # (3 px of face, then the slats and the panel)
        ztop = zl1 + (int((zt - PZ - zl1) / SLAT + 1e-6) + 1) * SLAT   # the slats' top seam (a row up into the face
                                                                        # under the shadow), the panel's top level with it
        for u0, u1, mid, gs in _panels(a, b):
            g0 = zl1                                    # (the grooves' foot)
            if mid and corner and b - u0 < 0.5:         # (beside an outer corner: no panel, the slats on round it,
                mid, g0 = False, ztop                   # its grooves only over the slats, under the header)
            if not mid:                                 # either side of the panel: slats up from the lip, each a
                z = zl1                                 # dark seam over a lit line (the first seam on the lip, its
                while z <= ztop + 1e-6:                 # lit line under it hidden), 2 px of face between
                    band(u0, u1, z, z + PZ, "fTS4")
                    band(u0, u1, z - PZ, z, "fTS1")
                    z += SLAT
                for g in gs:                            # a groove up each tile's edge to the header
                    if u0 - 1e-6 <= g[0] and g[1] <= u1 + 1e-6:
                        band(g[0], g[1], g0, zs0, "fTS4", PAINT)   # (over the bands across it)
                continue
            zp0, zp1 = zl1 + PZ, ztop                   # the centre panel, flush: a groove round it, a 2 px bevel lit
            band(u0, u1, zp1, zp1 + PZ, "fTS4")         # along its top, a soft shadow along its foot
            band(u0, u1, zp1 - 2 * PZ, zp1, "fTS2")
            band(u0, u1, zp0 + PZ, zp0 + 3 * PZ, "fTS8")
            band(u0, u1, zp0 + PZ, zp0 + 2 * PZ, "fTS7")
            band(u0, u1, zl1, zp0 + PZ, "fTS4")
            for g in gs:                                # (its side grooves on up to the header)
                if u0 - 1e-6 <= g[0] and g[1] <= u1 + 1e-6:
                    band(g[0], g[1], zl1, zs0, "fTS4", PAINT)   # (over the bands across it)
    return face


class Tan(Faction):
    pre = "fT"

    def relief(self, sprite):
        return _style(tan, skirt=None, seam=0, ramp_solid=True, shell=LookShell,
                      toe_lvl={"wall": "fTT2", "blue": "fTT2"}, chamfer=RIDGE, tops=TAN_TOPS, ramps=TAN_RAMPS,     # (the toe blue, its foot
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone(BLUE, 2), FaceHoles(),  # darker)
                                TanTones(), Chamfer(RIDGE), RampRidge()))
