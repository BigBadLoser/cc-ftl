"""Verification image: composes a small room from the tile/module assets plus crew built from layer sheets in stack
order (with a palette swap), using only manifest.json + the PNG sheets (what the renderer sees).

  blender -b --factory-startup --python tools/blender/sprites/contact_sheet.py -- [assets dir] [out dir]

Writes contact-1x.png, contact-2x.png (room) and junctions-2x.png (wall rows, corners, T and plus junctions, doors)."""
import json
import sys
from pathlib import Path
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose, post  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUT = "/tmp/claude-0/-home-user/ed10066a-51ba-5b6e-98cf-ce829905d359/scratchpad/r1-assets"
_cache = {}


def load(path):
    p = str(path)
    if p not in _cache:
        img = bpy.data.images.load(p)
        img.colorspace_settings.name = "Non-Color"
        img.alpha_mode = "STRAIGHT"
        w, h = img.size
        px = np.empty(w * h * 4, np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        _cache[p] = (np.clip(np.round(px.reshape(h, w, 4)[::-1] * 255), 0, 255)).astype(np.uint8)
    return _cache[p]


class Scene:
    def __init__(self, assets, man, W, H, origin):
        self.dir, self.man = assets, man
        self.cv = np.zeros((H, W, 4), np.uint8)
        self.cv[..., :3] = (14, 17, 22)
        self.cv[..., 3] = 255
        self.ox, self.oy = origin
        self.queue = []

    def screen(self, gx, gy):
        """Floor-diamond centre of grid point (gx, gy) (tile centres at +0.5)."""
        return self.ox + (gx - gy) * 32, self.oy + (gx + gy) * 16

    def static(self, aid, tx, ty, depth=0.0):
        """Queue static asset aid whose anchor tile is (tx, ty)."""
        self.queue.append((tx + ty + depth, 0, "s", aid, tx, ty))

    def crew(self, layers, gx, gy, d, clip, frame, colours):
        self.queue.append((gx + gy, 2, "c", layers, gx, gy, d, clip, frame, colours))

    def draw_static(self, aid, tx, ty):
        a = self.man["assets"][aid]
        sh = self.man["sheets"][a["sheet"]]
        f, an = a["frame"], a["anchor"]
        sx, sy = self.screen(tx + 0.5, ty + 0.5)
        x, y = int(sx - an["x"]), int(sy - an["y"])
        img = load(self.dir / sh["image"])[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]]
        compose.over(self.cv, img, x, y)
        if a.get("glow"):
            compose.add(self.cv, load(self.dir / sh["glow"])[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], x, y)

    def draw_crew(self, layers, gx, gy, d, clip, frame, colours):
        assets = sorted((self.man["assets"][i] for i in layers), key=lambda a: a["order"])
        sx, sy = self.screen(gx, gy)
        tile = None
        glows = []
        for a in assets:
            sh = self.man["sheets"][a["sheet"]]
            c = a["clips"][clip]
            col = c["start"] + frame % c["frames"]
            fw, fh = a["frameW"], a["frameH"]
            sl = load(self.dir / sh["image"])[d * fh:(d + 1) * fh, col * fw:(col + 1) * fw]
            x, y = int(sx - a["anchor"]["x"]), int(sy - a["anchor"]["y"])
            tile = np.zeros((fh, fw, 4), np.uint8) if tile is None else tile
            compose.over(tile, sl, 0, 0) if False else None
            sl = compose.remap_keys(sl, colours)
            compose.over(self.cv, sl, x, y)
            if a.get("glow"):
                glows.append((load(self.dir / sh["glow"])[d * fh:(d + 1) * fh, col * fw:(col + 1) * fw], x, y))
        for g, x, y in glows:
            compose.add(self.cv, g, x, y)

    def flush(self):
        for it in sorted(self.queue, key=lambda q: (q[0], q[1])):
            if it[2] == "s":
                self.draw_static(*it[3:])
            else:
                self.draw_crew(*it[3:])
        self.queue = []

    def save(self, path, scale=1):
        cv = self.cv.repeat(scale, 0).repeat(scale, 1) if scale > 1 else self.cv
        post.write_png(path, cv)


def crew_ids(man, parts):
    return [f"crew.human.{p}" for p in parts]


ORDER = {"n": 0, "w": 1, "c": 2, "s": 3, "e": 4}
DELTA = {"n": (0, -1), "e": (1, 0), "s": (0, 1), "w": (-1, 0)}


