"""The default walls' second look (made on art/hull-windows, 2026-11-06): slate's rail (three blocks a tile, the middle
set back) under the cap and its lip at the face's foot in place of the header and low band, plain posts, a solid ramp
with a flat shelf against the wall, one plate a tile on it with the panel drawn as a seam line round its plate and
slot. It is what the interior windows were designed on (#516: wall3d_iwin_def, wall3d_iwin_ramp), so their pieces
build in it: wall3d.V2 set while one builds sends wall_face here (and skirt, with STYLE this look's plain_relief() below): the
walls family's default pieces (envtiles._plain) and the window pieces (windows_iwin). The faction looks keep their
own faces and ramps.

The rail's and lip's measures are slate's (faction.slate on art/hull-windows)."""
from mathutils import Vector

from . import walls as W
from . import wall3d as T
from .faction.parts import PX, PZ, prism

RAIL_D, MID_D = PX, PX / 2          # the rail's depth: its end blocks' (2 px), its middle block's (set back a px)
RAIL_H = 7 * PZ                     # the rail's front
END_W = 0.25                        # its end blocks along a tile (the middle block between them)
LIP_D, LIP_H = PX, 3 * PZ           # the lip at the face's foot: its depth (2 px), its height
MID_DROP = 3 * PZ                   # the middle block's top: its front edge this far under its back
SHELF = 4 / 32                      # the ramp's top a flat step this deep against the wall (4 px)
POSTS = "tile"  # a face's posts while a piece builds: "tile" (at each tile edge), "none" (a diagonal wall's fill),
#   "all" (its join: one post the face's length); either of the last two with no lip or rail seams
PLAIN = False   # every field plain (no panel) while a piece builds: a diagonal wall's fill and joins
NUDGE = True    # the px nudges that centre a face's parts between its posts on screen (_nudge); off for a face seen
#   square on (a diagonal wall), where depth moves nothing sideways
PX0 = 0.875     # where the camera's px boundaries fall along the default wall's front (in px, off u's own grid)
_STYLE = []


def plain_relief():
    """The default walls' relief in this look (faction.base.plain_relief's, with slate's ramp top: a flat shelf)."""
    if not _STYLE:
        from dataclasses import replace
        from .faction.base import plain_relief as first
        _STYLE.append(replace(first(), ramp_solid=True, shelf=SHELF, shelf_lvl=2, shelf_back=(0, 1)))
    return _STYLE[0]



SNAP = {"y": 0.25, "x": 0.75}   # per face axis: the phase (in px of height) of the screen's px rows on a straight face
#   (_paint); thin bands sit on whole rows there so a 1 px line runs in clean pairs, not dots


YD = 64 / 4                  # screen px down per unit a part stands proud of a straight face


def _row(z, d, half=0.0):
    """z on the screen's row grid for a part d proud of a straight face (NUDGE; SNAP's phase, moved half a row with
    half=0.5: the other way a 1 px line's two-px steps can pair up)."""
    if _AX[0] is None:
        return z
    ph = (SNAP[_AX[0]] + YD * d if NUDGE else SNAPD + YD * d / SQ) + half
    return (round(z * W.ZART - ph) + ph) / W.ZART


_AX = [None]


def _paint(k, ax, plane, u0, u1, z0, z1, d, fam, tone, foot=0.0, top=None):
    """T.paint, its top and foot on the screen's px rows on a straight face (_row; foot: the foot's half-row choice,
    top: the top's own, snapped alone, else the height kept)."""
    _AX[0] = ax
    dd = d + T.PAINT
    h = z1 - z0                                         # (its foot on a row, its height whole px as near as can be:
    z0 = _row(z0, dd, foot)                             #   snapping both ends alone could take or add a px)
    if top is not None:
        z1 = _row(z1, dd, top)
    elif _AX[0] is not None:
        z1 = z0 + max(1, round(h * W.ZART)) / W.ZART
    else:
        z1 = z0 + h
    if z1 - z0 > 1e-6:
        T.paint(k, ax, plane, u0, u1, z0, z1, d, fam, tone)

