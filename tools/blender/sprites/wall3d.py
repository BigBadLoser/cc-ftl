"""Metal walls in relief (the 2x detail pass): the wall and far hull pieces of walls.py with their detail built as
geometry instead of painted on.

The shell is walls.Strip's own (body, skirt slope, arms, corner fills, view levels), so the silhouette and every
neighbour rule are unchanged. On every camera-facing face, and down the skirt, parts stand proud of it: panels with
chamfered edges, rails, a cornice under the cap, grilles, lockers, bolts. A part's polygons take their colour from the
wallart ramps by the way they face (tone): y faces the lit ramp, x faces the shade ramp, tops and upward chamfers a step
or two lighter, downward chamfers darker. So the values are the painted set's, while depth, overlap and the light on
every edge are real.

Face frame (faces()): a 'y' face lies at y = plane with u = x, an 'x' face at x = plane with u = y; d is the distance
out of the face, z the height. Detail is laid on a fixed half-tile grid in u, so it lines up from tile to tile."""

import math

from mathutils import Vector

from . import core
from . import walls as W
from .rockwall import faces
from .rockwall_stone import _clip, _end, _inset

# ramp levels 0 (seam black) .. 5 (highlight), per family, for faces toward +y (lit) and +x (shade)
RAMPS = {"wall": (("wK", "wD", "wM", "wS", "wL", "wH"), ("wK", "wXD", "wXM", "wXS", "wXL", "wL")),
         "blue": (("bK", "bD", "bM", "bT", "bL", "bH"), ("bXK", "bXD", "bXM", "bD", "bM", "bXH")),
         "ochre": (("oK", "oD", "oM", "oT", "oL", "oH"), ("oXK", "oXD", "oXM", "oD", "oXH", "oH")),
         "rose": (("rK", "rD", "rM", "rM", "rL", "rH"), ("rK", "rXD", "rXM", "rXM", "rXL", "rL")),  # factions: 2nd tone
         "steel": (("hsK", "hsD", "hsM", "hsS", "hsL", "hsH"),                                     # the hull from
                   ("hsXK", "hsXD", "hsXM", "hsXS", "hsXL", "hsL"))}                               # outside
CUT = "wK"                                    # a sliced top (cutaway level)
HARD = True                                   # hard edges: no chamfers, so an edge is one crisp line
SHADE = 2                                     # how many ramp levels darker the shade (+x) side sits


def tone(fam, lvl, n, side=None):
    """Palette name of a surface of family fam, base level lvl, with outward grid normal n; side = the axis of the face
    the part stands on (its tops and slopes then stay in that face's ramp)."""
    ys, xs = RAMPS[fam]
    if n.z > 0.85:
        step = 1                              # a ledge's top: one step lighter (Space Haven's soft highlights)
    elif n.z > 0.3:
        step = 1
    elif n.z < -0.3:
        step = -2
    else:
        step = 0
    if (n.x > n.y + 1e-6) if side is None or abs(n.z) < 0.3 else side == "x":   # the shade side: SHADE levels darker (Space Haven's near-black side)
        sh = (STYLE or {}).get("shade", SHADE)                                   # (a faction look may soften it)
        if STYLE is None and fam == "wall":                                      # (the default walls: their own
            t = lvl + step                                                       # ramp SHADE steps darker, its
            return ys[max(min(1, lvl), min(5, t - (1 if t >= 4 else SHADE)))]    # light lines one: one material)
        return xs[max(min(1, lvl), min(5, lvl + step - sh))]
    return ys[max(0, min(5, lvl + step))]


class Relief:
    """A flat-shaded mesh that colours each polygon by family, level and its own facing."""
    def __init__(self, name, top=None):
        self.m = core.Mesh(name, flat=True)
        self.top = top                        # polygons flat at this height are a cut: the cut colour
        self.side = None                      # the axis of the face being dressed (see tone)
        self.no_shadow = False                # (set: polygons go to self.ns, a mesh casting no shadow in the
        self.ns = None                        # shadow pass, core.render_shadow)

    def poly(self, pts, fam, lvl, out, fixed=None):
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-12:
            return
        if n.dot(out) < 0:
            n = -n
        n.normalize()
        flat = all(abs(p.z - pts[0].z) < 1e-6 for p in pts)
        col = CUT if self.top is not None and flat and abs(pts[0].z - self.top) < 1e-6 else tone(fam, lvl, n, self.side)
        col = fixed or col                    # a fixed palette name (a torn section's skins and core)
        if SEAM_PASS and col != SEAM_PASS:
            col = SEAM_DARK
        if self.no_shadow and self.ns is None:
            self.ns = core.Mesh(self.m.name + "_ns", flat=True)
        m = self.ns if self.no_shadow else self.m
        m.poly([core.G(*p) for p in pts], col, flip=n.dot((pts[1] - pts[0]).cross(pts[2] - pts[0])) < 0)

    def build(self):
        """Its objects: the mesh, and the one casting no shadow if any (flagged "noshadow")."""
        obs = [self.m.build()]
        if self.ns is not None:
            obs.append(self.ns.build())
            obs[-1]["noshadow"] = True
        return obs


def P(ax, plane, u, z, d):
    return Vector((u, plane + d, z)) if ax == "y" else Vector((plane + d, u, z))


def OUT(ax):
    return Vector((0, 1, 0)) if ax == "y" else Vector((1, 0, 0))


SEAM_PASS = None        # a damage seam pass (wall3d_ext_dented, sprung plates) sets this to a key colour: painted lines
                        # (seams, panel outlines, plates' shading) draw in it, everything else near black
