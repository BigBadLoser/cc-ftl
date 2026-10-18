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
STEPS = 4                  # belly curve segments (the first is a lit chamfer that catches the light)
CH = 0.07                  # that chamfer's size
STEP_DEPTH = (0.0, 0.12, 0.2, 0.05)   # extra depth per quarter tile: a broken lower silhouette


RUNG = 0.22               # rear ghost: its slope toward the room (13.webp: a 19-22 px band at 55 deg)
ZGR = 0.31                # ... and its crest height


class Out(Spec):
    def __init__(self, mask, o, variant=0, part=None, room=0):
        """room (rear ghost only): unconnected N (1) / W (8) sides that face a room instead of space."""
        self.mask, self.o, self.variant, self.part, self.room = mask, o, variant if o in (1, 2) else 0, part, room
        self._lines = None
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

    def _inner(self, x, y):
        """Rear ghost: L-inf distance to the room side (unconnected S / E edges, room-facing N / W edges, and the
        diagonal room cell of a concave corner), where its slope runs down to the floor."""
        m, d = self.mask, [9.0]
        if not m & 4:
            d.append(0.5 - y)
        if not m & 2:
            d.append(0.5 - x)
        if self.room & 1:
            d.append(y + 0.5)
        if self.room & 8:
            d.append(x + 0.5)
        if m & 6 == 6:
            d.append(max(0.5 - x, 0.5 - y))
        return min(d)

    def topz(self, x, y):
        if not self.o:
            return ZGR * min(1.0, max(0.0, self._inner(x, y)) / RUNG)
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

    def _kind(self, i, j):
        """Orientation of a top cell from its corner heights: flat, y, x or h (mixed)."""
        x0, y0 = i / GN - 0.5, j / GN - 0.5
        z = [self.topz(x0, y0), self.topz(x0 + C, y0), self.topz(x0 + C, y0 + C), self.topz(x0, y0 + C)]
        gx, gy = (z[1] + z[2] - z[0] - z[3]) / 2, (z[2] + z[3] - z[0] - z[1]) / 2
        e = 1e-6
        if abs(gx) < e and abs(gy) < e:
            return "flat"
        return "y" if abs(gx) < e else ("x" if abs(gy) < e else "h")

    def _line(self, i, j):
        """Ghost edge lines: 2 = crest (flat meets slope), 1 = the rear slope's toe and its seam at every tile (each tile
        draws only its left seam, so no seam is drawn twice) and the front rim's unconnected edges, 0 = no line.
        Slope-to-slope mitres are not lined: at a concave corner the two adjacent seams already meet there. One-sided, so every edge is a single 1 px line. The
        rear ghost's flat part behind its crest stays unlined (13.webp shows only the sloped band)."""
        if self._lines is None:
            K = [[self._kind(a, b) if self.cover(a, b) else None for b in range(GN)] for a in range(GN)]
            L = [[0] * GN for _ in range(GN)]
            for a in range(GN):
                for b in range(GN):
                    k = K[a][b]
                    if k is None:
                        continue
                    x, y = (a + 0.5) / GN - 0.5, (b + 0.5) / GN - 0.5
                    v = 0
                    for da, db in ((1, 0), (0, 1)):
                        n = K[a + da][b + db] if a + da < GN and b + db < GN else k
                        if n is not None and n != k and "flat" in (k, n):
                            v = max(v, 2)                              # crest; slope-to-slope mitres stay unlined
                    if self.o and self._edge(x, y) < C and not self.dist(x, y) < BEV:
                        v = max(v, 1)                                  # outline (the outer side has the crest)
                    if not self.o and k in ("x", "y") and (a == 0 if k == "y" else b == 0):
                        v = max(v, 1)                                  # rear slope: a fall line at every tile seam
                    if self.o and self.dist(x, y) - BEV < C and k == "flat":
                        v = 2                                          # the front rim's outer crest
                    if not self.o and k != "flat" and self._inner(x, y) < C:
                        v = max(v, 1)                                  # the rear slope's toe
                    L[a][b] = v
            self._lines = L
        return self._lines[i][j]

    def col_top(self, i, j, kind, x, y):
        return A.ghost_line(self._line(i, j))

    def _fs(self, face, x, y):
        if face == "d":
            return (x - y + 1) / 2
        return x + 0.5 if face == "y" else 0.5 - y

    def drop_at(self, x, y):
        s = self._fs("d" if self.o == 3 else ("y" if self.o & 1 else "x"), x, y)
        if self.o == 3:
            s = (s * 2) % 1.0
        return ZB + STEP_DEPTH[min(3, int(s * 4))]

    def col_face(self, face, x, y, z):
        s = self._fs(face, x, y)
        if z > -1e-6:
            return A.ghost_line(0)                                     # the rim's faces are see-through
        f = (self.foot - z) / (self.foot + self.drop_at(x, y))
        return A.hull_out_face(face, s, min(max(f, 0.0), 1.0), self.variant)

    def belly(self, m, face, a, b):
        d = self.drop_at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        _belly(m, face, a, b, d, lambda k, s: A.hull_belly(face, s, k, STEPS, self.variant))


