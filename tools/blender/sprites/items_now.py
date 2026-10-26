"""Item art for the items the game has that had no sprite (family `items`): floor stacks .s/.m/.l and .held.

  parts       an amber tray of gears, brackets and bolts; the large stack two trays and loose gears
  iron_ore    rust-brown rock chunks with rusty iron on top, as the iron veins of the rock tiles (rock_ore.py)
  rare_ore    dark rock chunks studded with violet crystals whose points glow, as the rare veins
  fuel        orange jerry cans with a hazard band and a glowing cap; barrels from .m up
  missile     slim grey missiles with red noses on a cradle; the large stack a two-high rack
  sidearm, rifle, ion_pistol, blade   the crew's weapon model lying on its side; .m two of them, .l on a weapon crate

Grid frame and scale as items.py (STACK_K, HELD_K); each stack fits inside one tile."""
import math

from . import core
from .items_kit import chunk, cone, crystal, gun_flat, hashf, jobs, tube

# ---- spare parts -----------------------------------------------------------------------------------------------------


def tray(m, c, w, d, h, rz=0.0):
    """An open amber tray: a floor and four low walls."""
    ca, sa = math.cos(rz), math.sin(rz)
    at = lambda u, v: (c[0] + u * ca - v * sa, c[1] + u * sa + v * ca, c[2])  # noqa: E731
    m.box(at(0, 0), (w, d, 0.02), "ochD", base=True, rz=rz)
    t = 0.022
    for u, v, sx, sy in ((0, d / 2 - t / 2, w, t), (0, -d / 2 + t / 2, w, t), (w / 2 - t / 2, 0, t, d), (-w / 2 + t / 2, 0, t, d)):
        m.box(at(u, v), (sx, sy, h), "ochM", top="ochL", base=True, rz=rz)


def gear(m, c, r, z, col="steelL", top="plate"):
    m.cyl((c[0], c[1], z), r, 0.03, col, sides=10, top=top)
    for k in range(8):
        a = k * math.tau / 8
        m.box((c[0] + math.cos(a) * r, c[1] + math.sin(a) * r, z), (0.03, 0.03, 0.03), col, top=top, rz=a, base=True)
    m.cyl((c[0], c[1], z + 0.03), r * 0.38, 0.01, "dark", sides=8)


def bracket(m, c, z, rz):
    m.box((c[0], c[1], z), (0.14, 0.045, 0.02), "steel", top="steelL", rz=rz, base=True)
    m.box((c[0] + 0.06 * math.cos(rz), c[1] + 0.06 * math.sin(rz), z), (0.02, 0.045, 0.07), "steel", top="steelL", rz=rz,
          base=True)


def bolts(m, pts, z):
    for x, y in pts:
        m.cyl((x, y, z), 0.016, 0.04, "steelL", sides=6, top="plate")


def parts(m, size):
    """Steel gears, brackets and bolts heaped in an amber tray (brass gears among them)."""
    if size == "held":
        tray(m, (0, 0, 0), 0.24, 0.18, 0.06)
        gear(m, (-0.03, 0.0), 0.05, 0.02)
        gear(m, (0.05, 0.02), 0.035, 0.05, "brass", "oL")
        return
    if size == "s":
        tray(m, (0, 0, 0), 0.36, 0.26, 0.08, 0.2)
        gear(m, (-0.06, -0.01), 0.07, 0.02)
        gear(m, (-0.02, 0.03), 0.05, 0.05, "brass", "oL")
        bracket(m, (0.08, -0.03), 0.02, 0.4)
        bolts(m, [(0.1, 0.07), (0.05, 0.08)], 0.02)
        return
    tray(m, (0.0, -0.04, 0), 0.46, 0.32, 0.09, 0.15)
    gear(m, (-0.1, -0.07), 0.08, 0.02)
    gear(m, (-0.06, -0.03), 0.055, 0.052, "brass", "oL")
    gear(m, (0.08, 0.0), 0.06, 0.02)
    bracket(m, (0.07, -0.12), 0.02, -0.5)
    bolts(m, [(-0.14, 0.06), (0.15, 0.06), (-0.02, 0.07)], 0.02)
    if size == "l":                                                   # a second tray stacked on, and loose gears
        tray(m, (-0.02, -0.02, 0.095), 0.42, 0.3, 0.08, 0.35)
        gear(m, (-0.07, 0.0), 0.075, 0.115)
        gear(m, (-0.04, 0.03), 0.05, 0.145, "brass", "oL")
        bracket(m, (0.08, -0.04), 0.115, 0.9)
        bolts(m, [(0.12, 0.06), (0.06, 0.09)], 0.115)
        gear(m, (0.0, 0.3), 0.08, 0.0, "brass", "oL")
        gear(m, (0.27, 0.18), 0.06, 0.0)
    else:
        gear(m, (0.06, 0.25), 0.07, 0.0, "brass", "oL")


