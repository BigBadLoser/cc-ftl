"""Rock walls (rockwall.py): the stone. Bricks cut into the face and carried down the skirt, and the light they bake.

Every brick is half a tile long and one course high (the footing's course measured along its slope, so face and footing
bricks match), stands a little proud of the mortar and is bevelled down to it on every joint edge. Bricks are coloured
by the cliff layer at their height (rock_base's shared strata) and cut a little differently each (bevel, proudness, a
slight lean), keyed to their position, so a brick split across a tile edge matches on both sides.

Lit: the walls bake their own light into unlit colours, so every flat face is one clean tone (the renderer's world
light would band a plane into arcs). The key is symmetric across the diagonal: both wall directions are lit alike."""
import bisect
import math

from mathutils import Matrix, Vector

from . import core
from . import walls as W
from .rock_base import LCOLS, LEVELS, Canvas, polyg, quad

FINE = 64                                    # the shell's grid (the metal walls use walls.GN = 32)
CH = 0.03                                    # bevel width (two pixels or so at 2x: one dots)
GROOVE = 0.009                               # how far a brick stands proud: a low bevel, so a joint reads
                                             # shallow from every side (no edge turns black or vanishes)
JOINT = 0.016                                # the flat mortar line between bricks (about a pixel at 2x)
BLOCK = 0.5                                  # brick length (the face and the footing alike)
TILT = 0.006                                 # the most a brick's face leans (depth difference, top to bottom)
SKIRT_N = 2                                  # brick courses down the skirt
SKIRT_GAP = 0.016                            # the footing's mortar line (= JOINT)
MORTAR = "rkK"                               # the joints' floor (the cliffs' seam tone), face and slope
CLIFF = {"rkD": "rkD", "rkM": "rkDM", "rkK": "rkD"}  # bricks in the cliffs' stone: their body, and their paler
                                                     # beds only a shade lighter (rkDM, halfway to rkM)


