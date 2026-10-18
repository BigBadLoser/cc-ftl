"""Composite the shuttle flight preview (proto_shuttle_fly.py's .npz): 8 flying headings with engine glow, the same with glow
off, and the docked pose at 4 headings, on a space backdrop at 1x and 3x. Plain python (numpy + PIL).
  python3 tools/blender/review/proto_shuttle_fly_composite.py <work dir> <out dir>"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose  # noqa: E402

D, OUT = Path(sys.argv[1]), Path(sys.argv[2])
BG = (10, 14, 22)
NAMES = ("E (d0)", "SE (d1)", "S (d2)", "SW (d3)", "W (d4)", "NW (d5)", "N (d6)", "NE (d7)")


def cell(tag, w, h, glow=True, label=""):
    px = np.zeros((h, w, 4), np.uint8)
    px[..., :3], px[..., 3] = BG, 255
    rng = np.random.default_rng(abs(hash(tag)) % 1000)
    for _ in range(14):
        px[rng.integers(0, h), rng.integers(0, w), :3] = (70, 80, 100)
    z = np.load(D / f"{tag}.npz")
    compose.over(px, z["rgba"], w // 2 - int(z["ax"]), int(h * 0.62) - int(z["ay"]))
    if glow:
        compose.add(px, z["g"], w // 2 - int(z["ax"]), int(h * 0.62) - int(z["ay"]))
    im = Image.fromarray(px[..., :3].copy())
    ImageDraw.Draw(im).text((4, 3), label, fill=(150, 168, 186))
    return im


def grid(ims, cols):
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    out = Image.new("RGB", (w * cols, h * rows), BG)
    for i, im in enumerate(ims):
        out.paste(im, ((i % cols) * w, (i // cols) * h))
    return out


def save(im, name):
    im.save(OUT / f"{name}_1x.png")
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(OUT / f"{name}_3x.png")


OUT.mkdir(parents=True, exist_ok=True)
save(grid([cell(f"fly_d{d}", 420, 300, True, f"fly {NAMES[d]}") for d in range(8)], 4), "shuttle_fly_8dir")
save(grid([cell(f"fly_d{d}", 420, 300, False, f"no glow {NAMES[d]}") for d in (0, 2, 4, 6)], 4), "shuttle_fly_noglow")
save(grid([cell(f"docked_d{d}", 420, 300, True, f"docked, nose {NAMES[d]}") for d in (0, 2, 4, 6)], 4), "shuttle_docked_4rot")
print("ok")
