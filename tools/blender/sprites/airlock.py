"""Airlock (module.airlock), built 1:1 to the Space Haven reference: 3 wide along the hull, the hull row plus 3 rows
inboard (hullEdge n, rotates with the module like the engine), and a docking collar beyond the hull.

Module frame (cmbkit.Frame, footprint centre at u = v = 0 on the pod's tile): u points outward through the hull
(r0 north, r1 east, r2 south, r3 west), v along the hull. Tile roles:
  u = 2               the docking collar: short ringed tube, the round iris hatch (the outer door) at its mouth
  u = 1   (hull row)  v = 0: the outer door's hull tile, the collar's brace on it (airlock_insert); v = +-1: plain hull
  u = 0               v = 0: the pod (inner door facing inboard, windows on its sides); v = +-1: unloaders, back half
  u = -1              v = 0: walk zone (faint corner marks); v = +-1: unloaders, front half (chute facing inboard)
  u = -2              v = 0: walk zone; v = +-1: keep-out (faint painted square) in front of each chute

Measured on the reference (its tile about 165 px wide, the same 2:1 projection): the pod about 0.9 deep, a tile
wide, 1.45 tall, strongly rounded; the block a tile wide and about the pod's height under a 0.2 cap; the collar about
1.2 across, its mouth 0.7 past the block (its axis since lowered to ZC: airlock_insert); the unloaders about 1.9 long and 0.6 wide. Cream
bodies with red trim, slate block, grey collar with red bands. The pod and block are never cut in any wall view
level; the plain hull beside the block and over it follows the level like any hull.

Sprites, per rotation r (each anchored at its own tile so the renderer sorts it by that tile; footprint [1, 1]):
  module.airlock.housing.r<r>.<closed|f1|f2|open>     the pod and its inner door (opening frames f1, f2)
  module.airlock.hull.r<r>.<up|cut|low>               hull row (camera-facing rotations: base exterior hull over the door
                                                      tile and half of either neighbour, full height in every view, end
                                                      cuts, anchored at the row's front tile; far: the door tile's wall)
  module.airlock.hull.r<r>.<level>.tint               camera-facing rotations: the hull row's deco layer (as a hull piece's)
  module.airlock.end.r<r>                             camera-facing rotations: the hull row's end cuts alone (hull paint)
  module.airlock.brace.r<r>                           camera-facing rotations: the rib and clamp block over the hull's top
  module.airlock.light.r<r>.<red|green>               the cycle light in the slot on the pod's top
  module.airlock.collar.r<r>.<closed|f1|f2|open>[.docked]
                                                      collar, its clamp ring and the iris hatch (sort by the tile beyond
                                                      the hull row); a recessed iris, status lights red / green when docked;
                                                      docked: clamps on the shuttle hatch, seal light green
  module.airlock.unloader.r<r>.<back|front>           an unloader's two tiles (the same sprites on both sides)
  module.airlock.unloader.r<r>.front.loaded           the front tile with a crate on the chute's rollers
  module.airlock.keepout.r<r>                         the faint keep-out square in front of a chute
  module.airlock.walk.r<r>                            the walk zone's corner marks (both tiles in front of the pod)
                                                      (collar: airlock_collar; unloaders, keep-out and walk: airlock_inboard)
The collar's mating face (where a shuttle's hatch meets it) is COLLAR_END, 0.7 past the hull row's outer edge."""
import math

from . import core, env_build, post
from . import airlock_insert as INS
from . import walls as W
from .cmbkit import Frame
from .console_proto import centre

ID = "module.airlock"
DOORS = (("closed", 0.0), ("f1", 0.35), ("f2", 0.7), ("open", 1.0))
HULL_U, COLLAR_END = 1.0, 2.2
UI, UB = -0.42, 0.5                # pod: inboard face, back (against the block)
PW, PH, RC, RT = 0.46, 1.45, 0.2, 0.12    # pod half width, height, corner radius, top edge round-off
DW, DH = 0.25, 1.3                 # inner door half width, height
# Collar axis height (its mounting flange's top meets the exterior hull's slope where it starts: airlock_insert.SLOPE,
# 1.199 - (RR + 0.04)), hatch (bore) radius, mouth ring outer radius: a thin ring about 0.1 wide.
ZC, RH, RR = 0.539, 0.52, 0.62
CREAM, CREAM_T, CREAM_D, CREAM_S = "lvW", "lvWL", "lvW2", "lvWS"
RED = "medRed"
SLATE, SLATE_T, SLATE_K, SLATE_L = "hbD", "hbM", "hbK", "hbL"
GREY, GREY_T = "plate", "gW1"
HULL, HULL_T = "bM", "bL"
TINY = 0.004


