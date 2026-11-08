"""Navy (set 4): light plates, a maroon band, a dark header with a lit tube on brackets and white caps; its shell (also
civil's) and its straight-run designs."""
from .. import wall3d as T
from .base import Faction, _style
from .navy_designs import NAVY_RAMPS, NAVY_TOPS, navy_band
from .parts import LINE, PAINT, PX, _slab, body, bracket, corner_piece, tube, tube_prof
from .slate import LIP_D, SHELF
from .shell import (
    NO,
    Chamfer,
    FaceHoles,
    Feature,
    FloorDrop,
    FootTone,
    FreeEnds,
    LookShell,
    RampHoles,
    _end_section,
    _ends,
    _ramp_chamfer,
)

NAVY_SEAM = 7.5 / 32               # the panel line, in from each tile's high edge, up the face and down the ramp: one
                                    # a tile, the cover on its low side, a narrow strip on its high (the ref's; on the
                                    # px grid: a px wide, it fills whole px on both faces)


NAVY_SHELF = SHELF + LIP_D          # the ramp's shelf: slate's and the lip's depth, all of it shelf (the user)
NAVY_FALL = 3                       # the slope's fall a cell (art px): the shelf up at 19 px, a taller slope (the user)
NAVY_FACE = 2                       # the face's level (the slope's plates a level under, the shelf's top one over):
                                    # the face and slope swapped with the shelf's top (the user; were 3, 2, 2)
NAVY_MID = "fBT1"                   # an outer corner's chamfer (wall and slope): between the lit and the shade faces'
                                    # tones (a9b4c4, 8e9cb1): 9cacbc; its shelf likewise (NAVY_MID_SHELF) (the user;
                                    # existing palette tones: new ones that close snap to these)
NAVY_MID_SHELF = ("fBW0", "fBT8", "fBT0", "fNH1")   # back px 74849c, 8494ac; top b4bccc; lit edge c9cfd8
FRAME, COVER = PAINT / 2, PAINT     # the face's dark frame, and its covers standing proud of it (a design's band on
                                    # them, navy_designs.BAND)
LINES = 2 * PAINT                   # the panel line and its lit px, over the band (on the px grid at this depth: further
                                    # out they shift off it and blur)
NAVY_RAMP_SEAM = 5.5 / 32           # the ramp's line: 2 px further along than the wall's (the user)
RED_AT = 9 / 11                     # the ramp's red band: from 9 px out (of its 11) down over the toe (its last px)
                                    # to the foot (the user)
NAVY_C = 3 / 32                     # a partition's outer corner: chamfered this far along each axis, wall and ramp


class PlateTones(Feature):
    """The shell's faces in the ramp plates' tone (set 4's wall and ramp are one light grey, its shade side a step
    darker); the dark outlines at the foot and under the top stay. An outer corner's ramp chamfer (Chamfer) carries
    the plates' tone, the toe band and the foot line (navy's and civil's)."""
    def col_skirt(self, sp, i, j, kind, x, y):
        d, r = sp._dist(x, y)
        if sp.line is None or (x - sp.line[0] + y - sp.line[1] + sp.band) / 2 < d - 1 / T.W.GN:
            return NO
        d = max(d, (x - sp.line[0] + y - sp.line[1] + sp.band) / 2)     # (the cells along its edges too: they reach
        fam = "blue" if r[1] == "hull" else "wall"                       # past the plates, so in the joints' tone they
                                                                         # dotted the edges)
        if sp.foot and d > sp.run - 1 / T.W.GN:                          # (the chamfer's toe crosses cells: their
            return sp.col_face("y", x, y, 0.0)                           # drop is the upright foot's, in its colour)
        if d < 0.02:                                                     # the line where the ramp meets the wall
            return T.RAMPS[fam][0][1 if T.style().joint is None else T.style().joint]
        if sp.run - 0.03 > d >= T.style().toe_at * sp.run and not sp.foot:
            return T.RAMPS["ochre"][0][4]
        return NAVY_MID if fam == "wall" else T.RAMPS[fam][0][NAVY_FACE]

    def band(self, sp, fam):                            # (a solid ramp's chamfer: as col_skirt colours its cells)
        R, jt, ta = T.RAMPS[fam][0], T.style().joint, T.style().toe_at * sp.run
        joint, mid = R[1 if jt is None else jt], NAVY_MID if fam == "wall" else R[NAVY_FACE]
        if sp.foot:
            return [(0.02, joint), (sp.run, mid)]
        return [(0.02, joint), (ta, mid), (sp.run - 0.03, T.RAMPS["ochre"][0][4]), (sp.run, R[NAVY_FACE])]

    def col_face(self, sp, face, x, y, z):
        c = T.Shell.col_face(sp, face, x, y, z)
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        top = r[3] if r else sp.top
        if z < T.lip_heights(sp.zs)[0] + 0.02 or z > top - 0.03:      # (the outline at the shelf's height)
            return c
        if face == "d" and not (r and r[1] == "hull"):
            return NAVY_MID
        return T.RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0][NAVY_FACE + (face == "d")]


