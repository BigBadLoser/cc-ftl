"""Module pack look preview (plain python3 + numpy + PIL): one walled room per state with every module of a set in a row
along the back wall, a crew member for scale, the way the runtime draws them (glow added on top).

  python3 -I tools/blender/review/modpack_preview.py <pack assets dir> <out dir> <set>
    set: storage -> storage-1x.png (one room per fill) and storage-3x-<fill>.png
         medbay  -> medbay-1x.png and medbay-3x-{idle,active}.png (the old bed for comparison; .active: a patient lying
                    on each bed, a medic working the console)
         row <asset id> <w> <d> <state,state,...>  -> row-<asset>-3x.png: one room, the module once per state in a row
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
    draws.append((cx + cy + 0.5, lambda p=iso(ox, oy, cx, cy): cv.char(pair, *p)))
    for _, fn in sorted(draws, key=lambda t: t[0]):
        fn()
    cv.labels.append((ox - 40, oy - 110, label))


def _find(P, pub, ids):
    for aid in ids:
        for A in (P, pub):
            if aid in A.m["assets"]:
                return A, aid
    return None, None


def grid(P, pub, out, rows, cols, name, cell=(260, 230)):
    """One row per module (r0), one column per state; each cell a floor patch with walls behind and the sprite on it."""
    CW, CH = cell
    cv = Canvas(CW * len(cols) + 140, CH * len(rows))
    for i, (label, (w, d), ids_for) in enumerate(rows):
        for j, col in enumerate(cols):
            ox, oy = 140 + j * CW + CW // 2 - (w - d) * 16, i * CH + 100 - (w + d) * 8
            for gx in range(-1, w + 1):
                for gy in range(-1, d + 1):
                    cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
            for gx in range(-1, w + 1):
                cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -2))
            for gy in range(-1, d + 1):
                cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -2, gy))
            A, aid = _find(P, pub, ids_for(col))
            if A:
                cv.static(A, aid, *iso(ox, oy, w - 1, d - 1))
            if i == 0:
                cv.labels.append((140 + j * CW + CW // 2 - 30, 4, col))
        cv.labels.append((6, i * CH + CH // 2, label))
    cv.save(out / f"{name}-2x.png", 2)
    cv.save(out / f"{name}-1x.png", 1)


DMG_ROWS = [("console", (1, 1), "module.console", False), ("helm", (2, 1), "module.helm", True),
            ("weapons con.", (2, 2), "module.weapons_console", True), ("shield con.", (2, 1), "module.shield_console", True),
            ("bed", (1, 2), "module.bed", False), ("galley", (2, 1), "module.galley", True),
            ("life support", (1, 2), "module.life_support", False), ("reactor", (2, 2), "module.reactor", False),
            ("fabricator", (2, 1), "module.fabricator", True), ("light", (1, 1), "module.light", False),
            ("robot bay", (1, 2), "module.robot_bay", True), ("crate", (1, 1), "module.storage", False),
            ("locker", (1, 1), "module.storage_locker", True), ("rack", (2, 1), "module.storage_rack", True),
            ("pallet", (2, 2), "module.storage_pallet", True), ("tank", (2, 2), "module.storage_tank", True),
            ("cold", (2, 1), "module.storage_cold", True), ("armory", (2, 1), "module.storage_armory", True),
            ("container", (2, 3), "module.storage_container", True)]


def damage(P, pub, out):
    def ids(aid, rot):
        def f(col):
            stem = f"{aid}.r0" if rot else aid
            if col == "intact":
                return [stem, f"{aid}.partial", f"{stem}.partial", aid]
            return [f"{stem}.{col}"]
        return f
    rows = [(lab, fp, ids(aid, rot)) for lab, fp, aid, rot in DMG_ROWS]
    half = (len(rows) + 1) // 2
    grid(P, pub, out, rows[:half], ("intact", "damaged", "damaged.flicker", "destroyed"), "damage-a")
    grid(P, pub, out, rows[half:], ("intact", "damaged", "damaged.flicker", "destroyed"), "damage-b")


SOL_ROWS = [("engine", (4, 5), [("module.engine.hull.r0", False), ("module.engine.machine.r0", True),
                                ("module.engine.bell.r0", True)]),
            ("AI core", (2, 2), [("module.ai_core.r0", True)]),
            ("shield gen", (2, 3), [("module.shield_gen.r0", True)]),
            ("shield gen small", (2, 2), [("module.shield_gen_small.r0", True)])]


def sol(P, pub, out):
    """Sol's packs: each cell layers the parts (the engine's hull wall stays intact)."""
    cols = ("intact", "damaged", "damaged.flicker", "destroyed")
    CW, CH = 520, 420
    cv = Canvas(CW * len(cols) + 140, CH * len(SOL_ROWS))
    for i, (label, (w, d), parts) in enumerate(SOL_ROWS):
        for j, col in enumerate(cols):
            ox, oy = 140 + j * CW + CW // 2 - (w - d) * 16 - 40, i * CH + 230 - (w + d) * 8
            for gx in range(-1, w + 1):
                for gy in range(-1, d + 1):
                    cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
            for aid, dmg in parts:
                ids = [aid] if col == "intact" or not dmg else [f"{aid}.{col}", f"{aid}.damaged"]
                A, a = _find(P, pub, ids)
                if A:
                    cv.static(A, a, *iso(ox, oy, w - 1, d - 1))
            if i == 0:
                cv.labels.append((140 + j * CW + CW // 2 - 30, 4, col))
        cv.labels.append((6, i * CH + CH // 2, label))
    cv.save(out / "sol-2x.png", 2)
    cv.save(out / "sol-1x.png", 1)


def medbay(P, pub, out, face=7):
    """Bed (old), med bed, med console along the back wall; idle and active rooms."""
    nx, ny = 6, 3
    W, H = (nx + ny) * 32 + 80, (nx + ny) * 16 + 170
    rooms = []
    for st in ("idle", "active"):
        cv = Canvas(W, H)
        ox, oy = ny * 32 + 40, 140
        for gx in range(nx):
            for gy in range(ny):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
        for gx in range(nx):
            cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
        for gy in range(ny):
            cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
        on = st == "active"
        for A, aid, gx in ((pub, "module.bed", 0), (P, f"module.med_bed.{st}", 2)):
            cv.static(A, aid, *iso(ox, oy, gx, 1))
            if on:
                cv.char(human(pub, 2, "sleep", 0), *map(int, iso(ox, oy, gx, 0.5)))
        cv.static(P, f"module.med_console.{st}", *iso(ox, oy, 4, 0))
        cv.char(human(pub, face, "work" if on else "idle", 2 if on else 0), *iso(ox, oy, 4, 1))
        cv.labels.append((ox - 40, oy - 110, st))
        cv.save(out / f"medbay-3x-{st}.png", 3)
        rooms.append(cv)
    Image.fromarray(np.vstack([c.px[..., :3] for c in rooms])).save(out / "medbay-1x.png")


def row(P, pub, out, aid, fp, states):
    """One room with the module once per state along the back wall (r0), a crew member for scale."""
    w, d = fp
    nx, ny = len(states) * (w + 1) + 1, d + 2
    W, H = (nx + ny) * 32 + 80, (nx + ny) * 16 + 170
    cv = Canvas(W, H)
    ox, oy = ny * 32 + 40, 140
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    for i, st in enumerate(states):
        gx = i * (w + 1) + 1
        cv.static(P, f"{aid}.{st}", *iso(ox, oy, gx + w - 1, d - 1))
        x, y = iso(ox, oy, gx + w - 1, d - 1)
        cv.labels.append((x - 20, y + 30, st))
    cv.char(human(pub, 1), *iso(ox, oy, nx - 1, d + 1))
    cv.save(out / f"row-{aid}-3x.png", 3)
    cv.save(out / f"row-{aid}-1x.png", 1)


def main():
    P, out, which = Assets(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    if which == "row":
        row(P, pub, out, sys.argv[4], (int(sys.argv[5]), int(sys.argv[6])), sys.argv[7].split(","))
        print("wrote", out)
        return
    if which == "medbay":
        medbay(P, pub, out, int(sys.argv[4]) if len(sys.argv) > 4 else 7)
        print("wrote", out)
        return
    if which in ("damage", "sol"):
        (damage if which == "damage" else sol)(P, pub, out)
        print("wrote", out)
        return
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
