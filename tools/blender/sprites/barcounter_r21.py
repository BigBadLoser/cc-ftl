"""Bar look study round 21 (family `barcounter21`, palette sets bar17 + bar9, preview only; counter top 24 px): t1 as
pieces that combine into an L. Square corners; big padded panels in place of the pleats (each lit along its top and
left, dark seams between), a gunmetal band at their foot and a gunmetal lip under a tan top.

Pieces (each runs to its tiles' edges along the run, so neighbours butt flush; the customer face is padded):
  t1s straight (3x1): front +v padded
  t1c corner (1x1): turns the run back at the right; front +v and right +u padded
  t1a arm (1x2): the run going back from the corner along v; its right +u side padded
An L: t1s, then t1c at its right end, then t1a behind t1c. The bartender stands inside the L; customers along the
front and down the right side.

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r13 import mug
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench

F, B = 8, -12                                                                        # the run's front and back
CW, CH = 10, 6                                                                       # a padded panel, px


def panels_v(k, u0, u1, v, z0, z1):
    """Big padded panels on a face looking +v at depth v: a dark ground, panels 1 px proud, lit top and left."""
    _px(k, u0, u1, v, v + 0.5, z0, z1, "r9PadD")
    n = max(1, round((u1 - u0 + 1) / (CW + 1)))
    w = (u1 - u0 + 1) / n - 1
    rows = max(1, round((z1 - z0 + 1) / (CH + 1)))
    h = (z1 - z0 + 1) / rows - 1
    for i in range(n):
        a = round(u0 + i * (w + 1))
        b = round(a + w)
        for j in range(rows):
            c = round(z1 - j * (h + 1))
            d = round(c - h)
            _px(k, a, b, v, v + 1.5, c - 1, c, "r9PadL")
            _px(k, a, a + 1, v, v + 1.5, d, c - 1, "r9PadL")
            _px(k, a + 1, b, v, v + 1.5, d, c - 1, "r9Pad")


def panels_u(k, u, v0, v1, z0, z1):
    """panels_v for a face looking +u at u (the right-hand face)."""
    _px(k, u, u + 0.5, v0, v1, z0, z1, "r9PadD")
    n = max(1, round((v1 - v0 + 1) / (CW + 1)))
    w = (v1 - v0 + 1) / n - 1
    rows = max(1, round((z1 - z0 + 1) / (CH + 1)))
    h = (z1 - z0 + 1) / rows - 1
    for i in range(n):
        a = round(v0 + i * (w + 1))
        b = round(a + w)
        for j in range(rows):
            c = round(z1 - j * (h + 1))
            d = round(c - h)
            _px(k, u, u + 1.5, a, b, c - 1, c, "r9PadL")
            _px(k, u, u + 1.5, b - 1, b, d, c - 1, "r9PadL")                         # lit on its camera-near side
            _px(k, u, u + 1.5, a, b - 1, d, c - 1, "r9Pad")


def body(k, u0, u1, v0, v1, front_v=None, front_u=None):
    """A counter block over u0..u1, v0..v1: a kick set back from the padded faces, a bone body, the padded faces, a
    gunmetal band and lip, a tan top. front_v / front_u: the padded face's extent along that face, or None."""
    kv = v1 - 3 if front_v else v1
    ku = u1 - 3 if front_u else u1
    _px(k, u0, ku, v0, kv, 0, 4, "r9Char")
    if front_v:
        _px(k, front_v[0], front_v[1], kv, kv + 0.5, 0.3, 1.3, "r9Warm")
    if front_u:
        _px(k, ku, ku + 0.5, front_u[0], front_u[1], 0.3, 1.3, "r9Warm")
    _px(k, u0, u1, v0, v1, 4, TOP - 3, "r9Bone")
    if front_v:
        _px(k, front_v[0], front_v[1], v1, v1 + 1, 4, 6, "x7Gun")
        panels_v(k, front_v[0], front_v[1], v1, 6, TOP - 4)
    if front_u:
        _px(k, u1, u1 + 1, front_u[0], front_u[1], 4, 6, "x7Gun")
        panels_u(k, u1, front_u[0], front_u[1], 6, TOP - 4)
    _px(k, u0, u1 + (1.5 if front_u else 0), v0, v1 + (1.5 if front_v else 0), TOP - 3, TOP - 1, "x7Gun")
    _px(k, u0, u1 + (1 if front_u else 0), v0, v1 + (1 if front_v else 0), TOP - 1, TOP, "r9Tan")


def t1s():
    k = Bench("bar_t1s", (3, 1))
    body(k, -48, 48, B, F, front_v=(-48, 48))
    for u, col in ((-26, "r9Amber"), (14, "r9Blue")):
        mug(k, u, -2, col)
    return k.build()


def t1c():
    k = Bench("bar_t1c", (1, 1))
    body(k, -16, F, -16, F, front_v=(-16, F), front_u=(-16, F))
    return k.build()


def t1a():
    k = Bench("bar_t1a", (1, 2))
    body(k, B, F, -32, 32, front_u=(-32, 32))
    mug(k, -2, 10, "r9Ruby")
    return k.build()


PIECES = {"t1s": ((3, 1), t1s), "t1c": ((1, 1), t1c), "t1a": ((1, 2), t1a)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in PIECES.items()]