def _nudge(ax):
    """The px a face's rail and lip seams move along u to sit centred between its posts on screen (a part's depth moves
    it a px sideways per LINE, one way on each axis's faces): (rail, lip)."""
    if not NUDGE:
        return 0.0, 0.0
    return (T.LINE, -T.LINE) if ax == "y" else (T.LINE, 0.0)


def _blocks(a, b, sh=0.0):
    """The rail's blocks over [a, b], on each tile's grid: (u0, u1, middle?); the middle block moved sh along u."""
    out = []
    for c in range(-1, 2):
        for u0, u1, mid in ((c - 0.5, c - 0.5 + END_W + sh, False), (c - 0.5 + END_W + sh, c + 0.5 - END_W + sh, True),
                            (c + 0.5 - END_W + sh, c + 0.5, False)):
            q0, q1 = max(a, u0), min(b, u1)
            if q1 - q0 > 1e-6:
                out.append((q0, q1, mid))
    return out


def _thirds(a, b, sh=0.0):
    """The lip's seams over [a, b] (each a px from u): a tile in three 10 px sections, moved sh along u."""
    return [u for c in range(-1, 2) for u in (c - 0.5 + 10.3 / 32 + sh, c - 0.5 + 21.3 / 32 + sh)
            if a + T.LINE < u < b - T.LINE]


def _mitres(ends):
    return tuple({"out": 1.0, "in": -1.0}.get(e, 0.0) for e in ends)


def lip_heights(zs):
    """The ramp shelf's height against the wall and the lip's top (_lip), the ramp's top at zs."""
    zh = zs - T.style().shelf * W.GN * W.RAMP_PX / W.ZART
    return zh, zh + 3 * PZ + LIP_H


def _lip(k, ax, plane, a, b, ends, zs, top, fam):
    """Slate's lip at the face's foot: 2 px proud, a dark seam 2 px over it, both in three a tile (a seam up the lip's
    front, over its top and up the face to the seam over it). Returns (the face's foot over it, the lip's top)."""
    mit = _mitres(ends)
    zh = zs - T.style().shelf * W.GN * W.RAMP_PX / W.ZART   # the ramp's shelf against the wall (Style.shelf)
    zl = zh + 3 * PZ                                    # (its top: LIP_H over this)
    prism(k, ax, plane, a, b, [(0.0, zh), (LIP_D, zh), (LIP_D, zl + LIP_H), (0.0, zl + LIP_H)],
          fam, 3, cols=[False, None, None, False], mitre=mit)     # (its front on down to the shelf: no undercut)
    zg = zl + 6 * PZ                                    # the seam over it
    room = zg + PZ < top - 0.03                         # (under a low cut, walls down: the face to the cut, the lip's
    zf = zg if room else min(zg, top)                   # seams up to it, no seam over it)
    if not room and top - zl - LIP_H < 0.01:
        return zg, zl + LIP_H
    _paint(k, ax, plane, a, b, zl + LIP_H, zg + PZ if room else top, 0.0, fam, 2)             # (the face over it)
    if room:
        _paint(k, ax, plane, a, b, zg, zg + PZ, T.PAINT, fam, 1)
    for u in (_thirds(a, b, _nudge(ax)[1]) if POSTS == "tile" else []):
        op, out = T.OPEN, T.LIP_OUT
        if op and out and (op[0] < u < op[0] + out * T.LINE or op[1] - out * T.LINE < u < op[1]):
            u += out * T.LINE * (-1 if u < (op[0] + op[1]) / 2 else 1)   # (a window's seam by its post, the opening
            #   widened past it: moved out with the opening's end)
        q0, q1 = u, u + 0.7 * T.LINE
        dq, zq = LIP_D + T.PAINT, zl + LIP_H + T.PAINT
        prism(k, ax, plane, q0, q1, [(0.0, zh), (dq, zh), (dq, zq), (0.0, zq)], fam, 2,
              cols=[False, None, None, False])
        _paint(k, ax, plane, q0, q1, zl + LIP_H, zf, T.PAINT, fam, 1)
    return (zg + PZ if room else zg), zl + LIP_H


def rail_foot(top):
    """The rail's foot (_rail) on a face this tall."""
    return min(top, W.wall_top("wall", "up")) - 0.031 - RAIL_H


