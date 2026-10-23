"""REFINERY, fifth build (module.refinery, 3x4), on the refkit hull: the low leaning body with its roller bays, the
packed deck, the end armour, the terminal housing jutting from the crew side (+u) at the access tile. The machine rises
out of the trench down the middle tile:

  crucible  a round pot standing in the trench, an orange band round it, its light lip and the melt glowing in it;
            a flue stack beside it
  stacks    three octagonal stacks in a row, the middle one tallest
  kiln      a drum lying along the trench half sunk, orange riding rings and glowing seams, an exhaust stack on the deck

Two feed hoppers on the crew-side deck (one on the kiln)."""
from . import refkit as R
from .modkit import K
from .steelkit import tube

BAYS = {"+u": [(-0.96, -0.44), (0.44, 0.96)], "-u": [(-0.96, -0.36), (-0.3, 0.3), (0.36, 0.96)]}
HOPPERS = ((0.6, -0.7), (0.6, 0.7))


def hull(k, on, hoppers=HOPPERS, skip=()):
    R.body(k, BAYS)
    R.ends(k)
    R.trench(k)
    R.terminal(k, on)
    for u, v in hoppers:
        R.hopper(k, u, v)
    R.rim(k, skip=tuple((u, v, 0.3) for u, v in hoppers) + tuple(skip))


def crucible(k, on):
    hull(k, on)
    z0, r, v = R.DZ - 0.12, 0.5, 0.18
    k.cyl(0, v, z0, r, 0.42, R.DK, top=R.DK, sides=20)                          # the pot
    k.cyl(0, v, R.DZ + 0.08, r + 0.03, 0.08, R.OR, top=R.OR_L, sides=20)
    k.cyl(0, v, z0 + 0.42, r + 0.05, 0.07, R.LT, top=R.LT2, sides=20)          # its lip
    k.cyl(0, v, z0 + 0.491, r - 0.1, 0.005, R.GLOW if on else R.BLK, sides=20)
    k.cyl(0, v, z0 + 0.492, r - 0.3, 0.005, R.HOT if on else R.BLK, sides=16)
    R.stack(k, -0.08, -0.78, z0, h=0.68, r=0.24, on=on)                        # the flue


def stacks(k, on):
    hull(k, on)
    for v, h in ((-0.66, 0.58), (0.0, 0.7), (0.66, 0.58)):
        R.stack(k, 0.0, v, R.DZ - 0.12, h=h, r=0.28, on=on)


def kiln(k, on):
    hull(k, on, hoppers=((0.6, 0.7),), skip=((0.6, -0.7, 0.3),))
    z, r = R.DZ - 0.02, 0.4
    tube(k, (0, -1.12, z), (0, 1.12, z), r, R.DK, sides=24, cap=R.BLK)
    for v in (-0.55, 0.55):                                                    # riding rings
        tube(k, (0, v - 0.07, z), (0, v + 0.07, z), r + 0.06, R.OR, sides=24, cap=R.OR_L)
    for v in (-0.2, 0.2):                                                      # the glowing seams
        tube(k, (0, v - 0.025, z), (0, v + 0.025, z), r + 0.01, R.GLOW if on else R.DK, sides=24)
    for v in (-0.9, 0.9):                                                      # collars where it enters the armour
        tube(k, (0, v - 0.05, z), (0, v + 0.05, z), r + 0.07, R.LT, sides=24, cap=R.LT2)
    R.stack(k, 0.6, -0.7, R.DZ, h=0.42, r=0.2, on=on)                           # the exhaust


MACHINES = {"crucible": crucible, "stacks": stacks, "kiln": kiln}


def refinery(machine, rot=0, on=True):
    k = K(f"refinery5_{machine}_{rot}_{int(on)}", (3, 4), rot)
    MACHINES[machine](k, on)
    return k.build()
