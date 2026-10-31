"""Straight-wall variants for the faction looks, after the Space Haven reference sheets: each look's PAIRS list
(top design, ramp design) names its .a1 .. variants (structure.jobs), and its face reads wall3d.VARIANT while one
builds. The designs here are drawn into the look's own face (factions_relief) where its base part would be."""
import math

from mathutils import Vector

from . import wall3d as T

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE

DRONE_PAIRS = [(0, 1), (1, 0), (1, 1), (2, 0), (2, 1), (3, 0), (3, 1)]  # set 5: four tops x two ramps


def flat(k, ax, plane, u0, u1, z0, z1, d, col):
    """A patch of one palette name (col: a fixed colour, lit or not) standing d proud."""
    k.poly([T.P(ax, plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 0, T.OUT(ax),
           fixed=col)


def drone_open(k, ax, plane, u0, u1, z0, z1, F, t):
    """The drone block's place between its columns (u0..u1 x z0..z1), opened: t 1 a dark rack of red-lit bars
    (set 5 T1-2), t 2 machinery with a status light (T1-3)."""
    fam, lvl = ("rose", 0) if t == 1 else (F, 1)                                                     # its back: dark,
    T.paint(k, ax, plane, u0, u1, z0, z1, PAINT, fam, lvl)                                           # or grey
    T.slab(k, ax, plane, u0, u1, z1 - 0.04, z1, PX, F, 2, ends=(False, False))                     # its lintel and
    T.slab(k, ax, plane, u0, u1, z0, z0 + 0.04, PX, F, 3, ends=(False, False))                     # sill
    if t == 1:
        nr, nc = 5, 3
        w = (u1 - u0 - 0.08) / nc
        for i in range(nr):
            z = z0 + 0.1 + i * (z1 - z0 - 0.2) / (nr - 1)
            for j in range(nc):
                a = u0 + 0.04 + j * w
                flat(k, ax, plane, a + LINE, a + w - LINE, z - 0.013, z + 0.013, 2 * PAINT, "emR")
    elif t == 2:
        uc = (u0 + u1) / 2
        for a, b, za, zb_, lvl in ((u0 + 0.03, uc - 0.08, z1 - 0.24, z1 - 0.1, 4),       # parts in the bay
                                   (uc + 0.08, u1 - 0.03, z1 - 0.3, z1 - 0.1, 3),
                                   (u0 + 0.05, u1 - 0.05, z0 + 0.08, z0 + 0.13, 4)):
            T.slab(k, ax, plane, a, b, za, zb_, PX, F, lvl)
        for i, col in enumerate(("green", "flameY", "red")):                                    # the status light
            z = z1 - 0.12 - i * 0.06
            flat(k, ax, plane, uc - LINE, uc + LINE, z - 0.025, z + 0.025, PX, col)
        from .factions_relief import pipe                                                       # a row of pipes
        for z in (z0 + 0.19, z0 + 0.26, z0 + 0.33):                                             # under it
            pipe(k, [T.P(ax, plane, u, z, PX) for u in (u0 + 0.02, u1 - 0.02)], 0.03, "rose", 2, n=4,
                 flat=(T.RAMPS["rose"][0][4], T.RAMPS["rose"][0][2]))


def drone_ramp(plate, u0, u1, run_, r, **_):
    """The drone ramp's second design (set 5 B1-2): no outlined panel, two seams straight down it where the base
    design's panel has its sides (wall3d.skirt's outline, 0.08 in)."""
    for u in (u0 + 0.08 + LINE / 2, u1 - 0.08 - LINE / 2):
        plate([(u - LINE / 2, 0.02), (u + LINE / 2, 0.02), (u + LINE / 2, run_ - 0.05), (u - LINE / 2, run_ - 0.05)],
              PAINT, 0, 0.0)


NAVY_PAIRS = [(0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2),
              (5, 0), (5, 1), (5, 2)]                   # set 4: tops x ramps (no lit rack T3 or window panel T4)


def _box(k, ax, plane, u0, u1, z0, z1, d, cols, ch=0.0):
    """A box standing d proud, its top and foot chamfered ch, its faces in fixed colours (cols: foot, front, top;
    its ends the foot's)."""
    from .factions_relief import prism
    prism(k, ax, plane, u0, u1, [(0.0, z0), (d, z0 + ch), (d, z1 - ch), (0.0, z1)], "wall", 0,
          cols=[cols[0], cols[1], cols[2], cols[0]], cap=cols[0])


def navy_top(k, ax, plane, u0, u1, z0, z1, F, t):
    """A navy face's middle (u0..u1 x z0..z1, from over its foot strip to under its header) for top design t (set 4):
    1 control boxes, 2 red lockers, 3 a canister rack, 4 a window panel, each in a dark recess."""
    uc = (u0 + u1) / 2
    T.paint(k, ax, plane, u0, u1, z0, z1, 3 * PAINT, "rose", 1)                                      # the recess
    a, b, c, e = u0 + 0.04, u1 - 0.04, z0 + 0.04, z1 - 0.04                                          # inside it
    d = 4 * PAINT
    if t == 1:                                          # two control boxes: light bezels, dark windows packed with
        zm = (c + e) / 2                                # red and cream parts and small lights
        a, b = a + 0.06, b - 0.06
        for q0, q1 in ((c + 0.02, zm - 0.02), (zm + 0.02, e - 0.02)):
            T.slab(k, ax, plane, a, b, q0, q1, PX, F, 3)                                                 # bezel
            w0, w1, v0, v1 = a + 0.04, b - 0.04, q0 + 0.04, q1 - 0.04
            T.paint(k, ax, plane, w0, w1, v0, v1, PX, "rose", 1)                                         # window
            cw, ch = (w1 - w0) / 4, (v1 - v0) / 3
            for i in range(4):
                for j in range(3):
                    x0, y0 = w0 + i * cw, v0 + j * ch
                    if (i + j) % 3 == 1:                                                                 # cream parts
                        T.paint(k, ax, plane, x0 + LINE / 2, x0 + cw - LINE / 2, y0 + 0.01, y0 + ch - 0.01,
                                PX + PAINT, F, 5)
                    else:                                                                                # red parts
                        flat(k, ax, plane, x0 + LINE / 2, x0 + cw - LINE / 2, y0 + 0.01, y0 + ch - 0.01,
                             PX + 2 * PAINT, ("lvR", "drM", "lvR2")[(i + 2 * j) % 3])
            for fu, fz, col in ((0.3, 0.7, "green"), (0.65, 0.35, "green"), (0.8, 0.75, "flameY")):      # lights
                uu, zz = w0 + fu * (w1 - w0), v0 + fz * (v1 - v0)
                flat(k, ax, plane, uu - LINE, uu + LINE, zz - 0.025, zz + 0.025, PX + 3 * PAINT, col)
    elif t == 2:                                        # two red lockers, a lid notch on the upper
        zm = (c + e) / 2
        for q0, q1 in ((c, zm - 0.015), (zm + 0.015, e)):
            _box(k, ax, plane, a, b, q0, q1, 2 * PX, ("lvR2", "lvR", "drM"), ch=PX)              # (chamfered)
        flat(k, ax, plane, a + 0.04, uc - 0.04, e - 0.08, e - 0.055, 2 * PX + PAINT, "lvR2")
    elif t == 3:                                        # a rack of cream canisters
        nr, nc = 5, 3
        w, h = (b - a) / nc, (e - c) / nr
        for i in range(nc):
            for j in range(nr):
                T.slab(k, ax, plane, a + i * w + 2 * LINE, a + (i + 1) * w - 2 * LINE, c + j * h + 0.025,
                       c + (j + 1) * h - 0.025, PX / 2, F, 4)
    elif t == 4:                                        # a window panel: maroon over grey-blue glass
        zm = c + 0.55 * (e - c)
        T.paint(k, ax, plane, a, b, zm, e, d, "ochre", 2)
        T.paint(k, ax, plane, a, b, c, zm, d, F, 1)


def navy_band(k, ax, plane, a, b, ends, zh, H):
    """Top design 5 (set 4 T1-6): no recess; the maroon band thinner, a thin stripe under it."""
    T.run(k, ax, plane, a, b, ends, zh - 0.18 * H, zh, PAINT, "ochre", 3, 0)
    T.run(k, ax, plane, a, b, ends, zh - 0.28 * H, zh - 0.25 * H, PAINT, "ochre", 3, 0)


def navy_hole(r):
    """Where a navy ramp design is open (B1-2): (from, to) down the slope as fractions of its run (on through the toe
    band to near the floor), and how far past the field it reaches on either side."""
    return (0.06, 0.9, 0.12) if r == 1 else None


def _steel(k, q, n, up):
    k.poly(q, "wall", 0, n, fixed="fSH0" if n.normalized().dot(up) > 0.5 else "fSH2")      # neutral steel


def _collar(k, P, u, d, z, r, hw, up, n=8):
    """A steel collar round a pipe (centre (d, z), radius r) from u - hw to u + hw."""
    ring = [(d + r * math.cos(2 * math.pi * i / n + math.pi / n), z + r * math.sin(2 * math.pi * i / n + math.pi / n))
            for i in range(n)]
    c = P(u, z, d)
    for i in range(n):
        (da, za), (db, zb_) = ring[i], ring[(i + 1) % n]
        q = [P(u - hw, za, da), P(u + hw, za, da), P(u + hw, zb_, db), P(u - hw, zb_, db)]
        _steel(k, q, sum(q, Vector()) / 4 - c, up)
    for s_ in (-1, 1):
        q = [P(u + s_ * hw, zz, dd) for dd, zz in ring]
        _steel(k, q, P(1, 0, 0) - P(0, 0, 0) if s_ > 0 else P(0, 0, 0) - P(1, 0, 0), up)


def _bar(k, P, u, d0, d1, zf, hw, ht, up):
    """A steel bar from d0 to d1 along the pipes' centre line (zf(d) its height), hw wide, ht thick each way."""
    out_, along = P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    for zs_, n in ((ht, up), (-ht, -up)):
        _steel(k, [P(u - hw, zf(d0) + zs_, d0), P(u + hw, zf(d0) + zs_, d0), P(u + hw, zf(d1) + zs_, d1),
                   P(u - hw, zf(d1) + zs_, d1)], n + out_ * 0.3 * (1 if zs_ > 0 else -1), up)
    for s_ in (-1, 1):
        _steel(k, [P(u + s_ * hw, zf(d0) - ht, d0), P(u + s_ * hw, zf(d0) + ht, d0), P(u + s_ * hw, zf(d1) + ht, d1),
                   P(u + s_ * hw, zf(d1) - ht, d1)], along * s_, up)


def navy_ramp(plate, u0, u1, run_, r, k=None, pt=None, P=None, zs=0.0, hole=None, ax=0, plane=0.0, **_):
    """A navy ramp's design r (set 4). 1 (B1-2): its cover off over the hole the shell leaves (navy_hole): a dark
    cavity down to the floor (back, sides and floor), two pipes across it in the header tube's orange, tied by steel
    brackets. 2 (B1-3): two darker plates split down the middle. plate lays a plate on the slope, pt(u, d, rise) is
    a point on it, P(u, z, d) any point (d out from the wall)."""
    if r == 1 and hole:
        from .factions_relief import tube
        o0, o1, d0, d1 = hole
        zat = lambda d: zs * (1 - d / run_)            # noqa: E731   the ramp's height d out
        f = 0.004
        up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
        k.poly([P(o0, f, d0), P(o1, f, d0), P(o1, f, d1), P(o0, f, d1)], "wall", 0, up)                 # its floor,
        k.poly([P(o0, f, d0), P(o1, f, d0), P(o1, zat(d0), d0), P(o0, zat(d0), d0)], "wall", 0, out_)   # back
        for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
            k.poly([P(u, f, d0), P(u, zat(d0), d0), P(u, zat(d1), d1), P(u, f, d1)], "rose", 2, along * sg)
        rp = 0.06
        dz = (rp + 0.025) / math.cos(math.atan(zs / run_))           # sunk a radius and a bit under the slope
        rows = [d0 + fr * (d1 - d0) for fr in (0.18, 0.6)]
        for dd in rows:                                                     # the pipes, lit like the header tube
            tube(k, ax, plane, o0 - 0.005, o1 + 0.005, dd, zat(dd) - dz, rp)     # (ends in the side walls)
        w = o1 - o0
        for u in (o0 + w / 3, o0 + 2 * w / 3):         # steel brackets: a collar round each pipe, a bar between them
            for dd in rows:
                _collar(k, P, u, dd, zat(dd) - dz, rp + 0.015, 0.03, up)
            _bar(k, P, u, rows[0], rows[1], lambda d: zat(d) - dz, 0.02, 0.015, up)
    elif r == 2:
        uc = (u0 + u1) / 2
        for p0, p1 in ((u0 + 0.04, uc - LINE / 2), (uc + LINE / 2, u1 - 0.04)):
            plate([(p0, 0.04), (p1, 0.04), (p1, 0.66 * run_), (p0, 0.66 * run_)], PAINT, 1, 0.0)


CIVIL_PAIRS = [(1, 0), (2, 0), (3, 0)]                 # set 6: three more tops, the one ramp


CIVIL_D = 3 / 32                                        # how deep a shelf is let into the wall


def civil_field(s0, s1, zs, zh):
    """A civil stretch's field (f0, f1, g0, g1): its drawers' place, between the foot strip and the colour band."""
    return s0 + 0.07, s1 - 0.07, zs + 0.13, zh - 0.08


def _shelf_h(g0, g1):
    return 0.42 * (g1 - g0) - 0.08


def _shelves(f0, f1, g0, g1, t):
    """The open shelves of top design t in a field, (u0, u1, z0, z1) each, their sides on the face's cell edges (the
    shell opens whole cells), a cell in from the field's: seen from the right a shelf's far side shows its depth
    past its mouth, and so stays inside the tile."""
    h, gap = _shelf_h(g0, g1), 0.1                      # (design 2's one shelf; design 1 two of it, a thick board
    if t == 1:                                          # between, centred)
        z0 = (g0 + g1 - 2 * h - gap) / 2
        zz = [(z0 - 0.06, z0 + h - 0.06), (z0 + h + gap, z0 + 2 * h + gap)]          # (the lower one let down)
    elif t == 2:
        zz = [(g0, g0 + h)]
    else:
        return []
    c = 1 / T.W.GN
    return [(T.snap(f0) + c, T.snap(f1) - c, z0, z1) for z0, z1 in zz]


def civil_holes(a, b, zs, top, t):
    """Where a civil face is open for top design t's shelves (NavyShell.face_holes), as civil lays them out."""
    if top <= T.W.skirt_top() + T.W.CUT + 0.05:
        return []
    return [h for s0, s1 in T.spans(a, b) if s1 - s0 >= 0.45
            for h in _shelves(*civil_field(s0, s1, zs, top - 0.13 * (top - zs)), t)]


def _cavity(k, ax, plane, u0, u1, z0, z1, D, F):
    """The inside of an opening in the face, D deep: its back, ceiling, floor and sides."""
    o, al, up = T.OUT(ax), T.P(ax, 0, 1, 0, 0) - T.P(ax, 0, 0, 0, 0), Vector((0, 0, 1))
    Q = lambda u, z, d: T.P(ax, plane, u, z, d)        # noqa: E731
    k.poly([Q(u0, z0, -D), Q(u1, z0, -D), Q(u1, z1, -D), Q(u0, z1, -D)], F, 0, o)               # back
    k.poly([Q(u0, z1, 0), Q(u1, z1, 0), Q(u1, z1, -D), Q(u0, z1, -D)], F, 0, -up)               # ceiling
    k.poly([Q(u0, z0, 0), Q(u1, z0, 0), Q(u1, z0, -D), Q(u0, z0, -D)], F, 1, up)                # floor
    for u, sg in ((u0, 1), (u1, -1)):                                                            # sides
        k.poly([Q(u, z0, 0), Q(u, z1, 0), Q(u, z1, -D), Q(u, z0, -D)], F, 1, al * sg)


def _shelf(k, ax, plane, u0, u1, z0, z1, F):
    """An open shelf let into the face (its opening, civil_holes), a seam round its mouth."""
    _cavity(k, ax, plane, u0, u1, z0, z1, CIVIL_D, F)
    t = 0.026                                                                                    # its mouth's seam
    for q in ((u0 - LINE, u1 + LINE, z1, z1 + t), (u0 - LINE, u1 + LINE, z0 - t, z0), (u0 - LINE, u0, z0, z1),
              (u1, u1 + LINE, z0, z1)):
        T.paint(k, ax, plane, *q, 0.0, F, 2)


def _doors(k, ax, plane, u0, u1, z0, z1, F, hz):
    """Two doors side by side, each a seam outline (rounded corners), a short handle recess by the middle at hz."""
    from .factions_relief import rbox
    uc = (u0 + u1) / 2
    for a, b, hu in ((u0, uc - 0.01, uc - 0.1), (uc + 0.01, u1, uc + 0.1)):
        rbox(k, ax, plane, a, b, z0, z1, F, 2)
        T.paint(k, ax, plane, hu - 0.035, hu + 0.035, hz, hz + 0.026, 0.0, F, 2)


def civil_top(k, ax, plane, f0, f1, g0, g1, F, t):
    """A civil field (f0..f1 x g0..g1, between the foot strip and the colour band) for top design t (set 6): 1 two
    open shelves; 2 two small doors over an open shelf; 3 tall double doors with a table dropped down in front of
    them."""
    for h in _shelves(f0, f1, g0, g1, t):
        _shelf(k, ax, plane, *h, F)
    if t == 2:
        zm = g0 + _shelf_h(g0, g1) + 0.06                                                           # over its shelf
        _doors(k, ax, plane, f0, f1, zm, g1, F, zm + 0.07)
    elif t == 3:
        _doors(k, ax, plane, f0, f1, g0 + 0.06, g1, F, g0 + 0.2)
        from .factions_relief import prism
        z, d = g0 + 0.03, 0.16                                                                      # the table,
        T.slab(k, ax, plane, f0 - 0.02, f1 + 0.02, z, z + 0.05, d, F, 3, ends=(True, True))
        for u in (f0 + 0.04, f1 - 0.04 - 2 * LINE):                                                 # its two stays
            prism(k, ax, plane, u, u + 2 * LINE, [(0.0, z - 0.12), (0.0, z), (d - 0.03, z)], F, 1)


BAST_PAIRS = [(0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2), (3, 0), (3, 1), (3, 2)]   # set 8: 4 x 3


def _cells(k, ax, plane, u0, u1, z0, z1, d, nu, nz, cols):
    """A block of nu x nz lit cells over [u0, u1] x [z0, z1], a px apart, coloured cols[(i + j) % len(cols)]."""
    from .wall3d_variants import lamp
    w, h = (u1 - u0) / nu, (z1 - z0) / nz
    for i in range(nu):
        for j in range(nz):
            lamp(k, ax, plane, u0 + i * w, u0 + (i + 1) * w - LINE, z0 + j * h, z0 + (j + 1) * h - 0.02, d,
                 cols[(i + j) % len(cols)])


def _frame(k, ax, plane, u0, u1, z0, z1, d, F, lvl, t=0.03):
    """A raised frame t wide round [u0, u1] x [z0, z1], standing d proud."""
    for q in ((u0 - t, u1 + t, z1, z1 + t), (u0 - t, u1 + t, z0 - t, z0), (u0 - t, u0, z0, z1), (u1, u1 + t, z0, z1)):
        T.slab(k, ax, plane, *q, d, F, lvl, ends=(True, True))


BAST_DEEP = {1: 4 / 32}             # top designs whose cut goes deeper, and by how much (factions_relief.bast_r)
BAST_FLAT = (2,)                    # ... and whose cut's floor is flat (at the lower wall's top) instead of angled


def bastion_top(k, ax, plane, f0, f1, zlo, z0, z1, top, F, t, m=(0.0, 0.0), back=0.0):
    """A bastion wall's cut (f0..f1 between its posts; plane its back, bast_r() in from the wall's line; its back
    face from z0 up to the cornice at z1, its floor the angled face down from it to the lower wall's top at zlo at
    the wall's line; flat at zlo for BAST_FLAT) for top design t (set 8), machinery slotted into it as into the
    ramp's slot (m: its ends' mitres, at a corner; back: plane's depth from the face's): 0 the base: a hood under the
    cornice, two slats across the back, panel seams, a vent and bolts under them (all but the hood set from the
    bottom, so they line up where a partition meets the taller hull) (returns the hood's and slats'
    profiles, face-relative, for the corner to carry round);
    1 (a deeper cut) its angled floor raised and flattened, controls on it, an LED readout on the back
    over them, a sloped face from the readout's top out to the cut's top edge, a red strip on the lower wall; 2 a
    piece of equipment from the floor to the wall's top (through the cornice, top) in two tiers: the lower standing
    out past the wall's line, a keypad and a small readout on it, sloping out from its top to the upper tier's foot,
    further out, two readouts on that;
    3 a module filling the cut, two ribs over a framed indicator panel."""
    from .wall3d_variants import lamp
    from .factions_relief import prism, bast_r
    R = bast_r()
    uc, w, H = (f0 + f1) / 2, f1 - f0, z1 - z0
    dl = 2 * PAINT                                      # (lamps stand on the glass)
    if t == 0:                                          # (on the face's own plane, so the mitres at a corner
        profs = [[(0.0, z1 - 0.13), (0.5 * R, z1 - 0.13), (R, z1 - 0.07), (R, z1), (0.0, z1)]]   # pull back to
        profs += [[(0.0, za), (0.7 * R, za), (0.7 * R, za + 0.07), (0.0, za + 0.1)]               # meet its chamfer)
                  for za in (z0 + 0.49, z0 + 0.33)]                                                  # the hood, slats
        profs = [[(d + back, z) for d, z in pr] for pr in profs]
        for pr in profs:
            prism(k, ax, plane - back, f0, f1, pr, F, 3, mitre=m)
        g0, g1 = z0 + 0.06, z0 + 0.25                                                                # under them:
        for u in (f0 + w / 3, f1 - w / 3):                                                           # panel seams,
            T.paint(k, ax, plane, u - LINE / 2, u + LINE / 2, g0, g1, 0.0, F, 2)
        T.paint(k, ax, plane, f0 + 0.03, f1 - 0.03, g1 - 0.026, g1, 0.0, F, 2)
        for i in range(3):                                                                           # a small vent
            zz = (g0 + g1) / 2 + 0.03 - i * 0.05
            T.paint(k, ax, plane, uc - 0.07, uc + 0.07, zz - 0.026, zz, 0.0, F, 1)
        for u in (f0 + 0.05, f1 - 0.05 - LINE):                                                      # and bolts
            for zz in (g0 + 0.04, g1 - 0.08):
                T.paint(k, ax, plane, u, u + LINE, zz, zz + 0.026, PAINT, F, 4)
        return [(pr, 3) for pr in profs]
    elif t == 1:
        T.paint(k, ax, plane, f0, f1, zlo, z1, 0.0, F, 1)                                          # (a dark cut)
        zf = zlo + 0.1                                  # the angled floor, raised: zf at the wall's line, rising
        zb = zf + 0.55 * R                              # gently to the back
        prism(k, ax, plane, f0, f1, [(0.0, zlo), (R, zlo), (R, zf), (0.0, zb)], F, 3)
        a, b, q0, q1 = uc - 0.36 * w, uc + 0.36 * w, zb + 0.05, zb + 0.35
        T.paint(k, ax, plane, a - LINE, b + LINE, q0, q1, 0.0, F, 0)                                 # the readout
        nd = min(5, int((b - a - 0.04 + 2 * LINE) / (5 * LINE)))                                   # digits: each an
        u0 = T.snap(uc - (5 * nd - 2) * LINE / 2)       # outline 3 px wide, 2 px apart, on the px grid (read as 0s)
        for i in range(nd):
            u, v = u0 + 5 * i * LINE, u0 + (5 * i + 3) * LINE
            for q in ((u, v, q0 + 0.03, q0 + 0.056), (u, v, q1 - 0.056, q1 - 0.03), (u, u + LINE, q0 + 0.03, q1 - 0.03),
                      (v - LINE, v, q0 + 0.03, q1 - 0.03)):
                lamp(k, ax, plane, *q, dl, "emR")                                     # (dim: a glow fills the gaps)
        zr = q1 + 0.04                                  # over it, a face sloping out to the cut's top edge from a
        prism(k, ax, plane, f0, f1, [(0.0, zr), (1 / 32, zr), (R, z1), (0.0, z1)], F, 3)            # px lip
        o, up = T.OUT(ax), Vector((0, 0, 1))
        n = (o * (zb - zf) + up * R).normalized()

        def key(u0, u1, g0, g1, col):                   # (on the angled floor; g: the way out it, 0 at its back)
            Q = lambda u, g: T.P(ax, plane, u, zb + g * (zf - zb), g * R) + n * PAINT            # noqa: E731
            k.poly([Q(u0, g0), Q(u1, g0), Q(u1, g1), Q(u0, g1)], F, 0, n, fixed=col)
        for u0, col in ((a, "flameY"), (a + 0.04, "red"), (b - 0.075, "flameY"), (b - 0.035, "red")):
            key(u0, u0 + 0.035, 0.3, 0.7, col)
        key(uc - 0.08, uc + 0.08, 0.2, 0.8, "green")
        lamp(k, ax, plane, uc - 0.22 * w, uc + 0.22 * w, zlo - 0.055, zlo - 0.03, R, "emR")          # the strip
    elif t == 2:
        A, B = R + 3.5 / 32, R + 7.5 / 32               # the tiers' fronts (past the wall's line by 3.5 and 7.5 px)
        z1 = top - 0.02                                 # (up to the cornice's top: it hides the cornice there)
        H2 = z1 - zlo
        zt, zu = zlo + 0.5 * H2, zlo + 0.5 * H2 + (B - A)                                            # tier 1's top,
        prism(k, ax, plane, f0, f1, [(0.0, zlo), (A, zlo), (A, zt), (0.0, zt)], F, 2)               # tier 2's foot
        prism(k, ax, plane, f0, f1, [(0.0, zt), (A, zt), (B, zu), (B, z1), (0.0, z1)], F, 2)
        fp = plane + A                                  # tier 1: a keypad and a small readout
        r0, r1 = zt - 0.36, zt - 0.08                    # (high on it, where hands reach)
        a, b = uc - 0.36 * w, uc + 0.36 * w
        _frame(k, ax, fp, a, uc - 0.03, r0, r1, 0.025, F, 3)
        T.paint(k, ax, fp, a, uc - 0.03, r0, r1, 0.0, F, 0)
        _cells(k, ax, fp, a + 0.02, uc - 0.05, r0 + 0.02, r1 - 0.02, dl, 3, 4, ("alG",))
        _frame(k, ax, fp, uc + 0.05, b, r0, r1, 0.025, F, 3)
        T.paint(k, ax, fp, uc + 0.05, b, r0, r1, 0.0, F, 0)
        _cells(k, ax, fp, uc + 0.07, b - 0.02, r0 + 0.02, r1 - 0.02, dl, 1, 3, ("green", "flameY"))
        fp = plane + B                                  # tier 2: an indicator readout and a green screen
        q0, q1 = zu + 0.06, z1 - 0.08
        _frame(k, ax, fp, a, a + 0.14, q0, q1, 0.025, F, 3)
        T.paint(k, ax, fp, a, a + 0.14, q0, q1, 0.0, F, 0)
        _cells(k, ax, fp, a + 0.02, a + 0.12, q0 + 0.03, q1 - 0.03, dl, 2, 4, ("flameY", "red"))
        _frame(k, ax, fp, a + 0.19, b, q0, q1, 0.025, F, 3)
        lamp(k, ax, fp, a + 0.19, b, q0, q1, PAINT, "green")
    elif t == 3:
        prism(k, ax, plane, f0, f1, [(0.0, z0), (R, z0), (R, z1), (0.0, z1)], F, 2)                  # the module
        fp = plane + R
        q0, q1 = z0 + 0.3 * H, z0 + 0.72 * H
        for zz in (q1 + 0.08, q1 + 0.17):                                                            # its ribs
            T.slab(k, ax, fp, f0, f1, zz, zz + 0.05, 0.03, F, 3, ends=(False, False))
        a, b, c, e = uc - 0.36 * w, uc + 0.36 * w, q0 + 0.06, q1 - 0.06
        _frame(k, ax, fp, a, b, c, e, 0.025, F, 3)
        T.paint(k, ax, fp, a, b, c, e, 0.0, F, 0)
        _cells(k, ax, fp, a + 0.02, a + 0.12, c + 0.03, e - 0.03, dl, 2, 3, ("flameY", "red"))      # lit block
        for i, col in enumerate(("red", "flameY", "red", "flameY")):                                  # small lights
            u = a + 0.17 + i * 0.07
            lamp(k, ax, fp, u, u + 2 * LINE, e - 0.09, e - 0.04, dl, col)
        lamp(k, ax, fp, a + 0.19, a + 0.33, c + 0.04, c + 0.1, dl, "green")                           # buttons
        lamp(k, ax, fp, a + 0.36, b - 0.03, c + 0.03, c + 0.11, dl, "red")


BAST_SLOT = (0.15, 0.12)            # the ramp's slot: its back (a fraction of the run down it), its floor's height


def bastion_hole(r):
    """Where a bastion ramp is open (B1-2, B1-3): over its slot, from the slot's back to where its floor meets the
    slope; set in from the stretch's sides as the outlined panel (the cover the base design keeps on it)."""
    if r not in (1, 2):
        return None
    return (BAST_SLOT[0], 1.0 - BAST_SLOT[1] / T.W.skirt_top(), -0.08)


def bastion_ramp(plate, u0, u1, run_, r, k=None, pt=None, P=None, zs=0.0, hole=None, fam="wall", ax=0, plane=0.0,
                 **_):
    """A bastion ramp's design r (set 8): the ramp has a slot cut into it for machinery, its floor level, its back
    upright (parallel to the wall); the base design covers it with the outlined panel. 1 (B1-2): the slot open;
    2 (B1-3): a box of machinery slotted into it (as deep as its floor, as tall as its back), a screen on its upright
    front. P(u, z, d) is a point d out from the wall."""
    if not hole:
        return
    from .wall3d_variants import lamp
    from .factions_relief import prism
    o0, o1, d0, d1 = hole
    zat = lambda d: zs * (1 - d / run_)                # noqa: E731   the slope's height d out
    zb = BAST_SLOT[1]
    up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    k.poly([P(o0, zb, d0), P(o1, zb, d0), P(o1, zb, d1), P(o0, zb, d1)], fam, 2, up)                 # its floor,
    k.poly([P(o0, zb, d0), P(o1, zb, d0), P(o1, zat(d0), d0), P(o0, zat(d0), d0)], fam, 1, out_)     # back
    for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
        k.poly([P(u, zb, d0), P(u, zat(d0), d0), P(u, zb, d1)], fam, 1, along * sg)
    if r == 2:
        df, zt = d1, zat(d0)                            # the box: the slot's floor deep, its back's height
        a, b = o0 + 0.02, o1 - 0.02
        prism(k, ax, plane, a, b, [(d0, zb), (df, zb), (df, zt), (d0, zt)], fam, 3)
        c, e = zb + 0.03, zt - 0.03                                                                  # its screen
        T.slab(k, ax, plane + df, a + 0.03, b - 0.03, c, e, PAINT, fam, 0)
        fp, dl = plane + df, 2 * PAINT
        h = (e - c - 0.04) / 3
        for i in range(2):                                                                           # a lit block
            for j in range(3):
                q = c + 0.02 + j * h
                lamp(k, ax, fp, a + 0.06 + i * 0.05, a + 0.06 + (i + 1) * 0.05 - LINE, q, q + h - 0.015, dl,
                     "flameY" if (i + j) % 2 else "red")
        for i, col in enumerate(("red", "flameY", "red", "flameY")):                                 # small lights
            u = a + 0.2 + i * 0.07
            lamp(k, ax, fp, u, u + 2 * LINE, e - 0.06, e - 0.03, dl, col)
        lamp(k, ax, fp, a + 0.2, a + 0.33, c + 0.03, c + 0.08, dl, "green")                          # buttons
        lamp(k, ax, fp, a + 0.36, a + 0.45, c + 0.03, c + 0.1, dl, "red")
        lamp(k, ax, fp, a + 0.47, a + 0.51, c + 0.03, c + 0.08, dl, "blueN")
