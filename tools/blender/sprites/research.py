"""Research bench look study (family `research`, preview only): three different designs of the 2x3 bench, r0 `.on`,
each with a `.front` overlay (the chair's backrest, drawn over a seated crew member). Local frame and placement:
modkit.K, footprint (3, 2), front = +v; the chair is the middle front tile (u 0, v +0.5), facing -v into the bench.

  a  lab bench: one long straight bench; an open analysis cage with a scanner ring round a floating sample, an amber
     holo panel over a projector puck, a microscope, a vial rack, a parts tray, a cable riser; a sample cart in front
  b  U desk: the desk wraps the chair (back run and two wings); a three-screen arc in pale mint, a ring scanner with
     a sample tray through it on the left wing, a robot manipulator over a specimen dish on the right
  c  glovebox: a sealed glovebox with glove ports and a lit window, a spectrometer tower with a monitor on a swing
     arm, a holo molecule over a floor projector, a cryo dewar"""
import math

from .modkit import K

FP = (3, 2)
CU, CV = 0.0, 0.5                 # the chair tile (local)
SEAT = 0.39                       # seat pad top (the sit pose's seat height, as the mess chair)


def ring(k, axis, cu, cv, cz, r, n, w, t, col):
    """A ring of n boxes round an axis ('u', 'v' or 'z') through (cu, cv, cz): w thick along the axis, t radial."""
    seg = 2 * math.pi * r / n * 1.08
    for i in range(n):
        a = i * math.tau / n
        if axis == "u":
            k.box(cu, cv + r * math.cos(a), cz + r * math.sin(a) - t / 2, w, seg, t, col, rx=a + math.pi / 2)
        elif axis == "v":
            k.box(cu + r * math.cos(a), cv, cz + r * math.sin(a) - t / 2, seg, w, t, col, ry=-a - math.pi / 2)
        else:
            k.box(cu + r * math.cos(a), cv + r * math.sin(a), cz, seg, t, w, col, rz=a + math.pi / 2)


def lean_pt(v0, z0, t, lean):
    """A point t up a panel standing at (v0, z0) that leans back (toward -v) by `lean` radians."""
    return v0 - t * math.sin(lean), z0 + t * math.cos(lean)


def holo(k, u0, v0, z0, w, h, lean, glow, bars):
    """A floating holo panel facing +v: a bright frame and content bars [(x 0..1, t 0..1, width, height)]."""
    d = 0.03
    for t, hh in ((0.0, 0.045), (h - 0.045, 0.045)):
        v, z = lean_pt(v0, z0, t, lean)
        k.box(u0, v, z, w, d, hh, glow, rx=lean)
    for su in (-1, 1):
        v, z = lean_pt(v0, z0, 0.0, lean)
        k.box(u0 + su * (w / 2 - 0.022), v - h / 2 * math.sin(lean), z, 0.045, d, h, glow, rx=lean)
    for x, t, bw, bh in bars:
        v, z = lean_pt(v0, z0, 0.07 + t * (h - 0.14 - bh), lean)
        k.box(u0 - w / 2 + 0.08 + x * (w - 0.16 - bw) + bw / 2, v, z, bw, d, bh, glow, rx=lean)


