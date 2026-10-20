"""Cryo pod (family `cryo`): 1x2, idle / `.active` / `.empty`, four rotations. A pod first, built in the robots'
language (robot_kit primitives, as the robot bay): crisp light shell plates and dark seams over a dark exposed frame,
hinge discs at the mounts, a single round status light set in a dark band, flush cells and lit seams for the only glow.

Built in the robot_kit character frame with x = -u and f = +v of the module frame (modkit: front = +v, origin at the
middle of the footprint), then turned and placed like modkit.K, so it lines up with every other module.

A round capsule on the back tile, hung in a dark frame yoke by two big hinge discs and leaning back a little, sitting
in a dark cradle on a plinth with light skirt plates. Its top: a dark coolant collar with vents (the status light set
in it) under a flattened lens cap and a manifold. Its door is a curved section of the shell with a curved window, cut
lines down its sides; it slides round the capsule to open onto a real cavity (couch, headrest, straps, footrest). A
cooling pack on its back feeds coolant lines into the plinth; the front tile is the access step, hazard lip and cells.
  idle    closed, unpowered: dark glass, light and cells off
  active  occupied and frozen: the window frosted, a figure faintly behind it, the door seams, light and cells cyan
  empty   the door slid round to the side, the cavity open, light green (ready)"""
import math

import bpy

from . import core
from .modkit import sprites
from .robot_kit import Rig

SHELL, SHELL_D, FRAME, FRAME_L = "sole", "plate", "dark", "steelD"
FB = -0.45                                # capsule centre line (back tile)
Z0, Z1 = 0.46, 1.34                       # capsule body between its two domes
CW, CD = 0.6, 0.6                         # capsule width, depth (round: the door slides round it)
PIVOT, TILT = 0.95, math.radians(12)     # the yoke's hinge discs; the capsule leans back about them
RIM, DEEP = 0.08, 0.3                     # solid band above and below the cavity; its back wall (section scale)
A, B = CW / 2, CD / 2                     # the capsule's elliptical section
CF = FB + B                               # its front
DOOR = math.radians(50)                   # the door's half-arc round the front


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
    behind it when frozen), on a joint at the capsule's axis: it opens by sliding round the capsule."""
    j = rig.joint("door", "pod", (0, FB, 0))
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
    return j


def _hollow(p, n=10):
    """The capsule's middle section: the shell round the back and sides, open at the front behind the door into a
    cavity with side walls and a curved back wall at DEEP (a shade darker than the shell). Corners get their own vertices, so the
    smooth shading keeps them crisp."""
    lo, hi = math.pi / 2 - DOOR, math.pi / 2 + DOOR
    pt = lambda t, s: (A * s * math.cos(t), B * s * math.sin(t))                      # noqa: E731
    outer = [pt(hi + (2 * math.pi - 2 * DOOR) * i / (3 * n), 1.0) for i in range(3 * n + 1)]
    inner = [pt(lo + 2 * DOOR * i / n, DEEP) for i in range(n + 1)]
    segs = [(outer, SHELL), ([outer[-1], inner[0]], "steelL"), (inner, "steelL"), ([inner[-1], outer[0]], "steelL")]
    z0, z1 = Z0 + RIM, Z1 - RIM
    xf = p._xf((0, FB, (z0 + z1) / 2), None, "z")
    for pts, col in segs:                                                             # each run on its own verts
        a, b = p._ring(pts, -(z1 - z0) / 2, 1.0, xf), p._ring(pts, (z1 - z0) / 2, 1.0, xf)
        for i in range(len(pts) - 1):
            p._face([a + i, a + i + 1, b + i + 1, b + i], col, col == SHELL)


def _tilt(x, f, z):
    """A character-frame point on the capsule, as it stands leaning back TILT about the hinge discs."""
    df, dz = f - FB, z - PIVOT
    return x, FB + df * math.cos(TILT) - dz * math.sin(TILT), PIVOT + df * math.sin(TILT) + dz * math.cos(TILT)


