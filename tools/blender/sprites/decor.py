"""Station decor (family `decor`): planters, a bench and two deck marks, the dressing that breaks up big open floors
(courts, lounges, corridor junctions). Local frame and placement: modkit.K (front = +v). Four rotations each.

- module.planter: a 1x1 cream pot with a steel rim and a leafy shrub (solid).
- module.planter_large: a 2x2 raised bed (steel frame, cream panels) with a small tree and ground cover (solid).
- module.bench: a 2x1 backless bench, slatted top on two steel pedestals (solid: dressing, nobody sits yet).
- module.deck_inlay: a 1x1 brass-and-steel medallion set flush in the deck (walkable, drawn under crew).
- module.deck_hazard: a 1x1 deck plate of yellow and black stripes (walkable, drawn under crew)."""
import math
import random

from .modkit import K

LEAF = ("alG", "xnFL", "alG", "xnF", "xnFD")


def _foliage(k, u, v, z, r, h, n, seed):
    """A leafy clump centred at (u, v), from z up about h: n leaves round a stem, a crown on top."""
    rnd = random.Random(seed)
    k.box(u, v, z, 0.05, 0.05, h * 0.7, "xnFD")                                          # stem
    for i in range(n):
        a = i * 2.4 + rnd.uniform(-0.3, 0.3)
        d = r * rnd.uniform(0.25, 0.85)
        zz = z + h * rnd.uniform(0.25, 0.95)
        s = r * rnd.uniform(0.45, 0.7)
        k.box(u + d * math.cos(a), v + d * math.sin(a), zz, s, s * 0.55, 0.05, LEAF[i % len(LEAF)], rz=a,
              rx=rnd.uniform(-0.45, 0.45))
    k.box(u, v, z + h * 0.85, r * 0.7, r * 0.7, h * 0.18, "alG", rz=rnd.uniform(0, 1.5), bevel=0.02)   # crown


def planter(rot):
    k = K(f"planter_{rot}", (1, 1), rot)
    k.box(0, 0, 0.0, 0.6, 0.6, 0.06, "gmD")                                              # plinth
    k.box(0, 0, 0.06, 0.56, 0.56, 0.36, "lvW2", top="lvW", bevel=0.03, taper=1.08)       # pot, flaring a little
    k.box(0, 0, 0.4, 0.64, 0.64, 0.05, "steel", top="steelL", bevel=0.012)               # rim
    k.box(0, 0.282, 0.16, 0.3, 0.012, 0.05, "navy")                                      # a trim stripe on the front
    k.box(0, 0, 0.42, 0.52, 0.52, 0.03, "rustD", top="leather")                          # soil
    _foliage(k, 0, 0, 0.45, 0.36, 0.6, 18, 11)
    return k.build()


def planter_large(rot):
    k = K(f"planter_large_{rot}", (2, 2), rot)
    k.box(0, 0, 0.0, 1.84, 1.84, 0.08, "gmD")                                            # base
    for su in (-1, 1):                                                                 # steel corner posts
        for sv in (-1, 1):
            k.box(su * 0.86, sv * 0.86, 0.08, 0.1, 0.1, 0.42, "steelD", top="steel")
    k.box(0, 0, 0.08, 1.7, 1.7, 0.38, "lvW2", top="lvW", bevel=0.02)                    # cream panels
    k.box(0, 0, 0.46, 1.86, 1.86, 0.05, "steel", top="steelL", bevel=0.015)              # the rim, a seat ledge
    k.box(0, 0.85, 0.2, 1.4, 0.012, 0.06, "navy")                                        # front trim stripe
    k.box(0, 0, 0.48, 1.66, 1.66, 0.03, "rustD", top="leather")                          # soil
    rnd = random.Random(5)
    k.cyl(0.08, -0.05, 0.5, 0.08, 1.0, "rustD", top="ochD", sides=8, rtop=0.05)          # trunk
    for a in (0.6, 2.4, 4.3):                                                          # three boughs
        k.box(0.08 + 0.18 * math.cos(a), -0.05 + 0.18 * math.sin(a), 1.25, 0.05, 0.4, 0.05, "rustD", rz=a, rx=0.7)
    for i in range(5):                                                                 # the canopy: leaf clumps
        a = i * 1.26 + 0.3
        d = 0.0 if i == 0 else 0.34
        _foliage(k, 0.08 + d * math.cos(a), -0.05 + d * math.sin(a), 1.25 + (0.25 if i == 0 else 0.0), 0.42, 0.55, 12, 40 + i)
    for i in range(6):                                                                 # ground cover round the trunk
        a = i * math.tau / 6 + rnd.uniform(-0.3, 0.3)
        _foliage(k, 0.62 * math.cos(a), 0.62 * math.sin(a), 0.5, 0.2, 0.22, 6, 70 + i)
    return k.build()


