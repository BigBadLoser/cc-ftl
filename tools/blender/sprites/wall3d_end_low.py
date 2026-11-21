"""A low partition's end face (walls down, wall3d.end_face at level "low"): its section where it butts into the near
hull, which is cut flush with the deck there (wall3d_belly, `top` FAR_LOW), so all of the section shows. Traced from
the wall's own piece (its run on to that edge, with the same corner fills): the piece is built and its top found by
casting down at the tile's edge, so the section matches the wall's silhouette whatever the look's skirts and stub
(the old section, built from walls.profile, stood over the low stub's cut top)."""
import bpy
from mathutils import Vector

from . import core
from . import walls as W

N = 96                      # columns across the tile
LIP = 0.026                 # the dark outline along the section's top (as end_face's skirts)


def _profile(side, corners):
    """[(u, z)] of the wall's top along the tile's +y (s) or +x (e) edge, u from its far (-) side."""
    from .wall3d import block
    mask = (5 if side == "s" else 10) | sum(need for b, need in W.CORNER_NEED.items() if corners & b)
    core.clear_scene_meshes()
    objs = block(mask, "wall", level="low", corners=corners)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    e = 1e-3
    out = []
    for c in range(N + 1):
        u = min(max(c / N, e), 1 - e)
        x, y = (u - 0.5, 0.5 - e) if side == "s" else (0.5 - e, u - 0.5)
        hit, loc, *_ = bpy.context.scene.ray_cast(dg, core.G(x, y, 5.0), Vector((0, 0, -1)))
        out.append((c / N, max(0.0, loc.z) if hit else 0.0))
    for ob in objs:
        bpy.data.objects.remove(ob, do_unlink=True)
    return out


def low_end(side, corners=0):
    """The low partition's end section (wall3d.end_face's place at level low): its silhouette filled in the wall's
    tone, a dark outline along its top."""
    from .wall3d import OUT, P, PAINT, Relief
    prof = _profile(side, corners)
    ax = "y" if side == "s" else "x"
    k = Relief(f"wall3d_end_low_{side}_{corners}")
    k.side = ax
    for (u0, z0), (u1, z1) in zip(prof, prof[1:]):
        if max(z0, z1) <= 1e-6:
            continue
        l0, l1 = max(0.0, z0 - LIP), max(0.0, z1 - LIP)
        k.poly([P(ax, 0.5, u0 - 0.5, 0.0, 0.0), P(ax, 0.5, u1 - 0.5, 0.0, 0.0),
                P(ax, 0.5, u1 - 0.5, l1, 0.0), P(ax, 0.5, u0 - 0.5, l0, 0.0)], "wall", 2, OUT(ax))
        k.poly([P(ax, 0.5, u0 - 0.5, l0, PAINT), P(ax, 0.5, u1 - 0.5, l1, PAINT),
                P(ax, 0.5, u1 - 0.5, z1, PAINT), P(ax, 0.5, u0 - 0.5, z0, PAINT)], "wall", 1, OUT(ax))
    return [k.m.build()]
