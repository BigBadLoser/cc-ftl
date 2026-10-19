"""Hostile aliens (derelict infestation), built on the robot rig kit: rigid smooth-shaded parts on a joint rig, character
frame x = the creature's right, f = forward, z up, 1 unit = 1 tile (see robot_kit). Dark violet-black chitin, one sickly
lime accent (blade edges, jaw tips, spine tips) and lime bioluminescence on the glow sheet; every creature is well under
crew height and can never be read as crew or a robot.

  HUNTER   the swarm melee unit: a crouched thorax with a segmented abdomen, six splayed jointed legs (about a tile
           across), a wedge head with mandibles and an eye cluster, two mantis scythes with lime blade edges
  BRUTE    the tank: a broad armoured carapace (about 1.5 tiles) on four thick legs, a glowing sac bulging through the
           back plates, a low armoured head between two great crushing claws with lime jaw edges
  SPITTER  the ranged unit: a small body on four long legs, the abdomen arching up over its back like a scorpion tail to a
           swollen glowing acid sac, a tubular spout on the head; it spits a glowing glob

Shared joint names (alien_render poses them): body, head, abdomen, mand_L/R, leg<i>_<s> / knee<i>_<s>; hunter and brute
claw_<s> / blade_<s> (brute pincer_<s>); spitter tail, sac. Tags: glow / glowoff (lit and dead versions of the glowing
parts), glob1 / glob2 (the spitter's projectile frames)."""
import math

from .robot_kit import Rig

K, D, M, L, A, GLOW = "xnK", "xnD", "xnM", "xnL", "xnA", "xnG"


def _leg(rig, body, i, side, f, splay, bz, reach=0.6, kh=0.2, kr=0.3, r=0.03, foot=0.02, pad=False):
    """Hip on the body side, femur arching up and out to the knee, tibia down to the foot (pointed, or a blunt pad)."""
    sx = 1 if side == "R" else -1
    a = math.radians(splay)
    out = lambda d: (sx * d * math.cos(a), f + d * math.sin(a))  # noqa: E731
    hip = (sx * 0.14, f, bz)
    kx, kf = out(kr)
    knee = (kx, kf, bz + kh)
    fx, ff = out(reach)
    toe = (fx, ff, 0.0)
    h = rig.joint(f"leg{i}_{side}", body, hip)
    k = rig.joint(f"knee{i}_{side}", h, knee)
    rig.part(h).ball(hip, r * 1.5, M)
    rig.part(h).limb(hip, knee, r, D)
    rig.part(k).ball(knee, r * 1.25, L)
    mid = tuple(knee[j] + (toe[j] - knee[j]) * 0.75 for j in range(3))
    rig.part(k).limb(knee, mid, r * 0.85, D)
    if pad:
        rig.part(k).strut(mid, toe, r * 0.8, K, taper=1.2)
        rig.part(k).ball(toe, r * 0.9, K)
    else:
        rig.part(k).strut(mid, toe, foot, K, taper=0.2)


def _glowing(rig, joint, c, r):
    rig.part(joint, "glow").ball(c, r, GLOW)
    rig.part(joint, "glowoff").ball(c, r, D)


def _sac(rig, joint, c, r, spots):
    """A dark membrane sac with glowing vein spots on it (lit when alive)."""
    rig.part(joint).ball(c, r, M)
    rx, rf, rz = r
    for a, e in spots:                                       # (azimuth, elevation) degrees on the sac surface
        a, e = math.radians(a), math.radians(e)
        p = (c[0] + rx * 1.0 * math.cos(e) * math.cos(a), c[1] + rf * 1.0 * math.cos(e) * math.sin(a),
             c[2] + rz * 1.0 * math.sin(e))
        _glowing(rig, joint, p, 0.026)


def _eyes(rig, h, f, z, spots):
    for dx, dz in spots:
        _glowing(rig, h, (dx, f, z + dz), 0.016)


def _mandibles(rig, h, f, z, w=0.05, ln=0.13):
    for side, sx in (("R", 1), ("L", -1)):
        m = rig.joint(f"mand_{side}", h, (sx * w, f, z))
        rig.part(m).plate((sx * w, f, z), (sx * w * 0.7, f + ln, z - 0.04), 0.035, 0.035, D, taper=0.5, r=0.01)
        rig.part(m).strut((sx * w * 0.7, f + ln, z - 0.04), (0.0, f + ln + 0.05, z - 0.05), 0.016, A, taper=0.2)


# ---- hunter -------------------------------------------------------------------------------------------------------

