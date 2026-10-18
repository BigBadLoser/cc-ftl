"""Robot crew models (robot_kit rigs): the worker bot, the repair drone and the heavy security bot.

Character frame: x = the robot's right, f = forward, z up, tiles. Humans are 1.5 tall; the worker stands about 1.4,
the drone hovers with its dome top near 1.2 (root scale 1.15), and the heavy security chassis is about 1.65 (modelled at 1.5, root
scale 1.1). Livery: `team.cloth` is the faction shell colour, `team.accent` the faction stripe (palette swap, so
player robots and rogue AI robots share the sheets). The visor is the only glow while running; the charge bar
(green) lights only in the charge clip; the drone's thruster ring and the welder tip glow while they work."""
from .robot_kit import Rig

CLOTH, ACCENT = "team.cloth", "team.accent"
EYE, BAR = "cyan", "green"


def _charge_bar(rig, joint, x0, f, z, n=4, w=0.06, h=0.05, face=1):
    """A row of n cells on a face (face = +1 front, -1 back): a dark housing, lit cells tagged bar0..bar3."""
    p = rig.part(joint)
    p.rbox((x0 + (n - 1) * w / 2, f, z), (n * w + 0.04, 0.03, h + 0.04), "dark", r=0.01)
    for k in range(n):
        x = x0 + k * w if face > 0 else x0 + (n - 1 - k) * w
        rig.part(joint, f"bar{k}").box((x, f + face * 0.017, z), (w - 0.012, 0.012, h), BAR)


def _leg(rig, side, hip, knee, ankle, x, kind):
    """Builds one leg's joints and parts; side = 'R' or 'L' (x already signed)."""
    h = rig.joint(f"hip_{side}", "body", (x, 0, hip))
    k = rig.joint(f"knee_{side}", h, (x, 0, knee))
    a = rig.joint(f"ankle_{side}", k, (x, 0, ankle))
    if kind == "worker":
        rig.part(a).rbox((x, 0.035, 0.04), (0.14, 0.25, 0.08), "gmD", top="gm", r=0.04)
        rig.part(a).ball((x, 0, ankle), 0.045, "steelD")
        rig.part(k).cyl((x, 0, (ankle + knee) / 2), 0.042, knee - ankle, "gm")
        rig.part(k).rbox((x, 0.04, (ankle + knee) / 2 + 0.02), (0.09, 0.05, 0.19), CLOTH, r=0.02)
        rig.part(k).ball((x, 0, knee), 0.055, "gmD")
        rig.part(h).rbox((x, 0, (knee + hip) / 2), (0.11, 0.12, hip - knee - 0.04), "gm", r=0.04)
    else:
        rig.part(a).rbox((x, 0.045, 0.05), (0.19, 0.31, 0.1), "gmD", top="gm", r=0.05)
        rig.part(a).ball((x, 0, ankle), 0.065, "steelD")
        rig.part(k).rbox((x, 0, (ankle + knee) / 2), (0.13, 0.14, knee - ankle), "gm", r=0.04)
        rig.part(k).rbox((x, 0.045, (ankle + knee) / 2 + 0.02), (0.15, 0.08, knee - ankle - 0.04), CLOTH, r=0.03, taper=1.1)
        rig.part(k).ball((x, 0, knee), 0.075, "gmD")
        rig.part(k).rbox((x, 0.075, knee + 0.01), (0.13, 0.06, 0.11), CLOTH, r=0.03)
        rig.part(h).rbox((x, 0, (knee + hip) / 2), (0.15, 0.17, hip - knee - 0.05), "gmD", r=0.05)


def _arm(rig, side, sh, el, x, kind):
    s = rig.joint(f"arm_{side}", "torso", (x, 0, sh))
    e = rig.joint(f"elbow_{side}", s, (x, 0, el))
    if kind == "worker":
        rig.part(s).ball((x, 0, sh), 0.065, "gmD")
        rig.part(s).cyl((x, 0, (sh + el) / 2), 0.035, sh - el - 0.04, "gm")
        rig.part(e).ball((x, 0, el), 0.045, "steelD")
        rig.part(e).rbox((x, 0, el - 0.12), (0.085, 0.09, 0.19), CLOTH, r=0.03)
        rig.part(e).rbox((x, 0, el - 0.235), (0.075, 0.085, 0.04), "gmD", r=0.015)
        for df in (-0.03, 0.03):                                              # clamp: two prongs
            rig.part(e).box((x, df, el - 0.29), (0.045, 0.03, 0.08), "gmD")
    else:
        sx = 1 if x > 0 else -1
        rig.part(s).ball((x, 0, sh), 0.09, "gmD")
        rig.part(s).rbox((x + sx * 0.02, 0, sh + 0.08), (0.24, 0.31, 0.16), CLOTH, r=0.07)    # pauldron
        rig.part(s).cyl((x, 0, (sh + el) / 2), 0.06, sh - el - 0.06, "gm")
        rig.part(e).ball((x, 0, el), 0.07, "steelD")
        rig.part(e).rbox((x, 0, el - 0.15), (0.15, 0.16, 0.24), CLOTH, r=0.05, taper=1.12)
        rig.part(e).rbox((x, 0.01, el - 0.33), (0.14, 0.14, 0.12), "gmD", r=0.04)


