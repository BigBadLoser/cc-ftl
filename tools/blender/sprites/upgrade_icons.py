"""Weapon upgrade icons for the combat rows (family `upicons`): ui.upg.<id>, 14 x 14 px at 1x, one frame each.

2D pixel art like the overhead crew icons (crew_marks.py: see its docstring for why there is no Blender render): drawn by
hand for 14 px, each a 12 x 12 grid of colour keys inside the canvas with the dark 1 px outline added round it.

Drawn for telling apart at a glance, not as shrunk floor sprites: every icon has its own silhouette and its own dominant
colour (capacitor a dark cell with a yellow bolt, coolant a ribbed column of frosted
fins round a cyan core, housing a riveted grey shield plate,
prism a glass triangle splitting red/green/blue, focus a lens squeezing a red beam to a point, frag a brass slug bursting into
steel shards, rail two rails through copper coils with hot ends, nuke an upright warhead in
yellow-black hazard stripes, chain a forked violet
bolt, thermite a flame on a canister). Behaviour upgrades carry one sorting cue in the weapon's colour (laser red, mass
driver blue, missile green, ion violet, incendiary orange): their outline (STYLE "outline") or a square frame ("frame");
the general three keep the dark outline. No bpy: plain numpy.

Ids: ui.upg.capacitor .. ui.upg.thermite (the item id without `item.upg_`)."""
import numpy as np

from .crew_marks import Canvas, grow, rgb

N = 14
COL = {
    "K": "#151c28",                                            # outline
    "S": "#c4ccd4", "H": "#8e99a6", "D": "#5b6673", "W": "#f4fbff", "E": "#d8f2fa",     # steel light / mid / dark, white, glass
    "Y": "#ffd23f", "k": "#1b2028",                            # yellow, near-black marks
    "C": "#5fd8f0",                                            # coolant cyan
    "R": "#ff4d5e", "G": "#4fd47a", "B": "#4a8dff", "V": "#9a7dff", "O": "#ff5a1f",   # laser, missile/green, mass, ion, fire
    "r": "#ffa0aa", "v": "#cbbcff", "b": "#9cc4ff", "g": "#a6ecbc",   # the weapon colours lifted (fills inside a matching outline)
    "U": "#e0a050", "u": "#9a6428", "h": "#ffb04a", "F": "#ffe680", "L": "#7b8764",   # brass, its shade, heat, flame core, olive
}
PIP = {   # each behaviour upgrade's weapon colour
   "prism": "R", "focus": "R", "frag": "B", "rail": "B", "nuke": "G", "chain": "V", "thermite": "O"}

