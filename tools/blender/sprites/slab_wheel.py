"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): ten cassette slabs (1.6) round a core
on a 3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py; earlier
rounds in git history.

Round 17, after round 16's review (the Geneva tops' rim detail, lines and bolts, is liked; sink part of the top,
the Geneva kept on top, the tyre wheels down in the lower part; the wrap's control panel further round to the front,
the opening asymmetric). All three on the wrap: the housing's skin, flush with the canopy, open at the front from the
right jamb (near the front) round to the left; the canopy's middle sunk into a well, its rim seamed and bolted:

  s49  Geneva over tyres (navy, orange): the star on the rotor's boss at rim height, its driver on a bridge from the
       rim; three tyre drives in the well turning the rotor's crown
  s50  Geneva well (teal, yellow): the whole Geneva drive down in a shallow well
  s51  crown well (machine green, yellow): the crown with its clamp rams and two tyre drives down in the well"""
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
    (0.0, 0.06, -0.18, "low", None, 0.0),            # the chamfered underside
    (0.06, 0.22, 0.0, "low", None, None),            # the lower band (the machinery's: vents, lights)
    (0.28, 0.05, 0.02, "trim", None, None),          # a proud trim band
    (0.33, 0.17, -0.04, "body", None, None),         # the upper band, set in
    (0.5, 0.05, -0.04, "trim", "top", -0.12),        # the chamfered top
)


def canopy(k, body, trim, lobes, hole=0.0, low=None, top=None):
    """The canopy tiers over the wheel (open to radius `hole` in the middle if set) and over each lobe at angle a,
    then the lobes' columns down to the floor."""
    col = {"body": body, "trim": trim, "low": low or body, "top": top or body}
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
        for i in range(8):
            a = a0 + (a1 - a0) * (i + 0.5) / 8
            for dz in (0.09, 0.16):
                k.box(*at(1.484, a)[:2], ZC + dz, 0.16, 0.012, 0.04, "dark", rz=a + math.pi / 2)
    ring(k, 1.485, ZC + 0.225, 0.04, 0.012, "slbCy", n=24, skip=lambda i: i % 3 == 0)
    for i in range(10):                                                      # seams on the upper band
        a = (i + 0.5) * math.tau / 10
        k.box(*at(1.444, a)[:2], ZC + 0.33, 0.05, 0.012, 0.225, "dark", rz=a + math.pi / 2)   # up over the top tier
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
def bolt_ring(k, zt=ZT, r_in=0.85):
    """The rim's panel seams and a bolt between each pair (sized to read: lines two pixels wide, no dashes)."""
    for i in range(10):
        a = (i + 0.5) * math.tau / 10                # on the same lines as the band's seams, out to the edge
        beam(k, at(r_in + 0.06, a, zt + 0.004), at(1.445, a)[:2], 0.06, 0.008, "dark")
        k.cyl(*at(1.22, a + math.pi / 10)[:2], zt, 0.045, 0.025, "steelL", top="steel", sides=8)


def ram(k, a, r0, r1, z, body):
    """A hydraulic ram lying radially at angle a, r0 to r1: its barrel, rod and the two clevises."""
    m = r0 + (r1 - r0) * 0.6
    tube(k, at(r0, a, z), at(m, a, z), 0.032, body)
    tube(k, at(m, a, z), at(r1, a, z), 0.016, "steelL")
    for r, s in ((r0, 0.07), (r1, 0.05)):
        k.box(*at(r, a)[:2], z - 0.034, s, 0.08, 0.06, "steelD", top="steel", rz=a)


