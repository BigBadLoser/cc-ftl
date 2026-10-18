"""STYLE PROTOTYPE: shield generator (2x3), small shield generator (2x2), AI core (2x2), each with a ROOF PART (emitter dish /
sensor mast). Not wired into the game. Same clean look as console_proto.py: smooth gunmetal blocks, bevelled lips, seams, inset
panels; colour only from a few emissive parts (shields cyan, AI core magenta). No plinth: the body stands on the floor.

Local frame as in console_proto/cmbkit.Frame: footprint centred on the origin, FOOT = (depth along u, width along v) in tiles.
All three are solid (no walkable tile). `st` true = running: readouts, rings and eyes lit. Idle = powered down.
Roof parts are built with the same frame at height ZR (the roof plane) and share the module's sprite origin. They fold into the
module: `stowed` = armoured hatch closed flush on the roof; deploy frames f0..f3 (hatch slides open along v, the part telescopes up
and unfolds); the deployed sprite is f4. No floor slab: bodies stand on small kicks straight from the floor."""
import math

from . import cmbkit, core
from .cmbkit import Frame
from .console_proto import at, centre, tline, ybox

FOOT = {"shield_gen": (2, 3), "shield_small": (2, 2), "ai_core": (2, 2)}
ZR = 2.4                        # roof plane (local override of roofs.ZR / walls.HF in the scripts)
MARGIN = 0.04
READOUTS = []                   # (glass w, glass h, margin, [(x0, x1, t0, t1)]) in face-local metres, read by the overlap script


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name




def install_palette():
    """Muted (non-emissive) magenta stand-ins for the AI core's idle and unlit parts. Local to the prototype scripts: call before the
    first post.select()."""
    from . import post
    for n, h in (("plum", "#8a3478"), ("plumD", "#4a2044")):
        post.EXTRA[n] = {"hex": h}
        core.palette._data[n] = {"hex": h}


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def shell(f, u, v, z, d, w, h, mat):
    """Panelled block: body, a lighter bevel lip, a raised top skin."""
    ybox(f, u, v, z, d, w, h - 0.05, mat, 0, top=mat)
    ybox(f, u, v, z + h - 0.05, d - 0.07, w - 0.07, 0.05, "steelL", 0, top="plate")
    ybox(f, u, v, z + h, d - 0.2, w - 0.2, 0.015, "plateB", 0, top="plateB")


def cabinet(f, u, v, d, w, h, mat, kick=0.1):
    """Body straight from the floor on a narrow dark kick recess (no plinth, no wider base)."""
    ybox(f, u, v, 0, d - 0.16, w - 0.16, kick + 0.02, "dark", 0)
    shell(f, u, v, kick, d, w, h - kick, mat)


def faces(hd, hw):
    """(yaw, half extent along the face normal, face width) for the +u, -u, +v, -v faces of a box of half sizes hd, hw."""
    return [(0.0, hd, 2 * hw), (math.pi, hd, 2 * hw), (math.pi / 2, hw, 2 * hd), (-math.pi / 2, hw, 2 * hd)]


def fitem(f, cu, cv, face, x, z, p, t, w, h, mat):
    """Box on a face: x along the face, protruding p beyond it, t thick (so t - p is sunk in), w wide, h tall."""
    yaw, hn, _ = face
    u, v = at(cu, cv, yaw, x, hn + p - t / 2)
    ybox(f, u, v, z, t, w, h, mat, yaw)


def seams(f, cu, cv, hd, hw, z0, z1, rw0, extra=0.6):
    """Seams and inset panels on every face; rw0 = width of the readout window kept clear in the middle (0 = none)."""
    _g("panel")
    for i, face in enumerate(faces(hd, hw)):
        W = face[2]
        rw = rw0 if i < 2 else min(rw0, 0.8)
        if rw:
            s = [rw / 2 + 0.2] + [rw / 2 + 0.2 + extra]
            s = [x for x in s if x < W / 2 - 0.12]
            xs = sorted({-x for x in s} | set(s))
        else:
            xs = [-W / 4, W / 4] if W > 1.0 else []
        for x in xs:
            fitem(f, cu, cv, face, x, z0, 0.012, 0.03, 0.045, z1 - z0, "steelD")
        edges = [-W / 2] + xs + [W / 2]
        for a, b in zip(edges, edges[1:]):
            if rw and a < 0 < b:
                continue
            if b - a > 0.3:
                fitem(f, cu, cv, face, (a + b) / 2, z0 + 0.03, 0.008, 0.02, b - a - 0.14, z1 - z0 - 0.06, "plateB")


