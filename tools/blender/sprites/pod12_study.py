"""Recovery pod look study round 12 (family `pod`, preview only): z2 spine and z3 octagon reworked after review.

  - the corner column stands off the tank: its inner face is clear of the glass (a gap all the way up between the
    housings), where round 11 pushed it into the tank
  - the column grows out of the base: the base housing (and the plinth or platform under it, and the top housing) is
    one extruded keyhole outline, the hull of the round (or octagonal) housing and the column's section, so the
    housing's side runs straight on into the column's faces; its lip and lit seams are the same outline, carried round
    the column; the column rises flush from it, with no faces overlapping it (no flicker)

  k2 spine   k3 octagon

Layers as round 1 (pod_study.py). Units: world (1 = a tile), z in world units."""
import math

from .core import G
from .pod10_study import BLUE, RH, Z0, Z1, ekg, tank
from .pod8_study import at, lamp, vpipe
from .research_kit import Bench, bar

FP2 = (2, 2)
RIGHT = -math.pi / 4
FRONT = math.pi / 4
C0, C1, W = 0.84, 1.16, 0.34                                 # the column: from C0 to C1 along RIGHT, W wide (glass R 0.62)
OC = 0.98 / math.cos(math.pi / 8)                            # the octagon platform: flats on the footprint's edges
EKG = dict(a0=FRONT - 0.4, a1=FRONT + 0.6)                   # the heartbeat band, clear of the keyhole's flat


def _hull(pts):
    """Convex hull, counter-clockwise (monotone chain)."""
    pts = sorted(set(pts))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 1e-9:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 1e-9:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def keyhole(r, d=0.0, sides=32, dc=None):
    """The outline: a round (sides 32) or octagonal (8) housing of circumradius r, hulled with the column's section;
    the housing grown by d (an octagon along its apothem), the column by dc (default d)."""
    dc = d if dc is None else dc
    a0 = math.pi / sides
    rr = r + d / math.cos(a0)
    pts = [at(a0 + i * math.tau / sides, rr) for i in range(sides)]
    tu, tv = math.cos(RIGHT), math.sin(RIGHT)
    nu, nv = -tv, tu
    for s in (C0 - dc, C1 + dc):
        for t in (-1, 1):
            pts.append((s * tu + t * (W / 2 + dc) * nu, s * tv + t * (W / 2 + dc) * nv))
    return [(round(u, 6), round(v, 6)) for u, v in pts]


def prism(k, outline, z, h, col, top=None):
    """An upright prism on a convex outline (local u, v), from z, h tall."""
    P = [k.p(u, v) for u, v in _hull(outline)]
    n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        k.m.poly([G(*a, z), G(*b, z), G(*b, z + h), G(*a, z + h)], col, flip=True)
    k.m.poly([G(*p, z + h) for p in P][::-1], top or col, flip=True)


def column(k, z0, z1, col, top):
    k.box(*at(RIGHT, (C0 + C1) / 2), z0, C1 - C0, W, z1 - z0, col, top=top, rz=RIGHT)


def face(off=0.0):
    """The column's face toward the camera: its centre, (along RIGHT), (along FRONT)."""
    c = at(RIGHT, (C0 + C1) / 2)
    n = W / 2 + 0.006 + off
    return (c[0] + n * math.cos(FRONT), c[1] + n * math.sin(FRONT)), \
        (math.cos(RIGHT), math.sin(RIGHT)), (math.cos(FRONT), math.sin(FRONT))


def housing(k, z0, z1, body, top, lip, lit, sides, bevel=True):
    """The base housing on its keyhole: body to z1 - 0.08, a bevel round the tank only (the column carries on up from
    z1 - 0.08), a chrome lip near the foot and a lit seam under the bevel, both carried round the column."""
    zb = z1 - 0.08
    prism(k, keyhole(RH, sides=sides), z0, zb - z0, body, top)
    if bevel:
        k.cyl(0.0, 0.0, zb, RH - 0.06, 0.08, body, top=top, sides=sides)
    prism(k, keyhole(RH, 0.008, sides), z0 + 0.04, 0.03, lip[0], lip[1])
    prism(k, keyhole(RH, 0.006, sides), zb - 0.02, 0.014, lit, lit)
    k.cyl(0.0, 0.0, z1 - 0.02, 0.66, 0.03, lit, top=lit, sides=sides)                        # the tank's lit foot
    return zb


