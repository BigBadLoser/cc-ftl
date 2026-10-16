"""Clothing slots: work jacket (+ hi-vis variant), tank top, cargo pants. Cloth and accent are `team.*` tinted."""
from lib.kit import accent, cloth
from .registry import slot_item


def _sleeves(b, body):
    for side, s in (("L", 1), ("R", -1)):
        a = f"arm.{side}"
        b.prism(a, "limb", 0.23, 0.14, 0.23, body, (0, -0.05, 0), taper=1)
        b.prism(a, "box", 0.24, 0.025, 0.24, "torn", (0, -0.12, 0), taper=1)


def _jacket(b, body, dark, stripes):
    b.prism("spine", "box", 0.6, 0.46, 0.36, body, (0, 0.23, 0), taper=1)
    for y in (0.17, 0.3):
        b.prism("spine", "box", 0.615, 0.045, 0.372, stripes, (0, y, 0), taper=1)
    for s in (1, -1):
        b.prism("spine", "box", 0.07, 0.2, 0.375, stripes, (s * 0.15, 0.37, 0), taper=1)
        b.prism("spine", "box", 0.2, 0.12, 0.3, dark, (s * 0.33, 0.43, 0))
    b.prism("spine", "box", 0.34, 0.06, 0.26, dark, (0, 0.49, 0))
    _sleeves(b, body)


@slot_item("torso", "work_jacket")
def work_jacket(b):
    _jacket(b, cloth(), cloth(0.76), accent())


@slot_item("torso", "work_jacket_hivis")
def work_jacket_hivis(b):
    """Whole jacket in the accent tint (hi-vis), silver reflective bands, cloth-tinted yoke."""
    _jacket(b, accent(), cloth(0.76), "plate")
    b.prism("spine", "box", 0.4, 0.07, 0.3, cloth(0.9), (0, 0.45, 0), taper=1)


@slot_item("torso", "tank_top")
def tank_top(b):
    b.prism("spine", "box", 0.58, 0.4, 0.35, cloth(), (0, 0.22, 0), taper=1)
    for s in (1, -1):
        b.prism("spine", "box", 0.12, 0.1, 0.3, cloth(0.9), (s * 0.19, 0.44, 0), taper=1)
    b.prism("spine", "box", 0.585, 0.03, 0.355, cloth(0.7), (0, 0.035, 0), taper=1)


@slot_item("legs", "cargo_pants")
def cargo_pants(b):
    b.prism("hips", "box", 0.5, 0.2, 0.32, "pants", (0, 0, 0))
    for side, s in (("L", 1), ("R", -1)):
        b.prism(f"leg.{side}", "limb", 0.23, 0.26, 0.25, "pants", (0, -0.12, 0), taper=0.88)
        b.prism(f"leg.{side}", "box", 0.06, 0.13, 0.17, "pocket", (s * 0.125, -0.1, 0))
        b.prism(f"shin.{side}", "limb", 0.21, 0.2, 0.22, "pants", (0, -0.07, 0), taper=0.92)
        b.plate(f"shin.{side}", 0.15, 0.07, 0.05, "plateB", (0, 0.0, 0.11), bevel=0.01)
        b.prism(f"shin.{side}", "box", 0.05, 0.1, 0.12, "pocket", (s * 0.115, -0.07, 0.01))