SEAM_DARK = "hsXK"
CLIP = None             # a breach (wallbreach.py) sets this: f(u) -> the tear's height on the face being dressed
STYLE = None            # a faction's relief (factions.py): {"wall": face fn, "hull": face fn, "skirt": "panel" | "outline"
                        # | None (the panel under each field), "toe": a family for a band along the skirt's foot, "seam": the
                        # skirt plates' seams in from each tile edge (0: one plate a tile), "slot": a handle slot in
                        # the outlined panel, "joint": the ramp level of the skirt's plate joints (1 dark), "toe_at":
                        # where down the slope the toe band starts (0.72), "shade": SHADE for this look, "shell": a
                        # Shell subclass to build the piece on (a look whose faces are cut into the wall), "end_out":
                        # how far an end piece's section runs past the face's line (PX; < 0 stops short of it),
                        # "chamfer": an outer corner's ramp chamfer width at its top edge (the shell must match),
                        # "outline_lvl": the outlined panel's seam level (0 dark; a level under the face seams'
                        # matches them, as the slope is a step lighter), "outline_round": its corners softened}


def slab(k, ax, plane, u0, u1, z0, z1, d, fam, lvl, ch=0.0, ends=(True, True), chz=None):
    """A part standing d proud of the face over [u0, u1] x [z0, z1]: a front, chamfered (ch) down to the face on its
    top / bottom and, where ends says so, its left / right edges; chz = (bottom, top) chamfers if they differ. Under
    a CLIP it is cut off along the tear (_torn)."""
    if CLIP is not None and min(CLIP(u0 + (u1 - u0) * i / 8) for i in range(9)) < z1:
        return _torn(k, ax, plane, u0, u1, z0, z1, d, fam, lvl)
    if HARD:
        ch, chz = 0.0, None
    cb, ct = chz if chz is not None else (ch, ch)
    cl, cr = (ch if ends[0] else 0.0), (ch if ends[1] else 0.0)
    cb, ct, cl, cr = (min(c, d * 1.0 + 1e-9) if c else 0.0 for c in (cb, ct, cl, cr))
    if u1 - u0 <= cl + cr + 1e-4 or z1 - z0 <= cb + ct + 1e-4:
        return
    o = OUT(ax)
    f = [P(ax, plane, u, z, d) for u, z in ((u0 + cl, z0 + cb), (u1 - cr, z0 + cb), (u1 - cr, z1 - ct), (u0 + cl, z1 - ct))]
    b = [P(ax, plane, u, z, 0.0) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))]
    k.poly(f, fam, lvl, o)
    side = (Vector((-1, 0, 0)), Vector((1, 0, 0)), Vector((0, 0, -1)), Vector((0, 0, 1)))
    if ax == "x":
        side = (Vector((0, -1, 0)), Vector((0, 1, 0)), Vector((0, 0, -1)), Vector((0, 0, 1)))
    for (i, j), s in zip(((3, 0), (1, 2), (0, 1), (2, 3)), side):
        k.poly([f[i], f[j], b[j], b[i]], fam, lvl, s + o * 0.01)


def _torn(k, ax, plane, u0, u1, z0, z1, d, fam, lvl, step=1 / 64):
    """A part cut off along the tear: a front under min(z1, CLIP), its torn top (lit, as it faces up) and its ends."""
    o = OUT(ax)
    us = [u0] + [u0 + step * i for i in range(1, int((u1 - u0) / step) + 1) if u0 + step * i < u1 - 1e-6] + [u1]
    top = [min(z1, CLIP(u)) for u in us]
    for i in range(len(us) - 1):
        s0, s1, t0, t1 = us[i], us[i + 1], top[i], top[i + 1]
        if t0 <= z0 and t1 <= z0:
            continue
        if t0 < z0:                                    # the tear crosses the part's foot: start where it rises over
            s0, t0 = s0 + (s1 - s0) * (z0 - t0) / (t1 - t0), z0
        elif t1 < z0:
            s1, t1 = s0 + (s1 - s0) * (t0 - z0) / (t0 - t1), z0
        f = [P(ax, plane, s0, z0, d), P(ax, plane, s1, z0, d), P(ax, plane, s1, t1, d), P(ax, plane, s0, t0, d)]
        k.poly(f, fam, lvl, o)
        k.poly([f[3], f[2], P(ax, plane, s1, t1, 0.0), P(ax, plane, s0, t0, 0.0)], fam, lvl, Vector((0, 0, 1)) + o * 0.01)
        for u, t, last in ((s0, t0, i == 0), (s1, t1, i == len(us) - 2)):
            if last and t > z0:
                k.poly([P(ax, plane, u, z0, d), P(ax, plane, u, t, d), P(ax, plane, u, t, 0.0),
                        P(ax, plane, u, z0, 0.0)], fam, lvl, (Vector((1, 0, 0)) if ax == "y" else Vector((0, 1, 0)))
                       * (1 if u == s1 else -1) + o * 0.01)


def spans(a, b):
    """The whole tiles' parts of [a, b]: (u0, u1) per tile."""
    out = []
    for c in range(-1, 2):
        u0, u1 = max(a, c - 0.5), min(b, c + 0.5)
        if u1 - u0 > 1e-6:
            out.append((u0, u1))
    return out


