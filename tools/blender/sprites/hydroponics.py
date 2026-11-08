"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

Look exploration, round 8 (the earlier 21 directions are in git history). One planter body for all three, in the
life support look: a pale chamfered casing on a dark kick base, a teal trim band, a recessed soil well, one plant per
tile. Each variant grows its overhead light from that body in a different way:
  gantry  the planter's two ends rise into pylons (nutrient tank, pump) carrying a pill lamp bar between them
  spine   one chamfered spine rises from the middle of the back wall and holds a pill ring lamp over the bed
  crane   a tower at one end of the planter (the nutrient tank) with a boom out over the bed, a lamp head per plant
Layers: `.off` / `.on` are the bed; `.crop.<test>` is a stand-in crop drawn on top of the bed, rendered with the bed as
a holdout so the lamp cuts the plant where it passes in front of it (two draws, no front layer). HYDRO_VARIANTS
narrows the build."""
import math
import os
import random

from . import core
from .modkit import K

PALE, PALE_T, FRAME, TEAL = "hyPale", "hyPaleL", "hyFrame", "hyTeal"
Z_KICK, Z_RIM, Z_SOIL = 0.12, 0.68, 0.63                    # kick base top, rim top, soil surface


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


def _prism(k, ol, z0, h, col, top=None, taper=1.0, bottom=False, lean=None):
    """A solid with the outline ol (CCW) from z0 up h; its top outline shrunk by taper about the centre. lean =
    (vb, s) instead squeezes the top toward v = vb by s, so the face away from vb leans back (a console front)."""
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


# ---- the planter -----------------------------------------------------------------------------------------------------
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


def _planter(k, on, u0, u1, D=0.9, well=(None, None), seed=3, shape="cham"):
    """The planter body from u0 to u1, D deep: kick base, casing, trim band, rim round a soil well, front panel with a
    water gauge and a status light. well = (wu0, wu1) narrows the soil well along u. shape: "cham" (cut corners),
    "pill" (round ends) or "lean" (cut corners, the front face leaning back like a console)."""
    cu, L = (u0 + u1) / 2, u1 - u0
    ol = (lambda c, v, l, d, cut: _pill_ol(c, v, l, d)) if shape == "pill" else _cham
    lean = (-D / 2, 0.84) if shape == "lean" else None
    _prism(k, ol(cu, 0, L - 0.1, D - 0.1, 0.1), 0.0, Z_KICK, FRAME, top=FRAME)                 # kick base
    body = ol(cu, 0, L, D, 0.14)
    zb = Z_RIM - 0.08 - Z_KICK
    _prism(k, body, Z_KICK, zb, PALE, top=PALE_T, lean=lean)
    tb = 0.46
    band = body if lean is None else [(u, lean[0] + (v - lean[0]) * (1 - (1 - lean[1]) * (tb - Z_KICK) / zb)) for u, v in body]
    _prism(k, _scaled(band, 1.012), tb, 0.045, TEAL)                                        # trim band
    wu0, wu1 = well[0] if well[0] is not None else u0 + 0.09, well[1] if well[1] is not None else u1 - 0.09
    wc, wl, wd = (wu0 + wu1) / 2, wu1 - wu0, D - 0.18
    vc = 0.0
    if lean is not None:
        wd = D * lean[1] - 0.18
        vc = -D / 2 + D * lean[1] / 2
    inner = ol(wc, vc, wl, wd, 0.08)
    outer = ol(wc, vc, wl + 0.2, wd + 0.18, 0.14)
    _ring(k, outer, inner, Z_RIM - 0.08, 0.08, PALE, top=PALE_T, inner_col=FRAME)           # rim lip
    _prism(k, inner, Z_RIM - 0.14, Z_SOIL - (Z_RIM - 0.14), "soilD", top="soilD")
    _soil(k, wc, vc, Z_SOIL - 0.05, wl - (0.36 if shape == "pill" else 0.16), wd - 0.12, seed, n=int(wl * 16))
    a = 0.0 if lean is None else math.atan2(D * (1 - lean[1]), zb)                      # the front face's lean
    def front(u, z, w, h, col, out=0.0):                                                   # a plate on the front face
        f = D / 2 - (z + h / 2 - Z_KICK) * math.tan(a) + 0.004 + out
        k.box(u, f, z, w, 0.012, h, col, rx=-a)
    front(cu - L * 0.2, 0.2, 0.42, 0.18, "hyDark")                                         # gauge recess
    front(cu - L * 0.2, 0.23, 0.34, 0.05, "waterD", 0.006)                                  # gauge tube
    if on:
        front(cu - L * 0.2 - 0.04, 0.24, 0.24, 0.03, "waterL", 0.012)
    front(cu + L * 0.22, 0.22, 0.2, 0.14, "hyDark")                                         # status plate
    front(cu + L * 0.22, 0.27, 0.07, 0.05, "cyan" if on else "steelD", 0.008)


def _lamp_bar(k, cu, cv, z, L, w, on, ol=None):
    """A pill lamp: a pale housing over a lit lens band (its lower edge, the part seen from the room)."""
    ol = ol or _pill_ol(cu, cv, L, w)
    _prism(k, _scaled(ol, 0.94), z, 0.045, "growPink" if on else "lampOff")
    _prism(k, ol, z + 0.045, 0.09, PALE, top=PALE_T)


def _lamp_ring(k, cu, cv, z, L, w, bar, on):
    """A pill ring lamp, open in the middle so the plants show through it: housing over a lit lens band."""
    o, i = _pill_ol(cu, cv, L, w), _pill_ol(cu, cv, L - 2 * bar, w - 2 * bar)
    lo, li = _pill_ol(cu, cv, L - 0.03, w - 0.03), _pill_ol(cu, cv, L - 2 * bar + 0.03, w - 2 * bar + 0.03)
    _ring(k, lo, li, z, 0.045, "growPink" if on else "lampOff")
    _ring(k, o, i, z + 0.045, 0.08, PALE, top=PALE_T)


# ---- the three directions --------------------------------------------------------------------------------------------
def gantry(k, on):
    _planter(k, on, -1.0, 1.0, well=(-0.68, 0.68))
    for e in (-1, 1):                                                       # the ends rise into pylons
        ol = _cham(e * 0.83, 0, 0.3, 0.6, 0.09)
        _prism(k, ol, Z_RIM - 0.1, 1.86 - (Z_RIM - 0.1), PALE, top=PALE_T, taper=0.9)
        _prism(k, _scaled(ol, 1.03), 0.46, 0.045, TEAL)
        _prism(k, _scaled(ol, 0.95), 1.62, 0.04, TEAL)                       # collar where the bar meets it
        f = 0.3 * 0.95 + 0.004
        if e < 0:                                                           # nutrient tank window
            k.box(e * 0.83, f, 0.86, 0.14, 0.012, 0.5, "hyDark")
            k.box(e * 0.83, f + 0.006, 0.9, 0.08, 0.012, 0.42, "waterD")
            if on:
                k.box(e * 0.83, f + 0.012, 0.9, 0.08, 0.012, 0.28, "waterL")
        else:                                                               # pump grille
            for j in range(4):
                k.box(e * 0.83, f, 0.92 + j * 0.1, 0.16, 0.014, 0.04, "hyDark")
    _lamp_bar(k, 0, 0, 1.56, 1.42, 0.26, on, ol=_cham(0, 0, 1.42, 0.26, 0.06))
    return ((-0.38, 0.0), (0.38, 0.0))


def spine(k, on):
    _planter(k, on, -1.0, 1.0, well=(-0.9, 0.9), D=0.92, shape="pill")
    _prism(k, _cham(0, -0.38, 0.5, 0.22, 0.06), Z_RIM - 0.1, 0.18, PALE, top=PALE_T, taper=0.8)   # root in the wall
    sp = _cham(0, -0.39, 0.26, 0.18, 0.06)
    _prism(k, sp, Z_RIM, 1.0, PALE, top=PALE_T, taper=0.92)
    _prism(k, _scaled(sp, 1.04), 1.1, 0.04, TEAL)
    head = _cham(0, -0.27, 0.3, 0.38, 0.07)                                  # the head reaching over the ring
    _prism(k, head, 1.6, 0.17, PALE, top=PALE_T)
    _lamp_ring(k, 0, 0.0, 1.58, 1.84, 0.7, 0.12, on)
    return ((-0.48, 0.0), (0.48, 0.0))


def crane(k, on):
    _planter(k, on, -1.0, 0.66, well=(-0.9, 0.58), shape="lean")
    tw = _cham(0.8, 0, 0.36, 0.7, 0.1)                                       # the tower: the nutrient tank
    _prism(k, tw, 0.0, 1.9, PALE, top=PALE_T, taper=0.92)
    _prism(k, _scaled(tw, 1.0), 0.0, Z_KICK, FRAME)
    _prism(k, _scaled(tw, 1.012), 0.46, 0.045, TEAL)
    _prism(k, _scaled(tw, 0.95), 1.62, 0.045, TEAL)
    f = 0.35 * 0.96
    k.box(0.8, f, 0.62, 0.2, 0.012, 0.8, "hyDark")                           # tall tank window
    k.box(0.8, f + 0.006, 0.66, 0.12, 0.012, 0.72, "waterD")
    if on:
        k.box(0.8, f + 0.012, 0.66, 0.12, 0.012, 0.46, "waterL")
    boom = _cham(-0.16, 0, 1.58, 0.18, 0.05)                                 # the boom out over the bed
    _prism(k, boom, 1.68, 0.12, PALE, top=PALE_T)
    plants = ((-0.54, -0.07), (0.16, -0.07))
    for u, v in plants:                                                     # a lamp head per plant
        k.cyl(u, v, 1.6, 0.035, 0.1, "hyFrameL", sides=8)
        c = _circle(u, v, 0.21)
        _prism(k, _scaled(c, 0.92), 1.48, 0.04, "growPink" if on else "lampOff")
        _prism(k, c, 1.52, 0.09, PALE, top=PALE_T, taper=0.8)
    return plants


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
        h = r.uniform(0.5, 0.8)
        k.box(cu, cv, z, 0.045, 0.045, h, "stalk")
        k.box(cu, cv, z + h - 0.03, 0.08, 0.08, 0.2, "grain", top="grain", taper=0.6, rz=a)
        k.box(cu + 0.03, cv, z + h * 0.4, 0.16, 0.05, 0.03, "leafD", rz=a, ry=-0.5)


CROPS = {"greens": _greens, "grain": _grain}
VARIANTS = {"gantry": gantry, "spine": spine, "crane": crane}
LAYERS = ("off", "on", "crop.greens", "crop.grain")


def build(variant, layer, rot=0):
    name = f"hydro_{variant}_{layer.replace('.', '_')}_{rot}"
    kb = K(name, (2, 1), rot)
    plants = VARIANTS[variant](kb, layer == "on")
    bed = kb.build()
    if not layer.startswith("crop."):
        return bed
    for o in bed:                                                           # the bed masks the crop where it is in front
        o.is_holdout = True
    kc = K(name + "_crop", (2, 1), rot)
    for i, (u, v) in enumerate(plants):
        CROPS[layer.split(".")[1]](kc, u, v, Z_SOIL, i)
    return bed + kc.build()


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", (2, 1), "prop", lambda v=v, s=s: build(v, s)) for v in names for s in LAYERS]
