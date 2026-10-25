"""Delivery cargo (family `cargo`, sheet `cargo`): the sealed case a delivery job brings aboard (item.cargo_crate).

  item.cargo_crate.l     the case on the deck, at the item stacks' tile scale (it never stacks, so it has one size)
  item.cargo_crate.held  the small version a crew member carries, sized like the other .held sprites

A rugged moulded transport case: a low, chunky off-white shell with rounded moulded edges, a lid with a pronounced lip
and two raised ribs, dark rubber guards on the corners, fold-down bar handles on the ends, flush latches, and a red strap
over the lid held by a glowing seal tag: sealed, someone else's. Origin = centre of the tile at floor level, as items.py;
the camera sees the +x end and the +y long side. The renderer finds both ids already (itemView.ts stackAssets /
heldAssets)."""
from . import core
from .items import HELD_K, STACK_K, _fin

SHELL, SHELL_TOP, LID_TOP, GUARD = "c3W4", "c3W2", "c3W1", "steelD"


def case(m, L, W, H, detail=True):
    """The case L x W x H (grid units, long side along x), standing on the floor."""
    lid = H * 0.34
    b = min(W, H) * 0.22                                                      # moulded edge rounding
    m.box((0, 0, 0), (L, W, H - lid), SHELL, top=SHELL, base=True, bevel=b)
    m.box((0, 0, H - lid - 0.02), (L * 1.03, W * 1.04, 0.04), "c3W5", top=SHELL_TOP, base=True, bevel=0.012)   # the lip
    m.box((0, 0, H - lid + 0.012), (L * 0.98, W * 0.97, lid - 0.012), SHELL, top=LID_TOP, base=True, bevel=b * 0.8)
    g = min(W, H) * 0.3                                                       # rubber corner guards, full height
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (L / 2 - g * 0.35), sy * (W / 2 - g * 0.35), 0), (g, g, H * 0.97), GUARD, top="steel", base=True,
                  bevel=g * 0.3)
    strap = L * 0.22                                                          # the seal strap over the lid, front to back
    m.box((strap, 0, 0.02), (0.05, W * 1.06, H - 0.01), "medRed", top="medRed", base=True)
    if not detail:
        m.box((strap, W * 0.53, H * 0.45), (0.035, 0.02, 0.035), "red", base=True)
        return
    for y in (-W * 0.18, W * 0.18):                                           # raised ribs along the lid
        m.box((-L * 0.08, y, H - 0.004), (L * 0.6, 0.035, 0.022), SHELL, top=LID_TOP, base=True, bevel=0.008)
    m.box((strap, W / 2 + 0.03, H * 0.42), (0.07, 0.025, 0.08), "steelD", top="steel", base=True)      # the seal tag
    m.box((strap, W / 2 + 0.045, H * 0.45), (0.035, 0.012, 0.04), "red", base=True)
    for sx in (-0.3, 0.06):                                                   # flush latches across the lip, +y side
        m.box((sx * L, W / 2 + 0.018, H - lid - 0.05), (0.07, 0.02, 0.08), "steel", top="steelL", base=True)
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
