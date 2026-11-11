"""Recovery pod look study round 13 (family `pod`, preview only): three new concepts, no corner machinery.

  n1 cage      six ribs run up the outside of the round base housing, stand off the glass, and bend over the top housing
               to a hub: the frame that holds the tank is the whole machine
  n2 alcove    a curved back shell joins the base and top housings into one body; the tank stands in its niche, the
               shell's two lit edges framing it
  n3 monolith  no frame: a heavy stepped dark base, the glass column standing free on it, a slim dark cap ring

Layers as round 1 (pod_study.py): `.front` holds the top housing and what stands in front of or beside the tank, never
what is behind it (it would paint over the patient). Units: world (1 = a tile), z in world units."""
import math

from .pod10_study import BLUE, GREEN, R, RH, Z0, Z1, ekg, tank
from .pod12_study import prism
from .pod4_study import FRONT
from .pod8_study import at, lamp
from .research_kit import Bench

FP2 = (2, 2)


def side(a):
    """How far round from the front a direction is (0 front, pi back)."""
    return abs((a - FRONT + math.pi) % math.tau - math.pi)


def stepped(k, tiers, body, top, sides=40):
    """Flat round tiers: (radius, height) from the floor up. -> the top z."""
    z = 0.0
    for r, h in tiers:
        k.cyl(0.0, 0.0, z, r, h, body, top=top, sides=sides)
        z += h
    return z


def n1(layer="all"):
    """Cage: six ribs hug the base housing, stand off the glass between the housings, hug the top housing and run over
    it to the hub."""
    k = Bench(f"pod_n1_{layer}", FP2)
    tank(k, layer, GREEN)
    if layer == "glass":
        return k.build()
    zp, zh = 0.1, Z1 + 0.2
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, zp, "arcBodyD", top="arcBody", sides=40)                  # the plinth,
        k.cyl(0.0, 0.0, zp, RH, Z0 - 0.08 - zp, "arcShellD", top="arcShell", sides=36)       # the base housing,
        k.cyl(0.0, 0.0, Z0 - 0.08, RH - 0.06, 0.08, "arcShellD", top="arcShell", sides=36)
        k.cyl(0.0, 0.0, Z0 - 0.1, RH + 0.006, 0.014, "podGL", top="podGL", sides=36)
        k.cyl(0.0, 0.0, Z0 - 0.02, R + 0.04, 0.03, "podGL", top="podGL", sides=36)
        ekg(k, RH, 0.17, "podGL", a0=FRONT - 0.4, a1=FRONT + 0.4, n=18)
    k.cyl(0.0, 0.0, Z1, RH, zh - Z1, "arcShellD", top="arcShell", sides=36)                  # the top housing,
    k.cyl(0.0, 0.0, Z1 + 0.06, RH + 0.006, 0.03, "podGL", top="podGL", sides=36)
    k.cyl(0.0, 0.0, zh, 0.6, 0.06, "arcShellD", top="arcShell", sides=36)
    RR, T, Wr = 0.85, 0.07, 0.09                                                               # the ribs: radius, depth,
    zt = zh + 0.08                                                                             # width; their top
    for i in range(6):
        a = FRONT + math.radians(30 + 60 * i)
        z0 = Z1 if layer == "front" and side(a) > math.radians(100) else zp                   # (behind the tank)
        k.box(*at(a, RR), z0, T, Wr, zt - z0, "arcShell", top="arcShellL", rz=a)             # up the side,
        ri = RR - T / 2
        k.box(*at(a, (0.2 + ri) / 2), zh, ri - 0.2, Wr, zt - zh, "arcShell", top="arcShellL", rz=a)
        if side(a) < math.radians(100):                                                        # over the top
            k.box(*at(a, RR + T / 2 + 0.004), Z0 + 0.2, 0.008, 0.03, Z1 - Z0 - 0.4, "podGL", rz=a)  # a lit line
    k.cyl(0.0, 0.0, zh, 0.22, zt - zh + 0.04, "arcShellD", top="arcShell", sides=24)         # the hub,
    k.cyl(0.0, 0.0, zt + 0.04, 0.12, 0.03, "podGL", top="podGL", sides=16)
    for i, c in enumerate(("podGL", "arcAmb")):
        lamp(k, *at(FRONT + (i - 0.5) * 0.36, RH + 0.03), Z1 + 0.14, c, 0.05)
    return k.build()


def shell(k, a0, a1, r0, r1, z, h, col, top, n):
    """A curved wall: the annulus r0..r1 from angle a0 to a1, in n convex pieces."""
    for i in range(n):
        b0, b1 = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        prism(k, [at(b0, r0), at(b1, r0), at(b1, r1), at(b0, r1)], z, h, col, top)


