"""Slate (set 2, a working name): a mid-grey wall under a bright blue header, a rail 2 px proud in three blocks a tile
(the middle one set back a px, its top sloping down 2 px to the front) over a painted blue stripe; a lit lip at the
face's foot with a groove over it; its ramp light grey over a blue plate, the foot blue."""
from .. import wall3d as T
from ..relief_style import Design
from .base import Faction, _style
from .parts import LINE, PAINT, PX, PZ, body, prism
from .shell import NO, FaceHoles, Feature, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends

FACE = "rose"                       # the face's family (its second tone: the wall family is the ramp's light grey)
BLUE = "ochre"                      # the trim's
RAIL_D, MID_D = PX, PX / 2          # the rail's depth: its end blocks' (2 px: a PX shows 2 px down a lit face), its
                                    # middle block's (set back a px)
RAIL_H = 7 * PZ                     # the rail's front
END_W = 0.25                        # its end blocks along a tile (the middle block between them)
LIP_D, LIP_H = PX, 3 * PZ           # the lip at the face's foot: its depth (2 px), its height
MID_DROP = 3 * PZ                   # the middle block's top: its front edge this far under its back
SHELF = 4 / 32                      # the ramp's top a flat step this deep against the wall (4 px)


def _shelf_z(zs):
    """The shelf's height (the slope's, SHELF out from the wall)."""
    return zs - SHELF * T.W.GN * T.W.RAMP_PX / T.W.ZART


class SlateTones(Feature):
    """The shell's faces in the face's grey (the second tone); the dark outlines at the foot and under the top stay."""
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
        if endf:
            _end_section(k, ax, plane, a, b, zs, zst - 6 * PZ if full else top, F)
        if not endf:
            T.run(k, ax, plane, a, b, pe, _shelf_z(zs) - 0.01, zs + 0.02, PAINT, FACE, 3, 0)   # the face on down
                                                                                                # to the shelf
            zl = _shelf_z(zs) + 3 * PZ                  # the lip (its foot meets the shelf's dark back on screen)
            top_ = "fGS2" if ax == "y" else "fGS3"      # (its top a step under a lit top's: a soft edge)
            prism(k, ax, plane, a, b, [(0.0, zl - PZ), (LIP_D, zl - PZ), (LIP_D, zl + LIP_H), (0.0, zl + LIP_H)],
                  FACE, 3, cols=[False, None, top_, False], mitre=mit)
            hl = "fGS1" if ax == "y" else "fGS2"        # its front's top px lit (under the seams over it)
            prism(k, ax, plane, a, b, [(LIP_D, zl + LIP_H - PZ), (LIP_D + PAINT / 2, zl + LIP_H - PZ),
                                       (LIP_D + PAINT / 2, zl + LIP_H), (LIP_D, zl + LIP_H)], FACE, 3,
                  cols=[False, hl, False, False], mitre=mit)
            zg = zl + 6 * PZ                            # a dark seam over it (2 px of face between, a px wide)
            room = zg + PZ < top - 0.03                 # (under a low cut, walls down: the lip's seams up to it,
            if room or top - zl - LIP_H > 0.01:         # no seam over it)
                if room:
                    _seam(k, ax, plane, a, b, zg, zg + PZ)
                    for c in range(-1, 2):              # a recess on it at each tile's middle, 8 px wide, 3 px
                        q0, q1 = c - 4 * LINE, c + 4 * LINE     # tall, in the seam's tone, its top px the
                                                                # faint line's on the face over it
                        if a - 1e-6 <= q0 and q1 <= b + 1e-6 and not any(x0 <= q0 and q1 <= x1 for x0, x1 in cuts):
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
        for u0, u1, mid in _blocks(a, b):                                                      # the rail
            d = MID_D if mid else RAIL_D
            zb = z0 - PZ if mid else z0                 # (the set-back middle a px lower: its foot shows on the
            prof = [(0.0, zb), (d, zb), (d, z1 - MID_DROP), (0.0, z1)] if mid else \
                [(0.0, zb), (d, zb), (d, z1), (0.0, z1)]                                       # ends' line)
            m = (mit[0] if abs(u0 - a) < 1e-6 else 0.0, mit[1] if abs(u1 - b) < 1e-6 else 0.0)
            inner = "fGT3" if ax == "y" else "fGT4"     # (an end block's side by the middle: a step under its front)
            cap = None if mid else (inner if abs(u0 % 1.0 - END_W) < 1e-6 else None,
                                    inner if abs(u1 % 1.0 - (1 - END_W)) < 1e-6 else None)
            prism(k, ax, plane, u0, u1, prof, BLUE, 3, cap=cap, mitre=m)
            if cap and cap[0]:                          # (the end block past the middle: its side by the middle
                prism(k, ax, plane, u0, u0 + LINE, [(d, z0), (d + PAINT, z0), (d + PAINT, z1 - PZ), (d, z1 - PZ)],
                      BLUE, 3, cols=[False, inner, False, False])   # faces away from the camera, a seam on its front)
            zt = z1 - MID_DROP if mid else z1                                                  # its front's top
            prism(k, ax, plane, u0, u1, [(0.0, zt - PZ), (d + PAINT, zt - PZ), (d + PAINT, zt), (0.0, zt)], BLUE, 4,
                  cols=[False, "fGTw", False, False], mitre=m)     # edge lit (fGTw: over the ramp's light end, its own)
    return face


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


