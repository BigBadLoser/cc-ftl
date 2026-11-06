"""Overhead crew icons (family `marks`): crew.mark.<id>, the symbols that float over a crew member's head.

  crew.mark.chat | chatBad | shout          social cues (Interaction.icon, src/sim/crew/interactionTypes.ts)
  crew.mark.break.<kind>.<tier>             a BreakKind symbol (src/sim/crew/breakTypes.ts) in a thought bubble whose outline
                                             echoes it (crew_marks_bubbles.py), rimmed in the tier colour (DESIGN.md UI rule 7)
  crew.mark.downed | surrendered             the fight marks

2D pixel art, not a Blender render: at icon size a flat symbol is a few hundred pixels and every one matters (the dots, the
"!", the bolt). A 3D render quantised down to that smears them and adds nothing (the shapes are flat and need no
lighting). So each icon is rasterised here at 1x from simple shapes (ellipses, polygons, thick segments) in a fixed set of
colours, with the dark 1 px outline every sprite has. No bpy: plain numpy, it renders in well under a second.

Every frame is a W x H canvas anchored at the bottom centre. Animations are 2-4 frames that loop. Symbols sit in the
bubble's inside, about x 7..25, y 5..23."""
import math

import numpy as np

W, H = 32, 32
FPS = 4
# name: hex. Tier and state colours are the UI's colour roles (theme.css: --red, --amber).
COL = {
    "K": "#151c28",                                         # outline
    "W": "#f4f7fb", "S": "#c3cedb", "I": "#2b3a55",          # white, its shade, ink
    "C": "#b4c6dc", "c": "#8aa0bd", "N": "#2c4670",          # the cold bubble of a chat going badly
    "R": "#ff5a5a", "r": "#c8343c", "Q": "#ff9c8c",          # red, its shade, a hot core
    "A": "#f0b13a", "a": "#3a2a0e",                          # amber rim, amber fill
    "M": "#9aa6b4", "m": "#262d38",                          # neutral rim, neutral fill
    "V": "#3e1418",                                          # red fill
    "B": "#6fc8ff", "b": "#3d86c8", "E": "#e6f8ff", "e": "#8cd2f0",   # water and ice
    "Y": "#ffd84a", "y": "#f0a020",                          # lightning
    "D": "#59627a", "d": "#3f465a", "L": "#7d879e",          # storm cloud
    "G": "#aeb9c8", "g": "#8592a6",                          # rain cloud
    "O": "#a08a6a", "o": "#6e5c44", "U": "#c4ad88",          # a crate, its seams, its lit top
    "P": "#dfe6f0",                                          # a flag
}


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def grow(op):
    out = op.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out |= np.roll(op, (dy, dx), (0, 1))
    return out


class Canvas:
    """A w x h grid of colour keys ('' is empty), drawn with pixel centres at (x + 0.5, y + 0.5)."""

    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.k = np.full((h, w), "", object)
        yy, xx = np.mgrid[0:h, 0:w]
        self.cx, self.cy = xx + 0.5, yy + 0.5

    def mask(self, m, col):
        self.k[m] = col

    def ell(self, x, y, rx, col, ry=None):
        return self.mask(((self.cx - x) / rx) ** 2 + ((self.cy - y) / (ry or rx)) ** 2 <= 1.0, col)

    def rect(self, x0, y0, x1, y1, col):
        """Pixels x0..x1, y0..y1 inclusive."""
        self.k[y0:y1 + 1, x0:x1 + 1] = col

    def inside(self, pts):
        x, y, m = self.cx, self.cy, np.zeros((self.h, self.w), bool)
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            m ^= ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / ((y1 - y0) or 1e-9) + x0)
        return m

    def poly(self, pts, col):
        self.mask(self.inside(pts), col)

    def seg(self, p0, p1, r, col):
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((self.cx - x0) * dx + (self.cy - y0) * dy) / max(dx * dx + dy * dy, 1e-9), 0, 1)
        self.mask((self.cx - (x0 + t * dx)) ** 2 + (self.cy - (y0 + t * dy)) ** 2 <= r * r, col)

    def rgba(self):
        """Colours, with the dark 1 px outline round everything drawn."""
        op = self.k != ""
        k = self.k.copy()
        k[grow(op) & ~op] = "K"
        out = np.zeros((self.h, self.w, 4), np.uint8)
        for key in set(k.ravel()) - {""}:
            out[k == key] = (*rgb(COL[key]), 255)
        return out


def rounded(c, x0, y0, x1, y1, col, r=3):
    c.rect(x0, y0, x1, y1, col)
    for i in range(r):
        for j in range(r - i):
            for x, y in ((x0 + i, y0 + j), (x1 - i, y0 + j), (x0 + i, y1 - j), (x1 - i, y1 - j)):
                c.k[y, x] = ""


# ---- social cues -------------------------------------------------------------------------------------------------------

