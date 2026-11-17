"""Landing pad (family `landing_pad`, issue #509): the 9x9 outdoor pad a surface base's shuttle and its visitors land on,
on levelled asteroid ground. A pale sintered slab raised on its body with a bevelled lip, a yellow touchdown ring and
crosshair, orange lamps on the corners and long orange light strips in its sides. Symmetric: one sprite, no rotations.

  module.landing_pad

Anchored at the front tile's centre, footprint [9, 9]. Game palette plus its unnamed-set extras (no new colours)."""
import math

from . import cmbkit, core
from . import turret_bays as TB
from . import turret_concepts as TC
from . import turret_ground as TG
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


def side_lamps(f, h, z, mat, n=3, ln=0.22, strip=False, port=False):
    """Lamps set into the slab's side faces (half side h) at height z: n per side, or long strips (none in the middle of
    the +u side when the cable port is there)."""
    for side in range(4):
        ca, sa = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)
        ts = [-2.6, 0.0, 2.6] if n == 3 else [-H + 1.2 + k * (2 * H - 2.4) / (n - 1) for k in range(n)]
        for t in ts:
            if port and side == 0 and t == 0.0:
                continue
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


def landing_pad(f, port=None):
    """The picked look: the sintered slab raised 0.24 on its body, a bevelled lip, long orange light strips in the sides;
    the cable's junction box in the middle of the +u side."""
    hb = raised(f, 0.24, bevel=True)
    side_lamps(f, hb, 0.09, "orange", strip=True, port=bool(port))
    if port:
        port(f, hb)


def port_box(f, hb):
    """A: the turret mount's junction box, its body running back over the lip, standing proud of the slab."""
    TG.port3(f, z=0.0, u0=hb - 0.75, u1=N / 2)


def port_flush(f, hb):
    """B: a low box set into the side, flush with the slab's top, a hatch and lamp on its lid."""
    z1, w = 0.26, 0.3
    TB.prism(f, rect(hb - 0.5, -w, N / 2, w), 0, z1, "steel", top="steelL")
    TB.prism(f, rect(hb - 0.42, -w + 0.06, N / 2 - 0.08, w - 0.06), z1, z1 + 0.02, "steelD", top="steel")
    for k in range(6):
        v0 = -w + 0.08 + k * (2 * w - 0.16) / 6
        TB.prism(f, rect(N / 2 - 0.01, v0, N / 2 + 0.005, v0 + (2 * w - 0.16) / 6), 0.08, 0.16, "hazY" if k % 2 == 0 else "hazK", top="hazK")
    f.box(hb - 0.3, 0.0, z1 + 0.02, 0.08, 0.08, 0.04, "cyan", top="cyan")


def port_post(f, hb):
    """C: a power post on the lip: a squat pillar the cable climbs into, a breaker head and lamp on top."""
    TB.prism(f, rect(hb - 0.3, -0.24, N / 2, 0.24), 0, 0.3, "steel", top="steelL")       # the socket block at the edge
    f.vcyl(hb - 0.35, 0.0, 0.24, 0.2, 0.36, "steelD", top="steel", sides=12)
    f.box(hb - 0.35, 0.0, 0.6, 0.34, 0.3, 0.16, "steel", top="steelL")
    for k in range(5):
        f.box(hb - 0.35 + 0.171, -0.12 + k * 0.06, 0.62, 0.01, 0.05, 0.08, "hazY" if k % 2 == 0 else "hazK", top="hazK")
    f.vcyl(hb - 0.35, 0.0, 0.76, 0.05, 0.05, "cyan", top="cyan", sides=8)


