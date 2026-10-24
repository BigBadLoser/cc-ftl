"""Point defence bay (2x2): a helical feed, everything on the column's axis, in the burst laser bay's lift.

  lift      as the laser bay (turret_bay_laser.lift): bolted flange, rams either side, ram collar, hazard ring
  magazine  a hollow drum at the column's foot, open at the top, a gear band round its rim (clear of the rams) driven by
            a motor and toothed pinion on the left-front diagonal
  helix     the belt of brass rounds on a spiral shelf, joined by a link band, rising out of the drum round the core
            (two and a half turns), between the light-grey sleeve rings
  chute     at the top of the helix a walled chute rises into the feed inlet on the breech; the inlet is hollow, its
            outer face a framed window showing the belt climbing in and turning into the cylinder
  breech    a squat housing on the column, a neck up to the roof collar

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
import math

from mathutils import Vector

from . import cmbkit, core, detail as D
from . import turret_bay_laser as L
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, TOP = L.P, L.obox, L.FRONT, L.TOP
RAMS = (FRONT + math.pi / 2, FRONT - math.pi / 2)
BELT_R = 0.245                       # the helix radius (round centres)


def tan_dir(a):
    """The horizontal direction across the radial line a."""
    return Vector((-math.sin(a), math.cos(a), 0))


def near_ram(a, width):
    return min(abs((a - b + math.pi) % math.tau - math.pi) for b in RAMS) < width


def round_(f, p, d, back=0.06, fwd=0.06, r=0.022):
    """One round lying along d at p: brass, the tip pale, the base dark."""
    D.seg(f, tuple(p - d * back), tuple(p + d * fwd), r, "brass", 8, cap="plate", capstart="steelD")


def magazine(f):
    _g("magazine")
    f.vcyl(0, 0, 0.24, 0.3, 0.06, "gm", top="steelD", sides=32)                          # the drum's floor; it is
    TC.vannulus(f, 0.3, 0.275, 0.3, 0.56, "gm", "steel")                                 # hollow, open at the top
    TC.vannulus(f, 0.31, 0.29, 0.3, 0.34, "steel", "steelL")
    TC.vannulus(f, 0.315, 0.29, 0.44, 0.56, "steelD", "steelD")                         # gear band
    for k in range(24):
        b = (k + 0.5) * math.tau / 24
        if not near_ram(b, 0.3):
            obox(f, b, 0.29, 0.35, 0.02, 0.44, 0.56, "steelL", "plate")                 # its teeth
    _g("drive")
    u, v = P(FRONT + 0.8, 0.46)
    f.vcyl(u, v, 0.0, 0.12, 0.08, "gm", top="steel", sides=16)                           # motor foot
    f.vcyl(u, v, 0.08, 0.1, 0.28, "steelD", top="steel", sides=16)                       # motor
    for z in (0.14, 0.28):
        f.vcyl(u, v, z, 0.105, 0.03, "steel", sides=16)
    f.vcyl(u, v, 0.36, 0.045, 0.08, "steelL", sides=10)                                  # coupling
    f.vcyl(u, v, 0.44, 0.07, 0.12, "gm", top="steelL", sides=14)                         # pinion
    for k in range(10):
        b = k * math.tau / 10
        f.box(u + 0.075 * math.cos(b), v + 0.075 * math.sin(b), 0.44, 0.035, 0.035, 0.12, "steelL", top="plate")


def helix(f, z0=0.46, z1=1.16, turns=2.5, n=112):
    """The belt on its spiral shelf, from down in the drum (half a turn behind its rim) up round the core; returns the
    angle it ends at."""
    a0 = FRONT - 0.6 - math.pi
    ths = [a0 + math.tau * turns * k / n for k in range(n + 1)]
    zs = [z0 + (z1 - z0) * k / n for k in range(n + 1)]
    _g("ramp")
    for k in range(n):
        obox(f, (ths[k] + ths[k + 1]) / 2, 0.16, 0.31, 0.05, zs[k] - 0.04, zs[k] - 0.02, "steel", "steelL")
    _g("belt")
    for k in range(0, n + 1, 2):
        rdir = Vector((math.cos(ths[k]), math.sin(ths[k]), 0))
        round_(f, Vector((*P(ths[k], BELT_R), zs[k])), rdir, 0.06, 0.05, 0.021)
    for k in range(n):                                                                    # the link band
        p0 = Vector((*P(ths[k], BELT_R - 0.02), zs[k] - 0.012))
        p1 = Vector((*P(ths[k + 1], BELT_R - 0.02), zs[k + 1] - 0.012))
        D.seg(f, tuple(p0), tuple(p1), 0.012, "steelD", 6)
    _g("sleeve")
    for z in (0.52, 1.24):
        TC.vannulus(f, 0.33, 0.28, z, z + 0.06, "steel", "steelL")
    return ths[-1]


def chute(f, a, z0=1.14, z1=1.36):
    _g("chute")
    obox(f, a, 0.16, 0.34, 0.08, z0, z1, "gm", "steelL")
    for o in (-0.085, 0.085):
        obox(f, a, 0.16, 0.36, 0.015, z0, z1, "steel", "steelL", off=o)
    for z in (z0 + 0.07, z0 + 0.13):
        round_(f, Vector((*P(a, 0.3), z)), tan_dir(a), 0.05, 0.05, 0.021)


def breech(f, z0=1.34, z1=1.52):
    _g("breech")
    f.vcyl(0, 0, z0, 0.3, z1 - z0, "gm", top="steelL", sides=28)
    f.vcyl(0, 0, z0 + 0.04, 0.31, 0.04, "steel", sides=28)
    f.vcyl(0, 0, z1, 0.14, TOP - 0.12 - z1, "steelD", sides=18)                          # neck to the roof collar
    f.vcyl(0, 0, z1 + 0.1, 0.16, 0.05, "steel", top="steelL", sides=18)


def inlet(f, a, z0=1.36, z1=TOP - 0.445):
    """The feed inlet on the breech, up to the ram collar: hollow, the outer face a framed window, the belt climbing
    inside and turning into the cylinder."""
    _g("inlet")
    obox(f, a, 0.24, 0.42, 0.11, z0, z0 + 0.03, "gm", "steelL")                          # bottom
    obox(f, a, 0.24, 0.42, 0.11, z1 - 0.03, z1, "gm", "steelL")                          # top
    for o in (-0.1, 0.1):
        obox(f, a, 0.24, 0.42, 0.012, z0, z1, "gm", "steelL", off=o)                      # sides
    obox(f, a, 0.24, 0.27, 0.11, z0, z1, "steelD")                                        # back, at the cylinder
    obox(f, a, 0.41, 0.44, 0.125, z0 - 0.02, z0 + 0.03, "steel", "steelL")               # the window frame
    obox(f, a, 0.41, 0.44, 0.125, z1 - 0.03, z1 + 0.02, "steel", "steelL")
    for o in (-0.11, 0.11):
        obox(f, a, 0.41, 0.44, 0.015, z0, z1, "steel", "steelL", off=o)
    t = tan_dir(a)
    z = z0 + 0.06
    while z < z1 - 0.05:
        round_(f, Vector((*P(a, 0.35), z)), t)
        z += 0.05
    round_(f, Vector((*P(a, 0.3), z1 - 0.07)), t)


def bay_pd(rot=0):
    """Built the same way round for every rotation, as the laser bay (turret_bay_laser.bay_laser)."""
    m = core.Mesh("bay_pd")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    L.lift(f)
    _g("core")
    f.vcyl(0, 0, 0.24, 0.16, 1.1, "steelD", sides=24)
    magazine(f)
    end = helix(f)
    chute(f, end)
    breech(f)
    inlet(f, end)
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["pd"] = bay_pd
