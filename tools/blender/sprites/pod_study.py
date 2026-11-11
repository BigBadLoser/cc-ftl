"""Recovery pod look study (family `pod`, preview only): a 1x1 upright tank of healing fluid, the patient floating in
it. Three sprites per design, layered as the renderer would:

  module.pod.pN         the pod whole, the fluid opaque (what is behind the patient)
  module.pod.pN.glass   the fluid's front alone, drawn translucent over the patient
  module.pod.pN.front   the parts in front of the patient (the cap, the base, the front struts), drawn over both

  p1 classic: a round base with a lit ring, a glass cylinder of green fluid, a round cap with hoses to the back
  p2 egg: an egg-shaped tank held in a white shell cradle that wraps the back, amber fluid, a halo lamp over it
  p3 industrial: a square tank in chunky posts with hazard trim, blue fluid, a breather line down from the cap

Units: world (1 = a tile), z in world units."""
from .research_kit import Bench, bar

FP1 = (1, 1)


def p1(layer="all"):
    k = Bench(f"pod_p1_{layer}", FP1)
    R, z0, z1 = 0.34, 0.24, 1.86
    if layer in ("all", "glass"):
        k.cyl(0.0, 0.0, z0, R, z1 - z0, "podG", top="podGL", sides=20)                   # the fluid,
    if layer == "glass":
        return k.build()
    if layer == "all":
        for i in range(5):                                                                # bubbles (behind)
            k.box(-0.18 + i * 0.09, -0.2, 0.5 + (i * 0.37 % 0.8), 0.04, 0.04, 0.04, "podGL")
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.44, 0.18, "arcBodyD", top="arcBody", sides=20)           # the base,
        k.cyl(0.0, 0.0, 0.18, 0.4, 0.06, "arcShell", top="arcShellL", sides=20)
        k.cyl(0.0, 0.0, 0.2, 0.37, 0.03, "podGL", top="podGL", sides=20)                 # its lit ring,
        k.box(0.0, 0.42, 0.04, 0.2, 0.04, 0.1, "arcBodyK", top="arcBodyK")                # a panel on its front,
        k.box(0.0, 0.443, 0.07, 0.14, 0.004, 0.04, "podGL")
    k.cyl(0.0, 0.0, z1, 0.4, 0.1, "arcShell", top="arcShellL", sides=20)                 # the cap,
    k.cyl(0.0, 0.0, z1 + 0.1, 0.3, 0.1, "arcBodyD", top="arcBody", sides=20)
    k.cyl(0.0, 0.0, z1 - 0.03, 0.37, 0.03, "podGL", top="podGL", sides=20)              # its lit rim,
    hoses = (((0.12, -0.2, z1 + 0.18), (0.18, -0.46, z1 + 0.06)), ((-0.12, -0.2, z1 + 0.18), (-0.2, -0.46, z1 + 0.02)))
    for a, b in (() if layer == "front" else hoses):
        bar(k, a, b, 0.06, "arcBodyK")                                                  # hoses to the back
    for u in (-0.27, 0.27):                                                               # the front struts
        bar(k, (u, 0.22, 0.22), (u, 0.22, z1), 0.04, "arcChr")
    if layer == "front":
        return k.build()
    for u in (-0.27, 0.27):                                                               # the back struts
        bar(k, (u, -0.22, 0.22), (u, -0.22, z1), 0.04, "arcChrD")
    return k.build()