def readouts(f, cu, cv, hd, hw, rw, z, st, col, faces_sel=(0, 1, 2, 3), muted="navy"):
    """Blank dark glass window on the chosen faces. Active: bars, a third of them bright (identity colour), the rest muted."""
    _g("screen")
    gh = 0.24
    for i, face in enumerate(faces(hd, hw)):
        if i not in faces_sel:
            continue
        w = rw if i < 2 else min(rw, 0.8)
        fitem(f, cu, cv, face, 0, z, 0.015, 0.03, w, gh, "dark")
        if not st:
            continue
        n, bw = (5 if w > 0.7 else 3), 0.09
        inner = w - 2 * MARGIN
        log = []
        for k in range(n):
            bh = (0.08, 0.14, 0.1, 0.16, 0.06)[k]
            x = -inner / 2 + bw / 2 + k * (inner - bw) / (n - 1)
            fitem(f, cu, cv, face, x, z + MARGIN, 0.028, 0.02, bw, bh, col if k in ((1, 3) if n == 5 else (1,)) else muted)
            log.append((x - bw / 2, x + bw / 2, MARGIN, MARGIN + bh))
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


def clamp(x):
    return max(0.0, min(1.0, x))


# ---- shield generators ----------------------------------------------------------------------------------------------

def shield_gen(f, st):
    """2x3: a tall hex reactor tower (cyan band + hex cells) between two readout cabinets, all straight from the floor."""
    _g("body")
    for sv in (-1.08, 1.08):
        cabinet(f, 0, sv, 1.8, 0.76, 0.85, "steel")
        seams(f, 0, sv, 0.9, 0.38, 0.16, 0.7, 0.46)
        readouts(f, 0, sv, 0.9, 0.38, 0.46, 0.22, st, "cyan", faces_sel=(0, 1, 2, 3))
        pilots(f, 0, sv, 0.9, 0.38, 0.55, "cyan")
        _g("body")
    _g("core")
    r = 0.8
    f.vcyl(0, 0, 0, r - 0.08, 0.12, "dark", sides=6)                                       # kick recess
    f.vcyl(0, 0, 0.1, r, 0.55, "blueGrey", top="plate", sides=6)
    f.vcyl(0, 0, 0.65, r - 0.04, 0.7, "gm", top="plate", sides=6)
    f.vcyl(0, 0, 0.62, r + 0.025, 0.07, "cyan" if st else "steelD", sides=6)               # light band
    f.vcyl(0, 0, 1.12, r + 0.015, 0.06, "steelL", sides=6)
    f.vcyl(0, 0, 1.35, r, 0.06, "steelL", top="plate", sides=6)
    _g("lights")
    f.vcyl(0, 0, 1.41, r - 0.06, 0.012, "dark" if st else "steelD", sides=6)
    hexcells(f, 0, 0, 1.422, 0.17, 0.05, "cyan" if st else "steelD")


def shield_small(f, st):
    """2x2: ONE tall slim hex emitter column with a lit head, flanked by two low pedestals."""
    _g("body")
    for sv in (-0.78, 0.78):
        cabinet(f, 0, sv, 0.8, 0.38, 0.55, "steel")
        pilots(f, 0, sv, 0.4, 0.19, 0.3, "cyan")
        _g("body")
    _g("core")
    f.vcyl(0, 0, 0, 0.42, 0.12, "dark", sides=6)
    f.vcyl(0, 0, 0.1, 0.5, 0.6, "blueGrey", top="plate", sides=6)
    f.vcyl(0, 0, 0.7, 0.46, 0.7, "gm", top="plate", sides=6)
    f.vcyl(0, 0, 0.66, 0.525, 0.07, "steelL", sides=6)
    f.vcyl(0, 0, 1.15, 0.5, 0.07, "cyan" if st else "steelD", sides=6)                     # light band
    f.vcyl(0, 0, 1.4, 0.5, 0.32, "steelL", top="plate", rtop=0.3, sides=6)                 # tapering emitter head
    _g("lights")
    f.vcyl(0, 0, 1.72, 0.3, 0.04, "dark" if st else "steelD", sides=6)
    hexcells(f, 0, 0, 1.752, 0.075, 0.04, "cyan" if st else "steelD")


