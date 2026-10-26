"""T3, the exterior hull's base design (after Space Haven's hull 46): its layout, in art px from named anchors (the
bend, the top, the seams), built on the section (wall3d_ext_geom). Its detail groups (EXT_DEBUG=name,..: drawn in
debug red): seams, top_panel, lower_lean, armour, corner. The armour is plain blocks (recesses cut by
splitting them only where a recess is); its seams and outlines are painted (a groove a px wide breaks up as the lean
turns); its armour plates stand a px proud."""
from . import core
from . import wall3d as T
from .wall3d_ext_geom import LINE, PAINT, YS, Face, Section


def px(n):
    """n art px along a face or out from it."""
    return n * LINE


TOP_PX = 1 / 16                     # an art px across a line along the top (on screen: its depth is half a px a px)
BACK = px(8)                        # the block's face this far further in (the top panel runs this far over the top)
REC = px(1)                         # a recess's depth
CORNER_C = px(16)                   # the outer corner's chamfer along each axis (hull 46's: a triangle up the lean;
                                    # its front 2.2 times its side faces at the bend, as hull 46's)
PANEL_IN, PANEL_DOWN = px(5), 8     # the top panel: in from each tile edge; down the lean from the top, px on screen
STRIP = px(9)                       # the lower lean's recessed edge strips, from each tile edge
UPRIGHT_SEAM = 0.6325               # the upright part's seam: a dark px over this height, a lit one under it
LEAN_SEAM, SEAM_UP = (0.35, 0.29), 3    # the lean's seam: its span under the top, raised this many px on screen
KEY_SEAM, KEY_Z = 6, (2, 9)         # the lower centre block's seam (px over the bend), its two keys (px over that)
KEYS = [(0.5 - px(5), 0.5 - px(1)), (0.5 + px(1), 0.5 + px(5))]
PANEL = (0.15, 0.75)                # the upright part's armour panels across the tile (the upper one 2 px wider each
PANEL_GAP = 2                       # side), this many px from the seam; bolts 2 px in from their corners
CORNER_SEAM = 6                     # the corner's front: seams down it this many px in from its edges (hull 46's)
CORNER_CLAMP = (2, 5, 3)            # two clamps over the upright seam, from / to this many px either side of the
                                    # middle, this many px up and down from the seam
SIDE_SEAM = 5                       # the corner tile's side faces: a seam down the lean this many px from the tile's
SIDE_GAP = 5                        # (its top this many px under the lean's seam)
SIDE_BRACKET = ((8, 18), (9, 14, (8, 14)))     # edge; a bracket: px over the bend (bottom, top); its stem, top
                                                # bar's end, bottom bar (px from the tile's edge)
CORNER_BLOCK = (5, 6, 2)            # a block over each seam down the front: px wide, px under the bend, px on over it


class Layout:
    """T3's heights, resolved on its section."""

    def __init__(self, s):
        self.s, self.zb, self.H = s, s.zb, s.H
        self.zr = s.z_at(s.H, PANEL_DOWN)                               # the top panel's bottom
        self.l0, self.l1 = (s.z_at(s.H - dz, -SEAM_UP) for dz in LEAN_SEAM)
        self.zp = s.z_at(self.l0, s.sy(self.l1) - s.sy(self.zr))        # the strips' top: as far under the seam as
        self.ao = s.z_at(self.zp, 1)                                    # the top panel's bottom is over it
        self.zs = s.z_at(s.zb, -KEY_SEAM)
        self.k0, self.k1 = (s.z_at(self.zs, -n) for n in KEY_Z)

    def px(self, z, n):
        return self.s.z_at(z, n)

    def rows(self):
        """The armour's blocks, a tile across: (z0, z1, [(u0, u1, role, inset)])."""
        S, ln = STRIP, LINE

        def strips(mid):
            return [(0.0, S - ln, "floor", REC), (S - ln, S, "dark", REC)] + mid + [(1 - S, 1.0, "floor", REC)]
        mid = [(S, 1 - S, "face", 0.0)]
        keys = [(S, KEYS[0][0], "face", 0.0)] + [c for (u0, u1), (v0, _) in zip(KEYS, KEYS[1:] + [(1 - S, 0)])
                                                 for c in ((u0, u1, "floor", REC), (u1, v0, "face", 0.0))]
        face = [(0.0, 1.0, "face", 0.0)]
        return [(0.0, self.zb, face), (self.zb, self.k0, strips(mid)), (self.k0, self.k1, strips(keys)),
                (self.k1, self.ao, strips(mid)),
                (self.ao, self.zp, [(0.0, S, "dark", REC), (S, 1 - S, "face", 0.0), (1 - S, 1.0, "dark", REC)]),
                (self.zp, self.H, face)]


