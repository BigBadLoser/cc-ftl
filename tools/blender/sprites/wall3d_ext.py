"""The hull from outside (roofed ships: enemy ships are seen so): tile.hull.ext.o{o}.m{mask}[.v1], o the side(s)
facing space as the near-hull ghosts' (1: +y, 2: +x, 3: both, the outer corner). The hull block runs right out to the
tile's space-facing edges (a cell short: its outer face is the ship's outline) and has no skirt: there is no room on
that side. Its outer faces carry armour instead of the interior's dressing (ext_face). A faction look dresses them
through its STYLE "ext" face; ext_face is the default's."""
from . import wall3d as T
from . import wall3d_ext_t3 as T3
from . import wall3d_ext_var as VAR
from .wall3d_ext_geom import D, E, TOP

EXT_PAIRS = [(1, 0), (2, 0), (3, 0)]    # straight runs' variants .a1 ..: (top design, bottom design)
TINT = {"hsS", "hsM", "hsL", "hsH", "hsW"}  # the tones the ship's colour tints (core.TINT): the armour's light tones;
                                    # a piece's mask is these less its seam pass (wall3d.SEAM_PASS: its seams, panel
                                    # outlines and painted shading), as hull 46's topDeco leaves its seams untinted
BACK = {0: T3.BACK, 1: VAR.SLOT + VAR.OCT_D}   # a design's block face further in than the armour's own (its
                                                # armour builds the top's front back out)


def ext_shell(o):
    class ExtShell(T.Shell):
        no_skirt = True
        no_cap = True                                   # (its top plain: the roof's own height)
        cap_fam = "steel"
        cap_band = 0.0

        def __init__(self, *args, **kw):
            super().__init__(*args, **kw)
            out = []
            f = E - D - BACK.get(T.VARIANT[0], 0.0)
            for (x0, x1, y0, y1), fam, t, top in self.rects:
                if fam == "hull":                       # (a cell short of the edge: a face on the tile's own edge
                    x1 = f if o & 2 else x1             # is the next tile's, so it is not built; D in again: the
                    y1 = f if o & 1 else y1             # armour's section fills it)
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
                return None                             # (the armour covers its outer face)
            return T.RAMPS["steel"][1 if face == "x" else 0][1]
    return ExtShell


def ext_face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
    """The default look's outer face (after Space Haven's hull 46, D3): T3, the base (wall3d_ext_t3), or one of the
    other top designs (wall3d_ext_var)."""
    t = T.VARIANT[0]
    if t:
        VAR.build(k, ax, plane, a, b, ends, top, t)
    else:
        T3.build(k, ax, plane, a, b, ends, top)


def ext_block(mask, o, variant=0):
    st = T.STYLE or {}
    return T.block(mask, "hull", variant, level="up", shell=ext_shell(o), dress=st.get("ext", ext_face))


STRAIGHT = {(10, 1): (1, 0), (5, 2): (0, 1)}       # (mask, o) of the straight runs: the direction they run (tiles)


def ext_run_wide(mask, o, variant=0):
    """A straight run as a "wide" sprite (env_build): its px its own, their colours from it with a copy a tile either
    way along the run (a straight run's neighbours are itself), so a px on the tile's edge resolves as it does
    mid-run (alone, the top's edge comes out a tone off, seen where the next tile is lower: a diagonal's step)."""
    from . import core
    own = ext_block(mask, o, variant)
    dx, dy = STRAIGHT[(mask, o)]
    more, was = [], T.VARIANT
    T.VARIANT = (0, 0)                                  # (the copies in the base design: the designs share their
    try:                                                # strips at the tile's edges, so it gives a join's colours;
        for k in (-1, 1):                               # a copy of this one's own showed slivers of it beside
            for ob in ext_block(mask, o, variant):      # another design)
                ob.location = ob.location + core.G(k * dx, k * dy, 0.0)
                more.append(ob)
    finally:
        T.VARIANT = was
    return own, own + more
