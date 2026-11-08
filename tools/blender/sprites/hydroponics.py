"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

The bed (chosen from a long look exploration; the other directions are in git history): two standing white tanks,
one under each plant, and a pump between them, inside grey corner legs; a copper manifold along the front with a red
valve on each tank. Above, a soil tray under a glass canopy in grey frames: it rises upright a short way, then slopes
on its long sides to a glass roof; its ends are upright. A strut across the roof carries a white ring lamp, open in
the middle so the plants show through it, one plant per tile.
Layers: `.off` / `.on` are the bed; `.crop.<crop>.<stage>` is the crop drawn on top of the bed, rendered with the bed
as a holdout so the lamp cuts the plant where it passes in front of it (two draws, no front layer). HYDRO_VARIANTS
and HYDRO_LAYERS narrow the build."""
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


def _tube(k, pts, r, col, n=8, caps=True, phase=0.0):
    """A round tube through the local (u, v, z) points: a ring of n points at each, square to the path there (turned
    by phase)."""
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
                      for a in (math.tau * q / n + phase for q in range(n))])
    for r0, r1 in zip(rings, rings[1:]):
        for q in range(n):
            k.m.poly([r0[q], r0[(q + 1) % n], r1[(q + 1) % n], r1[q]], col, flip=True)
    if caps:
        k.m.poly(rings[0][::-1], col, flip=True)
        k.m.poly(rings[-1], col, flip=True)


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


def _lamp_ring(k, cu, cv, z, L, w, bar, on, col, top, outline=None):
    """A ring lamp, open in the middle so the plants show through it: a housing over a lit lens band. outline(L, w)
    gives its shape (a pill by default)."""
    ol = outline or (lambda l, d: _pill_ol(cu, cv, l, d))
    o, i = ol(L, w), ol(L - 2 * bar, w - 2 * bar)
    lo, li = ol(L - 0.03, w - 0.03), ol(L - 2 * bar + 0.03, w - 2 * bar + 0.03)
    _ring(k, lo, li, z, 0.045, "growPink" if on else "lampOff")
    _ring(k, o, i, z + 0.045, 0.08, col, top=top)


def _on(on, lit="cyan"):
    return lit if on else "steelD"


# ---- see-through parts ---------------------------------------------------------------------------------------------------
GLASS_ALPHA, GLINT_ALPHA, GLASS_RIM = 0.1, 0.5, 0.0


def _part(k, name):
    """A part in its own mesh: "glass" (the see-through panes) or "glint" (see-through reflections). Neither masks the
    crop: the plants show through."""
    if not hasattr(k, "parts"):
        k.parts = {}
    if name not in k.parts:
        k.parts[name] = K(f"{k.m.name}_{name}", getattr(k, "fp", (2, 1)), k.rot)
    return k.parts[name]


def _bar(k, a, b, s, col):
    """A square frame bar s thick from local point a to b, its faces square to the grid (no diamond edges)."""
    _tube(k, [a, b], s / math.sqrt(2), col, n=4, phase=math.pi / 4)


def _canopy_slope(k, cu, L, D, z0, zv, zr, iv, on, frame, frame_l, ring, ring_t, cv=0.0, mids=None, rings=None):
    """A glass canopy: a short upright wall from the sill to zv, then the long sides slope up to a glass roof (inset
    iv each side), the short ends upright; square frame bars on every edge, a post and rafter mid-length that a strut
    across the roof joins into one hoop, and a ring lamp (colours ring, ring_t) hung from that strut. Centred on
    (cu, cv); mids: the posts and struts along it (default its middle); rings: (v, width) of each lamp (default one
    as wide as the roof)."""
    g = _part(k, "glass")
    a, b, b2 = L / 2, D / 2, D / 2 - iv
    lo = [(cu - a, cv - b), (cu + a, cv - b), (cu + a, cv + b), (cu - a, cv + b)]
    hi = [(cu - a, cv - b2), (cu + a, cv - b2), (cu + a, cv + b2), (cu - a, cv + b2)]
    mids = [cu] if mids is None else mids
    rings = [(cv, 2 * b2)] if rings is None else rings
    for j in range(4):                                                      # panes: two slopes, two upright ends
        q = (j + 1) % 4
        g.m.poly([_G(g, *lo[j], z0), _G(g, *lo[q], z0), _G(g, *lo[q], zv), _G(g, *lo[j], zv)], "glassT", flip=True)
        g.m.poly([_G(g, *lo[j], zv), _G(g, *lo[q], zv), _G(g, *hi[q], zr), _G(g, *hi[j], zr)], "glassT", flip=True)
    s = 0.06
    for j in range(4):                                                      # frame: roof edge, corner posts and
        q = (j + 1) % 4                                                     # rafters (the sill is the base's)
        _bar(k, (*hi[j], zr), (*hi[q], zr), s, frame_l)
        _bar(k, (*lo[j], z0), (*lo[j], zv), s, frame)
        _bar(k, (*lo[j], zv), (*hi[j], zr), s, frame_l)
    for m in mids:
        for sv in (-1, 1):                                                  # a post and rafter between the plants
            _bar(k, (m, cv + sv * b, z0), (m, cv + sv * b, zv), s, frame)
            _bar(k, (m, cv + sv * b, zv), (m, cv + sv * b2, zr), s, frame_l)
    g.m.poly([_G(g, *p, zr) for p in hi], "glassT", flip=True)              # the glass roof
    for m in mids:
        _bar(k, (m, cv - b2, zr), (m, cv + b2, zr), s, frame_l)               # the strut across it
    Lr, zl = L - 0.1, zr - 0.22
    for rv, rw in rings:
        _lamp_ring(k, cu, rv, zl, Lr, rw, 0.09, on, col=ring, top=ring_t)
        for m in mids:
            for sv in (-1, 1):                                              # hung from the strut
                hv = rv + sv * (rw / 2 - 0.045)
                _bar(k, (m, hv, zl + 0.1), (m, hv, zr), 0.045, frame)
    up = zr - zv                                                            # the front slope: v and z at fraction f
    fs = lambda f: (cv + b - f * iv + 0.006, zv + f * up)
    edges = [cu - a] + sorted(mids) + [cu + a]
    bays = [(l + r) / 2 for l, r in zip(edges, edges[1:])]
    # Reflections: pale bands in pairs at half opacity (see-through, so they never mask the crop). Each bay: up the
    # front slope, then on across the roof; the end pane has its pair centred.
    kg = _part(k, "glint")
    (v0, za), (v1, zb) = fs(0.08), fs(1.0)
    for bc in bays:
        for du, w in ((-0.2, 0.08), (-0.07, 0.04)):
            u0 = bc + du
            _streak(kg, (u0, v0, za), (u0 + 0.12, v1, zb), (w, 0, 0), "glassG")
            _streak(kg, (u0 + 0.12, cv + b2, zr + 0.006), (u0 + 0.24, cv - b2 + 0.04, zr + 0.006), (w, 0, 0), "glassG")
    for dv, w in ((0.1, 0.08), (-0.03, 0.04)):
        _streak(kg, (cu + a + 0.006, cv + dv, z0 + 0.06), (cu + a + 0.006, cv + dv - 0.12, zv + 0.2), (0, -w, 0),
                "glassG")


def _streak(k, p0, p1, e, col):
    """A flat reflection band from p0 to p1 (local u, v, z), e wide (a local vector across it)."""
    q = [p0, p1, tuple(p1[i] + e[i] for i in range(3)), tuple(p0[i] + e[i] for i in range(3))]
    k.m.poly([_G(k, *p) for p in q], col, flip=True)


def _tray(k, cu, L, D, z0, zs, seed, cv=0.0):
    """The bed's soil tray inside a canopy (its edge hidden by the sill)."""
    _prism(k, _cham(cu, cv, L, D, 0.02), z0, zs - 0.05 - z0, "soilD", top="soilD")
    _soil(k, cu, cv, zs - 0.05, L - 0.12, D - 0.12, seed, n=int(L * 14))


