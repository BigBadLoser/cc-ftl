"""Derelict wall dressing (grid frame, origin = tile centre at floor level, same as walls.py).

- Breached walls: tile.{wall|hull}.{full.|}m{mask}.breach replace the intact piece. The wall is torn down to a few big
  jagged teeth with the frame ribs left standing and cables hanging out; the torn top shows the wall's cross-section (two
  lit skins round a black core). The tear reaches EDGE[level] at every tile edge, so breached runs join; where the -x /
  -y neighbour is intact the renderer adds tile.{fam}.{full.|}breach.end.{w|n}, the intact wall's exposed end.
- Face decals on a straight run's camera-facing face and skirt (x: the run along x, face toward +y; y: along y, face
  toward +x): scorch (.v0 / .v1), alien growth, and the red emergency striplight (on the skirt near its toe in every
  level; .high on the face, walls up only)."""
import math

from . import core
from . import walls as W
from . import wallart as A

GN = W.GN
C = 1 / GN


def _prof(pts, t):
    """Piecewise linear profile through (t, z) points (t from -0.5 to 0.5)."""
    for (t0, z0), (t1, z1) in zip(pts, pts[1:]):
        if t0 <= t <= t1:
            return z0 + (z1 - z0) * (t - t0) / (t1 - t0)
    return pts[-1][1]


# Tear profiles along an arm (t from the -x / -y tile edge to the +x / +y edge), as fractions between the tear bottom
# (0) and the edge height (1); a few big teeth, never noise. Ribs: (t, height above the tear bottom as a fraction).
TEAR = {"x": [(-0.5, 1.0), (-0.38, 0.92), (-0.27, 0.3), (-0.17, 0.62), (-0.06, 0.0), (0.12, 0.08), (0.24, 0.55),
              (0.31, 0.2), (0.42, 0.85), (0.5, 1.0)],
        "y": [(-0.5, 1.0), (-0.4, 0.8), (-0.3, 0.15), (-0.12, 0.35), (0.0, 0.0), (0.16, 0.45), (0.27, 0.1),
              (0.4, 0.9), (0.5, 1.0)]}
RIBS = {"x": [(-0.11, 1.5), (0.18, 1.25)], "y": [(-0.2, 1.4), (0.1, 1.2)]}


def tear_range(fam, level):
    """(tear bottom, edge height) of a breached piece."""
    zs = W.skirt_top()
    if fam == "hull":
        return zs + 0.08, 1.15
    if level == "up":
        return zs + 0.08, 1.1
    return zs + 0.06, W.wall_top("wall", level)                          # cut: the tear drops to just over the skirt


class Breach(W.Strip):
    def __init__(self, mask, fam, level):
        super().__init__(mask, fam, level)
        self.lo, self.edge = tear_range(fam, level)

    def _arm(self, r):
        if r is self.rects[0]:
            return "x" if (self.mask & 10 or not self.mask & 5) else "y"
        return "x" if (r[0][1] == 0.5 or r[0][0] == -0.5) else "y"

    def _cell(self, i, j):
        """(rect, arm, tear top, is_rib) of a covered cell."""
        cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
        r = self._rect_at(cx, cy, 0.0)
        if not r:
            return None
        ax = self._arm(r)
        t = cx if ax == "x" else cy
        span = self.edge - self.lo
        z = self.lo + span * _prof(TEAR[ax], t)
        w = self._skin(r, ax, cx, cy) * self._thick(r, ax)
        mid = abs(w - self._thick(r, ax) / 2) < 1.6 * C
        rib = mid and any(abs(t - tr) < C * 1.01 for tr, _ in RIBS[ax])
        if rib:
            hr = max(h for tr, h in RIBS[ax] if abs(t - tr) < C * 1.01)
            z = max(z, min(r[3] - 0.12, self.lo + span * hr))
        return r, ax, min(r[3], z), rib

    def _thick(self, r, ax):
        return (r[0][3] - r[0][2]) if ax == "x" else (r[0][1] - r[0][0])

    def cell_top(self, i, j):
        c = self._cell(i, j)
        return c[2] if c else None

    def _skin(self, r, ax, x, y):
        """0..1 across the wall (0 = the far side): the outer cells are the lit skins."""
        x0, x1, y0, y1 = r[0]
        w = (y - y0) / (y1 - y0) if ax == "x" else (x - x0) / (x1 - x0)
        return w

    def col_top(self, i, j, kind, x, y):
        r, ax, z, rib = self._cell(i, j)
        if z >= r[3] - 1e-6:
            return super().col_top(i, j, kind, x, y)
        if rib:
            return "gm"
        w = self._skin(r, ax, x, y)
        n = self._thick(r, ax)
        R = A.ramp("blue" if r[1] == "hull" else "wall", "y")
        if w * n < 1.5 * C or (1 - w) * n < 1.5 * C:
            return R["H"]
        return R["D"]

    def col_face(self, face, x, y, z):
        e = 0.5 / GN
        px, py = (x, y - e) if face == "y" else (x - e, y)
        i, j = int((px + 0.5) * GN), int((py + 0.5) * GN)
        c = self._cell(min(GN - 1, i), min(GN - 1, j))
        if c and c[2] < c[0][3] - 1e-6:
            r, ax, top, rib = c
            if rib:
                return "gmD" if face == "x" else "gm"
            cross = (face == "x") == (ax == "x")                         # the face cuts across the wall: its section
            R = A.ramp("blue" if r[1] == "hull" else "wall", face)
            if cross:
                w = self._skin(r, ax, x, y)
                n = self._thick(r, ax)
                if w * n < 1.5 * C or (1 - w) * n < 1.5 * C:
                    return R["L"]
                return R["D"]
            if z > top - 0.04:
                return R["H"]                                            # bright torn lip
        return super().col_face(face, x, y, z)


