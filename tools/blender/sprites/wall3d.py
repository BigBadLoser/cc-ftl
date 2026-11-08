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
from .relief_style import DEFAULT as DEFAULT_STYLE
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
        sh = SHADE if style().shade is None else style().shade                  # (a faction look may soften it)
        if (STYLE is None or STYLE.plain) and fam == "wall":                     # (the default walls: their shade
            return xs[max(min(1, lvl), min(5, lvl + step))]                      # ramp, level for level: each a
                                                                                 # shade under the lit one's, so the
                                                                                 # face's depths still read)
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

    def drop_below(self, z):
        """Cut every polygon off at height z: what lies over it stays (a part running from the floor up past it too)."""
        for m in (self.m, self.ns):
            if m is None:
                continue
            out = []
            for f in m.f:
                pts = [m.v[i] for i in f[0]]
                if min(p[2] for p in pts) >= z - 1e-6:
                    out.append(f)
                    continue
                kept = []
                for p, q in zip(pts, pts[1:] + pts[:1]):                    # (Sutherland-Hodgman, one plane)
                    if p[2] >= z:
                        kept.append(p)
                    if (p[2] >= z) != (q[2] >= z):
                        t = (z - p[2]) / (q[2] - p[2])
                        kept.append(tuple(a + (b - a) * t for a, b in zip(p, q)))
                if len(kept) >= 3 and max(p[2] for p in kept) > z + 1e-6:
                    base = len(m.v)
                    m.v += [tuple(p) for p in kept]
                    out.append((list(range(base, base + len(kept))),) + tuple(f[1:]))
            m.f = out

    def clip_above(self, z, start=(0, 0)):
        """Cut the polygons from start (an index into each mesh's) off at height z: what lies under it stays."""
        for m, s0 in zip((self.m, self.ns), start):
            if m is None:
                continue
            out = m.f[:s0]
            for f in m.f[s0:]:
                pts = [m.v[i] for i in f[0]]
                if max(p[2] for p in pts) <= z + 1e-6:
                    out.append(f)
                    continue
                kept = []
                for p, q in zip(pts, pts[1:] + pts[:1]):                    # (Sutherland-Hodgman, one plane)
                    if p[2] <= z:
                        kept.append(p)
                    if (p[2] <= z) != (q[2] <= z):
                        t = (z - p[2]) / (q[2] - p[2])
                        kept.append(tuple(a + (b - a) * t for a, b in zip(p, q)))
                if len(kept) >= 3 and min(p[2] for p in kept) < z - 1e-6:
                    base = len(m.v)
                    m.v += [tuple(p) for p in kept]
                    out.append((list(range(base, base + len(kept))),) + tuple(f[1:]))
            m.f = out

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


BARE = False            # the default walls' ramp without its panel (a window tile: wall3d_iwin_def)
OPEN = None             # a window's opening along x on the piece (x0, x1): the faces' fields it runs into keep no panel art
RAIL_LAYOUT = None      # f(a, b) -> (u0, u1, middle?): the rail's blocks on a window tile (wall3d_iwin_ramp), in
                        # place of faction.slate._blocks
LIP_OUT = 0             # px: a window's opening widened this far past the default post (wall3d_iwin_ramp post_in): the lip's
                        # seams by its ends move out with it
                        # (wall3d_iwin_def: its posts plain, no panel cut in half)
PRE_HOOK = None         # as a piece starts to build: f(sp) (wall3d_iwin_def: which tiles are a window's)
HOOK = None             # while a piece builds: f(k, sp) on its Relief before it builds (wall3d_iwin: a window's opening)
SEAM_PASS = None        # a damage seam pass (wall3d_ext_dented, sprung plates) sets this to a key colour: painted lines
                        # (seams, panel outlines, plates' shading) draw in it, everything else near black
SEAM_DARK = "hsXK"
CLIP = None             # a breach (wallbreach.py) sets this: f(u) -> the tear's height on the face being dressed
STYLE = None            # the look's relief_style.Style while one of its pieces builds (None: a default wall)


def style():
    """The current look's settings (relief_style.Style): the defaults while a default wall builds."""
    return STYLE or DEFAULT_STYLE


def seam():
    """The ramp plates' seams in from each tile edge (0: one plate a tile)."""
    return STILE if style().seam is None else style().seam


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


def posts(k, ax, plane, a, b, ends, z0, z1, fam, groove=True):
    """A post at each tile edge and each face end (running on round an outer corner), a groove down each (unless
    not groove); returns the fields between them: (u0, u1)."""
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
            if groove:
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


def _mitres(ends):
    return tuple({"out": 1.0, "in": -1.0}.get(e, 0.0) for e in ends)


def ramp_fall():
    """A look's own fall of its slope a unit out (Style.ramp_px), from the toe up; None: the walls' (from the top)."""
    return style().ramp_px * W.GN / W.ZART if style().ramp_px else None


def lip_heights(zs):
    """The default walls' ramp shelf's height against the wall and their lip's top (_lip), the ramp's top at zs."""
    from .faction.parts import PZ
    from .faction.slate import LIP_H
    f = ramp_fall()
    zh = W.foot() + (W.skirt_run() - style().shelf) * f if f else zs - style().shelf * W.GN * W.RAMP_PX / W.ZART
    return zh, zh + 3 * PZ + LIP_H


