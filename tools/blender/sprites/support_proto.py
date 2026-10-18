"""STYLE PROTOTYPE: shield generator (2x3), small shield generator (2x2), AI core (2x2), each with a ROOF PART (emitter dish /
sensor mast). Not wired into the game. Same clean look as console_proto.py: smooth gunmetal blocks, bevelled lips, seams, inset
panels; colour only from a few emissive parts (shields cyan, AI core magenta). No plinth: the body stands on the floor.

Local frame as in console_proto/cmbkit.Frame: footprint centred on the origin, FOOT = (depth along u, width along v) in tiles.
All three are solid (no walkable tile). `st` true = running: readouts, rings and eyes lit. Idle = powered down.
Roof parts are built with the same frame at height ZR (the roof plane) and share the module's sprite origin."""
import math

from . import cmbkit, core
from .cmbkit import Frame
from .console_proto import at, centre, tline, ybox

FOOT = {"shield_gen": (2, 3), "shield_small": (2, 2), "ai_core": (2, 2)}
ZR = 2.2                        # roof plane (local override of roofs.ZR / walls.HF in the scripts)
MARGIN = 0.04
READOUTS = []                   # (glass w, glass h, margin, [(x0, x1, t0, t1)]) in face-local metres, read by the overlap script


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def shell(f, u, v, z, d, w, h, mat):
    """Panelled block: body, a lighter bevel lip, a raised top skin."""
    ybox(f, u, v, z, d, w, h - 0.05, mat, 0, top=mat)
    ybox(f, u, v, z + h - 0.05, d - 0.07, w - 0.07, 0.05, "steelL", 0, top="plate")
    ybox(f, u, v, z + h, d - 0.2, w - 0.2, 0.015, "plateB", 0, top="plateB")


def faces(hd, hw):
    """(yaw, half extent along the face normal, face width) for the +u, -u, +v, -v faces of a box of half sizes hd, hw."""
    return [(0.0, hd, 2 * hw), (math.pi, hd, 2 * hw), (math.pi / 2, hw, 2 * hd), (-math.pi / 2, hw, 2 * hd)]


def fitem(f, cu, cv, face, x, z, p, t, w, h, mat):
    """Box on a face: x along the face, protruding p beyond it, t thick (so t - p is sunk in), w wide, h tall."""
    yaw, hn, _ = face
    u, v = at(cu, cv, yaw, x, hn + p - t / 2)
    ybox(f, u, v, z, t, w, h, mat, yaw)


def seams(f, cu, cv, hd, hw, z0, z1, rw0, extra=0.6):
    """Seams and inset panels on every face; rw = width of the readout window kept clear in the middle (0 = none)."""
    _g("panel")
    for i, face in enumerate(faces(hd, hw)):
        W = face[2]
        rw = rw0 if i < 2 else min(rw0, 0.8)
        if rw:
            s = [rw / 2 + 0.2] + ([rw / 2 + 0.2 + extra] if rw / 2 + 0.2 + extra < W / 2 - 0.2 else [])
            xs = sorted({-x for x in s} | set(s))
        else:
            xs = [-W / 4, W / 4]
        for x in xs:
            fitem(f, cu, cv, face, x, z0, 0.012, 0.03, 0.045, z1 - z0, "steelD")
        edges = [-W / 2] + xs + [W / 2]
        for a, b in zip(edges, edges[1:]):
            if rw and a < 0 < b:
                continue
            if b - a > 0.3:
                fitem(f, cu, cv, face, (a + b) / 2, z0 + 0.03, 0.008, 0.02, b - a - 0.14, z1 - z0 - 0.06, "plateB")


def readouts(f, cu, cv, hd, hw, rw, z, st, col, faces_sel=(0, 1, 2, 3), bright=(0, 3), muted="navy"):
    """Blank dark glass window on the chosen faces. Active: five bars, two bright (identity colour), the rest muted."""
    _g("screen")
    gh = 0.24
    for i, face in enumerate(faces(hd, hw)):
        if i not in faces_sel:
            continue
        w = rw if i < 2 else min(rw, 0.8)
        fitem(f, cu, cv, face, 0, z, 0.015, 0.03, w, gh, "dark")
        if not st:
            continue
        n, bw = 5, 0.09
        inner = w - 2 * MARGIN
        log = []
        for k in range(n):
            bh = (0.08, 0.14, 0.1, 0.16, 0.06)[k]
            x = -inner / 2 + bw / 2 + k * (inner - bw) / (n - 1)
            t = MARGIN
            fitem(f, cu, cv, face, x, z + t, 0.028, 0.02, bw, bh, col if k in bright else muted)
            log.append((x - bw / 2, x + bw / 2, t, t + bh))
        READOUTS.append((w, gh, MARGIN, log))