def _hash(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def brick_tone(z):
    """A brick takes the colour of the cliff layer at its height, so a wall cut from the rock keeps the cliffs'
    horizontal layering; by height, not by brick, so nothing lines up into columns along a run."""
    i = max(0, min(len(LEVELS) - 2, bisect.bisect_right(LEVELS, z) - 1))
    return CLIFF.get(LCOLS[i], "rkD")


def brick_var(course, start):
    """One brick's own cut, from its course and position: (bevel width, how far it stands proud, its lean)."""
    h = _hash(course, int(round(((start + 0.5) % 1.0) * 997)), 11)
    f = lambda n, m: (h // n % m) / (m - 1)               # noqa: E731
    return CH * (0.7 + 0.6 * f(1, 97)), GROOVE * (0.75 + 0.5 * f(97, 89)), TILT * (2 * f(8633, 101) - 1)


def course_h():
    """A brick's height: the footing's course measured along its slope, so face and footing bricks match."""
    run, zs = W.skirt_run(), W.skirt_top()
    return run / SKIRT_N * math.hypot(1.0, zs / run)


def courses(zs, top):
    """(z0, z1, joints along u) of each course of a face from just under the skirt crest to the wall top."""
    lo, hi = zs - 0.06, top
    n = max(1, int(round((hi - lo) / course_h())))
    return [(lo + (hi - lo) * c / n, lo + (hi - lo) * (c + 1) / n,
             tuple(-0.5 + (c % 2) * BLOCK / 2 + k * BLOCK for k in range(int(1 / BLOCK)))) for c in range(n)]


def _near_joint(u, joints, w):
    return any(abs(((u - jt) + 0.5) % 1.0 - 0.5) < w for jt in joints)


def _pt(ax, plane, u, z, d):
    return Vector((u, plane + d, z)) if ax == "y" else Vector((plane + d, u, z))


def panel(k, ax, plane, u0, u1, z0, z1, cham, col, var):
    """A brick on a face, standing proud of the wall plane and bevelled down to the joint on each edge in cham (l, r,
    b, t); var = brick_var."""
    out = Vector((0, 1, 0)) if ax == "y" else Vector((1, 0, 0))
    g = JOINT / 2                                    # each side of a joint keeps half the mortar line
    u0, u1 = u0 + (g if cham[0] else 0), u1 - (g if cham[1] else 0)
    z0, z1 = z0 + (g if cham[2] else 0), z1 - (g if cham[3] else 0)
    ch, proud, tilt = var
    i0, i1 = u0 + (ch if cham[0] else 0), u1 - (ch if cham[1] else 0)
    j0, j1 = z0 + (ch if cham[2] else 0), z1 - (ch if cham[3] else 0)
    if i1 - i0 < ch or j1 - j0 < ch:
        return
    zc = (j0 + j1) / 2
    front = [_pt(ax, plane, u, z, max(0.003, proud + tilt * (z - zc) / (j1 - j0)))
             for u, z in ((i0, j0), (i1, j0), (i1, j1), (i0, j1))]
    polyg(k, front, col, out)
    oc = [(u0 if cham[0] else i0, z0 if cham[2] else j0), (u1 if cham[1] else i1, z0 if cham[2] else j0),
          (u1 if cham[1] else i1, z1 if cham[3] else j1), (u0 if cham[0] else i0, z1 if cham[3] else j1)]
    outer = [_pt(ax, plane, u, z, 0.0) for u, z in oc]
    for e, (p, q), nrm in ((0, (3, 0), (-1, 0)), (1, (1, 2), (1, 0)), (2, (0, 1), (0, -1)), (3, (2, 3), (0, 1))):
        if cham[e]:
            nv = (Vector((nrm[0], 0, nrm[1])) if ax == "y" else Vector((0, nrm[0], nrm[1]))) + out
            quad(k, front[p], front[q], outer[q], outer[p], col, nv)
            soften(k, out)


def relight(k, slope_normal, face_normal):
    """Mark the polygon just added as part of the footing: Lit.build scales its light by the wall face's over the
    slope's, so the footing sits in the wall's own tone (as the metal walls paint the skirt in the face's ramp) and
    keeps only its bevels' modelling."""
    if isinstance(k, Lit):
        k.relit[len(k.m.f) - 1] = (core.G(*slope_normal).normalized(), core.G(*face_normal).normalized())


def soften(k, plane_normal, amount=None):
    """Mark the polygon just added as a bevel: it is lit partly as its plane (Lit.build), so a joint reads shallow
    from every side and never drops to black on the shaded faces. amount: how far it turns (default BEVEL_LIGHT)."""
    if isinstance(k, Lit):
        k.soft[len(k.m.f) - 1] = (core.G(*plane_normal).normalized(), BEVEL_LIGHT if amount is None else amount)


def dressed_face(k, ax, plane, a, b, zs, top, limit=None):
    """Bricks over a face from a to b (u), course by course, with the mortar behind them; limit(u0, u1) caps the
    bricks under a breach's tear."""
    out = Vector((0, 1, 0)) if ax == "y" else Vector((1, 0, 0))
    cs = courses(zs, top)
    for ci, (z0, z1, joints) in enumerate(cs):
        cuts = sorted({a, b} | {jt + sh for jt in joints for sh in (-1, 0, 1) if a < jt + sh < b})
        for u0, u1 in zip(cuts, cuts[1:]):
            t = z1
            if limit:
                t = min(z1, limit(u0, u1) - 0.02)
                if t <= z0 + 2 * CH:
                    continue
            polyg(k, [_pt(ax, plane, u0, z0, 0.0), _pt(ax, plane, u1, z0, 0.0),
                      _pt(ax, plane, u1, t, 0.0), _pt(ax, plane, u0, t, 0.0)], MORTAR, out)  # the mortar behind
            cham = (u0 > a + 1e-6 or _near_joint(u0, joints, 1e-4), u1 < b - 1e-6 or _near_joint(u1, joints, 1e-4),
                    ci > 0, ci < len(cs) - 1 and t >= z1 - 1e-6)
            start = max(jt + sh for jt in joints for sh in (-2, -1, 0, 1) if jt + sh <= u0 + 1e-9)
            panel(k, ax, plane, u0, u1, z0, t, cham, brick_tone((z0 + z1) / 2), brick_var(ci, start))


def _clip(poly, f):
    """Keep the part of a 2D polygon where f(p) >= 0 (f linear)."""
    out = []
    for i, a in enumerate(poly):
        b = poly[(i + 1) % len(poly)]
        fa, fb = f(a), f(b)
        if fa >= 0:
            out.append(a)
        if (fa >= 0) != (fb >= 0):
            t = fa / (fa - fb)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def _end(sp, ax, plane, u, side):
    """How a face's skirt ends at u: 'cont' (runs on into the next tile), 'in' (an arm comes forward: an inner corner)
    or 'out' (the wall turns away or ends: the skirt wraps round an outer corner)."""
    if abs(u) > 0.5 - 1e-6:
        return "cont"
    e = 1e-3
    q = (u + side * e, plane + e) if ax == "y" else (plane + e, u + side * e)
    return "in" if sp._rect_at(*q, 0.0) else "out"


def _inset(poly, w):
    """A convex polygon (counter-clockwise or clockwise) shrunk by w: each edge moved in by w."""
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln * sgn, dx / ln * sgn                       # inward normal
        lines.append(((x0 + nx * w, y0 + ny * w), (dx, dy)))
    out = []
    for i in range(n):
        (p, dp), (q, dq) = lines[i - 1], lines[i]
        den = dp[0] * dq[1] - dp[1] * dq[0]
        if abs(den) < 1e-12:
            out.append(q)
            continue
        t = ((q[0] - p[0]) * dq[1] - (q[1] - p[1]) * dq[0]) / den
        out.append((p[0] + dp[0] * t, p[1] + dp[1] * t))
    return out


def skirt_blocks(k, sp, ax, plane, a, b):
    """The wall's brick courses carried down the skirt's slope, cut like the face's: flat stones whose edges are
    chamfered down to the joints, staggered on from the face's bond, mitred where the slope turns a corner."""
    run, zs = sp.run, sp.zs
    out = Vector((0, 1, 0)) if ax == "y" else Vector((1, 0, 0))
    nrm = (out * zs / run + Vector((0, 0, 1))).normalized()          # the slope's normal
    lo_t, hi_t = _end(sp, ax, plane, a, -1), _end(sp, ax, plane, b, 1)
    lo = {"cont": lambda p: p[0] - a, "in": lambda p: p[0] - (a + p[1]), "out": lambda p: p[0] - (a - p[1])}[lo_t]
    hi = {"cont": lambda p: b - p[0], "in": lambda p: (b - p[1]) - p[0], "out": lambda p: (b + p[1]) - p[0]}[hi_t]

    def pt(u, d, rise):
        return _pt(ax, plane, u, zs * (1 - d / run), d) + nrm * rise
    step = run / SKIRT_N
    g = SKIRT_GAP / 2
    for c in range(SKIRT_N):
        d0, d1 = c * step + g, (c + 1) * step - (g if c < SKIRT_N - 1 else 0.004)
        off = ((c + 1) % 2) * BLOCK / 2                              # the face's bottom course has no offset
        k0 = math.floor((a - run - (-0.5 + off)) / BLOCK)
        for kk in range(k0, k0 + int((b - a + 2 * run) / BLOCK) + 3):
            u0 = -0.5 + off + kk * BLOCK
            poly = [(u0 + g, d0), (u0 + BLOCK - g, d0), (u0 + BLOCK - g, d1), (u0 + g, d1)]
            poly = _clip(_clip(poly, lo), hi)
            if len(poly) < 3:
                continue
            ch, proud, tilt = brick_var(-(c + 1), u0)
            inner = _inset(poly, ch)
            col = brick_tone(zs * (1 - (d0 + d1) / 2 / run))
            dm = (d0 + d1) / 2
            top = [pt(u, d, max(0.003, FOOT_PROUD * proud + tilt * (dm - d) / (d1 - d0))) for u, d in inner]
            polyg(k, top, col, nrm)
            relight(k, nrm, out)
            cen = sum(top, Vector()) / len(top)
            n = len(poly)
            for i in range(n):                                       # the chamfers, down to the joint
                j2 = (i + 1) % n
                p0, p1 = pt(*poly[i], 0), pt(*poly[j2], 0)
                quad(k, p0, p1, top[j2], top[i], col, (p0 + p1) / 2 - cen + nrm * 0.02)
                soften(k, nrm, 1.0)                    # the slope faces the light: its bevels need all their turn
                relight(k, nrm, out)


SUN = Vector((0.3, -0.3, 0.86)).normalized()               # the walls' key: symmetric across the diagonal,
                                                              # so a wall facing screen-left is lit exactly as one
                                                              # facing screen-right (the other axis), mirrored
VIEW = Matrix.Rotation(core.CAM_ROT[2], 3, "Z") @ Matrix.Rotation(core.CAM_ROT[0], 3, "X") @ Vector((0, 0, 1))
SUN_E = 1.25 * 3.9 / math.pi                                  # the sun, raised to match the cliffs (which also take the world light)
AMBIENT = 0.05                                                # the world's grey
BEVEL_LIGHT = 0.35                                            # how much a bevel turns from its plane, for the light
FOOT_PROUD = 1.8                                              # the footing's bricks stand prouder: a steeper bevel,
                                                              # since near-frontal light barely shades a shallow one


def light(n):
    """The scene's sun on a surface of normal n (Blender space), as a diffuse surface receives it."""
    return SUN_E * max(0.0, n.dot(SUN)) + AMBIENT


class Lit(Canvas):
    """A canvas whose faces carry their own light: each flat face is lit as the scene's sun would light it, baked into
    an unlit colour. Without the world's occlusion (which bands a plane into arcs) every plane is one clean tone, yet
    the tones match the rock, which the renderer lights."""
    def __init__(self, name):
        self.m = core.Mesh(name, flat=True)
        self.soft = {}                                            # bevel face index -> its plane's normal
        self.relit = {}                                           # footing face index -> (slope, wall face) normals

    def build(self):
        m = self.m
        for i, (idx, col, own, glow) in enumerate(m.f):
            a, b, c = (Vector(m.v[j]) for j in idx[:3])
            n = (b - a).cross(c - a)
            if n.length < 1e-12:
                continue
            n.normalize()
            if n.dot(VIEW) < 0:
                n = -n                                            # two-sided, like the renderer
            if i in self.soft:
                pn, amt = self.soft[i]
                pn = pn if pn.dot(VIEW) >= 0 else -pn
                n = (pn * (1 - amt) + n * amt).normalized()
            lam = light(n)
            if i in self.relit:
                sl, fc = self.relit[i]
                lam *= light(fc) / max(1e-6, light(sl))
            elif 0.15 < n.z < 0.95:                               # any other slope (bare skirt): its wall's tone too
                h = Vector((n.x, n.y, 0.0)).normalized()
                lam *= light(h) / max(1e-6, light(n))
            m.f[i] = (idx, col, tuple(v * lam for v in own), glow)
        return [m.build()]