def bench(rot):
    k = K(f"bench_{rot}", (2, 1), rot)
    for su in (-0.62, 0.62):                                                           # pedestals: a foot, a post
        k.box(su, 0, 0.0, 0.4, 0.36, 0.04, "steel", top="steelL", bevel=0.01)
        k.box(su, 0, 0.04, 0.1, 0.22, 0.3, "steelL", top="steel")
    k.box(0, 0, 0.3, 1.7, 0.36, 0.05, "gm", top="gmD")                                   # the frame under the slats
    for j, v in enumerate((-0.13, 0.0, 0.13)):                                         # three slats
        k.box(0, v, 0.35, 1.76, 0.11, 0.05, "lvW2", top="lvW" if j % 2 == 0 else "lvW2", bevel=0.01)
    for su in (-0.9, 0.9):                                                             # end caps
        k.box(su, 0, 0.3, 0.06, 0.4, 0.12, "navy", top="gmD")
    return k.build()


def deck_inlay(rot):
    k = K(f"deck_inlay_{rot}", (1, 1), rot)
    k.box(0, 0, 0.0, 0.86, 0.86, 0.012, "gmD", top="gmD")                               # recessed plate
    k.cyl(0, 0, 0.012, 0.36, 0.01, "ochD", top="ochM", sides=24)                         # brass ring
    k.cyl(0, 0, 0.022, 0.28, 0.01, "steel", top="steelL", sides=24)                      # steel field
    for a in range(4):                                                                 # four brass points
        k.box(0, 0, 0.032, 0.5, 0.06, 0.008, "ochM", rz=a * math.pi / 2 + math.pi / 4)
    k.cyl(0, 0, 0.034, 0.08, 0.01, "ochD", top="ochM", sides=12)                         # boss
    return k.build()


def deck_hazard(rot):
    k = K(f"deck_hazard_{rot}", (1, 1), rot)
    k.box(0, 0, 0.0, 0.9, 0.9, 0.012, "dark", top="dark")                                # black plate
    for i in range(-2, 3):                                                             # yellow stripes across
        k.box(i * 0.18, 0, 0.012, 0.08, 0.8, 0.008, "hazY")
    k.box(0, 0, 0.0, 0.94, 0.94, 0.01, "steelD")                                         # frame lip
    return k.build()


SPRITES = []
for _r in range(4):
    _flip = _r % 2 == 1
    for _name, _fp, _fn in (("planter", (1, 1), planter), ("planter_large", (2, 2), planter_large), ("bench", (2, 1), bench),
                            ("deck_inlay", (1, 1), deck_inlay), ("deck_hazard", (1, 1), deck_hazard)):
        fp = (_fp[1], _fp[0]) if _flip else _fp
        SPRITES.append((f"module.{_name}.r{_r}", fp, "prop", lambda r=_r, fn=_fn: fn(r)))
        if _r == 0:
            SPRITES.append((f"module.{_name}", fp, "prop", lambda fn=_fn: fn(0)))