def pilots(f, cu, cv, hd, hw, z, col):
    """One tiny pilot light per face (the only lit part when idle)."""
    _g("lights")
    for face in faces(hd, hw):
        fitem(f, cu, cv, face, face[2] / 2 - 0.16, z, 0.025, 0.04, 0.07, 0.07, col)


def hexcells(f, u, v, z, R, w, mat):
    """Hex-cell motif (the shield console's): centre cell plus six neighbours as flat line work on a horizontal surface."""
    seen = set()
    cells = [(0.0, 0.0)] + [(math.sqrt(3) * R * math.cos(math.radians(30 + 60 * i)), math.sqrt(3) * R * math.sin(math.radians(30 + 60 * i))) for i in range(6)]
    for cx, cy in cells:
        pts = [(cx + R * math.cos(math.radians(60 * i)), cy + R * math.sin(math.radians(60 * i))) for i in range(6)]
        for i in range(6):
            a, b = pts[i], pts[(i + 1) % 6]
            k1 = tuple(round(c, 3) for c in a + b)
            k2 = tuple(round(c, 3) for c in b + a)
            if k1 in seen or k2 in seen:
                continue
            seen.add(k1)
            tline(f, u, v, z, 0.0, a, b, w, 0.02, 0.0, mat)


def hexpylon(f, u, v, z, r, h, st, ring, ring_off, lit):
    """Hexagonal pylon with a lighter cap and one light band (lit: bright, else muted/unlit)."""
    _g("core")
    f.vcyl(u, v, z, r, h, "gm", top="plate", sides=6)
    f.vcyl(u, v, z + h, r + 0.02, 0.05, "steelL", top="plate", sides=6)
    f.vcyl(u, v, z + ring_off, r + 0.025, 0.07, ring if (st and lit) else ("navy" if st else "steelD"), sides=6)
    f.vcyl(u, v, z, r + 0.02, 0.07, "steelD", sides=6)                                  # foot band


# ---- shield generators ----------------------------------------------------------------------------------------------

def shield_gen(f, st, big=True):
    d, w, hb = (1.9, 2.9, 0.5) if big else (1.9, 1.9, 0.45)
    sd, sw = (1.3, 2.3) if big else (1.2, 1.2)
    _g("body")
    shell(f, 0, 0, 0, d, w, hb, "steel")
    shell(f, 0, 0, hb, sd, sw, 0.3, "blueGrey")
    seams(f, 0, 0, d / 2, w / 2, 0.06, hb - 0.1, 1.6 if big else 1.0)
    readouts(f, 0, 0, d / 2, w / 2, 1.6 if big else 1.0, 0.12, st, "cyan", faces_sel=(0, 1, 2, 3), bright=(1, 3))
    pilots(f, 0, 0, d / 2, w / 2, 0.36, "cyan")
    cr, ch = (0.5, 0.7) if big else (0.4, 0.6)
    ztop = hb + 0.3
    hexpylon(f, 0, 0, ztop, cr, ch, st, "cyan", ch * 0.55, True)
    _g("lights")
    top = ztop + ch + 0.05
    f.vcyl(0, 0, top, cr - 0.04, 0.012, "dark" if st else "steelD", sides=6)
    hexcells(f, 0, 0, top + 0.012, 0.11 if big else 0.09, 0.045, "cyan" if st else "steelD")
    if big:
        for sv in (-0.88, 0.88):
            hexpylon(f, 0, sv, ztop, 0.27, 0.38, st, "cyan", 0.2, False)


def shield_big(f, st):
    shield_gen(f, st, True)


def shield_small(f, st):
    shield_gen(f, st, False)


# ---- AI core ----------------------------------------------------------------------------------------------------------

def ai_core(f, st):
    _g("body")
    shell(f, 0, 0, 0, 1.9, 1.9, 0.4, "steel")
    seams(f, 0, 0, 0.95, 0.95, 0.06, 0.3, 0)
    shell(f, 0, 0, 0.4, 1.3, 1.3, 0.95, "steelD")
    seams(f, 0, 0, 0.65, 0.65, 0.5, 1.25, 0, extra=0.0)
    _g("panel")
    for face in faces(0.65, 0.65):                                                    # slit array: dark slits, a few lit segments
        for k in range(5):
            fitem(f, 0, 0, face, 0, 0.58 + k * 0.14, 0.015, 0.03, 0.86, 0.07, "dark")
    _g("screen")
    if st:
        for face in faces(0.65, 0.65):
            for k, (x, mat) in enumerate(((-0.28, "navy"), (0.12, "magenta"), (-0.1, "navy"), (0.28, "magenta"), (-0.3, "magenta"))):
                fitem(f, 0, 0, face, x, 0.58 + k * 0.14, 0.028, 0.02, 0.14 if mat == "magenta" else 0.22, 0.07, mat)
    pilots(f, 0, 0, 0.95, 0.95, 0.24, "magenta")
    _g("tower")
    f.box(0, 0, 1.35, 1.3, 1.3, 0.22, "steel", top="plate", taper=0.7)
    f.vcyl(0, 0, 1.57, 0.26, 0.04, "steelL", top="plate", sides=8)
    f.vcyl(0, 0, 1.61, 0.2, 0.03, "dark", sides=8)
    _g("lights")
    if st:
        f.vcyl(0, 0, 1.64, 0.1, 0.035, "magenta", sides=8)


