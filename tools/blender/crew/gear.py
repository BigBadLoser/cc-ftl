"""Role gear: engineer rig / tool belt / goggles / hammer, medic pack, gunner vest, pilot headset, security plates."""
from .registry import slot_item


@slot_item("gear.back", "engineer_rig")
def engineer_rig(b):
    t = "socket.back"
    b.plate(t, 0.42, 0.38, 0.16, "gmD", (0, 0, 0), bevel=0.014)
    b.plate(t, 0.3, 0.2, 0.04, "gm", (0, 0, -0.1), bevel=0.01)
    for s in (-1, 1):
        b.prism(t, "limb", 0.1, 0.3, 0.1, "yellow", (s * 0.2, -0.03, 0.02), taper=1)
    b.box(t, 0.04, 0.04, 0.03, "cyan", (0.12, 0.12, -0.12))
    b.plate(t, 0.04, 0.42, 0.035, "plate", (0.1, 0.4, -0.02), r=(0, 0, -0.12), bevel=0.006)
    b.ball(t, 0.12, 0.1, 0.05, "plate", (0.14, 0.62, -0.02))
    b.box(t, 0.045, 0.05, 0.06, "dark", (0.14, 0.65, -0.02))
    b.plate(t, 0.035, 0.36, 0.03, "gm", (-0.1, 0.38, -0.02), r=(0, 0, 0.14), bevel=0.005)
    b.plate(t, 0.035, 0.34, 0.03, "plate", (-0.07, 0.37, -0.02), r=(0, 0, -0.1), bevel=0.005)
    b.plate(t, 0.06, 0.12, 0.045, "hivis", (-0.08, 0.2, -0.02), bevel=0.008)


@slot_item("gear.belt", "tool_belt")
def tool_belt(b):
    b.prism("spine", "box", 0.63, 0.075, 0.39, "leather", (0, 0.01, 0), taper=1)
    for i in range(4):
        b.box("spine", 0.06, 0.06, 0.02, "black" if i % 2 else "yellow", (-0.09 + i * 0.06, 0.01, 0.2))
    b.plate("spine", 0.09, 0.08, 0.03, "plate", (0, 0.01, 0.215), bevel=0.008)
    for s in (-1, 1):
        b.prism("spine", "box", 0.12, 0.1, 0.09, "leather", (s * 0.23, 0.0, 0.2))
    b.prism("spine", "box", 0.09, 0.08, 0.07, "leather", (0, -0.01, -0.2))


@slot_item("gear.head", "welding_goggles")
def welding_goggles(b):
    b.prism("head", "box", 0.335, 0.05, 0.325, "strap", (0, 0.27, 0))
    for s in (-1, 1):
        b.plate("head", 0.11, 0.09, 0.05, "brass", (s * 0.075, 0.285, 0.165), bevel=0.01)
        b.box("head", 0.075, 0.06, 0.02, "lens", (s * 0.075, 0.285, 0.195))


@slot_item("gear.hand.R", "hammer")
def hammer(b):
    t = "socket.hand.R"
    b.plate(t, 0.04, 0.04, 0.34, "plate", (0, 0, 0.1), bevel=0.006)
    b.plate(t, 0.09, 0.1, 0.16, "gm", (0, 0, 0.27), bevel=0.012)
    b.box(t, 0.095, 0.02, 0.05, "hazY", (0, 0.055, 0.27))


@slot_item("gear.back", "medic_pack")
def medic_pack(b):
    t = "socket.back"
    b.plate(t, 0.4, 0.34, 0.15, "medWhite", (0, 0, 0), bevel=0.016)
    b.plate(t, 0.12, 0.04, 0.02, "medRed", (0, 0.0, -0.085), bevel=0.004)
    b.plate(t, 0.04, 0.12, 0.02, "medRed", (0, 0.0, -0.085), bevel=0.004)
    b.plate(t, 0.34, 0.06, 0.12, "steelL", (0, 0.2, 0.0), bevel=0.01)
    b.box(t, 0.05, 0.03, 0.02, "cyan", (0.12, -0.12, -0.085))
    b.plate(t, 0.08, 0.16, 0.08, "medWhite", (-0.15, 0.24, 0.0), bevel=0.01)
    b.plate(t, 0.06, 0.12, 0.06, "medRed", (0.15, 0.22, 0.0), bevel=0.01)


@slot_item("gear.torso", "gunner_vest")
def gunner_vest(b):
    b.plate("spine", 0.5, 0.34, 0.07, "steelL", (0, 0.26, 0.205), bevel=0.014)
    b.plate("spine", 0.5, 0.34, 0.07, "gmD", (0, 0.26, -0.205), bevel=0.014)
    for s in (-1, 1):
        b.plate("spine", 0.1, 0.34, 0.4, "gm", (s * 0.3, 0.22, 0), bevel=0.012)
        b.plate("spine", 0.2, 0.06, 0.26, "gm", (s * 0.33, 0.47, 0), r=(0, 0, -s * 0.2), bevel=0.01)
    for x in (-0.12, 0, 0.12):
        b.plate("spine", 0.08, 0.1, 0.05, "leather", (x, 0.1, 0.26), bevel=0.008)
    b.box("spine", 0.3, 0.025, 0.02, "orange", (0, 0.36, 0.245))


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
        b.plate("spine", 0.26, 0.07, 0.32, "gm", (s * 0.35, 0.5, 0), r=(0, 0, -s * 0.2), bevel=0.014)
        b.plate("spine", 0.2, 0.06, 0.26, "plate", (s * 0.38, 0.545, 0), r=(0, 0, -s * 0.2), bevel=0.012)
        b.box("spine", 0.04, 0.02, 0.28, "hazY", (s * 0.27, 0.535, 0), r=(0, 0, -s * 0.2))
        b.box("spine", 0.03, 0.03, 0.12, "red", (s * 0.42, 0.49, 0.08), r=(0, 0, -s * 0.2))
