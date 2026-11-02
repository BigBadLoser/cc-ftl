"""An engine's bulkhead from outside (roofed ships): tile.hull.ext.o<o>.m<mask>.eng.<half>, the base straight run
(wall3d_ext, o 1: space at +y, 2: at +x) with a round cutout where the engine's bell passes through. The engine's hull
row is 4 tiles; its bell sits on the edge between the two inner tiles, so each of those tiles takes half the hole:
half 0 the tile before that edge (the hole at its +run edge), half 1 the tile after it (at its -run edge). The bell's
mount flange (engine_proto.bell, radius 1.05) covers the cut's rim from outside; it is lined in the HOLE tone."""
import math

import bpy

from . import core
from . import wall3d_ext as X
from .wall3d_ext_geom import D, E, LEAN_RISE

BZ = 1.4                # the bell's axis height (engine_proto.BZ)
R = 0.58                # the cutout's radius: under the hull's top (walls.hull_top 2.05) with a lip of a few px
SIDES = 24
H = 2.05                # the hull's top (walls.hull_top)
BACK = -0.3             # the lining's back wall, in from the face (the tile's middle is 0)
HOLE = "hsK"            # the lining's tone (the hull ramp's darkest: it stays dark under the paint)


def _face(z):
    """The outer face's position out from the tile's middle at height z: upright on the outline under the lean,
    leaning back to the top's front edge over it (wall3d_ext_geom.Section.lean_d)."""
    return D * min(1.0, max(0.0, (H - z) / LEAN_RISE)) + (E - D)


def _frame(o, half):
    """pt(t, s, z) in Blender space (t out of the hull, s along the run from the hole's centre) and the sign of s
    on the tile's own side."""
    dx, dy = X.STRAIGHT[(5, 2) if o == 2 else (10, 1)]
    e = 0.5 if half == 0 else -0.5
    cx, cy = dx * e, dy * e

    def pt(t, s, z):
        return core.G(cx + (t if o == 2 else s), cy + (s if o == 2 else t), z)
    return pt, -1.0 if half == 0 else 1.0


def _ring():
    return [(R * math.cos(math.tau * i / SIDES), BZ + R * math.sin(math.tau * i / SIDES)) for i in range(SIDES + 1)]


def _cutter(o, half):
    """A cylinder through the wall along its outward axis, on the tile's +run (half 0) or -run (half 1) edge."""
    pt, _ = _frame(o, half)
    ring = _ring()
    m = core.Mesh("bulkhead_cut")
    for (s0, z0), (s1, z1) in zip(ring, ring[1:]):
        m.poly([pt(-1.0, s0, z0), pt(-1.0, s1, z1), pt(1.0, s1, z1), pt(1.0, s0, z0)], HOLE)
    m.poly([pt(-1.0, s, z) for s, z in ring[:-1]], HOLE)
    m.poly([pt(1.0, s, z) for s, z in ring[:-1]][::-1], HOLE)
    return m.build()


def _lining(o, half):
    """The tile's half of the hole's dark lining: a tube from the face in to BACK, and its back wall."""
    pt, _ = _frame(o, half)
    a0 = math.pi / 2 if half == 0 else -math.pi / 2         # (half 0 takes the -s side of the hole, half 1 the +s)
    n = SIDES // 2
    arc = [(R * math.cos(a0 + math.pi * i / n), BZ + R * math.sin(a0 + math.pi * i / n)) for i in range(n + 1)]
    m = core.Mesh("bulkhead_lining")
    for (s0, z0), (s1, z1) in zip(arc, arc[1:]):
        m.poly([pt(_face(z0), s0, z0), pt(BACK, s0, z0), pt(BACK, s1, z1), pt(_face(z1), s1, z1)], HOLE)
    m.poly([pt(BACK, s, z) for s, z in arc], HOLE)
    return m.build()


def _cut(objs, cutter):
    for ob in objs:
        if ob.type != "MESH":
            continue
        md = ob.modifiers.new("bulkhead", "BOOLEAN")
        md.operation, md.solver, md.object = "DIFFERENCE", "EXACT", cutter
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=md.name)


def bulkhead(o, half):
    """(own, wide) as ext_run_wide gives them, every object cut by the bell's hole."""
    own, wide = X.ext_run_wide(5 if o == 2 else 10, o)
    cutter = _cutter(o, half)
    _cut(wide, cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)
    lining = _lining(o, half)
    return own + [lining], wide + [lining]


def jobs():
    """(sprite id, build) of the bulkhead halves, kind "wide"."""
    return [(f"tile.hull.ext.o{o}.m{5 if o == 2 else 10}.eng.{h}", lambda o=o, h=h: bulkhead(o, h))
            for o in (1, 2) for h in (0, 1)]
