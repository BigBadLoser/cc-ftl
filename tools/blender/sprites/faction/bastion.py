"""Bastion (set 8): slate armour; a heavy cornice, posts at each tile edge, the face between them cut in from a sloped
foot up to the cornice; slots cut into the ramp for machinery; its shell and its straight-run designs."""
from mathutils import Vector

from .. import wall3d as T
from .. import walls as W
from .base import Faction, _style
from .bastion_designs import BAST_PANEL, BAST_RAMPS, BAST_TOPS, bast_r, bastion_hood, slot_tone
from .parts import PAINT, body, corner_piece, prism
from .shell import Feature, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends

BAST_FOOT = 4 / 39                  # the ramp ends in an upright step this high at the floor (set 8), its lip lit

BAST_L = 2 / 32                     # the lip: the wall below the cornice stands this far back from the ramp's edge




BAST_P = T.STILE + 1 / 32           # a post's width


BAST_K = 1 / 32                     # how far the cornice stands out past the wall's line


BAST_C = 5 / 32                     # the corner chamfer's width along each axis, at the wall's line


BAST_CR = BAST_C                    # ... the shell's own corner cut behind the recess (the same chamfer, set back)


BAST_CS = BAST_C                    # ... and the ramp's: every chamfer on the corner spans the same screen columns


EPS = 0.002


class Recess(Feature):
    """The camera-facing faces set back by BAST_R: the cornice, posts and lower wall then stand at the wall's line and
    the face between them is cut in. The skirt, the face planes and the ends keep the wall's line (they read
    sp.rects); only the covered cells (the body and its cap) shrink, and an outer corner of the body is cut off at 45
    degrees (BAST_CR along each axis), so the recess turns the corner on a chamfer; the ramp and its lip turn the same
    corner on their own 45-degree face (BAST_CS). After FreeEnds (a free end is not recessed, nor chamfered)."""
    def setup(self, sp):
        R = BAST_L + bast_r()
        body = []
        corner = None
        ends = {sd for sd, _ in sp.end_sides}
        for r in sp.rects:
            (x0, x1, y0, y1), fam, t, top = r
            cx = not sp._adj(r, "+x") and x1 < 0.5 - 1e-9 and "+x" not in ends
            cy = not sp._adj(r, "+y") and y1 < 0.5 - 1e-9 and "+y" not in ends
            body.append(((x0, x1 - (R if cx else 0), y0, y1 - (R if cy else 0)), fam, t, top))
            if cx and cy:                               # a partition's outer corner or the far hull's end
                sp.line = (T.snap(x1), T.snap(y1))      # the wall's line at the corner
                sp.band, sp.clip = BAST_CS, BAST_C
                corner = (sp.line[0] - R, sp.line[1] - R)
        sp.body = body
        if corner and sp.keep is None:
            lim = corner[0] + corner[1] - BAST_CR + 1e-9
            sp.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
            sp.diag = True

    def _body_at(self, sp, x, y):
        """The body: the footprint less a band R deep behind every camera-facing face, so the recess runs along the
        faces, into an inner corner and round a junction alike (a point is body when the footprint also holds it
        moved R along +x, +y and both; a probe past a tile edge the footprint reaches, or past a free end, counts as
        held). The outer corner's chamfer is the keep predicate's."""
        r = sp._rect_at(x, y, 0.0)
        if r is None:
            return None
        R = BAST_L + bast_r()

        def held(px, py):
            px, py = min(px, 0.5 - 1e-6), min(py, 0.5 - 1e-6)
            for sd, pl in sp.end_sides:
                if sd == "+x" and px > pl:
                    px = pl - 1e-6
                if sd == "+y" and py > pl:
                    py = pl - 1e-6
            return sp._rect_at(px, py, 0.0) is not None
        return r if held(x + R, y) and held(x, y + R) and held(x + R, y + R) else None

    def cover(self, sp, i, j):
        cx, cy = (i + 0.5) / T.W.GN - 0.5, (j + 0.5) / T.W.GN - 0.5
        if not self._body_at(sp, cx, cy):
            return None
        return T.W.half_cell(sp.keep, i, j) if sp.keep else "f"

    def cell_top(self, sp, i, j):
        r = self._body_at(sp, (i + 0.5) / T.W.GN - 0.5, (j + 0.5) / T.W.GN - 0.5)
        return r[3] if r else None


