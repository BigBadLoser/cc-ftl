"""Overhead crew icons (family `marks`): crew.mark.<id>, the symbols that float over a crew member's head.

  crew.mark.chat | chatBad | shout          social cues (Interaction.icon, src/sim/crew/interactionTypes.ts)
  crew.mark.break.<kind>.<tier>             a BreakKind symbol (src/sim/crew/breakTypes.ts) in a thought bubble whose outline
                                             echoes it (crew_marks_bubbles.py), rimmed in the tier colour (DESIGN.md UI rule 7)
  crew.mark.downed | surrendered             the fight marks

2D pixel art, not a Blender render: at icon size a flat symbol is a few hundred pixels and every one matters (the dots, the
"!", the bolt). A 3D render quantised down to that smears them and adds nothing (the shapes are flat and need no
lighting). So each icon is rasterised here at 1x from simple shapes (ellipses, polygons, thick segments) in a fixed set of
colours, with the dark 1 px outline every sprite has. No bpy: plain numpy, it renders in well under a second.

Every frame is a W x H canvas anchored at the bottom centre, except the bubbles: a thought bubble's anchor is THOUGHT_DX
px left of centre and a speech bubble's SPEECH_DX, so the bubble floats up and to the right with its puffs or its tail
over the head. Animations are 2-4 frames that loop. Symbols sit in the
bubble's inside, about x 7..25, y 5..23."""
import math

import numpy as np

W, H = 32, 32
FPS = 4
THOUGHT_DX = 15                 # a thought bubble sits this many px right of the head: its puffs rise from it (user pick)
SPEECH_DX = 11                  # a speech bubble likewise, its tail rising from the head (user pick)
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
    c.k[22, 5:27] = shade                                   # a shaded bottom edge, open where the tail leaves the bubble
    c.k[22, 9:15] = body
    c.poly([(9, 22.5), (15, 22.5), (7, 29.5)], body)
    c.k[(c.k == body) & (c.cy > 22.5) & (c.cx - 7 > (29.5 - c.cy) * 6 / 7 - 1.0)] = shade   # the tail's lower edge


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
        hx, hy = round(x - r * 0.55), round(y - r * 0.5)
        c.rect(hx, hy, hx, hy + 2, hi)


def panic(f):
    """Sweat drops: a big one, and two small ones flicking off it."""
    c = Canvas()
    drop(c, 18.5, 15.8, 4.4, 10)
    for (x, y) in (((12.6, 10.0), (11.6, 16)), ((11.6, 9.2), (10.6, 17)), ((10.8, 9.0), (10.2, 17.6)))[f % 3]:
        drop(c, x, y, 1.7, 3.6, hi=None)
    return c


def freeze(f):
    """A snowflake, a glint running round its arms."""
    c = Canvas()
    x0, y0, L = 16, 13, 7.2
    for k in range(3):
        a = math.pi / 2 + k * math.pi / 3
        dx, dy = math.cos(a) * L, -math.sin(a) * L
        c.seg((x0 - dx, y0 - dy), (x0 + dx, y0 + dy), 1.05, "e")
        for s in (1, -1):
            bx, by = x0 + s * dx * 0.6, y0 + s * dy * 0.6
            for t in (0.75, -0.75):
                b = a + (0 if s > 0 else math.pi) + t
                c.seg((bx, by), (bx + math.cos(b) * 2.8, by - math.sin(b) * 2.8), 0.85, "e")
    c.ell(x0, y0, 2.3, "E")
    tx, ty = ((16, 6.2), (22.2, 9.4), (22.2, 16.6))[f % 3]
    c.ell(tx, ty, 1.5, "W")
    return c


def hide(f):
    """A crate with its lid lifted a crack, two eyes in the dark gap glancing left, right, then a blink."""
    c = Canvas()
    c.rect(9, 14, 22, 20, "O")
    c.rect(9, 14, 22, 14, "U")
    for x in (13, 18):
        c.rect(x, 15, x, 20, "o")
    c.rect(9, 10, 22, 13, "I")                                           # the dark gap
    c.poly([(8.2, 7.6), (23.6, 5.4), (23.6, 7.8), (8.2, 10.0)], "O")     # the lid, tilted up
    c.poly([(8.2, 9.2), (23.6, 7.0), (23.6, 7.8), (8.2, 10.0)], "o")
    look = (-1, -1, 1, None)[f % 4]
    for ex in (11, 17):
        if look is None:
            c.rect(ex, 12, ex + 3, 12, "S")
        else:
            c.rect(ex, 10, ex + 3, 12, "W")
            c.rect(ex + 1 + look, 11, ex + 2 + look, 12, "I")
    return c


