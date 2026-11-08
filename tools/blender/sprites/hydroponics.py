"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

The bed (terra, chosen from a long look exploration; the other directions are in git history): an angular navy base
with a slatted panel and a control screen, a soil tray under a glass canopy in grey frames. The canopy rises upright a
short way, then slopes on its long sides to a glass roof; its ends are upright. A strut across the roof carries a
white ring lamp, open in the middle so the plants show through it, one plant per tile.
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


# ---- the directions --------------------------------------------------------------------------------------------------
# ---- glass enclosed (terrarium) ----------------------------------------------------------------------------------------
GLASS_ALPHA, GLINT_ALPHA, GLASS_RIM = 0.1, 0.5, 0.0


def _part(k, name):
    """A part in its own mesh: "glass" (the see-through panes) or "glint" (see-through reflections). Neither masks the
    crop: the plants show through."""
    if not hasattr(k, "parts"):
        k.parts = {}
    if name not in k.parts:
        k.parts[name] = K(f"{k.m.name}_{name}", (2, 1), k.rot)
    return k.parts[name]


def _bar(k, a, b, s, col):
    """A square frame bar s thick from local point a to b, its faces square to the grid (no diamond edges)."""
    _tube(k, [a, b], s / math.sqrt(2), col, n=4, phase=math.pi / 4)


def _canopy_slope(k, cu, L, D, z0, zv, zr, iv, on, frame, frame_l, ring, ring_t):
    """A glass canopy: a short upright wall from the sill to zv, then the long sides slope up to a glass roof (inset
    iv each side), the short ends upright; square frame bars on every edge, a post and rafter mid-length that a strut
    across the roof joins into one hoop, and a ring lamp (colours ring, ring_t) hung from that strut."""
    g = _part(k, "glass")
    a, b, b2 = L / 2, D / 2, D / 2 - iv
    lo = [(cu - a, -b), (cu + a, -b), (cu + a, b), (cu - a, b)]
    hi = [(cu - a, -b2), (cu + a, -b2), (cu + a, b2), (cu - a, b2)]
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
    for sv in (-1, 1):                                                      # a post and rafter between the plants
        _bar(k, (cu, sv * b, z0), (cu, sv * b, zv), s, frame)
        _bar(k, (cu, sv * b, zv), (cu, sv * b2, zr), s, frame_l)
    g.m.poly([_G(g, *p, zr) for p in hi], "glassT", flip=True)              # the glass roof
    _bar(k, (cu, -b2, zr), (cu, b2, zr), s, frame_l)                          # the strut across it
    Lr, zl = L - 0.1, zr - 0.22
    _lamp_ring(k, cu, 0, zl, Lr, 2 * b2, 0.09, on, col=ring, top=ring_t)
    for sv in (-1, 1):                                                      # hung from the strut
        _bar(k, (cu, sv * (b2 - 0.045), zl + 0.1), (cu, sv * (b2 - 0.045), zr), 0.045, frame)
    up = zr - zv                                                            # the front slope: v and z at fraction f
    fs = lambda f: (b - f * iv + 0.006, zv + f * up)
    # Reflections: pale bands in pairs at half opacity (see-through, so they never mask the crop). Each bay: up the
    # front slope, then on across the roof; the end pane has its pair centred.
    kg = _part(k, "glint")
    (v0, za), (v1, zb) = fs(0.08), fs(1.0)
    for bay in (-1, 1):
        for du, w in ((-0.2, 0.08), (-0.07, 0.04)):
            u0 = cu + bay * L / 4 + du
            _streak(kg, (u0, v0, za), (u0 + 0.12, v1, zb), (w, 0, 0), "glassG")
            _streak(kg, (u0 + 0.12, b2, zr + 0.006), (u0 + 0.24, -b2 + 0.04, zr + 0.006), (w, 0, 0), "glassG")
    for dv, w in ((0.1, 0.08), (-0.03, 0.04)):
        _streak(kg, (cu + a + 0.006, dv, z0 + 0.06), (cu + a + 0.006, dv - 0.12, zv + 0.2), (0, -w, 0), "glassG")


