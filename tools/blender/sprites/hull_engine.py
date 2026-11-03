"""An engine's thruster block on the hull from outside: an add-on drawn over the engine's hull row, which keeps its
plain base hull pieces (their sloped tops, belly and every join as they are). One sprite two tiles wide over the
row's two inner tiles, drawn at the front one, its px only where it is in front of the hull ("over"): a plain
armoured block standing a little out of the outline, from under the hull's top down to over the belly's bottom
(squared off as its top), 4-5 px of the hull showing at either end, a recessed round port in its front where the
engine's bell comes out, two armoured shoulders on its top, set back over the hull's, tying it to the hull.
Detail comes later, as its own pass.

Frame: d out from the tiles' middle line, r along the run from the port's axis (the edge between the two tiles),
z up. o 2: space at +x, the run along y (STRAIGHT)."""
import math

from . import core
from . import wall3d as T
from . import wall3d_ext as X
from . import wall3d_belly as B
from . import wall3d_ext_geom as GE
from . import walls as W_

H = 2.05                # the hull's top
AXIS = 1.0              # the port's axis height (the Kestrel's thrust axis, lowered 0.3)
DF = GE.E + 0.25        # the block's front, out from the tiles' middle (8 px proud of the outline)
W = 0.87                # its half width along the run (the hull showing 4-5 px at either end)
ZT, C = 1.98, 0.09      # its top (a little under the hull's) and its front edges' chamfer (top and bottom)
ZF = W_.ZG - B.ARMOUR - B.SLOPE[1] + (H - ZT)      # its foot: as far over the belly's bottom as its top is under
                                                # the hull's, squared off the same (the slopes meet it alike)
RS, RD = 0.8, 0.3       # the port: radius (the bell's 0.76 there), depth
SH = 0.14               # the shoulders' rise over the top
SHOULDERS = ((-0.62, -0.16), (0.16, 0.62))       # their spans along the run
N = 32                  # segments round the port
ZM = AXIS - RS - 0.1    # the front's port zone down to here; under it a framed recess
FW, RECD = 0.1, 0.07    # the recess's frame width and depth
LOUVRES = 3             # slats across the recess
COLLAR = (0.1, 0.07)    # the port's raised collar: width, stand off the front
LIP = 1 / 32            # its front's dark outer edge
FIN_P, FIN_T, FIN_PAD = 0.09, 0.03, 0.05     # the ends' cooling fins: pitch, thickness (z), padding (d; in z alike)
RIB_UP, RIB_T = 5 / 39.2, 0.06     # the ends' plain band: 5 px either side of the front's middle, and a half
CONDUIT = 0.06          # the conduit's radius (up the front from the port's collar, over the top, into the hull)
SF = 0.3 + 3 / 32       # the shoulders' front, out from the tiles' middle
BOLT = 0.035            # bolt heads: half size
RAMPS = {              # unpainted steel, dark to light (palette greys: lighter than the bell's steelD body)
    "light": ("hsXM", "hsXS", "hsM", "hsXL", "hsS", "hsL"),
    "mid": ("steel", "hsXM", "steelL", "hsXS", "plate", "hsXL"),
    "dark": ("steelD", "hsXD", "steel", "hsXM", "steelL", "hsXS"),
}
RAMP = RAMPS["mid"]     # (picked)


def _frame(o):
    """pt(d, r, z) in Blender space, the tile drawn at (the front one) at the origin."""
    dx, dy = X.STRAIGHT[(5, 2) if o == 2 else (10, 1)]
    out = (1, 0) if o == 2 else (0, 1)

    def pt(d, r, z):
        s = r - 0.5                                     # (the axis half a tile back along the run)
        return core.G(out[0] * d + dx * s, out[1] * d + dy * s, z)
    return pt


def _tone(n, lift=0):
    """A face's tone by its outward normal (d, r, z): RAMP's step for it, `lift` steps lighter (a raised detail)."""
    d, r, z = n
    i = 4 if z > 0.8 else 5 if z > 0.2 else 2 if abs(r) > abs(d) else 3 if d > 0 else 1
    return RAMP[min(5, i + lift)]


