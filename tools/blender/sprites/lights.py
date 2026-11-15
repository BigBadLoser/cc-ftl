"""Lamps (family `lights`): the station and ship lighting set, warm white light with gold accents. Local frame and
placement: modkit.K (front = +v). Four rotations each, and the state art the renderer looks for (moduleArt.stateArt):
`.rN.unpowered` (lights out), `.rN.damaged` / `.rN.damaged.flicker` / `.rN.destroyed` (the damage family's pass over
the idle build).

- module.light_mast: the tall lamp, a twin-tube mast: two tubes of light clamped to a cream spine on a base with a
  status screen, a fan housing on top. Solid.
- module.light_cage: the short lamp: a glowing block in a steel guard cage with a carry handle, on a bumpered plinth.
  Solid.
- module.light_grate: the floor light, walked over: a lit well under a plain 4 x 4 grate in a light grey frame, set a
  pixel and a half in from the tile's edges, level with the deck. Rendered without the prop outline ("block"), and
  with a holdout sheet at floor level so nothing below the deck shows outside the opening. Also `.off` and `.broken`,
  the ruin art (shipgen/ruinSystems)."""
import math

from . import damage
from .modkit import K

PX = 0.028                                  # one art pixel along a grid axis
LIT = {"main": "fxW", "accent": "lampY"}    # warm white light, gold accents
WARM_WALL = ("gmD", "rustD", "ochD", "ochM")  # a lit shaft's walls, top (dark) to bottom (lit warm)


def _socket(k):
    """A floor socket: a steel lip, a dark well, four corner bolts, a feed cable out to the tile edge."""
    k.box(0, 0, 0.0, 0.74, 0.74, 0.014, "steelD", top="gm", bevel=0.006)
    k.box(0, 0, 0.004, 0.64, 0.64, 0.012, "dark")
    for su in (-1, 1):
        for sv in (-1, 1):
            k.cyl(su * 0.31, sv * 0.31, 0.014, 0.024, 0.012, "plate", sides=6)
    k.box(-0.42, -0.12, 0.0, 0.2, 0.07, 0.035, "dark", top="gmD")                           # feed cable
    k.box(-0.33, -0.12, 0.0, 0.06, 0.1, 0.05, "steelD", top="steel")                          # its clamp


def _cable(k, u0, v0, u1, v1):
    """A floor cable from (u0, v0) to (u1, v1), along u then v, with a clamp at the bend."""
    k.box((u0 + u1) / 2, v0, 0.0, abs(u1 - u0) + 0.06, 0.06, 0.03, "dark", top="gmD")
    k.box(u1, (v0 + v1) / 2, 0.0, 0.06, abs(v1 - v0) + 0.06, 0.03, "dark", top="gmD")
    k.box(u1, v0, 0.0, 0.1, 0.1, 0.045, "steelD", top="steel")


def mast(rot):
    k = K(f"light_mast_{rot}", (1, 1), rot)
    _socket(k)
    k.box(0, 0, 0.014, 0.5, 0.42, 0.22, "gm", top="steel", bevel=0.025)                    # base
    k.box(0.05, 0.212, 0.08, 0.2, 0.01, 0.1, "dark")                                       # status screen
    for i, (h, c) in enumerate(((0.04, "green"), (0.07, "green"), (0.03, "green"), (0.06, "orange"))):
        k.box(-0.02 + i * 0.045, 0.218, 0.095, 0.03, 0.006, h, c)
    for i in range(3):                                                                 # side vents
        k.box(0.252, -0.1 + i * 0.08, 0.08, 0.008, 0.05, 0.1, "dark")
    k.box(0, -0.1, 0.234, 0.1, 0.1, 1.28, "lvW2", top="lvW", bevel=0.015)                  # spine
    for u in (-0.1, 0.1):                                                              # the two tubes
        k.cyl(u, 0.04, 0.234, 0.07, 0.04, "steel", top="steelL", sides=12)
        k.cyl(u, 0.04, 0.274, 0.055, 1.16, LIT["main"], sides=12)
        k.cyl(u, 0.04, 1.434, 0.07, 0.04, "steel", top="steelL", sides=12)
    for z in (0.5, 0.86, 1.22):                                                        # clamps
        k.box(0, -0.02, z, 0.4, 0.24, 0.07, "lvW2", top="lvW", bevel=0.015)
        k.box(0, -0.02, z + 0.025, 0.405, 0.245, 0.02, "gmD")
    k.box(0, -0.03, 1.474, 0.4, 0.3, 0.13, "lvW2", top="lvW", bevel=0.025)                 # fan housing
    k.cyl(0, -0.03, 1.604, 0.09, 0.015, "dark", sides=14)                                   # fan
    for a in (0.3, 1.87):
        k.box(0, -0.03, 1.619, 0.16, 0.025, 0.006, "steel", rz=a)
    k.box(0.16, 0.12, 1.53, 0.04, 0.008, 0.04, LIT["accent"])                              # indicator
    return k.build()


