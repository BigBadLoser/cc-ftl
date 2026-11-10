"""Bar look study (family `bar`, preview only): a 3x1 leisure bar, low enough for the seated pose (the counter top at
the game table's height), three stools on the tiles in front (+v), each held off the counter's kick by an arm. One body:
a U in plan, the counter at the front, the back bar (shelves of lit bottles) at the back, end panels joining them,
and in the gap between them the robot bartender working.

  b1 neon dive: navy and chrome, pink neon; the robot hangs from a rail over the gap, sliding along it, shaking a drink
  b2 warm lounge: wood and brass, amber light; a tin robot standing behind the counter, bow tie, polishing a glass
  b3 white tech: a white shell counter, cyan light; a robot arm on the back of the counter pouring from a tap tower

Units: world (1 = a tile), z in world units (the seat top 0.39, the counter top 0.62)."""
import math

from .gametable_study import stool
from .research_kit import Bench, bar

FP3 = (3, 1)
TOP = 0.62
STOOLS = (-1.0, 0.0, 1.0)                                            # the stools' u, on the tiles in front (v 1)
BOTTLES = ("arcPink", "arcAmb", "arcGrn", "arcCyan", "arcRed")


def shell(k, body, top, trim, glow, back_h=1.1):
    """The U: a kick, the counter (front face, a thick overhanging top, a lit edge under its lip), the back bar (a tall
    cabinet with two lit shelves of bottles), the end panels, the stools on arms."""
    k.box(0.0, -0.02, 0.0, 2.96, 0.94, 0.04, "arcBodyK", top="arcBodyK")                # the kick,
    k.box(0.0, 0.24, 0.04, 2.9, 0.36, TOP - 0.1, body[1], top=body[0])                  # the counter's body,
    k.box(0.0, 0.25, TOP - 0.06, 3.0, 0.46, 0.06, trim[1], top=top)                     # its top,
    k.box(0.0, 0.475, TOP - 0.075, 2.96, 0.006, 0.014, glow)                             # the lit edge under its lip
    k.box(0.0, -0.39, 0.04, 2.9, 0.18, back_h - 0.04, body[1], top=body[0])              # the back bar,
    k.box(0.0, -0.39, back_h, 2.94, 0.2, 0.04, trim[1], top=trim[0])                     # its cornice,
    for z in (0.62, 0.88):                                                               # its shelves,
        k.box(0.0, -0.29, z, 2.7, 0.06, 0.02, trim[1], top=trim[0])
        k.box(0.0, -0.258, z - 0.006, 2.7, 0.004, 0.008, glow)
        for i in range(18):                                                              # the bottles
            u = -1.28 + i * 0.15
            col = BOTTLES[(i * 3 + int(z * 10)) % len(BOTTLES)]
            k.box(u, -0.3, z + 0.02, 0.05, 0.05, 0.1 + (i % 3) * 0.02, col, top=col)
    for s in (-1, 1):                                                                    # the end panels
        k.box(s * 1.46, -0.07, 0.04, 0.08, 0.84, TOP - 0.06, body[1], top=body[0])
    for u in STOOLS:
        bar(k, (u, 0.42, 0.03), (u, 1.0, 0.03), 0.06, trim[2])
        stool(k, u, 1.0, -1, glow)
    for u in (-1.0, 0.1, 1.0):                                                           # the drinks at the places
        k.cyl(u, 0.36, TOP, 0.035, 0.08, "arcGlass", top=BOTTLES[int(u + 1.5) % 5], sides=8)


