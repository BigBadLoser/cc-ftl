"""Robot bay look preview (plain python3 + numpy + PIL): the bay sprites in a walled room with a human and docked
robots, composited the way the runtime layers them (depth by tile, crew over a module on the same tile).

  python3 -I tools/blender/review/robot_bay_preview.py <bay assets dir> <robot assets dir> <out dir>
    -> robot-bay-1x.png / -3x.png;  add `anim` for robot-bay-anim-3x.mp4 (assembly loop, charge clip, contact pulse)
Row 1: rotation 2 (the tower behind the robot) in every state (empty, a walker charging, the heavy charging, the drone in its clamp, assembling each
type). Row 2: rotations 0, 1 and 3, empty and with a worker charging. Robots come from the robot assets dir (crew layers)."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import DIRS, Assets, Canvas, human, iso, robot  # noqa: E402

FACE = {0: 6, 1: 0, 2: 2, 3: 4}
CRADLE = {0: (0, -1), 1: (0, 0), 2: (0, 0), 3: (-1, 0)}     # cradle tile relative to the sprite's front-most tile


def scene(bay, rob, pub, out, n=None):
    """The room; with n (a 100 ms tick) it is one animation frame: assembly loop at 8 fps, robots' charge clip at
    3 fps, charging contacts pulsing as the renderer will (glow x 0.55..1, 1.6 s period). Returns the canvas."""
    nx, ny = 15, 9
    cv = Canvas(760, 470)
    ox, oy = 300, 70
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    draw = []        # (depth, kind, payload, gx, gy, label)
    row0 = [("", None), ("charging", ("worker", "charge", 3)), ("charging", ("security", "charge", 3)),
            ("charging.drone", ("repair", "charge", 3)), ("assembling.worker", None), ("assembling.repair", None),
            ("assembling.security", None)]
    tick = n or 0
    work, charge = f".f{(tick * 8 // 10) % 6}", (tick * 3 // 10) % 4
    pulse = 0.775 + 0.225 * math.sin(math.tau * tick / 16) if n is not None else 1.0
    row0 = [(st + work if st.startswith("assembling") else st, (b[0], b[1], charge) if b and b[1] == "charge" else b)
            for st, b in row0]
    for k, (st, bot) in enumerate(row0):                  # r2: the tower stands behind the robot
        _bay(draw, 2, st, bot, 1 + 2 * k, 2, st or "empty")
    for k, (rot, st, bot) in enumerate([(0, "", None), (0, "charging", ("worker", "charge", charge)), (1, "", None),
                                        (1, "charging", ("worker", "charge", charge)), (3, "", None),
                                        (3, "charging", ("worker", "charge", charge))]):
        _bay(draw, rot, st, bot, 1 + 2 * k + (1 if rot == 3 else 0), 6, f"r{rot} {st or 'empty'}")
    draw.append((13 + 3 + 0.02, "human", None, 13, 3, "human"))
    for depth, kind, pay, gx, gy, label in sorted(draw, key=lambda d: d[0]):
        sx, sy = iso(ox, oy, gx, gy)
        if kind in ("bay", "front") and pay in bay.m["assets"]:
            img, g, an = bay.static(pay)
            cv.put(img, g, sx - an["x"], sy - an["y"], pulse if ".charging" in pay else 1.0)
        elif kind == "human":
            cv.char(human(pub, DIRS["SE"]), sx, sy)
        else:
            cv.char(robot(rob, *pay), sx, sy)
        if label and n is None:
            cv.labels.append((sx - 22, sy + 14, label))
    if n is None:
        for s in (1, 3):
            cv.save(out / f"robot-bay-{s}x.png", s)
    return cv


def anim(bay, rob, pub, out):
    """robot-bay-anim-3x.mp4: the room cropped to the rotation-2 row and the front row, 4.8 s, 3x."""
    from PIL import Image
    from robots_preview import mp4
    frames = []
    for n in range(48):
        cv = scene(bay, rob, pub, out, n)
        im = Image.fromarray(cv.px[20:330, 150:760, :3])
        frames.append(im.resize((im.width * 3, im.height * 3), Image.NEAREST))
    mp4(frames, out / "robot-bay-anim-3x.mp4", loops=2)


def _bay(draw, rot, st, bot, gx, gy, label):
    """A bay whose front-most tile is (gx, gy), layered as the runtime will: bay at K, its docked robot (on the cradle
    tile) at K + 0.02, the bay's front overlay at K + 0.03."""
    sid = f"module.robot_bay.r{rot}" + (f".{st}" if st else "")
    k = gx + gy
    draw.append((k, "bay", sid, gx, gy, label))
    if bot:
        cx, cy = gx + CRADLE[rot][0], gy + CRADLE[rot][1]
        kind, clip, i = bot
        draw.append((k + 0.02, "robot", (kind, FACE[rot], clip, i), cx, cy, None))
        draw.append((k + 0.03, "front", sid + ".front", gx, gy, None))


def main():
    bay, rob, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    pub = Assets(Path(__file__).resolve().parents[3] / "public/assets")
    scene(bay, rob, pub, out)
    if len(sys.argv) > 4 and sys.argv[4] == "anim":
        anim(bay, rob, pub, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
