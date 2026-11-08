"""Research bench look studies, round 3: g sample line, h gantry rig, i containment field. Each takes its own form from
what it does (no shared desk).

  g  the conveyor is the machine: a U of track round the chair, capsules fed from a magazine at the front left, along
     the back through a scanner hoop, out to a sorted rack at the front right; a status board behind the hoop and a
     key ledge on the track's face; gold light. Hologram: the scan curtain in the hoop, the capsule enlarged over it
  h  a full gantry over the footprint (four corner posts, side rails, a bridge, a carriage lowering a probe) and the
     find in a clamp cradle on the deck; a control chair (joystick armrests), spare probe
     heads on a post. Hologram: it measures the find (a wire box, a dimension line, a label)
  i  a round field generator drum carrying two emitter arms over the find floating above it, capacitor banks in the
     back corners cabled to it, a curved control rail in front of the drum. Hologram: the violet field and its arcs"""
import math

from .modkit import K
from .research_kit import CU, CV, Bench, bar, chair, ring


def _pane(k, u, v0, z0, w, h, lean, line, film, rows=()):
    """A floating pane facing +v, leaning back: a bright top and bottom edge, a film fill, rows [(x 0..1, t, width)]."""
    tip = lambda t: (v0 - t * math.sin(lean), z0 + t * math.cos(lean))  # noqa: E731
    for t in (0.0, h - 0.03):
        v, z = tip(t)
        k.box(u, v, z, w, 0.02, 0.03, line, rx=lean)
    v, z = tip(0.0)
    k.box(u, v - h / 2 * math.sin(lean), z, w - 0.02, 0.02, h, film, rx=lean)
    for x, t, bw in rows:
        v, z = tip(0.06 + t * (h - 0.14))
        k.box(u - w / 2 + 0.06 + x * (w - 0.12 - bw) + bw / 2, v + 0.015, z, bw, 0.02, 0.035, line, rx=lean)


# ---- g: the sample line ---------------------------------------------------------------------------------------------

TT = 0.5                          # the track's top (the belt)


def _capsule(k, u, v, z, core):
    k.cyl(u, v, z, 0.085, 0.04, "steelD", top="steel", sides=12)                    # puck
    k.part("glass").cyl(u, v, z + 0.04, 0.07, 0.2, "glassL", top="glassL", sides=12)
    k.cyl(u, v, z + 0.05, 0.045, 0.13, core, sides=10)
    k.cyl(u, v, z + 0.24, 0.075, 0.04, "steelL", top="steel", sides=12)              # cap


def _track(k, u, v, su, sv, along, rollers=True):
    """A run of conveyor: a housing on a dark kick, panels, rails along its edges, a belt trough, rollers across."""
    k.box(u, v, 0.0, su - 0.08, sv - 0.08, 0.07, "dark")
    k.box(u, v, 0.07, su, sv, TT - 0.12, "steel", top="plate", bevel=0.02)
    k.box(u, v, 0.13, su + 0.014, sv - 0.14, TT - 0.28, "plateB")
    k.box(u, v, 0.13, su - 0.14, sv + 0.014, TT - 0.28, "plateB")
    k.box(u, v, TT - 0.05, su - 0.08, sv - 0.08, 0.05, "dark")
    n = int((su if along == "u" else sv) / 0.2)
    for s in (-1, 1):
        if along == "u":
            k.box(u, v + s * (sv / 2 - 0.03), TT - 0.06, su, 0.06, 0.1, "steelL", top="plate")
        else:
            k.box(u + s * (su / 2 - 0.03), v, TT - 0.06, 0.06, sv, 0.1, "steelL", top="plate")
    for i in range(n if rollers else 0):
        t = -((n - 1) / 2) * 0.2 + i * 0.2
        if along == "u":
            k.box(u + t, v, TT - 0.03, 0.05, sv - 0.12, 0.02, "gm")
        else:
            k.box(u, v + t, TT - 0.03, su - 0.12, 0.05, 0.02, "gm")


