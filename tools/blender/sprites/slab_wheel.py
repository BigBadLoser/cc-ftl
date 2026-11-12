"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): ten cassette slabs (1.6) round a core
on a 3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py; earlier
rounds in git history.

Round 15, after round 14's review (the pit idea is good; can the old detail come back?). Height is spent (canopy top
1.87, roof top 2.05; sinking deeper hides the near slabs' faces), so the detail goes where the pit freed room: the
canopy's top, the free corners, the floor round the mouth. Round 14's pit, wheel and two-tier canopy with lobes stay:

  s43  Geneva top (navy, orange): a ten-slot Geneva star on the canopy's top, mid-step, its driver and gearmotor
  s44  turntable (machine green, yellow): the rotor's crown proud through the canopy, a clamp ram over each slab,
       two tyre drives on the canopy pressing its rim; a pedestal console in the right corner
  s45  open hub (teal, orange): the canopy open in the middle, the hub with a clamp ram toward each slab, a chain drive
       to a motor hung off the canopy, a pendant controller on a coiled cord"""
import math

from .slab_kit import BACK, FRONT, NS, R0, angles, at, cassette, frame, hazard, links, loop, prism, ring, spring, tube
from .slab_study import L, beam

D = 0.55                                            # the pit's depth
RP = 1.47                                           # its mouth
Z0 = -0.34                                          # the slabs' feet (on the deck, down in the pit)
ZH = Z0 + L                                         # their heads
ZC = ZH + 0.06                                      # the canopy's underside
ZT = ZC + 0.55                                      # its top
LEFT, RIGHT = FRONT + math.pi / 2, FRONT - math.pi / 2
LR, LC = 0.32, 1.8                                  # a lobe's radius and its centre's distance out


def cup(k, s, col, lever="hazY"):
    """A bolted socket round the slab's foot cap."""
    s.box(k, -0.1, 0.12, -0.5, 0.5, -0.32, 0.1, col, face="steelL")
    for w in (-0.38, 0.38):
        s.box(k, -0.06, 0.0, w - 0.03, w + 0.03, 0.1, 0.12, "steel")
    s.box(k, -0.04, 0.08, -0.06, 0.06, 0.1, 0.125, lever)


def annulus(k, r0, r1, z0, z1, col, top=None, n=48):
    """A flat ring r0..r1 from z0 to z1, as n sector prisms."""
    for i in range(n):
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        prism(k, [at(r0, a0)[:2], at(r1, a0)[:2], at(r1, a1)[:2], at(r0, a1)[:2]], z0, z1, col, top=top)


# ---- the pit ------------------------------------------------------------------------------------------------------
def pit(k, deck, trim):
    """The well: a ribbed wall, the race and the rotor's deck with its ring gear, pinion drives at the back, a striped
    lip round the mouth."""
    k.cyl(0, 0, -D, RP, 0.02, "dark", sides=48)
    annulus(k, RP, RP + 0.06, -D, 0.0, "steelD", top="steel")
    for i in range(30):
        a = (i + 0.5) * math.tau / 30
        k.box(*at(RP - 0.012, a)[:2], -D, 0.05, 0.03, D - 0.04, "dark", rz=a + math.pi / 2)
    k.cyl(0, 0, -D + 0.02, 1.3, 0.06, "steelD", top="steel", sides=48)      # the race
    k.cyl(0, 0, -D + 0.08, 1.27, 0.015, "dark", sides=48)
    k.cyl(0, 0, Z0 - 0.13, 1.24, 0.11, deck, top="steelL", sides=48)       # the deck
    ring(k, 1.27, Z0 - 0.13, 0.1, 0.05, "steelL", n=72, skip=lambda i: i % 2)   # its ring gear
    ring(k, 1.2, Z0 - 0.02, 0.006, 0.05, "steelL", n=40, skip=lambda i: i % 2)  # index marks
    for a in (BACK, BACK + 1.1, BACK - 1.1):                                 # the pinion drives in the wall
        k.cyl(*at(1.36, a)[:2], Z0 - 0.15, 0.08, 0.14, "steelL", top="steel", sides=12)
        k.box(*at(1.44, a)[:2], -D + 0.02, 0.12, 0.36, 0.42, trim, rz=a)
        for dz in (0.1, 0.18, 0.26):
            k.box(*at(1.38, a)[:2], -D + 0.02 + dz, 0.012, 0.28, 0.03, "dark", rz=a)
    annulus(k, RP, RP + 0.11, 0.0, 0.05, "steelD", top="steel")             # the lip
    hazard(k, RP + 0.055, 0.05, w=0.08)


