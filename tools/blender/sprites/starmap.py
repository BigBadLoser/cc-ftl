"""Starmap art (family `starmap`, sheet `starmap`): pipeline sprites for the map's pictures, replacing the code-drawn ones.
Lanes, node pips, territory outlines and labels stay UI. Same camera, palette and post as every other sprite (three-quarter
view, hard pixels); each sprite has a fixed frame with the anchor at its centre (starmap_kit.frame_item).

  starmap.body.<kind>[.v0..v2]   sector bodies, 96 px frame at 1x (192 at 2x), body radius 30 px (60): starmap_bodies.py
  starmap.struct.<kind>          structure icons, 48 px frame (96) drawn at half (twice the density), team-tinted: starmap_icons.py
  starmap.fleet.<role>.d0..d7    fleet icons, 40 px frame (80) drawn at half, d0 = screen east, clockwise, team-tinted: starmap_fleets.py
  starmap.backdrop               a tileable, very dim starfield, 256 px (512), colour sheet only (backdrop below)

Team tint: structures and fleets paint their livery in the crew key colours (manifest `keyColors`, team.cloth and
team.accent, 5 shade steps each), so the map recolours them per owner the way the crew filter does."""
import numpy as np

from . import post
from .scale import ART_SCALE
from . import starmap_bodies, starmap_fleets, starmap_icons

BACKDROP = 256                  # 1x px; tiles seamlessly


def backdrop():
    """A tileable starfield: mostly dim one-pixel stars, a few brighter ones, very few with a small cross. Points need no 3D
    model, so it is placed in numpy (seeded) and snapped to palette colours. Positions are in 1x art px and a star is one
    art px at either scale (a 2x2 block at 2x), so both sets look the same at world size. Transparent between stars: it
    goes over the map's background."""
    post.select(True)
    S = BACKDROP * ART_SCALE
    rgba = np.zeros((S, S, 4), np.uint8)
    rng = np.random.default_rng(424242)

    def put(x, y, name):
        h = post.PAL[name]["hex"].lstrip("#")
        x, y = x % BACKDROP * ART_SCALE, y % BACKDROP * ART_SCALE
        rgba[y:y + ART_SCALE, x:x + ART_SCALE] = [int(h[i:i + 2], 16) for i in (0, 2, 4)] + [255]
    dim, mid, bright = ("bD", "hbK", "gB3", "bXH"), ("bL", "hbD", "steelL"), ("bH", "gW1", "icM", "oL")
    for count, cols in ((220, dim), (40, mid)):
        for _ in range(int(count * (BACKDROP / 256) ** 2)):
            x, y = (int(v) for v in rng.integers(0, BACKDROP, 2))
            put(x, y, cols[rng.integers(len(cols))])
    for _ in range(6):
        x, y = (int(v) for v in rng.integers(0, BACKDROP, 2))
        put(x, y, bright[rng.integers(len(bright))])
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            put(x + dx, y + dy, mid[0])
    return [{"id": "starmap.backdrop", "fp": (1, 1), "rgba": rgba, "g": np.zeros_like(rgba), "ax": 0, "ay": 0}]


def jobs():
    return starmap_bodies.jobs() + starmap_icons.jobs() + starmap_fleets.jobs() + [backdrop]