def _lip(k, ax, plane, a, b, ends, zs, top, fam):
    """Slate's lip at the face's foot (faction.slate): 2 px proud, a dark seam 2 px over it, both in three a tile
    (a seam up the lip's front, over its top and up the face to the seam over it). Returns the face's foot over it."""
    from .faction.parts import PZ, prism
    from .faction.slate import LIP_D, LIP_H, _thirds
    mit = _mitres(ends)
    zh = zs - style().shelf * W.GN * W.RAMP_PX / W.ZART  # the ramp's shelf against the wall (Style.shelf)
    zl = zh + 3 * PZ                                    # (its top as slate's: LIP_H over this)
    prism(k, ax, plane, a, b, [(0.0, zh), (LIP_D, zh), (LIP_D, zl + LIP_H), (0.0, zl + LIP_H)],
          fam, 3, cols=[False, None, None, False], mitre=mit)     # (its front on down to the shelf: no undercut)
    zg = zl + 6 * PZ                                    # the seam over it
    room = zg + PZ < top - 0.03                         # (under a low cut, walls down: the face to the cut, the lip's
    zf = zg if room else min(zg, top)                   # seams up to it, no seam over it)
    if not room and top - zl - LIP_H < 0.01:
        return zg, zl + LIP_H
    paint(k, ax, plane, a, b, zl + LIP_H, zg + PZ if room else top, 0.0, fam, 2)               # (the face over it)
    if room:
        paint(k, ax, plane, a, b, zg, zg + PZ, PAINT, fam, 1)
    for u in _thirds(a, b):
        if OPEN and LIP_OUT and (OPEN[0] < u < OPEN[0] + LIP_OUT * LINE or OPEN[1] - LIP_OUT * LINE < u < OPEN[1]):
            u += LIP_OUT * LINE * (-1 if u < (OPEN[0] + OPEN[1]) / 2 else 1)   # (a window's seam by its post, the
            #   opening widened past it: moved out with the opening's end)
        q0, q1 = u, u + 0.7 * LINE
        dq, zq = LIP_D + PAINT, zl + LIP_H + PAINT
        prism(k, ax, plane, q0, q1, [(0.0, zh), (dq, zh), (dq, zq), (0.0, zq)], fam, 2,
              cols=[False, None, None, False])
        paint(k, ax, plane, q0, q1, zl + LIP_H, zf, PAINT, fam, 1)
    return (zg + PZ if room else zg), zl + LIP_H


def rail_foot(top):
    """The default walls' rail's foot (_rail) on a face this tall."""
    from .faction.slate import RAIL_H
    return min(top, W.wall_top("wall", "up")) - 0.031 - RAIL_H


def _rail(k, ax, plane, a, b, ends, top, fam):
    """Slate's rail under the cap (faction.slate): three blocks a tile, the end ones 2 px proud, the middle one a px
    back with its top sloping down to the front, each front's top edge lit. Returns its foot."""
    from .faction.parts import PZ, prism
    from .faction.slate import MID_D, MID_DROP, RAIL_D, RAIL_H, _blocks
    mit = _mitres(ends)
    z0 = rail_foot(top)
    z1 = z0 + RAIL_H                                    # (under the cap's black)
    bl = (RAIL_LAYOUT or _blocks)(a, b)
    for i, (u0, u1, mid) in enumerate(bl):
        d = MID_D if mid else RAIL_D
        zb = z0 - PZ if mid else z0
        prof = [(0.0, zb), (d, zb), (d, z1 - MID_DROP), (0.0, z1)] if mid else [(0.0, zb), (d, zb), (d, z1), (0.0, z1)]
        m = (mit[0] if abs(u0 - a) < 1e-6 else 0.0, mit[1] if abs(u1 - b) < 1e-6 else 0.0)
        joins = [mid and j is not None and bl[j][2] and abs(bl[j][1 - e] - u) < 1e-6
                 for j, e, u in ((i - 1 if i else None, 0, u0), (i + 1 if i + 1 < len(bl) else None, 1, u1))]
        prism(k, ax, plane, u0, u1, prof, fam, 3, mitre=m,       # (no end where it runs on into another set-back
              cap=tuple(False if jn else None for jn in joins))  # block: a window's rail, RAIL_LAYOUT)
        zt = z1 - MID_DROP if mid else z1
        paint(k, ax, plane, u0, u1, zt - PZ, zt, d, fam, 5)                                      # its top edge lit
        nxt = bl[i + 1][2] if i + 1 < len(bl) else False
        if mid and u1 < b - 1e-6 and not nxt:           # (a seam where it meets the end block on its right, as the
            e = RAIL_D + 2 * PAINT                      # end block's side shows on its left: a sheet the px left of
            prism(k, ax, plane, u1 - 0.75 * LINE, u1 + 0.25 * LINE,   # the end block, up to its top; in front of
                  [(e - PAINT, zb), (e, zb), (e, z1), (e - PAINT, z1)], fam, 2,   # it, so the px is whole: a px
                  cols=[False, tone(fam, 2, OUT(ax), ax), False, False], cap=False)   # right at its depth)
    return z0


PX0 = 0.875     # where the camera's px boundaries fall along the default wall's front (in px, off u's own grid)


def _px(u, d):
    """u on the default wall's front, d proud of it, in screen px (a depth shifts it a px left per LINE)."""
    return u / LINE + PX0 - d / LINE


