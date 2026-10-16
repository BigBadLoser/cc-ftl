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


def room(assets, man):
    GW, GH = 9, 7
    W, H = 660, 330
    s = Scene(assets, man, W, H, (W // 2 - 20, 40))
    for gx in range(GW):
        for gy in range(GH):
            s.static(["tile.floor.a", "tile.floor.b", "tile.floor.c"][(gx * 3 + gy) % 3 if (gx + gy) % 5 == 0 else (0 if gx % 2 else 1)], gx, gy, -0.5)
    for gx in range(GW):
        s.static("tile.hull.x" if gx in (2, 3, 4) else ("tile.door.x" if gx == 6 else "tile.wall.x"), gx, 0, 0.1)
        s.static("tile.wall.low.x", gx, GH - 1, 0.1)
    for gy in range(GH):
        s.static("tile.hull.y" if gy in (4, 5) else ("tile.door.open.y" if gy == 3 else "tile.wall.y"), 0, gy, 0.1)
        s.static("tile.wall.low.y", GW - 1, gy, 0.1)
    s.static("module.reactor", 4, 4)
    s.static("module.life_support", 7, 2)
    s.static("module.bed", 1, 5)
    s.static("module.console", 5, 1)
    s.static("prop.crate", 7, 5)
    s.static("module.light", 2, 2)
    body = ["body", "legs.cargo_pants", "gear.belt.tool_belt"]
    a = body + ["eyes.organic", "hair.mohawk", "arm.L.flesh", "arm.R.flesh", "torso.work_shirt", "gear.back.engineer_rig",
                "gear.head.welding_goggles", "implant.temple.neural_jack"]
    b = body + ["eyes.cyber", "hair.short", "arm.L.cyber", "arm.R.flesh", "torso.tee"]
    c = body + ["eyes.organic", "hair.ponytail", "arm.L.flesh", "arm.R.cyber", "torso.work_shirt", "gear.head.welding_goggles"]
    sl = body + ["eyes.organic", "hair.shaved", "arm.L.flesh", "arm.R.flesh", "torso.tee"]
    base = {"team.skin": (212, 156, 116), "team.hair": (70, 48, 34), "team.cloth": (114, 132, 95), "team.accent": (200, 150, 40)}
    swap = {"team.skin": (120, 78, 54), "team.hair": (226, 140, 40), "team.cloth": (60, 96, 150), "team.accent": (200, 60, 70)}
    s.crew(crew_ids(man, a), 3.3, 5.7, 1, "idle", 1, base)
    s.crew(crew_ids(man, b), 6.3, 3.6, 3, "walk", 2, {**base, "team.skin": (232, 190, 150), "team.hair": (40, 40, 48)})
    s.crew(crew_ids(man, c), 5.5, 2.4, 6, "work", 3, swap)
    s.crew(crew_ids(man, sl), 1.5, 5.0, 2, "sleep", 1, {**base, "team.hair": (150, 150, 160)})
    s.flush()
    return s


def junctions(assets, man):
    W, H = 520, 250
    s = Scene(assets, man, W, H, (W // 2, 24))
    for gx in range(-2, 9):
        for gy in range(-2, 8):
            s.static("tile.floor.a", gx, gy, -0.5) if 0 <= gx + 2 and False else None
    # rows: wall x4, hull x3, door, then corner / T / plus blocks
    for k in range(4):
        s.static("tile.wall.x", k, 0)
    for k in range(4, 7):
        s.static("tile.hull.x", k, 0)
    s.static("tile.door.x", 7, 0)
    s.static("tile.wall.x", 8, 0)
    for k in range(1, 5):
        s.static("tile.wall.y", 0, k)
    for k in range(5, 8):
        s.static("tile.hull.low.y", 0, k)
    # corner (x+y on one tile), T and plus further in
    s.static("tile.wall.x", 0, 0, 0.2)
    s.static("tile.wall.y", 0, 0, 0.2)
    for tx, ty in ((3, 3), (6, 3), (3, 6)):
        s.static("tile.wall.x", tx, ty, 0.2)
        s.static("tile.wall.y", tx, ty, 0.2)
    s.static("tile.wall.x", 4, 3)
    s.static("tile.wall.y", 3, 4)
    s.static("tile.wall.low.x", 6, 6)
    s.static("tile.wall.low.y", 6, 6, 0.2)
    s.static("tile.door.low.x", 7, 6)
    s.static("tile.door.open.x", 8, 3)
    s.flush()
    return s


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    assets = Path(argv[0]) if argv else ROOT / "public/assets"
    out = Path(argv[1] if len(argv) > 1 else DEFAULT_OUT)
    out.mkdir(parents=True, exist_ok=True)
    man = json.loads((assets / "manifest.json").read_text())
    r = room(assets, man)
    r.save(out / "contact-1x.png", 1)
    r.save(out / "contact-2x.png", 2)
    junctions(assets, man).save(out / "junctions-2x.png", 2)
    print("CONTACT written", out)


main()
