"""Ground power cable look study, round 1 (family `cable_study`, palette set cable, preview only; issue #514): a power
cable laid across levelled asteroid ground between modules that no hull joins. One 1x1 sprite per tile by a 4-neighbour
connection mask (N1 E2 S4 W8, grid N = -y, E = +x), like the structural beams; a module or wall on a tile edge counts as
a connection, and the plug overlay adds the socket hardware on that edge. Low: it lies on the ground.

Looks:
  hose    a heavy armoured hose lying on the rock, ribbed sheath, gentle radiused bends, staked clamps, a junction box
  tray    a knee-low cable tray on stands, three cables in it (one orange), radiused bends, a junction box
  buried  a buried conduit: flush armoured cover plates in a dark cut, glowing seams between plates, a junction hatch

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
LOOKS = ("hose", "tray", "buried")


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
HUB = 0.16


def _hose_run(f, path, lit, var=0, clamp=False):
    L = _cum(path)[-1]
    sweep(f, _sub(path, 0, L), _round(HR, HZ, 10), ["cbSheath"])
    for a, b in _spans(L, 0.25, 0.0, 0.05):           # ribs, in step across tile edges
        sweep(f, _sub(path, a, b, 0.02), _round(HR + 0.014, HZ, 10), ["cbRib"], caps="cbRib")
    if clamp:                                                                 # a staked clamp at the middle
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        pu, pv = -dv, du
        for s in (-1, 1):
            f.box(u + pu * s * (HR + 0.03), v + pv * s * (HR + 0.03), 0.0, 0.06 if du == 0 else 0.07,
                  0.07 if du == 0 else 0.06, 0.1, "cbClampD", top="cbClamp")                      # stake heads
        sweep(f, _sub(path, L / 2 - 0.035, L / 2 + 0.035, 0.035),
              [(-HR - 0.05, 0.0), (HR + 0.05, 0.0), (HR + 0.05, HZ + 0.02), (0, 2 * HZ + 0.025), (-HR - 0.05, HZ + 0.02)],
              ["cbClampD", "cbClamp", "cbClamp", "cbClamp", "cbClampD"], caps="cbClampD")      # the strap over it
        if var == 1:
            f.box(u, v, 2 * HZ + 0.02, 0.05, 0.05, 0.03, "cbClampD", top="cbLit" if lit else "cbOff")
    if var == 2:                                                              # a coupling with hazard bands
        m = L / 2
        sweep(f, _sub(path, m - 0.1, m + 0.1, 0.04), _round(HR + 0.025, HZ, 10), ["cbBox"], caps="cbClampD")
        for k in (-1, 1):
            sweep(f, _sub(path, m + k * 0.06 - 0.025, m + k * 0.06 + 0.025, 0.05), _round(HR + 0.03, HZ, 10),
                  ["cbBand"], caps="cbBand")


def _hose_box(f, lit, arms):
    f.box(0, 0, 0.0, 0.44, 0.44, 0.05, "cbClampD", top="cbClampD")            # base plate
    f.box(0, 0, 0.05, 0.36, 0.36, 0.2, "cbBox", top="cbBoxL")
    f.box(0, 0, 0.25, 0.2, 0.2, 0.03, "cbBox", top="cbBox")
    f.box(0.11, 0.11, 0.25, 0.07, 0.07, 0.04, "cbClampD", top="cbLit" if lit else "cbOff")
    for d in arms:                                                            # cable glands
        f.box(d[0] * 0.2, d[1] * 0.2, HZ - 0.07, 0.07 if d[0] else 0.17, 0.17 if d[0] else 0.07, 0.16, "cbClampD",
              top="cbClamp")


def hose(mask, lit, var=0):
    m = core.Mesh(f"cable_hose_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    for p in _paths(mask, 0.2 if mask not in (1, 2, 4, 8) else HUB):
        _hose_run(f, p, lit, var, clamp=straight)
    if len(arms) != 2:
        if len(arms) == 1:                                                    # a sealed end boot
            d = arms[0]
            f.box(d[0] * 0.06, d[1] * 0.06, 0.0, 0.2 if d[0] else 0.22, 0.22 if d[0] else 0.2, 0.17, "cbClampD",
                  top="cbBox")
            f.box(-d[0] * 0.02, -d[1] * 0.02, 0.17, 0.06, 0.06, 0.025, "cbClampD", top="cbLit" if lit else "cbOff")
        else:
            _hose_box(f, lit, arms)
    return [m.build()]


# ---- tray -----------------------------------------------------------------------------------------------------------

TW, TZ, TH = 0.17, 0.13, 0.075                 # tray half width, floor height, wall height
LANES = ((-0.085, "cbCabK"), (0.0, "cbCabO"), (0.085, "cbCabK"))


def _tray_run(f, path, lit, var=0, stand=False):
    L = _cum(path)[-1]
    pts = _sub(path, 0, L)
    w = 0.035
    prof = [(-TW, TZ), (TW, TZ), (TW, TZ + TH), (TW - w, TZ + TH), (TW - w, TZ + 0.025), (-TW + w, TZ + 0.025),
            (-TW + w, TZ + TH), (-TW, TZ + TH)]
    sweep(f, pts, prof, ["cbTrayD", "cbTrayD", "cbTray", "cbTray", "cbTrayD", "cbTray", "cbTray", "cbTrayD"],
          )
    for s, col in LANES:
        sweep(f, [((u - dv * s, v + du * s), (du, dv)) for (u, v), (du, dv) in pts], _round(0.04, TZ + 0.062, 8), [col])
    for a, b in _spans(L, 0.25, 0.0, 0.03):            # tie bars across, in step
        sweep(f, _sub(path, a, b, 0.03), [(-TW, TZ + TH - 0.005), (TW, TZ + TH - 0.005), (TW, TZ + TH + 0.02),
                                            (-TW, TZ + TH + 0.02)], ["cbTrayD", "cbTray", "cbTray", "cbTray"],
              caps="cbTrayD")
    if stand:
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        pu, pv = -dv, du
        f.box(u, v, 0.0, 0.22 if du == 0 else 0.1, 0.1 if du == 0 else 0.22, 0.02, "cbClampD", top="cbClampD")  # foot
        f.box(u, v, 0.02, 0.06, 0.06, TZ - 0.02, "cbClampD", top="cbClamp")                                     # post
        f.box(u, v, TZ - 0.03, 2 * TW + 0.04 if du == 0 else 0.06, 0.06 if du == 0 else 2 * TW + 0.04, 0.03,
              "cbClampD", top="cbClamp")                                                                       # saddle
        if var == 1:
            f.box(u + pu * (TW + 0.04), v + pv * (TW + 0.04), 0.02, 0.05, 0.05, TZ + TH, "cbClampD",
                  top="cbLit" if lit else "cbOff")                                                             # a lamp post
    if var == 2:
        (u, v), _ = _at(path, _cum(path), L / 2)
        f.box(u, v, TZ + TH + 0.02, 0.12, 0.12, 0.05, "cbBand", top="cbBand")                                  # a tag plate


def _tray_box(f, lit, arms):
    f.box(0, 0, 0.0, 0.3, 0.3, 0.02, "cbClampD", top="cbClampD")
    for s in (-1, 1):
        for t in (-1, 1):
            f.box(s * 0.1, t * 0.1, 0.02, 0.05, 0.05, 0.12, "cbClampD", top="cbClamp")
    f.box(0, 0, 0.12, 0.34, 0.34, 0.14, "cbBox", top="cbBoxL")
    f.box(0, 0, 0.26, 0.2, 0.2, 0.02, "cbBox", top="cbBox")
    f.box(0.09, 0.09, 0.26, 0.06, 0.06, 0.035, "cbClampD", top="cbLit" if lit else "cbOff")


def tray(mask, lit, var=0):
    m = core.Mesh(f"cable_tray_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    for p in _paths(mask, 0.17):
        _tray_run(f, p, lit, var, stand=straight)
    if len(arms) != 2:
        if len(arms) == 1:                                                    # an end stand with a blank plate
            d = arms[0]
            f.box(d[0] * 0.17, d[1] * 0.17, 0.0, 0.22, 0.22, 0.02, "cbClampD", top="cbClampD")
            f.box(d[0] * 0.17, d[1] * 0.17, 0.02, 0.06, 0.06, TZ - 0.02, "cbClampD", top="cbClamp")
            f.box(d[0] * 0.17, d[1] * 0.17, TZ - 0.03, 0.34, 0.34, 0.03, "cbClampD", top="cbClamp")
            f.box(d[0] * 0.15, d[1] * 0.15, TZ, 0.04 if d[0] else 2 * TW + 0.02, 2 * TW + 0.02 if d[0] else 0.04,
                  TH + 0.02, "cbTrayD", top="cbBand")
        else:
            _tray_box(f, lit, arms)
    return [m.build()]


# ---- buried ---------------------------------------------------------------------------------------------------------

BW = 0.15                                     # cover plate half width


def _buried_run(f, path, lit, var=0):
    L = _cum(path)[-1]
    pts = _sub(path, 0, L)
    sweep(f, pts, [(-BW - 0.05, 0.0), (BW + 0.05, 0.0), (BW + 0.05, 0.012), (-BW - 0.05, 0.012)],
          ["cbTrench"], caps="cbTrench")                                      # the dark cut
    sweep(f, pts, [(-BW - 0.05, 0.012), (-BW - 0.02, 0.012), (-BW - 0.02, 0.022), (-BW - 0.05, 0.022)],
          ["cbBandK", "cbBand", "cbBand", "cbBand"], caps="cbBand")          # hazard edges
    sweep(f, pts, [(BW + 0.02, 0.012), (BW + 0.05, 0.012), (BW + 0.05, 0.022), (BW + 0.02, 0.022)],
          ["cbBandK", "cbBand", "cbBand", "cbBand"], caps="cbBand")
    for a, b in _spans(L, 0.25, 0.125, 0.215):            # cover plates; gaps carry the seam light
        sweep(f, _sub(path, a, b, 0.05), [(-BW, 0.012), (BW, 0.012), (BW, 0.036), (-BW, 0.036)],
              ["cbPlate", "cbPlate", "cbPlateL", "cbPlate"], caps="cbPlate")
    for a, b in _spans(L, 0.25, 0.0, 0.025):
        sweep(f, _sub(path, a, b, 0.05), [(-BW + 0.03, 0.012), (BW - 0.03, 0.012), (BW - 0.03, 0.02), (-BW + 0.03, 0.02)],
              ["cbSeam" if lit else "cbSeamOff"], caps="cbSeam" if lit else "cbSeamOff")
    if var == 1:                                                              # a marker post beside it
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        pu, pv = -dv, du
        x, y = u + pu * (BW + 0.13), v + pv * (BW + 0.13)
        f.box(x, y, 0.0, 0.07, 0.07, 0.14, "cbBand", top="cbBandK")
        f.box(x, y, 0.14, 0.07, 0.07, 0.05, "cbBandK", top="cbLit" if lit else "cbOff")


def _buried_hatch(f, lit):
    f.box(0, 0, 0.0, 0.42, 0.42, 0.014, "cbTrench", top="cbTrench")
    f.box(0, 0, 0.012, 0.38, 0.38, 0.016, "cbBand", top="cbBand")
    f.box(0, 0, 0.012, 0.3, 0.3, 0.03, "cbPlate", top="cbPlateL")
    f.box(0, 0, 0.042, 0.12, 0.04, 0.012, "cbClampD", top="cbClampD")         # recessed handle
    for s in (-1, 1):
        f.box(s * 0.11, -s * 0.11, 0.042, 0.04, 0.04, 0.008, "cbSeam" if lit else "cbSeamOff",
              top="cbSeam" if lit else "cbSeamOff")


def buried(mask, lit, var=0):
    m = core.Mesh(f"cable_buried_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    for p in _paths(mask, 0.19):
        _buried_run(f, p, lit, var)
    if len(arms) != 2:
        _buried_hatch(f, lit)
    return [m.build()]


# ---- plugs ----------------------------------------------------------------------------------------------------------

def plug(look, dname, lit):
    """The socket on tile edge d where the cable meets a module or wall: a bolted plate and a collar."""
    m = core.Mesh(f"cable_{look}_plug_{dname}_{lit}")
    f = _frame(m)
    du, dv = DIRS[dname][1]
    lamp = "cbLit" if lit else "cbOff"
    if look == "hose":
        z0, h, w = 0.0, 0.32, 0.38
    elif look == "tray":
        z0, h, w = 0.06, 0.3, 0.44
    else:
        z0, h, w = 0.0, 0.12, 0.46
    f.box(du * 0.46, dv * 0.46, z0, 0.07 if du else w, w if du else 0.07, h, "cbClampD", top="cbClamp")
    if look == "hose":
        D.seg(f, (du * 0.3, dv * 0.3, HZ), (du * 0.44, dv * 0.44, HZ), HR + 0.03, "cbBox", 10)
    elif look == "tray":
        f.box(du * 0.38, dv * 0.38, TZ + TH, 0.1 if du else 2 * TW + 0.04, 2 * TW + 0.04 if du else 0.1, 0.04,
              "cbTrayD", top="cbTray")
    for s in (-1, 1):
        f.box(du * 0.43 - dv * s * (w / 2 - 0.05), dv * 0.43 + du * s * (w / 2 - 0.05), z0 + h - 0.06, 0.04, 0.04,
              0.04, "cbClampD", top="cbBoxL")                                  # bolts
    f.box(du * 0.42, dv * 0.42, z0 + h, 0.05, 0.05, 0.03, "cbClampD", top=lamp)
    return [m.build()]


BUILD = {"hose": hose, "tray": tray, "buried": buried}


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
