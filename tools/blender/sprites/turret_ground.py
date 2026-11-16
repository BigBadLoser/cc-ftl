"""GROUND TURRET MOUNT (#514): what a weapon or point-defence turret stands on out on an asteroid's rock. Prototype round 2:
three low variants (the turret sits on the mount's top, `TOPS[variant]` high, well under the roof plane; the renderer drops
the roof-modelled turret sprite by (ZR - top) * zPx).

  A bunker   a squat eight-sided casemate with a sloped armour skirt, the turret's race ring set in its roof
  B trestle  an open four-legged steel trestle, braced, a round deck on top, a conduit up one leg
  C plinth   a broad chamfered square plinth over the whole footprint, hazard-edged, four corner bollards

Each has a junction box at its foot on the cable side (grid +x at r0, turned clockwise with the sim rotation), centred on
the -v tile's row (the cable's tile), a conduit stub out to the footprint edge.

Frame as turret_bays (u = grid +x, v = grid +y at r0, origin = footprint centre at floor level)."""
import math

from . import cmbkit, core
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
TOPS = {"A": 1.0, "B": 0.95, "C": 0.7}
PORT_V = -0.5                                                   # the cable leaves from the -v tile of the +u side
OCT = [((k + 0.5) * math.tau / 8) for k in range(8)]          # flat faces on the axes


def octagon(r):
    """Corners of an eight-sided outline of apothem r, faces square to the grid."""
    rc = r / math.cos(math.pi / 8)
    return [(rc * math.cos(a), rc * math.sin(a)) for a in OCT]


def square(h, c):
    """A square of half side h with its corners cut by c."""
    return [(h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c), (-h + c, -h), (h - c, -h)]


def obox(f, a, r0, r1, w, z0, z1, mat, top=None):
    """A box along the radial direction a: radius r0..r1, half width w across, z0..z1."""
    ca, sa = math.cos(a), math.sin(a)
    TB.prism(f, [(ca * r - sa * o, sa * r + ca * o) for r, o in ((r0, -w), (r1, -w), (r1, w), (r0, w))], z0, z1, mat, top=top or mat)


def slope(f, outline, r0, r1, z0, z1, mat, top, steps=4):
    """A sloped skirt: the outline shrinking from r0 to r1 over z0..z1 in stacked bands."""
    for k in range(steps):
        t = k / steps
        TB.prism(f, outline(r0 + (r1 - r0) * t), z0 + (z1 - z0) * t, z0 + (z1 - z0) * (t + 1 / steps), mat, top=top)


def race(f, top, ro=0.6, ri=0.5):
    """The ring the turret's race stands in."""
    _g("race")
    TC.vannulus(f, ro, ri, top - 0.05, top, "steelL", "steel")
    f.vcyl(0, 0, top - 0.06, ri, 0.04, "dark", sides=28)


def port(f, z1=0.4):
    _g("port")
    v = PORT_V
    box = lambda u0, u1, w, z0, zz, mat, top=None: TB.prism(f, [(u0, v - w), (u1, v - w), (u1, v + w), (u0, v + w)], z0, zz, mat, top=top or mat)  # noqa: E731
    box(0.6, 0.86, 0.18, 0.04, z1, "steel", "steelL")                           # junction box, on the cable's row
    box(0.86, 0.88, 0.12, 0.1, z1 - 0.08, "steelD")                             # its access plate
    box(0.88, 1.0, 0.09, 0.03, 0.15, "dark", "steelD")                          # conduit stub out to the edge
    box(0.66, 0.76, 0.05, z1, z1 + 0.04, "dark")                                # status lamp (idle: dark)


