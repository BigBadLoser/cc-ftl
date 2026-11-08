"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

Look exploration (earlier rounds are in git history). One plant per tile, a lamp over the bed as the only pink glow:
  cab    a navy base with slatted panels, a glass cabin per plant in grey frames, a machinery block between them
  terra  the same base under one long cab-shaped glass canopy
  lab    a shallow pearl tray floating on a navy pedestal, a tapered blade spine with a mint stripe, a slim ring lamp
  lab.sand  lab in cream with an orange detail ring (REMAP swaps the colours)
Layers: `.off` / `.on` are the bed; `.crop.<test>` is a stand-in crop drawn on top of the bed, rendered with the bed as
a holdout so the lamp cuts the plant where it passes in front of it (two draws, no front layer). HYDRO_VARIANTS
narrows the build."""
import math
import os
import random

from . import core
from .modkit import K


# ---- geometry: prisms from (u, v) outlines -------------------------------------------------------------------------
def _cham(cu, cv, w, d, c):
    """CCW outline of a w x d rectangle centred at (cu, cv) with its corners cut by c."""
    a, b = w / 2, d / 2
    pts = [(-a + c, -b), (a - c, -b), (a, -b + c), (a, b - c), (a - c, b), (-a + c, b), (-a, b - c), (-a, -b + c)]
    return [(cu + x, cv + y) for x, y in pts]


def _pill_ol(cu, cv, L, w, n=8):
    """CCW outline of a pill L long (along u) and w wide, n points per round end."""
    r, s = w / 2, (L - w) / 2
    pts = [(s + r * math.cos(-math.pi / 2 + math.pi * i / n), r * math.sin(-math.pi / 2 + math.pi * i / n)) for i in range(n + 1)]
    pts += [(-s + r * math.cos(math.pi / 2 + math.pi * i / n), r * math.sin(math.pi / 2 + math.pi * i / n)) for i in range(n + 1)]
    return [(cu + x, cv + y) for x, y in pts]


def _circle(cu, cv, r, n=16):
    return [(cu + r * math.cos(math.tau * i / n), cv + r * math.sin(math.tau * i / n)) for i in range(n)]


def _scaled(ol, t):
    cu = sum(p[0] for p in ol) / len(ol)
    cv = sum(p[1] for p in ol) / len(ol)
    return [(cu + (u - cu) * t, cv + (v - cv) * t) for u, v in ol]


def _G(k, u, v, z):
    return core.G(*k.p(u, v), z)


def _prism(k, ol, z0, h, col, top=None, taper=1.0, bottom=False, lean=None, tl=None):
    """A solid with the outline ol (CCW) from z0 up h; its top outline shrunk by taper about the centre, or tl (the
    same point count: a flared or tapered body). lean = (vb, s) instead squeezes the top toward v = vb by s, so the
    face away from vb leans back (a console front)."""
    if tl is None:
        tl = _scaled(ol, taper) if lean is None else [(u, lean[0] + (v - lean[0]) * lean[1]) for u, v in ol]
    n = len(ol)
    for i in range(n):
        j = (i + 1) % n
        k.m.poly([_G(k, *ol[i], z0), _G(k, *ol[j], z0), _G(k, *tl[j], z0 + h), _G(k, *tl[i], z0 + h)], col, flip=True)
    k.m.poly([_G(k, *p, z0 + h) for p in tl], top or col, flip=True)
    if bottom:
        k.m.poly([_G(k, *p, z0) for p in ol[::-1]], col, flip=True)


def _ring(k, outer, inner, z0, h, col, top=None, inner_col=None):
    """A wall between two outlines of the same point count (a trough rim, a ring lamp): outer, inner and top faces."""
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        k.m.poly([_G(k, *outer[i], z0), _G(k, *outer[j], z0), _G(k, *outer[j], z0 + h), _G(k, *outer[i], z0 + h)], col, flip=True)
        k.m.poly([_G(k, *inner[j], z0), _G(k, *inner[i], z0), _G(k, *inner[i], z0 + h), _G(k, *inner[j], z0 + h)],
                 inner_col or col, flip=True)
        k.m.poly([_G(k, *outer[i], z0 + h), _G(k, *outer[j], z0 + h), _G(k, *inner[j], z0 + h), _G(k, *inner[i], z0 + h)],
                 top or col, flip=True)


def _tube(k, pts, r, col, n=8, caps=True):
    """A round tube through the local (u, v, z) points: a ring of n points at each, square to the path there."""
    def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
    def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
    def norm(a):
        m = math.sqrt(sum(x * x for x in a))
        return (a[0] / m, a[1] / m, a[2] / m)
    rings = []
    for i, p in enumerate(pts):
        t = norm(sub(pts[min(i + 1, len(pts) - 1)], pts[max(i - 1, 0)]))
        b1 = norm(cross(t, (1, 0, 0) if abs(t[0]) < 0.9 else (0, 1, 0)))
        b2 = cross(t, b1)
        rings.append([_G(k, *(p[j] + r * (math.cos(a) * b1[j] + math.sin(a) * b2[j]) for j in range(3)))
                      for a in (math.tau * q / n for q in range(n))])
    for r0, r1 in zip(rings, rings[1:]):
        for q in range(n):
            k.m.poly([r0[q], r0[(q + 1) % n], r1[(q + 1) % n], r1[q]], col, flip=True)
    if caps:
        k.m.poly(rings[0][::-1], col, flip=True)
        k.m.poly(rings[-1], col, flip=True)


def _well(k, inner, outer, z_rim, rim_h, rim, rim_top, wall, z_soil, soil_w, soil_d, seed=3, cu=0.0):
    """The rim lip round the soil well (inner and outer outlines) and the soil in it, its surface at z_soil."""
    _ring(k, outer, inner, z_rim - rim_h, rim_h, rim, top=rim_top, inner_col=wall)
    _prism(k, inner, z_rim - rim_h - 0.06, z_soil - (z_rim - rim_h - 0.06), "soilD", top="soilD")
    _soil(k, cu, 0, z_soil - 0.05, soil_w, soil_d, seed, n=int(soil_w * 16))


def _soil(k, u, v, z, w, d, seed=0, n=26):
    """A soil bed: dark loam with soft humps and scattered clods."""
    r = random.Random(seed * 13 + 1)
    k.box(u, v, z, w, d, 0.05, "soil", top="soilD")
    for _ in range(max(2, int(w * 2.5))):                                    # soft humps, no straight edges
        hw, hd = r.uniform(0.25, 0.45), r.uniform(0.2, 0.32)
        k.box(u + r.uniform(-w / 2 + hw / 2, w / 2 - hw / 2), v + r.uniform(-d / 2 + hd / 2, d / 2 - hd / 2), z + 0.05,
              hw, hd, r.uniform(0.02, 0.04), "soil", top="soil", bevel=0.05, rz=r.uniform(-0.5, 0.5))
    for _ in range(n):
        cu, cv = u + r.uniform(-w / 2 + 0.05, w / 2 - 0.05), v + r.uniform(-d / 2 + 0.05, d / 2 - 0.05)
        sz = r.uniform(0.04, 0.09)
        k.box(cu, cv, z + 0.05 + r.uniform(0, 0.025), sz, sz * r.uniform(0.6, 1.0), 0.035,
              r.choice(("soilL", "soilD", "soil", "soilL")), rz=r.uniform(0, 3))


def _lamp_ring(k, cu, cv, z, L, w, bar, on, col="labPearl", top="labPearlL", outline=None):
    """A ring lamp, open in the middle so the plants show through it: a housing over a lit lens band. outline(L, w)
    gives its shape (a pill by default)."""
    ol = outline or (lambda l, d: _pill_ol(cu, cv, l, d))
    o, i = ol(L, w), ol(L - 2 * bar, w - 2 * bar)
    lo, li = ol(L - 0.03, w - 0.03), ol(L - 2 * bar + 0.03, w - 2 * bar + 0.03)
    _ring(k, lo, li, z, 0.045, "growPink" if on else "lampOff")
    _ring(k, o, i, z + 0.045, 0.08, col, top=top)


def _on(on, lit="cyan"):
    return lit if on else "steelD"


# ---- the directions --------------------------------------------------------------------------------------------------
def lab(k, on):
    """Lab: a shallow pearl tray floating on a narrow navy pedestal, a blade spine with a mint stripe."""
    _prism(k, _pill_ol(0, 0, 1.8, 0.76), 0.0, 0.07, "labNavy", top="labNavyL")               # foot
    _prism(k, _pill_ol(0, 0, 1.6, 0.6), 0.07, 0.35, "labNavy", top="labNavyL")              # pedestal
    for i in range(5):                                                                      # vent slots
        k.box(-0.18 + i * 0.09, 0.304, 0.14, 0.05, 0.012, 0.16, "dark")
    _prism(k, _pill_ol(0, 0, 1.7, 0.66), 0.42, 0.2, "labPearl", top="labPearlL", tl=_pill_ol(0, 0, 2.0, 0.92))
    _prism(k, _pill_ol(0, 0, 2.0, 0.92), 0.565, 0.045, "labMint", tl=_pill_ol(0, 0, 2.03, 0.95))  # detail ring
    zs = 0.66
    _well(k, _pill_ol(0, 0, 1.8, 0.72), _pill_ol(0, 0, 2.0, 0.92), 0.71, 0.07, "labPearl", "labPearlL", "labNavy",
          zs, 1.36, 0.6)
    a = math.atan2(0.13, 0.2)                                                               # display on the flare
    k.box(0.5, 0.405, 0.5, 0.3, 0.012, 0.09, "dark", rx=-a)
    k.box(0.46, 0.41, 0.52, 0.14, 0.012, 0.03, _on(on, "labMint"), rx=-a)
    k.box(0.6, 0.41, 0.52, 0.04, 0.012, 0.04, _on(on), rx=-a)
    blade = _cham(0, -0.38, 0.16, 0.3, 0.04)                                                # the blade
    _prism(k, blade, 0.62, 1.0, "labPearl", top="labPearlL", tl=_cham(0, -0.36, 0.13, 0.18, 0.03))
    k.box(0, -0.3, 0.72, 0.13, 0.03, 0.8, "labMint")                                       # stripe up its front
    _prism(k, _cham(0, -0.3, 0.16, 0.3, 0.05), 1.6, 0.16, "labNavy", top="labNavyL")         # head
    _lamp_ring(k, 0, 0.0, 1.58, 1.82, 0.68, 0.09, on, col="labPearl", top="labPearlL")
    return ((-0.47, 0.0), (0.47, 0.0)), zs

def _remapped(k):
    """k with REMAP applied to every colour it draws (a colour scheme swap)."""
    poly = k.m.poly
    k.m.poly = lambda pts, color, flip=False: poly(pts, REMAP.get(color, color), flip)
    return k


# ---- glass enclosed (terrarium) ----------------------------------------------------------------------------------------
GLASS_ALPHA, GLASS_RIM = 0.1, 0.0


def _part(k, name):
    """A part in its own mesh: "glass" (the see-through panes) or "glint" (their highlights). Neither masks the crop:
    the plants show through the glass."""
    if not hasattr(k, "parts"):
        k.parts = {}
    if name not in k.parts:
        k.parts[name] = _remapped(K(f"{k.m.name}_{name}", (2, 1), k.rot))
    return k.parts[name]


def _bar(k, a, b, s, col):
    """A square frame bar from local point a to b (a 4-sided tube)."""
    _tube(k, [a, b], s * 0.7, col, n=4)


def _canopy(k, cu, L, D, z0, zw, zr, i, on, frame, frame_l, roof, mid=True):
    """A cab-shaped glass canopy over the bed: vertical glass walls from z0 to zw, sloped glass inset i up to the roof
    at zr, a solid roof carrying the grow lamp under it, square frame bars on every edge."""
    g = _part(k, "glass")
    a, b, a2, b2 = L / 2, D / 2, L / 2 - i, D / 2 - i
    lo = [(cu - a, -b), (cu + a, -b), (cu + a, b), (cu - a, b)]
    hi = [(cu - a2, -b2), (cu + a2, -b2), (cu + a2, b2), (cu - a2, b2)]
    for j in range(4):                                                      # panes: walls, then the slopes
        q = (j + 1) % 4
        g.m.poly([_G(g, *lo[j], z0), _G(g, *lo[q], z0), _G(g, *lo[q], zw), _G(g, *lo[j], zw)], "glassT", flip=True)
        g.m.poly([_G(g, *lo[j], zw), _G(g, *lo[q], zw), _G(g, *hi[q], zr), _G(g, *hi[j], zr)], "glassT", flip=True)
    s = 0.06
    for j in range(4):                                                      # frame: sill, eaves, hips, posts, ridge
        q = (j + 1) % 4
        (u0, v0), (u1, v1) = lo[j], lo[q]
        _bar(k, (u0, v0, z0 + s / 2), (u1, v1, z0 + s / 2), s, frame)
        _bar(k, (u0, v0, zw), (u1, v1, zw), s, frame_l)
        _bar(k, (u0, v0, z0), (u0, v0, zw), s, frame)
        _bar(k, (u0, v0, zw), (hi[j][0], hi[j][1], zr), s, frame_l)
    if mid:                                                                 # a post between the two plants
        for sv in (-1, 1):
            _bar(k, (cu, sv * b, z0), (cu, sv * b, zw), s, frame)
            _bar(k, (cu, sv * b, zw), (cu, sv * b2, zr), s, frame_l)
    _prism(k, _cham(cu, 0, 2 * a2 + 0.08, 2 * b2 + 0.08, 0.03), zr - 0.01, 0.08, roof, top=frame_l)   # roof
    _prism(k, _cham(cu, 0, 2 * a2 - 0.02, 2 * b2 - 0.02, 0.02), zr - 0.08, 0.07, "growPink" if on else "lampOff")  # lamp
    for du, dz, ln in ((-0.25, 0.1, 0.16), (-0.16, 0.2, 0.1)):              # two glints on the front glass
        _bar(_part(k, "glint"), (cu + a * 0.55 + du, b + 0.004, zw - 0.32 + dz),
             (cu + a * 0.55 + du + ln * 0.6, b + 0.004, zw - 0.32 + dz + ln), 0.03, "glassG")


def _canopy_slope(k, cu, L, D, z0, zr, iv, on, frame, frame_l, roof):
    """A glass canopy whose long sides slope from the sill straight up to the roof (inset iv each side), its short
    ends upright trapezoids; a solid roof carrying the grow lamp, square frame bars on every edge, a post mid-length."""
    g = _part(k, "glass")
    a, b, b2 = L / 2, D / 2, D / 2 - iv
    lo = [(cu - a, -b), (cu + a, -b), (cu + a, b), (cu - a, b)]
    hi = [(cu - a, -b2), (cu + a, -b2), (cu + a, b2), (cu - a, b2)]
    for j in range(4):                                                      # panes: two slopes, two upright ends
        q = (j + 1) % 4
        g.m.poly([_G(g, *lo[j], z0), _G(g, *lo[q], z0), _G(g, *hi[q], zr), _G(g, *hi[j], zr)], "glassT", flip=True)
    s = 0.06
    for j in range(4):                                                      # frame: sill, roof edge, corner rafters
        q = (j + 1) % 4
        _bar(k, (*lo[j], z0 + s / 2), (*lo[q], z0 + s / 2), s, frame)
        _bar(k, (*hi[j], zr), (*hi[q], zr), s, frame_l)
        _bar(k, (*lo[j], z0), (*hi[j], zr), s, frame_l)
    for sv in (-1, 1):                                                      # a rafter between the two plants
        _bar(k, (cu, sv * b, z0), (cu, sv * b2, zr), s, frame_l)
    _prism(k, _cham(cu, 0, L + 0.08, 2 * b2 + 0.1, 0.03), zr - 0.01, 0.08, roof, top=frame_l)        # roof
    _prism(k, _cham(cu, 0, L - 0.08, 2 * b2 - 0.02, 0.02), zr - 0.08, 0.07, "growPink" if on else "lampOff")  # lamp
    t = lambda z: b - (z - z0) / (zr - z0) * iv + 0.004                     # the front slope's v at height z
    for du, z1, ln in ((-0.25, 0.86, 0.18), (-0.16, 0.98, 0.11)):          # two glints on the front glass
        u0 = cu + a * 0.55 + du
        _bar(_part(k, "glint"), (u0, t(z1), z1), (u0 + ln * 0.6, t(z1 + ln), z1 + ln), 0.03, "glassG")


def _tray(k, cu, L, D, z0, zs, seed):
    """The bed's soil tray inside a canopy (its edge hidden by the sill)."""
    _prism(k, _cham(cu, 0, L, D, 0.02), z0, zs - 0.05 - z0, "soilD", top="soilD")
    _soil(k, cu, 0, zs - 0.05, L - 0.12, D - 0.12, seed, n=int(L * 14))


