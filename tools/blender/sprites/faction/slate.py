"""Slate (set 2, a working name): a mid-grey wall under a bright blue header, a rail 2 px proud in three blocks a tile
(the middle one set back a px, its top sloping down 2 px to the front) over a painted blue stripe; a lit lip at the
face's foot with a groove over it; its ramp light grey over a blue plate, the foot blue."""
from .. import wall3d as T
from ..relief_style import Design
from .base import Faction, _style
from .parts import LINE, PAINT, PX, PZ, body, prism
from .tan_tops import _px
from .shell import NO, FaceHoles, Feature, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _ends

FACE = "rose"                       # the face's family (its second tone: the wall family is the ramp's light grey)
BLUE = "ochre"                      # the trim's
RAIL_D, MID_D = PX, PX / 2          # the rail's depth: its end blocks' (2 px: a PX shows 2 px down a lit face), its
                                    # middle block's (set back a px)
RAIL_H = 7 * PZ                     # the rail's front
END_W = 0.25                        # its end blocks along a tile (the middle block between them)
LIP_D, LIP_H = PX, 3 * PZ           # the lip at the face's foot: its depth (2 px), its height
MID_DROP = 3 * PZ                   # the middle block's top: its front edge this far under its back
SHELF = 4 / 32                      # the ramp's top a flat step this deep against the wall (4 px)
END_COL = "fGS4"                    # a run's end face from the foot down (_end_cap, the ramps' caps): the wall end's grey


def _shelf_z(zs):
    """The shelf's height (the slope's, SHELF out from the wall)."""
    return zs - SHELF * T.W.GN * T.W.RAMP_PX / T.W.ZART


class SlateTones(Feature):
    """The shell's faces in the face's grey (the second tone); the dark outlines at the foot and under the top stay. The
    ramps' caps at a wall's free end in the end face's grey (END_COL, as _end_cap's section)."""
    def end_tone(self, sp, fam, ox):
        return END_COL

    def col_face(self, sp, face, x, y, z):
        c = T.Shell.col_face(sp, face, x, y, z)
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        top = r[3] if r else sp.top
        if z < _shelf_z(sp.zs) + 0.02 or z > top - 0.03:       # (down to the ramp's shelf)
            return c
        return T.RAMPS[FACE][1 if face == "x" else 0][3]


def _blocks(a, b):
    """The rail's blocks over [a, b], on each tile's grid: (u0, u1, middle?)."""
    out = []
    for c in range(-1, 2):
        for u0, u1, mid in ((c - 0.5, c - 0.5 + END_W, False), (c - 0.5 + END_W, c + 0.5 - END_W, True),
                            (c + 0.5 - END_W, c + 0.5, False)):
            q0, q1 = max(a, u0), min(b, u1)
            if q1 - q0 > 1e-6:
                out.append((q0, q1, mid))
    return out


def _end_cap(k, ax, plane, a, b, zs, F):
    """A run's end face under its face parts: shell._end_section's, its front's top (b: the face's side) the look's own
    section, the lip standing out at the wall's foot, the shelf flat out to its edge, then the slope (in pieces, each
    convex); all of it the wall's end's grey (END_COL), no lit edges (up its front edge, down the slope)."""
    sh = T.SHELL
    run, ft = getattr(sh, "run", T.W.skirt_run()), max(getattr(sh, "foot", 0.0), 0.0035)
    zh = _shelf_z(zs)
    zl = zh + 3 * PZ
    low = [(a - run, 0.0035), (b + run, 0.0035)]
    if ft > 0.0035:                                     # (over a foot the slope ends on a ledge, as the ramps')
        dl = min(run, (zs - ft) / (T.W.GN * T.W.RAMP_PX / T.W.ZART))
        low += [(b + run, ft), (b + dl, ft), (b + SHELF, zh), (a - SHELF, zh), (a - dl, ft), (a - run, ft)]
    else:
        low += [(b + SHELF, zh), (a - SHELF, zh)]
    for q in (low, [(a - SHELF, zh), (b, zh), (b, zs), (a, zs)],
              [(b, zh), (b + LIP_D, zh), (b + LIP_D, zl + LIP_H), (b, zl + LIP_H)]):
        k.poly([T.P(ax, plane, u, z, 0.0) for u, z in q], F, 2, T.OUT(ax), fixed=END_COL)
    if ft > 0.0035:                                     # (the feet in the toe band's colour, on across the section)
        k.poly([T.P(ax, plane, u, z, PAINT) for u, z in ((a - run, 0.0035), (b + run, 0.0035), (b + run, ft),
                                                           (a - run, ft))],
               T.style().toe or F, 2, T.OUT(ax), fixed=END_COL)


