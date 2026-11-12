"""Slab study sheet (args: outdir faces.json out [design,design,...]): each scene over a floor, the crew sprite pressed into every slab face (a stand-in for the game's
shader: the crew's shading carried into the face colour, its outline cut in, a tint of the field). args: outdir faces.json out"""
import json, sys
sys.path.insert(0, "/home/user/cc-ftl/tools/blender/review")
import numpy as np
from robots_preview import ROOT, Assets, Canvas, floor, human, iso
from PIL import Image, ImageDraw
G = Assets(sys.argv[1]); pub = Assets(ROOT / "public/assets/1x"); faces = json.load(open(sys.argv[2]))
TINT = (127, 240, 255)
body = human(pub, 1)[0]
ys, xs = np.nonzero(body[..., 3]); body = body[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
HEAD = body[:int(body.shape[0] * 0.3)]                                # a drawer label: head and shoulders
ys, xs = np.nonzero(HEAD[..., 3]); HEAD = HEAD[:, xs.min():xs.max() + 1]
def coeffs(dst, w, h):
    """PIL perspective coefficients mapping output (canvas) px to input (sprite) px for quad dst."""
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float))
def press(c, quad, mask, mx, my, tint, crew):
    H, W = c.px.shape[:2]
    if quad[0][0] > quad[1][0]:                                       # keep the figure unmirrored on screen
        quad = [quad[1], quad[0], quad[3], quad[2]]
    h, w = crew.shape[:2]
    pad = 0.06                                                        # a margin inside the window
    q = np.array(quad, float); ctr = q.mean(0); q = ctr + (q - ctr) * (1 - pad)
    im = Image.fromarray(crew).transform((W, H), Image.PERSPECTIVE, tuple(coeffs(q.tolist(), w, h)), Image.NEAREST)
    a = np.asarray(im)[..., 3] > 0
    m = np.zeros((H, W), bool)
    mh, mw = mask.shape[:2]; m[my:my + mh, mx:mx + mw] = mask[..., 3] > 0
    a &= m
    rgb = np.asarray(im)[..., :3].astype(float); lum = rgb.mean(-1) / 255
    base = c.px[..., :3].astype(float)
    shade = 0.78 + 0.6 * (lum - 0.45)
    up = np.roll(np.roll(a, 1, 0), 1, 1); dn = np.roll(np.roll(a, -1, 0), -1, 1)
    shade = np.where(a & ~up, shade * 1.22, shade); shade = np.where(a & ~dn, shade * 0.62, shade)
    out = np.clip(base * shade[..., None], 0, 255)
    out = out * 0.85 + np.array(tint) * 0.15
    c.px[..., :3] = np.where(a[..., None], out, base).astype(np.uint8)
def scene(v):
    c = Canvas(260, 290); ox, oy = 150, 235
    for gx in range(-3, 3):
        for gy in range(-3, 3):
            floor(c, pub, *iso(ox, oy, gx, gy), 1, 1)
    c.static(G, f"slab.study.{v}", ox, oy)
    f = faces[v] if isinstance(faces[v], dict) else {"faces": faces[v], "kinds": ["body"] * len(faces[v])}
    for i, (quad, kind) in enumerate(zip(f["faces"], f["kinds"])):
        aid = f"slab.study.{v}.face{i}"
        if aid not in G.m["assets"]:
            continue
        img, _, an = G.static(aid)
        press(c, [(ox + x, oy + y) for x, y in quad], img, ox - an["x"], oy - an["y"], TINT, HEAD if kind == "head" else body)
    j = 0
    while f"slab.study.{v}.ov{j}" in G.m["assets"]:                 # translucent layers (light, shadow, glass)
        c.static(G, f"slab.study.{v}.ov{j}", ox, oy)
        j += 1
    return Image.fromarray(c.px[..., :3])
order = sys.argv[4].split(",") if len(sys.argv) > 4 else ["s31", "s32", "s33"]
names = {"c11": "hover B: floating cradle", "s31": "31 twin towers: housed base and canopy, corner towers",
         "s32": "32 three columns: housed base and canopy, corner columns",
         "s33": "33 back tower: canopy cantilevered off one corner tower"}
Z = 3
rows = (len(order) + 2) // 3
sheet = Image.new("RGB", (3 * (260 * Z + 10), rows * (290 * Z + 30)), (40, 40, 40)); d = ImageDraw.Draw(sheet)
for i, v in enumerate(order):
    x, y = (i % 3) * (260 * Z + 10), (i // 3) * (290 * Z + 30)
    sheet.paste(scene(v).resize((260 * Z, 290 * Z), Image.NEAREST), (x, y + 30)); d.text((x + 8, y + 8), names[v], fill=(230, 230, 230))
sheet.save(sys.argv[3])
