"""Arcade module preview (plain python3 + numpy + PIL): every rotation in each state (idle, unpowered, active) on a floor
tile, and the active loop at r0 with a player in front, as a GIF and MP4 at the game's ANIM_FPS.

  python3 -I tools/blender/review/arcade_module_preview.py <arcade_cabinet out dir> <out dir>
    -> arcade-states-3x.png, arcade-play-3x.gif / .mp4"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso, mp4  # noqa: E402

FPS = 4                                             # src/render/moduleArt.ts ANIM_FPS


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    n = sum(1 for k in G.m["assets"] if k.startswith("module.arcade.r0.active"))
    states = (("idle", ""), ("unpowered", ".unpowered"), ("active", ".active"))
    cv = Canvas(130 * 4, 150 * len(states))
    for row, (name, tag) in enumerate(states):
        for r in range(4):
            ox, oy = 65 + r * 130, 105 + row * 150
            floor(cv, pub, ox, oy, 1, 1)
            cv.static(G, f"module.arcade.r{r}{tag}", *iso(ox, oy, 0, 0))
            cv.labels.append((ox - 30, oy + 30, f"r{r} {name}"))
    cv.save(out / "arcade-states-3x.png", 3)
    frames = []
    for f in range(n):
        c = Canvas(170, 150)
        ox, oy = 85, 90
        floor(c, pub, ox, oy, 1, 2)
        c.static(G, "module.arcade.r0.active" + (f".f{f}" if f else ""), *iso(ox, oy, 0, 0))
        c.char(human(pub, 6), *iso(ox, oy, 0, 1))
        frames.append(Image.fromarray(c.px[..., :3]).resize((510, 450), Image.NEAREST))
    frames[0].save(out / "arcade-play-3x.gif", save_all=True, append_images=frames[1:], duration=1000 // FPS, loop=0)
    mp4(frames, out / "arcade-play-3x.mp4", fps=FPS, loops=4)
    print("wrote", out, n, "frames")


if __name__ == "__main__":
    main()