def blocks(s, layout, doors_open=(), cut=None):
    """layout: strings, '#' wall, '.' floor, 'D' door, ' ' space. cut: None = auto rule, True/False = forced.
    Mirrors src/render/tiles.ts: floor under every wall/door tile; base pieces then upper pieces, each n, w, c, s, e."""
    H, W = len(layout), len(layout[0])
    at = lambda x, y: layout[y][x] if 0 <= x < W and 0 <= y < H else " "  # noqa: E731
    solid = lambda x, y: at(x, y) in "#D"  # noqa: E731
    for y in range(H):
        for x in range(W):
            k = at(x, y)
            if k == " ":
                continue
            s.static("tile.floor." + "abc"[(x * 3 + y * 5) % 7 % 3 if (x + y) % 3 == 0 else 0], x, y, -0.5)
            if k == ".":
                continue
            lowered = (at(x - 1, y) in ".D" or at(x, y - 1) in ".D" or at(x - 1, y - 1) in ".D") if cut is None else cut
            fam = "hull" if any(at(x + dx, y + dy) == " " for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy) else "wall"
            arms = [d for d in "nesw" if solid(x + DELTA[d][0], y + DELTA[d][1])]
            order = sorted(["c"] + arms, key=lambda p: ORDER[p])
            up = "upper.low" if lowered and k == "#" else "upper"
            if k == "D":
                ax = "x" if solid(x - 1, y) and solid(x + 1, y) else "y"
                s.static(f"tile.door.sill.{ax}", x, y, 0.1)
                s.static(f"tile.door.{ax}{'.open' if (x, y) in doors_open else ''}", x, y, 0.13)
                continue
            for layer in ("base", up):
                for p in order:
                    s.static(f"tile.{fam}.{layer}.{'c' if p == 'c' else 'arm.' + p}", x, y, 0.1 + 0.001 * ORDER[p] + (0.01 if layer != "base" else 0))


def room(assets, man):
    W, H = 660, 330
    s = Scene(assets, man, W, H, (W // 2 - 20, 40))
    blocks(s, ["#########",
               "#...#...#",
               "#...#...#",
               "#.......#",
               "###D#####",
               "#.......#",
               "#.......#",
               "#########"][:7] if False else
              ["#########",
               "#...#...#",
               "#...D...#",
               "#.......#",
               "#...#...#",
               "#...#...#",
               "#########"], doors_open=((4, 2),))
    s.static("module.reactor", 3, 3)
    s.static("module.life_support", 7, 2)
    s.static("module.bed", 1, 5)
    s.static("module.console", 6, 1)
    s.static("prop.crate", 7, 5)
    s.static("module.light", 2, 1)
    body = ["body", "legs.cargo_pants", "gear.belt.tool_belt"]
    a = body + ["eyes.organic", "hair.mohawk", "arm.L.flesh", "arm.R.flesh", "torso.work_shirt", "gear.back.engineer_rig",
                "gear.head.welding_goggles", "implant.temple.neural_jack"]
    b = body + ["eyes.cyber", "hair.short", "arm.L.cyber", "arm.R.flesh", "torso.tee"]
    c = body + ["eyes.organic", "hair.ponytail", "arm.L.flesh", "arm.R.cyber", "torso.work_shirt", "gear.head.welding_goggles"]
    sl = body + ["eyes.organic", "hair.shaved", "arm.L.flesh", "arm.R.flesh", "torso.tee"]
    base = {"team.skin": (212, 156, 116), "team.hair": (70, 48, 34), "team.cloth": (114, 132, 95), "team.accent": (200, 150, 40)}
    swap = {"team.skin": (120, 78, 54), "team.hair": (226, 140, 40), "team.cloth": (60, 96, 150), "team.accent": (200, 60, 70)}
    s.crew(crew_ids(man, a), 3.3, 5.7, 1, "idle", 1, base)
    s.crew(crew_ids(man, b), 5.3, 3.6, 3, "walk", 2, {**base, "team.skin": (232, 190, 150), "team.hair": (40, 40, 48)})
    s.crew(crew_ids(man, c), 5.5, 2.4, 6, "work", 3, swap)
    s.crew(crew_ids(man, sl), 1.5, 5.0, 2, "sleep", 1, {**base, "team.hair": (150, 150, 160)})
    s.flush()
    return s


def junctions(assets, man):
    """Runs, L corners, T and + junctions, an isolated post, door runs; full height (cut=False) and cutaway."""
    layout = ["###########   #",
              "#.........#   #",
              "#..#####..##D##",
              "#..#...#....#.#",
              "#..#.#.#.##.#.#",
              "#..##D##..#.#D#",
              "#.......###.#.#",
              "#########  ###."]
    out = []
    for cut in (False, True):
        W, H = 560, 300
        s = Scene(assets, man, W, H, (W // 2 - 90, 30))
        blocks(s, layout, doors_open=((5, 5),), cut=cut)
        s.flush()
        out.append(s)
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    assets = Path(argv[0]) if argv else ROOT / "public/assets"
    out = Path(argv[1] if len(argv) > 1 else DEFAULT_OUT)
    out.mkdir(parents=True, exist_ok=True)
    man = json.loads((assets / "manifest.json").read_text())
    r = room(assets, man)
    r.save(out / "contact-1x.png", 1)
    r.save(out / "contact-2x.png", 2)
    full, cut = junctions(assets, man)
    full.save(out / "junctions-full-2x.png", 2)
    cut.save(out / "junctions-cut-2x.png", 2)
    print("CONTACT written", out)


main()
