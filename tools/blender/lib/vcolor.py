"""Vertex colour helpers: base colour + deterministic grime noise + vertical gradient toward the feet."""
import math
from . import palette


def hash3(x, y, z, seed=0):
    """Deterministic 0..1 noise from a position (same hash family as the crew lab)."""
    s = math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 17.31) * 43758.5453
    return s - math.floor(s)


def shade(rgb, p, seed=0, tone=1.0, grime=0.08, low=0.14, floor_h=0.55, clamp=True):
    """Shade a linear colour at world position `p` (x, y-up, z): tone, noise, then fade toward grime near the floor."""
    n = hash3(round(p[0] * 26), round(p[1] * 26), round(p[2] * 26), seed)
    m = tone * (1 - grime + grime * 1.1 * n)
    g = palette.linear("grime")
    t = max(0.0, 1 - p[1] / floor_h) * low
    out = tuple(c * m * (1 - t) + gc * t for c, gc in zip(rgb, g))
    return tuple(min(1.0, c) for c in out) if clamp else out