def run(k, ax, plane, a, b, ends, z0, z1, d, fam, lvl, ch):
    """A rail along the whole face; at an outer end ('out') it runs on by d so it meets the next face's rail."""
    ua = a - (d if ends[0] == "out" else 0.0)
    ub = b + (d if ends[1] == "out" else 0.0)
    slab(k, ax, plane, ua, ub, z0, z1, d, fam, lvl, ch=ch, ends=(ends[0] != "cont", ends[1] != "cont"))


# ---- faces: one design a tile, traced from Space Haven's wall sets (7 teal, 8 navy) ---------------------------------

STILE = 0.12                                    # the posts at each tile edge
PX = 1 / 16                                     # a depth whose top shows as one art px (its side as two)
PAINT = 0.004                                   # a flat inlay: colour only, no visible sides
LINE = 1 / 32                                   # one art px along a face
FR = PX / 2                                     # the default faces' frame (posts, bands, header): its side one px


def paint(k, ax, plane, u0, u1, z0, z1, on, fam, lvl):
    """A flat inlay on a surface standing `on` proud."""
    slab(k, ax, plane, u0, u1, z0, z1, on + PAINT, fam, lvl)


def posts(k, ax, plane, a, b, ends, z0, z1, fam):
    """A post at each tile edge and each face end (running on round an outer corner), a groove down each; returns
    the fields between them: (u0, u1)."""
    fields = []
    for u0, u1 in spans(a, b):
        f0, f1 = u0, u1
        for lo, edge, end in ((True, u0, ends[0]), (False, u1, ends[1])):
            at_end = abs(edge - (a if lo else b)) < 1e-6
            x = PX if at_end and end == "out" else 0.0
            seam = not at_end or end == "cont"
            q0, q1 = (edge - x, edge + STILE) if lo else (edge - STILE, edge + x)
            slab(k, ax, plane, q0, q1, z0, z1, FR, fam, 3, ends=(not seam, True) if lo else (True, not seam))
            g = edge + 0.065 if lo else edge - 0.065 - LINE
            paint(k, ax, plane, g, g + LINE, z0, z1, FR, fam, 1)
            if lo:
                f0 = edge + STILE
            else:
                f1 = edge - STILE
        if f1 - f0 > 1e-3:
            fields.append((f0, f1))
    return fields


def header_marks(k, ax, plane, a, b, z0, z1, fam):
    """Dark joints splitting the header into a long middle block and two short end blocks a tile."""
    for c in range(-1, 2):
        for u in (c - 0.18, c + 0.18 - LINE):
            if a < u < b - LINE:
                paint(k, ax, plane, u, u + LINE, z0, z1, FR, fam, 1)


def wall_face(k, ax, plane, a, b, ends, zs, top, full):
    """Partition (set 7): a low band, posts with a groove, a header in three blocks; in each field an outlined panel
    with two ochre bars in a dark slot, a raised bar across it and two fine lines under it."""
    F = "wall"
    zb = zs + 0.2
    run(k, ax, plane, a, b, ends, zs - 0.03, zb, FR, F, 3, 0)                                    # low band
    if not full:
        return
    zh = top - 0.15
    run(k, ax, plane, a, b, ends, zh, top - 0.02, FR, F, 3, 0)                                   # header
    header_marks(k, ax, plane, a, b, zh, top - 0.02, F)
    for f0, f1 in posts(k, ax, plane, a, b, ends, zb, zh, F):
        paint(k, ax, plane, f0, f1, zb, zh, 0.0, F, 2)                                            # the field
        if f1 - f0 < 0.3:
            continue
        uc, w = (f0 + f1) / 2, f1 - f0
        p0, p1, q0, q1 = f0 + 0.04, f1 - 0.04, zb + 0.1, zh - 0.06
        paint(k, ax, plane, p0, p1, q0, q1, PAINT, F, 1)                                          # panel outline
        paint(k, ax, plane, p0 + LINE, p1 - LINE, q0 + 0.026, q1 - 0.026, 2 * PAINT, F, 2)
        if VARIANT[0]:
            from . import wall3d_variants as V
            V.wall_top(k, ax, plane, p0 + LINE, p1 - LINE, q0 + 0.026, q1 - 0.026, F, VARIANT[0])
            continue
        bw = 0.42 * w
        paint(k, ax, plane, uc - bw / 2 - LINE, uc + bw / 2 + LINE, q1 - 0.27, q1 - 0.07, 3 * PAINT, F, 0)
        for j in range(2):                                                                       # ochre bars
            bz = q1 - 0.09 - j * 0.085
            paint(k, ax, plane, uc - bw / 2, uc + bw / 2, bz - 0.05, bz, 4 * PAINT, "ochre", 3)
        zr = q1 - 0.5
        slab(k, ax, plane, p0 + LINE, p1 - LINE, zr - 0.07, zr, FR, F, 3, ends=(False, False))   # raised bar
        for zz in (zr - 0.17, zr - 0.27):
            paint(k, ax, plane, uc - 0.25 * w, uc + 0.25 * w, zz - 0.026, zz, 3 * PAINT, F, 1)


