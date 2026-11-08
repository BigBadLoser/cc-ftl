"""Research bench look studies, round 3: g scanner arch, h gantry rig, i containment field.

  g  a sample line: capsules ride a conveyor along the back run from a feed magazine, through a scanner hoop, to an
     analysis tower; gold light; the hologram is the scan curtain in the hoop and the capsule enlarged over it
  h  a find on a cradle under an overhead gantry: rails on four posts, a bridge, a carriage lowering a probe onto it,
     work lights; joystick and tool-rack wings round the chair; the hologram measures it (a wire box, dimension lines,
     a label)
  i  a find held in a field: a projector disc in the bench, two emitter arms curving over it, the find floating
     between them; field gauges on the wings; the hologram is the violet field round it and the arcs that feed it"""
import math

from .modkit import K
from .research_kit import Bench, bar, body, chair, ring, slope_panel


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


# ---- g: the scanner arch ---------------------------------------------------------------------------------------------

def _capsule(k, u, v, z, core):
    k.cyl(u, v, z, 0.085, 0.04, "steelD", top="steel", sides=12)                    # puck
    k.part("glass").cyl(u, v, z + 0.04, 0.07, 0.2, "glassL", top="glassL", sides=12)
    k.cyl(u, v, z + 0.05, 0.045, 0.13, core, sides=10)
    k.cyl(u, v, z + 0.24, 0.075, 0.04, "steelL", top="steel", sides=12)              # cap


def arch_g(layer):
    k = Bench(f"research_g_{layer}")
    G, TOP = "resGold", 0.64
    body(k, 0.0, -0.52, 2.96, 0.88, TOP)
    for su in (-1, 1):
        body(k, su * 1.0, 0.36, 0.94, 0.86, 0.6, col="steelD")
        slope_panel(k, su * 1.0, 0.36, 0.56, 0.8, 0.74, su * 0.3, G)
    # the conveyor along the back run: a trough, side rails, rollers
    cv = -0.5
    k.box(0.0, cv, TOP, 2.8, 0.34, 0.05, "dark")
    for sv in (-1, 1):
        k.box(0.0, cv + sv * 0.17, TOP, 2.8, 0.04, 0.09, "steelL", top="plate")
    for i in range(14):
        k.box(-1.3 + i * 0.2, cv, TOP + 0.05, 0.05, 0.28, 0.02, "gm")
    # feed magazine at the left end: a tower with a window onto stacked capsules, feeding down onto the belt
    mu = -1.15
    k.box(mu, cv - 0.12, TOP + 0.1, 0.5, 0.5, 0.9, "steel", top="steelL", bevel=0.02)
    k.box(mu, cv + 0.135, TOP + 0.2, 0.3, 0.02, 0.62, "dark")
    for i in range(3):
        k.box(mu, cv + 0.15, TOP + 0.28 + i * 0.18, 0.2, 0.02, 0.12, G if i == 0 else "resGoldF")
    k.box(mu, cv - 0.12, TOP + 1.0, 0.56, 0.56, 0.06, "gm", top="plate")
    # the arch: an open hoop round the belt (axis along u) on two feet, gold-lit inner rims, a scan head on top
    az, ar = TOP + 0.4, 0.36
    ring(k, "u", 0.0, cv, az, ar, 20, 0.16, 0.1, "steel")
    for su in (-1, 1):
        ring(k, "u", su * 0.085, cv, az, ar - 0.06, 20, 0.02, 0.03, G)
    for sv in (-1, 1):
        k.box(0.0, cv + sv * 0.3, TOP, 0.22, 0.12, 0.14, "gm", top="steelL", bevel=0.02)
    k.box(0.0, cv, az + ar + 0.02, 0.2, 0.2, 0.12, "gm", top="steelL", bevel=0.02)
    k.box(0.0, cv + 0.105, az + ar + 0.05, 0.1, 0.02, 0.04, G)
    # the capsules on the belt: two waiting, one in the arch, one through
    for u, core in ((-0.72, "hivis"), (-0.42, "pcb"), (0.0, "resGold"), (0.46, "medRed")):
        _capsule(k, u, cv, TOP + 0.06, core)
    # analysis tower at the right end, a sloped readout toward the chair
    tu = 1.15
    k.box(tu, cv - 0.1, TOP, 0.56, 0.6, 0.62, "steel", top="plate", bevel=0.02)
    k.box(tu, cv + 0.05, TOP + 0.56, 0.56, 0.36, 0.2, "steel", top="plate", rx=0.45, bevel=0.02)
    k.box(tu, cv + 0.205, TOP + 0.12, 0.44, 0.02, 0.36, "dark")
    for i, w in enumerate((0.3, 0.18, 0.34, 0.22)):
        k.box(tu - 0.2 + w / 2, cv + 0.22, TOP + 0.16 + i * 0.075, w, 0.02, 0.035, G)
    bar(k, (1.38, -0.9, TOP + 0.4), (1.38, -0.9, 0.0), 0.07, "pcb")                  # cable down to the deck
    chair(k, "steelD", "navy")
    return k.build()


