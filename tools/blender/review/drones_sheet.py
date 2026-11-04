"""Drone family review (plain python3 + numpy + PIL): the built `drones` sprites (drone_family.py) as the game would draw
them, on floor tiles with walls and a crew member for scale, at 1x and a 3x nearest zoom.
  python3 -I tools/blender/review/drones_sheet.py <drones build outdir> <out dir>
    -> fleet-1x/3x.png: each type at all 8 headings flying (lifted ALT over its shadow), then working f0/f1, inert, and
       the medic's beam layer
       bay-1x/3x.png: the bay powered and empty, charging with 2 docked, unpowered with 1 docked (drones drawn between
       the bay and its .front, as the game does), and the roof hatch stowed and f0..f4
Partial alpha (the beam, the shadow) blends as the runtime does; glow adds."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import robots_preview as rp  # noqa: E402
from drones_composite import ALT, LIV, ROOT, ZPX, Pub, crew, room  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose  # noqa: E402

PADS, DOCK_DZ = (0.34, 1.36), 0.23        # drones.PADS, drones.DOCK_DZ
DOCK_PX = [(0, round(-16 - (z + DOCK_DZ) * ZPX)) for z in PADS]   # drone_family.DOCK_PX: from the module anchor


def draw(cv, built, aid, sx, sy, lift=0.0, keyed=False):
    """Blend a static sprite (partial alpha honoured) with its anchor at (sx, sy - lift)."""
    img, g, an = built.static(aid)
    if keyed:
        img = compose.remap_keys(img, LIV)
    x0, y0 = int(sx) - an["x"], int(round(sy - lift)) - an["y"]
    H, W = cv.px.shape[:2]
    cx0, cy0 = max(0, -x0), max(0, -y0)                  # clip to the canvas
    img = img[cy0:H - y0, cx0:W - x0]
    g = None if g is None else g[cy0:H - y0, cx0:W - x0]
    x0, y0 = x0 + cx0, y0 + cy0
    h, w = img.shape[:2]
    reg = cv.px[y0:y0 + h, x0:x0 + w, :3].astype(float)
    a = img[..., 3:4] / 255.0
    out = reg * (1 - a) + img[..., :3] * a
    if g is not None:
        out += g[..., :3].astype(float) * (g[..., 3:4] > 0)
    cv.px[y0:y0 + h, x0:x0 + w, :3] = np.clip(out, 0, 255).astype(np.uint8)


def fleet(pub, built, out):
    """Screen rows (not grid rows, so the headings line up for comparison) over a floor."""
    nx, ny = 14, 14
    ox, oy = ny * 32 + 30, 60
    W, H = (nx + ny) * 32 + 60, (nx + ny) * 16 + 120
    cv = rp.Canvas(W, H)
    rp.floor(cv, pub, ox, oy, nx, ny)
    lift = ALT * ZPX
    x0, dx, y0, dy = 190, 92, 150, 78
    for k, kind in enumerate(("defence", "repair", "medic")):
        rows = ([(f"fly.d{d}", "fly") for d in range(8)],
                [("work.d1.f0", "work"), ("work.d1.f1", "work"), ("work.d6.f0", "work"), ("work.d6.f1", "work"),
                 ("inert.d1", "inert"), ("inert.d6", "inert"), ("docked.d1", "docked")])
        for i, row in enumerate(rows):
            y = y0 + (2 * k + i) * dy
            cv.labels.append((8, y - 30, f"{kind} {'fly' if i == 0 else 'work / inert / docked'}"))
            for j, (tag, st) in enumerate(row):
                x = x0 + j * dx
                if st in ("fly", "work"):
                    draw(cv, built, "drone.shadow", x, y)
                draw(cv, built, f"drone.{kind}.{tag}", x, y, lift if st in ("fly", "work") else 0, keyed=True)
                if kind == "medic" and st == "work":
                    draw(cv, built, f"drone.medic.work.beam.{tag.split('.')[1]}", x, y, lift)
                cv.labels.append((x - 22, y + 12, tag))
    crew(cv, pub, x0 + 8 * dx, y0 + 5 * dy)
    cv.save(out / "fleet-1x.png", 1)
    cv.save(out / "fleet-3x.png", 3)


def bay(pub, built, out):
    nx, ny = 12, 4
    ox, oy = ny * 32 + 30, 160
    cv = room(pub, nx, ny, (nx + ny) * 32 + 60, (nx + ny) * 16 + 470, ox, oy)
    setups = (("", (), "powered, empty"), ("charging", ("defence", "repair"), "charging, 2 docked"),
              ("unpowered", ("medic",), "unpowered, 1 docked"))
    for i, (state, docked, label) in enumerate(setups):
        gx = 1 + i * 4                                     # tiles gx..gx+1, 1..2: the anchor is the front-most tile
        ax, ay = rp.iso(ox, oy, gx + 1, 2)
        base = "module.drone_bay.r0" + (f".{state}" if state else "")
        draw(cv, built, base, ax, ay)
        pads = dict(zip((1, 0), docked))                 # docked = (top, lower): the top cradle fills first
        for p, kind in sorted(pads.items()):             # the lower drone draws first
            dx, dy = DOCK_PX[p]
            draw(cv, built, f"drone.{kind}.docked.d1", ax + dx, ay + dy, keyed=True)
        if docked:
            draw(cv, built, base + ".front", ax, ay)
        cv.labels.append((int(ax) - 40, int(ay) + 22, label))
    crew(cv, pub, *rp.iso(ox, oy, 3.6, 3))
    # The roof hatch frames, on a strip of dark under the room.
    y0 = (nx + ny) * 16 + 200
    for j, tag in enumerate(("stowed",) + tuple(f"f{f}" for f in range(5))):
        x, y = 110 + (j % 3) * 170, y0 + 50 + (j // 3) * 120
        draw(cv, built, f"module.drone_bay.hatch.{tag}", x, y)
        cv.labels.append((x - 20, y - 50, f"hatch.{tag}"))
    cv.save(out / "bay-1x.png", 1)
    cv.save(out / "bay-3x.png", 3)


if __name__ == "__main__":
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    pub = Pub(ROOT / "public/assets/1x")
    built = rp.Assets(src)
    fleet(pub, built, dst)
    bay(pub, built, dst)
    print("wrote", dst)
