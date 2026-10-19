"""Structural beams (Struct.Beam): open lattice framework outside the hull, one 1x1 sprite per tile by a 4-neighbour
connection mask (N1 E2 S4 W8, grid N = -y, E = +x), like walls and roofs, so all 16 masks join into runs, corners and
junctions. Low and open (top about 0.6, well under the 1.85 walls); no floor slab, space shows through.

Every tile has a node at its centre and an arm towards each connected neighbour, running to the tile edge, where it
meets the neighbour's arm. The web on an arm runs from the node's bottom to the edge's top, so two arms meeting at a
tile edge form one Warren V. A missing neighbour leaves a free end at the node.

Looks (one mask layout):
  drone  dark machined spar: a planar Warren truss between heavy flanged chords, a machined hub at each node,
         cyan status lights on junction hubs and on the .v1 straight variant
  civil  cheap industrial box lattice: four chords, braced sides and top, a post frame at each node, hazard bands at
         junctions
  navy   clean box truss: light chords, blue-grey side webs and node sleeves, a stencil mark on junction plates
  scrap  patched, mismatched: chords of mixed stock and gauge, braces missing or flipped, welded patch plates, bent
         rods, posts gone; deterministic per tile

Sprites, per look L:
  struct.beam.L.m<mask>                  the tile (straight masks 5 and 10 also .v1, .v2: long runs don't repeat)
  struct.beam.L.cap.<n|e|s|w>            overlay: a capped end on a free end, the arm stub and an end plate
  struct.beam.L.flange.<n|e|s|w>         overlay: the arm to the tile edge and a bolted flange on a hull wall there
Anchored at the tile centre, footprint [1, 1]."""
import math

from . import core, detail as D
from .cmbkit import Frame

DIRS = {"n": (1, (0, -1)), "e": (2, (1, 0)), "s": (4, (0, 1)), "w": (8, (-1, 0))}
Z0, Z1 = 0.1, 0.58          # bottom and top chord heights


def _frame(m):
    return Frame(m, 1, square=True)          # u = grid +x, v = grid +y, origin the tile centre


def _rod(f, a, b, r, mat):
    D.seg(f, a, b, r, mat, 6)


def _bar(f, a, b, s, mat, top):
    """Square bar from a to b along u or v (axis-aligned), side s."""
    (u0, v0, z0), (u1, v1, z1) = a, b
    f.box((u0 + u1) / 2, (v0 + v1) / 2, (z0 + z1) / 2, max(abs(u1 - u0), s), max(abs(v1 - v0), s), max(abs(z1 - z0), s),
          mat, top=top, base=False)


# ---- civil: box lattice ------------------------------------------------------------------------------------------

CW = 0.17                   # civil half width


def _civil_arm(f, d, r0=0.0, r1=0.5, web=True):
    du, dv = d
    pu, pv = -dv, du                                    # perpendicular
    P = lambda t, s, z: (du * t + pu * s, dv * t + pv * s, z)  # noqa: E731
    for s in (-CW, CW):
        for z in (Z0, Z1):
            _bar(f, P(r0, s, z), P(r1, s, z), 0.055, "gm", "steelL")                       # chords
        if web:
            _rod(f, P(r0 + 0.06, s, Z0), P(r1, s, Z1), 0.024, "steel")                     # side web
    if web:
        _rod(f, P(r0 + 0.06, CW, Z1), P(r1, -CW, Z1), 0.022, "steel")                     # top brace
        _rod(f, P(r0 + 0.06, -CW, Z0), P(r1, CW, Z0), 0.022, "steelD")                    # bottom brace


def _civil_node(f, arms):
    for su in (-1, 1):
        for sv in (-1, 1):
            f.box(su * CW, sv * CW, Z0 - 0.03, 0.065, 0.065, Z1 - Z0 + 0.06, "steelD", top="steel")   # posts
    if len(arms) == 2 and arms[0][0] == -arms[1][0]:
        return
    f.box(0, 0, Z1 - 0.01, 2 * CW + 0.06, 2 * CW + 0.06, 0.03, "steel", top="steelL")             # junction gusset
    for d in arms:                                                                              # hazard band per arm
        du, dv = d
        for s in (-CW, CW):
            c = (du * 0.27 - dv * s, dv * 0.27 + du * s)
            f.box(c[0], c[1], Z1, 0.07 if du else 0.075, 0.075 if du else 0.07, 0.075, "hazY", top="hazY", base=False)


