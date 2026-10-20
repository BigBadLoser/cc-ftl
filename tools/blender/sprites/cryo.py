"""Cryo pod (family `cryo`): 1x2, idle / `.active` / `.empty`, four rotations. A pod first, built in the robots'
language (robot_kit primitives, as the robot bay): crisp light shell plates and dark seams over a dark exposed frame,
hinge discs at the mounts, pistons, a single round status light under a small wedge brow, flush cells for the only
other glow.

Built in the robot_kit character frame with x = -u and f = +v of the module frame (modkit: front = +v, origin at the
middle of the footprint), then turned and placed like modkit.K, so it lines up with every other module.

A pill-shaped capsule standing on the back tile, hung in a dark frame yoke by two big hinge discs, sitting in a dark
cradle on a plinth with light skirt plates; pistons and coolant lines behind; a tapered dark-glass canopy plate on its
front, the status light above it; the front tile is the access step with four life-support cells.
  idle    closed, unpowered: dark glass, light and cells off
  active  occupied and frozen: the canopy frosted, a figure faintly behind it, light and cells cyan
  empty   the canopy swung open on its side hinge, the lined interior and couch, light green (ready)"""
import math

import bpy

from . import core
from .modkit import sprites
from .robot_kit import Rig

SHELL, SHELL_D, FRAME, FRAME_L = "sole", "plate", "dark", "steelD"
FB = -0.45                                # capsule centre line (back tile)
Z0, Z1 = 0.46, 1.34                       # capsule body between its two domes
CW, CD = 0.62, 0.56                       # capsule width, depth
A, B = CW / 2, CD / 2                     # the capsule's elliptical section
CF = FB + B                               # its front
DOOR = math.radians(50)                   # the door's half-arc round the front
HX, HF = A * 1.04 * math.sin(DOOR), B * 1.04 * math.cos(DOOR)   # its hinge line


def _sec(phi, s):
    """Point on the capsule section at angle phi from the front (+f), scaled s from the surface."""
    return A * s * math.sin(phi), B * s * math.cos(phi)


def _band(p, phi, s0, s1, z0, z1, col, top=None, n=14):
    """A curved panel following the capsule: the arc +-phi round the front between scales s0 and s1, from z0 to z1."""
    arc = [-phi + 2 * phi * i / n for i in range(n + 1)]
    pts = [_sec(a, s1) for a in arc[::-1]] + [_sec(a, s0) for a in arc]                 # counter-clockwise
    p._loft(pts, z1 - z0, col, top, 1.0, p._xf((0, FB, (z0 + z1) / 2), None, "z"))


def _door(rig, st):
    """The door: a curved section of the shell between the seam bands, a curved window set in it (frosted, a figure
    behind it when frozen), on its hinge joint."""
    j = rig.joint("door", "root", (HX, FB + HF, 0))
    p = rig.part(j)
    _band(p, DOOR, 1.025, 1.065, Z0 + 0.07, Z1 - 0.07, SHELL, top=SHELL_D)                    # the door
    glass = "iceB" if st == "active" else FRAME
    _band(p, math.radians(30), 1.06, 1.08, Z0 + 0.19, Z1 - 0.17, glass)                        # its window
    if st == "active":                                                                         # a figure, frost
        zc = (Z0 + Z1) / 2
        for x, z, w, h, col in ((0, zc + 0.27, 0.08, 0.1, "glassL"), (0, zc + 0.08, 0.16, 0.24, "glassL"),
                                (0, zc - 0.18, 0.11, 0.24, "glassL"), (-0.09, zc - 0.28, 0.07, 0.1, "medWhite"),
                                (0.09, zc + 0.3, 0.07, 0.1, "medWhite"), (0.11, zc - 0.05, 0.04, 0.18, "medWhite"),
                                (-0.1, zc + 0.18, 0.05, 0.08, "medWhite")):
            f = B * 1.085 * math.sqrt(max(0.0, 1 - (x / (A * 1.085)) ** 2))
            p.box((x, FB + f, z), (w, 0.01, h), col)
    for z in (Z0 + 0.16, Z1 - 0.16):                                                           # hinge knuckles
        p.cyl((HX, FB + HF, z), 0.03, 0.1, FRAME_L)
    return j


def _cut(p, sg):
    """A dark cut line down one side of the door."""
    a0, a1 = DOOR, DOOR + math.radians(5)
    arc = [a0 + (a1 - a0) * i / 3 for i in range(4)]
    pts = [_sec(a, 1.03) for a in arc] + [_sec(a, 0.995) for a in arc[::-1]]
    if sg < 0:
        pts = [(-x, f) for x, f in pts][::-1]
    p._loft(pts, Z1 - Z0 - 0.08, FRAME, None, 1.0, p._xf((0, FB, (Z0 + Z1) / 2), None, "z"))