# ---- the base: a tank under each plant, a pump between them, a copper manifold, in grey corner legs -------------------
VQ = 0.46875                                     # the manifold's line, its front face on the tile's edge (whole px)


def _frame_legs(k, hu=0.921875, hv=0.390625, cv=0.0, h=0.56):
    """Grey corner legs that carry the canopy frame down to the floor (at u = +-hu, v = cv +- hv)."""
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * hu, cv + sv * hv, 0.0, 0.09375, 0.09375, h, "tFrame", top="tFrameL")


def _sq_pipe(k, pts, w=0.0625, col="pipeCu"):
    """A square-section pipe through the local points (faces square to the axes, like the frame bars, so it stays
    crisp at pixel scale); each run carries on w / 2 past a bend so the runs meet in a solid square elbow."""
    n = len(pts)
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        d = [b[j] - a[j] for j in range(3)]
        m = math.sqrt(sum(x * x for x in d))
        e = [x / m * w / 2 for x in d]
        a = tuple(a[j] - e[j] for j in range(3)) if i > 0 else a
        b = tuple(b[j] + e[j] for j in range(3)) if i + 2 < n else b
        _bar(k, a, b, w, col)


def _valve(k, u, v, z):
    """A steel valve body on the manifold with a red handwheel facing front."""
    k.box(u, v, z - 0.045, 0.09, 0.09, 0.09, "steel")
    _tube(k, [(u, v + 0.045, z), (u, v + 0.075, z)], 0.012, "steel", n=6)
    _tube(k, [(u, v + 0.075, z), (u, v + 0.095, z)], 0.06, "medRed", n=10)


