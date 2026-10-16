"""Arm slots (per side). flesh: skinned bare arm with a leather wrist band. cyber: bulky gunmetal plating (rigid
per bone), cyan light strip along the forearm, glowing wrist ring."""
from lib.kit import skin
from .registry import slot_item


@slot_item("arm", "flesh", sides=("L", "R"), skinned=True)
def flesh(b, s, side):
    a, f, h = f"arm.{side}", f"forearm.{side}", f"hand.{side}"
    b.ball(a, 0.13, 0.12, 0.13, skin(), (0, -0.005, 0))
    b.prism(a, "limb", 0.115, 0.29, 0.115, skin(), (0, -0.14, 0), taper=0.85)
    b.prism(f, "limb", 0.1, 0.24, 0.1, skin(0.92), (0, -0.115, 0), taper=0.85)
    b.prism(f, "box", 0.108, 0.035, 0.108, "leather", (0, -0.2, 0), taper=1)
    b.prism(h, "box", 0.115, 0.15, 0.12, skin(), (0, -0.075, 0.01), taper=0.9)
    b.prism(h, "box", 0.04, 0.065, 0.07, skin(0.78), (-s * 0.06, -0.05, 0.035), taper=1)


@slot_item("arm", "cyber", sides=("L", "R"))
def cyber(b, s, side):
    a, f, h = f"arm.{side}", f"forearm.{side}", f"hand.{side}"
    b.plate(a, 0.15, 0.1, 0.15, "dark", (0, -0.02, 0), bevel=0.01)
    b.plate(a, 0.17, 0.25, 0.17, "gmD", (0, -0.15, 0), bevel=0.014, taper=0.88)
    b.plate(a, 0.19, 0.07, 0.19, "gm", (0, -0.12, 0), bevel=0.012)
    b.box(a, 0.03, 0.08, 0.015, "cyan", (0, -0.17, 0.088))
    b.plate(f, 0.14, 0.13, 0.14, "dark", (0, 0.0, 0), bevel=0.01)
    b.plate(f, 0.19, 0.22, 0.19, "gm", (0, -0.115, 0), bevel=0.014, taper=0.9)
    b.plate(f, 0.04, 0.17, 0.14, "plate", (s * 0.105, -0.115, 0), bevel=0.008)
    b.plate(f, 0.18, 0.025, 0.18, "gmD", (0, -0.055, 0), bevel=0.006)
    b.box(f, 0.05, 0.17, 0.02, "cyan", (0, -0.115, 0.098))
    b.box(f, 0.025, 0.17, 0.05, "cyan", (s * 0.127, -0.115, 0))
    b.box(f, 0.205, 0.018, 0.205, "cyan", (0, -0.225, 0))
    b.plate(h, 0.17, 0.15, 0.15, "gmD", (0, -0.08, 0.01), bevel=0.014)
    b.plate(h, 0.05, 0.07, 0.09, "gm", (-s * 0.105, -0.05, 0.04), bevel=0.008)
    b.box(h, 0.1, 0.025, 0.03, "cyan", (0, -0.03, 0.092))
    for x in (-0.05, 0.0, 0.05):
        b.plate(h, 0.04, 0.05, 0.04, "gm", (x, -0.16, 0.085), bevel=0.006)
