"""Item art for planned items, the tech and supply set (family `items`; art only until the content lands): floor stacks
.s/.m/.l and .held, in the grid frame and scale of items.py.

  plasma_cell  steel-capped cells with glowing cyan cores, upright in a rack
  medkit       white med cases with a red cross and a dark handle
  oxygen       white O2 tanks with a blue band and a steel valve, standing; racked from .m up
  circuit      blue circuit boards with gold edge contacts and a lit LED, upright in a slotted rack
  crop         open slatted crates of green and red produce
  artifact     an alien relic: a twisted dark obelisk with glowing violet runes, shards round it"""
import math

from .items_kit import cone, crystal, tube

# ---- plasma cells --------------------------------------------------------------------------------------------------


def cell(m, c, z=0.0, k=1.0):
    """A cell: a steel casing with a glowing cyan window round its middle."""
    r, h = 0.04 * k, 0.17 * k
    m.cyl((c[0], c[1], z), r, h * 0.36, "steel", sides=10)
    m.cyl((c[0], c[1], z + h * 0.36), r * 0.9, h * 0.3, "fxC2", sides=10)
    m.cyl((c[0], c[1], z + h * 0.45), r * 0.92, h * 0.12, "fxC1", sides=10)
    m.cyl((c[0], c[1], z + h * 0.66), r, h * 0.34, "steel", sides=10, top="steelL")
    m.cyl((c[0], c[1], z + h), r * 0.4, 0.014 * k, "dark", sides=6)


def cell_rack(m, c, nx, ny, z=0.0):
    p = 0.11
    w, d = nx * p + 0.03, ny * p + 0.03
    m.box((c[0], c[1], z), (w, d, 0.04), "steelD", top="steel", base=True)
    for i in range(nx):
        for j in range(ny):
            cell(m, (c[0] + (i - (nx - 1) / 2) * p, c[1] + (j - (ny - 1) / 2) * p), z + 0.04)


def plasma_cell(m, size):
    if size == "held":
        cell(m, (-0.03, 0), 0, 0.9)
        cell(m, (0.04, 0.02), 0, 0.9)
    elif size == "s":
        cell_rack(m, (0, 0), 2, 1)
    elif size == "m":
        cell_rack(m, (0, -0.04), 3, 2)
    else:
        cell_rack(m, (-0.04, -0.06), 3, 3)
        cell_rack(m, (0.24, 0.12), 1, 2)
        cell(m, (-0.2, 0.24), 0)


# ---- medkits -------------------------------------------------------------------------------------------------------


def medcase(m, c, z, rz, k=1.0):
    w, d, h = 0.26 * k, 0.18 * k, 0.1 * k
    m.box((c[0], c[1], z), (w, d, h), "c3W3", top="medWhite", rz=rz, base=True, bevel=0.014 * k)
    m.box((c[0], c[1], z + h * 0.55), (w + 0.006, d + 0.006, 0.014 * k), "c3W5", rz=rz, base=True)      # lid seam
    m.box((c[0], c[1], z + h), (0.1 * k, 0.03 * k, 0.006), "medRed", rz=rz, base=True)                   # the cross
    m.box((c[0], c[1], z + h), (0.03 * k, 0.1 * k, 0.006), "medRed", rz=rz, base=True)
    ca, sa = math.cos(rz), math.sin(rz)                                                           # a cross on the side
    m.box((c[0] - sa * d * 0.52, c[1] + ca * d * 0.52, z + h * 0.2), (0.06 * k, 0.006, 0.02 * k), "medRed", rz=rz, base=True)
    m.box((c[0] - sa * d * 0.52, c[1] + ca * d * 0.52, z + h * 0.08), (0.02 * k, 0.006, 0.045 * k), "medRed", rz=rz, base=True)
    m.box((c[0] + ca * w * 0.52, c[1] + sa * w * 0.52, z + h * 0.4), (0.012, 0.08 * k, 0.02 * k), "dark", rz=rz, base=True)


def medkit(m, size):
    if size == "held":
        medcase(m, (0, 0), 0, 0.2, 0.85)
    elif size == "s":
        medcase(m, (0, 0), 0, 0.3)
    elif size == "m":
        medcase(m, (-0.06, -0.08), 0, 0.2)
        medcase(m, (-0.05, -0.07), 0.1, 0.35)
        medcase(m, (0.12, 0.16), 0, -0.3)
    else:
        for i, (x, y, z, rz) in enumerate(((-0.1, -0.1, 0, 0.2), (-0.09, -0.1, 0.1, 0.3), (-0.1, -0.09, 0.2, 0.15),
                                           (0.16, 0.06, 0, -0.25), (0.16, 0.07, 0.1, -0.15), (-0.12, 0.2, 0, 0.5))):
            medcase(m, (x, y), z, rz)


