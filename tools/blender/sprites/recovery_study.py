"""Recovery pod look study (family `recovery`, preview only): a 2x2 healing tank, a crew member floating upright in its
fluid. Front = +v. Each design is two sprites at r0, so the game can draw the patient between them:

  module.recovery.<v>         the pod with its fluid column (opaque), drawn under the patient
  module.recovery.<v>.front   drawn over the patient: the fluid and glass in front of them (translucent film, shine and
                              bubbles) and the cap, which stands in front of the patient's head

  p1 clinic tube: a white round plinth and cap, a vitals tower at the right, a low console at the left
  p2 reservoir rig: a dark eight-sided skid and a heavy cap, two fluid reservoirs piped into the tank, amber lights
  p3 alcove: the tank set in a tall white half-shell with a hood over it, light strips down the shell's edges

The tank's axis is the middle of the footprint. The patient's feet float at FLOAT over the floor."""
import math

import numpy as np

from . import core, env_build as E, post
from .medbay import trace
from .modkit import K
from .research_bench import over
from .research_kit import bar

PAL = "recovery"
FP = (2, 2)
R = 0.44                                            # the fluid column's radius
Z0, Z1 = 0.26, 2.22                                 # the column, from the plinth's top to the cap
FLOAT = 0.32                                        # the patient's feet (the preview lifts the crew sprite by this)
FILM_A, SHINE_A = 64, 150                           # the front layer's alphas: the fluid film, shine and bubbles
SIDES = 24
BUBBLES = ((-0.2, 0.5), (-0.14, 0.95), (0.22, 0.7), (0.17, 1.3), (-0.24, 1.55), (0.05, 1.75), (0.26, 1.1),
           (-0.05, 0.4))                            # (across the tank, z)


def column(k, glow="recGlow"):
    """The fluid column and the light under it."""
    k.cyl(0, 0, Z0, R, Z1 - Z0, "recFl", top="recFlL", sides=SIDES)
    k.cyl(0, 0, Z0, R + 0.005, 0.05, glow, top=glow, sides=SIDES)


def film():
    k = K("rec_film", FP)
    k.cyl(0, 0, Z0 + 0.05, R + 0.012, Z1 - Z0 - 0.05, "recFilm", top="recFilm", sides=SIDES)
    return k.build()


def shine():
    """Two streaks down the glass and a scatter of bubbles in front of the patient."""
    k = K("rec_shine", FP)
    for a, w, z0, z1 in ((1.75, 0.07, 0.5, 1.95), (1.45, 0.03, 0.7, 1.6), (-0.15, 0.03, 0.9, 1.9)):
        k.box((R + 0.02) * math.cos(a), (R + 0.02) * math.sin(a), z0, w, 0.01, z1 - z0, "recShine", rz=a + math.pi / 2)
    for s, z in BUBBLES:                                               # (s runs across the screen: along u - v)
        k.box(s * 0.7 + 0.3, -s * 0.7 + 0.3, z, 0.03, 0.03, 0.025, "recShine")
    return k.build()


def screen(k, u, v, z, w, h, face="v", pulse=True):
    """A dark screen on a +v (or +u) face with a heartbeat trace."""
    if face == "v":
        k.box(u, v, z, w, 0.02, h, "dark")
        put = lambda a, b: k.box(u + a, v + 0.012, z + h / 2 + b, 0.014, 0.012, 0.014, "green")      # noqa: E731
    else:
        k.box(u, v, z, 0.02, w, h, "dark")
        put = lambda a, b: k.box(u + 0.012, v - a, z + h / 2 + b, 0.012, 0.014, 0.014, "green")      # noqa: E731
    if pulse:
        s = w / 0.34
        trace(put, [(a * s, b * s) for a, b in ((-0.15, 0.0), (-0.07, 0.0), (-0.02, 0.1), (0.04, -0.06), (0.08, 0.0),
                                                (0.15, 0.0))])


def cross(k, u, v, z, face="v", s=1.0):
    a, b = 0.14 * s, 0.045 * s
    for su, sz, dz in ((a, b, (a - b) / 2), (b, a, 0)):
        if face == "v":
            k.box(u, v, z + dz, su, 0.02, sz, "medRed")
        else:
            k.box(u, v, z + dz, 0.02, su, sz, "medRed")


