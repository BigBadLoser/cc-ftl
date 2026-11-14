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
U0, U1, V0, V1, H = -20, 20, -7, 7, 26                                               # the sample block (2x1)


def box(k, u, v, z, su, sv, sz, col, **kw):
    """A box in px centred at (u, v), bottom at z (K.box in px)."""
    k.box(u / 32, v / 32, z / ZPX, su / 32, sv / 32, sz / ZPX, col, **kw)


# ---- padding (on a face at depth v, facing +v, over u0..u1, z0..z1) -----------------------------------------------
def backing(k, u0, u1, v, z0, z1):
    _px(k, u0, u1, v, v + OFF, z0, z1, "r9PadD")
    return v + OFF


def pad_rolls(k, u0, u1, v, z0, z1, pitch=4, r=1.7):
    """Tuck-and-roll: vertical rolls."""
    b = backing(k, u0, u1, v, z0, z1)
    n = int((u1 - u0) // pitch)
    for i in range(n):
        cyl(k, u0 + (u1 - u0) * (i + 0.5) / n, b, z0 + 0.3, z1 - 0.3, r, "r9Pad", sides=10)


def pad_channels(k, u0, u1, v, z0, z1, pitch=4, r=1.7):
    """Channel quilting: horizontal rolls."""
    b = backing(k, u0, u1, v, z0, z1)
    n = int((z1 - z0) // pitch)
    for i in range(n):
        hcyl(k, u0 + 0.3, u1 - 0.3, b, z0 + (z1 - z0) * (i + 0.5) / n, r, "r9Pad", n=6)


def pad_biscuit(k, u0, u1, v, z0, z1, s=5):
    """Biscuit tufting: soft squares on a dark ground."""
    b = backing(k, u0, u1, v, z0, z1)
    nu, nz = int((u1 - u0) // s), int((z1 - z0) // s)
    for i in range(nu):
        for j in range(nz):
            cu, cz = u0 + (u1 - u0) * (i + 0.5) / nu, z0 + (z1 - z0) * j / nz
            box(k, cu, b + 0.5, cz + 0.35, (u1 - u0) / nu - 0.7, 1, (z1 - z0) / nz - 0.7, "r9Pad", bevel=0.012)


def pad_diamond(k, u0, u1, v, z0, z1, s=7):
    """Diamond tufting: squares turned 45 deg, buttons where their corners meet."""
    b = backing(k, u0, u1, v, z0, z1)
    d = s / math.sqrt(2)
    for i in range(int((u1 - u0) // s) + 1):
        for j in range(int((z1 - z0) // s) + 1):
            for cu, cz in ((u0 + i * s, z0 + j * s), (u0 + (i + 0.5) * s, z0 + (j + 0.5) * s)):
                if u0 + d / 2 <= cu <= u1 - d / 2 and z0 + d / 2 <= cz <= z1 - d / 2:
                    box(k, cu, b + 0.5, cz - d / 2 + 0.3, d - 0.5, 1, d - 0.5, "r9Pad", ry=math.pi / 4)
    for i in range(int((u1 - u0) // s)):
        for j in range(int((z1 - z0) // s)):
            cu, cz = u0 + (i + 0.5) * s, z0 + j * s + s
            if cz < z1 - 1:
                _px(k, cu - 0.4, cu + 0.4, b + 1, b + 1.4, cz - 0.4, cz + 0.4, "r9PadD")   # buttons


def pad_cushion(k, u0, u1, v, z0, z1):
    """A smooth cushion panel, piped round its edge."""
    b = backing(k, u0, u1, v, z0, z1)
    box(k, (u0 + u1) / 2, b + 0.9, z0 + 0.8, u1 - u0 - 1.6, 1.8, z1 - z0 - 1.6, "r9Pad", bevel=0.02)
    for z in (z0 + 0.8, z1 - 0.8):
        hcyl(k, u0 + 0.8, u1 - 0.8, b + 1.8, z, 0.5, "r9PadD", n=3)
    for u in (u0 + 0.8, u1 - 0.8):
        cyl(k, u, b + 1.8, z0 + 0.8, z1 - 0.8, 0.5, "r9PadD", sides=6)


def pad_bolster(k, u0, u1, v, z, r=2.2):
    """A rolled bolster along a face at height z."""
    hcyl(k, u0, u1, v + r * 0.6, z, r, "r9Pad", n=6)


# ---- panels -------------------------------------------------------------------------------------------------------
def panel_seams(k, u0, u1, v, z0, z1, cols=2, bolts=True):
    """Seam lines splitting the face into panels, a bolt at each panel corner."""
    for i in range(1, cols):
        u = u0 + (u1 - u0) * i / cols
        _px(k, u - 0.5, u + 0.5, v, v + OFF, z0, z1, "r9Char")
    if bolts:
        for i in range(cols):
            a, c = u0 + (u1 - u0) * i / cols, u0 + (u1 - u0) * (i + 1) / cols
            for u in (a + 1.5, c - 1.5):
                for z in (z0 + 1.5, z1 - 1.5):
                    _px(k, u - 0.4, u + 0.4, v, v + 0.6, z - 0.4, z + 0.4, "r9Grey")


def panel_inset(k, u0, u1, v, z0, z1, m=2, w=1.2):
    """An inset panel: a raised frame round the face."""
    for a, b, c, d in ((u0 + m, u1 - m, z0 + m, z0 + m + w), (u0 + m, u1 - m, z1 - m - w, z1 - m),
                       (u0 + m, u0 + m + w, z0 + m + w, z1 - m - w), (u1 - m - w, u1 - m, z0 + m + w, z1 - m - w)):
        _px(k, a, b, v, v + 0.8, c, d, "r9Sand")


def panel_ribs(k, u0, u1, v, z0, z1, pitch=4):
    """Horizontal ribs."""
    for z in range(int(z0) + 2, int(z1) - 1, pitch):
        _px(k, u0 + 0.5, u1 - 0.5, v, v + 1, z, z + 1.6, "r9Sand")


def panel_corrugated(k, u0, u1, v, z0, z1, pitch=3, r=1.2):
    """Vertical corrugated metal on a dark ground."""
    _px(k, u0, u1, v, v + OFF, z0, z1, "r9GreyD")
    n = int((u1 - u0) // pitch)
    for i in range(n):
        cyl(k, u0 + (u1 - u0) * (i + 0.5) / n, v + OFF, z0 + 0.3, z1 - 0.3, r, "r9Grey", sides=6)


def panel_grille(k, u0, u1, v, z0, z1, pitch=3):
    """A perforated grille: dark holes in a grey plate."""
    _px(k, u0, u1, v, v + 0.5, z0, z1, "r9Grey")
    for u in range(int(u0) + 1, int(u1) - 1, pitch):
        for z in range(int(z0) + 1, int(z1) - 1, pitch):
            _px(k, u + 0.3, u + 1.8, v + 0.5, v + 0.5 + OFF, z + 0.3, z + 1.8, "r9Char")


def panel_louvre(k, u0, u1, v, z0, z1, pitch=3):
    """A louvred vent: tilted slats over a dark ground."""
    _px(k, u0, u1, v, v + OFF, z0, z1, "r9Char")
    _px(k, u0, u0 + 0.8, v, v + 1.6, z0, z1, "r9GreyD")
    _px(k, u1 - 0.8, u1, v, v + 1.6, z0, z1, "r9GreyD")
    for z in range(int(z0) + 1, int(z1) - 1, pitch):
        box(k, (u0 + u1) / 2, v + 1, z, u1 - u0 - 1.8, 1.6, 0.6 * 32 / ZPX, "r9Grey", rx=-0.6)


# ---- edges and trims (on a block u0..u1, v0..v1, height h) --------------------------------------------------------
def top_lip(k, u0, u1, v0, v1, h, over=1.5):
    """A dark lip under a tan top, both overhanging."""
    _px(k, u0 - over, u1 + over, v0 - over, v1 + over, h, h + 2, "r9GreyD")
    _px(k, u0 - over + 0.5, u1 + over - 0.5, v0 - over + 0.5, v1 + over - 0.5, h + 2, h + 3, "r9Tan")


def top_bullnose(k, u0, u1, v0, v1, h, r=1.5):
    """A tan top with a rounded front edge."""
    rz = r * ZPX / 32                                                                # the radius in z px
    _px(k, u0 - 1, u1 + 1, v0 - 1, v1, h, h + 2 * rz, "r9Tan")
    hcyl(k, u0 - 1, u1 + 1, v1, h + rz, r, "r9Tan", n=6)


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
    _px(k, u0, u1, v, v + 0.5, z0, z1, "r9GreyD")
    um, zm = (u0 + u1) / 2, (z0 + z1) / 2
    _px(k, um - 2, um + 2, v + 0.5, v + 1.2, zm - 0.5, zm + 0.5, "r9Grey")


def indicators(k, u, v, z, cols=("r9LedR", "r9LedG", "r9Lamp")):
    """A small dark plate with a row of lights."""
    _px(k, u - 1, u + 3 * len(cols), v, v + OFF, z - 1, z + 2.5, "r9Char")
    for i, c in enumerate(cols):
        _px(k, u + 3 * i, u + 3 * i + 1.6, v + OFF, v + 0.8, z, z + 1.6, c)


def pipe(k, u0, u1, v, z, r=1.4, clamps=2):
    """A pipe along u standing off a face at depth v, with clamps."""
    vc = v + r + 0.4
    hcyl(k, u0, u1, vc, z, r, "r9Grey", n=6)
    for i in range(clamps):
        u = u0 + (u1 - u0) * (i + 1) / (clamps + 1)
        hcyl(k, u - 0.8, u + 0.8, vc, z, r + 0.5, "r9GreyD", n=6)
        _px(k, u - 0.8, u + 0.8, v, vc, z - 0.6, z + 0.6, "r9GreyD")


def rivets(k, u0, u1, v, z, pitch=4):
    for u in [u0 + i * pitch for i in range(int((u1 - u0) / pitch) + 1)]:
        _px(k, u - 0.4, u + 0.4, v, v + 0.6, z - 0.4, z + 0.4, "r9Grey")


def stencil(k, u0, u1, v, z0, z1):
    """A painted plate: an orange field with a bone band."""
    _px(k, u0, u1, v, v + OFF, z0, z1, "r9Orange")
    zm = (z0 + z1) / 2
    _px(k, u0 + 1, u1 - 1, v + OFF, v + 0.5, zm - 0.6, zm + 0.6, "r9Bone")


# ---- the kit sheet: each treatment on the sample block ------------------------------------------------------------
def block(name, col="r9Bone"):
    k = Bench(name, (2, 1))
    _px(k, U0, U1, V0, V1, 0, H, col)
    return k


def sample(name, fn, col="r9Bone"):
    def run():
        k = block(f"kit_{name}", col)
        fn(k)
        return k.build()
    return run


FACE = (U0 + 1, U1 - 1, V1, 2, H - 2)                                                # the front face's usable area
SAMPLES = (
    ("p1", "P1 tuck and roll", lambda k: pad_rolls(k, *FACE)),
    ("p2", "P2 channels", lambda k: pad_channels(k, *FACE)),
    ("p3", "P3 biscuit", lambda k: pad_biscuit(k, *FACE)),
    ("p4", "P4 diamond", lambda k: pad_diamond(k, *FACE)),
    ("p5", "P5 cushion, piped", lambda k: pad_cushion(k, *FACE)),
    ("p6", "P6 bolster", lambda k: pad_bolster(k, U0, U1, V1, H - 4)),
    ("s1", "S1 seams, bolts", lambda k: panel_seams(k, U0, U1, V1, 0, H)),
    ("s2", "S2 inset", lambda k: panel_inset(k, U0, U1, V1, 0, H)),
    ("s3", "S3 ribs", lambda k: panel_ribs(k, U0, U1, V1, 0, H)),
    ("s4", "S4 corrugated", lambda k: panel_corrugated(k, *FACE)),
    ("s5", "S5 grille", lambda k: panel_grille(k, U0 + 6, U1 - 6, V1, 5, H - 5)),
    ("s6", "S6 louvre", lambda k: panel_louvre(k, U0 + 6, U1 - 6, V1, 5, H - 5)),
    ("e1", "E1 lip and top", lambda k: top_lip(k, U0, U1, V0, V1, H)),
    ("e2", "E2 bullnose", lambda k: top_bullnose(k, U0, U1, V0, V1, H)),
    ("e3", "E3 stepped edge", None),
    ("e4", "E4 lit kick", None),
    ("e5", "E5 edge band", lambda k: edge_band(k, U0, U1, V0, V1, H)),
    ("e6", "E6 round end", lambda k: round_end(k, U1, V0, V1, 0, H)),
    ("d1", "D1 porthole", lambda k: porthole(k, 0, V1, H / 2, 6)),
    ("d2", "D2 hatch", lambda k: hatch(k, U0 + 10, U1 - 10, V1, 4, H - 4)),
    ("d3", "D3 indicators", lambda k: indicators(k, -3, V1, H / 2)),
    ("d4", "D4 pipe, clamps", lambda k: pipe(k, U0, U1, V1, H / 2)),
    ("d5", "D5 rivets", lambda k: [rivets(k, U0 + 2, U1 - 2, V1, z) for z in (3, H - 3)]),
    ("d6", "D6 stencil plate", lambda k: stencil(k, U0 + 8, U1 - 8, V1, 8, 18)),
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
