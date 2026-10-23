"""Burst laser bay (2x2): the column is the laser itself, standing in the turret lift.

  lift      a bolted mounting flange; two hydraulic rams either side, each end grown out of the flange and of the ram
            collar as a boss (the turret visibly rises on them); a hazard-striped keep-clear ring on the floor
  foot      a sleeve with end bands, four ribs and one bolted access panel, turned off the view axis
  chamber   the lasing chamber: glass between six frame ribs, two bands
  beam      a beam tube with lens rings up into the roof collar
  cooler    a finned radiator housing clamped to the chamber's front, copper coolant lines into the column above and below

Frame as turret_bays (cmbkit.Frame, u = grid +x, v = grid +y, origin = footprint centre at floor level). FRONT is the
column's face toward the camera; parts that should read are placed round it."""
import math

from . import cmbkit, core, detail as D
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
TOP = TC.ZR
FRONT = math.pi / 4                 # grid +x +y: the face toward the camera
R = 0.2                             # column radius
FLANGE = 0.46                       # mounting flange radius


def P(a, rr):
    """(u, v) at angle a, radius rr round the column."""
    return rr * math.cos(a), rr * math.sin(a)


def obox(f, a, r0, r1, w, z0, z1, mat, top=None, off=0.0):
    """A box along the radial direction a: radius r0..r1, half width w across (shifted off), z0..z1."""
    ca, sa = math.cos(a), math.sin(a)
    pts = [(ca * r - sa * (o + off), sa * r + ca * (o + off)) for r, o in ((r0, -w), (r1, -w), (r1, w), (r0, w))]
    TB.prism(f, pts, z0, z1, mat, top=top or mat)


def hazard_ring(f, r0, r1, n=24, z=0.014):
    """A flat ring on the floor in alternating hazard yellow / black sectors."""
    _g("hazard")
    for k in range(n):
        a0, a1 = k * math.tau / n, (k + 1) * math.tau / n
        c = "hazY" if k % 2 == 0 else "hazK"
        TB.prism(f, [P(a0, r0), P(a0, r1), P(a1, r1), P(a1, r0)], 0, z, c, top=c)


def lift(f):
    _g("lift")
    f.vcyl(0, 0, 0, FLANGE, 0.14, "gm", top="steel", sides=32)                       # mounting flange
    f.vcyl(0, 0, 0.14, FLANGE - 0.12, 0.1, "steelD", top="steel", sides=28)          # its neck up to the column
    for k in range(12):
        u, v = P((k + 0.5) * math.tau / 12, FLANGE - 0.06)
        f.vcyl(u, v, 0.14, 0.028, 0.035, "steelL", top="plate", sides=6)                 # bolts
    hazard_ring(f, R + 0.34, R + 0.42)
    zc = TOP - 0.42
    f.vcyl(0, 0, zc, R + 0.24, 0.09, "steel", top="steelL", sides=32)                  # ram collar
    f.vcyl(0, 0, zc - 0.025, R + 0.245, 0.025, "steelD", sides=32)                      # its edge band
    for k in range(12):
        u, v = P((k + 0.5) * math.tau / 12, R + 0.19)
        f.vcyl(u, v, zc + 0.09, 0.02, 0.022, "steelL", top="plate", sides=6)            # its bolts
    f.vcyl(0, 0, TOP - 0.12, R + 0.08, 0.12, "steelL", top="steel", sides=28)          # roof collar
    f.vcyl(0, 0, TOP, R - 0.02, 0.025, "steel", top="steelL", sides=28)
    for a in (FRONT + math.pi / 2, FRONT - math.pi / 2):                               # the rams, either side
        u, v = P(a, R + 0.16)
        obox(f, a, FLANGE - 0.2, FLANGE - 0.02, 0.07, 0.14, 0.24, "gm", "steel")         # the flange rises into a
        f.vcyl(u, v, 0.14, 0.085, 0.1, "gm", top="steel", sides=16)                     # boss for the cylinder
        D.seg(f, (u, v, 0.24), (u, v, 0.95), 0.055, "steelD", 12, cap="steel")          # cylinder
        D.seg(f, (u, v, 0.95), (u, v, zc - 0.12), 0.03, "steelL", 10, cap="steelL")      # piston rod
        obox(f, a, R + 0.12, R + 0.2, 0.07, zc - 0.06, zc + 0.09, "steel", "steelL")     # the collar swells out
        f.vcyl(u, v, zc - 0.06, 0.09, 0.15, "steel", top="steelL", sides=16)             # into a boss round the rod
        f.vcyl(u, v, zc - 0.12, 0.05, 0.06, "steelL", sides=12)                          # gland sleeve
        f.vcyl(u, v, zc + 0.09, 0.05, 0.03, "steelD", top="plate", sides=6)              # rod nut


