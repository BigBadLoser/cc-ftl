"""Hydroponics grow beds (family `hydroponics`): the small bed `module.hydroponics` (2 x 1) and the large bed
`module.hydroponics_large` (3 x 2). Local frame and placement: modkit.K (front = +v, where the crew stand to work it).

The small bed (chosen from a long look exploration; the other directions are in git history): two standing white
tanks, one under each plant, and a pump between them, inside grey corner legs; a copper manifold along the front with
a red valve on each tank. Above, a soil tray under a glass canopy in grey frames: it rises upright a short way, then
slopes on its long sides to a glass roof; its ends are upright. A strut across the roof carries a white ring lamp,
open in the middle so the plants show through it, one plant per tile. The large bed is one wide greenhouse over six
plants in two rows, a lamp ring over each row and a strut along the roof between them, on two oval tanks.
Sprites (see sprite_id): the bed lit and `.unpowered`, and `.crop.<crop>.<stage>` drawn on top of the bed, rendered
with the bed as a holdout so the lamp cuts the plant where it passes in front of it (two draws, no front layer)."""
import math
import os
import random

from . import core
from .hydro_crops import CROPS, STAGES
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


# ---- the large bed (3 x 2 tiles) --------------------------------------------------------------------------------------
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


def _base_large(k, on):
    """Two oval tanks running front to back, one under each half, a pump between them lifting into one copper
    manifold along the front with a valve on each tank, in grey corner legs."""
    _frame_legs(k, 1.421875, 0.890625)
    for su in (-1, 1):
        _otank(k, su * 0.76, 0.05, 1.3, 1.7, 0.04, 0.52, on)
    zm, zb = 0.48, 0.084
    _pump(k, 0.0, 0.66, 0.0, on, s=1.2)
    _sq_pipe(k, [(0.0, 0.7, zb), (0.0, VQL, zb), (0.0, VQL, zm)])
    _sq_pipe(k, [(-1.21875, VQL, 0.56), (-1.21875, VQL, zm), (1.21875, VQL, zm), (1.21875, VQL, 0.56)])
    for su in (-1, 1):
        _valve(k, su * 0.76, VQL, zm)


def large(k, on):
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


SIZES = {"module.hydroponics": (bed, (2, 1)), "module.hydroponics_large": (large, (3, 2))}
LAYERS = ("off", "on") + tuple(f"crop.{c}.{s}" for c in CROPS for s in STAGES)


def build(asset, layer, rot=0):
    """The objects of one sprite: the bed lit (`on`) or dark (`off`), or a crop layer (`crop.<crop>.<stage>`) with the
    bed as its holdout."""
    name = f"hydro_{asset.split('.')[-1]}_{layer.replace('.', '_')}_{rot}"
    fn, fp = SIZES[asset]
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


def hydroponics(state="on", rot=0):
    """The small bed lit, for the damage pack's `.damaged` / `.destroyed` (damage.py)."""
    return build("module.hydroponics", "on", rot)


def sprite_id(asset, layer, rot):
    """`<asset>` (r0) or `<asset>.rN` lit, `<asset>.rN.unpowered` dark (the game's module art chain), and
    `<asset>.crop.<crop>.<stage>.rN` for a crop layer."""
    if layer == "on":
        return asset if rot == 0 else f"{asset}.r{rot}"
    if layer == "off":
        return f"{asset}.r{rot}.unpowered"
    return f"{asset}.{layer}.r{rot}"


def jobs(rots=range(4)):
    """Every size, rotation and layer; HYDRO_SIZES (asset ids) and HYDRO_LAYERS narrow it for previews."""
    sizes = os.environ.get("HYDRO_SIZES", ",".join(SIZES)).split(",")
    layers = os.environ.get("HYDRO_LAYERS", ",".join(LAYERS)).split(",")
    out = []
    for a in sizes:
        fp = SIZES[a][1]
        for r in rots:
            f = fp if r % 2 == 0 else (fp[1], fp[0])
            for ly in layers:
                out.append((sprite_id(a, ly, r), f, "over" if ly.startswith("crop.") else "prop",
                            lambda a=a, ly=ly, r=r: build(a, ly, r)))
    return out
