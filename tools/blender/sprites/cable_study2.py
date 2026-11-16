"""Ground power cable look study, round 3 (family `cable_study2`, palette set cable, preview only; issue #514): three more
looks on cable_study's layout (one 1x1 sprite per tile by a 4-neighbour mask in which a module or wall on an edge counts as
a connection; the plug overlay adds the socket on that edge).

Looks:
  conduit  a rigid metal conduit pipe on low saddles, flanged joints at the tile edges, hard elbow fittings at corners
  ramp     a walk-over cable cover (a road cable protector): a low rubber hump, hazard-chevron slopes, a lit strip on top
  pylon    an overhead line on short posts: the cable hangs in a sag between posts (lowest at the tile edge) and drops to a
           socket box on the module's wall

Sprites, per look L (powered; `.off` the same unpowered):
  cable.L.m<mask>[.off]          the tile (straight masks 5 and 10 also .v1, .v2)
  cable.L.plug.<n|e|s|w>[.off]   overlay: the socket where the cable meets a module or wall on that tile edge
Anchored at the tile centre, footprint [1, 1]."""
from . import core
from .cable_study import DIRS, HS, PAL, _arc, _arms, _cum, _at, _frame, _line, _round, _spans, _sub, sweep

LOOKS = ("conduit", "ramp", "pylon")
assert PAL == "cable"


def _lamp(lit):
    return "cbLit" if lit else "cbOff"


def _edge_paths(mask, hub):
    """Straight: edge to edge; anything else: arms from each edge in to the hub (hard fittings, no bends)."""
    arms = _arms(mask)
    if mask in (5, 10):
        a = arms[0]
        return [_line((-0.5 * a[0], -0.5 * a[1]), (0.5 * a[0], 0.5 * a[1]))]
    return [_line((d[0] * 0.5, d[1] * 0.5), (d[0] * hub, d[1] * hub)) for d in arms]


# ---- conduit --------------------------------------------------------------------------------------------------------

CR, CZ = 0.08, 0.17                            # conduit radius and centre height


def _conduit_run(f, path, lit, var=0, saddle=False):
    L = _cum(path)[-1]
    sweep(f, _sub(path, 0, L), _round(CR, CZ, HS), ["cbPipe"])
    for a, b in _spans(L, 1.0, 0.0, 0.08):                                    # bolted flanges at the tile edges
        sweep(f, _sub(path, a, b, 0.04), _round(CR + 0.03, CZ, HS), ["cbPipeD"], caps="cbPipeD")
    if saddle:
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        f.box(u, v, 0.0, 0.26 if du == 0 else 0.14, 0.14 if du == 0 else 0.26, 0.03, "cbClampD", top="cbClampD")
        f.box(u, v, 0.03, 0.18 if du == 0 else 0.1, 0.1 if du == 0 else 0.18, CZ - 0.03, "cbClampD", top="cbClamp")
        sweep(f, _sub(path, L / 2 - 0.05, L / 2 + 0.05, 0.1), _round(CR + 0.02, CZ, HS), ["cbClamp"], caps="cbClampD")
    if var == 1:                                                              # an inline pull box with a lamp
        (u, v), _ = _at(path, _cum(path), L / 2)
        f.box(u, v, CZ - 0.11, 0.2, 0.2, 0.22, "cbPipeD", top="cbPipe")
        f.box(u, v, CZ + 0.11, 0.07, 0.07, 0.03, "cbClampD", top=_lamp(lit))
    if var == 2:                                                              # a painted warning band
        for k in (-1, 1):
            sweep(f, _sub(path, L / 2 + k * 0.18 - 0.05, L / 2 + k * 0.18 + 0.05, 0.1), _round(CR + 0.003, CZ, HS),
                  ["cbBand"])


