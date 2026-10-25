"""Robot crew look preview (plain python3 + numpy + PIL): composites robot layer sheets the way the runtime does
(palette swap, additive glow, one composite outline + cool rim) next to a human crew member, on floor tiles with walls.

  python3 -I tools/blender/review/robots_preview.py <robot assets dir> <out dir>
    -> robots-scene-1x.png / -3x.png (a room: human, both factions, charging, wrecked)
       robots-poses-1x.png / -3x.png (per type: idle, walk, charge in SE, SW, NW; work and wreck in SE)
  python3 -I tools/blender/review/robots_preview.py <ROBOT_REST assets dir> <out dir> shapes [shape render dir]
    -> robots-shapes-1x.png / -3x.png (rest pose, 8 directions) and robots-shapes-blender.png
  python3 -I tools/blender/review/robots_preview.py <ROBOT_ANIM assets dir> <out dir> anim
    -> robots-anim-{player,rogue}-3x.gif and .mp4 (every clip facing SE, at the clip fps)
The human comes from public/assets/1x. Rogue robots: crimson livery, and the cyan visor recoloured red."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
from sprites import compose  # noqa: E402

BG = (14, 17, 22)
OUTLINE_MUL, OUTLINE_ADD = 0.42, np.array([4, 5, 10.0])
RIM, RIM_MIX = np.array([120, 205, 255.0]), 0.38
HUMAN = {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)}
HUMAN_LAYERS = ["body", "legs.cargo_pants", "gear.belt.tool_belt", "eyes.organic", "hair.short", "arm.L.flesh",
                "arm.R.flesh", "torso.tee"]
LIVERY = {"player": {"team.cloth": (186, 182, 166), "team.accent": (205, 140, 40)},
          "rogue": {"team.cloth": (132, 38, 42), "team.accent": (44, 44, 52)}}
TYPES = [("worker", "crew.robot.body.worker"), ("repair", "crew.robot.body.repair"),
         ("security", "crew.robot_heavy.body.security")]
DIRS = {"SE": 0, "S": 1, "SW": 2, "NW": 4}
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731


class Assets:
    def __init__(self, d):
        self.d = Path(d)
        self.m = json.loads((self.d / "manifest.json").read_text())
        self._img = {}

    def img(self, rel):
        if rel not in self._img:
            self._img[rel] = np.array(Image.open(self.d / rel).convert("RGBA"))
        return self._img[rel]

    def frame(self, aid, d, clip, i):
        a = self.m["assets"][aid]
        sh = self.m["sheets"][a["clips"][clip].get("sheet", a.get("sheet"))]
        col = a["clips"][clip]["start"] + i
        fw, fh = a["frameW"], a["frameH"]
        sl = (slice(d * fh, (d + 1) * fh), slice(col * fw, (col + 1) * fw))
        g = self.img(sh["glow"])[sl] if "glow" in sh else None
        return self.img(sh["image"])[sl], g, a["anchor"]

    def static(self, aid):
        a = self.m["assets"][aid]
        f = a["frame"]
        sh = self.m["sheets"][a["sheet"]]
        cut = lambda im: im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]]  # noqa: E731
        return cut(self.img(sh["image"])), cut(self.img(sh["glow"])) if "glow" in sh else None, a["anchor"]


def rogue_eyes(img):
    """Cyan visor -> red (the rogue AI's eye colour), on base and glow pixels alike."""
    out = img.copy()
    r, g, b = (img[..., k].astype(int) for k in range(3))
    m = (img[..., 3] > 0) & (b > 120) & (g > 100) & (b - r > 60)
    out[..., 0][m], out[..., 1][m], out[..., 2][m] = b[m], (r[m] * 0.4).astype(int), (r[m] * 0.4).astype(int)
    return out


def outline_rim(cv):
    rgb, op = cv[..., :3].astype(float), cv[..., 3] >= 128
    cnt, ns = np.zeros(op.shape), np.zeros(rgb.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = SHIFT(op, dy, dx)
        ns += SHIFT(rgb, dy, dx) * o[..., None]
        cnt += o
    ring = ~op & (cnt > 0)
    out = rgb.copy()
    rim = op & ~SHIFT(op, 0, 1) & SHIFT(op, 0, -1)
    out[rim] = out[rim] * (1 - RIM_MIX) + RIM * RIM_MIX
    out[ring] = (ns / np.maximum(cnt, 1)[..., None])[ring] * OUTLINE_MUL + OUTLINE_ADD
    res = np.zeros_like(cv)
    res[..., :3], res[..., 3] = np.clip(out, 0, 255).astype(np.uint8), (op | ring) * 255
    return res


def character(lay, frames, colours, rogue=False):
    """Stack layer frames [(rgba, glow, anchor)] on a 160x160 canvas, feet at (80, 130) -> (rgba, glow)."""
    cv = np.zeros((160, 160, 4), np.uint8)
    gl = np.zeros_like(cv)
    for img, g, an in frames:
        x, y = 80 - an["x"], 130 - an["y"]
        im = compose.remap_keys(img, colours)
        if rogue:
            im, g = rogue_eyes(im), rogue_eyes(g) if g is not None else None
        compose.over(cv, im, x, y)
        if g is not None:
            compose.over(gl, g, x, y)
    return outline_rim(cv), gl


def human(pub, d, clip="idle", i=0):
    a = pub.m["assets"]
    ids = sorted(HUMAN_LAYERS, key=lambda k: a["crew.human." + k]["order"])
    return character(None, [pub.frame("crew.human." + k, d, clip, i) for k in ids], HUMAN)


def robot(rob, kind, d, clip, i=0, faction="player"):
    aid = dict(TYPES)[kind]
    return character(None, [rob.frame(aid, d, clip, i)], LIVERY[faction], faction == "rogue")


class Canvas:
    def __init__(self, w, h):
        self.px = np.zeros((h, w, 4), np.uint8)
        self.px[..., :3], self.px[..., 3] = BG, 255
        self.labels = []

    def put(self, rgba, glow, x, y, gain=1.0):          # runtime: glow sprites blend 'add' at full strength
        compose.over(self.px, rgba, x, y)
        if glow is not None:
            compose.add(self.px, glow, x, y, gain)

    def static(self, pub, aid, sx, sy):
        img, g, an = pub.static(aid)
        self.put(img, g, sx - an["x"], sy - an["y"], 1.0)

    def char(self, pair, sx, sy):
        self.put(pair[0], pair[1], sx - 80, sy - 130)

    def save(self, path, scale):
        im = Image.fromarray(self.px[..., :3])
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        dr = ImageDraw.Draw(im)
        for x, y, t in self.labels:
            dr.text((x * scale, y * scale), t, fill=(220, 225, 235))
        im.save(path)


def iso(ox, oy, gx, gy):
    return ox + (gx - gy) * 32, oy + (gx + gy) * 16


def floor(cv, pub, ox, oy, nx, ny):
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))


