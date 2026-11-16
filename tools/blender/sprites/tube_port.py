"""The prefab base tube's hull port (issue #508, study): where the glass tube (tube_study) meets a module's exterior hull
wall, built as the engine's thruster block is (hull_engine): an armoured block standing out of the hull's straight run,
from under the hull's top down to the ground, a round port right through it (the hull's door shows
through) with a raised collar the tube seats in, bolts round it, two shoulders over the hull's top tying it in. Drawn "over": its px only where it is in front
of the hull row it stands on, so the hull's own pieces stay as they are.

Frame as hull_engine's (d out from the hull tiles' middle line, r along the run, z up), but the port's axis on the
door tile's centre line, not on the edge between two tiles. Unpainted steel, hull_engine's ramp."""
import math

from . import core
from . import hull_engine as HE
from . import wall3d as T
from . import wall3d_ext as X

AXIS, RS = 0.78, 0.88                  # the port: the tube's axis height and radius (its walkway flush with the
                                       # rooms' floor, z 0: tube_study)
W = 1.0                                # the block's half width along the run (the port and a rim; the full-height
                                       # hull run behind it is the door tile and half of either neighbour, 1.0)
DF, ZT, C = HE.DF, HE.ZT, HE.C
ZF = AXIS - RS - 0.15                  # its foot: under the ground, clipped there (clip_ground) with the port's bottom
RD = DF                                # the port's depth: right through the block (the door shows through it)
COLLAR = HE.COLLAR
N = HE.N
RAMP = HE.RAMP


def _rect(c, s):
    """Where a ray from the port's axis at (c, s) leaves the front's flat rectangle (inside its chamfers), as (r, z)."""
    t = min(W / abs(c) if abs(c) > 1e-9 else math.inf,
            (ZT - C - AXIS) / s if s > 1e-9 else (AXIS - ZF - C) / -s if s < -1e-9 else math.inf)
    return c * t, AXIS + s * t


def _collar(b):
    """The port's raised collar (hull_engine's): a light front ring with a dark outer lip, its rim and its inner face."""
    w, h = COLLAR
    for i in range(N):
        t0, t1 = math.tau * i / N, math.tau * (i + 1) / N
        c0, s0, c1, s1 = math.cos(t0), math.sin(t0), math.cos(t1), math.sin(t1)
        ring = lambda r, d, c, s: (d, r * c, AXIS + r * s)  # noqa: E731
        for r0, r1, col in ((RS, RS + w - HE.LIP, RAMP[5]), (RS + w - HE.LIP, RS + w, "steelD")):
            b.face([ring(r0, DF + h, c0, s0), ring(r1, DF + h, c0, s0), ring(r1, DF + h, c1, s1),
                    ring(r0, DF + h, c1, s1)], (1, 0, 0), col)
        b.face([ring(RS + w, DF + h, c0, s0), ring(RS + w, DF, c0, s0), ring(RS + w, DF, c1, s1),
                ring(RS + w, DF + h, c1, s1)], (0, c0 + c1, s0 + s1), "steelD")
        b.face([ring(RS, DF, c0, s0), ring(RS, DF + h, c0, s0), ring(RS, DF + h, c1, s1), ring(RS, DF, c1, s1)],
               (0, -(c0 + c1), -(s0 + s1)), RAMP[0])


def _builder(o, name):
    """hull_engine's builder; o 8 (a wall facing -x, away from the camera: the near module's end of the tube) on a frame
    of its own, d out along -x, the axis on the origin (not half a tile back as hull_engine's)."""
    b = HE._Builder(2 if o == 8 else o, name)
    if o == 8:
        b.pt = lambda d, r, z: core.G(-d, r, z)
    return b


