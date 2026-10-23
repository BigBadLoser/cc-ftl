"""TIP BIN (option A to the ore cage): a self-dumping industrial hopper. A heavy plate body, hazard yellow, its sides a
profile with a vertical back, a front sloped out to the tipping lip and a curved rocker bottom that sits on a base frame;
released, it rolls forward on the rockers and dumps over the lip. Ribs stiffen the sides, a thick flange rims the top.
The base: two rails, fork pockets across, a release latch and lever at the front. Local frame: modkit.K (front = +v,
the lip)."""
import math

from . import ore_cage as C
from .modkit import K

YEL, YEL_D = "c4T2", "c4T4"
S = 0.8                                  # the sides' half width
BACK, LIP = -0.8, 0.86                   # v of the back and of the lip
TOP_B, TOP_F = 1.15, 1.0                 # top edge z at the back and at the lip
ROCK_C, ROCK_R = (-0.1, 1.4), 1.2       # the rocker arc's centre (v, z) and radius
FRONT_B = 0.6                            # v where the sloped front meets the rocker


class TipWear(C.Wear):
    STEPS = {**C.Wear.STEPS, YEL: ((0.55, "c4T3"), (0.72, YEL_D), (0.9, "rust"))}


def _bottom(v):
    return ROCK_C[1] - math.sqrt(max(0.0, ROCK_R ** 2 - (v - ROCK_C[0]) ** 2))


def profile():
    """The side profile (v, z), counter-clockwise: the rocker from back to front, the sloped front up to the lip, the top
    edge back, the back down."""
    n = 10
    arc = [(BACK + (FRONT_B - BACK) * i / n, _bottom(BACK + (FRONT_B - BACK) * i / n)) for i in range(n + 1)]
    return arc + [(LIP, TOP_F), (BACK, TOP_B)]


def top_z(v):
    return TOP_B + (TOP_F - TOP_B) * (v - BACK) / (LIP - BACK)


def body(k, w):
    pr = profile()
    for s in (-1, 1):                                                      # side plates, a lip of flange round them
        pts = [(s * S, v, z) for v, z in pr]
        C._poly(k, pts if s > 0 else pts[::-1], w(YEL, s * S, 0.0, 0.6))
    for i in range(len(pr) - 1):                                           # skin: rocker, front (the top stays open)
        (v0, z0), (v1, z1) = pr[i], pr[i + 1]
        col = w(YEL, 0.0, (v0 + v1) / 2, (z0 + z1) / 2)
        C._poly(k, [(S, v0, z0), (-S, v0, z0), (-S, v1, z1), (S, v1, z1)], col)
    (v0, z0), (v1, z1) = pr[-1], pr[0]                                    # back
    C._poly(k, [(S, v0, z0), (-S, v0, z0), (-S, v1, z1), (S, v1, z1)], w(YEL, 0.0, BACK, 0.7))
    # the inside, seen above a low heap: dark walls just inside the skin
    for s in (-1, 1):
        k.box(s * (S - 0.05), (BACK + LIP) / 2, 0.5, 0.02, LIP - BACK - 0.2, 0.55, "steelD")
    # top flange: across the back and the lip, and down each side along the sloped top edge
    k.box(0, BACK - 0.01, TOP_B - 0.06, 2 * S + 0.1, 0.1, 0.1, w(YEL_D, 0, BACK, TOP_B), top="c4T3")
    k.box(0, LIP - 0.02, TOP_F - 0.06, 2 * S + 0.1, 0.1, 0.1, w(YEL_D, 0, LIP, TOP_F), top="c4T3")
    L = math.hypot(LIP - BACK, TOP_F - TOP_B)
    tilt = math.atan2(TOP_F - TOP_B, LIP - BACK)
    for s in (-1, 1):
        k.box(s * (S + 0.01), (BACK + LIP) / 2, (TOP_B + TOP_F) / 2 - 0.06, 0.1, L, 0.1, w(YEL_D, s, 0, 1.0),
              top="c4T3", rx=tilt)
    for v in (-0.62, -0.2, 0.22):                                          # ribs down each side
        z0, z1 = _bottom(v) + 0.04, top_z(v) - 0.08
        for s in (-1, 1):
            k.box(s * (S + 0.03), v, z0, 0.06, 0.08, z1 - z0, w(YEL_D, s * S, v, z0), top=YEL_D)
    for u in (-0.45, 0.0, 0.45):                                           # ribs up the back
        k.box(u, BACK - 0.03, 0.45, 0.08, 0.06, TOP_B - 0.55, w(YEL_D, u, BACK, 0.4), top=YEL_D)
    for s in (-1, 1):                                                      # lifting eyes on the back corners
        k.box(s * (S - 0.08), BACK - 0.02, TOP_B + 0.03, 0.06, 0.12, 0.12, "steelD")


def base(k, w):
    for s in (-1, 1):                                                      # rails the rockers sit on
        C._run(k, (s * 0.6, -0.92), (s * 0.6, 0.78), 0.0, 0.2, 0.16, "steelD", top="steel", w=w)
    for v in (-0.45, 0.42):                                                # fork pockets across
        k.box(0, v, 0.0, 1.86, 0.32, 0.22, w("steel", 0, v, 0.1), top="steelD")
        for s in (-1, 1):
            k.box(s * 0.93, v, 0.04, 0.02, 0.24, 0.14, "dark")
    for s in (-1, 1):                                                      # rocker stops and the striped front bar
        k.box(s * 0.6, 0.86, 0.0, 0.18, 0.12, 0.28, "steelD", top="steel")
    k.box(0, 0.86, 0.06, 1.0, 0.06, 0.12, "hazK")
    for i in range(6):
        k.box(-0.42 + i * 0.168, 0.89, 0.06, 0.084, 0.01, 0.12, "hazY")
    k.box(0.93, 0.55, 0.2, 0.05, 0.05, 0.42, "steelD", top="hazY", rx=-0.3)     # the release lever
    k.box(0.93, 0.5, 0.18, 0.12, 0.14, 0.1, "steel")


def tip_bin(fp, fill, rot, ore="iron"):
    k = K(f"tip_bin_{ore}_{fill}_{rot}", fp, rot)
    w = TipWear(17, amount=0.9)
    base(k, w)
    body(k, w)
    if C.HEAP[fill]:
        shim = type("B", (), dict(u1=S - 0.02 + C.GIRDER / 2, v0=BACK + 0.0, v1=LIP - 0.04))()
        h = C.Heap(shim, fill, 11 + C.FILLS.index(fill))
        level, rise = C.HEAP[fill]
        h.level, h.rise = TOP_F * level / C.HEAP["full"][0] - 0.02, rise
        h.build(k, ore, walls=False)
    return k.build()