def _cut(p, sg, col=FRAME):
    """A cut line down one side of the door (lit when the pod runs)."""
    a0, a1 = DOOR, DOOR + math.radians(5)
    arc = [a0 + (a1 - a0) * i / 3 for i in range(4)]
    pts = [_sec(a, 1.03) for a in arc] + [_sec(a, 0.995) for a in arc[::-1]]
    if sg < 0:
        pts = [(-x, f) for x, f in pts][::-1]
    p._loft(pts, Z1 - Z0 - 0.08, col, None, 1.0, p._xf((0, FB, (Z0 + Z1) / 2), None, "z"))


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
    p.rbox((0, FB + 0.07, 0.26), (0.5, 0.46, 0.2), FRAME, r=0.08, taper=1.2)                   # cradle cup
    pod = rig.joint("pod", "root", (0, FB, PIVOT))                                             # the capsule, on the
    q = rig.part(pod)                                                                          # yoke's hinge discs:
    q.ball((0, FB, Z0), (CW / 2, CD / 2, 0.24), SHELL, rot=(180, 0, 0), z0=0.0)                # domes,
    ell = [(A * math.cos(math.tau * i / 28), B * math.sin(math.tau * i / 28)) for i in range(28)]
    for z0, z1 in ((Z0, Z0 + RIM), (Z1 - RIM, Z1)):                                           # body: solid bands
        q._loft(ell, z1 - z0, SHELL, SHELL_D, 1.0, q._xf((0, FB, (z0 + z1) / 2), None, "z"))  # (the cavity's floor
    _hollow(q)                                                                                 # and ceiling), hollow
                                                                                               # between them
    col = [(A * 0.97 * math.cos(math.tau * i / 28), B * 0.97 * math.sin(math.tau * i / 28)) for i in range(28)]
    q._loft(col, 0.08, FRAME_L, FRAME, 1.0, q._xf((0, FB, Z1 + 0.04), None, "z"))           # coolant collar,
    for i in range(10):                                                                        # its vents,
        t = math.pi / 2 + 0.55 + i * (math.tau - 1.1) / 9
        q.box((A * 0.985 * math.cos(t), FB + B * 0.985 * math.sin(t), Z1 + 0.04), (0.04, 0.04, 0.045), FRAME,
              rot=(0, 0, math.degrees(t)))
    rim = [(A * 1.01 * math.cos(math.tau * i / 28), B * 1.01 * math.sin(math.tau * i / 28)) for i in range(28)]
    q._loft(rim, 0.025, SHELL_D, None, 1.0, q._xf((0, FB, Z1 + 0.09), None, "z"))            # a light rim,
    q.ball((0, FB, Z1 + 0.1), (A, B, 0.12), SHELL, z0=0.0)                                     # the lens cap
    q.cyl((0, FB, Z1 + 0.2), 0.11, 0.05, FRAME, top=FRAME)                                     # and its manifold
    q.cyl((0, FB, Z1 + 0.25), 0.075, 0.015, SHELL_D, top=SHELL_D)
    q.rbox((0, FB - B - 0.03, (Z0 + Z1) / 2), (0.34, 0.1, 0.62), FRAME, r=0.03)               # cooling pack on the
    q.rbox((0, FB - B - 0.07, (Z0 + Z1) / 2 + 0.04), (0.3, 0.04, 0.46), SHELL_D, r=0.02, taper=0.9)   # back: plate
    for k in range(4):                                                                         # and vent slats
        q.box((0, FB - B - 0.093, Z0 + 0.22 + k * 0.06), (0.22, 0.012, 0.025), FRAME)
    ring = [(A * 1.02 * math.cos(math.tau * i / 28), B * 1.02 * math.sin(math.tau * i / 28)) for i in range(28)]
    for z in (Z0 + 0.035, Z1 - 0.035):                                                         # seam bands
        q._loft(ring, 0.03, FRAME, None, 1.0, q._xf((0, FB, z), None, "z"))
    for sg in (-1, 1):                                                                         # the door's cut lines
        _cut(q, sg, "cyan" if on else FRAME)
    _band(q, math.radians(30), DEEP, DEEP + 0.16, Z0 + RIM + 0.06, Z1 - RIM - 0.2, "navy")      # in the cavity: the
    _band(q, math.radians(20), DEEP, DEEP + 0.2, Z1 - RIM - 0.17, Z1 - RIM - 0.05, "navy")      # padded couch,
    for z in (Z0 + 0.42, Z0 + 0.66):                                                           # headrest, straps,
        _band(q, math.radians(31), DEEP + 0.16, DEEP + 0.18, z, z + 0.04, FRAME_L)
    _band(q, math.radians(36), DEEP, 0.92, Z0 + RIM, Z0 + RIM + 0.05, SHELL)                    # a footrest ledge
    for sx in (-1, 1):                                                                         # the yoke: uprights
        p.rbox((sx * 0.4, FB, 0.55), (0.08, 0.14, 0.78), FRAME, r=0.03)                         # with shell plates,
        p.rbox((sx * 0.445, FB, 0.52), (0.035, 0.16, 0.54), SHELL, r=0.015, taper=0.8)          # hinge discs holding
        p.cyl((sx * 0.39, FB, 0.95), 0.1, 0.1, FRAME_L, axis="x", top=FRAME)                    # the capsule
        p.cyl((sx * 0.45, FB, 0.95), 0.06, 0.03, SHELL_D, axis="x")
    for sx in (-1, 1):                                                                         # coolant lines from
        top = _tilt(sx * 0.09, FB - B - 0.05, Z0 + 0.2)                                         # the pack into the
        p.strut(top, (sx * 0.09, top[1], 0.14), 0.032, FRAME)                                    # plinth
        p.cyl((sx * 0.09, top[1], 0.17), 0.045, 0.04, FRAME_L)
    rig.part(pod).ball((0, FB + B * 0.97 + 0.005, Z1 + 0.04), (0.045, 0.02, 0.03), light)   # the status light, set in
                                                                                               # the collar under the cap
    p.rbox((0, 0.12, 0.03), (0.56, 0.42, 0.06), SHELL_D, r=0.04, top=SHELL)                    # access step off the
    p.rbox((0, 0.33, 0.028), (0.56, 0.035, 0.05), "hazY", r=0.01)                               # plinth, hazard lip,
    for k in range(4):                                                                         # life-support cells
        p.box((-0.15 + k * 0.1, 0.26, 0.062), (0.07, 0.05, 0.012), "cyan" if on else FRAME)
    door = _door(rig, state)
    rig.build()
    rig.joints[pod][0].rotation_euler = (-TILT, 0, 0)                                          # leaning back
    if empty:                                                                                  # slid open round the side
        rig.joints[door][0].rotation_euler = (0, 0, -math.radians(112))
    w, d = (1, 2) if rot % 2 == 0 else (2, 1)                                                  # place like modkit.K
    rig.root.rotation_euler = (0, 0, -rot * math.pi / 2)
    rig.root.location = (-(w - 1) / 2, (d - 1) / 2, 0)
    bpy.context.view_layer.update()
    return rig.objects()


def jobs(rots=range(4)):
    return sprites("module.cryo_pod", (1, 2), ("idle", "active", "empty"), cryo, rots)