def _cables(m, fam, mask, level):
    """Two cables hanging out of the tear down the camera-facing face(s), resting on the skirt toe."""
    lo, _ = tear_range(fam, level)
    yf = (-0.5 + W.hull_thick()) if fam == "hull" else (-0.5 + W.wall_back() + W.TW)
    run = W.skirt_run()
    zs = W.skirt_top()
    faces = []
    if mask & 10 or not mask & 5:
        faces.append(("x", (-0.08, "hivis"), (0.14, "strap")))
    if mask & 5 and not mask & 10:
        faces.append(("y", (0.0, "hivis"), (-0.27, "strap")))
    for ax, *cs in faces:
        for t, col in cs:
            n = 14
            for k in range(n):
                f0, f1 = k / n, (k + 1) / n
                z0, z1 = lo + 0.02 - (lo + 0.02) * f0, lo + 0.02 - (lo + 0.02) * f1
                d0 = yf + 0.03 + max(0.0, (zs - z0)) / zs * run * 0.9      # follows the skirt once below its top
                d1 = yf + 0.03 + max(0.0, (zs - z1)) / zs * run * 0.9
                sway = 0.03 * math.sin(f0 * 2.5 + t * 7)
                a = (t + sway, d0) if ax == "x" else (d0, -t + sway)
                b = (t + sway, d1) if ax == "x" else (d1, -t + sway)
                cz, h = (z0 + z1) / 2, abs(z0 - z1) + 0.02
                cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                m.box((cx, cy, cz), (0.045, 0.045, h), col)
            end = (t + 0.05, yf + run * 0.95) if ax == "x" else (yf + run * 0.95, -t + 0.05)
            m.box((end[0], end[1], 0), (0.07, 0.07, 0.04), "brass", base=True)


def breach(mask, fam, level):
    m = core.Mesh(f"breach_{fam}_{mask}_{level}", flat=True)
    W.emit(m, Breach(mask, fam, level))
    _cables(m, fam, mask, level)
    return [m.build()]


def breach_end(fam, side, level):
    """The intact neighbour's end, exposed at the -x (w) / -y (n) edge of a breached piece: from the tear's edge
    height up to the full wall top, coloured as the wall's cross-section."""
    lo, edge = tear_range(fam, level)
    top = W.wall_top(fam, level)
    t = W.hull_thick() if fam == "hull" else W.TW
    p0 = -0.5 if fam == "hull" else -0.5 + W.wall_back()
    m = core.Mesh(f"breach_end_{fam}_{side}_{level}", flat=True)
    R = A.ramp("blue" if fam == "hull" else "wall", "x" if side == "w" else "y")
    n = max(1, round(t * GN))
    for c in range(n):
        u0, u1 = p0 + c * C, p0 + (c + 1) * C
        col = R["L"] if c in (0, n - 1) else R["D"]
        if side == "w":
            a, b = (-0.5, u1), (-0.5, u0)
        else:
            a, b = (u0, -0.5), (u1, -0.5)
        m.poly([core.G(*a, edge), core.G(*b, edge), core.G(*b, top), core.G(*a, top)], col)
    return [m.build()]


