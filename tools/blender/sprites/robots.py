"""Robot crew models (robot_kit rigs): the worker bot, the repair drone and the heavy security bot.

Character frame: x = the robot's right, f = forward, z up, tiles. Humans are 1.5 tall. Look: advanced machines, not
toys. Crisp tapered shell plates (`team.cloth`, the faction livery) over a dark exposed frame with hinge cylinders at
the joints and pistons, and a dark glass face with one glowing eye. The worker is a slender humanoid about 1.5 tall;
the heavy security chassis is hunched, armoured and reverse-jointed (about 1.6 at the shoulder plates: modelled
smaller, root scale 1.1); the drone is a hovering shell about 1.2 at the top (root scale 1.15). `team.accent` is a
thin faction seam. The eye is the only glow while running; the charge cells (green, flush in the shell) light only
in the charge clip; the drone's thruster ring and the welder tip glow while they work."""
import math
from .robot_kit import Rig

CLOTH, ACCENT = "team.cloth", "team.accent"
EYE, BAR = "cyan", "green"
FRAME, FRAME_L = "dark", "steelD"        # exposed under-frame
MID = "gm"                               # secondary (non-livery) plating: splits limbs from the livery shell


def _charge_bar(rig, joint, x0, f, z, n=4, w=0.05, h=0.04, face=1):
    """n charge cells set flush into a face at depth f (face = +1 front, -1 back), tagged bar0..bar3; unlit they are
    simply not drawn."""
    for k in range(n):
        x = x0 + k * w if face > 0 else x0 + (n - 1 - k) * w
        rig.part(joint, f"bar{k}").box((x, f, z), (w - 0.01, 0.03, h), BAR)


def _dir(v):
    n = sum(c * c for c in v) ** 0.5
    return tuple(c / n for c in v)


def _along(a, b, u):
    """The point u tiles from a towards b."""
    d = _dir(tuple(q - p for p, q in zip(a, b)))
    return tuple(p + c * u for p, c in zip(a, d))


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


def _socket(rig, t, c, rot=None):
    """Head socket in the top of the torso: a grey rim round a dark well cut to the head's footprint (the head could
    sink in until its brow plate sits flush). c = centre of the chest top face."""
    rig.part(t).rbox(c, (0.22, 0.27, 0.03), MID, r=0.04, rot=rot)
    rig.part(t).rbox((c[0], c[1], c[2] + 0.004), (0.175, 0.225, 0.03), "dark", r=0.03, rot=rot)


def _sensor_head(rig, hd, f, z, k, pitch=0.0, wedge_h=0.1, brow=1.0):
    """The shared robot head: a dark wedge sensor head pointing forward, a livery brow plate and one eye, on a short
    dark neck column rising out of the torso's socket. f, z = the wedge centre; k = scale; pitch (degrees, < 0 = nose
    down) tilts the whole head about its centre to follow a sloped chest. wedge_h: height of the dark wedge (its base
    stays put; the brow plate rides on its top); brow scales the brow plate."""
    c, sn = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    rot = (pitch, 0, 0) if pitch else None

    def at(df, dz):
        return (0, f + df * c - dz * sn, z + df * sn + dz * c)
    rig.part(hd).cyl(at(-0.01, -0.075 * k), 0.045 * k, 0.06 * k, "dark", rot=rot)
    dz = (wedge_h - 0.1) / 2 * k                                                         # wedge base fixed at -0.05
    rig.part(hd).rbox(at(0, dz), (0.15 * k, wedge_h * k, 0.2 * k), "dark", r=0.03 * k, taper=0.7, axis="f", rot=rot)
    rig.part(hd).rbox(at(-0.02 * k, 0.045 * k + 2 * dz), (0.17 * k * brow, 0.045 * k * brow, 0.2 * k * brow), CLOTH,
                      r=0.02 * k, taper=0.75, axis="f", rot=rot)
    rig.part(hd, "eye").ball(at(0.105 * k, -0.005 * k), (0.03 * k, 0.015 * k, 0.025 * k), EYE, rot=rot)


UTIL_BASE, UTIL_EL = (-0.14, -0.17, 1.2), (-0.27, -0.1, 1.58)


