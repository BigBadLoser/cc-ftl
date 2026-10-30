"""Court landmarks (family `decor`): one signature piece per court kind, set at the court's middle by the station
generator. Local frame and placement: modkit.K (front = +v). Four rotations each.

- module.holo_sign: a 2x2 plaza holo-column: a stepped plinth, a steel column with brass bands, a slatted band of
  magenta and cyan light round its head (an advert drum), an emitter dish on top.
- module.tree_large: a 3x3 garden tree: an octagonal raised bed with a seat ledge, a tall tree whose crown clears the
  walls, ground cover round the trunk.
- module.podium: a 2x2 drill-hall dais: a raised plate with a hazard-striped front edge and a step, a lectern with a lit
  screen, a mast with the navy banner at the back."""
import math
import random

from .decor import _foliage
from .modkit import K


def holo_sign(rot):
    k = K(f"holo_sign_{rot}", (2, 2), rot)
    k.cyl(0, 0, 0.0, 0.84, 0.1, "steelD", top="steel", sides=8)                          # plinth
    k.cyl(0, 0, 0.1, 0.62, 0.1, "gmD", top="gm", sides=8)                                # step
    for i in range(8):                                                                 # floor emitters round the step
        a = i * math.tau / 8 + math.tau / 16
        k.box(0.72 * math.cos(a), 0.72 * math.sin(a), 0.1, 0.1, 0.1, 0.02, "cyan")
    k.cyl(0, 0, 0.2, 0.17, 1.55, "steel", top="steelL", sides=10)                         # column
    for z in (0.55, 1.0):                                                              # brass bands
        k.cyl(0, 0, z, 0.2, 0.05, "ochD", top="ochM", sides=10)
    n = 18
    for i in range(n):                                                                 # the advert drum: slats of light
        a = i * math.tau / n
        col = "magenta" if (i // 3) % 2 == 0 else "cyan"
        k.box(0.48 * math.cos(a), 0.48 * math.sin(a), 1.2, 0.1, 0.02, 0.42 if i % 3 != 1 else 0.3, col, rz=a + math.pi / 2)
    k.cyl(0, 0, 1.15, 0.5, 0.03, "gmD", top="steelD", sides=18)                           # the drum's lower rim
    k.cyl(0, 0, 1.75, 0.26, 0.06, "steelD", top="steel", sides=12)                       # cap
    k.cyl(0, 0, 1.81, 0.16, 0.05, "steel", top="cyan", sides=12, rtop=0.2)               # emitter dish
    return k.build()


def tree_large(rot):
    k = K(f"tree_large_{rot}", (3, 3), rot)
    k.cyl(0, 0, 0.0, 1.42, 0.08, "gmD", sides=8)                                         # base
    k.cyl(0, 0, 0.08, 1.32, 0.38, "lvW2", top="lvW", sides=8)                            # cream panels
    k.cyl(0, 0, 0.46, 1.4, 0.05, "steel", top="steelL", sides=8)                         # the rim, a seat ledge
    k.cyl(0, 0, 0.48, 1.24, 0.03, "rustD", top="leather", sides=8)                       # soil
    for i in range(8):                                                                 # a navy trim panel per side
        a = i * math.tau / 8 + math.tau / 16
        k.box(1.24 * math.cos(a), 1.24 * math.sin(a), 0.2, 0.5, 0.012, 0.06, "navy", rz=a + math.pi / 2)
    k.cyl(0, 0, 0.5, 0.16, 1.55, "rustD", top="ochD", sides=8, rtop=0.09)                # trunk
    rnd = random.Random(17)
    for a in (0.3, 1.9, 3.4, 4.9):                                                     # four boughs
        k.box(0.22 * math.cos(a), 0.22 * math.sin(a), 1.55, 0.07, 0.6, 0.07, "rustD", rz=a, rx=0.75)
    for i in range(9):                                                                 # the crown: leaf clumps in two tiers
        tier = 0 if i < 6 else 1
        a = i * (math.tau / 6 if tier == 0 else math.tau / 3) + (0 if tier == 0 else 0.5)
        d = 0.62 if tier == 0 else 0.3
        _foliage(k, d * math.cos(a), d * math.sin(a), 1.65 + 0.35 * tier, 0.5, 0.6, 12, 90 + i)
    _foliage(k, 0, 0, 2.15, 0.45, 0.45, 12, 99)                                        # the top
    for i in range(8):                                                                 # ground cover round the trunk
        a = i * math.tau / 8 + rnd.uniform(-0.3, 0.3)
        _foliage(k, 0.8 * math.cos(a), 0.8 * math.sin(a), 0.5, 0.24, 0.24, 6, 120 + i)
    return k.build()


def podium(rot):
    k = K(f"podium_{rot}", (2, 2), rot)
    k.box(0, -0.1, 0.0, 1.8, 1.6, 0.22, "gm", top="gmD", bevel=0.02)                      # the dais
    k.box(0, 0.78, 0.0, 1.3, 0.24, 0.11, "gm", top="gmD", bevel=0.01)                     # a step at the front
    for i in range(-4, 5):                                                             # hazard stripes on the front edge
        k.box(i * 0.2, 0.69, 0.2, 0.1, 0.03, 0.022, "hazY" if i % 2 == 0 else "hazK")
    k.box(0, 0.05, 0.22, 0.56, 0.4, 0.78, "navy", top="gmD", taper=0.82, bevel=0.015)     # lectern
    k.box(0, 0.18, 1.0, 0.62, 0.36, 0.04, "steelD", top="steel", rx=-0.35)               # its sloped top
    k.box(0, 0.2, 1.03, 0.4, 0.2, 0.012, "cyan", rx=-0.35)                               # the lit screen
    k.box(0, 0.26, 0.45, 0.4, 0.012, 0.16, "plate")                                      # a crest plate on its front
    k.cyl(0.66, -0.66, 0.22, 0.05, 1.95, "steelL", top="steel", sides=8)                # the mast
    k.cyl(0.66, -0.66, 2.17, 0.08, 0.06, "ochD", top="ochM", sides=8)                    # finial
    k.box(0.36, -0.66, 1.45, 0.58, 0.025, 0.66, "navy")                                  # the banner
    k.box(0.36, -0.65, 1.66, 0.58, 0.03, 0.08, "plate")                                  # its stripe
    k.box(0.36, -0.65, 1.52, 0.18, 0.03, 0.12, "hazY")                                   # its badge
    return k.build()


SPRITES = []
for _r in range(4):
    _flip = _r % 2 == 1
    for _name, _fp, _fn in (("holo_sign", (2, 2), holo_sign), ("tree_large", (3, 3), tree_large), ("podium", (2, 2), podium)):
        fp = (_fp[1], _fp[0]) if _flip else _fp
        SPRITES.append((f"module.{_name}.r{_r}", fp, "prop", lambda r=_r, fn=_fn: fn(r)))
        if _r == 0:
            SPRITES.append((f"module.{_name}", fp, "prop", lambda fn=_fn: fn(0)))
