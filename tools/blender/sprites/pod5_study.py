"""Recovery pod look study round 5 (family `pod`, preview only): s2 refined, two new designs. 2x2, upright. Layers
and helpers as round 4 (pod4_study.py).

  s2b med column, refined: the fluid lighter so the patient reads through it, the monitor on a stand at the front
      corner facing the viewer (heartbeat line), an equipment rack and the canister rack filling the back corners
  t1 lotus: a glass tank of pink fluid rising out of a ring of white petals that open outward, lit along their edges,
      a domed cap with a glowing bulb
  t2 hanging tank: a round-bottomed tank of blue fluid hung from a curved spine that rises behind it and arcs over,
      cables slung from the spine, a lit pad on the floor under it

Units: world (1 = a tile), z in world units. Local u, v in [-1, 1]; the tank stands at the centre."""
import math

from .pod4_study import FRONT, bubbles, faces_front, fluid, glints, lathe
from .research_kit import Bench, bar

FP2 = (2, 2)


def screen(k, u, v, z, w, h, glow):
    """A monitor facing the viewer (+u +v) with a heartbeat line on it."""
    k.box(u, v, z, w, 0.06, h, "arcBodyD", top="arcBody", rz=-FRONT)
    n = math.cos(FRONT) * 0.035
    k.box(u + n, v + n, z + 0.03, w - 0.06, 0.004, h - 0.06, "arcBodyK", rz=-FRONT)
    pts = ((0.0, 0.5), (0.25, 0.5), (0.33, 0.85), (0.41, 0.15), (0.49, 0.5), (1.0, 0.5))
    tu, tv = math.cos(FRONT), -math.sin(FRONT)                                         # (along the screen)
    for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
        s0, s1 = (a0 - 0.5) * (w - 0.1), (a1 - 0.5) * (w - 0.1)
        z0, z1 = z + 0.05 + b0 * (h - 0.1), z + 0.05 + b1 * (h - 0.1)
        bar(k, (u + n * 1.2 + s0 * tu, v + n * 1.2 + s0 * tv, z0), (u + n * 1.2 + s1 * tu, v + n * 1.2 + s1 * tv, z1),
            0.018, glow)