def worker():
    rig = Rig("worker")
    rig.kind = "biped"
    b = rig.joint("body", "root", (0, 0, 0.64))
    t = rig.joint("torso", b, (0, 0, 0.76))
    hd = rig.joint("head", t, (0, 0, 1.16))
    for side, x in (("R", 0.11), ("L", -0.11)):
        _leg(rig, side, 0.62, 0.36, 0.1, x, "worker")
        _arm(rig, side, 1.07, 0.84, x * 2.55, "worker")
    rig.part(b).rbox((0, 0, 0.68), (0.32, 0.17, 0.12), "gmD", r=0.05)
    rig.part(t).cyl((0, 0, 0.79), 0.08, 0.1, "steelD")
    rig.part(t).rbox((0, 0, 0.99), (0.44, 0.27, 0.32), CLOTH, r=0.07, taper=1.05)
    rig.part(t).rbox((0, 0, 1.08), (0.46, 0.285, 0.06), ACCENT, r=0.075)                # livery stripe
    rig.part(t).box((0.11, 0.14, 0.9), (0.12, 0.02, 0.07), "dark")                     # vent
    rig.part(t).rbox((0, -0.18, 0.98), (0.3, 0.1, 0.27), "gm", r=0.03)                 # battery pack
    _charge_bar(rig, t, -0.16, 0.135, 0.98, w=0.055)
    _charge_bar(rig, t, -0.09, -0.23, 1.0, w=0.055, face=-1)
    rig.part(hd).cyl((0, 0, 1.18), 0.04, 0.06, "steelD")
    rig.part(hd).rbox((0, 0.01, 1.29), (0.25, 0.22, 0.17), "plate", r=0.06)
    rig.part(hd).rbox((0, 0.11, 1.29), (0.2, 0.04, 0.095), "dark", r=0.02)
    rig.part(hd, "eye").box((0, 0.13, 1.29), (0.15, 0.015, 0.05), EYE)
    for x in (0.135, -0.135):
        rig.part(hd).cyl((x, 0, 1.29), 0.05, 0.03, "gmD", axis="x")
    rig.part(hd).cyl((-0.08, -0.04, 1.4), 0.022, 0.1, "gm")
    rig.part(hd).ball((-0.08, -0.04, 1.46), 0.032, "steelL")
    rig.build()
    return rig


def heavy():
    rig = Rig("heavy")
    rig.kind = "biped"
    b = rig.joint("body", "root", (0, 0, 0.74))
    t = rig.joint("torso", b, (0, 0, 0.86))
    hd = rig.joint("head", t, (0, 0, 1.35))
    for side, x in (("R", 0.15), ("L", -0.15)):
        _leg(rig, side, 0.72, 0.4, 0.12, x, "heavy")
        _arm(rig, side, 1.22, 0.97, x * 2.6, "heavy")
    rig.part(b).rbox((0, 0, 0.78), (0.42, 0.26, 0.16), "gmD", r=0.06)
    rig.part(b).rbox((0, 0.1, 0.74), (0.26, 0.08, 0.18), CLOTH, r=0.03)                # groin plate
    rig.part(t).cyl((0, 0, 0.9), 0.12, 0.1, "steelD")
    rig.part(t).rbox((0, 0, 1.13), (0.56, 0.36, 0.4), CLOTH, r=0.09, taper=1.08)
    rig.part(t).rbox((0, 0, 1.03), (0.58, 0.38, 0.065), ACCENT, r=0.1)                 # livery stripe
    rig.part(t).box((0, 0.19, 1.16), (0.2, 0.02, 0.09), "dark")                        # chest grille
    rig.part(t).rbox((0, -0.23, 1.15), (0.4, 0.13, 0.32), "gm", r=0.04)               # power pack
    for x in (0.12, -0.12):
        rig.part(t).cyl((x, -0.25, 1.36), 0.045, 0.12, "gmD")
    rig.part(t).rbox((0, 0, 1.35), (0.36, 0.3, 0.06), CLOTH, r=0.08)                  # collar
    _charge_bar(rig, t, -0.12, 0.195, 0.95, w=0.055)
    _charge_bar(rig, t, -0.08, -0.3, 1.08, w=0.055, face=-1)
    rig.part(hd).rbox((0, 0.03, 1.44), (0.24, 0.24, 0.16), "gmD", top="gm", r=0.07)
    rig.part(hd).rbox((0, 0.135, 1.44), (0.21, 0.04, 0.08), "dark", r=0.02)
    rig.part(hd, "eye").box((0, 0.158, 1.44), (0.16, 0.015, 0.045), EYE)
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