def b1():
    """Neon dive: navy, chrome, pink neon; the robot on a rail over the gap."""
    k = Bench("bar_b1", FP3)
    shell(k, ("arcBodyL", "arcBody"), "arcGlass", ("arcChr", "arcChrD", "arcChrD"), "arcPink")
    k.box(0.0, 0.002 + 0.42, 0.18, 2.6, 0.006, 0.02, "arcPink")                         # a neon stripe on the front
    for s in (-1, 1):                                                                    # the rail's brackets,
        bar(k, (s * 1.3, -0.3, 1.1), (s * 1.3, -0.1, 1.24), 0.04, "arcChrD")
    k.box(0.0, -0.1, 1.22, 2.7, 0.05, 0.04, "arcChrD", top="arcChr")                    # the rail,
    u = 0.0                                                                              # the robot:
    k.box(u, -0.1, 1.15, 0.2, 0.12, 0.08, "arcChrD", top="arcChr")                       # its carriage,
    k.box(u, -0.1, 1.08, 0.04, 0.04, 0.08, "arcChrD")                                    # its neck,
    k.box(u, -0.1, 0.92, 0.18, 0.16, 0.16, "arcBodyL", top="arcBodyL")                   # its head,
    k.box(u, -0.018, 0.97, 0.14, 0.004, 0.04, "arcPink")                                 # its visor,
    k.box(u, -0.1, 0.6, 0.3, 0.2, 0.3, "arcBody", top="arcBodyL")                        # its torso,
    k.box(u, 0.002, 0.7, 0.16, 0.004, 0.012, "arcPink")                                  # a lit chest bar,
    bar(k, (u + 0.16, -0.08, 0.86), (u + 0.26, 0.14, 0.74), 0.06, "arcChrD")             # an arm,
    k.box(u + 0.27, 0.16, 0.64, 0.07, 0.07, 0.16, "arcChr", top="arcPink")              # the shaker in its hand,
    bar(k, (u - 0.16, -0.08, 0.86), (u - 0.24, 0.06, 0.7), 0.06, "arcChrD")              # the other arm
    return k.build()


def b2():
    """Warm lounge: wood and brass, amber light; a tin robot behind the counter."""
    k = Bench("bar_b2", FP3)
    shell(k, ("arcWoodL", "arcWood"), "arcWoodL", ("arcGoldL", "arcGold", "arcGoldD"), "arcAmb")
    k.box(0.0, 0.45, 0.12, 2.94, 0.04, 0.03, "arcGoldD", top="arcGold")                 # the brass foot rail,
    for i in range(6):                                                                   # wood panels on the front
        k.box(-1.2 + i * 0.48, 0.425, 0.12, 0.012, 0.004, TOP - 0.24, "arcWoodD")
    u = 0.0                                                                              # the robot:
    k.cyl(u, -0.12, 0.04, 0.12, 0.66, "arcGoldD", top="arcGold", sides=12)               # its body column,
    k.cyl(u, -0.12, 0.66, 0.18, 0.3, "arcGold", top="arcGoldL", sides=14)                # its barrel chest,
    k.box(u, 0.055, 0.9, 0.13, 0.03, 0.05, "arcPink", top="arcPink")                     # its bow tie,
    k.cyl(u, -0.12, 0.96, 0.12, 0.16, "arcGoldL", top="arcGoldL", sides=14)             # its round head,
    for du in (-0.045, 0.045):
        k.box(u + du, -0.002, 1.04, 0.04, 0.004, 0.04, "arcAmb")                          # its lamp eyes,
    k.box(u, -0.12, 1.12, 0.016, 0.016, 0.08, "arcGoldD")                                # its antenna,
    k.box(u, -0.12, 1.2, 0.04, 0.04, 0.04, "arcRed", top="arcRed")
    bar(k, (u + 0.16, -0.1, 0.9), (u + 0.2, 0.14, 0.72), 0.06, "arcGoldD")              # an arm,
    k.cyl(u + 0.2, 0.16, 0.66, 0.05, 0.12, "arcGlass", top="arcAmb", sides=8)            # the glass it polishes,
    bar(k, (u - 0.16, -0.1, 0.9), (u - 0.12, 0.14, 0.74), 0.06, "arcGoldD")             # the other arm,
    k.box(u - 0.11, 0.16, 0.66, 0.09, 0.04, 0.11, "arcShellL", top="arcShellL")         # its cloth
    return k.build()


