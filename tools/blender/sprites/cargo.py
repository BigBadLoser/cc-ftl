"""Delivery cargo (family `cargo`, sheet `cargo`): the sealed case a delivery job brings aboard (item.cargo_crate).

  item.cargo_crate.l     the case on the deck, at the item stacks' tile scale (it never stacks, so it has one size)
  item.cargo_crate.held  the small version a crew member carries, sized like the other .held sprites

A rugged moulded transport case: a low, chunky off-white shell with rounded moulded edges, a flush lid seam, two
raised ribs the length of the lid, dark rubber guards on the corners, fold-down bar handles on the ends, flush latches, one of them
closed with a seal that glows red: sealed, someone else's. Origin = centre of the tile at floor level, as items.py;
the camera sees the +x end and the +y long side. The renderer finds both ids already (itemView.ts stackAssets /
heldAssets)."""
from . import core
from .items import HELD_K, STACK_K, _fin

SHELL, SHELL_TOP, LID_TOP, GUARD = "c3W4", "c3W2", "c3W1", "steelD"


def case(m, L, W, H, detail=True):
    """The case L x W x H (grid units, long side along x), standing on the floor."""
    lid = H * 0.34
    b = min(W, H) * 0.1                                                       # moulded edge rounding
    m.box((0, 0, 0), (L, W, H), SHELL, top=LID_TOP, base=True, bevel=b)                                     # one shell
    m.box((0, 0, H - lid - 0.006), (L * 0.985, W * 1.004, 0.012), "c3W6", base=True)                         # flush seam
    g = min(W, H) * 0.3                                                       # rubber corner guards, full height
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (L / 2 - g * 0.35), sy * (W / 2 - g * 0.35), 0), (g, g, H * 0.97), GUARD, top="steel", base=True,
                  bevel=g * 0.3)
    if not detail:
        m.box((L * 0.2, W / 2 + 0.01, H - lid - 0.02), (0.035, 0.02, 0.035), "red", base=True)
        return
    for y in (-W * 0.18, W * 0.18):                                           # raised ribs the length of the lid
        m.box((0, y, H - 0.004), (L * 0.9, 0.035, 0.022), SHELL, top=LID_TOP, base=True, bevel=0.008)
    for sx in (-0.3, 0.2):                                                    # flush latches across the lip, +y side
        m.box((sx * L, W / 2 + 0.018, H - lid - 0.05), (0.07, 0.02, 0.08), "steel", top="steelL", base=True)
    m.box((0.2 * L, W / 2 + 0.032, H - lid - 0.06), (0.05, 0.016, 0.06), "steelD", base=True)      # the seal on a latch
    m.box((0.2 * L, W / 2 + 0.042, H - lid - 0.05), (0.03, 0.01, 0.03), "red", base=True)
    for sx in (-1, 1):                                                        # fold-down bar handles on the ends
        for sy in (-0.2, 0.2):
            m.box((sx * (L / 2 + 0.02), sy * W, H * 0.45), (0.03, 0.03, 0.03), "steelD", base=True)
        m.box((sx * (L / 2 + 0.035), 0, H * 0.38), (0.025, W * 0.46, 0.03), "steel", top="steelL", base=True)
    m.box((-L * 0.18, W / 2 + 0.008, H * 0.2), (0.12, 0.01, 0.07), "hivis", base=True)           # an orange freight label


def floor_case():
    m = core.Mesh("cargo_case")
    case(m, 0.6, 0.42, 0.3)
    return [_fin(m, STACK_K)]


def held_case():
    m = core.Mesh("cargo_case_held")
    case(m, 0.24, 0.17, 0.13, detail=False)
    return [_fin(m, HELD_K)]


SPRITES = [("item.cargo_crate.l", (1, 1), "prop", floor_case), ("item.cargo_crate.held", (1, 1), "prop", held_case)]