def _rail(k, ax, plane, a, b, ends, top, fam):
    """Slate's rail under the cap: three blocks a tile, the end ones 2 px proud, the middle one a px back with its top
    sloping down to the front, each front's top edge lit (T.RAIL_LAYOUT: a window's own blocks). Returns its foot."""
    mit = _mitres(ends)
    z0 = rail_foot(top)
    z1 = z0 + RAIL_H                                    # (under the cap's black)
    bl = (T.RAIL_LAYOUT(a, b) if T.RAIL_LAYOUT else [(a, b, POSTS == "none")] if POSTS != "tile"
          else _blocks(a, b, _nudge(ax)[0]))           # (over a join's post an end block, over a fill a middle one)
    for i, (u0, u1, mid) in enumerate(bl):
        d = MID_D if mid else RAIL_D
        zb = z0 - PZ if mid else z0
        prof = [(0.0, zb), (d, zb), (d, z1 - MID_DROP), (0.0, z1)] if mid else [(0.0, zb), (d, zb), (d, z1), (0.0, z1)]
        m = (mit[0] if abs(u0 - a) < 1e-6 else 0.0, mit[1] if abs(u1 - b) < 1e-6 else 0.0)
        joins = [mid and j is not None and bl[j][2] and abs(bl[j][1 - e] - u) < 1e-6
                 for j, e, u in ((i - 1 if i else None, 0, u0), (i + 1 if i + 1 < len(bl) else None, 1, u1))]
        prism(k, ax, plane, u0, u1, prof, fam, 3, mitre=m,       # (no end where it runs on into another set-back
              cap=tuple(False if jn else None for jn in joins))  # block: a window's rail, RAIL_LAYOUT)
        zt = z1 - MID_DROP if mid else z1
        _paint(k, ax, plane, u0, u1, zt - PZ, zt, d, fam, 5)                                    # its top edge lit
        nxt = bl[i + 1][2] if i + 1 < len(bl) else False
        if mid and u1 < b - 1e-6 and not nxt and NUDGE:  # (a seam where it meets the end block on its right, as the
            e = RAIL_D + 2 * T.PAINT                    # end block's side shows on its left: a sheet the px left of
            prism(k, ax, plane, u1 - 0.75 * T.LINE, u1 + 0.25 * T.LINE,   # the end block, up to its top; in front
                  [(e - T.PAINT, zb), (e, zb), (e, z1), (e - T.PAINT, z1)], fam, 2,   # of it, so the px is whole)
                  cols=[False, T.tone(fam, 2, T.OUT(ax), ax), False, False], cap=False)
    return z0


USCALE = 1.0                    # a square-on piece built a tile long to be drawn this long (the px grid kept whole)
SNAPD = 0.375                     # the row phase on a face seen square on (_row)
SQ = 2 ** -0.5                  # a screen px along a face seen square on (a diagonal wall), in LINEs
PX0D = 0.0                      # where its px boundaries fall (in px, off u's grid) on a piece centred on its tile


def _px(u, d):
    """u on the default wall's front, d proud of it, in screen px (a depth shifts it a px left per LINE; square on, a
    px is SQ of a LINE and depth moves nothing)."""
    if not NUDGE:
        return u * USCALE / (SQ * T.LINE) + PX0D
    return u / T.LINE + PX0 - d / T.LINE


def _u(n, d):
    """The u that falls on px boundary n at depth d (_px's inverse)."""
    if not NUDGE:
        return (n - PX0D) * SQ * T.LINE / USCALE
    return (n - PX0 + d / T.LINE) * T.LINE


def _odd(x, par):
    """x rounded to a whole number with par's parity (a part centred on a panel of that many px)."""
    return 2 * round((x - par) / 2) + par


