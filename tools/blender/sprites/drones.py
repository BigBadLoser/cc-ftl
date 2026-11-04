"""Drones (#318) and the drone bay: models (robot_kit rigs, runs inside Blender). PROTOTYPE for look review.

A drone is a small quad-ducted machine of the ship's AI core: not crew, not a robot, its own family, in the robots'
language (smooth livery shell `team.cloth` over a dark frame, a `team.accent` seam, one cyan eye in dark glass).
One chassis for every type: a rounded hull pod with four ring thruster pods on short arms (the robots' repair drone is
a walker-sized shell with arms; these are rounder, thruster-borne (they fly in space too), about 1.25 tiles across). Per type: a coloured marker on the
shell and a working part under the nose.
  defence  a twin gun pod; working = muzzle flash
  repair   a jointed tool arm with a welder; working = sparks at the tip
  medic    an emitter lens; working = a treatment light cone down to the patient

Character frame (robot_kit): x = the drone's right, f = forward, z up, tiles; the root sits at the drone's centre, so a
sprite's anchor is the drone itself and the renderer lifts it by its altitude over a separate floor shadow
(`drone.shadow`). Faces +f at THETA[d] like the crew (d0 = grid +x, clockwise).

Drone bay (2x2, a weapon bay round its roof hatch): an open launch cage with two stacked lift cradles (see `bay`).
Thruster pods are hollow rings round a bell on four vanes, its lip lit while firing. The medic's treatment light is a separate layer (BEAM_ALPHA): a
sprite's own opacity is all or nothing, so the runtime draws it see-through over the drone's patient."""
import math
from . import core, detail as D
from . import turret_concepts as TC
from .cmbkit import Frame
from .robot_kit import Rig
from .turret_bay_laser import FRONT, P, hazard_ring, obox

CLOTH, ACCENT = "team.cloth", "team.accent"
FRAME, FRAME_L, MID = "dark", "steelD", "gm"
EYE = "cyan"
MARK = {"defence": "medRed", "repair": "hivis", "medic": "medWhite"}
SCALE = 2.3         # about 1.25 tiles across the pods
BEAM_ALPHA = 0.45   # the medic's treatment light: its own sprite layer (tag "beam"), drawn see-through at this opacity
PADS = (0.34, 1.36)  # the bay's cradle pad tops (lower, upper)
DOCK_DZ = 0.23       # drone centre over its pad when docked (its belly, 0.1 * SCALE under it, on the dish)
CAGE = 0.9           # bay cage radius (the drones span 0.78 across the pods)
BACK = FRONT + math.pi
RAIL_W = 0.3         # the lift rails either side of the back


def _pod(p, x, f, z, firing):
    """A thruster pod (no air to push in space): a hollow livery ring (dark inside, open through the middle) round a
    thruster bell hung mouth-down on four stator vanes, its lip lit while firing."""
    ro, ri, h, n = 0.092, 0.062, 0.05, 24
    xf = p._xf((x, f, z), None, "z")
    circ = [(math.cos(math.tau * i / n), math.sin(math.tau * i / n)) for i in range(n)]
    oa, ob = p._ring(circ, -h / 2, ro, xf), p._ring(circ, h / 2, ro, xf)
    ia, ib = p._ring(circ, -h / 2, ri, xf), p._ring(circ, h / 2, ri, xf)
    ta, tb = p._ring(circ, h / 2, ri, xf), p._ring(circ, h / 2, ro, xf)       # flat lips on their own verts
    ba, bb = p._ring(circ, -h / 2, ri, xf), p._ring(circ, -h / 2, ro, xf)
    for i in range(n):
        j = (i + 1) % n
        p._face([oa + i, oa + j, ob + j, ob + i], CLOTH, True)                  # outer wall
        p._face([ia + j, ia + i, ib + i, ib + j], FRAME, True)                  # inner wall (the dark throat)
        p._face([ta + i, tb + i, tb + j, ta + j], CLOTH, False)                 # top lip
        p._face([ba + j, bb + j, bb + i, ba + i], FRAME, False)                 # bottom lip
    p.cyl((x, f, z - 0.026), 0.048, 0.056, MID, sides=16, taper=0.6)           # bell (mouth below the ring)
    p.cyl((x, f, z - 0.05), 0.05, 0.012, "cyan" if firing else FRAME_L, sides=16)   # its lip, lit while firing
    p.cyl((x, f, z + 0.008), 0.026, 0.016, MID, sides=12, top=FRAME_L)        # injector head
    for k in range(4):
        a = math.radians(45 + 90 * k)
        L0, L1 = 0.02, ri + 0.004
        c = (x + math.cos(a) * (L0 + L1) / 2, f + math.sin(a) * (L0 + L1) / 2, z + 0.006)
        p.box(c, (L1 - L0, 0.022, 0.014), FRAME_L, rot=(0, 0, math.degrees(a)))   # stator vane into the ring wall


