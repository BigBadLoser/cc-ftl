"""Recovery pod look study round 2 (family `pod`, preview only): 2x2, the patient lying in the fluid (the sleep pose),
head to -u. Layers as round 1 (pod_study.py): the pod whole, `.glass` (the fluid drawn translucent over the patient),
`.front` (the parts in front of the patient).

  q1 egg: a long egg of amber fluid lying in a white shell cradle that rises behind it, lit seams, a console at the foot
  q2 bath: a sunken bath of green fluid in a dark tub, its glass lid swung up behind, a scanner bar on a gantry over it
  q3 scan tube: a bed of blue fluid under a glass half-tube, a big lit ring scanner round its middle, a tower behind

Units: world (1 = a tile), z in world units. Local u, v in [-1, 1]."""
import math

from .research_kit import Bench, bar

FP2 = (2, 2)


def slice_vz(k, u, v, z, r, t, col, n=4):
    """A disc standing in the v-z plane about (u, v, z): n square slabs turned about u."""
    for i in range(n):
        k.box(u, v, z - r, t, r * 2 * 0.83, r * 2 * 0.83, col, top=col, rx=i * math.pi / (2 * n))


def q1(layer="all"):
    k = Bench(f"pod_q1_{layer}", FP2)
    L, R, zc, vc = 0.86, 0.38, 0.62, 0.12
    if layer in ("all", "glass"):                                                         # the egg (fluid):
        for i in range(17):
            t = -1 + i / 8
            r = R * math.sqrt(max(0.0, 1 - t * t)) * (1 + 0.12 * t)                      # (fuller at the head end)
            if r > 0.04:
                slice_vz(k, -t * L, vc, zc, r, L / 8 + 0.01, "podA" if abs(t) < 0.9 else "podAL")
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.box(0.0, 0.1, 0.0, 1.7, 0.8, 0.16, "arcShell", top="arcShellL")                  # the plinth,
        k.box(0.0, 0.1, 0.16, 1.4, 0.5, 0.12, "arcBodyD", top="podAL")                    # the lit bed under the egg,
        k.box(0.0, -0.62, 0.0, 1.8, 0.3, 1.0, "arcShell", top="arcShellL", taper=0.85)    # the cradle's back,
        k.box(0.0, -0.468, 0.3, 1.5, 0.004, 0.02, "podAL")                                # its lit seams,
        k.box(0.0, -0.468, 0.7, 1.3, 0.004, 0.02, "podAL")
        for s_ in (-1, 1):                                                                  # its arms round the ends
            k.box(s_ * 0.92, -0.2, 0.0, 0.16, 0.7, 0.9, "arcShell", top="arcShellL")
            k.box(s_ * 1.0 + s_ * 0.002, -0.2, 0.3, 0.004, 0.5, 0.02, "podAL")
        bar(k, (-0.3, -0.55, 1.0), (-0.2, -0.1, 1.06), 0.06, "arcBodyK")                  # hoses into the egg's top
        bar(k, (0.3, -0.55, 1.0), (0.2, -0.1, 1.02), 0.06, "arcBodyK")
    k.box(0.72, 0.72, 0.0, 0.22, 0.22, 0.6, "arcShell", top="arcShellL")                   # the console at the foot,
    k.box(0.72, 0.72, 0.6, 0.24, 0.2, 0.06, "arcBodyD", top="arcBody", ry=0.4)
    k.box(0.72, 0.832, 0.36, 0.14, 0.004, 0.1, "podAL")
    if layer == "front":
        k.box(0.0, 0.52, 0.0, 1.7, 0.04, 0.2, "arcShell", top="arcShellL")                 # the plinth's front lip
    return k.build()


