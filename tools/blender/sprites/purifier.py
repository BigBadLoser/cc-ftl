"""Water purifier (family `purifier`, palette set "purifier"): 2x1 at r0 (1x2 turned), idle, `.unpowered` and `.active`
(`.active.f1` .. `.f3`: bubbles rise in the tank), four rotations. Local frame and placement: modkit.K (front = +v); the
crew member works it from the tile in front of it.

Ice goes in at one end and clean water comes out at the other: an ice hopper (a funnel full of ice on a melt box with
a small control panel), three filter columns on a manifold, a clear water tank in a steel cage with the level showing
through its glass, pipes between them and a tap at the tank's foot, all on one skid. `.active`: the water glows, the
panel and the status lamp are green and bubbles rise. `.unpowered`: dark panel, no glow."""
from .modkit import K

SKID = 0.06
BODY, BODY_D, ACC, GLASS, WATER, FILT, CAP = "puBody", "puBodyD", "puAcc", "puGlass", "puWater", "puFilt", "puCap"


def purifier(state, rot, frame=0):
    on, lit = state != "unpowered", state == "active"
    k = K(f"purifier_{state}_{frame}_{rot}", (2, 1), rot)
    k.box(0, 0, 0.0, 1.86, 0.7, SKID, "steelD", top="gm")                                  # skid
    # ---- ice hopper and melt box (-u end)
    hu = -0.62
    k.box(hu, -0.02, SKID, 0.5, 0.56, 0.5, BODY, top=BODY_D, bevel=0.02)                    # melt box
    k.box(hu, 0.26, SKID + 0.04, 0.5, 0.02, 0.08, ACC)                                      # accent band
    k.box(hu, -0.02, SKID + 0.5, 0.36, 0.42, 0.06, BODY_D)                                  # throat
    k.box(hu, -0.02, SKID + 0.56, 0.36, 0.42, 0.3, BODY, top=BODY_D, taper=1.45)            # funnel, widening up
    for du, dv, su, sv in ((0, -0.29, 0.54, 0.04), (0, 0.25, 0.54, 0.04), (-0.25, -0.02, 0.04, 0.5), (0.25, -0.02, 0.04, 0.5)):
        k.box(hu + du, dv, SKID + 0.84, su, sv, 0.06, "steelD", top="steel")                  # its rim, a frame
    k.box(hu, -0.02, SKID + 0.83, 0.48, 0.52, 0.05, "iceB", top="iceB")                       # the ice in it
    for du, dv, s in ((-0.1, -0.08, 0.12), (0.08, 0.05, 0.14), (0.0, -0.15, 0.1), (0.12, -0.12, 0.1), (-0.12, 0.1, 0.11)):
        k.box(hu + du, -0.02 + dv, SKID + 0.86, s, s, s * 0.6, "iceB", top="puIceL")  # ice heaped in it
    k.box(hu + 0.08, 0.255, SKID + 0.2, 0.22, 0.02, 0.16, "gmD", bevel=0.01)                # control panel
    k.box(hu + 0.08, 0.267, SKID + 0.23, 0.17, 0.01, 0.1, ("green" if lit else "puScrDim") if on else "dark")
    k.box(hu - 0.15, 0.27, SKID + 0.3, 0.05, 0.012, 0.05, ("green" if lit else "lampY") if on else "rustD")  # status lamp
    # ---- filter columns on a manifold (middle)
    k.box(0.0, -0.05, SKID, 0.44, 0.3, 0.12, "steelD", top="gm")                            # manifold block
    for i, u in enumerate((-0.14, 0.0, 0.14)):
        v = -0.05 + (0.06 if i == 1 else 0.0)
        k.cyl(u, v, SKID + 0.12, 0.06, 0.66, FILT, top=FILT, sides=10)                      # column
        k.cyl(u, v, SKID + 0.12, 0.066, 0.06, CAP, sides=10)                                # foot ring
        k.cyl(u, v, SKID + 0.72, 0.066, 0.07, CAP, top=CAP, sides=10)                       # head cap
        k.cyl(u, v, SKID + 0.4, 0.064, 0.04, ACC, sides=10)                                 # band
    # ---- pipes: hopper -> filters -> tank, and a return along the back
    k.box(-0.25, -0.05, SKID + 0.62, 0.3, 0.06, 0.06, "steel", top="steelL")
    k.box(0.0, -0.05, SKID + 0.82, 0.36, 0.05, 0.05, "steel", top="steelL")                 # header across the caps
    k.box(0.25, -0.05, SKID + 0.62, 0.3, 0.06, 0.06, "steel", top="steelL")
    k.box(0.0, -0.3, SKID + 0.2, 1.4, 0.05, 0.05, "steelD", top="steel")                    # return line, back
    # ---- water tank (+u end): a steel cage round a glass drum
    tu, tv, tr, th = 0.6, -0.03, 0.26, 0.92
    k.cyl(tu, tv, SKID, tr + 0.02, 0.07, "steelD", top="steel", sides=14)                   # base ring
    k.cyl(tu, tv, SKID + 0.07, tr, th - 0.14, GLASS, top=GLASS, sides=14)                   # glass drum
    level = 0.55
    k.cyl(tu, tv, SKID + 0.08, tr + 0.004, (th - 0.16) * level, ("puWaterL" if lit else WATER), sides=14)  # the water
    k.cyl(tu, tv, SKID + th - 0.07, tr + 0.02, 0.08, "steelD", top="steel", sides=14)       # lid ring
    k.cyl(tu, tv, SKID + th + 0.01, tr * 0.6, 0.05, CAP, top=CAP, sides=12)                 # lid hatch
    for a in range(4):                                                                       # cage bars
        du, dv = ((tr + 0.02, 0), (0, tr + 0.02), (-tr - 0.02, 0), (0, -tr - 0.02))[a]
        k.box(tu + du, tv + dv, SKID, 0.035, 0.035, th + 0.01, "steelD")
    for z in (0.34, 0.62):
        k.cyl(tu, tv, SKID + z, tr + 0.012, 0.03, "steelD", sides=14)                        # hoops
    k.box(tu, tv + tr + 0.01, SKID + 0.12, 0.05, 0.02, 0.66, "steelD")                       # level gauge strip
    for j in range(5):
        k.box(tu + 0.035, tv + tr + 0.015, SKID + 0.16 + j * 0.12, 0.03, 0.01, 0.012, "plate")
    if lit:                                                                                   # bubbles rising
        for i, (du, z0) in enumerate(((-0.1, 0.1), (0.06, 0.3), (-0.02, 0.48), (0.12, 0.2))):
            z = SKID + 0.12 + (z0 + 0.12 * frame) % (0.5 * level + 0.16)
            k.box(tu + du, tv + tr - 0.005, z, 0.035, 0.02, 0.035, "puBubble")
    k.box(tu - 0.16, tv + tr + 0.02, SKID + 0.1, 0.05, 0.08, 0.05, "steel", top="steelL")    # tap
    k.box(tu - 0.16, tv + tr + 0.08, SKID + 0.06, 0.03, 0.03, 0.06, "steelD")
    k.box(tu - 0.16, tv + tr + 0.02, SKID + 0.16, 0.08, 0.02, 0.02, ACC)                      # its handle
    return k.build()


def jobs(rots=range(4)):
    """Every rotation: idle (powered), .unpowered, .active and .active.f1..f3; the plain id is r0 idle."""
    out = []
    for r in rots:
        fp = (2, 1) if r % 2 == 0 else (1, 2)
        base = f"module.purifier.r{r}"
        for state, f, aid in [("idle", 0, base), ("unpowered", 0, base + ".unpowered")] + \
                [("active", f, base + ".active" + (f".f{f}" if f else "")) for f in range(4)]:
            out.append((aid, fp, "prop", lambda r=r, s=state, f=f: purifier(s, r, f)))
        if r == 0:
            out.append(("module.purifier", fp, "prop", lambda: purifier("idle", 0)))
    return out