def drone(kind, state="fly", frame=0):
    """state: fly (hover, frame 0..3 bobs), work, docked (thrusters off), inert (thrusters off, eye dark)."""
    rig = Rig(f"drone_{kind}")
    b = rig.joint("body", "root", (0, 0, 0))
    p = rig.part(b)
    firing = state in ("fly", "work")
    p.rbox((0, 0, -0.06), (0.2, 0.26, 0.08), FRAME, r=0.05, taper=1.15)                    # belly
    p.rbox((0, 0, 0.0), (0.24, 0.3, 0.02), ACCENT, r=0.07)                                 # seam
    p.rbox((0, -0.01, 0.02), (0.24, 0.3, 0.09), CLOTH, r=0.08, taper=0.72)                 # shell
    p.rbox((0, 0.15, -0.025), (0.13, 0.05, 0.07), FRAME, r=0.025)                          # sensor glass
    rig.part(b, "eye").ball((0, 0.175, -0.012), 0.022, EYE if state != "inert" else FRAME_L)
    p.rbox((0, -0.02, 0.07), (0.13, 0.15, 0.014), MARK[kind], r=0.03)                        # type marker on the shell top
    if kind == "medic":
        p.box((0, -0.02, 0.08), (0.08, 0.026, 0.008), "medRed")
        p.box((0, -0.02, 0.08), (0.026, 0.08, 0.008), "medRed")
    for sx in (1, -1):
        for sf in (1, -1):
            x, f = sx * 0.19, sf * 0.16
            p.plate((sx * 0.07, sf * 0.06, -0.016), (x, f, -0.016), 0.04, 0.03, FRAME, r=0.01)   # pod arm
            _pod(p, x, f, 0.0, firing)
    if kind == "defence":
        p.rbox((0, 0.06, -0.12), (0.11, 0.13, 0.06), MID, r=0.02)                          # gun pod
        p.rbox((0, 0.06, -0.09), (0.11, 0.13, 0.012), "medRed", r=0.02)                    # its red band
        for dx in (-0.024, 0.024):
            p.cyl((dx, 0.15, -0.12), 0.014, 0.13, FRAME_L, axis="f", sides=8)              # twin barrels
        if state == "work":
            rig.part(b, "flash").ball((0, 0.21, -0.1), 0.04, "flameY")
            rig.part(b, "flash").ball((0, 0.25, -0.1), 0.025, "flameW")
    elif kind == "repair":
        p.cyl((0, 0.04, -0.1), 0.025, 0.04, FRAME_L, axis="x", sides=10)                  # shoulder hinge
        reach = 0.16 if state == "work" else 0.1
        p.plate((0, 0.04, -0.1), (0, 0.04 + reach, -0.16), 0.03, 0.03, MID, r=0.01)       # arm
        p.plate((0, 0.04 + reach, -0.16), (0, 0.08 + reach, -0.2), 0.022, 0.022, FRAME_L, r=0.008)  # welder
        if state == "work":
            rig.part(b, "spark").ball((0, 0.1 + reach, -0.22), 0.03, "arc")
            for dx, dz in ((0.04, 0.01), (-0.035, -0.02), (0.02, -0.04)):
                rig.part(b, "spark").ball((dx, 0.1 + reach + 0.02, -0.22 + dz), 0.012, "flameW")
    elif kind == "medic":
        p.cyl((0, 0.07, -0.13), 0.035, 0.035, FRAME_L, sides=14)                          # emitter
        p.cyl((0, 0.07, -0.135), 0.026, 0.006, "lens", sides=14)
        if state == "work":                                                                # treatment light cone
            rig.part(b, "beam").cyl((0, 0.07, -0.28), 0.07, 0.26, "green", sides=16, taper=0.35)   # to a patient on the deck at cruise height
    rig.build()
    rig.root.scale = (SCALE,) * 3
    if state == "fly":
        rig.root.location.z += 0.012 * math.sin(math.tau * frame / 4)
    if state == "inert":
        rig.root.rotation_euler = (math.radians(14), math.radians(-9), 0)
    return rig