def chair(k, part, shell="steelD", pad="navy", back=True):
    """A lab chair on the chair tile facing -v: five-star base, gas post, seat pad (top SEAT), a backrest at +v.
    part 'front' builds the backrest alone (the overlay over a seated crew member)."""
    u, v = CU, CV
    if part != "front":
        for i in range(5):
            a = i * math.tau / 5 + 0.3
            k.box(u + 0.11 * math.cos(a), v + 0.11 * math.sin(a), 0.04, 0.22, 0.06, 0.045, "steelD", rz=a)
            k.box(u + 0.21 * math.cos(a), v + 0.21 * math.sin(a), 0.0, 0.07, 0.07, 0.06, "dark")
        k.cyl(u, v, 0.08, 0.045, 0.2, "steelL", top="steel", sides=8)
        k.box(u, v, 0.28, 0.46, 0.44, 0.07, shell, top="steel", bevel=0.02)
        k.box(u, v - 0.01, 0.35, 0.4, 0.38, 0.04, pad, top=pad, bevel=0.012)
    if back:
        k.box(u, v + 0.2, 0.3, 0.07, 0.05, 0.14, "steelL")                              # spine
        k.box(u, v + 0.23, 0.42, 0.42, 0.07, 0.34, shell, top="steel", rx=-0.12, bevel=0.02)
        k.box(u, v + 0.19, 0.45, 0.34, 0.02, 0.27, pad, rx=-0.12)


# ---- a: the long lab bench ---------------------------------------------------------------------------------------

