"""Recovery pod look study round 7 (family `pod`, preview only): round 6's three med columns with their support
machinery built in: pumps, filters, pipes plumbed into the base and top housings, diagnostic readouts, status lights.
The machinery stands on the module's own plinth or platform on the two flanks the camera sees beside the tank (local
-u +v reads left, +u -v right), so it never hides the patient. Layers and helpers as round 6 (pod6_study.py).

  v1 plinth: a wider stepped plinth; on the right a pump (a finned motor drum, status lights) feeding a riser up into
     the top housing; on the left a glass filter canister in a clamp frame, a bar-graph readout on its post
  v2 ribbed: risers up both flanks from the finned base into a manifold ring under the top housing; an inline pump on
     one, an inline glass filter on the other; valves and status lights on the manifold; a lit hatch on the base
  v3 octagon: machinery bays built into the platform: a pump housing with a fan grill on the left, a bank of three
     filter canisters on the right; pipes run along the deck into the base and arc down from the top housing into both

Units: world (1 = a tile), z in world units. Local u, v in [-1, 1]; the tank stands at the centre."""
import math

from .pod4_study import lathe
from .pod6_study import Z1, panel, rods, tank, top_housing
from .research_kit import Bench, bar

FP2 = (2, 2)
L, RT = (-1, 1), (1, -1)                       # the flank directions (left, right) as (u, v) signs
D = 1 / math.sqrt(2)


def pipe(k, pts, w=0.1, col="arcChrD", flange="arcChr"):
    """A pipe through pts, a flange at each bend."""
    for p0, p1 in zip(pts, pts[1:]):
        bar(k, p0, p1, w, col)
    for p in pts[1:-1]:
        k.box(p[0], p[1], p[2] - w * 0.8, w * 1.6, w * 1.6, w * 1.6, flange, top=flange)


def lights(k, u, v, z, face, cols, step=0.06):
    """Status lights in a row on a face whose normal is face = 'u' or 'v' (+)."""
    for i, c in enumerate(cols):
        d = (i - (len(cols) - 1) / 2) * step
        if face == "u":
            k.box(u, v + d, z, 0.004, 0.03, 0.03, c)
        else:
            k.box(u + d, v, z, 0.03, 0.004, 0.03, c)


def bars(k, u, v, z, face, levels, glow="podGL"):
    """A bar-graph readout: a dark plate, a lit bar per level."""
    w = 0.03 * len(levels) + 0.04
    if face == "u":
        k.box(u, v, z, 0.02, w, 0.18, "arcBodyK", top="arcBodyK")
    else:
        k.box(u, v, z, w, 0.02, 0.18, "arcBodyK", top="arcBodyK")
    for i, h in enumerate(levels):
        d = (i - (len(levels) - 1) / 2) * 0.03
        if face == "u":
            k.box(u + 0.012, v + d, z + 0.02, 0.004, 0.018, 0.14 * h, glow)
        else:
            k.box(u + d, v + 0.012, z + 0.02, 0.018, 0.004, 0.14 * h, glow)


def pump(k, u, v, z, face, h=0.7, r=0.27):
    k.cyl(u, v, z, r, h, "arcBodyD", top="arcBody", sides=18)                              # the motor drum,
    for i in range(5):
        k.cyl(u, v, z + 0.12 + i * 0.08, r + 0.02, 0.035, "arcChrD", top="arcChr", sides=18)   # its fins,
    k.cyl(u, v, z + h, r * 0.75, 0.1, "arcShell", top="arcShellL", sides=16)               # its head,
    k.cyl(u, v, z + h + 0.1, r * 0.4, 0.06, "arcChrD", top="arcChr", sides=12)
    off = r + 0.005
    lights(k, u + (off if face == "u" else 0), v + (off if face == "v" else 0), z + h - 0.08, face,
           ("podGL", "podGL", "arcAmb"))


def filt(k, u, v, z, h=0.8, r=0.17):
    """A glass filter canister: lit fluid over a darker sediment band, chrome caps."""
    k.cyl(u, v, z, r + 0.02, 0.06, "arcChrD", top="arcChr", sides=14)
    k.cyl(u, v, z + 0.06, r, 0.1, "podG", top="podG", sides=14)
    k.cyl(u, v, z + 0.16, r, h * 0.55, "podGL", top="podGL", sides=14)
    k.cyl(u, v, z + 0.16 + h * 0.55, r, h * 0.3, "arcGlass", top="arcGlass", sides=14)
    k.cyl(u, v, z + 0.1 + h, r + 0.02, 0.06, "arcChrD", top="arcChr", sides=14)


