"""Finished rock walls (family `rockwall`): walls built of bricks cut from the asteroid's cliffs, the metal wall set
mirrored piece for piece.

The geometry is the metal walls' own (walls.Strip: the same body, skirt slope, arms, corner fills and view levels, on a
64-cell grid), so rock and metal walls stand together. The stone is in the surface (rockwall_stone.py): bricks on every
camera-facing face and down the skirt, cliff-coloured, lit by their own baked light. The cap is the near-black cap of
every wall. Breaches (derelict_walls.Breach): the same tear, bricks only below it, fallen stones at its foot, cables
hanging out.

Ids mirror tile.wall.*: tile.rockwall.{full.|low.|}m<mask>[c<bits>], tile.rockwall.{full.|low.|}end.{s|e}[.c<bits>],
tile.rockwall.{full.|}m<mask>.breach and tile.rockwall.full.breach.end.{w|n}."""
import math
from contextlib import contextmanager

import numpy as np
from mathutils import Vector

from . import derelict_walls as DW
from . import walls as W
from .rock_base import TAU, polyg, quad, rng, tri
from .rockwall_stone import FINE, MORTAR, Lit, _hash, dressed_face, skirt_blocks

STONE = ("rkM", "rkD", "rkD", "rkM")                 # broken and cut rock: the cliffs' tones


@contextmanager
def fine_grid():
    """Emit walls.py shells on the fine grid (the silhouette's snapping was fixed at construction, on walls.GN)."""
    old = W.GN, DW.GN, DW.C
    W.GN = DW.GN = FINE
    DW.C = 1 / FINE
    try:
        yield
    finally:
        W.GN, DW.GN, DW.C = old


class Shell(W.Strip):
    """The mortar shell: the dark cap, the joint floor under the footing's bricks; the bricks are the face."""
    def col_top(self, i, j, kind, x, y):
        return "swK"

    def col_skirt(self, i, j, kind, x, y):
        return MORTAR

    def col_face(self, face, x, y, z):
        return None


