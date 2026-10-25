"""Fleet icons for the starmap (family `starmap`): starmap.fleet.<role>.d0..d7, replacing the arrow glyphs of NPC fleets and
the player's ship marker.

A 48 px frame at 1x, anchor at the centre, lit and outlined like the ships. The map draws icons at one art px per screen
px, so each ship is rendered at one model scale for all its headings, the one that makes its longest heading about 46 px
(LONG plus the outline); each heading's screen box is centred in the frame. The models are laid out in the px of a 20
px icon. Pixel art cannot
be rotated in code, so there are 8 headings: d0 points east in screen space, then clockwise (d2 south, d4 west, d6 north),
the way the map's `rotate(heading)` turns. Each heading is the ground heading whose three-quarter projection points that
way, so north and south facings are foreshortened, as on the ships (one scale per ship, so they stay shorter on screen).

  patrol   sleek warship: a long needle hull, swept wings, twin drives
  pirate   scrappy raider: a lumpy rust hull, a ram spike, one side pod, mismatched drives
  raider   drone (rogue AI): a dark chevron with a red eye
  trader   boxy freighter: a bridge, a spine of containers, an engine block
  miner    small mining craft: a stubby cab with two drill arms and side pods
  player   the player's ship: a broad-winged corvette with a canopy

Livery is team.cloth (main panels) and team.accent (trim), so the map tints each fleet by faction. Sizes are 1x px of the
20 px layout."""
from . import core
from .starmap_kit import frame_item, place, prism, px, screen_heading, start, turn

SIZE = 48                       # frame, 1x px
ZOOM = 2                        # render scale of the 20 px layout (before the ship is scaled to LONG)
LONG = 44                       # the ship's longest side at its longest heading, 1x px, before the 1 px outline (46 with it)
ROLES = ("patrol", "pirate", "raider", "trader", "miner", "player")


class Ship:
    """Builds a ship in its local frame (u forward, v to the left, z up; 1x px of the 20 px layout) turned to a heading."""

    def __init__(self, heading):
        self.m = core.Mesh("ship")
        self.h = heading

    def hull(self, outline, z0, z1, side, top=None, inset=0.0):
        prism(self.m, turn([(px(u * ZOOM), px(v * ZOOM)) for u, v in outline], self.h), px(z0 * ZOOM), px(z1 * ZOOM), side,
              top, inset)

    def box(self, u, v, su, sv, z0, z1, side, top=None, inset=0.0):
        self.hull([(u + su / 2, v + sv / 2), (u - su / 2, v + sv / 2), (u - su / 2, v - sv / 2), (u + su / 2, v - sv / 2)],
                  z0, z1, side, top, inset)

    def mirror(self, outline, *a, **k):
        """The outline and its mirror across the centre line (v -> -v)."""
        self.hull(outline, *a, **k)
        self.hull([(u, -v) for u, v in reversed(outline)], *a, **k)

    def build(self):
        return [self.m.build()]


def patrol(s):
    s.hull([(8, 0), (2, 1.6), (-5, 2.2), (-7, 1.6), (-7, -1.6), (-5, -2.2), (2, -1.6)], -1.2, 1.0, "steelL", "team.cloth", 0.3)
    s.mirror([(0, 1.8), (-5.5, 6.2), (-7, 6.2), (-5.5, 1.8)], -0.5, 0.3, "steel", "team.cloth")
    s.box(-1.5, 0, 4.5, 1.6, 1.0, 2.2, "steel", "team.accent", 0.15)
    s.box(3.2, 0, 1.6, 1.0, 1.0, 1.6, "lens")
    for v in (1.1, -1.1):
        s.box(-7.4, v, 1.0, 1.4, -0.9, 0.7, "cyan")


def pirate(s):
    s.hull([(5.5, 0.8), (3, 2.6), (-4, 2.9), (-6.2, 1.5), (-6.2, -2), (-3, -3.1), (4, -1.9)], -1.4, 1.3, "rust", "rustD", 0.2)
    s.hull([(5.2, 1.2), (8.7, 0), (5.2, -1.2)], -0.6, 0.7, "steel", "steelL")
    s.box(-0.5, 4.2, 5.5, 2.4, -1.0, 1.0, "steel", "team.cloth", 0.15)
    s.box(0.5, -1.0, 3.0, 2.6, 1.3, 2.2, "steel", "team.cloth")
    s.hull([(-2, 1.5), (-3, 3.2), (-3.6, 1.2)], 1.3, 2.4, "steelD")
    for v, w in ((1.6, 1.4), (-0.6, 1.0), (-2.3, 1.6)):
        s.box(-6.6, v, 1.0, w, -1.0, 0.6, "orange")