# ---- oxygen ------------------------------------------------------------------------------------------------------------


def tank(m, c, z=0.0, k=1.0):
    r, h = 0.055 * k, 0.3 * k
    m.cyl((c[0], c[1], z), r, h * 0.85, "c3W3", sides=12, top="c3W1")
    m.cyl((c[0], c[1], z + h * 0.85), r, h * 0.08, "c3W2", sides=12, rtop=r * 0.55)                    # the shoulder
    m.cyl((c[0], c[1], z + h * 0.55), r + 0.004, h * 0.1, "c3T3", sides=12)                             # the blue band
    m.cyl((c[0], c[1], z + h * 0.93), r * 0.28, h * 0.08, "steel", sides=8, top="steelL")               # the valve
    m.box((c[0] + r * 0.4, c[1], z + h * 0.97), (r * 0.6, 0.014, 0.014), "dark", base=True)


def oxygen(m, size):
    if size == "held":
        tank(m, (0, 0), 0, 0.75)
    elif size == "s":
        tank(m, (-0.05, 0.02))
        tank(m, (0.07, -0.05))
    elif size == "m":
        m.box((0, 0, 0), (0.42, 0.18, 0.03), "steelD", top="steel", base=True)
        for x in (-0.13, 0.0, 0.13):
            tank(m, (x, 0), 0.03)
        m.box((0, -0.1, 0.18), (0.42, 0.02, 0.03), "steelD", top="steel", base=True)                   # the rack's strap
    else:
        m.box((0, 0, 0), (0.42, 0.42, 0.03), "steelD", top="steel", base=True)
        for x in (-0.13, 0.0, 0.13):
            for y in (-0.12, 0.12):
                tank(m, (x, y), 0.03)
        for y in (-0.22, 0.02):
            m.box((0, y, 0.18), (0.42, 0.02, 0.03), "steelD", top="steel", base=True)


# ---- circuit boards ----------------------------------------------------------------------------------------------------


def board_up(m, c, z, k=1.0):
    """A board standing on its edge across y: blue, gold contacts on the bottom edge, chips and an LED on its +y face."""
    w, h = 0.2 * k, 0.14 * k
    m.box((c[0], c[1], z), (w, 0.014, h), "c3T4", top="c3T3", base=True)
    m.box((c[0], c[1], z), (w * 0.8, 0.018, 0.02 * k), "brass", base=True)
    for u, v, s in ((-0.05, 0.07, 0.05), (0.04, 0.05, 0.04), (0.06, 0.1, 0.03)):
        m.box((c[0] + u * k, c[1] + 0.012, z + v * k), (s * k, 0.01, s * k), "dark", base=True)
    m.box((c[0] + 0.08 * k, c[1] + 0.012, z + 0.11 * k), (0.016, 0.01, 0.016), "green", base=True)


def board_rack(m, c, n, z=0.0):
    d = n * 0.05 + 0.04
    m.box((c[0], c[1], z), (0.26, d, 0.04), "steelD", top="steel", base=True)
    for s in (-1, 1):
        m.box((c[0] + s * 0.12, c[1], z), (0.02, d, 0.1), "steel", top="steelL", base=True)
    for i in range(n):
        board_up(m, (c[0], c[1] + (i - (n - 1) / 2) * 0.05), z + 0.04)


def circuit(m, size):
    if size == "held":
        board_rack(m, (0, 0), 2)
    elif size == "s":
        board_rack(m, (0, 0), 3)
    elif size == "m":
        board_rack(m, (-0.12, -0.04), 4)
        board_rack(m, (0.16, 0.06), 3)
    else:
        board_rack(m, (-0.13, -0.1), 4)
        board_rack(m, (0.16, -0.06), 4)
        board_rack(m, (-0.02, 0.22), 4)


# ---- crops -------------------------------------------------------------------------------------------------------------

PRODUCE = (("xnFL", "xnF"), ("drM", "drD"), ("c4T2", "c4T4"))