def _scythe(rig, body, side, bz):
    """Mantis forelimb: shoulder on the thorax front, upper arm up and forward, a hooked lime-edged blade folded down."""
    sx = 1 if side == "R" else -1
    sh, el, tip = (sx * 0.13, 0.2, bz + 0.1), (sx * 0.2, 0.3, bz + 0.42), (sx * 0.18, 0.66, bz + 0.1)
    s = rig.joint(f"claw_{side}", body, sh)
    e = rig.joint(f"blade_{side}", s, el)
    rig.part(s).ball(sh, 0.06, M)
    rig.part(s).plate(sh, el, 0.09, 0.08, D, taper=0.75, r=0.025, top=L)
    rig.part(e).ball(el, 0.055, L)
    rig.part(e).plate(el, tip, 0.06, 0.1, D, taper=0.5, r=0.015)
    rig.part(e).plate((el[0], el[1] + 0.05, el[2] - 0.05), (tip[0], tip[1] - 0.02, tip[2] - 0.04), 0.035, 0.07, A,
                      taper=0.35, r=0.008)
    rig.part(e).strut(tip, (tip[0], tip[1] - 0.1, tip[2] - 0.1), 0.03, A, taper=0.15)


def hunter():
    rig = Rig("hunter")
    rig.kind, bz = "hunter", 0.3
    b = rig.joint("body", "root", (0, 0, bz))
    rig.part(b).ball((0, 0.04, bz), (0.17, 0.22, 0.13), M)
    for f, z, w in ((0.12, 0.1, 0.15), (-0.02, 0.12, 0.17), (-0.14, 0.09, 0.15)):            # carapace plates
        rig.part(b).plate((0, f - 0.07, bz + z - 0.02), (0, f + 0.07, bz + z), w * 2, 0.06, D, taper=0.8, r=0.03, top=L)
    for f in (0.1, -0.04):                                                                  # dorsal spines
        rig.part(b).strut((0, f, bz + 0.14), (0, f - 0.06, bz + 0.27), 0.03, L, taper=0.3)
        rig.part(b).ball((0, f - 0.06, bz + 0.27), 0.014, A)
    ab = rig.joint("abdomen", b, (0, -0.18, bz))
    for k, (f, z, r) in enumerate(((-0.3, bz - 0.04, (0.16, 0.15, 0.12)), (-0.47, bz - 0.1, (0.12, 0.12, 0.09)),
                                   (-0.6, bz - 0.16, (0.08, 0.09, 0.06)))):
        rig.part(ab).ball((0, f, z), r, M if k % 2 == 0 else D)
        rig.part(ab).plate((0, f + 0.05, z + r[2] * 0.7), (0, f - 0.05, z + r[2] * 0.6), r[0] * 1.6, 0.04, D,
                           taper=0.8, r=0.02, top=L)
    rig.part(ab).strut((0, -0.66, bz - 0.18), (0, -0.8, bz - 0.26), 0.035, K, taper=0.2)
    for f, z in ((-0.3, bz - 0.06), (-0.46, bz - 0.12)):
        for sx in (1, -1):
            _glowing(rig, ab, (sx * 0.13, f, z), 0.03)
    h = rig.joint("head", b, (0, 0.24, bz + 0.04))
    rig.part(h).ball((0, 0.33, bz + 0.05), (0.1, 0.13, 0.08), D)
    rig.part(h).plate((0, 0.26, bz + 0.11), (0, 0.42, bz + 0.07), 0.16, 0.05, K, taper=0.5, r=0.02, top=L)
    _eyes(rig, h, 0.44, bz + 0.06, ((0.035, 0.02), (-0.035, 0.02), (0.06, -0.01), (-0.06, -0.01)))
    _mandibles(rig, h, 0.42, bz)
    for i, (f, splay) in enumerate(((0.13, 18), (0.0, 0), (-0.13, -22))):
        for side in ("R", "L"):
            _leg(rig, b, i, side, f, splay, bz, reach=0.6, kh=0.2, kr=0.3)
    for side in ("R", "L"):
        _scythe(rig, b, side, bz)
    rig.legs = ["0", "1", "2"]
    rig.gait = {("0", "R"): 0, ("1", "L"): 0, ("2", "R"): 0, ("0", "L"): 1, ("1", "R"): 1, ("2", "L"): 1}
    rig.build()
    rig.root.scale = (1.1,) * 3
    return rig


# ---- brute --------------------------------------------------------------------------------------------------------