def _vtank(k, u, v, z, r, h, on):
    """A standing white tank with navy bands and a sight glass on its front showing the water (cyan when on)."""
    k.cyl(u, v, z, r, h, "tWhite", top="tWhiteL", sides=20)
    for zb in (z + 0.06, z + h - 0.1):
        k.cyl(u, v, zb, r + 0.008, 0.035, "tNavy", top="tNavyL", sides=20)
    gv = v + r + 0.002
    k.box(u, gv, z + 0.12, 0.0625, 0.02, h - 0.26, "dark")
    k.box(u, gv + 0.008, z + 0.13, 0.03125, 0.02, (h - 0.28) * 0.6, _on(on, "cyan") if on else "lens")


def _pump(k, u, v, z, on, s=1.0):
    """A pump: a steel body under a white motor with a status light (s scales it)."""
    k.cyl(u, v, z, 0.1 * s, 0.14 * s, "steel", top="steelL", sides=12)
    k.cyl(u, v, z + 0.14 * s, 0.075 * s, 0.1 * s, "tWhite", top="tWhiteL", sides=12)
    k.box(u, v + 0.075 * s, z + 0.17 * s, 0.03125, 0.01, 0.03, _on(on))


def _base(k, on):
    """Two standing white tanks on dark feet, one under each plant, inside grey corner legs. The pump between them
    lifts through one pipe out of its base into a copper manifold along the front, a valve on each tank's centre, a
    riser at each end into the tray."""
    _frame_legs(k)
    for su in (-1, 1):
        k.cyl(su * 0.48, 0.0, 0.0, 0.34, 0.04, "dark", sides=24)
        _vtank(k, su * 0.48, 0.0, 0.04, 0.37, 0.52, on)
    _pump(k, 0.0, 0.26, 0.0, on, s=1.2)
    zm, zb = 0.48, 0.084
    _sq_pipe(k, [(0.0, 0.3, zb), (0.0, VQ, zb), (0.0, VQ, zm)])
    _sq_pipe(k, [(-0.71875, VQ, 0.56), (-0.71875, VQ, zm), (0.71875, VQ, zm), (0.71875, VQ, 0.56)])
    for su in (-1, 1):
        _valve(k, su * 0.48, VQ, zm)


def bed(k, on):
    """The small bed: the base, a grey sill, the soil tray, the glass canopy. Returns the plant spots, the soil
    height and the ceiling (the lamp's underside) the crops must stay under."""
    _base(k, on)
    _ring(k, _cham(0, 0, 2.0, 0.9375, 0.02), _cham(0, 0, 1.86, 0.8, 0.02), 0.56, 0.1, "tFrame", top="tFrameL")  # sill
    zs = 0.69
    _tray(k, 0, 1.84, 0.8, 0.6, zs, 3)
    _canopy_slope(k, 0, 1.92, 0.88, 0.66, 0.87, 1.36, 0.13, on, "tFrame", "tFrameL", "ringW", "ringWL")
    return ((-0.47, 0.0), (0.47, 0.0)), zs, 1.14


