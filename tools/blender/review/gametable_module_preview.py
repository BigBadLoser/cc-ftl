"""Holo game table module preview (plain python3 + numpy + PIL): every rotation in each state (idle, unpowered, active)
with both players seated (table, then the players, then the front overlay, as the renderer layers them), and the
active loop at r0 as a GIF and MP4 at the game's ANIM_FPS.

  python3 -I tools/blender/review/gametable_module_preview.py <gametable_module out dir> <out dir>
    -> gametable-states-3x.png, gametable-play-3x.gif / .mp4"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso, mp4  # noqa: E402

FPS = 4                                             # src/render/moduleArt.ts ANIM_FPS
SEATS = ((-0.5, 1.0), (0.5, -1.0))                  # gametable_kit.SEATS
SEAT_DIR = {0: 6, 1: 0, 2: 2, 3: 4}                 # consoles.SEAT_DIR


def grid(rot, u, v):
    """modkit.K.p for the 2x1 footprint."""
    x, y = ((u, v), (-v, u), (-u, -v), (v, -u))[rot]
    w, d = (2, 1) if rot % 2 == 0 else (1, 2)
    return x - (w - 1) / 2, y - (d - 1) / 2


def scene(cv, G, pub, ox, oy, rot, tag, crew=True):
    for gx in range(-2, 2):
        for gy in range(-2, 2):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    seats = []
    for u, v in SEATS:
        gx, gy = grid(rot, u, v)
        seats.append((gx + gy, round(gx), round(gy), SEAT_DIR[rot] if v > 0 else SEAT_DIR[(rot + 2) % 4]))
    cv.static(G, f"module.gametable.r{rot}{tag}", *iso(ox, oy, 0, 0))
    if crew:
        for _, gx, gy, d in sorted(seats):
            cv.char(human(pub, d, "sit_stool"), *iso(ox, oy, gx, gy))
    for part in ("front", "holo"):                              # (the overlays: over the players, or alone)
        fid = f"module.gametable.{part}.r{rot}{tag}"
        if fid in G.m["assets"] and (crew or part == "holo"):
            cv.static(G, fid, *iso(ox, oy, 0, 0))


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    rots = sorted({int(k.split(".r")[1][0]) for k in G.m["assets"] if k.startswith("module.gametable.r")})
    n = sum(1 for k in G.m["assets"] if k.startswith("module.gametable.r0.active"))
    states = (("idle", "", False), ("unpowered", ".unpowered", False), ("active, no crew", ".active", False),
              ("active", ".active", True))
    cv = Canvas(200 * len(rots), 170 * len(states))
    for row, (name, tag, crew) in enumerate(states):
        for i, r in enumerate(rots):
            ox, oy = 100 + i * 200, 115 + row * 170
            scene(cv, G, pub, ox, oy, r, tag, crew)
            cv.labels.append((ox - 30, oy + 45, f"r{r} {name}"))
    cv.save(out / "gametable-states-3x.png", 3)
    frames = []
    for f in range(n):
        c = Canvas(200, 170)
        scene(c, G, pub, 100, 110, 0, ".active" + (f".f{f}" if f else ""))
        frames.append(Image.fromarray(c.px[..., :3]).resize((600, 510), Image.NEAREST))
    frames[0].save(out / "gametable-play-3x.gif", save_all=True, append_images=frames[1:], duration=1000 // FPS, loop=0)
    mp4(frames, out / "gametable-play-3x.mp4", fps=FPS, loops=4)
    print("wrote", out, n, "frames")


if __name__ == "__main__":
    main()
