"""Robot crew models (robot_kit rigs): the worker bot, the repair drone and the heavy security bot.

Character frame: x = the robot's right, f = forward, z up, tiles. Humans are 1.5 tall. Look: advanced machines, not
toys. Crisp tapered shell plates (`team.cloth`, the faction livery) over a dark exposed frame with hinge cylinders at
the joints and pistons, and a dark glass face with one glowing eye. The worker is a slender humanoid about 1.5 tall;
the heavy security chassis is hunched, armoured and reverse-jointed (about 1.6 at the shoulder plates: modelled
smaller, root scale 1.1); the drone is a hovering shell about 1.2 at the top (root scale 1.15). `team.accent` is a
thin faction seam. The eye is the only glow while running; the charge cells (green, flush in the shell) light only
in the charge clip; the drone's thruster ring and the welder tip glow while they work."""
from .robot_kit import Rig

CLOTH, ACCENT = "team.cloth", "team.accent"
EYE, BAR = "cyan", "green"
FRAME, FRAME_L = "dark", "steelD"        # exposed under-frame


def _charge_bar(rig, joint, x0, f, z, n=4, w=0.05, h=0.04, face=1):
    """n charge cells set flush into a face at depth f (face = +1 front, -1 back), tagged bar0..bar3; unlit they are
    simply not drawn."""
    for k in range(n):
        x = x0 + k * w if face > 0 else x0 + (n - 1 - k) * w
        rig.part(joint, f"bar{k}").box((x, f, z), (w - 0.01, 0.03, h), BAR)


def _hinge(p, c, r, w, color=FRAME):
    """Joint hinge: a short cylinder across the limb (x axis)."""
    p.cyl(c, r, w, color, axis="x")


def _piston(p, a, b, r=0.022):
    """Hydraulic piston from a to b: a frame sleeve, then a bright rod."""
    m = tuple((u + v) / 2 for u, v in zip(a, b))
    p.strut(a, m, r * 1.45, FRAME_L)
    p.strut(m, b, r, "steelL")


def _head(rig, hd, c, s, eye_r):
    """Smooth shell head with a dark glass face and one round eye. c = centre, s = (rx, rf, rz)."""
    x, f, z = c
    rig.part(hd).ball(c, s, CLOTH)
    rig.part(hd).ball((x, f + s[1] * 0.42, z - s[2] * 0.1), (s[0] * 0.86, s[1] * 0.66, s[2] * 0.7), "dark")
    rig.part(hd, "eye").ball((x, f + s[1] * 1.04, z - s[2] * 0.08), (eye_r, eye_r * 0.5, eye_r), EYE)


