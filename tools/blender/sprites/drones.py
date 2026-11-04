"""Drones (#318) and the drone bay: models (robot_kit rigs, runs inside Blender). PROTOTYPE for look review.

A drone is a small quad-ducted machine of the ship's AI core: not crew, not a robot, its own family, in the robots'
language (smooth livery shell `team.cloth` over a dark frame, a `team.accent` seam, one cyan eye in dark glass).
One chassis for every type: a rounded hull pod with four ducted rotors on short arms (the robots' repair drone is
a walker-sized shell with arms; these are rounder, rotor-borne, about 1.25 tiles across). Per type: a coloured marker on the
shell and a working part under the nose.
  defence  a twin gun pod; working = muzzle flash
  repair   a jointed tool arm with a welder; working = sparks at the tip
  medic    an emitter lens; working = a treatment light cone down to the patient

Character frame (robot_kit): x = the drone's right, f = forward, z up, tiles; the root sits at the drone's centre, so a
sprite's anchor is the drone itself and the renderer lifts it by its altitude over a separate floor shadow
(`drone.shadow`). Faces +f at THETA[d] like the crew (d0 = grid +x, clockwise).

Drone bay (3x2 at r0, front +y): a squat charger unit in the middle with a docking cradle either side on a tripod
(no floor slab), each a ring with three clamp fingers (their tips the charge contacts). Drones launch straight up
through a roof hatch above the cradles."""
import math
from .robot_kit import Rig

CLOTH, ACCENT = "team.cloth", "team.accent"
FRAME, FRAME_L, MID = "dark", "steelD", "gm"
EYE = "cyan"
MARK = {"defence": "medRed", "repair": "hivis", "medic": "medWhite"}
SCALE = 2.3         # about 1.25 tiles across the rotors
PAD_Z = 0.5         # top of a bay cradle's ring
DOCK_Z = PAD_Z + 0.23  # drone centre when docked (its belly, 0.1 * SCALE under it, on the dish)


def _duct(p, x, f, z, spin):
    """A ducted rotor: a livery ring, its dark throat, the rotor disc (blurred while spinning)."""
    p.cyl((x, f, z), 0.085, 0.05, CLOTH, sides=20)                         # ring (primitives are centred)
    p.cyl((x, f, z + 0.027), 0.066, 0.004, "steelL" if spin else FRAME_L, sides=20)   # rotor disc (blur when spinning)
    p.cyl((x, f, z + 0.031), 0.018, 0.008, MID, sides=10)                 # hub


def drone(kind, state="fly", frame=0):
    """state: fly (hover, frame 0..3 bobs), work, docked (rotors still), inert (rotors still, eye dark)."""
    rig = Rig(f"drone_{kind}")
    b = rig.joint("body", "root", (0, 0, 0))
    p = rig.part(b)
    spin = state in ("fly", "work")
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
            p.plate((sx * 0.07, sf * 0.06, 0.0), (x, f, 0.0), 0.04, 0.03, FRAME, r=0.01)   # rotor arm
            _duct(p, x, f, 0.0, spin)
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


def _cradle(rig, p, cx, cf, lit):
    """A docking cradle: a tripod, a ring with a hazard band round a dish, three clamp fingers whose tips are the charge
    contacts (lit while charging)."""
    for a in (90, 210, 330):
        t = math.radians(a)
        p.strut((cx + 0.42 * math.cos(t), cf + 0.42 * math.sin(t), 0.0),
                (cx + 0.3 * math.cos(t), cf + 0.3 * math.sin(t), PAD_Z - 0.08), 0.035, FRAME)       # tripod leg
    p.cyl((cx, cf, PAD_Z - 0.07), 0.5, 0.08, FRAME, sides=36)                                  # ring frame
    p.cyl((cx, cf, PAD_Z - 0.02), 0.48, 0.04, CLOTH, sides=36)                                 # ring
    p.cyl((cx, cf, PAD_Z - 0.016), 0.4, 0.04, "hazY", sides=36)                                # hazard band
    p.cyl((cx, cf, PAD_Z - 0.012), 0.33, 0.04, MID, sides=32)                                  # dish
    for a in (30, 150, 270):                                                                   # clamp fingers
        t = math.radians(a)
        x, f = cx + 0.45 * math.cos(t), cf + 0.45 * math.sin(t)
        p.rbox((x, f, PAD_Z + 0.06), (0.09, 0.09, 0.16), FRAME_L, r=0.03,
               rot=(0, 0, a))
        x2, f2 = cx + 0.4 * math.cos(t), cf + 0.4 * math.sin(t)
        rig.part("root", "contact").rbox((x2, f2, PAD_Z + 0.13), (0.07, 0.06, 0.05), lit, r=0.015, rot=(0, 0, a))


def bay(docked=0, charging=False):
    """The bay at r0: 3x2 (3 along grid +x, 2 deep, front +y; origin the centre of the front-most tile, as for every
    module). A squat charger unit in the middle of the back row, a docking cradle either side of it on a tripod, a
    power arm from the unit to each cradle. Drones launch straight up from the cradles through a roof hatch."""
    rig = Rig("drone_bay")
    p = rig.part("root")
    lit = "cyan" if charging else FRAME_L
    CF, CX = 0.12, 1.0                        # cradle centres (character frame: x = -grid u, f = grid v from centre)
    # The charger unit: a dark frame, a light shell wrapping it, a domed cap, a vent slot and two status lights.
    p.rbox((0, -0.5, 0.55), (0.56, 0.66, 1.1), FRAME, r=0.08)                                 # (top under the cap: no shared face)
    p.rbox((0, -0.47, 0.5), (0.64, 0.66, 0.84), CLOTH, r=0.12, taper=0.94)
    p.rbox((0, -0.47, 0.95), (0.64, 0.66, 0.06), ACCENT, r=0.12)
    p.rbox((0, -0.5, 1.12), (0.56, 0.58, 0.24), CLOTH, r=0.16, taper=0.75)                      # cap
    p.rbox((0, -0.13, 0.5), (0.2, 0.04, 0.5), FRAME, r=0.03)                                   # vent slot
    for k in range(4):
        p.rbox((0, -0.11, 0.33 + k * 0.11), (0.16, 0.02, 0.03), MID, r=0.008)                   # its louvres
    for sx in (1, -1):
        rig.part("root", "status").ball((sx * 0.18, -0.14, 0.8), 0.035, "cyan" if charging else "green")
        # The power arm from the unit's side to the cradle's ring.
        p.plate((sx * 0.3, -0.4, PAD_Z - 0.08), (sx * (CX - 0.46), CF - 0.12, PAD_Z - 0.08), 0.14, 0.1, FRAME, r=0.03)
        p.plate((sx * 0.3, -0.4, PAD_Z - 0.02), (sx * (CX - 0.46), CF - 0.12, PAD_Z - 0.02), 0.08, 0.04, CLOTH, r=0.015)
        _cradle(rig, p, sx * CX, CF, lit)
    rig.build()
    rig.root.location = (-1.0, 0.5, 0)        # Blender: the footprint centre, a tile toward grid -x and half toward -y
    drones = []
    for i, sx in enumerate((1, -1)[:docked]):
        d = drone(("repair", "medic")[i], "docked")
        d.root.location = (-1.0 - sx * CX, 0.5 - CF, DOCK_Z)
        drones.append(d)
    return rig, drones
