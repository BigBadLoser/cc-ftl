"""Weapon upgrade icons for the combat rows (family `upicons`): ui.upg.<id>, 14 x 14 px at 1x, one frame each.

2D pixel art like the overhead crew icons (crew_marks.py: see its docstring for why there is no Blender render): drawn by
hand for 14 px, each a 12 x 12 grid of colour keys inside the canvas with the dark 1 px outline added round it (so the
grids leave their outer ring empty where they want the outline). Each is the silhouette of its item sprite
(items_upgrades.py) reduced to its few big shapes, with the weapon-type band where it fits (laser red, mass driver blue,
missile green, ion violet, incendiary orange). No bpy: plain numpy.

Ids: ui.upg.capacitor .. ui.upg.thermite (the item id without `item.upg_`)."""
import numpy as np

from .crew_marks import Canvas, grow, rgb

N = 14
COL = {
    "K": "#151c28",                                            # outline
    "S": "#c4ccd4", "H": "#8e99a6", "D": "#5b6673", "k": "#1b2028", "W": "#f4fbff",      # steel light / mid / dark, groove, white
    "Y": "#f2c230", "C": "#9be8f5", "c": "#3a9fbf",            # capacitor yellow, coolant frost and deep cyan
    "R": "#e04058", "G": "#4fd47a", "B": "#4a8dff", "V": "#7a5cff", "O": "#ff5a1f", "o": "#a8401a",   # weapon bands
    "U": "#d7834a", "u": "#8c4a24", "L": "#7b8764", "h": "#ffb04a",                    # copper, olive, heat
}

ICONS = {
    "capacitor": ["            ",
                  " Y   Y   Y  ",
                  "UUUUUUUUUUU ",
                  "SDD SDD SDD ",
                  "SDD SDD SDD ",
                  "YYY YYY YYY ",
                  "YYY YYY YYY ",
                  "SDD SDD SDD ",
                  "SDD SDD SDD ",
                  "SDD SDD SDD ",
                  "DDDDDDDDDDD ",
                  "            "],
    "coolant":   ["   cc       ",
                  "  CCCCCCCC  ",
                  "  SDDDDDD   ",
                  "  DCCCCCD   ",
                  "  DCCCCCD   ",
                  "  CCCCCCCC  ",
                  "  SDDDDDD   ",
                  "  DCCCCCD   ",
                  "  DCCCCCD   ",
                  "  SDDDDDD   ",
                  "  CCCCCCCC  ",
                  "            "],
    "housing":   ["            ",
                  "            ",
                  "   SSSSSS   ",
                  "  SHHHHHHD  ",
                  "  SHDDDDHD  ",
                  "  SHHHHHHD  ",
                  "SSSSSSSSSSSD",
                  "SWHHHHHHHHWD",
                  "SHHHHHHHHHHD",
                  "SWHHHHHHHHWD",
                  "DDDDDDDDDDDD",
                  "            "],
    "prism":     ["     WW     ",
                  "    WWWW    ",
                  "    RGGB    ",
                  "    RGGB    ",
                  "    RGGB    ",
                  "    RGGB    ",
                  "  DDRGGBDD  ",
                  "  DDRGGBDD  ",
                  "  DDRGGBDD  ",
                  " DDDDDDDDDD ",
                  " RRRRRRRRRR ",
                  "            "],
    "focus":     ["            ",
                  "       DD   ",
                  " RRSSSDDW   ",
                  " RRSSSDDWW  ",
                  " RRHHHDDWW  ",
                  " RRHHHDDWW  ",
                  " RRDDDDDDW  ",
                  "  DD   DD   ",
                  "  DD   DD   ",
                  "            ",
                  "            ",
                  "            "],
    "frag":      ["     WW     ",
                  "    SSSD    ",
                  "   SSSSDD   ",
                  "   SSSSDD   ",
                  "   kkkkkk   ",
                  "   SSSSDD   ",
                  "   SSSSDD   ",
                  "   BBBBBB   ",
                  "  UUUUUUUU  ",
                  "  uuuuuuuu  ",
                  "            ",
                  "            "],
    "rail":      ["            ",
                  "            ",
                  "BSUSSUSSUhhh",
                  "BSUSSUSSUhhh",
                  " DDDDDDDDD  ",
                  " DDDDDDDDD  ",
                  "BSUSSUSSUhhh",
                  "BSUSSUSSUhhh",
                  "            ",
                  "            ",
                  "            ",
                  "            "],
    "nuke":      ["            ",
                  "DD          ",
                  "GLLYYkkLLS  ",
                  "GLLYYkkLLSS ",
                  "GLLYYkkLLSSS",
                  "GLLYYkkLLSSS",
                  "GLLYYkkLLSS ",
                  "GLLYYkkLLS  ",
                  "DD          ",
                  "            ",
                  "            ",
                  "            "],
    "chain":     [" VV  VV  VV ",
                  "  D  DD  D  ",
                  "   D DD D   ",
                  "    DDDD    ",
                  "     DD     ",
                  "    UUUU    ",
                  "     DD     ",
                  "    UUUU    ",
                  "     DD     ",
                  "  DDDDDDDD  ",
                  "  VVVVVVVV  ",
                  "            "],
    "thermite":  ["            ",
                  "    hh      ",
                  "  DDDDDD    ",
                  " SLLLLLLD   ",
                  " OOOOOOOO   ",
                  " OOOOOOOO   ",
                  " SLLLLLLDoOO",
                  " SLLLLLLDOOO",
                  " DDDDDDDDOOO",
                  "            ",
                  "            ",
                  "            "],
}


def draw(name):
    """One icon as an N x N RGBA array: the grid centred, a dark 1 px outline round whatever it draws."""
    g = ICONS[name]
    assert len(g) == 12 and all(len(r) == 12 for r in g), name
    c = Canvas(N, N)
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != " ":
                c.k[y + 1, x + 1] = ch
    op = c.k != ""
    k = c.k.copy()
    k[grow(op) & ~op] = "K"
    out = np.zeros((N, N, 4), np.uint8)
    for key in set(k.ravel()) - {""}:
        out[k == key] = (*rgb(COL[key]), 255)
    return out


def items():
    """Every icon: {id, rgba, ax, ay} (anchored at its centre)."""
    return [{"id": f"ui.upg.{n}", "rgba": draw(n), "ax": N // 2, "ay": N // 2} for n in ICONS]