# ---- ores --------------------------------------------------------------------------------------------------------------

# (x, y, z, sx, sy, sz, rz) per chunk, filled in order
ORE = {
    "held": [(0, 0, 0, 0.17, 0.14, 0.11, 0.3), (0.05, 0.03, 0.06, 0.1, 0.09, 0.08, 1.1)],
    "s": [(-0.05, 0.0, 0, 0.2, 0.17, 0.13, 0.3), (0.1, 0.06, 0, 0.14, 0.12, 0.1, 1.2)],
    "m": [(-0.12, -0.06, 0, 0.22, 0.19, 0.15, 0.3), (0.12, -0.04, 0, 0.2, 0.17, 0.13, 1.2), (0.0, 0.14, 0, 0.18, 0.16, 0.12, 2.0),
          (-0.02, -0.02, 0.1, 0.17, 0.15, 0.12, 0.7)],
    "l": [(-0.2, -0.12, 0, 0.24, 0.2, 0.15, 0.3), (0.06, -0.18, 0, 0.22, 0.19, 0.14, 1.2), (0.24, 0.0, 0, 0.2, 0.17, 0.13, 2.0),
          (-0.16, 0.14, 0, 0.21, 0.18, 0.13, 0.9), (0.08, 0.2, 0, 0.2, 0.17, 0.13, 2.6), (-0.06, -0.04, 0.1, 0.23, 0.2, 0.15, 0.5),
          (0.12, 0.02, 0.09, 0.18, 0.15, 0.12, 1.6), (0.0, 0.02, 0.2, 0.15, 0.13, 0.11, 2.2)],
}


OS, OP = 1.45, 1.15                     # chunk size and spread on top of the table


def ore(size):
    return [(x * OP, y * OP, z * OS, sx * OS, sy * OS, sz * OS, rz) for x, y, z, sx, sy, sz, rz in ORE[size]]


def iron_ore(m, size):
    for i, (x, y, z, sx, sy, sz, rz) in enumerate(ore(size)):
        chunk(m, (x, y, z), (sx, sy, sz), 31 + i, ["or", "orL", "rk", "or"], ["rkM", "orM", "rkD", "orD"], rz=rz)


def rare_ore(m, size):
    for i, (x, y, z, sx, sy, sz, rz) in enumerate(ore(size)):
        chunk(m, (x, y, z), (sx, sy, sz), 71 + i, ["rkM", "rk"], ["rkD", "rkK", "rvD"], rz=rz)
        for k in range(2 if size in ("held", "s") else 2 + i % 2):        # crystals out of the top
            a = hashf(71, i, k) * math.tau
            off = (math.cos(a) * sx * 0.18, math.sin(a) * sy * 0.18)
            tilt = (math.cos(a) * 0.5, math.sin(a) * 0.5, 1.0)
            L = 0.08 + 0.05 * hashf(9, i, k)
            crystal(m, (x + off[0], y + off[1], z + sz * 0.7), tilt, L, 0.022 + 0.008 * hashf(5, i, k), "rvM", "rvG")


# ---- fuel ----------------------------------------------------------------------------------------------------------