def _belly(m, face, a, b, depth, col):
    """Below the edge a -> b (screen left to right, at -depth): a small lit chamfer, then a curve back under the
    ship that darkens as it turns away."""
    n = {"y": (0.0, 1.0), "x": (1.0, 0.0), "d": (math.sqrt(0.5), math.sqrt(0.5))}[face]
    if face == "y":
        s = (a[0] + b[0]) / 2 + 0.5
    elif face == "x":
        s = 0.5 - (a[1] + b[1]) / 2
    else:
        s = ((a[0] + b[0]) - (a[1] + b[1])) / 4 + 0.5
    rest = CURVE - CH
    prof = [(0.0, -depth), (CH, -depth - CH)]
    prof += [(CH + rest * (1 - math.cos(th)), -depth - CH - rest * math.sin(th))
             for th in (k * math.pi / 2 / (STEPS - 1) for k in range(1, STEPS))]
    for k in range(STEPS):
        (i0, z0), (i1, z1) = prof[k], prof[k + 1]
        pa0 = (a[0] - n[0] * i0, a[1] - n[1] * i0)
        pb0 = (b[0] - n[0] * i0, b[1] - n[1] * i0)
        pa1 = (a[0] - n[0] * i1, a[1] - n[1] * i1)
        pb1 = (b[0] - n[0] * i1, b[1] - n[1] * i1)
        m.poly([core.G(*pa1, z1), core.G(*pb1, z1), core.G(*pb0, z0), core.G(*pa0, z0)], col(k, s))


def _dummy(name):
    m = core.Mesh(name, flat=True)
    m.poly([core.G(0, 0, 0), core.G(0.001, 0, 0), core.G(0, 0.001, 0)], "dark")      # sub-pixel: renders nothing
    return m.build()


def out_block(mask, o, variant=0, part="rim", room=0):
    """A ghost piece. part "rim": the see-through edge lines above the deck (a 'ghost' sprite: env_build renders its
    brightness as alpha; drawn in the sorted layer). part "belly": the solid armour below the deck (drawn UNDER the
    floor layer, so a deck in front of it hides it)."""
    m = core.Mesh(f"hull_ghost{o}_{mask}_{variant}_{part}_{room}", flat=True)
    emit(m, Out(mask, o, variant, part, room))
    if not m.f:                                       # a corner piece with no camera-facing outer edge
        m.poly([core.G(0, 0, 0), core.G(0.001, 0, 0), core.G(0, 0.001, 0)], "dark")
    if part == "rim":
        return [_dummy(f"ghost_plate_{o}_{mask}_{room}"), m.build()]
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
        _belly(m, face, a, b, ZB, lambda k, s: A.hull_belly(face, s, k, STEPS, 0))
    return [m.build()]


def vert():
    """Ghost vertical edge line at the tile's front corner (+x, +y), placed where the front ghost's outer silhouette
    turns or ends (convex and concave corners, steps, run ends). It runs the ghost's full height: from just under the
    rim's crest line (so the two semi-transparent lines never overlap into a bright dot) down the belly to where the
    belly turns under. 1 px wide: the corner sits on a pixel boundary, so the sliver is shifted half a pixel onto a
    pixel column. Edge-only 'ghost' sprite at the secondary line weight."""
    m = core.Mesh("ghost_vert", flat=True)
    w = 0.3 * C                                                 # well under 1 px wide
    h = 1 / 128                                                 # (x + h, y - h) moves the corner +0.5 px on screen
    p = (0.5 + h, 0.5 - h)
    a, b = (p[0] - w, p[1] + w), (p[0] + w, p[1] - w)          # a screen-horizontal sliver through the corner
    z0, z1 = -ZB, ZG - 1.5 * DZ
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z1), core.G(*a, z1)], "gW2")
    return [_dummy("ghost_vert_plate"), m.build()]
