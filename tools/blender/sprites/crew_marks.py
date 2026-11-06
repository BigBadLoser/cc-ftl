"""Overhead crew icons (family `marks`): crew.mark.<id>, the symbols that float over a crew member's head.

  crew.mark.chat | chatBad | shout          social cues (Interaction.icon, src/sim/crew/interactionTypes.ts)
  crew.mark.break.<kind>                     one symbol per BreakKind (src/sim/crew/breakTypes.ts), drawn on a tier plate
  crew.mark.tier.<mild|moderate|severe>      the plate behind a break symbol: neutral, amber, red (DESIGN.md UI rule 7)
  crew.mark.downed | surrendered             the fight marks

2D pixel art, not a Blender render: at 12-18 px a flat symbol is a few dozen pixels, and every one of them matters (the
three dots, the "!", a 2 px lightning bolt). A 3D render quantised down to that size smears them into uneven blobs and adds
nothing (the shapes are flat and need no lighting). So each icon is rasterised here at 1x from simple shapes (discs,
polygons, thick segments, small ASCII stamps) in a fixed set of colours, and gets the dark 1 px outline every sprite has.
No bpy: plain numpy, so it renders in milliseconds.

Every frame is a W x H canvas with the anchor at the bottom centre, so a break symbol and its tier plate stack exactly.
Animations are 2-4 frames that loop."""
import math

import numpy as np