def _crusher(rig, body, side, bz):
    """A great crab claw: shoulder, upper arm out and forward, a heavy claw hand with a fixed lower jaw and a hinged
    upper finger, lime along both jaw edges."""
    sx = 1 if side == "R" else -1
    sh, el, wr = (sx * 0.26, 0.24, bz + 0.04), (sx * 0.44, 0.36, bz + 0.26), (sx * 0.4, 0.6, bz + 0.22)
    s = rig.joint(f"claw_{side}", body, sh)
    e = rig.joint(f"blade_{side}", s, el)
    rig.part(s).ball(sh, 0.09, M)
    rig.part(s).plate(sh, el, 0.14, 0.13, D, taper=0.85, r=0.04, top=L)
    rig.part(e).ball(el, 0.08, L)
    rig.part(e).plate(el, wr, 0.2, 0.18, D, taper=1.2, r=0.05, top=L)                       # claw hand
    jaw0, jaw1 = (wr[0], wr[1] + 0.02, wr[2] - 0.07), (wr[0] - sx * 0.02, wr[1] + 0.3, wr[2] - 0.1)
    rig.part(e).plate(jaw0, jaw1, 0.11, 0.09, D, taper=0.4, r=0.02)                          # fixed lower jaw
    rig.part(e).plate((jaw0[0], jaw0[1], jaw0[2] + 0.04), (jaw1[0], jaw1[1] - 0.02, jaw1[2] + 0.03), 0.04, 0.03, A,
                      taper=0.4, r=0.01)
    p = rig.joint(f"pincer_{side}", e, (wr[0], wr[1] + 0.04, wr[2] + 0.06))
    f0, f1 = (wr[0], wr[1] + 0.04, wr[2] + 0.06), (wr[0] - sx * 0.02, wr[1] + 0.32, wr[2] + 0.0)
    rig.part(p).plate(f0, f1, 0.11, 0.09, D, taper=0.4, r=0.02, top=L)                       # hinged finger
    rig.part(p).plate((f0[0], f0[1] + 0.02, f0[2] - 0.035), (f1[0], f1[1] - 0.02, f1[2] - 0.03), 0.04, 0.03, A,
                      taper=0.4, r=0.01)


def brute():
    rig = Rig("brute")
    rig.kind, bz = "brute", 0.36
    b = rig.joint("body", "root", (0, 0, bz))
    rig.part(b).ball((0, 0.0, bz), (0.3, 0.34, 0.2), M)                                       # carapace core
    for f, z, w, dz in ((0.16, 0.13, 0.27, 0.0), (-0.16, 0.12, 0.29, 0.0)):                 # armour plates, front/back
        rig.part(b).plate((0, f - 0.1, bz + z - 0.03), (0, f + 0.1, bz + z + dz), w * 2, 0.09, D, taper=0.85, r=0.05,
                          top=L)
    for sx in (1, -1):                                                                       # flank plates
        rig.part(b).plate((sx * 0.27, -0.2, bz + 0.02), (sx * 0.27, 0.2, bz + 0.04), 0.08, 0.2, D, taper=0.9, r=0.04,
                          top=L)
    _sac(rig, b, (0, -0.02, bz + 0.16), (0.15, 0.16, 0.1),
         ((0, 50), (90, 45), (180, 50), (270, 45), (45, 75), (225, 75)))                     # back sac
    for k in range(3):                                                                       # sac ribs
        f = -0.1 + k * 0.08
        rig.part(b).plate((-0.15, f, bz + 0.2), (0.15, f, bz + 0.2), 0.03, 0.03, K, r=0.01)
    for sx in (1, -1):                                                                       # shoulder spikes
        rig.part(b).strut((sx * 0.22, 0.1, bz + 0.12), (sx * 0.3, 0.06, bz + 0.3), 0.04, L, taper=0.25)
        rig.part(b).ball((sx * 0.3, 0.06, bz + 0.3), 0.016, A)
    ab = rig.joint("abdomen", b, (0, -0.3, bz))
    rig.part(ab).ball((0, -0.42, bz - 0.06), (0.22, 0.17, 0.15), M)                          # armoured rump
    rig.part(ab).plate((0, -0.34, bz + 0.07), (0, -0.52, bz + 0.02), 0.4, 0.07, D, taper=0.8, r=0.04, top=L)
    h = rig.joint("head", b, (0, 0.3, bz - 0.02))
    rig.part(h).ball((0, 0.38, bz - 0.03), (0.13, 0.12, 0.09), D)
    rig.part(h).plate((0, 0.3, bz + 0.06), (0, 0.47, bz + 0.02), 0.24, 0.06, K, taper=0.6, r=0.025, top=L)   # brow
    _eyes(rig, h, 0.49, bz - 0.01, ((0.05, 0.0), (-0.05, 0.0)))
    _mandibles(rig, h, 0.46, bz - 0.06, w=0.06, ln=0.09)
    for i, (f, splay) in enumerate(((0.06, 30), (-0.26, -35))):
        for side in ("R", "L"):
            _leg(rig, b, i, side, f, splay, bz, reach=0.56, kh=0.06, kr=0.32, r=0.07, pad=True)
    for side in ("R", "L"):
        _crusher(rig, b, side, bz)
    rig.legs = ["0", "1"]
    rig.gait = {("0", "R"): 0, ("1", "L"): 0, ("0", "L"): 1, ("1", "R"): 1}
    rig.build()
    rig.root.scale = (1.1,) * 3
    return rig