def hull_face(k, ax, plane, a, b, ends, zs, top, full, variant):
    """Far hull (set 8): a low band, posts with a groove, a double header; in each field a dark recess with three slats
    and a deep box under it (the teal locker; ochre on the .v1 variant)."""
    B = "blue"
    zb = zs + 0.2
    run(k, ax, plane, a, b, ends, zs - 0.03, zb, FR, B, 2, 0)                                    # low band
    if not full:
        return
    zh = top - 0.24
    run(k, ax, plane, a, b, ends, top - 0.13, top - 0.02, FR, B, 3, 0)                           # double header
    run(k, ax, plane, a, b, ends, zh, top - 0.145, FR, B, 2, 0)
    header_marks(k, ax, plane, a, b, top - 0.13, top - 0.02, B)
    for f0, f1 in posts(k, ax, plane, a, b, ends, zb, zh, B):
        paint(k, ax, plane, f0, f1, zb, zh, 0.0, B, 2)
        if f1 - f0 < 0.3:
            continue
        zt = zb + 0.42                                                                           # the box's top
        slab(k, ax, plane, f0 + 0.03, f1 - 0.03, zb + 0.08, zt, PX, "ochre" if variant else F_LOCK, 3)
        paint(k, ax, plane, f0 + 0.12, f1 - 0.12, zb + 0.2, zb + 0.23, PX, "ochre" if variant else F_LOCK, 1)
        if VARIANT[0]:
            from . import wall3d_variants as V
            V.hull_recess(k, ax, plane, f0 + 0.02, f1 - 0.02, zt + 0.08, zh - 0.04, B, VARIANT[0])
            continue
        paint(k, ax, plane, f0 + 0.02, f1 - 0.02, zt + 0.08, zh - 0.04, PAINT, B, 1)               # the recess
        n = 3
        for j in range(n):                                                                       # its slats
            sz = zt + 0.14 + (zh - 0.1 - zt - 0.14) * j / (n - 1)
            slab(k, ax, plane, f0 + 0.05, f1 - 0.05, sz - 0.06, sz, PX, B, 2, ends=(False, False))


F_LOCK = "wall"                                  # the hull's box keeps the walls' teal


# ---- the skirt ------------------------------------------------------------------------------------------------

def _minus(q, holes):
    """A (u0, u1, d0, d1) rectangle less some holes (the same form): the rectangles left."""
    out = [q]
    for h in holes:
        nxt = []
        for r in out:
            if h[0] >= r[1] or h[1] <= r[0] or h[2] >= r[3] or h[3] <= r[2]:
                nxt.append(r)
                continue
            hu0, hu1, hd0, hd1 = max(h[0], r[0]), min(h[1], r[1]), max(h[2], r[2]), min(h[3], r[3])
            nxt += [x for x in ((r[0], r[1], r[2], hd0), (r[0], r[1], hd1, r[3]), (r[0], hu0, hd0, hd1),
                                (hu1, r[1], hd0, hd1)) if x[1] - x[0] > 1e-6 and x[3] - x[2] > 1e-6]
        out = nxt
    return out


