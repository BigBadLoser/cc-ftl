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


# Round 4: supports that grow into the head. The head (TC turntable, R * rig scale = about 0.9) sits on a collar of its own
# width, no roof ring. (deck top, builder)
COLLAR = 0.52                                                   # round 5: the head's drum (0.36 * rig scale 1.45), no turntable
HEAD_DROP = 0.29 * 1.45                                         # the drum's foot above the rig origin (turret_concepts._drum z0)


def collar(f, top, ribs=12):
    """Round 5: no ring. The support's top is a plain cap the drum stands on."""
    _g("cap")
    f.vcyl(0, 0, top - 0.05, COLLAR + 0.02, 0.05, "steel", top="steelD", sides=28)


def pintle(f, top=0.9):
    """G1: the ship bay's mount column cut short, on a gusseted baseplate, flaring into the collar."""
    _g("base")
    TB.prism(f, square(0.96, 0.28), 0, 0.08, "gm", top="steelD")
    f.vcyl(0, 0, 0.08, 0.5, 0.08, "steelD", top="steel", sides=28)
    _g("column")
    f.vcyl(0, 0, 0.16, 0.3, top - 0.5, "steelD", sides=28)
    for z in (0.26, 0.4):
        f.vcyl(0, 0, z, 0.33, 0.05, "steel", top="steelL", sides=28)
    for k in range(4):                                                          # gussets
        a = math.pi / 4 + k * math.pi / 2
        obox(f, a, 0.3, 0.72, 0.03, 0.08, 0.2, "steel", top="steelL")
        obox(f, a, 0.3, 0.5, 0.03, 0.2, 0.36, "steel", top="steelL")
    _g("flare")
    for k, (r, z) in enumerate(((0.36, top - 0.3), (0.44, top - 0.22), (0.5, top - 0.14))):
        f.vcyl(0, 0, z, r, 0.07, "steelD", top="steel", sides=28)
    collar(f, top)
    port(f, 0.36)


def casemate(f, top=0.62):
    """G2: the head's ribbed skirt carried down to the rock as a squat armoured drum on a wider footing."""
    _g("footing")
    TB.prism(f, octagon(0.98), 0, 0.06, "gm", top="steelD")
    f.vcyl(0, 0, 0.06, 0.97, 0.08, "steelD", top="steel", sides=28)
    _g("drum")
    f.vcyl(0, 0, 0.14, 0.86, 0.12, "dark", top="steelD", rtop=0.7, sides=28)       # a sloped shoulder up to the drum
    f.vcyl(0, 0, 0.26, COLLAR - 0.02, top - 0.4, "dark", top="steelD", sides=28)
    for k in range(12):                                                         # the skirt's ribs, full height
        a = (k + 0.5) * math.tau / 12
        obox(f, a, COLLAR - 0.04, COLLAR + 0.02, 0.04, 0.26, top - 0.06, "steelD", top="steel")
    f.vcyl(0, 0, top - 0.24, COLLAR + 0.005, 0.04, "steel", sides=28)          # a band round it
    collar(f, top)
    port(f, 0.4)


def tripod(f, top=0.95):
    """G3: three heavy legs, knees out, meeting the collar under its rim."""
    from . import detail as D
    _g("legs")
    for k in range(3):
        a = math.pi / 2 + k * math.tau / 3 + math.pi
        c, s_ = math.cos(a), math.sin(a)
        foot, knee, hip = (0.96 * c, 0.96 * s_, 0.06), (0.86 * c, 0.86 * s_, 0.42), (0.42 * c, 0.42 * s_, top - 0.1)
        f.box(foot[0], foot[1], 0, 0.2, 0.2, 0.07, "gm", top="steelD")
        D.seg(f, foot, knee, 0.09, "steelD", 10)
        f.vcyl(knee[0], knee[1], knee[2] - 0.08, 0.12, 0.16, "steel", top="steelL", sides=14)   # knee joint
        D.seg(f, knee, hip, 0.085, "steelD", 10)
        D.seg(f, (0.95 * c, 0.95 * s_, 0.2), (0.2 * c, 0.2 * s_, top - 0.3), 0.04, "steel", 8)   # hydraulic strut
    _g("hub")
    f.vcyl(0, 0, top - 0.42, 0.44, 0.38, "steelD", top="steel", sides=20)
    collar(f, top)
    port(f, 0.36)


