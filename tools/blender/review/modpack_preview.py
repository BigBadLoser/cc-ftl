"""Module pack look preview (plain python3 + numpy + PIL): one walled room per state with every module of a set in a row
along the back wall, a crew member for scale, the way the runtime draws them (glow added on top).

  python3 -I tools/blender/review/modpack_preview.py <pack assets dir> <out dir> <set>
    set: storage -> storage-1x.png (one room per fill) and storage-3x-<fill>.png
Floor, walls and the crew member come from public/assets."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SETS = {
    # (asset id, footprint, gx of the footprint's left column), states
    "storage": ([("module.storage", (1, 1), 0), ("module.storage_locker", (1, 1), 2),
                 ("module.storage_rack", (2, 1), 4), ("module.storage_pallet", (2, 2), 7),
                 ("module.storage_tank", (2, 2), 10), ("module.storage_cold", (2, 1), 13),
                 ("module.storage_armory", (2, 1), 16), ("module.storage_container", (2, 3), 19)],
                ("empty", "partial", "full"), (6, 2)),
}


def room(cv, P, pub, ox, oy, mods, state, crew_at, nx, ny, label):
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    draws = []
    for aid, (w, d), gx0 in mods:
        src = pub if aid == "module.storage" else P
        fx, fy = gx0 + w - 1, d - 1
        draws.append((fx + fy, lambda s=src, a=f"{aid}.{state}", p=iso(ox, oy, fx, fy): cv.static(s, a, *p)))
    cx, cy = crew_at
    pair = human(pub, 1)
    draws.append((cx + cy + 0.5, lambda p=iso(ox, oy, cx, cy): cv.put(pair[0], pair[1], p[0] - 64, p[1] - 94)))
    for _, fn in sorted(draws, key=lambda t: t[0]):
        fn()
    cv.labels.append((ox - 40, oy - 110, label))


def main():
    P, out, which = Assets(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    mods, states, crew_at = SETS[which]
    nx = max(g + w for _, (w, _), g in mods) + 1
    ny = max(d for _, (_, d), _ in mods) + 1
    W, H = (nx + ny) * 32 + 80, (nx + ny) * 16 + 170
    rooms = []
    for st in states:
        cv = Canvas(W, H)
        room(cv, P, pub, ny * 32 + 40, 140, mods, st, crew_at, nx, ny, st)
        cv.save(out / f"{which}-3x-{st}.png", 3)
        rooms.append(cv)
    one = np.vstack([c.px[..., :3] for c in rooms])
    im = Image.fromarray(one)
    dr = ImageDraw.Draw(im)
    for k, c in enumerate(rooms):
        for x, y, t in c.labels:
            dr.text((x, y + k * H), t, fill=(220, 225, 235))
    im.save(out / f"{which}-1x.png")
    print("wrote", out)


if __name__ == "__main__":
    main()
