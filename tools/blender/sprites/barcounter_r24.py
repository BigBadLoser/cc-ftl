"""Bar look study round 24 (family `barcounter24`, palette sets bar22 + bar17 + bar9, preview only; counter top 24 px):
K1 (round 22) kept, the kick's glow line dropped, and M2's foot rail brought in so it no longer pushes the stools out.

  n1 K1 as it was, no glow line
  n2 a brass foot rail tucked into the kick recess, under the panel face (nothing past the counter's front)
  n3 the bone pilasters run down to the floor as legs, the rail tucked between them

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
from .barcounter_r22 import OX, B, F, U0, U1, mugs, panels
from .barcounter_study import TOP
from .bunk_study import _px
from .research_kit import Bench

KV = F - 4                                                                           # the kick's face, set back


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


def n1():
    k = Bench("bar_n1", (3, 1))
    k1_body(k)
    return k.build()


def n2():
    k = Bench("bar_n2", (3, 1))
    k1_body(k)
    rail(k, U0 + 1, U1 - 1, (U0 + 2, U0 + 31, U0 + 63, U1 - 4))
    return k.build()


def n3():
    k = Bench("bar_n3", (3, 1))
    k1_body(k, legs=True)
    for t in range(3):
        rail(k, U0 + 32 * t + 3, U0 + 32 * t + 29, ())
    return k.build()


VARIANTS = {"n1": n1, "n2": n2, "n3": n3}


def jobs():
    return [(f"module.barcounter.{v}", (3, 1), "prop", f) for v, f in VARIANTS.items()]