def wall_face(k, ax, plane, a, b, ends, zs, top, full):
    """Partition (set 7): the lip, plain posts, the rail; in each field an outlined panel with two ochre bars in a dark
    slot, a raised bar across it and two fine lines under it, each on whole px."""
    F, PAINT, LINE, FR = "wall", T.PAINT, T.LINE, T.FR
    zb, zlt = _lip(k, ax, plane, a, b, ends, zs, top, F)                                        # the lip
    if not full:
        return
    zh = _rail(k, ax, plane, a, b, ends, top, F)                                                 # the rail
    if POSTS == "all":                                   # (a diagonal wall's join: one post the face's length)
        T.slab(k, ax, plane, a, b, zlt, zh, FR, F, 3, ends=(False, False))
    fields = ([] if POSTS == "all" else [(a, b)] if POSTS == "none"
              else T.posts(k, ax, plane, a, b, ends, zlt, zh, F, groove=False))
    for f0, f1 in fields:    # (the posts plain, on down to the
        _paint(k, ax, plane, f0, f1, zb, zh, 0.0, F, 2)                          # lip's top) ... the field
        if f1 - f0 < 0.3 or PLAIN or (T.OPEN and ax == "y" and f0 < T.OPEN[1] and f1 > T.OPEN[0]):
            continue
        w = f1 - f0
        p0, p1, q0, q1 = f0 + 0.04, f1 - 0.04 - LINE, zb + 0.1, zh - 0.06    # (its right side a px further in,
        if ax == "y" and NUDGE:                          # two on the lit faces: the same px between it and either post;
            p1 -= LINE                                   # none seen square on)
        elif not NUDGE:
            p1 += LINE                                   # (square on: even)
        n0, n1 = round(_px(p0, PAINT)), round(_px(p1, PAINT))                   # (its parts on whole px, each
        p0, p1 = _u(n0, PAINT), _u(n1, PAINT)                                   # at its own depth)
        b0 = q0                                          # (the raised bar and fine lines placed as before ...)
        b1 = q1
        q0, q1 = q0 - 2 * PZ, q1 - 2 * PZ                # (... the panel's top and foot 2 px down, the slot with it)
        _AX[0] = ax                                      # (its foot's steps paired from its sides' feet, its top's
        o0, o1 = _row(q0, 2 * PAINT, 0.5), _row(q1, 2 * PAINT, 0.5)            # from their tops; a px wide all round)
        q0, q1 = o0, o1
        e = 1 / W.ZART
        T.paint(k, ax, plane, p0, p1, q0, q1, PAINT, F, 1)                                       # panel outline
        T.paint(k, ax, plane, _u(n0 + 1, 2 * PAINT), _u(n1 - 1, 2 * PAINT), q0 + e, q1 - e, 2 * PAINT, F, 2)
        if T.VARIANT[0]:                                 # (a straight run's top design in the panel)
            from . import wall3d_variants as V
            V.wall_top(k, ax, plane, p0 + LINE, p1 - LINE, q0 + 0.026, q1 - 0.026, F, T.VARIANT[0])
            continue
        bw, nc = 0.42 * w, n0 + n1                       # (centred on the panel: twice its centre, in px)
        lw = LINE if NUDGE else SQ * LINE / USCALE       # (a screen px along the face)
        ns = _odd(bw / lw + 2, nc % 2)                   # the slot's width in px (a px round the bars)
        nl = _odd(0.5 * w / lw, nc % 2)                  # the fine lines'
        _paint(k, ax, plane, _u((nc - ns) / 2, 3 * PAINT), _u((nc + ns) / 2, 3 * PAINT), q1 - 0.27 - PZ, q1 - 0.07,
                3 * PAINT, F, 0)                         # (its foot a px further down)
        for j in range(2):                                                                       # ochre bars
            bz = q1 - 0.09 - j * 0.085 - PZ              # (a px down, in the slot)
            _paint(k, ax, plane, _u((nc - ns) / 2 + 1, 4 * PAINT), _u((nc + ns) / 2 - 1, 4 * PAINT), bz - 0.05, bz,
                    4 * PAINT, "ochre", 3)
        zr = b1 - 0.5
        prism(k, ax, plane, _u(n0 + 1, FR), _u(n1 - 1, FR), [(0.0, zr - 0.07), (FR, zr - 0.07), (FR, zr), (0.0, zr)],
              F, 3, cols=[False, None, None, False], cap=False, mitre=(0.0, lambda d, z: d - FR))  # raised bar: its
        gap = (zr - 0.07 - b0) / 3                       # front the panel's full width between its seams, its top's
        for zz in (zr - 0.07 - gap, zr - 0.07 - 2 * gap):  # back cut a px short at its right end ... the two lines
            _paint(k, ax, plane, _u((nc - nl) / 2, 3 * PAINT), _u((nc + nl) / 2, 3 * PAINT), zz - 0.026, zz,
                    3 * PAINT, F, 1)                                                            # evenly under it


