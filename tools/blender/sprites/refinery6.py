"""REFINERY, massing thumbnails (module.refinery, 3x4): each machine placed first, its own hull grown round it. Grey
only: the armour light, the machine dark. No detail. Crew side +u, the terminal housing at the access tile (middle).

  crucible  the pot in the middle wrapped by a stepped armour collar; a low feed block with the hoppers at -v; a chute
            from the pot's lip down to the terminal housing; a lower block at +v carrying the flue stack
  stacks    three stacks in a row, a long spine wrapping their bases with buttresses between them, a low crew annex in
            front with the terminal housing
  kiln      a drum lying along the length between two cheeks, running into a tall intake hood (+v, hopper on top) and a
            lower discharge hood (-v, exhaust stack)"""
from . import refinery4 as R4
from .modkit import K
from .refkit import M
from .steelkit import tube

ARMR, ARMR_T, MACH, MACH_T, HOLE = "gm", "plate", "steelD", "steel", "dark"
SL = 0.3


def blk(k, rect, h, outer, corner=0.3, **kw):
    b = M(rect, h, set(outer), sl=SL, corner=corner, top=ARMR_T, cap=True, **kw)
    b.build(k)
    return b


def terminal(k):
    blk(k, (0.95, 1.42, -0.34, 0.34), 0.5, ())
    k.box(1.05, 0, 0.5, 0.36, 0.56, 0.3, ARMR, top=ARMR_T)                       # the screen box


def octo(k, u, v, z, r, h):
    """A stack: an octagonal column, its rim, a dark bore."""
    k.cyl(u, v, z, r, h, MACH, top=MACH, sides=8)
    k.cyl(u, v, z + h, r + 0.03, 0.06, MACH_T, top=MACH_T, sides=8)
    k.cyl(u, v, z + h + 0.061, r - 0.08, 0.005, HOLE, top=HOLE, sides=8)


def crucible(k):
    pu, pv, r = -0.2, 0.15, 0.56
    k.cyl(pu, pv, 0, r, 1.06, MACH, top=MACH, sides=24)                       # the pot
    k.cyl(pu, pv, 1.06, r + 0.04, 0.06, MACH_T, top=MACH_T, sides=24)
    k.cyl(pu, pv, 1.121, r - 0.12, 0.005, HOLE, top=HOLE, sides=24)
    blk(k, (pu - 0.9, pu + 0.9, pv - 0.9, pv + 0.9), 0.8, ("-u", "+u", "-v", "+v"), corner=0.5)   # the collar
    blk(k, (-1.3, 1.3, -1.85, -0.6), 0.55, ("-u", "+u", "-v"), corner=0.36)   # the feed block
    for u in (-0.6, 0.25):
        k.cyl(u, -1.2, 0.55, 0.22, 0.12, MACH, top=MACH_T, sides=8)
        k.cyl(u, -1.2, 0.671, 0.15, 0.005, HOLE, sides=8)
    blk(k, (-1.3, 0.95, 0.85, 1.85), 0.46, ("-u", "+u", "+v"), corner=0.36)   # the flue block
    octo(k, -0.65, 1.38, 0.46, 0.2, 0.74)
    blk(k, (0.5, 1.3, -0.55, 0.85), 0.42, ("+u",))                             # the crew flank
    terminal(k)
    tube(k, (pu + 0.45, pv - 0.05, 1.02), (1.0, 0.0, 0.62), 0.07, MACH_T, sides=8, cap=MACH)   # the chute


def stacks(k):
    blk(k, (-1.05, 0.35, -1.75, 1.75), 0.74, ("-u", "+u", "-v", "+v"), corner=0.4)   # the spine
    for v, h in ((-1.1, 0.42), (0.0, 0.56), (1.1, 0.42)):
        octo(k, -0.35, v, 0.74, 0.32, h)
    for v in (-0.55, 0.55):                                                   # buttresses between the stacks
        blk(k, (-1.35, -0.9, v - 0.14, v + 0.14), 0.6, ("-u",), corner=0.0)
        blk(k, (0.25, 0.62, v - 0.14, v + 0.14), 0.58, ("+u",), corner=0.0)
    blk(k, (0.55, 1.3, -1.25, -0.4), 0.42, ("+u", "-v"), corner=0.25)        # the crew annex either side
    blk(k, (0.55, 1.3, 0.4, 1.25), 0.42, ("+u", "+v"), corner=0.25)
    k.cyl(0.95, -0.85, 0.42, 0.22, 0.12, MACH, top=MACH_T, sides=8)          # the feed hopper
    k.cyl(0.95, -0.85, 0.541, 0.15, 0.005, HOLE, sides=8)
    terminal(k)


def kiln(k):
    du, z, r = -0.15, 0.55, 0.45
    tube(k, (du, -1.25, z), (du, 1.3, z), r, MACH, sides=24, cap=HOLE)       # the drum
    for v in (-0.6, 0.6):
        tube(k, (du, v - 0.08, z), (du, v + 0.08, z), r + 0.06, MACH_T, sides=24, cap=MACH_T)
    blk(k, (-1.3, du - r - 0.02, -1.25, 1.05), 0.62, ("-u",), corner=0.0)     # the cheeks
    blk(k, (du + r + 0.02, 1.3, -1.25, 1.05), 0.52, ("+u",), corner=0.0)
    blk(k, (-1.3, 1.3, 1.0, 1.85), 1.04, ("-u", "+u", "+v"), corner=0.4)      # the intake hood
    k.cyl(du, 1.42, 1.04, 0.24, 0.12, MACH, top=MACH_T, sides=8)
    k.cyl(du, 1.42, 1.161, 0.17, 0.005, HOLE, sides=8)
    blk(k, (-1.3, 1.3, -1.85, -1.2), 0.86, ("-u", "+u", "-v"), corner=0.36)  # the discharge hood
    octo(k, -0.7, -1.5, 0.86, 0.19, 0.42)
    terminal(k)


MACHINES = {"crucible": crucible, "stacks": stacks, "kiln": kiln}


def refinery(machine, rot=0):
    k = K(f"refinery6_{machine}_{rot}", (3, 4), rot)
    keep = R4.BODY, R4.ARM, R4.ARM_L
    R4.BODY, R4.ARM, R4.ARM_L = ARMR, ARMR, ARMR_T
    try:
        MACHINES[machine](k)
    finally:
        R4.BODY, R4.ARM, R4.ARM_L = keep
    return k.build()