def cage(rot):
    k = K(f"light_cage_{rot}", (1, 1), rot)
    k.box(0, 0, 0.0, 0.5, 0.5, 0.14, "gm", top="steel", bevel=0.02)                        # plinth
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 0.23, sv * 0.23, 0.0, 0.09, 0.09, 0.16, "dark", top="gmD", bevel=0.015)   # rubber bumpers
    k.box(0, 0.252, 0.05, 0.3, 0.006, 0.04, "hazY")                                        # stencil stripes
    k.box(0.252, 0, 0.05, 0.006, 0.3, 0.04, "hazY")
    k.box(0, 0, 0.14, 0.3, 0.3, 0.05, "gmD", top="gm")                                     # lamp foot
    k.box(0, 0, 0.19, 0.24, 0.24, 0.38, LIT["main"], bevel=0.02)                           # the light
    k.box(0, 0, 0.57, 0.3, 0.3, 0.05, "gmD", top="gm")                                     # lamp head
    for su in (-1, 1):                                                                 # cage: corner posts
        for sv in (-1, 1):
            k.box(su * 0.18, sv * 0.18, 0.14, 0.03, 0.03, 0.52, "steel", top="steelL")
    for su, sv in ((1, 0), (-1, 0), (0, 1), (0, -1)):                                  # mid bars
        k.box(su * 0.18, sv * 0.18, 0.14, 0.025, 0.025, 0.52, "steel", top="steelL")
    for z in (0.3, 0.45):                                                              # hoops
        for su, sv in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k.box(su * 0.18, sv * 0.18, z, 0.03 if su else 0.38, 0.38 if su else 0.03, 0.025, "steel")
    k.box(0, 0, 0.66, 0.4, 0.4, 0.04, "steelD", top="steel")                               # cage top
    for su in (-1, 1):                                                                 # carry handle
        k.box(su * 0.12, 0, 0.7, 0.03, 0.04, 0.1, "steelD")
    k.box(0, 0, 0.8, 0.27, 0.05, 0.04, "dark", top="gmD")
    _cable(k, -0.25, -0.1, -0.5, -0.1)
    return k.build()


def _holdout_sq(name, s):
    """A holdout sheet at floor level, 2.4 tiles across, with an s x s hole in the middle: whatever lies below the deck
    shows only through the hole."""
    k = K(name, (1, 1), 0)
    R = 1.2
    k.box(0, (s / 2 + R) / 2, 0.0, 2 * R, R - s / 2, 0.001, "dark")
    k.box(0, -(s / 2 + R) / 2, 0.0, 2 * R, R - s / 2, 0.001, "dark")
    k.box((s / 2 + R) / 2, 0, 0.0, R - s / 2, s, 0.001, "dark")
    k.box(-(s / 2 + R) / 2, 0, 0.0, R - s / 2, s, 0.001, "dark")
    ob = k.build()[0]
    ob.is_holdout = True
    return ob


def grate(rot):
    k = K(f"light_grate_{rot}", (1, 1), rot)
    outer, lip, d = 0.9, 0.07, 0.1
    s = outer - 2 * lip
    n = len(WARM_WALL)
    for i, col in enumerate(WARM_WALL):                                                # the shaft, lit warm low down
        za, h = -d * (i + 1) / n, d / n
        k.box(0, -s / 2 - 0.01, za, s + 0.04, 0.02, h, col)
        k.box(0, s / 2 + 0.01, za, s + 0.04, 0.02, h, col)
        k.box(-s / 2 - 0.01, 0, za, 0.02, s, h, col)
        k.box(s / 2 + 0.01, 0, za, 0.02, s, h, col)
    k.box(0, 0, -d - 0.02, s + 0.04, s + 0.04, 0.02, "steelD")
    k.box(0, 0, -d, s - 0.04, s - 0.04, 0.02, LIT["main"], bevel=0.01)                    # the light
    for t in (-1, 1):                                                                  # the frame
        k.box(0, t * (s / 2 + lip / 2), 0.0, outer, lip, 0.012, "steelD", top="gm")
        k.box(t * (s / 2 + lip / 2), 0, 0.0, lip, s, 0.012, "steelD", top="gm")
    b = 0.035
    for t in (-1, 1):                                                                  # the grate: border and bars
        k.box(0, t * (s / 2 - b / 2), -0.004, s, b, 0.02, "steelD", top="steel")
        k.box(t * (s / 2 - b / 2), 0, -0.004, b, s, 0.02, "steelD", top="steel")
    for i in range(1, 4):
        t = -s / 2 + i * s / 4
        k.box(t, 0, -0.004, 2 * PX, s, 0.018, "steelD", top="steel")
        k.box(0, t, -0.004, s, 2 * PX, 0.018, "steelD", top="steel")
    k.m.dz = -0.016                                                                    # top level with the deck
    return [*k.build(), _holdout_sq(f"light_grate_{rot}_h", outer)]


def _state(build, level, sid):
    """The build in a state: '' (lit), 'unpowered' (every light out) or a damage level (damage.apply). A holdout sheet
    is kept out of the damage pass."""
    def fn():
        objs = build()
        hold = [o for o in objs if getattr(o, "is_holdout", False)]
        rest = [o for o in objs if o not in hold]
        if level == "unpowered":
            damage._dim(rest)
        elif level:
            rest = damage.apply(rest, level, sid, electric=True, debris=level == "destroyed")
        return rest + hold
    return fn


LAMPS = (("light_mast", mast, "prop"), ("light_cage", cage, "prop"), ("light_grate", grate, "block"))
STATES = ("", "unpowered", "damaged", "damaged.flicker", "destroyed")

SPRITES = []
for _name, _fn, _kind in LAMPS:
    for _r in range(4):
        for _st in STATES:
            _sid = f"module.{_name}.r{_r}" + (f".{_st}" if _st else "")
            SPRITES.append((_sid, (1, 1), _kind, _state(lambda r=_r, fn=_fn: fn(r), _st, _sid)))
    SPRITES.append((f"module.{_name}", (1, 1), _kind, _state(lambda fn=_fn: fn(0), "", f"module.{_name}")))
SPRITES += [("module.light_grate.off", (1, 1), "block", _state(lambda: grate(0), "unpowered", "module.light_grate.off")),
            ("module.light_grate.broken", (1, 1), "block",
             _state(lambda: grate(0), "destroyed", "module.light_grate.broken"))]
