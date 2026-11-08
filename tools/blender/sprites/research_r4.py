"""Research bench look studies, round 4: each design gives the researcher a place to work (a work surface, input,
notes, readouts that leave the subject in view), built into the machine.

  g  electron microscope: a tall stepped column on a base cabinet, its sample loader at the chair's left hand; an L desk
     with two micrograph monitors, keyboard, trackball, a sample-holder rack and a notes slate; a vacuum gauge cabinet.
     Hologram: the sample's microstructure, enlarged, over the monitors
  h  gantry rig: the find raised in a clamp cradle under a gantry over the back row (the probe lowered onto it); a long
     workbench in front of the chair: joystick console, a low tilted readout, a tray of fragments taken off the find,
     a magnifier lamp, notes, spare probe heads racked at its end. Hologram: it measures the find
  i  containment field: one ring of machine round the field generator: a crescent housing at the back with the
     capacitor cells glowing in its inner face, flowing into a curved desk in front of the chair (keyboard, a
     spectrograph strip, notes, a sensor arm reaching into the field). Hologram: the field and its arcs"""
import math

from .modkit import K
from .research_kit import CU, CV, Bench, bar, body, chair, ring
from .research_r3 import _find, _pane, _relic


# ---- the work kit ---------------------------------------------------------------------------------------------------

def _rot(u, v, rz, du, dv):
    c, s = math.cos(rz), math.sin(rz)
    return u + c * du - s * dv, v + s * du + c * dv


def keyboard(k, u, v, z, rz=0.0, w=0.44):
    k.box(u, v, z, w, 0.15, 0.03, "dark", rz=rz)
    for i in range(3):
        ku, kv = _rot(u, v, rz, 0.0, -0.04 + i * 0.04)
        k.box(ku, kv, z + 0.03, w - 0.06, 0.025, 0.012, "steelD", rz=rz)


def slate(k, u, v, z, glow, rz=0.0, w=0.24, d=0.18):
    """A notes slate lying on the desk: a dark tablet, a few lit lines, a stylus."""
    k.box(u, v, z, w, d, 0.02, "gm", top="dark", rz=rz)
    for i, f in enumerate((0.7, 0.5, 0.6)):
        lu, lv = _rot(u, v, rz, -w * (1 - f) / 2 + 0.01, -d / 2 + 0.05 + i * 0.045)
        k.box(lu, lv, z + 0.02, w * f - 0.04, 0.02, 0.008, glow if i == 0 else "steelL", rz=rz)
    su, sv = _rot(u, v, rz, w / 2 + 0.05, 0.0)
    k.box(su, sv, z, 0.025, d * 0.9, 0.02, "steelL", rz=rz + 0.15)


def monitor(k, u, v, z, w, h, glow, rows, rz=0.0, lean=0.1):
    """A desk monitor facing +v (turned by rz): a stand, a bezel, dark glass, lit rows [(x 0..1, t 0..1, width)]."""
    k.box(u, v, z, 0.16, 0.12, 0.03, "gmD", rz=rz)
    su, sv = _rot(u, v, rz, 0.0, -0.03)
    k.box(su, sv, z, 0.05, 0.04, 0.2, "steelD", rz=rz)
    k.box(u, v, z + 0.16, w, 0.05, h, "steelD", top="gm", rz=rz, rx=lean)
    gu, gv = _rot(u, v, rz, 0.0, 0.027)
    k.box(gu, gv, z + 0.195, w - 0.07, 0.01, h - 0.07, "dark", rz=rz, rx=lean)
    hg = h - 0.07
    for x, t, bw in rows:
        bh = 0.035
        tz = 0.025 + t * (hg - 0.05 - bh)
        dv = 0.034 - (tz + bh / 2 - hg / 2) * math.sin(lean)
        cu_, cv_ = _rot(u, v, rz, -w / 2 + 0.06 + x * (w - 0.12 - bw) + bw / 2, dv)
        k.box(cu_, cv_, z + 0.195 + tz, bw, 0.01, bh, glow, rz=rz, rx=lean)


