"""Navy (set 4): light plates, a maroon band, a dark header with a lit tube on brackets and white caps; its shell (also
civil's) and its straight-run designs."""
from .. import wall3d as T
from .base import Faction, _style
from .navy_designs import NAVY_RAMPS, NAVY_TOPS, navy_band, navy_recess
from .parts import LINE, PAINT, PX, _slab, body, bracket, corner_piece, tube, tube_prof
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

NAVY_SEAM = 7.5 / 32               # the plate seams, in from each tile edge, up the face and down the ramp (on the px
                                    # grid: a px wide, they fill whole px on both faces)


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
        return T.RAMPS[fam][0][3]

    def band(self, sp, fam):                            # (a solid ramp's chamfer: as col_skirt colours its cells)
        R, jt, ta = T.RAMPS[fam][0], T.style().joint, T.style().toe_at * sp.run
        joint = R[1 if jt is None else jt]
        if sp.foot:
            return [(0.02, joint), (sp.run, R[3])]
        return [(0.02, joint), (ta, R[3]), (sp.run - 0.03, T.RAMPS["ochre"][0][4]), (sp.run, R[3])]

    def col_face(self, sp, face, x, y, z):
        c = T.Shell.col_face(sp, face, x, y, z)
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        top = r[3] if r else sp.top
        if z < sp.zs + 0.02 or z > top - 0.03:
            return c
        return T.RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0][4 if face == "d" else 3]


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
        T.run(k, ax, plane, a, b, pe, zs - 0.03, zs + 0.06, PAINT, F, 3, 0)
        if cp:
            corner_piece(k, X, plane, C, _slab(zs - 0.03, zs + 0.06, PAINT), F, 3)
            _ramp_chamfer(k, X, plane, C, zs, F)
        rt = min(top, T.W.wall_top("wall", "up")) if full else top     # laid out on a partition's height on every
        H = rt - zs                                                     # wall, so the far hull's parts line up
        zh = rt - 0.25 * H if full else top                             # the header's foot
        for s0, s1 in T.spans(a, b):                                    # plate seams (none on a corner's tile)
            if (abs(s0 - a) < 1e-6 and ends[0] != "cont") or (abs(s1 - b) < 1e-6 and ends[1] != "cont"):
                continue
            if s1 - s0 > 2 * NAVY_SEAM + 1e-3:
                for u in (s0 + NAVY_SEAM, s1 - NAVY_SEAM):
                    T.paint(k, ax, plane, u - LINE / 2, u + LINE / 2, zs - 0.03, zh, PAINT, F, 1)
        if ax == "y":                                   # a seam up an inner corner (on the lit face, one px, as the
            for u, e in ((a, ends[0]), (b, ends[1])):   # plates' seams)
                if e == "in":
                    u0 = u if u == a else u - LINE
                    T.paint(k, ax, plane, u0, u0 + LINE, zs - 0.03, zh, PAINT, F, 1)
        if endf:
            _end_section(k, ax, plane, a, b, zs, zh - 0.33 * H if full else top, F)
        if not full:
            return
        mit = (0.0 if back else {"in": -1.0}.get(ends[0], 0.0), {"out": 1.0, "in": -1.0}.get(ends[1], 0.0))
        T.run(k, ax, plane, a, b, pe, zh, rt, PX, "rose", 1, 0)          # the dark header, up to the cap (a step under
                                                                         # it showed as a dotted line on the black top)
        T.fill("band", navy_band)(k, ax, plane, a, b, pe, zh, H)                              # the maroon band
        mid = T.fill("middle")                          # (a top design's: in a dark recess between band and foot)
        if mid:
            for s0, s1 in T.spans(a, b):
                navy_recess(k, ax, plane, s0 + 0.06, s1 - 0.06, zs + 0.1, zh - 0.02, F, mid)
        zc, r, dc = rt - 0.1, 0.055, PX + 0.055                                                  # the tube, high up
        if not endf:                                    # (none on a wall's end face; it stops in the end bracket)
            tube(k, ax, plane, a + (0.02 if back else 0.0), b - (0.02 if end1 else 0.0), dc, zc, r,
                 mitre=(mit[0], 0.0 if end1 else mit[1]))
        if cp:
            corner_piece(k, X, plane, C, _slab(zh, rt, PX), "rose", 1)
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
                    T.paint(k, ax, plane, uc - 0.1, uc + 0.1, zh - 0.3, zh - 0.06, 2 * PAINT, F, 4)
    return face


def navy_hole_tone(part, fam, ax, n):
    """The open ramp's walls as navy_pipes draws them (its back in the wall's dark, its sides the second tone)."""
    return T.tone("wall", 0, n, ax) if part == "back" else T.tone("rose", 2, n, ax)


class Navy(Faction):
    pre = "fN"

    def relief(self, sprite):
        return _style(navy, skirt=None, toe="ochre", seam=NAVY_SEAM, joint=4, chamfer=NAVY_C, ramp_solid=True,
                      hole_tone=navy_hole_tone, shell=LookShell, tops=NAVY_TOPS, ramps=NAVY_RAMPS,
                      features=(FreeEnds(), RampHoles(), Chamfer(NAVY_C), FloorDrop(), FootTone("ochre", 2),
                                FaceHoles(), PlateTones()))
