"""Human layer items, part 2: rigid items (eyes, brows, hair pieces, cyber arms, implants, gear, boots/knee pads).
Coordinates are the base's rest frame: x lateral (+X = character left), y front is NEGATIVE, z up (see rigid.py).
Palette names are plain; team.* colours are palette-swap keys; emissive palette colours (cyan, magenta, orange) go to
the glow sheet."""
from .human_base import Item
from .rigid import RigidSet


def _items(arm, slot, name, build, **kw):
    rs = RigidSet(arm)
    build(rs)
    return Item(slot, name, rs.build(), **kw)


def eyes(arm, cyber):
    def b(rs):
        h = rs.on("head")
        for sx in (1, -1):
            h.box((sx * 0.046, -0.118, 1.564), (0.074, 0.02, 0.058), "medWhite", bevel=0.004)
            h.box((sx * 0.044 - sx * 0.006, -0.13, 1.562), (0.04, 0.014, 0.05), "black")
            h.box((sx * 0.047, -0.124, 1.612), (0.09, 0.02, 0.026), "team.hair")      # brow
        if cyber:                               # character right eye (x<0) is cyber
            h.box((-0.044, -0.126, 1.566), (0.08, 0.024, 0.06), "gmD", bevel=0.006)
            h.box((-0.044, -0.141, 1.566), (0.05, 0.014, 0.05), "cyan")
            h.box((-0.044, -0.147, 1.58), (0.02, 0.006, 0.014), "arc")
    return _items(arm, "eyes", "cyber" if cyber else "organic", b, outline=False, default=not cyber, glow=cyber)


def hair_mohawk(arm):
    def b(rs):
        h = rs.on("head")
        h.box((0, 0.0, 1.69), (0.055, 0.25, 0.03), "team.hair")
        for zy, hh in ((0.1, 0.1), (0.05, 0.17), (0.0, 0.21), (-0.05, 0.17), (-0.1, 0.1)):
            h.box((0, zy, 1.7 + hh / 2 - 0.01), (0.05, 0.05, hh), "team.hair", taper=0.4)
    return _items(arm, "hair", "mohawk", b, default=False)


def ponytail_extra(arm, item):
    rs = RigidSet(arm)
    h = rs.on("head")
    h.box((0, 0.13, 1.64), (0.06, 0.05, 0.05), "strap")
    h.box((0, 0.155, 1.60), (0.07, 0.06, 0.1), "team.hair", taper=0.8)
    h.box((0, 0.17, 1.52), (0.06, 0.05, 0.12), "team.hair", taper=0.7)
    h.box((0, 0.17, 1.44), (0.04, 0.04, 0.08), "team.hair", taper=0.6)
    item.objs += rs.build()


def jack(arm):
    def b(rs):
        h = rs.on("head")
        h.box((0.112, 0.01, 1.595), (0.03, 0.05, 0.05), "gmD", bevel=0.006)
        h.box((0.13, 0.01, 1.595), (0.012, 0.03, 0.03), "magenta")
    return _items(arm, "implant.temple", "neural_jack", b, glow=True)


def goggles(arm):
    def b(rs):
        h = rs.on("head")
        h.box((0, -0.1, 1.668), (0.22, 0.2, 0.034), "team.accent*0.8", bevel=0.004)
        h.box((0, 0.0, 1.668), (0.235, 0.04, 0.034), "team.accent*0.8")
        for sx in (-1, 1):
            h.box((sx * 0.052, -0.145, 1.675), (0.1, 0.04, 0.075), "brass", bevel=0.01)
            h.box((sx * 0.052, -0.168, 1.675), (0.075, 0.016, 0.056), "lens")
    return _items(arm, "gear.head", "welding_goggles", b)


def engineer_rig(arm):
    def b(rs):
        sp = rs.on("spine_03")
        sp.box((0, 0.17, 1.22), (0.3, 0.06, 0.34), "gmD", bevel=0.012)
        for sx in (-1, 1):
            sp.cyl((sx * 0.085, 0.225, 1.06), 0.055, 0.34, "steelL", sides=6)
            sp.box((sx * 0.085, 0.225, 1.32), (0.085, 0.085, 0.035), "orange")
        sp.box((0, 0.205, 1.2), (0.24, 0.035, 0.06), "brass")
        sp.box((-0.13, 0.2, 1.43), (0.025, 0.025, 0.28), "gm")
        sp.box((-0.13, 0.2, 1.585), (0.04, 0.04, 0.04), "cyan")
        sp.box((0.0, 0.24, 1.36), (0.18, 0.02, 0.03), "cyan")
    return _items(arm, "gear.back", "engineer_rig", b, glow=True)


