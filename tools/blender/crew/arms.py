"""Arm slots (per side): bare flesh arm and the bulky gunmetal cyber arm (plating, cyan strip, glowing wrist ring)."""
from lib.kit import skin
from .registry import slot_item


@slot_item("arm", "flesh", sides=("L", "R"))
def flesh(b, s, side):
    b.ball(f"arm.{side}", 0.19, 0.17, 0.19, skin(), (0, -0.01, 0))
    b.prism(f"arm.{side}", "limb", 0.16, 0.24, 0.16, skin(), (0, -0.11, 0), taper=0.9)
    b.prism(f"forearm.{side}", "limb", 0.145, 0.23, 0.145, skin(0.92), (0, -0.1, 0), taper=0.85)
    b.prism(f"hand.{side}", "box", 0.14, 0.13, 0.14, skin(), (0, -0.065, 0.01), taper=0.9)
    b.prism(f"hand.{side}", "box", 0.05, 0.07, 0.09, skin(0.78), (-s * 0.085, -0.05, 0.04), taper=1)


@slot_item("arm", "cyber", sides=("L", "R"))
def cyber(b, s, side):
    a, f, h = f"arm.{side}", f"forearm.{side}", f"hand.{side}"
    # upper arm: stacked plates around a dark joint
    b.plate(a, 0.2, 0.12, 0.2, "dark", (0, -0.03, 0), bevel=0.012)
    b.plate(a, 0.21, 0.2, 0.21, "gmD", (0, -0.15, 0), bevel=0.016, taper=0.9)
    b.plate(a, 0.23, 0.08, 0.23, "gm", (0, -0.12, 0), bevel=0.014)
    b.box(a, 0.04, 0.1, 0.02, "cyan", (0, -0.16, 0.112))
    # forearm: elbow, big armoured sleeve, side plate, wide cyan strips, glowing wrist ring
    b.plate(f, 0.18, 0.17, 0.18, "dark", (0, 0.0, 0), bevel=0.012)
    b.plate(f, 0.24, 0.24, 0.24, "gm", (0, -0.13, 0), bevel=0.018, taper=0.92)
    b.plate(f, 0.05, 0.19, 0.17, "plate", (s * 0.12, -0.13, 0), bevel=0.01)
    b.plate(f, 0.22, 0.03, 0.22, "gmD", (0, -0.07, 0), bevel=0.008)
    b.box(f, 0.03, 0.2, 0.06, "cyan", (s * 0.15, -0.13, 0))
    b.box(f, 0.06, 0.18, 0.025, "cyan", (0, -0.13, 0.128))
    b.box(f, 0.26, 0.02, 0.26, "cyan", (0, -0.235, 0))
    # hand: armoured fist, thumb block, knuckle glow
    b.plate(h, 0.22, 0.17, 0.22, "gmD", (0, -0.09, 0.01), bevel=0.016)
    b.plate(h, 0.06, 0.08, 0.12, "gm", (-s * 0.13, -0.05, 0.05), bevel=0.01)
    b.box(h, 0.12, 0.03, 0.04, "cyan", (0, -0.03, 0.125))
    for x in (-0.07, 0.0, 0.07):
        b.plate(h, 0.05, 0.06, 0.05, "gm", (x, -0.17, 0.1), bevel=0.008)
