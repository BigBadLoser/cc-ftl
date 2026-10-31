"""Bastion (set 8): slate armour; a heavy cornice, posts at each tile edge, the face between them cut in from a sloped
foot up to the cornice; slots cut into the ramp for machinery; its shell and its straight-run designs."""
from mathutils import Vector

from .. import wall3d as T
from .base import Faction, _style
from .parts import LINE, PAINT, body, corner_piece, prism
from .shell import Feature, FloorDrop, FreeEnds, LookShell, RampHoles, _end_section, _ends

BAST_L = 2 / 32                     # the lip: the wall below the cornice stands this far back from the ramp's edge


BAST_R = 2 / 32                     # how far the recess is cut in behind that (two of the shell's cells)


def bast_r():
    """The recess's depth behind the lip: BAST_R, more for a top variant that wants a deeper cut
    (BAST_DEEP)."""
    return BAST_R + BAST_DEEP.get(T.VARIANT[0], 0.0)


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
        return [(sp.run - 1 / 32, R[1]), (sp.run, R[0])]


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
            if T.VARIANT[0] not in BAST_FLAT:                                                 # the slope into
                prism(k, ax, plane, f0, f1, [(d0 + EPS, zlo), (dl, zlo), (d0 + EPS, zsl)], F, 3,    # it (a variant
                      mitre=m)                                                                   # may want it flat)
            cp = bastion_top(k, ax, plane + d0, f0, f1, zlo, zsl, zc0, top, F, T.VARIANT[0], m, d0) or cp
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


BAST_PAIRS = [(0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2), (3, 0), (3, 1), (3, 2)]   # set 8: 4 x 3


def _cells(k, ax, plane, u0, u1, z0, z1, d, nu, nz, cols):
    """A block of nu x nz lit cells over [u0, u1] x [z0, z1], a px apart, coloured cols[(i + j) % len(cols)]."""
    from ..wall3d_variants import lamp
    w, h = (u1 - u0) / nu, (z1 - z0) / nz
    for i in range(nu):
        for j in range(nz):
            lamp(k, ax, plane, u0 + i * w, u0 + (i + 1) * w - LINE, z0 + j * h, z0 + (j + 1) * h - 0.02, d,
                 cols[(i + j) % len(cols)])


def _frame(k, ax, plane, u0, u1, z0, z1, d, F, lvl, t=0.03):
    """A raised frame t wide round [u0, u1] x [z0, z1], standing d proud."""
    for q in ((u0 - t, u1 + t, z1, z1 + t), (u0 - t, u1 + t, z0 - t, z0), (u0 - t, u0, z0, z1), (u1, u1 + t, z0, z1)):
        T.slab(k, ax, plane, *q, d, F, lvl, ends=(True, True))


BAST_DEEP = {1: 4 / 32}             # top designs whose cut goes deeper, and by how much (bast_r)


BAST_FLAT = (2,)                    # ... and whose cut's floor is flat (at the lower wall's top) instead of angled