def crate(m, c, z, rz, fill, k=1.0):
    """An open slatted crate heaped with produce of one kind (fill: index into PRODUCE)."""
    w, d, h = 0.3 * k, 0.22 * k, 0.11 * k
    ca, sa = math.cos(rz), math.sin(rz)
    at = lambda u, v, zz: (c[0] + u * ca - v * sa, c[1] + u * sa + v * ca, z + zz)  # noqa: E731
    m.box(at(0, 0, 0), (w, d, 0.02), "oM", rz=rz, base=True)
    for zz in (0.0, h * 0.55):                                                                          # two slats a side
        for u, v, sx, sy in ((0, d / 2, w, 0.016), (0, -d / 2, w, 0.016), (w / 2, 0, 0.016, d), (-w / 2, 0, 0.016, d)):
            m.box(at(u, v, zz), (sx, sy, h * 0.4), "oL", top="oH", rz=rz, base=True)
    col, dk = PRODUCE[fill]
    for i in range(3):
        for j in range(2):
            u, v = (i - 1) * w * 0.3, (j - 0.5) * d * 0.45
            m.cyl(at(u, v, h * 0.45), 0.04 * k, 0.07 * k, dk, sides=8, top=col, rtop=0.02 * k)


def crop(m, size):
    if size == "held":
        crate(m, (0, 0), 0, 0.2, 0, 0.75)
    elif size == "s":
        crate(m, (0, 0), 0, 0.25, 0)
    elif size == "m":
        crate(m, (-0.08, -0.08), 0, 0.2, 0)
        crate(m, (0.12, 0.14), 0, 0.2, 1)
        crate(m, (-0.08, -0.08), 0.12, 0.3, 2)
    else:
        for (x, y, z, rz), f in zip(((-0.12, -0.1, 0, 0.2), (0.16, -0.04, 0, 0.2), (0.0, 0.22, 0, 0.1), (-0.11, -0.09, 0.12, 0.3),
                                     (0.17, -0.03, 0.12, 0.15)), (0, 1, 2, 1, 0)):
            crate(m, (x, y), z, rz, f)


# ---- alien artifact ----------------------------------------------------------------------------------------------------


def relic(m, c, k=1.0, z=0.0):
    """A twisted obelisk of dark stone, its faces cut with glowing violet runes, on a low base."""
    m.cyl((c[0], c[1], z), 0.11 * k, 0.03 * k, "xnK", sides=5, top="xnD")
    H, n = 0.26 * k, 4
    for i in range(n):                                                                                  # twisted segments
        z0 = z + 0.03 * k + i * H / n
        r = 0.075 * k * (1 - 0.15 * i)
        m.cyl((c[0], c[1], z0), r, H / n, "xnM" if i % 2 else "xnD", sides=4, rz=i * 0.35, top="xnL",
              rtop=0.075 * k * (1 - 0.15 * (i + 1)))
        a = i * 0.35 + math.pi / 4
        m.box((c[0] + math.cos(a) * r * 0.75, c[1] + math.sin(a) * r * 0.75, z0 + H / n * 0.3), (0.012, 0.03 * k, 0.034 * k),
              "fxI1" if i % 2 else "magenta", rz=a, base=True)
    cone(m, (c[0], c[1], z + 0.03 * k + H), (c[0], c[1], z + 0.03 * k + H + 0.06 * k), 0.034 * k, "magenta", sides=4)


def artifact(m, size):
    if size == "held":
        relic(m, (0, 0), 0.85)
        return
    k = {"s": 1.2, "m": 1.4, "l": 1.6}[size]
    relic(m, (0, 0), k)
    shards = {"s": [], "m": [(0.16, 0.1, 0.6), (-0.14, 0.12, 2.0)],
              "l": [(0.2, 0.12, 0.6), (-0.18, 0.14, 2.0), (0.1, -0.2, 3.6), (-0.2, -0.12, 4.4)]}[size]
    for x, y, a in shards:                                                                              # broken shards
        crystal(m, (x, y, 0), (math.cos(a) * 0.6, math.sin(a) * 0.6, 1), 0.09, 0.025, "xnM", "rvG", sides=4)
    if size == "l":                                                                                     # a containment ring
        for i in range(8):
            a = i * math.tau / 8
            tube(m, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.0), (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.05), 0.02, "steelD",
                 cap="steel", sides=6)


ITEMS = {"plasma_cell": plasma_cell, "medkit": medkit, "oxygen": oxygen, "circuit": circuit, "crop": crop, "artifact": artifact}
