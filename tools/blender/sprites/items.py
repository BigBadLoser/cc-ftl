"""Item sprites: floor stacks (.s/.m/.l) and the small carried versions (.held). Clean shapes in flat colour bands;
placements are fixed tables (no random), so renders are reproducible. Origin = centre of the tile at floor level."""
import math
from . import core

# ---- shared layouts: (x, y, rz) slots, filled in order; size grows s < m < l ---------------------------------

SLOTS = {
    "s": [(0.0, 0.0, 0.3)],
    "m": [(-0.17, -0.08, 0.2), (0.17, 0.1, -0.3), (0.0, -0.22, 0.5)],
    "l": [(-0.22, -0.14, 0.2), (0.2, -0.16, -0.25), (0.0, 0.08, 0.4), (-0.22, 0.24, -0.15), (0.24, 0.2, 0.3)],
}


def scrap(size):
    """Jumbled pile of grey plating and tubes with rust-coloured bits."""
    m = core.Mesh(f"scrap_{size}")
    pieces = {
        "s": [((0, 0, 0), (0.34, 0.26, 0.1), "steel", "steelL", 0.3, 0.0, 0.0),
              ((0.05, 0.02, 0.1), (0.2, 0.3, 0.07), "rust", "rustD", -0.5, 0.0, 0.0),
              ((-0.1, -0.06, 0.17), (0.14, 0.14, 0.1), "gm", "plate", 0.8, 0.0, 0.0)],
        "m": [((-0.06, 0.0, 0), (0.5, 0.36, 0.12), "steel", "steelL", 0.3, 0.0, 0.0),
              ((0.2, -0.1, 0), (0.28, 0.4, 0.1), "rust", "rustD", -0.4, 0.0, 0.0),
              ((-0.12, 0.2, 0), (0.34, 0.22, 0.14), "steelD", "gm", -0.2, 0.0, 0.0),
              ((0.0, 0.0, 0.12), (0.3, 0.2, 0.1), "gm", "plate", 0.9, 0.0, 0.0),
              ((0.14, 0.12, 0.12), (0.18, 0.18, 0.1), "rust", "rustD", 0.2, 0.0, 0.0),
              ((-0.16, -0.12, 0.12), (0.2, 0.14, 0.14), "steelL", "plate", -0.6, 0.0, 0.0),
              ((0.02, 0.02, 0.22), (0.14, 0.2, 0.08), "steel", "steelL", 0.4, 0.0, 0.0)],
        "l": [((-0.1, 0.0, 0), (0.7, 0.5, 0.14), "steel", "steelL", 0.3, 0.0, 0.0),
              ((0.22, -0.14, 0), (0.4, 0.46, 0.12), "rust", "rustD", -0.4, 0.0, 0.0),
              ((-0.2, 0.26, 0), (0.46, 0.26, 0.16), "steelD", "gm", -0.2, 0.0, 0.0),
              ((0.2, 0.26, 0), (0.3, 0.26, 0.12), "gm", "plate", 0.5, 0.0, 0.0),
              ((-0.08, -0.04, 0.14), (0.46, 0.3, 0.12), "gm", "plate", 0.9, 0.0, 0.0),
              ((0.2, 0.0, 0.12), (0.26, 0.26, 0.12), "rust", "rustD", 0.2, 0.0, 0.0),
              ((-0.26, -0.18, 0.14), (0.26, 0.2, 0.14), "steelL", "plate", -0.6, 0.0, 0.0),
              ((0.0, 0.1, 0.26), (0.28, 0.2, 0.1), "steel", "steelL", 0.4, 0.0, 0.0),
              ((-0.14, -0.08, 0.26), (0.2, 0.16, 0.14), "rustD", "rust", -0.3, 0.0, 0.0),
              ((0.12, -0.04, 0.34), (0.16, 0.16, 0.1), "steelL", "plate", 0.7, 0.0, 0.0),
              ((0.06, 0.04, 0.4), (0.1, 0.1, 0.08), "rust", "rustD", 0.1, 0.0, 0.0)],
    }[size]
    for c, s, col, top, rz, rx, ry in pieces:
        m.box(c, s, col, top=top, rz=rz, rx=rx, ry=ry, base=True, bevel=0.012)
    # a couple of tubes sticking out
    for k, (x, y, r, h, z) in enumerate({"s": [(0.16, 0.14, 0.035, 0.12, 0)],
                                         "m": [(0.26, 0.18, 0.04, 0.18, 0), (-0.26, -0.18, 0.035, 0.12, 0)],
                                         "l": [(0.32, 0.3, 0.045, 0.24, 0), (-0.34, -0.12, 0.04, 0.18, 0), (0.34, -0.3, 0.035, 0.12, 0)]}[size]):
        m.cyl((x, y, z), r, h, "gm", sides=6, top="plate")
    return [m.build()]


