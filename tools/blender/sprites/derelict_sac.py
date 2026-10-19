"""Alien egg sacs (derelict dressing): thin wet membranes full of sickly fluid, each with an embryo curled inside.

Translucency is baked: the skin and the fluid are see-through materials (core: an `alpha` object property, opacity
rising toward the silhouette by `rim`), so the render blends skin, fluid and embryo before the sprite is flattened.
Layers, back to front of the eye: the resin pad (opaque), the fluid volume (flat lit-from-within green, see-through),
the embryo (opaque dark), the skin (pale violet, mostly clear in the middle, opaque at the rim), and on top the opaque
veins, wet glints and resin strands. Every layer is its own object, so they can later ship as separate runtime layers.

The skin is a deformed lat-long sheet, not a lathe: a slumped teardrop, lumpy, pinched by the strands that hold it."""
import math

from . import core

SKIN_ALPHA, SKIN_RIM = 0.5, 0.5
FLUID_ALPHA = 0.65
PROF = [(0.0, 0.78), (0.1, 0.97), (0.26, 1.0), (0.46, 0.9), (0.64, 0.72), (0.8, 0.5), (0.92, 0.27), (1.0, 0.0)]


def _prof(v):
    for (v0, a), (v1, b) in zip(PROF, PROF[1:]):
        if v0 <= v <= v1:
            return a + (b - a) * (v - v0) / (v1 - v0)
    return PROF[-1][1]


class Sac:
    """One sac's shape: centre, radius, height, lean (droop of the top), lumps and strand pinches."""

    def __init__(self, x, y, r, h, lean=(0.0, 0.0), lumps=((2, 0.06, 0.3), (3, 0.05, 1.9)), pinch=(110, 230, 350),
                 fluid=0.42):
        self.x, self.y, self.r, self.h, self.lean = x, y, r, h, lean
        self.lumps, self.pinch, self.fluid = lumps, pinch, fluid

    def rad(self, u, v, k=1.0):
        bump = sum(a * math.cos(n * u + p) for n, a, p in self.lumps) * math.sin(math.pi * min(v, 0.9))
        pin = sum(0.09 * math.exp(-((math.atan2(math.sin(u - math.radians(a)), math.cos(u - math.radians(a)))) / 0.13) ** 2)
                  for a in self.pinch) * math.sin(math.pi * v)
        return self.r * _prof(v) * (1 + bump - pin) * k

    def p(self, u, v, k=1.0, dr=0.0):
        rr = self.rad(u, v, k) + dr
        return (self.x + self.lean[0] * v * v + rr * math.cos(u), self.y + self.lean[1] * v * v + rr * math.sin(u),
                self.h * v)