# ---- p1: clinic tube ------------------------------------------------------------------------------------------------
def p1_back():
    k = K("rec_p1", FP)
    k.cyl(0, 0, 0.0, 0.9, 0.06, "dark", sides=SIDES)
    k.cyl(0, 0, 0.06, 0.94, 0.12, "medWhite", top="plate", sides=SIDES)
    k.cyl(0, 0, 0.1, 0.945, 0.03, "cyan", sides=SIDES)                                  # light ring round the plinth
    k.cyl(0, 0, 0.18, 0.7, 0.05, "steel", top="steelL", sides=SIDES)
    k.cyl(0, 0, 0.23, R + 0.07, 0.05, "steelD", top="steel", sides=SIDES)               # collar
    column(k)
    # vitals tower, right (+u, -v): a monitor on its +v face
    k.box(0.72, -0.5, 0.18, 0.3, 0.3, 1.25, "medWhite", top="plate", bevel=0.015)
    k.box(0.72, -0.34, 0.92, 0.26, 0.04, 0.36, "gmD", bevel=0.01)
    screen(k, 0.72, -0.315, 0.95, 0.22, 0.3)
    cross(k, 0.72, -0.345, 0.55)
    for j, col in enumerate(("green", "cyan")):
        k.box(0.67 + j * 0.1, -0.345, 0.8, 0.05, 0.012, 0.04, col)
    # console, left (-u, +v): a sloped panel facing +u... toward the tank's front
    k.box(-0.62, 0.62, 0.18, 0.3, 0.3, 0.55, "medWhite", top="plate", bevel=0.015)
    k.box(-0.62, 0.62, 0.73, 0.34, 0.34, 0.06, "gmD", top="dark", rx=0.35)
    k.box(-0.62, 0.64, 0.775, 0.24, 0.2, 0.02, "cyan", top="cyan", rx=0.35)
    return k.build()


def p1_cap():
    k = K("rec_p1_cap", FP)
    k.cyl(0, 0, Z1, R + 0.08, 0.06, "steelD", top="steel", sides=SIDES)
    k.cyl(0, 0, Z1 + 0.06, R + 0.1, 0.12, "medWhite", top="plate", sides=SIDES)
    k.cyl(0, 0, Z1 + 0.1, R + 0.105, 0.025, "cyan", sides=SIDES)
    k.cyl(0, 0, Z1 + 0.18, R + 0.02, 0.08, "plate", top="medWhite", sides=SIDES, rtop=R - 0.14)
    k.cyl(0, 0, Z1 + 0.26, 0.14, 0.07, "steelD", top="steel", sides=10)
    bar(k, (0.1, -0.05, Z1 + 0.3), (0.6, -0.42, Z1 + 0.34), 0.05, "steelD")             # the feed line to the tower
    bar(k, (0.6, -0.42, Z1 + 0.34), (0.7, -0.5, 1.43), 0.05, "steelD")
    return k.build()


# ---- p2: reservoir rig ----------------------------------------------------------------------------------------------
def p2_back():
    k = K("rec_p2", FP)
    k.cyl(0, 0, 0.0, 0.98, 0.14, "gmD", top="gm", sides=8)
    k.cyl(0, 0, 0.14, 0.82, 0.06, "steelD", top="steel", sides=8)
    k.cyl(0, 0, 0.2, R + 0.1, 0.06, "dark", top="steelD", sides=SIDES)
    column(k, "recGlowA")
    for su, sv in ((1, -1), (-1, 1)):                                                   # reservoirs at both sides
        u, v = su * 0.66, sv * 0.52
        k.cyl(u, v, 0.14, 0.2, 0.1, "steelD", top="steel", sides=12)
        k.cyl(u, v, 0.24, 0.17, 0.7, "recFlD", top="recFl", sides=12)
        k.cyl(u, v, 0.94, 0.2, 0.08, "steelD", top="steel", sides=12)
        k.cyl(u, v, 0.5, 0.175, 0.04, "steelD", sides=12)
        k.box(u, v, 1.02, 0.08, 0.08, 0.06, "hivis")
        bar(k, (u, v, 0.98), (u * 0.75, v * 0.75, 0.4), 0.06, "gmD")                    # pipe into the tank's foot
        bar(k, (u * 0.75, v * 0.75, 0.4), (u * 0.62, v * 0.62, 0.22), 0.06, "gmD")
    k.box(0.5, 0.62, 0.14, 0.34, 0.2, 0.3, "gmD", top="gm", bevel=0.01)                 # a control box at the front
    screen(k, 0.5, 0.72, 0.2, 0.26, 0.18)
    for j, col in enumerate(("hivis", "green", "hivis")):
        k.box(-0.6 + j * 0.12, -0.2 + j * 0.12, 0.2, 0.05, 0.05, 0.03, col)
    return k.build()


def p2_cap():
    k = K("rec_p2_cap", FP)
    k.cyl(0, 0, Z1, R + 0.1, 0.1, "dark", top="steelD", sides=SIDES)
    k.cyl(0, 0, Z1 + 0.1, R + 0.14, 0.14, "gmD", top="gm", sides=8)
    k.cyl(0, 0, Z1 + 0.15, R + 0.145, 0.03, "hivis", sides=8)
    k.cyl(0, 0, Z1 + 0.24, 0.3, 0.1, "steelD", top="steel", sides=10)
    k.cyl(0.16, -0.1, Z1 + 0.34, 0.07, 0.12, "steel", top="steelL", sides=8)
    k.cyl(-0.14, 0.08, Z1 + 0.34, 0.09, 0.06, "dark", top="steelD", sides=8)
    return k.build()


# ---- p3: alcove -----------------------------------------------------------------------------------------------------
SHELL_R, SHELL_H = 0.84, 2.3
ARC0, ARC1 = math.radians(128), math.radians(322)       # the shell's arc: the half of the tank away from the camera


