"""Interior windows (walls up): a straight partition (mask 10, along x) opened between its posts, a beam over the
opening and a glass pane in it. A window piece is the look's own straight piece cut open: its body between the sill
(the lip's top over the ramp) and the beam (under the header's shadow) taken out over the opening, the cut closed (the
post's section, the sill's top, the beam's underside), the pane in the wall's middle plane, and the pane's top edges
two blue lines along the beam's top. The ramp runs on under the opening as the sill.

wall3d.block calls HOOK(k, sp) on a piece's Relief before it builds; window() sets it while its piece builds.
PART: "l" (the post at the -x end, open on past +x), "m" (open across), "r" (the post at the +x end)."""
from mathutils import Vector

from . import wall3d as T
from . import walls as W
from .faction import base as FB
from .faction import tan as TAN
from .faction.parts import PZ

POST = 12 / 32          # an end post's length along the wall (ref: 12 px of front)
LINES = 3 / 32          # the pane's top edges on the beam: this apart, about the wall's middle
LINE_W = 1 / 32
LINE_COL = "fTG0"
SILL_COL = "fTG1"       # the sill's top and the beam's underside: the cap's black
PART = None
CLOSE = False           # (a preview of a piece on its own: its open end closed, the half arch's sections shown)
FB.TOP_KEEP.update((LINE_COL, SILL_COL))
GLASS = None            # the pane's Relief, built by the piece (the glass render kind's second list)


def _heights():
    """(sill top, beam underside): the ramp's top (no lip over the opening: the pane down to the ramp); under
    the header cushion's shadow bands."""
    zs = W.skirt_top()
    z1 = W.HF - 0.031                                   # (tan: the header's top under the cap's black)
    zs0 = z1 - TAN.HEAD_H - TAN._hid(TAN.HEAD_D)
    return zs, zs0 - 3 * PZ


def _span(part):
    return {"l": (-0.5 + POST, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - POST)}[part]


def _clip(pts, planes):
    """Sutherland-Hodgman: pts (tuples) kept where s * (p[i] - v) >= 0 for each (i, v, s)."""
    for i, v, s in planes:
        out = []
        for p, q in zip(pts, pts[1:] + pts[:1]):
            fp, fq = s * (p[i] - v), s * (q[i] - v)
            if fp >= -1e-9:
                out.append(p)
            if (fp >= -1e-9) != (fq >= -1e-9) and abs(fq - fp) > 1e-12:
                t = fp / (fp - fq)
                out.append(tuple(a + (b - a) * t for a, b in zip(p, q)))
        pts = out
        if len(pts) < 3:
            return []
    return pts


def _cut(k, x0, x1, z0, z1):
    """Take the box x0 < x < x1, z0 < z < z1 out of every polygon (what is left, in convex pieces)."""
    regions = [[(0, x0, -1)], [(0, x1, 1)], [(0, x0, 1), (0, x1, -1), (2, z0, -1)],
               [(0, x0, 1), (0, x1, -1), (2, z1, 1)]]
    for m in (k.m, k.ns):
        if m is None:
            continue
        out = []
        for f in m.f:
            pts = [m.v[i] for i in f[0]]
            xs, zs = [p[0] for p in pts], [p[2] for p in pts]
            if max(xs) <= x0 + 1e-9 or min(xs) >= x1 - 1e-9 or max(zs) <= z0 + 1e-9 or min(zs) >= z1 - 1e-9:
                out.append(f)
                continue
            for r in regions:
                q = _clip(pts, r)
                if len(q) < 3:
                    continue
                n = Vector(q[1]) - Vector(q[0])
                if max((Vector(a) - Vector(q[0])).cross(n).length for a in q) < 1e-10:
                    continue
                base = len(m.v)
                m.v += [tuple(p) for p in q]
                out.append((list(range(base, base + len(q))),) + tuple(f[1:]))
        m.f = out


def _quad(k, pts, out, col):
    k.poly([Vector(p) for p in pts], "wall", 2, Vector(out), fixed=col)