# ---- face decals -------------------------------------------------------------------------------------------------

def face_plane(fam):
    """Distance of a straight run's camera-facing face from the tile's far edge, and the skirt run."""
    yf = (-0.5 + W.hull_thick()) if fam == "hull" else (-0.5 + W.wall_back() + W.TW)
    return yf, W.skirt_run()


def decal(name, ax, fam, level, fn, lift=0.004):
    """A flat-toned decal on the face (z from the skirt top to the wall top) and the skirt of a straight run.
    fn(where, s, z, ramp) -> palette name or None; where = 'face' | 'skirt'; s runs screen left to right."""
    yf, run = face_plane(fam)
    zs, top = W.skirt_top(), W.wall_top(fam, level)
    m = core.Mesh(name, flat=True)
    R = A.ramp("blue" if fam == "hull" else "wall", "y" if ax == "x" else "x")
    nz = max(1, round((top - zs) / W.DZ))
    nr = max(1, round(run * GN))

    def P(s, d, z):          # s along the face, d out from the far edge, z
        return (s - 0.5, d, z) if ax == "x" else (d, 0.5 - s, z)

    if top - zs > 0.02:
        o = P(0, yf + lift, zs)
        e1 = [b - a for a, b in zip(o, P(1, yf + lift, zs))]
        m.pattern(o, e1, (0, 0, top - zs), GN, nz, lambda i, j: fn("face", (i + 0.5) / GN, zs + (j + 0.5) / nz * (top - zs), R))
    o = P(0, yf + run, lift)
    e1 = [b - a for a, b in zip(o, P(1, yf + run, lift))]
    e2 = [b - a for a, b in zip(o, P(0, yf + lift * 0.5, zs + lift))]
    m.pattern(o, e1, e2, GN, nr, lambda i, j: fn("skirt", (i + 0.5) / GN, zs * (j + 0.5) / nr, R))
    return m


def _lobes(s, parts):
    return sum(a * math.cos(k * (s * math.tau) + p) for k, a, p in parts)


def scorch(ax, fam, level, v):
    """Soot from a fire at the wall's foot: a plume that widens as it rises and ends in a rounded top, banded char /
    near-black / the wall's dark tone (big lobes, no speckle). The skirt carries the plume's root."""
    zs, top = W.skirt_top(), W.wall_top(fam, level)
    cs = (0.45, 0.58)[v]
    hmax = (0.62, 0.5)[v] * (W.HF - zs)
    w0, w1 = (0.2, 0.42) if v == 0 else (0.16, 0.36)
    parts = [(2, 0.1, 0.3 + v), (3, 0.06, 1.7 * v + 0.5)]
    K = "bK" if fam == "hull" else "wK"

    def band(f):
        return "dark" if f < 0.3 else (K if f < 0.6 else None)

    def fn(where, s, z, R):
        if where == "face" and z > top - 0.08:
            return None
        if where == "skirt":
            f = abs(s - cs) / (w0 * (0.8 + 0.6 * z / zs))
            return band(f) if f < 0.75 else (R["D"] if f < 1 else None)
        u = (s - cs) / w1
        tongue = 0.6 + 0.4 * math.cos(u * 3.4 * math.pi) * (1 - abs(u))     # three licks of flame along the top
        zz = (z - zs) / (hmax * tongue * (1 + _lobes(s, parts)))
        half = w0 + (w1 - w0) * min(1.0, zz * 1.4)
        f = abs(s - cs) / half
        if zz > 1 or f > 1:
            return None
        g = max(f * 0.8, zz)
        return band(g) or R["D"]
    return [decal(f"scorch_{fam}_{ax}_{level}_{v}", ax, fam, level, fn).build()]