def terra(k, on):
    """One long glass canopy on an angular navy base, grey frames, slatted front panel, a control screen."""
    _prism(k, _cham(0, 0, 1.86, 0.82, 0.04), 0.0, 0.1, "dark")                                # kick
    body = _cham(0, 0, 1.98, 0.94, 0.06)
    _prism(k, body, 0.1, 0.54, "tNavy", top="tNavyL")
    _prism(k, _scaled(body, 1.01), 0.56, 0.05, "tFrame", top="tFrameL")                       # top band
    k.box(-0.35, 0.474, 0.2, 0.8, 0.012, 0.26, "dark")                                       # slatted panel
    for j in range(8):
        k.box(-0.70 + j * 0.1, 0.48, 0.22, 0.04, 0.012, 0.22, "tNavyL")
    k.box(0.5, 0.474, 0.26, 0.34, 0.012, 0.2, "tFrame")                                      # control panel
    k.box(0.5, 0.48, 0.3, 0.26, 0.012, 0.12, "dark")
    k.box(0.45, 0.486, 0.33, 0.12, 0.012, 0.05, _on(on))
    k.box(0.6, 0.486, 0.33, 0.04, 0.012, 0.05, _on(on, "orange"))
    zs = 0.69
    _tray(k, 0, 1.9, 0.86, 0.6, zs, 3)
    _canopy_slope(k, 0, 1.92, 0.88, 0.61, 1.5, 0.13, on, "tFrame", "tFrameL", "tFrame")
    return ((-0.47, 0.0), (0.47, 0.0)), zs


