"""Tan (set 3, a working name): tan panelling. A lit header block under the cap; under it louvred slats either side of
a raised centre panel; a lip at the face's foot over a dark line and a blue one; the ramp pale tan plates in a
grooved layout over a blue toe."""
from .. import wall3d as T
from ..relief_style import Design
from .base import Faction, _style
from .parts import LINE, PAINT, PX, PZ, body, prism
from .shell import FaceHoles, Feature, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends

FACE = "rose"                       # the face's family (its second tone: the wall family is the ramp's pale tan)
BLUE = "ochre"                      # the trim's: the line at the face's foot, the toe
HEAD_D, HEAD_H = PX, 9 * PZ         # the header block: its depth (2 px of lit top), its front
LIP_D, LIP_H = PX, 3 * PZ           # the lip at the face's foot
SLAT_D, SLAT_H, SLAT_P = PX / 2, 2 * PZ, 4 * PZ   # a slat: its depth (a px of lit top), its front, its pitch
PANEL_D = PX                        # the raised centre panel's depth
PANEL_W = 1 / 3                     # ... its width (a tile's middle third)


class TanTones(Feature):
    """The shell's faces in the face's tan (the second tone); the dark outlines at the foot and under the top stay."""
    def col_face(self, sp, face, x, y, z):
        c = T.Shell.col_face(sp, face, x, y, z)
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        top = r[3] if r else sp.top
        if z < sp.zs + 0.02 or z > top - 0.03:
            return c
        return T.RAMPS[FACE][1 if face == "x" else 0][3]


def _panels(a, b):
    """The face over [a, b] on each tile's grid: (u0, u1, centre panel?)."""
    out = []
    h = PANEL_W / 2
    for c in range(-1, 2):
        for u0, u1, mid in ((c - 0.5, c - h, False), (c - h, c + h, True), (c + h, c + 0.5, False)):
            q0, q1 = max(a, u0), min(b, u1)
            if q1 - q0 > 1e-6:
                out.append((q0, q1, mid, (u0, u1)))
    return out


def tan(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, corner, back = _ends(ax, plane, b, ends)
        pe = ("in" if back else ends[0], ends[1])
        mit = (0.0 if back else {"in": -1.0}.get(ends[0], 0.0), {"out": 1.0, "in": -1.0}.get(ends[1], 0.0))
        rt = min(top, T.W.wall_top("wall", "up")) if full else top
        z1 = rt - 0.031                                 # the header's top (under the cap's black: Faction.paint)
        if endf:
            _end_section(k, ax, plane, a, b, zs, top, F)
            return
        lit = "fTS0" if ax == "y" else "fTS1"           # (a lit top: the ramp's palest)
        # the foot: a blue line, a dark one, the lip over them
        T.paint(k, ax, plane, a, b, zs - 0.01, zs + PZ, 0.0, BLUE, 3)
        T.paint(k, ax, plane, a, b, zs + PZ, zs + 2 * PZ, 0.0, FACE, 1)
        zl0, zl1 = zs + 2 * PZ, zs + 2 * PZ + LIP_H
        prism(k, ax, plane, a, b, [(0.0, zl0), (LIP_D, zl0), (LIP_D, zl1), (0.0, zl1)], FACE, 3,
              cols=[False, None, None, False], mitre=mit)
        if not full:
            return
        # the header block, its shadow under it
        zh0 = z1 - HEAD_H
        prism(k, ax, plane, a, b, [(0.0, zh0), (HEAD_D, zh0), (HEAD_D, z1), (0.0, z1)], FACE, 3,
              cols=[False, None, lit, False], mitre=mit)
        T.paint(k, ax, plane, a, b, z1 - PZ, z1, HEAD_D, FACE, 4)                 # (its front's top edge lit)
        T.paint(k, ax, plane, a, b, zh0 - 2 * PZ, zh0, 0.0, FACE, 1)
        # between them: slats either side of a raised centre panel
        zb, zt = zl1 + PZ, zh0 - 5 * PZ                 # (a px over the lip; a gap under the header's shadow)
        for u0, u1, mid, (g0, g1) in _panels(a, b):
            m = (mit[0] if abs(u0 - a) < 1e-6 else 0.0, mit[1] if abs(u1 - b) < 1e-6 else 0.0)
            if mid:
                zp0, zp1 = zb + PZ, zt + 2 * PZ
                for gu in (g0, g1 - LINE):              # (its grooves either side, up to the header's shadow)
                    if u0 - 1e-6 <= gu and gu + LINE <= u1 + 1e-6:
                        T.paint(k, ax, plane, gu, gu + LINE, zb, zh0 - 2 * PZ, 0.0, FACE, 1)
                T.paint(k, ax, plane, u0, u1, zp1, zp1 + PZ, 0.0, FACE, 1)          # (a groove over it)
                T.paint(k, ax, plane, u0, u1, zp0 - PZ, zp0, 0.0, FACE, 1)          # (its shadow under it)
                prism(k, ax, plane, u0 + LINE, u1 - LINE, [(0.0, zp0), (PANEL_D, zp0), (PANEL_D, zp1),
                                                           (0.0, zp1)], FACE, 3, cols=[False, None, None, False])
                continue
            z = zt
            while z - SLAT_H - PZ >= zb - 1e-6:          # (top down: a dark line, a slat's lit top, its front)
                T.paint(k, ax, plane, u0, u1, z - PZ, z, 0.0, FACE, 1)
                s1, s0 = z - PZ, z - PZ - SLAT_H - PZ
                prism(k, ax, plane, u0, u1, [(0.0, s0), (SLAT_D, s0), (SLAT_D, s1), (0.0, s1)], FACE, 3,
                      cols=[False, None, None, False], mitre=m)
                z -= SLAT_P
    return face


EDGE = 0.4 / 32                                 # (a px down the slope, about: 2.5 a cell)


def tan_plate(plate, u0, u1, run_, **_):
    """The base ramp's plates (grooves in the face's brown, each plate's top edge lit from its left corner): a plate
    down the tile's left, two small square plates against the wall beside it, one wide plate under them running up
    the tile's right side to the wall."""
    w, r, E = u1 - u0, run_, EDGE

    def at(f):
        return u0 + f * w

    ua, um, ub, dm = at(0.29), at(0.53), at(0.77), 0.47 * r
    for q in ((u0, u0 + LINE, 0.0, r), (ua, ua + LINE, 0.0, r),            # (the tile's edge, the left plate's)
              (ua, ub + LINE, 0.0, E), (ua, ub + LINE, dm, dm + 2 * E),    # (the small plates' top and foot)
              (um, um + LINE, 0.0, dm), (ub, ub + LINE, 0.0, dm)):         # (between them, right of them)
        plate([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], PAINT, 2, 0.0, FACE)
    for f0, f1, d in ((0.04, 0.15, 0.0), (0.30, 0.40, E), (0.54, 0.64, E), (0.30, 0.45, dm + 2 * E),
                      (0.78, 0.88, 0.0)):
        plate([(at(f0), d), (at(f1), d), (at(f1), d + E), (at(f0), d + E)], PAINT, 5, 0.0, "wall")


TAN_RAMPS = (Design("plates", ramp=tan_plate),)


class Tan(Faction):
    pre = "fT"

    def relief(self, sprite):
        return _style(tan, skirt=None, seam=0, ramp_solid=True, shell=LookShell,
                      toe_lvl={"wall": "fTT2", "blue": "fTT2"}, ramps=TAN_RAMPS,     # (the toe blue, its foot
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone(BLUE, 2), FaceHoles(),  # darker)
                                TanTones()))
