"""Exit markers for the starmap (family `starmap`): starmap.exit.gate and starmap.exit.rift, drawn where a hyperlane of
that kind leaves the sector (StarmapSector's gateways), in place of the thicker or dashed lane end.

Like the structure icons: laid out in the px of a 24 px icon and rendered at ZOOM (2) times the pixels, a 48 px frame at
1x (96 at 2x), anchor at the centre; the map draws them by the crisp rule (whole device px per art px).

  gate   an upright ring of armoured segments with four lit nodes on an anchor pylon, and a cyan energy membrane across
         it (glow only, so the map shows through); lit and outlined like the structures
  rift   a jagged tear in space: a violet rim round a dark core with a few far stars, crackling arcs, a violet glow; it
         lights itself, so no outline"""
import math

import numpy as np
from mathutils import Vector

from . import core
from .starmap_icons import ZOOM, box
from .starmap_kit import (N, R, U, P, annulus, face, flat, frame_item, glow_only, hue, place, px, selflit, start,
                          streak)

SIZE = 48                       # frame, 1x px
KINDS = ("gate", "rift")
UP = Vector((0, 0, 1))


def gate():
    m = core.Mesh("gate")
    a = Vector((math.cos(math.radians(-10)), math.sin(math.radians(-10)), 0))     # the ring's axis, a little off the view
    e1 = a.cross(UP).normalized()
    R0, rr, segs, sides = px(8), px(1.6), 32, 6
    c = Vector((0, 0, R0 + rr + px(3)))

    def pt(i, j):
        t, p = i * math.tau / segs, j * math.tau / sides
        radial = e1 * math.cos(t) + UP * math.sin(t)
        return c + radial * (R0 + rr * math.cos(p)) + a * (rr * math.sin(p))
    for i in range(segs):
        node = i % (segs // 4) == 0
        for j in range(sides):
            col = "cyan" if node and j in (0, 1, 5) else ("plate" if i // 2 % 2 else "steelL")
            m.poly([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], col)
    box(m, (0, 0), px(2.6), px(2.6), px(-1), px(3.2), "steel", "steelL")          # the anchor pylon under the ring
    box(m, (0, 0), px(5), px(5), px(-2.5), px(-1), "steelD", "plate", inset=0.15)
    box(m, (px(1.6), px(-1.6)), px(0.9), px(0.9), px(-1.5), px(-0.6), "red")
    field = core.Mesh("field")
    face(field, [c + (e1 * math.cos(k * math.tau / 48) + UP * math.sin(k * math.tau / 48)) * (R0 - rr) for k in range(48)],
         glow_only(hue("fxH1", 0.12)))
    annulus(field, c + a * px(0.05), a, (R0 - rr) * 0.72, R0 - rr, lambda f, aa, cc: [glow_only(hue("fxH1", 0.3 if x > 0.5 else 0.2)) for x in f],
            segs=48, rings=2, e=e1)
    return [m.build()], [field.build()]


def rift(seed=7):
    rng = np.random.default_rng(seed)
    t = math.radians(14)
    d, s = R * math.sin(t) + U * math.cos(t), R * math.cos(t) - U * math.sin(t)
    H, W = px(10.5), px(3.0)
    ts = np.linspace(-1, 1, 15)
    jag = [rng.uniform(-0.35, 0.35) for _ in ts]

    def outline(grow, reach, w=0.0):
        """The tear's edge, widened by grow and lengthened by reach (layout px), at depth w."""
        left, right = [], []
        for k, tt in enumerate(ts):
            half = W * (1 - tt * tt) ** 0.7 * (1 + jag[k]) + px(grow) * (1 - tt * tt) ** 0.3
            mid = d * (tt * (H + px(reach))) + s * (px(1.2) * math.sin(2.2 * tt))
            left.append(mid - s * half + N * w)
            right.append(mid + s * half + N * w)
        return left + right[::-1]
    glow = core.Mesh("glow")
    face(glow, outline(4.0, 2.5, -px(3)), glow_only(hue("rvG", 0.1)))
    face(glow, outline(2.0, 1.2, -px(2)), glow_only(hue("rvG", 0.22)))
    m = core.Mesh("rift")
    face(m, outline(1.1, 0.8, 0.0), selflit("rvG", 0.8))
    face(m, outline(0.4, 0.3, px(0.05)), selflit("magenta", 0.6))
    face(m, outline(0.0, 0.0, px(0.1)), flat("xnK"))
    for k in range(5):                                    # far stars seen through it
        tt = rng.uniform(-0.6, 0.6)
        p = d * (tt * H) + s * (W * rng.uniform(-0.45, 0.45) * (1 - tt * tt)) + N * px(0.15)
        face(m, [p + (R * math.cos(j * math.tau / 6) + U * math.sin(j * math.tau / 6)) * px(0.45) for j in range(6)], flat("icL"))
    for k in range(4):                                    # crackling arcs off the rim
        tt = rng.uniform(-0.7, 0.7)
        side = 1 if k % 2 else -1
        p = d * (tt * H) + s * side * (W * (1 - tt * tt) ** 0.7 + px(1))
        pts = [p]
        for j in range(4):
            p = p + s * side * px(rng.uniform(1.0, 1.8)) + d * px(rng.uniform(-1.4, 1.4))
            pts.append(p)
        for a, b in zip(pts, pts[1:]):
            streak(m, a + N * px(0.2), b + N * px(0.2), px(0.8), px(0.5), selflit("arc" if k < 2 else "rvG", 0.9))
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