def flank(s, r):
    return s[0] * r * D * 1.0, s[1] * r * D * 1.0


def v1(layer="all"):
    k = Bench(f"pod_v1_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, 0.07, "arcBodyD", top="arcBody", sides=32)              # the plinth,
        k.cyl(0.0, 0.0, 0.07, 0.9, 0.06, "arcBodyD", top="arcBody", sides=32)
        k.cyl(0.0, 0.0, 0.065, 0.985, 0.012, "podGL", top="podGL", sides=32)
        lathe(k, 0.0, 0.0, [(0.13, 0.64), (0.34, 0.64), (0.42, 0.54)], "arcBodyD", top="arcBody", sides=28)
        k.cyl(0.0, 0.0, 0.4, 0.52, 0.04, "podGL", top="podGL", sides=28)
        pu, pv = flank(RT, 0.7)                                                             # the pump (right):
        pump(k, pu, pv, 0.13, "u")
        pipe(k, [(pu - 0.18, pv + 0.18, 0.3), (0.42, -0.42, 0.3)])                           # into the base,
        pipe(k, [(pu, pv, 1.0), (pu, pv, 1.6), (0.5, -0.5, Z1 + 0.16)])                      # a riser to the top
        fu, fv = flank(L, 0.7)                                                              # the filter (left):
        for d in (-0.24, 0.24):
            k.box(fu + d * D, fv - d * D, 0.13, 0.08, 0.08, 1.12, "arcShell", top="arcShellL")  # its frame posts,
        k.box(fu, fv, 1.2, 0.56, 0.12, 0.08, "arcShell", top="arcShellL", rz=-math.pi / 4)
        k.box(fu, fv, 0.13, 0.56, 0.12, 0.06, "arcShell", top="arcShellL", rz=-math.pi / 4)
        filt(k, fu, fv, 0.2)
        bars(k, fu + 0.24 * D, fv - 0.24 * D + 0.045, 0.62, "v", (0.5, 0.8, 0.6, 0.9, 0.4))   # a readout on its post,
        pipe(k, [(fu, fv, 1.28), (fu, fv, 1.6), (-0.5, 0.5, Z1 + 0.16)])                     # up to the top,
        pipe(k, [(fu + 0.12, fv - 0.12, 0.26), (-0.42, 0.42, 0.26)], w=0.08)                 # out to the base
    panel(k, 0.6, 0.15, 0.34, 0.18, 0.25, "podGL")
    for i in range(5):                                                                       # lights on the step
        a = math.pi / 4 + (i - 2) * 0.16
        k.box(0.93 * math.cos(a), 0.93 * math.sin(a), 0.1, 0.03, 0.03, 0.02, "podGL" if i != 2 else "arcAmb")
    rods(k, layer, 0.42, Z1)
    top_housing(k, Z1)
    return k.build()


def v2(layer="all"):
    k = Bench(f"pod_v2_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.76, 0.06, "arcBodyD", top="arcBody", sides=32)
        lathe(k, 0.0, 0.0, [(0.06, 0.6), (0.36, 0.6), (0.44, 0.52)], "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
        for i in range(16):
            a = i * math.tau / 16
            k.box(0.62 * math.cos(a), 0.62 * math.sin(a), 0.06, 0.04, 0.1, 0.3, "arcBodyD", top="arcBody",
                  rz=a + math.pi / 2)
        k.cyl(0.0, 0.0, Z1 + 0.2, 0.7, 0.07, "arcChrD", top="arcChr", sides=28)             # the manifold ring,
        for s in (L, RT):                                                                    # the risers:
            ru, rv = flank(s, 0.68)
            bar(k, (ru, rv, 0.12), (ru, rv, Z1 + 0.2), 0.12, "arcChrD")
            k.box(ru, rv, 0.06, 0.24, 0.24, 0.14, "arcShell", top="arcShellL")               # their feet,
            k.box(ru, rv, Z1 + 0.06, 0.2, 0.2, 0.14, "arcShell", top="arcShellL")            # valves,
            k.box(ru + 0.102, rv, Z1 + 0.1, 0.004, 0.05, 0.05, "arcAmb" if s == L else "podGL")
            k.box(ru, rv + 0.102, Z1 + 0.1, 0.05, 0.004, 0.05, "podGL")
        pu, pv = flank(RT, 0.68)                                                             # the inline pump,
        k.cyl(pu, pv, 0.6, 0.2, 0.56, "arcBodyD", top="arcBody", sides=16)
        for dz in (0.0, 0.14, 0.28, 0.42, 0.56):
            k.cyl(pu, pv, 0.58 + dz, 0.22, 0.03, "arcChrD", top="arcChr", sides=16)
        lights(k, pu + 0.205, pv, 1.0, "u", ("podGL", "podGL", "arcAmb"), step=0.06)
        fu, fv = flank(L, 0.68)                                                              # the inline filter,
        filt(k, fu, fv, 0.56, h=0.6, r=0.16)
        bars(k, fu, fv + 0.18, 1.32, "v", (0.6, 0.9, 0.7, 0.5))                              # its readout
    for i in range(4):                                                                       # lights on the manifold
        a = math.pi / 4 + (i - 1.5) * 0.14
        k.box(0.705 * math.cos(a), 0.705 * math.sin(a), Z1 + 0.22, 0.03, 0.03, 0.03, ("podGL", "podGL", "arcAmb",
                                                                                         "podGL")[i])
    k.box(0.44, 0.44, 0.12, 0.26, 0.05, 0.18, "arcBodyD", top="arcBody", rz=-math.pi / 4)   # the base's hatch,
    for i, c in enumerate(("podGL", "arcAmb", "podGL")):
        d = (i - 1) * 0.06
        k.box(0.465 + d * D, 0.465 - d * D, 0.22, 0.03, 0.03, 0.03, c)
    rods(k, layer, 0.44, Z1, n=2)
    top_housing(k, Z1)
    return k.build()


def v3(layer="all"):
    k = Bench(f"pod_v3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, 0.16, "arcBodyD", top="arcBody", sides=8)                # the platform,
        k.cyl(0.0, 0.0, 0.16, 0.84, 0.03, "arcChrD", top="arcChr", sides=8)
        for i in range(8):
            a = i * math.tau / 8
            k.cyl(0.9 * math.cos(a), 0.9 * math.sin(a), 0.16, 0.04, 0.03, "podGL", top="podGL", sides=8)
        lathe(k, 0.0, 0.0, [(0.19, 0.6), (0.36, 0.6), (0.44, 0.52)], "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
        bu, bv = flank(L, 0.7)                                                               # the pump bay (left):
        k.box(bu, bv, 0.16, 0.5, 0.5, 0.62, "arcShell", top="arcShellL")
        k.box(bu, bv, 0.78, 0.46, 0.46, 0.04, "arcBodyD", top="arcBody")
        k.cyl(bu, bv, 0.82, 0.17, 0.012, "arcBodyK", top="arcBodyK", sides=16)               # its fan grill,
        for j in range(4):
            k.box(bu, bv, 0.832, 0.32, 0.02, 0.01, "arcChrD", rz=j * math.pi / 4)
        k.cyl(bu, bv, 0.832, 0.05, 0.02, "podGL", top="podGL", sides=10)
        k.box(bu, bv + 0.252, 0.3, 0.36, 0.004, 0.36, "arcBodyD")                            # its panel: a readout,
        bars(k, bu - 0.06, bv + 0.25, 0.4, "v", (0.7, 0.5, 0.9, 0.6))
        lights(k, bu + 0.11, bv + 0.256, 0.58, "v", ("podGL", "arcAmb"), step=0.06)          # and lights
        fu, fv = flank(RT, 0.74)                                                             # the filter bank (right):
        k.box(fu, fv, 0.16, 0.5, 0.26, 0.1, "arcShell", top="arcShellL", rz=-math.pi / 4)
        for j in (-1, 0, 1):
            filt(k, fu + j * 0.15 * D, fv - j * 0.15 * D, 0.26, h=0.6, r=0.075)
        k.box(fu, fv, 0.98, 0.5, 0.16, 0.08, "arcShell", top="arcShellL", rz=-math.pi / 4)   # its manifold,
        for j, c in ((-1, "podGL"), (0, "podGL"), (1, "arcAmb")):
            k.box(fu + j * 0.15 * D + 0.06, fv - j * 0.15 * D + 0.06, 1.0, 0.03, 0.03, 0.03, c)
        pipe(k, [(fu - 0.12, fv + 0.12, 0.26), (0.44, -0.44, 0.26)])                         # a pipe along the deck,
        for s, top in ((L, 0.84), (RT, 1.06)):                                                 # and down from the top
            u0, v0 = flank(s, 0.6)
            u1, v1_ = flank(s, 0.7)
            pipe(k, [(u0, v0, Z1 + 0.2), (u1, v1_, Z1 + 0.1), (u1, v1_, top + 0.02)])
    panel(k, 0.78, 0.04, 0.4, 0.13, 0.9, "podGL")
    rods(k, layer, 0.44, Z1)
    top_housing(k, Z1)
    return k.build()


def jobs():
    out = []
    for v, f in (("v1", v1), ("v2", v2), ("v3", v3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