def _util_arm(rig, t):
    """The worker's third arm: a boom on the back, folded up over its left shoulder with a claw hanging in front, outboard
    of the head (joints util / util_el; the work clip unfolds it). Livery plates on dark hinges, so it reads against
    both the dark background and the grey limbs."""
    u = rig.joint("util", t, UTIL_BASE)
    ue = rig.joint("util_el", u, UTIL_EL)
    tip = (-0.32, 0.09, 1.42)
    _hinge(rig.part(u), UTIL_BASE, 0.05, 0.08)
    rig.part(u).strut(UTIL_BASE, UTIL_EL, 0.03, FRAME)
    rig.part(u).plate(_along(UTIL_BASE, UTIL_EL, 0.05), _along(UTIL_BASE, UTIL_EL, 0.36), 0.085, 0.09, CLOTH, taper=0.85, r=0.02)
    _hinge(rig.part(ue), UTIL_EL, 0.055, 0.1)
    rig.part(ue).plate(_along(UTIL_EL, tip, 0.04), _along(UTIL_EL, tip, 0.23), 0.075, 0.08, CLOTH, taper=0.8, r=0.02)
    rig.part(ue).rbox(tip, (0.08, 0.08, 0.055), FRAME, r=0.015)                          # wrist
    for df in (-0.03, 0.03):                                                             # claw
        rig.part(ue).rbox((tip[0], tip[1] + df, tip[2] - 0.065), (0.05, 0.035, 0.09), FRAME_L, r=0.01, taper=0.7)


