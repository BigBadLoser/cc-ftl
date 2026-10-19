"""Alien egg sacs (derelict dressing): thin wet membranes full of sickly fluid, each with an embryo curled inside.

Translucency is baked: the skin and the fluid are see-through materials (core: an `alpha` object property, opacity
rising toward the silhouette by `rim`), so the render blends skin, fluid and embryo before the sprite is flattened.
Layers, back to front of the eye: the resin pad (opaque), the fluid volume (flat lit-from-within green, see-through),
the embryo (opaque dark), the skin (pale violet, mostly clear in the middle, opaque at the rim), and on top the opaque
veins, wet glints and resin strands. Every layer is its own object, so they can later ship as separate runtime layers.

The skin is a deformed lat-long sheet, not a lathe: a slumped teardrop, lumpy, pinched by the strands that hold it."""
import math

from . import core

SKIN_ALPHA, SKIN_RIM = 0.36, 0.6
FLUID_ALPHA = 0.55
PROF = [(0.0, 0.78), (0.1, 0.97), (0.26, 1.0), (0.46, 0.9), (0.64, 0.72), (0.8, 0.5), (0.92, 0.27), (1.0, 0.0)]


def _prof(v):
    for (v0, a), (v1, b) in zip(PROF, PROF[1:]):
        if v0 <= v <= v1:
            return a + (b - a) * (v - v0) / (v1 - v0)
    return PROF[-1][1]


class Sac:
    """One sac's shape: centre, radius, height, lean (droop of the top), lumps and strand pinches."""

    def __init__(self, x, y, r, h, lean=(0.0, 0.0), lumps=((2, 0.06, 0.3), (3, 0.05, 1.9)), pinch=(110, 230, 350),
                 fluid=0.7, veins=(0, 70, 150, 215)):
        self.x, self.y, self.r, self.h, self.lean = x, y, r, h, lean
        self.veins = veins
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


def _ball(m, c, r, col, n=8):
    """A small UV sphere (rounded blobs, not cones)."""
    for j in range(n // 2):
        t0, t1 = math.pi * j / (n // 2) - math.pi / 2, math.pi * (j + 1) / (n // 2) - math.pi / 2
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            q = [(c[0] + r * math.cos(t) * math.cos(a), c[1] + r * math.cos(t) * math.sin(a), c[2] + r * math.sin(t))
                 for t, a in ((t0, a0), (t0, a1), (t1, a1), (t1, a0))]
            m.poly([core.G(*p) for p in q], col)


def _embryo(m, S, size=1.0):
    """A curled foetus (dark fluid green: its shadow in the fluid) in the screen plane (so its C-shape reads from the camera): a big head at the top, the spine
    curling down and round under it in shrinking blobs, two tucked limb nubs, one glowing eye."""
    r = S.r * size
    e1 = (1 / math.sqrt(2), -1 / math.sqrt(2))                      # screen-horizontal ground direction
    fwd = S.r * 0.5 / math.sqrt(2)                                  # just in front of the fluid's surface, under the skin
    cx, cy, cz = S.x + S.lean[0] * 0.1 + fwd, S.y + S.lean[1] * 0.1 + fwd, S.h * 0.32
    rho = r * 0.36

    def at(phi, out=0.0):
        return (cx + (rho + out) * math.cos(phi) * e1[0], cy + (rho + out) * math.cos(phi) * e1[1],
                cz + (rho + out) * math.sin(phi))
    _ball(m, at(math.radians(105)), r * 0.3, "xnFD", 10)                                    # head
    for k, deg in enumerate((60, 20, -20, -60, -100, -140, -175)):                        # spine, curling under
        _ball(m, at(math.radians(deg)), r * (0.24 - 0.022 * k), "xnFD")
    for deg in (150, -10):                                                                 # tucked limbs
        _ball(m, at(math.radians(deg), -rho * 0.55), r * 0.1, "xnFD", 6)
    hx, hy, hz = at(math.radians(105))
    m.box((hx + 0.6 * r * 0.3, hy + 0.6 * r * 0.3, hz), (0.03, 0.03, 0.03), "xnG")       # its eye, toward the camera


def _veins(m, S, azs, v1=0.8):
    """Veins over the skin in a blood violet (a near-black line reads as a crack), thick at the foot and thinning as
    they wander up a meridian, with one low-angle branch."""
    for az in azs:
        a = math.radians(az)
        pts = [S.p(a + 0.16 * math.sin(j * 1.2 + az), 0.06 + (v1 - 0.06) * j / 8, 1.0, 0.008) for j in range(9)]
        br = [pts[3], S.p(a + 0.3, 0.42, 1.0, 0.008), S.p(a + 0.45, 0.56, 1.0, 0.008)]
        for seg, w0 in ((pts, 0.042), (br, 0.028)):
            for k, (p0, p1) in enumerate(zip(seg, seg[1:])):
                _rod(m, p0, p1, max(0.022, w0 - 0.0028 * k), "xnV")


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
        _sheet(fluid, S, lambda u, v: "xnFL" if v < S.fluid - 0.06 else "xnA", 0.0, S.fluid, k=0.8, nv=8, cap="xnA")
        _sheet(skin, S, "xnS")
        if k in big:
            _embryo(solid, S, 1.05)
            _veins(solid, S, S.veins)
        _glints(solid, S, ((112, 0.7, 0.05), (100, 0.6, 0.032), (125, 0.8, 0.032), (60, 0.42, 0.028)))
        _strands(solid, S)
    out = [solid.build(), fluid.build(), skin.build()]
    out[1]["alpha"] = FLUID_ALPHA
    out[2]["alpha"], out[2]["rim"] = SKIN_ALPHA, SKIN_RIM
    return out


def eggsac(n):
    if n == 1:
        sacs = [Sac(-0.04, -0.04, 0.4, 0.78, (0.04, 0.02)),
                Sac(0.3, 0.22, 0.11, 0.2, (0.02, 0.0), pinch=(200,), lumps=((2, 0.05, 1.0),), fluid=0.6)]
        return _layers("eggsac_1", sacs, _pad("eggsac_1_pad", 0.0, 0.0, 0.5, 1), (0,))
    cx, cy = -0.5, -0.5
    sacs = [Sac(cx - 0.12, cy - 0.12, 0.5, 0.95, (0.06, 0.03)),
            Sac(cx + 0.44, cy + 0.14, 0.28, 0.5, (0.05, 0.02), pinch=(90, 300), fluid=0.66),
            Sac(cx - 0.04, cy + 0.47, 0.24, 0.42, (0.02, 0.05), pinch=(0, 220), fluid=0.6),
            Sac(cx + 0.33, cy - 0.44, 0.2, 0.36, (0.03, 0.03), pinch=(180,), fluid=0.64)]
    return _layers("eggsac_2", sacs, _pad("eggsac_2_pad", cx, cy, 0.95, 2), (0, 1))


SPRITES = [("decay.eggsac.1x1", (1, 1), "prop", lambda: eggsac(1)),
           ("decay.eggsac.2x2", (2, 2), "prop", lambda: eggsac(2))]