def arch_g_holo():
    k = K("research_g_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    cv, TOP = -0.5, 0.64
    k.box(0.0, cv, TOP + 0.08, 0.02, 0.42, 0.58, F)                                  # the scan curtain
    k.box(0.0, cv, TOP + 0.24, 0.03, 0.42, 0.03, G)                                  # its sweep line
    cz, R = 1.34, 0.17                                                              # the capsule, enlarged,
    k.cyl(0.0, cv, cz, R, 0.42, F, top=F, sides=20)                                 # over the arch
    k.cyl(0.0, cv, cz + 0.06, 0.09, 0.3, G, sides=14)                               # its core
    for z in (0.0, 0.14, 0.28, 0.42):
        ring(k, "z", 0.0, cv, cz + z, R + 0.01, 20, 0.02, 0.025, G)
    for su in (-1, 1):                                                              # the readout ticks off it
        for i in range(3):
            k.box(su * (R + 0.08 + 0.04 * i), cv, cz + 0.08 + i * 0.12, 0.08 + 0.04 * i, 0.02, 0.025, G)
    return k


# ---- h: the gantry rig -----------------------------------------------------------------------------------------------

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
    W, H = "resWork", 0.56
    # the specimen table: a heavy table with a grid top and the find on two cradles
    body(k, 0.0, -0.52, 2.96, 0.88, H, col="steelD", top="plate")
    for i in range(6):
        k.box(-1.25 + i * 0.5, -0.52, H, 0.03, 0.8, 0.012, "gm")
    for du in (-0.4, 0.4):
        k.box(du, -0.52, H, 0.16, 0.5, 0.1, "hivis", top="steelL", bevel=0.01)
    _find(k, 0.0, -0.52, H + 0.1, "resVio")
    # the gantry: four posts, two rails along u, a bridge across, a carriage with a probe down to the find
    PZ = 1.5
    for su in (-1, 1):
        for vv in (-0.9, -0.14):
            k.box(su * 1.38, vv, H, 0.12, 0.12, PZ - H, "steel", top="steelL")
            k.box(su * 1.38, vv, H, 0.18, 0.18, 0.06, "gmD")
    for vv in (-0.9, -0.14):
        k.box(0.0, vv, PZ, 2.88, 0.12, 0.12, "hivis", top="steelL")
        k.box(0.0, vv + (0.065 if vv > -0.5 else -0.065), PZ + 0.02, 2.6, 0.012, 0.06, "dark")
        k.box(0.0, vv - math.copysign(0.07, vv + 0.5), PZ - 0.03, 2.4, 0.03, 0.03, W)  # work light strip
    bu = 0.3
    k.box(bu, -0.52, PZ + 0.1, 0.16, 0.9, 0.12, "steel", top="steelL")               # bridge
    k.box(bu, -0.5, PZ - 0.04, 0.26, 0.26, 0.2, "gm", top="steelL", bevel=0.02)         # carriage
    k.box(bu, -0.5, H + 0.62, 0.07, 0.07, PZ - H - 0.66, "steelL")                     # probe shaft
    k.cyl(bu, -0.5, H + 0.5, 0.06, 0.12, "steelD", sides=8, rtop=0.02)
    k.box(bu, -0.5, H + 0.46, 0.03, 0.03, 0.04, W)
    bar(k, (bu + 0.13, -0.5, PZ + 0.1), (1.38, -0.9, PZ + 0.1), 0.05, "pcb")          # cable chain
    # wings: joysticks (left), a tool rack holding spare heads (right)
    for su in (-1, 1):
        body(k, su * 1.0, 0.36, 0.94, 0.86, 0.6, col="steelD")
    for du in (-0.18, 0.18):
        k.box(-1.0 + du, 0.3, 0.6, 0.16, 0.16, 0.04, "dark")
        k.cyl(-1.0 + du, 0.3, 0.64, 0.025, 0.14, "steelL", sides=6)
        k.cyl(-1.0 + du, 0.3, 0.78, 0.045, 0.07, "black", top="medRed" if du < 0 else "hivis", sides=8)
    k.box(-1.0, 0.6, 0.6, 0.5, 0.12, 0.03, "dark")
    k.box(-1.0, 0.6, 0.63, 0.3, 0.06, 0.012, W)
    k.box(1.0, 0.36, 0.6, 0.7, 0.5, 0.06, "gm", top="dark")
    for i, col in enumerate(("steelL", "hivis", "steelL")):
        k.cyl(0.8 + i * 0.2, 0.36, 0.62, 0.06, 0.16, col, top="steelD", sides=8, rtop=0.03)
    chair(k, "gm", "medRed")
    return k.build()


def gantry_h_holo():
    """Measuring the find: a wire box round it, dimension lines with end ticks, a floating label."""
    k = K("research_h_holo", (3, 2), 0)
    W, F = "resScan", "resScanF"
    u0, u1, v0, v1, z0, z1 = -0.66, 0.66, -0.78, -0.26, 0.66, 1.0
    for v in (v0, v1):
        for z in (z0, z1):
            bar(k, (u0, v, z), (u1, v, z), 0.02, W)
    for u in (u0, u1):
        for z in (z0, z1):
            bar(k, (u, v0, z), (u, v1, z), 0.02, W)
        for v in (v0, v1):
            bar(k, (u, v, z0), (u, v, z1), 0.02, W)
    dv = v1 + 0.16                                                                  # length along the front
    bar(k, (u0, dv, z0), (u1, dv, z0), 0.02, W)
    for u in (u0, u1):
        bar(k, (u, dv - 0.05, z0), (u, dv + 0.05, z0), 0.02, W)
        bar(k, (u, v1, z0), (u, dv, z0), 0.015, F)
    _pane(k, -0.95, -0.4, 1.12, 0.38, 0.2, 0.2, W, F, ((0, 1, 0.22), (0, 0.5, 0.14), (1, 0.0, 0.1)))
    bar(k, (-0.78, -0.45, 1.12), (u0, -0.5, z1), 0.015, W)
    return k


# ---- i: the containment field ----------------------------------------------------------------------------------------

def _relic(k, u, v, z, glow):
    """The find: an angular dark shard, two plates turned against each other, glowing seams."""
    k.box(u, v, z, 0.22, 0.22, 0.4, "resRelicD", top="resRelic", rz=0.5, rx=0.25, ry=0.15, bevel=0.03)
    k.box(u + 0.04, v, z + 0.18, 0.16, 0.16, 0.24, "resRelic", top="resRelicL", rz=1.1, rx=-0.3, bevel=0.03,
          taper=0.4)
    k.box(u, v, z + 0.1, 0.235, 0.04, 0.04, glow, rz=0.5, rx=0.25, ry=0.15)
    k.box(u, v, z + 0.24, 0.04, 0.235, 0.04, glow, rz=0.5, rx=0.25, ry=0.15)


def field_i(layer):
    k = Bench(f"research_i_{layer}")
    V, H = "resVio", 0.56
    body(k, 0.0, -0.52, 2.96, 0.88, H, col="gm", top="plate", panel="steelD")
    for su in (-1, 1):
        body(k, su * 1.0, 0.36, 0.94, 0.86, 0.6, col="gm", panel="steelD")
        slope_panel(k, su * 1.0, 0.36, 0.56, 0.8, 0.74, su * 0.3, V)
    # the projector disc set into the bench: coils round a lit well
    pv = -0.5
    k.cyl(0.0, pv, H, 0.46, 0.08, "steelD", top="gm", sides=24)
    for r in (0.4, 0.3):
        ring(k, "z", 0.0, pv, H + 0.08, r, 22, 0.05, 0.05, "brass")
    k.cyl(0.0, pv, H + 0.08, 0.18, 0.04, "dark", top=V, sides=16)
    # two emitter arms from the back corners curving up and in over the disc
    for su in (-1, 1):
        base = (su * 1.05, -0.62)
        k.box(*base, H, 0.4, 0.4, 0.14, "steelD", top="gm", bevel=0.02)
        pts = [(su * 1.05, -0.62, H + 0.1), (su * 1.0, -0.6, 1.2), (su * 0.78, -0.55, 1.55), (su * 0.42, -0.5, 1.62)]
        for a, b in zip(pts, pts[1:]):
            bar(k, a, b, 0.16, "steel")
        for a, b in zip(pts[1:], pts[2:]):
            bar(k, a, b, 0.06, "hivis")
        tip = pts[-1]
        k.box(tip[0] - su * 0.04, tip[1], tip[2] - 0.16, 0.18, 0.18, 0.18, "gm", top="steelL", bevel=0.03)
        k.box(tip[0] - su * 0.1, tip[1], tip[2] - 0.2, 0.08, 0.1, 0.08, V)               # its lit emitter
        for z in (0.75, 0.95):
            k.box(su * 1.05, -0.6, z, 0.2, 0.2, 0.04, "brass")
        bar(k, (su * 1.2, -0.85, H + 0.1), (su * 1.2, -0.9, 0.0), 0.08, "pcb")         # feed cable
    _relic(k, 0.0, pv, 0.98, V)
    chair(k, "gm", "steelD")
    return k.build()


def field_i_holo():
    """The field: a translucent violet sphere of film slices round the find, bright bands, arcs from the emitters."""
    k = K("research_i_holo", (3, 2), 0)
    V, F = "resVio", "resVioF"
    pv, cz, R = -0.5, 1.1, 0.36
    n = 6
    for i in range(n):
        z0, z1 = -R + 2 * R * i / n, -R + 2 * R * (i + 1) / n
        r0, r1 = math.sqrt(max(R * R - z0 * z0, 0.0)), math.sqrt(max(R * R - z1 * z1, 0.0))
        k.cyl(0.0, pv, cz + z0, max(r0, 0.02), z1 - z0, F, top=F, sides=20, rtop=max(r1, 0.02))
    ring(k, "z", 0.0, pv, cz, R + 0.01, 24, 0.03, 0.025, V)
    ring(k, "u", 0.0, pv, cz, R + 0.01, 24, 0.02, 0.02, V)
    k.cyl(0.0, pv, 0.68, 0.14, cz - R - 0.66, F, rtop=0.06, sides=12)                # the column up from the well
    for su in (-1, 1):                                                              # arcs from the emitters
        pts = [(su * 0.32, pv, 1.42), (su * 0.26, pv + 0.05, 1.34), (su * 0.24, pv - 0.04, 1.28),
               (su * 0.16, pv + 0.03, 1.24), (su * 0.12, pv, 1.18)]
        for a, b in zip(pts, pts[1:]):
            bar(k, a, b, 0.025, V)
    return k


BUILD = {"g": (arch_g, arch_g_holo), "h": (gantry_h, gantry_h_holo), "i": (field_i, field_i_holo)}
