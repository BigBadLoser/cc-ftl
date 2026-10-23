"""REFINERY, a wider spread of massing thumbnails (module.refinery, 3x4): six structural ideas, not one hull language.
Grey only: structure light, machine dark. Crew side +u, a terminal at the access tile (middle).

  tanks     two tall domed tanks on a low skid, a pipe arching between their tops and down to a pump block
  gantry    an ore hopper held up on a four-legged frame, its chute dropping into a low furnace box with a stack
  trommel   an open perforated drum on A-frame legs over two catch bins, a drive box at one end
  tower     one tall round furnace tower, two low wings at the ends, pipes curving down from its top into them
  train     three boxes in a row stepping up in height, ducts between them, a stack on the tallest
  pour      a crucible hung on trunnions between two pillars, tipping its lip toward a low mould at the end"""
from .modkit import K
from .steelkit import tube

ST, ST_T, MACH, MACH_T, HOLE = "gm", "plate", "steelD", "steel", "dark"


def box(k, u, v, z, su, sv, sz, dark=False, bev=0.03):
    k.box(u, v, z, su, sv, sz, MACH if dark else ST, top=MACH_T if dark else ST_T, bevel=bev)


def terminal(k, u0=0.9):
    box(k, (u0 + 1.42) / 2, 0, 0, 1.42 - u0, 0.62, 0.5)
    box(k, u0 + 0.12, 0, 0.5, 0.26, 0.5, 0.26)


def stack(k, u, v, z, r, h):
    k.cyl(u, v, z, r, h, MACH, top=MACH, sides=8)
    k.cyl(u, v, z + h, r + 0.03, 0.06, MACH_T, top=MACH_T, sides=8)
    k.cyl(u, v, z + h + 0.061, r - 0.07, 0.005, HOLE, sides=8)


def tank(k, u, v, z, r, h):
    k.cyl(u, v, z, r, h, MACH, top=MACH, sides=20)
    k.cyl(u, v, z + h, r, 0.14, MACH, top=MACH, sides=20, rtop=r * 0.7)        # the dome
    k.cyl(u, v, z + h + 0.14, r * 0.7, 0.1, MACH, top=MACH_T, sides=20, rtop=r * 0.35)
    for zz in (z + 0.15, z + h - 0.2):
        k.cyl(u, v, zz, r + 0.03, 0.08, ST, top=ST_T, sides=20)               # armour bands


def tanks(k):
    box(k, 0, 0, 0, 2.7, 3.7, 0.16)                                            # the skid
    for v in (-0.85, 0.85):
        tank(k, -0.35, v, 0.16, 0.6, 0.95)
    tube(k, (-0.35, -0.85, 1.4), (-0.35, 0.85, 1.4), 0.09, MACH_T, sides=10)   # the arch
    tube(k, (-0.35, 0.0, 1.4), (0.55, 0.0, 1.4), 0.09, MACH_T, sides=10)
    tube(k, (0.55, 0.0, 1.4), (0.55, 0.0, 0.6), 0.09, MACH_T, sides=10)
    box(k, 0.6, 0, 0.16, 0.5, 0.7, 0.5, dark=True)                            # the pump
    terminal(k)


def gantry(k):
    box(k, -0.3, 0.75, 0, 2.2, 2.3, 0.55)                                      # the furnace box
    stack(k, -0.75, 1.35, 0.55, 0.22, 0.65)
    for u in (-0.95, 0.35):                                                    # the frame's legs
        for v in (-1.75, -0.45):
            box(k, u, v, 0, 0.12, 0.12, 0.85, bev=0.01)
    box(k, -0.3, -1.1, 0.78, 1.5, 1.5, 0.08)
    k.cyl(-0.3, -1.1, 0.86, 0.62, 0.42, MACH, top=MACH_T, sides=4, rtop=0.66)  # the hopper
    k.cyl(-0.3, -1.1, 1.281, 0.5, 0.005, HOLE, sides=4)
    tube(k, (-0.3, -0.75, 0.82), (-0.3, -0.2, 0.5), 0.1, MACH_T, sides=8)     # its chute
    terminal(k)