def column(f):
    _g("foot")
    f.vcyl(0, 0, 0.24, 0.24, 0.44, "gm", top="steel", sides=28)
    for z in (0.26, 0.62):
        f.vcyl(0, 0, z, 0.255, 0.05, "steel", top="steelL", sides=28)                    # end bands
    ap = FRONT + 0.4                                                                     # turned off the view axis
    for k in range(4):
        obox(f, ap + math.pi / 4 + k * math.pi / 2, 0.22, 0.27, 0.02, 0.31, 0.62, "steel", "steelL")   # ribs
    obox(f, ap, 0.22, 0.25, 0.085, 0.36, 0.56, "steelD", "steel")                        # access panel
    for z in (0.38, 0.52):
        for t in (-0.055, 0.055):
            obox(f, ap, 0.25, 0.26, 0.014, z, z + 0.025, "steelL", "plate", off=t)           # its screws
    _g("chamber")
    z0, z1 = 0.74, 1.4
    f.vcyl(0, 0, z0 - 0.06, 0.25, 0.06, "steel", top="steelL", sides=28)
    f.vcyl(0, 0, z0, R, z1 - z0, "glassD", sides=24, top="steel")
    for k in range(6):
        u, v = P(k * math.tau / 6, R)
        f.box(u, v, z0, 0.06, 0.06, z1 - z0, "steel", top="steelL")                     # frame ribs
    for z in (z0 + 0.2, z0 + 0.42):
        TC.vannulus(f, 0.215, 0.19, z, z + 0.03, "steelD", "steel")
    f.vcyl(0, 0, z1, 0.25, 0.07, "steel", top="steelL", sides=28)
    _g("beam")
    f.vcyl(0, 0, z1 + 0.07, 0.11, TOP - 0.12 - z1 - 0.07, "steelD", sides=18)
    for z in (z1 + 0.12, z1 + 0.3):
        f.vcyl(0, 0, z, 0.14, 0.05, "steelL", top="lens", sides=18)                    # lens rings


def cooler(f, a=FRONT - 0.28, z0=0.78, z1=1.3):
    _g("cooler")
    obox(f, a, 0.17, 0.36, 0.11, z0, z1, "gm", "steelL")
    for k in range(7):
        z = z0 + 0.06 + k * (z1 - z0 - 0.12) / 6
        obox(f, a, 0.36, 0.41, 0.13, z, z + 0.025, "steelL", "plate")                    # fins
    for z in (z0 + 0.04, z1 - 0.08):
        obox(f, a, 0.18, 0.3, 0.14, z, z + 0.05, "steel", "steelL")                       # clamps
    u0, v0 = P(a, 0.3)
    u1, v1 = P(a, 0.16)
    for z, zc in ((z0 - 0.08, z0 + 0.1), (z1 + 0.1, z1 - 0.1)):
        D.seg(f, (u0, v0, zc), (u0, v0, z), 0.03, "rust", 8)
        D.seg(f, (u0, v0, z), (u1, v1, z), 0.03, "rust", 8, cap="steel")                  # coolant lines


def bay_laser(rot=0):
    """Every rotation is built the same way round: the bay is symmetric about its centre, and the cooler, the panel and
    the rams are placed for the camera, so a rotated frame would only turn them away from it."""
    m = core.Mesh("bay_laser")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    lift(f)
    column(f)
    cooler(f)
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["laser"] = bay_laser