def speech(c, body, shade):
    rounded(c, 3, 5, 28, 22, body, 4)
    c.rect(4, 21, 27, 22, shade)
    c.rect(5, 21, 26, 22, shade)
    c.poly([(9, 22.5), (15, 22.5), (7, 29.5)], body)


def chat(f):
    """A light speech bubble with three dots rising one after another (a typing ripple); the last frame rests."""
    c = Canvas()
    speech(c, "W", "S")
    for i, x in enumerate((8, 14, 20)):
        y = 11 if i == f else 12
        c.rect(x, y, x + 3, y + 3, "I")
    return c


def chat_bad(f):
    """The same bubble, cold, with a scribble that wriggles."""
    c = Canvas()
    speech(c, "C", "c")
    for x in range(7, 25):
        h = (0, 1, 2, 3, 2, 1)[(x + 2 * f) % 6]
        c.rect(x, 10 + h, x, 12 + h, "N")
    return c


def shout(f):
    """A red burst with an exclamation, symmetric (two crew show it facing each other), its spikes jumping each frame."""
    c = Canvas()
    cx, cy, n = 16, 15.5, 12
    pts = [(cx + math.cos(a) * rr, cy - math.sin(a) * rr * 0.92)
           for k in range(n * 2)
           for a, rr in [(math.pi / 2 + k * math.pi / n + (math.pi / n if f % 2 else 0), 15.2 if k % 2 == 0 else 9.4)]]
    c.poly(pts, "R")
    c.ell(cx, cy + 2.6, 8.6, "r", 5.6)
    c.ell(cx, cy - 0.6, 8.8, "R", 7.6)
    c.rect(14, 6, 17, 17, "W")
    c.rect(14, 20, 17, 23, "W")
    return c


# ---- break symbols (bare: crew_marks_bubbles puts each in its bubble) --------------------------------------------------

def drop(c, x, y, r, tip, body="B", shade="b", hi="E"):
    """A water drop: round bottom at (x, y), pointed top `tip` px above."""
    c.ell(x, y, r, body)
    c.poly([(x - r * 0.82, y - r * 0.5), (x, y - tip), (x + r * 0.82, y - r * 0.5)], body)
    c.mask((((c.cx - x) / r) ** 2 + ((c.cy - y) / r) ** 2 <= 1.0) & ((c.cx - x) + (c.cy - y) > r * 0.7), shade)
    if hi:
        c.ell(x - r * 0.45, y - r * 0.35, max(1.1, r * 0.25), hi, max(1.4, r * 0.38))


def panic(f):
    """Sweat drops: a big one, and two small ones flicking off it."""
    c = Canvas()
    drop(c, 19, 17, 5.2, 12)
    for (x, y) in (((12, 9), (10.5, 17)), ((10.5, 7.5), (8.5, 18.5)), ((9, 6), (6.8, 20)))[f % 3]:
        drop(c, x, y, 1.9, 4, hi=None)
    return c


def freeze(f):
    """A snowflake, a glint running round its arms."""
    c = Canvas()
    x0, y0, L = 16, 14, 8.6
    for k in range(3):
        a = math.pi / 2 + k * math.pi / 3
        dx, dy = math.cos(a) * L, -math.sin(a) * L
        c.seg((x0 - dx, y0 - dy), (x0 + dx, y0 + dy), 1.05, "e")
        for s in (1, -1):
            bx, by = x0 + s * dx * 0.6, y0 + s * dy * 0.6
            for t in (0.75, -0.75):
                b = a + (0 if s > 0 else math.pi) + t
                c.seg((bx, by), (bx + math.cos(b) * 3.4, by - math.sin(b) * 3.4), 0.85, "e")
    c.ell(x0, y0, 2.6, "E")
    tx, ty = ((16, 5.6), (23.4, 9.8), (23.4, 18.2))[f % 3]
    c.ell(tx, ty, 1.5, "W")
    return c


def hide(f):
    """A crate with its lid lifted a crack, two eyes in the dark gap glancing left, right, then a blink."""
    c = Canvas()
    c.rect(7, 15, 24, 23, "O")
    c.rect(7, 15, 24, 15, "U")
    for x in (12, 19):
        c.rect(x, 16, x, 23, "o")
    c.rect(7, 10, 24, 14, "I")                                           # the dark gap
    c.poly([(6, 7.5), (25.6, 4.6), (25.6, 7.6), (6, 10.5)], "O")         # the lid, tilted up
    c.poly([(6, 9.4), (25.6, 6.5), (25.6, 7.6), (6, 10.5)], "o")
    look = (-1, -1, 1, None)[f % 4]
    for ex in (10, 18):
        if look is None:
            c.rect(ex, 13, ex + 3, 13, "S")
        else:
            c.rect(ex, 11, ex + 3, 13, "W")
            c.rect(ex + 1 + look, 12, ex + 2 + look, 13, "I")
    return c