class BreachShell(DW.Breach):
    def col_top(self, i, j, kind, x, y):
        r, ax, z, rib = self._cell(i, j)
        if z >= r[3] - 1e-6:
            return "swK"
        return "gm" if rib else STONE[_hash(i // 6, j // 6) % 4]                         # the broken stone

    def col_skirt(self, i, j, kind, x, y):
        return MORTAR

    def col_face(self, face, x, y, z):
        e = 0.5 / FINE
        px, py = (x, y - e) if face == "y" else (x - e, y)
        c = self._cell(min(FINE - 1, int((px + 0.5) * FINE)), min(FINE - 1, int((py + 0.5) * FINE)))
        if not c or c[2] >= c[0][3] - 1e-6:
            return None
        r, ax, top, rib = c
        if rib:
            return "gmD" if face == "x" else "gm"
        if (face == "x") == (ax == "x"):
            return "rkM"                                 # the cut through the rock
        return "rkM" if z > top - 0.03 else None         # the torn lip; below it the bricks


def faces(sp):
    """Exposed camera-facing faces of a shell: (axis, plane, u0, u1, top) with axis 'y' (the +y face at y = plane, u =
    x) or 'x' (the +x face at x = plane, u = y)."""
    out = []
    for r in sp.rects:
        x0, x1, y0, y1 = r[0]
        for ax, plane, a, b in (("y", y1, x0, x1), ("x", x1, y0, y1)):
            if plane > 0.5 - 1e-6:
                continue                                 # the arm runs on into the next tile
            seg = None
            n = int(round((b - a) * FINE))
            for k in range(n):
                u = a + (k + 0.5) / FINE
                free = sp._rect_at(*((u, plane + 1e-3) if ax == "y" else (plane + 1e-3, u)), 0.0) is None
                if free and seg is None:
                    seg = a + k / FINE
                if not free and seg is not None:
                    out.append((ax, plane, seg, a + k / FINE, r[3]))
                    seg = None
            if seg is not None:
                out.append((ax, plane, seg, b, r[3]))
    merged = []                                          # an arm, the post and the next arm make one face: join
    for f in sorted(out, key=lambda f: (f[0], round(f[1], 6), round(f[4], 6), f[2])):    # them, so no brick is cut
        m = merged[-1] if merged else None
        if m and m[0] == f[0] and abs(m[1] - f[1]) < 1e-6 and abs(m[4] - f[4]) < 1e-6 and abs(m[3] - f[2]) < 1e-6:
            merged[-1] = (m[0], m[1], m[2], f[3], m[4])
        else:
            merged.append(f)
    return merged


def skirt_stones(k, sp, count, sd, extra=0):
    """Fallen stones in front of a breach (rough lumps on the skirt and the floor)."""
    r = rng(sd)
    placed = 0
    for _ in range(count * 8):
        if placed >= count + extra:
            break
        x, y = r.uniform(-0.49, 0.49), r.uniform(-0.49, 0.49)
        if sp._rect_at(x, y, 0.0):
            continue
        z = sp.skirtz(x, y)
        if z < 0.04 and placed >= extra:
            continue
        e = 0.01
        n = Vector((sp.skirtz(x - e, y) - sp.skirtz(x + e, y), sp.skirtz(x, y - e) - sp.skirtz(x, y + e), 2 * e))
        n = (n.normalized() + Vector((0, 0, 1))).normalized()
        rr = r.uniform(0.035, 0.065)
        c = Vector((x, y, z)) + n * (rr * 0.25)
        u = n.cross(Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))).normalized()
        v = n.cross(u)
        pts = [c + (u * math.cos(t) * r.uniform(0.75, 1.2) + v * math.sin(t) * r.uniform(0.6, 1.0)) * rr - n * rr * 0.35
               for t in np.linspace(0, TAU, 7, endpoint=False) + r.uniform(0, 1)]
        mid = [c + (p - c) * 0.6 + n * rr * r.uniform(0.35, 0.55) for p in pts]          # a shoulder ring: chunky,
        top = c + n * rr * r.uniform(0.6, 0.85) + u * r.uniform(-0.2, 0.2) * rr           # not a cone
        col = STONE[int(r.integers(0, 4))]
        for a, b, ma, mb in zip(pts, pts[1:] + pts[:1], mid, mid[1:] + mid[:1]):
            quad(k, a, b, mb, ma, col, (a + b) / 2 - c + n * 0.01)
            tri(k, ma, mb, top, col, (ma + mb) / 2 - c + n * 0.02)
        placed += 1


def build(sp, name, limit=None, cables=None):
    k = Lit(name)
    with fine_grid():
        W.emit(k.m, sp)
    for ax, plane, a, b, top in faces(sp):
        skirt_blocks(k, sp, ax, plane, a, b)                          # the footing, at every level
        if top > sp.zs + 0.05:
            dressed_face(k, ax, plane, a, b, sp.zs, top, limit)
    if limit:
        skirt_stones(k, sp, 0, _hash(sp.mask, len(name)), extra=18)                # fallen from the breach
    if cables:
        cables(k.m)
    return k.build()


def block(mask, level, corners=0):
    return build(Shell(mask, "wall", level, 0, corners), f"rockwall_{mask}_{level}_{corners}")


def breach(mask, level):
    sp = BreachShell(mask, "wall", level)
    span = sp.edge - sp.lo
    ax = "x" if (mask & 10 or not mask & 5) else "y"

    def limit(u0, u1):
        return sp.lo + span * min(DW._prof(DW.TEAR[ax], u) for u in np.linspace(u0, u1, 5))
    return build(sp, f"rockwall_breach_{mask}_{level}", limit, lambda m: DW._cables(m, "wall", mask, level))


