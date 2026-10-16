"""Role gear (rigid, hard parts): engineer rig / tool belt / goggles / hammer, medic pack, gunner vest, pilot
headset, security plates. Head items use the lab's head-size numbers (builder tscale 0.8 on `head`)."""
from .registry import slot_item


@slot_item("gear.back", "engineer_rig")
def engineer_rig(b):
    """Compact back rig; the wrench pokes up over the RIGHT (-x) shoulder, a cutter on the left."""
    t = "socket.back"
    b.plate(t, 0.30, 0.28, 0.12, "gmD", (0, 0, 0), bevel=0.012)
    b.plate(t, 0.2, 0.15, 0.03, "gm", (0, 0, -0.075), bevel=0.008)
    for s in (-1, 1):
        b.prism(t, "limb", 0.07, 0.22, 0.07, "yellow", (s * 0.15, -0.02, 0.02), taper=1)
    b.box(t, 0.03, 0.03, 0.02, "cyan", (0.08, 0.09, -0.09))
    b.plate(t, 0.03, 0.34, 0.025, "plate", (-0.1, 0.3, -0.02), r=(0, 0, 0.12), bevel=0.005)
    b.ball(t, 0.09, 0.08, 0.035, "plate", (-0.12, 0.48, -0.02))
    b.box(t, 0.035, 0.04, 0.045, "dark", (-0.12, 0.505, -0.02))
    b.plate(t, 0.028, 0.26, 0.025, "gm", (0.09, 0.26, -0.02), r=(0, 0, -0.14), bevel=0.004)
    b.plate(t, 0.045, 0.09, 0.035, "hivis", (0.04, 0.12, -0.08), bevel=0.006)


@slot_item("gear.belt", "tool_belt")
def tool_belt(b):
    b.prism("spine", "box", 0.47, 0.06, 0.3, "leather", (0, 0.005, 0), taper=1)
    b.plate("spine", 0.07, 0.065, 0.025, "brass", (0, 0.005, 0.15), bevel=0.007)
    for s in (-1, 1):
        b.prism("spine", "box", 0.09, 0.09, 0.07, "leather", (s * 0.17, -0.015, 0.12))
        b.prism("spine", "box", 0.05, 0.05, 0.04, "leather", (s * 0.11, -0.01, 0.15))
    b.prism("spine", "box", 0.08, 0.07, 0.06, "leather", (0, -0.01, -0.15))


@slot_item("gear.head", "welding_goggles")
def welding_goggles(b):
    """Pushed up on the forehead: strap round the head, lenses tilted up and back."""
    b.prism("head", "box", 0.335, 0.05, 0.325, "strap", (0, 0.285, 0))
    for s in (-1, 1):
        b.plate("head", 0.11, 0.09, 0.05, "brass", (s * 0.075, 0.315, 0.145), r=(-0.5, 0, 0), bevel=0.01)
        b.box("head", 0.075, 0.06, 0.02, "lens", (s * 0.075, 0.33, 0.16), r=(-0.5, 0, 0))


@slot_item("gear.hand.R", "hammer")
def hammer(b):
    t = "socket.hand.R"
    b.plate(t, 0.03, 0.03, 0.26, "plate", (0, 0, 0.08), bevel=0.005)
    b.plate(t, 0.07, 0.08, 0.12, "gm", (0, 0, 0.21), bevel=0.01)
    b.box(t, 0.075, 0.015, 0.04, "hazY", (0, 0.043, 0.21))


@slot_item("gear.back", "medic_pack")
def medic_pack(b):
    t = "socket.back"
    b.plate(t, 0.3, 0.26, 0.11, "medWhite", (0, 0, 0), bevel=0.012)
    b.plate(t, 0.09, 0.03, 0.02, "medRed", (0, 0.0, -0.065), bevel=0.003)
    b.plate(t, 0.03, 0.09, 0.02, "medRed", (0, 0.0, -0.065), bevel=0.003)
    b.plate(t, 0.26, 0.05, 0.09, "steelL", (0, 0.15, 0.0), bevel=0.008)
    b.box(t, 0.04, 0.02, 0.015, "cyan", (0.09, -0.09, -0.065))
    b.plate(t, 0.06, 0.12, 0.06, "medWhite", (-0.11, 0.19, 0.0), bevel=0.008)
    b.plate(t, 0.045, 0.09, 0.045, "medRed", (0.11, 0.17, 0.0), bevel=0.008)


@slot_item("gear.torso", "gunner_vest")
def gunner_vest(b):
    b.plate("spine", 0.38, 0.27, 0.05, "steelL", (0, 0.19, 0.15), bevel=0.01)
    b.plate("spine", 0.38, 0.27, 0.05, "gmD", (0, 0.19, -0.15), bevel=0.01)
    for s in (-1, 1):
        b.plate("spine", 0.06, 0.27, 0.3, "gm", (s * 0.22, 0.17, 0), bevel=0.008)
        b.plate("spine", 0.15, 0.045, 0.2, "gm", (s * 0.25, 0.36, 0), r=(0, 0, -s * 0.2), bevel=0.008)
    for x in (-0.09, 0, 0.09):
        b.plate("spine", 0.06, 0.08, 0.04, "leather", (x, 0.06, 0.19), bevel=0.006)
    b.box("spine", 0.22, 0.02, 0.015, "orange", (0, 0.28, 0.178))


@slot_item("gear.head", "pilot_headset")
def pilot_headset(b):
    b.plate("head", 0.25, 0.035, 0.045, "steelD", (0, 0.358, 0), bevel=0.008)
    for s in (-1, 1):
        b.plate("head", 0.035, 0.12, 0.045, "steelD", (s * 0.14, 0.3, 0), r=(0, 0, s * 0.55), bevel=0.006)
        b.plate("head", 0.06, 0.13, 0.13, "gmD", (s * 0.168, 0.17, 0), bevel=0.012)
        b.box("head", 0.012, 0.07, 0.07, "cyan", (s * 0.2, 0.17, 0))
    b.plate("head", 0.02, 0.02, 0.15, "steelD", (0.15, 0.12, 0.09), r=(0.3, 0, 0), bevel=0.004)
    b.ball("head", 0.045, 0.045, 0.045, "cyan", (0.15, 0.1, 0.17))


@slot_item("gear.torso", "security_plates")
def security_plates(b):
    for s in (-1, 1):
        b.plate("spine", 0.19, 0.05, 0.24, "gm", (s * 0.27, 0.37, 0), r=(0, 0, -s * 0.2), bevel=0.01)
        b.plate("spine", 0.15, 0.045, 0.19, "plate", (s * 0.29, 0.405, 0), r=(0, 0, -s * 0.2), bevel=0.009)
        b.box("spine", 0.03, 0.015, 0.2, "hazY", (s * 0.2, 0.395, 0), r=(0, 0, -s * 0.2))
        b.box("spine", 0.02, 0.02, 0.09, "red", (s * 0.33, 0.35, 0.06), r=(0, 0, -s * 0.2))