# ---- the large bed (3 x 2 tiles): options ---------------------------------------------------------------------------
VQL = 0.96875                                    # the large bed's manifold line, its front face on the tile's edge


def _otank(k, u, v, w, d, z, h, on):
    """A standing white tank with an oval (pill) footprint, w across u and d along v, on a dark foot: navy bands, a
    sight glass on its front end showing the water (cyan when on)."""
    pill = lambda ww, dd: [(u + y, v + x) for x, y in _pill_ol(0, 0, dd, ww, n=10)][::-1]   # long along v, CCW
    _prism(k, pill(w - 0.06, d - 0.06), 0.0, z, "dark")
    _prism(k, pill(w, d), z, h, "tWhite", top="tWhiteL")
    for zb in (z + 0.06, z + h - 0.1):
        _prism(k, pill(w + 0.016, d + 0.016), zb, 0.035, "tNavy", top="tNavyL")
    gv = v + d / 2 + 0.002
    k.box(u, gv, z + 0.12, 0.0625, 0.02, h - 0.26, "dark")
    k.box(u, gv + 0.008, z + 0.13, 0.03125, 0.02, (h - 0.28) * 0.6, _on(on, "cyan") if on else "lens")


def _base_large(k, on, back=True):
    """Two oval tanks running front to back, one under each half, a pump between them lifting into one copper
    manifold along the front with a valve on each tank, in grey corner legs."""
    _frame_legs(k, 1.421875, 0.890625)
    for su in (-1, 1):
        _otank(k, su * 0.72, 0.05 if back else 0.47, 1.1, 1.7 if back else 0.86, 0.04, 0.52, on)
    zm, zb = 0.48, 0.084
    _pump(k, 0.0, 0.66, 0.0, on, s=1.2)
    _sq_pipe(k, [(0.0, 0.7, zb), (0.0, VQL, zb), (0.0, VQL, zm)])
    _sq_pipe(k, [(-1.21875, VQL, 0.56), (-1.21875, VQL, zm), (1.21875, VQL, zm), (1.21875, VQL, 0.56)])
    for su in (-1, 1):
        _valve(k, su * 0.72, VQL, zm)


def _unit(k, cv, on, dz=0.0, seed=3):
    """One row of the large bed: a 3-tile sill, tray and canopy (posts between the plants), centred on v = cv,
    lifted dz. Returns its plant spots with their soil height and ceiling."""
    _ring(k, _cham(0, cv, 3.0, 0.9375, 0.02), _cham(0, cv, 2.86, 0.8, 0.02), 0.56 + dz, 0.1, "tFrame", top="tFrameL")
    zs = 0.69 + dz
    _tray(k, 0, 2.84, 0.8, 0.6 + dz, zs, seed, cv=cv)
    _canopy_slope(k, 0, 2.92, 0.88, 0.66 + dz, 0.87 + dz, 1.36 + dz, 0.13, on, "tFrame", "tFrameL", "ringW", "ringWL",
                  cv=cv, mids=[-0.5, 0.5])
    return [(u, cv, zs, 1.14 + dz) for u in (-0.98, 0.0, 0.98)]


def large_wide(k, on):
    """One wide greenhouse over one tray: six plants in two rows, a lamp ring over each row, a strut along the middle
    of the roof between them."""
    _base_large(k, on)
    _ring(k, _cham(0, 0, 3.0, 1.9375, 0.02), _cham(0, 0, 2.86, 1.8, 0.02), 0.56, 0.1, "tFrame", top="tFrameL")
    zs = 0.69
    _tray(k, 0, 2.84, 1.8, 0.6, zs, 5)
    _canopy_slope(k, 0, 2.92, 1.88, 0.66, 0.87, 1.36, 0.2, on, "tFrame", "tFrameL", "ringW", "ringWL",
                  mids=[-0.5, 0.5], rings=[(0.42, 0.66), (-0.42, 0.66)])
    _bar(k, (-1.46, 0.0, 1.36), (1.46, 0.0, 1.36), 0.06, "tFrameL")             # the middle strut, along the roof
    for su in (-1, 1):                                                       # and a post up the middle of each end
        _bar(k, (su * 1.46, 0.0, 0.66), (su * 1.46, 0.0, 1.36), 0.06, "tFrame")
    return [(u, v, zs, 1.14) for v in (0.45, -0.45) for u in (-0.98, 0.0, 0.98)], zs, 1.14


