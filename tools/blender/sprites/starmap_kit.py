"""Starmap art kit (family `starmap`): the screen frame, raw faces, spheres and rings, seeded noise and the fixed-frame render
that starmap_bodies, starmap_icons and starmap_fleets build on.

Screen frame (as fxkit): a point (u, v, w) is the Blender point u * R + v * U + w * N (R screen-right, U screen-up, N towards
the camera). Sizes are written in 1x art px and converted by `px` (1 px at 1x = 1 / 45.25 world units), so a model renders
at twice the pixels at ART_SCALE 2 with the same world geometry.

Faces carry raw linear (col, self, glow) triples instead of palette names, so a body can light itself with its own bands
(`flat`), glow at a chosen strength (`selflit`) or take the scene's sun like the ships (`lit`). Halo meshes (`glow_only`) are
hidden in the colour pass and show only on the glow sheet.

Every sprite renders into a fixed W x H frame with the world origin at its centre (`frame_item`): the anchor is the frame's
centre, so the map can scale and place a sprite without knowing what was drawn."""
import math

import numpy as np
from mathutils import Vector

from . import core, post
from .scale import ART_SCALE

R = Vector(core._R.tolist())
U = Vector(core._U.tolist())
N = Vector((0.6123724, -0.6123724, 0.5))
UPW = Vector((0.0, 0.0, 1.0))                       # world up
PX = 1.0 / (64 / math.sqrt(2))                       # world units per 1x art px
DETAIL = 1                                           # face-count multiplier of spheres and annuli (backdrop bodies raise it)


def px(n):
    return n * PX


def P(u, v, w=0.0):
    """Screen-frame point (u right, v up, w towards the camera), in world units."""
    return R * u + U * v + N * w


def lin(name):
    return core.lin(name)


def scaled(c, k):
    return tuple(x * k for x in c)


def flat(name):
    """An unlit face in exactly this palette colour (the body shades itself)."""
    return (0, 0, 0), lin(name), (0, 0, 0)


def selflit(name, glow=1.0):
    """A self-lit face in this palette colour that also feeds the glow sheet at `glow` strength."""
    c = lin(name)
    return (0, 0, 0), c, scaled(c, glow)


def lit(name):
    """A face lit by the scene sun, like the ships."""
    return lin(name), (0, 0, 0), (0, 0, 0)


def glow_only(rgb):
    """A face that only draws on the glow sheet (linear rgb); put it in a `halo` mesh."""
    return (0, 0, 0), (0, 0, 0), tuple(rgb)


def hue(name, level):
    """Linear rgb of a palette colour normalised to max channel 1, times level: a glow of that hue at a chosen strength."""
    c = lin(name)
    m = max(c) or 1.0
    return tuple(x / m * level for x in c)


def face(m, pts, look):
    """Append a polygon (Blender points) with a raw (col, self, glow) look to a core.Mesh."""
    base = len(m.v)
    m.v += [tuple(p) for p in pts]
    m.f.append((list(range(base, base + len(pts))), *look))


def basis(axis):
    """Two unit vectors perpendicular to axis (and to each other)."""
    a = Vector(axis).normalized()
    e1 = a.cross(N) if a.cross(N).length > 1e-3 else a.cross(R)
    e1.normalize()
    return e1, a.cross(e1).normalized()


def sphere(m, c, r, paint, axis=U, segs=96, rings=64):
    """Sphere at Blender point c, poles along axis. paint(normals (k,3) array) -> k looks, one per face (vectorised, so
    noise and banding are computed for every face at once); None leaves that face out."""
    a = Vector(axis).normalized()
    e1, e2 = basis(a)
    segs, rings = segs * DETAIL, rings * DETAIL
    lat = np.linspace(-math.pi / 2, math.pi / 2, rings + 1)
    lon = np.linspace(0, math.tau, segs + 1)
    E = np.array([e1, e2, a], float)

    def d(i, j):
        return (math.cos(lat[i]) * math.cos(lon[j]), math.cos(lat[i]) * math.sin(lon[j]), math.sin(lat[i]))
    quads, ns = [], []
    for i in range(rings):
        for j in range(segs):
            q = [d(i, j), d(i + 1, j), d(i + 1, j + 1), d(i, j + 1)]
            if i == 0:
                q = [q[0], q[1], q[2]]
            elif i == rings - 1:
                q = [q[0], q[1], q[3]]
            loc = np.array(q)
            quads.append(loc @ E)
            n = loc.mean(0) @ E
            ns.append(n / np.linalg.norm(n))
    looks = paint(np.array(ns))
    cv = np.array(c, float)
    for q, look in zip(quads, looks):
        if look is not None:                        # a paint may leave faces out (a cloud layer)
            face(m, [Vector(cv + p * r) for p in q], look)