def band(m, c, r, z0, h, cols, sides=12):
    """A striped band round a cylinder (hazard stripes): side quads only, alternating cols."""
    for k in range(sides):
        a0, a1 = k * math.tau / sides, (k + 1) * math.tau / sides
        p = [(c[0] + r * math.cos(a), c[1] + r * math.sin(a)) for a in (a0, a1)]
        m.poly([core.G(p[0][0], p[0][1], z0), core.G(p[1][0], p[1][1], z0), core.G(p[1][0], p[1][1], z0 + h),
                core.G(p[0][0], p[0][1], z0 + h)], cols[k % len(cols)], flip=True)


def can(m, c, rz, k=1.0):
    """A jerry can: an orange box with a hazard band, a handle and a glowing cap."""
    w, d, h = 0.16 * k, 0.09 * k, 0.2 * k
    m.box((c[0], c[1], c[2]), (w, d, h), "hivis", top="c1T2", rz=rz, base=True, bevel=0.012 * k)
    m.box((c[0], c[1], c[2] + h * 0.42), (w + 0.006, d + 0.006, h * 0.16), "hazK", rz=rz, base=True)
    for s in (-1, 1):
        m.box((c[0] + s * w * 0.28 * math.cos(rz), c[1] + s * w * 0.28 * math.sin(rz), c[2] + h * 0.42),
              (w * 0.16, d + 0.008, h * 0.16), "hazY", rz=rz, base=True)
    m.box((c[0] - w * 0.18 * math.cos(rz), c[1] - w * 0.18 * math.sin(rz), c[2] + h), (w * 0.4, 0.02 * k, 0.03 * k),
          "c1T4", rz=rz, base=True)
    m.cyl((c[0] + w * 0.3 * math.cos(rz), c[1] + w * 0.3 * math.sin(rz), c[2] + h), 0.02 * k, 0.025 * k, "flameY",
          sides=6)


def barrel(m, c, r=0.12, h=0.3, z0=0.0):
    m.cyl((c[0], c[1], z0), r, h, "hivis", sides=14, top="c1T2")
    band(m, c, r + 0.004, z0 + h * 0.4, h * 0.18, ("hazY", "hazK"), sides=14)
    for z in (0.04, h - 0.05):
        m.cyl((c[0], c[1], z0 + z), r + 0.006, 0.014, "c1T4", sides=14)
    m.cyl((c[0] + r * 0.45, c[1] - r * 0.2, z0 + h), 0.026, 0.02, "flameY", sides=6)


def fuel(m, size):
    if size == "held":
        can(m, (0, 0, 0), 0.3, 0.9)
    elif size == "s":
        can(m, (-0.08, 0.02, 0), 0.3)
        can(m, (0.1, -0.04, 0), 0.1)
    elif size == "m":
        barrel(m, (-0.08, 0.06))
        can(m, (0.16, -0.06, 0), 0.25)
        can(m, (-0.06, -0.2, 0), -0.1)
    else:
        m.box((0, 0, 0), (0.62, 0.44, 0.04), "steelD", top="steel", base=True)
        for x, y in ((-0.14, 0.09), (0.14, 0.09), (-0.14, -0.12)):
            barrel(m, (x, y), 0.11, 0.3, 0.04)
        can(m, (0.16, -0.12, 0.04), 0.2)


# ---- missiles --------------------------------------------------------------------------------------------------------


def missile(m, c, rz, L=0.5, r=0.042):
    """A slim missile lying along the ground heading rz with its centre at c (its axis at c.z)."""
    f = (math.cos(rz), math.sin(rz), 0.0)
    at = lambda u, z=0.0: (c[0] + f[0] * u, c[1] + f[1] * u, c[2] + z)  # noqa: E731
    tube(m, at(-L / 2), at(L * 0.3), r, "c3W3", cap="steelD", sides=10)
    tube(m, at(L * 0.12), at(L * 0.18), r + 0.004, "hazY", sides=10, ends=False)
    cone(m, at(L * 0.3), at(L / 2), r, "medRed", sides=10)
    for a in (math.pi / 4, 3 * math.pi / 4, -math.pi / 4, -3 * math.pi / 4):        # four tail fins
        dy, dz = math.cos(a), math.sin(a)
        o = (c[0] - f[1] * dy * r * 1.4 - f[0] * L * 0.4, c[1] + f[0] * dy * r * 1.4 - f[1] * L * 0.4, c[2] + dz * r * 1.4)
        m.box(o, (0.08, 0.008 + abs(dz) * 0.024, 0.008 + abs(dy) * 0.024), "steelD", top="steel", rz=rz)


