"""Exit markers for the starmap (family `starmap`): starmap.exit.gate and starmap.exit.rift, drawn where a hyperlane of
that kind leaves the sector (StarmapSector's gateways), in place of the thicker or dashed lane end.

Like the structure icons: laid out in the px of a 24 px icon and rendered at ZOOM (2) times the pixels, a 48 px frame at
1x, anchor at the centre; the map draws them by the crisp rule (whole device px per art px).

  gate   a free-floating upright ring of armoured segments with four emitter pods and a cyan energy membrane across it
         (glow only, so the map shows through); lit and outlined like the structures
  rift   a jagged tear in space: a rim banded from hot white through magenta and violet into a dark core with far stars,
         dark shards drifting off with lit edges, curling wisps, crackling arcs and a violet glow; it lights itself, so no
         outline"""
import math

import numpy as np
from mathutils import Vector

from . import core
from .starmap_icons import ZOOM
from .starmap_kit import (N, R, U, P, annulus, face, flat, frame_item, glow_only, hue, place, px, selflit, start,
                          streak)

SIZE = 48                       # frame, 1x px
KINDS = ("gate", "rift")
UP = Vector((0, 0, 1))


def obox(m, c, ax, half, side, top=None):
    """A box at Blender point c along the unit axes ax = (x, y, z) with half sizes half; `top` paints the +z face."""
    x, y, z = (v * h for v, h in zip(ax, half))
    pts = [c + sx * x + sy * y + sz * z for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
    for q, col in (((0, 1, 3, 2), side), ((4, 5, 7, 6), top or side), ((0, 1, 5, 4), side), ((2, 3, 7, 6), side),
                   ((0, 2, 6, 4), side), ((1, 3, 7, 5), side)):
        m.poly([pts[i] for i in q], col)


def gate():
    """A free-floating ring: armoured segments, four raised emitter pods with cyan lenses, a cyan membrane (glow)."""
    m = core.Mesh("gate")
    a = Vector((math.cos(math.radians(-10)), math.sin(math.radians(-10)), 0))     # the ring's axis, a little off the view
    e1 = a.cross(UP).normalized()
    R0, rr, segs, sides = px(8), px(1.6), 32, 6
    c = Vector((0, 0, 0))

    def pt(i, j):
        t, p = i * math.tau / segs, j * math.tau / sides
        radial = e1 * math.cos(t) + UP * math.sin(t)
        return c + radial * (R0 + rr * math.cos(p)) + a * (rr * math.sin(p))
    for i in range(segs):
        for j in range(sides):
            m.poly([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], "plate" if i // 2 % 2 else "steelL")
    for k in range(4):                                    # emitter pods at the diagonals, lens facing the ring's centre
        t = math.pi / 4 + k * math.pi / 2
        radial = e1 * math.cos(t) + UP * math.sin(t)
        tang = a.cross(radial).normalized()
        obox(m, c + radial * (R0 + rr * 0.6), (tang, a, radial), (px(1.5), px(2.3), px(1.5)), "steel", "steelD")
        obox(m, c + radial * (R0 + rr * 2.3), (tang, a, radial), (px(0.5), px(0.5), px(0.6)), "steelL", "red" if k == 0 else "steelL")
        obox(m, c + radial * (R0 - rr * 1.05), (tang, a, radial), (px(0.9), px(1.3), px(0.25)), "cyan")
    field = core.Mesh("field")
    face(field, [c + (e1 * math.cos(k * math.tau / 48) + UP * math.sin(k * math.tau / 48)) * (R0 - rr) for k in range(48)],
         glow_only(hue("fxH1", 0.12)))
    annulus(field, c + a * px(0.05), a, (R0 - rr) * 0.72, R0 - rr, lambda f, aa, cc: [glow_only(hue("fxH1", 0.3 if x > 0.5 else 0.2)) for x in f],
            segs=48, rings=2, e=e1)
    return [m.build()], [field.build()]


# the tear's bands from its outer rim in: (grow, reach in layout px, look); the inner ones lie in front
RIFT_BANDS = ((1.4, 1.0, ("selflit", "rvG", 0.8)), (0.8, 0.6, ("selflit", "magenta", 0.7)), (0.35, 0.25, ("selflit", "arc", 0.9)),
              (0.0, 0.0, ("flat", "rvM")), (-0.7, -1.2, ("flat", "rvD")), (-1.4, -2.6, ("flat", "xnK")))


def rift(seed=7):
    """A tear in space: banded rim to a dark core with far stars, drifting shards with lit edges, curling wisps, arcs."""
    rng = np.random.default_rng(seed)
    t = math.radians(14)
    d, s = R * math.sin(t) + U * math.cos(t), R * math.cos(t) - U * math.sin(t)
    H, W = px(10.5), px(3.2)
    ts = np.linspace(-1, 1, 19)
    jag = [rng.uniform(-0.3, 0.3) for _ in ts]

    def outline(grow, reach, w=0.0):
        """The tear's edge, widened by grow and lengthened by reach (layout px), at depth w."""
        left, right = [], []
        for k, tt in enumerate(ts):
            half = max(0.0, W * (1 - tt * tt) ** 0.7 * (1 + jag[k]) + px(grow) * (1 - tt * tt) ** 0.3)
            mid = d * (tt * (H + px(reach))) + s * (px(1.4) * math.sin(2.2 * tt))
            left.append(mid - s * half + N * w)
            right.append(mid + s * half + N * w)
        return left + right[::-1]
    look = lambda kind, *a: selflit(*a) if kind == "selflit" else flat(*a)  # noqa: E731
    glow = core.Mesh("glow")
    for k, (grow, reach, lv) in enumerate(((5.5, 3.5, 0.06), (3.5, 2.2, 0.12), (2.0, 1.2, 0.24))):
        face(glow, outline(grow, reach, -px(4 - k)), glow_only(hue("rvG", lv)))
    m = core.Mesh("rift")
    for k, (grow, reach, lk) in enumerate(RIFT_BANDS):
        face(m, outline(grow, reach, px(0.05) * k), look(*lk))
    for k in range(9):                                    # far stars, one a little galaxy smear
        tt = rng.uniform(-0.65, 0.65)
        p = d * (tt * H * 0.85) + s * (px(1.4) * math.sin(2.2 * tt)) + s * (W * rng.uniform(-0.35, 0.35) * (1 - tt * tt)) + N * px(0.4)
        r = px(0.55 if k < 2 else 0.35)
        face(m, [p + (R * math.cos(j * math.tau / 6) + U * math.sin(j * math.tau / 6) * (0.45 if k == 0 else 1)) * r * (2 if k == 0 else 1)
                 for j in range(6)], flat("fxI0" if k == 0 else "icL" if k % 3 else "lampY"))
    for k in range(7):                                    # shards of broken space drifting off the edges, rims lit by the tear
        tt = rng.uniform(-0.85, 0.85)
        side = 1 if k % 2 else -1
        base = d * (tt * H) + s * side * (W * (1 - tt * tt) ** 0.7 + px(rng.uniform(2.2, 4.5)))
        size = px(rng.uniform(0.9, 1.7))
        ang = rng.uniform(0, math.tau)
        tri = [base + (s * math.cos(ang + j * 2.1 + rng.uniform(-0.3, 0.3)) + d * math.sin(ang + j * 2.1)) * size * (1.4 if j == 0 else 1)
               for j in range(3)]
        cen = sum(tri, Vector()) / 3
        face(m, [cen + (q - cen) * 1.35 + N * px(0.6) for q in tri], selflit("rvG", 0.5))
        face(m, [q + N * px(0.65) for q in tri], flat("xnD"))
    for k in range(3):                                    # wisps curling out of the tear
        tt0 = rng.uniform(-0.5, 0.5)
        side = 1 if k % 2 else -1
        p0 = d * (tt0 * H) + s * side * W * 0.8
        pts = [p0 + s * side * px(1.1 * j) + d * px(1.8 * math.sin(j * 0.9 + k)) + d * px(0.5 * j * side) for j in range(6)]
        for j, (p, q) in enumerate(zip(pts, pts[1:])):
            streak(glow, p - N * px(1), q - N * px(1), px(0.9), px(0.7), glow_only(hue("rvG", 0.3 - 0.05 * j)))
    for k in range(3):                                    # a few short arcs crackling off the rim
        tt = (-0.55, 0.15, 0.6)[k]
        side = 1 if k % 2 else -1
        p = d * (tt * H) + s * side * (W * (1 - tt * tt) ** 0.7 + px(1.2))
        pts = [p]
        for j in range(3):
            p = p + s * side * px(rng.uniform(0.8, 1.2)) + d * px(rng.uniform(-1.1, 1.1))
            pts.append(p)
        for a, b in zip(pts, pts[1:]):
            streak(m, a + N * px(0.7), b + N * px(0.7), px(0.7), px(0.45), selflit("arc" if k == 1 else "rvG", 0.9))
    return [m.build()], [glow.build()]


def exit_items(kind):
    start()
    objs, halo = gate() if kind == "gate" else rift()
    for ob in objs + halo:
        ob.scale = (ZOOM,) * 3
    place(objs + halo, SIZE)
    return [frame_item(f"starmap.exit.{kind}", SIZE, halo=halo, outline=kind == "gate")]


def jobs():
    return [lambda kind=kind: exit_items(kind) for kind in KINDS]