def scene(pub, rob, out):
    """A 9x4 room: back walls on the far edges, the human with both factions' robots, one charging, one wrecked."""
    nx, ny = 10, 5
    cv = Canvas(560, 290)
    ox, oy = 190, 80
    floor(cv, pub, ox, oy, nx, ny)
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    cast = [  # (gx, gy, pair, label): two rows across the screen, 64 px apart
        (1, 4, human(pub, 0), "human"),
        (2, 3, robot(rob, "worker", DIRS["SE"], "idle"), "worker"),
        (3, 2, robot(rob, "repair", DIRS["SE"], "idle"), "repair"),
        (4, 1, robot(rob, "security", DIRS["SE"], "idle"), "security"),
        (5, 4, robot(rob, "worker", DIRS["SE"], "charge", 3), "charging"),
        (6, 3, robot(rob, "worker", DIRS["SW"], "wreck"), "wrecked"),
        (7, 2, robot(rob, "worker", DIRS["SW"], "walk", 2, "rogue"), "rogue"),
        (8, 1, robot(rob, "repair", DIRS["SW"], "walk", 2, "rogue"), "rogue"),
        (9, 0, robot(rob, "security", DIRS["SW"], "idle", 0, "rogue"), "rogue"),
    ]
    for gx, gy, pair, label in sorted(cast, key=lambda c: c[0] + c[1]):
        sx, sy = iso(ox, oy, gx, gy)
        cv.char(pair, sx, sy)
    for gx, gy, _, label in cast:
        sx, sy = iso(ox, oy, gx, gy)
        cv.labels.append((sx - 14, sy + 10, label))
    for s in (1, 3):
        cv.save(out / f"robots-scene-{s}x.png", s)


