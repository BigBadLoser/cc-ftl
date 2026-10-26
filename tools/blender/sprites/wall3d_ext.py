"""The hull from outside (roofed ships: enemy ships are seen so): tile.hull.ext.o{o}.m{mask}[.v1], o the side(s)
facing space as the near-hull ghosts' (1: +y, 2: +x, 3: both, the outer corner). The hull block runs right out to the
tile's space-facing edges (a cell short: its outer face is the ship's outline) and has no skirt: there is no room on
that side. Its outer faces carry armour instead of the interior's dressing (ext_face). A faction look dresses them
through its STYLE "ext" face; ext_face is the default's."""
import math

from . import wall3d as T

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE
E = 0.5 - 1 / 32                    # the ship's outline (a cell short of the tile's edge)
D = E                               # the armour's depth: the block's face stands this far in from the outline (at
                                    # the tile's middle: its top is the cap, half a tile deep, as hull 46's)


EXT_PAIRS = [(1, 0), (2, 0), (3, 0)]    # straight runs' variants .a1 ..: (top design, bottom design)


def ext_shell(o):
    class ExtShell(T.Shell):
        no_skirt = True
        no_cap = True                                   # (its top plain: the roof's own height)
        cap_fam = "steel"
        cap_band = 0.0                                  # (no cut band: the cap's plates run to its outer edge)

        def __init__(self, *args, **kw):
            super().__init__(*args, **kw)
            out = []
            f = E - D - {0: REC_BACK, 1: SLOT}.get(T.VARIANT[0], 0.0)  # (T3-1: the slot's depth further in; ext_face
            for (x0, x1, y0, y1), fam, t, top in self.rects:    # builds the cap's front back out round it)
                if fam == "hull":                       # (a cell short of the edge: a face on the tile's
                    x1 = f if o & 2 else x1             # own edge is the next tile's, so it is not built;
                    y1 = f if o & 1 else y1             # D in again: the armour's profile fills it)
                out.append(((x0, x1, y0, y1), fam, t, top))
            self.rects = out
            self.keep = None
            self.f = f

        def skip_skirt(self, i, j):
            return True

        def skirtz(self, x, y):                         # (its faces run down to the floor)
            return 0.0

        def col_top(self, i, j, kind, x, y):
            return TOP

        def col_face(self, face, x, y, z):
            if T.VARIANT[0] != 1 and abs((y if face == "y" else x) - self.f) < 1e-6:
                return None                             # (the armour covers its outer face: T3's recess dips behind)
            return T.RAMPS["steel"][1 if face == "x" else 0][1]
    return ExtShell


F = "steel"
TOP = T.RAMPS[F][0][3]              # the tops' tone (the lean a step lighter, as hull 46's)
SLOT = 7 / 32                       # T3-1: the slot cut into the cap's front edge (45 degrees, this deep), and how
SLOT_IN = 7 / 32                    # far in from each side it starts
LEAN = [(0.0, 0.8), (0.094, 0.65), (0.219, 0.452), (0.344, 0.252), (0.439, 0.09), (D, 0.0)]
# hull 46 T3's front above its upright part, measured off its end: (how far back from the outline, how far down from
# the top); it leans back from the outline 0.8 down to the cap's front edge, half a tile in


def _lean(H, z0=0.0):
    """The leaning front as (d, z) points (d out from the block's face), from height z0 up."""
    pts = [(D - b, H - dz) for b, dz in LEAN]
    out = []
    for (d0, za), (d1, zb) in zip(pts, pts[1:]):
        if zb <= z0:
            continue
        if za < z0:
            d0, za = d0 + (d1 - d0) * (z0 - za) / (zb - za), z0
        out.append((d0, za))
    return out + [pts[-1]]


def _arc(H, r, n=4):
    """A front rolled back onto the cap through a quarter circle of radius r."""
    q = [math.pi / 2 * i / n for i in range(n + 1)]
    return [(D - r + r * math.cos(t), H - r + r * math.sin(t)) for t in q]


def _lean_d(H, z):
    """The lean's d at height z."""
    pts = [(D - b, H - dz) for b, dz in LEAN]
    for (d0, z0), (d1, z1) in zip(pts, pts[1:]):
        if z <= z1 + 1e-9:
            return d0 + (d1 - d0) * max(0.0, z - z0) / (z1 - z0)
    return 0.0


