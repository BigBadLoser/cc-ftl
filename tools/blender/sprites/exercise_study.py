"""Exercise machine look study (family `exercise`, preview only): four machines, 1x1 and 2x1, each with a crew member
on it in the nearest existing pose (exercise clips don't exist yet).

  e1 treadmill (2x1): a long deck with a lit belt, side rails, a console with a screen at the head; walking on it
  e2 spin bike (1x1): a low frame, a lit flywheel at the front, bars and a little screen; seated, hands on the bars
  e3 cable tower (1x1): a tower against the back edge, a lit weight stack, two arms with cables to handles; standing
  e4 run wheel (2x1): a tall ring on a cradle, lit slats round its inside; walking in the bottom of it

Units: world (1 = a tile), z in world units (the seat top 0.39). Dark body, white shell, cyan light (the arcade set)."""
import math

from .research_kit import Bench, bar


def disc(k, u, v, z, r, t, col, n=3):
    """A disc standing in the u-z plane about (u, v, z): n square slabs turned about v."""
    for i in range(n):
        k.box(u, v, z - r, r * 2 * 0.83, t, r * 2 * 0.83, col, top=col, ry=i * math.pi / (2 * n))


def ring(k, u, v, z, r, w, col, n=20, plane="uz"):
    pts = [(r * math.cos(i * math.tau / n), r * math.sin(i * math.tau / n)) for i in range(n + 1)]
    for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
        if plane == "uz":
            bar(k, (u + a0, v, z + b0), (u + a1, v, z + b1), w, col)
        else:
            bar(k, (u + a0, v + b0, z), (u + a1, v + b1, z), w, col)


def e1(front=False):
    """Treadmill: the deck along u, the console at +u. front: only the parts drawn over the runner."""
    k = Bench("ex_e1" + ("f" if front else ""), (2, 1))
    if front:
        bar(k, (0.72, 0.28, 0.1), (0.62, 0.3, 0.92), 0.06, "arcShell")
        bar(k, (0.64, 0.3, 0.9), (0.2, 0.3, 0.9), 0.04, "arcChr")
        return k.build()
    k.box(-0.08, 0.0, 0.0, 1.7, 0.62, 0.1, "arcBodyD", top="arcBody")                   # the deck,
    k.box(-0.1, 0.0, 0.1, 1.5, 0.44, 0.02, "arcBodyK", top="arcBodyK")                  # the belt,
    for s_ in (-1, 1):
        k.box(-0.1, s_ * 0.27, 0.1, 1.5, 0.06, 0.03, "arcShell", top="arcShellL")       # its side treads,
        k.box(-0.1, s_ * 0.311, 0.05, 1.5, 0.004, 0.02, "arcCyan")                       # a lit strip,
        bar(k, (0.72, s_ * 0.28, 0.1), (0.62, s_ * 0.3, 0.92), 0.06, "arcShell")       # the uprights,
        bar(k, (0.64, s_ * 0.3, 0.9), (0.2, s_ * 0.3, 0.9), 0.04, "arcChr")             # the side rails
    k.cyl(-0.86, 0.0, 0.0, 0.07, 0.12, "arcShell", top="arcShellL", sides=10)            # the rear roller,
    k.box(0.68, 0.0, 0.0, 0.2, 0.64, 0.14, "arcShell", top="arcShellL")                  # the motor hood,
    k.box(0.62, 0.0, 0.9, 0.12, 0.66, 0.06, "arcShell", top="arcShellL")                 # the cross bar,
    k.box(0.64, 0.0, 0.96, 0.08, 0.42, 0.24, "arcBodyD", top="arcBody", ry=-0.35)        # the console,
    k.box(0.6, 0.0, 1.0, 0.004, 0.34, 0.14, "arcCyan", ry=-0.35)                          # its screen
    return k.build()


def e2(front=False):
    """Spin bike: the rider faces +u; the flywheel under the bars. front: the flywheel, bars and screen."""
    k = Bench("ex_e2" + ("f" if front else ""), (1, 1))
    if front:
        e2_front(k)
        return k.build()
    k.box(0.0, 0.0, 0.0, 0.8, 0.1, 0.05, "arcBodyD", top="arcBody")                     # the foot,
    for u in (-0.36, 0.36):
        k.box(u, 0.0, 0.0, 0.08, 0.44, 0.05, "arcBodyD", top="arcBody")                  # its cross feet
    bar(k, (-0.25, 0.0, 0.04), (-0.12, 0.0, 0.34), 0.07, "arcShell")                    # the seat post,
    k.box(-0.15, 0.0, 0.34, 0.24, 0.16, 0.05, "arcBodyK", top="arcBody")                 # the saddle,
    bar(k, (-0.25, 0.0, 0.05), (0.24, 0.0, 0.3), 0.06, "arcShell")                      # the frame,
    e2_front(k)
    return k.build()