def cryo(state, rot):
    core.clear_scene_meshes()
    on, empty = state == "active", state == "empty"
    light = {"idle": FRAME_L, "active": "cyan", "empty": "green"}[state]
    rig = Rig(f"cryo_{state}_{rot}")
    p = rig.part("root")
    p.rbox((0, FB, 0.08), (0.86, 0.82, 0.16), FRAME, r=0.05, taper=0.94)                       # plinth
    for sx in (-1, 1):
        p.rbox((sx * 0.42, FB, 0.09), (0.05, 0.7, 0.12), SHELL, r=0.02, taper=0.8)              # its skirt plates
    for k in range(2):                                                                         # vented front
        p.box((0, FB + 0.41, 0.06 + k * 0.05), (0.5, 0.02, 0.025), FRAME_L)
    p.rbox((0, FB, 0.26), (0.5, 0.46, 0.2), FRAME, r=0.08, taper=1.2)                          # cradle cup
    p.ball((0, FB, Z0), (CW / 2, CD / 2, 0.24), SHELL, rot=(180, 0, 0), z0=0.0)                # the capsule: domes,
    ell = [(A * math.cos(math.tau * i / 28), B * math.sin(math.tau * i / 28)) for i in range(28)]
    p._loft(ell, Z1 - Z0, SHELL, None, 1.0, p._xf((0, FB, (Z0 + Z1) / 2), None, "z"))       # body,
    p.ball((0, FB, Z1), (CW / 2, CD / 2, 0.24), SHELL, z0=0.0)
    ring = [(A * 1.02 * math.cos(math.tau * i / 28), B * 1.02 * math.sin(math.tau * i / 28)) for i in range(28)]
    for z in (Z0 + 0.035, Z1 - 0.035):                                                         # seam bands
        p._loft(ring, 0.03, FRAME, None, 1.0, p._xf((0, FB, z), None, "z"))
    for sg in (-1, 1):                                                                         # the door's cut lines
        _cut(p, sg)
    _band(p, DOOR, 1.0, 1.008, Z0 + 0.06, Z1 - 0.06, SHELL_D)                                  # lined interior,
    _band(p, math.radians(28), 1.008, 1.022, Z0 + 0.1, Z1 - 0.24, "navy")                       # couch,
    _band(p, math.radians(18), 1.008, 1.024, Z1 - 0.21, Z1 - 0.1, "navy")                       # headrest
    for sx in (-1, 1):                                                                         # the yoke: uprights
        p.rbox((sx * 0.4, FB, 0.55), (0.08, 0.14, 0.78), FRAME, r=0.03)                         # with shell plates,
        p.rbox((sx * 0.445, FB, 0.52), (0.035, 0.16, 0.54), SHELL, r=0.015, taper=0.8)          # hinge discs holding
        p.cyl((sx * 0.37, FB, 0.95), 0.1, 0.1, FRAME_L, axis="x", top=FRAME)                    # the capsule
        p.cyl((sx * 0.43, FB, 0.95), 0.06, 0.03, SHELL_D, axis="x")
    for sx in (-1, 1):                                                                         # pistons behind,
        a, b = (sx * 0.2, FB - 0.4, 0.16), (sx * 0.2, FB - 0.24, 0.62)
        m = tuple(a[i] + (b[i] - a[i]) * 0.55 for i in range(3))
        p.strut(a, m, 0.04, FRAME_L)
        p.strut(m, b, 0.025, SHELL_D)
    for sx in (-1, 1):                                                                         # coolant lines
        p.strut((sx * 0.08, FB - 0.25, 1.28), (sx * 0.08, FB - 0.38, 0.16), 0.03, FRAME)
    zt = Z1 + 0.13                                                                             # the status light under
    p.rbox((0, CF - 0.07, zt), (0.2, 0.1, 0.08), FRAME, r=0.025, taper=0.7)                    # a small wedge brow
    p.rbox((0, CF - 0.075, zt + 0.06), (0.3, 0.12, 0.04), SHELL, r=0.02, taper=0.8)
    rig.part("root").ball((0, CF - 0.03, zt), (0.04, 0.02, 0.032), light)
    p.rbox((0, 0.18, 0.03), (0.62, 0.76, 0.06), SHELL_D, r=0.04, top=SHELL)                    # access step
    for k in range(4):                                                                         # life-support cells
        p.box((-0.15 + k * 0.1, 0.562, 0.03), (0.07, 0.02, 0.035), "cyan" if on else FRAME)
    door = _door(rig, state)
    rig.build()
    if empty:                                                                                  # swung open on its hinge
        rig.joints[door][0].rotation_euler = (0, 0, -math.radians(100))
    w, d = (1, 2) if rot % 2 == 0 else (2, 1)                                                  # place like modkit.K
    rig.root.rotation_euler = (0, 0, -rot * math.pi / 2)
    rig.root.location = (-(w - 1) / 2, (d - 1) / 2, 0)
    bpy.context.view_layer.update()
    return rig.objects()


def jobs(rots=range(4)):
    return sprites("module.cryo_pod", (1, 2), ("idle", "active", "empty"), cryo, rots)
