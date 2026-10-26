"""Item art for planned items, materials and raw resources (family `items`; art only until the content lands): floor
stacks .s/.m/.l and .held, in the grid frame and scale of items.py.

  copper        copper ingots in crossed layers
  alloy         blue-steel high-grade ingots, stamped
  gold          small gold bars, a short neat stack
  silicon       dark violet wafers in a cassette rack
  glass         pale panes upright in an A-frame rack
  carbon        black carbon-fibre rolls lying on a cradle
  coolant       teal coolant jugs with a frost band
  titanium_ore  pale grey-blue rock chunks with silvery flecks
  gas_canister  yellow gas spheres in a steel frame
  water         big blue water drums with white lids"""
import math

from .items_kit import FLOOR, chunk, ingots, place, rot, tube
from .items_now import ore

# ---- ingots ------------------------------------------------------------------------------------------------------------


def copper(m, size):
    ingots(m, size, "c1T4", "c1T2")


def alloy(m, size):
    ingots(m, size, "hbM", "hbL", mark="c3T0")


def gold(m, size):
    ingots(m, {"held": "held", "s": "held", "m": "s", "l": "m"}[size], "c4T3", "c4T1", mark="c4T0")


# ---- silicon wafers ----------------------------------------------------------------------------------------------------


def wafers(m, c, z, rz, k, n=6):
    """A stack of n thin wafers, a hair offset each, on a dark carrier disc: shiny lavender faces, violet edges."""
    m.cyl((c[0], c[1], z), 0.1 * k, 0.016 * k, "dark", sides=16, top="steelD")
    for i in range(n):
        o = rot(c, rz, 0.004 * k * (i % 2), 0)
        m.cyl((o[0], o[1], z + 0.016 * k + i * 0.012 * k), 0.09 * k, 0.01 * k, "rvM", sides=16, top="xnS" if i == n - 1 else "xnP")


def silicon(m, size):
    place(m, size, wafers, {"held": FLOOR["held"], "s": [(0, 0, 0, 0.3)], "m": [(-0.12, -0.06, 0, 0.3), (0.12, 0.08, 0, 0.3)],
                            "l": [(-0.15, -0.12, 0, 0.3), (0.13, -0.08, 0, 0.3), (-0.06, 0.18, 0, 0.3), (-0.15, -0.12, 0.11, 0.3)]},
          k=1.25)


# ---- glass panes -------------------------------------------------------------------------------------------------------


def glass(m, size):
    n = {"held": 2, "s": 3, "m": 5, "l": 8}[size]
    k = 0.9 if size == "held" else 1.2
    L = (0.36 if size == "l" else 0.3) * k
    rz = 0.3
    m.box((0, 0, 0), (L + 0.04, 0.12 * k + n * 0.012, 0.03), "steelD", top="steel", rz=rz, base=True)    # the rack's foot
    for s in (-1, 1):                                                                       # the A-frame ends
        e = rot((0, 0), rz, s * (L / 2 + 0.01), 0)
        m.box((e[0], e[1], 0.03), (0.02, 0.03, 0.22 * k), "steel", top="steelL", rz=rz, base=True)
    for i in range(n):                                                                      # panes leaning on the frame
        v = (i - (n - 1) / 2) * 0.014
        a = rot((0, 0), rz, 0, v)
        m.box((a[0], a[1], 0.03), (L, 0.008, 0.2 * k), "glassL", top="c3W1", rz=rz, rx=0.18, base=True)
    if size == "l":
        a = rot((0, 0), rz, 0, 0.2)
        for i in range(3):
            b = rot(a, rz, 0, i * 0.012)
            m.box((b[0], b[1], 0.0), (L * 0.8, 0.008, 0.16), "glassL", top="c3W1", rz=rz, rx=-0.25, base=True)


# ---- carbon-fibre rolls ------------------------------------------------------------------------------------------------


def roll(m, c, z, rz, k, col="dark", band="steelD", r=0.06, L=0.3):
    r, L = r * k, L * k
    a, b = rot(c, rz, -L / 2, 0), rot(c, rz, L / 2, 0)
    tube(m, (a[0], a[1], z + r), (b[0], b[1], z + r), r, col, cap="gm", sides=12)
    for u in (-L * 0.3, L * 0.3):                                                           # weave bands
        p, q = rot(c, rz, u - 0.01, 0), rot(c, rz, u + 0.01, 0)
        tube(m, (p[0], p[1], z + r), (q[0], q[1], z + r), r + 0.003, band, sides=12, ends=False)


def carbon(m, size):
    rz = 0.3
    rows = {"held": [(0, 0, 0)], "s": [(0, -0.065, 0), (0, 0.065, 0)], "m": [(0, -0.13, 0), (0, 0.0, 0), (0, 0.13, 0), (0, -0.065, 0.11)],
            "l": [(0, -0.2, 0), (0, -0.07, 0), (0, 0.06, 0), (0, 0.19, 0), (0, -0.135, 0.11), (0, -0.005, 0.11), (0, 0.125, 0.11)]}[size]
    k = 0.9 if size == "held" else 1.15
    for u, v, z in rows:
        roll(m, rot((0, 0), rz, u * k, v * k), z * k, rz, k, "dark", "steelM", 0.06, 0.36 if size == "l" else 0.3)