def lamp(k, u, v, z, glow, rz=0.0):
    """A magnifier lamp: a weighted foot, an elbowed arm, a ring head with its lens."""
    k.cyl(u, v, z, 0.07, 0.03, "gmD", top="gm", sides=10)
    a, b = (u, v, z + 0.03), _rot(u, v, rz, 0.0, -0.06)
    e = (b[0], b[1], z + 0.34)
    bar(k, a, e, 0.03, "steelL")
    hu, hv = _rot(u, v, rz, 0.0, 0.18)
    bar(k, e, (hu, hv, z + 0.3), 0.03, "steelL")
    k.cyl(hu, hv, z + 0.24, 0.085, 0.05, "gm", top="steelD", sides=14)
    k.cyl(hu, hv, z + 0.235, 0.065, 0.012, glow, sides=14)


# ---- g: the electron microscope -------------------------------------------------------------------------------------

def scope_g(layer):
    k = Bench(f"research_g_{layer}")
    G, H = "resGold", 0.64
    # the desk: the main run along the back (right of the column) and an L return at the front right
    body(k, 0.42, -0.52, 2.06, 0.86, H, col="steel", top="plate")
    body(k, 1.02, 0.36, 0.86, 0.9, H, col="steel", top="plate")
    k.box(0.42, -0.94, H, 2.06, 0.05, 0.1, "gm", top="steelL")                         # back lip
    # the column: a base cabinet, a stepped column with ring lights at the joints, the loader at the chair's hand
    cu, cv = -0.92, -0.5
    body(k, cu, cv, 1.0, 0.9, H, col="lvW2", top="lvW", panel="lvWS")
    steps = ((0.34, 0.3), (0.28, 0.26), (0.23, 0.24), (0.18, 0.2), (0.13, 0.12))
    z = H
    for i, (r, h) in enumerate(steps):
        k.cyl(cu, cv, z, r, h, "lvW2" if i % 2 == 0 else "lvW", top="lvW", sides=22)
        if i < len(steps) - 1:
            ring(k, "z", cu, cv, z + h - 0.02, r + 0.01, 20, 0.03, 0.03, G if i % 2 == 0 else "steelD")
        z += h
    k.cyl(cu, cv, z, 0.07, 0.08, "steelD", top="gm", sides=10)
    bar(k, (cu - 0.06, cv - 0.1, z + 0.04), (cu - 0.06, -0.95, z + 0.04), 0.06, "gm")       # cables to the wall
    bar(k, (cu + 0.08, cv - 0.25, H + 0.6), (cu + 0.08, -0.95, H + 0.6), 0.05, "pcb")
    k.box(cu + 0.15, cv + 0.36, H + 0.04, 0.3, 0.12, 0.2, "lvW2", top="lvW", bevel=0.02)   # the loader airlock,
    k.box(cu + 0.15, cv + 0.425, H + 0.08, 0.2, 0.02, 0.12, "steelD")                     # its hatch, its lamp
    k.box(cu + 0.15, cv + 0.43, H + 0.21, 0.08, 0.02, 0.025, G)
    k.box(cu + 0.15, cv + 0.44, H + 0.12, 0.1, 0.03, 0.025, "steelL")
    # the gauge cabinet at the front left: two vacuum dials and a pump, under the loader's reach
    gu, gv = -1.02, 0.32
    k.box(gu, gv, 0.0, 0.66, 0.5, 0.06, "dark")
    k.box(gu, gv, 0.06, 0.7, 0.54, 0.4, "lvW2", top="lvW", bevel=0.02)
    for du in (-0.16, 0.12):
        k.cyl(gu + du, gv + 0.05, 0.46, 0.1, 0.04, "steelD", top="lvW", sides=14)
        k.box(gu + du + 0.02, gv + 0.05, 0.5, 0.07, 0.015, 0.01, "medRed", rz=0.6)
    k.cyl(gu + 0.05, gv - 0.15, 0.46, 0.08, 0.16, "gm", top="steelL", sides=12)
    # the workplace: monitors on the back run, keyboard, trackball, sample holders, a notes slate on the return
    micro = [(0.1, 1.0, 0.16), (0.5, 0.75, 0.12), (0.2, 0.4, 0.2), (0.8, 0.2, 0.1), (0.9, 0.9, 0.14)]
    monitor(k, 0.12, -0.74, H, 0.6, 0.4, G, micro)
    monitor(k, 0.8, -0.72, H, 0.6, 0.4, G, [(0, 1, 0.4), (0, 0.66, 0.26), (0, 0.33, 0.34), (1, 0.0, 0.2)], rz=-0.25)
    keyboard(k, 0.05, -0.28, H)
    k.cyl(0.38, -0.28, H, 0.05, 0.03, "dark", top="steelD", sides=10)
    k.cyl(0.38, -0.28, H + 0.03, 0.03, 0.02, "hivis", sides=10)
    k.box(0.72, -0.3, H, 0.3, 0.16, 0.05, "gm", top="dark")                            # sample holder rack
    for i in range(4):
        k.cyl(0.6 + i * 0.08, -0.3, H + 0.05, 0.025, 0.05, "brass", top="steelL", sides=8)
    slate(k, 0.92, 0.3, H, G, rz=0.3)
    k.cyl(1.25, 0.52, H, 0.05, 0.12, "lvW", top="dark", sides=10)                       # a mug
    chair(k, "gm", "navy")
    return k.build()


