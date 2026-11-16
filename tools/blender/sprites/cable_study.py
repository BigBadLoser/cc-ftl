"""Ground power cable look study, round 2 (round 1 had a third look, buried, dropped) (family `cable_study`, palette set cable, preview only; issue #514): a power
cable laid across levelled asteroid ground between modules that no hull joins. One 1x1 sprite per tile by a 4-neighbour
connection mask (N1 E2 S4 W8, grid N = -y, E = +x), like the structural beams; a module or wall on a tile edge counts as
a connection, and the plug overlay adds the socket hardware on that edge. Low: it lies on the ground.

Looks:
  hose    a heavy armoured hose lying on the rock, ribbed sheath, gentle radiused bends, staked clamps, a junction box
  tray    a knee-low cable tray on stands, three cables in it (one orange), radiused bends, a junction box

Sprites, per look L (powered; `.off` the same unpowered):
  cable.L.m<mask>[.off]          the tile (straight masks 5 and 10 also .v1, .v2)
  cable.L.plug.<n|e|s|w>[.off]   overlay: the socket where the cable meets a module or wall on that tile edge
Anchored at the tile centre, footprint [1, 1]."""
import math

from . import detail as D
from . import core
from .cmbkit import Frame

PAL = "cable"
DIRS = {"n": (1, (0, -1)), "e": (2, (1, 0)), "s": (4, (0, 1)), "w": (8, (-1, 0))}
LOOKS = ("hose", "tray")


def _frame(m):
    return Frame(m, 1, square=True)          # u = grid +x, v = grid +y, origin the tile centre


def _arms(mask):
    return [d for _, (bit, d) in DIRS.items() if mask & bit]


# ---- paths: a tile's cable runs as polylines in (u, v), measured in arc length --------------------------------------

def _line(a, b, n=2):
    return [(a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)) for i in range(n)]


def _arc(d1, d2, n=10):
    """Quarter arc from the edge midpoint of arm d1 to that of d2, about the tile corner between them, radius 0.5."""
    cu, cv = 0.5 * (d1[0] + d2[0]), 0.5 * (d1[1] + d2[1])
    out = []
    for i in range(n + 1):
        th = math.pi / 2 * i / n
        out.append((cu - 0.5 * d2[0] * math.cos(th) - 0.5 * d1[0] * math.sin(th),
                    cv - 0.5 * d2[1] * math.cos(th) - 0.5 * d1[1] * math.sin(th)))
    return out


def _paths(mask, hub):
    """-> list of polylines, each starting at a tile edge (so bands along them line up across tiles). Straight: edge to
    edge; corner: one arc; else arms from the edge in to the hub's rim (hub half-size)."""
    arms = _arms(mask)
    if mask in (5, 10):
        a = arms[0]
        return [_line((-0.5 * a[0], -0.5 * a[1]), (0.5 * a[0], 0.5 * a[1]))]
    if len(arms) == 2:
        return [_arc(arms[0], arms[1])]
    return [_line((d[0] * 0.5, d[1] * 0.5), (d[0] * hub, d[1] * hub)) for d in arms]   # every path starts at an edge


def _cum(path):
    s = [0.0]
    for (a, b), (c, d) in zip(path, path[1:]):
        s.append(s[-1] + math.hypot(c - a, d - b))
    return s


def _at(path, cum, t):
    """Point and unit direction at arc length t."""
    for i in range(len(path) - 1):
        if t <= cum[i + 1] or i == len(path) - 2:
            (a, b), (c, d) = path[i], path[i + 1]
            L = cum[i + 1] - cum[i]
            k = 0 if L == 0 else (t - cum[i]) / L
            return (a + (c - a) * k, b + (d - b) * k), ((c - a) / L, (d - b) / L)


def _sub(path, t0, t1, step=0.06):
    """Resampled points of the path between arc lengths t0 and t1, with directions."""
    cum = _cum(path)
    n = max(1, int(math.ceil((t1 - t0) / step)))
    return [_at(path, cum, t0 + (t1 - t0) * i / n) for i in range(n + 1)]


def sweep(f, pts, prof, cols, closed=True, caps=None):
    """Extrude a profile [(s, z)] (counter-clockwise seen along the path; s to the left) along pts [((u, v), (du, dv))].
    cols: one colour per profile edge. caps: colour to close both ends (convex profiles only)."""
    rings = []
    for (u, v), (du, dv) in pts:
        pu, pv = -dv, du
        rings.append([f.pt(u + pu * s, v + pv * s, z) for s, z in prof])
    n = len(prof)
    for A, B in zip(rings, rings[1:]):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            f.poly([A[i], A[j], B[j], B[i]], cols[i % len(cols)], flip=True)
    if caps:
        f.poly(rings[0], caps, flip=True)
        f.poly(rings[-1][::-1], caps, flip=True)


def _round(r, z, sides=8):
    a0 = math.pi / sides
    return [(r * math.cos(a0 + i * math.tau / sides), z + r * math.sin(a0 + i * math.tau / sides)) for i in range(sides)]