def b3():
    """White tech: a white shell counter with cyan light; a robot arm on the back of the counter pouring from a tap
    tower."""
    k = Bench("bar_b3", FP3)
    shell(k, ("arcShellL", "arcShell"), "arcShellL", ("arcChrL", "arcChr", "arcChrD"), "arcCyan")
    k.box(0.0, 0.43, 0.06, 2.9, 0.006, 0.02, "arcCyan")                                 # a lit line at the foot
    tu = -0.75                                                                           # the tap tower:
    k.box(tu, -0.08, 0.04, 0.2, 0.16, 0.94, "arcShell", top="arcShellL")
    for i, col in enumerate(("arcPink", "arcAmb", "arcGrn")):
        k.box(tu - 0.06 + i * 0.06, 0.01, 0.78, 0.03, 0.06, 0.03, "arcChr", top="arcChr")   # its taps,
        k.box(tu - 0.06 + i * 0.06, 0.004, 0.84, 0.03, 0.004, 0.06, col)                      # their lit labels
    au = 0.2                                                                             # the arm:
    k.cyl(au, -0.12, 0.04, 0.14, 0.72, "arcShell", top="arcShellL", sides=12)           # its base column,
    k.cyl(au, -0.12, 0.76, 0.12, 0.08, "arcChr", top="arcChrL", sides=12)               # its turret,
    bar(k, (au, -0.12, 0.82), (au - 0.35, -0.05, 1.25), 0.1, "arcShellL")                # the upper arm,
    k.cyl(au - 0.35, -0.05, 1.18, 0.07, 0.12, "arcCyan", top="arcCyan", sides=10)        # a lit joint,
    bar(k, (au - 0.35, -0.05, 1.24), (tu + 0.15, 0.08, 0.92), 0.08, "arcShellL")         # the forearm,
    k.box(tu + 0.15, 0.08, 0.84, 0.08, 0.08, 0.08, "arcChr", top="arcChrL")             # its gripper,
    k.cyl(tu + 0.15, 0.1, 0.68, 0.05, 0.14, "arcGlass", top="arcPink", sides=8)          # the glass under the tap
    return k.build()


# ---- round 2: three different bodies -----------------------------------------------------------------------------

def stools(k, trim, glow, y0=0.42):
    for u in STOOLS:
        bar(k, (u, y0, 0.03), (u, 1.0, 0.03), 0.06, trim)
        stool(k, u, 1.0, -1, glow)


def b4():
    """Island bar: the counter is a stadium ring round the robot, who stands in the middle on a column; over him a
    mast carries a ring of bottles, lit from beneath. Navy and chrome, amber light."""
    from .gametable_study import stadium, stadium_ring
    k = Bench("bar_b4", FP3)
    stadium(k, 1.48, 0.48, 0.0, 0.04, "arcBodyK", top="arcBodyK")
    stadium_ring(k, 1.45, 0.45, 0.04, TOP - 0.1, 0.22, "arcBodyD", "arcBody")             # the ring counter,
    stadium_ring(k, 1.48, 0.48, TOP - 0.06, 0.06, 0.28, "arcChrD", "arcGlass")           # its top,
    stadium_ring(k, 1.48, 0.48, TOP - 0.075, 0.012, 0.012, "arcAmb", "arcAmb")           # a lit lip
    k.cyl(0.0, 0.0, 0.04, 0.12, 0.5, "arcChrD", top="arcChr", sides=12)                  # the robot's column,
    k.cyl(0.0, 0.0, 0.54, 0.2, 0.32, "arcBody", top="arcBodyL", sides=14)               # its torso,
    k.box(0.0, 0.19, 0.7, 0.18, 0.006, 0.02, "arcAmb")                                    # a lit chest bar,
    k.cyl(0.0, 0.0, 0.86, 0.13, 0.15, "arcBodyL", top="arcBodyL", sides=14)             # its head,
    k.box(0.0, 0.125, 0.92, 0.16, 0.006, 0.04, "arcAmb")                                  # its visor,
    for s_ in (-1, 1):                                                                    # four arms, two at work
        bar(k, (s_ * 0.18, 0.0, 0.8), (s_ * 0.42, 0.22, 0.7), 0.06, "arcChrD")
        k.cyl(s_ * 0.44, 0.24, TOP, 0.05, 0.12, "arcGlass", top="arcAmb" if s_ < 0 else "arcPink", sides=8)
        bar(k, (s_ * 0.18, 0.0, 0.66), (s_ * 0.3, -0.25, 0.62), 0.05, "arcChrD")
    k.cyl(0.0, 0.0, 1.0, 0.03, 0.42, "arcChrD", top="arcChr", sides=8)                   # the mast,
    k.cyl(0.0, 0.0, 1.38, 0.56, 0.04, "arcChrD", top="arcChr", sides=20)                 # the bottle ring,
    k.cyl(0.0, 0.0, 1.37, 0.5, 0.012, "arcAmb", top="arcAmb", sides=20)                  # lit beneath,
    for i in range(16):                                                                   # the bottles round it
        a = i * math.tau / 16
        col = BOTTLES[i % len(BOTTLES)]
        k.box(0.52 * math.cos(a), 0.52 * math.sin(a), 1.42, 0.06, 0.06, 0.12, col, top=col)
    stools(k, "arcChrD", "arcAmb", y0=0.45)
    return k.build()