class RecessTones(Feature):
    """The lip lit; the joints at the ramp's top the same on both faces (the default leaves the +x one black); the
    chamfer a plain plate (no plates are laid on it); the cut face in the wall's own tone."""
    def col_skirt(self, sp, i, j, kind, x, y):
        d, r, ch = sp._cdist(x, y)
        fam = "blue" if r[1] == "hull" else "wall"
        if d < 1e-9:
            return T.RAMPS[fam][0][4]
        R = T.RAMPS[fam][1 if kind == "x" else 0]
        if d >= sp.run - 1 / 32:
            return R[0]
        return R[1]

    def col_face(self, sp, face, x, y, z):
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        return T.RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0][2]

    def band(self, sp, fam):                            # (a solid ramp's chamfer: as col_skirt colours its cells)
        R = T.RAMPS[fam][0]
        return [(sp.run - 1 / 32, R[1]), (sp.run, R[T.style().toe_lvl or 0])]     # (its last cell the step's lip)


def _arm(ax, plane, u, top, i, side):
    """How far a face's cornice runs on past its end at u (side -1: its low end; i: its index in END_TOPS) over the
    arm of a lower wall that meets it there (a partition joining the far hull): the arm's width, else 0."""
    lo = T.END_TOPS[i]
    if lo is None or lo > top - 0.05:
        return 0.0
    e = 1e-3
    r = T.SHELL._rect_at(*((u + side * e, plane + e) if ax == "y" else (plane + e, u + side * e)), 0.0)
    if r is None:
        return 0.0
    x0, x1, y0, y1 = r[0]
    lo_, hi = (x0, x1) if ax == "y" else (y0, y1)
    return hi - u if side > 0 else u - lo_