def _spans(L, period, phase, width):
    """Bands of `width` every `period` along a path of length L (phase in absolute arc length from the path start)."""
    out, t = [], phase - period
    while t < L:
        a, b = max(0.0, t - width / 2), min(L, t + width / 2)
        if b > a + 1e-4:
            out.append((a, b))
        t += period
    return out


# ---- hose -----------------------------------------------------------------------------------------------------------

HR, HZ = 0.095, 0.095                        # hose radius and centre height (lies on the ground)
HS = 14                                      # sides: enough for a smooth silhouette along the 2:1 diagonals
HUB = 0.2


def _hose_run(f, path, lit, var=0, clamp=False):
    """The hose along a path. Nothing on it breaks its outline but the clamp and the coupling (deliberate shapes): the
    joint bands at tile edges are colour only."""
    L = _cum(path)[-1]
    sweep(f, _sub(path, 0, L), _round(HR, HZ, HS), ["cbSheath"])
    for a, b in _spans(L, 1.0, 0.0, 0.12):                                    # joint bands straddling tile edges
        sweep(f, _sub(path, a, b, 0.03), _round(HR + 0.003, HZ, HS), ["cbRib"])
    if clamp:                                                                 # a clamp band staked down each side
        m = L / 2
        (u, v), (du, dv) = _at(path, _cum(path), m)
        pu, pv = -dv, du
        sweep(f, _sub(path, m - 0.045, m + 0.045, 0.09), _round(HR + 0.02, HZ, HS), ["cbClamp"], caps="cbClampD")
        for k in (-1, 1):
            f.box(u + pu * k * (HR + 0.05), v + pv * k * (HR + 0.05), 0.0, 0.09 if du == 0 else 0.09,
                  0.09 if du == 0 else 0.09, 0.06, "cbClampD", top="cbClamp")                    # stake feet
        if var == 1:                                                          # a status lamp on the band
            f.box(u, v, HZ + HR + 0.01, 0.07, 0.07, 0.03, "cbClampD", top="cbLit" if lit else "cbOff")
    if var == 2:                                                              # a coupling sleeve with hazard bands
        m = L / 2
        sweep(f, _sub(path, m - 0.11, m + 0.11, 0.04), _round(HR + 0.025, HZ, HS), ["cbBox"], caps="cbClampD")
        for k in (-1, 1):
            sweep(f, _sub(path, m + k * 0.06 - 0.03, m + k * 0.06 + 0.03, 0.06), _round(HR + 0.027, HZ, HS),
                  ["cbBand"])


def _hose_box(f, lit, arms):
    f.box(0, 0, 0.0, 0.46, 0.46, 0.05, "cbClampD", top="cbClampD")            # base plate
    f.box(0, 0, 0.05, 0.38, 0.38, 0.2, "cbBox", top="cbBoxL")
    f.box(0, 0, 0.25, 0.22, 0.22, 0.03, "cbBox", top="cbBox")
    f.box(0.12, 0.12, 0.25, 0.07, 0.07, 0.04, "cbClampD", top="cbLit" if lit else "cbOff")
    for d in arms:                                                            # cable glands
        f.box(d[0] * 0.21, d[1] * 0.21, 0.0, 0.06 if d[0] else 0.26, 0.26 if d[0] else 0.06, 0.22, "cbClampD",
              top="cbClamp")