def k2(layer="all"):
    """Spine: the column grows out of the base housing's keyhole, stands off the tank up to the top housing (the same
    keyhole), carries on above it, and its arm runs over the top to the hub."""
    k = Bench(f"pod_k2_{layer}", FP2)
    tank(k, layer, BLUE)
    if layer == "glass":
        return k.build()
    zb = Z0 - 0.08
    if layer == "all":
        prism(k, keyhole(0.98, dc=0.04), 0.0, 0.12, "arcBodyD", "arcBody")         # the plinth,
        prism(k, keyhole(0.98, 0.005, dc=0.045), 0.115, 0.012, "arcChrD", "arcChr")
        housing(k, 0.12, Z0, "arcShellD", "arcShell", ("arcChrD", "arcChr"), "podBL", 32)
        ekg(k, RH, 0.2, "podBL", **EKG)
    th = 0.24
    prism(k, keyhole(RH), Z1, th, "arcShellD", "arcShell")                                    # the top housing,
    prism(k, keyhole(RH, 0.006), Z1 + 0.08, 0.03, "podBL", "podBL")
    k.cyl(0.0, 0.0, Z1 + th, 0.6, 0.12, "arcShellD", top="arcShell", sides=32)
    z = Z1 + th + 0.12
    column(k, zb, Z1, "arcShell", "arcShell")                                                 # the spine: free of
    column(k, Z1 + th, z + 0.3, "arcShell", "arcShell")                                       # the glass, and on up
    k.box(*at(RIGHT, 0.4), z + 0.02, 0.84, 0.3, 0.14, "arcShellD", top="arcShellD", rz=RIGHT)    # its arm,
    k.cyl(0.0, 0.0, z - 0.02, 0.24, 0.24, "arcShellD", top="arcShell", sides=20)             # the hub (above the arm)
    k.cyl(0.0, 0.0, z + 0.22, 0.12, 0.05, "podBL", top="podBL", sides=14)
    for d in (-0.15, 0.15):
        k.box(*[c + d * f for c, f in zip(at(RIGHT, 0.4), (math.cos(FRONT), math.sin(FRONT)))], z + 0.1, 0.74,
              0.012, 0.02, "podBL", rz=RIGHT)
    (fu, fv), (tu, tv), (nu, nv) = face()
    k.box(fu, fv, Z0 + 0.04, 0.24, 0.02, Z1 - Z0 - 0.12, "arcBodyD", rz=RIGHT)              # a dark channel,
    for i in range(2):                                                                         # two hoses in it,
        d = (i - 0.5) * 0.1
        p = (fu + d * tu + 0.025 * nu, fv + d * tv + 0.025 * nv)
        bar(k, (*p, Z0 + 0.06), (*p, Z1 - 0.1), 0.06, "arcChr")
    for zc in (0.9, 1.7, 2.5):                                                                 # clamps over them,
        k.box(fu + 0.04 * nu, fv + 0.04 * nv, zc, 0.26, 0.04, 0.08, "arcBodyD", top="arcBody", rz=RIGHT)
    k.box(fu + 0.05 * nu, fv + 0.05 * nv, 1.25, 0.2, 0.03, 0.42, "arcBodyK", top="arcBodyD", rz=RIGHT)
    for i in range(6):                                                                         # a level gauge,
        k.box(fu + 0.068 * nu, fv + 0.068 * nv, 1.29 + i * 0.058, 0.14, 0.004, 0.036,
              "podBL" if i < 4 else "arcBodyD", rz=RIGHT)
    for i, c in enumerate(("podBL", "podBL", "arcAmb")):                                      # status lights
        lamp(k, fu + (i - 1) * 0.08 * tu + 0.04 * nu, fv + (i - 1) * 0.08 * tv + 0.04 * nv, Z1 + th + 0.08, c, 0.055)
    ou, ov = at(RIGHT, C1 + 0.006)                                                             # vents on its outer end
    for i in range(5):
        k.box(ou, ov, 1.0 + i * 0.12, 0.006, 0.24, 0.04, "arcBodyK", rz=RIGHT)
    return k.build()


