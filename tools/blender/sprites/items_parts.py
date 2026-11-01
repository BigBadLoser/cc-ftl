"""Item art for planned items, components, medical and cyberware (family `items`; art only until the content lands):
floor stacks .s/.m/.l and .held, in the grid frame and scale of items.py.

  power_cell  chunky yellow-and-black battery packs with green charge lights
  servo       robot actuators: an orange motor housing with a steel joint and arm stub
  sensor      grey sensor modules with a glass lens dome and a short antenna
  nanites     sealed vials of silver shimmer in a padded case
  medicine    blue-capped drug vials in a white rack
  stim        red auto-injector pens in an open black case
  implant     a black case with magenta neon trim, a chrome spine implant on foam
  data_core   glowing cyan data shards standing in a dark slotted base
  ai_chip     a black processor with gold pins in an orange foam case, a cyan core light"""
from .items_kit import crystal, place, pile, rot, tube

# ---- power cells -------------------------------------------------------------------------------------------------------


def pack(m, c, z, rz, k):
    w, d, h = 0.17 * k, 0.11 * k, 0.1 * k
    m.box((c[0], c[1], z), (w, d, h), "hazK", top="steelD", rz=rz, base=True, bevel=0.01 * k)
    for u in (-w * 0.32, w * 0.32):                                                         # yellow end caps
        m.box((*rot(c, rz, u, 0), z), (w * 0.2, d + 0.006, h + 0.004), "hazY", top="c4T1", rz=rz, base=True)
    for i in range(3):                                                                      # charge lights
        m.box((*rot(c, rz, (i - 1) * 0.02 * k, d / 2 + 0.002), z + h * 0.6), (0.012 * k, 0.006, 0.014 * k), "green", rz=rz,
              base=True)
    for v in (-d * 0.25, d * 0.25):                                                         # terminals
        m.cyl((*rot(c, rz, w * 0.32, v), z + h), 0.012 * k, 0.014 * k, "steelL", sides=6)


def power_cell(m, size):
    place(m, size, pack, pile(0.1, 0.17))


# ---- servos ------------------------------------------------------------------------------------------------------------


def servo_unit(m, c, z, rz, k):
    r, L = 0.055 * k, 0.16 * k
    a, b = rot(c, rz, -L / 2, 0), rot(c, rz, L * 0.2, 0)
    tube(m, (a[0], a[1], z + r), (b[0], b[1], z + r), r, "c1T3", cap="c1T5", sides=12)              # the motor housing
    for u in (-L * 0.3, -L * 0.05):
        p, q = rot(c, rz, u - 0.008, 0), rot(c, rz, u + 0.008, 0)
        tube(m, (p[0], p[1], z + r), (q[0], q[1], z + r), r + 0.004, "steelD", sides=12, ends=False)  # cooling rings
    p, q = rot(c, rz, L * 0.2, 0), rot(c, rz, L * 0.36, 0)
    tube(m, (p[0], p[1], z + r), (q[0], q[1], z + r), r * 0.75, "steel", cap="steelL", sides=10)      # the joint
    e = rot(c, rz, L * 0.36, 0)
    m.box((e[0], e[1], z + r * 0.6), (0.03 * k, r * 0.9, r * 0.8), "steelL", top="plate", rz=rz, base=True)
    f = rot(c, rz, L * 0.46, 0)
    m.box((f[0], f[1], z + r * 0.7), (0.12 * k, 0.03 * k, 0.03 * k), "steel", top="steelL", rz=rz + 0.6, base=True)  # arm stub


def servo(m, size):
    place(m, size, servo_unit, pile(0.11, 0.2))


# ---- sensors -----------------------------------------------------------------------------------------------------------


def sensor_unit(m, c, z, rz, k):
    w, d, h = 0.14 * k, 0.12 * k, 0.07 * k
    m.box((c[0], c[1], z), (w, d, h), "c3W5", top="c3W3", rz=rz, base=True, bevel=0.008 * k)
    m.cyl((*rot(c, rz, -w * 0.12, 0), z + h), 0.04 * k, 0.012 * k, "steelD", sides=12)
    m.cyl((*rot(c, rz, -w * 0.12, 0), z + h + 0.012 * k), 0.034 * k, 0.03 * k, "glassL", sides=12, rtop=0.012 * k, top="lens")
    a = rot(c, rz, w * 0.32, d * 0.25)
    tube(m, (a[0], a[1], z + h), (a[0], a[1], z + h + 0.08 * k), 0.006 * k, "steelL", sides=6)
    m.box((*rot(c, rz, w * 0.3, -d * 0.2), z + h), (0.016 * k, 0.016 * k, 0.006), "red", rz=rz, base=True)


