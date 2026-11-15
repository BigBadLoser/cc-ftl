"""Bar look study round 25 (family `barcounter25`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
round 24's three moved forward so the counter's front sits on the tile edge, next to the stools (front at v 15.5 of
16; the back is now 7 px off its edge for the bartender's side).

  o1 K1, no glow line
  o2 a brass foot rail tucked into the kick recess, under the panel face (nothing past the counter's front)
  o3 the bone pilasters run down to the floor as legs, the rail tucked between them

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r13 import mug
from .barcounter_r22 import OX, U0, U1, panels
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench

F, B = 13, -7                                                                        # front pushed to the tile edge (panels end at 15.5)
KV = F - 4                                                                           # the kick's face, set back


def mugs(k):
    for u, col in ((-26, "r9Amber"), (14, "r9Blue")):
        mug(k, u, 3, col)


def k1_body(k, legs=False):
    _px(k, U0, U1, B, KV, 0, 4, "r9Char")
    if legs:
        for u in (U0, U0 + 30, U0 + 62, U1 - 2):
            _px(k, u, u + 2, KV, F, 0, 4, "x7Bone")
    _px(k, U0, U1, B, F, 4, TOP - 3, "x7Bone")
    for t in range(3):
        a, b = U0 + 32 * t + 3, U0 + 32 * t + 29
        _px(k, a, b, F, F + 1, 5, TOP - 4, "x7Gun")
        panels(k, a + 1, b - 1, F + 1, 6, TOP - 5, OX, cw=12, ch=7)
    _px(k, U0, U1, B, F + 1.5, TOP - 3, TOP - 1, "x7Black")
    _px(k, U0, U1, B, F + 1, TOP - 1, TOP, "x7Gun")
    mugs(k)


def rail(k, u0, u1, stand):
    for u in stand:
        _px(k, u, u + 2, KV, F - 1, 1.5, 2.5, "x7BrassD")
    _px(k, u0, u1, F - 1, F + 1, 1, 3, "x7Brass")                                   # front at F + 1: flush with the panels


def o1():
    k = Bench("bar_o1", (3, 1))
    k1_body(k)
    return k.build()


def o2():
    k = Bench("bar_o2", (3, 1))
    k1_body(k)
    rail(k, U0 + 1, U1 - 1, (U0 + 2, U0 + 31, U0 + 63, U1 - 4))
    return k.build()


def o3():
    k = Bench("bar_o3", (3, 1))
    k1_body(k, legs=True)
    for t in range(3):
        rail(k, U0 + 32 * t + 3, U0 + 32 * t + 29, ())
    return k.build()


VARIANTS = {"o1": o1, "o2": o2, "o3": o3}


def jobs():
    return [(f"module.barcounter.{v}", (3, 1), "prop", f) for v, f in VARIANTS.items()]