def _streak(k, p0, p1, e, col):
    """A flat reflection band from p0 to p1 (local u, v, z), e wide (a local vector across it)."""
    q = [p0, p1, tuple(p1[i] + e[i] for i in range(3)), tuple(p0[i] + e[i] for i in range(3))]
    k.m.poly([_G(k, *p) for p in q], col, flip=True)


def _tray(k, cu, L, D, z0, zs, seed):
    """The bed's soil tray inside a canopy (its edge hidden by the sill)."""
    _prism(k, _cham(cu, 0, L, D, 0.02), z0, zs - 0.05 - z0, "soilD", top="soilD")
    _soil(k, cu, 0, zs - 0.05, L - 0.12, D - 0.12, seed, n=int(L * 14))


BODY = _cham(0, 0, 1.9375, 0.875, 0.02)    # the base body: front face on v = 14/32, ends on u = +-31/32 (whole px)
FV, EU = 0.4375, 0.96875


def _screen(k, u, z, on):
    """The control screen: a dark bezel with a lit readout and a status light."""
    k.box(u, FV + 0.006, z, 0.25, 0.01, 0.12, "dark")
    k.box(u - 0.0625, FV + 0.012, z + 0.04, 0.125, 0.01, 0.05, _on(on))
    k.box(u + 0.09375, FV + 0.012, z + 0.04, 0.0625, 0.01, 0.05, _on(on, "orange"))


def _slats(k, u, z, h, n, col, back="dark"):
    """A vent: n 2 px slats at a 4 px pitch, centred on u, over a dark recess."""
    w = n * 0.125 - 0.0625
    k.box(u, FV, z - 0.02, w + 0.125, 0.01, h + 0.04, back)
    for j in range(n):
        k.box(u - w / 2 + 0.03125 + j * 0.125, FV + 0.006, z, 0.0625, 0.01, h, col)


def _base_orig(k, on):
    _prism(k, BODY, 0.1, 0.5, "tNavy", top="tNavyL")
    _slats(k, -0.40625, 0.22, 0.22, 6, "tNavyL")
    k.box(0.5, FV, 0.26, 0.3125, 0.01, 0.2, "tFrame")
    _screen(k, 0.5, 0.3, on)


def _base_band(k, on):
    """Two-tone, like an appliance: a navy lower half, a white upper half under the sill, a dark seam between that
    wraps round all four sides. Vent and screen sit in the white."""
    _prism(k, BODY, 0.1, 0.2, "tNavy")
    _prism(k, _cham(0, 0, 1.875, 0.8125, 0.02), 0.3, 0.04, "dark")                          # the seam, 1 px in
    _prism(k, BODY, 0.34, 0.26, "tWhite", top="tWhiteL")
    _vent_slots(k, -0.484375, 0.39, 0.12, 5)
    _screen(k, 0.484375, 0.39, on)


def _vent_slots(k, u, z, h, n):
    """Dark 2 px slots at a 4 px pitch, centred on u, cut into a panel."""
    for j in range(n):
        k.box(u + (j - (n - 1) / 2) * 0.125, FV + 0.012, z, 0.0625, 0.01, h, "dark")


def _base_bays(k, on):
    """Navy body with a white panel under each canopy bay, framed dark, a navy pilaster between them under the
    canopy's middle post; a white panel on each end. The vent is in the left panel, the screen in the right."""
    _prism(k, BODY, 0.1, 0.5, "tNavy", top="tNavyL")
    w, z0, h = 0.78125, 0.18, 0.3
    for cu in (-0.484375, 0.484375):
        k.box(cu, FV, z0 - 0.025, w + 0.0625, 0.01, h + 0.05, "dark")
        k.box(cu, FV + 0.006, z0, w, 0.01, h, "tWhite")
    for sg in (-1, 1):
        k.box(sg * EU, 0, z0 - 0.025, 0.01, 0.6875 + 0.0625, h + 0.05, "dark")
        k.box(sg * (EU + 0.006), 0, z0, 0.01, 0.6875, h, "tWhite")
    _vent_slots(k, -0.484375, z0 + 0.05, h - 0.1, 5)
    _screen(k, 0.484375, z0 + 0.09, on)