def frame(m, rot):
    return Frame(m, rot, centre=centre(rot, 3, 3))


def strip(rot):
    """(inner, outer) u of the production hull strip on the hull row (walls.Strip puts it at the tile's -x / -y edge:
    the outer edge for a north / west hull, the inner edge for an east / south one)."""
    t = (math.floor(W.hull_thick() * W.GN - 0.5) + 1) / W.GN
    return (HULL_U - 0.5, HULL_U - 0.5 + t) if rot in (1, 2) else (HULL_U + 0.5 - t, HULL_U + 0.5)


def prism(f, shape, a, b, mat, top):
    """Extrude a u/z outline (clockwise) across v in [a, b] (both end faces)."""
    n = len(shape)
    A = [f.pt(u, a, z) for u, z in shape]
    B = [f.pt(u, b, z) for u, z in shape]
    f.poly(A, mat, flip=True)
    f.poly(B[::-1], mat, flip=True)
    for i in range(n):
        j = (i + 1) % n
        f.poly([A[i], B[i], B[j], A[j]], top if shape[j][0] > shape[i][0] else mat, flip=True)


def _clip(shape, lo, hi):
    """Clip a convex u/z outline to lo <= u <= hi (order kept)."""
    for keep, edge in ((lambda u: u >= lo, lo), (lambda u: u <= hi, hi)):
        out = []
        for i, (u0, z0) in enumerate(shape):
            u1, z1 = shape[(i + 1) % len(shape)]
            if keep(u0):
                out.append((u0, z0))
            if keep(u0) != keep(u1):
                t = (edge - u0) / (u1 - u0)
                out.append((edge, z0 + t * (z1 - z0)))
        shape = out
        if not shape:
            break
    return shape


def _face(f, pts, ref, color):
    """A polygon of (u, v, z) points wound to face away from the point ref."""
    from mathutils import Vector
    P = [Vector(f.pt(*q)) for q in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    c = sum(P, Vector()) / len(P)
    if n.dot(c - Vector(f.pt(*ref))) < 0:
        P = P[::-1]
    f.poly(P, color, flip=False)


def _tube(f, u0, u1, sec, col, top=None, cap=None, start=True):
    """Extrude a convex (v, z) section along u from u0 to u1. cap colours the end at u1 (None: open); start closes the
    end at u0 too."""
    vc = sum(v for v, _ in sec) / len(sec)
    zc = sum(z for _, z in sec) / len(sec)
    mid = ((u0 + u1) / 2, vc, zc)
    n = len(sec)
    for i in range(n):
        (va, za), (vb, zb) = sec[i], sec[(i + 1) % n]
        up = (zb + za) / 2 > zc and abs(zb - za) < 0.5 * abs(vb - va) + 1e-6
        _face(f, [(u0, va, za), (u1, va, za), (u1, vb, zb), (u0, vb, zb)], mid, (top or col) if up else col)
    if cap:
        _face(f, [(u1, v, z) for v, z in sec], (u0, vc, zc), cap)
    if start:
        _face(f, [(u0, v, z) for v, z in sec], (u1, vc, zc), col)


def _loft(f, rings, col, top, edge, red_all=(), red_top=()):
    """A convex solid through horizontal (u, v) rings [(points, z), ...] of equal length: sides in col, the last band
    (the round-off at the top) in edge, the top cap in top; side faces after the points in red_all are red in every
    band, those in red_top in the top band only."""
    pts = [(u, v, z) for ring, z in rings for u, v in ring]
    ref = tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))
    for k in range(len(rings) - 1):
        (ra, za), (rb, zb) = rings[k], rings[k + 1]
        last = k == len(rings) - 2
        for i in range(len(ra)):
            j = (i + 1) % len(ra)
            c = RED if i in red_all or (last and i in red_top) else edge if last else col
            _face(f, [(*ra[i], za), (*ra[j], za), (*rb[j], zb), (*rb[i], zb)], ref, c)
    _face(f, [(u, v, rings[0][1]) for u, v in rings[0][0]], ref, col)
    _face(f, [(u, v, rings[-1][1]) for u, v in rings[-1][0]], ref, top)