def _seam(k, ax, plane, u0, u1, z0, z1, F):
    """A plate seam up the face, a shade darker on screen than level 1 was (the user). Its px are blended with the
    face (AA): on the x face level 0 reads a shade down; on the lit y face level 0 read two, so it takes fNW6, which
    reads one (fNW5 on the light plates)."""
    if ax == "x" or F != "wall" or T.CLIP is not None:  # (under a breach's tear: the slab, cut off along it)
        return T.paint(k, ax, plane, u0, u1, z0, z1, LINES - PAINT, F, 0)
    k.poly([T.P(ax, plane, u, z, LINES) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], F, 0, T.OUT(ax),
           fixed="fNW6")


def _sheet(k, ax, plane, u0, u1, ends, z0, z1, d, fam, lvl):
    """A flat sheet d proud of the face (the frame, a cover): its front only, run on by d at an outer end as T.run and
    at a tile edge into the next tile (a slab's sides darkened a tile's edge column; stopped at the edge, the face
    behind showed a shade darker there: a line between tiles; under a breach's tear, T.run's torn slab)."""
    if T.CLIP is not None:
        return T.run(k, ax, plane, u0, u1, ends, z0, z1, d, fam, lvl, 0)
    u0, u1 = u0 - (d if ends[0] in ("out", "cont") else 0.0), u1 + (d if ends[1] in ("out", "cont") else 0.0)
    k.poly([T.P(ax, plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], fam, lvl, T.OUT(ax))


def _lit(k, ax, plane, u, z0, z1, F, reds):
    """The panel line's lit px on its high side (the strip's edge, the ref's): a level over the face, and over the
    band's red (reds: (bottom, top)) a level over the red."""
    z = z0
    for r0, r1 in reds + [(z1, z1)]:
        for lo, hi, fam, lvl in ((z, min(r0, z1), F, NAVY_FACE + 1), (max(r0, z0), min(r1, z1), "ochre", 4)):
            if hi - lo > 1e-6:
                k.poly([T.P(ax, plane, uu, zz, LINES) for uu, zz in ((u, lo), (u + LINE, lo), (u + LINE, hi),
                                                                          (u, hi))], fam, lvl, T.OUT(ax))
        z = max(z, r1)


RECESS_D = 2 / 32                   # a top design's recess under its cover (when it opens the face): its side 2 px


def _recess_in(k, ax, plane, hole):
    """The recess a top design sits in (its face hole, RECESS_D deep): its back in the frame's dark, its walls."""
    from .navy_designs import _recess
    u0, u1, z0, z1 = hole
    k.poly([T.P(ax, plane, u, z, -RECESS_D) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "rose", 2,
           T.OUT(ax))
    _recess(k, ax, plane, u0, u1, z0, z1, 0.0, -RECESS_D)
    k.poly([T.P(ax, plane, u, z, PAINT - RECESS_D) for u, z in ((u0, z1 - 2 / 39.19), (u1, z1 - 2 / 39.19), (u1, z1),
                                                                (u0, z1))], "rose", 1, T.OUT(ax))   # (the lip's
    #   shadow on its back: 2 px darker under the top)


def _plates(a, b, ends):
    """A navy face's plates (u0, u1, "cover" or "strip") and its panel lines: each tile its cover, then its strip with
    the line between; a corner's, an end's or a narrow tile one cover."""
    lines, plates = [], []
    for s0, s1 in T.spans(a, b):
        if ((abs(s0 - a) < 1e-6 and ends[0] != "cont") or (abs(s1 - b) < 1e-6 and ends[1] != "cont")
                or s1 - s0 <= 2 * NAVY_SEAM + 1e-3):
            plates.append((s0, s1, "cover"))
            continue
        lines.append(s1 - NAVY_SEAM)
        plates += [(s0, s1 - NAVY_SEAM, "cover"), (s1 - NAVY_SEAM, s1, "strip")]
    return lines, plates


def _heights(zs, top):
    """A full navy face's heights: its foot (the ramp's shelf), the header's foot, its height and top."""
    rt = min(top, T.W.wall_top("wall", "up"))          # laid out on a partition's height on every wall, so the far
    H = rt - zs                                         # hull's parts line up
    return T.lip_heights(zs)[0], rt - 0.25 * H, H, rt


def cover_rects(sh, ax, plane, a, b, ends, zs, top):
    """The covers a full navy face lays out, (u0, u1, z0, z1) each, as face() does (a design that opens the face
    where its cover is off: navy_designs.cage_holes)."""
    if _ends(ax, plane, b, ends, sh)[2]:
        b -= NAVY_C
    zf, zh = _heights(zs, top)[:2]
    return [(p0, p1, zf, zh) for p0, p1, kind in _plates(a, b, ends)[1] if kind == "cover"]


def navy(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        X, C = b, NAVY_C
        endf, end1, corner, back = _ends(ax, plane, b, ends)    # (at a wall's end the tube stops)
        if corner:                                      # the chamfered corner: the parts stop where it starts and
            b -= C                                      # carry round it on corner pieces (drawn with the y face)
        cp = corner and ax == "y"
        pe = ("in" if back else ends[0], ends[1])       # (at a hidden free end the parts stop square: run on, they
                                                        # stuck out past the end)
        zf = T.lip_heights(zs)[0]                      # the face's foot: down to the ramp's shelf
        if cp:
            corner_piece(k, X, plane, C, _slab(zf - 0.03, zs + 0.06, PAINT), F, NAVY_FACE + 1,   # (as the chamfer's
                         cols=[NAVY_MID] * 4 if F == "wall" else None)      # strip over it)
            _ramp_chamfer(k, X, plane, C, zs, F, NAVY_FACE, NAVY_MID if F == "wall" else None)
        rt = _heights(zs, top)[3] if full else top      # (laid out on a partition's height on every wall)
        H = rt - zs
        zh = _heights(zs, top)[1] if full else top      # the header's foot
        bf = T.fill("band", navy_band) if full else None
        reds = sorted((zh - f0 * H, zh - f1 * H) for f0, f1 in navy_band.reds) if full else []   # (the line's lit
        #   px is the strip's edge: in its band's red)
        mid = T.fill("middle") if full else None        # a top design's: in place of the cover (off), in the frame
        zc = zh if full else top - 0.03                 # the covers' top: under the header (a low wall's top)
        lines, plates = _plates(a, b, ends)             # the panel lines and the plates they split the tiles into
        off = ("cover",) if mid else ()                 # (the plates a variant takes off)
        for p0, p1, kind in plates:                     # the covers (and strips), each with its part of the band; one
            pq = (pe[0] if abs(p0 - a) < 1e-6 else "cont", pe[1] if abs(p1 - b) < 1e-6 else "cont")   # off shows the
            if kind in off:                                                                  # dark frame behind it
                hole = next((h[2:] for h in getattr(T.SHELL, "face_holes", ()) if h[0] == ax and abs(h[1] - plane)
                             < 1e-6 and p0 - 1e-6 <= h[2] < p1), None)      # (unless the design opens the face there:
                if hole is None:                                            # it builds its own frame in the opening)
                    _sheet(k, ax, plane, p0, p1, pq, zf - 0.03, zc, FRAME, "rose", 2)
                elif not getattr(mid, "own_hole", False):   # (or a recess RECESS_D deep, the design inside it: a
                    _recess_in(k, ax, plane, hole)          # recess under the cover, its walls showing: the user)
                    mid(k, ax, plane - RECESS_D, p0 + 0.04 - RECESS_D, p1 - 0.04 - RECESS_D, zf + 0.04, zh - 0.04, F,
                        zh=zh, H=H)                 # (as far left as seen as before: a depth shifts it a px a LINE)
                    continue
                mid(k, ax, plane, p0 + 0.04, p1 - 0.04, zf + 0.04, zh - 0.04, F, zh=zh, H=H, hole=hole)   # (the design in
                #   the opening; zh, H: the header's foot and the wall's height, for a band in it)
                continue
            _sheet(k, ax, plane, p0, p1, pq, zf - 0.03, zc, COVER, F, NAVY_FACE)
            band = navy_band if kind == "strip" else bf   # (a band design's on the cover: the strip keeps the red)
            if band:                                    # (on into the next tile with the cover: stopped at the
                ext = 1.5 * PAINT                       # edge, the cover past it lit the edge px a red line)
                band(k, ax, plane, p0 - (ext if pq[0] == "cont" else 0.0), p1 + (ext if pq[1] == "cont" else 0.0),
                     pq, zh, H)
        for u in lines:
            _seam(k, ax, plane, u - LINE / 2, u + LINE / 2, zf - 0.03, zh, F)
            _lit(k, ax, plane, u + LINE / 2, zf - 0.03, zh, F, reds)
        if ax == "y":                                   # a seam up an inner corner (on the lit face, one px, as the
            for u, e in ((a, ends[0]), (b, ends[1])):   # plates' seams)
                if e == "in":
                    u0 = u if u == a else u - LINE
                    _seam(k, ax, plane, u0, u0 + LINE, zf - 0.03, zh, F)
        if endf:
            _end_section(k, ax, plane, a, b, zs, zh - 0.33 * H if full else top, F, foot=F)   # (its feet the
            #   section's: the red is the slope's band now, not the foot)
        if not full:
            return
        mit = (0.0 if back else {"in": -1.0}.get(ends[0], 0.0), {"out": 1.0, "in": -1.0}.get(ends[1], 0.0))
        T.run(k, ax, plane, a, b, pe, zh, rt, PX, "rose", 2, 0)          # the dark header, up to the cap (a step under
                                                                         # it showed as a dotted line on the black top)
        zc, r, dc = rt - 0.1, 0.055, PX + 0.055                                                  # the tube, high up
        if not endf:                                    # (none on a wall's end face; it stops in the end bracket)
            tube(k, ax, plane, a + (0.02 if back else 0.0), b - (0.02 if end1 else 0.0), dc, zc, r,
                 mitre=(mit[0], 0.0 if end1 else mit[1]))
        if cp:
            corner_piece(k, X, plane, C, _slab(zh, rt, PX), "rose", 2)
            corner_piece(k, X, plane, C, _slab(zh - 0.33 * H, zh, PAINT), "ochre", 3)
            prof, cols = tube_prof(dc, zc, r)
            corner_piece(k, X, plane, C, prof, "wall", 0, cols, "or")
        bw = 0.1
        clear = {"out": 0.05, "in": dc + r + 0.03}      # brackets clear of a corner (and of the other face's tube)
        for s0, s1 in ([] if endf else T.spans(a, b)):  # one bracket a tile, at the tile's middle (clear of a
            lo = s0 + ((0.02 if back else clear.get(ends[0], 0.0)) if abs(s0 - a) < 1e-6 else 0.0)   # corner)
            hi = s1 - ((0.02 if end1 else clear.get(ends[1], 0.0)) if abs(s1 - b) < 1e-6 else 0.0)
            um = (s0 + s1) / 2
            if lo <= um - bw / 2 and um + bw / 2 <= hi:
                bracket(k, ax, plane, um - bw / 2, um + bw / 2, dc, zc, 0.085, zc - 0.15, zc + 0.1, F, 4)
        if hull and variant:
            for s0, s1 in T.spans(a, b):
                if s1 - s0 > 0.6:
                    uc = (s0 + s1) / 2
                    T.paint(k, ax, plane, uc - 0.1, uc + 0.1, zh - 0.3, zh - 0.06, LINES, F, 4)
    return face


def navy_hole_tone(part, fam, ax, n):
    """The open ramp's walls as navy_pipes draws them (its back in the wall's dark, its sides the second tone)."""
    from .navy_designs import CAV
    return CAV[1] if part == "back" else CAV[2]


class Navy(Faction):
    pre = "fN"

    def relief(self, sprite):
        return _style(navy, skirt=None, toe="ochre", toe_at=RED_AT, seam=NAVY_SEAM, one_seam=True, ramp_seam=NAVY_RAMP_SEAM, joint=0, chamfer=NAVY_C,
                      ramp_solid=True,                  # (toe_at: the red band on a corner's chamfer and an end's
                      #   ramp, as on the ramp)
                      toe_lvl={"wall": ("fNT2", "fNT2"), "blue": ("fNT2", "fNT2")},  # (the toe in the red band's tones)
                      ramp_bands=((RED_AT, "ochre", 2, 0.0),),    # the red band on the slope, just over the toe
                      shelf=NAVY_SHELF, shelf_lvl=NAVY_FACE + 1, shelf_back=(0, 1),
                      chamfer_shelf=NAVY_MID_SHELF,   # (the default's and slate's ramp:
                      #   a flat shelf at the wall, all shelf: no lip on it)
                      ramp_px=NAVY_FALL, seam_wrap=True, ramp_lvl=NAVY_FACE - 1,   # (the slope steeper under the shelf)
                      hole_tone=navy_hole_tone, shell=LookShell, tops=NAVY_TOPS, ramps=NAVY_RAMPS,
                      features=(FreeEnds(), RampHoles(), Chamfer(NAVY_C), FloorDrop(), FootTone("wall", 2),
                                FaceHoles(), PlateTones()))
