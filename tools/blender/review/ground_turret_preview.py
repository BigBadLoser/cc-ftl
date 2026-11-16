"""Ground turret preview (plain python3 + numpy + PIL): the ground mount (sprites/turret_ground.py) in each of its four
cable sides on asteroid rock, the turret on top as turretView draws it, a run of ground cable leaving its port.

  python3 -I tools/blender/review/ground_turret_preview.py <weapons out dir> <cable art dir> <out dir>
    -> ground-turret-3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, iso  # noqa: E402

N = 8                                               # rock patch, tiles 0..N-1; the mount on (3..4, 3..4)
CABLE = {0: ([(5, 3), (6, 3), (7, 3)], "m10.w8", "m10"), 1: ([(4, 5), (4, 6), (4, 7)], "m5.w1", "m5"),
         2: ([(2, 4), (1, 4), (0, 4)], "m10.w2", "m10"), 3: ([(3, 2), (3, 1), (3, 0)], "m5.w4", "m5")}
ROWS = (("burst_laser", (1, 5, 1, 5)), ("point_defense", (3, 3, 3, 3)))


def scene(cv, G, pub, cab, ox, oy, stem, rot, aim):
    for gx in range(N):
        for gy in range(N):
            cv.static(pub, "rock.ground.m15.v0", *iso(ox, oy, gx, gy))
    items = []
    tiles, first, rest = CABLE[rot]
    for i, (gx, gy) in enumerate(tiles):
        items.append((gx + gy, 0, cab, f"cable.duct.{first if i == 0 else rest}", gx, gy))
    items.append((8, 1, G, f"module.{stem}.ground.r{rot}", 4, 4))
    items.append((8, 2, G, f"turret.{stem}.d{aim}", 3.5, 3.5))
    for _, _, src, aid, gx, gy in sorted(items, key=lambda t: (t[0], t[1])):
        sx, sy = iso(ox, oy, gx, gy)
        cv.static(src, aid, round(sx), round(sy))


def main():
    G, cab, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Path(sys.argv[3])
    pub = Assets(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    W, H = 540, 420
    cv = Canvas(W * 4, H * len(ROWS))
    for row, (stem, aims) in enumerate(ROWS):
        for r in range(4):
            ox, oy = W // 2 + r * W, 150 + row * H
            scene(cv, G, pub, cab, ox, oy, stem, r, aims[r])
            cv.labels.append((ox - 60, oy + N * 32 - 10, f"{stem} r{r}"))
    cv.save(out / "ground-turret-3x.png", 2)
    print("wrote", out)


if __name__ == "__main__":
    main()