def geneva(k, ang, body, trim, z=ZT, rs=0.78, h=0.05, bridge=None, pad=True, star=("steelD", "steelL")):
    """A Geneva drive on the canopy's top, mid-step: a ten-slot star (one step a slab) on the rotor's shaft, its driver
    beside it with the pin down a slot and the locking disc's half away from the star, a gearmotor behind."""
    n = NS
    c = rs / math.cos(math.pi / n)                                           # the centres' distance
    cr = c * math.sin(math.pi / n)                                           # the crank
    rl = 0.256 * rs                                                          # the locking arcs
    if pad:
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
            prism(k, [at(0.64 * rs, b0)[:2], at(ro(b0), b0)[:2], at(ro(b1), b1)[:2], at(0.64 * rs, b1)[:2]], z, z + h,
                  star[0], top=star[1])
    k.cyl(0, 0, z, 0.667 * rs, h, star[0], top=star[1], sides=30)              # its boss and the shaft's cap
    for i in range(10):                                                      # the boss's bolts
        k.cyl(*at(0.49 * rs, (i + 0.5) * math.tau / 10 + ang)[:2], z + h, 0.03, 0.015, "steelD", sides=6)
    k.cyl(0, 0, z + h, 0.31 * rs, 0.03, "steelD", top="steel", sides=16)
    k.cyl(0, 0, z + h + 0.03, 0.1, 0.02, trim, sides=12)
    d = at(c, ang)
    k.cyl(d[0], d[1], z, 0.07, h + 0.05, "steel", sides=10)                 # the driver's shaft
    hp = [at(rl - 0.02, ang + math.pi / 2 + j * math.pi / 10) for j in range(11)]   # the locking disc's far half
    prism(k, [(d[0] + u, d[1] + v) for u, v, _ in hp], z, z + h, "steelL", top="steel")
    pin = at(c - cr, ang)
    beam(k, (d[0], d[1], z + h + 0.035), (pin[0], pin[1]), 0.08, 0.03, trim, top=trim)   # the crank
    k.cyl(pin[0], pin[1], z + 0.005, 0.032, h + 0.05, "steelL", sides=8)   # its pin, down the slot
    g = at(c + 0.3, ang)                                                     # the gearmotor
    k.box(g[0], g[1], z, 0.26, 0.4, 0.11, trim, top=trim, rz=ang)
    t = ang + math.pi / 2
    e0 = (g[0] + 0.17 * math.cos(t), g[1] + 0.17 * math.sin(t), z + 0.06)
    e1 = (g[0] + 0.5 * math.cos(t), g[1] + 0.5 * math.sin(t), z + 0.06)
    tube(k, e0, e1, 0.065, "steelD", sides=12)
    for j in range(2):
        f = 0.27 + j * 0.12
        tube(k, (g[0] + f * math.cos(t), g[1] + f * math.sin(t), z + 0.06),
             (g[0] + (f + 0.05) * math.cos(t), g[1] + (f + 0.05) * math.sin(t), z + 0.06), 0.085, "steelD", sides=12)
    beam(k, (d[0], d[1], z + h + 0.02), (g[0], g[1]), 0.06, 0.02, "steelD")
    if bridge:                                       # the driver's frame, a bridge out to the rim it stands on
        beam(k, at(c - 0.1, ang, z - 0.03), at(bridge, ang)[:2], 0.4, 0.06, "steelD", top="steel")


def top_tyres(k, a, r, house, guard, z=ZT):
    """A tyre drive on the canopy's top: two tyres pressing the turntable's rim (radius r), a slatted motor behind."""
    k.box(*at(r + 0.2, a)[:2], z, 0.36, 0.62, 0.02, "steelD", top="steel", rz=a)
    for da in (-0.17, 0.17):
        t = at(r + 0.12, a + da)
        k.cyl(t[0], t[1], z + 0.02, 0.12, 0.08, "black", top="slbGr", sides=16)
        k.cyl(t[0], t[1], z + 0.1, 0.05, 0.015, "steelL", sides=8)
    m = at(r + 0.34, a)
    k.box(m[0], m[1], z, 0.2, 0.42, 0.12, house, top=guard, rz=a)
    for dz in (0.03, 0.075):
        k.box(*at(r + 0.445, a)[:2], z + dz, 0.012, 0.32, 0.03, "dark", rz=a)


def pendant(k, a, r_out, col):
    """A pendant controller hung from the canopy's rim on a coiled cord."""
    tp = at(r_out, a, ZC + 0.1)
    beam(k, at(1.4, a, ZC + 0.12), tp[:2], 0.05, 0.04, "steelD")
    spring(k, (tp[0], tp[1], ZC + 0.1), (tp[0], tp[1], 1.12), r=0.025, n=9, col="black")
    k.box(tp[0], tp[1], 0.86, 0.1, 0.08, 0.26, col, top="steelD", rz=FRONT)
    for j, cl in enumerate(("green", "hivis", "steelL")):
        k.box(tp[0] + 0.04 * math.cos(FRONT), tp[1] + 0.04 * math.sin(FRONT), 1.04 - j * 0.06, 0.012, 0.04, 0.03, cl,
              rz=FRONT)


# ---- the body: curved to the canopy's own outline ---------------------------------------------------------------------
def arc_wall(k, a0, a1, r0, r1, z0, z1, col, top=None):
    n = max(1, round((a1 - a0) / (math.tau / 64)))
    for i in range(n):
        b0, b1 = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        prism(k, [at(r0, b0)[:2], at(r1, b0)[:2], at(r1, b1)[:2], at(r0, b1)[:2]], z0, z1, col, top=top)


