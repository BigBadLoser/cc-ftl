"""Ground power cable look study, round 4 (family `cable_study3`, palette set cable, preview only; issue #514): three more
looks on cable_study's layout (one 1x1 sprite per tile by a 4-neighbour mask in which a module or wall on an edge counts as
a connection; the plug overlay adds the socket on that edge).

Looks:
  spine  a heavy cable sleeved in big interlocking armour segments (a vertebrae chain), radiused bends, an armoured hub
  duct   a prefab box duct in the base modules' hull blues: joint frames at the tile edges, an access panel or vents,
         mitred elbow boxes at corners
  cryo   a sleek pale superconducting line on small legs, a glowing ring per tile, a node at junctions

Sprites, per look L (powered; `.off` the same unpowered):
  cable.L.m<mask>[.off]          the tile (straight masks 5 and 10 also .v1, .v2)
  cable.L.plug.<n|e|s|w>[.off]   overlay: the socket where the cable meets a module or wall on that tile edge
Anchored at the tile centre, footprint [1, 1]."""
from . import core
from .cable_study import DIRS, HS, PAL, _arms, _at, _cum, _frame, _line, _paths, _round, _spans, _sub, sweep

LOOKS = ("spine", "duct", "cryo")
assert PAL == "cable"


def _lamp(lit):
    return "cbLit" if lit else "cbOff"


# ---- spine ----------------------------------------------------------------------------------------------------------

SR, SZ = 0.1, 0.1                              # armour radius and centre height


def _spine_run(f, path, lit, var=0):
    L = _cum(path)[-1]
    sweep(f, _sub(path, 0, L), _round(SR - 0.035, SZ, HS), ["cbCabK"])        # the cable between the segments
    for a, b in _spans(L, 0.25, 0.125, 0.21):                                 # armour segments, in step across tiles
        sweep(f, _sub(path, a, b, 0.05), _round(SR, SZ, HS), ["cbArmour"], caps="cbArmourD")
        sweep(f, _sub(path, a + 0.02, b - 0.02, 0.05), _round(SR + 0.006, SZ, HS), ["cbArmourL"])
    if var == 1:                                                              # a lamp on one segment
        (u, v), _ = _at(path, _cum(path), 0.625)
        f.box(u, v, SZ + SR - 0.01, 0.07, 0.07, 0.035, "cbClampD", top=_lamp(lit))
    if var == 2:                                                              # a hazard-painted segment
        sweep(f, _sub(path, 0.32, 0.43, 0.055), _round(SR + 0.01, SZ, HS), ["cbBand"])