def _rrect(u0, u1, v0, v1, r, n=3):
    """Counter-clockwise (u, v) rectangle with corner radii r = (r00, r10, r11, r01) at (u0,v0), (u1,v0), (u1,v1),
    (u0,v1); each corner gets n + 1 points (side faces 4c..4c+2 are corner c's arc, 4c+3 the straight side after it:
    3 at v0, 7 at u1, 11 at v1, 15 at u0)."""
    out = []
    for (cu, cv, su, sv, a0), rad in zip(((u0, v0, -1, -1, 180), (u1, v0, 1, -1, 270), (u1, v1, 1, 1, 0),
                                          (u0, v1, -1, 1, 90)), r):
        rad = max(rad, TINY)
        ou, ov = cu - su * rad, cv - sv * rad
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            out.append((ou + rad * math.cos(a), ov + rad * math.sin(a)))
    return out


def _arch(vh, zt, r, n=4):
    """(v, z) path up the left side, over a round-cornered top, down the right: an arch of half width vh, top zt."""
    p = [(-vh, 0.0)]
    for k in range(n + 1):
        a = math.radians(180 - 90 * k / n)
        p.append((-vh + r + r * math.cos(a), zt - r + r * math.sin(a)))
    for k in range(n + 1):
        a = math.radians(90 - 90 * k / n)
        p.append((vh - r + r * math.cos(a), zt - r + r * math.sin(a)))
    p.append((vh, 0.0))
    return p


def _arch_band(f, u0, u1, outer, inner, col):
    for i in range(len(outer) - 1):
        _tube(f, u0, u1, [outer[i], outer[i + 1], inner[i + 1], inner[i]], col, col, cap=col)


# ---- the pod ------------------------------------------------------------------------------------------------------

def _pod(f):
    """Two rounded columns and a lintel: a cream capsule with the door through it. Red on all four rounded vertical
    edges and over the front and back top edges; the sides' top edges stay cream."""
    for s in (-1, 1):
        v0, v1 = (DW, PW) if s > 0 else (-PW, -DW)
        r = (TINY, TINY, RC, RC) if s > 0 else (RC, RC, TINY, TINY)
        ri = tuple(max(x - RT, TINY) for x in r)
        lo = _rrect(UI, UB, v0, v1, r)
        hi = _rrect(UI + RT, UB - RT, v0 if s > 0 else v0 + RT, v1 - RT if s > 0 else v1, ri)
        arcs = {8, 9, 10, 12, 13, 14} if s > 0 else {0, 1, 2, 4, 5, 6}
        _loft(f, [(lo, 0.0), (lo, PH - RT), (hi, PH)], CREAM, CREAM_T, CREAM_T, red_all=arcs, red_top={7, 15})
    lo = _rrect(UI, UB, -DW, DW, (TINY,) * 4)
    hi = _rrect(UI + RT, UB - RT, -DW, DW, (TINY,) * 4)
    _loft(f, [(lo, DH), (lo, PH - RT), (hi, PH)], CREAM, CREAM_T, CREAM_T, red_top={7, 15})
    for s in (-1, 1):
        f.box((UI + UB) / 2 + 0.02, s * (DW - 0.01), 0, UB - UI - 0.04, 0.02, DH, "dark", top="dark")   # liner
        f.box((UI + UB) / 2, s * (PW + 0.006), 0.04, UB - UI - 2 * RC, 0.012, 0.07, RED, top=RED)     # red base
    f.box((UI + UB) / 2 + 0.02, 0, DH - 0.02, UB - UI - 0.04, 2 * DW, 0.02, "dark", top="dark")


