"""Drones (#318) and the drone bay: models (robot_kit rigs, runs inside Blender). PROTOTYPE for look review.

A drone is a small quad-ducted machine of the ship's AI core: not crew, not a robot, its own family, in the robots'
language (smooth livery shell `team.cloth` over a dark frame, a `team.accent` seam, one cyan eye in dark glass).
One chassis for every type: a rounded hull pod with four ducted rotors on short arms (the robots' repair drone is
a bigger, armed walker-sized shell; these are about half a tile across). Per type: a coloured marker on the
shell and a working part under the nose.
  defence  a twin gun pod; working = muzzle flash
  repair   a jointed tool arm with a welder; working = sparks at the tip
  medic    an emitter lens; working = a treatment light cone down to the patient

Character frame (robot_kit): x = the drone's right, f = forward, z up, tiles; the root sits at the drone's centre, so a
sprite's anchor is the drone itself and the renderer lifts it by its altitude over a separate floor shadow
(`drone.shadow`). Faces +f at THETA[d] like the crew (d0 = grid +x, clockwise).

Drone bay (2x1 at r0, front +y): two charging cradles side by side on legs (no floor slab), each a ring with three
charge contacts, under a backboard tower (light shell over a dark alcove, a brow plate with one status light per
cradle). Drones launch straight up through a roof hatch above the cradles."""
import math
from .robot_kit import Rig

CLOTH, ACCENT = "team.cloth", "team.accent"
FRAME, FRAME_L, MID = "dark", "steelD", "gm"
EYE = "cyan"
MARK = {"defence": "medRed", "repair": "hivis", "medic": "medWhite"}
SCALE = 1.15
PAD_Z = 0.55        # top of a bay cradle's ring
DOCK_Z = PAD_Z + 0.12  # drone centre when docked (belly on the dish, at SCALE)


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
            rig.part(b, "beam").cyl((0, 0.07, -0.52), 0.09, 0.74, "green", sides=16, taper=0.25)
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
    rig.part("root").cyl((0, 0, 0.0), 0.2, 0.004, "black", sides=24)
    rig.build()
    return rig


def bay(docked=0, charging=False):
    """The bay at r0 (2x1 along grid +x, front +y; origin the centre of the front-most tile, as for every module): a tower
    on the back half of the footprint, each cradle cantilevered off it on a braced arm (no floor slab)."""
    rig = Rig("drone_bay")
    p = rig.part("root")
    lit = "cyan" if charging else FRAME_L
    # The tower: dark frame, a light shell per cradle with a dark alcove and charge spine, a brow plate, status lights.
    p.rbox((0, -0.37, 0.56), (1.84, 0.24, 1.12), FRAME, r=0.05)                              # (primitives are centred)
    for cx in (0.5, -0.5):
        p.rbox((cx, -0.25, 0.6), (0.82, 0.05, 0.96), CLOTH, r=0.06)
        p.rbox((cx, -0.225, 0.86), (0.46, 0.03, 0.36), FRAME, r=0.04)                         # alcove
        p.rbox((cx, -0.21, 0.86), (0.05, 0.02, 0.26), MID, r=0.01)                            # charge spine
        p.rbox((cx, -0.3, 1.15), (0.84, 0.2, 0.09), CLOTH, r=0.04, taper=0.85)               # brow plate
        rig.part("root", "status").ball((cx, -0.215, 1.04), 0.028, "cyan" if charging else "green")
        # The cradle: a braced arm out of the tower, a ring with a dish, a hazard band, three charge contacts.
        p.plate((cx, -0.24, PAD_Z - 0.05), (cx, -0.06, PAD_Z - 0.05), 0.12, 0.07, FRAME, r=0.02)
        p.strut((cx, -0.24, 0.12), (cx, -0.08, PAD_Z - 0.09), 0.03, FRAME_L)                  # brace from the tower foot
        p.cyl((cx, 0.06, PAD_Z - 0.06), 0.3, 0.06, FRAME, sides=28)                           # ring frame
        p.cyl((cx, 0.06, PAD_Z - 0.015), 0.29, 0.03, CLOTH, sides=28)                         # ring
        p.cyl((cx, 0.06, PAD_Z - 0.012), 0.23, 0.028, "hazY", sides=28)                       # hazard band
        p.cyl((cx, 0.06, PAD_Z - 0.01), 0.19, 0.028, MID, sides=24)                           # dish
        for a in (90, 210, 330):
            t = math.radians(a)
            p.rbox((cx + 0.25 * math.cos(t), 0.06 + 0.25 * math.sin(t), PAD_Z + 0.015), (0.05, 0.05, 0.03), lit, r=0.012)
    p.rbox((0, -0.245, 0.58), (0.05, 0.06, 1.1), ACCENT, r=0.01)                              # accent seam, centre
    rig.build()
    rig.root.location = (-0.5, 0, 0)          # Blender: the footprint centre half a tile toward grid -x
    drones = []
    for i, cx in enumerate((0.5, -0.5)[:docked]):
        d = drone(("repair", "medic")[i], "docked")
        d.root.location = (-0.5 - cx, -0.06, DOCK_Z)
        drones.append(d)
    return rig, drones