def scope_g_holo():
    """The sample's microstructure enlarged over the monitors: a cluster of film cells with bright rims, a scale bar."""
    k = K("research_g_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    cu, cv, cz = 0.45, -0.7, 1.42
    cells = [(0.0, 0.0, 0.0, 0.14), (0.2, 0.05, 0.06, 0.11), (-0.18, 0.04, -0.04, 0.1), (0.08, -0.06, 0.2, 0.1),
             (-0.1, 0.0, 0.18, 0.08), (0.28, -0.02, -0.12, 0.08)]
    for du, dv, dz, r in cells:
        k.cyl(cu + du, cv + dv, cz + dz - r * 0.6, r, r * 1.2, F, top=F, sides=14, rtop=r * 0.7)
        ring(k, "v", cu + du, cv + dv, cz + dz, r, 14, 0.02, 0.02, G)
        k.cyl(cu + du, cv + dv + 0.02, cz + dz - 0.02, r * 0.3, 0.04, G, sides=8)
    bar(k, (cu - 0.3, cv, cz - 0.26), (cu + 0.1, cv, cz - 0.26), 0.02, G)
    for du in (-0.3, 0.1):
        bar(k, (cu + du, cv, cz - 0.3), (cu + du, cv, cz - 0.22), 0.02, G)
    return k


# ---- h: the gantry rig ----------------------------------------------------------------------------------------------

FV, FZ = -0.56, 0.74              # the find's v and the cradle top


def gantry_h(layer):
    k = Bench(f"research_h_{layer}")
    W, PZ = "resWork", 1.62
    # the gantry over the back row: four posts, yellow rails along u, a bridge across riding them, the carriage
    for su in (-1, 1):
        for vv in (-0.92, -0.18):
            k.box(su * 1.38, vv, 0.0, 0.22, 0.22, 0.05, "gmD", top="gm")
            k.box(su * 1.38, vv, 0.05, 0.12, 0.12, PZ - 0.05, "steel", top="steelL")
    for vv in (-0.92, -0.18):
        k.box(0.0, vv, PZ, 2.9, 0.14, 0.14, "hivis", top="steelL")
        k.box(0.0, vv + (0.075 if vv < -0.5 else -0.075), PZ - 0.02, 2.5, 0.02, 0.04, W)  # lights, facing in
    bu = 0.3
    k.box(bu, -0.55, PZ + 0.14, 0.16, 0.92, 0.12, "steel", top="steelL")
    k.box(bu, -0.55, PZ - 0.06, 0.26, 0.26, 0.22, "gm", top="steelL", bevel=0.02)
    k.box(bu, -0.55, FZ + 0.62, 0.06, 0.06, PZ - FZ - 0.66, "steelL")
    k.cyl(bu, -0.55, FZ + 0.48, 0.06, 0.14, "steelD", sides=8, rtop=0.02)
    k.box(bu, -0.55, FZ + 0.44, 0.03, 0.03, 0.04, W)
    bar(k, (-1.38, -0.92, PZ + 0.15), (bu - 0.1, -0.92, PZ + 0.15), 0.06, "pcb")          # cable chain
    # the cradle: a raised skid on legs, padded V blocks, orange clamps; the find on it
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * 0.62, FV + sv * 0.2, 0.0, 0.08, 0.08, FZ - 0.16, "steelD")
    k.box(0.0, FV, FZ - 0.16, 1.4, 0.5, 0.08, "gm", top="steel")
    for su in (-1, 1):
        k.box(su * 0.42, FV, FZ - 0.08, 0.18, 0.5, 0.08, "dark")
        for sv in (-1, 1):
            k.box(su * 0.42, FV + sv * 0.24, FZ - 0.06, 0.14, 0.06, 0.26, "hivis", rx=-sv * 0.25)
    _find(k, 0.0, FV, FZ, "resVio")
    # the workbench in front of the chair: a steel top on legs, a shelf under it
    bv, bw, bd, BH = 0.06, 2.5, 0.42, 0.62
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * (bw / 2 - 0.06), bv + sv * (bd / 2 - 0.05), 0.0, 0.06, 0.06, BH - 0.04, "steelD")
    k.box(0.0, bv, 0.14, bw - 0.1, bd - 0.06, 0.03, "gm", top="steelD")
    for i, (u, col) in enumerate(((-0.9, "lvW2"), (-0.62, "polyB"), (0.75, "lvW2"))):    # bins on the shelf
        k.box(u, bv, 0.17, 0.24, 0.3, 0.14, col, top=col, bevel=0.01)
    k.box(0.0, bv, BH - 0.04, bw, bd, 0.04, "steel", top="plate", bevel=0.01)
    # on it: joystick console at the chair, the readout tilted low, fragments in a tray, the lamp, notes, heads
    k.box(0.0, bv + 0.08, BH, 0.5, 0.18, 0.05, "gm", top="dark")
    for su in (-1, 1):
        k.cyl(su * 0.14, bv + 0.08, BH + 0.05, 0.02, 0.09, "steelL", sides=6)
        k.cyl(su * 0.14, bv + 0.08, BH + 0.14, 0.035, 0.05, "black", top="medRed" if su < 0 else "hivis", sides=8)
    k.box(0.0, bv - 0.1, BH, 0.6, 0.16, 0.05, "steelD", top="gm", rx=0.5)                  # the low readout
    k.box(0.0, bv - 0.085, BH + 0.035, 0.52, 0.1, 0.012, "dark", rx=0.5)
    for i, w in enumerate((0.4, 0.26)):
        k.box(-0.24 + w / 2, bv - 0.085 + i * 0.035, BH + 0.045 + i * 0.015, w, 0.02, 0.01, W, rx=0.5)
    k.box(0.62, bv, BH, 0.34, 0.24, 0.04, "steelD", top="dark")                         # fragment tray
    for (du, dv, s) in ((-0.08, -0.04, 0.07), (0.05, 0.05, 0.05), (0.09, -0.05, 0.06)):
        k.box(0.62 + du, bv + dv, BH + 0.04, s, s, s * 0.6, "resRelic", top="resRelicL", rz=du * 9)
    lamp(k, 0.9, bv - 0.1, BH, W, rz=0.0)
    slate(k, -0.62, bv + 0.02, BH, W, rz=-0.2)
    for i, col in enumerate(("steelL", "hivis", "steelL")):                            # spare probe heads
        k.box(-1.0 + i * 0.12, bv - 0.08, BH, 0.08, 0.08, 0.04, "gmD")
        k.cyl(-1.0 + i * 0.12, bv - 0.08, BH + 0.04, 0.04, 0.12, col, top="steelD", sides=8, rtop=0.02)
    chair(k, "gm", "medRed")
    return k.build()


