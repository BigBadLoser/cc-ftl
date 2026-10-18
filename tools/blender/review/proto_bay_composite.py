"""Composite the shuttle bay prototype (proto_bay.py's .npz) into review images: the bay with the parked shuttle in a room
(full-height back walls, cutaway front walls, a door, crew for scale) at 1x and 3x, the hatch frames, the launch frames,
the flight directions, and a side-by-side with a reference crop. Plain python (numpy + PIL), no Blender.
  python3 tools/blender/review/proto_bay_composite.py <work dir> <walls build dir> <out dir> [reference crop png]
The walls build dir is an env_build.build() output (assets.json + sprites/env.png) with the current wall pieces."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
AS = ROOT / "public/assets"
D, WD, OUTD = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
REF = Path(sys.argv[4]) if len(sys.argv) > 4 else None
MAN = json.loads((AS / "manifest.json").read_text())
WA = json.loads((WD / "assets.json").read_text())
WATLAS = np.array(Image.open(WD / "sprites/env.png").convert("RGBA"))
WGLOW = np.array(Image.open(WD / "sprites/env.glow.png").convert("RGBA"))
BG = (10, 14, 22)


class Scene:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), np.uint8)
        self.px[..., :3], self.px[..., 3] = BG, 255

    def put(self, rgba, glow, x, y):
        compose.over(self.px, rgba, int(x), int(y))
        if glow is not None:
            compose.add(self.px, glow, int(x), int(y))

    def asset(self, aid, cx, cy):
        a = WA[aid]
        f, an = a["frame"], a["anchor"]
        sl = (slice(f["y"], f["y"] + f["h"]), slice(f["x"], f["x"] + f["w"]))
        self.put(WATLAS[sl], WGLOW[sl] if a.get("glow") else None, cx - an["x"], cy - an["y"])

    def sprite(self, tag, cx, cy):
        z = np.load(D / f"{tag}.npz")
        self.put(z["rgba"], z["glow"], cx - int(z["ox"]), cy - int(z["oy"]))

    def image(self):
        return Image.fromarray(self.px[..., :3].copy())


def crew(sc, cx, cy, d=0, cloth=(114, 132, 95)):
    parts = ["body", "legs.cargo_pants", "gear.belt.tool_belt", "eyes.organic", "hair.short", "arm.L.flesh", "arm.R.flesh", "torso.work_shirt"]
    cols = {"team.skin": (212, 156, 116), "team.hair": (70, 48, 34), "team.cloth": cloth, "team.accent": (200, 150, 40)}
    arr, an = None, None
    for a in sorted((MAN["assets"][f"crew.human.{p}"] for p in parts), key=lambda a: a["order"]):
        sh = np.array(Image.open(AS / MAN["sheets"][a["sheet"]]["image"]).convert("RGBA"))
        c, fw, fh = a["clips"]["idle"], a["frameW"], a["frameH"]
        if arr is None:
            arr = np.zeros((fh, fw, 4), np.uint8)
        sl = sh[d * fh:(d + 1) * fh, c["start"] * fw:(c["start"] + 1) * fw]
        compose.over(arr, compose.remap_keys(sl, cols), 0, 0)
        an = a["anchor"]
    sc.put(arr, None, cx - an["x"], cy - an["y"])


def depth_sort(items):
    """items: (x0, x1, y0, y1, draw). A is behind B when A ends before B starts on x or y (grid +x/+y point at the camera)."""
    out, rest = [], list(items)
    while rest:
        for a in rest:
            if not any(b is not a and (b[1] <= a[0] + 1e-6 or b[3] <= a[2] + 1e-6) and not (a[1] <= b[0] + 1e-6 or a[3] <= b[2] + 1e-6)
                       for b in rest):
                out.append(a)
                rest.remove(a)
                break
        else:
            rest.sort(key=lambda t: t[1] + t[3])
            out.append(rest.pop(0))
    return out


def trim(img, pad=8):
    a = np.abs(np.asarray(img).astype(np.int32) - np.array(BG)).sum(2) > 6
    ys, xs = np.where(a)
    return img.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, img.width), min(ys.max() + pad + 1, img.height)))


def zoom(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def label(img, text):
    out = Image.new("RGB", (img.width, img.height + 18), BG)
    out.paste(img, (0, 18))
    ImageDraw.Draw(out).text((4, 3), text, fill=(150, 168, 186))
    return out


def row(ims, gap=10):
    h = max(i.height for i in ims)
    out = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), h), BG)
    x = 0
    for im in ims:
        out.paste(im, (x, h - im.height))
        x += im.width + gap
    return out


# room: interior x 0..5, y 0..6 (the bay is tiles x 0..3, y 0..4, r0), wall ring at x -1 / 6, y -1 / 7
X0, X1, Y0, Y1 = -1, 6, -1, 7
DOOR = (5, -1)


def ring(x, y):
    return (x in (X0, X1) and Y0 <= y <= Y1) or (y in (Y0, Y1) and X0 <= x <= X1)


def room(bay_tag, shuttle_tag=None, crew_on=True, close=False):
    sc = Scene(760, 560)
    T = lambda x, y: (360 + (x - y) * 32, 200 + (x + y) * 16)  # noqa: E731
    for x in range(X0 + 1, X1):
        for y in range(Y0 + 1, Y1):
            sc.asset("tile.floor.a", *T(x, y))
    sc.sprite(bay_tag, *T(3, 4))                                       # floor-level pad: right after the floor
    if shuttle_tag:                                                    # parked craft is below the deck (cut by the coaming)
        sc.sprite(shuttle_tag, *T(3, 4))
    items = []
    for x in range(X0, X1 + 1):
        for y in range(Y0, Y1 + 1):
            if not ring(x, y):
                continue
            m = (1 if ring(x, y - 1) else 0) | (2 if ring(x + 1, y) else 0) | (4 if ring(x, y + 1) else 0) | (8 if ring(x - 1, y) else 0)
            back = x == X0 or y == Y0
            aid = "tile.door.x" if (x, y) == DOOR else f"tile.wall.{'full.' if back else ''}m{m}"
            items.append((x - .5, x + .5, y - .5, y + .5, lambda aid=aid, x=x, y=y: sc.asset(aid, *T(x, y))))
    if crew_on:
        for x, y, d, cl in ((3.05, 2.0, 6, (114, 132, 95)), (4.6, 3.6, 1, (170, 70, 90)), (1.4, 5.7, 0, (90, 110, 160))):
            items.append((x - .2, x + .2, y - .2, y + .2, lambda x=x, y=y, d=d, cl=cl: crew(sc, *T(x, y), d=d, cloth=cl)))
    for it in depth_sort(items):
        it[4]()
    if close:                                                          # close-up box round the bay (+ a wall's height above)
        cx, cy = T(1.5, 2.0)
        return sc.image().crop((cx - 170, cy - 150, cx + 170, cy + 80))
    return trim(sc.image())


def alone(tags, labels, pad_tag=None):
    ims = []
    for tag, lab in zip(tags, labels):
        sc = Scene(520, 420)
        T = lambda x, y: (260 + (x - y) * 32, 170 + (x + y) * 16)  # noqa: E731
        for x in range(-1, 5):
            for y in range(-1, 6):
                sc.asset("tile.floor.a", *T(x, y))
        if pad_tag:
            sc.sprite(pad_tag, *T(3, 4))
        sc.sprite(tag, *T(3, 4))
        ims.append(label(trim(sc.image(), 4), lab))
    return row(ims)


def flyers(ds):
    ims = []
    for d in ds:
        sc = Scene(300, 300)
        sc.sprite(f"shuttle_fly_d{d}", 150, 150)
        ims.append(label(trim(sc.image(), 6), f"fly d{d}"))
    return row(ims)


def main():
    OUTD.mkdir(parents=True, exist_ok=True)
    V = sys.argv[5] if len(sys.argv) > 5 else "v1"
    if (D / "shuttle_parked_r0.npz").exists():
        im = room("bay_r0_t0", "shuttle_parked_r0")
        im.save(OUTD / f"bay_room_r0_{V}_1x.png")
        zoom(im).save(OUTD / f"bay_room_r0_{V}_3x.png")
        e = room("bay_r0_t0", None)
        e.save(OUTD / f"bay_room_empty_r0_{V}_1x.png")
        zoom(e).save(OUTD / f"bay_room_empty_r0_{V}_3x.png")
        if REF and REF.exists():
            ref = Image.open(REF).convert("RGB")
            a = zoom(room("bay_r0_t0", "shuttle_parked_r0", close=True), 3)
            ref = ref.resize((int(ref.width * a.height / ref.height), a.height), Image.NEAREST)
            sbs = Image.new("RGB", (a.width + ref.width + 10, a.height), (255, 255, 255))
            sbs.paste(a, (0, 0))
            sbs.paste(ref, (a.width + 10, 0))
            sbs.save(OUTD / f"bay_vs_ref_{V}.png")
    frames = [t for t in ("t0", "t33", "t66", "t100") if (D / f"bay_r0_{t}.npz").exists()]
    if frames:
        r = alone([f"bay_r0_{t}" for t in frames], [f"hatch {t}" for t in frames])
        r.save(OUTD / f"bay_hatch_frames_{V}_1x.png")
        zoom(r).save(OUTD / f"bay_hatch_frames_{V}_3x.png")
    lt = [k for k in range(3) if (D / f"shuttle_launch_{k}.npz").exists()]
    if lt:
        r = row([alone([f"shuttle_launch_{lt[0]}"], ["launch hover"], "bay_r0_t0")] +
                [alone([f"shuttle_launch_{k}"], [f"launch sink {k}"], "bay_r0_t100") for k in lt[1:]])
        r.save(OUTD / f"bay_launch_{V}_1x.png")
        zoom(r).save(OUTD / f"bay_launch_{V}_3x.png")
    ds = [d for d in range(8) if (D / f"shuttle_fly_d{d}.npz").exists()]
    if ds:
        r = flyers(ds)
        r.save(OUTD / f"shuttle_fly_{V}_1x.png")
        zoom(r).save(OUTD / f"shuttle_fly_{V}_3x.png")
    rots = [k for k in range(1, 4) if (D / f"bay_r{k}_t0.npz").exists() and (D / f"shuttle_parked_r{k}.npz").exists()]
    if rots:
        ims = []
        for k in [0] + rots:
            sc = Scene(560, 440)
            sc.sprite(f"bay_r{k}_t0", 300, 300)
            sc.sprite(f"shuttle_parked_r{k}", 300, 300)
            ims.append(label(trim(sc.image(), 4), f"r{k}"))
        r = row(ims)
        r.save(OUTD / f"bay_rots_{V}_1x.png")
        zoom(r).save(OUTD / f"bay_rots_{V}_3x.png")


main()