def skin(k, a0, a1, body, trim, z1=ZC + 0.06):
    """A wall panel of the housing from angle a0 to a1 (counter-clockwise), flush with the canopy's band: a steel
    kick skirt, a trim band, panel seams, vent grilles low, a broken status strip high."""
    arc_wall(k, a0, a1, 1.46, 1.48, 0.0, z1, body)
    arc_wall(k, a0, a1, 1.46, 1.505, 0.0, 0.09, "steelD", top="steel")
    arc_wall(k, a0, a1, 1.46, 1.495, 0.3, 0.35, trim)
    n = max(1, round((a1 - a0) / 0.36))
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        k.box(*at(1.482, a)[:2], 0.35, 0.012, 0.045, ZC - 0.37, "dark", rz=a)
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        for dz in (0.13, 0.2):
            k.box(*at(1.482, a)[:2], dz, 0.012, 0.24, 0.04, "dark", rz=a)
        k.box(*at(1.483, a)[:2], ZC - 0.17, 0.01, 0.16, 0.045, "slbCy" if i % 3 else "green", rz=a)


def jamb(k, a, body, trim, screen=False):
    """A housing edge, rounded: a post of the skin's own thickness, capped, a screen on it if asked."""
    k.cyl(*at(1.47, a)[:2], 0.0, 0.055, ZC + 0.06, body, sides=12)
    k.cyl(*at(1.47, a)[:2], 0.0, 0.065, 0.09, "steelD", top="steel", sides=12)
    k.cyl(*at(1.47, a)[:2], 0.3, 0.065, 0.05, trim, sides=12)
    if screen:
        k.box(*at(1.52, a)[:2], 0.7, 0.012, 0.09, 0.3, "dark", rz=a)
        k.box(*at(1.527, a)[:2], 0.78, 0.006, 0.06, 0.16, "slbCy", rz=a)


def panel(k, a, body, trim):
    """The control face set into the housing's wall: a framed screen, the cell selector (one lit), the release key."""
    c = lambda r, t, z, sr, st, sz, col: k.box(                              # noqa: E731
        at(r, a)[0] - math.sin(a) * t, at(r, a)[1] + math.cos(a) * t, z, sr, st, sz, col, rz=a)
    c(1.49, 0.0, 0.42, 0.03, 0.46, 0.56, trim)
    c(1.505, 0.0, 0.62, 0.012, 0.36, 0.26, "dark")
    c(1.51, -0.06, 0.66, 0.006, 0.16, 0.14, "slbCy")
    c(1.51, 0.1, 0.7, 0.006, 0.1, 0.04, "green")
    for j in range(5):
        c(1.505, (j - 2) * 0.07 - 0.04, 0.48, 0.012, 0.05, 0.05, "slbAmb" if j == 1 else "steelL")
    c(1.51, 0.16, 0.44, 0.02, 0.06, 0.05, "hivis")


def sunk_top(k, rh, depth, body, trim):
    """The canopy's middle sunk `depth` below its rim (radius rh): a steel well floor, the lip in trim, the well's
    wall seamed; the rim keeps its lines and bolts."""
    zf = ZT - depth
    k.cyl(0, 0, ZC + 0.06, rh + 0.01, zf - ZC - 0.06, "steelD", top="slbGr", sides=48)
    annulus(k, rh, rh + 0.06, ZT, ZT + 0.01, trim)
    for i in range(10):
        a = (i + 0.5) * math.tau / 10                # its seams on the rim seams' lines
        k.box(*at(rh + 0.004, a)[:2], zf, 0.012, 0.05, depth, "dark", rz=a)
    bolt_ring(k, r_in=rh)
    return zf


def wrap(k, body, trim, open_l, open_r):
    """The housing all round but a front window from FRONT - open_r to FRONT + open_l, the control panel set into
    the wall just round from its right jamb, toward the front."""
    pit(k, body, trim)
    out = wheel(k, body, trim)
    skin(k, FRONT + open_l, FRONT + math.tau - open_r, body, trim)
    jamb(k, FRONT + open_l, body, trim)
    jamb(k, FRONT - open_r, body, trim)
    panel(k, FRONT - open_r - 0.27, body, trim)
    return out


# ---- the designs ----------------------------------------------------------------------------------------------------
def scheme(body, trim):
    """The old two-colour paint as a role map."""
    return dict(wall=body, cap=body, band=body, stripe=trim, lip=trim, guard=trim, guard_top=trim, panel=trim,
                crown="steelL", star=("steelD", "steelL"), deck=body, clamp=body, accent=trim)