def wheel(k, body, trim):
    """The slabs on the deck, each in a foot socket and a head clamp to the canopy's head ring."""
    out = []
    for th in angles():
        s = cassette(k, frame(th, Z0))
        out.append(s)
        cup(k, s, body)
        s.box(k, L - 0.06, L + 0.08, -0.14, 0.14, -0.28, 0.08, body, face="steelD")   # the head clamp
        s.box(k, L - 0.03, L + 0.01, -0.14, 0.14, 0.08, 0.09, trim)
    ring(k, R0, ZH + 0.02, 0.06, 0.14, "steelD", top="steel")              # the head ring
    return out


# ---- the canopy and its lobes ---------------------------------------------------------------------------------------
TIERS = (  # (z from ZC, height, radius change, colour key, top key, radius change at the top)
    (0.0, 0.06, -0.18, "trim", None, 0.0),           # the chamfered underside
    (0.06, 0.22, 0.0, "body", None, None),           # the lower band
    (0.28, 0.05, 0.02, "trim", None, None),          # a proud trim band
    (0.33, 0.17, -0.04, "body", None, None),         # the upper band, set in
    (0.5, 0.05, -0.04, "trim", "body", -0.12),       # the chamfered top
)


def canopy(k, body, trim, lobes, hole=0.0):
    """The canopy tiers over the wheel (open to radius `hole` in the middle if set) and over each lobe at angle a,
    then the lobes' columns down to the floor."""
    col = {"body": body, "trim": trim}
    for z, h, dr, c, t, dtop in TIERS:
        z0 = ZC + z
        if hole:
            annulus(k, hole, 1.48 + dr, z0, z0 + h, col[c], top=col[t] if t else None)
        else:
            k.cyl(0, 0, z0, 1.48 + dr, h, col[c], top=col[t] if t else None, sides=48,
                  rtop=None if dtop is None else 1.48 + dr + dtop)
        for a in lobes:
            u, v, _ = at(LC, a)
            k.cyl(u, v, z0, LR + dr * 0.5, h, col[c], top=col[t] if t else None, sides=20,
                  rtop=None if dtop is None else LR + (dr + dtop) * 0.5)
            w = 2 * (LR + dr * 0.5) * 0.9                                    # the waist into the canopy: one outline
            m = at((1.2 + LC) / 2, a)
            k.box(m[0], m[1], z0, LC - 1.2, w, h if dtop is None else h * 0.5, col[c], top=col[t] if t else None,
                  rz=a)
    for a0, a1 in ((FRONT - 1.3, FRONT + 1.3),):                            # vents and lights on the lower band
        for i in range(16):
            a = a0 + (a1 - a0) * (i + 0.5) / 16
            for dz in (0.1, 0.16):
                k.box(*at(1.484, a)[:2], ZC + dz, 0.07, 0.012, 0.025, "dark", rz=a + math.pi / 2)
    ring(k, 1.485, ZC + 0.22, 0.025, 0.012, "slbCy", n=48, skip=lambda i: i % 3 == 0)
    for i in range(16):                                                      # seams on the upper band
        a = (i + 0.5) * math.tau / 16
        k.box(*at(1.444, a)[:2], ZC + 0.34, 0.022, 0.012, 0.15, "dark", rz=a + math.pi / 2)
    for a in lobes:                                                          # the lobes' columns
        u, v, _ = at(LC, a)
        k.cyl(u, v, 0.0, LR + 0.06, 0.08, "steelD", top="steel", sides=20)
        k.cyl(u, v, 0.08, LR - 0.03, ZC - 0.08, body, sides=20)
        k.cyl(u, v, 0.3, LR - 0.01, 0.06, trim, sides=20)
        for i in range(8):
            b = a + math.pi + (i - 3.5) * 0.35
            k.box(u + (LR - 0.026) * math.cos(b), v + (LR - 0.026) * math.sin(b), 0.4, 0.02, 0.012, ZC - 0.5, "dark",
                  rz=b + math.pi / 2)
        f = FRONT if abs(math.remainder(a - FRONT, math.tau)) > 0.1 else a  # the face toward the room
        fu, fv = u + (LR - 0.02) * math.cos(f), v + (LR - 0.02) * math.sin(f)
        k.box(fu, fv, 0.42, 0.26, 0.02, 0.62, "steelD", rz=f + math.pi / 2)   # a door
        k.box(fu + 0.012 * math.cos(f), fv + 0.012 * math.sin(f), 0.66, 0.06, 0.01, 0.1, trim, rz=f + math.pi / 2)
        k.box(fu + 0.01 * math.cos(f), fv + 0.01 * math.sin(f), 1.1, 0.2, 0.012, 0.12, "slbCy", rz=f + math.pi / 2)