def bench_a(part):
    k = K(f"research_a_{part}", FP, 0)
    if part == "front":
        chair(k, part, "gm", "medRed")
        return k.build()
    G, GD, TOP = "resAmb", "resAmbD", 0.64
    bv, bd = -0.52, 0.84                                                              # bench centre v, depth
    k.box(0, bv - 0.02, 0.0, 2.8, bd - 0.1, 0.07, "dark")                             # kick recess
    for su in (-1, 1):                                                                # two drawer pedestals
        k.box(su * 0.97, bv, 0.07, 0.88, bd - 0.04, TOP - 0.13, "steel", top="steelL", bevel=0.012)
        for j in range(3):
            z = 0.12 + j * 0.15
            k.box(su * 0.97, bv + bd / 2 - 0.01, z, 0.8, 0.02, 0.12, "plateB")
            k.box(su * 0.97, bv + bd / 2 + 0.005, z + 0.07, 0.24, 0.025, 0.03, "steelD")
    k.box(0, bv - bd / 2 + 0.05, 0.07, 1.08, 0.05, TOP - 0.13, "steelD")              # knee well's back panel
    k.box(0, bv, TOP - 0.06, 2.94, bd + 0.04, 0.06, "gm", top="plate", bevel=0.01)    # worktop
    k.box(0, bv + bd / 2 + 0.01, TOP - 0.07, 2.94, 0.04, 0.04, "brass")               # its front lip
    k.box(0, bv - bd / 2 + 0.03, TOP, 2.94, 0.06, 0.3, "steelD", top="gm")            # back upstand
    for i in range(3):                                                                # cable tray on it
        k.box(0.1, bv - bd / 2 + 0.07, TOP + 0.08 + i * 0.07, 2.4, 0.03, 0.04, ("pcb", "gmD", "medRed")[i])
    for z in (0.08, 0.3, 0.52):                                                       # cable riser to the deck
        k.box(1.38, bv - bd / 2 + 0.06 + z * 0.1, 0.0, 0.06, 0.06, TOP + 0.3, ("pcb", "gmD", "medRed")[int(z * 4)])
    # analysis cage, left: a base drum, four posts, a cap, the scanner ring round a sample floating over a pedestal
    au, av, az = -0.95, -0.52, TOP
    k.cyl(au, av, az, 0.32, 0.12, "gmD", top="steel", sides=16)
    k.cyl(au, av, az + 0.12, 0.27, 0.03, "steelL", top=GD, sides=16)
    for i in range(4):
        a = i * math.tau / 4 + math.pi / 4
        k.cyl(au + 0.27 * math.cos(a), av + 0.27 * math.sin(a), az + 0.12, 0.032, 0.62, "steelL", sides=6)
    k.cyl(au, av, az + 0.74, 0.32, 0.1, "gmD", top="steel", sides=16)
    k.cyl(au, av, az + 0.84, 0.12, 0.06, "steelD", top="dark", sides=10)
    k.cyl(au, av, az + 0.15, 0.06, 0.12, "steel", top=G, sides=8)                     # sample pedestal, lit lens
    k.box(au, av, az + 0.36, 0.11, 0.11, 0.14, "iceB", rx=0.5, ry=0.4, rz=0.6)          # the sample (a crystal)
    ring(k, "z", au, av, az + 0.47, 0.23, 14, 0.035, 0.05, G)                          # scanner ring
    # holo projector and its panel, centre, facing the chair
    pv = -0.42
    k.cyl(0.0, pv - 0.04, TOP, 0.17, 0.05, "gmD", top="dark", sides=14)
    k.cyl(0.0, pv - 0.04, TOP + 0.05, 0.07, 0.02, G, sides=10)
    for su in (-1, 1):                                                                # projection lines
        k.box(su * 0.17, pv - 0.08, TOP + 0.06, 0.03, 0.03, 0.24, G, ry=su * 0.55)
    holo(k, 0.0, pv - 0.1, TOP + 0.26, 0.82, 0.56, 0.18, G,
         [(0.0, 1.0, 0.36, 0.05), (0.0, 0.84, 0.22, 0.05), (1.0, 1.0, 0.18, 0.05),
          (0.05, 0.0, 0.06, 0.2), (0.22, 0.0, 0.06, 0.12), (0.4, 0.0, 0.06, 0.26), (0.58, 0.0, 0.06, 0.16),
          (0.0, 0.42, 0.62, 0.035)])
    # microscope and a vial rack, right; a parts tray by the chair
    mu, mv = 0.78, -0.62
    k.box(mu, mv, TOP, 0.3, 0.24, 0.05, "lvW2", top="lvW", bevel=0.01)
    k.box(mu, mv - 0.08, TOP + 0.05, 0.08, 0.08, 0.42, "lvW2", top="lvW")
    k.box(mu, mv + 0.03, TOP + 0.18, 0.22, 0.18, 0.04, "dark")                        # stage
    k.box(mu, mv - 0.02, TOP + 0.4, 0.12, 0.26, 0.11, "lvW2", top="lvW", rx=-0.4, bevel=0.01)  # head
    k.cyl(mu, mv + 0.05, TOP + 0.22, 0.035, 0.12, "steelL", sides=8)                   # objective
    k.box(mu, mv + 0.12, TOP + 0.48, 0.07, 0.12, 0.06, "dark", rx=-0.6)                # eyepiece toward the chair
    k.box(1.2, -0.5, TOP, 0.32, 0.18, 0.06, "gm", top="steelL")
    for i, col in enumerate(("hivis", "pcb", "medRed", "iceB")):
        k.cyl(1.08 + i * 0.08, -0.5, TOP + 0.04, 0.03, 0.18, "lvW", top=col, sides=6)
    k.box(0.42, -0.3, TOP, 0.3, 0.2, 0.04, "steelD", top="dark")                      # parts tray
    for i, (a, b, col) in enumerate(((-0.07, -0.03, "brass"), (0.04, 0.04, "pcb"), (0.08, -0.04, "steelL"))):
        k.box(0.42 + a, -0.3 + b, TOP + 0.04, 0.07, 0.06, 0.03, col)
    k.box(-0.42, -0.26, TOP, 0.42, 0.14, 0.03, "dark", rz=0.05)                        # keyboard
    for i in range(3):
        k.box(-0.42, -0.26 + (i - 1) * 0.04, TOP + 0.03, 0.36, 0.02, 0.012, "steelD", rz=0.05)
    k.box(-0.2, -0.22, TOP, 0.05, 0.05, 0.08, G)                                      # a lit status pip
    # sample cart, front left: two shelves on casters, sample cases
    cu, cv = -1.0, 0.45
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(cu + su * 0.26, cv + sv * 0.2, 0.0, 0.06, 0.06, 0.06, "dark")
            k.box(cu + su * 0.26, cv + sv * 0.2, 0.06, 0.04, 0.04, 0.48, "steelL")
    for z in (0.12, 0.48):
        k.box(cu, cv, z, 0.6, 0.46, 0.04, "gm", top="steel")
    k.box(cu - 0.08, cv, 0.52, 0.3, 0.28, 0.14, "lvW2", top="lvW", bevel=0.015)         # a sample case
    k.box(cu - 0.08, cv + 0.145, 0.57, 0.12, 0.012, 0.04, GD)
    k.box(cu + 0.17, cv - 0.04, 0.16, 0.2, 0.3, 0.16, "medWhite", top="lvW", bevel=0.01)
    chair(k, part, "gm", "medRed")
    return k.build()