# ---- AI core ----------------------------------------------------------------------------------------------------------

def ai_core(f, st):
    """2x2: a tall dark server tower with slit arrays and an eye, straight from the floor on a kick recess."""
    _g("body")
    cabinet(f, 0, 0, 1.7, 1.7, 1.4, "steelD")
    seams(f, 0, 0, 0.85, 0.85, 0.16, 1.3, 0)
    _g("panel")
    for face in faces(0.85, 0.85):                                                    # slit array
        for k in range(5):
            fitem(f, 0, 0, face, 0, 0.5 + k * 0.17, 0.015, 0.03, 0.86, 0.08, "dark")
    _g("screen")
    for face in faces(0.85, 0.85):
        for k, x in enumerate((-0.28, 0.12, -0.1, 0.28, -0.3)):
            bright = st and k in (1, 3)
            mat = "magenta" if bright else ("plum" if st else ("plumD" if k % 2 == 0 else None))
            if mat:
                fitem(f, 0, 0, face, x, 0.5 + k * 0.17, 0.028, 0.02, 0.14 if bright else 0.22, 0.08, mat)
    pilots(f, 0, 0, 0.85, 0.85, 0.24, "magenta")
    _g("tower")
    f.box(0, 0, 1.4, 1.5, 1.5, 0.22, "steel", top="plate", taper=0.7)
    f.vcyl(0, 0, 1.62, 0.3, 0.04, "steelL", top="plate", sides=8)
    f.vcyl(0, 0, 1.66, 0.24, 0.03, "dark", sides=8)
    _g("lights")
    f.vcyl(0, 0, 1.69, 0.12, 0.035, "magenta" if st else "plum", sides=8)


# ---- roof parts: hatch + telescoping part (sit on the roof plane, same sprite origin as the module) -----------------------

FRAMES = [(0.5, 0.05), (1.0, 0.25), (1.0, 0.5), (1.0, 0.75)]    # (hatch open 0..1, part extension 0..1) for deploy.f0..f3; f4 = deployed
HS = 1.9                                                        # hatch frame outer size
OPEN = 0.8                                                      # opening


def hatch(f, s):
    """Armoured hatch: a low square frame around a dark well, two leaves that slide apart along v onto the frame (s 0 closed .. 1 open)."""
    z = ZR
    _g("rframe")
    b = (HS - OPEN) / 2
    for sg in (-1, 1):
        ybox(f, sg * (OPEN + b) / 2, 0, z, b, HS, 0.06, "steelD", 0, top="steelL")
        ybox(f, 0, sg * (OPEN + b) / 2, z, OPEN, b, 0.06, "steelD", 0, top="steelL")
    ybox(f, 0, 0, z, OPEN, OPEN, 0.02, "dark", 0)
    _g("rleaf")
    for sg in (-1, 1):
        ybox(f, 0, sg * (0.22 + 0.46 * s), z + 0.06, 0.9, 0.44, 0.06, "gm", 0, top="plate")
        ybox(f, 0, sg * (0.22 + 0.46 * s), z + 0.12, 0.7, 0.3, 0.012, "plateB", 0, top="plateB")


def dish(f, u, v, R, st, e, stowed=False):
    if stowed:
        return
    z0 = ZR + 0.02
    ease = clamp((e - 0.3) / 0.7)
    rr = 0.36 + (R - 0.36) * ease
    sh = 0.08 + 0.55 * e
    _g("rshaft")
    f.vcyl(u, v, z0, 0.2, sh + 0.04, "gm", top="plate", sides=6)
    zc = z0 + sh
    _g("rdish")
    f.vcyl(u, v, zc, 0.24, 0.24, "gm", top="plate", rtop=rr, sides=14)                    # cone opening into the dish
    f.vcyl(u, v, zc + 0.24, rr, 0.06, "steelL", top="plate", sides=14)                    # rim
    f.vcyl(u, v, zc + 0.30, rr * 0.86, 0.012, "dark", sides=14)                           # concave face
    _g("rlight")
    f.vcyl(u, v, zc + 0.312, rr * 0.7, 0.012, "cyan" if st else "steelD", sides=14)       # lit ring
    f.vcyl(u, v, zc + 0.324, rr * 0.52, 0.012, "dark", sides=14)
    _g("rspire")
    f.vcyl(u, v, zc + 0.3, 0.1, 0.1 + 0.3 * ease, "gm", top="plate", rtop=0.07, sides=6)
    f.vcyl(u, v, zc + 0.4 + 0.3 * ease, 0.075, 0.07, "cyan" if st else "steelD", sides=6)