def b5():
    """The robot is the bar: a big friendly robot bust forms the back of the counter, its shoulders the back bar, its
    forearms lying along the counter, hands holding a shaker and pouring; bottles racked in its chest. Teal and white,
    green light."""
    k = Bench("bar_b5", FP3)
    k.box(0.0, 0.0, 0.0, 2.96, 0.94, 0.04, "arcBodyK", top="arcBodyK")
    k.box(0.0, 0.24, 0.04, 2.9, 0.36, TOP - 0.1, "arcTealD", top="arcTeal")             # the counter,
    k.box(0.0, 0.25, TOP - 0.06, 3.0, 0.46, 0.06, "arcShellD", top="arcShellL")
    k.box(0.0, 0.475, TOP - 0.075, 2.96, 0.006, 0.014, "arcGrn")
    k.box(0.0, -0.3, 0.04, 1.3, 0.36, 0.9, "arcTeal", top="arcTealL")                    # the bust: its chest,
    for z in (0.3, 0.52):                                                                 # the bottles racked in it
        k.box(0.0, -0.118, z - 0.02, 0.9, 0.004, 0.18, "arcBodyK")
        for i in range(7):
            col = BOTTLES[(i + int(z * 10)) % len(BOTTLES)]
            k.box(-0.36 + i * 0.12, -0.13, z, 0.06, 0.04, 0.12, col, top=col)
    for s_ in (-1, 1):
        k.box(s_ * 0.85, -0.3, 0.04, 0.42, 0.38, 1.0, "arcTealD", top="arcTeal", taper=0.8)   # the shoulders,
        k.cyl(s_ * 0.85, -0.3, 1.04, 0.2, 0.08, "arcShell", top="arcShellL", sides=12)
        k.box(s_ * 0.85, -0.05, 0.62, 0.16, 0.16, 0.14, "arcShell", top="arcShellL")          # the elbows,
        k.box(s_ * 0.55, 0.12, 0.62, 0.62, 0.14, 0.1, "arcShellL", top="arcShellL")           # the forearms,
        k.box(s_ * 0.22, 0.2, 0.62, 0.14, 0.14, 0.1, "arcTeal", top="arcTealL")               # the hands
    k.box(-0.22, 0.2, 0.72, 0.07, 0.07, 0.16, "arcChr", top="arcGrn")                     # a shaker,
    k.cyl(0.22, 0.26, TOP, 0.05, 0.12, "arcGlass", top="arcPink", sides=8)               # a glass
    k.box(0.0, -0.3, 0.94, 0.5, 0.34, 0.36, "arcShell", top="arcShellL")                 # the head,
    k.box(0.0, -0.128, 1.08, 0.4, 0.006, 0.12, "arcBodyK")                               # its face screen,
    for du in (-0.09, 0.09):
        k.box(du, -0.122, 1.13, 0.07, 0.006, 0.04, "arcGrn")                              # its eyes,
    k.box(0.0, -0.122, 1.09, 0.14, 0.006, 0.015, "arcGrn")                                # its smile
    k.box(0.0, -0.3, 1.3, 0.04, 0.04, 0.1, "arcShellD")                                   # its antenna,
    k.box(0.0, -0.3, 1.4, 0.06, 0.06, 0.06, "arcGrn", top="arcGrn")
    stools(k, "arcShellD", "arcGrn")
    return k.build()