def hook(k, sp):
    x0, x1 = _span(PART)
    z0, z1 = _heights()
    yb, yf = W.wall_back() - 0.5, W.wall_back() - 0.5 + W.TW
    _cut(k, x0, x1, z0, z1)
    a, b = max(x0, -0.5), min(x1, 0.5)
    k.side = None
    if x0 > -0.5:                                       # the posts' sections
        _quad(k, [(x0, yb, z0), (x0, yf, z0), (x0, yf, z1), (x0, yb, z1)], (1, 0, 0), TAN.END["x"])
    if x1 < 0.5:
        _quad(k, [(x1, yb, z0), (x1, yf, z0), (x1, yf, z1), (x1, yb, z1)], (-1, 0, 0), TAN.END["x"])
    _quad(k, [(a, yb, z0), (b, yb, z0), (b, yf, z0), (a, yf, z0)], (0, 0, 1), SILL_COL)
    _quad(k, [(a, yb, z1), (b, yb, z1), (b, yf, z1), (a, yf, z1)], (0, 0, -1), SILL_COL)
    if CLOSE and x1 > 0.5:
        _close(k, yb, yf, z0, z1)
    zt = max(v[2] for v in k.m.v) + 0.002                # the pane's top edges on the beam's top
    for c in (-LINES / 2, LINES / 2):
        y0, y1 = -c - LINE_W / 2, -c + LINE_W / 2       # (grid y; G flips it, symmetric anyway)
        _quad(k, [(a, y0, zt), (b, y0, zt), (b, y1, zt), (a, y1, zt)], (0, 0, 1), LINE_COL)
    global GLASS
    GLASS = T.Relief("iwin_glass")
    GLASS.poly([Vector(p) for p in ((a, 0.0, z0), (b, 0.0, z0), (b, 0.0, z1), (a, 0.0, z1))], "wall", 2,
               Vector((0, 1, 0)), fixed="glassL")


def _close(k, yb, yf, z0, z1):
    """The piece's +x end as a free end's: the foot and ramps' section (shell._end_section) on up to the sill, the
    beam's over the opening (with the lip's and the header cushion's, proud of the face), in the free ends' slate."""
    from .faction.parts import body
    from .faction.shell import _end_section
    col, edge = TAN.END["x"], TAN.END_EDGE["x"]
    zs, top = W.skirt_top(), W.HF
    zh1 = top - 0.031
    zh0 = zh1 - TAN.HEAD_H
    _end_section(k, "x", 0.5, yb, yf, zs, z0, body(False), col=col, edge=edge)
    for y0, y1, za, zb in ((yb, yf, zs, z0), (yf, yf + TAN.LIP_D, zs, z0), (yb, yf, z1, top),
                           (yf, yf + TAN.HEAD_D, zh0, zh1)):
        _quad(k, [(0.5, y0, za), (0.5, y1, za), (0.5, y1, zb), (0.5, y0, zb)], (1, 0, 0), col)
    _quad(k, [(0.5 + 0.004, yf + TAN.HEAD_D - 1 / 32, zh0), (0.5 + 0.004, yf + TAN.HEAD_D, zh0),
              (0.5 + 0.004, yf + TAN.HEAD_D, zh1), (0.5 + 0.004, yf + TAN.HEAD_D - 1 / 32, zh1)], (1, 0, 0), edge)


def window(fn, part):
    """fn: the look's straight piece builder (tile.wall.<look>.full.m10). (solid objects, pane objects)."""
    def build():
        global PART
        PART = part
        T.HOOK = hook
        try:
            r = fn()
            solid = r[0] if isinstance(r, tuple) else r
            glass = GLASS.build()
            import bpy                                  # (a wide piece's copies past the tile: not in this render)
            for o in list(bpy.context.scene.objects):
                if o not in solid and o not in glass and o.type == "MESH":
                    bpy.data.objects.remove(o)
            return solid, glass
        finally:
            PART, T.HOOK = None, None
    return build
