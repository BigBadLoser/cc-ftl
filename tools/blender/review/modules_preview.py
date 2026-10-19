"""Module prototypes preview (plain python3 + numpy + PIL): the hypersleep chamber, ore refinery and hydroponics bed
and bay at rotations 0 (back row) and 1 (front row), idle and active, in a walled room with crew for scale.

  python3 -I tools/blender/review/modules_preview.py <modules assets dir> <out dir> -> modules-{1x,3x}.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
STATE = {"hypersleep": "occupied", "refinery": "active", "hydro_bed": "ripe", "hydro_bay": "ripe"}
PLACE = [("hypersleep", 0, 1, 1), ("refinery", 0, 4, 2), ("hydro_bed", 0, 6, 1), ("hydro_bay", 0, 9, 2),
         ("hypersleep", 1, 0, 6), ("refinery", 1, 4, 6), ("hydro_bed", 1, 7, 5), ("hydro_bay", 1, 10, 6)]


def room(cv, M, pub, ox, oy, active):
    nx, ny = 11, 8
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    draw = [(gx + gy, f"module.{s}.r{r}{'.' + STATE[s] if active else ''}", gx, gy) for s, r, gx, gy in PLACE]
    draw += [(6 + 3.5, "@crew", 6, 3), (2 + 7.5, "@crew", 2, 7)]
    for _, aid, gx, gy in sorted(draw):
        sx, sy = iso(ox, oy, gx, gy)
        if aid == "@crew":
            cv.char(human(pub, DIRS["SE"]), sx, sy)
        elif aid in M.m["assets"]:
            cv.static(M, aid, sx, sy)


def main():
    M, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    W, H = 660, 440
    cv = Canvas(W * 2, H)
    for k, act in enumerate((False, True)):
        room(cv, M, pub, k * W + 290, 110, act)
        cv.labels.append((k * W + 8, 6, "active / occupied / ripe" if act else "idle / empty / growing"))
    for s in (1, 3):
        cv.save(out / f"modules-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