def gantry_h_holo():
    """Measuring the find: a wire box round it, a dimension line along its front, a label off its end."""
    k = K("research_h_holo", (3, 2), 0)
    W, F = "resScan", "resScanF"
    u0, u1, v0, v1, z0, z1 = -0.66, 0.66, FV - 0.25, FV + 0.25, FZ - 0.02, FZ + 0.36
    for v in (v0, v1):
        for z in (z0, z1):
            bar(k, (u0, v, z), (u1, v, z), 0.02, W)
    for u in (u0, u1):
        for z in (z0, z1):
            bar(k, (u, v0, z), (u, v1, z), 0.02, W)
        for v in (v0, v1):
            bar(k, (u, v, z0), (u, v, z1), 0.02, W)
    for u in (u0, u1):
        bar(k, (u, v1, z1), (u, v1, z1 + 0.14), 0.015, W)
    bar(k, (u0, v1, z1 + 0.1), (u1, v1, z1 + 0.1), 0.02, W)
    _pane(k, -0.95, FV + 0.05, z1 + 0.08, 0.34, 0.18, 0.2, W, F, ((0, 1, 0.2), (0, 0.5, 0.12), (1, 0.0, 0.08)))
    bar(k, (-0.8, FV + 0.05, z1 + 0.1), (u0, FV, z1), 0.015, W)
    return k