# Paint by role (round 18): housing paint (wall, cap: one colour, the module's identity); the machinery band (band: the
# canopy's lower band and underside, where vents and lights sit: darker, a break between wall and cap); one accent
# (stripe, lip, panel, accent); safety yellow on guards over moving parts (guard); bare steel on everything that turns
# (crown, star, deck, clamp: lighter the higher it sits); cyan stays the stasis field's alone.
SCHEMES = {
    "s49a": dict(wall="slbHull", cap="slbHull", band="steelD", stripe="steel", lip="hazY", guard="hazY",
                 guard_top="hazY", panel="hazY", crown="plate", star=("steel", "sole"), deck="steel", clamp="steel",
                 accent="hazY"),                                             # workhorse: warm grey, yellow guards
    "s49b": dict(wall="blueGrey", cap="blueGrey", band="dark", stripe="medRed", lip="medRed", guard="hazY",
                 guard_top="hazY", panel="medRed", crown="plate", star=("steel", "sole"), deck="steelD",
                 clamp="blueGrey", accent="medRed"),                        # containment: slate, security red
    "s49c": dict(wall="medWhite", cap="medWhite", band="steel", stripe="polyB", lip="polyB", guard="plate",
                 guard_top="polyB", panel="polyB", crown="steelL", star=("steelL", "sole"), deck="steel",
                 clamp="steel", accent="polyB"),                            # cryo: white, blue, machine grey
}


def geneva_over_tyres(k, P=None):
    """s49 (and its paint schemes, s49a-c)."""
    P = P or scheme("navy", "hivis")
    ol, orr = 1.15, 0.45
    pit(k, P["deck"], P["guard"])
    out = wheel(k, P["clamp"], P["accent"])
    skin(k, FRONT + ol, FRONT + math.tau - orr, P["wall"], P["stripe"])
    jamb(k, FRONT + ol, P["wall"], P["stripe"])
    jamb(k, FRONT - orr, P["wall"], P["stripe"])
    panel(k, FRONT - orr - 0.27, P["wall"], P["panel"])
    canopy(k, P["cap"], P["stripe"], [], hole=1.0, low=P["band"], top=P["cap"])
    zf = sunk_top(k, 1.0, 0.18, P["cap"], P["lip"])
    k.cyl(0, 0, zf, 0.74, 0.05, "steelD", top=P["crown"], sides=40)       # the rotor's crown, down in the well
    k.cyl(0, 0, zf + 0.05, 0.3, ZT - zf - 0.05, "steelD", sides=20)       # its boss up to the star
    for a in (LEFT, BACK + 0.2, RIGHT - 0.45):
        top_tyres(k, a, 0.74, P["guard"], P["guard_top"], z=zf)
    geneva(k, BACK + 0.55 - math.pi / 2, P["cap"], P["guard"], rs=0.7, bridge=1.25, pad=False, star=P["star"])
    return out


def geneva_well(k):
    """s50."""
    body, trim = "slbTeal", "hazY"
    out = wrap(k, body, trim, 1.15, 0.45)
    canopy(k, body, trim, [], hole=1.16)
    zf = sunk_top(k, 1.16, 0.12, body, trim)
    geneva(k, BACK + 0.55, body, trim, z=zf, rs=0.72)
    return out


def crown_well(k):
    """s51."""
    body, trim = "slbMach", "hazY"
    out = wrap(k, body, trim, 1.15, 0.45)
    canopy(k, body, trim, [], hole=1.0)
    zf = sunk_top(k, 1.0, 0.18, body, trim)
    zt = zf + 0.08                                                           # the rotor's crown, in the well
    k.cyl(0, 0, zf, 0.74, 0.08, "steelD", top="steelL", sides=40)
    ring(k, 0.74, zt - 0.03, 0.03, 0.01, trim, n=40, skip=lambda i: i % 2)
    for th in angles():                                                      # a clamp ram over each slab
        ram(k, th, 0.26, 0.68, zt + 0.034, trim)
    k.cyl(0, 0, zt, 0.2, 0.03, body, top=trim, sides=16)
    for a in (LEFT, BACK + 0.5):
        top_tyres(k, a, 0.74, body, trim, z=zf)
    return out


DESIGNS = {**{v: ((lambda k, c=c: geneva_over_tyres(k, c)), (3, 3)) for v, c in SCHEMES.items()},
           "s49": (geneva_over_tyres, (3, 3)), "s50": (geneva_well, (3, 3)), "s51": (crown_well, (3, 3))}
OVERLAYS = {}
PIT = {v: RP for v in DESIGNS}