def bastion(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        H = top - zs
        R, C, L, PW = bast_r(), BAST_C, BAST_L, BAST_P
        endf, end1, _, _ = _ends(ax, plane, b, ends)
        d0 = -(L + R) + EPS                             # the parts fill the cut from the recessed face out to the lip
        dl = -L                                         # (the cornice to the wall's line)
        out = full and ends[1] == "out" and not end1
        kb = BAST_K if end1 else 0.0                    # (the cornice runs on to meet the end face's)
        bb = b - C if out else b                        # the chamfer takes over at an outer corner, on a joint
        ina, inb = ends[0] == "in", ends[1] == "in"     # inner corners: no posts; the recess and its parts run on
        mt = (-1.0 if ina else 0.0, 1.0 if out else -1.0 if inb else 0.0)    # into the corner, mitred to meet the
                                                                              # other face's (straight at the camera)

        def band(u0, u1, z0, z1, lvl, cap=None, front=dl, m=(False, False)):
            prism(k, ax, plane, u0, u1, [(d0, z0), (front, z0), (front, z1), (d0, z1)], F, lvl, cap=cap, mitre=m)
        if endf:                                        # a wall's end face: not recessed; its section, and the
            _end_section(k, ax, plane, a, b, zs, top - 0.21 if full else top, F)    # cornice turned onto it
            if full:
                band(a, b + BAST_K, top - 0.21, top - 0.02, 3, front=BAST_K)
            return
        zlo = zs + (0.08 if full else 0.3)                                                       # the lower wall's top
        zlo = min(zlo, top - 0.02)
        band(a, bb, zs, zlo, 3, m=mt)                                                            # the lower wall
        if not full:
            band(a, bb, zlo, top, 3)
            return
        zsl = zlo + 0.12 * min(H, T.W.HF - zs)          # the slope's top (a partition's on the hull too, so the cut's
                                                        # parts line up where they meet)
        zc0 = top - 0.21
        ca, cb = _arm(ax, plane, a, top, 0, -1), _arm(ax, plane, b, top, 1, 1)   # (run on over a lower wall's arm)
        band(a - (BAST_K if ends[0] == "out" else 0.0) - ca, bb + kb + cb, zc0, top - 0.02, 3, front=BAST_K,
             m=(0.0 if ca else mt[0], 0.0 if cb else mt[1]))                                     # cornice
        cp = []                                         # (what fills the cut, for the corner to carry round)
        for s0, s1 in T.spans(a, b):
            ia, ib = ina and abs(s0 - a) < 1e-6, inb and abs(s1 - b) < 1e-6
            for lo, edge in ((True, s0), (False, s1)):           # the posts: the first shows its side too, so
                if not lo and out and abs(edge - b) < 1e-6:      # it is narrower by the depth, and the two read
                    continue                                     # the same width; none at a chamfered corner
                if (lo and ia) or (not lo and ib):
                    continue                                     # (nor an inner one)
                q0, q1 = (max(edge, a), edge + PW - R) if lo else (edge - PW, min(edge, bb))
                if q1 - q0 > 1e-6:
                    band(q0, q1, zlo, zc0, 3, cap="wD")                                          # (dark inner walls)
            corner = out and abs(s1 - b) < 1e-6
            f0 = s0 if ia else s0 + PW - R
            f1 = bb if corner or ib else min(s1 - PW, bb)
            if f1 - f0 < 0.1:
                continue
            m = (mt[0] if ia else 0.0, mt[1] if corner or ib else 0.0)
            if not T.fill("flat", False):                                                     # the slope into
                prism(k, ax, plane, f0, f1, [(d0 + EPS, zlo), (dl, zlo), (d0 + EPS, zsl)], F, 3,    # it (a design
                      mitre=m)                                                                   # may want it flat)
            cut = T.fill("cut", bastion_hood)                                                    # (its design's)
            cp = cut(k, ax, plane + d0, f0, f1, zlo, zsl, zc0, top, F, m, d0) or cp
        if out and ax == "y":                           # round the chamfer, once (the corner is the y face's end):
            X, Y = b, plane                             # the same parts, their backs sunk into the shell's cut corner
            db = -(L + R) - 0.03
            run_ = T.W.skirt_run()                      # the ramp's chamfer: a plate flush with the faces' plates,
            sl = Vector((1, 1, -2 * zs / run_))         # between the same top joint and foot (the chamfer's slope
            nrm = Vector((-1, 1, 0)).cross(sl).normalized()   # is gentler: it falls along both axes at once)
            if nrm.z < 0:
                nrm = -nrm

            def pt(u, dd, rise):
                return Vector((X - C + dd + u * C, Y + dd - u * C, zs * (1 - dd / run_))) + nrm * rise
            T.plate(k, [(0.0, 0.02), (1.0, 0.02), (1.0, run_ - 0.045), (0.0, run_ - 0.045)], pt, nrm, 0.0, PAINT,
                    F, 1)
            corner_piece(k, X, Y, C, [(db, zs), (dl, zs), (dl, zlo), (db, zlo)], F, 3)              # lower wall
            corner_piece(k, X, Y, C, [(db, zlo), (dl, zlo), (d0 + EPS, zsl), (db, zsl)], F, 3)      # the slope (its
            # face the faces' own, so its edges meet theirs; only its hidden back is sunk)
            corner_piece(k, X, Y, C, [(db, zc0), (BAST_K, zc0), (BAST_K, top - 0.02), (db, top - 0.02)], F, 3)
            for pr, lvl in cp:
                corner_piece(k, X, Y, C, [(db if abs(d - d0) < 1e-9 else d, z) for d, z in pr], F, lvl)
    return face


SLOPE_LIFT = {"fBW2": "fBW8", "fBH2": "fBH8"}     # the floor ramp's slope a step lighter (8: between 2 and 1) than
                                                # the step its role gives (2, what the open slot's insides keep)


class Bastion(Faction):
    pre = "fB"

    def paint(self, P):
        c = super().paint(P)
        if P.kind.startswith("slope") and P.z < W.skirt_top() + 0.01 and P.sprite.startswith("tile.wall."):
            return SLOPE_LIFT.get(c, c)
        return c

    def relief(self, sprite):
        return _style(bastion, skirt="outline", slot=True, seam=0, end_out=-BAST_L, chamfer=BAST_CS,
                      tops=BAST_TOPS, ramps=BAST_RAMPS, outline_lvl=1, outline_d=BAST_PANEL, ramp_solid=True,
                      foot=BAST_FOOT, toe_lvl=4, hole_tone=slot_tone,
                      shell=LookShell,
                      features=(FreeEnds(), RampHoles(), Recess(), FloorDrop(), FootTone("wall", 2), RecessTones()))