def plates(m, c, n, w=0.4, d=0.28, th=0.05, rz=0.0, gap=0.0):
    """A stack of n bevelled metal plates, each a hair offset so the edges read as separate layers."""
    for k in range(n):
        off = 0.012 * (k % 2)
        m.box((c[0] + off, c[1], k * (th + gap)), (w, d, th), "gm" if k % 2 else "steel", top="plate" if k == n - 1 else "steelL",
              rz=rz, base=True, bevel=0.01)


def metal(size):
    m = core.Mesh(f"metal_{size}")
    heights = {"s": [3], "m": [4, 3], "l": [6, 5, 4]}[size]
    for (x, y, rz), n in zip(SLOTS[size], heights):
        plates(m, (x, y), n, rz=rz)
    if size == "l":
        # two stacked ingots on top of the first pile
        x, y, rz = SLOTS[size][0]
        m.box((x, y, 6 * 0.05), (0.3, 0.12, 0.08), "plate", top="medWhite", rz=rz, base=True, bevel=0.012, taper=0.85)
    return [m.build()]


def board(m, c, rz, z, chips):
    m.box((c[0], c[1], z), (0.36, 0.26, 0.03), "pcb", top="pcb", rz=rz, base=True, bevel=0.006)
    ca, sa = math.cos(rz), math.sin(rz)
    for (u, v, col, h) in chips:
        m.box((c[0] + u * ca - v * sa, c[1] + u * sa + v * ca, z + 0.03), (0.07, 0.07, h), col, top=col, rz=rz, base=True)


def electronics(size):
    m = core.Mesh(f"electronics_{size}")
    chip = [(-0.1, 0.0, "dark", 0.03), (0.06, 0.05, "cyan", 0.02), (0.1, -0.05, "dark", 0.022)]
    counts = {"s": [2], "m": [3, 2], "l": [4, 3, 3]}[size]
    for (x, y, rz), n in zip(SLOTS[size], counts):
        for k in range(n):
            board(m, (x, y), rz + 0.12 * (k % 2), k * 0.05, chip if k == n - 1 else chip[:1])
        # a thin separator sheet under each board stack
        m.box((x, y, 0), (0.1, 0.1, 0.012), "steelD", base=True)
    return [m.build()]


def polymer(size):
    m = core.Mesh(f"polymer_{size}")
    spec = {"s": [(0.0, 0.0, "hivis", 0.26)],
            "m": [(-0.14, -0.06, "hivis", 0.28), (0.16, 0.0, "polyB", 0.26), (0.0, 0.22, "hivis", 0.24)],
            "l": [(-0.22, -0.14, "hivis", 0.3), (0.0, -0.2, "polyB", 0.28), (0.22, -0.14, "hivis", 0.3),
                  (-0.12, 0.1, "polyB", 0.28), (0.12, 0.12, "hivis", 0.3), (0.0, 0.32, "polyB", 0.24),
                  (-0.3, 0.2, "polyB", 0.22)]}[size]
    for x, y, col, h in spec:
        r = 0.13
        m.cyl((x, y, 0), r, h, col, sides=8, top="medWhite")
        m.cyl((x, y, h * 0.5), r + 0.008, 0.03, "dark", sides=8)      # band around the roll
        m.cyl((x, y, h - 0.005), 0.045, 0.01, "dark", sides=6)        # core hole
    if size != "s":
        m.box((0.0, -0.02, 0), (0.24, 0.16, 0.05), "steelD", top="steel", base=True)  # pallet under the group
    return [m.build()]