# ---- what rides on top ----------------------------------------------------------------------------------------------
def bolt_ring(k, zt=ZT):
    ring(k, 1.1, zt, 0.006, 0.03, "dark", skip=lambda i: i % 6 == 0)
    for i in range(16):
        k.cyl(*at(1.24, i * math.tau / 16)[:2], zt, 0.025, 0.02, "steelL", sides=6)
    for i in range(10):                                                      # the top's panel seams
        a = (i + 0.25) * math.tau / 10
        beam(k, at(0.9, a, zt + 0.004), at(1.3, a)[:2], 0.018, 0.008, "dark")


def ram(k, a, r0, r1, z, body):
    """A hydraulic ram lying radially at angle a, r0 to r1: its barrel, rod and the two clevises."""
    m = r0 + (r1 - r0) * 0.6
    tube(k, at(r0, a, z), at(m, a, z), 0.032, body)
    tube(k, at(m, a, z), at(r1, a, z), 0.016, "steelL")
    for r, s in ((r0, 0.07), (r1, 0.05)):
        k.box(*at(r, a)[:2], z - 0.034, s, 0.08, 0.06, "steelD", top="steel", rz=a)


def geneva(k, ang, body, trim, z=ZT, rs=0.78, h=0.05):
    """A Geneva drive on the canopy's top, mid-step: a ten-slot star (one step a slab) on the rotor's shaft, its driver
    beside it with the pin down a slot and the locking disc's half away from the star, a gearmotor behind."""
    n = NS
    c = rs / math.cos(math.pi / n)                                           # the centres' distance
    cr = c * math.sin(math.pi / n)                                           # the crank
    rl = 0.2                                                                 # the locking arcs
    k.cyl(0, 0, z, rs - 0.1, 0.012, "dark", sides=32)
    for i in range(n):                                                       # the star's lobes
        m = ang + (i + 0.5) * math.tau / n

        def ro(b, m=m):
            phi = math.remainder(b - m, math.tau)
            s = c * math.sin(phi)
            return min(rs, c * math.cos(phi) - math.sqrt(rl * rl - s * s)) if abs(s) < rl else rs
        sl = 0.045 / rs
        a0, a1 = m - math.pi / n + sl, m + math.pi / n - sl
        for j in range(8):
            b0, b1 = a0 + (a1 - a0) * j / 8, a0 + (a1 - a0) * (j + 1) / 8
            prism(k, [at(0.5, b0)[:2], at(ro(b0), b0)[:2], at(ro(b1), b1)[:2], at(0.5, b1)[:2]], z, z + h,
                  "steel", top="steelL")
    k.cyl(0, 0, z, 0.52, h, "steel", top="steelL", sides=30)              # its boss and the shaft's cap
    k.cyl(0, 0, z + h, 0.24, 0.03, "steelD", top="steel", sides=16)
    k.cyl(0, 0, z + h + 0.03, 0.1, 0.02, trim, sides=12)
    for i in range(10):
        k.cyl(*at(0.38, (i + 0.5) * math.tau / 10 + ang)[:2], z + h, 0.025, 0.015, "steelD", sides=6)
    d = at(c, ang)
    k.cyl(d[0], d[1], z, 0.07, h + 0.05, "steel", sides=10)                 # the driver's shaft
    hp = [at(rl - 0.02, ang + math.pi / 2 + j * math.pi / 10) for j in range(11)]   # the locking disc's far half
    prism(k, [(d[0] + u, d[1] + v) for u, v, _ in hp], z, z + h, "steelL", top="steel")
    pin = at(c - cr, ang)
    beam(k, (d[0], d[1], z + h + 0.035), (pin[0], pin[1]), 0.08, 0.03, trim, top=trim)   # the crank
    k.cyl(pin[0], pin[1], z + 0.005, 0.032, h + 0.05, "steelL", sides=8)   # its pin, down the slot
    g = at(c + 0.3, ang)                                                     # the gearmotor
    k.box(g[0], g[1], z, 0.26, 0.4, 0.11, trim, top=body, rz=ang)
    t = ang + math.pi / 2
    e0 = (g[0] + 0.17 * math.cos(t), g[1] + 0.17 * math.sin(t), z + 0.06)
    e1 = (g[0] + 0.5 * math.cos(t), g[1] + 0.5 * math.sin(t), z + 0.06)
    tube(k, e0, e1, 0.065, body, sides=12)
    for j in range(4):
        f = 0.24 + j * 0.065
        tube(k, (g[0] + f * math.cos(t), g[1] + f * math.sin(t), z + 0.06),
             (g[0] + (f + 0.025) * math.cos(t), g[1] + (f + 0.025) * math.sin(t), z + 0.06), 0.08, "steelD", sides=12)
    beam(k, (d[0], d[1], z + h + 0.02), (g[0], g[1]), 0.06, 0.02, "steelD")