def _door_frame(f):
    """The thick round-cornered frame round the door, proud of the face, a darker groove inside it, and gussets
    filling the opening's top corners."""
    _arch_band(f, UI - 0.03, UI + 0.01, _arch(DW + 0.1, DH + 0.09, 0.2), _arch(DW + 0.025, DH + 0.02, 0.14), CREAM_T)
    _arch_band(f, UI - 0.02, UI + 0.01, _arch(DW + 0.025, DH + 0.02, 0.14), _arch(DW, DH, 0.12), CREAM_S)
    inner = _arch(DW, DH, 0.12)
    for s, arc in ((-1, inner[1:6]), (1, inner[6:11])):
        for a, b in zip(arc, arc[1:]):
            _tube(f, UI - 0.01, UI + 0.08, [(s * DW, DH), a, b], CREAM_T, CREAM_T, cap=CREAM_T)


def _leaves(f, uc, p):
    """Two leaves meeting in the middle, sliding into the columns (p = how far open, 0..1): red status dots and a
    red slot on the left leaf, a small window low on the right one."""
    if p >= 1.0:
        return
    w = DW * (1 - p)
    for s in (-1, 1):
        vc = s * (DW - w / 2)
        f.box(uc, vc, 0, 0.06, w, DH, CREAM_D, top=CREAM_D)
        f.box(uc - 0.02, s * (DW - w) + s * 0.01, 0.02, 0.045, 0.02, DH - 0.04, CREAM_S, top=CREAM_S)   # edge
        if w < 0.12:
            continue
        e = s * (DW - w)                                                                         # meeting edge
        if s < 0:
            for dv, dz in ((0.05, 0), (0.1, 0.05), (0.05, 0.1), (0.1, 0.15)):
                f.box(uc - 0.033, e - dv, 1.0 + dz, 0.006, 0.04, 0.04, RED, top=RED)            # status dots
            f.box(uc - 0.033, e - 0.09, 0.74, 0.006, 0.12, 0.06, RED, top=RED)                  # slot
        else:
            f.box(uc - 0.033, e + 0.1, 0.18, 0.006, 0.13, 0.28, "dark", top="dark")             # window
            f.box(uc - 0.036, e + 0.12, 0.24, 0.004, 0.05, 0.12, CREAM_T, top=CREAM_T)


def housing(rot, p):
    m = core.Mesh(f"airlock_housing_{rot}")
    f = frame(m, rot)
    _pod(f)
    _door_frame(f)
    for s in (-1, 1):                                                                            # side faces
        f.box(0.08, s * (PW + 0.006), 0.6, 0.36, 0.012, 0.52, CREAM_S, top=CREAM_S)              # window frame
        f.box(0.08, s * (PW + 0.01), 0.64, 0.3, 0.008, 0.44, "dark", top="dark")                 # window
        f.box(0.06, s * (PW + 0.008), 0.48, 0.3, 0.008, 0.035, "dark", top="dark")              # slot under
        for k in range(3):                                                                       # vents
            f.box(-0.18, s * (PW + 0.008), 0.78 + k * 0.08, 0.08, 0.008, 0.03, CREAM_S, top=CREAM_S)
    for du, dv, su, sv in ((-0.28, 0, 0.02, 0.26), (-0.04, 0, 0.02, 0.26), (-0.16, -0.12, 0.26, 0.02),
                           (-0.16, 0.12, 0.26, 0.02)):                                           # hatch outline on top
        f.box(du, dv, PH, su, sv, 0.012, CREAM_S, top=CREAM_S)
    f.box(0.2, 0, PH, 0.1, 0.38, 0.012, "dark", top="dark")                                         # light slot
    uc = UI + 0.1
    for k in range(6):                                                                           # threshold
        c = "hazY" if k % 2 else "hazK"
        f.box(uc - 0.06, -DW + (k + 0.5) * (2 * DW / 6), 0, 0.12, 2 * DW / 6, 0.012, c, top=c)
    _leaves(f, uc, p)
    return [m.build()]


def lights(rot, color):
    m = core.Mesh(f"airlock_light_{rot}")
    f = frame(m, rot)
    f.box(0.2, 0, PH + 0.008, 0.07, 0.34, 0.012, color, top=color)                                 # lit slot
    return [m.build()]