class _Builder:
    def __init__(self, o, name):
        self.pt, self.m = _frame(o), core.Mesh(name)     # (lit, as the engine's art: picked over the hull's unlit)

    def face(self, pts, n, col=None, lift=0):
        """A face over (d, r, z) points, wound to face out along n (d, r, z)."""
        P = [self.pt(*p) for p in pts]
        nn = (P[1] - P[0]).cross(P[2] - P[0])
        out = self.pt(*n) - self.pt(0.0, 0.0, 0.0)
        self.m.poly(P if nn.dot(out) > 0 else P[::-1], col or _tone(n, lift))

    def prism(self, prof, r0, r1, skip=(), along="r", col=None, lift=0):
        """A convex profile run from r0 to r1: its two ends and a face per edge (but those in skip). The profile is
        (d, z) run along r, or (r, z) run along d (`along` "d"); `col` its faces' tone (default by facing,
        `lift` steps lighter)."""
        at = (lambda x, a, z: (x, a, z)) if along == "r" else (lambda x, a, z: (a, x, z))
        cx, cz = sum(p[0] for p in prof) / len(prof), sum(p[1] for p in prof) / len(prof)
        self.face([at(x, r0, z) for x, z in prof], at(0, -1, 0), col, lift)
        self.face([at(x, r1, z) for x, z in prof], at(0, 1, 0), col, lift)
        for i, (a, b) in enumerate(zip(prof, prof[1:] + prof[:1])):
            if i in skip:
                continue
            nx, nz = b[1] - a[1], -(b[0] - a[0])        # (the edge's normal, turned out from the middle)
            if nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) < 0:
                nx, nz = -nx, -nz
            ln = math.hypot(nx, nz)
            self.face([at(a[0], r0, a[1]), at(b[0], r0, b[1]), at(b[0], r1, b[1]), at(a[0], r1, a[1])],
                      at(nx / ln, 0, nz / ln), col, lift)


def _rect(c, s):
    """Where a ray from the port's axis at (c, s) leaves the front face's rectangle, as (r, z)."""
    t = min(W / abs(c) if abs(c) > 1e-9 else math.inf,
            (ZT - C - AXIS) / s if s > 1e-9 else (AXIS - ZM) / -s if s < -1e-9 else math.inf)
    return c * t, AXIS + s * t


def housing(o):
    """The block, one mesh."""
    b = _Builder(o, f"engine_housing_{o}")
    prof = [(0.0, ZF), (DF - C, ZF), (DF, ZF + C), (DF, ZT - C), (DF - C, ZT), (0.0, ZT)]
    b.prism(prof, -W, W, skip=(2,))                     # (its front: below, with the port)
    ts = {2 * math.pi * i / N for i in range(N)}
    for zc in (ZM, ZT - C):                             # (the port zone's corners, so its edges stay straight)
        for rc in (-W, W):
            ts.add(math.atan2(zc - AXIS, rc) % math.tau)
    ts = sorted(ts)
    for t0, t1 in zip(ts, ts[1:] + ts[:1]):
        c0, s0, c1, s1 = math.cos(t0), math.sin(t0), math.cos(t1), math.sin(t1)
        (r0, z0), (r1, z1) = _rect(c0, s0), _rect(c1, s1)
        p0, p1 = (RS * c0, AXIS + RS * s0), (RS * c1, AXIS + RS * s1)
        b.face([(DF, *p0), (DF, r0, z0), (DF, r1, z1), (DF, *p1)], (1, 0, 0))
        b.face([(DF, *p0), (DF - RD, *p0), (DF - RD, *p1), (DF, *p1)], (0, -(c0 + c1), -(s0 + s1)), RAMP[0])
    b.face([(DF - RD, RS * math.cos(t), AXIS + RS * math.sin(t)) for t in ts], (1, 0, 0), "hsXK")
    _collar(b)
    _recess(b)
    _fins(b)
    _bolts(b)
    _conduit(b)
    zb = H + SH - 0.04
    shoulder = [(-0.5, ZT - 0.05), (SF, ZT - 0.05), (SF, zb), (SF - 0.04, H + SH),
                (-0.5, H + SH)]                 # (on the top, set back over the hull's: none down the front)
    for r0, r1 in SHOULDERS:
        b.prism(shoulder, r0, r1, skip=(1,))    # (its front an exhaust: a frame 1 px wide round a dark opening)
        _hole(b, SF, r0, r1, ZT - 0.05, zb, 1 / 32, 1 / 39.2, 0.2, z_from=ZT)
        b.prism([(-0.42, H + SH), (SF - 0.18, H + SH), (SF - 0.18, H + SH + 0.03), (-0.42, H + SH + 0.03)],
                r0 + 0.06, r1 - 0.06, lift=1)           # (a plate on its top)
    return b.m.build()


