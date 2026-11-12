"""Double bunk bed look study (family `bunk`, preview only): a 1x2 module, two sleeping decks one over the other, r0.

Local frame modkit.K, footprint (1, 2): u across (the bunk's open long side is +u, which faces the camera at r0), v
along it (the head end is -v, the foot end +v, the module's front). Crew are 1.5 tall: the lower mattress tops out
about where the single bed's does (0.22), the upper deck leaves a seated crew member room under it."""
import math

from .modkit import K

FP = (1, 2)
PXG = 1 / 32                                            # a px along u or v
ZPX = 32 * math.sqrt(2) * math.cos(math.radians(30))   # px per unit of height


def zpx(n):
    return n / ZPX


L, W = 1.9, 0.86                                        # the decks' length (v) and width (u)
LOW, HIGH = 0.12, 0.98                                  # each deck's top (the mattress sits on it)
MAT = 0.1                                               # mattress thickness


def mattress(k, z, col="navy", top="blueGrey", blanket="steelL", stripe="orange"):
    """A mattress on a deck at z, its pillow at the head (-v) and a blanket over the foot two thirds."""
    k.box(0, 0, z, W - 0.04, L - 0.04, MAT, col, top=top, bevel=0.02)
    k.box(0, -0.66, z + MAT, 0.6, 0.38, 0.07, "medWhite", top="medWhite", bevel=0.025)
    k.box(0, 0.22, z + MAT, W - 0.06, 1.06, 0.03, blanket)
    k.box(0, 0.22, z + MAT + 0.03, W - 0.08, 1.02, 0.008, top)
    k.box(0, -0.31, z + MAT, W - 0.06, 0.05, 0.035, stripe)


def ladder(k, u, v, z0, z1, rails="steelL", rungs="steel", n=4):
    """A ladder against the +u side at v: two rails and n rungs, standing from z0 to z1."""
    for dv in (-0.13, 0.13):
        k.box(u, v + dv, z0, 0.04, 0.04, z1 - z0, rails, top=rails)
    for i in range(n):
        k.box(u, v, z0 + (i + 1) * (z1 - z0) / (n + 1), 0.04, 0.26, 0.035, rungs)


def b1():
    """B1 steel frame: four corner posts, two slung decks, a ladder at the foot of the open side, a rail along the
    upper deck's open side, a reading light under the upper deck."""
    k = K("bunk_b1", FP)
    post = "steelD"
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * (W / 2 - 0.03), sv * (L / 2 - 0.03), 0, 0.07, 0.07, HIGH + 0.42, post, top="steel")
    for z in (LOW, HIGH):
        k.box(0, 0, z - 0.08, W, L, 0.08, "steelD", top="steel", bevel=0.01)       # the deck frame
        mattress(k, z)
    for sv in (-1, 1):                                                             # head and foot boards
        k.box(0, sv * (L / 2 - 0.03), HIGH, W - 0.06, 0.04, 0.34 if sv < 0 else 0.26, "steel", top="steelL")
        k.box(0, sv * (L / 2 - 0.03), LOW, W - 0.06, 0.04, 0.3 if sv < 0 else 0.2, "steel", top="steelL")
    k.box(-(W / 2 - 0.03), 0, HIGH, 0.04, L - 0.06, 0.3, "steel", top="steelL")    # the back rail (wall side)
    k.box(W / 2 - 0.03, -0.3, HIGH + MAT + 0.1, 0.04, 1.2, 0.05, "steelL", top="steelL")   # the open side's rail
    for v in (-0.88, 0.28):
        k.box(W / 2 - 0.03, v, HIGH, 0.035, 0.035, MAT + 0.12, "steelL")
    ladder(k, W / 2 + 0.01, 0.62, 0, HIGH + MAT + 0.15)
    k.box(0, -0.5, HIGH - 0.1, 0.5, 0.06, 0.02, "cyan")                            # reading light under the deck
    return k.build()


