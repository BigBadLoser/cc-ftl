"""Review sheet of the shipped pixel sprites (base + glow composited, labelled) on a deck background, plus a mock ship
section built from the real wall/floor/module/roof tiles (open and roofed).
  python3 tools/blender/review/pixel_sheet.py [assets dir] [out dir]   -> pixel-sheet-1x.png, pixel-sheet-3x.png"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
AS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public/assets"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")
MAN = json.loads((AS / "manifest.json").read_text())["assets"]
ENV = np.array(Image.open(AS / "sprites/env.png").convert("RGBA"))
GLW = np.array(Image.open(AS / "sprites/env.glow.png").convert("RGBA"))
BG = (22, 27, 34)
W = 1180


class Canvas:
    def __init__(self, h):
        self.px = np.zeros((h, W, 3), np.float32)
        self.px[:] = BG
        self.labels = []
        self.h = h

    def deck(self, y0, y1):
        """Tile the plated floor diamonds over a band."""
        a = MAN["tile.floor.a"]
        for row in range(int(y0 // 16) - 1, int(y1 // 16) + 2):
            for col in range(-1, W // 64 + 2):
                cx = col * 64 + (32 if row % 2 else 0)
                self.put("tile.floor.a", cx, row * 16, clip=(y0, y1), dim=0.55)

    def put(self, aid, cx, cy, clip=None, dim=1.0, glow=True):
        a = MAN[aid]
        f, an = a["frame"], a["anchor"]
        x0, y0 = int(cx - an["x"]), int(cy - an["y"])
        b = ENV[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]].astype(np.float32)
        g = GLW[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]].astype(np.float32)
        for dy in range(f["h"]):
            y = y0 + dy
            if y < 0 or y >= self.h or (clip and not clip[0] <= y < clip[1]):
                continue
            xs = np.arange(f["w"]) + x0
            ok = (xs >= 0) & (xs < W)
            xs2 = xs[ok]
            al = b[dy, ok, 3:4] / 255
            self.px[y, xs2] = self.px[y, xs2] * (1 - al) + b[dy, ok, :3] * dim * al
            if glow and a.get("glow"):
                self.px[y, xs2] = np.minimum(255, self.px[y, xs2] + g[dy, ok, :3] * (g[dy, ok, 3:4] / 255))

    def label(self, x, y, text, big=False):
        self.labels.append((x, y, text, big))

    def save(self, path, scale):
        im = Image.fromarray(self.px.astype(np.uint8)).resize((W * scale, self.h * scale), Image.NEAREST)
        d = ImageDraw.Draw(im)
        for x, y, t, big in self.labels:
            fs = (14 if big else 8) * (1 if scale == 1 and not big else scale)
            fs = max(fs, 9 if scale == 1 else 0)
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if big else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", fs if scale > 1 else (13 if big else 9))
            d.text((x * scale, y * scale), t, fill=(255, 255, 255) if big else (190, 205, 220), font=font)
        im.save(path)


def grid(c, y, title, rows, cols_labels=None, cw=124, ch=84, x0=90):
    """rows: [(row label, [asset ids or None])]; returns the next y."""
    c.label(8, y, title, True)
    y += 20
    if cols_labels:
        for i, t in enumerate(cols_labels):
            c.label(x0 + i * cw + 8, y, t)
        y += 12
    for name, ids in rows:
        c.label(6, y + ch // 2, name)
        for i, aid in enumerate(ids):
            if aid and aid in MAN:
                c.put(aid, x0 + i * cw + cw // 2, y + ch - 24)
        y += ch
    return y


def rotated(name, states=("", ".charged")):
    out = []
    for r in range(4):
        for s in states:
            out.append(f"module.{name}{'' if r == 0 else f'.r{r}'}{s}")
    return out


def scene(c, y0, roofed):
    """Mock ship section: 11x8 tiles, hull ring, weapons N, incendiary E, engines W, shield/consoles/AI inside."""
    ox, oy = 640, y0 + 60
    TX = lambda x, y: (ox + (x - y) * 32, oy + (x + y) * 16)  # noqa: E731
    GW, GD = 11, 8
    hull = {(x, y) for x in range(GW) for y in range(GD) if x in (0, GW - 1) or y in (0, GD - 1)}
    mods = [("burst_laser", 0, 2, 1), ("mass_driver", 0, 4, 1), ("missile_launcher", 0, 6, 1), ("ion_cannon", 0, 8, 1),
            ("incendiary_launcher", 1, 8, 4), ("engine", 3, 1, 3), ("engine", 3, 1, 5),
            ("shield_gen", 0, 7, 4), ("shield_gen_small", 0, 4, 5), ("shield_console", 0, 4, 3), ("weapons_console", 0, 5, 3),
            ("helm", 0, 6, 3), ("ai_core", 0, 9, 6), ("console", 0, 2, 6)]
    tiles = {}
    for name, rot, x, y in mods:
        fp = (1, 2) if name not in ("shield_gen_small", "shield_console", "weapons_console", "helm", "ai_core", "console") else (1, 1)
        if fp == (1, 2) and rot % 2:
            fp = (2, 1)
        ts = [(x + i, y + j) for i in range(fp[0]) for j in range(fp[1])]
        front = max(ts, key=lambda t: t[0] + t[1])
        tiles[name, x, y] = (ts, front, rot)
    q = []
    for x in range(GW):
        for y in range(GD):
            if (x, y) not in hull:
                c.put("tile.floor.a", *TX(x, y), glow=False)
            else:
                m = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if (x + dx, y + dy) in hull)
                q.append((x + y, 0, f"tile.hull.m{m}", x, y))
    for (name, x, y), (ts, front, rot) in tiles.items():
        if roofed and not name.endswith(("laser", "driver", "launcher", "cannon", "engine")):
            continue                     # a roofed enemy hides its interior; only hull-mounted systems show
        aid = f"module.{name}" + (f".r{rot}" if rot and name not in ("shield_gen_small",) else "")
        if name in ("burst_laser", "mass_driver", "missile_launcher", "ion_cannon", "incendiary_launcher", "engine"):
            aid += ".active" if (name == "engine" and not roofed) else (".charged" if name != "engine" and not roofed and x % 4 == 2 else "")
        q.append((front[0] + front[1], 1, aid, front[0], front[1]))
    if roofed:
        roof = {(x, y) for x in range(1, GW - 1) for y in range(1, GD - 1)}
        special = {}
        for (name, x, y), (ts, front, rot) in tiles.items():
            kind = {"engine": "engine", "shield_gen": "shield", "shield_gen_small": "shield"}.get(name, "weapon" if name.endswith(("laser", "driver", "launcher", "cannon")) else None)
            for t in ts:
                if kind:
                    special[t] = kind
        for (x, y) in roof:
            m = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if (x + dx, y + dy) in roof)
            kind = special.get((x, y), "generic")
            q.append((x + y + 0.5, 2, f"roof.{kind}.m{m}", x, y))
    for _, _, aid, x, y in sorted(q, key=lambda t: (t[0], t[1])):
        c.put(aid, *TX(x, y))


def main():
    c = Canvas(3330)
    c.deck(0, c.h)
    wn = ("burst_laser", "mass_driver", "missile_launcher", "ion_cannon", "incendiary_launcher")
    cl = ["r0", "r0 charged", "r1", "r1 charged", "r2", "r2 charged", "r3", "r3 charged"]
    y = grid(c, 6, "HULL WEAPONS  (muzzle points at the hull: r0 -y, r1 +x, r2 +y, r3 -x)",
             [(n.replace("_", " "), rotated(n)) for n in wn], cl)
    y = grid(c, y, "ENGINE  (idle / .active)", [("engine", rotated("engine", ("", ".active")))], ["r0", "r0 active", "r1", "r1 active", "r2", "r2 active", "r3", "r3 active"])
    y = grid(c, y, "INTERIOR  (shield gen 1x2 r0-r3, small 1x1, consoles, AI core; fabricator/console for scale)", [
        ("", ["module.shield_gen", "module.shield_gen.r1", "module.shield_gen.r2", "module.shield_gen.r3", "module.shield_gen_small", "module.fabricator", "module.console", "module.reactor"]),
        ("", ["module.weapons_console", "module.shield_console", "module.helm", "module.ai_core", "module.light", "module.storage.partial", "module.bed", None])],
        None, ch=100)
    c.label(8, y, "ROOFS  (generic mask m0-m15 = connected sides N E S W bits 1 2 4 8; specials m15 and m0)", True)
    y += 24
    ids = [f"roof.generic.m{m}" for m in range(16)]
    for i, aid in enumerate(ids):
        c.put(aid, 40 + (i % 8) * 70 + 20, y + 52 + (i // 8) * 52)
        c.label(14 + (i % 8) * 70, y + 4 + (i // 8) * 52, f"m{i}")
    xo = 620
    for j, k in enumerate(("weapon", "shield", "engine")):
        for q2, mm in enumerate((15, 0)):
            c.put(f"roof.{k}.m{mm}", xo + j * 190 + q2 * 70 + 30, y + 44 + 30)
        c.label(xo + j * 190, y + 2, f"roof.{k}  m15 / m0")
    y += 130
    c.label(8, y, "FX  (frames left to right; projectiles point screen-right)", True)
    y += 22
    fx = [("laser_bolt", 2), ("mass_slug", 2), ("missile", 3), ("ion_bolt", 2), ("fire_shell", 2), ("pd_shot", 2), ("shield_hit", 4), ("explosion_small", 5)]
    x = 10
    for name, n in fx[:6]:
        for k in range(n):
            c.put(f"fx.{name}.{k}", x + 24, y + 30)
            x += 56 if name in ("missile", "mass_slug") else 44
        c.label(x - 44 * n, y, name)
        x += 14
        if x > W - 100:
            break
    y += 56
    x = 20
    for name, n in fx[6:]:
        for k in range(n):
            c.put(f"fx.{name}.{k}", x + 36, y + 40)
            x += 84
        c.label(x - 84 * n, y - 4, name)
        x += 24
    x += 10
    for kind in ("laser", "mass", "missile", "ion", "fire"):
        for k in range(3):
            c.put(f"fx.muzzle.{kind}.{k}", 20 + (["laser", "mass", "missile", "ion", "fire"].index(kind)) * 150 + k * 46 + 0, y + 120)
        c.label(14 + (["laser", "mass", "missile", "ion", "fire"].index(kind)) * 150, y + 90, f"muzzle.{kind}")
    y += 150
    c.label(8, y, "MOCK SHIP SECTION  (hull walls + deck; weapons N (laser, driver, missile, ion), incendiary E, engines W)", True)
    scene(c, y + 10, False)
    y += 300
    c.label(8, y, "SAME SECTION ROOFED  (roof.generic + weapon / shield / engine roofs)", True)
    scene(c, y + 10, True)
    c.h = y + 330
    c.px = c.px[:c.h]
    OUT.mkdir(parents=True, exist_ok=True)
    c.save(OUT / "pixel-sheet-1x.png", 1)
    c.save(OUT / "pixel-sheet-3x.png", 3)


main()