def q2(layer="all"):
    k = Bench(f"pod_q2_{layer}", FP2)
    U, V, z0, z1 = 0.84, 0.36, 0.22, 0.6
    if layer in ("all", "glass"):
        k.box(0.0, 0.12, z0, 2 * U - 0.08, 2 * V - 0.08, z1 - z0, "podG", top="podGL")     # the fluid,
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.box(0.0, 0.12, 0.0, 2 * U + 0.2, 2 * V + 0.2, z0, "arcBodyD", top="arcBody")    # the tub,
        for s_ in (-1, 1):
            k.box(s_ * U, 0.12, z0, 0.08, 2 * V + 0.08, z1 - z0 + 0.04, "arcBodyD", top="arcBody")   # its ends,
        k.box(0.0, 0.12 - V, z0, 2 * U, 0.08, z1 - z0 + 0.04, "arcBodyD", top="arcBody")  # its back wall,
        k.box(0.0, -0.36, z1 + 0.02, 2 * U - 0.1, 0.06, 0.62, "arcGlass", top="arcChr", rx=-0.35)   # the lid, swung up,
        k.box(0.0, -0.46, z1 + 0.6, 2 * U - 0.06, 0.08, 0.05, "arcChrD", top="arcChr", rx=-0.35)
        for s_ in (-1, 1):                                                                  # the gantry:
            k.box(s_ * 0.96, -0.62, 0.0, 0.1, 0.1, 1.36, "arcBodyD", top="arcBody")
        k.box(0.0, -0.62, 1.32, 2.0, 0.12, 0.08, "arcBodyD", top="arcBody")
        bar(k, (0.2, -0.62, 1.36), (0.2, 0.1, 1.2), 0.06, "arcChrD")                       # its arm,
        k.box(0.2, 0.1, 1.08, 0.12, 0.6, 0.1, "arcBodyD", top="arcBody")                   # the scanner bar,
        k.box(0.2, 0.1, 1.07, 0.06, 0.5, 0.01, "podGL")                                     # lit beneath
    k.box(0.0, 0.12 + V, z0, 2 * U, 0.06, 0.04, "arcChrD", top="arcChr")                   # the front: its sill,
    k.box(0.0, 0.12 + V, z1, 2 * U, 0.06, 0.04, "arcChrD", top="arcChr")                   # its rim,
    k.box(0.0, 0.12 + V, 0.0, 2 * U + 0.2, 0.1, z0, "arcBodyD", top="arcBody")
    k.box(0.0, 0.17 + V + 0.002, 0.08, 1.4, 0.004, 0.03, "podGL")                          # a lit line on the tub
    for s_ in (-1, 1):
        k.box(s_ * U, 0.12 + V, z0, 0.08, 0.06, z1 - z0, "arcChrD", top="arcChr")          # its corners
    return k.build()


def q3(layer="all"):
    k = Bench(f"pod_q3_{layer}", FP2)
    vc, zb, R = 0.12, 0.34, 0.42
    if layer in ("all", "glass"):
        k.box(0.0, vc, zb, 1.7, 0.6, 0.2, "podB", top="podB")                               # the fluid bed,
        for i in range(5):                                                                  # the half-tube over it
            a = i * math.pi / 5
            k.box(0.0, vc + R * 0.8 * math.cos(a + 0.31), zb + 0.2 + R * 0.7 * math.sin(a + 0.31) - 0.01, 1.7,
                  0.26, 0.04, "podB", top="podBL", rx=a + 0.31 - math.pi / 2)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.box(0.0, vc, 0.0, 1.9, 0.8, zb, "arcBodyD", top="arcBody")                       # the base,
        k.box(0.0, -0.66, 0.0, 0.6, 0.5, 1.5, "arcShell", top="arcShellL")                  # the tower,
        k.box(0.0, -0.408, 0.5, 0.4, 0.004, 0.6, "arcBodyK")
        for i in range(4):
            k.box(0.0, -0.405, 0.6 + i * 0.12, 0.3, 0.004, 0.03, "podBL")
        bar(k, (0.0, -0.5, 1.3), (0.3, -0.2, 1.1), 0.08, "arcBodyK")                         # a cable to the ring
    ru = 0.3                                                                                 # the ring scanner:
    pts = [(vc + 0.62 * math.cos(i * math.tau / 24), zb + 0.24 + 0.62 * math.sin(i * math.tau / 24))
           for i in range(25)]
    for (v0, z0), (v1, z1) in zip(pts, pts[1:]):
        if layer == "front" and (v0 + v1) / 2 < vc:
            continue
        if min(z0, z1) < 0.02:
            continue
        bar(k, (ru, v0, z0), (ru, v1, z1), 0.22, "arcShell")
        bar(k, (ru - 0.112, v0 + (vc - v0) * 0.08, z0 + (zb + 0.24 - z0) * 0.08),
            (ru - 0.112, v1 + (vc - v1) * 0.08, z1 + (zb + 0.24 - z1) * 0.08), 0.04, "podBL")   # its lit inner edge
    if layer == "front":
        k.box(0.0, vc + 0.4, 0.0, 1.9, 0.04, zb, "arcBodyD", top="arcBody")               # the base's front
        k.box(0.0, vc + 0.422, 0.12, 1.5, 0.004, 0.03, "podBL")
    return k.build()


def jobs():
    out = []
    for v, f in (("q1", q1), ("q2", q2), ("q3", q3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
