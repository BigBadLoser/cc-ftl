"""Clothing slots (skinned layers fitted over the body): work shirt (+ hi-vis), tee, tank top, cargo pants.
Cloth and accent are `team.*` tinted."""
from lib.kit import accent, cloth
from . import bodytype
from .registry import slot_item


def _sleeves(b, body, length, w):
    for side in ("L", "R"):
        a = f"arm.{side}"
        b.prism(a, "limb", w, length, w, body, (0, -length / 2 + 0.03, 0), taper=1)


def _shirt(b, body, dark, bands):
    bt = bodytype.current
    b.prism("spine", "box", 0.43 * bt.chest, 0.37, 0.28 * bt.belly, body, (0, 0.185, 0), taper=0.8)
    for y in (0.09, 0.24):
        b.prism("spine", "box", 0.435 * bt.chest, 0.04, 0.285 * bt.belly, bands, (0, y, 0), taper=0.8)
    for s in (1, -1):
        b.prism("spine", "box", 0.045, 0.3, 0.285 * bt.belly, bands, (s * 0.1, 0.2, 0), taper=0.8)
        b.prism("spine", "box", 0.1, 0.05, 0.2, dark, (s * 0.17, 0.375, 0))
    b.prism("spine", "box", 0.2, 0.05, 0.17, dark, (0, 0.385, 0), taper=1)
    _sleeves(b, body, 0.15, 0.135)
    for side in ("L", "R"):
        b.prism(f"arm.{side}", "box", 0.142, 0.02, 0.142, "torn", (0, -0.12, 0), taper=1)


@slot_item("torso", "work_shirt", skinned=True)
def work_shirt(b):
    _shirt(b, cloth(), cloth(0.76), accent())


@slot_item("torso", "work_shirt_hivis", skinned=True)
def work_shirt_hivis(b):
    """Whole shirt in the accent tint (hi-vis), silver reflective bands, cloth-tinted yoke."""
    _shirt(b, accent(), cloth(0.76), "plate")


@slot_item("torso", "tank_top", skinned=True)
def tank_top(b):
    bt = bodytype.current
    b.prism("spine", "box", 0.42 * bt.chest, 0.33, 0.27 * bt.belly, cloth(), (0, 0.17, 0), taper=0.8)
    for s in (1, -1):
        b.prism("spine", "box", 0.09, 0.1, 0.2, cloth(0.9), (s * 0.12, 0.35, 0), taper=1)


@slot_item("undershirt", "tee_black", skinned=True)
def tee_black(b):
    bt = bodytype.current
    b.prism("spine", "box", 0.41 * bt.chest, 0.43, 0.265 * bt.belly, "black", (0, 0.165, 0), taper=0.8)
    b.prism("spine", "box", 0.2, 0.04, 0.16, "black", (0, 0.385, 0), taper=1)
    _sleeves(b, "black", 0.12, 0.12)


@slot_item("legs", "cargo_pants", skinned=True)
def cargo_pants(b):
    bt = bodytype.current
    b.prism("hips", "box", 0.37 * bt.hips, 0.2, 0.25 * bt.belly, "pants", (0, 0, 0))
    for side, s in (("L", 1), ("R", -1)):
        b.prism(f"leg.{side}", "limb", 0.19 * bt.limb, 0.37, 0.2 * bt.limb, "pants", (0, -0.175, 0), taper=0.8)
        b.prism(f"leg.{side}", "box", 0.05, 0.12, 0.13, "pocket", (s * 0.095, -0.15, 0))
        b.prism(f"shin.{side}", "limb", 0.155 * bt.limb, 0.32, 0.165 * bt.limb, "pants", (0, -0.15, 0), taper=0.88)
        b.plate(f"shin.{side}", 0.13, 0.1, 0.05, "steelD", (0, 0.0, 0.085), bevel=0.012)
        b.prism(f"shin.{side}", "box", 0.045, 0.1, 0.1, "pocket", (s * 0.085, -0.1, 0.01))