def k3(layer="all"):
    """Octagon: the platform, base housing and cap are octagon-and-column keyholes; the cartridge tower grows out of
    the base housing, stands off the tank, and a riser on its axis joins it to the cap's shoulder."""
    k = Bench(f"pod_k3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    zb = Z0 - 0.08
    if layer == "all":
        prism(k, keyhole(OC, 0.0, 8, dc=0.04), 0.0, 0.16, "arcBodyD", "arcBody")      # the platform,
        prism(k, keyhole(OC - 0.1, 0.0, 8, dc=0.0), 0.16, 0.03, "arcChrD", "arcChr")
        housing(k, 0.19, Z0, "arcShell", "arcShellL", ("arcChrD", "arcChr"), "podGL", 8)
        ekg(k, RH, 0.24, "podGL", **EKG)
    zt = 1.36                                                                                  # the tower,
    column(k, zb, zt, "arcShell", "arcShellL")
    (fu, fv), (tu, tv), (nu, nv) = face()
    k.box(fu, fv, Z0 + 0.04, 0.28, 0.012, 0.64, "arcBodyK", rz=RIGHT)                        # its recess,
    for j in (-1, 0, 1):                                                                       # the cartridges in it,
        cu, cv = fu + j * 0.09 * tu + 0.06 * nu, fv + j * 0.09 * tv + 0.06 * nv
        k.cyl(cu, cv, Z0 + 0.12, 0.045, 0.3, "podGM", top="podGM", sides=10)
        k.cyl(cu, cv, Z0 + 0.42, 0.045, 0.025, "podGL", top="podGL", sides=10)
        k.cyl(cu, cv, Z0 + 0.445, 0.045, 0.1, "arcGlass", top="arcGlass", sides=10)
        k.cyl(cu, cv, Z0 + 0.08, 0.055, 0.05, "arcChrD", top="arcChr", sides=10)
        k.cyl(cu, cv, Z0 + 0.54, 0.055, 0.05, "arcChrD", top="arcChr", sides=10)
    lamp(k, fu - tu * 0.09 + 0.04 * nu, fv - tv * 0.09 + 0.04 * nv, Z0 + 0.72, "podGL", 0.06)
    lamp(k, fu + tu * 0.09 + 0.04 * nu, fv + tv * 0.09 + 0.04 * nv, Z0 + 0.72, "arcAmb", 0.06)
    xu, xv = at(RIGHT, (C0 + C1) / 2)                                                          # the fan on its top,
    k.cyl(xu, xv, zt, 0.15, 0.02, "arcBodyK", top="arcBodyK", sides=16)
    for j in range(3):
        k.box(xu, xv, zt + 0.02, 0.26, 0.03, 0.012, "arcChrD", top="arcChr", rz=j * math.pi / 3)
    k.cyl(xu, xv, zt + 0.02, 0.05, 0.03, "podGL", top="podGL", sides=10)
    vpipe(k, xu, xv, zt + 0.04, Z1 + 0.02, r=0.08)                                            # the riser on its axis
    prism(k, keyhole(RH + 0.04, sides=8), Z1, 0.22, "arcShell", "arcShellL")                  # the octagonal cap,
    prism(k, keyhole(RH + 0.04, 0.005, 8), Z1 + 0.07, 0.03, "podGL", "podGL")
    k.cyl(0.0, 0.0, Z1 + 0.22, RH - 0.16, 0.12, "arcBodyD", top="arcBody", sides=8)
    k.box(*at(FRONT, 0.6), Z1 + 0.34, 0.34, 0.34, 0.02, "arcChrD", top="arcChr", rz=FRONT)
    for i, c in enumerate(("podGL", "arcAmb", "podGL")):
        lamp(k, *at(FRONT + (i - 1) * 0.28, RH + 0.05), Z1 + 0.12, c, 0.05)
    return k.build()


def jobs():
    out = []
    for v, f in (("k2", k2), ("k3", k3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
