"""The station hull's window (#524; after the station ref's hull window, design reference only): a straight run's design
over two or more tiles, as the ship hull's (wall3d_ext_window: the same pieces and neighbours, w1 the run's start, w3
its end, w2 the middles) and built from its parts: its sill (the slope up to the glass, W1's recess and plates, W2's
framed recess and plates), its end pieces' jamb (wall3d_ext_window_end: the recessed panel, the outer frame's studded
strip), the opening's corner slopes and the pane (tinted glass, its edges dark lines). The station's own: the header
(the bullnose and the top over it, whole, down to the line under the bullnose), the sill's front (flush with the face,
its groove and step), the tones (the ship's mapped onto the station's ramp by brightness: TONES).

  tile.hull.station.ext.o<o>.m<mask>.w1/.w2/.w3   (o1 m10 along x, o2 m5 along y; w1 the lower tile coordinate end)

Depths d out from the block's face (the shell's: the armour D deep): the face D, the jamb's front and the slope's top
JAMB_IN behind it, the pane PANE_IN behind that, the window's back wall WALL_BACK behind the pane."""
from contextlib import contextmanager

from . import core
from . import wall3d as T
from . import station_hull as SH
from . import wall3d_ext_window as WIN
from . import wall3d_ext_window_end as EN
from .wall3d_ext_geom import D

PART = [None]                       # the piece being built: "w1" | "w2" | "w3" (None: not a window)
SILL = 10                           # the sill's front's top: this many px over the groove
JAMB_IN = 5 / 32                    # the jamb's front (and the slope's top) this far behind the face
FRAME = 2 / 32                      # an end piece's outer frame (the whole section), along the face
JAMB = 5 / 32                       # the jamb inside it
BACK_WALL = "stE"                   # the window's back wall
TONES = {"hsXK": "stK", "hsK": "stK", "hsXD": "stE", "hsD": "stDE", "hsXM": "stD", "hsXS": "stD", "hsM": "stM",
         "hsXL": "stM", "hsS": "stS", "hsL": "stL", "hsH": "stH", "hsW": "stB"}


@contextmanager
def _tones():
    """The ship window modules' tones mapped onto the station's while a piece is built."""
    saved = []
    for mod in (WIN, EN):
        for k, v in list(vars(mod).items()):
            if isinstance(v, str) and v in TONES:
                saved.append((mod, k, v))
                setattr(mod, k, TONES[v])
            elif k == "YS":
                saved.append((mod, k, v))
                setattr(mod, k, tuple(TONES.get(c, c) for c in v))
    try:
        yield
    finally:
        for mod, k, v in saved:
            setattr(mod, k, v)


def span(f, s, s0, s1, zt):
    """A window tile's armour over [s0, s1]: the outer frame (an end piece), the sill, the header, the jamb, the
    opening's back wall and the pane."""
    with _tones():
        _span(f, s, s0, s1, zt)


