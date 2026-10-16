"""Human base body (AVERAGE): one skinned mesh. ~6 heads tall; slightly enlarged head, hands and boots.
Head parts are authored at the lab's head size and scaled by the builder's tscale (0.8). Arms are slots."""
from lib.kit import skin
from . import bodytype


def build_body(b):
    bt = bodytype.current
    # pelvis: dark undershorts, glutes
    b.prism("hips", "box", 0.33 * bt.hips, 0.2, 0.22 * bt.belly, "strap", (0, 0, 0))
    b.prism("hips", "box", 0.3 * bt.hips, 0.13, 0.2 * bt.belly, "strap", (0, -0.06, -0.03), taper=0.85)
    # torso: abdomen, broad chest, pecs, collarbone and trapezius; neck base
    b.prism("spine", "box", 0.34 * bt.chest, 0.17, 0.22 * bt.belly, skin(0.95), (0, 0.075, 0), taper=0.92)
    b.prism("spine", "box", 0.39 * bt.chest, 0.21, 0.25 * bt.belly, skin(), (0, 0.26, 0), taper=0.8)
    for s in (1, -1):
        b.prism("spine", "box", 0.15, 0.09, 0.035, skin(0.92), (s * 0.085, 0.27, 0.085), taper=0.9)
        b.prism("spine", "box", 0.1, 0.04, 0.12, skin(0.85), (s * 0.11, 0.355, -0.01), r=(0, 0, s * 0.45), taper=1)
    b.prism("spine", "box", 0.26, 0.025, 0.08, skin(0.8), (0, 0.34, 0.05), taper=1)
    b.prism("spine", "box", 0.15, 0.05, 0.12, skin(0.8), (0, 0.39, 0), taper=1)

    # head: neck, skull, forehead, nose wedge, brow ridge, cheeks, jaw, chin, ears
    b.prism("head", "limb", 0.15, 0.1, 0.15, skin(0.78), (0, 0.02, 0), taper=1)
    b.ball("head", 0.31, 0.32, 0.30, skin(), (0, 0.18, 0))
    b.prism("head", "box", 0.22, 0.05, 0.08, skin(), (0, 0.285, 0.1))
    b.prism("head", "box", 0.05, 0.08, 0.07, skin(0.78), (0, 0.155, 0.17), r=(0.45, 0, 0))
    b.prism("head", "box", 0.27, 0.04, 0.07, skin(0.78), (0, 0.245, 0.14))
    b.prism("head", "box", 0.22, 0.07, 0.2, skin(), (0, 0.065, 0.07))
    b.prism("head", "box", 0.1, 0.05, 0.06, skin(0.85), (0, 0.03, 0.15))
    for s in (1, -1):
        b.prism("head", "box", 0.06, 0.07, 0.07, skin(0.9), (s * 0.095, 0.12, 0.115))
        b.prism("head", "box", 0.03, 0.07, 0.05, skin(0.78), (s * 0.158, 0.17, -0.01))

    for side, s in (("L", 1), ("R", -1)):
        L, S = f"leg.{side}", f"shin.{side}"
        b.prism(L, "limb", 0.165 * bt.limb, 0.2, 0.17 * bt.limb, skin(0.85), (0, -0.1, 0), taper=0.95)
        b.prism(L, "limb", 0.15 * bt.limb, 0.2, 0.155 * bt.limb, skin(0.85), (0, -0.27, 0), taper=0.85)
        b.ball(S, 0.1, 0.1, 0.1, skin(0.8), (0, 0.0, 0.035))
        b.prism(S, "limb", 0.12 * bt.limb, 0.14, 0.09 * bt.limb, skin(0.85), (0, -0.09, -0.025), taper=0.9)
        b.prism(S, "limb", 0.125 * bt.limb, 0.3, 0.13 * bt.limb, skin(0.85), (0, -0.15, 0), taper=0.7)
        # heavy boot: cuff, shaft, foot, toe cap, heel, light sole
        F = f"foot.{side}"
        b.prism(F, "box", 0.19, 0.03, 0.21, "toe", (0, 0.09, 0))
        b.prism(F, "box", 0.17, 0.15, 0.19, "boot", (0, 0.02, 0))
        b.prism(F, "box", 0.17, 0.09, 0.3, "boot", (0, -0.035, 0.07))
        b.prism(F, "box", 0.17, 0.07, 0.1, "toe", (0, -0.04, 0.2))
        b.prism(F, "box", 0.16, 0.06, 0.09, "boot", (0, -0.05, -0.08))
        b.prism(F, "box", 0.19, 0.035, 0.34, "sole", (0, -0.08, 0.07))
