"""STYLE PROTOTYPE: the three multi-tile bridge consoles (helm 3x2, shield 3x2, weapons 2x2). Not wired into the game.

Local frame (cmbkit.Frame): the footprint is centred on the origin, u = the way the operator faces (toward the desk, the
back of the desk is +u), v across, z up. Each console owns ONE chair tile (the walkable access tile), the rest is solid
desk. FOOT = (depth along u, width along v) in tiles. CHAIR = chair tile centre (u, v). ENTRY = the tile crew walk in
from, in (u, v) (always one tile in front of the chair, -u).
Idle: screens dark with dim tinted content (non-emissive), a few pilot lights. Active (`st` true): content bright,
every button and rail light on."""
import math

from . import cmbkit, core
from . import detail as D
from .cmbkit import Frame

FOOT = {"helm": (2, 3), "shield": (2, 3), "weapons": (2, 2)}
CHAIR = {"helm": (-0.5, 0.0), "shield": (-0.5, 1.0), "weapons": (-0.5, -0.5)}
DIM = {"red": "rustD", "cyan": "navy", "green": "pcb"}                 # non-emissive stand-ins for idle screen content
BTN = {"red": ("red", "orange", "flameY"), "cyan": ("cyan", "arc", "green"), "green": ("green", "orange", "green")}
FACES = [((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)),
         ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)), ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)),
         ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)), ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1))]


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def centre(rot, nu, nv):
    """Footprint centre relative to the front-most tile centre (the sprite origin) for rotation `rot`."""
    f = Frame(None, rot, centre=(0.0, 0.0))
    tiles = [f.xy(-nu / 2 + 0.5 + i, -nv / 2 + 0.5 + j) for i in range(nu) for j in range(nv)]
    ox, oy = max(tiles, key=lambda t: (t[0] + t[1], t[0]))
    return (-ox, -oy)


@cmbkit.prim
def ybox(f, u, v, z, d, w, h, mat, yaw=0.0, top=None, lean=0.0):
    """Box standing at (u, v) from z, d deep along its normal N=(cos yaw, sin yaw), w wide along T=(-sin, cos). `lean` shifts
    the top face toward -N (positive = leans back toward the operator side, negative = away)."""
    c, s = math.cos(yaw), math.sin(yaw)

    def P(a, b, e):
        sh = lean if e > 0 else 0.0
        du = (a * d / 2 - sh) * c - b * w / 2 * s
        dv = (a * d / 2 - sh) * s + b * w / 2 * c
        return f.pt(u + du, v + dv, z + (h if e > 0 else 0.0))
    P8 = {(a, b, e): P(a, b, e) for a in (-1, 1) for b in (-1, 1) for e in (-1, 1)}
    for i, ks in enumerate(FACES):
        f.poly([P8[k] for k in ks], (top or mat) if i == 0 else mat, flip=True)


def at(u, v, yaw, x, off):
    """Point x along the tangent and off along the normal of a yawed frame at (u, v)."""
    c, s = math.cos(yaw), math.sin(yaw)
    return u + off * c - x * s, v + off * s + x * c


@cmbkit.prim
def tdisc(f, u, v, z, tl, r, h, mat, top, r_in, dz=0.0, sides=18):
    """Flat disc (or ring when r_in > 0) of radius r and thickness h centred at (u, v, z), tilted by `tl` about the v axis so its
    face points up and toward -u (the operator)."""
    e1, e2, n = (0, 1, 0), (math.cos(tl), 0, math.sin(tl)), (-math.sin(tl), 0, math.cos(tl))

    def P(rad, a, s):
        c, s_ = math.cos(a), math.sin(a)
        return f.pt(u + rad * s_ * e1[0] + rad * c * e2[0] + (s * h / 2 + dz) * n[0], v + rad * s_ * e1[1] + rad * c * e2[1] + (s * h / 2 + dz) * n[1],
                    z + rad * s_ * e1[2] + rad * c * e2[2] + (s * h / 2 + dz) * n[2])
    for i in range(sides):
        a0, a1 = i * math.tau / sides, (i + 1) * math.tau / sides
        if r_in:
            f.poly([P(r_in, a0, 1), P(r, a0, 1), P(r, a1, 1), P(r_in, a1, 1)][::-1], top, flip=True)
            f.poly([P(r_in, a0, -1), P(r, a0, -1), P(r, a1, -1), P(r_in, a1, -1)], mat, flip=True)
            f.poly([P(r_in, a0, -1), P(r_in, a1, -1), P(r_in, a1, 1), P(r_in, a0, 1)], mat, flip=True)
        else:
            f.poly([P(0, 0, 1), P(r, a0, 1), P(r, a1, 1)][::-1], top, flip=True)
            f.poly([P(0, 0, -1), P(r, a0, -1), P(r, a1, -1)], mat, flip=True)
        f.poly([P(r, a0, -1), P(r, a1, -1), P(r, a1, 1), P(r, a0, 1)], mat, flip=True)


