"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): twelve cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Parts in slab_kit.py.

Round 8 found the direction (each variant its own paint, a drive and a hold you can read; s22 Geneva indexer, s23
ferris drive, s24 ratchet and drawers: in git history). Round 9, after its review (ferris the strongest but western:
a wagon-wheel top, brass and "wood"; the tyre drives liked; a readable flow for taking a slab out liked):

  s25  ferris, revised (industrial teal, safety orange, steel): the tyre drives kept; the gondolas hang from box arms
       cantilevered off a tall mast, each held by a stay cable from the masthead (cable-stayed, no rim)
  s26  worm drive and tilt-out (white machinery, red): a worm screw on a bearinged shaft (a motor at one end, a hand
       wheel at the other) turns the toothed rim; each slab stands in a hinged cradle latched to the column's collar,
       the front one tipped out toward the room by a ram
  s27  chain drive and jib crane (gunmetal, crane yellow): a roller chain wraps the base's sprocket ring from a motor
       sprocket at the left corner, a sprung tensioner on the slack run; each slab stands in a foot socket, its head
       in a slot guide; a jib crane on the right corner lifts the front one straight up out of its slot"""
import math

from .slab_kit import (BACK, FRONT, R0, UP, angles, at, base, bolts, cassette, frame, hazard, motor, ring,
                       spring, tube)
from .slab_study import L, beam

assert BACK and hazard


def add(a, b, s=1.0):
    return tuple(a[i] + s * b[i] for i in range(3))


def norm(v):
    n = math.sqrt(sum(c * c for c in v))
    return tuple(c / n for c in v)


def tyre_drives(k, house, guard):
    """The rim's three tyre drives (round 8's), pressing on its outside."""
    for a in (FRONT + math.pi / 3, FRONT + math.pi, FRONT - math.pi / 3):
        k.box(*at(1.56, a)[:2], 0.1, 0.3, 0.6, 0.12, "steelD", top="steel", rz=a)
        for da in (-0.13, 0.13):
            t = at(1.42, a + da)
            k.cyl(t[0], t[1], 0.26, 0.14, 0.14, "black", top="steelD", sides=16)
            k.cyl(t[0], t[1], 0.4, 0.06, 0.03, "steelL", sides=10)
        m = at(1.6, a)
        k.box(m[0], m[1], 0.22, 0.26, 0.42, 0.28, house, rz=a)
        for dz in (0.28, 0.36, 0.44):
            k.box(*at(1.735, a)[:2], dz, 0.012, 0.34, 0.03, "dark", rz=a)
        k.box(m[0], m[1], 0.5, 0.2, 0.3, 0.03, guard, rz=a)


# ---- s25 ferris, revised --------------------------------------------------------------------------------------------
def ferris(k):
    """s25."""
    z0 = 0.52
    za = z0 + L + 0.36                                                       # the arms' centre line
    zm = za + 0.95                                                           # the masthead
    base(k, None)
    for i in range(6):                                                       # the turning rim and its spokes
        a = (i + 0.5) * math.pi / 3
        beam(k, at(0.3, a, 0.38), at(1.18, a, 0.38), 0.1, 0.1, "steelD", top="steel")
    ring(k, 1.2, 0.3, 0.14, 0.1, "slbTeal")
    ring(k, 1.27, 0.32, 0.1, 0.035, "black")
    tyre_drives(k, "slbTeal", "hivis")
    k.cyl(0, 0, 0.3, 0.26, zm - 0.3, "steel", top="steelL", sides=14)      # the mast
    for z in (0.6, 1.5):
        k.cyl(0, 0, z, 0.29, 0.1, "slbTeal", sides=14)
    k.cyl(0, 0, za - 0.14, 0.44, 0.28, "slbTeal", sides=16)                 # the arms' collar
    bolts(k, 0.36, za + 0.14, 12)
    k.cyl(0, 0, zm - 0.12, 0.3, 0.14, "steelD", top="steel", sides=14)      # the masthead and its beacon
    k.cyl(0, 0, zm + 0.02, 0.1, 0.1, "hivis", sides=10)
    out = []
    for th in angles():
        s = cassette(k, frame(th, z0))
        out.append(s)
        for w in (-1, 1):                                                    # the yoke and its trunnions
            a, b = sorted((w * 0.5, w * 0.58))
            s.box(k, 1.15, L + 0.22, a, b, -0.16, -0.06, "steelD", face="steel")
            tube(k, s.p(1.25, w * 0.4, -0.11), s.p(1.25, w * 0.64, -0.11), 0.07, "steelL", sides=10)
            tube(k, s.p(1.25, w * 0.64, -0.11), s.p(1.25, w * 0.68, -0.11), 0.075, "hivis", sides=10)
        s.box(k, L + 0.14, L + 0.22, -0.58, 0.58, -0.16, -0.06, "steelD", face="steel")
        s.box(k, -0.05, 0.03, -0.14, 0.14, 0.06, 0.08, "medWhite")           # a cell plate
        hp = s.p(L + 0.22, 0.0, -0.11)
        a = math.atan2(hp[1], hp[0])
        tip = (hp[0], hp[1], za)
        beam(k, at(0.4, a, za), add(tip, at(0.08, a)), 0.1, 0.16, "slbTeal")   # the arm
        k.box(hp[0], hp[1], za - 0.1, 0.14, 0.14, 0.2, "steelD", top="steel", rz=a)   # its tip block
        tube(k, hp, (hp[0], hp[1], za - 0.1), 0.03, "steelL")                # the hanger
        k.box(hp[0], hp[1], z0 + L + 0.24, 0.08, 0.08, 0.06, "hivis")
        tube(k, (0, 0, zm - 0.05), (hp[0], hp[1], za + 0.08), 0.014, "steelL")   # its stay
    return out


# ---- s26 worm drive and tilt-out ------------------------------------------------------------------------------------
def worm(k):
    """s26."""
    z0 = 0.42
    zc = z0 + L - 0.1                                                        # the column's collar
    base(k, "medWhite")
    ring(k, 1.29, 0.19, 0.1, 0.06, "steelL", n=72, skip=lambda i: i % 2)    # the worm wheel's teeth
    ring(k, 1.16, 0.3, 0.012, 0.06, "medRed")
    a = FRONT + math.pi / 2                                                  # the worm at the left corner
    c, ax = at(1.45, a, 0.25), (-math.sin(a), math.cos(a), 0.0)
    tube(k, add(c, ax, -0.66), add(c, ax, 0.4), 0.04, "steelL")             # its shaft
    d = norm(add(ax, UP, math.tan(math.radians(14))))
    for j in range(-4, 5):                                                   # its thread
        p = add(c, ax, j * 0.055)
        tube(k, add(p, d, -0.012), add(p, d, 0.012), 0.13, "steel", sides=12)
    for t in (-0.32, 0.32):                                                  # its bearings
        b = add(c, ax, t)
        k.box(b[0], b[1], 0.1, 0.12, 0.2, 0.26, "medWhite", rz=a)
        k.box(b[0], b[1], 0.36, 0.14, 0.22, 0.03, "medRed", rz=a)
    m0, m1 = add(c, ax, 0.4), add(c, ax, 0.66)                               # its motor
    tube(k, m0, m1, 0.13, "medRed", sides=12)
    for t in (0.46, 0.53, 0.6):
        tube(k, add(c, ax, t), add(c, ax, t + 0.02), 0.16, "steelD", sides=12)
    k.box(*add(c, ax, 0.53)[:2], 0.1, 0.12, 0.26, 0.04, "steelD", rz=a)
    hw = add(c, ax, -0.6)                                                    # the hand wheel
    tube(k, add(hw, ax, -0.015), add(hw, ax, 0.015), 0.15, "medRed", sides=12)
    tube(k, add(hw, ax, -0.04), add(hw, ax, 0.04), 0.04, "steelL")
    k.cyl(0, 0, 0.3, 0.3, zc - 0.3, "medWhite", sides=14)                   # the column, its collar
    for z in (0.7, 1.4):
        k.cyl(0, 0, z, 0.32, 0.06, "medRed", sides=14)
    k.cyl(0, 0, zc - 0.07, 0.5, 0.14, "medWhite", sides=20)
    k.cyl(0, 0, zc + 0.07, 0.3, 0.08, "steelD", top="steel", sides=14)
    out = []
    for i, th in enumerate(angles()):
        tilt = math.radians(26) if i == 0 else 0.0                          # the front one tipped out
        up = frame(th, z0)
        s = cassette(k, frame(th, z0, tilt=tilt))
        out.append(s)
        s.box(k, 0.1, L - 0.1, -0.3, 0.3, -0.3, -0.22, "medRed")             # the cradle's back spine
        s.box(k, -0.1, 0.06, -0.48, 0.48, -0.3, 0.08, "medWhite")            # its foot shoe
        for w in (-0.4, 0.4):                                                # the hinge, fixed to the deck
            k.box(*up.p(-0.1, w, -0.24)[:2], 0.3, 0.1, 0.1, 0.12, "steelD", top="steel", rz=th)
        tube(k, up.p(-0.04, -0.48, -0.24), up.p(-0.04, 0.48, -0.24), 0.035, "steelL")
        h = s.p(L - 0.05, 0.0, -0.26)
        a2 = math.atan2(h[1], h[0])
        if tilt:                                                             # its ram, and the latch thrown off
            base_pt = at(0.55, th, 0.34)
            end = s.p(0.95, 0.0, -0.3)
            mid = add(base_pt, add(end, base_pt, -1.0), 0.55)
            tube(k, base_pt, mid, 0.06, "medWhite", sides=10)
            tube(k, mid, end, 0.028, "steelL")
            k.box(*base_pt[:2], 0.3, 0.14, 0.14, 0.08, "steelD", top="steel", rz=th)
            beam(k, at(0.48, a2, zc), at(0.75, a2, zc + 0.12), 0.07, 0.06, "medRed")
            continue
        beam(k, at(0.48, a2, zc), (h[0], h[1], zc), 0.07, 0.06, "medRed")     # the latch to the collar
        k.box(h[0], h[1], zc - 0.05, 0.1, 0.1, 0.1, "steelD", top="steel", rz=a2)
    return out


# ---- s27 chain drive and jib crane ----------------------------------------------------------------------------------
def links(k, pts, z, closed=False):
    """A roller chain along the polyline pts: links every 0.09, alternating plates and rollers."""
    segs = list(zip(pts, pts[1:] + (pts[:1] if closed else [])))
    j = 0
    for (u0, v0), (u1, v1) in segs:
        ln = math.hypot(u1 - u0, v1 - v0)
        n = max(1, round(ln / 0.09))
        for t in range(n):
            u, v = u0 + (u1 - u0) * (t + 0.5) / n, v0 + (v1 - v0) * (t + 0.5) / n
            col = "steelL" if j % 2 else "dark"
            k.box(u, v, z, ln / n * 0.9, 0.05, 0.07, col, rz=math.atan2(v1 - v0, u1 - u0))
            j += 1


def arc(c, r, a0, a1, n):
    return [(c[0] + r * math.cos(a0 + (a1 - a0) * i / n), c[1] + r * math.sin(a0 + (a1 - a0) * i / n))
            for i in range(n + 1)]


def crane(k):
    """s27."""
    z0 = 0.36
    base(k, "gm")
    ring(k, 1.27, 0.18, 0.12, 0.05, "steelL", n=64, skip=lambda i: i % 2)   # the sprocket ring
    sa = FRONT + math.pi / 2                                                 # the drive sprocket, left corner
    C2, r1, r2 = at(1.8, sa), 1.31, 0.17
    al = math.acos((r1 - r2) / 1.8)
    path = arc((0, 0), r1, sa + al, sa + math.tau - al, 72) + arc(C2, r2, sa - al, sa + al, 8)
    links(k, path, 0.2, closed=True)                                         # the chain
    k.box(C2[0], C2[1], 0.0, 0.4, 0.4, 0.18, "steelD", top="steel", rz=sa)
    k.cyl(C2[0], C2[1], 0.18, r2, 0.1, "steelL", top="steel", sides=14)
    motor(k, C2[0], C2[1], 0.3, h=0.4, body="hivis")
    ip = at(1.56, sa + 0.4)                                                 # the tensioner on the slack run
    k.cyl(ip[0], ip[1], 0.18, 0.08, 0.12, "steel", top="steelL", sides=10)
    pv = at(1.62, sa + 0.15)
    k.box(pv[0], pv[1], 0.0, 0.16, 0.16, 0.3, "steelD", top="steel")
    beam(k, (pv[0], pv[1], 0.26), (ip[0], ip[1], 0.26), 0.06, 0.05, "hazY")
    spring(k, (pv[0], pv[1], 0.14), (ip[0], ip[1], 0.14), r=0.035, n=4, col="hivis")
    zg = z0 + L - 0.08                                                       # the slot guides' height
    k.cyl(0, 0, 0.3, 0.28, zg + 0.1 - 0.3, "gm", sides=14)                  # the mast and its guide collar
    for z in (0.7, 1.5):
        k.cyl(0, 0, z, 0.31, 0.08, "hivis", sides=14)
    k.cyl(0, 0, zg - 0.04, 0.42, 0.14, "steelD", top="steel", sides=16)
    out = []
    for i, th in enumerate(angles()):
        lift = 0.62 if i == 0 else 0.0
        seat = frame(th, z0)
        s = cassette(k, frame(th, z0, lift=lift))
        out.append(s)
        seat.box(k, -0.1, 0.14, -0.5, 0.5, -0.34, 0.1, "gm", face="steelL")   # the foot socket
        seat.box(k, -0.02, 0.1, -0.06, 0.06, 0.1, 0.12, "hazY")
        for n0, n1 in ((0.08, 0.14), (-0.36, -0.3)):                         # the slot guide round its head
            seat.box(k, L - 0.14, L - 0.04, -0.52, 0.52, n0, n1, "steelD", face="steel")
        g = seat.p(L - 0.09, 0.0, -0.33)
        beam(k, at(0.4, math.atan2(g[1], g[0]), zg + 0.03), (g[0], g[1], zg + 0.03), 0.06, 0.06, "steelD", top="steel")
    s = out[0]                                                               # the lifting beam on the raised one
    s.box(k, L, L + 0.08, -0.08, 0.08, -0.16, -0.04, "steelL")
    s.box(k, L + 0.22, L + 0.3, -0.36, 0.36, -0.14, -0.06, "hazY")
    for w in (-0.3, 0.3):
        tube(k, s.p(L + 0.06, 0.0, -0.1), s.p(L + 0.22, w, -0.1), 0.015, "steelL")
    hk = s.p(L + 0.3, 0.0, -0.1)
    zj = 3.25
    k.box(hk[0], hk[1], hk[2], 0.14, 0.14, 0.16, "medRed")                  # the hook block
    tube(k, (hk[0], hk[1], hk[2] + 0.16), (hk[0], hk[1], zj - 0.12), 0.012, "dark")
    cu, cv, _ = at(1.86, FRONT - math.pi / 2)                                # the crane's post, its jib
    k.box(cu, cv, 0.0, 0.46, 0.46, 0.08, "steelD", top="steel")
    k.box(cu, cv, 0.08, 0.2, 0.2, zj + 0.3 - 0.08, "hazY")
    k.cyl(cu, cv, zj - 0.12, 0.16, 0.12, "steelD", top="steel", sides=12)
    tip = add((hk[0], hk[1], zj), add((hk[0], hk[1], 0), (cu, cv, 0), -1.0), 0.12)
    beam(k, (cu, cv, zj), tip, 0.12, 0.16, "hazY")
    tube(k, (cu, cv, zj + 0.3), add(tip, (0, 0, 0.06)), 0.016, "steelL")    # its tie
    k.box(hk[0], hk[1], zj - 0.2, 0.22, 0.16, 0.12, "steelD", top="steel")  # the trolley
    k.box(cu, cv, zj + 0.3, 0.14, 0.14, 0.06, "hivis")
    return out


DESIGNS = {"s25": (ferris, (3, 3)), "s26": (worm, (3, 3)), "s27": (crane, (3, 3))}
OVERLAYS = {}
assert R0
