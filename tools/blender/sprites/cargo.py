"""Delivery cargo (family `cargo`, sheet `cargo`): the sealed hard case a delivery job brings aboard (item.cargo_crate).

  item.cargo_crate.l     the case on the deck, at the item stacks' tile scale (it never stacks, so it has one size)
  item.cargo_crate.held  the small version a crew member carries, sized like the other .held sprites

A moulded hard case, nothing like the rusty storage crates or the loose stacks: a black shell with a lid seam, chunky
yellow corner caps, ribs down the long sides, two front latches and a carry handle on the lid, and a red seal band over
the lid with a red status light (glow) that says sealed, someone else's. Origin = centre of the tile at floor level, as
items.py; the camera sees the +x end and the +y long side, so the light and the tag sit on +y. The renderer finds both
ids already (itemView.ts stackAssets / heldAssets)."""
import math

from . import core
from .items import HELD_K, STACK_K, _fin

SHELL, SHELL_TOP, CAP, CAP_TOP = "black", "grime", "hazY", "yellow"


def case(m, L, W, H, rz=0.0, detail=True):
    """A hard case L x W x H (grid units, long side along x before the turn rz), standing on the floor."""
    def at(x, y, z):
        c, s = math.cos(rz), math.sin(rz)
        return (x * c - y * s, x * s + y * c, z)
    lid = H * 0.36
    m.box(at(0, 0, 0), (L, W, H - lid), SHELL, top=SHELL, rz=rz, base=True, bevel=min(W, H) * 0.12)           # body
    m.box(at(0, 0, H - lid - 0.004), (L * 1.01, W * 1.01, 0.012), "dark", rz=rz, base=True)                   # lid seam
    m.box(at(0, 0, H - lid + 0.008), (L, W, lid - 0.008), SHELL, top=SHELL_TOP, rz=rz, base=True, bevel=lid * 0.25)
    cs = min(W, H) * 0.32                                                    # corner caps, top and bottom
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z0, h in ((0, cs * 0.9), (H - cs * 0.9, cs * 0.9)):
                m.box(at(sx * (L / 2 - cs / 2 + 0.006), sy * (W / 2 - cs / 2 + 0.006), z0), (cs, cs, h), CAP, top=CAP_TOP,
                      rz=rz, base=True, bevel=cs * 0.15)
    if not detail:
        m.box(at(0, 0, H), (L * 0.18, W * 0.14, 0.02), "steelD", rz=rz, base=True)
        m.box(at(0, 0, H - 0.004), (L * 0.1, W * 1.02, 0.03), "medRed", rz=rz, base=True)
        return
    for sx in (-0.18, 0.18):                                                  # ribs down the long sides
        m.box(at(sx * L, 0, cs * 0.6), (0.035, W * 1.04, H - lid - cs * 0.8), "steelD", top="steelD", rz=rz, base=True)
    for sx in (-0.3, 0.3):                                                    # latches across the seam, both long sides
        m.box(at(sx * L, -W / 2 - 0.006, H - lid - 0.05), (0.07, 0.03, 0.1), "steelL", top="plate", rz=rz, base=True)
        m.box(at(sx * L, W / 2 + 0.006, H - lid - 0.05), (0.07, 0.03, 0.1), "steelL", top="plate", rz=rz, base=True)
    for sx in (-0.13, 0.13):                                                  # the carry handle on the lid
        m.box(at(sx * L, 0, H), (0.035, 0.05, 0.05), "steelD", rz=rz, base=True)
    m.box(at(0, 0, H + 0.045), (L * 0.3, 0.05, 0.03), "steelD", top="steel", rz=rz, base=True, bevel=0.01)
    m.box(at(L * 0.36, 0, H - lid - 0.004), (0.06, W * 1.03, lid + 0.01), "medRed", top="medRed", rz=rz, base=True)  # seal
    m.box(at(L * 0.36, W / 2 + 0.02, H - lid * 0.7), (0.05, 0.03, 0.05), "red", rz=rz, base=True)            # seal light
    m.box(at(-L * 0.1, W / 2 + 0.008, H * 0.18), (0.14, 0.015, 0.1), "medWhite", rz=rz, base=True)         # manifest tag


def floor_case():
    m = core.Mesh("cargo_case")
    case(m, 0.62, 0.4, 0.3, rz=0.12)
    return [_fin(m, STACK_K)]


def held_case():
    m = core.Mesh("cargo_case_held")
    case(m, 0.27, 0.17, 0.14, detail=False)
    m.box((0.27 * 0.36, 0.17 / 2 + 0.012, 0.14 * 0.5), (0.035, 0.025, 0.035), "red", base=True)
    return [_fin(m, HELD_K)]


SPRITES = [("item.cargo_crate.l", (1, 1), "prop", floor_case), ("item.cargo_crate.held", (1, 1), "prop", held_case)]