# ---- i: the containment field ---------------------------------------------------------------------------------------

EC, EA = (0.0, -0.4), 1.28        # the ring's centre and its half-width along u


def _arc(k, b, th0, th1, n, depth, h, col, top, z=0.0):
    """Boxes round the ring (semi-axes EA along u, b along v) from th0 to th1 (degrees): their centres and turns."""
    out = []
    for i in range(n):
        t0 = math.radians(th0 + (th1 - th0) * i / n)
        t1 = math.radians(th0 + (th1 - th0) * (i + 1) / n)
        p0 = (EC[0] + EA * math.cos(t0), EC[1] + b * math.sin(t0))
        p1 = (EC[0] + EA * math.cos(t1), EC[1] + b * math.sin(t1))
        u, v = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        rz = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.03
        k.box(u, v, z, L, depth, h, col, top=top, rz=rz)
        out.append((u, v, rz, L))
    return out


def field_i(layer):
    k = Bench(f"research_i_{layer}")
    V, DH = "resVio", 0.4
    cu, cv = EC
    # the back crescent: the machine housing, capacitor cells glowing in its inner face, brass coils along its top
    segs = _arc(k, 0.5, 190, 350, 8, 0.4, 0.76, "steelD", "gm")
    _arc(k, 0.41, 190, 350, 8, 0.05, 0.04, "brass", "brass", z=0.76)
    for i, (u, v, rz, L) in enumerate(segs):
        iu, iv = u - 0.21 * math.sin(rz), v + 0.21 * math.cos(rz)                       # (the inner face)
        k.box(iu, iv, 0.24, L * 0.6, 0.02, 0.44, "dark", rz=rz)
        for j in range(3):
            k.box(iu, iv, 0.3 + j * 0.13, L * 0.5, 0.03, 0.05, V if (i + j) % 2 == 0 else "resVioF", rz=rz)
    # the sides come down to desk height and run on round the front as the desk
    _arc(k, 0.5, 160, 190, 2, 0.4, 0.62, "steelD", "gm")
    _arc(k, 0.5, 350, 380, 2, 0.4, 0.62, "steelD", "gm")
    _arc(k, 0.53, 22, 158, 9, 0.26, 0.07, "dark", "dark")
    _arc(k, 0.56, 22, 158, 9, 0.32, 0.55, "steel", "plate", z=0.07)
    _arc(k, 0.575, 30, 150, 8, 0.31, 0.3, "plateB", "plate", z=0.15)
    _arc(k, 0.56, 22, 158, 9, 0.36, 0.03, "gm", "plate", z=0.6)
    # the generator drum in the middle, its well, the arms over the find
    k.cyl(cu, cv, 0.0, 0.42, DH, "steelD", top="gm", sides=28)
    k.cyl(cu, cv, 0.12, 0.43, 0.04, "brass", sides=28)
    k.cyl(cu, cv, DH, 0.38, 0.04, "steel", top="plate", sides=28)
    for r in (0.3, 0.21):
        ring(k, "z", cu, cv, DH + 0.04, r, 22, 0.05, 0.05, "brass")
    k.cyl(cu, cv, DH + 0.04, 0.12, 0.04, "dark", top=V, sides=16)
    for su in (-1, 1):
        pts = [(su * 0.38, cv, DH - 0.1), (su * 0.62, cv, 0.95), (su * 0.52, cv, 1.38), (su * 0.26, cv, 1.5)]
        k.box(su * 0.42, cv, 0.08, 0.18, 0.24, DH - 0.06, "gm", top="steelL", bevel=0.02)
        for a, b in zip(pts, pts[1:]):
            bar(k, a, b, 0.14, "steel")
        for a, b in zip(pts[1:], pts[2:]):
            bar(k, a, b, 0.05, "hivis")
        tip = pts[-1]
        k.box(tip[0] - su * 0.02, cv, tip[2] - 0.16, 0.17, 0.17, 0.17, "gm", top="steelL", bevel=0.03)
        k.box(tip[0] - su * 0.09, cv, tip[2] - 0.2, 0.08, 0.1, 0.08, V)
    _relic(k, cu, cv, 0.86, V)
    # the work on the desk: keyboard before the chair, a spectrograph strip, notes, the sensor arm into the field
    keyboard(k, 0.0, 0.12, 0.62)
    k.box(-0.62, 0.0, 0.62, 0.36, 0.14, 0.04, "gm", top="dark", rz=0.45)
    for i, w in enumerate((0.28, 0.18, 0.24)):
        k.box(-0.62 - 0.02 * i, 0.0 + 0.01 * i, 0.66, w, 0.02, 0.01, V if i != 1 else "resScan", rz=0.45)
    slate(k, 0.6, 0.04, 0.62, V, rz=-0.45)
    k.cyl(0.95, -0.14, 0.62, 0.07, 0.05, "gmD", top="gm", sides=10)                       # sensor arm base
    bar(k, (0.95, -0.14, 0.67), (0.75, -0.26, 1.02), 0.04, "steelL")
    bar(k, (0.75, -0.26, 1.02), (0.36, -0.36, 0.98), 0.035, "steelL")
    k.cyl(0.32, -0.37, 0.93, 0.04, 0.08, "gm", top=V, sides=8)
    chair(k, "gm", "steelD")
    return k.build()


