"""Ion cannon bay (2x2): a copper coil column fed from a freestanding insulator tower, in the burst laser bay's lift.

  lift       as the laser bay (turret_bay_laser.lift): bolted flange, rams either side, ram collar, hazard ring
  foot       a transformer drum with radial fins, spaced for the leads and clear of the rams
  coils      two copper coils (windings as stripes) between bolted structural collars, the middle one gusseted
  leads      two copper leads down the front between the fins, clamped at each coil and at the top collar, ending in
             terminal blocks bolted to the flange
  tower      a freestanding insulator tower on the right-front diagonal (ceramic bell skirts, a terminal head); a copper
             bus bar runs level from its head into a terminal block at the foot of the neck, an armoured floor duct from
             its plinth into the foot
  neck       up to the roof collar

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
import math

from . import cmbkit, core, detail as D
from . import turret_bay_laser as L
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, TOP = L.P, L.obox, L.FRONT, L.TOP
RAMS = (FRONT + math.pi / 2, FRONT - math.pi / 2)
LEADS = (FRONT - 0.3, FRONT + 0.3)
TOWER = (FRONT - 0.8, 0.82)          # its angle and radius


def coil(f, z, r=0.26, n=10):
    """One copper coil, its windings as alternating bands; returns its top."""
    _g("coil")
    for j in range(n):
        f.vcyl(0, 0, z + j * 0.025, r, 0.025, "rust" if j % 2 == 0 else "rustD", sides=32)
    return z + n * 0.025


def collar(f, z, h=0.08, ribs=False):
    """A bolted structural collar round the core (ribs: gussets under it); returns its top."""
    _g("collar")
    f.vcyl(0, 0, z, 0.3, h, "steel", top="steelL", sides=32)
    f.vcyl(0, 0, z + h * 0.3, 0.305, h * 0.25, "steelD", sides=32)
    for k in range(12):
        u, v = P((k + 0.5) * math.tau / 12, 0.27)
        f.vcyl(u, v, z + h, 0.018, 0.02, "steelL", top="plate", sides=6)
    if ribs:
        for k in range(8):
            obox(f, (k + 0.5) * math.tau / 8, 0.24, 0.3, 0.012, z - 0.06, z, "steel", "steelL")
    return z + h


def foot(f):
    _g("transformer")
    f.vcyl(0, 0, 0.24, 0.29, 0.22, "gm", top="steel", sides=32)
    for k in range(12):
        a = FRONT + (k + 0.5) * math.tau / 12
        if min(abs((a - b + math.pi) % math.tau - math.pi) for b in RAMS + LEADS) >= 0.2:
            obox(f, a, 0.28, 0.34, 0.012, 0.27, 0.44, "steelL", "plate")                 # fins


def column(f):
    """The core, the coils between collars, the leads; returns the top collar's top."""
    _g("core")
    f.vcyl(0, 0, 0.46, 0.16, 1.1, "steelD", sides=24)
    z1 = collar(f, 0.46)
    z = coil(f, z1)
    z = collar(f, z, h=0.1, ribs=True)
    zc = z + 0.125                                                                         # the upper coil's middle
    ztop = collar(f, coil(f, z))
    _g("leads")
    for a in LEADS:
        u, v = P(a, 0.315)
        D.seg(f, (u, v, 0.235), (u, v, ztop - 0.04), 0.024, "rust", 8)
        obox(f, a, 0.275, 0.395, 0.051, 0.14, 0.245, "gm", "steelL")                      # terminal block bolted
        for rb in (0.3, 0.37):                                                            # to the flange
            f.vcyl(*P(a, rb), 0.245, 0.018, 0.022, "steelL", top="plate", sides=6)
        obox(f, a, 0.28, 0.35, 0.04, ztop - 0.1, ztop - 0.02, "steelD", "steel")          # clamp into the top collar
        obox(f, a, 0.29, 0.34, 0.035, z1 + 0.12, z1 + 0.16, "steelD", "steel")           # and a clamp per coil
        obox(f, a, 0.29, 0.34, 0.035, zc - 0.02, zc + 0.02, "steelD", "steel")
    _g("neck")
    f.vcyl(0, 0, ztop, 0.14, TOP - 0.12 - ztop, "steelD", sides=18)
    f.vcyl(0, 0, ztop + 0.08, 0.17, 0.05, "steel", top="steelL", sides=18)
    return ztop


def tower(f, ztop):
    """The insulator tower, its head level with the foot of the neck; the bus bar and the floor duct."""
    ta, tr = TOWER
    tu, tv = P(ta, tr)
    _g("tower")
    f.vcyl(tu, tv, 0, 0.16, 0.12, "gm", top="steel", sides=20)                              # plinth
    for k in range(9):
        f.vcyl(tu, tv, 0.2 + k * 0.12, 0.13, 0.06, "plate", top="glassL", rtop=0.07, sides=20)   # bell skirts
    zh = ztop + 0.01
    f.vcyl(tu, tv, 0.12, 0.05, zh - 0.12, "steelD", sides=12)                              # its core
    f.vcyl(tu, tv, zh, 0.09, 0.1, "steelL", top="plate", sides=16)                         # terminal head
    _g("busbar")
    zb = zh + 0.05
    ab = math.atan2(tv, tu)
    e = P(ab, 0.22)
    D.seg(f, (tu, tv, zb), (*e, zb), 0.035, "rust", 8, cap="rust", capstart="rust")       # level, into the neck
    obox(f, ab, 0.12, 0.24, 0.07, zb - 0.05, zb + 0.06, "gm", "steelL")                     # terminal block on it
    f.vcyl(tu, tv, zb - 0.05, 0.05, 0.1, "steel", top="steelL", sides=10)                  # lug on the head
    _g("duct")
    obox(f, ab, 0.3, tr - 0.12, 0.05, 0.0, 0.1, "gm", "steelL")
    for rk in (0.45, 0.62):
        obox(f, ab, rk, rk + 0.03, 0.065, 0.0, 0.12, "steel", "steelL")                    # its straps


def bay_ion(rot=0):
    """Built the same way round for every rotation, as the laser bay (turret_bay_laser.bay_laser)."""
    m = core.Mesh("bay_ion")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    L.lift(f)
    foot(f)
    tower(f, column(f))
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["ion"] = bay_ion