def annulus(m, c, axis, r0, r1, paint, segs=96, rings=1, a0=0.0, a1=math.tau, e=None):
    """A flat ring round c in the plane normal to axis, r0..r1, split into rings x segs faces from angle a0 to a1 (measured
    from e, default the first basis vector). paint(radius fraction (k,), angle (k,), centre points (k,3)) -> k looks (None leaves
    that face out)."""
    e1, e2 = basis(axis) if e is None else (Vector(e).normalized(), Vector(axis).normalized().cross(Vector(e)).normalized())
    segs = segs * DETAIL
    rs = np.linspace(r0, r1, rings + 1)
    an = np.linspace(a0, a1, segs + 1)
    cv = Vector(c)

    def pt(r, t):
        return cv + (e1 * math.cos(t) + e2 * math.sin(t)) * r
    polys, fr, ang, mid = [], [], [], []
    for i in range(rings):
        for j in range(segs):
            polys.append([pt(rs[i], an[j]), pt(rs[i + 1], an[j]), pt(rs[i + 1], an[j + 1]), pt(rs[i], an[j + 1])])
            rm, tm = (rs[i] + rs[i + 1]) / 2, (an[j] + an[j + 1]) / 2
            fr.append((rm - r0) / max(r1 - r0, 1e-9))
            ang.append(tm)
            mid.append(tuple(pt(rm, tm)))
    looks = paint(np.array(fr), np.array(ang), np.array(mid))
    for q, look in zip(polys, looks):
        if look is not None:                        # a paint may leave faces out (a ragged edge)
            face(m, q, look)


def disc(m, c, r, look, segs=96):
    """A camera-facing filled disc (one polygon) at Blender point c."""
    face(m, [c + (R * math.cos(k * math.tau / segs) + U * math.sin(k * math.tau / segs)) * r for k in range(segs)], look)


def streak(m, p0, p1, w0, w1, look):
    """A camera-facing ribbon from p0 to p1 (Blender points), width w0 tapering to w1."""
    d = p1 - p0
    if d.length < 1e-9:
        return
    s = N.cross(d).normalized()
    face(m, [p0 - s * (w0 / 2), p1 - s * (w1 / 2), p1 + s * (w1 / 2), p0 + s * (w0 / 2)], look)


class Noise:
    """Seeded 3D value noise on a wrapped lattice (numpy only, so renders repeat)."""

    def __init__(self, seed, n=32):
        self.g = np.random.default_rng(seed).random((n, n, n))
        self.n = n

    def __call__(self, p):
        p = np.asarray(p, float)
        i = np.floor(p).astype(int)
        f = p - i
        f = f * f * (3 - 2 * f)
        n, g = self.n, self.g
        out = 0.0
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                    out = out + w * g[(i[..., 0] + dx) % n, (i[..., 1] + dy) % n, (i[..., 2] + dz) % n]
        return out

    def fbm(self, p, octaves=3):
        """Fractal sum in 0..1 (about 0.5 mean)."""
        p = np.asarray(p, float)
        tot, amp, norm = 0.0, 1.0, 0.0
        for k in range(octaves):
            tot = tot + amp * self(p * (2 ** k) + k * 7.31)
            norm += amp
            amp *= 0.5
        return tot / norm


def prism(m, outline, z0, z1, side, top=None, inset=0.0, bottom=True):
    """An upright block: the ground outline [(x, y)] (Blender space, either winding) extruded from z0 to z1, its top
    outline pulled towards the centroid by `inset` (0..1) for a bevel or a taper (1 makes a pyramid). Palette names: side,
    top (default side); faces go through core.Mesh's own lighting (lit, or emissive for neon names)."""
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    lo = [Vector((x, y, z0)) for x, y in outline]
    hi = [Vector((cx + (x - cx) * (1 - inset), cy + (y - cy) * (1 - inset), z1)) for x, y in outline]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        m.poly([lo[i], lo[j], hi[j], hi[i]], side)
    if inset < 1:
        m.poly(hi, top or side)
    if bottom:
        m.poly(lo[::-1], side)