def b6():
    """Tube bar: a sleek dark counter; behind it a wall of tall glass tubes of lit liquor feeding taps; a hovering drone
    bartender (a sphere ringed in light, two arms) mixing over the counter; a hologram cocktail glass sign over it all.
    Dark and violet, pink light."""
    k = Bench("bar_b6", FP3)
    k.box(0.0, 0.0, 0.0, 2.96, 0.94, 0.04, "arcBodyK", top="arcBodyK")
    k.box(0.0, 0.24, 0.04, 2.9, 0.36, TOP - 0.1, "arcBodyD", top="arcBody")
    k.box(0.0, 0.25, TOP - 0.06, 3.0, 0.46, 0.06, "arcChrD", top="arcGlass")
    k.box(0.0, 0.475, TOP - 0.075, 2.96, 0.006, 0.014, "arcPink")
    k.box(0.0, -0.4, 0.04, 2.9, 0.16, 0.12, "arcBodyD", top="arcBody")                   # the tube wall's base,
    k.box(0.0, -0.4, 1.3, 2.94, 0.18, 0.06, "arcBodyD", top="arcBody")                   # its top,
    for i in range(9):                                                                    # the tubes
        u = -1.28 + i * 0.32
        col = BOTTLES[i % len(BOTTLES)]
        h = 0.5 + (i % 3) * 0.2
        k.cyl(u, -0.4, 0.16, 0.08, h, col, top=col, sides=10)                            # the liquor (lit),
        k.cyl(u, -0.4, 0.16 + h, 0.08, 1.14 - h, "arcGlass", top="arcGlass", sides=10)  # the empty glass above it,
        k.box(u, -0.3, 0.2, 0.03, 0.08, 0.03, "arcChr", top="arcChrL")                   # its tap
    for s_ in (-1, 1):
        k.box(s_ * 1.46, -0.07, 0.04, 0.08, 0.84, TOP - 0.06, "arcBodyD", top="arcBody")  # the end panels,
        k.box(s_ * 1.46, -0.4, 0.04, 0.08, 0.18, 1.32, "arcBodyD", top="arcBody")       # the tube wall's ends
    k.cyl(0.0, 0.0, 0.86, 0.13, 0.22, "arcBodyL", top="arcBodyL", sides=14)             # the drone,
    k.cyl(0.0, 0.0, 0.95, 0.17, 0.03, "arcPink", top="arcPink", sides=16)                # its ring of light,
    k.box(0.0, 0.12, 0.96, 0.1, 0.006, 0.03, "arcCyan")                                   # its eye,
    for s_ in (-1, 1):
        bar(k, (s_ * 0.1, 0.05, 0.9), (s_ * 0.22, 0.24, 0.76), 0.04, "arcChrD")         # its arms,
    k.box(-0.22, 0.25, 0.68, 0.06, 0.06, 0.12, "arcChr", top="arcPink")
    k.cyl(0.22, 0.26, TOP, 0.05, 0.12, "arcGlass", top="arcCyan", sides=8)
    k.box(0.0, -0.4, 1.36, 0.02, 0.02, 0.12, "arcChrD")                                   # the sign's post,
    z = 1.48                                                                              # the sign: a cocktail glass
    bar(k, (-0.16, -0.4, z + 0.18), (0.0, -0.4, z), 0.03, "arcPink")
    bar(k, (0.16, -0.4, z + 0.18), (0.0, -0.4, z), 0.03, "arcPink")
    k.box(0.0, -0.4, z + 0.17, 0.34, 0.03, 0.03, "arcPink", top="arcPink")
    k.box(0.0, -0.4, z - 0.12, 0.03, 0.03, 0.12, "arcPink")
    k.box(0.0, -0.4, z - 0.13, 0.14, 0.03, 0.02, "arcPink", top="arcPink")
    k.box(0.1, -0.4, z + 0.2, 0.04, 0.04, 0.04, "arcGrn", top="arcGrn")                   # an olive
    stools(k, "arcChrD", "arcPink")
    return k.build()