def build(k, ax, plane, a, b, ends, H):
    """T3 over [a, b] of a face (wall3d's face arguments)."""
    s = Section(H, BACK)
    f = Face(k, ax, plane, a, b, ends, s, CORNER_C)
    L = Layout(s)
    back = min((r[0][2] if ax == "y" else r[0][0]) for r in T.SHELL.rects if r[1] == "hull") - plane
    for s0, s1 in T.spans(a, b):
        whole = s1 - s0 > 1 - 1e-6
        for z0, z1, cells in (L.rows() if whole else [(0.0, L.zb, None), (L.zb, H, None)]):    # (a part tile:
            for u0, u1, role, off in (cells or [(0.0, s1 - s0, "face", 0.0)]):                  # plain faces)
                f.block(s0 + u0, s0 + u1, z0, z1, role, off)
        with f.tag("seams"):
            _seams(f, L, s0, s1)
            f.top_line(s0, s1, back + 2 * TOP_PX, back + 2.75 * TOP_PX, YS[2])  # the top's seam, along its back
        if whole:
            for name, fn in (("top_panel", _top_panel), ("lower_lean", _lower_lean), ("armour", _upright_armour)):
                with f.tag(name):
                    fn(f, L, s0, s1)
        elif f.ch and abs(s1 - b) < 1e-6:
            with f.tag("corner"):
                _corner_side(f, L, s0, s1)
    if f.ch:
        with f.tag("corner"):
            _corner(f, L)


def _seams(f, L, s0, s1):
    gz = UPRIGHT_SEAM
    f.line(s0, s1, gz, L.px(gz, -1), YS[1], bevel=False)    # (its own lit line under it)
    f.line(s0, s1, L.px(gz, 1), gz, YS[4], bevel=False)
    f.line(s0, s1, L.px(L.l1, 1), L.l1, YS[3], wrap=False)    # (the lean's lines stop at a corner's chamfer)


def _top_panel(f, L, s0, s1):
    """Its outline over the top's edge: down each side and along its bottom on the lean, on along the top and across
    its back there; a faint seam either side of it, over its bottom."""
    R, ln = PANEL_IN, LINE
    f.line(s0 + R, s1 - R, L.zr, L.px(L.zr, -1), YS[3])
    zt = L.px(L.zr, -2)
    for u0, u1 in ((s0, s0 + R), (s1 - R, s1)):
        f.line(u0, u1, zt, L.px(zt, -1), YS[4], bevel=False)
    for u in (s0 + R, s1 - R - ln):
        f.line(u, u + ln, L.zr, L.H, YS[3])
        f.top_line(u, u + ln, 0.0, BACK, YS[2])
    f.top_line(s0 + R, s1 - R, 0.0, 0.75 * TOP_PX, YS[2])


def _lower_lean(f, L, s0, s1):
    """The centre block's seam, and plates up out of the edge strips to the lean's face, a px in from their edges:
    two stacked in the left one, one in the right."""
    f.line(s0 + STRIP, s1 - STRIP, L.zs, L.px(L.zs, -1), YS[3])
    _strip_plates(f, L, s0, True)
    _strip_plates(f, L, s1 - STRIP, False)


def _upright_armour(f, L, s0, s1):
    """A panel over the upright part's seam and one under it, a px proud (the upper one 2 px wider each side, the
    lower down to the floor), a painted lit bolt in each corner (built that small it breaks up)."""
    gz, ln, g = UPRIGHT_SEAM, LINE, PANEL_GAP
    up = (PANEL[0] - 2 * ln, PANEL[1] + 2 * ln)
    for (u0, u1), z0, z1 in ((up, L.px(gz, -g), L.px(L.zb, g)), (PANEL, 0.0, L.px(gz, g))):
        f.raised(s0 + u0, s0 + u1, z0, z1, -0.01, LINE)
        for v0, v1 in ((u0 + 2 * ln, u0 + 3 * ln), (u1 - 3 * ln, u1 - 2 * ln)):
            for w0, w1 in ((L.px(z0, -2), L.px(z0, -3)), (L.px(z1, 3), L.px(z1, 2))):
                f.raised(s0 + v0, s0 + v1, w0, w1, LINE - 0.01, LINE + PAINT, col=YS[4])