# ---- b: the U desk ----------------------------------------------------------------------------------------------

def _desk(k, u, v, su, sv, h, base="steel"):
    k.box(u, v, 0.0, su - 0.06, sv - 0.06, 0.08, "dark")
    k.box(u, v, 0.08, su, sv, h - 0.13, base, top="steelL", bevel=0.012)
    k.box(u, v, 0.14, su + 0.014, sv - 0.16, h - 0.27, "plateB")                      # inset panels on the faces
    k.box(u, v, 0.14, su - 0.16, sv + 0.014, h - 0.27, "plateB")
    k.box(u, v, h - 0.05, su + 0.04, sv + 0.04, 0.05, "gm", top="plate", bevel=0.012)


def screen(k, u, v, z, w, h, rz, lean, glow, bars):
    """A monitor on the desk facing +v turned by rz: a stand, a bezel, dark glass and lit content."""
    c, s = math.cos(rz), math.sin(rz)
    k.box(u, v, z, 0.18, 0.12, 0.08, "gmD", rz=rz)
    k.box(u + s * 0.03, v - c * 0.03, z, 0.06, 0.05, 0.22, "steelD", rz=rz)
    k.box(u, v, z + 0.18, w, 0.06, h, "steelD", top="plate", rz=rz, rx=lean)
    k.box(u - s * 0.035, v + c * 0.035, z + 0.215, w - 0.08, 0.02, h - 0.07, "dark", rz=rz, rx=lean)
    for x, t, bw, bh in bars:
        du = -w / 2 + 0.08 + x * (w - 0.16 - bw) + bw / 2
        tz = 0.04 + t * (h - 0.14 - bh)
        dv = 0.05 - (tz + bh / 2 - (h - 0.07) / 2) * math.sin(lean)     # on the tilted glass, not behind it
        k.box(u + c * du - s * dv, v + s * du + c * dv, z + 0.215 + tz, bw, 0.02, bh, glow, rz=rz, rx=lean)