W, H = 20, 20
FPS = 4
# name: hex. The tier and state colours are the UI's colour roles (theme.css: --red, --amber, --green).
COL = {
    "K": "#151c28",                                         # outline
    "W": "#f4f7fb", "S": "#c3cedb", "I": "#2b3a55",          # chat bubble, its shade, its ink
    "C": "#b4c6dc", "c": "#8aa0bd", "N": "#2c4670",          # the cold bubble of a chat going badly
    "R": "#ff5a5a", "r": "#c8343c", "Q": "#ff9c8c",          # red, its shade, a hot core
    "A": "#f0b13a", "a": "#3a2a0e",                          # amber rim, amber plate
    "M": "#9aa6b4", "m": "#262d38",                          # neutral rim, neutral plate
    "V": "#3e1418",                                          # red plate
    "B": "#6fc8ff", "b": "#3d86c8", "E": "#e6f8ff", "e": "#8cd2f0",   # water and ice
    "Y": "#ffd84a", "y": "#f0a020",                          # lightning
    "D": "#59627a", "d": "#3f465a", "L": "#7d879e",          # storm cloud
    "G": "#aeb9c8", "g": "#8592a6",                          # rain cloud
    "O": "#a08a6a", "o": "#6e5c44",                          # a crate
    "P": "#dfe6f0",                                          # a flag, a pole
}


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Canvas:
    """A W x H grid of colour keys ('' is empty), drawn with pixel centres at (x + 0.5, y + 0.5)."""

    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.k = np.full((h, w), "", object)
        yy, xx = np.mgrid[0:h, 0:w]
        self.cx, self.cy = xx + 0.5, yy + 0.5

    def mask(self, m, col):
        self.k[m] = col

    def disc(self, x, y, r, col, ry=None):
        self.mask(((self.cx - x) / r) ** 2 + ((self.cy - y) / (ry or r)) ** 2 <= 1.0, col)

    def rect(self, x0, y0, x1, y1, col):
        """Pixels x0..x1, y0..y1 inclusive."""
        self.k[y0:y1 + 1, x0:x1 + 1] = col

    def poly(self, pts, col):
        x, y, inside = self.cx, self.cy, np.zeros((self.h, self.w), bool)
        n = len(pts)
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            cross = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / ((y1 - y0) or 1e-9) + x0)
            inside ^= cross
        self.mask(inside, col)

    def seg(self, p0, p1, r, col):
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((self.cx - x0) * dx + (self.cy - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        self.mask((self.cx - (x0 + t * dx)) ** 2 + (self.cy - (y0 + t * dy)) ** 2 <= r * r, col)

    def stamp(self, rows, x0, y0, flip=False):
        """ASCII rows of colour keys ('.' empty) with the top-left at (x0, y0)."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row[::-1] if flip else row):
                if ch != "." and 0 <= x0 + i < self.w and 0 <= y0 + j < self.h:
                    self.k[y0 + j, x0 + i] = ch

    def rgba(self, outline=True):
        op = self.k != ""
        k = self.k.copy()
        if outline:
            near = np.zeros_like(op)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                near |= np.roll(op, (dy, dx), (0, 1))
            k[near & ~op] = "K"
        out = np.zeros((self.h, self.w, 4), np.uint8)
        for key in set(k.ravel()) - {""}:
            out[k == key] = (*rgb(COL[key]), 255)
        return out


def rounded(c, x0, y0, x1, y1, col, r=2):
    c.rect(x0, y0, x1, y1, col)
    for i in range(r):
        for j in range(r - i):
            for x, y in ((x0 + i, y0 + j), (x1 - i, y0 + j), (x0 + i, y1 - j), (x1 - i, y1 - j)):
                c.k[y, x] = ""


# ---- social cues (free-floating, bottom at the anchor) -----------------------------------------------------------------

def bubble(c, body, shade, dy=0):
    rounded(c, 2, 3 + dy, 17, 12 + dy, body)
    c.rect(3, 12 + dy, 16, 12 + dy, shade)
    c.stamp([f"{body * 3}", f"{body * 2}", body], 6, 13 + dy)


def chat(f):
    """A light bubble with three dots that rise one after another (a typing ripple); the last frame rests."""
    c = Canvas()
    bubble(c, "W", "S")
    for i, x in enumerate((5, 9, 13)):
        y = 6 if i == f else 7
        c.rect(x, y, x + 1, y + 1, "I")
    return c


def chat_bad(f):
    """The same bubble, cold, with a scribble that wriggles."""
    c = Canvas()
    bubble(c, "C", "c")
    for x in range(4, 16):
        h = (0, 1, 2, 1)[(x + 2 * f) % 4]
        c.rect(x, 6 + h, x, 7 + h, "N")
    return c


def shout(f):
    """A red burst with an exclamation, symmetric (two crew show it facing each other), its spikes jumping each frame."""
    c = Canvas()
    cx, cy, n = 10, 9.5, 12
    pts = []
    for k in range(n * 2):
        a = math.pi / 2 + k * math.pi / n + (math.pi / n if f % 2 else 0)
        rr = 9.4 if k % 2 == 0 else 5.6
        pts.append((cx + math.cos(a) * rr, cy - math.sin(a) * rr * 0.92))
    c.poly(pts, "R")
    c.disc(cx, cy + 1.6, 5.2, "r", 3.4)
    c.disc(cx, cy - 0.4, 5.4, "R", 4.6)
    c.rect(9, 4, 10, 10, "W")
    c.rect(9, 12, 10, 13, "W")
    return c


# ---- tier plates and break symbols (the symbol fits the plate's 12 x 12 inside, x 4..15, y 4..15) ------------------

TIERS = {"mild": ("M", "m"), "moderate": ("A", "a"), "severe": ("R", "V")}


def plate(tier):
    rim, fill = TIERS[tier]
    c = Canvas()
    rounded(c, 1, 1, 18, 18, rim, 3)
    rounded(c, 2, 2, 17, 17, fill, 2)
    return c


def panic(f):
    """Sweat drops: a big one, and two small ones flicking off it."""
    c = Canvas()
    c.stamp(["..bb..", "..BB..", ".BBBB.", ".EBBB.", "BEBBBB", "BBBBBB", "BBBBBb", ".bbbb."], 9, 6)
    for (x, y) in (((6, 6), (5, 11)), ((5, 5), (4, 12)), ((4, 4), (3, 13)))[f % 3]:
        c.rect(x, y, x + 1, y + 1, "B")
    return c


def freeze(f):
    """A snowflake, a glint running round its arms."""
    c = Canvas()
    x0, y0 = 10, 10
    for k in range(3):
        a = math.pi / 2 + k * math.pi / 3
        dx, dy = math.cos(a) * 5.6, -math.sin(a) * 5.6
        c.seg((x0 - dx, y0 - dy), (x0 + dx, y0 + dy), 0.75, "e")
        for s in (1, -1):
            bx, by = x0 + s * dx * 0.62, y0 + s * dy * 0.62
            for t in (0.7, -0.7):
                b = a + (0 if s > 0 else math.pi) + t
                c.seg((bx, by), (bx + math.cos(b) * 2.2, by - math.sin(b) * 2.2), 0.6, "e")
    c.disc(x0, y0, 1.6, "E")
    tips = [(10, 4.6), (14.7, 7.3), (14.7, 12.7)]
    tx, ty = tips[f % 3]
    c.disc(tx, ty, 1.0, "E")
    return c


def hide(f):
    """A crate with its lid lifted a crack, two eyes in the dark gap glancing left, right, then a blink."""
    c = Canvas()
    c.rect(5, 10, 14, 15, "O")
    for x in (8, 11):
        c.rect(x, 11, x, 15, "o")
    c.rect(5, 7, 14, 9, "I")                                 # the dark gap
    c.poly([(4.5, 5.5), (15.5, 4.0), (15.5, 6.0), (4.5, 7.5)], "O")   # the lid, tilted up
    look = (-1, -1, 1, None)[f % 4]
    for ex in (7, 11):
        if look is None:
            c.rect(ex + 0, 8, ex + 1, 8, "S")
        else:
            c.rect(ex + look, 7, ex + look + 1, 8, "W")
    return c


def cloud(c, top, mid, low, y0=4):
    c.disc(7.5, y0 + 4.2, 3.6, mid, 3.0)
    c.disc(12.0, y0 + 3.6, 4.0, mid, 3.4)
    c.rect(4, y0 + 5, 15, y0 + 6, mid)
    c.disc(11.2, y0 + 2.6, 2.6, top, 1.8)
    c.rect(5, y0 + 6, 15, y0 + 6, low)


def tantrum(f):
    """A storm cloud with a lightning bolt that flickers."""
    c = Canvas()
    cloud(c, "L", "D", "d")
    if f % 2 == 0:
        c.stamp(["...YY", "..YY.", ".YYYY", "YYYYY", "..YY.", ".YY..", ".Y..."], 8, 9)
    else:
        c.stamp(["...yy", "..yE.", ".yEEy", "yEEEy", "..Ey.", ".yy..", ".y..."], 8, 9)
    return c


def despair(f):
    """A grey rain cloud, the rain falling from it."""
    c = Canvas()
    cloud(c, "S", "G", "g")
    for i, x in enumerate((6, 9, 12, 14)):
        y = 12 + (f + i * 2) % 4
        if y <= 14:
            c.rect(x, y, x, y + 1, "B")
    return c


def refusal(f):
    """A raised palm, a small stop-shake."""
    c = Canvas()
    dx = (0, 1, 0, -1)[f % 4]
    c.stamp(["......SS....", "...SS.WW....", "...WW.WW.SS.", "...WW.WW.WW.", "SS.WW.WW.WW.", "SWWWWWWWWWW.",
             ".WWWWWWWWWW.", "..WWWWWWWWS.", "..SWWWWWWSS.", "...SSSSSSS.."], 4 + dx, 4)
    return c


def isolation(f, ring=True):
    """A lone figure inside a dashed ring that turns (in a thought bubble the bubble is the ring)."""
    c = Canvas()
    for k in range(8 if ring else 0):
        a0 = k * math.pi / 4 + f * math.pi / 16
        p0 = (10 + math.cos(a0) * 6.3, 10 - math.sin(a0) * 6.3)
        p1 = (10 + math.cos(a0 + 0.5) * 6.3, 10 - math.sin(a0 + 0.5) * 6.3)
        c.seg(p0, p1, 0.6, "e")
    c.stamp(["..WW..", ".WWWW.", ".WWWW.", "..WW..", "......", ".WWWW.", "WWWWWW", "WWWWWW", "SSSSSS"], 7, 5)
    return c


def downed(f):
    """A red cross that pulses."""
    c = Canvas()
    col = "R" if f % 2 == 0 else "Q"
    c.rect(8, 4, 11, 15, col)
    c.rect(4, 8, 15, 11, col)
    return c


def surrendered(f):
    """A white flag on a pole, waving."""
    c = Canvas()
    c.rect(5, 2, 6, 17, "M")
    wave = [(0, 1, 1, 0, 0, -1, -1, 0), (1, 1, 0, 0, -1, -1, 0, 0)][f % 2]
    for i in range(8):
        x = 7 + i
        y0 = 3 + wave[i]
        c.rect(x, y0, x, y0 + 5, "P" if i % 4 < 2 else "W")
    return c


SOCIAL = {"chat": (chat, 4), "chatBad": (chat_bad, 2), "shout": (shout, 2)}
BREAKS = {"panic": (panic, 3), "freeze": (freeze, 3), "hide": (hide, 4), "tantrum": (tantrum, 2), "despair": (despair, 4),
          "refusal": (refusal, 4), "isolation": (isolation, 4)}
FIGHT = {"downed": (downed, 2), "surrendered": (surrendered, 2)}


def items():
    """Every sprite: {id, rgba, ax, ay}. An animation's frames are <id>.0 .. <id>.n-1."""
    out = []

    def add(sid, fn, n):
        for f in range(n):
            out.append({"id": f"{sid}.{f}", "rgba": fn(f).rgba(), "ax": W // 2, "ay": H})
    for k, (fn, n) in SOCIAL.items():
        add(f"crew.mark.{k}", fn, n)
    for k, (fn, n) in BREAKS.items():
        add(f"crew.mark.break.{k}", fn, n)
    for k, (fn, n) in FIGHT.items():
        add(f"crew.mark.{k}", fn, n)
    for t in TIERS:
        out.append({"id": f"crew.mark.tier.{t}", "rgba": plate(t).rgba(), "ax": W // 2, "ay": H})
    return out
