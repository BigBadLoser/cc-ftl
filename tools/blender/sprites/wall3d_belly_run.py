"""The belly's straight runs (the cutaway hull, wall3d_belly), built as the exterior's are (wall3d_ext, wall3d_ext_t3):
the armour on wall3d_ext_geom's Section (its belly option: cut at the rim, upright, then the slope under the ship) and
Face, set out in front of the hull's own block as the exterior's (T3's BACK in), the block running back to the tile's
inner edge; dressed in one of the bay looks (wall3d_belly_bay) with Face's helpers, in art px from the face's +u end.
Rendered as the exterior's runs: coverage anti-aliased (env_build.AA) and "wide"."""
import bmesh

from . import core
from . import factions_relief as FR
from . import wall3d as T
from . import wall3d_belly_bay as BAY
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import D, E, YS, Face, Section

RUNS = {(0, 1): "y", (1, 0): "x"}  # the near runs' fronts and their faces' axes (wall3d: the face's normal)
INNER, BOTTOM = "nvF3", YS[0]        # the block's back (the hull's inside) and bottom


def section():
    from .wall3d_belly import ARMOUR, SLOPE, ZG
    return Section(ZG, T3.BACK, under=(ZG - ARMOUR, SLOPE[0], SLOPE[1]))


def build(s2, look=BAY.PLAIN, frame=True):
    """The run along a near front s2 ((0, 1) or (1, 0)) of a tile whose outline is the run set's (c 15), whole, in a
    bay look (wall3d_belly_bay.LOOKS); its frame left off if not `frame` (a diagonal's: diag_art)."""
    ax, sec = RUNS[s2], section()
    k = T.Relief(f"belly_run_{ax}")
    plane = E - D - T3.BACK
    f = Face(k, ax, plane, -0.5, 0.5, ("cont", "cont"), sec)
    foot = sec.under[0]
    for u0, u1, z0, z1, off, role in BAY.blocks(look, sec, _uz(sec)[1]):    # (the armour: not across its foot; a
        _block(f, u0, u1, z0, z1, role, off)                                # look's recesses its own)
    back = -0.5 - plane                                         # (the tile's inner edge, d from the block's face)
    prof = [(back, sec.zmin), (0.0, sec.zmin), (0.0, sec.H), (back, sec.H)]
    FR.prism(k, ax, plane, -0.5, 0.5, prof, "steel", 3, [BOTTOM, YS[1], T.CUT, INNER], YS[1])   # (its front closed,
                                                                # under the armour: a cut through both caps whole)
    fc = sec.cols(sec.sec(foot, sec.H), "face")[1]             # (a lid just under the deck, where the layers
    lid = [(back, -0.002), (sec.front(0.0, 0.0)[0][0], -0.002)]  # meet (wall3d_belly LAYERS), in the face's tone:
    lid += [(lid[1][0], -1e-4), (back, -1e-4)]                  # the under layer's cut open there shows the slope's
    f.part(-0.5, 0.5, lid, [fc] * 4, fc, end=False)             # lit top inside, dots along the exterior's foot)
    BAY.dress(look, f, sec, back, *_uz(sec), frame=frame)
    return k.build()


def _block(f, u0, u1, z0, z1, role, off):
    """Face.block, closed: its unseen faces (back, bottom) and ends drawn in a part's end tone (wall3d_belly END; the
    slope's in its own), so a cut through it (a corner's other fronts: cut) shows a solid end and caps whole."""
    from .wall3d_belly import END, SLOPE_TONE
    pf = f.sec.sec(z0, z1, off)
    hid = SLOPE_TONE if z1 <= f.sec.under[0] + 1e-6 else END    # (the slope's: its own tone, so where a hip
    cols = [hid if c is None else c for c in f.sec.cols(pf, role)]  # shows them they read as more slope)
    f.part(u0, u1, pf, cols, hid, end=False)


def _uz(s):
    """Art px to the face's u (px from its +u end -> u0, u1) and height (px down from the cut)."""
    return (lambda a, b: (0.5 - T3.px(b), 0.5 - T3.px(a))), (lambda v: s.z_at(s.H, v))