def spine(mask, lit, var=0):
    m = core.Mesh(f"cable_spine_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    for p in _paths(mask, 0.2):
        _spine_run(f, p, lit, var if mask in (5, 10) else 0)
    if len(arms) != 2:                                                        # an armoured hub
        f.vcyl(0, 0, 0.0, 0.25, 0.06, "cbArmourD", top="cbArmourD", sides=12)
        f.vcyl(0, 0, 0.06, 0.21, 0.16, "cbArmour", top="cbArmourL", sides=12)
        f.vcyl(0, 0, 0.22, 0.09, 0.03, "cbArmourD", top=_lamp(lit), sides=10)
    return [m.build()]


# ---- duct -----------------------------------------------------------------------------------------------------------

DW, DH = 0.16, 0.17                            # duct half width and height


def _duct_box(f, u, v, du, length, w, z0, h, side, top):
    f.box(u, v, z0, length if du else w, w if du else length, h, side, top=top)


def _duct_run(f, path, lit, var=0):
    """One arm of box duct from the tile edge (path start) in, with the joint frame on that edge."""
    (u0, v0), (u1, v1) = path[0], path[-1]
    du, dv = (u1 - u0), (v1 - v0)
    L = abs(du) + abs(dv)
    ax = 1 if abs(du) > 0 else 0
    cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
    _duct_box(f, cu, cv, ax, L, 2 * DW, 0.0, DH, "cbDuctD", "cbDuct")
    s = 1 if (du + dv) > 0 else -1
    eu, ev = u0 + (0.04 * s if ax else 0), v0 + (0 if ax else 0.04 * s)
    _duct_box(f, eu, ev, ax, 0.08, 2 * DW + 0.04, 0.0, DH + 0.025, "cbDuctD", "cbDuctL")  # joint frame at the edge


def _duct_extra(f, ax, lit, var):
    """A straight tile's detail at its middle: an access panel with a lamp (v1) or vents (v2)."""
    if var == 1:
        _duct_box(f, 0, 0, ax, 0.3, 2 * DW - 0.08, DH, 0.012, "cbDuctD", "cbDuctD")
        f.box(0, 0, DH + 0.012, 0.06, 0.06, 0.025, "cbClampD", top=_lamp(lit))
    if var == 2:
        for k in (-1, 0, 1):
            pu, pv = (k * 0.1, 0) if ax else (0, k * 0.1)
            _duct_box(f, pu, pv, ax, 0.05, 2 * DW - 0.1, DH, 0.01, "cbTrench", "cbTrench")


def duct(mask, lit, var=0):
    m = core.Mesh(f"cable_duct_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    if straight:
        a = arms[0]
        for p in ([(-0.5 * a[0], -0.5 * a[1]), (0.0, 0.0)], [(0.5 * a[0], 0.5 * a[1]), (0.0, 0.0)]):
            _duct_run(f, p, lit, 0)
        if var:
            _duct_extra(f, abs(a[0]), lit, var)
    else:
        for d in arms:
            _duct_run(f, [(0.5 * d[0], 0.5 * d[1]), (0.0, 0.0)], lit, 0)
        f.box(0, 0, 0.0, 2 * DW + 0.08, 2 * DW + 0.08, DH + 0.06, "cbDuctD", top="cbDuct")       # junction box
        f.box(0, 0, DH + 0.06, 2 * DW - 0.04, 2 * DW - 0.04, 0.015, "cbDuctD", top="cbDuctL")
        f.box(0.08, 0.08, DH + 0.075, 0.06, 0.06, 0.025, "cbClampD", top=_lamp(lit))
    return [m.build()]


# ---- cryo -----------------------------------------------------------------------------------------------------------

YR, YZ = 0.07, 0.17                            # line radius and centre height


def _cryo_run(f, path, lit, var=0, legs=False):
    L = _cum(path)[-1]
    sweep(f, _sub(path, 0, L), _round(YR, YZ, HS), ["cbCryo"])
    ring = "cbSeam" if lit else "cbSeamOff"
    for a, b in _spans(L, 1.0, 0.5, 0.035):                                   # a glowing ring at each tile's middle
        sweep(f, _sub(path, a, b, 0.035), _round(YR + 0.008, YZ, HS), [ring], caps=ring)
    for a, b in _spans(L, 1.0, 0.0, 0.08):                                    # pale sleeves at the tile edges
        sweep(f, _sub(path, a, b, 0.04), _round(YR + 0.012, YZ, HS), ["cbCryoD"], caps="cbCryoD")
    if legs:
        (u, v), (du, dv) = _at(path, _cum(path), L / 2 + 0.2)
        pu, pv = -dv, du
        for k in (-1, 1):                                                     # an A-frame of two legs
            f.box(u + pu * k * 0.08, v + pv * k * 0.08, 0.0, 0.05, 0.05, YZ, "cbCryoD", top="cbCryoD")
        f.box(u, v, 0.0, 0.08 if du else 0.24, 0.24 if du else 0.08, 0.02, "cbClampD", top="cbClampD")
    if var == 1:                                                              # a frost collar with a gauge
        (u, v), _ = _at(path, _cum(path), L / 2 - 0.22)
        f.box(u, v, YZ + YR - 0.01, 0.06, 0.06, 0.03, "cbCryoD", top=_lamp(lit))
    if var == 2:                                                              # a pressure valve on top
        (u, v), _ = _at(path, _cum(path), L / 2 - 0.22)
        f.vcyl(u, v, YZ, 0.04, YR + 0.06, "cbCryoD", top="cbCryo", sides=10)


def cryo(mask, lit, var=0):
    m = core.Mesh(f"cable_cryo_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    for p in _paths(mask, 0.16):
        _cryo_run(f, p, lit, var if straight else 0, legs=straight)
    if len(arms) != 2:                                                        # a node
        f.vcyl(0, 0, 0.0, 0.16, 0.05, "cbClampD", top="cbClampD", sides=12)
        f.vcyl(0, 0, 0.05, 0.13, 0.22, "cbCryo", top="cbCryo", rtop=0.1, sides=12)
        f.vcyl(0, 0, 0.16, 0.135, 0.04, "cbSeam" if lit else "cbSeamOff", sides=12)
        f.vcyl(0, 0, 0.27, 0.05, 0.03, "cbCryoD", top=_lamp(lit), sides=10)
    return [m.build()]


# ---- plugs ----------------------------------------------------------------------------------------------------------

def plug(look, dname, lit):
    m = core.Mesh(f"cable_{look}_plug_{dname}_{lit}")
    f = _frame(m)
    du, dv = DIRS[dname][1]
    if look == "spine":
        z0, h, w, col, top = 0.0, 0.3, 0.36, "cbArmourD", "cbArmour"
        sweep(f, _sub(_line((du * 0.47, dv * 0.47), (du * 0.3, dv * 0.3)), 0, 0.17, 0.06), _round(SR + 0.03, SZ, HS),
              ["cbArmourD"], caps="cbArmourD")
    elif look == "duct":
        z0, h, w, col, top = 0.0, DH + 0.1, 2 * DW + 0.12, "cbDuctD", "cbDuctL"
    else:
        z0, h, w, col, top = 0.0, 0.32, 0.3, "cbCryoD", "cbCryo"
        sweep(f, _sub(_line((du * 0.47, dv * 0.47), (du * 0.32, dv * 0.32)), 0, 0.15, 0.05), _round(YR + 0.03, YZ, HS),
              ["cbCryoD"], caps="cbCryoD")
    f.box(du * 0.45, dv * 0.45, z0, 0.1 if du else w, w if du else 0.1, h, col, top=top)
    f.box(du * 0.42, dv * 0.42, z0 + h, 0.07, 0.07, 0.03, "cbClampD", top=_lamp(lit))
    return [m.build()]


BUILD = {"spine": spine, "duct": duct, "cryo": cryo}


def jobs():
    out = []
    for look in LOOKS:
        for lit in (True, False):
            sfx = "" if lit else ".off"
            for mask in range(16):
                out.append((f"cable.{look}.m{mask}{sfx}", (1, 1), "block",
                            lambda lk=look, mk=mask, li=lit: BUILD[lk](mk, li)))
                if mask in (5, 10):
                    for v in (1, 2):
                        out.append((f"cable.{look}.m{mask}.v{v}{sfx}", (1, 1), "block",
                                    lambda lk=look, mk=mask, vv=v, li=lit: BUILD[lk](mk, li, vv)))
            for dn in DIRS:
                out.append((f"cable.{look}.plug.{dn}{sfx}", (1, 1), "block",
                            lambda lk=look, d=dn, li=lit: plug(lk, d, li)))
    return out