def _u(n, d):
    """The u that falls on px boundary n at depth d (_px's inverse)."""
    return (n - PX0 + d / LINE) * LINE


def _odd(x, par):
    """x rounded to a whole number with par's parity (a part centred on a panel of that many px)."""
    return 2 * round((x - par) / 2) + par


def wall_face(k, ax, plane, a, b, ends, zs, top, full):
    """Partition (set 7): a low band, posts with a groove, a header in three blocks; in each field an outlined panel
    with two ochre bars in a dark slot, a raised bar across it and two fine lines under it."""
    from .faction.parts import PZ, prism
    F = "wall"
    zb, zlt = _lip(k, ax, plane, a, b, ends, zs, top, F)                                        # the lip
    if not full:
        return
    zh = _rail(k, ax, plane, a, b, ends, top, F)                                                 # the rail
    for f0, f1 in posts(k, ax, plane, a, b, ends, zlt, zh, F, groove=False):      # (the posts plain, on down to the
        paint(k, ax, plane, f0, f1, zb, zh, 0.0, F, 2)                            # lip's top) ... the field
        if f1 - f0 < 0.3 or (OPEN and ax == "y" and f0 < OPEN[1] and f1 > OPEN[0]):
            continue
        uc, w = (f0 + f1) / 2, f1 - f0
        p0, p1, q0, q1 = f0 + 0.04, f1 - 0.04 - LINE, zb + 0.1, zh - 0.06    # (its right side a px further in)
        n0, n1 = round(_px(p0, PAINT)), round(_px(p1, PAINT))                   # (its parts on whole px, each
        p0, p1 = _u(n0, PAINT), _u(n1, PAINT)                                   # at its own depth)
        b0, b1 = q0, q1                                  # (the raised bar and fine lines placed as before ...)
        q0, q1 = q0 - 2 * PZ, q1 - 2 * PZ                # (... the panel's top and foot 2 px down, the slot with it)
        paint(k, ax, plane, p0, p1, q0, q1, PAINT, F, 1)                                          # panel outline
        paint(k, ax, plane, _u(n0 + 1, 2 * PAINT), _u(n1 - 1, 2 * PAINT), q0 + 0.026, q1 - 0.026, 2 * PAINT, F, 2)
        if VARIANT[0]:
            from . import wall3d_variants as V
            V.wall_top(k, ax, plane, p0 + LINE, p1 - LINE, q0 + 0.026, q1 - 0.026, F, VARIANT[0])
            continue
        bw, nc = 0.42 * w, n0 + n1                       # (centred on the panel: twice its centre, in px)
        ns = _odd(bw / LINE + 2, nc % 2)                 # the slot's width in px (a px round the bars)
        nl = _odd(0.5 * w / LINE, nc % 2)                # the fine lines'
        paint(k, ax, plane, _u((nc - ns) / 2, 3 * PAINT), _u((nc + ns) / 2, 3 * PAINT), q1 - 0.27 - PZ, q1 - 0.07,
              3 * PAINT, F, 0)                           # (its foot a px further down)
        for j in range(2):                                                                       # ochre bars
            bz = q1 - 0.09 - j * 0.085 - PZ              # (a px down, in the slot)
            paint(k, ax, plane, _u((nc - ns) / 2 + 1, 4 * PAINT), _u((nc + ns) / 2 - 1, 4 * PAINT), bz - 0.05, bz,
                  4 * PAINT, "ochre", 3)
        zr = b1 - 0.5
        prism(k, ax, plane, _u(n0 + 1, FR), _u(n1 - 1, FR), [(0.0, zr - 0.07), (FR, zr - 0.07), (FR, zr), (0.0, zr)],
              F, 3, cols=[False, None, None, False], cap=False, mitre=(0.0, lambda d, z: d - FR))  # raised bar: its front
        gap = (zr - 0.07 - b0) / 3                       # the panel's full width between its seams, its top's back
                                                         # cut a px short at its right end (square on screen: clear of
                                                         # the seam, no AA blend)
        for zz in (zr - 0.07 - gap, zr - 0.07 - 2 * gap):  # ... the two lines
            paint(k, ax, plane, _u((nc - nl) / 2, 3 * PAINT), _u((nc + nl) / 2, 3 * PAINT), zz - 0.026, zz,
                  3 * PAINT, F, 1)                                                              # evenly under it


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
    f = ramp_fall()                             # (a look's own fall a cell: up from the toe)
    nrm = (o * (f or (zs - ft) / run_) + Vector((0, 0, 1))).normalized()
    zsurf = (lambda dd: ft + (run_ - dd) * f) if f else (lambda dd: ft + (zs - ft) * (1 - dd / run_))   # noqa: E731
    if getattr(sp, "end_face", None) and sp.end_face(ax, plane):
        return                                  # a look's wall end: no ramp across it
    lo_t, hi_t = ends or (_end(sp, ax, plane, a, -1), _end(sp, ax, plane, b, 1))
    if getattr(sp, "is_end", None):             # ... and the ramps beside it stop square at its line
        lo_t, hi_t = ("end" if sp.is_end(ax, a, -1) else lo_t), ("end" if sp.is_end(ax, b, 1) else hi_t)
    lo = {"cont": lambda p: p[0] - a, "in": lambda p: p[0] - (a + p[1]), "out": lambda p: p[0] - (a - p[1]),
          "end": lambda p: p[0] - a}[lo_t]
    hi = {"cont": lambda p: b - p[0], "in": lambda p: (b - p[1]) - p[0], "out": lambda p: (b + p[1]) - p[0],
          "end": lambda p: b - p[0]}[hi_t]
    if getattr(sp, "solid", False):             # (a shell that builds its ramp as solids: this face's)
        sp.ramp(k, ax, plane, a, b, fam, lo_t, hi_t)
    cr = style().chamfer if hi_t == "out" and getattr(sp, "line", None) else None
    if cr:          # a look whose shell chamfers a partition's outer corner: the plates stop at the chamfer's edge, which
        hi = lambda p: (b - cr + p[1]) - p[0]                          # noqa: E731  runs straight down the corner
    ub = b - cr if cr else b

    def pt(u, dd, rise):
        return P(ax, plane, u, zsurf(dd), dd) + nrm * rise
    g, rise = LINE / 2, PAINT
    d0, d1 = max(0.02, style().shelf), run_ - (0.03 if ft else 0.045)   # (from a look's shelf's edge)
    if style().plain and ft:                   # (the default walls: the plates on down to the toe's edge)
        d1 = run_
    off = seam()                               # the plates' seams this far in from each tile edge (0: one plate)
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
    one = style().plain                         # (the default walls: one plate a tile, no seams beside its panel)
    if one:
        for s0, s1 in spans(a, b):
            e0, e1 = s0 - (run_ if abs(s0 - a) < 1e-6 else 0.0), s1 + (run_ if abs(s1 - b) < 1e-6 else 0.0)
            for q in _minus((e0 + g, e1 - g, d0, d1), holes):
                for b0, b1, bf, bl in _bands(q[2], q[3], run_, fam, ax):
                    poly = _clip(_clip([(q[0], b0), (q[1], b0), (q[1], b1), (q[0], b1)], lo), hi)
                    if len(poly) >= 3:
                        plate(k, poly, pt, nrm, 0.0, rise, bf, _lvl(bl)[0], fixed=_lvl(bl)[1])
            poly = _clip(_clip([(e0 + g, d0), (e1 - g, d0), (e1 - g, d0 + 0.4 / 32), (e0 + g, d0 + 0.4 / 32)],
                               lo), hi)         # the step's edge lit (the slope's top px, at the shelf)
            if len(poly) >= 3:
                plate(k, poly, pt, nrm, 0.0, rise + PAINT, fam, 5, base=rise)
    for u0, u1, field in segs:
        hole = next((h for h in holes if field and h[0] < u1 and h[1] > u0), None)
        for q in () if one else _minus((u0 + g, u1 - g, d0, d1), holes):      # (round a look's ramp hole)
            for b0, b1, bf, bl in _bands(q[2], q[3], run_, fam, ax):                # (in a look's bands down the run)
                poly = _clip(_clip([(q[0], b0), (q[1], b0), (q[1], b1), (q[0], b1)], lo), hi)
                if len(poly) >= 3:
                    plate(k, poly, pt, nrm, 0.0, rise, bf, _lvl(bl)[0], fixed=_lvl(bl)[1])
        poly = _clip(_clip([(u0 + g, d0), (u1 - g, d0), (u1 - g, d1), (u0 + g, d1)], lo), hi)
        if len(poly) < 3:
            continue
        w = u1 - u0
        sk = style().skirt
        rv = fill("ramp")                                  # a look's ramp design (in place of its
        if field and w >= 0.36 and rv:                                  # panel, whatever its style)
            rv(lambda q, rr, lvl, bb, f=None, fixed=None: plate(k, q, pt, nrm, 0.0, rise + rr, f or fam, lvl,
                                                                       base=rise + bb, fixed=fixed),
               max(u0, a), min(u1, ub), run_, k=k, pt=lambda u, dd, h: pt(u, dd, rise + h),
               P=lambda u, z, dd: P(ax, plane, u, z, dd), zs=zs, hole=hole, ax=ax, plane=plane, fam=fam)
        elif field and w >= 0.36 and sk == "outline":                   # a faction's plain outlined panel
            fu0, fu1 = max(u0, a) + 0.08, min(u1, ub) - 0.08                # (on the face, not the mitred run-on)
            fd0, fd1 = (f * run_ for f in style().outline_d)
            L, t = LINE, style().outline_t
            if style().outline_round:                         # its corners softened (each corner
                qs = [(fu0 + L, fu1 - L, fd0, fd0 + t), (fu0 + L, fu1 - L, fd1 - t, fd1),   # pixel left out)
                      (fu0, fu0 + L, fd0 + t, fd1 - t), (fu1 - L, fu1, fd0 + t, fd1 - t)]
            else:
                qs = [(fu0, fu1, fd0, fd0 + t), (fu0, fu1, fd1 - t, fd1), (fu0, fu0 + L, fd0, fd1),
                      (fu1 - L, fu1, fd0, fd1)]
            ob = style().outline_block
            if ob:                                            # a block in it, under its top line
                qs.append((fu0 + L + ob[1], fu1 - L - ob[1], fd0 + t + ob[0], fd0 + t + ob[0] + ob[2], ob[3]))
            for q in qs:
                lv = q[4] if len(q) > 4 else style().outline_lvl          # (a level, or {family: palette name})
                plate(k, [(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], pt, nrm, 0.0, rise + PAINT, fam,
                      lv if isinstance(lv, int) else 0, base=rise, fixed=lv.get(fam) if isinstance(lv, dict) else None)
            if style().slot and not VARIANT[1] and hole:        # a handle slot cut into it (the solid ramp
                if not getattr(sp, "solid", False):                    # builds its own)
                    slot_cut(k, ax, plane, hole, zsurf, fam)
            elif style().slot and not VARIANT[1]:              # a dark handle slot painted on it
                uc = (fu0 + fu1) / 2
                sd0, sd1, sw = style().slot_d
                plate(k, [(uc - sw, sd0 * run_), (uc + sw, sd0 * run_), (uc + sw, sd1 * run_),
                          (uc - sw, sd1 * run_)], pt, nrm, 0.0, rise + PAINT, fam, 0, base=rise)
        if field and w >= 0.36 and sk == "panel" and VARIANT[1] and not rv and not style().plain:
            from . import wall3d_variants as V
            V.ramp_panel(k, lambda q, rr, lvl, bb: plate(k, q, pt, nrm, 0.0, rise + rr, fam, lvl, base=rise + bb),
                         u0 + 0.06, u1 - 0.06, run_, VARIANT[1])
        elif field and w >= 0.36 and sk == "panel" and not rv and (not BARE or style().plain):   # a panel under each
            #   field (a window tile's bare ramp on the default walls: only its seam line, below)
                                                            # (insets scale down on a short field)
            im = 0.2 * min(1.0, w / 0.76)
            dn = 0.12 * run_ if style().plain and ft else 0.0   # (the default walls: the panel down to the toe's edge)
            fu0, fu1, fd0, fd1 = u0 + 0.06, u1 - 0.06, 0.12 * run_ + dn, 0.88 * run_ + dn
            pd = 0.4 / 32                               # (about an art px down the slope)
            if style().plain:                           # the default walls: the panel drawn, a seam line round
                ed = pd                                 # it (a px across, about a px down the slope), its top
                fd0, fd1 = fd0 + 4 * pd, fd1 - 2 * pd   # 4 px down, its bottom 2 px up (its top under the
                fd0 = max(fd0, d0 + pd) + pd            # step's lit edge, not on it; then a px further down)
                sb = fd1 - ed                           # (the bottom seam's top)
                hz = fd1 - 4 * pd                       # either side a seam across to the slope's edges, its
                ea = u0 - off - (run_ if abs(u0 - off - a) < 1e-6 else 0.0) + g      # line 3 px over the
                eb = u1 + off + (run_ if abs(u1 + off - b) < 1e-6 else 0.0) - g      # panel's bottom one
                for q in ((ea, eb, hz, hz + ed),) if BARE else ((ea, fu0, hz, hz + ed), (fu1, eb, hz, hz + ed)):
                    poly = _clip(_clip([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], lo), hi)
                    if len(poly) >= 3:
                        plate(k, poly, pt, nrm, 0.0, rise + PAINT, fam, 1, base=rise)
                if BARE:                                # (a window tile: the seam on across, no panel; a window's
                    continue                            # pockets cut it, wall3d_iwin_ramp)
                for q in ((fu0, fu1, fd0, fd0 + ed), (fu0, fu1, fd1 - ed, fd1), (fu0, fu0 + LINE, fd0, fd1),
                          (fu1 - LINE, fu1, fd0, fd1)):
                    plate(k, [(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], pt, nrm, 0.0, rise + PAINT,
                          fam, 1, base=rise)            # (a level over drone's seams: its darkest but one)
            else:                                       # the frame's dark outline
                plate(k, [(fu0, fd0), (fu1, fd0), (fu1, fd1), (fu0, fd1)], pt, nrm, 0.0, rise + PAINT, fam, 1,
                      base=rise)
            fu0, fu1, fd0, fd1 = fu0 + LINE, fu1 - LINE, fd0 + 0.03, fd1 - 0.03
            iu0, iu1, id0, id1 = u0 + im, u1 - im, 0.3 * run_ + dn, 0.52 * run_ + dn
            if style().plain:                           # (the default walls: the light plate a px in at its top
                iu0, iu1, id0, id1 = iu0 + LINE, iu1 - LINE, id0 + 2 * pd, id1 + pd    # and sides, a px down)
            fr = 0.0 if style().plain else PX           # (the raised frame's height: none on the default walls)
            if style().plain and VARIANT[1]:            # (a ramp design: its own drawing in the frame)
                from . import wall3d_variants as V
                V.ramp_plain(lambda q, lvl, n: plate(k, q, pt, nrm, 0.0, rise + n * PAINT, fam, lvl, base=rise),
                             fu0, fu1, fd0, iu0, iu1, id1, sb, pd, VARIANT[1])
                continue
            if fr:
                for q in ((fu0, iu0, fd0, fd1), (iu1, fu1, fd0, fd1), (iu0, iu1, fd0, id0), (iu0, iu1, id1, fd1)):
                    plate(k, [(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], pt, nrm, 0.0, rise + PX,
                          fam, 2, base=rise)                                   # the raised frame ...
            plate(k, [(iu0, id0), (iu1, id0), (iu1, id1), (iu0, id1)], pt, nrm, 0.0, rise + 2 * PAINT, fam,
                  4 if style().plain else 3, base=rise)  # ... and the plate sunk in it
            su0, su1, sd0, sd1 = u0 + im + 0.02, u1 - im - 0.02, 0.66 * run_ + dn, 0.74 * run_ + dn
            if style().plain:                           # (the default walls: the slot a px down, clear of the
                sd0, sd1 = sd0 + pd, min(sd1 + pd, sb - 1e-3)             # panel's bottom seam)
            plate(k, [(su0, sd0), (su1, sd0), (su1, sd1), (su0, sd1)], pt, nrm, 0.0, rise + fr + 2 * PAINT, fam,
                  0, base=rise + fr)                                           # a dark slot on the frame
    toe_fam, toe_at = style().toe, style().toe_at
    if toe_fam and not ft:                      # a faction's colour band along the skirt's foot, mitred like the plates
        for u0, u1, _ in segs:
            for q in _minus((u0, u1, toe_at * run_, run_ - 0.03), holes):     # (on down to the foot line)
                poly = _clip(_clip([(q[0], q[2]), (q[1], q[2]), (q[1], q[3]), (q[0], q[3])], lo), hi)
                if len(poly) >= 3:
                    plate(k, poly, pt, nrm, 0.0, rise + 2 * PAINT, toe_fam, 3, base=rise)
            poly = _clip(_clip([(u0, run_ - 0.03), (u1, run_ - 0.03), (u1, run_), (u0, run_)], lo), hi)
            if len(poly) >= 3:                  # under it the foot line, a strip of the ramp in the plates' tone
                plate(k, poly, pt, nrm, 0.0, rise, fam, 2)
        return
    if ft and style().plain:                    # (the default walls: no lit edge over the foot)
        return
    if ft:                                      # an upright foot: its top edge lit (or in a look's toe tone)
        tl = style().toe_lvl
        for u0, u1, _ in segs:
            poly = _clip(_clip([(u0, run_ - 0.03), (u1, run_ - 0.03), (u1, run_), (u0, run_)], lo), hi)
            if len(poly) >= 3:
                fx = tl.get(fam) if isinstance(tl, dict) else None
                fx = fx[0 if ax == "y" else 1] if isinstance(fx, tuple) else fx    # (a pair: y face, x face)
                plate(k, poly, pt, nrm, 0.0, rise, fam, 3, fixed=fx)
        return
    tb = b - cr + run_ if cr else b
    toe = [P(ax, plane, u, 0.0035, dd) for u, dd in ((a, run_ - 0.03), (tb, run_ - 0.03), (tb, run_), (a, run_))]
    k.poly(toe, fam, 1, Vector((0, 0, 1)))


def _lvl(bl):
    """A band's level as plate's (level, fixed): a palette name is its fixed colour."""
    return (0, bl) if isinstance(bl, str) else (bl, None)


def _bands(d0, d1, run_, fam, ax="y"):
    """The ramp's plates from d0 to d1 down the run, split in the look's bands (Style.ramp_bands): (from, to, family,
    level) each (a band's level may be a pair: on the y face, on the x face; or a palette name, its fixed colour);
    without bands one plate in the face's family, level 2."""
    out, cur = [], (d0, fam, 3 if style().plain else 2)     # (the default walls' slope a shade lighter)
    for f, bf, bl, gap in style().ramp_bands:
        out.append((cur[0], f * run_ - gap, cur[1], cur[2]))
        cur = (f * run_, bf or fam, bl[0 if ax == "y" else 1] if isinstance(bl, tuple) else bl)
    out.append((cur[0], d1, cur[1], cur[2]))
    return [(max(b0, d0), min(b1, d1), bf, bl) for b0, b1, bf, bl in out if min(b1, d1) - max(b0, d0) > 1e-6]


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


def plate(k, poly, pt, nrm, ch, rise, fam, lvl, base=0.0, fixed=None):
    """A plate on the slope over a 2D (u, d) polygon: a top rise above it, chamfered down to base on every edge
    (fixed: its top in that palette name)."""
    inner = _inset(poly, 0.0 if HARD else ch)
    topf = [pt(u, dd, rise) for u, dd in inner]
    k.poly(topf, fam, lvl, nrm, fixed=fixed)
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
        j = 1 if style().joint is None else style().joint   # the joints between the plates (a faction may light
        lit = style().joint is not None                     # them: then on the shade side too, in its own ramp)
        if style().plain and kind == "x" and d < self.run - 1 / 32:     # (the default walls: the lit side's joint
            return RAMPS["blue" if r[1] == "hull" else "wall"][0][j]     # tone on the shade side too, not black)
        return R[j] if d < self.run - 1 / 32 and (kind != "x" or lit) else R[0]

    def col_face(self, face, x, y, z):
        e = 0.5 / W.GN
        r = self._rect_at(x, y - e) if face == "y" else self._rect_at(x - e, y)
        R = RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0]
        top = r[3] if r else self.top
        if z < self.foot - 1e-6:                        # the skirt's upright foot (under the plates' toes): a plate
            R = RAMPS["blue" if self._dist(x, y)[1][1] == "hull" else "wall"][1 if face == "x" else 0]
            return R[2]                                 # tone, not the joints' black
        return R[0] if z < self.zs + 0.02 or z > top - 0.03 or face == "x" else R[1]


VARIANT = (0, 0)          # a straight piece's variant while it is built: (top design, ramp design), 0 the base


def fill(slot, base=None):
    """What the straight piece's designs put in slot (its look's Style.fill); base if they leave it alone."""
    return style().fill(slot, VARIANT, base)
                          # (wall3d_variants)
SHELL = None              # while a face is dressed: its shell (a look's shell may tell its parts where a wall ends)
END_TOPS = (None, None)   # while a face is dressed: the top of the wall that meets each of its "in" ends (a face
                          # may carry a part over a lower wall, such as the far hull's rail over a partition)


def _in_top(sp, ax, plane, u, side):
    e = 1e-3
    r = sp._rect_at(*((u + side * e, plane + e) if ax == "y" else (plane + e, u + side * e)), 0.0)
    return r[3] if r else None


def hull_cap(mask, deco=None, corners=0):
    """The far hull over the partitions' height, to draw over the partition piece of the same mask (the far hull's
    inside face is the partitions'): its face's band over their height a black cut, its top's armour plates and cut
    band. env_build "over": (its own objects, with the partition piece's), so its px are where it stands in front of
    the partition, which covers the rest, in its own colours (its edges blend with nothing of the partition's, so it
    sits on any of the partition's designs and looks)."""
    own = block(mask, "hull", deco, level="up", corners=corners, above=W.HF)
    return own, own + block(mask, "wall", level="up", corners=corners)


def snap(plane):
    """Where the shell's face really is: walls.emit covers whole cells (a cell is in when its centre is inside the
    body), so a face off the 1/32 grid (the far hull's thickness) stands at the next cell boundary out."""
    return math.floor((plane + 0.5) * W.GN + 0.5) / W.GN - 0.5


def block(mask, fam, deco=None, name=None, level="cut", corners=0, shell=None, dress=None, above=None):
    """walls.block in relief. shell: a Shell class to build on instead of the look's; dress: the hull faces'
    dressing instead of the look's (the exterior hull, wall3d_ext); a shell with no_skirt has no skirt plates, one with
    no_cap no cap plates. above: only what stands over that height (hull_cap), its faces there a black cut."""
    global END_TOPS, SHELL
    sp = SHELL = (shell or style().shell or Shell)(mask, fam, level, 1 if deco == 1 else 0, corners)
    if PRE_HOOK:
        PRE_HOOK(sp)
    k = Relief(name or f"wall3d_{fam}_{mask}_{level}_{corners}")
    if above is not None:                               # (its faces over the height black, whatever the look says)
        face_col = sp.col_face
        sp.col_face = lambda face, x, y, z: CUT if z > above else face_col(face, x, y, z)     # noqa: E731
    W.emit(k.m, sp)
    if getattr(sp, "solid_extra", None):
        sp.solid_extra(k)
    if not getattr(sp, "no_cap", False):
        cap(k, sp)
    if above is not None:
        k.drop_below(above)
        return k.build()
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
            if style().shelf and not hull:              # a stub over a shelf: the face's art from the shelf up to
                from .faction.shell import _ends        # the cut (its lip and seams), cut off there, over a backing
                k.top = top                             # (a wall's end face: the backing only)
                paint(k, ax, plane, a, b, lip_heights(sp.zs)[0] - 0.01, top, -PAINT, "wall", 2)
                if not _ends(ax, plane, b, ends)[0]:
                    n0 = (len(k.m.f), len(k.ns.f) if k.ns is not None else 0)
                    (style().wall or wall_face)(k, ax, plane, a, b, ends, sp.zs, top, False)
                    k.clip_above(top, n0)
            continue
        full = top > W.skirt_top() + W.CUT + 0.05            # the hull stays full in the cutaway
        k.top = None if full else top
        if hull:
            (dress or style().hull or hull_face)(k, ax, plane, a, b, ends, sp.zs, top, full, sp.variant)
        else:
            (style().wall or wall_face)(k, ax, plane, a, b, ends, sp.zs, top, full)
    if HOOK:
        HOOK(k, sp)
    return k.build()


def _end_spans(fam, side, level, corners):
    """An end face's section: [(u0, u1, top)] across the tile (0 its far edge), from the floor up."""
    t, top, zs = W.profile(fam, level)
    lo, hi = (0.0, t) if fam == "hull" else (W.wall_back(), W.wall_back() + W.TW)
    p0, p1 = W.wall_back(), W.wall_back() + W.TW
    fz = W.fill_top(fam, level)
    lo_bit, hi_bit = (4, 2) if side == "s" else (1, 2)
    eo = PX if style().end_out is None else style().end_out     # past the face's line, to cover its parts
    spans = [(lo, hi if corners & hi_bit else hi + eo, top)]
    if corners & lo_bit:
        spans.append((0.0, p0, fz))
    if corners & hi_bit:
        spans.append((p1, 1.0, fz))
    return spans


def hull_cap_end(side, corners=0):
    """The far hull's end section over the partition's (end_face("wall"), drawn under it): the hull behind the
    partition, its section in the partition's tone, and all of it over the partitions' height a black cut. A plain
    block: it lies beside the partition's section, over only the cut of its hidden back skirt, which the hull's
    section covers (as a holdout, coplanar with it, that cut came through in specks)."""
    hs, ws = _end_spans("hull", side, "up", corners), _end_spans("wall", side, "up", corners)
    ax = "y" if side == "s" else "x"
    k = Relief(f"wall3d_hullcap_end_{side}_{corners}")
    k.side = ax
    def quad(u0, u1, z0, z1, lvl, d=0.0, col=None):
        k.poly([P(ax, 0.5, u - 0.5, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", lvl, OUT(ax),
               fixed=col)
    us = sorted({u for a, b, _ in hs + ws for u in (a, b)})
    starts = {a for a, _, _ in ws}
    for u0, u1 in zip(us, us[1:]):
        m = (u0 + u1) / 2
        h = max([zt for a, b, zt in hs if a <= m < b], default=0.0)
        w = max([zt for a, b, zt in ws if a <= m < b], default=0.0)
        z1 = min(h, W.HF)
        if z1 > w + 1e-6:                               # the hull's section beside the partition's: over the outline
            ue = u1 + LINE if any(abs(u1 - a) < 1e-9 for a in starts) else u1   # down the partition's back edge,
            quad(u0, ue, w, z1, 2)                                              # its own down its back edge and its
            if u0 < 1e-9:                                                       # lit lip along the top, on into
                quad(0.0, LINE, w, z1, 1, PAINT)                                # the partition's
            quad(u0, ue, z1 - 0.026, z1, 4, PAINT)
        if h > max(w, W.HF) + 1e-6:
            quad(u0, u1, max(w, W.HF), h, 2, col=CUT)                           # (over their height: a black cut)
    return k.build()


def end_face(fam, side, level="up", corners=0):
    """walls.end_face in relief: the wall's section where it butts into the low hull ghost (+y end of an S arm: side
    s; +x end of an E arm: e). It reaches the floor: the ghost is see-through, so a section stopping at its rim (as
    walls.end_face does) left the floor showing through the wall's open end. It takes in the raised frame on the
    wall's visible face: one smooth face with a lit lip under the cap and a dark outline round its silhouette, down
    the wall's edges and on along the slope of the skirts' cut sections (in the plates' tone)."""
    t, top, zs = W.profile(fam, level)
    run_ = W.skirt_run()
    hi = W.wall_back() + W.TW
    hi_bit = 2
    spans = _end_spans(fam, side, level, corners)
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
    if not corners & hi_bit and seam() > 0:   # the visible face's ramp ends here: one
        fa = "x" if side == "s" else "y"         # whole plate over the last (narrow) plate and its seam, so the ramp
                                                 # does not stop short (one plate a tile has no such seam)
        plane = hi - 0.5
        nrm = (OUT(fa) * zs / run_ + Vector((0, 0, 1))).normalized()
        k.side = fa

        def pt(u, dd, rise):
            return P(fa, plane, u, zs * (1 - dd / run_), dd) + nrm * rise
        off = seam()
        u0, d0, d1 = 0.5 - (max(2 * STILE, off) if off > 0 else 0.15), 0.02, run_ - 0.045
        plate(k, [(u0, d0), (0.5, d0), (0.5, d1), (u0, d1)], pt, nrm, 0.0, 2 * PAINT, F, 2)
        if style().toe:                                        # the faction's band runs on to the end
            ta = style().toe_at
            plate(k, [(u0, ta * run_), (0.5, ta * run_), (0.5, d1), (u0, d1)], pt, nrm, 0.0, 3 * PAINT,
                  style().toe, 3, base=2 * PAINT)
        k.side = ax
    edges = [(a, b) for a, b, _ in spans]
    ft = style().foot                               # the skirts' profile: the look's (an upright foot under its slope,
    run = math.ceil(run_ * W.GN - 1e-6) / W.GN if ft else run_     # its run on the cells) or the plain slope
    n = 64
    us = sorted({c / n for c in range(n + 1)} | {u for a, b in edges for u in (a - run, b + run) if 0 < u < 1})
    for u0, u1 in zip(us, us[1:]):                                           # the skirts' cut sections
        if any(a <= (u0 + u1) / 2 < b for a, b in edges):
            continue
        dist = lambda u: min(max(a - u, u - b) for a, b in edges)           # noqa: E731
        if dist((u0 + u1) / 2) > run:                                       # (past the toe: no skirt; a column
            continue                                                        # is split where the foot stands)
        zt = [ft + (zs - ft) * max(0.0, 1.0 - dist(u) / run) for u in (u0, u1)]
        if max(zt) <= 1e-6:
            continue
        lip = [max(0.0, z - 0.026) for z in zt]
        k.poly([P(ax, 0.5, u0 - 0.5, 0.0, 0.0), P(ax, 0.5, u1 - 0.5, 0.0, 0.0),
                P(ax, 0.5, u1 - 0.5, lip[1], 0.0), P(ax, 0.5, u0 - 0.5, lip[0], 0.0)], F, 2, OUT(ax))
        k.poly([P(ax, 0.5, u0 - 0.5, lip[0], PAINT), P(ax, 0.5, u1 - 0.5, lip[1], PAINT),
                P(ax, 0.5, u1 - 0.5, zt[1], PAINT), P(ax, 0.5, u0 - 0.5, zt[0], PAINT)], F, 1, OUT(ax))
    return [k.m.build()]