def _thirds(a, b):
    """The lip's seams over [a, b] (each a px from u): a tile in three 10 px sections."""
    return [u for c in range(-1, 2) for u in (c - 0.5 + 10.3 / 32, c - 0.5 + 21.3 / 32) if a + LINE < u < b - LINE]


def slate(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, corner, back = _ends(ax, plane, b, ends)
        pe = ("in" if back else ends[0], ends[1])
        mit = (0.0 if back else {"in": -1.0}.get(ends[0], 0.0), {"out": 1.0, "in": -1.0}.get(ends[1], 0.0))
        rt = min(top, T.W.wall_top("wall", "up")) if full else top
        z1 = rt - 0.031                                 # the rail's top (under the cap's black: Faction.paint)
        z0 = z1 - RAIL_H
        zst = z0 - 3 * PZ                               # the stripe's top, a px under the rail's shadow (the rail's
                                                        # front shows 2 px under its line: it stands 2 px out)
        cut = T.fill("cut") if full else None           # a top design's openings through the stripe (and the lip's
        cuts = cut(a, b) if cut and not endf else []    # middle recess under them)
        lipf = T.fill("lip") if full else None          # a top design's openings through the lip (a box in it from
        lips = lipf(a, b) if lipf and not endf else []  # the shelf up to the seam over it; no recess there)
        footf = T.fill("foot") if full and not endf else None   # a top design's part on the shelf in place of the lip
        if endf:
            _end_cap(k, ax, plane, a, b, zs, F)
        if not endf:
            T.run(k, ax, plane, a, b, pe, _shelf_z(zs) - 0.01, zs + 0.02, PAINT, FACE, 3, 0)   # the face on down
                                                                                                # to the shelf
            zl = _shelf_z(zs) + 3 * PZ                  # the lip (its foot meets the shelf's dark back on screen)
            top_ = "fGS2" if ax == "y" else "fGS3"      # (its top a step under a lit top's: a soft edge)
            hl = "fGS1" if ax == "y" else "fGS2"        # its front's top px lit (under the seams over it)
            for s0, s1 in ([] if footf else _minus(a, b, lips)):
                m = (mit[0] if abs(s0 - a) < 1e-6 else 0.0, mit[1] if abs(s1 - b) < 1e-6 else 0.0)
                cp = (None, False if end1 and abs(s1 - b) < 1e-6 else None)    # (at the run's end: the end face's
                prism(k, ax, plane, s0, s1, [(0.0, zl - PZ), (LIP_D, zl - PZ), (LIP_D, zl + LIP_H), (0.0, zl + LIP_H)],
                      FACE, 3, cols=[False, None, top_, False], cap=cp, mitre=m)              # section, _end_cap)
                prism(k, ax, plane, s0, s1, [(LIP_D, zl + LIP_H - PZ), (LIP_D + PAINT / 2, zl + LIP_H - PZ),
                                             (LIP_D + PAINT / 2, zl + LIP_H), (LIP_D, zl + LIP_H)], FACE, 3,
                      cols=[False, hl, False, False], cap=cp, mitre=m)
            zg = zl + 6 * PZ                            # a dark seam over it (2 px of face between, a px wide)
            for q0, q1 in lips:                         # (a box in the lip: a dark line up each side to the seam,
                for u0 in (q0, q1 - LINE):              # its floor flat at the lip's foot (not the ramp's slope
                    T.paint(k, ax, plane, u0, u0 + LINE, zl - PZ, zg, 0.0, FACE, 1)            # under it), a seam
                prism(k, ax, plane, q0, q1, [(0.0, _shelf_z(zs) - 0.01), (LIP_D, _shelf_z(zs) - 0.01),  # where the
                                             (LIP_D, zl - PZ), (0.0, zl - PZ)], FACE, 3,               # floor meets
                      cols=[False, None, top_, False], cap=False)                                      # the face)
                _seam(k, ax, plane, q0, q1, zl - PZ, zl)
            room = zg + PZ < top - 0.03                 # (under a low cut, walls down: the lip's seams up to it,
            if not footf and (room or top - zl - LIP_H > 0.01):     # no seam over it)
                if room:
                    _seam(k, ax, plane, a, b, zg, zg + PZ)
                    for c in range(-1, 2):              # a recess on it at each tile's middle, 8 px wide, 3 px
                        q0, q1 = c - 4 * LINE, c + 4 * LINE     # tall, in the seam's tone, its top px the
                                                                # faint line's on the face over it
                        if a - 1e-6 <= q0 and q1 <= b + 1e-6 and not any(x0 <= q0 and q1 <= x1 for x0, x1 in cuts + lips):
                            _seam(k, ax, plane, q0, q1, zg + PZ, zg + 3 * PZ)
                            prism(k, ax, plane, q0, q1, [(0.0, zg + 3 * PZ), (PAINT, zg + 3 * PZ), (PAINT, zg + 4 * PZ),
                                                         (0.0, zg + 4 * PZ)], FACE, 4,
                                  cols=[False, "fGS2" if ax == "y" else "fGS3", False, False])
                for u in _thirds(a, b):                 # the lip in three a tile: a seam up its front, over its
                    q0, q1 = u, u + 0.7 * LINE         # top and up the face to the seam over it
                    dq, zq = LIP_D + PAINT, zl + LIP_H + PAINT  # (over the lip: its top a step under the
                    prism(k, ax, plane, q0, q1, [(0.0, zl - PZ), (dq, zl - PZ), (dq, zq), (0.0, zq)], FACE, 1,
                          cols=[False, _seam_col(ax), "fGS5" if ax == "y" else "fGS6", False])   # front's line,
                    _seam(k, ax, plane, q0, q1, zl + LIP_H, zg if room else min(zg, top))        # darker)
            if footf:                                   # (its seams and recess with it)
                footf(k, ax, plane, a, b, _shelf_z(zs), mit)
            wall = T.fill("wall")                                       # a top design's dressing on the face
            gaps = [(a, b)]                                             # (between the header and the seam over
            if full and wall:                                           # the lip; it gives back the spans it
                gaps = wall(k, ax, plane, a, b, zst - 6 * PZ, zg + PZ, zst - 18 * PZ)   # leaves the faint line)
            if full:                                                    # a faint line, 11 px under the stripe,
                for g0, g1 in gaps:                                     # a step over the face's grey
                    _faint(k, ax, plane, g0, g1, zst - 18 * PZ)
        if not full:
            return
        hdr = T.fill("header")                          # a top design's header (in place of the rail and stripe)
        if hdr:
            hdr(k, ax, plane, a, b, zst - 6 * PZ, z1, mit)
            return
        T.paint(k, ax, plane, a, b, zst, z0, 0.0, BLUE, 1)      # the rail's shadow (on up behind it: where a block
                                                        # ends, its front standing out shows the face behind it)
        for s0, s1 in _minus(a, b, cuts):                                                      # the stripe ...
            ends = (pe[0] if abs(s0 - a) < 1e-6 else "cut", pe[1] if abs(s1 - b) < 1e-6 else "cut")
            T.run(k, ax, plane, s0, s1, ends, zst - 6 * PZ, zst, PAINT, BLUE, 3, 0)
            T.paint(k, ax, plane, s0, s1, zst - PZ, zst, PAINT, BLUE, 4)                       # ... lit on top
        _rail(k, ax, plane, a, b, z0, z1, mit)                                                 # the rail
    return face


def _edge(u):
    """u on a tile's edge?"""
    return abs((u + 0.5) % 1.0) < 1e-6 or abs((u + 0.5) % 1.0 - 1.0) < 1e-6


def _rail(k, ax, plane, a, b, z0, z1, mit, outer=None, seen=None, cut=False):
    """The base header's rail over [a, b]: its blocks from z0 (their foot; the set-back middle's a px lower) to z1;
    outer: a fixed tone for an end block's side at the tile's edge (None: shaded as it falls); seen (zs, w): the end
    block at b (the end the camera sees), at a tile's edge, from zs down w short of it; cut: an end block's seam by
    the middle (the side the camera can't see) on up through its lit top edge (as the side by the middle shows at the other end)."""
    for u0, u1, mid in _blocks(a, b):
        d = MID_D if mid else RAIL_D
        zb = z0 - PZ if mid else z0                 # (the set-back middle a px lower: its foot shows on the
        prof = [(0.0, zb), (d, zb), (d, z1 - MID_DROP), (0.0, z1)] if mid else \
            [(0.0, zb), (d, zb), (d, z1), (0.0, z1)]                                       # ends' line)
        m = (mit[0] if abs(u0 - a) < 1e-6 else 0.0, mit[1] if abs(u1 - b) < 1e-6 else 0.0)
        inner = "fGT3" if ax == "y" else "fGT4"     # (an end block's side by the middle: a step under its front)
        cap = None if mid else (inner if abs(u0 % 1.0 - END_W) < 1e-6 else outer,
                                inner if abs(u1 % 1.0 - (1 - END_W)) < 1e-6 else outer)
        if seen and not mid and abs(u1 - b) < 1e-6 and _edge(b):
            zs, w = seen
            prism(k, ax, plane, u0, u1, [(0.0, zs), (d, zs), (d, z1), (0.0, z1)], BLUE, 3, cap=cap, mitre=m,
                  cols=[False, None, None, None])
            prism(k, ax, plane, u0, u1 - w, [(0.0, zb), (d, zb), (d, zs), (0.0, zs)], BLUE, 3, cap=cap,
                  cols=[None, None, False, None])
        else:
            prism(k, ax, plane, u0, u1, prof, BLUE, 3, cap=cap, mitre=m)
        if cap and cap[0]:                          # (the end block past the middle: its side by the middle
            prism(k, ax, plane, u0, u0 + LINE, [(d, z0), (d + PAINT, z0), (d + PAINT, z1 - PZ), (d, z1 - PZ)],
                  BLUE, 3, cols=[False, inner, False, False])   # faces away from the camera, a seam on its front)
            if cut and abs(u0 % 1.0 - END_W) < 1e-6:   # (on up through the lit edge: further out, over it)
                prism(k, ax, plane, u0, u0 + LINE, [(d, z1 - 2 * PZ), (d + 2 * PAINT, z1 - 2 * PZ),
                                                    (d + 2 * PAINT, z1), (d, z1)], BLUE, 3,
                      cols=[False, inner, False, False], cap=False)
        zt = z1 - MID_DROP if mid else z1                                                  # its front's top
        prism(k, ax, plane, u0, u1, [(0.0, zt - PZ), (d + PAINT, zt - PZ), (d + PAINT, zt), (0.0, zt)], BLUE, 4,
              cols=[False, "fGTw", False, False], mitre=m)     # edge lit (fGTw: over the ramp's light end, its own)


def slate_tall_rail(k, ax, plane, a, b, z0, z1, mit):
    """Header (T1-4): the base header's rail run on down to the stripe's foot (the paint line), over the stripe, its
    shadow paint behind it from the rail's foot down (where a block ends, its front standing out shows the face behind
    it); each block's foot edge dark, in a box's side tone (as T1-2's boxes')."""
    T.paint(k, ax, plane, a, b, z0, z1 - RAIL_H, 0.0, BLUE, 1)    # (to the base rail's foot, as its: on up it
    outer, zs = ("fGT3" if ax == "y" else "fGT4"), z1 - RAIL_H     # tinted the top edge's AA)
    _rail(k, ax, plane, a, b, z0, z1, mit, outer=outer, seen=(zs, LINE), cut=True)
    # Its side at the tile's edge a shade under its front: tall, it shows. At the end the camera sees, a plain rail by
    # it hides that side over its own height: a seam on its front there instead, the end block under it a px short so
    # its side lines up with it (else that end block and the plain one read as one L).
    if _edge(b):
        prism(k, ax, plane, b - LINE, b, [(RAIL_D, zs), (RAIL_D + 2 * PAINT, zs), (RAIL_D + 2 * PAINT, z1 - PZ),
                                          (RAIL_D, z1 - PZ)], BLUE, 3, cols=[False, outer, False, False], cap=False)
    side = "fGT4" if ax == "y" else "fGT5"
    for u0, u1, mid in _blocks(a, b):
        d, zb = (MID_D, z0 - PZ) if mid else (RAIL_D, z0)
        m = (mit[0] if abs(u0 - a) < 1e-6 else 0.0, mit[1] if abs(u1 - b) < 1e-6 else 0.0)
        if not mid and abs(u1 - b) < 1e-6 and _edge(b):
            u1 -= LINE
        prism(k, ax, plane, u0, u1, [(0.0, zb), (d + PAINT, zb), (d + PAINT, zb + PZ), (0.0, zb + PZ)], BLUE, 4,
              cols=[False, side, False, False], cap=False, mitre=m)   # (no ends: they showed lit)


SPLIT = 0.655                                   # the ramp's blue plate from here down the run, a px of seam over it
EDGE = 0.4 / 32                                 # (a px down the slope, about: 2.5 a cell)


def slate_plate(plate, u0, u1, run_, **_):
    """The base ramp's seam panel on the blue plate, drawn as the default walls' (wall3d.skirt) but open at the top:
    it sits on the plate's lit edge, a px seam down each side and across its foot (a px across, a px down the
    slope), 5 px deep, half the tile wide, its bottom corners rounded a px (each corner pixel left out). The seam a
    step under the plate's front tone (fGT2), fGTs between them: the leaning seams' part-covered px blend through it
    (with no tone between the seam and the plate they broke up and the rounded corners lost half their pixels)."""
    uc = (u0 + u1) / 2
    w = min(0.25, (u1 - u0) / 2 - 0.06)
    fu0, fu1 = (round((uc + s * w) * 32) / 32 for s in (-1, 1))     # (on whole art px)
    fd0 = SPLIT * run_ + EDGE
    fd1 = fd0 + 5 * EDGE
    for q in ((fu0 + LINE, fu1 - LINE, fd1 - EDGE, fd1), (fu0, fu0 + LINE, fd0, fd1 - EDGE),
              (fu1 - LINE, fu1, fd0, fd1 - EDGE)):
        plate([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], PAINT, 2, 0.0, "ochre", fixed="fGT2")


def slate_grey_panel(plate, u0, u1, run_, **kw):
    """B1-2: the blue plate's panel, and over it on the grey a seam down each side of the panel (in line with
    its sides) from under the shelf's lit edge to the blue's seam, two short vents between them."""
    slate_plate(plate, u0, u1, run_, **kw)
    uc = (u0 + u1) / 2
    w = min(0.25, (u1 - u0) / 2 - 0.06)
    fu0, fu1 = (round((uc + s * w) * 32) / 32 for s in (-1, 1))
    g0, g1 = SHELF + EDGE, SPLIT * run_
    for q0, q1 in ((fu0, fu0 + LINE), (fu1 - LINE, fu1)):
        plate([(q0, g0), (q1, g0), (q1, g1), (q0, g1)], PAINT, 0, 0.0)
    vc = round(uc * 32) / 32
    gm = (g0 + g1) / 2 - EDGE                             # (a px up the slope from the middle)
    for dv in (gm - 1.5 * EDGE, gm + 1.5 * EDGE):           # (6 px long, 2 px apart)
        plate([(vc - 3 * LINE, dv - EDGE / 2), (vc + 3 * LINE, dv - EDGE / 2), (vc + 3 * LINE, dv + EDGE / 2),
               (vc - 3 * LINE, dv + EDGE / 2)], PAINT, 0, 0.0)


BOXES = ((2, 9, False), (13, 6, True), (21, 9, False))   # the header's boxes a tile (px from its start, width,
                                                        # middle?): 2 px from each end and between, the ref's widths
MID_SLOPE = 4 * PZ                                      # the middle box's top: its front edge this far under its back


def _steps(u0, u1, top):
    """A box's front in columns rounding its corners (each corner's px left out): (from, to, px up from its foot, px
    down from its top); top False: its top corners square."""
    t = (lambda n: n) if top else (lambda n: 0)
    return [(u0, u0 + LINE, 1, t(1)), (u0 + LINE, u1 - LINE, 0, 0), (u1 - LINE, u1, 1, t(1))]


SEAM_Z = 8 * PZ                     # the boxes header's seam (its dark px) over the header's foot


def slate_boxes(k, ax, plane, a, b, z0, z1, mit, back=0.0, backing=True, lid=True):
    """Header (T1-2, T1-3; T1-4's foot): three blue boxes a tile over the stripe's foot to the rail's top, in place of both, on
    a backing in the stripe's blue (2 px gaps at each end and between them, 2 px under them); their fronts flush, their
    corners rounded a px (the middle one's bottom ones only), its top sloping 4 px down to its front, lit; a seam low
    across each, the end ones a handle slot near the top. back: the backing's reach over z1 (backing False: none,
    the face's grey between and under them)."""
    if backing:
        T.paint(k, ax, plane, a, b, z0, z1 + back, 0.0, BLUE, 3)           # the backing, the stripe's blue (up to
                                                                           # the wall's top)
    side = "fGT4" if ax == "y" else "fGT5"              # (a box's +u side, the one the camera sees: two steps under
    lit = "fGT0" if ax == "y" else "fGT1"               # its front; its front's top edge lit, its foot's edge in the
    dark = side                                         # side's tone)
    zb, d = z0 + 2 * PZ, RAIL_D                         # (the boxes' foot)
    if lid:                                             # (their top, the rail's 2 px in its top tone, whole: over the
        prism(k, ax, plane, a, b, [(0.0, z1 - PZ), (d, z1 - PZ), (d, z1), (0.0, z1)], BLUE, 3,   # gaps and corners)
              cols=[False, False, "fGT1", False], cap=False, mitre=mit)
    for c in range(-1, 2):
        for x0, w, mid in BOXES:
            u0, u1 = c - 0.5 + x0 * LINE, c - 0.5 + (x0 + w) * LINE
            q0, q1 = max(a, u0), min(b, u1)
            if q1 - q0 < 1e-6:
                continue
            top = "fGT1" if mid else None       # (the middle one's sloped top lit: the end ones' top tone, either side)
            for s0, s1, up, down in _steps(u0, u1, not mid):
                s0, s1 = max(s0, q0), min(s1, q1)
                if s1 - s0 < 1e-6:
                    continue
                zf, zk = z1 - down * PZ - (MID_SLOPE if mid else 0.0), z1 - down * PZ      # (its top: front, back)
                zl = zb + up * PZ
                prism(k, ax, plane, s0, s1, [(0.0, zl), (d, zl), (d, zf), (0.0, zk)], BLUE, 3,
                      cols=[False, None, top, False], cap=(False, side))
                prism(k, ax, plane, s0, s1, [(0.0, zf - PZ), (d + PAINT, zf - PZ), (d + PAINT, zf), (0.0, zf)], BLUE, 4,
                      cols=[False, lit, False, False], cap=False)
                prism(k, ax, plane, s0, s1, [(0.0, zl), (d + PAINT, zl), (d + PAINT, zl + PZ), (0.0, zl + PZ)], BLUE, 4,
                      cols=[False, dark, False, False], cap=False)                 # its foot's edge, the side's tone
            zt = z1 - MID_SLOPE if mid else z1           # its front's top
            if lid:                                     # a seam across, edge to edge: as the plain wall's line under
                for zs, tone in ((SEAM_Z, "fGT5" if ax == "y" else "fGT4"), (SEAM_Z - PZ, "fGT0")):   # its rail (its
                    prism(k, ax, plane, q0, q1, [(0.0, z0 + zs), (d + PAINT, z0 + zs), (d + PAINT, z0 + zs + PZ),   # shadow's
                                                 (0.0, z0 + zs + PZ)], BLUE, 4, cols=[False, tone, False, False],  # dark,
                          cap=False)                                                           # the stripe's lit top)
            else:                                       # (T1-4's foot: in the side's tone)
                prism(k, ax, plane, q0, q1, [(0.0, z0 + 7 * PZ), (d + PAINT, z0 + 7 * PZ), (d + PAINT, z0 + 8 * PZ),
                                             (0.0, z0 + 8 * PZ)], BLUE, 4, cols=[False, side, False, False], cap=False)
            if mid:
                continue
            cu = round((u0 + u1) / 2 * 32) / 32
            if q0 <= cu - 2 * LINE and cu + 2 * LINE <= q1:                    # a handle slot, 4 px
                T.paint(k, ax, plane, cu - 2 * LINE, cu + 2 * LINE, zt - 4 * PZ, zt - 3 * PZ, d, BLUE, 1)


def _seam_col(ax):
    """The lip's seams (and the recess on the one over it): a dark grey (fGS5, both sides)."""
    return "fGS5"


def _seam(k, ax, plane, u0, u1, z0, z1):
    prism(k, ax, plane, u0, u1, [(0.0, z0), (PAINT, z0), (PAINT, z1), (0.0, z1)], FACE, 1,
          cols=[False, _seam_col(ax), False, False])


def _faint(k, ax, plane, a, b, z):
    """The face's faint line, a px tall from z, a step over the face's grey."""
    fl = "fGS2" if ax == "y" else "fGS3"
    prism(k, ax, plane, a, b, [(0.0, z), (PAINT, z), (PAINT, z + PZ), (0.0, z + PZ)], FACE, 4,
          cols=[False, fl, False, False])


def _panels(k, ax, plane, a, b, foot, zf, rects, lift=0):
    """Outlined panels a tile, 15 px tall, their foot 5 px (+ lift) over the seam over the lip, their corners rounded as the
    ramp's blue panel's (each corner pixel left out); a lit bar 3 px tall along each inside top, 2 px under its top
    line, m px in from each side; a lit tick under each end of the bar from a px under the foot up 4 px. rects: (u0,
    u1, m) in px off the tile's middle. Returns the spans of [a, b] they leave free (the face's faint line runs on
    behind them)."""
    lit = "fGSb" if ax == "y" else "fGSc"               # (the bar and ticks a bluer grey, the ref's)
    zb = foot + (5 + lift) * PZ
    zt = zb + 15 * PZ
    cuts = []
    for c in range(-1, 2):
        if not (a - 1e-6 <= c + rects[0][0] * LINE and c + rects[-1][1] * LINE <= b + 1e-6):
            continue
        for r0, r1, m in rects:
            p0, p1 = c + r0 * LINE, c + r1 * LINE
            if zb <= zf and zf + PZ <= zt:
                cuts.append((p0, p1))
            for u0, u1, z0, z1 in ((p0 + LINE, p1 - LINE, zt - PZ, zt), (p0 + LINE, p1 - LINE, zb, zb + PZ),
                                   (p0, p0 + LINE, zb + PZ, zt - PZ), (p1 - LINE, p1, zb + PZ, zt - PZ)):
                T.paint(k, ax, plane, u0, u1, z0, z1, 0.0, FACE, 1)
            q0, q1 = p0 + m * LINE, p1 - m * LINE
            for u0, u1, z0, z1 in ((q0, q1, zt - 6 * PZ, zt - 3 * PZ), (q0, q0 + LINE, zb - PZ, zb + 3 * PZ),
                                   (q1 - LINE, q1, zb - PZ, zb + 3 * PZ)):
                prism(k, ax, plane, u0, u1, [(0.0, z0), (2 * PAINT, z0), (2 * PAINT, z1), (0.0, z1)], FACE, 4,
                      cols=[False, lit, False, False])
    return _minus(a, b, cuts)


def slate_panel(k, ax, plane, a, b, top, foot, zf):
    """Wall (T1-2): one panel a tile, 22 px wide, its bar 14 px (ticks 7 px each side of the middle)."""
    return _panels(k, ax, plane, a, b, foot, zf, ((-11, 11, 4),))


def slate_panel_box(k, ax, plane, a, b, top, foot, zf):
    """Wall (T1-8): T1-2's panel 3 px higher (the box in the lip under it: box_cuts)."""
    return _panels(k, ax, plane, a, b, foot, zf, ((-11, 11, 4),), lift=3)


def slate_hatches(k, ax, plane, a, b, top, foot, zf):
    """Wall (T1-7): two small panels a tile, 9 px wide with 8 px between, 5 px higher than T1-2's, each one's bar
    5 px (2 px in), its ticks under the bar's ends."""
    return _panels(k, ax, plane, a, b, foot, zf, ((-13, -4, 2), (4, 13, 2)), lift=5)


def _minus(a, b, cuts):
    """[a, b] less the spans in cuts (sorted, inside it)."""
    out, u = [], a
    for x0, x1 in sorted(cuts):
        out.append((u, x0))
        u = x1
    return [(g0, g1) for g0, g1 in out + [(u, b)] if g1 - g0 > 1e-6]


CONSOLE = ("............................",     # T1-3's screen (ref 05's, px for px; 28 px wide), its top
           ".......r.r...........m.m.m..",      # under the header; blank rows added over and under the ref's 13
           "............................",      # (our wall is taller)
           "....bbrRrR.d.d.d....pYyYyYy.",
           "...bCCRRRRdgdgdd....mYYyYOr.",
           "...bCCRRRRgGGGGd....mYYrRRrp",
           ".b.bCCRrrrggGgGd....pYYrROy.",
           "....b.m.m.d.d.d.....mROpYYy.",
           ".p.p.p.p.p.p.p.p....mRRyYYy.",
           "ppppppppppppp.p.....mYOpYYy.",
           "....................pYYYYYy.",
           ".Rr..Yy..Rr..Yy..Rr.yrOrYOr.",
           "mRR.mYY.mRR.mYY.mRR.mRrpRRm.",
           "mrr.myY.mrr.myY.mrr.mRRrRrm.",
           "....p.......p.......m.m.m...",
           "............................",
           "............................",
           "............................")
CONSOLE_INK = {".": "fGK0", "C": "fGK1", "b": "fGK2", "R": "fGK3", "r": "fGK4", "G": "fGK5", "g": "fGK6", "Y": "fGK7",
               "y": "fGK8", "O": "fGK9", "p": "fGKa", "m": "fGKb", "d": "fGKc"}


def console_cuts(a, b):
    """T1-3's screen and its bezel: one a tile, 30 px wide (u c-15..c+15 px)."""
    return [(c - 15 * LINE, c + 15 * LINE) for c in range(-1, 2) if a - 1e-6 <= c - 15 * LINE and c + 15 * LINE <= b + 1e-6]


def slate_console(k, ax, plane, a, b, top, foot, zf):
    """Wall (T1-3): a screen a tile, its top 3 px under the header (CONSOLE, its colours CONSOLE_INK: the slate set's
    fGK*, unlit), each px a square on the sprite's grid (tan_tops._px: the face's rows step down a px every 2 across),
    in a bezel a px wide round it, flat (painted 2*PAINT out: a part standing further out lands off the px rows and
    over the screen's edge), all of it lit (to read; a bevel by tone, top and left lit, foot and right dark, looked
    good but faint). Read left to right on either face. The faint line stops at it."""
    hi = "fGS1" if ax == "y" else "fGS2"
    cuts = console_cuts(a, b)
    for d0, d1 in cuts:
        s0, s1 = d0 + LINE, d1 - LINE                   # (the screen)
        zt = top - 3 * PZ                               # (its top)
        zb = zt - len(CONSOLE) * PZ
        for r, row in enumerate(CONSOLE):
            for x, ch in enumerate(row if ax == "y" else row[::-1]):
                _px(k, ax, plane, s0, x, r, zt, 2 * PAINT, CONSOLE_INK[ch])
        for u0, u1, z0, z1 in ((d0, d1, zt, zt + PZ), (d0, d1, zb - PZ, zb), (d0, s0, zb, zt), (s1, d1, zb, zt)):
            prism(k, ax, plane, u0, u1, [(0.0, z0), (2 * PAINT, z0), (2 * PAINT, z1), (0.0, z1)], FACE, 4,
                  cols=[False, hi, False, False])
    return _minus(a, b, cuts)


HEADER_H = RAIL_H + 9 * PZ          # the header from the stripe's foot to the rail's top (16 px)


def slate_foot_boxes(k, ax, plane, a, b, zh, mit):
    """T1-4's foot: the boxes header (slate_boxes) again, on the shelf in place of the lip (its backing from the shelf
    up HEADER_H, not on up the wall), a px down, on the face's grey (no backing); the seam over a plain wall's lip on
    along the 2 px at each tile's end to the cabinet's side."""
    slate_boxes(k, ax, plane, a, b, zh - PZ, zh - PZ + HEADER_H, mit, back=0.0, backing=False, lid=False)
    zg, g = zh + 9 * PZ, BOXES[0][0] * LINE              # (the face's zg: the lip's top 3 px over the shelf, 6 more)
    for c in range(-1, 2):
        for q0, q1 in ((c - 0.5, c - 0.5 + g), (c + 0.5 - g, c + 0.5)):
            q0, q1 = max(a, q0), min(b, q1)
            if q1 - q0 > 1e-6:
                _seam(k, ax, plane, q0, q1, zg, zg + PZ)


def box_cuts(a, b):
    """T1-8's box in the lip: one a tile, 10 px wide (u c-5..c+5 px, over the recess it takes the place of)."""
    return [(c - 5 * LINE, c + 5 * LINE) for c in range(-1, 2) if a - 1e-6 <= c - 5 * LINE and c + 5 * LINE <= b + 1e-6]


def door_cuts(a, b):
    """T1-6's doors: one a tile, 17 px wide (u c-8..c+9 px), where the face holds a whole one."""
    return [(c - 8 * LINE, c + 9 * LINE) for c in range(-1, 2) if a - 1e-6 <= c - 8 * LINE and c + 9 * LINE <= b + 1e-6]


def slate_door(k, ax, plane, a, b, top, foot, zf):
    """Wall (T1-6): a double door a tile (door_cuts: the stripe and the lip's middle recess left out there) from the
    stripe's top down to the seam over the lip, the face's grey; a dark line at each side and between the leaves,
    each leaf's right edge lit, its top px lit, a small handle on each leaf 2 px off the
    middle (the ref's proportions). The faint line stops at it."""
    lit, hi = ("fGS2", "fGS1") if ax == "y" else ("fGS3", "fGS2")
    zt = top + 6 * PZ                                   # (the stripe's top)
    H = round((zt - foot) / PZ)
    h1 = zt - round(9 * H / 20) * PZ                    # (the handles: 9 / 20 of the way down, 5 / 20 tall)
    h0 = h1 - round(5 * H / 20) * PZ

    def strip(u0, u1, z0, z1, col):
        prism(k, ax, plane, u0, u1, [(0.0, z0), (2 * PAINT, z0), (2 * PAINT, z1), (0.0, z1)], FACE, 4,
              cols=[False, col, False, False])

    cuts = door_cuts(a, b)
    for d0, d1 in cuts:
        c = d0 + 8 * LINE
        for q in (d0, c, c + 8 * LINE):                                                     # its lines
            T.paint(k, ax, plane, q, q + LINE, foot, zt, 0.0, FACE, 1)
        for l0, l1 in ((d0 + LINE, c), (c + LINE, c + 8 * LINE)):                           # its leaves
            strip(l1 - LINE, l1, foot, zt - PZ, lit)                                        # (the right edge lit)
            strip(l0, l1, zt - PZ, zt, hi)                                                  # (the top px lit)
        for x0 in (c - 4 * LINE, c + 2 * LINE):                                             # the handles
            strip(x0, x0 + LINE, h0, h1, hi)
            T.paint(k, ax, plane, x0 + LINE, x0 + 2 * LINE, h0, h1, 0.0, FACE, 1)
    return _minus(a, b, cuts)


SLATE_TOPS = (Design("plain"), Design("boxes, panel", header=slate_boxes, wall=slate_panel),
              Design("door", wall=slate_door, cut=door_cuts), Design("hatches", wall=slate_hatches),
              Design("panel, box", wall=slate_panel_box, lip=box_cuts),
              Design("boxes, console", header=slate_boxes, wall=slate_console),
              Design("tall rail, console, boxes", header=slate_tall_rail, wall=slate_console,
                     foot=slate_foot_boxes))
SLATE_RAMPS = (Design("plates", ramp=slate_plate), Design("grey panel", ramp=slate_grey_panel))


class Slate(Faction):
    pre = "fG"

    def relief(self, sprite):
        return _style(slate, skirt=None, seam=0, ramp_solid=True, shell=LookShell, joint=1,
                      shelf=SHELF, shelf_back=(0, 1),   # (the shelf's back: a dark crease under the lip, a dim px)
                      ramp_bands=((SPLIT, BLUE, (4, "fGT0"), EDGE), (SPLIT + EDGE / T.W.skirt_run(), BLUE, 3, 0.0)),   # (a
                      toe_lvl={"wall": "fGT1", "blue": "fGT1"}, tops=SLATE_TOPS, ramps=SLATE_RAMPS,   # seam, the blue plate's lit edge)
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone(BLUE, 3), FaceHoles(),
                                SlateTones()))