def worker():
    """Worker: an armoured humanoid. Angular helmet with a visor slit over a dark jaw, broad chest plate over an exposed
    ribbed abdomen, armoured hip skirt, big thigh and shin plates, chunky forearms, and dark hinge discs standing out at
    every joint (the articulation read)."""
    rig = Rig("worker")
    rig.kind = "biped"
    b = rig.joint("body", "root", (0, 0, 0.78))
    t = rig.joint("torso", b, (0, 0, 0.88))
    hd = rig.joint("head", t, (0, 0.02, 1.27))
    for side, x in (("R", 0.11), ("L", -0.11)):
        sx = 1 if x > 0 else -1
        hp, kn, an = (x, 0, 0.75), (x, 0.01, 0.42), (x, 0, 0.09)
        h = rig.joint(f"hip_{side}", b, hp)
        k = rig.joint(f"knee_{side}", h, kn)
        a = rig.joint(f"ankle_{side}", k, an)
        rig.part(a).rbox((x, 0.045, 0.015), (0.125, 0.26, 0.03), FRAME, r=0.015)             # sole
        rig.part(a).rbox((x, 0.035, 0.055), (0.115, 0.22, 0.06), CLOTH, r=0.02, taper=0.75)  # foot shell
        _hinge(rig.part(a), an, 0.038, 0.12)
        rig.part(k).strut(an, kn, 0.03, FRAME)
        rig.part(k).plate((x, 0.01, 0.15), (x, 0.015, 0.38), 0.115, 0.13, MID, taper=1.25, r=0.025)     # shin
        rig.part(k).rbox((x, 0.075, 0.45), (0.1, 0.05, 0.11), CLOTH, r=0.02, taper=0.75)       # knee cap
        _hinge(rig.part(k), kn, 0.05, 0.15)
        rig.part(h).plate((x, 0.005, 0.47), (x, 0, 0.72), 0.13, 0.15, CLOTH, taper=1.12, r=0.025)   # thigh
        _hinge(rig.part(h), (x + sx * 0.06, 0, 0.74), 0.055, 0.05, FRAME_L)                  # hip disc
        sh, el = (sx * 0.245, 0, 1.2), (sx * 0.27, 0.0, 0.96)
        s = rig.joint(f"arm_{side}", t, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        _hinge(rig.part(s), sh, 0.06, 0.09)
        rig.part(s).rbox((sx * 0.265, 0, 1.24), (0.15, 0.19, 0.14), CLOTH, r=0.03, taper=0.8, rot=(0, sx * 12, 0))  # shoulder
        rig.part(s).strut(sh, el, 0.03, FRAME)
        rig.part(s).plate((sx * 0.268, 0, 1.0), (sx * 0.258, 0, 1.13), 0.085, 0.09, MID, taper=1.1, r=0.02)     # upper arm
        _hinge(rig.part(e), el, 0.045, 0.12)
        rig.part(e).plate((sx * 0.275, 0.01, 0.92), (sx * 0.28, 0.015, 0.71), 0.1, 0.11, MID, taper=0.8, r=0.02)    # forearm
        rig.part(e).rbox((sx * 0.28, 0.015, 0.66), (0.055, 0.085, 0.07), FRAME_L, r=0.015)     # hand
        rig.part(e).rbox((sx * 0.28, 0.025, 0.6), (0.05, 0.075, 0.06), FRAME, r=0.012, taper=0.8)   # fingers
    rig.part(b).ball((0, 0, 0.76), (0.13, 0.09, 0.07), FRAME)                                 # pelvis core
    rig.part(b).rbox((0, 0.005, 0.81), (0.3, 0.19, 0.1), MID, r=0.025, taper=1.12)          # hip skirt
    rig.part(b).rbox((0, 0.09, 0.75), (0.11, 0.05, 0.11), MID, r=0.02, taper=1.35)          # codpiece
    rig.part(t).rbox((0, 0, 0.96), (0.17, 0.12, 0.17), FRAME, r=0.03)                        # abdomen core
    for z in (0.92, 0.995):                                                                  # ribs
        rig.part(t).rbox((0, 0.005, z), (0.2, 0.135, 0.04), FRAME_L, r=0.02)
    rig.part(t).rbox((0, 0.0, 1.055), (0.33, 0.21, 0.045), ACCENT, r=0.03)                  # seam
    rig.part(t).rbox((0, 0.005, 1.165), (0.37, 0.23, 0.18), CLOTH, r=0.03, taper=1.1)        # chest plate
    rig.part(t).rbox((0, 0.09, 1.16), (0.2, 0.08, 0.13), "gm", r=0.02, taper=0.8)            # sternum plate
    rig.part(t).rbox((0, -0.14, 1.13), (0.24, 0.08, 0.2), FRAME_L, r=0.02)                  # power pack
    _charge_bar(rig, t, -0.075, -0.18, 1.075, face=-1)
    _socket(rig, t, (0, 0.01, 1.258))
    _sensor_head(rig, hd, 0.02, 1.345, 1.0)
    _util_arm(rig, t)
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
        rig.part(a).rbox((x, 0.08, 0.015), (0.14, 0.26, 0.03), FRAME, r=0.015)               # sole
        rig.part(a).rbox((x, 0.07, 0.05), (0.13, 0.22, 0.06), CLOTH, r=0.02, taper=0.75)     # foot shell
        rig.part(a).plate(an, toe, 0.08, 0.08, MID, taper=0.85, r=0.02)                   # metatarsal
        _hinge(rig.part(a), an, 0.048, 0.11)
        rig.part(k).strut(kn, an, 0.04, FRAME)
        _piston(rig.part(k), (x + sx * 0.075, -0.06, 0.26), (x + sx * 0.075, 0.1, 0.5), 0.026)  # calf piston
        rig.part(k).plate((x, -0.05, 0.28), (x, 0.13, 0.52), 0.12, 0.1, MID, taper=1.25, r=0.025)  # calf armour
        _hinge(rig.part(k), kn, 0.065, 0.14)
        _hinge(rig.part(h), hp, 0.06, 0.1)
        rig.part(h).plate((x, 0.17, 0.5), hp, 0.15, 0.17, CLOTH, taper=1.2, r=0.04)        # thigh, over the knee
        sh, el = (sx * 0.31, 0.04, 1.27), (sx * 0.34, 0.08, 1.01)
        s = rig.joint(f"arm_{side}", t, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        _hinge(rig.part(s), sh, 0.08, 0.11)
        rig.part(s).rbox((sx * 0.35, 0.03, 1.36), (0.2, 0.3, 0.12), CLOTH, r=0.04, taper=0.7, rot=(0, -sx * 24, 0))  # pauldron
        rig.part(s).strut(sh, el, 0.04, FRAME)
        rig.part(s).plate((sx * 0.335, 0.075, 1.04), (sx * 0.315, 0.05, 1.2), 0.1, 0.11, MID, taper=1.1, r=0.025)   # upper arm
        _hinge(rig.part(e), el, 0.055, 0.12)
        rig.part(e).rbox((sx * 0.345, 0.09, 0.84), (0.13, 0.16, 0.28), MID, r=0.035, taper=1.3)     # gauntlet
        rig.part(e).rbox((sx * 0.345, 0.1, 0.65), (0.09, 0.11, 0.1), FRAME, r=0.03, taper=0.8)    # fist
    rig.part(b).rbox((0, 0, 0.85), (0.36, 0.22, 0.09), FRAME_L, r=0.04, taper=1.1)        # pelvis
    rig.part(t).strut((0, 0.0, 0.9), (0, 0.03, 1.08), 0.11, FRAME)                       # abdomen pivot
    rig.part(t).cyl((0, 0.01, 0.945), 0.13, 0.045, MID)                                 # rib band
    for sx in (1, -1):                                                                   # side pistons, pelvis to chest
        _piston(rig.part(t), (sx * 0.19, 0.0, 0.87), (sx * 0.19, 0.02, 1.07), 0.03)
    rig.part(t).rbox((0, 0.05, 1.19), (0.34, 0.31, 0.34), CLOTH, r=0.04, taper=1.4, rot=(-12, 0, 0))   # chest
    rig.part(t).rbox((0, -0.2, 1.18), (0.3, 0.14, 0.26), FRAME_L, r=0.03)                # power unit (side depth)
    rig.part(t).rbox((0, 0.02, 1.07), (0.37, 0.29, 0.03), ACCENT, r=0.05, rot=(-12, 0, 0))            # seam
    for sx in (1, -1):                                                                   # back fins
        rig.part(t).rbox((sx * 0.1, -0.27, 1.27), (0.05, 0.16, 0.24), FRAME, r=0.015, rot=(25, 0, 0))
    _charge_bar(rig, t, -0.075, -0.27, 1.13, face=-1)
    rig.part(t).rbox((0, 0.215, 1.24), (0.2, 0.06, 0.15), FRAME_L, r=0.03, taper=1.15, rot=(-12, 0, 0))  # chest inset
    _socket(rig, t, (0, 0.085, 1.358), rot=(-12, 0, 0))
    _sensor_head(rig, hd, 0.12, 1.435, 1.0, pitch=-12, wedge_h=0.08, brow=1.15)
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
        x = sx * 0.29
        rig.part(b).plate((sx * 0.15, -0.1, z + 0.05), (x, -0.1, z + 0.09), 0.07, 0.05, FRAME, r=0.015)  # pylon
        rig.part(b).plate((x, -0.26, z + 0.11), (x, 0.04, z + 0.08), 0.08, 0.085, FRAME_L, taper=0.7, r=0.03)
        rig.part(b).plate((x, -0.23, z + 0.155), (x, 0.01, z + 0.125), 0.085, 0.035, CLOTH, taper=0.7, r=0.015)
    for k in range(4):                                                                   # charge cells, top
        rig.part(b, f"bar{k}").box((-0.075 + k * 0.05, 0.0, z + 0.163), (0.04, 0.06, 0.03), BAR)
    for side, x in (("R", 0.17), ("L", -0.17)):           # arms mount back under the hull and sweep forward and down
        sh, el = (x, 0.0, z - 0.08), (x, 0.15, z - 0.24)
        s = rig.joint(f"arm_{side}", b, sh)
        e = rig.joint(f"elbow_{side}", s, el)
        _hinge(rig.part(s), sh, 0.035, 0.06)
        rig.part(s).strut(sh, el, 0.022, FRAME)
        rig.part(s).plate(_along(sh, el, 0.05), _along(sh, el, 0.18), 0.055, 0.06, FRAME_L, taper=0.8, r=0.015)
        _hinge(rig.part(e), el, 0.034, 0.075, FRAME_L)
        d = _dir((0, 0.15, -0.06))                                                          # forearm slope
        at = lambda u: tuple(el[i] + d[i] * u for i in range(3))  # noqa: E731
        rig.part(e).plate(at(0.02), at(0.16), 0.06, 0.06, "gm", taper=0.8, r=0.015)
        if side == "R":                                                                 # welder
            rig.part(e).strut(at(0.16), at(0.22), 0.035, FRAME_L)
            rig.part(e).strut(at(0.22), at(0.28), 0.03, "gm", taper=0.5)
            rig.part(e, "torch").ball(at(0.3), 0.028, "orange")
            rig.part(e, "spark").ball(at(0.33), 0.05, "arc")
        else:                                                                           # claw
            rig.part(e).plate(at(0.15), at(0.2), 0.08, 0.06, FRAME, r=0.015)
            for dx in (-0.028, 0.028):
                rig.part(e).plate(tuple(v + (dx if i == 0 else 0) for i, v in enumerate(at(0.2))),
                                  tuple(v + (dx if i == 0 else 0) for i, v in enumerate(at(0.28))), 0.04, 0.045, FRAME_L, r=0.01)
    rig.build()
    rig.root.scale = (1.15,) * 3
    return rig


BUILD = {"worker": worker, "repair": drone, "security": heavy}
