"""Hull ghosts: the low hull silhouette that never hides the interior (after Space Haven's shortest cutaway).

A ghost is a full-tile, near-black rim just above the deck (walls.ZG) with a fine lit, toothed line on its outer edge and
a thin line on its inner edge. On the camera-facing outer sides (o bit 1: space at +y, bit 2: at +x) the ship's
below-deck belly hangs from the rim: dark blue-teal panelled armour with rails and vents (muted ochre bands on the
variant), straight down for DROP - CURVE and then curving back under the ship. The outer corner (o = 3) is cut at 45
degrees across the tile and that face looks straight at the camera; the side corners (SW: o 1 without a W neighbour,
NE: o 2 without an N neighbour) are cut at 45 degrees in plan; o = 4 is the concave corner of a step.

Near-hull ghosts (o > 0) are drawn in every view level. In the shortest level the far hull is a ghost too (o = 0: the
rim alone, with a small lit face toward the room)."""
import math

from . import core
from . import wallart as A
from .walls import BEV, CURVE, DROP, DZ, GN, ZG, Spec, emit, half_cell

C = 1 / GN
ZB = DROP - CURVE          # straight part of the belly below the deck
STEPS = 4                  # belly curve segments


class Out(Spec):
    def __init__(self, mask, o, variant=0):
        self.mask, self.o, self.variant = mask, o, variant if o in (1, 2) else 0
        self.drop_y = bool(o & 1) and o != 4
        self.drop_x = bool(o & 2) and o != 4
        self.open_y = self.drop_y or not mask & 4
        self.open_x = self.drop_x or not mask & 2
        self.drop_z = ZB
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
        """Distance from the outer (camera-facing) edge; large for the far-hull ghost."""
        if self.o == 3:
            return -(x + y)
        if self.o == 4:
            return max(0.5 - x, 0.5 - y)                               # concave corner: only the corner square dips
        if self.o == 0:
            return 9.0
        return 0.5 - y if self.o & 1 else 0.5 - x

    def topz(self, x, y):
        return ZG - max(0.0, BEV - self.dist(x, y))

    def _s(self, x, y):
        if self.o in (3, 4):
            return (x - y + 1) / 2
        return x + 0.5 if self.o & 1 else 0.5 - y

    def _edge(self, x, y):
        """Distance to the nearest unconnected tile edge (the rim's outline)."""
        m, d = self.mask, [9.0]
        if not m & 1:
            d.append(y + 0.5)
        if not m & 8:
            d.append(x + 0.5)
        if not m & 4:
            d.append(0.5 - y)
        if not m & 2:
            d.append(0.5 - x)
        if self.o == 3:
            d.append(-(x + y) / math.sqrt(2))
        return min(d)

    def col_top(self, i, j, kind, x, y):
        s = self._s(x, y)
        if kind != "flat":
            return A.ghost_top("bevel", s, 0.0)
        if self.o and self.dist(x, y) - BEV < C:
            return A.ghost_top("crest", s, 0.0)
        return A.ghost_top("flat", s, self._edge(x, y))

    def col_face(self, face, x, y, z):
        if face == "d":
            s = (x - y + 1) / 2
        else:
            s = x + 0.5 if face == "y" else 0.5 - y
        if z > 0.0 and not self.o:
            return A.ghost_top("lip" if z > ZG - 0.03 else "side", s, 0.0)
        f = (self.foot - z) / (self.foot + ZB)
        return A.hull_out_face(face, s, min(max(f, 0.0), 1.0), self.variant)

    def belly(self, m, face, a, b):
        _belly(m, face, a, b, lambda k, s: A.hull_belly(face, s, k, STEPS, self.variant))


def _belly(m, face, a, b, col):
    """Curve the belly back under the ship below the edge a -> b (screen left to right)."""
    n = {"y": (0.0, 1.0), "x": (1.0, 0.0), "d": (math.sqrt(0.5), math.sqrt(0.5))}[face]
    if face == "y":
        s = (a[0] + b[0]) / 2 + 0.5
    elif face == "x":
        s = 0.5 - (a[1] + b[1]) / 2
    else:
        s = ((a[0] + b[0]) - (a[1] + b[1])) / 4 + 0.5
    prof = [(CURVE * (1 - math.cos(th)), -ZB - CURVE * math.sin(th))
            for th in (k * math.pi / 2 / STEPS for k in range(STEPS + 1))]
    for k in range(STEPS):
        (i0, z0), (i1, z1) = prof[k], prof[k + 1]
        pa0 = (a[0] - n[0] * i0, a[1] - n[1] * i0)
        pb0 = (b[0] - n[0] * i0, b[1] - n[1] * i0)
        pa1 = (a[0] - n[0] * i1, a[1] - n[1] * i1)
        pb1 = (b[0] - n[0] * i1, b[1] - n[1] * i1)
        m.poly([core.G(*pa1, z1), core.G(*pb1, z1), core.G(*pb0, z0), core.G(*pa0, z0)], col(k, s))


def out_block(mask, o, variant=0):
    m = core.Mesh(f"hull_ghost{o}_{mask}_{variant}", flat=True)
    emit(m, Out(mask, o, variant))
    return [m.build()]


def drop(side):
    """The belly alone (for a door set into the near hull): side s along x at +y, e along y at +x."""
    m = core.Mesh(f"hull_drop_{side}", flat=True)
    rows = int(round(ZB / DZ))
    face = "y" if side == "s" else "x"
    for c in range(GN):
        s0, s1 = c / GN, (c + 1) / GN
        if side == "s":
            a, b = (s0 - 0.5, 0.5), (s1 - 0.5, 0.5)
        else:
            a, b = (0.5, 0.5 - s0), (0.5, 0.5 - s1)
        for k in range(rows):
            z0, z1 = -ZB * (k + 1) / rows, -ZB * k / rows
            f = (ZG - BEV - (z0 + z1) / 2) / (ZG - BEV + ZB)
            col = A.hull_out_face(face, (s0 + s1) / 2, f, 0)
            m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z1), core.G(*a, z1)], col)
        _belly(m, face, a, b, lambda k, s: A.hull_belly(face, s, k, STEPS, 0))
    return [m.build()]