def cloud(c, top, mid, low):
    c.ell(11.5, 12.5, 5.6, mid, 4.6)
    c.ell(19.5, 11.0, 6.4, mid, 5.4)
    c.rect(7, 13, 25, 16, mid)
    c.ell(7.6, 14.2, 2.6, mid, 2.6)
    c.ell(24.4, 14.2, 2.6, mid, 2.6)
    c.ell(18.2, 8.6, 3.8, top, 2.4)
    c.ell(11.0, 10.2, 2.4, top, 1.6)
    c.rect(7, 16, 25, 17, low)


def tantrum(f):
    """A storm cloud with a lightning bolt that flickers."""
    c = Canvas()
    cloud(c, "L", "D", "d")
    bolt = [(16.5, 15), (21, 15), (18.4, 18.6), (21.4, 18.6), (13.4, 26), (16, 20.6), (13.2, 20.6)]
    c.poly(bolt, "Y" if f % 2 == 0 else "y")
    if f % 2:
        c.poly([(17.2, 16), (19.4, 16), (16.6, 19.6), (18.6, 19.6), (15, 23.4), (16.4, 19.6), (15.4, 19.6)], "E")
    return c


def despair(f):
    """A grey rain cloud, the rain falling from it."""
    c = Canvas()
    cloud(c, "S", "G", "g")
    for i, x in enumerate((9, 13, 17, 21)):
        y = 19 + (f + i * 2) % 4 * 1.5
        c.seg((x + 0.5, y), (x - 0.3, y + 2.4), 0.6, "B")
    return c


def refusal(f):
    """A raised palm, a small stop-shake."""
    c = Canvas()
    dx = (0, 1, 0, -1)[f % 4]
    for x, top in ((11, 8.5), (15, 6.5), (19, 7), (23, 9.5)):                  # four fingers, a dark gap between them
        c.seg((x + dx - 0.5, top), (x + dx - 0.5, 16), 1.3, "W")
    c.seg((9.4 + dx, 19.5), (7.0 + dx, 14.2), 1.4, "W")                         # the thumb
    rounded(c, 9 + dx, 14, 23 + dx, 23, "W", 3)
    c.rect(10 + dx, 22, 22 + dx, 23, "S")
    c.rect(22 + dx, 15, 23 + dx, 21, "S")
    return c


def isolation(f):
    """A lone figure, small, standing apart (its bubble is a plain circle)."""
    c = Canvas()
    c.ell(16, 9.5, 2.8, "W")
    c.mask((((c.cx - 16) / 5.6) ** 2 + ((c.cy - 20) / 6.2) ** 2 <= 1) & (c.cy < 22), "W")
    c.rect(11, 21, 20, 21, "S")
    return c


# ---- fight marks -------------------------------------------------------------------------------------------------------

def downed(f):
    """A red cross that pulses."""
    c = Canvas()
    col, sh = ("R", "r") if f % 2 == 0 else ("Q", "R")
    c.rect(13, 7, 19, 27, col)
    c.rect(6, 14, 26, 20, col)
    c.rect(13, 26, 19, 27, sh)
    c.rect(20, 19, 26, 20, sh)
    return c


def surrendered(f):
    """A white flag on a pole, waving."""
    c = Canvas()
    c.rect(8, 4, 9, 29, "M")
    c.rect(8, 4, 8, 29, "P")
    wave = (0, 1, 1, 2, 1, 1, 0, -1, -1, -1, 0, 0, 1, 1)
    for i in range(14):
        x = 10 + i
        y0 = 5 + wave[(i + 4 * f) % 14]
        c.rect(x, y0, x, y0 + 9, "S" if (i + 4 * f) % 7 < 2 else "W")
    return c


SOCIAL = {"chat": (chat, 4), "chatBad": (chat_bad, 2), "shout": (shout, 2)}
BREAKS = {"panic": (panic, 3), "freeze": (freeze, 3), "hide": (hide, 4), "tantrum": (tantrum, 2), "despair": (despair, 4),
          "refusal": (refusal, 4), "isolation": (isolation, 2)}
FIGHT = {"downed": (downed, 2), "surrendered": (surrendered, 2)}


def items():
    """Every sprite: {id, rgba, ax, ay}. An animation's frames are <id>.0 .. <id>.n-1."""
    from .crew_marks_bubbles import TIERS, in_bubble
    out = []

    def add(sid, fn, n):
        for f in range(n):
            c = fn(f)
            out.append({"id": f"{sid}.{f}", "rgba": c.rgba(), "ax": c.w // 2, "ay": c.h})
    for k, (fn, n) in SOCIAL.items():
        add(f"crew.mark.{k}", fn, n)
    for k, (fn, n) in BREAKS.items():
        for t in TIERS:
            add(f"crew.mark.break.{k}.{t}", lambda f, k=k, t=t, fn=fn: in_bubble(k, fn(f), t, f), n)
    for k, (fn, n) in FIGHT.items():
        add(f"crew.mark.{k}", fn, n)
    return out
