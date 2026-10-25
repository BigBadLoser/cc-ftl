"""Weapons look preview (plain python3 + numpy + PIL): the missile launcher, ion cannon and incendiary launcher next to
the approved burst laser and mass driver.

  python3 -I tools/blender/review/weapons_mil_preview.py <weapons assets dir> <out dir>
    -> weapons-turrets-1x.png / -3x.png: each turret on a roof patch at aims 1, 3 and 6, aim 1 charged, and stowed
    -> weapons-bays-1x.png / -3x.png: the floor bays at r0 in a walled room with a crew member for scale
Turrets are anchored at the bay centre at floor level (their art sits on the roof plane); bays at the front-most tile."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
NEW = [("missile_launcher", 3), ("ion_cannon", 2), ("incendiary_launcher", 2)]
REF = [("burst_laser", 2), ("mass_driver", 3)]
ROOF = "roof.c0b.00"


def turret_cell(w, pub, stem, n, tag):
    cv = Canvas(250, 250)
    ox, oy = 125, 190
    lo, hi = -1, n + 1
    for gx in range(lo, hi):
        for gy in range(lo, hi):
            if ROOF in pub.m["assets"]:
                x, y = iso(ox, oy, gx - n / 2 + 0.5, gy - n / 2 + 0.5)
                cv.static(pub, ROOF, int(round(x)), int(round(y)))
    aid = f"turret.{stem}.{tag}"
    if aid in w.m["assets"]:
        cv.static(w, aid, *iso(ox, oy, 0, 0))
    cv.labels.append((4, 236, f"{stem} {tag}"))
    return cv


def turrets(w, pub, out):
    tags = ["d1", "d3", "d6", "d1.charged", "stowed"]
    rows = NEW + REF
    sheet = Canvas(250 * len(tags), 250 * len(rows))
    for r, (stem, n) in enumerate(rows):
        for c, tag in enumerate(tags):
            cell = turret_cell(w, pub, stem, n, tag)
            sheet.px[r * 250:(r + 1) * 250, c * 250:(c + 1) * 250] = cell.px
            sheet.labels += [(x + c * 250, y + r * 250, t) for x, y, t in cell.labels]
    for s in (1, 3):
        sheet.save(out / f"weapons-turrets-{s}x.png", s)


def bays(w, pub, out):
    nx, ny = 16, 8
    cv = Canvas(820, 470)
    ox, oy = 300, 80
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    place = [("missile_launcher", 3, 1, 1), ("ion_cannon", 2, 6, 1), ("incendiary_launcher", 2, 10, 1),
             ("mass_driver", 3, 1, 5), ("burst_laser", 2, 6, 5)]
    draw = []
    for stem, n, x0, y0 in place:
        fx, fy = x0 + n - 1, y0 + n - 1
        draw.append((fx + fy, "bay", f"module.{stem}.bay.r0", fx, fy, stem))
    draw.append((5 + 3 + 0.02, "crew", None, 5, 3, ""))
    draw.append((13 + 4 + 0.02, "crew", None, 13, 4, ""))
    for _, kind, pay, gx, gy, label in sorted(draw, key=lambda d: d[0]):
        sx, sy = iso(ox, oy, gx, gy)
        if kind == "bay" and pay in w.m["assets"]:
            cv.static(w, pay, sx, sy)
        elif kind == "crew":
            cv.char(human(pub, DIRS["SE"]), sx, sy)
        if label:
            cv.labels.append((sx - 40, sy + 18, label))
    for s in (1, 3):
        cv.save(out / f"weapons-bays-{s}x.png", s)


def main():
    w, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    turrets(w, pub, out)
    bays(w, pub, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