def bunker(f):
    top = TOPS["A"]
    _g("skirt")
    TB.prism(f, octagon(0.95), 0, 0.06, "gm", top="steelD")
    slope(f, octagon, 0.92, 0.8, 0.06, 0.42, "steelD", "steel", steps=3)
    TB.prism(f, octagon(0.82), 0.42, 0.48, "steel", top="steelL")
    slope(f, octagon, 0.76, 0.66, 0.48, top - 0.16, "steelD", "steel", steps=3)
    for k in range(4):                                                          # gun slits, dark, on the diagonals
        obox(f, OCT[2 * k + 1], 0.7, 0.75, 0.12, 0.62, 0.7, "dark")
    _g("roof")
    TB.prism(f, octagon(0.66), top - 0.16, top - 0.05, "steel", top="steelL")
    for k in range(8):                                                          # armour plate seams
        obox(f, OCT[k], 0.6, 0.67, 0.012, top - 0.15, top - 0.05, "steelD")
    race(f, top)
    port(f, 0.36)


def trestle(f):
    top = TOPS["B"]
    _g("pads")
    legs = [(0.72 * math.cos(math.pi / 4 + k * math.pi / 2) / 0.7071 * 0.7071, 0.72 * math.sin(math.pi / 4 + k * math.pi / 2) / 0.7071 * 0.7071) for k in range(4)]
    for u, v in legs:
        f.box(u, v, 0, 0.14, 0.14, 0.08, "gm", top="steelD")
    _g("legs")
    from . import detail as D
    for u, v in legs:
        D.seg(f, (u, v, 0.08), (u * 0.55, v * 0.55, top - 0.14), 0.06, "steelD", 8)
    for k in range(4):                                                          # cross bracing between legs
        (u0, v0), (u1, v1) = legs[k], legs[(k + 1) % 4]
        D.seg(f, (u0 * 0.85, v0 * 0.85, 0.22), (u1 * 0.7, v1 * 0.7, top - 0.32), 0.03, "steel", 6)
        D.seg(f, (u1 * 0.85, v1 * 0.85, 0.22), (u0 * 0.7, v0 * 0.7, top - 0.32), 0.03, "steel", 6)
    _g("deck")
    TB.prism(f, octagon(0.62), top - 0.16, top - 0.05, "steelD", top="steel")
    TB.prism(f, octagon(0.66), top - 0.05, top, "steel", top="steelL")
    race(f, top + 0.02)
    _g("riser")
    D.seg(f, (0.72, PORT_V, 0.4), (0.4, PORT_V * 0.6, top - 0.16), 0.045, "dark", 8)
    port(f, 0.4)


def plinth(f):
    top = TOPS["C"]
    _g("plinth")
    TB.prism(f, square(0.98, 0.2), 0, 0.06, "gm", top="steelD")
    slope(f, lambda r: square(r, 0.22), 0.94, 0.86, 0.06, top - 0.08, "steelD", "steel", steps=2)
    TB.prism(f, square(0.86, 0.22), top - 0.08, top, "steel", top="steelL")
    _g("hazard")
    n = 12
    for side in range(4):                                                       # hazard edging round the top
        for k in range(n):
            c = "hazY" if k % 2 == 0 else "hazK"
            a0, a1 = -0.62 + 1.24 * k / n, -0.62 + 1.24 * (k + 1) / n
            pts = [(0.74, a0), (0.84, a0), (0.84, a1), (0.74, a1)]
            ca, sa = math.cos(side * math.pi / 2), math.sin(side * math.pi / 2)
            TB.prism(f, [(ca * u - sa * v, sa * u + ca * v) for u, v in pts], top, top + 0.012, c, top=c)
    _g("bollards")
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        u, v = 0.68 * math.cos(a) / math.cos(math.pi / 4) * 0.82, 0.68 * math.sin(a) / math.cos(math.pi / 4) * 0.82
        f.vcyl(u, v, top, 0.07, 0.14, "steelD", top="dark", sides=10)
    race(f, top + 0.02)
    port(f, 0.4)


VARIANTS = {"A": bunker, "B": trestle, "C": plinth}


def mount(rot=0, variant="A"):
    m = core.Mesh(f"ground_mount_{variant}")
    VARIANTS[variant](Frame(m, (1 + rot) % 4, square=True))
    return [m.build()] if cmbkit.REC is None else []