def _collar(b):
    """The port's raised collar: its light front ring with a dark outer lip, and its outer rim."""
    w, h = COLLAR
    for i in range(N):
        t0, t1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
        c0, s0, c1, s1 = math.cos(t0), math.sin(t0), math.cos(t1), math.sin(t1)
        ring = lambda r, d, c, s: (d, r * c, AXIS + r * s)
        for r0, r1, col in ((RS, RS + w - LIP, RAMP[5]), (RS + w - LIP, RS + w, "steelD")):    # (light, dark lip)
            b.face([ring(r0, DF + h, c0, s0), ring(r1, DF + h, c0, s0), ring(r1, DF + h, c1, s1),
                    ring(r0, DF + h, c1, s1)], (1, 0, 0), col)
        b.face([ring(RS + w, DF + h, c0, s0), ring(RS + w, DF, c0, s0), ring(RS + w, DF, c1, s1),
                ring(RS + w, DF + h, c1, s1)], (0, c0 + c1, s0 + s1), "steelD")
        b.face([ring(RS, DF, c0, s0), ring(RS, DF + h, c0, s0), ring(RS, DF + h, c1, s1), ring(RS, DF, c1, s1)],
               (0, -(c0 + c1), -(s0 + s1)), RAMP[0])


def _recess(b):
    """The front under the port zone: a frame flush with it round a recessed panel, louvres across the panel."""
    r0, r1, z0, z1 = -W, W, ZF + C, ZM
    i0, i1, j0, j1 = r0 + FW, r1 - FW, z0 + FW, z1 - FW
    for q in ([(r0, z0), (r1, z0), (i1, j0), (i0, j0)], [(r1, z0), (r1, z1), (i1, j1), (i1, j0)],
              [(r1, z1), (r0, z1), (i0, j1), (i1, j1)], [(r0, z1), (r0, z0), (i0, j0), (i0, j1)]):
        b.face([(DF, r, z) for r, z in q], (1, 0, 0))   # (the frame)
    dp = DF - RECD
    b.face([(DF, i0, j0), (DF, i1, j0), (dp, i1, j0), (dp, i0, j0)], (0, 0, 1))      # (its sides, in to the panel)
    b.face([(DF, i0, j1), (DF, i1, j1), (dp, i1, j1), (dp, i0, j1)], (0, 0, -1), RAMP[0])
    b.face([(DF, i0, j0), (DF, i0, j1), (dp, i0, j1), (dp, i0, j0)], (0, 1, 0))
    b.face([(DF, i1, j0), (DF, i1, j1), (dp, i1, j1), (dp, i1, j0)], (0, -1, 0))
    b.face([(dp, i0, j0), (dp, i1, j0), (dp, i1, j1), (dp, i0, j1)], (1, 0, 0), RAMP[1])
    step = (j1 - j0) / LOUVRES
    for k in range(LOUVRES):                            # (slats: lit tops sloping out and down, dark under)
        zl = j0 + step * (k + 0.5)
        b.prism([(dp, zl - step * 0.35), (DF - 0.015, zl - step * 0.1), (dp, zl + step * 0.3)], i0 + 0.04, i1 - 0.04)