def _lean_n(H, z0, off):
    """The lean from height z0 up as (d, z) points, moved off along its normal (< 0: in)."""
    pts = [(D - b, H - dz) for b, dz in LEAN]
    ln = [(_lean_d(H, z0), z0)] + [p for p in pts if p[1] > z0 + 1e-6]
    out = []
    for i, (d, z) in enumerate(ln):
        (da, za), (db, zb) = ln[max(0, i - 1)], ln[min(len(ln) - 1, i + 1)]
        h = math.hypot(db - da, zb - za)
        out.append((d + off * (zb - za) / h, z + off * (da - db) / h))
    return out


REC_IN, REC_BACK, REC_DOWN, REC = 5 / 32, 8 / 32, 8, PX / 2
LOW_IN = 9 / 32                     # T3's lower panels, under the lean's seam down to the bend: out to each tile edge
UP_IN = PX / 2                      # T3's upright part, from the floor to the lean: in under the lean's foot
# T3's top panel: a recess over the cap's edge, REC_IN in from each tile edge, REC_BACK back over the cap, REC_DOWN
# art px down the lean on screen, REC deep into the lean (and the cap's plates' height into the cap)


def SEAMS(H):
    """T3's two seams across, as grooves REC deep: (bottom, top) heights; one across the upright part, one across the
    lean under the panel."""
    return [(0.60, 0.665), (H - 0.35, H - 0.29)]


def _rec_z(H):
    """The height on the lean REC_DOWN art px under the cap's edge on screen."""
    from . import core
    z = H
    while (H - z) * core.ZPX + _lean_d(H, z) * core.TILE_H / 2 < REC_DOWN and z > H - LEAN[0][1]:
        z -= 0.001
    return z


def ext_face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
    """The default look's outer face (after Space Haven's hull 46, D3), a grey blockout of each top design's shape
    for now; the base is T3, and the others add or take away parts of it: 0 upright from the outline, then leaning
    back to the cap (T3); 1 cut away to the block's face, down to a floor sloping up to it from the outline, the lean
    left as a frame on the left, two struts from the floor by the back wall half way up it, a slot cut into the
    cap's front at 45 degrees (T3-1); 2 the lean a few
    px in from each side, T3-3's box between (T3-2); 3 a box out to the outline, its top edge
    slightly rounded (T3-3)."""
    from .factions_relief import prism
    t = T.VARIANT[0]

    def pr(u0, u1, prof, fam, lvl, mitre=(0.0, 0.0)):  # its flat tops in the top's tone (as the block's; a step
        nx = prof[1:] + prof[:1]                        # darker on a recess's floor, lvl 2)
        tc = TOP if lvl >= 3 else T.RAMPS[F][0][2]
        cols = [tc if abs(p[1] - q[1]) < 1e-9 and p[1] > 1.0 else None for p, q in zip(prof, nx)]
        prism(k, ax, plane, u0, u1, prof, fam, lvl, cols, mitre=mitre)
    mt = tuple(1.0 if e == "out" else 0.0 for e in ends)
    H = top
    base = [(0.0, 0.0), (D, 0.0)] + _lean(H) + [(0.0, H)]
    def box(q, r=0.14):                                 # T3-3's box: the base filled out upright, its edge
        return [(0.0, 0.0), (D, 0.0)] + [(d, z - q) for d, z in _arc(H, r, 6)] + \
            (_lean(H, H - q) if q else []) + [(0.0, H)]  # rounded (q: its top that far under the cap's)
    if t == 3:
        pr(a, b, box(1 / 32), F, 3, mitre=mt)
    elif t == 2:                                        # the base's lean a few px in from each side, T3-3's box
        e = 6 / 32                                      # between
        for s0, s1 in T.spans(a, b):
            first, last = abs(s0 - a) < 1e-6, abs(s1 - b) < 1e-6
            pr(s0, s0 + e, base, F, 3, mitre=(mt[0] if first else 0.0, 0.0))
            pr(s0 + e, s1 - e, box(0.0), F, 3)                                   # (flush)
            pr(s1 - e, s1, base, F, 3, mitre=(0.0, mt[1] if last else 0.0))
    elif t == 1:                                        # (measured off hull 46 T3-1)
        hc = H                                          # the top's front, built back out round the slot (level
        for s0, s1 in T.spans(a, b):                    # with it)
            for u0, u1 in ((s0, s0 + SLOT_IN), (s1 - SLOT_IN, s1)):
                pr(u0, u1, [(0.0, 0.0), (SLOT, 0.0), (SLOT, hc), (0.0, hc)], F, 3)
            pr(s0 + SLOT_IN, s1 - SLOT_IN, [(0.0, 0.0), (SLOT, 0.0), (SLOT, hc - SLOT), (0.0, hc)],
                  F, 3)
        plane += SLOT
        zf, zb = 0.38, 0.57                             # the cut's floor: at the outline, at the block's face; its
        pr(a, b, [(0.0, 0.0), (D, 0.0), (D, zf), (0.0, zb)], F, 3, mitre=mt)    # back wall the
        for s0, s1 in T.spans(a, b):                                                                 # block's face
            pr(s0, s0 + 0.08, [(0.0, zb), (D, zf)] + _lean(H) + [(0.0, H)], F, 3)  # a frame, left
            zm = (zb + H) / 2                                                                       # struts from the
            for u in (s0 + 0.24, s1 - 0.29):                                                        # floor by the back
                pr(u, u + 0.05, [(0.14, zb - 0.06), (0.2, zb - 0.08), (0.06, zm),      # wall, half way
                                                  (0.0, zm)], F, 4)                                  # up it
    else:                                               # the block's face REC_BACK further in, built back out
        _t3(k, ax, plane, a, b, mt, H)                  # over the top's front (the panel's recess sunk into it)