def sensor(m, size):
    place(m, size, sensor_unit, pile(0.07, 0.15))


# ---- nanites -----------------------------------------------------------------------------------------------------------


def vial(m, c, z, k, body, cap, h=0.09, r=0.022):
    m.cyl((c[0], c[1], z), r * k, h * k * 0.75, body, sides=8)
    m.cyl((c[0], c[1], z + h * k * 0.75), r * k * 1.05, h * k * 0.25, cap, sides=8, top=cap)


def vial_case(m, c, z, rz, k, nx, ny, body, cap, case=("steelD", "dark"), pitch=0.055, h=0.09, r=0.022):
    w, d = nx * pitch + 0.03, ny * pitch + 0.03
    m.box((c[0], c[1], z), (w * k, d * k, 0.04 * k), case[0], top=case[1], rz=rz, base=True, bevel=0.006)
    for i in range(nx):
        for j in range(ny):
            vial(m, rot(c, rz, (i - (nx - 1) / 2) * pitch * k, (j - (ny - 1) / 2) * pitch * k), z + 0.02 * k, k, body, cap, h, r)


def nanites(m, size):
    case = ("steel", "dark")
    if size == "held":
        vial_case(m, (0, 0), 0, 0.3, 1.2, 2, 1, "arc", "steelL", case)
    elif size == "s":
        vial_case(m, (0, 0), 0, 0.3, 1.35, 3, 2, "arc", "steelL", case)
    elif size == "m":
        vial_case(m, (-0.1, -0.08), 0, 0.3, 1.35, 3, 2, "arc", "steelL", case)
        vial_case(m, (0.14, 0.14), 0, 0.3, 1.35, 2, 2, "arc", "steelL", case)
    else:
        for x, y in ((-0.16, -0.12), (0.14, -0.06), (-0.06, 0.2)):
            vial_case(m, (x, y), 0, 0.3, 1.35, 3, 2, "arc", "steelL", case)
        m.box((0.22, 0.22, 0), (0.14, 0.14, 0.1), "steel", top="steelL", rz=0.3, base=True, bevel=0.008)   # a sealed tin
        m.box((0.22, 0.22, 0.1), (0.07, 0.018, 0.004), "arc", rz=0.3, base=True)


# ---- medicine ----------------------------------------------------------------------------------------------------------


def medicine(m, size):
    case = ("c3W3", "medWhite")
    if size == "held":
        vial_case(m, (0, 0), 0, 0.3, 1.2, 2, 1, "c3T1", "c3T3", case)
    elif size == "s":
        vial_case(m, (0, 0), 0, 0.3, 1.35, 4, 2, "c3T1", "c3T3", case)
    elif size == "m":
        vial_case(m, (-0.1, -0.08), 0, 0.3, 1.35, 4, 2, "c3T1", "c3T3", case)
        vial_case(m, (0.14, 0.16), 0, 0.3, 1.35, 3, 2, "c3T1", "medRed", case)
    else:
        for (x, y), cap in zip(((-0.16, -0.14), (0.14, -0.08), (-0.08, 0.18), (0.22, 0.2)), ("c3T3", "c3T3", "medRed", "c3T3")):
            vial_case(m, (x, y), 0, 0.3, 1.35, 4 if cap == "c3T3" else 3, 2, "c3T1", cap, case)


# ---- stims -------------------------------------------------------------------------------------------------------------


def pen(m, c, z, rz, k):
    """An auto-injector lying in its case: a red barrel, a yellow cap, a steel needle guard."""
    L, r = 0.14 * k, 0.014 * k
    a, b, e = rot(c, rz, -L / 2, 0), rot(c, rz, L * 0.25, 0), rot(c, rz, L / 2, 0)
    tube(m, (a[0], a[1], z + r), (b[0], b[1], z + r), r, "medRed", cap="hazY", sides=8)
    tube(m, (b[0], b[1], z + r), (e[0], e[1], z + r), r * 0.8, "steelL", cap="steel", sides=8)


def stim_case(m, c, z, rz, k, n=4):
    w, d = 0.18 * k, (n * 0.036 + 0.03) * k
    m.box((c[0], c[1], z), (w, d, 0.035 * k), "dark", top="steelD", rz=rz, base=True, bevel=0.006)
    m.box((*rot(c, rz, 0, d / 2 + 0.004), z), (w, 0.01, 0.07 * k), "dark", top="steelD", rz=rz, base=True)  # open lid
    for i in range(n):
        pen(m, rot(c, rz, 0, (i - (n - 1) / 2) * 0.036 * k), z + 0.035 * k, rz, k)


