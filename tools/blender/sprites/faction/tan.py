"""Tan (set 3, a working name): tan panelling. A lit header block under the cap; under it louvred slats either side of
a raised centre panel; a lip at the face's foot over a dark line and a blue one; the ramp pale tan cushions in
brown joints over a blue toe."""
from .. import wall3d as T
from ..relief_style import Design
from .base import Faction, _style
from .parts import LINE, PAINT, PX, PZ, body, flat, prism
from .shell import FaceHoles, Feature, FloorDrop, FootTone, FreeEnds, LookShell, RampHoles, _end_section, _ends

FACE = "rose"                       # the face's family (its second tone: the wall family is the ramp's pale tan)
BLUE = "ochre"                      # the trim's: the line at the face's foot, the toe
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
    """A face tone on an x (shade) face: a step darker."""
    return SHADES[min(len(SHADES) - 1, SHADES.index(name) + 1)] if ax == "x" else name


class TanTones(Feature):
    """The shell's faces in the face's tan (the second tone), a free end's in the slate blue; the dark outlines at
    the foot and under the top stay."""
    def col_face(self, sp, face, x, y, z):
        if sp.end_face(face, x if face == "x" else y):
            return END[face]
        c = T.Shell.col_face(sp, face, x, y, z)
        e = 0.5 / T.W.GN
        r = sp._rect_at(x, y - e) if face == "y" else sp._rect_at(x - e, y)
        top = r[3] if r else sp.top
        if z < sp.zs + 0.02 or z > top - 0.03:
            return c
        return T.RAMPS[FACE][1 if face == "x" else 0][3]

    def end_tone(self, sp, fam, ox):                    # (the ramps' caps at a free end: its section's)
        return END[ox]


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