def worker():
    rig = Rig("worker")
    rig.kind = "biped"
    b = rig.joint("body", "root", (0, 0, 0.8))
    t = rig.joint("torso", b, (0, 0, 0.88))
    hd = rig.joint("head", t, (0, 0, 1.3))
    for side, x in (("R", 0.09), ("L", -0.09)):
        hp, kn, an = (x, 0, 0.78), (x, 0.01, 0.43), (x, 0, 0.09)
        h = rig.joint(f"hip_{side}", b, hp)
        k = rig.joint(f"knee_{side}", h, kn)
        a = rig.joint(f"ankle_{side}", k, an)
        rig.part(a).rbox((x, 0.04, 0.03), (0.08, 0.21, 0.06), FRAME_L, r=0.03, taper=0.7)   # foot
        _hinge(rig.part(a), an, 0.032, 0.075)
        rig.part(k).strut(an, kn, 0.024, FRAME)
        rig.part(k).plate((x, 0.015, 0.13), (x, 0.02, 0.4), 0.065, 0.07, CLOTH, taper=1.35)   # shin shell
        _piston(rig.part(k), (x, -0.04, 0.12), (x, -0.035, 0.38))                          # calf piston
        _hinge(rig.part(k), kn, 0.038, 0.09, FRAME_L)
        _hinge(rig.part(h), hp, 0.04, 0.07)
        rig.part(h).plate((x, 0, 0.47), (x, 0, 0.76), 0.085, 0.1, CLOTH, taper=1.3, r=0.035)   # thigh
        sx = 1 if x > 0 else -1
        sh, el = (sx * 0.19, 0, 1.2), (sx * 0.205, 0, 0.94)
        s = rig.joint(f"arm_{side}", t, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        rig.part(s).ball(sh, 0.05, FRAME_L)
        rig.part(s).plate((sx * 0.2, 0, 0.98), (sx * 0.195, 0, 1.2), 0.06, 0.07, CLOTH, taper=1.3)  # upper arm
        _hinge(rig.part(e), el, 0.032, 0.075)
        rig.part(e).plate((sx * 0.21, 0.01, 0.69), (sx * 0.205, 0.005, 0.92), 0.06, 0.065, CLOTH, taper=1.25)
        rig.part(e).rbox((sx * 0.21, 0.01, 0.645), (0.04, 0.07, 0.07), FRAME, r=0.015, taper=0.8)    # hand
    rig.part(b).rbox((0, 0, 0.8), (0.22, 0.14, 0.1), FRAME_L, r=0.04, taper=1.15)        # pelvis
    rig.part(t).strut((0, 0, 0.85), (0, 0, 1.0), 0.05, FRAME)                            # spine
    rig.part(t).cyl((0, 0, 0.92), 0.062, 0.03, FRAME_L)
    rig.part(t).rbox((0, 0, 1.12), (0.19, 0.15, 0.24), CLOTH, r=0.05, taper=1.65)         # chest shell
    rig.part(t).rbox((0, 0, 1.025), (0.22, 0.17, 0.025), ACCENT, r=0.06)                 # seam
    _charge_bar(rig, t, -0.075, -0.1, 1.15, face=-1)
    rig.part(hd).strut((0, 0, 1.24), (0, 0.01, 1.34), 0.03, FRAME)                       # neck
    _head(rig, hd, (0, 0.02, 1.4), (0.085, 0.115, 0.1), 0.032)
    rig.build()
    return rig


def heavy():
    rig = Rig("heavy")
    rig.kind = "biped"
    b = rig.joint("body", "root", (0, 0, 0.86))
    t = rig.joint("torso", b, (0, 0, 0.96))
    hd = rig.joint("head", t, (0, 0.13, 1.36))
    for side, x in (("R", 0.15), ("L", -0.15)):
        sx = 1 if x > 0 else -1
        hp, kn, an, toe = (x, 0, 0.84), (x, 0.15, 0.53), (x, -0.08, 0.22), (x, 0.03, 0.04)
        h = rig.joint(f"hip_{side}", b, hp)
        k = rig.joint(f"knee_{side}", h, kn)
        a = rig.joint(f"ankle_{side}", k, an)
        rig.part(a).rbox((x, 0.08, 0.035), (0.13, 0.24, 0.07), FRAME, r=0.03, taper=0.75)    # foot
        rig.part(a).strut(an, toe, 0.038, FRAME_L)                                         # metatarsal
        _hinge(rig.part(a), an, 0.048, 0.11)
        rig.part(k).strut(kn, an, 0.04, FRAME)
        _piston(rig.part(k), (x + sx * 0.075, -0.06, 0.26), (x + sx * 0.075, 0.1, 0.5), 0.026)  # calf piston
        rig.part(k).plate((x, -0.05, 0.28), (x, 0.13, 0.52), 0.11, 0.09, FRAME_L, taper=1.25)  # calf armour
        _hinge(rig.part(k), kn, 0.065, 0.14)
        _hinge(rig.part(h), hp, 0.06, 0.1)
        rig.part(h).plate((x, 0.17, 0.5), hp, 0.15, 0.17, CLOTH, taper=1.2, r=0.04)        # thigh, over the knee
        sh, el = (sx * 0.31, 0.04, 1.27), (sx * 0.34, 0.08, 1.01)
        s = rig.joint(f"arm_{side}", t, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        _hinge(rig.part(s), sh, 0.08, 0.11)
        rig.part(s).rbox((sx * 0.35, 0.03, 1.36), (0.2, 0.3, 0.12), CLOTH, r=0.04, taper=0.7, rot=(0, -sx * 24, 0))  # pauldron
        rig.part(s).strut(sh, el, 0.05, FRAME_L)
        _hinge(rig.part(e), el, 0.055, 0.12)
        rig.part(e).rbox((sx * 0.345, 0.09, 0.84), (0.13, 0.16, 0.28), CLOTH, r=0.035, taper=1.3)   # forearm armour
        rig.part(e).rbox((sx * 0.345, 0.1, 0.65), (0.09, 0.11, 0.1), FRAME, r=0.03, taper=0.8)    # fist
    rig.part(b).rbox((0, 0, 0.87), (0.36, 0.22, 0.12), FRAME_L, r=0.04, taper=1.1)        # pelvis
    rig.part(t).strut((0, 0.0, 0.9), (0, 0.03, 1.08), 0.11, FRAME)                       # abdomen
    rig.part(t).rbox((0, 0.04, 1.19), (0.34, 0.27, 0.34), CLOTH, r=0.04, taper=1.4, rot=(-12, 0, 0))   # chest
    rig.part(t).rbox((0, 0.02, 1.07), (0.37, 0.29, 0.03), ACCENT, r=0.05, rot=(-12, 0, 0))            # seam
    rig.part(t).rbox((0, -0.08, 1.36), (0.3, 0.16, 0.12), CLOTH, r=0.03, taper=0.6)      # cowl behind the head
    for sx in (1, -1):                                                                   # back fins
        rig.part(t).rbox((sx * 0.1, -0.21, 1.24), (0.04, 0.16, 0.24), FRAME_L, r=0.015, rot=(25, 0, 0))
    _charge_bar(rig, t, -0.075, -0.2, 1.1, face=-1)
    rig.part(hd).rbox((0, 0.13, 1.39), (0.15, 0.1, 0.2), "dark", r=0.03, taper=0.7, axis="f")     # head wedge
    rig.part(hd).rbox((0, 0.11, 1.435), (0.17, 0.045, 0.2), CLOTH, r=0.02, taper=0.75, axis="f")  # brow plate
    rig.part(hd, "eye").ball((0, 0.235, 1.385), (0.03, 0.015, 0.025), EYE)
    rig.build()
    rig.root.scale = (1.1,) * 3
    return rig


DRONE_Z = 0.84


def drone():
    """Hovering repair drone: a sleek shell over a dark belly, one eye in dark glass at the front, a ducted thruster
    underneath, two side nacelles, and two jointed tool arms (welder on its right, claw on its left)."""
    rig = Rig("drone")
    rig.kind = "drone"
    z = DRONE_Z
    b = rig.joint("body", "root", (0, 0, z))
    rig.part(b).ball((0, 0, z - 0.01), (0.19, 0.26, 0.1), FRAME)                         # belly
    rig.part(b).ball((0, -0.01, z + 0.01), (0.205, 0.275, 0.16), CLOTH, z0=-0.15)        # shell
    rig.part(b).ball((0, 0.19, z + 0.02), (0.115, 0.095, 0.085), "dark")                 # face glass
    rig.part(b, "eye").ball((0, 0.282, z + 0.02), (0.034, 0.016, 0.034), EYE)
    rig.part(b).rbox((0, -0.14, z + 0.155), (0.05, 0.14, 0.06), FRAME_L, r=0.02, taper=0.6)  # dorsal fin
    rig.part(b).cyl((0, 0, z - 0.115), 0.13, 0.05, ACCENT)                              # thruster collar
    rig.part(b).cyl((0, 0, z - 0.185), 0.105, 0.09, FRAME_L, taper=1.25)
    rig.part(b, "jet").cyl((0, 0, z - 0.252), 0.1, 0.045, EYE)                           # thruster ring
    rig.part(b, "jetoff").cyl((0, 0, z - 0.252), 0.1, 0.045, FRAME)
    for sx in (1, -1):                                                                   # side nacelles
        x = sx * 0.28
        rig.part(b).rbox((sx * 0.2, -0.01, z - 0.02), (0.1, 0.08, 0.045), FRAME, r=0.015)
        rig.part(b).plate((x, -0.16, z - 0.02), (x, 0.13, z - 0.02), 0.085, 0.09, FRAME_L, taper=0.7, r=0.03)
        rig.part(b).plate((x, -0.13, z + 0.03), (x, 0.1, z + 0.03), 0.09, 0.04, CLOTH, taper=0.7, r=0.015)
    for k in range(4):                                                                   # charge cells, top
        rig.part(b, f"bar{k}").box((-0.075 + k * 0.05, 0.0, z + 0.163), (0.04, 0.06, 0.03), BAR)
    for side, x in (("R", 0.15), ("L", -0.15)):
        sh, el = (x, 0.1, z - 0.08), (x, 0.1, z - 0.26)
        s = rig.joint(f"arm_{side}", b, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        _hinge(rig.part(s), sh, 0.035, 0.06)
        rig.part(s).strut(sh, el, 0.022, FRAME)
        rig.part(s).plate((x, 0.1, z - 0.24), (x, 0.1, z - 0.1), 0.055, 0.06, CLOTH, taper=0.8, r=0.015)
        _hinge(rig.part(e), el, 0.032, 0.065)
        rig.part(e).plate((x, 0.12, z - 0.26), (x, 0.29, z - 0.26), 0.06, 0.06, CLOTH, taper=0.8, r=0.015)
        if side == "R":                                                                 # welder
            rig.part(e).cyl((x, 0.32, z - 0.26), 0.035, 0.06, FRAME_L, axis="f")
            rig.part(e).cyl((x, 0.375, z - 0.26), 0.03, 0.06, "gm", axis="f", taper=0.5)
            rig.part(e, "torch").ball((x, 0.415, z - 0.26), 0.028, "orange")
            rig.part(e, "spark").ball((x, 0.445, z - 0.26), 0.05, "arc")
        else:                                                                           # claw
            rig.part(e).rbox((x, 0.32, z - 0.26), (0.08, 0.05, 0.06), FRAME, r=0.015, axis="f")
            for dx in (-0.028, 0.028):
                rig.part(e).box((x + dx, 0.375, z - 0.26), (0.04, 0.08, 0.045), FRAME_L)
    rig.build()
    rig.root.scale = (1.15,) * 3
    return rig


BUILD = {"worker": worker, "repair": drone, "security": heavy}