POSES = [("SE", "idle", 0), ("SE", "walk", 2), ("SE", "charge", 3), ("SW", "idle", 0), ("SW", "walk", 2),
         ("SW", "charge", 3), ("NW", "idle", 0), ("NW", "walk", 2), ("NW", "charge", 3), ("SE", "work", 3),
         ("SE", "wreck", 0)]


def poses(pub, rob, out):
    cw, ch = 76, 92
    cv = Canvas(cw * (len(POSES) + 1), ch * len(TYPES) + 14)
    for r, (kind, _) in enumerate(TYPES):
        y0 = 14 + r * ch
        for c in range(len(POSES) + 1):
            x0 = c * cw
            sub = Canvas(cw, ch)
            for gx in (-1, 0, 1):
                for gy in (-1, 0, 1):
                    sub.static(pub, "tile.floor.a", cw // 2 + (gx - gy) * 32, ch - 18 + (gx + gy) * 16)
            if c == 0:
                sub.char(human(pub, 0), cw // 2, ch - 18)
            else:
                dn, clip, i = POSES[c - 1]
                sub.char(robot(rob, kind, DIRS[dn], clip, i), cw // 2, ch - 18)
            cv.px[y0:y0 + ch, x0:x0 + cw] = sub.px
            if r == 0:
                cv.labels.append((x0 + 2, 2, "human" if c == 0 else f"{POSES[c - 1][0]} {POSES[c - 1][1]}"))
    for s in (1, 3):
        cv.save(out / f"robots-poses-{s}x.png", s)


DIR8 = ["SE", "S", "SW", "W", "NW", "N", "NE", "E"]


def shapes(pub, rob, out, big):
    """Rest-pose shape review (ROBOT_REST sheets): per type, a human then the robot in all 8 directions, 1x and 3x;
    plus the 4x Blender shape renders (robots_shapes.py) on one sheet when `big` holds them."""
    cw, ch = 64, 86
    cv = Canvas(cw * 9, ch * len(TYPES) + 14)
    for r, (kind, _) in enumerate(TYPES):
        y0 = 14 + r * ch
        for c in range(9):
            sub = Canvas(cw, ch)
            for gx in (-1, 0, 1):
                for gy in (-1, 0, 1):
                    sub.static(pub, "tile.floor.a", cw // 2 + (gx - gy) * 32, ch - 16 + (gx + gy) * 16)
            sub.char(human(pub, 0) if c == 0 else robot(rob, kind, c - 1, "idle"), cw // 2, ch - 16)
            cv.px[y0:y0 + ch, c * cw:(c + 1) * cw] = sub.px
            if r == 0:
                cv.labels.append((c * cw + 2, 2, "human" if c == 0 else DIR8[c - 1]))
    for s in (1, 3):
        cv.save(out / f"robots-shapes-{s}x.png", s)
    if not big or not big.exists():
        return
    names = ["SE", "S", "SW", "NW"]
    rogue = (big / "robots-shapes-worker-SE-rogue.png").exists()
    sfx = [""] + (["-rogue"] if rogue else [])
    tiles = [[np.array(Image.open(big / f"robots-shapes-{k}-{n}{x}.png").convert("RGBA")) for x in sfx for n in names]
             for k, _ in TYPES]
    names = [n + (" rogue" if x else "") for x in sfx for n in names]
    h, w = tiles[0][0].shape[:2]
    sheet = np.zeros((h * len(TYPES), w * len(names), 3), np.uint8)
    sheet[:] = (40, 46, 56)
    for r, row in enumerate(tiles):
        for c, t in enumerate(row):
            a = t[..., 3:4] / 255.0
            sl = sheet[r * h:(r + 1) * h, c * w:(c + 1) * w]
            sl[:] = (t[..., :3] * a + sl * (1 - a)).astype(np.uint8)
    im = Image.fromarray(sheet)
    dr = ImageDraw.Draw(im)
    for c, n in enumerate(names):
        dr.text((c * w + 8, 6), n, fill=(220, 225, 235))
    for r, (k, _) in enumerate(TYPES):
        dr.text((8, r * h + 22), k, fill=(220, 225, 235))
    im.save(out / "robots-shapes-blender.png")


ANIM = [("idle", 4, 4), ("walk", 8, 10), ("work", 6, 8), ("charge", 4, 3)]


def anim(pub, rob, out, faction="player"):
    """ROBOT_ANIM sheets: every type in every clip facing SE, animated at the clips' own fps, 3x GIF."""
    cw, ch = 84, 96
    frames = []
    for n in range(48):                                          # 4.8 s at 100 ms
        cv = Canvas(cw * (len(ANIM) + 1), ch * len(TYPES) + 14)
        for r, (kind, _) in enumerate(TYPES):
            for c in range(len(ANIM) + 1):
                sub = Canvas(cw, ch)
                for gx in (-1, 0, 1):
                    for gy in (-1, 0, 1):
                        sub.static(pub, "tile.floor.a", cw // 2 + (gx - gy) * 32, ch - 18 + (gx + gy) * 16)
                if c == 0:
                    sub.char(human(pub, 0, "idle", (n * 4 // 10) % 4), cw // 2, ch - 18)
                else:
                    clip, nf, fps = ANIM[c - 1]
                    sub.char(robot(rob, kind, 0, clip, (n * fps // 10) % nf, faction), cw // 2, ch - 18)
                cv.px[14 + r * ch:14 + (r + 1) * ch, c * cw:(c + 1) * cw] = sub.px
                if r == 0:
                    cv.labels.append((c * cw + 2, 2, "human" if c == 0 else ANIM[c - 1][0]))
        im = Image.fromarray(cv.px[..., :3]).resize((cv.px.shape[1] * 3, cv.px.shape[0] * 3), Image.NEAREST)
        dr = ImageDraw.Draw(im)
        for x, y, t in cv.labels:
            dr.text((x * 3, y * 3), t, fill=(220, 225, 235))
        frames.append(im)
    frames[0].save(out / f"robots-anim-{faction}-3x.gif", save_all=True, append_images=frames[1:], duration=100, loop=0)
    mp4(frames, out / f"robots-anim-{faction}-3x.mp4")


def mp4(frames, path, fps=10, loops=3):
    """H.264 video of the frames (looped a few times; some viewers only show a GIF's first frame)."""
    import subprocess
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        for k, im in enumerate(frames * loops):
            im.save(f"{d}/f{k:04d}.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", f"{d}/f%04d.png", "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-crf", "18", str(path)], check=True)


def main():
    rob = Assets(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    pub = Assets(ROOT / "public/assets/1x")
    if len(sys.argv) > 3 and sys.argv[3] == "anim":
        anim(pub, rob, out)
        anim(pub, rob, out, "rogue")
        return
    if len(sys.argv) > 3 and sys.argv[3] == "shapes":
        shapes(pub, rob, out, Path(sys.argv[4]) if len(sys.argv) > 4 else None)
        return
    scene(pub, rob, out)
    poses(pub, rob, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
