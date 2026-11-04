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
        if endf:
            _end_section(k, ax, plane, a, b, zs, zst - 6 * PZ if full else top, F)
        if not endf:
            T.run(k, ax, plane, a, b, pe, _shelf_z(zs) - 0.01, zs + 0.02, PAINT, FACE, 3, 0)   # the face on down
                                                                                                # to the shelf
            zl = _shelf_z(zs) + 3 * PZ                  # the lip (its foot meets the shelf's dark back on screen)
            top_ = "fGS2" if ax == "y" else "fGS3"      # (its top a step under a lit top's: a soft edge)
            prism(k, ax, plane, a, b, [(0.0, zl - PZ), (LIP_D, zl - PZ), (LIP_D, zl + LIP_H), (0.0, zl + LIP_H)],
                  FACE, 3, cols=[False, None, top_, False], mitre=mit)
            zg = zl + 6 * PZ                            # a dark seam over it (2 px of face between, a px wide)
            if zg + PZ < top - 0.03:
                T.paint(k, ax, plane, a, b, zg, zg + PZ, 0.0, FACE, 1)
                for u in _thirds(a, b):                 # the lip in three a tile: a seam up its front, over its
                    q0, q1 = u, u + 0.7 * LINE         # top and up the face to the seam over it
                    dq, zq = LIP_D + PAINT, zl + LIP_H + PAINT  # (over the lip: its top a step under the
                    prism(k, ax, plane, q0, q1, [(0.0, zl - PZ), (dq, zl - PZ), (dq, zq), (0.0, zq)], FACE, 1,
                          cols=[False, None, "fGS4" if ax == "y" else "fGS5", False])    # front's line, darker)
                    T.paint(k, ax, plane, q0, q1, zl + LIP_H, zg, 0.0, FACE, 1)
            if full:                                                    # a faint line, 7 px under the stripe
                T.paint(k, ax, plane, a, b, zst - 14 * PZ, zst - 13 * PZ, 0.0, FACE, 4)
        if not full:
            return
        T.paint(k, ax, plane, a, b, zst, zst + PZ, 0.0, BLUE, 1)                               # the rail's shadow
        T.run(k, ax, plane, a, b, pe, zst - 6 * PZ, zst, PAINT, BLUE, 3, 0)                    # the stripe ...
        T.paint(k, ax, plane, a, b, zst - PZ, zst, PAINT, BLUE, 4)                             # ... lit on top
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
            zt = z1 - MID_DROP if mid else z1                                                  # its front's top
            T.paint(k, ax, plane, u0, u1, zt - PZ, zt, d, BLUE, 5)                             # edge lit
    return face


SPLIT = 0.55                                    # the ramp's blue plate from here down the run, a px of seam over it
EDGE = 0.4 / 32                                 # (a px down the slope, about: 2.5 a cell)


def slate_plate(plate, u0, u1, run_, **_):
    """The base ramp's groove across the blue plate: a px line 4 px into it, half the tile wide, a 2 px tick down at
    each end (in the plate's front tone)."""
    uc, dg = (u0 + u1) / 2, SPLIT * run_ + 4 * EDGE
    w = min(0.25, (u1 - u0) / 2 - 0.06)
    for q in ((uc - w, uc + w, dg, dg + EDGE), (uc - w, uc - w + LINE, dg, dg + 3 * EDGE),
              (uc + w - LINE, uc + w, dg, dg + 3 * EDGE)):
        plate([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], PAINT, 2, 0.0, "ochre")


SLATE_RAMPS = (Design("plates", ramp=slate_plate),)


class Slate(Faction):
    pre = "fG"

    def relief(self, sprite):
        return _style(slate, skirt=None, seam=0, ramp_solid=True, shell=LookShell,
                      shelf=SHELF, shelf_back=(0, 1),   # (the shelf's back: a dark crease under the lip, a dim px)
                      ramp_bands=((SPLIT, BLUE, 4, EDGE), (SPLIT + EDGE / T.W.skirt_run(), BLUE, 3, 0.0)),   # (a
                      toe_lvl={"wall": "fGT1", "blue": "fGT1"}, ramps=SLATE_RAMPS,   # seam, the blue plate's lit edge)
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone(BLUE, 3), FaceHoles(),
                                SlateTones()))