def bastion_top(k, ax, plane, f0, f1, zlo, z0, z1, top, F, t, m=(0.0, 0.0), back=0.0):
    """A bastion wall's cut (f0..f1 between its posts; plane its back, bast_r() in from the wall's line; its back
    face from z0 up to the cornice at z1, its floor the angled face down from it to the lower wall's top at zlo at
    the wall's line; flat at zlo for BAST_FLAT) for top design t (set 8), machinery slotted into it as into the
    ramp's slot (m: its ends' mitres, at a corner; back: plane's depth from the face's): 0 the base: a hood under the
    cornice, two slats across the back, panel seams, a vent and bolts under them (all but the hood set from the
    bottom, so they line up where a partition meets the taller hull) (returns the hood's and slats'
    profiles, face-relative, for the corner to carry round);
    1 (a deeper cut) its angled floor raised and flattened, controls on it, an LED readout on the back
    over them, a sloped face from the readout's top out to the cut's top edge, a red strip on the lower wall; 2 a
    piece of equipment from the floor to the wall's top (through the cornice, top) in two tiers: the lower standing
    out past the wall's line, a keypad and a small readout on it, sloping out from its top to the upper tier's foot,
    further out, two readouts on that;
    3 a module filling the cut, two ribs over a framed indicator panel."""
    from ..wall3d_variants import lamp
    R = bast_r()
    uc, w, H = (f0 + f1) / 2, f1 - f0, z1 - z0
    dl = 2 * PAINT                                      # (lamps stand on the glass)
    if t == 0:                                          # (on the face's own plane, so the mitres at a corner
        profs = [[(0.0, z1 - 0.13), (0.5 * R, z1 - 0.13), (R, z1 - 0.07), (R, z1), (0.0, z1)]]   # pull back to
        profs += [[(0.0, za), (0.7 * R, za), (0.7 * R, za + 0.07), (0.0, za + 0.1)]               # meet its chamfer)
                  for za in (z0 + 0.49, z0 + 0.33)]                                                  # the hood, slats
        profs = [[(d + back, z) for d, z in pr] for pr in profs]
        for pr in profs:
            prism(k, ax, plane - back, f0, f1, pr, F, 3, mitre=m)
        g0, g1 = z0 + 0.06, z0 + 0.25                                                                # under them:
        for u in (f0 + w / 3, f1 - w / 3):                                                           # panel seams,
            T.paint(k, ax, plane, u - LINE / 2, u + LINE / 2, g0, g1, 0.0, F, 2)
        T.paint(k, ax, plane, f0 + 0.03, f1 - 0.03, g1 - 0.026, g1, 0.0, F, 2)
        for i in range(3):                                                                           # a small vent
            zz = (g0 + g1) / 2 + 0.03 - i * 0.05
            T.paint(k, ax, plane, uc - 0.07, uc + 0.07, zz - 0.026, zz, 0.0, F, 1)
        for u in (f0 + 0.05, f1 - 0.05 - LINE):                                                      # and bolts
            for zz in (g0 + 0.04, g1 - 0.08):
                T.paint(k, ax, plane, u, u + LINE, zz, zz + 0.026, PAINT, F, 4)
        return [(pr, 3) for pr in profs]
    elif t == 1:
        T.paint(k, ax, plane, f0, f1, zlo, z1, 0.0, F, 1)                                          # (a dark cut)
        zf = zlo + 0.1                                  # the angled floor, raised: zf at the wall's line, rising
        zb = zf + 0.55 * R                              # gently to the back
        prism(k, ax, plane, f0, f1, [(0.0, zlo), (R, zlo), (R, zf), (0.0, zb)], F, 3)
        a, b, q0, q1 = uc - 0.36 * w, uc + 0.36 * w, zb + 0.05, zb + 0.35
        T.paint(k, ax, plane, a - LINE, b + LINE, q0, q1, 0.0, F, 0)                                 # the readout
        nd = min(5, int((b - a - 0.04 + 2 * LINE) / (5 * LINE)))                                   # digits: each an
        u0 = T.snap(uc - (5 * nd - 2) * LINE / 2)       # outline 3 px wide, 2 px apart, on the px grid (read as 0s)
        for i in range(nd):
            u, v = u0 + 5 * i * LINE, u0 + (5 * i + 3) * LINE
            for q in ((u, v, q0 + 0.03, q0 + 0.056), (u, v, q1 - 0.056, q1 - 0.03), (u, u + LINE, q0 + 0.03, q1 - 0.03),
                      (v - LINE, v, q0 + 0.03, q1 - 0.03)):
                lamp(k, ax, plane, *q, dl, "emR")                                     # (dim: a glow fills the gaps)
        zr = q1 + 0.04                                  # over it, a face sloping out to the cut's top edge from a
        prism(k, ax, plane, f0, f1, [(0.0, zr), (1 / 32, zr), (R, z1), (0.0, z1)], F, 3)            # px lip
        o, up = T.OUT(ax), Vector((0, 0, 1))
        n = (o * (zb - zf) + up * R).normalized()

        def key(u0, u1, g0, g1, col):                   # (on the angled floor; g: the way out it, 0 at its back)
            Q = lambda u, g: T.P(ax, plane, u, zb + g * (zf - zb), g * R) + n * PAINT            # noqa: E731
            k.poly([Q(u0, g0), Q(u1, g0), Q(u1, g1), Q(u0, g1)], F, 0, n, fixed=col)
        for u0, col in ((a, "flameY"), (a + 0.04, "red"), (b - 0.075, "flameY"), (b - 0.035, "red")):
            key(u0, u0 + 0.035, 0.3, 0.7, col)
        key(uc - 0.08, uc + 0.08, 0.2, 0.8, "green")
        lamp(k, ax, plane, uc - 0.22 * w, uc + 0.22 * w, zlo - 0.055, zlo - 0.03, R, "emR")          # the strip
    elif t == 2:
        A, B = R + 3.5 / 32, R + 7.5 / 32               # the tiers' fronts (past the wall's line by 3.5 and 7.5 px)
        z1 = top - 0.02                                 # (up to the cornice's top: it hides the cornice there)
        H2 = z1 - zlo
        zt, zu = zlo + 0.5 * H2, zlo + 0.5 * H2 + (B - A)                                            # tier 1's top,
        prism(k, ax, plane, f0, f1, [(0.0, zlo), (A, zlo), (A, zt), (0.0, zt)], F, 2)               # tier 2's foot
        prism(k, ax, plane, f0, f1, [(0.0, zt), (A, zt), (B, zu), (B, z1), (0.0, z1)], F, 2)
        fp = plane + A                                  # tier 1: a keypad and a small readout
        r0, r1 = zt - 0.36, zt - 0.08                    # (high on it, where hands reach)
        a, b = uc - 0.36 * w, uc + 0.36 * w
        _frame(k, ax, fp, a, uc - 0.03, r0, r1, 0.025, F, 3)
        T.paint(k, ax, fp, a, uc - 0.03, r0, r1, 0.0, F, 0)
        _cells(k, ax, fp, a + 0.02, uc - 0.05, r0 + 0.02, r1 - 0.02, dl, 3, 4, ("alG",))
        _frame(k, ax, fp, uc + 0.05, b, r0, r1, 0.025, F, 3)
        T.paint(k, ax, fp, uc + 0.05, b, r0, r1, 0.0, F, 0)
        _cells(k, ax, fp, uc + 0.07, b - 0.02, r0 + 0.02, r1 - 0.02, dl, 1, 3, ("green", "flameY"))
        fp = plane + B                                  # tier 2: an indicator readout and a green screen
        q0, q1 = zu + 0.06, z1 - 0.08
        _frame(k, ax, fp, a, a + 0.14, q0, q1, 0.025, F, 3)
        T.paint(k, ax, fp, a, a + 0.14, q0, q1, 0.0, F, 0)
        _cells(k, ax, fp, a + 0.02, a + 0.12, q0 + 0.03, q1 - 0.03, dl, 2, 4, ("flameY", "red"))
        _frame(k, ax, fp, a + 0.19, b, q0, q1, 0.025, F, 3)
        lamp(k, ax, fp, a + 0.19, b, q0, q1, PAINT, "green")
    elif t == 3:
        prism(k, ax, plane, f0, f1, [(0.0, z0), (R, z0), (R, z1), (0.0, z1)], F, 2)                  # the module
        fp = plane + R
        q0, q1 = z0 + 0.3 * H, z0 + 0.72 * H
        for zz in (q1 + 0.08, q1 + 0.17):                                                            # its ribs
            T.slab(k, ax, fp, f0, f1, zz, zz + 0.05, 0.03, F, 3, ends=(False, False))
        a, b, c, e = uc - 0.36 * w, uc + 0.36 * w, q0 + 0.06, q1 - 0.06
        _frame(k, ax, fp, a, b, c, e, 0.025, F, 3)
        T.paint(k, ax, fp, a, b, c, e, 0.0, F, 0)
        _cells(k, ax, fp, a + 0.02, a + 0.12, c + 0.03, e - 0.03, dl, 2, 3, ("flameY", "red"))      # lit block
        for i, col in enumerate(("red", "flameY", "red", "flameY")):                                  # small lights
            u = a + 0.17 + i * 0.07
            lamp(k, ax, fp, u, u + 2 * LINE, e - 0.09, e - 0.04, dl, col)
        lamp(k, ax, fp, a + 0.19, a + 0.33, c + 0.04, c + 0.1, dl, "green")                           # buttons
        lamp(k, ax, fp, a + 0.36, b - 0.03, c + 0.03, c + 0.11, dl, "red")


