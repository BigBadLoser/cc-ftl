"""Crew v2: hand-held weapons, gear layers `gear.hand.<weapon>` skinned whole to hand.R, so they follow the hand.

Each weapon is modelled in the hand bone's own frame, which the combat poses (human_aim) set outright: +Y along the
barrel, +Z up, +X to the character's right, origin at the wrist. Coordinates below are relative to the grip (the fist,
GRIP of the way down the hand), in rig units (~36 px each at game size: no part thinner than ~0.06, 2 px).

Every weapon belongs to a pose family (FAMILY), and its support point (where the left hand goes) is the family's
SUPPORT point, so one pose serves every weapon of a family. `muzzle` (grip-relative) is exported per clip frame into the
manifest (crew_build / crew_pack) for the flash, tracer or beam."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import core
from .human_base import Item, paint
from .human_v2 import Build, W, blend

HOLD = 0.4                                # the hand pitched this much (rad) under the barrel: the gun sits above
                                          # the wrist (along the barrel, its body ran through the wrist)
RISE = 0.04                               # guns sit this much higher than the fist's centre (the grip runs down
                                          # into the fist, the gun above it)
BUTT = 0.3                                # every shouldered gun's butt this far behind the grip
GRIP = 1.3                                # the fist's centre, in the curled fingers: fraction of the hand bone
SIZE = 1.0                                # weapons at life size (1.25 at 1x, so they read at ~62 px)
SUPPORT = {"2h": Vector((0.0, 0.31, -0.01)), "heavy": Vector((0.0, 0.27, -0.03)),
           "2m": Vector((0.0, -0.21, 0.0))}                                     # the left hand, grip-relative
FAMILY = {"sidearm": "1h", "ion_pistol": "1h", "laser_pistol": "1h", "plasma_cutter": "1h", "rifle": "2h",
          "laser_rifle": "2h", "shotgun": "2h", "smg": "2h", "rail_rifle": "2h", "flamethrower": "heavy",
          "heavy_repeater": "heavy", "blade": "1m", "shock_baton": "1m", "breach_axe": "2m"}
CARRY = {"1h": "thigh", "2h": "sling", "heavy": "stow", "1m": "belt", "2m": "sling"}   # out of the hands (holster)


class Gun:
    """Boxes and tubes in the grip frame (x right, y forward, z up), one palette colour per face."""

    def __init__(self, melee=False):
        self.v, self.f, self.c = [], [], []
        self.melee = melee

    def box(self, c, s, col, top=None):
        x, y, z = c
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        b = len(self.v)
        self.v += [Vector((x + sx * hx, y + sy * hy, z + sz * hz)) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        for f, top_face in (((0, 1, 3, 2), False), ((4, 6, 7, 5), True), ((0, 4, 5, 1), False), ((2, 3, 7, 6), False),
                            ((0, 2, 6, 4), False), ((1, 5, 7, 3), False)):
            self.f.append([b + i for i in f])
            self.c.append(top if top_face and top else col)

    def tube(self, y0, y1, x, z, r, col, n=12, cap=None):
        """A cylinder along y at (x, z); cap: the colour of its front end (a bore)."""
        import math
        b = len(self.v)
        for y in (y0, y1):
            self.v += [Vector((x + r * math.cos(t), y, z + r * math.sin(t))) for t in (k * math.tau / n for k in range(n))]
        for k in range(n):
            self.f.append([b + k, b + (k + 1) % n, b + n + (k + 1) % n, b + n + k])
            self.c.append(col)
        self.f.append([b + k for k in range(n)][::-1])
        self.c.append(col)
        self.f.append([b + n + k for k in range(n)])
        self.c.append(cap or col)

    def mesh(self, name, A, bone="hand.R", frame=None):
        """The skinned object, whole on `bone`: grip frame -> hand.R rest frame -> armature rest space; or, with
        frame = (origin, right, fwd, up) in rest space, the grip frame placed there (a holstered or slung weapon)."""
        if frame is None:
            M = A.data.bones["hand.R"].matrix_local
            pts = [M @ to_hand(A, v, self.melee) for v in self.v]
        else:
            o, r, f, u = frame
            rot = Matrix((r, f, u)).transposed()
            pts = [o + rot @ (v * SIZE) for v in self.v]
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(p) for p in pts], [], self.f)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.update()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.vertex_groups.new(name=bone).add(list(range(len(self.v))), 1.0, "REPLACE")
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = A
        ob.parent = A
        cols = list(self.c)
        paint(ob, lambda c, i: cols[i])
        lit = [core.palette.emissive(c) for c in cols]                       # lenses, coils: self-lit, and on the glow
        if any(lit):                                                          # layer (as rigid gear's lights)
            lin = [core.lin(c) for c in cols]
            core.set_attr(me, "Col", [(0, 0, 0) if e else c for c, e in zip(lin, lit)])
            core.set_attr(me, "Self", [c if e else (0, 0, 0) for c, e in zip(lin, lit)])
            core.set_attr(me, "Glow", [c if e else (0, 0, 0) for c, e in zip(lin, lit)])
        return ob

    def lit(self):
        return any(core.palette.emissive(c) for c in self.c)


def grip_y(A):
    return A.data.bones["hand.R"].length * GRIP


def to_hand(A, v, melee=False):
    """A weapon-frame point (unscaled) in hand.R's local frame, at the grip. Guns: pitched up by HOLD and raised by RISE
    (the grip runs down through the fist along the hand's -Z, the index side up). Melee: the handle (weapon y) runs
    through the fist along the hand's +Z, the blade out of the thumb side and its edge (weapon -z) to the knuckles."""
    v = v * SIZE
    if melee:
        v = Matrix.Rotation(math.pi / 2, 3, "X") @ v
    else:
        v = Matrix.Rotation(HOLD, 3, "X") @ (v + Vector((0.0, 0.0, RISE)))
    return v + Vector((0.0, grip_y(A), 0.0))


def hand_axes(fwd, up):
    """The hand's (+Y, +Z) for a gun whose barrel points along fwd, top along up: pitched down by HOLD."""
    c, s = math.cos(HOLD), math.sin(HOLD)
    return (fwd * c - up * s).normalized(), (up * c + fwd * s).normalized()


def _guard(g, y=0.045, z=-0.035):
    """A trigger guard: a thin loop under the frame in front of the grip."""
    g.box((0, y + 0.035, z - 0.03), (0.02, 0.02, 0.06), "dark")
    g.box((0, y, z - 0.055), (0.02, 0.09, 0.018), "dark")


def _panel(g, y, z, w, h, col="gmD", dx=0.0):
    """A flat detail plate on both sides of a body of half width dx (a port, a vent, a grip panel)."""
    for sx in (1, -1):
        g.box((sx * (dx + 0.002), y, z), (0.006, w, h), col)


def sidearm(g):
    g.box((0, 0.1, 0.065), (0.06, 0.26, 0.08), "steel", top="sole")                      # slide
    g.box((0, 0.07, 0.025), (0.055, 0.18, 0.03), "dark")                                 # frame
    g.box((0, 0.0, -0.015), (0.055, 0.075, 0.12), "dark")                               # grip, through the fist
    for y in (-0.005, 0.02):
        _panel(g, y, 0.065, 0.012, 0.06, "dark", 0.03)                                  # slide serrations
    _panel(g, 0.0, -0.02, 0.05, 0.08, "gmD", 0.0275)                                    # grip panels
    g.box((0, 0.215, 0.11), (0.014, 0.02, 0.018), "dark")                               # front sight
    g.box((0, -0.015, 0.11), (0.04, 0.02, 0.018), "dark")                               # rear sight
    g.tube(0.226, 0.232, 0, 0.065, 0.014, "dark")                                       # the bore
    _guard(g)
    return Vector((0, 0.24, 0.065))


def rifle(g):
    g.box((0, 0.08, 0.06), (0.075, 0.34, 0.1), "steel", top="sole")                     # receiver
    g.box((0, 0.33, 0.05), (0.08, 0.2, 0.085), "jacketD", top="jacket")                 # olive handguard
    g.tube(0.42, 0.66, 0, 0.065, 0.026, "gmD", cap="dark")                               # barrel
    g.box((0, -0.16, 0.045), (0.065, 0.24, 0.11), "jacketD", top="jacket")             # olive stock
    g.box((0, -0.285, 0.04), (0.07, 0.03, 0.13), "gmD")                                 # its butt pad (at -BUTT)
    g.box((0, 0.13, -0.045), (0.055, 0.075, 0.13), "gmD")                               # magazine
    g.box((0, 0.0, -0.03), (0.05, 0.055, 0.1), "dark")                                  # pistol grip
    g.box((0, 0.06, 0.13), (0.035, 0.1, 0.045), "dark")                                 # sight
    g.box((0, 0.06, 0.155), (0.02, 0.02, 0.012), "lens")                                # its lens
    g.box((0, 0.2, 0.115), (0.03, 0.2, 0.012), "dark")                                  # top rail
    _panel(g, 0.13, 0.075, 0.07, 0.03, "dark", 0.0375)                                  # ejection port
    _panel(g, 0.33, 0.05, 0.12, 0.02, "jacket", 0.04)                                   # handguard slots
    g.tube(0.6, 0.67, 0, 0.065, 0.034, "dark", cap="dark")                              # muzzle brake
    g.box((0, 0.12, -0.12), (0.055, 0.06, 0.04), "gmD")                                 # magazine curve
    g.box((0, -0.16, 0.105), (0.05, 0.12, 0.02), "jacket")                              # cheek rest
    _guard(g, 0.05, -0.04)
    return Vector((0, 0.67, 0.065))


def heavy_repeater(g):
    g.box((0, 0.06, 0.06), (0.17, 0.36, 0.17), "steel", top="sole")                    # receiver
    for dx, dz in ((-0.038, 0.025), (0.038, 0.025), (-0.038, 0.095), (0.038, 0.095)):    # the barrel cluster
        g.tube(0.24, 0.62, dx, dz, 0.026, "steelL", cap="dark")
    g.box((0, 0.5, 0.06), (0.15, 0.05, 0.15), "dark")                                   # the clamp round it
    g.box((0.14, 0.06, 0.0), (0.1, 0.2, 0.15), "jacketD", top="jacket")                # ammo box, outer side
    g.box((0, 0.1, 0.18), (0.04, 0.22, 0.04), "dark")                                   # carry handle
    for y in (0.0, 0.2):
        g.box((0, y, 0.15), (0.04, 0.035, 0.05), "dark")
    g.box((0, 0.0, -0.04), (0.055, 0.065, 0.12), "dark")                                # grip
    for k in range(4):                                                                  # the ammo belt into it
        g.box((0.1 - k * 0.02, 0.06, 0.075 - k * 0.012), (0.018, 0.06, 0.02), "brass" if k % 2 else "rust")
    for y in (0.3, 0.38, 0.46):
        g.box((0, y, 0.135), (0.11, 0.025, 0.012), "dark")                              # barrel shroud bands
    _panel(g, 0.06, 0.06, 0.2, 0.05, "gmD", 0.085)                                      # receiver side plates
    g.box((0, 0.27, -0.035), (0.045, 0.05, 0.1), "dark")                                # front grip
    return Vector((0, 0.63, 0.06))


def ion_pistol(g):
    g.box((0, 0.08, 0.065), (0.07, 0.2, 0.09), "steelL", top="sole")                     # body
    g.tube(0.14, 0.32, 0, 0.065, 0.024, "dark")                                         # the barrel the coils wind
    for y in (0.19, 0.245, 0.3):
        g.tube(y - 0.016, y + 0.016, 0, 0.065, 0.042, "fxI2")                          # violet coils,
        g.tube(y - 0.005, y + 0.005, 0, 0.065, 0.045, "fxI1")                          # blue-banded
    g.box((0, 0.0, -0.015), (0.055, 0.075, 0.12), "dark")
    _panel(g, 0.0, -0.02, 0.05, 0.08, "gmD", 0.0275)                                    # grip panels
    g.box((0, 0.02, 0.12), (0.03, 0.03, 0.02), "dark")                                  # rear sight
    g.box((0, 0.11, 0.111), (0.03, 0.06, 0.006), "fxI1")                                # charge strip, lit
    _guard(g)
    return Vector((0, 0.33, 0.065))


def laser_pistol(g):
    g.box((0, 0.1, 0.065), (0.065, 0.27, 0.075), "c3W3", top="c3W1")                    # smooth casing
    g.box((0, 0.05, 0.12), (0.03, 0.12, 0.045), "gm")                                   # heat-sink fin
    g.box((0, 0.243, 0.065), (0.05, 0.02, 0.05), "red")                                 # emitter lens
    g.box((0, 0.0, -0.015), (0.055, 0.075, 0.12), "dark")
    _panel(g, 0.12, 0.065, 0.12, 0.012, "red", 0.0325)           # a glowing side strip
    _panel(g, 0.0, -0.02, 0.05, 0.08, "gmD", 0.0275)
    _guard(g)
    return Vector((0, 0.26, 0.065))


def plasma_cutter(g):
    g.box((0, 0.05, 0.04), (0.09, 0.17, 0.11), "hazY", top="hivis")                     # a work tool's yellow body
    g.box((0, 0.05, 0.1), (0.07, 0.1, 0.03), "hazK")                                    # hazard band
    g.tube(0.13, 0.3, 0, 0.05, 0.024, "steel")                                          # nozzle
    g.tube(0.3, 0.335, 0, 0.05, 0.03, "orange")                                         # its hot tip
    g.box((0, -0.06, 0.04), (0.05, 0.06, 0.06), "dark")                                 # hose fitting
    g.box((0, 0.0, -0.03), (0.055, 0.07, 0.11), "dark")
    _panel(g, 0.05, 0.02, 0.1, 0.02, "hazK", 0.045)                                     # side hazard band
    for y in (0.17, 0.21, 0.25):
        g.tube(y - 0.006, y + 0.006, 0, 0.05, 0.03, "steelD")                          # nozzle cooling rings
    _guard(g, 0.04, -0.045)
    return Vector((0, 0.34, 0.05))


def laser_rifle(g):
    g.box((0, 0.19, 0.06), (0.085, 0.5, 0.1), "c3W3", top="c3W1")                      # long smooth housing
    g.box((0, 0.443, 0.06), (0.06, 0.02, 0.06), "red")                                  # emitter lens (no rings)
    g.box((0, 0.06, -0.035), (0.05, 0.12, 0.07), "fxO")                                 # power cell, glowing
    g.box((0, -0.17, 0.05), (0.065, 0.26, 0.1), "gm")                                   # stock
    g.box((0, 0.0, -0.03), (0.05, 0.055, 0.1), "dark")
    _panel(g, 0.25, 0.06, 0.3, 0.012, "red", 0.0425)                                   # a glowing strip down each side
    for y in (0.1, 0.14, 0.18):
        g.box((0, y, 0.113), (0.05, 0.016, 0.006), "dark")                              # top vents
    g.box((0, 0.12, 0.14), (0.03, 0.12, 0.04), "gm")                                    # scope
    g.box((0, 0.185, 0.14), (0.022, 0.006, 0.026), "lens")
    _guard(g, 0.05, -0.04)
    return Vector((0, 0.46, 0.06))


def shotgun(g):
    g.box((0, 0.05, 0.06), (0.085, 0.26, 0.11), "steel", top="sole")                    # receiver
    g.tube(0.18, 0.5, 0, 0.08, 0.038, "steelL", cap="dark")                             # a wide barrel
    g.tube(0.18, 0.44, 0, 0.02, 0.026, "gmD")                                           # the magazine tube under it
    g.box((0, 0.33, 0.015), (0.08, 0.13, 0.065), "rust", top="rO1")                     # wooden pump grip
    g.box((0, -0.19, 0.045), (0.07, 0.22, 0.11), "rust", top="rO1")                     # and stock
    g.box((0, 0.0, -0.03), (0.05, 0.055, 0.1), "dark")
    for k in range(4):                                                                  # a row of shells on the side
        g.box((0.045, 0.0 + k * 0.03, 0.065), (0.008, 0.022, 0.035), "medRed")
    for y in (0.3, 0.33, 0.36):
        g.box((0, y, 0.049), (0.085, 0.01, 0.006), "rust")       # pump grooves
    g.box((0, 0.34, 0.12), (0.02, 0.32, 0.008), "dark")                                # barrel rib
    _guard(g, 0.05, -0.04)
    return Vector((0, 0.51, 0.08))


def smg(g):
    g.box((0, 0.08, 0.06), (0.075, 0.3, 0.095), "gm", top="steelL")                     # body
    g.tube(0.23, 0.42, 0, 0.065, 0.022, "gmD", cap="dark")                              # short barrel
    g.box((0, 0.13, -0.08), (0.05, 0.07, 0.19), "dark")                                 # long vertical magazine
    g.box((0, 0.33, -0.005), (0.045, 0.045, 0.09), "dark")                              # foregrip
    g.box((0, -0.18, 0.05), (0.045, 0.24, 0.06), "gmD")                                 # folding stock
    g.box((0, 0.0, -0.03), (0.05, 0.055, 0.1), "dark")
    g.tube(0.23, 0.36, 0, 0.065, 0.034, "gmD")                                          # barrel shroud
    for y in (0.26, 0.3, 0.34):
        _panel(g, y, 0.065, 0.016, 0.02, "dark", 0.033)                                  # its holes
    g.box((0, 0.1, 0.125), (0.03, 0.08, 0.035), "dark")                                 # sight
    _panel(g, 0.12, 0.075, 0.06, 0.025, "dark", 0.0375)                                 # ejection port
    _guard(g, 0.05, -0.04)
    return Vector((0, 0.43, 0.065))


def rail_rifle(g):
    g.box((0, 0.0, 0.06), (0.08, 0.24, 0.1), "gmD", top="gm")                           # breech
    g.box((0, 0.36, 0.06), (0.05, 0.62, 0.06), "steel", top="sole")                     # the long slim rail
    for y in (0.27, 0.38, 0.49, 0.6):
        g.tube(y - 0.014, y + 0.014, 0, 0.06, 0.048, "cyan")                           # rail rings, cyan
    g.box((0, -0.18, 0.05), (0.06, 0.24, 0.09), "dark")                                 # stock
    g.box((0, 0.0, -0.03), (0.05, 0.055, 0.1), "dark")
    for y in (-0.06, 0.0, 0.06):
        _panel(g, y, 0.06, 0.04, 0.06, "gm", 0.04)                # capacitor cells on the breech
    g.box((0, 0.02, 0.13), (0.035, 0.16, 0.04), "dark")                                 # long scope
    g.box((0, 0.105, 0.13), (0.026, 0.006, 0.03), "lens")
    _guard(g, 0.05, -0.04)
    return Vector((0, 0.68, 0.06))


def flamethrower(g):
    g.box((0, 0.05, 0.05), (0.13, 0.3, 0.13), "medRed", top="drM")                       # fuel body
    g.tube(0.2, 0.5, 0, 0.06, 0.034, "steel")                                           # the wand
    g.tube(0.5, 0.57, 0, 0.06, 0.058, "steelD", cap="dark")                             # the wide nozzle
    g.box((0, 0.53, -0.01), (0.035, 0.035, 0.035), "flameY")                            # pilot light
    g.box((0, 0.1, 0.18), (0.04, 0.22, 0.04), "dark")                                   # top handle
    for y in (0.0, 0.2):
        g.box((0, y, 0.14), (0.04, 0.035, 0.05), "dark")
    g.box((0, -0.12, 0.03), (0.06, 0.06, 0.06), "dark")                                 # the hose coupling
    g.box((0, 0.27, 0.0), (0.045, 0.05, 0.1), "dark")                                   # front grip (left hand)
    g.box((0, 0.0, -0.04), (0.055, 0.065, 0.12), "dark")
    g.tube(0.11, 0.14, 0.068, 0.09, 0.025, "steelL", cap="sole")                       # a pressure gauge
    _panel(g, 0.05, 0.02, 0.3, 0.02, "hazK", 0.065)                                     # a dark band round the tank
    for y in (0.3, 0.38, 0.46):
        g.tube(y - 0.008, y + 0.008, 0, 0.06, 0.042, "steelD")                         # wand grip rings
    return Vector((0, 0.58, 0.06))


def blade(g):
    g.box((0, 0.0, 0.0), (0.05, 0.11, 0.055), "dark")                                  # handle in the fist
    g.box((0, 0.065, 0.0), (0.06, 0.025, 0.08), "steelD")                               # guard
    g.box((0, 0.26, 0.015), (0.03, 0.36, 0.085), "steelL", top="sole")                  # a machete blade
    g.box((0, 0.26, -0.033), (0.026, 0.36, 0.014), "sole")                              # the bright edge
    for y in (-0.03, 0.0, 0.03):
        g.box((0, y, 0.0), (0.056, 0.012, 0.06), "leather")                             # handle wrap
    g.box((0, -0.065, 0.0), (0.06, 0.022, 0.06), "steelD")                              # pommel
    return Vector((0, 0.44, 0.015))


def shock_baton(g):
    g.box((0, 0.0, 0.0), (0.055, 0.12, 0.055), "dark")
    g.tube(0.06, 0.38, 0, 0, 0.026, "gmD")                                              # shaft
    g.tube(0.38, 0.44, 0, 0, 0.036, "arc")                                              # the live tip
    for y in (-0.03, 0.0, 0.03):
        g.box((0, y, 0.0), (0.061, 0.012, 0.061), "steelD")                             # grip bands
    g.tube(0.06, 0.09, 0, 0, 0.034, "steel")                                            # guard collar
    g.box((0, 0.22, 0.027), (0.012, 0.08, 0.006), "arc")                                # a lit charge strip
    return Vector((0, 0.45, 0))


def breach_axe(g):
    g.tube(-0.3, 0.55, 0, 0, 0.026, "leather")                                         # long haft
    g.box((0, 0.5, 0.1), (0.05, 0.12, 0.2), "steel", top="steelL")                      # the head's blade
    g.box((0, 0.5, -0.05), (0.045, 0.09, 0.1), "steelD")                                # its back spike
    g.box((0, 0.5, 0.205), (0.04, 0.12, 0.012), "sole")                                 # the bright edge
    _panel(g, 0.5, 0.11, 0.06, 0.05, "hazY", 0.025)                                     # a hazard-yellow flash
    for y in (-0.25, -0.2, -0.15, 0.0, 0.05):
        g.tube(y - 0.01, y + 0.01, 0, 0, 0.03, "dark")                                 # grip wraps
    return Vector((0, 0.5, 0.2))


BUILD = {"sidearm": sidearm, "ion_pistol": ion_pistol, "laser_pistol": laser_pistol, "plasma_cutter": plasma_cutter,
         "rifle": rifle, "laser_rifle": laser_rifle, "shotgun": shotgun, "smg": smg, "rail_rifle": rail_rifle,
         "flamethrower": flamethrower, "heavy_repeater": heavy_repeater, "blade": blade, "shock_baton": shock_baton,
         "breach_axe": breach_axe}


def _hip_cell(A, R):
    """The plasma cutter's power cell on the right hip and the hose up to the tool: segments blended from the hips to the
    hand, so the hose stretches between them in any pose."""
    b = Build()
    cell = R.hips + Vector((-0.17, 0.02, -0.02))
    b.blob(cell, 0.045, 0.05, 0.07, W("hips"), exp=3.0, nlat=6)
    bone = A.data.bones["hand.R"]
    tool = bone.matrix_local @ Vector((0.0, grip_y(A) - 0.09 * SIZE, 0.04 * SIZE))
    pts = [cell.lerp(tool, t) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
    for k in range(4):
        b.tube(pts[k], pts[k + 1], 0.016, 0.016, blend("hips", "hand.R", (k + 0.5) / 4))
    return b.mesh("v2.weapon.plasma_cell", A, lambda p, n: "hazY" if (p - cell).length < 0.06 else "dark")


def fuel_tanks(A, R):
    """The flamethrower's twin fuel tanks on the back, red with steel caps and a strap."""
    b = Build()
    w = W("spine_03")
    base = Vector((0, R.chest.y + 0.19, R.chest.z - 0.04))
    for sx in (1, -1):
        c = base + Vector((sx * 0.065, 0, 0))
        b.tube(c - Vector((0, 0, 0.16)), c + Vector((0, 0, 0.14)), 0.06, 0.06, w)
    b.blob(base + Vector((0, -0.04, 0.0)), 0.13, 0.02, 0.025, w, exp=3.0, nlat=6)

    def col(p, n):
        if abs(p.z - base.z) < 0.03 and p.y < base.y - 0.02:
            return "dark"                                                    # the strap
        return "steelL" if abs(p.z - base.z) > 0.12 else "medRed"
    return Item("gear.back", "fuel_tanks", [b.mesh("v2.fuel_tanks", A, col)])


def _axes(fwd, up):
    fwd = fwd.normalized()
    right = fwd.cross(up).normalized()
    return right, fwd, right.cross(fwd).normalized()


def _carry(A, R, name, g):
    """(bone, frame) where a weapon rides out of the hands, and extra pieces on the Gun: a sheath, a back frame."""
    how = CARRY[FAMILY[name]]
    back = Vector((0, R.chest.y + 0.17, R.chest.z - 0.04))
    if how == "thigh":                                                       # right thigh holster, muzzle down
        g.box((0, 0.14, 0.045), (0.1, 0.27, 0.13), "leather", top="strap")             # the holster over the slide
        return "leg.R", (R.h["leg.R"] + Vector((-0.12, 0.0, 0.02)),) + _axes(Vector((0, 0.05, -1)), Vector((0, -1, 0)))
    if how == "belt":                                                        # left hip, hanging, flat side out
        if name == "blade":
            g.box((0, 0.26, 0.015), (0.05, 0.38, 0.11), "leather", top="strap")
        return "hips", (R.h["leg.L"] + Vector((0.14, 0.03, 0.02)),) + _axes(Vector((0.1, 0.25, -1)), Vector((1, 0, 0)))
    if how == "sling":                                                       # across the back, muzzle up-left
        f = Vector((0.55, 0.0, 0.83)).normalized()
        return "spine_03", (back - f * 0.14 * SIZE,) + _axes(f, Vector((0, 1, 0)))
    if name == "flamethrower":                                               # the wand clipped by its tanks
        return "spine_03", (back + Vector((-0.16, 0.04, -0.2)),) + _axes(Vector((0, 0, 1)), Vector((0, 1, 0)))
    g.box((0.12, 0.15, 0.06), (0.06, 0.4, 0.06), "dark")                              # stowed upright on a back frame
    return "spine_03", (back + Vector((0.0, 0.05, -0.22)),) + _axes(Vector((0, 0, 1)), Vector((0, 1, 0)))


def _sling_strap(A, R):
    """The strap of a slung weapon across the chest, from the left shoulder to the right hip."""
    b = Build()
    pts = [Vector((0.13, R.chest.y - 0.1, R.shoulder_z + 0.01)), Vector((0.03, R.chest.y - 0.15, R.chest.z)),
           Vector((-0.08, R.chest.y - 0.15, R.hips.z + 0.18)), Vector((-0.15, R.hips.y - 0.1, R.hips.z + 0.06))]
    for k in range(3):
        b.tube(pts[k], pts[k + 1], 0.017, 0.017, blend("spine_03", "hips", k / 2))
    return b.mesh("v2.sling_strap", A, lambda p, n: "strap")


def holster(A, R, name):
    g = Gun()
    BUILD[name](g)
    bone, frame = _carry(A, R, name, g)
    objs = [g.mesh(f"v2.holster.{name}", A, bone, frame)]
    if CARRY[FAMILY[name]] == "sling":
        objs.append(_sling_strap(A, R))
    return Item("gear.holster", name, objs, glow=g.lit())


def build(A, R):
    out = [fuel_tanks(A, R)]
    for name, fn in BUILD.items():
        g = Gun(melee=FAMILY[name] in ("1m", "2m"))
        muzzle = fn(g)
        objs = [g.mesh(f"v2.weapon.{name}", A)] + ([_hip_cell(A, R)] if name == "plasma_cutter" else [])
        it = Item("gear.hand", name, objs, glow=g.lit())
        it.muzzle = to_hand(A, muzzle, g.melee)                     # wrist frame (hand.R local), for crew_build
        it.family = FAMILY[name]
        out += [it, holster(A, R, name)]
    return out