# ---- spitter ------------------------------------------------------------------------------------------------------

SPOUT = (0, 0.5, 0.36)       # spitter spout tip (rest)


def spitter():
    rig = Rig("spitter")
    rig.kind, bz = "spitter", 0.34
    b = rig.joint("body", "root", (0, 0, bz))
    rig.part(b).ball((0, 0.02, bz), (0.16, 0.2, 0.12), M)
    rig.part(b).plate((0, -0.1, bz + 0.09), (0, 0.14, bz + 0.11), 0.26, 0.06, D, taper=0.8, r=0.03, top=L)
    ab = rig.joint("abdomen", b, (0, -0.14, bz + 0.04))                                      # tail rising up and over
    segs = ((0, -0.2, bz + 0.1, 0.08), (0, -0.26, bz + 0.24, 0.075), (0, -0.24, bz + 0.38, 0.07))
    for k, (x, f, z, r) in enumerate(segs):
        rig.part(ab).ball((x, f, z), r, M if k % 2 == 0 else D)
        rig.part(ab).plate((x, f + 0.03, z + r * 0.6), (x, f - 0.03, z + r * 0.7), r * 1.6, 0.03, D, r=0.012, top=L)
    t = rig.joint("tail", ab, (0, -0.2, bz + 0.46))
    rig.part(t).ball((0, -0.16, bz + 0.48), 0.065, D)
    s = rig.joint("sac", t, (0, -0.06, bz + 0.56))
    _sac(rig, s, (0, -0.04, bz + 0.6), (0.18, 0.19, 0.16),
         ((0, 20), (90, 30), (180, 20), (270, 30), (45, 60), (135, 55), (225, 60), (315, 55)))   # the acid sac
    for k in range(3):                                                                       # ribs over the sac
        a = -0.5 + k * 0.5
        rig.part(s).plate((-0.15 * math.cos(a), -0.04 + 0.14 * math.sin(a), bz + 0.58),
                          (0.15 * math.cos(a), -0.04 + 0.14 * math.sin(a), bz + 0.6), 0.025, 0.025, K, r=0.008)
    rig.part(s).strut((0, -0.04, bz + 0.72), (0, -0.06, bz + 0.8), 0.025, L, taper=0.3)
    rig.part(s).ball((0, -0.06, bz + 0.8), 0.014, A)
    h = rig.joint("head", b, (0, 0.18, bz + 0.02))
    rig.part(h).ball((0, 0.26, bz + 0.02), (0.08, 0.1, 0.07), D)
    rig.part(h).strut((0, 0.3, bz + 0.04), SPOUT, 0.04, M, taper=0.7)                          # spout
    rig.part(h).strut((0, 0.46, 0.355), (0, 0.5, 0.36), 0.032, A, taper=0.9)                  # lime lip
    _eyes(rig, h, 0.33, bz + 0.06, ((0.04, 0.0), (-0.04, 0.0)))
    _mandibles(rig, h, 0.32, bz - 0.02, w=0.045, ln=0.07)
    for k, (tag, d, r) in enumerate((("glob1", 0.1, 0.05), ("glob2", 0.3, 0.06))):          # the spat glob
        c = (0, SPOUT[1] + d, SPOUT[2] + 0.02 - 0.05 * k)
        rig.part(h, tag).ball(c, r, GLOW)
        rig.part(h, tag).ball((0, c[1] - r, c[2] + 0.01), r * 0.6, GLOW)
    for i, (f, splay) in enumerate(((0.06, 28), (-0.1, -32))):
        for side in ("R", "L"):
            _leg(rig, b, i, side, f, splay, bz, reach=0.58, kh=0.22, kr=0.28, r=0.027)
    rig.legs = ["0", "1"]
    rig.gait = {("0", "R"): 0, ("1", "L"): 0, ("0", "L"): 1, ("1", "R"): 1}
    rig.build()
    rig.root.scale = (1.1,) * 3
    return rig


BUILD = {"hunter": hunter, "brute": brute, "spitter": spitter}