# ---- coolant -----------------------------------------------------------------------------------------------------------


def jug(m, c, z, rz, k):
    w, d, h = 0.12 * k, 0.12 * k, 0.17 * k
    m.box((c[0], c[1], z), (w, d, h), "wL", top="wH", rz=rz, base=True, bevel=0.016 * k)
    m.box((c[0], c[1], z + h * 0.3), (w + 0.006, d + 0.006, h * 0.18), "icL", rz=rz, base=True)          # frost band
    m.cyl((*rot(c, rz, w * 0.22, 0), z + h), 0.022 * k, 0.03 * k, "steelD", sides=8, top="steel")
    m.box((*rot(c, rz, -w * 0.15, 0), z + h), (0.03 * k, d * 0.6, 0.025 * k), "wM", rz=rz, base=True)    # handle


def coolant(m, size):
    place(m, size, jug)


# ---- titanium ore ------------------------------------------------------------------------------------------------------


def titanium_ore(m, size):
    for i, (x, y, z, sx, sy, sz, rz) in enumerate(ore(size)):
        chunk(m, (x, y, z), (sx, sy, sz), 131 + i, ["c3W3", "c3W4", "nvW1", "c3W2"], ["c3W6", "nvW4", "c3W5", "rkM"], rz=rz)


# ---- gas canisters -----------------------------------------------------------------------------------------------------


def sphere_tank(m, c, z, rz, k):
    """A yellow gas sphere in a four-legged steel frame, a valve on top."""
    r = 0.075 * k
    for i in range(4):
        a = rz + math.pi / 4 + i * math.pi / 2
        m.box((c[0] + math.cos(a) * r * 0.8, c[1] + math.sin(a) * r * 0.8, z), (0.018, 0.018, r * 1.3), "steelD", top="steel",
              rz=a, base=True)
    m.box((c[0], c[1], z + 0.02), (r * 1.9, r * 1.9, 0.015), "steelD", rz=rz, base=True)
    m.cyl((c[0], c[1], z + r * 0.35), r * 0.7, r * 0.35, "c4T4", sides=12, rtop=r)                     # the sphere as
    m.cyl((c[0], c[1], z + r * 0.7), r, r * 0.6, "c4T3", sides=12)                                     # stacked bands
    m.cyl((c[0], c[1], z + r * 0.75), r + 0.003, r * 0.14, "hazK", sides=12)
    m.cyl((c[0], c[1], z + r * 1.3), r, r * 0.35, "c4T2", sides=12, rtop=r * 0.7, top="c4T1")
    m.cyl((c[0], c[1], z + r * 1.65), r * 0.7, r * 0.2, "c4T1", sides=12, rtop=r * 0.3)
    m.cyl((c[0], c[1], z + r * 1.85), 0.014 * k, 0.03 * k, "steel", sides=6, top="steelL")


def gas_canister(m, size):
    place(m, size, sphere_tank, k=1.3, layout={"held": FLOOR["held"], "s": [(0, 0, 0, 0.3)], "m": [(-0.1, -0.08, 0, 0.3), (0.12, 0.04, 0, 0.3),
                                                                                    (-0.04, 0.2, 0, 0.3)],
                                 "l": [(-0.2, -0.12, 0, 0.3), (0.04, -0.16, 0, 0.3), (0.24, 0.04, 0, 0.3), (-0.12, 0.12, 0, 0.3),
                                       (0.1, 0.2, 0, 0.3)]})


# ---- water drums -------------------------------------------------------------------------------------------------------


def drum(m, c, z, rz, k):
    r, h = 0.1 * k, 0.24 * k
    m.cyl((c[0], c[1], z), r, h, "polyB", sides=14, top="c3T1")
    for zz in (h * 0.3, h * 0.65):
        m.cyl((c[0], c[1], z + zz), r + 0.004, 0.016 * k, "c3T4", sides=14)                            # moulded ribs
    m.cyl((c[0], c[1], z + h), r * 0.92, 0.012 * k, "c3W2", sides=14, top="c3W0")                      # white lid
    m.cyl((*rot(c, rz, r * 0.45, 0), z + h + 0.012 * k), 0.02 * k, 0.014 * k, "c3W3", sides=6)


def water(m, size):
    place(m, size, drum, k=1.0, layout={"held": FLOOR["held"], "s": [(0, 0, 0, 0.3)], "m": [(-0.11, -0.06, 0, 0.3), (0.12, 0.0, 0, 0.3),
                                                                             (0.0, 0.2, 0, 0.3)],
                          "l": [(-0.2, -0.12, 0, 0.3), (0.04, -0.14, 0, 0.3), (0.26, 0.02, 0, 0.3), (-0.14, 0.12, 0, 0.3),
                                (0.1, 0.16, 0, 0.3), (-0.08, -0.02, 0.26, 0.3)]})


ITEMS = {"copper": copper, "alloy": alloy, "gold": gold, "silicon": silicon, "glass": glass, "carbon": carbon,
         "coolant": coolant, "titanium_ore": titanium_ore, "gas_canister": gas_canister, "water": water}