def raider(s):
    s.hull([(7.5, 0), (-5.5, 5.8), (-3.2, 0), (-5.5, -5.8)], -0.8, 0.6, "dnW3", "team.cloth", 0.1)
    s.hull([(4, 0), (-1, 2), (-4, 1.2), (-4, -1.2), (-1, -2)], 0.6, 1.8, "dnW2", "dnW1", 0.25)
    s.box(3.6, 0, 1.3, 1.3, 0.2, 1.4, "red")
    s.mirror([(-4.6, 4.8), (-6.8, 5.6), (-5.6, 3.6)], -0.6, 0.4, "red")


def trader(s):
    s.box(5.6, 0, 3.2, 3.6, -1.0, 2.0, "steelL", "medWhite", 0.15)
    s.box(6.9, 0, 0.8, 2.2, 0.6, 1.6, "lens")
    s.box(-0.5, 0, 12.5, 1.4, -1.0, 0.0, "steelD")
    for k, u in enumerate((2.6, -0.6, -3.8)):
        top = "team.cloth" if k % 2 == 0 else "team.accent"
        for v in (1.4, -1.4):
            s.box(u, v, 2.8, 2.5, -1.3, 1.3, "plate", top, 0.06)
    s.box(-6.6, 0, 2.0, 3.4, -1.1, 1.1, "steel", "steelL", 0.1)
    for v in (0.9, -0.9):
        s.box(-7.9, v, 0.8, 1.2, -0.8, 0.6, "cyan")


def miner(s):
    s.hull([(3, 2.4), (-3.5, 2.6), (-4, 0), (-3.5, -2.6), (3, -2.4), (4, 0)], -1.6, 1.4, "steel", "team.cloth", 0.2)
    s.box(2.2, 0, 1.6, 2.4, 1.4, 2.2, "lens")
    for v in (1.7, -1.7):
        s.hull([(3.5, v + 0.9), (7.6, v * 0.75), (3.5, v - 0.9)], -0.9, 0.5, "steelL", "hazY", 0.1)
        s.box(7.4, v * 0.75, 0.9, 0.9, -0.5, 0.3, "steelL", "medWhite")
    for v in (3.2, -3.2):
        s.box(-2.2, v, 3.8, 1.6, -1.2, 0.6, "steelL", "team.accent", 0.1)
        s.box(-4.3, v, 0.7, 1.2, -1.0, 0.4, "cyan")


def player(s):
    s.hull([(7, 0), (2, 2.1), (-4, 2.2), (-6, 1.6), (-6, -1.6), (-4, -2.2), (2, -2.1)], -1.0, 0.9, "steelL", "plate", 0.22)
    s.mirror([(1.5, 2.0), (-1, 5.8), (-5, 5.8), (-4, 2.0)], -0.6, 0.5, "steel", "team.cloth", 0.1)
    s.mirror([(-1.2, 5.8), (-4.8, 5.8), (-4.4, 4.6), (-1.8, 4.6)], 0.5, 1.0, "team.accent")
    s.box(-1.2, 0, 5.0, 2.4, 0.9, 1.9, "plate", "team.cloth", 0.2)
    s.box(2.6, 0, 2.2, 1.4, 0.9, 1.7, "lens")
    for v in (1.0, -1.0):
        s.box(-6.4, v, 1.0, 1.3, -0.8, 0.7, "cyan")


BUILD = {"patrol": patrol, "pirate": pirate, "raider": raider, "trader": trader, "miner": miner, "player": player}


def _build(role, d):
    start()
    s = Ship(screen_heading(d * 45))
    BUILD[role](s)
    return s.build()


def fleet_items(role):
    """All 8 headings of a role at one model scale: the one that makes its longest heading LONG px."""
    longest = 0.0
    for d in range(8):
        x0, x1, y0, y1 = core.extent_px(_build(role, d))
        longest = max(longest, x1 - x0, y1 - y0)
    k = LONG * core.ART_SCALE / longest
    items = []
    for d in range(8):
        objs = _build(role, d)
        for ob in objs:
            ob.scale = (k,) * 3
        if place(objs, SIZE) < 0.999:                            # centred in the frame; it must not need shrinking
            raise ValueError(f"starmap.fleet.{role}.d{d} does not fit the {SIZE} px frame at the role's scale")
        items.append(frame_item(f"starmap.fleet.{role}.d{d}", SIZE))
    return items


def jobs():
    return [lambda role=role: fleet_items(role) for role in ROLES]