def bench_b(part):
    k = K(f"research_b_{part}", FP, 0)
    if part == "front":
        chair(k, part, "steelD", "navy")
        return k.build()
    G, H = "resMint", 0.62
    _desk(k, 0.0, -0.6, 2.94, 0.72, H)                                                # back run
    for su in (-1, 1):                                                                # two wings
        _desk(k, su * 1.0, 0.25, 0.94, 0.98, H, base="steelD")
    k.box(0.0, -0.95, H, 2.94, 0.05, 0.12, "gm", top="steelL")                        # back lip
    # three-screen arc
    screen(k, 0.0, -0.72, H, 0.86, 0.56, 0.0, 0.12, G,
           [(0.0, 1.0, 0.3, 0.05), (0.0, 0.8, 0.5, 0.04), (1.0, 1.0, 0.12, 0.05)]
           + [(i / 7, 0.0, 0.05, 0.08 + 0.1 * abs(math.sin(i * 1.3))) for i in range(8)])
    for su in (-1, 1):
        screen(k, su * 0.7, -0.6, H, 0.58, 0.48, su * 0.55, 0.12, G,
               [(0.0, 1.0, 0.5, 0.04), (0.0, 0.7, 0.3, 0.04), (0.0, 0.4, 0.42, 0.04), (1.0, 0.0, 0.18, 0.16)])
    k.box(0.0, -0.32, H, 0.5, 0.16, 0.03, "dark")                                     # keyboard and a pad
    k.box(0.0, -0.32, H + 0.03, 0.44, 0.1, 0.012, "steelD")
    k.box(0.36, -0.32, H, 0.12, 0.14, 0.02, "steelD", top=G)
    # ring scanner on the left wing: an upright ring round a sliding tray, axis along u
    ru, rv, rz = -1.02, 0.3, H + 0.34
    k.box(ru, rv, H, 0.34, 0.5, 0.06, "gmD", top="steel")
    for sv in (-1, 1):
        k.box(ru, rv + sv * 0.24, H + 0.06, 0.26, 0.08, 0.12, "steelD")
    ring(k, "u", ru, rv, rz, 0.27, 16, 0.24, 0.1, "lvW2")                            # housing
    ring(k, "u", ru + 0.125, rv, rz, 0.2, 16, 0.02, 0.05, G)                          # lit inner rim (+u face)
    ring(k, "u", ru - 0.125, rv, rz, 0.2, 16, 0.02, 0.05, G)
    k.box(ru + 0.05, rv, rz - 0.13, 0.84, 0.18, 0.04, "steelL", top="plate")           # sample tray through it
    k.box(ru + 0.3, rv, rz - 0.09, 0.1, 0.1, 0.06, "pcb", rz=0.4)                      # the sample on it
    k.box(ru - 0.37, rv, H, 0.06, 0.08, rz - 0.13 - H, "steelD")                       # tray rail post
    # robot manipulator on the right wing over a specimen dish
    mu, mv = 1.15, 0.05
    k.cyl(mu, mv, H, 0.14, 0.06, "gmD", top="steel", sides=12)
    k.cyl(mu, mv, H + 0.06, 0.08, 0.1, "hivis", top="hivis", sides=10)
    k.box(mu - 0.1, mv + 0.08, H + 0.2, 0.08, 0.08, 0.42, "hivis", top="steelL", ry=-0.45, rz=-0.5)     # upper arm
    k.cyl(mu - 0.2, mv + 0.14, H + 0.52, 0.06, 0.08, "gmD", sides=8)                   # elbow
    k.box(mu - 0.32, mv + 0.24, H + 0.36, 0.07, 0.07, 0.3, "hivis", ry=0.6, rz=-0.5)   # forearm, down
    k.box(mu - 0.42, mv + 0.33, H + 0.24, 0.1, 0.1, 0.06, "gmD")                        # wrist
    for s in (-1, 1):
        k.box(mu - 0.42 + s * 0.035, mv + 0.33, H + 0.17, 0.03, 0.05, 0.08, "steelL")   # gripper fingers
    k.cyl(mu - 0.42, mv + 0.36, H, 0.13, 0.03, "lvW", top="iceB", sides=14)            # specimen dish
    k.box(mu - 0.42, mv + 0.36, H + 0.03, 0.05, 0.05, 0.03, "pcb")
    k.box(1.0, 0.6, H, 0.34, 0.2, 0.04, "steelD", top="dark")                          # parts tray
    for a, col in ((-0.08, "brass"), (0.04, "steelL"), (0.1, "medRed")):
        k.box(1.0 + a, 0.6, H + 0.04, 0.06, 0.08, 0.03, col)
    for su in (-1, 1):                                                                # status pips on the wings
        k.box(su * 0.56, 0.72, 0.3, 0.012, 0.1, 0.05, G)
    k.box(-1.38, -0.92, 0.0, 0.08, 0.08, H + 0.12, "pcb")                             # cable riser
    chair(k, part, "steelD", "navy")
    return k.build()


# ---- c: the glovebox ----------------------------------------------------------------------------------------------