def line_g(layer):
    k = Bench(f"research_g_{layer}")
    G = "resGold"
    bv, lu = -0.62, 1.15                                                             # back run v, the legs' u
    _track(k, 0.0, bv, 2.0, 0.5, "u")
    for su in (-1, 1):
        _track(k, su * lu, 0.12, 0.5, 1.6, "v")
        k.cyl(su * lu, bv, TT - 0.02, 0.23, 0.04, "gm", top="steelL", sides=18)         # turntable at the turn
        k.cyl(su * lu, bv, TT + 0.02, 0.06, 0.02, "steelD", sides=10)
    # feed magazine at the front-left end: a tower with a window onto the capsules waiting, a hopper on top
    mu, mv = -lu, 0.66
    k.box(mu, mv, TT, 0.44, 0.4, 0.66, "steel", top="steelL", bevel=0.02)
    k.box(mu, mv, TT + 0.66, 0.5, 0.46, 0.18, "steelD", top="gm", taper=1.0, bevel=0.02)
    k.box(mu, mv + 0.19, TT + 0.1, 0.26, 0.04, 0.48, "dark")
    for i in range(3):
        k.cyl(mu, mv + 0.12, TT + 0.12 + i * 0.15, 0.06, 0.12, ("hivis", "pcb", "medRed")[i], sides=10)
    k.part("glass").box(mu, mv + 0.205, TT + 0.1, 0.28, 0.02, 0.48, "glassL")
    k.box(mu + 0.225, mv, TT + 0.5, 0.02, 0.12, 0.06, G)
    # sorted rack at the front-right end: a tray of finished capsules in a grid, a done lamp
    ru, rv = lu, 0.66
    k.box(ru, rv, TT, 0.46, 0.42, 0.06, "gmD", top="dark")
    for sv in (-1, 1):
        k.box(ru, rv + sv * 0.2, TT, 0.46, 0.03, 0.12, "steelL")
    for i in range(2):
        for j in range(2):
            col = ("hivis", "pcb", "medRed", "resGold")[i * 2 + j]
            k.cyl(ru - 0.1 + i * 0.2, rv - 0.09 + j * 0.18, TT + 0.06, 0.05, 0.12, "lvW", top=col, sides=10)
    k.cyl(ru + 0.18, rv + 0.18, TT + 0.06, 0.03, 0.04, "steelD", top=G, sides=8)
    # the hoop over the back run, on two feet, gold-lit inner rims, a scan head on top
    az, ar = TT + 0.36, 0.34
    ring(k, "u", 0.0, bv, az, ar, 20, 0.16, 0.1, "steel")
    for su in (-1, 1):
        ring(k, "u", su * 0.085, bv, az, ar - 0.06, 20, 0.02, 0.03, G)
    for sv in (-1, 1):
        k.box(0.0, bv + sv * 0.3, TT - 0.06, 0.22, 0.12, 0.2, "gm", top="steelL", bevel=0.02)
    k.box(0.0, bv, az + ar + 0.02, 0.2, 0.2, 0.12, "gm", top="steelL", bevel=0.02)
    # status board behind the hoop, facing the chair: one row lit per capsule on the line
    k.box(-0.62, -0.92, TT, 0.06, 0.06, 0.62, "steelD")
    k.box(0.62, -0.92, TT, 0.06, 0.06, 0.62, "steelD")
    k.box(0.0, -0.92, TT + 0.62, 1.4, 0.06, 0.34, "gm", top="steelL", rx=0.1)
    k.box(0.0, -0.885, TT + 0.66, 1.3, 0.02, 0.26, "dark", rx=0.1)
    for i in range(3):
        for j, w in enumerate((0.36, 0.2, 0.28)):
            k.box(-0.42 + j * 0.42, -0.865 - 0.01 * i, TT + 0.69 + i * 0.07, w, 0.02, 0.035,
                  G if (i + j) % 3 else "resGoldF", rx=0.1)
    # a key ledge on the back run's face, in front of the chair
    k.box(0.0, bv + 0.32, TT - 0.12, 0.7, 0.16, 0.05, "gm", top="dark")
    for i in range(5):
        k.box(-0.24 + i * 0.12, bv + 0.33, TT - 0.07, 0.08, 0.08, 0.02, (G, "gmD", "steelL", "gmD", "hivis")[i])
    # the capsules on the line: up the left leg, round the back, out down the right
    for u, v, core in ((-lu, 0.3, "hivis"), (-lu, -0.05, "pcb"), (-0.55, bv, "medRed"), (0.0, bv, "resGold"),
                       (0.55, bv, "hivis"), (lu, -0.1, "pcb")):
        _capsule(k, u, v, TT, core)
    chair(k, "steelD", "navy")
    return k.build()