def skirt(k, sp, ax, plane, a, b, fam, ends=None):
    """wall3d.skirt in this look (the plain relief's path only): one plate a tile from the shelf's edge down to the
    toe's edge, the step's edge lit, and under each field the panel drawn as a seam line round its light plate and
    slot, a seam either side of it across to the slope's edges (a window tile, T.BARE: that seam on across, no
    panel)."""
    run_, zs = sp.run, sp.zs
    ft = getattr(sp, "foot", 0.0)
    o = T.OUT(ax)
    nrm = (o * (zs - ft) / run_ + Vector((0, 0, 1))).normalized()
    zsurf = lambda dd: ft + (zs - ft) * (1 - dd / run_)               # noqa: E731
    if getattr(sp, "end_face", None) and sp.end_face(ax, plane):
        return                                  # a look's wall end: no ramp across it
    lo_t, hi_t = ends or (T._end(sp, ax, plane, a, -1), T._end(sp, ax, plane, b, 1))
    if getattr(sp, "is_end", None):             # ... and the ramps beside it stop square at its line
        lo_t, hi_t = ("end" if sp.is_end(ax, a, -1) else lo_t), ("end" if sp.is_end(ax, b, 1) else hi_t)
    lo = {"cont": lambda p: p[0] - a, "in": lambda p: p[0] - (a + p[1]), "out": lambda p: p[0] - (a - p[1]),
          "end": lambda p: p[0] - a}[lo_t]
    hi = {"cont": lambda p: b - p[0], "in": lambda p: (b - p[1]) - p[0], "out": lambda p: (b + p[1]) - p[0],
          "end": lambda p: b - p[0]}[hi_t]
    if getattr(sp, "solid", False):             # (a shell that builds its ramp as solids: this face's)
        sp.ramp(k, ax, plane, a, b, fam, lo_t, hi_t)
    cr = T.style().chamfer if hi_t == "out" and getattr(sp, "line", None) else None
    if cr:
        hi = lambda p: (b - cr + p[1]) - p[0]                          # noqa: E731

    def pt(u, dd, rise):
        return T.P(ax, plane, u, zsurf(dd), dd) + nrm * rise
    g, rise, clip = T.LINE / 2, T.PAINT, lambda q: T._clip(T._clip(q, lo), hi)   # noqa: E731
    d0, d1 = max(0.02, T.style().shelf), run_ if ft else run_ - 0.045   # (from the shelf's edge to the toe's)
    off = T.seam()
    segs = []
    for s0, s1 in T.spans(a, b):
        e0, e1 = s0 - (run_ if abs(s0 - a) < 1e-6 else 0.0), s1 + (run_ if abs(s1 - b) < 1e-6 else 0.0)
        if off <= 0 or s1 - s0 <= 2 * off + 1e-3:
            segs.append((e0, e1, s1 - s0 > 0.3))
            continue
        if cr and abs(s1 - b) < 1e-6:
            segs += [(e0, s0 + off, False), (s0 + off, e1, True)]
            continue
        segs += [(e0, s0 + off, False), (s0 + off, s1 - off, True), (s1 - off, e1, False)]
    holes = [h[2:] for h in getattr(sp, "holes", ()) if h[0] == ax and abs(h[1] - plane) < 1e-6]
    for s0, s1 in T.spans(a, b):                # one plate a tile, no seams beside its panel
        e0, e1 = s0 - (run_ if abs(s0 - a) < 1e-6 else 0.0), s1 + (run_ if abs(s1 - b) < 1e-6 else 0.0)
        for q in T._minus((e0 + g, e1 - g, d0, d1), holes):
            poly = clip([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])])
            if len(poly) >= 3:
                T.plate(k, poly, pt, nrm, 0.0, rise, fam, 3)      # (the slope a shade lighter)
        poly = clip([(e0 + g, d0), (e1 - g, d0), (e1 - g, d0 + 0.4 / 32), (e0 + g, d0 + 0.4 / 32)])
        if len(poly) >= 3:                      # the step's edge lit (the slope's top px, at the shelf)
            T.plate(k, poly, pt, nrm, 0.0, rise + T.PAINT, fam, 5, base=rise)
    for u0, u1, field in segs:
        poly = clip([(u0 + g, d0), (u1 - g, d0), (u1 - g, d1), (u0 + g, d1)])
        if len(poly) >= 3 and field and u1 - u0 >= 0.36 and T.style().skirt == "panel":
            panel(k, pt, nrm, clip, u0, u1, a, b, off, g, d0, run_, ft, fam, rise)