def bench_c(part):
    k = K(f"research_c_{part}", FP, 0)
    if part == "front":
        chair(k, part, "lvW2", "pcb")
        return k.build()
    G, W = "resLime", "resWin"
    gu, gv, gw, gd, BH = -0.32, -0.55, 2.1, 0.8, 0.62
    k.box(gu, gv, 0.0, gw - 0.06, gd - 0.06, 0.08, "dark")                            # base cabinet
    k.box(gu, gv, 0.08, gw, gd, BH - 0.08, "lvW2", top="lvW", bevel=0.015)
    for i in range(3):
        k.box(gu - gw / 3 + i * gw / 3, gv + gd / 2 + 0.005, 0.16, gw / 3 - 0.08, 0.012, BH - 0.24, "plateB")
    # the box: a steel frame, a sloped lit window with two glove ports, an extraction hood on top
    z0, z1 = BH, 1.32
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(gu + su * (gw / 2 - 0.04), gv + sv * (gd / 2 - 0.04), z0, 0.07, 0.07, z1 - z0, "steelD")
    k.box(gu, gv - 0.04, z0, gw - 0.1, gd - 0.16, z1 - z0, "glassL")                  # back of the chamber
    k.box(gu, gv + 0.22, z0 + 0.03, gw - 0.12, 0.06, 0.62, W, rx=0.32)                 # lit sloped window
    for su in (-1, 1):
        k.box(gu + su * (gw / 2 - 0.04), gv + gd / 2 - 0.12, z0, 0.04, 0.24, 0.66, "steelD", rx=0.32)
    k.box(gu, gv + gd / 2 - 0.02, z0, gw, 0.06, 0.06, "steel")                         # window sill
    for su in (-1, 1):                                                                # glove ports and gloves
        pu = gu + su * 0.4
        k.box(pu, gv + 0.33, z0 + 0.22, 0.24, 0.05, 0.24, "steelL", rx=0.32, bevel=0.02)
        k.box(pu, gv + 0.36, z0 + 0.25, 0.17, 0.04, 0.17, "black", rx=0.32)
        k.box(pu, gv + 0.42, z0 + 0.1, 0.14, 0.12, 0.18, "black", rx=-0.6, bevel=0.03)  # the glove hangs out
    k.box(gu, gv, z1, gw + 0.04, gd + 0.04, 0.08, "steel", top="steelL", bevel=0.01)  # hood
    k.box(gu, gv - 0.05, z1 + 0.08, gw - 0.3, gd - 0.3, 0.14, "steelD", top="gm", taper=0.8)
    for i in range(4):
        k.box(gu - 0.39 + i * 0.26, gv - 0.05, z1 + 0.22, 0.06, gd - 0.5, 0.02, "gmD")  # filter grille
    k.box(gu + 0.75, gv - 0.3, z1 + 0.08, 0.14, 0.14, 0.42, "steelD", top="gm")       # exhaust duct to the ceiling
    k.box(gu, gv + gd / 2 + 0.03, z1 + 0.02, 0.6, 0.012, 0.04, G)                     # lit status band on the hood
    # spectrometer tower, back right: stacked modules, lit slots, vents, a monitor on a swing arm toward the chair
    tu, tv = 1.12, -0.52
    k.box(tu, tv, 0.0, 0.62, 0.66, 0.06, "dark")
    for i, h in enumerate((0.42, 0.34, 0.38, 0.3)):
        z = 0.06 + sum((0.42, 0.34, 0.38, 0.3)[:i])
        k.box(tu, tv, z, 0.64, 0.68, h - 0.02, ("steel", "lvW2", "steel", "gm")[i], top="steelL", bevel=0.012)
        k.box(tu - 0.12, tv + 0.345, z + h * 0.35, 0.26, 0.012, 0.05, G if i % 2 == 0 else "dark")
        for j in range(3):
            k.box(tu + 0.16, tv + 0.345, z + 0.07 + j * 0.08, 0.2, 0.012, 0.03, "gmD")
    k.cyl(tu, tv, 1.5, 0.12, 0.08, "gmD", top=G, sides=10)                            # beacon on top
    k.box(tu - 0.36, tv + 0.1, 1.1, 0.08, 0.08, 0.08, "gmD")                          # swing arm: pivot,
    k.box(tu - 0.55, tv + 0.25, 1.12, 0.42, 0.06, 0.05, "steelD", rz=-0.6)             # arm, the monitor
    k.box(tu - 0.75, tv + 0.4, 0.96, 0.46, 0.05, 0.34, "steelD", top="plate", rz=-0.35, rx=0.15)
    k.box(tu - 0.74, tv + 0.43, 0.99, 0.4, 0.02, 0.27, "dark", rz=-0.35, rx=0.15)
    for i, (w, h) in enumerate(((0.28, 0.05), (0.18, 0.05), (0.32, 0.05))):
        k.box(tu - 0.75 + 0.01 * i, tv + 0.445, 1.02 + i * 0.08, w, 0.02, h, G, rz=-0.35, rx=0.15)
    # holo molecule over a floor projector, front left
    hu, hv = -1.0, 0.45
    k.cyl(hu, hv, 0.0, 0.26, 0.1, "gmD", top="steel", sides=16)
    k.cyl(hu, hv, 0.1, 0.18, 0.04, "steelL", top="dark", sides=16)
    k.cyl(hu, hv, 0.14, 0.07, 0.03, G, sides=10)
    atoms = [(0.0, 0.0, 0.66, 0.13, G), (0.2, 0.06, 0.8, 0.1, G), (-0.18, 0.08, 0.56, 0.1, G),
             (0.04, -0.2, 0.86, 0.09, "resMint"), (-0.1, 0.18, 0.92, 0.09, G), (0.22, -0.1, 0.52, 0.09, "resMint"),
             (0.32, 0.12, 0.98, 0.07, G)]
    for au, av, az, s, col in atoms:
        k.cyl(hu + au, hv + av, az - s / 2, s / 2, s * 0.5, col, sides=10, rtop=s * 0.48)   # round-ish atoms
        k.cyl(hu + au, hv + av, az, s / 2, s * 0.45, col, sides=10, rtop=s * 0.2)
    for i, j in ((0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (1, 6)):                     # bonds
        (a0, b0, z0_, _, _), (a1, b1, z1_, _, _) = atoms[i], atoms[j]
        L = math.dist((a0, b0, z0_), (a1, b1, z1_))
        k.box(hu + (a0 + a1) / 2, hv + (b0 + b1) / 2, (z0_ + z1_) / 2 - L / 2, 0.035, 0.035, L, G,
              rz=math.atan2(b1 - b0, a1 - a0) - math.pi / 2,
              rx=-math.atan2(math.hypot(a1 - a0, b1 - b0), z1_ - z0_))
    # cryo dewar, front right
    du, dv = 1.05, 0.45
    k.cyl(du, dv, 0.0, 0.26, 0.06, "dark", sides=14)
    k.cyl(du, dv, 0.06, 0.24, 0.5, "steel", top="steelL", sides=16)
    for z in (0.16, 0.42):
        k.cyl(du, dv, z, 0.25, 0.04, "steelD", sides=16)
    k.cyl(du, dv, 0.56, 0.15, 0.1, "polyB", top="iceB", sides=12)
    k.box(du, dv + 0.25, 0.3, 0.1, 0.02, 0.06, G)                                     # its temperature readout
    chair(k, part, "lvW2", "pcb")
    return k.build()


BUILD = {"a": bench_a, "b": bench_b, "c": bench_c}


def jobs():
    out = []
    for v, fn in BUILD.items():
        out.append((f"module.research.{v}.on", FP, "prop", lambda fn=fn: fn("on")))
        out.append((f"module.research.{v}.front", FP, "prop", lambda fn=fn: fn("front")))
    return out