SCREEN_LOG = []          # (name, glass w, glass h, margin, [(x0, x1, t0, t1)]) in screen-local metres, read by proto_console_overlap.py
MARGIN = 0.04            # keep-out between glass edge and any glyph (about 2 px at game scale)


def screen(f, u, v, yaw, w, h, z, col, st, bars, lean=-0.14, d=0.09):
    """Tilted screen (frame + glass + content) standing at z, centre (u, v), facing -N. Idle: blank dark glass. Active: bars
    [(fx, ft, fw, bh, kind)]: fx -0.5..0.5 and ft 0..1 place the bar inside the free area of the glass (so it can never leave
    it), fw is the width as a fraction of that area, bh the height in metres, kind 'a' accent / 'b' second colour / 'w' third."""
    _g("screen")
    ybox(f, u, v, z, d, w, h, "steelD", yaw, top="plate", lean=lean)
    hg, wg = h - 0.09, w - 0.1
    lg = lean * hg / h
    og = -d / 2 + (-lean) * 0.045 / h - 0.016
    gu, gv = at(u, v, yaw, 0, og + 0.012)
    ybox(f, gu, gv, z + 0.045, 0.024, wg, hg, "dark", yaw, lean=lg)
    wi, hi = wg - 2 * MARGIN, hg - 2 * MARGIN
    log = []
    for fx, ft, fw, bh, kind in (bars if st else []):
        bh = min(max(bh, 0.04), hi)
        bw = min(max(fw * wi, 0.04), wi)
        x = fx * (wi - bw)
        t = MARGIN + ft * (hi - bh)
        log.append((x - bw / 2, x + bw / 2, t, t + bh))
        base = {"a": col, "b": BTN[col][1], "w": BTN[col][2]}[kind]
        bu, bv = at(u, v, yaw, x, og - 0.004 + (-lg) * t / hg)
        ybox(f, bu, bv, z + 0.045 + t, 0.03, bw, bh, base, yaw, lean=lg * bh / hg)
    SCREEN_LOG.append((f"{w:.2f}x{h:.2f}", wg, hg, MARGIN, log))


