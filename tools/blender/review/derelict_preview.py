"""Derelict dressing preview (plain python3 + numpy + PIL): an 8x6 room at the ship's corner (hull on the far sides)
intact next to the same room decayed, and a small AI shipyard room, each in the walls-up, cutaway and roofed views,
with a crew member for scale. Composited like the runtime (overlays drawn right after the tile they dress, additive
glow; the burnt-out module is darkened by a tint).

  python3 -I tools/blender/review/derelict_preview.py <derelict assets dir> <out dir>
    -> derelict-room-{up|cut|roof}-1x.png / -3x.png, derelict-ai-1x.png / -3x.png, derelict-parts-1x.png / -3x.png"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
PRE = {"up": "full.", "cut": ""}
ROOF = "roof.c0b.00"


class Scene:
    """Draw list: (depth, aid, gx, gy, tint); floors first, then everything else by depth (gx + gy)."""

    def __init__(self, D, pub):
        self.D, self.pub, self.floor, self.items, self.roof = D, pub, [], [], []

    def src(self, aid):
        for A in (self.D, self.pub):
            if aid in A.m["assets"]:
                return A
        raise KeyError(aid)

    def add(self, aid, gx, gy, k=0.0, tint=None, layer=None):
        (self.floor if layer == "floor" else self.roof if layer == "roof" else self.items).append(
            (gx + gy + k, aid, gx, gy, tint))

    def draw(self, cv, ox, oy, roofed):
        layers = [[d for d in self.items if d[1].startswith("tile.")], self.roof] if roofed else [self.floor, self.items]
        for lay in layers:
            for _, aid, gx, gy, tint in sorted(lay, key=lambda d: d[0]):
                sx, sy = iso(ox, oy, gx, gy)
                if aid == "@crew":
                    cv.char(human(self.pub, DIRS["SE"]), sx, sy)
                    continue
                try:
                    img, g, an = self.src(aid).static(aid)
                except KeyError:
                    continue                    # e.g. no breach end in the cutaway (the tear keeps the cut height)
                if tint is not None:
                    img = img.copy()
                    img[..., :3] = (img[..., :3] * tint).astype(np.uint8)
                cv.put(img, g, sx - an["x"], sy - an["y"])


def walls(sc, nx, ny, fam, level, breach=(), breach_y=()):
    """Far walls of an nx x ny room: the corner at (-1, -1), a run along x at gy = -1, a run along y at gx = -1."""
    p = PRE[level]
    sc.add(f"tile.{fam}.{p}m6", -1, -1)
    for gx in range(nx):
        sfx = ".breach" if gx in breach else ""
        sc.add(f"tile.{fam}.{p}m10{sfx}", gx, -1)
        if sfx and gx - 1 not in breach:
            sc.add(f"tile.{fam}.{p}breach.end.w", gx, -1, 0.001)
    for gy in range(ny):
        sfx = ".breach" if gy in breach_y else ""
        sc.add(f"tile.{fam}.{p}m5{sfx}", -1, gy)
        if sfx and gy - 1 not in breach_y:
            sc.add(f"tile.{fam}.{p}breach.end.n", -1, gy, 0.001)


def room(D, pub, level, decayed):
    nx, ny = 8, 6
    sc = Scene(D, pub)
    for gx in range(nx):
        for gy in range(ny):
            sc.add("tile.floor.a", gx, gy, layer="floor")
    walls(sc, nx, ny, "hull", level, (3, 4) if decayed else (), (2,) if decayed else ())
    for gx in range(-1, nx):
        for gy in range(-1, ny):
            sc.add(ROOF, gx, gy, layer="roof")
    sc.add("@crew", 3, 2, 0.5)
    if not decayed:
        sc.add("module.light", 0, 0, 0.5)
        sc.add("module.light", 7, 5, 0.5)
        sc.add("module.console", 6, 4, 0.5)
        sc.add("prop.crate", 5, 5, 0.5)
        return sc
    F = dict(layer="floor")
    sc.add("decay.breach.floor.v0", 2, 4, **F)
    sc.add("decay.breach.floor.v1", 5, 3, **F)
    sc.add("decay.scorch.floor.v0", 5, 1, **F)
    sc.add("decay.scorch.floor.v2", 6, 2, **F)
    sc.add("decay.scorch.floor.v1", 7, 3, **F)
    sc.add("decay.burnt.1x1", 6, 4, **F)
    for gx, gy, v in ((0, 4, 0), (0, 5, 1), (1, 5, 2)):
        sc.add(f"decay.growth.floor.v{v}", gx, gy, **F)
    w = 0.001
    sc.add(f"decay.scorch.hull.x.{level}.v0", 6, -1, w)
    sc.add(f"decay.scorch.hull.x.{level}.v1", 7, -1, w)
    sc.add(f"decay.growth.hull.y.{level}", -1, 4, w)
    sc.add(f"decay.growth.hull.y.{level}", -1, 5, w)
    for gx in (0, 1, 6, 7):
        sc.add("decay.striplight.hull.x", gx, -1, w * 2)
    if level == "up":
        sc.add("decay.striplight.hull.x.high", 1, -1, w * 2)
    sc.add("decay.striplight.hull.y", -1, 0, w * 2)
    sc.add("module.light.broken", 0, 0, 0.5)
    sc.add("module.light.off", 7, 5, 0.5)
    sc.add("module.console", 6, 4, 0.5, tint=0.5)
    sc.add("decay.debris.crate", 5, 5, 0.5)
    sc.add("decay.debris.plates", 1, 1, 0.5)
    sc.add("decay.debris.cables", 3, 4, 0.5)
    sc.add("decay.debris.junction.spark", 7, 0, 0.5)
    sc.add("decay.debris.pipe", 4, 1, 0.5)
    sc.add("decay.debris.chunks", 1, 3, 0.5)
    sc.add("decay.eggsac.2x2", 1, 5, 0.5)
    sc.add("decay.eggsac.1x1", 3, 5, 0.5)
    sc.add("decay.eggs", 7, 1, 0.5)
    sc.add("decay.breach.roof", 4, 2, 0.001, layer="roof")
    sc.add("decay.scorch.roof.v0", 6, 1, 0.001, layer="roof")
    sc.add("decay.scorch.roof.v1", 1, 4, 0.001, layer="roof")
    return sc


def ai_room(D, pub, level):
    nx, ny = 5, 4
    sc = Scene(D, pub)
    for gx in range(nx):
        for gy in range(ny):
            sc.add("tile.floor.a", gx, gy, layer="floor")
    walls(sc, nx, ny, "wall", level, (2, 3), (1,))
    for gx in range(-1, nx):
        for gy in range(-1, ny):
            sc.add(ROOF, gx, gy, layer="roof")
    sc.add("module.fabricator.dormant", 2, 0, 0.5)
    for gx in range(nx):
        sc.add("decay.ai.cables.x", gx, 2, 0.2)
    sc.add("decay.ai.scrap", 4, 0, 0.5)
    sc.add("decay.ai.scrap", 0, 3, 0.5)
    sc.add("decay.debris.junction", 4, 3, 0.5)
    sc.add("decay.scorch.floor.v1", 3, 3, layer="floor")
    sc.add("decay.striplight.wall.x", 0, -1, 0.002)
    sc.add("decay.striplight.wall.x", 4, -1, 0.002)
    sc.add("@crew", 2, 3, 0.5)
    return sc


def main():
    D, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    W, H = 540, 370
    for view in ("up", "cut", "roof"):
        level = "cut" if view == "cut" else "up"
        cv = Canvas(W * 2, H)
        for k, dec in enumerate((False, True)):
            room(D, pub, level, dec).draw(cv, k * W + 230, 110, view == "roof")
            cv.labels.append((k * W + 8, 6, f"{'decayed' if dec else 'intact'} - {view}"))
        for s in (1, 3):
            cv.save(out / f"derelict-room-{view}-{s}x.png", s)
    cv = Canvas(3 * 340, 280)
    for k, view in enumerate(("up", "cut", "roof")):
        ai_room(D, pub, "cut" if view == "cut" else "up").draw(cv, k * 340 + 150, 100, view == "roof")
        cv.labels.append((k * 340 + 8, 6, f"AI shipyard - {view}"))
    for s in (1, 3):
        cv.save(out / f"derelict-ai-{s}x.png", s)
    parts(D, pub, out)
    print("wrote", out)


PARTS = ["decay.breach.floor.v0", "decay.breach.floor.v1", "decay.breach.floor.v2", "decay.scorch.floor.v0",
         "decay.scorch.floor.v1", "decay.scorch.floor.v2", "decay.growth.floor.v0", "decay.growth.floor.v1",
         "decay.growth.floor.v2", "decay.eggs", "decay.eggsac.1x1", "decay.debris.plates", "decay.debris.cables", "decay.debris.junction.spark",
         "decay.debris.pipe", "decay.debris.chunks", "decay.debris.crate", "module.light", "module.light.off",
         "module.light.broken", "decay.ai.scrap", "decay.ai.cables.x", "decay.burnt.1x1"]


def parts(D, pub, out):
    """Each new floor piece and prop on its own floor tile, labelled."""
    n = 8
    cv = Canvas(n * 110, ((len(PARTS) + n - 1) // n) * 120)
    sc = Scene(D, pub)
    for k, aid in enumerate(PARTS):
        sx, sy = (k % n) * 110 + 55, (k // n) * 120 + 80
        img, g, an = pub.static("tile.floor.a")
        cv.put(img, g, sx - an["x"], sy - an["y"])
        img, g, an = sc.src(aid).static(aid)
        cv.put(img, g, sx - an["x"], sy - an["y"])
        cv.labels.append((sx - 52, sy + 24, aid.replace("decay.", "")[:18]))
    for s in (1, 3):
        cv.save(out / f"derelict-parts-{s}x.png", s)


if __name__ == "__main__":
    main()