def screen_heading(deg):
    """Blender ground heading (radians) whose three-quarter projection points deg degrees clockwise from screen east."""
    t = math.radians(deg)
    sx, sd = math.cos(t), math.sin(t)                       # screen right, screen down
    return math.atan2(sx / 0.7071068 - sd / 0.3535534, sx / 0.7071068 + sd / 0.3535534)


def ground(x, y):
    """The Blender ground point (z 0) that projects x px right and y px down of the origin (1x px)."""
    return (px(x / 0.7071068 + y / 0.3535534) / 2, px(x / 0.7071068 - y / 0.3535534) / 2)


def turn(pts, heading, at=(0.0, 0.0)):
    """Ground points [(u, v)] in a local frame (u forward, v to the left) turned to heading (radians, Blender space,
    counter-clockwise from +x) and moved to `at`."""
    c, s = math.cos(heading), math.sin(heading)
    return [(at[0] + u * c - v * s, at[1] + u * s + v * c) for u, v in pts]


def rock(c, r, seed, cols=("rk", "rkM", "rkL"), squash=0.75, rough=0.28):
    """A lumpy rock object: an icosphere at Blender point c, displaced by seeded noise, smooth shaded (bands, not facets),
    faces in a mix of lit palette colours."""
    import bmesh
    import bpy
    noise = Noise(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    for v in bm.verts:
        d = np.array(v.co)
        k = 1 + (float(noise.fbm(d * 1.7 + seed % 13)) - 0.5) * 2 * rough
        v.co = Vector(c) + Vector((d[0] * k, d[1] * k, d[2] * k * squash)) * r
    bm.normal_update()
    picks = []
    for f in bm.faces:
        pick = float(noise((np.array(f.calc_center_median()) - np.array(c)) / r * 1.2 + 5))    # broad patches, not speckle
        picks.append(cols[0] if pick < 0.45 else cols[1] if pick < 0.7 else cols[2] if f.normal.z > 0.2 else cols[0])
    me = bpy.data.meshes.new("rock")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    ob = bpy.data.objects.new("rock", me)
    bpy.context.scene.collection.objects.link(ob)
    core.finalize(ob)
    core.set_attr(me, "Col", [lin(n) for n in picks])
    return ob


def place(objs, size):
    """Move objects so their screen box is centred on the world origin, and shrink them (never grow) to fit a size x size
    frame (1x px) with room for the outline."""
    import bpy
    bpy.context.view_layer.update()
    x0, x1, y0, y1 = core.extent_px(objs)
    half = (size * ART_SCALE - 2) / 2 - 0.5
    k = min(1.0, half / max((x1 - x0) / 2, (y1 - y0) / 2))
    shift = R * ((x0 + x1) / 2 / core.PXU) + U * ((y0 + y1) / 2 / core.PXU)
    for ob in objs:
        ob.location = (ob.location - shift) * k
        ob.scale = ob.scale * k
    bpy.context.view_layer.update()
    return k


def _pad1(a):
    return np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2))


def frame_item(sid, size, halo=(), outline=True):
    """Render the scene into a fixed size x size frame (size in 1x px, times ART_SCALE), world origin at its centre. halo:
    objects hidden in the colour pass (glow-sheet only). outline: the 1 px dark ring of props (bodies that light themselves
    skip it). Returns a manifest item with the anchor at the frame's centre."""
    W = size * ART_SCALE
    w = W - 2 if outline else W
    for o in halo:
        o.hide_render = True
    rgb, a = core.render(w, w, "color")
    c, op = post.downsample(rgb, a > 0.5, core.SS, 8, True)
    if outline:
        c, op = post.outline(c, op, True)
    for o in halo:
        o.hide_render = False
    grgb, _ = core.render(w, w, "glow")
    g = post.glow_down(grgb, core.SS, 3)
    if outline:
        g = _pad1(g)
    return {"id": sid, "fp": (1, 1), "rgba": post.to_rgba(c, op), "g": g, "ax": W // 2, "ay": W // 2}


def start():
    """Clear the scene for a new sprite and pick the full palette (the fx ramps live in the extras)."""
    core.clear_scene_meshes()
    post.select(True)


def alias(item, sid):
    """The same pixels under another id (the plain id of a variant set points at v0)."""
    return {**item, "id": sid}
