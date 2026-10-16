"""Human base body: head with a faceted face read, torso, hips, legs and boots. Arms, hair, eyes and clothes are slots."""
from lib.kit import skin



def build_body(b):
    # hips: dark undershorts so nothing shows through gaps
    b.prism("hips", "box", 0.46, 0.19, 0.3, "strap", (0, 0, 0))
    # bare torso (clothing covers it; tank top and jacket are slightly larger)
    b.prism("spine", "box", 0.54, 0.44, 0.33, skin(), (0, 0.23, 0), taper=1)
    b.prism("spine", "box", 0.2, 0.06, 0.2, skin(0.8), (0, 0.46, 0), taper=1)

    # head: neck, skull, nose wedge, brow ridge, jaw, ears
    b.prism("head", "limb", 0.15, 0.1, 0.15, skin(0.78), (0, 0.02, 0), taper=1)
    b.ball("head", 0.31, 0.32, 0.30, skin(), (0, 0.18, 0))
    b.prism("head", "box", 0.05, 0.08, 0.07, skin(0.78), (0, 0.155, 0.17), r=(0.45, 0, 0))
    b.prism("head", "box", 0.27, 0.04, 0.07, skin(0.78), (0, 0.245, 0.14))
    b.prism("head", "box", 0.22, 0.07, 0.2, skin(), (0, 0.065, 0.07))
    for s in (1, -1):
        b.prism("head", "box", 0.03, 0.07, 0.05, skin(0.78), (s * 0.158, 0.17, -0.01))

    for side, s in (("L", 1), ("R", -1)):
        b.prism(f"leg.{side}", "limb", 0.2, 0.26, 0.22, skin(0.85), (0, -0.12, 0), taper=0.88)
        b.prism(f"shin.{side}", "limb", 0.18, 0.2, 0.19, skin(0.85), (0, -0.07, 0), taper=0.92)
        # boot: shaft, toe cap, sole
        b.prism(f"foot.{side}", "box", 0.25, 0.16, 0.3, "boot", (0, 0, 0.04))
        b.prism(f"foot.{side}", "box", 0.24, 0.07, 0.13, "toe", (0, -0.02, 0.2))
        b.prism(f"foot.{side}", "box", 0.27, 0.04, 0.33, "black", (0, -0.06, 0.04))
