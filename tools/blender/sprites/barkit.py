"""Bar style kit (family `barkit`, palette set bar9, preview only): generic surface treatments for the used,
lived-in freighter look, each shown on the same sample block so they compare side by side. Designs build their
pieces from these treatments.

Rules the treatments keep, so nothing z-fights or clips: everything laid on a face stands off it by at least OFF px;
no two colours share a plane; parts laid on a face never cross each other. Spacings stay at 4 px or more, so a pattern
reads at 1x rather than breaking into dots. The sample block is 40 px across (u), 14 deep (v), 26 tall, on a 2x1
floor; its front face is at v = 7, its right face at u = 20.

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r3 import cyl
from .barcounter_r7 import hcyl
from .barcounter_study import ZPX
from .bunk_study import _px
from .research_kit import Bench

OFF = 0.3                                                                            # min standoff on a face, px
U0, U1, V0, V1, H = -20, 20.5, -7, 7, 26                                             # the sample block (2x1)
# U1 sits half a px off the grid: a vertical corner whose screen x (u - v) falls exactly on a pixel boundary renders
# dotted (the supersample's mode ties along it); the front face's own u stays whole so its patterns stay crisp.


def box(k, u, v, z, su, sv, sz, col, **kw):
    """A box in px centred at (u, v), bottom at z (K.box in px)."""
    k.box(u / 32, v / 32, z / ZPX, su / 32, sv / 32, sz / ZPX, col, **kw)


# ---- pixel helpers ------------------------------------------------------------------------------------------------
# One px across (u) is one screen px and one px of height (z) is one screen px, so whole-px edges land on the pixel
# grid. Patterns are inlaid: flush bands of colour in one raised panel, never thin plates or sub-px parts (those
# snap unevenly and leave dotted outlines).
def panel(k, u0, u1, v, z0, z1, d=1):
    """A raised panel's footprint, returned for the pattern helpers: they fill it with flush, non-overlapping boxes
    from v to v + d."""
    return (u0, u1, v, v + d, z0, z1)


def bands(k, pnl, seq, axis="u", phase=0):
    """Fill a panel with repeating bands of (width px, colour) along u (vertical stripes) or z (horizontal, laid
    from the top down so a band's first colour is its lit top)."""
    u0, u1, v0, v1, z0, z1 = pnl
    a, end = (u0, u1) if axis == "u" else (z0, z1)
    pos, i = a, phase
    while pos < end:
        w, col = seq[i % len(seq)]
        b = min(pos + w, end)
        if axis == "u":
            _px(k, pos, b, v0, v1, z0, z1, col)
        else:
            _px(k, u0, u1, v0, v1, z1 - (b - a), z1 - (pos - a), col)
        pos, i = b, i + 1


def grid(k, pnl, cw, ch, cell, gap="r9PadD", g=1):
    """Fill a panel with a grid of cells cw x ch px with g px gaps; cell(i, j) returns [(du0, du1, dz0, dz1, col)]
    in px within the cell (from its top-left), filling it exactly."""
    u0, u1, v0, v1, z0, z1 = pnl
    _px(k, u0, u1, v0, v0 + 0.5, z0, z1, gap)                                        # the gap colour behind
    nu, nz = int((u1 - u0 + g) // (cw + g)), int((z1 - z0 + g) // (ch + g))
    for i in range(nu):
        for j in range(nz):
            cu, cz = u0 + i * (cw + g), z1 - j * (ch + g)
            for a, b, c, d, col in cell(i, j):
                _px(k, cu + a, cu + b, v0, v1, cz - d, cz - c, col)


def profile(k, u0, u1, v, z, steps):
    """A stepped rounded profile running along u on a face at depth v: steps are (z0, z1, depth, colour) from z."""
    for a, b, d, col in steps:
        _px(k, u0, u1, v, v + d, z + a, z + b, col)


# ---- padding ------------------------------------------------------------------------------------------------------
ROLL = ((1, "r9PadL"), (4, "r9Pad"), (1, "r9PadD"))                                  # a roll: lit, body, groove


def pad_rolls(k, u0, u1, v, z0, z1):
    """Tuck-and-roll: vertical rolls 6 px apart, each lit at its left."""
    bands(k, panel(k, u0, u1, v, z0, z1), ROLL, "u")


def pad_channels(k, u0, u1, v, z0, z1):
    """Channel quilting: horizontal rolls 6 px apart, each lit on top."""
    bands(k, panel(k, u0, u1, v, z0, z1), ROLL, "z")


def pad_biscuit(k, u0, u1, v, z0, z1, cw=8, ch=7):
    """Biscuit tufting: soft squares, lit along their top and left, on dark seams; cells sized to fill the panel."""
    nu, nz = max(1, round((u1 - u0 + 1) / (cw + 1))), max(1, round((z1 - z0 + 1) / (ch + 1)))
    cw, ch = (u1 - u0 + 1) // nu - 1, (z1 - z0 + 1) // nz - 1
    u1, z0 = u0 + nu * (cw + 1) - 1, z1 - nz * (ch + 1) + 1
    grid(k, panel(k, u0, u1, v, z0, z1), cw, ch, lambda i, j: (
        (0, cw, 0, 1, "r9PadL"), (0, 1, 1, ch, "r9PadL"), (1, cw, 1, ch, "r9Pad")))


def pad_rollband(k, u0, u1, v, z0, z1):
    """Roll and pleat: a horizontal roll band along the top over tuck-and-roll below."""
    bands(k, panel(k, u0, u1, v, z1 - 7, z1, d=2), ((1, "r9PadL"), (5, "r9Pad"), (1, "r9PadD")), "z")
    bands(k, panel(k, u0, u1, v, z0, z1 - 7), ROLL, "u")


def pad_cushion(k, u0, u1, v, z0, z1):
    """A smooth cushion, piped: a dark piping frame, a lit top edge, a plain field, 2 px proud."""
    _px(k, u0, u1, v, v + 1, z0, z1, "r9PadD")
    _px(k, u0 + 1, u1 - 1, v + 1, v + 2, z1 - 2, z1 - 1, "r9PadL")
    _px(k, u0 + 1, u1 - 1, v + 1, v + 2, z0 + 1, z1 - 2, "r9Pad")


def pad_bolster(k, u0, u1, v, z):
    """A rolled bolster along a face, its bottom at z: a stepped round profile, lit on top."""
    profile(k, u0, u1, v, z, ((0, 1, 1, "r9PadD"), (1, 2, 3, "r9PadD"), (2, 7, 4, "r9Pad"), (7, 8, 3, "r9PadL"),
                              (8, 9, 1, "r9PadL")))


# ---- panels -------------------------------------------------------------------------------------------------------
def panel_seams(k, u0, u1, v, z0, z1, cols=2):
    """Flush panels split by 1 px dark seams, with a 2 px fastener in each panel's top corners."""
    w = (u1 - u0 - (cols - 1)) / cols
    for i in range(cols):
        a = round(u0 + i * (w + 1))
        b = round(a + w)
        _px(k, a, b, v, v + 1, z0, z1, "r9Bone")
        for u in (a + 1, b - 3):
            _px(k, u, u + 2, v + 1, v + 1.5, z1 - 3, z1 - 1, "r9Grey")
        if i < cols - 1:
            _px(k, b, b + 1, v, v + 1, z0, z1, "r9Char")


def panel_inset(k, u0, u1, v, z0, z1, m=2):
    """An inset panel: a 1 px lit frame top and left, shaded bottom and right, round a recessed field."""
    pnl = (u0 + m, u1 - m, v, v + 1, z0 + m, z1 - m)
    a, b, _, d, c, e = pnl
    _px(k, a, b, v, d, e - 1, e, "r9Sand")
    _px(k, a, a + 1, v, d, c, e - 1, "r9Sand")
    _px(k, a + 1, b, v, d, c, c + 1, "r9Tan")
    _px(k, b - 1, b, v, d, c + 1, e - 1, "r9Tan")
    _px(k, a + 1, b - 1, v, v + 0.5, c + 1, e - 1, "r9Sand")


def panel_ribs(k, u0, u1, v, z0, z1):
    """Horizontal ribs 4 px apart: lit top, body, shaded underside."""
    bands(k, panel(k, u0, u1, v, z0, z1), ((1, "r9Bone"), (2, "r9Sand"), (1, "r9Tan")), "z")


def panel_corrugated(k, u0, u1, v, z0, z1):
    """Corrugated metal: vertical bands, lit, body, shade."""
    bands(k, panel(k, u0, u1, v, z0, z1), ((1, "r9Metal"), (1, "r9Grey"), (1, "r9GreyD")), "u")


def panel_grille(k, u0, u1, v, z0, z1):
    """A grille: 2 px dark holes on a 4 px pitch in a grey plate."""
    grid(k, panel(k, u0, u1, v, z0, z1), 3, 3, lambda i, j: ((0, 3, 0, 3, "r9Grey"),), gap="r9Char")


def panel_louvre(k, u0, u1, v, z0, z1):
    """A louvred vent: a grey frame round slats, each a lit lip over a dark slot."""
    _px(k, u0, u1, v, v + 1.5, z0, z1, "r9GreyD")
    bands(k, panel(k, u0 + 2, u1 - 2, v + 1, z0 + 2, z1 - 2), ((1, "r9Metal"), (2, "r9Char")), "z")


# ---- edges and trims (on a block u0..u1, v0..v1, height h) --------------------------------------------------------
def top_lip(k, u0, u1, v0, v1, h, over=1.5):
    """A dark lip under a tan top, both overhanging."""
    _px(k, u0 - over, u1 + over, v0 - over, v1 + over, h, h + 2, "r9GreyD")
    _px(k, u0 - over + 0.5, u1 + over - 0.5, v0 - over + 0.5, v1 + over - 0.5, h + 2, h + 3, "r9Tan")


def top_bullnose(k, u0, u1, v0, v1, h):
    """A tan top with a rounded front edge: a slab and a stepped round nosing, lit on top."""
    _px(k, u0 - 1, u1 + 1, v0 - 1, v1, h, h + 3, "r9Tan")
    profile(k, u0 - 1, u1 + 1, v1, h, ((0, 1, 1, "r9GreyD"), (1, 2, 2, "r9Tan"), (2, 3, 1, "r9Bone")))


def stepped(k, u0, u1, v0, v1, h, c=2, col="r9Bone", step="r9Sand"):
    """A block whose top front edge steps back c px: a lower block, and an upper block set back from the front by c
    (a 45 deg cut lights unevenly at this size; the step reads as a softened edge). The step's tread is a separate
    strip in its own colour, standing OFF clear of the lower block's top. Use in place of the plain block."""
    _px(k, u0, u1, v0, v1, 0, h - c, col)
    _px(k, u0, u1, v0, v1 - c, h - c, h, col)
    _px(k, u0, u1, v1 - c, v1, h - c, h - c + OFF, step)


def kick(k, u0, u1, v0, v1, z=4, inset=2):
    """A recessed dark kick with a warm strip light along its top. The body stands on it from z."""
    _px(k, u0 + inset, u1 - inset, v0 + inset, v1 - inset, 0, z, "r9Char")
    _px(k, u0 + inset, u1 - inset, v1 - inset, v1 - inset + 0.5, 0.3, 1.5, "r9Warm")     # low, so the body's
    _px(k, u1 - inset, u1 - inset + 0.5, v0 + inset, v1 - inset, 0.3, 1.5, "r9Warm")     # overhang leaves it seen


def edge_band(k, u0, u1, v0, v1, h, w=1):
    """A metal band round the top edge."""
    _px(k, u0 - 0.4, u1 + 0.4, v1 - 0.1, v1 + 0.4, h - w, h + 0.4, "r9Metal")
    _px(k, u1 - 0.1, u1 + 0.4, v0 - 0.4, v1 + 0.4, h - w, h + 0.4, "r9Metal")
    _px(k, u0 - 0.4, u1 + 0.4, v0 - 0.4, v1 + 0.4, h + 0.4, h + 0.8, "r9Metal")


def round_end(k, u, v0, v1, z0, z1, col="r9Bone"):
    """A half-drum end on the block's side at u (the block's depth for its diameter)."""
    cyl(k, u, (v0 + v1) / 2, z0, z1, (v1 - v0) / 2, col, sides=20)


# ---- details ------------------------------------------------------------------------------------------------------
def porthole(k, u, v, zc, r, face="r9Warm"):
    """A round port facing +v: a dark rim, a lit glass, each an octagon of two squares 45 deg apart."""
    for rr, col, d in ((r, "r9GreyD", 0.8), (r * 0.7, face, 1.2)):
        R = rr / 32
        for a in (0, math.pi / 4):
            k.box(u / 32, (v + d / 2) / 32, zc / ZPX - R, 2 * R, d / 32, 2 * R, col, ry=a)


def hatch(k, u0, u1, v, z0, z1):
    """A service hatch with a pull."""
    _px(k, u0, u1, v, v + 1, z0, z1, "r9GreyD")
    um, zm = round((u0 + u1) / 2), round((z0 + z1) / 2)
    _px(k, um - 2, um + 2, v + 1, v + 2, zm - 1, zm + 1, "r9Grey")


def indicators(k, u, v, z, cols=("r9LedR", "r9LedG", "r9Lamp")):
    """A small dark plate with a row of lights."""
    _px(k, u - 1, u + 3 * len(cols), v, v + 1, z - 1, z + 3, "r9Char")
    for i, c in enumerate(cols):
        _px(k, u + 3 * i, u + 3 * i + 2, v + 1, v + 1.5, z, z + 2, c)


def pipe(k, u0, u1, v, z):
    """A pipe along u standing 1 px off a face at depth v, its bottom at z: a stepped round profile, with two clamps."""
    steps = ((0, 1, 2, "r9GreyD"), (1, 3, 3, "r9Grey"), (3, 4, 2, "r9Metal"))
    profile(k, u0, u1, v + 1, z, steps)
    for i in (1, 2):
        u = round(u0 + (u1 - u0) * i / 3)
        _px(k, u - 1, u + 1, v, v + 4, z - 1, z + 5, "r9GreyD")


def rivets(k, u0, u1, v, z, pitch=6):
    """A row of 2 px fasteners."""
    for u in range(int(u0), int(u1) - 1, pitch):
        _px(k, u, u + 2, v, v + 0.8, z, z + 2, "r9Grey")


def stencil(k, u0, u1, v, z0, z1):
    """A painted plate: an orange field with a bone band."""
    zm = round((z0 + z1) / 2)
    _px(k, u0, u1, v, v + 1, zm + 1, z1, "r9Orange")
    _px(k, u0, u1, v, v + 1, zm - 1, zm + 1, "r9Bone")
    _px(k, u0, u1, v, v + 1, z0, zm - 1, "r9Orange")


# ---- the kit sheet: each treatment on the sample block ------------------------------------------------------------
def body(k, u0, u1, v0, v1, z0, z1, col):
    """A block body, hard-edged (a bevel catches specular blips on its top at this size)."""
    _px(k, u0, u1, v0, v1, z0, z1, col)


def block(name, col="r9Bone"):
    k = Bench(name, (2, 1))
    body(k, U0, U1, V0, V1, 0, H, col)
    return k


def sample(name, fn, col="r9Bone"):
    def run():
        k = block(f"kit_{name}", col)
        fn(k)
        return k.build()
    return run


UF = 20                                                                              # the front face's whole-px end
FACE = (U0 + 2, UF - 2, V1, 2, H - 2)                                                # the front face's usable area
SAMPLES = (
    ("p1", "P1 tuck and roll", lambda k: pad_rolls(k, *FACE)),
    ("p2", "P2 channels", lambda k: pad_channels(k, *FACE)),
    ("p3", "P3 biscuit", lambda k: pad_biscuit(k, *FACE)),
    ("p4", "P4 roll and pleat", lambda k: pad_rollband(k, *FACE)),
    ("p5", "P5 cushion, piped", lambda k: pad_cushion(k, *FACE)),
    ("p6", "P6 bolster", lambda k: pad_bolster(k, U0, UF, V1, H - 11)),
    ("s1", "S1 seams, bolts", lambda k: panel_seams(k, U0, UF, V1, 0, H)),
    ("s2", "S2 inset", lambda k: panel_inset(k, U0, UF, V1, 0, H)),
    ("s3", "S3 ribs", lambda k: panel_ribs(k, U0, UF, V1, 0, H)),
    ("s4", "S4 corrugated", lambda k: panel_corrugated(k, *FACE)),
    ("s5", "S5 grille", lambda k: panel_grille(k, U0 + 6, UF - 6, V1, 5, H - 5)),
    ("s6", "S6 louvre", lambda k: panel_louvre(k, U0 + 6, UF - 6, V1, 5, H - 5)),
    ("e1", "E1 lip and top", lambda k: top_lip(k, U0, U1, V0, V1, H)),
    ("e2", "E2 bullnose", lambda k: top_bullnose(k, U0, U1, V0, V1, H)),
    ("e3", "E3 stepped edge", None),
    ("e4", "E4 lit kick", None),
    ("e5", "E5 edge band", lambda k: edge_band(k, U0, U1, V0, V1, H)),
    ("e6", "E6 round end", lambda k: round_end(k, U1, V0, V1, 0, H)),
    ("d1", "D1 porthole", lambda k: porthole(k, 0, V1, 13, 6)),
    ("d2", "D2 hatch", lambda k: hatch(k, U0 + 10, UF - 10, V1, 4, H - 4)),
    ("d3", "D3 indicators", lambda k: indicators(k, -4, V1, 12)),
    ("d4", "D4 pipe, clamps", lambda k: pipe(k, U0 + 2, UF - 2, V1, 12)),
    ("d5", "D5 rivets", lambda k: [rivets(k, U0 + 2, UF - 2, V1, z) for z in (2, H - 4)]),
    ("d6", "D6 stencil plate", lambda k: stencil(k, U0 + 8, UF - 8, V1, 8, 18)),
)


def e3():
    k = Bench("kit_e3", (2, 1))
    stepped(k, U0, U1, V0, V1, H)
    return k.build()


def e4():
    k = Bench("kit_e4", (2, 1))
    kick(k, U0, U1, V0, V1)
    _px(k, U0, U1, V0, V1, 4, H, "r9Bone")
    return k.build()


def jobs():
    out = []
    for v, _, fn in SAMPLES:
        out.append((f"module.barkit.{v}", (2, 1), "prop", {"e3": e3, "e4": e4}.get(v) or sample(v, fn)))
    return out