def _frame(k):
    """B1's frame without its open-side rail: posts, both decks and mattresses, head and foot boards, the back rail."""
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * (W / 2 - 0.03), sv * (L / 2 - 0.03), 0, 0.07, 0.07, HIGH + 0.42, "steelD", top="steel")
    for z in (LOW, HIGH):
        k.box(0, 0, z - 0.08, W, L, 0.08, "steelD", top="steel", bevel=0.01)
        mattress(k, z)
    for sv in (-1, 1):
        k.box(0, sv * (L / 2 - 0.03), HIGH, W - 0.06, 0.04, 0.34 if sv < 0 else 0.26, "steel", top="steelL")
        k.box(0, sv * (L / 2 - 0.03), LOW, W - 0.06, 0.04, 0.3 if sv < 0 else 0.2, "steel", top="steelL")
    k.box(0, -0.5, HIGH - 0.1, 0.5, 0.06, 0.02, "cyan")


def _rail(k, z, v0, v1, h, posts):
    """A rail along the open side (+u) from v0 to v1, its top h over the deck at z, with uprights at `posts`."""
    u = W / 2 - 0.03
    k.box(u, (v0 + v1) / 2, z + h - 0.07, 0.06, v1 - v0, 0.07, "steelD", top="steel")   # top bar
    k.box(u, (v0 + v1) / 2, z + h * 0.5, 0.05, v1 - v0, 0.045, "steelD", top="steel")   # mid bar
    for v in posts:
        k.box(u, v, z, 0.05, 0.05, h - 0.07, "steelD", top="steel")


def b1a():
    """B1a: the upper deck railed the whole length of its open side, the ladder hooked over the rail at the foot."""
    k = K("bunk_b1a", FP)
    _frame(k)
    k.box(-(W / 2 - 0.03), 0, HIGH, 0.04, L - 0.06, 0.3, "steel", top="steelL")
    _rail(k, HIGH, -L / 2 + 0.03, L / 2 - 0.03, 0.4, (-0.5, 0.0, 0.5))
    ladder(k, W / 2 + 0.04, 0.62, 0, HIGH + 0.4)
    return k.build()


def b1b():
    """B1b: both decks railed along the open side, the upper the whole length, the lower with a gap in the middle to
    get in (the ladder stands in front of the lower rail at the foot)."""
    k = K("bunk_b1b", FP)
    _frame(k)
    k.box(-(W / 2 - 0.03), 0, HIGH, 0.04, L - 0.06, 0.3, "steel", top="steelL")
    k.box(-(W / 2 - 0.03), 0, LOW, 0.04, L - 0.06, 0.26, "steel", top="steelL")
    _rail(k, HIGH, -L / 2 + 0.03, L / 2 - 0.03, 0.4, (-0.5, 0.0, 0.5))
    _rail(k, LOW, -L / 2 + 0.03, -0.3, 0.34, (-0.6,))
    _rail(k, LOW, 0.4, L / 2 - 0.03, 0.34, ())
    ladder(k, W / 2 + 0.04, 0.62, 0, HIGH + 0.4)
    return k.build()


def b1c():
    """B1c: the upper deck walled on every side by low panels as tall as the head board, a gap at the ladder."""
    k = K("bunk_b1c", FP)
    _frame(k)
    H = 0.34
    k.box(-(W / 2 - 0.03), 0, HIGH, 0.04, L - 0.06, H, "steel", top="steelL")
    u = W / 2 - 0.03
    k.box(u, -0.2, HIGH, 0.04, 1.36, H, "steel", top="steelL")                    # open side, head to the ladder
    k.box(u, -0.2, HIGH + H - 0.06, 0.045, 1.3, 0.02, "steelL")                     # its top trim
    k.box(0, L / 2 - 0.03, HIGH, W - 0.06, 0.04, H, "steel", top="steelL")        # foot board raised to match
    ladder(k, W / 2 + 0.01, 0.7, 0, HIGH + H)
    return k.build()


RAIL = {"thin": (0.04, 0.035, "steelL", "steelL"), "thick": (0.06, 0.05, "steelD", "steel")}   # bar, upright, colours