def p3_back():
    k = K("rec_p3", FP)
    k.box(0, 0, 0.0, 1.92, 1.92, 0.06, "dark")
    k.box(0, 0, 0.06, 1.96, 1.96, 0.12, "medWhite", top="plate", bevel=0.015)
    k.box(0.4, 0.4, 0.18, 1.1, 1.1, 0.03, "steel", top="steelL")                        # a tread plate at the front
    k.box(0.99, 0.2, 0.1, 0.012, 1.3, 0.04, "hivis")
    k.box(0.2, 0.99, 0.1, 1.3, 0.012, 0.04, "hivis")
    n = 22
    seg = (ARC1 - ARC0) * SHELL_R / n * 1.12
    for i in range(n):                                                                  # the shell
        a = ARC0 + (ARC1 - ARC0) * (i + 0.5) / n
        k.box(SHELL_R * math.cos(a), SHELL_R * math.sin(a), 0.18, seg, 0.12, SHELL_H - 0.18, "medWhite", top="plate",
              rz=a + math.pi / 2)
    for a in (ARC0, ARC1):                                                              # its edges: a light strip each
        u, v = SHELL_R * math.cos(a), SHELL_R * math.sin(a)
        k.box(u, v, 0.18, 0.16, 0.16, SHELL_H - 0.18, "plate", top="medWhite", rz=a)
        k.box(u + 0.06, v + 0.06, 0.4, 0.05, 0.05, SHELL_H - 0.8, "cyan", rz=a)
    k.cyl(0, 0, 0.18, R + 0.1, 0.08, "steelD", top="steel", sides=SIDES)
    column(k)
    u, v = SHELL_R * math.cos(ARC1), SHELL_R * math.sin(ARC1)                           # a monitor on the right edge
    k.box(u + 0.1, v + 0.1, 1.05, 0.3, 0.05, 0.3, "gmD", rz=math.radians(-20))
    cross(k, SHELL_R * math.cos(ARC0), SHELL_R * math.sin(ARC0) + 0.09, 1.3)
    return k.build()


def p3_cap():
    k = K("rec_p3_cap", FP)
    k.cyl(0, 0, Z1, R + 0.08, 0.08, "steelD", top="steel", sides=SIDES)
    k.cyl(0, 0, Z1 + 0.08, SHELL_R + 0.05, 0.12, "medWhite", top="plate", sides=SIDES)   # the hood
    k.cyl(0, 0, Z1 + 0.2, SHELL_R - 0.1, 0.07, "plate", top="medWhite", sides=SIDES, rtop=SHELL_R - 0.3)
    k.cyl(0, 0, Z1 + 0.1, SHELL_R + 0.055, 0.025, "cyan", sides=SIDES)
    return k.build()


DESIGNS = {v: (back, ((film, FILM_A), (shine, SHINE_A), (cap, 255)))
           for v, (back, cap) in (("p1", (p1_back, p1_cap)), ("p2", (p2_back, p2_cap)), ("p3", (p3_back, p3_cap)))}


def layer(mask, objs, alpha):
    """`objs` rendered alone with `mask` as holdout, every px at `alpha`: an item on the sprite's origin."""
    for o in mask:
        o.is_holdout = True
    xmin, xmax, ymin, ymax = core.extent_px(objs + mask)
    W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, E.SS, 8, alpha == 255)
    grgb, _ = core.render(W, H, "glow")
    g = post.glow_down(grgb, E.SS, 3)
    al = np.where(op, alpha, 0).astype(np.uint8)
    return E.crop_item("x", FP, E._pad1(c), E._pad1(op), E._pad1(g), (W + 2) // 2, (H + 2) // 2, np.pad(al, 1))


def job(v, designs):
    def run(v=v, designs=designs):
        back, layers = designs[v]
        core.clear_scene_meshes()
        post.select(PAL)
        c, op, g, ox, oy, _ = E.render_sprite("x", "prop", back())
        out = [E.crop_item(f"module.recovery.{v}", FP, c, op, g, ox, oy)]
        front = None
        for build, alpha in layers:
            core.clear_scene_meshes()
            post.select(PAL)
            it = layer(back(), build(), alpha)
            front = it if front is None else over(front, it)
        front["id"], front["fp"] = f"module.recovery.{v}.front", FP
        return out + [front]
    return run


def jobs():
    from . import recovery_study2, recovery_study3, recovery_study4, recovery_study5, recovery_study6
    return ([job(v, DESIGNS) for v in DESIGNS] + [job(v, recovery_study2.DESIGNS) for v in recovery_study2.DESIGNS]
            + [job(v, recovery_study3.DESIGNS) for v in recovery_study3.DESIGNS]
            + [job(v, recovery_study4.DESIGNS) for v in recovery_study4.DESIGNS]
            + [job(v, recovery_study5.DESIGNS) for v in recovery_study5.DESIGNS]
            + [job(v, recovery_study6.DESIGNS) for v in recovery_study6.DESIGNS])