def s2b(layer="all"):
    k = Bench(f"pod_s2b_{layer}", FP2)
    R, z0, zm, z1 = 0.48, 0.44, 1.96, 2.1
    C = [(z0 + (zm - z0) * i / 6, R) for i in range(7)]
    if layer in ("all", "glass"):
        fluid(k, C, ("podGL", "podGM", "podG"), sides=28)
        bubbles(k, R, z0 + 0.1, zm - 0.1, "podGL", front=layer == "glass")
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, zm, R, z1 - zm, "arcGlass", top="arcGlass", sides=28)              # the air gap,
        k.cyl(0.0, 0.0, 0.0, 0.64, 0.32, "arcBodyD", top="arcBody", sides=28)              # the base housing,
        k.cyl(0.0, 0.0, 0.32, 0.6, 0.06, "arcChrD", top="arcChr", sides=28)
        k.cyl(0.0, 0.0, 0.38, 0.52, 0.06, "podGL", top="podGL", sides=28)                  # its lit ring,
        for i in range(12):                                                                 # its vents
            a = i * math.tau / 12
            k.box(0.645 * math.cos(a), 0.645 * math.sin(a), 0.1, 0.12, 0.01, 0.12, "arcBodyK", rz=a + math.pi / 2)
        k.box(0.62, -0.7, 0.0, 0.62, 0.36, 0.06, "arcBodyD", top="arcBody")                # the canister rack,
        for i in range(3):
            u = 0.42 + i * 0.2
            k.cyl(u, -0.7, 0.06, 0.08, 0.62, "arcChrD", top="arcChr", sides=12)
            k.cyl(u, -0.7, 0.14, 0.065, 0.4, "podGL" if i != 1 else "podGM", top="podGL", sides=12)
        ru, rv = -0.78, 0.22                                                                # the equipment rack,
        k.box(ru, rv, 0.0, 0.36, 0.44, 0.96, "arcBodyD", top="arcBody")
        for i in range(4):
            k.box(ru, rv + 0.222, 0.18 + i * 0.18, 0.28, 0.004, 0.12, "arcBodyK")
            k.box(ru - 0.08 + (i % 3) * 0.08, rv + 0.224, 0.22 + i * 0.18, 0.04, 0.004, 0.04,
                  ("podGL", "arcAmb", "podGL")[i % 3])
            k.box(ru + 0.182, rv - 0.12 + (i % 2) * 0.12, 0.22 + i * 0.18, 0.004, 0.04, 0.04, "podGL")
        bar(k, (ru + 0.1, rv - 0.1, 0.96), (-0.3, -0.2, z1 + 0.2), 0.07, "arcBodyK")         # its hose to the top
        bar(k, (0.3, -0.3, z1 + 0.2), (0.62, -0.7, 0.68), 0.06, "arcBodyK")
    for a in (FRONT - 1.2, FRONT + 1.2, FRONT + math.pi):                                   # the rods
        if layer == "all" or faces_front(a):
            bar(k, (0.53 * math.cos(a), 0.53 * math.sin(a), 0.38), (0.53 * math.cos(a), 0.53 * math.sin(a), z1),
                0.04, "arcChr")
    k.cyl(0.0, 0.0, z1, 0.6, 0.16, "arcBodyD", top="arcBody", sides=28)                    # the top housing,
    k.cyl(0.0, 0.0, z1 + 0.16, 0.6, 0.2, "arcShell", top="arcShellL", sides=28, rtop=0.34)
    k.cyl(0.0, 0.0, z1 + 0.04, 0.605, 0.025, "podGL", top="podGL", sides=28)
    k.cyl(0.0, 0.0, z1 + 0.36, 0.14, 0.08, "arcChrD", top="arcChr", sides=14)
    mu, mv = 0.84, 0.02                                                                      # the monitor stand
    k.cyl(mu, mv, 0.0, 0.14, 0.04, "arcBodyD", top="arcBody", sides=12)
    k.cyl(mu, mv, 0.04, 0.03, 0.66, "arcChrD", top="arcChr", sides=8)
    screen(k, mu, mv, 0.66, 0.4, 0.3, "podGL")
    if layer == "front":
        glints(k, R, z0 + 0.2, zm - 0.1)
    return k.build()


def t1(layer="all"):
    k = Bench(f"pod_t1_{layer}", FP2)
    R, z0, zm, z1 = 0.44, 0.34, 2.02, 2.12
    C = [(z0 + (zm - z0) * i / 6, R) for i in range(7)]
    if layer in ("all", "glass"):
        fluid(k, C, ("podPL", "podP", "podPD"), sides=28)
        bubbles(k, R, z0 + 0.1, zm - 0.1, "podPL", front=layer == "glass")
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, zm, R, z1 - zm, "arcGlass", top="arcGlass", sides=28)
        lathe(k, 0.0, 0.0, [(0.0, 0.8), (0.08, 0.82), (0.16, 0.7), (0.34, 0.5)], "arcShell", top="arcShellL",
              sides=32)                                                                     # the base,
        k.cyl(0.0, 0.0, 0.08, 0.825, 0.02, "podPL", top="podPL", sides=32)
    for i in range(10):                                                                      # the petals
        a = i * math.tau / 10 + 0.1
        if layer == "front" and not faces_front(a, math.pi * 0.55):
            continue
        r = 0.6
        for w, h, col, d in ((0.42, 0.95, "arcShellL", 0.0), (0.3, 0.8, "podPL", -0.025)):
            k.box((r + d) * math.cos(a), (r + d) * math.sin(a), 0.14, w, 0.04, h, col, top=col,
                  rz=a + math.pi / 2, rx=0.42, taper=0.45)
    lathe(k, 0.0, 0.0, [(z1, 0.5), (z1 + 0.08, 0.52), (z1 + 0.2, 0.44), (z1 + 0.3, 0.26), (z1 + 0.34, 0.1)],
          "arcShell", top="arcShellL", sides=28)                                             # the cap,
    k.cyl(0.0, 0.0, z1 + 0.06, 0.525, 0.02, "podPL", top="podPL", sides=28)
    k.cyl(0.0, 0.0, z1 + 0.32, 0.09, 0.1, "podPL", top="podPL", sides=12, rtop=0.05)        # its bulb
    if layer == "front":
        glints(k, R, z0 + 0.6, zm - 0.1)
    return k.build()


