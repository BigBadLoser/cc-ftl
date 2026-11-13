"""Vending machine look study, round 11 (family `vending11`, palette set vending, preview only): round 10's vm1c10b
(rising sweep; user, 2026-11-13: best so far) with the side gradient back. Rounds 8 and 9 got a dark-to-light ramp
down the side by accident (bent normals from the old geometry); the user liked it, so here it is on purpose: the
side walls' shading normals lean down near the top and up near the bottom, so the side runs from dark under the roof
to a lighter wine at the floor. The user preferred the eased ramp to a linear one and wanted the dark part bigger
(2026-11-13), so the dark holds over a top share of the wall before easing down.
Only the shading changes; the mesh is round 10's, and the front and back stay flat.
The lean fades in round the vertical corners (by how much a normal faces sideways), so the front stays one tone,
and only the wine faces take it (on the cream it streaked).

  vm1c11a dark top 45% · vm1c11b dark top 55% · vm1c11c dark top 65% (all at round 9 strength)

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera."""
import math

from mathutils import Vector

from . import vending_r10 as R
from .research_kit import Bench
from .vending_study import FP

RAMPS = {  # lean of the side normal (tan, + towards up) at the top of the wall and at the floor, and the share of
    "vm1c11a": (-0.30, 0.50, 0.45),     # the wall from the top that holds the dark before the ramp eases to the floor
    "vm1c11b": (-0.30, 0.50, 0.55),
    "vm1c11c": (-0.30, 0.50, 0.65),
}


def ramp(k, ob, top, bot, dark):
    me = ob.data
    inv = ob.matrix_world.inverted()
    o = inv @ R.G(k, 0, R.CY, 0)
    du = (inv @ R.G(k, 1, R.CY, 0)) - o
    dz = (inv @ R.G(k, 0, R.CY, 1)) - o
    uh, zh = du.normalized(), dz.normalized()
    zwall = R.TOP - R.RT
    normals = [Vector(c.vector) for c in me.corner_normals]
    col = me.color_attributes["Col"].data
    for p in me.polygons:
        r, g, _, _ = col[p.loop_start].color
        if r < 2 * g:                                        # wine is red-dominant; cream is not
            continue                                         # the cream wrap keeps its flat tone
        for li in p.loop_indices:
            P = me.vertices[me.loops[li].vertex_index].co
            u, z = (P - o).dot(du) / du.length_squared, (P - o).dot(dz) / dz.length_squared
            n = normals[li]
            if abs(u) < R.FU - 0.01 or abs(n.dot(zh)) > 0.2 or z > zwall + 0.01:
                continue                                     # outer side walls and their corners only
            w = n.dot(uh) ** 2                               # full on the side, none on the front or back
            t = max(0.0, (1 - z / zwall - dark) / (1 - dark))   # dark held over the top share, then
            t = t * t * (3 - 2 * t)                          # smoothstep down to the floor
            h = n - zh * n.dot(zh)
            normals[li] = (h.normalized() + zh * (w * (top + (bot - top) * t))).normalized()
    me.normals_split_custom_set(normals)


def make(name):
    def f():
        k = Bench(f"vending_{name}", FP)
        R.body(k, R.WAVES["vm1c10b"], stripe=False, kick=False)
        R.contents(k)
        R.back(k)
        out = R.build(k)
        ramp(k, out[0], *RAMPS[name])
        return out
    return f


DESIGNS = {n: make(n) for n in RAMPS}


def jobs():
    return [(f"module.vending11.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