SHADE_X = 1                         # the shade (x) side's steps under the lit side's, on T3's faces
SEAM_UP = 3                         # T3's lean seam: raised this many px
KEY_SEAM, KEY_Z = 6, (2, 9)         # T3's lower centre block: its seam this many px over the bend, its keys from / to
KEYS = [(0.5 - 5 / 32, 0.5 - 1 / 32), (0.5 + 1 / 32, 0.5 + 5 / 32)]   # this many px over the seam, across here
PANEL = (0.15, 0.75)                # T3's upright armour panels (over and under its seam), across the tile
AO = 0.03                           # a px of height on the lean: the shadowed line along a recess's hidden top edge


def _t3_cols(ax, prof, role, H, q, zb):
    """T3's edge tones by facing (as hull 46's): the lean near white, the upright part a darker blue-grey, the top
    between; a lit step (a seam's or a recess's lower edge) a highlight; role "floor" (a recess) a step under its
    face, "dark" (a seam's floor, a recess's shadowed edge) three under (one at least)."""
    ys, xs = T.RAMPS[F]
    n = len(prof)
    A = sum(prof[i][0] * prof[(i + 1) % n][1] - prof[(i + 1) % n][0] * prof[i][1] for i in range(n)) / 2
    cd = sum((prof[i][0] + prof[(i + 1) % n][0]) * (prof[i][0] * prof[(i + 1) % n][1] -
             prof[(i + 1) % n][0] * prof[i][1]) for i in range(n)) / (6 * A)
    cz = sum((prof[i][1] + prof[(i + 1) % n][1]) * (prof[i][0] * prof[(i + 1) % n][1] -
             prof[(i + 1) % n][0] * prof[i][1]) for i in range(n)) / (6 * A)
    out = []
    for i in range(n):
        (d0, z0), (d1, z1) = prof[i], prof[(i + 1) % n]
        pd, pz = z1 - z0, d0 - d1
        if pd * ((d0 + d1) / 2 - cd) + pz * ((z0 + z1) / 2 - cz) < 0:
            pd, pz = -pd, -pz
        h = math.hypot(pd, pz) or 1.0
        pd, pz = pd / h, pz / h
        if pz > 0.85:                                   # a top: the roof's (TOP; a recess's floor under it) or a
            if z0 >= H - q - 1e-6:                      # lit step
                out.append(TOP if role == "face" else ys[2])
            else:
                hi = 4 if z0 < zb else 5                # (two steps over its face)
                out.append(ys[hi] if ax == "y" else xs[hi - SHADE_X])
            continue
        if pd < 0.3:                                    # (a bottom, the back: unseen)
            out.append(None)
            continue
        idx = 2 if (z0 + z1) / 2 < zb else 5            # upright / lean
        idx = {"face": idx, "plate": min(5, idx + 1), "plate2": min(5, idx + 2), "floor": idx - 1,
               "dark": max(1, idx - 3)}[role]
        out.append(ys[idx] if ax == "y" else xs[max(0, idx - SHADE_X)])
    return out