def ice(size):
    m = core.Mesh(f"ice_{size}")
    spec = {"s": [((0.0, 0.0, 0.0), 0.3, 0.2, 0.3)],
            "m": [((-0.15, -0.05, 0.0), 0.3, 0.26, 0.3), ((0.16, 0.08, 0.0), 0.28, 0.24, -0.25), ((0.0, 0.0, 0.26), 0.2, 0.2, 0.7)],
            "l": [((-0.22, -0.1, 0.0), 0.32, 0.3, 0.2), ((0.2, -0.14, 0.0), 0.3, 0.26, -0.3), ((0.0, 0.2, 0.0), 0.3, 0.3, 0.1),
                  ((-0.1, 0.0, 0.3), 0.26, 0.24, 0.6), ((0.14, -0.04, 0.26), 0.22, 0.22, -0.5), ((-0.24, 0.26, 0.0), 0.2, 0.2, 0.4)]}[size]
    for (x, y, z), s, h, rz in spec:
        m.box((x, y, z), (s, s * 0.9, h), "iceB", top="medWhite", rz=rz, base=True, bevel=0.03)
        m.box((x, y, z + h * 0.45), (s + 0.004, s * 0.9 + 0.004, 0.03), "lens", rz=rz, base=True)
    return [m.build()]


STACKS = {"item.scrap": scrap, "item.metal": metal, "item.electronics": electronics, "item.polymer": polymer, "item.ice": ice}


# ---- carried: a small version of the item, ~12-16 px ---------------------------------------------------------------

def held(item):
    m = core.Mesh(f"held_{item}")
    if item == "item.scrap":
        m.box((0, 0, 0), (0.2, 0.16, 0.06), "steel", top="steelL", rz=0.3, base=True, bevel=0.008)
        m.box((0.02, 0, 0.06), (0.12, 0.16, 0.05), "rust", top="rustD", rz=-0.5, base=True)
        m.box((-0.04, -0.02, 0.11), (0.08, 0.08, 0.06), "gm", top="plate", rz=0.8, base=True)
    elif item == "item.metal":
        for k in range(3):
            m.box((0, 0, k * 0.045), (0.24, 0.17, 0.045), "gm" if k % 2 else "steel", top="plate" if k == 2 else "steelL", base=True, bevel=0.006)
    elif item == "item.electronics":
        for k in range(2):
            m.box((0, 0, k * 0.04), (0.24, 0.17, 0.03), "pcb", top="pcb", rz=0.12 * k, base=True)
        m.box((-0.04, 0, 0.1), (0.06, 0.06, 0.03), "dark", base=True)
        m.box((0.06, 0.02, 0.1), (0.05, 0.05, 0.02), "cyan", base=True)
    elif item == "item.polymer":
        m.cyl((0, 0, 0), 0.09, 0.17, "hivis", sides=8, top="medWhite")
        m.cyl((0, 0, 0.085), 0.098, 0.025, "dark", sides=8)
    else:
        m.box((0, 0, 0), (0.18, 0.16, 0.16), "iceB", top="medWhite", rz=0.3, base=True, bevel=0.02)
    return [m.build()]


SPRITES = []
for _id, _fn in STACKS.items():
    for _s in ("s", "m", "l"):
        SPRITES.append((f"{_id}.{_s}", (1, 1), "prop", lambda f=_fn, s=_s: f(s)))
    SPRITES.append((f"{_id}.held", (1, 1), "prop", lambda i=_id: held(i)))