def slate_boxes(k, ax, plane, a, b, z0, z1, mit):
    """Header (T1-2, T1-3): three blue boxes a tile over the stripe's foot to the rail's top, in place of both, on a
    backing in the stripe's blue (2 px gaps at each end and between them, 2 px under them); their fronts flush, their corners
    rounded a px (the middle one's bottom ones only), its top sloping 4 px down to its front, lit; a seam low across
    each, the end ones a handle slot near the top."""
    T.paint(k, ax, plane, a, b, z0, z1 + 0.031, 0.0, BLUE, 3)              # the backing, the stripe's blue (up to
                                                                           # the wall's top)
    side = "fGT4" if ax == "y" else "fGT5"              # (a box's +u side, the one the camera sees: two steps under
    lit = "fGT0" if ax == "y" else "fGT1"               # its front; its front's top edge lit, its foot's edge in the
    dark = side                                         # side's tone)
    zb, d = z0 + 2 * PZ, RAIL_D                         # (the boxes' foot)
    for c in range(-1, 2):
        for x0, w, mid in BOXES:
            u0, u1 = c - 0.5 + x0 * LINE, c - 0.5 + (x0 + w) * LINE
            q0, q1 = max(a, u0), min(b, u1)
            if q1 - q0 < 1e-6:
                continue
            top = ("fGT1" if ax == "y" else "fGT2") if mid else None           # (the middle one's sloped top lit)
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
            prism(k, ax, plane, q0, q1, [(0.0, z0 + 7 * PZ), (d + PAINT, z0 + 7 * PZ), (d + PAINT, z0 + 8 * PZ),
                                         (0.0, z0 + 8 * PZ)], BLUE, 4, cols=[False, side, False, False], cap=False)
                                                        # a seam across, edge to edge, in the side's tone
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


def slate_panel(k, ax, plane, a, b, top, foot, zf):
    """Wall (T1-2, T1-8): an outlined panel a tile, 22 px wide, 15 px tall, its foot 5 px over the seam over the lip,
    its corners rounded as the ramp's blue panel's (each corner pixel left out); a lit bar 3 px tall along its inside
    top, 2 px under its top line; a lit tick 7 px each side of the middle from a px under its foot up 4 px."""
    lit = "fGSb" if ax == "y" else "fGSc"               # (the bar and ticks a bluer grey, the ref's)
    W, K = 11 * LINE, 7 * LINE
    zb = foot + 5 * PZ
    zt = zb + 15 * PZ
    gaps, u = [], a                                     # (the face's faint line runs on behind it)
    for c in range(-1, 2):
        if not (a - 1e-6 <= c - W and c + W <= b + 1e-6):
            continue
        if zb <= zf and zf + PZ <= zt:
            gaps.append((u, c - W))
            u = c + W
        for u0, u1, z0, z1 in ((c - W + LINE, c + W - LINE, zt - PZ, zt), (c - W + LINE, c + W - LINE, zb, zb + PZ),
                               (c - W, c - W + LINE, zb + PZ, zt - PZ), (c + W - LINE, c + W, zb + PZ, zt - PZ)):
            T.paint(k, ax, plane, u0, u1, z0, z1, 0.0, FACE, 1)
        for u0, u1, z0, z1, col in ((c - 7 * LINE, c + 7 * LINE, zt - 6 * PZ, zt - 3 * PZ, lit),
                                    (c - K, c - K + LINE, zb - PZ, zb + 3 * PZ, lit),
                                    (c + K - LINE, c + K, zb - PZ, zb + 3 * PZ, lit)):
            prism(k, ax, plane, u0, u1, [(0.0, z0), (2 * PAINT, z0), (2 * PAINT, z1), (0.0, z1)], FACE, 4,
                  cols=[False, col, False, False])
    return [(g0, g1) for g0, g1 in gaps + [(u, b)] if g1 - g0 > 1e-6]


def _minus(a, b, cuts):
    """[a, b] less the spans in cuts (sorted, inside it)."""
    out, u = [], a
    for x0, x1 in sorted(cuts):
        out.append((u, x0))
        u = x1
    return [(g0, g1) for g0, g1 in out + [(u, b)] if g1 - g0 > 1e-6]


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
              Design("door", wall=slate_door, cut=door_cuts))
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
