"""The belly's straight runs (the cutaway hull, wall3d_belly), built as the exterior's are (wall3d_ext, wall3d_ext_t3):
the armour on wall3d_ext_geom's Section (its belly option: cut at the rim, upright, then the slope under the ship) and
Face, set out in front of the hull's own block as the exterior's (T3's BACK in), the block running back to the tile's
inner edge; dressed as hull 46's D3 look 1 with Face's helpers (painted seams and outlines with their lit bevel, the
top's seam), in art px from the face's +u end (hull 46's D3 measured from its left, mirrored, as T3's clamps).
Rendered as the exterior's runs: coverage anti-aliased (env_build.AA) and "wide"."""
import bmesh

from . import core
from . import factions_relief as FR
from . import wall3d as T
from . import wall3d_ext_t3 as T3
from .wall3d_ext_geom import D, E, LINE, PAINT, YS, Face, Section

RUNS = {(0, 1): "y", (1, 0): "x"}  # the near runs' fronts and their faces' axes (wall3d: the face's normal)
INNER, BOTTOM = "nvF3", YS[0]        # the block's back (the hull's inside) and bottom
XS, CREASE, RIM = "hbSoft", "hbCrease", "hbRim"     # hull 46 belly's soft seam and shade, the slope's
                                                     # seams (navy: the lip's edge on it too), its rim
LOOK1 = {                            # D3 look 1, art px: u from the face's +u end (centred on its 32), v down
    "side_seam": ((0, 7), (25, 32), 9),         # from the cut: a seam across each side plate (lit under it)
    "panel": ((7, 25), (8, 15)),                # the centre plate, a px proud, lit along its top, a px of shade under
    "lip": (4, 5, 1),                           # a plate the face's width on its foot, this tall and a px proud;
                                                # its middle (px in from each end) on down past the foot this far
    "slope_seam": ((7, 8), (24, 25)),           # seams down the slope, a px in from the plate's sides; one across it
    "slope_line": 5,                            # (px under its middle)
}


def section():
    from .wall3d_belly import ARMOUR, SLOPE, ZG
    return Section(ZG, T3.BACK, under=(ZG - ARMOUR, SLOPE[0], SLOPE[1]))


def build(s2):
    """The run along a near front s2 ((0, 1) or (1, 0)) of a tile whose outline is the run set's (c 15), whole."""
    ax, sec = RUNS[s2], section()
    k = T.Relief(f"belly_run_{ax}")
    plane = E - D - T3.BACK
    f = Face(k, ax, plane, -0.5, 0.5, ("cont", "cont"), sec)
    foot = sec.under[0]
    for z0, z1 in ((sec.zmin, foot), (foot, sec.H)):            # (the armour: not across its foot)
        f.block(-0.5, 0.5, z0, z1)
    back = -0.5 - plane                                         # (the tile's inner edge, d from the block's face)
    prof = [(back, sec.zmin), (0.0, sec.zmin), (0.0, sec.H), (back, sec.H)]
    FR.prism(k, ax, plane, -0.5, 0.5, prof, "steel", 3, [BOTTOM, None, T.CUT, INNER], YS[1])
    _look1(f, sec, back)
    return k.build()