def _base_posts(k, on):
    """White body on a navy plinth, carried by navy posts at the corners and under the canopy's middle post, so the
    white reads as panels set in a navy frame. A thin lit strip under the sill; vent left, screen right."""
    _prism(k, BODY, 0.1, 0.1, "tNavy")
    _prism(k, BODY, 0.2, 0.4, "tWhite", top="tWhiteL")
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 0.90625, sv * 0.375, 0.1, 0.15625, 0.15625, 0.46, "tNavy", top="tNavyL")
    for sv in (-1, 1):
        k.box(0, sv * 0.39, 0.1, 0.125, 0.11, 0.46, "tNavy", top="tNavyL")
    for cu in (-0.453125, 0.453125):                                                       # a lit strip per bay, top
        k.box(cu, FV + 0.004, 0.5, 0.65625, 0.01, 0.03, _on(on, "growPink"))
    _vent_slots(k, -0.453125, 0.26, 0.18, 5)
    _screen(k, 0.453125, 0.3, on)


BASES = {"orig": _base_orig, "band": _base_band, "bays": _base_bays, "posts": _base_posts}


def terra(k, on, base="orig"):
    """One long glass canopy on an angular base (the BASES), grey frames."""
    _prism(k, _cham(0, 0, 1.9, 0.84, 0.03), 0.0, 0.1, "dark")                                 # kick
    BASES[base](k, on)
    _ring(k, _cham(0, 0, 2.0, 0.9375, 0.02), _cham(0, 0, 1.86, 0.8, 0.02), 0.56, 0.1, "tFrame", top="tFrameL")  # sill
    zs = 0.69
    _tray(k, 0, 1.84, 0.8, 0.6, zs, 3)
    _canopy_slope(k, 0, 1.92, 0.88, 0.66, 0.87, 1.36, 0.13, on, "tFrame", "tFrameL", "ringW", "ringWL")
    return ((-0.47, 0.0), (0.47, 0.0)), zs, 1.14


# ---- stand-in crops (the real crops come once the bed is approved) ---------------------------------------------------
def _greens(k, u, v, z, seed=0, hmax=None):
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


def _grain(k, u, v, z, seed=0, hmax=0.85):
    """Upright stalks with heavy gold heads, the tallest crop, as tall as the bed lets it be (hmax over the soil)."""
    r = random.Random(seed * 7 + 2)
    for i in range(13):
        a, d = r.uniform(0, math.tau), 0.22 * math.sqrt(r.uniform(0.05, 1.0))
        cu, cv = u + d * math.cos(a), v + d * math.sin(a)
        h = r.uniform(0.66, 1.0) * (hmax - 0.17)
        k.box(cu, cv, z, 0.045, 0.045, h, "stalk")
        k.box(cu, cv, z + h - 0.03, 0.08, 0.08, 0.2, "grain", top="grain", taper=0.6, rz=a)
        k.box(cu + 0.03, cv, z + h * 0.4, 0.16, 0.05, 0.03, "leafD", rz=a, ry=-0.5)


CROPS = {"greens": _greens, "grain": _grain}
VARIANTS = {"terra": terra, **{f"terra.{b}": (lambda k, on, b=b: terra(k, on, b)) for b in ("band", "bays", "posts")}}
LAYERS = ("off", "on", "crop.greens", "crop.grain")


def build(variant, layer, rot=0):
    name = f"hydro_{variant.replace('.', '_')}_{layer.replace('.', '_')}_{rot}"
    kb = K(name, (2, 1), rot)
    plants, zs, ceil = VARIANTS[variant](kb, layer == "on")      # ceil: the underside of the lamp over the plants
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
    kc = K(name + "_crop", (2, 1), rot)
    for i, (u, v) in enumerate(plants):
        CROPS[layer.split(".")[1]](kc, u, v, zs, i, hmax=ceil - zs - 0.06)
    crop = kc.build()
    return crop, crop + bed                     # "over": the crop's px where it is in front of the bed, no outline


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", (2, 1), "over" if s.startswith("crop.") else "prop", lambda v=v, s=s: build(v, s))
            for v in names for s in LAYERS]