def cab(k, on):
    """terra's navy base and grey frames under a glass cabin per plant, a machinery block between the cabins."""
    _prism(k, _cham(0, 0, 1.86, 0.82, 0.04), 0.0, 0.1, "dark")                                # kick
    body = _cham(0, 0, 1.98, 0.94, 0.06)
    _prism(k, body, 0.1, 0.5, "tNavy", top="tNavyL")
    _prism(k, _scaled(body, 1.01), 0.52, 0.05, "tFrame", top="tFrameL")                       # top band
    zs = 0.66
    for e in (-1, 1):
        cu = e * 0.55
        k.box(cu - e * 0.06, 0.474, 0.18, 0.5, 0.012, 0.24, "dark")                          # slatted panel per bay
        for j in range(5):
            k.box(cu - e * 0.06 - 0.2 + j * 0.1, 0.48, 0.2, 0.04, 0.012, 0.2, "tNavyL")
        _tray(k, cu, 0.8, 0.84, 0.58, zs, 5 + e)
        _canopy(k, cu, 0.84, 0.86, 0.58, 1.2, 1.5, 0.18, on, "tFrame", "tFrameL", "tFrame", mid=False)
    blk = _cham(0, 0, 0.26, 0.76, 0.04)                                                      # machinery block
    _prism(k, blk, 0.56, 0.6, "tNavy", top="tNavyL")
    _prism(k, _scaled(blk, 1.04), 1.08, 0.05, "tFrame", top="tFrameL")
    for sv in (-0.2, 0.14):                                                                 # pipes into each cabin
        _tube(k, [(-0.42, sv, 1.0), (0.42, sv, 1.0)], 0.03, "steelL")
    k.box(0, 0.385, 0.66, 0.16, 0.012, 0.3, "tFrame")                                       # control panel
    k.box(0, 0.391, 0.7, 0.11, 0.012, 0.13, "dark")
    k.box(0, 0.397, 0.74, 0.07, 0.012, 0.05, _on(on))
    k.box(0, 0.397, 0.9, 0.05, 0.012, 0.04, _on(on, "orange"))
    return ((-0.55, 0.0), (0.55, 0.0)), zs