def _hole(b, d, r0, r1, z0, z1, br, bz, depth, z_from=None):
    """A front (at d, facing out) from r0 to r1, z0 to z1, with an opening in it `br` / `bz` in from its sides
    (from z_from up, if given) going `depth` back: the frame, the opening's walls and its dark back."""
    i0, i1, j0, j1 = r0 + br, r1 - br, (z_from if z_from is not None else z0) + bz, z1 - bz
    for q in ([(r0, z0), (r1, z0), (i1, j0), (i0, j0)], [(r1, z0), (r1, z1), (i1, j1), (i1, j0)],
              [(r1, z1), (r0, z1), (i0, j1), (i1, j1)], [(r0, z1), (r0, z0), (i0, j0), (i0, j1)]):
        b.face([(d, r, z) for r, z in q], (1, 0, 0))
    e = d - depth
    for (ra, za), (rb, zb), n in (((i0, j0), (i1, j0), (0, 0, 1)), ((i0, j1), (i1, j1), (0, 0, -1)),
                                  ((i0, j0), (i0, j1), (0, 1, 0)), ((i1, j0), (i1, j1), (0, -1, 0))):
        b.face([(d, ra, za), (d, rb, zb), (e, rb, zb), (e, ra, za)], n, "hsXK")
    b.face([(e, i0, j0), (e, i1, j0), (e, i1, j1), (e, i0, j1)], (1, 0, 0), "dark")


def _fins(b):
    """The block's ends: cooling fins stacked to its top and foot (as far in from those as from its front), over and
    under a plain band round the front's middle height."""
    pad, t = 2 * FIN_PAD * 32 / 39.2, FIN_T / 2         # (the padding at its top and foot: twice the front's px)
    mid = (ZF + ZT) / 2
    ribs = (mid - RIB_UP, mid + RIB_UP)
    gap = RIB_T / 2 + FIN_P - FIN_T                     # (a rib's nearest fin as far from it as the fins apart)
    fins, z = [], ZT - pad - t
    while z - t >= ribs[1] + gap:
        fins.append(z)
        z -= FIN_P
    z = ZF + pad + t
    while z + t <= ribs[0] - gap:
        fins.append(z)
        z += FIN_P
    for e in (-1, 1):
        rr = sorted((e * W, e * (W + 0.045)))
        for zc in fins:
            fe = min(_front(zc - t), _front(zc + t)) - FIN_PAD             # (in from the front, its chamfers too)
            b.prism([(FIN_PAD, zc - t), (fe, zc - t), (fe, zc + t), (FIN_PAD, zc + t)], *rr, lift=1)


def _box(b, d, r, z, h):
    """A bolt head: a small square standing h off a front at d, a step darker than the front (a fastener)."""
    b.prism([(d, z - BOLT), (d + h, z - BOLT), (d + h, z + BOLT), (d, z + BOLT)], r - BOLT, r + BOLT, col=RAMP[2])


def _bolts(b):
    """Bolts at the recess frame's corners and round the port's collar."""
    for r in (-W + FW / 2, W - FW / 2):
        for z in (ZF + C + FW / 2, ZM - FW / 2):
            _box(b, DF, r, z, 0.02)
    for i in range(8):
        t = 2 * math.pi * (i + 0.5) / 8
        rr = RS + COLLAR[0] / 2
        _box(b, DF + COLLAR[1], rr * math.cos(t), AXIS + rr * math.sin(t), 0.015)


def _front(z):
    """The block's front at height z, out from the tiles' middle (in where its top and foot are chamfered)."""
    return DF - max(0.0, z - (ZT - C)) - max(0.0, ZF + C - z)


def _rounded(pts, R, k=6):
    """A polyline through (d, z) corners, each inner corner rounded with radius R (a quadratic arc, k steps)."""
    out = [pts[0]]
    for a, p, c in zip(pts, pts[1:], pts[2:]):
        ua = math.hypot(p[0] - a[0], p[1] - a[1])
        uc = math.hypot(c[0] - p[0], c[1] - p[1])
        t1 = (p[0] - (p[0] - a[0]) / ua * R, p[1] - (p[1] - a[1]) / ua * R)
        t2 = (p[0] + (c[0] - p[0]) / uc * R, p[1] + (c[1] - p[1]) / uc * R)
        for i in range(k + 1):
            t = i / k
            out.append(tuple((1 - t) ** 2 * t1[j] + 2 * t * (1 - t) * p[j] + t * t * t2[j] for j in (0, 1)))
    return out + [pts[-1]]