def line_g_holo():
    k = K("research_g_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    bv = -0.62
    k.box(0.0, bv, TT + 0.08, 0.02, 0.4, 0.54, F)                                    # the scan curtain
    k.box(0.0, bv, TT + 0.22, 0.03, 0.4, 0.03, G)                                    # its sweep line
    cz, R = 1.32, 0.17                                                              # the capsule, enlarged
    k.cyl(0.0, bv, cz, R, 0.42, F, top=F, sides=20)
    k.cyl(0.0, bv, cz + 0.06, 0.09, 0.3, G, sides=14)
    for z in (0.0, 0.14, 0.28, 0.42):
        ring(k, "z", 0.0, bv, cz + z, R + 0.01, 20, 0.02, 0.025, G)
    for su in (-1, 1):
        for i in range(3):
            k.box(su * (R + 0.08 + 0.04 * i), bv, cz + 0.08 + i * 0.12, 0.08 + 0.04 * i, 0.02, 0.025, G)
    return k


# ---- h: the gantry rig ----------------------------------------------------------------------------------------------

FV = -0.42                        # the find's v


def _find(k, u, v, z, glow):
    """The find: a long weathered stone slab, chipped, with lit glyph seams on its top."""
    k.box(u, v, z, 1.2, 0.42, 0.24, "resRelic", top="resRelicL", bevel=0.05, rz=0.04)
    k.box(u - 0.5, v + 0.05, z + 0.2, 0.26, 0.3, 0.12, "resRelic", top="resRelicL", bevel=0.04, rz=0.3)
    k.box(u + 0.42, v - 0.04, z + 0.22, 0.3, 0.28, 0.08, "resRelicD", top="resRelic", bevel=0.03, rz=-0.2)
    for du, w in ((-0.15, 0.36), (0.12, 0.2)):
        k.box(u + du, v, z + 0.235, w, 0.04, 0.02, glow, rz=0.04)
    k.box(u + 0.05, v + 0.08, z + 0.235, 0.04, 0.16, 0.02, glow, rz=0.04)


def gantry_h(layer):
    k = Bench(f"research_h_{layer}")
    W, PZ = "resWork", 1.62
    # the frame: four corner posts on foot plates, yellow rails along both sides, the bridge across, the carriage
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 1.4, sv * 0.9, 0.0, 0.24, 0.24, 0.05, "gmD", top="gm")
            k.box(su * 1.4, sv * 0.9, 0.05, 0.13, 0.13, PZ - 0.05, "steel", top="steelL")
            k.box(su * 1.4, sv * 0.9, 0.3, 0.15, 0.15, 0.04, "hivis")
        k.box(su * 1.4, 0.0, PZ, 0.16, 1.96, 0.16, "hivis", top="steelL")
        k.box(su * 1.31, 0.0, PZ + 0.02, 0.02, 1.7, 0.04, W)                          # work light strips
    k.box(0.0, FV, PZ + 0.16, 2.96, 0.14, 0.12, "steel", top="steelL")                 # bridge
    for su in (-1, 1):
        k.box(su * 1.4, FV, PZ + 0.1, 0.22, 0.24, 0.14, "gm", top="steelL")             # its trucks
    bu = 0.25
    k.box(bu, FV, PZ - 0.02, 0.28, 0.28, 0.22, "gm", top="steelL", bevel=0.02)        # carriage
    k.box(bu, FV, 0.86, 0.07, 0.07, PZ - 0.86, "steelL")                             # the probe, lowered
    k.cyl(bu, FV, 0.72, 0.07, 0.14, "steelD", sides=8, rtop=0.02)
    k.box(bu, FV, 0.68, 0.03, 0.03, 0.04, W)
    bar(k, (-1.4, 0.9, PZ + 0.17), (-1.4, -0.7, PZ + 0.17), 0.06, "pcb")               # cable chain
    # the cradle on the deck: a skid on feet, two padded V blocks, orange clamps over the find
    for sv in (-1, 1):
        k.box(0.0, FV + sv * 0.18, 0.0, 1.5, 0.08, 0.12, "steelD", top="steel")
    for su in (-1, 1):
        k.box(su * 0.42, FV, 0.12, 0.18, 0.56, 0.16, "gm", top="dark")
        for sv in (-1, 1):
            k.box(su * 0.42, FV + sv * 0.24, 0.28, 0.14, 0.06, 0.24, "hivis", rx=-sv * 0.25)
    _find(k, 0.0, FV, 0.28, "resVio")
    # the control chair: joystick consoles on both armrests
    chair(k, "gm", "medRed")
    for su in (-1, 1):
        k.box(CU + su * 0.3, CV - 0.02, 0.4, 0.14, 0.34, 0.12, "steelD", top="dark")
        k.cyl(CU + su * 0.3, CV - 0.08, 0.52, 0.02, 0.1, "steelL", sides=6)
        k.cyl(CU + su * 0.3, CV - 0.08, 0.62, 0.04, 0.06, "black", top="medRed" if su < 0 else "hivis", sides=8)
    # spare probe heads on hooks up the front-left post
    for i, col in enumerate(("steelL", "hivis", "steelL")):
        z = 0.55 + i * 0.28
        k.box(-1.31, 0.9, z + 0.14, 0.06, 0.03, 0.03, "steelD")
        k.cyl(-1.24, 0.9, z, 0.05, 0.14, col, top="steelD", sides=8, rtop=0.02)
    return k.build()