def _span(f, s, s0, s1, zt):
    part, H, Z = PART[0], s.H, core.ZPX
    WIN.PART = part
    fr, dv = D, D - JAMB_IN                             # (the face; the jamb's front, the slope's top)
    zh, zs = zt, s.z_at(SH.GROOVE, -SILL)               # (the header's foot; the sill's front's top)
    gl = dv - WIN.PANE_IN                               # (the pane's front)
    zj = zs + WIN.SILL_RISE * (fr - dv) / (fr - gl) / Z     # (the slope's top, as the ship's rise)
    dp = gl - WIN.PANE / 2
    db = max(0.0, dp - WIN.PANE / 2 - WIN.WALL_BACK)    # (the window's back)
    end = part in ("w1", "w3")
    mu = (lambda u: s0 + s1 - u) if part == "w3" else (lambda u: u)

    def seg(u0, u1, cap=None):                          # (W1's u onto the tile: W3 mirrored)
        if part != "w3":
            return u0, u1, cap
        return mu(u1), mu(u0), cap[::-1] if isinstance(cap, tuple) else cap
    fm = WIN._Mirror(f, seg) if part == "w3" else f
    h0, w0 = s0, s0
    if end:                                             # the outer frame: the whole section
        for z0, z1 in ((0.0, SH.GROOVE), (SH.GROOVE, H)):
            pf = s.sec(z0, z1)
            u0, u1, cp = seg(s0, s0 + FRAME, (None, WIN.SIDE))
            f.part(u0, u1, pf, s.cols(pf, "face"), cp, end=False)
        h0, w0 = s0 + FRAME, s0 + FRAME + JAMB
    u0, u1, _ = seg(h0, s1)
    pf = [(db, 0.0), (fr, 0.0), (fr, zs), (dv, zj), (db, zj)]           # the sill: its slope, then flat back
    cols = [None, SH.FACE, WIN.SILL_SLOPE, WIN.SILL_FLAT, None]
    if end:
        WIN._w1_sill(fm, s0, h0, s1, db, fr, zs, dv, zj, SH.FACE)
    elif part == "w2":
        WIN._w2_sill(f, s, s0, s1, u0, u1, pf, cols, db, fr, zs)
        WIN._w2_plate(f, s, s0, s1, fr, zs, dv, zj)
    else:
        f.part(u0, u1, pf, cols, None, end=False)
    f.line(u0, u1, SH.FOOT_H, SH.GROOVE, SH.FACE_LO, bevel=False)       # (the face's lower band, on the sill's front)
    pf = s.sec(zh, H)                                                   # the header: the station's, whole
    f.part(u0, u1, pf, s.cols(pf, "face"), None, end=False)
    f.part(*seg(w0, s1)[:2], [(0.0, zj), (db, zj), (db, zh), (0.0, zh)], [None, BACK_WALL, None, None], None,
           end=False)                                                   # the window's back wall
    win = WIN._opening(w0, s1, zj, zh, end)
    glass = WIN.GLASS = WIN.GLASS or T.Relief("station_window_glass")
    WIN._slab(glass, f.ax, f.plane, win, dp - WIN.PANE / 2, dp + WIN.PANE / 2, "glassL", [False] * len(win),
              back=False, mu=mu)                                        # the pane: its front only

    def sides(pts, col):                                # (none where the pane runs on into the next tile)
        return [False if abs(p[0] - q[0]) < 1e-6 and (abs(p[0] - s1) < 1e-2 or (not end and abs(p[0] - w0) < 1e-2))
                else col for p, q in zip(pts, pts[1:] + pts[:1])]
    pts = WIN._inset(win, WIN.EDGE_OUT)                                 # its edges
    WIN._slab(f.k, f.ax, f.plane, pts, dp - WIN.PANE / 2, dp + WIN.PANE / 2, False, sides(pts, WIN.EDGE), mu=mu)
    if end:                                                             # the jamb and its corners (the ship's)
        fh, sh, ut = WIN.FOOT_H / Z, WIN.SLOPE_H / Z, w0 + WIN.SLOPE + WIN.FOOT_W
        WIN._slab(f.k, f.ax, f.plane, [(w0, zj), (ut, zj), (ut, zj + fh), (w0 + WIN.SLOPE, zj + fh),
                                       (w0, zj + fh + sh)], db, dv, WIN.HEAD_FRONT,
                  [False, WIN.SIDE, WIN.SILL_FLAT, WIN.SLOPE_COL, False], back=False, mu=mu)
        WIN._slab(f.k, f.ax, f.plane, [(w0, zh), (w0, zh - sh), (w0 + WIN.SLOPE, zh)], db, dv, WIN.HEAD_FRONT,
                  [False, WIN.SLOPE_TOP, False], back=False, mu=mu)
        zl = zj + fh + sh                                               # the jamb's seam
        pf = [(dp + WIN.PANE / 2, zl), (dv + 0.001, zl), (dv + 0.001, zl + 1 / Z), (dp + WIN.PANE / 2, zl + 1 / Z)]
        fm.part(h0, w0 + 0.001, pf, [WIN.JAMB_SEAM] * 4, (None, WIN.JAMB_SEAM), end=False)
        EN.jamb(fm, h0, w0, db, dv, zl, zh, WIN.HEAD_FRONT, WIN.SIDE)
        EN.studs(fm, s, h0, dv, zl, zh)


def _build(m, o, part):
    """(own, wide, pane objects): the piece with its run neighbours beside it (windows.HULL_NEXT)."""
    from .wall3d_ext import STRAIGHT
    from .windows import HULL_NEXT
    dx, dy = STRAIGHT[(m, o)]
    try:
        WIN.GLASS, PART[0] = None, part
        own = SH._block(m, o)
        pane = WIN.GLASS.build() if WIN.GLASS else []
        more = []
        for k, n in zip((-1, 1), HULL_NEXT[part]):
            PART[0], WIN.GLASS = n, None
            for ob in SH._block(m, o):
                ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                more.append(ob)
        return own, own + more, pane
    finally:
        PART[0], WIN.GLASS, WIN.PART = None, None, None


def piece(m, o, part):
    from . import env_build, post
    from .windows import HULL_GLASS, render_glass
    sid = f"tile.hull.station.ext.o{o}.m{m}.{part}"
    core.clear_scene_meshes()
    post.select(SH.PALETTE)
    own, wide, pane = _build(m, o, part)
    it = env_build.crop_item(sid, (1, 1), *render_glass(sid, own, wide, pane, HULL_GLASS))
    return [it] if it else []


def jobs():
    return [lambda m=m, o=o, p=p: piece(m, o, p) for m, o in ((10, 1), (5, 2)) for p in ("w1", "w2", "w3")]
