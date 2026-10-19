"""Hostile aliens (derelict infestation), built on the robot rig kit: rigid smooth-shaded parts on a joint rig, character
frame x = the creature's right, f = forward, z up, 1 unit = 1 tile (see robot_kit).

HUNTER, the swarm melee unit: a low hunched chitinous thorax with a segmented abdomen trailing behind, six spindly
jointed legs arching above the body (about a tile across), a wedge head with snapping mandibles and an eye cluster, and
two folded mantis scythes. Dark violet-black carapace, one sickly lime accent on the blade edges, mandible and spine
tips; bioluminescent glow (eyes and the sacs along the abdomen) on the glow sheet. Top about 0.7, well under crew."""
from .robot_kit import Rig

K, D, M, L, A, GLOW = "xnK", "xnD", "xnM", "xnL", "xnA", "xnG"
BZ = 0.3                          # thorax height (crouched)
LEGS = ((0.13, 18), (0.0, 0), (-0.13, -22))   # (hip f, splay yaw degrees) front to back


def _leg(rig, body, i, side, f, splay):
    """Hip on the thorax side, femur arching up and out to the knee, tibia down to a pointed foot."""
    sx = 1 if side == "R" else -1
    import math
    a = math.radians(splay)
    out = lambda r, df=0.0: (sx * r * math.cos(a), f + r * math.sin(a) + df)  # noqa: E731
    hip = (sx * 0.14, f, BZ)
    kx, kf = out(0.3)
    knee = (kx, kf, BZ + 0.2)
    fx, ff = out(0.6)
    foot = (fx, ff, 0.0)
    h = rig.joint(f"leg{i}_{side}", body, hip)
    k = rig.joint(f"knee{i}_{side}", h, knee)
    rig.part(h).ball(hip, 0.045, M)
    rig.part(h).limb(hip, knee, 0.03, D)
    rig.part(k).ball(knee, 0.038, L)
    mid = tuple(knee[j] + (foot[j] - knee[j]) * 0.75 for j in range(3))
    rig.part(k).limb(knee, mid, 0.026, D)
    rig.part(k).strut(mid, foot, 0.02, K, taper=0.2)


def _scythe(rig, body, side):
    """Mantis forelimb: shoulder on the thorax front, upper arm up and forward, a hooked blade folded down."""
    sx = 1 if side == "R" else -1
    sh, el, tip = (sx * 0.13, 0.2, BZ + 0.1), (sx * 0.2, 0.3, BZ + 0.42), (sx * 0.18, 0.66, BZ + 0.1)
    s = rig.joint(f"claw_{side}", body, sh)
    e = rig.joint(f"blade_{side}", s, el)
    rig.part(s).ball(sh, 0.06, M)
    rig.part(s).plate(sh, el, 0.09, 0.08, D, taper=0.75, r=0.025, top=L)       # upper arm
    rig.part(e).ball(el, 0.055, L)
    rig.part(e).plate(el, tip, 0.06, 0.1, D, taper=0.5, r=0.015)                # blade spine
    rig.part(e).plate((el[0], el[1] + 0.05, el[2] - 0.05), (tip[0], tip[1] - 0.02, tip[2] - 0.04), 0.035, 0.07, A,
                      taper=0.35, r=0.008)                                      # the lime blade edge
    hook = (tip[0], tip[1] - 0.1, tip[2] - 0.1)
    rig.part(e).strut(tip, hook, 0.03, A, taper=0.15)                           # hook


def hunter():
    rig = Rig("hunter")
    rig.kind = "hunter"
    b = rig.joint("body", "root", (0, 0, BZ))
    rig.part(b).ball((0, 0.04, BZ), (0.17, 0.22, 0.13), M)                      # thorax
    for k, (f, z, w) in enumerate(((0.12, 0.1, 0.15), (-0.02, 0.12, 0.17), (-0.14, 0.09, 0.15))):   # carapace plates
        rig.part(b).plate((0, f - 0.07, BZ + z - 0.02), (0, f + 0.07, BZ + z), w * 2, 0.06, D, taper=0.8, r=0.03, top=L)
    for f in (0.1, -0.04):                                                      # dorsal spines
        rig.part(b).strut((0, f, BZ + 0.14), (0, f - 0.06, BZ + 0.27), 0.03, L, taper=0.3)
        rig.part(b).ball((0, f - 0.06, BZ + 0.27), 0.014, A)
    ab = rig.joint("abdomen", b, (0, -0.18, BZ))
    for k, (f, z, r) in enumerate(((-0.3, BZ - 0.04, (0.16, 0.15, 0.12)), (-0.47, BZ - 0.1, (0.12, 0.12, 0.09)),
                                   (-0.6, BZ - 0.16, (0.08, 0.09, 0.06)))):
        rig.part(ab).ball((0, f, z), r, M if k % 2 == 0 else D)
        rig.part(ab).plate((0, f + 0.05, z + r[2] * 0.7), (0, f - 0.05, z + r[2] * 0.6), r[0] * 1.6, 0.04, D,
                           taper=0.8, r=0.02, top=L)
    rig.part(ab).strut((0, -0.66, BZ - 0.18), (0, -0.8, BZ - 0.26), 0.035, K, taper=0.2)     # tail spike
    for f, z in ((-0.3, BZ - 0.06), (-0.46, BZ - 0.12)):                                   # glow sacs
        for sx in (1, -1):
            rig.part(ab, "glow").ball((sx * 0.13, f, z), 0.03, GLOW)
            rig.part(ab, "glowoff").ball((sx * 0.13, f, z), 0.03, D)
    h = rig.joint("head", b, (0, 0.24, BZ + 0.04))
    rig.part(h).ball((0, 0.33, BZ + 0.05), (0.1, 0.13, 0.08), D)                 # head
    rig.part(h).plate((0, 0.26, BZ + 0.11), (0, 0.42, BZ + 0.07), 0.16, 0.05, K, taper=0.5, r=0.02, top=L)   # crest
    for dx, dz in ((0.035, 0.02), (-0.035, 0.02), (0.06, -0.01), (-0.06, -0.01)):          # eye cluster
        rig.part(h, "glow").ball((dx, 0.44, BZ + 0.06 + dz), 0.016, GLOW)
        rig.part(h, "glowoff").ball((dx, 0.44, BZ + 0.06 + dz), 0.016, K)
    for side, sx in (("R", 1), ("L", -1)):                                      # mandibles
        m = rig.joint(f"mand_{side}", h, (sx * 0.05, 0.42, BZ))
        rig.part(m).plate((sx * 0.05, 0.42, BZ), (sx * 0.035, 0.55, BZ - 0.04), 0.035, 0.035, D, taper=0.5, r=0.01)
        rig.part(m).strut((sx * 0.035, 0.55, BZ - 0.04), (sx * 0.0, 0.6, BZ - 0.05), 0.016, A, taper=0.2)
    for i, (f, splay) in enumerate(LEGS):
        for side in ("R", "L"):
            _leg(rig, b, i, side, f, splay)
    for side in ("R", "L"):
        _scythe(rig, b, side)
    rig.build()
    rig.root.scale = (1.1,) * 3
    return rig


BUILD = {"hunter": hunter}
