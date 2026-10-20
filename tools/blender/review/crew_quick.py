"""Quick crew look check (about a minute): one outfit (QUICK_OUTFIT: comma-separated layer ids), a few directions and
frames (QUICK_FRAMES), through the real layer render, then old vs new composited like the runtime crew filter on floor
tiles with a wall behind, at 1x and 4x. For iterating on the base; the full sheets come from
`npm run sprites -- -- <dir> crew`.

  CREW_BASE=v2 blender -b --factory-startup --python tools/blender/review/crew_quick.py -- <raw.npz>    (render)
  python3 -I tools/blender/review/crew_quick.py <raw.npz> <out.png>                                    (composite)"""
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
OUTFIT = __import__("os").environ.get(
    "QUICK_OUTFIT", "body,eyes.organic,legs.cargo_pants,torso.work_shirt,arm.L.flesh,arm.R.flesh,hair.short").split(",")
DIRS = (0, 1, 2, 4)                                              # SE, S, SW, NW
FRAMES = [tuple(f.split(":")) for f in __import__("os").environ.get("QUICK_FRAMES", "idle:0,walk:2").split(",")]


def render(out):
    from sprites import crew_clips as clips
    from sprites import human_items as hi
    from sprites import human_render as hr
    arm, items = hi.build_items()
    want = [k for k, it in enumerate(items) if any(it.id == "crew.human." + o for o in OUTFIT)]
    arrays = {}
    for clip, i in FRAMES:
        name, f = next((n, f) for c, j, n, f in clips.clip_frames() if (c, j) == (clip, int(i)))
        for d in DIRS:
            arm.rotation_euler = (0, 0, math.radians(hr.THETA[d]))
            hr.pose_frame(arm, clip, int(i), name, f)
            head = hr.head_px(arm)
            for k in want:
                rgba, _ = hr.render_item(items[k], items, head)
                arrays[f"{items[k].id[len('crew.human.'):]}|{d}|{items[k].order}|{clip}|{i}"] = rgba
    np.savez_compressed(out, **arrays)
    print("WROTE", out, len(arrays))


def composite(raw, out):
    from PIL import Image
    from sprites import compose
    sys.path.insert(0, str(ROOT / "tools/blender/review"))
    from crew_compare import Assets
    pub = Assets(ROOT / "public/assets")
    z = np.load(raw)
    new = {}
    for key in z.files:
        lid, d, order, clip, i = key.split("|")
        new.setdefault((int(d), clip, int(i)), []).append((int(order), z[key]))
    frames = sorted({(c, i) for _, c, i in new}, key=lambda f: f[0] != "idle")

    def new_crew(d, pal, clip, i):
        cv = np.zeros((120, 128, 4), np.uint8)
        for _, img in sorted(new[(d, clip, i)], key=lambda t: t[0]):
            compose.over(cv, compose.remap_keys(img, pal), 0, 0)
        return cv

    floor, fan = pub.static("tile.floor.a")
    wall, wan = pub.static("tile.wall.full.m10")
    rows = []
    for clip, i in frames:
        rows.append(_row(pub, new_crew, clip, i, floor, fan, wall, wan))
    one = np.vstack(rows)
    im = Image.fromarray(one)
    big = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
    sheet = Image.new("RGB", (im.width + 4 + big.width, max(im.height, big.height)), (10, 12, 18))
    sheet.paste(im, (0, 0))
    sheet.paste(big, (im.width + 4, 0))
    sheet.save(out)
    print("wrote", out)


def _row(pub, new_crew, clip, i, floor, fan, wall, wan):
    from sprites import compose
    from crew_compare import CREWS, crew, iso
    panels = []
    for label, make in (("old", lambda d, p: crew(pub, OUTFIT + ["gear.belt.tool_belt"], p, d, clip, i, False)),
                        ("new", lambda d, p: _outline(new_crew(d, p, clip, i)))):
        cv = np.zeros((175, 300, 4), np.uint8)
        cv[..., :3], cv[..., 3] = (10, 12, 18), 255
        ox, oy = 150, 62
        for y in range(3):
            for x in range(6):
                sx, sy = iso(ox, oy, x - 1, y)
                compose.over(cv, floor, sx - fan["x"], sy - fan["y"])
        for x in range(-1, 5):
            sx, sy = iso(ox, oy, x, 0)
            compose.over(cv, wall, sx - wan["x"], sy - wan["y"] - 16)
        for k, d in enumerate(DIRS):
            sx, sy = iso(ox, oy, k, 1.6 - k * 0.35)
            compose.over(cv, make(d, CREWS[k % len(CREWS)]), int(sx) - 64, int(sy) - 94)
        panels.append(cv[..., :3])
    return np.hstack([panels[0], np.zeros((175, 4, 3), np.uint8), panels[1]])


def _outline(cv):
    from crew_compare import SHIFT
    rgb, op = cv[..., :3].astype(float), cv[..., 3] >= 128
    cnt, ns = np.zeros(op.shape), np.zeros(rgb.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = SHIFT(op, dy, dx)
        ns += SHIFT(rgb, dy, dx) * o[..., None]
        cnt += o
    ring = ~op & (cnt > 0)
    rgb[ring] = (ns / np.maximum(cnt, 1)[..., None])[ring] * 0.42 + np.array([4, 5, 10.0])
    cv = cv.copy()
    cv[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    cv[..., 3] = (op | ring) * 255
    return cv


if "--" in sys.argv:
    render(sys.argv[sys.argv.index("--") + 1])
elif __name__ == "__main__":
    composite(sys.argv[1], sys.argv[2])