def strip(f, u, v, yaw, w, z, n, off, st, col, pitch=None):
    """Row of n square buttons across a desk top; idle shows only every fourth one lit."""
    _g("buttons")
    pitch = pitch or w / n
    for k in range(n):
        x = (k - (n - 1) / 2) * pitch
        lit = st and k % 4 != 3 or (not st and k % 5 == 0)
        mat = BTN[col][(k // 2) % 3] if lit else "gmD"
        bu, bv = at(u, v, yaw, x, off)
        ybox(f, bu, bv, z, 0.065, 0.065, 0.04, mat, yaw)


def desk(f, u, v, yaw, w, d, h, st, col, nbtn=0, slab=True, base="steel", band=True):
    """One desk bay: kick plate, panelled body with seams and a groove, a light edge rail, control slab."""
    _g("desk")
    ybox(f, u, v, 0, d + 0.04, w + 0.02, 0.1, "steelD", yaw, top="plateA")
    ybox(f, u, v, 0.1, d, w, h - 0.1, base, yaw, top="plate")
    for k in range(max(1, round(w / 0.55)) + 1):                                     # panel seams
        x = (k - max(1, round(w / 0.55)) / 2) * w / max(1, round(w / 0.55))
        su, sv = at(u, v, yaw, x, 0)
        if abs(x) < w / 2 - 0.02:
            ybox(f, su, sv, 0.14, d + 0.03, 0.045, h - 0.24, "steelD", yaw)
    nb = max(1, round(w / 0.55))
    for k in range(nb):                                                              # inset panels between the seams
        x = (k - (nb - 1) / 2) * w / nb
        pu, pv = at(u, v, yaw, x, 0)
        ybox(f, pu, pv, 0.17, d + 0.014, w / nb - 0.12, h - 0.34, "plateB", yaw, top="plateB")
    lu, lv = at(u, v, yaw, 0, -d / 2 + 0.03)
    ybox(f, lu, lv, h, 0.06, w + 0.01, 0.04, "steelL", yaw, top="plate")                # bevelled edge rail
    ybox(f, u, v, h, d - 0.02, w - 0.02, 0.012, "plate", yaw, top="plate")             # raised top skin
    if slab:
        su, sv = at(u, v, yaw, 0, 0.1)
        ybox(f, su, sv, h, d * 0.62, w - 0.06, 0.1, "blueGrey", yaw, top="plateB", lean=-0.1)
        if nbtn:
            strip(f, u, v, yaw, w - 0.16, h + 0.1, nbtn, -d * 0.12, st, col)
            _g("desk")


def chair(f, u, v, st):
    """Swivel chair facing +u: star base with casters, post, padded seat, back with headrest, armrests, brass pivot ring."""
    _g("chair")
    D.seg(f, (u, v, 0.05), (u, v, 0.26), 0.05, "steelL", 8)
    for k in range(5):
        a = k * math.tau / 5 + 0.3
        cu, cv = u + 0.2 * math.cos(a), v + 0.2 * math.sin(a)
        ybox(f, u + 0.1 * math.cos(a), v + 0.1 * math.sin(a), 0.06, 0.2, 0.065, 0.045, "steelD", a)
        ybox(f, cu, cv, 0.0, 0.085, 0.085, 0.085, "dark")
    f.vcyl(u, v, 0.2, 0.075, 0.05, "brass", sides=8)                               # brass pivot ring
    ybox(f, u, v, 0.25, 0.44, 0.44, 0.07, "steelD", top="steelL")                  # seat pan
    ybox(f, u, v, 0.32, 0.4, 0.4, 0.07, "navy", top="navy")                        # seat cushion
    ybox(f, u - 0.205, v, 0.32, 0.05, 0.46, 0.07, "brass")                         # brass piping along the back edge
    ybox(f, u - 0.23, v, 0.39, 0.1, 0.42, 0.34, "steelD", lean=0.06)               # backrest frame
    ybox(f, u - 0.185, v, 0.43, 0.06, 0.36, 0.3, "navy", lean=0.05)                # back cushion
    ybox(f, u - 0.27, v, 0.73, 0.09, 0.26, 0.1, "navy", lean=0.05)                 # headrest
    for sv in (-1, 1):
        ybox(f, u + 0.0, v + sv * 0.25, 0.39, 0.06, 0.06, 0.12, "steelL")          # armrest post
        ybox(f, u + 0.03, v + sv * 0.25, 0.51, 0.3, 0.09, 0.05, "navy")            # armrest pad


# ---- helm: a long curved desk with the chair in front ---------------------------------------------------------

def helm(f, st):
    col = "green"
    _g("deck")
    f.box(0, 0, 0, 1.96, 2.96, 0.04, "steelD", top="plateA")
    n, ph = 7, [math.radians(-62 + k * 124 / 6) for k in range(7)]
    pts = [(-0.5 + 1.0 * math.cos(p), 1.3 * math.sin(p)) for p in ph]
    sc = {0: (0.0, 0.0), 1: (0.38, 0.3), 2: (0.5, 0.34), 3: (0.74, 0.42), 4: (0.5, 0.34), 5: (0.38, 0.3), 6: (0.0, 0.0)}
    for k, (pu, pv) in enumerate(pts):
        p = ph[k]
        yaw = math.atan2(math.sin(p), 1.3 * math.cos(p))
        nb = pts[min(k + 1, n - 1)] if k < n - 1 else pts[k - 1]
        w = math.hypot(nb[0] - pu, nb[1] - pv) * 1.15
        desk(f, pu, pv, yaw, w, 0.46, 0.52, st, col, nbtn=4 if 0 < k < n - 1 else 3)
        sw, sh = sc[k]
        if sw:
            su, sv = at(pu, pv, yaw, 0, 0.12)
            bars = [(0.0, 0.0, 0.5, 0.04, "a"), (0.0, 0.4, 0.8, 0.04, "a"), (0.2, 0.7, 0.55, 0.04, "b"), (-0.5, 1.0, 0.2, 0.06, "w")]
            if k == 3:
                bars = bars[1:] + [(-0.5 + i * 0.25, 0.0, 0.1, 0.1 + 0.06 * (i % 3), "a") for i in range(5)]
            screen(f, su, sv, yaw, sw, sh + 0.1, 0.72, col, st, bars, lean=-0.1)
    # yoke on the centre bay: stalk, rim wheel, hub, spokes
    _g("yoke")
    cu, cv = pts[3]
    yu = cu - 0.13
    f.vcyl(yu, cv, 0.52, 0.045, 0.26, "steelL", sides=8)
    f.vcyl(yu, cv, 0.78, 0.17, 0.035, "steelL", sides=10)
    f.vcyl(yu, cv, 0.815, 0.11, 0.02, "dark", sides=10)
    for a in (0, 1):
        ybox(f, yu, cv, 0.78, 0.3 if a == 0 else 0.05, 0.05 if a == 0 else 0.3, 0.05, "steelL")
    f.vcyl(yu, cv, 0.83, 0.05, 0.04, "green" if st else "pcb", sides=6)
    # side pods in front, with throttle levers and valves
    for sv in (-1, 1):
        pv = sv * 1.12
        _g("desk")
        f.box(-0.52, pv, 0.0, 0.62, 0.56, 0.1, "steelD", top="plateA")
        f.box(-0.52, pv, 0.1, 0.58, 0.52, 0.34, "steel", top="plate")
        f.box(-0.52, pv, 0.27, 0.6, 0.54, 0.035, "steelD")
        f.box(-0.52, pv, 0.44, 0.46, 0.5, 0.05, "blueGrey", top="plateB", taper=0.9)
        f.box(-0.8, pv, 0.44, 0.06, 0.52, 0.04, "steelL", top="plate")
        strip(f, -0.62, pv, 0, 0.4, 0.49, 3, 0.0, st, col)
        _g("lever")
        for k in (-1, 1):
            f.vcyl(-0.5, pv + k * 0.12, 0.49, 0.03, 0.2, "gm", sides=6)
            f.vcyl(-0.5, pv + k * 0.12, 0.69, 0.055, 0.07, "green" if st else "plate", sides=6)
        _g("desk")
    chair(f, *CHAIR["helm"], st)


# ---- shield console: tall hook of desk around the chair, nested shield rings ---------------------------------------

def shield(f, st):
    col = "cyan"
    _g("deck")
    f.box(0, 0, 0, 1.96, 2.96, 0.04, "steelD", top="plateA")
    desk(f, 0.56, 0, 0, 2.94, 0.82, 0.6, st, col, nbtn=0, slab=False, base="blueGrey")        # back bar
    desk(f, -0.5, -0.5, 0, 2.0, 0.66, 0.5, st, col, nbtn=0, slab=False, base="steel")           # side bar
    _g("desk")
    ybox(f, -0.5, 0.4, 0.0, 0.4, 0.3, 0.5, "steel", 0.7, top="plate")                            # chamfer toward the chair
    ybox(f, -0.5, 0.4, 0.5, 0.42, 0.32, 0.04, "steelL", 0.7)
    # control slabs
    ybox(f, -0.52, -0.5, 0.5, 0.5, 1.9, 0.1, "blueGrey", 0, top="plateB", lean=-0.1)
    ybox(f, 0.4, 0, 0.6, 0.36, 2.8, 0.1, "blueGrey", 0, top="plateB", lean=-0.1)
    strip(f, -0.52, -0.9, 0, 0.9, 0.6, 5, -0.3, st, col)
    strip(f, 0.4, 0.55, 0, 0.9, 0.7, 6, -0.12, st, col)
    strip(f, 0.4, -1.1, 0, 0.7, 0.7, 4, -0.12, st, col)
    # three tall tilted screens above the back bar
    for k, (sv, sw) in enumerate(((-1.0, 0.8), (0.0, 0.8), (1.0, 0.9))):
        bars = [(-0.5 + i * 0.25, 0.6, 0.1, bh, kd) for i, (bh, kd) in enumerate(((0.12, "b"), (0.22, "a"), (0.1, "b"), (0.26, "a"), (0.16, "a")))]
        bars += [(0.0, 0.0, 0.8, 0.04, "a"), (0.0, 0.12, 0.55, 0.04, "a"), (0.0, 0.24, 0.3, 0.04, "a")]
        screen(f, 0.62, sv, 0, sw, 0.75, 0.7, col, st, bars, lean=-0.16, d=0.1)
    # projector on the side bar: one tilted disc (faces up and toward the operator) in a frame ring on a post
    _g("holo")
    pv, pz, tl = -0.55, 0.98, 0.3
    ybox(f, -0.5, pv, 0.55, 0.3, 0.3, 0.06, "steelD", top="plate")
    ybox(f, -0.5, pv, 0.61, 0.08, 0.08, pz - 0.61 - 0.03, "steelL")
    tdisc(f, -0.5, pv, pz, tl, 0.37, 0.05, "steelL", "plate", 0.3)
    tdisc(f, -0.5, pv, pz, tl, 0.3, 0.035, "cyan" if st else "dark", "cyan" if st else "dark", 0.0, dz=0.012)
    # tall side pillar at the outer end
    _g("pylon")
    ybox(f, -0.5, -1.38, 0.0, 0.46, 0.22, 0.95, "steelL", top="plate")
    ybox(f, -0.5, -1.38, 0.95, 0.5, 0.26, 0.04, "steelL")
    for k in range(3):
        ybox(f, -0.5, -1.38, 0.2 + k * 0.25, 0.5, 0.24, 0.05, "steelD")
    D.rail(f, (-0.5, -1.38, 1.0), (-0.5, -1.38, 1.1), 0.05, "cyan" if st else "navy")
    f.vcyl(-0.5, -1.38, 1.0, 0.07, 0.1, "cyan" if st else "navy", sides=6)
    chair(f, *CHAIR["shield"], st)


# ---- weapons console: squat chamfered U with a targeting scope and guarded fire buttons -------------------------------

def weapons(f, st):
    col = "red"
    _g("deck")
    f.box(0, 0, 0, 1.96, 1.96, 0.04, "steelD", top="plateA")
    desk(f, 0.52, 0, 0, 1.94, 0.88, 0.5, st, col, nbtn=0, slab=False, base="steelD")          # back bar
    desk(f, -0.5, 0.55, 0, 0.84, 0.95, 0.46, st, col, nbtn=0, slab=False, base="steelD")      # right bar
    _g("desk")
    ybox(f, 0.02, 0.18, 0.0, 0.46, 0.32, 0.5, "steelD", -0.785, top="plate")                    # inner chamfer
    ybox(f, 0.02, 0.18, 0.5, 0.48, 0.34, 0.04, "steelL", -0.785)
    for u, v, y0, w, d, h in ((0.5, 0.0, 0, 1.9, 0.36, 0.5), (-0.48, 0.55, 0, 0.78, 0.5, 0.46)):
        ybox(f, u, v, h, d, w, 0.1, "plateA", y0, top="plateB", lean=-0.1)
    strip(f, 0.38, -0.5, 0, 0.8, 0.6, 4, -0.1, st, col)
    strip(f, 0.38, 0.55, 0, 0.7, 0.6, 4, -0.1, st, col)
    strip(f, -0.55, 0.62, 0, 0.6, 0.56, 3, -0.1, st, col)
    # left arm pod with a flight stick, in the chair tile's edge (U shape)
    _g("desk")
    ybox(f, -0.4, -0.9, 0.0, 0.8, 0.2, 0.4, "steelD", top="plate")
    ybox(f, -0.4, -0.9, 0.4, 0.84, 0.22, 0.04, "steelL")
    strip(f, -0.55, -0.9, 0, 0.24, 0.45, 2, 0.0, st, col)
    _g("lever")
    f.vcyl(-0.2, -0.9, 0.45, 0.04, 0.2, "gm", sides=6)
    f.vcyl(-0.2, -0.9, 0.65, 0.065, 0.07, "red" if st else "rustD", sides=6)
    # screens: one big targeting display, two small flanking
    for sv, sw, sh in ((0.0, 0.9, 0.5), (-0.7, 0.45, 0.3), (0.7, 0.45, 0.3)):
        bars = [(0.0, 0.0, 0.05, 0.4, "a"), (0.0, 0.5, 0.7, 0.04, "a"), (0.0, 0.5, 0.1, 0.07, "w"),
                (-0.4, 0.1, 0.12, 0.04, "b"), (0.4, 0.9, 0.12, 0.04, "b"), (0.45, 0.3, 0.08, 0.06, "a")]
        screen(f, 0.62, sv, 0, sw, sh + 0.1, 0.6, col, st, bars, lean=-0.14, d=0.1)
    # guarded fire buttons and the scope on the right bar
    _g("fire")
    for k, v in enumerate((0.42, 0.7)):
        f.vcyl(-0.36, v, 0.56, 0.095, 0.05, "steelL", sides=8)
        f.vcyl(-0.36, v, 0.61, 0.065, 0.05, "red" if st else "rustD", sides=8)
    _g("scope")
    for u in (-0.7, -0.45):
        ybox(f, u, 0.55, 0.56, 0.08, 0.08, 0.06, "steelL")
    f.hcyl(-0.82, -0.3, 0.55, 0.69, 0.07, "gm", sides=8, cap="plate", capstart="lens" if st else "dark")
    f.hcyl(-0.84, -0.8, 0.55, 0.69, 0.085, "steelL", sides=8, cap="plate", capstart="plate")
    chair(f, *CHAIR["weapons"], st)


BUILD = {"helm": helm, "shield": shield, "weapons": weapons}


def console(name, rot, st):
    nu, nv = FOOT[name]
    m = core.Mesh(f"console_{name}_{rot}_{int(st)}")
    BUILD[name](Frame(m, rot, centre=centre(rot, nu, nv)), st)
    return [m.build()]