# ---- drone: machined spar ----------------------------------------------------------------------------------------

def _drone_arm(f, d, r0=0.0, r1=0.5, web=True):
    du, dv = d
    P = lambda t, z: (du * t, dv * t, z)  # noqa: E731
    _bar(f, P(r0, Z1), P(r1, Z1), 0.16, "steelD", "steel")                                       # flanged chords
    _bar(f, P(r0, Z0), P(r1, Z0), 0.14, "steelD", "steelD")
    for s in (-0.07, 0.07):                                                                       # chord edge rails
        f.box(du * (r0 + r1) / 2 - dv * s, dv * (r0 + r1) / 2 + du * s, Z1 + 0.06, abs(du) * (r1 - r0) + 0.02,
              abs(dv) * (r1 - r0) + 0.02, 0.02, "gmD", top="gm", base=False)
    if web:
        _rod(f, P(r0 + 0.1, Z0), P(r1, Z1), 0.035, "gmD")                                        # Warren web
        _rod(f, P(r0 + 0.1, Z0 + 0.04), P(r0 + 0.1, Z1 - 0.04), 0.03, "gmD")


def _drone_node(f, arms, light):
    f.vcyl(0, 0, Z0 - 0.04, 0.17, Z1 - Z0 + 0.1, "steelD", top="steel", sides=16)                # machined hub
    f.vcyl(0, 0, Z1 + 0.06, 0.12, 0.02, "gmD", top="gm", sides=16)
    for z in (Z0 + 0.1, Z1 - 0.12):
        f.vcyl(0, 0, z, 0.178, 0.025, "dark", sides=16)                                          # machined grooves
    if light:
        f.vcyl(0, 0, Z1 + 0.08, 0.05, 0.02, "cyan", top="cyan", sides=10)                         # status light


# ---- navy: clean box truss ---------------------------------------------------------------------------------------

def _navy_arm(f, d, r0=0.0, r1=0.5, web=True, seed=0):
    du, dv = d
    pu, pv = -dv, du
    P = lambda t, s, z: (du * t + pu * s, dv * t + pv * s, z)  # noqa: E731
    for s in (-CW, CW):
        for z in (Z0, Z1):
            _bar(f, P(r0, s, z), P(r1, s, z), 0.055, "steelL", "plate")                    # chords
        if web:
            _rod(f, P(r0 + 0.08, s, Z0), P(r1, s, Z1), 0.022, "hbM")                        # side web
    if web:
        _bar(f, P((r0 + r1) / 2 + 0.04, -CW, Z1), P((r0 + r1) / 2 + 0.04, CW, Z1), 0.04, "steel", "steelL")   # tie


def _navy_node(f, arms):
    f.box(0, 0, (Z0 + Z1) / 2 - 0.08, 2 * CW + 0.08, 2 * CW + 0.08, 0.16, "hbD", top="hbM")         # sleeve
    for su in (-1, 1):
        for sv in (-1, 1):
            f.box(su * CW, sv * CW, Z0 - 0.02, 0.06, 0.06, Z1 - Z0 + 0.05, "steel", top="steelL")  # posts
    if len(arms) == 2 and arms[0][0] == -arms[1][0]:
        return
    f.box(0, 0, Z1 + 0.01, 2 * CW + 0.06, 2 * CW + 0.06, 0.03, "hbD", top="hbM")                  # junction plate
    f.box(0, 0, Z1 + 0.04, 0.12, 0.12, 0.01, "medWhite", top="medWhite")                          # stencil mark


# ---- scrap: patched, mismatched ----------------------------------------------------------------------------------

SCRAP = ("rust", "rustD", "gm", "steelD", "plate", "steel")


def _h(*k):
    """A small deterministic hash for the per-tile mismatch."""
    x = 2166136261
    for v in k:
        x = ((x ^ (int(v) & 0xffff)) * 16777619) & 0xffffffff
    return x


