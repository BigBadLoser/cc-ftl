"""The holo game table's parts (approved look study r1 + s4): a slim table on one round column with a recessed
projector in its top, two stools held off its foot by arms, and the duel's creatures (the pink serpent, the green
dragon). `gametable.py` builds the module from these.

Units: world (1 = a tile); z in world units too (a seat top at 0.39, the table top at 0.62, as the consoles' chair)."""
import math

from .arcade_kit import film, ring_of
from .research_kit import Bench, bar

FP2 = (2, 1)
TOP = 0.62                                                           # the table top's height
SEATS = ((-0.5, 1.0), (0.5, -1.0))                                   # the stools: front left, back right (local u, v)


def stadium(k, hu, hv, z, h, col, top=None, sides=16):
    """A rounded slab: a box with half-round ends, hu x hv half sizes, the ends' radius hv."""
    k.box(0.0, 0.0, z, 2 * (hu - hv), 2 * hv, h, col, top=top)
    for s in (-1, 1):
        k.cyl(s * (hu - hv), 0.0, z, hv, h, col, top=top, sides=sides)


def stool(k, u, v, face, glow="arcCyan"):
    """A stool: a disc foot, a post, a padded seat with a chrome rim, a low back on the side away from the table;
    `face` = the way the sitter faces (-1: toward -v)."""
    k.cyl(u, v, 0.0, 0.14, 0.03, "arcBodyK", top="arcBodyK", sides=12)
    k.cyl(u, v, 0.03, 0.045, 0.26, "arcChrD", top="arcChr", sides=8)
    k.cyl(u, v, 0.29, 0.19, 0.04, "arcChrD", top="arcChr", sides=14)
    k.cyl(u, v, 0.33, 0.17, 0.06, "arcSeatD", top="arcSeat", sides=14)
    k.box(u, v - face * 0.16, 0.36, 0.3, 0.05, 0.2, "arcSeatD", top="arcSeat")              # the back (no light on it:
    # the cyan lit edge it had read as hologram light on the seat backs; the seat's red contrasts with crew trousers)


def stadium_ring(k, hu, hv, z, h, w, col, top, n=8):
    """A stadium-shaped rail w wide: straight sides and half-round ends of boxes."""
    for s in (-1, 1):
        k.box(0.0, s * (hv - w / 2), z, 2 * (hu - hv), w, h, col, top=top)
        for i in range(n):
            a = s * math.pi / 2 + (i + 0.5) * math.pi / n * (-s)
            a = -math.pi / 2 + (i + 0.5) * math.pi / n if s > 0 else math.pi / 2 + (i + 0.5) * math.pi / n
            r = hv - w / 2
            k.box(s * (hu - hv) + r * math.cos(a), r * math.sin(a), z, math.pi * r / n * 1.15, w, h, col, top=top,
                  rz=a + math.pi / 2)


def bar2(k, u, z, frac, col):
    """One health bar: the lit share, the rest in film."""
    W = 0.2
    k.box(u - W / 2 + W * frac / 2, 0.0, z, W * frac, 0.02, 0.03, col, top=col)
    k.box(u + W * frac / 2, 0.0, z, W * (1 - frac), 0.02, 0.03, "arcCyanF", top="arcCyanF")