def n2(layer="all"):
    """Alcove: a back shell, the base and top housings' own radius, joins them; the tank stands in its niche."""
    k = Bench(f"pod_n2_{layer}", FP2)
    tank(k, layer, BLUE)
    if layer == "glass":
        return k.build()
    RO, RI, E = 0.92, 0.72, math.radians(96)                                                   # shell radii, edge angle
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, 0.1, "arcBodyD", top="arcBody", sides=40)                 # the plinth,
        k.cyl(0.0, 0.0, 0.1, RO, Z0 - 0.18, "arcShellD", top="arcShell", sides=40)           # the base housing,
        k.cyl(0.0, 0.0, Z0 - 0.08, RO - 0.12, 0.08, "arcShellD", top="arcShell", sides=40)
        k.cyl(0.0, 0.0, Z0 - 0.1, RO + 0.006, 0.014, "podBL", top="podBL", sides=40)
        k.cyl(0.0, 0.0, Z0 - 0.02, R + 0.04, 0.03, "podBL", top="podBL", sides=40)
        ekg(k, RO, 0.18, "podBL", a0=FRONT - 0.5, a1=FRONT + 0.5)
        shell(k, FRONT + E + 0.25, FRONT + math.tau - E - 0.25, RI, RO, Z0 - 0.08, Z1 - Z0 + 0.08,
              "arcShellD", "arcShell", 14)                                                     # the shell's back,
    for s in (1, -1):                                                                          # its ends (beside the
        a0, a1 = FRONT + s * E, FRONT + s * (E + 0.25)                                         # tank: in .front too)
        shell(k, min(a0, a1), max(a0, a1), RI, RO, Z0 - 0.08, Z1 - Z0 + 0.08, "arcShellD", "arcShell", 2)
        eu, ev = at(FRONT + s * E, (RI + RO) / 2)                                              # a lit strip on the end
        nu, nv = at(FRONT + s * (E - math.pi / 2), 0.006)                                      # (off it, toward front)
        k.box(eu + nu, ev + nv, Z0 + 0.12, 0.06, 0.008, Z1 - Z0 - 0.24, "podBL", rz=FRONT + s * E)
    k.cyl(0.0, 0.0, Z1, RO, 0.22, "arcShellD", top="arcShell", sides=40)                     # the top housing,
    k.cyl(0.0, 0.0, Z1 + 0.07, RO + 0.006, 0.03, "podBL", top="podBL", sides=40)
    stepped_z = Z1 + 0.22
    for r, h in ((0.7, 0.08), (0.42, 0.06)):
        k.cyl(0.0, 0.0, stepped_z, r, h, "arcShellD", top="arcShell", sides=36)
        stepped_z += h
    k.cyl(0.0, 0.0, stepped_z, 0.16, 0.03, "podBL", top="podBL", sides=16)
    for i, c in enumerate(("podBL", "podBL", "arcAmb")):
        lamp(k, *at(FRONT + (i - 1) * 0.3, RO + 0.03), Z1 + 0.15, c, 0.05)
    return k.build()


def n3(layer="all"):
    """Monolith: a heavy stepped dark base with the machinery in it, the glass standing free, a slim dark cap."""
    k = Bench(f"pod_n3_{layer}", FP2)
    tank(k, layer, GREEN)
    if layer == "glass":
        return k.build()
    if layer == "all":
        z = stepped(k, ((0.98, 0.08), (0.9, 0.14)), "arcBodyD", "arcBody")                     # the steps,
        k.cyl(0.0, 0.0, 0.075, 0.985, 0.01, "arcChrD", top="arcChr", sides=40)
        k.cyl(0.0, 0.0, z, 0.78, Z0 - z, "arcBodyD", top="arcBody", sides=40)                 # the drum,
        k.cyl(0.0, 0.0, z + 0.03, 0.786, 0.02, "podGL", top="podGL", sides=40)               # a lit seam at its foot,
        k.cyl(0.0, 0.0, Z0 - 0.04, R + 0.06, 0.04, "arcChrD", top="arcChr", sides=36)         # the glass's collar,
        k.cyl(0.0, 0.0, Z0 - 0.01, R + 0.02, 0.02, "podGL", top="podGL", sides=36)
        for i, c in enumerate(("podGL", "podGL", "arcAmb")):                                  # status lamps
            lamp(k, *at(FRONT + (i - 1) * 0.24, 0.9), 0.14, c, 0.05)
    k.cyl(0.0, 0.0, Z1 - 0.02, R + 0.02, 0.03, "podGL", top="podGL", sides=36)              # the cap: a lit ring,
    k.cyl(0.0, 0.0, Z1, 0.72, 0.16, "arcBodyD", top="arcBody", sides=36)                     # its ring,
    k.cyl(0.0, 0.0, Z1 + 0.16, 0.5, 0.06, "arcBodyD", top="arcBody", sides=36)
    k.cyl(0.0, 0.0, Z1 + 0.22, 0.2, 0.04, "arcChrD", top="arcChr", sides=20)
    k.cyl(0.0, 0.0, Z1 + 0.26, 0.1, 0.02, "podGL", top="podGL", sides=14)
    return k.build()


def jobs():
    out = []
    for v, f in (("n1", n1), ("n2", n2), ("n3", n3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out

