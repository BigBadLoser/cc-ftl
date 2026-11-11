"""Recovery pod look study round 6 (family `pod`, preview only): s2 (the med column) refined three ways, the detail
built into the pod rather than set round it. 2x2, upright. Layers and helpers as round 4 (pod4_study.py); the fluid
lighter (round 5's s2b).

  u1 plinth: a stepped round plinth with a lit step edge, a chamfered base housing with the heartbeat screen set into
     its front, a sculpted top housing, two conduits running up the back of the tank between them
  u2 ribbed: lit bands round the glass, a finned base housing, the heartbeat as a curved lit readout round the top
     housing's front
  u3 octagon: the column on an octagonal platform filling the footprint, lit studs at its corners, the heartbeat
     panel sloped into its front edge; three conduits rising out of the top into the ceiling

Units: world (1 = a tile), z in world units. Local u, v in [-1, 1]; the tank stands at the centre."""
import math

from .pod4_study import FRONT, bubbles, faces_front, fluid, glints, lathe
from .research_kit import Bench, bar

FP2 = (2, 2)
R, Z0, ZM, Z1 = 0.48, 0.44, 1.96, 2.1


def tank(k, layer, z0=Z0):
    C = [(z0 + (ZM - z0) * i / 6, R) for i in range(7)]
    if layer in ("all", "glass"):
        fluid(k, C, ("podGL", "podGM", "podG"), sides=28)
        bubbles(k, R, z0 + 0.1, ZM - 0.1, "podGL", front=layer == "glass")
    if layer == "all":
        k.cyl(0.0, 0.0, ZM, R, Z1 - ZM, "arcGlass", top="arcGlass", sides=28)                # the air gap
    if layer == "front":
        glints(k, R, z0 + 0.2, ZM - 0.1)


def rods(k, layer, z0, z1, n=3, r=0.53):
    for i in range(n):
        a = FRONT + math.pi + i * math.tau / n + (math.pi / n if n % 2 == 0 else 0)
        if layer == "all" or faces_front(a, math.pi * 0.45):
            bar(k, (r * math.cos(a), r * math.sin(a), z0), (r * math.cos(a), r * math.sin(a), z1), 0.04, "arcChr")


def panel(k, r, z, w, h, tilt, glow):
    """A flat screen set into a round housing's front, tipped back by tilt, a heartbeat line on it."""
    c, s = math.cos(FRONT), math.sin(FRONT)
    k.box(r * c, r * s, z, w, 0.06, h, "arcBodyK", top="arcBodyD", rz=-FRONT, rx=-tilt)
    pts = ((0.0, 0.5), (0.3, 0.5), (0.38, 0.9), (0.46, 0.1), (0.54, 0.5), (1.0, 0.5))
    n = 0.035
    for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
        s0, s1 = (a0 - 0.5) * (w - 0.08), (a1 - 0.5) * (w - 0.08)
        z0, z1 = z + 0.04 + b0 * (h - 0.08), z + 0.04 + b1 * (h - 0.08)
        bar(k, ((r + n) * c + s0 * c, (r + n) * s - s0 * s, z0), ((r + n) * c + s1 * c, (r + n) * s - s1 * s, z1),
            0.016, glow)


def top_housing(k, z1):
    lathe(k, 0.0, 0.0, [(z1, 0.54), (z1 + 0.06, 0.63), (z1 + 0.22, 0.63), (z1 + 0.34, 0.5), (z1 + 0.4, 0.3)],
          "arcShell", top="arcShellL", sides=28)
    k.cyl(0.0, 0.0, z1 + 0.1, 0.635, 0.03, "podGL", top="podGL", sides=28)
    k.cyl(0.0, 0.0, z1 + 0.4, 0.16, 0.06, "arcChrD", top="arcChr", sides=14)