def shadow():
    """The floor shadow under a flying drone (drawn translucent by the renderer, its size by altitude)."""
    rig = Rig("drone_shadow")
    rig.part("root").cyl((0, 0, 0.0), 0.2 * SCALE / 1.15, 0.004, "black", sides=32)
    rig.build()
    return rig


def _cradle(f, z, lit):
    """One lift cradle with its pad top at z: a carriage riding the two back rails, two arms forward to a ring round a
    dish, three charge contacts on the ring (lit while charging)."""
    TC._g("cradle")
    obox(f, BACK, CAGE - 0.22, CAGE - 0.06, 0.4, z - 0.24, z - 0.02, "gm", "steel")           # carriage
    for t in (-1, 1):
        obox(f, BACK, CAGE - 0.08, CAGE - 0.02, 0.05, z - 0.22, z - 0.04, "steelD", "steelL", off=t * RAIL_W)   # rollers
        obox(f, BACK, 0.36, CAGE - 0.2, 0.06, z - 0.14, z - 0.06, "steelD", "steel", off=t * 0.2)               # arms
    TC.vannulus(f, 0.44, 0.34, z - 0.08, z, "steelD", "steel", sides=32)                       # ring
    f.vcyl(0, 0, z - 0.07, 0.345, 0.05, "gm", top="steelD", sides=32)                           # dish
    for k in range(3):
        u, v = P(FRONT + math.pi / 3 + k * math.tau / 3, 0.39)
        f.box(u, v, z, 0.07, 0.07, 0.04, "steelD", top=lit)                                     # charge contacts


def bay(docked=0, charging=False):
    """The bay (2x2, weapon-bay frame: u = grid +x, v = grid +y, origin the footprint centre at floor level). An open
    launch cage under the roof hatch at the drones' span: a foot ring and a roof collar (the hatch's coaming), two
    lift rails at the back, four posts, the front open. Two cradles ride the rails, stacked: the top drone launches
    straight up through the hatch and the lift brings the other up behind it. A hazard keep-clear ring on the floor; the
    charger cabinet in the back corner, a capacitor can and a console in the side corners. Holds `docked` drones
    (0..2: the top cradle fills first)."""
    m = core.Mesh("drone_bay")
    f = Frame(m, 1, square=True)
    lit = "cyan" if charging else "steelD"
    TC._g("cage")
    hazard_ring(f, 0.56, 0.66)
    TC.vannulus(f, CAGE + 0.06, CAGE - 0.06, 0, 0.08, "steelD", "steel")                       # foot ring
    TC.vannulus(f, CAGE + 0.08, CAGE - 0.08, TC.ZR - 0.12, TC.ZR, "steelD", "steelL")          # roof collar
    TC.vannulus(f, CAGE - 0.08, CAGE - 0.14, TC.ZR - 0.06, TC.ZR, "steel", "steelL")           # its inner lip
    for a in (FRONT + 1.0, FRONT - 1.0, FRONT + 2.1, FRONT - 2.1):
        u, v = P(a, CAGE)
        D.seg(f, (u, v, 0.08), (u, v, TC.ZR - 0.12), 0.045, "steel", 8)                        # posts
    for t in (-1, 1):
        obox(f, BACK, CAGE - 0.04, CAGE + 0.06, 0.05, 0.08, TC.ZR - 0.12, "steelD", "steelL", off=t * RAIL_W)  # rails
    obox(f, BACK, CAGE + 0.06, CAGE + 0.2, 0.22, TC.ZR - 0.5, TC.ZR - 0.12, "gm", "steel")    # lift drive
    TC._g("gear")
    obox(f, BACK, 1.0, 1.24, 0.13, 0, 1.25, "gm", "steelL")                                    # charger cabinet
    obox(f, BACK, 1.24, 1.25, 0.08, 0.7, 1.1, "dark", "dark")                                  # its vent
    for k in range(3):
        u, v = P(BACK, 1.0)
        f.box(u, v, 0.86 + k * 0.1, 0.05, 0.05, 0.04, "dark", base=False)
    for z in PADS:
        _cradle(f, z, lit)
    obs = [m.build()]
    for k, z in enumerate(reversed(PADS[2 - docked:])):
        d = drone(("repair", "medic")[k], "docked")
        d.root.location = (0, 0, z + DOCK_DZ)
        d.root.rotation_euler = (0, 0, math.radians(45))
        obs += d.objects()
    return obs
