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
CHAIR = {"helm": (-0.5, 0.0), "shield": (-0.5, 0.0), "weapons": (-0.5, -0.5)}
EMPTY = {"shield": [(-0.5, 1.0)]}                                  # empty walkable footprint tiles (u, v) besides the chair
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


@cmbkit.prim
def tline(f, u, v, z, tl, a, b, w, h, d0, mat):
    """Thin box on the tilted disc plane from disc-local point a to b (x along e2, y along e1), width w, thickness h at offset d0."""
    e1, e2, n = (0, 1, 0), (math.cos(tl), 0, math.sin(tl)), (-math.sin(tl), 0, math.cos(tl))
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    ex, ey = dx / L, dy / L
    px, py = -ey, ex

    def P(i, j, s):
        x = (a[0] + b[0]) / 2 + i * ex * L / 2 + j * px * w / 2
        y = (a[1] + b[1]) / 2 + i * ey * L / 2 + j * py * w / 2
        q = d0 + (s + 1) / 2 * h
        return f.pt(u + x * e2[0] + y * e1[0] + q * n[0], v + x * e2[1] + y * e1[1] + q * n[1], z + x * e2[2] + y * e1[2] + q * n[2])
    P8 = {(i, j, s): P(i, j, s) for i in (-1, 1) for j in (-1, 1) for s in (-1, 1)}
    for i, ks in enumerate(FACES):
        f.poly([P8[k] for k in ks], mat, flip=True)


def hexcells(f, u, v, z, tl, R, w):
    """Centre hexagon plus its six neighbours (flat-top cells of circumradius R) as cyan line work, all inside the disc."""
    seen = set()
    cells = [(0.0, 0.0)] + [(math.sqrt(3) * R * math.cos(math.radians(30 + 60 * i)), math.sqrt(3) * R * math.sin(math.radians(30 + 60 * i))) for i in range(6)]
    for cx, cy in cells:
        pts = [(cx + R * math.cos(math.radians(60 * i)), cy + R * math.sin(math.radians(60 * i))) for i in range(6)]
        for i in range(6):
            a, b = pts[i], pts[(i + 1) % 6]
            key = (round(a[0], 3), round(a[1], 3), round(b[0], 3), round(b[1], 3))
            key2 = (round(b[0], 3), round(b[1], 3), round(a[0], 3), round(a[1], 3))
            if key in seen or key2 in seen:
                continue
            seen.add(key)
            assert max(math.hypot(*a), math.hypot(*b)) <= 0.285, "hex line leaves the disc"
            tline(f, u, v, z, tl, a, b, w, 0.02, 0.026, "cyan")


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


MIX = ("hazY", "iceB", "medRed", "pcb", "navy")   # muted (non-emissive) amber / soft blue / red / green / blue caps


def button_mat(k, st, col):
    """Active: about a third bright (identity colour, a little amber/white), the rest muted tints or unlit caps. Idle: pilots only."""
    if not st:
        return BTN[col][0] if k % 5 == 0 else "gmD"
    r = k % 6
    if r == 0:
        return BTN[col][0]
    if r == 3:
        return BTN[col][1] if k % 12 == 3 else DIM[col]
    if r in (1, 4):
        return MIX[(k * 2 + r) % 5]
    return "gmD" if r == 2 else "steelL"


def strip(f, u, v, yaw, w, z, n, off, st, col, pitch=None, thin=False):
    """Row of n square buttons across a desk top; idle shows only every fourth one lit."""
    _g("buttons")
    pitch = pitch or w / n
    for k in range(n):
        x = (k - (n - 1) / 2) * pitch
        mat = button_mat(k, st, col)
        if thin and mat == BTN[col][0] and st:
            mat = DIM[col]
        bu, bv = at(u, v, yaw, x, off)
        ybox(f, bu, bv, z, 0.065, 0.065, 0.04, mat, yaw)


def desk(f, u, v, yaw, w, d, h, st, col, nbtn=0, slab=True, base="steel", band=True, thin=False):
    """One desk bay: kick plate, panelled body with seams and a groove, a light edge rail, control slab."""
    _g("desk")
    ybox(f, u, v, 0.0, d, w, h, base, yaw, top="plate")
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
            strip(f, u, v, yaw, w - 0.16, h + 0.1, nbtn, -d * 0.12, st, col, thin=thin)
            _g("desk")