def _t3(k, ax, plane, a, b, mt, H):
    """T3 (the base): its face REC_BACK in from the outline, the armour built back out over the top's front; the
    lower lean's two edge strips recessed REC (a step darker, a shadowed line along their unseen edges). Its seams
    are painted, a px wide on screen (a groove that thin breaks up as the lean turns): one across the upright part
    (a lit line under it), one across the lean, and the top panel's outline over the top's edge."""
    from . import core
    from .factions_relief import prism
    RB, q = REC_BACK, T.LIP
    zr = _rec_z(H)
    lean = [(d + RB, z) for d, z in _lean(H)]
    zb = lean[0][1]
    ys, xs = T.RAMPS[F]

    def C(i):                                           # a ramp step on this face's side
        return ys[i] if ax == "y" else xs[max(0, i - SHADE_X)]

    def front(z0, z1, off=0.0):                         # the front between heights z0 and z1, off in
        if z0 < zb - 1e-6:                              # (the upright part: UP_IN in under the lean)
            f = D + RB - UP_IN - off
            return [(f, z0), (f, z1)]
        mid = [(d - off, z) for d, z in lean if z0 + 1e-6 < z < z1 - 1e-6]
        return [(_lean_d(H, z0) + RB - off, z0)] + mid + [(_lean_d(H, z1) + RB - off, z1)]

    def sec(z0, z1, off=0.0):
        return [(0.0, z0)] + front(z0, z1, off) + [(0.0, z1)]

    def sy(z):                                          # a front point's height on screen, in px down
        return -z * core.ZPX + front(z, z)[0][0] * core.TILE_H / 2

    def zpx(z, n):                                      # the height n px under z on screen (n < 0: over)
        y, t = sy(z) + n, z
        while (sy(t) < y) == (n > 0) and 0.0 < t < H:
            t += -0.0005 if n > 0 else 0.0005
        return t

    def line(u0, u1, z0, z1, col):                      # a painted band on the front
        fr = front(z0, z1)
        pf = [(d - 0.01, z) for d, z in fr] + [(d + PAINT, z) for d, z in fr[::-1]]
        prism(k, ax, plane, u0, u1, pf, F, 3, [col] * len(pf), col)

    def top_line(u0, u1, d0, d1):                       # a painted band on the top
        k.poly([T.P(ax, plane, u, H + PAINT, d) for u, d in ((u0, d0), (u1, d0), (u1, d1), (u0, d1))], F, 3,
               core.Vector((0, 0, 1)), fixed=C(2))

    (g0, g1), (l0, l1) = SEAMS(H)
    l0, l1 = (zpx(z, -SEAM_UP) for z in (l0, l1))       # (SEAM_UP px higher on screen)
    zp = zpx(l0, sy(l1) - sy(zr))                       # the lower panels' top: as far under the seam (on screen)
    L, R, ln = LOW_IN, REC_IN, LINE                     # as the top panel's bottom is over it
    face = [(0.0, 1.0, "face", 0.0)]
    strips = [(0.0, L - ln, "floor", REC), (L - ln, L, "dark", REC), None, (1 - L, 1.0, "floor", REC)]
    zs = zpx(zb, -KEY_SEAM)                             # the centre block's seam, two keys recessed over it
    k0, k1 = zpx(zs, -KEY_Z[0]), zpx(zs, -KEY_Z[1])
    keys = [(L, KEYS[0][0], "face", 0.0)] + [c for (u0, u1), (v0, _) in zip(KEYS, KEYS[1:] + [(1 - L, 0)])
                                             for c in ((u0, u1, "floor", REC), (u1, v0, "face", 0.0))]
    rows = [(0.0, zb, face),
            (zb, k0, [c or (L, 1 - L, "face", 0.0) for c in strips]),
            (k0, k1, [c for c in strips if c][:2] + keys + strips[3:]),
            (k1, zp - AO, [c or (L, 1 - L, "face", 0.0) for c in strips]),
            (zp - AO, zp, [(0.0, L, "dark", REC), (L, 1 - L, "face", 0.0), (1 - L, 1.0, "dark", REC)]),
            (zp, H, face)]
    for s0, s1 in T.spans(a, b):
        first, last = abs(s0 - a) < 1e-6, abs(s1 - b) < 1e-6
        whole = s1 - s0 > 1 - 1e-6
        for z0, z1, cells in rows:
            for u0, u1, role, off in (cells if whole else [(0.0, s1 - s0, "face", 0.0)]):
                pf = sec(z0, z1, off)
                mit = (mt[0] if first and u0 < 1e-6 else 0.0, mt[1] if last and u1 > s1 - s0 - 1e-6 else 0.0)
                prism(k, ax, plane, s0 + u0, s0 + u1, pf, F, 3, _t3_cols(ax, pf, role, H, q, zb), mitre=mit)
        gz = (g0 + g1) / 2                              # the seams
        line(s0, s1, gz, zpx(gz, -1), C(1))
        line(s0, s1, zpx(gz, 1), gz, C(4))
        line(s0, s1, zpx(l1, 1), l1, C(3))
        if whole:
            line(s0 + L, s1 - L, zs, zpx(zs, -1), C(3))
            p0, p1 = zpx(zb, -1), zpx(zp, 2)            # plates up out of the lower recesses to the lean's face, a
            pm = zpx((p0 + p1) / 2, 0.0)                # px in from their edges: two stacked in the left one, one in
            for u0, u1, z0, z1 in ((ln, L - 2 * ln, zpx(p0, -1), zpx(pm, 1)), (ln, L - 2 * ln, zpx(pm, -2), p1),
                                   (1 - L + 2 * ln, 1 - ln, p0, p1)):                          # the right
                fr = front(z0, z1)
                pf = [(d - REC - 0.005, z) for d, z in fr] + fr[::-1]
                prism(k, ax, plane, s0 + u0, s0 + u1, pf, F, 3, _t3_cols(ax, pf, "plate", H, q, zb))
        if whole:                                       # the top panel's outline
            line(s0 + R, s1 - R, zr, zpx(zr, -1), C(3))
            zt = zpx(zr, -2)                            # a faint seam either side of it, over its bottom
            for u0, u1 in ((s0, s0 + R), (s1 - R, s1)):
                line(u0, u1, zt, zpx(zt, -1), C(4))
            for u in (s0 + R, s1 - R - ln):
                line(u, u + ln, zr, H, C(3))
                top_line(u, u + ln, 0.0, RB)
            top_line(s0 + R, s1 - R, 0.0, 0.75 / 16)       # (a px on screen)
            fu = front(0.0, 0.0)[0][0]                  # the upright part's armour: a panel over its seam and one
            ph = 1 / core.ZPX                           # under it, a px proud (the upper one 2 px wider each side,
            up = (PANEL[0] - 2 * LINE, PANEL[1] + 2 * LINE)  # the lower down to the floor), a bolt in each corner
            for (u0, u1), z0, z1 in ((up, gz + 2 * ph, zb - 2 * ph), (PANEL, 0.0, gz - 2 * ph)):
                pf = [(fu - 0.01, z0), (fu + LINE, z0), (fu + LINE, z1), (fu - 0.01, z1)]
                prism(k, ax, plane, s0 + u0, s0 + u1, pf, F, 3, _t3_cols(ax, pf, "plate", H, q, zb))
                for v0, v1 in ((u0 + 2 * ln, u0 + 3 * ln), (u1 - 3 * ln, u1 - 2 * ln)):    # (a lit px, painted:
                    for w0, w1 in ((z0 + 2 * ph, z0 + 3 * ph), (z1 - 3 * ph, z1 - 2 * ph)):    # built that small
                        bf = [(fu + LINE - 0.01, w0), (fu + LINE + PAINT, w0), (fu + LINE + PAINT, w1),  # it breaks up)
                              (fu + LINE - 0.01, w1)]
                        prism(k, ax, plane, s0 + v0, s0 + v1, bf, F, 3, [C(4)] * 4, C(4))
        back = min((r[0][2] if ax == "y" else r[0][0]) for r in T.SHELL.rects if r[1] == "hull") - plane
        top_line(s0, s1, back + 2 / 16, back + 2.75 / 16)  # the top's seam, along its back


def ext_block(mask, o, variant=0):
    st = T.STYLE or {}
    return T.block(mask, "hull", variant, level="up", shell=ext_shell(o), dress=st.get("ext", ext_face))
