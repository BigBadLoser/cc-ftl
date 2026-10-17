"""Human layer items, part 2: rigid items (eyes, brows, hair pieces, cyber arms, implants, gear, boots/knee pads).
Coordinates are the base's rest frame: x lateral (+X = character left), y front is NEGATIVE, z up (see rigid.py).
Palette names are plain; team.* colours are palette-swap keys; emissive palette colours (cyan, magenta, orange) go to
the glow sheet."""
import os
from .human_base import Item
from .rigid import RigidSet


def _items(arm, slot, name, build, **kw):
    rs = RigidSet(arm)
    build(rs)
    return Item(slot, name, rs.build(), **kw)


# CREW_EYES: none (default) = brow only, no eye geometry; subtle = eyes in the darkest step of the skin key
EYES = os.environ.get("CREW_EYES", "none")


def eyes(arm, cyber):
    """Simplified face: two small dark eyes (1-2 px each), a thin lighter brow with a clear skin gap above them, no
    sclera and no mouth. The engineer's right eye (x<0) is a cyber eye."""
    def b(rs):
        h = rs.on("head")
        for sx in (1, -1):
            h.box((sx * 0.047, -0.14, 1.624), (0.08, 0.02, 0.018), "team.hair")             # brow, thin
            if EYES == "subtle" and not (cyber and sx == -1):                                 # eye: darkest skin step, 1 px
                h.box((sx * 0.046, -0.14, 1.546), (0.03, 0.03, 0.03), "team.skin*0.3")
        if cyber:
            h.box((-0.046, -0.14, 1.546), (0.06, 0.032, 0.056), "gmD", bevel=0.006)
            h.box((-0.046, -0.158, 1.546), (0.034, 0.014, 0.034), "cyan")
    return _items(arm, "eyes", "cyber" if cyber else "organic", b, default=not cyber, glow=cyber)


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
    h.box((0, 0.13, 1.64), (0.06, 0.05, 0.05), "leather")
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
    """Welding goggles worn on the forehead, just under the mohawk: a thin strap round the head and two small round
    lenses in brass rims on the front, clear of the hair."""
    def b(rs):
        h = rs.on("head")
        z = 1.652
        h.box((0, -0.123, z), (0.205, 0.03, 0.02), "leather")
        for sx in (-1, 1):
            h.box((sx * 0.104, -0.03, z), (0.03, 0.2, 0.02), "leather")
        h.box((0, 0.1, z), (0.215, 0.03, 0.02), "leather")
        for sx in (-1, 1):
            h.box((sx * 0.052, -0.14, z), (0.074, 0.03, 0.074), "brass", bevel=0.02)       # rim, reads round
            h.box((sx * 0.052, -0.158, z), (0.048, 0.016, 0.048), "lens", bevel=0.012)
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
    """Gunmetal arm with the same size and silhouette as the flesh arm (about 5% bulkier): plated shoulder cap, upper arm,
    forearm and a plain hand. The only bright parts are ONE cyan strip along the forearm and a small wrist ring."""
    sx = 1 if side == "L" else -1
    s = side

    def b(rs):
        a = rs.on(f"arm.{s}")
        a.box((sx * 0.215, 0.07, 1.325), (0.12, 0.125, 0.125), "gmD", bevel=0.03)             # shoulder cap
        a.box((sx * 0.37, 0.07, 1.323), (0.25, 0.108, 0.108), "gm", bevel=0.02)               # upper arm
        a.box((sx * 0.37, 0.07, 1.378), (0.2, 0.07, 0.016), "plate", bevel=0.006)             # plate on top
        f = rs.on(f"forearm.{s}")
        f.box((sx * 0.52, 0.07, 1.323), (0.075, 0.1, 0.1), "gmD", bevel=0.015)                 # elbow
        f.box((sx * 0.61, 0.07, 1.323), (0.2, 0.1, 0.1), "gm", bevel=0.02)                     # forearm
        f.box((sx * 0.61, 0.07, 1.375), (0.15, 0.062, 0.016), "plate", bevel=0.006)
        f.box((sx * 0.595, 0.0, 1.323), (0.12, 0.012, 0.022), "cyan")                           # the one cyan strip
        f.box((sx * 0.715, 0.07, 1.323), (0.016, 0.108, 0.108), "cyan")                        # wrist ring
        h = rs.on(f"hand.{s}")
        h.box((sx * 0.785, 0.062, 1.32), (0.085, 0.09, 0.075), "gmD", bevel=0.012)
        h.box((sx * 0.845, 0.06, 1.31), (0.05, 0.075, 0.04), "gm", bevel=0.008)
    return _items(arm, f"arm.{side}", "cyber", b, glow=True)


def nose_mouth(arm, body_item):
    """Facial relief for the body layer: a small nose and ears (skin key). No mouth."""
    rs = RigidSet(arm)
    h = rs.on("head")
    h.box((0, -0.132, 1.532), (0.035, 0.04, 0.045), "team.skin", bevel=0.006)
    for sx in (-1, 1):
        h.box((sx * 0.1, 0.0, 1.56), (0.025, 0.045, 0.06), "team.skin", bevel=0.006)
    body_item.objs += rs.build()