# ---- round 3: diner, still, automat ---------------------------------------------------------------------------------

def counter(k, body, top, trim, glow):
    """The straight counter (round 2's), its kick and its lit lip; end panels low."""
    k.box(0.0, 0.0, 0.0, 2.96, 0.94, 0.04, "arcBodyK", top="arcBodyK")
    k.box(0.0, 0.24, 0.04, 2.9, 0.36, TOP - 0.1, body[1], top=body[0])
    k.box(0.0, 0.25, TOP - 0.06, 3.0, 0.46, 0.06, trim, top=top)
    k.box(0.0, 0.475, TOP - 0.075, 2.96, 0.006, 0.014, glow)


def b7():
    """Retro diner: a white counter with a red top and a chequered front, chrome; behind it a soda fountain (a chrome
    machine with arched spouts and lit labels) and a pie dome; a round mint robot on one wheel, a dome head and a tray."""
    k = Bench("bar_b7", FP3)
    counter(k, ("arcShellL", "arcShell"), "arcRedM", "arcChr", "arcRed")
    for i in range(16):                                                                   # the chequered front
        for j in range(2):
            if (i + j) % 2 == 0:
                k.box(-1.35 + i * 0.18, 0.423, 0.14 + j * 0.16, 0.18, 0.004, 0.16, "arcBodyK")
    k.box(0.0, 0.43, 0.06, 2.9, 0.02, 0.04, "arcChr", top="arcChrL")                     # a chrome kick rail
    fu = -0.75                                                                            # the fountain:
    k.box(fu, -0.3, 0.04, 0.9, 0.34, 0.84, "arcChr", top="arcChrL")                       # its body,
    k.box(fu, -0.3, 0.88, 0.94, 0.36, 0.06, "arcRedM", top="arcRedM")                     # its red cap,
    for i, col in enumerate(("arcPink", "arcAmb", "arcGrn", "arcCyan")):
        u = fu - 0.3 + i * 0.2
        k.box(u, -0.128, 0.6, 0.12, 0.006, 0.12, col)                                     # its lit labels,
        bar(k, (u, -0.14, 0.72), (u, 0.0, 0.8), 0.03, "arcChrL")                         # the spouts arching
        bar(k, (u, 0.0, 0.8), (u, 0.05, 0.7), 0.03, "arcChrL")                           # over the counter
    k.cyl(0.85, -0.25, 0.04, 0.2, 0.62, "arcShell", top="arcChr", sides=12)              # the pie stand,
    k.cyl(0.85, -0.25, 0.66, 0.18, 0.14, "arcGlass", top="arcGlass", sides=12, rtop=0.08)  # its glass dome,
    k.cyl(0.85, -0.25, 0.67, 0.12, 0.05, "arcAmb", top="arcAmb", sides=10)              # a lit pie under it
    ru = 0.25                                                                             # the robot:
    k.cyl(ru, -0.15, 0.04, 0.07, 0.1, "arcBodyK", top="arcBodyK", sides=10)               # its wheel,
    k.cyl(ru, -0.15, 0.14, 0.17, 0.42, "arcTealL", top="arcTealL", sides=14, rtop=0.14)  # its round body,
    k.cyl(ru, -0.15, 0.56, 0.12, 0.08, "arcChr", top="arcChrL", sides=12)               # its collar,
    k.cyl(ru, -0.15, 0.64, 0.13, 0.18, "arcGlass", top="arcShellL", sides=12, rtop=0.07)   # its dome head,
    for du in (-0.04, 0.04):
        k.box(ru + du, -0.03, 0.7, 0.04, 0.004, 0.04, "arcCyan")                         # its eyes,
    bar(k, (ru + 0.15, -0.1, 0.48), (ru + 0.25, 0.12, 0.62), 0.04, "arcChr")             # its arm,
    k.cyl(ru + 0.26, 0.14, 0.64, 0.12, 0.02, "arcChr", top="arcChrL", sides=12)          # the tray,
    k.cyl(ru + 0.26, 0.14, 0.66, 0.04, 0.1, "arcGlass", top="arcPink", sides=8)          # a milkshake on it
    for s_ in (-1, 1):
        k.box(s_ * 1.46, -0.07, 0.04, 0.08, 0.84, TOP - 0.06, "arcShell", top="arcShellL")
    stools(k, "arcChr", "arcRed")
    return k.build()