def chair(f, u, v, st):
    """Swivel chair facing +u: star base with casters, post, padded seat, back with headrest, armrests, brass pivot ring."""
    _g("chair")
    split = f.m if isinstance(f.m, _Split) else None
    if split:
        split.in_chair = True
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
        ybox(f, u + 0.0, v + sv * 0.25, 0.39, 0.06, 0.06, 0.15, "steelL")          # armrest post
        ybox(f, u + 0.03, v + sv * 0.25, 0.54, 0.3, 0.09, 0.05, "navy")            # armrest pad: top 0.59, under the seated elbows
    if split:
        split.in_chair = False


# ---- helm: a long curved desk with the chair in front ---------------------------------------------------------

def helm(f, st):
    col = "green"
    n, ph = 7, [math.radians(-62 + k * 124 / 6) for k in range(7)]
    pts = [(-0.5 + 1.0 * math.cos(p), 1.3 * math.sin(p)) for p in ph]
    sc = {0: (0.0, 0.0), 1: (0.38, 0.3), 2: (0.5, 0.34), 3: (0.74, 0.42), 4: (0.5, 0.34), 5: (0.38, 0.3), 6: (0.0, 0.0)}
    for k, (pu, pv) in enumerate(pts):
        p = ph[k]
        yaw = math.atan2(math.sin(p), 1.3 * math.cos(p))
        nb = pts[min(k + 1, n - 1)] if k < n - 1 else pts[k - 1]
        w = math.hypot(nb[0] - pu, nb[1] - pv) * 1.15
        desk(f, pu, pv, yaw, w, 0.46, 0.52, st, col, nbtn=4 if 0 < k < n - 1 else 3, thin=k % 2 == 1)
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
        f.box(-0.52, pv, 0.0, 0.58, 0.52, 0.44, "steel", top="plate")
        f.box(-0.52, pv, 0.2, 0.6, 0.54, 0.035, "steelD")
        f.box(-0.52, pv, 0.44, 0.46, 0.5, 0.05, "blueGrey", top="plateB", taper=0.9)
        f.box(-0.8, pv, 0.44, 0.06, 0.52, 0.04, "steelL", top="plate")
        strip(f, -0.62, pv, 0, 0.4, 0.49, 3, 0.0, st, col)
        _g("lever")
        for k in (-1, 1):
            f.vcyl(-0.5, pv + k * 0.12, 0.49, 0.03, 0.2, "gm", sides=6)
            f.vcyl(-0.5, pv + k * 0.12, 0.69, 0.055, 0.07, ("green" if k < 0 else "pcb") if st else "plate", sides=6)
        _g("desk")
    chair(f, *CHAIR["helm"], st)


# ---- shield console: tall hook of desk around the chair, nested shield rings ---------------------------------------