# ---- roof parts (sit on the roof plane, same sprite origin as the module) ------------------------------------------------

def dish(f, u, v, r, st, spire=True):
    z = ZR
    _g("rbase")
    f.vcyl(u, v, z, r * 0.62, 0.08, "steelD", top="steelL", sides=12)
    f.vcyl(u, v, z + 0.08, 0.2, 0.3, "gm", top="plate", sides=6)
    _g("rdish")
    f.vcyl(u, v, z + 0.34, 0.24, 0.26, "gm", top="plate", rtop=r, sides=14)               # cone opening into the dish
    f.vcyl(u, v, z + 0.6, r, 0.05, "steelL", top="plate", sides=14)                        # rim
    f.vcyl(u, v, z + 0.65, r * 0.84, 0.012, "dark", sides=14)                              # concave face
    _g("rlight")
    f.vcyl(u, v, z + 0.662, r * 0.66, 0.012, "cyan" if st else "steelD", sides=14)         # lit ring
    f.vcyl(u, v, z + 0.674, r * 0.5, 0.012, "dark", sides=14)
    if spire:
        _g("rspire")
        f.vcyl(u, v, z + 0.64, 0.1, 0.34, "gm", top="plate", rtop=0.07, sides=6)
        f.vcyl(u, v, z + 0.98, 0.075, 0.07, "cyan" if st else "steelD", sides=6)


def roof_shield_big(f, st):
    dish(f, 0, 0, 0.88, st)
    for sv in (-1.18, 1.18):                                                               # flanking projector pylons
        _g("rpylon")
        f.vcyl(0, sv, ZR, 0.24, 0.1, "steelD", top="steelL", sides=6)
        f.vcyl(0, sv, ZR + 0.1, 0.16, 0.34, "gm", top="plate", sides=6)
        f.vcyl(0, sv, ZR + 0.44, 0.19, 0.06, "steelL", top="plate", sides=6)
        _g("rlight")
        f.vcyl(0, sv, ZR + 0.5, 0.1, 0.06, "cyan" if st else "steelD", sides=6)


def roof_shield_small(f, st):
    dish(f, 0, 0, 0.74, st)


def roof_ai_core(f, st):
    z = ZR
    _g("rbase")
    ybox(f, 0, 0, z, 0.9, 0.9, 0.1, "steelD", 0, top="steelL")
    ybox(f, 0, 0, z + 0.1, 0.72, 0.72, 0.05, "steel", 0, top="plate")
    _g("rmast")
    ybox(f, 0, 0, z + 0.15, 0.2, 0.2, 1.1, "gm", 0, top="plate")                          # mast
    ybox(f, 0, 0, z + 0.2, 0.3, 0.3, 0.1, "steelL", 0, top="plate")                       # mast foot collar
    ybox(f, 0, 0, z + 0.66, 1.1, 0.12, 0.09, "steelL", 0, top="plate")                    # sensor booms
    ybox(f, 0, 0, z + 0.78, 0.12, 1.1, 0.09, "steelL", 0, top="plate")
    for su, sv in ((0.62, 0), (-0.62, 0), (0, 0.62), (0, -0.62)):
        _g("rtip")
        mat = ("magenta" if su > 0 or sv > 0 else "navy") if st else "dark"
        ybox(f, su, sv, z + (0.66 if su else 0.78) - 0.02, 0.15, 0.15, 0.13, mat, 0)
    _g("rmast")
    f.vcyl(0, 0, z + 1.25, 0.28, 0.06, "gm", top="plate", sides=8)                         # top sensor plate
    f.vcyl(0, 0, z + 1.31, 0.16, 0.1, "dark", top="dark", sides=8)                         # lens housing
    _g("rtip")
    f.vcyl(0, 0, z + 1.41, 0.1, 0.05, "magenta" if st else "steelD", sides=8)


BUILD = {"shield_gen": shield_big, "shield_small": shield_small, "ai_core": ai_core}
ROOF = {"shield_gen": roof_shield_big, "shield_small": roof_shield_small, "ai_core": roof_ai_core}


def model(name, rot, st, roof=False):
    nu, nv = FOOT[name]
    m = core.Mesh(f"{'roof' if roof else 'mod'}_{name}_{rot}_{int(st)}")
    (ROOF if roof else BUILD)[name](Frame(m, rot, centre=centre(rot, nu, nv)), st)
    return [m.build()]