def housing(o):
    """The block, one mesh, at hull_engine's frame (the port's axis half a tile back along the run from the origin; o 8:
    _builder's, on it)."""
    b = _builder(o, f"tube_port_{o}")
    prof = [(0.0, ZF), (DF - C, ZF), (DF, ZF + C), (DF, ZT - C), (DF - C, ZT), (0.0, ZT)]
    b.prism(prof, -W, W, skip=(2, 5))                   # (its front and back: below, with the port)
    ts = {math.tau * i / N for i in range(N)}
    for zc in (ZF + C, ZT - C):                         # (the front's corners, so its edges stay straight)
        for rc in (-W, W):
            ts.add(math.atan2(zc - AXIS, rc) % math.tau)
    ts = sorted(ts)
    for t0, t1 in zip(ts, ts[1:] + ts[:1]):
        c0, s0, c1, s1 = math.cos(t0), math.sin(t0), math.cos(t1), math.sin(t1)
        (r0, z0), (r1, z1) = _rect(c0, s0), _rect(c1, s1)
        p0, p1 = (RS * c0, AXIS + RS * s0), (RS * c1, AXIS + RS * s1)
        b.face([(DF, *p0), (DF, r0, z0), (DF, r1, z1), (DF, *p1)], (1, 0, 0))
        b.face([(0.0, *p0), (0.0, r0, z0), (0.0, r1, z1), (0.0, *p1)], (-1, 0, 0))   # (its back: seen on a far wall)
        b.face([(DF, *p0), (DF - RD, *p0), (DF - RD, *p1), (DF, *p1)], (0, -(c0 + c1), -(s0 + s1)), RAMP[0])
    for z0, z1 in ((ZF, ZF + C), (ZT - C, ZT)):         # the back's strips past the front's chamfers
        b.face([(0.0, -W, z0), (0.0, W, z0), (0.0, W, z1), (0.0, -W, z1)], (-1, 0, 0))
    _collar(b)
    for i in range(8):                                  # bolts round the collar, and at the front's corners
        t = math.tau * (i + 0.5) / 8
        rr = RS + COLLAR[0] / 2
        HE._box(b, DF + COLLAR[1], rr * math.cos(t), AXIS + rr * math.sin(t), 0.015)
    for r in (-W + 0.1, W - 0.1):
        for z in (0.12, ZT - C - 0.1):
            HE._box(b, DF, r, z, 0.02)
    zb = HE.H + HE.SH - 0.04                            # shoulders over the hull's top (the engine's, plain)
    shoulder = [(-0.5, ZT - 0.05), (HE.SF, ZT - 0.05), (HE.SF, zb), (HE.SF - 0.04, HE.H + HE.SH), (-0.5, HE.H + HE.SH)]
    for r0, r1 in HE.SHOULDERS:
        b.prism(shoulder, r0, r1)
        b.prism([(-0.42, HE.H + HE.SH), (HE.SF - 0.18, HE.H + HE.SH), (HE.SF - 0.18, HE.H + HE.SH + 0.03),
                 (-0.42, HE.H + HE.SH + 0.03)], r0 + 0.06, r1 - 0.06, lift=1)
    c = math.sqrt(RS * RS - AXIS * AXIS)                # the walkway through the port, at the floor
    b.face([(0.0, -c, 0.002), (DF + COLLAR[1], -c, 0.002), (DF + COLLAR[1], c, 0.002), (0.0, c, 0.002)], (0, 0, 1),
           RAMP[4])
    return clip_ground(b.m.build())


def clip_ground(ob):
    """The mesh cut at the ground (z 0): what lies under it removed (the base sits on rock; drawn, it would hang under
    the ground's plane on screen)."""
    import bmesh
    import bpy
    from mathutils import Vector
    bpy.context.view_layer.update()
    inv = ob.matrix_world.inverted()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6,
                           plane_co=inv @ Vector((0.0, 0.0, 0.0)), plane_no=(inv.to_3x3() @ Vector((0, 0, 1))),
                           clear_inner=True)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def piece(o, at=(0.0, 0.0)):
    """(own, wide) for an "over" sprite: the block and the five hull tiles of the run round the door tile, the door
    tile's centre at grid offset `at` from the sprite's origin. o 8 (the wall faces away: the module's wall, drawn after
    it, covers what lies behind): the block alone, (own, own)."""
    if o == 8:
        own = housing(o)
        own.location = own.location + core.G(at[0], at[1], 0.0)
        return [own], [own]
    mask = 5 if o == 2 else 10
    dx, dy = X.STRAIGHT[(mask, o)]
    was, T.VARIANT = T.VARIANT, (0, 0)
    try:
        hull = []
        for k in (-2, -1, 0, 1, 2):
            for ob in X.ext_block(mask, o):
                ob.location = ob.location + core.G(at[0] + k * dx, at[1] + k * dy, 0.0)
                hull.append(ob)
    finally:
        T.VARIANT = was
    own = housing(o)
    own.location = own.location + core.G(at[0] + 0.5 * dx, at[1] + 0.5 * dy, 0.0)   # (its axis onto the door tile)
    return [own], [own] + hull


def through(o, at=(0.0, 0.0), is_open=False):
    """What the port shows roofed (the hull's door tile cut through behind it): (inside, mouth). inside: the bore's
    walls on through the hull tile, the corridor door (closed or open) in the hull's wall line, the room's dark behind;
    mouth: a disc over the collar's mouth, its px the ones the inside shows in."""
    from . import door_block as DB
    mask = 5 if o == 2 else 10
    dx, dy = X.STRAIGHT[(mask, o)]
    d = DB.door("y" if o == 2 else "x", is_open, leaf="halves", look="metal")
    for ob in d:
        ob.location = ob.location + core.G(at[0], at[1], 0.0)
    b, m = HE._Builder(o, f"tube_port_bore_{o}"), HE._Builder(o, f"tube_port_mouth_{o}")
    ts = [math.tau * i / N for i in range(N)]
    ring = lambda d, t: (d, RS * math.cos(t), AXIS + RS * math.sin(t))   # noqa: E731
    for t0, t1 in zip(ts, ts[1:] + ts[:1]):
        b.face([ring(0.0, t0), ring(-0.5, t0), ring(-0.5, t1), ring(0.0, t1)],
               (0, -(math.cos(t0) + math.cos(t1)), -(math.sin(t0) + math.sin(t1))), RAMP[0])
    b.face([ring(-0.6, t) for t in ts], (1, 0, 0), "hsXK")
    c = math.sqrt(RS * RS - AXIS * AXIS)
    b.face([(-0.6, -c, 0.002), (0.0, -c, 0.002), (0.0, c, 0.002), (-0.6, c, 0.002)], (0, 0, 1), RAMP[4])
    m.face([ring(DF + COLLAR[1], t) for t in ts], (1, 0, 0), "hsXK")
    out = []
    for x in (b, m):
        ob = clip_ground(x.m.build())
        ob.location = ob.location + core.G(at[0] + 0.5 * dx, at[1] + 0.5 * dy, 0.0)
        out.append(ob)
    return [*d, out[0]], out[1]