def u1(layer="all"):
    k = Bench(f"pod_u1_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.88, 0.07, "arcBodyD", top="arcBody", sides=32)              # the plinth,
        k.cyl(0.0, 0.0, 0.07, 0.76, 0.06, "arcBodyD", top="arcBody", sides=32)
        k.cyl(0.0, 0.0, 0.065, 0.885, 0.012, "podGL", top="podGL", sides=32)               # its lit step edge,
        lathe(k, 0.0, 0.0, [(0.13, 0.64), (0.34, 0.64), (0.42, 0.54)], "arcBodyD", top="arcBody", sides=28)
        k.cyl(0.0, 0.0, 0.4, 0.52, 0.04, "podGL", top="podGL", sides=28)                   # the base's lit ring
        for s_ in (-1, 1):                                                                   # the conduits up the back
            a = FRONT + math.pi + s_ * 0.45
            u, v = 0.6 * math.cos(a), 0.6 * math.sin(a)
            bar(k, (u, v, 0.3), (u, v, Z1 + 0.1), 0.08, "arcBodyD")
            for z in (0.9, 1.5):
                k.box(u * 0.92, v * 0.92, z, 0.12, 0.12, 0.05, "arcChrD", top="arcChr", rz=a)
    panel(k, 0.6, 0.15, 0.34, 0.18, 0.25, "podGL")
    rods(k, layer, 0.42, Z1)
    top_housing(k, Z1)
    return k.build()


def u2(layer="all"):
    k = Bench(f"pod_u2_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.7, 0.06, "arcBodyD", top="arcBody", sides=32)
        lathe(k, 0.0, 0.0, [(0.06, 0.6), (0.36, 0.6), (0.44, 0.52)], "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
    for i in range(16):                                                                      # the base's fins
        a = i * math.tau / 16
        if layer == "all" or faces_front(a, math.pi * 0.45):
            k.box(0.62 * math.cos(a), 0.62 * math.sin(a), 0.06, 0.04, 0.1, 0.3, "arcBodyD", top="arcBody",
                  rz=a + math.pi / 2)
    for z in (0.95, 1.45):                                                                   # the bands on the glass
        if layer == "all":
            k.cyl(0.0, 0.0, z, R + 0.012, 0.03, "arcChrD", top="arcChr", sides=28)
        for i in range(20):
            a = i * math.tau / 20
            if faces_front(a, math.pi * 0.5) and (layer == "front" or layer == "all"):
                k.box((R + 0.02) * math.cos(a), (R + 0.02) * math.sin(a), z + 0.008, 0.16, 0.012, 0.014,
                      "podGL" if layer == "front" else "arcChr", rz=a + math.pi / 2)
    rods(k, layer, 0.44, Z1, n=2)
    top_housing(k, Z1)
    beat = (0.5, 0.5, 0.5, 0.9, 0.1, 0.6, 0.5, 0.5, 0.5, 0.5)                                # the readout round it
    for i, h in enumerate(beat):
        a = FRONT - 0.5 + i * 0.11
        k.box(0.64 * math.cos(a), 0.64 * math.sin(a), Z1 + 0.13 + h * 0.06, 0.07, 0.01, 0.025, "podGL",
              rz=a + math.pi / 2)
    return k.build()


def u3(layer="all"):
    k = Bench(f"pod_u3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, 0.16, "arcBodyD", top="arcBody", sides=8)                # the platform,
        k.cyl(0.0, 0.0, 0.16, 0.84, 0.03, "arcChrD", top="arcChr", sides=8)
        for i in range(8):                                                                   # its corner studs
            a = i * math.tau / 8
            k.cyl(0.9 * math.cos(a), 0.9 * math.sin(a), 0.16, 0.04, 0.03, "podGL", top="podGL", sides=8)
        lathe(k, 0.0, 0.0, [(0.19, 0.6), (0.36, 0.6), (0.44, 0.52)], "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
    panel(k, 0.78, 0.04, 0.4, 0.13, 0.9, "podGL")                                          # sloped into the edge
    rods(k, layer, 0.44, Z1)
    top_housing(k, Z1)
    for i in range(3):                                                                       # conduits to the ceiling
        a = FRONT + math.pi + (i - 1) * 0.6
        u, v = 0.3 * math.cos(a), 0.3 * math.sin(a)
        if layer == "all":
            k.cyl(u, v, Z1 + 0.36, 0.07, 0.6, "arcBodyD", top="arcBody", sides=10)
            k.cyl(u, v, Z1 + 0.5, 0.08, 0.04, "arcChrD", top="arcChr", sides=10)
    return k.build()


def jobs():
    out = []
    for v, f in (("u1", u1), ("u2", u2), ("u3", u3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