def growth(ax, fam, level):
    """Alien resin creeping up from the floor: it climbs the skirt in lobes and reaches the face only in a couple of
    tongues, banded ridges and two glowing pods. Measured as one unrolled height (along the skirt, then up the face)."""
    zs, top = W.skirt_top(), W.wall_top(fam, level)
    _, run = face_plane(fam)
    L = math.hypot(zs, run)                                           # the skirt's slope length
    parts = [(2, 0.22, 0.4), (3, 0.16, 2.1), (5, 0.08, 0.7)]
    pods = [(0.42, L * 0.55, 0.05), (0.66, L * 0.3, 0.04)]

    def fn(where, s, z, R):
        if where == "face" and z > top - 0.08:
            return None
        v = z / zs * L if where == "skirt" else L + (z - zs)
        for ps, pv, pr in pods:
            d = math.hypot(s - ps, (v - pv) * 1.2) / pr
            if d < 1:
                return "xnG" if d < 0.55 else "xnA"
        hc = L * (0.55 + 0.6 * _lobes(s, parts) + 0.25) * (1 - (2 * s - 1) ** 6)
        if v > hc:
            return None
        if v > hc - 0.035:
            return "xnK"
        if v > hc - 0.07:
            return "xnL"
        return "xnD" if (v * 9 + 1.5 * math.sin(s * 11)) % 1 < 0.22 else "xnM"
    return [decal(f"growth_{fam}_{ax}_{level}", ax, fam, level, fn).build()]


def striplight(ax, fam, high):
    """Dim red emergency striplight in a dark housing: on the skirt near its toe (every level), or chest high on the
    face (.high, walls up only)."""
    yf, run = face_plane(fam)
    zs = W.skirt_top()
    m = core.Mesh(f"strip_{fam}_{ax}_{int(high)}", flat=True)

    def put(s, d, z, size, col, tilt):
        c = (s, d, z) if ax == "x" else (d, -s, z)
        sz = size if ax == "x" else (size[1], size[0], size[2])
        rx, ry = (tilt, 0.0) if ax == "x" else (0.0, -tilt)
        m.box(c, sz, col, rx=rx, ry=ry)

    if high:
        put(0.0, yf + 0.02, 1.32, (0.7, 0.04, 0.09), "gmD", 0.0)
        put(0.0, yf + 0.045, 1.32, (0.62, 0.02, 0.045), "emR", 0.0)
    else:
        d = yf + run * 0.78
        z = zs * (1 - 0.78) + 0.01
        tilt = -math.atan2(zs, run) if ax == "x" else math.atan2(zs, run)
        put(0.0, d, z, (0.78, 0.09, 0.03), "gmD", tilt)
        put(0.0, d + 0.004, z + 0.018, (0.7, 0.045, 0.02), "emR", tilt)
    return [m.build()]


PRE = {"up": "full.", "cut": ""}
SPRITES = []
for _fam in ("wall", "hull"):
    for _lv, _pre in PRE.items():
        for _m in range(16):
            SPRITES.append((f"tile.{_fam}.{_pre}m{_m}.breach", (1, 1), "block",
                            lambda m=_m, f=_fam, lv=_lv: breach(m, f, lv)))
        for _s in ("w", "n"):
            SPRITES.append((f"tile.{_fam}.{_pre}breach.end.{_s}", (1, 1), "block",
                            lambda s=_s, f=_fam, lv=_lv: breach_end(f, s, lv)))
    for _ax in ("x", "y"):
        lvls = ("up", "cut", "low") if _fam == "wall" else ("up", "cut")
        for _lv in lvls:
            for _v in (0, 1):
                SPRITES.append((f"decay.scorch.{_fam}.{_ax}.{_lv}.v{_v}", (1, 1), "block",
                                lambda a=_ax, f=_fam, lv=_lv, v=_v: scorch(a, f, lv, v)))
            SPRITES.append((f"decay.growth.{_fam}.{_ax}.{_lv}", (1, 1), "block",
                            lambda a=_ax, f=_fam, lv=_lv: growth(a, f, lv)))
        SPRITES.append((f"decay.striplight.{_fam}.{_ax}", (1, 1), "block", lambda a=_ax, f=_fam: striplight(a, f, False)))
        SPRITES.append((f"decay.striplight.{_fam}.{_ax}.high", (1, 1), "block",
                        lambda a=_ax, f=_fam: striplight(a, f, True)))