def end_face(side, level="up", corners=0):
    """walls.end_face's shape for stone: the wall's section where it butts into the low hull ghost."""
    t, top, zs = W.profile("wall", level)
    run = W.skirt_run()
    p0 = W.wall_back()
    p1 = p0 + W.TW
    fz = W.fill_top("wall", level)
    lo_bit, hi_bit = (4, 2) if side == "s" else (1, 2)
    spans = [(p0, p1, top)] + ([(0.0, p0, fz)] if corners & lo_bit else []) + ([(p1, 1.0, fz)] if corners & hi_bit else [])
    k = Lit(f"rockwall_end_{side}_{level}_{corners}")
    out = Vector((0, 1, 0)) if side == "s" else Vector((1, 0, 0))
    for c in range(FINE):
        u0, u1 = c / FINE, (c + 1) / FINE
        um = (u0 + u1) / 2
        sp = next((s for s in spans if s[0] <= um < s[1]), None)
        zt = sp[2] if sp else zs * max(0.0, 1.0 - min(max(a - um, um - b) for a, b, _ in spans) / run)
        if zt <= W.ZG + 1e-6:
            continue
        rows = max(1, int(round((zt - W.ZG) / 0.04)))
        for r_ in range(rows):
            z0, z1 = W.ZG + (zt - W.ZG) * r_ / rows, W.ZG + (zt - W.ZG) * (r_ + 1) / rows
            col = "swK" if (sp and z1 > zt - 0.02) else STONE[_hash(c // 12, r_ // 5) % 4]
            a, b = (Vector((-0.5 + u0, 0.5, z0)), Vector((-0.5 + u1, 0.5, z0))) if side == "s" else \
                (Vector((0.5, -0.5 + u0, z0)), Vector((0.5, -0.5 + u1, z0)))
            dz = Vector((0, 0, z1 - z0))
            quad(k, a, b, b + dz, a + dz, col, out)
    return k.build()


def breach_end(side, level):
    """The intact neighbour's exposed end beside a breach: the stone's section from the tear's edge to the wall top."""
    lo, edge = DW.tear_range("wall", level)
    top = W.wall_top("wall", level)
    p0 = -0.5 + W.wall_back()
    k = Lit(f"rockwall_breach_end_{side}_{level}")
    out = Vector((-1, 0, 0)) if side == "w" else Vector((0, -1, 0))
    n = max(1, round(W.TW * FINE))
    rows = max(1, int(round((top - edge) / 0.04)))
    for c in range(n):
        u0, u1 = p0 + c / FINE, p0 + (c + 1) / FINE
        for r_ in range(rows):
            z0, z1 = edge + (top - edge) * r_ / rows, edge + (top - edge) * (r_ + 1) / rows
            a, b = (Vector((-0.5, u1, z0)), Vector((-0.5, u0, z0))) if side == "w" else \
                (Vector((u0, -0.5, z0)), Vector((u1, -0.5, z0)))
            dz = Vector((0, 0, z1 - z0))
            polyg(k, [a, b, b + dz, a + dz], STONE[_hash(c // 12, r_ // 5) % 4], out)
    return k.build()


PRE = {"up": "full.", "cut": "", "low": "low."}
END_CORNERS = {"s": (0, 2, 4, 6), "e": (0, 1, 2, 3)}


def jobs():
    out = []
    for m in range(16):
        for c in W.corner_sets(m):
            sid = f"m{m}c{c}" if c else f"m{m}"
            for lv, pre in PRE.items():
                out.append((f"tile.rockwall.{pre}{sid}", (1, 1), "block", lambda m=m, lv=lv, c=c: block(m, lv, c)))
        for lv in ("up", "cut"):
            out.append((f"tile.rockwall.{PRE[lv]}m{m}.breach", (1, 1), "block", lambda m=m, lv=lv: breach(m, lv)))
    for s in ("s", "e"):
        for lv, pre in PRE.items():
            for c in END_CORNERS[s]:
                out.append((f"tile.rockwall.{pre}end.{s}{f'.c{c}' if c else ''}", (1, 1), "block",
                            lambda s=s, lv=lv, c=c: end_face(s, lv, c)))
    for s in ("w", "n"):
        out.append((f"tile.rockwall.full.breach.end.{s}", (1, 1), "block", lambda s=s: breach_end(s, "up")))
    return out