def cloud(c, top, mid, low):
    """A cloud in the bubble's top half, about x 7..24, y 5..15."""
    c.ell(12.4, 10.8, 4.6, mid, 3.8)
    c.ell(18.4, 10.0, 5.2, mid, 4.2)
    c.ell(16, 12.6, 7.4, mid, 2.6)
    c.ell(10.2, 12.6, 2.8, mid, 2.4)
    c.ell(21.8, 12.6, 2.8, mid, 2.4)
    c.ell(17.6, 7.4, 3.2, top, 2.0)
    c.ell(11.6, 9.0, 2.0, top, 1.4)
    c.mask((c.cy > 13.6) & (c.k == mid), low)


def tantrum(f):
    """A storm cloud with a lightning bolt that flickers."""
    c = Canvas()
    cloud(c, "L", "D", "d")
    c.poly([(16.4, 14), (19.8, 14), (17.9, 16.8), (20.4, 16.8), (14.2, 21.6), (15.8, 18.2), (13.6, 18.2)], "Y" if f % 2 == 0 else "y")
    if f % 2:
        c.poly([(17.0, 15), (18.6, 15), (16.8, 17.6), (18.2, 17.6), (15.4, 20.0), (16.4, 17.6), (15.4, 17.6)], "E")
    return c


def despair(f):
    """A grey rain cloud, the rain falling from it."""
    c = Canvas()
    cloud(c, "S", "G", "g")
    for i, x in enumerate((12, 15, 18, 20)):
        y = 16.0 + (f + i * 2) % 4 * 0.7
        c.seg((x + 0.5, y), (x - 0.3, y + 1.8), 0.6, "B")
    return c


def wrench(c, dx=0):
    """A wrench lying corner to corner: an open jaw at the top right, a round end at the bottom left."""
    c.seg((12.4 + dx, 18.4), (19.0 + dx, 11.8), 1.7, "W")
    c.ell(20.0 + dx, 10.8, 3.7, "W")
    c.ell(12.2 + dx, 18.6, 2.2, "W")
    u = ((c.cx - 20.0 - dx) + (10.8 - c.cy)) / 2 ** 0.5       # along the handle, outward
    v = ((c.cx - 20.0 - dx) - (10.8 - c.cy)) / 2 ** 0.5       # across it
    c.k[(u > -0.4) & (abs(v) < 1.4) & (c.k == "W")] = ""       # the jaw
    c.k[(v > 0.9) & (c.k == "W")] = "S"                        # the shaded lower side


def refusal(f):
    """A wrench with a "no" slash across it (refusing work), nudged side to side. The slash is drawn in the tier colour
    ("T") with the bubble's inside ("t") round it, so it reads as crossing over, and runs rim to rim: in_bubble swaps
    both keys for the tier's colours and keeps them inside the rim."""
    c = Canvas()
    wrench(c, (0, 1)[f % 2])
    c.seg((4, 1), (28, 26.2), 2.4, "t")
    c.seg((4, 1), (28, 26.2), 1.3, "T")
    return c


def isolation(f):
    """A lone figure, small, standing apart (its bubble is a plain circle)."""
    c = Canvas()
    c.rect(15, 6, 16, 10, "W")                                  # a round head, 4 x 5 with the corners off, a neck gap
    c.rect(14, 7, 17, 9, "W")
    c.mask((((c.cx - 16) / 5.2) ** 2 + ((c.cy - 18.6) / 5.6) ** 2 <= 1) & (c.cy < 20), "W")
    c.rect(11, 19, 20, 19, "S")
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
          "refusal": (refusal, 2), "isolation": (isolation, 2)}
FIGHT = {"downed": (downed, 2), "surrendered": (surrendered, 2)}


def items():
    """Every sprite: {id, rgba, ax, ay}. An animation's frames are <id>.0 .. <id>.n-1."""
    from .crew_marks_bubbles import TIERS, in_bubble
    out = []

    def add(sid, fn, n, dx=0):
        for f in range(n):
            c = fn(f)
            out.append({"id": f"{sid}.{f}", "rgba": c.rgba(), "ax": c.w // 2 - dx, "ay": c.h})
    for k, (fn, n) in SOCIAL.items():
        add(f"crew.mark.{k}", fn, n, 0 if k == "shout" else SPEECH_DX)
    for k, (fn, n) in BREAKS.items():
        for t in TIERS:
            add(f"crew.mark.break.{k}.{t}", lambda f, k=k, t=t, fn=fn: in_bubble(k, fn(f), t, f), n, THOUGHT_DX)
    for k, (fn, n) in FIGHT.items():
        add(f"crew.mark.{k}", fn, n)
    return out
