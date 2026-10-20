"""Floor clutter (family `clutter`): one-tile props with no footprint, drawn on the floor tile they stand on (modkit
local frame, origin = the tile centre at floor level).

  prop.barrel / .hazard / .chem   a steel drum, a hazard-yellow one, a navy chemical drum
  prop.barrels                    three drums, one lying on its side
  prop.crates                     a loose pile: two crates askew, a small one on top, a case leaning on them
  prop.plant.bush / .palm         potted plants: a leafy bush, a tall palm
  prop.chair.toppled              the mess chair (mess.py) knocked over onto its side
  prop.toolcart                   a red rolling tool cart: drawers, casters, a push handle, tools on top"""
import math
import random

import bpy

from . import mess
from .modkit import K, case, crate

DRUM = {"": ("plate", "steelD", "sole"), "hazard": ("hazY", "hazK", "hazY"), "chem": ("navy", "plate", "blueGrey")}


DR, DH = 0.21, 0.72                       # drum radius, height (about half a crew member)


def _drum(k, u, v, kind):
    body, band, top = DRUM[kind]
    k.cyl(u, v, 0.0, DR, DH, body, top=top, sides=16)
    for z in (0.2, 0.5):
        k.cyl(u, v, z, DR + 0.006, 0.035, band, sides=16)
    k.cyl(u + 0.09, v - 0.06, DH, 0.035, 0.02, band, sides=6)                         # bung
    if kind == "hazard":
        k.box(u, v + DR + 0.003, 0.29, 0.14, 0.012, 0.12, "hazK")                       # warning label
    elif kind == "chem":
        k.box(u, v + DR + 0.003, 0.27, 0.16, 0.012, 0.15, "medWhite")
        k.box(u, v + DR + 0.01, 0.32, 0.07, 0.012, 0.05, "medRed")


def _drum_lying(u, v, kind, rz):
    """A drum on its side (robot_kit's true cylinders), long axis turned rz in the local frame."""
    from .robot_kit import Rig
    body, band, top = DRUM[kind]
    rig = Rig(f"drum_{kind}")
    p = rig.part("root")
    rot = (0, 0, -math.degrees(rz))                                                   # character x = -u
    ca, sa = math.cos(rz), math.sin(rz)
    p.cyl((-u, v, DR), DR, DH, body, axis="x", rot=rot, top=top, sides=16)
    for t in (-0.15, 0.15):
        p.cyl((-(u + ca * t), v + sa * t, DR), DR + 0.006, 0.035, band, axis="x", rot=rot, sides=16)
    rig.build()
    return rig.objects()


def barrel(kind=""):
    k = K(f"barrel_{kind}", (1, 1))
    _drum(k, 0, 0, kind)
    return k.build()


def barrels():
    k = K("barrels", (1, 1))
    _drum(k, -0.2, -0.2, "")
    _drum(k, 0.24, -0.22, "chem")
    return k.build() + _drum_lying(0.0, 0.28, "hazard", 0.35)


def crates():
    k = K("crates", (1, 1))
    crate(k, -0.12, -0.12, 0.0, 0.46, "steel", rz=0.2)
    crate(k, 0.22, 0.16, 0.0, 0.4, "rust", rz=-0.35)
    crate(k, -0.1, -0.1, 0.46 * 0.85, 0.28, "hivis", rz=0.6)
    case(k, 0.3, -0.22, 0.0, 0.3, 0.12, 0.24, "navy", rz=1.2)
    return k.build()


def _leaves(k, u, v, z, n, s, h, rnd, cols=("alG", "xnFL", "xnF")):
    for i in range(n):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3)
        r = s * rnd.uniform(0.25, 0.6)
        k.box(u + r * math.cos(a), v + r * math.sin(a), z + h * rnd.uniform(0.1, 1.0), s * 0.8, s * 0.38, 0.04,
              cols[i % len(cols)], rz=a, rx=rnd.uniform(-0.5, 0.5))