def e2_front(k):
    disc(k, 0.24, 0.0, 0.3, 0.22, 0.06, "arcBody")                                       # the flywheel,
    disc(k, 0.24, 0.0, 0.3, 0.17, 0.08, "arcCyan")                                       # lit,
    disc(k, 0.24, 0.0, 0.3, 0.06, 0.1, "arcShellL")                                      # its hub
    bar(k, (0.24, 0.0, 0.3), (0.3, 0.0, 0.7), 0.06, "arcShell")                          # the bar post,
    k.box(0.32, 0.0, 0.68, 0.06, 0.5, 0.04, "arcChr", top="arcChrL")                     # the bars,
    for s_ in (-1, 1):
        bar(k, (0.32, s_ * 0.24, 0.7), (0.44, s_ * 0.22, 0.74), 0.04, "arcChr")
    k.box(0.36, 0.0, 0.72, 0.06, 0.18, 0.12, "arcBodyD", top="arcBody", ry=-0.4)         # its screen,
    k.box(0.33, 0.0, 0.75, 0.004, 0.14, 0.08, "arcCyan", ry=-0.4)
    bar(k, (0.24, 0.1, 0.3), (0.12, 0.12, 0.2), 0.03, "arcChrD")                         # the cranks
    bar(k, (0.24, -0.1, 0.3), (0.36, -0.12, 0.4), 0.03, "arcChrD")


def e3():
    """Cable tower: against the back edge (-v); the user stands in front of it, facing out (+v)."""
    k = Bench("ex_e3", (1, 1))
    k.box(0.0, 0.05, 0.0, 0.9, 0.9, 0.03, "arcBodyK", top="arcBodyD")                    # the mat,
    k.box(0.0, 0.42, 0.03, 0.7, 0.004, 0.006, "arcCyan")                                  # its lit edge
    k.box(0.0, -0.36, 0.0, 0.36, 0.2, 1.4, "arcShell", top="arcShellL")                  # the tower,
    k.box(0.0, -0.255, 0.2, 0.2, 0.01, 0.9, "arcBodyK")                                  # its slot,
    for i in range(7):                                                                    # the weight stack (lit edges)
        k.box(0.0, -0.25, 0.2 + i * 0.07, 0.16, 0.04, 0.06, "arcBody", top="arcBodyL")
        k.box(0.0, -0.228, 0.2 + i * 0.07, 0.16, 0.004, 0.01, "arcCyan")
    k.box(0.0, -0.25, 0.75, 0.04, 0.04, 0.3, "arcChr")                                   # its rod,
    for s_ in (-1, 1):                                                                    # the arms,
        bar(k, (s_ * 0.16, -0.32, 1.2), (s_ * 0.42, -0.1, 1.1), 0.07, "arcBodyD")
        k.cyl(s_ * 0.42, -0.1, 1.04, 0.05, 0.08, "arcCyan", top="arcCyan", sides=10)    # the lit pulleys,
        bar(k, (s_ * 0.42, -0.1, 1.04), (s_ * 0.2, 0.2, 0.5), 0.012, "arcChrL")      # the cables,
        k.box(s_ * 0.2, 0.2, 0.46, 0.04, 0.04, 0.1, "arcBodyK", top="arcCyan")       # the handles
    k.box(0.0, -0.36, 1.4, 0.4, 0.24, 0.04, "arcBodyD", top="arcBody")                   # the cap
    return k.build()


def e4(front=False):
    """Run wheel: a tall ring along u on a cradle; the runner in the bottom. front: the +v ring."""
    k = Bench("ex_e4" + ("f" if front else ""), (2, 1))
    R, cz = 0.82, 0.88
    if front:
        ring(k, 0.0, 0.3, cz, R, 0.08, "arcShell", n=24)
        ring(k, 0.0, 0.26, cz, R - 0.06, 0.025, "arcCyan", n=24)
        k.cyl(0.0, 0.36, cz - 0.06, 0.1, 0.12, "arcBodyD", top="arcBody", sides=10)
        return k.build()
    k.box(0.0, 0.0, 0.0, 1.6, 0.7, 0.06, "arcBodyD", top="arcBody")                     # the cradle base,
    for s_ in (-1, 1):
        ring(k, 0.0, s_ * 0.3, cz, R, 0.08, "arcShell", n=24)                              # the rings,
        ring(k, 0.0, s_ * 0.26, cz, R - 0.06, 0.025, "arcCyan", n=24)                     # their lit insides,
        for u in (-0.45, 0.45):
            bar(k, (u, s_ * 0.34, 0.06), (u * 0.55, s_ * 0.34, 0.2), 0.08, "arcBodyD")  # the rollers' arms
        k.cyl(0.0, s_ * 0.36, cz - 0.06, 0.1, 0.12, "arcBodyD", top="arcBody", sides=10)   # (the hub covers)
    for i in range(24):                                                                    # the slats
        a = i * math.tau / 24
        u, z = R * math.cos(a), cz + R * math.sin(a)
        if z < cz - 0.2:
            bar(k, (u, -0.3, z), (u, 0.3, z), 0.05, "arcBodyL")
    return k.build()


def jobs():
    js = [(f"module.exercise.{v}", fp, "prop", f)
          for v, fp, f in (("e1", (2, 1), e1), ("e2", (1, 1), e2), ("e3", (1, 1), e3), ("e4", (2, 1), e4))]
    return js + [(f"module.exercise.{v}.front", fp, "prop", lambda f=f: f(True))
                 for v, fp, f in (("e1", (2, 1), e1), ("e2", (1, 1), e2), ("e4", (2, 1), e4))]
