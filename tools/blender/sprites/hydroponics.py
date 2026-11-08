"""Hydroponics grow beds (family `hydroponics`). Local frame and placement: modkit.K (front = +v, where the crew
stand to work the bed).

Look exploration, round 9: the spine layout (a planter, one spine rising from the middle of its back, a ring lamp
over the bed, one plant per tile) in three bodies, each with its own colours, spine structure and detail:
  pot    a flared ceramic planter in cream with a thick lip, a sage swan-neck spine hooked over the ring, a terracotta
         porthole gauge; smooth, little detail
  rig    a squared gunmetal tub with vertical ribs and a hazard-yellow bumper on rubber skids, a lattice truss spine
         with a blue water line, a chamfered ring with yellow clamps; the most detail
  lab    a shallow pearl tray floating on a narrow navy pedestal, a tapered blade spine with a mint stripe, a slim ring;
         vent slots and a small display
  spine  round 8's life support look, kept as the reference
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


def _well(k, inner, outer, z_rim, rim_h, rim, rim_top, wall, z_soil, soil_w, soil_d, seed=3):
    """The rim lip round the soil well (inner and outer outlines) and the soil in it, its surface at z_soil."""
    _ring(k, outer, inner, z_rim - rim_h, rim_h, rim, top=rim_top, inner_col=wall)
    _prism(k, inner, z_rim - rim_h - 0.06, z_soil - (z_rim - rim_h - 0.06), "soilD", top="soilD")
    _soil(k, 0, 0, z_soil - 0.05, soil_w, soil_d, seed, n=int(soil_w * 16))


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


def _lamp_ring(k, cu, cv, z, L, w, bar, on, col=PALE, top=PALE_T, outline=None):
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
def spine(k, on):
    _planter(k, on, -1.0, 1.0, well=(-0.9, 0.9), D=0.92, shape="pill")
    _prism(k, _cham(0, -0.38, 0.5, 0.22, 0.06), Z_RIM - 0.1, 0.18, PALE, top=PALE_T, taper=0.8)   # root in the wall
    sp = _cham(0, -0.39, 0.26, 0.18, 0.06)
    _prism(k, sp, Z_RIM, 1.0, PALE, top=PALE_T, taper=0.92)
    _prism(k, _scaled(sp, 1.04), 1.1, 0.04, TEAL)
    _prism(k, _cham(0, -0.27, 0.3, 0.38, 0.07), 1.6, 0.17, PALE, top=PALE_T)                # the head over the ring
    _lamp_ring(k, 0, 0.0, 1.58, 1.84, 0.7, 0.12, on)
    return ((-0.48, 0.0), (0.48, 0.0)), Z_SOIL


def pot(k, on):
    """Ceramic: flares from a small foot to a thick lip, a swan neck hooked over the ring."""
    _prism(k, _pill_ol(0, 0, 1.56, 0.56), 0.0, 0.08, "potFoot")                                  # foot
    _prism(k, _pill_ol(0, 0, 1.66, 0.66), 0.08, 0.5, "potCream", top="potCreamL", tl=_pill_ol(0, 0, 1.96, 0.88))
    _prism(k, _pill_ol(0, 0, 1.92, 0.86), 0.5, 0.035, "potTerra", tl=_pill_ol(0, 0, 1.94, 0.87))  # glaze line
    zs = 0.66
    _well(k, _pill_ol(0, 0, 1.74, 0.66), _pill_ol(0, 0, 2.02, 0.94), 0.72, 0.14, "potCream", "potCreamL", "potFoot",
          zs, 1.3, 0.54)
    v = 0.4                                                                                 # porthole gauge
    _tube(k, [(-0.5, v - 0.03, 0.3), (-0.5, v + 0.03, 0.3)], 0.1, "potTerra")
    _tube(k, [(-0.5, v + 0.03, 0.3), (-0.5, v + 0.045, 0.3)], 0.065, "waterL" if on else "waterD")
    _tube(k, [(0.5, v - 0.02, 0.3), (0.5, v + 0.04, 0.3)], 0.035, _on(on))
    _tube(k, [(0, -0.42, 0.5), (0, -0.42, 1.62), (0, -0.41, 1.76), (0, -0.38, 1.84), (0, -0.33, 1.87),
              (0, -0.29, 1.84), (0, -0.29, 1.68)], 0.07, "sage")                                              # swan neck
    k.cyl(0, -0.4, 0.66, 0.11, 0.1, "sage", top="sageL", sides=12)                          # its collar in the lip
    _lamp_ring(k, 0, 0.0, 1.56, 1.84, 0.7, 0.11, on, col="sage", top="sageL")
    return ((-0.46, 0.0), (0.46, 0.0)), zs


def rig(k, on):
    """Industrial: a ribbed gunmetal tub on skids, a yellow bumper, a truss spine with a water line."""
    for sv in (-1, 1):                                                                      # rubber skids
        k.box(0, sv * 0.3, 0.0, 1.8, 0.14, 0.1, "indRub", bevel=0.02)
    body = _cham(0, 0, 1.96, 0.9, 0.1)
    _prism(k, body, 0.1, 0.5, "indGun", top="indGunL")
    for i in range(7):                                                                      # vertical ribs
        u = -0.75 + i * 0.25
        for sv in (-1, 1):
            k.box(u, sv * 0.46, 0.12, 0.06, 0.04, 0.44, "indGunL")
    _prism(k, _cham(0, 0, 2.06, 1.0, 0.13), 0.4, 0.07, "hazY", top="hazY")                           # bumper
    zs = 0.64
    _well(k, _cham(0, 0, 1.76, 0.7, 0.06), _cham(0, 0, 2.0, 0.94, 0.12), 0.7, 0.1, "indGunL", "indGunL", "indGunD",
          zs, 1.6, 0.58)
    for u, sv in ((-0.9, 1), (0.9, 1), (-0.9, -1), (0.9, -1), (0, 1)):                       # rim bolts
        k.box(u, sv * 0.41, 0.7, 0.06, 0.06, 0.03, "indGunD")
    k.box(-0.5, 0.47, 0.18, 0.36, 0.012, 0.16, "hazY")                                      # gauge, yellow bezel
    k.box(-0.5, 0.48, 0.2, 0.28, 0.012, 0.12, "dark")
    k.box(-0.5, 0.486, 0.24, 0.22 if on else 0.1, 0.012, 0.04, "waterL" if on else "waterD")
    k.box(0.5, 0.47, 0.2, 0.16, 0.012, 0.12, "dark")
    k.box(0.5, 0.48, 0.23, 0.06, 0.012, 0.05, _on(on))
    for su in (-1, 1):                                                                      # truss posts
        k.box(su * 0.11, -0.4, 0.6, 0.08, 0.08, 1.06, "indGunL", top="indGunL")
    for j in range(4):                                                                      # cross braces
        z0 = 0.72 + j * 0.24
        L = math.hypot(0.22, 0.2)
        k.box(0, -0.4, z0, L, 0.04, 0.045, "indGun", ry=(1 if j % 2 else -1) * math.atan2(0.2, 0.22))
    k.box(0, -0.4, 0.6, 0.36, 0.14, 0.1, "hazY", top="hazY")                                # foot plate
    _tube(k, [(0.2, -0.42, 0.6), (0.2, -0.42, 1.5), (0.18, -0.4, 1.6), (0.13, -0.38, 1.66)], 0.035, "polyB")  # water line
    k.box(0, -0.33, 1.6, 0.34, 0.24, 0.16, "indGun", top="indGunL", bevel=0.02)            # head
    _lamp_ring(k, 0, 0.0, 1.56, 1.86, 0.72, 0.12, on, col="indGun", top="indGunL",
               outline=lambda l, d: _cham(0, 0, l, d, min(0.16, d / 3)))
    for su, sv in ((-1, -1), (1, -1), (-1, 1), (1, 1)):                                     # clamps
        k.box(su * 0.62, sv * 0.3, 1.58, 0.1, 0.16, 0.15, "hazY", top="hazY")
    return ((-0.48, 0.0), (0.48, 0.0)), zs


def lab(k, on):
    """Lab: a shallow pearl tray floating on a narrow navy pedestal, a blade spine with a mint stripe."""
    _prism(k, _pill_ol(0, 0, 1.44, 0.48), 0.0, 0.42, "labNavy", top="labNavyL")              # pedestal
    for i in range(5):                                                                      # vent slots
        k.box(-0.1 + i * 0.09, 0.244, 0.12, 0.05, 0.012, 0.16, "dark")
    _prism(k, _pill_ol(0, 0, 1.7, 0.66), 0.42, 0.2, "labPearl", top="labPearlL", tl=_pill_ol(0, 0, 2.0, 0.92))
    _prism(k, _pill_ol(0, 0, 1.99, 0.915), 0.62, 0.02, "labMint")                           # mint line
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
VARIANTS = {"pot": pot, "rig": rig, "lab": lab, "spine": spine}
LAYERS = ("off", "on", "crop.greens", "crop.grain")


def build(variant, layer, rot=0):
    name = f"hydro_{variant}_{layer.replace('.', '_')}_{rot}"
    kb = K(name, (2, 1), rot)
    plants, zs = VARIANTS[variant](kb, layer == "on")
    bed = kb.build()
    if not layer.startswith("crop."):
        return bed
    for o in bed:                                                           # the bed masks the crop where it is in front
        o.is_holdout = True
    kc = K(name + "_crop", (2, 1), rot)
    for i, (u, v) in enumerate(plants):
        CROPS[layer.split(".")[1]](kc, u, v, zs, i)
    return bed + kc.build()


def jobs(rots=range(4)):
    names = os.environ.get("HYDRO_VARIANTS", ",".join(VARIANTS)).split(",")
    return [(f"module.hydroponics.{v}.{s}", (2, 1), "prop", lambda v=v, s=s: build(v, s)) for v in names for s in LAYERS]