def _strip_plates(f, L, u0, left):
    """Plates up out of an edge strip from u0 to the lean's face, a px in from its edges: two stacked in a left
    strip, one in a right."""
    S, ln = STRIP, LINE
    p0, p1 = L.px(L.zb, -1), L.px(L.zp, 2)
    pm = (p0 + p1) / 2
    for v0, v1, z0, z1 in (((ln, S - 2 * ln, L.px(p0, -1), L.px(pm, 1)), (ln, S - 2 * ln, L.px(pm, -2), p1))
                           if left else ((2 * ln, S - ln, p0, p1),)):
        f.raised(u0 + v0, u0 + v1, z0, z1, -REC - 0.005, 0.0)


def _corner_side(f, L, s0, s1):
    """The corner tile's side of the corner: the run's top panel, open to the chamfer, its side down to the lean's
    seam; a seam along the chamfer's edge from the floor up to the lean's seam (short of the chamfer's tip, as hull
    46's)."""
    R, ln = PANEL_IN, LINE
    zt = L.px(L.zr, -2)
    f.line(s0, s0 + R, zt, L.px(zt, -1), YS[4], bevel=False)
    f.line(s0 + R, s0 + R + ln, L.l1, L.H, YS[3])
    u = s0 + px(SIDE_SEAM)                              # a seam down the lean from the bend to SIDE_GAP px under
    zg = L.px(L.px(L.l1, 1), SIDE_GAP)                  # the lean's seam, one across from there to the tile's edge,
    f.line(u, u + ln, L.zb, zg, YS[3], end=False)       # a bracket between it and the chamfer (hull 46's)
    f.line(s0, u + ln, L.px(zg, 1), zg, YS[3], end=False)
    (t0, t1), (bu, bt, bb) = SIDE_BRACKET
    zt, zb = L.px(L.zb, -t1), L.px(L.zb, -t0)
    f.line(s0 + px(bu), s0 + px(bu) + ln, zb, zt, YS[3], end=False, weight=1.0)
    f.line(s0 + px(bu), s0 + px(bt), L.px(zt, 1), zt, YS[3], end=False)
    f.line(u, s0 + px(bb[1]), zb, L.px(zb, -1), YS[3], end=False)     # (its foot on to the seam down)
    f.top_line(s0 + R, s0 + R + ln, 0.0, BACK, YS[2])
    f.top_line(s0 + R, s1, 0.0, 0.75 * TOP_PX, YS[2])
    f.edge_line(0.0, L.zb, YS[1])
    f.edge_line(L.zb, L.l1, YS[3])


def _corner(f, L):
    """The outer corner's front (its chamfer), on its upright part as hull 46's: a seam down it CORNER_SEAM px in
    from each edge, a block under the bend over each, two clamps over the seam across it."""
    t = f.chamfer_t
    gz = UPRIGHT_SEAM
    for e in (CORNER_SEAM, f.c * core.TILE_W - CORNER_SEAM - 1):
        pf = f.on(0.0, L.zb, -0.01, 0.001)
        f.on_chamfer(t(e), t(e + 1), pf, [YS[1]] * len(pf), YS[1])
        f.on_chamfer(t(e + 1), t(e + 2), pf, [YS[4]] * len(pf), YS[4])      # (its lit edge)
        w, h, over = CORNER_BLOCK
        for z0, z1 in ((L.px(L.zb, h), L.zb), (L.zb, L.px(L.zb, -over))):     # (on over the bend onto the lean,
            pf = f.on(z0, z1, -0.01, LINE)                                      # in its own tone)
            cols = [YS[3] if c == YS[5] else c for c in f.sec.cols(pf, "plate")]
            f.on_chamfer(t(e + 0.5 - w / 2), t(e + 0.5 + w / 2), pf, cols)
    a, b, h = CORNER_CLAMP
    pf = f.on(L.px(gz, h), L.px(gz, -h), -0.01, LINE)
    for u0, u1 in ((0.5 - t(b), 0.5 - t(a)), (0.5 + t(a), 0.5 + t(b))):
        f.on_chamfer(u0, u1, pf, f.sec.cols(pf, "plate"))