def _scrap_arm(f, d, r0=0.0, r1=0.5, web=True, seed=0):
    du, dv = d
    pu, pv = -dv, du
    P = lambda t, s, z: (du * t + pu * s, dv * t + pv * s, z)  # noqa: E731
    k = 0
    for s in (-CW, CW):
        for z in (Z0, Z1):
            h = _h(seed, k)
            k += 1
            _bar(f, P(r0, s, z), P(r1, s, z), (0.045, 0.06, 0.075)[h % 3], SCRAP[h // 3 % 6], "steelL")   # chords
        if web and _h(seed, 9, s > 0) % 3:                                                       # some braces gone
            a, b = (Z0, Z1) if _h(seed, 7, s > 0) % 2 else (Z1, Z0)
            _rod(f, P(r0 + 0.06, s, a), P(r1 - 0.02, s, b), 0.026, SCRAP[_h(seed, 8) % 6])
    if not web:
        return
    h = _h(seed, 11)
    if h % 4 == 1:                                                                              # welded patch plate
        sd = CW + 0.012 if h % 8 < 4 else -CW - 0.012
        f.box(du * (r0 + r1) / 2 + pu * sd, dv * (r0 + r1) / 2 + pv * sd, Z0 + 0.06, 0.2 if du else 0.02,
              0.02 if du else 0.2, 0.3, "rustD", top="rust")
    elif h % 4 == 2:                                                                            # a bent extra rod
        D.seg(f, P(r0 + 0.1, -CW, Z1), P((r0 + r1) / 2, 0.0, Z1 + 0.08), 0.022, "gm", 6)
        D.seg(f, P((r0 + r1) / 2, 0.0, Z1 + 0.08), P(r1 - 0.06, CW, Z1), 0.022, "gm", 6)


def _scrap_node(f, arms, seed):
    for i, (su, sv) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        h = _h(seed, 20 + i)
        if h % 5 == 0:
            continue                                                                            # a post missing
        f.box(su * CW, sv * CW, Z0 - 0.03, 0.065, 0.065, Z1 - Z0 + 0.06, SCRAP[h % 6], top="steelL")
    if len(arms) != 2 or arms[0][0] != -arms[1][0]:
        f.box(0.02, -0.03, Z1 - 0.01, 2 * CW + 0.04, 2 * CW + 0.1, 0.03, "rust", top="rustD")       # welded plate


# ---- tiles -------------------------------------------------------------------------------------------------------

ARM = {"civil": _civil_arm, "drone": _drone_arm, "navy": _navy_arm, "scrap": _scrap_arm}

def _arms(mask):
    return [d for _, (bit, d) in DIRS.items() if mask & bit]


def tile(look, mask, var=0):
    m = core.Mesh(f"beam_{look}_{mask}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    if look == "civil":
        for d in arms:
            _civil_arm(f, d)
        _civil_node(f, arms)
        if straight and var == 1:                                                                 # a pipe along it
            ax, ay = abs(arms[0][0]), abs(arms[0][1])
            px, py = -ay * 0.27, ax * 0.27
            D.seg(f, (-0.5 * ax + px, -0.5 * ay + py, Z0 + 0.14), (0.5 * ax + px, 0.5 * ay + py, Z0 + 0.14), 0.045,
                  "rust", 8)
            for t in (-0.3, 0.3):
                f.box(t * ax + px * 0.8, t * ay + py * 0.8, Z0 + 0.1, 0.05 if ax else 0.12, 0.12 if ax else 0.05, 0.08,
                      "steelD", top="steel")                                                      # pipe clamps
        if straight and var == 2:                                                                 # a junction box
            f.box(0, 0, Z1 + 0.03, 0.2, 0.2, 0.12, "steel", top="steelL")
            f.box(0.05, 0.05, Z1 + 0.15, 0.06, 0.06, 0.02, "hazY", top="hazY")
    elif look == "navy":
        for d in arms:
            _navy_arm(f, d)
        _navy_node(f, arms)
        if straight and var == 1:                                                                 # a cable conduit
            ax, ay = abs(arms[0][0]), abs(arms[0][1])
            px, py = -ay * (CW + 0.06), ax * (CW + 0.06)
            D.seg(f, (-0.5 * ax + px, -0.5 * ay + py, Z0 + 0.04), (0.5 * ax + px, 0.5 * ay + py, Z0 + 0.04), 0.035,
                  "hbK", 8)
        if straight and var == 2:                                                                 # a beacon housing
            f.box(0, 0, Z1 + 0.04, 0.14, 0.14, 0.08, "steelL", top="plate")
            f.vcyl(0, 0, Z1 + 0.12, 0.04, 0.04, "steel", top="lens", sides=10)
    elif look == "scrap":
        seed = _h(mask, var, 99)
        for i, d in enumerate(arms):
            _scrap_arm(f, d, seed=_h(seed, i))
        _scrap_node(f, arms, seed)
        if straight and var == 2:                                                                 # a lashed-on crate
            f.box(0.03, -0.02, Z1 + 0.02, 0.24, 0.2, 0.16, "rust", top="rustD")
    else:
        for d in arms:
            _drone_arm(f, d)
        junction = len(arms) != 2 or not straight
        _drone_node(f, arms, light=junction or var == 1 or not arms)
        if straight and var == 2:                                                                 # a sensor pod
            f.vcyl(0, 0, Z1 + 0.08, 0.07, 0.08, "steel", top="lens", sides=10)
    return [m.build()]


def cap(look, dname):
    """A capped free end: a short arm stub and an end plate across it."""
    m = core.Mesh(f"beam_{look}_cap_{dname}")
    f = _frame(m)
    d = DIRS[dname][1]
    du, dv = d
    ARM[look](f, d, 0.0, 0.3, web=False)
    w = 0.3 if look == "drone" else 2 * CW + 0.12
    f.box(du * 0.31, dv * 0.31, Z0 - 0.06, 0.05 if du else w, w if du else 0.05, Z1 - Z0 + 0.14,
          "steelD", top="steel")
    if look in ("civil", "navy"):
        c = "hazY" if look == "civil" else "medWhite"
        f.box(du * 0.34, dv * 0.34, (Z0 + Z1) / 2 - 0.05, 0.02 if du else w * 0.6, w * 0.6 if du else 0.02, 0.1, c, top=c)
    elif look == "scrap":
        f.box(du * 0.35, dv * 0.35 + 0.03, Z0 + 0.1, 0.02 if du else w * 0.5, w * 0.5 if du else 0.02, 0.2, "rust",
              top="rust")
    else:
        f.box(du * 0.34, dv * 0.34, Z1 - 0.06, 0.02 if du else 0.08, 0.08 if du else 0.02, 0.04, "cyan", top="cyan")
    return [m.build()]


def flange(look, dname):
    """The arm on to the tile edge and a bolted mounting flange where it meets a hull wall there."""
    m = core.Mesh(f"beam_{look}_flange_{dname}")
    f = _frame(m)
    d = DIRS[dname][1]
    du, dv = d
    ARM[look](f, d, 0.0, 0.46)
    w = 0.42 if look == "drone" else 2 * CW + 0.22
    f.box(du * 0.47, dv * 0.47, Z0 - 0.1, 0.06 if du else w, w if du else 0.06, Z1 - Z0 + 0.22, "steelD", top="steel")
    for s in (-1, 1):
        for z in (Z0 - 0.04, Z1 + 0.06):
            f.box(du * 0.44 - dv * s * (w / 2 - 0.05), dv * 0.44 + du * s * (w / 2 - 0.05), z, 0.04, 0.04, 0.04,
                  "steelL", top="plate", base=False)                                             # bolts
    return [m.build()]


LOOKS = ("navy", "drone", "civil", "scrap")


def jobs():
    out = []
    for look in LOOKS:
        for mask in range(16):
            out.append((f"struct.beam.{look}.m{mask}", (1, 1), "block", lambda lk=look, mk=mask: tile(lk, mk)))
            if mask in (5, 10):
                for v in (1, 2):
                    out.append((f"struct.beam.{look}.m{mask}.v{v}", (1, 1), "block",
                                lambda lk=look, mk=mask, vv=v: tile(lk, mk, vv)))
        for dn in DIRS:
            out.append((f"struct.beam.{look}.cap.{dn}", (1, 1), "block", lambda lk=look, d=dn: cap(lk, d)))
            out.append((f"struct.beam.{look}.flange.{dn}", (1, 1), "block", lambda lk=look, d=dn: flange(lk, d)))
    return out