def conduit(mask, lit, var=0):
    m = core.Mesh(f"cable_conduit_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    straight = mask in (5, 10)
    for p in _edge_paths(mask, 0.12):
        _conduit_run(f, p, lit, var if straight else 0, saddle=straight)
    if not straight:                                                          # an elbow, tee or cross fitting
        f.box(0, 0, 0.0, 0.32, 0.32, 0.03, "cbClampD", top="cbClampD")
        f.box(0, 0, 0.03, 0.26, 0.26, 0.27, "cbPipeD", top="cbPipe")
        f.box(0, 0, 0.3, 0.14, 0.14, 0.03, "cbPipeD", top="cbPipeD")
        f.box(0.07, 0.07, 0.3, 0.07, 0.07, 0.035, "cbClampD", top=_lamp(lit))
        if len(arms) == 1:                                                    # a blind end on the far side
            d = arms[0]
            f.box(-d[0] * 0.14, -d[1] * 0.14, CZ - 0.11, 0.04 if d[0] else 0.22, 0.22 if d[0] else 0.04, 0.22,
                  "cbPipeD", top="cbPipe")
    return [m.build()]


# ---- ramp -----------------------------------------------------------------------------------------------------------

RW, RT, RH = 0.21, 0.1, 0.075                  # half width at the foot, half width of the top, height


def _ramp_run(f, path, lit, var=0):
    L = _cum(path)[-1]
    pts = _sub(path, 0, L)
    sweep(f, pts, [(-RW, 0.0), (RW, 0.0), (RT, RH), (-RT, RH)], ["cbSheath", "cbBand", "cbSheath", "cbBand"])
    for a, b in _spans(L, 0.25, 0.0, 0.125):                                  # black chevron bands on both slopes
        sub = _sub(path, a, b, 0.0625)
        sweep(f, sub, [(RW + 0.004, 0.0), (RT + 0.004, RH + 0.002)], ["cbBandK"], closed=False)
        sweep(f, sub, [(-RT - 0.004, RH + 0.002), (-RW - 0.004, 0.0)], ["cbBandK"], closed=False)
    sweep(f, pts, [(-0.025, RH), (0.025, RH), (0.025, RH + 0.006), (-0.025, RH + 0.006)],
          ["cbSeam" if lit else "cbSeamOff"])                                # the lit strip along the top
    if var == 1:                                                              # a ground anchor plate each side
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        pu, pv = -dv, du
        for k in (-1, 1):
            f.box(u + pu * k * (RW + 0.05), v + pv * k * (RW + 0.05), 0.0, 0.1, 0.1, 0.025, "cbClampD", top="cbClamp")
    if var == 2:                                                              # a cross-over step plate
        (u, v), (du, dv) = _at(path, _cum(path), L / 2)
        f.box(u, v, 0.0, 0.16 if du else 2 * RW + 0.06, 2 * RW + 0.06 if du else 0.16, RH + 0.02, "cbClampD",
              top="cbClamp")


def ramp(mask, lit, var=0):
    m = core.Mesh(f"cable_ramp_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    paths = [_arc(arms[0], arms[1], 12)] if len(arms) == 2 and mask not in (5, 10) else _edge_paths(mask, 0.18)
    for p in paths:
        _ramp_run(f, p, lit, var if mask in (5, 10) else 0)
    if len(arms) != 2:                                                        # a rubber junction pad with a box on it
        f.box(0, 0, 0.0, 0.48, 0.48, 0.04, "cbBandK", top="cbBand")
        f.box(0, 0, 0.04, 0.38, 0.38, 0.06, "cbSheath", top="cbSheath")
        f.box(0, 0, 0.1, 0.2, 0.2, 0.08, "cbBox", top="cbBoxL")
        f.box(0.06, 0.06, 0.18, 0.06, 0.06, 0.03, "cbClampD", top=_lamp(lit))
    return [m.build()]


# ---- pylon ----------------------------------------------------------------------------------------------------------

PZ, EZ, LR = 0.85, 0.6, 0.03                  # cable height at a post, at the tile edge (the lowest point); line radius


def _sag(s):
    """Line height at distance s (0..0.5) from the post: a catenary-like sag, flat at the tile edge where spans meet."""
    return EZ + (PZ - EZ) * (1 - 2 * s) ** 2


def _pylon_line(f, path):
    """The line from the tile edge (path start) to the post (path end, at s = 0)."""
    L = _cum(path)[-1]
    cum = _cum(path)
    n = 10
    rings = []
    for i in range(n + 1):
        t = L * i / n
        (u, v), (du, dv) = _at(path, cum, t)
        z = _sag(max(0.0, 0.5 - t))
        pu, pv = -dv, du
        rings.append([f.pt(u + pu * s, v + pv * s, z + zz) for s, zz in _round(LR, 0.0, 8)])
    for A, B in zip(rings, rings[1:]):
        for i in range(8):
            j = (i + 1) % 8
            f.poly([A[i], A[j], B[j], B[i]], "cbCabK", flip=True)


def _post(f, lit, var=0, big=False):
    w = 0.1 if big else 0.08
    f.box(0, 0, 0.0, 0.22, 0.22, 0.03, "cbClampD", top="cbClampD")                 # foot
    f.box(0, 0, 0.03, w, w, PZ - 0.03, "cbPipeD", top="cbPipe")                       # post
    for z in (PZ - 0.1, PZ - 0.05):                                               # insulator discs
        f.vcyl(0, 0, z, 0.06, 0.03, "cbClamp", top="cbBoxL", sides=10)
    f.box(0, 0, PZ, 0.06, 0.06, 0.04, "cbClampD", top="cbBoxL")
    if big:                                                                       # a junction box on the post
        f.box(0, 0, 0.18, 0.2, 0.2, 0.2, "cbBox", top="cbBoxL")
        f.box(0.06, 0.06, 0.38, 0.06, 0.06, 0.03, "cbClampD", top=_lamp(lit))
    if var == 1:                                                                  # a beacon on top
        f.box(0, 0, PZ + 0.04, 0.07, 0.07, 0.05, "cbClampD", top=_lamp(lit))
    if var == 2:                                                                  # a hazard sign on the post
        f.box(0.0, 0.0, 0.3, 0.13, 0.13, 0.13, "cbBand", top="cbBandK")


def pylon(mask, lit, var=0):
    m = core.Mesh(f"cable_pylon_{mask}_{lit}_{var}")
    f = _frame(m)
    arms = _arms(mask)
    for d in arms:
        _pylon_line(f, _line((d[0] * 0.5, d[1] * 0.5), (0.0, 0.0), 6))
    _post(f, lit, var if mask in (5, 10) else 0, big=len(arms) > 2)
    return [m.build()]


# ---- plugs ----------------------------------------------------------------------------------------------------------

def plug(look, dname, lit):
    """The socket on tile edge d where the cable meets a module or wall."""
    m = core.Mesh(f"cable_{look}_plug_{dname}_{lit}")
    f = _frame(m)
    du, dv = DIRS[dname][1]
    if look == "pylon":                                                       # a wall box at line height, the line into it
        z0, h, w = EZ - 0.16, 0.26, 0.26
    elif look == "conduit":
        z0, h, w = 0.0, 0.36, 0.36
        sweep(f, _sub(_line((du * 0.47, dv * 0.47), (du * 0.34, dv * 0.34)), 0, 0.13, 0.065),
              _round(CR + 0.035, CZ, HS), ["cbPipeD"], caps="cbPipeD")
    else:
        z0, h, w = 0.0, 0.2, 0.5
    f.box(du * 0.45, dv * 0.45, z0, 0.1 if du else w, w if du else 0.1, h, "cbBox", top="cbBoxL")
    if look == "ramp":
        f.box(du * 0.39, dv * 0.39, 0.0, 0.06 if du else 2 * RW + 0.04, 2 * RW + 0.04 if du else 0.06, RH + 0.02,
              "cbBandK", top="cbBand")
    f.box(du * 0.42, dv * 0.42, z0 + h, 0.07, 0.07, 0.03, "cbClampD", top=_lamp(lit))
    return [m.build()]


BUILD = {"conduit": conduit, "ramp": ramp, "pylon": pylon}


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