def trommel(k):
    for v in (-1.3, 1.1):                                                      # A-frame legs
        for du in (-0.45, 0.45):
            tube(k, (-0.2 + du, v, 0), (-0.2, v, 0.8), 0.06, ST_T, sides=6)
    tube(k, (-0.2, -1.65, 0.85), (-0.2, 1.45, 0.75), 0.5, MACH, sides=20, cap=HOLE)   # the drum
    for v in (-0.9, 0.0, 0.9):
        tube(k, (-0.2, v - 0.06, 0.82 - v * 0.03), (-0.2, v + 0.06, 0.82 - v * 0.03), 0.55, ST, sides=20, cap=ST_T)
    for v in (-0.55, 0.55):                                                    # the catch bins under it
        box(k, -0.2, v, 0, 1.1, 0.9, 0.28)
        k.box(-0.2, v, 0.281, 0.9, 0.7, 0.005, HOLE)
    box(k, -0.2, 1.7, 0, 1.2, 0.5, 0.95, dark=True)                            # the drive
    terminal(k)


def tower(k):
    k.cyl(-0.3, 0, 0, 0.62, 1.5, MACH, top=MACH, sides=20)                    # the tower
    for z in (0.3, 0.8, 1.3):
        k.cyl(-0.3, 0, z, 0.65, 0.08, ST, top=ST_T, sides=20)
    k.cyl(-0.3, 0, 1.5, 0.45, 0.12, MACH_T, top=HOLE, sides=20)
    for s in (1, -1):
        box(k, -0.2, s * 1.4, 0, 2.2, 1.05, 0.45)                              # the wings
        tube(k, (-0.3, s * 0.4, 1.4), (-0.3, s * 1.05, 1.4), 0.08, MACH_T, sides=8)
        tube(k, (-0.3, s * 1.05, 1.4), (-0.3, s * 1.3, 0.45), 0.08, MACH_T, sides=8)
    terminal(k)


def train(k):
    for v, h in ((-1.35, 0.45), (0.0, 0.72), (1.35, 1.0)):
        box(k, -0.25, v, 0, 1.9, 1.05, h, dark=(v == 0.0))
    for v in (-0.67, 0.67):                                                    # the ducts
        tube(k, (-0.25, v - 0.2, 0.32), (-0.25, v + 0.2, 0.32), 0.14, MACH_T, sides=8)
    stack(k, -0.6, 1.5, 1.0, 0.22, 0.5)
    terminal(k)


def pour(k):
    for v in (-0.8, 0.8):                                                      # the pillars
        box(k, -0.3, v, 0, 0.42, 0.34, 1.0)
    k.cyl(-0.3, 0, 0.35, 0.55, 0.7, MACH, top=MACH_T, sides=20)               # the crucible
    k.cyl(-0.3, 0, 1.051, 0.42, 0.005, HOLE, sides=20)
    tube(k, (-0.3, -0.63, 0.8), (-0.3, 0.63, 0.8), 0.09, MACH_T, sides=10)     # the trunnions
    box(k, -0.3, 0.42, 0.95, 0.24, 0.3, 0.1, dark=True)                        # its lip toward the mould
    box(k, -0.3, 1.5, 0, 1.6, 0.8, 0.32)                                       # the mould
    k.box(-0.3, 1.5, 0.321, 1.3, 0.55, 0.005, HOLE)
    box(k, -0.3, -1.55, 0, 2.0, 0.7, 0.55)                                     # the furnace feeding it
    stack(k, -0.75, -1.6, 0.55, 0.2, 0.6)
    terminal(k)


MACHINES = {"tanks": tanks, "gantry": gantry, "trommel": trommel, "tower": tower, "train": train, "pour": pour}


def refinery(machine, rot=0):
    k = K(f"refinery7_{machine}_{rot}", (3, 4), rot)
    MACHINES[machine](k)
    return k.build()
