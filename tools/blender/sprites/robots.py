"""Robot crew models (robot_kit rigs): the worker bot, the repair drone and the heavy security bot.

Character frame: x = the robot's right, f = forward, z up, tiles. Humans are 1.5 tall. Look: advanced machines, not
toys. Crisp tapered shell plates (`team.cloth`, the faction livery) over a dark exposed frame, a dark glass face
with one glowing eye. The worker is a slender humanoid about 1.5 tall; the heavy security chassis is hunched,
armoured and reverse-jointed (about 1.6 at the shoulder plates: modelled smaller, root scale 1.1); the drone hovers
with its dome top near 1.2 (root scale 1.15). `team.accent` is a thin faction seam. The eye is the only glow while
running; the charge cells (green, flush in the shell) light only in the charge clip; the drone's thruster ring and
the welder tip glow while they work."""
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
        rig.part(a).ball(an, 0.032, FRAME)
        rig.part(k).strut(an, kn, 0.024, FRAME)
        rig.part(k).plate((x, 0.015, 0.13), (x, 0.02, 0.4), 0.065, 0.07, CLOTH, taper=1.35)   # shin shell
        rig.part(k).ball(kn, 0.036, FRAME_L)
        rig.part(h).plate((x, 0, 0.47), (x, 0, 0.76), 0.085, 0.1, CLOTH, taper=1.3, r=0.035)   # thigh
        sx = 1 if x > 0 else -1
        sh, el = (sx * 0.19, 0, 1.2), (sx * 0.205, 0, 0.94)
        s = rig.joint(f"arm_{side}", t, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        rig.part(s).ball(sh, 0.05, FRAME_L)
        rig.part(s).plate((sx * 0.2, 0, 0.98), (sx * 0.195, 0, 1.2), 0.06, 0.07, CLOTH, taper=1.3)  # upper arm
        rig.part(e).ball(el, 0.03, FRAME)
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
        rig.part(a).ball(an, 0.048, FRAME)
        rig.part(k).strut(kn, an, 0.04, FRAME)
        rig.part(k).plate((x, -0.05, 0.28), (x, 0.13, 0.52), 0.11, 0.09, FRAME_L, taper=1.25)  # calf armour
        rig.part(k).ball(kn, 0.06, FRAME)
        rig.part(h).plate((x, 0.17, 0.5), hp, 0.15, 0.17, CLOTH, taper=1.2, r=0.04)        # thigh, over the knee
        sh, el = (sx * 0.31, 0.04, 1.27), (sx * 0.34, 0.08, 1.01)
        s = rig.joint(f"arm_{side}", t, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        rig.part(s).ball(sh, 0.075, FRAME)
        rig.part(s).rbox((sx * 0.35, 0.03, 1.36), (0.2, 0.3, 0.12), CLOTH, r=0.04, taper=0.7, rot=(0, -sx * 24, 0))  # pauldron
        rig.part(s).strut(sh, el, 0.05, FRAME_L)
        rig.part(e).ball(el, 0.052, FRAME)
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
    rig = Rig("drone")
    rig.kind = "drone"
    z = DRONE_Z
    b = rig.joint("body", "root", (0, 0, z))
    rig.part(b).ball((0, 0, z), (0.24, 0.26, 0.2), CLOTH, z0=0.0)                     # dome
    rig.part(b).cyl((0, 0, z - 0.025), 0.245, 0.05, ACCENT)                            # livery band
    rig.part(b).cyl((0, 0, z - 0.1), 0.22, 0.1, "gmD", taper=1.1)                       # skirt
    rig.part(b).cyl((0, 0, z - 0.2), 0.14, 0.1, "gm", taper=1.45)                       # thruster cone
    rig.part(b, "jet").cyl((0, 0, z - 0.27), 0.12, 0.045, EYE)                          # thruster ring
    rig.part(b, "jetoff").cyl((0, 0, z - 0.27), 0.12, 0.045, "steelD")
    rig.part(b).rbox((0, 0.19, z + 0.06), (0.17, 0.09, 0.14), "dark", r=0.03, axis="f")   # sensor housing
    rig.part(b, "eye").box((0, 0.265, z + 0.06), (0.12, 0.012, 0.045), EYE)
    for x in (0.27, -0.27):                                                             # side thruster pods
        rig.part(b).cyl((x, -0.02, z), 0.065, 0.24, "gm", axis="f", top="gmD")
        rig.part(b).box((x * 0.9, -0.02, z), (0.06, 0.08, 0.05), "steelD")
    rig.part(b).cyl((-0.08, -0.1, z + 0.2), 0.022, 0.1, "gm")                          # mast
    rig.part(b).ball((-0.08, -0.1, z + 0.26), 0.03, "steelL")
    rig.part(b).rbox((0.0, -0.02, z + 0.18), (0.24, 0.07, 0.04), "dark", r=0.01)       # charge bar on the dome top
    for k in range(4):
        rig.part(b, f"bar{k}").box((-0.09 + k * 0.06, -0.02, z + 0.21), (0.048, 0.05, 0.012), BAR)
    for side, x in (("R", 0.16), ("L", -0.16)):
        sh = rig.joint(f"arm_{side}", b, (x, 0.1, z - 0.06))
        el = rig.joint(f"elbow_{side}", sh, (x, 0.1, z - 0.27))
        rig.part(sh).ball((x, 0.1, z - 0.06), 0.045, "gmD")
        rig.part(sh).rbox((x, 0.1, z - 0.165), (0.06, 0.065, 0.17), "gm", r=0.02)
        rig.part(el).ball((x, 0.1, z - 0.27), 0.04, "steelD")
        rig.part(el).rbox((x, 0.2, z - 0.27), (0.06, 0.06, 0.17), "gm", r=0.02, axis="f")
        if side == "R":                                                                 # welder
            rig.part(el).cyl((x, 0.31, z - 0.27), 0.045, 0.07, "gmD", axis="f")
            rig.part(el).cyl((x, 0.375, z - 0.27), 0.035, 0.07, "brass", axis="f", taper=0.55)
            rig.part(el, "torch").ball((x, 0.42, z - 0.27), 0.03, "orange")
            rig.part(el, "spark").ball((x, 0.45, z - 0.27), 0.05, "arc")
        else:                                                                           # claw
            rig.part(el).rbox((x, 0.3, z - 0.27), (0.09, 0.05, 0.08), "gmD", r=0.02, axis="f")
            for dx in (-0.03, 0.03):
                rig.part(el).box((x + dx, 0.365, z - 0.27), (0.03, 0.08, 0.045), "gmD")
    rig.build()
    rig.root.scale = (1.15,) * 3
    return rig


BUILD = {"worker": worker, "repair": drone, "security": heavy}