def plant(kind):
    k = K(f"plant_{kind}", (1, 1))
    rnd = random.Random(7 if kind == "bush" else 11)
    k.cyl(0, 0, 0.0, 0.17, 0.3, "plate", top="leather", sides=12, rtop=0.21)            # pot, soil
    k.cyl(0, 0, 0.27, 0.215, 0.04, "steelL", sides=12)                                  # its rim
    if kind == "bush":
        _leaves(k, 0, 0, 0.3, 26, 0.26, 0.36, rnd)
        k.box(0, 0, 0.58, 0.22, 0.22, 0.1, "alG", rz=0.4)
    else:                                                                             # a palm: stems, fronds
        for i in range(5):
            a = i * 1.26 + 0.3
            tu, tv = 0.08 * math.cos(a), 0.08 * math.sin(a)
            k.box(tu, tv, 0.3, 0.03, 0.03, 0.55 + 0.12 * (i % 2), "xnF", rx=0.2 * math.cos(a), rz=a)
            for j in range(4):
                r = 0.1 + j * 0.07
                k.box(r * math.cos(a), r * math.sin(a), 0.82 - j * 0.07 + 0.08 * (i % 2), 0.12, 0.05, 0.03,
                      ("alG", "xnFL")[j % 2], rz=a, rx=-0.35)
    return k.build()


def chair_toppled():
    objs = mess.chair(0)
    for o in objs:                                                                    # on its side, turned a little
        o.rotation_euler = (0, math.pi / 2 - 0.1, 0.5)
    bpy.context.view_layer.update()
    zmin = min((o.matrix_world @ v.co).z for o in objs for v in o.data.vertices)
    for o in objs:
        o.location.z -= zmin
    bpy.context.view_layer.update()
    return objs


def toolcart():
    k = K("toolcart", (1, 1))
    for su in (-1, 1):                                                                # casters
        for sv in (-1, 1):
            k.box(su * 0.26, sv * 0.17, 0.0, 0.05, 0.05, 0.08, "dark")
    k.box(0, 0, 0.08, 0.66, 0.44, 0.5, "medRed", top="rust", bevel=0.015)               # body
    for i in range(3):                                                                # drawers
        k.box(0, 0.222, 0.14 + i * 0.13, 0.58, 0.012, 0.1, "rust")
        k.box(0, 0.232, 0.18 + i * 0.13, 0.22, 0.02, 0.025, "steelL")
    k.box(0, 0, 0.58, 0.7, 0.48, 0.04, "steelD", top="steel", bevel=0.01)              # top tray
    for su in (-1, 1):
        k.box(su * 0.34, 0, 0.62, 0.02, 0.48, 0.05, "steelD")
    k.box(-0.38, 0, 0.58, 0.04, 0.04, 0.32, "steelL")                                   # push handle
    k.box(-0.38, -0.2, 0.88, 0.04, 0.04, 0.04, "steelL")
    k.box(-0.38, 0.2, 0.88, 0.04, 0.04, 0.04, "steelL")
    k.box(-0.38, 0, 0.9, 0.04, 0.44, 0.04, "steelL")
    k.box(0.1, 0.05, 0.62, 0.24, 0.05, 0.03, "steelL", rz=0.3)                          # a spanner,
    k.box(-0.12, -0.08, 0.62, 0.16, 0.08, 0.06, "hazY", top="hazK")                     # a meter,
    k.box(0.2, -0.12, 0.62, 0.05, 0.18, 0.03, "polyB", rz=-0.4)                         # a screwdriver
    return k.build()


SPRITES = [("prop.barrel", (1, 1), "prop", lambda: barrel("")),
           ("prop.barrel.hazard", (1, 1), "prop", lambda: barrel("hazard")),
           ("prop.barrel.chem", (1, 1), "prop", lambda: barrel("chem")),
           ("prop.barrels", (1, 1), "prop", barrels),
           ("prop.crates", (1, 1), "prop", crates),
           ("prop.plant.bush", (1, 1), "prop", lambda: plant("bush")),
           ("prop.plant.palm", (1, 1), "prop", lambda: plant("palm")),
           ("prop.chair.toppled", (1, 1), "prop", chair_toppled),
           ("prop.toolcart", (1, 1), "prop", toolcart)]