def belt_extra(arm, item):
    rs = RigidSet(arm)
    hp = rs.on("hips")
    hp.box((0, -0.125, 0.955), (0.09, 0.045, 0.07), "brass", bevel=0.008)
    for sx in (-1, 1):
        hp.box((sx * 0.14, -0.1, 0.92), (0.085, 0.07, 0.1), "leather", bevel=0.01)
    hp.box((0.1, -0.12, 0.85), (0.035, 0.035, 0.16), "plate")
    hp.box((0.1, -0.12, 0.76), (0.065, 0.035, 0.045), "orange")
    item.objs += rs.build()


def legs_extra(arm, item):
    rs = RigidSet(arm)
    for s, sx in (("L", 1), ("R", -1)):
        lg = rs.on(f"leg.{s}")
        lg.box((sx * 0.205, 0.02, 0.66), (0.045, 0.12, 0.14), "pocket", bevel=0.008)
        sh = rs.on(f"shin.{s}")
        sh.box((sx * 0.125, -0.06, 0.5), (0.12, 0.045, 0.1), "gmD", bevel=0.008)     # knee pad
        sh.box((sx * 0.125, -0.066, 0.5), (0.08, 0.02, 0.06), "gm")
    item.objs += rs.build()


def cyber_arm(arm, side):
    sx = 1 if side == "L" else -1
    s = side

    def b(rs):
        a = rs.on(f"arm.{s}")
        a.box((sx * 0.20, 0.07, 1.325), (0.14, 0.2, 0.22), "gmD", bevel=0.025)               # shoulder cap
        a.box((sx * 0.34, 0.07, 1.323), (0.25, 0.17, 0.17), "gm", bevel=0.015)
        a.box((sx * 0.30, 0.07, 1.323), (0.035, 0.19, 0.19), "gmD", bevel=0.008)
        a.box((sx * 0.38, 0.07, 1.323), (0.035, 0.19, 0.19), "gmD", bevel=0.008)
        a.box((sx * 0.34, -0.022, 1.323), (0.16, 0.014, 0.034), "cyan")                      # cyan strip
        a.box((sx * 0.34, 0.07, 1.412), (0.16, 0.034, 0.014), "cyan")
        f = rs.on(f"forearm.{s}")
        f.box((sx * 0.47, 0.07, 1.323), (0.07, 0.14, 0.14), "dark", bevel=0.01)
        f.box((sx * 0.60, 0.07, 1.323), (0.22, 0.165, 0.165), "gm", bevel=0.015)
        f.box((sx * 0.60, 0.07, 1.41), (0.16, 0.1, 0.02), "plate", bevel=0.006)
        f.box((sx * 0.60, -0.018, 1.323), (0.17, 0.014, 0.04), "cyan")
        f.box((sx * 0.60, 0.07, 1.409), (0.1, 0.03, 0.014), "cyan")
        f.box((sx * 0.705, 0.07, 1.323), (0.03, 0.19, 0.19), "cyan")                         # wrist ring
        h = rs.on(f"hand.{s}")
        h.box((sx * 0.765, 0.057, 1.318), (0.09, 0.105, 0.07), "gmD", bevel=0.01)
        for yy in (0.03, 0.057, 0.084):
            h.box((sx * 0.83, yy, 1.31), (0.06, 0.022, 0.03), "gm")
        h.box((sx * 0.75, 0.0, 1.325), (0.05, 0.03, 0.03), "gm")
    return _items(arm, f"arm.{side}", "cyber", b, glow=True)


def nose_mouth(arm, body_item):
    """Facial relief for the body layer: nose, mouth line, ears (skin key + dark)."""
    rs = RigidSet(arm)
    h = rs.on("head")
    h.box((0, -0.122, 1.545), (0.035, 0.04, 0.055), "team.skin", bevel=0.006)
    h.box((0, -0.108, 1.512), (0.07, 0.02, 0.012), "rustD")
    for sx in (-1, 1):
        h.box((sx * 0.1, 0.0, 1.56), (0.025, 0.045, 0.06), "team.skin", bevel=0.006)
    body_item.objs += rs.build()
