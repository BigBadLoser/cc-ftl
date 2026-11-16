"""GROUND TURRET MOUNT (#514): the armoured tower a weapon or point-defence turret stands on out on an asteroid's rock.

The turret sprites are modelled on the roof plane (turret_concepts.ZR), so the mount's top is that plane and the turret
sits on it unchanged. One sprite per cable side: `module.<stem>.ground.r<rot>`, the power port facing grid +x at r0,
turned clockwise with the sim rotation (r1 +y, r2 -x, r3 -y), so the renderer picks the one facing the cable.

  footing   a low octagonal pad on the rock
  skirt     an eight-sided armour skirt
  drum      the eight-sided tower, two bands and a hazard-striped band near the top
  buttress  four stepped buttresses on the diagonals
  collar    the top ring the turret's race stands in
  port      a junction box at the foot on the cable side, centred on the -v tile's row (the cable's tile), a conduit
            stub out to the footprint edge

Frame as turret_bays (u = grid +x, v = grid +y at r0, origin = footprint centre at floor level)."""
import math

from . import cmbkit, core
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
TOP = TC.ZR
PORT_V = -0.5                                                   # the cable leaves from the -v tile of the +u side
OCT = [((k + 0.5) * math.tau / 8) for k in range(8)]          # flat faces on the axes


def octagon(r):
    """Corners of an eight-sided outline of apothem r, faces square to the grid."""
    rc = r / math.cos(math.pi / 8)
    return [(rc * math.cos(a), rc * math.sin(a)) for a in OCT]


def obox(f, a, r0, r1, w, z0, z1, mat, top=None):
    """A box along the radial direction a: radius r0..r1, half width w across, z0..z1."""
    ca, sa = math.cos(a), math.sin(a)
    TB.prism(f, [(ca * r - sa * o, sa * r + ca * o) for r, o in ((r0, -w), (r1, -w), (r1, w), (r0, w))], z0, z1, mat, top=top or mat)


def hazard_band(f, r, z0, z1, n=16):
    """Alternating yellow / black plates round the drum, standing just proud of it."""
    _g("hazard")
    for k in range(n):
        a = (k + 0.5) * math.tau / n
        c = "hazY" if k % 2 == 0 else "hazK"
        obox(f, a, r - 0.02, r + 0.025, r * math.sin(math.pi / n) * 1.02, z0, z1, c)


def mount(rot=0):
    m = core.Mesh("ground_mount")
    f = Frame(m, (1 + rot) % 4, square=True)
    _g("footing")
    TB.prism(f, octagon(0.94), 0, 0.08, "gm", top="steelD")
    _g("skirt")
    TB.prism(f, octagon(0.78), 0.08, 0.42, "steelD", top="steel")
    _g("drum")
    TB.prism(f, octagon(0.58), 0.42, TOP - 0.16, "steelD", top="steel")
    for z in (0.78, 1.36):
        TB.prism(f, octagon(0.6), z, z + 0.06, "steel", top="steelL")
    hazard_band(f, 0.6, 1.62, 1.72)
    _g("buttress")
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        obox(f, a, 0.5, 0.9, 0.08, 0.08, 0.62, "steelD", top="steel")
        obox(f, a, 0.5, 0.74, 0.07, 0.62, 1.08, "steelD", top="steel")
    _g("collar")
    TB.prism(f, octagon(0.66), TOP - 0.16, TOP - 0.04, "steel", top="steelL")
    TC.vannulus(f, 0.62, 0.5, TOP - 0.04, TOP, "steelL", "steel")
    _g("port")
    v = PORT_V
    box = lambda u0, u1, w, z0, z1, mat, top=None: TB.prism(f, [(u0, v - w), (u1, v - w), (u1, v + w), (u0, v + w)], z0, z1, mat, top=top or mat)  # noqa: E731
    box(0.5, 0.84, 0.2, 0.08, 0.52, "steel", "steelL")                           # junction box, on the cable's row
    box(0.84, 0.86, 0.14, 0.16, 0.44, "steelD")                                 # its access plate
    box(0.86, 1.0, 0.09, 0.04, 0.16, "dark", "steelD")                          # conduit stub out to the edge
    box(0.6, 0.7, 0.05, 0.52, 0.56, "dark")                                     # status lamp (idle: dark)
    return [m.build()] if cmbkit.REC is None else []