# ---- stand-in crops (the real crops come once the bed is approved) ---------------------------------------------------
def _greens(k, u, v, z, seed=0):
    """A broad leafy head: two tiers of leaves round a crown."""
    r = random.Random(seed * 11 + 5)
    cols = ("leaf", "leafL", "leafD")
    for tier, (n, L, w, zz, tilt) in enumerate(((9, 0.32, 0.13, 0.0, 0.25), (7, 0.24, 0.12, 0.07, 0.55))):
        for j in range(n):
            a = j * math.tau / n + r.uniform(-0.15, 0.15) + tier * 0.4
            d = L * 0.48
            k.box(u + d * math.cos(a), v + d * math.sin(a), z + zz, L, w, 0.04, cols[(j + tier) % 3], top=cols[(j + tier) % 3],
                  rz=a, ry=-tilt)
    k.box(u, v, z + 0.05, 0.16, 0.16, 0.18, "leafD", top="leafL", rz=r.uniform(0, 1.5), taper=0.5)


def _grain(k, u, v, z, seed=0):
    """Upright stalks with heavy gold heads, the tallest crop: it tests the lamp's clearance."""
    r = random.Random(seed * 7 + 2)
    for i in range(13):
        a, d = r.uniform(0, math.tau), 0.22 * math.sqrt(r.uniform(0.05, 1.0))
        cu, cv = u + d * math.cos(a), v + d * math.sin(a)
        h = r.uniform(0.45, 0.68)
        k.box(cu, cv, z, 0.045, 0.045, h, "stalk")
        k.box(cu, cv, z + h - 0.03, 0.08, 0.08, 0.2, "grain", top="grain", taper=0.6, rz=a)
        k.box(cu + 0.03, cv, z + h * 0.4, 0.16, 0.05, 0.03, "leafD", rz=a, ry=-0.5)