def top_tyres(k, a, r, house, guard, z=ZT):
    """A tyre drive on the canopy's top: two tyres pressing the turntable's rim (radius r), a slatted motor behind."""
    k.box(*at(r + 0.2, a)[:2], z, 0.36, 0.62, 0.02, "steelD", top="steel", rz=a)
    for da in (-0.17, 0.17):
        t = at(r + 0.12, a + da)
        k.cyl(t[0], t[1], z + 0.02, 0.12, 0.08, "black", top="slbGr", sides=16)
        k.cyl(t[0], t[1], z + 0.1, 0.05, 0.015, "steelL", sides=8)
    m = at(r + 0.34, a)
    k.box(m[0], m[1], z, 0.2, 0.42, 0.12, house, top=guard, rz=a)
    for dz in (0.03, 0.06, 0.09):
        k.box(*at(r + 0.445, a)[:2], z + dz, 0.012, 0.36, 0.014, "dark", rz=a)


def console(k, a, body, trim):
    """A pedestal console in a free corner, facing the room: a sloped screen, the cell selector (one lit), a key."""
    c = at(1.72, a)
    k.box(c[0], c[1], 0.0, 0.26, 0.4, 0.08, "steelD", top="steel", rz=FRONT)
    k.box(c[0], c[1], 0.08, 0.2, 0.34, 0.5, body, rz=FRONT)
    k.box(c[0], c[1], 0.58, 0.26, 0.4, 0.05, trim, rz=FRONT, ry=0.45)
    f = lambda t, z, su, sv, sz, col, ry=0.0: k.box(                         # noqa: E731
        c[0] + t * math.cos(FRONT), c[1] + t * math.sin(FRONT), z, su, sv, sz, col, rz=FRONT, ry=ry)
    f(0.105, 0.36, 0.012, 0.28, 0.16, "dark")                               # the screen
    f(0.11, 0.4, 0.006, 0.12, 0.09, "slbCy")
    f(0.11, 0.42, 0.006, 0.08, 0.03, "green")
    for j in range(NS):                                                      # the cell selector
        k.box(c[0] + 0.105 * math.cos(FRONT) + (j - 4.5) * 0.026 * math.cos(FRONT + math.pi / 2),
              c[1] + 0.105 * math.sin(FRONT) + (j - 4.5) * 0.026 * math.sin(FRONT + math.pi / 2), 0.24, 0.012, 0.018,
              0.03, "slbAmb" if j == 3 else "steelL", rz=FRONT)
    f(0.105, 0.14, 0.02, 0.06, 0.06, "hivis")                               # the release key
    tube(k, at(1.6, a, 0.03), at(1.5, a, 0.03), 0.03, "black")              # its conduit to the pit