def large_twin(k, on):
    """Two long greenhouses side by side, a front row and a back row of three plants."""
    _base_large(k, on)
    return _unit(k, 0.5, on) + _unit(k, -0.5, on, seed=5), 0.69, 1.14


def large_tiered(k, on):
    """The twin rows with the back row raised on a white riser, so its plants show over the front ones."""
    dz = 0.3
    _base_large(k, on, back=False)
    _frame_legs(k, 1.421875, 0.390625, cv=-0.5, h=0.56 + dz)
    k.box(0, -0.5, 0.0, 2.75, 0.75, 0.56 + dz, "tWhite", top="tWhiteL")                          # the riser
    return _unit(k, 0.5, on) + _unit(k, -0.5, on, dz=dz, seed=5), 0.69, 1.14


# ---- the crops: one plant per tile, in three stages, under the lamp (hmax over the soil) ------------------------------
STAGES = ("sprout", "grow", "ripe")


def _leaf(k, u, v, z, a, L, w, tilt, col):
    """A flat leaf from (u, v, z) out along the angle a, L long and w wide, its tip tilted up by tilt."""
    d = L * 0.48
    k.box(u + d * math.cos(a), v + d * math.sin(a), z, L, w, 0.035, col, top=col, rz=a, ry=-tilt)


def _greens(k, u, v, z, st, seed, hmax):
    """Greens: a low, broad leafy head in bright fresh green. A sprout is a small upright rosette; half grown, one
    open tier; ripe, two tiers of broad leaves round a tight crown."""
    r = random.Random(seed * 11 + 5)
    cols = ("leaf", "leafL", "leafD")
    if st == "sprout":
        for j in range(5):
            _leaf(k, u, v, z, j * math.tau / 5 + r.uniform(-0.2, 0.2), 0.16, 0.09, 0.8, cols[j % 2])
        return
    g = 0.68 if st == "grow" else 1.0
    tiers = ((11, 0.46, 0.17, 0.0, 0.2), (9, 0.34, 0.15, 0.06, 0.4), (7, 0.22, 0.12, 0.12, 0.65))
    for tier, (n, L, w, zz, tilt) in enumerate(tiers):
        for j in range(n):
            a = j * math.tau / n + r.uniform(-0.15, 0.15) + tier * 0.4
            sq = 0.75 if abs(math.sin(a)) > 0.7 else 1.0                       # the soil is narrower in v
            _leaf(k, u, v, z + zz * g, a, L * g * sq, w * g, tilt + (0.15 if st == "grow" else 0), cols[(j + tier) % 3])
    k.box(u, v, z + 0.06 * g, 0.2 * g, 0.2 * g, 0.2 * g, "leafD", top="leafL", rz=r.uniform(0, 1.5), taper=0.5)


