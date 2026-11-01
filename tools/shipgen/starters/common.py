"""Shared bits of the starter variant builders (see tools/shipgen/templateDraw.py)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from templateDraw import Ship, Shift, hull, hline, vline, box, show, emit  # noqa: E402,F401

HERE = os.path.dirname(os.path.abspath(__file__))
GALLEY = {'orders': [{'recipe': 'recipe.ration', 'mode': 'keep', 'target': 12}]}
STOCK_BUILD = [{'item': 'item.metal', 'count': 60}, {'item': 'item.electronics', 'count': 20}, {'item': 'item.polymer', 'count': 20}]
STOCK_ARMS = [{'item': 'item.rifle', 'count': 1}, {'item': 'item.sidearm', 'count': 2}, {'item': 'item.blade', 'count': 1}, {'item': 'item.fuel', 'count': 16}, {'item': 'item.water', 'count': 30}, {'item': 'item.oxygen', 'count': 20}]


def tagged(s, kind):
    s.kind = kind
    return s


def write(name, ships, doc):
    emit(os.path.join(HERE, name + '.ts'), ships, doc)
    # the kind label goes into the variant entry
    path = os.path.join(HERE, name + '.ts')
    t = open(path).read()
    for sh in ships:
        k = getattr(sh, 'kind', None)
        if k: t = t.replace(f"    name: '{sh.name}', note:", f"    name: '{sh.name}', kind: '{k}', note:", 1)
    open(path, 'w').write(t)


# --- room furnishing (round 5): rooms are rectangles with walls; furniture hugs the north wall -----------------------
SIZES = {
    'bed': (1, 2), 'med_bed': (1, 2), 'galley': (2, 1), 'mess_table': (2, 1), 'hydroponics': (2, 1), 'fabricator': (2, 1),
    'storage': (1, 1), 'storage_locker': (1, 1), 'storage_rack': (2, 1), 'storage_pallet': (2, 2), 'storage_ore': (2, 2),
    'storage_ore_large': (3, 2), 'lifeSupport': (1, 2), 'reactor': (2, 2), 'shieldGen': (2, 2), 'shieldGen.mk2': (2, 3),
    'burstLaser': (2, 2), 'missileLauncher': (3, 3), 'helm': (3, 2), 'shieldConsole': (3, 2), 'weaponsConsole': (2, 2),
    'refinery': (3, 4), 'pod_bay': (3, 3), 'vehicle_bay': (4, 5),
}


class Room:
    """A room drawn with walls on its rectangle (x0, y0)-(x1, y1); `ix0..iy1` is its floor."""
    def __init__(self, s, x0, y0, x1, y1, name):
        self.s, self.x0, self.y0, self.x1, self.y1, self.name = s, x0, y0, x1, y1, name
        self.ix0, self.iy0, self.ix1, self.iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
        s.room(x0, y0, x1, y1)
        # walls on all four sides even where the room is drawn over existing floor (a room inside a hull outline)
        hline(s, x0, x1, y0); hline(s, x0, x1, y1); vline(s, x0, y0, y1); vline(s, x1, y0, y1)

    def row(self, items, y=None, x=None, gap=0, wall='n'):
        """Place items left to right against the north wall (or with wall='s' the south wall, turned to face north, so
        their use tiles face into the room). An item is a def id or (id, kwargs)."""
        cx = self.ix0 if x is None else x
        for it in items:
            d, kw = (it, {}) if isinstance(it, str) else (it[0], dict(it[1]))
            w, h = SIZES[d]
            cy = (self.iy0 if wall == 'n' else self.iy1 - h + 1) if y is None else y
            rot = kw.pop('rot', 0 if wall == 'n' else 2)
            self.s.m(d, cx, cy, rot, **kw)
            cx += w + gap
        return cx

    def light(self, *pts):
        self.s.lights(*pts)

    def m(self, d, x, y, rot=0, **kw):
        self.s.m(d, x, y, rot, **kw)

    def lit(self, extra=()):
        """Lights along the room's south row, one every 6 tiles, plus any extra points."""
        y = self.iy1
        xs = list(range(self.ix0 + 2, self.ix1 + 1, 6)) or [self.ix0]
        self.s.lights(*[(x, y) for x in xs], *extra)


def room(s, name, x0, y0, x1, y1):
    s.section(name)
    return Room(s, x0, y0, x1, y1, name)