def _sheet(m, S, col, v0=0.0, v1=1.0, k=1.0, nu=22, nv=12, cap=None):
    """The skin (or, k < 1, the fluid inside it) between heights v0 and v1 as quads; cap: colour of a flat top."""
    us = [i * 2 * math.pi / nu for i in range(nu + 1)]
    vs = [v0 + (v1 - v0) * j / nv for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            q = [S.p(us[i], vs[j], k), S.p(us[i + 1], vs[j], k), S.p(us[i + 1], vs[j + 1], k), S.p(us[i], vs[j + 1], k)]
            m.poly([core.G(*a) for a in q], col(us[i], vs[j]) if callable(col) else col)
    if cap:
        m.poly([core.G(*S.p(u, v1, k)) for u in us[:-1]], cap)


def _embryo(m, S, size=1.0):
    """A curled dark body near the middle of the sac, half above the fluid so it shows through the clear skin: a
    hunched back, a head tucked down toward the camera, one glowing eye."""
    r = S.r * size
    for (dx, dy, z, rr) in ((0.0, 0.0, 0.36, 0.42), (0.18, 0.2, 0.3, 0.3), (0.3, 0.34, 0.2, 0.2), (-0.2, 0.1, 0.24, 0.24)):
        m.cyl((S.x + S.lean[0] * 0.1 + dx * r, S.y + S.lean[1] * 0.1 + dy * r, S.h * z - r * rr * 0.8), r * rr,
              r * rr * 1.7, "xnK", sides=10, rtop=r * rr * 0.55)
    m.box((S.x + 0.36 * r, S.y + 0.42 * r, S.h * 0.22), (0.03, 0.03, 0.03), "xnG")


def _veins(m, S, azs, v1=0.85):
    """Dark veins across the skin: a meridian each, wandering, with a short branch."""
    for az in azs:
        a = math.radians(az)
        pts = [S.p(a + 0.18 * math.sin(j * 1.1 + az), 0.08 + (v1 - 0.08) * j / 9, 1.0, 0.006) for j in range(10)]
        pts += [S.p(a + 0.35, 0.5, 1.0, 0.006), S.p(a + 0.55, 0.62, 1.0, 0.006)]
        for (p0, p1) in list(zip(pts[:9], pts[1:10])) + [(pts[5], pts[10]), (pts[10], pts[11])]:
            _rod(m, p0, p1, 0.024, "xnP")


def _rod(m, p0, p1, w, col):
    """A thin straight bar between two grid points (any direction)."""
    d = [b - a for a, b in zip(p0, p1)]
    L = math.sqrt(sum(c * c for c in d)) or 1e-6
    rz = math.atan2(d[1], d[0])
    ry = -math.asin(max(-1.0, min(1.0, d[2] / L)))
    m.box(tuple((a + b) / 2 for a, b in zip(p0, p1)), (L + w * 0.5, w, w), col, rz=rz, ry=ry)


def _glints(m, S, spots):
    """Small sharp wet highlights following the curve of the lit (screen-left, +y) shoulder."""
    for az, v, s in spots:
        px, py, pz = S.p(math.radians(az), v, 1.0, 0.01)
        m.box((px, py, pz), (s, s, s * 0.7), "xnH", rz=math.radians(az))


def _strands(m, S, n_pin=True):
    """Resin strands down the pinch lines, gripping the deck."""
    for az in S.pinch:
        a = math.radians(az)
        pts = [S.p(a, v, 1.0, 0.012) for v in (0.7, 0.5, 0.3, 0.12)]
        foot = (S.x + (S.r * 1.25) * math.cos(a), S.y + (S.r * 1.25) * math.sin(a), 0.0)
        for p0, p1 in zip(pts + [pts[-1]], pts[1:] + [foot]):
            _rod(m, p0, p1, 0.034, "xnM")


def _pad(name, cx, cy, r, w):
    """The resin pad on the deck (lobed membrane, dark crease) with a wet sheen."""
    from .derelict import blob, decal
    parts = [(3, 0.18, 0.4), (5, 0.12, 1.3), (7, 0.06, 2.2)]

    def fn(x, y):
        d = blob(x, y, cx, cy, r, parts)
        if d >= 1:
            return None
        if d > 0.86:
            return "xnK"
        return "xnM" if (d * 3.5) % 1 < 0.25 else "xnD"
    return decal(name, fn, z=0.004, x0=cx - w / 2 - 0.5, y0=cy - w / 2 - 0.5, w=w + 1, h=w + 1)


def _layers(name, sacs, pad, big):
    """Build every layer of a sac group: [pad + solids, fluid, skin] objects."""
    solid = pad
    fluid = core.Mesh(f"{name}_fluid", flat=True)
    skin = core.Mesh(f"{name}_skin")
    for k, S in enumerate(sacs):
        _sheet(fluid, S, lambda u, v: "xnF" if v < S.fluid - 0.07 else "xnFL", 0.0, S.fluid, k=0.9, nv=6, cap="xnFL")
        _sheet(skin, S, "xnS")
        if k in big:
            _embryo(solid, S, 0.9)
            _veins(solid, S, (215,))
        _glints(solid, S, ((112, 0.7, 0.05), (100, 0.6, 0.032), (125, 0.8, 0.032), (60, 0.42, 0.028)))
        _strands(solid, S)
    out = [solid.build(), fluid.build(), skin.build()]
    out[1]["alpha"] = FLUID_ALPHA
    out[2]["alpha"], out[2]["rim"] = SKIN_ALPHA, SKIN_RIM
    return out


def eggsac(n):
    if n == 1:
        sacs = [Sac(-0.03, -0.03, 0.3, 0.62, (0.04, 0.02)),
                Sac(0.25, 0.17, 0.13, 0.25, (0.02, 0.0), pinch=(200,), lumps=((2, 0.05, 1.0),), fluid=0.4)]
        return _layers("eggsac_1", sacs, _pad("eggsac_1_pad", 0.0, 0.0, 0.46, 1), (0,))
    cx, cy = -0.5, -0.5
    sacs = [Sac(cx - 0.12, cy - 0.12, 0.5, 0.95, (0.06, 0.03)),
            Sac(cx + 0.44, cy + 0.14, 0.28, 0.5, (0.05, 0.02), pinch=(90, 300), fluid=0.48),
            Sac(cx - 0.04, cy + 0.47, 0.24, 0.42, (0.02, 0.05), pinch=(0, 220), fluid=0.38),
            Sac(cx + 0.33, cy - 0.44, 0.2, 0.36, (0.03, 0.03), pinch=(180,), fluid=0.44)]
    return _layers("eggsac_2", sacs, _pad("eggsac_2_pad", cx, cy, 0.95, 2), (0, 1))


SPRITES = [("decay.eggsac.1x1", (1, 1), "prop", lambda: eggsac(1)),
           ("decay.eggsac.2x2", (2, 2), "prop", lambda: eggsac(2))]