def cradle(m, c, rz, w, L):
    for s in (-1, 1):
        u = s * L * 0.28
        m.box((c[0] + math.cos(rz) * u, c[1] + math.sin(rz) * u, 0), (0.04, w, 0.05), "steelD", top="steel", rz=rz,
              base=True)


def missiles(m, size):
    rz = 0.35
    across = (-math.sin(rz), math.cos(rz))
    if size == "held":
        missile(m, (0, 0, 0.045), rz, 0.34, 0.034)
        return
    rows = {"s": [0.0], "m": [-0.06, 0.06], "l": [-0.13, 0.0, 0.13]}[size]
    w = 0.12 + 0.12 * (len(rows) - 1)
    cradle(m, (0, 0), rz, w, 0.5)
    for v in rows:
        missile(m, (across[0] * v, across[1] * v, 0.085), rz)
    if size == "l":                                                   # a second layer in the rack
        for s in (-1, 1):
            u = s * 0.5 * 0.28
            m.box((math.cos(rz) * u, math.sin(rz) * u, 0.13), (0.03, w, 0.02), "steelD", top="steel", rz=rz, base=True)
        for v in (-0.065, 0.065):
            missile(m, (across[0] * v, across[1] * v, 0.195), rz)


# ---- hand weapons ------------------------------------------------------------------------------------------------------

# weapon: (scale on the deck, crate (length, width, height, side, top), held scale)
WEAPONS = {"sidearm": (1.45, (0.46, 0.3, 0.1, "steelD", "steel"), 1.0),
           "rifle": (0.72, (0.72, 0.28, 0.12, "jacketD", "jacket"), 0.4),
           "ion_pistol": (1.25, (0.5, 0.3, 0.1, "hbD", "hbM"), 0.85),
           "blade": (1.1, (0.56, 0.24, 0.08, "rustD", "leather"), 0.62)}


def weapon(name):
    from .human_v2_weapons import BUILD
    k, (cl, cw, ch, cs, ct), hk = WEAPONS[name]
    build = BUILD[name]

    def fn(m, size):
        if size == "held":
            gun_flat(m, build, (0, 0, 0), 0.4, hk)
        elif size == "s":
            gun_flat(m, build, (0, 0, 0), 0.35, k)
        elif size == "m":
            gun_flat(m, build, (-0.04, -0.11, 0), 0.25, k)
            gun_flat(m, build, (0.04, 0.12, 0), 0.5, k)
        else:                                                           # a weapon crate, one of them on its lid
            m.box((0, 0, 0), (cl, cw, ch), cs, top=ct, rz=0.35, base=True, bevel=0.01)
            for s in (-1, 1):
                m.box((s * cl * 0.36 * math.cos(0.35), s * cl * 0.36 * math.sin(0.35), 0), (0.03, cw + 0.01, ch + 0.004),
                      "steelD", top="steel", rz=0.35, base=True)
            m.box((0.0, 0.0, ch * 0.45), (cl * 0.25, cw + 0.006, ch * 0.22), "hazY", rz=0.35, base=True)
            gun_flat(m, build, (0, 0, ch), 0.35, k * 0.85)
    return fn


SPRITES = (jobs("parts", parts) + jobs("iron_ore", iron_ore) + jobs("rare_ore", rare_ore) + jobs("fuel", fuel)
           + jobs("missile", missiles) + [j for w in WEAPONS for j in jobs(w, weapon(w))])
