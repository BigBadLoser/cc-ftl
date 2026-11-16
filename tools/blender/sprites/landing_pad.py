"""Landing pad (family `landing_pad`, issue #509): the 9x9 outdoor pad a surface base's shuttle and its visitors land on,
on levelled asteroid ground. A pale sintered slab raised on its body with a bevelled lip, a yellow touchdown ring and
crosshair, orange lamps on the corners and long orange light strips in its sides. Symmetric: one sprite, no rotations.

  module.landing_pad

Anchored at the front tile's centre, footprint [9, 9]. Game palette plus its unnamed-set extras (no new colours)."""
import math

from . import cmbkit, core
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame
from .turrets import _shift

N = 9
H = N / 2 - 0.04                         # half side, a hair inside the footprint


def square(h, c=0.0):
    return [(h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c), (-h + c, -h), (h - c, -h)]


def rect(u0, v0, u1, v1):
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]


def paint(f, pts, z, mat):
    TB.prism(f, pts, z, z + 0.008, mat, top=mat)


def ring(f, ro, ri, z, mat, sides=40):
    TC.vannulus(f, ro, ri, z, z + 0.008, mat, top=mat, sides=sides)


def lamp(f, u, v, z, mat, r=0.07):
    f.vcyl(u, v, z, r + 0.03, 0.05, "steelD", top="steel", sides=8)
    f.vcyl(u, v, z + 0.05, r, 0.05, mat, top=mat, sides=8)


def crosshair(f, z, r, w, mat):
    for a in range(4):
        c, s = math.cos(a * math.pi / 2), math.sin(a * math.pi / 2)
        pts = [(r * 0.45, -w), (r, -w), (r, w), (r * 0.45, w)]
        paint(f, [(c * u - s * v, s * u + c * v) for u, v in pts], z, mat)












def corner_lamps(f, z, mat="orange", inset=0.55):
    for a in range(4):
        c, s = math.cos(a * math.pi / 2 + math.pi / 4), math.sin(a * math.pi / 2 + math.pi / 4)
        d = (H - inset) * math.sqrt(2)
        lamp(f, c * d, s * d, z, mat)










def side_lamps(f, h, z, mat, n=3, ln=0.22, strip=False):
    """Lamps set into the slab's side faces (half side h) at height z: n per side, or long strips."""
    for side in range(4):
        ca, sa = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)
        ts = [-2.6, 0.0, 2.6] if n == 3 else [-H + 1.2 + k * (2 * H - 2.4) / (n - 1) for k in range(n)]
        for t in ts:
            u, v = h + 0.01, t
            L = 1.4 if strip else ln
            f.box(ca * u - sa * v, sa * u + ca * v, z, 0.06 if side % 2 == 0 else L, L if side % 2 == 0 else 0.06, 0.05, mat, top=mat)


def raised(f, z, foot=0.0, bevel=False):
    """The original slab's top, lifted onto a body z high (an optional dark foot under it, an optional bevelled lip)."""
    if foot:
        TB.prism(f, square(H, 0.5), 0, foot, "steelD", top="steelD")
    hb = H - (0.1 if foot else 0.0)
    if bevel:
        TB.prism(f, square(hb, 0.48), foot, z - 0.06, "plate", top="plate")
        TB.prism(f, square(hb - 0.08, 0.44), z - 0.06, z, "plate", top="sole")
    else:
        TB.prism(f, square(hb, 0.48), foot, z, "plate", top="sole")
    for k in range(1, N):
        t = -H + k * (2 * H / N)
        paint(f, rect(t - 0.012, -H + 0.5, t + 0.012, H - 0.5), z, "plate")
        paint(f, rect(-H + 0.5, t - 0.012, H - 0.5, t + 0.012), z, "plate")
    ring(f, 3.2, 2.95, z + 0.008, "hazY")
    ring(f, 1.0, 0.85, z + 0.008, "hazY")
    crosshair(f, z + 0.008, 2.6, 0.08, "medWhite")
    corner_lamps(f, z)
    return hb






def landing_pad(f):
    """The picked look: the sintered slab raised 0.24 on its body, a bevelled lip, long orange light strips in the sides."""
    hb = raised(f, 0.24, bevel=True)
    side_lamps(f, hb, 0.09, "orange", strip=True)




def pad():
    m = core.Mesh("landing_pad")
    landing_pad(Frame(m, 1, square=True))
    return _shift([m.build()] if cmbkit.REC is None else [], N)


def jobs():
    return [("module.landing_pad", (N, N), "prop", pad)]