def _beans(k, u, v, z, st, seed, hmax):
    """Protein beans: a row of upright canes the full height (set at sowing), a dark green vine climbing each in a
    column, pale pods hanging when ripe."""
    r = random.Random(seed * 13 + 3)
    canes = [(u + du, v + 0.1 + r.uniform(-0.03, 0.03)) for du in (-0.26, 0.0, 0.26)]     # towards the front
    for cu, cv in canes:
        _tube(k, [(cu, cv, z), (cu, cv, z + hmax - 0.02)], 0.022, "cane", n=4, phase=math.pi / 4)
    reach, n = {"sprout": (0.22, 3), "grow": (0.5, 4), "ripe": (0.95, 11)}[st]
    cols = ("beanL", "bean", "beanL", "beanD")
    s = {"sprout": 0.7, "grow": 0.85, "ripe": 1.0}[st]
    for i, (cu, cv) in enumerate(canes):
        for j in range(n):
            zz = z + (j + r.uniform(0.2, 0.8)) / n * reach * hmax
            a = j * 2.4 + i                                                      # spiralling up the cane
            _leaf(k, cu + 0.02 * math.cos(a), cv + 0.02 * math.sin(a), zz, a, 0.15 * s, 0.12 * s, r.uniform(-0.1, 0.3),
                  cols[(i + j) % 4])
        if st == "ripe":                                                         # low leaves spilling to the front
            for j in range(2):
                a = math.pi / 2 + r.uniform(-0.7, 0.7)
                _leaf(k, cu + r.uniform(-0.06, 0.06), cv + 0.03, z + r.uniform(0.01, 0.05), a, 0.17, 0.13,
                      r.uniform(0.1, 0.35), cols[(i + j + 1) % 4])
        if st == "ripe":
            for j in range(3):
                zz = z + r.uniform(0.35, 0.62) * hmax                            # below the lamp, which hides the tops
                a = r.uniform(0, math.tau)
                k.box(cu + 0.07 * math.cos(a), cv + 0.07 * math.sin(a), zz - 0.15, 0.045, 0.045, 0.15, "pod", top="pod",
                      rx=r.uniform(-0.15, 0.15))


def _herbs(k, u, v, z, st, seed, hmax):
    """Medicinal herbs: small bushy clumps in a grey-green touched with dark red; ripe, red flower spikes and pale
    flowers over them."""
    r = random.Random(seed * 17 + 7)
    h = {"sprout": 0.08, "grow": 0.17, "ripe": 0.22}[st]
    spots = [(0.0, 0.0)] + [(0.2 * math.cos(a), 0.17 * math.sin(a)) for a in (i * math.tau / 5 + 0.3 for i in range(5))]
    spots += [(0.34 * math.cos(a), 0.26 * math.sin(a)) for a in (i * math.tau / 6 for i in range(6))]
    if st == "sprout":
        spots = spots[1::2]
    cols = ("herb", "herbD", "herbL", "herbRD")
    for i, (du, dv) in enumerate(spots):                   # each clump: small leaves over a dome
        s = r.uniform(0.85, 1.1) * (1.15 if i == 0 else 1.0)
        rad = (0.1 if st != "sprout" else 0.05) * s
        for j in range(9 if st != "sprout" else 4):
            a, e = r.uniform(0, math.tau), r.uniform(0.15, 1.2)
            lu, lv = u + du + rad * math.cos(a) * math.cos(e), v + dv + rad * math.sin(a) * math.cos(e)
            lz = z + h * s * (0.25 + 0.7 * math.sin(e) / math.sin(1.2))
            k.box(lu, lv, lz, 0.08 * s, 0.05 * s, 0.03, cols[j % 4], top=cols[(j + 1) % 4], rz=a, ry=-0.5)
        k.box(u + du, v + dv, z, rad * 1.2, rad * 1.2, h * s * 0.6, "herbD", taper=0.6)
    if st == "ripe":
        for j in range(12):
            a, d = r.uniform(0, math.tau), r.uniform(0.04, 0.3)
            cu, cv = u + d * math.cos(a), v + d * math.sin(a)
            hs = r.uniform(0.28, min(0.37, hmax - 0.02))
            k.box(cu, cv, z + 0.1, 0.025, 0.025, hs - 0.1, "herbD")
            k.box(cu, cv, z + hs - 0.1, 0.07, 0.07, 0.12, "herbR", top="herbR", taper=0.55)
        for j in range(16):
            a, d = r.uniform(0, math.tau), r.uniform(0.02, 0.32)
            k.box(u + d * math.cos(a), v + d * math.sin(a), z + h * 0.92, 0.055, 0.055, 0.04, "flowerW", top="flowerW")