def stim(m, size):
    if size == "held":
        stim_case(m, (0, 0), 0, 0.3, 1.15, 2)
        return
    place(m, size, stim_case, k=1.2, layout={
        "s": [(0, 0, 0, 0.3)], "m": [(-0.12, -0.08, 0, 0.3), (0.13, 0.12, 0, 0.3), (-0.11, -0.07, 0.042, 0.45)],
        "l": [(-0.16, -0.14, 0, 0.3), (0.12, -0.08, 0, 0.3), (-0.08, 0.18, 0, 0.3), (0.2, 0.18, 0, 0.1),
              (-0.15, -0.13, 0.042, 0.45), (0.13, -0.07, 0.042, 0.2)]})


# ---- implants ----------------------------------------------------------------------------------------------------------


def implant_case(m, c, z, rz, k):
    w, d, h = 0.22 * k, 0.15 * k, 0.05 * k
    m.box((c[0], c[1], z), (w, d, h), "dark", top="xnK", rz=rz, base=True, bevel=0.008 * k)
    for v in (-d / 2, d / 2):                                                               # neon trim
        m.box((*rot(c, rz, 0, v), z + h * 0.7), (w * 0.9, 0.006, 0.01 * k), "magenta", rz=rz, base=True)
    for i in range(5):                                                                      # a segmented spine implant
        u = (i - 2) * 0.03 * k
        m.box((*rot(c, rz, u, 0), z + h), (0.022 * k, 0.05 * k, 0.022 * k), "c3W2", top="c3W0", rz=rz, base=True, bevel=0.004)
    m.box((*rot(c, rz, 0.08 * k, 0), z + h), (0.012 * k, 0.012 * k, 0.012 * k), "fxC1", rz=rz, base=True)


def implant(m, size):
    place(m, size, implant_case, pile(0.05, 0.22))


# ---- data cores --------------------------------------------------------------------------------------------------------


def shard_base(m, c, z, rz, k, n=3):
    w = (n * 0.05 + 0.03) * k
    m.box((c[0], c[1], z), (w, 0.08 * k, 0.04 * k), "xnK", top="steelD", rz=rz, base=True, bevel=0.006)
    for i in range(n):
        p = rot(c, rz, (i - (n - 1) / 2) * 0.05 * k, 0)
        crystal(m, (p[0], p[1], z + 0.03 * k), (0.0, 0.0, 1.0), (0.1 + 0.03 * (i % 2)) * k, 0.018 * k, "fxC2", "fxC1", sides=4)


def data_core(m, size):
    if size == "held":
        shard_base(m, (0, 0), 0, 0.3, 1.2, 2)
        return
    place(m, size, shard_base, k=1.25, layout={
        "s": [(0, 0, 0, 0.3)], "m": [(-0.13, -0.1, 0, 0.3), (0.13, 0.1, 0, 0.3)],
        "l": [(-0.17, -0.15, 0, 0.3), (0.14, -0.1, 0, 0.3), (-0.1, 0.16, 0, 0.3), (0.2, 0.2, 0, 0.3)]})


# ---- AI chips ----------------------------------------------------------------------------------------------------------


def chip_case(m, c, z, rz, k):
    w = 0.17 * k
    m.box((c[0], c[1], z), (w, w, 0.045 * k), "c1T4", top="c1T2", rz=rz, base=True, bevel=0.01 * k)         # orange foam
    m.box((c[0], c[1], z + 0.045 * k), (w * 0.6, w * 0.6, 0.006), "brass", rz=rz, base=True)                 # gold pins
    m.box((c[0], c[1], z + 0.05 * k), (w * 0.5, w * 0.5, 0.016 * k), "dark", top="black", rz=rz, base=True)  # the die
    m.box((c[0], c[1], z + 0.066 * k), (w * 0.14, w * 0.14, 0.004), "cyan", rz=rz, base=True)


def ai_chip(m, size):
    place(m, size, chip_case, pile(0.05, 0.17))


ITEMS = {"power_cell": power_cell, "servo": servo, "sensor": sensor, "nanites": nanites, "medicine": medicine, "stim": stim,
         "implant": implant, "data_core": data_core, "ai_chip": ai_chip}
