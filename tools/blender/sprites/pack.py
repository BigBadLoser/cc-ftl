"""Sheet packing and manifest merging for the sprite families (no bpy needed except for `read_png`).

A family renders a list of items {id, fp, rgba, g, ax, ay} (cropped sprite, glow twin, anchor inside the crop). `pack`
shelf-packs them into pages of at most PAGE x PAGE px: sheet `<family>` (page 0), `<family>.1`, ... with images
`sprites/<sheet>.png` and `.glow.png`. `merge` folds a family's fragment into an existing manifest: every asset of the
family's sheets and every id the family produces is replaced, everything else is kept, so families rebuild one at a
time and the committed manifest is the cache."""
import json
import re

import numpy as np

from .post import write_png

PAGE = 2048


def read_png(path):
    """RGBA uint8 (h, w, 4) of a PNG, top row first (Blender image loader)."""
    import bpy
    img = bpy.data.images.load(str(path))
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "STRAIGHT"
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return np.clip(np.round(px.reshape(h, w, 4)[::-1] * 255), 0, 255).astype(np.uint8)


def _pages(items):
    """Shelf packing, tallest first. Returns [[item...] per page] and sets it['x'], it['y']."""
    order = sorted(items, key=lambda it: (-it["rgba"].shape[0], it["id"]))
    pages, cur, x, y, rowh, width = [], [], 1, 1, 0, 1
    for it in order:
        h, w = it["rgba"].shape[:2]
        if x + w + 1 > PAGE:
            x, y, rowh = 1, y + rowh + 1, 0
        if y + h + 1 > PAGE:
            pages.append(cur)
            cur, x, y, rowh = [], 1, 1, 0
        it["x"], it["y"] = x, y
        x += w + 1
        rowh = max(rowh, h)
        cur.append(it)
    if cur:
        pages.append(cur)
    return pages


def pack(family, items, out, log=print):
    """Writes the family's pages; returns (sheets, assets) manifest maps."""
    sheets, assets = {}, {}
    (out / "sprites").mkdir(parents=True, exist_ok=True)
    for k, page in enumerate(_pages(items)):
        name = family if k == 0 else f"{family}.{k}"
        W = max(it["x"] + it["rgba"].shape[1] for it in page) + 1
        H = max(it["y"] + it["rgba"].shape[0] for it in page) + 1
        W = 1 << (W - 1).bit_length()
        atlas = np.zeros((H, W, 4), np.uint8)
        glow = np.zeros_like(atlas)
        for it in page:
            h, w = it["rgba"].shape[:2]
            atlas[it["y"]:it["y"] + h, it["x"]:it["x"] + w] = it["rgba"]
            glow[it["y"]:it["y"] + h, it["x"]:it["x"] + w] = it["g"]
            a = {"kind": "static", "sheet": name, "frame": {"x": int(it["x"]), "y": int(it["y"]), "w": int(w), "h": int(h)},
                 "anchor": {"x": int(it["ax"]), "y": int(it["ay"])}, "footprint": [int(v) for v in it["fp"]]}
            if it["g"][..., 3].any():
                a["glow"] = True
            assets[it["id"]] = a
        write_png(out / f"sprites/{name}.png", atlas)
        sd = {"image": f"sprites/{name}.png"}
        if glow[..., 3].any():
            write_png(out / f"sprites/{name}.glow.png", glow)
            sd["glow"] = f"sprites/{name}.glow.png"
        sheets[name] = sd
        log(f"PACK {name} {W}x{H}, {len(page)} sprites")
    return sheets, assets


def owned(sheet, family):
    return sheet == family or re.fullmatch(re.escape(family) + r"\.\d+", sheet) is not None


def merge(manifest, family, sheets, assets, crew=False):
    """Replace the family's sheets/assets (crew=True: every human crew layer; robot layers belong to `robots`) in
    manifest (in place)."""
    drop = {s for s in manifest["sheets"] if owned(s, family)}
    human = lambda a: a["kind"] == "crew.layer" and a.get("species") == "human"  # noqa: E731
    if crew:
        drop |= {a["sheet"] for a in manifest["assets"].values() if human(a)}
    manifest["assets"] = {k: a for k, a in manifest["assets"].items()
                          if a["sheet"] not in drop and k not in assets and not (crew and human(a))}
    for s in drop:
        manifest["sheets"].pop(s, None)
    used = {a["sheet"] for a in manifest["assets"].values()}
    manifest["sheets"] = {k: v for k, v in manifest["sheets"].items() if k in used}
    manifest["sheets"].update(sheets)
    manifest["assets"].update(assets)
    return manifest


def load_manifest(path, base):
    if path.exists():
        m = json.loads(path.read_text())
        m.update({k: v for k, v in base.items() if k not in ("sheets", "assets")})
        return m
    return {**base, "sheets": {}, "assets": {}}


def save_manifest(path, m):
    m["assets"] = dict(sorted(m["assets"].items()))
    m["sheets"] = dict(sorted(m["sheets"].items()))
    path.write_text(json.dumps(m, indent=1))