CROPS = {"greens": _greens, "grain": _grain}
SAND_L = {"labNavy": "sandD", "labNavyL": "sand", "labPearl": "sand", "labPearlL": "sandL", "labMint": "arcOr"}  # cream, orange ring
VARIANTS = {"cab": (cab, {}), "terra": (terra, {}), "lab": (lab, {}), "lab.sand": (lab, SAND_L)}
REMAP = {}
LAYERS = ("off", "on", "crop.greens", "crop.grain")


def build(variant, layer, rot=0):
    name = f"hydro_{variant.replace('.', '_')}_{layer.replace('.', '_')}_{rot}"
    fn, remap = VARIANTS[variant]
    REMAP.clear()
    REMAP.update(remap)
    kb = _remapped(K(name, (2, 1), rot))
    plants, zs = fn(kb, layer == "on")
    bed = kb.build()
    parts = {n: p.build() for n, p in getattr(kb, "parts", {}).items()}
    for o in parts.get("glass", []):
        o["alpha"], o["rim"] = GLASS_ALPHA, GLASS_RIM
    if not layer.startswith("crop."):
        return bed + sum(parts.values(), [])
    for o in sum(parts.values(), []):                                       # the plants show through the glass
        o.hide_render = True
    kc = K(name + "_crop", (2, 1), rot)
    for i, (u, v) in enumerate(plants):
        CROPS[layer.split(".")[1]](kc, u, v, zs, i)
    crop = kc.build()
    return crop, crop + bed                     # "over": the crop's px where it is in front of the bed, no outline


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", (2, 1), "over" if s.startswith("crop.") else "prop", lambda v=v, s=s: build(v, s))
            for v in names for s in LAYERS]