def skirt(k, sp, ax, plane, a, b, fam, ends=None):
    """The face's posts and fields carried down the slope: a narrow plate under each post, a wide one under each field
    with a panel (a raised frame, a lighter plate sunk in it and a dark slot under it), on the shell's dark joints,
    mitred round corners."""
    run_, zs = sp.run, sp.zs
    ft = getattr(sp, "foot", 0.0)               # (a look whose ramp ends in an upright face this high)
    o = OUT(ax)
    nrm = (o * (zs - ft) / run_ + Vector((0, 0, 1))).normalized()
    zsurf = lambda dd: ft + (zs - ft) * (1 - dd / run_)               # noqa: E731
    if getattr(sp, "end_face", None) and sp.end_face(ax, plane):
        return                                  # a look's wall end: no ramp across it
    lo_t, hi_t = ends or (_end(sp, ax, plane, a, -1), _end(sp, ax, plane, b, 1))
    if getattr(sp, "is_end", None):             # ... and the ramps beside it stop square at its line
        lo_t, hi_t = ("end" if sp.is_end(ax, a, -1) else lo_t), ("end" if sp.is_end(ax, b, 1) else hi_t)
    lo = {"cont": lambda p: p[0] - a, "in": lambda p: p[0] - (a + p[1]), "out": lambda p: p[0] - (a - p[1]),
          "end": lambda p: p[0] - a}[lo_t]
    hi = {"cont": lambda p: b - p[0], "in": lambda p: (b - p[1]) - p[0], "out": lambda p: (b + p[1]) - p[0],
          "end": lambda p: b - p[0]}[hi_t]
    cr = (STYLE or {}).get("chamfer") if hi_t == "out" and getattr(sp, "line", None) else None
    if cr:          # a look whose shell chamfers a partition's outer corner: the plates stop at the chamfer's edge, which
        hi = lambda p: (b - cr + p[1]) - p[0]                          # noqa: E731  runs straight down the corner
    ub = b - cr if cr else b

    def pt(u, dd, rise):
        return P(ax, plane, u, zsurf(dd), dd) + nrm * rise
    g, rise = LINE / 2, PAINT
    d0, d1 = 0.02, run_ - (0.03 if ft else 0.045)
    off = (STYLE or {}).get("seam", STILE)     # the plates' seams this far in from each tile edge (0: one plate)
    segs = []                                   # the face's posts and fields (posts()), run on past a face end so
    for s0, s1 in spans(a, b):                  # the mitre clips them
        e0, e1 = s0 - (run_ if abs(s0 - a) < 1e-6 else 0.0), s1 + (run_ if abs(s1 - b) < 1e-6 else 0.0)
        if off <= 0 or s1 - s0 <= 2 * off + 1e-3:
            segs.append((e0, e1, s1 - s0 > 0.3))
            continue
        if cr and abs(s1 - b) < 1e-6:           # no seam beside a chamfered corner (it doubled the chamfer's edge)
            segs += [(e0, s0 + off, False), (s0 + off, e1, True)]
            continue
        segs += [(e0, s0 + off, False), (s0 + off, s1 - off, True), (s1 - off, e1, False)]
    holes = [h[2:] for h in getattr(sp, "holes", ()) if h[0] == ax and abs(h[1] - plane) < 1e-6]
    for u0, u1, field in segs:
        hole = next((h for h in holes if field and h[0] < u1 and h[1] > u0), None)
        for q in _minus((u0 + g, u1 - g, d0, d1), holes):                      # (round a look's ramp hole)
            poly = _clip(_clip([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], lo), hi)
            if len(poly) >= 3:
                plate(k, poly, pt, nrm, 0.0, rise, fam, 2)
        poly = _clip(_clip([(u0 + g, d0), (u1 - g, d0), (u1 - g, d1), (u0 + g, d1)], lo), hi)
        if len(poly) < 3:
            continue
        w = u1 - u0
        sk = (STYLE or {}).get("skirt", "panel")
        rv = (STYLE or {}).get("ramp_var")                              # a look's own ramp variant (in place
        if field and w >= 0.36 and VARIANT[1] and rv:                  # of its panel, whatever its style)
            rv(lambda q, rr, lvl, bb, f=None: plate(k, q, pt, nrm, 0.0, rise + rr, f or fam, lvl, base=rise + bb),
               max(u0, a), min(u1, ub), run_, VARIANT[1], k=k, pt=lambda u, dd, h: pt(u, dd, rise + h),
               P=lambda u, z, dd: P(ax, plane, u, z, dd), zs=zs, hole=hole, ax=ax, plane=plane, fam=fam)
        elif field and w >= 0.36 and sk == "outline":                   # a faction's plain outlined panel
            fu0, fu1 = max(u0, a) + 0.08, min(u1, ub) - 0.08                # (on the face, not the mitred run-on)
            fd0, fd1 = (f * run_ for f in (STYLE or {}).get("outline_d", (0.15, 0.62)))
            L, t = LINE, 0.03
            if (STYLE or {}).get("outline_round"):                         # its corners softened (each corner
                qs = [(fu0 + L, fu1 - L, fd0, fd0 + t), (fu0 + L, fu1 - L, fd1 - t, fd1),   # pixel left out)
                      (fu0, fu0 + L, fd0 + t, fd1 - t), (fu1 - L, fu1, fd0 + t, fd1 - t)]
            else:
                qs = [(fu0, fu1, fd0, fd0 + t), (fu0, fu1, fd1 - t, fd1), (fu0, fu0 + L, fd0, fd1),
                      (fu1 - L, fu1, fd0, fd1)]
            for q in qs:
                plate(k, [(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], pt, nrm, 0.0, rise + PAINT, fam,
                      (STYLE or {}).get("outline_lvl", 0), base=rise)
            if (STYLE or {}).get("slot") and not VARIANT[1] and hole:        # a handle slot cut into it
                slot_cut(k, ax, plane, hole, zsurf, fam)
            elif (STYLE or {}).get("slot") and not VARIANT[1]:              # a dark handle slot painted on it
                uc = (fu0 + fu1) / 2
                sd0, sd1, sw = (STYLE or {}).get("slot_d", (0.5, 0.57, 0.1))
                plate(k, [(uc - sw, sd0 * run_), (uc + sw, sd0 * run_), (uc + sw, sd1 * run_),
                          (uc - sw, sd1 * run_)], pt, nrm, 0.0, rise + PAINT, fam, 0, base=rise)
        if field and w >= 0.36 and sk == "panel" and VARIANT[1] and not rv:
            from . import wall3d_variants as V
            V.ramp_panel(k, lambda q, rr, lvl, bb: plate(k, q, pt, nrm, 0.0, rise + rr, fam, lvl, base=rise + bb),
                         u0 + 0.06, u1 - 0.06, run_, VARIANT[1])
        elif field and w >= 0.36 and sk == "panel" and not (VARIANT[1] and rv):   # a panel under each field
                                                            # (insets scale down on a short field)
            im = 0.2 * min(1.0, w / 0.76)
            fu0, fu1, fd0, fd1 = u0 + 0.06, u1 - 0.06, 0.12 * run_, 0.88 * run_
            plate(k, [(fu0, fd0), (fu1, fd0), (fu1, fd1), (fu0, fd1)], pt, nrm, 0.0, rise + PAINT, fam, 1,
                  base=rise)                                                   # the frame's dark outline
            fu0, fu1, fd0, fd1 = fu0 + LINE, fu1 - LINE, fd0 + 0.03, fd1 - 0.03
            iu0, iu1, id0, id1 = u0 + im, u1 - im, 0.3 * run_, 0.52 * run_
            for q in ((fu0, iu0, fd0, fd1), (iu1, fu1, fd0, fd1), (iu0, iu1, fd0, id0), (iu0, iu1, id1, fd1)):
                plate(k, [(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], pt, nrm, 0.0, rise + PX, fam,
                      2, base=rise)                                            # the raised frame ...
            plate(k, [(iu0, id0), (iu1, id0), (iu1, id1), (iu0, id1)], pt, nrm, 0.0, rise + 2 * PAINT, fam, 3,
                  base=rise)                                                   # ... and the plate sunk in it
            su0, su1, sd0, sd1 = u0 + im + 0.02, u1 - im - 0.02, 0.66 * run_, 0.74 * run_
            plate(k, [(su0, sd0), (su1, sd0), (su1, sd1), (su0, sd1)], pt, nrm, 0.0, rise + PX + PAINT, fam, 0,
                  base=rise + PX)                                              # a dark slot on the frame
    toe_fam, toe_at = (STYLE or {}).get("toe"), (STYLE or {}).get("toe_at", 0.72)
    if toe_fam:                                 # a faction's colour band along the skirt's foot, mitred like the plates
        for u0, u1, _ in segs:
            for q in _minus((u0, u1, toe_at * run_, run_ - 0.03), holes):     # (on down to the foot line)
                poly = _clip(_clip([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], lo), hi)
                if len(poly) >= 3:
                    plate(k, poly, pt, nrm, 0.0, rise + 2 * PAINT, toe_fam, 3, base=rise)
            poly = _clip(_clip([(u0, run_ - 0.03), (u1, run_ - 0.03), (u1, run_), (u0, run_)], lo), hi)
            if len(poly) >= 3:                  # under it the foot line, a strip of the ramp in the plates' tone
                plate(k, poly, pt, nrm, 0.0, rise, fam, 2)
        return
    if ft:                                      # an upright foot: its top edge lit
        for u0, u1, _ in segs:
            poly = _clip(_clip([(u0, run_ - 0.03), (u1, run_ - 0.03), (u1, run_), (u0, run_)], lo), hi)
            if len(poly) >= 3:
                plate(k, poly, pt, nrm, 0.0, rise, fam, 3)
        return
    tb = b - cr + run_ if cr else b
    toe = [P(ax, plane, u, 0.0035, dd) for u, dd in ((a, run_ - 0.03), (tb, run_ - 0.03), (tb, run_), (a, run_))]
    k.poly(toe, fam, 1, Vector((0, 0, 1)))


SLOT_DEPTH = 3 / 39                             # a ramp slot's floor under the slope (art px up)


def slot_cut(k, ax, plane, hole, zsurf, fam):
    """The inside of a slot cut into the ramp (the shell leaves its cells out: skip_skirt): a floor SLOT_DEPTH under the
    slope, upright walls round it from there up to the slope."""
    u0, u1, d0, d1 = hole
    zf = lambda dd: zsurf(dd) - SLOT_DEPTH                                     # noqa: E731
    o, al = OUT(ax), P(ax, 0.0, 1.0, 0.0, 0.0) - P(ax, 0.0, 0.0, 0.0, 0.0)
    q = lambda u, z, dd: P(ax, plane, u, z, dd)                                # noqa: E731
    k.poly([q(u0, zf(d0), d0), q(u1, zf(d0), d0), q(u1, zf(d1), d1), q(u0, zf(d1), d1)], fam, 0,
           (o * (zsurf(0) - zsurf(1)) + Vector((0, 0, 1))).normalized())     # its floor
    k.poly([q(u0, zf(d0), d0), q(u1, zf(d0), d0), q(u1, zsurf(d0), d0), q(u0, zsurf(d0), d0)], fam, 0, o,
           fixed=RAMPS[fam][0 if ax == "y" else 1][0])                                                    # back (dark)
    k.poly([q(u0, zf(d1), d1), q(u1, zf(d1), d1), q(u1, zsurf(d1), d1), q(u0, zsurf(d1), d1)], fam, 1, -o)   # front
    for u, sg in ((u0, 1), (u1, -1)):                                                                     # sides
        k.poly([q(u, zf(d0), d0), q(u, zf(d1), d1), q(u, zsurf(d1), d1), q(u, zsurf(d0), d0)], fam, 1, al * sg)


def plate(k, poly, pt, nrm, ch, rise, fam, lvl, base=0.0):
    """A plate on the slope over a 2D (u, d) polygon: a top rise above it, chamfered down to base on every edge."""
    inner = _inset(poly, 0.0 if HARD else ch)
    topf = [pt(u, dd, rise) for u, dd in inner]
    k.poly(topf, fam, lvl, nrm)
    cen = sum(topf, Vector()) / len(topf)
    for i in range(len(poly)):
        j = (i + 1) % len(poly)
        p0, p1 = pt(*poly[i], base), pt(*poly[j], base)
        k.poly([p0, p1, topf[j], topf[i]], fam, lvl, (p0 + p1) / 2 - cen + nrm * 0.02)


# ---- the hull's cap ---------------------------------------------------------------------------------------------

BAND = 0.2                                      # the cap's inner cut band (as the partitions' black caps)
LIP = 1 / 39                                    # a plate on a top: one art px of side


def raised(k, poly, z, h, fam, lvl):
    """A plate h high on a flat top over a convex 2D polygon (x, y)."""
    topf = [Vector((x, y, z + h)) for x, y in poly]
    k.poly(topf, fam, lvl, Vector((0, 0, 1)))
    cx, cy = sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        k.poly([Vector((x0, y0, z)), Vector((x1, y1, z)), Vector((x1, y1, z + h)), Vector((x0, y0, z + h))], fam, lvl,
               Vector(((x0 + x1) / 2 - cx, (y0 + y1) / 2 - cy, 0)))


def along(sp, r, x, y):
    """(along x?, distance from the cap's camera-side edge) for a point of rect r. The corner post follows the run
    (walls.Strip.col_top's rule); an arm runs along x when it reaches x = 0.5 from inside the tile (Strip's own test
    also took the +y arm, which starts at x = -0.5, for an x run, which notched the band)."""
    if r is sp.rects[0]:
        ax = bool(sp.mask & 2) or not sp.mask & 4
    else:
        ax = abs(r[0][1] - 0.5) < 1e-9 and r[0][0] > -0.5 + 1e-9
    return ax, (r[0][3] - y if ax else r[0][1] - x)


def cap(k, sp):
    """The far hull's top: armour plates (half a tile; a middle ochre plate on the .v1 variant) on dark joints, the cut
    band along the room side left black."""
    for r in sp.rects:
        if r[1] != "hull" or r[3] < W.hull_top() - 1e-6:
            continue
        x0, x1, y0, y1 = r[0]
        ax, _ = along(sp, r, (x0 + x1) / 2, (y0 + y1) / 2)
        if ax:
            a0, a1, b0, b1 = x0, x1, y0, y1 - getattr(sp, "cap_band", BAND)
        else:
            a0, a1, b0, b1 = y0, y1, x0, x1 - getattr(sp, "cap_band", BAND)
        cuts = (0.16, 0.84) if sp.variant else (0.5,)
        edges = sorted({a0, a1} | {c - 0.5 + t for c in (-1, 0, 1) for t in (0.0,) + cuts if a0 < c - 0.5 + t < a1})
        for u0, u1 in zip(edges, edges[1:]):
            g = LINE / 2
            poly = [(u0 + g, b0 + g), (u1 - g, b0 + g), (u1 - g, b1 - g), (u0 + g, b1 - g)]
            if not ax:
                poly = [(b, a) for a, b in poly][::-1]
            if getattr(sp, "cap_clip", None) and getattr(sp, "line", None):     # a look's chamfered outer corner
                poly = _clip(poly, sp.cap_clip)
            elif sp.keep:                                # the chamfered outer corner
                kk = round(W.hull_thick() * W.GN) / W.GN - 1.0
                poly = _clip(poly, lambda q: q[0] + q[1] - kk)
            if len(poly) < 3:
                continue
            mid = ((u0 + u1) / 2 + 0.5) % 1.0
            fam = "ochre" if sp.variant and 0.16 < mid < 0.84 else getattr(sp, "cap_fam", "blue")
            raised(k, poly, r[3], LIP, fam, 2)


# ---- pieces ---------------------------------------------------------------------------------------------------

class Shell(W.Strip):
    """walls.Strip with its faces, skirt and hull cap in the dark joint tone the parts stand on; partition caps and
    the cap's cut band black."""
    def col_top(self, i, j, kind, x, y):
        r = self._rect_at(x, y) or self.rects[0]
        if r[1] != "hull" or r[3] < W.hull_top() - 1e-6:
            return super().col_top(i, j, kind, x, y)
        return "wK" if along(self, r, x, y)[1] < BAND else RAMPS["blue"][0][0]

    def col_skirt(self, i, j, kind, x, y):
        d, r = self._dist(x, y)
        R = RAMPS["blue" if r[1] == "hull" else "wall"][1 if kind == "x" else 0]
        j = (STYLE or {}).get("joint", 1)                 # the joints between the plates (a faction may light them:
        lit = "joint" in (STYLE or {})                    # then on the shade side too, in its own ramp)
        return R[j] if d < self.run - 1 / 32 and (kind != "x" or lit) else R[0]

    def col_face(self, face, x, y, z):
        e = 0.5 / W.GN
        r = self._rect_at(x, y - e) if face == "y" else self._rect_at(x - e, y)
        R = RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0]
        top = r[3] if r else self.top
        return R[0] if z < self.zs + 0.02 or z > top - 0.03 or face == "x" else R[1]


VARIANT = (0, 0)          # a straight piece's variant while it is built: (top design, ramp design), 0 the base
                          # (wall3d_variants)
SHELL = None              # while a face is dressed: its shell (a look's shell may tell its parts where a wall ends)
END_TOPS = (None, None)   # while a face is dressed: the top of the wall that meets each of its "in" ends (a face
                          # may carry a part over a lower wall, such as the far hull's rail over a partition)


def _in_top(sp, ax, plane, u, side):
    e = 1e-3
    r = sp._rect_at(*((u + side * e, plane + e) if ax == "y" else (plane + e, u + side * e)), 0.0)
    return r[3] if r else None


def snap(plane):
    """Where the shell's face really is: walls.emit covers whole cells (a cell is in when its centre is inside the
    body), so a face off the 1/32 grid (the far hull's thickness) stands at the next cell boundary out."""
    return math.floor((plane + 0.5) * W.GN + 0.5) / W.GN - 0.5


def block(mask, fam, deco=None, name=None, level="cut", corners=0, shell=None, dress=None):
    """walls.block in relief. shell: a Shell class to build on instead of the look's; dress: the hull faces'
    dressing instead of the look's (the exterior hull, wall3d_ext); a shell with no_skirt has no skirt plates, one with
    no_cap no cap plates."""
    global END_TOPS, SHELL
    sp = SHELL = (shell or (STYLE or {}).get("shell", Shell))(mask, fam, level, 1 if deco == 1 else 0, corners)
    k = Relief(name or f"wall3d_{fam}_{mask}_{level}_{corners}")
    W.emit(k.m, sp)
    if not getattr(sp, "no_cap", False):
        cap(k, sp)
    for ax, plane, a, b, top in faces(sp):
        e = 1e-3
        um = (a + b) / 2
        r = sp._rect_at(*((um, plane - e) if ax == "y" else (plane - e, um)), 0.0)
        hull = r is not None and r[1] == "hull"
        plane = snap(plane)
        ends = (_end(sp, ax, plane, a, -1), _end(sp, ax, plane, b, 1))
        END_TOPS = tuple(_in_top(sp, ax, plane, u, sd) if t == "in" else None
                         for u, sd, t in ((a, -1, ends[0]), (b, 1, ends[1])))
        a, b = (snap(u) if t != "cont" else u for u, t in ((a, ends[0]), (b, ends[1])))   # (its ends too, so two
        k.side = ax                                                     # faces meet on the corner's diagonal)
        if not getattr(sp, "no_skirt", False):
            skirt(k, sp, ax, plane, a, b, "blue" if hull else "wall", ends)
        if top <= sp.zs + 0.05:
            continue
        full = top > W.skirt_top() + W.CUT + 0.05            # the hull stays full in the cutaway
        k.top = None if full else top
        st = STYLE or {}
        if hull:
            (dress or st.get("hull", hull_face))(k, ax, plane, a, b, ends, sp.zs, top, full, sp.variant)
        else:
            st.get("wall", wall_face)(k, ax, plane, a, b, ends, sp.zs, top, full)
    return k.build()


def end_face(fam, side, level="up", corners=0):
    """walls.end_face in relief: the wall's section where it butts into the low hull ghost (+y end of an S arm: side
    s; +x end of an E arm: e). It reaches the floor: the ghost is see-through, so a section stopping at its rim (as
    walls.end_face does) left the floor showing through the wall's open end. It takes in the raised frame on the
    wall's visible face: one smooth face with a lit lip under the cap and a dark outline round its silhouette, down
    the wall's edges and on along the slope of the skirts' cut sections (in the plates' tone)."""
    t, top, zs = W.profile(fam, level)
    run_ = W.skirt_run()
    lo, hi = (0.0, t) if fam == "hull" else (W.wall_back(), W.wall_back() + W.TW)
    p0, p1 = W.wall_back(), W.wall_back() + W.TW
    fz = W.fill_top(fam, level)
    lo_bit, hi_bit = (4, 2) if side == "s" else (1, 2)
    eo = (STYLE or {}).get("end_out", PX)                                     # past the face's line, to cover its parts
    spans = [(lo, hi if corners & hi_bit else hi + eo, top)]
    if corners & lo_bit:
        spans.append((0.0, p0, fz))
    if corners & hi_bit:
        spans.append((p1, 1.0, fz))
    ax = "y" if side == "s" else "x"
    F = "blue" if fam == "hull" else "wall"
    k = Relief(f"wall3d_end_{fam}_{side}_{level}_{corners}")
    k.side = ax

    def quad(u0, u1, z0, z1, lvl, d=0.0):
        k.poly([P(ax, 0.5, u - 0.5, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], F, lvl, OUT(ax))
    for a, b, zt in spans:
        if zt <= 1e-6:
            continue
        quad(a, b, 0.0, zt, 2)                                              # the section
        quad(a, a + LINE, zs if a > 1e-6 else 0.0, zt, 1, PAINT)             # its outline, down to the ramp's
        quad(b - LINE, b, zs if b < 1 - 1e-6 else 0.0, zt, 1, PAINT)         # edge where a skirt flanks it ...
        quad(a, b, zt - 0.026, zt, 4, PAINT)                                 # ... and a lit lip under the cap
    if not corners & hi_bit and (STYLE or {}).get("seam", STILE) > 0:   # the visible face's ramp ends here: one
        fa = "x" if side == "s" else "y"         # whole plate over the last (narrow) plate and its seam, so the ramp
                                                 # does not stop short (one plate a tile has no such seam)
        plane = hi - 0.5
        nrm = (OUT(fa) * zs / run_ + Vector((0, 0, 1))).normalized()
        k.side = fa

        def pt(u, dd, rise):
            return P(fa, plane, u, zs * (1 - dd / run_), dd) + nrm * rise
        off = (STYLE or {}).get("seam", STILE)
        u0, d0, d1 = 0.5 - (max(2 * STILE, off) if off > 0 else 0.15), 0.02, run_ - 0.045
        plate(k, [(u0, d0), (0.5, d0), (0.5, d1), (u0, d1)], pt, nrm, 0.0, 2 * PAINT, F, 2)
        if (STYLE or {}).get("toe"):                                        # the faction's band runs on to the end
            ta = STYLE.get("toe_at", 0.72)
            plate(k, [(u0, ta * run_), (0.5, ta * run_), (0.5, d1), (u0, d1)], pt, nrm, 0.0, 3 * PAINT,
                  STYLE["toe"], 3, base=2 * PAINT)
        k.side = ax
    edges = [(a, b) for a, b, _ in spans]
    n = 64
    for c in range(n):                                                       # the skirts' cut sections
        u0, u1 = c / n, (c + 1) / n
        if any(a <= (u0 + u1) / 2 < b for a, b in edges):
            continue
        zt = [zs * max(0.0, 1.0 - min(max(a - u, u - b) for a, b in edges) / run_) for u in (u0, u1)]
        if max(zt) <= 1e-6:
            continue
        lip = [max(0.0, z - 0.026) for z in zt]
        k.poly([P(ax, 0.5, u0 - 0.5, 0.0, 0.0), P(ax, 0.5, u1 - 0.5, 0.0, 0.0),
                P(ax, 0.5, u1 - 0.5, lip[1], 0.0), P(ax, 0.5, u0 - 0.5, lip[0], 0.0)], F, 2, OUT(ax))
        k.poly([P(ax, 0.5, u0 - 0.5, lip[0], PAINT), P(ax, 0.5, u1 - 0.5, lip[1], PAINT),
                P(ax, 0.5, u1 - 0.5, zt[1], PAINT), P(ax, 0.5, u0 - 0.5, zt[0], PAINT)], F, 1, OUT(ax))
    return [k.m.build()]