def pendant(k, a, r_out, col):
    """A pendant controller hung from the canopy's rim on a coiled cord."""
    tp = at(r_out, a, ZC + 0.1)
    beam(k, at(1.4, a, ZC + 0.12), tp[:2], 0.05, 0.04, "steelD")
    spring(k, (tp[0], tp[1], ZC + 0.1), (tp[0], tp[1], 1.12), r=0.025, n=9, col="black")
    k.box(tp[0], tp[1], 0.86, 0.1, 0.08, 0.26, col, top="steelD", rz=FRONT)
    for j, cl in enumerate(("green", "hivis", "steelL")):
        k.box(tp[0] + 0.04 * math.cos(FRONT), tp[1] + 0.04 * math.sin(FRONT), 1.04 - j * 0.06, 0.012, 0.04, 0.03, cl,
              rz=FRONT)


# ---- the designs ----------------------------------------------------------------------------------------------------
def geneva_top(k):
    """s43."""
    pit(k, "navy", "hivis")
    out = wheel(k, "navy", "hivis")
    canopy(k, "navy", "hivis", [LEFT, RIGHT])
    bolt_ring(k)
    geneva(k, BACK + 0.55, "navy", "hivis")
    return out


def turntable(k):
    """s44."""
    pit(k, "slbMach", "hazY")
    out = wheel(k, "slbMach", "hazY")
    canopy(k, "slbMach", "hazY", [LEFT], hole=0.95)
    zt = ZT + 0.09                                                           # the rotor's crown, proud of the canopy
    k.cyl(0, 0, ZC, 0.92, zt - ZC, "steelD", top="steelL", sides=40)
    ring(k, 0.92, zt - 0.03, 0.03, 0.01, "hazY", n=40, skip=lambda i: i % 2)
    for th in angles():                                                      # a clamp ram over each slab
        ram(k, th, 0.3, 0.84, zt + 0.034, "hazY")
    k.cyl(0, 0, zt, 0.24, 0.03, "slbMach", top="hazY", sides=16)
    for a in (LEFT, BACK + 0.5):
        top_tyres(k, a, 0.92, "slbMach", "hazY")
    console(k, RIGHT, "slbMach", "hazY")
    return out


def open_hub(k):
    """s45."""
    body, trim = "slbTeal", "hivis"
    pit(k, body, trim)
    out = wheel(k, body, trim)
    canopy(k, body, trim, [LEFT, RIGHT], hole=0.72)
    zh = ZC + 0.26                                                           # the rotor's hub, down in the canopy's middle
    k.cyl(0, 0, ZH + 0.02, 0.68, zh - ZH - 0.02, "steelD", top="steel", sides=32)
    for th in angles():                                                      # a clamp ram toward each slab
        ram(k, th, 0.22, 0.6, zh + 0.034, trim)
    k.cyl(0, 0, zh, 0.15, 0.08, "steelL", top="steel", sides=16)           # its sprocket, the chain to a motor
    ring(k, 0.16, zh + 0.03, 0.03, 0.025, "steelL", n=16, skip=lambda i: i % 2)
    mc = at(0.5, RIGHT + 0.5)
    links(k, loop((0, 0), 0.16, mc, 0.08), zh + 0.05, closed=True, h=0.04, w=0.035, pitch=0.06)
    k.cyl(mc[0], mc[1], zh, 0.08, 0.1, "steelL", sides=10)
    k.cyl(mc[0], mc[1], zh + 0.1, 0.13, ZT - zh + 0.02, trim, top=body, sides=14)
    for dz in (0.2, 0.3, 0.4):
        k.cyl(mc[0], mc[1], zh + dz, 0.15, 0.025, "steelD", sides=14)
    beam(k, at(0.62, RIGHT + 0.5, ZT - 0.04), at(1.0, RIGHT + 0.5)[:2], 0.16, 0.08, "steelD", top="steel")
    pendant(k, LEFT - 0.45, 1.62, trim)
    return out


DESIGNS = {"s43": (geneva_top, (3, 3)), "s44": (turntable, (3, 3)), "s45": (open_hub, (3, 3))}
OVERLAYS = {}
PIT = {v: RP for v in DESIGNS}
