"""Ground turret preview (plain python3 + numpy + PIL): the 3x3 ground mount (sprites/turret_ground.py) in each of its
four cable sides on asteroid rock, the turret head on its riser, a run of ground cable into the junction box. Cable tiles
behind the mount draw before it, the ones beside or in front of it after (depth by tile).

  python3 -I tools/blender/review/ground_turret_preview.py <weapons out dir> <cable art dir> <out dir> [stem] [aim]
    -> ground-turret-sides.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, iso  # noqa: E402

N = 7                                               # rock patch, tiles 0..N-1; the mount on (2..4, 2..4)
CABLE = {0: ([(5, 3), (6, 3)], "m10.w8", "m10"), 1: ([(3, 5), (3, 6)], "m5.w1", "m5"),
         2: ([(1, 3), (0, 3)], "m10.w2", "m10"), 3: ([(3, 1), (3, 0)], "m5.w4", "m5")}
FRONT = 8                                           # depth (x + y) of the mount's front tile (4, 4)


def scene(cv, G, pub, cab, ox, oy, stem, rot, aim):
    for gx in range(N):
        for gy in range(N):
            cv.static(pub, "rock.ground.m15.v0", *iso(ox, oy, gx, gy))
    tiles, first, rest = CABLE[rot]
    ids = [f"cable.duct.{first if i == 0 else rest}" for i in range(len(tiles))]
    behind = [(cab, a, gx, gy) for a, (gx, gy) in zip(ids, tiles) if gx + gy < FRONT]
    front = [(cab, a, gx, gy) for a, (gx, gy) in zip(ids, tiles) if gx + gy >= FRONT]
    for src, aid, gx, gy in behind + [(G, f"module.{stem}.ground.r{rot}", 4, 4), (G, f"turret.{stem}.ground.d{aim}", 3, 3)] + front:
        sx, sy = iso(ox, oy, gx, gy)
        cv.static(src, aid, round(sx), round(sy))


def main():
    G, cab, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Path(sys.argv[3])
    stem = sys.argv[4] if len(sys.argv) > 4 else "burst_laser"
    aim = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    pub = Assets(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    W, H = 400, 290
    cv = Canvas(W * 4, H)
    for r in range(4):
        ox, oy = W // 2 + r * W, 70
        scene(cv, G, pub, cab, ox, oy, stem, r, aim)
        cv.labels.append((ox - 50, H - 22, f"{stem} r{r}"))
    cv.save(out / "ground-turret-sides.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