# Round 8: a 3x3 footprint (u, v in -1.5..1.5). The head with its ring stands in the middle; the cable comes in on the
# centre row (v = 0) from the +u side.
def port3(f, z=0.0, u0=1.18):
    _g("port")
    box = lambda a, b, w, z0, z1, mat, top=None: TB.prism(f, [(a, -w), (b, -w), (b, w), (a, w)], z0, z1, mat, top=top or mat)  # noqa: E731
    box(u0, u0 + 0.26, 0.22, z, z + 0.46, "steel", "steelL")                   # junction box
    box(u0 - 0.02, u0, 0.14, z + 0.1, z + 0.36, "steelD")                      # access plate toward the ring
    box(u0 + 0.26, 1.5, 0.09, 0.0, z + 0.14, "dark", "steelD")                 # conduit to the edge
    box(u0 + 0.06, u0 + 0.16, 0.05, z + 0.46, z + 0.5, "dark")                 # status lamp (idle: dark)


# Round 9: outriggers. A round base under the ring, the turret raised on a riser, outrigger beams out past the base so
# their feet stand on the rock.
def riser(f, top, ribs=0):
    _g("base")
    f.vcyl(0, 0, 0, 1.0, 0.06, "gm", top="steelD", sides=32)
    f.vcyl(0, 0, 0.06, 0.94, 0.08, "steelD", top="steel", sides=32)
    _g("riser")
    f.vcyl(0, 0, 0.14, 0.8, top - 0.14, "steelD", top="steel", sides=28)
    f.vcyl(0, 0, top - 0.1, 0.84, 0.06, "steel", top="steelL", sides=28)
    for k in range(ribs):
        a = (k + 0.5) * math.tau / ribs
        obox(f, a, 0.78, 0.86, 0.04, 0.14, top - 0.1, "steel", top="steelL")


def outrigger(f, a, top, heavy=False, strut=0):
    """One outrigger at angle a: a beam from the riser out and down to a jack and foot pad on the rock."""
    from . import detail as D
    c, s_ = math.cos(a), math.sin(a)
    out = min(1.78, 1.32 / max(abs(c), abs(s_)))                                        # toward the corner, inside the 3x3
    hip = (0.8 * c, 0.8 * s_, top - 0.16)                                                # high on the riser: the arm slants up
    jack = (out * c, out * s_)
    _g("outrigger")
    if heavy:
        D.seg(f, hip, (jack[0], jack[1], 0.36), 0.11, "steelD", 4)
        f.vcyl(jack[0], jack[1], 0.04, 0.11, 0.38, "steel", top="steelL", sides=12)        # screw jack
        for z in (0.12, 0.2, 0.28):
            f.vcyl(jack[0], jack[1], z, 0.125, 0.025, "steelD", sides=12)
        f.vcyl(jack[0], jack[1], 0, 0.22, 0.05, "gm", top="steelD", sides=14)               # foot
        if strut:                                                                           # cross struts under the arm
            n = (-s_, c)
            offs = (0.0,) if strut < 3 else (-0.07, 0.07)
            r = 0.04 if strut == 1 else 0.06 if strut == 2 else 0.035
            for o in offs:
                D.seg(f, (0.86 * c + n[0] * o, 0.86 * s_ + n[1] * o, 0.16), (jack[0] * 0.8 + n[0] * o, jack[1] * 0.8 + n[1] * o, 0.3), r, "steel", 6)
    else:
        D.seg(f, hip, (jack[0], jack[1], 0.24), 0.07, "steelD", 6)
        D.seg(f, (0.86 * c, 0.86 * s_, 0.16), (jack[0] * 0.8, jack[1] * 0.8, 0.3), 0.04, "steel", 6)   # strut
        f.vcyl(jack[0], jack[1], 0.04, 0.07, 0.24, "steel", top="steelL", sides=10)
        f.vcyl(jack[0], jack[1], 0, 0.16, 0.05, "gm", top="steelD", sides=12)


def out_strut(f, k):
    top = GV["S1"][0]
    riser(f, top)
    for j in range(4):
        outrigger(f, math.pi / 4 + j * math.pi / 2, top, heavy=True, strut=k)
    port3(f, 0.0, 1.06)


# Round 11: O2 (heavy jacks, riser 0.78) with O1's cross struts: as O1 (S1), heavier (S2), a pair per arm (S3).
GV = {"S1": (0.78, lambda f: out_strut(f, 1)), "S2": (0.78, lambda f: out_strut(f, 2)), "S3": (0.78, lambda f: out_strut(f, 3))}

def ground_turret(key, d, variant):
    """The head with its turntable ring (no roof coaming), standing on the variant's base."""
    return TC.place(TC.PICKS[key](False), d, z0=GV[variant][0], parts=("head", "gun"))


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


VARIANTS = {v: a[1] for v, a in GV.items()}


def mount(rot=0, variant="A"):
    m = core.Mesh(f"ground_mount_{variant}")
    VARIANTS[variant](Frame(m, (1 + rot) % 4, square=True))
    return [m.build()] if cmbkit.REC is None else []
