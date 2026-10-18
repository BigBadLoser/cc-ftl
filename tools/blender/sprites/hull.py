"""Near hull: hull tiles whose +y (o bit 1) or +x (o bit 2) neighbour is space, the side the camera sees from outside.

Drawn as a GHOST in every view mode (as on main), so it never hides the interior: a low full-tile armoured footing (top
walls.ZG) whose top is a dark cut with a narrow lit 45 degree chamfer along the outer edge(s); its outer face continues
DROP below the deck (the deck edge) in the hull's blue-grey / ochre plating (wallart.hull_out_face). On the crest
stands a short translucent glass pane (`glass`). The outer corner (o = 3) is cut at 45 degrees across the tile and that
face looks straight at the camera; the side corners (SW: o 1 without a W neighbour, NE: o 2 without an N neighbour) are
cut at 45 degrees in plan."""
from . import core
from . import wallart as A
from .walls import BEV, DROP, DZ, GN, TW, ZG, Spec, emit, half_cell


class Out(Spec):
    def __init__(self, mask, o, variant=0):
        self.mask, self.o, self.variant = mask, o, variant if o < 3 else 0
        self.open_y = self.drop_y = bool(o & 1)
        self.open_x = self.drop_x = bool(o & 2)
        self.open_y = self.open_y or not mask & 4
        self.open_x = self.open_x or not mask & 2
        self.diag = o == 3
        keeps = []
        if o == 3:
            keeps.append(lambda ci, cj: ci + cj <= GN)                 # outer corner: x + y <= 0
        if o == 1 and not mask & 8:
            keeps.append(lambda ci, cj: cj <= ci)                      # SW side corner
        if o == 2 and not mask & 1:
            keeps.append(lambda ci, cj: ci <= cj)                      # NE side corner
        self.keep = lambda ci, cj: all(k(ci, cj) for k in keeps)
        self.foot = ZG - BEV

    def cover(self, i, j):
        return half_cell(self.keep, i, j)

    def dist(self, x, y):
        """Distance from the outer edge (the mitre with the neighbours' bevels is exact for the corner)."""
        if self.o == 3:
            return -(x + y)
        if self.o == 4:
            return max(0.5 - x, 0.5 - y)                               # concave corner: only the corner square dips
        return 0.5 - y if self.o & 1 else 0.5 - x

    def topz(self, x, y):
        return ZG - max(0.0, BEV - self.dist(x, y))

    def _s(self, x, y):
        if self.o in (3, 4):
            return (x - y + 1) / 2
        return x + 0.5 if self.o & 1 else 0.5 - y

    def col_top(self, i, j, kind, x, y):
        s = self._s(x, y)
        if kind != "flat":
            return A.hull_out_top("bevel", s, 0.0, self.variant)
        rim = ((self.o == 1 and j == 0 and not (self.mask & 1 and i < TW * GN))
               or (self.o == 2 and i == 0 and not (self.mask & 8 and j < TW * GN))
               or (self.o >= 3 and i + j <= 1))
        if rim:
            return A.ramp(A._blk(s, self.variant), "y")["K"]
        return A.hull_out_top("flat", s, self.dist(x, y) - BEV, self.variant, 1 - BEV)

    def col_face(self, face, x, y, z):
        f = (self.foot - z) / (self.foot + DROP)
        if face == "d":
            s = (x - y + 1) / 2
        else:
            s = x + 0.5 if face == "y" else 0.5 - y
        return A.hull_out_face(face, s, min(max(f, 0.0), 1.0), self.variant)


def out_block(mask, o, variant=0):
    m = core.Mesh(f"hull_out{o}_{mask}_{variant}", flat=True)
    emit(m, Out(mask, o, variant))
    return [m.build()]


def drop(side):
    """The below-deck band alone (for a door set into the near hull): side s along x at +y, e along y at +x."""
    m = core.Mesh(f"hull_drop_{side}", flat=True)
    foot = ZG - BEV
    rows = int(round(DROP / DZ))
    for c in range(GN):
        s0, s1 = c / GN, (c + 1) / GN
        for k in range(rows):
            z0, z1 = -DROP + DROP * k / rows, -DROP + DROP * (k + 1) / rows
            f = (foot - (z0 + z1) / 2) / (foot + DROP)
            col = A.hull_out_face("y" if side == "s" else "x", (s0 + s1) / 2, f, 0)
            if side == "s":
                a, b = (s0 - 0.5, 0.5), (s1 - 0.5, 0.5)
            else:
                a, b = (0.5, 0.5 - s0), (0.5, 0.5 - s1)
            m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z1), core.G(*a, z1)], col)
    return [m.build()]


GH = 0.8           # glass pane top (short: the ghost never hides the interior)
GT = 3 / 32        # glass pane thickness


def glass(mask, o):
    """The ghost's glass: an empty plate plus a translucent pane standing on the footing's chamfer crest, with a light
    frame rail on top (env_build renders the glass in its own pass, its brightness becomes alpha)."""
    plate = core.Mesh(f"glass_plate_{o}_{mask}", flat=True)
    gm = core.Mesh(f"glass_{o}_{mask}", flat=True)
    sp = Out(mask, o)
    inset = BEV + 1 / GN

    def inside(cx, cy):
        return sp.cover(int((cx + 0.5) * GN), int((cy + 0.5) * GN)) and BEV < sp.dist(cx, cy) < inset + GT

    nz = int(round((GH - ZG) / DZ))
    for j in range(GN):
        for i in range(GN):
            cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
            if not inside(cx, cy):
                continue
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            gm.poly([core.G(x0, y0, GH), core.G(x1, y0, GH), core.G(x1, y1, GH), core.G(x0, y1, GH)], "plate")
            for face, a, b, nb in (("y", (x0, y1), (x1, y1), (cx, cy + 1 / GN)),
                                   ("x", (x1, y1), (x1, y0), (cx + 1 / GN, cy))):
                if inside(*nb):
                    continue
                for k in range(nz):
                    za, zb = ZG + (GH - ZG) * k / nz, ZG + (GH - ZG) * (k + 1) / nz
                    col = "plate" if k >= nz - 2 else ("steelL" if (k + i + j) % 9 == 0 else "steel")
                    gm.poly([core.G(*a, za), core.G(*b, za), core.G(*b, zb), core.G(*a, zb)], col)
    plate.poly([core.G(0, 0, 0), core.G(0.001, 0, 0), core.G(0, 0.001, 0)], "dark")   # sub-pixel: renders nothing
    return [plate.build(), gm.build()]