def _conduit(b):
    """A conduit out of the port (from the middle of the dark ring round the bell, at its top): straight up the
    front past the collar, over the top edge, back along the top and down into the hull's sloped top between the
    shoulders; its bends rounded well over its radius (so they don't pinch)."""
    rad, n = CONDUIT, 8                                 # (an octagon, its sides square to the block: each one tone,
    rb = (RS - 0.03 + 0.7) / 2                          #  clean edges at game size; rounder came out ragged)
    f, top = DF + COLLAR[1] + 0.01 + rad, ZT + rad + 0.01  # (down the front just clear of the collar, straight
    pts = _rounded([(f, AXIS + rb), (f, top), (0.0, top), (0.0, ZT - 0.08)], 2.2 * rad)   # into the dark ring)
    rings = []
    for i, (d, z) in enumerate(pts):
        a, c = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        td, tz = c[0] - a[0], c[1] - a[1]
        ln = math.hypot(td, tz)
        pd, pz = -tz / ln, td / ln                      # (the path's normal in its plane; the other: along the run)
        ang = [2 * math.pi * (k + 0.5) / n for k in range(n)]
        rings.append([(d + rad * math.sin(t) * pd, rad * math.cos(t), z + rad * math.sin(t) * pz) for t in ang])
    for (pa, ra), (pb, rb_) in zip(zip(pts, rings), zip(pts[1:], rings[1:])):
        cd, cz = (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2           # (its faces turned out from the path)
        for k in range(n):
            q = [ra[k], ra[(k + 1) % n], rb_[(k + 1) % n], rb_[k]]
            m = [sum(p[j] for p in q) / 4 for j in range(3)]
            b.face(q, (m[0] - cd, m[1], m[2] - cz), RAMP[2])
    b.face(rings[0], (0, 0, -1), RAMP[0])               # (its end in the ring)


def piece(o):
    """(own, wide) for an "over" sprite: the block, and the row's four tiles of base hull it sits on."""
    mask = 5 if o == 2 else 10
    dx, dy = X.STRAIGHT[(mask, o)]
    was, T.VARIANT = T.VARIANT, (0, 0)
    try:
        hull = []
        for k in (-2, -1, 0, 1):
            for ob in X.ext_block(mask, o):
                ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                hull.append(ob)
    finally:
        T.VARIANT = was
    own = [housing(o)]
    return own, own + hull


END_LOOKS = {"cut": (T.CUT, T.CUT, T.CUT),                     # the end's section: (body, top lip, outline)
             "steel": (GE.YS[1], GE.YS[3], "steelD"),          # (the hull's side tone, as a wall's end section)
             "framed": (T.CUT, GE.YS[3], GE.YS[1])}            # (the black cut framed in the hull's tones)
END = "cut"
END_LIP, EDGE_N = 0.026, 4      # the lip's height; the outline's width in columns (128 a tile: 1 px)


def end_cut(o, hull):
    """Walls down: the engine's two hull tiles stand full height (the whole assembly shows), their neighbours cut to
    the belly, so the hull's open ends (a piece builds no face on its tile's edge: the next tile's) are closed with
    its section as a black cut (wall3d.CUT, the cut tops' tone). `hull`: the two tiles' objects, placed (piece's -1
    and 0); one mesh, both ends (only the one facing the camera shows). The section is the hull cut at the end's
    plane, filled per column from the floor up to the top surface, across its whole width (its outline is open
    underneath; the top overhangs the block's back face, so the overhang's columns come down to the floor too)."""
    import bmesh
    import bpy
    from mathutils import Vector
    dx, dy = X.STRAIGHT[(5, 2) if o == 2 else (10, 1)]
    out = (1, 0) if o == 2 else (0, 1)
    ov = core.G(out[0], out[1], 0.0)
    rv = core.G(dx, dy, 0.0)
    bpy.context.view_layer.update()
    bm = bmesh.new()
    for ob in hull:
        if ob.type == "MESH":
            me = ob.data.copy()
            me.transform(ob.matrix_world)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
    m = core.Mesh("hull_engine_end_cut", flat=True)
    for s, sign in ((-1.5, -1), (0.5, 1)):
        co = rv * s
        t = bm.copy()
        res = bmesh.ops.bisect_plane(t, geom=t.verts[:] + t.edges[:] + t.faces[:], dist=1e-5, plane_co=co,
                                     plane_no=rv)
        segs = [tuple((v.co.dot(ov), v.co.z) for v in e.verts) for e in res["geom_cut"]
                if isinstance(e, bmesh.types.BMEdge)]
        t.free()
        if not segs:
            continue
        pts = [p for sg in segs for p in sg]
        d0, d1 = min(d for d, _ in pts), max(d for d, _ in pts)
        n = int(round((d1 - d0) * 128))
        at = co + rv * (sign * 0.004)                   # (just out of the hull's own faces on the tile's edge)
        for i in range(n):
            da, db = d0 + (d1 - d0) * i / n, d0 + (d1 - d0) * (i + 1) / n
            dm = (da + db) / 2
            zs = [a[1] + (b[1] - a[1]) * (dm - a[0]) / (b[0] - a[0]) for a, b in segs if (a[0] - dm) * (b[0] - dm) < 0]
            if not zs:
                continue
            z1 = max(zs)
            body, lip, edge = END_LOOKS[END]
            col = edge if i < EDGE_N or i >= n - EDGE_N else body       # (a px outline down its back and front)
            for za, zb, c in ((0.0, z1 - END_LIP, col), (z1 - END_LIP, z1, lip)):     # (and a lit lip along its top)
                q = [at + ov * da + Vector((0, 0, za)), at + ov * db + Vector((0, 0, za)),
                     at + ov * db + Vector((0, 0, zb)), at + ov * da + Vector((0, 0, zb))]
                m.poly(q if sign > 0 else q[::-1], c)
    bm.free()
    return m.build()


def ring(o):
    """The bell's mounting ring in the port: a dark sleeve on its neck from inside the bore out past the collar."""
    pt = _frame(o)
    m = core.Mesh("hull_engine_ring")
    r, d0, d1 = RS - 0.03, DF - RD, DF + 0.1
    for i in range(N):
        t0, t1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
        a = [pt(d0, r * math.cos(t), AXIS + r * math.sin(t)) for t in (t0, t1)]
        b = [pt(d1, r * math.cos(t), AXIS + r * math.sin(t)) for t in (t0, t1)]
        m.poly([a[0], a[1], b[1], b[0]], "steelD")
    m.poly([pt(d1, r * math.cos(2 * math.pi * i / N), AXIS + r * math.sin(2 * math.pi * i / N)) for i in range(N)],
           "steel")
    return m.build()


KESTREL = {1: 2, 2: 1}  # the Kestrel engine's rotations with its hull row facing the camera: their o


def _to_module(rot, objs):
    """Objects made at the block's frame (the row's front inner tile at the origin) moved to the engine module's
    (its front tile, the row's last, at the origin: one tile on along the run)."""
    dx, dy = X.STRAIGHT[(5, 2) if KESTREL[rot] == 2 else (10, 1)]
    for ob in objs:
        ob.location = ob.location - core.G(dx, dy, 0.0)
    return objs


def module_block(rot):
    """module.engine.block.r<rot> ("over"): the block and the bell's mounting ring, over the row's four base hull
    tiles, at the engine module's anchor."""
    o = KESTREL[rot]
    own, wide = piece(o)
    own.append(ring(o))
    _to_module(rot, wide + own[-1:])
    return own, wide + own[-1:]


def module_hull(rot):
    """module.engine.hull.r<rot> (walls up and cutaway: the whole assembly shows): the row's two inner tiles of base
    hull, full height, closed at either end by end_cut, at the engine module's anchor."""
    o = KESTREL[rot]
    mask = 5 if o == 2 else 10
    dx, dy = X.STRAIGHT[(mask, o)]
    was, T.VARIANT = T.VARIANT, (0, 0)
    try:
        hull = []
        for k in (-1, 0):
            for ob in X.ext_block(mask, o):
                ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                hull.append(ob)
    finally:
        T.VARIANT = was
    return _to_module(rot, hull + [end_cut(o, hull)])