def panel(k, pt, nrm, clip, u0, u1, a, b, off, g, d0, run_, ft, fam, rise):
    """A field's panel on the slope (skirt): a seam line round its light plate and slot, its top 4 px down (under the
    step's lit edge), its bottom 2 px up; either side a seam across to the slope's edges, 3 px over the panel's bottom
    one (a window tile, T.BARE: only that seam, on across: wall3d_iwin_ramp's pockets cut it)."""
    PAINT, LINE = T.PAINT, T.LINE

    def rect(q):
        return [(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])]
    w = u1 - u0
    im = 0.2 * min(1.0, w / 0.76)
    dn = 0.12 * run_ if ft else 0.0                 # (the panel down to the toe's edge)
    fu0, fu1, fd0, fd1 = u0 + 0.06, u1 - 0.06, 0.12 * run_ + dn, 0.88 * run_ + dn
    pd = ed = 0.4 / 32                              # (about an art px down the slope)
    fd0, fd1 = fd0 + 4 * pd, fd1 - 2 * pd
    fd0 = max(fd0, d0 + pd) + pd
    sb = fd1 - ed                                   # (the bottom seam's top)
    hz = fd1 - 4 * pd
    ea = u0 - off - (run_ if abs(u0 - off - a) < 1e-6 else 0.0) + g
    eb = u1 + off + (run_ if abs(u1 + off - b) < 1e-6 else 0.0) - g
    for q in ((ea, eb, hz, hz + ed),) if T.BARE else ((ea, fu0, hz, hz + ed), (fu1, eb, hz, hz + ed)):
        poly = clip(rect(q))
        if len(poly) >= 3:
            T.plate(k, poly, pt, nrm, 0.0, rise + PAINT, fam, 1, base=rise)
    if T.BARE:
        return
    for q in ((fu0, fu1, fd0, fd0 + ed), (fu0, fu1, fd1 - ed, fd1), (fu0, fu0 + LINE, fd0, fd1),
              (fu1 - LINE, fu1, fd0, fd1)):
        T.plate(k, rect(q), pt, nrm, 0.0, rise + PAINT, fam, 1, base=rise)
    iu0, iu1 = u0 + im + LINE, u1 - im - LINE       # the light plate (a px in at its top and sides, a px down)
    id0, id1 = 0.3 * run_ + dn + 2 * pd, 0.52 * run_ + dn + pd
    if T.VARIANT[1]:                                # (a straight run's ramp design: its own drawing in the frame)
        from . import wall3d_variants as V
        V.ramp_plain(lambda q, lvl, n: T.plate(k, q, pt, nrm, 0.0, rise + n * PAINT, fam, lvl, base=rise),
                     fu0 + LINE, fu1 - LINE, fd0 + 0.03, iu0, iu1, id1, sb, pd, T.VARIANT[1])
        return
    T.plate(k, rect((iu0, iu1, id0, id1)), pt, nrm, 0.0, rise + 2 * PAINT, fam, 4, base=rise)
    su0, su1 = u0 + im + 0.02, u1 - im - 0.02      # the dark slot (a px down, clear of the bottom seam)
    sd0, sd1 = 0.66 * run_ + dn + pd, min(0.74 * run_ + dn + pd, sb - 1e-3)
    T.plate(k, rect((su0, su1, sd0, sd1)), pt, nrm, 0.0, rise + 2 * PAINT, fam, 0, base=rise)