def cut(objs, planes):
    """Objects cut to half-spaces (n . p <= c, tile units: the side past each plane cleared), in place; each cut's
    opening capped (_cap) but a tile side's (the run goes on past it) and a level one's (the layers' deck: the lid)."""
    for ob in objs:
        inv = ob.matrix_world.inverted()
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)     # (each polygon its own corners: welded,
        for n, c in planes:                                             # a cut's edges close round its opening)
            nw = core.G(n.x, n.y, n.z)
            co, no = inv @ (nw * (c / n.length_squared)), (inv.to_3x3() @ nw).normalized()
            res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=co,
                                         plane_no=no, clear_outer=True)
            side = abs(n.z) < 1e-9 and min(abs(n.x), abs(n.y)) < 1e-9
            if not side and abs(n.z) < 0.99 * n.length:
                _cap(bm, [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary], no,
                     ob.matrix_world)
        bm.to_mesh(ob.data)
        bm.free()
    import bpy
    keep = [ob for ob in objs if ob.data.polygons]
    for ob in objs:
        if not ob.data.polygons:                                    # (cut away whole: none of it in this cell)
            bpy.data.objects.remove(ob)
    return keep


def _cap(bm, edges, no, mw):
    """A cut's opening closed, facing no, toned as what shows there past the cut (a "wide" sprite takes its colours
    from a copy run on past the tile, where a cap may show that the tile's own render hides): the slope's tone under
    the foot, the face's over it."""
    from .wall3d_belly import ARMOUR, OUTER, SLOPE_TONE, ZG
    if not edges:
        return
    faces = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=no)["geom"]
    slope, face = core.lin(core.REMAP.get(SLOPE_TONE, SLOPE_TONE)), core.lin(OUTER)
    layers = [bm.loops.layers.float_color.get(k) for k in ("Col", "Self", "Glow")]
    for f in faces:
        if not isinstance(f, bmesh.types.BMFace):
            continue
        if f.normal.dot(no) < 0:
            f.normal_flip()
        col = slope if (mw @ f.calc_center_median()).z < ZG - ARMOUR else face
        for lp in f.loops:
            for lay, val in zip(layers, (col, (0, 0, 0), (0, 0, 0))):
                if lay is not None:
                    lp[lay] = (*val, 1.0)



def art(f, planes, wide=False, look=BAY.PLAIN):
    """A near run's art for a front f ((s, c), c in 32nds, tile-local) cut to planes; wide: with a copy a tile either
    way along the run (its colours run on past the tile's edges, env_build "wide"). The tile's side on its front's
    side is no cut (the front is set in from it; what stands proud of the face may pass it)."""
    s2, c = f
    planes = [q for q in planes if (q[0].x, q[0].y, q[0].z) != (s2[0], s2[1], 0)]   # (not its own tile side: what
    off = (c - 15) / 32                                         # stands proud of the face runs past it; the run
                                                                # set's outline is c 15)
    objs = build(s2, look)
    along = (1, 0) if s2 == (0, 1) else (0, 1)
    if wide:                                                    # (the next tiles plain: whatever look they are,
        for kk in (-1, 1):                                      # they cover their own; past a hip, or by
            for ob in build(s2, BAY.PLAIN):                     # another look, a copy of this one's bay would show)
                ob.location = ob.location + core.G(kk * along[0], kk * along[1], 0.0)
                objs.append(ob)
    for ob in objs:
        ob.location = ob.location + core.G(s2[0] * off, s2[1] * off, 0.0)
    return cut(objs, planes)


DIAG = (-2, -1, 0, 1)               # (a diagonal's bays: run tiles from these, a bay a tile, each 32 px across as a run's)


def diag_art(f, planes, look=BAY.PLAIN):
    """A near diagonal's art (front f: ((1, 1), c)) cut to planes: the +y run's, frame left off (the diagonal paints
    its own: wall3d_belly_facet), a row of its tiles laid on the diagonal by p -> (x (1, -1) + y (1, 1)) / 2: its
    face and slope then lie on the diagonal's (its depth in s . p terms, as a diagonal's, hull_outline.deep), its art
    px a screen column each, its bays' ends on the tile's corners (where diagonal pieces meet, so they mix as a run's
    tiles)."""
    from mathutils import Matrix
    _, c = f
    lay = Matrix(((0.5, -0.5, 0.0, 0.0), (0.5, 0.5, 0.0, 0.0), (0.0, 0.0, 1.0, 0.0), (0.0, 0.0, 0.0, 1.0)))
    objs = []                                                   # (the map in Blender's axes, y flipped: core.G)
    for k in DIAG:                                              # (its own two bays in its look; the next, plain:
        for ob in build((0, 1), look if k in (-1, 0) else BAY.PLAIN, frame=False):     # art)
            ob.data.transform(Matrix.Translation(core.G(k + 0.5, (c - 15) / 32, 0.0)) @ ob.matrix_world)
            ob.data.transform(lay)                              # (baked: the cut takes an object's matrix as
            ob.matrix_world = Matrix.Identity(4)                # a rotation and an offset)
            objs.append(ob)
    return cut(objs, planes)
