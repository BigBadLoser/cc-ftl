"""Delivery cargo (family `cargo`, sheet `cargo`): the sealed case a delivery job brings aboard (item.cargo_crate).

  item.cargo_crate.l     the case on the deck, at the item stacks' tile scale (it never stacks, so it has one size)
  item.cargo_crate.held  the small version a crew member carries, sized like the other .held sprites

A rugged moulded transport case: a low, chunky off-white shell with rounded moulded edges, a flush lid seam, two
raised ribs the length of the lid, dark rubber guards on the corners, bar handles centred on the ends, and a security seal centred on
the seam that glows red: sealed, someone else's. Origin = centre of the tile at floor level, as items.py;
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
    m.box((0, 0, H - lid - 0.006), (L * 0.985, W * 1.004, 0.012), "c3W6", base=True)                         # flush seam,
    m.box((0, 0, H - lid - 0.006), (L * 1.004, W * 0.985, 0.012), "c3W6", base=True)                         # all round
    g = min(W, H) * 0.3                                                       # rubber corner guards, full height
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((sx * (L / 2 - g * 0.35), sy * (W / 2 - g * 0.35), 0), (g, g, H * 0.97), GUARD, top="steel", base=True,
                  bevel=g * 0.3)
    if not detail:                                                            # the held case: just the seal over the seam
        m.box((0, W / 2 + 0.008, H - lid - 0.04), (0.06, 0.016, 0.07), "steelD", top="steel", base=True)
        m.box((0, W / 2 + 0.017, H - lid - 0.022), (0.022, 0.008, 0.022), "red", base=True)
        return
    for y in (-W * 0.18, W * 0.18):                                           # raised ribs the length of the lid
        m.box((0, y, H - 0.004), (L * 0.78, 0.035, 0.022), SHELL, top=LID_TOP, base=True, bevel=0.008)
    m.box((0, W / 2 + 0.014, H - lid - 0.075), (0.095, 0.022, 0.12), "steelD", top="steel", base=True)  # the seal, over the seam
    m.box((0, W / 2 + 0.027, H - lid - 0.05), (0.03, 0.01, 0.03), "red", base=True)
    hz = (H - lid) * 0.5                                                      # bar handles, centred on each end face
    for sx in (-1, 1):
        for sy in (-0.17, 0.17):
            m.box((sx * (L / 2 + 0.01), sy * W, hz - 0.018), (0.024, 0.026, 0.036), "steelD", base=True)
        m.box((sx * (L / 2 + 0.024), 0, hz - 0.012), (0.018, W * 0.4, 0.024), "steel", top="steelL", base=True)
    m.box((-L * 0.27, W / 2 + 0.008, H * 0.2), (0.12, 0.01, 0.07), "hivis", base=True)           # an orange freight label


def floor_case():
    m = core.Mesh("cargo_case")
    case(m, 0.6, 0.42, 0.3)
    return [_fin(m, STACK_K)]


def held_case():
    m = core.Mesh("cargo_case_held")
    case(m, 0.24, 0.17, 0.13, detail=False)
    return [_fin(m, HELD_K)]


SPRITES = [("item.cargo_crate.l", (1, 1), "prop", floor_case), ("item.cargo_crate.held", (1, 1), "prop", held_case)]