def field_i_holo():
    """The field round the find and its arcs."""
    k = K("research_i_holo", (3, 2), 0)
    V, F = "resVio", "resVioF"
    cu, cv = EC
    cz, R = 1.0, 0.32
    n = 6
    for i in range(n):
        z0, z1 = -R + 2 * R * i / n, -R + 2 * R * (i + 1) / n
        r0, r1 = math.sqrt(max(R * R - z0 * z0, 0.0)), math.sqrt(max(R * R - z1 * z1, 0.0))
        k.cyl(cu, cv, cz + z0, max(r0, 0.02), z1 - z0, F, top=F, sides=20, rtop=max(r1, 0.02))
    ring(k, "z", cu, cv, cz, R + 0.01, 24, 0.03, 0.025, V)
    ring(k, "u", cu, cv, cz, R + 0.01, 24, 0.02, 0.02, V)
    k.cyl(cu, cv, 0.48, 0.1, cz - R - 0.46, F, rtop=0.05, sides=12)
    for su in (-1, 1):
        pts = [(su * 0.22, cv, 1.33), (su * 0.18, cv + 0.05, 1.28), (su * 0.16, cv - 0.04, 1.23),
               (su * 0.1, cv + 0.03, 1.18), (su * 0.07, cv, 1.13)]
        for a, b in zip(pts, pts[1:]):
            bar(k, a, b, 0.025, V)
    return k


BUILD = {"g": (scope_g, scope_g_holo), "h": (gantry_h, gantry_h_holo), "i": (field_i, field_i_holo)}