def r_table(name, rot=0, off=False):
    """The table: a slim stadium top on one round column, a recessed projector in the top (a chrome collar with a lit
    rim round a dark well, the lens on a chrome housing held by struts), a lit pad at each place, the two stools on
    arms off the foot. `off`: unpowered, every light dark."""
    glow = "arcCyanOff" if off else "arcCyan"
    k = Bench(name, FP2, rot)
    k.cyl(0.0, 0.0, 0.0, 0.3, 0.04, "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, 0.04, 0.16, TOP - 0.14, "arcBodyD", top="arcBody", sides=16)
    k.cyl(0.0, 0.0, 0.3, 0.17, 0.03, "arcChrD", top="arcChr", sides=16)
    stadium(k, 0.96, 0.4, TOP - 0.1, 0.06, "arcChrD", top="arcChr")
    stadium(k, 0.93, 0.37, TOP - 0.04, 0.04, "arcBodyD", top="arcGlass")
    r, n = 0.22, 20
    k.cyl(0.0, 0.0, TOP, 0.2, 0.004, "arcBodyK", top="arcBodyK", sides=16)           # the well's floor,
    for i in range(n):                                                               # the collar,
        a = i * math.tau / n
        k.box(r * math.cos(a), r * math.sin(a), TOP, math.tau * r / n * 1.12, 0.05, 0.045, "arcChrD",
              top="arcChr", rz=a + math.pi / 2)
    ring_of(k, r, TOP + 0.045, n, 0.075, glow, h=0.008)                         # its lit rim,
    for a in (0.5, 2.6, 4.7):                                                        # the struts,
        k.box(0.12 * math.cos(a), 0.12 * math.sin(a), TOP + 0.004, 0.12, 0.018, 0.012, "arcChrD",
              top="arcChr", rz=a)
    k.cyl(0.0, 0.0, TOP + 0.004, 0.07, 0.025, "arcChrD", top="arcChr", sides=12)       # the housing,
    k.cyl(0.0, 0.0, TOP + 0.029, 0.045, 0.004, glow, top=glow, sides=12)    # the lens
    for sgn in (-1, 1):                                                                  # a lit pad at each place
        k.box(sgn * 0.72, 0.0, TOP, 0.22, 0.46, 0.004, "arcCyanF", top="arcCyanF")
    for u, v in SEATS:
        bar(k, (0.0, 0.0, 0.03), (u, v, 0.03), 0.06, "arcChrD")
        stool(k, u, v, -1 if v > 0 else 1, glow)
    return k.build()


ZA, AU, AV = TOP + 0.4, 0.78, 0.3                                   # the arena's height and half sizes


def rim_points(n, inset=0.0):
    """n points round the arena's stadium edge."""
    pts = []
    for i in range(n):
        a = i * math.tau / n + 0.2
        x, y = math.cos(a), math.sin(a)
        u = (AU - AV) * (1 if x > 0 else -1) * min(1.0, abs(x) * 3) + AV * x
        pts.append((u * (1 - inset), AV * y * (1 - inset), ZA))
    return pts


def bx(k, u, v, z, su, sv, sz, col, **kw):
    k.box(u, v, z, su, sv, sz, col, top=col, **kw)


def dragon(k, u, z, col, f, flap=0.0, rear=0.0):
    """A dragon: hind legs, a body, a long neck up to a horned head, two wings raised, a tail. `flap` moves the wing tips
    out and down, `rear` lifts the neck and head."""
    for dv in (-0.05, 0.05):
        bx(k, u - f * 0.04, dv, z, 0.05, 0.04, 0.08, col)
    bx(k, u, 0.0, z + 0.08, 0.18, 0.12, 0.09, col)
    bx(k, u + f * 0.1, 0.0, z + 0.14, 0.04, 0.05, 0.12 + rear, col, ry=f * 0.35)         # the neck,
    bx(k, u + f * 0.15, 0.0, z + 0.25 + rear, 0.1, 0.07, 0.05, col)                      # the head,
    bx(k, u + f * 0.12, 0.0, z + 0.3 + rear, 0.015, 0.05, 0.04, "arcMarq", ry=-f * 0.4)  # its horns,
    for sv in (-1, 1):                                                                    # the wings: lit sails
        film(k, [(u + f * 0.03, sv * 0.05, z + 0.16), (u - f * 0.1, sv * (0.1 + flap), z + 0.44 - flap),
                 (u - f * 0.16, sv * 0.08, z + 0.18)], col)                               # (flap: tips out, down)
    bx(k, u - f * 0.15, 0.0, z + 0.09, 0.14, 0.03, 0.03, col, ry=-f * 0.3)              # the tail


def serpent(k, u, z, col, f, sway=0.0):
    """A serpent: a coil on the ground, its body rising in an S to a hooded head with cream eyes."""
    for i in range(6):                                                                    # the coil
        a = i * math.tau / 6
        bx(k, u + 0.07 * math.cos(a), 0.07 * math.sin(a), z, 0.06, 0.06, 0.05, col)
    for i, (du, dz, sz) in enumerate(((0.02, 0.05, 0.06), (0.05, 0.11, 0.055), (0.04, 0.17, 0.05),
                                      (0.07, 0.22, 0.045))):
        bx(k, u + f * (du + sway * i / 3), 0.0, z + dz, sz, sz, sz, col)                  # the rising body,
    hu = u + f * sway                                                                     # (sway: the head and neck
    bx(k, hu + f * 0.1, 0.0, z + 0.26, 0.06, 0.14, 0.07, col)                             # forward or back) the hood,
    bx(k, hu + f * 0.13, 0.0, z + 0.27, 0.07, 0.06, 0.045, col)                           # the head,
    for dv in (-0.018, 0.018):
        bx(k, hu + f * 0.166, dv, z + 0.29, 0.004, 0.012, 0.012, "arcMarq")              # the eyes