BAST_SLOT = (0.15, 0.12)            # the ramp's slot: its back (a fraction of the run down it), its floor's height


def bastion_hole(r):
    """Where a bastion ramp is open (B1-2, B1-3): over its slot, from the slot's back to where its floor meets the
    slope; set in from the stretch's sides as the outlined panel (the cover the base design keeps on it)."""
    if r not in (1, 2):
        return None
    return (BAST_SLOT[0], 1.0 - BAST_SLOT[1] / T.W.skirt_top(), -0.08)


def bastion_ramp(plate, u0, u1, run_, r, k=None, pt=None, P=None, zs=0.0, hole=None, fam="wall", ax=0, plane=0.0,
                 **_):
    """A bastion ramp's design r (set 8): the ramp has a slot cut into it for machinery, its floor level, its back
    upright (parallel to the wall); the base design covers it with the outlined panel. 1 (B1-2): the slot open;
    2 (B1-3): a box of machinery slotted into it (as deep as its floor, as tall as its back), a screen on its upright
    front. P(u, z, d) is a point d out from the wall."""
    if not hole:
        return
    from ..wall3d_variants import lamp
    o0, o1, d0, d1 = hole
    zat = lambda d: zs * (1 - d / run_)                # noqa: E731   the slope's height d out
    zb = BAST_SLOT[1]
    up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    k.poly([P(o0, zb, d0), P(o1, zb, d0), P(o1, zb, d1), P(o0, zb, d1)], fam, 2, up)                 # its floor,
    k.poly([P(o0, zb, d0), P(o1, zb, d0), P(o1, zat(d0), d0), P(o0, zat(d0), d0)], fam, 1, out_)     # back
    for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
        k.poly([P(u, zb, d0), P(u, zat(d0), d0), P(u, zb, d1)], fam, 1, along * sg)
    if r == 2:
        df, zt = d1, zat(d0)                            # the box: the slot's floor deep, its back's height
        a, b = o0 + 0.02, o1 - 0.02
        prism(k, ax, plane, a, b, [(d0, zb), (df, zb), (df, zt), (d0, zt)], fam, 3)
        c, e = zb + 0.03, zt - 0.03                                                                  # its screen
        T.slab(k, ax, plane + df, a + 0.03, b - 0.03, c, e, PAINT, fam, 0)
        fp, dl = plane + df, 2 * PAINT
        h = (e - c - 0.04) / 3
        for i in range(2):                                                                           # a lit block
            for j in range(3):
                q = c + 0.02 + j * h
                lamp(k, ax, fp, a + 0.06 + i * 0.05, a + 0.06 + (i + 1) * 0.05 - LINE, q, q + h - 0.015, dl,
                     "flameY" if (i + j) % 2 else "red")
        for i, col in enumerate(("red", "flameY", "red", "flameY")):                                 # small lights
            u = a + 0.2 + i * 0.07
            lamp(k, ax, fp, u, u + 2 * LINE, e - 0.06, e - 0.03, dl, col)
        lamp(k, ax, fp, a + 0.2, a + 0.33, c + 0.03, c + 0.08, dl, "green")                          # buttons
        lamp(k, ax, fp, a + 0.36, a + 0.45, c + 0.03, c + 0.1, dl, "red")
        lamp(k, ax, fp, a + 0.47, a + 0.51, c + 0.03, c + 0.08, dl, "blueN")


class Bastion(Faction):
    pre = "fB"

    def relief(self, sprite):
        return _style(bastion, skirt="outline", slot=True, seam=0, end_out=-BAST_L, chamfer=BAST_CS,
                      ramp_var=bastion_ramp, ramp_hole=bastion_hole, outline_lvl=1, ramp_solid=True,
                      hole_tone=lambda part, fam, ax, n: T.tone(fam, 1, n, ax), shell=LookShell,
                      features=(FreeEnds(), RampHoles(), Recess(), FloorDrop(), RecessTones()))

    pairs = BAST_PAIRS
