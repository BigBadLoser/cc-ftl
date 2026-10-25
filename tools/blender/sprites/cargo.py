"""Delivery cargo (family `cargo`, sheet `cargo`): the sealed case a delivery job brings aboard (item.cargo_crate).

  item.cargo_crate.l     the case on the deck, at the item stacks' tile scale (it never stacks, so it has one size)
  item.cargo_crate.held  the small version a crew member carries, sized like the other .held sprites

An armoured cargo container, not luggage: a squat gunmetal block inside heavy light bumper rails on every edge, a raised
lid panel with stencil marks, locking clamps across the lid seam, recessed grips in the ends, a hazard stripe along the
foot, and a glowing red seal band all round the seam with a status panel (glow): sealed, someone else's. Origin = centre
of the tile at floor level, as items.py; the camera sees the +x end and the +y long side. The renderer finds both ids
already (itemView.ts stackAssets / heldAssets)."""
from . import core
from .items import HELD_K, STACK_K, _fin

BODY, BODY_TOP, RAIL, RAIL_TOP = "nvF3", "nvF2", "nvW3", "nvW2"


def case(m, L, W, H, detail=True):
    """The container L x W x H (grid units, long side along x), standing on the floor."""
    seam = H * 0.68
    r = min(L, W, H) * 0.11                                                   # bumper rail thickness
    m.box((0, 0, 0), (L, W, H), BODY, top=BODY_TOP, base=True, bevel=r * 0.3)
    for sx in (-1, 1):                                                        # the 12 edge rails
        for sy in (-1, 1):
            m.box((sx * (L / 2 - r / 2), sy * (W / 2 - r / 2), 0), (r * 1.15, r * 1.15, H), RAIL, top=RAIL_TOP, base=True)
        for z in (0, H - r):
            m.box((sx * (L / 2 - r / 2), 0, z), (r * 1.15, W, r * 1.1), RAIL, top=RAIL_TOP, base=True)
    for sy in (-1, 1):
        for z in (0, H - r):
            m.box((0, sy * (W / 2 - r / 2), z), (L, r * 1.15, r * 1.1), RAIL, top=RAIL_TOP, base=True)
    # the seal: a glowing band all round the seam, under the clamps
    m.box((0, 0, seam - 0.012), (L - r * 1.6, W + 0.012, 0.024), "red", base=True)
    m.box((0, 0, seam - 0.012), (L + 0.012, W - r * 1.6, 0.024), "red", base=True)
    if not detail:
        m.box((0, 0, H), (L * 0.5, W * 0.5, 0.02), "nvW4", top="nvW3", base=True)
        return
    m.box((0, 0, H), (L - r * 2.6, W - r * 2.6, 0.03), BODY, top="nvF1", base=True, bevel=0.008)     # raised lid panel
    for k, (x, y, w, d) in enumerate(((-0.12, -0.05, 0.1, 0.03), (-0.12, 0.03, 0.06, 0.03), (0.08, -0.04, 0.05, 0.1))):
        m.box((x * L / 0.56, y * W / 0.44, H + 0.03), (w, d, 0.004), "medWhite" if k < 2 else "hazY", base=True)  # stencils
    for sx in (-0.26, 0.26):                                                  # locking clamps across the seam, both sides
        for sy in (-1, 1):
            m.box((sx * L, sy * (W / 2 + 0.008), seam - 0.06), (0.07, 0.035, 0.12), "steelD", top="steel", base=True)
    for sx in (-1, 1):                                                        # recessed grips in the ends
        m.box((sx * (L / 2 + 0.001), 0, H * 0.32), (0.012, W * 0.36, 0.05), "black", base=True)
    for k in range(5):                                                        # hazard stripe along the foot, +y side
        m.box((-L * 0.28 + k * L * 0.07, W / 2 + 0.004, r * 1.2), (L * 0.035, 0.008, 0.035), "hazY" if k % 2 == 0 else "hazK",
              base=True)
    m.box((L * 0.2, W / 2 + 0.006, H * 0.3), (0.09, 0.01, 0.07), "black", base=True)            # status panel
    m.box((L * 0.18, W / 2 + 0.012, H * 0.33), (0.025, 0.008, 0.025), "red", base=True)
    m.box((L * 0.23, W / 2 + 0.012, H * 0.33), (0.025, 0.008, 0.025), "steelD", base=True)


def floor_case():
    m = core.Mesh("cargo_case")
    case(m, 0.56, 0.44, 0.36)
    return [_fin(m, STACK_K)]


def held_case():
    m = core.Mesh("cargo_case_held")
    case(m, 0.22, 0.17, 0.15, detail=False)
    return [_fin(m, HELD_K)]


SPRITES = [("item.cargo_crate.l", (1, 1), "prop", floor_case), ("item.cargo_crate.held", (1, 1), "prop", held_case)]
