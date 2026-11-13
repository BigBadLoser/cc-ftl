"""Slab storage fill levels from layers (args: outdir faces.json out): the base `fb`, then each full slot's slab
layer and its pressed face, back to front; beside the reference `ff` (all ten in one render) and their difference."""
import json, math, sys
sys.path.insert(0, "/home/user/cc-ftl/tools/blender/review")
import numpy as np
from PIL import Image, ImageDraw
import slab_preview as SP
from robots_preview import Canvas, floor, iso

G, faces = SP.G, SP.faces
ANG = [math.radians(45 + 36 * i) for i in range(10)]
ORDER = sorted(range(10), key=lambda i: math.cos(ANG[i] - math.pi / 4))    # far (back) first


def floor_canvas():
    c = Canvas(260, 290); ox, oy = 150, 235
    for gx in range(-3, 3):
        for gy in range(-3, 3):
            floor(c, SP.pub, *iso(ox, oy, gx, gy), 1, 1)
    return c, ox, oy


def press(c, ox, oy, v, i):
    f = faces[v]["faces"][i]
    if f"slab.study.{v}.face{i}" not in G.m["assets"]:            # that face is hidden at this slot
        return
    img, _, an = G.static(f"slab.study.{v}.face{i}")
    SP.press(c, [(ox + x, oy + y) for x, y in f], img, ox - an["x"], oy - an["y"], SP.TINT, SP.body)


def layered(full):
    c, ox, oy = floor_canvas()
    c.static(G, "slab.study.fb", ox, oy)
    for i in ORDER:
        if i in full:
            if f"slab.study.fb.ov{i}" in G.m["assets"]:            # (a slot wholly hidden has no layer)
                c.static(G, f"slab.study.fb.ov{i}", ox, oy)
            press(c, ox, oy, "fb", i)
    return np.array(c.px[..., :3])


def reference():
    c, ox, oy = floor_canvas()
    c.static(G, "slab.study.ff", ox, oy)
    for i in range(len(faces["ff"]["faces"])):
        press(c, ox, oy, "ff", i)
    return np.array(c.px[..., :3])


ref, ten = reference(), layered(set(range(10)))
diff = np.abs(ref.astype(int) - ten.astype(int)).max(-1)
mark = ten.copy(); mark[diff > 24] = (255, 0, 255)
n = int((diff > 24).sum())
panels = [("reference: all ten in one render", ref), ("layers: all ten", ten), (f"difference ({n} px off)", mark),
          ("layers: 7 full", layered({0, 1, 2, 4, 6, 7, 9})), ("layers: 3 full", layered({0, 3, 8})),
          ("layers: empty", layered(set()))]
Z = 3
sheet = Image.new("RGB", (3 * (260 * Z + 10), 2 * (290 * Z + 30)), (40, 40, 40)); d = ImageDraw.Draw(sheet)
for j, (name, px) in enumerate(panels):
    x, y = (j % 3) * (260 * Z + 10), (j // 3) * (290 * Z + 30)
    sheet.paste(Image.fromarray(px.astype(np.uint8)).resize((260 * Z, 290 * Z), Image.NEAREST), (x, y + 30))
    d.text((x + 8, y + 8), name, fill=(230, 230, 230))
sheet.save(sys.argv[3])
print("px off:", n)