def _look1(f, s, back):
    """D3 look 1 over the tile: the lit lip under the cut, the top's seams along its front and back, a seam across each
    side plate, the centre plate a px proud (lit along its top, a px of shade under it), the slope's
    rim, the lip on the face's foot (its shade on the slope under it), two seams down the slope and one across it."""
    def U(a, b):                                    # (px from the +u end -> u0, u1)
        return 0.5 - T3.px(b), 0.5 - T3.px(a)

    def Z(v):                                       # (px down from the cut -> height)
        return s.z_at(s.H, v)
    foot = s.under[0]
    with f.tag("lips"):
        f.line(-0.5, 0.5, Z(1), s.H, YS[4], bevel=False)
    with f.tag("seams"):
        *sides, v = LOOK1["side_seam"]
        for a, b in sides:
            f.line(*U(a, b), Z(v + 1), Z(v), CREASE)
        f.top_line(-0.5, 0.5, back + 2 * T3.TOP_PX, back + 2.75 * T3.TOP_PX, YS[2])    # (T3's, along the back)
    with f.tag("panel"):
        (a, b), (v0, v1) = LOOK1["panel"]
        u0, u1 = U(a, b)
        f.shade(u0, u1, Z(v1), Z(v1 - 2), YS[1], side=0.0)           # (under it only: the plate hides half)
        f.raised(u0, u1, Z(v1), Z(v0), -0.01, LINE, "face", cap=YS[2])     # (lit along its top by its facing)
        f.raised(u0, u1, Z(v0 + 1), Z(v0), LINE - 0.01, LINE + PAINT, col=YS[4])    # (painted on, as T3's bolts)
    with f.tag("lip"):                                          # (lit along its top by its facing)
        h, e, x = LOOK1["lip"]
        f.raised(-0.5, 0.5, foot, s.z_at(foot, -h), -0.01, LINE, "face", cap=YS[2])
        d, zb = s.front(foot, foot)[0][0], foot - x * (s.H - Z(1))     # (straight down, over the slope)
        prof = [(d - 0.01, zb), (d + LINE, zb), (d + LINE, foot), (d - 0.01, foot)]
        f.part(*U(e, 32 - e), prof, s.cols(prof, "face"), YS[2])
        for (a, b), n in (((0, e), 0), ((e, 32 - e), x + 1), ((32 - e, 32), 0)):  # (its edge on the slope under
            z0 = s.z_at(foot, n)                                                 # it, following its outline: 2 px,
            f.line(*U(a, b), s.z_at(z0, 2), z0, CREASE, bevel=False)            # it hides some; a px more under
                                                                                 # the part hanging past the foot)
    with f.tag("seams"):                                        # (down the slope)
        for a, b in LOOK1["slope_seam"]:
            f.line(*U(a, b), s.zmin, foot, CREASE, end=False, bevel=False)
        zm = s.z_at((s.zmin + foot) / 2, LOOK1["slope_line"])
        f.line(-0.5, 0.5, s.z_at(zm, 1), zm, CREASE, bevel=False)   # (across the slope, under its middle; its rim)
        f.line(-0.5, 0.5, s.zmin, s.z_at(s.zmin, -1), RIM, bevel=False)


def cut(objs, planes):
    """Objects cut to half-spaces (n . p <= c, tile units: the side past each plane cleared), in place."""
    for ob in objs:
        inv = ob.matrix_world.inverted()
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        for n, c in planes:
            nw = core.G(n.x, n.y, n.z)
            co = inv @ (nw * (c / n.length_squared))
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=co,
                                   plane_no=inv.to_3x3() @ nw, clear_outer=True)
        bm.to_mesh(ob.data)
        bm.free()
    return objs


def art(f, planes, wide=False):
    """A near run's art for a front f ((s, c), c in 32nds, tile-local) cut to planes; wide: with a copy a tile either
    way along the run (its colours run on past the tile's edges, env_build "wide"). The tile's side on its front's
    side is no cut (the front is set in from it; what stands proud of the face may pass it)."""
    s2, c = f
    planes = [q for q in planes if (q[0].x, q[0].y, q[0].z) != (s2[0], s2[1], 0)]   # (not its own tile side: what
    off = (c - 15) / 32                                         # stands proud of the face runs past it)                                         # (the run set's outline is c 15)
    objs = build(s2)
    along = (1, 0) if s2 == (0, 1) else (0, 1)
    if wide:
        for kk in (-1, 1):
            for ob in list(objs):
                cp = ob.copy()
                cp.data = ob.data.copy()
                cp.location = ob.location + core.G(kk * along[0], kk * along[1], 0.0)
                for col in ob.users_collection:
                    col.objects.link(cp)
                objs.append(cp)
    for ob in objs:
        ob.location = ob.location + core.G(s2[0] * off, s2[1] * off, 0.0)
    return cut(objs, planes)