# ---- the hull row -------------------------------------------------------------------------------------------------

NEAR = {1: 2, 2: 1}      # rotations whose hull row faces the camera: the exterior hull's straight run (o) there
HULL_PAL = "walls+hull"  # the palette of the hull row, brace and collar (the exterior hull's own colours)


def _ext_tiles(rot, ks=(0,)):
    """The base exterior hull's straight run (wall3d_ext) on the hull row: its tiles k along the run from the door's,
    placed in the airlock frame."""
    from . import wall3d as T
    from . import wall3d_ext as X
    o = NEAR[rot]
    mask = 5 if o == 2 else 10
    dx, dy = X.STRAIGHT[(mask, o)]
    at = frame(None, rot).pt(HULL_U, 0, 0)
    was, T.VARIANT = T.VARIANT, (0, 0)
    try:
        out = []
        for k in ks:
            for ob in X.ext_block(mask, o):
                ob.location = ob.location + at + core.G(k * dx, k * dy, 0.0)
                out.append(ob)
    finally:
        T.VARIANT = was
    return out


FRONT_V = {1: 1, 2: -1}  # camera-facing rotations: v of the hull row's front tile (the hull sprites' anchor)
ROW = (-1, 0, 1)
HALF = 1.0               # the full-height run's half length along the hull: the door tile and half of either neighbour


def _run(rot):
    """The world vector of one tile along the hull run (+v of the row's tile order)."""
    from . import wall3d_ext as X
    o = NEAR[rot]
    dx, dy = X.STRAIGHT[(5 if o == 2 else 10, o)]
    return core.G(dx, dy, 0.0)


def _end_cut(rot, row):
    """The black end cut closing the full-height run at either end, HALF along it from the door tile's centre
    (hull_engine.end_cut, as the engine's)."""
    from . import hull_engine as HE
    return HE.end_cut(NEAR[rot], row, ends=(-HALF, HALF), origin=frame(None, rot).pt(HULL_U, 0, 0))


def _trim(rot, objs):
    """The row's objects cut to the run: what lies more than HALF along it from the door tile's centre removed."""
    import bmesh
    from mathutils import Vector
    rv = _run(rot)
    at = Vector(frame(None, rot).pt(HULL_U, 0, 0))
    for ob in objs:
        if ob.type != "MESH":
            continue
        inv = ob.matrix_world.inverted()
        n = (inv.to_3x3() @ rv).normalized()
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        for s, outer in ((HALF, True), (-HALF, False)):
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=inv @ (at + rv * s), plane_no=n,
                                   clear_outer=outer, clear_inner=not outer)
        bm.to_mesh(ob.data)
        bm.free()
    return objs


def hull(rot, level):
    """The hull row. Facing the camera: as the engine's hull row, the base exterior hull stands full height in every view
    without a roof (the whole assembly shows: the brace and collar stand on it) over the door tile and half of either
    neighbour (HALF), closed at either end by the end cut; anchored at the row's front tile (FRONT_V) so it sorts over its neighbours' cut tops. Far (north /
    west): the door tile's hull wall on the production profile (strip, sloped skirt, 2.05 top) as the level shows the
    plain hull either side, full in up and cut, else the ghost rim."""
    if rot in NEAR:
        row = _ext_tiles(rot, ROW)
        cut = _end_cut(rot, row)
        return _trim(rot, row) + [cut]
    m = core.Mesh(f"airlock_hull_{rot}_{level}")
    f = frame(m, rot)
    inner, outer = strip(rot)
    if level != "low":
        zs, run, top = W.skirt_top(), W.skirt_run(), W.hull_top()
        edge = HULL_U - 0.5
        ze = max(0.0, zs * (1 - (inner - edge) / run))
        shape = [(edge, 0), (edge, ze), (inner, zs), (inner, top), (outer, top), (outer, 0)]
    else:
        shape = [(inner, 0), (inner, W.ZG), (outer, W.ZG), (outer, 0)]
    prism(f, shape, -0.5, 0.5, HULL, HULL_T)
    return [m.build()]