def hose(mask, lit, var=0):
    m = core.Mesh(f"cable_hose_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    for p in _paths(mask, HUB if len(arms) > 1 else 0.08):
        _hose_run(f, p, lit, var, clamp=straight)
    if len(arms) == 1:                                                        # a sealed end boot
        d = arms[0]
        sweep(f, _sub(_line((d[0] * 0.2, d[1] * 0.2), (-d[0] * 0.08, -d[1] * 0.08)), 0, 0.28, 0.07),
              _round(HR + 0.03, HZ, HS), ["cbBox"], caps="cbClampD")
        f.box(-d[0] * 0.02, -d[1] * 0.02, 0.0, 0.18 if d[0] else 0.3, 0.3 if d[0] else 0.18, 0.04, "cbClampD",
              top="cbClampD")
        f.box(d[0] * 0.04, d[1] * 0.04, HZ + HR + 0.02, 0.07, 0.07, 0.03, "cbClampD", top="cbLit" if lit else "cbOff")
    elif len(arms) != 2:
        _hose_box(f, lit, arms)
    return [m.build()]


# ---- tray -----------------------------------------------------------------------------------------------------------

TW, TZ, TH, TT = 0.18, 0.12, 0.09, 0.05          # tray half width, floor height, wall height, wall thickness
LANES = ((-0.075, "cbCabK"), (0.0, "cbCabO"), (0.075, "cbCabK"))
CR = 0.04                                          # cable radius


def _tray_prof(grow=0.0):
    g = grow
    return [(-TW - g, TZ - g), (TW + g, TZ - g), (TW + g, TZ + TH + g), (TW - TT, TZ + TH + g), (TW - TT, TZ + 0.03),
            (-TW + TT, TZ + 0.03), (-TW + TT, TZ + TH + g), (-TW - g, TZ + TH + g)]


def _tray_run(f, path, lit, var=0, stand=False):
    """The tray along a path: a U channel whose outline nothing breaks but the stand under it and the lamp or tag of the
    variants (deliberate shapes)."""
    L = _cum(path)[-1]
    pts = _sub(path, 0, L)
    sweep(f, pts, _tray_prof(), ["cbTrayD", "cbTrayD", "cbTray", "cbTray", "cbTrayD", "cbTray", "cbTray", "cbTrayD"])
    for s, col in LANES:
        sweep(f, [((u - dv * s, v + du * s), (du, dv)) for (u, v), (du, dv) in pts], _round(CR, TZ + 0.03 + CR, 10),
              [col])
    if stand:
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        pu, pv = -dv, du
        f.box(u, v, 0.0, 0.26 if du == 0 else 0.12, 0.12 if du == 0 else 0.26, 0.03, "cbClampD", top="cbClampD")  # foot
        f.box(u, v, 0.03, 0.07, 0.07, TZ - 0.03, "cbClampD", top="cbClamp")                                     # post
        if var == 1:                                                                                           # a lamp
            f.box(u + pu * (TW - TT / 2), v + pv * (TW - TT / 2), TZ + TH, 0.07, 0.07, 0.03, "cbClampD",
                  top="cbLit" if lit else "cbOff")
    if var == 2:                                                              # a band clip with a tag
        m = L / 2
        sweep(f, _sub(path, m - 0.04, m + 0.04, 0.08), _tray_prof(0.012), ["cbBand"], closed=False)
        (u, v), (du, dv) = _at(path, _cum(path), m)
        f.box(u, v, TZ + TH + 0.012, 0.08 if du else 2 * TW + 0.024, 2 * TW + 0.024 if du else 0.08, 0.025, "cbBand",
              top="cbBand")                                                   # its strap across the top


def _tray_box(f, lit, arms):
    for s in (-1, 1):
        for t in (-1, 1):
            f.box(s * 0.15, t * 0.15, 0.0, 0.07, 0.07, 0.1, "cbClampD", top="cbClamp")
    f.box(0, 0, 0.09, 0.46, 0.46, 0.18, "cbBox", top="cbBoxL")
    f.box(0, 0, 0.27, 0.26, 0.26, 0.03, "cbBox", top="cbBox")
    f.box(0.13, 0.13, 0.27, 0.07, 0.07, 0.04, "cbClampD", top="cbLit" if lit else "cbOff")


def tray(mask, lit, var=0):
    m = core.Mesh(f"cable_tray_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    for p in _paths(mask, 0.2 if len(arms) > 1 else 0.0):
        _tray_run(f, p, lit, var, stand=straight)
    if len(arms) == 1:                                                        # an end stand and an end plate
        d = arms[0]
        f.box(d[0] * 0.1, d[1] * 0.1, 0.0, 0.26 if d[0] else 0.12, 0.12 if d[0] else 0.26, 0.03, "cbClampD",
              top="cbClampD")
        f.box(d[0] * 0.1, d[1] * 0.1, 0.03, 0.07, 0.07, TZ - 0.03, "cbClampD", top="cbClamp")
        f.box(-d[0] * 0.02, -d[1] * 0.02, TZ, 0.05 if d[0] else 2 * TW, 2 * TW if d[0] else 0.05, TH + 0.03,
              "cbTrayD", top="cbBand")
    elif len(arms) != 2:
        _tray_box(f, lit, arms)
    return [m.build()]


# ---- plugs ----------------------------------------------------------------------------------------------------------

def plug(look, dname, lit):
    """The socket on tile edge d where the cable meets a module or wall: a bolted plate and a collar round the cable."""
    m = core.Mesh(f"cable_{look}_plug_{dname}_{lit}")
    f = _frame(m)
    du, dv = DIRS[dname][1]
    lamp = "cbLit" if lit else "cbOff"
    if look == "hose":
        z0, h, w = 0.0, 0.32, 0.38
        sweep(f, _sub(_line((du * 0.47, dv * 0.47), (du * 0.3, dv * 0.3)), 0, 0.17, 0.06), _round(HR + 0.03, HZ, HS),
              ["cbBox"], caps="cbClampD")
    else:
        z0, h, w = 0.0, TZ + TH + 0.08, 2 * TW + 0.1
        sweep(f, _sub(_line((du * 0.47, dv * 0.47), (du * 0.36, dv * 0.36)), 0, 0.11, 0.06), _tray_prof(0.015),
              ["cbBox"], closed=False)
    f.box(du * 0.465, dv * 0.465, z0, 0.07 if du else w, w if du else 0.07, h, "cbClampD", top="cbClamp")
    for s in (-1, 1):
        f.box(du * 0.43 - dv * s * (w / 2 - 0.05), dv * 0.43 + du * s * (w / 2 - 0.05), z0 + h - 0.08, 0.05, 0.05,
              0.05, "cbClampD", top="cbBoxL")                                  # bolts
    f.box(du * 0.44, dv * 0.44, z0 + h, 0.07, 0.07, 0.03, "cbClampD", top=lamp)
    return [m.build()]


BUILD = {"hose": hose, "tray": tray}


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