def p2(layer="all"):
    k = Bench(f"pod_p2_{layer}", FP1)
    zc = 0.82
    if layer in ("all", "glass"):                                                         # the egg (fluid):
        k.cyl(0.0, 0.04, 0.26, 0.16, 0.16, "podA", top="podA", sides=20, rtop=0.3)
        k.cyl(0.0, 0.04, 0.42, 0.3, 1.04, "podA", top="podA", sides=20, rtop=0.3)
        k.cyl(0.0, 0.04, 1.46, 0.3, 0.24, "podA", top="podA", sides=20, rtop=0.22)
        k.cyl(0.0, 0.04, 1.7, 0.22, 0.14, "podA", top="podAL", sides=20, rtop=0.08)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.42, 0.12, "arcShell", top="arcShellL", sides=20)         # the plinth,
        k.cyl(0.0, 0.04, 0.12, 0.2, 0.14, "arcBodyD", top="podAL", sides=16)            # the egg's seat (lit),
        k.box(0.0, 0.38, 0.0, 0.3, 0.06, 0.1, "arcShellD", top="arcShellL")             # a step at the front,
        k.box(0.0, -0.34, 0.12, 0.62, 0.12, 1.76, "arcShell", top="arcShellL", taper=0.7)  # the cradle's back,
        for s_ in (-1, 1):
            k.box(s_ * 0.34, -0.14, 0.12, 0.1, 0.36, 1.46, "arcShell", top="arcShellL", rz=s_ * 0.6)  # its wings
            k.box(s_ * 0.31, -0.06, 0.3, 0.004, 0.16, 1.0, "podAL", rz=s_ * 0.6)        # lit seams
    k.cyl(0.0, -0.1, 1.9, 0.3, 0.04, "arcShell", top="arcShellL", sides=20)            # the halo lamp,
    k.cyl(0.0, -0.1, 1.88, 0.26, 0.02, "podAL", top="podAL", sides=20)
    bar(k, (0.0, -0.36, 1.88), (0.0, -0.36, 1.98), 0.06, "arcShell")
    bar(k, (0.0, -0.36, 1.96), (0.0, -0.1, 1.94), 0.05, "arcShell")
    return k.build()


def p3(layer="all"):
    k = Bench(f"pod_p3_{layer}", FP1)
    z0, z1, S = 0.22, 1.84, 0.62
    if layer in ("all", "glass"):
        k.box(0.0, 0.0, z0, S, S, z1 - z0, "podB", top="podBL")                           # the fluid,
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.box(0.0, 0.0, 0.0, 0.9, 0.9, 0.18, "arcBodyD", top="arcBody")                  # the base,
        for i in range(6):                                                                 # hazard trim on it
            k.box(-0.32 + i * 0.13, 0.452, 0.05, 0.05, 0.004, 0.08, "arcAmb", ry=0.6)
        k.box(0.0, 0.0, 0.18, 0.7, 0.7, 0.04, "arcChrD", top="arcChr")
        bar(k, (0.2, -0.2, z1 + 0.2), (0.38, -0.42, z1 - 0.2), 0.08, "arcBodyK")         # a hose to the back
    k.box(0.0, 0.0, z1, 0.84, 0.84, 0.12, "arcBodyD", top="arcBody")                     # the cap,
    k.box(0.0, 0.0, z1 + 0.12, 0.4, 0.4, 0.08, "arcChrD", top="arcChr")
    k.box(0.0, 0.423, z1 + 0.02, 0.5, 0.004, 0.04, "podBL")                               # a lit strip on it,
    bar(k, (0.06, 0.0, z1), (0.04, 0.06, 1.56), 0.03, "arcBodyK")                         # the breather line,
    k.box(0.04, 0.08, 1.5, 0.1, 0.06, 0.08, "arcChrD", top="arcChr")                    # its mask
    for u, v in ((0.36, 0.36), (-0.36, 0.36)):                                             # the front posts,
        k.box(u, v, 0.18, 0.12, 0.12, z1 - 0.18, "arcBodyD", top="arcBody")
        k.box(u + (0.061 if u > 0 else -0.061), v, 0.4, 0.004, 0.06, 1.2, "podBL")
    if layer == "front":
        return k.build()
    for u, v in ((0.36, -0.36), (-0.36, -0.36)):                                           # the back posts
        k.box(u, v, 0.18, 0.12, 0.12, z1 - 0.18, "arcBodyD", top="arcBody")
    return k.build()


def jobs():
    out = []
    for v, f in (("p1", p1), ("p2", p2), ("p3", p3)):
        out.append((f"module.pod.{v}", FP1, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP1, "prop", lambda f=f, layer=layer: f(layer)))
    return out