ICONS = {
    "capacitor": ["  YY    YY  ",
                  " SSSSSSSSSS ",
                  " HDDDDDYYDD ",
                  " HDDDDYYDDD ",
                  " HDDDYYDDDD ",
                  " HDDYYYYYDD ",
                  " HDDDDYYDDD ",
                  " HDDDYYDDDD ",
                  " HDDYYDDDDD ",
                  " HDDDDDDDDD ",
                  " DDDDDDDDDD ",
                  "            "],
    "coolant":   ["   SSSSSS   ",
                 " EEEEEEEEEE ",
                 "   DCCCCD   ",
                 " EEEEEEEEEE ",
                 "   DCCCCD   ",
                 " EEEEEEEEEE ",
                 "   DCCCCD   ",
                 " EEEEEEEEEE ",
                 "   DCCCCD   ",
                 " EEEEEEEEEE ",
                 "   DDDDDD   ",
                 "            "],
    "housing":   ["            ",
                  " SSSSSSSSSS ",
                  " SWHHHHHHWD ",
                  " SHHHHHHHHD ",
                  " SHHHHHHHHD ",
                  " SDDDDDDDDD ",
                  " SHHHHHHHHD ",
                  " SWHHHHHHWD ",
                  "  SHHHHHHD  ",
                  "   SHHHHD   ",
                  "    SHHD    ",
                  "     DD     "],
    "prism":     ["            ",
                 "    W       ",
                 "   WEW      ",
                 "   WEW      ",
                 "  WEEEW  RRR",
                 "  WEEEW RRR ",
                 " WEEEEEWGGGG",
                 " WEEEEEWBB  ",
                 "WEEEEEEEW BB",
                 "WWWWWWWWW   ",
                 "            ",
                 "            "],
    "focus":     ["            ",
                  "     WW     ",
                  "    WEEW    ",
                  "RRR WEEWR   ",
                  "RRR WEEWRRR ",
                  "RRR WEEWRRRW",
                  "RRR WEEWRRR ",
                  "RRR WEEWR   ",
                  "    WEEW    ",
                  "     WW     ",
                  "            ",
                  "            "],
    "frag":      ["     SS     ",
                 " S   SS   S ",
                 "  S       S ",
                 "    UUUU    ",
                 "   UhUUUu   ",
                 "SS UUkUUu SS",
                 "   UkUUUu   ",
                 "    uuuu    ",
                 "  S       S ",
                 " S   SS    S",
                 "     SS     ",
                 "            "],
    "rail":      ["            ",
                 "            ",
                 "  UU  UU    ",
                 "SSUUSSUUSShh",
                 "HHUUHHUUHHhh",
                 "  UU  UU    ",
                 "  UU  UU    ",
                 "SSUUSSUUSShh",
                 "HHUUHHUUHHhh",
                 "  UU  UU    ",
                 "            ",
                 "            "],
    "nuke":      ["     WS     ",
                 "    WSSD    ",
                 "   WSSSSD   ",
                 "  WSSSSSSD  ",
                 "  kYYkYYkY  ",
                 "  YYkYYkYY  ",
                 "  YkYYkYYk  ",
                 "  kYYkYYkY  ",
                 "  LLLLLLLL  ",
                 " DLLLLLLLLD ",
                 "DD        DD",
                 "            "],
    "chain":     ["     WVVVV  ",
                 "    WVVVV   ",
                 "   WVVVV    ",
                 "  WVVVVVVVV ",
                 "      WVVV  ",
                 "     WVVV   ",
                 "    WVVV    ",
                 "   WV  WV   ",
                 "  WV    WV  ",
                 " WV      WV ",
                 "            ",
                 "            "],
    "thermite":  ["     O      ",
                 "    OO      ",
                 "    OOO     ",
                 "   OOhOO    ",
                 "   OhFhOO   ",
                 "  OOhFFhO   ",
                 "  OhFFFFhO  ",
                 "  OhFFFFhO  ",
                 " DDDDDDDDDD ",
                 " LLLLLLLLLL ",
                 " LLLLLLLLLL ",
                 "            "],
}


STYLE = "frame"       # how a behaviour upgrade shows its weapon: "outline" (the silhouette's outline in the weapon colour) or
                      # "frame" (a 1 px square frame round the tile in the weapon colour); the general three keep the dark outline
LIGHTER = {"R": "r", "V": "v", "O": "h", "B": "b", "G": "g"}   # a fill in the outline's own colour is lifted a step so the edge shows


def draw(name, style=None):
    """One icon as an N x N RGBA array: the grid in the canvas with a 1 px outline round whatever is drawn: dark for the
    general upgrades; for a behaviour upgrade the weapon colour, as the outline itself or as a square frame (`style`)."""
    style = style or STYLE
    g = ICONS[name]
    assert len(g) == 12 and all(len(r) == 12 for r in g), name
    tag = PIP.get(name)
    c = Canvas(N, N)
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != " ":
                c.k[y + 1, x + 1] = LIGHTER.get(ch, ch) if tag and style == "outline" and ch == tag else ch
    op = c.k != ""
    k = c.k.copy()
    k[grow(op) & ~op] = tag if tag and style == "outline" else "K"
    if tag and style == "frame":
        k[0, :] = k[-1, :] = k[:, 0] = k[:, -1] = tag
    out = np.zeros((N, N, 4), np.uint8)
    for key in set(k.ravel()) - {""}:
        out[k == key] = (*rgb(COL[key]), 255)
    return out


def items():
    """Every icon: {id, rgba, ax, ay} (anchored at its centre)."""
    return [{"id": f"ui.upg.{n}", "rgba": draw(n), "ax": N // 2, "ay": N // 2} for n in ICONS]