def t2(layer="all"):
    k = Bench(f"pod_t2_{layer}", FP2)
    R, zb, zm, z1 = 0.46, 0.5, 2.3, 2.42
    C = [(zb, 0.16), (zb + 0.06, 0.3), (zb + 0.16, 0.4), (zb + 0.3, R)] + \
        [(zb + 0.3 + (zm - zb - 0.3) * i / 5, R) for i in range(1, 6)]
    if layer in ("all", "glass"):
        fluid(k, C, ("podBL", "podB", "podBD"), sides=28)
        bubbles(k, R, zb + 0.2, zm - 0.1, "podBL", front=layer == "glass")
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, zm, R, z1 - zm, "arcGlass", top="arcGlass", sides=28)
        k.cyl(0.0, 0.0, 0.0, 0.62, 0.06, "arcBodyD", top="arcBody", sides=28)               # the pad,
        k.cyl(0.0, 0.0, 0.06, 0.5, 0.02, "podBL", top="podBL", sides=28)
        k.cyl(0.0, 0.0, 0.08, 0.3, 0.02, "arcBodyD", top="arcBodyK", sides=20)
        k.box(0.0, -0.78, 0.0, 0.5, 0.36, 0.2, "arcBodyD", top="arcBody")                   # the spine: its foot,
        pts = [(-0.78, 0.2), (-0.8, 1.2), (-0.78, 2.2), (-0.66, 2.66), (-0.4, 2.86), (-0.12, 2.88)]
        for (v0, z0), (v1, z2) in zip(pts, pts[1:]):
            bar(k, (0.0, v0, z0), (0.0, v1, z2), 0.2, "arcShell")
            bar(k, (0.0, v0 + 0.1, z0), (0.0, v1 + 0.1, z2), 0.03, "podBL")                 # its lit inner line
        for s_ in (-1, 1):                                                                   # slung cables
            bar(k, (s_ * 0.12, -0.8, 1.6), (s_ * 0.3, -0.6, 1.9), 0.04, "arcBodyK")
            bar(k, (s_ * 0.3, -0.6, 1.9), (s_ * 0.24, -0.3, z1 + 0.1), 0.04, "arcBodyK")
    k.cyl(0.0, 0.0, z1, 0.54, 0.16, "arcShell", top="arcShellL", sides=28)                  # the head it hangs by,
    k.cyl(0.0, 0.0, z1 + 0.16, 0.4, 0.22, "arcBodyD", top="arcBody", sides=28, rtop=0.18)
    k.cyl(0.0, 0.0, z1 + 0.02, 0.545, 0.025, "podBL", top="podBL", sides=28)
    k.cyl(0.0, 0.0, z1 + 0.38, 0.1, 0.12, "arcShell", top="arcShellL", sides=12)            # its hook to the spine
    for a in range(4):                                                                       # the clamps on the glass
        aa = a * math.pi / 2 + FRONT
        if layer == "all" or faces_front(aa, math.pi * 0.3):
            k.box(0.48 * math.cos(aa), 0.48 * math.sin(aa), z1 - 0.3, 0.08, 0.06, 0.32, "arcShell", top="arcShellL",
                  rz=aa + math.pi / 2)
    if layer == "front":
        glints(k, R, zb + 0.4, zm - 0.1)
    return k.build()


def jobs():
    out = []
    for v, f in (("s2b", s2b), ("t1", t1), ("t2", t2)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