def _rails(k, z, h, side, a0, a1, posts, weight, mid=True):
    """A rail h over the deck at z along one side: side 'u+' / 'u-' (a long side, a0..a1 along v) or 'v+' / 'v-' (an
    end, a0..a1 along u), uprights at `posts`, a mid bar unless mid is False."""
    bar, up, col, top = RAIL[weight]
    e = (W / 2 - 0.03) if side[0] == "u" else (L / 2 - 0.03)
    e = e if side[1] == "+" else -e
    c, n = (a0 + a1) / 2, a1 - a0

    def box(a, zz, sa, sz, w):
        if side[0] == "u":
            k.box(e, a, zz, w, sa, sz, col, top=top)
        else:
            k.box(a, e, zz, sa, w, sz, col, top=top)
    box(c, z + h - bar, n, bar, bar)
    if mid:
        box(c, z + h * 0.5, n, bar * 0.75, bar * 0.85)
    for a in posts:
        box(a, z, up, h - bar, up)


def _railed(name, weight):
    """B1 with every solid board turned to a rail: head and foot on both decks, the upper deck's back (wall side), and
    the open side's rail as B1's (the head two thirds, the ladder at the foot)."""
    k = K(name, FP)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * (W / 2 - 0.03), sv * (L / 2 - 0.03), 0, 0.07, 0.07, HIGH + 0.42, "steelD", top="steel")
    for z in (LOW, HIGH):
        k.box(0, 0, z - 0.08, W, L, 0.08, "steelD", top="steel", bevel=0.01)
        mattress(k, z)
    k.box(0, -0.5, HIGH - 0.1, 0.5, 0.06, 0.02, "cyan")
    eu = W / 2 - 0.06
    for z, h in ((LOW, 0.3), (HIGH, 0.36)):
        for side in ("v-", "v+"):
            _rails(k, z, h, side, -eu, eu, (0.0,), weight)
    _rails(k, HIGH, 0.36, "u-", -L / 2 + 0.06, L / 2 - 0.06, (-0.45, 0.0, 0.45), weight)
    _rails(k, HIGH, 0.36, "u+", -L / 2 + 0.06, 0.3, (-0.3,), weight)
    ladder(k, W / 2 + 0.03, 0.62, 0, HIGH + 0.4)
    return k.build()


def b1f():
    """B1f: B1's solid head and foot boards; thin rails on the wall side of both decks and along the upper deck's open
    side (its head two thirds, the ladder at the foot)."""
    k = K("bunk_b1f", FP)
    _frame(k)
    _rails(k, HIGH, 0.36, "u-", -L / 2 + 0.06, L / 2 - 0.06, (-0.45, 0.0, 0.45), "thin")
    _rails(k, LOW, 0.3, "u-", -L / 2 + 0.06, L / 2 - 0.06, (-0.45, 0.0, 0.45), "thin")
    _rails(k, HIGH, 0.36, "u+", -L / 2 + 0.06, 0.3, (-0.3,), "thin")
    ladder(k, W / 2 + 0.03, 0.62, 0, HIGH + 0.4)
    return k.build()


def b1d():
    return _railed("bunk_b1d", "thin")


def b1e():
    return _railed("bunk_b1e", "thick")