def roof_shield_gen(f, st, s=1.0, e=1.0, stowed=False):
    hatch(f, s)
    dish(f, 0, 0, 0.95, st, e, stowed)
    for sv in (-1.2, 1.2):                                                                 # flanking projector pylons: telescoping stubs
        _g("rframe")
        ybox(f, 0, sv, ZR, 0.5, 0.5, 0.06, "steelD", 0, top="steelL")
        ee = 0.0 if stowed else e
        _g("rpylon")
        f.vcyl(0, sv, ZR + 0.06, 0.15, 0.04 + 0.6 * ee, "gm", top="plate", sides=6)
        f.vcyl(0, sv, ZR + 0.1 + 0.6 * ee, 0.2, 0.06, "steelL", top="plate", sides=6)
        if not stowed:
            _g("rlight")
            f.vcyl(0, sv, ZR + 0.16 + 0.6 * ee, 0.11, 0.06, "cyan" if st else "steelD", sides=6)


def roof_shield_small(f, st, s=1.0, e=1.0, stowed=False):
    hatch(f, s)
    dish(f, 0, 0, 0.92, st, e, stowed)


def roof_ai_core(f, st, s=1.0, e=1.0, stowed=False):
    hatch(f, s)
    if stowed:
        return
    z0 = ZR + 0.02
    hm = 0.25 + 1.4 * e
    ease = clamp((e - 0.25) / 0.75)
    L = 0.4 + 1.2 * ease
    zb = z0 + 0.55 * hm
    _g("rmast")
    ybox(f, 0, 0, z0, 0.26, 0.26, hm, "gm", 0, top="plate")
    ybox(f, 0, 0, zb, L, 0.14, 0.09, "steelL", 0, top="plate")                            # sensor booms
    ybox(f, 0, 0, zb + 0.09, 0.14, L, 0.09, "steelL", 0, top="plate")
    f.vcyl(0, 0, z0 + hm, 0.22 + 0.14 * ease, 0.06, "gm", top="plate", sides=8)           # top sensor plate
    f.vcyl(0, 0, z0 + hm + 0.06, 0.12 + 0.06 * ease, 0.1, "dark", top="dark", sides=8)
    _g("rtip")
    for su, sv in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        mat = ("magenta" if su > 0 or sv > 0 else "plum") if st else "plumD"
        ybox(f, su * (L / 2 + 0.07), sv * (L / 2 + 0.07), zb + (0 if su else 0.09) - 0.02, 0.16, 0.16, 0.13, mat, 0)
    f.vcyl(0, 0, z0 + hm + 0.16, 0.1, 0.05, "magenta" if st else "plum", sides=8)


BUILD = {"shield_gen": shield_gen, "shield_small": shield_small, "ai_core": ai_core}
ROOF = {"shield_gen": roof_shield_gen, "shield_small": roof_shield_small, "ai_core": roof_ai_core}


def model(name, rot, st, roof=False, stage=None):
    """stage: None = deployed; 'stowed'; or 0..3 for deploy.f0..f3."""
    nu, nv = FOOT[name]
    m = core.Mesh(f"{'roof' if roof else 'mod'}_{name}_{rot}_{int(st)}_{stage}")
    f = Frame(m, rot, centre=centre(rot, nu, nv))
    if not roof:
        BUILD[name](f, st)
    elif stage == "stowed":
        ROOF[name](f, False, 0.0, 0.0, True)
    elif stage is None:
        ROOF[name](f, st)
    else:
        ROOF[name](f, st, *FRAMES[stage])
    return [m.build()]
