"""Props, modules and fx sprites (grid frame; origin = centre of the FRONT-most footprint tile at floor level).
Walls, doors and floors live in walls.py. SPRITES lists (id, footprint, kind, builder); kind: floor (diamond-masked),
block (no ring), prop (1 px ring), fx."""
import math
from . import core


# ---- props / modules ------------------------------------------------------------------------------------------

def lamp():
    """module.light: a standing lamp (works against any wall)."""
    m = core.Mesh("lamp")
    m.cyl((0, 0, 0), 0.14, 0.06, "steelD", sides=8, top="plate")
    m.cyl((0, 0, 0.06), 0.035, 0.7, "gm", sides=6)
    m.box((0, 0, 0.74), (0.2, 0.2, 0.05), "gmD", base=True, bevel=0.01)
    m.box((0, 0, 0.79), (0.15, 0.15, 0.11), "arc", base=True)
    m.box((0, 0, 0.9), (0.2, 0.2, 0.03), "gmD", base=True, bevel=0.01)
    return [m.build()]


def console():
    m = core.Mesh("console")
    m.box((0, -0.2, 0), (0.84, 0.46, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    m.box((0, -0.18, 0), (0.7, 0.5, 0.12), "dark", base=True)
    th = 0.5
    n = (0, math.cos(th), math.sin(th))
    up = (0, -math.sin(th), math.cos(th))
    c0 = (0, -0.3, 0.74)
    m.box(c0, (0.78, 0.07, 0.4), "gmD", rx=th, bevel=0.012)
    for k in range(6):
        u = -0.14 + k * 0.058
        p = tuple(c0[i] + n[i] * 0.045 + up[i] * u for i in range(3))
        m.box(p, (0.62, 0.02, 0.036), "magenta", rx=th)
    m.box((0, -0.04, 0.53), (0.66, 0.2, 0.04), "steelL", bevel=0.008)
    for k in range(5):
        m.box((-0.24 + k * 0.12, 0.0, 0.56), (0.07, 0.07, 0.03), "cyan" if k % 2 else "orange")
    m.box((0.34, 0.05, 0.62), (0.05, 0.05, 0.12), "gm", bevel=0.01)
    return [m.build()]


def reactor():
    m = core.Mesh("reactor")
    cx = cy = -0.5
    m.box((cx, cy, 0), (1.92, 1.92, 0.12), "steelD", top="plateA", base=True, bevel=0.02)
    for k in range(10):
        m.box((cx - 0.9 + k * 0.2, cy + 0.95, 0.12), (0.12, 0.05, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
        m.box((cx + 0.95, cy - 0.9 + k * 0.2, 0.12), (0.05, 0.12, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
    m.cyl((cx, cy, 0.12), 0.72, 0.78, "steel", sides=8, top="steelL")
    m.cyl((cx, cy, 0.5), 0.745, 0.08, "gmD", sides=8)
    m.cyl((cx, cy, 0.9), 0.55, 0.3, "gm", sides=8, top="plate")
    for a in (0, 45, 90):
        r = 0.72 * math.cos(math.pi / 8) + 0.005
        ar = math.radians(a)
        m.box((cx + r * math.cos(ar), cy + r * math.sin(ar), 0.2), (0.025, 0.11, 0.55), "cyan", rz=ar, base=True)
    m.cyl((cx, cy, 1.02), 0.3, 0.7, "cyan", sides=8)
    m.cyl((cx, cy, 1.72), 0.36, 0.06, "steelL", sides=8)
    m.cyl((cx, cy, 1.04), 0.37, 0.05, "steelL", sides=8)
    for a in (0, 45, 90):
        ar = math.radians(a)
        m.box((cx + 0.5 * math.cos(ar), cy + 0.5 * math.sin(ar), 1.0), (0.02, 0.1, 0.16), "orange", rz=ar, base=True)
    m.box((cx + 0.15, cy + 0.84, 0.12), (0.7, 0.2, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    for k in range(4):
        m.box((cx + 0.15 - 0.24 + k * 0.16, cy + 0.9, 0.5), (0.08, 0.06, 0.04), ("magenta", "cyan", "orange", "cyan")[k])
    m.box((cx + 0.15, cy + 0.94, 0.3), (0.5, 0.03, 0.12), "dark")
    m.box((cx - 0.55, cy - 0.55, 0.12), (0.22, 0.22, 0.9), "rust", top="rustD", base=True, bevel=0.02)
    return [m.build()]


def life_support():
    """1 wide (x) by 2 long (y): footprint [1, 2]; origin on the front tile, body spans y -1.5..0.5."""
    m = core.Mesh("life_support")
    cy = -0.5
    m.box((0, cy, 0), (0.92, 1.9, 0.14), "steelD", top="plateA", base=True, bevel=0.02)
    for k, y in enumerate((cy - 0.45, cy + 0.45)):
        m.cyl((0, y, 0.14), 0.36, 1.05, "steel", sides=8, top="steelL")
        m.cyl((0, y, 0.5), 0.375, 0.07, "gmD", sides=8)
        m.cyl((0, y, 1.0), 0.375, 0.06, "gmD", sides=8)
        m.cyl((0, y, 1.19), 0.22, 0.12, "gm", sides=8, top="plate")
        for a in (45, 135):
            ar = math.radians(a)
            r = 0.36 * math.cos(math.pi / 8) + 0.005
            m.box((r * math.cos(ar), y + r * math.sin(ar), 0.62), (0.025, 0.1, 0.3), "cyan", rz=ar, base=True)
    m.box((0, cy, 0.14), (0.16, 0.5, 0.95), "gm", top="plate", base=True, bevel=0.01)       # manifold between the tanks
    m.box((0.0, cy, 0.8), (0.2, 0.3, 0.06), "cyan")
    m.box((0.3, cy + 0.85, 0.14), (0.26, 0.2, 0.6), "steelD", top="plate", base=True, bevel=0.01)
    for k in range(3):
        m.box((0.3, cy + 0.96, 0.52 + k * 0.0), (0.16 - k * 0.04, 0.02, 0.04), ("cyan", "orange", "magenta")[k]) if False else None
    m.box((0.3, cy + 0.96, 0.4), (0.14, 0.03, 0.05), "cyan")
    m.box((0.3, cy + 0.96, 0.3), (0.14, 0.03, 0.05), "cyan")
    return [m.build()]


def bed():
    """1 wide (x) by 2 long (y): footprint [1, 2]; mattress top is at 0.22 (sleeping crew are lifted by that)."""
    m = core.Mesh("bed")
    cy = -0.5
    m.box((0, cy, 0), (0.88, 1.9, 0.12), "steelD", top="steel", base=True, bevel=0.015)
    for sx in (-1, 1):
        for y in (cy - 0.85, cy + 0.85):
            m.box((sx * 0.38, y, 0), (0.1, 0.1, 0.1), "dark", base=True)
    m.box((0, cy, 0.1), (0.84, 1.86, 0.12), "navy", top="blueGrey", base=True, bevel=0.02)
    m.box((0, cy - 0.68, 0.22), (0.62, 0.42, 0.08), "medWhite", top="medWhite", base=True, bevel=0.03)   # pillow
    m.box((0, cy + 0.2, 0.22), (0.82, 1.1, 0.035), "steelL", base=True)                                    # blanket
    m.box((0, cy + 0.2, 0.255), (0.8, 1.06, 0.01), "blueGrey", base=True)
    m.box((0, cy - 0.34, 0.22), (0.82, 0.05, 0.04), "orange", base=True)
    m.box((0, cy + 0.93, 0.0), (0.88, 0.05, 0.38), "steelD", top="steel", base=True, bevel=0.01)          # footboard
    m.box((0, cy - 0.93, 0.0), (0.88, 0.05, 0.5), "steelD", top="steel", base=True, bevel=0.01)           # headboard
    m.box((0, cy - 0.9, 0.34), (0.5, 0.02, 0.05), "cyan")
    return [m.build()]


def _crate(m, c, s, body, top, post, rz=0.0, z0=0.0):
    m.box((c[0], c[1], z0), (s, s, s * 0.8), body, top=top, base=True, rz=rz, bevel=0.015)
    h = s * 0.8
    k = s / 2 - 0.025
    ca, sa = math.cos(rz), math.sin(rz)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * k, sy * k
            m.box((c[0] + x * ca - y * sa, c[1] + x * sa + y * ca, z0), (0.06, 0.06, h + 0.01), post, top=post, base=True, rz=rz)
    m.box((c[0], c[1], z0 + h * 0.5), (s + 0.012, s + 0.012, 0.035), post, base=True, rz=rz)


def crates():
    m = core.Mesh("crates")
    _crate(m, (-0.1, -0.1), 0.72, "rust", "rustD", "steel")
    _crate(m, (-0.1, -0.1), 0.5, "steel", "steelL", "gm", rz=0.18, z0=0.58)
    m.box((0.15, 0.26, 0.14), (0.22, 0.012, 0.16), "hazY", base=True)
    m.box((0.3, 0.28, 0), (0.34, 0.34, 0.3), "steelD", top="steel", base=True, bevel=0.015, rz=-0.15)
    m.box((0.3, 0.28, 0.12), (0.355, 0.355, 0.04), "orange", base=True, rz=-0.15)
    return [m.build()]


# ---- fx: fire frames and a smoke puff (clean stacked shapes, a few flat colour bands, no noise) -------------------

FIRE_FRAMES = 6


def _tongue(m, cx, cy, h, r0, phase, sway, bands, nseg=6):
    """A tapering flame tongue: stacked frusta, each shifted sideways by a sine so the frames loop as a flicker."""
    seg = h / nseg
    for i in range(nseg):
        z0, z1 = i * seg, (i + 1) * seg
        t0, t1 = i / nseg, (i + 1) / nseg
        ra, rb = r0 * (1 - t0 ** 1.5), max(0.012, r0 * (1 - t1 ** 1.5))
        ox = sway * math.sin(phase + t0 * 3.2) * t0
        oy = sway * 0.6 * math.cos(phase * 1.0 + t0 * 2.6) * t0
        col = bands[min(len(bands) - 1, int(t0 * len(bands)))]
        m.cyl((cx + ox, cy + oy, z0), ra, seg + 0.004, col, sides=8, rtop=rb)


def fire(k):
    m = core.Mesh(f"fire_{k}", selflit=True)
    ph = k / FIRE_FRAMES * math.tau
    _tongue(m, 0, 0, 0.7 + 0.06 * math.sin(ph * 2), 0.17, ph, 0.07, ("red", "orange", "orange", "flameY"))
    _tongue(m, 0.17, -0.17, 0.46 + 0.05 * math.sin(ph + 2), 0.12, ph + 2.1, 0.05, ("red", "orange", "flameY"), 5)
    _tongue(m, -0.17, 0.17, 0.4 + 0.05 * math.sin(ph + 4), 0.11, ph + 4.2, 0.05, ("red", "orange", "flameY"), 5)
    _tongue(m, 0.1, 0.1, 0.34 + 0.04 * math.sin(ph * 2 + 1), 0.1, ph + 0.6, 0.03, ("flameY", "flameY", "flameW"), 4)
    return [m.build()]


def puff(k):
    """Smoke puff, 4 growing stages: a flat-banded dome (dark rim, light top) that the particle system fades out."""
    m = core.Mesh(f"puff_{k}", flat=True)
    r = 0.07 + 0.045 * k
    m.cyl((0, 0, 0.0), r * 0.8, r * 0.5, "gm", sides=8, rtop=r)
    m.cyl((0, 0, r * 0.5), r, r * 0.45, "plate", sides=8, rtop=r * 0.6)
    m.cyl((0, 0, r * 0.95), r * 0.6, r * 0.25, "steelL", sides=8, rtop=r * 0.25)
    return [m.build()]


def ember():
    m = core.Mesh("ember", selflit=True)
    m.cyl((0, 0, 0), 0.05, 0.04, "orange", sides=4, rtop=0.04)
    m.cyl((0, 0, 0.04), 0.04, 0.03, "flameY", sides=4, rtop=0.02)
    return [m.build()]


def spark():
    m = core.Mesh("spark", selflit=True)
    m.cyl((0, 0, 0), 0.035, 0.05, "flameW", sides=4, rtop=0.02)
    return [m.build()]


def ice():
    """Tiny ice crystal: a double pyramid in two flat tones."""
    m = core.Mesh("ice", flat=True)
    m.cyl((0, 0, 0.0), 0.005, 0.05, "lens", sides=4, rtop=0.045)
    m.cyl((0, 0, 0.05), 0.045, 0.05, "medWhite", sides=4, rtop=0.005)
    return [m.build()]


SPRITES = []
SPRITES += [
    ("prop.crate", (1, 1), "prop", crates),
    ("module.reactor", (2, 2), "prop", reactor),
    ("module.life_support", (1, 2), "prop", life_support),
    ("module.light", (1, 1), "prop", lamp),
    ("module.bed", (1, 2), "prop", bed),
    ("module.console", (1, 1), "prop", console),
]
SPRITES += [(f"fx.fire.{_k}", (1, 1), "fx", lambda k=_k: fire(k)) for _k in range(FIRE_FRAMES)]
SPRITES += [(f"fx.puff.{_k}", (1, 1), "fx", lambda k=_k: puff(k)) for _k in range(4)]
SPRITES += [("fx.ember", (1, 1), "fx", ember), ("fx.spark", (1, 1), "fx", spark), ("fx.ice", (1, 1), "fx", ice)]