def port_socket(f, hb):
    """D: a socket in the side face: a round plug ring the cable runs into, a flush service hatch and lamp above it."""
    TB.prism(f, rect(hb - 0.02, -0.28, N / 2, 0.28), 0.02, 0.2, "steelD", top="steel")       # the socket's face plate
    f.box(N / 2 - 0.01, 0.0, 0.05, 0.02, 0.26, 0.12, "dark", top="dark")                    # the plug's mouth
    for o in (-0.22, 0.22):
        f.box(N / 2 - 0.005, o, 0.04, 0.012, 0.04, 0.14, "hazY", top="hazY")
    TB.prism(f, rect(hb - 0.9, -0.42, hb - 0.12, 0.42), 0.24, 0.252, "steelL", top="steelL")   # flush hatch on the lip
    TB.prism(f, rect(hb - 0.84, -0.36, hb - 0.18, 0.36), 0.252, 0.256, "steel", top="steel")
    f.box(hb - 0.5, 0.0, 0.256, 0.1, 0.1, 0.03, "cyan", top="cyan")


def ring_at(f, u, ro, ri, z, mat, sides=16):
    for k in range(sides):
        a0, a1 = k * math.tau / sides, (k + 1) * math.tau / sides
        pts = [(u + ro * math.cos(a0), ro * math.sin(a0)), (u + ro * math.cos(a1), ro * math.sin(a1)),
               (u + ri * math.cos(a1), ri * math.sin(a1)), (u + ri * math.cos(a0), ri * math.sin(a0))]
        TB.prism(f, pts, z, z + 0.012, mat, top=mat)


def port_ramp(f, hb):
    """E: the cable rides a ribbed ramp up the side onto the lip and ends in a round deck socket with a lit ring."""
    z = 0.24
    for k in range(5):                                                             # ramp steps: ground to the lip
        u0 = N / 2 - (k + 1) * 0.12
        TB.prism(f, rect(u0, -0.2, N / 2 - k * 0.12, 0.2), 0, 0.05 + k * 0.05, "steel", top="steelL")
    TB.prism(f, rect(hb - 0.7, -0.2, hb - 0.02, 0.2), z, z + 0.05, "steel", top="steelL")
    f.vcyl(hb - 0.85, 0.0, z, 0.26, 0.05, "steelD", top="steel", sides=16)
    ring_at(f, hb - 0.85, 0.2, 0.15, z + 0.05, "cyan")
    f.vcyl(hb - 0.85, 0.0, z + 0.05, 0.1, 0.03, "dark", top="steelD", sides=10)


def port_bay(f, hb):
    """F: a service bay built into the side: a wider block a little proud of the body, louvres, its own lamp strip, the
    socket in its middle."""
    w = 0.75
    TB.prism(f, rect(hb - 0.3, -w, N / 2, w), 0, 0.2, "plate", top="plate")
    TB.prism(f, rect(hb - 0.3, -w, N / 2 - 0.02, w), 0.2, 0.28, "steel", top="steelL")
    for k in range(4):                                                             # louvres either side of the socket
        for sgn in (-1, 1):
            v = sgn * (0.3 + k * 0.1)
            f.box(N / 2 - 0.005, v, 0.05, 0.012, 0.05, 0.12, "steelD", top="steelD")
    f.box(N / 2 - 0.005, 0.0, 0.03, 0.02, 0.3, 0.14, "dark", top="dark")           # socket
    f.box(N / 2 - 0.005, 0.0, 0.18, 0.015, 0.4, 0.03, "orange", top="orange")      # lamp strip over it
    f.box(hb - 0.1, 0.0, 0.28, 0.12, 0.12, 0.03, "cyan", top="cyan")


PORTS = {"d": port_socket, "e": port_ramp, "f": port_bay}


def pad(rot=0, look="a"):
    m = core.Mesh(f"landing_pad_{look}")
    landing_pad(Frame(m, (1 + rot) % 4, square=True), PORTS[look])
    return _shift([m.build()] if cmbkit.REC is None else [], N)


def jobs():
    return [(f"module.landing_pad.{k}.r0", (N, N), "prop", lambda k=k: pad(0, k)) for k in PORTS]