def _grain(k, u, v, z, st, seed, hmax):
    """Grain: upright stalks in rows. A sprout is rows of green blades; half grown, green stalks with slim green
    heads; ripe, gold straw as tall as the bed lets it be, each with a slim heavy head that nods. Each stalk is
    thicker at its foot, where its blades flare out."""
    r = random.Random(seed * 7 + 2)
    rows = [(u + du + r.uniform(-0.03, 0.03), v + dv + r.uniform(-0.03, 0.03))
            for du in (-0.3, -0.15, 0.0, 0.15, 0.3) for dv in (-0.18, 0.0, 0.18)]
    if st == "sprout":
        for cu, cv in rows:
            for q in range(2):
                k.box(cu + r.uniform(-0.02, 0.02), cv, z, 0.025, 0.025, r.uniform(0.07, 0.12), "leaf",
                      rx=r.uniform(-0.35, 0.35), ry=r.uniform(-0.35, 0.35))
        return
    ripe = st == "ripe"
    for i, (cu, cv) in enumerate(rows):
        h = r.uniform(0.8, 1.0) * (hmax - 0.14) * (1.0 if ripe else 0.62)
        stem = "straw" if ripe else "stalk"
        k.box(cu, cv, z, 0.03, 0.03, h, stem)
        k.box(cu, cv, z, 0.05, 0.05, h * 0.35, stem, taper=0.6)                     # thicker at the foot
        for q in range(3):                                                         # blades flaring from the foot
            b = r.uniform(0, math.tau)
            _leaf(k, cu, cv, z + r.uniform(0.0, 0.06), b, r.uniform(0.13, 0.19), 0.04, r.uniform(0.75, 1.05),
                  ("grainD", "straw", "stalk")[q] if ripe else ("leafD", "stalk", "leaf")[q])
        a = r.uniform(0, math.tau)
        if ripe:
            k.box(cu, cv, z + h - 0.02, 0.055, 0.055, 0.15, ("grain", "grainD")[i % 2], top="grain", taper=0.55,
                  rz=a, ry=0.3 * math.cos(a), rx=0.3 * math.sin(a))
        else:
            k.box(cu, cv, z + h - 0.02, 0.04, 0.04, 0.09, "stalk", top="leafL", taper=0.7, rz=a)


CROPS = {"greens": _greens, "beans": _beans, "herbs": _herbs, "grain": _grain}
VARIANTS = {"bed": (bed, (2, 1)), "large.wide": (large_wide, (3, 2)), "large.twin": (large_twin, (3, 2)),
            "large.tiered": (large_tiered, (3, 2))}
LAYERS = ("off", "on") + tuple(f"crop.{c}.{s}" for c in CROPS for s in STAGES)


def build(variant, layer, rot=0):
    name = f"hydro_{variant.replace('.', '_')}_{layer.replace('.', '_')}_{rot}"
    fn, fp = VARIANTS[variant]
    kb = K(name, fp, rot)
    kb.fp = fp
    plants, zs, ceil = fn(kb, layer == "on")                      # ceil: the underside of the lamp over the plants
    bed = kb.build()
    parts = {n: p.build() for n, p in getattr(kb, "parts", {}).items()}
    for o in parts.get("glass", []):
        o["alpha"], o["rim"] = GLASS_ALPHA, GLASS_RIM
    for o in parts.get("glint", []):
        o["alpha"], o["rim"] = GLINT_ALPHA, GLASS_RIM
    if not layer.startswith("crop."):
        return bed + sum(parts.values(), [])
    for o in sum(parts.values(), []):                                       # the plants show through the glass
        o.hide_render = True
    kc = K(name + "_crop", fp, rot)
    _, crop_id, stage = layer.split(".")
    for i, p in enumerate(plants):
        u, v, pz, pc = p if len(p) == 4 else (*p, zs, ceil)              # a spot may carry its own soil and ceiling
        CROPS[crop_id](kc, u, v, pz, stage, i, pc - pz - 0.06)
    crop = kc.build()
    return crop, crop + bed                     # "over": the crop's px where it is in front of the bed, no outline


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    layers = os.environ.get("HYDRO_LAYERS", ",".join(LAYERS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", VARIANTS[v][1], "over" if s.startswith("crop.") else "prop",
             lambda v=v, s=s: build(v, s)) for v in names for s in layers]