def b8():
    """The still: the bar is built round a copper pot still (a domed pot with green gauge windows, a swan neck over to
    a condenser column wrapped in coils), pipes running down to brass taps along the counter's back; a cream steward
    robot minding it between pot and column. Wood counter, copper, green light."""
    k = Bench("bar_b8", FP3)
    counter(k, ("arcWoodL", "arcWood"), "arcWoodL", "arcGoldD", "arcGrn")
    pu = -0.8                                                                             # the pot:
    k.cyl(pu, -0.22, 0.04, 0.34, 0.6, "arcOrgD", top="arcOrg", sides=16)
    k.cyl(pu, -0.22, 0.64, 0.34, 0.24, "arcOrg", top="arcOrgL", sides=16, rtop=0.12)     # its dome,
    for a in (1.2, 1.9):
        k.box(pu + 0.34 * math.cos(a), -0.22 + 0.34 * math.sin(a), 0.3, 0.08, 0.02, 0.14, "arcGrn", rz=a + 1.57)
    for z in (0.2, 0.5):                                                                  # its bands
        k.cyl(pu, -0.22, z, 0.345, 0.03, "arcGoldD", top="arcGold", sides=16)
    cu = 0.85                                                                             # the condenser column,
    k.cyl(cu, -0.25, 0.04, 0.14, 1.2, "arcOrgD", top="arcOrg", sides=12)
    for i in range(6):                                                                    # its coils
        k.cyl(cu, -0.25, 0.3 + i * 0.13, 0.17, 0.035, "arcGold", top="arcGoldL", sides=12)
    bar(k, (pu, -0.22, 0.88), (pu + 0.3, -0.22, 1.2), 0.06, "arcOrg")                     # the swan neck,
    bar(k, (pu + 0.3, -0.22, 1.2), (cu, -0.25, 1.2), 0.06, "arcOrg")
    k.box(0.0, -0.42, 0.04, 2.8, 0.1, 0.5, "arcWoodD", top="arcWood")                    # a low back counter,
    bar(k, (cu, -0.25, 0.3), (cu - 0.2, 0.0, 0.66), 0.035, "arcGold")                     # a pipe to the taps,
    for i in range(4):                                                                    # the taps
        u = -0.2 + i * 0.25
        k.box(u, 0.04, TOP, 0.04, 0.04, 0.14, "arcGold", top="arcGoldL")
        k.box(u, 0.07, TOP + 0.12, 0.03, 0.06, 0.03, "arcGold", top="arcGoldL")
        k.box(u, 0.063, TOP + 0.04, 0.03, 0.004, 0.05, BOTTLES[i])
    ru = 0.05                                                                             # the steward:
    k.cyl(ru, -0.2, 0.04, 0.1, 0.5, "arcWoodD", top="arcWood", sides=12)                 # its column,
    k.box(ru, -0.2, 0.52, 0.26, 0.18, 0.26, "arcShellL", top="arcShellL")                # its torso,
    k.box(ru, -0.108, 0.6, 0.2, 0.004, 0.16, "arcWood")                                   # its apron,
    k.box(ru, -0.2, 0.8, 0.16, 0.15, 0.14, "arcShellL", top="arcShellL")                 # its head,
    k.box(ru, -0.124, 0.85, 0.1, 0.004, 0.03, "arcGrn")                                   # its eye band,
    bar(k, (ru + 0.13, -0.18, 0.74), (ru + 0.2, 0.04, 0.68), 0.05, "arcShell")           # an arm at a tap
    bar(k, (ru - 0.13, -0.18, 0.74), (ru - 0.18, 0.05, 0.66), 0.05, "arcShell")
    k.cyl(ru - 0.18, 0.08, TOP, 0.045, 0.12, "arcGlass", top="arcAmb", sides=8)
    for s_ in (-1, 1):
        k.box(s_ * 1.46, -0.07, 0.04, 0.08, 0.84, TOP - 0.06, "arcWoodD", top="arcWood")
    stools(k, "arcGoldD", "arcGrn")
    return k.build()