def tan(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, corner, back = _ends(ax, plane, b, ends)
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

        # the foot: the lip (its front's last px dark; the ramp's first row is the blue line under it)
        zl0, zl1 = zs, zs + LIP_TOP
        prism(k, ax, plane, a, b, [(0.0, zl0), (LIP_D, zl0), (LIP_D, zl1), (0.0, zl1)], FACE, 3,
              cols=[False, None, sd("fTS1", ax), False], mitre=mit)
        band(a, b, zl0, zl0 + PZ, "fTS4", LIP_D)
        if not full:
            return
        # the header block: its pale top, a lit edge on its front, a shadow 2 px under it
        zh0 = z1 - HEAD_H
        prism(k, ax, plane, a, b, [(0.0, zh0), (HEAD_D, zh0), (HEAD_D, z1), (0.0, z1)], FACE, 3,
              cols=[False, None, sd("fTS0", ax), False], mitre=mit)
        band(a, b, z1 - PZ, z1, "fTS1", HEAD_D)
        zs0 = zh0 - _hid(HEAD_D)                        # (the face's first row seen under the header)
        band(a, b, zs0 - 3 * PZ, zs0, "fTS7")
        band(a, b, zs0 - 2 * PZ, zs0, "fTS4")
        zt = zs0 - 6.5 * PZ                             # (3 px of face, then the slats and the panel; the half px
                                                        # lands the 1 px lines on whole rows: clean 2:1 steps)
        for u0, u1, mid, gs in _panels(a, b):
            if not mid:                                 # either side of the panel: slats up from the lip, each a
                z = zl1                                 # dark seam over a lit line (the first seam on the lip, its
                while z + PZ <= zt + 1e-6:              # lit line under it hidden), 2 px of face between
                    band(u0, u1, z, z + PZ, "fTS4")
                    band(u0, u1, z - PZ, z, "fTS1")
                    z += SLAT
                for g in gs:                            # a groove up each tile's edge to the header
                    if u0 - 1e-6 <= g[0] and g[1] <= u1 + 1e-6:
                        band(g[0], g[1], zl1, zs0, "fTS4", PAINT)   # (over the bands across it)
                continue
            zp0, zp1 = zl1 + PZ, zt - PZ                # the centre panel, flush: a groove round it, a 2 px bevel lit
            band(u0, u1, zp1, zt, "fTS4")               # along its top, a soft shadow along its foot
            band(u0, u1, zp1 - 2 * PZ, zp1, "fTS2")
            band(u0, u1, zp0 + PZ, zp0 + 3 * PZ, "fTS8")
            band(u0, u1, zp0 + PZ, zp0 + 2 * PZ, "fTS7")
            band(u0, u1, zl1, zp0 + PZ, "fTS4")
            for g in gs:                                # (its side grooves on up to the header)
                if u0 - 1e-6 <= g[0] and g[1] <= u1 + 1e-6:
                    band(g[0], g[1], zl1, zs0, "fTS4", PAINT)   # (over the bands across it)
    return face


EDGE = 0.4 / 32                                 # (a px down the slope, about: 2.5 a cell)


# the base ramp's cushions (padding, not plates), symmetric about the tile's middle: (u0, u1, d0, d1) as fractions
# of the tile and of the cushions' run (the joints, a px, centred on the cuts): one down each side, two squares
# against the wall between them over one wide one
CUT_U, CUT_D = (0.25, 0.5, 0.75), 0.55
PLATES = ((0.0, 0.25, 0.0, 1.0), (0.25, 0.5, 0.0, CUT_D), (0.5, 0.75, 0.0, CUT_D), (0.75, 1.0, 0.0, 1.0),
          (0.25, 0.75, CUT_D, 1.0))


def tan_plate(plate, u0, u1, run_, k=None, pt=None, **_):
    """The base ramp: a blue line along the wall, then pale cushions in brown joints, each lit along its top and left
    edges and shaded along its foot and right edge, then the blue toe."""
    w, E, L = u1 - u0, EDGE, LINE
    top, end = 0.02 + E, run_ - 0.045                   # (under the blue line; the cushions' end, over the toe)
    nrm = (pt(0.0, 0.0, 1.0) - pt(0.0, 0.0, 0.0)).normalized()

    def q(ua, ub, da, db):
        return [(ua, da), (ub, da), (ub, db), (ua, db)]
    plate(q(u0, u1, 0.0, top), PAINT, 2, 0.0, BLUE)                         # the blue line under the lip
    plate(q(u0, u1, end, run_ - 1 / 32), PAINT, 2, 0.0, BLUE)               # the toe band, on to the toe
    T.plate(k, q(u0, u1, top, end), pt, nrm, 0.0, PAINT, FACE, 0, fixed="fTS7")   # the joints (under the cushions)
    span = end - E - top
    for f0, f1, g0, g1 in PLATES:                       # (a joint at the tile's left edge, none at the wall)
        pu0 = u0 + f0 * w + (L if f0 == 0.0 else L / 2)
        pu1 = u0 + f1 * w - (0.0 if f1 == 1.0 else L / 2)
        pd0 = top + g0 * span + (0.0 if g0 == 0.0 else E / 2)
        pd1 = top + g1 * span - (0.0 if g1 == 1.0 else E / 2)
        plate(q(pu0, pu1, pd0, pd1), 2 * PAINT, 2, PAINT, "wall")
        r = 3 * PAINT
        plate(q(pu0, pu1, pd1 - E, pd1), r, 2, 2 * PAINT, FACE)              # (its foot and right edge shaded,
        plate(q(pu1 - L, pu1, pd0, pd1), r, 2, 2 * PAINT, FACE)              # its top and left edge lit)
        plate(q(pu0 + L, pu1 - L, pd0, pd0 + E), r, 5, 2 * PAINT, "wall")
        plate(q(pu0, pu0 + L, pd0 + E, pd1 - E), r, 5, 2 * PAINT, "wall")


TAN_RAMPS = (Design("cushions", ramp=tan_plate),)


class Tan(Faction):
    pre = "fT"

    def relief(self, sprite):
        return _style(tan, skirt=None, seam=0, ramp_solid=True, shell=LookShell,
                      toe_lvl={"wall": "fTT2", "blue": "fTT2"}, ramps=TAN_RAMPS,     # (the toe blue, its foot
                      features=(FreeEnds(), RampHoles(), FloorDrop(), FootTone(BLUE, 2), FaceHoles(),  # darker)
                                TanTones()))