def end(rot):
    """module.airlock.end.r<r> ("over"): the row's end cut alone, its px where it is in front of the hull row; drawn over
    the hull sprite in the hull's paint (its black then matches the belly cut tops round it), as the engine's."""
    row = _ext_tiles(rot, ROW)
    cut = _end_cut(rot, row)
    return [cut], _trim(rot, row) + [cut]


def brace(rot):
    """("over") the rib and clamp block, their px where they are in front of the hull row."""
    own = INS.brace(rot)
    return own, own + _ext_tiles(rot, (-1, 0, 1))


# ---- sprites ------------------------------------------------------------------------------------------------------

def _item(sid, kind, objs, u, v, rot):
    """Render objs with the tile at (u, v) as the sprite origin. objs (own, wide) renders "over": own's px where it is
    in front of the rest of wide."""
    x, y = frame(None, rot).xy(u, v)
    if isinstance(objs, tuple):
        kind, every = "over", list({id(o): o for o in objs[1] + objs[0]}.values())
    else:
        every = objs
    for o in every:
        o.location = (o.location.x - x, o.location.y + y, o.location.z)
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, kind, objs))
    return [it] if it else []


def _hull_items(sid, rot, level):
    """A camera-facing hull row rendered as the hull's own pieces are (hulltiles: the hull palette, and its deco layer
    <sid>.tint, which the game tints with the ship's deco colour over the armour), anchored at the row's front tile."""
    from . import hulltiles as HT
    from . import wall3d_ext as X
    x, y = frame(None, rot).xy(HULL_U, FRONT_V[rot])

    def build():
        objs = hull(rot, level)
        for o in objs:
            o.location = (o.location.x - x, o.location.y + y, o.location.z)
        return objs
    return HT._items(sid, "block", build, X.TINT, True)


def items(rot):
    from . import airlock_collar as CO       # (imported here: they build on this module's frame and colours)
    from . import airlock_inboard as IN
    post.select(True)
    out = []

    def add(sid, kind, build, u, v=0.0, pal=True):
        post.select(pal)                       # (the hull row and collar: with the exterior hull's colours)
        core.clear_scene_meshes()
        out.extend(_item(sid, kind, build(), u, v, rot))
    for name, p in DOORS:
        add(f"{ID}.housing.r{rot}.{name}", "block", lambda p=p: housing(rot, p), 0)
        for docked in (False, True):
            add(f"{ID}.collar.r{rot}.{name}" + (".docked" if docked else ""), "prop",
                lambda p=p, d=docked: CO.collar(rot, p, d), HULL_U + 1, pal=HULL_PAL)
    for lv in W.LEVELS:
        if rot in NEAR:
            out.extend(_hull_items(f"{ID}.hull.r{rot}.{lv}", rot, lv))
        else:
            add(f"{ID}.hull.r{rot}.{lv}", "block", lambda lv=lv: hull(rot, lv), HULL_U, pal=HULL_PAL)
    if rot in NEAR:
        add(f"{ID}.end.r{rot}", "over", lambda: end(rot), HULL_U, FRONT_V[rot], pal=HULL_PAL)
        add(f"{ID}.brace.r{rot}", "over", lambda: brace(rot), HULL_U, FRONT_V[rot], pal=HULL_PAL)
    for col in ("red", "green"):
        add(f"{ID}.light.r{rot}.{col}", "fx", lambda c=col: lights(rot, c), 0)
    add(f"{ID}.unloader.r{rot}.back", "prop", lambda: IN.unloader(rot, "back"), 0, IN.UV)
    add(f"{ID}.unloader.r{rot}.front", "prop", lambda: IN.unloader(rot, "front"), -1, IN.UV)
    add(f"{ID}.unloader.r{rot}.front.loaded", "prop", lambda: IN.unloader(rot, "front", True), -1, IN.UV)
    add(f"{ID}.keepout.r{rot}", "block", lambda: IN.keepout(rot), -2, IN.UV)
    add(f"{ID}.walk.r{rot}", "block", lambda: IN.walk(rot), -1, 0)
    return out


def jobs():
    return [lambda r=r: items(r) for r in range(4)]