def b9():
    """Automat: behind the counter a wall of lit cubbies, a drink in each; a gantry runs over it, its carriage dropping
    a claw that has picked a drink, a little head with eyes on the carriage. Grey and amber, hazard trim."""
    k = Bench("bar_b9", FP3)
    counter(k, ("arcChr", "arcChrD"), "arcBodyL", "arcBodyD", "arcAmb")
    for i in range(14):                                                                   # hazard stripes on the kick
        k.box(-1.3 + i * 0.2, 0.425, 0.06, 0.08, 0.004, 0.08, "arcAmb", ry=0.6)
    k.box(0.0, -0.4, 0.04, 2.9, 0.16, 1.1, "arcChrD", top="arcChr")                     # the cubby wall,
    for i in range(8):
        for j in range(3):
            u, z = -1.23 + i * 0.35, 0.22 + j * 0.28
            k.box(u, -0.318, z, 0.26, 0.004, 0.2, "arcBodyK")                              # a cubby,
            col = BOTTLES[(i + j * 3) % len(BOTTLES)]
            if (i, j) != (5, 1):
                k.box(u, -0.31, z + 0.02, 0.07, 0.04, 0.12, col, top=col)                  # its drink,
            k.box(u, -0.314, z + 0.18, 0.2, 0.004, 0.012, "arcAmb")                        # its lit label
    for s_ in (-1, 1):                                                                    # the gantry: its posts,
        k.box(s_ * 1.42, -0.2, 0.04, 0.08, 0.08, 1.38, "arcAmb", top="arcAmb")
    k.box(0.0, -0.2, 1.38, 2.92, 0.1, 0.08, "arcAmb", top="arcAmb")                        # its beam,
    gu = 0.53                                                                             # the carriage,
    k.box(gu, -0.15, 1.3, 0.22, 0.2, 0.12, "arcBodyD", top="arcBody")
    k.box(gu, -0.15, 1.18, 0.16, 0.14, 0.12, "arcShellL", top="arcShellL")               # its head,
    for du in (-0.04, 0.04):
        k.box(gu + du, -0.078, 1.22, 0.04, 0.004, 0.04, "arcCyan")                         # its eyes,
    k.box(gu, -0.12, 0.88, 0.03, 0.03, 0.3, "arcChrD")                                    # the claw's arm,
    for du in (-0.05, 0.05):
        k.box(gu + du, -0.12, 0.76, 0.02, 0.06, 0.12, "arcChr", top="arcChrL")            # its fingers,
    k.box(gu, -0.12, 0.76, 0.07, 0.04, 0.12, "arcPink", top="arcPink")                    # the drink it holds
    for s_ in (-1, 1):
        k.box(s_ * 1.46, -0.07, 0.04, 0.08, 0.84, TOP - 0.06, "arcChrD", top="arcChr")
    stools(k, "arcChrD", "arcAmb")
    return k.build()


def jobs():
    from .bar_r4 import VARIANTS
    return [(f"module.bar.{v}", FP3, "prop", f) for v, f in VARIANTS + (("b1", b1), ("b2", b2), ("b3", b3), ("b4", b4), ("b5", b5),
                                                           ("b6", b6), ("b7", b7), ("b8", b8), ("b9", b9))]
