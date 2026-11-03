"""The exterior hull's key catalog (no bpy): every key (hull_outline.key) that ship outlines with a minimum feature
width of WIDTH tiles produce, sampled from random outlines, as the sprite set to render. Ships keep that width
(their builders and generators refuse thinner parts: the footprint is its own opening by a WIDTH square), so the
catalog is all but closed; damage and wrecks can still make others, which take the catch-all piece.

python3 -m sprites.hull_catalog [ships] (from tools/blender): writes CATALOG, each key with how many tiles took it."""
import json
import random
import sys
from collections import Counter
from multiprocessing import Pool
from pathlib import Path

from . import hull_outline as HO

WIDTH = 3                           # tiles: the narrowest part a ship may have
SIZE = 18                           # tiles: the random outlines' box
SHIPS = 50_000                      # outlines sampled (seeds 0..SHIPS-1: the catalog is reproducible)
CATALOG = Path(__file__).resolve().parents[1] / "hull_keys.json"


def opened(cells, w=WIDTH):
    """The cells' opening by a w x w square: the parts narrower than w tiles gone; straight edges and 45 degree
    staircases kept."""
    offs = [(i, j) for i in range(w) for j in range(w)]
    core = {(x, y) for x, y in cells if all((x + i, y + j) in cells for i, j in offs)}
    return {(x + i, y + j) for x, y in core for i, j in offs}


def _chamfer(cells, rnd, x0, y0, x1, y1):
    """Each corner of the box cut by a staircase of 0..3 steps (a 45 degree diagonal)."""
    for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        k = rnd.choice((0, 0, 1, 2, 3))
        for i in range(k):
            for j in range(k - i):
                cells.discard((cx + sx * i, cy + sy * j))


def outline(seed):
    """A random ship outline, opened to WIDTH: a chamfered box; boxes joined and carved, each chamfered; or smoothed
    noise (by seed mod 3)."""
    rnd, cells = random.Random(seed), set()
    if seed % 3 == 0:
        x0, y0 = rnd.randint(1, 4), rnd.randint(1, 4)
        x1, y1 = rnd.randint(x0 + 3, SIZE - 2), rnd.randint(y0 + 3, SIZE - 2)
        cells = {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}
        _chamfer(cells, rnd, x0, y0, x1, y1)
    elif seed % 3 == 1:
        for _ in range(rnd.randint(2, 5)):
            x0, y0 = rnd.randint(1, SIZE - 6), rnd.randint(1, SIZE - 6)
            x1, y1 = min(x0 + rnd.randint(1, 8), SIZE - 2), min(y0 + rnd.randint(1, 8), SIZE - 2)
            box = {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}
            _chamfer(box, rnd, x0, y0, x1, y1)
            cells = cells - box if cells and rnd.random() < 0.25 else cells | box
    else:
        cells = {(x, y) for x in range(1, SIZE - 1) for y in range(1, SIZE - 1) if rnd.random() < 0.55}
        for _ in range(3):
            cells = {(x, y) for x in range(1, SIZE - 1) for y in range(1, SIZE - 1)
                     if sum((x + i, y + j) in cells for i in (-1, 0, 1) for j in (-1, 0, 1)) >= 5}
    return opened(cells)


def _keys(seed):
    cells = outline(seed)
    if len(cells) < 4:
        return []
    loops = HO.outline(cells)
    return [HO.key(loops, t) for t in cells]


def sample(ships=SHIPS):
    """Every key on the sampled outlines, with how many tiles took it."""
    counts = Counter()
    with Pool() as pool:
        for ks in pool.imap(_keys, range(ships), chunksize=50):
            counts.update(ks)
    return counts


def keys():
    """The catalog's keys, most used first."""
    return list(json.loads(CATALOG.read_text()))


if __name__ == "__main__":
    counts = sample(int(sys.argv[1]) if len(sys.argv) > 1 else SHIPS)
    CATALOG.write_text(json.dumps(dict(counts.most_common()), indent=0) + "\n")
    once = sum(c == 1 for c in counts.values())
    print(f"{len(counts)} keys over {sum(counts.values())} tiles; {once} seen once (an unseen key ~1 tile in"
          f" {sum(counts.values()) // max(once, 1)})")