def gantry_h_holo():
    """Measuring the find: a wire box round it, a dimension line with end ticks, a floating label."""
    k = K("research_h_holo", (3, 2), 0)
    W, F = "resScan", "resScanF"
    u0, u1, v0, v1, z0, z1 = -0.66, 0.66, FV - 0.26, FV + 0.26, 0.26, 0.6
    for v in (v0, v1):
        for z in (z0, z1):
            bar(k, (u0, v, z), (u1, v, z), 0.02, W)
    for u in (u0, u1):
        for z in (z0, z1):
            bar(k, (u, v0, z), (u, v1, z), 0.02, W)
        for v in (v0, v1):
            bar(k, (u, v, z0), (u, v, z1), 0.02, W)
    dv = v1 + 0.16
    bar(k, (u0, dv, z0), (u1, dv, z0), 0.02, W)
    for u in (u0, u1):
        bar(k, (u, dv - 0.05, z0), (u, dv + 0.05, z0), 0.02, W)
        bar(k, (u, v1, z0), (u, dv, z0), 0.015, F)
    _pane(k, -0.85, FV, 0.86, 0.38, 0.2, 0.2, W, F, ((0, 1, 0.22), (0, 0.5, 0.14), (1, 0.0, 0.1)))
    bar(k, (-0.7, FV, 0.86), (u0, FV, z1), 0.015, W)
    return k


# ---- i: the containment field ---------------------------------------------------------------------------------------

DV, DR, DH = -0.45, 0.5, 0.46     # the drum: centre v, radius, height


def _relic(k, u, v, z, glow):
    """The find: an angular dark shard, two plates turned against each other, glowing seams."""
    k.box(u, v, z, 0.22, 0.22, 0.4, "resRelicD", top="resRelic", rz=0.5, rx=0.25, ry=0.15, bevel=0.03)
    k.box(u + 0.04, v, z + 0.18, 0.16, 0.16, 0.24, "resRelic", top="resRelicL", rz=1.1, rx=-0.3, bevel=0.03,
          taper=0.4)
    k.box(u, v, z + 0.1, 0.235, 0.04, 0.04, glow, rz=0.5, rx=0.25, ry=0.15)
    k.box(u, v, z + 0.24, 0.04, 0.235, 0.04, glow, rz=0.5, rx=0.25, ry=0.15)