def shield(f, st):
    col = "cyan"
    desk(f, 0.56, 0, 0, 2.94, 0.82, 0.6, st, col, nbtn=0, slab=False, base="blueGrey")        # back bar behind the three monitors
    desk(f, -0.5, -0.95, 0, 0.9, 0.66, 0.5, st, col, nbtn=0, slab=False, base="steel")           # short counter, ends at the projector
    _g("desk")
    ybox(f, -0.52, -0.95, 0.5, 0.5, 0.8, 0.1, "blueGrey", 0, top="plateB", lean=-0.1)
    ybox(f, 0.4, 0, 0.6, 0.36, 2.8, 0.1, "blueGrey", 0, top="plateB", lean=-0.1)
    strip(f, -0.52, -0.95, 0, 0.6, 0.6, 4, -0.3, st, col)
    strip(f, 0.4, 0.75, 0, 0.7, 0.7, 4, -0.12, st, col)
    strip(f, 0.4, -0.75, 0, 0.7, 0.7, 4, -0.12, st, col)
    # three tall tilted screens above the back bar; the chair faces the middle one
    for k, (sv, sw) in enumerate(((-1.0, 0.8), (0.0, 0.8), (1.0, 0.8))):
        bars = [(-0.5 + i * 0.25, 0.6, 0.1, bh, kd) for i, (bh, kd) in enumerate(((0.12, "b"), (0.22, "a"), (0.1, "b"), (0.26, "a"), (0.16, "a")))]
        bars += [(0.0, 0.0, 0.8, 0.04, "a"), (0.0, 0.12, 0.55, 0.04, "a"), (0.0, 0.24, 0.3, 0.04, "a")]
        screen(f, 0.62, sv, 0, sw, 0.75, 0.7, col, st, bars, lean=-0.16, d=0.1)
    # projector at the end of the counter: one tilted disc (faces up and toward the operator) in a frame ring on a post
    _g("holo")
    pv, pz, tl = -1.05, 0.98, 0.3
    ybox(f, -0.5, pv, 0.55, 0.3, 0.3, 0.06, "steelD", top="plate")
    ybox(f, -0.5, pv, 0.61, 0.08, 0.08, pz - 0.61 - 0.03, "steelL")
    tdisc(f, -0.5, pv, pz, tl, 0.37, 0.05, "steelL", "plate", 0.3)
    tdisc(f, -0.5, pv, pz, tl, 0.3, 0.035, "navy" if st else "dark", "navy" if st else "dark", 0.0, dz=0.012)
    if st:                                                                         # hex-cell shield motif: cyan lines on the dark-cyan disc
        hexcells(f, -0.5, pv, pz, tl, 0.1, 0.03)
    chair(f, *CHAIR["shield"], st)


# ---- weapons console: squat chamfered U with a targeting scope and guarded fire buttons -------------------------------

def weapons(f, st):
    col = "red"
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
    f.vcyl(-0.2, -0.9, 0.65, 0.065, 0.07, "red" if st else "steelD", sides=6)
    # screens: one big targeting display, two small flanking
    for sv, sw, sh in ((0.0, 0.9, 0.5), (-0.7, 0.45, 0.3), (0.7, 0.45, 0.3)):
        bars = [(0.0, 0.0, 0.05, 0.4, "a"), (0.0, 0.5, 0.7, 0.04, "a"), (0.0, 0.5, 0.1, 0.07, "w"),
                (-0.4, 0.1, 0.12, 0.04, "b"), (0.4, 0.9, 0.12, 0.04, "b"), (0.45, 0.3, 0.08, 0.06, "a")]
        screen(f, 0.62, sv, 0, sw, sh + 0.1, 0.6, col, st, bars, lean=-0.14, d=0.1)
    # guarded fire buttons and the scope on the right bar
    _g("fire")
    for k, v in enumerate((0.42, 0.7)):
        f.vcyl(-0.36, v, 0.56, 0.095, 0.05, "steelL", sides=8)
        f.vcyl(-0.36, v, 0.61, 0.065, 0.05, "red" if st else "steelD", sides=8)
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


# ---- split for the seated operator ------------------------------------------------------------------------------

class _Split(core.Mesh):
    """Routes every polygon to one of three meshes: the chair, `front` = desk polygons whose centroid is nearer the camera
    than the chair centre (grid x + y larger), `back` = the rest. Lets the renderer draw a seated crew member between the
    console and its front overlay."""

    def __init__(self, name, chair_xy):
        super().__init__(name)
        self.parts = {k: core.Mesh(f"{name}_{k}") for k in ("back", "chair", "front")}
        self.depth, self.in_chair = chair_xy[0] + chair_xy[1], False

    def poly(self, pts, color, flip=False):
        if self.in_chair:
            k = "chair"
        else:
            n = len(pts)
            k = "front" if sum(p[0] - p[1] for p in pts) / n > self.depth else "back"   # Blender y = -grid y
        self.parts[k].poly(pts, color, flip)


def console_parts(name, rot, st):
    """-> {"back", "chair", "front": object}: the same geometry as console(), split for the seated-crew layering."""
    nu, nv = FOOT[name]
    f = Frame(None, rot, centre=centre(rot, nu, nv))
    m = _Split(f"console_{name}_{rot}_{int(st)}", f.xy(*CHAIR[name]))
    f.m = m
    BUILD[name](f, st)
    return {k: p.build() for k, p in m.parts.items()}