def b2():
    """B2 berth cabinet: a white shell round both berths (the open side faces the camera), each berth lit along its
    ceiling, a privacy curtain drawn halfway on the upper one, a ladder by the foot."""
    k = K("bunk_b2", FP)
    sh, shT = "medWhite", "medWhite"
    T = 0.06                                                                       # shell thickness
    top = HIGH + 0.62
    k.box(-(W / 2 - T / 2), 0, 0, T, L, top, sh, top=shT)                          # back panel (wall side)
    for sv in (-1, 1):                                                             # end panels
        k.box(0, sv * (L / 2 - T / 2), 0, W, T, top, sh, top=shT, bevel=0.01)
    k.box(0, 0, top - T, W, L, T, sh, top=shT, bevel=0.01)                         # roof
    k.box(0, 0, 0, W, L - 2 * T, LOW, "steel", top="steel")                        # plinth under the lower berth
    k.box(W / 2 - 0.02, 0, 0, 0.04, L - 2 * T, 0.05, "cyan")                       # kick light
    k.box(0, 0, HIGH - 0.1, W, L - 2 * T, 0.1, sh, top="steelL")                   # the middle deck
    k.box(W / 2 - 0.03, 0, HIGH - 0.1, 0.06, L - 2 * T, 0.1, "steelL")             # its front edge
    for z in (LOW, HIGH):
        mattress(k, z, col="navy", top="blueGrey", blanket="steel", stripe="cyan")
    for z in (HIGH - 0.13, top - T - 0.03):                                        # each berth's ceiling light
        k.box(-0.1, 0, z, 0.06, L - 0.4, 0.02, "cyan")
    k.box(W / 2 - 0.05, -0.4, HIGH + MAT + 0.02, 0.03, 0.85, 0.48, "navy", top="navy")   # curtain, half drawn
    k.box(W / 2 - 0.02, 0, top - T - 0.02, 0.02, L - 2 * T, 0.02, "steelL")        # curtain track
    ladder(k, W / 2 + 0.01, 0.62, LOW, HIGH + MAT + 0.12, n=3)                      # up the open side, by the foot
    return k.build()


def b3():
    """B3 locker frame: a tall locker column at the head carries both decks (no posts at the open side), a
    cantilevered upper deck with a low lip, a ladder in the middle of the open side."""
    k = K("bunk_b3", FP)
    col = "steel"
    D = 0.34                                                                       # the locker column's depth (v)
    hv = -L / 2 + D / 2
    top = HIGH + 0.55
    k.box(0, hv, 0, W, D, top, col, top="steelL", bevel=0.01)                       # the column
    for i, z in enumerate((0.1, 0.55, HIGH + 0.15)):                               # its locker doors (front face +v)
        k.box(0.0, hv + D / 2 + 0.005, z, W - 0.12, 0.01, 0.36 if i < 2 else 0.32, "steelD")
        k.box(W / 2 - 0.14, hv + D / 2 + 0.012, z + 0.14, 0.04, 0.01, 0.08, "cyan")
    dl = L - D                                                                     # decks run from the column
    dv = hv + D / 2 + dl / 2
    for z in (LOW, HIGH):
        k.box(0, dv, z - 0.08, W, dl, 0.08, "steelD", top="steel", bevel=0.01)
        k.box(0, dv + 0.0, z - 0.11, W - 0.2, dl - 0.1, 0.03, "dark")               # the deck's underside
    k.box(0, L / 2 - 0.04, 0, W, 0.08, LOW, "steelD", top="steel")                  # lower deck's foot
    k.box(-(W / 2 - 0.04), L / 2 - 0.04, 0, 0.08, 0.08, HIGH, "steelD", top="steel")   # one post at the far foot
    k.box(-(W / 2 - 0.03), dv, HIGH, 0.04, dl, 0.24, "steelD", top="steel")         # wall-side lip, upper
    k.box(W / 2 - 0.03, dv - 0.25, HIGH, 0.04, dl - 0.55, 0.14, "steelD", top="steel")   # open side lip, upper
    for z in (LOW, HIGH):
        mattress(k, z, col="rust", top="rustD", blanket="steelL", stripe="cyan")
    ladder(k, W / 2 + 0.01, 0.62, 0, HIGH + MAT + 0.1, rails="steelL", rungs="steelL", n=3)
    k.box(0, hv + D / 2 + 0.01, HIGH + 0.38, 0.5, 0.01, 0.04, "cyan")               # reading light on the column
    k.box(0, hv + D / 2 + 0.01, LOW + 0.34, 0.5, 0.01, 0.04, "cyan")
    return k.build()


DESIGNS = {"b1": b1, "b2": b2, "b3": b3, "b1a": b1a, "b1b": b1b, "b1c": b1c, "b1d": b1d, "b1e": b1e, "b1f": b1f}


def jobs():
    return [(f"module.bunk.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