def field_i(layer):
    k = Bench(f"research_i_{layer}")
    V = "resVio"
    # the generator drum on six feet: brass bands, seams, a bezel, the projector well (brass coils, a lit core)
    for i in range(6):
        a = i * math.tau / 6
        k.cyl(DR * 0.8 * math.cos(a), DV + DR * 0.8 * math.sin(a), 0.0, 0.06, 0.06, "dark", sides=8)
    k.cyl(0.0, DV, 0.06, DR, DH - 0.06, "steelD", top="gm", sides=28)
    for z in (0.14, 0.32):
        k.cyl(0.0, DV, z, DR + 0.015, 0.04, "brass", sides=28)
    for i in range(12):
        a = i * math.tau / 12
        k.box(DR * math.cos(a), DV + DR * math.sin(a), 0.18, 0.02, 0.03, 0.14, "gmD", rz=a)
    k.cyl(0.0, DV, DH, DR - 0.04, 0.04, "steel", top="plate", sides=28)
    for r in (0.36, 0.26):
        ring(k, "z", 0.0, DV, DH + 0.04, r, 22, 0.05, 0.05, "brass")
    k.cyl(0.0, DV, DH + 0.04, 0.14, 0.04, "dark", top=V, sides=16)
    # two emitter arms off the drum's sides, up and over the find
    for su in (-1, 1):
        pts = [(su * 0.46, DV, DH - 0.1), (su * 0.72, DV, 0.95), (su * 0.6, DV, 1.4), (su * 0.3, DV, 1.55)]
        k.box(su * 0.5, DV, 0.12, 0.2, 0.26, DH - 0.1, "gm", top="steelL", bevel=0.02)   # the arm's root block
        for a, b in zip(pts, pts[1:]):
            bar(k, a, b, 0.15, "steel")
        for a, b in zip(pts[1:], pts[2:]):
            bar(k, a, b, 0.05, "hivis")
        tip = pts[-1]
        k.box(tip[0] - su * 0.02, DV, tip[2] - 0.16, 0.18, 0.18, 0.18, "gm", top="steelL", bevel=0.03)
        k.box(tip[0] - su * 0.1, DV, tip[2] - 0.2, 0.08, 0.1, 0.08, V)
    # capacitor banks in the back corners, cabled across the deck into the drum
    for su in (-1, 1):
        cu, cv = su * 1.16, -0.62
        k.box(cu, cv, 0.0, 0.56, 0.5, 0.12, "gmD", top="gm", bevel=0.02)
        for du, dv in ((-0.12, -0.1), (0.12, -0.1), (0.0, 0.12)):
            k.cyl(cu + du, cv + dv, 0.12, 0.11, 0.86, "steel", top="steelL", sides=14)
            for z in (0.3, 0.55, 0.8):
                k.cyl(cu + du, cv + dv, z, 0.115, 0.04, "brass", sides=14)
            k.cyl(cu + du, cv + dv, 0.98, 0.09, 0.05, "steelD", top="gm", sides=12)
            k.box(cu + du, cv + dv + 0.1, 0.62, 0.04, 0.03, 0.12, V)                     # charge pip
        bar(k, (cu - su * 0.28, cv + 0.05, 0.05), (su * DR, DV, 0.05), 0.1, "black")
    # the control rail: a slim curved lectern round the drum's front, a lit strip and gauges on it
    R = 0.66
    for i in range(7):
        th = math.radians(55 + i * 70 / 6)
        u, v = R * math.cos(th), DV + R * math.sin(th)
        k.box(u, v, 0.56, 0.18, 0.14, 0.06, "gm", top="steelL", rz=th + math.pi / 2, rx=-0.2)
        k.box(u, v + 0.005, 0.615, 0.12, 0.05, 0.02, V if i % 3 == 1 else "dark", rz=th + math.pi / 2)
        if i % 3 == 0:
            k.box(u, v, 0.0, 0.05, 0.05, 0.56, "steelD")
    _relic(k, 0.0, DV, 0.94, V)
    chair(k, "gm", "steelD")
    return k.build()


def field_i_holo():
    """The field: a translucent violet sphere of film slices round the find, bright bands, arcs from the emitters."""
    k = K("research_i_holo", (3, 2), 0)
    V, F = "resVio", "resVioF"
    cz, R = 1.08, 0.34
    n = 6
    for i in range(n):
        z0, z1 = -R + 2 * R * i / n, -R + 2 * R * (i + 1) / n
        r0, r1 = math.sqrt(max(R * R - z0 * z0, 0.0)), math.sqrt(max(R * R - z1 * z1, 0.0))
        k.cyl(0.0, DV, cz + z0, max(r0, 0.02), z1 - z0, F, top=F, sides=20, rtop=max(r1, 0.02))
    ring(k, "z", 0.0, DV, cz, R + 0.01, 24, 0.03, 0.025, V)
    ring(k, "u", 0.0, DV, cz, R + 0.01, 24, 0.02, 0.02, V)
    k.cyl(0.0, DV, DH + 0.08, 0.12, cz - R - DH - 0.06, F, rtop=0.06, sides=12)          # the column from the well
    for su in (-1, 1):
        pts = [(su * 0.24, DV, 1.37), (su * 0.2, DV + 0.05, 1.32), (su * 0.18, DV - 0.04, 1.27),
               (su * 0.12, DV + 0.03, 1.22), (su * 0.08, DV, 1.17)]
        for a, b in zip(pts, pts[1:]):
            bar(k, a, b, 0.025, V)
    return k


BUILD = {"g": (line_g, line_g_holo), "h": (gantry_h, gantry_h_holo), "i": (field_i, field_i_holo)}
